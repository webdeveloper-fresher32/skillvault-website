# Phase 7: Query Processing and Optimization

## What You'll Learn

How a SQL statement becomes an operator tree the engine actually runs, how the optimizer uses statistics to choose between candidate plans, and how to read any execution plan well enough to name what is wrong with it.

## Learning Objectives

- Trace one statement through parsing, binding, rewriting, planning, and execution, and explain why identical SQL can compile to a different plan on a different day.
- Estimate selectivity by hand from row counts, distinct values, null fractions, and histograms, and explain where the independence assumption breaks on correlated columns.
- Choose between nested loop, hash, and sort-merge joins from each one's prerequisites, and explain why wide join orders defeat exhaustive search.
- Read an execution plan innermost-first, compare estimated against actual rows, and recognise the six pathologies that account for most slow queries.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Parse-Plan-Execute.md](01-Parse-Plan-Execute.md) | parser, binder, rewriter, planner, executor; the operator tree; the Volcano iterator model; why the same SQL gets different plans | 1 day |
| [02-Cost-Based-Optimization-and-Statistics.md](02-Cost-Based-Optimization-and-Statistics.md) | cardinality estimation; `n_distinct`, null fractions, equi-width vs equi-depth histograms; selectivity and the independence assumption; stale statistics | 1 day |
| [03-Join-Algorithms.md](03-Join-Algorithms.md) | nested loop, hash join build and probe, sort-merge; spilling to disk; join order, left-deep trees, and the search cutoff | 1 day |
| [04-Reading-an-Execution-Plan.md](04-Reading-an-Execution-Plan.md) | operators, estimated vs actual rows, loops, cost units; six plan pathologies and their fixes; a checklist for any slow query | 1 day |

## Estimated Time

4 days

## Next Phase

→ [Phase 8: Transactions and Concurrency](../../../../04-SYSTEMS-INFRASTRUCTURE/04-Developer-Tools/Git/Phase-01-Git-Core-Architecture-and-Plumbing/README.md)
