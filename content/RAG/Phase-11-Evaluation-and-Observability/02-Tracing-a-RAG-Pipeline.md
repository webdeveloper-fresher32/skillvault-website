# 02 — Tracing a RAG Pipeline

> A comprehensive reference covering structured tracing across every stage of a RAG pipeline, a `RAGTrace` dataclass built on Phase 10's `run_pipeline` function, and where dedicated observability tools fit in.

---

## Table of Contents

1. [The Problem: Which Stage Broke?](#1-the-problem-which-stage-broke)
2. [The Analogy: A Package Tracking Number](#2-the-analogy-a-package-tracking-number)
3. [Internal Flow: One Traceable Record Per Query](#3-internal-flow-one-traceable-record-per-query)
4. [Code Example: A `RAGTrace` Dataclass](#4-code-example-a-ragtrace-dataclass)
5. [Beyond Print Statements: Dedicated Observability Tools](#5-beyond-print-statements-dedicated-observability-tools)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Which Stage Broke?

Phase 10's `run_pipeline` function (Lesson 03) strings together eight stages: load, chunk, embed and store, retrieve, rerank, construct the prompt, generate, and cite sources. That lesson's own Mistake 2 already named the exact pain this lesson exists to solve: when the final answer is wrong, *which* of those stages actually produced the failure? A wrong answer could mean the relevant chunk was never retrieved at all (Phase 8), it was retrieved but the reranker discarded it (Phase 9), it survived reranking but the prompt template didn't include it correctly, or everything upstream was fine and the LLM simply misread perfectly good context.

In a nine-line hand-rolled script you could just sprinkle `print()` statements everywhere and eyeball the output. That doesn't scale: once a pipeline has eight stages, runs against live traffic, and needs to be debugged *after the fact* — hours or days after a user reported a bad answer, when you can't just re-run it interactively and watch the prints scroll by — you need every stage's output captured and stored, not just glanced at in a terminal and then thrown away.

So the concrete problem this lesson solves: **capture the query, the retrieved chunk ids and scores, the reranked order, the final prompt, and the generated answer as one structured, storable record — so that debugging a bad answer means reading a trace, not guessing.**

---

## 2. The Analogy: A Package Tracking Number

**Real-world analogy:** when you ship a package, you get a tracking number. That number isn't just a label for "the package exists" — it's a key into a running log of *every checkpoint the package passed through*: picked up at the origin facility, arrived at the regional sorting center, departed for the next hub, out for delivery, delivered. If the package never arrives, you don't have to guess where it went missing — you look up the tracking number and see exactly the last checkpoint it reached before it stopped moving. Did it never leave the first facility? Did it get to the local depot and then vanish? The tracking log tells you precisely where to look, instead of forcing you to re-ship a duplicate and hope.

**A RAG trace is that tracking number for a single query.** Instead of a package moving through pickup → sorting → hub → delivery, a query moves through retrieve → rerank → prompt → generate. If the final answer is wrong, you don't re-run the whole pipeline blind and hope to spot the issue — you pull up that query's trace and read off exactly which checkpoint the failure happened at: chunks that were never retrieved, chunks that were retrieved but dropped during reranking, or a prompt that had the right chunks but the model still got it wrong.

> 🧠 One-line version: *"A trace is a tracking number for a query — it tells you exactly which checkpoint the answer got lost at, instead of making you guess."*

---

## 3. Internal Flow: One Traceable Record Per Query

The core idea is simple: instead of letting each stage's intermediate output disappear once the next stage consumes it, capture it into a single structured object as the pipeline runs, and keep that object around after the pipeline finishes. Mapped onto Phase 10's `run_pipeline` function, the checkpoints to capture are:

1. **The query** — the original question, exactly as the user asked it (before any rewriting from Phase 9).
2. **Retrieved chunks** — for each chunk `retriever.invoke(question)` returned: enough to identify it later (a chunk id or its `source` metadata) plus whatever score the retrieval step produced, if any.
3. **Reranked order** — the same chunks after the cross-encoder reranking step, in their new order, along with their rerank scores — this is what lets you see whether reranking *promoted* the right chunk, *demoted* it, or dropped it from the top-k entirely.
4. **The final prompt** — the fully assembled text actually sent to the LLM, context and question included. This matters because a prompt template bug (a missing variable, a chunk that didn't get interpolated correctly) is invisible unless you can see the literal string that was sent.
5. **The generated answer** — the LLM's raw response text.

Capturing all five as one record means that when an answer is wrong, you read the trace top to bottom and stop at the first checkpoint that looks wrong — exactly like reading a tracking log and finding the last good checkpoint before the package went missing.

```
   query ──▶ retrieved_chunks ──▶ reranked_chunks ──▶ final_prompt ──▶ generated_answer
              (Phase 8 output)     (Phase 9 output)     (this phase's       (Phase 10's
                                                          assembly step)      LLM call)

   A wrong answer means: walk this chain left to right, and find the first
   checkpoint where the "right" chunk (or the right prompt content) is missing.
```

---

## 4. Code Example: A `RAGTrace` Dataclass

The example below extends Phase 10's `run_pipeline` function directly — the same `retriever`, `rerank_step`, `prompt`, and `llm` objects defined there are reused here unchanged; only `run_pipeline` itself is rewritten to populate a trace object as it runs, instead of just printing the final answer.

A `dataclass` (from Python's standard `dataclasses` module) is a plain class whose job is mostly to hold data — you declare the fields with their types, and Python auto-generates the `__init__` method that sets them, so you don't have to hand-write boilerplate like `self.query = query` for every field.

```python
from dataclasses import dataclass, field
from datetime import datetime, timezone

from langchain_core.documents import Document


@dataclass
class RAGTrace:
    """One structured record of everything that happened while answering
    a single query, checkpoint by checkpoint."""
    query: str
    retrieved_chunks: list[dict] = field(default_factory=list)
    # `field(default_factory=list)` -- dataclasses can't use a mutable default
    # like `[]` directly (all instances would share the same list object), so
    # you pass a zero-argument function that builds a *new* empty list per
    # instance instead.
    reranked_chunks: list[dict] = field(default_factory=list)
    final_prompt: str = ""
    generated_answer: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def _doc_to_trace_entry(doc: Document, score: float | None = None) -> dict:
    """Capture just enough about a Document to identify it later in a trace,
    without storing the full chunk text (traces are for debugging structure,
    not for re-reading the document)."""
    entry = {
        "source": doc.metadata.get("source", "unknown"),
        "preview": doc.page_content[:80],  # first 80 chars -- enough to recognize the chunk
    }
    if score is not None:
        entry["score"] = round(float(score), 4)
    return entry


def run_pipeline_traced(question: str) -> tuple[str, RAGTrace]:
    """Same stages as Phase 10's run_pipeline, but every intermediate
    checkpoint is captured into a RAGTrace instead of being discarded."""
    trace = RAGTrace(query=question)

    # --- Checkpoint 1: retrieval (Phase 8) ---
    retrieved_docs = retriever.invoke(question)
    trace.retrieved_chunks = [_doc_to_trace_entry(doc) for doc in retrieved_docs]

    # --- Checkpoint 2: reranking (Phase 9) ---
    reranked = rerank_step.invoke({"question": question, "documents": retrieved_docs})
    trace.reranked_chunks = [_doc_to_trace_entry(doc) for doc in reranked["top_docs"]]

    if not reranked["top_docs"]:
        trace.generated_answer = "No relevant information was found for this question."
        return trace.generated_answer, trace

    # --- Checkpoint 3: prompt construction ---
    prompt_input = build_prompt_input(reranked)
    formatted_prompt = prompt.invoke(prompt_input)
    trace.final_prompt = formatted_prompt.to_string()  # the literal text sent to the LLM

    # --- Checkpoint 4: generation (Phase 10) ---
    response = llm.invoke(formatted_prompt)
    trace.generated_answer = response.content

    return response.content, trace


def print_trace(trace: RAGTrace) -> None:
    """Pretty-print a trace, checkpoint by checkpoint, for manual inspection."""
    print(f"{'='*60}")
    print(f"QUERY:  {trace.query}")
    print(f"TIME:   {trace.timestamp}")
    print(f"{'-'*60}")
    print(f"RETRIEVED ({len(trace.retrieved_chunks)} chunks):")
    for entry in trace.retrieved_chunks:
        print(f"  - [{entry['source']}] {entry['preview']!r}")
    print(f"{'-'*60}")
    print(f"RERANKED, TOP {len(trace.reranked_chunks)}:")
    for entry in trace.reranked_chunks:
        print(f"  - [{entry['source']}] {entry['preview']!r}")
    print(f"{'-'*60}")
    print("FINAL PROMPT:")
    print(trace.final_prompt or "(none -- no chunks survived reranking)")
    print(f"{'-'*60}")
    print(f"ANSWER: {trace.generated_answer}")
    print(f"{'='*60}")


answer, trace = run_pipeline_traced("How long do I have to return an international order?")
print_trace(trace)
```

Reading this trace top to bottom mirrors exactly the debugging discipline Phase 10 named but didn't formalize: if `retrieved_chunks` is empty or clearly off-topic, the problem is retrieval (Phase 8) or the embeddings underneath it (Phase 2). If `retrieved_chunks` looks right but `reranked_chunks` dropped the relevant one, the problem is reranking (Phase 9). If `reranked_chunks` looks right but `final_prompt` doesn't actually contain that chunk's text, the problem is the prompt assembly step. And if `final_prompt` clearly contains the right information but `generated_answer` still gets it wrong, the problem is squarely in generation — the model itself, or the instructions in the prompt template.

---

## 5. Beyond Print Statements: Dedicated Observability Tools

The `RAGTrace` dataclass above is a hand-rolled, minimal version of a much bigger idea: dedicated LLM observability platforms, such as **LangSmith** (built by the LangChain team, and integrating directly with the LCEL pipelines from Phase 10), automatically capture this same kind of structured trace for every run of a chain — every stage's inputs and outputs, timing, token counts, and cost — without you having to hand-write a dataclass and manually populate it at each checkpoint. They typically add a searchable UI on top, so instead of `print_trace(trace)` in a terminal, you get a dashboard where you can filter for "queries where the final answer was rated low-faithfulness" (tying directly back to Lesson 01's metrics) and jump straight into that query's full trace.

The conceptual leap from this lesson's `RAGTrace` to a tool like LangSmith is small: same checkpoints, same idea of "capture every stage's output as one linked record" — the production-grade version just does the capturing automatically (often via instrumentation hooks already built into the framework, rather than needing you to modify `run_pipeline` by hand), persists traces durably instead of only in memory, and gives you a UI and query layer over thousands of them instead of one `print()` call at a time.

**Interview angle:** "How would you debug a RAG system in production when a user reports a bad answer?" is a common systems-design follow-up, and a strong answer names tracing specifically — not just "I'd add logging," but "I'd capture the retrieved chunks, the reranked order, and the final prompt as one linked record per query, so I can see exactly which stage the failure happened at instead of re-running the pipeline and guessing." Naming a real tool (like LangSmith) as the production-grade version of that same idea signals you know this problem has established tooling, not just that you could hand-roll a dataclass.

---

## 6. Common Mistakes

**Mistake 1: Only logging the final answer, discarding intermediate retrieval results.** This is the most common observability mistake, and it's the direct root cause of the problem in Section 1. If your logging only captures `question` and `response.content`, then a bad answer six weeks from now gives you exactly two data points — you have no way to know, after the fact, whether the right chunk was retrieved and mishandled, or never retrieved at all. Debugging degenerates into re-running the query live and hoping the retrieval behaves the same way it did the first time (it might not, if the underlying document collection changed in the meantime). Capturing every checkpoint, as Section 4 does, turns "guess what happened" into "read what happened."

**Mistake 2: Storing full chunk text in every trace instead of an identifier.** It's tempting to dump the entire retrieved chunk's content into the trace "just in case." At small scale this is harmless, but at production volume it multiplies storage cost enormously (you're now storing your entire document corpus's text once per query that happens to retrieve it) and makes traces slower to read through. Section 4's `_doc_to_trace_entry` deliberately stores only a `source` identifier and a short preview — enough to recognize which chunk was involved without duplicating its full content into every trace record.

---

## 7. Hands-On Exercises

### Exercise 1 — Trace a deliberately broken pipeline

**Goal:** Use a trace to actually locate a failure, rather than just reading about the idea.

Reuse the misconfiguration from Phase 10 Lesson 03's Exercise 1 (set `chunk_size=20`, or reduce `fetch_k` to `1`). Run `run_pipeline_traced` instead of the untraced version, call `print_trace`, and confirm you can point to the exact checkpoint (`retrieved_chunks` vs. `reranked_chunks` vs. `final_prompt`) where the degradation first becomes visible, without needing to add any new print statements.

### Exercise 2 — Add a rerank-score field to the trace

**Goal:** Extend `RAGTrace` to capture more than just chunk identity.

Modify `_doc_to_trace_entry` calls in the reranking checkpoint so that each entry in `trace.reranked_chunks` also includes the cross-encoder score from Phase 10's `rerank` function (you'll need to adjust `rerank_step`'s output, or pass the scores through separately). Re-run a query and confirm `print_trace` now shows *why* each chunk ranked where it did, not just its final position.

### Exercise 3 — Compare two traces for the same query after a pipeline change

**Goal:** Practice using traces the way Lesson 01's repeated-evaluation discipline is used — to detect regressions, not just one-off failures.

Run `run_pipeline_traced` for the same question both before and after changing one pipeline parameter (e.g., `search_kwargs={"k": 6, ...}` changed to `k: 2`). Save both traces and compare `retrieved_chunks` between them. Explain in your own words what changed and why, and what kind of regression this comparison would catch that looking only at the two final answers side by side might miss.

---

## 8. Interview Q&A

### Q1. Why isn't logging just the final question and answer enough for debugging a RAG system?

**Answer:** Because a wrong final answer can originate from any of several stages — retrieval, reranking, prompt assembly, or generation — and the question/answer pair alone gives no visibility into which one. Without the intermediate results (what was retrieved, what survived reranking, what the final prompt actually contained), debugging a reported bad answer means re-running the pipeline and hoping to reproduce the same behavior, rather than reading back exactly what happened the first time.

---

### Q2. What should a RAG trace capture, at minimum?

**Answer:** The original query, the chunks retrieval returned (with enough identifying information to recognize them later), the chunks and order that survived reranking, the fully assembled prompt actually sent to the LLM, and the generated answer. Together these let you walk the pipeline checkpoint by checkpoint and find the first stage where something looks wrong.

---

### Q3. What's the analogy for why tracing matters, and how does it map onto a RAG pipeline?

**Answer:** A trace is like a package's tracking number — it isn't just proof the package exists, it's a log of every checkpoint it passed through, so if it goes missing you can see the last good checkpoint instead of guessing. In a RAG pipeline, the "checkpoints" are retrieval, reranking, prompt assembly, and generation; a trace records each one so a wrong answer can be traced back to the specific stage that produced it.

---

### Q4. How does a tool like LangSmith relate to hand-rolling a trace dataclass?

**Answer:** They capture the same conceptual checkpoints — retrieved documents, reranked order, prompts, generated output, timing and cost — but a dedicated observability tool does the capturing automatically (often via hooks built into the orchestration framework) rather than requiring you to modify your pipeline function by hand, persists traces durably, and provides a searchable UI over many traces at once instead of one `print()` call per run. A hand-rolled `RAGTrace` dataclass is a useful minimal version of the same idea, and a reasonable starting point before adopting dedicated tooling.

---

### Q5. What's a common mistake teams make with RAG logging, and why is it costly?

**Answer:** Logging only the final answer and discarding intermediate retrieval and reranking results. It's costly because it makes debugging any reported bad answer pure guesswork after the fact — there's no way to know whether the right chunk was ever retrieved, whether it was dropped during reranking, or whether the prompt failed to include it, since none of that intermediate state was preserved.

---

> 🧠 **Memory hook:** "A trace is a tracking number for a query — read it top to bottom and stop at the first checkpoint that looks wrong."
