# Database Normalization — MySQL Complete Guide

## Table of Contents
1. [What is Normalization?](#1-what-is-normalization)
2. [First Normal Form (1NF)](#2-first-normal-form-1nf)
3. [Second Normal Form (2NF)](#3-second-normal-form-2nf)
4. [Third Normal Form (3NF)](#4-third-normal-form-3nf)
5. [Boyce-Codd Normal Form (BCNF)](#5-boyce-codd-normal-form-bcnf)
6. [Denormalization](#6-denormalization)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is Normalization?

Let's start with a scenario, not a definition.

Alice places two orders. Your `orders` table looks like this:

```
Un-normalized table: orders
┌────────────┬──────────────┬──────────────┬──────────┬────────────┐
│ order_id   │ customer_name│ customer_email│ product  │ price      │
├────────────┼──────────────┼──────────────┼──────────┼────────────┤
│ 1          │ Alice        │ a@example.com│ Laptop   │ 999.00     │
│ 1          │ Alice        │ a@example.com│ Mouse    │ 29.00      │
│ 2          │ Alice        │ a@example.com│ Keyboard │ 79.00      │
└────────────┴──────────────┴──────────────┴──────────┴────────────┘
```

Notice Alice's name and email are copied three times. Now ask yourself three questions:

- **Can you add Alice to the system before she's ever ordered anything?** No — there's no row to put her in, because a "customer row" only exists as a side effect of an order row. That's the **insert anomaly**.
- **What happens when Alice changes her email address?** You have to find and update all 3 rows. Miss one, and now your database has two different "truths" about Alice's email — the **update anomaly**.
- **What happens if order 2 gets deleted (a refund, a cancellation)?** You don't just lose the order — you lose the *only* record that Alice ever bought a Keyboard, and if this were her last order, you'd lose Alice's contact details entirely. That's the **delete anomaly**.

This is the pain that normalization exists to fix.

**The analogy:** think of an un-normalized table like a shared spreadsheet where everyone re-types their address on every row instead of looking it up from a contacts sheet. Every re-type is a chance to introduce a typo, and every update means hunting down every copy.

**The basic definition:** normalization is the process of organizing a database — splitting wide tables into smaller, connected ones — so that each fact is stored in exactly one place. Fewer copies means fewer chances for the copies to disagree, and no data ever depends on the accidental presence of unrelated data.

Normalization happens in stages, called **normal forms** (1NF, 2NF, 3NF, BCNF). Each stage is stricter than the last — you can't skip ahead; a table has to satisfy 2NF's rules before 3NF's rules even make sense to check.

---

## 2. First Normal Form (1NF)

**The problem:** imagine you cram a customer's entire order into a single row by stuffing all the products into one cell, comma-separated:

```
Not in 1NF — multiple values in one cell:
┌─────────┬──────────┬──────────────────────────┐
│order_id │customer  │ products                 │
├─────────┼──────────┼──────────────────────────┤
│ 1       │ Alice    │ Laptop, Mouse, Keyboard   │ ← multiple values!
└─────────┴──────────┴──────────────────────────┘
```

Now try to answer "how many Laptops did we sell this month?" with plain SQL. You can't — SQL doesn't know how to look *inside* that comma-separated string. You'd need string-parsing hacks, and even then, updating one product in the list (e.g., fixing a typo) means carefully rewriting the whole cell without breaking the others.

**The analogy:** it's like writing three people's names in a single "Name" field on a form, instead of giving each person their own line. The form still "has the data," but nothing can process it sensibly.

**The rule:** no repeating groups; every cell holds a single atomic value; every row is unique. That's 1NF.

### Fix: One value per cell, one row per item

```sql
-- ❌ Before (not 1NF)
CREATE TABLE orders_bad (
  order_id  INT,
  customer  VARCHAR(100),
  products  VARCHAR(500)  -- "Laptop, Mouse, Keyboard"
);

-- ✅ After (1NF)
CREATE TABLE orders (
  order_id   INT,
  customer   VARCHAR(100),
  product    VARCHAR(100),  -- one product per row
  PRIMARY KEY (order_id, product)
);
```

---

## 3. Second Normal Form (2NF)

**The problem:** say your `order_items` table has a composite primary key — `(order_id, product_id)` — because that's the natural unique identifier for "this product, on this order." Someone also throws `product_name` and `product_category` into the same table, for convenience:

```
Table: order_items
PK: (order_id, product_id)

┌──────────┬────────────┬──────────────┬───────────────┬──────────────────┐
│ order_id │ product_id │ quantity     │ product_name  │ product_category │
├──────────┼────────────┼──────────────┼───────────────┼──────────────────┤
│ 1        │ 101        │ 2            │ Laptop        │ Electronics      │
│ 1        │ 102        │ 1            │ Mouse         │ Electronics      │
└──────────┴────────────┴──────────────┴───────────────┴──────────────────┘
```

Now the Laptop's name and category are duplicated on every single order line that includes a Laptop. Change the Laptop's category from "Electronics" to "Computers" and you have to hunt down and update every order row that ever contained a Laptop — the same update anomaly from Section 1, just wearing a composite-key disguise.

**Why did this happen?** Look closely at what each column actually *depends on*:

```
quantity          → depends on BOTH order_id AND product_id  ✅ (makes sense:
                     "2 units" only means something for THIS order + THIS product)

product_name      → depends ONLY on product_id               ❌ partial dependency!
product_category  → depends ONLY on product_id               ❌ partial dependency!
                     (the Laptop is always called "Laptop" and always
                      "Electronics" — regardless of WHICH order it's on)
```

`product_name` doesn't need `order_id` at all to be determined — it only cares about `product_id`. That's a **partial dependency**: a non-key column depending on only *part* of a composite key, instead of the whole thing.

**The analogy:** imagine a school keeps one big table keyed by `(student_id, class_id)`, and also stuffs `teacher_name` into it. The teacher doesn't depend on which *student* is in the class — only on which *class* it is. Copying the teacher's name onto every student row is exactly this same mistake.

**The rule:** a table is in 2NF when it's already in 1NF, and every non-key column depends on the *entire* primary key — not just part of it. This rule is only ever relevant when your primary key is composite (made of two or more columns). If your table has a single-column primary key, it's automatically in 2NF — there's no "partial" key to depend on part of.

**How to actually spot it:** for each non-key column, ask "if I only knew `product_id` (and NOT `order_id`), could I still figure out this column's value?" If yes, it's a partial dependency and it needs to move out.

### Fix: Move partially-dependent columns to their own table

```sql
-- ❌ Before (not 2NF)
CREATE TABLE order_items_bad (
  order_id         INT,
  product_id       INT,
  quantity         INT,
  product_name     VARCHAR(100),   -- depends only on product_id
  product_category VARCHAR(50),    -- depends only on product_id
  PRIMARY KEY (order_id, product_id)
);

-- ✅ After (2NF)
CREATE TABLE order_items (
  order_id   INT,
  product_id INT,
  quantity   INT,
  PRIMARY KEY (order_id, product_id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE products (
  id       INT PRIMARY KEY,
  name     VARCHAR(100),
  category VARCHAR(50)
);
```

`product_name` and `product_category` now live exactly once each, in `products`. `order_items` just points at a `product_id` — no more copies to keep in sync.

**Interview answer:** "A partial dependency happens when a non-key column depends on only part of a composite primary key rather than the whole key. It can only occur in tables with composite keys. 2NF fixes it by moving the partially-dependent columns into their own table, keyed by the part of the key they actually depend on."

> **Memory hook:** "If a column only cares about HALF the key, it doesn't belong at this table — give it its own table."

---

## 4. Third Normal Form (3NF)

**The problem:** now suppose your `employees` table has a nice, simple, single-column primary key — `employee_id` — so 2NF isn't even a concern here. But someone adds both `dept_id` *and* `dept_name` to every employee row:

```
Table: employees
PK: employee_id

┌─────────────┬────────────┬───────────┬───────────────────┐
│ employee_id │ name       │ dept_id   │ dept_name         │
├─────────────┼────────────┼───────────┼───────────────────┤
│ 1           │ Alice      │ 10        │ Engineering       │
│ 2           │ Bob        │ 20        │ Marketing         │
└─────────────┴────────────┴───────────┴───────────────────┘
```

Engineering renames itself to "Platform Engineering." Now you're back to hunting down every employee row that has `dept_id = 10` and updating `dept_name` on each one. Same anomaly, different shape.

**Here's the key difference from 2NF's problem:** this table doesn't have a composite key — `employee_id` alone is the whole key, so there's no "partial" dependency possible. The issue here is a *chain*: `dept_name` doesn't depend on `employee_id` directly. It depends on `dept_id`, and `dept_id` happens to live on this row too. So `dept_name` is really only reachable by hopping *through* another non-key column:

```
employee_id ──────► dept_id ──────► dept_name
   (key)          (non-key)       (non-key)

  employee_id determines dept_id      ✅ fine, that's expected
  dept_id determines dept_name        ✅ fine on its own
  employee_id "determines" dept_name  ❌ only indirectly, via dept_id
                                          — this is the transitive dependency
```

This chain — key → non-key column A → non-key column B — is called a **transitive dependency**. `dept_name` is transitively dependent on `employee_id`, through `dept_id`.

**The analogy:** it's like writing someone's country on a form based on their city, instead of just writing the city and looking the country up separately. If the city ever gets reassigned to a different country (border changes, admin reorganization), every form with that city needs a manual correction. Store the fact ("this city belongs to this country") in exactly one place instead.

**The rule:** a table is in 3NF when it's in 2NF, and no non-key column depends on another non-key column — every non-key column must depend *directly* on the primary key, and nothing else.

**How to actually spot it:** for each non-key column, ask "does this column's value change because of the primary key, or because of some OTHER column in this same row?" If it's the latter, that's a transitive dependency.

### Fix: Move transitively dependent column to its own table

```sql
-- ❌ Before (not 3NF)
CREATE TABLE employees_bad (
  employee_id INT PRIMARY KEY,
  name        VARCHAR(100),
  dept_id     INT,
  dept_name   VARCHAR(100)   -- transitive dependency!
);

-- ✅ After (3NF)
CREATE TABLE employees (
  employee_id INT PRIMARY KEY,
  name        VARCHAR(100),
  dept_id     INT,
  FOREIGN KEY (dept_id) REFERENCES departments(id)
);

CREATE TABLE departments (
  id   INT PRIMARY KEY,
  name VARCHAR(100)
);
```

`dept_name` now lives only in `departments`. Rename the department once, and every employee automatically "sees" the new name through the `dept_id` foreign key — nothing to hunt down.

**Interview answer:** "A transitive dependency exists when a non-key column depends on the primary key only indirectly, through another non-key column — a chain like `key → A → B`. 3NF eliminates this by requiring every non-key column to depend directly on the primary key. The fix is the same move as 2NF: pull the transitively-dependent column out into its own table, keyed by the column it actually depends on."

> **Memory hook:** "2NF asks 'does this depend on the WHOLE key?' — 3NF asks 'does this depend on the key, or on some OTHER column sitting next to it?'"

### 2NF vs 3NF — the confusion everyone runs into

These two get mixed up constantly, because both are fixed the same way (move the column to a new table). Here's the actual distinction:

| | Applies to | The dependency being broken |
|---|---|---|
| **2NF (partial dependency)** | Only tables with a **composite** primary key | Non-key column depends on **part** of the key |
| **3NF (transitive dependency)** | Any table, composite or single-column key | Non-key column depends on **another non-key column**, not the key itself |

If your table only has a single-column primary key, you can never have a partial dependency (there's no "part" of a single column to depend on) — so 2NF is automatically satisfied, and the only thing left to check is 3NF's transitive dependency.

---

## 5. Boyce-Codd Normal Form (BCNF)

3NF handles almost every real-world case. BCNF is a rare edge-case refinement of it, worth knowing about but not worth losing sleep over.

**The problem, in the one case where 3NF isn't quite strict enough:** picture a table where a student can be taught by multiple teachers per subject, but each teacher only ever teaches one subject:

```
Table: course_teachers
PK: (student, teacher)

┌──────────┬──────────┬──────────┐
│ student  │ teacher  │ subject  │
├──────────┼──────────┼──────────┤
│ Alice    │ Smith    │ Math     │
│ Alice    │ Jones    │ Physics  │
│ Bob      │ Smith    │ Math     │
└──────────┴──────────┴──────────┘
```

This table actually already passes 3NF's test — `subject` isn't a "non-key column depending on another non-key column" in the classic sense. But look closer: `teacher` alone determines `subject` (Smith always means Math), yet `teacher` alone is *not* a superkey — it's only half of the composite primary key `(student, teacher)`. That's the subtler condition BCNF checks for.

**The rule:** for every functional dependency `X → Y` in the table, `X` must be a superkey (a column, or set of columns, capable of uniquely identifying a row on its own). 3NF has a small loophole here that BCNF closes.

### Fix

```sql
-- Split into two tables
CREATE TABLE teacher_subjects (
  teacher  VARCHAR(100) PRIMARY KEY,
  subject  VARCHAR(100)
);

CREATE TABLE student_teachers (
  student  VARCHAR(100),
  teacher  VARCHAR(100),
  PRIMARY KEY (student, teacher),
  FOREIGN KEY (teacher) REFERENCES teacher_subjects(teacher)
);
```

In practice, BCNF violations that aren't also 3NF violations are rare — you'll go long stretches of real schema design without ever needing to reach for it. Know that it exists, know roughly what it checks (superkeys on the left side of every dependency), and move on.

> **Memory hook:** "BCNF is 3NF with the loopholes closed — rare in the wild, but good to recognize on sight."

### 1NF vs 2NF vs 3NF vs BCNF, side by side

| Normal Form | Must also satisfy | Additionally requires |
|---|---|---|
| **1NF** | — | Atomic values, no repeating groups, unique rows |
| **2NF** | 1NF | No partial dependency (only relevant with composite keys) |
| **3NF** | 2NF | No transitive dependency (non-key depending on non-key) |
| **BCNF** | 3NF | Every determinant (left side of a dependency) is a superkey |

### Common mistakes to watch for

- **Confusing partial with transitive.** If you're staring at a table with a single-column primary key and you think you've found a "2NF violation" — you haven't. Partial dependencies are only possible with composite keys. What you're actually looking at is a transitive dependency (3NF's territory).
- **Normalizing everything, always.** Every join you add by normalizing is a join your queries pay for at read time. For genuinely read-heavy, reporting-style workloads, over-normalizing can hurt performance more than the redundancy it prevents would have. Which brings us to the next section.

---

## 6. Denormalization

Everything above was about *removing* redundancy. Sometimes, once your schema is properly normalized, you deliberately put a little redundancy back — on purpose, for speed.

```sql
-- Normalized: join orders + customers on every query
SELECT o.id, c.name, c.email
FROM orders o
JOIN customers c ON o.customer_id = c.id;

-- Denormalized: store customer_name directly in orders
-- Avoids join for read-heavy reporting
ALTER TABLE orders ADD COLUMN customer_name VARCHAR(100);
-- BUT: if customer changes name, orders show stale name!
-- Need a trigger or application logic to keep in sync
```

| Normalize | Denormalize |
|-----------|-------------|
| Write-heavy (fewer duplicates to update) | Read-heavy (avoid expensive joins) |
| Data consistency critical | Speed critical, acceptable staleness |
| OLTP (transactions) | OLAP (analytics, reporting) |

---

## 7. Hands-On Exercises

**Exercise 1:** Given a flat `student_courses` table with student info, course info, and teacher info all in one table — identify all normalization violations and redesign to 3NF.

**Exercise 2:** Find a partial dependency in a table with a composite PK and refactor it to 2NF.

**Exercise 3:** Design a 3NF schema for an e-commerce system: customers, orders, products, categories, addresses.

**Exercise 4:** Demonstrate an update anomaly on a non-normalized table. Fix it with normalization.

**Exercise 5:** Design a denormalized reporting table for a dashboard query that joins 4 tables. Explain the tradeoffs.

---

## 8. Interview Q&A

**Q: What is database normalization?**
Answer: Normalization is the process of organizing a database schema to minimize data redundancy and prevent update/insert/delete anomalies. It involves decomposing tables into smaller, logically coherent tables linked by foreign keys, following progressive rules called normal forms (1NF, 2NF, 3NF, BCNF).

**Q: What is a partial dependency and which normal form addresses it?**
Answer: A partial dependency occurs when a non-key column depends on only part of a composite primary key, not the full key. Second Normal Form (2NF) requires that all non-key columns depend on the complete primary key. Fix by moving the partially-dependent columns to a separate table with the partial key as its PK.

**Q: What is a transitive dependency?**
Answer: A transitive dependency exists when column A → column B → column C, where B is not a key. C depends on A only through B. Third Normal Form (3NF) eliminates this by requiring that every non-key column depends directly on the primary key, not on another non-key column.

**Q: When is denormalization appropriate?**
Answer: Denormalization trades storage and write complexity for read performance. It's appropriate in read-heavy analytics/reporting systems (OLAP), when specific joins are extremely frequent and slow, or when a slight staleness is acceptable. Always normalize first, then denormalize specific hot paths as a measured optimization.

**Q: What is the difference between 3NF and BCNF?**
Answer: 3NF allows non-key columns to determine other non-key columns as long as they're part of a candidate key. BCNF is stricter — for every functional dependency X → Y, X must be a superkey (no exceptions). BCNF violations are rare in practice and sometimes cannot be achieved without losing lossless-join decomposition.
