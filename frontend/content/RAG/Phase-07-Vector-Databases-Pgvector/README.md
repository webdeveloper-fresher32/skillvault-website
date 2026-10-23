# Phase 7: Vector Databases III — pgvector

## Overview

The previous two phases covered Chroma (a lightweight, developer-friendly vector store) and Pinecone (a fully managed cloud vector database). This phase covers a third, very different path: adding vector search to a database you may already be running — PostgreSQL — via the `pgvector` extension. For teams that already operate Postgres for their application data, pgvector means no new database to provision, back up, or monitor, and it means vector similarity search can sit right next to ordinary relational filters in a single SQL query. This phase builds the mental model for when that trade-off makes sense, how to combine relational and vector queries in one statement, and how indexing (IVFFlat and HNSW) keeps that combined query fast at scale.

## Learning Objectives

By the end of Phase 7, you will be able to:

- Explain why a team already running PostgreSQL might choose pgvector over a dedicated vector database, and articulate the trade-offs
- Install the `pgvector` extension, create a table with a `vector` column, insert embeddings, and query by similarity using `<->` and `<=>`
- Write a single SQL query that combines a relational `WHERE` filter with a vector `ORDER BY` similarity search
- Use `EXPLAIN` to verify that a query's relational filter is actually being applied efficiently
- Describe the conceptual difference between IVFFlat and HNSW indexing and choose the right one for a given dataset size and workload
- Avoid the most common pgvector mistakes: dimension mismatches, unindexed large tables, and premature or stale indexes

## Estimated Study Time

| File | Topic | Est. Time |
|------|-------|-----------|
| 01-pgvector-Fundamentals.md | Installing pgvector, storing and querying embeddings in Postgres | 2-3 hours |
| 02-Hybrid-Relational-and-Vector-Queries.md | Combining `WHERE` filters with vector similarity in one query | 2-3 hours |
| 03-Indexing-with-IVFFlat-and-HNSW.md | Approximate nearest neighbor indexing for large tables | 2-3 hours |

**Total: 6-9 hours of focused study**

---

## What Comes Next

After completing Phase 7, proceed to:
- **Phase 8: Retrieval Strategies** — going beyond plain top-k similarity search to more sophisticated retrieval techniques

---

> "You don't always need a new tool — sometimes the one you're already carrying just needs a new blade." — Phase 7 in one sentence.
