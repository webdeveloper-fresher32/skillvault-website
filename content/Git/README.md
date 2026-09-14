# Git & GitHub Mastery — Complete Professional Curriculum

A comprehensive, production-grade curriculum covering Git internals, plumbing mechanics, branching strategies, conflict resolution, history rewriting, disaster recovery, automation hooks, and enterprise GitHub collaboration.

---

## Course Architecture & Mental Model

```text
                                    Git Architecture & Topology
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                                  The Three Trees                                       │
  │   ┌─────────────────────┐   ┌──────────────────────────┐   ┌───────────────────────┐   │
  │   │    Working Tree     │──▶│   Index (Staging Area)   │──▶│    HEAD Reference     │   │
  │   │  (OS Filesystem)    │   │  (Binary `.git/index`)   │   │  (Tip of Active Br)   │   │
  │   └──────────┬──────────┘   └────────────┬─────────────┘   └───────────┬───────────┘   │
  └──────────────┼───────────────────────────┼─────────────────────────────┼───────────────┘
                 │                           │                             │
                 ▼                           ▼                             ▼
  ┌─────────────────────────┐ ┌────────────────────────────┐ ┌────────────────────────────┐
  │   The Object Database   │ │ Branching & Integration    │ │ Disaster Recovery & Reflog │
  │   • Blobs (File bytes)  │ │ • 3-Way Merge vs Rebase    │ │ • Reflog (`HEAD@{N}`)      │
  │   • Trees (Directories) │ │ • Interactive Rebase (-i)  │ │ • Soft / Mixed / Hard Reset│
  │   • Commits & Tags      │ │ • Conflict Engine & Rerere │ │ • Commit & Stash Rescue    │
  └──────────────┬──────────┘ └──────────────┬─────────────┘ └─────────────┬──────────────┘
                 │                           │                             │
                 └───────────────────────────┼─────────────────────────────┘
                                             │
                                             ▼
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                      Enterprise Workflows, Security & GitHub                           │
  │  • Remote Synchronization (`fetch` vs `pull --rebase`) • Atomic `--force-with-lease`   │
  │  • Client/Server Hooks (`.githooks`) • CODEOWNERS & Branch Protection Rulesets         │
  │  • Cryptographic Commit Signing (GPG / SSH Ed25519) • Open-Source Triangular Forking   │
  └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Learning Path

| Phase | Focus Topic | Key Concepts | Difficulty | Time |
|---|---|---|---|---|
| **[Phase 1](Phase-01-Git-Core-Architecture-and-Plumbing/README.md)** | Core Architecture & Plumbing | Object model (blobs, trees, commits), Three Trees, Plumbing commands | Beginner | 3 days |
| **[Phase 2](Phase-02-Staging-Committing-and-Inspection/README.md)** | Staging, Commits & Inspection | Atomic commits, Conventional Commits, `diff --staged`, `log`, `blame` | Beginner | 3 days |
| **[Phase 3](Phase-03-Branching-Switching-and-Worktrees/README.md)** | Branching, Switching & Worktrees | Branch pointers, `git switch`, Detached HEAD, Multi-Worktrees | Intermediate | 3 days |
| **[Phase 4](Phase-04-Merging-and-Conflict-Resolution/README.md)** | Merging & Conflict Resolution | Fast-Forward vs 3-Way Merge, conflict markers, `zdiff3`, `git rerere` | Intermediate | 3 days |
| **[Phase 5](Phase-05-Rebasing-and-History-Rewriting/README.md)** | Rebasing & History Rewriting | Rebase mechanics, interactive rebase (`squash`, `reword`), Golden Rule | Advanced | 3 days |
| **[Phase 6](Phase-06-Undoing-Changes-and-Disaster-Recovery/README.md)** | Undoing Changes & Disaster Recovery | `restore`, `reset` (--soft/mixed/hard), `revert`, `reflog` forensic rescue | Advanced | 3 days |
| **[Phase 7](Phase-07-Stashing-Cherry-Picking-and-Searching/README.md)** | Stashing, Cherry-Picking & Search | Stash stack (`-u`, `-p`), `cherry-pick -x`, `git bisect`, Pickaxe `-S` | Intermediate | 3 days |
| **[Phase 8](Phase-08-Remotes-Syncing-and-Network-Protocols/README.md)** | Remotes, Syncing & Protocols | Remote tracking (`origin/*`), `fetch` vs `pull --rebase`, `--force-with-lease`, SSH | Intermediate | 3 days |
| **[Phase 9](Phase-09-Git-Hooks-Submodules-and-Configuration/README.md)** | Git Hooks, Submodules & Config | `pre-commit`, `commit-msg`, `core.hooksPath`, Submodules, `.gitattributes` | Advanced | 3 days |
| **[Phase 10](Phase-10-GitHub-Collaboration-Security-and-Enterprise-Workflows/README.md)** | GitHub Workflows & Security | Branch protection rulesets, CODEOWNERS, Forking model, GPG/SSH commit signing | Production | 3 days |

---

## Hands-On Capstone Projects

Apply everything you have learned by building 3 enterprise-grade portfolio projects:

1. **[Project 1: Enterprise Git Flow and Release Pipeline](Projects/01-Enterprise-Git-Flow-and-Release-Pipeline.md)**
   - Multi-branch model, Conventional Commit hooks, CODEOWNERS branch protection rules, and signed semantic release tagging.
2. **[Project 2: Complex Merge Conflict Simulation & Interactive Rebase](Projects/02-Complex-Merge-Conflict-Simulation-and-Interactive-Rebase.md)**
   - 3-way conflict resolution with `zdiff3`, `git rerere` automation, and interactive rebase cleanup of messy histories.
3. **[Project 3: Disaster Recovery, Reflog Rescue & Automated Bisect](Projects/03-Disaster-Recovery-Reflog-Rescue-and-Bug-Hunting-with-Bisect.md)**
   - Rescuing hard-reset commits via `git reflog`, dangling object forensics, and automated regression isolation with `git bisect run`.

---

## Quick Reference & Interview Prep

- **[Syntax & Architecture Cheatsheet](Quick-Reference/Cheatsheet.md)**: Dense, copy-pasteable command reference covering all operational domains and plumbing internals.
- **[50 Comprehensive Interview Questions & Answers](Quick-Reference/Interview-QA.md)**: Technical interview questions covering Git internals, merge engines, rebasing rules, and enterprise GitHub security.

---

## Prerequisites & Getting Started

### Prerequisites
- Familiarity with the command-line interface (Bash, Zsh, or PowerShell).
- Modern Git installed (version 2.34+ recommended for native SSH signing).
- A GitHub account for remote synchronization and pull request workflows.

### Recommended Global Configuration
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global fetch.prune true
git config --global rebase.autoStash true
git config --global merge.conflictStyle zdiff3
```
