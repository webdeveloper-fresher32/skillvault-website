# 03 — Multi-Step and Iterative Retrieval

> How to handle questions that a single retrieval pass can't answer — by looping retrieve → reason → retrieve again until the system has genuinely enough evidence, with termination logic that can't run away.

---

## Table of Contents

1. [The Problem: Some Questions Need More Than One Retrieval](#1-the-problem-some-questions-need-more-than-one-retrieval)
2. [The Analogy: The Detective Who Follows One Clue to the Next](#2-the-analogy-the-detective-who-follows-one-clue-to-the-next)
3. [Internal Flow: The Iterative Retrieval Loop](#3-internal-flow-the-iterative-retrieval-loop)
4. [Code Example: A Bounded Multi-Step Retrieval Loop](#4-code-example-a-bounded-multi-step-retrieval-loop)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Some Questions Need More Than One Retrieval

Every retrieval pattern covered so far — Phase 8's retrieval strategies, Phase 9's reranking, even Lesson 01's tool-using agent — assumes one retrieval call is enough to gather the evidence needed to answer. That assumption holds for a huge fraction of real questions ("what's our refund policy?") but breaks down completely for questions that require **reasoning across multiple, separately-retrieved pieces of information**.

Take: *"Compare the pricing in these two documents."* A single retrieval pass, no matter how good the embedding or how clever the reranking, returns a fixed top-k list of chunks from *one* search. If document A and document B use different vocabulary to describe pricing, or if the query only clearly identifies document A by name, a single search might surface A's pricing chunk clearly but miss B's entirely — there's no way to search for "the second document" until you already know, from reading A, that a second document even needs to be found and what to look for in it.

The structural problem: **some questions can only be answered by finding one piece of evidence, reasoning about what that evidence implies you still need, retrieving again based on that new information, and repeating** — not by throwing a bigger `top_k` at a single search. This is often called multi-hop retrieval: each "hop" is a retrieval step informed by what the previous hop found.

---

## 2. The Analogy: The Detective Who Follows One Clue to the Next

**Real-world analogy:** think about how a detective actually solves a case, versus how a novice imagines it works.

The novice picture: hand the detective every piece of evidence collected so far, all at once, and expect a solved case in a single leap. That's what a single-shot retrieval pipeline effectively demands — get everything relevant in one search, then generate the final answer.

A real detective doesn't work that way. They find the first clue, examine it, and from what it reveals, decide what to look for *next* — a name, a location, a second piece of evidence that only becomes findable because the first clue pointed at it. They repeat this: follow a clue, form a new question, look for the next piece, and keep going until they genuinely have enough to state a conclusion — not until they've exhausted a predetermined, fixed number of steps, and not forever.

**Multi-step iterative retrieval is that detective's method, applied to a RAG pipeline.** Instead of expecting one search to surface everything a comparison question needs, the system retrieves, looks at what it found, generates a follow-up sub-question based on that, retrieves again, and keeps going until an explicit stopping signal says the case — the question — is actually solved.

> 🧠 One-sentence version: *"Don't expect the whole case solved from one piece of evidence — follow each clue to the next, and stop when you actually have enough, not when you get tired."*

---

## 3. Internal Flow: The Iterative Retrieval Loop

```
   User query: "Compare the pricing in doc A and doc B"
                       │
                       ▼
   ┌───────────────────────────────────────────────┐
   │  ITERATION 1                                     │
   │  Retrieve using the original query                │
   │  → finds Doc A's pricing chunk                     │
   └───────────────────┬───────────────────────────────┘
                       ▼
   ┌───────────────────────────────────────────────┐
   │  Ask the LLM: "Given what you have so far, do you │
   │  have enough to answer? If not, what should we      │
   │  search for next?"                                  │
   │  → LLM: "Not enough — need Doc B's pricing too.     │
   │     Next query: 'Doc B pricing'"                    │
   └───────────────────┬───────────────────────────────┘
                       ▼
   ┌───────────────────────────────────────────────┐
   │  ITERATION 2                                     │
   │  Retrieve using the LLM's follow-up sub-question   │
   │  → finds Doc B's pricing chunk                      │
   └───────────────────┬───────────────────────────────┘
                       ▼
   ┌───────────────────────────────────────────────┐
   │  Ask the LLM again: "Enough now?"                  │
   │  → LLM: "Yes — I have both documents' pricing."    │
   └───────────────────┬───────────────────────────────┘
                       ▼
   ┌───────────────────────────────────────────────┐
   │  SYNTHESIZE: generate the final answer using       │
   │  the ACCUMULATED context from every iteration       │
   │  (deduplicated), not just the last retrieval         │
   └───────────────────────────────────────────────────┘
```

Two things distinguish this from Lesson 01's tool-calling agent loop, even though both loop:

1. **The context accumulates across iterations.** Each retrieval adds to a running pool of evidence, rather than each tool call being an independent, self-contained result. The final synthesis step has to reason over *everything* gathered, not just the most recent retrieval.
2. **Termination needs two independent conditions, not one.** The loop must stop when the model genuinely believes it has enough evidence (a quality signal), *and* it must stop no matter what once a maximum iteration count is hit (a safety signal). Relying on only one of these is the single most important thing to get right in this pattern — covered in detail in Section 5.

---

## 4. Code Example: A Bounded Multi-Step Retrieval Loop

**Step 1 — the retrieval and reasoning primitives.** Retrieval reuses the same populated-Chroma pattern from earlier phases; nothing new there. The new piece is the "do you have enough, or what's next" prompt.

```python
import anthropic
import chromadb

client = anthropic.Anthropic()

# A previously-populated Chroma collection (Phase 5 pattern) holding chunks
# from multiple source documents, each tagged with a "source_doc" metadata field.
chroma_client = chromadb.PersistentClient(path="./chroma_data")
docs_collection = chroma_client.get_or_create_collection(name="comparison_docs")


def retrieve(query: str, top_k: int = 3) -> list[str]:
    results = docs_collection.query(query_texts=[query], n_results=top_k)
    return results["documents"][0] if results["documents"] else []


DECIDE_PROMPT = """You are answering this question using retrieved context that
has been gathered so far, one search at a time.

Original question: {question}

Context gathered so far (across all searches):
{accumulated_context}

Decide ONE of two things:
1. If the context above is enough to fully answer the original question,
   respond with exactly: DONE
2. If it is NOT enough, respond with exactly one line starting with
   "SEARCH: " followed by a short, specific search query for the ONE most
   important piece of information still missing.

Respond with nothing else — no explanation, just "DONE" or "SEARCH: ...".
"""

def decide_next_step(question: str, accumulated_context: list[str]) -> str:
    prompt = DECIDE_PROMPT.format(
        question=question,
        accumulated_context="\n---\n".join(accumulated_context) or "(nothing yet)",
    )
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}],
    )
    return next(b.text for b in response.content if b.type == "text").strip()
```

**Step 2 — the loop itself, with both required termination conditions.** This is the part that matters most: a `max_iterations` safety cap **and** a model-decided "DONE" exit, together — not either one alone.

```python
def iterative_retrieve(question: str, max_iterations: int = 4) -> list[str]:
    accumulated_context: list[str] = []
    seen_chunks: set[str] = set()  # dedupe guard — see Common Mistakes
    current_query = question

    for iteration in range(max_iterations):
        new_chunks = retrieve(current_query)

        # Deduplicate before adding: a later sub-query can easily re-surface
        # a chunk already retrieved in an earlier iteration.
        for chunk in new_chunks:
            if chunk not in seen_chunks:
                seen_chunks.add(chunk)
                accumulated_context.append(chunk)

        decision = decide_next_step(question, accumulated_context)

        if decision == "DONE":
            break  # model-decided exit: it believes it has enough

        if decision.startswith("SEARCH: "):
            current_query = decision[len("SEARCH: "):].strip()
        else:
            # Model didn't follow the format — treat as "no clear next step"
            # rather than looping on a malformed instruction.
            break
    # If the loop runs all max_iterations without a "DONE", it exits here via
    # the `for` loop ending naturally — this is the hard safety cap, and it
    # fires independently of whatever the model would have decided next.

    return accumulated_context


def synthesize_answer(question: str, accumulated_context: list[str]) -> str:
    prompt = (
        f"Using ONLY the context below, answer the question.\n\n"
        f"Context:\n" + "\n---\n".join(accumulated_context) +
        f"\n\nQuestion: {question}"
    )
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return next(b.text for b in response.content if b.type == "text")


context = iterative_retrieve("Compare the pricing in doc A and doc B")
answer = synthesize_answer("Compare the pricing in doc A and doc B", context)
print(answer)
```

Walking through why both termination conditions matter: the `for iteration in range(max_iterations)` loop guarantees the function returns after at most `max_iterations` retrievals *no matter what the model decides* — even if `decide_next_step` never returns "DONE," or returns malformed output every time. The `if decision == "DONE": break` line is what lets the loop stop *early*, before hitting the cap, once the model genuinely has enough — which saves both latency and cost on the common case where two or three hops are plenty. Neither condition alone is sufficient: the cap alone would always run the maximum number of retrievals even on simple questions; "DONE" alone, with no cap, is exactly the runaway-loop risk covered next.

---

## 5. Common Mistakes

**Mistake 1: No termination condition at all — or only one of the two required conditions.** The most serious failure mode in this pattern is relying solely on the model to decide when to stop (no hard iteration cap), or solely on a fixed iteration count (no model judgment, so the loop always runs the maximum every time regardless of how simple the question is). A model-only exit condition is dangerous: if the model gets stuck in an unproductive pattern — deciding "not enough" repeatedly on trivially similar sub-queries — the loop runs indefinitely, burning API calls and money with no upper bound. The fix, shown in the code above, is to require **both**: a hard `max_iterations` cap that terminates the loop unconditionally, and a model-decided "I have enough" signal that can exit *early* when it's genuinely warranted. Neither substitutes for the other.

**Mistake 2: Not deduplicating context accumulated across iterations.** Each iteration's retrieval can easily re-surface a chunk that was already added in an earlier round — especially when sub-queries the model generates are only loosely different from the original question. Without deduplication, the accumulated context sent to the final synthesis step grows with repeated copies of the same passage, wasting context-window space and, in the worst case, subtly biasing the final answer toward whatever got duplicated most. The `seen_chunks` set in the code above is the fix: track which chunks (by their text, or better, by a stable chunk ID from Phase 4's chunking metadata) have already been added, and skip re-adding a chunk the loop has already seen.

**Interview angle:** This is one of the most reliably-asked questions about iterative retrieval, because the wrong answer ("just let the model decide when to stop") is a genuine production risk. A strong answer states both required termination pieces explicitly — a hard iteration cap as the non-negotiable safety net, plus a model-decided early exit for efficiency on simple questions — and separately calls out that accumulated context needs deduplication across hops, since naive accumulation without a seen-set silently degrades both cost and answer quality as the loop runs longer.

---

## 6. Hands-On Exercises

### Exercise 1 — Trace the loop's decision at each iteration

**Goal:** Confirm the loop actually narrows in on missing information rather than just repeating the same search.

Run `iterative_retrieve("Compare the pricing in doc A and doc B")` with print statements inside the loop showing `current_query`, the raw `decision` string, and the running length of `accumulated_context` at the end of each iteration. Confirm the sub-query changes between iteration 1 and iteration 2 (it should shift from the original comparison question toward something naming the second document specifically).

### Exercise 2 — Force the safety cap to fire

**Goal:** Prove the hard iteration cap works independently of the model's judgment.

Temporarily change `DECIDE_PROMPT` to always instruct the model to respond with a `SEARCH:` line and never `DONE` (simulate a model that never believes it has enough). Run `iterative_retrieve` with `max_iterations=3` and confirm the function still returns after exactly 3 iterations rather than looping forever. This demonstrates why the `for` loop's cap must be unconditional, independent of anything `decide_next_step` returns.

### Exercise 3 — Add deduplication by chunk ID instead of by text

**Goal:** Harden the dedupe guard against a real-world edge case.

The current `seen_chunks` set dedupes on exact chunk *text*, which fails if two chunks have near-identical but not byte-identical content (e.g. trailing whitespace differences from re-chunking). Modify `retrieve()` to also return each chunk's stable ID (Chroma's `results["ids"][0]`, following the id-based patterns from Phase 5), and change `iterative_retrieve` to dedupe on ID instead of text. Explain in your own words why ID-based dedup is more robust than text-based dedup.

---

## 7. Interview Q&A

### Q1. Why would a single retrieval pass fail on a question like "compare the pricing in these two documents"?

**Answer:** A single search returns a fixed top-k list from one query, and if the question only clearly names one of the two documents (or the two documents use different vocabulary for the same concept), the search can surface one document's relevant chunk while missing the other's entirely. There's no way to search specifically for "the second document's pricing" until the system has already looked at the first document and realized a second one needs to be found — which requires a reasoning step between two separate retrievals, not a single search no matter how large `top_k` is set.

---

### Q2. Describe the iterative retrieval loop end to end.

**Answer:** Retrieve using the original (or current) query, add the results to an accumulated, deduplicated context pool, then ask the LLM whether that accumulated context is enough to answer the original question or what to search for next. If the model says it has enough, stop and synthesize the final answer from everything accumulated. If not, take the model's suggested follow-up sub-question, retrieve again, and repeat — bounded by a hard maximum-iteration cap that fires regardless of what the model decides.

---

### Q3. Why is relying only on the model's "I have enough" judgment dangerous, and why is relying only on a fixed iteration count also not ideal?

**Answer:** A model-only stopping condition risks a runaway loop: if the model repeatedly judges "not enough" on unproductive or nearly-identical sub-queries, there's no upper bound on cost or latency. A fixed-count-only condition, with no model judgment, forces every query to run the maximum number of retrievals even when two hops would have been plenty, wasting cost and latency on simple questions. The correct design uses both together: a hard cap as the non-negotiable safety net, and a model-decided early exit for efficiency.

---

### Q4. Why does context need to be deduplicated across iterations, and how would you do it?

**Answer:** Each new sub-query can easily retrieve a chunk that an earlier iteration already added, especially when consecutive sub-queries are only loosely different from each other or from the original question. Without deduplication, the same passage can appear multiple times in the context handed to the final synthesis step, wasting context-window budget and potentially skewing the answer toward whatever got duplicated. The fix is to track a set of already-seen chunks — ideally by a stable chunk ID rather than exact text match, since near-duplicate chunk text can slip past a text-based check — and skip re-adding anything already in that set.

---

### Q5. How is multi-step iterative retrieval different from the tool-using agent loop in Lesson 01?

**Answer:** Both loop and both let an LLM make decisions between steps, but they solve different problems. The Lesson 01 agent loop decides *whether and which tool* to call for a single-shot need (retrieve, calculate, search the web), and each tool call is largely independent. Iterative retrieval assumes retrieval is definitely needed but a single pass isn't enough, and it specifically accumulates evidence *across* multiple retrieval hops, using each hop's results to inform what to search for next, before synthesizing one final answer from everything gathered.

---

> 🧠 **Memory hook:** "Follow the clue, don't expect the whole case from one piece of evidence — and stop either when you truly have enough, or when you've used up your allotted number of leads, whichever comes first."
