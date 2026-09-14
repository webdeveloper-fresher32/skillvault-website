# GitHub Actions Cheatsheet

Dense, instant-reference tables and ready-to-paste YAML fragments — organized by what you're trying to do, not by chapter. Condensed from the phase lessons in this course; each row has a one-line note on when/why it matters.

---

### Contexts (`${{ }}` data sources)

| Context | What it holds | Why it matters |
|---|---|---|
| `github.*` | Event payload, ref, sha, actor, event name, run number, workspace path | `github.event_name`, `github.ref`, `github.sha`, `github.actor`, `github.run_number` — the "who/what/where" of the triggering event |
| `env.*` | Environment variables in scope at that point (workflow/job/step level) | Reads whatever `env:` blocks have set so far — later `env:` blocks can override earlier ones |
| `secrets.*` | Encrypted repo/org/environment secrets, resolved and masked in logs | `secrets.GITHUB_TOKEN` is always available for free; custom secrets need to be defined first |
| `steps.*` | Outputs and outcome of previous steps in the **same job**, keyed by step `id` | `steps.get_version.outputs.version` — only populated for steps that already ran |
| `needs.*` | Outputs of upstream jobs, keyed by job id | `needs.build.outputs.version` — requires the producing job to declare a job-level `outputs:` block |
| `matrix.*` | The current permutation, when a job uses a build matrix | `matrix.os`, `matrix.node-version` — one value per matrix axis, per job instance |
| `job` | Status info about the current job | Rarely read directly; mostly relevant via `job.status` in post-job steps |
| `runner` | OS, temp directory, and other facts about the current runner | `runner.os` — commonly used to build OS-specific cache keys |

### Common Expression Functions

| Function | Why it matters |
|---|---|
| `contains(haystack, needle)` | Membership check — e.g. a label list or a string |
| `startsWith(str, prefix)` / `endsWith(str, suffix)` | Prefix/suffix check — commonly used on `github.ref` to detect a branch/tag pattern |
| `format(pattern, values...)` | Builds a string with `{0}`, `{1}`-style positional placeholders |
| `toJSON(value)` | Serializes any context value to a printable JSON string — the standard way to debug-print a whole context (`echo '${{ toJSON(github.event) }}'`) |
| `hashFiles(pattern)` | Hashes matching files — the standard building block for a cache `key:` (e.g. `hashFiles('**/package-lock.json')`) |

**Rule of thumb:** `${{ }}` is resolved by GitHub Actions *before* a `run:` step's shell ever starts — it is textual substitution, not a live shell variable. Never splice an attacker-influenced value (a PR title, an issue body, a branch name) directly into `run:` text; pass it through `env:` and read it as `$VAR` instead.

---

### Trigger Snippets

**Push and pull request, filtered to a branch:**

```yaml
on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
    types:
      - opened
      - synchronize
      - reopened
```

**Scheduled (cron) plus manual dispatch with an input:**

```yaml
on:
  schedule:
    - cron: '0 2 * * *'   # 02:00 UTC every day
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to run against'
        required: true
        type: choice
        options:
          - staging
          - production
        default: staging
```

**Tag-triggered release workflow:**

```yaml
on:
  push:
    tags:
      - "v*"
```

| Trigger | Why it matters |
|---|---|
| `push` | Fires on commits pushed to matching branches/tags — the default CI trigger |
| `pull_request` | Fires on PR activity against the base repo; runs with a read-only token by default and no access to secrets from forks — the safe default for untrusted contributions |
| `pull_request_target` | Like `pull_request`, but runs with the **base repo's** elevated token and secrets even for fork PRs — dangerous if it checks out and executes the fork's code; scope `permissions:` down hard if used |
| `schedule` (cron) | Runs on a cron schedule, UTC only; best-effort timing (GitHub does not guarantee the exact wall-clock minute, especially under load) — don't build timing-sensitive logic on it alone |
| `workflow_dispatch` | Manual trigger from the UI/API, optionally with typed `inputs:` |
| `workflow_call` | Marks a workflow as reusable via `uses:` from another workflow (Phase 7) |

---

### Action Snippets

**Checkout:**

```yaml
- name: Check out code
  uses: actions/checkout@v4
```

**Set up a language runtime (pinned version):**

```yaml
- name: Set up Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
```

The same `uses: actions/setup-<lang>` pattern applies for Python, Java, and Go (`setup-python`, `setup-java`, `setup-go`) — see the phase lessons for setup-node's fully worked example above. Check each action's own documentation for its current major version and version-input syntax before pinning it.

