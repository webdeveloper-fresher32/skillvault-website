# GitHub Actions Interview Q&A

50 questions covering the full course, organized by phase grouping. Each entry has a direct answer plus a short explanation of why it matters.

---

## Fundamentals, Triggers, Jobs & Runners (Q1–Q15) — Phases 1–3

**Q1. What are the required top-level keys in a GitHub Actions workflow file, and where must the file live?**
Answer: `on` (the trigger) and `jobs` (at least one job) are required; `name` is optional but recommended. The file must live under `.github/workflows/` in the repo, as a `.yml`/`.yaml` file.
Explanation: Anatomy questions like this are the warm-up filter — getting the required keys or the directory wrong signals you haven't actually written a workflow file by hand.

**Q2. Why might `on: true` be a bug in some YAML tooling, even though GitHub Actions itself isn't tripped up by it?**
Answer: Under the YAML 1.1 spec, bare unquoted `on`, `off`, `yes`, `no` are interpreted as booleans, not strings — so some generic YAML parsers would silently read a top-level `on:` key as the boolean key `true:`. GitHub's own workflow parser handles `on:` correctly as the trigger key regardless.
Explanation: Tests whether you understand the underlying YAML ambiguity, not just that GitHub Actions happens to work around it.

**Q3. What's the difference between a `uses:` step and a `run:` step?**
Answer: `uses:` invokes a packaged, reusable action (`owner/repo@ref`, a local path, or a Docker image); `run:` executes shell commands directly on the runner via the job's configured shell.
Explanation: The distinction underlies almost every later phase — reusable workflows, composite actions, and custom actions are all built around what `uses:` can reference.

**Q4. Does shell state (working directory, environment variables set with plain `export`) persist between two consecutive `run:` steps in the same job?**
Answer: Each `run:` step is a fresh shell process, so a plain `export FOO=bar` in one step does not carry over to the next. Persisting a value across steps requires writing it to the `$GITHUB_ENV` file (for env vars) or the `$GITHUB_OUTPUT` file (for step outputs).
Explanation: A very common gotcha for anyone coming from a plain shell-script mental model — this single fact explains why `$GITHUB_ENV`/`$GITHUB_OUTPUT` exist at all.

**Q5. What's the difference between `on: push` and `on: pull_request` for the same underlying commit?**
Answer: `push` fires for a direct push to a matching branch/tag, running against that exact commit. `pull_request` fires for PR activity (opened, synchronize, reopened, etc.) and by default checks out a merge commit between the PR branch and its base — a different tree than either branch alone.
Explanation: Confusing the two leads to debugging a workflow against the wrong checked-out commit.

**Q6. Why is `pull_request_target` considered dangerous when combined with checking out a fork's code?**
Answer: `pull_request_target` runs with the base repository's elevated `GITHUB_TOKEN` and secrets, even though the event is triggered by a fork's PR. If a step then checks out and executes the fork's (untrusted) code with that trusted token in scope, the fork's code can act with the base repo's privileges — a privilege-escalation foot-gun.
Explanation: One of the most frequently tested security questions in this course — expect a follow-up on how to mitigate it (scope `permissions:` down, per Phase 11).

**Q7. Why can a `paths`-filtered workflow strand a required PR status check?**
Answer: If a job is only scheduled when files under a specific `paths:` filter change, a PR that doesn't touch those paths never triggers the job at all — but if that job's status check is marked "required" in branch protection, GitHub has no way to report a passing (or any) status for it, so the PR can appear permanently blocked.
Explanation: Tests whether you understand that `paths` filtering happens before scheduling, not as a pass/skip inside the job.

**Q8. `schedule` (cron) triggers run on what time reference, and what's a common gotcha with them?**
Answer: Cron schedules run in UTC only. A common gotcha is that GitHub Actions schedules are best-effort, not guaranteed-exact — GitHub's own documentation states scheduled workflows can be delayed, especially during periods of high load, so a nightly job "due" at midnight running a few minutes late isn't a bug.
Explanation: Interviewers use this to probe whether you'd rely on `schedule` for anything time-sensitive without a fallback.

**Q9. Do jobs in the same workflow run sequentially or in parallel by default?**
Answer: In parallel, unless a job declares `needs:` naming another job, which creates an explicit dependency and forces it to wait.
Explanation: A frequent misconception is that jobs listed top-to-bottom in the YAML run in that order — they don't, order in the file is irrelevant without `needs:`.

