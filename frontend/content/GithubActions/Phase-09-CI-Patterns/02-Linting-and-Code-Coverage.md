# Linting and Code Coverage

The previous lesson's pipeline runs one job that installs dependencies and then runs tests. A real project usually wants more feedback than "did the tests pass" — a linter to catch style and correctness issues, and a coverage number to catch code nobody's actually testing at all. The naive way to add both is to bolt them onto the same job as extra steps after `npm test`, but that throws away something Phase 3 already established: independent jobs in the same workflow run in parallel by default.

## 1. Running Lint as a Parallel Job

Linting and testing don't depend on each other's output. Declaring two jobs in the same workflow, both triggered by the same event, with neither in the other's `needs:`, means GitHub Actions starts both the moment a runner is available for each — rather than one waiting on the other.

```
on: pull_request
        ├── lint            (own checkout + setup, runs eslint/flake8/etc.)
        └── test-with-coverage  (own checkout + setup, runs tests + coverage)
```

The `lint` job runs the linter as its own command (`eslint .`, `flake8`, `golangci-lint run`, etc.) inside its own checkout-and-setup steps — it needs the same runtime setup as the test job, but nothing from the test job's output, which is exactly why no `needs:` points at it.

## 2. Generating Code Coverage

The `test` (or `test-with-coverage`) job runs the test suite with coverage instrumentation turned on. Most test runners support this via a flag or companion tool:

| Ecosystem | Coverage invocation |
|---|---|
| Node.js (Jest) | `npm test -- --coverage` |
| Python | `pytest --cov` |
| Go | `go test -coverprofile=...` |

This produces both the normal pass/fail result and a coverage report file (commonly HTML, LCOV, or XML) as a side effect of the same run — not a separate step.

## 3. Uploading Coverage as an Artifact

The coverage report is uploaded as a build artifact via `actions/upload-artifact@v4` (Phase 5, Lesson 1), making the detailed report downloadable from the run's summary page — useful for a human who wants to see exactly which lines went uncovered, beyond just the headline percentage.

```yaml
- name: Upload coverage report
  uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: coverage/
    retention-days: 14
```

Some teams instead (or additionally) use a coverage-comment action that posts the summary directly onto the pull request, so the number is visible without anyone opening the Actions tab at all.

## 4. Setting a Coverage Threshold

The test command (or a dedicated coverage-checking step) enforces a minimum threshold and fails if not met — a tool-native option like `pytest --cov --cov-fail-under=80`, a coverage tool's own `--check-threshold` flag, or a script that parses the report and exits non-zero below the bar. GitHub Actions itself doesn't understand coverage percentages; the job simply fails like any other step whose command exits non-zero.

## 5. A Complete Parallel Lint + Coverage Workflow

Both jobs report their own status independently, and both can be marked as separate required status checks in branch protection — a lint failure and a coverage-threshold failure block a merge independently of each other, and independently of whether the other job passed.

```yaml
name: Lint and Coverage

on:
  pull_request:
    branches:
      - main

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.11.1'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

  test-with-coverage:
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.11.1'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm test -- --coverage --coverageThreshold='{"global":{"lines":80}}'

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 14
```

This YAML was parsed with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())"` and loads cleanly as a single well-formed document.

`lint` and `test-with-coverage` share no `needs:` relationship, so GitHub Actions schedules both the moment the workflow triggers — a lint failure is visible in however long `npm run lint` takes, without waiting on the (typically slower) test-and-coverage job to finish first. `npm test -- --coverage --coverageThreshold=...` is Jest's own mechanism for both generating a coverage report and failing the command's own exit code if the measured percentage falls under the configured `80` — that failure propagates to the step, then the job, then the job's reported status, exactly like a failing test would. `actions/upload-artifact@v4` then persists the `coverage/` directory as a downloadable artifact on the run, independent of whether the threshold check passed or failed — a reviewer can open it to see exactly which lines are uncovered even on a run where the threshold check itself failed.

## Comparison

