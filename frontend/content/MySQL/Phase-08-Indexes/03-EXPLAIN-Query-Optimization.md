# EXPLAIN & Query Optimization — MySQL Complete Guide

## Table of Contents
1. [EXPLAIN Basics](#1-explain-basics)
2. [EXPLAIN Output Columns](#2-explain-output-columns)
3. [The `type` Column — Access Methods](#3-the-type-column--access-methods)
4. [The `Extra` Column](#4-the-extra-column)
5. [EXPLAIN FORMAT=JSON](#5-explain-formatjson)
6. [EXPLAIN ANALYZE (MySQL 8.0)](#6-explain-analyze-mysql-80)
7. [Optimization Workflow](#7-optimization-workflow)
8. [Index Hints](#8-index-hints)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. EXPLAIN Basics

Here's a scenario every backend developer eventually runs into: a query that used to feel instant now takes 8 seconds instead of 8 milliseconds. Nothing in the query looks obviously wrong. The table just grew. So — how do you find out *why* it's slow, without guessing, without randomly adding indexes and hoping?

That's exactly the question EXPLAIN answers.

Think of EXPLAIN as asking MySQL to show you its plan *before* it commits to running anything — like asking a delivery driver "which route are you planning to take?" before they actually drive off. You get to see the route (which indexes it'll use, which table it reads first, whether it needs to sort afterwards) without paying the cost of the actual trip.

So, in plain terms: **EXPLAIN shows the execution plan MySQL will use — without running the query.**

```sql
EXPLAIN SELECT * FROM orders WHERE customer_id = 42;

EXPLAIN SELECT o.id, c.name
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status = 'paid';
```

It also works with INSERT, UPDATE, DELETE (MySQL 8.0+) — handy because those can be just as slow as a SELECT if they're scanning a huge table:
```sql
EXPLAIN DELETE FROM sessions WHERE expires_at < NOW();
```

---

## 2. EXPLAIN Output Columns

Run EXPLAIN and MySQL hands you back a row (or several rows, for joins) full of columns. At first glance it looks like cryptic diagnostic output — a bit like a doctor's lab report full of abbreviations you don't recognize yet. So let's decode it, column by column.

```
+----+-------------+-------+-------+---------------+---------+---------+-------+------+-------------+
| id | select_type | table | type  | possible_keys | key     | key_len | ref   | rows | Extra       |
+----+-------------+-------+-------+---------------+---------+---------+-------+------+-------------+
|  1 | SIMPLE      | users | ref   | idx_email     | idx_email| 402    | const |    1 | Using index |
+----+-------------+-------+-------+---------------+---------+---------+-------+------+-------------+
```

| Column | Meaning |
|--------|---------|
| `id` | Query block number. Same id = same SELECT; higher id = subquery |
| `select_type` | Type of SELECT (SIMPLE, PRIMARY, SUBQUERY, DERIVED, UNION) |
| `table` | Which table this row refers to |
| `type` | **Access method — most important column** |
| `possible_keys` | Indexes MySQL could use |
| `key` | Index MySQL actually chose |
| `key_len` | Bytes of the index used (longer = more columns used) |
| `ref` | What's being compared to the index key (const, column name) |
| `rows` | **Estimated rows examined** — lower is better |
| `filtered` | % of rows remaining after WHERE filter |
| `Extra` | Additional info — see section 4 |

Two columns matter far more than the rest for spotting slow queries: `type` and `Extra`. That's where nearly every real-world diagnosis starts — so those get the deep dive next.

---

## 3. The `type` Column — Access Methods

If EXPLAIN is a diagnostic report, `type` is the one line the doctor circles in red pen. Every other column is supporting detail — `type` is the actual verdict on how much work MySQL had to do to find your rows.

Picture two ways of finding a name in a phone book:

- Flip straight to the page it must be on, because the book is alphabetically sorted — one lookup, done.
- Start at page one and read every single entry until you either find the name or reach the last page.

The first is an index lookup. The second is a full table scan. `type` tells you which one just happened — and MySQL has several shades in between, ranked from "found it instantly" down to "read the whole book."

**Basic definition:** `type` (sometimes called the *access method* or *join type*) describes the strategy MySQL used to retrieve rows for a table — ranging from a single-row constant lookup to scanning every row in the table.

### How the ranking works, visually

```
BEST ─────────────────────────────────────────────────────► WORST
                                                      (fewer rows read)                                    (more rows read)

system → const → eq_ref → ref → fulltext → ref_or_null → index_merge → range → index → ALL
  │         │        │       │                                              │       │      │
  │         │        │       │                                              │       │      └─ full table scan,
  │         │        │       │                                              │       │         no index used at all
  │         │        │       │                                              │       └─ full index scan
  │         │        │       │                                              │          (still reads everything,
  │         │        │       │                                              │           but reads the smaller
  │         │        │       │                                              │           index instead of the table)
  │         │        │       │                                              └─ index range scan
  │         │        │       │                                                 (BETWEEN, >, <, IN)
  │         │        │       └─ non-unique index match
  │         │        │          (could return several rows)
  │         │        └─ unique index match found
  │         │           via a join (one row guaranteed)
  │         └─ PK/unique lookup on a
  │            literal constant (one row)
  └─ table has 0 or 1 row total
```

Notice the pattern: the further left you are, the fewer rows MySQL had to touch to get your answer. The further right, the more of the table it had to wade through. Your job, every time you read an EXPLAIN plan, is simply to ask: *"where does my query sit on this line, and can I nudge it further left?"*

### Example

```sql
EXPLAIN SELECT * FROM orders WHERE customer_id = 42;
```

If `customer_id` has a non-unique index, you'd expect `type = ref` — MySQL jumps straight to the matching rows via the index, rather than reading the whole table. If there's no index on `customer_id` at all, you'd see `type = ALL` — a full table scan, checking every row to see if it matches.

### Compare: all the `type` values, ranked

| type | Description | Example |
|------|-------------|---------|
| `system` | Table has 0 or 1 rows | System table |
| `const` | PK or unique = single row | `WHERE id = 5` |
| `eq_ref` | Unique join — one row per combination | JOIN on PK/unique |
| `ref` | Non-unique index — multiple rows possible | `WHERE email = 'x'` |
| `fulltext` | FULLTEXT index used | MATCH...AGAINST |
| `ref_or_null` | Like ref but also searches for NULLs | `WHERE col = 'x' OR col IS NULL` |
| `index_merge` | Multiple indexes combined | Complex OR conditions |
| `range` | Index range scan | `WHERE id BETWEEN 1 AND 100` |
| `index` | Full index scan (better than ALL) | `ORDER BY indexed_col` |
| `ALL` | **Full table scan — avoid this!** | No usable index |

```
Goal: get type to const, eq_ref, ref, or range
Alarm: type = ALL on large tables → add an index!
```

### Common mistakes

- **Treating `rows` as an exact count.** It's the optimizer's *estimate* based on index statistics, not the actual number of rows read. On a heavily skewed table, the estimate can be wildly off — that's exactly what EXPLAIN ANALYZE (section 6) is for, since it shows real numbers.
- **Assuming `type = index` is fine because it's "using an index."** It still reads every entry in that index, top to bottom — it's a full scan, just of a smaller structure than the table. Don't confuse it with `ref` or `range`, which skip straight to the relevant rows.
- **Chasing `const`/`eq_ref` everywhere.** For a large table, `ref` or `range` is often perfectly acceptable. Not every query needs to bottom out at a single-row lookup — the real alarm bell is `ALL` on a large table, not "not being const."

**Interview answer:** "The `type` column in EXPLAIN tells you the access method MySQL used for a table, ranked from best to worst: `system`/`const` (at most one row), `eq_ref`/`ref` (index lookups returning one or a few rows), `range` (a bounded index scan), `index` (a full scan of the index rather than the table), down to `ALL` (a full table scan). The higher up that list a query lands, the fewer rows MySQL had to examine — so on a large table, seeing `type = ALL` is the single biggest red flag that an index is missing or not being used."

> **Memory hook:** "`const` is finding the name on the page you flipped straight to; `ALL` is reading the whole phone book cover to cover."

---

## 4. The `Extra` Column

If `type` is the doctor's headline verdict, `Extra` is the fine print in the report — the notes that say "also noticed this" or "had to run an additional test to be sure." It's easy to skim past it, but it's often where the *actual* slowness is hiding, even when `type` looks perfectly reasonable.

Here's why that matters: you can have `type = ref` (a nice, respectable access method) and *still* have a slow query, because `Extra` says `Using filesort` or `Using temporary` — meaning MySQL found the rows quickly, but then had to do expensive extra work afterwards to sort or group them. `type` tells you how rows were *found*; `Extra` tells you what happened *after*.

### The values to watch for

| Extra value | Meaning | Good/Bad |
|-------------|---------|---------|
| `Using index` | Covering index — no table lookup | ✅ Best |
| `Using where` | Filter applied after index read | ✅ Normal |
| `Using index condition` | Index condition pushdown | ✅ Good |
| `Using filesort` | Extra sort pass (not index sort) | ⚠️ Add sort index |
| `Using temporary` | Temp table created (GROUP BY, DISTINCT, UNION) | ⚠️ Investigate |
| `Using join buffer` | No index on join column | ⚠️ Add FK index |
| `Impossible WHERE` | WHERE is always false | ℹ️ Bug in query |
| `Select tables optimized away` | Aggregate on index (MIN/MAX) — instant | ✅ Great |

Two of these deserve special attention, because they show up constantly in interviews and in real production slow-query logs: `Using filesort` and `Using temporary`.

**"Using filesort"** doesn't actually mean MySQL writes a file to disk (despite the name) — it means MySQL couldn't rely on an index to hand back rows already in the right order, so it had to do a separate sorting pass (in memory, or on disk if the result set is big) after fetching the rows. The fix is almost always the same: add an index that matches your `ORDER BY` column(s) and direction, so the index itself hands back rows pre-sorted.

```sql
-- "Using filesort" fix: add index matching ORDER BY
-- Before:
SELECT * FROM orders ORDER BY created_at DESC;
-- Extra: Using filesort

-- After:
CREATE INDEX idx_created_at ON orders(created_at);
-- Extra: (none) — sorts via index
```

**"Using temporary"** means MySQL had to build an actual temporary table to process the query — typically triggered by `GROUP BY` on a non-indexed column, `DISTINCT`, or `UNION`. It's a heavier operation than filesort, and it gets worse as the result set grows. The fix is usually adding an index that supports the grouping, or rewriting the query so it doesn't need an intermediate table at all.

### Common mistakes and confusions

- **Reading `rows` as an exact number.** As mentioned above, it's an *estimate* from index statistics — not what actually got examined. Don't treat a low `rows` estimate as proof the query is fast; verify with EXPLAIN ANALYZE if you're not sure.
- **Ignoring `Extra` warnings because `type` looks fine.** A `ref` or `range` access type with `Using filesort` or `Using temporary` tacked on can still be the slowest part of the query. Always read `Extra` — don't stop at `type`.
- **Panicking over `Using where`.** This one is completely normal — it just means MySQL applied a filter condition after reading rows via the index. It's not a warning sign by itself.
- **Not realizing multiple `Extra` values can appear together**, e.g. `Using where; Using index; Using filesort`. Read the whole string, not just the first phrase.

**Interview answer:** "The `Extra` column shows additional operations MySQL performs beyond the basic access method in `type`. The two most important warning signs are `Using filesort`, which means MySQL needed a separate sort step because it couldn't get pre-sorted rows from an index — fixed by indexing the `ORDER BY` columns — and `Using temporary`, which means MySQL built a temp table, usually from `GROUP BY`, `DISTINCT`, or `UNION` — fixed by indexing the grouped columns or rewriting the query. A query can have a good `type` value and still be slow if `Extra` shows one of these."

> **Memory hook:** "`type` says how fast MySQL *found* the rows; `Extra` confesses what extra chores it did afterwards — filesort is 'sorted the pile by hand,' temporary is 'built a whole new table to sort it out.'"

---

## 5. EXPLAIN FORMAT=JSON

The tabular EXPLAIN output is great for a quick read, but sometimes you want the deeper diagnostic detail — the equivalent of asking the doctor "can I see the actual lab numbers, not just the summary?" That's what `FORMAT=JSON` gives you: the same plan, but with cost estimates attached to each step.

```sql
EXPLAIN FORMAT=JSON
SELECT * FROM orders WHERE customer_id = 42 AND status = 'paid'\G
```

```json
{
  "query_block": {
    "select_id": 1,
    "cost_info": { "query_cost": "1.10" },
    "table": {
      "table_name": "orders",
      "access_type": "ref",
      "key": "idx_customer_status",
      "rows_examined_per_scan": 3,
      "rows_produced_per_join": 3,
      "filtered": "100.00",
      "cost_info": { "read_cost": "0.80", "eval_cost": "0.30" }
    }
  }
}
```

The `query_cost` gives a comparative cost number — lower is better.

---

## 6. EXPLAIN ANALYZE (MySQL 8.0)

Runs the query AND shows actual execution stats (not just estimates):

```sql
EXPLAIN ANALYZE
SELECT o.id, c.name
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status = 'paid'\G
```

```
-> Nested loop inner join  (cost=12.35 rows=18) (actual time=0.082..1.234 rows=18 loops=1)
    -> Filter: (o.status = 'paid')  (cost=3.45 rows=18) (actual time=0.056..0.891 rows=18 loops=1)
        -> Index scan on o using idx_status  (cost=3.45 rows=18) (actual time=0.042..0.754 rows=18 loops=1)
    -> Single-row index lookup on c using PRIMARY (c.id=o.customer_id)  (actual time=0.019..0.019 rows=1 loops=18)
```

Shows `actual time` and `actual rows` — compare to estimated rows to spot optimizer mistakes.

---

## 7. Optimization Workflow

```
Step 1: Find slow queries
─────────────────────────
-- Enable slow query log
SET GLOBAL slow_query_log = 1;
SET GLOBAL long_query_time = 1;   -- log queries > 1 second
-- Log file: /var/log/mysql/mysql-slow.log
-- Or use: SHOW PROCESSLIST to find current slow queries

Step 2: Run EXPLAIN
────────────────────
EXPLAIN SELECT ...;

Step 3: Look for issues
────────────────────────
type=ALL on large table → add index
Using filesort → add index matching ORDER BY
Using temporary → refactor GROUP BY or add index
rows=huge number → index not selective enough

Step 4: Add/change index
─────────────────────────
CREATE INDEX idx_name ON table(columns);

Step 5: Re-run EXPLAIN
───────────────────────
Verify type improved, rows decreased, Extra improved

Step 6: Test in production
───────────────────────────
Monitor query time, check EXPLAIN ANALYZE
```

---

## 8. Index Hints

Force or prevent MySQL from using specific indexes:

```sql
-- Force a specific index
SELECT * FROM orders FORCE INDEX (idx_status) WHERE status = 'paid';

-- Suggest an index (optimizer still decides)
SELECT * FROM orders USE INDEX (idx_status) WHERE status = 'paid';

-- Ignore a specific index
SELECT * FROM orders IGNORE INDEX (idx_old_unused) WHERE status = 'paid';
```

Use hints sparingly — they override the optimizer and can backfire as data changes.

---

## 9. Hands-On Exercises

**Exercise 1:** Run EXPLAIN on a query without indexes. Note type=ALL. Add an index, re-run EXPLAIN. Document how type, key, and rows change.

**Exercise 2:** Write a query with ORDER BY on an un-indexed column. EXPLAIN shows "Using filesort". Add an index to eliminate it.

**Exercise 3:** Create a covering index for a specific SELECT query. Verify Extra shows "Using index".

**Exercise 4:** Use EXPLAIN ANALYZE (MySQL 8.0) on a JOIN query. Compare estimated rows to actual rows. Are they close?

**Exercise 5:** Enable slow query log for 1 second threshold. Run a query that takes >1s (use a large table or SLEEP(2)). Find it in the slow log.

---

## 10. Interview Q&A

**Q: What does EXPLAIN show you?**
Answer: EXPLAIN shows MySQL's query execution plan — which indexes it will use, in what order it joins tables, how many rows it estimates examining, and what extra operations (sorting, temp tables) it needs. It doesn't run the query but shows how MySQL plans to run it.

**Q: What is the best `type` value in EXPLAIN and what does it mean?**
Answer: `const` is best — MySQL finds exactly one row using a PK or unique index lookup, treating it as a constant. `eq_ref` is next best for JOINs. `ALL` is worst — full table scan. For large tables, `ref` or `range` is usually acceptable.

**Q: What does "Using filesort" mean and how do you fix it?**
Answer: "Using filesort" means MySQL must do an extra sort pass in memory (or on disk) because it can't use an index to serve the ORDER BY. Fix it by adding an index that matches the ORDER BY column order and direction.

**Q: What does "Using temporary" mean?**
Answer: MySQL creates a temporary table to process the query — common with GROUP BY on non-indexed columns, DISTINCT, or UNION. It can be slow for large datasets. Fix by adding an appropriate index or rewriting the query.

**Q: What is the difference between EXPLAIN and EXPLAIN ANALYZE?**
Answer: EXPLAIN shows estimated execution plan without running the query. EXPLAIN ANALYZE actually runs the query and shows both estimated and actual row counts and timing. It's more accurate but slower because it executes the query.
