# Bellman-Ford Algorithm

## 1. Problem

Dijkstra's algorithm is fast, but its correctness rests on a promise: no edge weight is ever negative. In real graphs that promise doesn't always hold — currency arbitrage graphs have edges that represent a *gain* (negative cost), some flow-network reductions produce negative edges, and some scheduling graphs encode "this can happen up to N days earlier" as a negative weight. Dijkstra's on such a graph doesn't fail loudly; as the previous lesson showed, it just silently returns a wrong answer, because finalizing a node early is no longer safe once some later edge could still undercut it.

**Bellman-Ford** solves single-source shortest path while **tolerating negative edge weights**, by giving up Dijkstra's greedy shortcut entirely: instead of trusting that the current cheapest node is done forever, it just relaxes *every* edge in the graph, *V-1* times over, guaranteeing that information about any negative edge has enough "rounds" to propagate all the way through the graph. As a bonus, it can also **detect** when a negative-weight *cycle* exists — a situation where "shortest path" doesn't even have a well-defined answer, because you could loop the cycle forever and make the path arbitrarily cheaper.

## 2. Analogy

Think of it like a rumor about the best price on a chain of trades — "buy currency X, then trade it for Y, then Z" — with rumors just travelling by word of mouth, one hop per day. On day 1, everyone directly connected to the source has heard the best 1-hop rumor. On day 2, everyone hears the best 2-hop rumor, since it takes one more day for a rumor to travel one more hop. Since the true best path between any two people can never need more than V-1 hops (any more, and it would be revisiting someone, which can't make an already-cheapest path cheaper unless something *very* fishy is going on), by day V-1 every rumor has had enough days to fully propagate — everyone knows the best price achievable through any legitimate hop chain.

The fishy case is a **negative-weight cycle**: a loop of trades that, gone around once, actually makes you *richer* for free. If such a loop exists, the rumor never stops improving — check on day V (one day past when it should have stabilized), and if the "best price" is *still* getting cheaper, that's the tell that somewhere in the network, there's a loop worth looping forever.

## 3. Internal Flow

**Setup.** Maintain a `distances` dict, `0` for the source and infinity for everyone else — same as Dijkstra's. But instead of a heap driving *which* node to process next, Bellman-Ford just has a flat list of every edge `(u, v, weight)` in the graph.

**Main loop — relax every edge, V-1 times.** Repeat this exactly `V - 1` times (`V` = number of vertices): for every edge `(u, v, w)` in the edge list, if `distances[u] + w < distances[v]`, then a cheaper route through `u` has been found — update `distances[v] = distances[u] + w`. Order of edges within a pass doesn't matter for correctness (though it can affect how fast improvements propagate within a single pass); what matters is that *all* edges get a chance to relax in every pass.

**Why exactly V-1 passes.** Any shortest path between two vertices in a graph with no negative cycle uses **at most V-1 edges** — because a simple (non-repeating) path through V vertices has at most V-1 edges; visiting a vertex twice would mean looping, which can't help unless the loop is negative (the cycle-detection case, handled separately). Each full pass over all edges is guaranteed to correctly "settle" (find the true shortest distance for) at least one more edge's worth of every shortest path that hasn't settled yet — pass 1 settles every shortest path that is 1 edge long, pass 2 extends that to paths 2 edges long, and so on. After `V-1` passes, every shortest path — no matter how many edges (up to the max of V-1) it needs — has had enough passes to fully propagate from the source to its destination.

**The extra Vth pass — negative-cycle detection.** After the `V-1` relaxation passes, run the edge list through *one more time*. If **any** edge can still relax (`distances[u] + w < distances[v]`), that's proof a shortest path is still improving past the point where it should have stabilized — which can only happen if some cycle reachable from the source has a negative total weight, letting the "shortest path" get cheaper indefinitely by looping through it. If nothing relaxes on this extra pass, the `distances` computed after `V-1` passes are confirmed final and correct.

## 4. Example

A `bellman_ford` function that relaxes an edge list `V-1` times, tracing the `distances` dict after each pass, then runs the extra `V`th pass to check for a negative cycle — first on a graph with negative edges but no cycle, then on the same graph with one negative cycle added.

```python
def bellman_ford(vertices, edges, source):
    distances = {v: float('inf') for v in vertices}
    distances[source] = 0

    V = len(vertices)
    for i in range(V - 1):
        print(f"\n--- Pass {i + 1} of {V - 1} ---")
        changed = False
        for u, v, w in edges:
            if distances[u] != float('inf') and distances[u] + w < distances[v]:
                print(f"  relax {u}->{v} (w={w}): {distances[v]} -> {distances[u] + w}")
                distances[v] = distances[u] + w
                changed = True
        print(f"  distances after pass {i + 1}: {distances}")
        if not changed:
            print("  no changes this pass -> already converged, could stop early")

    # Extra Vth pass: negative-cycle detection.
    print("\n--- Extra pass (V-th): negative-cycle check ---")
    has_negative_cycle = False
    for u, v, w in edges:
        if distances[u] != float('inf') and distances[u] + w < distances[v]:
            print(f"  edge {u}->{v} (w={w}) can STILL relax ({distances[v]} -> {distances[u] + w}) "
                  f"after V-1 passes -> negative-weight cycle detected")
            has_negative_cycle = True

    if not has_negative_cycle:
        print("  no edge can relax further -> no negative-weight cycle reachable from source")

    return distances, has_negative_cycle


vertices = ['s', 't', 'x', 'y', 'z']
edges = [
    ('s', 't', 6), ('s', 'y', 7),
    ('t', 'x', 5), ('t', 'y', 8), ('t', 'z', -4),
    ('x', 't', -2),
    ('y', 'x', -3), ('y', 'z', 9),
    ('z', 'x', 7), ('z', 's', 2),
]

print("Vertices:", vertices)
print("Edges:", edges)
distances, has_cycle = bellman_ford(vertices, edges, 's')
print("\nFinal distances:", distances)
print("Has negative cycle:", has_cycle)

print("\n\n=== Now with an added negative cycle: x->y with weight -20 ===")
edges_with_cycle = edges + [('x', 'y', -20)]
distances2, has_cycle2 = bellman_ford(vertices, edges_with_cycle, 's')
print("\nFinal distances (unreliable, cycle present):", distances2)
print("Has negative cycle:", has_cycle2)
```

Executed output:

```
Vertices: ['s', 't', 'x', 'y', 'z']
Edges: [('s', 't', 6), ('s', 'y', 7), ('t', 'x', 5), ('t', 'y', 8), ('t', 'z', -4), ('x', 't', -2), ('y', 'x', -3), ('y', 'z', 9), ('z', 'x', 7), ('z', 's', 2)]

--- Pass 1 of 4 ---
  relax s->t (w=6): inf -> 6
  relax s->y (w=7): inf -> 7
  relax t->x (w=5): inf -> 11
  relax t->z (w=-4): inf -> 2
  relax y->x (w=-3): 11 -> 4
  distances after pass 1: {'s': 0, 't': 6, 'x': 4, 'y': 7, 'z': 2}

--- Pass 2 of 4 ---
  relax x->t (w=-2): 6 -> 2
  distances after pass 2: {'s': 0, 't': 2, 'x': 4, 'y': 7, 'z': 2}

--- Pass 3 of 4 ---
  relax t->z (w=-4): 2 -> -2
  distances after pass 3: {'s': 0, 't': 2, 'x': 4, 'y': 7, 'z': -2}

--- Pass 4 of 4 ---
  distances after pass 4: {'s': 0, 't': 2, 'x': 4, 'y': 7, 'z': -2}
  no changes this pass -> already converged, could stop early

--- Extra pass (V-th): negative-cycle check ---
  no edge can relax further -> no negative-weight cycle reachable from source

Final distances: {'s': 0, 't': 2, 'x': 4, 'y': 7, 'z': -2}
Has negative cycle: False


=== Now with an added negative cycle: x->y with weight -20 ===

--- Pass 1 of 4 ---
  relax s->t (w=6): inf -> 6
  relax s->y (w=7): inf -> 7
  relax t->x (w=5): inf -> 11
  relax t->z (w=-4): inf -> 2
  relax y->x (w=-3): 11 -> 4
  relax x->y (w=-20): 7 -> -16
  distances after pass 1: {'s': 0, 't': 6, 'x': 4, 'y': -16, 'z': 2}

--- Pass 2 of 4 ---
  relax x->t (w=-2): 6 -> 2
  relax y->x (w=-3): 4 -> -19
  relax y->z (w=9): 2 -> -7
  relax z->s (w=2): 0 -> -5
  relax x->y (w=-20): -16 -> -39
  distances after pass 2: {'s': -5, 't': 2, 'x': -19, 'y': -39, 'z': -7}

--- Pass 3 of 4 ---
  relax s->t (w=6): 2 -> 1
  relax x->t (w=-2): 1 -> -21
  relax y->x (w=-3): -19 -> -42
  relax y->z (w=9): -7 -> -30
  relax z->s (w=2): -5 -> -28
  relax x->y (w=-20): -39 -> -62
  distances after pass 3: {'s': -28, 't': -21, 'x': -42, 'y': -62, 'z': -30}

--- Pass 4 of 4 ---
  relax s->t (w=6): -21 -> -22
  relax x->t (w=-2): -22 -> -44
  relax y->x (w=-3): -42 -> -65
  relax y->z (w=9): -30 -> -53
  relax z->s (w=2): -28 -> -51
  relax x->y (w=-20): -62 -> -85
  distances after pass 4: {'s': -51, 't': -44, 'x': -65, 'y': -85, 'z': -53}

--- Extra pass (V-th): negative-cycle check ---
  edge s->t (w=6) can STILL relax (-44 -> -45) after V-1 passes -> negative-weight cycle detected
  edge x->t (w=-2) can STILL relax (-44 -> -67) after V-1 passes -> negative-weight cycle detected
  edge y->x (w=-3) can STILL relax (-65 -> -88) after V-1 passes -> negative-weight cycle detected
  edge y->z (w=9) can STILL relax (-53 -> -76) after V-1 passes -> negative-weight cycle detected

Final distances (unreliable, cycle present): {'s': -51, 't': -44, 'x': -65, 'y': -85, 'z': -53}
Has negative cycle: True
```

In the first run (no negative cycle), notice pass 4 makes **no** changes at all — the graph converged after 3 passes, one pass earlier than the guaranteed worst case of `V-1 = 4`; the extra check pass confirms nothing relaxes further, so the answer is trustworthy. In the second run, `x->y` (weight -20) creates a cycle `x -> y -> x` with total weight `-20 + -3 = -23` — strictly negative. Every pass keeps finding "improvements" (the distances keep dropping without bound), and the extra `V`th pass still finds edges that relax — the tell-tale sign that no finite shortest-path answer exists for those nodes.

## 5. Compare

Bellman-Ford is strictly more general than Dijkstra's — it handles negative edges and detects negative cycles — but it pays for that generality with speed: O(V·E) versus Dijkstra's O((V+E) log V). When all weights are guaranteed non-negative, Dijkstra's is the better default; Bellman-Ford is the fallback specifically *because* it tolerates the case Dijkstra's gets wrong. Against **Floyd-Warshall**: Bellman-Ford computes shortest paths from a *single* source, while Floyd-Warshall computes *all pairs* at once in O(V³) — running Bellman-Ford from every vertex to get all-pairs distances costs O(V²·E), which is worse than Floyd-Warshall on dense graphs but can be better on sparse ones. Bellman-Ford's negative-cycle detection is also unique among the three — neither Dijkstra's nor (in its basic form) Floyd-Warshall directly answers "does a negative cycle exist reachable from here."

## 6. Common Mistakes

- **Forgetting the extra `V`th pass for negative-cycle detection.** Running only `V-1` passes and trusting the result blindly will *silently* return a finite-looking but incorrect answer when a negative cycle is actually present — the algorithm doesn't error, it just reports whatever distances happened to be reached after `V-1` passes, understating how negative some distances truly are (or are undefined to be).
- **Not understanding why it needs exactly `V-1` passes** — and, as a result, either stopping too early (before some longer shortest path has had enough passes to propagate) or assuming more passes are always needed even after nothing changed in a given pass (an early-stop optimization is valid *only* once a full pass makes zero updates).
- **Iterating over vertices instead of edges** in the relaxation loop — Bellman-Ford's correctness comes from relaxing every *edge*, not every vertex; conflating the two (e.g., only checking each vertex's cheapest incoming edge once per pass instead of all of them) breaks the propagation guarantee.
- **Running the negative-cycle check without the `distances[u] != float('inf')` guard**, which can raise errors or produce nonsensical comparisons when `u` isn't reachable from the source yet.
- **Assuming Bellman-Ford reports *which* nodes are affected by a negative cycle** — the basic version above only answers yes/no; identifying every affected node requires an extra step (e.g., another full pass marking any vertex that still relaxes, then propagating "affected" through BFS/DFS from those vertices).

## 7. Interview Angle

Bellman-Ford questions usually center on two things: implementing the V-1-passes-plus-one-more pattern correctly, and explaining *why* V-1 passes suffice (tie it to "no simple path has more than V-1 edges"). A very common follow-up is currency arbitrage detection: model each currency as a node, each exchange rate as a weighted edge using `-log(rate)` (so that multiplying rates becomes summing weights, and a profitable arbitrage loop — product of rates > 1 — becomes a negative-weight cycle) — a negative cycle found by Bellman-Ford is exactly an arbitrage opportunity. Another common ask: "can you terminate early?" — yes, if any full pass makes zero relaxations, the distances have already converged and further passes (up to V-1) would be no-ops, though the negative-cycle check pass should still run once more to confirm no cycle exists.

## 8. Memory Hook

**"Relax every edge, V-1 times, then relax once more just to catch a liar."** Dijkstra's trusts a greedy shortcut that negative edges can break; Bellman-Ford refuses to trust anything until every edge has had `V-1` full chances to propagate its information across the graph. The bonus `V`th pass isn't for finding better distances — it's a lie detector: if anything still wants to improve after the guaranteed convergence point, a negative cycle is hiding in the graph.
