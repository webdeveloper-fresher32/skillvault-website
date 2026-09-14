# Env Vars at Workflow, Job, and Step Level

Every workflow up to this point has embedded its actual values straight into `run:` commands — a literal branch name, a literal file path. That breaks down the moment a workflow needs to behave differently depending on where a value comes from, or the moment a value is only known once a step actually runs (a version string parsed from a file, a timestamp, an ID returned by a previous command). GitHub Actions solves this with an `env:` block attachable at three levels, plus a separate runtime mechanism, `$GITHUB_ENV`, for values a step only discovers as it executes.

## 1. `env:` at Workflow, Job, and Step Level

`env:` can sit at three different places in a workflow file, each with a different visibility scope:

- **Workflow-level `env:`** — a sibling of `on:` and `jobs:`. Every job, and every step in every job, can read it unless overridden.
- **Job-level `env:`** — inside one job, alongside `runs-on` and `steps`. Visible to every step in that job only; other jobs never see it.
- **Step-level `env:`** — inside one specific step. Visible only to that step's own `run:` command or the action it invokes.

```yaml
env:
  DEPLOY_TARGET: staging   # workflow level: visible to every job

jobs:
  build-and-report:
    runs-on: ubuntu-latest
    env:
      DEPLOY_TARGET: production   # job level: overrides workflow value for this job
    steps:
      - name: Step-level override
        env:
          DEPLOY_TARGET: canary   # step level: overrides both job and workflow, this step only
        run: echo "This single step deploys to $DEPLOY_TARGET instead"
```

## 2. Precedence (Step > Job > Workflow)

When a step executes, GitHub Actions builds its process environment by layering all three declarations: it starts from workflow-level `env:`, applies job-level `env:` on top (job wins on a name collision), then applies step-level `env:` on top of that (step wins over both).

```
workflow env:  DEPLOY_TARGET = staging
        ↓ (job overrides on collision)
job env:       DEPLOY_TARGET = production
        ↓ (step overrides on collision)
step env:      DEPLOY_TARGET = canary        ← wins for this one step only
```

Narrower scope always wins ties on variable name — this is why the rule is stated as "step overrides job overrides workflow."

## 3. Static `env:` vs. Dynamic `$GITHUB_ENV`

`env:` values are written once in the YAML and are fixed before the workflow runs — they work only for values already known at write time. `$GITHUB_ENV` exists for the opposite case: a value only known once a step runs. GitHub Actions provisions every step with an environment variable named `GITHUB_ENV` whose value is the path to a temporary file; a step appends a `NAME=value` line to that file, and GitHub Actions reads the file after the step finishes, injecting every line as an environment variable available to **all subsequent steps in the same job** — not the current step (already finished by the time the file is read), and not other jobs (each job gets a fresh runner and a fresh `$GITHUB_ENV` file).

```yaml
- name: Compute a build ID and persist it
  run: |
    BUILD_ID="build-$(date +%s)"
    echo "BUILD_ID=$BUILD_ID" >> "$GITHUB_ENV"

- name: Use the persisted BUILD_ID in a later step
  run: echo "Deploying $BUILD_ID to $DEPLOY_TARGET"
```

A plain shell `export` does not survive this boundary. A `run:` step is a brand-new shell process (the fresh-shell-per-step model from Phase 1) — `export FOO=bar` only changes that process's own environment, and the process exits when the step finishes, taking the exported value with it. The next step starts an entirely new shell that never inherited it. `$GITHUB_ENV` works because the *runner itself* reads a file and injects new variables into every following step's process — it does not rely on shell inheritance at all.

## 4. Job-Level vs. Step-Level Expression Timing

This is the detail that trips people up: **when**, exactly, does an `env:` map's `${{ }}` expression get resolved, relative to the steps in that job?

- **Job-level `env:` resolves once, before any of that job's own steps run.** At that moment it can see `github.*` context, `vars.*`, and `needs.<job>.outputs` from upstream jobs that have already finished — all of these exist by the time the job starts. It **cannot** see `steps.<id>.outputs` from its own job's steps, because none of them have run yet.
- **Step-level `env:` resolves immediately before that specific step runs.** By then, every earlier step in the job has already executed — so a step-level `env:` expression *can* reference `steps.<id>.outputs` from an earlier step in the same job.

```
Job starts
  │
  ├─ job-level env: resolved HERE ── sees github.*, vars.*, needs.*.outputs
  │                                  does NOT see steps.*.outputs (none exist yet)
  │
  ├─ step 1 (id: gen_id) runs → writes steps.gen_id.outputs.id
  │
  ├─ step 2
  │     step-level env: resolved HERE ── sees steps.gen_id.outputs.id ✓ (step 1 already ran)
  │     run: ...
  ▼
Job ends
```

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    # env:
    #   TAG: ${{ steps.gen_id.outputs.id }}   # ✗ would NOT work here — resolves before gen_id runs
    steps:
      - name: Produce an id
        id: gen_id
        run: echo "id=abc123" >> "$GITHUB_OUTPUT"

      - name: Use it via step-level env
        env:
          TAG: ${{ steps.gen_id.outputs.id }}   # ✓ works here — gen_id has already run
        run: echo "Tag is $TAG"
