# Module 5: Advanced Retrieval Strategies

Welcome to **Module 5**. Basic vector similarity search often misses domain terms, exact IDs, acronyms, or complex multi-intent questions. This module teaches industrial retrieval techniques.

---

## 📑 Module Lessons

1. **[01-similarity-vs-keyword-search.md](01-similarity-vs-keyword-search.md)**
   - Dense retrieval (semantic vector search) vs. Sparse retrieval (BM25 keyword search).
   - Strengths, weaknesses, and failure modes of each approach.

2. **[02-hybrid-search-with-rrf.md](02-hybrid-search-with-rrf.md)**
   - Building Hybrid Search: combining PostgreSQL full-text search (`tsvector`) and `pgvector`.
   - **Reciprocal Rank Fusion (RRF)**: Merging rank positions fairly without calibrating disparate score scales.

3. **[03-reranking-with-cross-encoders.md](03-reranking-with-cross-encoders.md)**
   - Two-stage retrieval architecture: fast Bi-Encoder candidate retrieval followed by high-precision Cross-Encoder reranking (`cross-encoder/ms-marco-MiniLM-L-6-v2`).

4. **[04-query-rewriting.md](04-query-rewriting.md)**
   - Query expansion, clarifying ambiguity, and Hypothetical Document Embeddings (**HyDE**).

5. **[05-contextual-compression.md](05-contextual-compression.md)**
   - Extracting only relevant sentences from retrieved chunks before feeding them to the LLM.
   - Reducing latency, prompt cost, and context stuffing.

---

[⬅️ Previous Module: Vector DBs](../04-vector-databases-pgvector/README.md) | [Next Module: Generation & Citations ➡️](../06-generation-grounding-and-evaluation/README.md)
