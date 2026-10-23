# Phase 3: Jobs, Steps, and Runners

## What You'll Learn

Phase 1 introduced a workflow as a single job running a list of steps top to bottom. Real workflows are graphs of jobs — some running in parallel, some waiting on others — executing on machines with real differences between them, passing data between one another deliberately, and skipping or running steps based on conditions and time limits. This phase covers how to design that graph correctly, choose the right runner, move data across the job/step boundary, and control execution with `if`, `timeout-minutes`, and `continue-on-error`.

## Learning Objectives

- Design multi-job dependency graphs correctly, using `needs` to express order and understanding the default skip-on-failure propagation
- Choose appropriate runners (`runs-on`), understanding what differs between `ubuntu-latest`, `windows-latest`, and `macos-latest`
- Pass data between jobs and between steps via step outputs (`$GITHUB_OUTPUT`) and job-level `outputs:`
- Use conditional execution (`if`, `success()`, `failure()`, `always()`, `cancelled()`) and time controls (`timeout-minutes`, `continue-on-error`) safely

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Job-Dependencies-and-Needs.md](01-Job-Dependencies-and-Needs.md) | Jobs run in parallel by default, `needs` creates a dependency graph, default skip behavior when a dependency fails | 1 day |
| [02-Runners-and-Runs-On.md](02-Runners-and-Runs-On.md) | `runs-on` with GitHub-hosted runners, OS/tooling differences, `runs-on` as a label list (self-hosted preview) | 1 day |
| [03-Job-and-Step-Outputs.md](03-Job-and-Step-Outputs.md) | Step outputs via `$GITHUB_OUTPUT` and `steps.<id>.outputs.<name>`, job-level `outputs:` and `needs.<job>.outputs.<name>` | 1 day |
| [04-Conditional-Execution-and-Timeouts.md](04-Conditional-Execution-and-Timeouts.md) | `if` expressions, status-check functions, `timeout-minutes`, `continue-on-error` | 1 day |

## Estimated Time

4 days

## Next Phase

→ [Phase 4: Environment, Secrets, and Variables](../Phase-04-Environment-Secrets-and-Variables/README.md)
