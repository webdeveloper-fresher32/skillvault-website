# 03 — End-to-End RAG Pipeline with LangChain

> A comprehensive reference covering how to assemble every stage from Phases 3-9 — loading, chunking, embedding, storage, MMR retrieval, cross-encoder reranking, and generation with cited sources — into one coherent LangChain pipeline.

---

## Table of Contents

1. [The Problem: One Coherent Pipeline, Not Nine Separate Scripts](#1-the-problem-one-coherent-pipeline-not-nine-separate-scripts)
2. [The Analogy: An Assembly Line with a Standardized Conveyor Belt](#2-the-analogy-an-assembly-line-with-a-standardized-conveyor-belt)
3. [Internal Flow: Every Stage, Mapped Back to Its Phase](#3-internal-flow-every-stage-mapped-back-to-its-phase)
4. [Code Example: The Full Pipeline](#4-code-example-the-full-pipeline)
5. [Where LangChain Doesn't Have a Built-In Step: Reranking](#5-where-langchain-doesnt-have-a-built-in-step-reranking)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: One Coherent Pipeline, Not Nine Separate Scripts

Every earlier phase in this course taught one stage of RAG in isolation: Phase 3 taught loading raw documents, Phase 4 taught chunking, Phase 5 taught embedding and storing in Chroma, Phase 8 taught retrieval strategies including MMR, and Phase 9 taught reranking and query transformation. Lessons 01 and 02 of this phase showed how LangChain standardizes the *connections* between adjacent stages — a retriever piped into a prompt piped into an LLM.

What's left is the hardest integration problem in any real RAG system: **wiring every stage — ingestion through generation — into one coherent pipeline, where a change at any stage (a different chunk size, a different `k`, an added reranking step) doesn't require re-plumbing everything downstream of it.** This is also where RAG systems most often break in practice — not because any single stage is wrong, but because the *seams* between stages are misconfigured: a chunk size that doesn't match what the reranker expects, a retriever `k` that's too small for reranking to have anything to work with, a prompt that doesn't actually include the metadata needed to cite sources.

---

## 2. The Analogy: An Assembly Line with a Standardized Conveyor Belt

**Real-world analogy:** picture a factory assembly line. One station cuts raw material to size, the next station shapes it, the next assembles it with other parts, the next inspects it, and the last station packages the finished product. Each station in isolation is a piece of specialized machinery — exactly like the specialized techniques from Phases 3-9. What makes it an *assembly line*, rather than nine machines sitting in a warehouse, is the conveyor belt connecting them: a standardized mechanism that takes the output of one station and feeds it as input to the next, so the whole line runs end-to-end without a human manually carrying parts between stations.

**This phase's pipeline is that assembly line**, and LCEL's `|` operator (Lessons 01-02) is the conveyor belt. The loader, splitter, embedder, vector store, retriever, reranker, and prompt are each still doing exactly what they did in their own phase — nothing about *what* chunking or reranking does has changed. What's new is that they're now connected by a standardized mechanism, so the finished pipeline runs as one line from raw document to cited answer, instead of nine disconnected scripts you'd otherwise have to run and glue together by hand.

> 🧠 One-line version: *"Every station on the assembly line still does its own specialized job — LangChain is just the conveyor belt connecting them into one line."*

One caveat worth flagging up front: Section 4's actual pipeline calls each stage with `.invoke(...)` step by step rather than piping everything together with a single `|` chain like Lessons 01-02 did. That's a deliberate choice, not a contradiction of the conveyor-belt idea — see Mistake 2 in Section 6 for why keeping the intermediate stages as inspectable named variables matters once a pipeline has this many steps.

---

## 3. Internal Flow: Every Stage, Mapped Back to Its Phase

The full pipeline has eight stages. Each one is a direct continuation of a technique this course already covered manually — this lesson's job is only to show how they connect, not to reintroduce any of them from scratch.

1. **Load** — read the raw source document (Phase 3: Document Loading & Preprocessing).
2. **Chunk** — split the loaded text into smaller pieces using `RecursiveCharacterTextSplitter` (Phase 4: Chunking Strategies).
3. **Embed and store** — convert each chunk into a vector and store it, along with its metadata, in Chroma via the `langchain_chroma` package (Phase 5: Vector Databases - Chroma).
4. **Retrieve** — wrap the populated store as a retriever configured for MMR search (Phase 8: Retrieval Strategies), matching what Lesson 02 of this phase covered.
5. **Rerank** — since LangChain's core chain-building blocks don't include a built-in cross-encoder reranking step, this stage is a small custom function that calls a cross-encoder model directly (Phase 9: Reranking & Query Transformation) and is slotted into the LCEL chain as a plain Python step.
6. **Construct the prompt** — build a prompt template that includes the reranked, formatted context alongside the user's question.
7. **Generate** — call Claude via `ChatAnthropic` (`langchain_anthropic`) to produce the final answer.
8. **Cite sources** — extract the `metadata` (e.g., source filename) from the documents that survived reranking, and print them alongside the generated answer so the user can see exactly which chunks the answer was grounded in.

The two most important integration details to notice as you read the code: retrieval must ask for a wider `k` than you actually want in the final answer, because reranking's whole job (Phase 9) is to *narrow* a wider candidate set down to the best few — if you retrieve exactly as many chunks as you want at the end, there's nothing left for the reranker to filter out. And the reranking step needs to preserve each `Document`'s `metadata` through the reordering, or source citation at the final stage has nothing to point back to.

---

## 4. Code Example: The Full Pipeline

This example assumes the source document, the cross-encoder model, and an `ANTHROPIC_API_KEY` are available in the environment. As in Lesson 02, **the vector store is explicitly populated before it is ever queried** — never assume a collection already has data in it.

```python
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_anthropic import ChatAnthropic
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings  # any Embeddings implementation from Phase 2
from sentence_transformers import CrossEncoder  # cross-encoder reranker from Phase 9

# --- Stage 1: Load ---
# In a real pipeline this comes from Phase 3's loaders (PDF, HTML, etc.);
# here we inline the raw text of one source document for a self-contained example.
raw_text = """
Our refund policy allows returns within 30 days of purchase, provided the
item is unused and in its original packaging. Store credit is issued
immediately; card refunds take 5-7 business days to appear.

International orders are subject to a modified 45-day return window due to
longer shipping times. Customs fees are non-refundable under any circumstance.
"""
source_name = "refund_policy.md"

# --- Stage 2: Chunk (Phase 4) ---
splitter = RecursiveCharacterTextSplitter(chunk_size=200, chunk_overlap=20)
chunks = splitter.create_documents([raw_text], metadatas=[{"source": source_name}])

# --- Stage 3: Embed and store (Phase 5) ---
# .from_documents() populates the store immediately -- never query an
# empty collection.
embeddings = OpenAIEmbeddings()
vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    collection_name="refund_policy",
    persist_directory="./chroma_db",
)

# --- Stage 4: Retrieve with MMR (Phase 8) ---
# fetch_k is wider than the final k we want -- reranking (next stage) needs
# a candidate pool to narrow down, not just the final answer set.
retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 6, "fetch_k": 20, "lambda_mult": 0.5},
)

# --- Stage 5: Rerank with a cross-encoder (Phase 9) ---
# LangChain's LCEL primitives don't include a built-in cross-encoder reranking
# step, so this is a small custom function wrapped as a RunnableLambda and
# slotted directly into the chain like any other Runnable.
cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def rerank(inputs: dict) -> dict:
    question = inputs["question"]
    documents = inputs["documents"]
    if not documents:
        # Empty retrieval must be handled explicitly -- silently continuing
        # with no context produces an ungrounded, potentially hallucinated answer.
        return {"question": question, "top_docs": []}
    pairs = [(question, doc.page_content) for doc in documents]
    scores = cross_encoder.predict(pairs)
    ranked = sorted(zip(scores, documents), key=lambda pair: pair[0], reverse=True)
    top_docs = [doc for _, doc in ranked[:3]]  # narrow the fetch_k=6 candidates to 3
    return {"question": question, "top_docs": top_docs}

rerank_step = RunnableLambda(rerank)

# --- Stage 6: Prompt construction ---
prompt = ChatPromptTemplate.from_template(
    "Answer the question using only the context below. If the context "
    "doesn't contain the answer, say so explicitly rather than guessing.\n\n"
    "Context:\n{context}\n\n"
    "Question: {question}"
)

# --- Stage 7: Generate (Claude via langchain_anthropic) ---
llm = ChatAnthropic(model="claude-opus-4-8")


def build_prompt_input(rerank_output: dict) -> dict:
    context = "\n\n".join(doc.page_content for doc in rerank_output["top_docs"])
    return {"context": context, "question": rerank_output["question"]}


def run_pipeline(question: str) -> None:
    retrieved_docs = retriever.invoke(question)
    reranked = rerank_step.invoke({"question": question, "documents": retrieved_docs})

    if not reranked["top_docs"]:
        print("No relevant information was found for this question.")
        return

    prompt_input = build_prompt_input(reranked)
    formatted_prompt = prompt.invoke(prompt_input)
    response = llm.invoke(formatted_prompt)

    # --- Stage 8: Cite sources from metadata ---
    sources = sorted({doc.metadata.get("source", "unknown") for doc in reranked["top_docs"]})
    print(response.content)
    print(f"\nSources: {', '.join(sources)}")


run_pipeline("How long do I have to return an international order?")
```

Tracing the seams explicitly: `retriever.invoke(question)` returns up to `fetch_k`-influenced, MMR-diversified candidates (Stage 4); `rerank_step.invoke(...)` narrows those down to the top 3 by cross-encoder relevance score (Stage 5) and — critically — passes the original `Document` objects through unchanged, so their `.metadata["source"]` is still available at the very end; `build_prompt_input` and `prompt.invoke(...)` assemble the final prompt (Stage 6); `llm.invoke(...)` generates the answer (Stage 7); and the last block reads `.metadata` off the *reranked* documents — not the original retrieval set — to print accurate citations, since those are the chunks that actually informed the answer.

---

## 5. Where LangChain Doesn't Have a Built-In Step: Reranking

It's worth being explicit about something the code example already demonstrates: LangChain's core LCEL building blocks (retrievers, prompt templates, output parsers) don't include a first-class cross-encoder reranking primitive the way they include a first-class `Retriever` abstraction. Cross-encoder reranking (Phase 9) requires calling a specific model (like `sentence-transformers`' `CrossEncoder`) directly and re-sorting results by score — a step LangChain leaves to you to write, not because it's unsupported, but because it's exactly the kind of specialized logic that doesn't generalize into a single standardized interface the way "search a vector store" does.

The fix, shown in Stage 5 above, is simple and matches the "manual first" spirit of this whole course: write a plain Python function that does the reranking, and wrap it in a `RunnableLambda` (or let LangChain auto-wrap it, per Lesson 01) so it participates in the chain like any other step. This is a useful, generalizable pattern: whenever a stage your project needs doesn't have a built-in LangChain component, a small custom function dropped into the chain is almost always the right answer, rather than searching for an exotic LangChain feature that may not exist.

---

## 6. Common Mistakes

**Mistake 1: Skipping error handling for empty retrieval results.** If the retriever returns zero documents (an empty vector store, an overly narrow filter, or a query that genuinely has no relevant match in the corpus), a pipeline that doesn't check for this will pass an empty context string to the prompt and let the LLM improvise — producing a plausible-sounding but ungrounded answer with no indication anything went wrong. The pipeline in Section 4 checks explicitly (`if not reranked["top_docs"]:`) and reports the failure instead of silently generating from nothing.

**Mistake 2: Not tracing which stage produced a bad answer.** In a nine-line hand-rolled script, a wrong answer is easy to debug — you can print intermediate values at each of the few steps. In a composed pipeline with eight stages, a wrong final answer could originate from a bad chunk boundary (Phase 4), a `k` too small for the reranker to have good candidates (Phase 8), a reranker that scored an irrelevant chunk highly (Phase 9), or a prompt that didn't include the context clearly (this phase). The discipline that avoids hours of confused debugging is the same one shown in Section 4's `run_pipeline` function: keep intermediate values (`retrieved_docs`, `reranked`) as named variables you can inspect, rather than collapsing the entire pipeline into one unreadable chain expression — at least while you're still validating it. This exact problem — knowing *which stage* is responsible for a bad output, systematically rather than by guessing — is precisely what Phase 11 (Evaluation & Observability) is built to solve.

**Mistake 3: Reranking without preserving metadata.** It's tempting to have a reranking function operate on and return plain strings (just the `page_content`) since that's all the cross-encoder scoring needs. But the moment you discard the `Document` object and its `metadata`, source citation at the end of the pipeline becomes impossible — there's no way to know which file a plain string of text came from. Always rerank the `Document` objects themselves (as Section 4's `rerank` function does), scoring on their text but keeping the full object intact.

**Interview angle:** a strong answer to "walk me through how you'd build a production RAG pipeline" doesn't just name the stages — it explains *why* each phase's technique exists (chunking to fit context windows, MMR/reranking to fight redundancy and imprecision, source metadata for citations), and it flags that a real pipeline needs observability (Phase 11) to know which stage broke when an answer is wrong, since a nine-stage system fails in far more places than a single API call.

---

## 7. Hands-On Exercises

### Exercise 1 — Trace a wrong answer to its stage

**Goal:** Practice the "which stage is at fault" debugging discipline from Mistake 2.

Deliberately misconfigure one part of the pipeline from Section 4 — for example, set `chunk_size=20` (far too small, likely splitting sentences awkwardly) or reduce `fetch_k` to `1` (leaving the reranker nothing to narrow down). Run the pipeline and observe the degraded answer. Then add print statements after each stage (`retrieved_docs`, `reranked["top_docs"]`, the formatted prompt) to identify exactly where the degradation was introduced, and explain in your own words how you'd have found it without the print statements.

### Exercise 2 — Add a second source document and verify citations

**Goal:** Confirm the metadata-preservation discipline from Mistake 3 actually works end to end.

Add a second document to the pipeline (a different `page_content`, tagged with a different `source` in its metadata, e.g. `"shipping_policy.md"`) to the same Chroma collection. Ask a question that should retrieve chunks from both documents. Confirm the printed `Sources:` line correctly lists both filenames, and explain what would have gone wrong with citation if the reranking step had operated on plain strings instead of `Document` objects.

### Exercise 3 — Handle the empty-retrieval case explicitly

**Goal:** Verify the empty-retrieval guard from Mistake 1 by triggering it deliberately.

Ask `run_pipeline` a question that is completely unrelated to the source document's content (e.g., "What is the boiling point of mercury?"). Since MMR retrieval and cross-encoder reranking may still return *some* low-relevance chunks rather than zero, add a threshold check to the `rerank` function — discard any candidate whose cross-encoder score falls below a cutoff you choose — so the pipeline reports "no relevant information was found" instead of grounding an answer in irrelevant context. This mirrors a real production safeguard: emptiness isn't just "zero documents returned," it's also "documents returned, but none of them are actually relevant."

---

## 8. Interview Q&A

### Q1. Walk me through a full LangChain RAG pipeline, stage by stage.

**Answer:** Load the source document (Phase 3), split it into chunks with a text splitter such as `RecursiveCharacterTextSplitter` (Phase 4), embed each chunk and store it with its metadata in a vector store like Chroma via `langchain_chroma` (Phase 5), wrap that store as a retriever configured for the desired search strategy — often MMR for diversity (Phase 8) — retrieve a wider candidate set than you ultimately need, rerank that set with a cross-encoder to surface the most relevant few (Phase 9), construct a prompt that includes the reranked context and the original question, and generate the final answer with an LLM such as Claude via `ChatAnthropic`. Citing sources means reading the `metadata` off the specific documents that survived reranking, since those are the ones that actually informed the answer.

---

### Q2. Why do you retrieve more documents than you actually want to end up with in the final prompt?

**Answer:** Because reranking's entire purpose is to narrow a wider candidate pool down to the most relevant few using a more precise (but more expensive) scoring method than the initial retrieval step. If retrieval already returns exactly the final desired count, there's no wider pool for the reranker to filter — reranking degenerates into just re-sorting the same small set, losing most of its value. Retrieval should over-fetch (a larger `k` or `fetch_k`), and reranking should narrow that down.

---

### Q3. Does LangChain provide a built-in component for cross-encoder reranking?

**Answer:** Not as a first-class LCEL primitive the way it provides `Retriever` or `PromptTemplate`. Cross-encoder reranking typically requires calling a specific model directly (e.g. `sentence-transformers`' `CrossEncoder`) and re-sorting results by score, which is written as a small custom function and slotted into the chain — commonly wrapped in a `RunnableLambda` — rather than assembled from an existing LangChain reranking class. This is a normal and expected pattern: whenever a needed stage has no built-in LangChain component, a plain Python function dropped into the chain is the standard solution.

---

### Q4. How do you cite sources in a RAG answer, and what's the most common way that breaks?

**Answer:** Each retrieved chunk carries `metadata` (such as a `source` filename) that was attached when the chunk was created or embedded. After retrieval and any reranking, you read `.metadata` off the *documents that actually survived to inform the final answer* — not the original, wider retrieval set — and surface those source identifiers alongside the generated text. It breaks most commonly when a reranking or formatting step operates on plain text strings instead of the full `Document` object, discarding the metadata needed to trace an answer back to its source.

---

### Q5. A RAG pipeline gives a wrong answer. How do you figure out which stage caused it?

**Answer:** Inspect the pipeline's intermediate outputs stage by stage rather than treating the whole chain as one opaque call: check what the retriever actually returned (was the relevant chunk even retrieved?), check what survived reranking (did the reranker discard the one useful chunk?), check the fully formatted prompt (was the context actually included correctly?), and only then look at the LLM's behavior given that exact prompt. Keeping these as inspectable intermediate values — rather than collapsing everything into a single unreadable chain expression — is essential for this kind of debugging, and is exactly the discipline that Phase 11 (Evaluation & Observability) turns into a systematic, repeatable practice instead of ad hoc guessing.

---

> 🧠 **Memory hook:** "Retrieve wide, rerank narrow, cite from what survived — and when a stage has no LangChain component, a small function on the conveyor belt is the answer, not a missing feature."
