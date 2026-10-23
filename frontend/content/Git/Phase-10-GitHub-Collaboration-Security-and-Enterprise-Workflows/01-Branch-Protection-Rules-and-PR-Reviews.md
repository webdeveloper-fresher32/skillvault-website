# Branch Protection Rules and Pull Request Reviews — Complete Guide

> "A dual-custody nuclear missile launch console requires two authorized officers to turn their physical keys simultaneously, while automated diagnostic computers confirm all telemetry signals are green before the launch bay doors unlock."

---

## Table of Contents

1. [The Problem: Preventing Unreviewed and Broken Code from Reaching Production](#1-the-problem-preventing-unreviewed-and-broken-code-from-reaching-production)
2. [The Dual-Key Nuclear Launch Console Analogy](#2-the-dual-key-nuclear-launch-console-analogy)
3. [The Mechanism: GitHub Rulesets, Status Checks, and CODEOWNERS Routing](#3-the-mechanism-github-rulesets-status-checks-and-codeowners-routing)
4. [Diagram: Enterprise Branch Protection and Pull Request Governance Pipeline](#4-diagram-enterprise-branch-protection-and-pull-request-governance-pipeline)
5. [CLI Walkthrough: Configuring CODEOWNERS, GitHub CLI PR Lifecycle, and Merge Strategies](#5-cli-walkthrough-configuring-codeowners-github-cli-pr-lifecycle-and-merge-strategies)
6. [Comparing GitHub Merge Strategies: Merge Commit vs Squash and Merge vs Rebase and Merge](#6-comparing-github-merge-strategies-merge-commit-vs-squash-and-merge-vs-rebase-and-merge)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Preventing Unreviewed and Broken Code from Reaching Production

In fast-paced engineering teams without automated safeguards, production outages happen when:
1. A developer accidentally runs `git push origin main` with un-tested code.
2. A junior engineer pushes breaking schema migrations without senior architecture approval.
3. Code is merged while CI build tests are red/failing.

### The Production Protection Problem

```text
Without Protection:
  Developer ──▶ `git push origin main` ──▶ Direct overwrite of production code! (Instant outage!)

With Enterprise Rulesets & PR Governance:
  Developer ──▶ Pushes feature branch ──▶ Opens Pull Request
                 ├── CI/CD Build & Test Suite (Required: PASS)
                 ├── Security SonarQube Gate (Required: PASS)
                 ├── CODEOWNERS Approvals (Required: 2 Senior Approvals)
                 └── Linear History & Signed Commits (Enforced!) ──▶ Safe Merge!
```

### The Solution: Branch Protection Rulesets & CODEOWNERS

GitHub Branch Protection Rules (and modern GitHub Repository Rulesets) enforce un-bypassable gatekeeping on `main`, requiring passing CI checks and designated peer reviews before merging.

---

## 2. The Dual-Key Nuclear Launch Console Analogy

A launch system secures critical military assets.

### Single Button Press vs Dual-Key Checkpoint

```text
Direct Push (`main`)         → Anyone bumping the red button triggers the entire missile sequence.
Branch Protection Rules      → The launch bay doors are electronically bolted shut.
Required Reviews (CODEOWNERS)→ Officer A and Officer B must turn independent cryptographic keys.
Required CI Status Checks    → Sensor suite confirms atmospheric conditions and oxygen pressure are 100%.
```

### Mapping to Git Architecture

The bolted bay doors are Branch Protection Rules; the two officer keys are `CODEOWNERS` peer review approvals; the sensor checks are GitHub Actions CI status checks.

---

## 3. The Mechanism: GitHub Rulesets, Status Checks, and CODEOWNERS Routing

How GitHub enforces enterprise branch governance:

### Core Governance Mechanisms

1. **Require Pull Request Before Merging**: Blocks all direct `git push` commands to protected branches.
2. **Required Approvals**: Enforces minimum peer review count (e.g. 1–3 reviewers) and dismisses stale approvals upon new commits.
3. **CODEOWNERS Matching**: Located at `.github/CODEOWNERS`; automatically assigns specific domain experts (e.g. `@security-team` for `auth/**`).
4. **Required Status Checks (Strict Mode)**: Demands that CI builds pass and forces the PR branch to be up-to-date with `main` before merge.
5. **Enforce Admin Restrictions**: Prevents repository admins and team leads from bypassing rules.

---

## 4. Diagram: Enterprise Branch Protection and Pull Request Governance Pipeline

### Pull Request Gatekeeper Pipeline

```text
[Feature Branch: `feat/payments`]
              │
              │ 1. Open Pull Request to `main`
              ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHub PR Gatekeeper                     │
│                                                             │
│  [CI / CD Pipeline] ────────▶ [Unit Tests: PASS] ✅         │
│  [Security Scanning] ───────▶ [CodeQL Scan: PASS] ✅         │
│  [CODEOWNERS] ──────────────▶ [@lead-architect: APPROVED] ✅│
│  [Branch Freshness] ────────▶ [Up-to-date with main] ✅     │
└─────────────────────────────────────────────────────────────┘
              │
              │ 2. All Requirements Green!
              ▼
   [Squash and Merge to `main`] ──▶ Automatically deployed to Production!
```

---

## 5. CLI Walkthrough: Configuring CODEOWNERS, GitHub CLI PR Lifecycle, and Merge Strategies

A complete terminal walkthrough creating enterprise rules and managing PRs via `gh` CLI:

```bash
# 1. Initialize playground repository
mkdir github_lab && cd github_lab
git init
mkdir -p .github

# 2. Create enterprise CODEOWNERS file
cat << 'EOF' > .github/CODEOWNERS
# Global default owners for everything in repository
* @lead-maintainer

# Security and authentication require security team review
/src/auth/ @security-team
/infra/terraform/ @devops-team

# Core database migrations require database administrator
/src/db/migrations/ @dba-team
EOF
git add .github/CODEOWNERS
git commit -m "chore(governance): add enterprise CODEOWNERS configuration"

# 3. Create feature branch and make modifications
git switch -c feat/auth-tokens
mkdir -p src/auth
echo "export const signToken = () => 'jwt_secret';" > src/auth/token.ts
git add src/auth/token.ts
git commit -m "feat(auth): implement JWT token generator"

# 4. Create Pull Request using GitHub CLI (gh)
# gh pr create --title "feat(auth): implement JWT token generator" \
#              --body "Adds JWT signing. Automatically requests review from @security-team." \
#              --base main --head feat/auth-tokens

# 5. Check PR CI and review status via CLI
# gh pr status
# gh pr checks

# 6. Review and Approve PR via CLI
# gh pr review feat/auth-tokens --approve --comment "LGTM! Verified encryption standards."

# 7. Merge PR using Squash and Merge strategy
# gh pr merge feat/auth-tokens --squash --delete-branch
```

---

## 6. Comparing GitHub Merge Strategies: Merge Commit vs Squash and Merge vs Rebase and Merge

| Strategy | Commit History on `main` | Original Hashes Preserved? | Resolving Reverts | Best For |
|---|---|---|---|---|
| **Squash and Merge** | Single clean semantic commit | No (All commits collapsed) | 1-Click clean revert | Feature branches & enterprise PRs |
| **Rebase and Merge** | Linear chain of individual commits| No (All hashes rewritten) | Multi-step revert | High-discipline granular commit chains |
| **Create Merge Commit** | Multi-parent merge bubble | Yes (Exact hashes kept) | Requires `revert -m 1` | Long-term release tracking / Git Flow |

---

## 7. Common Mistakes

- **Not enabling "Include Administrators" in Branch Protection.** Allows admins to accidentally force-push or bypass broken CI checks.
- **Forgetting to dismiss stale approvals when new commits are pushed.** A developer gets an approval, then pushes a broken bug commit that auto-merges unreviewed.
- **Syntax errors in `.github/CODEOWNERS`.** Paths without leading slashes match anywhere in the repo; always test owner rules in GitHub UI.
- **Allowing merge without requiring branches to be up-to-date.** Causes semantic merge bugs where two individually passing PRs break each other when merged together.
- **Using "Create Merge Commit" on fast-moving feature branches.** Results in messy spiderweb history on `main`.

---

## 8. Hands-On Exercises

**Exercise 1:** Create a `.github/CODEOWNERS` file defining path-specific review teams for `/infra/` and `/src/`.

**Exercise 2:** Create a feature branch and open a pull request using `gh pr create`.

**Exercise 3:** Inspect running CI checks on a pull request using `gh pr checks`.

**Exercise 4:** Practice merging a PR using `gh pr merge --squash --delete-branch`.

**Exercise 5:** Configure a repository branch protection ruleset requiring 2 approvals and a passing `build-and-test` job.

---

## 9. Interview Q&A

**Q: What are GitHub Branch Protection Rules and why are they essential in team software engineering?**
GitHub Branch Protection Rules are server-side access control policies applied to designated repository branches (such as `main` or `release/*`). They prevent direct pushes, require pull requests, mandate minimum peer code reviews, require status checks (CI tests) to pass before merging, and prevent history deletion or force-pushing.

**Q: How does the `.github/CODEOWNERS` file work?**
The `CODEOWNERS` file defines automated code review assignment rules based on file paths. When a pull request modifies files matching a pattern in `CODEOWNERS`, GitHub automatically requests reviews from the specified users or teams and blocks merging until those designated code owners approve the changes.

**Q: What is the difference between "Squash and Merge" and "Rebase and Merge" on GitHub?**
- **Squash and Merge** takes all commits on the pull request branch, collapses them into a single consolidated commit, and applies it to the target branch.
- **Rebase and Merge** takes each individual commit from the pull request branch, re-roots them on top of the target branch without creating a merge commit, preserving individual commit granularity in a linear sequence.

**Q: Why is "Require branches to be up to date before merging" (Strict Mode) critical for CI reliability?**
Without strict mode, a PR is tested against the `main` branch state from when the PR was created. If `main` has advanced with new commits in the meantime, the PR might pass CI in isolation but break when merged. Strict mode forces the PR to integrate latest `main` and pass CI on the combined state before merging.

**Q: What happens if an approval is granted on a PR, and the author pushes an additional commit?**
If "Dismiss stale pull request approvals when new commits are pushed" is enabled, GitHub automatically revokes all existing approvals when new code is pushed, forcing reviewers to inspect the new changes before the PR can be merged.
