# BFS and DFS

## 1. Problem

Once a graph is represented (adjacency list or matrix — see the previous lesson), the next question is almost always some version of "can I reach node Y from node X, and if so, how?" — is there a path at all, what's the shortest path, can I visit every reachable node, does exploring from here ever loop back on itself. Answering any of these requires a systematic way to **walk the graph without revisiting the same node forever** and without missing any reachable node.

Unlike a tree, a graph can have cycles — A connects to B, B connects to C, C connects back to A. A naive traversal that doesn't track where it's already been will walk that cycle forever and never terminate. So graph traversal needs two things a plain recursive walk doesn't automatically give you: a systematic *order* to visit nodes in, and a *memory* of what's already been visited.

## 2. Analogy

Picture exploring an unfamiliar building looking for an exit, with two different strategies.

**BFS (queue, level-by-level)** is like a group of people spreading out from the entrance floor by floor: everyone checks every room on the current floor before anyone moves up to the next floor. This is slower to get deep into the building, but it guarantees that the *first* time you find the exit, you found it by the shortest possible number of floors climbed — you'd never skip ahead to floor 5 while floor 2 still has unchecked rooms.

**DFS (stack or recursion, depth-first)** is like one person exploring alone, picking a single corridor and following it as far as it goes — through room after room, floor after floor — until it dead-ends, and only then backtracking to try the last unexplored branch point. This gets deep fast and uses far less "who's currently exploring" bookkeeping, but the first exit found might be down a long, winding path, not the shortest one.

Both approaches, if done carefully, will eventually find every reachable room — they just explore in a fundamentally different order, and only one of them (BFS) can promise "shortest path" as a side effect of *how* it explores.

## 3. Internal Flow

**BFS — queue-based, level-by-level.** Start by enqueuing the start node and marking it visited. Then repeatedly: dequeue a node from the front, process it, and enqueue every one of its unvisited neighbors (marking each visited *at the moment it's enqueued*, not later). Because a FIFO queue processes things in the order they were added, all nodes at distance 1 from the start get dequeued (and their distance-2 neighbors get enqueued) before any distance-2 node is itself dequeued. That level-by-level guarantee is exactly why the first time BFS reaches a target node, it has done so via a shortest path — in an **unweighted** graph, where every edge costs the same "1 step."

**DFS — stack (explicit) or recursion (implicit call stack), goes deep before backtracking.** Start at the start node, mark it visited, then immediately recurse (or push to a stack) into one unvisited neighbor, going as deep as possible before ever considering a sibling branch. Only once a path is fully exhausted (every neighbor along it visited, dead end reached) does the recursion unwind — pop back up — and try the next unvisited neighbor at a shallower point. Recursion is the natural implementation (each call frame *is* a stack frame), but an explicit stack works identically for iterative DFS.

**The visited set — non-negotiable on a graph.** A tree traversal doesn't strictly need a visited set (there's exactly one path down from the root, no way to revisit a node by construction). A graph traversal *always* needs one, because cycles mean a node can be reachable from multiple directions — without tracking what's already been seen, both BFS and DFS will re-process the same node indefinitely, an infinite loop rather than a crash, which makes it a nasty one to debug.

**Where to mark "visited" in BFS matters.** Mark a node visited the moment it's *enqueued*, not when it's later *dequeued*. If marking is deferred to dequeue time, the same node can be discovered (and enqueued) multiple times by different nodes before any of those enqueues get processed — wasting work and, in the worst case, blowing up the queue size well beyond the number of actual nodes.

## 4. Example

The same graph — with a cycle deliberately included, to prove the visited set is load-bearing — traversed with both BFS (iterative, queue-based) and DFS (recursive), plus a BFS-distance trace showing the shortest-path guarantee in action.

```python
from collections import deque, defaultdict

# Graph with a cycle, to prove the visited set matters
graph = {
    "A": ["B", "C"],
    "B": ["A", "D", "E"],
    "C": ["A", "F"],
    "D": ["B"],
    "E": ["B", "F"],
    "F": ["C", "E"],
}

def bfs(graph, start):
    visited = {start}          # mark visited at ENQUEUE time
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)   # mark before enqueue, not after dequeue
                queue.append(neighbor)
    return order

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

bfs_order = bfs(graph, "A")
dfs_order = dfs_recursive(graph, "A")

print("BFS visit order from A:", bfs_order)
print("DFS visit order from A:", dfs_order)

# Shortest path guarantee: BFS layer by layer gives distance from A
def bfs_distances(graph, start):
    dist = {start: 0}
    queue = deque([start])
    while queue:
        node = queue.popleft()
        for neighbor in graph[node]:
            if neighbor not in dist:
                dist[neighbor] = dist[node] + 1
                queue.append(neighbor)
    return dist

print("BFS distances from A:", bfs_distances(graph, "A"))
```

