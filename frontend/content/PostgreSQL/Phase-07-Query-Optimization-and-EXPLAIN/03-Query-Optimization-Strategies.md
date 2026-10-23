# 03 — Practical Query Optimization & Sargability

## Table of Contents
1. [The Golden Rule of Sargability](#1-the-golden-rule-of-sargability)
2. [Rewriting Non-Sargable Predicates](#2-rewriting-non-sargable-predicates)
3. [Eliminating the N+1 Query Antipattern](#3-eliminating-the-n1-query-antipattern)
4. [Keyset Pagination vs The `OFFSET` Trap](#4-keyset-pagination-vs-the-offset-trap)
5. [The Perils of `SELECT *`](#5-the-perils-of-select-)
6. [Session-Level Planner Overrides for Diagnostics](#6-session-level-planner-overrides-for-diagnostics)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. The Golden Rule of Sargability

**Sargable** is short for **S**earch **Arg**ument **Able**. A query predicate is sargable if the PostgreSQL query engine can utilize an index to jump directly to matching leaf keys.

A query is **non-sargable** if the engine is forced to evaluate a function or calculation on every single row before knowing whether it matches, rendering B-Tree indexes completely useless!

---

## 2. Rewriting Non-Sargable Predicates

### Case 1: Date & Time Truncation

```sql
-- NON-SARGABLE: Forces full table Seq Scan on 10 million rows!
SELECT * FROM orders 
WHERE date_trunc('year', order_date) = '2026-01-01';

-- SARGABLE REWRITE: Converts to direct bounded range seek on B-Tree!
SELECT * FROM orders 
WHERE order_date >= '2026-01-01' AND order_date < '2027-01-01';
```

### Case 2: Arithmetic on Column Values

```sql
-- NON-SARGABLE: Evaluates arithmetic per row
SELECT * FROM products WHERE price * 0.85 < 100.00;

-- SARGABLE REWRITE: Move the math constant to the right-hand side!
SELECT * FROM products WHERE price < (100.00 / 0.85);
```

### Case 3: Leading Wildcards

```sql
-- NON-SARGABLE: Cannot seek B-Tree with leading wildcard
SELECT * FROM users WHERE email LIKE '%@gmail.com';

-- SARGABLE REWRITE: Use reverse string expression index or Full-Text/Trigram index (pg_trgm):
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_users_email_trgm ON users USING gin (email gin_trgm_ops);
```

---

## 3. Eliminating the N+1 Query Antipattern

The N+1 problem occurs when an application ORM (Hibernate, Prisma, Django) queries a parent table, then executes $N$ individual queries for related children in a loop:

```python
# N+1 Disasters: 1 query for authors + 50 queries for each author's books!
authors = db.query("SELECT * FROM authors LIMIT 50")
for author in authors:
    books = db.query("SELECT * FROM books WHERE author_id = ?", author.id)
```

### The PostgreSQL Solution: JSON Aggregation in 1 Query!
```sql
SELECT 
    a.id,
    a.name,
    coalesce(
        jsonb_agg(
            jsonb_build_object('id', b.id, 'title', b.title)
        ) FILTER (WHERE b.id IS NOT NULL), 
        '[]'::jsonb
    ) AS books
FROM authors a
LEFT JOIN books b ON a.id = b.author_id
WHERE a.id <= 50
GROUP BY a.id, a.name;
```

This single query fetches the entire graph, fully formatted as JSON, in **under 2 milliseconds**!

---

## 4. Keyset Pagination vs The `OFFSET` Trap

In web pagination:
```sql
-- The OFFSET trap:
SELECT * FROM transactions ORDER BY id DESC LIMIT 20 OFFSET 500000;
```

### Why OFFSET Degrades:
To return 20 rows with `OFFSET 500000`, PostgreSQL must physically read and discard **500,000 rows**! Latency jumps from 1ms to several seconds.

### The Modern Solution: Keyset (Cursor) Pagination
Remember the last seen ID and seek directly into the B-Tree:

```sql
-- Keyset seek: Evaluates in ~0.2ms regardless of whether you are on page 1 or page 5,000!
SELECT * FROM transactions
WHERE id < 482910 -- Last seen ID from previous page
ORDER BY id DESC
LIMIT 20;
```

---

## 5. The Perils of `SELECT *`

Selecting all columns (`SELECT *`) damages production performance:
1. **Destroys Index-Only Scans:** Any column not included in the index forces an expensive random heap disk fetch.
2. **Network and Serialization Bloat:** Transfers massive unneeded text/json blobs across network sockets.
3. **Driver Memory Pressure:** Forces application JVM or Node.js heaps to instantiate gigabytes of unneeded object fields.

---

## 6. Session-Level Planner Overrides for Diagnostics

When tuning execution plans, you can temporarily disable plan nodes in your test session to inspect alternative paths:

```sql
-- Diagnostic check: "If Seq Scan was disabled, what index would Postgres use?"
SET enable_seqscan = off;
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 45;
RESET enable_seqscan;

-- Temporarily provide 256MB RAM to see if hash join eliminates disk batches:
SET work_mem = '256MB';
```

---

## 7. Hands-On Exercises

1. Given a table with `created_at TIMESTAMPTZ`, write a non-sargable query using `EXTRACT(month FROM created_at)` and observe the execution plan.
2. Rewrite the query into a sargable bounded range (`>=` and `<`) and compare execution time.
3. Write a Keyset pagination query retrieving the next batch of 25 records after cursor `id = 1250` and `created_at = '2026-04-12 10:00:00Z'`.

---

## 8. Summary & Key Takeaways

1. Never wrap indexed columns inside mathematical or date functions in the `WHERE` clause.
2. Move all constants and calculations to the right-hand side of comparison operators.
3. Use PostgreSQL `jsonb_agg()` to eliminate N+1 ORM roundtrips in a single query.
4. Replace `OFFSET` with **Keyset Cursor Pagination** for infinite scroll and high-page tables.
5. Explicitly specify column names instead of `SELECT *` to unlock Index-Only Scans.
