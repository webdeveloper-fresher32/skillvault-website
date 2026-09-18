# Phase 5 — SQL JOINs

JOINs are the single most important skill in relational SQL.
Every non-trivial query in production will involve joining tables.
Master this phase and 80% of real interview problems become tractable.

## What This Phase Covers

```
Phase-05-Joins/
├── 01-INNER-JOIN.md          — The foundation: matching rows from two tables
├── 02-LEFT-RIGHT-JOIN.md     — Preserving unmatched rows, anti-join patterns
└── 03-FULL-OUTER-CROSS-SELF-JOIN.md — Advanced join types, CROSS, SELF, performance
```

## Why JOINs Matter

Relational databases split data into multiple normalised tables to avoid
duplication. A `customers` table holds customer info. An `orders` table holds
order info. Neither table is useful alone — you need JOIN to answer questions
like "which customers spent over $1000 last month?"

## Quick Reference

| JOIN Type    | Rows returned                                      |
|--------------|----------------------------------------------------|
| INNER JOIN   | Only rows that match on both sides                 |
| LEFT JOIN    | All left rows + matched right rows (NULL if none)  |
| RIGHT JOIN   | All right rows + matched left rows (NULL if none)  |
| FULL OUTER   | All rows from both sides (MySQL: UNION workaround) |
| CROSS JOIN   | Every left row paired with every right row         |
| SELF JOIN    | A table joined to itself                           |

## Recommended Study Order

1. Read `01-INNER-JOIN.md` — understand the ON clause and Venn diagram
2. Read `02-LEFT-RIGHT-JOIN.md` — master the anti-join pattern (IS NULL trick)
3. Read `03-FULL-OUTER-CROSS-SELF-JOIN.md` — complete the toolkit + performance

## Prerequisites

- Phase 01: SELECT, WHERE, ORDER BY
- Phase 02: GROUP BY, HAVING, aggregate functions
- Phase 03: Subqueries (helpful context for JOIN vs subquery section)
