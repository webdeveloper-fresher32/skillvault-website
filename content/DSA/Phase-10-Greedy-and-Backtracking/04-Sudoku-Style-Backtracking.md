# Sudoku-Style Backtracking

## 1. Problem

Given a 9x9 Sudoku grid, partially filled with digits 1–9 and zeros marking empty cells, fill in every empty cell such that every row, every column, and every 3x3 box contains each digit 1–9 exactly once. This is a **constraint satisfaction problem** over a 2D grid: instead of a linear sequence of decisions (like N-Queens' one-queen-per-row), each decision here — "what digit goes in this cell?" — must satisfy three simultaneous constraints (row, column, box) at once.

Sudoku generalizes the choose-explore-unchoose backtracking pattern from the previous lesson to a full 2D grid with a richer constraint set, and it's the standard example for showing *where* naive backtracking gets slow and *why* the order in which you visit cells matters for performance, not just correctness.

## 2. Analogy

Think of filling in the grid like solving a jigsaw puzzle by trying a piece, checking if it fits its slot *and* doesn't clash with three overlapping picture regions at once, and — if it doesn't fit — pulling it back out before trying the next piece. A sloppy solver scans left-to-right, top-to-bottom regardless of how constrained each empty cell already is. A smart solver instead looks for the slot with the *fewest* possible pieces that could go there — the cell boxed in by the most already-placed neighbors — and fills that one first, because a nearly-locked-in cell either fails fast (cutting off a bad branch immediately) or locks in more information for its neighbors, rather than wasting time on a wide-open cell that could accept almost anything and won't reveal a conflict until much later.

## 3. Internal Flow

**Choose-explore-unchoose over a grid.** For each empty cell, try each digit 1–9: check if placing it is valid against the row, column, and 3x3 box (choose), recurse into solving the rest of the grid assuming this digit stays (explore), and if that recursive attempt fails, remove the digit and restore the cell to empty (unchoose) before trying the next digit.

**Row/column/box constraint checking.** A digit `d` is valid at `(row, col)` only if:
- No cell in `row` already contains `d`.
- No cell in `col` already contains `d`.
- No cell in the 3x3 box containing `(row, col)` already contains `d` — the box's top-left corner is found via `3 * (row // 3), 3 * (col // 3)`.

**Cell-selection order matters.** A naive solver always picks the *first* empty cell it scans (left-to-right, top-to-bottom). A smarter solver picks the **most-constrained cell** — the empty cell with the fewest remaining valid candidate digits — first. Why this prunes faster: a cell with only one or two valid candidates either fails almost immediately (if none of those candidates lead anywhere, the branch dies fast, without wasting time filling in easier cells first) or, if it succeeds, its placement further constrains its neighboring cells, shrinking *their* candidate sets too — propagating information outward instead of blindly filling in "easy" cells that don't yet reveal whether the surrounding area is even solvable.

**Backtrack on failure.** If no digit 1–9 is valid for the chosen cell, the current path is a dead end — return failure to the caller, which then undoes *its own* placement (sets its cell back to empty) and tries its next candidate digit. This is identical in shape to N-Queens' unchoose step, just over grid cells with three constraints instead of one row's worth of column/diagonal checks.

## 4. Example

`solve_sudoku` on a genuinely under-constrained puzzle (the classic 17-clue minimal puzzle), tracing the first placements and the point where the solver has to backtrack because an early guess turns out to be wrong three cells later. Note: because this is a real hard puzzle (not a nearly-solved board), the naive left-to-right cell order explores a large search tree under the hood — running the snippet below takes on the order of a minute on typical hardware, which is itself a live demonstration of the "cell order matters for performance" point made in Section 3:

```python
def solve_sudoku(board, trace_limit=20):
    trace_count = [0]

    def log(msg):
        if trace_count[0] < trace_limit:
            print(msg)
            trace_count[0] += 1
        elif trace_count[0] == trace_limit:
            print("... (remaining placements/backtracks omitted for brevity) ...")
            trace_count[0] += 1

    def is_valid(row, col, digit):
        for c in range(9):
            if board[row][c] == digit:
                return False
        for r in range(9):
            if board[r][col] == digit:
                return False
        box_row, box_col = 3 * (row // 3), 3 * (col // 3)
        for r in range(box_row, box_row + 3):
            for c in range(box_col, box_col + 3):
                if board[r][c] == digit:
                    return False
        return True

    def find_empty():
        for r in range(9):
            for c in range(9):
                if board[r][c] == 0:
                    return r, c
        return None

    def backtrack():
        empty = find_empty()
        if not empty:
            return True
        row, col = empty
        for digit in range(1, 10):
            if is_valid(row, col, digit):
                board[row][col] = digit
                log(f"PLACE {digit} at ({row},{col})")
                if backtrack():
                    return True
                log(f"BACKTRACK: remove {digit} from ({row},{col})")
                board[row][col] = 0
        return False

    return backtrack()


puzzle = [
    [0,0,0, 0,0,0, 0,1,0],
    [4,0,0, 0,0,0, 0,0,0],
    [0,2,0, 0,0,0, 0,0,0],
    [0,0,0, 0,5,0, 4,0,7],
    [0,0,8, 0,0,0, 3,0,0],
    [0,0,1, 0,9,0, 0,0,0],
    [3,0,0, 4,0,0, 2,0,0],
    [0,5,0, 1,0,0, 0,0,0],
    [0,0,0, 8,0,6, 0,0,0],
]
board = [row[:] for row in puzzle]
solved = solve_sudoku(board, trace_limit=20)
print()
print("Solved:", solved)
for row in board:
    print(row)
```

Actual output:

```text
PLACE 5 at (0,0)
PLACE 3 at (0,1)
PLACE 6 at (0,2)
PLACE 2 at (0,3)
PLACE 4 at (0,4)
PLACE 7 at (0,5)
PLACE 8 at (0,6)
PLACE 9 at (0,8)
PLACE 1 at (1,1)
PLACE 7 at (1,2)
PLACE 3 at (1,3)
PLACE 6 at (1,4)
PLACE 5 at (1,5)
BACKTRACK: remove 5 from (1,5)
PLACE 8 at (1,5)
PLACE 5 at (1,6)
PLACE 2 at (1,7)
BACKTRACK: remove 2 from (1,7)
BACKTRACK: remove 5 from (1,6)
BACKTRACK: remove 8 from (1,5)
... (remaining placements/backtracks omitted for brevity) ...

Solved: True
[6, 9, 3, 7, 8, 4, 5, 1, 2]
[4, 8, 7, 5, 1, 2, 9, 3, 6]
[1, 2, 5, 9, 6, 3, 8, 7, 4]
[9, 3, 2, 6, 5, 1, 4, 8, 7]
[5, 6, 8, 2, 4, 7, 3, 9, 1]
[7, 4, 1, 3, 9, 8, 6, 2, 5]
[3, 1, 9, 4, 7, 5, 2, 6, 8]
[8, 5, 6, 1, 2, 9, 7, 4, 3]
[2, 7, 4, 8, 3, 6, 1, 5, 9]
```

Trace this carefully: row 0 fills in cleanly (every digit 1–9 except 1, which was already given, gets placed left to right with no conflicts). But at `(1,5)`, placing `5` looks locally valid, yet it turns out to make the rest of the board unsolvable — the very next recursive call eventually fails and control returns here, so `5` is **removed** (`BACKTRACK: remove 5 from (1,5)`) and `8` is tried instead. That, too, eventually proves wrong three cells later (`(1,7)` runs out of valid digits), so the solver backtracks all the way out of `(1,5)`, `(1,6)`, and `(1,7)` before the search (invisible in this trimmed excerpt, but confirmed by direct execution) eventually finds the fully consistent assignment shown in the final board.

## 5. Compare

| Approach | Cell order | Constraint check | Behavior |
|---|---|---|---|
| **Naive left-to-right scan** | Always the first empty cell found, top-to-bottom | Full row/col/box scan every time | Correct, but explores many dead-end branches before discovering a conflict several cells later, because an early "wide open" cell with many candidates doesn't fail fast. |
| **Most-constrained-cell first** | The empty cell with the fewest valid candidate digits, picked dynamically | Same full check, but on a smarter cell order | Fails fast on nearly-locked cells (few candidates to try before exhausting them) and propagates constraints outward faster, dramatically cutting the search tree on hard puzzles. |
| **Naive full-scan validity check** | Either order | Re-scans the entire row, column, and box arrays from scratch on every single `is_valid` call | Correct but wasteful — the same 9+9+9 cells get re-examined on every candidate digit tried at every cell, instead of maintaining running "used" sets. |
| **Maintained used-value sets** | Either order | O(1) membership check against a `set` of digits already used in this row/col/box, updated incrementally as digits are placed/removed | Same correctness, far less repeated scanning — this is the direct analogue of the N-Queens lesson's "maintain used columns/diagonals as sets" optimization. |

The cell-selection question (which empty cell to try next) and the constraint-check-efficiency question (how to check validity fast) are independent axes — a solver can be smart about one and naive about the other, and both independently affect how much of the search tree actually gets explored versus pruned.

## 6. Common Mistakes

- **Recomputing full row/col/box validity from scratch on every check instead of maintaining used-value sets.** Scanning 9 cells three times (row, column, box) on every single candidate-digit check, for every cell, adds up fast on harder puzzles with many empty cells — the fix is to maintain a `set` of used digits per row, per column, and per box, updating them incrementally as digits are placed and removed, turning each validity check into an O(1) set-membership test instead of an O(27) scan.
- **Not backtracking the board state (forgetting to undo a placed digit) when a branch fails.** If `board[row][col] = 0` is skipped after a failed recursive call, the stale digit remains on the board and corrupts every subsequent validity check that looks at that row, column, or box — identical in spirit to forgetting to remove a queen in the N-Queens lesson, and just as fatal to correctness.
- **Always scanning cells left-to-right, top-to-bottom instead of picking the most-constrained cell.** This isn't a correctness bug, but on genuinely hard puzzles it's the difference between a solver that returns instantly and one that churns through a much larger search tree before finding the same answer — the trace above shows real backtracking occurring specifically because the solver picks whatever empty cell comes first rather than the most-constrained one.
- **Confusing "no valid digit for this cell" with "puzzle unsolvable."** A `False` return from the recursive call for one cell only means *this branch* (given all choices made so far) doesn't work — it must trigger unchoosing the *previous* cell's digit and trying its next candidate, not an immediate overall failure, unless the very first cell has exhausted all its own candidates too.

## 7. Interview Angle

Sudoku-style backtracking is used to test whether a candidate can extend the choose-explore-unchoose pattern from a 1D structure (like N-Queens' rows) to a 2D grid with multiple simultaneous constraints, and whether they can reason about *performance*, not just correctness — a working-but-slow solution is common, and the interesting follow-up is almost always "how would you make this faster?" The expected answers, in escalating sophistication, are: (1) maintain used-digit sets per row/column/box instead of rescanning, and (2) pick the most-constrained empty cell first instead of scanning left-to-right — both discussed above. A common escalation is asking for a **Sudoku validator** (just check whether a *completed* board is valid, no backtracking needed) as a warm-up before the full solver, which tests whether the candidate can cleanly separate the "is this valid" check from the "search for a solution" logic — exactly the `is_valid`/`backtrack` split used in the example above.

## 8. Memory Hook

**"Most-constrained cell first, used-sets over re-scans, and always put the digit back before moving on."** Sudoku is N-Queens' choose-explore-unchoose pattern stretched over a 2D grid with three overlapping constraints — correctness comes from checking row/column/box and undoing failed placements; speed comes from smarter cell ordering and not re-deriving what a running set could tell you for free.
