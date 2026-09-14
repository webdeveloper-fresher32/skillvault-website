# DSA Course — Design Spec

Date: 2026-07-29

## Purpose

Add a new SkillVault course, `DSA/`, covering Data Structures and Algorithms from foundational complexity analysis through core interview-standard DSA into competitive-programming-level advanced topics. This is a distinct Markdown-based conceptual course — it does not replace or depend on the separate `DSA-prep` repo (`/Users/ganeshpirikirala/Desktop/DSA-prep`), which remains a standalone Python practice-problem repo. No cross-linking between the two is required.

## Scope

14 phases (extends past the usual 12 to cover the competitive-programming depth requested):

- Phases 1–7: foundations and core linear/non-linear data structures
- Phases 8–9: graphs
- Phases 10–11: algorithmic techniques (greedy, backtracking, DP)
- Phases 12–13: advanced/competitive-programming topics
- Phase 14: interview strategy (mirrors LLD's Phase-12 capstone)

## Course Structure

```
DSA/
├── Phase-01-Complexity-and-Foundations/
├── Phase-02-Arrays-and-Strings/
├── Phase-03-Linked-Lists/
├── Phase-04-Stacks-and-Queues/
├── Phase-05-Hashing/
├── Phase-06-Trees-and-BST/
├── Phase-07-Heaps-and-Priority-Queues/
├── Phase-08-Graphs-Traversal/
├── Phase-09-Graphs-Shortest-Path-and-MST/
├── Phase-10-Greedy-and-Backtracking/
├── Phase-11-Dynamic-Programming/
├── Phase-12-Advanced-Data-Structures/
├── Phase-13-Bit-Manipulation-and-Number-Theory/
├── Phase-14-Interview-Strategy/
├── Projects/
├── Quick-Reference/
└── README.md
```

**Deviation from CLAUDE.md convention (explicit, user-confirmed):** phase directories do NOT get their own `README.md`. Each phase directory contains only zero-padded numbered lesson files (`01-Topic.md`, `02-Topic.md`, ...). This is a deliberate exception for this course only; other courses keep their per-phase READMEs.

## Phase Topic Breakdown

1. **Complexity and Foundations** — Big-O/Big-Theta/Big-Omega, time/space complexity analysis, recursion basics, recurrence relations, math prerequisites for DSA
2. **Arrays and Strings** — two pointers, sliding window, prefix sums, in-place manipulation, Kadane's algorithm
3. **Linked Lists** — singly/doubly linked lists, fast-slow pointers, reversal, cycle detection (Floyd's), merge patterns
4. **Stacks and Queues** — array/linked-list based implementations, monotonic stack, deque, min-stack
5. **Hashing** — hash maps/sets, collision handling strategies, frequency-counting patterns, hashing-based two-sum-style problems
6. **Trees and BST** — traversals (pre/in/post/level-order), BST operations, balanced tree concepts (AVL/Red-Black at a conceptual level), LCA
7. **Heaps and Priority Queues** — min/max heap operations, heapify, heap sort, top-K patterns, merge-K-lists
8. **Graphs Traversal** — graph representations (adjacency list/matrix), BFS, DFS, topological sort, Union-Find/DSU, cycle detection
9. **Graphs Shortest Path and MST** — Dijkstra, Bellman-Ford, Floyd-Warshall, Prim's, Kruskal's
10. **Greedy and Backtracking** — interval scheduling, activity selection, N-Queens, subsets/permutations/combinations, Sudoku-style backtracking
11. **Dynamic Programming** — 1D/2D DP, knapsack variants, LCS/LIS, DP on grids, DP on trees/graphs, state-space reduction
12. **Advanced Data Structures** — Trie, Segment Tree (with range queries), Fenwick Tree/BIT, Sparse Table
13. **Bit Manipulation and Number Theory** — bitmasking, bitmask DP, GCD/LCM, sieve of Eratosthenes, modular arithmetic, fast exponentiation
14. **Interview Strategy** — pattern-recognition framework (given a problem shape, which technique to reach for), mock-interview approach, time management, how to approach unseen problems

## Lesson Format

Every lesson file follows the user's established spoon-fed style (per prior course-rewrite work), not a definitions-first textbook style:

1. **Problem** — the real-world or interview scenario that motivates the topic
2. **Analogy** — an intuitive, non-technical comparison
3. **Internal flow** — how the data structure/algorithm actually works step by step
4. **Example** — a fully worked example, with Python code
5. **Compare** — how this relates to or differs from adjacent topics/techniques
6. **Common mistakes** — pitfalls interviewees/learners typically hit
7. **Interview angle** — how this shows up in interviews, common follow-up questions
8. **Memory hook** — a short mnemonic or takeaway for recall

Code examples are in Python throughout, for consistency with the LLD course and DSA-prep.

## Projects/ Folder

End-to-end problems that combine multiple patterns from different phases (e.g., a problem requiring both hashing and sliding window, or graph + DP). Numbered `.md` files, following the same convention as LLD/HLD Projects folders (problem statement, approach discussion, solution walkthrough).

## Quick-Reference/ Folder

- `Cheatsheet.md` — dense reference of complexity classes, data structure operation costs, and algorithm templates across all phases.
- `Interview-QA.md` — 50 interview questions with answers, matching the convention used in other courses.
- `Pattern-Recognition-Guide.md` — a "given this problem shape, use this technique" lookup table/guide (e.g., "sorted array + target sum → two pointers," "shortest path unweighted → BFS"). This file is unique to this course; no other course's Quick-Reference has an equivalent, though it's in the same spirit as `DSA-prep/1_Learning_Resources/DSA_Pattern_Recognition.md` — written as original content for this course, not copied.

## Course-level README.md

Standard convention: course overview, what the course covers and why, Phase | Topic | Difficulty | Time learning path table (14 rows), link into Phase 1.

## Out of Scope

- No dependency on or migration of content from `DSA-prep` — that repo remains untouched and unreferenced.
- No per-phase `README.md` files (explicit deviation from CLAUDE.md, confirmed by user for this course only).
- Language design-pattern specific topics (already covered by the LLD course) are not duplicated here.

## Open Questions

None — all scoping decisions were made during brainstorming (relationship to DSA-prep, language choice, depth level, per-phase README exception).
