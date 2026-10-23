# Git Worktrees for Multi-Branch Multitasking — Complete Guide

> "A carpenter building a dining table does not dismantle and sweep away all sawdust and tools just to quickly build a small wooden stool; they simply step over to a second workbench in the same workshop."

---

## Table of Contents

1. [The Problem: Context Switching and Stash Juggling During Urgent Hotfixes](#1-the-problem-context-switching-and-stash-juggling-during-urgent-hotfixes)
2. [The Multi-Workbench Workshop Analogy](#2-the-multi-workbench-workshop-analogy)
3. [The Mechanism: Linked Working Trees Sharing a Single .git Database](#3-the-mechanism-linked-working-trees-sharing-a-single-git-database)
4. [Diagram: Main Worktree vs Linked Worktree Topology](#4-diagram-main-worktree-vs-linked-worktree-topology)
5. [CLI Walkthrough: Creating, Managing, and Pruning Git Worktrees](#5-cli-walkthrough-creating-managing-and-pruning-git-worktrees)
6. [Comparing Git Stash vs Git Worktrees vs Cloning a Second Repo](#6-comparing-git-stash-vs-git-worktrees-vs-cloning-a-second-repo)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Context Switching and Stash Juggling During Urgent Hotfixes

While in the middle of a 3-day complex feature with uncommitted edits, running development servers, and database seeds, an urgent P0 production hotfix arrives.

### The Stash & Re-build Agony

```text
The Traditional Workflow:
  1. `git stash` (Saves 20 dirty files).
  2. `git switch main`
  3. Re-run `npm install` / reinstall dependencies.
  4. Fix bug, commit, and push.
  5. `git switch feature`
  6. Re-run `npm install` again.
  7. `git stash pop` ──▶ Merge conflicts with stale stash! (Broken state!).
```

### The Solution: Git Worktrees (`git worktree`)

`git worktree` allows you to checkout multiple branches simultaneously into completely separate filesystem directories, all linked to the same single `.git` repository database!

---

## 2. The Multi-Workbench Workshop Analogy

A master carpenter does not clear half-assembled cabinets off their main workbench every time a customer walks in with a broken picture frame.

### Single Table vs Multiple Workbenches

```text
Single Table (Stash)   → Pack up saws, sweep glue, stash cabinet parts in a box;
                         fix picture frame; unpack glue and cabinet parts (Lost time, lost momentum).

Second Bench (Worktree)→ Leave cabinet parts untouched on Workbench 1;
                         walk 5 feet to Workbench 2, fix frame, walk back to Workbench 1 instantly.
```

### Mapping to Git Architecture

The central tool crib is the shared `.git` object database; Workbench 1 is your main feature folder; Workbench 2 is your linked worktree folder.

---

## 3. The Mechanism: Linked Working Trees Sharing a Single .git Database

A linked worktree is a real directory containing its own distinct `.git` pointer file that points back to `.git/worktrees/<name>/` inside the primary repository.

### Core Worktree Architecture

- **Main Worktree**: The primary repository root containing the full `.git/` database directory.
- **Linked Worktree**: An adjacent folder with its own working directory and private `index`, `HEAD`, and `logs` stored inside `.git/worktrees/`.
- **Shared Object Database**: All commits, blobs, trees, and refs are shared instantly without duplicating disk space.
- **Worktree Administrative State**: Located at `.git/worktrees/<id>/gitdir` and `.git/worktrees/<id>/commondir`.
- **Per-Worktree HEAD & Index**: Each worktree manages its own independent staging area and commit cursor.
- **Detached Worktree Capability**: Worktrees can also be checked out directly to tags or commit hashes.
- **Locking Mechanism**: Worktree directories on network drives can be protected from pruning via `git worktree lock`.

---

## 4. Diagram: Main Worktree vs Linked Worktree Topology

### Shared Database with Independent Working Directories

```text
┌─────────────────────────────────────────────────────────────┐
│ Primary Project Directory: `/repos/my-app` (Branch: `feat`) │
│   ├── src/ (Active feature code)                            │
│   └── .git/ ──────────────────────────────────────────┐     │
└───────────────────────────────────────────────────────│─────┘
                                                        │
┌───────────────────────────────────────────────────────│─────┐
│ Linked Worktree: `/repos/my-app-hotfix` (`hotfix-p0`) │     │
│   ├── src/ (Clean production hotfix code)             │     │
│   └── .git [File: `gitdir: /repos/my-app/.git/...`] ◀─┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. CLI Walkthrough: Creating, Managing, and Pruning Git Worktrees

Master concurrent branch multitasking using `git worktree`:

```bash
# 1. Initialize primary project
mkdir -p ~/repos/ecommerce && cd ~/repos/ecommerce
git init
echo "console.log('Production 1.0');" > app.js
git add app.js
git commit -m "feat: initial release v1.0"

# 2. Switch to long-running feature branch and make uncommitted edits
git switch -c feature-checkout
echo "// Half-finished checkout logic" >> app.js
echo "Uncommitted WIP notes" > wip.txt

# 3. Urgent Hotfix Arrives! Create a linked worktree in an adjacent folder:
git worktree add ../ecommerce-hotfix -b hotfix-security-patch main
# Git creates folder `../ecommerce-hotfix` checked out to new branch `hotfix-security-patch`!

# 4. Open the hotfix worktree and fix the bug in parallel!
cd ../ecommerce-hotfix
echo "console.log('Production 1.0 + Security Hotfix');" > app.js
git commit -am "fix(security): patch critical vulnerability"
# Push hotfix to remote (e.g. `git push origin hotfix-security-patch`)

# 5. List all active worktrees across the repository
git worktree list
# Output:
# /Users/.../repos/ecommerce         5f91a2b [feature-checkout]
# /Users/.../repos/ecommerce-hotfix  8c91a0f [hotfix-security-patch]

# 6. Clean up and remove the hotfix worktree when done
cd ~/repos/ecommerce
git worktree remove ../ecommerce-hotfix

# 7. Your feature branch is completely untouched with dirty WIP edits intact!
git status -s
# Shows `M app.js` and `?? wip.txt` exactly as you left them!
```

---

## 6. Comparing Git Stash vs Git Worktrees vs Cloning a Second Repo

| Dimension | `git stash` | `git worktree` | Second `git clone` |
|---|---|---|---|
| Parallel Dev Servers | No (Must terminate server) | Yes (Runs on port 3000 & 3001) | Yes |
| Disk Consumption | Zero extra disk | Only working files (Shared DB) | 2x Full Repo & Object Store |
| Branch Switching Cost | High (Stash pop merge risks) | Zero (Instant folder switch) | High (Manual sync/push/pull) |
| Multi-IDE Windows | No (Single directory) | Yes (Separate VS Code windows) | Yes |
| Local Commit Sharing | Stash is local-only | Instantaneous (Same local DB) | Requires pushing to remote |
| Branch Checkouts | Single active branch | Multiple distinct branches | Multiple distinct branches |
| IDE Re-indexing | Triggers full re-index | Zero re-index penalty | Zero re-index penalty |
| Cleanup Overhead | Manual stash drop | `git worktree remove` | Manual directory delete |
| Network Dependency | 100% Offline | 100% Offline | Requires Network Fetch |

---

## 7. Common Mistakes

- **Trying to checkout the same branch in two worktrees.** Git strictly prohibits checking out the same branch simultaneously to prevent destructive index overwrites.
- **Deleting a worktree folder manually via `rm -rf`.** Deleting the folder without `git worktree remove` leaves stale administrative metadata; run `git worktree prune`.
- **Forgetting that build dependencies (`node_modules`) are separate.** Each worktree has its own working directory, so build dependencies must be installed per worktree.
- **Creating worktrees inside the main repository folder.** Always place worktree folders as siblings outside the root (e.g. `../project-worktree`) to avoid nesting repos.
- **Not locking worktrees on removable storage.** If a worktree lives on a disconnected drive, Git may prune it unless protected by `git worktree lock`.

---

## 8. Hands-On Exercises

**Exercise 1:** Create a worktree for testing a pull request without disturbing your active working branch.

**Exercise 2:** Run two independent dev server processes concurrently from two separate worktrees.

**Exercise 3:** Use `git worktree list` to inspect all active worktree paths, commits, and branches.

**Exercise 4:** Lock a worktree using `git worktree lock <path> --reason "long-term experiment"`.

**Exercise 5:** Delete a worktree folder manually with `rm -rf` and use `git worktree prune` to clean up the metadata.

---

## 9. Interview Q&A

**Q: What is a Git Worktree and what architectural problem does it solve?**
A Git Worktree allows a single Git repository to have multiple working directories attached to it simultaneously, with each directory checked out to a different branch. It eliminates the need to stash uncommitted changes, terminate running dev servers, or make redundant repository clones when switching tasks.

**Q: Why does Git prohibit checking out the same branch in two different worktrees simultaneously?**
Because each branch pointer must represent a single, linear progression of commits. If two worktrees were checked out to the same branch, both would attempt to advance the same `.git/refs/heads/<branch>` pointer concurrently from different states, causing state corruption and race conditions.

**Q: How does a linked worktree communicate with the main repository?**
The linked worktree root contains a `.git` plain text file containing a `gitdir: <path>` pointer pointing to `.git/worktrees/<name>/` inside the primary repository. This directory houses the worktree-specific `HEAD`, `index`, and commit logs, while referencing the shared `.git/objects/` store.

**Q: What is the difference between `git worktree remove` and `git worktree prune`?**
`git worktree remove <path>` safely unlinks the worktree, deletes its working directory, and removes its administrative metadata from `.git/worktrees/`. `git worktree prune` scans `.git/worktrees/` and cleans up stale metadata for linked directories that were deleted manually from disk without using Git commands.

**Q: Why is `git worktree` significantly faster and more disk-efficient than creating a second `git clone`?**
`git worktree` does not duplicate the commit history, blobs, trees, or packfiles stored in `.git/objects/`. It shares the existing local object database directly, using only the disk space required for the checked-out files in the new working directory.
