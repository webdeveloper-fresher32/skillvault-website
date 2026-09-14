# 2D DP and Grid Problems

## 1. Problem

The previous file's 1D DP used a single index as the "state" identifying each subproblem — `dp[i]` meant "the answer up through position `i`." Many real problems need **two** independent coordinates to identify a subproblem: a grid-traversal problem needs both a row and a column (`dp[i][j]` = "the answer for reaching cell `(i, j)`"), and comparing two sequences (covered in file 04) needs an index into each sequence. This file extends the same memoization/tabulation discipline from file 01 into two dimensions, using classic grid problems — **unique paths** (count the distinct ways to reach the bottom-right corner moving only right or down) and **minimum path sum** (find the cheapest such path, where each cell has a cost) — as the running examples.

The core idea doesn't change: identify overlapping subproblems and optimal substructure, then build a table. What's new is that the recurrence for `dp[i][j]` now depends on **two** previously-computed cells rather than one — typically `dp[i-1][j]` (the cell directly above) and `dp[i][j-1]` (the cell directly to the left) — and the fill order of the table has to respect both dependencies simultaneously.

## 2. Analogy

Think of a spreadsheet where each cell's formula references the cell above it and the cell to its left (like a running total that combines a row-wise and column-wise contribution). To fill in cell `C5`, you need `B5` (same row, previous column) and `C4` (same column, previous row) to already have their final values. If you tried to fill the spreadsheet in a random order — say jumping straight to `C5` before `B5` and `C4` are computed — you'd either get a formula error or silently read a stale/default `0` where a real value belongs. The safe way to fill any such spreadsheet is row by row, left to right within each row: by the time you reach any cell, everything above it and to its left in that row is already finalized.

## 3. Internal Flow

**Step 1 — define the state.** `dp[i][j]` represents "the answer restricted to the sub-grid ending at cell `(i, j)`" — for minimum path sum, that's the cheapest cost to reach `(i, j)` from the top-left corner.

**Step 2 — write the recurrence.** For minimum path sum with only right/down moves allowed: `dp[i][j] = grid[i][j] + min(dp[i-1][j], dp[i][j-1])` — the cost of the current cell plus whichever of "arrived from above" or "arrived from the left" was cheaper. (Unique paths uses the same shape of recurrence but with a sum instead of a min: `dp[i][j] = dp[i-1][j] + dp[i][j-1]`, since every path arriving from above and every path arriving from the left is a distinct way to reach `(i, j)`.)

**Step 3 — handle the base cases (first row and first column).** Cell `(0, 0)` has no cell above or to its left, so it's initialized directly from `grid[0][0]`. Every other cell in row 0 can only have arrived from the left (there's no row `-1`), so `dp[0][j] = dp[0][j-1] + grid[0][j]`. Symmetrically, every cell in column 0 can only have arrived from above: `dp[i][0] = dp[i-1][0] + grid[i][0]`.

**Step 4 — fill the rest of the table in dependency order.** Because `dp[i][j]` depends on `dp[i-1][j]` (the row above) and `dp[i][j-1]` (the same row, one column left), filling **top-to-bottom, and left-to-right within each row** guarantees both dependencies are already finalized by the time any given cell is computed.

**Step 5 — read the answer from the bottom-right cell.** `dp[rows-1][cols-1]` holds the answer for the full grid.

## 4. Example

Computing minimum path sum on a 3x3 grid, printing every cell's derivation as it's filled and the final table:

```python
def min_path_sum(grid):
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
            print(f"dp[{i}][{j}] = grid[{i}][{j}]({grid[i][j]}) + min(dp[{i-1}][{j}]={dp[i-1][j]}, dp[{i}][{j-1}]={dp[i][j-1]}) = {dp[i][j]}")

    print("\nFinal DP table:")
    for row in dp:
        print(row)

    return dp[rows - 1][cols - 1]


grid = [
    [1, 3, 1],
    [1, 5, 1],
    [4, 2, 1],
]

print("Input grid:")
for row in grid:
    print(row)
print()

result = min_path_sum(grid)
print(f"\nMinimum path sum: {result}")
```

Actual output:

