# SkillVault Production RAG: Modular Engineering Guide
## Interactive Technical Implementation Playbook (Q&A Architectural Defense, Code & Visual Proof)

Welcome to the **SkillVault Production-Grade RAG Playbook**. This modular guide is structured as an interactive engineering dialogue: every module addresses the critical questions asked during system design, defends algorithm choices against common alternatives, and provides complete, runnable production code accompanied by real visual verification screenshots.

---

## 🧭 Modules Overview

| Module | Title | Core Focus & Algorithm Defenses | Visual Proof & Code Artifacts |
| :--- | :--- | :--- | :--- |
| **[Module 01](MODULE_01_SYSTEM_ARCHITECTURE_AND_TOPOLOGY.md)** | **System Architecture & Topology** | Toy RAG vs Production RAG, Multi-Tenant Isolation, Microservice Decoupling, Request Lifecycle | End-to-end Architecture Flow Diagram |
| **[Module 02](MODULE_02_VECTOR_DATABASE_AND_PGVECTOR.md)** | **Vector Database & `pgvector`** | PostgreSQL + `pgvector` vs Standalone Vector DBs, HNSW vs IVFFlat, macOS Apple Silicon C Compilation, Row-Level Security | `01_pgadmin_psql_terminal.jpg`<br>`02_pgvector_missing_error.jpg`<br>`03_pgadmin_database_tree.jpg` |
| **[Module 03](MODULE_03_DOCUMENT_INGESTION_AND_CHUNKERS.md)** | **Document Ingestion & Chunking** | AST-Aware Code Chunking vs Naive Token Splitting, Enterprise PDF Extraction, Idempotent Hashing, Neon Cloud Sync | `04_rag_ingestion_853_chunks_success.jpg`<br>`05_pgadmin_document_chunks_853_rows.jpg` |
| **[Module 04](MODULE_04_HYBRID_RETRIEVAL_AND_RERANKING.md)** | **Hybrid Retrieval & Reranking** | Dense HNSW + Sparse BM25, Reciprocal Rank Fusion ($k=60$) vs Linear Fusion, In-Process FlashRank Cross-Encoder (~22ms CPU) | `06_hybrid_search_flashrank_scores.jpg`<br>`07_thunder_client_float32_serialization.jpg` |
| **[Module 05](MODULE_05_DUAL_RAG_NATIVE_PYTHON_VS_LANGCHAIN.md)** | **Dual RAG: Native Python vs LangChain** | Why Build Both, Subclassing `BaseRetriever`, Declarative LCEL Pipelines (`ChatPromptTemplate \| ChatModel \| StrOutputParser`), Dynamic Provider Switching | `backend-ai/app/rag/`<br>`backend-ai/app/rag_langchain/` |
| **[Module 06](MODULE_06_STREAMING_SSE_AND_CORS_PROXY.md)** | **Streaming SSE & Zero-CORS Proxy** | SSE vs WebSockets, Reverse-Proxy Buffering Bypass, Decoupled Next.js Stream Route Proxy eliminating Browser CORS | `08_sse_streaming_citations_success.jpg`<br>`09_chat_ui_initial_small.jpg`<br>`10_desired_code_block_style.png` |
| **[Module 07](MODULE_07_PRODUCTION_DEPLOYMENT_VERCEL_RENDER_NEON.md)** | **Production Cloud Deployment** | Vercel Serverless Function Trap (`/tmp` caches, `maxDuration: 60`), Multi-Stage Docker builds (Render / Fly.io), Groq Qwen 21ms inference | Live Verified URL:<br>`https://backend-ai-lovat.vercel.app` |
| **[Module 08](MODULE_08_TROUBLESHOOTING_AND_ENGINEERING_PLAYBOOK.md)** | **Troubleshooting & Gotchas Playbook** | 8 Real-World Production Traps Solved, Complete Local & Cloud Copy-Paste Runbook | Comprehensive Verification Commands |

---

## 🚀 How to Read & Implement
Each module follows a structured 3-part layout:
1. **The Question / Challenge**: Why are we doing this and what problem does it solve?
2. **The Architectural Defense & Algorithm Choice**: Comparing existing options and mathematically/architecturally defending our decision.
3. **The Implementation**: Production-grade code, configuration, and verification commands.
