# Top 50 SQL & PostgreSQL Interview Questions (Coding & Internals)

Comprehensive production & FAANG-level interview guide covering **SQL query coding problems** (including 2nd highest salary, window functions, CTEs, self-joins) and **relational database architecture** (MVCC, indexing, execution plans, and transaction isolation).

---

## 1. High-Frequency SQL Query Coding Problems (Q1 – Q20)

### Q1: Write a SQL query to find the 2nd Highest Salary from an `employees` table. What are the different ways, and how do you handle duplicates/ties and NULLs?
**Answer:**
There are **4 primary approaches** to solve this classic interview question.

#### Approach 1: `DENSE_RANK()` (Recommended — Handles ties and skips duplicates cleanly)
```sql
WITH RankedSalaries AS (
    SELECT salary,
           DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk
    FROM employees
)
SELECT salary AS second_highest_salary
FROM RankedSalaries
WHERE rnk = 2
LIMIT 1;
```
*Why `DENSE_RANK()`?* If salaries are `[100k, 100k, 80k]`, `RANK()` gives ranks `1, 1, 3` (skipping 2). `DENSE_RANK()` gives `1, 1, 2`, correctly returning `80k`.

#### Approach 2: `LIMIT` and `OFFSET` with `DISTINCT`
```sql
SELECT DISTINCT salary AS second_highest_salary
FROM employees
ORDER BY salary DESC
LIMIT 1 OFFSET 1;
```
*To return `NULL` if no 2nd highest salary exists (e.g. only 1 employee in table):*
```sql
SELECT (
    SELECT DISTINCT salary
    FROM employees
    ORDER BY salary DESC
    LIMIT 1 OFFSET 1
) AS second_highest_salary;
```

#### Approach 3: Subquery with `< MAX(salary)`
```sql
SELECT MAX(salary) AS second_highest_salary
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
```

#### Approach 4: Generic N-th Highest Salary (using correlated subquery or parameter N)
```sql
-- Finding the N-th highest salary (e.g., N = 2)
SELECT e1.salary
FROM employees e1
WHERE 2 - 1 = (
    SELECT COUNT(DISTINCT e2.salary)
    FROM employees e2
    WHERE e2.salary > e1.salary
);
```

---

### Q2: Write a query to find the N-th Highest Salary in EACH department.
**Answer:**
Use `DENSE_RANK()` partitioned by `department_id`:

```sql
WITH DeptSalaryRank AS (
    SELECT id,
           name,
           department_id,
           salary,
           DENSE_RANK() OVER (
               PARTITION BY department_id 
               ORDER BY salary DESC
           ) AS rnk
    FROM employees
)
SELECT id, name, department_id, salary
FROM DeptSalaryRank
WHERE rnk = 2; -- Change to N as needed
```

---

### Q3: How do you find duplicate rows in a table, and how do you delete duplicates while keeping only one copy?
**Answer:**

#### Step 1: Identify duplicates
```sql
SELECT email, COUNT(*) AS count
FROM users
GROUP BY email
HAVING COUNT(*) > 1;
```

#### Step 2: Delete duplicates while retaining the row with the lowest `id`

**Method A: Using CTE with `ROW_NUMBER()` (PostgreSQL & standard SQL)**
```sql
WITH Duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY email 
               ORDER BY id ASC
           ) AS row_num
    FROM users
)
DELETE FROM users
WHERE id IN (
    SELECT id FROM Duplicates WHERE row_num > 1
);
```

**Method B: Self-Join / Subquery with `MIN(id)`**
```sql
DELETE FROM users
WHERE id NOT IN (
    SELECT MIN(id)
    FROM users
    GROUP BY email
);
```

---

### Q4: Write a query to find all employees who earn more than their direct managers.
**Answer:**
This requires a **Self-Join** on the `employees` table:

```sql
SELECT e.name AS employee_name,
       e.salary AS employee_salary,
       m.name AS manager_name,
       m.salary AS manager_salary
FROM employees e
JOIN employees m ON e.manager_id = m.id
WHERE e.salary > m.salary;
```

---

### Q5: How do you compute a Running Total (Cumulative Sum) in SQL?
**Answer:**
Use the window aggregate `SUM() OVER ()` with explicit window framing:

