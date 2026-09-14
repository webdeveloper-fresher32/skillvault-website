# Project 1: Enterprise Git Flow and Automated Release Pipeline

## Goal

Design, implement, and simulate a production-grade multi-branch Git workflow (Trunk-Based / Git Flow hybrid) for an enterprise microservice: configure protected branches, automated semantic versioning, branch protection rulesets with CODEOWNERS, automated pre-commit and commit-msg quality gates, and release tagging pipelines.

## What You'll Build

A complete enterprise repository infrastructure featuring:
1. Multi-tier branch model (`main` production, `release/*` maintenance, `feat/*` topic branches).
2. Automated Conventional Commits validation and secret-scanning Git hooks.
3. Path-specific `.github/CODEOWNERS` routing and branch protection rulesets.
4. Cryptographically signed release tags with GPG/SSH.
5. Automated changelog generation and semantic release tagging simulation script.
6. Clean Pull Request merge strategy policies (Squash-and-Merge for features, Fast-Forward for hotfixes).

## Phases Required

- Phase 01: Git Core Architecture and Plumbing
- Phase 02: Staging, Committing, and Inspection
- Phase 03: Branching, Switching, and Worktrees
- Phase 08: Remotes, Syncing, and Network Protocols
- Phase 09: Git Hooks, Submodules, and Configuration
- Phase 10: GitHub Collaboration, Security, and Enterprise Workflows

## Requirements

### Core Functionality
- **Branch Topology**: Set up protected `main` branch, dynamic `release/vX.Y` branches, and short-lived `feat/*` branches.
- **Quality Gates (Hooks)**: Deploy client-side `.githooks/pre-commit` (blocks AWS keys and unformatted code) and `.githooks/commit-msg` (enforces Conventional Commits).
- **Code Governance**: Author `.github/CODEOWNERS` with rules for `/infra/`, `/security/`, and `/src/`.
- **Signed Releases**: Create annotated cryptographic release tags (`git tag -s v1.0.0 -m "release: v1.0.0"`) with verification validation.
- **Automated Workflow Script**: Provide a fully executable Bash simulation script demonstrating the lifecycle from feature branch creation to pull request squash merge and release tagging.

### Architecture Specifications
```text
[Developer Local Worktree] ──▶ [pre-commit / commit-msg Hooks]
                                            │
                                            ▼
[Feature Branch: feat/auth] ────────▶ [GitHub Pull Request]
                                            │
                                            ├── [CODEOWNERS Approval Gate]
                                            ├── [CI Status Checks Gate]
                                            └── [Strict Up-to-Date Gate]
                                            │
                                            ▼
                               [Squash & Merge to `main`]
                                            │
                                            ▼
                           [Signed Annotated Tag: `v1.1.0`]
                                            │
                                            ▼
                           [Release Branch: `release/v1.1`]
```

## Suggested Approach

1. **Phase 1: Repository Architecture & Configuration**
   - Initialize bare central server and local client repository.
   - Configure global and local settings: `init.defaultBranch main`, `pull.rebase true`, `fetch.prune true`.
   - Add `.gitattributes` normalizing line endings to LF (`* text=auto eol=lf`).

2. **Phase 2: Lifecycle Hooks & Governance**
   - Create `.githooks/pre-commit` secret scanner and `.githooks/commit-msg` regex validator.
   - Configure `core.hooksPath .githooks`.
   - Author `.github/CODEOWNERS` mapping backend, frontend, and infrastructure domains.

3. **Phase 3: Feature Lifecycle & Pull Request Flow**
   - Create isolated feature branch `feat/payment-gateway` using `git switch -c`.
   - Make atomic conventional commits (`feat(billing): add stripe webhook handler`).
   - Rebase feature branch on latest `main` using `git pull --rebase`.
   - Simulate pull request squash-and-merge into `main`.

4. **Phase 4: Release Cut, Cryptographic Tagging & Maintenance**
   - Cut release branch `git switch -c release/v1.1.0`.
   - Apply hotfix commit and backport using `git cherry-pick -x`.
   - Generate signed release tag `git tag -s v1.1.0 -m "release(core): v1.1.0 enterprise build"`.
   - Audit release signature using `git tag -v v1.1.0` and `git log --show-signature`.

## Stretch Goals

- Integrate an automated changelog generator reading Conventional Commit headers via `git log`.
- Create a multi-worktree setup allowing simultaneous hotfix development without stashing active feature branches.
- Implement an automated `pre-push` hook preventing accidental direct pushes to protected branch patterns.

## Evaluation Checklist

- [ ] Repository has LF line endings enforced via version-controlled `.gitattributes`.
- [ ] `.githooks/pre-commit` intercepts and blocks commits containing mock secret keys.
- [ ] `.githooks/commit-msg` halts commits with non-conventional messages (e.g. "fixed bugs").
- [ ] `.github/CODEOWNERS` correctly assigns path-level code review responsibilities.
- [ ] Feature branches rebase cleanly onto `main` before squash merging.
- [ ] Release tags are cryptographically signed and verify successfully with `git tag -v`.
