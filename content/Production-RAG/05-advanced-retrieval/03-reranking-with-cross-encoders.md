> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 5.2: Hybrid Search with PostgreSQL + pgvector (Reciprocal Rank Fusion)](02-hybrid-search-with-rrf.md) | ➡️ [Module 5.4: Query Rewriting, Expansion & HyDE](04-query-rewriting.md)

---

# Module 5 — Lesson 3: Reranking in Production RAG

In the last lesson, we combined semantic search and keyword search using **hybrid search**. Now let's solve the next problem: *What if retrieval finds the right information, but ranks it too low?*

## 1. What is reranking?

![Two-Stage Retrieval & Cross-Encoder Reranking Architecture](/images/production-rag/reranking-cross-encoder.png)

Imagine a user asks:

> “How did we prevent duplicate Stripe webhook processing?”

Your retriever returns these chunks:

### 1

Initial rank

**Chunk A — Score: 0.82**
“Stripe webhooks notify applications about events such as successful payments and invoice updates.”

`Related, but broad`

---

### 2

Initial rank

**Chunk B — Score: 0.76**
“We used the Stripe event ID as an idempotency key to deduplicate webhook events and prevent repeated processing.”

`Direct answer`

A first-stage retriever may rank Chunk A higher because it matches several query terms. But Chunk B directly answers the question.

**Reranking** takes the initial candidates and scores them again using a model that evaluates the relationship between the query and each candidate's content.

The goal is to place the most useful chunks first—not to generate the answer itself.

## 2. How does a reranker work?

```
[User Query]
("How do I prevent duplicate webhook processing?")
       │
       ▼
[First-Stage Retrieval: pgvector / Hybrid Search]
(Fast search across 1,000,000 chunks ──► 20 to 50 candidate chunks)
       │
       ▼
[Cross-Encoder Reranker]
(Joint Query + Document attention scoring · e.g. bge-reranker-base)
       │
       ▼
[Top-k Filtered Chunks]
(Keep best 3 to 5 chunks ──► Pass to LLM Generation Context)
```

There are two important model types here:

| Feature | Embedding retriever | Cross-encoder reranker |
|---|---|---|
| How it works | Encodes query and documents separately | Evaluates the query-document pair together |
| Speed | Usually faster for large collections | More expensive per candidate |
| Best use | Search thousands or millions of chunks | Reorder a smaller candidate set |
| Output | Vector similarity or distance | Relevance score |

Think of retrieval as finding 50 potentially relevant books. Reranking is reading the relevant passages from those books and deciding which five best answer the question.

## 3. Build a reranker with Python

We'll use a pretrained cross-encoder from Sentence Transformers: `cross-encoder/ms-marco-MiniLM-L-6-v2`.

### Step A — Create `app/reranker.py`

```python
from functools import lru_cache

from sentence_transformers import CrossEncoder

MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"

@lru_cache(maxsize=1)
def get_reranker() -> CrossEncoder:
    # Loads once per running Python process.
    return CrossEncoder(MODEL_NAME)

def rerank_chunks(
    query: str,
    candidates: list[dict],
    top_k: int = 5,
) -> list[dict]:
    if not query.strip() or not candidates or top_k <= 0:
        return []

    model = get_reranker()

    # Each pair is evaluated jointly by the cross-encoder.
    pairs = [
        (query, candidate["content"])
        for candidate in candidates
    ]

    scores = model.predict(
        pairs,
        show_progress_bar=False,
    )

    ranked = []

    for candidate, score in zip(candidates, scores):
        result = dict(candidate)
        result["rerank_score"] = float(score)
        ranked.append(result)

    ranked.sort(
        key=lambda item: item["rerank_score"],
        reverse=True,
    )

    return ranked[:top_k]
```

This function expects each candidate to contain a `content` field, matching the PostgreSQL schema and hybrid-search example from our previous lesson.

### Step B — Run a standalone demo

Create `app/rerank_demo.py`:

