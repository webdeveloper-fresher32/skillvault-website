# 03 — UPDATE: Modifying Existing Rows

## Table of Contents

1. [Syntax Overview](#1-syntax-overview)
2. [Single-Table UPDATE with WHERE](#2-single-table-update-with-where)
3. [Multi-Column UPDATE](#3-multi-column-update)
4. [Expression-Based Updates](#4-expression-based-updates)
5. [Multi-Table UPDATE with JOIN](#5-multi-table-update-with-join)
6. [sql_safe_updates — Your Safety Net](#6-sql_safe_updates--your-safety-net)
7. [ORDER BY + LIMIT — Partial Updates](#7-order-by--limit--partial-updates)
8. [UPDATE with Subquery](#8-update-with-subquery)
9. [Common Patterns and Pitfalls](#9-common-patterns-and-pitfalls)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Syntax Overview

Here's a war story that happens more often than anyone likes to admit: an engineer means to fix the price of *one* product, runs `UPDATE products SET price = 0;`, hits enter — and every single row in the table just became free. No `WHERE`, no warning, no undo button. That one missing clause is one of the most common causes of production data disasters in SQL history.

Think of `UPDATE` like a find-and-replace in a text editor that has "replace all" turned on by default. If you don't tell it *where* to look, it assumes you mean everywhere.

So, the basic shape of an UPDATE:

```
┌──────────────────────────────────────────────────────────────────┐
│  UPDATE  table_name                                              │
│  SET     col1 = val1,                                            │
│          col2 = val2                                             │
│  WHERE   condition;          ← NEVER omit this                  │
└──────────────────────────────────────────────────────────────────┘
```

Here's the part that catches people out: `WHERE` is not syntactically *required*. MySQL will happily accept an UPDATE without one — it just won't stop you from modifying every row in the table.

```
⚠  UPDATE products SET price = 0;
   ← Updates every product price to zero. No undo unless you have a backup.
```

The fix is really just a habit. Train yourself to write the `WHERE` before you even think about the `SET`:

```sql
-- Habit: write WHERE before SET
UPDATE products
WHERE id = 42        -- write this line first
SET name = 'New Name';   -- then fill in the SET
-- (MySQL doesn't care about clause order as long as syntax is valid)
```

> **Memory hook:** An UPDATE with no WHERE isn't "update some rows" — it's "replace all," turned on by default.

---

## 2. Single-Table UPDATE with WHERE

Most of the time, you're not touching every row — you're touching *one* row, or a small, well-defined slice of rows. Think of it like editing a single contact's phone number in your address book: you flip to that one page (`WHERE id = ...`), cross out the old number, write the new one. You don't retype every contact in the book.

### Basic form

```sql
-- Update one row by primary key
UPDATE users
SET email = 'ganesh@newdomain.com'
WHERE id = 1001;
```

### Multiple conditions

```sql
-- Reactivate a user only if they are currently inactive and verified
UPDATE users
SET status = 'active', last_activated_at = NOW()
WHERE id = 1001
  AND status = 'inactive'
  AND email_verified = 1;
```

Before you trust an UPDATE with anything that matters, it pays to look before you leap: run the equivalent `SELECT` first, eyeball the rows it would touch, and only then swap in the `UPDATE`.

### Verify rows affected before committing

```sql
-- Step 1: preview what would change
SELECT id, status, email FROM users
WHERE status = 'inactive' AND last_login < DATE_SUB(NOW(), INTERVAL 2 YEAR);

-- Step 2: if preview looks right, run the UPDATE
UPDATE users
SET status = 'archived'
WHERE status = 'inactive'
  AND last_login < DATE_SUB(NOW(), INTERVAL 2 YEAR);

-- Step 3: check
SELECT ROW_COUNT();   -- rows actually changed
```

### ROW_COUNT() semantics

Quick gotcha worth knowing before you rely on it: `ROW_COUNT()` tells you how many rows *changed*, not how many rows *matched* your WHERE clause. If a row matched but its new value happened to equal the old value, MySQL doesn't count it as touched.

| Scenario                           | ROW_COUNT() |
|------------------------------------|-------------|
| Rows matched and value changed     | N (changed) |
| Rows matched but value identical   | 0           |
| No rows matched WHERE              | 0           |

(Use the `CLIENT_FOUND_ROWS` connection flag if you need the "matched" count instead of the "actually changed" count.)

---

## 3. Multi-Column UPDATE

Updating one column at a time is fine until you need to change five fields on the same row in one go — you don't want five separate round-trips to the database for what is logically one edit. A single `SET` clause handles any number of columns; just separate them with commas:

```sql
UPDATE products
SET
    name        = 'USB-C Hub Pro',
    price       = 52.99,
    stock       = 200,
    updated_at  = NOW()
WHERE id = 17;
```

### Column order in SET does not matter to the result

Here's a trap that bites people coming from procedural code: in a language like JavaScript or Python, statements run top to bottom, so `a = 2; b = a;` leaves `b` equal to `2`. It's tempting to assume a SQL `SET a = 2, b = a` behaves the same way. It doesn't.

Think of it like a photograph, not a video. Before MySQL changes anything, it takes a single snapshot of the row as it currently stands. Every expression on the right-hand side of `SET` is evaluated against *that snapshot* — not against whatever the statement itself just changed a moment ago. Only after all the right-hand sides are computed does MySQL write the new values in, all at once.

```sql
-- This does NOT mean: first set a=2, then set b=a (which would be b=2)
-- b gets the ORIGINAL value of a, not 2
UPDATE t SET a = 2, b = a WHERE id = 1;
-- If original a=10: result is a=2, b=10
```

This "snapshot, then apply" behavior is actually a feature, not a bug — it's exactly what lets you swap two column values in one statement without a temp variable (see the swap pattern in Section 9). Just don't expect SET clauses to behave like sequential assignment statements.

> **Memory hook:** MySQL reads the whole row like a photograph before it writes anything — later columns in SET never see earlier columns' new values, only the old ones.

---

## 4. Expression-Based Updates

Sometimes the new value isn't a fixed number you already know — it *depends* on the current value. "Give everything in electronics a 10% bump" doesn't mean you calculated each new price by hand; you want MySQL to do the math, row by row, using whatever value is already sitting there. That's what expression-based updates are for: the right-hand side of `SET` isn't just a literal, it can be a full expression referencing the row's own columns.

### Arithmetic on the existing value

```sql
-- Apply a 10% price increase
UPDATE products
SET price = price * 1.10
WHERE category = 'electronics';

-- Decrease stock by the ordered quantity
UPDATE products
SET stock = stock - 3
WHERE id = 42;
-- WARNING: stock could go negative — add AND stock >= 3 for safety:
UPDATE products
SET stock = stock - 3
WHERE id = 42 AND stock >= 3;

-- Add loyalty points based on purchase amount
UPDATE customers
SET loyalty_points = loyalty_points + FLOOR(purchase_total / 10)
WHERE id = 88;
```

### Conditional expression in SET

```sql
-- Cap a value at a maximum without application logic
UPDATE user_plans
SET api_calls_remaining = LEAST(api_calls_remaining + 1000, 10000)
WHERE id = 55;

-- Set a column only when a condition is met, otherwise keep current value
UPDATE employees
SET
    bonus = CASE
                WHEN performance_score >= 90 THEN salary * 0.15
                WHEN performance_score >= 70 THEN salary * 0.08
                ELSE bonus   -- keep existing value
            END
WHERE review_year = 2026;
```

### String manipulation on update

```sql
-- Normalise email to lowercase (fixing bad data)
UPDATE users SET email = LOWER(email) WHERE email != LOWER(email);

-- Prepend a prefix to all order references
UPDATE orders
SET reference = CONCAT('ORD-', reference)
WHERE reference NOT LIKE 'ORD-%';
```

### Date expression

```sql
-- Extend subscription by 30 days from its current expiry
UPDATE subscriptions
SET expires_at = DATE_ADD(expires_at, INTERVAL 30 DAY)
WHERE plan = 'trial' AND status = 'active';
```

---

## 5. Multi-Table UPDATE with JOIN

Picture this: your `products` table just got a corrected price for a handful of items. But `order_items` keeps its own copy of `unit_price`, frozen at the moment of purchase (a denormalisation you did on purpose, for good reasons). Now that correction needs to ripple into every still-open order. Do you really want to loop through rows in application code, one SELECT and one UPDATE per row? That's slow, and it's exactly the kind of thing SQL is built to do in a single statement.

The analogy: it's like a payroll clerk who needs to give everyone in the "Sales" department a raise. Instead of looking up each employee's department in a separate binder every time, the clerk lays the employee list and the department list side by side on the same desk, matches rows by department ID, and updates salaries directly — one pass, no separate lookups.

MySQL's answer is a JOIN bolted onto UPDATE: it lets you update one table's columns using values pulled live from a related table, in one statement, no subquery round-trip needed.

### Syntax

```sql
UPDATE  t1
JOIN    t2  ON  t2.fk = t1.pk
SET     t1.col = t2.col
WHERE   condition;
```

Read this the same way you'd read a SELECT with a JOIN: MySQL first builds the joined result set (matching `t1` rows to `t2` rows), and only *then* applies the `SET` and `WHERE` against that combined view. The `WHERE` here filters which joined rows get updated — same role it plays in a SELECT.

### Example: sync a denormalised price

```sql
-- order_items stores the unit_price at time of order.
-- A price correction was made in the products table.
-- Backfill the correction for all unshipped orders.

UPDATE order_items oi
JOIN products p ON p.id = oi.product_id
SET oi.unit_price = p.price
WHERE oi.shipped_at IS NULL
  AND p.price_corrected = 1;
```

### Example: promote users who meet a threshold

```sql
UPDATE users u
JOIN (
    SELECT customer_id, SUM(total) AS lifetime_value
    FROM orders
    WHERE status = 'completed'
    GROUP BY customer_id
    HAVING lifetime_value >= 5000
) AS high_value ON high_value.customer_id = u.id
SET u.tier = 'VIP'
WHERE u.tier != 'VIP';
```

### Updating multiple tables simultaneously

```sql
-- Transfer an employee to a new department, updating both tables
UPDATE employees e
JOIN departments d ON d.id = e.department_id
SET
    e.department_id = 5,
    e.title         = 'Senior Engineer',
    d.headcount     = d.headcount - 1
WHERE e.id = 301;
```

This is MySQL-specific. Standard SQL does not support updating multiple tables
in one statement.

### LEFT JOIN in UPDATE

```sql
-- Set a flag on customers who have no orders (LEFT JOIN + IS NULL)
UPDATE customers c
LEFT JOIN orders o ON o.customer_id = c.id
SET c.has_no_orders = 1
WHERE o.id IS NULL;
```

### Single-table vs. multi-table UPDATE

| | Single-table UPDATE | Multi-table (JOIN) UPDATE |
|---|---|---|
| Data source | Only the table being updated | Values can come from a joined table |
| Standard SQL? | Yes | No — MySQL-specific extension |
| Typical use | Fixing/setting a value you already know | Syncing/deriving a value from a related table |
| Can update >1 table at once? | No | Yes — see the department-transfer example above |
| Risk | Forgetting WHERE wipes the table | A wrong JOIN condition silently fans out rows or matches the wrong ones |

**Common mistake:** getting the JOIN direction or condition wrong and not noticing, because the UPDATE still "succeeds" — it just updates the wrong rows, or updates some rows multiple times if the join produces duplicate matches. Before running a multi-table UPDATE, turn it into a SELECT first (`SELECT t1.*, t2.* FROM t1 JOIN t2 ON ...`) and eyeball the joined rows — exactly the same discipline as Section 2's "preview with SELECT."

> **Memory hook:** A multi-table UPDATE is a SELECT with a JOIN wearing a SET clause instead of a column list — build the SELECT first, trust it, then bolt SET onto it.

---

## 6. sql_safe_updates — Your Safety Net

Section 1 opened with the nightmare scenario: an UPDATE with no WHERE, wiping every row. Wouldn't it be nice if MySQL just refused to let that happen — at least by default, in the environments where mistakes are most likely (your local dev shell, at 2am, half-awake)?

That's exactly what `sql_safe_updates` is: think of it as the safety on a power tool. It doesn't stop you from doing the job — it stops you from doing it *by accident*, with your finger nowhere near where it should be.

**Definition:** `sql_safe_updates` is a MySQL session variable that blocks UPDATE (and DELETE) statements that don't include a WHERE clause referencing an indexed column.

```sql
SET SESSION sql_safe_updates = 1;

-- This now raises Error 1175:
UPDATE products SET price = 0;
-- Error: You are using safe update mode and you tried to update
--        a table without a WHERE that uses a KEY column.

-- This is also blocked (WHERE on non-indexed column):
UPDATE products SET price = 0 WHERE name = 'test';

-- This passes (WHERE on PK or indexed column):
UPDATE products SET price = 0 WHERE id = 7;
```

### Enabling permanently in a development environment

In `my.cnf` / `my.ini`:

```ini
[mysql]
safe-updates
```

Or in a MySQL client startup file (`~/.my.cnf`):

```ini
[mysql]
safe-updates = 1
```

### When to bypass sql_safe_updates

Legitimate full-table updates are rare but sometimes needed (global price
adjustments, schema migration backfills). Bypass safely:

```sql
SET SESSION sql_safe_updates = 0;
UPDATE products SET vat_rate = 0.10;   -- intentional full-table update
SET SESSION sql_safe_updates = 1;
```

**Common mistake:** treating safe mode as a substitute for actually thinking about the WHERE clause. It's a net, not a guarantee — it only catches the *no-WHERE* and *non-indexed-WHERE* cases. `UPDATE products SET price = 0 WHERE category = 'electronics'` (where `category` happens to be indexed) sails right through, even though it still wipes every electronics product's price. The safety net catches carelessness, not bad logic.

**Interview answer:** "`sql_safe_updates` is a session-level guard rail that blocks UPDATE/DELETE statements lacking a WHERE clause on an indexed column, catching the classic 'forgot the WHERE' mistake before it hits production data. It's typically enabled in development and ad-hoc admin sessions, and deliberately disabled for the duration of a genuine bulk operation like a global price change, then re-enabled immediately after."

> **Memory hook:** sql_safe_updates is the safety on the power tool — it stops you from firing with no target, not from aiming badly.

---

## 7. ORDER BY + LIMIT — Partial Updates

Say you need to archive a million stale log rows. Doing it in one giant UPDATE locks a huge swath of the table for a long time and creates a massive transaction. Doing it row-by-row in application code is painfully slow. What you actually want is something in between: "grab the oldest 500, update those, then repeat" — a controlled, incremental nibble instead of one giant bite.

MySQL has a feature tailor-made for this, and it's a MySQL-only extension: you can attach `ORDER BY` and `LIMIT` directly to an `UPDATE`, letting you change a bounded, sorted subset of rows instead of everything the WHERE clause matches.

### Syntax

```sql
UPDATE table_name
SET col = val
WHERE condition
ORDER BY sort_col [ASC|DESC]
LIMIT n;
```

### Examples

```sql
-- Deactivate the 10 oldest inactive accounts (for a cleanup batch job)
UPDATE users
SET status = 'archived'
WHERE status = 'inactive'
ORDER BY created_at ASC
LIMIT 10;

-- Mark the 5 cheapest unshipped orders as "priority pick"
UPDATE orders
SET is_priority = 1
WHERE shipped_at IS NULL
ORDER BY total ASC
LIMIT 5;

-- Batch price update: increase the 100 lowest-priced items by 5%
UPDATE products
SET price = ROUND(price * 1.05, 2)
WHERE category = 'clearance'
ORDER BY price ASC
LIMIT 100;
```

### Why this is useful

Without ORDER BY + LIMIT you either update all matching rows (risky) or
generate a subquery to select IDs first (verbose). ORDER BY + LIMIT is concise
and lets you implement safe incremental batch processing:

```sql
-- Run this in a loop until ROW_COUNT() returns 0
UPDATE events
SET processed = 1
WHERE processed = 0
ORDER BY created_at ASC
LIMIT 500;
```

> **Memory hook:** ORDER BY + LIMIT turns a giant UPDATE into bite-sized nibbles — run the same statement in a loop until ROW_COUNT() tells you there's nothing left to chew.

---

## 8. UPDATE with Subquery

Not every "filter based on another table" problem needs a JOIN. Sometimes the cleanest way to say "only rows whose category is currently on promotion" is to nest a query inside the WHERE clause, the same way you'd write it in a SELECT.

```sql
-- Discount products that belong to a currently promoted category
UPDATE products
SET price = ROUND(price * 0.80, 2)
WHERE category_id IN (
    SELECT id FROM categories WHERE promotion_active = 1
);
```

### Correlated subquery

```sql
-- Set each product's average_review_score from the reviews table
UPDATE products p
SET average_review_score = (
    SELECT ROUND(AVG(score), 1)
    FROM reviews r
    WHERE r.product_id = p.id
)
WHERE EXISTS (
    SELECT 1 FROM reviews r WHERE r.product_id = p.id
);
```

### MySQL subquery restriction

Here's a rule that trips up almost everyone the first time they hit it: try to filter an UPDATE using a subquery on the *very same table* you're updating, and MySQL flatly refuses.

Why? Think of it like trying to rewrite a book while simultaneously reading from it to decide what to rewrite — MySQL isn't willing to let a subquery read from a table that's mid-update, because the two operations could see an inconsistent, half-changed version of the data. So it just blocks the pattern outright, rather than risk the ambiguity.

```sql
-- This fails in MySQL:
UPDATE products
SET price = 0
WHERE id IN (SELECT id FROM products WHERE stock = 0);
-- Error 1093: You can't specify target table for update in FROM clause
```

The workaround is a small trick: wrap the inner SELECT in a derived table (an extra layer of subquery). MySQL materialises the derived table as its own temporary result first, which breaks the "reading and writing the same table" conflict:

```sql
UPDATE products
SET price = 0
WHERE id IN (
    SELECT id FROM (
        SELECT id FROM products WHERE stock = 0
    ) AS sub
);
```

> **Memory hook:** MySQL won't let a subquery read the table it's currently rewriting — wrap it in one extra layer of subquery (a derived table) to make it a snapshot instead of a live read.

---

## 9. Common Patterns and Pitfalls

Everything so far has been about *how* to write an UPDATE. This section is the "war stories" section — the handful of patterns and mistakes that show up over and over once real, concurrent traffic starts hitting your tables.

### Pattern: atomic increment (views, votes, sequence numbers)

Picture a popular blog post getting viewed by a thousand people in the same second. If your application logic were "SELECT the current view_count, add 1 in code, then UPDATE it back," two requests could both read `1000`, both compute `1001`, and both write `1001` — you just lost a view. The fix is to never let the count leave the database in the first place:

```sql
UPDATE posts SET view_count = view_count + 1 WHERE id = 101;
-- Atomically increments — safe under concurrent access, no SELECT needed
```

MySQL/InnoDB does the read-modify-write entirely inside the engine, under a row lock, so concurrent increments never step on each other.

### Pattern: swap two column values

```sql
-- MySQL evaluates RHS using original values, so this works:
UPDATE products
SET price = old_price, old_price = price
WHERE id = 7;
```

### Pattern: conditional update only if value changes

```sql
UPDATE users
SET email = 'new@example.com', updated_at = NOW()
WHERE id = 42 AND email != 'new@example.com';
-- Only touches the row (and fires triggers) if the email actually changes
```

### Pitfall: updating without checking for concurrent modification

Here's the scenario: your app reads an account balance ($1000), does some arithmetic in application code, and writes back the new balance a moment later. In between the read and the write, another request came along, read the *same* original balance, and already wrote its own update. Now your write silently overwrites theirs — a classic "lost update." No error, no crash, just money quietly vanishing off the ledger.

**How MySQL's row locking actually helps (and where it doesn't):** during an UPDATE, InnoDB places an exclusive lock on the specific rows it's about to change, for the duration of the statement/transaction. That protects you *within* a single UPDATE statement — two concurrent `UPDATE accounts SET balance = balance - 100 WHERE id = 5` statements will queue up safely, one waiting for the other's lock to release, and neither loses an update. What row locking can't protect you from is the pattern above: SELECT, then think in application code, then UPDATE. The lock isn't held across that whole round-trip — only around the UPDATE statement itself. That gap is where lost updates sneak in.

```
Time →
 Request A: SELECT balance (=1000)  ────────────────►  UPDATE balance=900 (based on stale 1000)
 Request B:        SELECT balance (=1000) ──► UPDATE balance=900 (based on same stale 1000)
                                                         ▲
                                              Both computed from the SAME starting value —
                                              one update is silently lost.
```

The fix is optimistic locking: add a `version` column, and make the UPDATE itself the checkpoint — it only succeeds if the version still matches what you originally read.

```sql
-- Add a version column to the table
UPDATE accounts
SET balance = 850.00, version = version + 1
WHERE id = 5 AND version = 3;
-- If someone else updated the row first, version is now 4
-- ROW_COUNT() returns 0 → application retries
```

If `ROW_COUNT()` comes back 0, that's MySQL telling you "someone else got there first" — your application re-reads the fresh row and retries the whole computation.

**Common mistake:** relying on `SELECT ... FOR UPDATE` everywhere as a blanket fix. It works (it takes a pessimistic lock at SELECT time), but it holds locks for as long as the transaction is open, which hurts throughput under high concurrency. Optimistic locking (the version column) is usually the better default for anything that isn't a low-frequency, high-stakes operation.

**Interview answer:** "InnoDB's row-level exclusive locks protect an UPDATE statement itself from concurrent writes, but they don't span the gap between an application's SELECT and its later UPDATE. That gap is where lost updates happen: two clients read the same value, compute independently, and the second UPDATE overwrites the first. Optimistic locking closes that gap without holding locks the whole time — a version column is checked in the UPDATE's WHERE clause and incremented in the SET clause, so a stale write fails silently (ROW_COUNT() = 0) instead of clobbering a newer one."

> **Memory hook:** A row lock protects the moment you write, not the moment you read — the version column is what protects everything in between.

### Pitfall: forgetting that triggers fire on UPDATE

If the table has BEFORE/AFTER UPDATE triggers, they run for every row matched
by the UPDATE. A bulk update of 100 000 rows fires 100 000 trigger executions.
This can be orders of magnitude slower than expected.

### Summary of common mistakes

```
┌─────────────────────────────────────┬──────────────────────────────────────┐
│  Mistake                            │  Fix                                 │
├─────────────────────────────────────┼──────────────────────────────────────┤
│  No WHERE clause                    │  Always write WHERE first            │
│  WHERE on non-indexed column        │  Add index or use safe_updates       │
│  stock = stock - n without check    │  AND stock >= n in WHERE             │
│  Forgetting updated_at              │  SET updated_at = NOW() always       │
│  Updating the wrong table           │  Double-check table name in prompt   │
│  Subquery on same table             │  Wrap in derived table               │
└─────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 10. Hands-On Exercises

**Exercise 1 — Safe single-row update**

On a `products` table, update the price and stock of the product with
`sku = 'KB-007'`. Before running the UPDATE, write a SELECT to confirm exactly
which row will be affected. After the UPDATE, verify with SELECT and check
ROW_COUNT().

**Exercise 2 — Expression-based bulk update**

On a `products` table, apply a 12% price increase to all products in the
`'peripherals'` category that have a price below $100. Use an expression in
the SET clause. Preview with a SELECT first.

**Exercise 3 — Multi-table UPDATE**

You have `orders` (id, customer_id, total, status) and `customers`
(id, total_spent). Write a multi-table UPDATE that sets each customer's
`total_spent` to the SUM of their completed orders. Use a JOIN with a derived
subquery as the second table.

**Exercise 4 — ORDER BY + LIMIT batch**

Write a stored procedure (or just a script with a comment loop) that archives
the oldest 200 `log_entries` rows at a time by setting their `archived = 1`,
continuing until no more rows remain. Use ORDER BY + LIMIT on the UPDATE.

**Exercise 5 — Optimistic locking**

Design a table for a bank account with a `version` column. Write the UPDATE
statement for a withdrawal that decrements the balance only if the version
matches the one the application read, and increments the version. Describe
what the application should do if ROW_COUNT() returns 0.

---

## 11. Interview Q&A

**Q1: What happens if you run UPDATE without a WHERE clause?**

Every row in the table is updated with the new values. There is no automatic
undo. If binary logging is enabled (which it should be in production) you can
recover by replaying the binlog, but this requires downtime and expertise.
Always include WHERE, and run a SELECT first to confirm scope.

**Q2: What is sql_safe_updates and when would you disable it?**

sql_safe_updates=1 blocks any UPDATE or DELETE that does not include a WHERE
clause referencing an indexed column. It prevents accidental full-table
modifications. You would disable it temporarily (SET SESSION sql_safe_updates=0)
when a legitimate business operation requires updating all rows, such as a
global price adjustment. Re-enable it immediately after.

**Q3: How does MySQL evaluate expressions in a multi-column SET clause?**

MySQL evaluates all right-hand-side expressions using the original column values
before any changes are applied. This means SET a = b, b = a performs a true
swap. It also means SET col = col + 1, other_col = col sets other_col to the
original value of col, not col + 1.

**Q4: What is the difference between an UPDATE with a JOIN and an UPDATE with
a subquery?**

Both achieve the same result but with different performance characteristics. A
JOIN is generally more efficient because the query optimiser can choose join
algorithms and use indexes on both sides. A subquery may be less efficient,
especially correlated subqueries that re-execute for each row. Prefer JOINs for
multi-table UPDATEs when the relationship is straightforward.

**Q5: Can UPDATE be rolled back?**

Yes, if the UPDATE is inside an explicit transaction (or if autocommit=0) and
COMMIT has not been issued. After COMMIT, the only recovery path is point-in-time
recovery from a backup + binlog replay.

**Q6: What does ROW_COUNT() return after an UPDATE?**

The number of rows actually changed (values modified). Rows that matched the
WHERE but already had the target values do not count. To count matched rows
instead, enable CLIENT_FOUND_ROWS in the connection flags.

**Q7: How do you safely update a column that references its own value in a
high-concurrency environment?**

Use the atomic expression form: SET balance = balance - 100. MySQL's InnoDB
places a row-level exclusive lock on the row during the UPDATE, ensuring no
other connection can read or write the row mid-operation. This is safer than
SELECT + compute + UPDATE because the SELECT-to-UPDATE window is a race
condition without explicit locking.

**Q8: What is optimistic locking and how do you implement it with UPDATE?**

Optimistic locking assumes conflicts are rare. Add a version INTEGER column to
the table. When updating, include AND version = :read_version in the WHERE and
increment version in the SET. If another user modified the row between your
SELECT and UPDATE, the version will not match, ROW_COUNT() returns 0, and the
application retries. No pessimistic locks are held, so throughput is higher.

**Q9: Can MySQL UPDATE use ORDER BY and LIMIT? What are they useful for?**

Yes, MySQL uniquely supports ORDER BY + LIMIT on UPDATE (standard SQL does not).
It is useful for incremental batch processing — update the N oldest/cheapest/
newest rows, then repeat until done. This avoids locking large portions of the
table at once and limits the transaction size.

**Q10: Why would UPDATE trigger unexpectedly slow performance?**

Common causes: (1) No index on the WHERE column, causing a full table scan and
locking every row. (2) AFTER/BEFORE UPDATE triggers executing complex logic per
row. (3) FK checks on child tables for every updated PK. (4) Updating a column
that is part of an index, requiring B-tree rebalancing. Use EXPLAIN and slow
query log to diagnose.

**Q11: How does a multi-table UPDATE in MySQL differ from standard SQL?**

Standard SQL (ANSI) does not allow UPDATE to reference multiple tables in a
single statement. MySQL's extension allows UPDATE t1 JOIN t2 ON ... SET t1.col
= t2.col. This is specific to MySQL/MariaDB. In PostgreSQL you would use
UPDATE t1 SET col = t2.col FROM t2 WHERE t2.fk = t1.pk; — similar intent, 
different syntax.

**Q12: How do you update all rows while also keeping updated_at current?**

Include updated_at = NOW() in the SET clause:

```sql
UPDATE products
SET price = ROUND(price * 1.05, 2), updated_at = NOW()
WHERE category = 'electronics';
```

Alternatively, define an ON UPDATE CURRENT_TIMESTAMP on the column in the
table definition so MySQL maintains it automatically.
