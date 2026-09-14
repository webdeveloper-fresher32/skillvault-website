# Git Bisect and Log Grep Debugging — Complete Guide

> "An electrical engineer troubleshooting a 100-mile underground high-voltage power cable does not dig up every single foot of earth; they test the midpoint at mile 50 to see which half has voltage, cutting the search area in half with every test until the exact severed wire is pinpointed."

---

## Table of Contents

1. [The Problem: Hunting Elusive Regression Bugs Across 500 Historical Commits](#1-the-problem-hunting-elusive-regression-bugs-across-500-historical-commits)
2. [The Power Line Fault-Locator Analogy](#2-the-power-line-fault-locator-analogy)
3. [The Mechanism: Binary Search with git bisect and Pickaxe Code Forensics](#3-the-mechanism-binary-search-with-git-bisect-and-pickaxe-code-forensics)
4. [Diagram: The Binary Search Halving Algorithm of git bisect](#4-diagram-the-binary-search-halving-algorithm-of-git-bisect)
5. [CLI Walkthrough: Automating Bug Isolation with git bisect run and git log -S](#5-cli-walkthrough-automating-bug-isolation-with-git-bisect-run-and-git-log--s)
6. [Comparing git bisect vs git log -S (Pickaxe) vs git blame](#6-comparing-git-bisect-vs-git-log--s-pickaxe-vs-git-blame)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Hunting Elusive Regression Bugs Across 500 Historical Commits

A customer reports that file exports are failing in production. The feature worked perfectly in `v1.0` (6 months ago, 800 commits ago), but is broken in `v2.0`. Manually checking out and testing each of the 800 commits one-by-one would take 3 full days of developer time.

### The Linear Search Nightmare

```text
Linear Search: Test Commit 1 ──▶ Test Commit 2 ──▶ ... ──▶ Test Commit 800 (800 manual test cycles!).
Binary Search (`git bisect`):
  Step 1: Test commit 400 (Broken? Go left).
  Step 2: Test commit 200 (Clean? Go right).
  Step 3: Test commit 300 ...
  Total Steps: $\log_2(800) \approx 10$ steps! (From 3 days down to 4 minutes!).
```

### The Solution: `git bisect` and Pickaxe (`git log -S`)

`git bisect` uses logarithmic binary search to find the exact commit that introduced a regression, while `git log -S` (Pickaxe) searches commit history for changes that altered the occurrence count of a specific code string.

---

## 2. The Power Line Fault-Locator Analogy

A power grid failure occurs between City A and City B along a 1,000-mile transmission line.

### Digging the Entire Trench vs Halfway Voltage Metering

```text
Linear Excavation → Digging up all 1,000 miles with a shovel (Exhausting, impossible).
Halfway Testing   → Measure substation voltage at Mile 500: Voltage is normal! (Fault must be in 501-1000).
                    Measure voltage at Mile 750: No voltage! (Fault must be in 501-750).
                    In 10 measurements, pinpoint the exact utility pole lightning strike!
```

### Mapping to Git Architecture

The 1,000-mile cable is the 1,000-commit Git history; City A is `good`; City B is `bad`; the voltage meter test is your test script.

---

## 3. The Mechanism: Binary Search with git bisect and Pickaxe Code Forensics

How Git's search and bisect engines operate:

### The `git bisect` Binary Search Engine

1. **Initialize Session**: `git bisect start`.
2. **Mark Boundaries**: `git bisect bad` (current broken state) and `git bisect good <commit/tag>` (known working state).
3. **Automated Midpoint Checkout**: Git automatically calculates the midpoint commit in the DAG and checks it out in detached HEAD state.
4. **Test & Report**: Mark `git bisect good` or `git bisect bad`.
5. **Full Automation**: `git bisect run <test_script.sh>` automatically runs your test suite on every midpoint and prints the culprit commit SHA in seconds!

### Code Archaeology with Pickaxe (`git log -S` and `-G`)

- **`git log -S "<string>"` (Pickaxe)**: Finds commits where the number of occurrences of `<string>` increased or decreased (filters out moves and renames).
- **`git log -G "<regex>"`**: Searches the text diffs of commits for regex matches.
- **`git log -L <start>,<end>:<file>`**: Traces the complete evolutionary history of a specific range of lines.

---

## 4. Diagram: The Binary Search Halving Algorithm of git bisect

### Logarithmic Search DAG

```text
Known Good (v1.0)                                                     Known Bad (HEAD)
      C1 ──── C2 ──── C3 ──── C4 ──── C5 ──── C6 ──── C7 ──── C8 ──── C9
                                      │
                                      ▼ Step 1: Git checks out C5 (Midpoint)
                                [Test C5: BAD] ──▶ Search space halved to C1..C5!
                                      │
                                      ▼ Step 2: Git checks out C3 (Midpoint)
                                [Test C3: GOOD] ──▶ Search space halved to C3..C5!
                                      │
                                      ▼ Step 3: Git checks out C4
                                [Test C4: BAD] ──▶ C4 IS THE CULPRIT COMMIT!
```

---

## 5. CLI Walkthrough: Automating Bug Isolation with git bisect run and git log -S

A complete terminal lab demonstrating manual bisect, script automation, and Pickaxe search:

```bash
# 1. Initialize playground repository
mkdir bisect_lab && cd bisect_lab
git init

# 2. Baseline good commit
cat << 'EOF' > math.js
function calculateTotal(price, tax) {
  return price + (price * tax);
}
EOF
git add math.js
git commit -m "feat: initial working math calculation"
git tag v1.0

# 3. Create 8 intermediate commits, introducing a bug on commit 4
for i in {1..3}; do
  echo "// feature update $i" >> math.js
  git commit -am "chore: cosmetic update $i"
done

# Bug introduced: (tax formula corrupted)
cat << 'EOF' > math.js
function calculateTotal(price, tax) {
  return price - (price * tax); // BUG! Subtraction instead of addition!
}
EOF
git commit -am "feat(math): optimize calculation formula" # Culprit commit!

for i in {5..8}; do
  echo "// feature update $i" >> math.js
  git commit -am "chore: cosmetic update $i"
done

# 4. Automated Bug Hunting with `git bisect run`!
# Create automated test script:
cat << 'EOF' > test.sh
#!/bin/bash
node -e '
  const fs = require("fs");
  const code = fs.readFileSync("math.js", "utf8");
  eval(code);
  if (calculateTotal(100, 0.1) !== 110) {
    process.exit(1); // Exit code 1 = BAD
  }
  process.exit(0);   // Exit code 0 = GOOD
'
EOF
chmod +x test.sh

# 5. Launch automated bisect!
git bisect start
git bisect bad HEAD
git bisect good v1.0
git bisect run ./test.sh
# Output:
# 6019a8b is the first bad commit
# commit 6019a8b1...
# Author: Developer
# feat(math): optimize calculation formula

# 6. End session and return to original branch
git bisect reset

# 7. Search commit history with Pickaxe (-S) for the calculation formula
git log -S "price - (price * tax)" --oneline
# Pinpoints the exact commit that introduced the subtraction string!
```

---

## 6. Comparing git bisect vs git log -S (Pickaxe) vs git blame

| Tool | When to Use | Search Method | Automated? |
|---|---|---|---|
| **`git bisect`** | Runtime/logic regressions with unknown cause | Binary search across commit DAG | Yes (`git bisect run <script>`) |
| **`git log -S` (Pickaxe)** | Finding when a known symbol/function was added or removed | Scans diff hunk token counts | No (Instant search filter) |
| **`git log -G`** | Finding commits matching complex regex patterns | Scans diff text lines | No |
| **`git blame`** | Finding author and commit for currently existing lines | Reverse file annotation | No |
| **`git log -L`** | Tracing line-range evolution over time | Line-tracking diff engine | No |

---

## 7. Common Mistakes

- **Forgetting `git bisect reset`.** Leaving the repository in detached bisect state locks `HEAD` and leaves bisect metadata in `.git/BISECT_*`.
- **Exit code conventions in `git bisect run`.** The test script must return `0` for good, `1-127` (except 125) for bad, and `125` to skip un-testable/broken builds.
- **Using `git log -S` when `git log -G` was needed.** `-S` only matches if the number of occurrences of the string *changes*; modifications matching a pattern without changing counts require `-G`.
- **Testing commits with compilation errors manually without skipping.** If an intermediate commit doesn't compile due to unrelated bugs, use `git bisect skip`.
- **Not committing the test script outside the repository.** If the test script is in the repo, checking out earlier commits may delete the test script; put it in `/tmp/test.sh`.

---

## 8. Hands-On Exercises

**Exercise 1:** Set up a 10-commit history with a bug in commit 5, and find it manually using `git bisect good` / `bad`.

**Exercise 2:** Write a Bash test script and execute a fully automated binary search using `git bisect run /tmp/test.sh`.

**Exercise 3:** Use `git log -S "functionName"` to locate the commit that introduced a specific helper method.

**Exercise 4:** Trace the historical changes of lines 20–40 of a core file using `git log -L 20,40:app.js`.

**Exercise 5:** Practice using `git bisect skip` when encountering a non-compiling intermediate commit during a bisect run.

---

## 9. Interview Q&A

**Q: How does `git bisect` work and what is its time complexity?**
`git bisect` uses a binary search algorithm to find the specific commit in history that introduced a bug. Given a known "good" commit and a known "bad" commit, Git repeatedly checks out the midpoint commit. The developer (or an automated script) marks the midpoint as good or bad, cutting the search space in half each iteration. Its time complexity is logarithmic: $\mathcal{O}(\log_2 N)$.

**Q: How do you completely automate a `git bisect` session?**
You provide an automated test script that returns exit code `0` when the commit is good, and non-zero (e.g. `1`) when the commit is bad. Running `git bisect run ./test.sh` instructs Git to automatically check out midpoints, execute the script, evaluate the exit code, and repeat until the first bad commit is pinpointed.

**Q: What does exit code 125 signify to `git bisect run`?**
Exit code `125` instructs Git to **skip** the current commit. This is used when the commit cannot be tested (for example, if an unrelated build break or missing third-party dependency prevents the test script from running). Git picks an adjacent commit instead.

**Q: What is the difference between `git log -S` (Pickaxe) and `git log -G`?**
- `git log -S "<string>"` looks for commits that changed the number of occurrences of `<string>` in the file (added or deleted the string). It ignores commits that simply moved or reformatted lines containing the string.
- `git log -G "<regex>"` searches all diff hunks for any line added or removed that matches the regular expression, even if the total count in the file remained identical.

**Q: What is `git log -L` and when should you use it?**
`git log -L <start>,<end>:<file>` (or `git log -L :<funcname>:<file>`) traces the entire historical evolution of a specific line range or function over time. It shows every commit and diff that ever touched that exact block of code, even through file renames.
