# 03 — Correlated Subqueries & LATERAL Joins

## Table of Contents
1. [Correlated vs Uncorrelated Subqueries](#1-correlated-vs-uncorrelated-subqueries)
2. [Semi-Joins and Anti-Joins: `EXISTS` vs `IN`](#2-semi-joins-and-anti-joins-exists-vs-in)
3. [The Dangerous `NOT IN` with NULL Trap](#3-the-dangerous-not-in-with-null-trap)
4. [What is a `LATERAL` Join?](#4-what-is-a-lateral-join)
5. [`CROSS JOIN LATERAL` vs `LEFT JOIN LATERAL`](#5-cross-join-lateral-vs-left-join-lateral)
6. [Mastering the "Top-N Rows Per Category" Pattern](#6-mastering-the-top-n-rows-per-category-pattern)
7. [Invoking Set-Returning Functions via LATERAL](#7-invoking-set-returning-functions-via-lateral)
8. [Hands-On Practice](#8-hands-on-practice)
9. [Summary & Key Takeaways](#9-summary--key-takeaways)

---

## 1. Correlated vs Uncorrelated Subqueries

- **Uncorrelated Subquery:** Executes once independently of the outer query.
  ```sql
  -- Subquery runs 1 time, returns a scalar, then outer query executes
  SELECT * FROM products WHERE price > (SELECT AVG(price) FROM products);
  ```
- **Correlated Subquery:** References columns from the outer query, conceptually running once for every candidate row evaluated by the outer query:
  ```sql
  SELECT p.name, p.category_id, p.price
  FROM products p
  WHERE p.price > (
      SELECT AVG(sub.price) 
      FROM products sub 
      WHERE sub.category_id = p.category_id -- Correlated reference!
  );
  ```

PostgreSQL's optimizer attempts to "flatten" correlated subqueries into internal hash joins, but poorly written subqueries can still degrade into expensive $O(N^2)$ loops.

---

## 2. Semi-Joins and Anti-Joins: `EXISTS` vs `IN`

When verifying whether a related record exists:

```sql
-- Pattern A: IN (Evaluates subquery list)
SELECT * FROM customers WHERE id IN (SELECT customer_id FROM orders);

-- Pattern B: EXISTS (Short-circuits immediately upon first match)
SELECT * FROM customers c 
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

In modern PostgreSQL, the optimizer rewrites both into an internal **Semi-Join**. However, with negation (`NOT IN` vs `NOT EXISTS`), there is a critical behavioral difference.

---

## 3. The Dangerous `NOT IN` with NULL Trap

Consider this query:
```sql
SELECT * FROM customers WHERE id NOT IN (SELECT customer_id FROM orders);
```

> [!CAUTION]
> **The NULL Trap:** If even a **single row** in the `orders` table has `customer_id IS NULL`, SQL ternary logic causes `id NOT IN (..., NULL)` to evaluate to `UNKNOWN`. As a result, the entire query returns **ZERO ROWS**, silently failing in production!

### The Safe Production Rule:
**Always use `NOT EXISTS` instead of `NOT IN`:**
```sql
-- 100% Safe against NULL values:
SELECT * FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

---

## 4. What is a `LATERAL` Join?

In standard SQL joins, the right-hand side of a `JOIN` cannot see or reference columns from tables listed to its left.

The **`LATERAL` keyword** removes this restriction! A `LATERAL` join behaves like a **SQL `for-each` loop**, allowing the subquery to reference columns from preceding tables in the `FROM` clause:

```sql
SELECT c.name, recent_order.*
FROM customers c
CROSS JOIN LATERAL (
    SELECT o.id, o.amount, o.order_date
    FROM orders o
    WHERE o.customer_id = c.id -- References outer customer row 'c'!
    ORDER BY o.order_date DESC
    LIMIT 1
) recent_order;
```

---

## 5. `CROSS JOIN LATERAL` vs `LEFT JOIN LATERAL`

- **`CROSS JOIN LATERAL` (Inner Join):** If the subquery yields 0 rows for a given parent, that parent is omitted from the final result.
- **`LEFT JOIN LATERAL` (Outer Join):** If the subquery yields 0 rows, the parent is retained, and all subquery columns are populated with `NULL`.

---

## 6. Mastering the "Top-N Rows Per Category" Pattern

One of the most frequent database interview and real-world queries is: **"Find the 3 most expensive products in EACH category."**

Before `LATERAL`, developers had to compute window functions across the entire dataset. With `LATERAL`, it is clean, declarative, and index-accelerated:

```sql
SELECT 
    c.name AS category_name,
    top_items.product_name,
    top_items.price
FROM categories c
LEFT JOIN LATERAL (
    SELECT p.name AS product_name, p.price
    FROM products p
    WHERE p.category_id = c.id
    ORDER BY p.price DESC
    LIMIT 3 -- Fetch strictly top 3 per category!
) top_items ON true;
```

With an index on `products(category_id, price DESC)`, PostgreSQL performs a lightning-fast indexed limit scan for each category!

---

## 7. Invoking Set-Returning Functions via LATERAL

`LATERAL` is implicitly enabled when invoking set-returning functions like `unnest()` or `jsonb_to_recordset()`:

```sql
CREATE TABLE orders_with_items (
    order_id INT PRIMARY KEY,
    line_items JSONB NOT NULL
);

-- Explode nested JSON line items into relational columns
SELECT 
    o.order_id,
    item.sku,
    item.quantity,
    item.price
FROM orders_with_items o
CROSS JOIN LATERAL jsonb_to_recordset(o.line_items) AS item(
    sku TEXT, 
    quantity INT, 
    price NUMERIC(10, 2)
);
```

---

## 8. Hands-On Practice

1. Create a `departments` and an `employees` table.
2. Populate 5 departments and 20 employees per department with varied salaries.
3. Create a composite index on `employees(department_id, salary DESC)`.
4. Write a query using `LEFT JOIN LATERAL` to retrieve the top 2 highest-paid employees in every department.
5. Run `EXPLAIN` to verify that the query utilizes the composite index.

---

## 9. Summary & Key Takeaways

1. Uncorrelated subqueries execute once; correlated subqueries depend on the outer tuple.
2. Avoid `NOT IN` because a single `NULL` silently voids all results; use `NOT EXISTS`.
3. `LATERAL` allows subqueries to reference preceding table columns like a nested loop.
4. `LEFT JOIN LATERAL` is the most performant and readable solution for Top-N per group queries.
5. Set-returning functions like `unnest()` and `jsonb_to_recordset()` use lateral semantics.
