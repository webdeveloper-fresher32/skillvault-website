# Table Partitioning — MySQL Complete Guide

## Table of Contents
1. [What is Partitioning?](#1-what-is-partitioning)
2. [RANGE Partitioning](#2-range-partitioning)
3. [LIST Partitioning](#3-list-partitioning)
4. [HASH and KEY Partitioning](#4-hash-and-key-partitioning)
5. [Partition Management](#5-partition-management)
6. [Partition Pruning](#6-partition-pruning)
7. [Subpartitions](#7-subpartitions)
8. [When to Use Partitioning](#8-when-to-use-partitioning)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. What is Partitioning?

Picture a table called `orders`, and it's been collecting rows for years. Today it's sitting at 500 million rows. A few things start happening that didn't used to:

- A query that used to take milliseconds now scans hundreds of millions of rows before it finds what it needs.
- `DELETE FROM orders WHERE created_at < '2020-01-01'` — cleaning up old data you don't even care about anymore — takes hours, because MySQL deletes those rows one at a time, updating indexes and undo logs the whole way through.
- Most of your queries only ever touch this year's data. But the table doesn't know that. Every scan still has to consider the possibility that a matching row is sitting in 2019's data, so it looks anyway.

You don't need a bigger server. You need MySQL to stop treating "all 500 million rows" as one indivisible blob.

---

### The filing-cabinet analogy

Think of an old-school filing cabinet holding every invoice your company has ever issued — one giant drawer, unsorted, going back a decade. Need last week's invoice? You still have to dig through the whole cabinet, because nothing tells you where "last week" starts and ends.

Now imagine relabeling the cabinet with one drawer per year: 2022, 2023, 2024, 2025, 2026. Looking for something from 2026? You open exactly one drawer. You never even touch the others.

That's partitioning. And here's the detail worth holding onto: it's still **one cabinet** — one physical piece of furniture, one table, one server. You haven't bought a second cabinet (that would be sharding, a different technique entirely). You've just organized the inside of the one you already have.

---

### The actual definition

Partitioning splits a large table into smaller physical pieces called **partitions**, while MySQL still presents it to your queries as a single logical table. You keep writing `SELECT * FROM orders` like normal — MySQL handles routing your query to the right drawer behind the scenes.

```
┌──────────────────────────────────────────────────────────────┐
│                   orders (logical table)                     │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ p_2023       │ p_2024       │ p_2025       │ p_2026         │
│ orders from  │ orders from  │ orders from  │ orders from    │
│ 2023         │ 2024         │ 2025         │ 2026           │
└──────────────┴──────────────┴──────────────┴────────────────┘

Query: WHERE created_at >= '2026-01-01' → only scans p_2026
```

**What you get out of it:**
- Faster queries on a date range — MySQL only opens the relevant drawer (this is called **partition pruning**, covered in detail in Section 6).
- Faster deletes of old data — you can drop an entire partition instead of deleting rows one by one.
- Cheap archiving — old partitions can be moved out of the table entirely.

---

## 2. RANGE Partitioning

This is the "one drawer per year" case from the analogy, made literal: rows are routed to a partition based on which range a column's value falls into.

```sql
-- Partition by year of created_at
CREATE TABLE orders (
  id          INT NOT NULL AUTO_INCREMENT,
  customer_id INT NOT NULL,
  total       DECIMAL(10,2),
  created_at  DATE NOT NULL,
  PRIMARY KEY (id, created_at)   -- partition key MUST be in PK
) PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p_2022 VALUES LESS THAN (2023),
  PARTITION p_2023 VALUES LESS THAN (2024),
  PARTITION p_2024 VALUES LESS THAN (2025),
  PARTITION p_2025 VALUES LESS THAN (2026),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

Notice that `PRIMARY KEY (id, created_at)` — not just `id`. That's not a stylistic choice, it's a rule: whatever column you partition by has to be part of every unique key on the table, including the primary key. More on why (and how this bites people) in Section 8.

### RANGE COLUMNS (multiple columns or non-integer types)

If you'd rather partition directly on a date (or a combination of columns) instead of wrapping it in a function like `YEAR()`, use `RANGE COLUMNS`:

```sql
-- Partition by date string directly
CREATE TABLE logs (
  id         BIGINT AUTO_INCREMENT,
  event_date DATE NOT NULL,
  message    TEXT,
  PRIMARY KEY (id, event_date)
) PARTITION BY RANGE COLUMNS(event_date) (
  PARTITION p_q1_2026 VALUES LESS THAN ('2026-04-01'),
  PARTITION p_q2_2026 VALUES LESS THAN ('2026-07-01'),
  PARTITION p_q3_2026 VALUES LESS THAN ('2026-10-01'),
  PARTITION p_q4_2026 VALUES LESS THAN ('2027-01-01'),
  PARTITION p_future  VALUES LESS THAN (MAXVALUE)
);
```

---

## 3. LIST Partitioning

RANGE works when your data has a natural order (dates, sequential IDs). But what about a column like `region`, where "AU" isn't less than or greater than "US" — they're just different labels? That's what LIST partitioning is for: you assign each partition an explicit set of values it's allowed to hold.

```sql
-- Partition by region
CREATE TABLE customers (
  id     INT NOT NULL,
  name   VARCHAR(100),
  region VARCHAR(20) NOT NULL,
  PRIMARY KEY (id, region)
) PARTITION BY LIST COLUMNS(region) (
  PARTITION p_apac   VALUES IN ('AU', 'NZ', 'JP', 'SG'),
  PARTITION p_europe VALUES IN ('UK', 'DE', 'FR', 'IT'),
  PARTITION p_amer   VALUES IN ('US', 'CA', 'MX', 'BR')
);
```

A row with `region = 'JP'` goes straight into `p_apac`. A row with `region = 'XX'` (not listed anywhere) gets rejected — there's no catch-all bucket unless you add one.

---

## 4. HASH and KEY Partitioning

RANGE and LIST both require you to know something meaningful about your data's distribution — years, regions. But sometimes you just want to spread rows evenly across N partitions purely for load-balancing reasons, with no natural grouping in mind. That's HASH and KEY.

```sql
-- HASH: user-defined expression, must return integer
CREATE TABLE user_events (
  id      BIGINT NOT NULL,
  user_id INT NOT NULL,
  event   VARCHAR(100),
  PRIMARY KEY (id, user_id)
) PARTITION BY HASH(user_id)
PARTITIONS 8;

-- KEY: MySQL's built-in hash (handles non-integer columns)
CREATE TABLE sessions (
  session_id VARCHAR(64) NOT NULL,
  user_id    INT,
  data       TEXT,
  PRIMARY KEY (session_id)
) PARTITION BY KEY(session_id)
PARTITIONS 16;
```

The difference between the two: with `HASH`, you supply the expression yourself and it must evaluate to an integer. With `KEY`, MySQL supplies its own internal hash function, so it can handle columns that aren't integers (like the `VARCHAR` session ID above).

**Use HASH/KEY when:** you want even distribution without specific range/list logic — you're optimizing for spreading I/O load, not for pruning based on a query pattern.

---

## 5. Partition Management

Once a table is partitioned, you get a set of operations for maintaining it that map directly to the "drawers in a cabinet" mental model — adding a drawer, emptying a drawer, removing a drawer entirely.

```sql
-- View partitions
SELECT PARTITION_NAME, TABLE_ROWS, DATA_LENGTH
FROM information_schema.PARTITIONS
WHERE TABLE_NAME = 'orders';

-- Add a new partition (RANGE/LIST only)
ALTER TABLE orders ADD PARTITION (
  PARTITION p_2027 VALUES LESS THAN (2028)
);

-- Drop a partition (deletes all rows in it — very fast!)
ALTER TABLE orders DROP PARTITION p_2022;

-- Truncate a partition (delete rows, keep structure)
ALTER TABLE orders TRUNCATE PARTITION p_2022;

-- Reorganize (split/merge partitions)
ALTER TABLE orders REORGANIZE PARTITION p_future INTO (
  PARTITION p_2027 VALUES LESS THAN (2028),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- Move partition data to another table (EXCHANGE)
-- Useful for archiving
CREATE TABLE orders_2022_archive LIKE orders;
ALTER TABLE orders_2022_archive REMOVE PARTITIONING;
ALTER TABLE orders EXCHANGE PARTITION p_2022 WITH TABLE orders_2022_archive;
```

Notice `DROP PARTITION` in there — that's the "instant delete" mentioned back in Section 1. Section 10's interview Q&A digs into exactly why it's so much faster than a row-by-row `DELETE`.

---

## 6. Partition Pruning

Here's the mechanic that makes all of this worth doing: **partition pruning**. When your `WHERE` clause mentions the partition key, MySQL can look at the ranges/lists you defined and mathematically prove that certain partitions cannot possibly contain a matching row — so it skips opening them at all. Not "scans them quickly." Skips them. Zero I/O against those partitions.

```
Query: SELECT * FROM orders WHERE YEAR(created_at) = 2026

           ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
           │ p_2023  │  │ p_2024  │  │ p_2025  │  │ p_2026  │
           └─────────┘  └─────────┘  └─────────┘  └─────────┘
                │            │            │            │
                ▼            ▼            ▼            ▼
          "can this partition contain a row where YEAR = 2026?"
                │            │            │            │
               NO           NO           NO           YES
                │            │            │            │
                ▼            ▼            ▼            ▼
            SKIPPED      SKIPPED      SKIPPED      SCANNED
```

You can watch this happen with `EXPLAIN`:

```sql
-- EXPLAIN shows which partitions are scanned
EXPLAIN
SELECT * FROM orders WHERE YEAR(created_at) = 2026\G

-- partitions: p_2026  ← only one partition scanned!

-- Without partition key in WHERE: all partitions scanned
EXPLAIN
SELECT * FROM orders WHERE customer_id = 42\G
-- partitions: p_2022,p_2023,p_2024,p_2025,p_2026  ← all scanned
```

The second query is the important lesson here. `customer_id` has nothing to do with the partitioning scheme (which is based on `created_at`). MySQL has no way to know which partition a given `customer_id` lives in, so it has no choice but to check every single one. Partition pruning only works when the partition key itself appears in the `WHERE` clause — this is the single most common way people accidentally get zero benefit from partitioning (more in Section 8).

---

## 7. Subpartitions

Sometimes one dimension of splitting isn't enough. You want to partition by year (for time-based pruning and archiving) *and* spread each year's rows evenly across several sub-buckets (for I/O distribution). That's composite partitioning — a partition that's itself further divided into subpartitions.

```sql
CREATE TABLE big_logs (
  id         BIGINT NOT NULL,
  log_date   DATE NOT NULL,
  server_id  INT NOT NULL,
  message    TEXT,
  PRIMARY KEY (id, log_date, server_id)
) PARTITION BY RANGE (YEAR(log_date))
  SUBPARTITION BY HASH(server_id)
  SUBPARTITIONS 4 (
    PARTITION p_2025 VALUES LESS THAN (2026),
    PARTITION p_2026 VALUES LESS THAN (2027)
  );
-- Creates 2 × 4 = 8 physical partitions total
```

Each of the 2 RANGE partitions (`p_2025`, `p_2026`) is itself split into 4 HASH subpartitions by `server_id` — 8 physical partitions on disk in total.

---

## 8. When to Use Partitioning

| Scenario | Use Partitioning? |
|----------|-----------------|
| Table > 50M rows with time-based queries | ✅ Yes — RANGE by date |
| Frequent purge of old data | ✅ Yes — DROP PARTITION is instant |
| Geographic/categorical segmentation | ✅ Yes — LIST partitioning |
| Tables < 10M rows | ❌ No — indexing is sufficient |
| Queries don't filter on partition key | ❌ No — no benefit from pruning |
| Joining partitioned table with small lookup | ❌ May hurt (partition overhead) |

Two mistakes worth calling out explicitly, because they're the ones that trip people up in practice:

**"I partitioned my table but queries didn't get faster."** Go back to Section 6 — if your queries filter on something other than the partition key, pruning never kicks in, and you're scanning every partition anyway. Worse, you've now added overhead (MySQL has to check partition boundaries, open more files) for zero benefit. Partitioning is not a free performance upgrade; it only pays off when your actual query patterns filter on the partition key.

**"MySQL won't let me create my unique/primary key."** This is the rule you saw quietly enforced back in Section 2: every unique key on a partitioned table (including the primary key) must include the partitioning column. Why? Because MySQL enforces uniqueness *per partition*, not globally across the whole table — so if the partition key weren't part of the unique key, MySQL couldn't guarantee uniqueness without checking every partition on every insert, which defeats the purpose. This is exactly why `orders` above uses `PRIMARY KEY (id, created_at)` instead of just `PRIMARY KEY (id)`.

---

## 9. Hands-On Exercises

**Exercise 1:** Create a RANGE-partitioned `sales` table by year (2022-2026 + future). Insert rows in various years and verify they go to correct partitions using `information_schema.PARTITIONS`.

**Exercise 2:** Run EXPLAIN on a query with and without the partition key in WHERE. Compare the `partitions` column to see pruning in action.

**Exercise 3:** Drop the oldest partition from your sales table. Time how fast it is vs `DELETE FROM sales WHERE year = 2022`.

**Exercise 4:** Add a new 2027 partition by reorganizing the `p_future` partition.

**Exercise 5:** Create a LIST-partitioned `customers` table by country. Insert customers from different countries and verify partition distribution.

---

## 10. Interview Q&A

**Q: What is table partitioning in MySQL?**
Answer: Partitioning splits a table's rows into separate physical storage units (partitions) based on a partition key, while appearing as one logical table. MySQL routes INSERT/SELECT/DELETE to the correct partition automatically. Benefits: faster range queries (pruning), instant bulk deletes (DROP PARTITION), better I/O locality.

**Q: What is partition pruning?**
Answer: Partition pruning is MySQL's ability to skip scanning irrelevant partitions when the WHERE clause includes the partition key. For example, if a table is partitioned by year and you query WHERE year=2026, MySQL only reads the 2026 partition. Without the partition key in WHERE, all partitions are scanned.

**Q: Why is dropping a partition faster than DELETE?**
Answer: `DROP PARTITION` removes the entire partition file from disk — it's a metadata operation that takes milliseconds regardless of row count. `DELETE FROM table WHERE ...` removes rows one by one, maintaining indexes and undo logs, which is O(n) in time and I/O. For data archiving, DROP PARTITION can be millions of times faster.

**Q: What are the limitations of MySQL partitioning?**
Answer: The partition key must be part of all unique keys (including PRIMARY KEY). You can't partition a table with foreign key constraints. Maximum of 8192 partitions per table. Functions allowed in partition expressions are limited. Not all query types benefit — non-prunable queries scan all partitions.

**Q: When should you NOT use partitioning?**
Answer: Avoid partitioning when the table is small (indexing is faster), when queries rarely use the partition key (no pruning benefit), or when you need foreign keys (not supported with partitioned tables). Partitioning adds operational complexity — only use it when the table is large and you have clear time/range-based access patterns.

> **Memory hook:** Partitioning is one filing cabinet with labeled drawers, not a second cabinet — you open only the drawer the label proves has what you need, and if your query doesn't mention the label on the drawer, you're back to searching all of them.
