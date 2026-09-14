# Fenwick Tree (Binary Indexed Tree)

## 1. Problem

The previous file solved range-query-plus-update with a Segment Tree: O(log n) for both, but at the cost of a recursive tree structure, a `4 * n`-sized backing array, and separate build/query/update recursive functions. For the specific — and extremely common — case of **prefix sums with point updates** (no min/max, no range updates, just "sum from the start up to index i" and "add a value at index i"), that much machinery is overkill. A **Fenwick Tree**, also called a **Binary Indexed Tree (BIT)**, solves exactly this narrower problem in O(log n) per operation using a single flat array and a small amount of bit manipulation — no recursion, no tree-node objects, roughly a fifth of the code of a segment tree.

The key trick is that a Fenwick Tree never explicitly stores a tree at all. It stores one array where index `i` holds a **partial sum** covering a range whose length is determined entirely by `i`'s lowest set bit — extracted with the bit trick `i & (-i)`. Walking "up" the implicit tree during a query, or "up" during an update, is just repeatedly adding or subtracting `i & (-i)` from `i`. This is what makes a Fenwick Tree both simpler to implement and, in practice, faster than a segment tree for pure prefix-sum workloads.

## 2. Analogy

Imagine splitting a long hallway of numbered lockers into groups whose sizes are always powers of two, where the group boundaries are chosen based on each locker number's binary representation rather than fixed even splits. Locker 8 (`1000` in binary) is responsible for summarizing a big block of 8 lockers behind it; locker 12 (`1100`) is responsible for a smaller block of 4; locker 10 (`1010`) covers a block of just 2. To get the total for "lockers 1 through 13," you don't open every locker — you jump straight to a handful of block-summary lockers whose sizes happen to add up exactly to 13, guided purely by the binary digits of the number 13 itself. That's precisely what `i & (-i)` computes at each step: "how big is the block this index summarizes," letting you jump by that exact amount instead of walking one locker at a time.

## 3. Internal Flow

A Fenwick Tree is a single array `tree[1..n]`, **1-indexed** — index 0 is deliberately unused because the bit trick that powers both operations breaks at index 0 (explained below). Index `i` stores the sum of a range of the original array ending at `i`, whose length is `i & (-i)` — the value of `i`'s lowest set bit. For example, index `12` (binary `1100`, lowest set bit `100` = 4) covers a range of length 4 ending at index 12; index `10` (binary `1010`, lowest set bit `10` = 2) covers a range of length 2 ending at index 10.

**Update(i, delta)** — add `delta` to the conceptual original array at position `i`, propagating the change to every partial-sum entry that includes index `i`:
1. While `i <= n`: add `delta` to `tree[i]`.
2. Advance `i` by its own lowest set bit: `i += i & (-i)`. This moves to the next larger block that also covers position `i`.
3. Repeat until `i` exceeds `n`. This touches O(log n) indices.

**Prefix_sum(i)** — compute the sum of the original array from index 1 to `i`:
1. Initialize `total = 0`.
2. While `i > 0`: add `tree[i]` to `total`.
3. Subtract `i`'s lowest set bit from itself: `i -= i & (-i)`. This drops down to the next block needed to keep covering the remaining prefix.
4. Repeat until `i` reaches 0. Also O(log n) steps.

**Range_sum(l, r)** — the operation actually needed most of the time — is simply `prefix_sum(r) - prefix_sum(l - 1)`: the sum up to `r`, minus everything before `l`, leaving exactly the sum of `[l, r]`. This only works because prefix sums are invertible via subtraction, which is also exactly why a Fenwick Tree can't directly generalize to min/max (you can't "subtract out" a minimum the way you can subtract out a sum).

**Why 1-indexing is mandatory:** the bit trick `i & (-i)` isolates the lowest set bit of `i`. At `i = 0`, every bit is 0, so `i & (-i) == 0` — both `update` and `prefix_sum` would compute a "step size" of zero and loop forever without `i` ever changing. The standard convention sidesteps this entirely by treating the original array as 1-indexed (`tree[1]` corresponds to `arr[0]`, `tree[2]` to `arr[1]`, and so on) and simply never calling either operation with `i = 0` as the target index — index 0 in `tree` is left permanently unused.

## 4. Example

Building a Fenwick Tree over `[3, 2, -1, 6, 5, 4, -3, 3]` (using the standard 1-indexed convention: array position 0 maps to Fenwick index 1, and so on), tracing exactly which indices `i & (-i)` touches on each `update`, then running `prefix_sum` and `range_sum`:

```python
class FenwickTree:
    def __init__(self, n):
        self.n = n
        self.tree = [0] * (n + 1)  # 1-indexed, tree[0] unused

    def update(self, i, delta, trace=False):
        touched = []
        while i <= self.n:
            self.tree[i] += delta
            touched.append(i)
            i += i & (-i)
        if trace:
            print(f"  indices touched: {touched}")

    def prefix_sum(self, i, trace=False):
        total = 0
        touched = []
        while i > 0:
            total += self.tree[i]
            touched.append(i)
            i -= i & (-i)
        if trace:
            print(f"  indices touched: {touched}")
        return total

    def range_sum(self, l, r):
        return self.prefix_sum(r) - self.prefix_sum(l - 1)


arr = [3, 2, -1, 6, 5, 4, -3, 3]
n = len(arr)
ft = FenwickTree(n)
print(f"array (0-indexed for humans): {arr}")
print("building fenwick tree with 1-indexed update calls:\n")
for idx, val in enumerate(arr):
    fenwick_idx = idx + 1  # 1-indexing convention
    print(f"update(i={fenwick_idx}, delta={val})  # represents arr[{idx}]")
    ft.update(fenwick_idx, val, trace=True)

print(f"\nfinal fenwick internal array (index 0 unused): {ft.tree}\n")

print("prefix_sum(5)  # sum of arr[0..4] = 3+2-1+6+5 = 15")
result = ft.prefix_sum(5, trace=True)
print(f"result = {result}\n")

print("range_sum(3, 6)  # sum of arr[2..5] (1-indexed 3..6) = -1+6+5+4 = 14")
print(f"= prefix_sum(6) - prefix_sum(2) = {ft.prefix_sum(6)} - {ft.prefix_sum(2)} = {ft.range_sum(3, 6)}")

print("\n--- demonstrating why 0-indexing breaks it ---")
print("If we naively call update(i=0, ...) treating index 0 as valid (0-indexed style):")


def broken_update(tree, n, i, delta):
    steps = 0
    while i <= n and steps < 5:
        tree[i] += delta
        steps += 1
        step = i & (-i)
        print(f"  i={i}, i & -i = {step}")
        if i == 0:
            print("  i & -i = 0 at i=0 -> infinite loop (i never advances)! stopping after 5 iterations to prove it.")
        i += step


broken_tree = [0] * (n + 1)
broken_update(broken_tree, n, 0, 3)
```

Actual output:

```text
array (0-indexed for humans): [3, 2, -1, 6, 5, 4, -3, 3]
building fenwick tree with 1-indexed update calls:

update(i=1, delta=3)  # represents arr[0]
  indices touched: [1, 2, 4, 8]
update(i=2, delta=2)  # represents arr[1]
  indices touched: [2, 4, 8]
update(i=3, delta=-1)  # represents arr[2]
  indices touched: [3, 4, 8]
update(i=4, delta=6)  # represents arr[3]
  indices touched: [4, 8]
update(i=5, delta=5)  # represents arr[4]
  indices touched: [5, 6, 8]
update(i=6, delta=4)  # represents arr[5]
  indices touched: [6, 8]
update(i=7, delta=-3)  # represents arr[6]
  indices touched: [7, 8]
update(i=8, delta=3)  # represents arr[7]
  indices touched: [8]

final fenwick internal array (index 0 unused): [0, 3, 5, -1, 10, 5, 9, -3, 19]

prefix_sum(5)  # sum of arr[0..4] = 3+2-1+6+5 = 15
  indices touched: [5, 4]
result = 15

range_sum(3, 6)  # sum of arr[2..5] (1-indexed 3..6) = -1+6+5+4 = 14
= prefix_sum(6) - prefix_sum(2) = 19 - 5 = 14

--- demonstrating why 0-indexing breaks it ---
If we naively call update(i=0, ...) treating index 0 as valid (0-indexed style):
  i=0, i & -i = 0
  i & -i = 0 at i=0 -> infinite loop (i never advances)! stopping after 5 iterations to prove it.
  i=0, i & -i = 0
  i & -i = 0 at i=0 -> infinite loop (i never advances)! stopping after 5 iterations to prove it.
  i=0, i & -i = 0
  i & -i = 0 at i=0 -> infinite loop (i never advances)! stopping after 5 iterations to prove it.
  i=0, i & -i = 0
  i & -i = 0 at i=0 -> infinite loop (i never advances)! stopping after 5 iterations to prove it.
  i=0, i & -i = 0
  i & -i = 0 at i=0 -> infinite loop (i never advances)! stopping after 5 iterations to prove it.
```