**Q10. If job B has `needs: [A]` and job A fails, what happens to B by default?**
Answer: B is skipped by default — `needs:` implies an implicit `if: success()` unless overridden.
Explanation: Tests whether you know that reaching B on an upstream failure requires an explicit `if: always()` or `if: failure()` condition, not the default.

**Q11. What differs between `ubuntu-latest`, `windows-latest`, and `macos-latest` beyond the obvious OS?**
Answer: Preinstalled tooling versions, default shell (`bash` on Linux/macOS vs. PowerShell-flavored default on Windows for `run:` unless `shell:` is set explicitly), path separators, and hardware/pricing (macOS runners cost more per minute than Linux).
Explanation: Shows you've actually hit cross-platform friction rather than only ever having run Linux jobs.

**Q12. How do you pass a value produced by one step to a later step in the same job?**
Answer: The producing step writes `name=value` to the `$GITHUB_OUTPUT` file and declares an `id:`; a later step reads it via `${{ steps.<id>.outputs.<name>' }}`.
Explanation: The mechanical foundation for cross-step data flow — most candidates know `outputs` exist but stumble on the exact syntax (`$GITHUB_OUTPUT` file, not `::set-output`, which is deprecated).

**Q13. How do you pass a job's output to a downstream job that `needs` it?**
Answer: The producing job declares a job-level `outputs:` block mapping a name to `${{ steps.<id>.outputs.<name> }}`; the downstream job reads it via `${{ needs.<job-id>.outputs.<name> }}`.
Explanation: Tests the two-hop chain — step output to job output to `needs` context — that trips people up when they only remember one of the two levels.

**Q14. What's the difference between `if: always()`, `if: success()`, `if: failure()`, and `if: cancelled()`?**
Answer: `success()` (the implicit default) runs only if everything upstream succeeded; `failure()` runs only if something upstream failed; `cancelled()` runs only if the run was cancelled; `always()` runs regardless of upstream outcome — commonly used for cleanup or notification steps that must run even after a failure.
Explanation: A cleanup/notify step that "never runs when the build fails" is one of the most common real-world bugs traced back to forgetting `always()`.

**Q15. What's the difference between `timeout-minutes` and `continue-on-error`?**
Answer: `timeout-minutes` caps how long a job or step is allowed to run before GitHub forcibly cancels it (protects against a hang). `continue-on-error: true` lets a step (or job) fail without failing the overall job/workflow — the run is still marked as having that step fail, but doesn't block dependents.
Explanation: They solve different problems (a hang vs. a tolerated failure) and are frequently confused as if either one "makes failures safe."

---

## Environment, Secrets, Artifacts, Caching & Matrix (Q16–Q25) — Phases 4–6

**Q16. What is the precedence order when the same env var is set at workflow, job, and step level?**
Answer: Step-level `env:` overrides job-level, which overrides workflow-level — the most specific (innermost) scope wins.
Explanation: Standard scoping-precedence question; the same principle (innermost wins) recurs later with `permissions:`.

**Q17. What's the difference between a static `env:` block and writing to `$GITHUB_ENV`?**
Answer: A static `env:` block's value is fixed at workflow-parse time. Writing `NAME=value` to the `$GITHUB_ENV` file from inside a `run:` step sets an environment variable dynamically, available to every subsequent step in that job (but not steps that already ran).
Explanation: Tests understanding that `$GITHUB_ENV` is how a value computed at runtime (e.g. a version string) becomes an ordinary env var for later steps.

**Q18. Where can GitHub Secrets be scoped, and what's the practical effect of each scope?**
Answer: Repository-level (available to any workflow in that repo), organization-level (shared across repos, optionally restricted to a subset), and Environment-level (only available to jobs that declare `environment: <name>`, and can be gated behind required reviewers).
Explanation: Environment-scoped secrets are the mechanism Phase 10 relies on to keep production credentials unreadable by an ungated staging job.

**Q19. Does GitHub's log masking of secret values guarantee a secret can never leak into logs?**
Answer: No — masking replaces exact matches of the known secret value in log output, but it can't catch a secret that's been transformed (base64-encoded, split across lines, partially printed) before being echoed, or a secret value that happens to be short/common enough to appear coincidentally.
Explanation: A frequently-missed nuance — candidates often assume masking is airtight security rather than a best-effort log scrub.

