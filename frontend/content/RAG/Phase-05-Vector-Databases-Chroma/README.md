# Phase 5: Vector Databases I — Chroma

## Overview

Phases 1-4 gave you the conceptual pipeline (index → retrieve → augment → generate), the building blocks of embeddings, and the discipline of splitting documents into good chunks. Now those chunks need somewhere to live — somewhere that can find "the 3 most similar vectors out of 500,000" in milliseconds, not minutes. That's the job of a vector database, and Chroma is the easiest on-ramp: it runs locally, needs no cloud account, and gets you from "zero" to "querying real embeddings" in a handful of lines of Python. This phase builds the local prototyping skills that Phases 6 and 7 will extend to managed and SQL-native vector stores.

## Learning Objectives

By the end of Phase 5, you will be able to:

- Explain why brute-force similarity search doesn't scale, and what an approximate nearest neighbor (ANN) index conceptually adds
- Compare Chroma, Pinecone, and pgvector at a high level and justify which one fits a given scenario
- Install Chroma, create a persistent client and a collection, and add documents with embeddings and metadata
- Query a Chroma collection by embedding and correctly interpret the shape of the results it returns
- Manage multiple collections, update and delete documents by id, and reason about persistence across restarts
- Avoid the most common Chroma setup mistakes: inconsistent embedding functions and unintentional in-memory-only storage

## Estimated Study Time

| File | Topic | Est. Time |
|------|-------|-----------|
| 01-Introduction-to-Vector-Databases.md | Why brute-force search fails, ANN indexes conceptually, Chroma vs Pinecone vs pgvector | 2-3 hours |
| 02-Chroma-Fundamentals.md | Installing Chroma, clients, collections, adding and querying documents | 2-3 hours |
| 03-Chroma-Collections-and-Persistence.md | Multiple collections, updates/deletes, persistent vs in-memory storage | 2-3 hours |

**Total: 6-9 hours of focused study**

---

## File Index

### 01 - Introduction to Vector Databases
`/Phase-05-Vector-Databases-Chroma/01-Introduction-to-Vector-Databases.md`

Starts from the scaling problem: a Python list and a for-loop work fine for 50 vectors and fall over at 500,000. Introduces approximate nearest neighbor indexing conceptually (no heavy math) and previews the three vector databases this course covers, with guidance on when to reach for each.

Key topics:
- Why brute-force cosine similarity doesn't scale
- The phone book vs. pile-of-business-cards analogy
- ANN indexes (HNSW, IVFFlat) at a conceptual level
- Chroma vs. Pinecone vs. pgvector comparison table

---

### 02 - Chroma Fundamentals
`/Phase-05-Vector-Databases-Chroma/02-Chroma-Fundamentals.md`

Gets Chroma running locally: installing the package, creating a persistent client, creating a collection, adding documents with embeddings and metadata, and querying by embedding vector.

Key topics:
- The notebook vs. renting-an-office analogy
- `chromadb.PersistentClient`, `get_or_create_collection`
- `.add()` and `.query()` with a full worked example
- Consistent embedding functions and setting a persistent path

---

### 03 - Chroma Collections and Persistence
`/Phase-05-Vector-Databases-Chroma/03-Chroma-Collections-and-Persistence.md`

Moves from a one-off script to something closer to a real application: multiple collections for different knowledge bases, updating and deleting documents by id, and verifying that a persistent client's data survives a process restart.

Key topics:
- The filing-cabinet-with-folders analogy
- Multiple collections for multi-tenant/multi-topic use cases
- `.update()`, `.delete()`, and `.upsert()`
- Persistent vs. in-memory clients and basic backup considerations

---

## How to Study This Phase

1. Read each file once for understanding, then again while typing the code examples into a real Python environment with `chromadb` installed.
2. After each lesson, close the file and explain the analogy and the code flow out loud (Feynman technique).
3. Do the hands-on exercises — they require nothing beyond `pip install chromadb`.
4. Review the Interview Q&A section and answer each question out loud before checking it against the written answer.
5. Before moving to Phase 6, make sure you can explain, from memory, why you'd choose Chroma over Pinecone or pgvector for a given scenario.

## Prerequisites

Phases 1-4 (RAG fundamentals, embeddings, document loading, chunking), comfort with Python, and a willingness to `pip install` a package and run scripts locally.

## What Comes Next

After completing Phase 5, proceed to:
- **Phase 6: Vector Databases II — Pinecone** — the managed, cloud-hosted alternative for production-scale workloads

---

> "Chroma is the vector database you reach for when you just want to see your RAG pipeline work — no account, no server, no bill." — Phase 5 in one sentence.
