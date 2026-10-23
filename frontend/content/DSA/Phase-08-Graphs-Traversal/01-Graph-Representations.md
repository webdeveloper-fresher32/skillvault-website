# Graph Representations

## 1. Problem

A tree only ever lets a node have one parent, and you always start from a single root. Real-world relationships are messier than that: a city can be reached from many other cities, a person can follow (and be followed by) many other people, a task can depend on several other tasks and be depended on by several more. You need a structure that can represent **arbitrary pairwise connections** between elements — no single root, no restriction on how many neighbors a node can have, and connections that may or may not have a direction or a cost attached.

That structure is a **graph**: a set of nodes (vertices) plus a set of connections (edges) between pairs of them. But "a set of edges" is an abstract idea — before you can run any algorithm on a graph, you have to pick a concrete way to *store* it in memory. That choice is not cosmetic. It changes the time complexity of the single most common operation — "does an edge exist between these two nodes?" — and it changes how much memory you burn on graphs that barely have any edges at all. Picking the wrong representation for the shape of your graph is a common source of "technically correct, but way too slow / way too much memory" solutions.

## 2. Analogy

Think about how you'd track "who follows whom" on a social network with a billion users, versus how you'd track "which of these 5 cities have a direct flight between them."

For the social network, most people follow only a few hundred others out of a billion possible people — the vast majority of "could this pair be connected?" questions are trivially no. Writing that down as a giant billion-by-billion grid of yes/no checkboxes would be absurd — almost the entire grid is empty, and you'd need more memory than exists on the planet. Instead you keep, for each person, a short list of who they follow. That's an **adjacency list** — you only pay for connections that actually exist.

For the 5 cities, the numbers are small enough that a flight-connectivity chart — a 5×5 grid of yes/no boxes, one row and one column per city — is not just feasible but genuinely handy: "does Delhi connect to Mumbai?" is one instant look-up at row Delhi, column Mumbai, no scanning required. That's an **adjacency matrix** — a fixed grid that trades memory for instant edge lookups, and it stays cheap only because the number of cities (and therefore the grid) is small.

## 3. Internal Flow

**Adjacency list — a dictionary (or array) of lists.** Each node maps to a list of the nodes it has a direct edge to. Space used is proportional to `V + E` (vertices plus edges) — you only store connections that exist. Checking "is there an edge from A to B" means scanning A's list for B, which costs O(degree of A) in the worst case — for a sparse graph (few edges relative to nodes), that degree is typically small, so this is fast in practice, but it is not O(1) in the worst case. Iterating "all of A's neighbors" — the operation graph traversal algorithms do constantly — is the natural, cheap thing an adjacency list gives you directly.

**Adjacency matrix — a 2D array of size V×V.** `matrix[i][j] = 1` (or the edge weight) if there's an edge from node i to node j, else 0. Space used is always O(V²), *regardless of how many edges actually exist* — a graph with only 10 edges among 10,000 nodes still allocates a 10,000×10,000 grid. In exchange, checking "is there an edge from A to B" is a single array index, O(1), no scanning. That trade only pays off when the graph is **dense** (edges close to O(V²)) or when V is small enough that V² memory is a non-issue and O(1) lookups matter a lot.

**Directed vs undirected.** A directed edge A→B means you can go from A to B, but not necessarily back — represented in an adjacency list by adding B only to A's list, and in a matrix by setting `matrix[A][B] = 1` without necessarily setting `matrix[B][A] = 1`. An undirected edge means the connection works both ways — represented in an adjacency list by adding B to A's list **and** A to B's list (two separate list insertions for one logical edge), and in a matrix by setting both `matrix[A][B]` and `matrix[B][A]` to 1 (an undirected graph's matrix is always symmetric across the diagonal).

**Weighted vs unweighted.** An unweighted graph only cares whether an edge exists — the adjacency list stores plain neighbor names, the matrix stores 0/1. A weighted graph attaches a cost to each edge (distance, price, capacity) — the adjacency list stores `(neighbor, weight)` pairs instead of bare neighbors, and the matrix stores the weight itself in place of 1 (with some sentinel like 0, `None`, or infinity meaning "no edge," since 0 could otherwise be confused with a real zero-weight edge).

## 4. Example

The same small directed, unweighted graph — A→B, A→C, B→D, C→D — built as both an adjacency list and an adjacency matrix, followed by an edge-lookup check in both, then the undirected and weighted variants of the same idea.

