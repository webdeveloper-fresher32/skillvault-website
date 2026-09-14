# Clustered Secondary and Covering Indexes — Complete Guide

> "The store's layout decides where the milk physically sits, the sign at the end of the aisle only tells you which aisle to walk down, and on the rare day the sign lists the price too you never walk down the aisle at all."

---

## Table of Contents

1. [The Problem: The Index Was Used and the Query Was Still Slow](#1-the-problem-the-index-was-used-and-the-query-was-still-slow)
2. [The Supermarket Aisle Sign Analogy](#2-the-supermarket-aisle-sign-analogy)
3. [The Mechanism: Clustered Leaves and Secondary Locators](#3-the-mechanism-clustered-leaves-and-secondary-locators)
4. [Diagram: The Double Lookup From Secondary Index to Row](#4-diagram-the-double-lookup-from-secondary-index-to-row)
5. [Code Walkthrough: Turning a Double Lookup Into an Index-Only Scan](#5-code-walkthrough-turning-a-double-lookup-into-an-index-only-scan)
6. [Comparing a Monotonic Clustering Key to a Random One](#6-comparing-a-monotonic-clustering-key-to-a-random-one)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Index Was Used and the Query Was Still Slow

The execution plan confirms the index is being used. The query still takes two seconds. The index did its job — it found the matching rows in microseconds — and then handed back a list of addresses that had to be visited one at a time.

### The Plan Says Index Scan and the Clock Says Otherwise

```text
SELECT total_cents FROM orders WHERE customer_id = 77;
  idx_orders_customer  →  1 tree descent, finds 240,000 entries   0.4 ms
  fetch the rows       →  240,000 separate trips into the table  1,910 ms
  ↳ The index answered "which rows", not "what is in them". Every
    one of those 240,000 answers costs a second lookup.
Same query after adding total_cents to the index:
  index-only scan      →  1 descent, read entries in order          6 ms
```

### What's Missing

An index scan is two operations that get reported as one: locating entries, then resolving each entry to an actual row. The first is nearly free and the second is not. What's missing is a vocabulary for the second half — which index layouts avoid it, and what it costs when they cannot.

---

## 2. The Supermarket Aisle Sign Analogy

A supermarket's physical layout decides where every product actually sits: dairy in one corner, produce at the entrance. The aisle signs are a separate thing entirely — a sign reading "Pasta: aisle 7" does not contain any pasta. It tells you where to walk, and you still have to walk.

### Layout Sign and Sign-With-Price

```text
Store layout   → the goods themselves, in one fixed arrangement;
                 there can only ever be one arrangement at a time
Aisle sign     → a small separate list pointing into that layout;
                 many signs can exist, each sorted differently
Sign with the  → the rare sign that answers outright, so the walk
price on it      down the aisle never happens at all
```

### Mapping the Analogy to Index Types

The layout is the clustered index — the rows themselves, in key order, one arrangement per table. Each aisle sign is a secondary index: a compact sorted list that points back. A sign carrying the price is a covering index, and reading it instead of walking is an index-only scan.

---

## 3. The Mechanism: Clustered Leaves and Secondary Locators

In a clustered table there is no separate "table" and "primary index" — the leaf level of the primary structure holds the complete rows, in key order. That single fact drives everything else in this lesson.

### The Table Stored in Key Order

```sql
-- Illustrative standard SQL
CREATE TABLE orders (
  order_id    BIGINT PRIMARY KEY,        -- the clustering key
  customer_id BIGINT NOT NULL,
  status      VARCHAR(16) NOT NULL,
  total_cents INTEGER NOT NULL);
CREATE INDEX idx_orders_customer ON orders (customer_id);
```
```text
Clustered leaves, in order_id order — these ARE the table:
  page 812 │ 1001 │ 77 │ shipped │ 4250 │ 1002 │ 31 │ pending │ 1899 │
  page 813 │ 1003 │ 77 │ shipped │  990 │ 1004 │ 12 │ pending │ 6100 │

idx_orders_customer leaves, in customer_id order:
  page 44  │ 12 → 1004 │ 31 → 1002 │ 77 → 1001 │ 77 → 1003 │
             ↳ key        ↳ locator — either the clustering key
               value, so resolving it means a full descent of the
               clustered index, or in a heap-organised table a
               physical page-plus-slot address. Either way the row
               itself is not here, and a second structure has to be
               consulted because the first did not carry the answer.
```

### Page Splits Under a Random Clustering Key

```text
Monotonic key (order_id 1001, 1002, 1003, ...):
  ┌──────┬──────┬──────────┐  append at the rightmost leaf,
  │ 1001 │ 1002 │ 1003 ←── │  page fills to ~100%, no splits
  └──────┴──────┴──────────┘

Random key (UUID v4 e3b0..., 7f2a..., 0c19...):
  ┌──────────────┐  insert 7f2a into an already-full page
  │ 7a11 ... 8c04│  ───► split: allocate a page, move half the
  └──────────────┘        entries across, update the parent
  ┌───────┐ ┌───────┐   both pages now ~50% full
  │ 7a11..│ │ 7f2a..│
  └───────┘ └───────┘
  ↳ Two half-empty pages where one full page was. Over millions of
    inserts the table occupies roughly 1.5-2x the space, with
    logically adjacent rows scattered across all of it.
```

---

## 4. Diagram: The Double Lookup From Secondary Index to Row

### One Predicate Two Structures

```text
SELECT total_cents FROM orders WHERE customer_id = 77;

  idx_orders_customer            clustered table (order_id order)
  ┌────────────┐                 ┌────────────┐
  │ root       │                 │ root       │
  └─────┬──────┘                 └─────┬──────┘
        ▼         locator 1001    ┌────┴─────┬─────────┐
  ┌─────────────┐ ──────────────► │ leaf 812 │ leaf 813│
  │ 77 → 1001   │        1003     └──────────┴─────────┘
  │ 77 → 1003   │ ──────────────►      ▲          ▲
  └─────────────┘                      └──────────┘
  1 descent finds        1 FULL descent per row returned:
  both entries           240,000 rows → 240,000 descents
```

### Reading the Diagram

The left descent happens once. The right descent happens once *per matching row*, and each one is a random access that may miss the buffer pool entirely. This is the concrete mechanism behind Lesson 1's selectivity rule: past a few percent of the table, the planner abandons the index precisely because it is counting these right-hand descents.

---

## 5. Code Walkthrough: Turning a Double Lookup Into an Index-Only Scan

An index covers a query when it contains every column that query touches. When it does, the right-hand side of the diagram above disappears completely.

### Adding the Column the Query Wanted

```sql
-- Before: the index serves the predicate but not the projection
CREATE INDEX idx_orders_customer ON orders (customer_id);
SELECT total_cents FROM orders WHERE customer_id = 77;
--   ↳ index yields locators; total_cents exists only in the row

-- After: the index carries total_cents as well, so the whole query
-- is answered from the index — an index-only scan, no table access
CREATE INDEX idx_orders_cust_total ON orders (customer_id, total_cents);
SELECT total_cents         FROM orders WHERE customer_id = 77; -- covered
SELECT total_cents, status FROM orders WHERE customer_id = 77; -- NOT
--   ↳ "Covered" means every column the query touches is in the
--     index: WHERE, SELECT list, ORDER BY, GROUP BY, JOIN. status
--     is absent, so all 240,000 rows get fetched from the table
--     anyway. SELECT * is never covered by a secondary index.
```

### Key Columns Versus Included Columns

```sql
-- Illustrative. INCLUDE is not standard SQL; engines spell it
-- differently and some do not offer it at all.
CREATE INDEX idx_orders_customer ON orders (customer_id)
INCLUDE (total_cents, status);
```

```text
customer_id         → key column: sorted, searchable, usable for
                      range predicates and ORDER BY, present in the
                      internal nodes as well as the leaves
total_cents, status → included columns: leaf pages only. Cannot be
                      searched or sorted on, but ARE available to
                      satisfy the projection
  ↳ Never entering the internal nodes keeps the tree as shallow as
    a single-column index while covering a wider query. Adding them
    as key columns would fatten every internal node instead.
```

---

## 6. Comparing a Monotonic Clustering Key to a Random One

The clustering key is chosen once and every insert, every secondary index, and every range scan then lives with the consequences.

### Monotonic BIGINT vs Random UUID

| | Monotonic BIGINT | Random UUID v4 |
|---|---|---|
| Insert target | Always the rightmost leaf | A uniformly random leaf |
| Page splits | Almost never | Constantly, as inserts hit full pages |
| Fill factor | Near 100% | Typically 50-70% after sustained inserts |
| Buffer pool | One hot page stays resident | Every leaf must be resident to avoid a read |
| Secondary index size | 8-byte locator repeated in each entry | 16-byte locator repeated in each entry |
| Range scan on the key | Sequential and time-meaningful | Physically sequential but semantically random |
| Contention | All inserts contend on one page | Spread out — the one genuine advantage |

### Takeaway

A monotonic clustering key gives dense pages, cheap appends, and a narrow locator copied into every secondary index; a random one gives fragmentation, cold pages, and a 16-byte locator multiplied across every secondary index on the table. If UUIDs are required as an external identifier, the usual compromise is to cluster on a monotonic internal key and put a unique secondary index on the UUID, or to use a time-ordered UUID variant so inserts stay near the right edge.

---

## 7. Common Mistakes

- **Reading "Index Scan" in a plan and concluding the query is optimised.** An index scan that returns 240,000 rows performs 240,000 row lookups behind that one line. The number worth looking at is the row count coming out of the index, not the access method's name.
- **Chasing an index-only scan with `SELECT *`.** Covering means containing every column the query touches, and `SELECT *` touches all of them; an index that covered it would be a second copy of the table. Name the columns you actually need first, then decide whether covering them is worth the width.
- **Clustering on a random UUID because it is the natural business key.** Every insert lands on a different full leaf and splits it, leaving pages half empty, and the 16-byte key is copied into every entry of every secondary index. Cluster on something monotonic and enforce the UUID with a unique secondary index instead.
- **Adding covering columns as key columns rather than included columns.** Key columns propagate into the internal nodes, so a wide index gets a taller tree and more pages for the same row count. Where the engine supports included columns, payload belongs there — it is only ever read at the leaf.

---

## 8. Hands-On Exercises

**Exercise 1:** Build the `orders` table from Section 3 with two million rows and a `customer_id` that repeats about 500 times. Run `SELECT total_cents FROM orders WHERE customer_id = 77` and record both the timing and, from the plan, how many rows the index returned.

**Exercise 2:** Add `idx_orders_cust_total ON orders (customer_id, total_cents)` and rerun the same query. Confirm from the plan that no table access appears at all, and compare the timing against Exercise 1.

**Exercise 3:** Reproduce the covering mistake from Section 7 on purpose. With `idx_orders_cust_total` in place, change the query to `SELECT total_cents, status FROM orders WHERE customer_id = 77` and confirm the plan goes straight back to fetching every matching row from the table.

**Exercise 4:** Create two tables with identical columns and row counts, one clustered on a monotonic `BIGINT` and one on a random UUID. Insert one million rows into each in the same order, then compare total on-disk size and the wall-clock time of the two loads.

**Exercise 5:** On both tables from Exercise 4, add an identical secondary index on `customer_id` and compare the two index sizes. Explain the difference purely from the width of the locator each entry has to carry.

---

## 9. Interview Q&A

**Q: What is a clustered index and why can a table have only one?**
A clustered index stores the actual rows in the leaf level of the index, in key order — the table and the index are the same structure. There can only be one because rows can only be physically arranged in one order at a time; a second clustering would require a second copy of every row. Everything else on the table is a secondary index, which stores only its own key columns plus a locator pointing back.

**Q: Explain the double lookup and when it becomes the dominant cost.**
A secondary index entry contains its key and a locator, not the row, so answering a query with columns outside that index means resolving each locator to an actual row. Finding the index entries is one tree descent; resolving them is one lookup per matching row, each a random access. It stays cheap for a handful of rows and dominates completely once thousands match, which is exactly why the planner switches to a sequential scan past a few percent selectivity.

**Q: What makes an index covering, and how do you design for it?**
An index covers a query when it contains every column the query references — in the `WHERE`, the `SELECT` list, `ORDER BY`, `GROUP BY`, and any join condition — so the engine can answer entirely from the index and never touch the table. You design for it by starting from a specific, high-value query, listing its columns, putting the ones needed for filtering and ordering in the key, and the rest as included columns if the engine supports them.

**Q: What is the difference between a key column and an included column?**
Key columns are sorted and appear in the internal nodes as well as the leaves, so they can be searched, range-scanned, and used to satisfy an `ORDER BY`. Included columns live only in the leaf pages: they cannot be searched or sorted on, but they are available to satisfy the projection. The practical benefit is that payload columns can be carried for covering purposes without widening the internal nodes and deepening the tree.

**Q: Why is a random UUID a poor clustering key?**
Every insert targets a uniformly random leaf, so inserts constantly land in already-full pages and split them, leaving pages roughly half full and inflating the table's size. It also destroys write locality, so the entire leaf level has to be buffer-pool resident to avoid a read per insert. On top of that the 16-byte key becomes the locator copied into every entry of every secondary index. Clustering on a monotonic key with a unique secondary index on the UUID gets the external identifier without those costs.
