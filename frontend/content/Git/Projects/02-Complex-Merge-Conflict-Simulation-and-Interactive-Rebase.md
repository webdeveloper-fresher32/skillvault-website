# Project 2: Complex Merge Conflict Simulation and Interactive Rebase Mastery

## Goal

Simulate an intricate multi-developer merge conflict collision involving overlapping file edits, renamed files, and divergent branch topologies: resolve conflicts methodically using modern 3-way diff inspection tools and `git rerere`, clean messy feature commit histories using advanced interactive rebase (`git rebase -i`), and verify zero code regression.

## What You'll Build

A comprehensive conflict resolution and history restructuring laboratory:
1. Automated simulation script generating real-world multi-file conflict scenarios across two divergent developer branches.
2. Conflict resolution protocol utilizing 3-way merge marker analysis (`diff3` / `zdiff3`) and merge tools.
3. Reuse Recorded Resolution (`git rerere`) configuration that automatically resolves repeating rebase conflicts.
4. Interactive rebase runbook consolidating 12 messy experimental commits into 3 pristine Conventional Commits using `squash`, `reword`, `edit`, and `drop`.
5. Pre-merge and post-rebase verification test script ensuring 100% syntactic and semantic integrity.

## Phases Required

- Phase 04: Merging and Conflict Resolution
- Phase 05: Rebasing and History Rewriting
- Phase 06: Undoing Changes and Disaster Recovery
- Phase 07: Stashing, Cherry-Picking, and Searching

## Requirements

### Core Functionality
- **Conflict Scenario Generator**: Script creating simultaneous modifications to the same functions in a core service file along with a conflicting file rename.
- **`zdiff3` Inspection**: Configure `merge.conflictStyle zdiff3` to expose the Common Base ancestor in conflict markers.
- **Rerere Engine**: Enable `rerere.enabled true` and demonstrate Git auto-resolving a previously resolved conflict during a multi-step rebase.
- **Interactive Rebase Clean-Up**: Transform a dirty commit log containing `"fix typo"`, `"wip test"`, and `"broken commit"` into a clean atomic history.
- **Conflict Abort & Resume**: Demonstrate safe conflict recovery with `git rebase --abort`, `git rebase --skip`, and `git rebase --continue`.

### Architecture Specifications
```text
Divergent History with Conflicting Edits:
                [Commit B1: Modify Handler] ──▶ [Commit B2: Rename Config] (feature)
               /
[Common Base C0]
               \
                [Commit A1: Modify Handler] ──▶ [Commit A2: Edit Config] (main)
                               │
                               ▼ `git rebase main` (Triggers Overlapping Conflicts!)
               ┌──────────────────────────────────────────────┐
               │ 1. `zdiff3` Marker Inspection (Base + Both)  │
               │ 2. Human Resolution & Staging (`git add`)    │
               │ 3. `git rerere` Records Resolution Signature │
               │ 4. `git rebase -i` Cleans History Chain      │
               └──────────────────────────────────────────────┘
                               │
                               ▼
[Clean Linear Chain: C0 ──▶ A1 ──▶ A2 ──▶ B1' ──▶ B2']
```

## Suggested Approach

1. **Phase 1: Conflict Generation Lab**
   - Create a test repository with a core mathematical algorithm and JSON config.
   - Create branch `alpha` and modify line 15 while adding a new parameter.
   - Switch to branch `beta` and modify line 15 differently while refactoring variable names.

2. **Phase 2: Conflict Analysis with `zdiff3`**
   - Configure `git config merge.conflictStyle zdiff3`.
   - Attempt `git merge alpha` into `beta` and inspect the three-way markers (`<<<<<<<`, `||||||| base`, `=======`, `>>>>>>>`).
   - Resolve conflict, verify functionality with a unit test, and commit.

3. **Phase 3: Rerere Automation**
   - Enable `git config rerere.enabled true` and `git config rerere.autoupdate true`.
   - Reset the branch and perform an interactive rebase (`git rebase main`).
   - Observe Git automatically reusing the previously recorded conflict resolution!

4. **Phase 4: Interactive Rebase Surgery**
   - Create 6 messy commits: 2 WIP saves, 1 typo fix, 1 debug console log, 2 real features.
   - Run `git rebase -i HEAD~6`.
   - Re-order commits, `squash` typo fixes into parent features, `drop` debug logs, and `reword` messages to Conventional Commits.

## Stretch Goals

- Simulate a conflict arising from a file renamed on Branch A and edited on Branch B, resolving with `git mergetool`.
- Use `git bisect` after rebasing to ensure no logic regression was introduced during conflict resolution.
- Configure custom external 3-way diff tool (VS Code or Meld) via `.gitconfig`.

## Evaluation Checklist

- [ ] `merge.conflictStyle zdiff3` correctly reveals the common ancestor baseline in conflict markers.
- [ ] Conflicting function signatures are correctly reconciled without deleting features.
- [ ] `git rerere` successfully caches and auto-applies resolutions across repeated rebases.
- [ ] Interactive rebase successfully consolidates messy WIP commits into clean atomic commits.
- [ ] Post-rebase test suite executes with 100% pass rate.
