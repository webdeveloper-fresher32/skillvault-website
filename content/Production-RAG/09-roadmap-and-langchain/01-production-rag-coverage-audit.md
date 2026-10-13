> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 8: Production RAG Capstone Project Architecture & Milestones](../08-capstone-project/01-capstone-blueprint-and-milestones.md) | ➡️ [Module 9.2: Transitioning to LangChain (LCEL & Python Pipeline Mapping)](02-langchain-transition-roadmap.md)

---

Man, honestly, you've already covered a **large part of Production RAG**. 🔥 Before starting the capstone, let's separate three things: what we've studied, what still needs deeper coverage, and what we should learn by building the project.

My recommendation: **don't start the capstone immediately if your goal is to understand Production RAG thoroughly.** We should close a few important gaps first.

# 1. Everything we've covered so far

**Module 1 — Document Loading**
`Covered`
PDF extraction, metadata, loaders, scanned PDFs and OCR considerations.

---

**Module 2 — Chunking**
`Covered`
Fixed-size, overlap, recursive, semantic, parent-child chunking and stable chunk IDs.

---

**Module 3 — Embeddings and Similarity**
`Covered`
Embedding models, cosine similarity, vector dimensions, exact search, ANN, HNSW and IVF.

---

**Module 4 — Vector Databases**
`Covered`
PostgreSQL/pgvector, Pinecone, Qdrant, Weaviate, metadata filtering, ingestion and tenant isolation.

---

**Module 5 — Advanced Retrieval**
`Covered`
Keyword search, hybrid retrieval, Reciprocal Rank Fusion (RRF), reranking, query rewriting and contextual compression.

---

**Module 6 — Generation and Evaluation**
`Covered`
Grounded answers, citations, citation validation, claim verification, retrieval metrics, monitoring and debugging.

---

**Module 7 — Production Engineering**
`Partially covered`
FastAPI, authentication, tenant isolation, rate limiting, retries, caching, background ingestion, Docker, health checks and deployment readiness.

One important distinction, man: **covered means we've studied the concepts and examples**, not that every implementation has been independently tested or mastered. We still need to verify the integrations in your actual project.

# 2. What is still left to learn?

These are the core production areas to harden before running high-volume production traffic:

| Priority Area | Urgency | Critical Topics to Hardens |
| :--- | :--- | :--- |
| **1. Durable Ingestion & Lifecycle** | `HIGH` | Document checksums, atomic upserts/deletions, retries, Celery/Asynq workers, dead-letter queues. |
| **2. Retrieval Quality Tuning** | `HIGH` | Precision@K, Recall@K, MRR, NDCG, chunk size sweeps, Cross-Encoder cutoff tuning. |
| **3. RAG Security & Prompt Injection** | `HIGH` | Context sanitization, tenant isolation (Row-Level Security), bearer auth token validation. |
| **4. Observability & SRE Reliability** | `MEDIUM` | Distributed OpenTelemetry spans, latency p95/p99 budgets, TTFT tracking, cache hit ratios. |
| **5. Advanced Agentic RAG** | `MEDIUM` | Multi-query expansion, HyDE, Parent-Document chunking, GraphRAG entity extraction. |
| **6. CI/CD & Automated Testing** | `MEDIUM` | Synthetic test sets, Ragas eval pipelines, regression gates blocking PRs on hallucination spikes. |

# 3. Do we need to learn all of these before the capstone?

No. Some are essential foundations; others are advanced topics best learned after the basic application works.

| Topic | Recommendation |
|---|---|
| Ingestion lifecycle and stale chunk handling | Learn before capstone |
| Retrieval evaluation and tuning | Learn before or during capstone |
| RAG security and prompt injection | Learn before exposing the API publicly |
| Testing and integration | Learn during capstone |
| Observability, cost and load testing | Implement during capstone |
| HyDE, multi-query and GraphRAG | Learn after the baseline works |
| Kubernetes and complex distributed infrastructure | Defer unless a target role requires them |

## 4. My recommended path for you

  **Close the foundational gaps:** document updates/deletion, advanced retrieval evaluation, and prompt-injection defense.
  **Build the capstone:** connect ingestion, pgvector, hybrid search, reranking, grounded generation and citations.
  **Harden it:** test authentication, tenant isolation, failure recovery, observability and API behavior.
  **Add advanced RAG:** query expansion, HyDE, parent-child retrieval and GraphRAG when you understand the baseline's limitations.
  **Prepare for interviews:** explain architecture choices, trade-offs, evaluation metrics, failure modes and scaling decisions.

**My verdict:** You've covered the core RAG pipeline and many production concepts. There isn't a need to restart the course. I recommend three focused lessons before the capstone, then we can learn the remaining topics through implementation.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 8: Production RAG Capstone Project Architecture & Milestones](../08-capstone-project/01-capstone-blueprint-and-milestones.md) | ➡️ [Next: Module 9.2: Transitioning to LangChain (LCEL & Python Pipeline Mapping)](02-langchain-transition-roadmap.md)
