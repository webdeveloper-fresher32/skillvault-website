# Phase 07 — Query Optimization, EXPLAIN & Planner Internals

## Overview

A senior database engineer never optimizes blind. In this phase, you will deconstruct how the PostgreSQL Cost-Based Optimizer (CBO) transforms SQL parse trees into physical execution plans. You will master reading `EXPLAIN (ANALYZE, BUFFERS)` output, interpreting disk and memory costs, understanding planner statistics in `pg_statistic`, and applying systematic tuning patterns to eliminate slow queries.

---

## Objectives

By completing Phase 07, you will be able to:
1. Decode every component of an `EXPLAIN (ANALYZE, BUFFERS, TIMING)` plan tree.
2. Differentiate between `Sequential Scan`, `Index Scan`, `Index Only Scan`, and `Bitmap Index Scan`.
3. Calculate cost formula semantics (`startup_cost..total_cost`) based on `seq_page_cost`, `random_page_cost`, and `cpu_tuple_cost`.
4. Inspect and tune statistics collected in `pg_stats` using `default_statistics_target` and multi-column `CREATE STATISTICS`.
5. Identify and rectify common optimizer traps: misestimated row counts, bad join ordering, function evaluation blocking indexes, and disk memory spills.

---

## Lessons in This Phase

| # | Lesson | Description |
|---|--------|-------------|
| 1 | [01-Mastering-EXPLAIN-and-EXPLAIN-ANALYZE.md](./01-Mastering-EXPLAIN-and-EXPLAIN-ANALYZE.md) | Reading execution plan trees, cost models, buffer statistics, and scan varieties. |
| 2 | [02-Statistics-Collector-and-Extended-Stats.md](./02-Statistics-Collector-and-Extended-Stats.md) | How the optimizer estimates row counts, pg_stats, histograms, and multivariate statistics. |
| 3 | [03-Query-Optimization-Strategies.md](./03-Query-Optimization-Strategies.md) | Practical optimization tactics: eliminating N+1, avoiding Sargability traps, and planner hints. |

---

## Time Estimate

- **Estimated study time:** 7–9 hours.
- **Hands-on practice:** 3 hours analyzing execution plans and tuning correlated column statistics.
