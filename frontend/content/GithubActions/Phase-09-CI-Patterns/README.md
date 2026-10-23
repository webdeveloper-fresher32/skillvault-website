# Phase 9: CI Patterns

## What You'll Learn

Phases 1 through 8 built the individual pieces — triggers, jobs and runners, secrets, artifacts and caching, matrices, reusable workflows, and custom actions. This phase assembles them into the shapes real CI pipelines actually take. It starts with the core pipeline every language variant follows (set up the runtime → install dependencies with caching → run tests → report a required PR status check), then splits linting and coverage out into fast, parallel jobs with an enforced quality bar, and finishes by combining Phase 2's `paths` filters with Phase 6's dynamic matrices to scope CI correctly in a monorepo — running tests only for the packages that actually changed, not the whole repository and not nothing.

## Learning Objectives

- Build a complete multi-language test pipeline: pinned runtime setup via a `setup-*` action, dependency install with caching, a test command whose exit code is trustworthy, and a required PR status check
- Separate linting and code coverage into independent, parallel jobs for fast feedback, and enforce a coverage threshold tuned to the project's actual baseline
- Scope CI in a monorepo using a change-detection step feeding a dynamic matrix, rather than a coarse workflow-level `paths` filter, and handle the "no packages changed" edge case explicitly

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Multi-Language-Test-Pipelines.md](01-Multi-Language-Test-Pipelines.md) | `setup-node`/`setup-python`/etc. with a pinned version, cached dependency install, a trustworthy test command exit code, required PR status checks | 1 day |
| [02-Linting-and-Code-Coverage.md](02-Linting-and-Code-Coverage.md) | Lint as a parallel job, coverage report generation and artifact upload, coverage-comment actions, setting a threshold tied to the project's real baseline | 1 day |
| [03-Monorepo-Path-Filtered-CI.md](03-Monorepo-Path-Filtered-CI.md) | Change-detection (`git diff`/`dorny/paths-filter`-style) feeding a dynamic matrix (Phase 6, Lesson 2) for per-package CI, vs. a coarse workflow-level `paths` filter (Phase 2, Lesson 3), handling an empty detected-package list | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 10: CD Patterns](../Phase-10-CD-Patterns/README.md)
