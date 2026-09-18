# MySQL Interview Questions — 50+ Q&A

---

## Fundamentals

**Q1: What is the difference between MySQL and SQL?**
SQL (Structured Query Language) is the standard language for querying relational databases. MySQL is a specific RDBMS (Relational Database Management System) that implements SQL, with its own extensions and features. Other RDBMS that use SQL include PostgreSQL, Oracle, and SQL Server.

**Q2: What is the default storage engine in MySQL?**
InnoDB (since MySQL 5.5). InnoDB supports ACID transactions, row-level locking, and foreign keys. MyISAM (older default) lacks transactions and FK support but was historically faster for read-only workloads.

**Q3: What is the difference between CHAR and VARCHAR?**
CHAR(n) stores exactly n characters — shorter strings are right-padded with spaces, all rows take the same storage. VARCHAR(n) stores up to n characters, uses only as much space as needed plus 1-2 bytes for length. Use CHAR for fixed-length codes (country codes, status flags), VARCHAR for variable-length strings.

**Q4: What is the difference between DELETE, TRUNCATE, and DROP?**
DELETE removes specific rows (WHERE clause), logs each deletion in undo log, fires triggers, preserves table structure. TRUNCATE removes all rows instantly (deallocates pages), resets AUTO_INCREMENT, no undo log, no triggers. DROP removes the entire table including structure. DELETE is rollbackable; TRUNCATE and DROP are not.

**Q5: What is NULL in SQL and how do you check for it?**
NULL means "unknown" or "missing" — not zero, not empty string. NULL is not equal to anything including itself (`NULL = NULL` is NULL, not TRUE). Check for NULL with `IS NULL` or `IS NOT NULL`, never `= NULL`. In aggregate functions, NULLs are ignored (COUNT(*) counts all rows; COUNT(col) ignores NULLs in col).

---

## DDL and Data Types

**Q6: What are the constraints in MySQL?**
PRIMARY KEY (unique + not null), UNIQUE (unique, allows NULL), NOT NULL, DEFAULT, CHECK (validate values), FOREIGN KEY (referential integrity). PRIMARY KEY implicitly creates a clustered index in InnoDB.

**Q7: What is AUTO_INCREMENT?**
AUTO_INCREMENT automatically generates unique sequential integers for a column. Used for surrogate primary keys. Values never reuse deleted IDs. Reset to a specific value with `ALTER TABLE t AUTO_INCREMENT = 1000`. Last inserted value: `LAST_INSERT_ID()`.

**Q8: What is the difference between DATETIME and TIMESTAMP?**
DATETIME stores a fixed date/time (1000-9999, no timezone, 8 bytes). TIMESTAMP stores a UTC moment (1970-2038, 4 bytes) — automatically converts to/from server timezone on store/retrieve. TIMESTAMP is smaller and handles timezone correctly; DATETIME is more flexible in range and is timezone-agnostic.

---

## SELECT and Filtering

**Q9: What is the difference between WHERE and HAVING?**
WHERE filters individual rows before grouping. HAVING filters groups after GROUP BY and aggregation. You cannot use aggregate functions (COUNT, SUM) in WHERE; you can in HAVING.

**Q10: What is the order of SQL clause execution?**
FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT. Columns aliased in SELECT are not available in WHERE (happens after SELECT in processing). They are available in ORDER BY and HAVING (MySQL-specific extension).

**Q11: What does DISTINCT do?**
DISTINCT removes duplicate rows from the result set. Applied after SELECT, before ORDER BY. Can be slow on large datasets without an index because MySQL must compare all result rows. COUNT(DISTINCT col) counts unique non-NULL values.

---

## JOINs

**Q12: What is the difference between INNER JOIN and LEFT JOIN?**
INNER JOIN returns only rows that have matching records in both tables. LEFT JOIN returns all rows from the left table plus matching rows from the right — unmatched right-side columns are NULL. Use LEFT JOIN to find rows with no match in the right table (`WHERE right_id IS NULL`).

**Q13: What is a CROSS JOIN?**
CROSS JOIN returns the Cartesian product — every row from the left table paired with every row from the right. N × M rows total. Use for generating combinations (size × color matrix). Rarely used unintentionally; very expensive on large tables.

**Q14: How do you find rows in table A that have no match in table B?**
Use LEFT JOIN and filter for NULL on a NOT NULL column from B:
```sql
SELECT a.* FROM table_a a LEFT JOIN table_b b ON a.id = b.a_id WHERE b.id IS NULL;
```
Or with NOT EXISTS / NOT IN (watch for NULL trap with NOT IN).

---

## Aggregations and Window Functions

**Q15: What is the difference between COUNT(*) and COUNT(column)?**
COUNT(*) counts all rows including those with NULLs. COUNT(column) counts only rows where column is NOT NULL. COUNT(DISTINCT column) counts unique non-NULL values.

**Q16: What is a window function?**
A window function computes a value for each row based on a "window" of related rows (defined by OVER clause), without collapsing rows like GROUP BY. Examples: ROW_NUMBER(), RANK(), LAG(), SUM OVER(). Window functions run after WHERE and GROUP BY but before ORDER BY.

