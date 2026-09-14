# The Three Trees (Working Tree, Index, and HEAD) — Complete Guide

> "A theater production company manages the live rehearsal stage (working tree), the backstage staging holding area (index), and the archival recorded performance film reel (HEAD)."

---

## Table of Contents

1. [The Problem: Why Doesn't Git Commit Directly from the Working Directory?](#1-the-problem-why-doesnt-git-commit-directly-from-the-working-directory)
2. [The Theater Stage and Backstage Staging Analogy](#2-the-theater-stage-and-backstage-staging-analogy)
3. [The Mechanism: The Three Trees State Lifecycle](#3-the-mechanism-the-three-trees-state-lifecycle)
4. [Diagram: State Transitions Across the Three Trees](#4-diagram-state-transitions-across-the-three-trees)
5. [CLI Walkthrough: Tracking State Transitions Across Working Tree, Index, and HEAD](#5-cli-walkthrough-tracking-state-transitions-across-working-tree-index-and-head)
6. [Comparing Working Tree vs Index vs HEAD](#6-comparing-working-tree-vs-index-vs-head)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Why Doesn't Git Commit Directly from the Working Directory?

In monolithic systems, making a commit saves everything in your directory simultaneously. If you modified 5 files but only want to commit a bug fix in 1 file while keeping the other 4 experimental, you are forced to commit dirty, unrelated changes.

### The All-or-Nothing Commit Problem

```text
Without Staging Area:
  Edited: auth.py (Bugfix ready) + test.py (WIP draft) + db.py (Broken experiment)
  Commit ──▶ Commits broken experiments alongside the bugfix!

With Staging Area (The Index):
  Stage ONLY auth.py ──▶ Commit creates an atomic, isolated bugfix snapshot!
```

### The Solution: The Three Trees Model

Git separates state into three distinct trees: the **Working Tree** (your local files on disk), the **Index / Staging Area** (the proposed next commit snapshot in `.git/index`), and **HEAD** (the last committed snapshot).

---

## 2. The Theater Stage and Backstage Staging Analogy

A theater director does not push every actor who walks into the lobby directly onto the live stage during a recorded broadcast.

### Theater Workflow vs Git Trees

```text
Rehearsal Floor (Working Tree)  → Actors trying on rough costumes, scripts scribbled with notes.
Backstage Greenroom (Index)     → Exact cast called for Act 1, fully costumed, standing in order.
Archival Broadcast (HEAD)       → The recorded tape of the performance preserved permanently.
```

### Mapping to Git Architecture

Your local disk edits are the rehearsal floor; `git add` moves actors into the backstage greenroom (`.git/index`); `git commit` records the archival tape (`HEAD`).

---

## 3. The Mechanism: The Three Trees State Lifecycle

Understanding Git requires tracking how data moves across the three storage tiers:

### 1. Working Tree (Sandbox)

The physical directory of files on your OS filesystem. You edit, compile, and delete files here.

### 2. Index / Staging Area (`.git/index`)

A binary file that records the exact list of file paths, file permissions, and SHA-1 blob hashes that will comprise the *next* commit.

### 3. HEAD (Last Committed State)

A pointer reference (`.git/HEAD`) resolving to the branch reference that points to the most recent commit object in the current branch history.

```text
Working Tree ──(git add)──▶ Index / Staging ──(git commit)──▶ HEAD
Working Tree ◀──(git checkout / restore)── Index ◀──(git reset)── HEAD
```

---

## 4. Diagram: State Transitions Across the Three Trees

### Complete State Transition Topology

```text
┌─────────────────────────┐
│ 1. Working Tree         │ (Local files on disk: uncommitted edits)
└────────────┬────────────┘
             │
             │ `git add <file>` (Creates blob in .git/objects, writes hash to index)
             ▼
┌─────────────────────────┐
│ 2. Index / Staging Area │ (`.git/index`: the proposed next commit tree)
└────────────┬────────────┘
             │
             │ `git commit` (Writes tree object, creates commit object, advances HEAD)
             ▼
┌─────────────────────────┐
│ 3. HEAD Repository      │ (Permanent immutable commit snapshot)
└─────────────────────────┘
```

---

## 5. CLI Walkthrough: Tracking State Transitions Across Working Tree, Index, and HEAD

A step-by-step CLI demonstration observing the Three Trees in action:

```bash
# 1. Initialize repository
mkdir three_trees_lab && cd three_trees_lab
git init

# 2. Step 1: Modify Working Tree
echo "print('Version 1')" > main.py
# Status: main.py is untracked (Only in Working Tree)
git status -s
# Output: ?? main.py

# 3. Step 2: Move into Index (Staging)
git add main.py
# Git creates blob in .git/objects and updates .git/index
git status -s
# Output: A  main.py (In Index and Working Tree, not in HEAD)

# 4. Step 3: Commit to HEAD
git commit -m "feat: add main.py v1"
# HEAD now matches Index and Working Tree!
git status
# Output: nothing to commit, working tree clean

# 5. Step 4: Create Divergence across all Three Trees
# A. Edit Working Tree
echo "print('Version 2 - Working Tree')" > main.py
# B. Stage an intermediate edit
git add main.py
# C. Edit Working Tree AGAIN without staging!
echo "print('Version 3 - Unstaged Draft')" > main.py

# 6. Inspect the 3 different states simultaneously!
# Compare Working Tree vs Index:
git diff
# Shows diff between "Version 2" (Index) and "Version 3" (Working Tree)

# Compare Index vs HEAD:
git diff --staged
# Shows diff between "Version 1" (HEAD) and "Version 2" (Index)
```

---

## 6. Comparing Working Tree vs Index vs HEAD

| Dimension | Working Tree | Index / Staging Area | HEAD |
|---|---|---|---|
| Location on Disk | Project root directory | `.git/index` binary file | `.git/refs/heads/<branch>` |
| Representation | Real OS files and folders | Flat binary list of hashes & paths | Immutable commit object |
| Lifetime | Ephemeral local filesystem state | Transient staging cache | Permanent repository history |
| Tracked By | OS File Explorer / IDE | Git staging engine | Git DAG commit graph |
| Reset Command | `git restore <file>` | `git restore --staged <file>` | `git reset <commit>` |

---

## 7. Common Mistakes

- **Confusing `git diff` with `git diff --staged`.** `git diff` compares the Working Tree against the Index; `git diff --staged` compares the Index against HEAD.
- **Thinking `git commit -a` deletes the need for an Index.** `git commit -a` does not bypass the Index; it automatically stages all tracked modified files into `.git/index` before running the commit.
- **Assuming untracked files are in the Index.** New untracked files exist solely in the Working Tree until explicitly staged with `git add`.
- **Accidentally discarding uncommitted working tree work.** Running `git restore .` permanently overwrites uncommitted working tree files with index state without any undo capability.
- **Treating the Index as a human-readable text file.** `.git/index` is a structured binary file; inspect it using `git ls-files --stage`.

---

## 8. Hands-On Exercises

**Exercise 1:** Modify a file, stage it, modify it again, and inspect both `git diff` and `git diff --staged`.

**Exercise 2:** Use `git ls-files --stage` to inspect the internal SHA-1 blob hashes recorded in `.git/index`.

**Exercise 3:** Use `git restore --staged <file>` to unstage a staged file and verify it returns to modified unstaged status.

**Exercise 4:** Use `git restore <file>` to revert working tree modifications to match the staged index.

**Exercise 5:** Inspect `.git/HEAD` using `cat .git/HEAD` and follow the reference pointer to `.git/refs/heads/main`.

---

## 9. Interview Q&A

**Q: What are the "Three Trees" in Git architecture?**
The Three Trees are:
1. **Working Tree**: The actual files and directories on your local disk.
2. **Index / Staging Area**: The intermediate binary cache (`.git/index`) representing the proposed tree structure for the next commit.
3. **HEAD**: The pointer to the last commit snapshot in the current active branch.

**Q: What actually happens under the hood when you run `git add file.txt`?**
Git reads `file.txt`, generates a blob object (hashes the header + content and writes the compressed file to `.git/objects/`), and updates `.git/index` with the file's path, file mode, and new blob SHA-1 hash.

**Q: What is the difference between `git diff` and `git diff --cached` (or `git diff --staged`)?**
`git diff` shows the differences between the **Working Tree** and the **Index** (unstaged modifications). `git diff --staged` (or `--cached`) shows the differences between the **Index** and **HEAD** (changes that will be included in the next commit).

**Q: How does `git status` determine if a file is modified or untracked?**
`git status` performs a 3-way comparison:
- It compares files in the Working Tree against entries in `.git/index`.
- It compares entries in `.git/index` against the tree referenced by `HEAD`.
Files present in the working tree but missing from the index are "untracked"; differences between working tree and index are "changes not staged"; differences between index and HEAD are "changes to be committed".

**Q: Can you commit directly to HEAD without updating the Index?**
No. In Git's internal architecture, all commit commands (`git commit`, `git commit -am`) build the new commit object's root tree strictly from the current state of `.git/index`.
