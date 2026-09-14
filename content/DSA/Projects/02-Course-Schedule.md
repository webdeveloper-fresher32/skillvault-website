# Course Schedule

## Problem Statement

There are `numCourses` courses labeled `0` to `numCourses - 1`. Some courses have prerequisites, given as a list of pairs `[course, prereq]` meaning you must take `prereq` before `course`. Determine:

1. Whether it's possible to finish all courses (i.e., the prerequisite graph has no cycle).
2. As a follow-up: return **one valid order** in which the courses can be taken, or an empty result if it's impossible.

Example: `numCourses = 4`, `prerequisites = [[1,0],[2,0],[3,1],[3,2]]` — a valid order is `[0, 1, 2, 3]`. But `numCourses = 2`, `prerequisites = [[1,0],[0,1]]` has course `0` depending on `1` and `1` depending on `0` — a cycle, so it's impossible.

## Approach Discussion

Model courses as nodes and each prerequisite pair `[course, prereq]` as a directed edge `prereq -> course` (`DSA/Phase-08-Graphs-Traversal/01-Graph-Representations.md`). "Can all courses be finished" is then exactly "does this directed graph contain a cycle" — if course A depends (transitively) on course B and B depends back on A, neither can ever be scheduled first.

This is the textbook use case for **topological sort** (`DSA/Phase-08-Graphs-Traversal/03-Topological-Sort.md`), specifically **Kahn's algorithm**, which is itself BFS-shaped:

- Track each node's **in-degree** (number of unmet prerequisites).
- Any node with in-degree `0` has no unmet prerequisites and can be taken immediately — seed a BFS queue with all such nodes.
- Process the queue: pop a node, append it to the output order, and for each course that depends on it, decrement that course's in-degree. If a dependent's in-degree hits `0`, it's now unblocked — push it onto the queue.
- **The cycle check falls out for free**: if the graph has no cycle, every node eventually reaches in-degree `0` and gets processed, so the final order contains all `numCourses` nodes. If there's a cycle, the nodes on that cycle never reach in-degree `0` (each is always waiting on another node in the same cycle), so they're never added — the output order comes up short, and that shortfall *is* the cycle signal.

So the combined pattern is: graph traversal (BFS) provides the mechanism for visiting nodes in dependency order, and topological sort is what that traversal produces when driven by in-degree bookkeeping. Neither "just do BFS" nor "just check in-degrees" alone answers both parts of the question — the BFS-with-in-degree-tracking is what simultaneously builds the order and detects the cycle.

## Solution

```python
from collections import deque


def find_order(num_courses, prerequisites):
    graph = [[] for _ in range(num_courses)]
    in_degree = [0] * num_courses

    for course, prereq in prerequisites:
        graph[prereq].append(course)
        in_degree[course] += 1

    queue = deque([c for c in range(num_courses) if in_degree[c] == 0])
    order = []

    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    can_finish = len(order) == num_courses
    return can_finish, (order if can_finish else [])


if __name__ == "__main__":
    # Solvable case
    num_courses = 4
    prereqs = [[1, 0], [2, 0], [3, 1], [3, 2]]
    print(find_order(num_courses, prereqs))

    # Cyclic case: 0 -> 1 -> 0
    num_courses2 = 2
    prereqs2 = [[1, 0], [0, 1]]
    print(find_order(num_courses2, prereqs2))
```

**Actual output when run:**

```
(True, [0, 1, 2, 3])
(False, [])
```

The first case confirms all 4 courses can be finished and returns a valid order (course `0` first, since nothing depends on it having a prerequisite; `3` last, since it depends on both `1` and `2`). The second case correctly detects the `0 -> 1 -> 0` cycle: neither node ever reaches in-degree `0`, so the returned order is empty and `can_finish` is `False`.

## Complexity

- **Time**: O(V + E) — every node is enqueued and processed exactly once (O(V)), and every edge is examined exactly once when decrementing an in-degree (O(E)).
- **Space**: O(V + E) — the adjacency list stores E edges across V nodes, plus O(V) for the in-degree array and the BFS queue/output order.
