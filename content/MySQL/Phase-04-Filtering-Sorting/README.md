# Phase 4 — Filtering & Sorting

> Master the art of slicing, dicing, and ordering result sets with surgical precision.

---

## What This Phase Covers

```
Phase-04-Filtering-Sorting/
├── 01-WHERE-Operators.md      — Comparison, BETWEEN, IN, LIKE, REGEXP, NULL handling
├── 02-ORDER-BY.md             — Sorting, custom sequences, pagination, EXPLAIN hints
└── 03-GROUP-BY-HAVING.md      — Aggregation, HAVING vs WHERE, ROLLUP, pivot patterns
```

---

## Why Filtering & Sorting Matter

Every real-world query filters. You never want *all* rows from a production table
with millions of records. Mastering WHERE, ORDER BY, GROUP BY, and HAVING is the
difference between a query that runs in milliseconds and one that brings a server
to its knees.

```
┌─────────────────────────────────────────────────────────────┐
│              MySQL Query Execution Order                     │
│                                                             │
│  FROM  →  JOIN  →  WHERE  →  GROUP BY  →  HAVING           │
│        →  SELECT  →  DISTINCT  →  ORDER BY  →  LIMIT       │
└─────────────────────────────────────────────────────────────┘
```

Understanding execution order explains *why* you cannot use a SELECT alias in
a WHERE clause (alias does not yet exist at WHERE time) but *can* use it in
ORDER BY (alias is resolved by then).

---

## Files in This Phase

| File | Topic | Key Concepts |
|------|-------|-------------|
| 01-WHERE-Operators.md | Row filtering | =, !=, BETWEEN, IN, LIKE, REGEXP, NULL |
| 02-ORDER-BY.md | Result ordering | ASC/DESC, multi-col, expressions, pagination |
| 03-GROUP-BY-HAVING.md | Aggregation & group filtering | COUNT, SUM, AVG, HAVING, ROLLUP |

---

## Prerequisites

- Phase 1 (SQL Fundamentals) — SELECT basics
- Phase 2 (DDL) — understanding table structure
- Phase 3 (DML / CRUD) — INSERT, UPDATE, DELETE context

---

## Key Takeaways

1. **WHERE filters rows before aggregation; HAVING filters groups after.**
2. **NULL is not a value — comparisons with NULL always return NULL (unknown), not TRUE or FALSE.**
3. **NOT IN with a NULL in the list always returns empty — a classic trap.**
4. **ORDER BY column alias is allowed in MySQL because alias resolves before ORDER BY.**
5. **EXPLAIN output reveals whether MySQL uses a filesort or an index — critical for performance.**
