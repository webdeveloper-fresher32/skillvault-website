# Segment Tree

## 1. Problem

Suppose you have an array and need to repeatedly answer "what's the sum (or min, or max) of elements from index `l` to `r`?", while also occasionally updating individual elements. A naive approach recomputes the range sum by scanning `arr[l..r]` every single query — O(n) per query. If updates are also allowed, you might try precomputing a prefix-sum array for O(1) queries, but then a single point update forces you to recompute every prefix sum from that point onward — O(n) per update. Neither approach is good when both queries and updates are frequent and the array is large: you need a structure where **both** operations are fast, not just one of them.

A **Segment Tree** answers both range queries and point updates in O(log n), by organizing the array into a binary tree where each node represents the answer (sum/min/max) for a contiguous *segment* of the array, and a parent's value is always derived by combining its two children's segments. Updating one array element only touches the O(log n) nodes on the root-to-leaf path covering that index, and answering a range query only touches the O(log n) nodes whose segments are needed to cover `[l, r]` — a solid middle ground between "fast query, slow update" (prefix sums) and "fast update, slow query" (naive scan).

## 2. Analogy

Picture a company's org chart used for reporting total sales. Each individual salesperson (a leaf) reports their own number. Each team lead (an internal node) reports the sum of their direct reports. Each regional manager reports the sum of their team leads' sums, all the way up to the CEO at the root, who holds the grand total. If one salesperson's number changes, you don't recompute the whole company total from scratch — you only need to update that person's manager, then their manager's manager, all the way up to the CEO: one path, not everyone. And if someone asks "what's the total for the West region plus half of the Central region," you don't ask every individual salesperson — you find the smallest set of already-computed subtotals (team leads, or regional totals) that exactly cover the requested scope, and add just those together. That's exactly how a segment tree answers both updates and range queries without touching every element.

## 3. Internal Flow

A segment tree over an array of size `n` is stored implicitly in an array `tree` (commonly sized `4 * n` to safely hold a possibly-unbalanced binary tree), where node `i`'s children live at `2*i + 1` and `2*i + 2`. Each tree node corresponds to a range `[lo, hi]` of the original array; leaves correspond to single indices (`lo == hi`).

**Build (recursive, root to leaves):**
1. If `lo == hi` (a leaf), store `arr[lo]` directly at this node.
2. Otherwise, split at `mid = (lo + hi) // 2`, recursively build the left child over `[lo, mid]` and the right child over `[mid + 1, hi]`.
3. This node's value is the combination (sum/min/max) of its two children's values, computed *after* both children finish building — build is a **post-order** traversal.

**Query(l, r) (recursive, checking overlap at every node):**
1. At each node covering `[lo, hi]`, compare against the query range `[l, r]`:
   - **No overlap** (`r < lo` or `hi < l`): this segment is irrelevant — return the identity value (0 for sum, +infinity for min, -infinity for max).
   - **Full overlap** (`l <= lo` and `hi <= r`): this node's precomputed value answers this entire segment directly — return it, no need to recurse further.
   - **Partial overlap**: recurse into both children and combine their results.
2. The recursion naturally stops descending as soon as a node is either fully inside or fully outside the query range, which is what keeps this O(log n) instead of O(n) — only O(log n) nodes along the boundary of `[l, r]` require partial-overlap recursion into both children.

**Update(idx, value) (recursive, single root-to-leaf path):**
1. At each node covering `[lo, hi]`, if `lo == hi == idx` (the target leaf), overwrite its value directly.
2. Otherwise, recurse into whichever child's range contains `idx` (left if `idx <= mid`, right otherwise) — only one child, never both.
3. After the recursive call returns, recompute this node's value from its two children — the update "bubbles up" the change from the leaf back to the root.

**Lazy propagation** extends this to O(log n) **range** updates (e.g., "add 5 to every element from index 3 to 7"). Instead of eagerly updating every leaf in the range immediately, each node gets a "pending" lazy flag recording an update that applies to its whole segment but hasn't yet been pushed down to its children. Before a query or update recurses into a node's children, it must first **push down** any pending lazy value on that node — apply it to both children (updating their stored values and setting their own lazy flags) and clear the parent's lazy flag. Skipping this push-down step is the single most common way lazy propagation implementations go wrong: children end up read with stale values because a pending update sitting on their parent was never applied before descending.

## 4. Example

Building a segment tree for range-sum over `[2, 4, 5, 7, 8, 9]`, tracing a `query(1, 4)` that spans multiple tree levels (partial overlap on both sides, forcing recursion into both children at the top), then an `update`:

```python
class SegmentTree:
    def __init__(self, arr):
        self.n = len(arr)
        self.tree = [0] * (4 * self.n)
        self._build(arr, 0, 0, self.n - 1)

    def _build(self, arr, node, lo, hi):
        if lo == hi:
            self.tree[node] = arr[lo]
            return
        mid = (lo + hi) // 2
        left, right = 2 * node + 1, 2 * node + 2
        self._build(arr, left, lo, mid)
        self._build(arr, right, mid + 1, hi)
        self.tree[node] = self.tree[left] + self.tree[right]

    def query(self, l, r):
        return self._query(0, 0, self.n - 1, l, r)

    def _query(self, node, lo, hi, l, r, depth=0):
        indent = "  " * depth
        print(f"{indent}_query(node={node}, lo={lo}, hi={hi}, l={l}, r={r})")
        if r < lo or hi < l:
            print(f"{indent}-> out of range, return 0")
            return 0
        if l <= lo and hi <= r:
            print(f"{indent}-> fully inside range, return tree[{node}]={self.tree[node]}")
            return self.tree[node]
        mid = (lo + hi) // 2
        left_sum = self._query(2 * node + 1, lo, mid, l, r, depth + 1)
        right_sum = self._query(2 * node + 2, mid + 1, hi, l, r, depth + 1)
        total = left_sum + right_sum
        print(f"{indent}-> combine {left_sum} + {right_sum} = {total}")
        return total

    def update(self, idx, value):
        self._update(0, 0, self.n - 1, idx, value)

    def _update(self, node, lo, hi, idx, value):
        if lo == hi:
            self.tree[node] = value
            return
        mid = (lo + hi) // 2
        if idx <= mid:
            self._update(2 * node + 1, lo, mid, idx, value)
        else:
            self._update(2 * node + 2, mid + 1, hi, idx, value)
        self.tree[node] = self.tree[2 * node + 1] + self.tree[2 * node + 2]


arr = [2, 4, 5, 7, 8, 9]
st = SegmentTree(arr)
print(f"array: {arr}")
print(f"internal tree array: {st.tree}\n")

print("query(1, 4)  # sum of arr[1..4] = 4+5+7+8 = 24, spans multiple tree levels")
result = st.query(1, 4)
print(f"result = {result}\n")

print("update(2, 10)  # arr[2] changes from 5 to 10")
st.update(2, 10)
print(f"internal tree array after update: {st.tree}")
print(f"query(1, 4) again = {st.query(1, 4)}  # expect 4+10+7+8 = 29")
```

Actual output:

```text
array: [2, 4, 5, 7, 8, 9]
internal tree array: [35, 11, 24, 6, 5, 15, 9, 2, 4, 0, 0, 7, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

query(1, 4)  # sum of arr[1..4] = 4+5+7+8 = 24, spans multiple tree levels
_query(node=0, lo=0, hi=5, l=1, r=4)
  _query(node=1, lo=0, hi=2, l=1, r=4)
    _query(node=3, lo=0, hi=1, l=1, r=4)
      _query(node=7, lo=0, hi=0, l=1, r=4)
      -> out of range, return 0
      _query(node=8, lo=1, hi=1, l=1, r=4)
      -> fully inside range, return tree[8]=4
    -> combine 0 + 4 = 4
    _query(node=4, lo=2, hi=2, l=1, r=4)
    -> fully inside range, return tree[4]=5
  -> combine 4 + 5 = 9
  _query(node=2, lo=3, hi=5, l=1, r=4)
    _query(node=5, lo=3, hi=4, l=1, r=4)
    -> fully inside range, return tree[5]=15
    _query(node=6, lo=5, hi=5, l=1, r=4)
    -> out of range, return 0
  -> combine 15 + 0 = 15
-> combine 9 + 15 = 24
result = 24

update(2, 10)  # arr[2] changes from 5 to 10
internal tree array after update: [40, 16, 24, 6, 10, 15, 9, 2, 4, 0, 0, 7, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
_query(node=0, lo=0, hi=5, l=1, r=4)
  _query(node=1, lo=0, hi=2, l=1, r=4)
    _query(node=3, lo=0, hi=1, l=1, r=4)
      _query(node=7, lo=0, hi=0, l=1, r=4)
      -> out of range, return 0
      _query(node=8, lo=1, hi=1, l=1, r=4)
      -> fully inside range, return tree[8]=4
    -> combine 0 + 4 = 4
    _query(node=4, lo=2, hi=2, l=1, r=4)
    -> fully inside range, return tree[4]=10
  -> combine 4 + 10 = 14
  _query(node=2, lo=3, hi=5, l=1, r=4)
    _query(node=5, lo=3, hi=4, l=1, r=4)
    -> fully inside range, return tree[5]=15
    _query(node=6, lo=5, hi=5, l=1, r=4)
    -> out of range, return 0
  -> combine 15 + 0 = 15
-> combine 14 + 15 = 29
query(1, 4) again = 29  # expect 4+10+7+8 = 29
```

