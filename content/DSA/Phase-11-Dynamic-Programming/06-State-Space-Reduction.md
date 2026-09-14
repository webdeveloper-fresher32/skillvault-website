# State Space Reduction

## 1. Problem

Once a DP solution is correct, a natural next question is: does it need to store everything it's currently storing? Very often, a dimension of the DP table is **redundant** — not because the recurrence doesn't logically have that dimension, but because, at any given moment, only a small slice of it is ever read. This file covers three related ideas:

- **Rolling-array reduction**: when `dp[i][...]` only ever depends on `dp[i-1][...]` (the row directly above, as in file 02's grid problems), the full 2D table can be collapsed to a single 1D array that gets overwritten in place, row by row — because once row `i-1` has been fully used to compute row `i`, row `i-1` is never needed again.
- **Bitmask DP**: for problems where the state includes "which subset of a small set of items has been used/visited," representing that subset as a single integer (a bitmask) rather than an explicit set or boolean array compresses the state dramatically and enables fast set operations via bitwise operators. This only works when the underlying set is small (roughly n <= 20), since the number of subsets is `2^n` — a technique this course revisits in more depth in **Phase 13 (Bit Manipulation)**.
- **Knowing when to stop optimizing**: in an interview setting, a correct-and-readable O(n) or O(n²)-memory solution is almost always preferable to a marginally more space-efficient version that's harder to verify or riskier to get right under time pressure. State-space reduction is a real skill, but it has a cost (readability, bug surface), and recognizing when that cost isn't worth paying is just as important as knowing the technique.

## 2. Analogy

Think of a whiteboard used to track a running relay race, where each new lap's time only depends on the previous lap's cumulative time — not on every single lap ever run. You don't need a whiteboard the size of a wall listing every lap's time forever; you just need **one line** that you erase and overwrite each time a new lap finishes, because the moment a new cumulative time is written down, the old one is no longer needed for anything. That's exactly the intuition behind rolling-array reduction: if a computation only ever needs "the immediately previous state," there's no reason to keep every state that came before it.

## 3. Internal Flow

**Converting the grid minimum-path-sum solution (file 02) into a rolling 1D array.** Recall the recurrence: `dp[i][j] = grid[i][j] + min(dp[i-1][j], dp[i][j-1])`. Looking at what this actually reads: `dp[i-1][j]` (previous row, same column) and `dp[i][j-1]` (current row, previous column, already computed earlier in this same row's pass). Neither ever reaches back further than "the row currently being built" or "the row immediately before it" — so a single 1D array `dp[j]` can serve both roles, **as long as it's updated left to right within each row**:

1. Before overwriting `dp[j]` for row `i`, its current value is still row `i-1`'s value (not yet touched this pass) — exactly what `dp[i-1][j]` would have provided.
2. `dp[j-1]` was already overwritten earlier in this same left-to-right pass, so it already holds row `i`'s value — exactly what `dp[i][j-1]` would have provided.
3. Overwrite `dp[j]` in place with the combined result — from this point on, the old (row `i-1`) value at this index is gone, which is fine, because nothing will ever ask for it again.

This is exactly a rolling array: one array, reused across every row, correct only because of the specific left-to-right update order matching the recurrence's own dependency direction.

**Bitmask DP as forward reference.** For problems like "Traveling Salesman on <= ~15-20 cities" or "assign n workers to n tasks," the DP state often needs "which cities/workers have been used so far" — instead of a `set` or `list` of booleans, this is represented as a single integer where bit `k` is `1` if item `k` has been used. Checking membership, adding an item, and removing an item all become O(1) bitwise operations (`mask & (1 << k)`, `mask | (1 << k)`, `mask & ~(1 << k)`) instead of set/list operations — and the entire mask can be used directly as a dictionary key or array index. This technique, and the underlying bitwise operators, are covered in depth in Phase 13 (Bit Manipulation) — this file only previews *why* it counts as a state-space reduction: it compresses what would otherwise be an exponential-sized explicit state (a subset) into a single machine integer that's cheap to store and compare.

**When to stop optimizing.** A useful rule of thumb: optimize the state space when (a) the naive space usage would actually exceed practical limits for the given constraints (e.g., a 2D table over 10^5 x 10^5 simply won't fit in memory, forcing a rolling array), or (b) an interviewer explicitly asks for it as a follow-up. Don't reach for state-space reduction reflexively on every DP problem — introducing an in-place, order-sensitive update scheme adds real risk of an order-of-update bug (shown below) for a savings that, on typical interview-sized inputs, rarely matters.

## 4. Example

Reusing file 02's grid minimum-path-sum example, converted to a rolling 1D array, with a demonstration of the classic order-of-update bug that arises from getting the iteration direction wrong:

```python
def min_path_sum_2d(grid):
    rows, cols = len(grid), len(grid[0])
    dp = [[0] * cols for _ in range(rows)]
    dp[0][0] = grid[0][0]
    for j in range(1, cols):
        dp[0][j] = dp[0][j - 1] + grid[0][j]
    for i in range(1, rows):
        dp[i][0] = dp[i - 1][0] + grid[i][0]
    for i in range(1, rows):
        for j in range(1, cols):
            dp[i][j] = grid[i][j] + min(dp[i - 1][j], dp[i][j - 1])
    return dp[rows - 1][cols - 1], dp


def min_path_sum_1d_rolling(grid):
    rows, cols = len(grid), len(grid[0])
    dp = [0] * cols
    dp[0] = grid[0][0]
    for j in range(1, cols):
        dp[j] = dp[j - 1] + grid[0][j]
    print(f"After row 0: dp = {dp}")

    for i in range(1, rows):
        dp[0] = dp[0] + grid[i][0]  # top-of-column carry, only left neighbor is "above"
        for j in range(1, cols):
            # dp[j] here is STILL the value from the previous row (not yet overwritten)
            # dp[j-1] here is ALREADY the value from the current row (just updated)
            dp[j] = grid[i][j] + min(dp[j], dp[j - 1])
        print(f"After row {i}: dp = {dp}")

    return dp[cols - 1]


def min_path_sum_1d_buggy_order(grid):
    """Deliberately broken: the recurrence dp[j] = grid[i][j] + min(dp[j], dp[j-1])
    relies on dp[j] still holding the PREVIOUS row's value and dp[j-1] already
    holding the CURRENT row's (freshly overwritten) value -- which only holds if
    j is iterated left-to-right. Iterating right-to-left here reads dp[j-1]
    BEFORE it has been overwritten for the current row, so it silently uses a
    stale previous-row value where a current-row value was required."""
    rows, cols = len(grid), len(grid[0])
    dp = [0] * cols
    dp[0] = grid[0][0]
    for j in range(1, cols):
        dp[j] = dp[j - 1] + grid[0][j]

    for i in range(1, rows):
        dp[0] = dp[0] + grid[i][0]
        for j in range(cols - 1, 0, -1):  # BUG: should be range(1, cols), left-to-right
            dp[j] = grid[i][j] + min(dp[j], dp[j - 1])
    return dp[cols - 1]


grid = [
    [1, 3, 1],
    [1, 5, 1],
    [4, 2, 1],
]

correct, table = min_path_sum_2d(grid)
print("2D table (from file 02):")
for row in table:
    print(row)
print(f"Correct min path sum (2D): {correct}\n")

print("1D rolling array version:")
rolling_result = min_path_sum_1d_rolling(grid)
print(f"Min path sum (1D rolling, correct): {rolling_result}\n")

print(f"Memory: 2D table stores {len(grid)} x {len(grid[0])} = {len(grid) * len(grid[0])} ints; "
      f"1D rolling array stores only {len(grid[0])} ints at any moment.\n")

buggy_result = min_path_sum_1d_buggy_order(grid)
print(f"Buggy reverse-iteration version result: {buggy_result} (correct is {correct}) -- "
      f"{'matches by luck' if buggy_result == correct else 'WRONG: read a stale previous-row value where a current-row value was required'}")
```

Actual output:

```text
2D table (from file 02):
[1, 4, 5]
[2, 7, 6]
[6, 8, 7]
Correct min path sum (2D): 7

1D rolling array version:
After row 0: dp = [1, 4, 5]
After row 1: dp = [2, 7, 6]
After row 2: dp = [6, 8, 7]
Min path sum (1D rolling, correct): 7

Memory: 2D table stores 3 x 3 = 9 ints; 1D rolling array stores only 3 ints at any moment.

Buggy reverse-iteration version result: 6 (correct is 7) -- WRONG: read a stale previous-row value where a current-row value was required
```

The correct rolling version reaches `7`, matching the full 2D table exactly, while only ever holding 3 integers in memory instead of 9 (a savings that would scale to O(cols) instead of O(rows x cols) memory on a much larger grid). The buggy version — identical except for iterating `j` from `cols - 1` down to `1` instead of `1` up to `cols - 1` — gives `6`, a wrong answer, because by the time it reads `dp[j-1]` for a given `j`, that cell hasn't been overwritten with the current row's value yet (since higher `j` indices are processed first in a reverse pass); it silently reads a stale, previous-row value in a slot where the recurrence specifically requires the current row's already-updated value. This is precisely the "incorrectly reusing the previous row's values after they've already been overwritten" family of bug — except here it's the opposite direction: reusing previous-row values that were **supposed** to have already been overwritten, but weren't yet, because the traversal direction didn't match the recurrence's dependency direction.

## 5. Compare

- **2D table (file 02) vs rolling 1D array**: identical results, identical asymptotic time complexity — the only difference is memory (O(rows x cols) vs O(cols)) and a strict new requirement that the update order inside each row exactly match the recurrence's dependency direction, since there's no separate "previous row" object to fall back on if the order is wrong.
- **Rolling array (this file) vs knapsack's reverse/forward iteration (file 03)**: both are instances of the same underlying idea — collapsing a 2D table to 1D is always safe in principle, but the specific iteration direction required depends entirely on which cells the recurrence reads relative to which cells it's about to overwrite; get that direction wrong in either context and you get a silent wrong answer, not a crash.
- **Bitmask DP vs rolling array**: rolling array reduces "how many rows of history you keep"; bitmask DP reduces "how you represent a single dimension of the state" (a subset, compressed into an integer) — both are state-space reduction, but they attack different axes of the problem and are often combined (e.g., TSP DP typically uses both a bitmask for "visited cities" and a rolling structure for "current city").

## 6. Common Mistakes

- **Incorrectly reusing the previous row's values after they've already been overwritten in-place.** As demonstrated above, if the iteration direction inside a row doesn't match what the recurrence actually needs, some reads will silently get "already this row's value" when "still previous row's value" was required, or vice versa — this is an order-of-update bug, and it does not raise any error; it just produces a wrong number.
- **Over-optimizing state in an interview setting at the cost of correctness.** Interviewers generally prefer a correct, clearly-reasoned O(n²)-space solution over a marginally more space-efficient O(n)-space one that introduces a subtle bug under time pressure — announcing "I could reduce this to O(n) space with a rolling array, but let me first get the 2D version correct" is a stronger interview signal than jumping straight to the optimized (and riskier) version.
- **Applying rolling-array reduction to a recurrence that doesn't actually support it.** If a cell's dependency reaches back more than one row (e.g., `dp[i-2][j]`, not just `dp[i-1][j]`), a single rolling array isn't enough — you'd need to keep the last **two** rows, not one; assuming "1D is always enough" without checking the actual dependency distance is a common mistake.
- **Reaching for bitmask DP on a state space that's too large.** Bitmask DP relies on `2^n` being small enough to enumerate or index into an array/dict — applying it reflexively to an `n` of, say, 40 or more produces a state space far too large to be practical, and signals a misunderstanding of *why* the technique works only for small `n` (this is elaborated further in Phase 13).

## 7. Interview Angle

State-space reduction is a common **follow-up** question ("can you do this with less memory?") rather than something expected unprompted in a first pass — interviewers want to see the correct baseline solution first, then a clear explanation of *which* dimension is redundant and *why*, before touching the code. A strong answer explicitly names the dependency distance ("this only ever needs the immediately previous row, so I can roll it into 1D") rather than just reciting "I'll use a 1D array" without justification. When bitmask DP comes up (typically for small-`n` combinatorial problems), naming the `n <= ~20` practical ceiling and explaining it in terms of `2^n` growth demonstrates that the technique is understood as a deliberate trade rather than a memorized trick. Being willing to say "I could optimize this further, but I think the current version is clearer and the savings aren't worth the added risk here" is itself a valued signal — it shows judgment about when optimization is and isn't worth pursuing, not just the ability to perform it.

## 8. Memory Hook

**"Only roll what you actually still need — and know when rolling isn't worth the risk."** Before collapsing a dimension, check exactly how far back the recurrence reaches (one row back? two?) and match your update order to that dependency exactly — and remember that in an interview, a correct, readable 2D solution beats a broken, "optimized" 1D one every time.