**Cache a dependency directory, keyed on the lockfile hash:**

```yaml
- name: Cache npm dependencies
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-npm-
```

**Upload / download an artifact across jobs:**

```yaml
- name: Upload compiled binary
  uses: actions/upload-artifact@v4
  with:
    name: app-binary
    path: dist/app.bin
    retention-days: 14
```

```yaml
- name: Download compiled binary
  uses: actions/download-artifact@v4
  with:
    name: app-binary
    path: dist
```

| Action | Why it matters |
|---|---|
| `actions/checkout@v4` | Puts the repo's code on the runner — the near-universal first step |
| `actions/setup-node@v4` | Installs a pinned Node.js version via `with: { node-version: ... }` — never leave the version unpinned/`latest` for reproducibility |
| `actions/setup-python`, `actions/setup-java`, `actions/setup-go` | Same pattern as setup-node, via `with: { <language>-version: ... }` — check each action's own docs for its current major version before pinning it |
| `actions/cache@v4` | Persists a directory across runs, keyed on something that changes only when the cached content should (typically `hashFiles()` over a lockfile) |
| `actions/upload-artifact@v4` / `actions/download-artifact@v4` | Moves files **between jobs on different runners** — upload in the producing job, download (naming the same artifact) in a job with `needs:` on it |

---

### Matrix and Job Dependency Snippets

**Matrix across OS and runtime version:**

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest]
    node-version: [18, 20, 22]
runs-on: ${{ matrix.os }}
steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
```

**Passing a job output downstream via `needs`:**

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.get_version.outputs.version }}
    steps:
      - id: get_version
        run: echo "version=1.4.2-$(date +%Y%m%d)" >> "$GITHUB_OUTPUT"

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying version ${{ needs.build.outputs.version }}"
```

---

### Permissions Quick-Reference

`permissions:` scopes the auto-generated `GITHUB_TOKEN`. Set at the workflow level (default for every job) and/or overridden at the job level (fully **replaces**, does not merge with, the workflow-level default for that job).

```yaml
permissions: {}   # deny-all baseline

jobs:
  test:
    permissions:
      contents: read
```

| Key | Read means | Write means |
|---|---|---|
| `contents` | Read repo code/releases (needed to `checkout`) | Push commits, create releases/tags |
| `issues` | Read issues | Create/comment/label/close issues |
| `pull-requests` | Read PRs | Comment on, label, or merge PRs |
| `packages` | Read/pull packages | Publish packages (e.g. `npm publish`, container push) |
| `id-token` | — (no read concept) | Request an OIDC token — needed for cloud auth without long-lived secrets (Phase 11) |
| `checks` | Read check runs | Create/update check runs |
| `deployments` | Read deployment status | Create/update deployments |
| `actions` | Read workflow run info | Cancel/re-run workflows |
| `security-events` | Read code scanning alerts | Upload code scanning (SARIF) results |
| `attestations` | — | Publish build provenance attestations (Phase 11 SLSA) |

**Common mistakes:**
- Setting `permissions: write-all` for convenience instead of enumerating exact scopes — same broad-badge risk as leaving the repo default in place.
- Assuming a job-level `permissions:` block merges with the workflow-level one — it **replaces** it entirely for that job.
- Leaving default (possibly broad) permissions on a `pull_request_target` workflow — scope it down explicitly since that trigger runs with the base repo's elevated token by design.
- Looking for "required workflows" as a standalone org/enterprise Actions settings page — GitHub deprecated that standalone setting on October 18, 2023. The equivalent capability today is the "require workflows to pass" rule inside a **repository ruleset** (Settings → Rules → Rulesets), not a separate settings page.

---

### Self-Hosted Runner Labels

```yaml
runs-on: [self-hosted, linux, gpu]
```

| Concept | Why it matters |
|---|---|
| Labels (`self-hosted`, `linux`, `gpu`, custom) | `runs-on` treats a label list as AND, not OR — a job only lands on a runner carrying every listed label |
| Runner groups (org/enterprise Settings → Actions → Runner groups) | Access control, independent of labels — restricts which repos/workflows may even schedule jobs on runners in the group |
| Repository rulesets (Settings → Rules → Rulesets) | Where "require workflows to pass" and other org-enforced merge/push rules live today — not a standalone Actions settings page |
