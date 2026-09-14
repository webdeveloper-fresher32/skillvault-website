# 01 — pgvector Fundamentals

> How to add vector similarity search to a PostgreSQL database you already run, instead of standing up a dedicated vector database.

---

## Table of Contents

1. [The Problem: Do You Really Need a New Database?](#1-the-problem-do-you-really-need-a-new-database)
2. [The Analogy: A New Blade on the Swiss Army Knife You Already Carry](#2-the-analogy-a-new-blade-on-the-swiss-army-knife-you-already-carry)
3. [How pgvector Works Internally](#3-how-pgvector-works-internally)
4. [Code Example: Extension, Table, Insert, Query](#4-code-example-extension-table-insert-query)
5. [pgvector vs Chroma vs Pinecone](#5-pgvector-vs-chroma-vs-pinecone)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Do You Really Need a New Database?

By Phase 5 and 6 you saw two different vector databases: Chroma (embedded, local-first) and Pinecone (managed, cloud-native). Both are purpose-built for vectors, and both ask you to run — or pay for — a system that lives *outside* your main application database.

But most production teams already have a relational database humming along in the background — very often PostgreSQL — holding users, orders, documents, permissions, and everything else the application needs. Standing up a second, separate database purely to hold embeddings creates real, ongoing costs that have nothing to do with the vectors themselves:

- **Operational overhead.** A new system to provision, patch, back up, monitor, and get paged for at 3 a.m.
- **Data duplication and drift.** The document text and metadata already live in Postgres; now they (or a copy, or a foreign key reference) also have to live in the vector store, and the two need to stay in sync.
- **Two query languages, two connections, two failure modes.** Your application now talks to Postgres for relational data and to a separate vector API for similarity search, and has to stitch the results together in application code.

The question this lesson answers: **what if the vectors just lived in Postgres, as a normal column, right next to the rest of the row?** That's exactly what the `pgvector` extension provides — no new database, no new query language, just a new column type and a couple of new operators.

---

## 2. The Analogy: A New Blade on the Swiss Army Knife You Already Carry

**Real-world analogy:** imagine you're a camper who already carries a Swiss Army knife with a blade, scissors, and a bottle opener. Someone tells you that you'll need to cut a small wire on your next trip. You have two options: buy a whole new dedicated wire-cutting tool and carry it separately, or check whether your existing Swiss Army knife already has (or can be fitted with) a wire-cutter attachment.

If the attachment does the job well enough, carrying one slightly-more-capable knife beats carrying two separate tools — less to pack, less to keep track of, one thing to maintain. That's pgvector: instead of packing a brand-new "vector search tool" alongside PostgreSQL, you install an attachment (`CREATE EXTENSION vector;`) and your existing knife (Postgres) can now do vector search too.

The honest caveat that comes with every version of this analogy: a dedicated wire-cutting tool, built for nothing else, will usually out-perform a multi-tool's attachment at very large scale or very specialized use. Section 5 covers exactly where that trade-off lands.

---

## 3. How pgvector Works Internally

At a conceptual level, pgvector adds three things to PostgreSQL:

1. **A new column type: `vector(N)`.** This stores a fixed-length array of floating-point numbers directly in a table row, the same way a `text` or `integer` column stores its value. The `N` is the *dimension* — it must match the output size of whatever embedding model produced the vector (for example, 768 for many sentence-transformer models, 1536 for OpenAI's `text-embedding-ada-002`, 3072 for some newer models). A `vector(768)` column can only ever hold 768-dimensional vectors.

2. **New distance operators.** pgvector adds SQL operators that compute the distance (or similarity) between two vectors directly in a query:
   - `<->` — **Euclidean (L2) distance**. Smaller means more similar.
   - `<=>` — **cosine distance**. Smaller means more similar (this is `1 - cosine similarity`, not cosine similarity itself).
   - `<#>` — **negative inner product**. Smaller (more negative) means more similar; it's negated so that, like the other two operators, "smaller is better" holds consistently for `ORDER BY`.

3. **Index types for approximate nearest-neighbor search** (IVFFlat and HNSW), which make the above operators fast at scale — covered in full in Lesson 3 of this phase.

The typical workflow is: install the extension once per database, add a `vector` column to a table (or create a new table), insert rows the normal way (with the embedding computed by your application code, exactly like in Phases 5 and 6), and then query using `ORDER BY <distance-operator> LIMIT k` — the same pattern as a normal SQL "top-k" query, just with a vector-aware sort key instead of a numeric column.

---

## 4. Code Example: Extension, Table, Insert, Query

Enabling the extension (run once per database, requires appropriate privileges):

```sql
CREATE EXTENSION vector;
```

Creating a table to hold documents and their embeddings. `serial` is Postgres shorthand for an auto-incrementing integer primary key; `vector(768)` declares a column that holds exactly 768-dimensional vectors, matching (in this example) a 768-dimension embedding model:

```sql
CREATE TABLE documents (
    id serial PRIMARY KEY,
    content text,
    embedding vector(768)
);
```

Inserting a row. In a real application, `embedding` is computed by calling an embedding model (as in Phase 2) from your application code, then passed in as a parameter — here it's shown inline for clarity, with a placeholder array standing in for 768 real floating-point numbers:

```sql
INSERT INTO documents (content, embedding)
VALUES (
    'Our refund policy allows returns within 30 days of purchase.',
    '[0.012, -0.045, 0.183, ...]'   -- 768 numbers total
);
```

Querying for the 5 most similar documents to some `query_embedding` (again, computed by embedding the user's question in application code, then substituted in as a parameter), using L2 distance:

```sql
SELECT id, content
FROM documents
ORDER BY embedding <-> '[0.010, -0.050, 0.190, ...]'
LIMIT 5;
```

A few things worth noticing, since the audience for this lesson may not know SQL deeply: `ORDER BY` sorts the result rows, and here the "sort key" isn't a normal column — it's the *distance* between each row's `embedding` and the query vector, computed on the fly by the `<->` operator. `LIMIT 5` then keeps only the top 5 rows after sorting, giving you exactly the "top-k nearest neighbors" behavior you'd expect from a dedicated vector database — expressed as an ordinary SQL query.

---

## 5. pgvector vs Chroma vs Pinecone

| Dimension | pgvector | Chroma | Pinecone |
|---|---|---|---|
| Operational overhead | None *if* you already run Postgres; otherwise you're now running Postgres just for this | Low — embedded or single lightweight service | None — fully managed, but you depend on a third-party service |
| SQL / relational integration | Native — vectors are just another column, joinable with any other table | None — separate API, no relational joins | None — separate API, no relational joins |
| Scaling very large vector workloads | Good with proper indexing, but a general-purpose relational database has limits a purpose-built vector engine doesn't | Designed for small-to-medium local/dev workloads | Built and tuned specifically for large-scale, high-QPS vector search |
| Right choice when... | You already run Postgres, need relational filters alongside vector search, and your scale is moderate | Prototyping, local development, small projects | Production workloads at large scale needing managed infrastructure and minimal ops |
| Wrong choice when... | You need vector-search features far beyond similarity (some advanced ANN tuning, multi-region replication) that a dedicated vector DB specializes in | You need production-grade scale or multi-user concurrent access | You want to avoid a new managed dependency and already have relational infrastructure |

The throughline: pgvector's biggest advantage isn't raw vector-search performance — it's that vector search stops being a separate system and becomes one more column and one more query clause in the database you're already operating and already know how to run relational queries against.

---

## 6. Common Mistakes

**Mistake 1: Forgetting to set the vector dimension to match the embedding model.** `vector(768)` and `vector(1536)` are not interchangeable — the dimension is fixed at table-creation time (or column-alteration time), and it must exactly match the output size of the embedding model you're using. Insert a 1536-dimensional vector into a `vector(768)` column and Postgres will reject it with a dimension mismatch error. Switching embedding models later (say, from a 768-dim model to a 1536-dim one) means you need a new column or a new table — you can't silently mix dimensions in the same column.

**Mistake 2: Running vector search on an unindexed large table.** Without an index, `ORDER BY embedding <-> query LIMIT k` performs an *exact* nearest-neighbor search: Postgres computes the distance between the query vector and every single row, then sorts. That's perfectly fine — even fast — on a few thousand rows. On a table with millions of rows, it becomes a full sequential scan with a distance calculation on every row, which is far too slow for an interactive application. Lesson 3 in this phase covers the IVFFlat and HNSW indexes that fix this by searching only an approximate, much smaller subset of candidates.

**Interview angle:** "Why would you use pgvector instead of a dedicated vector database?" is a common systems-design follow-up once a candidate has already described Chroma or Pinecone. Interviewers are listening for the trade-off, not a one-sided answer: pgvector wins on operational simplicity and native relational joins when a team already runs Postgres and doesn't need extreme scale; a dedicated vector database wins when the workload is vector-search-first, needs to scale far beyond what a general-purpose relational database comfortably handles, or needs managed infrastructure with minimal ops burden. A strong answer names both sides and explains *when* each applies, rather than declaring one universally better.

---

## 7. Hands-On Exercises

### Exercise 1 — Design the table

Without running any SQL, write out the `CREATE TABLE` statement for a `support_tickets` table that stores an `id`, a `subject` (text), a `body` (text), and an `embedding` for a 384-dimensional embedding model. Then write the `INSERT` statement you'd use to add one row (you can use a placeholder array for the vector values).

### Exercise 2 — Pick the right operator

For each of these three scenarios, state which pgvector operator (`<->`, `<=>`, or `<#>`) you'd use, and why:
1. Your embedding model's documentation says its vectors should always be compared using cosine similarity.
2. You're computing plain geometric (Euclidean) distance between two 2D points as a sanity check on a toy dataset.
3. Your embedding model was specifically trained so that a higher raw dot product means more similar, and you want to preserve that directly.

### Exercise 3 — Spot the dimension bug

A teammate created `embedding vector(1536)` for a table, then started inserting embeddings from a model that outputs 768-dimensional vectors "because it should just work, they're both just vectors." Explain in your own words what will actually happen when they try to insert a row, and why.

---

## 8. Interview Q&A

### Q1. What does the `pgvector` extension add to PostgreSQL?

**Answer:** It adds a `vector(N)` column type for storing fixed-dimension floating-point vectors, a set of distance operators (`<->` for Euclidean/L2 distance, `<=>` for cosine distance, `<#>` for negative inner product) that can be used directly in SQL queries, and specialized index types (IVFFlat and HNSW) that make nearest-neighbor search over those vectors fast at scale.

---

### Q2. Why would a team choose pgvector over a dedicated vector database like Pinecone?

**Answer:** Mainly to avoid operating a second database system. If the team already runs PostgreSQL for its application data, pgvector lets vector search live in the same database, using the same connection, the same backup strategy, and the same query language — and critically, it allows relational filters (like "only this user's documents") to be combined with vector similarity in a single query, which is awkward across two separate systems.

---

### Q3. What's the difference between `<->` and `<=>` in pgvector?

**Answer:** `<->` computes Euclidean (L2) distance between two vectors; `<=>` computes cosine distance (one minus cosine similarity). Both are "smaller is better" for `ORDER BY`, but they measure different things — L2 distance cares about the actual magnitude and position of the vectors, while cosine distance only cares about the angle between them, ignoring magnitude. Which one to use depends on how the embedding model was trained to be compared.

---

### Q4. What happens if you try to insert a 1536-dimension embedding into a `vector(768)` column?

**Answer:** Postgres rejects the insert with a dimension mismatch error. The dimension in `vector(N)` is fixed at column-creation time and must exactly match the size of every vector inserted into it — there's no automatic truncation or padding.

---

### Q5. Is querying an unindexed pgvector table with `ORDER BY embedding <-> query LIMIT k` incorrect?

**Answer:** It's correct — it returns the exact nearest neighbors — but it's a full sequential scan computing the distance against every row, which is fine on small tables but becomes too slow to be usable interactively as a table grows into the millions of rows. At that scale, an IVFFlat or HNSW index (Lesson 3) is needed to search only an approximate, much smaller candidate set instead of the entire table.

---

> 🧠 **Memory hook:** "Don't buy a new tool — check if the Swiss Army knife you're already carrying just needs a new blade."
