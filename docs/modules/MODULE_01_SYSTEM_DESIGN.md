# Module 1: Requirements, System Topology & Master Architectural Design

| Specification | Details |
| :--- | :--- |
| **Module Number** | 01 of 12 |
| **Topic** | Enterprise Requirements, Multi-Tenant Topology, Relational Schemas & Master ADRs |
| **Target System** | TaskFlow AI SaaS Platform |
| **Engineering Level** | Staff / Principal Full Stack + AI Systems Architect |

---

## 1. Functional & Non-Functional Requirements

### 1.1 Multi-Tenant Organization Isolation Invariants
1. **Tenant Bounded Context:** An organization is an isolated tenant identified by a UUID (`organization_id`). Users belong to one or more organizations via `organization_members`.
2. **Zero Vector Bleed:** Document chunks, vector embeddings, conversations, tasks, and audit logs are physically or logically partitioned by `organization_id`. A query executed by a member of Org A must mathematically never return vectors or records belonging to Org B.
3. **Role-Based Access Control (RBAC):**
   * `OWNER`: Full administrative, billing, tool execution, and document ingestion privileges.
   * `ADMIN`: Can manage team members, upload documentation, and run all tools except billing cancellations.
   * `MEMBER`: Can query the knowledge base, create/update tasks, view team projects.
   * `VIEWER`: Read-only queries, no state mutations allowed.

### 1.2 Dual Core AI Workflows
* **Workflow A (Knowledge RAG):**
  $$\text{User Query} \longrightarrow \text{Intent Detection} \longrightarrow \text{Hybrid Search (HNSW + BM25)} \longrightarrow \text{RRF Fusion} \longrightarrow \text{FlashRank} \longrightarrow \text{LLM Synthesizer} \longrightarrow \text{Cited SSE Stream}$$
* **Workflow B (Application Action Execution):**
  $$\text{User Query} \longrightarrow \text{Intent Detection} \longrightarrow \text{RBAC Validation} \longrightarrow \text{Pydantic Tool Match} \longrightarrow \text{HITL Gate (if write/destructive)} \longrightarrow \text{Node.js API} \longrightarrow \text{Result Synthesizer}$$

### 1.3 Production Service-Level Objectives (SLOs)
* **Time-to-First-Token (TTFT):** $< 800\text{ms}$ (p95) on streaming responses.
* **Full Answer Completion:** $< 4.0\text{s}$ for average technical queries.
* **Retrieval Recall@5:** $\ge 95\%$ on internal documentation benchmarks.
* **Hallucination Rate:** $< 3\%$ across verified ground-truth test datasets.
* **Concurrent Capacity:** 1,000 active concurrent streaming sessions per cluster.

---

## 2. Complete Relational Database Schema (PostgreSQL 16 + pgvector)

```sql
-- Core Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Organizations (Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan_tier VARCHAR(50) DEFAULT 'FREE' CHECK (plan_tier IN ('FREE', 'PRO', 'ENTERPRISE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Organization Memberships (RBAC)
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- 4. Projects & Tasks
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE')),
    priority VARCHAR(50) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. RAG Documents & Embeddings
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(512),
    file_type VARCHAR(50) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding VECTOR(1536) NOT NULL,
    tsv_content TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chunks_embedding_hnsw ON document_chunks 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_chunks_tsv ON document_chunks USING gin(tsv_content);
CREATE INDEX idx_chunks_org ON document_chunks(organization_id);

-- Enforce Row-Level Security
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_chunks ON document_chunks
    FOR ALL
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 6. Conversations & Messages
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Conversation',
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_results JSONB,
    citations JSONB,
    tokens_used INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Audit Trail
CREATE TABLE ai_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    parameters JSONB NOT NULL,
    execution_status VARCHAR(50) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 3. Master Architectural Decision Records (ADRs)

| Component | Selected Option | Rejected Alternatives | Rejection Justification |
| :--- | :--- | :--- | :--- |
| **Vector DB** | **pgvector (HNSW)** | Pinecone, Milvus, Qdrant, IVFFlat | Eliminates dual-write sync issues; provides cross-table ACID cascades; RLS kernel tenant isolation. |
| **Retrieval Fusion** | **Reciprocal Rank Fusion (RRF $k=60$)** | Convex Sum, Pure Dense, Pure BM25 | Score-scale invariant; parameter-free; avoids normalizing unbounded BM25 scores. |
| **Reranker** | **FlashRank (ONNX MiniLM)** | Cohere API, BGE-Large, RankGPT, MMR | Sub-25ms in-process CPU inference; \$0 API cost; zero customer document leakage to cloud. |
| **Agent State** | **LangGraph** | LangChain AgentExecutor, CrewAI, Python Loop | Cyclic self-correction loops; typed Pydantic state; built-in HITL checkpoints. |
| **Streaming** | **Server-Sent Events (SSE)** | WebSockets, Long Polling, gRPC-Web | Native HTTP unidirectional streaming; typed event multiplexing; works with standard JWT auth. |
| **Topology** | **Decoupled Node.js + FastAPI** | Monolithic Python, Monolithic Node, Edge Fns | Node.js handles fast I/O & CRUD; Python handles PyTorch/LangGraph; independent horizontal scaling. |
| **Isolation** | **PostgreSQL Kernel RLS** | App-only `WHERE`, Schema-per-tenant, DB-per-tenant | Kernel-enforced guarantee; zero cross-tenant leak on human code error; sustainable operational overhead. |
| **Async Queue**| **BullMQ + Redis** | Celery + RabbitMQ, In-Memory Async | TypeScript-native; Redis in-memory speed; durable retries with exponential backoff. |
| **Memory** | **Sliding Window + Summary** | Unbounded History, Hard Cutoff, Vector Memory | Bounds prompt token overhead while preventing abrupt factual amnesia. |
| **Caching** | **Redis Semantic Cache ($\ge 0.96$)** | Exact MD5 Hash, Levenshtein, No Caching | Absorbs semantic variants of identical questions; sub-50ms latency at \$0 LLM cost. |
| **Tool Safety**| **Pydantic v2 + HITL Gate** | Unvalidated JSON, Direct `eval()`, Auto Mutate | Strict type safety; prevents catastrophic hallucinations on destructive operations. |
