# 01 — Physical Join Mechanisms & Algorithms

## Table of Contents
1. [Logical vs Physical Joins](#1-logical-vs-physical-joins)
2. [Nested Loop Join](#2-nested-loop-join)
3. [Hash Join](#3-hash-join)
4. [Merge Join](#4-merge-join)
5. [How the PostgreSQL Planner Chooses](#5-how-the-postgresql-planner-chooses)
6. [Impact of `work_mem` on Join Performance](#6-impact-of-work_mem-on-join-performance)
7. [Hands-On EXPLAIN Verification](#7-hands-on-explain-verification)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. Logical vs Physical Joins

When you write SQL, you specify **Logical Joins**: `INNER JOIN`, `LEFT JOIN`, `RIGHT JOIN`, `FULL OUTER JOIN`, or `CROSS JOIN`.

The PostgreSQL query optimizer translates these logical relationships into one of three low-level **Physical Join Algorithms**:
1. **Nested Loop Join**
2. **Hash Join**
3. **Merge Join**

Understanding which physical algorithm is selected allows you to optimize table indexes and server memory to eliminate expensive disk spills.

---

## 2. Nested Loop Join

### How It Works:
For every row in the outer relation, PostgreSQL searches the inner relation for matching keys.

```
Outer Table (R)                Inner Table (S)
┌──────────────┐               ┌──────────────┐
│ Row 1 (id=5) │ ───────────►  │ Look up id=5 │ (Instant if Index Scan!)
├──────────────┤               └──────────────┘
│ Row 2 (id=8) │ ───────────►  │ Look up id=8 │
└──────────────┘               └──────────────┘
```

- **Ideal Scenario:** The outer table produces very few rows (e.g. filtered by a selective `WHERE` condition), and the inner table has an efficient **index** on the join key.
- **Worst Scenario:** No index exists on the inner table, requiring a catastrophic $O(M \times N)$ sequential scan of the entire inner table for every outer row.

---

## 3. Hash Join

### How It Works:
1. **Build Phase:** PostgreSQL reads the smaller (inner) relation into an in-memory hash table in RAM, using the join key as the hash key.
2. **Probe Phase:** PostgreSQL scans the larger (outer) relation row-by-row, hashes each join key, and probes the hash table for immediate matches.

```
1. Build Hash Table in RAM:
   Join Key -> [Tuples from small table]

2. Probe Stream:
   Outer Row ---> Hash(Key) ---> Match in Table? ---> Emit Joined Tuple
```

- **Prerequisites:** Only works with equality conditions (`ON a.id = b.a_id`). Cannot be used for inequality joins (`>`, `<`).
- **Memory Footprint:** Uses `work_mem`. If the hash table exceeds `work_mem`, Postgres switches to **Multi-Batch Hash Join**, writing batches to temporary files on disk, causing significant I/O degradation.

---

## 4. Merge Join

### How It Works:
1. Both tables must be sorted by the join key.
2. Two pointers step through both sorted streams simultaneously, emitting matching pairs in a single linear pass ($O(M + N)$).

```
Sorted Table A (Key)            Sorted Table B (Key)
  [1] <---------------------------> [1]  ==> MATCH! Emit!
  [3] <---------------------------> [3]  ==> MATCH! Emit!
  [4]                               [7]  ==> Advance Table A
  [7] <---------------------------> [7]  ==> MATCH! Emit!
```

- **Ideal Scenario:** Both tables are large, and either:
  - Both tables already have B-Tree indexes matching the join key (no sorting needed!).
  - Or the query includes `ORDER BY` on the join key anyway.
- **Limitation:** Requires both inputs to be sorted. If inputs are not indexed, the engine must execute explicit `Sort` nodes first.

---

## 5. How the PostgreSQL Planner Chooses

The query planner calculates the estimated disk and CPU cost for all candidate join paths:

| Factor | Favors Nested Loop | Favors Hash Join | Favors Merge Join |
|---|---|---|---|
| Outer Table Size | Small (1–100 rows) | Medium / Large | Large |
| Inner Table Index | High-speed B-Tree index | No index needed | Pre-sorted B-Tree index |
| Join Operator | Any (`=`, `>`, `<`, `LIKE`) | Strictly Equality (`=`) | Strictly Equality or Sorting (`=`) |
| RAM Availability | Low | High (`work_mem`) | Low (if pre-indexed) |

---

## 6. Impact of `work_mem` on Join Performance

When a Hash Join spills to disk due to insufficient `work_mem`, `EXPLAIN (ANALYZE, BUFFERS)` reveals:

```
Hash (cost=450.00..450.00 rows=25000 width=72)
  Buckets: 16384  Batches: 4  Memory Usage: 3200kB (Spilled to disk!)
```

To resolve this, increase `work_mem` for the transaction or session:
```sql
SET work_mem = '128MB';
-- Re-run query: Batches drops to 1, hash table fits completely in RAM!
```

---

## 7. Hands-On EXPLAIN Verification

Observe how PostgreSQL changes join strategies based on row counts:

```sql
CREATE TABLE authors (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE books (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    author_id INT REFERENCES authors(id),
    title TEXT NOT NULL
);

INSERT INTO authors (name) SELECT 'Author ' || i FROM generate_series(1, 100) i;
INSERT INTO books (author_id, title) 
SELECT (random() * 99 + 1)::int, 'Book ' || i FROM generate_series(1, 50000) i;

-- Query 1: Single author lookup -> Uses Nested Loop
EXPLAIN SELECT * FROM authors a JOIN books b ON a.id = b.author_id WHERE a.id = 5;

-- Query 2: Joining all authors and books -> Uses Hash Join
EXPLAIN SELECT * FROM authors a JOIN books b ON a.id = b.author_id;
```

---

## 8. Summary & Key Takeaways

1. **Nested Loop** is ultra-fast for small outer rows with an indexed inner table.
2. **Hash Join** is the workhorse for large un-indexed joins on equality conditions.
3. **Merge Join** excels when data streams are already sorted via B-Tree indexes.
4. Ensure `work_mem` is large enough so hash joins don't spill into multi-batch disk partitions.
