# Sparse Table

## 1. Problem

The Segment Tree and Fenwick Tree both give O(log n) range queries — good enough when the array can change. But plenty of real problems hand you a **static** array (built once, never modified) and then hammer it with a huge number of range-minimum or range-maximum queries — think "given fixed terrain heights, answer a million queries of 'what's the lowest point between position i and j'." Paying O(log n) per query when the array never changes leaves speed on the table: if updates are off the table entirely, you can afford to spend more time upfront preprocessing in exchange for O(1) per query afterward.

A **Sparse Table** does exactly this: O(n log n) preprocessing time and space, producing O(1) answers to range-min (or range-max, or range-gcd) queries forever after, as long as the array never changes. The trick that makes O(1) query possible is embracing **overlapping** precomputed ranges — instead of needing an exact non-overlapping decomposition of `[l, r]` (which is what would force O(log n) work), a Sparse Table finds *two* precomputed power-of-two-sized ranges that together *cover* `[l, r]`, even if they overlap in the middle. That overlap is only safe because min and max are **idempotent**: taking the min of overlapping data doesn't change the answer, since counting the same minimum value "twice" still gives you that same minimum.

## 2. Analogy

Imagine you've precomputed the lowest temperature recorded during every possible power-of-two-length time window starting at every day of the year — the lowest temp over days [1-1], [1-2], [1-4], [1-8], ..., and the same starting from day 2, day 3, and so on. Now someone asks "what was the lowest temperature between day 5 and day 19?" (a 15-day span). Instead of scanning all 15 days, you find the largest power of two that fits — 8 — and grab two precomputed 8-day windows: days 5–12 and days 12–19. These two windows overlap by one day (day 12), but that's completely fine for "lowest temperature," because whatever the true minimum of the 15-day span is, it's captured in at least one of those two 8-day windows, and taking the min of the two window-minimums is still correct — the shared day being "double-counted" doesn't inflate or deflate a minimum. If you instead asked "what's the *total* rainfall between day 5 and day 19," that same overlapping-windows trick would badly overcount the rainfall on the shared day 12 — which is exactly why this technique is a min/max/gcd trick, not a sum trick.

## 3. Internal Flow

A Sparse Table stores `table[i][j]` = the answer (min, in this lesson) of the range starting at index `i` with length `2^j`, i.e., covering `arr[i .. i + 2^j - 1]`.

**Build:**
1. Base case, `j = 0`: `table[i][0] = arr[i]` for every `i` — a range of length `2^0 = 1` is just the single element itself.
2. For each `j` from 1 upward: `table[i][j] = min(table[i][j-1], table[i + 2^(j-1)][j-1])` — a length-`2^j` range starting at `i` is exactly the combination of two adjacent length-`2^(j-1)` ranges: one starting at `i`, the other starting halfway through, at `i + 2^(j-1)`. Both halves were already computed in the previous `j` iteration, so this step is O(1) per cell.
3. `j` only needs to go up to `log2(n)`, and there are `n` values of `i` per `j`, giving O(n log n) total preprocessing time and space. A small helper array `log[1..n]` (where `log[k] = floor(log2(k))`, itself buildable in O(n) via `log[k] = log[k // 2] + 1`) is precomputed so queries don't need to call `math.log` repeatedly.

**Query(l, r)** (inclusive range):
1. Compute `length = r - l + 1` and `j = log[length]` — the largest power of two that fits inside the query range without exceeding it.
2. Return `min(table[l][j], table[r - 2^j + 1][j])` — two length-`2^j` windows: one anchored at the query's left end (`l`), one anchored so it ends exactly at the query's right end (`r - 2^j + 1` through `r`). These two windows together fully cover `[l, r]`, possibly overlapping in the middle if `2 * 2^j > length` — and that overlap is exactly the trick this lesson is built around: it's harmless for min, because whichever window contains the true minimum, taking `min` of both windows' minimums still surfaces it.
3. No recursion, no loop — just two array lookups and one `min` call, hence O(1).

## 4. Example

Building a sparse table for range-minimum-query over `[5, 2, 4, 7, 1, 3, 6]`, printing a selection of the precomputed `table[i][j]` entries, then answering several O(1) queries and cross-checking each against a direct scan:

```python
import math

class SparseTable:
    def __init__(self, arr, func=min):
        self.n = len(arr)
        self.func = func
        self.log = [0] * (self.n + 1)
        for i in range(2, self.n + 1):
            self.log[i] = self.log[i // 2] + 1
        k = self.log[self.n] + 1
        self.table = [[0] * k for _ in range(self.n)]
        for i in range(self.n):
            self.table[i][0] = arr[i]
        for j in range(1, k):
            for i in range(self.n - (1 << j) + 1):
                self.table[i][j] = func(
                    self.table[i][j - 1],
                    self.table[i + (1 << (j - 1))][j - 1],
                )

    def query(self, l, r):
        # inclusive range [l, r]
        length = r - l + 1
        j = self.log[length]
        return self.func(self.table[l][j], self.table[r - (1 << j) + 1][j])


arr = [5, 2, 4, 7, 1, 3, 6]
st = SparseTable(arr, func=min)
print(f"array: {arr}\n")

print("precomputed table[i][j] entries (value = min of arr[i .. i+2^j-1]):")
for i in range(st.n):
    for j in range(len(st.table[i])):
        if i + (1 << j) <= st.n:
            print(f"  table[{i}][{j}] = min(arr[{i}..{i + (1 << j) - 1}]) = {st.table[i][j]}")

print()
queries = [(0, 3), (2, 6), (1, 4), (0, 6)]
for l, r in queries:
    expected = min(arr[l:r + 1])
    got = st.query(l, r)
    print(f"query({l}, {r}) -> table lookup = {got}, direct min(arr[{l}:{r + 1}]) = {expected}")

print("\n--- why overlapping ranges are safe for min but NOT for sum ---")
sub = arr[2:6]  # [4, 7, 1, 3]
print(f"range arr[2..5] = {sub}")
half1 = arr[2:4]   # [4, 7]  (2^1 = 2 elements)
half2 = arr[4:6]   # [1, 3]  (2^1 = 2 elements, overlapping coverage strategy uses two length-2 blocks)
print(f"decomposed (sparse-table style) into two overlapping-allowed length-2 blocks: {half1} and {half2}")

min_direct = min(sub)
min_combined = min(min(half1), min(half2))
print(f"min via direct scan: {min_direct}")
print(f"min via combining two blocks (min is idempotent, overlap-safe): {min_combined}  -> matches: {min_combined == min_direct}")

sum_direct = sum(sub)
sum_combined = sum(half1) + sum(half2)
print(f"sum via direct scan: {sum_direct}")
print(f"sum via combining two blocks the same way: {sum_combined}  -> matches: {sum_combined == sum_direct}")

print("\nNow force actual overlap (blocks share an index) to show sum double-counts:")
block_a = arr[1:5]  # [2, 4, 7, 1] length 4, indices 1-4
block_b = arr[3:7]  # [7, 1, 3, 6] length 4, indices 3-6, overlapping indices 3,4 with block_a
full_range = arr[1:7]  # indices 1..6
print(f"block_a = arr[1:5] = {block_a}")
print(f"block_b = arr[3:7] = {block_b}  (indices 3,4 overlap with block_a)")
print(f"true min(arr[1..6]) = {min(full_range)}, min(block_a) combined with min(block_b) = {min(min(block_a), min(block_b))} -> still correct, overlap harmless")
print(f"true sum(arr[1..6]) = {sum(full_range)}, sum(block_a) + sum(block_b) = {sum(block_a) + sum(block_b)} -> WRONG, double-counts overlapping indices 3 and 4")
```

Actual output:

```text
array: [5, 2, 4, 7, 1, 3, 6]

precomputed table[i][j] entries (value = min of arr[i .. i+2^j-1]):
  table[0][0] = min(arr[0..0]) = 5
  table[0][1] = min(arr[0..1]) = 2
  table[0][2] = min(arr[0..3]) = 2
  table[1][0] = min(arr[1..1]) = 2
  table[1][1] = min(arr[1..2]) = 2
  table[1][2] = min(arr[1..4]) = 1
  table[2][0] = min(arr[2..2]) = 4
  table[2][1] = min(arr[2..3]) = 4
  table[2][2] = min(arr[2..5]) = 1
  table[3][0] = min(arr[3..3]) = 7
  table[3][1] = min(arr[3..4]) = 1
  table[3][2] = min(arr[3..6]) = 1
  table[4][0] = min(arr[4..4]) = 1
  table[4][1] = min(arr[4..5]) = 1
  table[5][0] = min(arr[5..5]) = 3
  table[5][1] = min(arr[5..6]) = 3
  table[6][0] = min(arr[6..6]) = 6

query(0, 3) -> table lookup = 2, direct min(arr[0:4]) = 2
query(2, 6) -> table lookup = 1, direct min(arr[2:7]) = 1
query(1, 4) -> table lookup = 1, direct min(arr[1:5]) = 1
query(0, 6) -> table lookup = 1, direct min(arr[0:7]) = 1

--- why overlapping ranges are safe for min but NOT for sum ---
range arr[2..5] = [4, 7, 1, 3]
decomposed (sparse-table style) into two overlapping-allowed length-2 blocks: [4, 7] and [1, 3]
min via direct scan: 1
min via combining two blocks (min is idempotent, overlap-safe): 1  -> matches: True
sum via direct scan: 15
sum via combining two blocks the same way: 15  -> matches: True

Now force actual overlap (blocks share an index) to show sum double-counts:
block_a = arr[1:5] = [2, 4, 7, 1]
block_b = arr[3:7] = [7, 1, 3, 6]  (indices 3,4 overlap with block_a)
true min(arr[1..6]) = 1, min(block_a) combined with min(block_b) = 1 -> still correct, overlap harmless
true sum(arr[1..6]) = 23, sum(block_a) + sum(block_b) = 31 -> WRONG, double-counts overlapping indices 3 and 4
```

