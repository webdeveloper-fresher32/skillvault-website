# Conditional Execution and Timeouts

Lesson 1 of this phase introduced one specific conditional case: a downstream job's implicit condition is `success()`, which is why it's skipped by default when a `needs` dependency fails. But `if` isn't limited to job-dependency outcomes — it's a general expression evaluated at both the job level and the step level, testing anything the workflow's context exposes: the triggering event name, a branch name, an input value, a previous step's output. This lesson covers the general mechanics of `if`, plus `timeout-minutes` and `continue-on-error`.

## 1. `if` Conditions and Expression Syntax

`if` can be attached at the job level or the step level, and in both cases GitHub evaluates it as a GitHub Actions expression (the same `${{ }}`-style expressions used elsewhere, though the leading `${{ }}` wrapper is optional and conventionally omitted for a plain `if:` line).

```yaml
- name: Push-only deployment step
  if: github.event_name == 'push'
  run: echo "This only runs for push events, and only if prior steps succeeded"
```

A job or step with no `if` at all has an implicit condition of `success()` — "run only if everything that had to succeed before this point actually did." Critically, **a step's `if` that does not call one of the status-check functions still has that implicit `success()` ANDed in.** Writing `if: github.event_name == 'push'` does not mean "run only when this is a push event, regardless of prior failures" — it actually means "run only when this is a push event **and** every previous step in this job so far succeeded." This produces a specific, common bug: a cleanup/notification step meant to run "no matter what happens," gated on an unrelated condition like a branch name, silently doesn't fire after an earlier step fails, because the condition is AND-ed with an implicit `success()` never intended.

## 2. Default Status Functions (`success()`/`failure()`/`always()`/`cancelled()`)

Four status-check functions let you take explicit control of the implicit layer:

| Function | True when |
|---|---|
| `success()` (default, rarely written explicitly) | Everything before this point succeeded |
| `failure()` | A previous step/dependency failed |
| `always()` | Unconditionally — runs even after failure or cancellation |
| `cancelled()` | The workflow run was cancelled (e.g., by a user or a concurrency-group supersession) |

Combining a status function with another condition is how you get "always run, but only for this branch":

```yaml
if: always() && github.ref == 'refs/heads/main'
```

`always()` neutralizes the implicit success requirement, and the `&&` clause adds back a specific, deliberate condition. Note `cancelled()` is not interchangeable with `failure()` — `cancelled()` is true only when the run itself was cancelled, not when a step simply exited with a failing status; a cleanup step meant to catch both a failure and a cancellation needs `always()`, not `cancelled()` alone.

## 3. `timeout-minutes`

`timeout-minutes` sets a hard ceiling on how long a job (or an individual step) is allowed to run, at either the job level (default ceiling for the whole job, commonly 360 minutes on GitHub-hosted runners if unset) or the step level (bounding just that one step). Exceeding it causes GitHub to cancel the run/step and mark it as failed due to timeout — independent of whether the underlying command would have eventually finished.

```yaml
build-and-notify:
  runs-on: ubuntu-latest
  timeout-minutes: 10        # job-level ceiling
  steps:
    - name: Run build
      timeout-minutes: 5     # step-level ceiling, nested inside the job's budget
      run: echo "Building..."
```

A job-level `timeout-minutes` alone does not protect against one runaway step consuming the entire job's budget — a step-level `timeout-minutes` is what bounds an individual step specifically.

## 4. `continue-on-error`

`continue-on-error: true` on a step lets that step fail without failing the job. GitHub still records the step's own outcome as failed, but the job's overall conclusion is computed as if that step had succeeded — later steps in the job still run under the normal implicit `success()` rule, and the job itself is reported as a pass. This means a required status check gated on that job will show green even though a step inside it genuinely failed, potentially hiding a real regression from branch protection or a merge gate.

```yaml
- name: Flaky integration check
  continue-on-error: true
  run: ./run-flaky-check.sh
```

## Full Example

```yaml
name: Conditional Steps and Timeouts

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  build-and-notify:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Run build
        timeout-minutes: 5
        run: echo "Building..."

      - name: Push-only deployment step
        if: github.event_name == 'push'
        run: echo "This only runs for push events, and only if prior steps succeeded"

      - name: Cleanup step that must always run
        if: always()
        run: echo "Cleaning up temporary resources, regardless of success or failure above"
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < conditional.yml
```

