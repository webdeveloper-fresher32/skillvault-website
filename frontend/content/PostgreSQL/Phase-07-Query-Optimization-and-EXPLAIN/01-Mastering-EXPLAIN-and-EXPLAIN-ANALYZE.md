# 01 — Mastering EXPLAIN and EXPLAIN ANALYZE

## Table of Contents
1. [The Gold Standard: `EXPLAIN (ANALYZE, BUFFERS)`](#1-the-gold-standard-explain-analyze-buffers)
2. [Deconstructing Plan Tree Nodes](#2-deconstructing-plan-tree-nodes)
3. [Understanding Costs: `(cost=startup..total)`](#3-understanding-costs-coststartuptotal)
4. [The Four Core Table Scan Strategies](#4-the-four-core-table-scan-strategies)
5. [Analyzing Disk Buffers: Shared Hits vs Reads vs Dirtied](#5-analyzing-disk-buffers-shared-hits-vs-reads-vs-dirtied)
6. [Identifying Estimation Discrepancies](#6-identifying-estimation-discrepancies)
7. [Hands-On Plan Reading Exercise](#7-hands-on-plan-reading-exercise)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. The Gold Standard: `EXPLAIN (ANALYZE, BUFFERS)`

When profiling queries, running plain `EXPLAIN` only displays the optimizer's theoretical prediction.

To see what actually happened during runtime, run with `ANALYZE` and `BUFFERS`:

```sql
EXPLAIN (ANALYZE, BUFFERS, TIMING, COSTS, VERBOSE)
SELECT customer_id, SUM(amount)
FROM orders
WHERE order_date >= '2026-01-01'
GROUP BY customer_id;
```

> [!IMPORTANT]
> **Safety Warning:** `EXPLAIN ANALYZE` **ACTUALLY EXECUTES THE QUERY!** If you run `EXPLAIN ANALYZE DELETE FROM orders`, the orders **WILL BE DELETED**. To safely profile mutations, wrap the statement inside an explicit transaction and roll it back:
> ```sql
> BEGIN;
> EXPLAIN ANALYZE DELETE FROM orders WHERE status = 'CANCELLED';
> ROLLBACK;
> ```

---

## 2. Deconstructing Plan Tree Nodes

PostgreSQL plans are structured as a tree of execution nodes. Execution proceeds from the **innermost leaf nodes outward to the top-level root node**:

```
HashAggregate (cost=1250.00..1280.00 rows=500 width=16) (actual time=42.1..44.8 rows=492 loops=1)
  Buffers: shared hit=420 read=15
  ->  Bitmap Heap Scan on orders (cost=45.20..1120.00 rows=15000 width=12) (actual time=2.1..18.4 rows=14850 loops=1)
        Recheck Cond: (order_date >= '2026-01-01'::date)
        Buffers: shared hit=380 read=15
        ->  Bitmap Index Scan on idx_orders_date (cost=0.00..41.45 rows=15000 width=0) (actual time=1.8..1.8 rows=14850 loops=1)
              Index Cond: (order_date >= '2026-01-01'::date)
              Buffers: shared hit=40
```

---

## 3. Understanding Costs: `(cost=startup..total)`

- **`cost=45.20..1120.00`**: Measured in arbitrary cost units relative to reading an 8KB disk page (`seq_page_cost = 1.0`).
- **Startup Cost (`45.20`):** The cost incurred before the node can return its very first row (e.g. building a hash table or sorting an entire dataset).
- **Total Cost (`1120.00`):** The cumulative cost to return all candidate rows from this node.

---

## 4. The Four Core Table Scan Strategies

```
┌─────────────────────────┬────────────────────────────────────────────────────────────┐
│ Scan Strategy           │ How It Operates                                            │
├─────────────────────────┼────────────────────────────────────────────────────────────┤
│ Sequential Scan         │ Scans every 8KB disk page from start to finish. Fast for   │
│ (Seq Scan)              │ reading > 20% of a table via sequential disk I/O.          │
├─────────────────────────┼────────────────────────────────────────────────────────────┤
│ Index Scan              │ Traverses B-Tree, reads matching TIDs, then jumps directly │
│                         │ to heap pages on disk. Ultra-fast for selective queries.   │
├─────────────────────────┼────────────────────────────────────────────────────────────┤
│ Index Only Scan         │ All requested columns are found inside the index itself.   │
│                         │ Zero heap page visits if Visibility Map is up to date.    │
├─────────────────────────┼────────────────────────────────────────────────────────────┤
│ Bitmap Index Scan       │ Scans index, builds an in-memory bitmask of page IDs, then│
│ + Bitmap Heap Scan      │ visits heap pages in physical disk order, avoiding random  │
│                         │ I/O jumping. Used when selecting 1% to 15% of a table.     │
└─────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

## 5. Analyzing Disk Buffers: Shared Hits vs Reads vs Dirtied

The `BUFFERS` option displays RAM buffer cache activity:
- **`shared hit`:** The 8KB page was found immediately in PostgreSQL's `shared_buffers` in RAM (sub-microsecond memory speed).
- **`read`:** The page was not in Postgres RAM; the engine had to request it from the OS page cache or physical disk SSD.
- **`dirtied`:** The query modified a page in memory, requiring background flush.
- **`written`:** The query itself was forced to write a page to disk.

```
Rule of Thumb: If a single-row lookup shows:
Buffers: shared hit=4 read=1
That query required only 5 page reads (~40KB of memory access). Ultra-efficient!
```

---

## 6. Identifying Estimation Discrepancies

Look closely at the comparison between estimated rows and actual rows:
- `rows=15000` (Estimated by optimizer)
- `actual rows=14850` (Real rows counted)

If estimated rows is `1` and actual rows is `500,000`, the planner's statistics are wildly out-of-date. As a result, the optimizer might choose an inappropriate Nested Loop instead of a Hash Join, destroying query performance! Fix this with `ANALYZE table_name;`.

---

## 7. Hands-On Plan Reading Exercise

1. Create a table with 200,000 records.
2. Execute `EXPLAIN (ANALYZE, BUFFERS)` on an unindexed column lookup and observe `Seq Scan` and disk buffer reads.
3. Add an index and re-run. Observe the change to `Index Scan` or `Bitmap Index Scan`.
4. Add `INCLUDE` for the selected fields and observe it transition into an `Index Only Scan` with `Heap Fetches: 0`.

---

## 8. Summary & Key Takeaways

1. Always use `EXPLAIN (ANALYZE, BUFFERS)` for accurate runtime profiling.
2. Read plan trees from the inside out.
3. Look for discrepancies between estimated `rows` and `actual rows`.
4. Target `Index Only Scan` with `Heap Fetches: 0` for ultra-high throughput endpoints.
5. High `read` buffer counts indicate cold cache or missing indexes; high `hit` counts indicate in-memory performance.
