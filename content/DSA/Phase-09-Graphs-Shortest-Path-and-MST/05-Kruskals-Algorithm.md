# Kruskal's Algorithm

## 1. Problem

Prim's builds a minimum spanning tree by growing a single connected blob outward, one vertex at a time — a natural fit when the graph is dense and every vertex has many candidate edges to offer. But on a **sparse** graph — many vertices, relatively few edges — Prim's still pays for maintaining a heap keyed on vertices that mostly don't have much to offer. There's a simpler angle on the same MST problem: forget about growing from a starting vertex at all, and instead just look at **every edge in the whole graph, sorted from cheapest to most expensive**, greedily accepting each one unless it would create a cycle.

**Kruskal's algorithm** does exactly that: sort all edges by weight, then walk the sorted list from cheapest to most expensive, accepting an edge into the MST if and only if its two endpoints are not already connected through previously-accepted edges — because if they are, this edge would just be an expensive, redundant loop back to somewhere already reachable. The hard part is answering "are these two endpoints already connected?" fast, for every edge, as the accepted set keeps growing — which is exactly the problem Union-Find (Phase 8) was built to solve.

## 2. Analogy

Think of it like a matchmaking event where every possible pair of people has a "compatibility cost" (lower is better), and the goal is to end up with everyone connected into one social group using the *cheapest total* set of introductions, with nobody introduced through a redundant, already-existing connection. Line up every possible pair, cheapest compatibility cost first, and walk down the list making introductions one at a time: introduce a pair only if they aren't *already* connected through some earlier chain of introductions (perhaps not directly, but through mutual friends of mutual friends). The moment a cheap pair turns out to already be connected some other way, skip that introduction — spending anything on it would be pure waste, since those two people can already reach each other. By the time the list is exhausted (or everyone's connected), the accepted introductions form the cheapest possible way to connect the whole group.

## 3. Internal Flow

**Setup — sort, then Union-Find.** Sort every edge `(u, v, weight)` in the graph by weight, ascending. Initialize a Union-Find (DSU) structure with each vertex in its own singleton set — exactly the structure from Phase 8, reused here without reinventing it: `find(x)` with path compression to get a vertex's current root, and `union(a, b)` with union-by-rank to merge two sets, returning whether a merge actually happened (versus a no-op because the two were already in the same set).

**Main loop — walk the sorted edges, accept or reject via Union-Find.** For each edge `(u, v, weight)` in ascending weight order:
- Call `dsu.union(u, v)`. This internally calls `find(u)` and `find(v)` to get their roots.
- **If the roots differ**, `union` merges the two sets and returns `True` — accept this edge into the MST, since `u` and `v` were in different components and this edge is the cheapest way (among remaining unprocessed edges) to connect those two components together.
- **If the roots are already the same**, `union` is a no-op and returns `False` — reject this edge, since `u` and `v` are already connected through some earlier, cheaper (or equal-cost) accepted edge; adding this one would only create a cycle.

Repeat until every edge has been considered (or, as an optimization, stop early once `V-1` edges have been accepted — a spanning tree on `V` vertices always has exactly `V-1` edges, so nothing left in the sorted list could still be needed).

**Why Union-Find specifically.** The core question Kruskal's asks over and over is "are `u` and `v` already connected?" — exactly Union-Find's specialty, answered in near-O(1) amortized time per check (O(α(n)), practically constant) once path compression and union-by-rank are both in place. A naive alternative — running BFS/DFS from `u` to see if `v` is reachable — would cost O(V + E) *per edge considered*, turning the whole algorithm from O(E log E) (dominated by the sort) into something far slower.

## 4. Example

A `kruskal` function reusing the same `DSU` class (`find` with path compression, `union` with union-by-rank) built in Phase 8, tracing which edges are accepted or rejected as it walks the sorted edge list, on the same 5-node weighted graph used in the Prim's lesson.

