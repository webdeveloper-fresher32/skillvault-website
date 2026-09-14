# DP on Trees and Graphs

## 1. Problem

Every DP example so far in this phase has had an obvious, mechanical fill order: increasing index for 1D, top-to-bottom/left-to-right for a grid, increasing prefix length for LCS. Trees and graphs don't come with a built-in linear order — a tree branches, and a graph can have edges pointing anywhere. To apply DP on these structures, you first need to establish a valid **order of dependency** yourself:

- **DP on a tree**: use **post-order traversal** — fully process (recurse into) both children before computing the parent's value. This guarantees every child's DP result is ready before the parent needs it. A canonical example is "house robber III" — given a binary tree of house values, rob houses to maximize total value with the constraint that you cannot rob two directly-connected (parent-child) houses.
- **DP on a DAG (Directed Acyclic Graph)**: use **topological order** — process nodes in an order where every edge points from an earlier-processed node to a later one. This guarantees every predecessor's DP value is ready before a node needs it. A canonical example is finding the **longest path in a DAG**.

The one hard requirement underlying both: **DP is only valid where a consistent dependency order exists.** A general graph with cycles has no such order — you cannot say "node A's answer depends on node B's answer" if B's answer also depends on A's, without first breaking the cycle somehow (e.g., condensing strongly connected components into single "super-nodes," which produces a DAG of components).

## 2. Analogy

For tree DP: think of a company's org chart, where each manager's "team score" depends on knowing the team scores of everyone reporting directly to them first. You can't compute the CEO's total score before every VP's score is finalized, and you can't compute a VP's score before every director under them is finalized — you have to work from the bottom of the org chart (individual contributors) upward, exactly the way post-order traversal visits leaves before their ancestors.

For DAG DP: think of a course prerequisite chart at a university, where some courses must be completed before others. "Longest path in the DAG" is like asking "what's the longest chain of prerequisite courses I could take, back to back?" You can only know how long a chain ending at "Advanced Algorithms" is once you know the longest chains ending at each of its direct prerequisites — which is exactly what a topological ordering guarantees you can compute in order.

## 3. Internal Flow

**Tree DP (post-order, include/exclude per node).** For "maximum sum of non-adjacent nodes in a binary tree" (house robber III style), define a recursive function that returns a **pair** per node: `(include, exclude)`, where `include` is the best total sum in this node's subtree *if this node's value is counted*, and `exclude` is the best total sum *if this node's value is not counted*.

