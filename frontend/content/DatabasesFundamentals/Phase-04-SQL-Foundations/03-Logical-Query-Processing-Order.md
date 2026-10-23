# Logical Query Processing Order — Complete Guide

> "A menu names the finished dish on the first line and lists the ingredients underneath, but the kitchen starts at the bottom."

---

## Table of Contents

1. [The Problem: Reading a Query Top to Bottom and Guessing Wrong](#1-the-problem-reading-a-query-top-to-bottom-and-guessing-wrong)
2. [The Kitchen Ticket Analogy](#2-the-kitchen-ticket-analogy)
3. [The Mechanism: The Logical Processing Order](#3-the-mechanism-the-logical-processing-order)
4. [Diagram: What Each Stage Can See](#4-diagram-what-each-stage-can-see)
5. [Code Walkthrough: Three Classic Surprises](#5-code-walkthrough-three-classic-surprises)
6. [Comparing Written Order to Logical Order](#6-comparing-written-order-to-logical-order)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Reading a Query Top to Bottom and Guessing Wrong

A query is written `SELECT ... FROM ... WHERE ... GROUP BY ...`, so the natural assumption is that `SELECT` happens first. Almost every confusing SQL error message comes from that one assumption.

### Errors That Look Arbitrary Until the Order Is Known

```text
SELECT amount * 0.19 AS vat FROM orders WHERE vat > 20;
  ↳ ERROR: column "vat" does not exist
    But `vat` is right there on the first line. Why can WHERE not see it?

SELECT customer_id, SUM(amount) FROM orders
WHERE SUM(amount) > 500 GROUP BY customer_id;
  ↳ ERROR: aggregate functions are not allowed in WHERE
    Yet the identical expression is fine in HAVING two lines later.
```

### What's Missing

Neither message explains itself, and neither can be memorized usefully as an isolated rule. What is missing is the single ordering that generates both errors, plus a third family of bugs that produces no error at all: results that change between runs of the same query.

---

## 2. The Kitchen Ticket Analogy

A ticket reads "Mushroom risotto, no parmesan, extra pepper." The line cook does not start with the name of the dish. Stock and rice come out first, mushrooms go in, and the name on the ticket is only what the finished plate is called on the way out the door.

### Ticket Order vs Cooking Order

```text
Written on the ticket → dish name, then modifiers, then table number
Done in the kitchen   → gather ingredients, cook, leave out what was
                        excluded, plate it, and only then call it
                        "mushroom risotto" when handing it to the runner
```

### Mapping the Analogy to Clause Order

`SELECT` is the dish name: the label the result carries once it exists. Naming it first on the page does not make it happen first in the kitchen. A column alias defined in `SELECT` is a name invented at plating time, which is exactly why an earlier stage such as `WHERE` has never heard of it.

---

## 3. The Mechanism: The Logical Processing Order

Every `SELECT` statement is defined to be evaluated in a fixed order, regardless of how it is written. Each stage takes the previous stage's output as its input, and can only reference names that already exist at that point.

### The Order the Engine Uses

```text
1  FROM      identify the base tables and produce a working row set
2  ON        evaluate the join predicate to match rows
3  JOIN      re-add unmatched rows as NULL-extended (LEFT/RIGHT/FULL only)
4  WHERE     filter individual rows — aliases and aggregates unavailable
5  GROUP BY  collapse the surviving rows into one row per group
6  HAVING    filter whole groups — aggregates ARE available here
7  SELECT    evaluate the output expressions and DEFINE the aliases
8  DISTINCT  remove duplicate output rows
9  ORDER BY  sort the result — aliases from step 7 ARE visible
10 LIMIT     cut the sorted result short
```

### Why the Order Is Called Logical

```text
"Logical" means the answer must be identical to what this order
produces. The optimizer may physically run the steps in any order
that preserves that answer — pushing a WHERE predicate into the scan
is routine.
  ↳ So this order predicts semantics, not performance: which names are
    in scope, and which rows each stage still sees.
```

---

## 4. Diagram: What Each Stage Can See

### The Clause Pipeline

```text
  FROM orders o JOIN customers c ON c.customer_id = o.customer_id
        │  in scope: every column of both base tables
        ▼
  WHERE o.order_date >= DATE '2024-01-01'
        │  in scope: base columns only. No aliases. No aggregates.
        ▼
  GROUP BY o.customer_id
        │  individual rows are gone; grouping columns + aggregates only
        ▼
  HAVING SUM(o.amount) > 500
        │  in scope: grouping columns and aggregates. Still no aliases.
        ▼
  SELECT o.customer_id, SUM(o.amount) AS total
        │  aliases are CREATED here, not before
        ▼
  ORDER BY total DESC
        │  in scope: everything above, including the alias `total`
        ▼
  LIMIT 10   the first 10 rows of the sorted result, and no more
```

### Reading the Diagram

The two rules that explain most SQL errors both fall out of one line each in this pipeline. `WHERE` sits above `SELECT`, so an alias created in `SELECT` cannot exist yet. `ORDER BY` sits below `SELECT`, so the same alias is perfectly legal there. Nothing about either rule is arbitrary once the pipeline is drawn.

---

## 5. Code Walkthrough: Three Classic Surprises

All three run against one table: `orders(order_id, customer_id, order_date, amount)`.

### Surprise 1: An Alias That Works in ORDER BY but Not in WHERE

```sql
-- Fails: WHERE (step 4) runs before SELECT (step 7) defines `vat`.
SELECT order_id, amount * 0.19 AS vat FROM orders WHERE vat > 20;
--   ERROR: column "vat" does not exist

-- Works: ORDER BY (step 9) runs after SELECT, so the alias exists.
SELECT order_id, amount * 0.19 AS vat FROM orders ORDER BY vat DESC;
-- Fix for WHERE: repeat the expression, or name it in a subquery/CTE.
SELECT order_id, amount * 0.19 AS vat FROM orders WHERE amount * 0.19 > 20;

SELECT order_id, vat
FROM (SELECT order_id, amount * 0.19 AS vat FROM orders) t
WHERE t.vat > 20;
```

### Surprise 2: WHERE Cannot Filter an Aggregate but HAVING Can

```sql
-- Fails: WHERE (step 4) sees individual rows. Groups do not exist yet.
SELECT customer_id, SUM(amount) AS total FROM orders
WHERE SUM(amount) > 500 GROUP BY customer_id;
--   ERROR: aggregate functions are not allowed in WHERE

-- Works: HAVING (step 6) runs after GROUP BY, so groups exist.
SELECT customer_id, SUM(amount) AS total FROM orders
GROUP BY customer_id HAVING SUM(amount) > 500;

-- Both together, each doing its own job:
SELECT customer_id, SUM(amount) AS total FROM orders
WHERE order_date >= DATE '2024-01-01'   -- discard rows before grouping
GROUP BY customer_id
HAVING SUM(amount) > 500;               -- discard groups after grouping
```

### Surprise 3: LIMIT on a Non-Unique ORDER BY Column

```text
orders                            SELECT order_id, order_date FROM orders
| order_id | order_date |         ORDER BY order_date LIMIT 2;
|----------|------------|
|     5001 | 2024-03-01 |         Run 1 → 5001, 5002
|     5002 | 2024-03-01 |         Run 2 → 5003, 5001
|     5003 | 2024-03-01 |         Run 3 → 5002, 5003
|     5004 | 2024-03-02 |
  ↳ All three answers are correct. Three rows tie on order_date, the
    sort has no rule for breaking the tie, and LIMIT keeps whichever
    two the plan emitted first. A new index, more rows, or a parallel
    scan changes the answer with no error and no warning.
```

```sql
-- Fix: sort by something that cannot tie. Append a unique column.
SELECT order_id, order_date FROM orders
ORDER BY order_date, order_id LIMIT 2;   -- always 5001, 5002
```

---

## 6. Comparing Written Order to Logical Order

The two orders differ in exactly one place that matters: `SELECT` is written first and evaluated seventh, and everything confusing follows from that gap.

### Written Order vs Logical Order

| | Written Order | Logical Order |
|---|---|---|
| First clause | `SELECT` | `FROM` |
| Position of `SELECT` | 1st | 7th, after `GROUP BY` and `HAVING` |
| Aliases visible in `WHERE` | Looks like it should be | No — they do not exist yet |
| Aliases visible in `ORDER BY` | Looks like it should be | Yes — `ORDER BY` is 9th |

### Takeaway

Read a query bottom-up when debugging it: what does `FROM` produce, what survives `WHERE`, what shape does `GROUP BY` leave behind. Reading in the written order is what makes "column does not exist" look like a bug in the database rather than a description of the pipeline.

---

## 7. Common Mistakes

- **Putting an aggregate in `WHERE` instead of `HAVING`.** `WHERE` filters rows before grouping, so `SUM` has nothing to sum yet. `HAVING` filters groups after grouping. The complementary error is also common: pushing a plain row filter into `HAVING`, which is legal but wasteful, because those rows could have been discarded before the grouping work was done.
- **Expecting a `SELECT` alias to be usable in `WHERE`, `GROUP BY`, or `HAVING`.** The alias is created at step 7. Repeat the expression, or wrap the query in a subquery or CTE so the alias becomes a real column of an inner result before the outer query filters on it.
- **Using `LIMIT` without an `ORDER BY` that fully determines the order.** Without a total ordering, "the top 10" is whatever the plan emitted first, and it can change when an index is added or the table grows. Always append a unique column such as the primary key as a final tiebreaker.
- **Believing the logical order describes execution.** It describes meaning only. A well-written `WHERE` predicate is usually pushed down into the table scan or turned into an index seek long before any join is materialized, and no correct optimization changes the answer.

---

## 8. Hands-On Exercises

**Exercise 1:** Create `orders(order_id, customer_id, order_date, amount)` and insert the four rows from Surprise 3, plus enough rows across three customers that some totals exceed 500 and some do not.

**Exercise 2:** Run `SELECT order_id, amount * 0.19 AS vat FROM orders WHERE vat > 20;` and record the exact error text your engine produces. Then run the same query with `ORDER BY vat DESC` instead of the `WHERE` clause and confirm it succeeds.

**Exercise 3:** Rewrite the failing query from Exercise 2 twice — once by repeating the `amount * 0.19` expression inside `WHERE`, and once by wrapping the original query as a subquery and filtering on `t.vat` outside. Confirm both return the same rows.

**Exercise 4:** Reproduce the mistake from Section 7 on purpose. Write `WHERE SUM(amount) > 500` with a `GROUP BY customer_id`, capture the error, then move the predicate to `HAVING` and confirm the query runs. Finally add a `WHERE order_date >= DATE '2024-01-01'` alongside the `HAVING` and explain in one sentence which one removes rows and which removes groups.

**Exercise 5:** Run `SELECT order_id, order_date FROM orders ORDER BY order_date LIMIT 2;` several times, then create an index on `order_date` and run it again. Add `order_id` as a second `ORDER BY` key and confirm the result no longer varies.

---

## 9. Interview Q&A

**Q: What is the logical processing order of a `SELECT` statement?**
`FROM`, then `ON`, then the outer-join step that re-adds unmatched rows, then `WHERE`, `GROUP BY`, `HAVING`, `SELECT`, `DISTINCT`, `ORDER BY`, and finally `LIMIT`. Each stage consumes the previous stage's output, which is why a name has to already exist at a given stage to be referenced there. It defines the meaning of the query, not the physical execution the optimizer chooses.

**Q: Why can you use a column alias in `ORDER BY` but not in `WHERE`?**
Aliases are created by `SELECT`, which is the seventh stage. `WHERE` is the fourth, so at that point the alias simply does not exist and the parser reports an unknown column. `ORDER BY` is the ninth stage and runs after `SELECT`, so the alias is in scope there. The workaround for `WHERE` is to repeat the expression or to define it in a subquery or CTE.

**Q: What is the difference between `WHERE` and `HAVING`?**
`WHERE` filters individual rows before `GROUP BY` runs, so it cannot reference aggregates. `HAVING` filters entire groups after `GROUP BY` has produced them, so aggregates like `SUM` and `COUNT` are available. Putting a row-level condition in `HAVING` usually still works but does more grouping work than necessary, so row filters belong in `WHERE`.

**Q: Why can the same `ORDER BY ... LIMIT` query return different rows on different runs?**
Because the `ORDER BY` column does not uniquely determine the order. When several rows tie, SQL makes no promise about their relative position, so `LIMIT` keeps whichever ones the chosen plan produced first — and that can change when an index is added, the data grows, or the scan is parallelized. Adding a unique tiebreaker column to the `ORDER BY` makes the result deterministic.

**Q: Does the logical processing order tell you anything about performance?**
No. It is a semantic definition: the result must match what that order would produce. Engines routinely push `WHERE` predicates into the scan, reorder joins, and evaluate expressions early, as long as the answer is unchanged. Performance questions are answered by the execution plan, not by the clause order.
