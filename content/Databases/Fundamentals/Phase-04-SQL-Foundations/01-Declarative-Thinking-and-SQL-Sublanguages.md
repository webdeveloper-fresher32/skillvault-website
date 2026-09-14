# Declarative Thinking and SQL Sublanguages — Complete Guide

> "You give a taxi driver a street address, not a turn-by-turn list of every lane change and traffic light between here and there."

---

## Table of Contents

1. [The Problem: Writing Out Steps When Only the Result Matters](#1-the-problem-writing-out-steps-when-only-the-result-matters)
2. [The Taxi Destination Analogy](#2-the-taxi-destination-analogy)
3. [The Mechanism: The Five SQL Sublanguages](#3-the-mechanism-the-five-sql-sublanguages)
4. [Diagram: From SQL Text to an Execution Plan](#4-diagram-from-sql-text-to-an-execution-plan)
5. [Code Walkthrough: A Row-at-a-Time Loop Rewritten as a Set Operation](#5-code-walkthrough-a-row-at-a-time-loop-rewritten-as-a-set-operation)
6. [Comparing Row-at-a-Time Processing to Set-Based Processing](#6-comparing-row-at-a-time-processing-to-set-based-processing)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Writing Out Steps When Only the Result Matters

Application code says *how*: open a file, loop over records, compare a field, keep a running total. Every step is a decision a human made and the machine must obey literally, even when a much faster route exists.

### Instructions the Engine Must Obey Literally

```text
"Total order value for every customer in Germany" — as steps:

  for each customer in customers:
      if customer.country <> 'DE': skip
      for each order in orders:
          if order.customer_id = customer.id:
              add order.amount to running total
  ↳ This fixes a nested loop, a full re-scan of orders per customer,
    and an in-memory accumulator. An index on orders.customer_id
    is unusable unless a human rewrites the loop.
```

### What's Missing

Nothing about the question above mentions loops. The question is "which rows, grouped how, summing what." What's missing is a way to state the question and hand the strategy to something that knows the current row counts, value distribution, and available indexes — and can change its mind next month when those change.

---

## 2. The Taxi Destination Analogy

A passenger who dictates every turn gets a ride that ignores the accident on the bridge, because the driver was told the route rather than the destination. A passenger who gives an address gets a driver free to reroute around whatever traffic exists today.

### Turn-by-Turn vs Destination

```text
Turn-by-turn  → "left, left, third right, straight two miles" — the
                 route is frozen the moment it is spoken
Destination   → "42 Kastanienallee" — the driver picks the route from
                 today's roads, and a different one tomorrow
```

### Mapping the Analogy to SQL

SQL is the address. The query optimizer is the driver who knows the roads: table sizes, index availability, and column statistics. A declarative query stays correct and gets faster as the optimizer improves or as an index is added, because the query never named a route in the first place.

---

## 3. The Mechanism: The Five SQL Sublanguages

SQL is not one language but five families of statements sharing a grammar. Everything below is standard SQL and illustrative only — privilege names, transaction syntax, and type spellings vary between engines, and the MySQL and PostgreSQL courses cover their own dialects.

### DDL — Defining the Shape

```sql
-- DDL: Data Definition Language. Creates, alters, and drops the
-- structures rows live in. Never touches individual rows.
CREATE TABLE orders (
    order_id     INTEGER       PRIMARY KEY,
    customer_id  INTEGER       NOT NULL,
    order_date   DATE          NOT NULL,
    amount       DECIMAL(10,2) NOT NULL
);
ALTER TABLE orders ADD COLUMN status VARCHAR(20);
```

### DML and DQL — Changing and Reading Rows

```sql
-- DML: Data Manipulation Language. INSERT, UPDATE, DELETE, MERGE.
INSERT INTO orders (order_id, customer_id, order_date, amount)
VALUES (1001, 7, DATE '2024-03-11', 249.00);   -- one new row
UPDATE orders SET amount = 259.00 WHERE order_id = 1001;
DELETE FROM orders WHERE order_date < DATE '2020-01-01';

-- DQL: Data Query Language. Exactly one statement — SELECT. It is
-- the only family that reads without changing anything.
SELECT customer_id, SUM(amount) AS lifetime_value
FROM orders
GROUP BY customer_id;
```

### DCL and TCL — Permissions and Transaction Boundaries

```sql
-- DCL: Data Control Language. Who is allowed to do what.
GRANT SELECT, INSERT ON orders TO reporting_user;
REVOKE INSERT ON orders FROM reporting_user;
-- TCL: Transaction Control Language. Where a unit of work starts and
-- ends. Phase 8 covers what these boundaries actually guarantee.
START TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE account_id = 1;
UPDATE accounts SET balance = balance + 100 WHERE account_id = 2;
COMMIT;   -- or ROLLBACK, which discards both updates together
```

---

## 4. Diagram: From SQL Text to an Execution Plan

### The Path a Statement Takes

```text
SELECT customer_id, SUM(amount) FROM orders GROUP BY customer_id
       ▼
┌──────────────┐
│  Parser      │  Is this valid SQL text at all?
├──────────────┤
│  Binder      │  Does `orders` exist? Is `amount` one of its columns?
├──────────────┤
│  Optimizer   │  Many plans return the same rows. Cost each, keep one.
└──────┬───────┘
  ┌────┴──────────────────┐
Plan A: full scan       Plan B: index scan on customer_id
      + hash aggregate        + stream aggregate (already ordered)
  └────┬──────────────────┘
       ▼
┌──────────────┐
│  Executor    │  Runs the winning plan, returns rows.
└──────────────┘
```

### Reading the Diagram

The query text never named Plan A or Plan B. That choice is made fresh on every execution (or every plan cache miss), from statistics the engine keeps about the data. This is the payoff of declaring the result: the same SQL text gets a better plan after an index is created, without a single character changing.

---

## 5. Code Walkthrough: A Row-at-a-Time Loop Rewritten as a Set Operation

The single most common cause of slow SQL in application code is a loop that issues one statement per row. Each iteration is a full round trip: parse, plan, execute, return.

### The Procedural Version

```python
# "Give every Berlin customer a 5% credit increase" — row at a time.
cur.execute("SELECT customer_id FROM customers WHERE city = 'Berlin'")
for (customer_id,) in cur.fetchall():
    cur.execute("UPDATE customers SET credit = credit * 1.05"
                " WHERE customer_id = %s", (customer_id,))
# 4,000 Berlin customers -> 1 SELECT + 4,000 UPDATE round trips.
```

### The Same Question in SQL

```sql
-- One statement. One round trip. One pass over the matching rows.
UPDATE customers SET credit = credit * 1.05
WHERE city = 'Berlin';
```

### A Cursor Loop Rewritten as One Statement

```text
Cursor-style: fetch each customer's order total, then write it back.

    for each customer_id in customers:
        total := SELECT SUM(amount) FROM orders WHERE customer_id = ?
        UPDATE customers SET lifetime_value = total WHERE customer_id = ?
  ↳ N customers means 2N statements, and the engine sees N unrelated
    single-row questions instead of one aggregation it could plan.
```

```sql
-- Set-based equivalent: the engine reads orders once, aggregates once,
-- and applies every write in a single statement.
UPDATE customers
SET lifetime_value = (SELECT COALESCE(SUM(o.amount), 0)
                      FROM orders o
                      WHERE o.customer_id = customers.customer_id);
```

---

## 6. Comparing Row-at-a-Time Processing to Set-Based Processing

Both approaches produce identical output; they differ in how much freedom the engine has and how much fixed overhead is paid per row.

### Row-at-a-Time vs Set-Based

| | Row-at-a-Time | Set-Based |
|---|---|---|
| Statements issued | One per row — N round trips | One, regardless of row count |
| Join strategy | Fixed by the loop the developer wrote | Chosen by the optimizer per execution |
| Index use | Only if the hand-written lookup happens to match one | Optimizer picks any index that helps |
| Cost of 10x more rows | Roughly 10x the round trips | Often far less than 10x, if a better plan exists |

### Takeaway

Set-based SQL is not merely shorter. Collapsing N statements into one removes N-1 rounds of parse, plan, and network latency, and gives the optimizer a whole-problem view it can attack with a hash join or a single sequential scan. Reach for a loop only when each iteration genuinely depends on the result of the previous one.

---

## 7. Common Mistakes

- **Treating SQL as a scripting language with a database attached.** Fetching a list of ids into the application, looping, and issuing one statement per id is the default instinct from procedural programming, and it is the single largest source of avoidable database load. If the loop body contains a query, there is almost always one statement that expresses the whole thing.
- **Assuming the written order of clauses is the execution order.** `SELECT` appears first but is evaluated late, which is why an alias defined there is unavailable to `WHERE`. Lesson 3 in this phase covers the full logical processing order and the surprises it explains.
- **Forgetting that DDL and DCL are still SQL.** Developers who think of SQL as "just SELECT" tend to manage schema and permissions by clicking through a GUI, leaving no reviewable, replayable record of a change that is every bit as consequential as a code deploy.

---

## 8. Hands-On Exercises

**Exercise 1:** Create the `customers` and `orders` tables with DDL, giving `orders.customer_id` a foreign key to `customers.customer_id`. Insert at least eight customers across three cities and twenty orders spread unevenly across them.

**Exercise 2:** Write one statement from each of the five sublanguages against that schema, and for each one write a single sentence naming which family it belongs to and why. The DCL statement can target any role your engine allows you to create.

**Exercise 3:** Write the "lifetime value per customer" query as a single `SELECT` with `GROUP BY`, then write the same result as an application-side loop in Python or any language with a database driver. Time both against your twenty rows, then re-time after inserting twenty thousand orders.

**Exercise 4:** Reproduce the mistake from Section 7 deliberately. Write a loop that issues one `UPDATE` per customer to set `lifetime_value`, count the statements it sends, then replace it with the single correlated `UPDATE` from Section 5 and compare both the statement count and the wall-clock time.

**Exercise 5:** Run `EXPLAIN` (or your engine's plan command) on the `GROUP BY` query from Exercise 3, record the plan, then create an index on `orders(customer_id)` and run `EXPLAIN` again. Confirm the query text is byte-for-byte identical while the chosen plan changed.

---

## 9. Interview Q&A

**Q: What does it mean to say SQL is declarative, and what does that buy you?**
It means a query states what the result set should contain — which rows, grouped how, sorted how — without specifying the algorithm used to produce it. The engine's optimizer is free to choose the access path, join order, and join algorithm based on current statistics and indexes. The practical benefit is that the same query text gets faster when an index is added or when the optimizer improves, with no rewrite.

**Q: Name the SQL sublanguages and what each one is responsible for.**
DDL defines structure with `CREATE`, `ALTER`, and `DROP`. DML changes rows with `INSERT`, `UPDATE`, and `DELETE`. DQL reads rows and consists of `SELECT` alone, though many people fold it into DML. DCL manages permissions with `GRANT` and `REVOKE`. TCL marks transaction boundaries with `START TRANSACTION`, `COMMIT`, and `ROLLBACK`.

**Q: Why is row-at-a-time processing usually slower than an equivalent single statement?**
Every statement carries fixed overhead — network round trip, parse, plan lookup, and execution setup — so N statements pay that N times. More importantly, the engine only ever sees one tiny question at a time, so it cannot choose a hash join, a single sequential scan, or a single sort that would answer the whole problem at once. Collapsing the loop into one statement removes both the per-row overhead and the optimizer's blindness.

**Q: Is there ever a legitimate reason to loop over rows instead of writing set-based SQL?**
Yes, when each iteration genuinely depends on the outcome of the previous one, such as calling an external API per row, or when a very large write must be broken into bounded batches to keep transaction size and lock duration under control. The distinction is whether the loop exists because the problem is sequential or merely because a loop was the first thing that came to mind.

**Q: If SQL does not specify how a query runs, how do you make a slow query faster?**
You change the inputs the optimizer reasons about rather than the shape of the text. That means adding or fixing indexes, keeping statistics current, reducing the number of rows the query has to touch, and sometimes restructuring the schema. Reading the execution plan first is essential, because it tells you which step is actually expensive instead of leaving you guessing at the SQL.
