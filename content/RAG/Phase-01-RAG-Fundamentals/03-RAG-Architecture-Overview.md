# 03 — RAG Architecture Overview

> A comprehensive reference walking through every moving part of a full RAG pipeline, from raw documents to a generated answer, and mapping each stage to where it's covered in depth later in this course.

---

## Table of Contents

1. [The Problem: Too Many Moving Parts, No Map](#1-the-problem-too-many-moving-parts-no-map)
2. [The Analogy: Librarian, Card Catalog, and Reference Desk](#2-the-analogy-librarian-card-catalog-and-reference-desk)
3. [Internal Flow: The Full Pipeline, Stage by Stage](#3-internal-flow-the-full-pipeline-stage-by-stage)
4. [A Bare-Bones Preview Implementation](#4-a-bare-bones-preview-implementation)
5. [Architecture Stage → Course Phase Mapping](#5-architecture-stage--course-phase-mapping)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Too Many Moving Parts, No Map

Lessons 1 and 2 gave you the *what* (RAG retrieves then generates) and the *why* (RAG vs. alternatives). But if you tried to actually build a RAG system right now, you'd immediately hit a wall: "indexing" and "retrieval" are each hiding several distinct sub-steps, and it's easy to lose track of which piece is responsible for which failure when something goes wrong.

This lesson exists to give you the map *before* you start building any individual piece. Every phase after this one in the course — chunking, embeddings, vector databases, retrieval strategies, reranking, orchestration, evaluation — is really "zoom in on one box in this diagram and implement it for real." If you know the full map now, nothing in later phases will feel like it came out of nowhere.

---

## 2. The Analogy: Librarian, Card Catalog, and Reference Desk

**Real-world analogy:** picture a large public library, and three things that have to work together for a visitor to get a good answer to a question.

- **The card catalog (the vector store + embeddings).** Every book in the library has been summarized and cross-referenced by subject, so you don't have to read every book cover to cover to know roughly what's in it. This cataloging work happens once, when a book arrives — not every time someone asks a question.

- **The reference desk librarian (the retrieval + query logic).** When a visitor asks a question, the librarian doesn't hand them the whole library. They translate the question into "what subject headings should I look under," check the card catalog, and pull the two or three books most likely to actually answer the question.

- **The visitor reading the pulled books and writing an answer (the LLM generation step).** With the right two or three books in hand — instead of the entire library, and instead of nothing — the visitor (or, in our system, the LLM) can now write an accurate, well-supported answer.

Notice the parallel structure to what you already learned in Lesson 1: cataloging happens once and ahead of time (indexing); the librarian's lookup and the visitor's reading happen fresh for every single question (retrieve → augment → generate). The architecture overview in this lesson is really this same three-part picture, just broken into finer-grained pieces so you can see every sub-step inside "cataloging" and "looking things up."

---

## 3. Internal Flow: The Full Pipeline, Stage by Stage

Here is the complete pipeline, end to end, with every sub-step named. The top row (document ingestion through vector store) happens once, or whenever documents change. The bottom row (query embedding through response) happens on every single user question.

```
┌─────────────────────────── ONE-TIME: INDEXING PIPELINE ───────────────────────────┐
│                                                                                     │
│  Document        Chunking          Embedding          Vector Store                │
│  Ingestion   ──▶  (split docs  ──▶ (convert text  ──▶ (store vectors +            │
│  (load PDFs,      into small        chunks into        original text for          │
│  wiki pages,      overlapping       numeric vectors     later lookup)              │
│  tickets, etc.)   pieces)           that capture                                   │
│                                     meaning)                                        │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    │  (index is now built and ready)
                                                    ▼
┌─────────────────────────── EVERY QUERY: RETRIEVAL + GENERATION ───────────────────┐
│                                                                                     │
│  User Query      Query               Similarity        Context                    │
│  ("Can I get ──▶  Embedding    ──▶    Search        ──▶ Assembly                   │
│   a refund?")    (convert the        (find the top-K     (gather retrieved         │
│                   query into the     most similar         chunks + user            │
│                   same vector        vectors in the       question into            │
│                   space as chunks)   vector store)        one bundle)              │
│                                                                    │                │
│                                                                    ▼                │
│                                              Prompt              LLM              Response │
│                                              Construction  ──▶   Generation  ──▶  (final    │
│                                              (build the         (model reads       answer   │
│                                              final prompt        the augmented     to the    │
│                                              from a template)    prompt and        user)     │
│                                                                   answers)                    │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Walking through each box in order, with a one-line reason it exists:

1. **Document ingestion** — get raw source material (PDFs, HTML, wiki exports, support tickets, code, whatever) loaded into a format your pipeline can work with. Nothing fancy happens here yet; it's plumbing.
2. **Chunking** — split large documents into smaller, focused pieces. Why: embeddings and LLM context windows both work better on a small, coherent unit of text than on an entire 400-page manual at once.
3. **Embedding** — convert each chunk into a vector (a list of numbers) that captures its *meaning*, not just its literal words. Why: this is what lets retrieval match a question to a document even when they don't share exact vocabulary (recall Lesson 1's refund example).
4. **Vector store** — persist those vectors (plus the original chunk text) somewhere that supports fast similarity search over potentially millions of chunks. Why: you need to find "the closest few vectors" quickly, not by scanning every chunk one at a time.
5. **Query embedding** — convert the user's live question into a vector using the *same* embedding process as the chunks, so the two are comparable.
6. **Similarity search** — ask the vector store: "which stored chunks are closest, in meaning, to this query vector?" Why: this is the actual "retrieval" step — it's the mechanism, not just the concept.
7. **Context assembly** — gather the top retrieved chunks together, deduplicate or trim if needed, and pair them with the original user question.
8. **Prompt construction** — insert the assembled context and question into a prompt template that instructs the model how to use that context (e.g., "answer using only the context below").
9. **LLM generation** — send the constructed prompt to the LLM and let it produce the answer.
10. **Response** — return that answer to the user (optionally with citations back to the source chunks).

**Internal working — why the failure points matter:** each arrow between these boxes is a place where things can silently go wrong. A chunk boundary that splits a sentence mid-thought produces a chunk with no coherent meaning to embed. A similarity search that returns the top-3 "closest" chunks might return three chunks that are all *topically* similar but none of which actually answers the specific question. A prompt template with a badly worded instruction might cause the model to ignore the retrieved context entirely and answer from its own memorized (and possibly wrong) knowledge instead. Treating RAG as a single black-box step — rather than a ten-step pipeline with independent failure points — is exactly the mistake covered in Section 6.

---

## 4. A Bare-Bones Preview Implementation

This is intentionally **pseudocode-ish, illustrative Python** — the point is to see the *shape* of the ten-step flow as real function calls, not to run production code. Every one of these functions gets a real implementation starting in Phase 2 (embeddings), Phase 3-4 (loading and chunking), and Phase 5+ (real vector stores and retrieval). The one piece that already looks close to "real" is the final LLM call, since that's a genuine Claude API call you'll actually use later in this course.

```python
"""
Bare-bones conceptual RAG loop -- focused on retrieve -> augment -> generate.
Assume `vector_store` is already built (a list of {"text": ..., "vector": ...}
entries) -- Phases 2-7 cover chunking, embedding, and real vector stores for real.
"""

import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment

def embed_text(text: str) -> list[float]:
    """Placeholder. Real embedding models arrive in Phase 2."""
    raise NotImplementedError

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Placeholder. Real vector similarity search arrives in Phase 5+."""
    raise NotImplementedError

def retrieve(query: str, top_k: int = 2) -> list[str]:
    query_vector = embed_text(query)
    # List comprehension: builds a (score, text) pair for every stored chunk in one line.
    scored = [(cosine_similarity(query_vector, entry["vector"]), entry["text"])
              for entry in vector_store]
    # `key=lambda pair: pair[0]` sorts by the score (first item of each pair);
    # reverse=True puts the highest similarity first.
    scored.sort(key=lambda pair: pair[0], reverse=True)
    # `_` is a throwaway name for the score, since only the text is needed here.
    return [text for _, text in scored[:top_k]]

def build_prompt(query: str, retrieved_chunks: list[str]) -> str:
    context = "\n\n".join(retrieved_chunks)
    return (
        "Answer the question using only the context below. "
        "If the context doesn't contain the answer, say so.\n\n"
        f"Context:\n{context}\n\nQuestion: {query}"
    )

def generate(prompt: str) -> str:
    """This part is a real Claude API call -- everything above it is the
    conceptual pipeline we'll build for real in later phases."""
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text

def answer_question(query: str) -> str:
    retrieved_chunks = retrieve(query)
    prompt = build_prompt(query, retrieved_chunks)
    return generate(prompt)

# answer_question("Can I get a refund if I bought this two weeks ago?")
```

Notice the shape: `retrieve()`, `build_prompt()`, and `generate()` are literally the retrieve → augment → generate stages from Lesson 1, now written as three distinct function calls instead of one vague idea. `embed_text()` and `cosine_similarity()` are the two placeholders standing in for work you'll do for real starting next phase — everything about *how* embeddings and similarity search work is deliberately deferred so this lesson stays focused on the shape of the whole pipeline, not the internals of any one piece.

---

## 5. Architecture Stage → Course Phase Mapping

Use this table as your map for the rest of the course — whenever you're deep in one phase and start wondering "how does this connect to the bigger picture," come back to this row.

| Architecture Stage | Covered In Depth | Phase Topic |
|---|---|---|
| 1. Document ingestion | Phase 3 | Document Loading & Preprocessing |
| 2. Chunking | Phase 4 | Chunking Strategies |
| 3. Embedding (text → vector) | Phase 2 | LLM & Embedding Basics |
| 4. Vector store (storage + indexing) | Phases 5-7 | Vector Databases — Chroma, Pinecone, pgvector |
| 5. Query embedding | Phase 2 | LLM & Embedding Basics |
| 6. Similarity search | Phase 8 | Retrieval Strategies |
| 7. Context assembly | Phase 9 | Reranking & Query Transformation |
| 8. Prompt construction | Phase 10 | RAG Orchestration with LangChain |
| 9. LLM generation | Phase 1 / Phase 10 | RAG Fundamentals (this lesson's basic Claude call) / RAG Orchestration with LangChain |
| 10. Response | Phase 10 / Phase 11 | RAG Orchestration with LangChain (returning the final answer) / Evaluation & Observability (measuring response quality) |
| *Supplementary:* precision-focused retrieval refinement | Phase 9 | Reranking & Query Transformation |
| *Supplementary:* measuring whether any of this actually works | Phase 11 | Evaluation & Observability |
| *Supplementary:* LLM generation with tool use / multi-step reasoning | Phase 12 | Agentic RAG |
| *Supplementary:* beyond plain text (graphs, images, tables) | Phase 13 | GraphRAG & Multimodal RAG |
| *Supplementary:* making the whole pipeline production-ready | Phase 14 | Production Patterns & Scaling |

For reference, here is the full 14-phase course this table draws from:

1. RAG Fundamentals (this phase) — 2. LLM & Embedding Basics — 3. Document Loading & Preprocessing — 4. Chunking Strategies — 5. Vector Databases: Chroma — 6. Vector Databases: Pinecone — 7. Vector Databases: pgvector — 8. Retrieval Strategies — 9. Reranking & Query Transformation — 10. RAG Orchestration with LangChain — 11. Evaluation & Observability — 12. Agentic RAG — 13. GraphRAG & Multimodal RAG — 14. Production Patterns & Scaling.

---

## 6. Common Mistakes

- **Treating RAG as a single step instead of a ten-step pipeline.** The most common beginner mistake in this whole course is saying "I built RAG" after wiring together a vector store and an LLM call, then being surprised when answers are wrong — without realizing there are independent failure points at chunking, embedding, retrieval, and prompt construction, any one of which can quietly break the whole system while the others work fine.

- **Debugging generation when the bug is actually in retrieval.** If the final answer is wrong, the instinct is often to blame the LLM or tweak the prompt. But if the retrieved chunks were wrong (or empty) to begin with, no amount of prompt tweaking fixes it — always check *what was actually retrieved* before touching the generation step. This diagnostic instinct — "is this a retrieval problem or a generation problem?" — is one of the most valuable habits you can build in this entire course.

- **Assuming the one-time indexing pipeline is truly "one-time."** In real systems, documents change, get added, and get deleted. Skipping a plan for *re-indexing* means your RAG system quietly serves stale answers forever, which defeats one of RAG's biggest advantages over fine-tuning (freshness) covered in Lesson 2.

- **Skipping evaluation because "it looks like it's working."** A RAG pipeline can look correct on a handful of manually-tried questions and still fail badly at scale, on edge cases, or on questions phrased differently than you tested. Phase 11 exists precisely because "it looks fine" and "it's measurably correct" are very different claims.

**Interview angle:** A strong systems-design signal in a RAG interview is being asked "the system gives a wrong answer — how do you debug it?" and responding by walking the pipeline stage by stage (was the right document even indexed? was it chunked sensibly? did retrieval actually surface it? did the prompt include it correctly? did the model use it correctly?) rather than jumping straight to "I'd tweak the prompt." That stage-by-stage instinct is exactly what this lesson is meant to build.

---

## 7. Hands-On Exercises

### Exercise 1 — Trace a failure to its stage

**Goal:** Practice the "which stage broke" diagnostic instinct from Section 6.

For each symptom below, write down which pipeline stage (from Section 3) is the *most likely* culprit, and why:

1. The system returns an answer that contradicts a document you know is in the knowledge base.
2. The system says "I don't have information about that" even though the relevant document was definitely uploaded.
3. Two very differently-worded questions that mean the same thing get completely different (and only one correct) answer.
4. The system was working fine last month but now gives outdated answers about a policy that changed two weeks ago.

```python
diagnoses = {
    1: "Likely retrieval or context assembly -- wrong/irrelevant chunk retrieved, or generation ignoring correct context",
    2: "Likely chunking or embedding -- document may not have been indexed, or chunk boundaries buried the relevant sentence",
    3: "Likely embedding/retrieval quality -- semantically equivalent queries should retrieve similarly; a mismatch suggests weak embeddings or retrieval tuning",
    4: "Likely a missing re-indexing pipeline -- the document store wasn't updated when the policy changed",
}
for k, v in diagnoses.items():
    print(f"{k}: {v}")
```

### Exercise 2 — Draw your own pipeline diagram from memory

**Goal:** Cement the ten-stage flow without looking at Section 3.

Close this file. On paper or in a text file, write out all ten stages of the pipeline in order, in your own words, along with a one-sentence reason each stage exists. Then reopen Section 3 and compare — which stages did you forget, and were they the ones you're least confident about? That's a signal for where to focus extra attention in upcoming phases.

### Exercise 3 — Extend the preview implementation

**Goal:** Get comfortable with the shape of the pipeline code before real implementations arrive.

Using the code in Section 4 as a starting point, write a new function `answer_with_sources(query: str) -> dict` that returns both the generated answer *and* the list of retrieved chunk texts that were used to produce it (so a UI could later show "sources" alongside the answer). You don't need to make `embed_text()` or `cosine_similarity()` actually work yet — just wire up the function signature and confirm it would compile and return the right *shape* of data once those two pieces are implemented for real in later phases.

---

## 8. Interview Q&A

### Q1. What are the main stages of a RAG pipeline, and which happen once versus every query?

**Answer:** Indexing — document ingestion, chunking, embedding, and storing vectors — happens once (or whenever the document set changes), not per query. Everything from query embedding onward — similarity search, context assembly, prompt construction, and LLM generation — happens fresh for every single user question. This asymmetry is central to why RAG scales: the expensive document-processing work isn't repeated on every query.

---

### Q2. If a RAG system gives a wrong answer, how would you go about debugging it?

**Answer:** I'd walk the pipeline stage by stage rather than immediately assuming the LLM is at fault: first check whether the relevant document was actually indexed at all, then whether it was chunked in a way that kept the relevant information intact, then whether retrieval actually surfaced that chunk for this specific query (this is where I'd look first, since retrieval failures are the most common root cause), then whether the prompt template correctly included the retrieved context, and only then would I look at whether the model used correctly-provided context incorrectly.

---

### Q3. Why is chunking necessary — why not just embed entire documents?

**Answer:** Embedding an entire large document tends to produce a vector that's a vague average of everything in the document, which makes it hard to precisely match a specific, narrow question. Chunking breaks documents into smaller, more topically coherent pieces so that a similarity search can find the specific passage relevant to a question, rather than a whole document that's only partially relevant. (The details of how to chunk well are the entire subject of Phase 4.)

---

### Q4. What's the difference between the vector store and the retrieval step?

**Answer:** The vector store is the storage and indexing system that holds embedded chunks and supports efficient similarity search over them — it's a component. Retrieval is the process of using that vector store at query time: embedding the incoming question and asking the store for the most similar stored chunks. The vector store is the "card catalog"; retrieval is the "librarian using the catalog to answer a specific question."

---

### Q5. Why does re-indexing matter, and what happens if a RAG system doesn't have a plan for it?

**Answer:** Documents change — policies get updated, new content gets added, old content becomes obsolete. If there's no process to re-run chunking and embedding when the underlying documents change, the vector store quietly goes stale, and the system keeps confidently returning outdated answers even though the whole point of choosing RAG (over, say, fine-tuning) was to get fresh, easily-updatable knowledge. A production RAG system needs an explicit re-indexing strategy, not just a one-time initial index.

---

> 🧠 **Memory hook:** "RAG isn't one machine — it's a librarian's whole workflow: catalog it once, look it up every time, and any single step in that chain can be the reason an answer is wrong."
