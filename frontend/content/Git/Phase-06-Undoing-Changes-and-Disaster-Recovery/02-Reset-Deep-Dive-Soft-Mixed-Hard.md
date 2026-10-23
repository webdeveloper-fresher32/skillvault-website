# Reset Deep Dive (Soft, Mixed, and Hard) — Complete Guide

> "A document editor rewind feature can either move your cursor to an earlier version while keeping your typed paragraphs in the clipboard (Soft), keep them in the draft editor window as raw text (Mixed), or shred the pages and discard everything you typed (Hard)."

---

## Table of Contents

1. [The Problem: Navigating and Undoing Committed Work Across Three Trees](#1-the-problem-navigating-and-undoing-committed-work-across-three-trees)
2. [The Document Rewind and Clipboard Analogy](#2-the-document-rewind-and-clipboard-analogy)
3. [The Mechanism: The Three Modes of git reset and Tree Mutation](#3-the-mechanism-the-three-modes-of-git-reset-and-tree-mutation)
4. [Diagram: The Three Trees Mutation Matrix for git reset](#4-diagram-the-three-trees-mutation-matrix-for-git-reset)
5. [CLI Walkthrough: Demonstrating --soft, --mixed, and --hard Resets](#5-cli-walkthrough-demonstrating---soft---mixed-and---hard-resets)
6. [Comparing git reset --soft vs --mixed vs --hard vs git restore](#6-comparing-git-reset---soft-vs---mixed-vs---hard-vs-git-restore)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Navigating and Undoing Committed Work Across Three Trees

When you realize that your last 2 commits contained errors, sensitive secrets, or poorly structured commits, you need to unroll those commits. However, Git manages three separate states: `HEAD`, `Index`, and `Working Tree`. Misunderstanding how `git reset` affects each tree can result in catastrophic accidental deletion of days of uncommitted work.

### The Reset Dilemma

```text
Goal A: Combine last 3 commits into 1? ──▶ Need HEAD moved, keep changes staged (--soft).
Goal B: Redo staging and split changes into smaller commits? ──▶ Move HEAD, unstage changes (--mixed).
Goal C: Completely obliterate the broken experiment? ──▶ Wipe HEAD, Index, and Disk (--hard).
```

### The Solution: Mastering `git reset` Modes

`git reset` is primarily a branch pointer manipulation tool that optionally cascades its changes to the Index and Working Tree depending on the mode specified (`--soft`, `--mixed`, `--hard`).

---

## 2. The Document Rewind and Clipboard Analogy

An author writes 3 paragraphs, copies them to clipboard, and pastes them into a manuscript.

### Three Levels of Document Reversion

```text
Soft Reset  → Moves the publication pointer back 3 paragraphs; your new text remains safely in the
              staged clipboard ready to hit 'Publish' again immediately.

Mixed Reset → Moves publication pointer back 3 paragraphs; un-clips text from clipboard and leaves
              it sitting in your draft editor window as uncommitted text.

Hard Reset  → Moves publication pointer back; clears clipboard AND clears the draft editor window,
              permanently shredding the new paragraphs.
```

### Mapping to Git Architecture

Publication pointer is `HEAD`; clipboard is `Index`; draft editor window is `Working Tree`.

---

## 3. The Mechanism: The Three Modes of git reset and Tree Mutation

Every `git reset <commit>` command executes up to 3 discrete sequential steps:

### The 3 Sequential Reset Steps

1. **Step 1: Move HEAD reference (`--soft`)**
   - Moves `.git/refs/heads/<branch>` to point to the target commit hash.
   - `Index` and `Working Tree` are completely untouched. All changed files remain **staged**!

2. **Step 2: Update Index / Staging Area (`--mixed`, default)**
   - Moves `HEAD` AND updates `.git/index` to match the target commit snapshot.
   - `Working Tree` on disk is untouched. All changed files become **unstaged modifications**!

3. **Step 3: Overwrite Working Tree (`--hard`)**
   - Moves `HEAD`, updates `Index`, AND completely overwrites files in the `Working Tree` to match the target commit.
   - **Destructive**: Any uncommitted changes in tracked files are permanently lost!

---

## 4. Diagram: The Three Trees Mutation Matrix for git reset

### Tree Mutation Cascade

```text
Command Execution                HEAD Moved?    Index Updated?    Working Tree Overwritten?
─────────────────────────────────────────────────────────────────────────────────────────────
`git reset --soft HEAD~1`            YES              NO                     NO
                                (Points to C1)  (Keeps C2 staged)      (Untouched)

`git reset --mixed HEAD~1`           YES             YES                     NO
  (or default `git reset`)      (Points to C1)  (Matches C1)          (Changes on disk)

`git reset --hard HEAD~1`            YES             YES                    YES
                                (Points to C1)  (Matches C1)          (Wiped to match C1)
```

---

## 5. CLI Walkthrough: Demonstrating --soft, --mixed, and --hard Resets

A complete terminal comparison demonstrating all three reset modes:

```bash
# 1. Initialize playground repository
mkdir reset_lab && cd reset_lab
git init

# 2. Baseline commit C1
echo "Commit 1 Content" > file.txt
git add file.txt
git commit -m "feat: commit C1"

# 3. Create commit C2
echo "Commit 2 Content" >> file.txt
git commit -am "feat: commit C2"

# 4. Demonstrate --soft reset (Uncommit, keep changes staged)
git reset --soft HEAD~1
git status -s
# Output: M  file.txt (Green! Changes are staged in index!)
git log --oneline
# Shows only C1! Commit C2 was uncommitted, but changes are ready to re-commit!

# Re-commit C2 to prepare for next test
git commit -m "feat: commit C2 re-created"

# 5. Demonstrate --mixed reset (Default: Uncommit and unstage)
git reset --mixed HEAD~1
git status -s
# Output:  M file.txt (Red! Changes are unstaged in working tree!)

# Re-stage and re-commit C2 to test --hard
git commit -am "feat: commit C2 re-created again"

# 6. Demonstrate --hard reset (Wipe everything to target snapshot!)
git reset --hard HEAD~1
git status -s
# Output: Clean working tree!
cat file.txt
# Output: "Commit 1 Content" (Commit C2 content was completely wiped from disk!)
```

---

## 6. Comparing git reset --soft vs --mixed vs --hard vs git restore

| Operation | HEAD Target | Staging Area (Index) | Working Tree (Disk) | Data Loss Risk |
|---|---|---|---|---|
| `git reset --soft` | Moves pointer | Retains staged edits | Untouched | Zero risk |
| `git reset --mixed` | Moves pointer | Resets to target commit | Retains disk edits | Zero risk |
| `git reset --hard` | Moves pointer | Resets to target commit | Overwrites tracked files | **High risk** |
| `git restore <file>` | Unchanged | Unchanged | Overwrites unstaged file | Medium (File specific) |
| `git restore --staged`| Unchanged | Resets staged file | Untouched | Zero risk |

---

## 7. Common Mistakes

- **Running `git reset --hard` with uncommitted working tree edits.** Git will overwrite dirty working tree files without saving them anywhere (not even in reflog!).
- **Using `git reset` on public, pushed commits.** If you reset and force-push a shared branch, you break the repositories of all collaborators.
- **Forgetting that `git reset` defaults to `--mixed`.** Omitting flags defaults to `--mixed`, which unstages all your staged files.
- **Thinking `git reset --hard` deletes untracked files.** `--hard` only overwrites tracked files; untracked files remain until deleted with `git clean`.
- **Assuming reset commits are permanently deleted.** Commits undone via reset still live in the object database and can be rescued via `git reflog` for 30–90 days!

---

## 8. Hands-On Exercises

**Exercise 1:** Make 2 commits, perform `git reset --soft HEAD~2`, and bundle all changes into a single atomic commit.

**Exercise 2:** Make a commit, run `git reset --mixed HEAD~1`, and stage individual lines interactively using `git add -p`.

**Exercise 3:** Create a dirty workspace with staged and unstaged edits, and demonstrate how `git reset --hard HEAD` discards tracked modifications.

**Exercise 4:** Inspect the reflog after a reset using `git reflog` to identify the SHA of the uncommitted commit.

**Exercise 5:** Restore your branch pointer back to the pre-reset commit using `git reset --hard HEAD@{1}`.

---

## 9. Interview Q&A

**Q: What is the primary difference between `git reset --soft`, `--mixed`, and `--hard`?**
- `--soft` moves `HEAD` to the target commit but leaves the Index and Working Tree untouched (changes remain staged).
- `--mixed` (the default) moves `HEAD` and resets the Index to match the target commit, but leaves the Working Tree untouched (changes become unstaged).
- `--hard` moves `HEAD`, resets the Index, and overwrites the Working Tree to match the target commit, discarding all uncommitted tracked modifications.

**Q: Can you recover commits after running `git reset --hard HEAD~1`?**
Yes. Running `git reset --hard` moves the branch pointer, but the commit object remains intact in `.git/objects/` until garbage collected. You can find its SHA hash using `git reflog` and restore it by running `git reset --hard <sha>`.

**Q: Can you recover uncommitted working directory edits after running `git reset --hard`?**
No. Uncommitted modifications in the working tree that were never staged or committed were never written into the Git object store. When `--hard` overwrites them with the target commit snapshot, those uncommitted edits are permanently and irrecoverably lost.

**Q: What is the difference between `git reset` and `git revert`?**
`git reset` moves the branch pointer backwards in time, rewriting history (dangerous on public branches). `git revert` creates a new forward-moving commit that applies the inverse diff of the targeted commit, preserving existing history (safe on public branches).

**Q: Why is `git reset --soft HEAD~1` a popular technique for squashing the latest commit?**
Because `--soft` undoes the commit wrapper while leaving the exact code changes staged in the Index. A developer can then modify the staging area or simply run `git commit -m "new combined message"` to create a consolidated commit.
