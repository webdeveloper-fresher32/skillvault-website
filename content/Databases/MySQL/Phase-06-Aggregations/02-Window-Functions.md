# Window Functions — MySQL Complete Guide

## Table of Contents
1. [What Are Window Functions?](#1-what-are-window-functions)
2. [OVER() Clause Anatomy](#2-over-clause-anatomy)
3. [Ranking Functions](#3-ranking-functions)
4. [Value Functions](#4-value-functions)
5. [Aggregate Window Functions](#5-aggregate-window-functions)
6. [Frame Clauses](#6-frame-clauses)
7. [Real-World Patterns](#7-real-world-patterns)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What Are Window Functions?

Here's a problem you'll hit constantly: you want to show each employee's salary **and** their department's average salary, side by side, on the same row. Not a summary table — the actual employee list, with the average tagged on as extra context.

Your first instinct might be GROUP BY. Try it, and you'll hit a wall immediately: GROUP BY collapses Alice, Bob, and everyone else in Tech into a single row. You lose the individual employees entirely — all you're left with is `Tech | 85000`. That's not what you wanted. You wanted Alice's row to say "Alice, Tech, 90000, and by the way your department averages 85000."

This is exactly the gap window functions fill.

**The analogy:** picture a spotlight sliding down the list of rows, one at a time. At each row, the spotlight looks around at some neighborhood of related rows — maybe everyone in the same department, maybe the rows just before and after — computes something from that neighborhood, and writes the answer onto the *current* row. Then it slides to the next row and does it again. Crucially, the spotlight never merges rows together the way GROUP BY does. Every row you started with is still there at the end — just with extra computed columns.

**The definition, now that the picture makes sense:** a window function computes a value across a set of related ("windowed") rows, without collapsing them into one row. Compare the two side by side:

```sql
-- GROUP BY: collapses rows — you lose individual row data
SELECT dept, AVG(salary) FROM employees GROUP BY dept;
-- Result: one row per dept

-- Window function: keeps all rows + adds the average as a new column
SELECT name, dept, salary,
       AVG(salary) OVER (PARTITION BY dept) AS dept_avg
FROM employees;
-- Result: every employee row + their dept average alongside
```

```
Without window function (GROUP BY):
┌──────────┬──────────┐
│ dept     │ avg_sal  │
├──────────┼──────────┤
│ Sales    │ 55000    │
│ Tech     │ 85000    │
└──────────┴──────────┘

With window function:
┌─────────┬──────────┬────────┬──────────┐
│ name    │ dept     │ salary │ dept_avg │
├─────────┼──────────┼────────┼──────────┤
│ Alice   │ Tech     │ 90000  │ 85000    │
│ Bob     │ Tech     │ 80000  │ 85000    │
│ Carol   │ Sales    │ 60000  │ 55000    │
│ Dave    │ Sales    │ 50000  │ 55000    │
└─────────┴──────────┴────────┴──────────┘
```

Notice: four employees went in, four employees came out. Nothing got collapsed — each row just picked up an extra column computed from its "neighborhood" (its department, in this case).

> **Memory hook:** GROUP BY *merges* rows into fewer rows; a window function *tags* every row with extra info while keeping them all.

---

## 2. OVER() Clause Anatomy

So how does the spotlight know which rows count as a row's "neighborhood"? That's the entire job of the `OVER()` clause — it's the piece that turns a plain aggregate into a window function.

```sql
function_name() OVER (
  [PARTITION BY col1, col2]    -- define the window group
  [ORDER BY col3 ASC/DESC]     -- define order within the window
  [frame_clause]               -- define which rows to include
)
```

Here's the mental model, piece by piece:

- **PARTITION BY** slices the whole result set into independent groups — the spotlight only ever looks within the current row's group, never across groups. This is the direct cousin of GROUP BY's grouping, except nothing collapses.
- **ORDER BY** (inside the `OVER()`, not to be confused with a query's outer `ORDER BY`) defines a sequence within each partition — this is what makes "previous row," "next row," and "running total so far" meaningful concepts.
- The **frame clause** narrows things further: within the ordered partition, exactly which rows does the current row "see"? All of them? Just the ones before it? A fixed window of neighbors? (More on this in Section 6 — it's its own topic.)

Here's the internal picture that ties PARTITION BY and ORDER BY together — this is the part that trips people up, so take a moment with it:

```
Full result set
┌─────────────────────────────────────────────────┐
│  PARTITION BY dept  →  splits rows into groups   │
│                                                   │
│   ┌─── Partition: Tech ───┐  ┌── Partition: Sales ─┐
│   │ ORDER BY salary DESC  │  │ ORDER BY salary DESC │
│   │  Alice   90000  ← 1st │  │  Carol   60000 ← 1st │
│   │  Bob     80000  ← 2nd │  │  Dave    50000 ← 2nd │
│   └───────────────────────┘  └──────────────────────┘
│                                                   │
│   Each partition gets its own independent         │
│   ordering and its own independent calculation.   │
│   Alice never "sees" Carol or Dave — they're in   │
│   a different partition entirely.                 │
└─────────────────────────────────────────────────┘
```

PARTITION BY draws the walls. ORDER BY decides the walk order *inside* each walled-off room. Everything the window function computes — a rank, a running total, a "previous row" lookup — happens strictly inside one room at a time.

| Part | Purpose | If Omitted |
|------|---------|------------|
| PARTITION BY | Split rows into groups | All rows = one window |
| ORDER BY | Sort within each partition | No ordering guarantee |
| Frame clause | Which rows in partition to use | Depends on function |

> **Memory hook:** PARTITION BY builds the rooms, ORDER BY sets the walking order inside each room.

---

## 3. Ranking Functions

**The problem these solve:** "Give me the top 3 salespeople per region," "who's #1 by score," "show me each employee's rank within their department." All of these need a *position* — 1st, 2nd, 3rd — computed per row. That's exactly what ranking functions hand you.

There are three of them, and MySQL interviewers love asking about the differences, because they only show up once you have **tied values**. If nothing ever ties, all three give you the identical answer. Ties are where it gets interesting.

### ROW_NUMBER()

The simplest one: just count 1, 2, 3, 4... within each partition, in the order you specify. No ties allowed, ever — even if two rows have the exact same value, one arbitrarily gets the next number.

```sql
SELECT
  name, dept, salary,
  ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS rn
FROM employees;
-- Within each dept: 1, 2, 3... even if salaries are equal
```

### RANK()

RANK() gives tied rows the *same* rank — but then it skips ahead by however many rows tied, leaving a gap.

```sql
SELECT name, score,
  RANK() OVER (ORDER BY score DESC) AS rnk
FROM scores;
-- Scores: 100, 100, 90 → ranks: 1, 1, 3 (gap at 2)
```

Notice the jump from `1` straight to `3` — that's not a bug. Two rows tied for 1st, so the next available rank is technically the 3rd position.

### DENSE_RANK()

DENSE_RANK() does the same tie-handling as RANK(), but refuses to leave gaps. After a tie, it just moves to the next whole number.

```sql
SELECT name, score,
  DENSE_RANK() OVER (ORDER BY score DESC) AS dense_rnk
FROM scores;
-- Scores: 100, 100, 90 → ranks: 1, 1, 2 (no gap)
```

### Comparing ROW_NUMBER vs RANK vs DENSE_RANK

The clearest way to see the difference is to run all three over the same tied data at once:

```
Scores: 100, 100, 90, 80
┌──────────────┬──────────┬────────────┬──────────────┐
│ score        │ ROW_NUM  │ RANK       │ DENSE_RANK   │
├──────────────┼──────────┼────────────┼──────────────┤
│ 100          │ 1        │ 1          │ 1            │
│ 100          │ 2        │ 1          │ 1            │
│ 90           │ 3        │ 3          │ 2            │
│ 80           │ 4        │ 4          │ 3            │
└──────────────┴──────────┴────────────┴──────────────┘
```

| Function | Ties get same number? | Gaps after ties? | Use when... |
|---|---|---|---|
| `ROW_NUMBER()` | No — always unique | N/A | You need a strictly unique sequence (e.g. picking exactly one "top" row per group, pagination) |
| `RANK()` | Yes | Yes | You want the true positional rank ("these two are tied for 1st, so the next one really is 3rd") |
| `DENSE_RANK()` | Yes | No | You care about "how many distinct score levels are there," not literal position |

**Common mistake to watch for:** assuming RANK() and DENSE_RANK() behave the same. They only diverge when there's a tie — so a query tested against tie-free sample data will look identical for all three, then surprise you in production the moment real ties show up. Always test ranking logic against data that actually has duplicates.

### NTILE(n)

A different kind of ranking — instead of numbering rows individually, NTILE(n) buckets them into `n` roughly equal-sized groups, in order.

```sql
SELECT name, salary,
  NTILE(4) OVER (ORDER BY salary) AS quartile
FROM employees;
-- quartile 1 = bottom 25%, 4 = top 25%
```

Think of it as literally cutting a sorted line of people into `n` equal segments and stamping each segment with its group number — this is how you compute quartiles, deciles, or "top 10% vs bottom 10%" splits.

**Interview answer:** "ROW_NUMBER, RANK, and DENSE_RANK all assign a position to each row within a window, ordered by some column. They're identical when there are no ties. When values tie, ROW_NUMBER still forces a unique, arbitrary number; RANK gives tied rows the same number but leaves a gap afterward, matching true positional rank; DENSE_RANK gives tied rows the same number with no gap, useful when you care about distinct rank levels rather than exact position."

> **Memory hook:** ROW_NUMBER never ties. RANK ties but leaves a gap like a skipped race lane. DENSE_RANK ties with no gap — it's "dense," nothing wasted.

---

## 4. Value Functions

Ranking functions answer "what position is this row in?" Value functions answer a different question: "what's the value sitting in some *other* row nearby — the one before me, the one after me, the first one, the last one?"

### LAG() and LEAD()

Picture the spotlight again, but this time instead of computing something from a whole neighborhood, it just reaches one row backward (LAG) or one row forward (LEAD) and copies that value onto the current row. Classic use case: month-over-month comparisons.

```sql
SELECT
  month, revenue,
  LAG(revenue, 1, 0)  OVER (ORDER BY month) AS prev_month,
  LEAD(revenue, 1, 0) OVER (ORDER BY month) AS next_month,
  revenue - LAG(revenue, 1, 0) OVER (ORDER BY month) AS month_over_month
FROM monthly_sales;
```

`LAG(col, offset, default)` — offset rows back (default=0), return default if no row.

### FIRST_VALUE() and LAST_VALUE()

These grab the value from the first or last row of the window — sounds simple, but LAST_VALUE() has a well-known trap baked into it.

```sql
SELECT
  name, dept, salary,
  FIRST_VALUE(salary) OVER (PARTITION BY dept ORDER BY salary DESC) AS highest_in_dept,
  LAST_VALUE(salary)  OVER (
    PARTITION BY dept ORDER BY salary DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS lowest_in_dept   -- needs explicit frame for LAST_VALUE!
FROM employees;
```

**Why the explicit frame is not optional here:** when a window has an `ORDER BY`, MySQL's *default* frame is "from the start of the partition up to the current row" — not the whole partition. So without spelling out `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`, `LAST_VALUE()` quietly returns the *current row's own value* instead of the actual last row in the partition. It looks like it's working (it returns *something*), which is exactly what makes this mistake so easy to miss in testing. Section 6 covers frames in full — keep this example in mind when you get there.

### NTH_VALUE()

Same idea, but for an arbitrary position rather than just first or last — "give me the 2nd highest salary in this department."

```sql
SELECT name, salary,
  NTH_VALUE(salary, 2) OVER (
    PARTITION BY dept ORDER BY salary DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS second_highest
FROM employees;
```

It needs the same explicit full-partition frame as `LAST_VALUE()`, for the same reason.

> **Memory hook:** LAST_VALUE without an explicit frame doesn't mean "last in the group" — it means "wherever I currently am." Always spell out `UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` when you actually want the whole partition.

---

## 5. Aggregate Window Functions

Here's a nice shortcut: you don't need a brand-new set of functions for sums, averages, counts, and so on. Every aggregate function you already know from `01-Aggregate-Functions.md` — `SUM`, `AVG`, `COUNT`, `MAX`, `MIN` — becomes a window function the moment you add `OVER()` to it. Same function, same math, just no more collapsing rows.

```sql
SELECT
  name, dept, salary,
  SUM(salary)   OVER (PARTITION BY dept)                    AS dept_total,
  AVG(salary)   OVER (PARTITION BY dept)                    AS dept_avg,
  COUNT(*)      OVER (PARTITION BY dept)                    AS dept_headcount,
  salary / SUM(salary) OVER (PARTITION BY dept) * 100       AS pct_of_dept,
  MAX(salary)   OVER (PARTITION BY dept)                    AS dept_max,
  MIN(salary)   OVER (PARTITION BY dept)                    AS dept_min
FROM employees;
```

Every row in a department sees the same `dept_total`, `dept_avg`, `dept_headcount` — but each row also keeps its own `name` and `salary`. That's the whole point: aggregate math, individual rows.

---

## 6. Frame Clauses

You saw a hint of this back in Section 4 with `LAST_VALUE()` — the frame is what decides *exactly which rows*, within the current partition, the function actually looks at. PARTITION BY draws the room; ORDER BY sets the walking order; the frame clause says "and out of everyone in this room, in this order, how many do I actually pay attention to right now?"

```sql
-- Running total (include all rows from start to current)
SUM(revenue) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)

-- 7-day moving average (current row ± 3 rows)
AVG(revenue) OVER (ORDER BY date ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING)

-- Full partition (all rows in partition)
SUM(revenue) OVER (PARTITION BY dept ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
```

| Frame Keyword | Meaning |
|---------------|---------|
| `UNBOUNDED PRECEDING` | First row of partition |
| `n PRECEDING` | n rows before current |
| `CURRENT ROW` | Current row |
| `n FOLLOWING` | n rows after current |
| `UNBOUNDED FOLLOWING` | Last row of partition |

> **Memory hook:** No frame clause + ORDER BY = MySQL quietly assumes "from the start up to me" (`UNBOUNDED PRECEDING AND CURRENT ROW"`). That default is exactly why plain `LAST_VALUE()` misbehaves — it's not broken, it's just obeying a default frame you didn't ask for.

---

## 7. Real-World Patterns

Time to put PARTITION BY, ranking functions, LAG, and frames together into the queries you'll actually write on the job.

### Running Total

```sql
SELECT
  order_date,
  daily_revenue,
  SUM(daily_revenue) OVER (ORDER BY order_date
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_revenue
FROM daily_sales;
```

### Top N per Group (Top 3 salespeople per region)

This is the pattern that trips up almost everyone the first time: your gut says "just filter with `WHERE rn <= 3`" — and MySQL rejects it. Window functions are computed *after* `WHERE` runs (they happen alongside `SELECT`, near the very end of query processing), so at the point `WHERE` is evaluated, `rn` doesn't exist yet. You cannot reference a window function's alias in the same query's `WHERE` clause.

The fix is to wrap the windowed query in a subquery (or a CTE) and filter on the *outside*, where `rn` is now just an ordinary column:

```sql
SELECT * FROM (
  SELECT
    name, region, sales,
    ROW_NUMBER() OVER (PARTITION BY region ORDER BY sales DESC) AS rn
  FROM salespeople
) ranked
WHERE rn <= 3;
```

### Month-over-Month Growth

```sql
SELECT
  month,
  revenue,
  LAG(revenue) OVER (ORDER BY month) AS prev_revenue,
  ROUND((revenue - LAG(revenue) OVER (ORDER BY month))
        / LAG(revenue) OVER (ORDER BY month) * 100, 2) AS growth_pct
FROM monthly_revenue;
```

### Employee Salary vs Department Average

```sql
SELECT
  name, dept, salary,
  ROUND(AVG(salary) OVER (PARTITION BY dept), 0) AS dept_avg,
  CASE
    WHEN salary > AVG(salary) OVER (PARTITION BY dept) THEN 'Above Average'
    WHEN salary < AVG(salary) OVER (PARTITION BY dept) THEN 'Below Average'
    ELSE 'At Average'
  END AS vs_avg
FROM employees;
```

Notice this last one reuses the exact `AVG(salary) OVER (PARTITION BY dept)` trick from Section 1's opening problem — you're now doing the row-vs-group comparison you originally wanted, in a single pass, no self-join needed.

> **Memory hook:** Can't filter on a window function in `WHERE`? Wrap it in a subquery/CTE and filter one layer up — window functions run after `WHERE`, so give them their own pass.

---

## 8. Hands-On Exercises

**Exercise 1:** Using the `employees` table, rank employees by salary within each department using ROW_NUMBER, RANK, and DENSE_RANK. Observe differences when salaries are tied.

**Exercise 2:** Calculate a running total of monthly revenue for 2025. Show month, monthly revenue, and cumulative revenue.

**Exercise 3:** Find the top 2 customers by total spend per country using ROW_NUMBER().

**Exercise 4:** Using LAG(), calculate the month-over-month change in new user signups for the past 12 months.

**Exercise 5:** Show each product's price, the cheapest price in its category (FIRST_VALUE), and what % of the category max price it represents.

---

## 9. Interview Q&A

**Q: What is the difference between GROUP BY and window functions?**
Answer: GROUP BY collapses multiple rows into one aggregate row, losing individual row data. Window functions compute aggregates over a set of related rows while keeping all rows in the result — each row gets a computed column added. Window functions use OVER() while GROUP BY uses the standard grouping syntax.

**Q: What is the difference between RANK() and DENSE_RANK()?**
Answer: Both assign rankings with ties getting the same rank. RANK() leaves gaps after ties (1,1,3), while DENSE_RANK() does not (1,1,2). Use DENSE_RANK() when you want to know "how many distinct positions" and RANK() when you want the actual positional rank.

**Q: What does PARTITION BY do in a window function?**
Answer: PARTITION BY divides the rows into groups (like GROUP BY) and the window function is computed independently within each partition. Without PARTITION BY, the entire result set is one partition.

**Q: Why does LAST_VALUE() sometimes give unexpected results?**
Answer: By default, the frame for an ordered window is ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW. So LAST_VALUE() returns the current row's value, not the last in the partition. You must explicitly set the frame to ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING.

**Q: What is a running total and how do you calculate it?**
Answer: A running total accumulates values from the first row up to the current row. Use SUM() OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW). Each row shows the total of all previous rows including itself.

**Q: Can window functions be used in WHERE clauses?**
Answer: No — window functions are evaluated after WHERE, GROUP BY, and HAVING. To filter on a window function result, wrap it in a subquery or CTE: WITH ranked AS (SELECT *, ROW_NUMBER() OVER... AS rn FROM t) SELECT * FROM ranked WHERE rn <= 3.
