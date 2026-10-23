# Client-Side and Server-Side Git Hooks — Complete Guide

> "A security checkpoint at an international airport checks passengers' boarding passes before they enter the terminal gate (Client-Side Pre-Commit), while border customs officers inspect passports against the central government blacklist before letting anyone step onto the tarmac (Server-Side Pre-Receive)."

---

## Table of Contents

1. [The Problem: Enforcing Code Quality and Security Standards Automatically](#1-the-problem-enforcing-code-quality-and-security-standards-automatically)
2. [The Airport Security Gates and Border Customs Analogy](#2-the-airport-security-gates-and-border-customs-analogy)
3. [The Mechanism: Git Hook Lifecycle Execution and Exit Codes](#3-the-mechanism-git-hook-lifecycle-execution-and-exit-codes)
4. [Diagram: Client-Side vs Server-Side Git Hook Pipeline](#4-diagram-client-side-vs-server-side-git-hook-pipeline)
5. [CLI Walkthrough: Writing Secret-Scanning Pre-Commit and Conventional Commit-Msg Hooks](#5-cli-walkthrough-writing-secret-scanning-pre-commit-and-conventional-commit-msg-hooks)
6. [Comparing Client-Side vs Server-Side Hooks](#6-comparing-client-side-vs-server-side-hooks)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Enforcing Code Quality and Security Standards Automatically

Relying on human vigilance to catch lint errors, failing unit tests, exposed AWS secret keys, or malformed commit messages in code reviews is guaranteed to fail.

### The Human Error Breakdown

```text
Mistake 1: Developer accidentally commits `AWS_SECRET_KEY = "AKIA..."` in `app.js`.
Mistake 2: Developer writes commit message: `"fixed stuff"` violating semantic release automation.
Mistake 3: Broken TypeScript syntax gets pushed to main, breaking CI for 40 engineers.
```

### The Solution: Automated Git Lifecycle Hooks

Git provides built-in event-driven script hooks located in `.git/hooks/` (or configured via `core.hooksPath` / Husky) that execute at critical stages (`pre-commit`, `commit-msg`, `pre-push`, `pre-receive`) to intercept and abort invalid operations before they contaminate history.

---

## 2. The Airport Security Gates and Border Customs Analogy

An airline enforces flight regulations using two distinct checkpoints.

### Passenger Checkpoint vs Border Control

```text
Pre-Commit Hook (Metal Detector) → Beeps immediately if you carry scissors in your pocket;
                                   you step back to your car and put scissors away (Fast, local feedback).

Pre-Receive Hook (Border Customs) → Server scans passport against no-fly database;
                                   if rejected, you cannot board the aircraft (Centralized, un-bypassable).
```

### Mapping to Git Architecture

The metal detector is your local `pre-commit` hook; the passport control server is GitHub Enterprise's `pre-receive` hook.

---

## 3. The Mechanism: Git Hook Lifecycle Execution and Exit Codes

Git hooks are simple executable scripts (Bash, Python, Node.js) that communicate with Git via **Exit Codes**:
- **Exit Code `0`**: Success! Git continues the operation.
- **Non-Zero Exit Code (`1-255`)**: Failure! Git immediately **aborts** the commit, rebase, or push.

### The 4 Core Hook Types

1. **`pre-commit`**: Runs *before* the commit message prompt is shown. Used for linting, formatting (Prettier), and secret scanning.
2. **`commit-msg`**: Receives the path to the temporary commit message file (`$1`). Used to enforce Conventional Commits.
3. **`pre-push`**: Runs during `git push`. Used to run fast integration tests before uploading code.
4. **`pre-receive`**: Server-side hook. Runs on the central Git server to validate branch policies, enforce signed commits, or reject oversized files.

---

## 4. Diagram: Client-Side vs Server-Side Git Hook Pipeline

### Git Hook Execution Lifecycle

```text
[Developer Machine (Client-Side)]
  1. `git commit`
        │
        ▼
  [pre-commit hook] ──(Exit != 0)──▶ ABORT (Lint error / Secret detected!)
        │ (Exit 0)
        ▼
  [commit-msg hook] ──(Exit != 0)──▶ ABORT (Invalid Conventional Commit format!)
        │ (Exit 0)
        ▼
  Commit Created!
        │
  2. `git push origin main`
        │
        ▼
  [pre-push hook]   ──(Exit != 0)──▶ ABORT (Local test suite failed!)
        │ (Exit 0)
        ▼
[Network Transfer] ─────────────────────────────────────────────────────────────┐
                                                                                │
[Central Git Server (Server-Side)]                                              ▼
  [pre-receive hook] ─────────(Exit != 0)─────────▶ REJECT PUSH (GPG unsigned!) │
        │ (Exit 0)                                                              │
        ▼                                                                       │
  [post-receive hook] ──▶ Trigger CI/CD Webhooks & Slack Notifications          │
```

---

## 5. CLI Walkthrough: Writing Secret-Scanning Pre-Commit and Conventional Commit-Msg Hooks

A complete hands-on terminal guide creating robust Git hooks:

```bash
# 1. Initialize playground repository
mkdir hooks_lab && cd hooks_lab
git init

# 2. Configure team-shared hooks directory (version-controlled!)
mkdir .githooks
git config core.hooksPath .githooks

# 3. Create Secret-Scanning `pre-commit` Hook
cat << 'EOF' > .githooks/pre-commit
#!/usr/bin/env bash
set -e

echo "🔍 [Hook] Running pre-commit secret scanning..."

# Scan staged changes for common AWS key patterns or private keys
if git diff --cached | grep -E -q '(AKIA[0-9A-Z]{16}|BEGIN PRIVATE KEY)'; then
    echo "❌ [SECURITY ALERT] Potential secret or private key detected in staged diff!"
    echo "Commit aborted. Please remove sensitive keys before committing."
    exit 1
fi

echo "✅ [Hook] Secret scan clean!"
exit 0
EOF
chmod +x .githooks/pre-commit

# 4. Create Conventional Commits `commit-msg` Hook
cat << 'EOF' > .githooks/commit-msg
#!/usr/bin/env bash
set -e

MSG_FILE="$1"
COMMIT_MSG=$(cat "$MSG_FILE")

echo "📝 [Hook] Validating commit message format..."

CONVENTIONAL_REGEX="^(feat|fix|docs|style|refactor|perf|test|chore|ci)(\([a-z0-9_-]+\))?: .+"

if ! echo "$COMMIT_MSG" | grep -E -q "$CONVENTIONAL_REGEX"; then
    echo "❌ [ERROR] Invalid commit message format!"
    echo "Commit message must follow Conventional Commits standard:"
    echo "  Example: feat(auth): add JWT token validation"
    echo "  Example: fix(core): resolve null pointer in user service"
    exit 1
fi

echo "✅ [Hook] Commit message valid!"
exit 0
EOF
chmod +x .githooks/commit-msg

# 5. Test Pre-Commit Hook (Simulate secret leak!)
echo "AWS_KEY = AKIAIOSFODNN7EXAMPLE" > keys.js
git add keys.js
git commit -m "feat: add keys"
# Output:
# 🔍 [Hook] Running pre-commit secret scanning...
# ❌ [SECURITY ALERT] Potential secret detected! Commit aborted!

# 6. Fix secret and test Commit-Msg validation
echo "const apiKey = process.env.API_KEY;" > keys.js
git add keys.js

# Test invalid message:
git commit -m "bad message"
# Output:
# ❌ [ERROR] Invalid commit message format!

# Test valid message:
git commit -m "feat(config): support dynamic API key from environment"
# Output:
# 🔍 [Hook] Running pre-commit secret scanning...
# ✅ [Hook] Secret scan clean!
# 📝 [Hook] Validating commit message format...
# ✅ [Hook] Commit message valid!
# [main 5f91a2b] feat(config): support dynamic API key from environment
```

---

## 6. Comparing Client-Side vs Server-Side Hooks

| Metric | Client-Side Hooks (`.githooks/`) | Server-Side Hooks (`pre-receive`) |
|---|---|---|
| Execution Location | Developer's local laptop | Central Git server (GitHub Enterprise) |
| Bypassable? | Yes (`git commit --no-verify`) | **No (Strictly un-bypassable)** |
| Shared Automatically?| Requires `core.hooksPath` / Husky | Centrally deployed on server |
| Primary Purpose | Fast feedback (Linting, Formatting) | Policy enforcement, Security, Compliance |
| Triggers | `pre-commit`, `commit-msg`, `pre-push` | `pre-receive`, `update`, `post-receive` |

---

## 7. Common Mistakes

- **Forgetting to make hook scripts executable (`chmod +x`).** Git silently ignores hook files that lack executable permissions.
- **Assuming `.git/hooks/` is copied on `git clone`.** Git deliberately ignores `.git/hooks` during clones for security; use `core.hooksPath` or Husky.
- **Overloading `pre-commit` with 10-minute test suites.** Slow hooks frustrate developers, encouraging them to bypass hooks with `--no-verify`.
- **Using `--no-verify` to bypass broken hooks.** Hides underlying build failures that fail later in CI pipelines.
- **Writing non-portable hook scripts.** Using OS-specific Bash syntax that breaks on Windows developer machines; use Node/Python or cross-platform sh.

---

## 8. Hands-On Exercises

**Exercise 1:** Configure your repository to use a custom version-controlled hooks directory using `git config core.hooksPath .githooks`.

**Exercise 2:** Write a `pre-commit` hook that runs `npm run lint` or `pytest` before allowing commits.

**Exercise 3:** Write a `commit-msg` hook that enforces minimum message length (at least 15 characters).

**Exercise 4:** Write a `pre-push` hook that prevents pushing directly to the `main` branch from a local checkout.

**Exercise 5:** Bypass a hook intentionally for an emergency hotfix using `git commit --no-verify` and inspect the git log.

---

## 9. Interview Q&A

**Q: What are Git Hooks and how does Git determine whether an action should proceed or abort?**
Git hooks are custom executable scripts triggered automatically by Git when specific lifecycle events occur (such as committing, rebasing, or pushing). Git evaluates the script's exit status code: an exit code of `0` allows the Git command to proceed, while any non-zero exit code (`1-255`) halts the operation immediately.

**Q: Why does Git not version-control the `.git/hooks/` directory by default?**
For security reasons. If Git automatically executed hooks cloned from arbitrary remote repositories, an attacker could inject malicious shell scripts into a repository that would execute with the developer's permissions immediately upon running `git commit` or `git checkout`.

**Q: How can engineering teams version-control and distribute client-side Git hooks safely?**
Teams store hook scripts inside a version-controlled repository folder (such as `.githooks/`) and configure Git to use that folder by running `git config core.hooksPath .githooks`, or by using package-level hook managers like Husky, Lefthook, or `pre-commit` (Python).

**Q: What is the `--no-verify` flag and which Git hooks does it bypass?**
The `--no-verify` (or `-n`) flag bypasses client-side verification hooks (`pre-commit` and `commit-msg`). It allows developers to force a commit through without running local linter or formatting checks, though it cannot bypass server-side hooks (`pre-receive`).

**Q: What is the role of the server-side `pre-receive` hook?**
A `pre-receive` hook executes on the central Git remote repository when a push is received, before any references are updated. It inspects all pushed commit objects, branches, and tags, enforcing organization-wide policies (e.g. mandatory GPG signatures, blocking secret keys, or rejecting files > 50MB) across all developers without relying on local machine compliance.