**Q20. What's the difference between an artifact and a job output, and when would you use each?**
Answer: A job output carries a small string value (a version number, a computed flag) between jobs via `needs.<job>.outputs`. An artifact carries actual files (a compiled binary, a test report, a coverage directory) between jobs — or out to a human — via `upload-artifact`/`download-artifact`, and persists on the run for its retention period.
Explanation: Conflating the two leads to trying to stuff file contents through a job output (which is a string with a size limit) instead of using an artifact.

**Q21. Why does `actions/cache` need a key built from something like `hashFiles('**/package-lock.json')` instead of a fixed string?**
Answer: A fixed key would return the same (now stale) cache forever, since cache entries are effectively immutable once written under a given key. Hashing the lockfile makes the key change exactly when the actual dependency set changes, triggering a fresh cache write, while `restore-keys` provides a prefix-matched fallback to a close-but-not-exact previous cache on a miss.
Explanation: Tests the core mental model of cache-key design: correctness (never serve stale deps) balanced against reuse (don't rebuild from scratch every time).

**Q22. In a build matrix that also varies OS, why must a cache key include `runner.os`?**
Answer: Dependency caches are frequently OS-specific (compiled artifacts, binary wheels, native modules) — using the same cache key across `ubuntu-latest` and `windows-latest` in the same matrix would let one OS's job restore a cache built for the other, corrupting the build.
Explanation: A concrete instance of "cross-matrix cache corruption," one of this phase's explicitly called-out failure modes.

**Q23. In `strategy.matrix`, if you define `os: [ubuntu-latest, windows-latest]` and `node-version: [18, 20, 22]`, how many job instances run?**
Answer: 6 — the dimensions multiply combinatorially (2 × 3), not add.
Explanation: A basic but frequently-missed arithmetic check on whether you understand matrix fan-out is combinatorial.

**Q24. What's the difference between a `matrix.include` entry that merges into an existing combination versus one that creates a new standalone combination?**
Answer: If an `include` entry's specified keys match values already present in the matrix's base dimensions, it merges additional keys/values into that existing combination. If its keys don't match any existing combination, it's added as an entirely new, standalone job instance.
Explanation: One of the subtler rules in this phase — candidates who've only used `include` for the "extra standalone case" get surprised by the merge behavior.

**Q25. What's the difference between `fail-fast: true` (the default) and `fail-fast: false` in a matrix strategy?**
Answer: With `fail-fast: true` (default), the moment any matrix combination fails, GitHub cancels all other still-running combinations in that matrix. `fail-fast: false` lets every combination run to completion regardless of others failing — useful for an exploratory matrix where you want to see every result rather than stopping at the first failure.
Explanation: Directly relevant to CI cost/time trade-offs — `fail-fast: false` is deliberately chosen when full result visibility matters more than saving runner minutes on a doomed run.

---

## Reusability, Custom Actions, CI & CD Patterns (Q26–Q35) — Phases 7–10

**Q26. What's the core structural difference between a reusable workflow (`workflow_call`) and a composite action?**
Answer: A reusable workflow defines one or more entire jobs — with their own `runs-on`, their own `strategy.matrix`, and a first-class `secrets:` contract — invoked via `uses: ./.github/workflows/callee.yml` from a job in the calling workflow. A composite action bundles a handful of steps (`runs.using: composite`) consumed as a single step inside an existing job, with no new job boundary and no dedicated `secrets:` mechanism.
Explanation: This is the phase's central decision question — "an entire job's structure" vs. "a few steps within one" is the line to draw when choosing between them.

**Q27. How do you pass a secret to a composite action?**
Answer: There is no `secrets:` syntax for composite actions. The action declares the value as a regular `input`, and the calling workflow passes it through `with:`, having sourced it from `${{ secrets.NAME }}` itself.
Explanation: A named trap question in the source material — candidates who answer "the same way as a reusable workflow, with `secrets:`" are describing a mechanism that only exists for reusable workflows, revealing they've conflated the two reuse mechanisms.

**Q28. If a composite action runs its own `actions/checkout@v4` internally, whose filesystem does that check out into?**
Answer: The calling job's own runner and working directory — composite action steps are not isolated; they execute directly inside the job that invoked them.
Explanation: Explains why calling a composite action that checks out code, from a job that already checked out code itself, results in checkout effectively running twice into the same directory (usually harmless, but a common source of confusion).

**Q29. What's the difference between building a JavaScript action and a Docker container action?**
Answer: A JavaScript action (`runs.using: node20`) runs directly on the runner via Node.js, reading inputs/setting outputs through the `@actions/core` toolkit — fast to start, but its dependencies must be bundled/vendored (or compiled with a tool like `@vercel/ncc`) since there's no `npm install` step. A Docker container action (`runs.using: docker`) packages its logic plus an entire runtime into a container image — any language, any system dependency — at the cost of container pull/build startup time and being Linux-runner-only.
Explanation: The classic trade-off question: startup speed and simplicity vs. language/dependency freedom.

**Q30. Why does pinning a third-party action to a moving tag like `v1` carry more trust risk than pinning to a specific version?**
Answer: A moving major-version tag (`v1`) can be silently repointed by the action's maintainer (or an attacker who compromises their account) to a different, possibly malicious, commit at any time — consumers referencing `v1` get whatever that tag currently points to, without any change on their own end. Pinning to an immutable full commit SHA guarantees the exact code that runs never changes underneath you.
Explanation: Previewed in Phase 8, resolved concretely in Phase 11 with SHA-pinning plus Dependabot to keep the pin current — expect this to connect forward to Q39/Q40 below.

**Q31. In a multi-language CI pipeline, what makes a test command's exit code "trustworthy," and why does that matter?**
Answer: A trustworthy test command is one whose exit code accurately reflects whether the tests actually passed — e.g. a test runner that returns 0 even when zero tests ran, or a coverage tool that doesn't fail its own exit code when the threshold isn't met, silently produces a pipeline that looks green without actually gating anything.
Explanation: Ties to the phase's core warning — "a project can run 'CI' for months that never actually gates anything" because nobody verified the last step (surfacing a genuinely failing status) actually works.

**Q32. Why should a CI pipeline upload a coverage report as an artifact even on a run where the coverage threshold check fails?**
Answer: So a human reviewer can open the detailed line-by-line report to see exactly which lines are uncovered, independent of whether the pass/fail gate itself passed — the artifact upload step should run regardless of the preceding threshold step's outcome (typically via `if: always()` or by not depending on that step's success).
Explanation: Connects artifact usage (Phase 5) with CI patterns (Phase 9) and the `always()` conditional (Phase 3) in one practical scenario.

