# Phase 9: Reranking & Query Transformation

## Overview

Phase 8 got you a fast, broad retriever — vector search, hybrid search, metadata filtering — that can pull a shortlist of candidate chunks out of a huge corpus in milliseconds. But "fast and broad" and "precisely ordered by true relevance" are different properties, and the gap between them is exactly what this phase closes. Phase 9 covers two complementary fixes: **reranking**, which re-scores an already-retrieved shortlist with a slower, more accurate model before it ever reaches the LLM, and **query transformation**, which improves what gets searched for in the first place — either by rewriting the query into something that embeds better (HyDE) or by asking the same question multiple ways and merging the results (query expansion / multi-query retrieval). Together these techniques squeeze meaningfully more accuracy out of a retrieval pipeline without touching the underlying vector store or LLM at all.

## Learning Objectives

By the end of Phase 9, you will be able to:

- Explain why a fast approximate retriever's top-k results aren't perfectly ordered by relevance, and how a cross-encoder reranker fixes that as a second pass
- Distinguish bi-encoders from cross-encoders — what each computes, why one is fast and the other is accurate, and why you only ever run a cross-encoder over a small shortlist
- Explain the HyDE technique: generating a hypothetical answer with an LLM and embedding that instead of the raw query
- Implement query expansion / multi-query retrieval, merging multiple retrieval passes with reciprocal rank fusion (reused from Phase 8)
- Identify the common performance and correctness mistakes in reranking and query transformation (reranking the whole corpus, trusting a hallucinated hypothetical's facts, over-generating query variants)
- Choose the right technique (or combination) for a given retrieval-quality problem in a system design interview

## Estimated Study Time

| File | Topic | Est. Time |
|------|-------|-----------|
| 01-Cross-Encoder-Reranking.md | Bi-encoder vs cross-encoder, reranking a shortlist for precision | 2-3 hours |
| 02-HyDE-Hypothetical-Document-Embeddings.md | Generating and embedding a hypothetical answer instead of the raw query | 2 hours |
| 03-Query-Expansion-and-Multi-Query-Retrieval.md | Rewriting a query multiple ways and fusing the results | 2-3 hours |

**Total: 6-8 hours of focused study**

---

## File Index

### 01 - Cross-Encoder Reranking
`/Phase-09-Reranking-and-Query-Transformation/01-Cross-Encoder-Reranking.md`

Covers why the fast vector search that scores millions of chunks only approximates true relevance ordering, and how a second-pass cross-encoder reranker fixes that over a small shortlist.

Key topics:
- Bi-encoder vs cross-encoder: separate embeddings vs joint query+doc scoring
- Two-stage retrieval: fast recall, then slow-but-accurate precision
- `sentence-transformers` `CrossEncoder` in practice
- Why you never run a cross-encoder over the full corpus

---

### 02 - HyDE (Hypothetical Document Embeddings)
`/Phase-09-Reranking-and-Query-Transformation/02-HyDE-Hypothetical-Document-Embeddings.md`

Covers the mismatch between short queries and long documents in embedding space, and how HyDE closes that gap by embedding a generated hypothetical answer instead of the raw query.

Key topics:
- Why short queries embed differently than the long documents they're trying to match
- Generating a hypothetical answer with an LLM, then embedding that instead of the query
- HyDE swaps the query embedding, it doesn't combine two embeddings
- When HyDE helps and when it's wasted latency

---

### 03 - Query Expansion and Multi-Query Retrieval
`/Phase-09-Reranking-and-Query-Transformation/03-Query-Expansion-and-Multi-Query-Retrieval.md`

Covers generating multiple reworded versions of a query, retrieving for each, and merging the results with reciprocal rank fusion.

Key topics:
- Why a single phrasing of a query can miss relevant documents that use different wording
- Using an LLM to generate multiple query variants
- Merging multi-query results with RRF (reused from Phase 8)
- Cost/latency trade-offs of generating too many variants

---

## How to Study This Phase

1. Read each file once for understanding without memorizing.
2. After each section, close the file and explain the concept out loud in your own words (Feynman technique).
3. Do the hands-on exercises at the end of each file.
4. Review the Interview Q&A section and answer each question out loud before checking it against the written answer.
5. Come back after a day or two and re-explain, from memory, when you'd reach for reranking vs HyDE vs multi-query.

## Prerequisites

Phase 8 (Retrieval Strategies) — you should be comfortable with vector search, hybrid search (BM25 + RRF), and the general shape of a `retrieve(query) -> chunks` call before layering these refinements on top.

## What Comes Next

After completing Phase 9, proceed to:
- **Phase 10: RAG Orchestration - LangChain** — wiring the full pipeline, including these retrieval refinements, together with a framework

---

> "Retrieval gets you a shortlist fast; reranking and query transformation are how you make sure the *right* items are actually on it, and near the top." — Phase 9 in one sentence.
