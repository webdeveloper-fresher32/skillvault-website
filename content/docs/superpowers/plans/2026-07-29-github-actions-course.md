# GitHub Actions Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete `GithubActions/` course in SkillVault — 13 phases (workflow fundamentals through enterprise/security topics), each with a phase README and numbered lessons; a `Projects/` folder of 3 end-to-end pipelines; a `Quick-Reference/` folder (cheatsheet + 50 interview Q&A); and a course-level README — matching the structural conventions of Docker/Kubernetes/MongoDB/MySQL/HLD.

**Architecture:** Pure-content repo (no build system, no tests, per `CLAUDE.md`). "Verification" means checking each file's structure (required headings present, YAML code blocks are well-formed/parseable, links resolve) rather than running a test suite — GitHub Actions workflows can't be executed standalone outside a real repo/runner. Where a lesson includes genuinely executable code (JavaScript for custom actions, or shell snippets that don't depend on the Actions runtime context), that code must actually be run and verified, same discipline as the DSA course. Each task produces one phase (or one top-level folder) fully populated and committed independently.

**Tech Stack:** GitHub-flavored Markdown, YAML (workflow examples), JavaScript (custom actions), some shell.

**Lesson format (applies to every lesson file in Phases 1–13):**
```markdown
# <Topic>

## 1. Problem
(the real-world CI/CD scenario that motivates this topic — 1-2 short paragraphs)

## 2. Analogy
(an intuitive, non-technical comparison that makes the mechanism click)

## 3. Internal Flow
(how the mechanism actually works, step by step — prose + a short numbered walkthrough)

## 4. Example
(a fully worked example — primarily a realistic GitHub Actions workflow YAML snippet in a fenced ```yaml block; JavaScript/shell where relevant, in ```js / ```bash blocks)

## 5. Compare
(how this relates to or differs from adjacent topics/techniques covered elsewhere in the course)

## 6. Common Mistakes
(3-5 concrete pitfalls learners/practitioners hit, as a bullet list)

## 7. Interview Angle
(how this shows up in interviews — typical framing, common follow-up questions/variations)

## 8. Memory Hook
(one short mnemonic or one-liner takeaway for recall)
```

Every lesson file must contain exactly these 8 `## ` headings, in this order, each populated (no empty sections). Every YAML example must be well-formed (verify with a YAML parser, e.g. `python3 -c "import yaml, sys; yaml.safe_load(open(sys.argv[1]).read())"` on the extracted snippet, or equivalent). Every JavaScript/shell snippet that doesn't depend on the GitHub Actions runtime context (i.e., could run in a plain Node/shell environment) must actually be executed and verified, not hand-written.

