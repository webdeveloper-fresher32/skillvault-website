# MySQL SQL Cheatsheet — All Syntax in One Place

---

## DDL — Database Definition

```sql
-- Database
CREATE DATABASE mydb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP DATABASE IF EXISTS mydb;
USE mydb;

-- Table
CREATE TABLE users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(200) UNIQUE NOT NULL,
  name       VARCHAR(100),
  role       ENUM('admin','user') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

-- Modify table
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users MODIFY COLUMN phone VARCHAR(30) NOT NULL;
ALTER TABLE users DROP COLUMN phone;
ALTER TABLE users RENAME COLUMN email TO email_address;
RENAME TABLE users TO app_users;
DROP TABLE IF EXISTS users;
TRUNCATE TABLE users;   -- delete all rows, reset AUTO_INCREMENT
```

---

## DML — Data Manipulation

```sql
-- INSERT
INSERT INTO users (email, name) VALUES ('a@x.com', 'Alice');
INSERT INTO users (email, name) VALUES ('a@x.com', 'Alice'),('b@x.com','Bob');
INSERT IGNORE INTO users (email, name) VALUES ('a@x.com', 'Alice');  -- skip on dup
INSERT INTO users (email, name)
  VALUES ('a@x.com', 'Alice')
  ON DUPLICATE KEY UPDATE name = VALUES(name);

-- SELECT
SELECT * FROM users;
SELECT id, name FROM users WHERE role = 'admin' ORDER BY name LIMIT 10;
SELECT DISTINCT role FROM users;
SELECT COUNT(*), role FROM users GROUP BY role HAVING COUNT(*) > 5;

-- UPDATE
UPDATE users SET role = 'admin' WHERE id = 1;
UPDATE users u JOIN orders o ON u.id = o.user_id SET u.last_order = o.created_at;

-- DELETE
DELETE FROM users WHERE deleted_at IS NOT NULL;
DELETE u FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE o.id IS NULL;
```

---

## WHERE Operators

```sql
-- Comparison
WHERE age > 18
WHERE name = 'Alice'
WHERE salary BETWEEN 50000 AND 100000
WHERE name IN ('Alice', 'Bob', 'Carol')
WHERE email LIKE '%@gmail.com'
WHERE phone IS NULL
WHERE phone IS NOT NULL

-- Logical
WHERE age > 18 AND role = 'user'
WHERE role = 'admin' OR role = 'manager'
WHERE NOT deleted_at IS NULL

-- Pattern matching
WHERE name LIKE 'A%'          -- starts with A
WHERE name LIKE '%son'        -- ends with son
WHERE name LIKE '%ali%'       -- contains ali
WHERE name REGEXP '^[A-Z]'    -- regex
```

---

## JOINs

```sql
-- INNER JOIN
SELECT o.id, c.name FROM orders o INNER JOIN customers c ON o.customer_id = c.id;

-- LEFT JOIN (all left rows, NULLs for unmatched right)
SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON c.id = o.customer_id;

-- RIGHT JOIN
SELECT c.name, o.id FROM orders o RIGHT JOIN customers c ON o.customer_id = c.id;

-- FULL OUTER (MySQL: emulate with UNION)
SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON c.id = o.customer_id
UNION
SELECT c.name, o.id FROM customers c RIGHT JOIN orders o ON c.id = o.customer_id;

-- CROSS JOIN (cartesian product)
SELECT s.size, c.color FROM sizes s CROSS JOIN colors c;

-- SELF JOIN
SELECT e.name AS employee, m.name AS manager
FROM employees e JOIN employees m ON e.manager_id = m.id;
```

---

## Aggregate Functions

```sql
SELECT COUNT(*)                 -- count all rows
SELECT COUNT(DISTINCT dept_id)  -- count distinct values
SELECT SUM(salary)
SELECT AVG(salary)
SELECT MIN(salary), MAX(salary)
SELECT GROUP_CONCAT(name ORDER BY name SEPARATOR ', ')  -- concatenate group values

-- GROUP BY + HAVING
SELECT dept_id, AVG(salary) AS avg_sal
FROM employees
GROUP BY dept_id
HAVING avg_sal > 60000;
```

---

## Window Functions

