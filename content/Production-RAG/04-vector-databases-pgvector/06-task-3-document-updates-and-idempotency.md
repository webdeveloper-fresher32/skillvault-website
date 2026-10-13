> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 4.5: Task 2 — Testing Unrelated Queries & Similarity Thresholds](05-task-2-unrelated-query-thresholds.md) | ➡️ [Module 4.7: Task 4 — Running a Retrieval Evaluation Script](07-task-4-retrieval-evaluation-script.md)

---

Let's move to **Module 4 — Task 3: Test document updates**.

The goal is to verify a critical production RAG behavior: when a document changes, the database should update the existing chunk rather than store a duplicate or keep returning stale content.

## Step 1: Understand what we're testing

Suppose your billing guide initially says:

> “Webhook events may be delivered more than once. Use the event ID to prevent duplicate processing.”

Later, you update the guide to say:

> “Webhook events may be delivered more than once. Store processed event IDs and make the handler idempotent to prevent duplicate processing.”

After re-ingestion, we want to confirm:

- The chunk ID stays the same, provided the chunk's identity is based on a stable source/version/page/offset strategy that remains unchanged.
- The database contains the updated text and its newly computed embedding.
- The row count does not increase because of a duplicate insert.
- Retrieval returns the updated content.

**Important:** If your chunk ID includes a document version or the chunk's content hash, changing the document can intentionally produce a new ID. For this exercise, we'll reuse the same ID deliberately to test the upsert behavior.

## Step 2: Create the update test

Create `app/test_document_update.py`:

```python

from dotenv import load_dotenv

load_dotenv()

from app.pgvector_store import upsert_chunks, search_chunks, get_connection

CHUNK_ID = "module4-update-test-001"

metadata = {
    "tenant_id": "company-a",
    "source": "billing-guide.pdf",
    "page": 1,
}

def count_chunk_rows():
    with get_connection() as conn:
        row = conn.execute(
            "SELECT COUNT(*) FROM rag_chunks WHERE id = %s",
            (CHUNK_ID,),
        ).fetchone()
        return row[0]

def main():
    original_text = (
        "Webhook events may be delivered more than once. "
        "Use the event ID to prevent duplicate processing."
    )

    updated_text = (
        "Webhook events may be delivered more than once. "
        "Store processed event IDs and make the handler idempotent "
        "to prevent duplicate processing."
    )

    # Insert the original version.
    upsert_chunks([
        {
            "id": CHUNK_ID,
            "text": original_text,
            "metadata": metadata,
        }
    ])

    count_after_first = count_chunk_rows()
    print("Rows after first ingestion:", count_after_first)

    # Re-ingest the same chunk ID with updated content.
    upsert_chunks([
        {
            "id": CHUNK_ID,
            "text": updated_text,
            "metadata": metadata,
        }
    ])

    count_after_update = count_chunk_rows()
    print("Rows after update:", count_after_update)

    # Retrieve the chunk using a related query.
    results = search_chunks(
        query="How do I make webhook processing idempotent?",
        top_k=5,
        tenant_id="company-a",
        source="billing-guide.pdf",
        min_similarity=0.0,
    )

    print("\nRetrieved matching chunks:")
    for result in results:
        if result["id"] == CHUNK_ID:
            print("ID:", result["id"])
            print("Text:", result["text"])
            print("Similarity:", result["similarity"])
            print("Updated text found:", result["text"] == updated_text)

if __name__ == "__main__":
    main()

```

This uses the `upsert_chunks()` and `search_chunks()` interfaces we've been working with. If your current `upsert_chunks()` expects a different argument shape, share its function definition and we'll adapt the test.

## Step 3: Run the test

From your `production-rag` project root, with your virtual environment activated:

```bash
python -m app.test_document_update
```

## Step 4: Verify the expected result

You should see something like this:

```text
Rows after first ingestion: 1
Rows after update: 1

Retrieved matching chunks:
ID: module4-update-test-001
Text: Webhook events may be delivered more than once. Store processed event IDs and make the handler idempotent to prevent duplicate processing.
Similarity: ...
Updated text found: True
```

The similarity score will depend on the embedding model and query.

| Check | Expected |
|---|---|
| Row count after first ingestion | `1` |
| Row count after update | `1` |
| Chunk ID | Unchanged |
| Retrieved text | Updated version |
| Embedding | Recomputed from updated text |

If the row count becomes `2`, the upsert isn't replacing the existing row as expected. If the old text appears, investigate whether the update is persisting and whether the search is returning a different chunk.

One extra production detail: if your real chunk IDs include document versions, you'll need a document-level replacement strategy that removes obsolete chunks from the previous version after successfully ingesting the new version.

## Your turn

Run the script and tell me which result you get:

- [ ] Success — row count stays at 1 and updated text appears.
- [ ] Duplicate — row count increases to 2.
- [ ] Stale content — the old text is retrieved.
- [ ] Error — the script fails.

Once this passes, we'll tackle **Task 4: run the evaluation script** to measure retrieval quality across a small set of questions rather than relying on one successful search.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 4.5: Task 2 — Testing Unrelated Queries & Similarity Thresholds](05-task-2-unrelated-query-thresholds.md) | ➡️ [Next: Module 4.7: Task 4 — Running a Retrieval Evaluation Script](07-task-4-retrieval-evaluation-script.md)
