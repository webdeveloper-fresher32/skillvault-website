# Phase 7: Stashing, Cherry-Picking, and Searching

## What You'll Learn

Master temporary workspace state caching, surgical commit transplantation, and binary search bug hunting: manipulate the Git Stash stack (`git stash push -p`, `pop`, `apply`, `branch`), cherry-pick individual commits across branches (`git cherry-pick`), manage patch files with `git format-patch` and `git am`, and isolate regression bugs rapidly using automated binary search with `git bisect` and code search via `git log -S` (Pickaxe).

## Learning Objectives

- Manage the stash stack, stash untracked files (`-u`), and interactively stash patches (`-p`).
- Port specific bug fixes or features surgically across branches using `git cherry-pick`.
- Create and apply portability email patches using `git format-patch` and `git am`.
- Isolate the exact commit introducing a bug in logarithmically few steps using `git bisect run <script>`.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Git-Stash-Lifecycle-and-Patch-Stashing.md](01-Git-Stash-Lifecycle-and-Patch-Stashing.md) | Stash stack, `push -u`, interactive stash `push -p`, `pop` vs `apply`, stash to branch | 1 day |
| [02-Cherry-Picking-and-Patch-Management.md](02-Cherry-Picking-and-Patch-Management.md) | `git cherry-pick`, cherry-picking ranges, `git format-patch` and `git am` | 1 day |
| [03-Git-Bisect-and-Log-Grep-Debugging.md](03-Git-Bisect-and-Log-Grep-Debugging.md) | Binary search bug hunting with `git bisect`, automated testing, `git log -S` / `-G` | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 8: Remotes, Syncing, and Network Protocols](../Phase-08-Remotes-Syncing-and-Network-Protocols/README.md)
