# Phase 8: Retrieval Strategies

## Overview

Up to this point, "retrieval" has meant one thing: embed the query, do a top-k similarity search, and hand the results to the LLM. That works, but it's the crudest possible retrieval strategy — and it breaks down in predictable ways. Pick `k` too small and you miss context split across chunks; pick it too large and you drown the model in noise (and pay for it in tokens). Pure vector similarity misses exact keyword and code matches a human would never miss. And top-k alone happily returns five near-duplicate chunks that all say the same thing, wasting the context budget you fought so hard to earn in Phase 4.

This phase is about upgrading from "just do similarity search" to a toolbox of retrieval strategies: tuning k with an understanding of the "lost in the middle" effect, combining keyword search (BM25) with vector search via hybrid retrieval, and using Maximal Marginal Relevance (MMR) plus metadata filtering to make the retrieved set both relevant and diverse. These are the levers you reach for once you notice your RAG system's answers are technically-grounded-but-still-wrong — the fix is almost always in retrieval, not generation.

## Learning Objectives

By the end of Phase 8, you will be able to:

- Explain the tradeoffs of increasing or decreasing `k` in top-k similarity search, including the "lost in the middle" phenomenon
- Combine BM25 keyword search with vector similarity search using reciprocal rank fusion to build a hybrid retriever
- Articulate when pure vector search, pure keyword search, or a hybrid approach wins, with concrete examples
- Explain and implement Maximal Marginal Relevance (MMR) to reduce redundancy in retrieved results
- Decide whether to filter-then-rank or rank-then-filter when combining metadata filtering with a retrieval strategy
- Confidently answer interview questions about retrieval strategy selection and tuning

## Estimated Study Time

| File | Topic | Est. Time |
|------|-------|-----------|
| 01-Similarity-Search-and-Top-K-Tuning.md | Top-k tradeoffs, "lost in the middle," tuning k in practice | 2-3 hours |
| 02-Hybrid-Search-BM25-and-Vectors.md | BM25 keyword search, reciprocal rank fusion, hybrid retrieval | 3-4 hours |
| 03-MMR-and-Metadata-Filtering.md | Maximal Marginal Relevance, diversity vs. relevance, filter-then-rank vs. rank-then-filter | 3-4 hours |

**Total: 8-11 hours of focused study**

---

## File Index

### 01 - Similarity Search and Top-K Tuning
`/Phase-08-Retrieval-Strategies/01-Similarity-Search-and-Top-K-Tuning.md`

Revisits top-k similarity search and asks the question every RAG builder eventually hits: how many chunks should you actually retrieve? Covers the tradeoffs of small vs. large k, the "lost in the middle" phenomenon, and how to tune k empirically instead of guessing.

Key topics:
- Too few chunks miss context; too many chunks add noise and cost
- The "research assistant bringing the 5 most relevant pages" analogy
- "Lost in the middle": why LLMs pay less attention to context buried mid-prompt
- Querying a vector store with varying k and comparing relevance scores

---

### 02 - Hybrid Search: BM25 and Vectors
`/Phase-08-Retrieval-Strategies/02-Hybrid-Search-BM25-and-Vectors.md`

Pure vector search is bad at exact matches — SKUs, error codes, acronyms. This lesson introduces BM25 as classic keyword-frequency search and shows how to combine it with vector similarity using reciprocal rank fusion to get the best of both.

Key topics:
- Why vector search alone misses exact keyword/code matches
- BM25 as a term-frequency ranking function (not embedding-based)
- Reciprocal rank fusion to combine two ranked lists
- Comparison: pure vector vs. pure keyword vs. hybrid

---

### 03 - MMR and Metadata Filtering
`/Phase-08-Retrieval-Strategies/03-MMR-and-Metadata-Filtering.md`

Top-k similarity search can return five near-duplicate chunks that all say the same thing. This lesson introduces Maximal Marginal Relevance (MMR) to balance relevance against diversity, and revisits metadata filtering from Phases 6-7 in the context of choosing a retrieval strategy.

Key topics:
- MMR: balancing relevance to the query against diversity from already-selected chunks
- The lambda tradeoff parameter
- A simplified MMR re-selection function
- Filter-then-rank vs. rank-then-filter

---

## How to Study This Phase

1. Read each file once for understanding without memorizing.
2. After each section, close the file and explain the concept out loud in your own words (Feynman technique).
3. Do the hands-on exercises at the end of each file — they only require Python (and `rank_bm25` for lesson 2).
4. Review the Interview Q&A section and answer each question out loud before checking it against the written answer.
5. Come back after a day or two and re-derive the MMR formula and the reciprocal rank fusion formula from memory.

## Prerequisites

Phases 1-7 (RAG fundamentals through pgvector). You should already be comfortable with embeddings, chunking, and running similarity search against a vector store.

## What Comes Next

After completing Phase 8, proceed to:
- **Phase 9: Reranking & Query Transformation** — using a second-pass model to re-score retrieved chunks, and rewriting queries before they ever hit the retriever

---

> "Retrieval isn't a single knob. It's k, it's keyword vs. meaning, it's relevance vs. diversity — and getting all three right is most of what makes RAG good." — Phase 8 in one sentence.
