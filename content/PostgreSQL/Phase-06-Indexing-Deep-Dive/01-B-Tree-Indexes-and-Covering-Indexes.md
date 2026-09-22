# 01 — B-Tree Indexes & Covering Indexes

## Table of Contents
1. [B-Tree Internal Architecture](#1-b-tree-internal-architecture)
2. [Composite Indexes & The Leftmost Prefix Rule](#2-composite-indexes--the-leftmost-prefix-rule)
3. [Covering Indexes with the `INCLUDE` Clause](#3-covering-indexes-with-the-include-clause)
4. [The Magic of the Index-Only Scan](#4-the-magic-of-the-index-only-scan)
5. [The Visibility Map & Index-Only Scans](#5-the-visibility-map--index-only-scans)
6. [B-Tree Deduplication in Modern PostgreSQL](#6-b-tree-deduplication-in-modern-postgresql)
7. [Hands-On Verification Exercises](#7-hands-on-verification-exercises)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. B-Tree Internal Architecture

By default, any `CREATE INDEX` statement in PostgreSQL creates a **B-Tree (Balanced Tree)** index (specifically a Lehman-Yao B-Tree variant with high-concurrency lock protocols).

B-Trees organize keys into a hierarchy of 8KB disk pages:
- **Root Page:** The entry point.
- **Internal Branch Pages:** Route queries downward based on key comparisons.
- **Leaf Pages:** Form a doubly linked list containing the actual index key and the heap **Tuple Identifier (TID / `ctid`)**, which points to `(page_number, tuple_offset)` on disk.

```
                  [ Root Page ]
                 /             \
       [ Internal Node ]      [ Internal Node ]
        /             \        /             \
  [ Leaf Page A ] <-> [ Leaf Page B ] <-> [ Leaf Page C ]
   (Key -> TID)        (Key -> TID)        (Key -> TID)
```

Time complexity for lookup, insertion, and deletion is strictly $O(\log N)$.

---

## 2. Composite Indexes & The Leftmost Prefix Rule

A **Composite Index** spans multiple columns:

```sql
CREATE INDEX idx_users_country_city_age 
ON users (country, city, age);
```

### The Leftmost Prefix Rule:
PostgreSQL can use this index if your query filters by:
1. `country` (Leading column alone)
2. `country` AND `city`
3. `country` AND `city` AND `age`

> [!WARNING]
> If your query filters **only** by `city` or **only** by `age`, PostgreSQL **CANNOT** perform an index seek because the tree is sorted primarily by `country`! Always put the highest-cardinality or most frequently filtered column first.

---

## 3. Covering Indexes with the `INCLUDE` Clause

Traditionally, if a query filtered by `tenant_id` and selected `created_at` and `email`:
1. Postgres scanned the index on `tenant_id` to find matching row pointers (TIDs).
2. For each TID, Postgres performed a **Heap Fetch** (reading table data pages from disk) to retrieve the un-indexed `created_at` and `email` columns.

If you added `created_at` and `email` to the index key (`CREATE INDEX (tenant_id, created_at, email)`), the index tree became unnecessarily wide, increasing leaf page splits and memory overhead.

### The Modern Solution: The `INCLUDE` Clause (PostgreSQL 11+)
The `INCLUDE` clause appends non-key payload columns **only to the leaf pages**, without incorporating them into the tree's sorting or branching logic:

```sql
CREATE INDEX idx_orders_covering 
ON orders (customer_id, status) 
INCLUDE (total_amount, order_date);
```

- `customer_id, status`: The **Search Keys** (used in tree navigation and `WHERE` filtering).
- `total_amount, order_date`: The **Payload Columns** (stored strictly at the leaf level).

---

## 4. The Magic of the Index-Only Scan

When all columns requested by a `SELECT` statement exist within the index itself (either as search keys or `INCLUDE` payload), PostgreSQL can fulfill the entire query **without ever touching the underlying table heap pages**!

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT customer_id, status, total_amount, order_date
FROM orders
WHERE customer_id = 502 AND status = 'COMPLETED';
```

### Result:
```
Index Only Scan using idx_orders_covering on orders (cost=0.42..8.45 rows=1 width=28)
  Index Cond: ((customer_id = 502) AND (status = 'COMPLETED'::text))
  Heap Fetches: 0   <--- ZERO DISK HEAP READS!
```

Achieving **`Heap Fetches: 0`** delivers the lowest possible query latency.

---

## 5. The Visibility Map & Index-Only Scans

Why does the engine ever need heap fetches during an Index-Only Scan?
Because of **MVCC**! Standard index leaf pages do not store transaction visibility markers (`xmin`, `xmax`).

To verify if an index tuple is visible to the current transaction without reading the heap, PostgreSQL checks the table's **Visibility Map (VM)**.
- If the VM bit for an 8KB page is marked as **all-visible** (set by `VACUUM`), the engine knows every row in that page is visible to all transactions and skips the heap!
- If the bit is not set, Postgres must fetch the heap page to inspect tuple headers.

> [!TIP]
> Keep your **Autovacuum** running smoothly so the Visibility Map stays updated, maintaining `Heap Fetches: 0`.

---

## 6. B-Tree Deduplication in Modern PostgreSQL

Starting in PostgreSQL 13, B-Tree indexes automatically perform **duplicate key deduplication**. If many rows share identical values (e.g. `status = 'pending'`), Postgres stores the key once followed by an array of posting pointers, reducing index size on disk by up to **40%** without user intervention.

---

## 7. Hands-On Verification Exercises

1. Create a table `shipment_tracking` with 500,000 rows.
2. Run a query selecting `tracking_id`, `carrier`, and `status` with a plain index on `tracking_id`. Inspect `Heap Fetches` via `EXPLAIN (ANALYZE, BUFFERS)`.
3. Drop the index and recreate it using `INCLUDE (carrier, status)`.
4. Re-run the query and observe `Heap Fetches` drop to `0`.

---

## 8. Summary & Key Takeaways

1. B-Tree is the default, multi-purpose $O(\log N)$ balanced tree index.
2. Composite indexes require queries to filter on the leftmost prefix column.
3. Use the `INCLUDE` clause to create covering indexes without bloating internal branch nodes.
4. **Index-Only Scans** eliminate table heap I/O entirely when the Visibility Map is clean.
5. Deduplication in modern PostgreSQL keeps duplicate B-Tree index pages compact.
