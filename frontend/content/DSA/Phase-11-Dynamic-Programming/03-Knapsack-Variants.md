# Knapsack Variants

## 1. Problem

You have a knapsack with a fixed weight capacity, and a set of items, each with a weight and a value. You want to choose a subset (or multiset) of items that maximizes total value without exceeding the capacity. The two classic variants differ in exactly one rule:

- **0/1 knapsack** — each item can be used **at most once**. For every item you face a binary decision: include it or exclude it.
- **Unbounded knapsack** — each item can be used **any number of times** (unlimited supply). For every item you face a repeated decision: take another copy of it, or move on.

This single rule difference — "used once" vs "reusable" — changes both the recurrence and, critically, the *iteration order* required when the DP table is space-optimized from 2D down to 1D. Getting that iteration order backwards silently turns one variant into the other, which is exactly the bug this file walks through concretely rather than just asserting.

## 2. Analogy

Think of a grocery store checkout with a shopping basket that has a weight limit. If you're at a store where each product on the shelf is a **unique, one-of-a-kind item** (like a vintage market with single antiques), then once you've picked up the one copy of an item, it's gone — that's 0/1 knapsack. If instead you're at a regular grocery store with a shelf full of identical cans of the same product, you can put as many cans of that same product into your basket as the weight limit allows — that's unbounded knapsack. The store's shelf policy (unique antiques vs restocked identical cans) is the entire difference between the two problems; the "maximize value under a weight limit" goal is identical in both.

## 3. Internal Flow

**0/1 knapsack recurrence.** Let `dp[i][cap]` = the best value achievable using only the first `i` items with capacity `cap`. For item `i` (1-indexed, weight `w`, value `v`):

```
dp[i][cap] = max(
    dp[i-1][cap],                          # exclude item i
    v + dp[i-1][cap - w]   if cap >= w      # include item i (moves to row i-1, i.e. this item is now "used up")
)
```

The include branch looks at row `i-1` — once item `i` is used, it can never be reconsidered, which is exactly what "at most once" means structurally.

**Unbounded knapsack recurrence.** Let `dp[i][cap]` again be "best value using only the first `i` items," but now:

```
dp[i][cap] = max(
    dp[i-1][cap],                          # don't use item i at all
    v + dp[i][cap - w]     if cap >= w      # use another copy of item i (stays on row i!)
)
```

The include branch here looks at row `i` (the *same* row, not `i-1`) — because item `i` can be reused, "including it" doesn't retire it; the same item is still available for further inclusion at the reduced capacity.

**Space optimization: 2D to 1D.** Both recurrences only ever need "the row above" (0/1) or "the current row so far" (unbounded) — so the full 2D table can be collapsed to a single 1D array `dp[cap]` reused across items, *provided* the capacity dimension is iterated in the right direction for each variant:

- **0/1 knapsack: iterate capacity in reverse** (`capacity` down to `w`). This ensures that when computing `dp[cap]` for the current item, `dp[cap - w]` still holds **last item's** value (not yet overwritten this pass) — mirroring the 2D version's `dp[i-1][cap - w]`.
- **Unbounded knapsack: iterate capacity forward** (`w` up to `capacity`). This ensures `dp[cap - w]` already reflects **this item's own** possibly-already-updated value — mirroring the 2D version's `dp[i][cap - w]`, letting the same item be "picked up again" within the same pass.

Using forward iteration for the 0/1 case breaks this guarantee: `dp[cap - w]` may already have been updated *this pass* by this same item, silently allowing it to be counted more than once — turning 0/1 into unbounded by accident.

## 4. Example

0/1 knapsack computed three ways: the 2D table, the space-optimized 1D version with (correct) reverse iteration, and a deliberately broken 1D version with forward iteration — demonstrated on an input specifically chosen to expose the difference, since the first input happens to not show it:

```python
def knapsack_01_2d(weights, values, capacity):
    n = len(weights)
    dp = [[0] * (capacity + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        w, v = weights[i - 1], values[i - 1]
        for cap in range(capacity + 1):
            exclude = dp[i - 1][cap]
            include = v + dp[i - 1][cap - w] if cap >= w else float('-inf')
            dp[i][cap] = max(exclude, include)

    print("2D DP table (rows = items considered, cols = capacity):")
    for row in dp:
        print(row)
    return dp[n][capacity]


def knapsack_01_1d(weights, values, capacity):
    n = len(weights)
    dp = [0] * (capacity + 1)

    for i in range(n):
        w, v = weights[i], values[i]
        print(f"Item {i} (w={w}, v={v}), iterating cap from {capacity} down to {w}:")
        for cap in range(capacity, w - 1, -1):
            candidate = v + dp[cap - w]
            if candidate > dp[cap]:
                print(f"  cap={cap}: dp[cap]={dp[cap]} -> {candidate} (using dp[{cap - w}]={dp[cap - w]})")
                dp[cap] = candidate
        print(f"  dp after item {i}: {dp}")
    return dp[capacity]


def knapsack_01_1d_forward_buggy(weights, values, capacity):
    """Deliberately broken: forward iteration lets an item be reused, matching
    unbounded knapsack behavior instead of 0/1 knapsack."""
    n = len(weights)
    dp = [0] * (capacity + 1)

    for i in range(n):
        w, v = weights[i], values[i]
        for cap in range(w, capacity + 1):  # BUG: forward instead of reverse
            candidate = v + dp[cap - w]
            if candidate > dp[cap]:
                dp[cap] = candidate
    return dp[capacity]


weights = [2, 3, 4]
values = [3, 4, 5]
capacity = 5

print("=== 0/1 knapsack: 2D table ===")
result_2d = knapsack_01_2d(weights, values, capacity)
print(f"Best value (2D): {result_2d}\n")

print("=== 0/1 knapsack: space-optimized 1D (correct, reverse iteration) ===")
result_1d = knapsack_01_1d(weights, values, capacity)
print(f"Best value (1D correct): {result_1d}\n")

print("=== 0/1 knapsack: 1D with BUGGY forward iteration ===")
result_buggy = knapsack_01_1d_forward_buggy(weights, values, capacity)
print(f"Best value (1D buggy/forward): {result_buggy}")

print("\n=== Same bug, on an input where it actually changes the answer ===")
weights2 = [2]
values2 = [3]
capacity2 = 6
correct_2d = knapsack_01_2d(weights2, values2, capacity2)
correct_1d = knapsack_01_1d(weights2, values2, capacity2)
buggy = knapsack_01_1d_forward_buggy(weights2, values2, capacity2)
print(f"weights={weights2}, values={values2}, capacity={capacity2}")
print(f"Correct 0/1 knapsack (only one copy of the single item allowed): {correct_2d} (1D correct: {correct_1d})")
print(f"Buggy forward-iteration 1D result: {buggy}")
```

Actual output (abridged to the key results; full per-cell traces omitted for length):

```text
=== 0/1 knapsack: 2D table ===
2D DP table (rows = items considered, cols = capacity):
[0, 0, 0, 0, 0, 0]
[0, 0, 3, 3, 3, 3]
[0, 0, 3, 4, 4, 7]
[0, 0, 3, 4, 5, 7]
Best value (2D): 7

=== 0/1 knapsack: space-optimized 1D (correct, reverse iteration) ===
dp after item 0: [0, 0, 3, 3, 3, 3]
dp after item 1: [0, 0, 3, 4, 4, 7]
dp after item 2: [0, 0, 3, 4, 5, 7]
Best value (1D correct): 7

=== 0/1 knapsack: 1D with BUGGY forward iteration ===
Best value (1D buggy/forward): 7

=== Same bug, on an input where it actually changes the answer ===
weights=[2], values=[3], capacity=6
Correct 0/1 knapsack (only one copy of the single item allowed): 3 (1D correct: 3)
Buggy forward-iteration 1D result: 9
```

