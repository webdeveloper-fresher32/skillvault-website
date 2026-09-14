# The Golden Rule of Rebasing — Complete Guide

> "A newspaper editor may freely rewrite and polish draft articles in their private notebook; but once 50,000 physical newspapers are printed and delivered to city doorsteps, retroactively changing the front-page headline causes mass public confusion."

---

## Table of Contents

1. [The Problem: Force-Pushing Rewritten History Destroys Teammate Repositories](#1-the-problem-force-pushing-rewritten-history-destroys-teammate-repositories)
2. [The Printed Daily Newspaper Analogy](#2-the-printed-daily-newspaper-analogy)
3. [The Mechanism: The Golden Rule and Safe Force-Pushing Protocols](#3-the-mechanism-the-golden-rule-and-safe-force-pushing-protocols)
4. [Diagram: The Upstream Divergence Disaster from Rebasing Public Branches](#4-diagram-the-upstream-divergence-disaster-from-rebasing-public-branches)
5. [CLI Walkthrough: Recovering from Force-Push Collisions with --force-with-lease](#5-cli-walkthrough-recovering-from-force-push-collisions-with---force-with-lease)
6. [Comparing git push --force vs git push --force-with-lease](#6-comparing-git-push---force-vs-git-push---force-with-lease)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Force-Pushing Rewritten History Destroys Teammate Repositories

When a developer rebases a branch that has already been pushed to a remote repository and cloned by teammates, Git rewrites all commit hashes. Pushing those rewritten commits requires a force push (`git push -f`), which silently destroys teammate commits and throws their local clones into diverged synchronization loops.

### The Force-Push Disaster Scenario

```text
Teammate A: Clones feature branch at commit C3, writes commit C4.
Teammate B: Rebases feature branch, creating C3', and runs `git push --force`.
Result:     Teammate A's next `git pull` triggers a nightmare 3-way merge between C3 and C3',
            duplicating commits and polluting history!
```

### The Solution: The Golden Rule & `--force-with-lease`

Follow the **Golden Rule of Rebasing**: *Never rebase public, shared branches.* When force-pushing private feature branches, always use `git push --force-with-lease` to prevent overwriting teammates' un-fetched work.

---

## 2. The Printed Daily Newspaper Analogy

A journalist drafts an investigation on their laptop before morning printing.

### Private Drafts vs Distributed Newspapers

```text
Private Notes (Local Branch)  → Journalist deletes paragraphs, rewrites sentences, reorganizes sections
                                (Completely safe; nobody else has read it yet).

Printed Paper (Public Branch) → Once thousands of copies are distributed to readers,
                                the publisher cannot recall the paper and pretend page 1 never existed.
```

### Mapping to Git Architecture

Your private local commits are the draft notes; the public `main` or shared staging branch is the distributed printed newspaper.

---

## 3. The Mechanism: The Golden Rule and Safe Force-Pushing Protocols

The Golden Rule states:
> **"Never rebase commits that exist outside your local repository and that other people may have based work on."**

### How `--force-with-lease` Protects Against Data Loss

- **`git push --force`**: Overwrites the remote branch tip unconditionally. If a teammate pushed commit C5 while you were rebasing, their commit is permanently erased from the remote ref!
- **`git push --force-with-lease`**: Checks if the remote tracking ref (`origin/feature`) matches the last state you fetched. If a teammate pushed new commits you haven't seen, the push is **aborted**, protecting their work from destruction.
- **`--force-if-includes` Extra Safeguard**: Ensures that the remote ref's current commit was integrated into your local history before pushing.
- **Branch Protection Rules**: Enforce server-side blocks against all force-pushes on production branches.
- **Reflog Safety Net**: Local reflog records previous branch tips prior to any forced updates.
- **Shared Remote Collaboration**: Multiple contributors on the same branch should strictly use standard merge workflows.

---

## 4. Diagram: The Upstream Divergence Disaster from Rebasing Public Branches

### History Rewriting Collision

```text
Remote Branch `origin/shared-feature`:
  C1 ──▶ C2 ──▶ C3

Developer B rebases locally (creates C2', C3') and runs `git push --force`:
  Remote now has: C1 ──▶ C2' ──▶ C3' (Original C2 and C3 abandoned!)

Developer A (already has local C3) runs `git pull`:
            (origin) C2' ──▶ C3'
           /                    \
  C1 ──▶ C2 ──▶ C3 ──────────────▶ C4 (Merge Commit: Duplicate patches everywhere!)
```

---

## 5. CLI Walkthrough: Recovering from Force-Push Collisions with --force-with-lease

A complete terminal comparison demonstrating safe force-push protections:

```bash
# 1. Initialize local and remote simulation repos
mkdir -p /tmp/remote_bare.git && git init --bare /tmp/remote_bare.git
mkdir /tmp/dev_a && cd /tmp/dev_a
git init
git remote add origin /tmp/remote_bare.git

# 2. Dev A pushes initial feature branch
echo "Feature base" > app.txt
git add app.txt
git commit -m "feat: initial feature base"
git push -u origin main

# 3. Simulate Dev B cloning the repository
mkdir /tmp/dev_b && cd /tmp/dev_b
git clone /tmp/remote_bare.git .

# 4. Dev B makes a commit and pushes to origin
echo "Dev B critical addition" >> app.txt
git commit -am "feat: add critical logic by Dev B"
git push origin main

# 5. Meanwhile, Dev A rebases locally WITHOUT fetching Dev B's work!
cd /tmp/dev_a
git commit --amend -m "feat: amended feature base by Dev A"

# 6. Dev A attempts unsafe `git push --force` (Destructive! Would erase Dev B!)
# Instead, Dev A uses `--force-with-lease`:
git push --force-with-lease origin main
# Output:
# To /tmp/remote_bare.git
#  ! [rejected]        main -> main (stale info)
# error: failed to push some refs to '/tmp/remote_bare.git'

# 7. Dev B's work was SAVED! Dev A fetches and integrates cleanly:
git fetch origin
git rebase origin/main
git push origin main
```

---

## 6. Comparing git push --force vs git push --force-with-lease

| Dimension | `git push --force` (`-f`) | `git push --force-with-lease` |
|---|---|---|
| Remote Ref Validation | None (Overwrites blind) | Validates remote matches local `origin/<branch>` |
| Teammate Commit Safety | Destructive (Can erase coworker work) | 100% Safe (Aborts if un-fetched commits exist) |
| Recommended Alias | Banned in most engineering orgs | Recommended default for rebased PR updates |
| CI/CD Pipeline Risk | High risk of clobbering merge queues | Detects race conditions automatically |
| Error Message on Conflict | None (Silent overwrite) | `[rejected] (stale info)` |
| Protection Against Overwrite | Zero protection | High protection |
| Pre-flight Verification | Skips all remote state checks | Validates atomic compare-and-swap |
| Pull Request Workflow | Blindly overrides reviewer changes | Aborts if reviewers push edits to PR |
| Accidental Main Clobber | High catastrophic risk | Blocked if remote is ahead |

---

## 7. Common Mistakes

- **Rebasing the `main` or `develop` branch.** Causes massive sync conflicts for every engineer in the company.
- **Using `git push --force` out of habit.** Always alias or train muscle memory to use `git push --force-with-lease`.
- **Force-pushing before checking `git status` or `git log`.** Accidental destruction of recent local commits due to botched rebases.
- **Running `git fetch` immediately before `--force-with-lease`.** Running `fetch` updates your tracking ref to match remote, neutralizing the safety check; always inspect before force-pushing.
- **Not enabling GitHub Branch Protection.** Failing to enforce "Restrict force pushes" on production branches in GitHub repository settings.

---

## 8. Hands-On Exercises

**Exercise 1:** Configure a global Git alias `git config --global alias.pushf "push --force-with-lease"`.

**Exercise 2:** Create a simulated bare remote repo and demonstrate `--force-with-lease` rejecting a push when the remote has advanced.

**Exercise 3:** Protect a branch in GitHub/GitLab by disabling force pushes in branch protection settings.

**Exercise 4:** Practice rebasing a personal feature branch against `origin/main` and updating the pull request with `--force-with-lease`.

**Exercise 5:** Rebase a shared branch intentionally in a sandbox and practice resolving the divergence on a secondary clone using `git rebase origin/<branch>`.

---

## 9. Interview Q&A

**Q: What is the "Golden Rule of Rebasing"?**
The Golden Rule of Rebasing states: **Never rebase a branch that is public and shared with other developers.** Rebasing rewrites commit hashes; doing so on a shared branch forces all collaborators who branched off the original commits into complex, messy divergence resolutions when pulling.

**Q: Why is `git push --force-with-lease` strictly preferred over `git push --force`?**
`git push --force` overwrites the remote reference blindly, potentially destroying commits pushed by teammates since your last fetch. `git push --force-with-lease` checks that the remote branch reference still points to the exact commit SHA you expect (your local remote-tracking ref). If a teammate pushed new work in the interim, Git rejects the force push safely.

**Q: When is it considered safe and acceptable to rebase and force-push?**
It is safe to rebase and force-push on **private, personal feature branches** where you are the sole author, specifically when updating the branch against upstream `main` or squashing local commits before merging a Pull Request.

**Q: If a teammate force-pushes a rebased shared branch, what command should other developers run to fix their local clone?**
Collaborators should run `git fetch origin` followed by `git rebase origin/<branch-name>` (or `git reset --hard origin/<branch-name>` if they have no unpushed local work), rather than running a naive `git pull` which would generate duplicate merge commits.

**Q: How can engineering teams prevent accidental history rewriting on critical production branches?**
Teams configure **Branch Protection Rules** on platforms like GitHub, GitLab, or Bitbucket. Enabling "Do not allow force pushes" on `main`, `master`, and release branches makes it impossible for any developer to push rewritten history to protected branches.

**Q: What is `--force-if-includes` and how does it extend `--force-with-lease`?**
`--force-if-includes` is an additional flag introduced in Git 2.30 that checks if the remote-tracking ref commit is actually contained within the reflog of the local branch being pushed, ensuring that you haven't fetched someone else's work into `origin/<branch>` without actually integrating it into your local branch.
