# Relational Algebra Behind Joins — Complete Guide

> "Two clipboards at a wedding — one listing who was invited, one listing who actually walked in — and every useful question is some way of holding them side by side."

---

## Table of Contents

1. [The Problem: Two Tables and No Vocabulary for Combining Them](#1-the-problem-two-tables-and-no-vocabulary-for-combining-them)
2. [The Two Clipboards Analogy](#2-the-two-clipboards-analogy)
3. [The Mechanism: Selection Projection Product and Difference](#3-the-mechanism-selection-projection-product-and-difference)
4. [Diagram: A Join Is a Product Plus a Selection](#4-diagram-a-join-is-a-product-plus-a-selection)
5. [Code Walkthrough: Every Join Type on the Same Two Tables](#5-code-walkthrough-every-join-type-on-the-same-two-tables)
6. [Comparing Joins to Set Operations](#6-comparing-joins-to-set-operations)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Two Tables and No Vocabulary for Combining Them

Normalization (Phase 3) split one wide table into several narrow ones. That removed redundancy, but every question a user actually asks now spans two or more of those tables, and "spans" needs a precise definition before any engine can implement it.

### Six Ways to Answer the Same Vague Request

```text
"Show me customers and their orders." — five defensible readings:

  1  only customers who have at least one order
  2  every customer, orders or not
  3  every customer AND every order, matched where possible
  ↳ Ordinary language cannot separate these. Relational algebra can.
```

### What's Missing

What is missing is a small, closed set of operations with exact definitions, each taking relations in and producing a relation out. Six such operations are enough to express every join SQL offers, which is why learning them once explains all of the join types at the same time instead of memorizing each separately.

---

## 2. The Two Clipboards Analogy

A wedding coordinator holds two clipboards: the invitation list and the door log of who checked in. Laying them side by side answers several different questions, and which question you asked determines which names survive.

### Which Names Survive

```text
Both lists      → guests invited AND present             (inner join)
Left list wins  → every invitee, blank if absent         (left join)
Right list wins → who walked in, blank if not invited    (right join)
Either list     → every invitee and every crasher        (full join)
Every pairing   → each invitee paired with every check-in (cross join)
```

### Mapping the Analogy to Joins

The two clipboards are the two tables, the name column is the join predicate, and "blank" is `NULL`. The crasher — someone at the door with no invitation — is the row that only a `RIGHT` or `FULL` join keeps, and it is exactly the row an inner join silently discards without warning anyone.

---

## 3. The Mechanism: Selection Projection Product and Difference

Relational algebra defines a handful of operations over relations. Every one takes relations as input and returns a relation, so results can be fed into further operations. These are the tables used for the rest of this lesson.

### Selection and Projection

```text
customers                        orders
| customer_id | name  | city   |  | order_id | customer_id | amount |
|-------------|-------|--------|  |----------|-------------|--------|
|           1 | Ada   | Berlin |  |     5001 |           1 | 120.00 |
|           2 | Bruno | Lyon   |  |     5002 |           1 |  45.00 |
|           3 | Chen  | Berlin |  |     5003 |           3 | 300.00 |
                                  |     5004 |           9 |  80.00 |
  ↳ Order 5004 points at customer 9, who does not exist: no foreign
    key here, so both sides have unmatched rows.
Selection  σ  keeps ROWS matching a predicate → WHERE
Projection π  keeps COLUMNS by name           → the SELECT list
```

### Union Difference and Cartesian Product

```text
Union         R ∪ S  every row in either, deduplicated  → UNION
Difference    R − S  rows in R that are not in S        → EXCEPT
Intersection  R ∩ S  rows in both, = R − (R − S)        → INTERSECT
Product       R × S  every row of R with every row of S → CROSS JOIN
  ↳ The first three need union compatibility: same column count and
    types, position by position. Product does not.
```

---

## 4. Diagram: A Join Is a Product Plus a Selection

### Product Then Selection

```text
Step 1 — product customers × orders: 3 × 4 = 12 rows
  ┌──────────────────────────────────────────────────────┐
  │ Ada  ·5001  Ada  ·5002  Ada  ·5003  Ada  ·5004        │
  │ Bruno·5001  Bruno·5002  Bruno·5003  Bruno·5004        │
  │ Chen ·5001  Chen ·5002  Chen ·5003  Chen ·5004        │
  └───────────────────────┬──────────────────────────────┘
  Step 2 — selection σ    ▼  keep c.customer_id = o.customer_id
  ┌───────────────────────┴──────────────────────────────┐
  │ Ada  ·5001  Ada  ·5002  Chen ·5003 → project π → 3 rows
  └──────────────────────────────────────────────────────┘
```

### Reading the Diagram

`INNER JOIN` is defined as product-then-selection, and that definition is what makes a missing `ON` clause so destructive: without the selection step, all twelve rows survive. No real engine materializes the twelve rows first — it uses a hash or index lookup — but the answer is identical to the one this definition produces, which is why the definition is the thing worth memorizing.

---

## 5. Code Walkthrough: Every Join Type on the Same Two Tables

Every query below runs against the exact `customers` and `orders` rows from Section 3, so each result can be checked by eye.

### INNER LEFT RIGHT and FULL

```sql
SELECT c.name, o.order_id, o.amount   -- swap INNER for LEFT, RIGHT, or
FROM customers c INNER JOIN orders o  -- FULL for the other three results
  ON c.customer_id = o.customer_id;
```

```text
INNER JOIN — 3 rows      LEFT JOIN — 4 rows       RIGHT JOIN — 4 rows
| name  | oid  | amount | | name  | oid  | amount | | name  | oid  | amount |
|-------|------|--------| |-------|------|--------| |-------|------|--------|
| Ada   | 5001 | 120.00 | | Ada   | 5001 | 120.00 | | Ada   | 5001 | 120.00 |
| Ada   | 5002 |  45.00 | | Ada   | 5002 |  45.00 | | Ada   | 5002 |  45.00 |
| Chen  | 5003 | 300.00 | | Bruno | NULL |   NULL | | Chen  | 5003 | 300.00 |
                          | Chen  | 5003 | 300.00 | | NULL  | 5004 |  80.00 |
FULL JOIN — 5 rows: the three matched rows, plus Bruno with NULL order
columns, plus order 5004 with NULL customer columns. (oid = order_id.)
```

### CROSS and SELF

```sql
-- CROSS JOIN: bare product. No ON clause, so rows = left x right = 12.
SELECT c.name, o.order_id FROM customers c CROSS JOIN orders o;

-- SELF JOIN: one table under two aliases — "pairs of customers in the
-- same city, each pair listed once."
SELECT a.name AS first_name, b.name AS second_name, a.city
FROM customers a JOIN customers b
  ON a.city = b.city AND a.customer_id < b.customer_id;
--   -> one row: (Ada, Chen, Berlin). The < does two jobs: it stops a
--      row pairing with itself, and drops the mirror image (Chen, Ada)
--      that <> would also have produced.
```

### When a LEFT JOIN Silently Becomes an INNER JOIN

```sql
-- Intent: every customer, with their orders over 100 if any exist.
SELECT c.name, o.order_id, o.amount
FROM customers c LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE o.amount > 100;              -- Bruno vanishes. 2 rows, not 3.

-- Fix: the condition belongs in ON, evaluated while matching, not in
-- WHERE, which runs after the NULL-extended rows already exist.
SELECT c.name, o.order_id, o.amount FROM customers c LEFT JOIN orders o
  ON c.customer_id = o.customer_id AND o.amount > 100;   -- 3 rows.
```

```text
The LEFT JOIN produces Bruno with o.amount = NULL. WHERE then asks
NULL > 100, which is UNKNOWN — not TRUE — so the row is discarded.
  ↳ Any WHERE predicate on a right-table column other than IS NULL
    silently turns an outer join back into an inner join.
```

---

## 6. Comparing Joins to Set Operations

Both combine two result sets, but a join grows the row sideways while a set operation stacks rows on top of each other.

### Joins vs Set Operations

| | Join | Set Operation |
|---|---|---|
| Direction | Horizontal — columns from both inputs in one row | Vertical — rows from both inputs, same columns |
| Duplicate rows | Kept, and multiplied when a key matches more than once | Removed by all but `UNION ALL` |

### Duplicate Handling in UNION INTERSECT and EXCEPT

```text
warehouse_cities: Berlin, Lyon, Berlin    store_cities: Berlin, Berlin, Madrid
UNION ALL  → Berlin, Lyon, Berlin, Berlin, Berlin, Madrid  (6 rows)
UNION      → Berlin, Lyon, Madrid                          (3 rows)
INTERSECT  → Berlin                                        (1 row)
EXCEPT     → Lyon                                          (1 row)
  ↳ EXCEPT is warehouse minus store. Berlin appears twice on the left
    and is still fully removed — set difference, not subtraction of
    counts. Reversing the operands yields Madrid instead of Lyon.
```

### Takeaway

`UNION ALL` is the only one of the four that does not deduplicate, which also makes it the cheapest — the others must sort or hash the whole result to find duplicates. Use `UNION ALL` whenever the inputs are already known to be disjoint, and reach for `UNION` only when you genuinely want duplicates collapsed.

---

## 7. Common Mistakes

- **Putting a right-table filter in `WHERE` after a `LEFT JOIN`.** The outer join dutifully produces `NULL`-extended rows, and then `WHERE col > 100` evaluates to `UNKNOWN` for every one of them and throws them away. The result is an inner join wearing an outer join's syntax, and nothing warns you. Filters on the preserved side belong in `WHERE`; filters on the optional side belong in `ON`.
- **Omitting the `ON` clause and getting a Cartesian product.** Joining a 10,000-row table to a 10,000-row table without a predicate asks for 100 million rows. In the older comma-separated `FROM a, b` syntax this is a single missing `AND` away, which is one of the strongest arguments for explicit `JOIN ... ON` syntax.
- **Reaching for `UNION` when `UNION ALL` was meant.** `UNION` deduplicates, so two legitimately identical rows from different sources collapse into one and a count comes out short, while also paying for a sort the query never needed.

---

## 8. Hands-On Exercises

**Exercise 1:** Create the exact `customers` and `orders` tables from Section 3 with those seven rows, deliberately omitting the foreign key so order 5004 can reference a nonexistent customer 9. Confirm the row counts are 3 and 4.

**Exercise 2:** Run all four of `INNER`, `LEFT`, `RIGHT`, and `FULL JOIN` on `c.customer_id = o.customer_id` and check each result against the ASCII tables in Section 5 row for row. If your engine lacks `FULL JOIN`, reproduce it as a `LEFT JOIN` unioned with a `RIGHT JOIN`.

**Exercise 3:** Write the self-join that lists pairs of customers in the same city, then change `a.customer_id < b.customer_id` to `a.customer_id <> b.customer_id` and explain why the row count doubles.

**Exercise 4:** Reproduce the mistake from Section 7 on purpose. Write the `LEFT JOIN` with `WHERE o.amount > 100`, confirm Bruno disappears, then move the predicate into `ON` and confirm he returns with `NULL` order columns.

**Exercise 5:** Build `warehouse_cities` and `store_cities` with the values from Section 6 and run all four set operations, verifying the row counts 6, 3, 1, and 1. Then reverse the operands of `EXCEPT` and confirm the answer changes to Madrid.

---

## 9. Interview Q&A

**Q: In relational algebra terms, what is an inner join?**
It is a Cartesian product followed by a selection: pair every row of the left table with every row of the right, then keep only the pairs satisfying the `ON` predicate, and finally project the columns you asked for. Real engines never materialize the full product — they use hash joins, merge joins, or index lookups — but the result is defined to be identical to what that definition produces.

**Q: Why does adding a `WHERE` clause on the right table turn a `LEFT JOIN` into an `INNER JOIN`?**
The outer join runs first and produces rows for unmatched left-side records with every right-side column set to `NULL`. `WHERE` then evaluates afterwards, and any comparison against `NULL` yields `UNKNOWN` rather than `TRUE`, so those rows are filtered out and only matched rows survive. The fix is to move the condition into the `ON` clause, where it participates in matching instead of filtering the already-extended result.

**Q: What is the difference between `UNION` and `UNION ALL`?**
`UNION` removes duplicate rows from the combined result; `UNION ALL` keeps every row from both inputs. Because deduplication requires sorting or hashing the whole result, `UNION ALL` is meaningfully cheaper, so it is the right default whenever the inputs cannot overlap or duplicates are acceptable.

**Q: When would you use a self-join?**
Whenever rows in one table relate to other rows in the same table — an employee and their manager, a product and its substitute, or pairs of records sharing an attribute. The table is listed twice under different aliases so the two roles can be referenced separately, and an inequality like `a.id < b.id` is commonly added to avoid self-pairs and mirror-image duplicates.

**Q: A report's revenue total tripled after someone added a join. What is the likely cause?**
The joined table almost certainly has multiple matching rows per key, so each original row is duplicated once per match and its amount gets summed several times. The usual diagnosis is to compare row counts before and after the join; the usual fixes are to aggregate the right table down to one row per key in a subquery first, or to sum a distinct set of the original rows rather than the joined output.
