# Phase 13: Production Best Practices and Interview Prep

## What You'll Learn

This is the final phase of the course, and it shifts from building new capabilities to operating and communicating about the ones already built across Phases 1–12. It covers how to actually debug a workflow run when it fails — reading logs well, enabling GitHub's built-in debug logging, and knowing when (and when not) to reach for a live-shell debugging action — followed by the cost and concurrency levers that keep a busy repository's CI/CD bill under control: `concurrency` groups with `cancel-in-progress`, layered on top of the caching and trigger-scoping levers from earlier phases. It closes with a capstone on how these concepts actually get asked about in interviews, and a repeatable framework for structuring a strong answer to an open-ended "design a pipeline" question — one that volunteers security and cost reasoning instead of waiting to be asked.

## Learning Objectives

- Debug failed workflow runs efficiently: read run logs and timing information first, enable `ACTIONS_STEP_DEBUG`/`ACTIONS_RUNNER_DEBUG` for deeper diagnostics, choose correctly between re-running and pushing a fix, and understand the security trade-off of live-shell debugging actions
- Apply cost and concurrency optimizations: understand GitHub Actions billing basics for hosted vs. self-hosted runners, and use `concurrency` groups with `cancel-in-progress` alongside caching and scoped triggers to avoid wasting minutes on superseded runs
- Structure a strong answer to a GitHub Actions system-design-style interview question: clarify the app and deploy target, sketch triggers and jobs, proactively address security and cost, and handle common depth-probes

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Debugging-Failed-Workflow-Runs.md](01-Debugging-Failed-Workflow-Runs.md) | Reading workflow logs and timing info, enabling `ACTIONS_STEP_DEBUG`/`ACTIONS_RUNNER_DEBUG` debug logging, re-running all jobs vs. only failed jobs (and why that doesn't fix a real code/config bug), live-shell debugging actions and their security caveat | 1 day |
| [02-Cost-Optimization-and-Concurrency.md](02-Cost-Optimization-and-Concurrency.md) | GitHub Actions billing basics for hosted vs. self-hosted runners, `concurrency` groups with `cancel-in-progress` to cancel superseded runs, combining concurrency with caching (Phase 5) and scoped triggers (Phase 2) as cost levers | 1 day |
| [03-Interview-Strategy-Capstone.md](03-Interview-Strategy-Capstone.md) | How GitHub Actions concepts get probed in interviews, a framework for structuring a scenario-based design answer (clarify → sketch → security/cost → YAML), common depth-probes, a fully worked "test, build, deploy-with-approval" example citing prior phases | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Projects](../Projects/README.md)
