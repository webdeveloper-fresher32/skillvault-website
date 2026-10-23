# Cycle Detection in Graphs

## 1. Problem

A lot of graph guarantees only hold if the graph has no cycles — topological sort is only defined on a DAG (previous lesson), some algorithms assume a tree structure and will misbehave or infinite-loop on a graph with a cycle, and plenty of real problems directly ask "does this dependency graph / this set of connections contain a cycle" (deadlock detection, circular-dependency detection in a build system, "will this course schedule ever be completable"). So you need a reliable way to detect whether a cycle exists — and, critically, the correct way to check this **differs depending on whether the graph is directed or undirected**, because "a cycle" means something subtly different in each case.

## 2. Analogy

In an **undirected** friend graph, if you're visiting friend B and B happens to be friends with the person who introduced you (your "parent" in this traversal), that's not a cycle — that's just the same friendship you already know about, seen from the other side. A real cycle requires meeting someone you've *already met before through a different path*, not simply bumping back into whoever brought you here.

In a **directed** graph — say, a chain of favors where "A owes B" is a one-way arrow — the story is different. Even if C doesn't owe anything back to whoever directly introduced C, if C's chain of "who owes whom" eventually loops back to *any* earlier person **currently still being traced** — not just the immediate predecessor — that's a real cycle: a circular debt that can never be settled by paying people off in order. Direction means a back-edge to *any* ancestor still "in progress" counts, not just the one you arrived from.

## 3. Internal Flow

**Undirected graphs — DFS with parent-tracking.** Run DFS from each unvisited node, and to every recursive call pass along "who did I just come from" (the parent in the DFS tree). When looking at node X's neighbors, skip the neighbor that *is* the parent (that's just the edge you arrived on, traversed backwards — not a cycle). If any *other* neighbor has already been visited, that's a genuine cycle: you've reached an already-seen node through a second, different path. This "skip the parent" rule is essential precisely because every undirected edge is stored twice (once in each direction, per the representations lesson) — without it, every single edge would look like a false "back to where I came from" cycle.

**Directed graphs — DFS with a "currently visiting" set (recursion-stack tracking), not just a plain visited set.** In a directed graph, checking only "has this neighbor been visited before" is not enough — a neighbor might have been fully explored *and finished* through a completely different, non-overlapping branch of the graph, which is perfectly fine and not a cycle. What actually indicates a cycle is reaching a neighbor that is an **ancestor currently still on the active DFS call stack** — meaning the graph loops back onto a path that is still "in progress," not one that's already closed out.

**The three-color scheme makes this precise.** Every node starts **white** (unvisited). When DFS first visits a node, it's marked **gray** — "currently on the recursion stack, still being explored." When DFS finishes exploring all of a node's descendants and is about to backtrack out of it, it's marked **black** — "fully explored, no longer on the stack." A cycle is detected exactly when DFS follows an edge to a node that is currently **gray** — a back edge to a live ancestor. An edge to a **black** node is completely fine (it's a legitimate "already fully explored, different branch" situation, sometimes called a cross edge or forward edge) and must not be flagged as a cycle.

## 4. Example

Directed-graph cycle detection using the three-color (white/gray/black) DFS scheme, tracing every color transition, run on both a graph with a cycle and a DAG without one — followed by the undirected, parent-tracking version for comparison.

```python
from collections import defaultdict

WHITE, GRAY, BLACK = "WHITE", "GRAY", "BLACK"

def has_cycle_directed(graph, num_nodes):
    color = {node: WHITE for node in range(num_nodes)}

    def dfs(node):
        color[node] = GRAY   # currently on the recursion stack ("visiting")
        print(f"  visit {node} -> color[{node}] = GRAY")
        for neighbor in graph[node]:
            print(f"    check edge {node} -> {neighbor}, color[{neighbor}] = {color[neighbor]}")
            if color[neighbor] == GRAY:
                print(f"    back edge to a GRAY node {neighbor} -> CYCLE FOUND")
                return True
            if color[neighbor] == WHITE:
                if dfs(neighbor):
                    return True
        color[node] = BLACK   # fully explored, remove from "currently visiting"
        print(f"  done with {node} -> color[{node}] = BLACK")
        return False

    for node in range(num_nodes):
        if color[node] == WHITE:
            if dfs(node):
                return True
    return False


print("--- Directed graph WITH a cycle: 0->1->2->0 ---")
graph_with_cycle = defaultdict(list)
graph_with_cycle[0] = [1]
graph_with_cycle[1] = [2]
graph_with_cycle[2] = [0]
graph_with_cycle[3] = []
print("Cycle detected:", has_cycle_directed(graph_with_cycle, 4))

print("\n--- Directed graph WITHOUT a cycle (DAG): 0->1->2, 0->2 ---")
dag = defaultdict(list)
dag[0] = [1, 2]
dag[1] = [2]
dag[2] = []
print("Cycle detected:", has_cycle_directed(dag, 3))


def has_cycle_undirected(graph, num_nodes):
    visited = set()

    def dfs(node, parent):
        visited.add(node)
        for neighbor in graph[node]:
            if neighbor == parent:
                continue  # skip the edge straight back to where we came from
            if neighbor in visited:
                print(f"  found back edge {node} -> {neighbor} (not the parent) -> CYCLE")
                return True
            if dfs(neighbor, node):
                return True
        return False

    for node in range(num_nodes):
        if node not in visited:
            if dfs(node, -1):
                return True
    return False


print("\n--- Undirected graph WITH a cycle: 0-1, 1-2, 2-0 (triangle) ---")
undirected_with_cycle = defaultdict(list)
for u, v in [(0, 1), (1, 2), (2, 0)]:
    undirected_with_cycle[u].append(v)
    undirected_with_cycle[v].append(u)
print("Cycle detected:", has_cycle_undirected(undirected_with_cycle, 3))

print("\n--- Undirected graph WITHOUT a cycle: 0-1, 1-2 (a path) ---")
undirected_tree = defaultdict(list)
for u, v in [(0, 1), (1, 2)]:
    undirected_tree[u].append(v)
    undirected_tree[v].append(u)
print("Cycle detected:", has_cycle_undirected(undirected_tree, 3))
```