**Phase README format (matches `Docker/Phase-01-Fundamentals/README.md`):**
```markdown
# Phase N: <Phase Title>

## What You'll Learn
(1-2 sentences)

## Learning Objectives
- ...

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Xxx.md](01-Xxx.md) | ... | ... |

## Estimated Time
(N days)

## Next Phase
→ [Phase N+1: <Title>](../Phase-NN-<Title>/README.md)
```
(Phase 13's "Next Phase" line instead reads `→ [Projects](../Projects/README.md)`.)

---

### Task 1: Phase 01 — Fundamentals and Workflow Syntax

**Files:**
- Create: `GithubActions/Phase-01-Fundamentals-and-Workflow-Syntax/README.md`
- Create: `GithubActions/Phase-01-Fundamentals-and-Workflow-Syntax/01-YAML-Basics-for-Workflows.md`
- Create: `GithubActions/Phase-01-Fundamentals-and-Workflow-Syntax/02-Workflow-File-Anatomy.md`
- Create: `GithubActions/Phase-01-Fundamentals-and-Workflow-Syntax/03-Uses-vs-Run-and-the-Step-Model.md`

- [ ] **Step 1: Write the 3 lesson files**, each following the Lesson Format above exactly:
  - `01-YAML-Basics-for-Workflows.md`: YAML syntax essentials needed to read/write workflows — key-value pairs, nesting via indentation, lists (`-` items), strings vs multi-line strings (`|` and `>`), booleans/the classic YAML `on`/`true` gotcha (why GitHub Actions historically needed `"on":` quoted in some parsers). Example: a minimal valid workflow YAML file annotated line by line, verified well-formed via a YAML parser. Common mistakes: inconsistent indentation breaking the document; forgetting that YAML keys like `on`, `yes`, `no` can be parsed as booleans by some YAML processors if unquoted (historically relevant, worth flagging even though GitHub's parser handles `on:` correctly today); using tabs instead of spaces for indentation (invalid YAML).
  - `02-Workflow-File-Anatomy.md`: the top-level structure of a workflow file (`name`, `on`, `jobs`), where workflow files must live (`.github/workflows/*.yml`), how a workflow run is triggered and shows up in the Actions tab. Example: a complete minimal workflow (checkout + run a command), annotated section by section, verified well-formed YAML. Common mistakes: placing the workflow file outside `.github/workflows/`; forgetting `name` (works, but produces a less useful UI label defaulting to the file path); malformed `jobs` structure (jobs must be a map keyed by job ID, not a list).
  - `03-Uses-vs-Run-and-the-Step-Model.md`: the step model (a job is a sequence of steps, each either `uses` a pre-built action or `run`s a shell command), how `uses` references work (owner/repo@ref, or a local path, or a Docker image reference), the implicit shell environment for `run` steps. Example: a workflow mixing both `uses` (checkout, setup-node) and `run` (npm install/test) steps, verified well-formed YAML. Common mistakes: mixing up `uses` and `run` syntax (e.g. trying to pass `with:` to a `run` step, which is invalid); forgetting that consecutive `run` steps in the same job share filesystem state but NOT shell state (each `run` step is a new shell process) unless using `$GITHUB_ENV`/`$GITHUB_OUTPUT` to pass data.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 1: Fundamentals and Workflow Syntax". Learning Objectives: read and write valid workflow YAML; explain a workflow file's top-level anatomy; distinguish `uses` steps from `run` steps and know when shell state persists across steps. Topics table lists all 3 files with time estimates (1 day each). Estimated Time: 3 days. Next Phase links to `../Phase-02-Triggers-and-Events/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Phase-01-Fundamentals-and-Workflow-Syntax/0*.md` — expect 8 per lesson file.
  Run: `grep -L '```yaml' GithubActions/Phase-01-Fundamentals-and-Workflow-Syntax/0*.md` — expect no output (every lesson has a YAML block).
  For each YAML example, extract and validate with a YAML parser — expect no parse errors.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Phase-01-Fundamentals-and-Workflow-Syntax
  git commit -m "Add GitHub Actions Phase 1: Fundamentals and Workflow Syntax"
  ```

---

### Task 2: Phase 02 — Triggers and Events

**Files:**
- Create: `GithubActions/Phase-02-Triggers-and-Events/README.md`
- Create: `GithubActions/Phase-02-Triggers-and-Events/01-Push-and-Pull-Request-Triggers.md`
- Create: `GithubActions/Phase-02-Triggers-and-Events/02-Schedule-and-Manual-Triggers.md`
- Create: `GithubActions/Phase-02-Triggers-and-Events/03-Event-Filters-Branches-Paths-Tags.md`

- [ ] **Step 1: Write the 3 lesson files**:
  - `01-Push-and-Pull-Request-Triggers.md`: `on: push` and `on: pull_request` (and `pull_request_target` and why it's dangerous with untrusted forks — runs with write-level secrets against fork code unless carefully gated), PR activity types (`opened`, `synchronize`, `reopened`, etc.), the difference between a push-triggered run and a PR-triggered run for the same commit. Example: a workflow triggered on push to `main` and on PR against `main`, showing both trigger blocks, verified well-formed YAML. Common mistakes: using `pull_request_target` without understanding it checks out the base branch by default (not the PR's code) unless explicitly configured, a real security foot-gun; forgetting `pull_request` triggers run on the merge commit of the PR by default, not the head commit, which can confuse debugging.
  - `02-Schedule-and-Manual-Triggers.md`: `on: schedule` (cron syntax, UTC timezone, the "at least 5 minutes" minimum interval and GitHub's best-effort/delayed-under-load scheduling), `on: workflow_dispatch` (manual trigger with typed `inputs`), `on: repository_dispatch` (external/API-triggered). Example: a workflow with a cron schedule plus a `workflow_dispatch` block with a choice-type input, verified well-formed YAML. Common mistakes: assuming scheduled runs fire at the exact minute specified (GitHub explicitly documents delays under load); forgetting `workflow_dispatch` only appears as a manually-runnable option in the Actions UI once the workflow file exists on the default branch.
  - `03-Event-Filters-Branches-Paths-Tags.md`: `branches`/`branches-ignore`, `paths`/`paths-ignore`, `tags`/`tags-ignore` filters, glob pattern syntax, why path filters don't make a job "required" in branch protection unless the workflow always reports a status even when filtered out (a common gotcha). Example: a workflow filtered to run only on changes under `src/**` and only for `main`/`release/*` branches, verified well-formed YAML. Common mistakes: combining `paths` filters with required-status-check branch protection, causing PRs with no matching path changes to get stuck "waiting" forever since the job never runs to report success; glob pattern mistakes (e.g. `src/*` only matching one level deep, not `src/**` for recursive).

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 2: Triggers and Events". Objectives: choose the right event trigger for a scenario; understand PR-trigger security nuances; use path/branch filters correctly with branch protection in mind. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-03-Jobs-Steps-and-Runners/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Phase-02-Triggers-and-Events/0*.md` — expect 8 per file.
  Validate all YAML examples parse cleanly.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Phase-02-Triggers-and-Events
  git commit -m "Add GitHub Actions Phase 2: Triggers and Events"
  ```

---

### Task 3: Phase 03 — Jobs, Steps, and Runners

**Files:**
- Create: `GithubActions/Phase-03-Jobs-Steps-and-Runners/README.md`
- Create: `GithubActions/Phase-03-Jobs-Steps-and-Runners/01-Job-Dependencies-and-Needs.md`
- Create: `GithubActions/Phase-03-Jobs-Steps-and-Runners/02-Runners-and-Runs-On.md`
- Create: `GithubActions/Phase-03-Jobs-Steps-and-Runners/03-Job-and-Step-Outputs.md`
- Create: `GithubActions/Phase-03-Jobs-Steps-and-Runners/04-Conditional-Execution-and-Timeouts.md`

- [ ] **Step 1: Write the 4 lesson files**:
  - `01-Job-Dependencies-and-Needs.md`: jobs run in parallel by default, `needs` creates a dependency graph, a failed dependency skips downstream jobs by default (unless `if: always()`/`if: failure()` overrides). Example: a 3-job workflow (`build` → `test` and `lint` in parallel, both feeding into `deploy` via `needs: [test, lint]`), verified well-formed YAML. Common mistakes: creating a circular `needs` dependency (invalid workflow); assuming a downstream job runs even if an upstream `needs` job fails, without realizing the default behavior is to skip it.
  - `02-Runners-and-Runs-On.md`: `runs-on` targeting GitHub-hosted runners (ubuntu-latest, windows-latest, macos-latest and pinned OS versions), the resource/tooling differences between OS runners, `runs-on` as a list for label-matching (relevant for self-hosted, previewed here and covered fully in a later phase). Example: a matrix-free workflow running the same job on `ubuntu-latest` and `windows-latest` to show OS-specific step differences (e.g. shell defaults), verified well-formed YAML. Common mistakes: assuming all pre-installed tools/versions are identical across OS runners (they differ and change over time — pin versions explicitly rather than relying on "latest" tool versions); not accounting for `windows-latest`'s default shell being PowerShell rather than bash, breaking bash-specific `run` steps.
  - `03-Job-and-Step-Outputs.md`: step outputs via `$GITHUB_OUTPUT`, referencing them as `steps.<id>.outputs.<name>`, job outputs (declared at the job level, referencing a step's output) referenced downstream as `needs.<job>.outputs.<name>`. Example: a `build` job producing a version-string output consumed by a downstream `deploy` job via `needs`, verified well-formed YAML. Common mistakes: forgetting a step needs an explicit `id` before its outputs can be referenced; forgetting a job must explicitly declare `outputs:` mapping to a step's output — job outputs aren't automatically visible to other jobs just because a step set one.
  - `04-Conditional-Execution-and-Timeouts.md`: `if` conditions at job/step level using expression syntax, default status-check functions (`success()`, `failure()`, `always()`, `cancelled()`), `timeout-minutes` at job and step level, `continue-on-error`. Example: a job with a step that only runs `if: github.event_name == 'push'`, and a cleanup step with `if: always()`, verified well-formed YAML. Common mistakes: forgetting that a step's `if` without an explicit status function implicitly means `success()` (so it won't run after a prior step failure) — a common surprise when someone expects a step to "always" run; setting `continue-on-error: true` without realizing the job as a whole still reports success, potentially hiding real failures from status checks.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 3: Jobs, Steps, and Runners". Objectives: design multi-job dependency graphs correctly; choose appropriate runners; pass data between jobs/steps via outputs; use conditional execution and timeouts safely. Topics table, 1 day each (4 days). Estimated Time: 4 days. Next Phase → `../Phase-04-Environment-Secrets-and-Variables/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Phase-03-Jobs-Steps-and-Runners/0*.md` — expect 8 per file.
  Validate all YAML examples parse cleanly.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Phase-03-Jobs-Steps-and-Runners
  git commit -m "Add GitHub Actions Phase 3: Jobs, Steps, and Runners"
  ```

---

### Task 4: Phase 04 — Environment, Secrets, and Variables

**Files:**
- Create: `GithubActions/Phase-04-Environment-Secrets-and-Variables/README.md`
- Create: `GithubActions/Phase-04-Environment-Secrets-and-Variables/01-Env-Vars-at-Workflow-Job-Step-Level.md`
- Create: `GithubActions/Phase-04-Environment-Secrets-and-Variables/02-GitHub-Secrets-and-Environments.md`
- Create: `GithubActions/Phase-04-Environment-Secrets-and-Variables/03-Contexts-and-Expression-Syntax.md`

- [ ] **Step 1: Write the 3 lesson files**:
  - `01-Env-Vars-at-Workflow-Job-Step-Level.md`: `env:` block at workflow/job/step level and precedence (step overrides job overrides workflow), the difference between `env:` (static, defined in YAML) and dynamically set variables via `$GITHUB_ENV` (persisted for later steps in the same job). Example: a workflow with an `env` var at the workflow level, overridden at the job level, and a step that sets a new var via `echo "VAR=value" >> $GITHUB_ENV` for a later step to consume, verified well-formed YAML. Common mistakes: expecting a shell `export` in one `run` step to persist to the next `run` step (it doesn't — each step is a new shell process; must use `$GITHUB_ENV` instead); assuming `env` vars are automatically available as YAML expression context (`env.VAR` in `if:`) without realizing shell env vars and the `env` expression context are related but accessed differently.
  - `02-GitHub-Secrets-and-Environments.md`: repository/organization/environment-scoped Secrets, referencing them via `${{ secrets.NAME }}`, GitHub Environments as a way to gate deployments with required reviewers/wait timers and environment-specific secrets, why secrets are masked in logs (and the caveat that this masking is a best-effort string match, not a guarantee against all forms of leakage). Example: a `deploy` job scoped to a `production` Environment referencing an environment-specific secret, verified well-formed YAML. Common mistakes: assuming secret masking in logs is foolproof (it only masks the literal secret string — transformed/encoded versions of a secret can leak); putting secrets directly in `env:` at the workflow level when they should be job/step-scoped to limit blast radius, or when they should come from an Environment specifically to get the approval-gate benefit.
  - `03-Contexts-and-Expression-Syntax.md`: the `${{ }}` expression syntax, the built-in contexts (`github`, `env`, `secrets`, `steps`, `needs`, `job`, `runner`, `matrix`), common expression functions (`contains()`, `startsWith()`, `format()`, `toJSON()`), how expressions are evaluated before the step runs (not by the shell). Example: a workflow using `github.event_name`, `github.ref`, and a `format()` expression to build a dynamic tag string, verified well-formed YAML. Common mistakes: trying to use bash-style variable expansion inside `${{ }}` (it's a different expression language, not shell); forgetting that expressions inside `run:` are substituted as literal text BEFORE the shell sees them, which can create quoting/injection issues if an expression value contains untrusted user input (e.g. a PR title) — a real security consideration, worth flagging even briefly here since it's expanded on in the Security phase.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 4: Environment, Secrets, and Variables". Objectives: manage env-var scope and precedence correctly; use Secrets and Environments appropriately including the approval-gate pattern; read and write expression syntax across the built-in contexts. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-05-Artifacts-and-Caching/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Phase-04-Environment-Secrets-and-Variables/0*.md` — expect 8 per file.
  Validate all YAML examples parse cleanly.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Phase-04-Environment-Secrets-and-Variables
  git commit -m "Add GitHub Actions Phase 4: Environment, Secrets, and Variables"
  ```

---

### Task 5: Phase 05 — Artifacts and Caching

**Files:**
- Create: `GithubActions/Phase-05-Artifacts-and-Caching/README.md`
- Create: `GithubActions/Phase-05-Artifacts-and-Caching/01-Upload-and-Download-Artifacts.md`
- Create: `GithubActions/Phase-05-Artifacts-and-Caching/02-Actions-Cache-and-Dependency-Caching.md`
- Create: `GithubActions/Phase-05-Artifacts-and-Caching/03-Cache-Key-Strategy-and-Invalidation.md`

- [ ] **Step 1: Write the 3 lesson files**:
  - `01-Upload-and-Download-Artifacts.md`: `actions/upload-artifact` and `actions/download-artifact`, artifacts as a way to pass build output between jobs (unlike outputs, which only pass small strings) or to persist a workflow run's results (test reports, build binaries), default retention period. Example: a `build` job uploading a compiled binary as an artifact and a `deploy` job downloading it, verified well-formed YAML. Common mistakes: trying to use artifacts to pass data between STEPS in the same job (unnecessary — same-job steps share the filesystem directly; artifacts are for cross-job or post-run persistence); forgetting artifacts have a default retention period after which they're deleted, and not overriding it for artifacts that need to persist longer.
  - `02-Actions-Cache-and-Dependency-Caching.md`: `actions/cache` for speeding up dependency installs (npm/pip/maven/gradle caches), how a cache hit/miss works, the built-in caching shortcuts in setup-* actions (e.g. `actions/setup-node`'s `cache: npm` option) versus manually configuring `actions/cache`. Example: a workflow caching `node_modules` (or the npm cache directory) keyed on a hash of the lockfile, verified well-formed YAML. Common mistakes: caching the wrong directory (e.g. caching `node_modules` directly across OS/Node-version matrix cells, which can cause native-binary mismatches — safer to cache the package manager's download cache instead in many cases); not including OS/version in the cache key when the matrix varies by OS, causing cross-OS cache corruption.
  - `03-Cache-Key-Strategy-and-Invalidation.md`: designing a good cache key (hash of lockfile + OS + tool version), `restore-keys` for partial-match fallback, why caches are immutable once created (a key match returns the exact same cache, so a key must change to invalidate), manual cache eviction via the Actions UI/API or a rotating key prefix. Example: a cache configuration using `hashFiles('**/package-lock.json')` in the key plus a `restore-keys` fallback prefix, verified well-formed YAML. Common mistakes: reusing the exact same cache key across dependency changes, causing a stale cache to be silently reused instead of the new dependencies (should change on lockfile hash); relying solely on `restore-keys` fallback without any exact key, causing every run to treat the cache as a miss and needing to re-save.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 5: Artifacts and Caching". Objectives: choose artifacts vs caching correctly for a given data-passing need; design cache keys that invalidate correctly; avoid cross-matrix cache corruption. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-06-Matrix-Builds-and-Strategy/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Phase-05-Artifacts-and-Caching/0*.md` — expect 8 per file.
  Validate all YAML examples parse cleanly.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Phase-05-Artifacts-and-Caching
  git commit -m "Add GitHub Actions Phase 5: Artifacts and Caching"
  ```

---

### Task 6: Phase 06 — Matrix Builds and Strategy

**Files:**
- Create: `GithubActions/Phase-06-Matrix-Builds-and-Strategy/README.md`
- Create: `GithubActions/Phase-06-Matrix-Builds-and-Strategy/01-Matrix-Strategy-Basics.md`
- Create: `GithubActions/Phase-06-Matrix-Builds-and-Strategy/02-Include-Exclude-and-Dynamic-Matrices.md`
- Create: `GithubActions/Phase-06-Matrix-Builds-and-Strategy/03-Fail-Fast-and-Max-Parallel.md`

- [ ] **Step 1: Write the 3 lesson files**:
  - `01-Matrix-Strategy-Basics.md`: `strategy.matrix` fans a single job definition out into multiple parallel job runs (one per combination), referencing matrix values via `${{ matrix.<key> }}`, how matrix combinations multiply (2 OS × 3 Node versions = 6 jobs). Example: a test job matrixed across `os: [ubuntu-latest, windows-latest]` and `node-version: [18, 20, 22]`, verified well-formed YAML. Common mistakes: not realizing matrix dimensions multiply combinatorially, leading to an explosion of job runs and CI minutes usage for large matrices; forgetting `${{ matrix.node-version }}` requires the exact key name used in the matrix definition (typos silently produce an empty/undefined value rather than an error in some contexts).
  - `02-Include-Exclude-and-Dynamic-Matrices.md`: `matrix.include` to add extra specific combinations (including combinations outside the cross-product) or extra variables tied to specific combinations, `matrix.exclude` to remove specific combinations from the cross-product, generating a matrix dynamically from a prior job's output (e.g. a JSON list of changed packages in a monorepo) via `fromJSON()`. Example: a matrix with `exclude` removing an incompatible OS/version pairing, plus a second example showing a dynamically-generated matrix from a prior job's JSON output, verified well-formed YAML. Common mistakes: expecting `include` entries that don't match any existing matrix dimension keys to merge into ALL combinations rather than adding a new standalone combination (the actual behavior depends on whether the include's keys already exist in the matrix — this is one of the most confusing matrix behaviors and deserves a clear worked explanation); forgetting `fromJSON()` is required to parse a string-typed job output back into a real list/object for the matrix to consume.
  - `03-Fail-Fast-and-Max-Parallel.md`: `strategy.fail-fast` (default true — cancels all in-progress matrix jobs if any one fails) and when to set it `false` to let all combinations finish and report results independently, `strategy.max-parallel` to cap concurrent matrix jobs (e.g. to avoid overwhelming a shared external resource or hitting runner concurrency limits). Example: a matrix workflow with `fail-fast: false` and `max-parallel: 2`, verified well-formed YAML. Common mistakes: leaving `fail-fast` at its default `true` for an exploratory/informational matrix (e.g. testing against many dependency versions) where you actually want to see ALL results even if one combination fails; setting `max-parallel` too low for a large matrix, causing a needlessly slow total wall-clock time.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 6: Matrix Builds and Strategy". Objectives: design matrix strategies that scale sensibly; use include/exclude and dynamic matrices correctly; tune fail-fast/max-parallel for the situation. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-07-Reusable-Workflows-and-Composite-Actions/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Phase-06-Matrix-Builds-and-Strategy/0*.md` — expect 8 per file.
  Validate all YAML examples parse cleanly.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Phase-06-Matrix-Builds-and-Strategy
  git commit -m "Add GitHub Actions Phase 6: Matrix Builds and Strategy"
  ```

---

### Task 7: Phase 07 — Reusable Workflows and Composite Actions

**Files:**
- Create: `GithubActions/Phase-07-Reusable-Workflows-and-Composite-Actions/README.md`
- Create: `GithubActions/Phase-07-Reusable-Workflows-and-Composite-Actions/01-Reusable-Workflows-with-Workflow-Call.md`
- Create: `GithubActions/Phase-07-Reusable-Workflows-and-Composite-Actions/02-Composite-Actions.md`
- Create: `GithubActions/Phase-07-Reusable-Workflows-and-Composite-Actions/03-Choosing-Reusable-Workflow-vs-Composite-Action.md`

- [ ] **Step 1: Write the 3 lesson files**:
  - `01-Reusable-Workflows-with-Workflow-Call.md`: `on: workflow_call` makes a workflow file callable from another workflow, declaring `inputs`/`secrets`/`outputs` in the callee, invoking it via `jobs.<id>.uses: ./.github/workflows/callee.yml` (or a cross-repo reference) with `with:`/`secrets:`, secrets do NOT automatically inherit unless `secrets: inherit` is used. Example: a reusable `build-and-test.yml` workflow with typed inputs, called from a caller workflow, verified well-formed YAML for both files. Common mistakes: forgetting secrets don't automatically pass through to a called reusable workflow (must explicitly pass or use `secrets: inherit`); nesting `workflow_call` workflows too deeply (there's a maximum nesting depth) or trying to call a reusable workflow from a matrix job in an unsupported way for the GitHub Actions version in use.
  - `02-Composite-Actions.md`: a composite action bundles multiple `run`/`uses` steps into one reusable unit via `action.yml` with `runs.using: composite`, declaring `inputs` (composite actions don't support `secrets:` as a distinct concept the way reusable workflows do — secrets must be passed as regular inputs), referencing inputs via `${{ inputs.name }}` inside the composite's own steps. Example: a composite action that checks out code, sets up Node, and runs `npm ci` as one reusable step, consumed from a calling workflow via `uses: ./.github/actions/setup-project`, verified well-formed YAML for both files. Common mistakes: trying to use `secrets:` syntax when calling a composite action (composite actions only accept `with:` inputs, not a separate secrets mechanism — a real and common point of confusion vs. reusable workflows); forgetting a composite action's steps run in the context of the CALLING job, sharing its runner/filesystem, unlike a reusable workflow which runs as its own separate job(s).
  - `03-Choosing-Reusable-Workflow-vs-Composite-Action.md`: decision criteria — composite actions are for bundling a handful of steps WITHIN a single job (lightweight, no new job boundary), reusable workflows are for sharing entire job/multi-job structures (including their own `runs-on`, matrix, secrets handling) across workflows or repos. Example: side-by-side comparison of the same "checkout + setup + install" logic implemented as a composite action vs. wrapped in a reusable workflow, showing where each is the better fit, verified well-formed YAML. Common mistakes: reaching for a full reusable workflow when a lightweight composite action would suffice (unnecessary job-boundary overhead); reaching for a composite action when the actual need is to share an entire job's `runs-on`/`strategy.matrix` configuration, which only a reusable workflow can express.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 7: Reusable Workflows and Composite Actions". Objectives: build and consume reusable workflows with typed inputs/secrets/outputs; build and consume composite actions; choose the right reuse mechanism for a given situation. Topics table, 1-2 days each. Estimated Time: 4 days. Next Phase → `../Phase-08-Custom-Actions-Development/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Phase-07-Reusable-Workflows-and-Composite-Actions/0*.md` — expect 8 per file.
  Validate all YAML examples parse cleanly.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Phase-07-Reusable-Workflows-and-Composite-Actions
  git commit -m "Add GitHub Actions Phase 7: Reusable Workflows and Composite Actions"
  ```

---

### Task 8: Phase 08 — Custom Actions Development

**Files:**
- Create: `GithubActions/Phase-08-Custom-Actions-Development/README.md`
- Create: `GithubActions/Phase-08-Custom-Actions-Development/01-JavaScript-Actions.md`
- Create: `GithubActions/Phase-08-Custom-Actions-Development/02-Docker-Container-Actions.md`
- Create: `GithubActions/Phase-08-Custom-Actions-Development/03-Versioning-and-Publishing-to-Marketplace.md`

- [ ] **Step 1: Write the 3 lesson files**:
  - `01-JavaScript-Actions.md`: a JavaScript action's `action.yml` (`runs.using: node20`, `runs.main`), using `@actions/core` for reading inputs (`core.getInput`), setting outputs (`core.setOutput`), and failing the action (`core.setFailed`), the need to bundle/vendor `node_modules` (or use `@vercel/ncc` to compile to a single file) since the action's repo is used directly, not npm-installed. Example: a minimal working JavaScript action's `index.js` reading an input and setting an output — this JS snippet must actually be executed (with `@actions/core`'s behavior mocked/stubbed or via directly setting the `INPUT_*`/`GITHUB_OUTPUT` env vars it reads, since it doesn't depend on the full Actions runtime beyond env vars and file I/O) and its real output verified. Common mistakes: committing an action that requires `npm install` to run (it won't have one — either commit `node_modules` or compile to a single bundled file); forgetting `core.getInput` reads from an env var named `INPUT_<NAME_UPPERCASED_WITH_UNDERSCORES>`, so an input's YAML name and its runtime env var name follow a specific transformation.
  - `02-Docker-Container-Actions.md`: a Docker action's `action.yml` (`runs.using: docker`, `runs.image`), the `Dockerfile` `ENTRYPOINT`, how inputs are passed as environment variables OR command-line args (depending on `args:` in `action.yml`), why Docker actions are slower to start (image build/pull) but language-agnostic. Example: a minimal Docker action's `Dockerfile` and `entrypoint.sh` reading an input via env var and writing to `$GITHUB_OUTPUT`, with the shell script's core logic verified by running it directly (not inside an actual container, since that's outside this course's scope, but the shell logic itself must be correct and tested). Common mistakes: using `runs.image: Dockerfile` (build from source, slower, rebuilds every run unless cached) when a pre-built image reference would be faster for a stable action; forgetting Docker actions only run on Linux runners, breaking a workflow that tries to use one on `windows-latest`/`macos-latest`.
  - `03-Versioning-and-Publishing-to-Marketplace.md`: tagging convention for actions (`v1`, `v1.2.3`, and the common practice of a moving major-version tag `v1` that gets re-pointed to the latest `v1.x.y`), the `action.yml` metadata needed for Marketplace listing (`name`, `description`, `branding`), the security implications of consumers pinning to a moving tag vs. a full commit SHA (previewed here, covered in depth in the Security phase). Example: a short git-tagging workflow shown as shell commands (creating `v1.0.0`, then moving the `v1` tag to point to it) — these are real git commands, so they should be described precisely enough to be correct, though not necessarily executed against a live throwaway repo within this lesson. Common mistakes: publishing an action without a stable major-version tag, forcing every consumer to pin to exact patch versions and miss automatic fixes; forgetting to update the moving major-version tag when releasing a new patch, leaving consumers pinned to `v1` stuck on an old commit.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 8: Custom Actions Development". Objectives: build a working JavaScript action; build a working Docker container action; understand action versioning/tagging conventions and Marketplace publishing basics. Topics table, 1-2 days each. Estimated Time: 4 days. Next Phase → `../Phase-09-CI-Patterns/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Phase-08-Custom-Actions-Development/0*.md` — expect 8 per file.
  Validate all YAML examples parse cleanly. Actually execute the JavaScript action example (file 01) and the shell logic in the Docker action example (file 02) with realistic env-var inputs, confirming real output.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Phase-08-Custom-Actions-Development
  git commit -m "Add GitHub Actions Phase 8: Custom Actions Development"
  ```

---

### Task 9: Phase 09 — CI Patterns

**Files:**
- Create: `GithubActions/Phase-09-CI-Patterns/README.md`
- Create: `GithubActions/Phase-09-CI-Patterns/01-Multi-Language-Test-Pipelines.md`
- Create: `GithubActions/Phase-09-CI-Patterns/02-Linting-and-Code-Coverage.md`
- Create: `GithubActions/Phase-09-CI-Patterns/03-Monorepo-Path-Filtered-CI.md`

- [ ] **Step 1: Write the 3 lesson files**:
  - `01-Multi-Language-Test-Pipelines.md`: structuring CI for a project with a test suite (setup runtime → install deps with caching → run tests → publish results), using `setup-*` actions (`setup-node`, `setup-python`, etc.), reporting test results as a required PR status check. Example: a complete test-pipeline workflow for a Node.js project (checkout, setup-node with cache, npm ci, npm test), verified well-formed YAML. Common mistakes: forgetting to pin a specific runtime version (relying on whatever "latest" resolves to at runner-image-update time, causing surprise breakage); not failing the job appropriately when tests fail (e.g. a test runner that exits 0 even on failure due to misconfiguration, silently passing CI).
  - `02-Linting-and-Code-Coverage.md`: running a linter as a separate CI job (parallel to tests, fast feedback), generating and reporting code coverage (uploading a coverage report as an artifact, or using a coverage-comment action on PRs), setting a coverage threshold that fails CI if not met. Example: a workflow running a linter and a coverage-generating test command in parallel jobs, uploading the coverage report as an artifact, verified well-formed YAML. Common mistakes: running lint and test sequentially in one job when they're independent and could run in parallel jobs for faster feedback; not fixing a coverage threshold to the actual project baseline, causing either a threshold too strict (blocks all PRs) or too loose (provides no signal).
  - `03-Monorepo-Path-Filtered-CI.md`: combining `paths` filters (from Phase 2) with matrix/dynamic-matrix generation (from Phase 6) to only run CI for the packages actually changed in a monorepo, using `git diff`/`dorny/paths-filter`-style actions to detect changed packages and feed them into a job matrix. Example: a workflow using a path-filter step to detect changed packages and generate a JSON matrix consumed by a downstream test job, verified well-formed YAML, cross-referencing the dynamic-matrix lesson from Phase 6. Common mistakes: using workflow-level `paths` filters alone for a monorepo (too coarse — it either runs for the whole monorepo or not at all, rather than scoping to just the changed package); not handling the "no packages changed" edge case in the dynamic matrix generation (an empty matrix can behave unexpectedly if not explicitly handled).

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 9: CI Patterns". Objectives: build a complete test pipeline with caching; separate linting/coverage into fast parallel feedback; scope CI efficiently in a monorepo. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-10-CD-Patterns/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Phase-09-CI-Patterns/0*.md` — expect 8 per file.
  Validate all YAML examples parse cleanly.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Phase-09-CI-Patterns
  git commit -m "Add GitHub Actions Phase 9: CI Patterns"
  ```

---

### Task 10: Phase 10 — CD Patterns

**Files:**
- Create: `GithubActions/Phase-10-CD-Patterns/README.md`
- Create: `GithubActions/Phase-10-CD-Patterns/01-Container-Registry-Build-and-Push.md`
- Create: `GithubActions/Phase-10-CD-Patterns/02-Deploying-to-Kubernetes.md`
- Create: `GithubActions/Phase-10-CD-Patterns/03-Environment-Gated-Approvals-for-Production.md`

- [ ] **Step 1: Write the 3 lesson files**:
  - `01-Container-Registry-Build-and-Push.md`: building a Docker image in CI (`docker/build-push-action` or plain `docker build`/`docker push`), authenticating to a registry (GHCR via `GITHUB_TOKEN`, or Docker Hub/other registries via secrets), tagging strategy (commit SHA tag + a moving `latest`/branch-name tag), layer caching for faster builds. Example: a workflow building and pushing an image to GitHub Container Registry (GHCR) tagged with both the commit SHA and `latest`, verified well-formed YAML. Common mistakes: only tagging with `latest`, losing the ability to roll back to a specific prior build; not authenticating before push (silent failure or a confusing permission-denied error if `GITHUB_TOKEN` lacks `packages: write` permission — cross-reference the Security phase's permission-scoping lesson).
  - `02-Deploying-to-Kubernetes.md`: a workflow authenticating to a Kubernetes cluster (via a cloud provider's CLI/action, or `kubeconfig` from a secret) and applying a manifest or running `kubectl set image`/`helm upgrade`, why credentials for cluster access should be short-lived where possible (cross-reference the OIDC lesson in Security phase). Example: a workflow that builds an image, pushes it, then updates a Kubernetes Deployment's image tag via `kubectl set image`, verified well-formed YAML — deliberately generic/cloud-agnostic per the course's stated scope (not a specific cloud's full walkthrough). Common mistakes: storing a full long-lived `kubeconfig` with cluster-admin rights as a repo secret instead of scoping down to a deploy-only service account/role; forgetting to make the deploy step wait for/verify rollout success (`kubectl rollout status`), letting CI report success even if the new pods crash-loop.
  - `03-Environment-Gated-Approvals-for-Production.md`: using GitHub Environments (from Phase 4) with required reviewers and/or a wait timer specifically for production deploy jobs, how a job targeting a protected Environment pauses for approval before running, environment-specific secrets/variables ensuring a `production` deploy can't accidentally use `staging` credentials. Example: a `deploy-production` job with `environment: production` requiring manual approval, contrasted with an ungated `deploy-staging` job, verified well-formed YAML. Common mistakes: putting production credentials in workflow-level or repository-level secrets instead of an Environment-scoped secret, losing the approval-gate enforcement entirely (a job doesn't have to target the environment to read a repo-level secret); forgetting required reviewers must have write access to the repo to be eligible approvers.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 10: CD Patterns". Objectives: build and push container images with a sound tagging strategy; deploy to Kubernetes with rollout verification; gate production deploys with Environment approvals. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-11-Security-Best-Practices/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Phase-10-CD-Patterns/0*.md` — expect 8 per file.
  Validate all YAML examples parse cleanly.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Phase-10-CD-Patterns
  git commit -m "Add GitHub Actions Phase 10: CD Patterns"
  ```

---

### Task 11: Phase 11 — Security Best Practices

**Files:**
- Create: `GithubActions/Phase-11-Security-Best-Practices/README.md`
- Create: `GithubActions/Phase-11-Security-Best-Practices/01-GITHUB-TOKEN-Permission-Scoping.md`
- Create: `GithubActions/Phase-11-Security-Best-Practices/02-OIDC-for-Cloud-Authentication.md`
- Create: `GithubActions/Phase-11-Security-Best-Practices/03-Pinning-Actions-and-Dependabot.md`
- Create: `GithubActions/Phase-11-Security-Best-Practices/04-SLSA-and-Supply-Chain-Attestation.md`

- [ ] **Step 1: Write the 4 lesson files**:
  - `01-GITHUB-TOKEN-Permission-Scoping.md`: the auto-generated `GITHUB_TOKEN`'s default permissions (varies by repo settings, historically broad), scoping it down explicitly via the `permissions:` block at workflow or job level (principle of least privilege), the difference between read/write per-resource permissions (`contents`, `packages`, `pull-requests`, etc.). Example: a workflow with `permissions: {}` at the top (deny-all default) and a specific job overriding with only the permissions it actually needs (e.g. `contents: read, packages: write` for a publish job), verified well-formed YAML. Common mistakes: leaving the default broad `GITHUB_TOKEN` permissions in place for a workflow that processes untrusted input (e.g. a `pull_request_target` workflow), creating a real privilege-escalation risk; setting `permissions: write-all` out of convenience instead of scoping to only what's needed.
  - `02-OIDC-for-Cloud-Authentication.md`: GitHub Actions' OIDC (OpenID Connect) token issuance for authenticating to cloud providers WITHOUT storing long-lived cloud credentials as secrets, the trust-relationship configuration on the cloud side (e.g. an AWS IAM role trusting GitHub's OIDC provider, scoped to a specific repo/branch), the `id-token: write` permission required to request an OIDC token. Example: a workflow requesting an OIDC token and using a cloud-provider action (e.g. `aws-actions/configure-aws-credentials` with `role-to-assume`, no access keys) to assume a role, verified well-formed YAML. Common mistakes: forgetting the `id-token: write` permission, without which OIDC token requests fail; configuring the cloud-side trust policy too broadly (e.g. trusting any repo/branch in an org) instead of scoping to the specific repo and branch/environment that should be allowed to assume the role.
  - `03-Pinning-Actions-and-Dependabot.md`: why pinning third-party actions to a full commit SHA (not just a tag like `v3`) prevents a compromised/re-tagged action from silently changing behavior (a real supply-chain attack vector, since tags are mutable), using Dependabot to keep SHA-pinned actions updated automatically via PRs (Dependabot understands the SHA-pin-plus-comment convention `uses: actions/checkout@<sha> # v4.1.1`). Example: a workflow with an action pinned to a full SHA with a version comment, plus a minimal `dependabot.yml` configuring updates for the `github-actions` ecosystem, verified well-formed YAML for both. Common mistakes: pinning to a SHA once and never updating it (loses security patches — this is why Dependabot automation matters, not just the initial pin); pinning some actions but not others in the same workflow, leaving inconsistent trust levels.
  - `04-SLSA-and-Supply-Chain-Attestation.md`: SLSA (Supply-chain Levels for Software Artifacts) framework basics (provenance — verifiable metadata about how an artifact was built), GitHub's built-in artifact attestation (`actions/attest-build-provenance`) for generating and verifying signed provenance for build outputs, why this matters for consumers verifying an artifact actually came from the claimed workflow/repo rather than being tampered with post-build. Example: a workflow generating build provenance attestation for a built artifact using `actions/attest-build-provenance`, verified well-formed YAML. Common mistakes: treating SLSA/attestation as a "nice to have" rather than understanding it's specifically about POST-build tampering and build-origin verification (distinct from source-code review or dependency scanning, which address different threat models); forgetting attestation requires `id-token: write` and `attestations: write` permissions.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 11: Security Best Practices". Objectives: scope `GITHUB_TOKEN` permissions to least privilege; authenticate to cloud providers via OIDC instead of long-lived secrets; pin third-party actions to a SHA with Dependabot automation; understand supply-chain attestation basics. Topics table, 1 day each. Estimated Time: 4 days. Next Phase → `../Phase-12-Self-Hosted-Runners-and-Enterprise-Governance/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Phase-11-Security-Best-Practices/0*.md` — expect 8 per file.
  Validate all YAML examples parse cleanly.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Phase-11-Security-Best-Practices
  git commit -m "Add GitHub Actions Phase 11: Security Best Practices"
  ```

---

### Task 12: Phase 12 — Self-Hosted Runners and Enterprise Governance

**Files:**
- Create: `GithubActions/Phase-12-Self-Hosted-Runners-and-Enterprise-Governance/README.md`
- Create: `GithubActions/Phase-12-Self-Hosted-Runners-and-Enterprise-Governance/01-Setting-Up-Self-Hosted-Runners.md`
- Create: `GithubActions/Phase-12-Self-Hosted-Runners-and-Enterprise-Governance/02-Runner-Groups-and-Labels.md`
- Create: `GithubActions/Phase-12-Self-Hosted-Runners-and-Enterprise-Governance/03-Org-Level-Reusable-Workflow-Governance.md`

- [ ] **Step 1: Write the 3 lesson files**:
  - `01-Setting-Up-Self-Hosted-Runners.md`: why self-hosted runners exist (custom hardware/software needs, cost at scale, network access to internal resources), registering a runner (the runner application, its registration token flow), the security responsibility shift (you now own patching/isolation of the runner machine, unlike GitHub-hosted's ephemeral clean VM per job). Example: the shell commands to download/configure/start a self-hosted runner (`config.sh --url ... --token ...`, `run.sh`), described precisely as real commands (not something this course can execute against a live GitHub org, but the sequence must be accurate). Common mistakes: using a self-hosted runner for a PUBLIC repository without understanding that anyone who can open a PR can potentially run arbitrary code on that runner (a serious security risk GitHub explicitly warns about); not treating the runner machine as ephemeral, letting state/artifacts leak between unrelated workflow runs.
  - `02-Runner-Groups-and-Labels.md`: custom labels for targeting specific self-hosted runners (`runs-on: [self-hosted, linux, gpu]`), runner groups for organizing runners by team/purpose and restricting which repos/workflows can use a group (an org/enterprise-level access-control concept). Example: a workflow targeting a labeled self-hosted runner with a specific capability (e.g. GPU), verified well-formed YAML. Common mistakes: relying only on a generic `self-hosted` label without more specific labels, causing jobs to land on runners that don't actually have the required tooling/hardware; not restricting a sensitive runner group's repo access, allowing any repo in the org to schedule jobs on infrastructure that should be restricted.
  - `03-Org-Level-Reusable-Workflow-Governance.md`: organization-level "required workflows" that automatically apply to member repos, restricting which actions/reusable workflows repos are allowed to use (an allow-list policy at the org/enterprise level) as a supply-chain control, centralizing a shared CI/CD reusable workflow so individual teams don't reinvent (and potentially misconfigure) their own. Example: described policy configuration (not a workflow YAML per se, since this is an org-settings-level feature) showing what an allow-list policy restricting actions to a verified set looks like conceptually, plus a YAML example of a team consuming a centrally-governed reusable workflow, verified well-formed YAML for the consuming example. Common mistakes: assuming individual repo-level security practices (like SHA-pinning) are sufficient without any org-level allow-list, missing a broader class of supply-chain risk that only org policy can close; centralizing a reusable workflow without a clear versioning/change-management process, causing a breaking change to silently affect every consuming team's CI at once.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 12: Self-Hosted Runners and Enterprise Governance". Objectives: understand when and how to run self-hosted runners safely; use labels/runner groups for access control; apply org-level governance to reusable workflows and allowed actions. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Phase-13-Production-Best-Practices-and-Interview-Prep/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Phase-12-Self-Hosted-Runners-and-Enterprise-Governance/0*.md` — expect 8 per file.
  Validate all YAML examples parse cleanly.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Phase-12-Self-Hosted-Runners-and-Enterprise-Governance
  git commit -m "Add GitHub Actions Phase 12: Self-Hosted Runners and Enterprise Governance"
  ```

---

### Task 13: Phase 13 — Production Best Practices and Interview Prep

**Files:**
- Create: `GithubActions/Phase-13-Production-Best-Practices-and-Interview-Prep/README.md`
- Create: `GithubActions/Phase-13-Production-Best-Practices-and-Interview-Prep/01-Debugging-Failed-Workflow-Runs.md`
- Create: `GithubActions/Phase-13-Production-Best-Practices-and-Interview-Prep/02-Cost-Optimization-and-Concurrency.md`
- Create: `GithubActions/Phase-13-Production-Best-Practices-and-Interview-Prep/03-Interview-Strategy-Capstone.md`

- [ ] **Step 1: Write the 3 lesson files**:
  - `01-Debugging-Failed-Workflow-Runs.md`: reading workflow run logs effectively (expanding steps, timing info), enabling debug logging (`ACTIONS_STEP_DEBUG`/`ACTIONS_RUNNER_DEBUG` secrets), re-running failed jobs (all jobs vs. only failed jobs), using `tmate`-style debugging actions to SSH into a runner when logs aren't enough (with the security caveat of exposing a live shell). Example: a workflow snippet showing a debug-logging-friendly step structure and referencing the debug secrets by name, verified well-formed YAML. Common mistakes: not using debug logging before reaching for more invasive tools like live-SSH debugging actions, when the answer was often already in the logs at debug verbosity; forgetting that "re-run failed jobs only" reuses the same commit/context, so a fix requires a new push, not just a re-run, if the failure is due to actual code/config being wrong (as opposed to flaky infra).
  - `02-Cost-Optimization-and-Concurrency.md`: GitHub Actions billing basics (minutes-based for private repos on hosted runners, free for public repos, self-hosted runners incur no per-minute Actions charge but have their own infra cost), `concurrency` groups with `cancel-in-progress` to avoid wasting minutes on superseded runs (e.g. cancel an in-progress CI run when a new commit is pushed to the same PR), combining caching (Phase 5) and appropriately-scoped triggers (Phase 2) as cost levers. Example: a workflow using `concurrency: {group: ..., cancel-in-progress: true}` keyed on the PR/branch ref, verified well-formed YAML. Common mistakes: not setting a `concurrency` group at all, letting every push to a PR queue up a full redundant CI run instead of canceling the superseded one; setting an overly broad `concurrency` group key that accidentally cancels/blocks unrelated workflow runs that shouldn't be mutually exclusive.
  - `03-Interview-Strategy-Capstone.md`: how GitHub Actions concepts typically get probed in interviews (scenario-based: "design a CI/CD pipeline for X," "how would you secure a workflow that deploys to production," "how would you speed up a slow pipeline"), a framework for structuring an answer (clarify the app/deploy target → sketch triggers and jobs → call out security/cost considerations proactively), common follow-up depth-probes (matrix builds, secrets scoping, self-hosted vs. hosted trade-offs). Example: a worked-through sample interview question ("design a pipeline that tests, builds a Docker image, and deploys to production only after manual approval") walked through the answer framework, citing which earlier phases/lessons the answer draws from (actually cite real file paths from this course). Common mistakes: describing a pipeline only in terms of "what" steps run without proactively addressing security (permissions, secrets scoping) and cost (caching, concurrency) considerations that a strong answer should volunteer; not structuring the answer (jumping straight into YAML syntax details) when the interviewer is assessing design judgment first.

- [ ] **Step 2: Write the phase README.md**
  Title "Phase 13: Production Best Practices and Interview Prep". Objectives: debug failed workflow runs efficiently; apply cost/concurrency optimizations; structure a strong answer to a GitHub Actions system-design-style interview question. Topics table, 1 day each. Estimated Time: 3 days. Next Phase → `../Projects/README.md`.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Phase-13-Production-Best-Practices-and-Interview-Prep/0*.md` — expect 8 per file.
  Validate all YAML examples parse cleanly. For file 03, verify every cited file path actually exists in this course via `ls`/`test -f`.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Phase-13-Production-Best-Practices-and-Interview-Prep
  git commit -m "Add GitHub Actions Phase 13: Production Best Practices and Interview Prep"
  ```

---

### Task 14: Projects/ — End-to-End Pipelines

**Files:**
- Create: `GithubActions/Projects/README.md`
- Create: `GithubActions/Projects/01-Full-CI-CD-Pipeline.md`
- Create: `GithubActions/Projects/02-Reusable-Workflow-Monorepo-CI.md`
- Create: `GithubActions/Projects/03-Custom-Docker-Action-Published-and-Consumed.md`

- [ ] **Step 1: Write `README.md`**
  Explain the purpose: each project combines patterns from multiple phases into one end-to-end pipeline, mirroring real-world CI/CD setups that rarely use a single technique in isolation. List all 3 projects in a table (`File | Patterns Combined | Phases`):
  - `01-Full-CI-CD-Pipeline.md` — CI (test) + Docker build/push + CD (deploy) + Environment approval — Phases 9, 10
  - `02-Reusable-Workflow-Monorepo-CI.md` — Reusable workflows + dynamic matrix + path filters — Phases 6, 7, 9
  - `03-Custom-Docker-Action-Published-and-Consumed.md` — Custom Docker action + versioning + consumption from another workflow — Phase 8

  Recommend attempting each project only after its listed phases are complete.

- [ ] **Step 2: Write the 3 project files**, each with sections `## Problem Statement`, `## Approach Discussion` (how the combined patterns apply, why each is needed), `## Solution` (full YAML, plus any supporting JS/shell), `## Trade-offs and Considerations` (this course's equivalent of the DSA Projects' "Complexity" section — since these aren't Big-O algorithms, this section covers cost, security, and maintainability trade-offs instead):
  - `01-Full-CI-CD-Pipeline.md`: a workflow that tests a Node.js app, builds and pushes a Docker image to GHCR, and deploys to a `production` Environment gated by required-reviewer approval — combining Phase 9's test pipeline, Phase 10's registry build/push and environment-gated approval patterns. Solution: full multi-job YAML (`test` → `build-and-push` → `deploy` with `needs` chaining and `environment: production`). Trade-offs: approval-gate adds latency but is the right trade for production safety; discuss caching/concurrency choices made.
  - `02-Reusable-Workflow-Monorepo-CI.md`: a monorepo with multiple packages, using a path-filter step to detect changed packages, generating a dynamic matrix, and calling a shared reusable `test-package.yml` workflow once per changed package — combining Phase 6's dynamic matrix, Phase 7's reusable workflows, and Phase 9's monorepo path-filtered CI. Solution: full YAML for both the caller workflow (detect + matrix + `uses: workflow_call`) and the reusable `test-package.yml` callee. Trade-offs: discuss why a shared reusable workflow reduces duplication risk vs. copy-pasted per-package CI, and the versioning/change-management consideration from Phase 12's governance lesson.
  - `03-Custom-Docker-Action-Published-and-Consumed.md`: a small custom Docker container action (e.g. a "lint commit messages" or "post a formatted Slack-style summary" action) with its `Dockerfile`/`entrypoint.sh`, tagged `v1.0.0` with a moving `v1` tag, consumed by a separate example workflow via `uses: <owner>/<repo>@v1`. Solution: full `action.yml` + `Dockerfile` + `entrypoint.sh` (entrypoint shell logic actually executed and verified, same as Phase 8's discipline) + the consuming workflow YAML. Trade-offs: discuss SHA-pinning the consumer's reference (per Phase 11) vs. trusting the moving `v1` tag, and Docker-action startup-time cost vs. a JavaScript action alternative.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' GithubActions/Projects/0*.md` — expect 4 per project file (Problem Statement, Approach Discussion, Solution, Trade-offs and Considerations).
  Validate all YAML examples parse cleanly. Actually execute any JS/shell logic that doesn't depend on the live Actions runtime (per project 03's entrypoint script).

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Projects
  git commit -m "Add GitHub Actions Projects: 3 end-to-end pipelines"
  ```

---

### Task 15: Quick-Reference/ — Cheatsheet and Interview Q&A

**Files:**
- Create: `GithubActions/Quick-Reference/Cheatsheet.md`
- Create: `GithubActions/Quick-Reference/Interview-QA.md`

- [ ] **Step 1: Write `Cheatsheet.md`**
  Follow the dense, topic-organized table style of `Git/Git-Cheatsheet.md` (not chapter-by-chapter). Sections, each as a table:
  - Contexts and expression syntax quick-reference (`github.*`, `env.*`, `secrets.*`, `steps.*`, `needs.*`, `matrix.*`, common functions).
  - Common trigger syntax snippets (push/PR/schedule/workflow_dispatch one-liners).
  - Common action snippets (checkout, setup-node/setup-python, cache, upload/download-artifact) as ready-to-paste YAML fragments.
  - Permissions quick-reference (`permissions:` keys and read/write meanings).
  - Pulled directly from the patterns already established in the phase lessons (not new content, just condensed).

- [ ] **Step 2: Write `Interview-QA.md`**
  50 commonly-asked GitHub Actions interview questions with explanations, following the 50-question convention used in other courses (e.g. `LLD/Quick-Reference/Interview-QA.md`). Organize into groups matching the phase groupings: Q1-15 Fundamentals/Triggers/Jobs/Runners (Phases 1-3), Q16-25 Env/Secrets/Artifacts/Caching/Matrix (Phases 4-6), Q26-35 Reusability/Custom Actions/CI/CD (Phases 7-10), Q36-50 Security/Self-Hosted/Governance/Production (Phases 11-13). Each entry: question, answer, and a 1-3 sentence explanation.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^Q' GithubActions/Quick-Reference/Interview-QA.md` — expect 50 (or equivalent numbered-question count matching the file's actual numbering scheme).
  Validate all YAML snippets in the Cheatsheet parse cleanly.

- [ ] **Step 4: Commit**
  ```bash
  git add GithubActions/Quick-Reference
  git commit -m "Add GitHub Actions Quick-Reference: cheatsheet and interview Q&A"
  ```

---

### Task 16: Course-level README.md

**Files:**
- Create: `GithubActions/README.md`

- [ ] **Step 1: Write the course README**
  Sections: `## Overview` (what this course covers: GitHub Actions CI/CD from workflow-syntax fundamentals through enterprise/security topics, framed for practical DevOps work and interview prep); `## Course Structure` (the tree from the spec, Phase-01 through Phase-13 + Projects + Quick-Reference, noting per-phase READMEs ARE included, unlike the DSA course); `## Learning Path` table with columns `Phase | Topic | Difficulty | Time`, one row per phase (Phases 1-3 Easy, 4-6 Easy-Medium, 7-9 Medium, 10-11 Medium-Hard, 12-13 Hard) plus a final row for Projects; `## Prerequisites` (basic YAML familiarity helpful but taught from scratch in Phase 1; a GitHub account; basic command-line/git familiarity); link to `Phase-01-Fundamentals-and-Workflow-Syntax/README.md` to start.

- [ ] **Step 2: Verify all internal links resolve**
  Run: `grep -oE '\]\([^)]+\.md[^)]*\)' GithubActions/README.md` and manually confirm each referenced path exists via `ls`.

- [ ] **Step 3: Commit**
  ```bash
  git add GithubActions/README.md
  git commit -m "Add GitHub Actions course README"
  ```

---

## Self-Review Notes

- **Spec coverage:** All 13 phases covered (Tasks 1-13, each including its phase README per the standard convention this course keeps), Projects/ with 3 end-to-end pipelines (Task 14), Quick-Reference/ with both required files (Task 15), course README (Task 16).
- **Lesson format consistency:** Every phase task uses the identical 8-section Lesson Format header defined once at the top of the plan, applied to all 41 lesson files, so there's no drift in section naming/order across phases.
- **Verification discipline carried over from the DSA course:** every task's verification step requires validating YAML well-formedness, and any genuinely executable JS/shell code (Phase 8's custom actions, Project 3's Docker action entrypoint) must actually be run and checked — matching the "no fabricated output" discipline enforced throughout the DSA course build, adapted to what's actually executable in this domain (a full GitHub Actions workflow can't run standalone outside a real repo/runner, so that's the honest boundary of what "execution verification" means here).
- **Cross-references between phases:** Where a lesson's content naturally depends on an earlier phase (e.g. Phase 9's monorepo CI using Phase 6's dynamic matrix and Phase 2's path filters, Phase 10's OIDC preview pointing to Phase 11, Phase 12's runner labels building on Phase 3's `runs-on` intro), those references point to phases with lower numbers only — no forward dependency that would break if tasks are executed in order, except deliberate forward-pointers stated as previews (e.g. Phase 3 previewing self-hosted runners, Phase 8 previewing SHA-pinning) which are explicitly framed as "covered in depth later," not assumed knowledge.
- **Naming/convention deviation from DSA course:** this course explicitly KEEPS per-phase READMEs (unlike DSA's exception), which is called out in both the spec and the course-level README's Course Structure section to avoid reader confusion when comparing the two courses.
