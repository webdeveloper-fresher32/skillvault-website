# DSA Cheatsheet

Dense, instant-reference tables and code skeletons — organized by what you're looking up, not by chapter. Complexities and code shapes here are pulled directly from the course phases; the notes point back to the lesson where each idea is taught in full.

---

## Data Structure Operation Costs

| Structure/Algorithm | Time | Space | Notes |
|---|---|---|---|
| Array — access by index | O(1) | O(n) | Contiguous memory, direct offset calculation |
| Array — search (unsorted) | O(n) | — | Must scan; O(log n) if sorted (binary search) |
| Array — insert/delete at end | O(1) amortized | — | Python list append; occasional resize/copy |
| Array — insert/delete at start/middle | O(n) | — | Every element after the index must shift |
| Singly/doubly linked list — access/search | O(n) | O(n) | No random access, must walk from head |
| Linked list — insert/delete at head | O(1) | — | Just repoint the head pointer |
| Linked list — insert/delete at tail | O(n) singly / O(1) doubly-with-tail-ref | — | Singly needs a full walk unless a tail pointer is kept |
| Linked list — insert/delete once node is found | O(1) | — | Unlinking is pointer rewiring, not shifting |
| Stack — push/pop/peek | O(1) / O(1) amortized | O(n) | Backed by a Python list, operate at the end only |
| Queue/deque — append/appendleft/pop/popleft | O(1) | O(n) | Use `collections.deque`; `list.pop(0)` is O(n) — avoid it |
| Monotonic stack — total work across a full pass | O(n) amortized | O(n) | Each element pushed once, popped at most once (≤ 2n ops) |
| Hash map/set — insert/search/delete (average) | O(1) | O(n) | Direct-indexed buckets via hash function |
| Hash map/set — insert/search/delete (worst case) | O(n) | — | Pathological hash function / heavy collisions degrade toward linear scan |
| BST — search/insert/delete (average, balanced) | O(h) ≈ O(log n) | O(n) | h = tree height; balanced ⇒ h ≈ log n |
| BST — search/insert/delete (worst case, skewed) | O(n) | — | Sorted-order insertion with no rebalancing degenerates into a linked list (h = n) |
| AVL / Red-Black tree — search/insert/delete | O(log n) guaranteed | O(n) | Self-balancing rotations keep h = O(log n) even worst case |
| Binary heap — peek min/max | O(1) | O(n) | Root of the array-backed heap |
| Binary heap — insert / extract-min(max) | O(log n) each | — | Sift-up / sift-down along the height |
| Binary heap — build-heap from n elements | O(n) | — | Bottom-up heapify, not O(n log n) — a common surprise |
| Heap sort | O(n log n) time, O(1) extra space | — | Build-heap O(n) + n extractions at O(log n) each; not stable |
| Trie — insert/search/prefix-search | O(L) | O(total distinct characters across all inserted prefixes) | L = length of the word/prefix |
| Segment tree — build | O(n) | O(n) (array sized 4·n) | Recursive build over n leaves |
| Segment tree — range query / point update | O(log n) each | — | Height of the tree |
| Fenwick tree (BIT) — update / prefix-sum query | O(log n) each | O(n) | Range sum = prefix(r) − prefix(l−1), still O(log n) |
| Sparse table — build | O(n log n) | O(n log n) | Precomputes overlapping-window answers |
| Sparse table — range query (idempotent ops, e.g. min/max) | O(1) | — | No update support — any change needs a full rebuild |

---

## Algorithm Complexity Reference