```

## Comparison

| Comparison | Detail |
|---|---|
| `env:` vs. `$GITHUB_ENV` | `env:` is static, resolved before steps run, for values already known. `$GITHUB_ENV` is dynamic, written by a running step, for values only known at runtime that must reach *later* steps in the same job |
| Workflow vs. job vs. step `env:` | Identical syntax; only placement differs, which sets scope and precedence — step beats job beats workflow on a name collision |
| `$GITHUB_ENV` vs. shell `export` | `export` changes only the current step's own process and dies when that process exits. `$GITHUB_ENV` changes what the runner injects into every subsequent step's fresh process |
| Job-level env timing vs. step-level env timing | Job-level resolves once before any of the job's own steps run (no access to that job's own `steps.*.outputs`); step-level resolves right before its own step (full access to earlier steps' outputs in the same job) |
| Shell env var vs. `env` expression context | A shell reads it as `$VAR`; the `${{ }}` expression engine reads the same underlying value as `env.VAR` (e.g. `if: env.DEPLOY_TARGET == 'production'`) — two separate access paths to the same value, not the same mechanism |

## Common Mistakes

- **Expecting `export FOO=bar` in one `run:` step to be visible in the next `run:` step.** Each step is a fresh shell process; use `echo "FOO=bar" >> "$GITHUB_ENV"` instead.
- **Conflating the shell's `$VAR` syntax with the expression engine's `env.VAR` syntax** — writing something like `if: $VAR == 'x'` produces an invalid or silently-wrong expression; the two are separate access paths to the same underlying value.
- **Forgetting that step-level `env:` only overrides for that one step**, then being confused when a later step in the same job sees the job-level (or workflow-level) value again instead.
- **Writing to `$GITHUB_ENV` and expecting it to be visible in a different job.** Each job has its own runner and its own fresh `$GITHUB_ENV` file — nothing crosses job boundaries this way, regardless of `needs` ordering.
- **Putting `env: { FOO: ${{ steps.build.outputs.id }} }` at the job level** and expecting it to see that job's own `build` step's output. It silently evaluates to empty, because the job's `env:` map resolves before any of that job's own steps run. The same expression works fine at the step level, on a step that runs after `build`. The fix for the job-level case is writing the value to `$GITHUB_ENV` from a `run:` step, or wiring it through `needs.<job>.outputs` if it needs to cross job boundaries.

## Hands-On Exercises

1. **(Paper exercise)** A workflow declares `DEPLOY_TARGET: staging` at workflow level, `DEPLOY_TARGET: production` at job level for `deploy`, and no step-level override. What value does every step in `deploy` see? What if one step then adds its own `env: { DEPLOY_TARGET: canary }`?
2. **(Requires a GitHub repo)** Build the Section 1 example (workflow/job/step `env:` layering) exactly as written, push it, and confirm the last step prints `canary` while an earlier step in the same job prints `production`.
3. **(Requires a GitHub repo)** Add a step that computes a value with `date` and writes it via `$GITHUB_ENV`, then a later step in the same job that echoes it. Confirm the value is readable. Then add a step in a *second* job (with `needs:` on the first) that tries to echo the same variable, and confirm it prints empty — demonstrating `$GITHUB_ENV` never crosses job boundaries.
4. **(Requires a GitHub repo)** Build the Section 4 example: a step `id: gen_id` writing to `$GITHUB_OUTPUT`, then try referencing `steps.gen_id.outputs.id` in that same job's job-level `env:` block (uncomment the commented-out lines). Confirm it resolves to empty. Then move the identical expression into a step-level `env:` on a step that runs after `gen_id`, and confirm it resolves correctly.
5. **(Paper exercise)** Explain why a plain shell `export MY_VAR=123` in one `run:` step never reaches the next step's `run:` block, and name the one-line fix.

## Interview Q&A

**Q: You set `MY_VAR=123` with `export` in one step. The next step's `run:` echoes `$MY_VAR` and gets nothing. Why, and how do you fix it?**
A: Each `run:` step is a fresh shell process, so `export` never survives past the step that ran it. Fix: `echo "MY_VAR=123" >> "$GITHUB_ENV"`, which the runner reads after the step finishes and injects into every subsequent step in that job.

**Q: If workflow, job, and step all define `TIMEOUT`, which one wins?**
A: Step wins over job wins over workflow — narrower scope always takes precedence on a name collision.

**Q: Can a job's own `env:` block reference `${{ steps.build.outputs.id }}` from a step in that same job?**
A: No. The job's `env:` map resolves once, before any of that job's own steps run, so `steps.build.outputs.id` doesn't exist yet at that point — it silently evaluates to empty.

**Q: Can a step-level `env:` block reference an earlier step's output in the same job?**
A: Yes. Step-level `env:` resolves immediately before that step runs, so any earlier step in the same job has already executed and its outputs are available.

**Q: Why doesn't `$GITHUB_ENV` work across jobs?**
A: Each job runs on its own fresh runner with its own fresh `$GITHUB_ENV` file — there's no shared filesystem or process state between jobs, regardless of `needs` ordering.
