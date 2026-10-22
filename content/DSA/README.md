# DSA (Data Structures & Algorithms) — Complete Interview Prep Course

A self-contained, Python-first Data Structures & Algorithms course built for technical interview prep. It starts from complexity foundations (Big-O, recursion, recurrence relations) and works up through arrays, linked lists, trees, graphs, greedy/backtracking, dynamic programming, advanced data structures, and bit manipulation/number theory — the full range of what shows up in coding interview rounds, up to competitive-programming-level topics (segment trees, Fenwick trees, bitmask DP). Every lesson uses Python throughout, with worked examples, complexity analysis, and interview framing baked in.

This course does not assume prior DSA exposure — Phase-01 builds the complexity vocabulary (Big-O/Big-Theta/Big-Omega, recursion, recurrence relations, the math you need) from scratch — but it does move quickly into the pattern-based approach (two pointers, sliding window, fast/slow pointers, monotonic stack, etc.) that interviews actually test.

---

## Course Structure

```
DSA/
├── Phase-01-Complexity-and-Foundations/          → Big-O/Theta/Omega, recurrences, Master Theorem, math prerequisites, + Top 15 Interview Problems
├── Phase-02-Arrays-and-Strings/                   → Two pointers, sliding window, prefix sums, Kadane's, + Top 30 Array & Top 30 String Problems
├── Phase-03-Linked-Lists/                         → Singly/doubly lists, fast-slow pointers, Floyd's cycle, reversals, + Top 15 Interview Problems
├── Phase-04-Stacks-and-Queues/                    → Monotonic stacks, min stack, deques, sliding window max, + Top 15 Interview Problems
├── Phase-05-Hashing/                              → Hash maps & sets, LRU & LFU cache design, modulo prefix hashing, + Top 15 Interview Problems
├── Phase-06-Trees-and-BST/                        → Traversals, BST invariants, LCA, diameter, path sum, serialization, + Top 16 Interview Problems
├── Phase-07-Heaps-and-Priority-Queues/             → Heapify, top-K patterns, dual-heap streaming medians, K-way merges, + Top 15 Interview Problems
├── Phase-08-Graphs-Traversal/                      → Graph representations, BFS & DFS, topological sort, union-find (DSU), cycle detection in graphs
├── Phase-09-Graphs-Shortest-Path-and-MST/          → Dijkstra's, Bellman-Ford, Floyd-Warshall, Prim's, Kruskal's
├── Phase-10-Greedy-and-Backtracking/               → Interval scheduling & activity selection, backtracking fundamentals (N-Queens), subsets/permutations/combinations, Sudoku-style backtracking
├── Phase-11-Dynamic-Programming/                   → DP fundamentals & 1D DP, 2D DP & grid problems, knapsack variants, LCS & LIS, DP on trees/graphs, state space reduction
├── Phase-12-Advanced-Data-Structures/              → Trie, segment tree, Fenwick tree (BIT), sparse table
├── Phase-13-Bit-Manipulation-and-Number-Theory/    → Bit manipulation basics, bitmask DP, GCD/LCM & Sieve of Eratosthenes, modular arithmetic & fast exponentiation
├── Phase-14-Interview-Strategy/                    → Pattern recognition framework, mock interview approach, time management & problem approach
├── Projects/                                       → 5 end-to-end problems combining multiple patterns (LRU Cache, Course Schedule, Word Ladder, Meeting Rooms II, Word Search II)
└── Quick-Reference/                                → Cheatsheet, 50 Interview Q&A, Pattern Recognition Guide
```

**Note on structure:** unlike the other courses in this repo, phase directories here contain numbered lesson files only — there is no per-phase `README.md`. This is a deliberate exception for the DSA course; use the tree above and the Learning Path table below to navigate, and start directly at the first lesson file linked below.

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Complexity and Foundations | Easy-Medium | 3 days |
| 02 | Arrays and Strings | Easy-Medium | 4 days |
| 03 | Linked Lists | Easy-Medium | 3 days |
| 04 | Stacks and Queues | Easy-Medium | 3 days |
| 05 | Hashing | Easy-Medium | 2 days |
| 06 | Trees and BST | Medium | 4 days |
| 07 | Heaps and Priority Queues | Medium | 3 days |
| 08 | Graphs: Traversal | Medium | 4 days |
| 09 | Graphs: Shortest Path and MST | Medium | 4 days |
| 10 | Greedy and Backtracking | Medium-Hard | 4 days |
| 11 | Dynamic Programming | Medium-Hard | 6 days |
| 12 | Advanced Data Structures | Medium-Hard | 4 days |
| 13 | Bit Manipulation and Number Theory | Medium-Hard | 3 days |
| 14 | Interview Strategy | n/a (strategy) | 2 days |
| Projects | 5 end-to-end combined-pattern problems | Medium-Hard | 3 days |

**Total estimated time: ~7-8 weeks** at a steady, non-rushed pace.

---

## How to Use This Course

1. Work through Phases 01-13 in order — later phases assume the patterns and complexity vocabulary from earlier ones (e.g. graph shortest-path algorithms in Phase-09 assume BFS/DFS from Phase-08; DP in Phase-11 assumes recursion from Phase-01).
2. Read Phase-14 (Interview Strategy) once you've covered most of the patterns — it ties the pattern-recognition framework together and covers mock-interview approach and time management.
3. Work through `Projects/` after finishing the phases — each project combines multiple patterns end-to-end, closer to a real interview problem.
4. Use `Quick-Reference/Cheatsheet.md` and `Quick-Reference/Pattern-Recognition-Guide.md` for rapid pattern-matching review, and `Quick-Reference/Interview-QA.md` for rapid-fire drilling before interviews.

## Prerequisites

- Basic Python syntax (variables, functions, loops, conditionals, lists/dicts) — no prior DSA or algorithms knowledge required. Phase-01 builds the complexity and math foundations from scratch.

---

Start here: [Phase-01-Complexity-and-Foundations/01-Big-O-Big-Theta-Big-Omega.md](Phase-01-Complexity-and-Foundations/01-Big-O-Big-Theta-Big-Omega.md)
