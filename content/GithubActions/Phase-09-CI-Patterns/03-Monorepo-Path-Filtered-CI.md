# Monorepo Path-Filtered CI

A monorepo holding a dozen independent packages faces a scaling problem neither of the previous two lessons' techniques solves on its own. Phase 2, Lesson 3's `paths` filter operates at the *workflow-trigger* level: it decides whether a workflow run happens *at all*, based on whether any changed file matches a glob — coarse in exactly the way a monorepo needs fine, since `paths: ['packages/**']` fires identically whether one package changed or all twelve did. What's needed is a two-stage pattern: a detection stage that maps changed files to specific package names, followed by a dynamic matrix (Phase 6, Lesson 2) built from that detected list, so job runs are scoped to precisely the packages touched.

## 1. Detecting Changed Packages

A detection job runs first, with no matrix — it inspects the diff. It checks out the repository with enough git history to diff against (e.g. `fetch-depth: 0`) and determines which top-level package directories contain a changed file. This can be hand-rolled with `git diff --name-only` and path-prefix parsing, or delegated to a purpose-built action like `dorny/paths-filter`, which accepts a set of named path patterns and reports, per name, whether any changed file matched.

```
detect-changes job:
  git diff origin/<base>...HEAD
    → filter to paths under packages/
    → cut to top-level directory name
    → unique, sorted list: pkg-a, pkg-b, ...
```

## 2. Generating a Dynamic Matrix from Detected Changes

The detection job maps changed files to package names and serializes that list as JSON. Job outputs are always plain strings (Phase 6, Lesson 2), so a list of matched packages has to be JSON-encoded (e.g. `["pkg-a","pkg-b"]`) to survive the trip between jobs — not left as a shell array or multi-line string.

```yaml
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
```

A downstream job declares `needs: detect-changes` and builds its matrix from the detection job's output via `fromJSON()`, exactly as Phase 6, Lesson 2 covers for any dynamic matrix:

```yaml
strategy:
  matrix:
    package: ${{ fromJSON(needs.detect-changes.outputs.packages) }}
```

GitHub Actions parses that JSON string back into a real array and generates one job run per element.

## 3. Consuming the Matrix Downstream

```yaml
test-packages:
  needs: detect-changes
  if: needs.detect-changes.outputs.has-changes == 'true'
  runs-on: ubuntu-latest
  strategy:
    matrix:
      package: ${{ fromJSON(needs.detect-changes.outputs.packages) }}
  steps:
    - name: Check out code
      uses: actions/checkout@v4

    - name: Test package
      run: echo "Testing package ${{ matrix.package }}"
```

`test-packages` only runs when `has-changes` is `true`, and its `strategy.matrix.package` is built with `fromJSON(needs.detect-changes.outputs.packages)` — the dynamic-matrix mechanism from Phase 6, Lesson 2, generating one job run per detected package name.

## 4. The Zero-Packages-Changed Edge Case

If the diff touches only files outside every tracked package (root-level config, documentation, CI files themselves), the detected list is legitimately empty — `[]` — and that has to be a valid, anticipated output, not an accident the rest of the pipeline chokes on. An empty detected-package list produces a matrix with zero elements, which produces zero job runs — silently, with no failure. This mirrors the same "silence, not error" behavior Phase 2, Lesson 3 describes for a `paths`-filtered trigger that never fires: nothing runs, nothing is reported as failed, and if that downstream job's name happens to be a required status check, the PR is left waiting on a check that will never post a result.

The fix mirrors Phase 2's fix pattern: make the "nothing to test" case an explicit, reported outcome. A common approach is an `if:` condition on the downstream job (or a guard step within it) that checks whether the detected list is empty and, if so, runs a trivial no-op step that still reports success:

```yaml
no-changes:
  needs: detect-changes
  if: needs.detect-changes.outputs.has-changes == 'false'
  runs-on: ubuntu-latest
  steps:
    - name: Report no packages affected
      run: echo "No package changes detected — nothing to test."
```

## 5. The Complete Workflow

The full chain: detect changed packages, branch on empty-vs-non-empty, feed a JSON list into a downstream job's dynamic matrix (per Phase 6, Lesson 2), with the empty-matrix case handled explicitly.

```yaml
name: Monorepo Path-Filtered CI

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
          # List package directories with any file changed vs. the PR base.
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
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: ${{ fromJSON(needs.detect-changes.outputs.packages) }}
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Test package
        run: echo "Testing package ${{ matrix.package }}"

  no-changes:
    needs: detect-changes
    if: needs.detect-changes.outputs.has-changes == 'false'
    runs-on: ubuntu-latest
    steps:
      - name: Report no packages affected
        run: echo "No package changes detected — nothing to test."
```

This YAML was parsed with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())"` and loads cleanly as a single well-formed document.

Walking through the full chain: `detect-changes` diffs the PR's head against its base ref, isolates changed paths under `packages/`, and reduces them to unique top-level directory names. It branches on whether that list is empty — an empty diff writes `packages=[]` and `has-changes=false`; a non-empty diff builds a proper JSON array with `jq` and writes both `packages` and `has-changes=true`. Both outputs are declared under the job's `outputs:` block so `test-packages` and `no-changes` can read them via `needs.detect-changes.outputs.*`. `test-packages` only runs when `has-changes` is `true`, and its matrix is populated with `fromJSON()`, generating one job run per detected package name and none at all if the array were somehow empty and this `if:` guard weren't present. `no-changes` is the explicit complement: it only runs when `has-changes` is `false`, guaranteeing that *some* job always reports a result on every PR touching this workflow — if `no-changes`'s name (or a check spanning both jobs) is what's marked required in branch protection, a documentation-only PR still gets a fast, real "success" rather than a required check that never posts anything.