**Q33. In a monorepo, why is change-detection feeding a dynamic matrix generally preferred over a coarse workflow-level `paths:` filter?**
Answer: A workflow-level `paths:` filter is all-or-nothing at the whole-workflow level and can strand a required status check (Q7) when unrelated paths change. A change-detection step (e.g. `git diff` or a `paths-filter`-style action) can compute exactly which packages changed and feed that list into a dynamically generated matrix (via `fromJSON()`), running per-package jobs only for what actually changed — while still needing to explicitly handle the "zero packages changed" edge case rather than silently running nothing or erroring.
Explanation: Combines Phase 2's static filters, Phase 6's dynamic matrices, and an explicit edge-case the phase calls out by name.

**Q34. What's the recommended container image tagging strategy for a CD pipeline, and why use two tags instead of one?**
Answer: Tag the built image with both a permanent, unique tag (the commit SHA) and a moving tag (`latest` or a branch name). The SHA tag guarantees you can always trace exactly which commit produced a given running image; the moving tag is what a deployment step typically references to "always deploy the newest."
Explanation: The commit-SHA tag is what makes a rollback or an incident investigation ("which commit is actually running in prod right now?") possible at all.

**Q35. Why is `kubectl rollout status` used after `kubectl set image`, instead of trusting that command's own immediate return?**
Answer: `kubectl set image` returns as soon as the Deployment spec is updated, not once the new pods are actually up and healthy — a broken image can be "successfully" set while the rollout itself later fails or pods crash-loop. `kubectl rollout status` blocks and reports the actual outcome of the rollout, giving the pipeline a trustworthy pass/fail signal to gate on.
Explanation: Directly parallels Q31's "trustworthy exit code" theme, applied to a deployment step instead of a test step.

---

## Security, Self-Hosted Runners, Governance & Production (Q36–Q50) — Phases 11–13

