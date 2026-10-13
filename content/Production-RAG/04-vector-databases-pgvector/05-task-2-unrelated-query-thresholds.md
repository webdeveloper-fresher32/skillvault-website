> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 4.4: Task 1 — Multi-Tenant Source & Metadata Filtering](04-task-1-source-filtering.md) | ➡️ [Module 4.6: Task 3 — Document Updates, Deduplication & Atomic Deletion](06-task-3-document-updates-and-idempotency.md)

---

Nice! Task 1 is complete. ✅ Your PostgreSQL retriever now filters by both tenant and source before ranking the results.

Next, let's test one of the most important production RAG problems: **an unrelated question can still return a result from vector search.**

# Module 4 — Task 2: Test an unrelated query

## 1. Understand the problem

Suppose your database contains information about subscriptions and webhooks, but someone asks:

> “How do I train a golden retriever puppy?”

Your vector database will still try to find the nearest vectors. It doesn't automatically know that your documents contain no answer.

That means:

- A successful search doesn't guarantee a relevant answer.
- `top_k=5` means “return up to five nearest chunks,” not “return five correct chunks.”
- Similarity thresholds can help reject weak matches, but must be calibrated against real queries.

## 2. Run this experiment

Create `app/test_unrelated_query.py`:

```python

from dotenv import load_dotenv

load_dotenv()

from app.pgvector_store import search_chunks

queries = [
    "How can I prevent duplicate webhook processing?",
    "How do I train a golden retriever puppy?",
    "What is the capital of Japan?",
]

for query in queries:
    print("\n" + "=" * 70)
    print("QUESTION:", query)

    results = search_chunks(
        query=query,
        top_k=3,
        tenant_id="company-a",
        source="billing-guide.pdf",
        min_similarity=0.0,  # Inspect results without threshold rejection
    )

    if not results:
        print("No matching chunks.")
        continue

    for result in results:
        print(f"\nID: {result['id']}")
        print(f"Similarity: {result['similarity']:.4f}")
        print(f"Distance: {result['distance']:.4f}")
        print(f"Text: {result['text']}")

```

Run it from your project root:

```bash
python -m app.test_unrelated_query
```

The test uses the same tenant and source filters for all three questions so that you're comparing the relevance of the results from the same subset of documents.

## 3. How to interpret the scores

For our normalized embeddings, the code calculates:

\[
\text{similarity}=1-\text{distance}
\]

**Relevant query**

“How can I prevent duplicate webhook processing?”

You'd expect the idempotency chunk to rank highly because it discusses the same concept.

---

**Unrelated query**

“How do I train a golden retriever puppy?”

The database may still return billing chunks. Their scores tell you how closely the vectors match, not whether your knowledge base can answer the question.

Don't assume a fixed score like `0.70` is always good or that `0.30` is always bad. Similarity distributions depend on your embedding model, corpus, and query type. The best threshold should be measured using a set of relevant and irrelevant queries.

## 4. Your mini-challenge

Run the script and compare the first result for each question. Then report what you observed.

  ### Record your results

Top similarity for the relevant webhook question

Top similarity for the puppy-training question

  What happened?

- [ ] The relevant question had a higher score.
- [ ] The scores were surprisingly similar.
- [ ] The unrelated question scored higher.
- [ ] I'm not sure how to interpret the scores.

After this, we'll proceed to **Task 3: document updates** — changing a chunk while keeping its ID stable, then verifying that the database replaces the old text and embedding instead of creating a duplicate.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 4.4: Task 1 — Multi-Tenant Source & Metadata Filtering](04-task-1-source-filtering.md) | ➡️ [Next: Module 4.6: Task 3 — Document Updates, Deduplication & Atomic Deletion](06-task-3-document-updates-and-idempotency.md)
