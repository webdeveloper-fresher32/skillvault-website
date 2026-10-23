# Uses vs Run and the Step Model

Every step in a job is either a `uses` step (invoke a packaged action) or a `run` step (execute a shell command) — never both. Getting this distinction wrong produces schema errors, and misunderstanding what state survives between steps is the single most common source of "why did my variable disappear" bugs in a first real pipeline.

## 1. `uses` vs `run`

GitHub Actions decides what a step does by checking which key is present. They are mutually exclusive within a single step — you never combine both in the same step block.

| | `uses` | `run` |
|---|---|---|
| Invokes | A pre-built, packaged action | A raw shell command |
| Configured via | `with:` (a map of inputs) | Not configurable via `with:` — just the command itself |
| Analogy | Using a rice cooker — someone else's packaged appliance | Personally chopping the onions — raw manual work |
| Example | `uses: actions/checkout@v4` | `run: npm install` |

```yaml
steps:
  - name: Check out repository
    uses: actions/checkout@v4          # uses: a packaged action

  - name: Install dependencies
    run: npm install                   # run: a raw shell command
```

## 2. Reference Forms for `uses`

A `uses:` value can point to an action in three different forms:

```yaml
steps:
  - uses: actions/checkout@v4          # owner/repo@ref — published to GitHub
  - uses: ./path/to/local-action       # an action defined inside your own repo
  - uses: docker://alpine:3.19         # a Docker image run directly as the action
```

For `owner/repo@ref`, `ref` can be a tag, branch, or commit SHA. GitHub downloads/resolves that action's code (or image) and executes its defined logic, optionally configured via a `with:` map of inputs.

## 3. How a `run` Step Executes

By default, GitHub Actions launches a *new shell process* for every `run` step — `bash` on Linux/macOS runners, `pwsh` on Windows, configurable via `shell:`. The command runs, and that process exits before the next step begins.

```yaml
- name: Record a value for later steps
  id: version_step
  run: |
    NODE_VERSION=$(node -v)
    echo "node_version=$NODE_VERSION" >> "$GITHUB_OUTPUT"
```

A multi-line `run:` block using `|` (the literal block scalar from Lesson 01) executes each line as a separate command in sequence, within that one shell process.

## 4. Filesystem State Persists, Shell State Does Not

All steps in a job run on the same disk/checkout, so files created or modified by one step are still there for the next step. Shell/environment state is different: because each `run` step is a fresh process, a plain `export FOO=bar` in one step has no effect on the next step's process — that new process starts with no memory of the previous one's exports, `cd` location, or variables.

```
Step 1 (run, new shell)          Step 2 (run, new shell)
  export FOO=bar        ────X    echo $FOO   → empty
  echo "x" > file.txt    ───────▶ cat file.txt → "x"   (filesystem persists)
```

## 5. Passing Data Forward on Purpose

To deliberately carry a value from one step into a later one, write to one of GitHub's special files instead of relying on shell state:

| Mechanism | Write to | Read via |
|---|---|---|
| Environment variable for later steps | `$GITHUB_ENV` (append `KEY=value`) | Plain `$KEY` in later `run` steps |
| Step output for other steps/jobs | `$GITHUB_OUTPUT` (append `key=value`) | `${{ steps.<id>.outputs.<name> }}` |

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm install

      - name: Record a value for later steps
        id: version_step
        run: |
          NODE_VERSION=$(node -v)
          echo "node_version=$NODE_VERSION" >> "$GITHUB_OUTPUT"

      - name: Use the value from an earlier step
        run: echo "Tests will run on Node ${{ steps.version_step.outputs.node_version }}"

      - name: Run tests
        run: npm test
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < node-ci.yml
```

`${{ steps.<id>.outputs.<name> }}` only resolves if the producing step was given an `id:` — without it, there's nothing to reference by.

## Comparison

| Scenario | Survives to next `run` step? | Why |
|---|---|---|
| File written to disk | Yes | All steps share the same runner filesystem |
| `export FOO=bar` in a previous step | No | Each `run` step is a brand-new shell process |
| Value written to `$GITHUB_ENV` | Yes (as an env var) | GitHub re-injects it into subsequent steps' environments |
| Value written to `$GITHUB_OUTPUT` with `id:` set | Yes (via `${{ steps.<id>.outputs.<name> }}` expression) | GitHub records it against the step's id for later reference |

This lesson builds directly on Lesson 02: `steps` is the list you saw under a job, and this lesson is entirely about what a single list *item* (a step) can contain. Later phases (especially the one on Actions and Reusable Workflows) go deeper into *writing* your own custom actions — this lesson only covers *consuming* an action via `uses`, which is the far more common day-to-day skill.

## Common Mistakes

- **Adding `with:` to a `run` step** — `with:` only configures a `uses:` action's declared inputs; a `run` step has no inputs to configure this way, and this combination is a schema error.
- **Adding `run:` and `uses:` to the same step** — a step must pick exactly one; you cannot both invoke a packaged action and run a shell command in one step block.
- **Assuming shell variables survive between `run` steps** — e.g., `export TOKEN=abc123` in one step, then reading `$TOKEN` in the next `run` step and finding it empty, because each step is a brand-new shell process.
- **Forgetting the `id:` field when trying to reference a step's output** — `${{ steps.<id>.outputs.<name> }}` only works if the producing step was given an `id:`.
- **Pinning `uses:` to a mutable tag like `@main` or `@latest`** in anything beyond a personal experiment — this can silently change behavior when the upstream action publishes a new version, unlike pinning to a specific version tag or commit SHA.

## Hands-On Exercises

1. Save the full example from section 5 as `node-ci.yml` and validate it with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < node-ci.yml`.
2. Add a `with:` block under a `run:` step and run `actionlint node-ci.yml` — observe the schema error it reports.
3. Add both `uses:` and `run:` to the same step block and re-lint — observe the same class of error.
4. Locally simulate the workflow with `act push -W node-ci.yml` (requires Docker) and confirm the `node_version` output prints correctly in the final steps.
5. Use `gh run view <run-id> --log` after a real push to inspect how `uses` steps and `run` steps appear differently in the run log.

## Interview Q&A

**Q: Two consecutive `run` steps — one exports an environment variable, the next tries to read it. Does it work?**
A: No — each `run` step is an independent shell process, so a plain `export` in one step has no effect on the next. The correct fix is writing the value to `$GITHUB_ENV` (for an env var) or `$GITHUB_OUTPUT` (for a step output referenced via `${{ steps.<id>.outputs.<name> }}`).

**Q: When would you write a custom `run` command instead of using an existing action, and vice versa?**
A: Use an existing action when the task is common enough to be covered by a community-maintained, versioned, tested action (e.g., checkout, setup-node). Write a plain `run` command when it's simple enough — a one-line shell command isn't worth wrapping in an action.

**Q: What three forms can a `uses:` reference take?**
A: `owner/repo@ref` for an action published to GitHub, `./path/to/local-action` for an action defined in your own repo, and `docker://image:tag` for a Docker image run directly as the action's implementation.

**Q: Why shouldn't you pin `uses:` to `@main` or `@latest` in production?**
A: A mutable tag can silently change behavior whenever the upstream action publishes a new version. Pinning to a specific version tag or commit SHA keeps behavior stable and reproducible.

**Q: Can a single step have both `uses:` and `run:`?**
A: No — GitHub Actions treats them as mutually exclusive per step; a step must be either a `uses` step or a `run` step, never both.
