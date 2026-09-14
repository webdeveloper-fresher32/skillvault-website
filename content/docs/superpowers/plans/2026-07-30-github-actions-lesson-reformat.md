# GitHub Actions Lesson Reformat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all ~53 numbered lesson files across `GithubActions/Phase-01` through `Phase-13` from the fixed 8-section narrative template to the new topic-headed, code-interleaved, exercise-and-Q&A-ending template defined in `docs/superpowers/specs/2026-07-30-github-actions-lesson-reformat-design.md`, matching this repo's `Networking/`/`AWS/` course style.

**Architecture:** This is a content-reformatting pass over existing, already-technically-verified lesson files — the underlying facts, YAML examples, and cross-phase citations established in the original build are correct and must be preserved; only the STRUCTURE changes (headings, prose density, where code sits, ending sections). Each task reformats one phase's lesson files (README.md files are untouched). Verification per task: YAML blocks must still parse; every fact/citation/YAML example from the original file must survive into the new structure (nothing silently dropped); the new template's required elements (topic-named sections with interleaved code, Common Mistakes, Hands-On Exercises, Interview Q&A) must all be present.

**Tech Stack:** GitHub-flavored Markdown, YAML, JavaScript/shell where the original lessons had executable examples (Phase 8).

**New Lesson Template** (apply to every lesson file):
```markdown
# <Topic>

(1 short paragraph, 2-4 sentences — what this is and why it matters, no "Problem"/"Analogy" headings)

## 1. <Topic-named section>
(short prose, 2-5 sentences) → immediately followed by a code/YAML snippet, ASCII diagram, or table

## 2. <Topic-named section>
(same pattern)

## N. <as many topic-named sections as the concept needs>
...

## Comparison (where the lesson has 2+ things to compare — use a table, not prose bullets)

## Common Mistakes
(3-5 concrete bullets — carry over from the original file, keep as a bulleted list)

## Hands-On Exercises
(3-5 runnable exercises: real CLI commands like `act`, `gh workflow run`, `gh run view`, `actionlint`, `yamllint`, `gh api`, or concrete "create this file and observe X" steps)

## Interview Q&A
(3-5 short, direct Q&A pairs — question then a 2-4 sentence direct answer, no narrated framing)
```

