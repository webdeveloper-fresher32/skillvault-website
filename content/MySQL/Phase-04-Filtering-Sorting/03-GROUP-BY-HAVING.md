# 03 — GROUP BY and HAVING

> Aggregate rows into summaries. Filter on the summaries themselves.

---

## Table of Contents

1. [The Concept of GROUP BY](#1-the-concept-of-group-by)
2. [Aggregate Functions](#2-aggregate-functions)
3. [COUNT — Rows vs Non-NULL Values](#3-count--rows-vs-non-null-values)
4. [SUM, AVG, MIN, MAX](#4-sum-avg-min-max)
5. [HAVING — Filter After Aggregation](#5-having--filter-after-aggregation)
6. [HAVING vs WHERE — The Critical Distinction](#6-having-vs-where--the-critical-distinction)
7. [GROUP BY Multiple Columns](#7-group-by-multiple-columns)
8. [GROUP BY WITH ROLLUP](#8-group-by-with-rollup)
9. [ONLY_FULL_GROUP_BY Mode](#9-only_full_group_by-mode)
10. [Conditional Aggregation](#10-conditional-aggregation)
11. [Pivot Tables with Conditional Aggregation](#11-pivot-tables-with-conditional-aggregation)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. The Concept of GROUP BY

Here's a question every app eventually needs answered: "how many orders did
each customer place?" or "what's the average salary per department?"

Try answering that with plain WHERE filtering and you're stuck. WHERE can only
keep or throw away individual rows — it has no concept of "per customer" or
"per department." Writing one query per customer is not a real option once you
have more than a handful of them.

What you actually need is a way to say: "take all these rows, sort them into
piles based on some column, and give me one summary number per pile." That's
exactly what GROUP BY does — it collapses many rows into one output row per
unique combination of group values.

### Real-World Analogy

Picture a deck of cards dumped on the table. You want to know "how many cards
are in each suit?" You don't recount the pile after every single card — you
sort the whole deck into 4 piles (hearts, spades, clubs, diamonds) first, *then*
count each pile once. That sort-into-piles-then-count move is exactly what
GROUP BY does to your rows.

Or, sticking with something more classroom-shaped: imagine a teacher with 30
students across 3 classrooms. Without GROUP BY, you see all 30 individual
student records. With `GROUP BY classroom`, you see 3 rows — one per classroom —
each showing aggregated statistics like average grade.

```
┌──────────────────────────────────────────────────────────────┐
│  Raw data: 30 student rows                                   │
│  ┌────────┬───────────┬───────┐                             │
│  │student │ classroom │ grade │                             │
│  ├────────┼───────────┼───────┤                             │
│  │ Alice  │    A      │  92   │                             │
│  │ Bob    │    B      │  78   │                             │
│  │ Carol  │    A      │  88   │  ...30 rows                 │
│  └────────┴───────────┴───────┘                             │
│                                                              │
│  GROUP BY classroom → 3 output rows                         │
│  ┌───────────┬───────────────┬──────────┐                   │
│  │ classroom │ student_count │ avg_grade│                   │
│  ├───────────┼───────────────┼──────────┤                   │
│  │     A     │      10       │   87.4   │                   │
│  │     B     │      12       │   81.2   │                   │
│  │     C     │       8       │   90.1   │                   │
│  └───────────┴───────────────┴──────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

### Basic Syntax

```sql
SELECT   grouping_column, aggregate_function(...)
FROM     table_name
[WHERE   row_filter]
GROUP BY grouping_column
[HAVING  group_filter]
[ORDER BY ...]
[LIMIT   n];
```

### Simple Example

```sql
-- Count employees per department
SELECT department, COUNT(*) AS employee_count
FROM employees
GROUP BY department
ORDER BY employee_count DESC;
```

> **Memory hook:** GROUP BY is "sort the deck into piles, then count each pile" — one output row per pile, never per card.

---

## 2. Aggregate Functions

Once your rows are sorted into piles, you need something to do *with* each pile —
a count, a total, an average. That's what aggregate functions are for. MySQL's
built-in aggregate functions operate on a set of rows and return a single value.

| Function | Description | NULL handling |
|----------|-------------|---------------|
| `COUNT(*)` | Count all rows in group | Counts NULLs |
| `COUNT(col)` | Count non-NULL values | Skips NULLs |
| `COUNT(DISTINCT col)` | Count unique non-NULL values | Skips NULLs |
| `SUM(col)` | Sum of non-NULL values | Skips NULLs |
| `AVG(col)` | Average of non-NULL values | Skips NULLs |
| `MIN(col)` | Minimum non-NULL value | Skips NULLs |
| `MAX(col)` | Maximum non-NULL value | Skips NULLs |
| `GROUP_CONCAT(col)` | Concatenate values in group | Skips NULLs |

All aggregate functions (except COUNT(*)) **ignore NULL values** — this is a
fundamental and frequently tested behaviour.

---

## 3. COUNT — Rows vs Non-NULL Values

"Just use COUNT" sounds simple until you realize MySQL gives you three different
flavors of it, and they don't always agree with each other. The trap: `COUNT(*)`
counts rows, `COUNT(column)` counts values that aren't NULL. Mix them up and your
report is quietly wrong.

### COUNT(*) — Count Every Row

```sql
-- Total number of orders per customer (includes all rows regardless of NULLs)
SELECT customer_id, COUNT(*) AS total_orders
FROM orders
GROUP BY customer_id;
```

COUNT(*) counts rows, not values. Even a row of all NULLs is counted.

### COUNT(column) — Count Non-NULL Values

```sql
-- Count orders that have a shipping address (non-NULL shipped_to)
SELECT customer_id,
       COUNT(*)           AS total_orders,
       COUNT(shipped_to)  AS shipped_orders
FROM orders
GROUP BY customer_id;
```

If 5 orders have shipped_to = NULL, COUNT(*) = 10 but COUNT(shipped_to) = 5.

### COUNT(DISTINCT column)

```sql
-- How many distinct products has each customer ordered?
SELECT customer_id, COUNT(DISTINCT product_id) AS unique_products
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id
GROUP BY customer_id;
```

### Practical Comparison

```sql
SELECT
    department,
    COUNT(*)                        AS total_employees,
    COUNT(bonus)                    AS employees_with_bonus,
    COUNT(*) - COUNT(bonus)         AS employees_without_bonus,
    COUNT(DISTINCT job_title)       AS distinct_job_titles
FROM employees
GROUP BY department;
```

> **Memory hook:** COUNT(*) counts chairs in the room; COUNT(column) counts only the chairs someone is actually sitting in.

---

## 4. SUM, AVG, MIN, MAX

Beyond counting, you'll usually want totals, averages, and extremes per group —
total revenue per category, average salary per department, the cheapest and
priciest item in a catalog. Same GROUP BY machinery, different aggregate
function.

### SUM

```sql
-- Total revenue per product category
SELECT category, SUM(price * quantity) AS total_revenue
FROM order_items oi
JOIN products p ON oi.product_id = p.product_id
GROUP BY category
ORDER BY total_revenue DESC;
```

SUM returns NULL if all values in the group are NULL. Use COALESCE:

```sql
SELECT category, COALESCE(SUM(discount), 0) AS total_discount
FROM products
GROUP BY category;
```

### AVG

```sql
-- Average salary by department (NULLs skipped)
SELECT department, ROUND(AVG(salary), 2) AS avg_salary
FROM employees
GROUP BY department;
```

Trap: AVG skips NULLs, so it computes the average of available values only.
If some employees have NULL salary, the average may be misleadingly high.

```sql
-- Denominator includes NULL-salary employees (treating NULL as 0)
SELECT department,
       SUM(COALESCE(salary, 0)) / COUNT(*) AS avg_including_nulls
FROM employees
GROUP BY department;
```

### MIN and MAX

```sql
-- Earliest and latest order dates per customer
SELECT
    customer_id,
    MIN(order_date) AS first_order,
    MAX(order_date) AS latest_order,
    DATEDIFF(MAX(order_date), MIN(order_date)) AS days_active
FROM orders
GROUP BY customer_id;

-- Cheapest and most expensive product per category
SELECT category, MIN(price) AS min_price, MAX(price) AS max_price
FROM products
GROUP BY category;
```

### GROUP_CONCAT

Concatenates non-NULL string values within each group.

```sql
-- List all product names per category as a comma-separated string
SELECT category,
       GROUP_CONCAT(name ORDER BY name ASC SEPARATOR ', ') AS product_list
FROM products
GROUP BY category;
```

```sql
-- Limit total length (default max 1024 bytes)
SELECT customer_id,
       GROUP_CONCAT(DISTINCT tag ORDER BY tag SEPARATOR '|') AS tags
FROM customer_tags
GROUP BY customer_id;
```

> **Memory hook:** SUM, AVG, MIN, MAX all quietly skip NULLs — they average and total only what's actually there, never what's missing.

---

## 5. HAVING — Filter After Aggregation

Now suppose you've grouped employees by department and computed the headcount
per department — but you only care about departments with more than 5 people.
You can't do that with WHERE, because at the point WHERE runs, there's no
"headcount" yet — the grouping hasn't even happened. You need a filter that runs
*after* the grouping and aggregation are done. That's HAVING.

In short: WHERE filters rows before aggregation. HAVING filters groups after
aggregation. Section 6 digs into exactly why that distinction matters — for now,
let's just see HAVING in action.

### Basic HAVING

```sql
-- Only departments with more than 5 employees
SELECT department, COUNT(*) AS emp_count
FROM employees
GROUP BY department
HAVING emp_count > 5;

-- Or without alias (both work in MySQL)
HAVING COUNT(*) > 5;
```

### HAVING With Multiple Conditions

```sql
-- Departments with avg salary > 60,000 AND more than 3 employees
SELECT department,
       COUNT(*)    AS emp_count,
       AVG(salary) AS avg_salary
FROM employees
GROUP BY department
HAVING COUNT(*) > 3
   AND AVG(salary) > 60000
ORDER BY avg_salary DESC;
```

### HAVING With MIN/MAX

```sql
-- Products categories where the cheapest item still costs > $10
SELECT category, MIN(price) AS min_price
FROM products
GROUP BY category
HAVING MIN(price) > 10;

-- Categories with a price range (max - min) > $100
SELECT category,
       MIN(price) AS min_price,
       MAX(price) AS max_price,
       MAX(price) - MIN(price) AS price_range
FROM products
GROUP BY category
HAVING price_range > 100;
```

---

## 6. HAVING vs WHERE — The Critical Distinction

This is the single most-confused idea in this whole topic, and it comes up in
almost every SQL interview. So let's slow down.

**The problem it solves:** SQL needs two completely different kinds of
filtering. One kind operates on the raw, ungrouped data — "only look at active
employees." The other operates on the *result* of grouping — "only show
departments where the average salary is over $70,000." You literally cannot ask
the second question before grouping has happened, because "average salary" does
not exist until the rows have been collapsed into groups. WHERE and HAVING exist
because these two jobs happen at different points in time, on different kinds of
data.

**Analogy:** think back to the card-sorting example. WHERE is like deciding,
*before* you start sorting, "I'm only going to consider red cards" — you discard
blue cards from the deck up front. HAVING is like sorting the whole (already
filtered) deck into piles by rank, and *then* saying "only keep piles that have
more than 2 cards in them." One decision happens before the piles exist; the
other happens after.

**How MySQL actually processes a query** — the piece almost nobody visualizes
correctly:

```
┌──────────────────────────────────────────────────────────────┐
│  Query Execution Order                                       │
│                                                              │
│  FROM                                                        │
│    └── JOIN                                                  │
│          └── WHERE   ← filters INDIVIDUAL ROWS              │
│                └── GROUP BY  ← collapses rows into groups   │
│                      └── HAVING  ← filters GROUPS           │
│                            └── SELECT  ← projects columns   │
│                                  └── ORDER BY               │
│                                        └── LIMIT            │
└──────────────────────────────────────────────────────────────┘
```

Read that top to bottom and the whole confusion disappears: by the time HAVING
runs, GROUP BY has already collapsed the rows. There is no "row" left for HAVING
to look at — only groups, and whatever aggregate values were computed for them.
That's *why* HAVING can use `COUNT(*)`, `AVG(salary)`, and so on, while WHERE
cannot: at the point WHERE executes, those aggregates haven't been computed yet.
Try to put `AVG(salary) > 70000` in a WHERE clause and MySQL will refuse — there's
no average to check yet, because grouping hasn't happened.

### Side-by-Side Examples

**Scenario**: Find departments where the average salary of ACTIVE employees
exceeds $70,000.

```sql
-- WRONG: HAVING on active is inefficient — filters groups, not rows
SELECT department, AVG(salary) AS avg_salary
FROM employees
GROUP BY department
HAVING AVG(salary) > 70000
   AND status = 'active';   -- ERROR or unintended: status is not aggregated

-- CORRECT: Use WHERE to filter active employees BEFORE grouping
SELECT department, AVG(salary) AS avg_salary
FROM employees
WHERE status = 'active'          -- filter rows first
GROUP BY department
HAVING AVG(salary) > 70000;     -- then filter groups
```

Notice the "WRONG" query above isn't just inefficient — putting `status = 'active'`
in HAVING alongside an aggregate condition is a common source of bugs, because
`status` isn't one of the aggregated/grouped columns, so MySQL either errors out
or the result is not what you expect. Move it to WHERE and the query filters rows
*before* grouping even begins — cheaper, and correct.

### WHERE vs HAVING Decision Table

Keep this table pinned in your head — it settles the question every time:

| Question | Use |
|----------|-----|
| Filter on a raw column value? | WHERE |
| Filter on COUNT, SUM, AVG result? | HAVING |
| Filter before the group is formed? | WHERE |
| Filter on group size or statistics? | HAVING |
| Use an aggregate function in condition? | HAVING |

### Common Mistakes

- **Putting an aggregate condition in WHERE.** `WHERE COUNT(*) > 5` fails — WHERE
  runs before grouping, so no COUNT exists yet at that stage. That condition
  belongs in HAVING.
- **Putting a raw-column condition in HAVING when WHERE would do.** It's not
  always an error, but it's wasteful — MySQL groups and aggregates rows that
  WHERE could have thrown out earlier, doing more work than necessary.
- **Mixing an ungrouped, non-aggregated column into HAVING**, like `status` in
  the WRONG example above — MySQL has no single `status` value to check per
  group unless it's part of GROUP BY or wrapped in an aggregate.

### Interview Answer

If asked to explain this in an interview, here's the crisp version: *WHERE
filters individual rows before grouping happens and cannot reference aggregate
functions, because aggregation hasn't occurred yet at that stage of execution.
HAVING filters entire groups after GROUP BY has collapsed the rows and
aggregates have been computed, so it can reference COUNT, SUM, AVG, and friends.
Use WHERE to cut down rows early for a cheaper query; use HAVING only when the
condition genuinely depends on an aggregated result.*

> **Memory hook:** WHERE picks which cards go into the sorting — HAVING picks which piles survive after sorting.

### You Can Use Both Together

```sql
-- Active employees only (WHERE), then departments with >3 such employees (HAVING)
SELECT department,
       COUNT(*) AS active_count,
       AVG(salary) AS avg_salary
FROM employees
WHERE status = 'active'
  AND hire_date >= '2018-01-01'
GROUP BY department
HAVING COUNT(*) > 3
   AND AVG(salary) BETWEEN 50000 AND 120000
ORDER BY avg_salary DESC;
```

---

## 7. GROUP BY Multiple Columns

What if "per department" isn't specific enough — you actually want "per
department, per job title"? GROUP BY handles that too: it can take multiple
columns, giving you one output row per unique *combination* of all the grouping
columns.

```sql
-- Orders per year per month (every year-month combination)
SELECT
    YEAR(order_date)  AS order_year,
    MONTH(order_date) AS order_month,
    COUNT(*)          AS order_count,
    SUM(total)        AS monthly_revenue
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date)
ORDER BY order_year ASC, order_month ASC;
```

### Two-Dimension Grouping

```sql
-- Revenue per department per job title
SELECT
    department,
    job_title,
    COUNT(*)    AS headcount,
    AVG(salary) AS avg_salary
FROM employees
GROUP BY department, job_title
ORDER BY department, avg_salary DESC;
```

### Three-Dimension Grouping

```sql
-- Sales by region, category, and year
SELECT
    region,
    category,
    YEAR(sale_date) AS sale_year,
    SUM(amount)     AS total_sales
FROM sales
GROUP BY region, category, YEAR(sale_date)
ORDER BY region, category, sale_year;
```

### Grouping on Expressions

```sql
-- Group orders by quarter
SELECT
    YEAR(order_date)                   AS yr,
    QUARTER(order_date)                AS qtr,
    COUNT(*)                           AS order_count
FROM orders
GROUP BY YEAR(order_date), QUARTER(order_date)
ORDER BY yr, qtr;
```

---

## 8. GROUP BY WITH ROLLUP

Now imagine a manager looking at "total salary per department" who also wants a
grand total row at the bottom, the way a spreadsheet subtotal works. You could
compute that separately and stitch it on — or you could let MySQL do it for you
with `WITH ROLLUP`, which adds extra summary rows to the result: subtotals for
each group level, plus a grand total at the end.

### Basic ROLLUP

```sql
SELECT department, SUM(salary) AS total_salary
FROM employees
GROUP BY department WITH ROLLUP;
```

Output:

```
┌──────────────┬──────────────┐
│  department  │ total_salary │
├──────────────┼──────────────┤
│  Engineering │   450000.00  │
│  Marketing   │   280000.00  │
│  Sales       │   320000.00  │
│  NULL        │  1050000.00  │  ← grand total (ROLLUP row)
└──────────────┴──────────────┘
```

The NULL in the department column marks the ROLLUP (grand total) row.

### Multi-Level ROLLUP

```sql
SELECT
    region,
    department,
    SUM(salary) AS total_salary
FROM employees
GROUP BY region, department WITH ROLLUP;
```

Output structure:

```
┌──────────────┬──────────────┬──────────────┐
│  region      │ department   │ total_salary │
├──────────────┼──────────────┼──────────────┤
│  East        │ Engineering  │   220000.00  │
│  East        │ Sales        │   180000.00  │
│  East        │ NULL         │   400000.00  │  ← East subtotal
│  West        │ Engineering  │   230000.00  │
│  West        │ Marketing    │   280000.00  │
│  West        │ NULL         │   510000.00  │  ← West subtotal
│  NULL        │ NULL         │   910000.00  │  ← grand total
└──────────────┴──────────────┴──────────────┘
```

### GROUPING() — Detect ROLLUP Rows

GROUPING(col) returns 1 if that column's value is NULL due to ROLLUP (not a real
NULL), 0 otherwise.

```sql
SELECT
    IF(GROUPING(department), 'ALL DEPARTMENTS', department) AS dept_label,
    SUM(salary) AS total_salary
FROM employees
GROUP BY department WITH ROLLUP;
```

Output:

```
┌──────────────────┬──────────────┐
│  dept_label      │ total_salary │
├──────────────────┼──────────────┤
│  Engineering     │   450000.00  │
│  Marketing       │   280000.00  │
│  Sales           │   320000.00  │
│  ALL DEPARTMENTS │  1050000.00  │
└──────────────────┴──────────────┘
```

### ROLLUP With HAVING

```sql
-- Only show departments with total_salary > 300,000, plus grand total
SELECT
    IF(GROUPING(department), 'Grand Total', department) AS dept_label,
    SUM(salary) AS total_salary
FROM employees
GROUP BY department WITH ROLLUP
HAVING SUM(salary) > 300000 OR GROUPING(department) = 1;
```

> **Memory hook:** ROLLUP is the spreadsheet subtotal-and-grand-total row, generated for free — with a NULL flagging which rows are the summaries.

---

## 9. ONLY_FULL_GROUP_BY Mode

Here's a scenario that trips up almost everyone coming from another database (or
from an older MySQL version): you write `SELECT name, department, MAX(salary)
FROM employees GROUP BY department`, expecting it to just work — and MySQL
throws an error at you. Why?

**The problem this prevents:** think about what a "group" actually is. When you
`GROUP BY department`, every department becomes *one* output row, built from
potentially hundreds of underlying employee rows. If you also ask for `name` in
SELECT — a column that varies per employee, not per department — which
employee's name should MySQL show? There's no correct answer. Any choice MySQL
makes would be arbitrary and non-deterministic — the same query could return a
different name on different runs.

MySQL 5.7+ refuses to guess. It enables `ONLY_FULL_GROUP_BY` in the default SQL
mode, which enforces a simple rule: every column in SELECT must either

- be part of the GROUP BY clause (so it has exactly one value per group), or
- be wrapped in an aggregate function (so many values collapse into one), or
- be functionally dependent on the GROUP BY columns (more on this below).

If a column satisfies none of these, MySQL considers the query ambiguous and
rejects it outright, rather than silently returning a misleading result.

### What This Prevents

```sql
-- VIOLATES ONLY_FULL_GROUP_BY
SELECT name, department, MAX(salary)   -- 'name' is not in GROUP BY or aggregated
FROM employees
GROUP BY department;
-- Error: 'name' is not functionally dependent on columns in GROUP BY
```

The error prevents ambiguous results — MySQL cannot deterministically choose which
`name` to return for the group.

### Correct Forms

```sql
-- Option 1: Add name to GROUP BY
SELECT name, department, MAX(salary)
FROM employees
GROUP BY department, name;

-- Option 2: Aggregate name
SELECT GROUP_CONCAT(name) AS names, department, MAX(salary)
FROM employees
GROUP BY department;

-- Option 3: Use ANY_VALUE() to explicitly opt out (MySQL extension)
SELECT ANY_VALUE(name) AS sample_name, department, MAX(salary)
FROM employees
GROUP BY department;
```

### Functional Dependency Exception

Here's the one case where MySQL will let non-aggregated, non-grouped columns
through without complaint: when a column is *functionally determined* by the
GROUP BY column. The clearest example is a primary key — if you `GROUP BY
emp_id`, then every other column (`name`, `department`, `salary`, ...) is
guaranteed to have exactly one value per group, because `emp_id` is unique.
There's no ambiguity to worry about, so MySQL relaxes the rule.

```sql
-- emp_id is PRIMARY KEY — all columns are functionally dependent on it
SELECT emp_id, name, department, salary
FROM employees
GROUP BY emp_id;  -- valid under ONLY_FULL_GROUP_BY
```

### Check / Change SQL Mode

```sql
-- Check current mode
SELECT @@sql_mode;

-- Disable ONLY_FULL_GROUP_BY (not recommended for production)
SET SESSION sql_mode = REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', '');
```

### Common Mistakes

- **Selecting a non-grouped, non-aggregated column "because it worked in an old
  MySQL version."** Pre-5.7 MySQL silently allowed this and just picked an
  arbitrary row's value — which is exactly the non-deterministic behavior
  ONLY_FULL_GROUP_BY was introduced to stop. Don't rely on that old behavior.
- **Reaching for `SET sql_mode` to disable the check instead of fixing the
  query.** It "solves" the error message but reintroduces the original
  ambiguity — you'll get a value back, just not necessarily the one you meant.
- **Forgetting the functional-dependency exception exists**, and over-grouping
  by adding every selected column to GROUP BY even when grouping by the primary
  key alone would already make every other column unambiguous.

### Interview Answer

*In SQL, when you use GROUP BY, each output row represents an entire group of
input rows collapsed into one. Any column in SELECT must therefore either be
part of the GROUP BY clause — so it has a single, unique value per group — or be
wrapped in an aggregate function that computes one value from many. Without
ONLY_FULL_GROUP_BY, MySQL would pick an arbitrary, non-deterministic value for
any other column, which is misleading. MySQL 5.7+ enables ONLY_FULL_GROUP_BY by
default specifically to catch this class of bug at query time instead of
letting it silently return wrong answers.*

> **Memory hook:** if a column isn't in GROUP BY and isn't wrapped in an aggregate, MySQL has no idea *which* row's value you meant — so it refuses to guess.

---

## 10. Conditional Aggregation

Say you want completed, pending, and cancelled order counts for each customer —
all in the same result row. Running three separate GROUP BY queries and joining
them back together is wasteful. Conditional aggregation solves this: combine
aggregate functions with IF() or CASE to compute different aggregates based on
row conditions, all in a single pass over the data.

### SUM(IF(...)) Pattern

```sql
-- Count completed vs pending orders in one query
SELECT
    customer_id,
    COUNT(*)                          AS total_orders,
    SUM(IF(status = 'completed', 1, 0)) AS completed_orders,
    SUM(IF(status = 'pending',   1, 0)) AS pending_orders,
    SUM(IF(status = 'cancelled', 1, 0)) AS cancelled_orders
FROM orders
GROUP BY customer_id;
```

### SUM with CASE

```sql
-- Revenue breakdown by quarter
SELECT
    YEAR(order_date) AS yr,
    SUM(CASE WHEN QUARTER(order_date) = 1 THEN total ELSE 0 END) AS q1_revenue,
    SUM(CASE WHEN QUARTER(order_date) = 2 THEN total ELSE 0 END) AS q2_revenue,
    SUM(CASE WHEN QUARTER(order_date) = 3 THEN total ELSE 0 END) AS q3_revenue,
    SUM(CASE WHEN QUARTER(order_date) = 4 THEN total ELSE 0 END) AS q4_revenue,
    SUM(total)                                                   AS annual_revenue
FROM orders
GROUP BY YEAR(order_date)
ORDER BY yr;
```

### COUNT(IF(...)) vs SUM(IF(...))

Both work, but they are subtly different:

```sql
-- COUNT(IF(...)) — IF returns NULL when condition is false, COUNT skips NULLs
COUNT(IF(status = 'active', 1, NULL))

-- SUM(IF(...)) — IF returns 0 when condition is false, SUM adds 0
SUM(IF(status = 'active', 1, 0))
```

Both produce the same result for counting, but SUM is slightly more explicit and
works better when computing partial sums of non-binary values.

### AVG with Conditions

```sql
-- Average salary only for senior employees vs junior employees
SELECT
    department,
    AVG(CASE WHEN experience_years >= 5 THEN salary END) AS avg_senior_salary,
    AVG(CASE WHEN experience_years < 5  THEN salary END) AS avg_junior_salary
FROM employees
GROUP BY department;
```

CASE without ELSE returns NULL for non-matching rows, and AVG ignores NULLs —
so this naturally computes the average only for the matching subset.

---

## 11. Pivot Tables with Conditional Aggregation

Conditional aggregation's most useful trick: turning long, row-per-fact data
into a wide, spreadsheet-style cross-tabulation (a "pivot table") — entirely in
SQL, with no external tool needed.

### Source Data

```
┌──────────────┬──────────────┬────────┐
│  region      │  product     │ sales  │
├──────────────┼──────────────┼────────┤
│  North       │  Widget A    │  100   │
│  South       │  Widget A    │  150   │
│  North       │  Widget B    │  200   │
│  South       │  Widget B    │   80   │
└──────────────┴──────────────┴────────┘
```

### Desired Pivot Output

```
┌──────────────┬──────────┬──────────┐
│  product     │  North   │  South   │
├──────────────┼──────────┼──────────┤
│  Widget A    │   100    │   150    │
│  Widget B    │   200    │    80    │
└──────────────┴──────────┴──────────┘
```

### SQL Pivot Query

```sql
SELECT
    product,
    SUM(CASE WHEN region = 'North' THEN sales ELSE 0 END) AS North,
    SUM(CASE WHEN region = 'South' THEN sales ELSE 0 END) AS South
FROM regional_sales
GROUP BY product
ORDER BY product;
```

### Multi-Metric Pivot

```sql
-- Orders and revenue per status per department
SELECT
    department,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_count,
    SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) AS completed_revenue,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
    SUM(CASE WHEN status = 'pending' THEN total ELSE 0 END) AS pending_revenue
FROM orders o
JOIN employees e ON o.employee_id = e.emp_id
GROUP BY department;
```

---

## 12. Hands-On Exercises

Schema used:

```sql
CREATE TABLE orders (
    order_id    INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT,
    status      ENUM('pending','processing','shipped','delivered','cancelled'),
    total       DECIMAL(10,2),
    order_date  DATE,
    region      VARCHAR(50)
);

CREATE TABLE order_items (
    item_id     INT PRIMARY KEY AUTO_INCREMENT,
    order_id    INT,
    product_id  INT,
    quantity    INT,
    unit_price  DECIMAL(10,2)
);
```

### Exercise 1

Find the total number of orders and total revenue per customer. Only show
customers who have placed at least 3 orders and spent more than $500 in total.
Sort by total revenue descending.

```sql
SELECT
    customer_id,
    COUNT(*)    AS order_count,
    SUM(total)  AS total_spent
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 3
   AND SUM(total) > 500
ORDER BY total_spent DESC;
```

### Exercise 2

For each order status, calculate the count, average total, minimum total,
and maximum total. Exclude cancelled orders from the calculation. Show only
statuses where the average total exceeds $100.

```sql
SELECT
    status,
    COUNT(*)        AS order_count,
    ROUND(AVG(total), 2) AS avg_total,
    MIN(total)      AS min_total,
    MAX(total)      AS max_total
FROM orders
WHERE status != 'cancelled'
GROUP BY status
HAVING AVG(total) > 100
ORDER BY avg_total DESC;
```

### Exercise 3

Generate a monthly revenue report for 2024, showing total orders and total
revenue per month. Include a grand total row using WITH ROLLUP. Replace NULL
in the month column with 'ANNUAL TOTAL'.

```sql
SELECT
    IF(GROUPING(MONTH(order_date)), 'ANNUAL TOTAL', MONTH(order_date)) AS month,
    COUNT(*)   AS order_count,
    SUM(total) AS monthly_revenue
FROM orders
WHERE YEAR(order_date) = 2024
GROUP BY MONTH(order_date) WITH ROLLUP
ORDER BY GROUPING(MONTH(order_date)), MONTH(order_date);
```

### Exercise 4

Create a pivot table showing order counts per region (rows) broken down by
status: pending, processing, shipped, delivered in separate columns.

```sql
SELECT
    region,
    SUM(IF(status = 'pending',    1, 0)) AS pending,
    SUM(IF(status = 'processing', 1, 0)) AS processing,
    SUM(IF(status = 'shipped',    1, 0)) AS shipped,
    SUM(IF(status = 'delivered',  1, 0)) AS delivered
FROM orders
GROUP BY region
ORDER BY region;
```

### Exercise 5

Find the top 3 products (by total quantity sold) in each order status category
using a CTE and ROW_NUMBER() window function, combined with GROUP BY aggregation.

```sql
WITH product_status_sales AS (
    SELECT
        oi.product_id,
        o.status,
        SUM(oi.quantity) AS total_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    GROUP BY oi.product_id, o.status
),
ranked AS (
    SELECT
        product_id,
        status,
        total_qty,
        ROW_NUMBER() OVER (PARTITION BY status ORDER BY total_qty DESC) AS rn
    FROM product_status_sales
)
SELECT product_id, status, total_qty
FROM ranked
WHERE rn <= 3
ORDER BY status, rn;
```

---

## 13. Interview Q&A

**Q1. What is the difference between WHERE and HAVING?**

A: WHERE filters individual rows before they are grouped. HAVING filters groups
after aggregation. You cannot use aggregate functions (COUNT, SUM, AVG) in a
WHERE clause because aggregation has not happened yet. HAVING is evaluated after
GROUP BY, so it can reference aggregate results. Use WHERE for row-level conditions
on raw column values, and HAVING for conditions on group statistics.

---

**Q2. What is the difference between COUNT(*) and COUNT(column)?**

A: COUNT(*) counts every row in the group, including rows where all columns are
NULL. COUNT(column) counts only the rows where that specific column is non-NULL.
This distinction is critical — if a column has NULLs, COUNT(*) and COUNT(col)
will return different values. COUNT(DISTINCT col) further counts only unique
non-NULL values.

---

**Q3. Do aggregate functions ignore NULL values?**

A: Yes — all aggregate functions except COUNT(*) ignore NULL values. SUM(col)
adds only non-NULL values. AVG(col) divides the sum of non-NULL values by the
count of non-NULL values (not total rows). MIN/MAX skip NULLs. This can lead to
surprising results: if 8 out of 10 rows have NULL for a column, AVG is computed
over only 2 rows.

---

**Q4. Explain ONLY_FULL_GROUP_BY and why it exists.**

A: In SQL, when you use GROUP BY, each output row represents a group of input rows.
Any column in SELECT must be either part of the GROUP BY clause (so it has a unique
value per group) or wrapped in an aggregate function (computing one value from many).
ONLY_FULL_GROUP_BY enforces this rule. Without it, MySQL would pick an arbitrary
value for non-aggregated columns — which is non-deterministic and misleading.
MySQL 5.7+ enables this by default for correctness.

---

**Q5. What is WITH ROLLUP and how is it different from a regular GROUP BY?**

A: WITH ROLLUP is an extension that adds extra subtotal rows to the GROUP BY result.
For a single-column GROUP BY, it adds one grand total row (with NULL for the group
column). For multi-column GROUP BY, it adds one subtotal row per group level plus
a grand total row. GROUPING(col) can distinguish ROLLUP NULLs from genuine NULLs
in the data.

---

**Q6. What is conditional aggregation?**

A: Conditional aggregation applies aggregate functions to a subset of rows by
using IF() or CASE inside the aggregate. For example,
`SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END)` sums only completed
order totals. This technique allows computing multiple different aggregates from
the same table in a single query pass, which is far more efficient than multiple
separate queries or subqueries.

---

**Q7. How does AVG handle a column that has some NULL values?**

A: AVG ignores NULL values. It divides the sum of non-NULL values by the count of
non-NULL values. If a group has 10 rows and 3 have NULL salary, AVG(salary)
computes sum over the 7 non-NULL values divided by 7 — not 10. To include NULLs
as 0 in the average denominator, use `SUM(COALESCE(salary, 0)) / COUNT(*)`.

---

**Q8. Can you use a column alias defined in SELECT inside HAVING?**

A: In MySQL, yes — MySQL allows SELECT aliases in HAVING as an extension to
standard SQL (since MySQL 8.0 more broadly). Standard SQL requires repeating the
aggregate expression in HAVING. To write portable SQL, always use the full
aggregate expression in HAVING rather than the alias.

---

**Q9. What is the purpose of GROUP_CONCAT?**

A: GROUP_CONCAT concatenates non-NULL string values from multiple rows in a group
into a single comma-separated (or custom-separated) string. It is useful for
generating comma-separated tag lists, collecting product names per category, or
building denormalized data for reporting. The default maximum output length is 1024
bytes — increase `group_concat_max_len` for longer results.

---

**Q10. Can you GROUP BY an expression instead of a column?**

A: Yes. MySQL allows any deterministic expression in GROUP BY — function results,
arithmetic, and CASE expressions. For example, `GROUP BY YEAR(order_date)`,
`GROUP BY MONTH(created_at)`, `GROUP BY price_tier` (computed with CASE), or
`GROUP BY quantity * unit_price > 1000`. The same expression (or an alias) must
appear in SELECT.

---

**Q11. Write a query to find departments where no employee earns less than $50,000.**

A:
```sql
SELECT department
FROM employees
GROUP BY department
HAVING MIN(salary) >= 50000;
```
HAVING MIN(salary) >= 50000 ensures every employee in the group earns at least
$50,000 (the minimum is at least 50,000). An alternative: `HAVING COUNT(CASE WHEN salary < 50000 THEN 1 END) = 0`.

---

**Q12. What happens if you use ORDER BY inside a GROUP BY query?**

A: ORDER BY in a GROUP BY query sorts the final aggregated result set. It is
applied after all grouping and HAVING filtering is complete. You can ORDER BY
group columns or aggregate function results (or their aliases in MySQL). For
example, `ORDER BY COUNT(*) DESC` lists the largest groups first.

---

**Q13. Explain the pivot table technique using conditional aggregation.**

A: A pivot table transforms row data into columns. Since MySQL does not have a
native PIVOT keyword, you simulate it by grouping on the row identifier and using
`SUM(CASE WHEN category = 'X' THEN value ELSE 0 END)` as separate columns for
each category value. This requires knowing the category values in advance. For
dynamic pivot columns, you must build the SQL string programmatically
(e.g., in application code or a stored procedure using dynamic SQL).

---

**Q14. What is the performance impact of GROUP BY on large tables?**

A: GROUP BY requires MySQL to process all rows that pass WHERE, compute groups,
and then apply aggregates. Without an index that matches the GROUP BY columns,
MySQL uses a temporary table and filesort — both memory- and CPU-intensive for
large datasets. Creating an index on the GROUP BY column(s) allows MySQL to read
data in group order and avoid the sort step. Check EXPLAIN for "Using temporary;
Using filesort" as warning signs of expensive GROUP BY operations.

---

**Q15. How does ROLLUP handle NULL values in the data itself?**

A: ROLLUP uses NULL to mark the summary/subtotal rows it generates. If your data
also contains genuine NULLs in the group column, they are indistinguishable from
ROLLUP-generated NULLs when you look at the output. Use `GROUPING(col)` — it
returns 1 only for ROLLUP-generated NULLs, and 0 for genuine NULL data values.
This lets you label rollup rows correctly with IF(GROUPING(col), 'Total', col).
