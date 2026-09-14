# Choosing: Reusable Workflow vs. Composite Action

Lessons 1 and 2 each solve a real duplication problem, but at a different scale — and the two mechanisms overlap enough on the surface (both are invoked with `uses:`, both accept `inputs`, both can be local or checked out from another repository) that it's easy to reach for the wrong one. The deciding question is scope: is the thing being reused a *few steps that belong inside a job that already exists*, or is it *an entire job's worth of structure* — its own `runs-on`, possibly its own `strategy.matrix`, possibly multiple jobs with `needs:` between them, possibly its own secrets-handling contract?

## 1. The Same Logic, Two Ways

The same "checkout + setup + install" logic, first as a composite action folded into an existing job:

```yaml
# .github/actions/setup-project/action.yml
name: "Setup Project"
description: "Checks out code, sets up Node.js, and installs dependencies"

inputs:
  node-version:
    description: "Node.js version to install"
    required: false
    default: "20"

runs:
  using: composite
  steps:
    - name: Check out code
      uses: actions/checkout@v4

    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: npm

    - name: Install dependencies
      shell: bash
      run: npm ci
```

```yaml
# .github/workflows/ci-composite.yml
name: CI (Composite Action)

on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Set up project
        uses: ./.github/actions/setup-project
        with:
          node-version: "20"

      - name: Run tests
        run: npm test
```

The same logic wrapped instead as a reusable workflow, now able to express its own `runs-on` and a matrix the caller doesn't control:

```yaml
# .github/workflows/setup-and-test.yml
name: Setup and Test (Reusable)

on:
  workflow_call:
    inputs:
      node-version:
        type: string
        required: false
        default: "20"

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
```

```yaml
# .github/workflows/ci-reusable.yml
name: CI (Reusable Workflow)

on:
  push:
    branches:
      - main

jobs:
  call-setup-and-test:
    uses: ./.github/workflows/setup-and-test.yml
    with:
      node-version: "20"
```

Validate all four files are well-formed YAML:

```bash
for f in action.yml ci-composite.yml setup-and-test.yml ci-reusable.yml; do
  python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < "$f"
done
```

The composite-action version's `test` job stays a single job, on a single `runs-on: ubuntu-latest`, with the setup logic folded in as one extra step. The reusable-workflow version's `test` job lives inside `setup-and-test.yml` itself and carries its own `strategy.matrix` across `os: [ubuntu-latest, windows-latest]` — a capability tying back to Phase 6's matrix builds — which `ci-reusable.yml` never has to know or express itself; it just calls the reusable workflow once and gets both OS runs for free. That matrix is the tell: it's job-level structure a composite action's flat `runs.steps` list has no way to represent, no matter how it were rewritten.

## Comparison

**Decision criteria — when to use each:**

| Question | Composite action | Reusable workflow |
|---|---|---|
| Just a few steps inside a job that already does other things? | Yes — this is the fit | Overkill — extra job boundary for no reason |
| Needs its own `runs-on` different from the caller's? | Cannot express this at all | Yes — its own job(s), own `runs-on` |
| Needs its own `strategy.matrix`, independent of the caller? | Cannot express this at all | Yes — matrix lives in the callee's own job |
| Needs a formal secrets contract (`required`, `secrets: inherit`)? | No such mechanism — secrets ride as plain inputs, sourced from `${{ secrets.NAME }}` by the caller | Yes — first-class `secrets:` block, built on top of the same secret scoping Phase 4 covers |
| Needs multiple dependent jobs (`needs:` between them)? | No — always one flat step list, one job | Yes — can package several jobs as one callable unit |
| Cost per call site | Cheap — no new job/runner | An extra job (and runner) added to the run |

**Worked comparison — the same logic, two ways (from Section 1):**

| | Composite action (`ci-composite.yml`) | Reusable workflow (`ci-reusable.yml`) |
|---|---|---|
| Job count in the caller's run | 1 (`test`) | 2 (`call-setup-and-test` + the callee's own `test`) |
| `runs-on` | Fixed at `ubuntu-latest`, set by the caller | `${{ matrix.os }}`, set by the callee, invisible to the caller |
| Matrix | None — cannot express one | `os: [ubuntu-latest, windows-latest]`, owned entirely by the callee |
| Secrets | Would be a plain `input` if needed | Could add a first-class `secrets:` block |
| Overhead | One extra step, same runner | One extra job boundary, own runner(s) |

