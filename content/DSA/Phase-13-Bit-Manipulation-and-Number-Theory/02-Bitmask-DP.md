# Bitmask DP

## 1. Problem

Some DP problems need a state dimension that tracks "which subset of a small collection of items has been used/visited/chosen so far" — the Traveling Salesman Problem (which cities has the tour already visited?), assigning workers to tasks (which tasks are already taken?), or covering a small board with tiles (which cells are already filled?). Representing that subset with a Python `set` or a list of booleans works, but it's clumsy as a DP key (sets aren't hashable, lists need conversion to tuples) and slow to copy/compare. Phase 11 (`06-State-Space-Reduction.md`) previewed the fix: represent the subset as a single integer — a **bitmask** — where bit `k` is 1 exactly when item `k` is in the subset. This file delivers on that preview: the concept in full, plus a working bitmask DP solving small-n TSP.

## 2. Analogy

Imagine a hotel with 20 rooms and a keycard-style panel with 20 lights, one per room, lit exactly when that room currently has a guest checked in. Instead of walking the hallway and checking each door (an explicit set/list scan), the front desk just glances at one panel — a single number, read as 20 bits — to instantly know the entire occupancy state, compare it to another night's occupancy, or check "is room 7 occupied?" by looking at exactly one light. The panel *is* the state, compressed into one glance instead of 20 separate observations — that compression is precisely what a bitmask buys a DP table: the entire "which subset" question becomes one integer to store, hash, and index by.

## 3. Internal Flow

**Setting up the state.** For a TSP-style problem with `n` cities (`n` small, roughly <= 20), define `dp[mask][i]` = the minimum cost of a path that has visited exactly the set of cities encoded by `mask`, ending at city `i` (city `i` must itself be in `mask`, i.e. `mask & (1 << i)` must be nonzero — a path can't "end at" a city it hasn't visited). There are `2^n` possible masks and `n` possible ending cities, so the table has `2^n * n` entries.

**Base case.** Starting the tour at city 0: `dp[1][0] = 0` (mask `0b...0001` means "only city 0 visited," cost 0 to be there having gone nowhere).

**Transition.** For each `mask` and each city `i` already in `mask` with a known `dp[mask][i]`, try extending the path to every city `j` *not yet* in `mask` (checked via `mask & (1 << j) == 0`):
```
new_mask = mask | (1 << j)          # add j to the visited set
new_cost = dp[mask][i] + dist[i][j] # travel from i to j
dp[new_mask][j] = min(dp[new_mask][j], new_cost)
```
`mask | (1 << j)` — OR, not AND — is what adds `j` to the set (this is the "set bit `j`" idiom from file 01); `mask & (1 << j)` — AND — is what *tests* whether `j` is already in the set. Confusing the two operators here is one of the most common bugs in bitmask DP code.

**Final answer.** Once every `dp[FULL_MASK][i]` is known (`FULL_MASK = (1 << n) - 1`, every bit set — every city visited), the answer is `min` over all `i` of `dp[FULL_MASK][i] + dist[i][0]` — the cheapest way to have visited everyone, plus the cost of returning to the start.

**Why this only scales to small n.** The table has `2^n * n` entries, and computing each one considers up to `n` transitions, giving roughly `O(2^n * n^2)` time and `O(2^n * n)` space. This is exponentially better than the `O(n!)` of trying every permutation of cities directly, but it is still exponential in `n`: at `n = 20`, `2^20 ≈ 1,000,000`, so the table has about 20 million entries — large but often still tractable; at `n = 30`, `2^30 ≈ 1,000,000,000`, and the table becomes far too large for typical memory and time limits. Bitmask DP is the standard tool for "small n, subset-shaped state" problems specifically because it trades `n!` for `2^n * poly(n)` — a huge win, but one that still explodes past roughly `n = 20`.

## 4. Example

```python
def tsp_bitmask(dist):
    n = len(dist)
    FULL = (1 << n) - 1
    dp = [[float('inf')] * n for _ in range(1 << n)]
    dp[1][0] = 0  # start at city 0, visited-set = {0}

    for mask in range(1 << n):
        for i in range(n):
            if not (mask & (1 << i)):
                continue
            if dp[mask][i] == float('inf'):
                continue
            for j in range(n):
                if mask & (1 << j):
                    continue
                new_mask = mask | (1 << j)
                new_cost = dp[mask][i] + dist[i][j]
                if new_cost < dp[new_mask][j]:
                    dp[new_mask][j] = new_cost

    best = min(dp[FULL][i] + dist[i][0] for i in range(n) if dp[FULL][i] != float('inf'))
    return best, dp

dist = [
    [0, 10, 15, 20],
    [10, 0, 35, 25],
    [15, 35, 0, 30],
    [20, 25, 30, 0],
]

best, dp = tsp_bitmask(dist)
print(f"Best tour cost: {best}")

print("\nTrace: dp[mask][i] for a few masks (mask shown in binary, city set = bits set)")
for mask in [0b0001, 0b0011, 0b0101, 0b1111]:
    row = [dp[mask][i] for i in range(4)]
    print(f"mask={bin(mask):>6} -> dp[mask] = {row}")
```

