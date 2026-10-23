# Multi-Language Test Pipelines

Every piece built so far — triggers (Phase 2), runners and steps (Phase 3), caching (Phase 5), matrices (Phase 6) — is a building block. A real project's CI needs them assembled into one coherent shape that answers the same four questions regardless of language: what runtime does the code need, how do dependencies install without re-downloading the world every run, how do tests actually execute, and how does the result get reported back to the pull request in a way a human (or a merge button) can trust.

## 1. The Setup → Install → Test Pipeline Shape

The shape is identical whether the project is Node.js, Python, Go, or Java: **set up the runtime → install dependencies with caching → run the test command → surface the result as a required PR status check.** What differs per language is only which `setup-*` action provisions the runtime and which command runs the tests.

```
checkout → setup-<lang> (pinned version, cache: on) → install deps → run tests → job status → branch protection gate
```

Get the shape right once, and swapping languages is close to a find-and-replace; get it wrong, and a project can run "CI" for months that never actually gates anything, because nobody built the last step — making the result visible and enforced.

## 2. Using `setup-*` Actions

Every language's `setup-*` action follows the same `uses:` + `with: { <language>-version: ... }` contract — `actions/setup-node`, `actions/setup-python`, `actions/setup-java`, `actions/setup-go`, and others all shape the step identically:

| Language | Action | Version input |
|---|---|---|
| Node.js | `actions/setup-node` | `node-version` |
| Python | `actions/setup-python` | `python-version` |
| Java | `actions/setup-java` | `java-version` |
| Go | `actions/setup-go` | `go-version` |

Most `setup-*` actions also accept a `cache:` input (Phase 5, Lesson 2) that wraps `actions/cache` internally, keyed on a lockfile hash — `actions/setup-node`'s `cache: npm` is the canonical example. The actual install command (`npm ci`, `pip install -r requirements.txt`, `go mod download`, `mvn install`) still runs as a separate step afterward; the cache only speeds that command up, it never replaces it.

## 3. Pinning Runtime Versions

The version is passed via `with:` (e.g. `node-version: '20.11.1'`) — declaring the exact version, rather than omitting it or relying on an unpinned default, is what makes the step reproducible.

```yaml
- name: Set up Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20.11.1'
    cache: npm
```

An explicit `node-version: '20.11.1'` (or the less strict `'20'`, which still pins the major version) guarantees consistent behavior across runs. Omitting `node-version` entirely means the resolved version can shift whenever the action's own defaults change or the runner image updates — a workflow that passed yesterday can start failing today with zero changes to the repository's own code.

## 4. Running the Test Command

This is the language's native test runner — `npm test`, `pytest`, `go test ./...`, `mvn test` — invoked as an ordinary `run:` step. Its exit code is what everything downstream depends on: a test command that internally swallows a failing test's non-zero exit and reports `0` regardless breaks the entire chain silently, because every step after this one only sees "the previous step succeeded."

## 5. Reporting Results as a Required Status Check

GitHub Actions automatically reports a status for every job on the commit's associated pull request (or push), named after the job — this requires no extra step to *exist*. Making that status actually block a merge is a separate action: a repository admin marks the job's check name as a "required status check" under branch protection. From that point on, GitHub's merge button:

- waits for that named check to report success before allowing a merge,
- refuses the merge outright if it reports failure, and
- — per Phase 2, Lesson 3 — waits forever if the job's workflow is filtered in a way that keeps it from running on a given PR at all.

## 6. A Complete Node.js Pipeline

A full test pipeline for a Node.js project: checkout, `setup-node` with a pinned version and built-in npm caching, `npm ci`, `npm test`.

```yaml
name: Node.js Test Pipeline

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  test:
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

      - name: Run tests
        run: npm test
```

This YAML was parsed with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())"` and loads cleanly as a single well-formed document.

`cache: npm` wires in `actions/cache` behind the scenes, keyed on `package-lock.json`'s hash, so `npm ci` on a repeated run restores previously-downloaded packages from `~/.npm` instead of hitting the registry cold. `npm ci` — not `npm install` — is deliberate for CI: it installs exactly what `package-lock.json` specifies and fails outright if the lockfile and `package.json` are out of sync, rather than silently updating the lockfile the way `npm install` can. `npm test` runs whatever script `package.json`'s `"test"` field points at; this job's reported status is exactly that command's exit code, and that status is what a branch-protection rule would key off of if `test` were marked as a required check.