```python
class DSU:
    def __init__(self, n):
        self.parent = list(range(n))   # each node starts as its own root
        self.rank = [0] * n            # rank = rough upper bound on tree height

    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # path compression
        return self.parent[x]

    def union(self, a, b):
        root_a = self.find(a)
        root_b = self.find(b)
        if root_a == root_b:
            return False  # already connected -- would form a cycle
        # union by rank: attach smaller-rank tree under larger-rank tree
        if self.rank[root_a] < self.rank[root_b]:
            root_a, root_b = root_b, root_a
        self.parent[root_b] = root_a
        if self.rank[root_a] == self.rank[root_b]:
            self.rank[root_a] += 1
        return True


def kruskal(vertices, edges):
    # edges: list of (u, v, weight); vertices: list of labels
    index = {label: i for i, label in enumerate(vertices)}
    dsu = DSU(len(vertices))

    sorted_edges = sorted(edges, key=lambda e: e[2])
    print("Edges sorted by weight:", sorted_edges)

    mst_edges = []
    total_weight = 0
    for u, v, w in sorted_edges:
        print(f"\nconsider edge {u}-{v} (w={w})")
        if dsu.union(index[u], index[v]):
            mst_edges.append((u, v, w))
            total_weight += w
            print(f"  accepted -> MST edges so far: {mst_edges}")
        else:
            print(f"  rejected -> {u} and {v} already connected, would form a cycle")

    return mst_edges, total_weight


vertices = ['A', 'B', 'C', 'D', 'E']
edges = [
    ('A', 'B', 2), ('A', 'D', 6),
    ('B', 'C', 3), ('B', 'D', 8), ('B', 'E', 5),
    ('C', 'E', 7),
    ('D', 'E', 9),
]

print("Vertices:", vertices)
print("Edges:", edges)
mst, total = kruskal(vertices, edges)
print("\nFinal MST edges:", mst)
print("Total MST weight:", total)
```

Executed output:

```
Vertices: ['A', 'B', 'C', 'D', 'E']
Edges: [('A', 'B', 2), ('A', 'D', 6), ('B', 'C', 3), ('B', 'D', 8), ('B', 'E', 5), ('C', 'E', 7), ('D', 'E', 9)]
Edges sorted by weight: [('A', 'B', 2), ('B', 'C', 3), ('B', 'E', 5), ('A', 'D', 6), ('C', 'E', 7), ('B', 'D', 8), ('D', 'E', 9)]

consider edge A-B (w=2)
  accepted -> MST edges so far: [('A', 'B', 2)]

consider edge B-C (w=3)
  accepted -> MST edges so far: [('A', 'B', 2), ('B', 'C', 3)]

consider edge B-E (w=5)
  accepted -> MST edges so far: [('A', 'B', 2), ('B', 'C', 3), ('B', 'E', 5)]

consider edge A-D (w=6)
  accepted -> MST edges so far: [('A', 'B', 2), ('B', 'C', 3), ('B', 'E', 5), ('A', 'D', 6)]

consider edge C-E (w=7)
  rejected -> C and E already connected, would form a cycle

consider edge B-D (w=8)
  rejected -> B and D already connected, would form a cycle

consider edge D-E (w=9)
  rejected -> D and E already connected, would form a cycle

Final MST edges: [('A', 'B', 2), ('B', 'C', 3), ('B', 'E', 5), ('A', 'D', 6)]
Total MST weight: 16
```

Watch `C-E` (weight 7): by the time it's considered, `C` is already connected to `A/B/D/E` via `A-B, B-C, B-E, A-D`, so `dsu.union(index['C'], index['E'])` finds both already share the same root and returns `False` — correctly rejected, since accepting it would just be a second, more expensive way to connect two vertices already connected. Compare this result to the Prim's lesson's example, run on this exact same graph: **both algorithms arrive at the identical MST** — `A-B (2), B-C (3), B-E (5), A-D (6)`, total weight 16 — confirming that Prim's and Kruskal's, despite growing the tree in structurally different orders (one vertex-by-vertex, one edge-by-edge globally), converge on the same minimum total weight.

