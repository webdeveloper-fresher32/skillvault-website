# DP Fundamentals: 1D DP

## 1. Problem

Back in `DSA/Phase-01-Complexity-and-Foundations/03-Recursion-Basics.md`, naive recursive Fibonacci was used to show how recursion can blow up: `fib(20)` alone took 21,891 calls, and the reason was plain once you looked at the call tree — `fib(2)` gets recomputed three separate times just within `fib(5)`, and that duplication compounds exponentially as `n` grows. That lesson ended by naming the fix without showing it: **memoization and Dynamic Programming**. This lesson delivers that fix.

Dynamic Programming (DP) is not a new algorithm technique so much as a discipline for exploiting two properties a problem might have:

- **Overlapping subproblems** — the same smaller sub-computation is needed multiple times (exactly what naive Fibonacci exhibited).
- **Optimal substructure** — the optimal (or correct) answer to the full problem can be built directly from optimal answers to its subproblems, with no need to reconsider decisions once made.

When both properties hold, you can compute each distinct subproblem **exactly once**, cache (or table) the result, and reuse it instead of recomputing it — collapsing exponential-time recursion down to polynomial, often linear, time. 1D DP is the simplest setting to see this: the "state" that identifies a subproblem is just a single integer index (e.g., "the answer for step `n`"), and climbing-stairs / Fibonacci-style recurrences are the canonical examples because the recurrence is short enough to keep the *method* — not the math — in focus.

## 2. Analogy

Imagine you're filling out a long form where question 12 asks you to reuse your answer from question 7, and question 20 asks you to reuse your answers from both question 12 and question 15. If you literally re-derive your question-7 answer from scratch every time it's referenced (recomputing it inside question 12, and again inside question 20 by way of question 12), you waste enormous effort re-deriving the same thing repeatedly. The obvious fix: write each answer down in the margin the first time you compute it, and every later question that needs it just reads the margin note instead of redoing the work. That margin note is exactly what a memo cache (top-down) or a DP table (bottom-up) is — a place to permanently record "the answer to subproblem `k`" so it is computed once and read many times after that.

## 3. Internal Flow

There are two mirror-image ways to apply this "write it down once" idea:

**Top-down (memoization).** Keep the natural recursive structure, but before recursing, check a cache (dict or array) for whether this subproblem has already been solved. If yes, return the cached value immediately — no recursive calls at all. If no, compute it recursively as before, but store the result in the cache before returning. This turns the call tree from a tree (with repeated branches) into effectively a graph traversal where every distinct node is visited once.

**Bottom-up (tabulation).** Flip the direction entirely: start from the base case(s) and iteratively build up a table (`dp[0], dp[1], ..., dp[n]`) in order of increasing subproblem size, where `dp[i]` is derived from already-computed `dp[i-1]`, `dp[i-2]`, etc. There is no recursion at all — just a loop filling in a table left to right, guaranteeing that by the time `dp[i]` is computed, everything it depends on already has a final value sitting in the table.