The first input (`weights=[2,3,4]`, `values=[3,4,5]`, `capacity=5`) gives `7` for both the correct and buggy versions — the bug doesn't show up here because the capacity isn't large enough relative to any single item's weight to let it be picked up twice. The second input makes it unmistakable: with a single item of weight 2 and value 3, and capacity 6, the correct 0/1 answer is `3` (you only have one copy of the item, so at best you carry it once). The buggy forward-iteration version returns `9` — exactly `3 x 3`, because forward iteration let the single item be "picked up" three times within the same item's own pass, since `dp[cap - w]` had already been updated earlier in that same forward sweep. This is precisely why the space-optimized 1D form of 0/1 knapsack **requires** reverse iteration: forward iteration silently reintroduces the "reuse" behavior that only belongs to unbounded knapsack.

## 5. Compare

- **0/1 vs unbounded, in the 2D table**: the only difference is which row the "include" branch reads from (`i-1` vs `i`) — a one-character-looking change (`dp[i-1][...]` vs `dp[i][...]`) that completely changes the problem being solved.
- **0/1 vs unbounded, in the 1D space-optimized version**: the only difference is iteration direction over the capacity dimension (reverse vs forward) — the same one-character-feeling change (`range(capacity, w-1, -1)` vs `range(w, capacity+1)`) has the same effect as the row-index change in the 2D version, just expressed as a loop direction instead.
- **Grid DP (file 02) vs knapsack**: grid DP's dependency direction is fixed by the geometry of the grid (top-to-bottom, left-to-right always); knapsack's dependency direction depends on which *variant* of the problem you're solving — a reminder that "which direction to fill the table" is never a default, it's a direct consequence of the recurrence you derived.

## 6. Common Mistakes

- **Using forward iteration for 0/1 knapsack's space-optimized 1D version.** As demonstrated above, this silently allows an item to be reused, changing the problem from 0/1 to unbounded knapsack without raising any error — the output is simply wrong, and often not obviously so unless tested against an input designed to expose it.
- **Using reverse iteration for unbounded knapsack's 1D version.** The opposite mistake also happens — reverse iteration prevents an item from ever being picked up more than once within the same pass, silently turning unbounded knapsack back into 0/1.
- **Confusing which knapsack variant a problem statement describes.** Phrases like "each item can be used multiple times," "unlimited supply," or "coins of unlimited denomination count" signal unbounded; "each item at most once" or "you either take an item or you don't" signals 0/1 — misreading this before choosing a recurrence dooms the rest of the solution regardless of how carefully the DP itself is implemented.
- **Forgetting the capacity-check guard (`cap >= w`) before indexing `dp[cap - w]`.** Without it, `cap - w` can go negative, and Python's negative indexing will silently read from the *end* of the array instead of raising an error — a classic invisible bug.
- **Initializing the 1D array incorrectly.** `dp = [0] * (capacity + 1)` is correct for "maximize value" knapsack; other knapsack-family problems (e.g., "can you make exactly this sum") need different initial values (like `True` only at index 0, everything else `False`) — copying the value-maximization initialization pattern into a different problem shape silently gives nonsense answers.

## 7. Interview Angle

Knapsack is one of the most reused DP shapes in interviews because dozens of problems reduce to it: coin change (unbounded), subset-sum / partition-equal-subset-sum (0/1 with a boolean table), target sum, combination sum. Interviewers frequently ask "can you reduce the memory from O(n x capacity) to O(capacity)?" as a direct follow-up once the 2D solution works, and the expected answer is exactly the iteration-direction trick shown here — stating *why* the direction matters (not just that it does) is what separates a memorized answer from a real understanding. A strong signal in interviews is proactively naming which variant a new problem is (0/1 vs unbounded) before writing any code, since that one classification decision determines the entire recurrence and iteration order that follows.

## 8. Memory Hook

**"Once means backwards, forever means forwards."** 0/1 knapsack (each item usable *once*) needs the 1D capacity loop to run **backwards**, so a used-up item's old value survives to be read; unbounded knapsack (items usable *forever*) needs it to run **forwards**, so an item's freshly-updated value is immediately available for reuse within the same pass.