Trace the first query: at the root `[0,5]`, the query range `[1,4]` is a partial overlap, so it recurses into both children. The left child `[0,2]` is also partial (splits further into `[0,1]` and `[2,2]`), and the right child `[3,5]` is also partial (splits into `[3,4]` and `[5,5]`). Notice `[3,4]` (node 5) is **fully inside** `[1,4]` and returns its precomputed value `15` immediately with no further recursion — that's the O(log n) saving in action: instead of visiting the two individual leaves for indices 3 and 4, one already-combined node answers both at once. After `update(2, 10)`, only the path from the leaf at index 2 (node 4) up through node 1 up through the root gets touched — node 5 (`[3,4]`) is completely untouched by the update, which is why `-> fully inside range, return tree[5]=15` is identical in both query traces.

## 5. Compare

- **Segment Tree vs prefix-sum array**: prefix sums give O(1) range-sum queries but O(n) updates (a single change invalidates every later prefix); a segment tree gives O(log n) for both, a better trade-off whenever updates aren't rare.
- **Segment Tree vs Fenwick Tree (next file)**: a Fenwick Tree matches a segment tree's O(log n) for prefix-sum query and point update with a much smaller, simpler implementation, but a Fenwick Tree is naturally restricted to invertible operations like sum (thanks to subtraction-based range derivation) — a segment tree generalizes cleanly to min/max/gcd, and to range updates via lazy propagation, neither of which Fenwick Trees handle as directly.
- **Segment Tree vs Sparse Table (file 04)**: a Sparse Table answers min/max range queries in O(1) after O(n log n) preprocessing, faster per-query than a segment tree's O(log n) — but a Sparse Table is only for **static** arrays with no updates at all; a segment tree supports updates, a Sparse Table does not (without a full rebuild).

## 6. Common Mistakes

- **Off-by-one errors in range boundaries during recursive splitting.** Mixing inclusive `[lo, hi]` conventions with exclusive-style loop logic (or vice versa) causes silent boundary bugs — e.g., using `mid` in both children (`[lo, mid]` and `[mid, hi]`) instead of `[lo, mid]` and `[mid + 1, hi]` double-counts index `mid` and can lead to infinite recursion or wrong sums.
- **Forgetting to push down lazy-propagation flags before recursing into children.** If a node has a pending lazy update representing "this whole segment's leaves need +5" and a subsequent query or update recurses into that node's children without first applying and clearing the lazy flag, the children are read or written with stale values that don't reflect the pending update.
- **Using the wrong identity value for "no overlap" across different operations.** Sum's identity is `0`, but min's is `+infinity` and max's is `-infinity` — hardcoding `0` as the "no overlap" return value for a min-segment-tree silently corrupts every query that touches an out-of-range branch (since `min(real_value, 0)` is wrong whenever all real values are positive).
- **Sizing the `tree` array too small.** `4 * n` is the standard safe bound for a segment tree stored as an implicit array with `2*node+1`/`2*node+2` indexing; sizing it as `2 * n` or exactly `n` (as you might for a simple binary heap) causes index-out-of-range errors for unbalanced trees where `n` isn't a power of two.
- **Recomputing a node's value from the wrong children after an update.** After the recursive `_update` call returns from either the left or right subtree, the current node's value must be recombined from *both* children (`tree[left] + tree[right]`), not just copied from whichever branch the update happened to walk into — forgetting this leaves stale ancestor values that silently corrupt future queries.

## 7. Interview Angle

Segment trees are a step up from "know the concept" interviews — they show up in problems explicitly phrased as "range sum/min/max query with updates" (e.g., LeetCode's "Range Sum Query - Mutable"), and interviewers will usually accept either a segment tree or a Fenwick Tree for sum-based versions, but will specifically ask for a segment tree if the operation is min/max/gcd (non-invertible) or if range updates are required. Be ready to justify the `4 * n` array sizing, walk through why query is O(log n) (the recursion only branches into both children O(log n) times total, at the boundary nodes — most of the tree is pruned by the full-overlap/no-overlap short-circuits), and explain lazy propagation conceptually even if you don't implement it live — "defer applying an update to children until they're actually visited" is usually the answer interviewers are listening for.

## 8. Memory Hook

**"Combine only what you must, update only what changed."** A segment tree's value at any node is a pre-combined answer for a fixed segment; queries stop descending the instant a node's segment is fully in or fully out of range, and updates only ever touch the single root-to-leaf path of the changed index — that discipline is the entire source of the O(log n) speed.
