> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 5.1: Similarity Search vs. Keyword Search (Dense vs. Sparse)](01-similarity-vs-keyword-search.md) | ➡️ [Module 5.3: Cross-Encoder Reranking in Production RAG](03-reranking-with-cross-encoders.md)

---

# Module 5 — Advanced Retrieval Strategies

## Lesson 2: Hybrid Search with PostgreSQL + pgvector

In the previous lesson, we learned that **keyword search and semantic search solve different problems**. Now let's combine them into a single retrieval system, as production RAG applications often need both.

### 1. Why do we need hybrid search?

![Hybrid Search (BM25 Keyword Search + Dense Vector Search) with Reciprocal Rank Fusion](/images/production-rag/hybrid-search-rrf.png)

Imagine your knowledge base contains these chunks:

- Chunk A: “Use Stripe event IDs to prevent duplicate webhook processing.”
- Chunk B: “The error code `ERR-4821` indicates failed payment authorization.”
- Chunk C: “An invoice payment can fail when the customer’s card is declined.”

Now consider these queries:

| User query | Best search approach |
|---|---|
| “How do I prevent duplicate webhook processing?” | Semantic search |
| “Find `ERR-4821`” | Keyword search |
| “Why did my Stripe invoice payment fail?” | Both |

**Semantic search** understands related meanings, even when the wording differs. **Keyword search** is strong at exact terms, identifiers, error codes, and product names.

Hybrid search combines both so that one method can compensate when the other misses a relevant chunk.

```
[User Query]
("Why did my Stripe invoice payment fail?")
       │
       ▼
[Dual Search Pipeline]
(pgvector Semantic Embeddings ──► PostgreSQL Full-Text Keyword Search)
       │
       ▼
[Reciprocal Rank Fusion (RRF)]
(Combine result ranks using RRF formula: 1 / (60 + rank))
       │
       ▼
[Final Unified Chunks]
(Top-k blended results ──► LLM Generation ──► Grounded Answer)
```

## 2. Implement hybrid search

We'll use the PostgreSQL database you already set up. No new vector database is needed.

### Step A — Understand the two ranking methods

**Semantic ranking:** compares the query embedding with each chunk embedding using cosine distance.

**Keyword ranking:** PostgreSQL converts text into searchable lexemes and ranks matching documents using `ts_rank_cd()`.

**RRF ranking:** combines the *positions* of results, instead of adding raw scores that have different scales.

The RRF formula is:

\[
\operatorname{RRF}(d)=\sum_{r \in R}\frac{1}{k+\operatorname{rank}_r(d)}
\]

Here, \(d\) is a chunk, \(R\) is the set of ranked result lists, and \(k\) is a constant (commonly 60). A chunk ranked highly by both methods receives a stronger combined score.

### Step B — Create `app/hybrid_search.py`

This version uses your existing `rag_chunks` schema: `id`, `content`, `embedding`, and `metadata`. It also supports optional tenant and source filters.

