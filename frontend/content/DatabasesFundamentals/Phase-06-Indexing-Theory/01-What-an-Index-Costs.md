# What an Index Costs — Complete Guide

> "A restaurant that prints its menu in three languages reprints all three the day one dish changes price, and the edition nobody ever reads costs exactly as much to reprint as the one everybody does."

---

## Table of Contents

1. [The Problem: The Index That Made Everything Slower](#1-the-problem-the-index-that-made-everything-slower)
2. [The Trilingual Menu Analogy](#2-the-trilingual-menu-analogy)
3. [The Mechanism: Write Amplification Storage and Buffer Pool Pressure](#3-the-mechanism-write-amplification-storage-and-buffer-pool-pressure)
4. [Code Walkthrough: Predicates That Silently Skip the Index](#4-code-walkthrough-predicates-that-silently-skip-the-index)
5. [Comparing a Used Index to a Dead One](#5-comparing-a-used-index-to-a-dead-one)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: The Index That Made Everything Slower

Adding an index to fix one slow report is a small, local, obviously-correct decision. The cost it creates is spread thinly across every write the table will ever take, and nobody attributes the slowdown back to it.

### The Report Got Faster and the Checkout Got Slower

```text
orders — 40,000,000 rows, 9 indexes already present
CREATE INDEX idx_orders_promo ON orders (promo_code);

                                        before      after
  SELECT ... WHERE promo_code = ?      1,900 ms      4 ms  ← the win
  INSERT INTO orders ...                   1.1 ms  1.3 ms  ← the bill
  ↳ 0.2 ms extra x 12,000,000 inserts/day = 40 extra minutes of
    write work every day, forever, whether or not that report is
    ever run again.
```

### What's Missing

The SELECT improvement is visible, attributable, and celebrated. The INSERT regression is 0.2 ms — below the noise floor of any single request and spread across every writer in the system. Six indexes later the checkout path is measurably slower and no single change looks responsible. What's missing is a habit of pricing an index before creating it.

---

## 2. The Trilingual Menu Analogy

A restaurant that prints one menu changes the salmon price in one place. A restaurant that prints English, Portuguese, and Japanese editions changes it in three, and pays the print shop three times — including for the edition four customers a year actually open.

### One Price Change Three Reprints

```text
Single menu     → change one price, reprint one document
Three editions  → change the same price, reprint three documents;
                  the unread edition costs exactly as much to keep
                  current as the popular one, because correctness
                  is not optional for either
```

### Mapping the Analogy to Indexes

Each index is another edition of the same facts, sorted differently. The database is not allowed to let one drift stale, so every write pays into every edition. An index nobody queries is the Japanese menu: full maintenance cost, zero readership.

---

## 3. The Mechanism: Write Amplification Storage and Buffer Pool Pressure

An index is a second physical copy of the indexed columns plus a pointer back to the row, kept permanently sorted. Three costs follow from that one sentence.

### Every Index Is a Second Copy of Its Columns

```sql
-- Illustrative standard SQL
CREATE TABLE orders (
  order_id     BIGINT      PRIMARY KEY,
  customer_id  BIGINT      NOT NULL,
  status       VARCHAR(16) NOT NULL,
  placed_at    TIMESTAMP   NOT NULL,
  promo_code   VARCHAR(32)
);
CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_placed   ON orders (placed_at);
CREATE INDEX idx_orders_status   ON orders (status);
```

### Write Amplification per Statement

```text
INSERT  1 table write + 3 index-leaf writes
      = 4 page modifications and 4 log records for 1 logical row

UPDATE orders SET status = 'shipped' WHERE order_id = 991
        1 write to the row
      + 1 delete-then-insert in idx_orders_status  ← key changed
      + 0 in idx_orders_customer and idx_orders_placed
  ↳ Only indexes holding a changed column pay, which is why an
    index on a hot column costs far more than one on a
    write-once column like placed_at.

DELETE  1 table delete + 3 index deletes — a DELETE always
        touches every index, no exceptions.
```

### Storage Buffer Pool and Recovery

```text
40,000,000 rows at ~120 bytes/row            → table ≈ 4.80 GB
idx_orders_customer  8-byte key + 8-byte locator + overhead
                     ≈ 24 bytes x 40M rows   ≈ 0.96 GB
idx_orders_status    16-byte key             ≈ 1.30 GB
9 indexes at this scale                      ≈ 9.00 GB

Buffer pool = 8 GB (Phase 5, Lesson 4)
  ↳ 13.8 GB of pages competing for 8 GB of RAM. Maintenance drags
    even unused index pages into the pool on every INSERT,
    evicting pages a live query wanted.
  ↳ 4x the write-ahead log volume is roughly 4x the redo work
    before the database accepts connections after a crash, and
    backups scale with total bytes, not just table bytes.
```

---

## 4. Code Walkthrough: Predicates That Silently Skip the Index

An index that is maintained on every write and used on no read is pure loss. Several ordinary-looking predicate shapes make it unusable.

### Functions Wildcards and Type Conversion

```sql
-- Illustrative standard SQL. idx_orders_placed ON orders (placed_at)

-- NOT usable: the column is wrapped, so the index's sort order says
-- nothing about the value actually being compared
SELECT * FROM orders WHERE EXTRACT(YEAR FROM placed_at) = 2026;
-- Usable: same question, bare column compared to a range
SELECT * FROM orders
WHERE placed_at >= DATE '2026-01-01' AND placed_at < DATE '2027-01-01';

-- idx_customers_email ON customers (email)
SELECT * FROM customers WHERE email LIKE '%@example.com'; -- NOT usable
SELECT * FROM customers WHERE email LIKE 'ana.%';         -- usable

-- account_no is VARCHAR; comparing it to a number forces a per-row
-- conversion of the indexed side
SELECT * FROM customers WHERE account_no = 400291;   -- NOT usable
SELECT * FROM customers WHERE account_no = '400291'; -- usable
```

### Low Selectivity and Tiny Tables

```text
selectivity = distinct values / total rows   (higher is better)

orders.status: 4 distinct values over 40,000,000 rows
  WHERE status = 'shipped' matches ~14,000,000 rows (35%)
  ↳ 14M index entries, each followed by a random jump to a row. A
    sequential scan reads the same 4.8 GB in page order and wins.
    The planner is right to refuse — you still pay maintenance.
  ↳ Past roughly 5-20% of rows matched, a full scan beats a
    secondary index. Crossover moves with row width and storage.

countries: 195 rows, 2 pages
  ↳ A tree descent plus a page read cannot beat reading 2 pages.
```

### Finding the Indexes Nobody Uses

```text
Engines keep per-index counters of scans and seeks since statistics
were last reset. The engine-independent procedure:
  1. Reset the counters.
  2. Let a full business cycle run — a month catches month-end close.
  3. List indexes whose read count is still zero.
  4. Exclude unique and primary-key indexes: they enforce a
     constraint and must stay even at zero reads.
  5. Rename or make invisible before dropping, so a quarterly job's
     dependency can be undone in seconds.
```

---

## 5. Comparing a Used Index to a Dead One

The two are physically identical structures with identical maintenance costs; only the read side differs, which is precisely what makes the dead one easy to miss.

### Used Index vs Dead Index

| | Used Index | Dead Index |
|---|---|---|
| INSERT cost | One extra descent and page write | Identical — the engine cannot know it is unread |
| Storage | Real bytes on disk and in backups | Identical bytes, for nothing |
| Buffer pool | Pages earn their residency by serving reads | Pages evict useful ones during maintenance only |
| Recovery time | Contributes log volume, pays it back on reads | Contributes log volume, pays nothing back |
| How to detect | Non-zero scan counters | Zero scan counters over a full business cycle |

### Takeaway

Both indexes cost the same to keep; only one returns anything. Because the cost is invisible per statement and the benefit is loud per query, tables drift toward over-indexing by default. Treat every `CREATE INDEX` as a permanent tax on writes, justified by a named query — and periodically audit for the ones whose named query no longer exists.

---

## 6. Common Mistakes

- **Adding an index per slow query without checking the existing ones.** A new index on `(customer_id)` is redundant when `(customer_id, placed_at)` already exists, because the leftmost prefix of the composite already serves it (Lesson 3). The redundant index doubles maintenance cost and adds nothing.
- **Indexing a low-cardinality column and assuming it will be used.** A `status` column with four values over 40 million rows returns 35% of the table for a common value; the planner will scan instead, so the index is maintained forever and read never.
- **Wrapping the indexed column in a function and blaming the index.** `WHERE UPPER(email) = 'ANA@EXAMPLE.COM'` cannot use a plain index on `email`, because the index is sorted by `email`, not by `UPPER(email)`. Rewrite the predicate, or build an index on the expression itself where the engine supports it.
- **Dropping an index straight to production after one quiet week.** Quarterly and year-end jobs exist. Rename it or mark it invisible first, wait out a full business cycle, then drop — reversing a rename takes seconds while rebuilding a 1 GB index on a live table does not.

---

## 7. Hands-On Exercises

**Exercise 1:** Create an `orders` table with the six columns from Section 3 and load one million rows with a script. Time a batch of 10,000 `INSERT` statements, then add the three secondary indexes and time an identical batch. Record the per-insert difference and multiply it by a realistic daily insert volume.

**Exercise 2:** Measure the storage side of the same table. Record the on-disk size of the table alone, then after each of the three indexes is added, and compute what fraction of total bytes is index rather than data.

**Exercise 3:** Write the two `placed_at` queries from Section 5 — the `EXTRACT(YEAR FROM placed_at) = 2026` version and the two-sided range version — and read the execution plan of each. Confirm one scans the table and the other descends `idx_orders_placed`.

**Exercise 4:** Reproduce the low-selectivity mistake deliberately. Index `status`, then run `WHERE status = 'shipped'` where that value covers about a third of the table, and confirm from the plan that the planner ignores the index you just paid to build. Then run `WHERE status = 'refunded'` on a value covering under 1% and confirm the plan changes.

**Exercise 5:** Reset your engine's index usage statistics, run a mixed workload for an hour, and list every index with a zero read count. For one of them, rename it rather than dropping it, run the workload again, and confirm nothing broke before removing it for real.

---

## 8. Interview Q&A

**Q: What does an index cost on the write path?**
Every index is a second sorted copy of the indexed columns plus a row locator, and the engine has to keep it consistent. An `INSERT` becomes one table write plus one descent-and-write per index; a `DELETE` touches every index; an `UPDATE` touches only the indexes containing a column that actually changed. So a table with nine indexes does roughly ten page modifications and ten log records for one logical row, which also multiplies log volume, backup size, and crash recovery time.

**Q: Why would a database ignore an index that exactly matches the WHERE clause?**
Usually selectivity. If the predicate matches a large fraction of rows — past roughly 5 to 20% depending on row width and storage — following index entries means that many random jumps to fetch rows, and a sequential scan in page order is simply cheaper. Other common reasons are a function wrapped around the indexed column, a leading wildcard in a `LIKE`, an implicit type conversion on the indexed side, or a table so small that reading it whole beats a tree descent.

**Q: How do you find indexes that are safe to drop?**
Reset the engine's per-index read counters, let a full business cycle run so weekly and monthly jobs get their turn, then list indexes still at zero reads. Exclude anything backing a primary key or unique constraint, since those enforce correctness regardless of reads. Before dropping, rename the index or mark it invisible so the change is reversible in seconds, and only remove it once the workload has run again cleanly.

**Q: Why does over-indexing happen so easily?**
Because the costs and benefits are measured on opposite sides of the ledger. The benefit is a single query going from 1,900 ms to 4 ms — visible, attributable, celebrated. The cost is a fraction of a millisecond added to every write, spread across every writer, far below the noise floor of any dashboard. Nobody ever sees the bill arrive, so indexes accumulate and are never removed.

**Q: Does an index on a rarely-updated column cost less than one on a hot column?**
Yes, on the update path specifically. An `UPDATE` only has to maintain indexes whose key columns actually changed, so an index on a write-once column like `placed_at` pays nothing on updates that touch other fields, while an index on a frequently-flipped `status` column pays a delete-and-insert every time. `INSERT` and `DELETE` still touch every index regardless, so the write-once index is cheaper, not free.
