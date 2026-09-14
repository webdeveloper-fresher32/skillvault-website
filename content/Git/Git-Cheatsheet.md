# Git & GitHub Mastery — Quick Reference Cheatsheet

> "Dense, instant-reference command and architecture index organized by operational domain, plumbing internals, and enterprise workflows."

---

## Complete Course Navigation

- **Master Course Overview**: [Git & GitHub Course README](README.md)
- **Comprehensive 50-Question Technical Interview Q&A**: [Interview-QA.md](Quick-Reference/Interview-QA.md)
- **Interactive Capstone Projects**:
  - [Project 1: Enterprise Git Flow & Release Pipeline](Projects/01-Enterprise-Git-Flow-and-Release-Pipeline.md)
  - [Project 2: Complex Merge Conflict Simulation & Interactive Rebase](Projects/02-Complex-Merge-Conflict-Simulation-and-Interactive-Rebase.md)
  - [Project 3: Disaster Recovery, Reflog Rescue & Automated Bisect](Projects/03-Disaster-Recovery-Reflog-Rescue-and-Bug-Hunting-with-Bisect.md)

---

## Table of Contents

1. [Plumbing & Object Model Commands](#1-plumbing--object-model-commands)
2. [Configuration, Identity & Aliases](#2-configuration-identity--aliases)
3. [Staging, Committing & History Inspection](#3-staging-committing--history-inspection)
4. [Branching, Switching & Worktrees](#4-branching-switching--worktrees)
5. [Merging, Rebasing & Conflict Resolution](#5-merging-rebasing--conflict-resolution)
6. [Undoing Changes, Reset & Reflog Recovery](#6-undoing-changes-reset--reflog-recovery)
7. [Stashing, Cherry-Picking & Bisect Debugging](#7-stashing-cherry-picking--bisect-debugging)
8. [Remotes, Syncing, SSH & Force-With-Lease](#8-remotes-syncing-ssh--force-with-lease)
9. [Git Hooks, Submodules & Attributes](#9-git-hooks-submodules--attributes)
10. [GitHub PRs, Branch Protection & Commit Signing](#10-github-prs-branch-protection--commit-signing)

---

## 1. Plumbing & Object Model Commands

| Command | Operational Purpose | Full Phase Lesson |
|---|---|---|
| `git hash-object -w <file>` | Computes SHA-1 hash and writes raw **Blob** object into `.git/objects/` | [Phase 1 Lesson 1](Phase-01-Git-Core-Architecture-and-Plumbing/01-Git-Object-Model-Blobs-Trees-Commits.md) |
| `git cat-file -p <SHA>` | Pretty-prints the content of any object (blob, tree, commit, tag) | [Phase 1 Lesson 1](Phase-01-Git-Core-Architecture-and-Plumbing/01-Git-Object-Model-Blobs-Trees-Commits.md) |
| `git cat-file -t <SHA>` | Returns the object type (`blob`, `tree`, `commit`, `tag`) | [Phase 1 Lesson 1](Phase-01-Git-Core-Architecture-and-Plumbing/01-Git-Object-Model-Blobs-Trees-Commits.md) |
| `git ls-tree <tree-SHA>` | Inspects tree object contents showing modes, types, SHAs, and filenames | [Phase 1 Lesson 2](Phase-01-Git-Core-Architecture-and-Plumbing/02-The-Three-Trees-Working-Tree-Index-HEAD.md) |
| `git write-tree` | Creates a new Tree object from the current staging area (Index) | [Phase 1 Lesson 3](Phase-01-Git-Core-Architecture-and-Plumbing/03-Plumbing-vs-Porcelain-Commands.md) |
| `git commit-tree <tree-SHA> -m "msg"` | Creates a low-level Commit object pointing to a tree and parents | [Phase 1 Lesson 3](Phase-01-Git-Core-Architecture-and-Plumbing/03-Plumbing-vs-Porcelain-Commands.md) |
| `git rev-parse HEAD` | Resolves a reference or symbolic pointer to its raw 40-character SHA hash | [Phase 1 Lesson 3](Phase-01-Git-Core-Architecture-and-Plumbing/03-Plumbing-vs-Porcelain-Commands.md) |
| `git fsck --unreachable` | Scans object database for orphaned or dangling objects | [Phase 1 Lesson 1](Phase-01-Git-Core-Architecture-and-Plumbing/01-Git-Object-Model-Blobs-Trees-Commits.md) |

---

## 2. Configuration, Identity & Aliases

| Command | Operational Purpose | Full Phase Lesson |
|---|---|---|
| `git config --global user.name "Name"` | Sets global commit author name | [Phase 9 Lesson 3](Phase-09-Git-Hooks-Submodules-and-Configuration/03-Git-Config-Aliases-and-Attributes.md) |
| `git config --global user.email "email"` | Sets global commit author email (must match GitHub for verified credit) | [Phase 9 Lesson 3](Phase-09-Git-Hooks-Submodules-and-Configuration/03-Git-Config-Aliases-and-Attributes.md) |
| `git config --global init.defaultBranch main` | Enforces `main` as default branch on new repositories | [Phase 9 Lesson 3](Phase-09-Git-Hooks-Submodules-and-Configuration/03-Git-Config-Aliases-and-Attributes.md) |
| `git config --global pull.rebase true` | Replays local commits on pull instead of creating merge commits | [Phase 8 Lesson 2](Phase-08-Remotes-Syncing-and-Network-Protocols/02-Fetch-vs-Pull-vs-Pull-Rebase.md) |
| `git config --global fetch.prune true` | Automatically deletes stale remote-tracking branches on fetch | [Phase 8 Lesson 2](Phase-08-Remotes-Syncing-and-Network-Protocols/02-Fetch-vs-Pull-vs-Pull-Rebase.md) |
| `git config --global rebase.autoStash true` | Autostashes uncommitted edits during rebase operations | [Phase 5 Lesson 1](Phase-05-Rebasing-and-History-Rewriting/01-Linear-History-and-Rebase-Mechanics.md) |
| `git config --global merge.conflictStyle zdiff3` | Shows common base ancestor in merge conflict markers | [Phase 4 Lesson 2](Phase-04-Merging-and-Conflict-Resolution/02-Merge-Conflicts-and-Marker-Anatomy.md) |
| `git config --global core.autocrlf input` | Strips CR on commit for macOS/Linux; keeps LF in repo | [Phase 9 Lesson 3](Phase-09-Git-Hooks-Submodules-and-Configuration/03-Git-Config-Aliases-and-Attributes.md) |
| `git config --global alias.lg "log --graph --oneline --all"` | Visual terminal graph log shortcut | [Phase 9 Lesson 3](Phase-09-Git-Hooks-Submodules-and-Configuration/03-Git-Config-Aliases-and-Attributes.md) |
| `git config --list --show-origin` | Audits all active configuration files across system/global/local scopes | [Phase 9 Lesson 3](Phase-09-Git-Hooks-Submodules-and-Configuration/03-Git-Config-Aliases-and-Attributes.md) |

---

## 3. Staging, Committing & History Inspection

| Command | Operational Purpose | Full Phase Lesson |
|---|---|---|
| `git status -s` | Compact status display showing Index and Working Tree state | [Phase 2 Lesson 2](Phase-02-Staging-Committing-and-Inspection/02-Diff-Inspection-and-Status-Telemetry.md) |
| `git add <file>` | Stages file content into the Git Index | [Phase 2 Lesson 1](Phase-02-Staging-Committing-and-Inspection/01-Atomic-Commits-and-Conventional-Commits.md) |
| `git add -p` | Interactively stages hunks within files for atomic commits | [Phase 2 Lesson 1](Phase-02-Staging-Committing-and-Inspection/01-Atomic-Commits-and-Conventional-Commits.md) |
| `git commit -m "feat(scope): msg"` | Creates commit object adhering to Conventional Commits format | [Phase 2 Lesson 1](Phase-02-Staging-Committing-and-Inspection/01-Atomic-Commits-and-Conventional-Commits.md) |
| `git commit -am "msg"` | Stages tracked modified files and commits in a single step | [Phase 2 Lesson 1](Phase-02-Staging-Committing-and-Inspection/01-Atomic-Commits-and-Conventional-Commits.md) |
| `git commit --amend --no-edit` | Appends staged changes to last commit without rewriting message | [Phase 2 Lesson 1](Phase-02-Staging-Committing-and-Inspection/01-Atomic-Commits-and-Conventional-Commits.md) |
| `git log --graph --oneline --all` | ASCII commit DAG showing all branch topologies | [Phase 2 Lesson 3](Phase-02-Staging-Committing-and-Inspection/03-History-Visualization-and-Blame.md) |
| `git log -S "<string>"` | Pickaxe search: finds commits that added or removed `<string>` | [Phase 7 Lesson 3](Phase-07-Stashing-Cherry-Picking-and-Searching/03-Git-Bisect-and-Log-Grep-Debugging.md) |
| `git log -G "<regex>"` | Regex search: scans diff hunks matching regular expressions | [Phase 7 Lesson 3](Phase-07-Stashing-Cherry-Picking-and-Searching/03-Git-Bisect-and-Log-Grep-Debugging.md) |
| `git log -L 10,30:app.js` | Traces the historical evolution of specific line ranges | [Phase 7 Lesson 3](Phase-07-Stashing-Cherry-Picking-and-Searching/03-Git-Bisect-and-Log-Grep-Debugging.md) |
| `git blame -w -C -L 20,40 <file>` | Line attribution ignoring whitespace and code movements | [Phase 2 Lesson 3](Phase-02-Staging-Committing-and-Inspection/03-History-Visualization-and-Blame.md) |

---

## 4. Branching, Switching & Worktrees

| Command | Operational Purpose | Full Phase Lesson |
|---|---|---|
| `git branch -vv` | Lists local branches with upstream tracking and ahead/behind telemetry | [Phase 3 Lesson 1](Phase-03-Branching-Switching-and-Worktrees/01-Branch-Pointers-and-HEAD-References.md) |
| `git switch <branch>` | Modern branch switcher (replaces `git checkout <branch>`) | [Phase 3 Lesson 2](Phase-03-Branching-Switching-and-Worktrees/02-Modern-Branch-Switching-Switch-vs-Checkout.md) |
| `git switch -c <branch>` | Creates and immediately switches to a new branch | [Phase 3 Lesson 2](Phase-03-Branching-Switching-and-Worktrees/02-Modern-Branch-Switching-Switch-vs-Checkout.md) |
| `git switch -d <commit>` | Checks out a specific commit in detached HEAD state | [Phase 3 Lesson 2](Phase-03-Branching-Switching-and-Worktrees/02-Modern-Branch-Switching-Switch-vs-Checkout.md) |
| `git branch -d <name>` | Safe delete: refuses to delete branch with unmerged commits | [Phase 3 Lesson 1](Phase-03-Branching-Switching-and-Worktrees/01-Branch-Pointers-and-HEAD-References.md) |
| `git branch -D <name>` | Force delete: removes branch pointer regardless of merge status | [Phase 3 Lesson 1](Phase-03-Branching-Switching-and-Worktrees/01-Branch-Pointers-and-HEAD-References.md) |
| `git worktree add ../hotfix hotfix-br` | Creates a new linked working tree in a separate folder | [Phase 3 Lesson 3](Phase-03-Branching-Switching-and-Worktrees/03-Git-Worktrees-for-Multi-Branch-Multitasking.md) |
| `git worktree list` | Displays all active worktrees and locked branches | [Phase 3 Lesson 3](Phase-03-Branching-Switching-and-Worktrees/03-Git-Worktrees-for-Multi-Branch-Multitasking.md) |
| `git worktree prune` | Cleans administrative metadata for deleted worktree directories | [Phase 3 Lesson 3](Phase-03-Branching-Switching-and-Worktrees/03-Git-Worktrees-for-Multi-Branch-Multitasking.md) |

---

## 5. Merging, Rebasing & Conflict Resolution

| Command | Operational Purpose | Full Phase Lesson |
|---|---|---|
| `git merge <branch>` | Integrates branch using 3-way merge or Fast-Forward | [Phase 4 Lesson 1](Phase-04-Merging-and-Conflict-Resolution/01-Fast-Forward-vs-Three-Way-Merge.md) |
| `git merge --no-ff <branch>` | Enforces creation of explicit merge commit bubble | [Phase 4 Lesson 1](Phase-04-Merging-and-Conflict-Resolution/01-Fast-Forward-vs-Three-Way-Merge.md) |
| `git merge --ff-only <branch>` | Refuses to merge if histories have diverged (Zero merge commits) | [Phase 4 Lesson 1](Phase-04-Merging-and-Conflict-Resolution/01-Fast-Forward-vs-Three-Way-Merge.md) |
| `git rebase <upstream>` | Replays current branch commits on top of target upstream | [Phase 5 Lesson 1](Phase-05-Rebasing-and-History-Rewriting/01-Linear-History-and-Rebase-Mechanics.md) |
| `git rebase -i HEAD~N` | Interactive rebase: `pick`, `reword`, `edit`, `squash`, `fixup`, `drop` | [Phase 5 Lesson 2](Phase-05-Rebasing-and-History-Rewriting/02-Interactive-Rebase-Squash-Edit-Drop.md) |
| `git rebase --continue` | Resumes rebase after staging conflict fixes | [Phase 5 Lesson 2](Phase-05-Rebasing-and-History-Rewriting/02-Interactive-Rebase-Squash-Edit-Drop.md) |
| `git rebase --abort` | Aborts rebase and restores branch to pre-rebase SHA | [Phase 5 Lesson 2](Phase-05-Rebasing-and-History-Rewriting/02-Interactive-Rebase-Squash-Edit-Drop.md) |
| `git config --global rerere.enabled true` | Caches conflict resolutions and auto-applies them to repeated rebases | [Phase 4 Lesson 3](Phase-04-Merging-and-Conflict-Resolution/03-Advanced-Conflict-Resolution-and-Rerere.md) |
| `git checkout --ours / --theirs <file>` | Resolves conflict by accepting base side or incoming side wholesale | [Phase 4 Lesson 2](Phase-04-Merging-and-Conflict-Resolution/02-Merge-Conflicts-and-Marker-Anatomy.md) |

---

## 6. Undoing Changes, Reset & Reflog Recovery

| Command | Operational Purpose | Full Phase Lesson |
|---|---|---|
| `git restore <file>` | Discards unstaged modifications in the working tree | [Phase 6 Lesson 1](Phase-06-Undoing-Changes-and-Disaster-Recovery/01-Restoring-and-Discarding-Uncommitted-Work.md) |
| `git restore --staged <file>` | Unstages a file from the Index back to working tree | [Phase 6 Lesson 1](Phase-06-Undoing-Changes-and-Disaster-Recovery/01-Restoring-and-Discarding-Uncommitted-Work.md) |
| `git reset --soft HEAD~1` | Undoes last commit; keeps changes **staged** in Index | [Phase 6 Lesson 2](Phase-06-Undoing-Changes-and-Disaster-Recovery/02-Reset-Deep-Dive-Soft-Mixed-Hard.md) |
| `git reset --mixed HEAD~1` | Undoes last commit; keeps changes **unstaged** in working tree (Default) | [Phase 6 Lesson 2](Phase-06-Undoing-Changes-and-Disaster-Recovery/02-Reset-Deep-Dive-Soft-Mixed-Hard.md) |
| `git reset --hard HEAD~1` | Undoes last commit and **destroys all working tree modifications** | [Phase 6 Lesson 2](Phase-06-Undoing-Changes-and-Disaster-Recovery/02-Reset-Deep-Dive-Soft-Mixed-Hard.md) |
| `git revert <commit>` | Creates a new forward-moving inverse commit (Safe for shared branches) | [Phase 6 Lesson 3](Phase-06-Undoing-Changes-and-Disaster-Recovery/03-Revert-Reflog-and-Commit-Rescue.md) |
| `git revert -m 1 <merge-commit>` | Inverts changes from a merge commit retaining Parent 1 mainline | [Phase 6 Lesson 3](Phase-06-Undoing-Changes-and-Disaster-Recovery/03-Revert-Reflog-and-Commit-Rescue.md) |
| `git reflog` | Displays local journal of all historical movements of `HEAD` | [Phase 6 Lesson 3](Phase-06-Undoing-Changes-and-Disaster-Recovery/03-Revert-Reflog-and-Commit-Rescue.md) |
| `git switch -c rescued HEAD@{2}` | Resurrects an orphaned commit from the Reflog onto a live branch | [Phase 6 Lesson 3](Phase-06-Undoing-Changes-and-Disaster-Recovery/03-Revert-Reflog-and-Commit-Rescue.md) |
| `git clean -fd` | Deletes untracked files and directories (`-n` dry run first) | [Phase 6 Lesson 1](Phase-06-Undoing-Changes-and-Disaster-Recovery/01-Restoring-and-Discarding-Uncommitted-Work.md) |

---

## 7. Stashing, Cherry-Picking & Bisect Debugging

| Command | Operational Purpose | Full Phase Lesson |
|---|---|---|
| `git stash push -u -m "msg"` | Stashes tracked and untracked (`-u`) files with descriptive message | [Phase 7 Lesson 1](Phase-07-Stashing-Cherry-Picking-and-Searching/01-Git-Stash-Lifecycle-and-Patch-Stashing.md) |
| `git stash push -p` | Interactively stashes individual patch hunks | [Phase 7 Lesson 1](Phase-07-Stashing-Cherry-Picking-and-Searching/01-Git-Stash-Lifecycle-and-Patch-Stashing.md) |
| `git stash pop` | Restores top stash and removes from stash stack | [Phase 7 Lesson 1](Phase-07-Stashing-Cherry-Picking-and-Searching/01-Git-Stash-Lifecycle-and-Patch-Stashing.md) |
| `git stash apply stash@{N}` | Restores stash while preserving it in stack | [Phase 7 Lesson 1](Phase-07-Stashing-Cherry-Picking-and-Searching/01-Git-Stash-Lifecycle-and-Patch-Stashing.md) |
| `git stash branch <name> stash@{N}` | Converts stash into clean dedicated branch with zero conflicts | [Phase 7 Lesson 1](Phase-07-Stashing-Cherry-Picking-and-Searching/01-Git-Stash-Lifecycle-and-Patch-Stashing.md) |
| `git cherry-pick <SHA>` | Replays diff of specific commit onto active branch | [Phase 7 Lesson 2](Phase-07-Stashing-Cherry-Picking-and-Searching/02-Cherry-Picking-and-Patch-Management.md) |
| `git cherry-pick -x <SHA>` | Cherry-picks and appends provenance line to commit message | [Phase 7 Lesson 2](Phase-07-Stashing-Cherry-Picking-and-Searching/02-Cherry-Picking-and-Patch-Management.md) |
| `git bisect start <bad> <good>` | Launches binary search bug isolation session | [Phase 7 Lesson 3](Phase-07-Stashing-Cherry-Picking-and-Searching/03-Git-Bisect-and-Log-Grep-Debugging.md) |
| `git bisect run ./test.sh` | Fully automates regression hunting using a test script | [Phase 7 Lesson 3](Phase-07-Stashing-Cherry-Picking-and-Searching/03-Git-Bisect-and-Log-Grep-Debugging.md) |
| `git bisect reset` | Terminates bisect and returns `HEAD` to original branch | [Phase 7 Lesson 3](Phase-07-Stashing-Cherry-Picking-and-Searching/03-Git-Bisect-and-Log-Grep-Debugging.md) |

---

## 8. Remotes, Syncing, SSH & Force-With-Lease

| Command | Operational Purpose | Full Phase Lesson |
|---|---|---|
| `git remote -v` | Lists all configured remotes with fetch and push URLs | [Phase 8 Lesson 1](Phase-08-Remotes-Syncing-and-Network-Protocols/01-Remote-Tracking-Branches-and-Upstream.md) |
| `git remote add upstream <url>` | Registers authoritative upstream project remote | [Phase 8 Lesson 1](Phase-08-Remotes-Syncing-and-Network-Protocols/01-Remote-Tracking-Branches-and-Upstream.md) |
| `git fetch --all --prune` | Downloads objects from all remotes and prunes deleted tracking branches | [Phase 8 Lesson 2](Phase-08-Remotes-Syncing-and-Network-Protocols/02-Fetch-vs-Pull-vs-Pull-Rebase.md) |
| `git pull --rebase` | Fetches remote objects and replays local commits on top | [Phase 8 Lesson 2](Phase-08-Remotes-Syncing-and-Network-Protocols/02-Fetch-vs-Pull-vs-Pull-Rebase.md) |
| `git push -u origin <branch>` | Pushes branch and sets upstream configuration in `.git/config` | [Phase 8 Lesson 1](Phase-08-Remotes-Syncing-and-Network-Protocols/01-Remote-Tracking-Branches-and-Upstream.md) |
| `git push --force-with-lease` | Safe force-push: aborts if remote branch was updated by teammate | [Phase 8 Lesson 3](Phase-08-Remotes-Syncing-and-Network-Protocols/03-Push-Force-With-Lease-and-SSH-Auth.md) |
| `ssh-keygen -t ed25519 -C "email"` | Generates high-security elliptic curve SSH keypair | [Phase 8 Lesson 3](Phase-08-Remotes-Syncing-and-Network-Protocols/03-Push-Force-With-Lease-and-SSH-Auth.md) |
| `ssh -T git@github.com` | Tests SSH authentication handshake against GitHub | [Phase 8 Lesson 3](Phase-08-Remotes-Syncing-and-Network-Protocols/03-Push-Force-With-Lease-and-SSH-Auth.md) |

---

## 9. Git Hooks, Submodules & Attributes

| Command | Operational Purpose | Full Phase Lesson |
|---|---|---|
| `git config core.hooksPath .githooks` | Configures team-shared version-controlled Git hooks directory | [Phase 9 Lesson 1](Phase-09-Git-Hooks-Submodules-and-Configuration/01-Client-Side-and-Server-Side-Git-Hooks.md) |
| `git submodule add <url> <path>` | Embeds external repository as pinned commit pointer (Gitlink 160000) | [Phase 9 Lesson 2](Phase-09-Git-Hooks-Submodules-and-Configuration/02-Git-Submodules-and-Subtrees.md) |
| `git clone --recurse-submodules <url>` | Clones repository and initializes all nested submodules recursively | [Phase 9 Lesson 2](Phase-09-Git-Hooks-Submodules-and-Configuration/02-Git-Submodules-and-Subtrees.md) |
| `git submodule update --init --remote` | Updates submodules to latest upstream branch commits | [Phase 9 Lesson 2](Phase-09-Git-Hooks-Submodules-and-Configuration/02-Git-Submodules-and-Subtrees.md) |
| `git subtree add --prefix=lib <url> main` | Embeds external repository source code directly into parent tree | [Phase 9 Lesson 2](Phase-09-Git-Hooks-Submodules-and-Configuration/02-Git-Submodules-and-Subtrees.md) |
| `git add --renormalize .` | Re-evaluates and cleans line endings according to `.gitattributes` | [Phase 9 Lesson 3](Phase-09-Git-Hooks-Submodules-and-Configuration/03-Git-Config-Aliases-and-Attributes.md) |

---

## 10. GitHub PRs, Branch Protection & Commit Signing

| Command / File | Operational Purpose | Full Phase Lesson |
|---|---|---|
| `.github/CODEOWNERS` | Maps repository paths to required reviewer teams | [Phase 10 Lesson 1](Phase-10-GitHub-Collaboration-Security-and-Enterprise-Workflows/01-Branch-Protection-Rules-and-PR-Reviews.md) |
| `gh pr create --base main` | Opens Pull Request from CLI | [Phase 10 Lesson 1](Phase-10-GitHub-Collaboration-Security-and-Enterprise-Workflows/01-Branch-Protection-Rules-and-PR-Reviews.md) |
| `gh pr merge --squash --delete-branch` | Squash-merges PR and deletes feature branch | [Phase 10 Lesson 1](Phase-10-GitHub-Collaboration-Security-and-Enterprise-Workflows/01-Branch-Protection-Rules-and-PR-Reviews.md) |
| `git config --global gpg.format ssh` | Configures SSH key format for cryptographic commit signing | [Phase 10 Lesson 3](Phase-10-GitHub-Collaboration-Security-and-Enterprise-Workflows/03-Commit-Signing-GPG-SSH-and-Security.md) |
| `git config --global commit.gpgsign true` | Automatically signs every commit with private key | [Phase 10 Lesson 3](Phase-10-GitHub-Collaboration-Security-and-Enterprise-Workflows/03-Commit-Signing-GPG-SSH-and-Security.md) |
| `git log --show-signature -n 1` | Verifies cryptographic signature and author provenance locally | [Phase 10 Lesson 3](Phase-10-GitHub-Collaboration-Security-and-Enterprise-Workflows/03-Commit-Signing-GPG-SSH-and-Security.md) |
| `git tag -s v1.0.0 -m "release"` | Creates cryptographically signed release tag | [Phase 10 Lesson 3](Phase-10-GitHub-Collaboration-Security-and-Enterprise-Workflows/03-Commit-Signing-GPG-SSH-and-Security.md) |