```sql
SELECT account_id,
       transaction_date,
       amount,
       SUM(amount) OVER (
           PARTITION BY account_id
           ORDER BY transaction_date ASC
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_balance
FROM transactions
ORDER BY account_id, transaction_date;
```
> **Note:** By default in PostgreSQL, `ORDER BY` inside an `OVER` clause defaults to `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. Using `ROWS BETWEEN` is safer and faster because it processes rows physically rather than comparing range values.

---

### Q6: How do you calculate a 7-day or 3-month Rolling / Moving Average?
**Answer:**
```sql
SELECT sales_date,
       daily_revenue,
       AVG(daily_revenue) OVER (
           ORDER BY sales_date ASC
           ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
       ) AS moving_avg_7day
FROM daily_sales;
```

---

### Q7: How do you detect consecutive active days (Streak Detection / Gaps & Islands)?
**Answer:**
If a user logs in consecutive days (`2026-10-01`, `2026-10-02`, `2026-10-03`), subtracting the `ROW_NUMBER()` (1, 2, 3) from the login date yields a **constant date group identifier**:

```sql
WITH RankedLogins AS (
    SELECT DISTINCT user_id, 
           login_date,
           login_date - (ROW_NUMBER() OVER (
               PARTITION BY user_id 
               ORDER BY login_date
           ) * INTERVAL '1 day') AS grp
    FROM user_logins
),
StreakCounts AS (
    SELECT user_id,
           grp,
           MIN(login_date) AS streak_start,
           MAX(login_date) AS streak_end,
           COUNT(*) AS streak_length
    FROM RankedLogins
    GROUP BY user_id, grp
)
SELECT user_id, MAX(streak_length) AS longest_streak_days
FROM StreakCounts
GROUP BY user_id;
```

---

### Q8: Find all customers who have never placed an order. What are the 3 ways to write this Anti-Join, and which is best?
**Answer:**

#### Method 1: `LEFT JOIN` with `WHERE ... IS NULL`
```sql
SELECT c.id, c.name
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE o.customer_id IS NULL;
```

#### Method 2: `NOT EXISTS` (Recommended for performance and NULL safety)
```sql
SELECT c.id, c.name
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

#### Method 3: `NOT IN` (Dangerous with NULLs!)
```sql
SELECT c.id, c.name
FROM customers c
WHERE c.id NOT IN (
    SELECT customer_id FROM orders WHERE customer_id IS NOT NULL
);
```
> **Critical Interview Warning:** If `orders.customer_id` contains even a single `NULL` value, `NOT IN (SELECT customer_id FROM orders)` evaluates to `UNKNOWN` for all rows, returning **empty results**! Always prefer `NOT EXISTS` or `LEFT JOIN WHERE NULL`.

---

### Q9: Find the department with the highest average employee salary.
**Answer:**
```sql
SELECT d.name AS department_name,
       AVG(e.salary) AS avg_salary
FROM departments d
JOIN employees e ON d.id = e.department_id
GROUP BY d.id, d.name
ORDER BY avg_salary DESC
LIMIT 1;
```

---

### Q10: What is the exact difference between `RANK()`, `DENSE_RANK()`, and `ROW_NUMBER()`?
**Answer:**
When sorting values with duplicates (e.g. salaries: `100, 100, 90, 80`):
- **`ROW_NUMBER()`**: Always assigns distinct sequential numbers: `1, 2, 3, 4` (arbitrary ordering among duplicates).
- **`RANK()`**: Assigns equal rank to ties, but **skips subsequent ranks**: `1, 1, 3, 4`.
- **`DENSE_RANK()`**: Assigns equal rank to ties, and **does not skip numbers**: `1, 1, 2, 3`.

```sql
SELECT salary,
       ROW_NUMBER() OVER (ORDER BY salary DESC) AS row_num,
       RANK()       OVER (ORDER BY salary DESC) AS rnk,
       DENSE_RANK() OVER (ORDER BY salary DESC) AS dense_rnk
FROM employees;
```

---

### Q11: Explain the difference between `WHERE` and `HAVING`. When does each execute?
**Answer:**
- **`WHERE`** filters rows **before** aggregation and grouping occur. It cannot reference aggregate functions (`COUNT`, `SUM`, `AVG`).
- **`HAVING`** filters groups **after** aggregation has taken place.

**SQL Query Execution Order:**
1. `FROM` & `JOIN`
2. `WHERE` (Row filtering)
3. `GROUP BY` (Bucket grouping)
4. `HAVING` (Group filtering)
5. `SELECT` (Projection & Expressions)
6. `DISTINCT`
7. `ORDER BY`
8. `LIMIT` / `OFFSET`

