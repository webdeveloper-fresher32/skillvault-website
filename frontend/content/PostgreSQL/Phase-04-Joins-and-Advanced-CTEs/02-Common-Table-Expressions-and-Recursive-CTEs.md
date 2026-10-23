# 02 — Common Table Expressions & Recursive CTEs

## Table of Contents
1. [What Are Common Table Expressions (CTEs)?](#1-what-are-common-table-expressions-ctes)
2. [CTE Inlining vs Materialization Fences](#2-cte-inlining-vs-materialization-fences)
3. [Understanding Recursive CTE Anatomy](#3-understanding-recursive-cte-anatomy)
4. [Use Case 1: Traversal of Organizational Reporting Trees](#4-use-case-1-traversal-of-organizational-reporting-trees)
5. [Use Case 2: Breadcrumb Path Generation](#5-use-case-2-breadcrumb-path-generation)
6. [Preventing Infinite Loops with Cycle Detection](#6-preventing-infinite-loops-with-cycle-detection)
7. [Hands-On Practice Exercises](#7-hands-on-practice-exercises)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. What Are Common Table Expressions (CTEs)?

A Common Table Expression (CTE) defines a named, temporary result set that exists only within the execution scope of a single query. Introduced via the `WITH` keyword, CTEs break monolithic nested SQL queries into clean, readable, modular blocks.

```sql
WITH regional_sales AS (
    SELECT region, SUM(amount) AS total_sales
    FROM orders
    GROUP BY region
),
top_regions AS (
    SELECT region
    FROM regional_sales
    WHERE total_sales > 100000
)
SELECT o.order_id, o.amount, o.region
FROM orders o
JOIN top_regions tr ON o.region = tr.region;
```

---

## 2. CTE Inlining vs Materialization Fences

Prior to PostgreSQL 12, CTEs acted as **optimization fences**: Postgres always evaluated and materialized the CTE into memory once, preventing the optimizer from pushing outer `WHERE` predicates down into the CTE.

In modern PostgreSQL (12+), CTEs are **automatically inlined** unless:
1. You explicitly declare `WITH cte AS MATERIALIZED (...)`
2. The CTE is referenced multiple times in the query.

```sql
-- Force Postgres to evaluate once and cache in memory (Optimization Fence)
WITH expensive_calculation AS MATERIALIZED (
    SELECT complex_aggregation(data) AS val FROM huge_log_table
)
SELECT * FROM expensive_calculation WHERE val > 50;

-- Allow Postgres optimizer to push outer predicates into the CTE
WITH active_users AS NOT MATERIALIZED (
    SELECT id, email, country FROM users WHERE status = 'active'
)
SELECT * FROM active_users WHERE country = 'DE'; -- Optimizer pushes 'DE' filter into initial scan!
```

---

## 3. Understanding Recursive CTE Anatomy

Recursive CTEs solve graph and hierarchical tree traversal problems that are impossible with standard `JOIN` statements.

### Anatomy:
```sql
WITH RECURSIVE cte_name AS (
    -- 1. Non-Recursive Base Term (Seed query)
    SELECT initial_columns FROM base_table WHERE condition

    UNION ALL

    -- 2. Recursive Term (Joins to cte_name)
    SELECT child_columns 
    FROM base_table b
    JOIN cte_name c ON b.parent_id = c.id
)
SELECT * FROM cte_name;
```

---

## 4. Use Case 1: Traversal of Organizational Reporting Trees

Scenario: Given an employee table with `manager_id`, find all subordinates (direct and indirect) reporting to the CEO (ID = 1), along with their management depth level:

```sql
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    manager_id INT REFERENCES employees(id)
);

INSERT INTO employees (id, name, manager_id) VALUES
    (1, 'Alice (CEO)', NULL),
    (2, 'Bob (VP Eng)', 1),
    (3, 'Charlie (VP Sales)', 1),
    (4, 'David (Staff Eng)', 2),
    (5, 'Eve (Senior Eng)', 4),
    (6, 'Frank (Account Exec)', 3);

-- Recursive Hierarchy Query:
WITH RECURSIVE org_chart AS (
    -- Base: Seed with the CEO (depth = 0)
    SELECT id, name, manager_id, 0 AS depth
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- Recursive: Find everyone reporting to current depth
    SELECT e.id, e.name, e.manager_id, o.depth + 1
    FROM employees e
    JOIN org_chart o ON e.manager_id = o.id
)
SELECT depth, repeat('  ', depth) || name AS employee_tree
FROM org_chart
ORDER BY depth, id;
```

### Result:
```
 depth |    employee_tree     
-------+----------------------
     0 | Alice (CEO)
     1 |   Bob (VP Eng)
     1 |   Charlie (VP Sales)
     2 |     David (Staff Eng)
     2 |     Frank (Account Exec)
     3 |       Eve (Senior Eng)
```

---

## 5. Use Case 2: Breadcrumb Path Generation

Generate an e-commerce category breadcrumb path (`Electronics > Computers > Laptops`):

```sql
CREATE TABLE categories (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT REFERENCES categories(id)
);

INSERT INTO categories VALUES 
    (1, 'Electronics', NULL),
    (2, 'Computers', 1),
    (3, 'Laptops', 2),
    (4, 'Gaming Laptops', 3);

WITH RECURSIVE category_path AS (
    SELECT id, name, parent_id, name::TEXT AS breadcrumb
    FROM categories
    WHERE parent_id IS NULL

    UNION ALL

    SELECT c.id, c.name, c.parent_id, cp.breadcrumb || ' > ' || c.name
    FROM categories c
    JOIN category_path cp ON c.parent_id = cp.id
)
SELECT id, breadcrumb FROM category_path WHERE id = 4;
-- Output: "Electronics > Computers > Laptops > Gaming Laptops"
```

---

## 6. Preventing Infinite Loops with Cycle Detection

If data contains circular references (e.g. A reports to B, B reports to A), a recursive CTE will loop infinitely until memory is exhausted!

PostgreSQL 14+ provides native **`CYCLE` clause** syntax:

```sql
WITH RECURSIVE graph_walk AS (
    SELECT from_node, to_node
    FROM edges
    WHERE from_node = 'A'

    UNION ALL

    SELECT e.from_node, e.to_node
    FROM edges e
    JOIN graph_walk gw ON e.from_node = gw.to_node
)
CYCLE to_node SET is_cycle USING path_history
SELECT * FROM graph_walk WHERE NOT is_cycle;
```

---

## 7. Hands-On Practice Exercises

1. Create a table `folders (id INT PRIMARY KEY, name TEXT, parent_folder_id INT)`.
2. Insert a 4-level deep folder structure.
3. Write a recursive CTE that computes the full absolute path (`/root/documents/work/invoices`) for any given folder ID.

---

## 8. Summary & Key Takeaways

1. CTEs provide clean, modular, and readable SQL query structures.
2. In PostgreSQL 12+, CTEs are automatically inlined for optimal query planning unless tagged as `MATERIALIZED`.
3. **Recursive CTEs** combine a non-recursive seed term with a recursive union term.
4. Recursive CTEs are the standard solution for trees, organizational hierarchies, and bill of materials.
5. Use cycle detection arrays or the native `CYCLE` clause to prevent runaway recursion.
