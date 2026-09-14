# Job Dependencies and Needs

Phase 1 modeled a workflow as `jobs:` — a map of job IDs, each with `runs-on` and `steps` — but every example so far had exactly one job, so the map never had to express a relationship between entries. The moment a workflow has two or more jobs, ordering and failure propagation become unavoidable questions, and `needs` is the key that answers both.

## 1. Jobs Run in Parallel by Default

The default answer surprises anyone coming from a script-reading mental model (top to bottom, one line after another): **every job in the `jobs` map runs in parallel, independently, at the same time**, unless you explicitly say otherwise. Job order in the YAML file is purely cosmetic and has zero effect on execution order — a `build` job and a `deploy` job with no relationship declared between them will both start the moment the workflow is triggered, which is exactly wrong if `deploy` needs `build`'s artifact to exist first.

```
jobs: { build, test, lint, deploy }   ← no `needs` anywhere

Timeline (no `needs`):
  build   ─────────────▶
  test    ─────────────▶   all start together,
  lint    ─────────────▶   no ordering guarantee
  deploy  ─────────────▶
```

## 2. Creating Dependencies with `needs`

Writing `needs: build` under a `test` job tells the scheduler: do not start `test` until `build` reaches a terminal state (success, failure, or cancellation). A list, `needs: [test, lint]`, means the job waits for *all* named jobs to reach a terminal state — never "wait for any one of these." Because `needs` edges can chain (`A ← B ← C`), GitHub resolves the full dependency graph before scheduling, so a job several links downstream implicitly waits on the entire upstream chain, not just its immediate `needs` entry.

```yaml
name: Build, Test, Lint, Deploy

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4
      - name: Build application
        run: echo "Building the application..."

  test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Run test suite
        run: echo "Running tests against the build output..."

  lint:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Run linter
        run: echo "Linting the codebase..."

  deploy:
    needs: [test, lint]
    runs-on: ubuntu-latest
    steps:
      - name: Deploy application
        run: echo "Deploying, now that test and lint both succeeded..."
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < pipeline.yml
```

`build` has no `needs`, so it starts immediately. `test` and `lint` both declare `needs: build`, so both wait for `build` to finish — and once it does, they start **at the same time as each other**, since neither depends on the other. `deploy` declares `needs: [test, lint]`, so it waits for both to reach a terminal state; only if both succeed does `deploy` actually run.

```
build ──▶ done
           ├──▶ test ──┐
           └──▶ lint ──┴──▶ deploy (needs both to succeed)
```

## 3. What Happens When a Dependency Fails

Once every job listed in `needs` finishes, GitHub checks their outcomes. If **all** succeeded, the default (implicit) condition on the waiting job — equivalent to `if: success()` — evaluates true, and it proceeds to run. If **any** job in `needs` failed (or was itself skipped), the default implicit condition evaluates false, and the waiting job is marked **skipped** — its steps never execute at all. This is a common wrong assumption: a `deploy` job does not "still run and fail on its own merits" after `test` fails upstream — it never runs.

Overriding the default requires an explicit `if:`:

| Condition on downstream job | Behavior when a `needs` dependency fails |
|---|---|
| (no `if`, default) | Job is **skipped**, not run and not failed |
| `if: always()` | Job runs regardless of upstream success, failure, or skip |
| `if: failure()` | Job runs **only** when at least one dependency failed (rollback/alert shape) |

A cycle in the graph (e.g., `A needs: B` and `B needs: A`, directly or several links apart) is rejected before any job runs — GitHub cannot compute a valid start order, and the entire workflow fails as invalid at parse time, not at runtime. The same is true if `needs` lists a job ID that doesn't exist or is misspelled.

## Comparison

| Scenario | Behavior |
|---|---|
| No `needs` | Independent parallel lane, no ordering guarantee, job order in YAML is cosmetic |
| `needs: build` (single) | Waits for one job; behaves identically to a one-item list |
| `needs: [test, lint]` (list) | Waits for **all** listed jobs to reach a terminal state |
| Default (no `if`) | Runs only if every `needs` job succeeded |
| `if: always()` | Runs no matter what, including on upstream failure or skip |
| `if: failure()` | Runs only when something upstream actually failed |

## Common Mistakes

- **Creating a circular `needs` dependency** — e.g., job A needs job B and job B needs job A (directly, or several links apart through a longer chain). GitHub cannot resolve a start order for a cycle, and the entire workflow is rejected as invalid before any job runs.
- **Assuming a downstream job runs (and just fails) when its `needs` dependency fails** — the default is that it is **skipped**, not attempted and failed. This trips up people checking "did `deploy` fail?" in a status dashboard when the honest answer is "`deploy` never ran at all."
- **Forgetting that jobs sharing a common `needs` target run in parallel with each other**, not sequentially — writing `test` and `lint` in that order in the YAML with both declaring `needs: build` does not make `test` run before `lint`; they start together.
- **Adding `if: always()` to make a downstream job "more robust" without realizing it also removes the implicit success check** — a job with `if: always()` will now attempt to run even when its actual prerequisite data (an artifact, a build output) was never produced, potentially failing for a different, more confusing reason.
- **Listing a job in `needs` that doesn't exist, or misspelling a job ID** — this is caught as an invalid workflow reference at parse time, similar in spirit to the circular-dependency case, and prevents the workflow from running at all.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Create a workflow with `build`, `test`, and `deploy` jobs where `test` and `deploy` both declare `needs: build`. Push it and confirm in the Actions run graph that `test` and `deploy` start at the same time once `build` finishes, not sequentially.
2. **(Requires a GitHub repo)** Make the `build` job's step exit with a non-zero status (`run: exit 1`) while `deploy` declares `needs: build` with no `if:` override. Push and confirm `deploy` shows as **skipped**, not **failed**, in the run summary.
3. **(Requires a GitHub repo)** Add `if: failure()` to a new `notify` job that declares `needs: build`. Trigger a run where `build` fails and confirm `notify` runs; then fix `build` so it succeeds and confirm `notify` is skipped on that successful run.
4. **(Requires `act` or a GitHub repo)** Write two jobs, `A` with `needs: B` and `B` with `needs: A`. Attempt to run/push the workflow and confirm GitHub (or `act`) rejects it as an invalid workflow due to the circular dependency, rather than running either job.
5. **(Paper exercise, no execution needed)** Given a `jobs` map with `lint`, `unit-test`, `integration-test` (the latter two both `needs: lint`), and `deploy` (`needs: [unit-test, integration-test]`), draw the dependency graph and state which jobs run in parallel with each other.

## Interview Q&A

**Q: You have `build`, `test`, and `deploy` jobs. `test` fails. What does `deploy` do by default?**
A: `deploy` is skipped, not run and failed — the implicit `success()` condition tied to `needs` evaluates false.

**Q: How would you make `deploy` run regardless of whether `test` passed or failed?**
A: Add `if: always()` to `deploy`.

**Q: How would you make a job run *only* when an upstream dependency failed, e.g., to send an alert?**
A: Add `if: failure()`.

**Q: Five jobs declare no `needs` at all. In what order do they run?**
A: There's no meaningful order — they're all scheduled to start together; only runner pool/concurrency limits might serialize them in practice.

**Q: What happens if `needs` entries form a cycle?**
A: The workflow fails validation before any job runs — it's a parse-time error, not a runtime one.
