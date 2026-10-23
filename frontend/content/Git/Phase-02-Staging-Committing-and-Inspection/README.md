# Phase 2: Staging, Committing, and Inspection

## What You'll Learn

Master professional Git staging, commit hygiene, and history inspection: author clean atomic commits with Conventional Commits specifications, interactively stage hunks using `git add -p`, analyze uncommitted and staged modifications with `git diff`, configure `.gitignore` patterns, and visualize project topology using `git log` and `git blame`.

## Learning Objectives

- Apply atomic commit principles and the Conventional Commits standard (`feat:`, `fix:`, `chore:`).
- Interactively stage fine-grained diff hunks within modified files using `git add -p` and `-e`.
- Inspect differences across Working Tree, Index, and HEAD using `git diff`, `--staged`, and `--stat`.
- Trace code authorship and bug origin lines using `git log`, `git show`, and `git blame`.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Atomic-Commits-and-Conventional-Commits.md](01-Atomic-Commits-and-Conventional-Commits.md) | Atomic commit philosophy, Conventional Commits, interactive hunk staging (`git add -p`) | 1 day |
| [02-Diff-Inspection-and-Status-Telemetry.md](02-Diff-Inspection-and-Status-Telemetry.md) | `git diff`, `git diff --staged`, word diffs, `.gitignore` rules and pattern matching | 1 day |
| [03-History-Visualization-and-Blame.md](03-History-Visualization-and-Blame.md) | Custom `git log` formats, graph topologies, `git show`, line-by-line `git blame` forensics | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 3: Branching, Switching, and Worktrees](../Phase-03-Branching-Switching-and-Worktrees/README.md)
