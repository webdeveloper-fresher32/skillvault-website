# GitHub Actions — Complete Learning Course

Master GitHub Actions from zero to production. This course covers everything from workflow-syntax fundamentals through triggers, jobs and runners, secrets and caching, matrix builds, reusable workflows and custom actions, CI/CD patterns, security hardening, and enterprise self-hosted-runner governance — framed for practical DevOps work and CI/CD interview prep.

---

## Overview

GitHub Actions is GitHub's native CI/CD platform: workflows defined as YAML, triggered by repository events, running jobs made of steps on hosted or self-hosted runners. This course starts from the raw building blocks — YAML syntax, workflow file anatomy, `uses:` vs `run:` — and builds up through the mechanisms that turn a single workflow file into a real pipeline: triggers and event filters, job dependencies, environments and secrets, caching, matrix strategies, reusable workflows and composite actions, and even authoring your own custom actions (JavaScript and Docker container actions). The back half of the course is squarely production-focused: CI patterns (multi-language test pipelines, linting, monorepo path filtering), CD patterns (registry build/push, Kubernetes deploys, environment-gated approvals), security best practices (`GITHUB_TOKEN` scoping, OIDC cloud auth, action pinning, SLSA attestation), and enterprise governance (self-hosted runners, runner groups, org-level reusable workflow governance). The final phase closes with debugging failed runs, cost/concurrency optimization, and an interview-strategy capstone.

---

## Course Structure

```
GithubActions/
├── Phase-01-Fundamentals-and-Workflow-Syntax/                  → YAML basics, workflow file anatomy, uses vs run
├── Phase-02-Triggers-and-Events/                                → push/PR triggers, schedule/manual triggers, event filters
├── Phase-03-Jobs-Steps-and-Runners/                             → job dependencies, runners, outputs, conditionals & timeouts
├── Phase-04-Environment-Secrets-and-Variables/                  → env vars at each scope, GitHub secrets/environments, contexts
├── Phase-05-Artifacts-and-Caching/                              → upload/download artifacts, actions/cache, cache key strategy
├── Phase-06-Matrix-Builds-and-Strategy/                         → matrix basics, include/exclude, fail-fast & max-parallel
├── Phase-07-Reusable-Workflows-and-Composite-Actions/           → workflow_call, composite actions, when to choose which
├── Phase-08-Custom-Actions-Development/                         → JavaScript actions, Docker container actions, Marketplace publishing
├── Phase-09-CI-Patterns/                                        → multi-language test pipelines, linting/coverage, monorepo CI
├── Phase-10-CD-Patterns/                                        → registry build/push, Kubernetes deploys, environment-gated approvals
├── Phase-11-Security-Best-Practices/                            → GITHUB_TOKEN scoping, OIDC, action pinning/Dependabot, SLSA
├── Phase-12-Self-Hosted-Runners-and-Enterprise-Governance/      → self-hosted runners, runner groups/labels, org-level governance
├── Phase-13-Production-Best-Practices-and-Interview-Prep/       → debugging failed runs, cost/concurrency, interview capstone
├── Projects/                                                    → End-to-end pipelines combining multiple phases' patterns
└── Quick-Reference/                                              → Cheatsheet + Interview Q&A
```

Every phase directory has its own `README.md` summarising that phase's lessons, plus numbered lesson files (`01-...md`, `02-...md`, etc.) — the same pattern used by the Docker, Kubernetes, MongoDB, and MySQL courses in this repo, unlike the DSA course, which deliberately has no per-phase READMEs.

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Fundamentals and Workflow Syntax | Easy | 3 days |
| 02 | Triggers and Events | Easy | 3 days |
| 03 | Jobs, Steps and Runners | Easy | 4 days |
| 04 | Environment, Secrets and Variables | Easy-Medium | 3 days |
| 05 | Artifacts and Caching | Easy-Medium | 3 days |
| 06 | Matrix Builds and Strategy | Easy-Medium | 3 days |
| 07 | Reusable Workflows and Composite Actions | Medium | 4 days |
| 08 | Custom Actions Development | Medium | 4 days |
| 09 | CI Patterns | Medium | 3 days |
| 10 | CD Patterns | Medium-Hard | 3 days |
| 11 | Security Best Practices | Medium-Hard | 4 days |
| 12 | Self-Hosted Runners and Enterprise Governance | Hard | 3 days |
| 13 | Production Best Practices and Interview Prep | Hard | 3 days |
| Projects | End-to-end CI/CD pipelines (combines phases 6–10) | Hard | 3-5 days |

**Total estimated time: 6-7 weeks** (43 phase-days + 3-5 project-days ≈ 46-48 days)

---

## Prerequisites

- Basic YAML familiarity is helpful but not required — Phase 1 teaches YAML syntax from scratch for the purposes of writing workflows.
- A GitHub account (a free account is enough to run workflows on hosted runners for public repos).
- Basic command-line and git familiarity (cloning a repo, committing, pushing, opening a pull request).

---

## Where to Start

Begin with [Phase-01-Fundamentals-and-Workflow-Syntax/README.md](Phase-01-Fundamentals-and-Workflow-Syntax/README.md).
