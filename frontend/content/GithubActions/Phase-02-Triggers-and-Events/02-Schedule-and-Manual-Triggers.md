# Schedule and Manual Triggers

Not every workflow should react to a human writing code. Some jobs need to run because time passed — a nightly backup check, a weekly dependency-audit report — and some need to be runnable *on demand* by a human who isn't pushing anything, or triggered from outside GitHub entirely, like a deployment pipeline in another system kicking off a release. `push` and `pull_request` (Lesson 1) can't express either of these: there's no commit and no PR involved. `schedule`, `workflow_dispatch`, and `repository_dispatch` fill that gap, and each has a specific gotcha: schedules that silently don't fire at the minute you expect, a manual "Run workflow" button that mysteriously doesn't appear, and an external trigger that requires GitHub's REST API rather than just YAML.

## 1. Cron Scheduling (`on: schedule`)

One or more `cron` strings are declared under `on.schedule`. GitHub Actions parses this using standard five-field POSIX cron syntax (`minute hour day-of-month month day-of-week`), always interpreted in **UTC**, regardless of where the repository owner or runner physically is.

```yaml
on:
  schedule:
    - cron: '0 2 * * *'   # 02:00 UTC every day
```

`cron: '0 2 * * *'` — minute 0, hour 2, every day of month, every month, every day of week: 02:00 UTC daily. The value must be quoted; an unquoted `*` sequence can confuse some YAML tooling.

GitHub does not guarantee execution at the exact wall-clock minute — its docs state scheduled workflows run on a best-effort basis and can be delayed under high infrastructure load, sometimes by many minutes. The shortest interval GitHub allows is once every 5 minutes; a cron expression asking for more frequent runs is accepted at parse time but silently coalesced or throttled in practice — `schedule` was never designed for sub-5-minute precision.

## 2. `workflow_dispatch` with Typed Inputs

`on.workflow_dispatch` is declared optionally with an `inputs` map describing typed parameters (`string`, `boolean`, `choice`, `environment`) that a human filling out a form in the Actions UI (or a script calling the REST/CLI equivalent) supplies.

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to run the report against'
        required: true
        type: choice
        options:
          - staging
          - production
        default: staging
```

`workflow_dispatch.inputs.environment` is a `choice`-type input, so the "Run workflow" form in the Actions UI renders a dropdown restricted to `staging`/`production`, defaulting to `staging`. Referenced later via:

```yaml
run: |
  echo "Generating report for: ${{ github.event.inputs.environment || 'staging (scheduled run)' }}"
```

The fallback matters: schedule-triggered runs have no `inputs` at all, so referencing `github.event.inputs.*` directly (without a fallback) resolves to an empty value on scheduled runs.

**UI visibility gate:** the "Run workflow" button and its input form only appear in the Actions tab for a workflow file that is already present, with a `workflow_dispatch` trigger, **on the repository's default branch**. A `workflow_dispatch` block added only on a feature branch will not surface a manual-run button until that file merges to default — a frequent source of "I added `workflow_dispatch` but I don't see the button" confusion.

## 3. `repository_dispatch`

`on.repository_dispatch` is declared with a `types` filter (custom string tags you invent, e.g. `deploy-requested`). An external system (or a script, or another workflow) calls GitHub's REST API with a matching `event_type` and an optional `client_payload` JSON object:

```yaml
on:
  repository_dispatch:
    types:
      - deploy-requested
```

```bash
curl -X POST \
  -H "Authorization: token $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/OWNER/REPO/dispatches \
  -d '{"event_type":"deploy-requested","client_payload":{"env":"production"}}'
```

GitHub matches the `event_type` against the `types` filter and starts a run, exposing the payload under `github.event.client_payload`. Once GitHub decides any of these events matches, the rest of the pipeline is identical to any other trigger: a run is created, `jobs` execute, results post to the Actions tab — schedule/dispatch triggers only affect *how a run gets started*, nothing about how it executes afterward.

## Full Example

```yaml
name: Nightly Report and Manual Trigger

on:
  schedule:
    - cron: '0 2 * * *'   # 02:00 UTC every day
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to run the report against'
        required: true
        type: choice
        options:
          - staging
          - production
        default: staging

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Run report
        run: |
          echo "Generating report for: ${{ github.event.inputs.environment || 'staging (scheduled run)' }}"
```

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < nightly.yml
```

## Comparison

