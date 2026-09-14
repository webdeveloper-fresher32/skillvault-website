# CTEs (Common Table Expressions) — MySQL Complete Guide

## Table of Contents
1. [What is a CTE?](#1-what-is-a-cte)
2. [Basic CTE Syntax](#2-basic-cte-syntax)
3. [Multiple CTEs](#3-multiple-ctes)
4. [CTE vs Derived Table vs Temp Table](#4-cte-vs-derived-table-vs-temp-table)
5. [Recursive CTEs](#5-recursive-ctes)
6. [Recursive CTE Examples](#6-recursive-cte-examples)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is a CTE?

If you worked through `01-Subqueries.md`, you've already felt this pain: subqueries nested three levels deep, buried inside `FROM` clauses, forcing you to read from the inside out just to understand what a query does. And if you needed the *same* derived result twice in one query — say, once to filter and once to join — you had to copy-paste the whole subquery again. Repeat it, keep it in sync, hope you don't typo one copy.

A CTE fixes exactly that. Think of it as a **sticky note** you write once at the top of your query and stick to your monitor — every time the query needs that piece of logic, it just glances at the note by name instead of re-deriving it from scratch. Write it once, refer to it as many times as you like.

That's really all a CTE is: a **named temporary result set**, defined at the start of a query using the `WITH` clause, that exists only for the duration of that one query.

```sql
WITH cte_name AS (
  SELECT ...       -- CTE definition
)
SELECT * FROM cte_name;   -- use like a table
```

CTEs make complex queries **readable and maintainable** by breaking them into named steps — each one a self-contained, labeled sticky note.

> **Memory hook:** A CTE is a sticky note you write once and point to by name — not a subquery you photocopy every time you need it.

---

## 2. Basic CTE Syntax

Let's see the "before and after" side by side, so the readability win isn't just a claim — you can actually see it.

```sql
-- Without CTE: nested and hard to read
SELECT dept, avg_salary
FROM (
  SELECT dept, AVG(salary) AS avg_salary
  FROM employees GROUP BY dept
) sub
WHERE avg_salary > 70000;

-- With CTE: clear and named
WITH dept_averages AS (
  SELECT dept, AVG(salary) AS avg_salary
  FROM employees
  GROUP BY dept
)
SELECT dept, avg_salary
FROM dept_averages
WHERE avg_salary > 70000;
```

Same logic, same result — but the second version reads like a sentence: "here's `dept_averages`, now filter it." No mentally unwrapping a nested subquery to figure out what `sub` even contains.

---

## 3. Multiple CTEs

What if one step isn't enough? Say you first need to find high-value orders, and *then* enrich that result with customer details. That's two sticky notes, stacked — chain multiple CTEs with commas, and each one can reference any note written before it.

```sql
WITH
  -- Step 1: high-value orders
  big_orders AS (
    SELECT customer_id, SUM(total) AS total_spent
    FROM orders
    WHERE status = 'paid'
    GROUP BY customer_id
    HAVING total_spent > 10000
  ),
  -- Step 2: enrich with customer details
  vip_customers AS (
    SELECT c.name, c.email, b.total_spent
    FROM customers c
    JOIN big_orders b ON c.id = b.customer_id
  )
-- Final: use the last CTE
SELECT * FROM vip_customers
ORDER BY total_spent DESC;
```

Notice the shape: it reads top to bottom, like a recipe with numbered steps, instead of a single tangled expression.

> **Memory hook:** Multiple CTEs are sticky notes stuck one below the other — note 2 is allowed to read note 1, but never the other way around.

---

## 4. CTE vs Derived Table vs Temp Table

So where does a CTE actually sit compared to the other "temporary result" tools you already know — a derived table (subquery in `FROM`) and a `CREATE TEMPORARY TABLE`? Here's the side-by-side:

| Feature | CTE | Derived Table | Temp Table |
|---------|-----|---------------|------------|
| Syntax | WITH clause | Subquery in FROM | CREATE TEMPORARY TABLE |
| Reusable in same query | ✅ reference multiple times | ❌ once only | ✅ |
| Readable/named | ✅ | ❌ | ✅ |
| Recursive support | ✅ | ❌ | ❌ |
| Persists across queries | ❌ | ❌ | ✅ (session) |
| Materialized | Sometimes (MySQL decides) | No | Yes |
| Use for | Complex single query | Simple inline filter | Multi-query reuse |

---

## 5. Recursive CTEs

**The problem:** how do you find *everyone who reports, directly or indirectly,* to a given manager — when you don't know in advance how many levels deep the org chart goes? A regular query can join `employees` to itself once, to get direct reports. Join it twice, and you get reports-of-reports. But what about level 5? Level 10? You can't write a fixed number of JOINs for data whose depth you don't know ahead of time. Same problem shows up for category trees ("Electronics → Computers → Laptops → Gaming Laptops …"), threaded comments, and bill-of-materials explosions (a car is made of assemblies, which are made of sub-assemblies, which are made of parts…).

**The analogy:** picture a snowball rolling downhill. It starts as one small clump (the anchor — the CEO, the root category, the top-level part). Then, on each pass, it rolls over the next layer and picks up everyone attached to what it already has (their direct reports), growing the snowball. It keeps rolling — pass after pass — until a pass comes along and finds nobody left to pick up. Then it stops.

That's precisely what a **recursive CTE** does: it references *itself*, repeatedly, building up a result set one layer at a time until a pass adds zero new rows.

```sql
WITH RECURSIVE cte_name AS (
  -- Anchor member: starting point (non-recursive)
  SELECT ...

  UNION ALL

  -- Recursive member: joins back to cte_name
  SELECT ... FROM table JOIN cte_name ON ...
  WHERE termination_condition
)
SELECT * FROM cte_name;
```

Two named parts, glued with `UNION ALL`:
- **Anchor member** — the starting point. Runs exactly **once**. (The first small snowball clump.)
- **Recursive member** — references the CTE by name, joining against whatever the CTE contains *so far*. Runs **repeatedly**, each time only against the rows added in the *previous* pass, until a pass produces zero rows — at which point MySQL stops.

**What's actually happening internally, pass by pass:**

```text
Pass 0 (Anchor member runs ONCE):
   SELECT ... WHERE manager_id IS NULL
        |
        v
   Result so far: { Alice }
        |
        v
Pass 1 (Recursive member runs — joins against Pass 0's rows):
   SELECT ... FROM employees e JOIN cte_name ON e.manager_id = cte.id
        |
        v
   New rows found: { Bob, Carol }  (Alice's direct reports)
   Result so far:  { Alice, Bob, Carol }
        |
        v
Pass 2 (Recursive member runs again — joins against Pass 1's NEW rows):
   New rows found: { Dave, Eve }   (Bob's and Carol's reports)
   Result so far:  { Alice, Bob, Carol, Dave, Eve }
        |
        v
Pass 3 (Recursive member runs again — joins against Pass 2's NEW rows):
   New rows found: (none — Dave and Eve have no reports)
        |
        v
   Zero rows returned → STOP. Final result = everything accumulated.
```

Each pass only looks at the rows the *previous* pass just added — not the whole accumulated table — which is exactly why it eventually terminates instead of re-processing everyone forever.

**Termination:** the recursive member must eventually return zero rows, or you've built an infinite loop. MySQL protects you with a safety net — a max recursion depth (default 1000, controlled by `cte_max_recursion_depth`) — but that's a guard rail, not a substitute for a correct termination condition in your query.

---

## 6. Recursive CTE Examples

Let's see the snowball in action across a few different shapes of problem — an org chart, a plain number sequence, a calendar, and a parts explosion. Same anchor-then-repeat mechanics every time.

### Org Hierarchy (Who Reports to Whom)

```sql
-- employees: id, name, manager_id (NULL for top-level)
WITH RECURSIVE org_chart AS (
  -- Anchor: start with the CEO (no manager)
  SELECT id, name, manager_id, 0 AS depth, CAST(name AS CHAR(500)) AS path
  FROM employees
  WHERE manager_id IS NULL

  UNION ALL

  -- Recursive: find direct reports of each person
  SELECT e.id, e.name, e.manager_id, oc.depth + 1,
         CONCAT(oc.path, ' → ', e.name)
  FROM employees e
  JOIN org_chart oc ON e.manager_id = oc.id
)
SELECT depth, name, path
FROM org_chart
ORDER BY path;
```

```
Result:
depth | name    | path
0     | Alice   | Alice
1     | Bob     | Alice → Bob
1     | Carol   | Alice → Carol
2     | Dave    | Alice → Bob → Dave
2     | Eve     | Alice → Carol → Eve
```

See it? `depth` is literally counting the passes from the internal-working diagram above — depth 0 is the anchor, depth 1 is the first recursive pass, depth 2 is the second. The `path` column even shows the snowball's trail as it rolled.

### Number Series (1 to 100)

```sql
WITH RECURSIVE numbers AS (
  SELECT 1 AS n
  UNION ALL
  SELECT n + 1 FROM numbers WHERE n < 100
)
SELECT n FROM numbers;
```

### Date Calendar (all dates in a month)

```sql
WITH RECURSIVE calendar AS (
  SELECT '2026-01-01' AS dt
  UNION ALL
  SELECT DATE_ADD(dt, INTERVAL 1 DAY)
  FROM calendar
  WHERE dt < '2026-01-31'
)
SELECT dt, DAYNAME(dt) AS day_name FROM calendar;
```

### Bill of Materials (Parts Explosion)

```sql
-- parts: id, name, parent_id, quantity
WITH RECURSIVE bom AS (
  SELECT id, name, parent_id, quantity, 1 AS level
  FROM parts WHERE id = 1  -- root component

  UNION ALL

  SELECT p.id, p.name, p.parent_id, p.quantity * b.quantity, b.level + 1
  FROM parts p
  JOIN bom b ON p.parent_id = b.id
)
SELECT level, name, quantity FROM bom ORDER BY level, name;
```

---

### Common Mistakes with Recursive CTEs

**Forgetting the termination condition.** The recursive member *must* eventually return zero rows. If your `WHERE` clause never becomes false — say you forgot `WHERE n < 100` in the number series example — MySQL keeps rolling the snowball forever, until it slams into `cte_max_recursion_depth` and errors out. Always ask yourself: "what stops this?" before you run it.

**Assuming the whole CTE persists beyond the query.** Like any CTE, a recursive one is scoped to a single statement. Once the query finishes, the sticky note is thrown away — you can't reference `org_chart` again in a later, separate query. If you need the result again, you write the `WITH RECURSIVE ...` block again (or persist it into a real table).

**Confusing "runs once" with "runs on everything."** The recursive member doesn't re-scan the entire accumulated result on every pass — conceptually, each pass only joins against the rows the *previous* pass added. Forgetting this leads to confusion about why depth-based columns (like `path` or `level` above) increment cleanly instead of jumping around.

**Interview answer:** "A recursive CTE is a CTE that references itself to process hierarchical or sequential data whose depth isn't known up front — an org chart, a category tree, a bill of materials. It has two parts joined by `UNION ALL`: an anchor member that runs once to seed the result, and a recursive member that repeatedly joins against the rows added by the previous pass, stopping automatically once a pass returns zero new rows. You must ensure the recursive member's `WHERE` condition eventually becomes false, or MySQL will loop until it hits `cte_max_recursion_depth` (default 1000) and errors out."

> **Memory hook:** A recursive CTE is a snowball rolling downhill — one clump to start (anchor, runs once), picking up a new layer each pass (recursive member), stopping the moment a pass finds nothing left to grab.

---

## 7. Hands-On Exercises

Time to write some sticky notes of your own.

**Exercise 1:** Write a CTE that calculates each department's total payroll, then select only departments with payroll over $500,000.

**Exercise 2:** Write two chained CTEs: first get all orders from 2025, then get customers who placed more than 5 of those orders.

**Exercise 3:** Use a recursive CTE to generate all dates in June 2026.

**Exercise 4:** Build an employee org chart CTE. Find all direct and indirect reports under a specific manager (by name).

**Exercise 5:** Rewrite a complex nested subquery (3 levels deep) as a CTE chain — compare readability.

---

## 8. Interview Q&A

**Q: What is a CTE and how does it differ from a subquery?**
Answer: A CTE is a named temporary result set defined with the WITH clause before the main query. Unlike a subquery, a CTE can be referenced multiple times in the same query, supports recursion, and is generally more readable. Both exist only for the duration of the query.

**Q: What is a recursive CTE and what are its two parts?**
Answer: A recursive CTE references itself. It has two parts connected by UNION ALL: an anchor member (the starting/base case, runs once) and a recursive member (references the CTE itself, runs repeatedly until no more rows). A termination condition in the recursive member prevents infinite loops.

**Q: What are common use cases for recursive CTEs?**
Answer: Hierarchical data traversal (org charts, category trees, threaded comments), sequential generation (date calendars, number series), graph traversal (finding paths), and bill-of-materials explosions (nested part dependencies).

**Q: Can a CTE be referenced multiple times in the same query?**
Answer: Yes — this is one of the main advantages over derived tables. You can reference the same CTE multiple times in JOINs or subqueries within the main query. In MySQL 8.0, CTEs may or may not be materialized depending on the optimizer.

**Q: What is the maximum recursion depth for recursive CTEs in MySQL?**
Answer: The default is 1000, controlled by the `cte_max_recursion_depth` system variable. You can increase it: `SET SESSION cte_max_recursion_depth = 5000;`. Always ensure your recursive CTE has a proper termination condition to avoid hitting this limit.