```sql
-- WHERE filters out inactive orders first; HAVING filters stores with total sales > 10,000
SELECT store_id, SUM(amount) AS total_sales
FROM orders
WHERE status = 'COMPLETED'
GROUP BY store_id
HAVING SUM(amount) > 10000;
```

---

### Q12: How do you pivot rows into columns (Cross-Tabulation) in PostgreSQL without installing third-party extensions?
**Answer:**
Use **Conditional Aggregation** with `CASE WHEN` or PostgreSQL's `FILTER (WHERE ...)`:

```sql
-- Method A: PostgreSQL FILTER clause (cleanest & fastest)
SELECT department_id,
       COUNT(*) FILTER (WHERE role = 'ENGINEER') AS total_engineers,
       COUNT(*) FILTER (WHERE role = 'DESIGNER') AS total_designers,
       COUNT(*) FILTER (WHERE role = 'MANAGER')  AS total_managers
FROM employees
GROUP BY department_id;

-- Method B: Standard ANSI SQL CASE WHEN
SELECT department_id,
       SUM(CASE WHEN role = 'ENGINEER' THEN 1 ELSE 0 END) AS total_engineers,
       SUM(CASE WHEN role = 'DESIGNER' THEN 1 ELSE 0 END) AS total_designers,
       SUM(CASE WHEN role = 'MANAGER'  THEN 1 ELSE 0 END) AS total_managers
FROM employees
GROUP BY department_id;
```

---

### Q13: Write an update query to swap the values of column `gender` ('m' to 'f' and 'f' to 'm') in a single statement.
**Answer:**
```sql
UPDATE users
SET gender = CASE 
    WHEN gender = 'm' THEN 'f'
    WHEN gender = 'f' THEN 'm'
    ELSE gender
END;
```

---

### Q14: How do you find missing numbers in a sequential ID column (1 to 100)?
**Answer:**
Use PostgreSQL's `generate_series()` function with an Anti-Join:

```sql
SELECT s.id AS missing_id
FROM generate_series(1, 100) AS s(id)
LEFT JOIN users u ON s.id = u.id
WHERE u.id IS NULL;
```

---

### Q15: Write a Recursive CTE to traverse an Organizational Hierarchy (Manager-to-Subordinates Tree).
**Answer:**
```sql
WITH RECURSIVE OrgChart AS (
    -- Anchor member: CEO (has no manager)
    SELECT id, name, manager_id, 1 AS level, ARRAY[name] AS path
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- Recursive member: Direct reports
    SELECT e.id, e.name, e.manager_id, o.level + 1, o.path || e.name
    FROM employees e
    JOIN OrgChart o ON e.manager_id = o.id
)
SELECT id, name, level, array_to_string(path, ' -> ') AS hierarchy_path
FROM OrgChart
ORDER BY level, manager_id;
```

---

### Q16: How do you find the second most recent event for each user?
**Answer:**
```sql
WITH RankedEvents AS (
    SELECT user_id,
           event_type,
           event_timestamp,
           ROW_NUMBER() OVER (
               PARTITION BY user_id 
               ORDER BY event_timestamp DESC
           ) AS rn
    FROM user_events
)
SELECT user_id, event_type, event_timestamp
FROM RankedEvents
WHERE rn = 2;
```

---

### Q17: Write a query for Market Basket Analysis: Find pairs of products frequently purchased together.
**Answer:**
```sql
SELECT o1.product_id AS product_a,
       o2.product_id AS product_b,
       COUNT(*) AS times_bought_together
FROM order_items o1
JOIN order_items o2 
  ON o1.order_id = o2.order_id 
 AND o1.product_id < o2.product_id -- Prevents duplicate (A,B) and (B,A) and self-matches
GROUP BY o1.product_id, o2.product_id
ORDER BY times_bought_together DESC
LIMIT 10;
```

---

### Q18: What is an Upsert in PostgreSQL and how is it written?
**Answer:**
PostgreSQL uses `INSERT ... ON CONFLICT (...) DO UPDATE` or `DO NOTHING`:

```sql
INSERT INTO user_stats (user_id, login_count, last_login)
VALUES (101, 1, NOW())
ON CONFLICT (user_id) 
DO UPDATE SET 
    login_count = user_stats.login_count + 1,
    last_login = EXCLUDED.last_login;
```
> `EXCLUDED` represents the row proposed for insertion.

---

