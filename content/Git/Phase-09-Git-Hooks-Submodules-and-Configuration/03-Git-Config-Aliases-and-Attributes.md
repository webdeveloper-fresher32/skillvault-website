# Git Config, Aliases, and Attributes — Complete Guide

> "A master carpenter's workshop features an ergonomic tool belt with custom quick-draw holsters (Git Aliases), a master building code manual on the wall (Git Config), and precise material tags labeling oak wood vs tempered glass so cutting saws adjust automatically (Git Attributes)."

---

## Table of Contents

1. [The Problem: Line-Ending Conflicts, Binary File Bloat, and Repetitive CLI Typing](#1-the-problem-line-ending-conflicts-binary-file-bloat-and-repetitive-cli-typing)
2. [The Carpenter's Tool Belt and Material Tags Analogy](#2-the-carpenters-tool-belt-and-material-tags-analogy)
3. [The Mechanism: The 3-Tier Config Hierarchy, .gitattributes, and Alias Expansion](#3-the-mechanism-the-3-tier-config-hierarchy-gitattributes-and-alias-expansion)
4. [Diagram: Git Configuration Cascading and Attribute Filter Pipeline](#4-diagram-git-configuration-cascading-and-attribute-filter-pipeline)
5. [CLI Walkthrough: Building Power Aliases, Normalizing CRLF, and Custom Diff Drivers](#5-cli-walkthrough-building-power-aliases-normalizing-crlf-and-custom-diff-drivers)
6. [Comparing Configuration Scopes: System vs Global vs Local vs Worktree](#6-comparing-configuration-scopes-system-vs-global-vs-local-vs-worktree)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Line-Ending Conflicts, Binary File Bloat, and Repetitive CLI Typing

Three developer productivity bottlenecks occur in multi-platform teams:
1. **The CRLF Nightmare**: Windows developers checkout files and Git flags every line as modified due to `\r\n` vs `\n` line-ending mismatch.
2. **Binary Merge Disaster**: Git treats lockfiles (`package-lock.json`) or 3D assets as text files, generating 10,000-line unresolvable diffs.
3. **CLI Fatigue**: Typing `git log --graph --oneline --decorate --all` 50 times a day wastes hours of mental focus.

### The Configuration Solution

```text
Problem 1: OS Line Endings ──▶ Solved by `.gitattributes` (`* text=auto eol=lf`).
Problem 2: Binary / Generated Files ──▶ Solved by `.gitattributes` (`*.lock binary`).
Problem 3: Long repetitive commands ──▶ Solved by Git Aliases (`git lg`).
```

---

## 2. The Carpenter's Tool Belt and Material Tags Analogy

A craftsman operates in a specialized woodworking and glasscutting workshop.

### Master Building Codes vs Custom Holsters

```text
Global Config (`~/.gitconfig`) → The workshop building code (Your name, email, default branch name).
Git Aliases                     → Custom leather holsters on your tool belt; pulling a single strap
                                  deploys a 5-blade combination saw with one flick (`git lg`).
Git Attributes (`.gitattributes`)→ Material tag stickers on crates: "This is glass (binary);
                                  do NOT attempt to cut with wood saw; handle with suction cups."
```

### Mapping to Git Architecture

The global building code is `~/.gitconfig`; the quick-draw holsters are `[alias]`; the material tags are `.gitattributes`.

---

## 3. The Mechanism: The 3-Tier Config Hierarchy, .gitattributes, and Alias Expansion

How Git cascades configuration and filters files:

### The Configuration Precedence Cascade

$$\text{Worktree} > \text{Local } (.git/config) > \text{Global } (~/.gitconfig) > \text{System } (/etc/gitconfig)$$

### `.gitattributes` Transformation Pipeline

When checking files in (Commit) or out (Checkout), Git passes content through **smudge** and **clean** filters:
- **`clean` filter**: Strips `\r` (CR) on commit, converting everything to LF in `.git/objects/`.
- **`smudge` filter**: Converts LF to CRLF on checkout if required by the developer's OS.
- **`diff` driver**: Tells Git how to display human-readable diffs for PDFs, Word docs, or lockfiles.

---

## 4. Diagram: Git Configuration Cascading and Attribute Filter Pipeline

### Smudge & Clean Filter Architecture

```text
[Working Tree (On Disk)]                                    [.git Object Database (Repo)]
┌──────────────────────────────┐                            ┌──────────────────────────────┐
│ File with Windows CRLF (\r\n)│ ──── `clean` filter ─────▶ │ Normalized Unix LF (\n)      │
│                              │   (on `git add`)           │ (Cryptographically stable!)  │
│                              │                            │                              │
│ Clean Checkout               │ ◀─── `smudge` filter ───── │ Blob stored as pure LF       │
└──────────────────────────────┘   (on `git checkout`)      └──────────────────────────────┘
```

---

## 5. CLI Walkthrough: Building Power Aliases, Normalizing CRLF, and Custom Diff Drivers

A complete terminal masterclass configuring Git for maximum developer speed:

```bash
# 1. Inspect configuration scopes and origin
git config --list --show-origin

# 2. Configure identity and modern defaults globally
git config --global user.name "Master Developer"
git config --global user.email "dev@company.com"
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global fetch.prune true
git config --global rebase.autoStash true
git config --global core.autocrlf input

# 3. Create high-productivity Git Power Aliases
git config --global alias.st "status -s"
git config --global alias.co "checkout"
git config --global alias.br "branch"
git config --global alias.cm "commit -m"
git config --global alias.lg "log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
git config --global alias.uncommit "reset --soft HEAD~1"
git config --global alias.amend "commit --amend --no-edit"

# Test the power log alias:
# git lg -n 5

# 4. Create enterprise-grade .gitattributes in repository root
cat << 'EOF' > .gitattributes
# Auto-detect text files and normalize line endings to LF in repository
* text=auto eol=lf

# Explicit text files
*.js text eol=lf
*.ts text eol=lf
*.json text eol=lf
*.md text eol=lf

# Treat generated files and lockfiles as binary to avoid unresolvable diffs
package-lock.json binary
pnpm-lock.yaml binary

# Treat binary images and documents
*.png binary
*.jpg binary
*.pdf binary
EOF

# 5. Renormalize all existing repository files according to .gitattributes
git add --renormalize .
git commit -m "chore: enforce LF line endings via .gitattributes"
```

---

## 6. Comparing Configuration Scopes: System vs Global vs Local vs Worktree

| Scope | Configuration File Location | Scope of Effect | Precedence Order |
|---|---|---|---|
| `--system` | `/etc/gitconfig` | All users on OS | Lowest (4th) |
| `--global` | `~/.gitconfig` (or `~/.config/git/config`) | Current user's repositories | 3rd |
| `--local` | `.git/config` | Single repository only | 2nd |
| `--worktree`| `.git/config.worktree` | Specific linked worktree only| **Highest (1st)** |

---

## 7. Common Mistakes

- **Setting `core.autocrlf true` on Linux/macOS.** Corrupts line endings; macOS/Linux should use `core.autocrlf input` or rely on `.gitattributes`.
- **Not committing `.gitattributes` to the repository.** `.gitattributes` must be checked in so all team members and CI runners share the exact same rules.
- **Forgetting `--renormalize` after adding `.gitattributes`.** Git does not retroactively rewrite existing committed blobs unless `git add --renormalize .` is executed.
- **Hardcoding non-portable absolute paths in Git aliases.** Aliases should use portable commands or `!sh -c` syntax.
- **Editing `/etc/gitconfig` without root permissions.** Use `--global` for user configuration instead of system-wide files.

---

## 8. Hands-On Exercises

**Exercise 1:** Set up global Git aliases for `git st`, `git lg`, and `git uncommit`.

**Exercise 2:** Create a `.gitattributes` file normalizing all text files to LF and mark `*.png` as binary.

**Exercise 3:** Execute `git add --renormalize .` to audit and clean line endings in an active repo.

**Exercise 4:** Inspect effective configuration values across all scopes with `git config --list --show-origin`.

**Exercise 5:** Create a shell-level alias in Git that executes an external bash pipeline using the `!` prefix (e.g. `alias.root = "!pwd"`).

---

## 9. Interview Q&A

**Q: What is the configuration precedence hierarchy in Git?**
Git reads configuration in a 4-tier cascading hierarchy where more specific settings override broader settings:
1. **Worktree** (`.git/config.worktree`): Highest priority.
2. **Local Repository** (`.git/config`).
3. **Global User** (`~/.gitconfig` or `~/.config/git/config`).
4. **System** (`/etc/gitconfig`): Lowest priority.

**Q: Why is `.gitattributes` superior to `core.autocrlf` for managing line endings?**
`core.autocrlf` is a machine-local configuration setting that relies on every individual developer configuring their laptop correctly. In contrast, `.gitattributes` is a version-controlled file stored inside the repository root, ensuring that line-ending normalization (`eol=lf`), diff behaviors, and binary designations are enforced identically across all developers, operating systems, and CI/CD builders.

**Q: What do the `clean` and `smudge` attribute filters do during Git operations?**
- **The `clean` filter** runs when files are staged (`git add`). It strips carriage returns (`\r`) or scrubs sensitive tokens before storing the content as a blob object in the `.git` database.
- **The `smudge` filter** runs when files are checked out to the working directory. It injects OS-specific line endings or expands keyword placeholders for local disk consumption.

**Q: How do you define a Git alias that executes an arbitrary shell command?**
Prefix the alias definition with an exclamation mark (`!`). For example:
`git config --global alias.prune-local "!git branch --merged | grep -v '\*' | xargs -n 1 git branch -d"`.

**Q: What is the purpose of `git add --renormalize .`?**
When `.gitattributes` is updated to enforce line ending rules, Git does not automatically re-examine already-indexed files. `git add --renormalize .` forces Git to re-evaluate every tracked file against the current `.gitattributes` clean filter, staging corrected LF blobs for all modified files in a single commit.
