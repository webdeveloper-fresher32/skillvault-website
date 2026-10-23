# Restoring and Discarding Uncommitted Work — Complete Guide

> "A sculptor experimenting with clay can simply moisten and smooth out a poorly carved thumb to start over, or brush away loose clay shavings from the workbench using a dedicated dust brush without damaging the main sculpture."

---

## Table of Contents

1. [The Problem: Dangerous Overwriting and Cluttered Workspaces](#1-the-problem-dangerous-overwriting-and-cluttered-workspaces)
2. [The Clay Sculptor's Smoothing Tool and Dust Brush Analogy](#2-the-clay-sculptors-smoothing-tool-and-dust-brush-analogy)
3. [The Mechanism: git restore and git clean Internals](#3-the-mechanism-git-restore-and-git-clean-internals)
4. [Diagram: State Transitions of git restore and git clean](#4-diagram-state-transitions-of-git-restore-and-git-clean)
5. [CLI Walkthrough: Unstaging, Discarding, and Purging Untracked Junk](#5-cli-walkthrough-unstaging-discarding-and-purging-untracked-junk)
6. [Comparing git restore vs git clean vs git reset](#6-comparing-git-restore-vs-git-clean-vs-git-reset)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Dangerous Overwriting and Cluttered Workspaces

During frantic debugging sessions, developers often modify tracked files, stage incorrect files, and generate dozens of temporary test artifacts (`test.log`, `temp.json`, `dist/`, `.env.bak`). Knowing how to selectively undo these operations without losing valid work is an essential survival skill.

### The Cleanup Dilemma

```text
Problem 1: Staged files you didn't mean to commit (Need to unstage, keep disk edits).
Problem 2: Tracked file modified with broken experimental code (Need to discard disk edits).
Problem 3: 50 untracked build artifacts and temporary folders cluttering `git status` (Need to purge).
```

### The Solution: `git restore` and `git clean`

Modern Git provides `git restore` (for tracked file staging and disk discarding) and `git clean` (for safely sweeping away untracked filesystem debris).

---

## 2. The Clay Sculptor's Smoothing Tool and Dust Brush Analogy

A sculptor works on a statue surrounded by carving shavings.

### Smoothing Clay vs Sweeping Shavings

```text
Tracked File Modification → The carved facial feature (tracked clay); smoothing it restores the previous smooth curve.
Untracked Build Files     → Loose clay dust and wood chips on the floor (untracked);
                            a dustpan and broom sweeps them out without touching the statue.
```

### Mapping to Git Architecture

Smoothing the sculpture is `git restore <file>`; sweeping away the floor shavings is `git clean -fd`.

---

## 3. The Mechanism: git restore and git clean Internals

Understanding how Git undoes uncommitted modifications across the Three Trees:

### Modern `git restore` Commands

- **`git restore <file>`**: Copies file state from the **Index** to the **Working Tree** (discards unstaged disk edits).
- **`git restore --staged <file>`**: Copies file state from **HEAD** to the **Index** (unstages changes while leaving working tree edits on disk intact).
- **`git restore --staged --worktree <file>`**: Resets both index and working tree to match **HEAD** in a single atomic command.
- **`git restore --source=<commit_hash> <file>`**: Restores a specific file to its exact snapshot from an earlier historical commit.

### The `git clean` Untracked Garbage Collector

- **`git clean -n` / `-nd`**: Dry-run! Shows which untracked files and directories would be deleted without actually removing anything.
- **`git clean -fd`**: Force-removes all untracked files (`-f`) and untracked directories (`-d`).
- **`git clean -fdx`**: Force-removes all untracked files including files ignored by `.gitignore` (useful for 100% clean builds).

---

## 4. Diagram: State Transitions of git restore and git clean

### Moving Content Across Trees

```text
┌──────────┐              git restore --staged               ┌──────────┐
│   HEAD   │ ──────────────────────────────────────────────▶ │  INDEX   │
│ (Commit) │                                                 │ (Staged) │
└──────────┘                                                 └──────────┘
     │                                                            │
     │            git restore --source=HEAD (or --staged --worktree) │
     └──────────────────────────────────────────────┐             │ git restore
                                                    ▼             ▼
                                             ┌──────────────────────────┐
                                             │       WORKING TREE       │
                                             │    (Tracked on Disk)     │
                                             └──────────────────────────┘
                                                          ▲
                                                          │ `git clean -fd`
                                             ┌──────────────────────────┐
                                             │     UNTRACKED FILES      │
                                             │ (.log, temp/, build/)    │
                                             └──────────────────────────┘
```

---

## 5. CLI Walkthrough: Unstaging, Discarding, and Purging Untracked Junk

A complete practical terminal lab demonstrating safe workspace resets:

```bash
# 1. Initialize playground repository
mkdir undo_lab && cd undo_lab
git init

# 2. Create baseline commit
echo "Production Code v1.0" > app.js
echo "DB Config" > config.json
git add .
git commit -m "feat: initial release"

# 3. Scenario A: Modify tracked file and discard unstaged edits
echo "// Broken experiment" >> app.js
git status -s # Output: M app.js

git restore app.js # Discard working tree modifications!
git status -s # Clean! app.js reverted to Index snapshot.

# 4. Scenario B: Unstage a file without losing disk edits
echo "PORT=9000" >> config.json
git add config.json
git status -s # Output: M  config.json (Staged)

git restore --staged config.json # Unstage!
git status -s # Output:  M config.json (Unstaged on disk!)

# 5. Scenario C: Restore file from a historical commit snapshot
echo "Corrupted config" > config.json
git restore --source=HEAD config.json # Restores working tree to HEAD snapshot!

# 6. Scenario D: Clean up untracked files and build directories
echo "debug log content" > debug.log
mkdir temp_cache && echo "cache data" > temp_cache/data.bin
git status -s
# Output: ?? debug.log, ?? temp_cache/

# Always perform a dry-run first!
git clean -nd
# Output: Would remove debug.log, Would remove temp_cache/

# Execute the purge:
git clean -fd
# Output: Removing debug.log, Removing temp_cache/
git status # Working tree completely clean!
```

---

## 6. Comparing git restore vs git clean vs git reset

| Command | Target Target | Modifies Disk? | Reversible? |
|---|---|---|---|
| `git restore <file>` | Tracked files (Index $\to$ Disk) | Yes (Discards unstaged edits) | **No** (Permanent data loss) |
| `git restore --staged <file>` | Index (HEAD $\to$ Index) | No (Disk edits remain) | **Yes** (Can re-stage) |
| `git clean -fd` | Untracked files/folders | Yes (Deletes untracked files) | **No** (Bypasses OS Trash) |
| `git clean -fdx` | Ignored + untracked files | Yes (Deletes node_modules, etc) | **No** (Requires re-install) |
| `git reset HEAD <file>` | Legacy syntax for unstage | No (Equivalent to `restore --staged`) | **Yes** |

---

## 7. Common Mistakes

- **Running `git restore .` without checking `git diff`.** Permanently obliterates all unstaged work across the entire repository with zero confirmation.
- **Running `git clean -fd` without a prior `-nd` dry-run.** Accidentally deletes newly created source files that had not yet been added to Git.
- **Assuming deleted untracked files go to the OS Recycle Bin/Trash.** `git clean` directly unlinks files from the filesystem; they are completely unrecoverable!
- **Confusing `git restore --staged` with `git restore`.** Omitting `--staged` wipes out your uncommitted disk work instead of simply unstaging it.
- **Forgetting that `.gitignore` prevents `git clean -fd` from touching ignored files.** To clean ignored artifacts like `node_modules/`, use `git clean -fdx`.

---

## 8. Hands-On Exercises

**Exercise 1:** Modify a tracked file and restore it to the Index state using `git restore <file>`.

**Exercise 2:** Stage 3 modified files and unstage only one file using `git restore --staged <file>`.

**Exercise 3:** Perform an atomic full reset of a staged file's index and working tree using `git restore --staged --worktree <file>`.

**Exercise 4:** Create 5 dummy log files and a temp directory, perform a dry run with `git clean -nd`, then delete them with `git clean -fd`.

**Exercise 5:** Restore a single file from 2 commits ago using `git restore --source=HEAD~2 <file>` and verify its contents.

---

## 9. Interview Q&A

**Q: What is the purpose of `git restore` introduced in Git 2.23?**
`git restore` was introduced to provide a dedicated, unambiguous interface for restoring files in the working directory and index. It replaces the confusing and overloaded legacy uses of `git checkout -- <file>` (for discarding unstaged changes) and `git reset HEAD <file>` (for unstaging files).

**Q: What is the exact difference between `git restore <file>` and `git restore --staged <file>`?**
- `git restore <file>` copies the file content from the **Index** to the **Working Tree**, permanently discarding any unstaged edits on disk.
- `git restore --staged <file>` copies the file state from **HEAD** to the **Index**, removing the file from the staging area while keeping your uncommitted modifications on disk.

**Q: Why should you always run `git clean -nd` before `git clean -fd`?**
`git clean -fd` permanently deletes untracked files and directories from disk, bypassing the operating system trash bin. Running `git clean -nd` performs a safe dry-run preview, allowing developers to ensure they do not accidentally erase newly created, un-staged source code files.

**Q: What does the `-x` flag do in `git clean -fdx`?**
By default, `git clean` ignores files matched by `.gitignore`. The `-x` flag instructs Git to ignore the `.gitignore` rules and purge all untracked files, including build artifacts, compiled binaries, and directories like `node_modules/` or `dist/`, providing a guaranteed clean repository state.

**Q: How can you restore a single deleted file that was removed from disk but not yet committed?**
Run `git restore <path/to/deleted_file>`. Git reads the file's blob from the Index (or HEAD) and recreates the file on disk in your working tree.
