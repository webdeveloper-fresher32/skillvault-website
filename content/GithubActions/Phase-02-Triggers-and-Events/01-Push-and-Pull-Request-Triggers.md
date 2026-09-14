# Push and Pull Request Triggers

Phase 1 treated `on` as a black box — "the condition that decides when a run starts." In real repositories, the two events you wire up on day one are `push` and `pull_request`, and they look deceptively similar: both fire when code changes, both can target `main`, both can run the same test suite. But they answer fundamentally different questions — "did code just land on a branch?" versus "is someone proposing code land on a branch?" — and conflating them causes real bugs: CI that never gates a merge, or CI that runs with more trust (and more secrets) than it should. The sharpest version of this is `pull_request_target`, an event that looks like a typo-tolerant alias for `pull_request` but is actually a distinct trigger with write-level permissions and secret access, running against a repository's own trusted workflow file while still being influenced by an untrusted fork's pull request.

## 1. `push` Triggers

GitHub compares the event to the ref that was just updated by a direct commit, merge, or force-push. If a workflow's `push` block matches that ref (and any branch/path filters — Phase 2, Lesson 3), a run starts. The checkout in that run resolves to the pushed commit itself — the actual SHA that now sits at the tip of the branch.

```yaml
on:
  push:
    branches:
      - main
```

## 2. `pull_request` Triggers

GitHub compares the event to PR *activity* — not a code push directly, but an action taken on a pull request: opening it, pushing a new commit to its head branch (`synchronize`), reopening it, and others. By default, only `opened`, `synchronize`, and `reopened` are listened for if `types` isn't specified explicitly.

```yaml
on:
  pull_request:
    branches:
      - main
    types:
      - opened
      - synchronize
      - reopened
```

Because the PR might come from a fork you don't control, GitHub runs `pull_request`-triggered jobs from forks with a read-only `GITHUB_TOKEN` and does *not* expose repository secrets to them by default — deliberate sandboxing so a malicious PR can't exfiltrate secrets just by opening a pull request. That secret-withholding behavior applies specifically to *forks* — a PR opened from a branch within the same repository still gets normal secret access under `pull_request`.

## 3. The Checkout Nuance: Merge Commit vs Head Commit

For `pull_request`, `actions/checkout` defaults to checking out a special *ephemeral merge commit* GitHub generates on the fly — the PR's head merged into its base — not the raw head commit the contributor pushed. This is intentional: it tests "what happens if this actually merges," catching conflicts or breakage the head commit alone wouldn't reveal.

```
push event:            checkout resolves to → the pushed commit itself (real SHA at branch tip)
pull_request event:     checkout resolves to → GitHub's synthetic merge-preview commit (base + head merged)
```

For the *same* underlying commit, a `push` run and a `pull_request` run checking out "the same code" can actually see subtly different content, because one checks out the raw commit and the other checks out a merge simulation — this is the single most common source of "why did CI pass on my branch but the PR check disagree" confusion. It also explains why `github.sha` in a `pull_request` run doesn't match the commit visible on the contributor's branch — it's the SHA of the synthetic merge-preview commit.

## 4. `pull_request_target` and Its Danger

The event-matching rules mirror `pull_request` (same activity types), but two things flip: the job runs with the *base repository's* full permissions and secrets (as if it were a `push` on the base branch), and `actions/checkout` — unless `ref` is explicitly overridden — checks out the **base branch**, not the PR's proposed code at all. The workflow file itself always executes as it exists on the base branch too, ignoring any changes to it proposed by the PR.

```yaml
on:
  pull_request_target:
    branches:
      - main

jobs:
  label-pr:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - name: Comment on PR
        run: echo "This job has write access and secrets, but has NOT checked out fork code"
```

**Where the danger enters:** the moment someone adds a step to a `pull_request_target` job that explicitly checks out the PR's head (`ref: ${{ github.event.pull_request.head.sha }}`) and then *runs* code from that checkout (a build script, a test command, an install hook), untrusted fork code executes with trusted secrets and write access:

```yaml
# DANGEROUS — do not do this
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}   # checks out untrusted fork code
      - run: npm install && npm run build                   # ...then EXECUTES it, with base-repo secrets available
```

`pull_request_target` itself is not running untrusted code — the combination of it plus checking out and executing untrusted code is the foot-gun. `pull_request_target` remains legitimate for tasks that only need to *label* or *comment* on a PR, or that need secrets to do something like post a preview-deployment link, as long as it never checks out and executes the PR's own code.

## 5. PR Activity Types

`types` on `pull_request` (and `pull_request_target`) controls which PR activities trigger a run. The default set — used only when `types` is omitted — is `opened`, `synchronize`, `reopened`. Other activity types require an explicit list.

