# Linear History and Rebase Mechanics — Complete Guide

> "Moving a prefabricated timber house frame onto a newly poured concrete foundation lifts the entire timber structure intact and anchors it on top of the fresh foundation, creating a single seamless multi-story building."

---

## Table of Contents

1. [The Problem: Entangled Merge Bubbles and Non-Linear History Pollution](#1-the-problem-entangled-merge-bubbles-and-non-linear-history-pollution)
2. [The Prefab House Foundation Analogy](#2-the-prefab-house-foundation-analogy)
3. [The Mechanism: How git rebase Serializes and Replays Commit Patches](#3-the-mechanism-how-git-rebase-serializes-and-replays-commit-patches)
4. [Diagram: The Rebase Commit Replay Pipeline](#4-diagram-the-rebase-commit-replay-pipeline)
5. [CLI Walkthrough: Rebasing a Feature Branch onto an Advanced Main Branch](#5-cli-walkthrough-rebasing-a-feature-branch-onto-an-advanced-main-branch)
6. [Comparing git rebase vs git merge](#6-comparing-git-rebase-vs-git-merge)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Entangled Merge Bubbles and Non-Linear History Pollution

In active teams where 10 developers merge branches constantly, running `git merge main` inside feature branches generates dozens of noisy "Merge branch 'main' into feature" merge commits, turning `git log --graph` into an unreadable tangle of yarn.

### The "Merge Bubble" Pollution

```text
Without Rebase (Constant Reverse Merges):
  *   8a192fc Merge branch 'main' into feature-billing
  |\
  | * c9182aa (main) fix: security vulnerability
  * | 5f910a1 feat: stripe checkout
  * |   3b2819c Merge branch 'main' into feature-billing
  |\ \
  | |/
  | * 1b08f44 feat: update database pool
  (50% of repository commit messages are redundant merge bubbles!)
```

### The Solution: Linear Rebasing (`git rebase`)

`git rebase` lifts your branch commits off their original base, finds the latest commit on `main`, and replays your commits one-by-one on top of `main`, producing a pristine linear history.

---

## 2. The Prefab House Foundation Analogy

A construction crew builds a wooden house frame offsite while civil engineers pour a new concrete foundation on the permanent property.

### Pouring Extra Concrete vs Re-rooting Frame

```text
Reverse Merge (Cluttered) → Pours concrete over the wooden frame, building a strange bridge between two sites.
Rebase (Clean Lift)       → A crane lifts the wooden frame off the temporary dirt lot (old base)
                            and lowers it directly onto the new concrete slab (new base).
```

### Mapping to Git Architecture

The wooden frame commits are your feature branch commits; the new concrete slab is `main`; the crane lifting and anchoring is `git rebase main`.

---

## 3. The Mechanism: How git rebase Serializes and Replays Commit Patches

When you run `git rebase main` on `feature`:

### Step-by-Step Rebase Execution

1. **Find Merge Base**: Identifies the common ancestor between `feature` and `main`.
2. **Store Patches in Memory**: Saves each commit unique to `feature` (from base to tip) into temporary patch files inside `.git/rebase-apply/` (or `.git/rebase-merge/`).
3. **Reset Branch Pointer**: Resets the current branch pointer to `main` (`HEAD = main`).
4. **Sequentially Apply Patches**: Applies each stored patch one-by-one, generating **brand-new commit objects with new SHA hashes**!
5. **Fast-Forward Complete**: Moves the `feature` branch reference to the final replayed commit.

---

## 4. Diagram: The Rebase Commit Replay Pipeline

### Rebase DAG Transformation

```text
Before Rebase:
            (main) C3 ──▶ C4
           /
  C1 ──▶ C2 (Merge Base)
           \
            (feature) C5 ──▶ C6

During Rebase:
  1. Patches C5 and C6 saved to temporary cache
  2. `feature` pointer temporarily moved to C4
  3. Patch C5 applied onto C4 ──▶ Creates C5' (New SHA!)
  4. Patch C6 applied onto C5' ──▶ Creates C6' (New SHA!)

After Rebase:
  C1 ──▶ C2 ──▶ C3 ──▶ C4 (main) ──▶ C5' ──▶ C6' (feature)  [Pristine Linear Line!]
```

---

## 5. CLI Walkthrough: Rebasing a Feature Branch onto an Advanced Main Branch

A complete terminal walkthrough demonstrating standard rebase and resolving rebase conflicts:

```bash
# 1. Initialize playground repository
mkdir rebase_lab && cd rebase_lab
git init

# 2. Create initial commits on main
echo "Architecture Base" > arch.txt
git add arch.txt
git commit -m "feat: initial commit"

# 3. Create feature branch and make 2 commits
git switch -c feature-api
echo "API Endpoint 1" > api.txt
git add api.txt
git commit -m "feat(api): add user endpoint"

echo "API Endpoint 2" >> api.txt
git commit -am "feat(api): add auth endpoint"

# 4. Meanwhile, main advances with new work!
git switch main
echo "Database Connection" > db.txt
git add db.txt
git commit -m "feat(db): configure postgres pool"

echo "Logger Middleware" > log.txt
git add log.txt
git commit -m "feat(core): add winston logging"

# 5. Inspect diverged graph before rebase
git log --oneline --graph --all
# Shows split graph!

# 6. Rebase feature-api onto the new tip of main
git switch feature-api
git rebase main
# Output:
# Successfully rebased and updated refs/heads/feature-api.

# 7. Inspect linear graph after rebase!
git log --oneline --graph --all
# Pristine, flat, linear history where API commits sit cleanly on top of main!
```

---

## 6. Comparing git rebase vs git merge

| Metric | `git rebase` | `git merge` |
|---|---|---|
| History Topology | Strictly linear (No merge bubbles) | Branching DAG with merge bubble commits |
| Commit Hashes | **Rewritten** (New SHA hashes created) | **Preserved** (Original SHAs intact) |
| Merge Base Tracking | Moves forward to upstream tip | Stays at original common ancestor |
| Conflict Handling | Resolved commit-by-commit | Resolved in 1 single merge commit |
| Public Branch Safety | Dangerous on shared branches | 100% Safe on shared branches |

---

## 7. Common Mistakes

- **Rebasing public shared branches that teammates have cloned.** Rewriting shared commits forces teammates into diverged history hell.
- **Forgetting that `git rebase` rewrites commit SHAs.** Even if code is identical, the new parent hash and timestamp produce completely new commit objects.
- **Panicking during a rebase conflict.** If a rebase conflict seems overwhelming, run `git rebase --abort` to return safely to the exact pre-rebase state.
- **Running `git rebase --skip` blindly.** Skipping a commit during a rebase drops that commit from history entirely!
- **Using `git pull` without `--rebase`.** Default `git pull` creates unnecessary merge commits; configure `git config pull.rebase true`.

---

## 8. Hands-On Exercises

**Exercise 1:** Create a diverged feature branch, rebase it onto main, and observe the updated commit hashes with `git log`.

**Exercise 2:** Create a rebase conflict, inspect the intermediate paused state, resolve the conflict, and run `git rebase --continue`.

**Exercise 3:** Provoke a multi-commit rebase conflict and abort the sequence using `git rebase --abort`.

**Exercise 4:** Configure Git to automatically rebase when pulling: `git config --global pull.rebase true`.

**Exercise 5:** Use `git rebase --onto main branch-a branch-b` to transplant a nested topic branch onto main.

---

## 9. Interview Q&A

**Q: What is the fundamental difference between `git merge` and `git rebase`?**
`git merge` creates a new merge commit with two parent pointers, preserving the original commit hashes and exact chronological timeline of both branches. `git rebase` replays the feature branch's commits sequentially on top of the target branch, rewriting the commit hashes to produce a single, flat, linear history without merge bubbles.

**Q: Why do commit SHA hashes change during a `git rebase`?**
A Git commit hash is computed cryptographically from its tree object, parent commit hash, author timestamp, and committer timestamp. Because rebasing changes the parent commit hash and committer timestamp, the resulting SHA-1 hash is mathematically guaranteed to change.

**Q: What happens if a conflict occurs during a `git rebase` of 5 commits?**
Git pauses the rebase at the specific commit where the conflict occurred and leaves conflict markers in the working tree. The developer resolves the conflict, stages the file (`git add <file>`), and runs `git rebase --continue`. Git applies the resolution to that specific replayed commit and proceeds to replay the remaining commits.

**Q: What is the risk of using `git rebase --skip` during a conflict?**
`git rebase --skip` completely discards the patch of the current conflicting commit, dropping the code changes introduced by that commit entirely from the resulting branch history. It should only be used if the changes in that commit were already applied upstream.

**Q: What is `git rebase --onto` and when is it used?**
`git rebase --onto <newbase> <upstream> <branch>` is used to transplant a range of commits from one base to another. It is particularly useful for extracting a sub-branch that was accidentally branched off another unmerged feature branch and transplanting it directly onto `main`.
