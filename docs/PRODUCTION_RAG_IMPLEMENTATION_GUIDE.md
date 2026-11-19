# SkillVault Production RAG: End-to-End Local Implementation Guide
## Architecture, Database Migration, Hybrid Retrieval, FlashRank & Next.js Streaming UI

| Metadata | Specification |
| :--- | :--- |
| **System** | SkillVault AI Assistant — 100% Local Production-Grade RAG |
| **Database** | PostgreSQL 17 + Native `pgvector` 0.8.0 (HNSW Cosine + GIN Lexical + Kernel RLS) |
| **Embeddings** | Ollama `nomic-embed-text` (768 Dimensions, 100% Local) |
| **Reranker** | In-Process FlashRank ONNX Cross-Encoder (`ms-marco-MiniLM-L-12-v2`, ~22ms CPU) |
| **Generator (LLM)**| Ollama `llama3.2` (Apple Silicon Metal Accelerated) |
| **Backend Framework**| Python 3.11+ / 3.14 FastAPI ASGI with Server-Sent Events (SSE) |
| **Frontend Stack**| Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons |
| **Status** | **Production Verified — 853 Chunks Indexed (React Course)** |

---

## 1. System Topology & Request Lifecycle

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              NEXT.JS 16 FRONTEND CLIENT                                │
│                     (Floating Studio & Fullscreen Assistant UI)                       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP POST /api/v1/rag/chat/stream
                                            │ Body: { message: "...", top_k: 4 }
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               FASTAPI ASGI MICROSERVICE                                │
│                                  (backend-ai, Port 8000)                               │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          LOCAL OLLAMA EMBEDDING INFERENCE                              │
│                Model: nomic-embed-text (Prefix: "search_query: ...")                   │
│                                 Output: vector(768)                                    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       DUAL PARALLEL HYBRID RETRIEVAL (IN-SQL)                          │
│                                                                                        │
│  [Query Q] ───────────────┬─────────────────────────────────────────────────┐          │
│                           │                                                 │          │
│                           ▼                                                 ▼          │
│              [HNSW Vector Distance]                             [GIN ts_rank BM25]     │
│             Top-25 Dense Candidates                            Top-25 Sparse Candidates│
│                           │                                                 │          │
│                           └───────────────────────┬─────────────────────────┘          │
│                                                   ▼                                    │
│                              [RECIPROCAL RANK FUSION (RRF k=60)]                       │
│                                 Fused Top-20 Candidates                                │
│                                                   │                                    │
│                                                   ▼                                    │
│                              [FLASHRANK CROSS-ENCODER RERANKER]                        │
│                           Local In-Process MiniLM-L-12 (22ms)                          │
│                                                   │                                    │
│                                                   ▼                                    │
│                                     Top-4 Grounded Passages                            │
│                             (Passed to LLM with Citation Metadata)                     │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          LOCAL OLLAMA GENERATION STREAM                                │
│                          Model: llama3.2 (Temperature: 0.2)                            │
│           Yields SSE event frames: event: citations -> event: token -> event: done     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Visual Proof & Screenshots Gallery

All visual milestones and verification steps have been preserved in `docs/images/rag/`:

| Step / Milestone | Screenshot | Description |
| :--- | :--- | :--- |
| **01. Terminal Trap** | [01_pgadmin_psql_terminal.jpg](images/rag/01_pgadmin_psql_terminal.jpg) | pgAdmin interactive psql terminal stuck on unclosed quote prompt (`postgres'#`). |
| **02. Missing pgvector** | [02_pgvector_missing_error.jpg](images/rag/02_pgvector_missing_error.jpg) | Standard macOS installer lacking `vector.control` in `/Library/PostgreSQL/17`. |
| **03. pgAdmin Explorer** | [03_pgadmin_database_tree.jpg](images/rag/03_pgadmin_database_tree.jpg) | Local `skillvault_local` database ready for schema creation. |
| **04. Ingestion Success** | [04_rag_ingestion_853_chunks_success.jpg](images/rag/04_rag_ingestion_853_chunks_success.jpg) | Ingestion CLI parsing 33 React markdown files into **853 chunks**. |
| **05. Database Populated** | [05_pgadmin_document_chunks_853_rows.jpg](images/rag/05_pgadmin_document_chunks_853_rows.jpg) | pgAdmin `document_chunks` table showing 853 active rows with vectors and tsvectors. |
| **06. FlashRank Benchmark** | [06_hybrid_search_flashrank_scores.jpg](images/rag/06_hybrid_search_flashrank_scores.jpg) | Real-time hybrid search achieving **0.9993** precision on React queries. |
| **07. Float32 Bug Fix** | [07_thunder_client_float32_serialization.jpg](images/rag/07_thunder_client_float32_serialization.jpg) | Thunder Client debugging NumPy `float32` serialization error before fix. |
| **08. SSE Stream 200 OK** | [08_sse_streaming_citations_success.jpg](images/rag/08_sse_streaming_citations_success.jpg) | Thunder Client successfully receiving citation frames and streamed token deltas. |
| **09. Initial UI** | [09_chat_ui_initial_small.jpg](images/rag/09_chat_ui_initial_small.jpg) | Initial small floating chat widget on SkillVault homepage. |
| **10. Code Block Standard** | [10_desired_code_block_style.png](images/rag/10_desired_code_block_style.png) | Target dark code block styling with `</> Language` header and Copy button. |

