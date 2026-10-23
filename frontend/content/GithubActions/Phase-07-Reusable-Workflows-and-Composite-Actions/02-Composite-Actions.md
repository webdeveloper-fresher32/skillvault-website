# Composite Actions

Not every duplication problem is the size of a whole job. "Check out the code, set up Node, run `npm ci`" is the opening of practically every job in a Node project's workflows, but it's just three steps — wrapping it in a full reusable workflow (Lesson 1) would mean paying for an entire extra job boundary just to save typing three lines. A **composite action** bundles a handful of `run`/`uses` steps into a single reusable unit consumed with one `uses:` line *inside* an existing job's `steps:` list — no new job, no new runner, just steps that behave, from the calling job's point of view, as if they were one step.

## 1. A Composite Action's `action.yml`

A composite action lives in its own directory (commonly `.github/actions/<name>/`) containing an `action.yml` file with `runs.using: composite`. It declares its own `inputs` — each with a `description`, optional `default`, and optional `required` — and a `runs.steps` list of its own. There is no `on:` trigger anywhere in this file; that key belongs to workflows, not actions.

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

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < action.yml
```

`runs.using: composite` is what marks this as a composite action rather than a Docker- or JavaScript-based one. Note the `shell: bash` on the `run:` step — required, covered in Section 4.

## 2. Referencing Inputs (`${{ inputs.name }}`)

Each step inside `runs.steps` reads the action's own inputs via `${{ inputs.<name> }}` — a different context than a workflow's `${{ inputs.<name> }}` inside a `workflow_call` block (Lesson 1); here it refers to the composite action's own declared inputs, scoped to its own `action.yml`. A calling workflow consumes the composite action with `uses:` inside an ordinary job's `steps:` list, passing values through `with:` exactly like consuming any other action.

```yaml
# .github/workflows/ci.yml — the consumer
name: CI

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

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < ci.yml
```

`uses: ./.github/actions/setup-project` sits as one step inside `test`'s existing `steps:` list, right alongside `- name: Run tests` — both run on the exact same runner, in the exact same working directory that `actions/checkout@v4` (invoked *inside* the composite action) populated.

## 3. No Separate Secrets Mechanism

Composite actions do not have a distinct `secrets:` concept the way reusable workflows do. There is no `secrets:` key anywhere in `action.yml` — if a value needs to stay out of logs, it is still declared as a plain `input`, and the caller is responsible for sourcing it from `${{ secrets.NAME }}` on their end before passing it in through `with:`.

```yaml
# action.yml — a secret-shaped value is still just an input
inputs:
  registry-token:
    description: "Registry token for private packages"
    required: true

runs:
  using: composite
  steps:
    - name: Configure registry auth
      shell: bash
      run: echo "//registry.npmjs.org/:_authToken=${{ inputs.registry-token }}" >> .npmrc
```

```yaml
# consuming workflow — the caller sources the real secret itself
    steps:
      - name: Set up project
        uses: ./.github/actions/setup-project
        with:
          registry-token: ${{ secrets.NPM_TOKEN }}