```python
from app.reranker import rerank_chunks

query = "How did we prevent duplicate Stripe webhook processing?"

candidates = [
    {
        "id": "chunk-1",
        "content": (
            "Stripe sends webhook events about payment "
            "successes, failures, and invoice updates."
        ),
    },
    {
        "id": "chunk-2",
        "content": (
            "We used the Stripe event ID as a deduplication "
            "key so the same webhook event would not be "
            "processed repeatedly."
        ),
    },
    {
        "id": "chunk-3",
        "content": (
            "PostgreSQL stores subscription records and "
            "customer billing information."
        ),
    },
    {
        "id": "chunk-4",
        "content": (
            "An idempotent webhook handler ensures retrying "
            "the same event does not duplicate its effects."
        ),
    },
]

results = rerank_chunks(
    query=query,
    candidates=candidates,
    top_k=3,
)

for rank, result in enumerate(results, start=1):
    print(
        f"\nRank: {rank}"
        f"\nScore: {result['rerank_score']:.4f}"
        f"\nID: {result['id']}"
        f"\nContent: {result['content']}"
    )
```

Run it from your project root, with your virtual environment activated:

```bash
python -m pip install -U sentence-transformers
python -m app.rerank_demo
```

The first run may download the reranker model, so it can take a little longer. You should expect the two chunks about deduplication and idempotency to rank highly, though the exact order and scores depend on the model.

**Important:** reranker scores are not necessarily probabilities. Don't interpret a score of `0.8` as an 80% chance that a chunk is correct.

## 4. Connect reranking to your existing retrieval pipeline

Once the demo works, replace the hard-coded candidates with your actual PostgreSQL hybrid search results.

For example, create `app/rerank_retrieval.py`:

```python
from app.hybrid_search import hybrid_search
from app.reranker import rerank_chunks

def retrieve_and_rerank(
    query: str,
    tenant_id: str | None = None,
    source: str | None = None,
    candidate_k: int = 20,
    top_k: int = 5,
) -> list[dict]:
    # Stage 1: broad retrieval.
    candidates = hybrid_search(
        query=query,
        top_k=candidate_k,
        tenant_id=tenant_id,
        source=source,
    )

    # Stage 2: precise relevance ranking.
    return rerank_chunks(
        query=query,
        candidates=candidates,
        top_k=top_k,
    )

if __name__ == "__main__":
    query = "How did we prevent duplicate Stripe webhook processing?"

    results = retrieve_and_rerank(
        query=query,
        candidate_k=20,
        top_k=5,
    )

    for rank, result in enumerate(results, start=1):
        print(f"\nRank: {rank}")
        print(f"Rerank score: {result['rerank_score']:.4f}")
        print(f"Chunk ID: {result['id']}")
        print(f"Content: {result['content']}")
```

Run:

```bash
python -m app.rerank_retrieval
```

This uses your existing hybrid search, so you don't need to rebuild your database. Tenant and source filters are passed through to the initial retrieval stage.

## 5. Production considerations

- **Retrieve more candidates than you return:** start by testing 20 candidates and keeping the best 5. Tune these values using your evaluation set.
- **Watch latency:** reranking 20 candidates is more expensive than embedding a query once. Measure end-to-end response time.
- **Keep access controls intact:** reranking must not become a way to expose chunks from another tenant.
- **Evaluate, don't assume:** compare `Hit Rate@K`, `MRR@K`, and answer quality before and after reranking.
- **Handle long chunks carefully:** cross-encoders have token limits. Very long passages may be truncated, so appropriate chunking still matters.

## 6. Your mini-exercise

  Check your understanding
  1. Why shouldn't we use a cross-encoder to search an entire database containing millions of chunks?
  setAnswers(old=>old.map((x,i)=>i===0?v:x))} direction="col">
- [ ] It cannot evaluate text relevance
- [ ] Scoring every query-document pair would be too expensive and slow
- [ ] It only works with PostgreSQL

---

  2. Does a reranker generate the final natural-language answer?
  setAnswers(old=>old.map((x,i)=>i===1?v:x))} direction="col">
- [ ] Yes
- [ ] No — it reorders candidate chunks

---

  3. What should we do if the correct chunk isn't among the initial retrieval candidates?
  setAnswers(old=>old.map((x,i)=>i===2?v:x))} direction="col">
- [ ] Increase the reranker score
- [ ] Improve retrieval, query formulation, or indexing; reranking cannot recover a missing chunk

**Next lesson — Query rewriting.** We'll learn how to transform vague or conversational user questions into better search queries before sending them to the retriever.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 5.2: Hybrid Search with PostgreSQL + pgvector (Reciprocal Rank Fusion)](02-hybrid-search-with-rrf.md) | ➡️ [Next: Module 5.4: Query Rewriting, Expansion & HyDE](04-query-rewriting.md)