### Q19: What is the difference between `LEAD()` and `LAG()` window functions? Provide a real scenario.
**Answer:**
- **`LAG(col, offset)`**: Accesses data from a preceding row without a self-join.
- **`LEAD(col, offset)`**: Accesses data from a following row.

*Scenario: Month-Over-Month Revenue Growth Percentage:*
```sql
WITH MonthlyRevenue AS (
    SELECT DATE_TRUNC('month', order_date) AS month,
           SUM(amount) AS revenue
    FROM orders
    GROUP BY 1
)
SELECT month,
       revenue,
       LAG(revenue, 1) OVER (ORDER BY month) AS prev_month_revenue,
       ROUND(
           ((revenue - LAG(revenue, 1) OVER (ORDER BY month)) / 
           NULLIF(LAG(revenue, 1) OVER (ORDER BY month), 0)) * 100, 
           2
       ) AS growth_pct
FROM MonthlyRevenue;
```

---

### Q20: How do you query and filter inside JSONB columns in PostgreSQL?
**Answer:**
- `->` extracts JSON object by key / index (returns `jsonb`).
- `->>` extracts JSON object as text (returns `text`).
- `@>` containment operator (checks if JSON contains a target sub-JSON).

```sql
-- Find users whose preferences JSON contains {"notifications": {"email": true}}
SELECT id, email
FROM users
WHERE preferences @> '{"notifications": {"email": true}}';

-- Query nested field with text cast
SELECT id, profile->'address'->>'city' AS city
FROM users
WHERE profile->'address'->>'city' = 'Seattle';
```

---

## 2. Relational Design, Constraints & Joins (Q21 – Q30)

### Q21: What are the differences between Primary Key, Unique Key, and Candidate Key?
**Answer:**
- **Candidate Key:** Any column or minimal set of columns that can uniquely identify a row.
- **Primary Key:** The chosen candidate key. Enforces uniqueness and `NOT NULL`. A table can have only **one** Primary Key.
- **Unique Key:** Enforces uniqueness across rows, but permits `NULL` values (in PostgreSQL, multiple rows can have `NULL` because `NULL != NULL` under ANSI SQL, unless declared `UNIQUE NULLS NOT DISTINCT`). A table can have **multiple** Unique keys.

---

### Q22: What are the foreign key referential integrity actions?
**Answer:**
- **`ON DELETE CASCADE`**: When parent row is deleted, automatically deletes matching child rows.
- **`ON DELETE SET NULL`**: Sets the foreign key column to `NULL` in child rows.
- **`ON DELETE RESTRICT`**: Rejects delete of parent immediately if child rows exist.
- **`ON DELETE NO ACTION`**: Rejects delete at the end of the transaction or statement (allows deferred check).

---

### Q23: What are 1NF, 2NF, 3NF, and BCNF?
**Answer:**
- **1NF (First Normal Form):** Atomic values (no arrays/repeating groups in a single column), distinct column names, unique rows via Primary Key.
- **2NF:** In 1NF + **No Partial Dependency** (all non-key attributes depend on the *whole* composite primary key, not just a subset).
- **3NF:** In 2NF + **No Transitive Dependency** (non-key attributes depend *only* on the primary key: if $A \to B$ and $B \to C$, $C$ must be split into its own table).
- **BCNF (Boyce-Codd Normal Form):** Stricter 3NF where for every functional dependency $X \to Y$, $X$ must be a superkey.

---

### Q24: When should you intentionally denormalize a database schema?
**Answer:**
Denormalization is a deliberate trade-off where redundant data is stored to optimize read performance at the expense of write complexity.
**Use cases:**
1. High-frequency read queries requiring 5+ table joins in latency-critical paths.
2. Analytics / Reporting dashboards (e.g. storing pre-computed `total_order_amount` on `orders` instead of summing `order_items` on every query).
3. Historical snapshots (e.g. storing customer's current shipping address on the `orders` invoice row, so future address changes don't alter past invoices).

---

### Q25: What is Soft Deleting, and what are its hidden database performance pitfalls?
**Answer:**
Soft deleting marks a row as deleted via a flag (`is_deleted BOOLEAN` or `deleted_at TIMESTAMP`) instead of running `DELETE`.
**Hidden Pitfalls:**
1. **Query Pollution:** Every `SELECT`, `JOIN`, and subquery must include `WHERE deleted_at IS NULL`.
2. **Broken Unique Constraints:** A user registers with `alice@example.com`, deletes their account, then tries to re-register. A standard `UNIQUE(email)` constraint rejects the insert.
   *Fix:* Use a **Partial Unique Index**:
   ```sql
   CREATE UNIQUE INDEX uq_user_email ON users (email) WHERE deleted_at IS NULL;
   ```