```python
from collections import defaultdict

from pgvector.psycopg import register_vector
from psycopg.rows import dict_row

from app.embedding_service import embed_query
from app.pgvector_store import get_connection

def hybrid_search(
    query: str,
    top_k: int = 5,
    tenant_id: str | None = None,
    source: str | None = None,
    candidate_k: int = 20,
    rrf_k: int = 60,
):
    if not query.strip():
        return []

    # Use the same filters for BOTH search methods.
    filters = []
    params = []

    if tenant_id is not None:
        filters.append("metadata->>'tenant_id' = %s")
        params.append(tenant_id)

    if source is not None:
        filters.append("metadata->>'source' = %s")
        params.append(source)

    where_sql = (
        " AND ".join(filters)
        if filters
        else "TRUE"
    )

    query_vector = embed_query(query)
    results_by_id = {}
    rrf_scores = defaultdict(float)

    with get_connection() as conn:
        register_vector(conn)

        # 1. Semantic search: nearest embeddings first.
        semantic_sql = f"""
            SELECT id, content, metadata
            FROM rag_chunks
            WHERE {where_sql}
            ORDER BY embedding <=> %s
            LIMIT %s
        """

        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                semantic_sql,
                params + [query_vector, candidate_k],
            )
            semantic_results = cur.fetchall()

        for rank, row in enumerate(semantic_results, start=1):
            results_by_id[row["id"]] = dict(row)
            rrf_scores[row["id"]] += 1 / (rrf_k + rank)

        # 2. Keyword search: PostgreSQL full-text ranking.
        lexical_sql = f"""
            SELECT
                id,
                content,
                metadata,
                ts_rank_cd(
                    to_tsvector('english', content),
                    websearch_to_tsquery('english', %s)
                ) AS keyword_score
            FROM rag_chunks
            WHERE {where_sql}
              AND to_tsvector('english', content)
                  @@ websearch_to_tsquery('english', %s)
            ORDER BY keyword_score DESC
            LIMIT %s
        """

        lexical_params = [query] + params + [query, candidate_k]

        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(lexical_sql, lexical_params)
            lexical_results = cur.fetchall()

        for rank, row in enumerate(lexical_results, start=1):
            results_by_id[row["id"]] = dict(row)
            rrf_scores[row["id"]] += 1 / (rrf_k + rank)

    # 3. Combine the rankings using Reciprocal Rank Fusion.
    ranked_ids = sorted(
        rrf_scores,
        key=rrf_scores.get,
        reverse=True,
    )

    return [
        {
            **results_by_id[chunk_id],
            "rrf_score": rrf_scores[chunk_id],
        }
        for chunk_id in ranked_ids[:top_k]
    ]

if __name__ == "__main__":
    results = hybrid_search(
        query=
1. How do I prevent duplicate Stripe webhook events?
        top_k=5,
    )

    for result in results:
        print(f"\nRRF score: {result['rrf_score']:.4f}")
        print(f"ID: {result['id']}")
        print(f"Content: {result['content']}")
        print(f"Metadata: {result['metadata']}")
```

### Step C — Add a full-text search index

Without an index, PostgreSQL may need to scan many chunks to find keyword matches. Create a GIN index once:

```sql
CREATE INDEX IF NOT EXISTS rag_chunks_content_fts_idx
ON rag_chunks
USING GIN (to_tsvector('english', content));
```

You can run this in your PostgreSQL SQL client or `psql`. The existing HNSW embedding index continues to serve vector search.

### Step D — Run it

Activate your virtual environment, then run:

```bash
python -m app.hybrid_search
```

If your existing `get_connection()` helper uses a different connection setup, keep its established configuration rather than creating a second database connection implementation.

You should see the highest-ranked chunks printed with their combined `rrf_score`. The exact results depend on your indexed documents.

One important detail: **the RRF score is a ranking score, not a probability or confidence percentage.** A higher score means the chunk ranked well across the retrieval methods.

## 3. Your practical exercise

Try these three queries against your own documents:

  Hybrid search checklist

1. Search for a specific error code or exact technical identifier.
2. Search for a question expressed in different words from your documents.
3. Compare the results with semantic-only search and note which relevant chunks hybrid search adds.
- [ ] setDone(old => old.map((x,j) => i === j ? v : x))} lineThrough={false}>{task}

**Production note:** apply tenant and source filters to both retrieval branches, as this implementation does. Otherwise, combining rankings can accidentally introduce chunks that should not be visible to the current user.

## Next lesson: Reranking

Hybrid search improves which chunks we retrieve. **Reranking improves the order of those chunks** by evaluating how relevant each candidate is to the original query, often using a cross-encoder model.

The next pipeline will be:

`Hybrid search → Retrieve top 20–50 chunks → Rerank → Keep top 3–5 → LLM`

This is useful when the initial retrieval finds relevant material but ranks a less relevant chunk above the best answer.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 5.1: Similarity Search vs. Keyword Search (Dense vs. Sparse)](01-similarity-vs-keyword-search.md) | ➡️ [Next: Module 5.3: Cross-Encoder Reranking in Production RAG](03-reranking-with-cross-encoders.md)