| | `schedule` | `workflow_dispatch` | `repository_dispatch` |
|---|---|---|---|
| Started by | GitHub's clock (UTC cron) | A human in the UI/API | An external system via REST API |
| Recurring or one-off | Recurring | One-off | One-off (per call) |
| Native typed inputs | No | Yes (`inputs` map) | No (raw `client_payload` JSON) |
| Visibility requirement | None | File must be on default branch | None (API call, not UI-dependent) |
| Timing precision | Best-effort, can be delayed | Immediate on click | Immediate on API call |

Unlike Lesson 1's `push`/`pull_request`, which carry rich, GitHub-populated context (`github.event.pull_request.*`, the commit SHA) automatically, `workflow_dispatch` and `repository_dispatch` carry only whatever `inputs` or `client_payload` you explicitly defined — GitHub doesn't infer intent, you supply it.

## Common Mistakes

- **Assuming a `cron: '*/2 * * * *'`-style expression will run every 2 minutes reliably** — GitHub enforces a practical floor around 5 minutes for scheduled workflows, and even valid 5-minute-or-slower schedules are explicitly documented as best-effort, not exact.
- **Treating a scheduled run's start time as precise enough for time-sensitive logic** (e.g., "this must run at exactly 09:00 UTC or a downstream system breaks") — under load, GitHub's own docs acknowledge delays, so time-critical work needs a tolerance window, not an assumption of exactness.
- **Adding `workflow_dispatch` to a workflow file on a feature branch and then reporting "the Run workflow button isn't showing up"** — it won't, until that file is merged into the repository's default branch.
- **Forgetting cron's UTC assumption** — writing `cron: '0 9 * * *'` intending "9 AM local time" for a team in UTC+5, then being confused why the nightly job fires at 2 PM their time.
- **Building a `repository_dispatch` integration without setting a `types` filter**, or mismatching the `event_type` string sent by the external caller against the `types` list in the workflow — a silent no-op, much like a `pull_request` trigger with the wrong `types` (Lesson 1) simply never firing.

## Hands-On Exercises

1. Save the full example above as `nightly.yml` and validate it: `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < nightly.yml`.
2. Push `nightly.yml` to a repo's default branch (prerequisite: an existing pushed repo), then run `gh workflow run "Nightly Report and Manual Trigger" -f environment=production` and confirm the input reaches the job via `gh run view --log`.
3. Temporarily change the cron to `cron: '*/1 * * * *'` and observe in the Actions tab (over 10+ minutes) that runs don't actually fire every minute, illustrating the best-effort/minimum-interval behavior.
4. Fire a `repository_dispatch` event with `curl` (or `gh api repos/{owner}/{repo}/dispatches -f event_type=deploy-requested -f 'client_payload[env]=production'`) against an existing pushed repo with a matching `types` filter, and confirm a run starts.
5. Add a `workflow_dispatch` trigger to a workflow file on a feature branch only — don't merge it yet — and confirm (prerequisite: an existing pushed repo) that no "Run workflow" button appears in the Actions UI for that workflow. Then merge the feature branch to default and confirm the button now appears.

## Interview Q&A

**Q: Your team says a nightly job that's supposed to run at midnight sometimes runs at 12:07 — is that a bug?**
A: No — GitHub explicitly documents scheduled workflows as best-effort with possible delays under load. Production logic depending on exact timing should not be built on `schedule` alone.

**Q: How would you let an external deployment system kick off a GitHub Actions workflow without a human clicking anything?**
A: Use `repository_dispatch` with a `POST /repos/{owner}/{repo}/dispatches` API call carrying a matching `event_type`. This is distinct from `workflow_dispatch`, which still requires a human (or a script acting as one) in GitHub's own UI/API surface.

**Q: Why doesn't the "Run workflow" button show up after adding `workflow_dispatch` to a workflow file?**
A: The button only appears for workflow files that already exist, with a `workflow_dispatch` trigger, on the repository's default branch. A file added only on a feature branch won't surface the button until merged.

**Q: What's the shortest reliable interval for `schedule`, and what happens if you ask for something faster?**
A: Around 5 minutes is the practical floor GitHub enforces. A faster cron expression parses fine but gets silently coalesced or throttled by GitHub's scheduler rather than actually firing at that rate.

**Q: What context do `workflow_dispatch` and `repository_dispatch` give a job, compared to `push`/`pull_request`?**
A: Only whatever you explicitly define — `inputs` for `workflow_dispatch`, `client_payload` for `repository_dispatch`. Unlike `push`/`pull_request`, GitHub doesn't auto-populate rich event context like commit SHAs or PR metadata for these triggers.