3. **Table Bloat & Cache Waste:** Deleted rows remain in 8KB disk pages, polluting PostgreSQL's shared buffers.

---

### Q26: Explain Three-Valued Logic in SQL (`TRUE`, `FALSE`, `UNKNOWN`).
**Answer:**
Because `NULL` represents "unknown value", comparisons involving `NULL` evaluate to `UNKNOWN`:
- `NULL = NULL` $\to$ `UNKNOWN` (Neither True nor False).
- `NULL <> 1` $\to$ `UNKNOWN`.
- `WHERE` and `HAVING` filters only accept conditions that evaluate to **`TRUE`**; rows evaluating to `UNKNOWN` or `FALSE` are discarded.
- In PostgreSQL, use `IS DISTINCT FROM` to treat `NULL` as a comparable scalar:
  ```sql
  WHERE old_val IS DISTINCT FROM new_val
  ```

---

### Q27: Compare `UNION` vs `UNION ALL`. Which one is faster and why?
**Answer:**
- **`UNION ALL`** concatenates the result sets directly without inspecting contents. Execution cost is $O(M + N)$.
- **`UNION`** concatenates and then runs an expensive deduplication step (Sort Unique or Hash Unique). Execution cost is $O((M + N) \log (M + N))$ or requires substantial temporary disk/RAM memory.
> **Rule of Thumb:** Always use `UNION ALL` unless duplicate removal is strictly required by business logic.

---

### Q28: What is the difference between a View and a Materialized View?
**Answer:**
- **View:** A saved SQL query. Every time the view is queried, the database re-runs the underlying query dynamically. Consumes zero disk storage.
- **Materialized View:** Executes the underlying query once and **persists the physical result table to disk**. Queries against it are instant.
  *Refreshing:*
  ```sql
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_sales;
  ```
  *(Requires a unique index on the materialized view to refresh without acquiring exclusive table locks).*

---

### Q29: What is a Cross Join vs Natural Join?
**Answer:**
- **`CROSS JOIN`**: Produces the Cartesian Product of two tables (if Table A has 1,000 rows and Table B has 1,000 rows, output is $1,000 \times 1,000 = 1,000,000$ rows).
- **`NATURAL JOIN`**: Implicitly joins two tables on all columns sharing the same name. Dangerous in production because altering a table by adding a column can silently break query semantics.

---

### Q30: What is the difference between `TRUNCATE`, `DROP`, and `DELETE`?
**Answer:**
| Feature | `DELETE` | `TRUNCATE` | `DROP` |
|---|---|---|---|
| **Category** | DML | DDL | DDL |
| **Row-by-row logging** | Yes (heavy WAL / Undo) | No (allocates new empty data file) | No |
| **WHERE clause** | Supported | Not supported | Not supported |
| **Triggers** | Fires row-level triggers | Only statement-level | None |
| **Speed** | Slow for large tables | Near instantaneous | Near instantaneous |
| **Rollback** | Yes (in transaction) | Yes (in PostgreSQL!) | Yes (in PostgreSQL!) |

---

## 3. Indexing, Query Optimization & EXPLAIN (Q31 – Q40)

### Q31: How does a B-Tree index work under the hood in PostgreSQL?
**Answer:**
A B-Tree (Balanced Tree) is a self-balancing search tree consisting of:
- **Root Page:** The entry point.
- **Internal / Branch Pages:** Store pivot keys and child page pointers to direct search traffic.
- **Leaf Pages:** Store the indexed keys in sorted order along with **Tuple Identifiers (TIDs)** `(page_id, slot_number)` pointing to physical disk locations in the heap. Leaf pages are linked via a doubly-linked list for fast range scanning (`<`, `>`, `BETWEEN`).
- Search complexity is $O(\log N)$.

---

### Q32: What is the Leftmost Prefix Rule for Composite Indexes?
**Answer:**
If you create a composite index on `(status, created_at, user_id)`:
- `WHERE status = 'ACTIVE' AND created_at > NOW()` $\to$ **Uses Index**
- `WHERE status = 'ACTIVE'` $\to$ **Uses Index**
- `WHERE created_at > NOW()` $\to$ **Cannot use index efficiently** (skips the leading column)
- `WHERE user_id = 42` $\to$ **Cannot use index**

