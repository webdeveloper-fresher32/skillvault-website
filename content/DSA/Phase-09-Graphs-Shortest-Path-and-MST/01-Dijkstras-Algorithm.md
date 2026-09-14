# Dijkstra's Algorithm

## 1. Problem

Phase 8's BFS finds the shortest path in an **unweighted** graph by counting edges — every edge costs "1 hop," so the first time BFS reaches a node is guaranteed to be via the fewest hops. But most real graphs aren't unweighted: roads have different lengths, flights have different costs, network links have different latencies. Once edges carry different weights, "fewest hops" and "cheapest total cost" stop being the same thing — a 1-hop route costing 50 can easily lose to a 3-hop route costing 12. Plain BFS has no way to account for that; it would happily report the 1-hop route as "shortest."

**Dijkstra's algorithm** solves single-source shortest path on a **weighted graph with non-negative edge weights**: given a starting node, find the cheapest total-weight path from it to every other reachable node. It does this greedily — at each step, it commits to (finalizes) whichever not-yet-finalized node currently has the smallest known distance from the source, on the reasoning that nothing cheaper could possibly reach it later. That reasoning is exactly where the non-negative constraint comes from: it only holds if every edge can only ever add distance, never subtract it.

## 2. Analogy

Think of it like refilling a stadium with water from one entry point, letting it spread outward through a network of pipes of different widths (weights = how long it takes water to pass through a section). At every moment, the "wavefront" of water expands into whichever *directly adjacent* dry section fills up soonest — not necessarily the section that's geometrically nearest, but the one the water reaches first given the pipe widths along the way. Once a section is fully flooded, it's done — water already has the fastest possible route there, and no water arriving later through some other pipe could ever have gotten there sooner, because water only takes *time* to flow through a pipe, it's never sped up along the way. That guarantee — flow only costs time, never *saves* time — is the exact real-world equivalent of "no negative edge weights." If some pipe could magically make water arrive **earlier** than it started (a negative weight), the "once flooded, always correctly flooded first" guarantee falls apart, and the wrong section could get marked done too early.

## 3. Internal Flow

**Setup.** Maintain a `distances` dict, initialized to `0` for the source and infinity for every other node — the best known distance to each node, updated as better routes are discovered. Maintain a min-heap (`heapq`) of `(distance, node)` pairs, seeded with `(0, source)` — the heap always hands back whichever discovered-but-not-yet-finalized node currently has the smallest known distance. Maintain a `visited` set of nodes whose shortest distance is already locked in (finalized).

**Main loop — pop the closest, finalize it, relax its neighbors.** Pop the smallest `(dist, node)` pair off the heap.
- **If `node` is already in `visited`, skip it** — this is a *stale heap entry*: a node can be pushed onto the heap multiple times (once per time a cheaper route to it is found), so by the time an older, worse copy is popped, a better one has usually already been processed. Reprocessing a stale entry wouldn't corrupt the answer (its neighbors would just get non-improving relaxations that fail the `<` check and do nothing) — but it wastes work, and in some sloppy implementations that instead check `dist > distances[node]` before trusting the pop, skipping is *required* for correctness of that particular guard. Either way, skipping stale entries is standard practice.
- Otherwise, add `node` to `visited` — its distance is now final and will never improve.
- **Relax every neighbor**: for each `(neighbor, weight)` edge out of `node`, compute `candidate = dist + weight`. If `candidate < distances[neighbor]`, this is a cheaper route than anything found so far — update `distances[neighbor] = candidate` and push `(candidate, neighbor)` onto the heap. If not cheaper, do nothing.

Repeat until the heap is empty. Every node still in `visited` at the end holds its true shortest distance from the source.

**Why non-negative weights are load-bearing.** The moment `node` is finalized, the algorithm is betting that no future edge relaxation can ever produce a smaller distance for it. That bet only pays off if every edge weight is `>= 0` — because then any path found *later* (necessarily going through more edges, or heavier ones) can only be equal or larger, never smaller. A negative edge violates this: a path that looks expensive early on can become cheap later by crossing a negative edge, but by the time that edge is reached, the node it would have improved may already be finalized and permanently locked at a worse value — see the failure example below.

## 4. Example

A `dijkstra` function using `heapq`, tracing which `(dist, node)` pair is popped, whether it's finalized or skipped as stale, and which edges get relaxed, on a small 5-node weighted graph.