| Structure/Algorithm | Time | Space | Notes |
|---|---|---|---|
| Two pointers (sorted array pair/triplet search) | O(n) | O(1) | Phase 2 — replaces an O(n²) nested-loop scan |
| Sliding window (variable/fixed size) | O(n) | O(k) or O(1) | Phase 2 — each index enters/exits the window once |
| Prefix sums — build / range-sum query | O(n) build, O(1) query | O(n) | Phase 2 — trades O(n) query into O(1) after preprocessing |
| Kadane's algorithm (maximum subarray sum) | O(n) | O(1) | Phase 2 — single pass, no window/prefix-sum needed |
| Fast/slow pointers (middle of list, cycle check) | O(n) | O(1) | Phase 3 — Floyd's cycle detection needs no extra hash set |
| Binary search (iterative or recursive) | O(log n) | O(1) iterative / O(log n) recursive | Phase 1 — requires sorted input |
| Merge sort | O(n log n) | O(n) | Phase 1/3 — `T(n) = 2T(n/2) + O(n)`, Master Theorem case 2; stable |
| Quicksort | O(n log n) average, O(n²) worst | O(log n) | Referenced in Phase 2/7 — degrades on adversarial/already-sorted input without good pivot choice |
| Heap sort | O(n log n) guaranteed | O(1) | Phase 7 — see heap row above; not stable |
| Tree traversal (preorder/inorder/postorder, DFS) | O(n) | O(h) call stack | Phase 6 |
| Tree traversal (level-order, BFS) | O(n) | O(w) queue (w = max width) | Phase 6 |
| Lowest Common Ancestor — BST | O(h) | O(1) | Phase 6 — iterative compare-and-descend |
| Lowest Common Ancestor — general binary tree | O(n) | O(h) | Phase 6 — recursive search |
| Graph BFS / DFS | O(V + E) | O(V) BFS queue+visited / O(V) worst-case DFS recursion stack | Phase 8 |
| Adjacency list vs matrix (space) | — | O(V + E) list / O(V²) matrix | Phase 8 — matrix costs V² regardless of actual edge count |
| Topological sort (Kahn's or DFS-based) | O(V + E) | O(V) | Phase 8 |
| Union-Find (path compression + union by rank) | ~O(α(n)) per op (amortized) | O(V) | Phase 8 — α = inverse Ackermann, effectively constant |
| Cycle detection (directed 3-color / undirected parent-track) | O(V + E) | O(V) | Phase 8 |
| Dijkstra's algorithm | O((V+E) log V) with binary heap, O(V²) array-based | O(V + E) | Phase 9 — requires non-negative edge weights |
| Bellman-Ford algorithm | O(V · E) | O(V) | Phase 9 — handles negative edges, detects negative cycles |
| Floyd-Warshall algorithm | O(V³) | O(V²) | Phase 9 — all-pairs shortest paths |
| Prim's algorithm (MST) | O(E log V) with heap, O(V²) array-based | O(V) | Phase 9 |
| Kruskal's algorithm (MST) | O(E log E) | O(V) | Phase 9 — dominated by sorting edges; Union-Find is near O(1) |
| Interval scheduling / activity selection (greedy) | O(n log n) | O(1) extra | Phase 10 — sort by end time, then single linear scan |
| Backtracking — subsets | O(2ⁿ) | O(n) recursion depth | Phase 10 |
| Backtracking — permutations | O(n!) | O(n) recursion depth | Phase 10 |
| Backtracking — combinations C(n, k) | O(C(n, k)) | O(k) recursion depth | Phase 10 |
| DP — 1D (Fibonacci-style, memoized or tabulated) | O(n) | O(n), O(1) with rolling variables | Phase 11 — naive recursive version is O(2ⁿ) |
| DP — 2D grid problems | O(rows × cols) | O(rows × cols), reducible to O(cols) rolling row | Phase 11 |
| DP — 0/1 knapsack | O(n × capacity) | O(n × capacity), reducible to O(capacity) | Phase 11 |
| DP — Longest Common Subsequence (LCS) | O(n · m) | O(n · m) | Phase 11 |
| DP — Longest Increasing Subsequence (LIS) | O(n²) DP table, O(n log n) patience-sorting variant | O(n) | Phase 11 |
| Bitmask DP (Held-Karp / TSP-style) | O(2ⁿ · n²) | O(2ⁿ · n) | Phase 13 — vs brute-force permutations O(n!) |
| GCD — Euclidean algorithm | O(log(min(a, b))) | O(1) | Phase 13 |
| Sieve of Eratosthenes | O(n log log n) | O(n) | Phase 13 — vs naive trial division O(n√n) |
| Fast exponentiation (binary exponentiation) | O(log exp) | O(1) iterative / O(log exp) recursive | Phase 13 — vs naive O(exp) |

---

## Algorithm Code-Template Snippets

Condensed skeletons matching the patterns as taught in the phase lessons — not new content, just the reusable shape stripped to its essentials.

### Two Pointers — Phase 2
```python
def two_sum_sorted(arr, target):
    left, right = 0, len(arr) - 1
    while left < right:
        current_sum = arr[left] + arr[right]
        if current_sum == target:
            return (left, right)
        elif current_sum < target:
            left += 1
        else:
            right -= 1
    return None
```

### Sliding Window — Phase 2
```python
def longest_unique_substring(s):
    window = set()
    left = 0
    best_len = 0
    for right, ch in enumerate(s):
        while ch in window:
            window.remove(s[left])
            left += 1
        window.add(ch)
        best_len = max(best_len, right - left + 1)
    return best_len
```

### BFS — Phase 8
```python
from collections import deque

def bfs(graph, start):
    visited = {start}
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return order
```

### DFS — Phase 8
```python
def dfs_recursive(graph, start):
    visited = set()
    order = []
    def visit(node):
        visited.add(node)
        order.append(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                visit(neighbor)
    visit(start)
    return order
```

### Binary Search — Phase 1
```python
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
```

### Backtracking Skeleton — Phase 10
```python
def backtrack(path, choices):
    # results — declared by caller, e.g. results = [], then call backtrack([], choices)
    if is_solution(path):
        results.append(path[:])   # snapshot — path keeps mutating
        return
    for choice in choices:
        if not is_valid(path, choice):
            continue
        path.append(choice)       # choose
        backtrack(path, choices)  # explore
        path.pop()                # unchoose
```

### DP Top-Down (Memoization) Skeleton — Phase 11
```python
def fib_memo(n, memo=None):
    if memo is None:
        memo = {}
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib_memo(n - 1, memo) + fib_memo(n - 2, memo)
    return memo[n]
```
Note: use `memo=None` with a `if memo is None: memo = {}` guard, not a mutable default argument (`memo={}`) — Python evaluates default arguments once at function-definition time, so a mutable default silently leaks stale cached values across unrelated top-level calls.

---

**See also:** `DSA/Phase-14-Interview-Strategy/01-Pattern-Recognition-Framework.md` for the reasoning framework that maps a problem statement to the right technique, and `DSA/Quick-Reference/Pattern-Recognition-Guide.md` for the dense clue-to-technique lookup table.
