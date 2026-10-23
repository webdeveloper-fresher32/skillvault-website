# Project 3: Disaster Recovery, Reflog Rescue, and Automated Regression Hunting with Bisect

## Goal

Construct a high-stakes DevOps emergency triage simulator: rescue a repository from catastrophic data loss caused by accidental `git reset --hard` and deleted branch tips using `git reflog` and `git fsck`, and subsequently automate the isolation of an elusive runtime regression across an 80-commit history using `git bisect run`.

## What You'll Build

A complete emergency triage and forensic recovery toolkit:
1. Disaster simulation script creating accidental hard resets, dropped stashes, deleted unpushed branches, and dangling commit trees.
2. Forensic recovery workflow recovering 100% of deleted unpushed code using `.git/logs/` (Reflog) and blob recovery via `git fsck --lost-found`.
3. Automated regression generator injecting a subtle math calculation error into commit #42 of an 80-commit repository history.
4. Automated binary search runner (`git bisect run ./test.sh`) executing a unit-test script that pinpoints the culprit commit SHA in under 10 seconds.
5. Post-mortem disaster recovery runbook and best-practice safety checklist for engineering teams.

## Phases Required

- Phase 01: Git Core Architecture and Plumbing
- Phase 06: Undoing Changes and Disaster Recovery
- Phase 07: Stashing, Cherry-Picking, and Searching
- Phase 08: Remotes, Syncing, and Network Protocols

## Requirements

### Core Functionality
- **Catastrophic Loss Simulation**: Script that commits critical code on a feature branch, switches to `main`, forcefully deletes the branch (`git branch -D`), drops a stash, and runs `git reset --hard HEAD~5`.
- **Reflog Resurrect**: Locate the orphaned commit SHAs in `git reflog` and restore the deleted branch tip to a live reference (`git switch -c rescued-feature <SHA>`).
- **Dangling Blob Archaeology**: Use `git fsck --unreachable` and `git cat-file -p` to recover an unreferenced blob from an accidentally cleared stash.
- **Bisect Regression Hunt**: Construct an automated test script and run `git bisect run` across 80 commits to isolate the exact commit introducing a runtime math failure.
- **Safe Revert Execution**: Revert the identified culprit commit on `main` using `git revert` without rewriting public history.

### Architecture Specifications
```text
Disaster State (Orphaned / Dangling Objects):
  (Commit 1) ──▶ (Commit 2) ──▶ (Commit 3: HEAD on main after reset --hard HEAD~2)
                                       │
      [Dangling Commit 4] ◀────────────┼── [Dangling Commit 5: Deleted Feature Branch]
      [Dangling Commit 6] ◀────────────┘
                                       │
                                       ▼ (Reflog Forensic Scan)
                       `git reflog show HEAD` ──▶ Found SHA `8a192fc`!
                                       │
                                       ▼ (Resurrect Branch)
                       `git switch -c restored-feature 8a192fc`
                                       │
                                       ▼ (Automated Bisect Hunt)
                       `git bisect run ./test_suite.sh` ──▶ Culprit `6b2190f` Found!
                                       │
                                       ▼
                       `git revert 6b2190f` ──▶ Production Restored!
```

## Suggested Approach

1. **Phase 1: Disaster Simulation Script**
   - Initialize repository and make 5 baseline commits.
   - Create branch `critical-feature`, add 3 commits containing valuable intellectual property.
   - Switch to `main` and execute `git branch -D critical-feature`.
   - Run `git reset --hard HEAD~3` on `main`.

2. **Phase 2: Forensic Reflog Recovery**
   - Execute `git reflog -n 20` to inspect the chronological reference journal.
   - Identify the commit SHA of `critical-feature` just prior to branch deletion.
   - Restore the branch using `git switch -c recovered-feature <sha>`.
   - Identify the previous tip of `main` before the hard reset and restore `main` using `git reset --hard HEAD@{N}`.

3. **Phase 3: Dangling Blob Inspection with `git fsck`**
   - Create a stash and run `git stash clear`.
   - Run `git fsck --unreachable | grep commit` to find dangling commit objects.
   - Inspect blobs with `git cat-file -p <blob_hash>` and restore lost files to disk.

4. **Phase 4: Automated Bisect Regression Hunt**
   - Generate an 80-commit repo with a function `computeInvoice(items)` where commit #42 introduces an off-by-one error.
   - Write `/tmp/test_invoice.sh` that evaluates `node -e "..."` and exits `0` on success, `1` on failure.
   - Launch `git bisect start HEAD v1.0` and `git bisect run /tmp/test_invoice.sh`.
   - Verify that Git flags commit #42 as the first bad commit.
   - Apply `git revert <culprit_sha>` on `main` to fix production safely.

## Stretch Goals

- Simulate a bisect run where intermediate commits fail to compile, handling them with exit code `125` (`git bisect skip`).
- Use `git log -S` (Pickaxe) to verify the regression commit independently from the bisect run.
- Author an automated Bash alias `git undo` that rewinds the last accidental command using the Reflog.

## Evaluation Checklist

- [ ] Deleted unpushed feature branch is 100% recovered using commit SHA from `git reflog`.
- [ ] Rewound branch pointer is restored to its pre-reset state without data loss.
- [ ] Dangling objects from cleared stashes are identified and inspected via `git fsck` and `git cat-file`.
- [ ] Automated bisect script terminates in under 10 seconds and identifies the exact culprit commit.
- [ ] The identified bug is reverted using a clean, forward-moving `git revert` commit.
