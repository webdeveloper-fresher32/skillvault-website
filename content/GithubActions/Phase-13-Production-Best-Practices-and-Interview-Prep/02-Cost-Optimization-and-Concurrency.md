# Cost Optimization and Concurrency

Every prior phase built workflows for correctness — do the right thing on the right trigger. None of them asked what it costs to keep doing that thing over and over, at scale, on a busy repository. The most common way minutes get wasted isn't an inefficient single job — it's redundant runs: a developer pushes three commits to the same pull request in quick succession, and without anything telling GitHub otherwise, all three trigger a full CI run, with the first two burning minutes on a commit nobody cares about the moment the third one lands. `concurrency` groups fix exactly this, and stack with two other levers this phase ties together: caching (Phase 5) and scoped triggers (Phase 2).

## 1. How GitHub Actions Billing Works

For a private repository, GitHub-hosted runner minutes are billed — typically a monthly included allotment on paid plans, with usage-based charges beyond that, and OS-dependent multipliers (Windows and macOS runners are metered more expensively than Linux ones). Public repositories get hosted-runner minutes for free regardless of volume. These specifics (included minutes, per-minute rates, multipliers) are set by GitHub's pricing pages and have changed over time, so treat any specific number as something to verify against current GitHub documentation rather than something to memorize.

```
Private repo, hosted runner   →  billed by the minute (OS-dependent multiplier), plan allotment + overage
Public repo, hosted runner    →  free, regardless of volume
Self-hosted runner (any repo) →  no per-minute Actions charge — cost moves to the machine itself
```

Self-hosted runners never incur a per-minute Actions charge, because GitHub isn't providing the compute — but the org is still paying for that machine somewhere: cloud instance cost, power, hardware amortization, or a team's time to maintain it. "Free" there means the cost moved, not that it disappeared.

## 2. `concurrency` Groups and `cancel-in-progress`

