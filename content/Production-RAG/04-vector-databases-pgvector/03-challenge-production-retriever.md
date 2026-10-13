> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 4.2: Vector Database Quiz & Core Concepts](02-quiz-and-core-concepts.md) | ➡️ [Module 4.4: Task 1 — Multi-Tenant Source & Metadata Filtering](04-task-1-source-filtering.md)

---

Excellent! Your PostgreSQL retrieval, tenant isolation, and idempotent ingestion are all working. That means you've completed the core Module 4 practical successfully. Let's move to the next challenge: making your retriever more reliable and closer to a production RAG system.

# Module 4 — Challenge 2: Build a production-ready retriever

**Completed**
Vector insertion, semantic retrieval, tenant filtering, stable IDs

---

**Next**
Metadata filtering, similarity thresholds, citations, and retrieval evaluation

## 1. Improve your search function

Your current `search_chunks()` retrieves the nearest chunks. But in production, the nearest chunk might still be irrelevant.

For example, if someone asks about refund policies and your database only contains Python tutorials, vector search may still return the closest Python chunk. You need a way to reject weak matches.

With pgvector, the cosine distance operator is:

```sql
embedding <=> query_vector
```

For normalized embeddings:

\[
\text{cosine similarity}=1-\text{cosine distance}
\]

Higher similarity means a closer match.

### Update `app/pgvector_store.py`

Replace your existing `search_chunks()` function with this version. It supports a similarity threshold, tenant filtering, and optional source filtering.

```python

from app.embedding_service import embed_query

def search_chunks(
    query: str,
    top_k: int = 5,
    tenant_id: str | None = None,
    source: str | None = None,
    min_similarity: float = 0.30,
) -> list[dict]:
    if not 0.0 <= min_similarity <= 1.0:
        raise ValueError("min_similarity must be between 0 and 1")

    query_vector = embed_query(query)

    conditions = []
    params = []

    if tenant_id is not None:
        conditions.append("metadata->>'tenant_id' = %s")
        params.append(tenant_id)

    if source is not None:
        conditions.append("metadata->>'source' = %s")
        params.append(source)

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    sql = f"""
        SELECT
            id,
            content,
            metadata,
            embedding <=> %s AS distance
        FROM rag_chunks
        {where_clause}
        ORDER BY embedding <=> %s
        LIMIT %s
    """

    # First vector is used for the selected distance;
    # second vector orders the nearest results.
    params = [query_vector, *params, query_vector, top_k]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

    results = []

    for row in rows:
        distance = float(row[3])
        similarity = 1.0 - distance

        if similarity < min_similarity:
            continue

        results.append({
            "id": row[0],
            "text": row[1],
            "metadata": row[2],
            "distance": distance,
            "similarity": similarity,
        })

    return results

```

This assumes the `get_connection()` helper from your existing `pgvector_store.py` remains in place.

**Important:** the SQL string above is assembled only from fixed query fragments and the number of optional conditions; user-supplied values remain parameterized. The threshold `0.30` is a starting point for experimentation, not a universal production value. Similarity scores vary by model, dataset, and query.

One further optimization: this implementation applies the threshold in Python after retrieving up to `top_k` rows. For large datasets, push the distance threshold into SQL and benchmark the query plan.

## 2. Add source citations to retrieved context

A RAG system should be able to tell the LLM where each piece of information came from.

Try this in your test script:

```python

from dotenv import load_dotenv
load_dotenv()

from app.pgvector_store import search_chunks

question = 
1. How do I prevent a webhook event from being processed twice?
results = search_chunks(
    query=question,
    top_k=5,
    tenant_id=
1. company-a
    min_similarity=0.30,
)

if not results:
    print("No sufficiently relevant context found.")
else:
    for result in results:
        metadata = result["metadata"]

        source = metadata.get("source", "Unknown source")
        page = metadata.get("page", "Unknown page")

        print(
            f
1. [Source: {source}, Page: {page}, 
            f
1. Similarity: {result['similarity']:.3f}]
        )
        print(result["text"])
        print()

```

This is a first step toward grounded answers. Later, when you add an LLM, pass the retrieved chunks and their source metadata into the prompt, then require the answer to cite only sources actually present in that context. A citation label alone doesn't prove that the answer is supported.

## 3. Add a retrieval evaluation test

Now let's test the behavior instead of simply checking whether the script runs.

Create `app/evaluate_retrieval.py`:

```python

from dotenv import load_dotenv
load_dotenv()

from app.pgvector_store import search_chunks

tests = [
    {
        "question": 
1. How can duplicate webhook events be prevented?
        "tenant_id": 
1. company-a
        "expected_keyword": 
1. idempotency
    },
    {
        "question": 
1. What happens when a subscription changes?
        "tenant_id": 
1. company-a
        "expected_keyword": 
1. subscription
    },
]

for test in tests:
    results = search_chunks(
        query=test["question"],
        top_k=5,
        tenant_id=test["tenant_id"],
        min_similarity=0.0,
    )

    combined_text = " ".join(
        result["text"] for result in results
    ).lower()

    passed = test["expected_keyword"] in combined_text

    print(f"\nQuestion: {test['question']}")
    print(f"Expected keyword: {test['expected_keyword']}")
    print(f"Results returned: {len(results)}")
    print(f"Keyword check: {'PASS' if passed else 'FAIL'}")

    for result in results:
        print(
            f
1. - {result['similarity']:.3f}: 
            f
1. {result['text'][:100]}
        )

```

Run it:

```bash
python -m app.evaluate_retrieval
```

This is a simple smoke test, not a complete RAG evaluation. Keyword matching is only a rough proxy for relevance; later you'll evaluate whether the expected chunk is in the top-k results using labeled examples.

## 4. Your next practical tasks

,
{title:"Test an unrelated query",detail:"Ask about a topic that isn't in your sample documents and observe the similarity scores."},
{title:"Test document updates",detail:"Change the text for an existing chunk ID, ingest again, and verify the stored text and embedding are updated."},
{title:"Run the evaluation script",detail:"Check whether the expected content appears in the retrieved results."}
]}

### Challenge checklist



**{task.title}**
{task.detail}

</checkbox>

## What comes next?

After these tests, you're ready to start **Module 5: Advanced Retrieval**:

- Hybrid search — combine keyword search with vector similarity.
- Query rewriting — improve vague or conversational questions.
- Reranking — reorder retrieved chunks using a stronger relevance model.
- Context compression — remove irrelevant information before sending context to an LLM.

These techniques improve retrieval quality beyond simply choosing a vector database and increasing `top_k`.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 4.2: Vector Database Quiz & Core Concepts](02-quiz-and-core-concepts.md) | ➡️ [Next: Module 4.4: Task 1 — Multi-Tenant Source & Metadata Filtering](04-task-1-source-filtering.md)