| Activity | Included by default? | Fires when... |
|---|---|---|
| `opened` | Yes | A new PR is created |
| `synchronize` | Yes | A new commit is pushed to the PR's head branch |
| `reopened` | Yes | A closed PR is reopened |
| `labeled` | No | A label is added |
| `ready_for_review` | No | A draft PR is marked ready |
| `edited` | No | The PR's title/body/base branch is edited |

## Comparison

| | `push` | `pull_request` | `pull_request_target` |
|---|---|---|---|
| Reacts to | Code already landed on a ref | A proposal to land code | Same activity as `pull_request` |
| Checkout resolves to | The pushed commit | Ephemeral merge-preview commit (default) | Base branch (default, unless `ref` overridden) |
| `GITHUB_TOKEN` | Read/write, normal repo permissions | Read-only for fork PRs | Full base-repo permissions |
| Secrets | Available | Withheld for fork PRs | Available |
| Safe by default? | Yes | Yes (sandboxed for forks) | Only if it never checks out + executes PR code |

Branch filters (Phase 2, Lesson 3) narrow *which* PRs trigger a run, but do nothing to change the trust model above — a filtered `pull_request_target` workflow is exactly as dangerous as an unfiltered one if it checks out and runs fork code.

## Common Mistakes

- **Reaching for `pull_request_target` to "fix" a problem where secrets aren't available in `pull_request` runs**, without understanding that it checks out the *base* branch by default — the job runs and has secrets, but isn't actually testing the PR's code at all unless `ref` is explicitly overridden.
- **Overriding `ref` in a `pull_request_target` workflow to check out the PR head, then running a build/test/install step against it** — the classic security foot-gun: untrusted fork code now executes with write-level `GITHUB_TOKEN` and full secret access.
- **Forgetting that `pull_request` runs check out a merge commit, not the head commit** — debugging "why does `github.sha` in this run not match the commit I see on my branch" when the answer is the synthetic merge-preview commit.
- **Not specifying `types` on `pull_request` and assuming every PR activity (e.g., adding a label, converting to ready-for-review) triggers a run** — only `opened`, `synchronize`, and `reopened` are default.
- **Assuming a fork PR run has the same secrets as a same-repo PR run** — the secret-withholding behavior applies specifically to forks, not to PRs from branches within the same repository.

## Hands-On Exercises

1. Save the example from section 1 combined with section 2 as `ci.yml` and validate it: `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < ci.yml`.
2. Open a PR from a branch in the same repo and inspect `github.sha` in a `run` step (`echo ${{ github.sha }}`) — compare it against the commit shown on the branch in GitHub's UI to see the merge-commit nuance firsthand.
3. Add `types: [labeled]` to a `pull_request` trigger, then add a label to an open PR and confirm (via the Actions tab) that a run starts — remove the label and confirm no run fires on unlabeling unless `unlabeled` is also listed.
4. Write the "DANGEROUS" snippet from section 4 into a scratch workflow file (do not push it to a real repo) and annotate, line by line, exactly which line introduces the risk — this is a code-review exercise, not something to run.
5. Using an existing pushed repo, run `gh api repos/{owner}/{repo}/commits/{sha}/pulls` (requires `gh` and a real PR) to see how GitHub associates a commit with its pull request metadata.

## Interview Q&A

**Q: Why is `pull_request_target` considered risky, and when is it actually the right tool?**
A: It's risky because it grants base-repo write permissions and secrets while being triggered by an untrusted fork's PR activity. It's legitimate for tasks that only label or comment on a PR (or need secrets to post something like a preview link) as long as the job never checks out and executes the PR's own code — the danger is specifically checking out the fork's `ref` and then running it.

**Q: A contributor says their fork's PR check is failing for reasons they can't reproduce locally — what would you check?**
A: Whether CI actually ran against the merge-preview commit (PR head merged into base) rather than the contributor's raw branch head — `pull_request` checks out that synthetic merge commit by default, which can differ from what's on the contributor's branch.

**Q: What's the default set of `pull_request` activity types, and what's a common mistake around it?**
A: `opened`, `synchronize`, and `reopened`. The common mistake is assuming other activities like `labeled` or `ready_for_review` also trigger a run without an explicit `types` list — they silently don't.

**Q: Does a `pull_request` run from a same-repo branch get the same secret access as a fork PR?**
A: No — the read-only-token, no-secrets sandboxing applies specifically to PRs from forks. A PR opened from a branch within the same repository gets normal secret access under `pull_request`.

**Q: What's the single distinguishing checkout behavior between `push` and `pull_request`?**
A: `push` checks out the actual pushed commit; `pull_request` checks out GitHub's ephemeral merge-preview commit (head merged into base) by default, not the raw head commit.