```sql
-- Ranking
SELECT name, salary,
  ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS rn,
  RANK()       OVER (PARTITION BY dept ORDER BY salary DESC) AS rnk,
  DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS dns_rnk,
  NTILE(4)     OVER (ORDER BY salary DESC) AS quartile
FROM employees;

-- Offset
SELECT name, salary,
  LAG(salary)  OVER (ORDER BY hire_date) AS prev_salary,
  LEAD(salary) OVER (ORDER BY hire_date) AS next_salary
FROM employees;

-- Aggregate window
SELECT name, salary,
  SUM(salary) OVER (PARTITION BY dept) AS dept_total,
  AVG(salary) OVER ()                  AS company_avg
FROM employees;

-- Running total
SELECT order_date, total,
  SUM(total) OVER (ORDER BY order_date ROWS UNBOUNDED PRECEDING) AS running_total
FROM orders;

-- Top N per group
SELECT * FROM (
  SELECT *, RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS rnk
  FROM employees
) ranked WHERE rnk <= 3;
```

---

## Subqueries

```sql
-- Scalar
SELECT name, (SELECT MAX(salary) FROM employees) AS max_sal FROM employees;

-- IN subquery
SELECT * FROM employees WHERE dept_id IN (SELECT id FROM departments WHERE region='APAC');

-- EXISTS
SELECT * FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);

-- Correlated subquery
SELECT name, salary FROM employees e
WHERE salary > (SELECT AVG(salary) FROM employees WHERE dept_id = e.dept_id);
```

---

## CTEs

```sql
-- Basic CTE
WITH active_users AS (
  SELECT * FROM users WHERE deleted_at IS NULL
)
SELECT * FROM active_users WHERE role = 'admin';

-- Multiple CTEs
WITH
  sales_2026 AS (SELECT * FROM orders WHERE YEAR(created_at) = 2026),
  by_customer AS (SELECT customer_id, SUM(total) AS revenue FROM sales_2026 GROUP BY customer_id)
SELECT c.name, bc.revenue FROM customers c JOIN by_customer bc ON c.id = bc.customer_id;

-- Recursive CTE
WITH RECURSIVE org_chart AS (
  SELECT id, name, manager_id, 0 AS level FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.name, e.manager_id, oc.level + 1
  FROM employees e JOIN org_chart oc ON e.manager_id = oc.id
)
SELECT * FROM org_chart ORDER BY level, name;
```

---

## Indexes

```sql
CREATE INDEX idx_email ON users(email);
CREATE UNIQUE INDEX idx_email ON users(email);
CREATE INDEX idx_composite ON orders(customer_id, status);
CREATE FULLTEXT INDEX idx_ft ON articles(title, body);
DROP INDEX idx_email ON users;
SHOW INDEX FROM users;
```

---

## Transactions

```sql
START TRANSACTION;
  UPDATE accounts SET balance = balance - 100 WHERE id = 'alice';
  UPDATE accounts SET balance = balance + 100 WHERE id = 'bob';
COMMIT;      -- save

ROLLBACK;    -- undo

SAVEPOINT sp1;
ROLLBACK TO SAVEPOINT sp1;
RELEASE SAVEPOINT sp1;

SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT @@transaction_isolation;
```

---

## Stored Procedures & Functions

```sql
-- Procedure
DELIMITER $$
CREATE PROCEDURE transfer(IN from_id INT, IN to_id INT, IN amount DECIMAL(10,2))
BEGIN
  UPDATE accounts SET balance = balance - amount WHERE id = from_id;
  UPDATE accounts SET balance = balance + amount WHERE id = to_id;
END$$
DELIMITER ;
CALL transfer(1, 2, 100.00);

-- Function
DELIMITER $$
CREATE FUNCTION full_name(first VARCHAR(50), last VARCHAR(50))
RETURNS VARCHAR(101) DETERMINISTIC
BEGIN
  RETURN CONCAT(first, ' ', last);
END$$
DELIMITER ;
SELECT full_name(first_name, last_name) FROM employees;
```

---

## EXPLAIN Quick Reference

```
type column (best → worst):
  const → eq_ref → ref → range → index → ALL

Extra column:
  Using index     ✅ covering index (no table lookup)
  Using filesort  ⚠️ add index for ORDER BY
  Using temporary ⚠️ refactor GROUP BY / add index
  Using where     ✅ normal filter
```

---

## Useful System Queries

```sql
SHOW DATABASES;
SHOW TABLES;
DESCRIBE users;
SHOW CREATE TABLE users\G
SHOW INDEX FROM users;
SHOW PROCESSLIST;
SHOW VARIABLES LIKE 'max_connections';
SELECT DATABASE();
SELECT USER();
SELECT VERSION();
```
