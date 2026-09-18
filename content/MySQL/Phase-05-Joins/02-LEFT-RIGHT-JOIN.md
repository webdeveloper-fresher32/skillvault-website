# LEFT JOIN and RIGHT JOIN — Preserving Unmatched Rows

## Table of Contents

1. [The Problem INNER JOIN Cannot Solve](#1-the-problem-inner-join-cannot-solve)
2. [LEFT JOIN Explained](#2-left-join-explained)
3. [ASCII Diagram: LEFT JOIN](#3-ascii-diagram-left-join)
4. [RIGHT JOIN Explained](#4-right-join-explained)
5. [NULL Padding Behaviour](#5-null-padding-behaviour)
6. [Full Syntax](#6-full-syntax)
7. [Full Example Schema](#7-full-example-schema)
8. [Practical LEFT JOIN Queries](#8-practical-left-join-queries)
9. [The Anti-Join Pattern (IS NULL Trick)](#9-the-anti-join-pattern-is-null-trick)
10. [Real Anti-Join Use Cases](#10-real-anti-join-use-cases)
11. [Filtering in ON vs WHERE (Critical Difference)](#11-filtering-in-on-vs-where-critical-difference)
12. [RIGHT JOIN — Mirror of LEFT JOIN](#12-right-join--mirror-of-left-join)
13. [Converting LEFT to RIGHT and Back](#13-converting-left-to-right-and-back)
14. [Why LEFT JOIN Is Preferred](#14-why-left-join-is-preferred)
15. [Common Mistakes](#15-common-mistakes)
16. [Hands-On Exercises](#16-hands-on-exercises)
17. [Interview Q&A](#17-interview-qa)

---

## 1. The Problem INNER JOIN Cannot Solve

Your boss walks over with a request:

> "List all customers, including those who have never placed an order. For
> customers with orders, show their latest order date."

Sounds simple. So you reach for the JOIN from the last lesson and run it. And the report looks... fine. Until someone from sales asks, "wait, where's Carol? She's one of our biggest accounts, she just hasn't ordered *yet*."

Here's what actually happened:

```sql
-- INNER JOIN: Carol and Dave are MISSING
SELECT c.name, o.order_date
FROM customers c
JOIN orders o ON c.id = o.customer_id;

-- Result:
-- Alice | 2024-05-01
-- Alice | 2024-05-15
-- Bob   | 2024-05-20
-- Bob   | 2024-06-01
-- (Carol and Dave are gone!)
```

Remember what INNER JOIN does — it keeps only the overlap, the rows that match on *both* sides. Carol and Dave have zero rows in `orders`, so there's nothing for them to match against, and INNER JOIN quietly throws them out. No error, no warning. Just... gone. That's exactly the kind of silent data loss that makes a business report wrong without anyone noticing.

Think of it like a guest list for an event, cross-referenced against who actually checked in. If you only print the names of people who checked in, you lose track of who was invited but never showed. Sometimes "didn't show up" *is* the data you care about.

LEFT JOIN is built for exactly this situation: keep everyone on the guest list, and just leave a blank next to the names that never checked in.

---

## 2. LEFT JOIN Explained

**LEFT JOIN** returns ALL rows from the LEFT table, plus matching rows from
the RIGHT table. If no match exists on the right side, the right-side columns
are filled with NULL.

That's the formal definition — but the important word there is "ALL." No customer ever disappears because of a LEFT JOIN. The worst that happens to a customer with no orders is that their order columns come back empty (NULL).

```
LEFT table (customers)    RIGHT table (orders)     LEFT JOIN result
──────────────────────    ────────────────────     ─────────────────────────────────
id   name                 id  cust_id  date        name   order_id  date
───  ────                 ─── ───────  ────        ─────  ────────  ──────────
 1   Alice         ──→     1     1    05-01   →    Alice       1    2024-05-01
 1   Alice         ──→     2     1    05-15   →    Alice       2    2024-05-15
 2   Bob           ──→     3     2    05-20   →    Bob         3    2024-05-20
 2   Bob           ──→     4     2    06-01   →    Bob         4    2024-06-01
 3   Carol         ──→  (no match)             →    Carol    NULL    NULL
 4   Dave          ──→  (no match)             →    Dave     NULL    NULL
```

All four customers appear. Carol and Dave have NULL for all order columns.

That's the whole trick of LEFT JOIN in one picture: nobody from the left table gets dropped, ever. Rows that don't match just get padded with NULL instead of disappearing.

> **Memory hook:** LEFT JOIN keeps every name on the guest list — it just leaves the "checked in at" column blank for the no-shows.

---

## 3. ASCII Diagram: LEFT JOIN

```
       LEFT table             RIGHT table
    ┌──────────────┐        ┌──────────────┐
    │              │        │              │
    │  Carol       │        │  orphaned    │
    │  Dave        │        │  right rows  │
    │ (no orders)  │        │  (excluded)  │
    │          ┌───┴────────┴───┐          │
    │  ALL     │  INNER region  │          │
    │  left    │  (matched rows)│          │
    │  rows    │                │          │
    │  appear  └───┬────────────┴───┐      │
    │              │                │      │
    └──────────────┘                └──────┘
    ←─────────── LEFT JOIN ──────────────→
    (entire left circle + overlap only from right)
```

The LEFT JOIN covers the entire left circle. Rows that exist only on the right
(no matching left row) are excluded.

Notice the asymmetry: the *left* circle is fully covered, but the *right* circle only contributes where it overlaps. That asymmetry is the entire point of LEFT JOIN — it's a deliberate choice about which side you refuse to lose rows from.

---

## 4. RIGHT JOIN Explained

Now flip the question around: what if the table you don't want to lose rows from happens to be written second in your query? That's exactly what **RIGHT JOIN** is for.

**RIGHT JOIN** is the exact mirror: ALL rows from the RIGHT table are returned,
plus matching rows from the LEFT table. Unmatched left-side columns are NULL.

```
LEFT table (orders)       RIGHT table (customers)  RIGHT JOIN result
──────────────────        ───────────────────────  ─────────────────────────────
id   cust_id              id   name                order_id  name
───  ───────              ───  ────                ────────  ────
 1      1           ──→    1   Alice      →             1    Alice
 2      1           ──→    1   Alice      →             2    Alice
 3      2           ──→    2   Bob        →             3    Bob
 4      2           ──→    2   Bob        →             4    Bob
(no match for 3)    ──→    3   Carol      →          NULL    Carol
(no match for 4)    ──→    4   Dave       →          NULL    Dave
```

Identical data to the LEFT JOIN example above, just with table roles swapped.

In fact — hold that thought, because Section 12 comes back to show these two are literally interchangeable. RIGHT JOIN doesn't do anything LEFT JOIN can't already do; it's just LEFT JOIN with the tables named in the opposite order.

---

## 5. NULL Padding Behaviour

So what does that NULL-filling actually look like in a real result set? When LEFT JOIN finds no match on the right side, every column from the right
table becomes NULL in that result row — not just one column, *every* column from the unmatched table:

```sql
SELECT c.name, o.id, o.order_date, o.status
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id;
```

```
┌─────────┬──────────┬────────────┬───────────┐
│ name    │ o.id     │ order_date │ status    │
├─────────┼──────────┼────────────┼───────────┤
│ Alice   │   1      │ 2024-05-01 │ delivered │
│ Alice   │   2      │ 2024-05-15 │ shipped   │
│ Bob     │   3      │ 2024-05-20 │ pending   │
│ Bob     │   4      │ 2024-06-01 │ delivered │
│ Carol   │  NULL    │    NULL    │   NULL    │  ← no order
│ Dave    │  NULL    │    NULL    │   NULL    │  ← no order
└─────────┴──────────┴────────────┴───────────┘
```

This NULL padding is what makes the anti-join pattern possible.

Hang on to that idea — every row from a table with no match turns entirely to NULL. Section 9 turns this into a genuinely useful trick: if you can spot the NULLs, you can spot the "no match" rows, which means you can answer questions like "which customers never ordered anything."

---

## 6. Full Syntax

```sql
-- LEFT JOIN:
SELECT columns
FROM   left_table  [AS alias_l]
LEFT JOIN right_table [AS alias_r] ON left_alias.col = right_alias.col;

-- RIGHT JOIN:
SELECT columns
FROM   left_table  [AS alias_l]
RIGHT JOIN right_table [AS alias_r] ON left_alias.col = right_alias.col;

-- LEFT OUTER JOIN (OUTER keyword is optional):
SELECT columns
FROM left_table
LEFT OUTER JOIN right_table ON left_table.col = right_table.col;
```

`OUTER` is optional — `LEFT JOIN` and `LEFT OUTER JOIN` are identical. You'll see both in the wild; they compile to exactly the same thing.

---

## 7. Full Example Schema

We're reusing the same schema from the INNER JOIN lesson, so the data feels familiar. Reproduced here so this file is self-contained — you shouldn't have to flip back to Phase 1 to follow along.

```sql
CREATE TABLE customers (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(150) UNIQUE,
    city       VARCHAR(80),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id       INT PRIMARY KEY AUTO_INCREMENT,
    name     VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    price    DECIMAL(10,2) NOT NULL,
    stock    INT DEFAULT 0
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

```sql
INSERT INTO customers VALUES
(1,'Alice','alice@example.com','Sydney','2024-01-10'),
(2,'Bob',  'bob@example.com',  'Melbourne','2024-02-15'),
(3,'Carol','carol@example.com','Brisbane','2024-03-20'),
(4,'Dave', 'dave@example.com', 'Sydney','2024-04-01');

INSERT INTO products VALUES
(1,'Laptop',  'Electronics',1299.99,15),
(2,'Mouse',   'Electronics',  29.99,80),
(3,'Desk',    'Furniture',   499.00,10),
(4,'Headset', 'Electronics',  79.99,40),
(5,'Chair',   'Furniture',   299.00,25);

INSERT INTO orders VALUES
(1, 1,'2024-05-01','delivered'),
(2, 1,'2024-05-15','shipped'),
(3, 2,'2024-05-20','pending'),
(4, 2,'2024-06-01','delivered');

INSERT INTO order_items VALUES
(1,1,1,1,1299.99),(2,1,2,2,29.99),(3,2,4,1,79.99),
(4,3,3,1,499.00),(5,4,5,2,299.00);
```

Carol (id=3) and Dave (id=4) have no orders.
Products 1 (Laptop), 2 (Mouse), 3 (Desk), 4 (Headset), 5 (Chair) all have orders.

Keep Carol and Dave in mind — they're the whole reason this lesson exists. Every query below is really just asking "how do I get Carol and Dave to show up anyway?"

---

## 8. Practical LEFT JOIN Queries

### 8a. All customers with their order count (including zero)

```sql
SELECT
    c.name,
    COUNT(o.id) AS order_count
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.name
ORDER BY order_count DESC;
```

```
┌─────────┬─────────────┐
│ name    │ order_count │
├─────────┼─────────────┤
│ Alice   │      2      │
│ Bob     │      2      │
│ Carol   │      0      │
│ Dave    │      0      │
└─────────┴─────────────┘
```

Note: `COUNT(o.id)` counts non-NULL values. For rows with no matching order,
`o.id` is NULL, so COUNT returns 0. Using `COUNT(*)` would count the NULL row
as 1 — a common mistake.

### 8b. Total spent per customer (including customers with $0)

```sql
SELECT
    c.name,
    COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_spent
FROM customers   c
LEFT JOIN orders      o  ON c.id        = o.customer_id
LEFT JOIN order_items oi ON o.id        = oi.order_id
GROUP BY c.id, c.name
ORDER BY total_spent DESC;
```

`COALESCE(expr, 0)` replaces NULL with 0 for display.

### 8c. Latest order date per customer

```sql
SELECT
    c.name,
    MAX(o.order_date) AS last_order_date
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.name;
```

Carol and Dave will show NULL for last_order_date — correct and visible.

### 8d. Multi-table LEFT JOIN chain

```sql
-- Show all customers, their orders, and the items in those orders
-- Include customers with no orders and orders with no items
SELECT
    c.name           AS customer,
    o.id             AS order_id,
    o.order_date,
    p.name           AS product,
    oi.quantity
FROM customers   c
LEFT JOIN orders      o  ON c.id         = o.customer_id
LEFT JOIN order_items oi ON o.id         = oi.order_id
LEFT JOIN products    p  ON oi.product_id = p.id
ORDER BY c.name, o.order_date, p.name;
```

When chaining LEFT JOINs, NULLs propagate: if a customer has no order, then
order_items and products rows will also be NULL (there is no order_id to match).

---

## 9. The Anti-Join Pattern (IS NULL Trick)

Here's a question you'll get asked constantly in the real world (and in interviews): "which customers have never placed an order?" Notice this is the *opposite* of what INNER JOIN gives you — you don't want the matches, you want the leftovers.

This trick has a name: the **anti-join**. It means finding rows in the LEFT table that have NO match in the RIGHT
table. It's one of the most frequently tested SQL interview patterns, and once you've internalized NULL padding from Section 5, it basically writes itself.

The idea: do a LEFT JOIN (so nobody gets dropped), then filter for exactly the rows where the right side came back NULL (because NULL is the fingerprint of "no match").

```
LEFT table (customers)
┌───┬────────┐
│ 1 │ Alice  │──── HAS orders  ──→ (match exists)
│ 2 │ Bob    │──── HAS orders  ──→ (match exists)
│ 3 │ Carol  │──── NO orders   ──→ right side is NULL
│ 4 │ Dave   │──── NO orders   ──→ right side is NULL
└───┴────────┘
                                       ↑
                                 WHERE o.id IS NULL
                                 captures these rows
```

```sql
-- Customers with NO orders:
SELECT c.id, c.name
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE o.id IS NULL;
```

```
┌────┬───────┐
│ id │ name  │
├────┼───────┤
│  3 │ Carol │
│  4 │ Dave  │
└────┴───────┘
```

The logic, step by step:
1. LEFT JOIN produces all customers, with NULLs for unmatched right rows
2. `WHERE o.id IS NULL` filters to keep only the NULL-padded rows
3. Those are exactly the customers with no orders

This is called an "anti-join" because it is the logical opposite of the INNER
JOIN result. Where INNER JOIN says "show me only the overlap," the anti-join says "show me only what's *outside* the overlap, on the left side."

> **Memory hook:** LEFT JOIN + `WHERE right.id IS NULL` = "show me who got left behind."

---

## 10. Real Anti-Join Use Cases

The anti-join pattern shows up everywhere once you know to look for it — anywhere you're asking "which of these things never got the other thing."

### 10a. Products never purchased

```sql
SELECT p.id, p.name, p.category
FROM products    p
LEFT JOIN order_items oi ON p.id = oi.product_id
WHERE oi.id IS NULL;
```

### 10b. Employees without a department assignment

```sql
-- Assuming employees and department_members tables:
SELECT e.id, e.name
FROM employees         e
LEFT JOIN dept_members dm ON e.id = dm.employee_id
WHERE dm.employee_id IS NULL;
```

### 10c. Users missing a profile record

```sql
SELECT u.id, u.email
FROM users        u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE p.user_id IS NULL;
```

### 10d. Orders placed in month A but NOT in month B (churn detection)

```sql
-- Customers who ordered in May but NOT in June:
SELECT DISTINCT c.name
FROM customers c
JOIN orders may_o ON c.id = may_o.customer_id
    AND may_o.order_date BETWEEN '2024-05-01' AND '2024-05-31'
LEFT JOIN orders jun_o ON c.id = jun_o.customer_id
    AND jun_o.order_date BETWEEN '2024-06-01' AND '2024-06-30'
WHERE jun_o.id IS NULL;
```

### 10e. Alternative: NOT EXISTS (same result, often same plan)

```sql
-- Equivalent to anti-join:
SELECT c.id, c.name
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

MySQL's optimizer often converts both to the same internal plan. Use whichever
reads more clearly for your team.

---

## 11. Filtering in ON vs WHERE (Critical Difference)

Stop here for a second — this is the single most common LEFT JOIN bug you will write, and the single most common LEFT JOIN question you'll be asked in an interview. It deserves your full attention.

Here's the trap in plain language: you write a perfectly good LEFT JOIN to keep every customer, including Carol and Dave who have no orders. Then you add a totally reasonable-looking `WHERE` clause to filter for "delivered" orders only — and suddenly Carol and Dave vanish again, as if you'd never used LEFT JOIN at all. Your LEFT JOIN got silently downgraded to an INNER JOIN, and nothing in the syntax warned you.

Why does this happen? Because of the *order operations run in*. MySQL builds the joined result first — that's where Carol and Dave get their NULL-padded rows. Only *after* that does it apply the WHERE clause, checking each row against your filter. And `NULL = 'delivered'` is never true. It's not false either — in SQL, comparing anything to NULL gives you NULL, which behaves like false for filtering purposes. So Carol's NULL status row fails the check and gets thrown out, right along with genuinely non-delivered orders.

The fix is to ask yourself: do I want this condition to decide who's in the *final result*, or do I want it to decide what counts as a *match during the join*? That's the difference between WHERE and ON.

### Scenario: customers and their delivered orders only

```sql
-- Option A: filter in WHERE
SELECT c.name, o.id, o.status
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'delivered';
```

```
Result:
Alice | 1 | delivered
Bob   | 4 | delivered
-- Carol and Dave MISSING (WHERE filtered them out because o.status IS NULL)
```

Just as predicted: the WHERE clause runs AFTER the join. Rows with NULL status (Carol, Dave) fail
the `o.status = 'delivered'` check and are removed. The LEFT JOIN becomes
effectively an INNER JOIN — all that effort to write LEFT JOIN, undone by one WHERE clause.

```sql
-- Option B: filter in ON
SELECT c.name, o.id, o.status
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id AND o.status = 'delivered';
```

```
Result:
Alice | 1    | delivered
Alice | NULL | NULL       ← order 2 (shipped) excluded but Alice still appears
Bob   | 4    | delivered
Bob   | NULL | NULL       ← order 3 (pending) excluded but Bob still appears
Carol | NULL | NULL       ← no orders at all
Dave  | NULL | NULL       ← no orders at all
```

See the difference? Now Alice and Bob still show up even for their non-delivered orders — just with NULL in the order columns, same as Carol and Dave. The ON clause filter is applied DURING the join, before NULL-padding. Rows that
do not match the ON condition are treated as "no match" and become NULL —
but the left-side row is still preserved. Nobody from the left table ever gets removed by an ON condition; ON only decides what counts as a "match," never who gets to stay.

```
Rule:
┌───────────────────────────────────────────────────────────────────┐
│ Filter in WHERE → applied AFTER join → drops NULL-padded rows    │
│ Filter in ON   → applied DURING join → NULLs preserved          │
└───────────────────────────────────────────────────────────────────┘

Use WHERE when:  you want to filter the final result (including removing
                  left rows with no match)
Use ON when:     you want to restrict which right-side rows can match,
                  while still keeping all left rows
```

A quick sanity check you can run in your head any time you write a LEFT JOIN with a filter: "if I ran this on a row where the right side is entirely NULL, would my condition survive?" If the answer is no, that condition belongs in ON, not WHERE.

> **Memory hook:** WHERE comes after the join is done — it can undo your LEFT JOIN by evicting the NULL rows. ON happens during the join — it decides who matches, but everyone from the left table still gets a seat.

---

## 12. RIGHT JOIN — Mirror of LEFT JOIN

Now, back to RIGHT JOIN. It's syntactically the reverse of LEFT JOIN. All rows from the RIGHT
table are preserved; unmatched left rows get NULLs.

```sql
-- RIGHT JOIN:
SELECT c.name, o.id, o.order_date
FROM orders o
RIGHT JOIN customers c ON o.customer_id = c.id;
```

This produces the same result as:

```sql
-- Equivalent LEFT JOIN (table order swapped):
SELECT c.name, o.id, o.order_date
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id;
```

Both show all customers with NULL-padded order columns for Carol and Dave.

Here's the three join types side by side, so you can see exactly what each one keeps:

| Join type | Rows kept | Unmatched rows |
|---|---|---|
| INNER JOIN | Only rows matching on both sides | Dropped entirely from both sides |
| LEFT JOIN | ALL rows from the left table | Right-side columns NULL-padded; left row preserved |
| RIGHT JOIN | ALL rows from the right table | Left-side columns NULL-padded; right row preserved |

---

## 13. Converting LEFT to RIGHT and Back

Any RIGHT JOIN can be rewritten as a LEFT JOIN by swapping table order — this is worth internalizing now, because Section 14 is about to tell you to always do exactly that.

```sql
-- RIGHT JOIN:
SELECT *
FROM table_a a
RIGHT JOIN table_b b ON a.fk = b.pk;

-- Equivalent LEFT JOIN (swap table order, change keyword):
SELECT *
FROM table_b b
LEFT JOIN table_a a ON a.fk = b.pk;
```

The column order in SELECT * will differ, but the data content is the same.

Mental model:
```
RIGHT JOIN A, B  ≡  LEFT JOIN B, A
```

---

## 14. Why LEFT JOIN Is Preferred

Here's a fact that surprises a lot of people learning SQL: in real production codebases, RIGHT JOIN is rare. Almost nobody uses it, even though it's perfectly valid SQL. Why bother learning it at all, then? Mostly so you can recognize it when you see it in someone else's (probably older) code — and so you understand why your team's style guide bans it.

Most teams and style guides prefer LEFT JOIN over RIGHT JOIN for these reasons:

```
┌──────────────────────┬────────────────────────────────────────────────────────┐
│ Reason               │ Explanation                                            │
├──────────────────────┼────────────────────────────────────────────────────────┤
│ Mental model         │ We read SQL left-to-right. "Start with X, attach Y"   │
│                      │ maps naturally to FROM X LEFT JOIN Y.                  │
├──────────────────────┼────────────────────────────────────────────────────────┤
│ Consistent direction │ All joins flow in the same direction down the query.   │
│                      │ Mixing LEFT and RIGHT is harder to reason about.       │
├──────────────────────┼────────────────────────────────────────────────────────┤
│ Refactoring ease     │ Adding a new LEFT JOIN at the end is trivial.          │
│                      │ RIGHT JOIN mid-chain forces table reordering.          │
├──────────────────────┼────────────────────────────────────────────────────────┤
│ Code review          │ Reviewers can scan FROM→JOIN→JOIN→JOIN linearly        │
│                      │ without tracking direction changes.                    │
└──────────────────────┴────────────────────────────────────────────────────────┘
```

Recommendation: always use LEFT JOIN. Convert any RIGHT JOIN to a LEFT JOIN
by swapping table order.

> **Memory hook:** If you ever feel tempted to write RIGHT JOIN, just swap the table order and write LEFT JOIN instead — same result, one fewer direction to keep track of.

---

## 15. Common Mistakes

You've already met Mistake 1 in detail back in Section 11 — it's listed here again because it's genuinely the one worth remembering above all others.

### Mistake 1: Accidentally turning LEFT JOIN into INNER JOIN via WHERE

```sql
-- BUG: WHERE clause cancels the LEFT JOIN
SELECT c.name, o.status
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'delivered';   -- drops Carol and Dave (NULL != 'delivered')

-- FIX: move to ON if you want to preserve all customers
SELECT c.name, o.status
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id AND o.status = 'delivered';
```

### Mistake 2: COUNT(*) instead of COUNT(non-null column)

```sql
-- BUG: Carol and Dave get count=1 (the NULL-padded row is still a row)
SELECT c.name, COUNT(*) AS order_count
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.name;

-- FIX: count the right table's PK (NULL PK means no match)
SELECT c.name, COUNT(o.id) AS order_count
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.name;
```

### Mistake 3: Anti-join on a nullable column

```sql
-- If orders.id could be NULL for valid rows, this anti-join would have false positives
-- Always use a NOT NULL column (usually the primary key) for IS NULL check
WHERE o.id IS NULL   -- safe if o.id is PK (never NULL in real rows)
```

### Mistake 4: Chaining a WHERE filter after multi-table LEFT JOIN

```sql
-- BUG: the WHERE on order_items cancels the LEFT JOIN on orders too
SELECT c.name, o.id, oi.quantity
FROM customers c
LEFT JOIN orders      o  ON c.id    = o.customer_id
LEFT JOIN order_items oi ON o.id    = oi.order_id
WHERE oi.quantity > 1;   -- kills rows where oi is NULL (no order or no items)

-- FIX: add condition to ON clause if you need all customers:
SELECT c.name, o.id, oi.quantity
FROM customers c
LEFT JOIN orders      o  ON c.id    = o.customer_id
LEFT JOIN order_items oi ON o.id    = oi.order_id AND oi.quantity > 1;
```

---

## 16. Hands-On Exercises

**Exercise 1**
List all customers and the total number of orders they have placed. Include
customers with zero orders. Sort by order count descending.

```sql
-- Solution:
SELECT
    c.name,
    COUNT(o.id) AS order_count
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.name
ORDER BY order_count DESC;
```

**Exercise 2**
Find all products that have NEVER appeared in any order_items row. Return
product id, name, and category.

```sql
-- Solution (anti-join):
SELECT p.id, p.name, p.category
FROM products    p
LEFT JOIN order_items oi ON p.id = oi.product_id
WHERE oi.id IS NULL;
```

**Exercise 3**
Show all customers along with their most recent order date. Customers with no
orders should show NULL for the date. Sort by most recent first (NULLs last).

```sql
-- Solution:
SELECT
    c.name,
    MAX(o.order_date) AS latest_order
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.name
ORDER BY latest_order DESC;
```

**Exercise 4**
List all customers who have placed orders, along with a flag indicating whether
they have any DELIVERED orders. (Hint: LEFT JOIN orders filtered to delivered
status in the ON clause.)

```sql
-- Solution:
SELECT
    c.name,
    CASE WHEN del.id IS NOT NULL THEN 'Yes' ELSE 'No' END AS has_delivered
FROM customers c
JOIN orders o ON c.id = o.customer_id          -- only customers with orders
LEFT JOIN orders del ON c.id = del.customer_id
    AND del.status = 'delivered'               -- attach delivered orders only
GROUP BY c.id, c.name, del.id
ORDER BY c.name;

-- Simpler version using MAX:
SELECT
    c.name,
    MAX(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) AS has_delivered
FROM customers c
JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.name;
```

**Exercise 5**
Find customers who placed an order in May 2024 but NOT in June 2024.

```sql
-- Solution (anti-join on month):
SELECT DISTINCT c.name
FROM customers c
JOIN orders may_o
    ON c.id = may_o.customer_id
    AND may_o.order_date BETWEEN '2024-05-01' AND '2024-05-31'
LEFT JOIN orders jun_o
    ON c.id = jun_o.customer_id
    AND jun_o.order_date BETWEEN '2024-06-01' AND '2024-06-30'
WHERE jun_o.id IS NULL;
```

---

## 17. Interview Q&A

**Q1: What is the difference between INNER JOIN and LEFT JOIN?**
A: INNER JOIN returns only rows where both tables have a matching row. LEFT JOIN
returns ALL rows from the left table plus matched rows from the right; if no
match exists on the right, the right columns are NULL. LEFT JOIN is a superset
of INNER JOIN for the left table.

**Q2: What is an anti-join and how do you write one in MySQL?**
A: An anti-join returns rows from the left table that have NO matching row in
the right table. Pattern: `FROM A LEFT JOIN B ON ... WHERE B.id IS NULL`. Use
a NOT NULL column (PK) for the IS NULL check. Alternative: `WHERE NOT EXISTS
(SELECT 1 FROM B WHERE B.fk = A.pk)`.

**Q3: What is NULL padding in the context of LEFT JOIN?**
A: When a LEFT JOIN finds no matching row on the right side, it "pads" the
result row with NULL for every column from the right table. This allows the
query to return a row for each left-side record, with NULL indicating absence.

**Q4: Why can a WHERE clause accidentally convert a LEFT JOIN to an INNER JOIN?**
A: WHERE is applied after the join. If the WHERE condition references a column
from the right table and that column is NULL (due to no match), the condition
evaluates to NULL/FALSE and the row is removed. To preserve left rows while
still filtering right rows, move the condition into the ON clause.

**Q5: When should a filter go in ON vs WHERE for a LEFT JOIN?**
A: ON: when you want to restrict which right-side rows can form a match, while
still keeping all left-side rows (NULL-padded when no match). WHERE: when you
want to filter the final combined result set, which may drop unmatched left rows.

**Q6: How do you find rows in table A that do not exist in table B?**
A: Use the anti-join pattern: `FROM A LEFT JOIN B ON A.pk = B.fk WHERE B.fk IS NULL`.
Alternative with NOT EXISTS: `FROM A WHERE NOT EXISTS (SELECT 1 FROM B WHERE B.fk = A.pk)`.
Both often produce the same execution plan in MySQL 8+.

**Q7: What is the difference between LEFT JOIN and LEFT OUTER JOIN?**
A: They are identical. The keyword OUTER is optional. Both are LEFT OUTER JOINs
internally. The short form LEFT JOIN is most commonly used.

**Q8: Can you chain multiple LEFT JOINs?**
A: Yes. Each LEFT JOIN adds one more table. Important: NULLs propagate — if
the second join produces NULL rows, a third join on a NULL key from the second
will also produce NULLs.

**Q9: How does COUNT behave differently for LEFT JOIN vs INNER JOIN?**
A: With LEFT JOIN and GROUP BY, `COUNT(*)` counts the NULL-padded row as 1,
giving an incorrect count of 1 for unmatched rows. Use `COUNT(right_table.pk)`
instead — NULL PKs are not counted, giving correct 0 for no matches.

**Q10: When would you use RIGHT JOIN instead of LEFT JOIN?**
A: Almost never in practice. Any RIGHT JOIN can be rewritten as a LEFT JOIN
by swapping the table order. Most style guides prefer LEFT JOIN for consistency.
Use RIGHT JOIN only if a specific tool or legacy codebase requires it.

**Q11: What is the result of LEFT JOIN when the right table has multiple matching rows?**
A: The left row is duplicated once per matching right row, same as INNER JOIN.
For example, a customer with 3 orders appears 3 times. Use GROUP BY + aggregate
to collapse, or DISTINCT if you only need the left side.

**Q12: How would you write "customers who have orders but no delivered orders"?**
A: Join customers to orders (INNER to ensure they have at least one order), then
anti-join on delivered orders:
```sql
SELECT DISTINCT c.name
FROM customers c
JOIN orders o ON c.id = o.customer_id
LEFT JOIN orders d ON c.id = d.customer_id AND d.status = 'delivered'
WHERE d.id IS NULL;
```

**Q13: What is the performance difference between LEFT JOIN anti-join and NOT EXISTS?**
A: MySQL 8's optimizer frequently converts both to the same anti-join semi-join
execution plan. In older versions, NOT EXISTS with a correlated subquery could
be slower. In practice, measure with EXPLAIN and index the join/subquery columns.

**Q14: How does a LEFT JOIN interact with GROUP BY and HAVING?**
A: GROUP BY happens after the join, collapsing the NULL-padded rows with other
rows for the same group. HAVING filters groups. You can use HAVING COUNT(o.id) = 0
to find customers with no orders (equivalent to anti-join, though less efficient).

**Q15: What does it mean when someone says "outer join" without specifying LEFT or RIGHT?**
A: Typically they mean LEFT OUTER JOIN. The word "outer" signals that unmatched
rows are preserved. In MySQL, FULL OUTER JOIN must be emulated with UNION (covered
in Phase 3).
