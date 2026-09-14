# When to Denormalize — Complete Guide

> "The scorebook in the pavilion is the record of the match; the big scoreboard exists so thirty thousand people don't queue to read the book, and when the two disagree, nobody argues that the book is wrong."

---

## Table of Contents

1. [The Problem: A Correct Schema That Cannot Answer Fast Enough](#1-the-problem-a-correct-schema-that-cannot-answer-fast-enough)
2. [The Scoreboard and the Scorebook Analogy](#2-the-scoreboard-and-the-scorebook-analogy)
3. [The Mechanism: Derived Data and Who Keeps It True](#3-the-mechanism-derived-data-and-who-keeps-it-true)
4. [Code Walkthrough: Three Legitimate Denormalizations](#4-code-walkthrough-three-legitimate-denormalizations)
5. [Comparing a Counter Column to COUNT on Demand](#5-comparing-a-counter-column-to-count-on-demand)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: A Correct Schema That Cannot Answer Fast Enough

The schema below is in BCNF and has no anomalies. It is also the reason a dashboard takes nine seconds to load.

### The Query That Will Not Get Faster

```text
Normalized and correct:
  customer_order(order_id, customer_id, placed_at)
  order_item(order_id, product_id, quantity, unit_price)
  product(product_id, name, price)

Dashboard query, run on every page load by 40 staff:
  SELECT p.name, SUM(i.quantity * i.unit_price) AS revenue
  FROM order_item i
  JOIN customer_order o ON o.order_id = i.order_id
  JOIN product p ON p.product_id = i.product_id
  WHERE o.placed_at >= DATE '2026-08-01'
  GROUP BY p.name ORDER BY revenue DESC FETCH FIRST 20 ROWS ONLY;

Measured: 41,000,000 order_item rows aggregated, 9.2 s, 380 runs/hour
  ↳ Indexes on placed_at and product_id already exist. The cost is the
    aggregation, not the lookup, and no index removes it.
```

### What's Missing

Nothing is wrong with the schema. The problem is that the answer is recomputed from scratch 380 times an hour while the underlying facts for yesterday have not changed since midnight. Denormalization is the deliberate decision to store that answer instead of recomputing it, accepting a write cost and a staleness risk in exchange.

---

## 2. The Scoreboard and the Scorebook Analogy

A cricket ground keeps a scorebook: every ball, every run, written down in order. That book is the record. The scoreboard on the far side of the ground holds the same information reduced to five numbers, and it exists purely so that thirty thousand people can read the score without queueing at the pavilion.

### Scorebook vs Scoreboard

```text
Scorebook   → the source of truth, complete, append-only, slow to read
              from at a distance and impossible to share
Scoreboard  → a derived summary, instantly readable by everyone, and
              wrong for a few seconds after every ball
Scorer      → one named person responsible for making the board match
              the book; without them the board drifts silently
Disagreement→ the book wins, always, and the board is corrected
```

### Mapping the Analogy to Denormalization

The scoreboard is a denormalized copy: it costs work on every write, it is briefly stale, and it is only worth having because it is read thousands of times more often than it changes. Three things make it safe — there is exactly one source of truth, exactly one process responsible for updating the copy, and an agreed rule for what happens when they disagree. A denormalization missing any of those three is not an optimization, it is a second version of the truth.

---

## 3. The Mechanism: Derived Data and Who Keeps It True

Denormalization means storing a value that could have been computed from other stored values. The important first step is checking whether the value in question actually meets that definition.

### Three Things That Look Alike

```text
Derived aggregate → recomputable from base rows at any time
                    post.comment_count, daily_product_sales.revenue
Duplicated value  → recomputable by following a foreign key
                    order.customer_email copied from customer.email
Captured fact     → NOT recomputable, and NOT denormalization at all
                    order_item.unit_price is the price agreed that day
  ↳ The first two are copies and can drift. The third only looks like
    a copy; product.price today is a different fact from the price the
    customer was charged in March, and joining to get it is a bug.
```

### The Cost You Are Buying With

```text
Write amplification → every insert now touches two tables, not one
Contention          → a counter on a hot row serialises writers
Staleness           → a window where the copy and the source disagree
Extra code paths    → every writer must remember the update; the one
                      that forgets is a bug you find months later
Repair burden       → drift is silent, so somebody must go looking
```

### Ways to Keep the Copy Correct

```text
Same transaction   → strongest; the copy cannot survive a failed write
Trigger            → same guarantee, enforced by the engine, invisible
                     to application code, harder to find when debugging
Scheduled rebuild  → recompute the whole slice on a schedule; simplest
                     to reason about, staleness is bounded and known
Reconciliation     → a query that compares copy to source and reports
                     mismatches; not optional, whichever of the above
                     you chose
```

---

## 4. Code Walkthrough: Three Legitimate Denormalizations

Each of the three below is written with its correctness mechanism attached, because a denormalization without one is just a bug waiting for traffic.

### A Counter Kept in the Same Transaction

```sql
-- Illustrative standard SQL.
BEGIN;
INSERT INTO comment (comment_id, post_id, author_id, body)
     VALUES (55012, 91, 7, 'Agreed on the second point.');
UPDATE post SET comment_count = comment_count + 1 WHERE post_id = 91;
COMMIT;
```

```sql
-- The reconciliation query. Run it nightly; it should return no rows.
SELECT p.post_id, p.comment_count AS stored, COUNT(c.comment_id) AS actual
FROM post p LEFT JOIN comment c ON c.post_id = p.post_id
GROUP BY p.post_id, p.comment_count
HAVING p.comment_count <> COUNT(c.comment_id);
```

### A Materialized Reporting Table

```sql
CREATE TABLE daily_product_sales (
    sales_date DATE          NOT NULL,
    product_id BIGINT        NOT NULL,
    units      INTEGER       NOT NULL,
    revenue    NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (sales_date, product_id)
);

-- Rebuild one day. Delete-then-insert makes the job idempotent, so a
-- rerun after a failure produces the same result rather than doubling.
DELETE FROM daily_product_sales WHERE sales_date = DATE '2026-08-07';
INSERT INTO daily_product_sales (sales_date, product_id, units, revenue)
SELECT CAST(o.placed_at AS DATE), i.product_id,
       SUM(i.quantity), SUM(i.quantity * i.unit_price)
FROM customer_order o JOIN order_item i ON i.order_id = o.order_id
WHERE CAST(o.placed_at AS DATE) = DATE '2026-08-07'
GROUP BY CAST(o.placed_at AS DATE), i.product_id;
```

### A Captured Price That Is Not a Copy

```sql
-- Correct: what the customer actually agreed to pay.
SELECT SUM(i.quantity * i.unit_price) AS order_total
FROM order_item i WHERE i.order_id = 9001;

-- Wrong: reprices every historical order at today's list price.
SELECT SUM(i.quantity * p.price) AS order_total
FROM order_item i JOIN product p ON p.product_id = i.product_id
WHERE i.order_id = 9001;
```

```text
order_item.unit_price is immutable once written, so there is no copy
to keep in sync and no drift to detect. Storing it is not a trade of
consistency for speed — it is the only way to record what happened.
```

---

## 5. Comparing a Counter Column to COUNT on Demand

Both answer "how many comments does post 91 have". They differ in when the work happens and in what can go wrong.

### Counter Column vs COUNT on Demand

| | `post.comment_count` | `SELECT COUNT(*) FROM comment` |
|---|---|---|
| Read cost | One column already on the row | Index or table scan of matching rows |
| Write cost | Extra `UPDATE` on every insert and delete | None |
| Can be wrong | Yes, if any writer forgets or a job fails | No, it is computed from the source |
| Contention | Writers serialise on the same post row | None |
| Repair | Needs a reconciliation query and a fix job | Nothing to repair |

### Takeaway

The counter is worth it when reads outnumber writes by orders of magnitude and the count appears on a page rendered constantly — a feed showing a hundred posts doing a hundred aggregate queries is a real problem. It is not worth it on a page viewed twice a day, where you have taken on contention, drift, and a repair job to save a query that was never slow. The deciding evidence is a measurement, not an instinct.

---

## 6. Common Mistakes

- **Denormalizing before measuring.** "Joins are slow" is not a measurement, and a join on an indexed foreign key over a few thousand rows is not the reason a page is slow. Normalize first, put the query under a profiler, and find out whether the cost is the join, the aggregation, a missing index, or something that was never the database's fault — the fix is different in each case.
- **Updating the copy in application code, in only some of the paths.** The insert path remembers to bump `comment_count`; the delete path, the bulk import, and the admin console do not. Either the update belongs in the same transaction as every writer without exception, or it belongs in a trigger, or the value should be rebuilt on a schedule — but "most callers remember" is the state that produces silently wrong numbers.
- **Shipping a denormalization with no reconciliation query.** Drift does not raise errors. Without a scheduled query comparing the stored value to the recomputed one, the first person to notice is a customer reading a number that is off by nine, months after the bug shipped.
- **Confusing a captured fact with a cached copy.** Someone "normalizes away" `order_item.unit_price` because it duplicates `product.price`, and every historical invoice silently reprices whenever the catalogue changes. Immutable-at-write-time values are not denormalization and must never be replaced by a join.

---

## 7. Hands-On Exercises

**Exercise 1:** Build `customer_order`, `order_item`, and `product`, load a few hundred thousand `order_item` rows, and run the dashboard query from Section 1. Record its execution plan and wall-clock time before changing anything.

**Exercise 2:** Create `daily_product_sales` and the rebuild statements from Section 4. Run the rebuild, then rewrite the dashboard query to read from it and compare both the plan and the time against Exercise 1.

**Exercise 3:** Run the rebuild for the same date twice in a row and confirm the totals are unchanged. Then delete the `DELETE` statement, run it twice more, and confirm the revenue has doubled — this is why idempotence is part of the design.

**Exercise 4:** Add `comment_count` to `post`, maintain it with the transaction from Section 4, and then reproduce the second mistake from Section 6: delete a comment directly with `DELETE FROM comment ...` without touching the counter. Run the reconciliation query and confirm it reports exactly that post.

**Exercise 5:** Insert an order for a product, then update that product's `price` in the catalogue. Run both queries from the third walkthrough and confirm the second one now reports a total the customer never agreed to pay.

---

## 8. Interview Q&A

**Q: When is denormalization the right call?**
When a specific query has been measured as too slow, the cost is genuinely the recomputation rather than a missing index, and reads outnumber writes by a wide margin. Read-heavy aggregates, counters on hot pages, and nightly reporting tables are the standard legitimate cases. The order matters: normalize, measure, then denormalize the specific thing that measured badly, rather than designing around a guess.

**Q: What are you actually trading away?**
Write cost and correctness risk, in exchange for read speed. Every write now touches more than one place, hot counters serialise writers on the same row, there is a window where the copy disagrees with the source, and every future code path has to remember the extra update. The staleness is usually acceptable and manageable; the code path everyone forgets is what actually causes the outage.

**Q: How do you keep a denormalized value correct?**
Pick one mechanism and make it the only one: update it in the same transaction as the base write, put it in a trigger, or rebuild it on a schedule. Then add a reconciliation query that compares the stored value against the recomputed one and run it regularly, because drift is silent and produces no errors. A rebuild job should also be idempotent, so rerunning it after a failure repairs the data instead of doubling it.

**Q: Is storing the price on an order line a denormalization?**
No, and treating it as one is a real bug. The unit price on an order line is the price the customer agreed to on that day, which is a different fact from the product's price today — it is not recomputable from anything else in the database. There is no copy to keep in sync and no drift to detect; joining to the live product row to get it retroactively rewrites financial history every time the catalogue changes.

**Q: Why is "denormalize for performance" usually the wrong instinct?**
Because it is almost always applied before anything has been measured, to a query that was not the bottleneck, in a schema where the actual fix was an index. It also arrives without the parts that make it safe — a single writer path, a reconciliation query, a repair job — so what ships is not faster reads but a second version of the truth that nobody is maintaining. Normalization is the default because it makes wrong data impossible; every step away from it has to be justified with a number.
