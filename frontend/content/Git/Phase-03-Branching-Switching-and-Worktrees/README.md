# Phase 3: Branching, Switching, and Worktrees

## What You'll Learn

Master Git's lightweight branch pointer architecture, the modern `git switch` and `git restore` CLI primitives (disambiguating the legacy overloaded `git checkout`), and isolate multi-branch parallel development environments using high-performance `git worktree` workspaces without context switching.

## Learning Objectives

- Explain how Git branches operate as 41-byte text pointer files in `.git/refs/heads/`.
- Disambiguate branch switching from file restoring using modern `git switch` and `git restore`.
- Diagnose, manage, and safely recover from Detached HEAD states.
- Create and manage isolated concurrent filesystem worktrees using `git worktree add`.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Branch-Pointers-and-HEAD-References.md](01-Branch-Pointers-and-HEAD-References.md) | Branch pointers in `.git/refs/heads/`, symbolic `HEAD`, detached HEAD mechanics | 1 day |
| [02-Modern-Branch-Switching-Switch-vs-Checkout.md](02-Modern-Branch-Switching-Switch-vs-Checkout.md) | Modern `git switch`, `git switch -c`, legacy `git checkout` disambiguation | 1 day |
| [03-Git-Worktrees-for-Multi-Branch-Multitasking.md](03-Git-Worktrees-for-Multi-Branch-Multitasking.md) | Concurrent branch execution with `git worktree`, directory isolation, locking | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 4: Merging and Conflict Resolution](../Phase-04-Merging-and-Conflict-Resolution/README.md)
