# Index Fundamentals — MySQL Complete Guide

## Table of Contents
1. [What is an Index?](#1-what-is-an-index)
2. [B-Tree Structure](#2-b-tree-structure)
3. [How MySQL Uses Indexes](#3-how-mysql-uses-indexes)
4. [Creating and Dropping Indexes](#4-creating-and-dropping-indexes)
5. [Automatic Indexes](#5-automatic-indexes)
6. [Index Overhead](#6-index-overhead)
7. [Cardinality](#7-cardinality)
8. [When NOT to Add an Index](#8-when-not-to-add-an-index)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. What is an Index?

Picture this: your `orders` table has 5 million rows. Someone runs:

```sql
SELECT * FROM orders WHERE customer_id = 42;
```

With no help, MySQL has exactly one option — start at row 1, check it, move to row 2, check it, and keep going until it's looked at all 5 million rows. Most of them won't even match. That's called a **full table scan**, and it's the thing you want to avoid.

Sound familiar? It's the same problem as a 900-page book with no index at the back. If you want every mention of "transactions," you either flip through all 900 pages one at a time, or you flip to the index, see "transactions → pages 142, 156, 203," and jump straight there. Same book, wildly different amount of effort.

That's exactly what a database index does. Formally:

> An index is a **separate data structure** that stores a sorted copy of one or more columns, along with pointers back to the original table rows.

It doesn't change your data — it's an extra, sorted lookup structure sitting alongside it, purely so MySQL can find rows fast instead of checking every single one.

```
Without index:
SELECT * FROM orders WHERE customer_id = 42;
→ MySQL reads EVERY row (full table scan) — O(n) time

With index on customer_id:
→ MySQL traverses the B-tree → finds customer_id=42 → jumps to rows — O(log n) time
```

O(n) versus O(log n) doesn't sound dramatic until you plug in real numbers: for 5 million rows, a full scan checks 5,000,000 rows; a B-tree lookup checks roughly 23. That's the entire pitch for indexes in one comparison.

---

## 2. B-Tree Structure

So how does MySQL actually pull off that O(log n) trick? It doesn't magically know where row 42 lives — it narrows down the search step by step, the same way you'd search a phone book: open to the middle, decide "left half or right half," and repeat, instead of reading every name from the start.

That narrowing-down structure is called a **B-Tree (Balanced Tree)**, and it's MySQL's default index type:

```
                    ┌─────────┐
                    │  Root   │
                    │  50|100 │
                    └────┬────┘
           ┌─────────────┼─────────────┐
      ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
      │ 10|30   │   │ 60|80   │   │ 110|150 │
      └────┬────┘   └────┬────┘   └────┬────┘
    ┌──┬──┬──┐       ┌──┬──┐       ┌──┬──┬──┐
   10  20 30  40    60  70  90   110 130 160
   ↓   ↓   ↓   ↓    ↓   ↓   ↓    ↓   ↓   ↓
  row row row row  row row row  row row row
```

Walk through what happens when MySQL looks for value `70`:

1. Start at the **Root**. It sees `50 | 100`. Since 70 is between 50 and 100, it goes to the middle child.
2. At `60 | 80`, since 70 sits between 60 and 80, it goes to the middle leaf group.
3. It scans that small leaf node — `60, 70, 90` — finds `70`, and follows the pointer straight to the matching row.

Three hops. Not five million. That's the whole trick: every level of the tree eliminates a huge chunk of the search space, the same way "left half or right half" eliminates half a phone book at each step.

A few properties worth knowing by name:

- **Balanced**: all leaf nodes sit at the same depth — no branch is ever "deeper" than another, so lookups take a predictable number of hops.
- **Sorted**: values are always maintained in sorted order, which is exactly what lets range and comparison queries work.
- **Self-adjusting**: MySQL rebalances the tree automatically as rows are inserted and deleted — you never manually maintain it.
- **Supports**: `=`, `<`, `>`, `BETWEEN`, `LIKE 'prefix%'`, `ORDER BY` — anything that can be answered by "narrow down using sorted order."

---

### InnoDB's twist: the clustered index

Here's the part that's specific to MySQL (InnoDB, its default storage engine) and comes up constantly in interviews: **the leaf nodes of the primary key's B-tree don't just contain pointers — they contain the actual row data.**

In other words, your table's rows are physically stored, on disk, sorted by primary key, inside the PK's own B-tree. This is called the **clustered index**, and every InnoDB table has exactly one (built from its primary key).

```
Clustered index (built on PRIMARY KEY):

                ┌─────────┐
                │  Root   │
                │  id: 50 │
                └────┬────┘
        ┌────────────┴────────────┐
   ┌────▼────┐               ┌────▼────┐
   │ id: 1-49│               │id: 50-99│
   └────┬────┘               └────┬────┘
        │                          │
        ▼                          ▼
  ┌──────────────┐          ┌──────────────┐
  │ id=1: FULL ROW│         │ id=50: FULL ROW│
  │ id=2: FULL ROW│         │ id=51: FULL ROW│
  │  ... etc      │         │  ... etc       │
  └──────────────┘          └──────────────┘
  ↑ leaf nodes ARE the table data — no separate pointer needed
```

Compare that to a **secondary index** — any index you create on a non-PK column (like `customer_id` or `email`). Its leaf nodes don't store the full row. They store the indexed column's value plus the **primary key value**, which acts as a pointer back into the clustered index.

```
Secondary index (e.g. on customer_id):

  leaf node: customer_id=42 → PK=1057
                     │
                     ▼
        Look up PK=1057 in the clustered index
                     │
                     ▼
              Fetch the full row

This two-step hop (secondary index → clustered index → row)
is called a "bookmark lookup."
```

So a query filtering on a secondary index column takes one extra hop compared to filtering by primary key directly. That's why PK lookups are the fastest possible access path in InnoDB.

**Clustered vs. secondary index, side by side:**

| | Clustered Index | Secondary Index |
|---|---|---|
| Built from | The `PRIMARY KEY` | Any other indexed column(s) |
| How many per table | Exactly one | As many as you create |
| Leaf node contains | The full row data | Indexed column value + PK value |
| Lookup cost | One hop (data is right there) | Two hops (index → PK → row) |
| If no PK exists | InnoDB picks a unique NOT NULL key, or generates a hidden row ID | N/A |

**Common mistakes people make here:**

- Assuming every column that shows up in a `WHERE` clause needs its own index "just in case." Every extra index has a cost (more on that in Section 6) — index only what your actual queries need.
- Not realizing the primary key *is* the clustered index — many developers think of the PK as "just a constraint," missing that it also dictates the physical on-disk order of every row.
- Forgetting that secondary indexes store the PK as their pointer, not a raw disk address. This is actually a good thing — it means secondary indexes don't need to be rewritten if InnoDB physically moves a row — but it also means a long or wide primary key makes *every* secondary index larger, since the PK value is duplicated into each one.

**Interview answer:** "InnoDB's primary key is the clustered index — the table's rows are physically stored, sorted, inside the PK's B-tree, so leaf nodes hold the actual row data. Any other index is a secondary index: its leaf nodes hold the indexed value plus the PK value, so a secondary index lookup means first finding the PK in the secondary index, then using that PK to look up the full row in the clustered index — two hops instead of one."

> **Memory hook:** "The primary key IS the book — secondary indexes are sticky notes that just say 'see page X.'"

---

## 3. How MySQL Uses Indexes

Knowing indexes exist is one thing. Knowing whether MySQL is *actually using* one for a given query is another — and that's where `EXPLAIN` comes in. Think of it as asking MySQL "what's your plan for this query?" before it runs.

Watch what happens to the plan before and after adding an index:

```sql
-- Full table scan (no index on email)
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';
-- type: ALL  ← bad — scans every row

-- Add index
CREATE INDEX idx_email ON users(email);

-- Index seek (with index)
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';
-- type: ref  ← good — jumps to matching rows

-- LIKE with prefix — uses index
WHERE name LIKE 'John%'    -- ✅ can use index (starts-with)

-- LIKE with wildcard at start — cannot use index
WHERE name LIKE '%John'    -- ❌ full scan required

-- Function on indexed column — cannot use index
WHERE YEAR(created_at) = 2025   -- ❌ full scan
WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01'  -- ✅ range
```

Notice the pattern in those last two blocks: MySQL can only use the sorted order of an index if it can compare against it *directly*. The moment you wrap the column in a function, or anchor a `LIKE` pattern with a leading `%`, MySQL has no sorted starting point to jump to — so it falls back to checking every row.

**Full table scan vs. index seek, compared:**

| | Full Table Scan (`type: ALL`) | Index Seek (`type: ref`/`range`) |
|---|---|---|
| What it does | Reads every row, checks each one | Jumps straight to matching rows via the B-tree |
| Cost | O(n) — grows with table size | O(log n) — barely grows with table size |
| When MySQL picks it | No usable index, or the optimizer decides a scan is actually cheaper (e.g., matching most of the table anyway) | A `WHERE`/`JOIN`/`ORDER BY` column has a suitable index and a sargable condition |

> A "sargable" condition, by the way, is just a fancy way of saying "an index can actually be used for this" — no functions wrapping the column, no leading wildcard.

---

## 4. Creating and Dropping Indexes

Enough theory — here's the actual syntax for creating, and removing, indexes.

```sql
-- Create index (after table creation)
CREATE INDEX idx_last_name ON employees(last_name);

-- Create unique index
CREATE UNIQUE INDEX idx_email ON users(email);

-- Create composite index
CREATE INDEX idx_dept_salary ON employees(department, salary);

-- Create index inline in CREATE TABLE
CREATE TABLE products (
  id    INT PRIMARY KEY,
  name  VARCHAR(200),
  price DECIMAL(10,2),
  INDEX idx_price (price),             -- regular index
  UNIQUE INDEX idx_sku (sku)           -- unique index
);

-- Drop index
DROP INDEX idx_last_name ON employees;
ALTER TABLE employees DROP INDEX idx_last_name;  -- equivalent

-- List all indexes on a table
SHOW INDEX FROM employees;
```

---

## 5. Automatic Indexes

Here's something that trips people up: you don't always have to type `CREATE INDEX` yourself. The moment you declare certain constraints, MySQL quietly builds an index for you, behind the scenes.

```sql
CREATE TABLE orders (
  id          INT PRIMARY KEY,          -- AUTO: clustered B-tree PK index
  customer_id INT NOT NULL,
  reference   VARCHAR(50) UNIQUE,       -- AUTO: unique index
  FOREIGN KEY (customer_id) REFERENCES customers(id)  -- AUTO: FK index (InnoDB)
);
```

| Constraint | Index Created |
|------------|--------------|
| PRIMARY KEY | Clustered index (data stored in PK order) |
| UNIQUE | Non-clustered unique index |
| FOREIGN KEY (InnoDB) | Index on the FK column |

As Section 2 covered in depth, the **clustered index** in InnoDB stores the actual row data in the leaf nodes of the PK B-tree — this is why accessing rows by PK is the fastest access path you can get.

---

## 6. Index Overhead

Here's the catch nobody mentions when they first tell you "just add an index." Indexes are not free — they cost something every time you write:

```
Every INSERT:  must update all indexes → slower
Every UPDATE:  if indexed column changes → index update
Every DELETE:  must remove from all indexes

Storage:      each index = additional disk space
Memory:       InnoDB caches indexes in buffer pool

Rule of thumb: more indexes = faster reads, slower writes
```

```sql
-- See index sizes
SELECT
  index_name,
  ROUND(stat_value * @@innodb_page_size / 1024 / 1024, 2) AS size_mb
FROM mysql.innodb_index_stats
WHERE database_name = 'mydb' AND table_name = 'orders' AND stat_name = 'size';
```

---

## 7. Cardinality

Not every index pulls its weight. Whether an index is actually *useful* comes down to a single concept: **cardinality** — the number of distinct values in that column. The higher the cardinality, the more selective the index (the more rows it can rule out per lookup).

```sql
SHOW INDEX FROM orders;
-- Column: Cardinality
-- PRIMARY key: cardinality ≈ total rows (most selective)
-- status ENUM: cardinality = 3-5 (very low — bad for index)
-- customer_id: cardinality = thousands (good for index)
```

```
High cardinality (good index):          Low cardinality (poor index):
customer_id: 50,000 unique values       status: 3 unique values
email: 100,000 unique values            gender: 2 unique values
→ index skips 99.999% of rows          → index still scans ~50% of rows
```

The takeaway: an index on `status` with only 3 possible values doesn't narrow things down much — MySQL still has to sift through roughly a third of the table either way, so it may just skip the index entirely and scan. An index on `email`, where almost every value is unique, throws away almost the entire table in one jump.

Update cardinality statistics:
```sql
ANALYZE TABLE orders;
```

---

## 8. When NOT to Add an Index

```
❌ Don't index:
├── Small tables (< 1,000 rows) — full scan is faster
├── Columns with very low cardinality (boolean, enum with 2-3 values)
├── Columns rarely used in WHERE/JOIN/ORDER BY
├── Write-heavy tables — index maintenance slows INSERT/UPDATE/DELETE
└── Too many indexes on one table — optimizer gets confused
```

**Sweet spot:** Index columns that appear in WHERE, JOIN ON, ORDER BY, and GROUP BY clauses — especially those with high cardinality.

---

## 9. Hands-On Exercises

**Exercise 1:** Create an `orders` table without indexes. Run EXPLAIN on `SELECT * FROM orders WHERE customer_id = 100`. Note the type=ALL. Add an index on customer_id and re-run EXPLAIN. Note the change.

**Exercise 2:** Use SHOW INDEX FROM orders to see all indexes. Identify which are automatic (PK, FK, UNIQUE) and which you created.

**Exercise 3:** On a table with 100,000 rows, time a query without index, add index, time again. Observe the speed difference.

**Exercise 4:** Try indexing a BOOLEAN column — run EXPLAIN. Why doesn't MySQL use it?

**Exercise 5:** Run ANALYZE TABLE on your test table and re-check SHOW INDEX — observe the updated cardinality.

---

## 10. Interview Q&A

**Q: What is a database index and why is it used?**
Answer: An index is a sorted data structure (B-tree in MySQL) that stores a copy of selected columns with pointers to the full rows. It allows MySQL to find rows matching a WHERE clause in O(log n) time instead of scanning every row O(n). It trades write performance and storage for read performance.

**Q: What is the clustered index in InnoDB?**
Answer: In InnoDB, the PRIMARY KEY is the clustered index — the actual row data is stored in the leaf nodes of the B-tree, ordered by the PK value. This means PK lookups are extremely fast. Every secondary index also stores the PK value to look up the full row.

**Q: What is cardinality and why does it matter for indexes?**
Answer: Cardinality is the number of distinct values in an indexed column. High cardinality (many unique values like email) makes an index very selective — it eliminates most rows quickly. Low cardinality (like a boolean or a status with 3 values) makes the index less useful — MySQL may prefer a full table scan.

**Q: Can too many indexes hurt performance?**
Answer: Yes. Every index must be updated on INSERT/UPDATE/DELETE. Tables with many indexes have slower write performance. The query optimizer also takes longer to evaluate which index to use. Index only the columns that are actually used in queries.

**Q: Why doesn't MySQL use an index when you use a function on the column?**
Answer: B-tree indexes store column values in sorted order. When you apply a function like YEAR(created_at), MySQL can't use the sorted index because the function result isn't sorted in the index. Rewrite to a range: created_at >= '2025-01-01' AND created_at < '2026-01-01'.
