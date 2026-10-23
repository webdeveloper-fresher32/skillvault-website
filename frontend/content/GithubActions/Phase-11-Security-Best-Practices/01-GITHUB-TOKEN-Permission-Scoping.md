# GITHUB_TOKEN Permission Scoping

Every workflow run gets a `GITHUB_TOKEN` for free — GitHub mints it automatically, scopes it to the triggering repository, and expires it at the end of the job. Depending on a repository's (or organization's) settings, that token can default to broad read/write access across contents, issues, pull requests, packages, and more — access no single job usually needs all of at once. A workflow that never narrows that down is trusting every step it runs, including third-party actions, with permissions far beyond what the job's actual task requires — a large blast radius sitting unused until a bug, a bad dependency, or an untrusted trigger like `pull_request_target` (Phase 2, Lesson 1) turns "unused" into "exploited."

## 1. `GITHUB_TOKEN`'s Default Permissions

A run starts and GitHub mints a `GITHUB_TOKEN` scoped to the current repository. Its baseline permission level is governed by a repository (or organization) setting — "Read repository contents and packages permissions" vs. the broader "Read and write permissions" — that an individual workflow file does not control and, without an explicit `permissions:` block, silently inherits.

```
Repository/org setting (not in any workflow file)
        │
        ▼
  GITHUB_TOKEN default scope
        │
        ├── No permissions: block in workflow → inherits the setting above
        └── permissions: block present        → overrides it for every job
```

## 2. Scoping Down with `permissions:`

If the workflow file declares a top-level `permissions:` block, it overrides the repository default for every job in the file. A block using explicit per-resource keys (`contents: read`, `issues: write`, ...) sets exactly those scopes and implicitly sets every unlisted resource to `none`. An empty block, `permissions: {}`, sets every resource to `none` — a deny-all baseline. A job-level `permissions:` block further overrides the workflow-level one *for that job only* — it fully replaces, not merges with, the default.

```yaml
name: Publish Package

on:
  push:
    tags:
      - "v*"

permissions: {}

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - run: npm test

  publish:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - name: Publish to GitHub Packages
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This YAML was parsed with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())"` and loads cleanly as a single well-formed document.

The top-level `permissions: {}` denies everything by default — if a job below it forgot to declare its own `permissions:` block, that job would run with a fully deny-all token, failing loudly on any privileged operation rather than silently inheriting a broad repository default. `test` opts in to only `contents: read`. `publish` opts in to `contents: read` plus `packages: write` — nothing else, because pushing a package is the only privileged action that job performs.

## 3. Read/Write Per-Resource Permissions

Each resource key is independently read, write, or none. Common keys include `contents` (repo code and releases), `issues`, `pull-requests`, `packages`, `id-token` (Lesson 2), `checks`, `deployments`, `actions`, and `security-events`. A step attempting an operation the token wasn't granted for that resource fails with a permissions error at the API call, not at workflow-parse time. Anything the workflow doesn't explicitly grant, third-party actions running inside that job don't get either — the `GITHUB_TOKEN` a step accesses via `${{ secrets.GITHUB_TOKEN }}` is the same token, carrying the same job-level scoping.

| Key | Governs | Typical minimal setting |
|---|---|---|
| `contents` | Repo code, tags, releases | `read` for checkout-only jobs |
| `issues` | Reading/writing issues | `write` only if the job comments/labels issues |
| `pull-requests` | Reading/writing PRs | `write` only if the job comments on or merges PRs |
| `packages` | Publishing/reading packages | `write` only on a publish job |
| `id-token` | Requesting an OIDC token | `write` only on a job authenticating to a cloud provider |
| `security-events` | Uploading code-scanning results | `write` only on a job running SARIF uploads |

## Comparison