```python
from collections import defaultdict

# Same small directed, unweighted graph in both representations
# Nodes: A, B, C, D
# Edges: A->B, A->C, B->D, C->D

nodes = ["A", "B", "C", "D"]
edges = [("A", "B"), ("A", "C"), ("B", "D"), ("C", "D")]

# --- Adjacency list ---
adj_list = defaultdict(list)
for u, v in edges:
    adj_list[u].append(v)

print("Adjacency list:")
for n in nodes:
    print(f"  {n}: {adj_list[n]}")

# --- Adjacency matrix ---
index = {n: i for i, n in enumerate(nodes)}
n = len(nodes)
adj_matrix = [[0] * n for _ in range(n)]
for u, v in edges:
    adj_matrix[index[u]][index[v]] = 1

print("\nAdjacency matrix:")
print("    " + "  ".join(nodes))
for i, row in enumerate(adj_matrix):
    print(f"  {nodes[i]} {row}")

# --- Edge lookup: is there an edge from A to B? ---
def has_edge_list(u, v):
    return v in adj_list[u]

def has_edge_matrix(u, v):
    return adj_matrix[index[u]][index[v]] == 1

print("\nEdge lookup checks:")
for u, v in [("A", "B"), ("B", "A"), ("C", "D"), ("D", "A")]:
    print(f"  has_edge({u},{v}) list={has_edge_list(u,v)}  matrix={has_edge_matrix(u,v)}")

print("\n--- Undirected version (same edges, no direction) ---")
undirected_adj_list = defaultdict(list)
for u, v in edges:
    undirected_adj_list[u].append(v)
    undirected_adj_list[v].append(u)  # must add both directions

print("Undirected adjacency list:")
for node in nodes:
    print(f"  {node}: {undirected_adj_list[node]}")

print("\n--- Weighted version (adjacency list of (neighbor, weight) tuples) ---")
weighted_edges = [("A", "B", 4), ("A", "C", 1), ("B", "D", 2), ("C", "D", 6)]
weighted_adj_list = defaultdict(list)
for u, v, w in weighted_edges:
    weighted_adj_list[u].append((v, w))

print("Weighted adjacency list:")
for node in nodes:
    print(f"  {node}: {weighted_adj_list[node]}")
```

Executed output:

```
Adjacency list:
  A: ['B', 'C']
  B: ['D']
  C: ['D']
  D: []

Adjacency matrix:
    A  B  C  D
  A [0, 1, 1, 0]
  B [0, 0, 0, 1]
  C [0, 0, 0, 1]
  D [0, 0, 0, 0]

Edge lookup checks:
  has_edge(A,B) list=True  matrix=True
  has_edge(B,A) list=False  matrix=False
  has_edge(C,D) list=True  matrix=True
  has_edge(D,A) list=False  matrix=False

--- Undirected version (same edges, no direction) ---
Undirected adjacency list:
  A: ['B', 'C']
  B: ['A', 'D']
  C: ['A', 'D']
  D: ['B', 'C']

--- Weighted version (adjacency list of (neighbor, weight) tuples) ---
Weighted adjacency list:
  A: [('B', 4), ('C', 1)]
  B: [('D', 2)]
  C: [('D', 6)]
  D: []
```

Both representations agree perfectly on every edge check — `A→B` exists, `B→A` does not (this is a directed graph, so the reverse direction is not implied). Notice how the undirected version required *two* list insertions per logical edge (`B` appended to `A`'s list, and `A` appended to `B`'s list) — a single edge `(A, B)` shows up in both `A`'s and `B`'s adjacency lists, unlike the directed case where it only shows up in `A`'s.

## 5. Compare

An adjacency list costs O(V + E) space and is the right default for **sparse** graphs (E much smaller than V²) — most real-world graphs (social networks, road networks, dependency graphs) are sparse, so this is the representation you reach for by default. An adjacency matrix costs a fixed O(V²) space regardless of how many edges actually exist, but repays that cost with O(1) edge-existence checks and is the natural fit for **dense** graphs or algorithms (like some dynamic-programming graph algorithms, or Floyd-Warshall for all-pairs shortest paths) that need to ask "is there an edge here" repeatedly across all pairs. As a rule of thumb: if V is in the thousands or more and the graph isn't near-complete, an adjacency matrix will waste enormous memory for almost no payoff — reach for a list instead.

## 6. Common Mistakes

- **Using an adjacency matrix for a large, sparse graph.** A graph with 100,000 nodes and only 200,000 edges (very sparse) would need a 100,000×100,000 matrix — 10 billion cells — to represent a graph an adjacency list would store in roughly 300,000 entries. This is the single most common representation mistake: reaching for O(1) lookups without checking whether O(V²) memory is actually affordable.
- **Forgetting to add the edge in both directions for an undirected graph in an adjacency list.** Adding `B` to `A`'s list but forgetting to add `A` to `B`'s list silently turns an undirected edge into a one-way directed edge — traversals starting from `B` will never discover the connection to `A`, even though the graph was meant to be undirected.
- **Confusing "no edge" with "zero-weight edge" in a weighted adjacency matrix.** If the matrix stores raw weights and uses `0` to mean "no edge," a genuinely zero-cost edge becomes indistinguishable from the absence of an edge. Use `None`, `float('inf')`, or a separate boolean matrix instead.
- **Storing self-loops or duplicate edges without deciding whether they're meaningful** — an adjacency list will happily let you append the same neighbor twice, silently changing the degree of a node and potentially double-processing an edge during traversal.

## 7. Interview Angle

Interviewers expect you to justify the representation choice out loud before writing a single line of graph code — "the input is up to 10^5 nodes with a small number of edges, so I'll use an adjacency list" is the kind of sentence that signals you understand the trade-off rather than defaulting to whatever you memorized. Be ready to convert between representations on demand (some problems hand you an edge list or a matrix and expect you to build an adjacency list yourself before running BFS/DFS), and know the space complexity of each cold: O(V + E) for a list, O(V²) for a matrix. A very common follow-up: "how would you check if this undirected graph is complete?" — the matrix representation answers that almost by inspection (every off-diagonal cell is 1).

## 8. Memory Hook

**"List for sparse, matrix for dense — and O(1) lookup always costs O(V²) memory."** An adjacency list only pays for edges that exist; an adjacency matrix pays for every possible pair whether or not the edge exists, in exchange for instant lookups. Undirected means **write the edge twice** (once per direction) in a list, or keep the matrix symmetric. Weighted means **store the number, not just the yes/no**.
