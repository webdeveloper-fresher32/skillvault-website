# Include, Exclude, and Dynamic Matrices

A plain `strategy.matrix` cross-product always tests every combination of every declared dimension, which breaks down in three ways: some combinations don't apply (a project might not support Node 16 on Windows), some extra one-off combinations are needed that aren't part of any clean cross-product, and sometimes the values to test aren't known until the workflow runs at all. `matrix.exclude` removes unwanted combinations, `matrix.include` adds extra ones (merging into an existing run or creating a new standalone one, depending on a specific rule), and `fromJSON()` builds a matrix dimension from a prior job's runtime output.

## 1. `matrix.exclude`

GitHub Actions first computes the full cross-product of the declared dimensions, exactly as in lesson 1. Each entry under `matrix.exclude` is then compared against every generated combination — it doesn't need to specify every dimension, only enough key/value pairs to identify what to remove. Any combination matching *all* the key/value pairs in an exclude entry is dropped before any jobs are generated.

```yaml
name: Matrix with Exclude

on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [16, 18, 20]
        exclude:
          # This project's Node 16 build tooling doesn't support Windows.
          - os: windows-latest
            node-version: 16
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Run tests
        run: npm test
```

A partial exclude — only `os: windows-latest`, no version specified — would remove every combination with that `os` value, regardless of what the other dimensions are, so scope exclude entries as narrowly as the actual incompatibility requires.

## 2. `matrix.include` — the Merge Case

Each entry under `matrix.include` is checked against the matrix's existing combinations (after excludes have already been applied), looking at the entry's keys that overlap with declared dimension keys (e.g. `os`, `node-version`). If every one of those overlapping keys in the include entry has a value matching an existing combination, that entry's *other* key/value pairs are merged into that matching combination — added as extra data without changing the combination's original dimension values. An include entry with no dimension-overlapping keys at all is treated as matching every existing combination.

```yaml
        include:
          # os + node-version BOTH match an existing combination (ubuntu-latest, 18):
          # "experimental: true" is merged onto that one combination only.
          - os: ubuntu-latest
            node-version: 18
            experimental: true
```

Given a base matrix of `os: [ubuntu-latest, windows-latest]` and `node-version: [18, 20]`, the cross-product is `{ubuntu-latest,18}`, `{ubuntu-latest,20}`, `{windows-latest,18}`, `{windows-latest,20}` — four runs. This include entry's `os` and `node-version` values both match the existing `{ubuntu-latest, 18}` combination exactly, so `experimental: true` merges into *that one run only*; the other three runs never see an `experimental` key at all.

## 3. `matrix.include` — the New-Combination Case

If an include entry's dimension-overlapping key values don't match any existing combination — for example, an `os` value that was never in the original `os` list — there's nothing to merge into, so GitHub Actions creates a brand-new, standalone combination containing only the keys and values that entry defines.

```yaml
name: Matrix with Include

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
        node-version: [18, 20]
        include:
          # os + node-version BOTH match an existing combination (ubuntu-latest, 18):
          # "experimental: true" is merged onto that one combination only.
          - os: ubuntu-latest
            node-version: 18
            experimental: true

          # os value "macos-latest" matches nothing in the declared os list:
          # this becomes a brand-new, standalone combination instead.
          - os: macos-latest
            node-version: 22
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Run tests
        run: npm test
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < workflow.yml
```

The second include entry specifies `os: macos-latest`, which never appears in the declared `os: [ubuntu-latest, windows-latest]` list. Since there's no combination to match against, GitHub Actions adds it as a fifth, standalone job run consisting of exactly `{os: macos-latest, node-version: 22}` — nothing more, no keys inherited from any other combination. This is the single most commonly misunderstood piece of matrix behavior: whether an include entry merges or creates new depends on whether its overlapping key's *value* matches something already generated, not on whether the *key name* already exists in the matrix. Include entries are also applied in the order listed, and a later entry's merged-in values can overwrite values added by an earlier include entry on the same combination — but never the matrix's original dimension-defined values.

## 4. Dynamic Matrices via `fromJSON()`

A monorepo with a dozen packages doesn't want a hardcoded `package: [pkg-a, pkg-b, pkg-c, ...]` list that someone has to remember to update — it wants the matrix built from whatever a prior job discovers is actually changed in this run. An earlier job computes a list at runtime and writes it as a JSON string to `$GITHUB_OUTPUT` (job outputs are always strings, never native lists or objects). A later job declares `needs: <earlier-job>` and wraps that output reference in `fromJSON()` inside `strategy.matrix`, because `matrix.<key>` needs an actual parsed list to iterate over, not a string that merely looks like one.

