# RAG Course — Design Spec

## Purpose

Add a new "RAG" (Retrieval-Augmented Generation) course to SkillVault, matching the existing course structure (Docker, Kubernetes, MongoDB, MySQL, HLD, AWS). Audience: a learner who knows Python and a bit of ML, but has no prior RAG/LLM-application experience — beginner-to-advanced learning pace, ending at practitioner-level, production-ready understanding. Every lesson follows the user's established explanation style: problem → analogy → internal flow → code example → comparison table → common mistakes → interview angle → memory hook (same style used in the MongoDB/MySQL rewrites).

## Structure

```
RAG/
├── Phase-01-RAG-Fundamentals/
├── Phase-02-LLM-and-Embedding-Basics/
├── Phase-03-Document-Loading-and-Preprocessing/
├── Phase-04-Chunking-Strategies/
├── Phase-05-Vector-Databases-Chroma/
├── Phase-06-Vector-Databases-Pinecone/
├── Phase-07-Vector-Databases-Pgvector/
├── Phase-08-Retrieval-Strategies/
├── Phase-09-Reranking-and-Query-Transformation/
├── Phase-10-RAG-Orchestration-LangChain/
├── Phase-11-Evaluation-and-Observability/
├── Phase-12-Agentic-RAG/
├── Phase-13-GraphRAG-and-Multimodal-RAG/
├── Phase-14-Production-Patterns-and-Scaling/
├── Projects/
├── Quick-Reference/
└── README.md
```

14 phases, matching AWS's phase count (broader topic than a single database/orchestration tool warrants deeper splitting).

## Phase Contents

1. **RAG Fundamentals** — what RAG is, why LLMs hallucinate/have knowledge cutoffs, RAG vs fine-tuning vs long-context, high-level architecture (index → retrieve → augment → generate), when RAG is/isn't the right tool.
2. **LLM & Embedding Basics for RAG** — beginner-friendly primer: what an embedding is (analogy-driven), vectors and vector space intuition, cosine similarity/dot product explained simply, tokenization basics, context windows — only what's needed to use RAG, not a full ML course.
3. **Document Loading & Preprocessing** — loading PDFs/HTML/text/structured data, cleaning and normalizing text, metadata extraction, handling tables/images at a basic level.
4. **Chunking Strategies** — fixed-size, recursive character splitting, semantic chunking, sentence-window, parent-document retrieval, choosing chunk size/overlap.
5. **Vector Databases I — Chroma** — local/open-source vector store, embedding + storing + querying documents, collections, persistence.
6. **Vector Databases II — Pinecone** — managed/cloud vector DB, indexes, namespaces, upserts, metadata filtering, scaling considerations.
7. **Vector Databases III — pgvector** — SQL-native vector search inside PostgreSQL, hybrid relational + vector queries, indexing (IVFFlat/HNSW basics).
8. **Retrieval Strategies** — similarity search, hybrid search (BM25 + vector), MMR (maximal marginal relevance), metadata filtering, top-k tuning.
9. **Reranking & Query Transformation** — cross-encoder rerankers, HyDE (hypothetical document embeddings), query expansion/decomposition, multi-query retrieval.
10. **RAG Orchestration with LangChain** — retrievers, chains, prompt templates, combining everything from Phases 3-9 into a working pipeline using LangChain.
11. **Evaluation & Observability** — RAGAS-style metrics (faithfulness, answer relevance, context precision/recall), tracing a RAG pipeline, debugging bad retrievals.
12. **Agentic RAG** — tool-using retrieval agents, self-querying retrievers, multi-step/iterative retrieval, agent deciding when to retrieve vs answer directly.
13. **GraphRAG & Multimodal RAG** — knowledge-graph-based retrieval basics, retrieving over images/tables, multimodal embeddings at an introductory level.
14. **Production Patterns & Scaling** — caching, cost control, latency optimization, PII/security considerations, deployment, monitoring, common production failure modes.

Each phase folder: `README.md` (phase summary) + numbered lesson files (`01-Topic.md`, `02-Topic.md`, ...), matching the zero-padded numbering convention used across all courses. Code examples are framework-agnostic first (plain Python + API calls), then shown via LangChain where it simplifies the pattern. Generation calls default to the Claude API; embeddings use standard/open embedding models. Where a lesson needs a non-RAG Python concept (e.g. async/await, generators), the lesson briefly explains it inline before using it — no assumed fluency beyond basic Python.

## Projects/ (7, beginner → advanced)

1. Simple Doc-QA Bot (Chroma, basic retrieval, no fancy stuff)
2. PDF Knowledge Base Assistant (chunking strategies + Pinecone)
3. Hybrid Search App (BM25 + vector + reranking, pgvector)
4. Multi-Source RAG with LangChain (multiple document types, metadata filtering)
5. Evaluated RAG Pipeline (RAGAS-style metrics, tracing, iterative improvement)
6. Agentic Research Assistant (agentic RAG, tool use, multi-step retrieval)
7. Production RAG Capstone — combines chunking, hybrid retrieval, reranking, evaluation, caching, and deployment into one end-to-end system

## Quick-Reference/

- `RAG-Cheatsheet.md` — quick lookup across all phases (chunking strategies, similarity metrics, vector DB comparison, retrieval strategies, common LangChain patterns).
- `Interview-QA.md` — 50 interview questions covering RAG architecture, chunking, embeddings, vector DBs, retrieval/reranking, evaluation, agentic RAG, and production tradeoffs.

## Top-level README.md

Course overview, course-structure diagram, learning-path table (Phase | Topic | Difficulty | Time), prerequisites (Python + basic ML familiarity), total estimated time — mirrors the AWS/Kubernetes README format.

## Out of Scope

- Fine-tuning LLMs or embedding models — RAG course stays focused on retrieval-augmented approaches, not model training.
- Deep ML theory (transformer internals, backprop, training loops) — covered only to the depth needed to use embeddings/LLMs as tools.
- Specific cloud provider deployment deep-dives (AWS/GCP/Azure specifics) — production phase covers general patterns; provider-specific depth is left to the existing AWS course.