Notice `update(i=1, ...)` touches indices `[1, 2, 4, 8]` — each step doubles the lowest-set-bit jump (1 → 2 → 4 → 8), exactly matching binary `0001 → 0010 → 0100 → 1000`. Also notice `prefix_sum(5)` only touches **2** indices (`[5, 4]`) out of 8 total array elements — that's O(log n) in action, not a full O(n) scan. And the deliberate demonstration at the bottom proves the 1-indexing rule isn't just convention: calling `update` with `i = 0` computes `i & (-i) = 0` every single iteration, so `i` never advances past 0 and the loop would run forever if not artificially capped — this is *why* index 0 is permanently unused and every real index passed to `update`/`prefix_sum` must be `>= 1`.

## 5. Compare

- **Fenwick Tree vs Segment Tree**: both give O(log n) query and update, but a Fenwick Tree needs only a single flat array and ~10 lines of iterative bit-manipulation logic, versus a segment tree's recursive build/query/update over an implicit binary tree — pick Fenwick whenever the operation is a plain sum (or another invertible operation) with point updates and no range updates needed; pick segment tree for min/max/gcd or when range updates (lazy propagation) are required.
- **Prefix sum query vs range sum query**: `prefix_sum(i)` answers "sum from the start through `i`"; `range_sum(l, r)` — what's actually needed in most real problems — is derived as `prefix_sum(r) - prefix_sum(l - 1)`, never confuse the two or you'll silently include extra elements before `l`.
- **Fenwick Tree vs plain prefix-sum array**: a plain prefix-sum array gives O(1) queries but O(n) updates (any change invalidates every later prefix); a Fenwick Tree trades a little query speed (O(log n) instead of O(1)) for dramatically faster updates (O(log n) instead of O(n)) — worth it whenever updates aren't rare.

## 6. Common Mistakes

- **Using 0-indexed arrays directly with a Fenwick Tree.** As demonstrated above, calling `update`/`prefix_sum` with index 0 makes `i & (-i)` evaluate to 0, which breaks the traversal (the index never advances). The fix is the standard convention: treat the Fenwick Tree's valid indices as `1..n`, and map original array position `idx` to Fenwick index `idx + 1`.
- **Confusing prefix-sum query with range-sum query.** Calling `prefix_sum(r)` alone when you actually need the sum of `[l, r]` silently includes everything before `l` too — the correct range sum is always `prefix_sum(r) - prefix_sum(l - 1)`, and forgetting the `- prefix_sum(l - 1)` term is an easy oversight under time pressure.
- **Passing the wrong array size when constructing the tree.** The backing array must be sized `n + 1` (for 1-indexing with `n` real elements) — sizing it exactly `n` causes an index-out-of-range as soon as an update or query touches the highest valid index.
- **Assuming a Fenwick Tree supports range updates as easily as point updates.** A plain Fenwick Tree (as shown above) only supports point update + range query cleanly; supporting range update + point query (or both) requires a different formulation (e.g., a difference-array trick or two Fenwick Trees together) — it isn't a free extension of the basic structure.
- **Reaching for a Fenwick Tree for min/max instead of sum.** Because `range_sum` relies on subtraction (`prefix_sum(r) - prefix_sum(l-1)`) to "undo" everything before `l`, and there's no way to "undo" a minimum the same way, a Fenwick Tree is not a drop-in min/max structure — that's what a Segment Tree or Sparse Table is for.

## 7. Interview Angle

Fenwick Tree questions usually show up as "implement prefix sum with updates" or as the backbone of "count of smaller/larger elements to the right" style problems, where coordinates get compressed into a `1..n` index space and a Fenwick Tree tracks running counts. Interviewers who know the structure well will often ask you to justify the O(log n) bound by connecting it to binary representation directly — "why does `i & (-i)` guarantee termination in O(log n) steps?" (each step in `update` sets a higher bit, and there are only `log2(n)` bits total; each step in `prefix_sum` clears the lowest set bit, and there are at most `log2(n)` set bits to clear). Also expect the trade-off question directly: "why use a Fenwick Tree instead of a segment tree here?" — the expected answer is implementation simplicity and lower constant-factor overhead for the specific case of sum + point update, not a difference in asymptotic complexity.

## 8. Memory Hook

**"`i & (-i)` is the size of the block you just covered — jump by it."** Every operation is just repeatedly asking "how big is the chunk this index is responsible for" and moving by exactly that amount — up (adding) to propagate an update, down (subtracting) to accumulate a prefix sum. No recursion, no tree objects — just binary arithmetic doing a tree's job.
