# Topological Sort

## 1. Problem

Some collections of tasks have dependencies: "compile the library before compiling the app that uses it," "finish prerequisite courses before the course that requires them," "build the base Docker image before the image that's built on top of it." Given a set of these "must come before" relationships, you need a single linear order to actually execute the tasks in — one where every dependency is satisfied, meaning every task appears *before* every other task that depends on it.

This only makes sense if the dependency relationships don't contradict each other. If task A must come before B, and B must come before A, there's no valid order — that's a circular dependency, and no linear ordering can satisfy it. So the problem is really two problems in one: find a valid linear order if one exists, and recognize when one doesn't (because the dependencies form a cycle).

## 2. Analogy

Think of a university's course catalog. "Calculus II" requires "Calculus I." "Linear Algebra" requires "Calculus I." "Differential Equations" requires both "Calculus II" and "Linear Algebra." A valid four-year plan is any ordering of these courses where every prerequisite is scheduled in an earlier semester than the course that needs it — there can be multiple valid plans (Calculus II and Linear Algebra could be taken in either order relative to each other, as long as both come after Calculus I and before Differential Equations), but every valid plan agrees on the *relative* order of any two courses that have a direct or indirect prerequisite relationship. If the catalog ever (accidentally) required "Calculus I" as a prerequisite for itself through some chain of other courses, no four-year plan could ever be built — that's a cycle, and it makes the whole schedule impossible.

## 3. Internal Flow

**Only defined for DAGs.** A topological sort is only meaningful on a **directed acyclic graph** — directed because "A before B" is inherently one-directional, acyclic because a cycle would create a contradiction (task X would need to come before itself, transitively). If the input graph has a cycle, no valid topological order exists at all — the algorithm's job includes detecting that impossibility, not silently producing a wrong answer.

**Kahn's algorithm — BFS-based, using in-degree counting.** Compute the **in-degree** of every node (how many edges point *into* it — i.e., how many prerequisites it has). Any node with in-degree 0 has no unmet prerequisites, so it's safe to schedule immediately — put all such nodes in a queue. Repeatedly: dequeue a node, add it to the output order, and for each of its outgoing edges, decrement the in-degree of the node on the other end (you've just "satisfied" one of that node's prerequisites). Whenever decrementing brings some node's in-degree to exactly 0, all its prerequisites are now met, so enqueue it. Continue until the queue is empty. **The cycle check is a side effect of this process**: if the graph is a valid DAG, every node eventually reaches in-degree 0 and gets processed, so the output order contains all V nodes. If a cycle exists, every node on that cycle keeps a permanently nonzero in-degree from the other cycle members, so those nodes are never enqueued — the output order ends up shorter than V, which is exactly how you detect the cycle after the fact.

**DFS-based — post-order reversed.** Run a standard DFS over the graph; whenever a node finishes being fully explored (all its descendants processed), push it onto a stack (or prepend it to a list). Once DFS completes for all nodes, that stack, read top-to-bottom (equivalently: the finish-order list, reversed), is a valid topological order. The intuition: a node only finishes *after* everything reachable from it has finished, so it should come *before* those things in the final order — which is exactly what reversing the finish order gives you.

## 4. Example

A course-schedule style problem — 6 courses with prerequisite edges — solved with Kahn's algorithm, tracing the in-degree array and queue contents at each step, followed by a cyclic graph to show detection.

```python
from collections import deque, defaultdict

# Course-schedule style: edge u -> v means "u must be taken before v"
num_courses = 6
prereqs = [
    (0, 1),  # 0 must come before 1
    (0, 2),
    (1, 3),
    (2, 3),
    (3, 4),
    (4, 5),
]

def kahns_topo_sort(num_courses, prereqs):
    graph = defaultdict(list)
    in_degree = [0] * num_courses

    for u, v in prereqs:
        graph[u].append(v)
        in_degree[v] += 1

    print("Initial in-degree array:", in_degree)

    queue = deque([node for node in range(num_courses) if in_degree[node] == 0])
    print("Initial queue (in-degree 0):", list(queue))

    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        print(f"\npop {node} -> order so far: {order}")
        for neighbor in graph[node]:
            in_degree[neighbor] -= 1
            print(f"  decrement in-degree of {neighbor} -> {in_degree[neighbor]}")
            if in_degree[neighbor] == 0:
                queue.append(neighbor)
                print(f"  {neighbor} reached in-degree 0 -> enqueue")
        print(f"  queue now: {list(queue)}")

    if len(order) != num_courses:
        return None  # cycle detected: not all nodes processed
    return order

result = kahns_topo_sort(num_courses, prereqs)
print("\nFinal topological order:", result)

print("\n--- Cyclic graph example ---")
cyclic_prereqs = [(0, 1), (1, 2), (2, 0)]  # 0 -> 1 -> 2 -> 0
cyclic_result = kahns_topo_sort(3, cyclic_prereqs)
print("Result on cyclic graph:", cyclic_result)
```

