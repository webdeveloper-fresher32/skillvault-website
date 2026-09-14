# Matrix Strategy Basics

A test job that needs to run against two operating systems and three Node.js versions could be written as six nearly-identical hand-copied jobs — `test-ubuntu-node18`, `test-ubuntu-node20`, and so on — each differing only in `runs-on:` and a version string, with every change to the test steps needing to be repeated in all six places. `strategy.matrix` writes the job once, parameterized with placeholders, and lets GitHub Actions fan it out into multiple parallel job runs automatically, one per combination of matrix values.

## 1. How `strategy.matrix` Fans Out a Job

A job declares `strategy.matrix` with one or more keys, each mapped to a list of values. GitHub Actions computes the cross-product of every dimension before running anything, then generates one independent job run per combination — each with its own runner, its own log, and its own pass/fail status in the checks UI.

```yaml
name: Matrix Test

on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        node-version: [18, 20, 22]
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Show combination
        run: echo "Running on ${{ matrix.os }} with Node ${{ matrix.node-version }}"

      - name: Run tests
        run: npm test
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < workflow.yml
```

Two `os` values times three `node-version` values produces 2 × 3 = 6 combinations: `(ubuntu-latest, 18)`, `(ubuntu-latest, 20)`, `(ubuntu-latest, 22)`, `(windows-latest, 18)`, `(windows-latest, 20)`, `(windows-latest, 22)`. All six run in parallel (subject to runner availability and any `max-parallel` cap, covered in lesson 3), and the checks UI lists them as distinct entries like `test (ubuntu-latest, 18)` even though they came from one job definition.

## 2. Referencing Matrix Values

Within each generated run, `${{ matrix.<key> }}` resolves to that run's specific value for that key. A run generated for `{os: windows-latest, node-version: 20}` sees `${{ matrix.os }}` as `windows-latest`; the run for `{os: ubuntu-latest, node-version: 18}` sees entirely different values for the exact same expressions in the exact same job definition.

`runs-on:` itself can — and for OS-dimensioned matrices, must — reference the matrix:

```yaml
runs-on: ${{ matrix.os }}
```

Without this, every generated combination still runs on whatever OS `runs-on:` is hardcoded to, no matter what `matrix.os` values were declared — the values get computed and substituted everywhere else, just never applied to where the job actually runs.

## 3. Combinatorial Multiplication (Why Matrices Explode)

Matrix dimensions multiply, they don't add. Adding a third dimension with 4 values to the 2×3 example above doesn't add 4 more jobs — it multiplies the existing 6 combinations by 4, producing 24 job runs.

```
os: 2 values  ─┐
               ├── 2 × 3        = 6 runs
node-version: 3 values ─┘

os: 2 values ──┐
node-version: 3 values ─┼── 2 × 3 × 4  = 24 runs
arch: 4 values ─────────┘
```

Large matrices with several dimensions can silently balloon into dozens of parallel runs, each consuming its own runner-minutes — the same runner-cost awareness Phase 3 raised when choosing `runs-on:`, just multiplied across every matrix combination instead of one job.

## Comparison

| | Six hand-written jobs | Shell loop inside one job | `strategy.matrix` |
|---|---|---|---|
| Job body written | Once per combination (6×) | Once | Once |
| Runs on different OSes per combination | Yes, but only by hand-copying `runs-on:` | No — one runner, one OS for the whole loop | Yes, via `runs-on: ${{ matrix.os }}` |
| Parallelism across combinations | Manual (separate job blocks) | None — sequential within one runner | Automatic, one runner per combination |
| Checks UI entries | One per hand-written job name | One, for the whole job | One per combination, auto-labeled |
| Editing the steps | Repeated in every copy | Once | Once |

## Common Mistakes

- **Not realizing matrix dimensions multiply combinatorially.** A third dimension doesn't add jobs, it multiplies the total — see the diagram above.
- **Typo-ing the matrix key in `${{ matrix.<key> }}`.** The key must exactly match the name used under `strategy.matrix` — `${{ matrix.nodeVersion }}` against a dimension actually named `node-version` doesn't error in many expression contexts, it silently evaluates to empty/undefined, and the failure downstream looks unrelated to the typo.
- **Forgetting `runs-on:` needs the matrix reference too.** Defining `os` as a dimension but leaving `runs-on: ubuntu-latest` hardcoded means every combination still runs on the same OS.
- **Assuming all combinations must share the same runner OS or version by default.** Nothing stops each combination from running on a different runner — that's the entire point of parameterizing `runs-on:` with `matrix.os`.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Build the Section 1 example exactly as written, push it, and confirm the checks UI shows six separate `test (...)` entries.
2. **(Requires a GitHub repo)** Add a third dimension, `arch: [x64, arm64]`, to the Section 1 matrix. Confirm the run count becomes 2 × 3 × 2 = 12, not 6 + 2 = 8.
3. **(Requires a GitHub repo)** Deliberately misspell `${{ matrix.node-version }}` as `${{ matrix.nodeVersion }}` in the "Set up Node.js" step, rerun, and observe that `setup-node` doesn't error outright but behaves as if no version was specified.
4. **(Paper exercise)** A matrix declares `browser: [chrome, firefox, safari]`, `os: [ubuntu-latest, windows-latest, macos-latest]`, and `viewport: [mobile, desktop]`. How many job runs does this generate, and why?
5. **(Requires a GitHub repo)** Remove `runs-on: ${{ matrix.os }}` and hardcode `runs-on: ubuntu-latest` instead, keeping `os: [ubuntu-latest, windows-latest]` in the matrix. Confirm both combinations still run, both on Ubuntu — demonstrating the matrix value being computed but never applied.

## Interview Q&A

**Q: You need to test a project against Node 18, 20, and 22 on both Ubuntu and Windows. How many CI jobs does that produce, and how do you set it up?**
A: One `test` job with `strategy.matrix` defining `os: [ubuntu-latest, windows-latest]` and `node-version: [18, 20, 22]`, producing 2 × 3 = 6 job runs — the cross-product is computed automatically, not written by hand.

**Q: What happens if you add a fourth Node version?**
A: The total becomes 2 × 4 = 8, not 6 + 2. Matrix growth is multiplicative, not additive, which matters directly for CI-minutes cost.

**Q: Why does `runs-on: ${{ matrix.os }}` matter instead of just hardcoding one OS?**
A: Without it, every generated combination runs on the same hardcoded OS regardless of the `os` values declared — the matrix values get substituted everywhere else in the job but never reach where it's actually scheduled.

**Q: A step references `${{ matrix.nodeVersion }}` but the matrix dimension is named `node-version`. What happens?**
A: No error in most cases — the mismatched expression silently resolves to empty/undefined, and whatever step consumes it fails or falls back to a default in a way that looks unrelated to the actual typo.