Executed output:

```
BFS visit order from A: ['A', 'B', 'C', 'D', 'E', 'F']
DFS visit order from A: ['A', 'B', 'D', 'E', 'F', 'C']
BFS distances from A: {'A': 0, 'B': 1, 'C': 1, 'D': 2, 'E': 2, 'F': 2}
```

BFS visits `B` and `C` (both direct neighbors of `A`, distance 1) before touching anything at distance 2 — `D`, `E`, `F` all come after, exactly matching the distances printed at the end. DFS, by contrast, plunges down through `B → D` (a dead end, since `D`'s only neighbor `B` is already visited), backtracks to `B`'s next neighbor `E`, plunges further to `F`, and only *then*, having exhausted that entire branch, backtracks all the way up to `A`'s second neighbor `C` — visiting it dead last, even though `C` is only one edge away from `A`. Both orders are valid traversals; only BFS's order doubles as a shortest-path guarantee.

## 5. Compare

BFS and DFS visit every reachable node in O(V + E) time either way — the complexity is identical, so the choice between them is about what you additionally need out of the traversal. Pick BFS when the shortest path (in an unweighted graph) or "distance in steps" matters, or when you specifically want a level-by-level view (e.g., "what's reachable within k steps"). Pick DFS when you need to explore full paths to completion before comparing alternatives — cycle detection, topological sort, connected components, and backtracking-style path enumeration all lean naturally on DFS's "go deep, then backtrack" structure. DFS also typically uses less peak memory on a wide, shallow graph (only the current path is on the stack), while BFS's queue can hold an entire "frontier" of nodes at once, which can be large on a wide graph.

## 6. Common Mistakes

- **Forgetting the visited set entirely.** On a graph with any cycle, both BFS and DFS will loop forever, revisiting the same handful of nodes indefinitely — this typically manifests as a hang or a stack overflow (for recursive DFS), not a clean crash, which makes it harder to spot in a debugger than a straightforward bug.
- **Marking a node visited at dequeue time instead of enqueue time in BFS.** If two different nodes both enqueue the same unvisited neighbor before either of those neighbor entries is dequeued and marked, that neighbor ends up in the queue twice — wasted work at best, and in a graph where visited-marking gates some other action (like counting nodes), a source of double-counting bugs.
- **Using DFS when the problem actually needs the shortest path in an unweighted graph.** DFS will find *a* path, but there's no guarantee it's the shortest one — this is a subtle correctness bug rather than a crash, since the code runs fine and returns a plausible-looking (but wrong) answer.
- **Recursive DFS on a very deep or very large graph hitting Python's recursion limit.** A long chain of nodes can exceed the default recursion depth and raise `RecursionError` — the fix is either raising the recursion limit deliberately or converting to an iterative, explicit-stack DFS.

## 7. Interview Angle

"Traverse this graph" is rarely the actual question — the real signal interviewers listen for is whether you pick BFS or DFS *because* of what the problem is asking, not out of habit. "Shortest path," "minimum number of steps," "level of the tree/graph" are BFS tells. "Does a path exist through all of X," "detect a cycle," "explore all possibilities/backtrack," "topological order" are DFS tells. Also be ready to state, without hesitating, that BFS's shortest-path guarantee holds *only* for unweighted graphs — weighted shortest path needs Dijkstra or Bellman-Ford (a later lesson), and confusing the two is an easy interview trap. Expect a follow-up on time and space complexity: both are O(V + E) time; BFS is O(V) space for the queue and visited set, DFS is O(V) worst case for the recursion stack on a long chain.

## 8. Memory Hook

**"BFS: queue, spread wide, shortest path. DFS: stack/recursion, go deep, then backtrack."** Mark visited **when you enqueue**, not when you dequeue — that's the BFS gotcha. Never skip the visited set on a graph — cycles make it mandatory, not optional like it often is on a tree.