Both approaches solve the exact same set of subproblems exactly once; the difference is direction (recursive top-down vs iterative bottom-up) and whether every subproblem gets solved (top-down only solves the ones actually needed for the top-level query, bottom-up solves all of them up to `n` even if some aren't strictly necessary).

**Step-by-step for `fib(5)`, top-down with a cache:**
1. `fib(5)` isn't cached, so it recurses into `fib(4)` and `fib(3)`.
2. `fib(4)` isn't cached, recurses into `fib(3)` and `fib(2)`.
3. `fib(3)` isn't cached (first encounter), computes and caches `fib(3) = 2`.
4. Back in `fib(4)`: needs `fib(2)`, not cached, computes and caches `fib(2) = 1`. `fib(4) = 2 + 1 = 3`, cached.
5. Back in `fib(5)`: needs `fib(3)` — **already cached from step 3** — returned instantly with zero further recursion.
6. `fib(5) = fib(4) + fib(3) = 3 + 2 = 5`.

Notice `fib(3)` was computed exactly once and reused, instead of being recomputed from scratch the way naive recursion would.

**Step-by-step for `fib(5)`, bottom-up:**
1. Base cases: `dp[0] = 0`, `dp[1] = 1`.
2. `dp[2] = dp[1] + dp[0] = 1`.
3. `dp[3] = dp[2] + dp[1] = 2`.
4. `dp[4] = dp[3] + dp[2] = 3`.
5. `dp[5] = dp[4] + dp[3] = 5`.

Five simple loop iterations, no recursion, no call stack growth at all.

## 4. Example

All three variants — naive recursive, memoized top-down, and bottom-up tabulated — implemented and run side by side, with call counts tracked to make the improvement concrete rather than asserted:

```python
call_count = 0

def fib_naive(n):
    global call_count
    call_count += 1
    if n <= 1:
        return n
    return fib_naive(n - 1) + fib_naive(n - 2)

for n in (5, 10, 20, 30):
    call_count = 0
    result = fib_naive(n)
    print(f"fib_naive({n}) = {result}, calls = {call_count}")

print()

memo_calls = 0

def fib_memo(n, memo=None):
    global memo_calls
    memo_calls += 1
    if memo is None:
        memo = {}
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib_memo(n - 1, memo) + fib_memo(n - 2, memo)
    return memo[n]

for n in (5, 10, 20, 30):
    memo_calls = 0
    result = fib_memo(n)
    print(f"fib_memo({n}) = {result}, calls = {memo_calls}")

print()

tab_steps = 0

def fib_tab(n):
    global tab_steps
    if n <= 1:
        return n
    dp = [0] * (n + 1)
    dp[0], dp[1] = 0, 1
    for i in range(2, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
        tab_steps += 1
    return dp[n]

for n in (5, 10, 20, 30):
    tab_steps = 0
    result = fib_tab(n)
    print(f"fib_tab({n}) = {result}, loop iterations = {tab_steps}")
```

Actual output:

```text
fib_naive(5) = 5, calls = 15
fib_naive(10) = 55, calls = 177
fib_naive(20) = 6765, calls = 21891
fib_naive(30) = 832040, calls = 2692537

fib_memo(5) = 5, calls = 9
fib_memo(10) = 55, calls = 19
fib_memo(20) = 6765, calls = 39
fib_memo(30) = 832040, calls = 59

fib_tab(5) = 5, loop iterations = 4
fib_tab(10) = 55, loop iterations = 9
fib_tab(20) = 6765, loop iterations = 19
fib_tab(30) = 832040, loop iterations = 29
```

Look at how the three scale with `n = 30`: naive recursion takes **2,692,537 calls** (exponential — roughly doubling-ish per step of `n`), memoized top-down takes **59 calls** (linear — almost exactly `2n - 1`, since each `fib(k)` for `k` from `2` to `n` is computed once, plus a small constant of lookup calls), and bottom-up takes **29 loop iterations** (linear, `n - 1`, with no recursion overhead at all). Naive recursion is O(2^n) time; both memoized and tabulated versions are O(n) time and O(n) space (or O(1) space for tabulation if you only keep the last two values instead of the whole table — a state-space reduction covered in file 06 of this phase).

## 5. Compare

- **Top-down vs bottom-up**: top-down keeps the original recursive structure (often easier to derive directly from the problem statement) and only computes subproblems that are actually reachable from the top query; bottom-up requires reformulating the recursion as a forward iteration order, but avoids recursion-depth limits entirely and is usually a little faster in practice due to no function-call overhead.
- **Recursion (Phase 1) vs DP**: DP doesn't replace recursion — memoized top-down DP *is* recursion, just recursion with a cache. What DP adds on top of recursion is the caching discipline that specifically targets the "recomputing overlapping subproblems" pain point flagged in `03-Recursion-Basics.md`.
- **1D DP vs multi-dimensional DP**: this lesson's state is a single index (`n`). Later files in this phase extend the same top-down/bottom-up ideas to states with two dimensions (grid position, or "item index and remaining capacity") — the caching discipline is identical, only the shape of the table changes.

## 6. Common Mistakes

- **Memoizing with a mutable default argument.** `def fib_memo(n, memo={}):` looks convenient, but Python evaluates default argument values **once**, at function-definition time — every call that doesn't explicitly pass `memo` shares the exact same dict object across every future call, including logically unrelated ones. This can silently leak stale cached values between calls that should be independent. The safe pattern is `memo=None` with `if memo is None: memo = {}` inside the function, so a fresh cache is created per top-level call.
- **Forgetting the base cases when converting top-down to bottom-up.** Top-down recursion "just returns" on the base case naturally; a bottom-up table must have its base-case cells (`dp[0]`, `dp[1]`, etc.) explicitly initialized *before* the main loop runs, or the loop will read uninitialized/garbage values (or raise an index error) the first time it tries to reference them.
- **Off-by-one in loop bounds when tabulating.** Filling `range(2, n)` instead of `range(2, n + 1)` (or vice versa) silently leaves `dp[n]` at its initial placeholder value instead of the real answer — a very easy mistake since the natural "count from 0 to n inclusive" boundary trips up `range`'s exclusive upper bound.
- **Assuming memoization always yields the same complexity gain.** Memoization only helps if subproblems actually overlap; if a recursive problem's subproblems are already all distinct (no repeated state), adding a cache adds bookkeeping overhead without ever getting a cache hit.
- **Confusing "cache exists" with "cache is being used correctly".** A syntactically-present `memo` dict that's checked with `if n in memo` — but the corresponding recursive call sites never *pass* that same `memo` down — silently defeats the whole point; every recursive call still starts a subproblem search from scratch.

## 7. Interview Angle

DP problems are frequently introduced as "can you optimize this recursive solution?" — a direct callback to whatever naive recursive approach you wrote first. Interviewers expect you to (a) identify that subproblems repeat (usually by sketching the call tree, exactly as done in `03-Recursion-Basics.md`), (b) state the recurrence relation explicitly (e.g., `f(n) = f(n-1) + f(n-2)`), and (c) implement either memoized top-down or tabulated bottom-up cleanly. A common follow-up is "can you do this with O(1) space instead of O(n)?" for 1D problems like Fibonacci or climbing stairs — since only the last two values are ever needed, the full table can be dropped in favor of two rolling variables (a preview of the state-space reduction theme in file 06). Another common question: "why is memoized recursion still considered O(n) despite looking recursive?" — the expected answer is that each distinct subproblem is computed exactly once, and the total number of distinct subproblems is O(n), so total work across all calls (counting cache hits as O(1)) is O(n).

## 8. Memory Hook

**"Write it down once, read it forever after."** Whether you write the answer down on your way *into* the recursion (top-down memo) or build it up systematically from the ground *before* you need it (bottom-up table), the entire trick of 1D DP is refusing to solve the same subproblem twice.
