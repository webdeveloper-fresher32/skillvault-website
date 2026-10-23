# Reusable Workflows with `workflow_call`

By Phase 6 a single job can fan out across a whole matrix of operating systems and runtime versions — but that job's *definition* still lives in exactly one workflow file. The moment a second repository (or a second workflow in the same repository) needs the identical "build, test, and package" job, the only tool available so far is copy-paste, and copy-pasted jobs drift out of sync. `on: workflow_call` turns a workflow file into a **reusable workflow** that other workflows can call the way a program calls a function — passing in values that differ per call and reading results back out.

## 1. Declaring a Reusable Workflow (`on: workflow_call`)

A workflow becomes callable by adding `on: workflow_call` as a trigger (optionally alongside others, or as its only trigger). The `workflow_call` block declares a typed contract: `inputs` (each with a `type` of `string`, `boolean`, or `number`, optionally `required`/`default`), `secrets` (each optionally `required`), and `outputs` (each pointing at a value produced by one of the callee's own jobs).

```yaml
# build-and-test.yml — the callee
name: Build and Test (Reusable)

on:
  workflow_call:
    inputs:
      node-version:
        description: "Node.js version to build with"
        type: string
        required: false
        default: "20"
      run-lint:
        description: "Whether to run the lint step"
        type: boolean
        required: false
        default: true
    secrets:
      NPM_TOKEN:
        description: "Registry token for private packages"
        required: true
    outputs:
      artifact-name:
        description: "Name of the uploaded build artifact"
        value: ${{ jobs.build.outputs.artifact-name }}

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      artifact-name: ${{ steps.package.outputs.artifact-name }}
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}

      - name: Configure registry auth
        run: echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}" >> .npmrc

      - name: Install dependencies
        run: npm ci

      - name: Lint
        if: ${{ inputs.run-lint }}
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Package build output
        id: package
        run: |
          echo "artifact-name=build-${{ github.sha }}" >> "$GITHUB_OUTPUT"
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < build-and-test.yml
```

`build-and-test.yml` never runs on its own `push` or `pull_request` — its only trigger is `workflow_call`, so it exists purely to be called. `inputs.node-version` has a `default`, so a caller that omits it still gets `"20"`; `secrets.NPM_TOKEN` is `required: true`, so a caller that forgets `secrets:` entirely fails validation before the callee even starts.

## 2. Calling a Reusable Workflow

A caller references the callee from a job using `uses:` pointing at the callee's path — `./.github/workflows/callee.yml` for the same repository, or `owner/repo/.github/workflows/callee.yml@ref` for a different one. This `uses:` sits directly on the **job**, replacing that job's own `steps:` entirely — structurally different from a step-level `uses:`, which references a single action inside a job that still has other steps.

```yaml
# ci-caller.yml — the caller
name: CI

on:
  push:
    branches:
      - main

jobs:
  call-build-and-test:
    uses: ./.github/workflows/build-and-test.yml
    with:
      node-version: "20"
      run-lint: true
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

  report:
    needs: call-build-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Show artifact name from the reusable workflow
        run: echo "Built artifact -> ${{ needs.call-build-and-test.outputs.artifact-name }}"
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < ci-caller.yml
```

The job named `call-build-and-test` has `uses:` instead of `steps:` — that single line is the entire job body, because the actual steps live in the callee. `report` reads `needs.call-build-and-test.outputs.artifact-name`, which resolves through the callee's own `outputs.artifact-name`, which in turn points at `jobs.build.outputs.artifact-name` inside the callee — three hops, all necessary, all explicit. GitHub Actions runs the callee's job(s) as their own job(s) in the overall run — their own `runs-on`, their own runner, their own log section — never as inlined steps bolted onto the calling job.

## 3. Passing Secrets — Explicit vs. `inherit`

Secrets do **not** automatically flow from caller to callee. Unless the calling job writes `secrets: inherit`, the callee sees only the secrets explicitly listed under `secrets:` in that `uses:` block — nothing else from the caller's available secrets is visible inside it, no matter how obviously "available" it might seem from the caller's side.

```yaml
# Option A — explicit, named secrets only
jobs:
  call-build-and-test:
    uses: ./.github/workflows/build-and-test.yml
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

# Option B — blanket inheritance, everything the caller has
jobs:
  call-build-and-test:
    uses: ./.github/workflows/build-and-test.yml
    secrets: inherit
```

Listing secrets one by one passes exactly the named secrets and nothing else — the callee cannot see any secret the caller didn't explicitly name, even if the callee's `workflow_call` block declares more secrets than were passed (those come through empty, and validation fails if they were `required`). `secrets: inherit` instead passes every secret currently available to the calling job, under the same names, without listing any of them — convenient, but a much broader grant than most call sites actually need.

## 4. Nesting Limits and Matrix Caveats

A reusable workflow can itself call another reusable workflow, but GitHub Actions enforces a maximum nesting depth — four levels of reusable workflows may be called from a single top-level workflow, as of GitHub's current documented limit. GitHub Actions does support combining `strategy.matrix` (Phase 6) with a `uses:` job that calls a reusable workflow, so each matrix combination invokes its own instance of the callee — but the exact capability has evolved over GitHub's release history, and older self-hosted or Enterprise Server versions may lag behind github.com.

```
Top-level workflow
  └─ calls Reusable A   (nesting depth 1)
       └─ calls Reusable B   (nesting depth 2)
            └─ calls Reusable C   (nesting depth 3)
                 └─ calls Reusable D   (nesting depth 4)  ← at the documented ceiling
                      └─ calls Reusable E   ✗ fails — no further nesting
```

## Comparison

| | Job-level `uses:` (reusable workflow) | Step-level `uses:` (action) |
|---|---|---|
| What it replaces | The job's entire `steps:` list | One step among possibly many |
| Runner | Its own `runs-on`, own job in the run | Runs on the calling job's runner |
| Secrets | First-class `secrets:` block + `secrets: inherit` | No secrets concept — just an action's `with:` |
| Can carry `strategy.matrix` | Yes, its own matrix (Phase 6) | No — a step has no matrix of its own |

| | `secrets:` explicit list | `secrets: inherit` |
|---|---|---|
| What the callee sees | Only the named secrets | Every secret available to the caller |
| Missing a required secret | Call fails validation before the callee runs | Not applicable — everything flows through |
| Typical use | Most call sites; least privilege | Trusted internal callees only |

| | Reusable workflow (`workflow_call`) | `workflow_dispatch` |
|---|---|---|
| Triggered by | Another workflow's job | A human or an API call |
| Relationship to caller | Runs as part of the calling run, outputs flow back via `needs.<job>.outputs` | Starts an independent run with no caller |
| Has an equivalent to job outputs flowing back | Yes | No |

## Common Mistakes

- **Assuming secrets automatically pass through to a called reusable workflow.** They do not, unless the calling job uses `secrets: inherit`. A caller that lists `with:` inputs but skips `secrets:` entirely will see the callee fail validation on any `required: true` secret, or silently receive empty values for non-required ones.
- **Nesting `workflow_call` workflows too deeply.** Chaining callee-calls-callee several layers deep risks hitting GitHub's documented four-level nesting ceiling and failing at run time with no way to nest further — flattening the chain is usually the fix.
- **Trying to call a reusable workflow from inside a matrix job without confirming platform support.** The combination is supported on github.com, but older self-hosted or Enterprise Server versions may lag — confirm the actual environment before assuming parity with the newest github.com behavior.
- **Forgetting that a job-level `uses:` cannot be mixed with `steps:` on the same job.** A job either *is* a call to a reusable workflow (`uses:` only) or *has* its own steps (`steps:` only) — adding both to one job definition is invalid, not merely redundant.
- **Referencing a callee workflow path incorrectly.** A same-repository callee needs a relative path starting `./` (e.g. `./.github/workflows/build-and-test.yml`); a cross-repository callee needs the full `owner/repo/path@ref` form with an explicit ref. Omitting the leading `./` for a local file causes GitHub Actions to fail to resolve the reusable workflow entirely.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Create `build-and-test.yml` exactly as in Section 1 and a caller workflow as in Section 2. Push both, add an `NPM_TOKEN` repository secret (any placeholder value), and confirm the run shows `call-build-and-test` and `report` as separate jobs, with `report`'s log line showing the artifact name.
2. **(Requires a GitHub repo)** Remove the `secrets:` block from the caller entirely while keeping `NPM_TOKEN` marked `required: true` in the callee. Confirm the run fails validation before any job starts.
3. **(Requires a GitHub repo)** Replace the caller's explicit `secrets: NPM_TOKEN: ...` with `secrets: inherit`. Confirm the callee still receives `NPM_TOKEN` correctly, and note that it would now also receive any other secret the caller has access to.
4. **(Paper exercise)** A reusable workflow `C` is called by reusable workflow `B`, which is called by reusable workflow `A`, which is called by a top-level workflow. Is this within GitHub's documented nesting limit? What is the maximum additional level of nesting still allowed?
5. **(Requires a GitHub repo)** In the caller, change the job's `uses:` line to also include a sibling `steps:` key with one step. Confirm GitHub Actions rejects the workflow as invalid.

## Interview Q&A

**Q: Does calling a reusable workflow automatically give it access to the caller's secrets?**
A: No. By default the callee sees only what's explicitly passed under `secrets:` in the calling job. A caller must either list each secret individually or use `secrets: inherit` to intentionally grant broad access — there is no implicit inheritance.

**Q: A reusable workflow declares a `required: true` secret and the caller doesn't provide it. What happens?**
A: The call fails validation before the callee's jobs run, rather than the callee silently running with an empty secret.

**Q: What's actually different about `uses:` on a job compared to `uses:` on a step?**
A: A job-level `uses:` replaces the whole job body with another workflow's jobs (with their own `runs-on`, matrix, everything); a step-level `uses:` runs one action as one step among possibly many others in a job that still has its own `steps:` list.

**Q: Can a reusable workflow call another reusable workflow?**
A: Yes, but GitHub Actions caps the nesting depth at four levels of reusable workflows called from a single top-level workflow — chains deeper than that fail at run time.

**Q: How do you read a value produced by a job inside a called reusable workflow?**
A: Through `needs.<job-id>.outputs.<name>` in the caller, where `<job-id>` is the id of the job that has the `uses:` line — the same mechanism used to read outputs from any other job the caller `needs`.
