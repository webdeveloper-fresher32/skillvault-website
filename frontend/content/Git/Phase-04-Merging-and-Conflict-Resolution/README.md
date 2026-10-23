# Phase 4: Merging and Conflict Resolution

## What You'll Learn

Master Git's merge engines and conflict resolution strategies: compare Fast-Forward merges against true 3-way merges (`recursive` and `ort` strategies), deconstruct raw conflict marker syntax (`<<<<<<<`, `=======`, `>>>>>>>`), apply strategic resolutions with `--ours` and `--theirs`, and automate recurring conflict resolution using Git's `rerere` (Reuse Recorded Resolution) cache.

## Learning Objectives

- Distinguish Fast-Forward pointer advancement from true 3-way merge commits and when to enforce `--no-ff`.
- Analyze merge base ancestors and resolve overlapping conflicting file modifications systematically.
- Resolve multi-file conflicts efficiently using checkout strategy flags (`--ours`, `--theirs`).
- Enable and leverage Git's recorded resolution engine (`git rerere`) to automate repeated rebase/merge conflict handling.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Fast-Forward-vs-Three-Way-Merge.md](01-Fast-Forward-vs-Three-Way-Merge.md) | Fast-Forward merges, 3-way merge commits, merge base ancestors, `--no-ff` flag | 1 day |
| [02-Merge-Conflicts-and-Marker-Anatomy.md](02-Merge-Conflicts-and-Marker-Anatomy.md) | Conflict marker syntax, 3-way base diffs, resolving overlapping changes cleanly | 1 day |
| [03-Advanced-Conflict-Resolution-and-Rerere.md](03-Advanced-Conflict-Resolution-and-Rerere.md) | `--ours` / `--theirs`, aborting merges, recorded resolution cache (`git rerere`) | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 5: Rebasing and History Rewriting](../Phase-05-Rebasing-and-History-Rewriting/README.md)
