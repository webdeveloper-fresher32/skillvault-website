# Git & GitHub Mastery — Quick Reference Cheatsheet

> "Dense, instant-reference command and architecture index organized by operational domain, plumbing internals, and enterprise workflows."

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

| Command | Operational Purpose |
|---|---|
| `git hash-object -w <file>` | Computes SHA-1 hash and writes raw **Blob** object into `.git/objects/` |
| `git cat-file -p <SHA>` | Pretty-prints the content of any object (blob, tree, commit, tag) |
| `git cat-file -t <SHA>` | Returns the object type (`blob`, `tree`, `commit`, `tag`) |
| `git ls-tree <tree-SHA>` | Inspects tree object contents showing modes, types, SHAs, and filenames |
| `git write-tree` | Creates a new Tree object from the current staging area (Index) |
| `git commit-tree <tree-SHA> -m "msg"` | Creates a low-level Commit object pointing to a tree and parents |
| `git rev-parse HEAD` | Resolves a reference or symbolic pointer to its raw 40-character SHA hash |
| `git fsck --unreachable` | Scans object database for orphaned or dangling objects |

---

## 2. Configuration, Identity & Aliases

| Command | Operational Purpose |
|---|---|
| `git config --global user.name "Name"` | Sets global commit author name |
| `git config --global user.email "email"` | Sets global commit author email (must match GitHub for verified credit) |
| `git config --global init.defaultBranch main` | Enforces `main` as default branch on new repositories |
| `git config --global pull.rebase true` | Replays local commits on pull instead of creating merge commits |
| `git config --global fetch.prune true` | Automatically deletes stale remote-tracking branches on fetch |
| `git config --global rebase.autoStash true` | Autostashes uncommitted edits during rebase operations |
| `git config --global merge.conflictStyle zdiff3` | Shows common base ancestor in merge conflict markers |
| `git config --global core.autocrlf input` | Strips CR on commit for macOS/Linux; keeps LF in repo |
| `git config --global alias.lg "log --graph --oneline --all"` | Visual terminal graph log shortcut |
| `git config --list --show-origin` | Audits all active configuration files across system/global/local scopes |

---

## 3. Staging, Committing & History Inspection

| Command | Operational Purpose |
|---|---|
| `git status -s` | Compact status display showing Index and Working Tree state |
| `git add <file>` | Stages file content into the Git Index |
| `git add -p` | Interactively stages hunks within files for atomic commits |
| `git commit -m "feat(scope): msg"` | Creates commit object adhering to Conventional Commits format |
| `git commit -am "msg"` | Stages tracked modified files and commits in a single step |
| `git commit --amend --no-edit` | Appends staged changes to last commit without rewriting message |
| `git log --graph --oneline --all` | ASCII commit DAG showing all branch topologies |
| `git log -S "<string>"` | Pickaxe search: finds commits that added or removed `<string>` |
| `git log -G "<regex>"` | Regex search: scans diff hunks matching regular expressions |
| `git log -L 10,30:app.js` | Traces the historical evolution of specific line ranges |
| `git blame -w -C -L 20,40 <file>` | Line attribution ignoring whitespace and code movements |

---

## 4. Branching, Switching & Worktrees

| Command | Operational Purpose |
|---|---|
| `git branch -vv` | Lists local branches with upstream tracking and ahead/behind telemetry |
| `git switch <branch>` | Modern branch switcher (replaces `git checkout <branch>`) |
| `git switch -c <branch>` | Creates and immediately switches to a new branch |
| `git switch -d <commit>` | Checks out a specific commit in detached HEAD state |
| `git branch -d <name>` | Safe delete: refuses to delete branch with unmerged commits |
| `git branch -D <name>` | Force delete: removes branch pointer regardless of merge status |
| `git worktree add ../hotfix hotfix-br` | Creates a new linked working tree in a separate folder |
| `git worktree list` | Displays all active worktrees and locked branches |
| `git worktree prune` | Cleans administrative metadata for deleted worktree directories |

---

## 5. Merging, Rebasing & Conflict Resolution

| Command | Operational Purpose |
|---|---|
| `git merge <branch>` | Integrates branch using 3-way merge or Fast-Forward |
| `git merge --no-ff <branch>` | Enforces creation of explicit merge commit bubble |
| `git merge --ff-only <branch>` | Refuses to merge if histories have diverged (Zero merge commits) |
| `git rebase <upstream>` | Replays current branch commits on top of target upstream |
| `git rebase -i HEAD~N` | Interactive rebase: `pick`, `reword`, `edit`, `squash`, `fixup`, `drop` |
| `git rebase --continue` | Resumes rebase after staging conflict fixes |
| `git rebase --abort` | Aborts rebase and restores branch to pre-rebase SHA |
| `git config --global rerere.enabled true` | Caches conflict resolutions and auto-applies them to repeated rebases |
| `git checkout --ours / --theirs <file>` | Resolves conflict by accepting base side or incoming side wholesale |

