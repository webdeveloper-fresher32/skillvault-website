# Interactive Rebase (Squash, Edit, Drop, and Reword) — Complete Guide

> "A film director edits raw daily video reels, trimming bloopers (drop), combining 10 short takes into one smooth sequence (squash), and adjusting color balance (edit) before submitting the final movie to the film festival."

---

## Table of Contents

1. [The Problem: Messy Working Commits Pollute Production History](#1-the-problem-messy-working-commits-pollute-production-history)
2. [The Film Director's Cutting Room Floor Analogy](#2-the-film-directors-cutting-room-floor-analogy)
3. [The Mechanism: The Interactive Rebase Todo List and Command Instructions](#3-the-mechanism-the-interactive-rebase-todo-list-and-command-instructions)
4. [Diagram: Interactive Rebase Execution Flow](#4-diagram-interactive-rebase-execution-flow)
5. [CLI Walkthrough: Squashing 5 Draft Commits into 1 Clean Semantic Feature](#5-cli-walkthrough-squashing-5-draft-commits-into-1-clean-semantic-feature)
6. [Comparing Interactive Rebase Commands](#6-comparing-interactive-rebase-commands)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Messy Working Commits Pollute Production History

During local development, developers naturally make messy micro-commits: `"fix typo"`, `"wip"`, `"forgot semicolon"`, `"trying fix 2"`, `"console log test"`. Pushing this raw churn to production makes code review unbearable and destroys release changelogs.

### The Messy Local Churn

```text
Raw Local History (Before PR):
  c9182aa feat: initial checkout UI
  5f910a1 fix typo in button
  3b2819c add console log
  1b08f44 remove console log
  8a192fc fix padding bug
→ 5 commits representing only 1 logical feature!
```

### The Solution: Interactive Rebasing (`git rebase -i`)

Interactive Rebase provides a scriptable text interface to rewrite, squash, reorder, edit, and drop commits prior to publishing your pull request.

---

## 2. The Film Director's Cutting Room Floor Analogy

A Hollywood movie is never released with 400 hours of unedited raw studio camera footage.

### Raw Studio Takes vs Cut Movie

```text
Raw Studio Footage → Actor stumbles on line; camera readjusts focus; 8 failed takes (Messy local churn).
Film Editing Suite  → Director cuts the 8 failed takes (drop), splices best dialogue into 1 scene (squash),
                      and sharpens audio (edit), outputting 1 polished master movie scene.
```

### Mapping to Git Architecture

The raw camera reels are your messy local commits; `git rebase -i` is the cutting room software; the final movie scene is the clean squashed commit.

---

## 3. The Mechanism: The Interactive Rebase Todo List and Command Instructions

When you run `git rebase -i HEAD~N` (or `git rebase -i <base>`), Git launches your editor with an actionable execution script:

### The 6 Core Interactive Rebase Verbs

- **`pick` (`p`)**: Use commit as-is (do not modify).
- **`reword` (`r`)**: Use commit contents, but pause to edit the commit message.
- **`edit` (`e`)**: Pause execution at this commit to amend code, split commits, or add files.
- **`squash` (`s`)**: Meld this commit into the previous commit and concatenate commit messages.
- **`fixup` (`f`)**: Meld this commit into the previous commit, **discarding** this commit's log message.
- **`drop` (`d`)**: Delete/discard this commit entirely from history.
- **`exec` (`x`)**: Run a shell command (e.g. `npm test`) between commit replays.

---

## 4. Diagram: Interactive Rebase Execution Flow

### Transforming Todo Script to New Commits

```text
Todo Script Editor:
  pick   c9182aa feat: initial checkout UI
  fixup  5f910a1 fix typo in button
  drop   3b2819c add console log
  fixup  8a192fc fix padding bug
                 │
                 ▼ (Git processes top-to-bottom)
┌─────────────────────────────────────────────────────────────┐
│ 1. Git picks c9182aa                                        │
│ 2. Git merges 5f910a1 into c9182aa (discards message)       │
│ 3. Git skips/drops 3b2819c entirely                         │
│ 4. Git merges 8a192fc into c9182aa (discards message)       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
Resulting Single Commit: `c9182aa'` ("feat: implement checkout UI")
```

---

## 5. CLI Walkthrough: Squashing 5 Draft Commits into 1 Clean Semantic Feature

A complete hands-on terminal exercise cleaning up messy commit history:

```bash
# 1. Initialize playground repository
mkdir squash_lab && cd squash_lab
git init

# 2. Baseline commit
echo "Base code" > app.js
git add app.js
git commit -m "feat: project setup"

# 3. Create 4 messy local development commits
echo "function checkout() {}" >> app.js
git commit -am "feat: add checkout"

echo "// typo fix" >> app.js
git commit -am "fix: typo in checkout"

echo "console.log('debugging');" >> app.js
git commit -am "chore: add debug logging"

echo "// proper tax logic" >> app.js
git commit -am "fix: add tax calculation"

# 4. View messy log before interactive rebase
git log --oneline -n 5

# 5. Launch interactive rebase for the last 4 commits
# Command: git rebase -i HEAD~4
# (In the editor, modify the lines as follows):
#
# pick a1b2c3d feat: add checkout
# fixup b2c3d4e fix: typo in checkout
# drop c3d4e5f chore: add debug logging
# fixup d4e5f6a fix: add tax calculation

# 6. Save and close editor. Git executes the script!
# Output:
# Successfully rebased and updated refs/heads/main.

# 7. Verify the pristine, squashed history!
git log --oneline
# Output shows only 2 clean, professional commits!
```

---

## 6. Comparing Interactive Rebase Commands

| Command Verb | Changes Code? | Prompts for Message Edit? | Keeps Commit History? |
|---|---|---|---|
| **`pick`** | No | No | Yes (Replays commit) |
| **`reword`** | No | Yes | Yes (New SHA, new message) |
| **`edit`** | Yes (Pauses shell) | Yes (`git commit --amend`) | Yes |
| **`squash`** | Combines with parent | Yes (Combines messages) | Melded into parent |
| **`fixup`** | Combines with parent | No (Discards message) | Melded into parent |
| **`drop`** | Discards changes | No | Completely deleted |

---

## 7. Common Mistakes

- **Reordering dependent commits.** Moving a commit that uses a function *before* the commit that declared it causes syntax build failures.
- **Squashing the very first line of the todo list.** The top commit has no prior commit in the script to squash into; line 1 must be `pick`, `reword`, or `edit`.
- **Forgetting to run `git rebase --continue` after an `edit`.** When Git pauses for `edit`, modify files, run `git commit --amend`, and then `git rebase --continue`.
- **Closing the editor with empty contents.** Saving an empty interactive rebase todo file causes Git to abort the rebase without making changes.
- **Interactive rebasing on public pushed branches.** Requires force-pushing, which breaks teammates' local clones if they branched off your old commits.

---

## 8. Hands-On Exercises

**Exercise 1:** Make 3 draft commits and use `git rebase -i HEAD~3` with `fixup` to squash them into 1 clean commit.

**Exercise 2:** Use the `reword` command to fix a typo in a commit message 3 commits back in history.

**Exercise 3:** Use the `edit` command to pause at an earlier commit, add a missing file, and continue the rebase.

**Exercise 4:** Use the `drop` command to remove an accidental debug commit from historical logs.

**Exercise 5:** Use `exec npm test` on each line of an interactive rebase todo list to verify every replayed commit passes tests.

---

## 9. Interview Q&A

**Q: What is `git rebase -i` (Interactive Rebase) and when should it be used?**
Interactive Rebase provides a scriptable text interface allowing developers to curate, rewrite, squash, reorder, edit, or drop local commits before publishing a pull request or merging into a shared branch. It is used to transform messy local development iterations into clean, atomic, semantic commits.

**Q: What is the difference between `squash` and `fixup` in an interactive rebase todo script?**
Both `squash` and `fixup` meld the current commit's code changes into the immediately preceding commit. However, `squash` opens the text editor prompting you to combine and edit the commit messages of both commits, whereas `fixup` automatically discards the squashed commit's message, keeping only the parent commit's message.

**Q: How does the `edit` verb work during an interactive rebase?**
When Git encounters an `edit` instruction, it replays the commit and then pauses execution, dropping you into the shell. You can make file edits, split the commit into multiple smaller commits using `git reset HEAD~`, amend the commit with `git commit --amend`, and finally resume the rebase by running `git rebase --continue`.

**Q: What is the `exec` instruction in an interactive rebase?**
`exec` (or `x`) allows you to specify a shell command to be executed after each replayed commit. For example, inserting `exec npm test` after every commit ensures that every single commit in the rewritten history compiles and passes unit tests.

**Q: If you make a mistake while editing the interactive rebase todo list in your text editor, how do you abort without applying changes?**
Delete all text lines in the editor (leaving the file completely blank) or close the editor with an exit code error (e.g. `:cq` in Vim). Git detects the empty file and immediately aborts the rebase without altering repository history.
