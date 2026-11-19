# Module 01: System Architecture & Topology
## Understanding Production-Grade RAG, Decoupled Microservices & Request Lifecycles

---

### ❓ Question 1: What makes a RAG system "Production-Grade" instead of a toy demo?

> **The Question**: Most tutorials build RAG with 10 lines of Python using Chroma or Pinecone, naive character chunking, a basic cosine similarity query, and send the results to OpenAI. Why can't we use that in production?

#### 💡 The Architectural Defense

A toy RAG demo fails in production across 5 critical dimensions:

1. **Information Loss (The Code Fragmentation Problem)**:
   - Naive character chunkers (`RecursiveCharacterTextSplitter(chunk_size=500)`) split text blindly on character counts.
   - When indexing software engineering guides, a naive chunker frequently slices an `if` statement or code function halfway through. The LLM receives broken code fragments, hallucinates missing syntax, and fails to answer accurately.
   - *Production Solution*: **AST-aware markdown & semantic chunking** that treats code blocks (```` ```...``` ````) and tables as indivisible atomic tokens.

2. **The "Exact Match" Blindspot of Pure Vector Search**:
   - Dense vector embeddings map text into semantic concept space. They understand that "king" is close to "queen".
   - However, in engineering platforms, users search for exact technical symbols: `useId`, `SecurityFilterChain`, `AuthenticationManager`, or HTTP error codes `403`.
   - Vector models often produce identical cosine distance for `useId` and `useState` because both are React hooks!
   - *Production Solution*: **Dual-stage Hybrid Search** combining Dense Vector HNSW with Sparse BM25 Lexical Keyword Search inside the database, fused via **Reciprocal Rank Fusion (RRF $k=60$)**.

3. **Hallucination & Position Bias ("Lost in the Middle")**:
   - Vector search returns Top-20 candidates. Passing all 20 into the LLM context causes the LLM to ignore crucial facts in the middle of the prompt.
   - Furthermore, bi-encoder embeddings compute representations of query and document independently, missing query-document cross-attention.
   - *Production Solution*: **Cross-Encoder Reranker (FlashRank)** that reads the query and candidate passage simultaneously, computing token-level cross-attention and ranking the fused candidates down to the Top-4 highest-confidence passages.

4. **Latency, Cold Starts & Streaming**:
   - Waiting 5–10 seconds for a complete answer causes users to abandon the application.
   - *Production Solution*: **Server-Sent Events (SSE)** streaming tokens in real time, accompanied by verified citation frames.

5. **Multi-Tenant Security & Kernel Isolation**:
   - Storing all users' data in a flat table risks cross-tenant data leakage if an application bug omits a `WHERE user_id = ...` filter.
   - *Production Solution*: **PostgreSQL Row-Level Security (RLS)** enforced at the database kernel level using session variables (`SET LOCAL app.current_tenant_id = ...`).

---

### ❓ Question 2: Why decouple the Next.js Frontend and Python AI Microservice?

> **The Question**: Next.js has API routes. Why not write the entire RAG pipeline in TypeScript inside Next.js?

#### 💡 The Architectural Defense

| Criteria | Unified Next.js (TypeScript) | Decoupled Next.js + Python FastAPI |
| :--- | :--- | :--- |
| **Data Science & ML Ecosystem** | Limited. JS ONNX runtimes are clunky, memory-heavy, and lack native cross-encoder libraries. | **Rich & Native**. Native access to `asyncpg`, `pgvector`, `flashrank`, `fastembed`, `tiktoken`, and `LangChain LCEL`. |
| **Embedding & Reranking Performance** | Running embeddings in Vercel Edge / Node functions increases bundle size past limits (>50MB). | **In-Process C/C++ Extensions**. Python FastAPI runs ONNX Runtime on CPU at ~22ms inference with zero memory leak. |
| **Scalability & Cost** | Frontend scaling scales the expensive AI process unnecessarily. | **Independent Autoscaling**. Frontend scales on edge CDN; Python AI service scales based on GPU/CPU inference load. |
| **Separation of Concerns** | Web routing, authentication, and heavy vector math compete for same Node event loop. | Node event loop remains 100% responsive for UI rendering while Python handles parallel async vector math. |

---

### 3. Master System Topology Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              NEXT.JS 16 FRONTEND CLIENT                                │
│                     (Floating Studio & Fullscreen Assistant UI)                        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP POST /api/rag/chat/stream (Same-Origin)
                                            │ Body: { message: "...", top_k: 4 }
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS STREAM ROUTE PROXY (0 CORS)                            │
│                 (frontend/src/app/api/rag/chat/stream/route.ts)                        │
│         Eliminates browser CORS & Mixed Content issues; proxies to BACKEND_AI_URL      │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP POST /api/v1/rag/chat/stream
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               FASTAPI ASGI MICROSERVICE                                │
│                     (backend-ai: Port 8000 / Vercel / Render / Fly)                    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DENSE QUERY EMBEDDING INFERENCE (768d)                          │
│        Local: Ollama (nomic-embed-text)  │  Cloud: FastEmbed CPU ONNX in /tmp/models   │
│                          Prefix: "search_query: <user_query>"                          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   DUAL PARALLEL HYBRID RETRIEVAL (IN-SQL DATABASE)                     │
│                                                                                        │
│  [Query Q] ───────────────┬─────────────────────────────────────────────────┐          │
│                           │                                                 │          │
│                           ▼                                                 ▼          │
│              [HNSW Vector Distance (<=>)]                       [GIN Lexical ts_rank]  │
│             Top-25 Dense Candidates                            Top-25 Sparse Candidates│
│                           │                                                 │          │
│                           └───────────────────────┬─────────────────────────┘          │
│                                                   ▼                                    │
│                              [RECIPROCAL RANK FUSION (RRF k=60)]                       │
│                                 Fused Top-20 Candidates                                │
│                                                   │                                    │
│                                                   ▼                                    │
│                              [FLASHRANK CROSS-ENCODER RERANKER]                        │
│                           Local In-Process MiniLM-L-12 (~22ms CPU)                     │
│                                                   │                                    │
│                                                   ▼                                    │
│                                     Top-K Grounded Passages                            │
│                             (With Citation Metadata & Relevance Score)                 │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     LANGCHAIN LCEL GENERATION STREAMING PIPELINE                       │
│                    ChatPromptTemplate | ChatModel | StrOutputParser()                  │
│             Local: ChatOllama (llama3.2)  │  Cloud: ChatOpenAI (Groq qwen3.8-27b)      │
│                                                                                        │
│           Yields SSE event frames: event: citations -> event: token -> event: done     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4. End-to-End Request-Response Lifecycle Walkthrough

