# Phase 7: Reusable Workflows and Composite Actions

## What You'll Learn

Every workflow built through Phase 6 lives entirely inside one file — even the matrix-driven jobs from Phase 6 still only exist in the one workflow that defines them, and any secret they use (Phase 4) is wired up locally, in that same file. The moment a second workflow, or a second repository, needs the same job or the same handful of steps, the only option so far is copy-paste — which drifts out of sync the instant one copy gets fixed and the others don't. This phase covers GitHub Actions' two mechanisms for sharing workflow logic instead of duplicating it: reusable workflows, invoked via `on: workflow_call`, which share an entire job's (or multiple jobs') structure — including its own `runs-on`, its own `strategy.matrix`, and a first-class secrets contract — across workflows and repositories; and composite actions, defined with `runs.using: composite`, which bundle a handful of steps into one reusable unit consumed inside an existing job, with no new job boundary at all.

## Learning Objectives

- Build and consume reusable workflows with typed `inputs`, `secrets`, and `outputs`, understanding exactly when secrets do and don't flow from caller to callee
- Build and consume composite actions, understanding that they run inside the calling job's own runner and have no distinct secrets mechanism of their own
- Choose the right reuse mechanism for a given situation, based on whether the duplicated logic is a few steps within a job or an entire job's (or multi-job) structure

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Reusable-Workflows-with-Workflow-Call.md](01-Reusable-Workflows-with-Workflow-Call.md) | `on: workflow_call`, typed `inputs`/`secrets`/`outputs`, invoking via `uses: ./.github/workflows/callee.yml`, `secrets: inherit` vs. explicit `secrets:`, nesting limits | 1-2 days |
| [02-Composite-Actions.md](02-Composite-Actions.md) | `action.yml` with `runs.using: composite`, `inputs` and `${{ inputs.name }}`, steps running in the calling job's context, no separate `secrets:` mechanism | 1-2 days |
| [03-Choosing-Reusable-Workflow-vs-Composite-Action.md](03-Choosing-Reusable-Workflow-vs-Composite-Action.md) | Decision criteria between the two mechanisms, side-by-side comparison of the same logic implemented both ways | 1-2 days |

## Estimated Time

4 days

## Next Phase

→ [Phase 8: Custom Actions Development](../Phase-08-Custom-Actions-Development/README.md)
