# 02 — ORDER BY

> Control the sequence of your result set. Every row in the right place.

---

## Table of Contents

1. [Why Ordering Matters](#1-why-ordering-matters)
2. [Basic ASC and DESC](#2-basic-asc-and-desc)
3. [Multi-Column Sorting](#3-multi-column-sorting)
4. [Expressions in ORDER BY](#4-expressions-in-order-by)
5. [Column Alias in ORDER BY](#5-column-alias-in-order-by)
6. [Custom Sort Order — ORDER BY FIELD()](#6-custom-sort-order--order-by-field)
7. [NULL Sort Behavior](#7-null-sort-behavior)
8. [LIMIT and Pagination](#8-limit-and-pagination)
9. [Filesort vs Index Sort — EXPLAIN](#9-filesort-vs-index-sort--explain)
10. [ORDER BY in Subqueries and CTEs](#10-order-by-in-subqueries-and-ctes)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why Ordering Matters

Ever run the same `SELECT * FROM employees` twice and gotten the rows back in a
different sequence? That's not a bug — it's MySQL being honest with you. A
plain SELECT makes no promise about row order at all.

Think of it like asking a librarian to "bring me all the books on this shelf."
They'll hand them to you in whatever order is fastest for them — maybe the
order they're stacked, maybe alphabetical if that's how the shelf happens to
be arranged. If you actually need them alphabetical, you have to *ask* for
that specifically. That request is ORDER BY.

**Definition:** without ORDER BY, MySQL returns rows in an **undefined order**.
The engine may return them in heap insertion order, index order, or whatever
the query planner finds most efficient. This is not deterministic and can
change between MySQL versions or even between two identical queries.

```
┌───────────────────────────────────────────────────────────┐
│  Without ORDER BY                                         │
│  SELECT * FROM employees;                                 │
│                                                           │
│  Result (undefined):                                      │
│  5 → Alice                                               │
│  2 → Bob                                                 │
│  8 → Carol                                               │
│  1 → Dave     ← ORDER UNPREDICTABLE                      │
│                                                           │
│  With ORDER BY emp_id ASC:                               │
│  1 → Dave                                               │
│  2 → Bob                                                 │
│  5 → Alice                                               │
│  8 → Carol     ← DETERMINISTIC                          │
└───────────────────────────────────────────────────────────┘
```

So why does this actually matter in practice? Ordering is critical for:
- Pagination (page 2 must be consistent with page 1)
- Reports (salary ranking, latest orders first)
- Finding top-N records
- User-facing lists that must be predictable

> **Memory hook:** No ORDER BY means "whatever order is convenient for the engine" — not "the order you expect."

---

## 2. Basic ASC and DESC

If ordering is the request, ASC and DESC are how you tell MySQL *which way* to
sort — low-to-high or high-to-low. Think of it as choosing between climbing up
a staircase or riding down it: same staircase, opposite direction.

### Syntax

```sql
SELECT col1, col2 FROM table_name
ORDER BY col_name [ASC | DESC];
```

ASC (ascending) is the **default** — you do not need to write it, but it adds clarity.

### Ascending (low to high, A to Z, oldest to newest)

```sql
-- Numeric ascending
SELECT name, salary FROM employees ORDER BY salary ASC;
SELECT name, salary FROM employees ORDER BY salary;     -- ASC is default

-- Alphabetical ascending
SELECT country FROM countries ORDER BY country ASC;

-- Date ascending (oldest first)
SELECT order_id, order_date FROM orders ORDER BY order_date ASC;
```

### Descending (high to low, Z to A, newest to oldest)

```sql
-- Most expensive products first
SELECT name, price FROM products ORDER BY price DESC;

-- Most recent orders first
SELECT order_id, order_date FROM orders ORDER BY order_date DESC;

-- Reverse alphabetical
SELECT name FROM tags ORDER BY name DESC;
```

### Direction Applies Per Column

```sql
-- Wrong interpretation: DESC only applies to the immediately preceding column
ORDER BY last_name ASC, first_name DESC
-- last_name: A → Z
-- first_name: Z → A (within each last_name group)
```

---

## 3. Multi-Column Sorting

What happens when the first column you sort by has lots of duplicate values?
Sorting an employee directory by department alone leaves every "Engineering"
row in arbitrary order relative to each other — not very useful if you also
want to see who earns the most within that department.

That's the problem multi-column ORDER BY solves. Think of it like sorting a
deck of playing cards: first by suit, then within each suit, by rank. The
suit is the primary sort; the rank only breaks ties *within* a suit.

**Definition:** multi-column ORDER BY applies a **tiebreaker hierarchy**. The
second column only matters when two rows have identical values in the first
column.

### Syntax

```sql
ORDER BY col1 [ASC|DESC], col2 [ASC|DESC], col3 [ASC|DESC]
```

### Real-World Example: Employee Directory

```sql
-- Sort by department name A→Z, then by salary high→low within each department
SELECT first_name, last_name, department, salary
FROM employees
ORDER BY department ASC, salary DESC;
```

Result structure:

```
┌────────────────┬──────────────────┬──────────┐
│  first_name    │  department      │  salary  │
├────────────────┼──────────────────┼──────────┤
│  Carol         │  Engineering     │  120000  │  ← Eng, highest salary
│  Alice         │  Engineering     │  95000   │  ← Eng, second highest
│  Dave          │  Engineering     │  82000   │  ← Eng, third
│  Frank         │  Marketing       │  75000   │  ← Mkt, highest
│  Eve           │  Marketing       │  62000   │  ← Mkt, second
└────────────────┴──────────────────┴──────────┘
```

### Three-Level Sort: Region, Department, Salary

```sql
SELECT region, department, first_name, salary
FROM employees
ORDER BY region ASC, department ASC, salary DESC;
```

### Sorting by Column Position Number

MySQL allows referencing SELECT columns by their position (1-indexed):

```sql
SELECT first_name, last_name, salary
FROM employees
ORDER BY 3 DESC, 2 ASC;
-- ORDER BY salary DESC, last_name ASC
```

This is concise but fragile — if you add or reorder SELECT columns, the numbers
break silently. Prefer named columns in production code.

> **Memory hook:** Sort by suit, then by rank within suit — each column only breaks ties left over by the one before it.

---

## 4. Expressions in ORDER BY

You're not limited to sorting by raw column values. What if "order" means
something computed — total revenue per line item, or how recently something
was touched regardless of the exact timestamp? MySQL lets you sort by
basically anything you could put in a SELECT list: functions, arithmetic,
even CASE statements.

### Arithmetic Expression

```sql
-- Sort by total revenue per item (unit_price * quantity)
SELECT product_name, unit_price, quantity,
       unit_price * quantity AS total_price
FROM order_items
ORDER BY unit_price * quantity DESC;

-- Or using the alias (MySQL allows alias in ORDER BY)
ORDER BY total_price DESC;
```

### Date/Time Functions

```sql
-- Sort by most recently updated, regardless of time
SELECT title, updated_at
FROM articles
ORDER BY DATE(updated_at) DESC;

-- Sort by year descending, then month ascending
SELECT title, published_at
FROM posts
ORDER BY YEAR(published_at) DESC, MONTH(published_at) ASC;

-- Sort by day of week (1=Sunday, 7=Saturday in MySQL)
SELECT event_name, event_date
FROM events
ORDER BY DAYOFWEEK(event_date);
```

### String Functions

```sql
-- Sort by string length (shortest names first)
SELECT name FROM customers ORDER BY LENGTH(name) ASC;

-- Sort alphabetically on the last word of a full name
SELECT full_name
FROM authors
ORDER BY SUBSTRING_INDEX(full_name, ' ', -1) ASC;
```

### CASE Expression in ORDER BY

```sql
-- Custom priority: 'critical' first, then 'high', 'medium', 'low' last
SELECT ticket_id, title, priority
FROM support_tickets
ORDER BY
    CASE priority
        WHEN 'critical' THEN 1
        WHEN 'high'     THEN 2
        WHEN 'medium'   THEN 3
        WHEN 'low'      THEN 4
        ELSE 5
    END ASC,
    created_at ASC;
```

This pattern avoids storing a numeric sort_order column by computing priority
rank inline.

> **Memory hook:** If you can SELECT it, you can usually ORDER BY it — MySQL doesn't care whether the sort key is a column or a calculation.

### Conditional Expression

```sql
-- Show employees hired before 2020 first, rest alphabetically
SELECT first_name, last_name, hire_date
FROM employees
ORDER BY
    CASE WHEN hire_date < '2020-01-01' THEN 0 ELSE 1 END ASC,
    last_name ASC;
```

---

## 5. Column Alias in ORDER BY

Typing `salary * 1.1` twice — once in SELECT, once in ORDER BY — is annoying
and error-prone. Wouldn't it be nice to just give the expression a name once
and reuse that name? MySQL says yes.

**Definition:** MySQL is one of the few databases that allows a SELECT column
alias to be used directly in ORDER BY. This is a MySQL extension; it does not
work in all databases.

```sql
-- Valid in MySQL
SELECT
    first_name,
    last_name,
    salary * 1.1 AS adjusted_salary
FROM employees
ORDER BY adjusted_salary DESC;
```

Why does this work at all? It comes down to the *order* MySQL actually
processes the clauses in — which is not the same as the order you type them:

```
FROM → WHERE → GROUP BY → HAVING → SELECT (aliases resolved) → ORDER BY → LIMIT
```

SELECT aliases are available by the time ORDER BY is processed — the alias
already exists by that point in the pipeline.

### Contrast: Alias NOT Available in WHERE

Here's the trap: since aliases work in ORDER BY, it's tempting to assume they
work everywhere. They don't. WHERE runs *before* SELECT in that pipeline
above, so at the moment WHERE is evaluated, the alias hasn't been created
yet.

```sql
-- INVALID — alias not yet resolved at WHERE time
SELECT salary * 1.1 AS adjusted_salary
FROM employees
WHERE adjusted_salary > 70000;   -- ERROR: Unknown column 'adjusted_salary'

-- Fix: repeat the expression
WHERE salary * 1.1 > 70000;

-- Or use a subquery / CTE
WITH adjusted AS (
    SELECT first_name, salary * 1.1 AS adjusted_salary FROM employees
)
SELECT * FROM adjusted WHERE adjusted_salary > 70000 ORDER BY adjusted_salary;
```

> **Memory hook:** The pipeline runs FROM → WHERE → SELECT → ORDER BY — an alias only exists after SELECT builds it, so WHERE never sees it but ORDER BY does.

---

## 6. Custom Sort Order — ORDER BY FIELD()

Sometimes "alphabetical" or "numerical" isn't the order you want at all. A
support ticket queue shouldn't sort statuses alphabetically — "cancelled"
would beat "urgent" to the top, which is exactly backwards from what a
support team needs. You want *business* priority, not dictionary order.

Think of it like a hospital triage board: patients aren't called up
alphabetically by name, they're called by how urgent their condition is —
someone decided the order in advance, and the board just follows it.
`FIELD()` lets you hand MySQL that same kind of pre-decided order.

**Definition:** `FIELD(col, val1, val2, val3, ...)` returns the position of
col in the list (1-indexed). Values not in the list return 0.

### Basic Usage

```sql
-- Sort days of week in logical order
SELECT *
FROM schedule
ORDER BY FIELD(day_name, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
```

### Practical Example: Status Priority

```sql
-- Show orders by business priority, not alphabetical status
SELECT order_id, status, created_at
FROM orders
ORDER BY FIELD(status, 'urgent', 'pending', 'processing', 'shipped', 'delivered', 'cancelled');
```

### Common Mistake: FIELD() Returns 0 for Non-Listed Values

Here's the gotcha that catches people out: what happens to a value that
*isn't* in your priority list at all? It doesn't error — it silently gets 0,
and 0 sorts to the very front in ASC order. So an "unknown" or "cancelled"
status you forgot to list can jump the queue instead of being pushed to the
back where you'd expect.

```sql
-- If status = 'unknown' (not in list), FIELD returns 0
-- By default, 0 sorts FIRST in ASC order, LAST in DESC
SELECT order_id, status
FROM orders
ORDER BY FIELD(status, 'pending', 'processing', 'shipped') ASC;
-- 'cancelled' (not in list) → FIELD = 0 → sorts FIRST (potentially unwanted)

-- Push unlisted values to the end:
ORDER BY FIELD(status, 'pending', 'processing', 'shipped') = 0 ASC,
         FIELD(status, 'pending', 'processing', 'shipped') ASC;
```

### ELT() and Custom Sort Lookup Table Alternative

For large or dynamic sort orders, a lookup/reference table with a sort_order
column is cleaner than FIELD():

```sql
CREATE TABLE status_order (
    status     VARCHAR(20) PRIMARY KEY,
    sort_order INT
);
INSERT INTO status_order VALUES ('urgent',1),('pending',2),('processing',3),('shipped',4);

SELECT o.order_id, o.status
FROM orders o
LEFT JOIN status_order so ON o.status = so.status
ORDER BY COALESCE(so.sort_order, 999);  -- unlisted statuses go to end
```

| Approach | Best for | Downside |
|---|---|---|
| `FIELD()` | Small, fixed lists (< 10-15 values) | Unlisted values silently get 0; list must be repeated in every query |
| Lookup table + `sort_order` | Large or dynamic lists | Requires a JOIN, but the order lives in data, not scattered across queries |

> **Memory hook:** FIELD() is a triage board you write into the query itself — a lookup table is a triage board someone can update without touching the query at all.

---

## 7. NULL Sort Behavior

Here's a question that trips up almost everyone the first time: where does
NULL — "I don't know," "not applicable," "unset" — belong in a sorted list?
It's neither the smallest nor the largest value, because it isn't really a
value at all. MySQL still has to put it *somewhere*, and its answer is not
always the one you'd guess.

Think of NULL like an unlabeled box in a warehouse being sorted by weight.
The forklift operator has to decide: do unlabeled boxes go to the front of
the line or the back? MySQL has made that decision for you, and it depends
on which direction you're sorting.

**Definition:** in MySQL, NULLs sort **before** non-NULL values in ascending
order, and **after** non-NULL values in descending order.

```
ASC:   NULL → 1 → 5 → 10 → 50    (NULLs first)
DESC:  50 → 10 → 5 → 1 → NULL    (NULLs last)
```

MySQL treats NULL internally as sorting "lower" than any real value — that's
the whole rule in one sentence. Ascending order starts at the lowest value,
so NULL leads. Descending order starts at the highest, so NULL trails.

```sql
-- NULLs appear first
SELECT name, manager_id FROM employees ORDER BY manager_id ASC;

-- NULLs appear last
SELECT name, manager_id FROM employees ORDER BY manager_id DESC;
```

This is a common source of confusion: a report ordered "lowest salary first"
can put every employee with a missing salary at the very top, above someone
who genuinely earns $1 — which usually isn't what a report author intended.
The fix isn't a special MySQL flag; it's a small trick using functions you
already know.

### Force NULLs to the End in ASC Order

```sql
-- ISNULL() returns 1 for NULL, 0 for non-NULL — sort 0 first, then sort by value
SELECT name, manager_id
FROM employees
ORDER BY ISNULL(manager_id) ASC, manager_id ASC;
-- Non-NULLs (ISNULL=0) come first, then NULLs (ISNULL=1)
```

### Force NULLs to the Front in DESC Order

```sql
-- ISNULL() = 1 for NULL — sort 1 first
SELECT name, salary
FROM employees
ORDER BY ISNULL(salary) DESC, salary DESC;
-- NULLs (ISNULL=1) appear first (DESC), then non-NULLs high to low
```

### Using COALESCE to Treat NULL as a Specific Value

```sql
-- Treat NULL discount as 0 for sorting purposes
SELECT name, discount
FROM products
ORDER BY COALESCE(discount, 0) DESC;
```

| Technique | What it does | When to use |
|---|---|---|
| Plain `ORDER BY col ASC/DESC` | NULLs first (ASC) or last (DESC) — MySQL's default | Default is fine, or you want NULLs visually flagged at an edge |
| `ORDER BY ISNULL(col), col` | Forces NULLs to a specific end regardless of ASC/DESC | You need NULLs pinned to the end (or start) no matter the sort direction |
| `ORDER BY COALESCE(col, x)` | Treats NULL as a real value `x` for sorting purposes | NULL has an obvious "natural" substitute (0 discount, empty string, etc.) |

> **Memory hook:** NULL sorts like it's "less than everything" — ASC puts it first, DESC puts it last. ISNULL()/COALESCE() are how you override that default.

---

## 8. LIMIT and Pagination

### LIMIT — Top N Rows

You've sorted your rows. Now, do you actually need all million of them, or
just the top 5? That's what LIMIT is for — think of it as a pair of scissors
that snips a result set down to size after ORDER BY has arranged it.

One rule to burn into memory: always combine LIMIT with ORDER BY, otherwise
the "top" rows are arbitrary — you're asking for "the first 5 books" from a
shelf that isn't in any particular order.

```sql
-- Top 5 highest-paid employees
SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 5;

-- Most recent 10 orders
SELECT order_id, created_at FROM orders ORDER BY created_at DESC LIMIT 10;
```

### LIMIT offset, count — Pagination

```sql
-- Page 1: first 10 rows
SELECT * FROM products ORDER BY name ASC LIMIT 0, 10;

-- Page 2: rows 11-20
SELECT * FROM products ORDER BY name ASC LIMIT 10, 10;

-- Page 3: rows 21-30
SELECT * FROM products ORDER BY name ASC LIMIT 20, 10;
```

General formula: `LIMIT (page - 1) * page_size, page_size`

That formula works fine on page 2. Does it still work fine on page 10,000?

### LIMIT n OFFSET m (equivalent syntax)

```sql
SELECT * FROM products ORDER BY name ASC LIMIT 10 OFFSET 20;  -- page 3
```

### Pagination Performance Problem (Deep Offset)

No — and here's why. `LIMIT 100000, 10` doesn't teleport straight to row
100,001. MySQL still has to walk past every single row before it, reading
and discarding each one, just to know it has arrived at the right spot.
Imagine flipping through a 100,000-page book one page at a time just to reach
page 100,001 — that's the cost you're paying on every "next page" click deep
into a result set.

```
┌────────────────────────────────────────────────────────────┐
│  LIMIT 100000, 10                                          │
│                                                            │
│  MySQL scans and discards 100,000 rows to find rows       │
│  100,001 – 100,010. Very slow on large tables.            │
└────────────────────────────────────────────────────────────┘
```

### Keyset / Cursor Pagination (Fast Alternative)

If flipping through every page is the problem, what if you never had to
"flip" at all — what if you could jump straight there by remembering a
bookmark? That's the idea behind keyset pagination: instead of OFFSET,
remember the last seen ID:

```sql
-- Initial query
SELECT * FROM products ORDER BY product_id ASC LIMIT 10;
-- Returns rows with product_id 1..10

-- Next page: WHERE product_id > last_seen_id
SELECT * FROM products WHERE product_id > 10 ORDER BY product_id ASC LIMIT 10;
-- Returns rows with product_id 11..20
```

Keyset pagination is O(log n) per page regardless of how deep you are. It
requires a stable, unique sort column.

| Approach | How it works | Performance at page 10,000 |
|---|---|---|
| `LIMIT offset, count` | Skip `offset` rows, then take `count` | Slow — must scan and discard every row before the offset |
| Keyset / cursor (`WHERE id > last_id`) | Jump directly using an index seek from the last seen key | Fast — O(log n), same cost regardless of depth |

> **Memory hook:** OFFSET pagination re-walks the whole book from page 1 every time; keyset pagination just remembers your bookmark.

### SELECT Without LIMIT in Subqueries

MySQL 5.x required a LIMIT when using ORDER BY in a subquery. In MySQL 8.0+
this restriction is relaxed, but ORDER BY in a derived table without LIMIT has
no guaranteed effect in the outer query.

---

## 9. Filesort vs Index Sort — EXPLAIN

Why is `ORDER BY salary DESC` instant on one table and painfully slow on
another with the exact same row count? The answer usually comes down to one
thing: does MySQL have to *actively sort* the rows, or can it just *read them
in an order that's already sorted*?

Think of the difference between reading a dictionary (already alphabetical —
just start reading) versus being handed a stack of loose index cards you
have to sort yourself before you can read them in order. The dictionary is
an index-based sort. The index cards are a "filesort."

Understanding whether MySQL sorts in memory/disk vs via an index is critical
for performance tuning.

### Run EXPLAIN

```sql
EXPLAIN SELECT name, salary FROM employees ORDER BY salary DESC;
```

### Key EXPLAIN Columns for ORDER BY

| Column | Value | Meaning |
|--------|-------|---------|
| `type` | `index` | Full index scan in order |
| `key` | `idx_salary` | Index used for sorting |
| `Extra` | `Using index` | Index-only scan (no row lookup) |
| `Extra` | `Using filesort` | MySQL sorts in memory or on disk |
| `Extra` | `Using temporary; Using filesort` | Temp table + sort (expensive) |

### When MySQL Uses Index Sort

```
┌─────────────────────────────────────────────────────────────┐
│  Index: idx_salary (salary ASC)                            │
│                                                             │
│  SELECT name, salary FROM employees ORDER BY salary ASC;   │
│  → type: index, Extra: Using index condition               │
│  → No sort needed — index already in order                 │
│                                                             │
│  SELECT name, salary FROM employees ORDER BY salary DESC;  │
│  → MySQL can scan index in reverse (backward scan)         │
│  → Still uses the index                                    │
└─────────────────────────────────────────────────────────────┘
```

### Common Mistake: Assuming an Index Always Prevents Filesort

It's tempting to think "there's an index on this column, so ORDER BY on it
must be free." Not quite — the index only helps if MySQL can walk it in the
exact order (and direction pattern) your ORDER BY asks for. Wrap the column
in a function, mismatch the sort directions across a composite index, or
sort by a column with no index at all, and MySQL falls back to sorting the
rows itself.

### When MySQL Falls Back to Filesort

```sql
-- Functions on indexed column prevent index use
ORDER BY YEAR(hire_date)          -- can't use index on hire_date directly
ORDER BY LOWER(last_name)         -- can't use index on last_name

-- Mixed sort directions on multi-column index
-- index: (department ASC, salary ASC)
ORDER BY department ASC, salary DESC  -- direction mismatch → filesort
ORDER BY department ASC, salary ASC   -- matches index → no filesort

-- Non-indexed column
ORDER BY some_unindexed_column    -- filesort
```

### Composite Index for Multi-Column ORDER BY

```sql
-- Create index matching ORDER BY exactly
CREATE INDEX idx_dept_salary ON employees (department ASC, salary DESC);

-- This query can now use the index without filesort
SELECT * FROM employees ORDER BY department ASC, salary DESC;
```

### sort_buffer_size

When filesort occurs, MySQL uses `sort_buffer_size` (default 256 KB) per session.
If the sort data exceeds this, MySQL spills to temporary files on disk — much
slower. For large sorts, increase `sort_buffer_size` session variable:

```sql
SET SESSION sort_buffer_size = 4 * 1024 * 1024;  -- 4 MB
```

### EXPLAIN FORMAT=JSON for More Detail

```sql
EXPLAIN FORMAT=JSON
SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 10;
```

Look for `"sort_cost"` and `"using_filesort": true` in the JSON output.

| | Index Sort | Filesort |
|---|---|---|
| How it works | Reads rows in the order the index already stores them | Reads rows, then actively sorts them in a buffer (or on disk) |
| EXPLAIN signal | `type: index`, `Extra: Using index` | `Extra: Using filesort` |
| Cost | Cheap — no extra sort step | Extra CPU/memory, and disk I/O if it spills |
| Typical cause | ORDER BY matches an index's column order and direction | Function on the sorted column, direction mismatch, or no index |

> **Memory hook:** Index sort reads a dictionary that's already alphabetical; filesort hands you loose cards and makes you alphabetize them yourself.

---

## 10. ORDER BY in Subqueries and CTEs

Does putting ORDER BY inside a subquery guarantee the outer query stays in
that order? It's a reasonable assumption — and it's wrong. The optimizer
treats a derived table as just another data source; unless you pin the order
down with LIMIT, or add ORDER BY again on the outermost SELECT, that inner
sort can be silently thrown away.

### Subquery ORDER BY (MySQL 8.0+)

ORDER BY inside a derived table (subquery in FROM) has no guaranteed effect unless
combined with LIMIT:

```sql
-- ORDER BY in inner query is meaningful here only because of LIMIT
SELECT * FROM (
    SELECT * FROM employees ORDER BY salary DESC LIMIT 100
) AS top_earners
ORDER BY last_name ASC;
```

### CTE with ORDER BY

```sql
WITH ranked_employees AS (
    SELECT
        emp_id,
        first_name,
        department,
        salary,
        RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dept_rank
    FROM employees
)
SELECT * FROM ranked_employees
WHERE dept_rank <= 3
ORDER BY department ASC, dept_rank ASC;
```

### Window Functions vs ORDER BY

`ORDER BY` in a window function `OVER (ORDER BY ...)` defines the frame order
for the window calculation — it does NOT affect the final result set order. You
still need a top-level `ORDER BY` clause for that.

```sql
SELECT
    name,
    salary,
    ROW_NUMBER() OVER (ORDER BY salary DESC) AS rank_by_salary
FROM employees
ORDER BY rank_by_salary;   -- this ORDER BY controls result set order
```

| | Purpose | Affects final row order? |
|---|---|---|
| Inner ORDER BY in a subquery (no LIMIT) | Convenience only, optimizer may discard it | No guarantee |
| Inner ORDER BY + LIMIT in a subquery | Determines *which* rows survive the LIMIT | Indirectly — controls selection, not final order |
| `OVER (ORDER BY ...)` in a window function | Defines calculation/frame order for the window | No — separate from result order |
| Outer/top-level ORDER BY | The one clause that actually guarantees output order | Yes |

> **Memory hook:** Only the outermost ORDER BY is a promise — every other ORDER BY you see is just a hint, a ranking input, or a LIMIT's accomplice.

---

## 11. Hands-On Exercises

Schema used:

```sql
CREATE TABLE products (
    product_id   INT PRIMARY KEY AUTO_INCREMENT,
    name         VARCHAR(100),
    category     VARCHAR(50),
    price        DECIMAL(10,2),
    stock        INT,
    created_at   DATETIME,
    discount     DECIMAL(5,2)   -- can be NULL
);
```

### Exercise 1

List all products, sorted by category alphabetically and then by price from
highest to lowest within each category. Show the top 20 results only.

```sql
SELECT product_id, name, category, price
FROM products
ORDER BY category ASC, price DESC
LIMIT 20;
```

### Exercise 2

Show all products sorted by their effective price after discount (price minus
discount; treat NULL discount as 0). Most affordable first.

```sql
SELECT product_id, name, price, discount,
       price - COALESCE(discount, 0) AS effective_price
FROM products
ORDER BY effective_price ASC;
```

### Exercise 3

Show the 10 most recently added products in each category. Use category ASC as
the primary sort, and created_at DESC as the secondary sort. Apply LIMIT for the
top 30 overall.

```sql
SELECT product_id, name, category, created_at
FROM products
ORDER BY category ASC, created_at DESC
LIMIT 30;
```

### Exercise 4

List products using a custom category priority: 'Electronics' first, then
'Clothing', then 'Books', then everything else alphabetically. Within each
category, sort by name ASC.

```sql
SELECT product_id, name, category, price
FROM products
ORDER BY
    FIELD(category, 'Electronics', 'Clothing', 'Books') = 0 ASC,
    FIELD(category, 'Electronics', 'Clothing', 'Books') ASC,
    name ASC;
```

### Exercise 5

Implement page 4 of a product catalogue (10 items per page), sorted by price
ascending, then by name ascending as a tiebreaker.

```sql
-- Page 4: offset = (4 - 1) * 10 = 30
SELECT product_id, name, price
FROM products
ORDER BY price ASC, name ASC
LIMIT 30, 10;
```

---

## 12. Interview Q&A

**Q1. What happens if you don't specify ORDER BY in a SELECT query?**

A: The result set order is undefined and non-deterministic. MySQL may return rows
in heap order, index order, or whatever the query planner finds most efficient.
This order can change between query executions, MySQL versions, or server restarts.
Never rely on implicit ordering — always specify ORDER BY for any query where order
matters (pagination, reports, top-N).

---

**Q2. Can you use a SELECT alias in ORDER BY? What about in WHERE?**

A: In MySQL, yes — SELECT aliases can be referenced in ORDER BY because MySQL
resolves SELECT projections before processing ORDER BY. However, aliases are NOT
available in WHERE, GROUP BY criteria, or HAVING in standard SQL, because WHERE
is processed before SELECT. MySQL 8.0 actually allows aliases in GROUP BY and
HAVING as an extension, but WHERE still does not support them.

---

**Q3. Explain the difference between filesort and index sort.**

A: When MySQL can satisfy ORDER BY directly from an index (because the ORDER BY
columns and directions match an available index), it reads rows in index order —
no explicit sort step needed. When no suitable index exists, MySQL performs a
"filesort": it reads the rows, sorts them in a sort buffer (in-memory), and if
the data exceeds `sort_buffer_size`, spills to disk. Filesort is slower,
especially for large result sets. You can detect it via EXPLAIN (look for "Using
filesort" in the Extra column).

---

**Q4. How do NULLs sort in MySQL?**

A: In MySQL, NULLs sort before non-NULL values in ASC order (NULLs first), and
after non-NULL values in DESC order (NULLs last). To override this behavior — for
example, to push NULLs to the end in ASC order — use `ORDER BY ISNULL(col) ASC,
col ASC`. ISNULL() returns 1 for NULL (sorted last) and 0 for non-NULL.

---

**Q5. What is the performance problem with large OFFSET in LIMIT/OFFSET pagination?**

A: MySQL must scan and discard all rows up to the offset before returning the
requested page. `LIMIT 100000, 10` requires reading 100,010 rows just to return 10.
Performance degrades linearly with offset depth. The solution is keyset (cursor)
pagination: remember the last seen ID or sort key value from the previous page,
and use `WHERE id > last_id ORDER BY id LIMIT 10`. This is O(log n) regardless
of depth.

---

**Q6. What is FIELD() and when is it useful in ORDER BY?**

A: `FIELD(col, v1, v2, v3)` returns the 1-based position of col in the value
list, or 0 if not found. In ORDER BY, it enables custom sort sequences that don't
follow natural sort order — for example, showing 'urgent' tickets before 'high'
before 'medium', regardless of alphabetical order. It is more concise than a CASE
expression for simple priority lists.

---

**Q7. Can ORDER BY use an index when sorting in DESC direction?**

A: Yes. MySQL 8.0 introduced true descending indexes (`CREATE INDEX idx ON t(col DESC)`).
Even without a DESC index, MySQL can perform a backward scan on a standard ASC
index to satisfy `ORDER BY col DESC` efficiently. Multi-column scenarios are more
nuanced — if the index is `(a ASC, b ASC)` and you query `ORDER BY a ASC, b ASC`,
it uses the index forward. For `ORDER BY a DESC, b DESC`, it uses the index
backward. But `ORDER BY a ASC, b DESC` cannot use a standard composite index and
requires filesort.

---

**Q8. Why is it unsafe to use column position numbers in ORDER BY?**

A: `ORDER BY 3 DESC` sorts by the third column in the SELECT list. If someone
later inserts a new column at position 3, the sort column silently changes without
any error. Named columns are self-documenting, refactoring-safe, and far less
error-prone in production code.

---

**Q9. Does ORDER BY inside a subquery guarantee order in the outer query?**

A: No. In MySQL 8.0+, ORDER BY inside a derived table (subquery in FROM) without
LIMIT has no guaranteed effect on the outer query's result order. The optimizer is
free to ignore it. To guarantee order in the outer query, always add ORDER BY to
the outermost SELECT. If you need the inner ORDER BY for LIMIT purposes (e.g., to
get the top 5 per group), use ORDER BY + LIMIT together inside the subquery.

---

**Q10. How do you sort by a computed column without repeating the expression?**

A: In MySQL, assign an alias in SELECT and reference the alias in ORDER BY:
```sql
SELECT price * quantity AS total_value FROM order_items ORDER BY total_value DESC;
```
Alternatively, reference the SELECT position: `ORDER BY 1 DESC` (fragile).
In databases that do not allow alias in ORDER BY, you must repeat the expression.

---

**Q11. What is `sort_buffer_size` and when does it matter?**

A: `sort_buffer_size` is a per-session memory buffer MySQL allocates for filesort
operations. The default is 256 KB. If the data to sort exceeds this, MySQL creates
temporary files on disk, which dramatically slows the sort. For queries that sort
large result sets without an appropriate index, increasing `sort_buffer_size`
(e.g., to 4 MB) for the session can improve performance.

---

**Q12. How do you implement keyset pagination?**

A: Remember the sort key value of the last row returned on the previous page, then
filter using WHERE:
```sql
-- First page
SELECT * FROM products ORDER BY product_id ASC LIMIT 10;
-- last product_id returned = 10

-- Second page
SELECT * FROM products WHERE product_id > 10 ORDER BY product_id ASC LIMIT 10;
```
For multi-column sort keys, extend the WHERE clause accordingly. Keyset pagination
requires the sort column to be unique and stable.
