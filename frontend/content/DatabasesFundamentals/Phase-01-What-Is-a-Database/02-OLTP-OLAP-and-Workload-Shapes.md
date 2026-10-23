# OLTP, OLAP, and Workload Shapes — Complete Guide

> "Ringing up one shopper's basket in twenty seconds and counting every tin in the stockroom overnight are both work in the same shop, but nobody would staff, lay out, or measure the two jobs the same way."

---

## Table of Contents

1. [The Problem: One Table, Two Irreconcilable Access Patterns](#1-the-problem-one-table-two-irreconcilable-access-patterns)
2. [The Checkout Till and Stocktake Analogy](#2-the-checkout-till-and-stocktake-analogy)
3. [The Mechanism: Row Storage and Column Storage](#3-the-mechanism-row-storage-and-column-storage)
4. [Diagram: The Same Table Laid Out Two Ways on Disk](#4-diagram-the-same-table-laid-out-two-ways-on-disk)
5. [Code Walkthrough: Two Queries Against the Same Orders Table](#5-code-walkthrough-two-queries-against-the-same-orders-table)
6. [Comparing OLTP to OLAP](#6-comparing-oltp-to-olap)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: One Table, Two Irreconcilable Access Patterns

One `orders` table with 400 million rows serves two departments. The checkout service and the finance team both say they need "the orders data", and they mean completely different physical operations.

### Two Requests, Same Table

```text
Checkout service, 12,000 times per second:
  SELECT * FROM orders WHERE order_id = 918273441;
    ↳ 1 row, 14 columns, under 2 ms — even the slowest 1 in 1000.
Finance, 40 times per day:
  SELECT country, SUM(total_cents) FROM orders
   WHERE placed_at >= DATE '2026-01-01' GROUP BY country;
    ↳ 210 million rows in range, 2 columns of the 14. Nobody cares
      whether it takes 4 seconds or 40, only that it finishes.
```

### Why the Second Query Ruins the First

```text
The aggregate reads ~180 GB, replacing a 64 GB buffer pool with pages
the checkout path will never ask for again.
  Before: 99.4% of checkout lookups served from memory → p99   1.8 ms
  During: 31%   of checkout lookups served from memory → p99 240 ms
    ↳ Nothing broke and no query was wrong; one workload simply
      evicted the other's working set.
```

### What's Missing

The two requests are not "a fast query and a slow query". They are different shapes of work — one touches a handful of rows and all their columns, the other touches a handful of columns across hundreds of millions of rows. What is missing is the recognition that a physical layout tuned for one shape is actively bad for the other, and a vocabulary for saying which shape a requirement is.

---

## 2. The Checkout Till and Stocktake Analogy

A supermarket does two kinds of counting. At the till, one shopper's basket is scanned item by item, and the whole interaction must finish in under a minute or the queue backs up. During stocktake, nobody cares about any individual basket; the team walks every aisle counting one thing — how many tins of tomatoes exist — and takes all night doing it.

### Till Work vs Stocktake Work

```text
Till       → one basket at a time, every attribute of it (item, price,
             discount, payment), answered in seconds, thirty tills at
             once, and any delay is immediately visible
Stocktake  → every shelf in the building but one attribute per pass,
             answered in hours by a few people, and nobody notices
             six hours instead of four
```

### Mapping the Analogy to Workloads

Till work is OLTP — online transaction processing: many small, concurrent, latency-sensitive operations, each touching one record end to end. Stocktake is OLAP — online analytical processing: few enormous, throughput-sensitive scans, each touching one or two attributes across everything. The shop is optimised for till work; the stocktake is deliberately scheduled for a time when it will not stand in the queue's way.

---

## 3. The Mechanism: Row Storage and Column Storage

A table is a logical grid, but disk is one-dimensional. Something has to decide the order the values are written in, and there are two obvious answers. A row store keeps all columns of one row adjacent; a column store keeps all values of one column adjacent.

### The Two Layouts

```text
Logical table: orders — order_id | customer_id | country | placed_at |
  total_cents | ... 14 columns, 400,000,000 rows
Row store on disk:
  [918273441, 3182, IE, 2026-03-02, 4290, ...][918273442, 771, FR, ...]
    ↳ One order = one page read. One column for every order = read
      every page and discard 13/14 of each.
Column store on disk:
  order_id: [918273441, 918273442, ...]  country: [IE, FR, IE, DE, ...]
  total_cents: [4290, 1150, 899, 12400, ...]   ... 11 more columns
    ↳ Summing total_cents = one contiguous run, nothing else. One whole
      order = 14 separate reads, then reassemble.
```

### Why Compression Follows the Layout

```text
country column, stored together: IE IE IE IE DE IE IE FR IE IE ...
  ↳ One data type, low cardinality, clustered runs. Dictionary plus
    run-length encoding routinely gives 5x to 20x.
Same values inside a row store: 918273441 3182 IE 2026-03-02 4290 ...
  ↳ Adjacent bytes are unrelated types with unrelated distributions,
    so general-purpose compression gets far less out of them.
```

---

## 4. Diagram: The Same Table Laid Out Two Ways on Disk

The point of the diagram is what each query is forced to read, not what it logically asks for.

### Read Amplification for Each Layout

```text
Query A: SELECT * WHERE order_id = 918273441      (OLTP shape)
Query B: SELECT country, SUM(total_cents) ...     (OLAP shape)
Query B on a ROW STORE              Query B on a COLUMN STORE
┌──────────────────────┐           ┌────┬────┬────┬────┬────┐
│ page 1: row1 row2 .. │           │ id │cust│ctry│date│cent│
│ page 2: row5 row6 .. │           │ ░░ │ ░░ │ ▓▓ │ ░░ │ ▓▓ │
│ page 3: row9 row10.. │           │ ░░ │ ░░ │ ▓▓ │ ░░ │ ▓▓ │
└──────────────────────┘           └────┴────┴────┴────┴────┘
  every page read, 13/14 discarded  ▓ = read  ░ = never touched
A → row store: 1 index descent + 1 page, ~4 KB read | column store:
    14 separate lookups, stitched back into one row
B → row store: every page, ~180 GB read | column store: 2 columns,
    compressed, ~9 GB read — roughly a 20x difference
```

### Reading the Diagram

Neither layout is faster in general; each is faster at a different shape. The row store wins Query A because one row is one contiguous thing. The column store wins Query B by a factor of roughly twenty, because it never reads the twelve columns the query did not mention and compresses the two it did. Any engine must pick a primary layout, and that choice is the single biggest reason OLTP and OLAP systems are usually separate products.

---

## 5. Code Walkthrough: Two Queries Against the Same Orders Table

Both queries below are ordinary SQL against the same logical table. What separates them is the number of rows touched and the number of columns per row.

### The Two Shapes Written Out

```sql
-- Illustrative standard SQL. OLTP shape: point lookup, all columns.
SELECT order_id, customer_id, country, placed_at, total_cents, status
  FROM orders WHERE order_id = 918273441;
-- OLTP shape: small, bounded write in a transaction.
BEGIN;
UPDATE orders SET status = 'shipped' WHERE order_id = 918273441;
INSERT INTO shipments (order_id, carrier) VALUES (918273441, 'DPD');
COMMIT;
-- OLAP shape: full-range scan, two columns, aggregate output.
  SELECT country, COUNT(*) AS orders, SUM(total_cents) / 100.0 AS revenue
    FROM orders WHERE placed_at >= DATE '2026-01-01'
GROUP BY country ORDER BY revenue DESC;   -- 210,000,000 rows scanned
```

### Recognising the Shape from a Requirement

```text
"Show the customer their order status"        → OLTP: 1 row, by key
"Take payment and mark the order paid"        → OLTP: small atomic write
"Revenue by country by month for two years"   → OLAP: 200M+ rows, 3 cols
"Which products are bought together?"         → OLAP: full-table pass
"Rebuild the recommendation model nightly"    → OLAP: everything, offline
Three questions settle it: how many rows must be touched (one, or
hundreds of millions), how many columns of each row are needed, and
whether the deadline is a user waiting or a job that has minutes.
```

---

## 6. Comparing OLTP to OLAP

Same data, same SQL dialect, opposite engineering targets. Concrete numbers make the gap easier to hold onto than adjectives.

### OLTP vs OLAP

| | OLTP | OLAP |
|---|---|---|
| Typical query | 1 row by primary key, most columns | 10^6–10^9 rows, 2–5 columns |
| Concurrency | 1,000–100,000 statements/sec | 1–100 concurrent queries |
| Target | p99 latency, single-digit ms | Throughput, seconds to minutes |
| Writes | Constant small inserts and updates | Bulk load or append, rarely updated |
| Storage layout | Row-oriented | Column-oriented |
| Working set | Hot rows, expected to fit in memory | Far larger than memory, streamed |
| Indexes | Many, narrow, on lookup keys | Few; zone maps, partition pruning |

### Where HTAP Sits

```text
HTAP = hybrid transactional/analytical processing — one system serving
both shapes without a separate copy of the data. Why it is hard:
  Layout conflict   → a table cannot be primarily row-major AND column-
                      major; something has to be duplicated
  Resource conflict → one scan can evict the whole OLTP working set
                      from a shared buffer pool (Section 1)
  Isolation cost    → analytical readers must not block writers, so
                      older row versions must be retained
Common compromise → keep the row store authoritative, maintain a
  column-oriented replica, route each query to the right one — two
  layouts and a lag, not one magic layout.
```

### Takeaway

Most organisations run two systems: a row-store transactional database of record, and a column-oriented analytical store loaded from it on a schedule or by change-data capture. The cost is the lag between them and a second system to operate; the benefit is that neither workload can starve the other. Reach for HTAP when the lag itself is the problem — a dashboard that must reflect an order placed four seconds ago — not merely because two systems sound like one too many.

---

## 7. Common Mistakes

- **Running analytics against the production transactional database because "it is only one query".** One full scan reads enough pages to evict the hot working set that every user-facing lookup depends on, turning a 2 ms p99 into a 200 ms p99 for as long as it runs. The query is not wrong and nothing errors; the damage lands entirely on the other workload, which is what makes it easy to miss in review.
- **Adding indexes to fix an analytical query on a row store.** An index helps when the answer is a small fraction of the table. A query that legitimately touches 210 million of 400 million rows is better served by a sequential scan, and the optimiser will usually say so by ignoring the index you just built — meanwhile every insert now pays to maintain it.
- **Assuming column stores are simply the faster, newer choice.** Fetching one complete row from a column store means reading and stitching every column separately, and single-row updates are expensive because they disturb compressed, sorted runs — a checkout path on a column store is slower, not faster. In the same spirit, treat "we need real-time analytics" as an unanswered question rather than a settled requirement: minutes of lag is a scheduled load, seconds is streaming change-data capture, and truly current is HTAP with all the cost that implies, so ask for the number before choosing.

---

## 8. Hands-On Exercises

**Exercise 1:** Take six requirements from a system you know — or from Section 5's list — and classify each as OLTP or OLAP. For every one, write down the three numbers that decide it: rows touched, columns needed per row, and the deadline. Flag any requirement where your three answers disagree with your gut classification, and work out which is wrong.

**Exercise 2:** On paper, size the two queries in Section 5 for a table of 400,000,000 rows averaging 450 bytes. Compute total table size, bytes read by the point lookup, bytes read by the aggregate on a row store, and bytes read by the same aggregate on a column store assuming 8-byte and 2-byte columns with 8x compression. State the ratio between the last two.

**Exercise 3:** Design the physical layout for a table of 2 billion sensor readings (`sensor_id`, `recorded_at`, `celsius`, `battery_pct`) serving two access patterns: "latest reading for one sensor" and "hourly average per sensor for the last 90 days". Write down which layout you would choose for each, and how you would keep both available — one system, two systems, or one system with a secondary structure. Justify the choice in three sentences.

**Exercise 4:** Deliberately reproduce the first mistake in Section 7 on paper. Given a 64 GB buffer pool at a 99% hit rate, a 180 GB analytical scan, and a memory hit costing 0.1 ms against a disk hit costing 6 ms, compute average lookup latency before the scan and during it, assuming the scan has evicted enough that the hit rate falls to 31%. Then compute how long the cache takes to refill at 12,000 lookups per second.

**Exercise 5:** Write two SQL statements against the same `orders` table that are as close to identical in text as you can make them while landing in opposite shape categories — for example one with `WHERE order_id = 918273441` and one with `WHERE order_id > 0`. Then write down every physical difference in how an engine would execute them, and explain why the SQL text is a poor guide to the workload shape.

---

## 9. Interview Q&A

**Q: What actually distinguishes OLTP from OLAP?**
The shape of the access, not the SQL. OLTP means many small, concurrent, latency-sensitive operations, typically one row addressed by key with most of its columns needed, on the order of thousands to tens of thousands per second with a millisecond deadline. OLAP means a small number of enormous scans that touch hundreds of millions of rows but only two or three columns of each, measured in throughput rather than latency, where seconds or minutes are acceptable. Same table, opposite optimisation targets.

**Q: Why can't one storage layout serve both well?**
Because disk is one-dimensional and the layout has to commit. A row store puts all columns of one row adjacent, so fetching one complete order is a single page read — but an aggregate over one column must read every page and throw away most of each. A column store puts all values of one column adjacent, so a two-column aggregate reads only those two runs and compresses them well, but reassembling one whole row means a dozen separate reads. Each layout is the other's worst case.

**Q: Why does a column store compress so much better?**
Because everything adjacent is the same column: one data type, one value distribution, often long runs of repeated values. A country column stores millions of values drawn from a couple of hundred distinct strings, which dictionary and run-length encoding reduce dramatically — 5x to 20x is routine. In a row store the neighbouring bytes are an integer, then a date, then a string, with nothing in common, so general-purpose compression has far less structure to exploit.

**Q: What is HTAP and why is it hard?**
HTAP is serving both transactional and analytical workloads from one system without a separate copy of the data. It is hard for three reasons: a table cannot be primarily row-major and column-major at once, so something gets duplicated; a single analytical scan can evict the transactional working set from a shared buffer pool and wreck its latency; and analytical readers must not block writers, which forces the engine to retain older row versions. Most real implementations keep a row store authoritative and maintain a column-oriented replica or in-memory column index alongside it, which is two layouts with some lag rather than one layout that does everything.

**Q: A colleague wants to run the monthly revenue report directly against production. What do you say?**
That the query is correct but the blast radius is not the query — it is the buffer pool. Reading 180 GB evicts the hot pages the checkout path depends on, so p99 latency for every user-facing lookup degrades for the whole run and for as long as the cache takes to refill afterwards. The alternatives, in order of preference, are running it against a read replica, running it against a column-oriented analytical copy, or at minimum scheduling it in a trough and capping its resource usage.
