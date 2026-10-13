> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 4.3: Challenge — Build a Production-Ready Retriever](03-challenge-production-retriever.md) | ➡️ [Module 4.5: Task 2 — Testing Unrelated Queries & Similarity Thresholds](05-task-2-unrelated-query-thresholds.md)

---

No problem! We'll start with **Task 1: Add source filtering** and do it together, step by step. You don't need to complete all four tasks at once.

# Production RAG — Practical Task 1 of 4

## Goal: Filter by tenant AND source

Imagine your vector database contains these chunks:

| Chunk | Tenant | Source |
|---|---|---|
| `billing-001` | `company-a` | `billing-guide.pdf` |
| `billing-002` | `company-a` | `subscriptions.pdf` |
| `python-001` | `company-b` | `billing-guide.pdf` |

If the user belongs to `company-a` and asks about billing, we want only chunks from `company-a` **and** `billing-guide.pdf`.

## Step 1 — Update your existing search call

You already added the optional `source` parameter to `search_chunks()` in `app/pgvector_store.py`.

In your test script, change the search call to:

```python

results = search_chunks(
    query="How do subscription webhooks work?",
    top_k=5,
    tenant_id="company-a",
    source="billing-guide.pdf",
    min_similarity=0.0,
)

for result in results:
    print("ID:", result["id"])
    print("Source:", result["metadata"].get("source"))
    print("Tenant:", result["metadata"].get("tenant_id"))
    print("Text:", result["text"])
    print("---")

```

The `min_similarity=0.0` setting temporarily disables practical threshold rejection for nonnegative cosine similarities. This makes it easier to inspect the filtering behavior before tuning relevance thresholds.

## Step 2 — Understand what the database does

Your search function constructs a SQL condition equivalent to:

```sql
WHERE metadata->>'tenant_id' = 'company-a'
  AND metadata->>'source' = 'billing-guide.pdf'
```

The actual Python function uses SQL parameters, which is safer than inserting values directly into a query.

Both conditions must match:

- A chunk from `company-a` in `subscriptions.pdf` is excluded.
- A chunk from `company-b` in `billing-guide.pdf` is excluded.
- A chunk from `company-a` in `billing-guide.pdf` is eligible for similarity ranking.

The database then orders eligible chunks by cosine distance and returns the closest matches.

## Step 3 — Run your test

Save the change in your test script, then run:

```bash
python -m app.exercise_module4
```

Or run whichever script contains the updated search call.

Check that every returned chunk has:

- `tenant_id = company-a`
- `source = billing-guide.pdf`

If you get no results, check whether your sample data actually contains a chunk with both metadata values.

## Your turn

  ### Did source filtering work?

- [ ] Yes — every result matches both filters.
- [ ] No results were returned.
- [ ] I got a Python or SQL error.
- [ ] I haven't run the code yet.

Once this works, we'll test an unrelated query and see why a vector database can return results even when it doesn't have a genuinely useful answer. That is an important production RAG problem.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 4.3: Challenge — Build a Production-Ready Retriever](03-challenge-production-retriever.md) | ➡️ [Next: Module 4.5: Task 2 — Testing Unrelated Queries & Similarity Thresholds](05-task-2-unrelated-query-thresholds.md)
