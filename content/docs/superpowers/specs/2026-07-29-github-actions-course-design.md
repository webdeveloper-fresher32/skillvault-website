# GitHub Actions Course — Design Spec

Date: 2026-07-29

## Purpose

Add a new SkillVault course, `GithubActions/`, covering GitHub Actions CI/CD from workflow-syntax fundamentals through enterprise-grade automation and security. Framed for both practical DevOps work and technical interview prep, extending past the repo's usual 12-phase convention into advanced/enterprise topics (custom action publishing, OIDC cloud auth, supply-chain attestation, self-hosted runner governance) per explicit user decision.

## Scope

13 phases:

- Phases 1–6: core workflow mechanics (syntax, triggers, jobs/runners, secrets/env, artifacts/caching, matrix builds)
- Phases 7–8: reusability and custom action authoring (reusable workflows, composite actions, custom JS/Docker actions, Marketplace publishing)
- Phases 9–10: CI and CD patterns
- Phase 11: security (token scoping, OIDC, SHA-pinning, SLSA/supply-chain attestation)
- Phase 12: self-hosted runners and enterprise/org-level governance
- Phase 13: production best practices + interview-prep capstone

## Course Structure

```
GithubActions/
├── Phase-01-Fundamentals-and-Workflow-Syntax/
├── Phase-02-Triggers-and-Events/
├── Phase-03-Jobs-Steps-and-Runners/
├── Phase-04-Environment-Secrets-and-Variables/
├── Phase-05-Artifacts-and-Caching/
├── Phase-06-Matrix-Builds-and-Strategy/
├── Phase-07-Reusable-Workflows-and-Composite-Actions/
├── Phase-08-Custom-Actions-Development/
├── Phase-09-CI-Patterns/
├── Phase-10-CD-Patterns/
├── Phase-11-Security-Best-Practices/
├── Phase-12-Self-Hosted-Runners-and-Enterprise-Governance/
├── Phase-13-Production-Best-Practices-and-Interview-Prep/
├── Projects/
├── Quick-Reference/
└── README.md
```