**Q17: What is the difference between ROW_NUMBER(), RANK(), and DENSE_RANK()?**
All rank rows within a partition. ROW_NUMBER() always gives unique sequential numbers (1,2,3,4). RANK() gives the same rank for ties but skips numbers (1,2,2,4). DENSE_RANK() gives same rank for ties without skipping (1,2,2,3).

**Q18: What is LAG() and LEAD()?**
LAG(col, n) returns the value of col from n rows before the current row in the window. LEAD(col, n) returns the value from n rows after. Both return NULL if the offset goes past the partition boundary. Used for comparing a row to the previous/next row (period-over-period analysis).

---

## Subqueries and CTEs

**Q19: What is a correlated subquery?**
A correlated subquery references a column from the outer query — it runs once per row of the outer query. Slower than a simple subquery but sometimes necessary (e.g., "employees earning above their department average"). Can often be rewritten as a JOIN or window function for better performance.

**Q20: What is the NOT IN NULL trap?**
If the subquery in `NOT IN (subquery)` returns any NULL, the entire condition evaluates to UNKNOWN (not TRUE), so no rows are returned. Fix: use `NOT EXISTS` instead, or add `WHERE col IS NOT NULL` to the subquery.

**Q21: What is a CTE and how does it differ from a subquery?**
A CTE (Common Table Expression) is a named temporary result set defined with `WITH`. Unlike a subquery (inline, anonymous), a CTE is named and can be referenced multiple times in the same query. Recursive CTEs (WITH RECURSIVE) can traverse hierarchies. CTEs generally improve readability; performance is similar to equivalent subqueries.

---

## Indexes

**Q22: What types of indexes does MySQL support?**
B-Tree (default, range + equality), FULLTEXT (text search), SPATIAL (geometry), HASH (MEMORY engine only). Within B-Tree: single, composite, covering, prefix, unique, invisible, descending, functional.

**Q23: What is a covering index?**
A covering index includes all columns needed by a query — MySQL can answer the query entirely from the index without reading the actual table row. Shown as "Using index" in EXPLAIN Extra. Add extra columns to the index to make it covering.

**Q24: What is the leftmost prefix rule for composite indexes?**
A composite index (a, b, c) is usable for queries filtering on (a), (a,b), or (a,b,c) — any left-anchored prefix. It's NOT usable for queries filtering on only (b) or only (c). Column order in a composite index matters — put the most selective or equality-filtered column first.

**Q25: When should you NOT add an index?**
Skip indexes on: small tables (full scan is faster), low-cardinality columns (e.g., boolean — only 2 values), frequently updated columns (indexes slow down DML), columns rarely used in WHERE/JOIN/ORDER BY. Too many indexes slow INSERT/UPDATE/DELETE and waste disk.

**Q26: What is an invisible index?**
An invisible index (MySQL 8.0+) is maintained by the engine but ignored by the optimizer. Use it to test the impact of dropping an index before actually dropping it, or to re-enable it quickly if performance degrades.

---

## Transactions

**Q27: What are the ACID properties?**
Atomicity: transaction is all-or-nothing. Consistency: database stays valid (constraints hold). Isolation: concurrent transactions don't see each other's partial work. Durability: committed data survives crashes. InnoDB implements ACID via undo log (atomicity), constraints (consistency), MVCC/locks (isolation), redo log (durability).

**Q28: What are the 4 isolation levels in MySQL?**
READ UNCOMMITTED (allows dirty reads), READ COMMITTED (prevents dirty reads), REPEATABLE READ (default — prevents non-repeatable reads), SERIALIZABLE (prevents all anomalies). MySQL's REPEATABLE READ also uses gap locks to prevent most phantom reads.

**Q29: What is a deadlock?**
A deadlock occurs when two transactions each hold a lock the other needs, creating a circular wait. InnoDB automatically detects deadlocks and rolls back the transaction with less work (error 1213). Prevent by: locking in consistent order, keeping transactions short, using SELECT FOR UPDATE.

**Q30: What is MVCC?**
Multi-Version Concurrency Control — InnoDB keeps multiple versions of rows so readers get a snapshot of data at their transaction's start, without blocking writers. Writers don't block readers and vice versa. This enables high concurrency under REPEATABLE READ isolation.

---

## Performance and EXPLAIN

**Q31: What does the `type` column in EXPLAIN mean?**
It shows the access method: `const` (best — single PK lookup), `eq_ref` (unique join), `ref` (non-unique index), `range` (index range scan), `index` (full index scan), `ALL` (worst — full table scan). Aim for const/eq_ref/ref for large tables; fix ALL with an index.

**Q32: What does "Using filesort" mean in EXPLAIN?**
MySQL cannot use an index for sorting and must do an additional sort step in memory or on disk. Fix: add an index that matches the ORDER BY column(s) and direction. The index must be usable for both filtering and sorting.

**Q33: What is the slow query log?**
A MySQL feature that logs queries exceeding `long_query_time` seconds. Enable with `SET GLOBAL slow_query_log = 1` and set threshold with `SET GLOBAL long_query_time = 1`. Analyze with mysqldumpslow or pt-query-digest.