**Rule of thumb:** if the reused unit could be described as "a few steps that belong inside a job," default to a composite action; if it needs its own runner choice, its own matrix, its own multi-job graph, or a formal secrets contract, default to a reusable workflow.

## Common Mistakes

- **Reaching for a full reusable workflow when a lightweight composite action would suffice.** Wrapping three steps in `on: workflow_call` and a whole separate workflow file adds an extra job to every calling workflow's run — an extra queued runner, an extra top-level entry in the run summary — for logic that would have folded into the existing job as a single `uses:` step.
- **Reaching for a composite action when the actual need is to share an entire job's `runs-on`/`strategy.matrix` configuration.** A composite action cannot declare its own `runs-on` or `strategy.matrix` — it always inherits the calling job's runner and runs as flat, serial steps within it. Forcing that need into a composite action means the matrix (or alternate OS) has to be pushed up into every caller's own job instead, defeating the point of centralizing it.
- **Assuming secrets handling works the same way in both.** A reusable workflow has a real `secrets:` contract with `required` and `secrets: inherit`; a composite action has neither — everything is an `input`, secret-shaped or not (Lesson 2). Designing a composite action as if it had a `secrets:` block leads to invalid YAML at the call site.
- **Trying to express multiple dependent jobs (`needs:` between them) as one composite action.** A composite action's `runs.steps` is always one flat list inside one job — there is no way to declare "step group A must finish before step group B starts, on different runners" inside a single `action.yml`. That shape is what a reusable workflow's multiple jobs plus `needs:` exists for.
- **Standardizing on only one mechanism everywhere.** Some teams default to composite actions for everything to avoid extra job boundaries, then find themselves unable to express a needed matrix or independent OS; others default to reusable workflows for everything "to be safe," then pay job-spin-up overhead on every trivial three-step reuse. The right choice is per-situation, based on the questions in the decision-criteria table above.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Build both versions from Section 1 — `ci-composite.yml` with its composite action, and `ci-reusable.yml` with `setup-and-test.yml`. Push both and compare the run summaries: count how many jobs each produces.
2. **(Requires a GitHub repo)** In `action.yml` from the composite-action version, try to add a `strategy: matrix: os: [ubuntu-latest, windows-latest]` key anywhere alongside `runs:`. Confirm the action definition has no place for a `strategy` key at all — `runs.steps` is a flat list with no matrix concept, unlike the `test` job in `setup-and-test.yml`.
3. **(Paper exercise)** A team needs to reuse "checkout, build a Docker image, push it to a registry" across 15 repositories, and one repository needs this to happen on both `ubuntu-latest` and `self-hosted` arm64 runners. Which mechanism fits, and why does the arm64 requirement rule out the other one?
4. **(Requires a GitHub repo)** Take the reusable-workflow version and remove `strategy.matrix` from `setup-and-test.yml`, leaving `runs-on: ubuntu-latest` hardcoded. Confirm the workflow still runs correctly as a reusable workflow — demonstrating that the matrix was a capability being used, not a requirement of being a reusable workflow.
5. **(Paper exercise)** A composite action's steps currently include a step that needs `secrets.NPM_TOKEN`. Rewrite the relevant `inputs:` and consuming-workflow `with:` so the token is supplied correctly, without inventing a `secrets:` key anywhere in `action.yml`.

## Interview Q&A

**Q: When would you choose a composite action over a reusable workflow, and vice versa?**
A: Composite actions for a handful of steps that belong inside an existing job, with no need for their own `runs-on` or matrix, and no distinct secrets contract; reusable workflows when the reused unit needs its own job-level configuration (a different runner, an independent matrix, multiple dependent jobs) or a formal `secrets:`/`secrets: inherit` contract.

**Q: Can a composite action run a matrix internally?**
A: No — a composite action has no `strategy.matrix` of its own at all. Any matrix behavior has to live in the calling job (visible to, and controlled by, the caller) or be pushed into a reusable workflow instead, where the matrix is the reusable unit's own concern.

**Q: What's the actual cost of getting this choice wrong in each direction?**
A: Composite-action-shaped work wrapped as a reusable workflow pays extra job/runner overhead per call. Reusable-workflow-shaped work forced into a composite action can't express the needed runner/matrix/multi-job structure at all — that's a capability gap, not just inefficiency.

**Q: Both mechanisms use `uses:` and accept `inputs`. What's the single fastest way to tell which one a given `uses:` line invokes?**
A: Where it sits — a job-level `uses:` (replacing that job's `steps:`) is always a reusable workflow; a step-level `uses:` inside a job's `steps:` list is always an action, composite or otherwise.
