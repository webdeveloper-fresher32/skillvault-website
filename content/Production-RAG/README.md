# Production RAG — Enterprise Learning Blueprint & Architecture

Welcome to the **Production RAG** engineering repository. This repository contains the complete curriculum, architectural guides, implementation patterns, and code for building an enterprise-grade **Retrieval-Augmented Generation (RAG)** system from scratch using Python, PostgreSQL + `pgvector`, FastAPI, and Docker.

---

## 📚 Complete Modular Curriculum

The course content is organized into 9 comprehensive modules, with each lesson in its own dedicated Markdown file:

| Module | Description | Lessons |
| :--- | :--- | :--- |
| **[01. Roadmap & Loaders](01-roadmap-and-loaders/README.md)** | End-to-end RAG architecture & multi-format document loading | [Roadmap](01-roadmap-and-loaders/01-production-rag-architecture-roadmap.md), [Loaders](01-roadmap-and-loaders/02-document-loaders-and-processing.md) |
| **[02. Chunking Strategies](02-chunking-strategies/README.md)** | Fixed, recursive, semantic & parent-document chunking | [Deep Dive](02-chunking-strategies/01-chunking-strategies-deep-dive.md), [Environment Setup](02-chunking-strategies/02-macos-python-environment-setup.md) |
| **[03. Embeddings & Similarity](03-embeddings-and-similarity/README.md)** | Vector geometry, cosine similarity & in-memory vector search | [Embeddings & Search](03-embeddings-and-similarity/01-embeddings-and-similarity-search.md) |
| **[04. PostgreSQL + pgvector](04-vector-databases-pgvector/README.md)** | Database schemas, IVFFlat vs. HNSW, filtering & idempotency | [pgvector Guide](04-vector-databases-pgvector/01-postgresql-and-pgvector-guide.md), [Quiz](04-vector-databases-pgvector/02-quiz-and-core-concepts.md), [Challenge](04-vector-databases-pgvector/03-challenge-production-retriever.md), [Source Filtering](04-vector-databases-pgvector/04-task-1-source-filtering.md), [Thresholds](04-vector-databases-pgvector/05-task-2-unrelated-query-thresholds.md), [Updates](04-vector-databases-pgvector/06-task-3-document-updates-and-idempotency.md), [Evaluation Script](04-vector-databases-pgvector/07-task-4-retrieval-evaluation-script.md) |
| **[05. Advanced Retrieval](05-advanced-retrieval/README.md)** | Hybrid search (RRF), Cross-Encoder reranking, Query rewriting | [Dense vs Sparse](05-advanced-retrieval/01-similarity-vs-keyword-search.md), [Hybrid Search (RRF)](05-advanced-retrieval/02-hybrid-search-with-rrf.md), [Reranking](05-advanced-retrieval/03-reranking-with-cross-encoders.md), [Query Rewriting](05-advanced-retrieval/04-query-rewriting.md), [Compression](05-advanced-retrieval/05-contextual-compression.md) |
| **[06. Generation & Evaluation](06-generation-grounding-and-evaluation/README.md)** | Grounding prompts, citation verification, Hit Rate/MRR & tracing | [Grounded Generation](06-generation-grounding-and-evaluation/01-grounded-generation-and-citations.md), [Citations](06-generation-grounding-and-evaluation/02-citation-validation-and-hallucination-control.md), [Evaluation Metrics](06-generation-grounding-and-evaluation/03-evaluating-your-rag-system.md), [Observability](06-generation-grounding-and-evaluation/04-monitoring-and-debugging.md) |
| **[07. Production Deployment](07-production-deployment/README.md)** | FastAPI, tenant auth, rate limiting, caching, background jobs & Docker | [FastAPI](07-production-deployment/01-fastapi-service.md), [Auth & Security](07-production-deployment/02-authentication-and-tenant-isolation.md), [Rate Limiting](07-production-deployment/03-rate-limiting-timeouts-and-retries.md), [Caching](07-production-deployment/04-caching-in-production-rag.md), [Async Ingestion](07-production-deployment/05-background-ingestion-and-async-processing.md), [Docker](07-production-deployment/06-dockerizing-production-rag.md), [Readiness](07-production-deployment/07-production-readiness-and-healthchecks.md) |
| **[08. Capstone Project](08-capstone-project/README.md)** | End-to-end implementation architecture & audit checklist | [Capstone Blueprint & Milestones](08-capstone-project/01-capstone-blueprint-and-milestones.md) |
| **[09. Roadmap & LangChain](09-roadmap-and-langchain/README.md)** | Production concept inventory & transitioning to LangChain / LCEL | [Coverage Audit](09-roadmap-and-langchain/01-production-rag-coverage-audit.md), [LangChain Transition](09-roadmap-and-langchain/02-langchain-transition-roadmap.md) |

---

## 🏗️ Production Architecture

```
User Query
    │
    ▼
[FastAPI Gateway] ── (Bearer Auth & Tenant Check)
    │
    ▼
[Query Rewriter / Expansion]
    │
    ├───► [BM25 Full-Text Search (PostgreSQL tsvector)]
    │
    └───► [Embedding Model] ──► [pgvector HNSW Cosine Search]
                │
                ▼
      [Reciprocal Rank Fusion (RRF)]
                │
                ▼
     [Cross-Encoder Reranker]
                │
                ▼
     [Contextual Compressor]
                │
                ▼
[Strict Grounding Prompt + Citations]
                │
                ▼
             [LLM]
                │
                ▼
[Citation & Hallucination Guardrail]
                │
                ▼
   Grounded Answer with Sources
```
