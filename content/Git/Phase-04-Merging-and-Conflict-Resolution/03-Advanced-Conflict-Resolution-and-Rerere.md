# Advanced Conflict Resolution and Rerere — Complete Guide

> "A master chess grandmaster memorizes the exact winning moves for classic endgame piece configurations so they never have to recalculate the same difficult tactical sequence twice."

---

## Table of Contents

1. [The Problem: Resolving the Same Merge Conflict 15 Times During Long Rebases](#1-the-problem-resolving-the-same-merge-conflict-15-times-during-long-rebases)
2. [The Grandmaster's Endgame Memory Analogy](#2-the-grandmasters-endgame-memory-analogy)
3. [The Mechanism: Git rerere (Reuse Recorded Resolution) Architecture](#3-the-mechanism-git-rerere-reuse-recorded-resolution-architecture)
4. [Diagram: The git rerere Record and Replay Lifecycle](#4-diagram-the-git-rerere-record-and-replay-lifecycle)
5. [CLI Walkthrough: Enabling rerere and Auto-Resolving Repeated Conflicts](#5-cli-walkthrough-enabling-rerere-and-auto-resolving-repeated-conflicts)
6. [Comparing Manual Conflict Resolution vs git rerere Automation](#6-comparing-manual-conflict-resolution-vs-git-rerere-automation)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Resolving the Same Merge Conflict 15 Times During Long Rebases

When maintaining a long-running feature branch that rebases frequently onto an evolving `main` branch, or when merging topic branches into multiple release candidates, developers repeatedly encounter and solve the exact same conflict over and over again.

### The Repetitive Conflict Tax

```text
Day 1: Rebase feature onto main ──▶ Resolve complex 40-line conflict in `config.js` (30 mins).
Day 2: Rebase feature onto main ──▶ Same 40-line conflict triggers again! (30 mins lost).
Day 3: Rebase feature onto main ──▶ Same conflict triggers AGAIN! (Developer burns out).
```

### The Solution: `git rerere` (Reuse Recorded Resolution)

Git includes a built-in resolution memory engine called `rerere` (Reuse Recorded Resolution). When enabled, Git takes a fingerprint of the pre-image conflict and records your post-image resolution in `.git/rr-cache/`. The next time the same conflict occurs, Git resolves it automatically!

---

## 2. The Grandmaster's Endgame Memory Analogy

A chess master does not spend 40 minutes calculating every pawn step for a classic King-and-Rook endgame.

### Recalculation vs Muscle Memory

```text
Novice Player   → Solves the same checkmate puzzle from scratch every single match (Exhausting, error-prone).
Chess Master    → Recognizes the board pattern, recalls the memorized winning sequence, and plays it in 1 second.
```

### Mapping to Git Architecture

The conflicting code pattern is the chess board position (pre-image); your clean resolution is the winning move (post-image); `git rerere` is the grandmaster's memory cache.

---

## 3. The Mechanism: Git rerere (Reuse Recorded Resolution) Architecture

When `rerere.enabled` is set to `true`, Git monitors conflict states:

### The rerere Resolution Pipeline

1. **Pre-Image Recording**: When a conflict occurs, Git hashes the conflicting hunk and saves the raw conflict state inside `.git/rr-cache/<hash>/preimage`.
2. **Post-Image Recording**: When you resolve the conflict and stage it (`git add`), Git records your resolution inside `.git/rr-cache/<hash>/postimage`.
3. **Auto-Replay**: During future merges or rebases, when Git encounters the identical pre-image conflict, it automatically applies the `postimage` resolution and stages the file!

---

## 4. Diagram: The git rerere Record and Replay Lifecycle

### rerere Cache Workflow

```text
Conflict Event 1 (First Time Encountered):
  1. Conflict occurs in `database.ts`
  2. Git hashes conflict ──▶ Creates `.git/rr-cache/4a9f.../preimage`
  3. Developer manually resolves code and runs `git add database.ts`
  4. Git records clean solution ──▶ Creates `.git/rr-cache/4a9f.../postimage`

Conflict Event 2 (Subsequent Rebase / Merge):
  1. Same conflict occurs in `database.ts`
  2. Git recognizes hash `4a9f...` in `.git/rr-cache/`
  3. Git terminal outputs: "Resolved 'database.ts' using previous resolution."
  4. File is automatically resolved without human intervention!
```

---

## 5. CLI Walkthrough: Enabling rerere and Auto-Resolving Repeated Conflicts

A practical demonstration configuring `rerere` and observing automated replay:

```bash
# 1. Initialize playground repository
mkdir rerere_lab && cd rerere_lab
git init

# 2. Enable rerere globally (or locally)
git config rerere.enabled true
git config rerere.autoupdate true # Automatically stage auto-resolved files!

# 3. Create baseline commit
cat << 'EOF' > settings.json
{
  "theme": "light",
  "port": 3000
}
EOF
git add settings.json
git commit -m "feat: initial settings"

# 4. Branch 1 modifies port to 8080
git switch -c branch-a
cat << 'EOF' > settings.json
{
  "theme": "light",
  "port": 8080
}
EOF
git commit -am "feat: update port to 8080"

# 5. Branch 2 modifies port to 9090
git switch main
git switch -c branch-b
cat << 'EOF' > settings.json
{
  "theme": "light",
  "port": 9090
}
EOF
git commit -am "feat: update port to 9090"

# 6. Merge branch-a into branch-b to trigger conflict
git merge branch-a
# Output: Recorded preimage for 'settings.json'

# 7. Manually resolve conflict (choose port 8080)
cat << 'EOF' > settings.json
{
  "theme": "light",
  "port": 8080
}
EOF
git add settings.json
git commit -m "Merge branch-a into branch-b"
# Output: Recorded resolution for 'settings.json'

# 8. Reset branch-b to test automated replay!
git reset --hard HEAD~1

# 9. Trigger the exact same merge AGAIN!
git merge branch-a
# Output:
# Auto-merging settings.json
# CONFLICT (content): Merge conflict in settings.json
# Resolved 'settings.json' using previous resolution.
# Automatic merge succeeded!

cat settings.json
# Output: Port is 8080! rerere automatically resolved the conflict!
```

---

## 6. Comparing Manual Conflict Resolution vs git rerere Automation

| Dimension | Manual Conflict Resolution | `git rerere` Automated Replay |
|---|---|---|
| Repetitive Rebases | Developer manually resolves on every rebase step | Resolved in 1 millisecond automatically |
| Error Risk | High (Developer makes typos on repeat merges) | Zero (Replays identical verified patch) |
| Setup Required | Default Git behavior | Requires `git config rerere.enabled true` |
| Cache Storage | None | Saved in `.git/rr-cache/` |
| Team Sharing | Local to developer's machine | Can be shared by committing `.git/rr-cache/` |

---

## 7. Common Mistakes

- **Forgetting that `rerere` is disabled by default.** Unless you run `git config --global rerere.enabled true`, Git does not record any resolutions.
- **Not enabling `rerere.autoupdate`.** Without `autoupdate`, `rerere` resolves the working tree file but leaves it unstaged, requiring manual review before `git add`.
- **Recording an incorrect buggy resolution.** If you commit a broken conflict resolution, `rerere` will faithfully replay the broken code; clear bad entries with `git rerere forget <file>`.
- **Assuming `rerere` applies across dissimilar code.** `rerere` requires identical pre-image context; if surrounding code lines change substantially, `rerere` will not match.
- **Deleting `.git` when troubleshooting.** Deleting `.git` wipes the `.git/rr-cache/` directory containing all your recorded resolutions.

---

## 8. Hands-On Exercises

**Exercise 1:** Enable `rerere.enabled` and `rerere.autoupdate` in your global Git configuration.

**Exercise 2:** Create a merge conflict, resolve it, inspect the files generated in `.git/rr-cache/`, and trigger the conflict again to verify auto-replay.

**Exercise 3:** Intentionally record a bad resolution and purge it using `git rerere forget <file>`.

**Exercise 4:** Inspect the diff between a conflict's preimage and postimage using `git rerere diff`.

**Exercise 5:** Rebase a branch with 3 commits that touch the same conflicting file, and observe `rerere` resolving subsequent commits automatically.

---

## 9. Interview Q&A

**Q: What is `git rerere` and what does the acronym stand for?**
`git rerere` stands for **"Reuse Recorded Resolution"**. It is a Git feature that records how you resolved a merge conflict hunk (by fingerprinting the pre-image conflict and the post-image resolution). When the same conflict occurs in future merges or rebases, Git automatically applies the recorded resolution.

**Q: Where does Git store the recorded conflict resolutions?**
Git stores recorded resolutions inside the `.git/rr-cache/` directory. Each conflict is given a subdirectory named after the SHA-1 hash of its normalized pre-image text, containing the `preimage` and `postimage` diff files.

**Q: What is the benefit of setting `git config rerere.autoupdate true`?**
By default, when `rerere` automatically resolves a conflict, it updates the working tree file but leaves the file unstaged in the index for human review. Setting `rerere.autoupdate true` instructs Git to automatically stage (`git add`) the file if `rerere` was able to resolve all conflicts cleanly.

**Q: What should you do if you accidentally record an erroneous or broken conflict resolution in `rerere`?**
Run `git rerere forget <file>`. This command invalidates and purges the recorded pre-image and post-image entry from `.git/rr-cache/` for that specific file, allowing you to resolve the conflict correctly from scratch.

**Q: How does `git rerere` dramatically improve the developer experience during long interactive rebases?**
During an interactive rebase of a branch with many commits against an evolving upstream branch, the same conflict often re-appears across multiple replayed commits. With `rerere` enabled, the developer resolves the conflict on the first commit, and `rerere` automatically resolves it for all subsequent commits in the rebase sequence.
