# 02 — ALTER TABLE, DROP, TRUNCATE & RENAME

## Table of Contents

1. [Why ALTER TABLE Exists](#1-why-alter-table-exists)
2. [ADD COLUMN](#2-add-column)
3. [DROP COLUMN](#3-drop-column)
4. [MODIFY COLUMN](#4-modify-column)
5. [CHANGE COLUMN](#5-change-column)
6. [RENAME COLUMN](#6-rename-column)
7. [Index Operations](#7-index-operations)
8. [Constraint Operations](#8-constraint-operations)
9. [RENAME TABLE](#9-rename-table)
10. [DROP TABLE](#10-drop-table)
11. [TRUNCATE TABLE](#11-truncate-table)
12. [TRUNCATE vs DELETE vs DROP](#12-truncate-vs-delete-vs-drop)
13. [ALTER ALGORITHM and LOCK](#13-alter-algorithm-and-lock)
14. [Batching Multiple Changes](#14-batching-multiple-changes)
15. [Real-World Migration Example](#15-real-world-migration-example)
16. [Hands-On Exercises](#16-hands-on-exercises)
17. [Interview Q&A](#17-interview-qa)

---

## 1. Why ALTER TABLE Exists

**The problem, as a story:**

You shipped a `users` table six months ago. It looked complete at the time. Then product asks for a `phone` column. Then marketing wants a `country_code`. Then someone notices `id INT` is going to run out of headroom next year and needs to become `BIGINT`. None of this was in the original design — and the table now holds 50 million live rows with real traffic hitting it every second.

You can't just `DROP TABLE` and `CREATE TABLE` again with the new shape — that destroys every row you already have. You need a way to reshape a table that's already full of data, already being queried, without starting from zero.

**The analogy:**

Think of a house that's already built and lived in. You don't demolish it every time you want to add a room — you extend it wall by wall while people keep living inside. ALTER TABLE is the "renovate while occupied" tool for a database table.

**The definition:**

ALTER TABLE is the SQL statement that changes a table's structure — columns, indexes, constraints, even its name — while preserving the existing data and, ideally, keeping the table available for use.

```
Schema evolution lifecycle:
                                                  
  CREATE TABLE   →   ALTER TABLE   →   DROP TABLE  
  (initial build)    (iterative       (decommission)
                      change)         
                         ↓                        
                   Multiple ALTERs
                   over months/years              
```

**One catch to keep in mind before you touch production:** ALTER TABLE can be expensive on large tables. A column addition that takes milliseconds on a 1,000-row dev table may take 20 minutes on a 500-million-row production table. Section 13 covers exactly why, and how the ALGORITHM and LOCK options let you control it.

---

## 2. ADD COLUMN

**The problem:** the most common schema change of all is "we need one more field." A signup form grows a phone number, a product needs a new flag, an order needs a currency code. ADD COLUMN is how you bolt that on without rebuilding your whole data model.

### Basic syntax

```sql
ALTER TABLE table_name
    ADD COLUMN column_name data_type [constraints];
```

By default, new columns are appended at the end of the column list.

```sql
-- Add a simple column (appended at end)
ALTER TABLE users
    ADD COLUMN phone VARCHAR(20) NULL;

-- Add with a default value
ALTER TABLE products
    ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0;

-- Add NOT NULL column (must have a default, or table must be empty)
ALTER TABLE orders
    ADD COLUMN currency_code CHAR(3) NOT NULL DEFAULT 'AUD';
```

### Controlling column position

```sql
-- Add at the very beginning
ALTER TABLE users
    ADD COLUMN legacy_id INT NULL FIRST;

-- Add after a specific column
ALTER TABLE users
    ADD COLUMN middle_name VARCHAR(50) NULL AFTER first_name;
```

Here's a detail that trips people up: position is purely cosmetic. MySQL reads columns by name internally, not by their left-to-right order — so `FIRST` and `AFTER` don't change how queries behave. They only matter for:
- `SELECT *` output order
- Readability of `SHOW CREATE TABLE`
- Tools that generate code from column order

### Adding multiple columns in one statement

```sql
ALTER TABLE products
    ADD COLUMN weight_kg    DECIMAL(8,3) NULL          AFTER price,
    ADD COLUMN dimensions   VARCHAR(50)  NULL          AFTER weight_kg,
    ADD COLUMN is_digital   TINYINT(1)   NOT NULL DEFAULT 0;
```

Rule of thumb worth internalizing now, because it comes back in Section 14: always batch multiple changes to the same table into one ALTER TABLE statement — each ALTER TABLE is its own DDL operation with its own locking overhead, so three separate statements can mean three separate table rebuilds instead of one.

### NOT NULL columns and existing rows

Here's a scenario that catches people off guard the first time: you add a `NOT NULL` column to a table that already has rows in it. MySQL has to fill in a value for every existing row *right now* — so if you didn't give it a default, it simply refuses.

```sql
-- WRONG: will fail if table has existing rows and no default given
ALTER TABLE users
    ADD COLUMN country_code CHAR(2) NOT NULL;  -- ERROR on non-empty table

-- RIGHT option 1: provide a default
ALTER TABLE users
    ADD COLUMN country_code CHAR(2) NOT NULL DEFAULT 'AU';

-- RIGHT option 2: allow NULL temporarily, then backfill, then constrain
ALTER TABLE users
    ADD COLUMN country_code CHAR(2) NULL;

UPDATE users SET country_code = 'AU' WHERE country_code IS NULL;

ALTER TABLE users
    MODIFY COLUMN country_code CHAR(2) NOT NULL;
```

---

## 3. DROP COLUMN

**The problem:** a column outlived its purpose — a `legacy_id` from an old migration, a `deprecated_field` nobody reads anymore. Keeping dead columns around forever bloats every row and confuses the next engineer who reads the schema. DROP COLUMN removes them.

```sql
ALTER TABLE table_name
    DROP COLUMN column_name;
```

```sql
-- Remove a column
ALTER TABLE users
    DROP COLUMN legacy_id;

-- Drop multiple columns at once
ALTER TABLE products
    DROP COLUMN old_sku,
    DROP COLUMN deprecated_field;
```

Before you run this, know exactly what you're signing up for:
- **Permanent** — the data in that column is gone the moment this commits, unless you have a backup
- Drops any single-column indexes that existed solely for that column
- **Does not** automatically drop multi-column indexes that include that column — those need explicit removal, or MySQL will error out
- Foreign keys referencing the column block the drop outright

**Common mistake:** trying to drop a column that's part of a foreign key relationship without dropping the FK (and its index) first.

```sql
-- If column is part of an index, MySQL errors:
-- ERROR 1553: Cannot drop index 'idx_name': needed in a foreign key constraint

-- First drop the FK/index, then the column:
ALTER TABLE orders
    DROP FOREIGN KEY fk_orders_customer,
    DROP INDEX idx_orders_customer,
    DROP COLUMN old_customer_ref;
```

> **Memory hook:** "You can't demolish a wall that's holding up someone else's roof — take down the dependency first."

---

## 4. MODIFY COLUMN

**The problem:** you picked `INT` for an `id` column years ago, and now the table is approaching 2 billion rows — right at the edge of what `INT` can hold. Or a `VARCHAR(20)` name field turns out to be too short for real-world data. The column name is fine; it's the *definition* — type, size, nullability, default — that needs to change.

**The definition:** MODIFY COLUMN changes the **definition** of an existing column (type, nullability, default, etc.) while keeping the same column name.

```sql
ALTER TABLE table_name
    MODIFY COLUMN column_name new_definition;
```

```sql
-- Change type from INT to BIGINT (to accommodate growth)
ALTER TABLE events
    MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT;

-- Widen a VARCHAR
ALTER TABLE products
    MODIFY COLUMN name VARCHAR(500) NOT NULL;

-- Make a nullable column NOT NULL (after you've backfilled NULLs)
ALTER TABLE users
    MODIFY COLUMN email VARCHAR(150) NOT NULL;

-- Change a column's default
ALTER TABLE orders
    MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- Remove AUTO_INCREMENT (rarely needed, but possible)
ALTER TABLE temp_ids
    MODIFY COLUMN id INT NOT NULL;
-- AUTO_INCREMENT is gone; existing values stay
```

**Common mistake — the one that bites almost everyone at least once:** MODIFY COLUMN doesn't let you patch just the piece you're changing. You must **restate the full column definition**, every time, or MySQL silently drops whatever you left out. Forget `NOT NULL` and the column quietly becomes nullable — no error, no warning, just a constraint that's gone.

```sql
-- DANGER: loses NOT NULL if you forget to include it
ALTER TABLE users
    MODIFY COLUMN email VARCHAR(200);  -- now NULLable! Original was NOT NULL.

-- CORRECT: include full definition
ALTER TABLE users
    MODIFY COLUMN email VARCHAR(200) NOT NULL;
```

> **Memory hook:** "MODIFY COLUMN doesn't remember what you had — it only knows what you just told it. Say it all, every time."

---

## 5. CHANGE COLUMN

**The problem:** sometimes you need to rename a column *and* change its type or constraints in the same breath — say, `prod_price` was always a slightly awkward name, and while you're at it you also want to lock down its precision. CHANGE COLUMN does both at once.

CHANGE COLUMN **renames** a column AND can change its definition in one operation. Syntax requires writing the old name then the new name:

```sql
ALTER TABLE table_name
    CHANGE COLUMN old_column_name new_column_name new_definition;
```

```sql
-- Rename user_name to username, keeping same type
ALTER TABLE users
    CHANGE COLUMN user_name username VARCHAR(50) NOT NULL;

-- Rename and change type simultaneously
ALTER TABLE products
    CHANGE COLUMN prod_price price DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- Rename only (same definition) — must still write the full definition
ALTER TABLE customers
    CHANGE COLUMN cust_email email VARCHAR(150) NOT NULL UNIQUE;
```

---

## 6. RENAME COLUMN

**The problem:** CHANGE COLUMN works for a pure rename too, but it forces you to restate the entire type and constraint list just to change a name — annoying, and one more place to make the "forgot NOT NULL" mistake from Section 4. MySQL 8.0 fixed this with a dedicated, simpler syntax.

MySQL 8.0 introduced RENAME COLUMN — a cleaner syntax when you only want to rename (not retype):

```sql
-- MySQL 8.0+ only
ALTER TABLE table_name
    RENAME COLUMN old_name TO new_name;
```

```sql
ALTER TABLE users
    RENAME COLUMN user_name TO username;

-- Rename multiple in one statement
ALTER TABLE products
    RENAME COLUMN prod_name TO name,
    RENAME COLUMN prod_price TO price;
```

Comparison:

```
┌──────────────────────┬─────────────────────────────────────────┐
│ Operation            │ Syntax                                  │
├──────────────────────┼─────────────────────────────────────────┤
│ Rename only (8.0+)   │ RENAME COLUMN old TO new                │
│                      │ (clean, no type needed)                 │
├──────────────────────┼─────────────────────────────────────────┤
│ Rename + retype      │ CHANGE COLUMN old new type [constraints]│
│ (any version)        │ (full definition required)              │
├──────────────────────┼─────────────────────────────────────────┤
│ Retype only          │ MODIFY COLUMN col new_type [constraints]│
│ (keep same name)     │ (full definition required)              │
└──────────────────────┴─────────────────────────────────────────┘
```

---

## 7. Index Operations

**The problem:** a query that scans a whole table gets slower every day as the table grows. You noticed customers are being looked up by `customer_id` on nearly every request, but there's no index for it — so MySQL is scanning the entire `orders` table each time. Indexes fix this, and ALTER TABLE is one of the two ways to add or remove them.

### ADD INDEX

```sql
-- Regular index (non-unique)
ALTER TABLE orders
    ADD INDEX idx_orders_customer_id (customer_id);

-- Unique index
ALTER TABLE users
    ADD UNIQUE INDEX uq_users_email (email);

-- Composite index (column order matters for query optimization)
ALTER TABLE orders
    ADD INDEX idx_orders_customer_date (customer_id, created_at);

-- Full-text index
ALTER TABLE posts
    ADD FULLTEXT INDEX ft_posts_content (title, body);

-- Using CREATE INDEX syntax (equivalent)
CREATE INDEX idx_orders_status ON orders (status);
CREATE UNIQUE INDEX uq_products_sku ON products (sku);
```

### DROP INDEX

```sql
ALTER TABLE orders
    DROP INDEX idx_orders_customer_id;

-- Equivalent syntax
DROP INDEX idx_orders_customer_id ON orders;

-- Drop the primary key
ALTER TABLE table_name
    DROP PRIMARY KEY;
-- Only works if column is not AUTO_INCREMENT; remove AUTO_INCREMENT first if needed
```

### Viewing existing indexes

```sql
SHOW INDEXES FROM orders;
SHOW INDEX FROM orders;  -- same thing

-- Or query information_schema
SELECT
    INDEX_NAME,
    COLUMN_NAME,
    NON_UNIQUE,
    SEQ_IN_INDEX
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'orders'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;
```

---

## 8. Constraint Operations

**The problem:** an `orders` table has a `customer_id` column, but nothing stops someone from inserting `customer_id = 99999999` for a customer that doesn't exist. Constraints are the guardrails that keep your data honest — foreign keys for referential integrity, checks for value rules — and you add or remove them with ALTER TABLE just like columns and indexes.

### ADD CONSTRAINT (Foreign Key)

```sql
ALTER TABLE orders
    ADD CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
```

Prerequisites for adding a FK:
1. The referenced table and column must exist
2. Both columns must have compatible types (exact type match recommended)
3. The referenced column must be indexed (usually the PK)
4. All existing data in the FK column must satisfy the constraint (no orphaned rows)
5. InnoDB automatically creates an index on the FK column if one doesn't exist

### DROP CONSTRAINT (Foreign Key)

```sql
-- Drop a foreign key
ALTER TABLE orders
    DROP FOREIGN KEY fk_orders_customer;
-- This drops the FK constraint but NOT the underlying index
-- Drop the index separately if needed:
ALTER TABLE orders
    DROP INDEX fk_orders_customer;
```

### ADD CHECK Constraint (MySQL 8.0+)

```sql
ALTER TABLE products
    ADD CONSTRAINT chk_price CHECK (price >= 0);

ALTER TABLE employees
    ADD CONSTRAINT chk_salary CHECK (salary BETWEEN 0 AND 999999);
```

### DROP CHECK Constraint

```sql
ALTER TABLE products
    DROP CHECK chk_price;
```

### Finding constraint names

```sql
SELECT
    CONSTRAINT_NAME,
    CONSTRAINT_TYPE,
    TABLE_NAME
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'orders';

-- For FK details:
SELECT
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'orders'
  AND REFERENCED_TABLE_NAME IS NOT NULL;
```

---

## 9. RENAME TABLE

**The problem:** you've built a rebuilt/improved version of a live table (say, `orders_new` with a better schema) and now need to swap it in for `orders` — without a single moment where the application can't find the table at all. A plain rename would leave a tiny gap; RENAME TABLE closes that gap by renaming multiple tables in one atomic step.

```sql
-- Single rename
RENAME TABLE old_name TO new_name;

-- Rename multiple tables atomically
RENAME TABLE
    users_old  TO users_archive,
    users_new  TO users;

-- Using ALTER TABLE syntax (equivalent for single table)
ALTER TABLE old_name RENAME TO new_name;
```

Think of it like swapping a tire while the car keeps rolling — you can't have a moment where there's no wheel there at all. The atomic multi-table RENAME is exactly that trick for zero-downtime table swaps:

```sql
-- Pattern: swap a rebuilt table into production atomically
-- (Assumes you built a new version as 'orders_new')
RENAME TABLE
    orders     TO orders_old,  -- step 1: old live table steps aside
    orders_new TO orders;      -- step 2: new table takes the live name
-- Both happen atomically — no window where 'orders' doesn't exist
```

> **Memory hook:** "Swap the tire while the car's still rolling — RENAME TABLE never leaves the road wheel-less."

---

## 10. DROP TABLE

**The problem:** a feature got killed, or a migration left behind a scratch table nobody needs anymore. Keeping unused tables around is clutter at best and a foot-gun at worst (someone might query stale data by accident). DROP TABLE removes the table — structure and all its data — permanently.

```sql
-- Drop a single table (errors if it doesn't exist)
DROP TABLE table_name;

-- Drop with safety guard
DROP TABLE IF EXISTS table_name;

-- Drop multiple tables at once
DROP TABLE IF EXISTS temp_data, staging_products, old_logs;
```

**What's actually happening under the hood** when DROP TABLE runs:
- Removes the table definition from the data dictionary
- Deletes the `.ibd` tablespace file (all row data, indexes — gone, not soft-deleted)
- Auto-committed — there is no undo, no rollback, no recycle bin

**What stops DROP TABLE from running:**
- Other tables have FOREIGN KEY constraints referencing this table
- You must drop the FKs (or the dependent tables) first — MySQL won't let you pull a table out from under something that still points at it

```sql
-- Error scenario:
DROP TABLE customers;
-- ERROR 1451: Cannot delete or update a parent row:
-- a foreign key constraint fails (orders.fk_orders_customer)

-- Solution 1: drop the child table first
DROP TABLE orders;
DROP TABLE customers;

-- Solution 2: drop the FK constraint first
ALTER TABLE orders DROP FOREIGN KEY fk_orders_customer;
DROP TABLE customers;

-- Solution 3: temporarily disable FK checks (use with extreme caution)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE customers;
SET FOREIGN_KEY_CHECKS = 1;
```

> **Memory hook:** "DROP TABLE isn't a trash can you can dig through later — it's a shredder. Everything, including the folder, is gone."

---

## 11. TRUNCATE TABLE

**The problem:** a staging table gets loaded, processed, and needs to be emptied out before tomorrow's load — but you don't want to drop and recreate it (that loses indexes, constraints, permissions), and `DELETE FROM table` row-by-row on millions of rows is painfully slow. You want "empty this table, right now, as fast as possible."

**The analogy:** DELETE is like picking up each piece of trash off the floor one at a time. TRUNCATE is like flipping the whole room over and shaking everything out in one motion — same end result, wildly different speed.

**The definition:** TRUNCATE removes **all rows** from a table instantly, resetting AUTO_INCREMENT to 1, while keeping the table structure intact.

```sql
TRUNCATE TABLE table_name;
-- or
TRUNCATE table_name;  -- TABLE keyword is optional
```

```sql
-- Clear a staging table before a new data load
TRUNCATE TABLE staging_imports;

-- Reset a table and its AUTO_INCREMENT counter
TRUNCATE TABLE sessions;
-- Next INSERT will get id = 1

-- Cannot TRUNCATE if another table has a FK referencing this table
-- (even if there are no actual child rows)
TRUNCATE TABLE customers;
-- ERROR 1701: Cannot truncate a table referenced in a foreign key constraint
```

**How TRUNCATE works internally** — and this is the part that explains every quirk below:
- Drops and recreates the table (or resets the page pointers) instead of walking through rows one by one
- Bypasses row-by-row deletion entirely — there's no "row 1 deleted, row 2 deleted, ..." happening
- Resets AUTO_INCREMENT to the table's original starting value
- Does not fire DELETE triggers (there's no per-row DELETE event to fire them from)
- Not fully transactional in MySQL — it's a DDL statement in disguise, so it cannot be rolled back

**Common mistake:** assuming TRUNCATE behaves like `DELETE FROM table` with no WHERE clause, just "faster." It isn't a faster DELETE — it's a structurally different operation (drop + recreate under the hood), which is exactly why it skips triggers, resets AUTO_INCREMENT, and can't be rolled back. Also, forgetting that a lingering FK reference blocks it entirely, even with zero child rows.

> **Memory hook:** "TRUNCATE doesn't sweep the floor row by row — it swaps in a brand-new empty room."

---

## 12. TRUNCATE vs DELETE vs DROP

**The problem:** three different commands all "get rid of data," and interviewers love asking you to tell them apart — because picking the wrong one in production has burned real teams (accidentally TRUNCATE-ing a table you meant to DELETE from, losing rows you needed to roll back). This comparison comes up in every SQL interview. Know it cold.

```
┌─────────────────────────┬──────────────┬──────────────┬──────────────┐
│ Property                │ TRUNCATE     │ DELETE       │ DROP         │
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Removes rows            │ All rows     │ Filtered     │ All rows     │
│                         │              │ (or all)     │              │
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Removes structure       │ No           │ No           │ Yes          │
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ WHERE clause            │ Not allowed  │ Allowed      │ Not allowed  │
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Resets AUTO_INCREMENT   │ Yes (to 1)   │ No           │ N/A          │
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Fires triggers          │ No           │ Yes          │ No           │
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Transactional           │ No*          │ Yes          │ No           │
│ (rollbackable)          │              │              │              │
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Speed on large tables   │ Very fast    │ Slow         │ Very fast    │
│                         │ (O(1))       │ (O(n))       │ (O(1))       │
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ FK constraints          │ Blocked if   │ Blocked per  │ Blocked if   │
│                         │ referenced   │ row if child │ referenced   │
│                         │              │ rows exist   │              │
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Undo log written        │ No           │ Yes          │ No           │
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Binary log              │ Yes (stmt)   │ Yes          │ Yes          │
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ DDL or DML              │ DDL          │ DML          │ DDL          │
└─────────────────────────┴──────────────┴──────────────┴──────────────┘

* TRUNCATE on InnoDB technically acquires an exclusive lock and is
  logged, but it is implicitly committed and cannot be rolled back.
```

**When to use each:**

```
Use TRUNCATE when:
├── You need to clear ALL rows from a table
├── You want AUTO_INCREMENT reset to 1
├── Speed matters (millions of rows)
└── You're loading fresh data into a staging table

Use DELETE when:
├── You need a WHERE clause (partial deletion)
├── You need DELETE triggers to fire
├── You need to be able to roll back the operation
└── The table is referenced by FKs with child rows

Use DROP when:
├── You no longer need the table at all
├── You're decommissioning a feature
└── You're cleaning up migration artifacts
```

**Interview answer:** "TRUNCATE, DELETE, and DROP all remove data, but they operate at different levels. DELETE is DML — it removes rows (optionally filtered by a WHERE clause), fires triggers, and is fully transactional. TRUNCATE and DROP are both DDL: TRUNCATE empties all rows and resets AUTO_INCREMENT without touching the table's structure, while DROP removes the structure entirely — columns, indexes, constraints, everything. TRUNCATE and DROP are auto-committed and can't be rolled back; DELETE can. All three are blocked by foreign keys with dependent data, though TRUNCATE is blocked even if zero child rows exist, since it can't perform the per-row check DELETE does."

> **Memory hook:** "DELETE picks rows off the shelf one at a time. TRUNCATE empties the whole shelf in one motion. DROP takes the shelf away."

---

## 13. ALTER ALGORITHM and LOCK

**The problem:** you need to add an index to a 500-million-row production table that gets thousands of writes per second. If MySQL locks that table for the ten minutes the rebuild takes, every one of those writes queues up or times out — an outage you caused with a "routine" schema change. Understanding ALGORITHM and LOCK is what separates a boring, safe change from a self-inflicted incident.

### The Three Algorithms

```
┌────────────────────────────────────────────────────────────────┐
│                  ALTER TABLE Algorithms                        │
├───────────────┬────────────────────────────────────────────────┤
│ INSTANT       │ Metadata-only change. No table rebuild.        │
│               │ Available MySQL 8.0+ for certain operations.   │
│               │ Zero downtime. Fastest possible.               │
├───────────────┼────────────────────────────────────────────────┤
│ INPLACE       │ Uses InnoDB Online DDL. Rebuilds happen in the │
│               │ background. Reads and some writes allowed       │
│               │ during the operation.                          │
├───────────────┼────────────────────────────────────────────────┤
│ COPY          │ Creates a full copy of the table, applies the  │
│               │ change, swaps it in. Full table scan required. │
│               │ Table may be locked for reads and writes.      │
│               │ Slowest. Uses 2x disk space temporarily.       │
└───────────────┴────────────────────────────────────────────────┘
```

MySQL chooses the best algorithm automatically. You can specify one as a hint, and MySQL will error rather than silently fall back to something slower — which is exactly what you want when you're about to run this against production and need to know *before* it starts whether it'll be safe:

```sql
ALTER TABLE orders
    ADD COLUMN notes TEXT NULL,
    ALGORITHM=INSTANT;   -- error if INSTANT not possible

ALTER TABLE products
    ADD INDEX idx_cat (category_id),
    ALGORITHM=INPLACE,   -- try inplace first
    LOCK=NONE;           -- allow reads and writes during rebuild
```

**What's actually happening internally with `ALGORITHM=INPLACE, LOCK=NONE`** — this is the mechanism that makes "online DDL" possible:

```
1. MySQL builds a new, empty copy of the index/table structure
   in the background — the original table stays fully readable
   and writable the whole time.
        |
        v
2. While the rebuild runs, every INSERT/UPDATE/DELETE that hits
   the live table also gets appended to a temporary
   "row-change log" (buffers the concurrent DML).
        |
        v
3. The background process finishes building the new structure
   from the original data.
        |
        v
4. MySQL takes a brief metadata lock, replays the buffered
   row-change log onto the new structure to catch it up,
   then atomically swaps it in.
        |
        v
5. Lock released. Total "table frozen" time: milliseconds,
   not minutes — even though the rebuild itself took minutes.
```

That's the trick: the expensive part (scanning/rebuilding) happens without blocking anyone, and only the cheap part (replaying a short buffered log and swapping pointers) needs a lock.

### LOCK options

```
┌─────────────────────────────────────────────────────────────┐
│                    LOCK Options                             │
├─────────────┬───────────────────────────────────────────────┤
│ LOCK=NONE   │ Allow concurrent reads AND writes             │
│             │ Best for production — zero impact             │
├─────────────┼───────────────────────────────────────────────┤
│ LOCK=SHARED │ Allow concurrent reads, block writes          │
├─────────────┼───────────────────────────────────────────────┤
│ LOCK=DEFAULT│ MySQL decides based on operation type         │
├─────────────┼───────────────────────────────────────────────┤
│ LOCK=EXCLUSIVE│ Block all reads and writes                  │
│             │ Maximum isolation, maximum disruption         │
└─────────────┴───────────────────────────────────────────────┘
```

### Operations by algorithm support

```
Operation                          | INSTANT | INPLACE | COPY
───────────────────────────────────┼─────────┼─────────┼─────
ADD COLUMN (no constraints) 8.0+   |   Yes   |   Yes   | Yes
ADD COLUMN at non-last position    |   No    |   Yes*  | Yes
DROP COLUMN                        |   No    |   Yes   | Yes
MODIFY COLUMN type change          |   No    |   Some  | Yes
ADD INDEX                          |   No    |   Yes   | Yes
DROP INDEX                         |   No    |   Yes   | Yes
ADD PRIMARY KEY                    |   No    |   Yes*  | Yes
ADD FOREIGN KEY                    |   No    |   Yes   | Yes
RENAME TABLE                       |   Yes   |   Yes   | Yes
RENAME COLUMN                      |   Yes   |   Yes   | Yes

* Some subtypes may fall back to COPY
```

**Common mistake:** assuming every ALTER TABLE is safe just because the table is InnoDB and "InnoDB supports online DDL." Some operations — like certain type changes — can only run as COPY, meaning a full table scan and a much bigger lock footprint. Always check the table above (or run `ALGORITHM=INPLACE` as a hint) before assuming a change will be non-blocking.

**Interview answer:** "MySQL's InnoDB storage engine supports three DDL algorithms: INSTANT (metadata-only, no rebuild, fastest), INPLACE (rebuilds happen in the background via InnoDB Online DDL, with reads and often writes still allowed), and COPY (a full table copy — the slowest, most disruptive option, needed for operations the other two can't handle). Combined with the LOCK option (NONE, SHARED, DEFAULT, EXCLUSIVE), you can control exactly how much concurrent access a schema change permits. For production tables, you specify the algorithm as a hint so MySQL errors out immediately if it can't honor it, rather than silently choosing a slower, more disruptive path."

> **Memory hook:** "INSTANT just updates a label. INPLACE renovates around you while you keep living there. COPY moves you out, rebuilds the house, moves you back in."

For large production tables, use Percona's `pt-online-schema-change` or GitHub's `gh-ost` for complex changes when the built-in online DDL isn't sufficient.

---

## 14. Batching Multiple Changes

**The problem:** you need to add two columns and an index to the same table. Run three separate ALTER TABLE statements and — depending on the algorithm each one triggers — you could be paying for three separate table rebuilds instead of one. Every ALTER TABLE is a separate DDL operation with its own locking overhead, so combine multiple changes to the same table into a single ALTER TABLE statement whenever you can.

```sql
-- BAD: three separate table rebuilds
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL;
ALTER TABLE users ADD COLUMN date_of_birth DATE NULL;
ALTER TABLE users ADD INDEX idx_users_phone (phone);

-- GOOD: one rebuild
ALTER TABLE users
    ADD COLUMN phone         VARCHAR(20) NULL,
    ADD COLUMN date_of_birth DATE        NULL,
    ADD INDEX  idx_users_phone (phone);
```

---

## 15. Real-World Migration Example

Everything above is easier to remember once you've seen it stitched together in one real migration. Here's a migration script evolving a `products` table from v1 to v2 — notice how it batches columns and indexes into one ALTER (Section 14), pins the algorithm and lock mode (Section 13), and separates the risky backfill into its own DML step rather than cramming it into the DDL:

```sql
-- Migration: 2024_03_15_001_products_v2.sql
-- Purpose: Add multi-currency support, soft-delete, and full-text search index
-- Estimated impact: INPLACE with LOCK=NONE — safe for production

-- Step 1: Add new columns
ALTER TABLE products
    -- Price in original currency (rename old 'price' semantics)
    ADD COLUMN price_usd        DECIMAL(10,2) NULL
        COMMENT 'Price in USD, NULL if not available'
        AFTER price,

    -- Soft delete support
    ADD COLUMN deleted_at       TIMESTAMP NULL DEFAULT NULL
        COMMENT 'NULL = active; timestamp = soft-deleted',

    -- New searchable tags
    ADD COLUMN search_keywords  VARCHAR(500) NULL
        COMMENT 'Space-separated keywords for full-text search',

    -- v2 flags
    ADD COLUMN v2_migrated      TINYINT(1) NOT NULL DEFAULT 0,

    -- Full-text index
    ADD FULLTEXT INDEX ft_products_search (name, search_keywords),

    -- Index for soft-delete queries
    ADD INDEX idx_products_deleted (deleted_at),

    ALGORITHM=INPLACE,
    LOCK=NONE;

-- Step 2: Backfill USD prices (separate DML — not in same ALTER)
UPDATE products
SET price_usd = price * 1.0,   -- assume original was already USD
    v2_migrated = 1
WHERE v2_migrated = 0;

-- Step 3: After backfill verified, constrain the column
ALTER TABLE products
    MODIFY COLUMN price_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    ALGORITHM=INPLACE,
    LOCK=NONE;
```

---

## 16. Hands-On Exercises

### Exercise 1 — Evolve a Users Table

You have a `users` table with: id, username, email, password_hash, created_at.

Write ALTER statements to:
1. Add `first_name VARCHAR(50) NOT NULL DEFAULT ''` and `last_name VARCHAR(50) NOT NULL DEFAULT ''` after `username`
2. Add `phone VARCHAR(20) NULL` after `last_name`
3. Add `is_verified TINYINT(1) NOT NULL DEFAULT 0` and `verified_at TIMESTAMP NULL`
4. Add `updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
5. Add a unique index on email (if one doesn't exist)
6. All in a single ALTER TABLE statement

<details>
<summary>Solution</summary>

```sql
ALTER TABLE users
    ADD COLUMN first_name  VARCHAR(50)  NOT NULL DEFAULT ''   AFTER username,
    ADD COLUMN last_name   VARCHAR(50)  NOT NULL DEFAULT ''   AFTER first_name,
    ADD COLUMN phone       VARCHAR(20)  NULL                  AFTER last_name,
    ADD COLUMN is_verified TINYINT(1)   NOT NULL DEFAULT 0,
    ADD COLUMN verified_at TIMESTAMP    NULL,
    ADD COLUMN updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                           ON UPDATE CURRENT_TIMESTAMP,
    ADD UNIQUE INDEX uq_users_email (email);
```
</details>

---

### Exercise 2 — Fix Type Mistakes

A table `inventory` was created with wrong types:
- `quantity` is VARCHAR(10) — should be INT NOT NULL DEFAULT 0
- `unit_cost` is FLOAT — should be DECIMAL(10,4)
- `product_code` is VARCHAR(20) — needs to be VARCHAR(50) to match updated products table
- `created_date` is a TEXT column — should be DATE

Write the ALTER to fix all four issues at once.

<details>
<summary>Solution</summary>

```sql
ALTER TABLE inventory
    MODIFY COLUMN quantity     INT            NOT NULL DEFAULT 0,
    MODIFY COLUMN unit_cost    DECIMAL(10,4)  NOT NULL,
    MODIFY COLUMN product_code VARCHAR(50)    NOT NULL,
    MODIFY COLUMN created_date DATE           NOT NULL;
```
</details>

---

### Exercise 3 — Add Foreign Keys Safely

You have an `orders` table with `customer_id INT NULL` and `product_id INT NULL`. Both are currently unindexed and have no FK constraints. The referenced tables `customers(id)` and `products(id)` exist.

Write a migration that:
1. Verifies no orphaned rows exist (write the SELECT to check)
2. Adds indexes on both FK columns
3. Adds NOT NULL constraints
4. Adds the FK constraints with appropriate ON DELETE behavior

<details>
<summary>Solution</summary>

```sql
-- Step 1: Check for orphans before adding FK
SELECT o.id, o.customer_id
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
WHERE c.id IS NULL;

SELECT o.id, o.product_id
FROM orders o
LEFT JOIN products p ON o.product_id = p.id
WHERE p.id IS NULL;

-- If both return 0 rows, proceed:

-- Step 2: Add indexes + NOT NULL + FK constraints in one ALTER
ALTER TABLE orders
    MODIFY COLUMN customer_id INT NOT NULL,
    MODIFY COLUMN product_id  INT NOT NULL,
    ADD INDEX idx_orders_customer (customer_id),
    ADD INDEX idx_orders_product  (product_id),
    ADD CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    ADD CONSTRAINT fk_orders_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
```
</details>

---

### Exercise 4 — TRUNCATE vs DELETE decision

For each scenario, choose TRUNCATE or DELETE and write the statement:

1. Clear a `session_tokens` table completely during nightly maintenance. Speed matters, and there are no FK references to it.
2. Remove all orders placed before 2022-01-01 from an `orders` table.
3. Clear a `email_queue` table for a retry run. The queue must restart from ID 1.
4. Remove users who have `is_banned = 1` from a `users` table.

<details>
<summary>Solution</summary>

```sql
-- 1. TRUNCATE: all rows, no FK refs, speed matters, OK to reset ID
TRUNCATE TABLE session_tokens;

-- 2. DELETE: partial deletion with WHERE clause
DELETE FROM orders WHERE created_at < '2022-01-01';

-- 3. TRUNCATE: all rows, must reset AUTO_INCREMENT to 1
TRUNCATE TABLE email_queue;

-- 4. DELETE: partial deletion with WHERE clause
DELETE FROM users WHERE is_banned = 1;
```
</details>

---

### Exercise 5 — Rename Column Safe Migration

A `customers` table has a column `cust_nm` that needs to be renamed to `full_name`. The column is VARCHAR(100) NOT NULL. There are application queries using both names during a transition period.

Write the migration strategy knowing:
- MySQL version is 8.0+
- Application will be updated in a separate deploy

<details>
<summary>Solution</summary>

```sql
-- Step 1: Add the new column (keep old for app compatibility)
ALTER TABLE customers
    ADD COLUMN full_name VARCHAR(100) NULL
    AFTER cust_nm;

-- Step 2: Backfill new column from old
UPDATE customers SET full_name = cust_nm;

-- Step 3: Constrain new column
ALTER TABLE customers
    MODIFY COLUMN full_name VARCHAR(100) NOT NULL;

-- Step 4: After application deploy uses full_name, remove old column
ALTER TABLE customers
    DROP COLUMN cust_nm;

-- Alternative (if all app code can be updated in one deploy, 8.0+ only):
ALTER TABLE customers
    RENAME COLUMN cust_nm TO full_name;
```
</details>

---

## 17. Interview Q&A

**Q1: What is the difference between MODIFY COLUMN and CHANGE COLUMN?**

A: MODIFY COLUMN changes the column definition (type, constraints, default) while keeping the same column name. CHANGE COLUMN renames the column AND can change its definition in one operation. CHANGE COLUMN requires writing the old name then the new name. In MySQL 8.0+, RENAME COLUMN is a cleaner option when you only want to rename without changing the type.

---

**Q2: Why should you batch multiple ALTER TABLE changes into one statement?**

A: Each ALTER TABLE statement performs a full DDL operation, which may involve rebuilding the table (depending on the algorithm), acquiring locks, and updating the data dictionary. Multiple ALTER TABLE statements on the same table means multiple potential table rebuilds. Batching them combines everything into one rebuild, which is faster and reduces the total lock time.

---

**Q3: What is the difference between DROP TABLE and TRUNCATE TABLE?**

A: DROP TABLE removes the table entirely — structure, data, indexes, and constraints are all gone. TRUNCATE TABLE removes all rows and resets AUTO_INCREMENT but keeps the table structure, indexes, and constraint definitions intact. Both are DDL operations (auto-committed, non-transactional). TRUNCATE cannot be used if another table has a FK constraint referencing the truncated table, even if no child rows currently exist.

---

**Q4: Can TRUNCATE be rolled back?**

A: No. TRUNCATE TABLE is a DDL statement in MySQL. Even within an explicit transaction, TRUNCATE causes an implicit COMMIT before it executes. Attempting to ROLLBACK after TRUNCATE will not restore the data.

---

**Q5: What does ALGORITHM=INSTANT mean and when is it used?**

A: ALGORITHM=INSTANT makes only a metadata change — it updates the data dictionary without touching the actual table data. It is available in MySQL 8.0+ for specific operations like adding a column at the end of a table (without defaults that require backfill), renaming a column, or changing column default values. It is the fastest possible DDL with zero impact on table availability.

---

**Q6: Why can't you TRUNCATE a table that has a FK constraint pointing to it?**

A: TRUNCATE bypasses the row-by-row deletion mechanism, so it cannot perform the per-row FK violation checks that DELETE does. MySQL prevents this entirely — even if there are no child rows — because the TRUNCATE's mechanism can't guarantee the check. To work around it: either DELETE all rows instead, drop the FK first and re-add it after, or temporarily disable FK checks (with caution).

---

**Q7: What happens to indexes when you ADD a column with ALTER TABLE?**

A: Existing indexes are unaffected by ADD COLUMN. The new column is simply appended to the logical row format. If you want an index on the new column, add it explicitly in the same ALTER TABLE statement. ALGORITHM=INSTANT (8.0+) can add a column without rebuilding the table at all.

---

**Q8: What is the Online DDL and how does LOCK=NONE work?**

A: InnoDB's Online DDL allows table rebuilds to happen in the background while the table remains available for reads and some writes. With LOCK=NONE, MySQL buffers DML operations (INSERT, UPDATE, DELETE) that occur during the rebuild in a temporary row-change log, then replays those changes onto the rebuilt table at the end. The table is only locked briefly at the very end to swap in the rebuilt version and replay the final changes.

---

**Q9: What happens to AUTO_INCREMENT when you TRUNCATE vs DELETE all rows?**

A: TRUNCATE resets AUTO_INCREMENT to the table's starting value (usually 1, or whatever was specified in CREATE TABLE). DELETE does not reset AUTO_INCREMENT — the counter continues from where it left off. After `DELETE FROM t`, the next INSERT still gets the next value after the highest ID that ever existed in the table.

---

**Q10: How do you safely rename a column that is referenced by application code in production?**

A: The safest approach is a phased migration: (1) ADD the new column, (2) set up a trigger to sync old→new and new→old during the transition window, (3) backfill new column from old, (4) deploy the application change to use the new column name, (5) DROP the old column and triggers. In MySQL 8.0+, RENAME COLUMN is an INSTANT metadata-only operation — but the application still needs to stop using the old name, so the phased approach or a coordinated deploy is still required.