| | Two parallel jobs (`lint`, `test-with-coverage`) | One sequential job (lint then test) |
|---|---|---|
| Feedback speed | Each result reported as soon as that check finishes | Fast lint result stuck behind slower test run |
| Setup cost | Duplicated checkout/setup/install per job | Paid once |
| Filesystem/state sharing | None needed — jobs don't share state (Phase 3) | N/A, single job |

| | Uploaded artifact | Coverage-comment action |
|---|---|---|
| Visibility | Requires opening Actions tab, downloading file | Percentage (often diff-relative) posted directly on PR |
| Detail level | Full line-by-line report | Usually summary only |
| Mutually exclusive? | No — commonly used together | No — commonly used together |

| | Coverage threshold enforced | No threshold |
|---|---|---|
| Nature of the number | Actual CI gate | Informational only |
| Blocks a coverage-tanking PR | Yes | No |

## Common Mistakes

- **Running lint and test sequentially in one job when they're independent.** Bundling `npm run lint && npm test` into a single job's steps means a fast lint failure still has to wait for the whole job to be reported — splitting them into two jobs with no `needs:` between them lets GitHub Actions run and report both as soon as each is actually done.
- **Setting a coverage threshold that doesn't match the project's actual baseline.** A threshold set above the project's real current coverage (e.g. requiring 90% on a codebase sitting at 62%) fails every single PR regardless of what that PR actually changes; a threshold set well below the baseline never fails anything and provides no real signal at all.
- **Generating a coverage report without ever enforcing a threshold against it.** A report that only gets uploaded as an artifact or posted as a comment is purely informational — nothing stops a PR that guts coverage from merging anyway unless a step's exit code actually fails when the number drops below the bar.
- **Duplicating the same checkout/setup/install steps across every parallel job without noticing the wasted time.** Each independent job pays its own setup cost since jobs share no filesystem state (Phase 3); relying on `setup-*`'s caching (Phase 5) keeps that repeated cost small.
- **Uploading the entire working directory as the coverage artifact instead of just the report directory.** An `upload-artifact` step with `path: .` instead of `path: coverage/` bloats the artifact with the full checkout and any build output, slowing the upload and burning storage quota for no benefit.

## Hands-On Exercises

1. Create the workflow from Section 5 in a repo with `eslint` and Jest configured, open a PR, and confirm `lint` and `test-with-coverage` both start immediately (check each job's start timestamp in the Actions UI) rather than one waiting on the other.
2. (Prerequisite: Exercise 1's workflow committed) Introduce a lint error and a failing test in the same PR — confirm both `lint` and `test-with-coverage` report failure independently, and that fixing only the lint error still leaves `test-with-coverage` red.
3. Lower `coverageThreshold` from `80` to a value below the project's actual current coverage, push, and confirm `test-with-coverage` now passes — then restore it, demonstrating how threshold mismatch changes the check's signal.
4. Download the `coverage-report` artifact from a completed run and open its HTML report — confirm it shows line-by-line coverage detail beyond the summary percentage.
5. Validate the workflow YAML from Section 5 independently: `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < .github/workflows/lint-coverage.yml`.

## Interview Q&A

**Q: You have a linter and a test suite in CI — how would you structure the jobs, and why?**
A: Two independent jobs with no `needs:` between them, so GitHub Actions schedules them in parallel and the linter's typically-fast result is reported without waiting on the slower test run. Bundling both into one sequential job's steps is a common but avoidable mistake that delays feedback for no benefit, since neither depends on the other's output.

**Q: Your coverage threshold is 90% and it's blocking every PR — what's wrong?**
A: The threshold was set aspirationally rather than pulled from the project's actual current coverage number, turning a would-be quality gate into a blanket failure that teaches developers to ignore or override the check rather than trust it.

**Q: What's the difference between generating a coverage report and enforcing a coverage threshold?**
A: Generating a report just produces a number for humans to look at; enforcing a threshold (e.g. `--cov-fail-under=80`) makes the test command's own exit code fail when coverage drops below the bar, turning the number into an actual CI gate rather than informational output.

**Q: Why upload the coverage report as an artifact if the threshold check already fails the build?**
A: The threshold check only tells you pass/fail on the aggregate number; the uploaded artifact lets a reviewer open the full line-by-line report to see exactly which lines are uncovered, which the pass/fail signal alone doesn't show.
