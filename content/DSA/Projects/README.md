# DSA Projects — Multi-Pattern Combined Problems

Every phase so far (01–14) has isolated one technique at a time: hashing on its own, BFS on its own, backtracking on its own. Real interview problems almost never arrive that clean. A problem statement doesn't announce "this is a heap question" — it presents a scenario, and the first skill it tests is recognizing that the clean answer actually needs *two or more* techniques working together, each covering a piece the other can't.

This folder is the bridge between "I know Phase 5 and Phase 8 individually" and "I can combine them under interview pressure." Each project below takes a well-known interview problem, names the exact patterns it fuses, and walks through why neither pattern alone is sufficient — one gives you the data structure, the other gives you the algorithm, and the combination is what makes the O(1)/O(V+E)/O(n log n) bound achievable at all.

## How to Use This Folder

Attempt each project only after you've completed the phases it draws from — the table below lists them. Read the `## Problem Statement` first and try to solve it cold before reading `## Approach Discussion`. The discussion explains *why* the combination is necessary (not just that it exists), the `## Solution` section has full, executed Python code, and `## Complexity` closes out the time/space bound with the reasoning behind it.

## Projects

| File | Patterns Combined | Phases |
|---|---|---|
| [`01-LRU-Cache.md`](01-LRU-Cache.md) | Hashing + Doubly Linked List | Phases 3, 5 |
| [`02-Course-Schedule.md`](02-Course-Schedule.md) | Graph BFS/DFS + Topological Sort | Phase 8 |
| [`03-Word-Ladder.md`](03-Word-Ladder.md) | BFS + Hashing | Phases 5, 8 |
| [`04-Meeting-Rooms-II.md`](04-Meeting-Rooms-II.md) | Greedy + Heap | Phases 7, 10 |
| [`05-Word-Search-II.md`](05-Word-Search-II.md) | Trie + Backtracking | Phases 10, 12 |

## Why This Matters for Interviews

Interviewers deliberately pick problems like these because a candidate who only knows patterns in isolation will reach for one of them, get partway to a working solution, and then get stuck when it can't hit the required time complexity alone. Recognizing "I need a hashmap for O(1) lookup *and* a linked list for O(1) reordering" — not one or the other — is exactly the kind of synthesis these five projects are built to drill.