Rules for every task:
- **Preserve all facts.** Every specific technical claim, YAML example, cross-phase citation (e.g. "Phase 4, Lesson 2"), and Common Mistake from the original file must appear somewhere in the reformatted file. Don't silently drop content while restructuring.
- **Re-validate all YAML.** Every fenced ```yaml block must still parse via a YAML parser after reformatting (re-extract and validate, don't assume copy-paste preserved validity).
- **Re-verify any executable code.** Phase 8's JavaScript/shell examples must be re-extracted and re-run after reformatting to confirm output still matches what's documented.
- **Convert "Interview Angle" narration into direct Q&A.** The original Interview Angle prose paragraph contains the actual question(s) an interviewer would ask and the shape of a good answer — extract those into direct Q&A pairs, don't just delete the content.
- **Drop "Analogy" and "Memory Hook" as separate headings** — an analogy can survive as a brief aside within a topic section's prose if it's genuinely useful, but it doesn't get its own heading.
- **Turn "Compare" prose bullets into a table** when the comparison is between 2+ named things (e.g. reusable workflow vs. composite action, Prim's vs. Kruskal's-style contrasts) — if the "Compare" content is more like a single cross-reference to another phase rather than a multi-way comparison, keep it as a short prose sentence instead of forcing a table.
- **Number of topic-named sections varies per lesson** — split the original "Internal Flow" and "Example" content into as many topic sections as make sense (e.g. a lesson covering 3 distinct mechanisms gets 3 topic sections, each with its own snippet), rather than keeping one monolithic Internal Flow + one monolithic Example.

---

### Task 1: Reformat Phase 01 — Fundamentals and Workflow Syntax

**Files to rewrite** (in place, same filenames):
- `GithubActions/Phase-01-Fundamentals-and-Workflow-Syntax/01-YAML-Basics-for-Workflows.md`
- `GithubActions/Phase-01-Fundamentals-and-Workflow-Syntax/02-Workflow-File-Anatomy.md`
- `GithubActions/Phase-01-Fundamentals-and-Workflow-Syntax/03-Uses-vs-Run-and-the-Step-Model.md`

- [ ] **Step 1: Read each existing file in full** to extract all facts, YAML examples, cross-references, and Common Mistakes before rewriting.
- [ ] **Step 2: Rewrite each file to the new template.** For `01-YAML-Basics-for-Workflows.md`: split into topic sections like "Key-Value Pairs and Indentation," "Lists," "Multi-Line Strings (`|` and `>`)," "The `on`/Boolean Gotcha" — each with its own small YAML snippet demonstrating it (not one big combined example). For `02-Workflow-File-Anatomy.md`: topic sections like "The Three Top-Level Keys," "Where Workflow Files Live," "How a Run Gets Triggered" — each with a snippet/diagram. For `03-Uses-vs-Run-and-the-Step-Model.md`: topic sections like "`uses` vs `run`," "Reference Forms for `uses`," "Shell State Between `run` Steps" — each with its own snippet.
- [ ] **Step 3: Re-validate all YAML** in the reformatted files with a YAML parser.
- [ ] **Step 4: Verify no facts were dropped** — diff your mental checklist of original content against the new file; confirm every Common Mistake and cross-reference survived.
- [ ] **Step 5: Commit**
  ```bash
  git add GithubActions/Phase-01-Fundamentals-and-Workflow-Syntax
  git commit -m "Reformat GitHub Actions Phase 1 lessons to topic-headed template"
  ```

---

### Task 2: Reformat Phase 02 — Triggers and Events

**Files:** `01-Push-and-Pull-Request-Triggers.md`, `02-Schedule-and-Manual-Triggers.md`, `03-Event-Filters-Branches-Paths-Tags.md`

- [ ] Same process as Task 1: read originals in full, rewrite each to the new template with topic-named sections (e.g. file 01: "`push` Triggers," "`pull_request` Triggers," "`pull_request_target` and Its Risk," "PR Activity Types"; file 02: "Cron Scheduling," "`workflow_dispatch`," "`repository_dispatch`"; file 03: "`branches`/`branches-ignore`," "`paths`/`paths-ignore`," "Glob Patterns," "The Branch-Protection Gotcha"), each with an immediate snippet. Preserve the `pull_request_target` security content and all Common Mistakes exactly (this is security-sensitive content from the original build — do not weaken or drop it, just restructure it).
- [ ] Re-validate all YAML.
- [ ] Verify no facts dropped, especially the `pull_request_target` danger explanation and the required-status-check/`paths`-filter gotcha.
- [ ] Commit: `git add GithubActions/Phase-02-Triggers-and-Events && git commit -m "Reformat GitHub Actions Phase 2 lessons to topic-headed template"`

---

### Task 3: Reformat Phase 03 — Jobs, Steps, and Runners

**Files:** `01-Job-Dependencies-and-Needs.md`, `02-Runners-and-Runs-On.md`, `03-Job-and-Step-Outputs.md`, `04-Conditional-Execution-and-Timeouts.md`

- [ ] Read originals in full, rewrite to topic-named sections (e.g. file 03: "Step Outputs via `$GITHUB_OUTPUT`," "Referencing Step Outputs," "Job-Level `outputs:`," "Referencing Job Outputs via `needs`" — each with its own snippet rather than one combined example). Preserve the full outputs chain (step id → step output → job outputs → needs.*.outputs) across however many sections it's split into.
- [ ] Re-validate all YAML.
- [ ] Verify no facts dropped.
- [ ] Commit: `git add GithubActions/Phase-03-Jobs-Steps-and-Runners && git commit -m "Reformat GitHub Actions Phase 3 lessons to topic-headed template"`

---

### Task 4: Reformat Phase 04 — Environment, Secrets, and Variables

**Files:** `01-Env-Vars-at-Workflow-Job-Step-Level.md`, `02-GitHub-Secrets-and-Environments.md`, `03-Contexts-and-Expression-Syntax.md`

- [ ] Read originals in full, rewrite to topic-named sections. File 01 must preserve the corrected job-level-vs-step-level `env:` expression timing explanation (this was a real bug fixed during the original build — do not reintroduce the contradiction, keep the corrected two-case explanation intact just restructured). File 03 must preserve the script-injection security explanation and its Phase 11 cross-reference.
- [ ] Re-validate all YAML.
- [ ] Verify no facts dropped, especially the corrected env-timing explanation and the injection security content.
- [ ] Commit: `git add GithubActions/Phase-04-Environment-Secrets-and-Variables && git commit -m "Reformat GitHub Actions Phase 4 lessons to topic-headed template"`

---

### Task 5: Reformat Phase 05 — Artifacts and Caching

**Files:** `01-Upload-and-Download-Artifacts.md`, `02-Actions-Cache-and-Dependency-Caching.md`, `03-Cache-Key-Strategy-and-Invalidation.md`

- [ ] Read originals in full, rewrite to topic-named sections. Must preserve the branch-scoping caveat for cache restoration (added during the original build's review — same branch / base branch fallback / default branch fallback, NOT repo-wide) in whichever section discusses cache availability.
- [ ] Re-validate all YAML.
- [ ] Verify no facts dropped, especially the branch-scoping caveat.
- [ ] Commit: `git add GithubActions/Phase-05-Artifacts-and-Caching && git commit -m "Reformat GitHub Actions Phase 5 lessons to topic-headed template"`

---

### Task 6: Reformat Phase 06 — Matrix Builds and Strategy

**Files:** `01-Matrix-Strategy-Basics.md`, `02-Include-Exclude-and-Dynamic-Matrices.md`, `03-Fail-Fast-and-Max-Parallel.md`

- [ ] Read originals in full, rewrite to topic-named sections. File 02's `include`/`exclude` merge-vs-new-combination semantics were verified carefully during the original build — preserve the exact worked example showing both the "merges into existing combination" case and the "becomes a standalone new combination" case, just restructure the presentation (e.g. as two topic subsections, each with its own snippet, instead of one combined Example). Preserve the Phase 3 and Phase 5 cross-references added during review.
- [ ] Re-validate all YAML.
- [ ] Verify no facts dropped, especially the include/exclude semantics and both worked cases.
- [ ] Commit: `git add GithubActions/Phase-06-Matrix-Builds-and-Strategy && git commit -m "Reformat GitHub Actions Phase 6 lessons to topic-headed template"`

---

### Task 7: Reformat Phase 07 — Reusable Workflows and Composite Actions

**Files:** `01-Reusable-Workflows-with-Workflow-Call.md`, `02-Composite-Actions.md`, `03-Choosing-Reusable-Workflow-vs-Composite-Action.md`

- [ ] Read originals in full, rewrite to topic-named sections. Files 01/02 each need TWO YAML examples (caller+callee, or action+consumer) — keep both, ideally each as its own labeled subsection. File 03's side-by-side comparison is a strong fit for the new "Comparison" table section — convert the same-logic-two-ways comparison into a table plus the two YAML blocks. Preserve the `secrets: inherit` vs. explicit-pass distinction and the "composite actions have no secrets mechanism" claim exactly.
- [ ] Re-validate all YAML (8 blocks total across the phase, per the original build).
- [ ] Verify no facts dropped.
- [ ] Commit: `git add GithubActions/Phase-07-Reusable-Workflows-and-Composite-Actions && git commit -m "Reformat GitHub Actions Phase 7 lessons to topic-headed template"`

---

### Task 8: Reformat Phase 08 — Custom Actions Development

**Files:** `01-JavaScript-Actions.md`, `02-Docker-Container-Actions.md`, `03-Versioning-and-Publishing-to-Marketplace.md`

- [ ] Read originals in full, rewrite to topic-named sections. **This phase has genuinely executable code (file 01's JS index.js, file 02's entrypoint.sh) — re-extract and re-run both after reformatting**, confirming output still matches what's documented (same discipline as the original build: install `@actions/core` fresh if needed, run with realistic `INPUT_*`/`GITHUB_OUTPUT` env vars). Preserve the `INPUT_<NAME_UPPERCASED_WITH_UNDERSCORES>` transformation rule (spaces→underscores, hyphens preserved) and the shell-can't-reference-hyphenated-variable-names gotcha exactly as originally verified.
- [ ] Re-validate all YAML.
- [ ] Actually execute the JS and shell code post-reformat and confirm output matches.
- [ ] Verify no facts dropped.
- [ ] Commit: `git add GithubActions/Phase-08-Custom-Actions-Development && git commit -m "Reformat GitHub Actions Phase 8 lessons to topic-headed template"`

---

### Task 9: Reformat Phase 09 — CI Patterns

**Files:** `01-Multi-Language-Test-Pipelines.md`, `02-Linting-and-Code-Coverage.md`, `03-Monorepo-Path-Filtered-CI.md`

- [ ] Read originals in full, rewrite to topic-named sections. File 03's full chain (path-detection step → JSON matrix output → downstream job) must stay coherent end-to-end even if split across multiple topic sections — preserve the specific cross-reference to Phase 6's dynamic-matrix lesson and Phase 2's paths-filter lesson.
- [ ] Re-validate all YAML.
- [ ] Verify no facts dropped, especially the full path-filter-to-matrix chain in file 03.
- [ ] Commit: `git add GithubActions/Phase-09-CI-Patterns && git commit -m "Reformat GitHub Actions Phase 9 lessons to topic-headed template"`

---

### Task 10: Reformat Phase 10 — CD Patterns

**Files:** `01-Container-Registry-Build-and-Push.md`, `02-Deploying-to-Kubernetes.md`, `03-Environment-Gated-Approvals-for-Production.md`

- [ ] Read originals in full, rewrite to topic-named sections. File 01's GHCR auth syntax (`docker/login-action`, `registry: ghcr.io`, `username: ${{ github.actor }}`, `password: ${{ secrets.GITHUB_TOKEN }}`) must be preserved exactly. File 03's ungated-vs-gated staging/production contrast is a strong fit for a "Comparison" table. Preserve the specific Phase 4 Lesson 2 citation.
- [ ] Re-validate all YAML.
- [ ] Verify no facts dropped.
- [ ] Commit: `git add GithubActions/Phase-10-CD-Patterns && git commit -m "Reformat GitHub Actions Phase 10 lessons to topic-headed template"`

---

### Task 11: Reformat Phase 11 — Security Best Practices

**Files:** `01-GITHUB-TOKEN-Permission-Scoping.md`, `02-OIDC-for-Cloud-Authentication.md`, `03-Pinning-Actions-and-Dependabot.md`, `04-SLSA-and-Supply-Chain-Attestation.md`

- [ ] Read originals in full, rewrite to topic-named sections. **This is the security phase — apply maximum care.** File 03's SHA-pinning examples were fixed to use REAL, verified commit SHAs (`b4ffde65f46336ab88eb53be808477a3936bae11` for `actions/checkout@v4.1.1`, `60edb5dd545a775178f52524783378180af0d1f8` for `actions/setup-node@v4.0.2`) — carry these exact corrected SHAs over, do not revert to the original fabricated ones and do not invent new ones. Preserve the OIDC trust-scoping explanation (cloud-side trust policy enforces access, not GitHub) and the SLSA/attestation distinction (build-provenance ≠ source-code safety) exactly. Preserve all three forward-reference-turned-backward-reference citations to Phase 2, Phase 8, Phase 10.
- [ ] Re-validate all YAML (file 03 has 2 blocks: pinned workflow + dependabot.yml).
- [ ] Verify no facts dropped, and specifically grep the reformatted file 03/04 for the two correct SHAs to confirm they weren't lost or altered.
- [ ] Commit: `git add GithubActions/Phase-11-Security-Best-Practices && git commit -m "Reformat GitHub Actions Phase 11 lessons to topic-headed template"`

---

### Task 12: Reformat Phase 12 — Self-Hosted Runners and Enterprise Governance

**Files:** `01-Setting-Up-Self-Hosted-Runners.md`, `02-Runner-Groups-and-Labels.md`, `03-Org-Level-Reusable-Workflow-Governance.md`

- [ ] Read originals in full, rewrite to topic-named sections. **File 03 had a real corrected bug** — required-workflow enforcement is via repository rulesets (not a standalone Actions settings feature, deprecated Oct 18 2023), clearly distinct from the separate allow-list-of-actions feature. Preserve this corrected two-mechanism distinction exactly as fixed, restructured into topic sections (e.g. "The Allow-List Feature," "Repository Rulesets for Required Workflows," "Centralizing Reusable Workflows") rather than losing the distinction while reformatting. Preserve the public-repo self-hosted-runner risk explanation and its Phase 11 cross-reference in file 01.
- [ ] Re-validate all YAML.
- [ ] Verify no facts dropped, and specifically confirm the ruleset-vs-allow-list distinction survived clearly (re-read it after rewriting to make sure the two mechanisms are still clearly separated, not reconflated).
- [ ] Commit: `git add GithubActions/Phase-12-Self-Hosted-Runners-and-Enterprise-Governance && git commit -m "Reformat GitHub Actions Phase 12 lessons to topic-headed template"`

---

### Task 13: Reformat Phase 13 — Production Best Practices and Interview Prep

**Files:** `01-Debugging-Failed-Workflow-Runs.md`, `02-Cost-Optimization-and-Concurrency.md`, `03-Interview-Strategy-Capstone.md`

- [ ] Read originals in full, rewrite to topic-named sections. **File 03 is unusual**: it's already an interview-strategy lesson whose content overlaps conceptually with the new template's "Interview Q&A" ending — don't just duplicate the framework description into both a topic section AND a redundant Q&A section. Instead: keep the interview-answer FRAMEWORK (clarify → sketch → security/cost → syntax) and the fully-worked example pipeline as topic sections with their real file-path citations (verify each still exists via `test -f` after rewriting), and use the Interview Q&A ending section for a few SHORT direct Q&A pairs distilled from the follow-up depth-probes (matrix, secrets scoping, self-hosted vs. hosted) rather than repeating the whole worked example there. File 02's billing claims must stay appropriately hedged (no invented exact pricing multipliers), matching the original build's deliberate caution.
- [ ] Re-validate all YAML.
- [ ] Re-verify every cited file path in file 03 still exists via `test -f`.
- [ ] Verify no facts dropped, especially the interview-answer framework and the hedged billing language.
- [ ] Commit: `git add GithubActions/Phase-13-Production-Best-Practices-and-Interview-Prep && git commit -m "Reformat GitHub Actions Phase 13 lessons to topic-headed template"`

---

## Self-Review Notes

- **Scope coverage:** All 13 phases' lesson files covered (Tasks 1-13); `Projects/`, `Quick-Reference/`, and all phase `README.md` files are explicitly out of scope per user decision and untouched by any task.
- **Fact preservation is the primary risk of this plan** — since this is a reformat of already-fact-checked content (this course caught and fixed real bugs: fabricated SHAs in Phase 11, an outdated deprecated-feature description in Phase 12, a self-contradiction in Phase 4, a branch-scoping omission in Phase 5), every task explicitly calls out the specific previously-fixed facts that must survive the rewrite, so reformatting doesn't silently regress a bug that was already found and fixed once.
- **Execution-verification carries over unchanged** for Phase 8 (Task 8) and is re-stated as a required step, since that's the one phase with genuinely runnable code.
- **Template consistency:** the same "New Lesson Template" block at the top of this plan applies verbatim to all 13 tasks — no drift in what "done" looks like across phases.
