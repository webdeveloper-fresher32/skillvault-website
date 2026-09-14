# 01 — INSERT: Writing Rows Into Tables

> "A table is just an empty shape until INSERT gives it rows. Everything else in SQL — SELECT, UPDATE, DELETE — only has something to work with because INSERT put it there first."

---

## Table of Contents

1. [Syntax Overview](#1-syntax-overview)
2. [Single-Row INSERT](#2-single-row-insert)
3. [Multi-Row (Batch) INSERT](#3-multi-row-batch-insert)
4. [INSERT INTO ... SELECT](#4-insert-into--select)
5. [INSERT IGNORE](#5-insert-ignore)
6. [ON DUPLICATE KEY UPDATE (Upsert)](#6-on-duplicate-key-update-upsert)
7. [REPLACE INTO](#7-replace-into)
8. [DEFAULT Keyword in VALUES](#8-default-keyword-in-values)
9. [LAST_INSERT_ID()](#9-last_insert_id)
10. [INSERT Performance Tuning](#10-insert-performance-tuning)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Syntax Overview

Before touching any of the fancy variants, let's nail the shape every single one of them is built on:

```
┌──────────────────────────────────────────────────────────────────┐
│  INSERT INTO table_name (col1, col2, col3)                       │
│  VALUES (val1, val2, val3);                                      │
└──────────────────────────────────────────────────────────────────┘
```

That's it. A table name, a list of column names, and a matching list of values. Everything from here — multi-row inserts, upserts, `REPLACE INTO` — is just a variation on this one skeleton.

One habit worth building right now: the column list is **optional**, but you should almost always write it out anyway. Here's why:
- Protects against schema changes (added columns, reordered columns)
- Documents intent clearly for future readers
- Required whenever you are not supplying values for every column

---

## 2. Single-Row INSERT

### The problem it solves

At some point you just need to put one row into one table — a new user signs up, a new product gets added. No batching, no fancy conflict handling. Just: here's a row, store it.

### Real-world analogy

Think of INSERT as filling out a paper form. When you name the fields explicitly
(`name`, `price`, `stock`) you are labelling each box before you write in it.
Skipping the labels still works as long as you fill every box left-to-right,
but one new field added to the form breaks everything — suddenly your values land in the wrong boxes.

### Basic form

```sql
INSERT INTO products (name, price, stock, created_at)
VALUES ('Wireless Mouse', 29.99, 250, NOW());
```

### Without column list (fragile — avoid)

This is the "skip the labels" version from the analogy above. It only works if you fill in *every single column*, in the exact order the table was created with:

```sql
-- Only safe if you supply every column in the exact CREATE TABLE order
INSERT INTO products
VALUES (NULL, 'Wireless Mouse', 29.99, 250, NOW());
-- NULL fills the AUTO_INCREMENT id column
```

The moment someone adds a column to `products` in the middle of the table, this statement silently starts writing the wrong values into the wrong columns. That's the whole reason rule #1 above exists.

### NULL vs DEFAULT

```sql
-- Explicitly inserting NULL
INSERT INTO users (name, avatar_url) VALUES ('Ganesh', NULL);

-- Letting the column default handle it (preferred)
INSERT INTO users (name) VALUES ('Ganesh');
-- avatar_url gets its DEFAULT value automatically
```

### Common mistakes

```
┌──────────────────────────────────────────────────────────────────┐
│  MISTAKE                          │  FIX                        │
├───────────────────────────────────┼─────────────────────────────┤
│  Wrong number of values           │  Match cols to vals count   │
│  String without quotes            │  'value' not value          │
│  Inserting into wrong table       │  Double-check table name    │
│  Forgetting NOT NULL column       │  Provide value or DEFAULT   │
│  Truncating a VARCHAR(50) value   │  Check column width first   │
└──────────────────────────────────────────────────────────────────┘
```

> **Memory hook:** Always name your boxes before you fill them — a form with labels survives changes, a form without them breaks silently.

---

## 3. Multi-Row (Batch) INSERT

### The problem it solves

Say you need to load 5,000 rows — an import job, a migration, a seed script. Firing 5,000 separate single-row INSERT statements means 5,000 round-trips to the server, 5,000 parse cycles, 5,000 log flushes. That adds up fast. Multi-row INSERT lets you hand MySQL all the rows in one statement.

### Real-world analogy

It's the difference between mailing 5,000 individual letters versus putting all 5,000 pages in one envelope and mailing it once. Same content delivered, but you pay the "postage" (network round-trip, parsing overhead) exactly once instead of 5,000 times.

### Syntax

```sql
INSERT INTO products (name, price, stock)
VALUES
  ('USB-C Hub',        45.00, 180),
  ('Mechanical Keyboard', 89.99, 75),
  ('4K Webcam',        129.00, 40),
  ('Laptop Stand',     34.50, 210),
  ('HDMI Cable',        9.99, 500);
```

One INSERT statement — five rows.

### Internal working: why batch is ~10x faster than individual INSERTs

```
Individual INSERTs (5 rows):
  ┌─────┐  network  ┌─────────┐  parse  ┌─────────┐
  │App  │ ────────► │MySQL    │ ──────► │Execute  │  × 5
  └─────┘           └─────────┘         └─────────┘
  Cost: 5 round-trips + 5 parse cycles + 5 B-tree updates

Batch INSERT (5 rows in 1 statement):
  ┌─────┐  network  ┌─────────┐  parse  ┌─────────┐
  │App  │ ────────► │MySQL    │ ──────► │Execute  │  × 1
  └─────┘           └─────────┘         └─────────┘
  Cost: 1 round-trip + 1 parse cycle + 1 B-tree update (all rows)
```

**Savings come from:**
1. One network round-trip instead of N
2. One SQL parse and optimizer pass instead of N
3. InnoDB flushes the redo log buffer once, not N times
4. Index B-tree pages touched once per page, not N times

### Optimal batch size

| Rows per INSERT | Throughput          | Notes                         |
|-----------------|---------------------|-------------------------------|
| 1               | Baseline (slow)     | Only for interactive UIs      |
| 100–500         | 5–20× faster        | Good general-purpose batch    |
| 1000–5000       | 10–40× faster       | Sweet spot for bulk loads     |
| 10 000+         | Diminishing returns | Packet size limits may apply  |

MySQL's `max_allowed_packet` (default 64 MB) limits statement size. For very
large loads, split into chunks of 1 000–5 000 rows.

### Wrapping in a transaction

```sql
START TRANSACTION;

INSERT INTO order_items (order_id, product_id, qty, unit_price)
VALUES
  (1001, 5, 2, 29.99),
  (1001, 8, 1, 89.99),
  (1001, 12, 3, 9.99);

COMMIT;
-- All three rows land atomically, or none do
```

Without an explicit transaction, InnoDB auto-commits each statement — meaning
the redo log is flushed to disk on every single INSERT. Wrapping a batch of
INSERTs in one transaction can improve throughput by an order of magnitude on
spinning disks.

> **Memory hook:** One envelope, five thousand letters — pay for postage once, not five thousand times.

---

## 4. INSERT INTO ... SELECT

### The problem it solves

Sometimes the rows you want to insert already exist — just in a different table, or scattered across a query result. Pulling them into your application, looping over them, and firing INSERTs back would mean shipping every row across the network twice for no reason. `INSERT INTO ... SELECT` copies rows from one table (or query result) into another in pure SQL — no
application round-trip needed at all.

### Real-world analogy

It's like photocopying pages straight from one filing cabinet into another folder, instead of reading each page aloud over the phone to someone who then retypes it. Same result, far less handling.

### Basic copy

```sql
-- Archive orders older than 1 year
INSERT INTO orders_archive (order_id, customer_id, total, created_at)
SELECT order_id, customer_id, total, created_at
FROM orders
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

### Transform during copy

```sql
-- Create a summary table from raw event data
INSERT INTO daily_sales_summary (sale_date, product_id, units_sold, revenue)
SELECT
    DATE(created_at)   AS sale_date,
    product_id,
    SUM(qty)           AS units_sold,
    SUM(qty * price)   AS revenue
FROM order_items
GROUP BY DATE(created_at), product_id;
```

### Cross-table copy with JOIN

```sql
INSERT INTO customer_report (customer_id, name, email, total_spent)
SELECT
    c.id,
    c.name,
    c.email,
    SUM(o.total)
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name, c.email;
```

### Under the hood

MySQL evaluates the SELECT fully, then feeds each result row into the INSERT
engine. The select and insert happen in the same transaction snapshot, so there
is no risk of reading your own newly inserted rows in a loop.

> **Memory hook:** Photocopy the pages — don't read them aloud over the phone.

---

## 5. INSERT IGNORE

### The problem it solves

Picture a seed script or a CSV import that you might run more than once. A plain INSERT aborts the whole statement the moment it hits one duplicate row — even if 999 of the 1,000 rows were perfectly fine. You don't always want that; sometimes you just want MySQL to shrug off the duplicates and carry on.

### Real-world analogy

It's a bouncer at the door checking names off a guest list. If someone's already inside (a duplicate), the bouncer doesn't call the police — they just quietly wave the next person through instead of shutting down the whole event.

`INSERT IGNORE` silently skips a row when a duplicate key error (or other ignorable error) would
otherwise abort the statement.

```sql
-- products(sku) has a UNIQUE constraint
INSERT IGNORE INTO products (sku, name, price)
VALUES ('WM-001', 'Wireless Mouse', 29.99);
-- If sku='WM-001' already exists, the row is skipped — no error raised
```

### What errors does IGNORE suppress?

| Error type                   | IGNORE behaviour            |
|------------------------------|-----------------------------|
| Duplicate key (UNIQUE / PK)  | Skip row, continue          |
| Data truncation              | Truncate silently, continue |
| NOT NULL violation           | Insert zero/empty, continue |
| FK violation                 | Skip row, continue          |

### When to use vs avoid

Use INSERT IGNORE when:
- Idempotent seed scripts (run multiple times safely)
- Importing CSVs that may contain duplicates you do not care about

Avoid when:
- You need to know which rows were skipped (use ON DUPLICATE KEY UPDATE instead)
- Silent data truncation would corrupt your dataset

```sql
-- Check how many rows were actually inserted
INSERT IGNORE INTO tags (name) VALUES ('mysql'), ('sql'), ('mysql');
SELECT ROW_COUNT(); -- returns 2 (third row 'mysql' was a duplicate)
```

> **Memory hook:** The bouncer waves duplicates through the door quietly — no scene, no ambulance called.

---

## 6. ON DUPLICATE KEY UPDATE (Upsert)

### The problem it solves

INSERT IGNORE is a blunt instrument — it just throws the conflicting row away. But what if, instead of discarding it, you actually want the new data to win? Think of a page-view counter: every visit either creates the counter for a brand-new page, or bumps the existing one by one. Checking "does this row exist?" with a SELECT first, then deciding whether to INSERT or UPDATE, is slow and racy — two requests arriving at the same instant could both see "no row yet" and both try to insert, causing a duplicate-key crash anyway.

`ON DUPLICATE KEY UPDATE` is the fix: it's the most powerful INSERT variant. When a row with the same PRIMARY KEY or UNIQUE
key already exists, MySQL UPDATEs it instead of inserting a new one — atomically, in one round-trip, no race condition possible.

### Real-world analogy

It's like handing a librarian a book to shelve. If that exact book isn't in the catalog yet, they add a fresh card. If it's already there, they don't create a duplicate card — they just update the existing one (say, bump the "times borrowed" count). One action, decided on the spot, no need to check the catalog yourself first.

### Syntax

```sql
INSERT INTO products (sku, name, price, stock)
VALUES ('WM-001', 'Wireless Mouse', 27.99, 300)
ON DUPLICATE KEY UPDATE
    price = VALUES(price),
    stock = VALUES(stock);
```

`VALUES(col)` refers to the value that *would have been inserted* — it is the
most readable way to say "use the new value".

### Increment pattern (view/click counters)

```sql
INSERT INTO page_stats (page_slug, views)
VALUES ('home', 1)
ON DUPLICATE KEY UPDATE
    views = views + 1;
```

Every call either inserts the first view for a new slug, or increments the
counter for an existing one — atomically, with no SELECT first.

### Upsert with timestamp tracking

```sql
INSERT INTO product_prices (product_id, price, updated_at)
VALUES (42, 24.99, NOW())
ON DUPLICATE KEY UPDATE
    price      = VALUES(price),
    updated_at = VALUES(updated_at);
```

### ROW_COUNT() meanings for ON DUPLICATE KEY UPDATE

| Outcome              | ROW_COUNT() |
|----------------------|-------------|
| Row inserted         | 1           |
| Row updated (changed)| 2           |
| Row matched but unchanged | 0      |

### Internal working: how MySQL decides insert vs update

```
  INSERT attempted
        │
        ▼
  Duplicate key?
   ┌────┴────┐
  YES       NO
   │         │
   ▼         ▼
  UPDATE    INSERT
  the row   the row
```

MySQL attempts the INSERT first. Only if it collides with an existing PRIMARY KEY or UNIQUE index value does it pivot to running the UPDATE clause against that existing row — all inside one atomic statement, so no other connection can sneak in between the "check" and the "act."

### Compare with related concepts

| Variant | On duplicate key | On other errors (NOT NULL, truncation) |
|---------|-------------------|------------------------------------------|
| Plain INSERT | Statement aborts | Statement aborts |
| INSERT IGNORE | Row silently skipped | Row silently skipped/truncated |
| ON DUPLICATE KEY UPDATE | Existing row is updated | Statement still aborts |

### Common mistakes

Forgetting that `VALUES(col)` only makes sense *inside* the `ON DUPLICATE KEY UPDATE` clause — it's not a general-purpose function. Also, don't assume `ROW_COUNT()` behaves like a boolean; see the table below, the "2 means updated" quirk trips up a lot of people who expect 1 for any successful write.

### Interview answer

"`ON DUPLICATE KEY UPDATE` lets you attempt an INSERT and, if it collides with an existing PRIMARY KEY or UNIQUE key, fall back to updating that row instead — all as one atomic statement. It's the standard way to implement an upsert or an atomic counter increment in MySQL without a racy SELECT-then-decide round trip from the application."

> **Memory hook:** Hand the librarian a book — new card if it's new, update the existing card if it's already shelved.

---

## 7. REPLACE INTO

### The problem it solves

Sometimes you don't want a surgical, column-by-column update — you want to say "whatever was there before, forget it, this is the complete new version of the row." `REPLACE INTO` gives you that, but the way it achieves it is more drastic than it looks.

### Real-world analogy

`ON DUPLICATE KEY UPDATE` is like editing specific fields on an existing form. `REPLACE INTO` is more like ripping up the old form entirely and stapling in a brand new one with the same ID number — anything that was written on the old form and isn't rewritten on the new one is simply gone.

REPLACE INTO looks like INSERT, but when a duplicate key is found, it **deletes
the existing row first, then inserts the new one**.

```sql
REPLACE INTO products (id, sku, name, price, stock)
VALUES (7, 'WM-001', 'Wireless Mouse v2', 32.99, 150);
```

### REPLACE vs ON DUPLICATE KEY UPDATE — critical difference

```
┌────────────────────────────────────────────────────────────────────┐
│  Scenario: row id=7 exists with columns: id, sku, name, price,    │
│  stock, created_at (has a value), category_id (has a value)       │
├──────────────────────────┬─────────────────────────────────────────┤
│  ON DUPLICATE KEY UPDATE │  Only the listed columns change.        │
│                          │  created_at and category_id survive.    │
├──────────────────────────┼─────────────────────────────────────────┤
│  REPLACE INTO            │  Row is deleted (triggers ON DELETE FK  │
│                          │  cascades, auto-increment bumps),       │
│                          │  then re-inserted. created_at and       │
│                          │  category_id are lost unless supplied.  │
└──────────────────────────┴─────────────────────────────────────────┘
```

### When REPLACE is dangerous

- **Auto-increment jumps**: even if the row content is identical, the PK value
  changes because a new row is inserted with a new ID.
- **FK cascades fire**: child rows in other tables may be deleted by
  ON DELETE CASCADE.
- **Triggers**: both DELETE and INSERT triggers fire, not UPDATE triggers.

**Rule of thumb**: prefer ON DUPLICATE KEY UPDATE unless you specifically need
REPLACE semantics (full row replacement including columns you do not specify).

### Interview answer

"`REPLACE INTO` is not really an 'upsert' — it's a DELETE followed by an INSERT, wrapped in one statement. When the key already exists, MySQL physically deletes that row (firing DELETE triggers and ON DELETE CASCADE foreign keys) and inserts a fresh row with a new AUTO_INCREMENT value if applicable. Any column you don't explicitly supply resets to its default rather than keeping its old value. `ON DUPLICATE KEY UPDATE`, by contrast, mutates the existing row in place and never touches unrelated columns or triggers cascades. In practice, `ON DUPLICATE KEY UPDATE` is the safer default; reach for `REPLACE INTO` only when you deliberately want full-row replacement semantics."

> **Memory hook:** REPLACE INTO doesn't edit the form — it shreds the old one and staples in a new one, same ID, blank fields you didn't refill.

---

## 8. DEFAULT Keyword in VALUES

### The problem it solves

You already know that omitting a column entirely lets its DEFAULT kick in. But what if you're writing a long INSERT with every column listed for clarity, and you want one of those columns to still just take its default? You don't want to break the "always list your columns" habit just for that one field.

You can explicitly invoke a column's DEFAULT value even inside a VALUES list — think of it as saying "yes, I thought about this column, and I want the default":

```sql
CREATE TABLE events (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    title      VARCHAR(200) NOT NULL,
    status     ENUM('draft','published') DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO events (title, status, created_at)
VALUES ('Product Launch', DEFAULT, DEFAULT);
-- status gets 'draft', created_at gets current timestamp
```

This is cleaner than omitting the column entirely when you want to be explicit
about using defaults in a long INSERT statement.

> **Memory hook:** Writing DEFAULT in the box says "I saw this field, and I'm choosing the default on purpose" — not "I forgot about it."

---

## 9. LAST_INSERT_ID()

### The problem it solves

You just inserted a new `orders` row with an AUTO_INCREMENT id, and now you need to insert three `order_items` rows that reference that new order's id. But you never told MySQL what the id was — it generated it. How do you find out what it picked, without a separate SELECT that could race with someone else's insert?

After an INSERT into a table with AUTO_INCREMENT, MySQL sets the
`LAST_INSERT_ID()` session variable to the generated key, scoped privately to your own connection — so there's no ambiguity about whose insert you're reading.

```sql
INSERT INTO orders (customer_id, total) VALUES (42, 149.97);
SET @order_id = LAST_INSERT_ID();

INSERT INTO order_items (order_id, product_id, qty)
VALUES
    (@order_id, 5, 2),
    (@order_id, 8, 1);
```

### Properties

| Property                        | Detail                                       |
|---------------------------------|----------------------------------------------|
| Scope                           | Per-connection — never affected by others    |
| After batch INSERT              | Returns ID of the **first** row in the batch |
| After INSERT IGNORE (skipped)   | Returns 0 (no row was inserted)              |
| After ON DUPLICATE KEY UPDATE   | Returns ID of the existing row               |
| Stored procedure safe           | Caller sees last ID set inside the procedure |

### In application code (Python example)

```python
cursor.execute(
    "INSERT INTO orders (customer_id, total) VALUES (%s, %s)",
    (customer_id, total)
)
order_id = cursor.lastrowid   # wraps LAST_INSERT_ID() for you
```

> **Memory hook:** LAST_INSERT_ID() is your own private receipt number — nobody else's insert can overwrite the copy sitting on your connection.

---

## 10. INSERT Performance Tuning

### The problem it solves

Everything above works fine for a handful of rows. But loading a million-row CSV, or backfilling a table during a migration, is a completely different game — the same INSERT statement that felt instant at row 1 can take hours at row 1,000,000 if you don't think about batching, transactions, and indexes. This section is about the levers that actually move the needle at that scale.

### 10.1 Batch size

The single biggest lever. Aim for 1 000–5 000 rows per statement during bulk
loads. Benchmark your specific hardware — network latency and redo log flush
frequency are the usual bottlenecks.

### 10.2 Wrap in a transaction

```sql
START TRANSACTION;
-- 10 000 row batch INSERT here
COMMIT;
-- Redo log flushed once at COMMIT instead of 10 000 times
```

### 10.3 Temporarily disable non-unique indexes (MyISAM / bulk load)

```sql
ALTER TABLE staging_products DISABLE KEYS;

LOAD DATA INFILE '/tmp/products.csv'
INTO TABLE staging_products ...;

ALTER TABLE staging_products ENABLE KEYS;
-- Rebuilds all non-unique indexes in one sorted pass — much faster
```

For InnoDB, the equivalent is:

```sql
SET foreign_key_checks = 0;
SET unique_checks = 0;      -- only safe if you guarantee uniqueness yourself
-- bulk load
SET unique_checks = 1;
SET foreign_key_checks = 1;
```

### 10.4 LOAD DATA INFILE vs INSERT

For loading CSV files, `LOAD DATA INFILE` is 5–20× faster than INSERT because
it bypasses SQL parsing entirely and writes directly to the storage engine.

```sql
LOAD DATA INFILE '/var/lib/mysql-files/products.csv'
INTO TABLE products
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS  -- skip header
(name, price, stock, @created_raw)
SET created_at = STR_TO_DATE(@created_raw, '%Y-%m-%d');
```

### 10.5 innodb_buffer_pool_size

For sustained bulk inserts, a larger buffer pool reduces physical I/O because
more dirty pages remain in memory until COMMIT.

### 10.6 Performance comparison table

| Strategy                          | Relative speed | Use case                       |
|-----------------------------------|----------------|--------------------------------|
| Single-row INSERT (no txn)        | 1×             | Interactive forms              |
| Batch INSERT 1 000 rows           | 10–20×         | App-level bulk operations      |
| Batch INSERT + explicit txn       | 20–50×         | ETL within application         |
| LOAD DATA INFILE                  | 50–200×        | CSV/flat-file bulk loading     |
| mysqldump restore                 | Variable       | Full table restores            |

> **Memory hook:** Batch the rows, wrap them in one transaction, and skip SQL parsing entirely with LOAD DATA INFILE when you can — that's the whole performance playbook.

---

## 11. Hands-On Exercises

**Exercise 1 — Single row insert with defaults**

Create a `users` table with columns `id` (AUTO_INCREMENT PK), `username`
(VARCHAR 50, UNIQUE, NOT NULL), `email` (VARCHAR 100, NOT NULL), `role`
(ENUM 'user','admin' DEFAULT 'user'), `created_at` (DATETIME DEFAULT
CURRENT_TIMESTAMP). Insert one user supplying only `username` and `email`.
Verify the defaults fired with a SELECT.

**Exercise 2 — Batch insert and timing**

Insert 1 000 rows into a `log_events` table first one-by-one in a loop (use a
stored procedure or application loop), then drop and recreate the table and
insert the same 1 000 rows as a single batch INSERT. Compare execution time
with `SHOW PROFILES` or wall-clock timing.

**Exercise 3 — INSERT INTO ... SELECT**

You have an `orders` table and an `orders_archive` table with the same schema.
Write a statement that copies all orders where `status = 'cancelled'` AND
`created_at < '2024-01-01'` into `orders_archive`, then deletes them from
`orders` (use a transaction).

**Exercise 4 — Upsert with ON DUPLICATE KEY UPDATE**

Create a `product_inventory` table with `product_id` (PK), `stock`, `last_updated`.
Write an upsert that either inserts a new product's stock count or updates the
existing stock to the new value and refreshes `last_updated` to NOW(). Test both
the insert path and the update path.

**Exercise 5 — Parent-child insert with LAST_INSERT_ID()**

Insert a new customer into a `customers` table, capture the generated `id` with
`LAST_INSERT_ID()`, then insert three addresses for that customer into an
`addresses` table referencing the captured ID. Do it inside a single transaction.

---

## 12. Interview Q&A

**Q1: What is the difference between INSERT IGNORE and ON DUPLICATE KEY UPDATE?**

INSERT IGNORE silently discards the entire row when any ignorable error occurs
(duplicate key, truncation, NOT NULL). ON DUPLICATE KEY UPDATE handles only
duplicate key conflicts, and instead of discarding the row it executes a
targeted UPDATE. Use INSERT IGNORE when duplicates are expected noise and the
original data should win. Use ON DUPLICATE KEY UPDATE when you want the new
data to overwrite or merge with the existing row.

**Q2: Why is a batch INSERT faster than N individual INSERTs?**

Each individual INSERT incurs a network round-trip, a SQL parse, an optimizer
pass, and an InnoDB redo log flush (if auto-commit is on). A batch INSERT pays
all of those costs exactly once regardless of N. The speedup is typically 10–50×
for medium batches on local networks and larger still over high-latency
connections.

**Q3: REPLACE INTO deleted my child rows! Why?**

REPLACE INTO fires ON DELETE CASCADE because it physically deletes the existing
row before inserting the new one. Any foreign key child rows pointing at the
deleted PK are cascade-deleted. ON DUPLICATE KEY UPDATE modifies the existing
row in place and never triggers ON DELETE cascades.

**Q4: LAST_INSERT_ID() returned 0 after my INSERT. What happened?**

Either the table has no AUTO_INCREMENT column, the INSERT was skipped by INSERT
IGNORE (duplicate key), or the INSERT failed. Also, LAST_INSERT_ID() is only
meaningful after the most recent INSERT in the current session — reading it after
a subsequent SELECT resets nothing, but another INSERT will overwrite it.

**Q5: What does ROW_COUNT() return after ON DUPLICATE KEY UPDATE?**

1 if a new row was inserted, 2 if an existing row was updated (even if the
net change was zero in some MySQL versions), and 0 if the row was matched but
no columns changed. The value 2 for an update is a historical quirk from the
original implementation.

**Q6: When should I use LOAD DATA INFILE instead of INSERT?**

Whenever you are loading more than a few thousand rows from a flat file. LOAD
DATA INFILE bypasses SQL parsing, formats data directly for the storage engine,
and is typically 5–20× faster than equivalent batch INSERTs. Limitations: the
file must be accessible to the MySQL server (or use LOCAL), and you need the
FILE privilege (or LOAD DATA LOCAL INFILE with CLIENT_LOCAL_FILES enabled).

**Q7: Can ON DUPLICATE KEY UPDATE reference columns from the SELECT in an
INSERT ... SELECT ... ON DUPLICATE KEY UPDATE statement?**

Yes. You can use VALUES(col_name) to refer to the value from the attempted
INSERT row, just as in a plain VALUES(...) insert. In MySQL 8.0.20+ the
VALUES() function inside ON DUPLICATE KEY UPDATE is deprecated in favour of
row aliases:

```sql
INSERT INTO t (a, b) VALUES (1, 2) AS new
ON DUPLICATE KEY UPDATE b = new.b;
```

**Q8: What happens if I INSERT a NULL into a NOT NULL column?**

In strict SQL mode (STRICT_TRANS_TABLES, the default in MySQL 5.7+), MySQL
raises error 1048 (Column 'x' cannot be null) and aborts the statement. In
non-strict mode it silently inserts the implicit default (0 for INT, '' for
VARCHAR, etc.) and raises a warning. Always run in strict mode in production.

**Q9: How do I insert a row only if it does not already exist, without an
explicit SELECT first?**

Use INSERT IGNORE or ON DUPLICATE KEY UPDATE. Both avoid the SELECT + INSERT
race condition that would occur in application-level "check then insert" logic.
The INSERT itself is atomic at the storage engine level.

**Q10: How do I bulk-insert from another database on the same MySQL server?**

Use fully qualified table names in INSERT INTO ... SELECT:

```sql
INSERT INTO new_db.products (name, price)
SELECT name, price
FROM old_db.products
WHERE active = 1;
```

MySQL evaluates the cross-database SELECT as a normal join as long as the
connecting user has SELECT on old_db and INSERT on new_db.

**Q11: What is the effect of disabling unique_checks before a bulk load?**

MySQL skips enforcing UNIQUE constraint lookups during INSERT, which avoids the
random index page reads normally required for each row. This can cut load time
dramatically for large datasets. It is only safe if you guarantee the incoming
data contains no duplicates yourself — if it does, the index will be silently
corrupted and queries will return wrong results.

**Q12: Can I INSERT and immediately retrieve the generated PK in a single
round-trip?**

No native single-statement syntax exists for this in MySQL, but frameworks use
the fact that LAST_INSERT_ID() is set on the same connection immediately after
the INSERT, so the next query (SELECT LAST_INSERT_ID()) on the same connection
is guaranteed to return the correct ID without any race condition.

**Q13: What is the difference between inserting NULL and inserting 0 into an
AUTO_INCREMENT column?**

Both trigger auto-increment in MySQL. A NULL value in an AUTO_INCREMENT column
causes MySQL to generate the next sequence value. An explicit 0 also generates
the next value unless NO_AUTO_VALUE_ON_ZERO is set. Any non-zero explicit value
inserts that value directly (and may reset the auto-increment counter if it is
the new maximum).

**Q14: How does multi-row INSERT behave when one row causes an error?**

In default mode, the first error aborts the entire statement and no rows are
committed. With INSERT IGNORE, error rows are skipped and the remaining rows
continue. With ON DUPLICATE KEY UPDATE, conflicts are handled row by row and
do not abort subsequent rows.

**Q15: What is the maximum number of rows in a single VALUES list?**

MySQL has no hard row count limit for VALUES lists, but the statement must fit
within max_allowed_packet (configurable, default 64 MB). The practical limit
depends on row width: for narrow rows (20 bytes each) you could reach millions
of rows per statement before hitting the packet limit.
