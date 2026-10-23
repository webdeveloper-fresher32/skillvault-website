# Phase 6: Matrix Builds and Strategy

## What You'll Learn

A single job definition can be expensive to duplicate by hand every time it needs to run against a slightly different OS, runtime version, or dependency version — and hand-duplicated jobs drift out of sync the moment one copy gets edited and the others don't. This phase covers `strategy.matrix`, GitHub Actions' mechanism for fanning one job definition out into many parallel runs automatically, plus the finer controls — `include`, `exclude`, dynamically generated matrices, `fail-fast`, and `max-parallel` — that shape which combinations actually run, how many run at once, and what happens when one of them fails.

## Learning Objectives

- Design matrix strategies that scale sensibly, understanding that dimensions multiply rather than add
- Use `include`/`exclude` and dynamic matrices correctly, including the subtle rules for when an `include` entry merges into an existing combination versus creating a new standalone one
- Tune `fail-fast` and `max-parallel` for the situation — exploratory matrices that need every result versus matrices that should stop the moment one combination fails

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Matrix-Strategy-Basics.md](01-Matrix-Strategy-Basics.md) | `strategy.matrix` fan-out, `${{ matrix.<key> }}` substitution, combinatorial multiplication of dimensions | 1 day |
| [02-Include-Exclude-and-Dynamic-Matrices.md](02-Include-Exclude-and-Dynamic-Matrices.md) | `matrix.include` and `matrix.exclude`, merge-vs-new-combination rules, dynamic matrices from a prior job's output via `fromJSON()` | 1 day |
| [03-Fail-Fast-and-Max-Parallel.md](03-Fail-Fast-and-Max-Parallel.md) | `strategy.fail-fast` (default and override), `strategy.max-parallel` for capping concurrency | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 7: Reusable Workflows and Composite Actions](../Phase-07-Reusable-Workflows-and-Composite-Actions/README.md)
