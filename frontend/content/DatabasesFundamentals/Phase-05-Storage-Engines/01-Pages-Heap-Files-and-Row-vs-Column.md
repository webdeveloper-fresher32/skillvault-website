# Pages, Heap Files, and Row vs Column Storage — Complete Guide

> "Eggs are only sold by the dozen, so the useful question in a recipe is never how many eggs it needs but how much of the carton you were forced to buy actually gets used."

---

## Table of Contents

1. [The Problem: Reading One Row Costs the Same as Reading Two Hundred](#1-the-problem-reading-one-row-costs-the-same-as-reading-two-hundred)
2. [The Egg Carton Analogy](#2-the-egg-carton-analogy)
3. [The Mechanism: Pages and Heap Files](#3-the-mechanism-pages-and-heap-files)
4. [Diagram: One Table Laid Out Row-Major and Column-Major](#4-diagram-one-table-laid-out-row-major-and-column-major)
5. [Code Walkthrough: Counting the Pages a Query Touches](#5-code-walkthrough-counting-the-pages-a-query-touches)
6. [Comparing Row Stores to Column Stores](#6-comparing-row-stores-to-column-stores)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Reading One Row Costs the Same as Reading Two Hundred

A row in an `orders` table might be 200 bytes. Asking storage hardware for 200 bytes is not something it can do — a disk or SSD hands out fixed-size blocks, and the database asks in even larger fixed-size units on top of that.

### The Cost of Asking for One Row

```text
SELECT * FROM orders WHERE order_id = 88134;

What the query wants   →  1 row,    ~200 bytes
What the SSD delivers  →  1 block,   4096 bytes
What the database asks →  1 page,    8192 bytes  (two SSD blocks)
Rows used from that page   Bytes read   Effective cost per row
------------------------   ----------   ----------------------
 1                             8192         8192 bytes
40 (every row on the page)     8192          205 bytes

  ↳ Once a page is in memory, extra rows from it are nearly free.
    The expensive event is fetching the page at all.
```

### What's Missing

Nothing here is broken — a 200-byte read costing 8192 bytes is how block devices work. What is missing is control over *which* 200 bytes share a page with which others. Every layout decision below answers that one question.

---

## 2. The Egg Carton Analogy

A shop will not sell a single egg. Twelve leave the shelf together whether the recipe wants one or all twelve, so the real cost of an egg depends on how many of its carton-mates the recipe also needs. If every recipe needs one egg and one lemon, buying twelve eggs per recipe is waste — but a carton of eggs and a carton of lemons, drawn from separately, is not.

### Mixed Carton vs Carton Per Ingredient

```text
Mixed carton       → eggs, flour and sugar together; a recipe needing
                     only sugar still carries home the eggs
Carton per         → each ingredient alone; take the sugar carton
ingredient           and nothing else moves at all
Whole-recipe trip  → mixed carton wins: one trip instead of six
```

### Mapping the Analogy to Storage Layout

The mixed carton is a row store — one page holds every column of a few rows, so fetching a whole row is one trip. The per-ingredient carton is a column store — one page holds one column across thousands of rows, so summing that column moves nothing else. Neither is better; they answer different shopping lists.

---

## 3. The Mechanism: Pages and Heap Files

A **page** (also called a block) is the database's fixed-size unit of I/O and of caching. Nothing smaller is ever read from or written to disk.

### Typical Page Sizes

```text
PostgreSQL   8 KB (8192 bytes)    SQL Server   8 KB
InnoDB      16 KB (configurable)  SQLite       4 KB (page_size pragma)
  ↳ All sit above the device block size (512 B or 4 KB), so one
    database page is usually several hardware blocks.
```

### What Is Inside a Page

Most engines use a **slotted page**: a header, a row directory growing downward, and rows packed upward from the bottom, with free space meeting in the middle.

```text
┌────────────────────────────────────────┐ byte 0
│ Header — page id, checksum, free-space │
│ pointers, log sequence number          │
├────────────────────────────────────────┤
│ slot 1 → 7900   slot 2 → 7700   ...    │ directory grows down ▼
├────────────────────────────────────────┤
│              free space                │
├────────────────────────────────────────┤ rows grow up ▲
│ row 1  (Okafor, 2024-03-10, 88.25)     │
└────────────────────────────────────────┘ byte 8191
```

### Heap Files and Row Addresses

A **heap file** is the table's pages in no particular order: an insert goes into whichever page has room. A row's physical address is `(page number, slot number)` — PostgreSQL calls it `ctid`, Oracle calls it `ROWID`.

```sql
SELECT ctid, order_id, total FROM orders LIMIT 3;
--  ctid   | order_id | total
-- (0,1)   |    88134 |  88.25   ← page 0, slot 1
-- (0,2)   |    88135 | 219.00
-- (13,7)  |    88136 |  41.50   ← page 13: wherever free space was
```

Unordered storage is fine precisely because indexes exist: an index maps `key → (page, slot)`, so the heap needs no order of its own. Ordering the heap would serve one access path; indexes provide as many as needed over the same unordered pages. The directory indirection also lets a row shift within its page during compaction without any index pointer going stale.

---

## 4. Diagram: One Table Laid Out Row-Major and Column-Major

Take three rows of `orders` with four columns and write them to pages both ways.

### The Same Table in Both Layouts

```text
orders:  order_id | customer | order_date | total
ROW-MAJOR — one page holds whole rows
┌──────────────────────────────────────────┐
│ 88134 │ Okafor   │ 2024-03-10 │  88.25   │
│ 88135 │ Nakamura │ 2024-03-11 │ 219.00   │
│ 88136 │ Ellis    │ 2024-03-11 │  41.50   │
└──────────────────────────────────────────┘
  ↳ SELECT * WHERE order_id = 88136 → one page, done.
COLUMN-MAJOR — one page holds one column
┌─────────┐ ┌──────────┐ ┌────────────┐ ┌────────┐
│ 88134   │ │ Okafor   │ │ 2024-03-10 │ │  88.25 │
│ 88135   │ │ Nakamura │ │ 2024-03-11 │ │ 219.00 │
│ 88136   │ │ Ellis    │ │ 2024-03-11 │ │  41.50 │
└─────────┘ └──────────┘ └────────────┘ └────────┘
 order_id     customer     order_date     total
  ↳ SUM(total) → read the fourth stack only.
  ↳ SELECT * WHERE order_id = 88136 → four reads, then stitch row 3.
```

### Reading the Diagram

Position is the join key in a column store. Row 88136 is "the third entry in every stack", so rebuilding a whole row costs one read per column plus reassembly — cheap for two columns, painful for eighty.

---

## 5. Code Walkthrough: Counting the Pages a Query Touches

The arithmetic is the whole argument, so run it against a real table.

### Sizing the Table

```sql
SELECT pg_relation_size('orders')        AS bytes,
       pg_relation_size('orders') / 8192 AS pages;
--    bytes    |  pages         ↳ 10M rows at ~200 bytes = ~2 GB
-- 2048000000  | 250000            = 250,000 pages, ~40 rows/page
```

### The Same Aggregate in Both Layouts

```text
SELECT SUM(total) FROM orders;   -- touches ONE 8-byte column

Row store    → every page read to reach one column
               250,000 pages × 8 KB   = 2.0 GB
Column store → only the `total` segment read
               10,000,000 × 8 bytes   =  80 MB
  ↳ ~25x less I/O before compression; a 40-column table gives ~100x.
```

### Compression Falls Out of the Column Layout

Values in one column share a type and a narrow range, which is exactly the redundancy a compressor needs.

```text
order_date, sorted, run-length encoded:
  2024-03-10 × 41,208 │ 2024-03-11 × 39,977 │ 2024-03-12 × 44,113
    ↳ 125,298 dates stored in a few dozen bytes.
customer, dictionary encoded:
  dictionary: 0=Okafor 1=Nakamura 2=Ellis ...
  data:       0,1,2,0,0,1,2,2,0 ...  (2 bytes per row, not 24)
    ↳ A row-major page interleaves an int, a string, a date and a
      numeric, so the same algorithm reaching 10x here gets 2–4x there.
```

---

## 6. Comparing Row Stores to Column Stores

Both store the same logical table and differ only in what ends up adjacent on a page; every consequence follows from that.

### Row Store vs Column Store

| | Row Store | Column Store |
|---|---|---|
| Page contains | All columns of a few rows | One column of many rows |
| `SELECT *` by primary key | One page read | One read per column, then reassembly |
| `SUM(one_column)` over 10M rows | Reads the whole table | Reads one column segment |
| Compression ratio | Typically 2–4x | Commonly 10x or more |
| Single-row `INSERT`/`UPDATE` | One page dirtied | Touches every column segment |
| Typical workload | OLTP — point lookups, writes | OLAP — scans, aggregates, reporting |
| Examples | PostgreSQL, InnoDB, SQL Server | ClickHouse, DuckDB, Parquet, Redshift |

### Takeaway

Choose by the shape of the read, not by data volume. A workload fetching whole rows by key wants a row store no matter how many rows there are; a workload scanning three columns out of fifty wants a column store even at modest scale. Systems needing both usually keep a row store for writes and replicate into a column store for analytics rather than compromising on one layout.

---

## 7. Common Mistakes

- **Assuming `SELECT one_column` is cheaper than `SELECT *` in a row store.** Both read the same pages, because the column lives inside rows that live inside pages. The narrower projection saves network bytes and some CPU, but the I/O — the part that costs milliseconds — is identical unless a covering index (Phase 6) lets the query skip the heap entirely.
- **Using a column store for single-row writes.** Inserting one row means appending to every column segment, and updating one field means decompressing and rewriting a block. Column stores are built for bulk loads and are typically an order of magnitude worse than a row store at OLTP-style single-row traffic.
- **Estimating table size as row count times the sum of column widths.** Per-row headers (PostgreSQL adds about 24 bytes), alignment padding, the row directory, and the free space the engine deliberately leaves for updates all add up. Real tables commonly land 30–50% above the naive arithmetic, and that gap is pages, which is I/O.
- **Expecting a heap to return rows in insert order.** A heap file has no order at all, and an update can physically relocate a row to another page. Without `ORDER BY`, ordering is an accident that a vacuum, a page split, or a parallel scan can change at any time.

---

## 8. Hands-On Exercises

**Exercise 1:** Create `orders (order_id int, customer text, order_date date, total numeric)` in PostgreSQL, insert 100,000 rows with `generate_series`, then run `SELECT pg_relation_size('orders') / 8192` and divide the row count by that page count to get your real rows-per-page figure. Compare it to the 8192 / (estimated row width) prediction.

**Exercise 2:** Run `SELECT ctid, order_id FROM orders ORDER BY order_id LIMIT 20` and read the page numbers in the first component of each `ctid`. Then `UPDATE orders SET total = total + 1 WHERE order_id = 5` and re-check that row's `ctid` — note that the update moved the row rather than editing it in place.

**Exercise 3:** Run `EXPLAIN (ANALYZE, BUFFERS) SELECT SUM(total) FROM orders` and the same for `SELECT * FROM orders WHERE order_id = 500`, recording the `shared read` and `shared hit` block counts for each. The aggregate's block count should land close to your page count from Exercise 1.

**Exercise 4:** Load the same data into DuckDB with `CREATE TABLE orders AS SELECT * FROM read_csv_auto('orders.csv')`, then compare the on-disk file size against `pg_relation_size` and time the same `SUM(total)` in both engines. Explain the size gap using dictionary and run-length encoding.

**Exercise 5:** Reproduce the third mistake from Section 7 deliberately. Predict the size of `orders` as `100000 × (4 + 8 + 4 + 8)` bytes, then measure it with `pg_relation_size`. Account for the difference by adding roughly 24 bytes of row header plus 4 bytes of directory slot per row, and confirm the corrected estimate lands close.

---

## 9. Interview Q&A

**Q: Why is the page the unit of I/O rather than the row?**
Storage devices only transfer fixed-size blocks — 512 bytes or 4 KB — so a database cannot request 200 bytes even when that is all a row needs. Engines pick a page size that is a small multiple of the device block, typically 8 or 16 KB, and make it the unit of reading, writing, caching, and often locking. Buffer pool accounting, index node sizing, and the whole row-versus-column argument are downstream of that one decision.

**Q: What is inside a database page?**
A header with the page id, a checksum, free-space pointers and a log sequence number; a row directory of slot-to-offset entries; the rows themselves; and free space in between, since the directory grows down and the rows grow up. The indirection through the directory is what lets a row move within its page during compaction without invalidating any external pointer, because that pointer names a slot rather than a byte offset.

**Q: If a heap file is unordered, how does the database find a specific row?**
Through an index, which maps a key to a physical address like PostgreSQL's `ctid` — a page number plus a slot number. That is exactly why unordered storage is acceptable: sorting the heap would serve only one access path, while indexes provide as many ordered access paths as you want over the same unordered data. The price is that every insert must maintain every index, and that the heap can fragment and eventually need reclaiming.

**Q: Why does a column store read so much less data for an aggregate?**
Because a page holds one column across many rows, `SUM(total)` over a 40-column table reads only the `total` segment instead of every page. On a 10-million-row, 2 GB table that is roughly 80 MB instead of 2 GB before compression, and column-local compression usually takes another factor of five or ten off. The same property makes whole-row fetches expensive: the row is one entry in each of 40 segments and must be reassembled by position.

**Q: Why do column stores compress so much better than row stores?**
A column segment holds values of one type from one domain — dates in a narrow range, a few thousand distinct customer names, prices of similar magnitude — which is precisely the redundancy dictionary, run-length, and delta encoding exploit. A row-major page interleaves an integer, a string, a date and a numeric, so the compressor finds no repeating structure. That is why the same algorithm reaching 10x or better on columnar data typically manages only 2–4x on rows.