```yaml
name: Dynamic Matrix from Changed Packages

on:
  push:
    branches:
      - main

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      packages: ${{ steps.detect.outputs.packages }}
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Detect changed packages
        id: detect
        run: |
          # In a real workflow this would diff against the previous commit;
          # hardcoded here to keep the example self-contained.
          echo 'packages=["pkg-a", "pkg-b"]' >> "$GITHUB_OUTPUT"

  test-packages:
    needs: detect-changes
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

`detect-changes` writes a JSON array as a string to `$GITHUB_OUTPUT`; `test-packages` declares `needs: detect-changes` so that output exists by the time it runs, and `fromJSON()` parses the string `["pkg-a", "pkg-b"]` back into a real two-element array for `matrix.package` to iterate — producing one job run for `pkg-a` and one for `pkg-b`, with no package list ever hardcoded in the workflow file.

## Comparison

| | `exclude` | `include` (merge case) | `include` (new-combination case) | `fromJSON()` dynamic matrix |
|---|---|---|---|---|
| Effect on combination count | Only removes | No change in count | Adds one new run | Determined entirely at runtime |
| Can it remove combinations? | Yes | No | No | N/A |
| Can it add combinations? | No | No (merges into existing) | Yes | Yes, driven by list length |
| Trigger condition | Key/value pairs match an existing combination | Overlapping keys' values match an existing combination | Overlapping keys' values match nothing existing | A prior job's output exists and is parsed |
| Values known at | Commit time (in the workflow file) | Commit time | Commit time | Runtime (from `needs.<job>.outputs`) |

## Common Mistakes

- **Assuming an `include` entry with a brand-new key merges into every combination.** Only true when the entry has *no keys overlapping any existing matrix dimension*. The moment it references a dimension key with a value matching existing combinations, it merges only into the matching one(s) — and a non-matching dimension value doesn't "get added to everything" either, it becomes an isolated new run. The merge-vs-new outcome must be reasoned through per entry.
- **Forgetting `fromJSON()` when consuming a prior job's output for a matrix.** `needs.<job>.outputs.<name>` is always a plain string, even if it looks exactly like `["a", "b"]`. Without `fromJSON()`, `matrix.<key>` receives the literal string, not a list, and the matrix fails to expand or expands into one nonsensical "combination."
- **Writing an `exclude` entry with a typo'd or mismatched value.** Excluding `node-version: 17` when the matrix only defines `16, 18, 20` silently excludes nothing — no error, the combination list is untouched, and the supposedly-excluded pairing still runs.
- **Not realizing an over-broad `exclude` can remove more than intended.** An exclude entry with only one key (e.g. just `os: windows-latest`) removes every combination with that `os` value across all other dimensions, not just one specific pairing.
- **Building a monorepo's changed-package matrix by hand instead of dynamically.** A manually maintained `package: [pkg-a, pkg-b, pkg-c]` list has to be remembered and updated every time a package changes — exactly the drift a `fromJSON()`-driven matrix from a change-detection job avoids.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Build the Section 1 exclude example, push it, and confirm the checks UI shows 3 × 3 − 1 = 8 runs, with `(windows-latest, 16)` absent.
2. **(Requires a GitHub repo)** Build the Section 3 include example, push it, and confirm 5 total runs: the original four, one with `experimental: true` merged onto `(ubuntu-latest, 18)` only, and one standalone `(macos-latest, 22)` run with no `experimental` key.
3. **(Paper exercise)** A matrix declares `os: [ubuntu-latest, windows-latest]`, `node-version: [18, 20]`, and an include entry `{os: windows-latest, node-version: 22, flag: true}`. Does `flag: true` merge into an existing combination or create a new one? Why?
4. **(Requires a GitHub repo)** Build the Section 4 dynamic-matrix example, push it, and confirm `test-packages` produces exactly two runs, one per element written to `$GITHUB_OUTPUT` by `detect-changes`.
5. **(Requires a GitHub repo)** In the Section 4 example, remove `fromJSON()` so the matrix reads `package: ${{ needs.detect-changes.outputs.packages }}` directly. Rerun and observe that the matrix fails to expand into two runs as expected, since `matrix.package` receives a literal string rather than a parsed list.

## Interview Q&A

**Q: You add `include: [{os: ubuntu-latest, node-version: 18, experimental: true}]` to a matrix that already generates a `{ubuntu-latest, 18}` combination. Does `experimental: true` show up on all your runs, or just one?**
A: Just the one matching combination — the include entry's `os` and `node-version` both match an existing generated run, so its extra key merges onto that run alone.

**Q: What if you'd written `os: macos-latest` instead, and `macos-latest` was never in your matrix's `os` list?**
A: It wouldn't merge anywhere. It produces a brand-new, standalone job run containing only the keys given in that include entry, since there's nothing to match against.

**Q: How do you build a matrix from a list of changed packages a previous job computed?**
A: Write the list as a JSON string to that job's `$GITHUB_OUTPUT`, declare `needs:` on the consuming job, and wrap the output reference in `fromJSON()` inside `strategy.matrix` — outputs are always strings and the matrix needs a real parsed list.

**Q: Does `exclude` ever add combinations, or `include` ever remove them?**
A: No — `exclude` only ever removes combinations the declared dimensions would otherwise generate; `include` only ever adds or merges, never removes.

**Q: You write an `exclude` entry for `node-version: 17` but the matrix only declares `16, 18, 20`. What happens?**
A: Nothing — no error, no combination removed. The exclude entry silently matches nothing, and every generated combination still runs.
