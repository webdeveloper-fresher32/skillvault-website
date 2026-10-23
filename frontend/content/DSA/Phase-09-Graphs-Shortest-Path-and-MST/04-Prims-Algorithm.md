# Prim's Algorithm

## 1. Problem

A different kind of question shows up constantly in network design: given a set of locations and the cost of connecting each pair, what's the *cheapest* way to connect **all** of them together, using as few connections as possible, with no redundant links? This is the **minimum spanning tree (MST)** problem — find a subset of edges that connects every vertex in a weighted, undirected graph, forms no cycles, and has the smallest possible total edge weight. "Spanning" means every vertex is reachable; "tree" means exactly `V-1` edges and no cycles (a cycle would mean a wasted, redundant connection); "minimum" means the sum of the chosen edges' weights is as small as possible among all valid spanning trees.

**Prim's algorithm** builds an MST by growing a **single tree**, one vertex at a time: start from an arbitrary vertex, and repeatedly add the cheapest edge that connects the current tree to any vertex not yet in it. Every step grows the same connected blob by exactly one vertex, using whichever available edge is currently cheapest — a greedy strategy that provably produces a *minimum* spanning tree, not just *some* spanning tree.

## 2. Analogy

Think of it like laying down pipeline to connect a cluster of towns to a single shared water source, extending the pipeline outward one town at a time. At every step, look at every town not yet connected to the existing pipeline network, and every possible new pipe segment that would connect *some* town in the network to *some* town not yet in it — and lay whichever single segment is cheapest. Once a town is connected, it becomes part of the "already connected" blob, and its own possible connections to other unconnected towns become new candidates for the next cheapest-segment decision. The pipeline never needs to loop back and reconnect an already-connected town to a second source — that would just be a wasted, more expensive segment when a cheaper way to reach every town already exists.

## 3. Internal Flow

**Setup.** Maintain an `in_mst` set, starting with just the arbitrary starting vertex. Maintain a min-heap of candidate edges `(weight, from_node, to_node)`, seeded with every edge out of the starting vertex.

**Main loop — pop the cheapest candidate edge, skip if it doesn't grow the tree.** Pop the smallest `(weight, u, v)` triple off the heap.
- **If `v` (the "destination" end of the candidate edge) is already in `in_mst`, skip this edge** — it would just connect two vertices that are already both part of the tree, forming a cycle rather than growing it. This is not a stale-vs-fresh distinction like Dijkstra's stale heap entries; it's a structural requirement: an MST by definition has no cycles, so any edge whose destination is already inside the tree is useless.
- Otherwise, add `v` to `in_mst`, and record edge `(u, v, weight)` as part of the MST.
- **Push every edge out of `v` that leads to a vertex not yet in `in_mst`** onto the heap as a new candidate — the tree has just grown by one vertex, so it has new possible next-steps to consider.

Repeat until the heap is empty (or, equivalently, until `in_mst` contains every vertex — once every vertex is in the tree, any remaining heap entries are guaranteed to fail the "already in `in_mst`" check and be skipped). The recorded edges form the minimum spanning tree.

**Why this looks like Dijkstra's but isn't.** The code structure is nearly identical to Dijkstra's — a min-heap, a "already processed" check, pushing new candidates after processing — but the heap is keyed on a different quantity. Dijkstra's heap holds `(cumulative distance from source, node)` — the *total* cost to reach a node via the path found so far. Prim's heap holds `(single edge weight, from, to)` — just the cost of *one* edge that would connect the growing tree to a new vertex, with no accumulation across multiple hops. This difference is why Prim's finds a *minimum spanning tree* (cheapest way to connect everyone) while Dijkstra's finds *shortest paths from one source* (cheapest way to reach each node individually) — the two problems and their optimal solutions can differ; the cheapest tree connecting everyone is not necessarily made of the cheapest individual paths from any one node.

## 4. Example

A `prim` function using `heapq`, tracing which edge is popped, whether it's added to the MST or skipped as forming a cycle, and which new candidate edges get pushed, on a small 5-node weighted graph.

```python
import heapq

def prim(graph, start):
    in_mst = {start}
    mst_edges = []
    total_weight = 0

    heap = []
    for neighbor, weight in graph[start]:
        heapq.heappush(heap, (weight, start, neighbor))

    print(f"Start at {start!r}")

    while heap:
        weight, u, v = heapq.heappop(heap)
        print(f"\npop edge ({u}-{v}, w={weight})")

        if v in in_mst:
            print(f"  {v} already in MST -> skip (would form a cycle)")
            continue

        in_mst.add(v)
        mst_edges.append((u, v, weight))
        total_weight += weight
        print(f"  add edge {u}-{v} (w={weight}) to MST; MST now contains {sorted(in_mst)}")

        for neighbor, w in graph[v]:
            if neighbor not in in_mst:
                heapq.heappush(heap, (w, v, neighbor))
                print(f"    push candidate edge ({v}-{neighbor}, w={w})")

    return mst_edges, total_weight


graph = {
    'A': [('B', 2), ('D', 6)],
    'B': [('A', 2), ('C', 3), ('D', 8), ('E', 5)],
    'C': [('B', 3), ('E', 7)],
    'D': [('A', 6), ('B', 8), ('E', 9)],
    'E': [('B', 5), ('C', 7), ('D', 9)],
}

print("Graph:", graph)
edges, total = prim(graph, 'A')
print("\nMST edges:", edges)
print("Total MST weight:", total)
```

