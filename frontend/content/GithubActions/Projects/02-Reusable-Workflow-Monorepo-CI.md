# Reusable Workflow Monorepo CI — Detect, Matrix, Delegate

## Problem Statement

A monorepo holds several independent packages under `packages/` (say, `pkg-a`, `pkg-b`, `pkg-c`). A pull request should:

1. Detect exactly which packages have a changed file — not "something under `packages/`," but the specific package names.
2. Run one test job per changed package, and none at all for packages nobody touched.
3. Have each of those per-package test jobs actually run the *same* shared test logic — checkout, set up Node.js, install, test — defined and maintained in exactly one place, not copy-pasted once per package.

Phase 9, Lesson 3 solved detection-plus-dynamic-matrix on its own. Phase 7, Lesson 1 solved "define a job once, call it from elsewhere" on its own. Neither phase's lesson combined them: Phase 9's example matrix ran an inline `echo` step per package, and Phase 7's example caller called a reusable workflow exactly once, with no matrix at all. This project combines them — the matrix generates one *call* per changed package, not one inline job body per package.

## Approach Discussion

Three patterns, three distinct jobs:

- **Detection (Phase 9, Lesson 3).** A `detect-changes` job diffs the PR against its base ref, isolates changed paths under `packages/`, reduces them to unique package names, and writes a JSON array to its own `$GITHUB_OUTPUT` — plus an explicit `has-changes` boolean, so an empty result is a reported outcome rather than a silently-vanishing job.
- **Dynamic matrix (Phase 6, Lesson 2).** `test-packages` builds `strategy.matrix.package` from `fromJSON(needs.detect-changes.outputs.packages)`, generating one job run per detected package name and zero if the array is empty — guarded by `if: needs.detect-changes.outputs.has-changes == 'true'` so an empty matrix never gets a chance to leave a required check stuck pending.
- **Reusable workflow (Phase 7, Lesson 1).** Each matrix entry's job body is not its own inline `steps:` — it's `uses: ./.github/workflows/test-package.yml`, a callee declaring `on: workflow_call` with a single typed input (`package-name`). Phase 7, Lesson 1's common-mistakes section notes that GitHub Actions does support combining `strategy.matrix` with a job-level `uses:` call — this project is exactly that combination: the matrix decides *how many* calls happen and with *what input*, while the reusable workflow decides *what actually runs* inside each one.

The reason this needs all three, not two: detection-plus-matrix alone (Phase 9, Lesson 3, as written) still puts the actual test steps inline in the caller, so any future change to "how a package gets tested" means editing the caller workflow directly. Reusable-workflow-alone (Phase 7, Lesson 1, as written) calls the callee exactly once, with no way to fan out over a variable, PR-specific list of changed packages. Only the combination — a matrix of `uses:` calls, each with a different `package-name` input — gets both "scoped to exactly what changed" and "one maintained implementation" at the same time.

## Solution

Caller workflow, `.github/workflows/monorepo-ci.yml`:

```yaml
name: Monorepo CI

on:
  pull_request:
    branches:
      - main

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      packages: ${{ steps.detect.outputs.packages }}
      has-changes: ${{ steps.detect.outputs.has-changes }}
    steps:
      - name: Check out code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect changed packages
        id: detect
        run: |
          changed=$(git diff --name-only origin/${{ github.base_ref }}...HEAD \
            | grep '^packages/' \
            | cut -d/ -f2 \
            | sort -u)

          if [ -z "$changed" ]; then
            echo 'packages=[]' >> "$GITHUB_OUTPUT"
            echo 'has-changes=false' >> "$GITHUB_OUTPUT"
          else
            json=$(printf '%s\n' "$changed" | jq -R . | jq -sc .)
            echo "packages=$json" >> "$GITHUB_OUTPUT"
            echo 'has-changes=true' >> "$GITHUB_OUTPUT"
          fi

  test-packages:
    needs: detect-changes
    if: needs.detect-changes.outputs.has-changes == 'true'
    strategy:
      matrix:
        package: ${{ fromJSON(needs.detect-changes.outputs.packages) }}
    uses: ./.github/workflows/test-package.yml
    with:
      package-name: ${{ matrix.package }}

  no-changes:
    needs: detect-changes
    if: needs.detect-changes.outputs.has-changes == 'false'
    runs-on: ubuntu-latest
    steps:
      - name: Report no packages affected
        run: echo "No package changes detected — nothing to test."
```

