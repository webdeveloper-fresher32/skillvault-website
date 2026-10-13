# Production RAG Engineering Cheatsheet

A concise technical reference for building, tuning, and operating enterprise RAG pipelines with Python, PostgreSQL + pgvector, and FastAPI.

---

## ⚡ Core Formulas & Algorithms

### 1. Reciprocal Rank Fusion (RRF)
Merges dense vector rankings and BM25 full-text keyword rankings without score normalization:
```
RRF_Score(d) = Σ [ 1 / (60 + Rank_system(d)) ]
```

### 2. Cosine Distance in pgvector
In `pgvector`, the `<=>` operator computes cosine distance (`1 - cosine_similarity`):
```sql
SELECT id, content, 1 - (embedding <=> :query_vector) AS cosine_similarity
FROM document_chunks
WHERE tenant_id = :tenant_id
ORDER BY embedding <=> :query_vector
LIMIT 5;
```

### 3. HNSW Index Parameters in PostgreSQL
```sql
CREATE INDEX idx_chunks_hnsw 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Tune search recall vs speed per session:
SET hnsw.ef_search = 40; -- default is 40 (increase to 100 for higher recall)
```

---

## 🛠️ Production Pipeline Architecture

| Stage | Technology / Component | Latency Target | Core Objective |
| :--- | :--- | :--- | :--- |
| **Ingestion** | SHA-256 Checksum + Async Worker | Background | Deduplicate, parse PDF/MD, idempotent upsert |
| **Chunking** | Recursive / Parent-Document | Background | Preserve syntactic context (128 child / 1000 parent) |
| **Embeddings** | `text-embedding-3-small` / BGE | ~15ms (cached: <1ms) | Vector representation in shared semantic space |
| **Candidate Retrieval** | pgvector HNSW + `tsvector` BM25 | <25ms | Retrieve top 50 candidates via Reciprocal Rank Fusion |
| **Reranking** | `bge-reranker-large` / Cohere | <50ms | Cross-attention scoring to prune 50 down to 4 chunks |
| **Compression** | Contextual Prompt Compressor | <10ms | Remove extraneous tokens, reduce LLM context costs |
| **Generation** | FastAPI + vLLM / OpenAI | Streaming (~200ms TTFT) | Strictly grounded response with citation brackets |
| **Validation** | Regex Validator + Citation Check | <5ms | Guarantee all inline citations exist in context |

---

## 🔐 Multi-Tenant Security & Idempotency Checklist
- [x] Every query enforces `WHERE tenant_id = :tenant_id`
- [x] Checksum check `SELECT id FROM documents WHERE checksum = :hash` before re-indexing
- [x] Atomic transactions: `DELETE FROM chunks WHERE doc_id = :id` before inserting updated chunks
- [x] Rate limiting: Token bucket per API key with Redis sliding window
- [x] Strict system prompt: "Answer ONLY using provided `<context>`. If not present, state insufficient info."