---

## 6. Undoing Changes, Reset & Reflog Recovery

| Command | Operational Purpose |
|---|---|
| `git restore <file>` | Discards unstaged modifications in the working tree |
| `git restore --staged <file>` | Unstages a file from the Index back to working tree |
| `git reset --soft HEAD~1` | Undoes last commit; keeps changes **staged** in Index |
| `git reset --mixed HEAD~1` | Undoes last commit; keeps changes **unstaged** in working tree (Default) |
| `git reset --hard HEAD~1` | Undoes last commit and **destroys all working tree modifications** |
| `git revert <commit>` | Creates a new forward-moving inverse commit (Safe for shared branches) |
| `git revert -m 1 <merge-commit>` | Inverts changes from a merge commit retaining Parent 1 mainline |
| `git reflog` | Displays local journal of all historical movements of `HEAD` |
| `git switch -c rescued HEAD@{2}` | Resurrects an orphaned commit from the Reflog onto a live branch |
| `git clean -fd` | Deletes untracked files and directories (`-n` dry run first) |

---

## 7. Stashing, Cherry-Picking & Bisect Debugging

| Command | Operational Purpose |
|---|---|
| `git stash push -u -m "msg"` | Stashes tracked and untracked (`-u`) files with descriptive message |
| `git stash push -p` | Interactively stashes individual patch hunks |
| `git stash pop` | Restores top stash and removes from stash stack |
| `git stash apply stash@{N}` | Restores stash while preserving it in stack |
| `git stash branch <name> stash@{N}` | Converts stash into clean dedicated branch with zero conflicts |
| `git cherry-pick <SHA>` | Replays diff of specific commit onto active branch |
| `git cherry-pick -x <SHA>` | Cherry-picks and appends provenance line to commit message |
| `git bisect start <bad> <good>` | Launches binary search bug isolation session |
| `git bisect run ./test.sh` | Fully automates regression hunting using a test script |
| `git bisect reset` | Terminates bisect and returns `HEAD` to original branch |

---

## 8. Remotes, Syncing, SSH & Force-With-Lease

| Command | Operational Purpose |
|---|---|
| `git remote -v` | Lists all configured remotes with fetch and push URLs |
| `git remote add upstream <url>` | Registers authoritative upstream project remote |
| `git fetch --all --prune` | Downloads objects from all remotes and prunes deleted tracking branches |
| `git pull --rebase` | Fetches remote objects and replays local commits on top |
| `git push -u origin <branch>` | Pushes branch and sets upstream configuration in `.git/config` |
| `git push --force-with-lease` | Safe force-push: aborts if remote branch was updated by teammate |
| `ssh-keygen -t ed25519 -C "email"` | Generates high-security elliptic curve SSH keypair |
| `ssh -T git@github.com` | Tests SSH authentication handshake against GitHub |

---

## 9. Git Hooks, Submodules & Attributes

| Command | Operational Purpose |
|---|---|
| `git config core.hooksPath .githooks` | Configures team-shared version-controlled Git hooks directory |
| `git submodule add <url> <path>` | Embeds external repository as pinned commit pointer (Gitlink 160000) |
| `git clone --recurse-submodules <url>` | Clones repository and initializes all nested submodules recursively |
| `git submodule update --init --remote` | Updates submodules to latest upstream branch commits |
| `git subtree add --prefix=lib <url> main` | Embeds external repository source code directly into parent tree |
| `git add --renormalize .` | Re-evaluates and cleans line endings according to `.gitattributes` |

---

## 10. GitHub PRs, Branch Protection & Commit Signing

| Command / File | Operational Purpose |
|---|---|
| `.github/CODEOWNERS` | Maps repository paths to required reviewer teams |
| `gh pr create --base main` | Opens Pull Request from CLI |
| `gh pr merge --squash --delete-branch` | Squash-merges PR and deletes feature branch |
| `git config --global gpg.format ssh` | Configures SSH key format for cryptographic commit signing |
| `git config --global commit.gpgsign true` | Automatically signs every commit with private key |
| `git log --show-signature -n 1` | Verifies cryptographic signature and author provenance locally |
| `git tag -s v1.0.0 -m "release"` | Creates cryptographically signed release tag |