---

## Stored Programs

**Q34: What is the difference between a stored procedure and a stored function?**
Stored functions return a single value and can be used in SQL expressions (SELECT, WHERE). Stored procedures perform actions and are called with CALL — they can't be embedded in SQL. Only procedures support transaction control (COMMIT/ROLLBACK). Functions must have a RETURNS clause and a RETURN statement.

**Q35: What is a trigger and when do you use it?**
A trigger is a stored program that fires automatically on INSERT/UPDATE/DELETE events. BEFORE triggers can modify NEW values or cancel the operation with SIGNAL. AFTER triggers can log changes or update related tables. Use for auditing, auto-timestamps, maintaining derived data.

**Q36: What does DETERMINISTIC mean for a stored function?**
DETERMINISTIC means the function always returns the same output for the same inputs — no side effects, no dependency on external state. MySQL uses this for optimization (binary logging, query caching). Mark as NOT DETERMINISTIC if the function calls NOW(), RAND(), or reads changing data.

---

## Advanced

**Q37: What is partitioning and when should you use it?**
Partitioning splits a large table into physical pieces based on a partition key (date, range, list, hash). Benefits: partition pruning (only scan relevant partitions), fast partition drops for bulk deletes/archiving. Use on tables > 50M rows with clear time/range-based access patterns.

**Q38: What is a generated column?**
A generated column is computed from an expression of other columns — either VIRTUAL (computed on read, no storage) or STORED (computed on write, stored on disk). Useful for indexing JSON fields, pre-computing expressions, or exposing derived values as regular columns.

**Q39: What is the difference between MyISAM and InnoDB?**
InnoDB: supports transactions, FK constraints, row-level locking, ACID, crash recovery. MyISAM: no transactions, table-level locking only, no FK support, faster for simple reads on non-concurrent workloads. InnoDB is the default and correct choice for almost all applications.

**Q40: What is the difference between UNION and UNION ALL?**
UNION combines results of two SELECT queries and removes duplicates (requires extra sort pass). UNION ALL includes all rows including duplicates (faster, no deduplication). Use UNION ALL unless you specifically need deduplication.

---

## Schema Design

**Q41: What is normalization?**
Normalization organizes a database to minimize redundancy and prevent anomalies. 1NF: atomic values, no repeating groups. 2NF: no partial dependencies on composite PK. 3NF: no transitive dependencies. BCNF: every determinant is a superkey.

**Q42: What are database anomalies?**
Insert anomaly: can't add data without unrelated data. Update anomaly: changing one fact requires updating many rows. Delete anomaly: deleting data unintentionally removes other facts. Normalization eliminates these by separating concerns into distinct tables.

**Q43: What is denormalization and when is it appropriate?**
Denormalization intentionally duplicates data to improve read performance (avoid joins). Appropriate for read-heavy analytics/reporting, hot query paths where joins are too slow, or when slight staleness is acceptable. Always normalize first, then selectively denormalize as a measured optimization.

---

## Miscellaneous

**Q44: What is the difference between `=` and `<=>` in MySQL?**
`=` is the standard equality — returns NULL if either side is NULL. `<=>` (NULL-safe equal) returns TRUE if both sides are NULL, FALSE if one is NULL and the other isn't. Use `<=>` when comparing nullable columns directly.

**Q45: What is COALESCE?**
COALESCE(val1, val2, ...) returns the first non-NULL value in the list. `COALESCE(middle_name, '')` returns middle_name if set, empty string otherwise. `COALESCE(preferred_name, first_name)` returns preferred name if available, falls back to first name.

**Q46: What is the difference between NOW() and CURDATE()?**
NOW() returns current datetime (2026-06-24 10:30:00). CURDATE() returns current date only (2026-06-24). CURTIME() returns current time only. Use NOW() for datetime columns, CURDATE() for date-only comparisons.

**Q47: What is IFNULL vs NULLIF?**
IFNULL(expr, fallback) returns fallback if expr is NULL, otherwise expr. NULLIF(expr1, expr2) returns NULL if expr1 = expr2, otherwise expr1 — useful for avoiding division by zero: `NULLIF(denominator, 0)`.

**Q48: What is ON DUPLICATE KEY UPDATE?**
An INSERT extension that, if the INSERT would violate a UNIQUE/PK constraint, updates the conflicting row instead. `INSERT INTO t(id, count) VALUES (1,1) ON DUPLICATE KEY UPDATE count = count + 1`. Often called "upsert".

**Q49: How does MySQL handle case sensitivity in strings?**
By default, MySQL string comparisons are case-insensitive with utf8mb4_unicode_ci collation (ci = case insensitive). To force case-sensitive comparison: `WHERE name = BINARY 'Alice'` or use a `_cs` collation. Column definitions can specify collation per column.

**Q50: What is the maximum number of columns in a MySQL table?**
The hard limit is 4096 columns, but practical limits (row format, data type sizes) typically limit to a few hundred meaningful columns. Wide tables (hundreds of columns) usually indicate poor design — normalize or use JSON for sparse attributes.
