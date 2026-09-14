# 02 — Hybrid Relational and Vector Queries

> How to combine ordinary SQL filters with vector similarity search in a single query — pgvector's biggest practical advantage over a standalone vector database.

---

## Table of Contents

1. [The Problem: Similarity Alone Isn't Enough](#1-the-problem-similarity-alone-isnt-enough)
2. [The Analogy: A Librarian Who Can Filter and Rank at the Same Time](#2-the-analogy-a-librarian-who-can-filter-and-rank-at-the-same-time)
3. [How Hybrid Queries Work Internally](#3-how-hybrid-queries-work-internally)
4. [Code Example: Joining, Filtering, and Ordering by Distance](#4-code-example-joining-filtering-and-ordering-by-distance)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Similarity Alone Isn't Enough

Lesson 1 showed a query that finds the 5 documents most similar to a question. In a real application, that's rarely the whole requirement. A support search feature typically needs something closer to: *"Find documents similar to this question, but only ones owned by this user, and only ones created this year."* Pure vector similarity search answers "which documents are about the same thing" — it says nothing about who owns them, when they were created, or what plan the owner is on.

With a dedicated vector database (Chroma, Pinecone), this kind of filtering is usually bolted on as a separate metadata-filter mechanism that runs *alongside* the similarity search, using a different syntax than any relational join, and often with real restrictions on how expressive that filter can be. Combining that filtered vector search with a genuine relational join — say, pulling in each document's owner from a separate `users` table to check their subscription plan — usually means doing part of the work in the vector database and the rest back in application code.

pgvector removes that seam entirely: because the vectors live in ordinary Postgres tables, a `WHERE` clause and a vector `ORDER BY` are just two clauses of the same SQL query, and joining across tables works exactly the way it always has in a relational database.

---

## 2. The Analogy: A Librarian Who Can Filter and Rank at the Same Time

**Real-world analogy:** imagine asking a librarian, "Find me books similar in topic to this one — but only ones checked out this year, and only ones by this particular author." A librarian using a card catalog organized purely by topic similarity would have to first pull every topically-similar book, then manually go check each one's checkout history and author, discarding anything that doesn't match — two separate passes, stitched together by hand.

Now imagine a librarian working from a single well-organized database that already tracks topic, checkout history, and author together. They can apply the "checked out this year, by this author" filter and the "similar in topic" ranking in one pass, because all of that information already lives in the same system. That's the difference between filtering a vector database's metadata after the fact and running a genuine hybrid query in Postgres: the relational engine applies the filter and the similarity ranking together, in one query plan, instead of stitching two separate results together in application code.

---

## 3. How Hybrid Queries Work Internally

A hybrid query is just a normal SQL `SELECT` that happens to combine two kinds of conditions:

- A `WHERE` clause on ordinary columns (numbers, text, dates, foreign keys) — exactly like any relational query you've written before.
- An `ORDER BY <vector-column> <distance-operator> <query-vector>` clause, which ranks the *remaining* rows (the ones that passed the `WHERE` filter) by similarity.
- A `LIMIT` to keep only the top results after that ranking.

Conceptually, Postgres's query planner has a choice about *when* to apply the filter relative to the similarity ranking. In the simplest case (no vector index, or a filter that isn't very selective), it can compute the distance for every row that already passed the `WHERE` clause, then sort and limit — meaning the relational filter narrows the candidate set *before* the more expensive vector-distance computation even runs. This is exactly the behavior a pure vector database struggles to offer natively, because its filter and its similarity index are typically two separate subsystems rather than one query planner reasoning about both together.

It's worth being precise about one thing: exactly how the planner combines an index-accelerated vector search (IVFFlat/HNSW, covered in Lesson 3) with a relational filter is a query-planning detail that can vary by Postgres version and by how selective the filter is — which is exactly why the next section emphasizes checking `EXPLAIN` rather than assuming.

---

## 4. Code Example: Joining, Filtering, and Ordering by Distance

Suppose you have the `documents` table from Lesson 1, plus a `users` table that tracks each user's subscription plan, and `documents` has an `owner_id` column referencing `users.id`. A hybrid query that finds the 5 documents most similar to a query embedding, but only from documents owned by users on the `'pro'` plan, looks like this:

```sql
SELECT documents.id, documents.content
FROM documents
JOIN users ON documents.owner_id = users.id
WHERE users.plan = 'pro'
ORDER BY documents.embedding <-> '[0.010, -0.050, 0.190, ...]'
LIMIT 5;
```

Walking through this for anyone who hasn't written much SQL: `JOIN users ON documents.owner_id = users.id` combines each row in `documents` with the matching row in `users` (matching where the document's `owner_id` equals the user's `id`) so that columns from both tables are available in the rest of the query. `WHERE users.plan = 'pro'` then discards any combined row where the owning user isn't on the `'pro'` plan — this happens *before* the final ranking. Finally, `ORDER BY documents.embedding <-> '...'` ranks whatever rows are left by vector distance, and `LIMIT 5` keeps only the closest 5.

Notice this is one query, one round trip to one database, expressing "similar AND owned by a pro user" as naturally as any other relational filter — there's no separate metadata-filter API and no stitching results together in application code.

---

## 5. Common Mistakes

**Mistake 1: Writing the `WHERE` clause and assuming the query planner uses the filter efficiently, without ever checking.** It's tempting to write a hybrid query, see that it returns correct results, and assume it's also *fast* — but correctness and efficiency are separate questions. A query can return the right rows while still doing far more work than necessary (for example, computing vector distances for far more rows than needed before applying the filter, if the planner didn't choose the plan you expected). The only way to know what's actually happening is to prefix the query with `EXPLAIN` (or `EXPLAIN ANALYZE` to see actual execution statistics, not just the planned steps):

```sql
EXPLAIN ANALYZE
SELECT documents.id, documents.content
FROM documents
JOIN users ON documents.owner_id = users.id
WHERE users.plan = 'pro'
ORDER BY documents.embedding <-> '[0.010, -0.050, 0.190, ...]'
LIMIT 5;
```

`EXPLAIN` prints the query plan Postgres intends to use (which indexes it will use, in what order it applies the join, filter, and sort); `EXPLAIN ANALYZE` actually runs the query and reports real timing alongside the plan. Reading this output — rather than assuming — is the only reliable way to catch a hybrid query that's silently scanning far more rows than it needs to.

**Mistake 2: Assuming a relational filter automatically makes a vector index unnecessary, or vice versa.** A highly selective `WHERE` filter (say, one that narrows a million-row table down to a hundred rows) can make an unindexed vector search perfectly fast, because there are so few rows left to compute distances for. But if the filter is not very selective (say, `plan = 'pro'` matches 80% of all rows), the vector index still matters a great deal — the false assumption that "I have a WHERE clause, so I don't need to worry about vector indexing" doesn't hold in general. Whether the filter or the index dominates the query's cost depends on the data, and `EXPLAIN` is how you find out rather than guess.

**Interview angle:** Interviewers testing for real hands-on pgvector experience (rather than surface familiarity) often ask "how do you know your hybrid query is actually fast, not just correct?" The answer they're listening for is `EXPLAIN` / `EXPLAIN ANALYZE` — candidates who only describe writing the query, without ever mentioning verifying its execution plan, tend to have read about pgvector rather than operated it under real data volume.

---

## 6. Hands-On Exercises

### Exercise 1 — Write a three-way hybrid query

Using the `documents` and `users` tables from this lesson, plus a new `categories` table (`id`, `name`) referenced by `documents.category_id`, write a SQL query that returns the 10 documents most similar to a query embedding, filtered to only documents owned by users on the `'pro'` plan AND belonging to the category named `'Engineering'`.

### Exercise 2 — Read an EXPLAIN plan

Without running any database, describe in your own words what you would look for in the output of `EXPLAIN ANALYZE` on a hybrid query to determine whether the `WHERE` filter is being applied before or after the expensive vector distance calculation.

### Exercise 3 — Diagnose a slow hybrid query

A hybrid query that filters on `WHERE users.plan = 'pro'` and orders by vector distance is running much slower than expected, even though only 200 out of 5 million documents belong to `'pro'` users. List at least two possible explanations you'd want to rule out using `EXPLAIN ANALYZE` before concluding the vector index itself is the problem.

---

## 7. Interview Q&A

### Q1. What's the practical advantage of a "hybrid query" in pgvector versus filtering a vector database's metadata separately?

**Answer:** In pgvector, the relational filter and the vector similarity ranking are two clauses (`WHERE` and `ORDER BY`) of the same SQL query, evaluated by one query planner in one round trip. In a standalone vector database, metadata filtering and similarity search are typically two separate mechanisms, and any genuine relational join (pulling data from another table) usually has to happen in application code after both queries return — adding latency and complexity that pgvector avoids by design.

---

### Q2. In the hybrid query example, does the `WHERE users.plan = 'pro'` filter get applied before or after the vector similarity ranking?

**Answer:** Conceptually, the filter narrows the candidate rows and the `ORDER BY ... LIMIT` ranks and trims whatever rows remain — but the exact order of operations Postgres actually executes is a query-planning decision that can depend on the data and indexes involved. You verify it, rather than assume it, by running `EXPLAIN` or `EXPLAIN ANALYZE` on the query.

---

### Q3. Why shouldn't you just trust that a hybrid query is efficient because it returns correct results?

**Answer:** Correctness and performance are independent — a query can return the exact right rows while still doing much more computational work than necessary, for example if the query planner ends up computing vector distances against far more rows than the filter should have allowed. `EXPLAIN ANALYZE` is the only reliable way to see what the database actually did, rather than assuming the filter was applied efficiently.

---

### Q4. If a `WHERE` filter is highly selective, do you still need a vector index?

**Answer:** Not necessarily — if the filter narrows the table down to a small number of rows before the similarity ranking runs, computing exact distances on that small remaining set can be fast even without an index. But this depends entirely on how selective the filter actually is; a non-selective filter (one that still leaves millions of rows) still benefits significantly from a vector index, so this is something to verify with `EXPLAIN`, not assume from the presence of a `WHERE` clause alone.

---

> 🧠 **Memory hook:** "Don't just check that the librarian found the right books — check that they didn't walk past every shelf in the building to find them."