> **Column Ordering Rule:** Put the highest equality filter column first, followed by range/sort columns.

---

### Q33: Compare B-Tree, GIN, and BRIN indexes in PostgreSQL.
**Answer:**
- **B-Tree ($O(\log N)$):** Best for scalar values, primary keys, dates, and numbers.
- **GIN (Generalized Inverted Index):** Inverted index mapping elements/tokens to list of row IDs. Best for `JSONB` (`@>`), Arrays (`@>`), and Full-Text Search.
- **BRIN (Block Range Index):** Stores only the Minimum and Maximum values for contiguous blocks of 8KB disk pages (e.g. every 128 pages).
  - *Best For:* Multi-gigabyte append-only tables (logs, timeseries, IoT metrics) sorted by timestamp.
  - *Advantage:* **1,000x smaller** than B-Tree (e.g., 500 KB vs 1 GB).

---

### Q34: What is a Covering Index and why might an Index-Only Scan still touch the Heap?
**Answer:**
A covering index includes extra payload columns in the leaf nodes using the **`INCLUDE` clause**:
```sql
CREATE INDEX idx_orders_covering ON orders (customer_id) INCLUDE (order_total, status);
```
Query:
```sql
SELECT order_total, status FROM orders WHERE customer_id = 50;
```
**Why it touches the heap:**
PostgreSQL must verify MVCC row visibility. If the **Visibility Map (VM)** indicates that some tuples in the page have not been vacuumed and may have uncommitted changes, PostgreSQL must fetch the heap tuple to check `xmin`/`xmax`. Regular `VACUUM` keeps the Visibility Map clean, enabling pure 0-heap Index-Only scans.

---

### Q35: How do you read `EXPLAIN (ANALYZE, BUFFERS)` output? What are the 4 main scan types?
**Answer:**
1. **Sequential Scan (`Seq Scan`):** Reads the entire table from disk sequentially. Fast for small tables, slow for large tables with selective filters.
2. **Index Scan:** Traverses B-Tree to find matching TID, then immediately reads corresponding heap page for each row.
3. **Index Only Scan:** Satisfies entire query directly from index leaf pages (if visible in Visibility Map).
4. **Bitmap Index Scan + Bitmap Heap Scan:** Scans the index, builds an in-memory bitmap of matching pages, sorts page numbers physically to minimize random I/O, then fetches pages sequentially.

---

### Q36: Why might PostgreSQL ignore an index and perform a Sequential Scan?
**Answer:**
1. **Low Selectivity:** The query matches a large percentage of the table (>15–20%). Random disk I/O from index lookups is slower than a sequential sequential read.
2. **Function Applied to Column:** `WHERE LOWER(email) = 'test@example.com'` (Fix: create a Functional Index: `CREATE INDEX ON users (LOWER(email))`).
3. **Implicit Type Coercion:** Comparing `VARCHAR` to `INTEGER` or mismatched collation.
4. **Outdated Table Statistics:** The query planner's catalog statistics are stale (Fix: run `ANALYZE table_name`).
5. **Table is Very Small:** The entire table fits in a few 8KB disk pages.

---

### Q37: Why is `COUNT(*)` slow on large PostgreSQL tables, and how do you optimize it?
**Answer:**
Because of MVCC, there is no global row counter. Each transaction may see a different number of active rows, forcing `COUNT(*)` to scan pages to check visibility.
**Optimizations:**
1. **Approximate Count (Instant for UI/Dashboards):**
   ```sql
   SELECT reltuples::BIGINT AS estimated_count 
   FROM pg_class 
   WHERE relname = 'large_table';
   ```
2. **Trigger-Maintained Counter Table:** Increment/decrement a counter in a summary table on `INSERT`/`DELETE`.
3. **Covering Index:** `COUNT(*)` can use a lightweight index-only scan if vacuumed.

---

### Q38: How do you optimize deep pagination (`LIMIT 10 OFFSET 1000000`)?
**Answer:**
`OFFSET 1,000,000` forces the database to read 1,000,010 rows from disk and discard the first 1,000,000 rows ($O(N)$ CPU & I/O penalty).

**Solution: Keyset / Cursor-Based Pagination ($O(1)$)**
Instead of offset, filter by the last seen ID or timestamp:
```sql
-- Page 1:
SELECT id, title, created_at
FROM articles
ORDER BY id DESC
LIMIT 10;

-- Page 2 (Pass the last seen id = 9520):
SELECT id, title, created_at
FROM articles
WHERE id < 9520
ORDER BY id DESC
LIMIT 10;
```

