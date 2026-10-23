# Modern Branch Switching (switch vs checkout) — Complete Guide

> "A multi-tool pocket knife with 20 blades can cut wood, open wine bottles, and turn screws, but using a dedicated chef's knife in the kitchen prevents you from accidentally opening the saw blade and slicing your fingers."

---

## Table of Contents

1. [The Problem: The Overloaded git checkout Command Caused Costly Mistakes](#1-the-problem-the-overloaded-git-checkout-command-caused-costly-mistakes)
2. [The Swiss Army Knife vs Dedicated Cutlery Analogy](#2-the-swiss-army-knife-vs-dedicated-cutlery-analogy)
3. [The Mechanism: The Git 2.23 Split into switch and restore](#3-the-mechanism-the-git-223-split-into-switch-and-restore)
4. [Diagram: Command Responsibility Architecture](#4-diagram-command-responsibility-architecture)
5. [CLI Walkthrough: Mastering git switch and Orphan Branch Management](#5-cli-walkthrough-mastering-git-switch-and-orphan-branch-management)
6. [Comparing git switch vs git checkout vs git restore](#6-comparing-git-switch-vs-git-checkout-vs-git-restore)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Overloaded git checkout Command Caused Costly Mistakes

Prior to Git version 2.23, the single command `git checkout` was responsible for two completely orthogonal and dangerous operations: switching branches AND discarding uncommitted file edits.

### The Ambiguity Trap

```text
Intended Action: Switch to a branch named `release`
Command Typed:   `git checkout release`
Scenario:        If a file named `release` existed on disk, Git silently discarded uncommitted edits to `release` instead of switching branches!
Result:          Irrecoverable loss of developer work!
```

### The Solution: The Modern `switch` and `restore` Split

In Git 2.23+, Git split `git checkout` into two dedicated, unambiguous commands:
1. **`git switch`**: Operates strictly on **branches and HEAD**.
2. **`git restore`**: Operates strictly on **file contents and index**.

---

## 2. The Swiss Army Knife vs Dedicated Cutlery Analogy

A professional chef does not use a 15-blade multi-tool pocket knife to fillet a delicate fish.

### Overloaded Multi-Tool vs Precision Knives

```text
Overloaded Knife (git checkout) → One handle holds scissors, corkscrew, saw, and fish scaler;
                                  accidentally opening the saw when reaching for scissors cuts the rope.

Dedicated Knives (switch/restore)→ Chef knife (git switch): Strictly for slicing whole roasts (branches).
                                  Paring knife (git restore): Strictly for peeling individual grapes (files).
```

### Mapping to Git Architecture

`git switch` navigates between branch commits; `git restore` resets working files without any risk of branch confusion.

---

## 3. The Mechanism: The Git 2.23 Split into switch and restore

Understanding modern branch switching requires learning `git switch` flags:

### Common `git switch` Operations

- **`git switch <branch>`**: Switches `HEAD` to an existing local branch.
- **`git switch -c <branch>`**: Creates a new branch and switches to it in one step (replaces `git checkout -b`).
- **`git switch -C <branch>`**: Force-creates/resets a branch to current HEAD and switches to it.
- **`git switch -c <branch> <start-point>`**: Creates and switches to a new branch starting from a specific commit/tag.
- **`git switch -`**: Switches back to the previous active branch (like `cd -`).
- **`git switch --detach <commit_hash>`**: Explicitly enters detached HEAD state without ambiguity.
- **`git switch --orphan <branch>`**: Creates an empty root branch with no commit history (used for documentation or clean repo restarts).
- **`git switch --guess <remote_branch>`**: Automatically tracks remote branches when creating local references.

---

## 4. Diagram: Command Responsibility Architecture

### Deconstructing the Legacy `git checkout`

```text
                  Legacy Overloaded Command: `git checkout`
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
[Branch & HEAD Operations]                           [File & Index Operations]
         │                                                   │
         ▼                                                   ▼
Modern Dedicated Command:                            Modern Dedicated Command:
     `git switch`                                        `git restore`
  ├── `git switch main`                               ├── `git restore app.py`
  ├── `git switch -c feature`                         ├── `git restore --staged app.py`
  └── `git switch -`                                  └── `git restore --source=HEAD~1 app.py`
```

---

## 5. CLI Walkthrough: Mastering git switch and Orphan Branch Management

A complete terminal walkthrough practicing modern branch workflows:

```bash
# 1. Initialize playground repository
mkdir switch_lab && cd switch_lab
git init

# 2. Create initial baseline commit
echo "Production Core" > main.txt
git add main.txt
git commit -m "feat: initial commit"

# 3. Create and switch to a feature branch using -c
git switch -c feature-billing
echo "Stripe Billing" > billing.txt
git add billing.txt
git commit -m "feat: add stripe billing"

# 4. Toggle back and forth between branches using '-'
git switch -
# Output: Switched to branch 'main'

git switch -
# Output: Switched to branch 'feature-billing'

# 5. Create a branch based off a specific historical commit
git switch -c hotfix-patch HEAD~1
# Created hotfix-patch pointing to the initial commit!

# 6. Create an orphan branch with zero commit history
git switch --orphan gh-pages
# Working tree has files, but git status shows ALL files as uncommitted new root!
git rm -rf .
echo "# Project Documentation" > index.html
git add index.html
git commit -m "docs: initialize documentation site"
# gh-pages has its own independent root commit DAG!

# 7. Switch back to main cleanly
git switch main
```

---

## 6. Comparing git switch vs git checkout vs git restore

| Operation | Modern Git (Recommended) | Legacy Git (Discouraged) | Risk Level |
|---|---|---|---|
| Switch Branch | `git switch <branch>` | `git checkout <branch>` | Safe |
| Create + Switch Branch | `git switch -c <branch>` | `git checkout -b <branch>` | Safe |
| Discard Unstaged File Edits | `git restore <file>` | `git checkout -- <file>` | High (Overwrites work) |
| Unstage a Staged File | `git restore --staged <file>` | `git reset HEAD <file>` | Safe |
| Toggle Previous Branch | `git switch -` | `git checkout -` | Safe |
| Force Reset & Switch | `git switch -C <branch>` | `git checkout -B <branch>` | Medium |
| Detach at Specific Commit | `git switch --detach <hash>` | `git checkout <hash>` | Warning emitted |

---

## 7. Common Mistakes

- **Using `git checkout <file>` out of muscle memory.** Running `git checkout name` when `name` is both a branch and a file can overwrite the file.
- **Forgetting that `git restore <file>` permanently deletes unstaged work.** There is no undo command for discarded unstaged modifications.
- **Assuming `git switch -c` copies uncommitted changes safely.** If working tree edits conflict with the target branch's files, Git aborts the switch; you must stash first.
- **Creating orphan branches accidentally.** Running `git switch --orphan` without understanding that it severs parent commit ancestry.
- **Confusing `git restore --staged` with `git restore`.** `git restore --staged` unstages changes; omitting `--staged` wipes the edits from your working disk entirely!

---

## 8. Hands-On Exercises

**Exercise 1:** Use `git switch -c` to create a feature branch, make a commit, and use `git switch -` to toggle back to main.

**Exercise 2:** Create an orphan branch named `docs-root` using `git switch --orphan` and verify with `git log` that it has no parent commits.

**Exercise 3:** Modify a file, stage it, unstage it with `git restore --staged`, and then discard the working tree changes with `git restore`.

**Exercise 4:** Explicitly detach HEAD at an earlier commit using `git switch --detach HEAD~1`.

**Exercise 5:** Configure a shell alias `alias gsw='git switch'` and `alias gswc='git switch -c'`.

---

## 9. Interview Q&A

**Q: Why was `git switch` introduced in Git 2.23 as a replacement for `git checkout`?**
`git checkout` was heavily overloaded—it was used both for switching branches (`git checkout <branch>`) and for discarding uncommitted file modifications (`git checkout <file>`). This syntax collision created severe risks where a typo could permanently discard uncommitted files instead of switching branches. `git switch` and `git restore` separated these concerns cleanly.

**Q: What does `git switch -` do?**
`git switch -` switches `HEAD` back to the previously checked-out branch (analogous to `cd -` in UNIX shells), reading the previous branch location from `.git/logs/HEAD`.

**Q: How does `git switch --orphan <branch-name>` work and when is it used?**
`git switch --orphan` creates a new branch pointer whose first commit will have zero parent commits, starting a completely disconnected root in the commit DAG. It is commonly used for hosting separate documentation trees (like GitHub Pages `gh-pages` branches) or maintaining clean release tracks.

**Q: What happens if you run `git switch target-branch` while having uncommitted working tree changes?**
If the uncommitted working tree modifications do not overlap with files that differ between the current branch and `target-branch`, Git carries the uncommitted changes over to `target-branch`. If an overlapping file would be overwritten by the switch, Git aborts the operation with an error, preventing data loss and prompting the developer to commit or stash changes first.

**Q: What is the exact difference between `git restore <file>` and `git restore --staged <file>`?**
`git restore <file>` copies the file's content from the **Index** to the **Working Tree**, discarding any unstaged edits on disk. `git restore --staged <file>` copies the file's state from **HEAD** to the **Index**, unstaging the file while leaving the working directory modifications intact on disk.