```python
import heapq

def dijkstra(graph, source):
    distances = {node: float('inf') for node in graph}
    distances[source] = 0
    visited = set()
    heap = [(0, source)]

    while heap:
        dist, node = heapq.heappop(heap)
        print(f"\npop ({dist}, {node!r})")

        if node in visited:
            print(f"  {node} already finalized with a better distance ({distances[node]}) -> skip stale entry")
            continue

        if dist > distances[node]:
            print(f"  stale entry: popped distance {dist} > current known {distances[node]} -> skip")
            continue

        visited.add(node)
        print(f"  finalize {node} at distance {dist}")

        for neighbor, weight in graph[node]:
            new_dist = dist + weight
            if new_dist < distances[neighbor]:
                print(f"    relax edge {node}->{neighbor} (w={weight}): "
                      f"{distances[neighbor]} -> {new_dist}")
                distances[neighbor] = new_dist
                heapq.heappush(heap, (new_dist, neighbor))
            else:
                print(f"    edge {node}->{neighbor} (w={weight}): "
                      f"{dist + weight} not better than {distances[neighbor]} -> no relax")

    return distances


graph = {
    'A': [('B', 4), ('C', 1)],
    'B': [('D', 1)],
    'C': [('B', 2), ('D', 5)],
    'D': [('E', 3)],
    'E': [],
}

print("Graph:", graph)
result = dijkstra(graph, 'A')
print("\nFinal shortest distances from A:", result)
```

Executed output:

```
Graph: {'A': [('B', 4), ('C', 1)], 'B': [('D', 1)], 'C': [('B', 2), ('D', 5)], 'D': [('E', 3)], 'E': []}

pop (0, 'A')
  finalize A at distance 0
    relax edge A->B (w=4): inf -> 4
    relax edge A->C (w=1): inf -> 1

pop (1, 'C')
  finalize C at distance 1
    relax edge C->B (w=2): 4 -> 3
    relax edge C->D (w=5): inf -> 6

pop (3, 'B')
  finalize B at distance 3
    relax edge B->D (w=1): 6 -> 4

pop (4, 'B')
  B already finalized with a better distance (3) -> skip stale entry

pop (4, 'D')
  finalize D at distance 4
    relax edge D->E (w=3): inf -> 7

pop (6, 'D')
  D already finalized with a better distance (4) -> skip stale entry

pop (7, 'E')
  finalize E at distance 7

Final shortest distances from A: {'A': 0, 'B': 3, 'C': 1, 'D': 4, 'E': 7}
```

Watch the `(4, 'B')` pop: `B` was pushed twice — once at distance 4 (via `A->B`), once at distance 3 (via `A->C->B`) — and once the cheaper `(3, 'B')` entry is popped and finalizes `B`, the leftover `(4, 'B')` entry is correctly recognized as stale and skipped rather than reprocessed. Notice too that `D` ends up at 4, not 6: it was first discovered via `C->D` (cost 6), then improved via `B->D` (cost 3 + 1 = 4) before `D` was ever finalized — this is exactly the greedy bet paying off, because every edge weight here is non-negative.

**Now the same algorithm on a graph with one negative edge**, to see the bet fail:

```python
import heapq

def dijkstra(graph, source):
    distances = {node: float('inf') for node in graph}
    distances[source] = 0
    visited = set()
    heap = [(0, source)]
    while heap:
        dist, node = heapq.heappop(heap)
        if node in visited:
            print(f"  skip stale pop of already-visited {node}")
            continue
        visited.add(node)
        print(f"finalize {node} at {dist}")
        for neighbor, weight in graph[node]:
            new_dist = dist + weight
            if new_dist < distances[neighbor]:
                print(f"    relax {node}->{neighbor} (w={weight}): {distances[neighbor]} -> {new_dist}")
                distances[neighbor] = new_dist
                heapq.heappush(heap, (new_dist, neighbor))
    return distances


# C->B is negative. True shortest A->B is via C: 2 + (-5) = -3,
# and true shortest A->D is via that same path: -3 + 1 = -2.
graph = {
    'A': [('B', 1), ('C', 2)],
    'B': [('D', 1)],
    'C': [('B', -5)],
    'D': [],
}

result = dijkstra(graph, 'A')
print("\nDijkstra's result:", result)
print("True shortest distances: {'A': 0, 'B': -3, 'C': 2, 'D': -2}")
print("D is wrong: Dijkstra says", result['D'], "but the true shortest is -2")
```

Executed output:

```
finalize A at 0
    relax A->B (w=1): inf -> 1
    relax A->C (w=2): inf -> 2
finalize B at 1
    relax B->D (w=1): inf -> 2
finalize C at 2
    relax C->B (w=-5): 1 -> -3
  skip stale pop of already-visited B
finalize D at 2

Dijkstra's result: {'A': 0, 'B': -3, 'C': 2, 'D': 2}
True shortest distances: {'A': 0, 'B': -3, 'C': 2, 'D': -2}
D is wrong: Dijkstra says 2 but the true shortest is -2
```

`B` gets finalized early at distance 1 (the direct `A->B` edge). Later, the negative edge `C->B` (weight -5) discovers a cheaper route to `B` (distance -3) and updates `distances['B']` to -3 in the dict — but `B` is already in `visited`, so its outgoing edge `B->D` never gets *re-relaxed* using that better -3 value. `D` stays stuck at 2 (computed back when `B` was thought to be 1), when the true shortest distance to `D` is -2. This is the danger of negative weights with Dijkstra's: it doesn't crash or raise an error — it silently returns a plausible-looking but wrong answer, because a value in `distances` can look "updated and correct" while the node's *already-processed* outgoing edges never get the benefit of that update.

## 5. Compare

Dijkstra's is to weighted graphs what BFS is to unweighted ones — same "expand the frontier" idea, but keyed on cumulative distance via a min-heap instead of hop-count via a plain queue. Against **Bellman-Ford** (next lesson): Dijkstra's is faster — O((V + E) log V) with a binary heap versus Bellman-Ford's O(V·E) — but only works correctly with non-negative weights; Bellman-Ford is slower but tolerates negative edges and can detect negative cycles. Against **Floyd-Warshall**: Dijkstra's finds shortest paths from *one* source; running it from every node gives all-pairs shortest paths in O(V·E log V), which beats Floyd-Warshall's O(V³) on sparse graphs but loses to it on dense graphs where E approaches V². Against plain BFS: BFS is a special case of Dijkstra's where every edge weight is implicitly 1 — a plain queue suffices instead of a heap because nothing can ever "jump ahead" in cost.

## 6. Common Mistakes

- **Running Dijkstra's on a graph with negative edge weights.** As shown above, it doesn't error out or crash — it silently returns an incorrect (but plausible-looking) shortest-distance answer, because the greedy "finalize and never revisit" bet depends entirely on weights never being able to retroactively cheapen an already-finalized node.
- **Not skipping stale heap entries.** A node can be pushed multiple times as cheaper routes to it are discovered; when an older, worse `(distance, node)` entry is later popped, it must be recognized (via a `visited` check or a `dist > distances[node]` check) and skipped, not reprocessed as if it were a fresh discovery.
- **Using a `visited` array indexed incorrectly, or checking `visited` after finalizing instead of before** — finalizing a node and then still running its relaxations on a stale (already-superseded) pop wastes work and, in some implementations, can even overwrite a correct `distances` entry with a worse one if the stale-check ordering is wrong.
- **Forgetting to initialize `distances[source] = 0`** and instead leaving it at infinity, which makes every relaxation from the source look like an improvement over "infinity" but never actually seeds the algorithm with the correct starting cost of zero (this one usually still works by luck, but is fragile and confusing to trace).
- **Assuming Dijkstra's finds the shortest path in *hop count*** rather than total weight — on a heavily weighted graph, the "shortest" (cheapest) path Dijkstra's reports can easily involve *more* edges than a costlier, more direct route.

## 7. Interview Angle

Dijkstra's is one of the most commonly asked graph algorithms, both to implement from scratch (the `heapq` + `distances` dict + stale-skip pattern above) and to reason about ("why doesn't this work with negative weights?" — be ready with a concrete counterexample like the one above, not just "it just doesn't"). Interviewers also probe complexity: O((V + E) log V) with a binary heap (each edge can push once, each push/pop is O(log V)), or O(V² ) with a simple array-based "scan for the minimum" implementation, which is actually *better* on dense graphs since it avoids heap overhead. A frequent variant: "find the shortest path, not just its distance" — track a `previous` dict alongside `distances`, updated every time a neighbor is relaxed, then walk it backward from the target to reconstruct the path. Another frequent variant: "cheapest flights with at most K stops" — a reminder that Dijkstra's greedy guarantee can break down the moment the problem adds a *secondary* constraint beyond pure minimum cost.

## 8. Memory Hook

**"Always pop the cheapest unfinished node, and once it's popped clean, it's done for good — as long as nothing can ever get cheaper by going further."** The min-heap always serves up the currently-closest unvisited node; finalizing greedily only works because non-negative weights guarantee no future path can undercut what's already locked in. Stale entries in the heap are just old news — check `visited` (or the current best distance) before trusting a pop, and skip if it's already been beaten.
