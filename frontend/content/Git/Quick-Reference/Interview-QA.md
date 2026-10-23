# Git & GitHub Mastery — 50 Core Technical Interview Questions & Answers

---

## Table of Contents

1. [Phase 01: Core Architecture, Objects & Plumbing (Q1–Q5)](#phase-01-core-architecture-objects--plumbing-q1q5)
2. [Phase 02: Staging, Commits & Telemetry (Q6–Q10)](#phase-02-staging-commits--telemetry-q6q10)
3. [Phase 03: Branching, Switching & Worktrees (Q11–Q15)](#phase-03-branching-switching--worktrees-q11q15)
4. [Phase 04: Merging & Conflict Resolution (Q16–Q20)](#phase-04-merging--conflict-resolution-q16q20)
5. [Phase 05: Rebasing & History Rewriting (Q21–Q25)](#phase-05-rebasing--history-rewriting-q21q25)
6. [Phase 06: Undoing Changes, Reset & Reflog (Q26–Q30)](#phase-06-undoing-changes-reset--reflog-q26q30)
7. [Phase 07: Stashing, Cherry-Picking & Bisect (Q31–Q35)](#phase-07-stashing-cherry-picking--bisect-q31q35)
8. [Phase 08: Remotes, Syncing & Protocols (Q36–Q40)](#phase-08-remotes-syncing--protocols-q36q40)
9. [Phase 09: Git Hooks, Submodules & Attributes (Q41–Q45)](#phase-09-git-hooks-submodules--attributes-q41q45)
10. [Phase 10: GitHub PRs, Security & Signing (Q46–Q50)](#phase-10-github-prs-security--signing-q46q50)

---

## Phase 01: Core Architecture, Objects & Plumbing (Q1–Q5)

### Q1: What are the 4 fundamental object types in Git's object database and what does each store?
**Answer:**
1. **Blob**: Stores pure raw file content (bytes) without filename, permissions, or timestamps.
2. **Tree**: Represents a directory structure, mapping file modes, object types (`blob`/`tree`), 40-character SHA-1 hashes, and filenames.
3. **Commit**: Stores a pointer to the root Tree object, zero or more parent commit SHAs, author/committer identity timestamps, and the commit message.
4. **Annotated Tag**: Stores a pointer to a specific commit object, tagger metadata, timestamp, GPG signature, and release message.

### Q2: Why is Git described as a Content-Addressable Storage (CAS) system and Directed Acyclic Graph (DAG)?
**Answer:**
Git is content-addressable because every object stored in `.git/objects/` is indexed and retrieved by the cryptographic SHA-1/SHA-256 hash of its contents plus header. Git forms a DAG because commits point backward to their parent commits via immutable cryptographic references, creating a directed graph that cannot form cycles.

### Q3: Explain the "Three Trees" architecture in Git and how data transitions between them.
**Answer:**
1. **Working Tree**: The local operating system file system directory where files are actively edited.
2. **Index (Staging Area)**: A binary cache file (`.git/index`) that prepares and tracks the exact tree structure of the next commit.
3. **HEAD**: A symbolic reference pointing to the commit object representing the tip of the currently active branch.
- Running `git add` copies files from the Working Tree into blobs and registers them in the Index.
- Running `git commit` writes a Tree object from the Index and creates a new Commit object that becomes the new `HEAD`.

### Q4: What is the difference between Plumbing and Porcelain commands in Git?
**Answer:**
- **Porcelain commands** (`git commit`, `git checkout`, `git pull`, `git status`) are high-level, human-friendly user interface commands designed for day-to-day developer productivity.
- **Plumbing commands** (`git hash-object`, `git cat-file`, `git ls-tree`, `git write-tree`, `git commit-tree`) are low-level UNIX-style commands that perform single, granular mutations or inspections on Git internals, used primarily for scripting, Git tooling, and hook automation.

### Q5: How does Git prevent duplicate storage when multiple files across branches share identical content?
**Answer:**
Because Git computes blob hashes based purely on file content (not file path), two files with identical contents produce the exact same 40-character SHA-1 hash. Git writes only a single blob object to `.git/objects/`, and multiple Tree objects simply reference that identical blob hash with different directory path labels.

---

## Phase 02: Staging, Commits & Telemetry (Q6–Q10)

### Q6: What is an "Atomic Commit" and why is it crucial in professional software engineering?
**Answer:**
An atomic commit is a self-contained unit of work that implements exactly one logical change (one feature, one bug fix, or one refactor) along with its associated tests and documentation. If an atomic commit is reverted or cherry-picked, it neither breaks the build nor leaves orphan dependencies.

### Q7: Explain the Conventional Commits specification and its role in semantic releases.
**Answer:**
Conventional Commits is a standardized formatting rule for commit messages with the structure: `<type>[optional scope]: <description>`. Standard types include `feat` (minor release bump), `fix` (patch release bump), `chore`, `docs`, and `refactor`, with `BREAKING CHANGE:` triggering major version bumps in automated CI/CD release tools (like semantic-release).

### Q8: How does `git add -p` work and when should you use it?
**Answer:**
`git add -p` (or `--patch`) allows developers to interactively review and stage individual diff hunks (or split hunks into smaller sub-hunks) within modified files. It is essential when a developer has made multiple unrelated changes across a file and wants to construct clean, focused, atomic commits.

### Q9: What is the difference between `git diff`, `git diff --staged`, and `git diff HEAD`?
**Answer:**
- `git diff`: Compares the **Working Tree** against the **Index** (shows unstaged edits).
- `git diff --staged` (or `--cached`): Compares the **Index** against the **HEAD** commit (shows what will be included in the next commit).
- `git diff HEAD`: Compares the **Working Tree** directly against the **HEAD** commit (shows all changes regardless of staging status).

### Q10: How do flags like `-w` and `-C` improve `git blame` accuracy during code reviews?
**Answer:**
- `git blame -w`: Ignores whitespace changes (e.g. indentation reformatting), preventing cosmetic edits from obscuring original authorship.
- `git blame -C`: Detects lines that were copied or moved from other files within the same commit, attributing lines to their original creator rather than the developer who moved the code.

---

## Phase 03: Branching, Switching & Worktrees (Q11–Q15)

### Q11: What is a Git branch physically under the hood inside the `.git` directory?
**Answer:**
A Git branch is simply a 41-byte plain text file located at `.git/refs/heads/<branchname>` containing nothing more than the 40-character SHA-1 commit hash of the branch's latest commit. Creating a branch does not duplicate code; it simply writes 41 bytes to disk.

### Q12: Why did Git introduce `git switch` and `git restore` in Git 2.23 to replace `git checkout`?
**Answer:**
In legacy Git, `git checkout` was overloaded with two completely distinct responsibilities: switching branches (navigating commit history) and discarding working tree file edits (mutating files). Git 2.23 separated these concerns into `git switch` (for branch navigation) and `git restore` (for un-staging and discarding working tree modifications).

### Q13: What is a "Detached HEAD" state, and what happens to commits created while in detached HEAD?
**Answer:**
A detached HEAD state occurs when `HEAD` points directly to a commit SHA or tag rather than pointing to a named branch reference. Any commits created in this state are orphaned from named branches; if you switch to another branch without creating a named branch (`git switch -c <name>`), those commits become unreachable and will eventually be garbage-collected by `git gc` after the reflog expires.

### Q14: What is Git Worktree and what problem does it solve compared to `git stash`?
**Answer:**
`git worktree` allows a single Git repository to have multiple linked working directories checked out to different branches simultaneously on disk. It solves the problem of needing to interrupt long-running builds, active test runs, or complex uncommitted work when an urgent production hotfix requires switching branches.

### Q15: Why does Git prohibit checking out the same branch in two different worktrees at the same time?
**Answer:**
If two working directories were checked out to the same branch reference, commits in either worktree would mutate the exact same `refs/heads/<branch>` pointer concurrently, creating severe race conditions, index desynchronizations, and corrupting the working tree state.

---

## Phase 04: Merging & Conflict Resolution (Q16–Q20)

### Q16: What is the difference between a Fast-Forward merge and a Three-Way (True) Merge?
**Answer:**
- **Fast-Forward Merge**: Occurs when the target branch has no divergent commits relative to the incoming branch. Git simply moves the branch reference pointer forward to the tip of the incoming branch without creating a merge commit.
- **Three-Way Merge**: Occurs when histories have diverged. Git identifies the Most Recent Common Ancestor (Merge Base), computes diffs from the merge base to both branch tips, and creates a new **Merge Commit** with two parent pointers.

### Q17: What does the `--no-ff` flag do during a merge and why do teams use it?
**Answer:**
`git merge --no-ff` forces Git to create an explicit merge commit object even if a fast-forward merge was possible. Engineering teams use it in Git Flow to preserve the visual historical record and lifecycle boundaries of completed feature branches in the commit graph.

### Q18: Explain the anatomy of standard conflict markers vs `zdiff3` conflict markers.
**Answer:**
- Standard conflict markers show two sections: `<<<<<<< HEAD` (current branch changes), `=======` (separator), and `>>>>>>> feature` (incoming changes).
- `zdiff3` (`merge.conflictStyle = zdiff3`) adds a middle section `||||||| base` showing the original text at the Common Ancestor commit, allowing developers to see what both sides changed relative to the baseline.

### Q19: What is `git rerere` and how does it optimize rebasing across long-running branches?
**Answer:**
`git rerere` stands for "Reuse Recorded Resolution". When enabled (`rerere.enabled true`), Git automatically records pre-image conflict hunks and the developer's post-image resolution. When the same conflict occurs during future merges or multi-step rebases, Git recognizes the fingerprint and applies the resolution automatically.

### Q20: What is a "Semantic Merge Conflict" and why can't Git detect it automatically?
**Answer:**
A semantic conflict occurs when two branches make changes that merge cleanly without syntactic line-level text collisions, but cause runtime or logic failures (e.g. Branch A renames a function definition, while Branch B adds a new call to the old function name). Git only evaluates line diffs; compiler checks and automated test suites are required to catch semantic conflicts.

---

## Phase 05: Rebasing & History Rewriting (Q21–Q25)

### Q21: How does `git rebase` work mechanically under the hood?
**Answer:**
Git finds the common ancestor between the current branch and upstream, saves the diffs of all commits on the current branch to temporary patch files, resets the current branch pointer to the upstream commit, and replays each patch sequentially as brand-new commit objects with new SHA hashes.

### Q22: What is "The Golden Rule of Rebasing"?
**Answer:**
**Never rebase a branch that has been pushed to a public or shared remote repository.** Rebasing rewrites commit SHA hashes; if collaborators have based work on the original commits, force-pushing a rebased branch diverges histories and breaks clones for everyone on the team.

### Q23: What are the primary commands available in interactive rebase (`git rebase -i`)?
**Answer:**
- `pick`: Use commit as-is.
- `reword`: Use commit content but edit commit message.
- `edit`: Pause rebase to amend commit or working tree.
- `squash`: Combine commit into previous commit and concatenate messages.
- `fixup`: Combine commit into previous commit discarding its message.
- `drop`: Delete commit from history.

### Q24: What is the difference between `squash` and `fixup` in interactive rebase?
**Answer:**
Both combine the commit's diff into its predecessor commit. `squash` opens an editor prompting the developer to combine or edit both commit messages, whereas `fixup` automatically discards the squashed commit's message and keeps only the parent commit's message.

### Q25: How do you abort or recover from a botched rebase?
**Answer:**
- If the rebase is currently paused with conflicts: Run `git rebase --abort` to cancel and return immediately to the pre-rebase state.
- If the rebase was already completed and pushed locally: Run `git reflog` to locate the commit SHA prior to the rebase, and run `git reset --hard HEAD@{N}`.

---

## Phase 06: Undoing Changes, Reset & Reflog (Q26–Q30)

### Q26: Explain the difference between `git reset --soft`, `--mixed`, and `--hard`.
**Answer:**
- `--soft`: Moves `HEAD` pointer to target commit; leaves **Index (Staged)** and **Working Tree** unchanged.
- `--mixed` (Default): Moves `HEAD` pointer and updates **Index** to match target commit; leaves **Working Tree** files intact (unstages changes).
- `--hard`: Moves `HEAD`, updates **Index**, and **overwrites Working Tree** to match target commit (destroys uncommitted changes).

### Q27: Why is `git revert` safe for shared public branches while `git reset` is dangerous?
**Answer:**
`git reset` rewrites history by moving the branch pointer backward, abandoning commits. `git revert` moves history forward by creating a brand-new commit that applies the mathematical inverse of the target commit, preserving unbroken chronological history for all collaborators.

### Q28: How do you revert a merge commit and what does the `-m 1` flag specify?
**Answer:**
Run `git revert -m 1 <merge_commit_sha>`. Because merge commits have multiple parents, `-m 1` instructs Git to designate Parent 1 (the mainline branch) as the baseline, inverting all changes that were introduced by the secondary merged branch.

### Q29: What is the Git Reflog and where is its data stored on disk?
**Answer:**
The Reflog (Reference Log) is a local journaling subsystem that records every sequential update made to local references (such as `HEAD` and branch tips). It is stored in plain text files inside `.git/logs/HEAD` and `.git/logs/refs/heads/`.

### Q30: How long do entries remain in the Reflog before garbage collection?
**Answer:**
By default (`gc.reflogExpire`), reflog entries for reachable objects persist for **90 days**, while unreachable entries (`gc.reflogExpireUnreachable`) persist for **30 days** before `git gc` prunes them.

---

## Phase 07: Stashing, Cherry-Picking & Bisect (Q31–Q35)

### Q31: How does Git represent a Stash object internally in the repository database?
**Answer:**
A Stash is stored as a multi-parent commit object attached to `refs/stash`. Parent 1 points to the `HEAD` commit where the stash was created, Parent 2 points to a commit containing the Staged Index state, and Parent 3 (if `-u` is used) points to a commit containing untracked files.

### Q32: What is the purpose of `git stash branch <new_branch> [stash]`?
**Answer:**
It creates and checks out a new branch rooted at the exact commit where the stash was originally created, then applies and drops the stash. Because the base is identical to when the stash was recorded, it guarantees zero merge conflicts.

### Q33: What does `git cherry-pick -x <commit>` do?
**Answer:**
It replays the diff of `<commit>` onto the current branch and automatically appends `(cherry picked from commit <original_sha>)` to the commit message, providing audit provenance across release branches.

### Q34: How does `git bisect` use binary search to locate regression bugs?
**Answer:**
Given a known `bad` commit and a known `good` commit, `git bisect` calculates the topological midpoint commit in the DAG and checks it out. The developer or script tests the midpoint and marks it `good` or `bad`, halving the search space on each step in $\mathcal{O}(\log_2 N)$ iterations.

### Q35: How do you fully automate a `git bisect` regression hunt using a test script?
**Answer:**
Write an executable test script returning exit code `0` (success/good), non-zero (failure/bad), or `125` (skip un-testable commit). Run `git bisect start <bad_sha> <good_sha>` followed by `git bisect run ./test.sh`. Git iterates autonomously and prints the culprit commit SHA.

---

## Phase 08: Remotes, Syncing & Protocols (Q36–Q40)

### Q36: What is the relationship between a Local Branch, Remote-Tracking Branch, and Remote Reference?
**Answer:**
- **Local Branch** (`refs/heads/main`): Mutable read/write reference advanced by developer commits.
- **Remote-Tracking Branch** (`refs/remotes/origin/main`): Local read-only cached bookmark representing the remote state as of the last network fetch.
- **Remote Reference** (`main` on GitHub): The canonical branch residing on the remote server's disk.

### Q37: What is the fundamental operational difference between `git fetch` and `git pull`?
**Answer:**
`git fetch` downloads objects and updates remote-tracking references (`origin/*`) without touching your working directory or active branches. `git pull` executes `git fetch` followed immediately by `git merge FETCH_HEAD` (or `git rebase` if configured).

### Q38: Why should engineers use `git push --force-with-lease` instead of `git push --force`?
**Answer:**
`git push --force` overwrites the remote branch unconditionally, destroying teammate commits pushed in the interim. `--force-with-lease` performs an atomic compare-and-swap: it checks that the remote branch matches the commit SHA in your local remote-tracking reference; if a teammate has pushed new commits, Git safely aborts the push.

### Q39: Why are Ed25519 SSH keys preferred over RSA keys for Git authentication?
**Answer:**
Ed25519 uses Twisted Edwards Curve cryptography. It provides security equivalent to a 3072-bit RSA key using a compact 256-bit key size, generates signatures faster, and has built-in resistance to side-channel timing attacks.

### Q40: How do you configure Git to automatically prune deleted remote branches on fetch?
**Answer:**
Run `git config --global fetch.prune true`. This ensures that every time you run `git fetch`, Git automatically deletes local tracking references (`origin/*`) for branches that were deleted on the remote server.

---

## Phase 09: Git Hooks, Submodules & Attributes (Q41–Q45)

### Q41: How do Git hooks communicate execution success or failure back to Git?
**Answer:**
Git hooks communicate exclusively through process exit codes. An exit code of `0` signals success and allows Git to proceed. Any non-zero exit code (`1-255`) halts the operation immediately and aborts the commit, rebase, or push.

### Q42: How do you share client-side Git hooks across an engineering team using version control?
**Answer:**
Store hook scripts in a repository directory (e.g. `.githooks/`) and configure Git to use that path via `git config core.hooksPath .githooks`, or automate hook installation using tools like Husky or Python's `pre-commit`.

### Q43: What is a Gitlink mode `160000` entry and where is it used?
**Answer:**
A Gitlink mode `160000` is a special entry in Git's tree objects used for **Git Submodules**. Instead of pointing to a tree of files, it stores the 40-character commit SHA of an external nested Git repository.

### Q44: What is the difference between Git Submodules and Git Subtrees?
**Answer:**
- **Submodules**: Store only a pinned commit pointer SHA via `.gitmodules`; child files are not stored in the parent repository's tree and require `--recurse-submodules`.
- **Subtrees**: Directly embed the external project's files and commit history into the parent repository's tree, requiring no `.gitmodules` and allowing standard `git clone`.

### Q45: What does `* text=auto eol=lf` in `.gitattributes` do?
**Answer:**
It instructs Git to automatically detect text files and normalize their line endings to Unix LF (`\n`) when stored inside the repository object database, while handling checkout conversions cleanly across Windows, macOS, and Linux.

---

## Phase 10: GitHub PRs, Security & Signing (Q46–Q50)

### Q46: What is the purpose of `.github/CODEOWNERS` in enterprise repositories?
**Answer:**
`CODEOWNERS` defines file-path patterns and assigns specific GitHub users or teams as mandatory reviewers. When a pull request modifies matching files, GitHub automatically requests reviews from those owners and blocks merging until approved.

### Q47: Compare GitHub's 3 merge options: Squash and Merge vs Rebase and Merge vs Merge Commit.
**Answer:**
- **Squash and Merge**: Combines all PR commits into a single commit on `main`; best for clean linear history.
- **Rebase and Merge**: Replays individual PR commits linearly on `main` without a merge commit; best for granular commit histories.
- **Merge Commit**: Creates a 2-parent merge commit preserving exact branch topology and commit hashes; best for Git Flow release tracking.

### Q48: How does cryptographic commit signing work in Git using SSH or GPG keys?
**Answer:**
When committing with signing enabled (`commit.gpgsign true`), Git calculates the cryptographic hash of the commit object payload (tree, parents, author, message), encrypts the hash with the developer's private key, and embeds the signature in a `gpgsig` header directly inside the commit object.

### Q49: What requirements must be met for GitHub to display the green "Verified" badge on a commit?
**Answer:**
1. The commit object contains a valid cryptographic signature (`gpgsig`).
2. The public key used to sign is registered under a GitHub user account.
3. The commit author's email address matches a verified email address on that GitHub account.

### Q50: How does the Triangular Forking Workflow operate in open-source development?
**Answer:**
A contributor forks the authoritative repository (`upstream`) to their personal GitHub account (`origin`), clones locally, and configures both remotes. The contributor pulls updates from `upstream`, develops on a topic branch, pushes to `origin`, and opens a cross-repository Pull Request proposing the merge into `upstream:main`.
