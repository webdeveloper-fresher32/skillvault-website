# Pattern Recognition Guide

A dense lookup table: problem clue → technique → where it's taught. Scan the left column for the shape of whatever problem you're facing, then jump to the matching phase lesson.

This is a quick-reference index, not the reasoning framework itself — for the full three-step process of extracting clues, mapping them to candidates, and verifying the fit before committing to code, see `DSA/Phase-14-Interview-Strategy/01-Pattern-Recognition-Framework.md`.

| Problem Clue/Shape | Technique | Phase Reference |
|---|---|---|
| Sorted array + find a pair/triplet summing to a target | Two Pointers | Phase 2 |
| Contiguous subarray/substring + a size or sum constraint that grows/shrinks monotonically | Sliding Window | Phase 2 |
| Repeated range-sum queries over a fixed, unchanging array | Prefix Sums | Phase 2 |
| "Maximum subarray sum" with no window size given | Kadane's Algorithm | Phase 2 |
| Rearranging an array in place with O(1) extra space (partition, dedupe, move zeros) | In-Place Two/Read-Write Pointers | Phase 2 |
| Linked list — "find the middle node" | Fast-Slow Pointers | Phase 3 |
| Linked list — "does it contain a cycle" / "find the cycle start" | Floyd's Cycle Detection | Phase 3 |
| Linked list — "reverse this list" or "reverse in groups of k" | Reversal Patterns | Phase 3 |
| Merging two or more already-sorted linked lists | Merge Patterns | Phase 3 |
| "Next greater/smaller element" or "maintain increasing/decreasing order while scanning" | Monotonic Stack | Phase 4 |
| Matching/validating nested structure (parentheses, tags, undo history) | Stack (LIFO) | Phase 4 |
| Sliding-window maximum/minimum over an array | Monotonic Deque | Phase 4 |
| "Track the minimum/maximum seen so far" alongside normal stack operations | Min-Stack (auxiliary structure) | Phase 4 |
| Counting frequencies, checking existence in O(1), grouping by a derived key | Hash Map / Set | Phase 5 |
| Two elements summing/XORing/differing to a target, single pass | Hash Map (complement lookup) | Phase 5 |
| Detecting duplicates or anagrams via character/element counts | Frequency Counting | Phase 5 |
| Tree — "process every node," ordering not important | DFS Traversal (pre/in/postorder) | Phase 6 |
| Tree — "process level by level" or "find the widest level" | BFS / Level-Order Traversal | Phase 6 |
| Tree — "is this a valid BST," or ordered insert/search/delete needed | BST Operations | Phase 6 |
| Tree keeps degenerating into a line under sorted insertions | Self-Balancing Tree (AVL / Red-Black) | Phase 6 |
| "Lowest common ancestor of two nodes" | LCA (BST iterative or general-tree recursive) | Phase 6 |
| "Kth largest/smallest," "top K," "K closest points" | Heap (size-capped min/max-heap) | Phase 7 |
| Merging K sorted lists/streams efficiently | Heap-Based K-Way Merge | Phase 7 |
| Need repeated access to the current min/max while the set changes | Binary Heap | Phase 7 |
| Sorting with a guaranteed O(n log n) worst case and O(1) extra space | Heap Sort | Phase 7 |
| Graph given as a grid, adjacency list, or edge list — need to represent it first | Graph Representation (adjacency list vs matrix) | Phase 8 |
| "Shortest path" / "minimum steps" in an unweighted graph or grid | BFS | Phase 8 |
| "Does a path exist," "explore all connected nodes," maze/backtrack-style graph traversal | DFS | Phase 8 |
| "Order of tasks given dependencies," "can this finish given prerequisites" | Topological Sort (Kahn's or DFS-based) | Phase 8 |
| "Are these two nodes connected," "count groups/islands," merge sets over time | Union-Find (DSU) | Phase 8 |
| "Does this graph contain a cycle" (directed or undirected) | Cycle Detection (3-color for directed, parent-track for undirected) | Phase 8 |
| Shortest path, weighted, all edges non-negative | Dijkstra's Algorithm | Phase 9 |
| Shortest path, weighted, negative edges allowed (or need to detect negative cycles) | Bellman-Ford Algorithm | Phase 9 |
| Shortest path between every pair of nodes (all-pairs) | Floyd-Warshall Algorithm | Phase 9 |
| Minimum spanning tree, dense graph or need incremental growth from a start node | Prim's Algorithm | Phase 9 |
| Minimum spanning tree, sparse graph or edges already available as a list | Kruskal's Algorithm | Phase 9 |
| "Maximize/minimize non-overlapping choices" where a locally greedy pick is provably optimal (e.g. interval scheduling) | Greedy (Interval Scheduling) | Phase 10 |
| Generate all subsets, permutations, or combinations of a set | Backtracking (Subsets/Permutations/Combinations) | Phase 10 |
| "Place items under constraints and explore every valid arrangement" (N-Queens, Sudoku) | Backtracking with Constraint Pruning | Phase 10 |
| "Count the number of ways" or "min/max value achievable" with choices whose subproblems overlap | Dynamic Programming (general signal) | Phase 11 |
| 1D sequence, each state depends only on a fixed number of previous states (climbing stairs, house robber) | 1D DP | Phase 11 |
| Grid — "min/max path sum," "count paths," moves restricted to right/down (or similar) | 2D Grid DP | Phase 11 |
| "Choose a subset of items with weight/capacity limit to maximize value" | Knapsack DP (0/1 or unbounded) | Phase 11 |
| Comparing two sequences for the longest shared/increasing pattern | LCS / LIS DP | Phase 11 |
| DP defined over subtrees or nodes rather than array indices (max path sum in a tree, etc.) | DP on Trees/Graphs | Phase 11 |
| DP table has more dimensions than needed — memory limit exceeded | State Space Reduction (rolling array/dimension dropping) | Phase 11 |
| Autocomplete, prefix search over a large dictionary of strings | Trie | Phase 12 |
| Repeated range updates AND range queries on a mutable array | Segment Tree | Phase 12 |
| Repeated prefix-sum/range-sum queries with point updates, simpler than segment tree suffices | Fenwick Tree (BIT) | Phase 12 |
| Range query (min/max/gcd) on a static array that never changes | Sparse Table | Phase 12 |
| Manipulating individual bits, counting set bits, checking power of two | Bit Manipulation Basics | Phase 13 |
| Small N (≤ ~20) where a subset of items/cities is the natural DP state | Bitmask DP | Phase 13 |
| Computing GCD/LCM, or need all primes up to N efficiently | Euclidean Algorithm / Sieve of Eratosthenes | Phase 13 |
| Large exponent computation "mod m" (cryptography-style, huge numbers) | Fast Exponentiation / Modular Arithmetic | Phase 13 |
| Problem statement gives no obvious data-structure clue at all — need a systematic way to shortlist candidates | Pattern Recognition Framework | Phase 14 |

---

**See also:** `DSA/Quick-Reference/Cheatsheet.md` for complexity tables and code skeletons, and `DSA/Quick-Reference/Interview-QA.md` for 50 explained interview questions across every phase.
