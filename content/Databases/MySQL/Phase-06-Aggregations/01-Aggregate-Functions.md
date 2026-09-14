# 01 — Aggregate Functions

## Table of Contents

1. [What Is an Aggregate Function?](#1-what-is-an-aggregate-function)
2. [COUNT — Counting Rows and Values](#2-count--counting-rows-and-values)
3. [SUM and AVG — Totals and Averages](#3-sum-and-avg--totals-and-averages)
4. [MIN and MAX — Extremes](#4-min-and-max--extremes)
5. [NULL Handling — The Silent Killer](#5-null-handling--the-silent-killer)
6. [GROUP BY — Grouping Rows](#6-group-by--grouping-rows)
7. [HAVING — Filtering Groups](#7-having--filtering-groups)
8. [GROUP_CONCAT — Concatenating Group Values](#8-group_concat--concatenating-group-values)
9. [Bitwise Aggregates — BIT_AND, BIT_OR, BIT_XOR](#9-bitwise-aggregates--bit_and-bit_or-bit_xor)
10. [Conditional Aggregation — The Pivot Pattern](#10-conditional-aggregation--the-pivot-pattern)
11. [COALESCE with Aggregates](#11-coalesce-with-aggregates)
12. [Real-World Examples](#12-real-world-examples)
13. [Hands-On Exercises](#13-hands-on-exercises)
14. [Interview Q&A](#14-interview-qa)

---

## 1. What Is an Aggregate Function?

Here's the problem you keep running into: you have a thousand rows in an `orders` table, and someone asks "how much revenue did we make this month?" You don't want a thousand numbers back — you want *one* number. Nobody reads through a thousand rows by eye and adds them up.

That's exactly the gap an aggregate function fills. It takes a **pile of rows** and hands you back **one answer**.

Think of it like a blender. You drop a bunch of separate fruits in, and what comes out the other end isn't "fruits" anymore — it's a single smoothie:

```
┌─────────────────────────────────────────────┐
│  ROWS                                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │  10  │ │  20  │ │  30  │ │  40  │  -->  │  SUM = 100
│  └──────┘ └──────┘ └──────┘ └──────┘       │
└─────────────────────────────────────────────┘
```

Four separate rows go in, one number comes out. That's the whole idea — everything below is just different flavors of "blender."

Standard aggregate functions:

| Function | Returns |
|---|---|
| COUNT(*) | Number of rows |
| COUNT(col) | Number of non-NULL values in col |
| COUNT(DISTINCT col) | Number of unique non-NULL values |
| SUM(col) | Total of all non-NULL values |
| AVG(col) | Arithmetic mean of non-NULL values |
| MIN(col) | Smallest non-NULL value |
| MAX(col) | Largest non-NULL value |
| GROUP_CONCAT(col) | Concatenated string of group values |
| BIT_AND(col) | Bitwise AND across all values |
| BIT_OR(col) | Bitwise OR across all values |
| BIT_XOR(col) | Bitwise XOR across all values |

---

## 2. COUNT — Counting Rows and Values

### The problem COUNT solves

"How many orders do we have?" sounds like the simplest question in the world — until you realize it can mean three completely different things:

- How many orders exist, period (even the ones missing data)?
- How many orders actually *have* a shipping address filled in?
- How many *different* customers placed those orders?

MySQL gives you three tools for three different questions: `COUNT(*)`, `COUNT(col)`, and `COUNT(DISTINCT col)`. Mixing them up is one of the most common — and most interview-tested — mistakes in SQL.

### A real-world analogy

Imagine you're a teacher taking attendance.

- `COUNT(*)` is counting **every chair in the room**, occupied or not.
- `COUNT(col)` is counting **only the chairs with a student actually sitting in them** (empty chairs — NULLs — don't count).
- `COUNT(DISTINCT col)` is counting **how many different last names** are in the room, ignoring duplicates like two "Smith"s.

Same room, three different answers, depending on what you actually asked.

### COUNT(*) — Count Every Row

`COUNT(*)` counts **every row**, regardless of NULLs. It never ignores anything — it's just "how many rows did the FROM/WHERE clause hand me?"

```sql
-- Count all orders, including cancelled ones
SELECT COUNT(*) AS total_orders
FROM orders;
```

### COUNT(col) — Count Non-NULL Values

`COUNT(col)` counts only rows where `col` is **not NULL**. The moment you swap `*` for a column name, NULLs start getting silently skipped.

```sql
-- Count orders that have a shipping address filled in
SELECT COUNT(shipping_address) AS shipped_orders
FROM orders;
```

If 3 out of 10 rows have NULL in `shipping_address`, this returns 7 — not 10.

### COUNT(DISTINCT col) — Unique Values Only

Now stack a second filter on top: not just non-NULL, but non-duplicate too.

```sql
-- How many unique customers have placed at least one order?
SELECT COUNT(DISTINCT customer_id) AS unique_customers
FROM orders;
```

### How this actually works internally

Picture a column of ten values, where two are NULL and one repeats. Each COUNT variant walks the same list but applies a different rule about what "counts":

```
customer_id column: [1, 2, NULL, 3, 2, NULL, 4, 5, 1, 6]

COUNT(*)             sees every slot, blank or not     -> 10
COUNT(customer_id)   skips the NULL slots              -> 8   (1,2,3,2,4,5,1,6)
COUNT(DISTINCT ...)  skips NULLs, then also collapses
                     duplicate values (1 and 2 repeat)  -> 6   (1,2,3,4,5,6)
```

Same ten rows, three different "correct" answers — because they're answering three different questions.

### Example — Side-by-Side Comparison

```sql
SELECT
    COUNT(*)                       AS total_rows,
    COUNT(email)                   AS rows_with_email,
    COUNT(DISTINCT email)          AS unique_emails,
    COUNT(DISTINCT customer_id)    AS unique_customers
FROM orders;
```

```
┌─────────────┬──────────────────┬──────────────┬──────────────────┐
│ total_rows  │ rows_with_email  │ unique_emails│ unique_customers  │
├─────────────┼──────────────────┼──────────────┼──────────────────┤
│    1000     │      870         │     630      │       412        │
└─────────────┴──────────────────┴──────────────┴──────────────────┘
```

Notice how each number gets smaller as the question gets stricter: all rows (1000) → rows with data (870) → unique values among those (630).

### Compare at a glance

| Variant | Counts | Ignores NULLs? | Ignores duplicates? |
|---|---|---|---|
| `COUNT(*)` | Every row | No | No |
| `COUNT(col)` | Rows where `col` is not NULL | Yes | No |
| `COUNT(DISTINCT col)` | Unique non-NULL values | Yes | Yes |

### Common mistakes and confusions

- **Assuming `COUNT(col)` behaves like `COUNT(*)`.** It doesn't — swap in a column name and NULLs quietly vanish from the count. This is the #1 way people report the wrong "total rows" number.
- **The COUNT(\*) vs COUNT(1) myth.** People believe `COUNT(1)` is somehow faster than `COUNT(*)` because it "doesn't have to look at every column." This is a myth in MySQL — they are **functionally identical**, and the optimizer treats them the same way internally. Use `COUNT(*)` because it's the SQL standard and the most readable, not because of some imagined performance edge.
- **Forgetting DISTINCT applies to the whole expression, not just part of it.** `COUNT(DISTINCT customer_id)` counts distinct customer IDs — it has nothing to do with `email` or any other column in the same query unless you explicitly combine them.

### Interview answer

"`COUNT(*)` counts every row including NULLs, because it isn't looking at any particular column — it's just counting rows that survived the WHERE clause. `COUNT(col)` counts only the rows where that specific column is not NULL. `COUNT(DISTINCT col)` goes one step further and also collapses duplicate values, counting only unique non-NULL entries. They can return three different numbers from the exact same table, and picking the wrong one is a classic source of silently wrong reports."

> **Memory hook:** COUNT(*) counts chairs, COUNT(col) counts occupied chairs, COUNT(DISTINCT col) counts distinct last names in the room.

---

## 3. SUM and AVG — Totals and Averages

### The problem they solve

"What's our total revenue?" and "what's the average order size?" are two of the most-asked business questions there are, and nobody wants to answer them by exporting every row to a spreadsheet and adding manually. SUM and AVG do that arithmetic for you, inside the database, over however many rows match.

Think of SUM as a cash register running total at the end of a shift, and AVG as splitting a restaurant bill evenly — one adds everything up, the other adds everything up *and then divides* by how many people are paying.

### SUM

```sql
-- Total revenue for the current month
SELECT SUM(amount) AS monthly_revenue
FROM orders
WHERE MONTH(order_date) = MONTH(CURDATE())
  AND YEAR(order_date)  = YEAR(CURDATE());
```

Here's the part that trips people up: SUM ignores NULLs. If a column has NULLs, those rows simply don't contribute to the total — they're treated as "not there," not as zero.

### AVG

```sql
-- Average order value
SELECT AVG(amount) AS avg_order_value
FROM orders;
```

AVG also ignores NULLs. And this is where it gets genuinely dangerous: the average is computed over **non-NULL rows only**. If you have 10 rows and 3 of them are NULL, AVG divides by 7, not 10. That's correct if NULL means "we don't know this value" — but wrong if NULL actually means "zero, no purchase happened."

```sql
-- If NULL means 0, treat it that way
SELECT AVG(COALESCE(amount, 0)) AS avg_including_zero_orders
FROM orders;
```

### SUM + conditional — safe pattern

```sql
-- Total discount given only on orders above $100
SELECT SUM(CASE WHEN amount > 100 THEN discount ELSE 0 END) AS big_order_discounts
FROM orders;
```

### Compare at a glance

| Function | What it computes | NULL behavior |
|---|---|---|
| `SUM(col)` | Total of all values | Ignored — doesn't add, doesn't count toward denominator (there is no denominator) |
| `AVG(col)` | Sum ÷ count of non-NULL rows | Ignored on both sides of the division |
| `AVG(COALESCE(col, 0))` | Sum (NULLs treated as 0) ÷ count of **all** rows | NULLs become 0, and now count toward the denominator |

### Common mistakes and confusions

- **Assuming AVG divides by the total row count.** It doesn't — it divides by the count of non-NULL rows, which can quietly shrink your denominator and inflate the average.
- **Forgetting that SUM of an all-NULL group returns NULL, not 0.** If every row in a group has NULL in the target column, `SUM(col)` returns NULL — there's nothing to add up. This surprises people who expect "0 orders = $0."
- **Treating "no purchase" and "unknown amount" the same way.** These are semantically different, and only you (the business logic) know which one NULL represents in your table. Decide before you write the query, not after you see a suspicious number.

### Interview answer

"SUM and AVG both silently skip NULL values — they never treat a NULL as zero. SUM simply doesn't add NULLs into the total, and AVG excludes NULL rows from both the numerator and the denominator, so the average is computed over non-NULL rows only. If NULL is meant to represent zero in your business logic — like a customer who didn't buy anything — you have to explicitly wrap the column in `COALESCE(col, 0)` before aggregating, otherwise your average will be skewed higher than reality."

> **Memory hook:** SUM and AVG only ever look at the plates that have food on them — empty plates (NULLs) aren't counted, and they definitely aren't counted as "zero food."

---

## 4. MIN and MAX — Extremes

Sometimes you don't want a total or an average at all — you just want the extremes. "When was our very first order?" "What's the biggest order we've ever received?" That's exactly what MIN and MAX answer: the smallest and largest value in a column, full stop.

```sql
-- Earliest and latest order dates
SELECT
    MIN(order_date) AS first_order,
    MAX(order_date) AS last_order,
    MIN(amount)     AS smallest_order,
    MAX(amount)     AS largest_order
FROM orders;
```

They're not just for numbers — MIN and MAX work on strings too (alphabetical order) and dates (chronological order), same as sorting a list and grabbing the first and last item.

```sql
-- First and last customer names alphabetically
SELECT MIN(last_name), MAX(last_name)
FROM customers;
```

Like every other aggregate here, MIN and MAX simply skip NULLs when hunting for the smallest/largest value — a NULL can't be "smaller" or "larger" than anything, so it's excluded from consideration entirely.

---

## 5. NULL Handling — The Silent Killer

You've already seen NULL sneak into COUNT, SUM, and AVG individually. This section pulls it all together, because NULL handling is, hands down, the single most tested "gotcha" in SQL interviews — and the single most common source of a dashboard number that's quietly wrong. Worth seeing all the aggregates side by side on the exact same data, so there's no ambiguity left.

### NULLs Are Ignored by All Aggregates Except COUNT(*)

```sql
-- Sample data: scores table
-- id | student | score
-- 1  | Alice   | 90
-- 2  | Bob     | NULL
-- 3  | Carol   | 80
-- 4  | Dave    | NULL
-- 5  | Eve     | 70

SELECT
    COUNT(*)      AS total_rows,     -- 5 (counts NULLs)
    COUNT(score)  AS scored_rows,    -- 3 (ignores NULLs)
    SUM(score)    AS total_score,    -- 240 (90+80+70, NULLs ignored)
    AVG(score)    AS avg_score,      -- 80.0 (240/3, NOT 240/5)
    MIN(score)    AS min_score,      -- 70
    MAX(score)    AS max_score       -- 90
FROM scores;
```

### The AVG Trap

If Bob and Dave's NULL score should count as 0 (they missed the test), AVG gives the wrong answer:

```sql
-- Wrong: AVG = 80 (only 3 students counted)
SELECT AVG(score) FROM scores;

-- Correct: AVG = 48 (240 / 5 students)
SELECT AVG(COALESCE(score, 0)) FROM scores;
```

### Diagram — NULL Impact

```
┌───────────────────────────────────────────────────────────────┐
│  scores: 90, NULL, 80, NULL, 70                               │
│                                                               │
│  COUNT(*) sees:  [90] [NULL] [80] [NULL] [70]  = 5            │
│  COUNT(score):   [90]        [80]        [70]  = 3            │
│  SUM(score):      90  +  0  + 80  +  0  + 70  = 240 (not 0!) │
│                   ↑           ↑           ↑                   │
│                  NULLs are simply skipped, not treated as 0   │
└───────────────────────────────────────────────────────────────┘
```

> **Memory hook:** every aggregate function except `COUNT(*)` treats NULL as "not there" — never as zero. If you want NULL to mean zero, you have to say so yourself with `COALESCE`.

---

## 6. GROUP BY — Grouping Rows

So far every aggregate has answered a question about the *whole table*: total revenue, average order, earliest date. But the far more common real question is "break it down by X" — revenue per region, average salary per department, order count per customer. Running one query per department by hand doesn't scale once you have fifty departments. That's the exact gap GROUP BY closes: it splits the table into buckets first, then runs the aggregate separately inside each bucket.

Think of a teacher sorting a stack of graded tests into piles by class period before averaging each pile separately — that's GROUP BY in one sentence.

GROUP BY divides the rows into groups and applies the aggregate function to each group independently.

### Mental Model — Card Sorting

```
Before GROUP BY:               After GROUP BY dept:
┌───────────────────────┐      ┌──────────────────────┐
│ dept  │ salary        │      │ Engineering: 90,80,95 │ --> AVG = 88.3
│ Eng   │ 90            │      │ Marketing:   60,70    │ --> AVG = 65.0
│ Mkt   │ 60            │      │ Sales:       75,80,85 │ --> AVG = 80.0
│ Eng   │ 80            │      └──────────────────────┘
│ Sales │ 75            │
│ Mkt   │ 70            │
│ Eng   │ 95            │
│ Sales │ 80            │
│ Sales │ 85            │
└───────────────────────┘
```

```sql
SELECT dept, AVG(salary) AS avg_salary
FROM employees
GROUP BY dept
ORDER BY avg_salary DESC;
```

### GROUP BY Multiple Columns

```sql
-- Revenue by year AND quarter
SELECT
    YEAR(order_date)    AS yr,
    QUARTER(order_date) AS qtr,
    SUM(amount)         AS revenue
FROM orders
GROUP BY YEAR(order_date), QUARTER(order_date)
ORDER BY yr, qtr;
```

### GROUP BY with Expression

```sql
-- Orders per day of week (1=Sunday, 7=Saturday in MySQL)
SELECT
    DAYNAME(order_date) AS day_of_week,
    COUNT(*)            AS order_count
FROM orders
GROUP BY DAYOFWEEK(order_date), DAYNAME(order_date)
ORDER BY DAYOFWEEK(order_date);
```

### SELECT Rules with GROUP BY

In ONLY_FULL_GROUP_BY mode (MySQL default since 5.7), every column in SELECT must either:
- Appear in GROUP BY, OR
- Be wrapped in an aggregate function

```sql
-- WRONG: product_name not in GROUP BY and not aggregated
SELECT customer_id, product_name, SUM(amount)
FROM orders
GROUP BY customer_id;

-- RIGHT
SELECT customer_id, SUM(amount)
FROM orders
GROUP BY customer_id;

-- ALSO RIGHT: product_name is functionally dependent on product_id (primary key)
SELECT product_id, product_name, SUM(amount)
FROM orders
GROUP BY product_id;
```

> **Memory hook:** GROUP BY is sorting a deck of cards into piles by suit before you count each pile — you never count the whole deck as one lump again.

---

## 7. HAVING — Filtering Groups

Here's a question GROUP BY alone can't answer: "show me only the customers who spent over $1000 total." You can't check that with a plain WHERE, because WHERE runs on individual rows *before* grouping even happens — at that point, there's no "total spent per customer" yet, just raw order rows. You need a filter that runs *after* the grouping and summing is done. That's HAVING.

So: WHERE filters rows **before** grouping. HAVING filters groups **after** grouping.

```
┌─────────────────────────────────────────────────────────────┐
│  Query Execution Order                                      │
│                                                             │
│  FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY      │
│                                                             │
│  WHERE: "I only want orders over $50"                       │
│  HAVING: "I only want customers whose total > $500"         │
└─────────────────────────────────────────────────────────────┘
```

```sql
-- Customers who have spent more than $1000 total
SELECT
    customer_id,
    COUNT(*)    AS order_count,
    SUM(amount) AS total_spent
FROM orders
GROUP BY customer_id
HAVING SUM(amount) > 1000
ORDER BY total_spent DESC;
```

### WHERE vs HAVING — Do Not Confuse Them

```sql
-- WHERE filters rows before grouping (use for row-level conditions)
-- HAVING filters groups after grouping (use for aggregate conditions)

-- Find departments with avg salary > 70000,
-- but exclude contractors from the calculation entirely
SELECT dept, AVG(salary) AS avg_salary
FROM employees
WHERE employment_type = 'full_time'   -- row-level filter
GROUP BY dept
HAVING AVG(salary) > 70000            -- group-level filter
ORDER BY avg_salary DESC;
```

### HAVING with Multiple Conditions

```sql
SELECT
    region,
    COUNT(DISTINCT customer_id)  AS customers,
    SUM(amount)                  AS revenue
FROM orders
WHERE status = 'completed'
GROUP BY region
HAVING COUNT(DISTINCT customer_id) >= 100
   AND SUM(amount) >= 50000
ORDER BY revenue DESC;
```

> **Memory hook:** WHERE picks which cards go into the piles; HAVING picks which piles you're allowed to keep on the table afterward.

---

## 8. GROUP_CONCAT — Concatenating Group Values

Sometimes an aggregate isn't a number at all — it's a list. "Which products did this customer order?" isn't a total or an average, it's "Widget, Gadget, Doohickey" squashed into one readable string per customer. That's the gap GROUP_CONCAT fills: it merges all the values in a group into a single string, the same way SUM merges all the values in a group into a single total.

Think of it as stapling together every sticky note in a pile into one long strip, instead of leaving them as separate notes.

GROUP_CONCAT merges all values in a group into a single string. Extremely useful for generating comma-separated lists or building denormalized outputs.

### Basic Usage

```sql
-- List all products each customer ordered, comma-separated
SELECT
    customer_id,
    GROUP_CONCAT(product_name) AS products_ordered
FROM order_items oi
JOIN products p USING (product_id)
GROUP BY customer_id;
-- Result: customer 42 -> "Widget,Gadget,Doohickey,Widget"
```

### Full Syntax

```sql
GROUP_CONCAT(
    [DISTINCT] col
    [ORDER BY col [ASC|DESC]]
    [SEPARATOR 'delimiter']
)
```

### With DISTINCT, ORDER BY, and Custom Separator

```sql
SELECT
    customer_id,
    GROUP_CONCAT(
        DISTINCT product_name
        ORDER BY product_name ASC
        SEPARATOR ' | '
    ) AS unique_products
FROM order_items oi
JOIN products p USING (product_id)
GROUP BY customer_id;
-- Result: "Doohickey | Gadget | Widget"
```

### GROUP_CONCAT Length Limit

By default the result is limited to 1024 characters. Increase it per session or globally:

```sql
-- Per session
SET SESSION group_concat_max_len = 65536;

-- Globally
SET GLOBAL group_concat_max_len = 65536;
```

### Practical Use — Tags per Article

```sql
SELECT
    a.title,
    GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR ', ') AS tags
FROM articles a
JOIN article_tags at ON a.id = at.article_id
JOIN tags t ON t.id = at.tag_id
GROUP BY a.id, a.title;
```

Two gotchas worth remembering here: GROUP_CONCAT returns NULL if the group is empty or every value in it is NULL, and the combined string is capped at 1024 characters by default — long lists get silently truncated unless you raise the limit.

> **Memory hook:** GROUP_CONCAT is stapling every sticky note in a pile into one long strip, instead of leaving separate notes lying around.

---

## 9. Bitwise Aggregates — BIT_AND, BIT_OR, BIT_XOR

Picture a permissions system where each user's access is packed into a single integer, bit by bit — bit 0 for "read," bit 1 for "write," and so on. Now someone asks: "which permissions does *everyone* in this role share?" or "which permission does *anyone* in this role have?" You can't answer that with SUM or AVG — those are for numbers you add together, not flags you combine bit-by-bit. That's what BIT_AND, BIT_OR, and BIT_XOR are for: aggregating across rows, one bit at a time, useful for permission flags, feature flags, and boolean sets stored as integers.

### BIT_AND — All Must Have the Flag

```sql
-- Find permission bits shared by ALL users in a role
-- Only bits that ALL users have set will remain set
SELECT role_id, BIT_AND(permissions) AS shared_permissions
FROM user_roles
GROUP BY role_id;
```

### BIT_OR — Any Can Have the Flag

```sql
-- Find the union of all permissions granted to any user in a role
SELECT role_id, BIT_OR(permissions) AS any_permission
FROM user_roles
GROUP BY role_id;
```

### BIT_XOR — Checksum / Change Detection

```sql
-- XOR of all row checksums in a partition
-- If result is 0, the same set of values exists in another partition
SELECT table_partition, BIT_XOR(CRC32(CONCAT_WS(',', col1, col2, col3))) AS checksum
FROM large_table
GROUP BY table_partition;
```

### Diagram — Permission Flag Aggregation

```
User A permissions: 0b00001111  (read, write, delete, admin)
User B permissions: 0b00000011  (read, write)
User C permissions: 0b00001001  (read, admin)

BIT_AND = 0b00000001  (only READ is shared by all)
BIT_OR  = 0b00001111  (union of all permissions)
```

> **Memory hook:** BIT_AND asks "what does everyone in the room agree on?", BIT_OR asks "what has anyone in the room got?", BIT_XOR is a fingerprint that flips if even one bit anywhere changed.

---

## 10. Conditional Aggregation — The Pivot Pattern

Here's a very common request: "give me one row per customer, with separate columns for pending orders, shipped orders, delivered orders, and cancelled orders." Normally that data is one row per order with a `status` column — rows, not columns. You *could* pull all the rows into your application and pivot them there in code, looping and bucketing manually. Or you could just teach SQL to count conditionally, and let the database do the pivoting for you in one pass. That second option is conditional aggregation — one of the most powerful SQL techniques there is.

Think of it as sorting mail into labeled cubbyholes as it arrives, instead of dumping it all in one pile and sorting it by hand afterward.

### The Core Pattern

```sql
SUM(CASE WHEN condition THEN value ELSE 0 END)
COUNT(CASE WHEN condition THEN 1 END)       -- NULLs are ignored, so ELSE not needed
```

### Example — Pivot Order Statuses

```sql
-- Before: one row per order with a status column
-- After:  one row per customer, columns for each status

SELECT
    customer_id,
    COUNT(*)                                                          AS total_orders,
    SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END)           AS pending_count,
    SUM(CASE WHEN status = 'shipped'   THEN 1 ELSE 0 END)           AS shipped_count,
    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END)           AS delivered_count,
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)           AS cancelled_count,
    SUM(CASE WHEN status = 'shipped'   THEN amount ELSE 0 END)      AS shipped_revenue,
    SUM(CASE WHEN status = 'delivered' THEN amount ELSE 0 END)      AS delivered_revenue,
    ROUND(
        100.0 * SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)
        / COUNT(*), 2
    )                                                                 AS cancellation_rate_pct
FROM orders
GROUP BY customer_id
ORDER BY delivered_revenue DESC;
```

### Monthly Revenue Pivot (Last 3 Months)

```sql
SELECT
    product_category,
    SUM(CASE WHEN MONTH(order_date) = MONTH(CURDATE()) - 2
             THEN amount ELSE 0 END)  AS two_months_ago,
    SUM(CASE WHEN MONTH(order_date) = MONTH(CURDATE()) - 1
             THEN amount ELSE 0 END)  AS last_month,
    SUM(CASE WHEN MONTH(order_date) = MONTH(CURDATE())
             THEN amount ELSE 0 END)  AS this_month
FROM orders o
JOIN products p USING (product_id)
WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
GROUP BY product_category
ORDER BY this_month DESC;
```

### Boolean Count with COUNT + CASE (No ELSE Needed)

```sql
-- COUNT ignores NULLs, so when condition is false CASE returns NULL
-- and that row is not counted
SELECT
    region,
    COUNT(*)                                             AS total,
    COUNT(CASE WHEN amount > 100 THEN 1 END)            AS high_value,
    COUNT(CASE WHEN amount > 100 THEN 1 END) * 100.0
        / COUNT(*)                                       AS high_value_pct
FROM orders
GROUP BY region;
```

> **Memory hook:** conditional aggregation is sorting mail into labeled cubbyholes as it arrives, instead of dumping it all in one pile and sorting it out later.

---

## 11. COALESCE with Aggregates

You've already met this problem twice: SUM of an all-NULL group returns NULL, not 0; AVG over an empty group returns NULL too. A report that shows blank cells instead of "$0" looks broken, or worse, gets silently mis-summed by whatever tool consumes it downstream. COALESCE is the fix — a safety net that catches a NULL result and swaps in a sensible default before it ever reaches the report.

When an aggregate returns NULL (because all inputs were NULL, or no rows matched), COALESCE provides a safe fallback.

```sql
-- AVG returns NULL if the group is empty or all values are NULL
SELECT
    dept,
    COALESCE(AVG(bonus), 0)   AS avg_bonus,
    COALESCE(SUM(bonus), 0)   AS total_bonus,
    COALESCE(MAX(bonus), 0)   AS max_bonus
FROM employees
GROUP BY dept;
```

### The Empty Group Problem

```sql
-- If no orders exist for a customer in the date range,
-- a simple SUM returns NULL. COALESCE fixes that.
SELECT
    c.customer_id,
    c.name,
    COALESCE(SUM(o.amount), 0) AS total_spent
FROM customers c
LEFT JOIN orders o
    ON c.customer_id = o.customer_id
    AND o.order_date >= '2024-01-01'
GROUP BY c.customer_id, c.name;
```

Note: the date filter must be in the JOIN condition, not WHERE, when using LEFT JOIN. Moving it to WHERE would turn the LEFT JOIN into an inner join.

---

## 12. Real-World Examples

### Example 1 — Monthly Revenue by Region

```sql
SELECT
    r.region_name,
    DATE_FORMAT(o.order_date, '%Y-%m')   AS month,
    COUNT(*)                             AS order_count,
    COUNT(DISTINCT o.customer_id)        AS unique_customers,
    ROUND(SUM(o.amount), 2)             AS revenue,
    ROUND(AVG(o.amount), 2)             AS avg_order_value,
    ROUND(MIN(o.amount), 2)             AS min_order,
    ROUND(MAX(o.amount), 2)             AS max_order
FROM orders o
JOIN customers c  USING (customer_id)
JOIN regions r    USING (region_id)
WHERE o.status = 'completed'
  AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
GROUP BY r.region_name, DATE_FORMAT(o.order_date, '%Y-%m')
ORDER BY r.region_name, month;
```

### Example 2 — Top 10 Customers by Lifetime Value (LTV)

```sql
SELECT
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.email,
    MIN(o.order_date)                       AS first_order_date,
    MAX(o.order_date)                       AS last_order_date,
    COUNT(*)                                AS total_orders,
    ROUND(SUM(o.amount), 2)                AS lifetime_value,
    ROUND(AVG(o.amount), 2)                AS avg_order_value,
    DATEDIFF(MAX(o.order_date),
             MIN(o.order_date))             AS days_as_customer
FROM customers c
JOIN orders o USING (customer_id)
WHERE o.status = 'completed'
GROUP BY c.customer_id, c.first_name, c.last_name, c.email
ORDER BY lifetime_value DESC
LIMIT 10;
```

### Example 3 — Product Rating Distribution

```sql
SELECT
    p.product_name,
    COUNT(r.rating)                                       AS review_count,
    ROUND(AVG(r.rating), 2)                              AS avg_rating,
    SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END)       AS five_star,
    SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END)       AS four_star,
    SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END)       AS three_star,
    SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END)       AS two_star,
    SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END)       AS one_star,
    GROUP_CONCAT(
        DISTINCT r.reviewer_name
        ORDER BY r.review_date DESC
        SEPARATOR ', '
    )                                                     AS recent_reviewers
FROM products p
LEFT JOIN reviews r USING (product_id)
GROUP BY p.product_id, p.product_name
HAVING COUNT(r.rating) >= 5
ORDER BY avg_rating DESC, review_count DESC;
```

### Example 4 — Employee Headcount and Payroll by Department

```sql
SELECT
    d.dept_name,
    COUNT(e.employee_id)                                          AS headcount,
    SUM(e.salary)                                                 AS total_payroll,
    ROUND(AVG(e.salary), 0)                                      AS avg_salary,
    MIN(e.salary)                                                 AS min_salary,
    MAX(e.salary)                                                 AS max_salary,
    GROUP_CONCAT(e.job_title ORDER BY e.salary DESC
                 SEPARATOR ' | ')                                 AS roles,
    SUM(CASE WHEN e.gender = 'F' THEN 1 ELSE 0 END)             AS female_count,
    SUM(CASE WHEN e.gender = 'M' THEN 1 ELSE 0 END)             AS male_count
FROM departments d
LEFT JOIN employees e USING (dept_id)
GROUP BY d.dept_id, d.dept_name
ORDER BY total_payroll DESC;
```

### Example 5 — Cohort Retention (Monthly)

```sql
-- How many customers from each signup month made a purchase in month N?
SELECT
    DATE_FORMAT(c.signup_date, '%Y-%m')        AS cohort_month,
    COUNT(DISTINCT c.customer_id)              AS cohort_size,
    COUNT(DISTINCT CASE
        WHEN TIMESTAMPDIFF(MONTH, c.signup_date, o.order_date) = 0
        THEN o.customer_id END)                AS month_0,
    COUNT(DISTINCT CASE
        WHEN TIMESTAMPDIFF(MONTH, c.signup_date, o.order_date) = 1
        THEN o.customer_id END)                AS month_1,
    COUNT(DISTINCT CASE
        WHEN TIMESTAMPDIFF(MONTH, c.signup_date, o.order_date) = 2
        THEN o.customer_id END)                AS month_2,
    COUNT(DISTINCT CASE
        WHEN TIMESTAMPDIFF(MONTH, c.signup_date, o.order_date) = 3
        THEN o.customer_id END)                AS month_3
FROM customers c
LEFT JOIN orders o USING (customer_id)
GROUP BY DATE_FORMAT(c.signup_date, '%Y-%m')
ORDER BY cohort_month;
```

---

## 13. Hands-On Exercises

> Use the schema: `orders(order_id, customer_id, product_id, amount, status, order_date, region)`, `customers(customer_id, name, email, signup_date, country)`, `products(product_id, name, category, price)`, `reviews(review_id, product_id, reviewer_name, rating, review_date)`.

### Exercise 1

Write a query that returns the number of orders, total revenue, and average order value for each combination of `status` and `region`. Only include combinations where total revenue exceeds $5,000. Sort by revenue descending.

<details>
<summary>Solution</summary>

```sql
SELECT
    region,
    status,
    COUNT(*)             AS order_count,
    ROUND(SUM(amount),2) AS total_revenue,
    ROUND(AVG(amount),2) AS avg_order_value
FROM orders
GROUP BY region, status
HAVING SUM(amount) > 5000
ORDER BY total_revenue DESC;
```

</details>

---

### Exercise 2

For each product category, produce a one-row summary showing:
- Total products in the category
- Average price
- A pipe-separated list of the 5 most expensive product names
- Number of products with a rating above 4.0

<details>
<summary>Solution</summary>

```sql
SELECT
    p.category,
    COUNT(DISTINCT p.product_id)                AS product_count,
    ROUND(AVG(p.price), 2)                      AS avg_price,
    (
        SELECT GROUP_CONCAT(name ORDER BY price DESC SEPARATOR ' | ')
        FROM (
            SELECT name, price
            FROM products p2
            WHERE p2.category = p.category
            ORDER BY price DESC
            LIMIT 5
        ) top5
    )                                           AS top_5_products,
    COUNT(DISTINCT CASE
        WHEN avg_rating > 4.0
        THEN p.product_id END)                  AS highly_rated_count
FROM products p
LEFT JOIN (
    SELECT product_id, AVG(rating) AS avg_rating
    FROM reviews
    GROUP BY product_id
) r USING (product_id)
GROUP BY p.category
ORDER BY avg_price DESC;
```

</details>

---

### Exercise 3

Find customers who:
- Placed at least 3 orders
- Have a cancellation rate below 10%
- Spent more than $500 total on completed orders

Return: customer name, total completed orders, cancellation rate (%), lifetime value on completed orders, and the most recent order date.

<details>
<summary>Solution</summary>

```sql
SELECT
    c.name,
    SUM(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END)   AS completed_orders,
    ROUND(
        100.0 * SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END)
        / COUNT(*), 2
    )                                                           AS cancellation_rate_pct,
    ROUND(
        SUM(CASE WHEN o.status = 'completed' THEN o.amount ELSE 0 END), 2
    )                                                           AS lifetime_value,
    MAX(o.order_date)                                           AS last_order_date
FROM customers c
JOIN orders o USING (customer_id)
GROUP BY c.customer_id, c.name
HAVING COUNT(*) >= 3
   AND (SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) < 10
   AND SUM(CASE WHEN o.status = 'completed' THEN o.amount ELSE 0 END) > 500
ORDER BY lifetime_value DESC;
```

</details>

---

### Exercise 4

Build a monthly revenue pivot for the last 6 months. Rows = product categories. Columns = one per month (label format `YYYY-MM`). Use conditional aggregation.

<details>
<summary>Solution</summary>

```sql
SELECT
    p.category,
    ROUND(SUM(CASE WHEN DATE_FORMAT(o.order_date,'%Y-%m') =
        DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH),'%Y-%m')
        THEN o.amount ELSE 0 END), 2) AS month_minus_5,
    ROUND(SUM(CASE WHEN DATE_FORMAT(o.order_date,'%Y-%m') =
        DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 4 MONTH),'%Y-%m')
        THEN o.amount ELSE 0 END), 2) AS month_minus_4,
    ROUND(SUM(CASE WHEN DATE_FORMAT(o.order_date,'%Y-%m') =
        DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 3 MONTH),'%Y-%m')
        THEN o.amount ELSE 0 END), 2) AS month_minus_3,
    ROUND(SUM(CASE WHEN DATE_FORMAT(o.order_date,'%Y-%m') =
        DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 2 MONTH),'%Y-%m')
        THEN o.amount ELSE 0 END), 2) AS month_minus_2,
    ROUND(SUM(CASE WHEN DATE_FORMAT(o.order_date,'%Y-%m') =
        DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH),'%Y-%m')
        THEN o.amount ELSE 0 END), 2) AS last_month,
    ROUND(SUM(CASE WHEN DATE_FORMAT(o.order_date,'%Y-%m') =
        DATE_FORMAT(CURDATE(),'%Y-%m')
        THEN o.amount ELSE 0 END), 2) AS this_month
FROM orders o
JOIN products p USING (product_id)
WHERE o.order_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
  AND o.status = 'completed'
GROUP BY p.category
ORDER BY p.category;
```

</details>

---

### Exercise 5

For each country, show: total customers, average days between signup and first order (hint: use MIN(order_date) per customer), and the top product category purchased (most revenue). The "top category" can be computed using a subquery or GROUP_CONCAT trick.

<details>
<summary>Solution</summary>

```sql
WITH customer_stats AS (
    SELECT
        c.country,
        c.customer_id,
        DATEDIFF(MIN(o.order_date), c.signup_date) AS days_to_first_order
    FROM customers c
    LEFT JOIN orders o USING (customer_id)
    GROUP BY c.country, c.customer_id, c.signup_date
),
country_category AS (
    SELECT
        c.country,
        p.category,
        SUM(o.amount) AS revenue,
        RANK() OVER (PARTITION BY c.country ORDER BY SUM(o.amount) DESC) AS rnk
    FROM orders o
    JOIN customers c USING (customer_id)
    JOIN products p  USING (product_id)
    WHERE o.status = 'completed'
    GROUP BY c.country, p.category
)
SELECT
    cs.country,
    COUNT(DISTINCT cs.customer_id)              AS total_customers,
    ROUND(AVG(cs.days_to_first_order), 1)      AS avg_days_to_first_order,
    cc.category                                 AS top_category,
    ROUND(cc.revenue, 2)                       AS top_category_revenue
FROM customer_stats cs
LEFT JOIN country_category cc
    ON cs.country = cc.country AND cc.rnk = 1
GROUP BY cs.country, cc.category, cc.revenue
ORDER BY total_customers DESC;
```

</details>

---

## 14. Interview Q&A

**Q1: What is the difference between COUNT(*), COUNT(col), and COUNT(DISTINCT col)?**

A: `COUNT(*)` counts every row including those with NULLs. `COUNT(col)` counts only rows where `col` is not NULL. `COUNT(DISTINCT col)` counts unique non-NULL values. Example: in a 10-row table with 3 NULL emails and 2 duplicate emails, `COUNT(*)=10`, `COUNT(email)=7`, `COUNT(DISTINCT email)=5` or fewer.

---

**Q2: Do SUM, AVG, MIN, MAX include NULL values?**

A: No. All of them silently ignore NULLs. Only `COUNT(*)` includes NULLs. This is the most common source of subtle data bugs — if NULLs semantically mean zero, you must use `COALESCE(col, 0)` before aggregating.

---

**Q3: What is the difference between WHERE and HAVING?**

A: WHERE filters individual rows before GROUP BY runs. HAVING filters groups after GROUP BY runs. You cannot use aggregate functions in WHERE; you must use HAVING for aggregate conditions. Both can appear in the same query.

---

**Q4: Can you use column aliases defined in SELECT inside a HAVING clause?**

A: In standard SQL and MySQL, you cannot use SELECT aliases in HAVING (HAVING runs before SELECT in the logical processing order). However, MySQL has a non-standard extension that allows it in GROUP BY and HAVING. For portability, repeat the expression.

---

**Q5: What does GROUP_CONCAT return if the group is empty or all values are NULL?**

A: It returns NULL. Use COALESCE(GROUP_CONCAT(...), '') to default to an empty string.

---

**Q6: How does conditional aggregation differ from a WHERE clause?**

A: WHERE removes rows from the entire query. Conditional aggregation (`SUM(CASE WHEN ... END)`) keeps all rows in the group but selectively includes values in specific aggregates. This lets you compute multiple metrics for different subsets of the data in a single query pass.

---

**Q7: What is the GROUP_CONCAT max length, and how do you change it?**

A: Default is 1024 bytes. Change it with `SET SESSION group_concat_max_len = N`. Values longer than the limit are silently truncated, so always verify results when aggregating long strings.

---

**Q8: Can you GROUP BY an expression that is not in the SELECT list?**

A: Yes. `GROUP BY YEAR(order_date)` is valid even if SELECT does not contain `YEAR(order_date)`. The grouping happens independently of what you select.

---

**Q9: What happens if you reference a non-aggregated, non-grouped column in SELECT with GROUP BY?**

A: In MySQL with `ONLY_FULL_GROUP_BY` (the default), it raises an error. With ONLY_FULL_GROUP_BY disabled, MySQL picks an arbitrary value from the group — which is almost always wrong. Always enable ONLY_FULL_GROUP_BY.

---

**Q10: How do you find the second highest value per group without window functions?**

A: Use a correlated subquery or a self-join:

```sql
SELECT dept, salary
FROM employees e1
WHERE 1 = (
    SELECT COUNT(DISTINCT salary)
    FROM employees e2
    WHERE e2.dept = e1.dept
      AND e2.salary > e1.salary
);
```

(Window functions — covered in file 02 — make this much cleaner.)

---

**Q11: What is the BIT_XOR use case in MySQL?**

A: Replication checksum. XOR a CRC of every row in a table. If two replicas produce the same XOR result, they have the same data set (probabilistically). Also used for detecting row-level changes in ETL pipelines.

---

**Q12: How would you count the percentage of orders in each status without using a subquery?**

A: Use conditional aggregation over the full table with a window function or cross-aggregate:

```sql
SELECT
    status,
    COUNT(*) AS cnt,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM orders
GROUP BY status;
```

Or without window functions:

```sql
SELECT
    status,
    COUNT(*) AS cnt,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM orders), 2) AS pct
FROM orders
GROUP BY status;
```

---

**Q13: When does AVG return a different result depending on whether you apply COALESCE before or after?**

A: `AVG(col)` divides the sum by the count of non-NULL rows. `AVG(COALESCE(col, 0))` divides the same sum by the total row count including NULLs (now treated as 0). If the table has NULLs, the second form produces a lower average. Choose based on business meaning: NULLs = unknown (skip) or NULLs = zero (include as 0).

---

**Q14: How do you get the most recent order per customer using GROUP BY?**

A: You can get the date with `MAX(order_date)`, but retrieving the full row requires a join back:

```sql
SELECT o.*
FROM orders o
JOIN (
    SELECT customer_id, MAX(order_date) AS latest
    FROM orders
    GROUP BY customer_id
) latest_orders
    ON o.customer_id = latest_orders.customer_id
   AND o.order_date  = latest_orders.latest;
```

Window functions (`ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC)`) are cleaner for this.

---

**Q15: What is the execution order of a GROUP BY query?**

A:
```
1. FROM        (identify source tables, apply JOINs)
2. WHERE       (filter individual rows)
3. GROUP BY    (group remaining rows)
4. HAVING      (filter groups)
5. SELECT      (evaluate expressions, aliases)
6. DISTINCT    (remove duplicate result rows)
7. ORDER BY    (sort)
8. LIMIT       (truncate)
```

Understanding this order explains why you cannot use SELECT aliases in WHERE/HAVING (they haven't been defined yet), and why aggregate functions cannot appear in WHERE.