| Approach | What it grants | Risk if left as-is |
|---|---|---|
| No `permissions:` block at all | Whatever the repo/org default is (may be broad, may change later) | Silent inheritance — the workflow file doesn't document what the token can do |
| `permissions: {}` at the top | Deny-all baseline for every job | None on its own — forces every job to opt in explicitly |
| Workflow-level `permissions:` | A shared default every job starts from | Still visible/auditable in one place |
| Job-level `permissions:` | Fully replaces the workflow-level default for that job | Easy to forget it *replaces* rather than adds |
| `permissions: write-all` | Every resource, read and write | Same blast radius as no scoping at all, just written down explicitly |

## Common Mistakes

- **Leaving the default (possibly broad) `GITHUB_TOKEN` permissions in place on a `pull_request_target` workflow.** This is the concrete privilege-escalation risk Phase 2, Lesson 1 warns about: a workflow reacting to untrusted fork input, running with a token that still has broad write access, is a much larger foothold than a scoped-down one.
- **Setting `permissions: write-all` for convenience** instead of enumerating the specific resources a job needs — convenient until something goes wrong.
- **Assuming a job-level `permissions:` block merges with the workflow-level one.** It doesn't — a job that only declares `packages: write`, intending to add to the workflow's `contents: read`, actually loses `contents` access entirely for that job unless it's restated.
- **Scoping permissions but never testing the deny-all path.** A workflow can look correctly scoped on paper while still passing because the repository's actual default (inherited on some earlier untouched job) was broad enough to paper over a missing grant.
- **Forgetting that `permissions:` only governs the `GITHUB_TOKEN`**, not any long-lived PATs or cloud credentials stored as secrets — those are scoped separately (Lesson 2 covers replacing them with OIDC).

## Hands-On Exercises

1. In a scratch repository, add the example workflow from Section 2 as `.github/workflows/publish.yml` and validate it with `actionlint .github/workflows/publish.yml`.
2. Add a step to `test` that attempts `gh issue comment 1 --body "test"` using `GITHUB_TOKEN`, and confirm it fails with a permissions error because `test` only grants `contents: read`.
3. Remove that step, then remove the `permissions:` block from the `test` job entirely (leaving the top-level `permissions: {}` untouched), push a commit tagged `v0.0.2`, and use `gh run view` to confirm `test` now inherits the workflow-level deny-all baseline — not the repository's default token scope — because a job with no `permissions:` block of its own falls back to the workflow-level block, not the repo/org setting.
4. Now remove the top-level `permissions: {}` block itself, leaving no `permissions:` block anywhere in the file, re-run the workflow, and compare the effective token scope reported by `GET /repos/:owner/:repo/actions/runs/:run_id` in the API against the first run — this is the case that actually falls through to the repository's default token scope.
5. (Prerequisite: Lesson 2) Add `id-token: write` to the `publish` job only, and confirm via a dummy `aws-actions/configure-aws-credentials` step that the `test` job — which doesn't grant `id-token` — fails to obtain an OIDC token.

## Interview Q&A

**Q: A workflow needs to comment on a pull request and nothing else — how would you scope its token?**
A: `permissions: pull-requests: write` on that job, ideally alongside a workflow-level `permissions: {}` so every other job in the file defaults to deny-all unless it opts back in.

**Q: Why is explicit permission scoping especially important for a `pull_request_target` workflow?**
A: That trigger already runs with the base repository's elevated token by design (Phase 2, Lesson 1), so explicit scoping is the one lever a workflow author has left to limit what an attacker-influenced step could actually do if the checkout-and-execute foot-gun is ever tripped.

**Q: Does a job-level `permissions:` block add to the workflow-level one, or replace it?**
A: Replace it entirely, for that job only. A job declaring only `packages: write` loses any `contents` access the workflow-level block granted, unless it restates it.

**Q: What happens if a step tries an operation the token wasn't granted for that resource?**
A: It fails with a permissions error at the API call the step makes — not at workflow-parse time — so the mismatch only surfaces when the offending step actually runs.
