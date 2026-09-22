# 02 — Specialized Indexes: GIN, GiST, BRIN & Partial Indexes

## Table of Contents
1. [Beyond B-Trees: The PostgreSQL Index Family](#1-beyond-b-trees-the-postgresql-index-family)
2. [GIN (Generalized Inverted Index)](#2-gin-generalized-inverted-index)
3. [GiST (Generalized Search Tree)](#3-gist-generalized-search-tree)
4. [BRIN (Block Range Index): The Secret Weapon for Big Data](#4-brin-block-range-index-the-secret-weapon-for-big-data)
5. [Hash Indexes (WAL-Logged in Modern Postgres)](#5-hash-indexes-wal-logged-in-modern-postgres)
6. [Partial Indexes: Slashing Index Size](#6-partial-indexes-slashing-index-size)
7. [Expression Indexes: Indexing Derived Calculations](#7-expression-indexes-indexing-derived-calculations)
8. [Zero-Downtime Index Maintenance (`CONCURRENTLY`)](#8-zero-downtime-index-maintenance-concurrently)
9. [Hands-On Comparison Benchmark](#9-hands-on-comparison-benchmark)
10. [Summary & Key Takeaways](#10-summary--key-takeaways)

---

## 1. Beyond B-Trees: The PostgreSQL Index Family

While most relational engines only offer B-Trees, PostgreSQL provides an extensible index API with specialized data structures tailored for specific access patterns:

```
┌──────────────────┬─────────────────────────────┬────────────────────────────────────┐
│ Index Type       │ Best For                    │ Common Types                       │
├──────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ B-Tree           │ Equality & Range (<, <=, =) │ Scalar values (int, text, dates)   │
│ GIN              │ Multi-element containment   │ JSONB, Arrays, Full-Text Search    │
│ GiST             │ Overlapping & Geometry      │ Ranges (tsrange), Spatial (PostGIS)│
│ BRIN             │ Naturally ordered Big Data  │ Sequential timestamps, auto-IDs    │
│ Hash             │ Exact 32-bit equality only  │ Large unique strings / UUIDs       │
│ SP-GiST          │ Non-balanced space trees    │ IP prefixes (cidr), quad-trees     │
└──────────────────┴─────────────────────────────┴────────────────────────────────────┘
```

---

## 2. GIN (Generalized Inverted Index)

A **GIN index** is an "inverted index" similar to the internal index of a search engine. Instead of mapping row pointers to a scalar value, GIN splits multi-element columns (arrays, JSONB objects, text tokens) into individual elements and maps each unique element to a list of heap row pointers (the **Posting List**).

```
Element "database" ──► Row 10, Row 45, Row 112
Element "docker"   ──► Row 10, Row 89
```

```sql
-- Create GIN index on an Array column
CREATE INDEX idx_articles_tags ON articles USING gin (tags);

-- Accelerated Operators:
SELECT * FROM articles WHERE tags @> ARRAY['database'];
```

---

## 3. GiST (Generalized Search Tree)

GiST is a template balanced tree that permits user-defined classification algorithms. While B-Tree requires strict linear ordering ($A < B$), GiST supports hierarchical geometric containment and intervals:

```sql
-- Indexing range types for temporal overlap queries
CREATE INDEX idx_reservations_period ON room_reservations USING gist (reservation_period);

-- Instantly finds all overlapping booking windows (&&)
SELECT * FROM room_reservations 
WHERE reservation_period && tsrange('2026-07-01', '2026-07-15');
```

---

## 4. BRIN (Block Range Index): The Secret Weapon for Big Data

When storing hundreds of millions of time-series records or audit logs, traditional B-Tree indexes become massive, often exceeding the size of the table itself!

A **BRIN (Block Range Index)** does NOT index individual rows. Instead, it inspects a contiguous block of disk pages (default: 128 physical 8KB pages) and stores only two values: **The Minimum Value and the Maximum Value** found within that range.

```
Disk Pages 0–127:    Min: 2026-01-01  |  Max: 2026-01-03
Disk Pages 128–255:  Min: 2026-01-04  |  Max: 2026-01-06
```

When a query runs with `WHERE created_at >= '2026-01-05'`, PostgreSQL checks the BRIN summary and immediately skips Disk Pages 0–127 without reading them!

```sql
-- Create BRIN index on timestamp
CREATE INDEX idx_logs_created_brin ON server_logs USING brin (created_at);
```

### The Benchmark: 50 Million Row Audit Table
- **B-Tree Index Size:** ~1,100 MB
- **BRIN Index Size:** **~480 KB (Over 2,000x smaller!)**

---

## 5. Hash Indexes (WAL-Logged in Modern Postgres)

In PostgreSQL 10+, Hash Indexes were rewritten to be fully WAL-logged and crash-safe. A Hash index calculates a 32-bit hash code for the key and performs constant $O(1)$ equality lookups:

```sql
CREATE INDEX idx_users_api_key_hash ON user_tokens USING hash (api_key);
```

Use Hash indexes when you only ever perform exact equality lookups (`=`) on very wide strings and never need range queries (`>`, `<`).

---

## 6. Partial Indexes: Slashing Index Size

In many applications, 95% of rows represent inactive, archived, or completed data that are rarely queried.

A **Partial Index** includes a `WHERE` predicate, indexing only the active subset of rows:

```sql
-- Index ONLY unprocessed queue items
CREATE INDEX idx_orders_unprocessed 
ON orders (created_at) 
WHERE status = 'PENDING';
```

### Benefits:
- **Tiny footprint:** If only 1% of orders are pending, the index is 99% smaller!
- **Zero write penalty for completed rows:** Updating or inserting completed orders does not touch this index.

---

## 7. Expression Indexes: Indexing Derived Calculations

If a query filters by a calculated function (e.g. case-insensitive email lookup), a standard index on `email` will be ignored:

```sql
-- Naive query ignores standard index on email:
SELECT * FROM users WHERE lower(email) = 'user@example.com';

-- Create an Expression Index:
CREATE INDEX idx_users_lower_email ON users (lower(email));
```

PostgreSQL stores the computed output of `lower(email)` in the B-Tree, enabling instant index seeks!

---

## 8. Zero-Downtime Index Maintenance (`CONCURRENTLY`)

Standard `CREATE INDEX` acquires an **`EXCLUSIVE` table lock**, blocking all concurrent `INSERT`, `UPDATE`, and `DELETE` operations until the build finishes.

In production, **always build indexes concurrently**:

```sql
-- Builds index without blocking incoming application writes:
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);

-- Rebuild a bloated index online:
REINDEX INDEX CONCURRENTLY idx_users_email;
```

---

## 9. Hands-On Comparison Benchmark

```sql
-- Create a high-volume sequential table
CREATE TABLE telemetry (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    metric_val NUMERIC
);

INSERT INTO telemetry (recorded_at, metric_val)
SELECT 
    '2026-01-01'::timestamptz + (i * INTERVAL '1 second'),
    random() * 100
FROM generate_series(1, 1000000) i;

-- Compare sizes:
CREATE INDEX idx_telemetry_btree ON telemetry (recorded_at);
CREATE INDEX idx_telemetry_brin  ON telemetry USING brin (recorded_at);

SELECT 
    pg_size_pretty(pg_relation_size('idx_telemetry_btree')) AS btree_size,
    pg_size_pretty(pg_relation_size('idx_telemetry_brin'))  AS brin_size;
```

---

## 10. Summary & Key Takeaways

1. **GIN** is the optimal choice for arrays, JSONB documents, and full-text vectors.
2. **GiST** powers multidimensional geometric searches and range overlap checks.
3. **BRIN** provides massive disk savings (often 99%+) for append-only sequential timestamps.
4. **Partial Indexes** restrict indexing to relevant rows (`WHERE status = 'active'`).
5. Always use **`CONCURRENTLY`** in production to prevent write lock starvation.
