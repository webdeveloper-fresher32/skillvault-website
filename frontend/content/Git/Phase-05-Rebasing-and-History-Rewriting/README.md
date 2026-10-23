# Phase 5: Rebasing and History Rewriting

## What You'll Learn

Master linear history curation and Git's commit rewriting engine: rebase branches onto upstream bases, execute interactive rebasing (`git rebase -i`) to squash, fixup, reword, edit, and reorder commits, understand commit SHA hashing implications, and enforce the Golden Rule of Rebasing using safe force-push protocols (`git push --force-with-lease`).

## Learning Objectives

- Explain the mechanical process of patch serialization and replaying during `git rebase`.
- Clean up messy local commit histories using interactive rebase commands (`pick`, `squash`, `fixup`, `edit`, `drop`).
- Articulate the Golden Rule of Rebasing and why rewriting shared public history corrupts team clones.
- Safely update remote branch tips after rebasing using `git push --force-with-lease` rather than destructive `--force`.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Linear-History-and-Rebase-Mechanics.md](01-Linear-History-and-Rebase-Mechanics.md) | Patch replay algorithm, upstream divergence, linear history vs merge bubbles | 1 day |
| [02-Interactive-Rebase-Squash-Edit-Drop.md](02-Interactive-Rebase-Squash-Edit-Drop.md) | Interactive rebase (`-i`), `squash`, `fixup`, `reword`, `edit`, `drop`, `exec` | 1 day |
| [03-The-Golden-Rule-of-Rebasing.md](03-The-Golden-Rule-of-Rebasing.md) | The Golden Rule, public vs private history, `--force-with-lease` vs `--force` | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 6: Undoing Changes and Disaster Recovery](../Phase-06-Undoing-Changes-and-Disaster-Recovery/README.md)