## Comparison

| | Workflow-level `paths` filter (Phase 2, Lesson 3) | Detection job + dynamic matrix |
|---|---|---|
| Scope of decision | Whole workflow: run or don't | Individual package, inside the workflow |
| One package changed of twelve | Runs everything under `packages/` (or nothing, if scoped too narrowly) | Only the matrix entries for changed packages |
| Structurally capable of per-package scoping | No | Yes |

| | Hand-rolled `git diff` detection | `dorny/paths-filter` |
|---|---|---|
| Control | Full control over path-to-package mapping logic | Declarative `filters:` (name → glob) |
| Effort | More code to write and maintain | Less code for the common case |
| Output | Custom JSON built with `jq` | Ready-made per-filter boolean/list output |

| | Phase 6, Lesson 2's dynamic matrix | This lesson's dynamic matrix |
|---|---|---|
| Mechanism | `needs:`, JSON via `$GITHUB_OUTPUT`, `fromJSON()` in `strategy.matrix` | Identical mechanism |
| Source of the JSON list | Generic / example-driven | A monorepo's changed-package detection |
| Empty-list handling | Not dwelt on | Explicit (Section 4) |

## Common Mistakes

- **Relying on a workflow-level `paths` filter alone to scope a monorepo's CI.** `paths: ['packages/**']` (or even one glob per package) either runs the whole filtered set of jobs for any matching change anywhere under that prefix, or requires a separate workflow file per package to get real per-package scoping — neither approximates "run only for the packages actually touched" the way a detection-plus-matrix step does within a single workflow.
- **Not handling the case where no tracked package changed.** An empty detected-package array fed straight into `strategy.matrix` with no guard produces a job with zero runs — which silently reports nothing, and if that job's name is a required status check, leaves the PR waiting on a check that can never post a result, the same trap Phase 2, Lesson 3 describes for a `paths`-filtered required check.
- **Forgetting `fetch-depth: 0` (or an equivalent full-history checkout) before diffing.** `actions/checkout`'s default shallow clone often doesn't contain the commits needed to diff correctly against a PR's base ref, producing an empty or wrong changed-file list even when real changes exist.
- **Writing the changed-package list as a plain shell string instead of valid JSON before handing it to `fromJSON()`.** `fromJSON()` requires an actual JSON array string; a value like `packages=pkg-a pkg-b` (space-separated, not JSON) either fails to parse or gets treated as one nonsensical single-element "array," silently producing the wrong matrix.
- **Marking the detection job itself, rather than the downstream test job, as the required status check.** The detection job can succeed (it always runs) even when the meaningful outcome — whether every affected package's tests actually passed — lives in the downstream matrix job; a required check pointed at the wrong job reports green regardless of whether any package's tests failed.

## Hands-On Exercises

1. Create the workflow from Section 5 in a monorepo with at least two directories under `packages/`, open a PR that changes a file in exactly one package, and confirm `test-packages` runs with a matrix of exactly one entry (check the job list in the Actions UI).
2. (Prerequisite: Exercise 1's workflow merged into the default branch, so it's already present for the base ref) Open a second PR that changes only the root `README.md`, and confirm `detect-changes` sets `has-changes=false`, `test-packages` is skipped entirely (not failed — skipped), and `no-changes` runs and reports success.
3. (Prerequisite: workflow from Section 5 committed, `dorny/paths-filter` installed as an alternative step) Rewrite the `detect-changes` step to use `dorny/paths-filter` with one named filter per package directory instead of the hand-rolled `git diff`, and confirm the resulting `packages` JSON output matches what the hand-rolled version produced for the same PR.
4. Deliberately edit the detection step to output `packages=pkg-a pkg-b` (space-separated, not JSON) instead of a JSON array, push, and confirm `fromJSON()` in `test-packages` fails the job — direct proof of the "plain shell string vs. JSON" mistake.
5. Validate the workflow YAML from Section 5 independently: `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < .github/workflows/monorepo-ci.yml`.

## Interview Q&A

**Q: How would you scope CI in a monorepo so a PR touching one package doesn't run tests for all twelve?**
A: A two-stage pattern: a detection job that diffs changed files and maps them to package names, followed by a matrix job whose `strategy.matrix` is populated from that detection job's JSON output via `fromJSON()`. This differs from a workflow-level `paths` filter (Phase 2, Lesson 3), which can only gate the whole workflow, not scope individual matrix entries.

**Q: What happens if a PR only touches the root README — no package changed at all?**
A: The detected-package list is legitimately empty. An unguarded empty matrix produces zero job runs with no failure, and if the corresponding job name is a required status check, the PR is stuck waiting on a check that will never report. The fix is an explicit `if:`-guarded fallback job (like `no-changes`) that always reports a result.

**Q: Why does the detected-package list need to be JSON, not just a space-separated shell string?**
A: `fromJSON()` in `strategy.matrix` requires an actual JSON array string to parse back into a real array — job outputs are always plain strings (Phase 6, Lesson 2), so a shell-native list format like `pkg-a pkg-b` either fails to parse or gets misread as a single nonsensical element instead of generating one matrix entry per package.

**Q: Why mark `test-packages` (not `detect-changes`) as the required status check?**
A: `detect-changes` always succeeds once it runs — it just computes a list. The actual outcome that matters, whether every affected package's tests passed, lives in `test-packages`. Requiring the detection job instead would report green regardless of any package's real test results.