Reusable callee, `.github/workflows/test-package.yml`:

```yaml
name: Test Package (Reusable)

on:
  workflow_call:
    inputs:
      package-name:
        description: "Name of the package under packages/ to test"
        type: string
        required: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20.11.1"
          cache: npm
          cache-dependency-path: packages/${{ inputs.package-name }}/package-lock.json

      - name: Install dependencies
        working-directory: packages/${{ inputs.package-name }}
        run: npm ci

      - name: Run tests
        working-directory: packages/${{ inputs.package-name }}
        run: npm test
```

Both files were validated independently:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < monorepo-ci.yml
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < test-package.yml
```

and each loads cleanly as a single well-formed document.

Walking through the chain: `detect-changes` is unchanged from Phase 9, Lesson 3 — it diffs the PR against its base ref and writes both `packages` (a JSON array, possibly empty) and `has-changes` to its own outputs. `test-packages` is the piece that differs from Phase 9's original example: instead of an inline `steps:` list with an `echo` placeholder, its job body *is* `uses: ./.github/workflows/test-package.yml`, and `strategy.matrix.package` supplies one distinct `matrix.package` value per detected name — each matrix entry becomes its own call into the reusable workflow, with `with: package-name: ${{ matrix.package }}` passing that entry's specific package name through the callee's typed `inputs.package-name` contract. `test-package.yml` never runs on its own — its only trigger is `workflow_call` — and its steps are entirely generic: `working-directory: packages/${{ inputs.package-name }}` is the only thing that varies per call, so the same file tests `pkg-a`, `pkg-b`, or any future `pkg-d` with zero changes to the file itself. `no-changes` is Phase 9's fallback, unchanged: it guarantees some job always reports a result even on a documentation-only PR.

## Trade-offs and Considerations

- **A shared reusable workflow reduces duplication risk in a way copy-pasted per-package CI cannot.** With `test-package.yml` defined once, fixing a bug (say, a wrong cache path, or an outdated Node version) is a one-file change that every package's test run picks up on its next PR. A copy-pasted alternative — one `steps:` block hand-duplicated per package, or even per matrix entry inline — means the same fix has to be applied N times, and Phase 7, Lesson 1's original problem statement names exactly this failure mode: "someone fixes a bug in one copy, forgets the other three, and six months later nobody can say which copy is 'the real one.'" The reusable-workflow version structurally cannot drift between packages, because there is only one file to drift.
- **Centralizing the test logic concentrates risk as much as it reduces duplication — Phase 12, Lesson 3's governance lesson applies even at monorepo scale.** A change to `test-package.yml` that breaks something (a typo in `working-directory`, a Node version bump that isn't actually compatible yet) now affects every package's CI simultaneously, not just one. Phase 12, Lesson 3 makes this trade-off explicit for org-wide shared workflows and it holds just as much for a single repository's internal reusable workflow: the fix is treating `test-package.yml` itself with real change-management discipline — a reviewed PR before merging changes to it, rather than treating it as a lower-stakes file just because it's "just CI config."
- **This project references the callee with a same-repository relative path (`./.github/workflows/test-package.yml`), which sidesteps versioning entirely** — there's no `@v1`/`@main` ref to choose, because both files live in the same commit and always move together. That convenience disappears the moment `test-package.yml` is extracted into a separate, org-shared repository (the shape Phase 12, Lesson 3 describes): at that point it needs the same tagged-release discipline as any published reusable workflow, because an unpinned `@main` reference on a cross-repo callee means a breaking change to the shared workflow can silently break every consumer's CI at once, with no version bump for any team to notice or react to.
- **Cost scales with the number of *changed* packages, not the number of packages in the repository**, which is the entire point of combining detection with the matrix rather than simply running all packages' tests on every PR. A twelve-package monorepo where a PR touches one package runs one `test-package.yml` call, not twelve — the trade-off is the added complexity of a detection step and JSON-encoding discipline (Phase 9, Lesson 3's common mistake: writing the changed list as a plain string instead of valid JSON silently breaks `fromJSON()`), which a simpler "just test everything every time" pipeline would avoid at the cost of wasted runner-minutes on every PR, no matter how small.