## 5. Compare

Kruskal's total cost is O(E log E) for sorting the edges (dominant term; the near-O(1) amortized Union-Find operations are comparatively free), while Prim's with a binary heap costs O(E log V). On a sparse graph, sorting a small edge list plus fast Union-Find checks tends to edge out maintaining a vertex-keyed heap; on a dense graph, Prim's (especially the O(V²) array-based version, skipping the heap entirely) tends to win, since Kruskal's would have to sort a near-quadratic number of edges. Against a naive cycle-check alternative: Kruskal's *needs* Union-Find specifically — swapping it for a DFS-based cycle check per edge changes the complexity from O(E log E) to something dominated by O(E · (V + E)), which is dramatically worse for exactly the same "is this edge safe to add" question. Both Prim's and Kruskal's rest on the same underlying guarantee (the "cut property": across any partition of the vertices into two groups, the cheapest edge crossing between them is always safe to include in some MST) — they just exploit it in different orders.

## 6. Common Mistakes

- **Forgetting to sort edges by weight first.** Kruskal's greedy guarantee — "the cheapest unprocessed edge that doesn't create a cycle is always safe to include" — only holds if edges are actually considered in ascending weight order; processing them in arbitrary order breaks the correctness guarantee entirely, not just the efficiency.
- **Using a naive cycle check (e.g., running DFS/BFS from `u` to see if `v` is reachable) instead of Union-Find.** It's correct, but far slower — O(V + E) per edge considered instead of near-O(1) amortized per `union`/`find` call, turning an O(E log E) algorithm into something bottlenecked by repeated full graph traversals.
- **Reimplementing Union-Find from scratch with different naming/structure instead of reusing the Phase 8 `DSU` class** — this isn't a correctness bug by itself, but it's a missed opportunity: the whole point of building Union-Find as its own lesson was so that Kruskal's (and any future problem needing fast connectivity checks) could plug it in directly, without re-deriving path compression and union-by-rank from scratch.
- **Not stopping early once `V-1` edges have been accepted**, and instead needlessly processing the remaining (more expensive) edges in the sorted list — a harmless inefficiency on small graphs, but wasted work on a large one where the accepted count could be checked and the loop broken early.
- **Comparing raw vertex labels instead of calling `find` on both endpoints before deciding to accept an edge** — same mistake as with Union-Find directly (Phase 8): comparing `u == v`'s *labels* or *indices* rather than their *roots* will almost always wrongly conclude two connected vertices are still separate.

## 7. Interview Angle

Kruskal's is the textbook example interviewers use to test whether a candidate actually understands Union-Find rather than having just memorized it — expect a direct ask to implement Kruskal's *using* a Union-Find structure the candidate just built (often as a two-part interview: implement DSU, then Kruskal's on top of it). A very common follow-up: "why does sorting by weight first make the greedy approach correct?" — tie the answer to the cut property: the globally cheapest unprocessed edge, at the moment it's considered, is guaranteed to be the cheapest edge crossing *some* cut in the graph (specifically, the cut between its own two components), so it's always safe to include. Another frequent variant: "find the second-minimum spanning tree" or "count the number of distinct MSTs" — both build on top of a working Kruskal's, checking whether a candidate can reason about the algorithm's structure beyond just reciting the steps.

## 8. Memory Hook

**"Sort every edge, cheapest first, and only skip one if it would just reconnect what's already connected."** Kruskal's doesn't care which vertex it starts from — it looks at the whole graph's edges at once, globally, and lets Union-Find's near-instant "same set or not?" answer decide accept-or-reject at every step. Prim's grows one tree outward; Kruskal's grows a forest that keeps merging — same destination, opposite route.
