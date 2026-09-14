# Event Filters: Branches, Paths, and Tags

A `push` or `pull_request` trigger (Lesson 1) without any filter fires on *every* push or PR touching the repository — a monorepo with a frontend, a backend, and a docs folder would run the entire test matrix every time someone fixes a typo in a Markdown file. Branch, path, and tag filters narrow "when does this run" down to "when does this run for changes that actually matter to this job." The trap: these filters only control whether a *run starts* — they say nothing about whether GitHub's branch protection rules will be satisfied. A required status check living inside a `paths`-filtered workflow can end up in permanent limbo for any PR that doesn't touch those paths, because the job never runs at all, and a required check that never reports anything can never be satisfied.

## 1. `branches` / `branches-ignore`

`branches` and `branches-ignore` are sub-keys of a `push` or `pull_request` block — they narrow that specific event by which ref changed, and are mutually exclusive with each other within a single event block (you pick one exclusionary style, not both).

```yaml
on:
  push:
    branches:
      - main
      - 'release/*'
```

This matches pushes/PRs targeting `main` exactly, or any branch under the `release/` prefix (e.g., `release/2.0`, `release/2.1`) via the single-level glob.

## 2. `paths` / `paths-ignore`

`paths`/`paths-ignore` narrow the same event by which *files* changed, independent of which branch was touched. Like the `branches` pair, `paths` and `paths-ignore` are mutually exclusive with each other.

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'src/**'
```

`paths: ['src/**']` matches any changed file nested anywhere under `src/`, at any depth — a change to `src/utils/helpers.js` matches, and so would `src/deep/nested/file.js`. A push can match the branch filter and fail the path filter, or vice versa; **both must pass** for the trigger to fire.

`paths` filters only apply to `push` and `pull_request` — adding a `paths` filter under `schedule` or `workflow_dispatch` (Lesson 2) has no effect, since those triggers aren't associated with a set of changed files at all.

## 3. Glob Pattern Syntax

Filters use glob syntax where `*` matches any characters *except* `/` (staying within one path/ref segment), while `**` matches across segment boundaries, including `/`.

| Pattern | Matches | Does NOT match |
|---|---|---|
| `src/*` | `src/app.js` | `src/lib/app.js` (nested one level deeper) |
| `src/**` | `src/app.js`, `src/lib/app.js`, `src/a/b/c.js` | — |
| `release/*` | `release/2.0` | `release/2.0/hotfix` |

Writing `src/*` when `src/**` was intended silently misses anything nested one level deeper, so the workflow appears to "randomly" skip legitimate source changes.

## 4. `tags` / `tags-ignore`

Tag filters are a variant of the same mechanism but apply only to `push` events against tag refs (`refs/tags/...`) rather than branch refs — commonly used to trigger a release workflow only when a version tag like `v1.2.0` is pushed.

```yaml
on:
  push:
    tags:
      - 'v*'
```

`tags: ['v*']` only ever matches `push` events against tag refs — it does nothing to restrict which *branches* trigger the workflow. A workflow meant to run "only on release tags, not on any branch push" also needs to omit or scope the `branches` key appropriately, since a tag-only filter is orthogonal to (not a replacement for) a branch filter.

## 5. Filter Evaluation and the Silent-No-Match Behavior

Filters attach under a specific event, not under `on` globally. GitHub evaluates the event first — identifying the affected ref and the set of changed file paths — then checks those against any declared `branches`/`paths`/`tags` filters.

```
push event arrives
      │
      ▼
does ref match branches/branches-ignore? ── no ──▶ no run (silent)
      │ yes
      ▼
do changed files match paths/paths-ignore? ── no ──▶ no run (silent)
      │ yes
      ▼
      run starts
```

Exactly like an `on` mismatch (Phase 1, Lesson 2), a push whose changed files don't intersect any `paths` filter (or whose branch doesn't match `branches`) simply never creates a workflow run. There is no event, no skipped-with-a-reason marker, no log entry a developer can find in the Actions tab — the run doesn't exist. Filters compound the same "silence, not error" design one level deeper than `on` itself: now a *matching* event can still produce no run if its branch or paths don't clear the filter, which is easy to mistake for a bug in the workflow rather than expected filtering.

## 6. The Branch-Protection + `paths`-Filter Gotcha

When a repository admin marks a job's name as a "required status check," GitHub's merge-button logic waits for *that check name* to report a conclusion (success, failure, or skipped) on the PR's head commit. It has no built-in awareness that the check's own workflow is filtered by `paths` — from branch protection's point of view, it's simply waiting for a status that filter logic prevented from ever being posted.

```yaml
name: Frontend Source Checks

on:
  push:
    branches:
      - main
      - 'release/*'
    paths:
      - 'src/**'
  pull_request:
    branches:
      - main
      - 'release/*'
    paths:
      - 'src/**'

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Lint
        run: echo "Linting files under src/"

      - name: Test
        run: echo "Running tests for src/ changes"
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < frontend.yml
```

If `lint-and-test` were marked as a required status check in branch protection, a PR that only edits `README.md` would never trigger this workflow at all — and would sit blocked on a check that can never post a result, unless the repository also has an unfiltered gatekeeper job for that specific check name.

**The fix pattern:** teams that need `paths` filtering *and* a required check typically either (a) don't filter the required job at all and instead make the job itself cheaply short-circuit ("no relevant files changed, exit 0 immediately"), or (b) use a separate lightweight "gatekeeper" job, unfiltered, whose only role is to always report a status, computing internally whether the real work needed to run.

## Comparison

| | `branches`/`branches-ignore` | `paths`/`paths-ignore` | `tags`/`tags-ignore` |
|---|---|---|---|
| Narrows by | Which ref changed | Which files within that ref changed | Tag refs pushed (`refs/tags/...`) |
| Applies to | `push`, `pull_request` | `push`, `pull_request` | `push` only |
| Mutually exclusive with its pair | Yes | Yes | Yes |
| Interacts with branch protection | Indirectly (gates whether a run starts at all) | Same risk as `branches` | Not typically used for required checks |

## Common Mistakes

- **Making a `paths`-filtered job a required status check** — any PR that doesn't touch the filtered paths can never satisfy that check, leaving the PR's merge button permanently blocked with no natural way to resolve it short of an unfiltered gatekeeper job or removing the requirement.
- **Writing `src/*` when `src/**` was intended** — `src/*` only matches files directly inside `src/`, silently missing anything nested one level deeper.
- **Assuming `branches-ignore` and `branches` can be combined on the same event** — GitHub rejects (or ignores, depending on version) using both together on one trigger.
- **Forgetting that `paths` filters only apply to `push` and `pull_request`** — adding a `paths` filter under `schedule` or `workflow_dispatch` has no effect.
- **Confusing a tag-only filter with a branch filter** — `tags: ['v*']` does nothing to restrict which branches trigger the workflow; a release-tag-only workflow also needs to omit or scope `branches`.

## Hands-On Exercises

1. Save the "Frontend Source Checks" example as `frontend.yml` and validate it: `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < frontend.yml`.
2. Change `paths: ['src/**']` to `paths: ['src/*']`, then (prerequisite: an existing pushed repo) push a change to `src/components/Button.js` and confirm no run starts — then revert to `src/**` and confirm it does.
3. Mark `lint-and-test` as a required status check in a test repo's branch protection settings (prerequisite: repo admin access), open a PR that only touches `README.md`, and observe the merge button stuck waiting on a check that never runs.
4. Add a `tags: ['v*']` filter to a separate workflow and push a tag with `git tag v1.0.0 && git push origin v1.0.0` (prerequisite: an existing pushed repo) to confirm it fires independently of any branch filter.
5. Run `actionlint frontend.yml` after intentionally adding both `branches` and `branches-ignore` to the same event block, and observe the validation error.

## Interview Q&A

**Q: A PR that only changes documentation is stuck with a required check permanently pending — what's happening?**
A: The required check's workflow is filtered (typically by `paths`) such that non-matching PRs never trigger a run. Branch protection has no concept of "this check was intentionally skipped" unless the workflow itself is restructured (e.g., an unfiltered gatekeeper job) to always report a status.

**Q: What's the difference between `src/*` and `src/**` in a `paths` filter?**
A: `src/*` matches only files directly inside `src/`, one segment deep. `src/**` matches files at any depth under `src/`, crossing directory boundaries.

**Q: Can `branches` and `paths` filters be evaluated independently — does matching one guarantee a run starts?**
A: No — both must pass. A push can match the branch filter and fail the path filter (or vice versa), and either failure alone prevents the run.

**Q: Does a `tags` filter restrict which branches can trigger a workflow?**
A: No — `tags`/`tags-ignore` only matches `push` events against tag refs and is orthogonal to `branches`. A workflow meant to run only on release tags still needs to scope or omit `branches` separately.

**Q: What's the recommended fix when you need both `paths` filtering and a required status check?**
A: Either don't filter the required job and have it cheaply short-circuit when no relevant files changed, or add a separate unfiltered "gatekeeper" job under that exact check name that always reports a status regardless of what triggered the run.
