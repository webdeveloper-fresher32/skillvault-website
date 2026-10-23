# FULL OUTER, CROSS, SELF JOIN — Advanced Join Types & Performance

## Table of Contents

1. [FULL OUTER JOIN Concept](#1-full-outer-join-concept)
2. [FULL OUTER JOIN in MySQL: The UNION Workaround](#2-full-outer-join-in-mysql-the-union-workaround)
3. [ASCII Diagram: FULL OUTER JOIN](#3-ascii-diagram-full-outer-join)
4. [CROSS JOIN — Cartesian Product](#4-cross-join--cartesian-product)
5. [CROSS JOIN Use Cases](#5-cross-join-use-cases)
6. [SELF JOIN — A Table Joined to Itself](#6-self-join--a-table-joined-to-itself)
7. [SELF JOIN: Employee Hierarchy Example](#7-self-join-employee-hierarchy-example)
8. [SELF JOIN: Other Use Cases](#8-self-join-other-use-cases)
9. [NATURAL JOIN — Implicit Join (Avoid)](#9-natural-join--implicit-join-avoid)
10. [Full Example Schema](#10-full-example-schema)
11. [JOIN Performance Deep Dive](#11-join-performance-deep-dive)
12. [EXPLAIN Output for JOINs](#12-explain-output-for-joins)
13. [Index Strategy for JOINs](#13-index-strategy-for-joins)
14. [Join Order and the Optimizer](#14-join-order-and-the-optimizer)
15. [Common Mistakes](#15-common-mistakes)
16. [Hands-On Exercises](#16-hands-on-exercises)
17. [Interview Q&A](#17-interview-qa)

---

## 1. FULL OUTER JOIN Concept

You already know LEFT JOIN keeps every row from the left table, and RIGHT JOIN keeps every row from the right table. But what if you need both guarantees at once?

Picture this request from your boss:

> "Show me every customer AND every order. If a customer has orders, match them up. If a customer has never ordered, still show them. And if there's some rogue order sitting in the system with no matching customer — a data-integrity problem we need to catch — show that too. Don't drop either side."

Neither LEFT JOIN nor RIGHT JOIN alone can do this. LEFT JOIN would keep customers-with-no-orders but silently drop orphaned orders. RIGHT JOIN would do the opposite. You need both directions preserved simultaneously.

**Analogy:** think of it like reconciling two guest lists for a merged event — the people who RSVP'd, and the people who actually walked through the door. Some names are on both lists (matched). Some only RSVP'd but never showed (left-only). Some walked in without RSVPing (right-only). A full reconciliation report has to show all three groups, not just the overlap.

**FULL OUTER JOIN** returns ALL rows from BOTH tables. Where there is a match,
columns from both sides are populated. Where there is no match on one side,
that side's columns are NULL.

```
Left table (customers)    Right table (orders)
──────────────────────    ────────────────────
id  name                  id  cust_id
─── ────                  ─── ───────
 1  Alice                  1    1
 2  Bob                    2    1
 3  Carol                  3    2
 4  Dave                   4    2
                           5   99    ← orphaned order (no matching customer)

FULL OUTER JOIN result:
name    order_id   Note
─────   ────────   ─────────────────────────────────────────
Alice      1       match
Alice      2       match
Bob        3       match
Bob        4       match
Carol     NULL     left-only (no order)
Dave      NULL     left-only (no order)
NULL       5       right-only (no customer — orphaned order)
```

Every row from both sides appears. Unmatched rows are NULL-padded for the
missing side.

> **Memory hook:** "FULL OUTER JOIN reconciles both guest lists — RSVP'd-but-didn't-show, showed-without-RSVP, and the matched middle — nobody gets left off the report."

---

## 2. FULL OUTER JOIN in MySQL: The UNION Workaround

Here's the twist that trips up almost everyone coming from PostgreSQL or SQL Server: MySQL does NOT have a native `FULL OUTER JOIN` keyword. Type it and MySQL just throws a syntax error at you — there's no built-in way to say "give me both sides."

So how do you get the same result? You build it yourself, out of pieces you already know: LEFT JOIN and RIGHT JOIN. The idea is simple once you see it —

- A LEFT JOIN already gives you "all left rows + matched right rows" (left-only + inner region).
- A RIGHT JOIN already gives you "all right rows + matched left rows" (right-only + inner region).
- If you take the LEFT JOIN result, and then bolt on *only the right-only rows* from the RIGHT JOIN (filtering out the inner region so you don't duplicate it), you've reconstructed a full outer join.

That's the whole trick: LEFT JOIN, plus RIGHT JOIN filtered down to its unmatched rows, stuck together with `UNION ALL`.

```sql
-- Step 1: LEFT JOIN (all left rows + matched right rows)
SELECT c.id AS customer_id, c.name, o.id AS order_id
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id

UNION ALL

-- Step 2: RIGHT JOIN filtered to right-only rows (no left match)
SELECT c.id AS customer_id, c.name, o.id AS order_id
FROM customers c
RIGHT JOIN orders o ON c.id = o.customer_id
WHERE c.id IS NULL;
```

Notice it says `UNION ALL`, not plain `UNION`. That's not a stylistic choice — it's load-bearing. Here's why:

- `UNION` deduplicates rows. That means it has to sort/hash-compare every row against every other row before returning results — expensive, especially on large tables.
- `UNION ALL` just concatenates the two result sets, no dedup pass. That's fine here because we've *already* engineered the two branches to never overlap: the first branch is left+inner, the second is filtered down to right-only via `WHERE c.id IS NULL`. There is nothing left to deduplicate.
- If you used plain `UNION` here, you'd pay for a dedup scan that accomplishes nothing — pure wasted cost. Worse, in slightly different formulations, `UNION` can silently drop rows that are legitimately identical (e.g., two separate customers who happen to have identical name + order values), which is a correctness bug, not just a performance one.

So the rule of thumb: when emulating FULL OUTER JOIN, always reach for `UNION ALL` and make sure your `WHERE ... IS NULL` filter is doing the work of preventing overlap.

Alternatively, expressed entirely with LEFT JOINs:

```sql
-- Left-only rows:
SELECT c.id, c.name, NULL AS order_id
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE o.id IS NULL

UNION ALL

-- All matched rows (inner region):
SELECT c.id, c.name, o.id AS order_id
FROM customers c
JOIN orders o ON c.id = o.customer_id

UNION ALL

-- Right-only rows:
SELECT NULL AS customer_id, NULL AS name, o.id AS order_id
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
WHERE c.id IS NULL;
```

**UNION vs UNION ALL, side by side:**

| | `UNION` | `UNION ALL` |
|---|---|---|
| Deduplicates rows | Yes (sort/hash + compare) | No — just concatenates |
| Performance on large tables | Slower — extra dedup pass | Faster — no dedup pass |
| Safe for FULL OUTER emulation? | Wasteful, and risks dropping legitimately-identical rows | Correct, *as long as* branches don't overlap |
| When to actually use `UNION` | You genuinely need distinct rows from unrelated queries | — |

**Interview answer:** "MySQL has no native FULL OUTER JOIN. The standard workaround combines a LEFT JOIN (all left rows + matches) with a RIGHT JOIN filtered to its unmatched rows only, glued together with UNION ALL rather than UNION — because the two branches are engineered not to overlap, so a dedup pass would only add cost, and in some formulations could even hide legitimately duplicate data."

---

## 3. ASCII Diagram: FULL OUTER JOIN

```
    Left table (customers)          Right table (orders)
 ┌────────────────────────┐      ┌────────────────────────┐
 │                        │      │                        │
 │  Carol  (left-only)    │      │  order 5  (right-only) │
 │  Dave   (left-only)    │      │  (no customer match)   │
 │              ┌─────────┴──────┴─────────┐              │
 │              │    INNER REGION          │              │
 │              │   Alice + orders 1,2     │              │
 │              │   Bob   + orders 3,4     │              │
 │              └─────────┬──────┬─────────┘              │
 │                        │      │                        │
 └────────────────────────┘      └────────────────────────┘

 FULL OUTER JOIN = entire left circle + entire right circle
 LEFT JOIN       = entire left circle only
 RIGHT JOIN      = entire right circle only
 INNER JOIN      = overlap region only
```

---

## 4. CROSS JOIN — Cartesian Product

Say you sell t-shirts in 4 sizes and 4 colours, and you need to generate every possible SKU combination (S-Red, S-Blue, M-Red, M-Blue...) so you can pre-create inventory rows for each variant. There's no "matching" logic here at all — you don't want rows that share a common column, you want *every combination*, full stop.

That's what CROSS JOIN is for. Think of it like a restaurant's prix-fixe menu: 3 starters × 4 mains × 2 desserts = 24 possible meal combinations, whether or not anyone's ever actually ordered that particular combo. You're generating the full combinatorial space, not matching existing pairs.

**CROSS JOIN** pairs every row from the left table with every row from the right
table. There is no ON condition — every combination is produced.

```
Table A (sizes)     Table B (colours)     CROSS JOIN result
───────────────     ─────────────────     ──────────────────────
S                   Red                   S  | Red
M                   Blue                  S  | Blue
L                   Green                 M  | Red
                                          M  | Blue
                                          L  | Red
                                          L  | Blue
Result rows = 3 × 3 = 9
```

Syntax:

```sql
-- Explicit CROSS JOIN keyword:
SELECT s.size, c.colour
FROM sizes  s
CROSS JOIN colours c;

-- Implicit (comma-separated, no ON — same result):
SELECT s.size, c.colour
FROM sizes s, colours c;
```

Row count = rows(left) × rows(right). Be careful:
- 1,000 rows × 1,000 rows = 1,000,000 rows
- 10,000 × 10,000 = 100,000,000 rows — never run this casually

**CROSS JOIN vs "JOIN with no condition" vs INNER JOIN:**

| | CROSS JOIN | `JOIN ... ON 1=1` | INNER JOIN (normal) |
|---|---|---|---|
| Result | Every combination (Cartesian product) | Same as CROSS JOIN — identical result | Only rows matching the ON condition |
| Intent signalled | Explicit — "I meant to do this" | Looks like a bug at a glance | Explicit — "match these on a real relationship" |
| Row count | rows(left) × rows(right) | rows(left) × rows(right) | ≤ rows(left) × rows(right), usually far fewer |

`CROSS JOIN` and `JOIN ON 1=1` produce byte-for-byte identical results — the only difference is readability. Writing `CROSS JOIN` tells the next reader "yes, I want every combination, this is deliberate." Writing `JOIN ON 1=1` looks like someone forgot to finish the query.

> **Memory hook:** "CROSS JOIN is a restaurant's prix-fixe menu — every starter with every main with every dessert, whether or not anyone's ordered that combo yet."

---

## 5. CROSS JOIN Use Cases

CROSS JOIN is intentional and useful in specific scenarios:

### 5a. Generate all product-size combinations

```sql
CREATE TABLE sizes   (size   VARCHAR(5));
CREATE TABLE colours (colour VARCHAR(20));

INSERT INTO sizes   VALUES ('S'),('M'),('L'),('XL');
INSERT INTO colours VALUES ('Red'),('Blue'),('Green'),('Black');

-- Generate all 16 SKU combinations:
SELECT
    CONCAT(s.size, '-', c.colour) AS sku,
    s.size,
    c.colour
FROM sizes   s
CROSS JOIN colours c
ORDER BY s.size, c.colour;
```

### 5b. Fill in missing dates in a sparse time series

```sql
-- Generate every date in a range (using a numbers table trick):
CREATE TABLE numbers (n INT);
INSERT INTO numbers VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9);

SELECT
    DATE_ADD('2024-05-01', INTERVAL (tens.n * 10 + units.n) DAY) AS date_val
FROM numbers tens
CROSS JOIN numbers units
WHERE DATE_ADD('2024-05-01', INTERVAL (tens.n * 10 + units.n) DAY) <= '2024-05-31'
ORDER BY date_val;
```

Then LEFT JOIN your actual data to this date series to show gaps as NULLs.

### 5c. Pair every employee with every project (assignment matrix)

```sql
SELECT e.name AS employee, p.name AS project
FROM employees e
CROSS JOIN projects p
ORDER BY e.name, p.name;
```

Then check which combinations are missing from an `assignments` table using
an anti-join.

---

## 6. SELF JOIN — A Table Joined to Itself

Here's a question every `employees` table eventually needs answered: "who does this person report to?" The manager is just... another employee. Same table, same columns, same shape — just a different row.

So how do you join a table to information that lives in that *same* table? You can't write `FROM employees JOIN employees` — MySQL has no idea which "employees" you mean in the SELECT list, they'd both be called the same thing.

**Analogy:** think of a company org chart. Every person's "manager" box points to another person's box on the exact same chart — not to some separate "managers" chart. You compare rows against other rows of the identical structure, using the relationship each row already has to another row.

The trick is to pretend the table is two separate tables by giving it two different aliases in the same query. MySQL doesn't actually copy any data — it just scans the same table twice, once under each alias, and lets you treat them as if they were unrelated.

A **SELF JOIN** references the same table twice in the same query, using two
different aliases to distinguish the two "instances."

The table is not physically duplicated — the same table is accessed twice with
different roles. MySQL handles this transparently.

**How MySQL actually handles this internally:**

```
Query: FROM employees e JOIN employees m ON e.manager_id = m.id

MySQL's execution plan treats "e" and "m" as two independent
scan/lookup targets pointing at the SAME physical table:

   employees (physical table, on disk)
        │
        ├── scanned/looked-up AS alias "e"  (the "employee" role)
        │
        └── scanned/looked-up AS alias "m"  (the "manager" role)

For each row read as "e", MySQL looks up the matching row
in the SAME table (read as "m") where m.id = e.manager_id.

No duplication of data — just two labeled "views" onto one table,
so the join engine can tell them apart column-by-column.
```

This is exactly why the alias is mandatory here — without `e` and `m` labeling the two roles, `SELECT name` would be ambiguous: name of who, the employee or the manager?

Syntax:

```sql
SELECT
    a.column_x,
    b.column_y
FROM some_table a
JOIN some_table b ON a.fk_to_self = b.pk;
```

The most classic use case is a hierarchical (adjacency list) table:

```
employees
┌────┬───────────┬────────────┐
│ id │ name      │ manager_id │
├────┼───────────┼────────────┤
│  1 │ CEO       │   NULL     │
│  2 │ Alice     │    1       │
│  3 │ Bob       │    1       │
│  4 │ Carol     │    2       │
│  5 │ Dave      │    2       │
│  6 │ Eve       │    3       │
└────┴───────────┴────────────┘

Hierarchy:
CEO (1)
├── Alice (2)
│   ├── Carol (4)
│   └── Dave  (5)
└── Bob   (3)
    └── Eve   (6)
```

> **Memory hook:** "A SELF JOIN is an org chart looking at itself — every employee's manager is just another row in the same table, so you scan it twice and wear two different name tags."

---

## 7. SELF JOIN: Employee Hierarchy Example

Let's make this concrete with real data. The `employees` table below stores each person alongside their `manager_id` — which just points back at another `id` in the same table. That single self-referencing column is all a SELF JOIN needs.

```sql
CREATE TABLE employees (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    department VARCHAR(50),
    salary     DECIMAL(10,2),
    manager_id INT NULL,
    FOREIGN KEY (manager_id) REFERENCES employees(id)
);

INSERT INTO employees VALUES
(1,'CEO',       'Executive', 500000.00, NULL),
(2,'Alice',     'Engineering',120000.00, 1),
(3,'Bob',       'Engineering', 95000.00, 1),
(4,'Carol',     'Engineering', 85000.00, 2),
(5,'Dave',      'Engineering', 80000.00, 2),
(6,'Eve',       'Engineering', 78000.00, 3);
```

### 7a. Show each employee with their manager's name

```sql
SELECT
    e.name       AS employee,
    m.name       AS manager,
    e.department,
    e.salary
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id
ORDER BY m.name, e.name;
```

```
┌──────────┬──────────┬─────────────┬───────────┐
│ employee │ manager  │ department  │ salary    │
├──────────┼──────────┼─────────────┼───────────┤
│ CEO      │  NULL    │ Executive   │ 500000.00 │
│ Alice    │ CEO      │ Engineering │ 120000.00 │
│ Bob      │ CEO      │ Engineering │  95000.00 │
│ Carol    │ Alice    │ Engineering │  85000.00 │
│ Dave     │ Alice    │ Engineering │  80000.00 │
│ Eve      │ Bob      │ Engineering │  78000.00 │
└──────────┴──────────┴─────────────┴───────────┘
```

LEFT JOIN is used so the CEO (no manager) still appears with NULL for manager. If you'd used a plain INNER self-join here, the CEO would silently vanish from the results — same "quiet data loss" trap as any other INNER JOIN.

**LEFT self-join vs INNER self-join — which one do you want?**

| | LEFT JOIN (self) | INNER JOIN (self) |
|---|---|---|
| Top-of-hierarchy row (no manager) | Kept, with NULL manager | Dropped silently |
| Use when | You need every row, matched or not (7a) | You only care about rows that *do* have a match (7b) |

### 7b. Find all employees who earn more than their manager

```sql
SELECT
    e.name   AS employee,
    e.salary AS emp_salary,
    m.name   AS manager,
    m.salary AS mgr_salary
FROM employees e
JOIN employees m ON e.manager_id = m.id
WHERE e.salary > m.salary;
```

### 7c. Find all pairs of employees in the same department

```sql
SELECT
    a.name AS employee_1,
    b.name AS employee_2,
    a.department
FROM employees a
JOIN employees b ON a.department = b.department
                AND a.id < b.id   -- prevents (Alice,Bob) AND (Bob,Alice) duplicates
ORDER BY a.department, a.name;
```

The `a.id < b.id` condition is a classic self-join trick to avoid duplicate
pairs and a row being paired with itself.

Why does this work? Without it, the join would happily produce (Alice, Bob) *and* (Bob, Alice) as two separate rows — same pair, just mirrored — plus it would pair Alice with herself. Requiring `a.id < b.id` forces exactly one direction: only keep the pairing where the first alias has the smaller id. That single inequality does two jobs at once: it drops self-pairs (a row can never have an id less than its own id) and it drops the mirrored duplicate.

**Interview answer:** "A SELF JOIN references the same table twice under different aliases, so you can compare rows in a table against other rows in that same table — the classic example being an employee-manager hierarchy, where `manager_id` on one row points to the `id` of another row in the exact same table. Use LEFT JOIN when top-level rows (like a CEO with no manager) must still appear; use INNER JOIN when you only want rows that have a genuine match. When comparing every row to every other row (duplicate detection, same-department pairs), add `a.id < b.id` to the ON clause to avoid both self-pairing and mirrored duplicates."

---

## 8. SELF JOIN: Other Use Cases

The employee/manager pattern is the classic self-join example, but it's far from the only one. Anywhere you need to compare a row against another row in the *same* table, a self-join is the tool.

### 8a. Find duplicate emails in a users table

```sql
SELECT a.email, a.id AS id1, b.id AS id2
FROM users a
JOIN users b ON a.email = b.email
            AND a.id    < b.id;
```

### 8b. Consecutive record comparison (previous row)

```sql
-- Compare each order's total to the previous order (by date) for same customer:
SELECT
    curr.id             AS order_id,
    curr.customer_id,
    curr.order_date,
    curr.total,
    prev.total          AS prev_total,
    curr.total - COALESCE(prev.total, 0) AS delta
FROM orders curr
LEFT JOIN orders prev
    ON  curr.customer_id = prev.customer_id
    AND prev.order_date  = (
        SELECT MAX(order_date)
        FROM orders
        WHERE customer_id = curr.customer_id
          AND order_date  < curr.order_date
    )
ORDER BY curr.customer_id, curr.order_date;
```

Note: Window functions (LAG) are more elegant for this — but self-join
demonstrates the concept without window function support.

### 8c. Three-level hierarchy (grandparent)

```sql
-- Employee → Manager → Director (two levels up)
SELECT
    e.name       AS employee,
    m.name       AS manager,
    d.name       AS director
FROM employees e
JOIN employees m ON e.manager_id = m.id
JOIN employees d ON m.manager_id = d.id;
```

---

## 9. NATURAL JOIN — Implicit Join (Avoid)

NATURAL JOIN automatically joins on ALL columns with the same name in both
tables. No ON clause is written — the database infers the condition.

```sql
-- NATURAL JOIN (avoid in production):
SELECT * FROM customers NATURAL JOIN orders;
-- Internally becomes: ON customers.id = orders.id AND customers.name = orders.name
-- (any column with the same name in both tables is used!)
```

Why avoid NATURAL JOIN:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Problem 1: Silent schema dependency                                  │
│   Adding a column with the same name to either table changes the     │
│   join condition without any warning or error.                       │
├──────────────────────────────────────────────────────────────────────┤
│ Problem 2: Unpredictable behaviour                                   │
│   Columns like `updated_at`, `created_by`, `status` commonly exist  │
│   in multiple tables. NATURAL JOIN silently adds them to the ON.     │
├──────────────────────────────────────────────────────────────────────┤
│ Problem 3: Hard to read                                              │
│   The join condition is invisible — you must inspect both table      │
│   schemas to understand what the query is doing.                     │
└──────────────────────────────────────────────────────────────────────┘
```

Always write explicit ON or USING clauses. NATURAL JOIN is a maintenance hazard.

---

## 10. Full Example Schema

(Extended schema for this phase's examples.)

```sql
-- From previous phases:
-- customers, products, orders, order_items

-- Additional for this phase:
CREATE TABLE employees (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    department VARCHAR(50),
    salary     DECIMAL(10,2),
    manager_id INT NULL,
    FOREIGN KEY (manager_id) REFERENCES employees(id)
);

CREATE TABLE sizes (
    id   INT PRIMARY KEY AUTO_INCREMENT,
    size VARCHAR(5) NOT NULL
);

CREATE TABLE colours (
    id     INT PRIMARY KEY AUTO_INCREMENT,
    colour VARCHAR(30) NOT NULL
);

INSERT INTO sizes   VALUES (1,'S'),(2,'M'),(3,'L'),(4,'XL');
INSERT INTO colours VALUES (1,'Red'),(2,'Blue'),(3,'Green'),(4,'Black');
```

---

## 11. JOIN Performance Deep Dive

Understanding how MySQL executes joins is essential for writing fast queries
on large tables.

### The Nested Loop Join (NLJ) Algorithm

```
for each row outer_row in outer_table:       -- O(n) full scan
    find matching rows in inner_table         -- O(log m) with index
    emit (outer_row, inner_row) combined
```

```
┌────────────────────────────────────────────────────────────────────┐
│ With index on inner table join column:                             │
│   Cost ≈ n × log(m)   -- very fast for n=1000, m=1,000,000       │
├────────────────────────────────────────────────────────────────────┤
│ Without index on inner table:                                      │
│   Cost ≈ n × m        -- catastrophically slow                    │
└────────────────────────────────────────────────────────────────────┘
```

### Block Nested Loop Join (BNL)

When no index is available, MySQL uses BNL: it reads a block of outer rows
into a join buffer, then scans the inner table once per buffer rather than
once per row. Reduces I/O but still O(n×m) in row operations.

MySQL 8.0.20+ replaced BNL with **Hash Join** for equal-join conditions
without indexes — much faster for large tables:

```
Hash join:
1. Build a hash table from the smaller table's join keys
2. Scan larger table, probe hash table for each row
Cost: O(n + m) instead of O(n × m)
```

### Index Merge and MRR

- **MRR (Multi-Range Read)**: MySQL batches index lookups and reads rows in
  primary key order to reduce random I/O
- **Index Merge**: uses multiple indexes on the same table and merges results

### When is JOIN performance critical?

```
Table size thresholds (approximate, depends on hardware):
< 10,000 rows    → almost always fast, index barely matters
10,000–1M rows   → index on join column is important
> 1M rows        → index required, also consider partitioning, covering index
> 10M rows       → denormalisation or caching may be needed
```

---

## 12. EXPLAIN Output for JOINs

Use EXPLAIN (or EXPLAIN ANALYZE in MySQL 8+) to see the join execution plan:

```sql
EXPLAIN SELECT c.name, o.id, oi.quantity, p.name
FROM customers   c
JOIN orders      o  ON c.id        = o.customer_id
JOIN order_items oi ON o.id        = oi.order_id
JOIN products    p  ON oi.product_id = p.id;
```

Sample EXPLAIN output:

```
+----+------+-------+--------+-------------------+-------------------+---------+
| id | type | table | rows   | key               | ref               | Extra   |
+----+------+-------+--------+-------------------+-------------------+---------+
|  1 | ALL  | c     |      4 | NULL              | NULL              |         |
|  1 | ref  | o     |      1 | idx_orders_cid    | ecommerce.c.id    |         |
|  1 | ref  | oi    |      2 | idx_oi_order_id   | ecommerce.o.id    |         |
|  1 | eq_ref| p    |      1 | PRIMARY           | ecommerce.oi.pid  |         |
+----+------+-------+--------+-------------------+-------------------+---------+
```

### Interpreting the `type` column

```
┌──────────┬──────────────────────────────────────────────────────────────────┐
│ type     │ Meaning                                                          │
├──────────┼──────────────────────────────────────────────────────────────────┤
│ system   │ Table has 0 or 1 rows — trivial (best)                          │
│ const    │ At most one matching row; used for PK/unique = constant          │
│ eq_ref   │ Exactly one row matched per outer row; uses unique/PK index      │
│ ref      │ Multiple rows may match; uses a non-unique index                 │
│ range    │ Index range scan (BETWEEN, <, >, IN list)                       │
│ index    │ Full index scan (all index entries read; better than ALL)        │
│ ALL      │ Full table scan — no index used (investigate!)                  │
└──────────┴──────────────────────────────────────────────────────────────────┘
```

Goal: `eq_ref` or `ref` on all joined (inner) tables. `ALL` on a large inner
table signals a missing index.

### EXPLAIN ANALYZE (MySQL 8+)

```sql
EXPLAIN ANALYZE SELECT c.name, o.id
FROM customers c
JOIN orders o ON c.id = o.customer_id;
```

Returns actual row counts and timing, not just estimates. Use to validate
that EXPLAIN estimates match reality.

---

## 13. Index Strategy for JOINs

### Rule: always index the foreign key column

```sql
-- Standard 1:N relationship setup:
CREATE TABLE orders (
    id          INT PRIMARY KEY,
    customer_id INT NOT NULL,
    ...
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- MySQL does NOT auto-create an index on FK columns!
-- You MUST add it explicitly:
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
```

### Which side to index?

```
1:N relationship: customers (1) ←── orders (N)

JOIN condition: customers.id = orders.customer_id

Index needed:
  customers.id      → Already indexed (PK)
  orders.customer_id → YOU must add this index
```

For N:M via a junction table:

```sql
-- order_items joins to both orders and products
CREATE INDEX idx_oi_order_id   ON order_items(order_id);
CREATE INDEX idx_oi_product_id ON order_items(product_id);
```

### Covering index for JOIN + SELECT

If your SELECT only needs columns already in the index, MySQL avoids reading
the actual row data (index-only scan):

```sql
-- If you only need customer_id and order_date:
CREATE INDEX idx_orders_cid_date ON orders(customer_id, order_date);

SELECT o.customer_id, o.order_date
FROM orders o
WHERE o.customer_id = 1;
-- MySQL can satisfy this entirely from the index
```

---

## 14. Join Order and the Optimizer

MySQL's query optimizer (cost-based) determines the actual join order at
execution time, regardless of the order you write the tables.

```
You write:  FROM a JOIN b JOIN c
Optimizer might execute as: b → a → c  (if b is small and indexed)
```

The optimizer's goal: minimise the total number of row lookups. It tries each
permutation (or uses heuristics for many tables) and picks the cheapest plan.

### Forcing join order (use sparingly)

```sql
-- STRAIGHT_JOIN keyword forces the written order:
SELECT /*+ JOIN_ORDER(c, o, oi, p) */ ...  -- optimizer hint (MySQL 8+)

SELECT c.name, o.id
FROM customers c
STRAIGHT_JOIN orders o ON c.id = o.customer_id;
```

Only override the optimizer when you have proof from EXPLAIN that it is
choosing a bad plan.

### JOIN_BUFFER_SIZE

The buffer used for BNL joins. Increasing it can help if you see "Using join
buffer (Block Nested Loop)" in EXPLAIN Extra:

```sql
SET SESSION join_buffer_size = 4 * 1024 * 1024;  -- 4 MB
```

---

## 15. Common Mistakes

### Mistake 1: CROSS JOIN by accident (missing ON)

```sql
-- BUG: produces n × m rows
SELECT * FROM customers c JOIN orders o;

-- Fix:
SELECT * FROM customers c JOIN orders o ON c.id = o.customer_id;
```

### Mistake 2: NATURAL JOIN in production

```sql
-- BUG: depends on schema column names — fragile
SELECT * FROM customers NATURAL JOIN orders;

-- Fix: always write explicit ON or USING
SELECT * FROM customers c JOIN orders o USING (id);
```

### Mistake 3: SELF JOIN forgetting the a.id < b.id deduplication trick

```sql
-- BUG: every pair (Alice, Bob) AND (Bob, Alice) both appear
SELECT a.name, b.name FROM employees a JOIN employees b
ON a.department = b.department AND a.id != b.id;

-- Fix:
SELECT a.name, b.name FROM employees a JOIN employees b
ON a.department = b.department AND a.id < b.id;
```

### Mistake 4: FULL OUTER workaround with UNION instead of UNION ALL

```sql
-- BUG: UNION deduplicates inner region rows (wrong) + slow
SELECT ... FROM a LEFT JOIN b ...
UNION
SELECT ... FROM a RIGHT JOIN b WHERE a.id IS NULL;

-- Fix: use UNION ALL with proper filtering to avoid overlap
SELECT ... FROM a LEFT JOIN b ...
UNION ALL
SELECT ... FROM a RIGHT JOIN b ON ... WHERE a.id IS NULL;
```

### Mistake 5: No index on FK column

```sql
-- Symptom: EXPLAIN shows type=ALL on the many-side table
-- Fix:
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
```

---

## 16. Hands-On Exercises

**Exercise 1**
Using the UNION-based FULL OUTER JOIN workaround, write a query that shows all
customers and all orders side by side, including customers with no orders AND
any hypothetical orders with no customer (orphaned orders). Use the standard
schema with an extra orphaned order inserted manually.

```sql
-- Setup: insert orphaned order (customer_id 99 does not exist):
INSERT INTO orders (id, customer_id, order_date, status)
VALUES (99, 99, '2024-06-15', 'pending');
-- Note: this will fail with FK constraint; disable FK check for demo:
SET FOREIGN_KEY_CHECKS = 0;
INSERT INTO orders VALUES (99, 99, '2024-06-15', 'pending');
SET FOREIGN_KEY_CHECKS = 1;

-- Full outer join workaround:
SELECT c.id AS cust_id, c.name, o.id AS order_id, o.order_date
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id

UNION ALL

SELECT c.id, c.name, o.id, o.order_date
FROM customers c
RIGHT JOIN orders o ON c.id = o.customer_id
WHERE c.id IS NULL;
```

**Exercise 2**
Use a CROSS JOIN to generate a grid of all size/colour combinations from the
sizes and colours tables. Return size, colour, and a generated SKU string in
the format "M-Blue".

```sql
SELECT
    s.size,
    c.colour,
    CONCAT(s.size, '-', c.colour) AS sku
FROM sizes   s
CROSS JOIN colours c
ORDER BY s.size, c.colour;
```

**Exercise 3**
Write a SELF JOIN query on the employees table that returns each employee's
name, their direct manager's name, and their manager's manager's name
(two levels up). Employees at the top of the chain should show NULL.

```sql
SELECT
    e.name   AS employee,
    m.name   AS manager,
    d.name   AS director
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id
LEFT JOIN employees d ON m.manager_id = d.id
ORDER BY d.name, m.name, e.name;
```

**Exercise 4**
Find all pairs of employees who share the same department AND where one
earns at least 20% more than the other. Show both names, salaries, and
the percentage difference.

```sql
SELECT
    a.name                                        AS employee_1,
    a.salary                                      AS salary_1,
    b.name                                        AS employee_2,
    b.salary                                      AS salary_2,
    ROUND((a.salary - b.salary) / b.salary * 100, 1) AS pct_diff
FROM employees a
JOIN employees b ON a.department = b.department
                AND a.id < b.id
                AND a.salary >= b.salary * 1.2
ORDER BY pct_diff DESC;
```

**Exercise 5**
Run EXPLAIN on a four-table JOIN (customers → orders → order_items → products).
Identify which tables have type=ALL and add the missing indexes. Then re-run
EXPLAIN to verify improvement.

```sql
-- Step 1: check EXPLAIN
EXPLAIN
SELECT c.name, p.name, oi.quantity
FROM customers   c
JOIN orders      o  ON c.id        = o.customer_id
JOIN order_items oi ON o.id        = oi.order_id
JOIN products    p  ON oi.product_id = p.id;

-- Step 2: add missing indexes if needed
CREATE INDEX idx_orders_customer_id   ON orders(customer_id);
CREATE INDEX idx_oi_order_id          ON order_items(order_id);
CREATE INDEX idx_oi_product_id        ON order_items(product_id);

-- Step 3: re-run EXPLAIN and confirm type=ref or eq_ref on all joined tables
```

---

## 17. Interview Q&A

**Q1: Does MySQL support FULL OUTER JOIN natively?**
A: No. MySQL does not have FULL OUTER JOIN syntax. The standard workaround is
`LEFT JOIN UNION ALL RIGHT JOIN WHERE left.id IS NULL` to combine all left rows,
all inner rows, and all right-only rows without duplication.

**Q2: What is a CROSS JOIN and when is it useful?**
A: CROSS JOIN produces the Cartesian product — every row from the left table
paired with every row from the right. Result count = rows(left) × rows(right).
Useful for generating all combinations (SKU variants, date ranges, assignment
matrices). Dangerous on large tables due to explosive row counts.

**Q3: What is a SELF JOIN?**
A: A SELF JOIN is a table joined to itself using two different aliases. Used
for hierarchical data (employee/manager), finding duplicate rows, or comparing
adjacent rows. Classic pattern: `FROM employees e JOIN employees m ON e.manager_id = m.id`.

**Q4: How do you prevent duplicate pairs in a self-join?**
A: Add the condition `AND a.id < b.id` (or `a.id < b.id`) to the ON clause.
This ensures each pair (A, B) appears only once — when the first alias has
the smaller id.

**Q5: Why is NATURAL JOIN dangerous?**
A: NATURAL JOIN joins on ALL columns with matching names. Adding a new column
to either table can silently change the join condition, producing wrong results
without any error. Always use explicit ON or USING clauses.

**Q6: What join algorithm does MySQL use by default?**
A: Nested Loop Join (NLJ) when the inner table has an index on the join column.
Block Nested Loop (BNL) when no index is available (MySQL < 8.0.20). Hash Join
(MySQL 8.0.20+) for equi-joins without indexes — much faster than BNL.

**Q7: What does EXPLAIN's type=ALL mean in a JOIN?**
A: type=ALL means MySQL is doing a full table scan for that table on every
iteration of the outer loop — very slow for large tables. It usually means the
join column is not indexed. Add an index and re-run EXPLAIN to verify.

**Q8: What is the difference between eq_ref and ref in EXPLAIN?**
A: `eq_ref` = exactly one row matched per outer row (unique or primary key index).
`ref` = one or more rows may match per outer row (non-unique index). Both are
good; `eq_ref` is slightly more efficient.

**Q9: Does the written order of tables in a JOIN affect the result?**
A: For INNER JOIN, the result is the same regardless of written order (the
optimizer may reorder). For OUTER JOIN, written order affects which table is
"left" or "right", which determines which side's unmatched rows are preserved.

**Q10: How do you force MySQL to use a specific join order?**
A: Use the `STRAIGHT_JOIN` keyword (forces written order) or the `JOIN_ORDER`
optimizer hint in MySQL 8+. Only override the optimizer when EXPLAIN confirms
it is choosing a suboptimal plan.

**Q11: What indexes should you create for a many-to-many junction table?**
A: Index both foreign key columns. For `order_items(order_id, product_id)`:
create separate indexes on order_id and product_id, or a composite index
covering both query patterns. The primary key can also serve one direction.

**Q12: What is a covering index and how does it help JOINs?**
A: A covering index includes all columns needed by the query (SELECT, WHERE,
JOIN conditions) so MySQL can answer the query entirely from the index without
reading the actual table rows. Dramatically reduces I/O for large tables.

**Q13: How does CROSS JOIN differ from a JOIN with a always-true condition?**
A: They produce the same result. `CROSS JOIN` with no ON is equivalent to
`JOIN ON 1=1`. The CROSS JOIN keyword makes the intent explicit (deliberate
Cartesian product). Using `JOIN ON 1=1` looks like a mistake.

**Q14: What is the output of FULL OUTER JOIN for rows that match on both sides?**
A: Matched rows appear once with all columns populated from both tables —
same as INNER JOIN. The difference is that FULL OUTER also includes left-only
rows (right columns NULL) and right-only rows (left columns NULL).

**Q15: Can you SELF JOIN on a table that has no self-referential foreign key?**
A: Yes. A self-join just requires the same table referenced twice with different
aliases and any valid ON condition. Finding duplicate emails (`a.email = b.email
AND a.id < b.id`) or comparing rows within a group are common examples that
require no self-referential FK.

**Q16: How does Hash Join work in MySQL 8?**
A: For an equi-join with no index on the smaller table, MySQL builds an in-memory
hash table from the smaller table's join key column. It then scans the larger
table and probes the hash table for each row. Cost is O(n + m) rather than O(n × m),
making it dramatically faster than Block Nested Loop for large unindexed tables.

**Q17: What happens if you run a CROSS JOIN on two tables with 100,000 rows each?**
A: The result would be 10,000,000,000 (10 billion) rows — almost certainly
exhausting memory and disk. Always sanity-check cardinalities before running
CROSS JOIN. In production, CROSS JOINs are intentional and should only involve
small lookup tables (< a few thousand rows each).