```text
Input grid:
[1, 3, 1]
[1, 5, 1]
[4, 2, 1]

dp[1][1] = grid[1][1](5) + min(dp[0][1]=4, dp[1][0]=2) = 7
dp[1][2] = grid[1][2](1) + min(dp[0][2]=5, dp[1][1]=7) = 6
dp[2][1] = grid[2][1](2) + min(dp[1][1]=7, dp[2][0]=6) = 8
dp[2][2] = grid[2][2](1) + min(dp[1][2]=6, dp[2][1]=8) = 7

Final DP table:
[1, 4, 5]
[2, 7, 6]
[6, 8, 7]

Minimum path sum: 7
```

Tracing the fill order: `dp[0]` (the whole first row, `[1, 4, 5]`) and the first column (`1, 2, 6`, read down column 0 of the printed rows) are filled first as base cases. Then the loop fills `(1,1)`, `(1,2)`, `(2,1)`, `(2,2)` in that exact order — row by row, left to right — and each one's `print` line shows both dependency cells (`dp[i-1][j]` and `dp[i][j-1]`) already holding final values by the time they're read. The answer, `7`, corresponds to the path `1 -> 1 -> 1 -> 2 -> 1` (right along column 0, then across row 2) or an equal-cost alternative — the table doesn't retain *which* path was chosen, only the optimal cost, which is enough since the problem only asks for the minimum sum.

## 5. Compare

- **1D DP (file 01) vs 2D DP**: the mechanics are identical — define a recurrence, handle base cases, fill in dependency order — the only difference is the state now has two coordinates instead of one, so the "fill order" constraint becomes a 2D shape (top-to-bottom, left-to-right) instead of a simple 1D left-to-right sweep.
- **Unique paths vs minimum path sum**: both share the exact same table shape and fill order; only the combining operation at each cell differs (`+` for counting paths vs `min` for cheapest cost) — recognizing that grid problems are a *family* sharing one skeleton, differing only in the combine operator, is a useful pattern-matching shortcut in interviews.
- **Grid DP vs knapsack (file 03)**: grid DP's two dimensions are both "position" coordinates with a fixed dependency direction (top-left to bottom-right); knapsack's two dimensions are "item index" and "remaining capacity" — conceptually different axes, but the *same* discipline of filling the table in dependency order still applies.

## 6. Common Mistakes

- **Filling the table in the wrong order.** If the nested loops iterate columns before rows, or otherwise visit `(i, j)` before `(i-1, j)` and `(i, j-1)` have been finalized, the recurrence reads stale (default `0`, or previous-iteration) values instead of real ones — this is the single most common bug when a learner "obviously" writes `for j in range(rows): for i in range(cols):` by transposing the loop variable names without thinking about what they actually iterate over.
- **Off-by-one errors in first-row/first-column initialization.** Forgetting that `dp[0][j]` can only be reached from the left (not from "above row 0") and instead applying the general two-argument recurrence to row 0 or column 0 causes an index error (`dp[-1][j]` or `dp[i][-1]` silently wraps to the *last* row/column in Python instead of raising, which is an especially sneaky bug since it doesn't crash — it just produces wrong numbers).
- **Confusing which grid problem needs `min`/`max` vs `+`.** Unique-paths-style counting problems sum the ways in from each direction; shortest/cheapest-path-style problems take the min (or max, for a "maximize" variant) of the incoming options — plugging in the wrong operator gives a plausible-looking but wrong number that's easy to miss without tracing a small example by hand.
- **Not handling grids with blocked cells or a single row/column.** A grid with only one row (or one column) has no "other direction" to arrive from at all — code that assumes both a valid row above and a valid column to the left exist for every non-corner cell will index out of bounds on these edge-shaped inputs.

## 7. Interview Angle

Grid DP problems are a favorite because the state space is easy to visualize (draw the grid, draw arrows for the recurrence) and because the same skeleton generalizes to many variants: unique paths, unique paths with obstacles, minimum path sum, maximum path sum, and triangle-style variable-width grids. A common interview escalation is "what if some cells are blocked?" — the fix is simply to treat a blocked cell as contributing 0 ways (or infinity cost) rather than changing the overall structure. Another common follow-up, echoing the state-space-reduction theme (file 06 of this phase): "can you do this with less than O(rows x cols) memory?" — since each row only depends on the row directly above it, the table can be rolled down to a single 1D array reused across rows, which is exactly the topic of file 06.

## 8. Memory Hook

**"Above and to the left, filled row by row."** Every cell in a grid DP table depends only on the cell above it and the cell to its left — so as long as you fill top-to-bottom and left-to-right, every dependency is guaranteed to already be sitting in the table by the time you need it.