The job has a 10-minute ceiling, and `Run build` has its own tighter 5-minute ceiling nested inside that budget. `Push-only deployment step` only fires for `push` events — and, having no status function in its condition, it also implicitly requires every step before it to have succeeded; if `Run build` fails, this step is skipped even on a push event. `Cleanup step` uses `if: always()` specifically so it still runs even if `Run build` failed or the earlier step was skipped — the only step here guaranteed to execute no matter what happened above it.

## Comparison

| Comparison | Detail |
|---|---|
| `if: <condition>` vs. `if: success() && <condition>` | Functionally identical — every plain condition already carries an implicit `success()` |
| `always()` vs. `failure()` | `always()` runs unconditionally, including on full success (cleanup). `failure()` runs only when something upstream broke (alerting/rollback) |
| `timeout-minutes` vs. `continue-on-error` | `timeout-minutes` bounds *how long* something may run before being forcibly stopped and marked failed. `continue-on-error` controls whether a step's failure (from any cause, timeout included) is allowed to fail the enclosing job |
| vs. Phase 3, Lesson 1's `needs`-based skip | Same implicit-`success()` mechanism, there scoped to a job's relationship with `needs` dependencies; here generalized to step-to-step sequencing within a single job |

## Common Mistakes

- **Forgetting that a step's `if` without an explicit status function implicitly means `success()`** — writing `if: github.event_name == 'push'` and expecting it to run "regardless of what happened before," when a prior step's failure will silently skip it too; this is the most common surprise for anyone expecting a step to run "always" without actually writing `always()`.
- **Setting `continue-on-error: true` without realizing the job as a whole still reports success** — a required status check gated on that job will show green even though a step inside it genuinely failed, potentially hiding a real regression from branch protection or a merge gate.
- **Using `always()` on a step that assumes earlier steps' outputs or artifacts exist** — since `always()` removes the implicit success gate, the step may now run in situations where the data it depends on (a build artifact, a step output) was never produced, causing a different, more confusing failure than the one it was meant to handle gracefully.
- **Setting only a job-level `timeout-minutes` and assuming it protects against one runaway step** — a single hung step can still consume the entire job-level budget; a step-level `timeout-minutes` is what bounds an individual step specifically.
- **Confusing `cancelled()` with `failure()`** — `cancelled()` is true only when the run itself was cancelled (by a user, or by a newer run superseding it under `concurrency`), not when a step simply exited with a failing status; a cleanup step meant to catch both needs `always()`, not `cancelled()` alone.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Build the full example above, push it via a `push` trigger, and confirm all four steps run in order, with `Push-only deployment step` firing because the event is a push.
2. **(Requires a GitHub repo)** Change `Run build`'s command to `exit 1` (forcing a failure) and re-push. Confirm `Push-only deployment step` is skipped (implicit `success()` fails) while `Cleanup step` still runs (`if: always()`).
3. **(Requires a GitHub repo)** Add `timeout-minutes: 1` to a step whose `run:` command sleeps for 2 minutes (`run: sleep 120`). Confirm GitHub cancels and fails that step at the 1-minute mark rather than waiting for it to finish.
4. **(Requires a GitHub repo)** Add `continue-on-error: true` to a step that runs `exit 1`, followed by a later step with no special condition. Confirm the failing step is recorded as failed individually, the later step still runs, and the job's overall conclusion is reported as success.
5. **(Paper exercise, no execution needed)** Given a step with `if: always() && github.ref == 'refs/heads/main'`, state in one sentence what has to be true for the step to run, and contrast it with the same step written as `if: github.ref == 'refs/heads/main'` (no `always()`).

## Interview Q&A

**Q: You add a step meant to always send a Slack notification, with `if: github.ref == 'refs/heads/main'`. It doesn't fire when an earlier step fails. Why?**
A: Every plain `if` condition has an implicit `success()` ANDed into it; the fix is `if: always() && github.ref == 'refs/heads/main'`.

**Q: A step is flaky and someone adds `continue-on-error: true` to unblock the team. What's the risk?**
A: The job (and any required status check depending on it) now reports success even when that step is actually failing every time, silently masking a real, possibly worsening problem instead of surfacing it.

**Q: What's the difference between `cancelled()` and `failure()`?**
A: `cancelled()` is true only when the workflow run itself was cancelled; `failure()` is true when a step or dependency exited with a failing status. A cleanup step meant to catch both needs `always()`.

**Q: A job has `timeout-minutes: 10`, but one step inside it hangs and consumes the whole budget. What went wrong?**
A: The job-level timeout alone doesn't isolate individual steps; a step-level `timeout-minutes` is needed to bound that specific step.

**Q: Does writing `if: success()` explicitly change anything compared to leaving `if` off entirely?**
A: No — it's functionally identical to the default; it just makes visible what's already implicit.
