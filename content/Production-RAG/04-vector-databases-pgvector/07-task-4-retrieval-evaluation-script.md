> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 4.6: Task 3 — Document Updates, Deduplication & Atomic Deletion](06-task-3-document-updates-and-idempotency.md) | ➡️ [Module 5.1: Similarity Search vs. Keyword Search (Dense vs. Sparse)](../05-advanced-retrieval/01-similarity-vs-keyword-search.md)

---

Great — let's move to **Module 4, Task 4: Run a retrieval evaluation script**.

So far, we've worked on source filtering, unrelated queries, and document updates. Now we'll test retrieval across multiple questions to see whether the correct document chunks appear near the top of the results.

The key idea: **a RAG system needs measurable retrieval quality, not just searches that run without errors.**

## Step 1: What we'll measure

- **Hit Rate@K:** For how many questions does at least one expected chunk appear in the top \(K\) results?
- **MRR (Mean Reciprocal Rank):** How highly does the first relevant chunk rank? First position contributes \(1\), second contributes \(1/2\), third contributes \(1/3\), and so on.
- **No-result rate:** How often does retrieval return no chunks? This is useful to monitor, but an empty result isn't automatically a failure for an unrelated question.

For this first evaluation, we'll use a small, manually labeled dataset. Later, you can expand it with representative questions from your own documents.

## Step 2: Create the evaluation script

Create `app/evaluate_retrieval.py`.

This version measures **Hit Rate@3** and **MRR@3** using expected chunk IDs. You'll need to replace the example IDs with IDs from your own database.

```python

from dotenv import load_dotenv

load_dotenv()

from app.pgvector_store import search_chunks

# Replace these example IDs with real relevant chunk IDs
# returned by your own PostgreSQL retrieval tests.
EVALUATION_CASES = [
    {
        "question": "How can I prevent duplicate webhook processing?",
        "relevant_ids": {"REPLACE_WITH_REAL_CHUNK_ID_1"},
    },
    {
        "question": "How do subscription webhook events work?",
        "relevant_ids": {"REPLACE_WITH_REAL_CHUNK_ID_2"},
    },
    {
        "question": "How do I handle repeated Stripe events?",
        "relevant_ids": {"REPLACE_WITH_REAL_CHUNK_ID_1"},
    },
]

TOP_K = 3
TENANT_ID = "company-a"

def main():
    hits = 0
    reciprocal_ranks = []

    for case in EVALUATION_CASES:
        results = search_chunks(
            query=case["question"],
            top_k=TOP_K,
            tenant_id=TENANT_ID,
            min_similarity=0.0,
        )

        retrieved_ids = [result["id"] for result in results]
        relevant_ids = case["relevant_ids"]

        # Find the rank of the first relevant chunk.
        first_relevant_rank = next(
            (
                rank
                for rank, chunk_id in enumerate(retrieved_ids, start=1)
                if chunk_id in relevant_ids
            ),
            None,
        )

        hit = first_relevant_rank is not None
        hits += int(hit)

        reciprocal_rank = (
            1 / first_relevant_rank
            if first_relevant_rank is not None
            else 0.0
        )
        reciprocal_ranks.append(reciprocal_rank)

        print("\nQuestion:", case["question"])
        print("Retrieved IDs:", retrieved_ids)
        print("Hit:", hit)
        print("First relevant rank:", first_relevant_rank)

    total = len(EVALUATION_CASES)

    hit_rate = hits / total if total else 0.0
    mrr = (
        sum(reciprocal_ranks) / total
        if total
        else 0.0
    )

    print("\n" + "=" * 45)
    print(f"Evaluation questions: {total}")
    print(f"Hit Rate@{TOP_K}: {hit_rate:.2%}")
    print(f"MRR@{TOP_K}: {mrr:.4f}")

if __name__ == "__main__":
    main()

```

## Step 3: Get real chunk IDs

Before running the evaluation, run a known relevant query using your existing retrieval code:

```python
results = search_chunks(
    query="How can I prevent duplicate webhook processing?",
    top_k=5,
    tenant_id="company-a",
    min_similarity=0.0,
)

for result in results:
    print(
        "ID:", result["id"],
        "| Source:", result["metadata"].get("source"),
        "| Text:", result["text"][:150],
    )
```

Choose the ID or IDs whose text genuinely answers the question. Use those IDs in `EVALUATION_CASES`. Repeat for each question; don't assume the first result is always relevant.

Then run:

```bash
python -m app.evaluate_retrieval
```

## Step 4: Understand the metrics

| Metric | Meaning |
|---|---|
| Hit Rate@3 | Fraction of questions with at least one relevant chunk in the top 3 |
| MRR@3 | Rewards relevant chunks appearing closer to rank 1 |
| `1.00` | Every question found a relevant chunk at rank 1 for MRR, and all questions had a hit |
| `0.00` | No question found a labeled relevant chunk in the top 3 |

These metrics evaluate retrieval against your labels, not the correctness of a generated LLM answer. Three questions are enough to learn the workflow, but production evaluation needs a larger, representative dataset.

**Your next step:** Check whether you already have an evaluation script in `app/`. If you do, use that rather than creating a duplicate. Otherwise, create the script above, replace the placeholder IDs, and run it. Share the output or any error, and we'll finish Module 4 together.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 4.6: Task 3 — Document Updates, Deduplication & Atomic Deletion](06-task-3-document-updates-and-idempotency.md) | ➡️ [Next: Module 5.1: Similarity Search vs. Keyword Search (Dense vs. Sparse)](../05-advanced-retrieval/01-similarity-vs-keyword-search.md)
