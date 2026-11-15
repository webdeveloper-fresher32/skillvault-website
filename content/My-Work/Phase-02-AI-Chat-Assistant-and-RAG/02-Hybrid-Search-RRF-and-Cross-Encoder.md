# Two-Stage Hybrid Retrieval, RRF & Cross-Encoder Reranking

> **Module**: Phase 02 — Multi-Tenant AI Support & RAG Platform | **Lesson**: 02  
> **Tech Stack**: PostgreSQL 16 (`pgvector`, `tsvector`), Reciprocal Rank Fusion (RRF), Cross-Encoder

---

## 1. Why Pure Semantic Search Fails in Enterprise SaaS

Vector embeddings represent semantic concepts, not exact literal tokens. In enterprise SaaS, this causes two major failure modes:
1. **The Exact-Token Failure**: If a customer queries `"How do I resolve ERR_BILLING_TIMEOUT_504?"`, dense embeddings map `"ERR_BILLING_TIMEOUT_504"` to generic concepts like "payment error" or "server failure", returning irrelevant chunks that do not contain the specific error code.
2. **The "Lost in the Middle" Dilemma**: Supplying 20 raw chunks to an LLM context window causes severe attention degradation (Liu et al., 2023), increases latency by 4x, and costs 5x more.

---

## 2. The Two-Stage Hybrid Retrieval Pipeline

```
                             User Query
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       Dense Semantic Search            Sparse Lexical Search
   (pgvector HNSW Cosine Distance)   (Postgres Full-Text Search ts_rank)
                 │                               │
                 │ Top-25 Chunks                 │ Top-25 Chunks
                 └───────────────┬───────────────┘
                                 ▼
                     Reciprocal Rank Fusion (RRF)
                  RRF_Score = 1 / (60 + Rank_dense) 
                            + 1 / (60 + Rank_sparse)
                                 │
                                 ▼
                       Top-20 Fused Candidates
                                 │
                                 ▼
                     Cross-Encoder Reranker
                 (ms-marco-MiniLM-L-6-v2)
                 Deep Query-Document Interaction
                                 │
                                 ▼
                  Confidence Gate (Score >= 0.65)
                                 │
                                 ▼
                    Top-4 Context Snippets to LLM
```

---

## 3. SQL Implementation: Dense + Sparse + RRF

We execute the first stage directly in PostgreSQL, combining the HNSW vector index and the GIN full-text index in a single query:

```sql
WITH dense_search AS (
    SELECT 
        id, 
        content, 
        metadata,
        ROW_NUMBER() OVER (ORDER BY embedding <=> :query_vector) AS dense_rank
    FROM document_chunks
    WHERE organization_id = :org_id
    ORDER BY embedding <=> :query_vector
    LIMIT 25
),
sparse_search AS (
    SELECT 
        id, 
        content, 
        metadata,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(fts_vector, plainto_tsquery('english', :query)) DESC) AS sparse_rank
    FROM document_chunks
    WHERE organization_id = :org_id
      AND fts_vector @@ plainto_tsquery('english', :query)
    ORDER BY ts_rank_cd(fts_vector, plainto_tsquery('english', :query)) DESC
    LIMIT 25
),
fused_results AS (
    SELECT 
        COALESCE(d.id, s.id) AS id,
        COALESCE(d.content, s.content) AS content,
        COALESCE(d.metadata, s.metadata) AS metadata,
        COALESCE(1.0 / (60 + d.dense_rank), 0.0) +
        COALESCE(1.0 / (60 + s.sparse_rank), 0.0) AS rrf_score
    FROM dense_search d
    FULL OUTER JOIN sparse_search s ON d.id = s.id
    ORDER BY rrf_score DESC
    LIMIT 20
)
SELECT id, content, metadata, rrf_score FROM fused_results;
```

---

## 4. Stage 2: Cross-Encoder Reranking in Python

The 20 fused candidates are scored by a lightweight cross-encoder (`ms-marco-MiniLM-L-6-v2`). Unlike bi-encoders that encode query and document independently, a cross-encoder evaluates the query and chunk simultaneously through full joint self-attention:

```python
# app/services/reranker.py
from sentence_transformers import CrossEncoder
from typing import List, Dict, Any

class ProductionReranker:
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model = CrossEncoder(model_name)

    def rerank(
        self, 
        query: str, 
        candidates: List[Dict[str, Any]], 
        threshold: float = 0.65,
        top_k: int = 4
    ) -> List[Dict[str, Any]]:
        if not candidates:
            return []

        # Prepare pairs for joint cross-attention
        pairs = [[query, c["content"]] for c in candidates]
        scores = self.model.predict(pairs)

        for i, candidate in enumerate(candidates):
            candidate["relevance_score"] = float(scores[i])

        # Sort descending by relevance score
        candidates.sort(key=lambda x: x["relevance_score"], reverse=True)

        # Apply confidence gate to prevent hallucination from irrelevant chunks
        filtered = [c for c in candidates if c["relevance_score"] >= threshold]

        return (filtered or candidates)[:top_k]
```
