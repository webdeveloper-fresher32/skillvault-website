# Union-Find (Disjoint Set Union)

## 1. Problem

Some problems only ever ask one question, over and over, as new connections keep arriving: "are these two elements in the same connected group?" — "is this pair of accounts linked through some chain of shared devices?", "would adding this edge to a growing network connect two components that were previously separate, or are they already connected?" You *could* answer this by re-running a full BFS/DFS traversal from scratch every single time a new connection is added, checking reachability — but that's O(V + E) per query, and if connections are being added one at a time in a loop, that cost multiplies across every addition.

**Union-Find** (also called Disjoint Set Union, DSU) is a specialized structure built for exactly this narrower, repeated need: track a dynamic collection of disjoint (non-overlapping) groups, support merging two groups together (`union`), and support asking "which group is this element in" (`find`) — both in close to O(1) amortized time, once two specific optimizations are applied together. It gives up the ability to answer "what's the shortest path between these two nodes" or "list every node in this group" — it only ever answers "same group or not," but it answers that question extremely fast, repeatedly, as the groups keep changing.

## 2. Analogy

Think of it like tracking company mergers over time, where every company keeps a single pointer to whichever company it currently answers to. Initially, every company is its own boss (self-owned). When Company A merges into Company B, A's pointer is updated to point to B — B is now "the boss" for both. If C later merges into A... except A already answers to B, so really C should end up recognizing B as the ultimate boss too, not stopping at A, which is just a middle-manager now.

**Path compression** is like every employee, whenever they ask "who's the CEO?", getting a note stapled to their own desk saying the answer directly — so next time *anyone* asks that same employee, there's no need to walk up the whole chain of command again; they already know the CEO's name straight from the note. **Union-by-rank** is the policy of always attaching the smaller of two merging companies underneath the bigger one's structure (never the reverse) — this keeps the "chain of command" from growing tall and stringy, which is exactly what keeps future "who's the boss" questions fast.

## 3. Internal Flow

**The parent array.** Every element starts as its own parent — `parent[i] = i` — meaning every element begins in its own singleton group, and the "representative" (root) of a group is whichever element a chain of parent-pointers ultimately leads to.

