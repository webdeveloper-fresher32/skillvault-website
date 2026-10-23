# Phase 7: Subqueries & CTEs

## Overview

Phase 7 covers two of the most powerful query-composition tools in MySQL: **subqueries** and **Common Table Expressions (CTEs)**. By the end of this phase you will be able to break complex problems into readable, modular SQL and understand the performance implications of each approach.

---

## Table of Contents

1. [What This Phase Covers](#what-this-phase-covers)
2. [File Index](#file-index)
3. [Prerequisites](#prerequisites)
4. [Learning Objectives](#learning-objectives)
5. [Phase Roadmap](#phase-roadmap)
6. [Quick Reference](#quick-reference)

---

## What This Phase Covers

```
Phase 7
├── 01-Subqueries.md
│   ├── Scalar subqueries
│   ├── Row subqueries
│   ├── Table / derived-table subqueries
│   ├── Correlated vs non-correlated
│   ├── EXISTS / NOT EXISTS
│   ├── NOT IN NULL trap
│   ├── ANY / ALL
│   └── Subquery vs JOIN performance
└── 02-CTEs.md
    ├── Basic WITH syntax
    ├── Multiple CTEs
    ├── CTE vs derived table vs temp table
    ├── Recursive CTEs
    ├── Employee hierarchy
    ├── Number series & date calendar
    ├── Bill-of-materials
    └── MySQL 8.0 materialization notes
```

---

## File Index

| File | Topic | Lines |
|------|-------|-------|
| `01-Subqueries.md` | All subquery forms, EXISTS, ANY/ALL, performance | 400+ |
| `02-CTEs.md` | WITH syntax, recursive CTEs, real-world patterns | 400+ |

---

## Prerequisites

- Phase 1-6 completed (SELECT, JOINs, aggregation, window functions)
- MySQL 8.0+ installed and accessible
- Familiarity with GROUP BY, HAVING, and aggregate functions

---

## Learning Objectives

After completing this phase you will be able to:

1. Write scalar, row, and table subqueries correctly
2. Distinguish correlated from non-correlated subqueries and reason about their performance
3. Avoid the NOT IN NULL trap by using NOT EXISTS
4. Use CTEs to make multi-step queries readable and maintainable
5. Write recursive CTEs to traverse hierarchies and generate series
6. Choose between subqueries, CTEs, derived tables, and temp tables based on context

---

## Phase Roadmap

```
┌─────────────────────────────────────────────────────────────┐
│                        PHASE 7 FLOW                         │
├─────────────────┬───────────────────────────────────────────┤
│  Subqueries     │  WHERE clause embeds a full SELECT        │
│  (File 01)      │  FROM clause wraps SELECT as a table      │
│                 │  SELECT list returns a single value       │
├─────────────────┼───────────────────────────────────────────┤
│  CTEs           │  Named result sets at the top of a query  │
│  (File 02)      │  Can reference each other in sequence     │
│                 │  Recursive form enables hierarchy walks   │
└─────────────────┴───────────────────────────────────────────┘
```

---

## Quick Reference

```sql
-- Scalar subquery in SELECT list
SELECT name, (SELECT AVG(salary) FROM employees) AS company_avg
FROM employees;

-- Correlated subquery with EXISTS
SELECT name FROM departments d
WHERE EXISTS (
    SELECT 1 FROM employees e WHERE e.dept_id = d.id
);

-- Basic CTE
WITH dept_totals AS (
    SELECT dept_id, SUM(salary) AS total
    FROM employees
    GROUP BY dept_id
)
SELECT d.name, dt.total
FROM departments d
JOIN dept_totals dt ON d.id = dt.dept_id;

-- Recursive CTE (org hierarchy)
WITH RECURSIVE org AS (
    SELECT id, name, manager_id, 0 AS depth
    FROM employees WHERE manager_id IS NULL
    UNION ALL
    SELECT e.id, e.name, e.manager_id, org.depth + 1
    FROM employees e
    JOIN org ON e.manager_id = org.id
)
SELECT * FROM org;
```
