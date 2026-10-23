# Phase 05 — Aggregations, Analytics & Window Functions

## Overview

Advanced SQL analytics allow you to generate multi-dimensional financial reports, cohort analyses, and running calculations directly inside PostgreSQL, avoiding expensive application-side computation. In this phase, you will master multi-dimensional groupings (`GROUPING SETS`, `ROLLUP`, `CUBE`), the complete suite of analytical Window Functions with frame specifications, and ordered-set statistical aggregates (medians, percentiles).

---

## Objectives

By completing Phase 05, you will be able to:
1. Construct multi-dimensional aggregates in a single query pass using `GROUPING SETS`, `ROLLUP`, and `CUBE`.
2. Master the `OVER (PARTITION BY ... ORDER BY ...)` syntax across ranking, offset, and aggregate functions.
3. Define granular window frames using `ROWS BETWEEN` and `RANGE BETWEEN` specifications.
4. Calculate moving averages, cumulative year-to-date running totals, and week-over-week growth metrics.
5. Utilize ordered-set aggregates (`percentile_cont`, `mode()`) and aggregate filter clauses (`FILTER (WHERE ...)`).

---

## Lessons in This Phase

| # | Lesson | Description |
|---|--------|-------------|
| 1 | [01-Group-By-Rollup-Cube-Grouping-Sets.md](./01-Group-By-Rollup-Cube-Grouping-Sets.md) | Multi-level rollups, dimensional cross-tabulation with CUBE, and GROUPING SETS. |
| 2 | [02-Window-Functions-Mastery.md](./02-Window-Functions-Mastery.md) | ROW_NUMBER, RANK, DENSE_RANK, NTILE, LAG, LEAD, and window frame bounding. |
| 3 | [03-Ordered-Set-and-Statistical-Aggregates.md](./03-Ordered-Set-and-Statistical-Aggregates.md) | Continuous percentiles, mode, medians, and selective aggregation with FILTER. |

---

## Time Estimate

- **Estimated study time:** 6–8 hours.
- **Hands-on practice:** 2.5 hours building analytical financial models and running window frames.
