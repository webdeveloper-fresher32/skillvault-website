# 01 — CREATE TABLE

## Table of Contents

1. [What CREATE TABLE Does](#1-what-create-table-does)
2. [Basic Syntax](#2-basic-syntax)
3. [Column Definition Options](#3-column-definition-options)
4. [Column-Level Constraints](#4-column-level-constraints)
5. [Table-Level Constraints](#5-table-level-constraints)
6. [Storage Engine and Charset](#6-storage-engine-and-charset)
7. [IF NOT EXISTS Guard](#7-if-not-exists-guard)
8. [CREATE TABLE LIKE](#8-create-table-like)
9. [CREATE TABLE AS SELECT](#9-create-table-as-select)
10. [CREATE TEMPORARY TABLE](#10-create-temporary-table)
11. [Real-World Schema Example](#11-real-world-schema-example)
12. [Under the Hood](#12-under-the-hood)
13. [Hands-On Exercises](#13-hands-on-exercises)
14. [Interview Q&A](#14-interview-qa)

---

## 1. What CREATE TABLE Does

Before you can put a single row of data anywhere, MySQL needs to know three things: what the data looks like, what rules it must obey, and where it should live physically on disk. Without that, "INSERT a row" is a meaningless instruction — inserted into what shape, with what columns, in what order?

That's the problem CREATE TABLE solves. It's the statement that answers "what does a row of this data look like?" before a single row exists.

Real-world analogy: CREATE TABLE is like filing the **blueprint** for a building. The land is reserved, the floor plan is recorded — how many rooms, what size, which doors lock — but no one lives there yet. INSERT is when tenants actually move in.

So, definition: CREATE TABLE registers a new **table definition** in the data dictionary (the catalog of what exists in your database). It allocates the structure — column names, their types, constraints, indexes — but does not store any row data yet.

```
┌─────────────────────────────────────────────┐
│             MySQL Data Dictionary            │
│                                              │
│  information_schema.TABLES                   │
│  information_schema.COLUMNS                  │
│  information_schema.KEY_COLUMN_USAGE         │
│                                              │
│  ← CREATE TABLE writes here                 │
│  ← DROP TABLE removes here                  │
└─────────────────────────────────────────────┘
```

> **Memory hook:** "CREATE TABLE files the blueprint — INSERT moves the tenants in."

---

## 2. Basic Syntax

Strip away every option and CREATE TABLE boils down to one idea: a name, followed by a comma-separated list of columns (each with a type), wrapped in parentheses. Everything else — constraints, engine, charset — is decoration on top of that skeleton.

```sql
CREATE TABLE table_name (
    column1 datatype [column_constraints],
    column2 datatype [column_constraints],
    ...
    [table_constraints]
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Full annotated example:

```sql
CREATE TABLE employees (
    -- column name   data type     column-level constraints
    id               INT           NOT NULL AUTO_INCREMENT,
    first_name       VARCHAR(50)   NOT NULL,
    last_name        VARCHAR(50)   NOT NULL,
    email            VARCHAR(100)  NOT NULL,
    hire_date        DATE          NOT NULL,
    salary           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    department_id    INT           NULL,
    is_active        TINYINT(1)    NOT NULL DEFAULT 1,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

    -- table-level constraints
    PRIMARY KEY (id),
    UNIQUE KEY uq_employees_email (email),
    INDEX idx_employees_department (department_id),
    INDEX idx_employees_last_name  (last_name),
    CONSTRAINT fk_employees_dept
        FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci
COMMENT='Core employee records';
```

---

## 3. Column Definition Options

A bare column name and data type is rarely enough — you also want to say "this can never be empty," "default to this value if nobody provides one," or "generate this number automatically." That's what the bracketed options after the data type are for.

Each column follows this pattern:

```
column_name  data_type  [NOT NULL | NULL]  [DEFAULT value]
             [AUTO_INCREMENT]  [UNIQUE]  [PRIMARY KEY]
             [COMMENT 'text']  [COLUMN_FORMAT FIXED|DYNAMIC|DEFAULT]
```

### 3.1 NOT NULL vs NULL

Think about a `name` column on a `users` table. What should happen if someone tries to insert a user with no name at all? If you say nothing, MySQL shrugs and lets it through as NULL. Is that really what you want?

```sql
-- NULL means "value unknown / not provided" (not zero, not empty string)
-- Always be explicit:
name  VARCHAR(100) NOT NULL,  -- rejects INSERT without a name
notes TEXT         NULL,      -- explicitly allows absence of notes
```

MySQL's default when you omit NULL/NOT NULL is **NULL allowed** — most of the time you want NOT NULL. Be deliberate.

### 3.2 DEFAULT Values

```sql
-- Static literal defaults
status       VARCHAR(20)   NOT NULL DEFAULT 'active',
quantity     INT           NOT NULL DEFAULT 0,
price        DECIMAL(10,2) NOT NULL DEFAULT 0.00,

-- Timestamp defaults
created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

-- MySQL 8.0+: expression defaults
expiry_date  DATE          NOT NULL DEFAULT (CURRENT_DATE + INTERVAL 30 DAY),
uuid_col     CHAR(36)      NOT NULL DEFAULT (UUID()),
```

Rules for DEFAULT:
- Must be a constant, or (MySQL 8.0+) a parenthesized expression
- Cannot reference other columns in the same table
- NULL columns implicitly default to NULL unless you specify otherwise

### 3.3 AUTO_INCREMENT

Every row needs some way to be uniquely identified. You could try to generate unique IDs yourself in application code — but now two concurrent requests can race and pick the same ID. AUTO_INCREMENT hands that problem to MySQL: it guarantees the next number, safely, even under concurrent inserts.

```sql
id  INT  NOT NULL  AUTO_INCREMENT,
PRIMARY KEY (id)
```

- Only one AUTO_INCREMENT column per table
- Must be part of an index (PRIMARY KEY or UNIQUE KEY)
- Starts at 1 by default; change with `AUTO_INCREMENT = 1000`
- Gaps are normal: rolled-back transactions still consume the counter
- The counter is stored in the tablespace header (InnoDB) — resets on server restart for tables that never had rows until MySQL 8.0 persisted it

```sql
-- Start sequence at 1000
CREATE TABLE orders (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) AUTO_INCREMENT = 1000;
```

> **Memory hook:** "AUTO_INCREMENT is a ticket-dispenser machine — it only ever hands out the next number, never reuses a torn-off ticket."

### 3.4 COMMENT

Six months from now, will you remember why `status_code = 7` means "refunded"? Probably not — and neither will the next developer who inherits this schema. COMMENT lets you leave that explanation right where it belongs: attached to the column itself.

```sql
user_id  INT  NOT NULL  COMMENT 'References users.id, never reused',
```

Comments are stored in information_schema.COLUMNS and visible in SHOW CREATE TABLE. Use them on non-obvious columns.

---

## 4. Column-Level Constraints

Some rules belong to a single column and nowhere else — "this SKU must be unique," "this price can't be negative." Writing those rules right next to the column they govern keeps the schema readable: you see the column and its rule in one glance, instead of hunting through a separate block at the bottom of the statement.

Column-level constraints are written inline with the column definition. Use them when the constraint applies to **exactly one column**.

```sql
CREATE TABLE products (
    id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sku          VARCHAR(50)  NOT NULL UNIQUE,
    name         VARCHAR(200) NOT NULL,
    price        DECIMAL(10,2) NOT NULL,
    stock        INT          NOT NULL DEFAULT 0 CHECK (stock >= 0),
    category_id  INT          REFERENCES categories(id)  -- inline FK (limited)
);
```

Column-level constraint summary:

```
┌─────────────────┬──────────────────────────────────────────────┐
│ Constraint      │ Column-Level Syntax                          │
├─────────────────┼──────────────────────────────────────────────┤
│ PRIMARY KEY     │ col INT NOT NULL AUTO_INCREMENT PRIMARY KEY  │
│ UNIQUE          │ col VARCHAR(50) NOT NULL UNIQUE              │
│ NOT NULL        │ col INT NOT NULL                             │
│ DEFAULT         │ col INT NOT NULL DEFAULT 0                   │
│ CHECK           │ col INT CHECK (col > 0)                      │
│ FOREIGN KEY     │ col INT REFERENCES other_table(id)           │
│                 │ (syntax accepted but FK not enforced this way│
│                 │ in MySQL — use table-level FOREIGN KEY)      │
└─────────────────┴──────────────────────────────────────────────┘
```

> Important: MySQL **ignores** inline REFERENCES syntax at the column level for enforcement purposes. Always use a table-level FOREIGN KEY constraint to get actual FK behavior.

---

## 5. Table-Level Constraints

Now flip the scenario: what if a rule needs *two* columns to make sense — like "the combination of order_id and product_id must be unique," where neither column alone is unique? There's no way to bolt that rule onto a single column definition. It has to live at the table level, after all the columns are declared, so it can reference more than one of them at once.

Table-level constraints appear after all column definitions, separated by commas. Use them when:
- The constraint spans **multiple columns** (composite PK, composite UNIQUE, composite FK)
- You want to **name** the constraint explicitly
- You want the definition to be more readable

```sql
CREATE TABLE order_items (
    order_id    INT           NOT NULL,
    product_id  INT           NOT NULL,
    quantity    INT           NOT NULL DEFAULT 1,
    unit_price  DECIMAL(10,2) NOT NULL,
    discount    DECIMAL(5,2)  NOT NULL DEFAULT 0.00,

    -- Table-level constraints:
    PRIMARY KEY (order_id, product_id),               -- composite PK

    CONSTRAINT chk_quantity   CHECK (quantity > 0),
    CONSTRAINT chk_discount   CHECK (discount BETWEEN 0 AND 100),
    CONSTRAINT chk_unit_price CHECK (unit_price >= 0),

    CONSTRAINT fk_oi_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_oi_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_oi_product (product_id)   -- for FK lookup performance
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4;
```

When to use table-level vs column-level:

```
┌────────────────────────────┬──────────────┬────────────────┐
│ Situation                  │ Column-Level │ Table-Level    │
├────────────────────────────┼──────────────┼────────────────┤
│ Single-column PK           │ OK           │ OK             │
│ Composite PK               │ Not possible │ Required       │
│ Single-column UNIQUE       │ OK           │ OK             │
│ Composite UNIQUE           │ Not possible │ Required       │
│ FK with ON DELETE/UPDATE   │ Not enforced │ Required       │
│ Named constraint           │ Not possible │ Required       │
│ Simple CHECK               │ OK           │ OK             │
│ Multi-column CHECK         │ Not possible │ Required       │
└────────────────────────────┴──────────────┴────────────────┘
```

---

## 6. Storage Engine and Charset

### 6.1 ENGINE=InnoDB

Here's a question that trips up a lot of people coming from other databases: MySQL doesn't have just one way of storing a table on disk — it has pluggable **storage engines**, and the one you pick changes what the table can and can't do. Get transactions? Get row-level locking so two people can update different rows at once without blocking each other? Get crash-safe recovery? Whether you get any of that depends entirely on the ENGINE clause.

Analogy: choosing a storage engine is like choosing between a bank vault and a cardboard box for the same paperwork. Both "store documents," but only one of them survives a fire, and only one of them lets two clerks pull different folders out at the same time without getting in each other's way.

Always use InnoDB unless you have a specific reason not to.

```
┌──────────────────────────────────────────────────────────────┐
│                    InnoDB vs MyISAM                          │
├──────────────────────────┬──────────────────────────────────┤
│ Feature                  │ InnoDB        │ MyISAM           │
├──────────────────────────┼──────────────────────────────────┤
│ Transactions (ACID)      │ Yes           │ No               │
│ Foreign keys             │ Yes           │ No               │
│ Row-level locking        │ Yes           │ Table-level only │
│ Crash recovery           │ Yes (redo log)│ Manual repair    │
│ Full-text search         │ Yes (5.6+)    │ Yes              │
│ MVCC (concurrent reads)  │ Yes           │ No               │
│ Clustered index          │ Yes           │ No               │
└──────────────────────────┴──────────────┴──────────────────┘
```

**Common mistake:** picking MyISAM (or inheriting old tables that use it) because it's "faster," without realizing it silently drops foreign key enforcement and locks the *entire table* on every write. On any table with concurrent writers, that's a real bottleneck, not a minor tradeoff.

**Interview answer:** "InnoDB is the default and recommended storage engine because it supports ACID transactions, row-level locking, MVCC for concurrent reads, foreign key constraints, and crash recovery via redo/undo logs. MyISAM lacks all of these — it only supports table-level locking and has no transaction or FK support — so it's rarely the right choice for production workloads today."

> **Memory hook:** "InnoDB is the bank vault: transactions, row-level locks, survives a crash. MyISAM is the cardboard box: fast to grab, but one write locks the whole shelf."

### 6.2 DEFAULT CHARSET and COLLATE

You've probably heard the horror story: a user types an emoji into a comment field, and the INSERT either throws an error or silently mangles the character. Why? Because the table was created with `utf8`, and MySQL's `utf8` is **not** full UTF-8 — it tops out at 3 bytes per character, and emoji need 4.

```sql
-- utf8mb4 is the correct choice for modern MySQL
-- utf8 in MySQL is actually utf8mb3 — it cannot store 4-byte characters
-- (emoji, some CJK characters require 4 bytes)

CREATE TABLE messages (
    id      INT  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    body    TEXT NOT NULL
)
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;  -- case-insensitive comparisons
-- or
COLLATE=utf8mb4_bin;         -- case-sensitive, byte-exact comparisons
```

Common collations:

```
utf8mb4_unicode_ci  — case-insensitive, accent-insensitive (most common)
utf8mb4_general_ci  — faster but less accurate Unicode comparisons
utf8mb4_bin         — case-sensitive, byte-by-byte
utf8mb4_0900_ai_ci  — MySQL 8.0+ default, Unicode 9.0, fast
```

> **Memory hook:** "`utf8` is a trick name — it's really `utf8mb3` wearing a name tag that lies about its own limits. Always type `utf8mb4`."

---

## 7. IF NOT EXISTS Guard

Picture a setup script that runs `CREATE TABLE categories (...)` every time your application starts. The first time, it works fine. The second time you restart the app, MySQL stops you cold:

```
ERROR 1050: Table 'categories' already exists
```

Now your "just start the app" script needs a wrapper of manual checks. Annoying, right? `IF NOT EXISTS` is the guard clause that makes the statement safe to re-run.

```sql
CREATE TABLE IF NOT EXISTS categories (
    id    INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name  VARCHAR(100) NOT NULL UNIQUE,
    slug  VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Without IF NOT EXISTS: MySQL raises `ERROR 1050: Table 'categories' already exists`.

With IF NOT EXISTS: MySQL silently skips creation if the table exists.

Here's the part that catches people off guard: **IF NOT EXISTS only checks whether a table with that name exists — it does NOT check whether its structure matches what you wrote.** If you edit the CREATE TABLE statement later (add a column, change a type) and re-run the script, MySQL sees the name `categories` already taken and does... nothing. Your "updated" schema never actually applies. It just skips, silently, every time.

Use cases:
- Idempotent migration scripts (safe to run multiple times)
- Application startup bootstrapping
- Development setup scripts

**Common mistake:** relying on IF NOT EXISTS as a substitute for real schema migrations. It's a guard against a duplicate-name error, not a schema-diffing tool. If you change the column list, you still need `ALTER TABLE` (or a proper migration tool with version tracking) to bring existing tables up to date.

**Interview answer:** "`IF NOT EXISTS` prevents MySQL from raising `ERROR 1050` when the table name already exists — it makes the CREATE TABLE statement idempotent, safe to run repeatedly in bootstrap or setup scripts. It does not compare or reconcile the existing table's structure with the one in the statement; if they differ, the newer definition is silently ignored. For real schema changes to an existing table, you need ALTER TABLE or a migration tool with version tracking, not IF NOT EXISTS."

> **Memory hook:** "IF NOT EXISTS checks the name on the door, not what's behind it."

---

## 8. CREATE TABLE LIKE

Suppose you want to run a risky batch job against your `products` table — bulk update prices, dedupe rows, whatever — and you'd like a scratch table with the *exact same shape* to work in, so you don't touch production data directly. Retyping the whole CREATE TABLE statement by hand is error-prone and tedious. Wouldn't it be nice to just say "give me one of these, but empty"?

That's `CREATE TABLE ... LIKE`. It copies the **structure** of an existing table — column definitions, indexes, AUTO_INCREMENT value, ENGINE, CHARSET — but **no data**.

```sql
-- Source table
CREATE TABLE customers (
    id         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email      VARCHAR(100) NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Copy structure only
CREATE TABLE customers_backup LIKE customers;
-- customers_backup is now empty but has identical structure

-- Verify
SHOW CREATE TABLE customers_backup;
```

What LIKE copies:
- Column names, types, nullability, defaults
- PRIMARY KEY, UNIQUE KEY, INDEX definitions
- AUTO_INCREMENT start value
- ENGINE and CHARSET settings
- Column COMMENTs

What LIKE does NOT copy:
- Row data
- Foreign key constraints (they are not copied)
- Triggers
- Generated column expressions in some versions

Common pattern — working copy for a batch operation:

```sql
CREATE TABLE products_temp LIKE products;
INSERT INTO products_temp SELECT * FROM products WHERE category_id = 5;
-- ... process products_temp ...
DROP TABLE products_temp;
```

**Common mistake:** assuming `LIKE` also carries over foreign key constraints, since it copies "everything else." It doesn't — FKs are deliberately excluded, along with triggers. If your batch job depends on FK enforcement, you'll need to add those constraints back manually with `ALTER TABLE`.

> **Memory hook:** "LIKE photocopies the blueprint — same rooms, same locks on the doors (indexes), but the building is empty (no data) and the fire-escape agreements (foreign keys) don't transfer."

---

## 9. CREATE TABLE AS SELECT

Now a different scenario: you don't want an empty scratch table — you want a *snapshot* of actual data, maybe filtered, maybe joined across a couple of tables, maybe with a new computed column added in. `LIKE` can't help you here; it deliberately carries no data and can't run a query. For that, you need `CREATE TABLE ... AS SELECT` (sometimes shortened to CTAS).

It copies both **structure and data** from a query result. The new table's column names and types are inferred from the SELECT list.

```sql
-- Copy entire table
CREATE TABLE orders_archive AS
SELECT * FROM orders;

-- Copy subset of data
CREATE TABLE high_value_orders AS
SELECT
    o.id,
    o.customer_id,
    o.total_amount,
    o.created_at,
    c.email AS customer_email
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.total_amount > 10000;

-- Copy structure only (impossible row condition)
CREATE TABLE orders_empty AS
SELECT * FROM orders WHERE 1 = 0;
```

Critical differences from LIKE:

```
┌────────────────────────────────┬──────────────────┬────────────────────┐
│ Feature                        │ CREATE TABLE LIKE │ CREATE TABLE AS    │
│                                │                   │ SELECT             │
├────────────────────────────────┼──────────────────┼────────────────────┤
│ Copies column definitions      │ Yes               │ Yes (inferred)     │
│ Copies indexes                 │ Yes               │ No                 │
│ Copies PRIMARY KEY             │ Yes               │ No                 │
│ Copies UNIQUE constraints      │ Yes               │ No                 │
│ Copies FOREIGN KEY constraints │ No                │ No                 │
│ Copies AUTO_INCREMENT          │ Yes               │ No                 │
│ Copies data                    │ No                │ Yes (from SELECT)  │
│ Can filter/transform data      │ No                │ Yes                │
│ Can join multiple tables       │ No                │ Yes                │
└────────────────────────────────┴──────────────────┴────────────────────┘
```

After CREATE TABLE AS SELECT, you must manually add your indexes and primary key:

```sql
CREATE TABLE orders_archive AS SELECT * FROM orders;

ALTER TABLE orders_archive
    ADD PRIMARY KEY (id),
    ADD INDEX idx_archive_customer (customer_id),
    ADD INDEX idx_archive_date (created_at);
```

**Common mistake:** running `CREATE TABLE ... AS SELECT` on a large result set and forgetting the new table has no PRIMARY KEY, no indexes, and no AUTO_INCREMENT — every query against it will be a full table scan until you add them back by hand.

**Interview answer:** "`CREATE TABLE LIKE` copies structure only — columns, indexes, PK, AUTO_INCREMENT, engine, charset — with zero rows. `CREATE TABLE AS SELECT` copies data from a query result, with column types inferred from the SELECT, but it copies no indexes, no PRIMARY KEY, and no AUTO_INCREMENT — those must be added afterward with ALTER TABLE. Use LIKE when you want an identical empty clone; use AS SELECT when you want a filtered, transformed, or joined snapshot of real data."

> **Memory hook:** "LIKE clones the blueprint with nobody inside. AS SELECT moves real tenants in — but forgets to install the locks (indexes) on the way."

---

## 10. CREATE TEMPORARY TABLE

Sometimes a calculation is genuinely multi-step — you need to compute monthly totals, then compute averages from those totals, then join that back against another table. Doing this all in one giant nested query is a nightmare to read and debug. What you'd really like is a scratch table to hold your intermediate results — one that automatically cleans up after itself and never leaks into anyone else's session.

That's exactly what `CREATE TEMPORARY TABLE` gives you. A temporary table exists only for the **duration of the session** (connection). It is automatically dropped when the connection closes. Other connections cannot see it.

```sql
-- Create a temp table
CREATE TEMPORARY TABLE temp_monthly_totals (
    month        DATE          NOT NULL,
    total_sales  DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    order_count  INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Use it like any other table
INSERT INTO temp_monthly_totals (month, total_sales, order_count)
SELECT
    DATE_FORMAT(created_at, '%Y-%m-01') AS month,
    SUM(total_amount)                    AS total_sales,
    COUNT(*)                             AS order_count
FROM orders
WHERE created_at >= '2024-01-01'
GROUP BY DATE_FORMAT(created_at, '%Y-%m-01');

-- Query it
SELECT * FROM temp_monthly_totals ORDER BY month;

-- It disappears when the connection closes
-- Or drop it manually:
DROP TEMPORARY TABLE IF EXISTS temp_monthly_totals;
```

Temporary table rules:

```
┌─────────────────────────────────────────────────────────────┐
│                   TEMPORARY TABLE Rules                     │
├─────────────────────────────────────────────────────────────┤
│ Visibility     │ Only the creating session can see it       │
│ Lifetime       │ Until session ends or explicit DROP        │
│ Name shadowing │ Can share a name with a permanent table    │
│                │ (the temp table takes precedence)          │
│ Replication    │ Not replicated by default (depends on      │
│                │ binlog_format)                             │
│ Transactions   │ Subject to InnoDB transaction rules        │
│ Storage        │ In tmpdir (configurable), may spill to     │
│                │ disk if large                              │
└────────────────┴────────────────────────────────────────────┘
```

When to use TEMPORARY TABLE:
- Complex multi-step calculations within a stored procedure
- Staging data before a batch operation
- Breaking up a very complex query into readable steps
- When you need to query a subquery result multiple times

**Common mistake:** naming a temporary table the same as a permanent one and forgetting that MySQL will silently prefer the temporary table for the rest of the session — every statement that references that name hits the temp table, not the real one, until it's dropped or the session ends. That's easy to forget mid-debugging and very confusing to untangle.

**Interview answer:** "A TEMPORARY TABLE is scoped to a single database session — it's created, used, and automatically dropped when the connection closes, and it's invisible to every other connection, even one querying the same table name. It's useful for staging intermediate results in multi-step calculations, especially inside stored procedures, or when a subquery's result needs to be referenced more than once. Unlike a regular table, it can even share a name with a permanent table, in which case it silently shadows the permanent one for that session."

> **Memory hook:** "A TEMPORARY TABLE is a hotel room, not a house — it's yours for the length of your stay, invisible to other guests, and it's cleared out the moment you check out."

---

## 11. Real-World Schema Example

Reading each clause in isolation only gets you so far — the real test is seeing them all click together in a schema you'd actually ship. Here's a blog platform, built table by table, in dependency order (lookup tables first, then the tables that reference them):

```sql
-- 1. Lookup table (no FK dependencies)
CREATE TABLE IF NOT EXISTS post_statuses (
    id    TINYINT     NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name  VARCHAR(20) NOT NULL UNIQUE
        COMMENT 'draft | published | archived'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO post_statuses (name) VALUES ('draft'), ('published'), ('archived');

-- 2. Users table
CREATE TABLE IF NOT EXISTS users (
    id           INT          NOT NULL AUTO_INCREMENT,
    username     VARCHAR(50)  NOT NULL,
    email        VARCHAR(150) NOT NULL,
    password_hash CHAR(60)    NOT NULL  COMMENT 'bcrypt hash',
    display_name  VARCHAR(100) NULL,
    bio           TEXT         NULL,
    avatar_url    VARCHAR(500) NULL,
    is_admin      TINYINT(1)   NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email    (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Posts table (depends on users, post_statuses)
CREATE TABLE IF NOT EXISTS posts (
    id          INT           NOT NULL AUTO_INCREMENT,
    author_id   INT           NOT NULL,
    status_id   TINYINT       NOT NULL DEFAULT 1,
    title       VARCHAR(300)  NOT NULL,
    slug        VARCHAR(300)  NOT NULL,
    excerpt     VARCHAR(500)  NULL,
    body        LONGTEXT      NOT NULL,
    view_count  INT UNSIGNED  NOT NULL DEFAULT 0,
    published_at TIMESTAMP    NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_posts_slug   (slug),
    INDEX      idx_posts_author (author_id),
    INDEX      idx_posts_status (status_id),
    INDEX      idx_posts_published (published_at),

    CONSTRAINT fk_posts_author
        FOREIGN KEY (author_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_posts_status
        FOREIGN KEY (status_id)
        REFERENCES post_statuses(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tags (many-to-many pivot)
CREATE TABLE IF NOT EXISTS tags (
    id    SMALLINT    NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name  VARCHAR(50) NOT NULL UNIQUE,
    slug  VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_tags (
    post_id  INT      NOT NULL,
    tag_id   SMALLINT NOT NULL,

    PRIMARY KEY (post_id, tag_id),
    INDEX idx_post_tags_tag (tag_id),

    CONSTRAINT fk_pt_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_pt_tag  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Comments (self-referencing for threaded replies)
CREATE TABLE IF NOT EXISTS comments (
    id         INT      NOT NULL AUTO_INCREMENT,
    post_id    INT      NOT NULL,
    author_id  INT      NOT NULL,
    parent_id  INT      NULL  COMMENT 'NULL = top-level comment',
    body       TEXT     NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_comments_post   (post_id),
    INDEX idx_comments_author (author_id),
    INDEX idx_comments_parent (parent_id),

    CONSTRAINT fk_comments_post
        FOREIGN KEY (post_id)   REFERENCES posts(id)    ON DELETE CASCADE,
    CONSTRAINT fk_comments_user
        FOREIGN KEY (author_id) REFERENCES users(id)    ON DELETE RESTRICT,
    CONSTRAINT fk_comments_parent
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 12. Under the Hood

You've written the SQL. But what does MySQL actually *do* when it reads `CREATE TABLE employees (...) ENGINE=InnoDB`? Understanding the steps underneath explains why certain design choices — like your primary key — matter so much for performance later.

### What happens when you run CREATE TABLE

```
┌──────────────────────────────────────────────────────────────┐
│  CREATE TABLE employees (...)  ENGINE=InnoDB                 │
│                                                              │
│  1. Parser validates syntax                                  │
│  2. Optimizer resolves data types, defaults                  │
│  3. Writes to data dictionary (mysql.tables, mysql.columns)  │
│  4. InnoDB allocates a .ibd tablespace file                  │
│     (one file per table when innodb_file_per_table=ON)       │
│  5. Creates the B-tree for the clustered index (PK)          │
│  6. Creates secondary B-trees for each additional index      │
│  7. Statement is auto-committed (no ROLLBACK possible)       │
└──────────────────────────────────────────────────────────────┘
```

### InnoDB clustered index

Here's a fact that surprises a lot of people moving from other databases: in InnoDB, the primary key isn't just a uniqueness rule — it's the actual physical order the row data is stored in on disk. InnoDB physically stores row data **sorted by the primary key**. This is called the clustered index. Every row lives at a leaf node of the PK B-tree.

```
PK B-tree (clustered)
         [50]
        /    \
    [25]      [75]
   /    \    /    \
[10][20][30][60][80][90]
 ↑
Each leaf node contains the full row data
```

Secondary indexes (non-PK indexes) store the indexed column value + the primary key value. A secondary index lookup needs two B-tree traversals: first the secondary index to find the PK, then the clustered index to get the full row.

This is why:
- Choosing a good PRIMARY KEY matters for InnoDB performance
- INT AUTO_INCREMENT is often the best PK for most tables
- Large PKs bloat every secondary index

> **Memory hook:** "The primary key IS the bookshelf order — every secondary index is just a sticky note that says 'go check shelf position X.'"

---

## 13. Hands-On Exercises

### Exercise 1 — E-commerce Products Table

Create a `products` table for an e-commerce store with these requirements:
- Auto-incrementing integer PK
- SKU: required, unique, max 50 chars
- Name: required, max 200 chars
- Description: optional long text
- Price: required, cannot be negative, 2 decimal places, max 10 digits total
- Stock quantity: required, default 0, cannot go negative (use CHECK)
- Weight in kg: optional, 3 decimal places
- Category FK to a `categories(id)` table
- Created and updated timestamps (auto-managed)
- Use appropriate ENGINE and charset

<details>
<summary>Solution</summary>

```sql
CREATE TABLE products (
    id           INT            NOT NULL AUTO_INCREMENT,
    sku          VARCHAR(50)    NOT NULL,
    name         VARCHAR(200)   NOT NULL,
    description  TEXT           NULL,
    price        DECIMAL(10,2)  NOT NULL,
    stock        INT            NOT NULL DEFAULT 0,
    weight_kg    DECIMAL(8,3)   NULL,
    category_id  INT            NOT NULL,
    created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_products_sku (sku),
    INDEX idx_products_category (category_id),

    CONSTRAINT chk_price  CHECK (price >= 0),
    CONSTRAINT chk_stock  CHECK (stock >= 0),
    CONSTRAINT chk_weight CHECK (weight_kg IS NULL OR weight_kg > 0),

    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
</details>

---

### Exercise 2 — TEMPORARY Table for Report

Write a stored session script that:
1. Creates a temporary table `temp_customer_stats` with columns: customer_id, order_count, total_spent, avg_order_value, first_order_date, last_order_date
2. Populates it from an `orders` table
3. Selects the top 10 customers by total_spent

<details>
<summary>Solution</summary>

```sql
CREATE TEMPORARY TABLE temp_customer_stats (
    customer_id      INT            NOT NULL PRIMARY KEY,
    order_count      INT            NOT NULL DEFAULT 0,
    total_spent      DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
    avg_order_value  DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    first_order_date DATE           NULL,
    last_order_date  DATE           NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO temp_customer_stats
SELECT
    customer_id,
    COUNT(*)                AS order_count,
    SUM(total_amount)       AS total_spent,
    AVG(total_amount)       AS avg_order_value,
    MIN(DATE(created_at))   AS first_order_date,
    MAX(DATE(created_at))   AS last_order_date
FROM orders
GROUP BY customer_id;

SELECT * FROM temp_customer_stats
ORDER BY total_spent DESC
LIMIT 10;
```
</details>

---

### Exercise 3 — CREATE TABLE LIKE + AS SELECT

You have a `transactions` table. Write SQL to:
1. Create `transactions_backup` as a structural copy (LIKE), then populate it with all rows from last year
2. Create `transactions_high_risk` using AS SELECT, containing only transactions where `amount > 50000`, with added columns: `flagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

<details>
<summary>Solution</summary>

```sql
-- Part 1: LIKE + INSERT
CREATE TABLE transactions_backup LIKE transactions;

INSERT INTO transactions_backup
SELECT * FROM transactions
WHERE YEAR(created_at) = YEAR(CURRENT_DATE) - 1;

-- Part 2: AS SELECT
CREATE TABLE transactions_high_risk AS
SELECT
    *,
    NOW() AS flagged_at
FROM transactions
WHERE amount > 50000;

-- Must add PK manually after AS SELECT
ALTER TABLE transactions_high_risk
    ADD PRIMARY KEY (id);
```
</details>

---

### Exercise 4 — Composite Primary Key

Design a `student_courses` enrollment table for a university:
- Students can enroll in many courses; each course has many students
- Track enrollment date, grade (optional), and whether currently active
- The combination of student + course must be unique
- Both student_id and course_id must reference their parent tables

<details>
<summary>Solution</summary>

```sql
CREATE TABLE student_courses (
    student_id      INT       NOT NULL,
    course_id       INT       NOT NULL,
    enrolled_date   DATE      NOT NULL DEFAULT (CURRENT_DATE),
    grade           CHAR(2)   NULL  COMMENT 'A+, A, B+, B, etc.',
    is_active       TINYINT(1) NOT NULL DEFAULT 1,

    PRIMARY KEY (student_id, course_id),

    INDEX idx_sc_course (course_id),

    CONSTRAINT fk_sc_student
        FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_sc_course
        FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
</details>

---

### Exercise 5 — Schema with IF NOT EXISTS

Write an idempotent setup script (safe to run multiple times) that creates these tables in the correct order:
- `regions` (id, name)
- `stores` (id, region_id FK, name, address)
- `employees` (id, store_id FK, name, role, hire_date)

<details>
<summary>Solution</summary>

```sql
CREATE TABLE IF NOT EXISTS regions (
    id    SMALLINT    NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name  VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stores (
    id         INT          NOT NULL AUTO_INCREMENT,
    region_id  SMALLINT     NOT NULL,
    name       VARCHAR(100) NOT NULL,
    address    VARCHAR(300) NULL,

    PRIMARY KEY (id),
    INDEX idx_stores_region (region_id),

    CONSTRAINT fk_stores_region
        FOREIGN KEY (region_id)
        REFERENCES regions(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employees (
    id        INT          NOT NULL AUTO_INCREMENT,
    store_id  INT          NOT NULL,
    name      VARCHAR(100) NOT NULL,
    role      VARCHAR(50)  NOT NULL DEFAULT 'associate',
    hire_date DATE         NOT NULL DEFAULT (CURRENT_DATE),

    PRIMARY KEY (id),
    INDEX idx_employees_store (store_id),

    CONSTRAINT fk_employees_store
        FOREIGN KEY (store_id)
        REFERENCES stores(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
</details>

---

## 14. Interview Q&A

**Q1: What is the difference between CREATE TABLE LIKE and CREATE TABLE AS SELECT?**

A: LIKE copies the full structure — column definitions, indexes (including PK, UNIQUE, regular indexes), ENGINE, CHARSET, AUTO_INCREMENT — but no data. AS SELECT copies column names and inferred types from the query result set, includes data from the SELECT, but copies no indexes or constraints. After AS SELECT you must manually add PRIMARY KEY and indexes.

---

**Q2: Why does MySQL recommend ENGINE=InnoDB over MyISAM?**

A: InnoDB supports ACID transactions, row-level locking, foreign key constraints, and crash recovery via redo logs. MyISAM only does table-level locking, has no FK support, no transactions, and requires manual repair after crashes. For almost all production workloads, InnoDB is correct.

---

**Q3: What happens to AUTO_INCREMENT values when rows are deleted?**

A: The counter never decreases. If rows with IDs 1, 2, 3 exist and you delete ID 3, the next insert gets ID 4, not ID 3. Gaps are permanent. This is by design — reusing IDs could cause confusion with foreign key references or audit logs. In MySQL 8.0+, the AUTO_INCREMENT counter is also persisted to the redo log, so it survives server restarts (previously it would reset to MAX(id)+1 on restart).

---

**Q4: What does the IF NOT EXISTS clause actually guarantee?**

A: It guarantees the statement will not raise an error if the table already exists. It does NOT verify that the existing table's structure matches what you wrote. If you changed a column type in a migration script and re-run it, IF NOT EXISTS will silently skip your change. Use it for idempotent bootstrapping, not for schema migrations — migrations need explicit version tracking.

---

**Q5: When should you use a TEMPORARY TABLE vs a subquery or CTE?**

A: Temporary tables are useful when: (1) you need to reference the intermediate result set multiple times, (2) the result set is large enough that re-computing it is expensive, (3) you need to add indexes to the intermediate result to speed up subsequent joins. CTEs and subqueries are re-evaluated for each reference (though the optimizer may cache them). TEMPORARY TABLEs persist for the session and can have their own indexes.

---

**Q6: What is a clustered index and how does it relate to InnoDB PRIMARY KEYs?**

A: A clustered index stores the actual row data at the leaf nodes of the B-tree, sorted by the index key. InnoDB always uses the PRIMARY KEY as its clustered index. If no PK is defined, InnoDB uses the first UNIQUE NOT NULL index; if none exists, it creates a hidden 6-byte rowid. Every secondary index in InnoDB stores the primary key value as the row pointer, so secondary lookups require two B-tree traversals.

---

**Q7: What is utf8mb4 and why not just utf8?**

A: MySQL's `utf8` character set is actually `utf8mb3`, which stores only up to 3 bytes per character. True UTF-8 is up to 4 bytes. 4-byte characters include emoji (U+1F600 and above) and many supplementary CJK characters. `utf8mb4` is the correct, full UTF-8 implementation. Always use `utf8mb4` for new tables.

---

**Q8: Can you have a DEFAULT value that references another column?**

A: No. DEFAULT values must be literals or (MySQL 8.0+) self-contained expressions enclosed in parentheses. They cannot reference other columns in the same table. For computed defaults that depend on other columns, use a BEFORE INSERT trigger or handle the logic in application code.

---

**Q9: What does COLLATE determine and when does it matter?**

A: COLLATION determines how string comparison and sorting work. `utf8mb4_unicode_ci` is case-insensitive and accent-insensitive. `utf8mb4_bin` is byte-for-byte comparison (case-sensitive). It matters for: WHERE clauses comparing strings, ORDER BY on string columns, UNIQUE constraint enforcement (with _ci, 'Apple' and 'apple' are the same), and index usage. Mismatched collations between joined columns can prevent index use.

---

**Q10: What is the ORDER in which tables should be created when there are foreign key dependencies?**

A: Referenced tables must be created before tables that reference them. If `orders` has a FK to `customers`, create `customers` first. If circular dependencies exist (rare, usually a design smell), create the tables without FKs first, then add FKs with ALTER TABLE after both tables exist.

---

**Q11: What is the difference between NULL and an empty string in MySQL?**

A: NULL means "value unknown or not applicable" — it is the absence of a value. An empty string `''` is a value: a string with zero characters. NULL comparisons use IS NULL / IS NOT NULL, not = or !=. Aggregate functions like COUNT(*) count NULL rows, but COUNT(col) does not count NULL values in that column.

---

**Q12: Why would you use COMMENT on a column?**

A: Column comments document non-obvious semantics that can't be expressed in the column name or type alone — e.g., the unit of measurement, the source system's field name, business rules, or deprecation notices. They're stored in information_schema.COLUMNS and visible in SHOW CREATE TABLE, making them part of the schema definition itself rather than external documentation that can drift.

---

**Q13: What is the practical difference between a TEMPORARY table and a regular table?**

A: A TEMPORARY table is session-scoped (invisible to other connections, auto-dropped on disconnect), cannot be referenced in the same query that creates it, and is not replicated by default. Regular tables are persistent, visible to all connections, and replicated. Temporary tables are also exempt from general table locking during DDL on the same-named permanent table.

---

**Q14: If two CREATE TABLE statements are run and the second fails (syntax error, FK reference missing), is the first one rolled back?**

A: No. DDL statements in MySQL are auto-committed and cannot be rolled back. The first CREATE TABLE succeeded and persists even if subsequent statements in the script fail. This is why schema migration tools track applied migrations — you need to know exactly which statements ran to safely retry or roll forward.

---

**Q15: What is the maximum number of columns in a MySQL InnoDB table?**

A: InnoDB allows up to 1,017 columns per table. MySQL itself has a maximum of 4,096 columns per table (enforced at the SQL layer), but InnoDB's internal row format limit of 1,017 is the practical constraint. Additionally, the total row size cannot exceed 65,535 bytes for fixed-width columns (though TEXT/BLOB columns are stored off-page and don't count toward this limit).