---

### Q39: What is CTE Inlining vs CTE Materialization in PostgreSQL?
**Answer:**
Prior to PostgreSQL 12, all Common Table Expressions (`WITH ... AS (...)`) were strict **optimization fences** — materialized into temporary memory, preventing the optimizer from pushing down `WHERE` clauses into the CTE.
In PostgreSQL 12+, non-recursive side-effect-free CTEs are automatically **inlined** into the main query:
```sql
-- Force materialization if desired:
WITH data AS MATERIALIZED (SELECT * FROM huge_table) ...

-- Force inlining:
WITH data AS NOT MATERIALIZED (SELECT * FROM huge_table) ...
```

---

### Q40: How does SQL Injection work, and why do Prepared Statements guarantee immunity?
**Answer:**
SQL Injection occurs when user input is concatenated into an SQL string, allowing malicious actors to alter the query AST (Abstract Syntax Tree):
```sql
-- Vulnerable:
"SELECT * FROM users WHERE username = '" + userInput + "'"
-- Input: admin' OR '1'='1
```
**Why Prepared Statements Work:**
Prepared statements separate **Code from Data**:
1. The database parser parses the query structure with placeholders `$1`, `$2` and generates the query execution plan **before** parameters are bound.
2. User parameters are transmitted separately across the wire as literal values. They are never parsed as SQL tokens, making injection mathematically impossible.

---

## 4. Concurrency, Transactions & Internals (Q41 – Q50)

### Q41: Explain ACID Properties and how PostgreSQL implements each.
**Answer:**
- **Atomicity:** All operations commit or none do. Implemented via Write-Ahead Log (WAL) and transaction abort rollbacks.
- **Consistency:** Database transitions only from one valid state to another. Implemented via schema constraints (`CHECK`, `FOREIGN KEY`, `NOT NULL`, `UNIQUE`).
- **Isolation:** Concurrent transactions cannot see uncommitted changes. Implemented via **MVCC** (Multi-Version Concurrency Control) and lock managers.
- **Durability:** Committed transactions survive system crashes. Implemented via WAL buffers flushed to disk (`fsync`) before acknowledging success to client.

---

### Q42: What are the 4 Transaction Isolation Levels and 3 Concurrency Phenomena?
**Answer:**

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read | Serialization Anomaly |
|---|---|---|---|---|
| **Read Uncommitted** | Possible (Not in PG!) | Possible | Possible | Possible |
| **Read Committed** (PG Default) | ❌ Prevented | Possible | Possible | Possible |
| **Repeatable Read** | ❌ Prevented | ❌ Prevented | ❌ Prevented (in PG!) | Possible |
| **Serializable** | ❌ Prevented | ❌ Prevented | ❌ Prevented | ❌ Prevented |

- **Dirty Read:** Transaction reads uncommitted changes from another transaction. (PostgreSQL treats Read Uncommitted as Read Committed).
- **Non-Repeatable Read:** Transaction reads row $X$, another transaction modifies $X$ and commits; reading $X$ again yields different values.
- **Phantom Read:** Transaction reads set of rows matching condition; another transaction inserts new row matching condition and commits; re-reading yields "phantom" row.
- **Write Skew:** Two transactions concurrently read overlapping data, make disjoint updates based on that data, violating a global invariant.

---

### Q43: How does MVCC work at the physical disk layer in PostgreSQL? What is a Heap-Only Tuple (HOT)?
**Answer:**
Unlike MySQL InnoDB which writes old row versions to an Undo Log, PostgreSQL writes row versions directly into the **table heap pages**.
Every row tuple has a header containing:
- `xmin`: TXID of creating transaction.
- `xmax`: TXID of deleting/updating transaction (0 if active).
- `ctid`: Physical tuple pointer `(page, slot)`.

**Heap-Only Tuple (HOT) Optimization:**
When an `UPDATE` changes **only non-indexed columns** and the new tuple fits inside the **same 8KB page**, PostgreSQL does not update any indexes! It simply chains the old tuple to the new tuple via `ctid` inside the page, eliminating index write amplification.

---

