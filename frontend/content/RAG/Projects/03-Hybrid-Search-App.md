# Project 3: Hybrid Search App

## Goal

Go beyond plain vector similarity by combining keyword search (BM25) with vector search into a single hybrid retriever, add a reranking pass for precision, and back the whole thing with `pgvector` instead of a dedicated vector database.

## What You'll Build

A search application over a document set of your choice where retrieval combines BM25 keyword matching and vector similarity search (fused with reciprocal rank fusion), followed by a cross-encoder reranking pass — all reading from and writing to a PostgreSQL database with the `pgvector` extension.

## Phases Required

- Phase 7 — Vector Databases III (pgvector)
- Phase 8 — Retrieval Strategies
- Phase 9 — Reranking & Query Transformation

## Requirements

- Install the `pgvector` extension in PostgreSQL, create a table with a `vector` column plus normal relational columns (id, text, source, etc.), and store chunk embeddings there.
- Implement a BM25 keyword search over the same chunk text (in Python, or via a Postgres full-text search index — either is acceptable as long as it's genuine keyword/lexical scoring, not vector similarity).
- Implement a vector similarity query against the `pgvector` column using `<->` or `<=>`.
- Combine the two ranked lists using reciprocal rank fusion (RRF) to produce a single hybrid-ranked shortlist.
- Add a cross-encoder reranking pass that re-scores the hybrid shortlist before it's sent to the LLM, and confirm the final order differs from the raw hybrid order on at least one example query.
- Demonstrate at least one query where pure vector search would have missed the right chunk (e.g. an exact code/product-name match) and show hybrid search catching it.
- Write at least one SQL query that combines a relational `WHERE` filter with the vector `ORDER BY` similarity search in a single statement, and confirm with `EXPLAIN` that the relational filter is applied efficiently.

## Suggested Approach

1. Set up PostgreSQL locally (or a free-tier hosted instance) with the `pgvector` extension enabled, and create a table with columns for id, chunk text, embedding (`vector` type), and a few relational metadata fields (e.g. category, date).
2. Ingest a document set (reuse Project 1 or 2's chunks if convenient) and insert rows with both the embedding and the relational metadata populated.
3. Implement BM25 scoring over the chunk text — either with a small Python BM25 library or Postgres's built-in full-text search (`tsvector`/`tsquery`) if you want to stay entirely in SQL.
4. Implement a vector similarity query using `<=>` (cosine distance) against the same table.
5. Write a fusion function that takes both ranked lists and combines them via reciprocal rank fusion, producing one merged ranking.
6. Load a `sentence-transformers` `CrossEncoder` and re-score the top N hybrid results, re-sorting by the cross-encoder's scores before handing the final shortlist to the LLM.
7. Construct at least one example query that includes a relational condition (e.g. "only from category X") combined with the vector similarity ordering in one SQL statement, and run `EXPLAIN` on it to confirm the filter isn't scanning the whole table unnecessarily.
8. Pick or construct a query designed to be a keyword-match case (an exact term, code snippet, or product ID) and show that hybrid retrieval surfaces it even when pure vector similarity ranks it low.

## Stretch Goals

- Add an IVFFlat or HNSW index on the `vector` column and compare query latency/`EXPLAIN` output before and after indexing.
- Make the RRF fusion weight configurable (favor keyword vs. vector) and experiment with the effect on your test queries.
- Add MMR (Maximal Marginal Relevance) as an alternative to reranking and compare how it changes the result set's diversity vs. the cross-encoder's precision-focused reordering.

## Evaluation Checklist

- [ ] `pgvector` table stores both embeddings and relational metadata, and both column types are queryable.
- [ ] BM25 and vector search each independently return a ranked list.
- [ ] Reciprocal rank fusion produces one merged list that isn't identical to either input list.
- [ ] Cross-encoder reranking measurably changes the order of the top results on at least one query.
- [ ] A relational + vector combined SQL query returns correct results, and `EXPLAIN` confirms the relational filter is applied efficiently (not a full unfiltered vector scan followed by manual filtering).
- [ ] You can point to a specific query where hybrid search beat pure vector search, and explain why.