## Comparison

| | Pinned version (`'20.11.1'` or `'20'`) | Unpinned / default | Test exits faithfully | Test always exits `0` |
|---|---|---|---|---|
| Reproducible across runs | Yes | No — shifts with runner image / action defaults | N/A | N/A |
| Required-check mechanism trustworthy | N/A | N/A | Yes — green means tests actually passed | No — green regardless of real test outcome |
| Failure surfaces without code changes | Never | Possible ("works yesterday, fails today") | N/A | N/A |

| | `setup-*`'s built-in `cache:` | Manual `actions/cache` step (Phase 5) |
|---|---|---|
| Covers | Single-lockfile case, one line | Multiple cache paths, custom keys folding in OS/matrix dimensions, tools with no `setup-*` action |
| Effort | Minimal | Hand-written key and paths |

## Common Mistakes

- **Not pinning a specific runtime version and relying on whatever "latest" resolves to.** A `node-version` left unset, or set to a bare major version the action resolves loosely, can silently shift to a newer patch or minor release whenever the runner image updates — turning a previously green pipeline red with no corresponding code change, and making the failure hard to diagnose.
- **Trusting a test runner's exit code without verifying it actually fails on a failing test.** A test command wrapped in a shell construct that always exits `0` (a stray `|| true`, a reporting tool invoked in a mode that returns success even on failures) makes the entire required-check mechanism worthless.
- **Treating `npm install` (or the equivalent for another language) as equivalent to a reproducible, lockfile-exact install.** `npm install` can update the lockfile in place if `package.json` and `package-lock.json` drift out of sync; `npm ci` refuses and fails instead — a Python equivalent mistake is installing from a loose `requirements.txt` range instead of a pinned/locked file.
- **Forgetting that the job must be explicitly marked as a required status check in branch protection.** A job reporting a status on every PR is necessary but not sufficient for it to actually gate merges.
- **Skipping the cache's lockfile-hash key and caching on something that never changes (or something that changes too often).** A cache keyed too loosely never invalidates when dependencies actually change (stale installs get reused); a cache keyed too tightly (e.g. including a timestamp) never hits at all — Phase 5, Lesson 3 covers this in depth, and it applies identically across languages.

## Hands-On Exercises

1. Create the workflow from Section 6 in a repo with a `package.json` and `package-lock.json`, push to a branch, and open a PR — confirm the `test` job appears as a status check on the PR.
2. Change `node-version: '20.11.1'` to a nonexistent version (e.g. `'20.999.999'`) and push again — confirm `setup-node` itself fails before `npm ci` ever runs, demonstrating that a bad pin fails fast rather than silently.
3. (Prerequisite: Exercise 1's workflow committed) Temporarily edit the `"test"` script in `package.json` to `"echo ok"` (always succeeds) and push — confirm the job reports success even though no real test ran, then revert, illustrating the "trusting exit code" mistake concretely.
4. Validate the workflow YAML from Section 6 independently: `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < .github/workflows/test.yml`.
5. In a repo you administer, mark the `test` job's check name as a required status check under branch protection, then open a PR that fails a test — confirm the merge button is blocked.

## Interview Q&A

**Q: Your team says CI is green on every PR, but a bug that should have failed a test shipped anyway — where do you look first?**
A: Check whether the test command's own exit code is being trusted correctly — run the test command locally, deliberately break something, and confirm the exit code actually goes non-zero. A green CI run with a broken test suite almost always traces back to a test runner (or wrapping script) that isn't propagating failure the way the pipeline assumes.

**Q: Why pin `node-version: '20.11.1'` instead of just `'20'` or leaving it unset?**
A: `'20.11.1'` guarantees the exact same patch version every run (full reproducibility); `'20'` is a looser-but-still-safe major-version pin; leaving it unset ties the workflow's behavior to whatever the runner image or the action's own default resolves to on a given day.

**Q: Why `npm ci` instead of `npm install` in a CI pipeline?**
A: `npm ci` installs exactly what `package-lock.json` specifies and fails if the lockfile and `package.json` are out of sync; `npm install` can silently update the lockfile instead, which is the opposite of what a reproducible CI install wants.

**Q: A job shows a green checkmark on every PR — does that mean it's blocking bad merges?**
A: Not necessarily. A job reports a status automatically, but that status only blocks a merge once an admin marks it as a required status check under branch protection — a status existing and a status being enforced are two different things.
