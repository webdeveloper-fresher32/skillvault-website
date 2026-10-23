# Workflow File Anatomy

Every workflow file, no matter how complex, boils down to answering three questions for GitHub: what should this be called, when should it run, and what should it do. Those answers live in three top-level keys — `name`, `on`, `jobs` — and the file only counts if it's saved in one specific directory. Get this shape right and everything else in the course builds on top of it.

## 1. The Three Top-Level Keys

| Key | Required | Purpose |
|---|---|---|
| `name` | No | Human-readable label shown in the Actions tab |
| `on` | Yes | The trigger condition — when this workflow activates |
| `jobs` | Yes | A map of job IDs to their `runs-on` and `steps` |

```yaml
name: Basic CI                 # Shown as the run's label in the Actions tab

on:                             # When this workflow triggers
  push:
    branches:
      - main

jobs:                           # A MAP keyed by job id, not a list
  build:                        # "build" is the job id
    runs-on: ubuntu-latest      # Which runner OS to use
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Print a message
        run: echo "Workflow anatomy checks out!"
```

The minimum a workflow file needs to be valid is just `on` and `jobs` — `name` is optional. If it's omitted, GitHub falls back to labeling the run with the workflow file's path (e.g., `.github/workflows/ci.yml`) instead of a readable title.

## 2. Where Workflow Files Live

GitHub only watches one specific directory for workflow files: `.github/workflows/`, on the default or relevant branch. A perfectly valid workflow YAML file sitting in `.github/` (without the `workflows/` subfolder), or in the repo root, is simply invisible to GitHub Actions — no error, no run, nothing.

```
.github/
└── workflows/
    └── ci.yml     ← only files here (as .yml or .yaml) are recognized
```

A file extension other than `.yml`/`.yaml` — or one GitHub doesn't recognize as a workflow (e.g., `.yaml.txt`) — will also sit there unrecognized.

## 3. How a Run Gets Triggered

1. **You push a commit (or trigger some other event) to GitHub.** GitHub's Actions service looks inside `.github/workflows/` for `.yml`/`.yaml` files.
2. **Each file found is parsed as YAML**, then GitHub reads the top-level keys it understands: `name`, `on`, `jobs`, plus optional ones (`env`, `permissions`, `concurrency`, etc., covered in later phases).
3. **GitHub checks the `on` value against the event that just happened.** If the file's `on` doesn't match (e.g., the file only listens for `pull_request` but you did a direct `push`), the workflow simply does not trigger — this is not an error, it's silent by design.
4. **If it matches, GitHub creates a "workflow run"** and reads the `jobs` map. Each key under `jobs` is a job ID; each value describes that job's `runs-on` and `steps` (covered fully in Lesson 03).
5. **The run appears in the repository's Actions tab**, labeled using `name` if present, or the workflow file's path otherwise.
6. **Jobs execute** (in parallel by default, unless dependencies are declared — a Phase 4 topic), and the run's overall status (success/failure) is reported back onto the triggering commit or pull request.

```
push event ──▶ scan .github/workflows/*.yml ──▶ parse YAML ──▶ does `on` match event?
                                                                 │
                                              no ◀───────────────┼───────────────▶ yes
                                       (silent, no run)                  create workflow run → read `jobs` → execute steps
```

Validate the YAML is well-formed before debugging anything else:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < ci.yml
```

## Comparison

| Concept | Where it's introduced | What it establishes here |
|---|---|---|
| Map-valued key (`on`) | Lesson 01 | `on` is exactly the map-valued key pattern from YAML basics |
| Map-of-maps (`jobs`) | This lesson | Each job ID is a key, its value a map of `runs-on`/`steps` |
| List-of-maps (`steps`) | This lesson (established), Lesson 03 (contents) | `steps` exists and lives under a job; Lesson 03 covers what each list item contains |
| Full `on` grammar (events, filters, schedules) | Phase 2 | Not needed yet — here `on` is just "the trigger slot" |

## Common Mistakes

- **Placing the file outside `.github/workflows/`** — invisible to GitHub Actions; no error, no run.
- **Forgetting `name`** — doesn't break anything functionally, but every run in the Actions tab is labeled with the file's path instead of a human-readable title, making a repo with several workflow files hard to scan.
- **Writing `jobs` as a list instead of a map** — `jobs: - build: ...` (treating job entries like list items with `-`) is invalid; `jobs` must be a map where each job ID is a key, e.g. `jobs: { build: {...}, test: {...} }`, since GitHub needs to address each job by name for dependency (`needs:`) references later.
- **Using a file extension other than `.yml`/`.yaml`** — the file sits there unrecognized.
- **Expecting a run to appear even though the trigger didn't match** — e.g., defining `on: pull_request` and then pushing directly to `main`; the absence of a run is expected behavior, not a bug.

## Hands-On Exercises

1. Save the example from section 1 as `.github/workflows/ci.yml` in a scratch repo, push it, and confirm a run appears in the Actions tab labeled "Basic CI."
2. Move the same file to `.github/ci.yml` (outside `workflows/`), push again, and confirm nothing happens in the Actions tab.
3. Remove the `name:` key, push, and observe the run now labeled with the file path instead.
4. Change `on:` to `pull_request` only, then push directly to `main` — confirm no run appears, and explain why that's expected, not a bug.
5. Run `gh workflow list` and `gh run list --workflow=ci.yml` to see how GitHub's CLI reflects the same run metadata you see in the Actions tab.

## Interview Q&A

**Q: You pushed a commit and nothing appeared in the Actions tab — walk me through your debugging steps.**
A: First confirm the file is actually in `.github/workflows/`. Then confirm the YAML is valid. Then confirm the `on` trigger actually matches the event you triggered — a mismatch is silent by design, not an error.

**Q: What's the minimum a workflow file needs to be valid?**
A: Just `on` and `jobs`; `name` is optional and only affects the label shown in the Actions tab.

**Q: Why must `jobs` be a map instead of a list?**
A: Each job needs to be addressable by its job ID — later features like `needs:` (job dependencies) reference jobs by name, which only works if `jobs` is a map keyed by job ID rather than an unnamed list.

**Q: If you define `on: pull_request` and then push directly to a branch, what happens?**
A: Nothing — no run is created, and no error is raised. The workflow's trigger simply didn't match the event, which is expected, silent behavior.