1. **User Types Query**: The user asks *"How does React reconciliation work with Fiber?"* in the Next.js floating assistant.
2. **Same-Origin Client Call**: The browser dispatches `POST /api/rag/chat/stream` to the Next.js frontend itself (same origin $\to$ **Zero CORS errors**).
3. **Server-Side Route Proxy**: Next.js receives the request and proxies it server-to-server to the Python FastAPI microservice at `BACKEND_AI_URL`.
4. **Query Embedding**: FastAPI formats the query with contrastive prefix (`search_query: How does React reconciliation work with Fiber?`) and calls the active embedding engine (`nomic-embed-text`, 768 dimensions).
5. **Parallel In-SQL Retrieval**:
   - Branch A: Searches HNSW index for Top-25 nearest vector neighbors by cosine distance (`<=>`).
   - Branch B: Searches GIN index for Top-25 keyword matches using PostgreSQL `ts_rank_cd(tsv_content, plainto_tsquery('english', ...))`.
6. **Reciprocal Rank Fusion**: PostgreSQL computes RRF score $RRF = \frac{1}{60 + rank_{dense}} + \frac{1}{60 + rank_{sparse}}$ and returns the fused Top-20 candidate passages.
7. **Cross-Encoder Reranking**: FlashRank (`ms-marco-MiniLM-L-12-v2`) re-scores all 20 passages through joint cross-attention in ~22ms, producing the Top-4 grounded citations.
8. **Initial SSE Frame (`event: citations`)**: FastAPI yields an SSE citation event containing verified document titles, section headers, chunk IDs, and FlashRank scores.
9. **LCEL Token Stream (`event: token`)**: The LangChain LCEL pipeline streams LLM response tokens directly through the open SSE connection as they are generated.
10. **Completion Frame (`event: done`)**: Stream terminates gracefully. Client UI renders clickable citation badges and dark code blocks with copy buttons.

---

### 5. Repository Structure & Directory Map

```
SkillVault-website/
├── backend-ai/                      # Python FastAPI RAG Microservice
│   ├── app/
│   │   ├── core/
│   │   │   └── llm.py               # Multi-provider LLM & Embeddings factory
│   │   ├── rag/                     # Native Python RAG Implementation
│   │   │   ├── ast_chunker.py       # Custom AST-aware markdown chunker
│   │   │   ├── ingestion.py         # Native vector ingestion CLI
│   │   │   └── hybrid_retriever.py  # Native asyncpg hybrid retriever
│   │   ├── rag_langchain/           # LangChain LCEL Implementation (Active)
│   │   │   ├── ast_chunker.py       # Subclassed LangChain TextSplitter
│   │   │   ├── pdf_ingestion.py     # Enterprise PDF ingestion engine
│   │   │   ├── hybrid_retriever.py  # Subclassed LangChain BaseRetriever
│   │   │   └── chain.py             # Declarative LCEL chain pipeline
│   │   ├── schemas/
│   │   │   └── rag.py               # Pydantic v2 validation models
│   │   └── main.py                  # FastAPI ASGI app with CORS & SSE endpoints
│   ├── api/
│   │   └── index.py                 # Vercel Serverless Function entry point
│   ├── vercel.json                  # Vercel configuration (1024MB RAM, 60s maxDuration)
│   ├── Dockerfile                   # Multi-stage Dockerfile with pre-cached models
│   ├── render.yaml                  # Render deployment blueprint
│   └── fly.ai.toml                  # Fly.io configuration
├── frontend/                        # Next.js 16 (React 19) Frontend
│   ├── src/
│   │   ├── app/
│   │   │   └── api/
│   │   │       └── rag/
│   │   │           ├── chat/stream/ # Zero-CORS Next.js route proxy
│   │   │           └── search/      # Semantic search route proxy
│   │   ├── components/
│   │   │   └── chat/
│   │   │       └── FloatingAssistant.tsx # Studio & fullscreen UI
│   │   └── lib/
│   │       └── useAIAssistant.ts    # Streaming React hook with AbortController
│   └── next.config.ts               # Rewrites mapping /api/v1/rag/* -> /api/rag/*
├── resources/
│   └── pdfs/                        # 7 Enterprise Technical Books (3,989 Chunks)
└── scripts/
    ├── 001_production_rag_schema.sql# PostgreSQL DDL with pgvector & RLS
    └── sync_to_neon.py              # Cloud database synchronizer
```

👉 **Next: [Module 02: Vector Database & pgvector](MODULE_02_VECTOR_DATABASE_AND_PGVECTOR.md)**
