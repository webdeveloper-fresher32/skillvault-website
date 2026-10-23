# Phase 2: Triggers and Events

## What You'll Learn

Go deep on everything `on` can express: the two everyday code-change triggers (`push`, `pull_request`) and the security nuance of `pull_request_target`, the time-based and human/machine-initiated triggers (`schedule`, `workflow_dispatch`, `repository_dispatch`), and the branch/path/tag filters that narrow any of these down to the changes that actually matter.

## Learning Objectives

- Choose the right event trigger for a given scenario, and explain how a `push` run and a `pull_request` run differ for the same underlying commit
- Understand the security nuances of `pull_request_target` — why it defaults to checking out the base branch, and how combining it with an untrusted checkout becomes a foot-gun
- Use `branches`, `paths`, and `tags` filters correctly, including why a `paths`-filtered job can strand a required status check in branch protection

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Push-and-Pull-Request-Triggers.md](01-Push-and-Pull-Request-Triggers.md) | `on: push` vs. `on: pull_request`, PR activity types, `pull_request_target` and its security model | 1 day |
| [02-Schedule-and-Manual-Triggers.md](02-Schedule-and-Manual-Triggers.md) | `on: schedule` (cron, UTC, best-effort timing), `on: workflow_dispatch` (typed inputs), `on: repository_dispatch` (external/API triggers) | 1 day |
| [03-Event-Filters-Branches-Paths-Tags.md](03-Event-Filters-Branches-Paths-Tags.md) | `branches`/`branches-ignore`, `paths`/`paths-ignore`, `tags`/`tags-ignore`, glob syntax, and the required-status-check gotcha | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 3: Jobs, Steps, and Runners](../Phase-03-Jobs-Steps-and-Runners/README.md)