Executed output:

```
Best tour cost: 80

Trace: dp[mask][i] for a few masks (mask shown in binary, city set = bits set)
mask=   0b1 -> dp[mask] = [0, inf, inf, inf]
mask=  0b11 -> dp[mask] = [inf, 10, inf, inf]
mask= 0b101 -> dp[mask] = [inf, inf, 15, inf]
mask=0b1111 -> dp[mask] = [inf, 70, 65, 75]
```

Tracing two transitions by hand: `mask = 0b0001` (visited = {0}, ending at 0) has `dp = 0`, the base case. Extending to city 1 gives `new_mask = 0b0001 | 0b0010 = 0b0011`, `new_cost = 0 + dist[0][1] = 0 + 10 = 10` — matching `dp[0b11][1] = 10` above. From there, extending `mask = 0b0011` (visited = {0, 1}, ending at 1) to city 2 gives `new_mask = 0b0111`, `new_cost = dp[0b011][1] + dist[1][2] = 10 + 35 = 45`. The final row, `mask = 0b1111` (all four cities visited), shows the cheapest way to reach each possible last city: ending at city 2 costs `65`, and adding the return trip `dist[2][0] = 15` gives `80` — the reported best tour cost, confirming `min` over `dp[FULL][i] + dist[i][0]` picked the city-2 ending correctly (city 1: `70+10=80` ties it; city 3: `75+20=95` is worse).

## 5. Compare

| Approach | Time | Space | Practical limit |
|---|---|---|---|
| Brute-force permutations | O(n!) | O(n) | n <= ~10 |
| Bitmask DP | O(2^n · n^2) | O(2^n · n) | n <= ~20 |
| Held-Karp is another name for exactly this bitmask DP | same as above | same as above | same as above |
| Approximation / heuristic (nearest-neighbor, 2-opt) | polynomial | polynomial | any n, but no optimality guarantee |

Bitmask DP is the right tool specifically when an exact optimum is required and `n` is small — it's strictly better than brute force for any `n` where `2^n * n^2 < n!` (true for essentially all `n >= 5`), but for genuinely large `n` where an exact answer isn't feasible at all, the field shifts to approximation algorithms, which trade a guarantee of optimality for tractable runtime.

## 6. Common Mistakes

- Attempting bitmask DP on an `n` too large (comfortably past ~20): `2^n` stops being a "large but fine" number and becomes an out-of-memory table long before it becomes a slow-but-finishing one — check the problem's stated constraints on `n` before reaching for this technique.
- Swapping `mask & (1 << i)` (test membership: "is city `i` already visited?") with `mask | (1 << i)` (add to the set: "mark city `i` as visited") — using OR where AND was needed silently treats every city as already visited; using AND where OR was needed fails to ever grow the mask.
- Forgetting the base-case city must be excluded from the "which city to extend to" loop until it's genuinely being revisited as the final return leg — most TSP formulations handle this by treating "return to start" as a separate final step after the DP, not another `j` inside the main transition loop.
- Off-by-one in bit-index vs. city-index correspondence: if cities are numbered starting at 1 elsewhere in a problem but the mask assumes 0-indexed bits, `1 << city_id` silently tests/sets the wrong bit.
- Allocating the full `dp[1 << n][n]` table upfront for an `n` that turns out to be larger than expected (e.g. reading input before validating `n <= 20`), causing a memory blowup before the algorithm even starts running.

## 7. Interview Angle

Bitmask DP is a strong signal question because it combines two skills at once: recognizing that a problem's "which items are already used" component is small enough (`n <= ~20`) to encode as an integer, and correctly writing the AND/OR-based transition without swapping them. Interviewers will often state the constraint explicitly (e.g. "n <= 15") as a hint that this is the intended technique — treating that constraint as a throwaway detail rather than a signal is a common miss. Being able to explain *why* the complexity is `2^n` rather than `n!` (and why that's still a huge win) demonstrates the state-space reasoning interviewers are actually probing for, beyond just reciting the code template.

## 8. Memory Hook

"**Bitmask = keycard panel, one light per item** — OR turns a light on (add to the set), AND checks if a light's already on (test membership)." And the scaling reminder: "**2^20 is a million, 2^30 is a billion** — bitmask DP lives comfortably below 20, gets risky past it, and stops being an option well before 30."