**Q36. What does an unscoped `GITHUB_TOKEN` default to, and why is that a problem?**
Answer: Without an explicit `permissions:` block, every job's `GITHUB_TOKEN` inherits the repository's (or organization's) configured default, which can range from read-only up to broad read/write access across contents, issues, pull requests, packages, and more. That's a large blast radius sitting unused by most jobs' actual task, available to every step (including third-party actions) in that job until something — a bug, a bad dependency, an untrusted trigger — turns "unused" into "exploited."
Explanation: The foundational scoping question this whole phase builds from.

**Q37. Does a job-level `permissions:` block merge with the workflow-level one, or replace it?**
Answer: It fully replaces the workflow-level defaults for that job — it does not merge. A job that only declares `packages: write`, intending to add to a workflow-level `contents: read`, actually loses `contents` access entirely for that job unless it's restated.
Explanation: One of the most commonly-cited "gotcha" facts in this phase — assuming merge behavior silently breaks a job the first time someone relies on an inherited scope.

**Q38. How would you scope the token for a workflow that only needs to comment on a pull request?**
Answer: `permissions: pull-requests: write`, ideally paired with a workflow-level `permissions: {}` so every other job in the file defaults to deny-all unless it explicitly opts back in.
Explanation: A concrete least-privilege exercise — the strong answer names the exact resource/level rather than reaching for `write-all`.

**Q39. What problem does OIDC-based cloud authentication solve compared to storing long-lived cloud access keys as secrets?**
Answer: Long-lived access keys sitting in secrets are a standing credential that, if ever leaked (logged, exfiltrated, misconfigured), remains valid until someone manually rotates or revokes it. OIDC lets the workflow request a short-lived, cryptographically signed identity token from GitHub at run time; the cloud provider verifies that token against a trust policy scoped to a specific repo/branch (and workflow, optionally) and issues a temporary credential valid only for that run — no long-lived secret is stored anywhere.
Explanation: The `id-token: write` permission is the concrete YAML lever tested alongside this concept — expect a follow-up asking for that permission name specifically.

**Q40. Why pin a third-party action to a full commit SHA instead of a version tag, and how does Dependabot keep that pin current without losing the safety benefit?**
Answer: A commit SHA is immutable — the exact code that runs can never change silently, unlike a moving tag (Q30) that a maintainer (or an attacker who compromises their account) could repoint. Dependabot keeps the SHA current automatically by parsing the `# vX.Y.Z` comment convention next to the pin (e.g. `uses: actions/checkout@b4ffde6... # v4.1.1`) and opening a PR that updates both the SHA and the comment together when a new release ships — a human still reviews and merges that PR, preserving the "nothing changes without review" guarantee.
Explanation: Ties the SHA-pinning practice to the specific comment convention that makes it maintainable rather than a one-time pin that silently goes stale.

**Q41. What does an SLSA build-provenance attestation (via `actions/attest-build-provenance`) actually prove, and what does it not prove?**
Answer: It proves an artifact was produced by a specific, named workflow run — a signed, verifiable statement of "this exact build job produced this exact artifact," which lets a downstream consumer verify the artifact wasn't tampered with after the build. It does not prove the source code itself is free of vulnerabilities, that the workflow's dependencies were trustworthy, or that the build logic was correct — it's a distinct threat model (post-build tampering detection) from source code review or dependency scanning.
Explanation: A precise-scope question — candidates who claim it "proves the code is secure" are overstating what provenance actually attests to.

**Q42. What's the security responsibility trade-off between a GitHub-hosted runner and a self-hosted runner?**
Answer: A GitHub-hosted runner is a clean, disposable VM that GitHub provisions and destroys per job — you get no persistence risk and no patching burden. A self-hosted runner is a machine you own: you're responsible for patching it, isolating it from sensitive internal resources, and accepting that anything a workflow (including a malicious PR's code, if triggers are misconfigured) executes on it runs with that machine's actual access and persists between jobs unless you tear it down yourself.
Explanation: The framing question for the entire self-hosted-runners lesson — "why would you accept this responsibility at all" (custom hardware, internal network access, cost at scale) is the expected follow-up.

**Q43. What's the difference between what a runner label and a runner group each control?**
Answer: A label (`self-hosted`, `linux`, `gpu`, or a custom label) answers "which runner has the right capability" — `runs-on` treats a list of labels as an AND, matching only a runner carrying every listed label. A runner group is a separate, org/enterprise-level access-control mechanism answering "which repositories or workflows are even allowed to schedule jobs on this set of runners" at all — independent of whatever labels those runners carry.
Explanation: Labels alone can't override a group's access restriction, and a group's access restriction can't substitute for correct labels — both checks must pass for a job to land.