Executed output:

```
Graph: {'A': [('B', 2), ('D', 6)], 'B': [('A', 2), ('C', 3), ('D', 8), ('E', 5)], 'C': [('B', 3), ('E', 7)], 'D': [('A', 6), ('B', 8), ('E', 9)], 'E': [('B', 5), ('C', 7), ('D', 9)]}
Start at 'A'

pop edge (A-B, w=2)
  add edge A-B (w=2) to MST; MST now contains ['A', 'B']
    push candidate edge (B-C, w=3)
    push candidate edge (B-D, w=8)
    push candidate edge (B-E, w=5)

pop edge (B-C, w=3)
  add edge B-C (w=3) to MST; MST now contains ['A', 'B', 'C']
    push candidate edge (C-E, w=7)

pop edge (B-E, w=5)
  add edge B-E (w=5) to MST; MST now contains ['A', 'B', 'C', 'E']
    push candidate edge (E-D, w=9)

pop edge (A-D, w=6)
  add edge A-D (w=6) to MST; MST now contains ['A', 'B', 'C', 'D', 'E']

pop edge (C-E, w=7)
  E already in MST -> skip (would form a cycle)

pop edge (B-D, w=8)
  D already in MST -> skip (would form a cycle)

pop edge (E-D, w=9)
  D already in MST -> skip (would form a cycle)

MST edges: [('A', 'B', 2), ('B', 'C', 3), ('B', 'E', 5), ('A', 'D', 6)]
Total MST weight: 16
```

Trace the choice at each step: after `A-B` (weight 2) is added, the cheapest candidate is `B-C` (weight 3) over `B-D` (8) or `B-E` (5) — always take the globally cheapest edge available across *every* vertex currently in the tree, not just the most recently added one. Once every vertex (`A, B, C, D, E`) is in the tree, the three remaining heap entries — `C-E` (7), `B-D` (8), `E-D` (9) — all get popped and correctly skipped, since both endpoints of each are already inside `in_mst`; accepting any of them would create a cycle rather than extend the tree. The final MST uses 4 edges (`V-1` for 5 vertices) totaling weight 16.

## 5. Compare

Prim's and **Kruskal's** (next lesson) both build a minimum spanning tree but from opposite directions: Prim's grows a single connected tree outward one vertex at a time (natural fit for dense graphs, where an adjacency-list + heap keeps overhead low relative to edge count), while Kruskal's considers all edges globally sorted by weight and grows a *forest* of trees that merge together (natural fit for sparse graphs, since it processes the edge list directly rather than needing per-vertex adjacency). Against **Dijkstra's**: identical code shape (min-heap, "already processed" check, push new candidates), but Dijkstra's optimizes cumulative path cost from a fixed source, while Prim's optimizes total edge weight of the whole connecting structure — a cheapest-total-tree is not the same target as cheapest-individual-paths-from-a-source, and the two algorithms can select different edges even on the same graph.

## 6. Common Mistakes

- **Confusing Prim's with Dijkstra's because the code looks nearly identical.** Both use a min-heap and an "already processed" set with the same pop-check-add-push shape — but Prim's heap key is a single edge's weight, while Dijkstra's heap key is a cumulative path distance. Mixing them up (e.g., accidentally accumulating distance in a Prim's implementation) silently turns Prim's into something computing the wrong quantity.
- **Forgetting to skip an edge whose destination is already in the tree.** Without that check, the algorithm can add a redundant edge, creating a cycle and violating the basic definition of a spanning *tree* (which must have exactly `V-1` edges and no cycles).
- **Only pushing edges from the starting vertex once, instead of pushing new candidate edges every time a new vertex joins the tree.** The candidate set must keep growing as the tree grows — every newly added vertex contributes its own outgoing edges as fresh candidates for the next cheapest pick.
- **Using an adjacency matrix with a naive O(V²) "scan for the minimum" instead of a heap on a sparse graph** — this technically still works (it's the classic array-based Prim's), but it discards the asymptotic benefit a heap gives on graphs where E is much smaller than V².
- **Assuming Prim's must start from a particular vertex to get the correct MST.** Prim's produces a valid MST (of the same total minimum weight, though possibly a different exact set of edges if multiple MSTs of equal weight exist) regardless of which vertex it starts from.

## 7. Interview Angle

Prim's is frequently asked back-to-back with Kruskal's, specifically to test whether a candidate understands *why* both are correct despite growing the tree in structurally different ways (both rely on the "cut property": the cheapest edge crossing any partition of the graph into two sets is always safe to include in some MST). Complexity is a common follow-up: O(E log V) with a binary heap and adjacency list (each edge can be pushed once, and each push/pop is O(log V)), or O(V²) with a simple array-based version — the array version is actually preferred on dense graphs since it avoids heap overhead entirely. Another common ask: "which do you pick, Prim's or Kruskal's, for a graph with a million vertices but very few edges?" — Kruskal's, since sorting a small edge list plus near-O(1) Union-Find lookups beats maintaining a heap keyed on vertices that mostly have very few edges to offer.

## 8. Memory Hook

**"Grow one tree, always adding whichever single cheapest edge reaches outside it."** Prim's never looks at global edge weight across the whole graph the way Kruskal's does — it only ever asks "of the edges touching my current tree, which one is cheapest and leads somewhere new?" Same heap shape as Dijkstra's, different key: an edge's own weight, not a running total.