Look at `query(2, 6)`: length is 5, `log[5] = 2`, so `j = 2` and the two windows compared are `table[2][2]` (covering `arr[2..5]`) and `table[6-4+1][2] = table[3][2]` (covering `arr[3..6]`) — these two length-4 windows overlap on indices 3, 4, and 5, and the query still returns the correct answer, `1`, because overlapping on a `min` never breaks correctness. The final block directly forces the same kind of overlap (`block_a` covering indices 1–4 and `block_b` covering indices 3–6, sharing indices 3 and 4) and shows the two operations diverge concretely: `min` combining the two overlapping blocks still gives the exactly correct `1`, while `sum` combining them gives `31` against a true value of `23` — the shared indices 3 and 4 get added in twice.

## 5. Compare

- **Sparse Table vs Segment Tree**: a Sparse Table answers queries in O(1) versus a segment tree's O(log n), at the cost of O(n log n) preprocessing (versus O(n) build) and, critically, no update support at all — a segment tree supports O(log n) updates, a Sparse Table supports none without a full rebuild.
- **Sparse Table vs Fenwick Tree**: a Fenwick Tree is built for sum with point updates; a Sparse Table is built for min/max/gcd with **no** updates — they don't compete for the same problems, they solve genuinely different operation/mutability combinations.
- **Idempotent operations (min, max, gcd, bitwise AND/OR) vs non-idempotent (sum, product, xor with odd counts)**: the overlapping-ranges trick that gives a Sparse Table its O(1) query is only valid for operations where combining a value with itself changes nothing (`min(x, x) = x`) — this is the load-bearing property of the whole structure, not an incidental detail.

## 6. Common Mistakes

- **Applying the O(1)-query technique to range-sum.** As demonstrated directly above, overlapping ranges double-count shared elements under sum, giving a wrong (inflated) total — a Sparse Table's O(1) trick fundamentally requires an idempotent combining operation; sum, product, and xor (unless you're clever about parity) are not safe candidates.
- **Forgetting the array is static.** A Sparse Table doesn't support point updates or insertions at all without recomputing the entire `O(n log n)` table from scratch — reaching for a Sparse Table in a problem that mixes queries with updates (even occasional ones) is a structural mismatch; use a Segment Tree instead.
- **Off-by-one in the `j = log[length]` window selection.** Using `log[length] + 1` or `log[length - 1]` instead of `log[length]` picks a window size that's too large or too small to safely combine — the two chosen windows must each have length `2^j` where `2^j <= length`, and `log[length]` is defined precisely to be the largest such `j`.
- **Recomputing `log2` per query instead of precomputing the `log` array.** Calling `math.log2(length)` inside every query call reintroduces non-constant overhead (floating point log calls aren't free, and floating-point imprecision can round `log2` to the wrong integer near powers of two) — the standard approach precomputes an integer `log` array in O(n) upfront specifically to keep queries truly O(1) and exact.
- **Sizing the `table` array's second dimension too small.** The number of columns needed is `floor(log2(n)) + 1`; under-sizing it causes an index error the first time a query or build step needs the largest precomputed window for the full array length.

## 7. Interview Angle

Sparse Tables are less commonly asked to implement from scratch in a standard interview than Segment/Fenwick Trees, but they come up directly in "static range minimum query" framings and in competitive-programming-flavored interview rounds (e.g., "answer Q queries on a fixed array as fast as possible"). The strongest signal to give an interviewer is naming the *constraint* that makes O(1) queries possible: explicitly stating "this only works because min/max is idempotent, so overlapping precomputed ranges don't corrupt the answer — it wouldn't work for sum" shows you understand the mechanism, not just the API. A common follow-up is "what if the array *can* change occasionally?" — the expected answer is that a Sparse Table is the wrong structure once updates are needed at all; you'd fall back to a Segment Tree, trading O(1) queries for the ability to update in O(log n).

## 8. Memory Hook

**"Precompute every power-of-two window once; answer forever by picking two that overlap in the middle."** The entire structure exists to trade one-time O(n log n) preprocessing for permanent O(1) queries, and the "two overlapping windows" trick that makes that possible only holds together because min/max don't care about being counted twice.
