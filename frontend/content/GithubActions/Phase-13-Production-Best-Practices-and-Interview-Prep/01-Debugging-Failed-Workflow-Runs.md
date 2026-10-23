# Debugging Failed Workflow Runs

A workflow run turns red and the default view — a list of collapsed steps, each showing a green check or a red X — often doesn't say enough. The failing step's summary line might just be "Process completed with exit code 1," with the real reason buried in output that's collapsed by default, or missing because the failing tool didn't log verbosely at normal settings. There's an escalating ladder of options here, and the skill is knowing when to stop climbing it — reading the log itself already answers most failures, and a live shell on the runner should be the rare exception, not the first move.

## 1. Reading Workflow Run Logs

Every workflow run lists its jobs, and each job lists its steps with a pass/fail icon and total duration. Expanding a step streams its log with a timestamp prefixed to each line, and GitHub renders a wall-clock duration per step and per job — usually the fastest way to see which step failed and how long it ran before doing so.

```
Run summary
├── job: build          ✓ 42s
│   ├── Checkout code           ✓ 1s
│   ├── Set up Node.js           ✓ 3s
│   ├── Install dependencies     ✓ 18s
│   └── Run test suite           ✗ 20s   <- failing step, expand this one first
```

Long logs are collapsed into fold-able groups (an action can start one with `::group::`/`::endgroup::` output), and GitHub's log UI supports searching within a run and jumping straight to the first failed step — wading through unrelated successful steps line by line usually isn't necessary.

## 2. Enabling Debug Logging

If the plain log doesn't explain the failure, GitHub Actions checks for two specific repository (or organization) secrets:

| Secret | Effect |
|---|---|
| `ACTIONS_STEP_DEBUG` set to `true` | Verbose diagnostic output for every step — the same detail level as `runner.debug` |
| `ACTIONS_RUNNER_DEBUG` set to `true` | Verbose logging from the runner process itself — action resolution, environment setup, job orchestration |

Both are added as secrets (Settings → Secrets and variables → Actions → New repository secret), not workflow inputs, specifically so enabling them doesn't require editing every workflow file that might need them. Debug secrets only affect runs that happen *after* they're set — re-running a run whose logs already exist won't retroactively add the extra detail; the run has to happen again once the secret is already in place.

## 3. Re-Running Failed Jobs (All vs. Failed-Only)

Once the fix is understood — or once debug logging is in place and a fresh run is needed — GitHub's UI offers two re-run options:

```
Re-run all jobs      → every job starts fresh, from a clean slate
Re-run failed jobs   → only the failed job(s) and anything that depends on them re-run;
                        already-successful jobs' results are reused
```

Both options replay the exact same commit SHA, exact same workflow file content, and exact same trigger context that produced the original run — nothing about the source code or configuration changes. That makes re-running the right move only for a transient failure (a flaky network call, a rate-limited registry pull, a momentarily unavailable external service) — never for a failure caused by code or workflow YAML that's actually wrong, since re-running a deterministic failure just reproduces it.

## 4. Live-Debugging with `tmate`-Style Actions (and Its Risk)

If logs at debug verbosity still don't explain an environment-specific failure, a community action such as `mxschmitt/action-tmate` opens an SSH- or web-based shell directly on the runner and pauses the job there, letting you inspect the exact filesystem, environment variables, and installed tool versions the failing step saw. This is powerful because it reproduces the runner's real state rather than a guess at it — and risky for exactly the same reason: it's a live, network-reachable shell sitting on infrastructure the org is responsible for.

```yaml
name: Build and Test

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
    inputs:
      debug_enabled:
        type: boolean
        default: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      # If this step's plain output isn't enough to diagnose a failure, set the
      # ACTIONS_STEP_DEBUG and/or ACTIONS_RUNNER_DEBUG repository secrets to "true"
      # (Settings > Secrets and variables > Actions) and re-run — no change to this
      # file is needed for the extra verbosity.
      - name: Install dependencies
        run: npm ci

      - name: Run test suite
        run: npm test

      # Last resort only: pauses the job and opens a live shell on the runner.
      # Gated behind an explicit manual trigger input so it can never fire on an
      # ordinary push or PR run — never leave this unconditional.
      - name: Debug via SSH (manual trigger only)
        if: ${{ github.event_name == 'workflow_dispatch' && inputs.debug_enabled }}
        uses: mxschmitt/action-tmate@v3
```

This YAML is well-formed: the escalation path runs in order — normal step output first, a comment pointing at the two named debug secrets as the next lever, and the live-debug action gated behind a manual `workflow_dispatch` input so it can never fire on a push or PR run.

## Comparison