Executed output:

```
Initial in-degree array: [0, 1, 1, 2, 1, 1]
Initial queue (in-degree 0): [0]

pop 0 -> order so far: [0]
  decrement in-degree of 1 -> 0
  1 reached in-degree 0 -> enqueue
  decrement in-degree of 2 -> 0
  2 reached in-degree 0 -> enqueue
  queue now: [1, 2]

pop 1 -> order so far: [0, 1]
  decrement in-degree of 3 -> 1
  queue now: [2]

pop 2 -> order so far: [0, 1, 2]
  decrement in-degree of 3 -> 0
  3 reached in-degree 0 -> enqueue
  queue now: [3]

pop 3 -> order so far: [0, 1, 2, 3]
  decrement in-degree of 4 -> 0
  4 reached in-degree 0 -> enqueue
  queue now: [4]

pop 4 -> order so far: [0, 1, 2, 3, 4]
  decrement in-degree of 5 -> 0
  5 reached in-degree 0 -> enqueue
  queue now: [5]

pop 5 -> order so far: [0, 1, 2, 3, 4, 5]
  queue now: []

Final topological order: [0, 1, 2, 3, 4, 5]

--- Cyclic graph example ---
Initial in-degree array: [1, 1, 1]
Initial queue (in-degree 0): []
Result on cyclic graph: None
```

Notice node 3 has in-degree 2 initially (it depends on both 1 and 2), so it only gets enqueued once *both* of those decrements bring it to 0 — it doesn't enqueue after node 1's decrement (in-degree drops to 1, not 0), only after node 2's decrement finishes the job. In the cyclic example, every node starts with in-degree 1 (each is depended on by exactly one other node in the 0→1→2→0 cycle), so the initial queue is empty — nothing ever gets processed, `order` stays empty, and the length check (`0 != 3`) correctly reports a cycle via `None`.

## 5. Compare

Kahn's algorithm and the DFS-based approach produce a valid topological order in the same O(V + E) time, and either is a correct choice — the difference is mostly about what's convenient to reason about. Kahn's algorithm gives you cycle detection "for free" as a natural side effect (fewer than V nodes processed means a cycle), and it directly produces the order in the correct direction without needing a reversal step, which is why it's usually the more popular choice in interviews. The DFS-based approach requires a separate cycle-detection pass (see the next lesson) if you need one, and it's easy to forget the final reversal step, silently producing the order backwards. Both approaches also naturally reveal that a DAG can have *multiple* valid topological orders whenever two nodes have no path between them — the order is only forced where a genuine dependency exists.

## 6. Common Mistakes

- **Applying topological sort to a graph that has a cycle without detecting it first.** The result is undefined — a naive DFS-based implementation without cycle checking might silently produce a nonsensical order (or infinite-loop) instead of raising an error. Always verify: with Kahn's algorithm, check that the final order contains all V nodes; with DFS, run cycle detection (previous/next lesson) before trusting the postorder.
- **Forgetting to reverse the DFS postorder (or reversing it incorrectly).** The raw finish order from a DFS-based topological sort is backwards relative to the dependency direction — forgetting the reversal (or accidentally reversing twice) silently produces the exact opposite of a valid order.
- **Initializing the Kahn's-algorithm queue only once and not re-scanning for in-degree-0 nodes that appear later.** The queue is meant to grow dynamically as decrements bring new nodes to in-degree 0 mid-algorithm — a common bug is building the initial queue correctly but then failing to enqueue newly-zeroed nodes inside the main loop.
- **Off-by-one in in-degree bookkeeping** — incrementing in-degree for the wrong endpoint of an edge (e.g., incrementing the source instead of the destination) silently corrupts which nodes are considered "ready" at each step.

## 7. Interview Angle

"Course Schedule" (does a valid order exist) and "Course Schedule II" (produce the order) are the canonical framing, but the same pattern shows up as build-dependency resolution, task-scheduling with prerequisites, and package-manager install ordering. Interviewers expect you to name Kahn's algorithm and articulate the in-degree-0 intuition without prompting, and to state clearly that the graph must be checked for cycles (or shown to be a DAG) before the result means anything. A very common follow-up: "what if there are multiple valid orders — how would you return a specific one (e.g., lexicographically smallest)?" — the answer is swapping the plain queue for a min-heap keyed on node value, so ties among simultaneously-ready nodes are broken by the smallest node first.

## 8. Memory Hook

**"In-degree 0 means ready to go — process it, and check off its dependents."** Kahn's algorithm is BFS wearing a dependency-counting hat: track in-degree, seed the queue with the zero-in-degree nodes, decrement as you go, and if fewer than V nodes ever get processed, there's a cycle hiding in there. DFS-based topo sort is **postorder, reversed** — never forget the reversal.
