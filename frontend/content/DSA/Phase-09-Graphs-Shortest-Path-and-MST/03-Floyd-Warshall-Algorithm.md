# Floyd-Warshall Algorithm

## 1. Problem

Dijkstra's and Bellman-Ford both answer "shortest path from *one* source to everywhere." But plenty of real questions need **all pairs** at once: "what's the shortest route between every city and every other city?", "what's the cheapest way to convert *any* currency to *any* other?" You could run Dijkstra's once per source — V times — and gather every result, but that means re-deriving overlapping information from scratch V separate times, and it still can't handle negative edges without switching to Bellman-Ford, which run V times is even more expensive.

**Floyd-Warshall** solves all-pairs shortest path directly, using dynamic programming over a single idea: *which intermediate nodes are "allowed" to be used along the path so far*. Starting from just the direct edges (no intermediates allowed at all), it incrementally allows one more node at a time to be used as a stopover, checking whether routing through that new node beats whatever was the best known route before. After every node has been allowed as a stopover, `dist[i][j]` holds the true shortest distance from `i` to `j`, using any combination of intermediate nodes. It runs in O(V³) — worse per-pair than Dijkstra's, but computing *all* pairs at once with one clean, tightly nested loop.

## 2. Analogy

Think of it like slowly opening up a city's road network to through-traffic, one new highway interchange at a time. Initially, "shortest route from anywhere to anywhere" only considers direct roads that already exist between two points, with no ability to cut through any newly-built interchange. Now open interchange #1 to through-traffic: instantly, every route in the city gets re-checked against "would going *through* interchange #1 be shorter than the current best route?" — some improve, most don't. Then open interchange #2, and re-check every route again, this time allowed to use interchange #1 *and* #2 together in a single hop-through. By the time every interchange in the city has been opened one at a time, every route between every pair of points has been checked against every possible combination of stopovers — not just each interchange in isolation, but interchange #1 followed by #7 followed by #3, because each new interchange's opening builds on all the improvements made from every interchange opened before it.

## 3. Internal Flow

**Setup — the distance matrix.** Represent the graph as a `V x V` matrix `dist`, where `dist[i][j]` is the direct edge weight from `i` to `j` (or infinity if no direct edge exists), and `dist[i][i] = 0` for every node (the distance from a node to itself, with zero intermediates, is zero).

**The DP recurrence — `dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])`.** This says: "the shortest distance from `i` to `j`, allowed to use intermediate nodes up through `k`, is either the same as before (not using `k` doesn't help), or it's the distance from `i` to `k` *plus* the distance from `k` to `j` (using `k` as a stopover, where both of those sub-distances are themselves already the best-known values allowing intermediates up through `k`)."

**The triple loop — `k` outermost, then `i`, then `j`.**

```python
for k in range(n):
    for i in range(n):
        for j in range(n):
            if dist[i][k] + dist[k][j] < dist[i][j]:
                dist[i][j] = dist[i][k] + dist[k][j]
```

**Why `k` must be outermost.** The DP's correctness depends on a strict ordering guarantee: by the time the algorithm considers "route from `i` to `j` allowed to use `k` as a stopover," the values `dist[i][k]` and `dist[k][j]` **must already reflect every improvement possible using intermediates 0 through k-1** — because those two sub-distances are themselves being used to build the k-th layer of the DP. That guarantee only holds if the *entire* `k`-th layer (every `i`, every `j`) is finished being computed with intermediates `0..k-1` **before** moving on to allow `k` itself as a stopover for anyone. Looping `k` outermost enforces exactly that: every `(i, j)` pair gets fully updated for a given `k` before `k` advances. If `k` were innermost instead, a given `(i, j)` cell could get updated using a half-finished, inconsistent mix of "some cells already know about node 5 as a stopover, some don't yet" — silently producing wrong distances for some pairs, without any error or crash.

## 4. Example

A `floyd_warshall` function that runs the triple loop on a small 4-node weighted adjacency matrix, printing the full distance matrix after each value of `k` finishes.