Executed output:

```
--- Directed graph WITH a cycle: 0->1->2->0 ---
  visit 0 -> color[0] = GRAY
    check edge 0 -> 1, color[1] = WHITE
  visit 1 -> color[1] = GRAY
    check edge 1 -> 2, color[2] = WHITE
  visit 2 -> color[2] = GRAY
    check edge 2 -> 0, color[0] = GRAY
    back edge to a GRAY node 0 -> CYCLE FOUND
Cycle detected: True

--- Directed graph WITHOUT a cycle (DAG): 0->1->2, 0->2 ---
  visit 0 -> color[0] = GRAY
    check edge 0 -> 1, color[1] = WHITE
  visit 1 -> color[1] = GRAY
    check edge 1 -> 2, color[2] = WHITE
  visit 2 -> color[2] = GRAY
  done with 2 -> color[2] = BLACK
  done with 1 -> color[1] = BLACK
    check edge 0 -> 2, color[2] = BLACK
  done with 0 -> color[0] = BLACK
Cycle detected: False

--- Undirected graph WITH a cycle: 0-1, 1-2, 2-0 (triangle) ---
  found back edge 2 -> 0 (not the parent) -> CYCLE
Cycle detected: True

--- Undirected graph WITHOUT a cycle (DAG): 0-1, 1-2 (a path) ---
Cycle detected: False
```

The DAG trace is the case worth staring at: when DFS finally checks edge `0 -> 2`, node 2 is already **BLACK** (fully explored, finished, no longer on the stack) — not gray — so it correctly registers as a non-cycle even though node 2 was visited earlier via a different path (through node 1). If the algorithm had used a plain visited set instead of three colors, it would have wrongly flagged this DAG as cyclic, since 2 *was* visited before. The undirected triangle trace shows the mirror case: node 0 is revisited from node 2, but 0 is *not* node 2's immediate parent (node 1 is), so the parent-skip rule doesn't apply and it's correctly flagged as a genuine cycle.

## 5. Compare

Both algorithms run in O(V + E) time, but they track fundamentally different things: the undirected version only needs a plain visited set plus one extra piece of context per call (the parent), because in an undirected graph, revisiting *any* non-parent node you've seen before is unambiguously a cycle. The directed version needs the finer-grained three-state tracking (white/gray/black) because in a directed graph, "visited before" is not enough information — a previously visited node might be safely finished (black, no cycle) or still actively being explored on the current path (gray, genuine cycle), and only the recursion-stack ("gray") check tells them apart. This is the single most important distinction to internalize: the undirected algorithm is strictly simpler because undirected edges only ever create a cycle by looping back to a live ancestor by construction (there's no "already finished, unrelated branch" case to worry about the way there is with directed edges).

## 6. Common Mistakes

- **Using the undirected-graph algorithm (parent-check only) on a directed graph.** This misses real cycles that don't happen to involve the immediate parent — e.g., a graph with edges A→B, B→C, C→A has a clear cycle, but a naive "is the neighbor equal to my parent" check would need the gray/black distinction to catch it; a plain visited-check without the recursion-stack concept can also wrongly flag perfectly fine DAGs as cyclic (as shown in the DAG trace above) or miss real ones, depending on exactly how it's misapplied.
- **Forgetting to reset/remove a node from the "currently visiting" (gray) set when backtracking out of it.** If a node is never demoted from gray to black once its DFS call returns, later branches that legitimately reach that (finished) node through a different path get incorrectly flagged as finding a cycle, since the node still looks "currently active" when it no longer is.
- **Applying cycle detection only from a single starting node** in a graph that isn't fully connected — nodes unreachable from the chosen start are never visited at all, so a cycle sitting entirely within a disconnected component gets silently missed. Always loop over all nodes and start a fresh DFS from any node still white/unvisited.
- **Confusing "revisited node" with "cycle" in an undirected graph without excluding the parent edge** — since every undirected edge is stored in both directions, failing to skip the parent means the trivial back-and-forth over a single edge is always misreported as a cycle, even on a graph that's just a simple path or tree.

## 7. Interview Angle

The question "does this graph have a cycle" is almost never asked without also specifying (or expecting you to ask) whether the graph is directed or undirected — volunteering that distinction unprompted is a strong signal. Be ready to explain *why* directed cycle detection needs three colors and undirected only needs parent-tracking (the reasoning in the Compare section above) rather than just reciting the algorithms from memory. This lesson is also the natural bridge back to topological sort: "detect a cycle in a directed graph" and "topological sort only works on a DAG" are two framings of the same underlying check, and Kahn's algorithm's "not all nodes processed" signal (previous lesson) is an alternative, BFS-based way to detect a directed cycle without any coloring at all.

## 8. Memory Hook

**"Undirected: don't walk back over the edge you came in on. Directed: watch for GRAY, not just visited."** Parent-skip catches the false cycle in undirected graphs; the gray/black distinction catches the real one in directed graphs — a black node is safely finished, a gray node is still live on the stack, and only stepping into a gray node means you've looped back onto yourself.
