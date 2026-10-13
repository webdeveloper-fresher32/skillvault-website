# Module 4: Vector Databases & PostgreSQL + pgvector

Welcome to **Module 4**. In production, vector search must integrate with enterprise relational requirements: multi-tenancy, transactional updates, metadata filtering, and ACID guarantees.

---

## 📑 Module Lessons

1. **[01-postgresql-and-pgvector-guide.md](01-postgresql-and-pgvector-guide.md)**
   - Why in-memory vector search fails at scale.
   - Setting up PostgreSQL with the `pgvector` extension.
   - Designing the production schema: `documents` and `document_chunks` tables.
   - Vector indexing: **IVFFlat** (Inverted File Flat) vs. **HNSW** (Hierarchical Navigable Small World).
   - Writing performant cosine similarity queries using the `<=>` operator.

2. **[02-quiz-and-core-concepts.md](02-quiz-and-core-concepts.md)**
   - Deep dive into indexing trade-offs, multi-tenancy models, and distance calculations.

3. **[03-challenge-production-retriever.md](03-challenge-production-retriever.md)**
   - Production retriever design challenge: clean abstraction, connection pooling, and error handling.

4. **[04-task-1-source-filtering.md](04-task-1-source-filtering.md)**
   - Practical Task 1: Combining vector similarity search with structured SQL WHERE clauses (tenant and source filtering).

5. **[05-task-2-unrelated-query-thresholds.md](05-task-2-unrelated-query-thresholds.md)**
   - Practical Task 2: Testing irrelevant questions and implementing strict similarity distance cutoffs.

6. **[06-task-3-document-updates-and-idempotency.md](06-task-3-document-updates-and-idempotency.md)**
   - Practical Task 3: Handling document revisions, idempotent upserts, and atomic deletion of obsolete chunks.

7. **[07-task-4-retrieval-evaluation-script.md](07-task-4-retrieval-evaluation-script.md)**
   - Practical Task 4: Building an automated offline evaluation script to test retrieval quality against ground truth questions.

---

[⬅️ Previous Module: Embeddings](../03-embeddings-and-similarity/README.md) | [Next Module: Advanced Retrieval ➡️](../05-advanced-retrieval/README.md)