---

## 3. Database Layer & Native `pgvector` Compilation

### 3.1 Native Compilation on macOS Apple Silicon
Because standard EnterpriseDB installers for PostgreSQL on macOS do not bundle `pgvector`, we compiled `pgvector 0.8.0` natively from source against `/Library/PostgreSQL/17/bin/pg_config`:

```bash
cd /tmp
rm -rf pgvector
git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git
cd pgvector
make PG_CONFIG=/Library/PostgreSQL/17/bin/pg_config
sudo make PG_CONFIG=/Library/PostgreSQL/17/bin/pg_config install
```

This installed:
- `/Library/PostgreSQL/17/lib/postgresql/vector.dylib`
- `/Library/PostgreSQL/17/share/postgresql/extension/vector.control`
- `/Library/PostgreSQL/17/share/postgresql/extension/vector--0.8.0.sql`

### 3.2 Production Database Schema (`scripts/001_production_rag_schema.sql`)
```sql
-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Organizations Table (Tenant Anchor)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan_tier VARCHAR(50) DEFAULT 'FREE' CHECK (plan_tier IN ('FREE', 'PRO', 'ENTERPRISE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Documents Metadata Table (Idempotency Tracking)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(512),
    file_type VARCHAR(50) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_org_hash ON documents(organization_id, content_hash);

-- 4. Document Chunks Table (Dual Dense Vector + Sparse TSVector)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding VECTOR(768) NOT NULL,
    tsv_content TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Production Indexes (HNSW for Cosine Distance + GIN for BM25 Lexical)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON document_chunks USING gin(tsv_content);
CREATE INDEX IF NOT EXISTS idx_chunks_org ON document_chunks(organization_id);

-- 6. Row-Level Security (Kernel Tenant Isolation)
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_chunks ON document_chunks;

CREATE POLICY tenant_isolation_chunks ON document_chunks
    FOR ALL
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 7. Seed Default Local Organization
INSERT INTO organizations (id, name, slug, plan_tier)
VALUES ('00000000-0000-0000-0000-000000000001', 'SkillVault Local', 'skillvault-local', 'ENTERPRISE')
ON CONFLICT (id) DO NOTHING;
```

---

## 4. AST-Aware Semantic Markdown Chunker

