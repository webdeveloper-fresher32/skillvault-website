# Phase 6: Undoing Changes and Disaster Recovery

## What You'll Learn

Master undo operations and repository disaster recovery: safely discard or restore uncommitted modifications using `git restore` and `git clean`, dissect the mechanics of `git reset` across `--soft`, `--mixed`, and `--hard` modes, invert published commits using `git revert`, and leverage the Git Reflog (`git reflog`) to resurrect deleted branches, lost commits, and botched rebases.

## Learning Objectives

- Discard and unstage uncommitted working directory edits safely with modern `git restore` and `git clean`.
- Compare how `git reset --soft`, `--mixed`, and `--hard` alter the Three Trees (Working Tree, Index, HEAD).
- Invert production commits safely without rewriting public branch history using `git revert`.
- Recover "lost" dangling commits, resurrected deleted branches, and aborted rebases using `git reflog`.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Restoring-and-Discarding-Uncommitted-Work.md](01-Restoring-and-Discarding-Uncommitted-Work.md) | `git restore`, `git restore --staged`, untracked cleanup with `git clean -fd` | 1 day |
| [02-Reset-Deep-Dive-Soft-Mixed-Hard.md](02-Reset-Deep-Dive-Soft-Mixed-Hard.md) | `git reset` modes (`--soft`, `--mixed`, `--hard`), Three Trees mutation table | 1 day |
| [03-Revert-Reflog-and-Commit-Rescue.md](03-Revert-Reflog-and-Commit-Rescue.md) | `git revert`, merge reverts (`-m 1`), Reflog forensics, rescuing lost commits | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 7: Stashing, Cherry-Picking, and Searching](../Phase-07-Stashing-Cherry-Picking-and-Searching/README.md)