**`find(x)` — walk up the parent chain to the root, with path compression.** Follow `parent[x]`, then `parent[parent[x]]`, and so on, until reaching an element that is its own parent (the root of the tree = the group's representative). **Path compression** rewrites every node visited along that walk to point *directly* at the root once it's found — so the very next `find` call on any of those nodes is an O(1) direct jump, not a repeat of the walk. Without path compression, repeated unions in a bad order can produce a long, thin chain, and `find` degrades toward O(n) per call.

**`union(a, b)` — find both roots, then attach one under the other, using rank.** First call `find(a)` and `find(b)` to get each element's current root. If the roots are already the same, they're already in the same group — nothing to do. Otherwise, merge the two trees by making one root point to the other. **Union-by-rank** (or union-by-size) decides *which* root becomes the parent of the other: attach the root with the smaller rank (a rough proxy for tree height) underneath the root with the larger rank, and only increment the surviving root's rank if the two ranks were tied. This keeps the resulting tree shallow — attaching a bigger tree under a smaller one, by contrast, needlessly grows the height of what should stay flat.

**Why both optimizations together matter.** Either optimization alone already helps; using **both together** is what gives the near-O(1) amortized bound (technically O(α(n)), where α is the inverse Ackermann function — for any practical input size, effectively a small constant). Path compression flattens trees discovered during `find` calls; union-by-rank prevents trees from growing tall in the first place. Skipping either one still works correctly, it just loses the performance guarantee.

## 4. Example

A `DSU` class with `find` (path compression) and `union` (union-by-rank), tracing the parent array through a sequence of union operations on 6 nodes, plus a separate demonstration of path compression flattening a deliberately skewed chain.

```python
class DSU:
    def __init__(self, n):
        self.parent = list(range(n))   # each node starts as its own root
        self.rank = [0] * n            # rank = rough upper bound on tree height

    def find(self, x):
        if self.parent[x] != x:
            print(f"    find({x}): {x}'s parent is {self.parent[x]}, recursing...")
            self.parent[x] = self.find(self.parent[x])  # path compression
        return self.parent[x]

    def union(self, a, b):
        root_a = self.find(a)
        root_b = self.find(b)
        if root_a == root_b:
            print(f"  union({a}, {b}): already in the same set (root {root_a}), no-op")
            return
        # union by rank: attach smaller-rank tree under larger-rank tree
        if self.rank[root_a] < self.rank[root_b]:
            root_a, root_b = root_b, root_a
        self.parent[root_b] = root_a
        if self.rank[root_a] == self.rank[root_b]:
            self.rank[root_a] += 1
        print(f"  union({a}, {b}): attach root {root_b} under root {root_a}")
        print(f"  parent array now: {self.parent}")


dsu = DSU(6)  # nodes 0..5
print("Initial parent array:", dsu.parent)

operations = [(0, 1), (2, 3), (0, 2), (4, 5), (0, 4), (1, 3)]
for a, b in operations:
    print(f"\nunion({a}, {b}):")
    dsu.union(a, b)

print("\nFinal parent array:", dsu.parent)
print("Final rank array:", dsu.rank)

print("\nConnectivity checks:")
for a, b in [(0, 5), (1, 4), (2, 5), (3, 3)]:
    connected = dsu.find(a) == dsu.find(b)
    print(f"  connected({a}, {b}) = {connected}")

print("\n--- Path compression demonstration on a skewed chain ---")
dsu2 = DSU(5)
# Manually build a skewed chain 4 -> 3 -> 2 -> 1 -> 0 (no union-by-rank used here)
dsu2.parent = [0, 0, 1, 2, 3]
print("Chain before find:", dsu2.parent)
root = dsu2.find(4)
print("find(4) result:", root)
print("Chain after find (flattened by path compression):", dsu2.parent)
```

Executed output:

```
Initial parent array: [0, 1, 2, 3, 4, 5]

union(0, 1):
  union(0, 1): attach root 1 under root 0
  parent array now: [0, 0, 2, 3, 4, 5]

union(2, 3):
  union(2, 3): attach root 3 under root 2
  parent array now: [0, 0, 2, 2, 4, 5]

union(0, 2):
  union(0, 2): attach root 2 under root 0
  parent array now: [0, 0, 0, 2, 4, 5]

union(4, 5):
  union(4, 5): attach root 5 under root 4
  parent array now: [0, 0, 0, 2, 4, 4]

union(0, 4):
  union(0, 4): attach root 4 under root 0
  parent array now: [0, 0, 0, 2, 0, 4]

union(1, 3):
    find(1): 1's parent is 0, recursing...
    find(3): 3's parent is 2, recursing...
    find(2): 2's parent is 0, recursing...
  union(1, 3): already in the same set (root 0), no-op

Final parent array: [0, 0, 0, 0, 0, 4]
Final rank array: [2, 0, 1, 0, 1, 0]

Connectivity checks:
    find(5): 5's parent is 4, recursing...
    find(4): 4's parent is 0, recursing...
  connected(0, 5) = True
    find(1): 1's parent is 0, recursing...
    find(4): 4's parent is 0, recursing...
  connected(1, 4) = True
    find(2): 2's parent is 0, recursing...
    find(5): 5's parent is 0, recursing...
  connected(2, 5) = True
    find(3): 3's parent is 0, recursing...
    find(3): 3's parent is 0, recursing...
  connected(3, 3) = True

--- Path compression demonstration on a skewed chain ---
Chain before find: [0, 0, 1, 2, 3]
    find(4): 4's parent is 3, recursing...
    find(3): 3's parent is 2, recursing...
    find(2): 2's parent is 1, recursing...
    find(1): 1's parent is 0, recursing...
find(4) result: 0
Chain after find (flattened by path compression): [0, 0, 0, 0, 0]
```

Watch `union(1, 3)` closely — by that point 1 and 3 are already both connected transitively through 0 (via the earlier unions), so `find(1)` and `find(3)` both resolve to root 0, and the union correctly becomes a no-op instead of creating a cycle in the parent structure. The path-compression demo makes the payoff concrete: before the `find(4)` call, node 4 is 4 hops from its root (`4→3→2→1→0`); after the single `find(4)` call, every node touched along that walk — 4, 3, 2, 1 — points **directly** at root 0, so any future `find` on any of them is now an instant O(1) lookup.

## 5. Compare

Union-Find answers "same component?" and "merge these two components" in near-O(1) amortized time once both optimizations are in place — dramatically faster than re-running BFS/DFS from scratch after every new edge, which costs O(V + E) per check. The trade-off is that Union-Find only tracks group membership; it cannot tell you the shortest path between two nodes, cannot list a component's members without a separate O(n) scan, and cannot easily *undo* a union (splitting a group back apart is not a supported operation — Union-Find is fundamentally a "merge-only" structure). Compared to BFS/DFS-based connected-components detection (which recomputes everything from a static snapshot), Union-Find shines specifically when edges/connections arrive incrementally over time and you need up-to-date connectivity answers after each one — this is exactly the situation in Kruskal's minimum-spanning-tree algorithm (the next phase), which processes edges one at a time and uses Union-Find to check "would this edge connect two already-connected components" before deciding to keep it.

## 6. Common Mistakes

- **Implementing `find` without path compression.** It still returns the correct root, but on a chain of unions that happens to build a long, skewed tree, each `find` call degrades toward O(n) — correctness survives, performance quietly collapses.
- **Implementing `union` without rank (or size) tracking**, and instead always attaching, say, the second argument's root under the first's regardless of tree height. This loses the balancing guarantee — repeated unions in an adversarial order can still build tall, skewed trees even though path compression is present, because compression only helps *after* a `find` walks the bad chain once.
- **Forgetting to call `find` on both elements before comparing them in `union`** — comparing `a` and `b` directly instead of their *roots* will almost always incorrectly conclude they're in different sets, since `a` and `b` are original element labels, not group representatives.
- **Off-by-one on self-parenting as the base case.** The base case for "this is a root" is `parent[x] == x`; miswriting it (or forgetting to initialize `parent[i] = i` for every element) breaks `find` immediately, often as infinite recursion.

## 7. Interview Angle

Union-Find rarely appears standalone — it shows up as the enabling structure inside a bigger problem: "number of connected components," "redundant connection" (find the one edge that creates a cycle), "accounts merge" (merge accounts sharing an email), and — critically — Kruskal's MST algorithm, which the next phase builds directly on top of this lesson. Interviewers expect the two-optimization pitch by name — path compression and union-by-rank/size — and a clear statement of the near-O(1) amortized complexity (technically O(α(n)), practically constant). A common follow-up: "how do you count the number of distinct components at any point?" — track a running counter that decrements by 1 every time a `union` call actually merges two *different* roots (not on a no-op union of already-same-root elements).

## 8. Memory Hook

**"Path compression flattens on the way up; union-by-rank keeps it flat on the way down."** `find` walks to the root and rewires everyone it passed to point straight there. `union` always attaches the shorter tree under the taller one — never the reverse. Together: near-O(1). Apart: still correct, just slow.
