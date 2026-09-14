# 02 — SELECT: Reading and Shaping Data

## Table of Contents

1. [SELECT cols vs SELECT *](#1-select-cols-vs-select-)
2. [Column Aliases (AS)](#2-column-aliases-as)
3. [DISTINCT — Deduplication](#3-distinct--deduplication)
4. [Computed Columns](#4-computed-columns)
5. [String Functions](#5-string-functions)
6. [Numeric Functions](#6-numeric-functions)
7. [Date & Time Functions](#7-date--time-functions)
8. [CASE WHEN — Conditional Labels](#8-case-when--conditional-labels)
9. [ORDER BY — Sorting Results](#9-order-by--sorting-results)
10. [LIMIT and OFFSET — Pagination](#10-limit-and-offset--pagination)
11. [Putting It Together — Full Query Shape](#11-putting-it-together--full-query-shape)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. SELECT cols vs SELECT *

### The problem

You're three weeks into a project, you need a customer's name and email, and typing out every column feels like a chore. So you write the lazy version:

```sql
SELECT * FROM customers;
```

It works. It returns data. What's the harm?

### The analogy

Think of it like asking a courier to "bring me everything in the warehouse" when you only needed one box. Sure, you'll get your box — buried under a truckload of stuff you never asked for, paid for, and now have to sort through.

### Why SELECT * hurts

```
┌──────────────────────────────────────────────────────────────────┐
│  Problem 1 — Over-the-wire cost                                  │
│  SELECT * sends every column, including BLOBs, long TEXT fields  │
│  and columns the application never reads.                        │
├──────────────────────────────────────────────────────────────────┤
│  Problem 2 — Covering index bypass                               │
│  A covering index can answer a query entirely from the index     │
│  B-tree. SELECT * forces a heap fetch for every row, breaking    │
│  this optimisation even when an index exists.                    │
├──────────────────────────────────────────────────────────────────┤
│  Problem 3 — Schema brittleness                                  │
│  If someone adds a column to the table, SELECT * silently        │
│  starts returning it. Code that maps columns by position breaks. │
├──────────────────────────────────────────────────────────────────┤
│  Problem 4 — Readability                                         │
│  A reader of the query cannot tell which columns the code        │
│  actually uses without also reading the application code.        │
└──────────────────────────────────────────────────────────────────┘
```

### Exceptions where SELECT * is acceptable

- Ad-hoc exploration in a MySQL client (not production code)
- `SELECT COUNT(*)` — the `*` here means "any row", not "all columns"
- Subqueries used only for existence checks: `SELECT 1 FROM t WHERE ...`

### Preferred form

```sql
SELECT
    id,
    first_name,
    last_name,
    email,
    created_at
FROM customers
WHERE active = 1;
```

Name only what you need. Your future self and the query optimiser both thank you.

> **Memory hook:** SELECT * is like ordering "one of everything on the menu" when you only wanted a coffee.

---

## 2. Column Aliases (AS)

### The problem

`quantity * unit_price` is a perfectly valid column in your result set — but try explaining that name to a report, a JSON API response, or a teammate reading the output. Raw expressions make terrible column headers.

### Syntax

```sql
SELECT
    first_name AS given_name,
    last_name  AS family_name,
    email      AS contact_email
FROM customers;
```

The `AS` keyword is optional — `first_name given_name` works — but always write
it. Omitting `AS` produces valid SQL that looks like a typo.

### Aliases for computed columns

```sql
SELECT
    quantity * unit_price          AS line_total,
    quantity * unit_price * 0.10   AS tax_amount,
    quantity * unit_price * 1.10   AS total_with_tax
FROM order_items;
```

### Common mistake — assuming aliases work everywhere

This trips up almost everyone at some point: you define an alias in SELECT, then try to use it in WHERE, and MySQL throws "Unknown column." Why? Because WHERE is evaluated *before* SELECT ever computes the alias (more on this execution order in Section 11). The alias simply doesn't exist yet when WHERE runs.

### Alias scoping rules

```
┌──────────────────────────────────────────────────────────────────┐
│  Clause          │  Can reference SELECT alias?                  │
├──────────────────┼───────────────────────────────────────────────┤
│  WHERE           │  NO — evaluated before SELECT                 │
│  GROUP BY        │  YES in MySQL (non-standard extension)        │
│  HAVING          │  YES in MySQL (non-standard extension)        │
│  ORDER BY        │  YES — standard SQL                           │
└──────────────────┴───────────────────────────────────────────────┘
```

```sql
-- This is valid in MySQL
SELECT price * 0.9 AS discounted
FROM products
ORDER BY discounted;     -- alias in ORDER BY: allowed

-- This is NOT valid
SELECT price * 0.9 AS discounted
FROM products
WHERE discounted < 50;   -- alias in WHERE: not allowed
                         -- use: WHERE price * 0.9 < 50
```

### Table aliases in multi-table queries

```sql
SELECT
    c.first_name,
    c.last_name,
    o.created_at AS order_date,
    o.total
FROM customers c           -- c is a table alias
JOIN orders o ON o.customer_id = c.id;
```

> **Memory hook:** An alias is a nickname you hand out at SELECT time — WHERE meets you before you've introduced yourself.

---

## 3. DISTINCT — Deduplication

### The problem

Your `customers` table has 50,000 rows. You want to know which countries you have customers in. Query `SELECT country FROM customers` and you get 50,000 rows back — 'Australia' repeated 12,000 times, 'India' repeated 8,000 times, and so on. You just want the unique list.

### The analogy

It's like asking everyone at a stadium to shout their home city, then writing down only the cities you haven't heard yet — ignoring the repeats.

### Syntax

```sql
SELECT DISTINCT country FROM customers;
```

Returns each unique value of `country` once, regardless of how many rows share it.

### Multi-column DISTINCT

```sql
SELECT DISTINCT city, country FROM customers;
-- Returns unique (city, country) pairs
-- 'Sydney, Australia' and 'Melbourne, Australia' are two distinct rows
```

### The cost of DISTINCT

```
Without DISTINCT:
  ┌─────────────┐
  │ Storage read│ → stream rows to client
  └─────────────┘
  Cost: sequential read only

With DISTINCT:
  ┌─────────────┐    ┌──────────────────┐    ┌───────────┐
  │ Storage read│ → │Sort or Hash dedupe│ → │ Send rows │
  └─────────────┘    └──────────────────┘    └───────────┘
  Cost: read + either sort (O n log n) or hash (O n memory)
```

DISTINCT triggers a deduplication step — either a sort pass or a hash aggregate.
On large result sets this can be expensive. Check EXPLAIN for `Using temporary`
and `Using filesort`.

### DISTINCT vs GROUP BY

```sql
-- These produce identical results in MySQL:
SELECT DISTINCT country FROM customers;
SELECT country FROM customers GROUP BY country;

-- GROUP BY is preferred when you also need aggregates:
SELECT country, COUNT(*) FROM customers GROUP BY country;
```

**Interview answer:** DISTINCT and GROUP BY (with no aggregate function) produce the same deduplicated result in MySQL, and often the same execution plan. Reach for DISTINCT when you just want unique values; reach for GROUP BY the moment you also need COUNT, SUM, or another aggregate alongside the grouping — it reads more clearly and signals intent.

> **Memory hook:** DISTINCT is GROUP BY without anything to count — same dedupe machinery, different job title.

---

## 4. Computed Columns

### The problem

Your `order_items` table stores `unit_price` and `quantity`, but never a `subtotal` column — because storing a value you can calculate is a recipe for it going stale the moment either input changes. So you calculate it on the fly, right in the SELECT.

### Arithmetic

```sql
SELECT
    product_name,
    unit_price,
    quantity,
    unit_price * quantity                       AS subtotal,
    unit_price * quantity * 0.10                AS gst,
    ROUND(unit_price * quantity * 1.10, 2)      AS total_inc_gst
FROM order_items;
```

### String concatenation (computed)

```sql
SELECT
    CONCAT(first_name, ' ', last_name)          AS full_name,
    CONCAT(city, ', ', country)                 AS location
FROM customers;
```

### Boolean flag as integer

```sql
SELECT
    email,
    (last_login > DATE_SUB(NOW(), INTERVAL 30 DAY)) AS active_last_30_days
FROM users;
-- Returns 1 for true, 0 for false
```

> **Memory hook:** A computed column is a sticky note attached to the row, not a fact stored in it — it's recalculated fresh every time you look.

---

## 5. String Functions

### The problem

Real data is messy. Phone numbers come in with dashes, spaces, and parentheses; names are stored in whatever case the user typed them in; you need to pull a domain out of an email address. You could clean all of this up in your application code after fetching the rows — or you could ask MySQL to hand you the cleaned-up version directly.

### Reference table

| Function                          | What it does                                  | Example output        |
|-----------------------------------|-----------------------------------------------|-----------------------|
| `CONCAT(s1, s2, ...)`             | Joins strings                                 | 'John Doe'            |
| `UPPER(s)`                        | All uppercase                                 | 'JOHN'                |
| `LOWER(s)`                        | All lowercase                                 | 'john'                |
| `SUBSTRING(s, pos, len)`          | Substring from pos (1-based), length len      | 'ohn'                 |
| `LENGTH(s)`                       | Byte count                                    | 4                     |
| `CHAR_LENGTH(s)`                  | Character count (multi-byte safe)             | 4                     |
| `REPLACE(s, from, to)`            | Replace all occurrences of from with to       | 'J0hn'                |
| `TRIM(s)`                         | Strip leading and trailing spaces             | 'John'                |
| `LTRIM(s)` / `RTRIM(s)`           | Strip left / right spaces only                | 'John '               |
| `LPAD(s, len, pad)`               | Left-pad to total length                      | '  42' (LPAD(42,4,' '))|
| `RPAD(s, len, pad)`               | Right-pad to total length                     | '42  '                |
| `INSTR(s, substr)`                | Position of first occurrence (0 = not found) | 3                     |
| `LEFT(s, n)` / `RIGHT(s, n)`      | First / last n characters                     | 'Jo' / 'hn'           |
| `REVERSE(s)`                      | Reverse the string                            | 'nhoJ'                |

### Practical examples

```sql
-- Standardise phone numbers stored with varying formats
SELECT
    REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', '')  AS clean_phone
FROM customers;

-- Email domain extraction
SELECT
    email,
    SUBSTRING(email, INSTR(email, '@') + 1)     AS domain
FROM users;

-- Truncate long product names for a label
SELECT
    CASE
        WHEN CHAR_LENGTH(name) > 30
        THEN CONCAT(LEFT(name, 27), '...')
        ELSE name
    END AS display_name
FROM products;

-- Zero-pad order IDs for a reference number
SELECT LPAD(id, 8, '0') AS reference_number FROM orders;
-- 42 → '00000042'
```

**Common mistake:** using `LENGTH()` when you mean `CHAR_LENGTH()` (covered more in the Interview Q&A below) — with multi-byte characters like emoji or accented letters, byte count and character count silently diverge.

> **Memory hook:** String functions are the database's find-and-replace toolkit — clean the data in the query, not in a loop in your app code.

---

## 6. Numeric Functions

### The problem

You need financial rounding to exactly 2 decimal places, or you need to bucket prices into round numbers for a filter UI ("$0-10", "$10-20"...). Doing this arithmetic in the application means fetching raw numbers and post-processing every row — MySQL can just do the math before it ever leaves the server.

### Reference table

| Function          | What it does                            | Example             |
|-------------------|-----------------------------------------|---------------------|
| `ROUND(n, d)`     | Round to d decimal places               | ROUND(3.456,2)=3.46 |
| `FLOOR(n)`        | Round down to integer                   | FLOOR(3.9)=3        |
| `CEIL(n)`         | Round up to integer                     | CEIL(3.1)=4         |
| `ABS(n)`          | Absolute value                          | ABS(-5)=5           |
| `MOD(n, d)`       | Remainder (n % d)                       | MOD(10,3)=1         |
| `POWER(base, exp)`| Exponentiation                          | POWER(2,10)=1024    |
| `SQRT(n)`         | Square root                             | SQRT(9)=3           |
| `TRUNCATE(n, d)`  | Truncate (not round) to d decimals      | TRUNCATE(3.99,1)=3.9|
| `SIGN(n)`         | -1, 0, or 1                             | SIGN(-5)=-1         |
| `GREATEST(a,b,c)` | Maximum of listed values                | GREATEST(3,7,2)=7   |
| `LEAST(a,b,c)`    | Minimum of listed values                | LEAST(3,7,2)=2      |

### Examples

```sql
-- Financial rounding: always 2 decimal places
SELECT
    product_name,
    ROUND(price * 1.10, 2)      AS price_inc_gst,
    ROUND(price * 0.85, 2)      AS member_price
FROM products;

-- Determine if order id is even or odd (batch scheduling)
SELECT id, MOD(id, 2) AS is_odd FROM orders;

-- Compound interest calculation
SELECT
    principal,
    ROUND(principal * POWER(1 + rate/100, years), 2) AS future_value
FROM investments;

-- Bin prices into buckets
SELECT
    name,
    price,
    FLOOR(price / 10) * 10     AS price_bucket   -- 0,10,20,30...
FROM products;
```

> **Memory hook:** ROUND for how it looks on a receipt, TRUNCATE for when you never round in the customer's favor.

---

## 7. Date & Time Functions

### The problem

"Show me orders from the last 30 days." "What's this customer's age?" "Format this timestamp for a PDF invoice." Every one of these needs date arithmetic, and doing it by fetching raw timestamps and calculating in application code is slower and more error-prone than letting MySQL — which stores and indexes dates natively — do it for you.

### The essentials

| Function                          | Returns                                      |
|-----------------------------------|----------------------------------------------|
| `NOW()`                           | Current datetime: '2026-06-24 14:32:00'      |
| `CURDATE()`                       | Current date only: '2026-06-24'              |
| `CURTIME()`                       | Current time only: '14:32:00'                |
| `DATE(datetime)`                  | Strip time part: '2026-06-24'                |
| `TIME(datetime)`                  | Strip date part: '14:32:00'                  |
| `YEAR(d)` / `MONTH(d)` / `DAY(d)` | Extract parts                               |
| `HOUR(t)` / `MINUTE(t)` / `SECOND(t)` | Extract time parts                     |
| `DAYOFWEEK(d)`                    | 1=Sunday … 7=Saturday                        |
| `DAYNAME(d)`                      | 'Monday', 'Tuesday', …                       |
| `DATEDIFF(d1, d2)`                | d1 - d2 in days (signed)                     |
| `TIMESTAMPDIFF(unit, d1, d2)`     | Difference in the given unit                 |
| `DATE_ADD(d, INTERVAL n unit)`    | Add n units to a date                        |
| `DATE_SUB(d, INTERVAL n unit)`    | Subtract n units from a date                 |
| `DATE_FORMAT(d, fmt)`             | Format a date as string                      |
| `STR_TO_DATE(s, fmt)`             | Parse a string into a date                   |
| `UNIX_TIMESTAMP(d)`               | Seconds since 1970-01-01 00:00:00 UTC        |
| `FROM_UNIXTIME(ts)`               | Convert Unix timestamp to DATETIME           |

### DATE_FORMAT format codes

| Code | Meaning     | Example  |
|------|-------------|----------|
| %Y   | 4-digit year| 2026     |
| %y   | 2-digit year| 26       |
| %m   | Month 01-12 | 06       |
| %d   | Day 01-31   | 24       |
| %H   | Hour 00-23  | 14       |
| %i   | Minute 00-59| 32       |
| %s   | Second 00-59| 00       |
| %W   | Weekday name| Tuesday  |
| %M   | Month name  | June     |

### Practical examples

```sql
-- Monthly revenue report
SELECT
    DATE_FORMAT(created_at, '%Y-%m')    AS month,
    COUNT(*)                             AS orders,
    ROUND(SUM(total), 2)                AS revenue
FROM orders
GROUP BY DATE_FORMAT(created_at, '%Y-%m')
ORDER BY month;

-- Customer age from date of birth
SELECT
    name,
    dob,
    TIMESTAMPDIFF(YEAR, dob, CURDATE())  AS age_years
FROM customers;

-- Orders placed in the last 30 days
SELECT * FROM orders
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Subscriptions expiring in the next 7 days
SELECT
    user_id,
    plan_name,
    expires_at,
    DATEDIFF(expires_at, CURDATE())     AS days_remaining
FROM subscriptions
WHERE expires_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY);

-- Format an invoice date for a PDF label
SELECT DATE_FORMAT(created_at, '%d %M %Y') AS formatted_date FROM invoices;
-- → '24 June 2026'
```

> **Memory hook:** NOW() and CURDATE() are the same clock — one tells you the time too, the other just the date on the calendar page.

---

## 8. CASE WHEN — Conditional Labels

### The problem

Your `products` table stores a `status_code` of 1, 2, or 3 — meaningless numbers to anyone reading a report. You want the report to say "Active" or "Out of Stock" instead. You could translate the codes in application code after fetching every row — or you could ask the database to do the translation as part of the SELECT itself.

### The analogy

CASE WHEN is SQL's if-else statement, just spelled differently. "If the code is 1, call it Active; if it's 2, call it Discontinued; otherwise, Unknown."

CASE WHEN brings if-else logic directly into a SELECT, letting you map raw
values to human-readable labels without touching the application layer.

### Searched CASE (condition-based)

```sql
SELECT
    order_id,
    total,
    CASE
        WHEN total < 50    THEN 'Small'
        WHEN total < 200   THEN 'Medium'
        WHEN total < 1000  THEN 'Large'
        ELSE                    'Enterprise'
    END AS order_tier
FROM orders;
```

### Simple CASE (equality-based)

```sql
SELECT
    product_id,
    status_code,
    CASE status_code
        WHEN 1 THEN 'Active'
        WHEN 2 THEN 'Discontinued'
        WHEN 3 THEN 'Out of Stock'
        ELSE        'Unknown'
    END AS status_label
FROM products;
```

### CASE in aggregate — pivot

```sql
-- Count orders by status in a single row (horizontal pivot)
SELECT
    COUNT(CASE WHEN status = 'pending'   THEN 1 END) AS pending_count,
    COUNT(CASE WHEN status = 'shipped'   THEN 1 END) AS shipped_count,
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) AS delivered_count,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled_count
FROM orders;
```

### CASE in ORDER BY — custom sort

```sql
-- Sort by custom priority: active first, then suspended, then deleted
SELECT name, status
FROM users
ORDER BY
    CASE status
        WHEN 'active'    THEN 1
        WHEN 'suspended' THEN 2
        WHEN 'deleted'   THEN 3
        ELSE 99
    END;
```

### Nested CASE

```sql
SELECT
    id,
    CASE
        WHEN country = 'AU' THEN
            CASE
                WHEN state = 'NSW' THEN 'Sydney Metro'
                WHEN state = 'VIC' THEN 'Melbourne Metro'
                ELSE 'Other AU'
            END
        WHEN country = 'US' THEN 'United States'
        ELSE 'International'
    END AS region_label
FROM customers;
```

> **Memory hook:** CASE WHEN is a translator sitting between raw codes and human eyes — the database still stores 1, 2, 3, but the report reads "Active."

---

## 9. ORDER BY — Sorting Results

### The problem

Raw table rows come back in whatever order the storage engine happens to read them — usually insertion order, but never something you should rely on. If you want "most expensive first" or "newest signups on top," you need to say so explicitly.

### Single-column sort

```sql
SELECT name, price FROM products ORDER BY price;          -- ASC is default
SELECT name, price FROM products ORDER BY price DESC;
SELECT name, price FROM products ORDER BY name ASC;
```

### Multi-column sort

```sql
-- Sort by category first, then by price within each category
SELECT name, category, price
FROM products
ORDER BY category ASC, price DESC;
```

Each column gets its own direction. The sort is stable within tied values of
earlier columns — rows with the same `category` are then ordered by `price`.

### Sorting NULL values

By default, NULL sorts as the smallest value in ASC (appears first) and the
largest in DESC (appears last). Override with COALESCE or CASE:

```sql
-- Push NULLs to the end regardless of sort direction
SELECT name, deleted_at
FROM users
ORDER BY
    (deleted_at IS NULL) DESC,   -- 1 for NULL → sorts last
    deleted_at ASC;
```

### Sorting by expression

```sql
-- Sort by computed value
SELECT name, length_cm, width_cm
FROM products
ORDER BY length_cm * width_cm DESC;    -- largest area first

-- Sort by string length
SELECT tag_name FROM tags ORDER BY CHAR_LENGTH(tag_name);
```

### LIMIT with ORDER BY

Without ORDER BY, LIMIT returns an arbitrary subset. Always pair them:

```sql
-- Top 10 most expensive products
SELECT name, price FROM products ORDER BY price DESC LIMIT 10;

-- 5 most recently created users
SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT 5;
```

> **Memory hook:** No ORDER BY means "whatever order the engine feels like today" — never trust unsorted rows to stay in the same order tomorrow.

---

## 10. LIMIT and OFFSET — Pagination

### The problem

A product listing page can't dump all 100,000 products at once — nobody wants to scroll through that, and no browser wants to render it. You need "page 3 of 20 results" style slicing.

### Syntax

```sql
SELECT ... FROM ... ORDER BY ... LIMIT row_count OFFSET skip_count;
-- Shorthand: LIMIT skip_count, row_count  (arguments reversed — confusing, avoid)
```

### Pagination formula

```
Page N (1-indexed):
  LIMIT  = page_size
  OFFSET = (page_number - 1) * page_size
```

```sql
-- Page 1: rows 1-20
SELECT id, name FROM products ORDER BY id LIMIT 20 OFFSET 0;

-- Page 2: rows 21-40
SELECT id, name FROM products ORDER BY id LIMIT 20 OFFSET 20;

-- Page 5: rows 81-100
SELECT id, name FROM products ORDER BY id LIMIT 20 OFFSET 80;
```

### The deep-pagination problem

```
┌──────────────────────────────────────────────────────────────────┐
│  LIMIT 20 OFFSET 10000                                           │
│                                                                  │
│  MySQL must read and discard 10 000 rows before returning 20.   │
│  Cost grows linearly with OFFSET — very slow on large tables.   │
└──────────────────────────────────────────────────────────────────┘
```

**Cursor-based pagination** (keyset pagination) solves this:

```sql
-- First page
SELECT id, name, price FROM products ORDER BY id LIMIT 20;
-- Last id returned: 1523

-- Next page — no OFFSET needed
SELECT id, name, price FROM products
WHERE id > 1523
ORDER BY id
LIMIT 20;
```

This hits an index range scan instead of a full scan + discard. Suitable for
infinite scroll or API cursors. Not suitable when users need to jump to arbitrary
page numbers.

| Approach              | How it works                          | Good for                          | Weak point                             |
|------------------------|----------------------------------------|-------------------------------------|-------------------------------------------|
| LIMIT / OFFSET          | Skip N rows, then return the next M    | "Jump to page 5" style UIs          | Gets slower the deeper you page          |
| Cursor / keyset (`WHERE id > last_seen_id`) | Filter past the last row you saw, then take the next M | Infinite scroll, API pagination     | Can't jump to an arbitrary page number    |

> **Memory hook:** OFFSET is walking to page 500 of a book one page at a time; a cursor is a bookmark that lets you open straight to where you left off.

### LIMIT for "does it exist" checks

```sql
-- More efficient than COUNT(*) when you only need to know if rows exist
SELECT 1 FROM orders WHERE customer_id = 42 LIMIT 1;
-- Returns one row if any order exists, zero rows if none
```

---

## 11. Putting It Together — Full Query Shape

### The problem

You've now met every clause — SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT. Here's the twist that confuses almost everyone at some point: **the order you type these clauses is not the order MySQL actually runs them in.** That mismatch is exactly why WHERE can't see a SELECT alias (Section 2), and it's the single most useful mental model for debugging a query that "should work but doesn't."

### The analogy

Think of a factory assembly line. The clauses you type are just the parts list handed to the foreman — the actual work happens in a fixed sequence on the floor, and that sequence has nothing to do with the order the parts list was written in.

### The written shape

```
┌─────────────────────────────────────────────────────────────────────┐
│  SELECT  [DISTINCT]                                                 │
│      col1 [AS alias],                                               │
│      expression [AS alias],                                         │
│      CASE ... END [AS alias]                                        │
│  FROM table_name [AS t]                                             │
│  [JOIN ...]                                                         │
│  WHERE  condition                                                   │
│  GROUP BY col1                                                      │
│  HAVING  aggregate_condition                                        │
│  ORDER BY col1 [ASC|DESC], col2 [ASC|DESC]                         │
│  LIMIT  n  OFFSET  m;                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### The actual (logical) evaluation order

```
Logical evaluation order (not the written order):
  1. FROM        — identify the table(s)
  2. JOIN        — combine tables
  3. WHERE       — filter rows
  4. GROUP BY    — aggregate
  5. HAVING      — filter groups
  6. SELECT      — compute output columns
  7. DISTINCT    — deduplicate
  8. ORDER BY    — sort
  9. LIMIT/OFFSET — slice
```

Notice SELECT sits at position 6 — near the *end* of the pipeline, even though you type it first. That single fact explains a whole category of "why doesn't this work" confusion:

### Common mistakes this order explains

- **WHERE referencing a SELECT alias** — WHERE runs at step 3, SELECT computes aliases at step 6. The alias doesn't exist yet. Fix: repeat the expression in WHERE, or wrap the query in a subquery/CTE.
- **HAVING working with aggregates, WHERE not** — HAVING runs at step 5, after GROUP BY has produced aggregate values. WHERE runs at step 3, before any aggregation exists, so `WHERE COUNT(*) > 5` fails but `HAVING COUNT(*) > 5` works.
- **GROUP BY/HAVING alias support feeling inconsistent** — MySQL is generous here (it lets you use SELECT aliases in GROUP BY and HAVING as a non-standard extension), which is why people assume WHERE will be equally generous. It isn't.

### Interview answer

The logical query processing order in MySQL is FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT/OFFSET. This differs from the order you physically type the clauses, and it explains why WHERE cannot reference a column alias defined in SELECT (SELECT hasn't run yet), while HAVING can filter on aggregate functions (GROUP BY has already run by that point).

> **Memory hook:** You write "SELECT ... FROM ... WHERE," but MySQL reads it backwards-ish: find the table, filter the rows, THEN figure out what to show you.

### Full real-world example

```sql
-- Monthly top-5 products by revenue for the current year
SELECT
    DATE_FORMAT(oi.created_at, '%Y-%m')         AS month,
    p.name                                       AS product_name,
    SUM(oi.qty)                                  AS units_sold,
    ROUND(SUM(oi.qty * oi.unit_price), 2)        AS revenue,
    CASE
        WHEN SUM(oi.qty * oi.unit_price) >= 10000 THEN 'High'
        WHEN SUM(oi.qty * oi.unit_price) >= 2000  THEN 'Medium'
        ELSE                                           'Low'
    END AS revenue_tier
FROM order_items oi
JOIN products p ON p.id = oi.product_id
WHERE YEAR(oi.created_at) = YEAR(CURDATE())
GROUP BY month, p.id, p.name
HAVING revenue >= 500
ORDER BY month ASC, revenue DESC
LIMIT 5;
```

---

## 12. Hands-On Exercises

**Exercise 1 — Column selection and aliases**

From a `customers` table (id, first_name, last_name, email, dob, city, country,
created_at), write a SELECT that returns: full name as `full_name`, email, city
and country combined as `location` (e.g. 'Sydney, Australia'), and how many days
the customer has been registered as `days_since_signup`. No SELECT *.

**Exercise 2 — String function cleanup**

You have imported a `contacts` CSV where names have inconsistent casing
(e.g. 'JOHN DOE', 'john doe', 'John DOE'). Write a SELECT that returns each
contact's name normalised to title-case first name and uppercase last name,
without updating the table. Hint: use UPPER, LOWER, SUBSTRING, CONCAT.

**Exercise 3 — Date functions for a report**

Write a query against an `orders` table (id, customer_id, total, status,
created_at) that returns, grouped by calendar week (ISO week number + year):
week label, order count, total revenue, average order value rounded to 2
decimal places. Filter to the last 90 days only.

**Exercise 4 — CASE WHEN tiering**

Using the `products` table (id, name, price, stock, category), write a SELECT
that classifies each product into: 'Out of Stock' (stock=0), 'Low Stock'
(stock 1-10), 'Adequate' (11-50), 'Well Stocked' (>50). Sort by stock
category (Out of Stock first) and then by name alphabetically.

**Exercise 5 — Pagination**

Implement a server-side paginated product listing. Write the query for page 3
with 15 products per page, sorted by price ascending then name ascending.
Then rewrite it using cursor-based pagination assuming the last product on
page 2 had id=387.

---

## 13. Interview Q&A

**Q1: Why should you avoid SELECT * in production code?**

SELECT * sends all columns across the network, prevents the query optimiser from
using covering indexes (which can answer a query from the index alone without
touching the heap), and breaks silently when the table schema changes — a new
column is returned to callers who never expected it. Name the columns you need
explicitly.

**Q2: In which clauses can you reference a SELECT column alias?**

In standard SQL only ORDER BY. MySQL additionally allows aliases in GROUP BY and
HAVING as a non-standard extension. Aliases cannot be used in WHERE because WHERE
is evaluated before SELECT in MySQL's logical processing order.

**Q3: What is the difference between DISTINCT and GROUP BY for deduplication?**

Both eliminate duplicate rows. GROUP BY is preferred when you also want aggregate
functions (COUNT, SUM, etc.). DISTINCT is clearer when you purely want unique
values with no aggregation. Internally MySQL may use the same execution plan for
both — check EXPLAIN.

**Q4: What does DATEDIFF return, and in what order are the arguments?**

DATEDIFF(d1, d2) returns d1 minus d2 in whole days. The result is positive if
d1 is later than d2 and negative if d1 is earlier. Only the date part is
considered — time is ignored.

**Q5: How does LIMIT OFFSET perform on large tables?**

MySQL must scan and discard the OFFSET rows before returning the LIMIT rows.
For LIMIT 20 OFFSET 50000, MySQL reads 50020 rows and throws away the first
50000. Performance degrades linearly with OFFSET. For deep pagination in
production use keyset (cursor) pagination: WHERE id > last_seen_id LIMIT n.

**Q6: What is the difference between LENGTH and CHAR_LENGTH?**

LENGTH returns the byte count of the string. CHAR_LENGTH returns the character
count. They differ for multi-byte character sets such as UTF-8, where a single
character like '€' occupies 3 bytes. Always use CHAR_LENGTH for business logic
(truncating display names, validating field lengths) and LENGTH only when you
care about storage bytes.

**Q7: Can CASE WHEN be used inside an aggregate function?**

Yes, and it is a common technique for conditional aggregation (horizontal pivot):

```sql
SUM(CASE WHEN status = 'shipped' THEN total ELSE 0 END) AS shipped_revenue
```

This avoids multiple self-joins or subqueries when you need different conditions
on the same column aggregated separately.

**Q8: What is the logical evaluation order of a SELECT statement?**

FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY →
LIMIT/OFFSET. This is why WHERE cannot reference SELECT aliases (SELECT runs
later) and why HAVING can filter on aggregates (it runs after GROUP BY).

**Q9: How do you sort NULLs last in ASC order?**

```sql
ORDER BY (col IS NULL) ASC, col ASC
-- IS NULL returns 0 for non-null, 1 for null → nulls sort last
```

**Q10: What does ROUND do with negative decimal places?**

ROUND(n, -2) rounds to the nearest hundred, ROUND(n, -3) to the nearest
thousand:

```sql
SELECT ROUND(1567.89, -2);   -- 1600
SELECT ROUND(1567.89, -3);   -- 2000
```

**Q11: How does DATE_FORMAT differ from YEAR() / MONTH() / DAY()?**

YEAR(), MONTH(), DAY() extract integer components. DATE_FORMAT returns a
formatted string. Use the integer extractors in WHERE and GROUP BY (they can
use indexes); use DATE_FORMAT in SELECT for display purposes.

**Q12: What is the difference between NOW() and CURDATE()?**

NOW() returns a DATETIME including hours, minutes, and seconds. CURDATE()
returns a DATE with no time component. For date-only comparisons use CURDATE()
to avoid implicit type conversions that can break index usage.

**Q13: How do you concatenate with a possible NULL column?**

CONCAT returns NULL if any argument is NULL. Use COALESCE or IFNULL to provide
a fallback:

```sql
SELECT CONCAT(first_name, ' ', COALESCE(middle_name, ''), ' ', last_name)
FROM customers;
-- Or: CONCAT_WS(' ', first_name, middle_name, last_name)
-- CONCAT_WS skips NULLs automatically
```

**Q14: What is CONCAT_WS?**

CONCAT With Separator. The first argument is the separator; subsequent arguments
are joined with it. NULL arguments are skipped (unlike CONCAT where they poison
the result):

```sql
SELECT CONCAT_WS(', ', street, city, state, country) AS address
FROM locations;
-- NULLs in street/state are skipped, no double-commas
```

**Q15: When is DISTINCT expensive and how do you spot it in EXPLAIN?**

DISTINCT is expensive when MySQL cannot use an index to produce pre-sorted
unique values. In EXPLAIN output, look for `Using temporary` (a temp table
was created for deduplication) and `Using filesort` (the temp table was then
sorted). Adding a covering index on the columns in the DISTINCT list allows
MySQL to read unique values directly from the index.