- Base case: a `None` child contributes `(0, 0)` — nothing to include or exclude.
- Recursive case, after getting `(left_include, left_exclude)` and `(right_include, right_exclude)` from both children (post-order — children are always processed first):
  - `include = node.val + left_exclude + right_exclude` (if this node is counted, neither child can be counted, since they're directly adjacent).
  - `exclude = max(left_include, left_exclude) + max(right_include, right_exclude)` (if this node isn't counted, each child independently picks whichever of its own include/exclude was better).
- The final answer at the root is `max(root_include, root_exclude)`.

**DAG DP (topological order, longest path).** 

1. Compute a topological ordering of all nodes (e.g., via Kahn's algorithm — repeatedly remove nodes with in-degree 0, decrementing the in-degree of their neighbors).
2. Initialize `dist[node] = -infinity` for all nodes except the source(s), which start at `0`.
3. Process nodes **in topological order**; for each node, relax every outgoing edge (`dist[neighbor] = max(dist[neighbor], dist[node] + weight)`), exactly the way you'd relax edges in a shortest-path algorithm, but processing in topological order instead of by a priority queue — this works specifically because topological order guarantees every predecessor of a node has already been fully relaxed by the time that node is processed.
4. The answer is `max(dist)` across all nodes (or `dist[target]` for a specific destination).

## 4. Example

Tree DP for house-robber-III style maximum non-adjacent sum, then DAG DP for longest path via topological order:

```python
class Node:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def rob_tree(root):
    def post_order(node, depth=0):
        indent = "  " * depth
        if node is None:
            print(f"{indent}None -> (include=0, exclude=0)")
            return (0, 0)

        print(f"{indent}visiting node {node.val}")
        left_include, left_exclude = post_order(node.left, depth + 1)
        right_include, right_exclude = post_order(node.right, depth + 1)

        include = node.val + left_exclude + right_exclude
        exclude = max(left_include, left_exclude) + max(right_include, right_exclude)
        print(f"{indent}node {node.val}: include={include}, exclude={exclude}")
        return (include, exclude)

    include, exclude = post_order(root)
    return max(include, exclude)


#         3
#        / \
#       2   3
#        \    \
#         3    1
tree = Node(3,
            left=Node(2, right=Node(3)),
            right=Node(3, right=Node(1)))

print("Tree DP (house-robber-III style, post-order include/exclude per node):")
best = rob_tree(tree)
print(f"\nMax sum of non-adjacent nodes: {best}\n")


def longest_path_dag(n, edges):
    from collections import defaultdict, deque

    graph = defaultdict(list)
    indegree = [0] * n
    for u, v, w in edges:
        graph[u].append((v, w))
        indegree[v] += 1

    order = []
    queue = deque(node for node in range(n) if indegree[node] == 0)
    indegree_copy = indegree[:]
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor, _ in graph[node]:
            indegree_copy[neighbor] -= 1
            if indegree_copy[neighbor] == 0:
                queue.append(neighbor)

    print(f"Topological order: {order}")

    dist = [float('-inf')] * n
    dist[order[0]] = 0
    for node in order:
        if dist[node] == float('-inf'):
            continue
        for neighbor, weight in graph[node]:
            candidate = dist[node] + weight
            if candidate > dist[neighbor]:
                print(f"  relax edge {node}->{neighbor} (w={weight}): dist[{neighbor}] {dist[neighbor]} -> {candidate}")
                dist[neighbor] = candidate

    return dist


n = 6
edges = [
    (0, 1, 5),
    (0, 2, 3),
    (1, 3, 6),
    (1, 2, 2),
    (2, 4, 4),
    (2, 5, 2),
    (2, 3, 7),
    (3, 5, 1),
    (3, 4, -1),
    (4, 5, -2),
]
print(f"DAG edges (u, v, weight): {edges}")
dist = longest_path_dag(n, edges)
print(f"\nLongest distances from source (node with indegree 0 first in topo order): {dist}")
print(f"Longest path length overall: {max(dist)}")
```

Actual output:

```text
Tree DP (house-robber-III style, post-order include/exclude per node):
visiting node 3
  visiting node 2
    None -> (include=0, exclude=0)
    visiting node 3
      None -> (include=0, exclude=0)
      None -> (include=0, exclude=0)
    node 3: include=3, exclude=0
  node 2: include=2, exclude=3
  visiting node 3
    None -> (include=0, exclude=0)
    visiting node 1
      None -> (include=0, exclude=0)
      None -> (include=0, exclude=0)
    node 1: include=1, exclude=0
  node 3: include=3, exclude=1
node 3: include=7, exclude=6

Max sum of non-adjacent nodes: 7

DAG edges (u, v, weight): [(0, 1, 5), (0, 2, 3), (1, 3, 6), (1, 2, 2), (2, 4, 4), (2, 5, 2), (2, 3, 7), (3, 5, 1), (3, 4, -1), (4, 5, -2)]
Topological order: [0, 1, 2, 3, 4, 5]
  relax edge 0->1 (w=5): dist[1] -inf -> 5
  relax edge 0->2 (w=3): dist[2] -inf -> 3
  relax edge 1->3 (w=6): dist[3] -inf -> 11
  relax edge 1->2 (w=2): dist[2] 3 -> 7
  relax edge 2->4 (w=4): dist[4] -inf -> 11
  relax edge 2->5 (w=2): dist[5] -inf -> 9
  relax edge 2->3 (w=7): dist[3] 11 -> 14
  relax edge 3->5 (w=1): dist[5] 9 -> 15
  relax edge 3->4 (w=-1): dist[4] 11 -> 13

Longest distances from source (node with indegree 0 first in topo order): [0, 5, 7, 14, 13, 15]
Longest path length overall: 15
```

For the tree: notice both grandchild leaves (`3` and `1`) are visited before their parents, and both parents (`2` and the right subtree's `3`) are fully resolved before the root's own `include`/`exclude` is computed — the root's best answer, `max(7, 6) = 7`, corresponds to robbing the root (`3`) plus both grandchildren (`3` and `1`), skipping both direct children (`2` and `3`), for `3 + 3 + 1 = 7`. For the DAG: the topological order happens to be the natural `0, 1, 2, 3, 4, 5` here, and each edge is relaxed exactly once, in an order where the source node of every edge has already had its final `dist` value by the time that edge is processed — the longest path overall is `15`, achieved by `0 -> 1 -> 2 -> 3 -> 5` (edge weights `5 + 2 + 7 + 1 = 15`), confirmed by the final `dist` array's last entry.

## 5. Compare

- **Tree DP vs grid DP (file 02)**: both rely on a directional fill order, but a grid's order is implicit in its 2D coordinates (always top-to-bottom, left-to-right), while a tree's order must be produced explicitly via a traversal (post-order) — there's no coordinate system to fall back on.
- **DAG DP vs Dijkstra's/BFS shortest path** (Phase 9): topological-order relaxation is strictly simpler and faster (O(V + E), one pass) than Dijkstra's priority-queue approach, but it **only** works on DAGs — the moment a cycle exists, there is no valid topological order, and this whole technique is inapplicable without first removing the cycle (e.g., SCC condensation).
- **Include/exclude pair (tree DP) vs single-value DP table (grid/knapsack)**: some DP states need more than one number per node to capture "the answer under each possible local constraint" — the include/exclude pair here is itself a small 2-state DP, nested inside the larger tree traversal.

## 6. Common Mistakes

- **Trying to apply array-style DP indices to a tree without a traversal order.** A tree has no natural "index 0, 1, 2, ..." — attempting to force one (e.g., by numbering nodes arbitrarily and hoping dependencies still line up) loses track of the actual parent-child dependency and produces answers that only work by coincidence, if at all.
- **Forgetting that DP on a general graph with cycles isn't valid without first reducing to a DAG.** If a "graph DP" recurrence is written assuming every predecessor's value is final, but the graph has a cycle, the assumption is simply false somewhere in that cycle — you must condense cycles into single nodes (SCC condensation) or otherwise remove them before any topological-order DP is sound.
- **Computing the parent before both children in tree DP.** If the recursive calls to `post_order(node.left)` and `post_order(node.right)` are placed *after* code that already tries to use their results, the parent computation silently uses stale/undefined values instead of raising an error, since Python doesn't enforce "define before use" the way some languages do at compile time.
- **Not handling the `None` child base case explicitly.** Skipping the `if node is None: return (0, 0)` check causes an `AttributeError` the moment recursion reaches past a leaf node — every tree DP recursion needs this guard exactly like every array DP needs its base-case row/column.
- **Assuming a graph is already a DAG without checking.** Running Kahn's algorithm (topological sort) on a graph that actually has a cycle will produce an incomplete `order` list (some nodes never reach in-degree 0) — silently proceeding with a partial order rather than checking `len(order) == n` first can hide the fact that the DP is being run on an invalid input.

## 7. Interview Angle

Tree DP problems (house robber III, diameter of a binary tree, maximum path sum in a binary tree) are common because they test whether you can generalize the "define a recurrence and a base case" DP discipline to a non-linear structure — the recursive function returning a **tuple** of related values (rather than a single number) per node is a pattern worth recognizing on sight. DAG DP (longest path in a DAG, critical path scheduling) tests whether you know that "topological order + one pass of relaxation" is enough — a common follow-up is "what if there are cycles?", and a strong answer names SCC condensation (Tarjan's or Kosaraju's algorithm) as the standard fix, connecting this file back to the graph-traversal material in Phase 8/9. Interviewers sometimes deliberately give a graph that *looks* like a DAG but actually has a subtle cycle, specifically to see whether the candidate validates the topological sort completed successfully before trusting its output.

## 8. Memory Hook

**"Children before parents, predecessors before successors."** Tree DP always finishes both children (post-order) before touching the parent; DAG DP always finishes every predecessor (topological order) before touching a node — in both cases, the entire correctness of the DP rests on that processing order being fully respected, since there's no array index to fall back on for "what's already computed."