```python
INF = float('inf')

def print_matrix(dist, labels):
    header = "     " + "  ".join(f"{l:>4}" for l in labels)
    print(header)
    for i, row in enumerate(dist):
        cells = "  ".join(f"{v:>4}" if v != INF else "  inf" for v in row)
        print(f"{labels[i]:>4} {cells}")


def floyd_warshall(dist, labels):
    n = len(dist)
    print("Initial distance matrix:")
    print_matrix(dist, labels)

    for k in range(n):
        for i in range(n):
            for j in range(n):
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
        print(f"\nAfter k = {labels[k]} (allowing paths through {labels[k]} as an intermediate node):")
        print_matrix(dist, labels)

    return dist


labels = ['A', 'B', 'C', 'D']
# adjacency matrix; INF where no direct edge exists, 0 on the diagonal
dist = [
    [0,   3,   INF, 7],
    [8,   0,   2,   INF],
    [5,   INF, 0,   1],
    [2,   INF, INF, 0],
]

result = floyd_warshall([row[:] for row in dist], labels)
print("\nFinal all-pairs shortest distances:")
print_matrix(result, labels)
```

Executed output:

```
Initial distance matrix:
        A     B     C     D
   A    0     3    inf     7
   B    8     0     2    inf
   C    5    inf     0     1
   D    2    inf    inf     0

After k = A (allowing paths through A as an intermediate node):
        A     B     C     D
   A    0     3    inf     7
   B    8     0     2    15
   C    5     8     0     1
   D    2     5    inf     0

After k = B (allowing paths through B as an intermediate node):
        A     B     C     D
   A    0     3     5     7
   B    8     0     2    15
   C    5     8     0     1
   D    2     5     7     0

After k = C (allowing paths through C as an intermediate node):
        A     B     C     D
   A    0     3     5     6
   B    7     0     2     3
   C    5     8     0     1
   D    2     5     7     0

After k = D (allowing paths through D as an intermediate node):
        A     B     C     D
   A    0     3     5     6
   B    5     0     2     3
   C    3     6     0     1
   D    2     5     7     0

Final all-pairs shortest distances:
        A     B     C     D
   A    0     3     5     6
   B    5     0     2     3
   C    3     6     0     1
   D    2     5     7     0
```

Trace the `B -> D` cell across the passes: it starts at infinity (no direct edge), becomes 15 after `k = A` (via `B->A->D` = 8 + 7), then drops to 3 after `k = C` (via `B->C->D` = 2 + 1) — a shorter route discovered once `C` is allowed as a stopover. Also watch `B -> A`: it stays at 8 until `k = D`, where it finally drops to 5 (via `B->C->D->A` = 2 + 1 + 2, using both `C` and `D` as stopovers together) — this only becomes visible once *both* `C` and `D` have already been processed as allowed intermediates, which is exactly why the loop order matters.

**Now the same graph run with `k` as the innermost loop instead of outermost**, to see the DP break:

```python
INF = float('inf')

def floyd_warshall_correct(dist):
    n = len(dist)
    dist = [row[:] for row in dist]
    for k in range(n):
        for i in range(n):
            for j in range(n):
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
    return dist


def floyd_warshall_wrong_order(dist):
    # k as innermost loop instead of outermost -- WRONG
    n = len(dist)
    dist = [row[:] for row in dist]
    for i in range(n):
        for j in range(n):
            for k in range(n):
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
    return dist


dist = [
    [0,   3,   INF, 7],
    [8,   0,   2,   INF],
    [5,   INF, 0,   1],
    [2,   INF, INF, 0],
]

correct = floyd_warshall_correct(dist)
wrong = floyd_warshall_wrong_order(dist)
print("Correct (k outermost):", correct)
print("Wrong   (k innermost):", wrong)
print("Match:", correct == wrong)
```

Executed output:

```
Correct (k outermost): [[0, 3, 5, 6], [5, 0, 2, 3], [3, 6, 0, 1], [2, 5, 7, 0]]
Wrong   (k innermost): [[0, 3, 5, 6], [7, 0, 2, 3], [3, 6, 0, 1], [2, 5, 7, 0]]
Match: False
```

The `B -> A` cell disagrees: 5 (correct, using `C` then `D` as stopovers) versus 7 (wrong-order version, which computes `i=1, j=0` before `k` has had the chance to accumulate the improvements from every other `(i, j)` pair at that same `k`, so the two-stopover route through both `C` and `D` never gets discovered). No error is raised in either version — the wrong-order version just quietly returns a matrix that's correct in some cells and wrong in others.

## 5. Compare

Floyd-Warshall trades per-source speed for coverage: O(V³) computes *every* pair at once, versus running Dijkstra's from every source at O(V·(V+E) log V) (better on sparse graphs, worse as the graph gets denser and `E` approaches `V²`) or Bellman-Ford from every source at O(V²·E) (needed instead of Dijkstra's if the graph has negative edges, but the slowest all-pairs option overall). Floyd-Warshall also natively tolerates negative edges (though not negative cycles reachable between reported pairs — a negative cycle shows up as a negative value on that node's own diagonal, `dist[i][i] < 0`). Its biggest weakness is exactly its strength inverted: O(V³) is fixed regardless of how sparse the graph is, so on a large sparse graph, running Dijkstra's once per source is usually far more efficient than paying the full V³ cost for pairs that barely have any edges between them at all.

## 6. Common Mistakes

- **Looping with `k` as the innermost loop instead of outermost.** As shown above, this breaks the DP's correctness — the recurrence depends on the entire `k`-th layer being fully computed with intermediates `0..k-1` before any cell is allowed to use `k` itself, and that guarantee only holds when `k` drives the outer loop.
- **Using Floyd-Warshall on a large, sparse graph** where running Dijkstra's from every vertex would be asymptotically better — O(V³) doesn't care how few edges the graph has, so on a graph with, say, V=10,000 and only a few edges per node, V runs of Dijkstra's (or even Bellman-Ford, if negative edges are present) will usually finish far faster.
- **Forgetting to initialize `dist[i][i] = 0`** on the diagonal — without it, the "distance from a node to itself" starts at infinity, breaking every path that legitimately needs to route through that node's own position as a no-op stopover.
- **Not distinguishing "no edge" (infinity) from "zero-weight edge"** when building the initial matrix — treating a missing edge as `0` instead of infinity will make the algorithm think every unconnected pair is already free to reach, corrupting every subsequent relaxation.
- **Assuming Floyd-Warshall detects negative cycles by returning an error** — it doesn't raise anything; a negative cycle reveals itself only if you explicitly check whether any `dist[i][i]` ends up negative after the algorithm completes.

## 7. Interview Angle

Floyd-Warshall is a favorite "write it from memory" question specifically because the triple-nested loop is short, but subtly order-dependent — interviewers will often ask "why does `k` have to be the outer loop?" and expect the "each layer must fully complete before the next begins" reasoning, not just "that's the convention." It's also a natural fit for transitive-closure-style problems phrased differently ("can you get from every city to every other city at all?" — same recurrence, but with boolean OR/AND instead of min/plus) and for "find the node that minimizes the maximum distance to all others" (network center problems), since having every pairwise distance available at once makes these one extra pass over the finished matrix. A common follow-up: "how would you reconstruct the actual path, not just the distance?" — maintain a parallel `next[i][j]` matrix, updated alongside `dist[i][j]` whenever a shorter route through `k` is found, then walk it forward from `i` to `j` to rebuild the path.

## 8. Memory Hook

**"One new stopover unlocked at a time, and every pair gets to try it before the next stopover opens."** The DP recurrence `dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])` only works because `k` — the newly-allowed intermediate — sits in the outer loop, guaranteeing every `(i, j)` pair finishes considering `k` before the next `k` (which may combine with this one) comes into play. O(V³), but every pair's shortest distance falls out for free.