### Q44: What are Dead Tuples, Table Bloat, and why is `VACUUM` needed?
**Answer:**
When rows are updated or deleted, PostgreSQL marks the old tuple with `xmax` but leaves it physically on disk so active transactions can still view it. Once all transactions that could see the old tuple complete, it becomes a **Dead Tuple**.
- If dead tuples accumulate, pages remain bloated, slowing down sequential scans and caching.
- **`VACUUM`**: Reclaims space occupied by dead tuples inside 8KB pages so new inserts can reuse that space.
- **`VACUUM FULL`**: Rewrites the entire table into a new file, freeing disk space to the OS, but acquires an **exclusive table lock** (`ACCESS EXCLUSIVE`).

---

### Q45: What is Transaction ID (TXID) Wraparound, and how does PostgreSQL prevent catastrophic data loss?
**Answer:**
PostgreSQL uses a 32-bit integer for Transaction IDs ($2^{32} \approx 4.29 \text{ billion}$).
Because visibility uses modular comparison, past and future transactions are separated by 2 billion TXIDs. Without maintenance, after 2.1 billion transactions, past transactions wrap around into the "future" and historical data becomes invisible.

**Prevention:**
The **Autovacuum Freeze** process scans pages and replaces old `xmin` identifiers with a special permanent flag: **`HEAP_XMIN_FROZEN`**. Frozen tuples are treated as permanently committed in the past forever. If a cluster approaches `autovacuum_freeze_max_age`, PostgreSQL enters aggressive freeze mode and will eventually shut down writes to prevent corruption.

---

### Q46: What is a Deadlock in SQL, and how do you resolve and prevent it?
**Answer:**
A deadlock occurs when Transaction A holds Lock 1 and waits for Lock 2, while Transaction B holds Lock 2 and waits for Lock 1. Neither can proceed.

**PostgreSQL Resolution:**
The `deadlock_timeout` timer (default: 1 second) fires. The lock manager runs cycle detection on the lock-wait graph and terminates the youngest transaction with `ERROR: deadlock detected`.

**Prevention Best Practices:**
1. Always acquire locks on tables and rows in the **exact same deterministic order** across all application transactions (e.g. sort user IDs before updating).
2. Keep transactions short; perform compute/network calls outside DB transactions.
3. Use `SELECT ... FOR UPDATE NOWAIT` or `SKIP LOCKED` for queue processing.

---

### Q47: What is Write-Ahead Logging (WAL) and how does Checkpointing work?
**Answer:**
- **WAL (Write-Ahead Logging):** Before any modification is applied to in-memory shared buffer pages, a description of the change (redo record) is written sequentially to the WAL log file on disk and flushed via `fsync`.
- **Checkpoint:** A periodic background process that flushes all dirty in-memory shared buffer pages to the actual table/index disk files and records a checkpoint record in WAL.
- **Crash Recovery:** If power fails, PostgreSQL starts at the last checkpoint record in WAL and replays all subsequent WAL records forward, restoring consistent state.

---

### Q48: Explain Declarative Table Partitioning in PostgreSQL.
**Answer:**
Splits a logical table into smaller physical tables:
1. **Range Partitioning:** By date or numerical range (e.g., `orders_2026_q1`, `orders_2026_q2`).
2. **List Partitioning:** By explicit key list (e.g., `customers_us`, `customers_eu`).
3. **Hash Partitioning:** Distributes rows across partitions via hash modulus.

**Benefit: Partition Pruning**
When a query filters `WHERE order_date >= '2026-01-01' AND order_date < '2026-04-01'`, the query planner prunes all partitions except `orders_2026_q1`, scanning only relevant disk segments.

---

### Q49: Streaming Replication: Synchronous vs Asynchronous Replication.
**Answer:**
- **Asynchronous Replication (Default):** The Primary commits transactions locally immediately after writing to WAL. Changes stream to replicas asynchronously. If Primary crashes before stream completes, small data loss (replication lag) can occur.
- **Synchronous Replication:** The Primary pauses commit until at least $N$ replicas acknowledge that WAL records have been received or written to disk. Zero data loss ($RPO = 0$), but write latency increases by network round-trip time.

---

### Q50: Why do production PostgreSQL instances need PgBouncer (Connection Pooling)?
**Answer:**
PostgreSQL uses a **process-per-connection** model. Each client connection forks a dedicated OS backend process consuming ~10MB+ RAM. At 500+ direct connections, the OS suffers from high context switching, TLB cache thrashing, and memory exhaustion.

**PgBouncer** acts as a lightweight proxy maintaining a small pool of actual PostgreSQL connections (e.g. 50 backend connections serving 5,000 application client connections) using **Transaction Pooling**, boosting throughput by up to 400%.