On an active pull request, every push re-triggers CI (Phase 2's `pull_request` trigger). Without coordination, three pushes in five minutes can mean three full, concurrent CI runs — and only the last one's result will ever matter once a newer commit exists. A `concurrency.group` expression built from the workflow name and the PR number or branch ref means every run against that same PR/branch shares one queue slot; `cancel-in-progress: true` tells GitHub that when a new run enters that group while an older one is still running, the older one is canceled outright rather than left to finish uselessly.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci
      - run: npm test
```

*(Validated as well-formed YAML.)* The `concurrency.group` expression uses the pull request number when the run came from a `pull_request` event, and falls back to `github.ref` (the branch name) for a direct `push` — so a PR's superseded runs cancel each other while a push to `main` only cancels an older, still-running push to that same `main` ref, never a run belonging to a different PR or branch. `cache: "npm"` on `setup-node` layers in the next lever.

The concurrency key's scope has to be deliberate: too narrow (or omitted entirely) and every push queues its own full run with nothing ever canceled — the original waste. Too broad — keying only on the workflow name with no ref component, for example — and unrelated PRs or branches sharing that one group can cancel or block each other's runs, which is a correctness bug, not just a cost one.

## 3. Caching and Trigger-Scoping as Cost Levers

Caching (Phase 5's `actions/cache`, or a setup action's built-in `cache:` input, keyed by lockfile hash) means a run that does go to completion doesn't repeat expensive setup work like a full dependency install every time. Scoped triggers (Phase 2's branch/path filters) mean a workflow doesn't even start for a change that can't affect its outcome — a docs-only change skipping a full test-and-build CI workflow entirely, for instance.

```
Trigger scoping   → reduces how often a workflow starts at all
concurrency        → reduces how many of the runs that do start actually finish
Caching            → reduces how many minutes each surviving run costs
```

All three attack a different part of the same bill, and stack: narrowing triggers first cuts the number of runs, concurrency then cuts how many of those still-started runs run to completion, and caching cuts the cost of whichever ones do.

## Comparison

| Setup | Superseded runs canceled? | Runs to completion cost | Risk |
|---|---|---|---|
| No `concurrency` group | No — every push runs to completion | Full cost every push | None functionally, just wasteful |
| `concurrency` group, `cancel-in-progress: true` | Yes — only newest run per group finishes | Reduced — stale runs cut short | Unsafe on a job with real side effects (e.g., a live deploy) |
| `concurrency` group, `cancel-in-progress: false` (or omitted) | No — runs queue serially in the group instead of canceling | Full cost, but serialized not parallel | Safer for side-effectful jobs; doesn't save minutes, only avoids parallel contention |
| Caching (Phase 5) | N/A — orthogonal lever | Reduced per-run setup cost | None |
| Scoped triggers (Phase 2) | N/A — orthogonal lever | Fewer runs start at all | None |
| Self-hosted runner | N/A — orthogonal lever | No per-minute Actions charge; cost moves to owning the machine | Org bears infra/maintenance cost instead |

## Common Mistakes

- **Not setting a `concurrency` group at all.** Every push to a PR queues its own independent, full-cost run, and none of the superseded ones are ever canceled — the most common source of wasted minutes on an active repository.
- **Setting a `concurrency` group key that's too broad**, such as keying only on `github.workflow` with no ref or PR identifier — this can make unrelated branches' or PRs' runs cancel or queue behind each other, a correctness bug (a run you wanted finished gets killed) disguised as a cost optimization.
- **Using `cancel-in-progress: true` on a workflow with real side effects**, like a production deployment job, where canceling mid-flight can leave a deploy partially applied — `cancel-in-progress` is well-suited to CI/test workflows where a canceled run has no lasting effect, and much riskier on a CD workflow (see Phase 10's environment-gated-approval pattern, which already limits how often production-deploy jobs even start).
- **Treating self-hosted runners as unconditionally "free" because there's no per-minute Actions charge.** The compute cost didn't disappear — it moved to whatever's paying for the machine (cloud instance billing, power, hardware, or the team's time maintaining it), and that cost still needs to be weighed against hosted-runner pricing at the org's actual volume.
- **Chasing concurrency/caching optimizations while ignoring overly broad triggers.** A workflow that runs on every push to every branch, unfiltered, wastes far more in aggregate than a slightly slower individual run — Phase 2's path/branch filters are often the single biggest lever, and skipping straight to fine-tuning `cancel-in-progress` without checking trigger scope first optimizes the wrong end of the pipeline.

## Hands-On Exercises

1. **Reproduce the redundant-run problem.** In a scratch repository with no `concurrency` block, open a pull request and push three commits in quick succession. Confirm in the Actions tab that all three runs execute independently to completion (or would, given enough time) rather than canceling each other.
2. **Add a correctly scoped `concurrency` group.** Add the `concurrency` block from this lesson's example, keyed on `${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}` with `cancel-in-progress: true`. Push three commits to the same PR again and confirm the first two runs show as canceled once the third starts.
3. **Break it with an overly broad key, then fix it.** Change the group key to a hardcoded constant (e.g. `group: ci-shared`) with `cancel-in-progress: true`. Open two unrelated PRs and push to both around the same time; confirm one PR's run cancels the other's — demonstrating the too-broad-key bug — then revert to the ref-scoped key from Exercise 2 and confirm the two PRs no longer interfere.
4. **Layer in caching.** Add `cache: "npm"` to the `actions/setup-node` step (or an explicit `actions/cache` step keyed on the lockfile hash, per Phase 5). Run the workflow twice with no dependency changes and compare the "Install dependencies" step's duration between the first (cold cache) and second (warm cache) run.
5. **Verify `cancel-in-progress` is unsafe for a deploy job.** Add a second workflow simulating a deploy job (a `run: sleep 30 && echo done` step standing in for a real deploy) with its own `concurrency` group and `cancel-in-progress: true`. Trigger it, then trigger it again mid-run, and observe the first run gets canceled mid-"deploy" — confirming why Common Mistake #3 calls this unsafe for jobs with real side effects, and why production deploy jobs should either omit `cancel-in-progress` or not share a group with fast-moving CI runs.

## Interview Q&A

**Q: How would you cut CI costs on a repository where every PR push burns a full test run?**
A: Add a `concurrency` group keyed on the PR/branch ref with `cancel-in-progress: true` first, since it targets the most common and wasteful pattern directly. Then layer in caching (Phase 5) so a run that does complete doesn't redo expensive setup, and scoped triggers (Phase 2) so runs that can't possibly matter — a docs-only change, an unrelated path — don't start at all.

**Q: What's the risk of `cancel-in-progress: true`?**
A: It's safe for side-effect-free CI runs, but dangerous on a workflow with real side effects like a live deployment, where canceling mid-run can leave state partially applied. It belongs on test/build workflows more readily than on CD workflows gated by Phase 10's manual-approval pattern.

**Q: Are self-hosted runners cheaper than hosted ones?**
A: Not automatically — self-hosted runners avoid GitHub's per-minute Actions charge, but the org still pays for the machine itself (cloud instance cost, power, hardware, or maintenance time). Whether it's actually cheaper depends on the org's volume and existing infrastructure, not a blanket rule.

**Q: What's the difference between `cancel-in-progress: true` and `false`?**
A: Both put same-group runs into one queue. `true` actively cancels an in-flight run when a new one enters the group; `false` (or omitting the field) still serializes runs one at a time but lets each one finish rather than canceling it — useful when a run's side effects shouldn't be interrupted mid-flight even if a newer one is queued behind it.