**Per-phase README.md is KEPT** (unlike the DSA course's deliberate exception) — this course follows the standard CLAUDE.md convention: every phase directory gets its own `README.md` (goals, learning objectives, topics table with time estimates, link to next phase) plus 2-5 zero-padded numbered lesson files, matching Docker/Kubernetes/MongoDB/MySQL/HLD.

## Phase Topic Breakdown

1. **Fundamentals and Workflow Syntax** — YAML basics for workflows, workflow file anatomy (`name`, `on`, `jobs`, `steps`), where workflow files live (`.github/workflows/`), the run/step model, `uses` vs `run`
2. **Triggers and Events** — `push`, `pull_request`, `schedule` (cron), `workflow_dispatch`, `repository_dispatch`, event filters (branches/paths/tags), activity types for PR events
3. **Jobs, Steps, and Runners** — job dependencies (`needs`), `runs-on` and GitHub-hosted runner OS matrix, job outputs, step outputs, conditional execution (`if`), job/step timeouts
4. **Environment, Secrets, and Variables** — `env` at workflow/job/step level, GitHub Secrets, Environments and protection rules/required reviewers, contexts (`github`, `env`, `secrets`, `steps`, `needs`) and expression syntax
5. **Artifacts and Caching** — `actions/upload-artifact`/`download-artifact`, `actions/cache`, dependency-caching patterns (npm/pip/maven), cache key strategy and invalidation
6. **Matrix Builds and Strategy** — `strategy.matrix`, `include`/`exclude`, `fail-fast`, `max-parallel`, dynamic matrices from JSON
7. **Reusable Workflows and Composite Actions** — `workflow_call`, passing inputs/secrets/outputs between workflows, composite actions (`action.yml` with `runs.using: composite`), when to choose one over the other
8. **Custom Actions Development** — JavaScript actions (`actions/toolkit`, `@actions/core`), Docker container actions, composite actions revisited as a third action type, versioning/tagging conventions, publishing to the GitHub Marketplace
9. **CI Patterns** — multi-language test pipelines, linting, code coverage reporting, PR status checks, monorepo path-filtered CI
10. **CD Patterns** — deploying to cloud providers (conceptual, cross-referencing patterns rather than a specific cloud), building/pushing to container registries, deploying to Kubernetes, environment-gated approvals for production deploys
11. **Security Best Practices** — `GITHUB_TOKEN` permission scoping (least privilege), OIDC for cloud authentication (no long-lived cloud secrets), pinning third-party actions to a commit SHA, Dependabot for actions, SLSA/supply-chain attestation basics
12. **Self-Hosted Runners and Enterprise Governance** — setting up and registering self-hosted runners, runner groups and labels, org-level reusable workflow governance (required workflows, restricting which actions can be used), cost/scaling trade-offs vs GitHub-hosted runners
13. **Production Best Practices and Interview Prep** — debugging failed workflow runs, workflow observability, cost optimization (caching, concurrency limits, `cancel-in-progress`), and an interview-strategy capstone (common GitHub Actions interview questions and how to reason about them)

## Lesson Format

Every lesson file follows the user's established spoon-fed style (this is a general user preference, not specific to any one course):

1. **Problem** — the real-world CI/CD scenario that motivates the topic
2. **Analogy** — an intuitive, non-technical comparison
3. **Internal Flow** — how the mechanism actually works step by step
4. **Example** — a fully worked example, primarily YAML workflow snippets (with JavaScript/shell where relevant, e.g. custom actions)
5. **Compare** — how this relates to or differs from adjacent topics/techniques
6. **Common Mistakes** — pitfalls learners/practitioners typically hit
7. **Interview Angle** — how this shows up in interviews, common follow-up questions
8. **Memory Hook** — a short mnemonic or takeaway for recall

Workflow examples are realistic, runnable-looking GitHub Actions YAML. Where genuinely executable code applies (e.g. a JavaScript custom action's `index.js`, or shell snippets), it should be verified for syntactic/logical correctness the same way the DSA course's Python was — this course can't "run" a GitHub Actions workflow standalone the way Python code executes, so verification here means: YAML must be well-formed (parseable), and any JS/shell snippets must actually run correctly where they don't depend on the GitHub Actions runtime context.

## Per-Phase README.md Format

Matches the existing convention (e.g. `Docker/Phase-01-Fundamentals/README.md`): phase title, "What You'll Learn", "Learning Objectives", a Topics table (`File | Topic | Time`), "Estimated Time", and a "Next Phase" link (Phase 13 links to `../Projects/README.md` instead).

## Projects/ Folder

Hands-on end-to-end pipelines combining multiple phases' patterns:
- A full CI/CD pipeline for a sample app: test → build → containerize → deploy (combines CI patterns, Docker, CD patterns, environments)
- A reusable-workflow-based monorepo CI setup (combines reusable workflows, matrix builds, path filters)
- A custom Docker container action published and consumed by another workflow (combines custom actions development, versioning)
- Exact count and titles to be finalized during planning, following the same "Problem Statement / Approach Discussion / Solution / Complexity-or-Tradeoffs" structure used by the DSA course's Projects/ (adapted: "Complexity" becomes "Trade-offs/Considerations" since these aren't Big-O algorithms).

## Quick-Reference/ Folder

- `Cheatsheet.md` — dense reference of contexts/expression syntax, common action snippets (checkout, setup-node/python, cache, upload/download-artifact), trigger syntax quick-lookup.
- `Interview-QA.md` — 50 interview questions with answers, matching the convention used in other courses' Quick-Reference folders.

## Course-level README.md

Standard convention: course overview, what it covers and why, the Phase | Topic | Difficulty | Time learning path table (13 rows + Projects row), link into Phase 1's README.

## Out of Scope

- No dependency on any other course's CI/CD mentions (e.g. `AWS/Phase-12-CICD-DevOps/03-GitHub-Actions-AWS.md`, `Terraform/Projects/05-CICD-Pipeline-GitHub-Actions.md`) — this course is self-contained and doesn't require editing those files, though it may be conceptually adjacent.
- Not GitLab CI / Jenkins / CircleCI — GitHub Actions only.
- Cloud-provider-specific deployment deep dives (e.g. full AWS ECS/EKS deployment walkthroughs) are out of scope for Phase 10 — that phase covers CD *patterns* generically and cross-references cloud-specific courses (AWS, Kubernetes) rather than duplicating their content.

## Open Questions

None — all scoping decisions were made during brainstorming (phase count/depth, per-phase README convention, lesson format reuse from established preference).