Located at `backend-ai/app/rag/ast_chunker.py`:
- Treats code fences (```` ``` ````) and tables as indivisible semantic units.
- Injects hierarchical context prefix: `Document: <Title> | Section: <Header>` into each chunk payload.
- Enforces ~600-token chunks with 80-token overlap using `tiktoken` (`cl100k_base`).

---

## 5. Local Ollama Ingestion Pipeline

Located at `backend-ai/app/rag/ingestion.py`:
- Calculates SHA-256 hash of each markdown file to ensure idempotent indexing.
- Batches embedding requests to local Ollama (`nomic-embed-text`, 768 dimensions) with `passage: ` prefix.
- Inserts document and chunk records into PostgreSQL inside ACID transactions.
- **Result**: Successfully ingested 33 lessons of the React course into **853 high-precision chunks**.

---

## 6. Hybrid Search & In-Process FlashRank Cross-Encoder

Located at `backend-ai/app/rag/hybrid_retriever.py`:
- **Dual Query**: Executes Top-25 HNSW vector search (`<=>`) and Top-25 BM25 full-text search (`ts_rank_cd`) simultaneously.
- **In-SQL Reciprocal Rank Fusion (RRF)**:
  $$\text{RRF\_Score} = \frac{1}{60 + \text{dense\_rank}} + \frac{1}{60 + \text{sparse\_rank}}$$
- **FlashRank Re-ranking**: In-process ONNX cross-encoder (`ms-marco-MiniLM-L-12-v2`, ~22ms CPU inference) reranks the fused candidates down to the Top-4 precision passages.

---

## 7. FastAPI Real-Time Streaming Service & Multi-Provider Architecture

Located at `backend-ai/app/main.py`:
- **Dual Mode Support**:
  - **Local Development**: Connects to local Ollama (`llama3.2` + `nomic-embed-text`) with zero API costs.
  - **Cloud Production**: Switches automatically to cloud LLM providers (Groq, Grok xAI, or OpenAI) when `LLM_BASE_URL` and `LLM_API_KEY` are configured.
- **Protocol**: Server-Sent Events (SSE) via `POST /api/v1/rag/chat/stream`.
- **Emits Typed Frames**:
  1. `event: citations` $\rightarrow$ Metadata for verified document titles, section headers, and FlashRank scores.
  2. `event: token` $\rightarrow$ Real-time delta tokens from the active LLM.
  3. `event: done` $\rightarrow$ Stream termination.
- Bypasses reverse-proxy buffering via `X-Accel-Buffering: no`.

---

## 8. Production Cloud Deployment (Docker & Hosting)

For production deployment (Render, Fly.io, Railway, AWS ECS, or Kubernetes):

### 8.1 Multi-Stage Dockerfile (`backend-ai/Dockerfile`)
The service includes a multi-stage Docker build that pre-downloads the FlashRank ONNX model during the image build stage to eliminate runtime cold starts:

```dockerfile
# Stage 1: Build & Pre-cache FlashRank Model
FROM python:3.11-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
RUN python -c "from flashrank import Ranker; Ranker(model_name='ms-marco-MiniLM-L-12-v2', cache_dir='/build/models')"

# Stage 2: Minimal Hardened Runtime
FROM python:3.11-slim AS runner
WORKDIR /app
RUN groupadd -g 1001 appgroup && useradd -u 1001 -g appgroup -s /bin/sh appuser
COPY --from=builder /root/.local /home/appuser/.local
COPY --from=builder /build/models /tmp/models
COPY . .
ENV PATH=/home/appuser/.local/bin:$PATH PYTHONUNBUFFERED=1 MODEL_CACHE_DIR=/tmp/models PORT=8000
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 8.2 Production Environment Variables (`backend-ai/.env.production.example`)
In your cloud hosting dashboard (Render / Fly.io / Railway):
- `DATABASE_URL`: `postgresql://neondb_owner:YOUR_NEON_PASSWORD@ep-cold-bread-b4mv005l-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require`
- `LLM_BASE_URL`: `https://api.groq.com/openai/v1`
- `LLM_API_KEY`: `gsk_your_groq_api_key_here`
- `CHAT_MODEL`: `qwen/qwen3.8-27b`
- `EMBEDDING_PROVIDER`: `fastembed` (in-process ONNX `nomic-embed-text-v1.5`, 768 dim, ~8ms CPU, $0 cost)
- `MODEL_CACHE_DIR`: `/tmp/models`
- `PORT`: `8000`

### 8.3 Deployment Configuration Files Provided
1. **Render (`backend-ai/render.yaml`)**: One-click blueprint with pre-configured health checks and environment settings.
2. **Fly.io (`backend-ai/fly.ai.toml`)**: Dedicated configuration matching your existing `skillvault-api.fly.dev` architecture with 1GB RAM machine and HTTPS auto-routing.
3. **Neon Cloud Database (`scripts/sync_to_neon.py`)**: Automatic synchronizer keeping all 4,842 chunks and HNSW indexes live on Neon.

---

## 9. Next.js 16 Frontend UI Components

Located in `frontend/src/`:
1. **Hook (`lib/useAIAssistant.ts`)**: Native `fetch` + `ReadableStream` parser handling streaming frames with cancellation via `AbortController`.
2. **Floating Assistant (`components/chat/FloatingAssistant.tsx`)**:
   - Floating launcher pill: *"Ask SkillVault AI"*.
   - **Full-Screen Studio Toggle**: Expands to `w-full max-w-6xl` modal view with centered reading layout.
   - **SkillVault Code Blocks**: Language badges (`</> JavaScript`), one-click Copy button with `Copied!` state, and syntax highlighting via `rehype-highlight`.
   - **Clickable Citation Cards**: Expandable badge displaying verified lesson titles, section headings, and confidence percentages.
   - **Context Badge**: Auto-detects active curriculum track (e.g. React vs Global).

---

## 10. Dual Architecture: Native Python & LangChain

Both implementations exist side-by-side in `backend-ai/app/`:

| Component | Native Python (`app/rag/`) | LangChain (`app/rag_langchain/`) |
| :--- | :--- | :--- |
| **AST Chunker** | `app/rag/ast_chunker.py` (Custom AST / Regex) | `app/rag_langchain/ast_chunker.py` (Extends `TextSplitter`, returns `Document`s) |
| **Retriever** | `app/rag/hybrid_retriever.py` (Raw `AsyncOpenAI` + asyncpg) | `app/rag_langchain/hybrid_retriever.py` (Extends `BaseRetriever`, returns `List[Document]`) |
| **Ingestion** | `app/rag/ingestion.py` (Direct batching & raw vectors) | `app/rag_langchain/ingestion.py` (Batches `Document`s + `Embeddings.aembed_documents`) |
| **Chain / LCEL** | Direct streaming in `app/main.py` | `app/rag_langchain/chain.py` (`prompt \| chat_model \| StrOutputParser`) |
| **Chat Service** | Alternative endpoint / fallback | **Active in `app/main.py`** powering the live SSE chat assistant |
| **Verification** | `python backend-ai/test_search.py` | `python backend-ai/test_search_langchain.py` |

---

## 11. PDF Ingestion & Retrieval Pipeline (`resources/pdfs`)

The platform includes full support for ingesting and retrieving from enterprise PDFs, technical books, and guidebooks located in `resources/pdfs/`:

### 11.1 Indexed PDF Catalog (3,989 Chunks)
| Document Title | Pages | Chunks | Key Topics Covered |
| :--- | :---: | :---: | :--- |
| **SkillVault AI Assistant Masterclass** | 200 | 377 | Multi-Tenant RAG, SSE Streaming, HNSW vs IVFFlat, LangGraph |
| **Angular From Theory To Practice** | 692 | 753 | Components, Directives, Dependency Injection, Routing |
| **Angular for Enterprise Applications (2024)** | 593 | 591 | Micro-frontends, State Management, Architecture Patterns |
| **Spring Boot 3 Official Reference Guide** | 973 | 1,105 | Auto-configuration, Actuator, WebFlux, Cloud Integration |
| **Spring Boot Up & Running (O'Reilly)** | 330 | 355 | Cloud-native Java/Kotlin, Reactive APIs, Observability |
| **Spring Security In Action (Manning)** | 562 | 617 | AuthenticationManager, Provider, OAuth2, Filter Chains |
| **The Ultimate Guide to Angular Evolution (v19)** | 182 | 191 | Angular 19 Signals, Standalone Components, SSR Hydration |

### 11.2 Ingestion & Retrieval Commands
```bash
cd backend-ai
source venv/bin/activate

# 1. Ingest all PDFs (Idempotent - skips already indexed files)
python -m app.rag_langchain.pdf_ingestion resources/pdfs

# 2. Ingest a specific single PDF
python -m app.rag_langchain.pdf_ingestion resources/pdfs Spring_Security_In_Action_Manning.pdf

# 3. Test PDF Hybrid Retrieval (HNSW + BM25 + FlashRank Reranker)
python test_search_pdf.py
```

---

## 12. Runbook: How to Start the System

### 1. Ensure Local PostgreSQL & Ollama are Running
```bash
# Verify PostgreSQL is active
pg_isready -h localhost -p 5432

# Verify Ollama has the models
ollama list
# Should list: nomic-embed-text, llama3.2
```

### 2. Start the AI Microservice
```bash
cd backend-ai
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start the Next.js Frontend
```bash
cd frontend
npm run dev
```

Visit **`http://localhost:3000`**, click **"Ask SkillVault AI"**, and enjoy your private, local, production-grade RAG assistant!
