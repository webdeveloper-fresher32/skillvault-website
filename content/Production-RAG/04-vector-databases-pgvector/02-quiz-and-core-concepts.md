> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 4.1: PostgreSQL + pgvector Vector Database Architecture](01-postgresql-and-pgvector-guide.md) | ➡️ [Module 4.3: Challenge — Build a Production-Ready Retriever](03-challenge-production-retriever.md)

---

Perfect — **you got all 3 answers correct! 3/3.** 🎯 Let's connect those concepts to a practical exercise in your `production-rag` project.

## Module 4 quiz results

**1. PostgreSQL + pgvector**

Correct. If your application already uses PostgreSQL for users, subscriptions, and application data, pgvector lets you store and search embeddings in the same database. You can use SQL joins, transactions, metadata filters, and vector similarity queries together.

---

**2. Tenant / authorization filter**

Correct. Imagine two companies using your RAG application. Company A must not retrieve Company B's private documents. The server must enforce the tenant restriction using trusted authentication context, not blindly trust a tenant ID supplied by the user.

---

**3. Stable IDs**

Correct. If `billing-001` is ingested repeatedly, the database should update or replace that same logical record instead of creating duplicates. When the underlying document changes, you also need to remove obsolete chunks and index the new ones.

# Practical exercise: Build a mini RAG retriever

Module 4 · Hands-on lab · Beginner → production thinking

Your goal is to build a working retrieval layer using PostgreSQL + pgvector. We'll test it with sample documents before connecting it to your PDF chunking pipeline.

## What you're going to build

```
[Step 1: Ingest Sample Chunks]
(Plain text documentation · tenant_id: company-a & company-b)
       │
       ▼
[Step 2: Generate 384d Embeddings]
(sentence-transformers/all-MiniLM-L6-v2)
       │
       ▼
[Step 3: Upsert into PostgreSQL + pgvector]
(Table: document_chunks · Vector column with HNSW Index)
       │
       ▼
[Step 4: Semantic Search + Tenant Isolation]
(Cosine similarity (<=>) + WHERE tenant_id = 'company-a')
```

## Step 1 — Verify your environment

From your project root:

```bash
cd production-rag
source .venv/bin/activate
```

Check whether your local PostgreSQL container is running:

```bash
docker ps
```

If you created it in the previous module, you should see `production-rag-db`. If it exists but is stopped, run:

```bash
docker start production-rag-db
```

If you haven't created it yet, use the PostgreSQL + pgvector Docker command from Module 4. Don't create another container with the same name.

## Step 2 — Create the test data

Create `app/exercise_module4.py`.

```python

from dotenv import load_dotenv

load_dotenv()

from app.pgvector_store import upsert_chunks, search_chunks

chunks = [
    {
        "id": "subscription-001",
        "text": (
            "A subscription webhook notifies the application "
            "when a customer's subscription changes."
        ),
        "metadata": {
            "source": "subscriptions.pdf",
            "page": 2,
            "tenant_id": "company-a",
        },
    },
    {
        "id": "subscription-002",
        "text": (
            "Idempotency prevents the same webhook event "
            "from being processed multiple times."
        ),
        "metadata": {
            "source": "subscriptions.pdf",
            "page": 3,
            "tenant_id": "company-a",
        },
    },
    {
        "id": "python-001",
        "text": (
            "Python dictionaries store information as "
            "key-value pairs."
        ),
        "metadata": {
            "source": "python.pdf",
            "page": 1,
            "tenant_id": "company-b",
        },
    },
]

# Insert the chunks. Running this again should not create
# duplicate rows because each chunk has a stable ID.
upsert_chunks(chunks)

print("Chunks indexed successfully.")

# Search using natural language, not exact keyword matching.
results = search_chunks(
    query="How can I avoid handling the same webhook twice?",
    top_k=3,
    tenant_id="company-a",
)

for result in results:
    print("\nID:", result["id"])
    print("Text:", result["text"])
    print("Metadata:", result["metadata"])
    print("Cosine distance:", result["distance"])

```

Run it:

```bash
python -m app.exercise_module4
```

Expected behavior:

- The subscription chunks should be relevant to the question.
- The Python chunk belonging to `company-b` should not appear in this search.
- Running the script twice should not increase the number of rows for these three IDs.
- Lower cosine distance indicates greater similarity.

These are expected behaviors, not a guarantee of exact ranking on every model version or database configuration.

## Step 3 — Verify idempotent ingestion

Open a PostgreSQL shell:

```bash
docker exec -it production-rag-db \
  psql -U rag_user -d ragdb
```

Run:

```sql
SELECT id, COUNT(*)
FROM rag_chunks
WHERE id IN (
    'subscription-001',
    'subscription-002',
    'python-001'
)
GROUP BY id;
```

Each ID should have one row. This tests whether your upsert strategy is working.

## Step 4 — Test tenant isolation

Run a search for `company-a`, then change the filter to `company-b`:

```python
results = search_chunks(
    query="How can I avoid handling the same webhook twice?",
    top_k=5,
    tenant_id="company-b",
)
```

Notice that filtering is applied by the database query. In a real multi-tenant service, derive the tenant ID from your authenticated session or access token on the server; don't let users choose arbitrary tenant IDs to access other customers' data.

---

## Your challenge

  ### Exercise completion tracker

  Mark each item based on what you've actually tested.
  1. Did your script connect to pgvector and return search results?

- [ ] Yes, it works
- [ ] I got an error
- [ ] Haven't run it yet

---

  2. Did the tenant filter exclude the other company's chunk?

- [ ] Yes
- [ ] No, it returned another tenant's data
- [ ] Haven't tested it yet

---

  3. Did running ingestion twice preserve one row per chunk ID?

- [ ] Yes, no duplicate rows
- [ ] No, duplicates appeared
- [ ] Haven't checked yet

Once this works, the next step is to plug your actual PDF loader and chunker into the ingestion function. After that, we'll move to **Module 5: Advanced Retrieval**, where you'll learn hybrid search, query rewriting, reranking, and context compression.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 4.1: PostgreSQL + pgvector Vector Database Architecture](01-postgresql-and-pgvector-guide.md) | ➡️ [Next: Module 4.3: Challenge — Build a Production-Ready Retriever](03-challenge-production-retriever.md)
