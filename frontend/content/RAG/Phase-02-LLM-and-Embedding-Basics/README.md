# Phase 2: LLM & Embedding Basics for RAG

## Overview

Phase 1 mentioned embeddings and the LLM call in passing — "documents get converted into a vector," "the LLM generates its answer as normal" — and waved at "more in Phase 2" every time. This phase makes good on that promise. Before you touch a vector database (Phase 5) or build a chunking strategy (Phase 3), you need to understand the two pieces of machinery that make RAG possible at all: **embeddings**, which turn text into comparable numbers, and **the LLM's own limits**, which shape every decision about how much context you can hand it and what that context costs. Everything from "how big should my chunks be" to "why did retrieval return the wrong document" traces back to the concepts in this phase.

## Learning Objectives

By the end of Phase 2, you will be able to:

- Explain what a text embedding actually is, and describe the flow from raw text to a fixed-length vector
- Call an embedding API, inspect the resulting vectors, and reason about which embedding model to pick for a given use case
- Compute and explain cosine similarity, dot product, and Euclidean distance by hand on a small example, and know when to reach for each
- Explain why tokenization exists, estimate a token count for a piece of text, and reason about what actually consumes a model's context window
- Avoid the most common Phase-2-level mistakes: mismatched embedding models, un-normalized vectors, and miscounting what fills up the context window
- Confidently answer foundational embeddings/tokenization interview questions with concrete, worked examples

## Estimated Study Time

| File | Topic | Est. Time |
|------|-------|-----------|
| 01-What-is-an-Embedding.md | What embeddings are, how text becomes a vector, comparing embedding models | 2-3 hours |
| 02-Vector-Similarity-and-Distance-Metrics.md | Cosine similarity, dot product, Euclidean distance — worked examples and code | 2-3 hours |
| 03-Tokenization-and-Context-Windows.md | Tokens, context windows, and what actually counts against them in a RAG pipeline | 2-3 hours |

**Total: 6-9 hours of focused study**

---

## File Index

### 01 - What is an Embedding
`/Phase-02-LLM-and-Embedding-Basics/01-What-is-an-Embedding.md`

Starts from the problem that computers cannot compare the *meaning* of two strings directly — "dog" and "puppy" are just different byte sequences. Introduces embeddings using a GPS-coordinates-for-meaning analogy, walks through the text-to-vector pipeline with a real (truncated) example vector, shows a Python embedding-API call, and compares a few embedding model families.

Key topics:
- Why exact string comparison can't capture meaning
- The GPS-coordinates analogy for embeddings
- Text → embedding model → fixed-length vector, illustrated
- Calling an embedding API and reading the output
- Comparing embedding model families (dimensions, use case, open vs API-based)

---

### 02 - Vector Similarity and Distance Metrics
`/Phase-02-LLM-and-Embedding-Basics/02-Vector-Similarity-and-Distance-Metrics.md`

Once text is a vector, how do you measure "closeness"? This lesson builds cosine similarity, dot product, and Euclidean distance from first principles, with a tiny hand-worked 2D example for each, then shows the plain-Python and numpy implementations.

Key topics:
- The "direction of the arrow, not its length" analogy for cosine similarity
- Worked arithmetic: cosine similarity, dot product, Euclidean distance on 2D vectors
- Plain Python and numpy implementations
- When each metric is preferred, and normalization requirements

---

### 03 - Tokenization and Context Windows
`/Phase-02-LLM-and-Embedding-Basics/03-Tokenization-and-Context-Windows.md`

LLMs don't read raw characters, and every model has a hard ceiling on how much it can read and write in one call. This lesson explains subword tokenization at a practical level, shows how to estimate a token count, and — critically for RAG — explains what actually consumes the context window once you add a prompt template, retrieved chunks, and a question together.

Key topics:
- The "translator who reads in fixed-size chunks" analogy
- Text → tokens → why token count drives chunking and cost decisions
- Estimating token counts in code
- Typical context window tiers (small/medium/large), described qualitatively
- Why the raw document is not what fills the context window — the prompt template and retrieved context do too

---

## How to Study This Phase

1. Read each file once for understanding, without trying to memorize formulas.
2. Actually run the code examples — type out the plain-Python cosine similarity function yourself before looking at the numpy version.
3. Do the hands-on exercises; several build the exact intuition you'll need once Phase 5 introduces a real vector database.
4. Review the Interview Q&A section and answer each question out loud before checking it against the written answer.
5. Before moving to Phase 3, make sure you can explain — without notes — why an embedding model used for indexing must be the same one used for querying.

## Prerequisites

Phase 1 (RAG Fundamentals) completed, or an equivalent working understanding of the four-stage RAG flow. Comfort with Python, basic vectors/arrays, and a little bit of arithmetic (dot products, square roots) — no prior ML background required.

## What Comes Next

After completing Phase 2, proceed to:
- **Phase 3: Document Processing & Chunking** — how to split real documents into the chunks that get embedded and indexed

---

> "A vector is just an opinion about meaning, written in numbers." — Phase 2 in one sentence.
