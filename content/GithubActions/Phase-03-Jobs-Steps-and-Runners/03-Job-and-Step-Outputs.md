# Job and Step Outputs

Phase 1, Lesson 3 established the mechanics of a *step* output: because each `run:` step is a fresh shell process, a value can't just be `export`ed for the next step to see — it has to be written to `$GITHUB_OUTPUT` and referenced later as `${{ steps.<id>.outputs.<name> }}`. That covers passing a value *within a single job*. Lesson 1 of this phase established that real workflows are graphs of separate jobs, each running in its own fresh runner with no shared filesystem or process state — a step output defined inside `build` is invisible to `deploy` by default, no matter how the step wrote it. This lesson covers the second, job-level mechanism needed to cross that boundary.

## 1. Step Outputs via `$GITHUB_OUTPUT`

A step sets an output the same way Phase 1 described: inside a `run:` step, a line like `echo "version=1.2.3" >> "$GITHUB_OUTPUT"` writes a `key=value` pair to the special output file GitHub provides for that step. The step must carry an explicit `id`. Without `id: <name>`, there is no handle by which any later reference (`steps.<id>.outputs.<name>`) can locate that step's outputs — the `id` is what turns an anonymous step into an addressable one.

```yaml
- name: Determine version string
  id: get_version
  run: echo "version=1.4.2-$(date +%Y%m%d)" >> "$GITHUB_OUTPUT"
```

## 2. Referencing a Step's Output

Other steps in the *same* job can reference it immediately via `${{ steps.<id>.outputs.<name> }}`, exactly as covered in Phase 1 — this requires nothing beyond the step's own `id` and `$GITHUB_OUTPUT` write. This reference is job-scoped: it only resolves within the job the step belongs to, never from a different job.

```
Job: build
┌─────────────────────────────────────────┐
│ step id: get_version                     │
│   writes → $GITHUB_OUTPUT (version=...)  │
│                                           │
│ later step in same job:                  │
│   reads  → steps.get_version.outputs.version  ✓ resolves │
└─────────────────────────────────────────┘
Job: deploy
│   reads  → steps.get_version.outputs.version  ✗ does NOT resolve (different job)
```

## 3. Declaring Job-Level `outputs:`

To expose a step's value beyond its own job, the job itself must declare an `outputs:` map at the job level, where each key is the job-output name and each value is an expression like `${{ steps.<id>.outputs.<name> }}` pointing back at the specific step output being surfaced. GitHub evaluates the job's `outputs:` expressions once the job completes, capturing whatever the referenced step output held at that time, and attaches that to the job's own recorded result.

```yaml
build:
  runs-on: ubuntu-latest
  outputs:
    version: ${{ steps.get_version.outputs.version }}
  steps:
    - name: Check out code
      uses: actions/checkout@v4

    - name: Determine version string
      id: get_version
      run: echo "version=1.4.2-$(date +%Y%m%d)" >> "$GITHUB_OUTPUT"
```

Skipping this declaration is the single most common way this feature breaks in practice: a step's `$GITHUB_OUTPUT` value never automatically becomes a job output — that requires this explicit `outputs:` mapping. A job's `outputs:` entry can also point at a step that never actually ran (e.g., a step skipped by its own `if` condition) — in that case the job output silently resolves to an empty string rather than throwing an error, which can surface much later as a confusing empty value in a downstream job.

## 4. Referencing a Job's Output via `needs`

A downstream job lists the upstream job in `needs` (Lesson 1 of this phase) — this is a prerequisite for the reference to even resolve; a job cannot reference another job's outputs without also declaring it as a dependency. The downstream job then reads the value as `${{ needs.<job-id>.outputs.<output-name> }}` — note the different path shape from the step-level reference (`steps.<id>.outputs.<name>`): job outputs are addressed by job ID under `needs`, not by step ID.

```yaml
name: Build and Deploy with Version Output

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.get_version.outputs.version }}
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Determine version string
        id: get_version
        run: echo "version=1.4.2-$(date +%Y%m%d)" >> "$GITHUB_OUTPUT"

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy using the version from build
        run: echo "Deploying version ${{ needs.build.outputs.version }}"
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < build-deploy.yml
```

The full chain: `get_version` carries an explicit `id`, writes `version=...` to `$GITHUB_OUTPUT`, and is readable within `build` as `steps.get_version.outputs.version`. The `build` job re-declares that same value under its own `outputs:` map as `version`. Only because of that job-level declaration can `deploy` — which lists `needs: build` — read it as `needs.build.outputs.version`. Removing the job's `outputs:` block would leave `get_version`'s output perfectly readable inside `build` but completely invisible to `deploy`.

```
step id ──▶ $GITHUB_OUTPUT ──▶ steps.<id>.outputs.<name> ──▶ job outputs: ──▶ needs.<job>.outputs.<name>
(get_version)  (version=1.4.2..)   (same job only)          (version: ${{...}})   (deploy reads it)
```

`needs` here does double duty: Lesson 1 framed it purely as an ordering/skip-behavior mechanism; here it's also the addressing scheme a downstream job uses to read an upstream job's declared outputs — a job cannot reference another job's outputs without listing it in `needs` first.

