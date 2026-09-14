# Backtracking Fundamentals: N-Queens

## 1. Problem

Given an `N x N` chessboard, place `N` queens on it such that **no two queens attack each other** — meaning no two queens share a row, a column, or a diagonal. Report all valid arrangements (or just one, depending on what's asked).

The brute-force instinct is to generate every possible placement of `N` queens on `N^2` squares and filter out the invalid ones — but that's astronomically wasteful (choosing `N` squares out of `N^2` blows up combinatorially, and the vast majority of placements are invalid). The problem is a canonical vehicle for teaching **backtracking**: a systematic way of exploring a decision tree — one queen (one row) at a time — where you check validity *as you go*, so that entire invalid branches of the search are abandoned the instant they become impossible, long before you'd ever reach a full (invalid) placement.

## 2. Analogy

Think of packing a suitcase one item at a time, checking after every item whether it still zips shut. You don't throw in all your clothes and then see if the suitcase closes (generate-then-filter) — you add one item, try the zipper, and if it doesn't close, you take that item back out and try a different one *before* adding anything else. Backtracking on N-Queens works the same way: place one queen (choose), see if the board is still consistent, keep going if it is (explore), and if a placement makes the board unsalvageable, physically remove that queen (unchoose) before trying the next square. The suitcase is never zipped shut with fingers crossed — it's checked immediately, at every single step.

## 3. Internal Flow

**The choose-explore-unchoose pattern.** Backtracking is this three-step loop applied recursively:
1. **Choose** — make a tentative decision (place a queen at a specific column in the current row).
2. **Explore** — recurse into the next decision (move to the next row) assuming this choice holds.
3. **Unchoose** — when the recursive exploration returns (whether it succeeded or exhausted all options), undo the choice (remove the queen) so the *next* candidate at this level starts from a clean board state.

**Row-by-row placement.** Because no two queens can share a row, N-Queens can be framed as: decide *one row at a time* which column the queen in that row goes in. This collapses the search space from "choose N squares out of N^2" down to "choose 1 column out of N, N times" — a placement is represented compactly as `board[row] = col`.

**Pruning invalid branches early vs. generate-then-filter.** At each row, before placing a queen in a candidate column, check it against every queen already placed in previous rows:
- **Same column** — `col == board[r]` for some earlier row `r`.
- **Same diagonal** — `abs(col - board[r]) == abs(row - r)` for some earlier row `r` (the row-difference equals the column-difference on a diagonal).

If either check fails, that column is pruned *immediately* — the recursion never even descends into it. This is the entire efficiency win over generate-then-filter: an invalid choice at row 2 kills every one of the (up to) `N^(N-2)` placements that would have built on top of it, without ever generating a single one of them.

**Base case and backtrack.** If a queen has been successfully placed in every row (`row == N`), a complete valid solution has been found. Otherwise, after trying every column in the current row (whether one succeeded and returned, or all were pruned), the function returns control to its caller, which then removes (unchooses) its own queen and tries its next candidate column.

## 4. Example

`solve_n_queens(4)` solving the classic 4-Queens problem, tracing every `PLACE`, `PRUNE`, and `UNCHOOSE` decision:

```python
def solve_n_queens(n):
    board = [-1] * n  # board[row] = column of queen in that row
    solutions = []

    def is_safe(row, col):
        for r in range(row):
            c = board[r]
            if c == col:
                return False
            if abs(c - col) == abs(r - row):
                return False
        return True

    def backtrack(row):
        if row == n:
            solutions.append(board[:])
            print(f"row {row}: complete solution found {board[:]}")
            return
        for col in range(n):
            if is_safe(row, col):
                board[row] = col
                print(f"PLACE queen at row={row}, col={col} -> board so far {board[:row+1]}")
                backtrack(row + 1)
                print(f"UNCHOOSE queen at row={row}, col={col} (backtrack)")
                board[row] = -1
            else:
                print(f"PRUNE row={row}, col={col}: conflicts with existing queens")

    backtrack(0)
    return solutions


solutions = solve_n_queens(4)
print(f"\nTotal solutions for N=4: {len(solutions)}")
for sol in solutions:
    print(sol)
```

Actual output (trimmed to the first branch and the final tally — the full trace shows every prune/unchoose across all four starting columns):

```text
PLACE queen at row=0, col=0 -> board so far [0]
PRUNE row=1, col=0: conflicts with existing queens
PRUNE row=1, col=1: conflicts with existing queens
PLACE queen at row=1, col=2 -> board so far [0, 2]
PRUNE row=2, col=0: conflicts with existing queens
PRUNE row=2, col=1: conflicts with existing queens
PRUNE row=2, col=2: conflicts with existing queens
PRUNE row=2, col=3: conflicts with existing queens
UNCHOOSE queen at row=1, col=2 (backtrack)
PLACE queen at row=1, col=3 -> board so far [0, 3]
PRUNE row=2, col=0: conflicts with existing queens
PLACE queen at row=2, col=1 -> board so far [0, 3, 1]
PRUNE row=3, col=0: conflicts with existing queens
PRUNE row=3, col=1: conflicts with existing queens
PRUNE row=3, col=2: conflicts with existing queens
PRUNE row=3, col=3: conflicts with existing queens
UNCHOOSE queen at row=2, col=1 (backtrack)
PRUNE row=2, col=2: conflicts with existing queens
PRUNE row=2, col=3: conflicts with existing queens
UNCHOOSE queen at row=1, col=3 (backtrack)
UNCHOOSE queen at row=0, col=0 (backtrack)
PLACE queen at row=0, col=1 -> board so far [1]
...
row 4: complete solution found [1, 3, 0, 2]
...
row 4: complete solution found [2, 0, 3, 1]
...

Total solutions for N=4: 2
[1, 3, 0, 2]
[2, 0, 3, 1]
```

Notice the very first branch (`col=0` in row 0) explores both `col=2` and `col=3` for row 1, prunes every option in row 2 or 3 under each, and fully **unchooses** back out to row 0 without ever finding a complete solution — it isn't until row 0's queen moves to `col=1` that a full board (`[1, 3, 0, 2]`) is finally reached. N=4 has exactly 2 valid solutions, confirmed by direct execution.

## 5. Compare

| Approach | What it does | Cost |
|---|---|---|
| **Generate-then-filter** | Enumerate every way to place N queens on N^2 squares (or every permutation-like placement), then check each complete placement for validity. | Builds and validates enormous numbers of doomed-from-row-2 placements; wildly wasteful. |
| **Backtracking with pruning** | Check validity incrementally, one row at a time, and abandon a branch the instant it's invalid. | Never generates a placement that was already dead at row 2 — the invalid subtree is skipped in its entirety, not filtered out after the fact. |

The core difference isn't *what* gets checked (both eventually verify the same row/column/diagonal constraints) — it's *when*. Generate-then-filter pays the full cost of building every branch before checking any of them. Backtracking pays only for the branches that survive each row's check, which is why it's the standard technique for constraint-satisfaction problems like this one, Sudoku, and combinatorial search in general.

## 6. Common Mistakes

- **Checking constraints only after placing all N queens.** This degenerates into generate-then-filter with extra steps — the recursion still builds every doomed placement all the way to row N before discovering it was invalid three rows earlier, throwing away the entire efficiency benefit of backtracking. The whole point is to check `is_safe` *before* descending into the next row, not after the board is "complete."
- **Forgetting to unchoose (remove the queen) when backtracking.** If `board[row] = -1` (or the equivalent removal) is skipped after a recursive call returns, the stale queen placement leaks into the *next* candidate column's validity checks at the same row, or worse, into sibling branches — corrupting every subsequent attempt with a queen that's no longer supposed to be on the board. This is the single most common source of "backtracking produces wrong/too-few solutions" bugs.
- **Recomputing safety checks against the wrong slice of the board.** `is_safe` must only compare against rows `0..row-1` (queens actually placed so far) — comparing against uninitialized or stale rows produces false prunes or false accepts.
- **Off-by-one in the diagonal check.** The diagonal condition `abs(c - col) == abs(r - row)` is easy to get backwards or to compare against the wrong pair of coordinates; a wrong diagonal check silently permits attacking queens.

## 7. Interview Angle

N-Queens is a standard vehicle for testing whether a candidate understands backtracking as a *pattern* rather than a memorized algorithm. Interviewers listen for the candidate to articulate the choose-explore-unchoose loop explicitly and to justify *why* row-by-row placement with incremental validity checking is better than brute force — expect a follow-up like "how would you speed this up further?", where a strong answer mentions maintaining `used columns` / `used diagonals` as sets (O(1) conflict checks instead of re-scanning all previous rows) rather than recomputing `is_safe` from scratch every time, which is exactly the perf lesson also central to the Sudoku lesson later in this phase. A common escalation is counting solutions without storing them (drop the `solutions.append` and just increment a counter) or returning only the first solution (return as soon as one is found instead of continuing the search) — both are minor variations on the same core recursion.

## 8. Memory Hook

**"Choose, explore, unchoose — check before you commit, undo before you move on."** Backtracking is generate-then-filter turned inside out: verify each partial decision the instant it's made, and always put the board back the way you found it before trying the next option.