```

Trying to write `secrets:` under a `uses: ./.github/actions/...` step is simply not valid syntax — every value, secret-shaped or not, is just an `input`.

## 4. Shared Runner/Filesystem Context

All of a composite action's steps execute as part of the calling job, on the calling job's own runner, sharing its filesystem, environment, and already-checked-out working directory — there is no separate job spun up for it, and no separate runner allocated to it. This is also why a `run:` step inside `runs.steps` must specify `shell:` explicitly (e.g. `shell: bash`) — composite steps don't fall back to a workflow- or job-level default shell the way ordinary job steps do, because a composite action has no job-level `defaults:` context of its own to inherit from.

```
Calling job "test" (runs-on: ubuntu-latest)
├── step: uses ./.github/actions/setup-project   ← composite action starts here
│     ├── (nested) checkout                       same runner, same filesystem
│     ├── (nested) setup-node
│     └── (nested) npm ci
└── step: run npm test                             sees exactly what the nested steps left behind
```

Outputs, if declared under the composite action's own `outputs:` block, are set via `steps.<step-id>.outputs` referenced from inside the composite action, and become available to the calling job as `steps.<the-uses-step-id>.outputs.<name>` — the same way any step's outputs are read.

## Comparison

| | Composite action's `inputs` | Reusable workflow's `inputs`/`secrets` |
|---|---|---|
| Reading inside its own definition | `${{ inputs.<name> }}` | `${{ inputs.<name> }}` (and `${{ secrets.<name> }}`) |
| Dedicated secrets block | None — everything is an `input` | Yes — `secrets:` under `workflow_call`, with `required` |
| Caller-side syntax for secrets | `with:` only | `secrets:` block or `secrets: inherit` |

| | Where composite action steps run | Where reusable workflow jobs run |
|---|---|---|
| Runner | Calling job's own runner | Own fresh runner per job |
| Filesystem | Shared with the calling job | Isolated, nothing shared unless passed via inputs/outputs |
| Job boundary | None — same job | New job, own `runs-on` |

## Common Mistakes

- **Trying to pass a `secrets:` block when calling a composite action.** Composite actions only accept `with:` — writing `secrets:` under a `uses: ./.github/actions/...` step is not valid syntax; any secret value has to be threaded through as a normal `with:` input, sourced from `${{ secrets.NAME }}` by the caller.
- **Assuming a composite action's steps run in some kind of isolated sub-context.** They run in the calling job, full stop — same runner, same filesystem, same environment variables, same working directory. A composite action that does `actions/checkout@v4` internally, called from a job that already checked out code itself, checks out again into the same already-populated directory.
- **Forgetting `shell:` on a `run:` step inside `action.yml`.** Unlike a normal job step, a composite action's `run:` steps require an explicit `shell:` — omitting it is a validation error, not a silent fallback to `bash` or the runner's OS default.
- **Expecting a composite action to declare its own `runs-on`.** There is no such key anywhere in `action.yml` — it always inherits whatever runner the calling job is already using, which means an action written assuming a Linux shell can break silently when consumed from a Windows-runner job.
- **Overloading a composite action with logic that really wants its own job boundary.** A composite action that internally tries to run several long, independent, parallelizable chunks of work is fighting its own model — those steps still run serially on one runner; if the logic genuinely needs its own `runs-on`/matrix/parallel job structure, a reusable workflow (Lesson 1) is the better fit.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Create `.github/actions/setup-project/action.yml` exactly as in Section 1, and a consuming workflow as in Section 2. Push both and confirm the run summary shows the composite action's internal steps nested under the single `uses:` step.
2. **(Requires a GitHub repo)** Remove `shell: bash` from the `Install dependencies` step in `action.yml`. Confirm GitHub Actions reports a validation error rather than silently defaulting to a shell.
3. **(Requires a GitHub repo)** Add an explicit `actions/checkout@v4` step to the *consuming* workflow's job, before the `Set up project` step. Confirm checkout effectively runs twice (once in the caller, once inside the composite action) without failing, since both share the same working directory.
4. **(Paper exercise)** Rewrite Section 3's `registry-token` example so the composite action tries to declare a `secrets:` block instead of an `input`. Explain specifically why GitHub Actions rejects this.
5. **(Requires a GitHub repo)** Consume the Section 1 composite action from a job with `runs-on: windows-latest` instead of `ubuntu-latest`. Confirm the whole action still runs on the Windows runner — checkout, Node setup, and the `shell: bash` step all execute there — illustrating that the action has no OS of its own; it takes whatever `runs-on` the calling job chose.

## Interview Q&A

**Q: How do you pass a secret to a composite action?**
A: There's no `secrets:` syntax for composite actions at all. The action declares the value as a regular `input`, and the calling workflow passes it through `with:`, having sourced it from `${{ secrets.NAME }}` itself.

**Q: If a composite action does its own `actions/checkout@v4` internally, whose filesystem does that check out into?**
A: The calling job's own runner and working directory — composite action steps are not isolated; they execute directly inside the job that invoked them.

**Q: Why does a `run:` step inside a composite action need an explicit `shell:`, when an ordinary job step doesn't?**
A: A composite action has no job-level `defaults:` context of its own to inherit a default shell from, so omitting `shell:` is a validation error rather than a silent fallback.

**Q: Can a composite action declare its own `runs-on` or run on a different OS than the calling job?**
A: No. A composite action has no `runs-on` key at all — it always inherits whatever runner the calling job is already using.