| Approach | What it shows | Infra changed? | Risk |
|---|---|---|---|
| Expand step logs | Everything the step printed to stdout/stderr | No | None |
| `ACTIONS_STEP_DEBUG` secret | Much more verbose step and action-internal output — same source, more of it | No | None (just secret exposure to whoever can view/edit secrets) |
| `ACTIONS_RUNNER_DEBUG` secret | Runner process orchestration detail (action resolution, container setup, job lifecycle) | No | None |
| Re-run all jobs | Nothing new — replays same commit/workflow from scratch | No | Wastes minutes if the bug is deterministic |
| Re-run failed jobs | Nothing new — replays same commit/workflow, reuses passed jobs | No | Same as above, cheaper |
| `action-tmate` live shell | Live, interactive state of the exact runner | Yes — a shell is opened on the runner | High if left ungated; exposes runner to whoever can reach the session |

## Common Mistakes

- **Reaching for a live-SSH debugging action before checking debug-level logs.** `ACTIONS_STEP_DEBUG`/`ACTIONS_RUNNER_DEBUG` are just secrets to flip on and a re-run away, and they answer the majority of "why did this fail" questions without ever opening a live shell — jumping straight to `action-tmate` skips a much cheaper, much safer step that often already has the answer.
- **Assuming "Re-run failed jobs" will fix a deterministic bug.** Both re-run options replay the exact same commit SHA and workflow file — if the code or config is actually wrong, re-running (in either mode) reproduces the identical failure. A fix requires a new push, not a re-run.
- **Forgetting that debug secrets only take effect on runs after they're set.** Setting `ACTIONS_STEP_DEBUG` doesn't retroactively add detail to a run that already finished; the run has to happen (or be re-run) after the secret exists.
- **Leaving a live-debug step enabled on every run instead of gating it behind a manual, explicit trigger.** An unconditional `action-tmate`-style step means every run — including one triggered by an external contributor's pull request — opens a live shell on the runner, a serious exposure on anything but a fully trusted, manually-invoked workflow.
- **Not narrowing the search before wading through a huge log.** Long logs from verbose builds are searchable and foldable in the GitHub UI; scrolling manually through thousands of lines when the failing step is already flagged wastes time the log viewer's search and auto-jump-to-failure features exist to save.

## Hands-On Exercises

1. **Cause and locate a failure.** In a scratch repository, push a workflow whose `run: npm test` step is guaranteed to fail (e.g. a script that runs `exit 1`). Open the run, expand the failing step, and confirm the log shows the exit code and duration without needing debug logging.
2. **Enable and observe debug logging.** Add `ACTIONS_STEP_DEBUG=true` as a repository secret. Re-run the same failing workflow (a fresh run, not a re-run of the old one) and compare log verbosity against Exercise 1's run — confirm the earlier run's logs did *not* retroactively gain detail.
3. **Practice the two re-run modes.** From a run with two jobs where only one fails, use "Re-run failed jobs" and confirm only the failed job (and anything depending on it) re-executes, while the successful job's result is reused. Then use "Re-run all jobs" on the same run and confirm both jobs execute again from scratch.
4. **Gate a `tmate` step correctly.** Add a `workflow_dispatch`-triggered job with a boolean `debug_enabled` input and an `action-tmate` step behind `if: ${{ github.event_name == 'workflow_dispatch' && inputs.debug_enabled }}`. Confirm a normal `push` never runs that step, and manually dispatching with `debug_enabled: false` also skips it — only dispatching with `debug_enabled: true` opens the session.
5. **Fix a deterministic failure the right way.** Take Exercise 1's guaranteed-failing step, attempt "Re-run failed jobs" and confirm it fails identically, then push an actual fix and confirm only the new commit's run succeeds.

## Interview Q&A

**Q: A workflow is failing intermittently and the logs don't show why — what's your approach?**
A: Escalate in order: expand the failing step's log and check timing first (is it timing out?), then enable `ACTIONS_STEP_DEBUG`/`ACTIONS_RUNNER_DEBUG` as repository secrets and re-run for far more detail without touching infrastructure, and only reach for a live-debug action if the failure looks genuinely environment-specific and debug logs still don't explain it.

**Q: What's the risk of leaving a `tmate`-style debug action in a workflow?**
A: It opens a real, interactive shell on the runner. Left enabled unconditionally — especially on a workflow reachable by external pull requests — it hands a shell on infrastructure you're responsible for to anyone who can trigger the workflow. It should be gated behind a manual trigger and removed once the investigation is done.

**Q: Does "Re-run failed jobs" re-execute against a fixed version of the code?**
A: No. Both re-run options replay the exact same commit SHA and workflow file content as the original run. They're for transient/flaky failures, not for testing a fix — a fix requires a new push.

**Q: What's the difference between `ACTIONS_STEP_DEBUG` and `ACTIONS_RUNNER_DEBUG`?**
A: `ACTIONS_STEP_DEBUG` makes individual steps and the actions they run log much more verbosely. `ACTIONS_RUNNER_DEBUG` makes the runner process itself log more — how it resolved and downloaded an action, container setup, job lifecycle events. A script erroring is usually explained by the first; an action failing to even start more often needs the second.