**Q44. Where does the "require workflows to pass" governance capability live today, and what was the outdated understanding it replaced?**
Answer: It lives inside a **repository ruleset** (Settings → Rules → Rulesets, applied at the repo level or org-wide) as a "require workflows to pass" rule type. GitHub deprecated a standalone "required workflows" Actions settings page on October 18, 2023 — the equivalent capability was folded into repository rulesets, not left as a separate settings surface.
Explanation: A factual-currency check — this exact point has previously been a source of outdated/incorrect content in this course, so the corrected, ruleset-based understanding is the one to give.

**Q45. What's the difference between a ruleset's "require workflows to pass" rule and an org/enterprise actions allow-list policy?**
Answer: The allow-list is a negative control — it restricts which actions and reusable workflows a repository is even *permitted* to reference, configured in org/enterprise Actions settings. A ruleset's required-workflow rule is a positive control — it *adds* a workflow that must run and succeed across every repo the ruleset targets, regardless of whether that repo's own workflow file calls it. Orgs typically use both together: the ruleset guarantees a baseline check runs everywhere, and the allow-list guarantees nothing ungoverned can run alongside it.
Explanation: The two mechanisms are frequently conflated — this distinguishes "what's blocked" from "what's mandated."

**Q46. Is a workflow required by a ruleset's "require workflows to pass" rule the same governance mechanism as a shared reusable workflow (Phase 7)?**
Answer: No. A ruleset-required workflow is imposed by the org and applies regardless of whether the repo's own workflow calls it. A reusable workflow is opt-in — a team chooses to invoke it with `uses:`. A centrally-owned reusable workflow is only actually enforced everywhere if it is also specifically named in a ruleset's required-workflow rule; otherwise it's only running wherever some team chose to call it.
Explanation: Conflating the two leads to the false assumption that "we built one shared reusable workflow" automatically means "every repo is using it" — it doesn't, without the ruleset.

**Q47. When debugging a failed workflow run, what should you check before diving into `ACTIONS_STEP_DEBUG` logging?**
Answer: Read the run's existing logs and timing information first — which step actually failed, its exit code, and how long each step took — since that's often sufficient to diagnose the problem without needing deeper debug logging at all. `ACTIONS_STEP_DEBUG`/`ACTIONS_RUNNER_DEBUG` are for genuinely opaque failures where the standard log output doesn't explain what happened.
Explanation: Tests a practical debugging instinct — reaching for maximum verbosity before reading what's already there wastes time and can bury the signal in noise.

**Q48. Why doesn't re-running only the failed jobs fix a workflow that failed due to a real code or config bug?**
Answer: Re-running replays the exact same commit and configuration that already failed — if the failure is deterministic (a genuine bug, not flakiness or a transient infrastructure hiccup), it will fail again identically. Re-running is only useful for non-deterministic failures (network blips, flaky tests, transient runner issues); a real bug needs an actual code/config fix pushed as a new commit.
Explanation: Distinguishes "re-run" as a tool for flakiness from "re-run" as a substitute for actually fixing something — a common instinct to correct.

**Q49. What does a `concurrency` group with `cancel-in-progress: true` do, and why does it matter for cost?**
Answer: It groups workflow runs under a shared key (commonly the branch or PR ref) so that when a new run starts for that same key, GitHub cancels any already-running run in that same group instead of letting both run to completion. This avoids wasting runner minutes finishing a build for a commit that's already been superseded by a newer push to the same PR/branch.
Explanation: The primary cost lever this phase introduces, meant to be combined with caching (Phase 5) and scoped triggers (Phase 2) rather than used alone.

**Q50. In a system-design-style "design a CI/CD pipeline" interview question, what should you volunteer proactively rather than wait to be asked about?**
Answer: Security and cost reasoning — e.g. scoping `permissions:` down instead of leaving defaults, using OIDC instead of static cloud credentials, gating production behind an Environment with required reviewers, and using caching plus `concurrency`/`cancel-in-progress` to control cost — alongside the basic clarify-the-target → sketch-triggers-and-jobs structure of the answer itself.
Explanation: The capstone framing of the whole course: a candidate who only sketches triggers and jobs, and waits to be asked about security or cost, reads as less senior than one who raises both unprompted.
