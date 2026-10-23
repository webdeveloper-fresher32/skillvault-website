# Phase 04 — Joins, Subqueries & Advanced CTEs

## Overview

Querying relational data at scale requires a deep mental model of how the PostgreSQL query engine computes joins and navigates nested subqueries. In this phase, you will master physical join algorithms (Nested Loop, Hash Join, Merge Join), common table expressions (including Recursive CTEs for hierarchical tree structures), and correlated `LATERAL` joins for high-performance top-N analytics.

---

## Objectives

By completing Phase 04, you will be able to:
1. Identify the internal mechanics, memory footprints, and prerequisites of Nested Loop, Hash Join, and Merge Join algorithms.
2. Structure readable and maintainable queries using Common Table Expressions (`WITH` clauses).
3. Build **Recursive CTEs** to traverse organizational reporting hierarchies, bill of materials (BOM), and graph cycles.
4. Compare correlated subqueries with `LATERAL` joins and understand subquery flattening by the query optimizer.
5. Solve the classic "Top N records per category" query pattern using `CROSS JOIN LATERAL` and `LEFT JOIN LATERAL`.

---

## Lessons in This Phase

| # | Lesson | Description |
|---|--------|-------------|
| 1 | [01-Join-Mechanisms-and-Algorithms.md](./01-Join-Mechanisms-and-Algorithms.md) | Physical join operators (Nested Loop, Hash Join, Merge Join) and optimizer heuristics. |
| 2 | [02-Common-Table-Expressions-and-Recursive-CTEs.md](./02-Common-Table-Expressions-and-Recursive-CTEs.md) | Materialized CTEs, recursive trees, hierarchical queries, and graph cycle detection. |
| 3 | [03-Correlated-Subqueries-and-LATERAL-Joins.md](./03-Correlated-Subqueries-and-LATERAL-Joins.md) | Subquery optimization, `EXISTS` vs `IN`, and `LATERAL` joins for per-row correlated calculations. |

---

## Time Estimate

- **Estimated study time:** 7–9 hours.
- **Hands-on practice:** 3 hours constructing recursive CTE trees and tuning join execution plans.