## Comparison

| Comparison | Detail |
|---|---|
| Step output vs. job output | Step output (`steps.<id>.outputs.<name>`) is scoped to the job it was set in — later steps in that same job only. Job output (`needs.<job>.outputs.<name>`) is scoped across the whole job graph, but is always just a *pointer* back to one specific step output, explicitly re-exposed |
| vs. Phase 1, Lesson 3 | That lesson's `$GITHUB_ENV`/`$GITHUB_OUTPUT` distinction still fully applies inside a single job here — this lesson adds the second layer needed once a value has to cross a job boundary |
| vs. Phase 3, Lesson 1's `needs` | There, `needs` was purely ordering/skip behavior. Here it's also the addressing scheme (`needs.<job>.outputs.<name>`); a job can't reference another job's outputs without listing it in `needs` |

## Common Mistakes

- **Forgetting a step needs an explicit `id` before its output can be referenced anywhere** — without `id: get_version`, there is no `steps.get_version` to point at, and both the same-job reference and the job-level `outputs:` declaration fail to resolve.
- **Forgetting a job must explicitly declare `outputs:` mapping to a step's output** — assuming that because a step set an output with `$GITHUB_OUTPUT`, any other job in the workflow can automatically see it via `needs`. Job outputs aren't automatically visible to other jobs just because a step set one; the job-level `outputs:` map is a required, separate declaration.
- **Referencing `steps.<id>.outputs.<name>` from a *different* job** instead of `needs.<job>.outputs.<name>` — a step-scoped reference only resolves within the job that step belongs to; from another job it simply won't resolve.
- **Pointing a job's `outputs:` entry at a step that never actually ran** (e.g., a step skipped by its own `if` condition) — the job output silently resolves to an empty string rather than throwing an error, which can surface much later as a confusing empty value in a downstream job.
- **Assuming job outputs support complex structured data** — job outputs (like step outputs) are strings; passing something that looks like a data structure or a multi-line JSON blob works only insofar as it round-trips correctly as text.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Build the full `build`/`deploy` example above exactly as written, push it, and confirm the deploy log line prints the version string produced by `build`.
2. **(Requires a GitHub repo)** Remove only the `build` job's `outputs:` block (leave the step's `id` and `$GITHUB_OUTPUT` write intact) and push again. Confirm `deploy`'s `echo` now prints an empty string for `${{ needs.build.outputs.version }}`, demonstrating that a step output alone never crosses the job boundary.
3. **(Requires a GitHub repo)** Restore the `outputs:` block, then remove `id: get_version` from the version step (the step still runs normally and still writes to `$GITHUB_OUTPUT` — only its `id` is gone). Push and confirm the workflow does *not* fail validation: `steps.get_version` no longer addresses anything, so `build`'s own `outputs: version: ${{ steps.get_version.outputs.version }}` silently evaluates to an empty string, and `deploy` prints an empty version. Unlike Exercise 2 (missing job-level `outputs:` block) or Exercise 4 (step skipped via `if: false`), the break here is that the step reference itself has no handle to resolve.
4. **(Requires a GitHub repo)** Add an `if: false` condition to the `get_version` step so it never runs, while keeping the job's `outputs: version: ${{ steps.get_version.outputs.version }}` declaration in place. Confirm the job output resolves to an empty string rather than causing a workflow error.
5. **(Paper exercise, no execution needed)** Given a `build` job with two steps sharing outputs `id: step_a` and `id: step_b`, and a `deploy` job needing only `step_a`'s value, write the job-level `outputs:` map and the `needs.build.outputs.*` reference `deploy` would use.

## Interview Q&A

**Q: Job `build` sets a version number in a step. Job `deploy` needs it. Walk through every piece required for `deploy` to actually read that value.**
A: The step needs an explicit `id`; the step must write to `$GITHUB_OUTPUT`; `build` must declare a job-level `outputs:` entry pointing at that step's output; and `deploy` must list `needs: build` before referencing `needs.build.outputs.<name>`. Missing any one of these four is a distinct, plausible-looking bug.

**Q: If a step writes to `$GITHUB_OUTPUT` but its job never declares `outputs:`, can a downstream job read it via `needs`?**
A: No — a step's `$GITHUB_OUTPUT` value never automatically becomes a job output; the job-level `outputs:` map is a required, separate declaration.

**Q: What's the difference between `steps.<id>.outputs.<name>` and `needs.<job>.outputs.<name>`?**
A: The former is a same-job reference to a step's output; the latter is a cross-job reference to a value the upstream job explicitly re-exposed through its own `outputs:` map.

**Q: What happens if a job's `outputs:` entry points at a step that was skipped?**
A: The job output silently resolves to an empty string rather than erroring, which can surface as a confusing empty value downstream.

**Q: Can job outputs carry structured data like a JSON object?**
A: Job outputs, like step outputs, are strings — structured data only works if it round-trips correctly as text (e.g., a serialized JSON string parsed back out by the consumer).
