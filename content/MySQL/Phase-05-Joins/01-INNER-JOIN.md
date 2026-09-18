# INNER JOIN — Combining Rows From Two Tables

## Table of Contents

1. [What Is a JOIN?](#1-what-is-a-join)
2. [INNER JOIN Explained](#2-inner-join-explained)
3. [Venn Diagram (ASCII)](#3-venn-diagram-ascii)
4. [Syntax: ON Clause](#4-syntax-on-clause)
5. [Syntax: USING Clause](#5-syntax-using-clause)
6. [Table Aliases](#6-table-aliases)
7. [Full Example Schema](#7-full-example-schema)
8. [Basic INNER JOIN Queries](#8-basic-inner-join-queries)
9. [Three-Table JOIN](#9-three-table-join)
10. [JOIN on Multiple Conditions](#10-join-on-multiple-conditions)
11. [Implicit JOIN (Old Syntax — Avoid)](#11-implicit-join-old-syntax--avoid)
12. [JOIN vs Subquery](#12-join-vs-subquery)
13. [Under the Hood: Nested Loop Join](#13-under-the-hood-nested-loop-join)
14. [Common Mistakes](#14-common-mistakes)
15. [Hands-On Exercises](#15-hands-on-exercises)
16. [Interview Q&A](#16-interview-qa)

---

## 1. What Is a JOIN?

Here's a situation you'll hit constantly: your customer data lives in one
table, your order data lives in another. A page needs to show "Alice —
$120.00" — the customer's name sitting right next to her order amount. But
the name is in `customers` and the amount is in `orders`. How do you get them
into one result set?

You *could* fetch both tables separately and stitch them together in your
application code — loop over customers, loop over orders, match them up by
hand. That works, but it's slow, easy to get wrong, and wastes network
bandwidth pulling rows you'll just throw away. SQL has a better tool for this
exact job: the **JOIN**.

Think of it like two spreadsheets that share a column:

```
Spreadsheet A: Customers            Spreadsheet B: Orders
┌────┬─────────────┐                ┌────┬─────────────┬──────────┐
│ id │ name        │                │ id │ customer_id │ amount   │
├────┼─────────────┤                ├────┼─────────────┼──────────┤
│  1 │ Alice       │                │  1 │      1      │  120.00  │
│  2 │ Bob         │                │  2 │      1      │   45.00  │
│  3 │ Carol       │                │  3 │      2      │  310.00  │
└────┴─────────────┘                └────┴─────────────┴──────────┘
```

You want one combined result showing customer name alongside order amount.
A JOIN is the mechanism that "stitches" these two spreadsheets together on the
shared key `customer_id = customers.id` — the database does the matching for
you, in one query, instead of you doing it row by row in code.

Formally: a **JOIN** combines rows from two (or more) tables based on a
related column.

> **Memory hook:** JOIN is "VLOOKUP for two tables" — match rows by a shared key column and glue the matching rows together.

---

## 2. INNER JOIN Explained

Plain JOIN gives you rows from two tables glued together — but what about the
rows that *don't* have a match on the other side? Carol, say, has never
placed an order. Should she show up in a customer/order report at all?

**INNER JOIN** says no. It returns only the rows where the ON condition is
TRUE on BOTH sides. If a row in the left table has no matching row in the
right table (or vice versa), it's excluded from the result entirely — not
shown with blanks, just left out.

Walk through it row by row:

```
customers          orders              INNER JOIN result
──────────         ──────────          ──────────────────────────────────────
id  name           id  cust_id amt     id  name   order_id  amount
─── ────           ─── ─────── ───     ─── ────   ────────  ──────
 1  Alice    +      1    1    120  →    1  Alice      1      120.00
 1  Alice    +      2    1     45  →    1  Alice      2       45.00
 2  Bob      +      3    2    310  →    2  Bob        3      310.00
 3  Carol    ✗  (no matching order — Carol is EXCLUDED)
```

Key point: Carol has no orders, so she does not appear in an INNER JOIN.
If you need Carol in the result anyway (e.g. to show "0 orders"), that's a
job for LEFT JOIN (Phase 2) — INNER JOIN by design only keeps the overlap.

> **Memory hook:** INNER JOIN = "only show me rows that exist on both sides — no matching partner, no seat at the table."

---

## 3. Venn Diagram (ASCII)

```
       Customers                 Orders
    ┌─────────────┐           ┌─────────────┐
    │             │           │             │
    │  Carol      │           │  orphan     │
    │  (no order) │           │  orders     │
    │         ┌───┴───────────┴───┐         │
    │         │   INNER JOIN      │         │
    │         │   (overlap only)  │         │
    │         │   Alice, Bob      │         │
    │         └───┬───────────┬───┘         │
    │             │           │             │
    └─────────────┘           └─────────────┘
```

If you've ever drawn two overlapping circles to explain "what's shared between
these two groups" — that's exactly what's happening here. INNER JOIN =
the overlapping region only. Carol and the orphan orders sit in the
non-overlapping slivers, and INNER JOIN throws them away.

---

## 4. Syntax: ON Clause

The basic shape of a JOIN query looks like this:

```sql
SELECT columns
FROM   table_a
INNER JOIN table_b ON table_a.fk_column = table_b.pk_column;
```

The `ON` clause is where you tell MySQL *how* the two tables relate — which
column on the left matches which column on the right.

The keyword `INNER` is optional — plain `JOIN` defaults to INNER JOIN:

```sql
-- These are identical:
SELECT * FROM customers INNER JOIN orders ON customers.id = orders.customer_id;
SELECT * FROM customers        JOIN orders ON customers.id = orders.customer_id;
```

Full example:

```sql
SELECT
    customers.id        AS customer_id,
    customers.name      AS customer_name,
    orders.id           AS order_id,
    orders.amount
FROM customers
JOIN orders ON customers.id = orders.customer_id;
```

Result:

```
┌─────────────┬───────────────┬──────────┬────────┐
│ customer_id │ customer_name │ order_id │ amount │
├─────────────┼───────────────┼──────────┼────────┤
│      1      │ Alice         │    1     │ 120.00 │
│      1      │ Alice         │    2     │  45.00 │
│      2      │ Bob           │    3     │ 310.00 │
└─────────────┴───────────────┴──────────┴────────┘
```

---

## 5. Syntax: USING Clause

Writing `ON customers.customer_id = orders.customer_id` over and over feels
redundant when both sides literally have the same column name. MySQL gives
you a shorthand for exactly that case: `USING(column_name)`.

```sql
-- ON clause version:
SELECT * FROM customers JOIN orders ON customers.customer_id = orders.customer_id;

-- USING clause version (only when column name is identical in both tables):
SELECT * FROM customers JOIN orders USING (customer_id);
```

Bonus: `USING` also de-duplicates the column in `SELECT *` — it appears only
once in the result, instead of once per table, which can be useful.

| Clause | When to use it | Gotcha |
|---|---|---|
| `ON a.x = b.y` | Column names differ, or you need extra conditions | More verbose |
| `USING (col)` | Same column name on both sides | Column collapses to one in `SELECT *`; fails if names don't match exactly |

Limitation: `USING` only works when the column names match exactly. Use `ON`
when the keys have different names (e.g., `customers.id` vs `orders.customer_id`).

---

## 6. Table Aliases

Typing full table names in every column reference is verbose. Use aliases:

```sql
-- Without aliases (verbose):
SELECT customers.name, orders.amount
FROM   customers
JOIN   orders ON customers.id = orders.customer_id;

-- With aliases (clean):
SELECT c.name, o.amount
FROM   customers AS c
JOIN   orders    AS o ON c.id = o.customer_id;

-- AS keyword is optional for aliases:
SELECT c.name, o.amount
FROM   customers c
JOIN   orders    o ON c.id = o.customer_id;
```

Convention: single-letter aliases (`c`, `o`, `p`) or short abbreviations
(`cust`, `ord`, `prod`) are common in production SQL.

Rules for aliases:
- Alias is scoped to the query — usable in SELECT, WHERE, ORDER BY, HAVING
- Cannot be used in the WHERE clause of the same SELECT level if defined there
  (use subquery or CTE in that case)

---

## 7. Full Example Schema

Before running any of the queries below, you need something to query
against. Every example and exercise in this file reuses the same four
tables and sample rows, so set them up once here.

```sql
CREATE TABLE customers (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(150) UNIQUE,
    city       VARCHAR(80),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id           INT PRIMARY KEY AUTO_INCREMENT,
    name         VARCHAR(100) NOT NULL,
    category     VARCHAR(50),
    price        DECIMAL(10,2) NOT NULL,
    stock        INT DEFAULT 0
);

CREATE TABLE orders (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    order_date  DATE NOT NULL,
    status      ENUM('pending','shipped','delivered','cancelled') DEFAULT 'pending',
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE order_items (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    order_id   INT NOT NULL,
    product_id INT NOT NULL,
    quantity   INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id)   REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

Sample data:

```sql
INSERT INTO customers VALUES
(1,'Alice','alice@example.com','Sydney','2024-01-10'),
(2,'Bob',  'bob@example.com',  'Melbourne','2024-02-15'),
(3,'Carol','carol@example.com','Brisbane','2024-03-20'),
(4,'Dave', 'dave@example.com', 'Sydney','2024-04-01');

INSERT INTO products VALUES
(1,'Laptop',   'Electronics', 1299.99, 15),
(2,'Mouse',    'Electronics',   29.99, 80),
(3,'Desk',     'Furniture',    499.00, 10),
(4,'Headset',  'Electronics',   79.99, 40),
(5,'Chair',    'Furniture',    299.00, 25);

INSERT INTO orders VALUES
(1, 1, '2024-05-01','delivered'),
(2, 1, '2024-05-15','shipped'),
(3, 2, '2024-05-20','pending'),
(4, 2, '2024-06-01','delivered');

INSERT INTO order_items VALUES
(1, 1, 1, 1, 1299.99),   -- Alice order 1: 1x Laptop
(2, 1, 2, 2,   29.99),   -- Alice order 1: 2x Mouse
(3, 2, 4, 1,   79.99),   -- Alice order 2: 1x Headset
(4, 3, 3, 1,  499.00),   -- Bob   order 3: 1x Desk
(5, 4, 5, 2,  299.00);   -- Bob   order 4: 2x Chair
```

Note: Carol (id=3) and Dave (id=4) have no orders — useful for LEFT JOIN demos.

---

## 8. Basic INNER JOIN Queries

With the schema and data in place, here are the everyday queries you'll
actually reach for — the same JOIN shape, applied to a few common questions.

### 8a. List all orders with customer names

```sql
SELECT
    o.id           AS order_id,
    c.name         AS customer_name,
    o.order_date,
    o.status
FROM orders o
JOIN customers c ON o.customer_id = c.id
ORDER BY o.order_date;
```

### 8b. Order totals per customer

```sql
SELECT
    c.name                          AS customer_name,
    COUNT(o.id)                     AS total_orders,
    SUM(oi.quantity * oi.unit_price) AS total_spent
FROM customers c
JOIN orders      o  ON c.id        = o.customer_id
JOIN order_items oi ON o.id        = oi.order_id
GROUP BY c.id, c.name
ORDER BY total_spent DESC;
```

### 8c. All products in delivered orders

```sql
SELECT
    c.name          AS customer,
    p.name          AS product,
    oi.quantity,
    oi.unit_price,
    o.order_date
FROM orders      o
JOIN customers   c  ON o.customer_id = c.id
JOIN order_items oi ON o.id          = oi.order_id
JOIN products    p  ON oi.product_id = p.id
WHERE o.status = 'delivered'
ORDER BY o.order_date, p.name;
```

### 8d. Filter during the JOIN (vs WHERE — same result, different clarity)

```sql
-- Filter in WHERE (more common):
SELECT c.name, o.id, o.status
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'shipped';

-- Filter in ON (same rows for INNER JOIN, different behaviour for LEFT JOIN!):
SELECT c.name, o.id, o.status
FROM customers c
JOIN orders o ON c.id = o.customer_id AND o.status = 'shipped';
```

For INNER JOIN, both produce the same result. For LEFT JOIN they differ —
see Phase 2 for details.

---

## 9. Three-Table JOIN

Two tables get you customer + order. But what if you need to know *what
product* was in that order? That data lives in a third table,
`order_items`, and a fourth, `products`. Do you need some special
"multi-way JOIN" syntax for this? No — you just chain multiple JOINs
linearly, one after another, and each JOIN adds one more table to the mix:

```
customers ──── orders ──── order_items ──── products
    id    1:N    id    1:N      id      N:1    id
```

```sql
-- Show every item purchased, with customer name and product name
SELECT
    c.name                          AS customer,
    p.name                          AS product,
    p.category,
    oi.quantity,
    oi.unit_price,
    ROUND(oi.quantity * oi.unit_price, 2) AS line_total,
    o.order_date
FROM customers   c
JOIN orders      o  ON c.id         = o.customer_id
JOIN order_items oi ON o.id         = oi.order_id
JOIN products    p  ON oi.product_id = p.id
ORDER BY c.name, o.order_date, p.name;
```

Expected output:

```
┌──────────┬─────────┬─────────────┬──────────┬────────────┬────────────┬────────────┐
│ customer │ product │ category    │ quantity │ unit_price │ line_total │ order_date │
├──────────┼─────────┼─────────────┼──────────┼────────────┼────────────┼────────────┤
│ Alice    │ Laptop  │ Electronics │    1     │  1299.99   │  1299.99   │ 2024-05-01 │
│ Alice    │ Mouse   │ Electronics │    2     │    29.99   │    59.98   │ 2024-05-01 │
│ Alice    │ Headset │ Electronics │    1     │    79.99   │    79.99   │ 2024-05-15 │
│ Bob      │ Desk    │ Furniture   │    1     │   499.00   │   499.00   │ 2024-05-20 │
│ Bob      │ Chair   │ Furniture   │    2     │   299.00   │   598.00   │ 2024-06-01 │
└──────────┴─────────┴─────────────┴──────────┴────────────┴────────────┴────────────┘
```

Each JOIN in the chain narrows nothing by itself — it just adds another
table's columns onto the row, matched by its own ON condition. Four tables,
three JOINs, one flat result.

> **Memory hook:** chaining JOINs is like adding train carriages — each `JOIN ... ON ...` hitches one more table onto the row you're building.

---

## 10. JOIN on Multiple Conditions

A single `column = column` condition is the common case, but what if two
columns together define the match — like a composite key made of
`warehouse_id` + `product_id`? You need multiple conditions in the ON
clause, joined with `AND`:

```sql
-- Order items that exactly match both order AND a specific price tier
SELECT *
FROM order_items oi
JOIN products    p  ON oi.product_id = p.id
                   AND oi.unit_price  = p.price;   -- no discount applied
```

Multiple conditions use `AND` inside the ON clause:

```sql
-- Match on composite key (e.g., warehouse + product_id)
SELECT *
FROM inventory     i
JOIN restock_log   r  ON i.warehouse_id = r.warehouse_id
                     AND i.product_id   = r.product_id;
```

This is equivalent to a single condition on a composite key but written
explicitly. Very common in data warehousing with composite surrogate keys.

---

## 11. Implicit JOIN (Old Syntax — Avoid)

You'll still run into this in older codebases, so it's worth recognizing:
before SQL-92 introduced the `JOIN` keyword, tables were combined in the
FROM clause with plain commas, and the join condition was smuggled into the
WHERE clause instead:

```sql
-- OLD implicit syntax (avoid):
SELECT c.name, o.amount
FROM   customers c, orders o
WHERE  c.id = o.customer_id;

-- MODERN explicit syntax (use this):
SELECT c.name, o.amount
FROM   customers c
JOIN   orders    o ON c.id = o.customer_id;
```

Why avoid implicit JOIN:
1. Easy to accidentally produce a Cartesian product if you forget the WHERE
2. Hard to distinguish join conditions from filter conditions in WHERE
3. No clean way to express LEFT JOIN or CROSS JOIN
4. Explicit JOIN is required by all modern SQL style guides

> **Memory hook:** implicit joins hide the join condition inside WHERE — one forgotten line and you've silently built a Cartesian product.

---

## 12. JOIN vs Subquery

Here's a question that trips people up: "show customers who have placed at
least one order" — do you reach for a JOIN, or a subquery? Both can answer
it. Knowing which is clearer (and which performs better) matters.

### Same question, two approaches

Question: "Show customers who have placed at least one order."

```sql
-- Using JOIN (+ DISTINCT to deduplicate):
SELECT DISTINCT c.id, c.name
FROM customers c
JOIN orders    o ON c.id = o.customer_id;

-- Using EXISTS subquery:
SELECT c.id, c.name
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);

-- Using IN subquery:
SELECT id, name
FROM customers
WHERE id IN (SELECT customer_id FROM orders);
```

### Performance comparison

```
┌──────────────────────┬────────────────────────────────────────────────────────┐
│ Approach             │ Notes                                                  │
├──────────────────────┼────────────────────────────────────────────────────────┤
│ JOIN                 │ Optimizer can use indexes on both sides of the join.   │
│                      │ Good when you also need columns from the joined table. │
├──────────────────────┼────────────────────────────────────────────────────────┤
│ EXISTS subquery      │ Short-circuits on first match — good for large tables. │
│                      │ Optimizer often rewrites to a semi-join internally.    │
├──────────────────────┼────────────────────────────────────────────────────────┤
│ IN subquery          │ Can be slow if inner query is not correlated.          │
│                      │ Modern MySQL optimizer rewrites IN to semi-join too.   │
└──────────────────────┴────────────────────────────────────────────────────────┘
```

Rule of thumb:
- Need columns from both tables → use JOIN
- Just checking existence → EXISTS is clearest, JOIN with DISTINCT also works
- The query planner in MySQL 8+ usually produces the same plan for all three

### When a subquery is cleaner

```sql
-- Subquery is cleaner here: average order value per customer vs grand average
SELECT c.name, o_sub.avg_amount
FROM customers c
JOIN (
    SELECT customer_id, AVG(total) AS avg_amount
    FROM (
        SELECT order_id, customer_id, SUM(quantity * unit_price) AS total
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        GROUP BY order_id, customer_id
    ) t
    GROUP BY customer_id
) o_sub ON c.id = o_sub.customer_id;
```

> **Memory hook:** need columns from both tables → JOIN. Just checking "does at least one exist?" → EXISTS. MySQL 8+ often plans them identically anyway.

---

## 13. Under the Hood: Nested Loop Join

You've written a dozen JOINs by now — but what does MySQL actually *do* when
it runs one? It's not magic; it's a fairly simple algorithm underneath, and
understanding it explains why some JOINs are fast and others crawl.

MySQL's default join algorithm is the **Nested Loop Join (NLJ)**:

```
For each row in outer_table:
    For each row in inner_table where ON condition matches:
        Emit combined row
```

Performance with index on inner table join column:
- Outer table: full scan O(n)
- Inner table: index lookup O(log m) per outer row
- Total: O(n log m) — acceptable

Performance without index on inner table:
- Both tables: full scan
- Total: O(n x m) — Cartesian-like cost, very slow on large tables

```
EXPLAIN SELECT c.name, o.amount
FROM customers c
JOIN orders o ON c.id = o.customer_id;

+----+--------+-------+--------+-------------------+
| id | type   | table | rows   | Extra             |
+----+--------+-------+--------+-------------------+
|  1 | ALL    | c     |      4 |                   |
|  1 | ref    | o     |      1 | Using index       |
+----+--------+-------+--------+-------------------+
```

`ref` on the inner table means MySQL is using an index for the join lookup —
this is what you want. `ALL` on inner would mean a full table scan per outer row.

**Always index foreign key columns** (the columns on the "many" side of 1:N).
MySQL does NOT create indexes on foreign keys automatically (unlike PostgreSQL).

> **Memory hook:** a JOIN without an index on the inner table is a nested loop doing a full scan for every single outer row — O(n x m) pain waiting to happen.

---

## 14. Common Mistakes

These are the mistakes that show up over and over in real code — worth
knowing them by name so you spot them instantly.

### Mistake 1: Forgetting the ON clause (Cartesian product)

```sql
-- BUG: Missing ON — produces n x m rows!
SELECT * FROM customers JOIN orders;

-- Fix:
SELECT * FROM customers JOIN orders ON customers.id = orders.customer_id;
```

### Mistake 2: Ambiguous column names

```sql
-- BUG: Which table's 'id' is this?
SELECT id, name FROM customers JOIN orders ON customers.id = orders.customer_id;
-- ERROR: Column 'id' in field list is ambiguous

-- Fix: qualify every column when joining:
SELECT customers.id, customers.name, orders.id AS order_id
FROM customers JOIN orders ON customers.id = orders.customer_id;
```

### Mistake 3: Duplicate rows from 1:N join without GROUP BY or DISTINCT

```sql
-- If Alice has 3 orders, her name appears 3 times:
SELECT c.name FROM customers c JOIN orders o ON c.id = o.customer_id;
-- Alice, Alice, Alice, Bob, Bob, ...

-- If you only want unique customer names:
SELECT DISTINCT c.name FROM customers c JOIN orders o ON c.id = o.customer_id;
```

### Mistake 4: Not indexing the join column

Foreign key columns on the "many" side must be indexed for performance.

```sql
-- Add index if missing:
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

> **Memory hook:** no ON = Cartesian product, no alias = ambiguous column, no DISTINCT/GROUP BY = duplicated rows, no index = slow scan. Four mistakes, four one-line fixes.

---

## 15. Hands-On Exercises

**Exercise 1**
List every order with the customer's name, city, and order status. Sort by
order date descending. (Use the schema from Section 7.)

```sql
-- Your answer:
SELECT
    c.name,
    c.city,
    o.id      AS order_id,
    o.status,
    o.order_date
FROM customers c
JOIN orders    o ON c.id = o.customer_id
ORDER BY o.order_date DESC;
```

**Exercise 2**
Show the total number of items ordered per product (product name, total
quantity sold). Exclude products that have never been ordered. Sort by
total quantity descending.

```sql
-- Your answer:
SELECT
    p.name              AS product,
    SUM(oi.quantity)    AS total_qty_sold
FROM products    p
JOIN order_items oi ON p.id = oi.product_id
GROUP BY p.id, p.name
ORDER BY total_qty_sold DESC;
```

**Exercise 3**
List customers who have placed more than one order, along with their order
count. Use JOIN + GROUP BY + HAVING.

```sql
-- Your answer:
SELECT
    c.name,
    COUNT(o.id) AS order_count
FROM customers c
JOIN orders    o ON c.id = o.customer_id
GROUP BY c.id, c.name
HAVING COUNT(o.id) > 1;
```

**Exercise 4**
For each order, show the order id, customer name, number of distinct products
in that order, and the order total (sum of quantity * unit_price).

```sql
-- Your answer:
SELECT
    o.id                                    AS order_id,
    c.name                                  AS customer,
    COUNT(DISTINCT oi.product_id)           AS distinct_products,
    SUM(oi.quantity * oi.unit_price)        AS order_total
FROM orders      o
JOIN customers   c  ON o.customer_id  = c.id
JOIN order_items oi ON o.id           = oi.order_id
GROUP BY o.id, c.name
ORDER BY order_total DESC;
```

**Exercise 5**
Find the most expensive single item ever purchased (highest unit_price in
order_items). Return the product name, customer name, and unit_price.

```sql
-- Your answer:
SELECT
    p.name       AS product,
    c.name       AS customer,
    oi.unit_price
FROM order_items oi
JOIN orders    o  ON oi.order_id   = o.id
JOIN customers c  ON o.customer_id = c.id
JOIN products  p  ON oi.product_id = p.id
ORDER BY oi.unit_price DESC
LIMIT 1;
```

---

## 16. Interview Q&A

**Q1: What is the difference between JOIN and INNER JOIN?**
A: None — `JOIN` is shorthand for `INNER JOIN`. The keyword `INNER` is optional
and both behave identically. Using just `JOIN` is more common in practice.

**Q2: What happens if you omit the ON clause in a JOIN?**
A: MySQL produces a Cartesian product — every row from the left table is
combined with every row from the right table. For tables with 1000 rows each,
you get 1,000,000 rows. This is rarely what you want and is a serious bug.

**Q3: What is a Cartesian product in SQL context?**
A: A result set where every row from table A is paired with every row from
table B, regardless of any relationship. Produced by a CROSS JOIN or by
forgetting the ON clause. Result size = rows(A) x rows(B).

**Q4: Why does INNER JOIN exclude rows with no match?**
A: The ON condition evaluates to FALSE (or NULL) for unmatched rows. INNER JOIN
only keeps rows where the condition is TRUE on both sides. Use LEFT JOIN to
preserve unmatched rows from one side.

**Q5: When would you use USING(col) instead of ON t1.col = t2.col?**
A: When both tables have the same column name for the join key, USING is
slightly shorter. It also de-duplicates that column in SELECT *. Use ON when
the column names differ or when clarity is paramount.

**Q6: How do you join three or more tables?**
A: Chain JOIN clauses. Each JOIN adds one table. The optimizer determines the
actual join order regardless of the written order.

**Q7: Is JOIN order important in SQL?**
A: The written order does not affect correctness for INNER JOINs — MySQL's
query optimizer reorders joins internally for best performance. For OUTER JOINs
the written order determines which table is "left" or "right" and thus which
NULLs appear, so order matters semantically.

**Q8: What is the difference between filtering in ON vs WHERE for INNER JOIN?**
A: For INNER JOIN, both produce the same result. Placing a condition in ON
vs WHERE is a style choice for INNER JOIN. However, for LEFT JOIN they behave
differently (covered in Phase 2).

**Q9: What indexes improve JOIN performance?**
A: Index the column on the "inner" (probed) side of the join. For a 1:N
relationship, index the foreign key column on the "many" table. For the "one"
table, the primary key index is usually already there.

**Q10: What does EXPLAIN show for a JOIN query?**
A: EXPLAIN shows one row per table in the query. The `type` column indicates
join access type: `eq_ref` means unique index lookup (best for joined tables),
`ref` means non-unique index, `ALL` means full table scan (worst).

**Q11: What is a semi-join?**
A: A semi-join returns rows from the left table where at least one matching row
exists in the right table, but does not duplicate left rows and does not
include columns from the right table. Expressed in SQL as EXISTS or IN.
MySQL's optimizer often converts these to semi-join internally.

**Q12: Can you JOIN on inequality conditions (>, <, !=)?**
A: Yes. `ON a.price > b.min_price AND a.price <= b.max_price` is valid. Called
a non-equi join. These cannot use standard B-tree index lookups efficiently and
often result in nested loop scans.

**Q13: What is a self-join?**
A: Joining a table to itself using two different aliases. Classic use: employee
hierarchy where `employees e1 JOIN employees e2 ON e1.manager_id = e2.id`.
Covered in depth in Phase 3.

**Q14: When should you use JOIN vs a subquery?**
A: Use JOIN when you need columns from both tables in the output. Use EXISTS
for pure existence checks. In MySQL 8+, the optimizer often produces identical
plans. Prefer whichever is more readable for your use case.

**Q15: What is the result of joining on NULL = NULL?**
A: NULL = NULL evaluates to NULL (not TRUE) in SQL. So rows where the join
column contains NULL on either side will not match and will be excluded from
an INNER JOIN. This is a common gotcha with nullable foreign keys.
