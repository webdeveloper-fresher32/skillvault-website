# Subqueries — MySQL Complete Guide

## Table of Contents
1. [What is a Subquery?](#1-what-is-a-subquery)
2. [Scalar Subqueries](#2-scalar-subqueries)
3. [Table Subqueries (Derived Tables)](#3-table-subqueries-derived-tables)
4. [Correlated vs Non-Correlated](#4-correlated-vs-non-correlated)
5. [EXISTS and NOT EXISTS](#5-exists-and-not-exists)
6. [IN, NOT IN, ANY, ALL](#6-in-not-in-any-all)
7. [Subquery vs JOIN](#7-subquery-vs-join)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What is a Subquery?

Here's a problem you'll hit constantly: "show me every employee earning above the average salary." Simple request — except you don't know the average salary. Nobody does, until someone actually calculates it. So before you can even write the `WHERE` clause, you need another query to run first, hand you a number, and then let the real query filter on that number.

That's the whole idea behind a subquery: a query, inside a query, whose job is to answer a smaller question that the outer query needs answered first.

**A real-world analogy:** think of it like asking a colleague "what's the average commute time in the office?" before you decide whether your own commute counts as "long." You can't answer the second question until someone answers the first. A subquery is that first question, asked and answered automatically, inline, as part of the same SQL statement.

**The formal definition**, now that the motivation is clear: a subquery is a SELECT statement nested inside another SQL statement.

```sql
-- Outer query uses the result of the inner query
SELECT name FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);
--              └─────── inner query ───────────┘
```

MySQL runs the inner query first (or, in some cases, once per outer row — more on that distinction in Section 4), gets a result, and feeds it to the outer query.

### Types of Subqueries

Not every subquery looks or behaves the same way. Here's the shape they can take:

| Type | Returns | Used In |
|------|---------|---------|
| Scalar | Single value (1 row, 1 col) | SELECT, WHERE, HAVING |
| Column | Single column, multiple rows | WHERE IN (...) |
| Table | Multiple rows and columns | FROM clause |
| Correlated | References outer query | WHERE EXISTS, WHERE col = outer.col |

Keep this table in mind — every section below is really just a deep dive into one row of it.

---

## 2. Scalar Subqueries

The simplest case first: a subquery that returns exactly one value — one row, one column. Think of it as a subquery that hands back a single number (or string, or date) you can drop anywhere a literal value would go.

```sql
-- In WHERE: find employees earning above average
SELECT name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);

-- In SELECT: add avg salary column to each row
SELECT
  name,
  salary,
  (SELECT AVG(salary) FROM employees) AS company_avg,
  salary - (SELECT AVG(salary) FROM employees) AS diff_from_avg
FROM employees;

-- In HAVING
SELECT dept, AVG(salary) AS avg_sal
FROM employees
GROUP BY dept
HAVING AVG(salary) > (SELECT AVG(salary) FROM employees);
```

Notice the pattern: wherever MySQL expects a single value, you can drop a scalar subquery instead of a hardcoded literal. `WHERE`, `SELECT`, `HAVING` — all fair game.

> **Memory hook:** "A scalar subquery is a calculator you run before you ask your real question."

---

## 3. Table Subqueries (Derived Tables)

Sometimes the "smaller question" you need answered isn't a single number — it's a whole mini result set, like "headcount per department." You want to treat that result set as if it were its own table, so you can filter or join against it. That's exactly what a subquery in the `FROM` clause lets you do — MySQL calls this a derived table, because the table is *derived* from a query rather than stored on disk.

The one rule you can't skip: a derived table must be aliased. MySQL needs a name to refer to it by, the same way every real table needs a name.

```sql
-- Find departments with more than 5 employees
SELECT dept, headcount
FROM (
  SELECT dept, COUNT(*) AS headcount
  FROM employees
  GROUP BY dept
) AS dept_counts           -- alias required!
WHERE headcount > 5;

-- Top earning employee per department
SELECT d.dept, d.name, d.salary
FROM (
  SELECT dept, name, salary,
         ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS rn
  FROM employees
) AS d
WHERE d.rn = 1;
```

> **Memory hook:** "A derived table is a subquery wearing a name tag — no name tag, no entry."

---

## 4. Correlated vs Non-Correlated

This is one of those distinctions that looks academic on paper but has a very real, very painful performance consequence in production. Get this wrong and a query that "works fine" on your 1,000-row test table can crawl to a standstill on a 10-million-row production table.

**The problem it solves / the confusion it clears up:** all subqueries look similar on the page — a `SELECT` wrapped in parentheses. But under the hood, MySQL executes two completely different kinds of subqueries, and knowing which one you've written tells you whether your query will run in milliseconds or minutes.

**Analogy:** imagine you're grading exams. A **non-correlated** subquery is like calculating the class average once on a calculator, writing it on a sticky note, and then comparing every student's score against that one sticky note. You do the calculation exactly once. A **correlated** subquery is like re-calculating a *different* average for every single student — say, "the average of just this student's own study group" — meaning you redo the math from scratch, once per student.

### Non-Correlated (runs once)

A non-correlated subquery doesn't reference anything from the outer query. It's self-contained — MySQL can run it in complete isolation, get one answer, and reuse that answer for every row the outer query checks.

```sql
-- Inner query runs ONCE, result is reused
SELECT name FROM products
WHERE price > (SELECT AVG(price) FROM products);
```

### Correlated (runs once per outer row)

A correlated subquery references a column from the outer query — so it literally cannot be evaluated in isolation. MySQL has to re-run it, fresh, for every single row the outer query is considering.

```sql
-- Find employees earning more than their department's average
-- For every employee, the inner query runs with THAT employee's dept
SELECT e1.name, e1.dept, e1.salary
FROM employees e1
WHERE e1.salary > (
  SELECT AVG(e2.salary)
  FROM employees e2
  WHERE e2.dept = e1.dept   -- ← references outer query alias e1
);
```

**What's actually happening internally** — this is the part that trips people up, so let's see it step by step:

```text
NON-CORRELATED                        CORRELATED
-----------------------------         -----------------------------
SELECT AVG(price) FROM products       Outer query has N rows (employees)
        |                                     |
        v                                     v
  Runs ONCE  →  one number             For row 1 (e.g. dept = 'Sales'):
        |                                run  SELECT AVG(salary)
        v                                WHERE dept = 'Sales'   → answer #1
  Outer query checks                            |
  every row against                     For row 2 (e.g. dept = 'IT'):
  that ONE cached number                  run  SELECT AVG(salary)
                                          WHERE dept = 'IT'      → answer #2
                                                |
                                         ... repeated for EVERY row ...
                                                |
                                         N rows outer query  →  up to N
                                         separate inner query executions
```

That's the crux of it: a non-correlated subquery costs you 1 execution, total. A correlated subquery can cost you N executions, one per outer row — and each of those N executions might itself be scanning a whole table.

**Correlated subqueries can be slow** on large tables. It's not that they're wrong — they're often the clearest way to express "compare this row to a value computed *from* this row" — but when N gets into the millions, "just" re-running the inner query a million times adds up fast. Consider rewriting as a JOIN or a window function (e.g. `AVG(salary) OVER (PARTITION BY dept)`), which computes the per-group average in one pass instead of N separate passes.

| | Non-Correlated | Correlated |
|--|-----------------|------------|
| References outer query? | No | Yes |
| Execution count | Once, total | Once per outer row |
| Typical use | Compare against one global value | Compare each row against a value specific to it |
| Performance on large tables | Fast, predictable | Can be slow — scales with row count |
| Easy fix if slow | Rarely needed | Rewrite as JOIN or window function |

**Common confusion:** people assume "it's just a subquery, it can't be that different." The visual difference in the SQL is small — sometimes just one extra `WHERE e2.dept = e1.dept` clause — but the execution cost difference can be enormous. Always ask yourself: *does the inner query reference a column from the outer query's table?* If yes, you're paying the "once per row" price.

**Interview answer:** A non-correlated subquery executes once and its result is reused for all outer rows. A correlated subquery references columns from the outer query and must re-execute for every row of the outer query — making it potentially slow on large tables.

> **Memory hook:** "Non-correlated = calculate once, reuse everywhere. Correlated = recalculate for every single row, every single time."

---

## 5. EXISTS and NOT EXISTS

Here's a common ask: "find every customer who has placed at least one order." You don't actually care *what* the orders are, or how many — you only care whether *any* row exists. That's precisely what `EXISTS` is built for.

`EXISTS` returns TRUE the moment the subquery finds a single matching row — it doesn't bother looking for more. It **stops on the first match**, which makes it very efficient.

```sql
-- Find customers who have placed at least one order
SELECT name FROM customers c
WHERE EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.id
);

-- Find customers who have NEVER placed an order
SELECT name FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

Notice that both queries write `SELECT 1` inside the subquery, not `SELECT *` or a real column. That's deliberate — `EXISTS` never looks at *what* the subquery returns, only *whether* it returns anything at all. `SELECT 1` is just a cheap, conventional placeholder that signals "I don't care about the value."

**EXISTS vs IN — how do you pick?**

| | EXISTS | IN |
|--|--------|----|
| Stops at first match? | Yes — short-circuits | No — evaluates the full list |
| Best for | Large subquery result sets | Small, known subquery result sets |
| NULL safety | Safe | `NOT IN` breaks with NULLs (see Section 6) |
| What it checks | Row existence only | Actual value membership |

Rule of thumb: EXISTS short-circuits (stops at first match) — better for large subquery results. IN evaluates all values — better for small subquery results. And whenever you're about to write `NOT IN`, keep reading — that one has a trap waiting for you.

---

## 6. IN, NOT IN, ANY, ALL

`IN` is the one everybody reaches for first: "give me products in these categories." It's readable, it's intuitive, and it works exactly the way you'd expect — right up until you flip it to `NOT IN`.

```sql
-- IN: value matches any in the list
SELECT name FROM products
WHERE category_id IN (SELECT id FROM categories WHERE type = 'Electronics');
```

That one's harmless. Now here's the trap.

### The NOT IN + NULL trap

Picture this: you write `NOT IN` expecting "give me everything that's *not* in this list." Totally reasonable expectation. Then one day the query returns **zero rows** — not "fewer rows," not "wrong rows" — literally nothing, even though you know matching data exists. What happened?

**Why this happens, mechanically:** `NOT IN` is really just shorthand for a chain of `!=` comparisons — `x != a AND x != b AND x != c ...`. SQL's three-valued logic means comparing anything to `NULL` doesn't return `TRUE` or `FALSE` — it returns `UNKNOWN`. So the moment the subquery's result list contains even a single `NULL`, one of those `AND`-chained comparisons becomes `UNKNOWN`, and `UNKNOWN` poisons the entire `AND` chain — the whole row gets excluded. Do that for every row, and you silently end up with zero results, with no error, no warning.

```sql
-- NOT IN: value matches none — ⚠️ NULL TRAP!
-- If subquery returns any NULL, NOT IN returns NO rows
SELECT name FROM products
WHERE category_id NOT IN (SELECT id FROM categories WHERE type = 'Electronics');
-- If categories has a NULL id → zero results returned!
```

**The safe alternative:** use `NOT EXISTS` instead. It doesn't build a list of values to compare against — it just checks row-by-row whether a match exists, so NULLs never get a chance to poison anything.

```sql
-- Safe alternative: use NOT EXISTS
SELECT name FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.id = p.category_id AND c.type = 'Electronics'
);
```

| | `NOT IN` | `NOT EXISTS` |
|--|----------|--------------|
| Behavior with NULL in subquery | Silently returns **zero rows** | Works correctly |
| Comparison style | List of `!=` values | Row-by-row existence check |
| Safe default choice? | No — avoid unless you're certain there are no NULLs | Yes |

**Common mistake:** assuming `NOT IN` and `NOT EXISTS` are just stylistic alternatives that always produce the same result. They don't — the moment the subquery's column can contain a `NULL`, they diverge, and `NOT IN` fails silently rather than throwing an error, which makes it especially dangerous in production.

### ANY and ALL

Two more comparison operators worth knowing, for when you're comparing against a whole set of values rather than a single one:

```sql
-- ANY: at least one comparison is true
SELECT name FROM employees
WHERE salary > ANY (SELECT salary FROM managers);
-- = employees earning more than the LOWEST manager salary

-- ALL: all comparisons must be true
SELECT name FROM employees
WHERE salary > ALL (SELECT salary FROM managers);
-- = employees earning more than the HIGHEST manager salary
```

Think of `> ANY` as "beats at least one of them" (i.e., beats the weakest) and `> ALL` as "beats every single one of them" (i.e., beats the strongest).

> **Memory hook:** "NOT IN plus a NULL equals silence — zero rows, zero warning. When in doubt, NOT EXISTS."

---

## 7. Subquery vs JOIN

By now you've seen subqueries solve a lot of problems — but almost everything a subquery does, a `JOIN` can also do, often faster. So when do you pick one over the other?

```sql
-- Subquery version: products more expensive than average
SELECT name, price FROM products
WHERE price > (SELECT AVG(price) FROM products);

-- JOIN version (for multi-row subqueries)
SELECT p.name, p.price
FROM products p
JOIN (SELECT category_id, AVG(price) AS avg_price
      FROM products GROUP BY category_id) cat_avg
  ON p.category_id = cat_avg.category_id
WHERE p.price > cat_avg.avg_price;
```

| | Subquery | JOIN |
|--|----------|------|
| Readability | Often clearer intent | Can be verbose |
| Performance | Correlated = slow | Usually faster (optimizer) |
| Reuse | Result used once | Result can join to multiple tables |
| NULL handling | NOT IN NULL trap | Safer with LEFT JOIN |

**Rule of thumb:** Use subquery for filtering with a single value; use JOIN when you need columns from the related table.

> **Memory hook:** "Subquery answers a side question first; JOIN sits both tables at the same desk from the start."

---

## 8. Hands-On Exercises

Time to put all of this to work. Try each of these before checking your queries against the concepts above — especially Exercise 5, which is your chance to see the NOT IN / NULL trap fail in front of you, not just read about it.

**Exercise 1:** Find all products priced above the average price of their category (correlated subquery).

**Exercise 2:** Find customers who have placed more than 3 orders using EXISTS.

**Exercise 3:** Find products that have never been ordered using NOT EXISTS.

**Exercise 4:** Using a derived table, find the top 3 most ordered products with their order count.

**Exercise 5:** Rewrite a NOT IN subquery as NOT EXISTS and compare results when the subquery contains NULLs.

---

## 9. Interview Q&A

**Q: What is the difference between a correlated and non-correlated subquery?**
Answer: A non-correlated subquery executes once and its result is used for all outer rows. A correlated subquery references columns from the outer query and must re-execute for every row of the outer query — making it potentially slow on large tables.

**Q: Why is NOT IN dangerous with NULLs?**
Answer: NOT IN uses != comparisons. In SQL, anything compared to NULL returns UNKNOWN (not TRUE or FALSE). So if the subquery returns any NULL value, NOT IN returns no rows at all. Use NOT EXISTS instead — it handles NULLs correctly.

**Q: When would you use EXISTS over IN?**
Answer: EXISTS is better when the subquery could return a large result set because it short-circuits on the first match. IN fetches all values and compares each one. EXISTS is also safer with NULLs. Use IN when the subquery is small and values are non-nullable.

**Q: What is a derived table?**
Answer: A derived table is a subquery in the FROM clause that acts like a temporary table for the duration of the query. It must have an alias. Derived tables are useful for pre-aggregating data before joining or filtering.

**Q: How does EXISTS work internally?**
Answer: EXISTS runs the subquery for each outer row and checks if any row is returned. It doesn't care about the actual values — just whether the subquery returns at least one row. Writing SELECT 1 inside EXISTS is conventional (vs SELECT *) since the return value is ignored.
