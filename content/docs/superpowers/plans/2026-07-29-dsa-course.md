# DSA Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete `DSA/` course in SkillVault — 14 phases (foundations through competitive-programming-level advanced topics), each with numbered lesson files only (no per-phase README, per explicit user decision); a `Projects/` folder of 5 multi-pattern combined problems; a `Quick-Reference/` folder (cheatsheet, 50 interview Q&A, pattern-recognition guide); and a course-level README.

**Architecture:** Pure-content repo (no build system, no tests, per `CLAUDE.md`). There is no TDD loop here — "verification" means checking each file's structure (required headings present, code blocks present, links resolve) rather than running a test suite. Each task produces one phase (or one top-level folder) fully populated and committed independently, so the course is buildable and reviewable phase-by-phase.

**Tech Stack:** GitHub-flavored Markdown with Python code blocks.

**Lesson format (applies to every lesson file in Phases 1–14):**
```markdown
# <Topic>

## 1. Problem
(the real-world or interview scenario that motivates this topic — 1-2 short paragraphs)

## 2. Analogy
(an intuitive, non-technical comparison that makes the mechanism click)

## 3. Internal Flow
(how the data structure/algorithm actually works, step by step — prose + a short numbered walkthrough)

## 4. Example
(a fully worked example with Python code in a fenced ```python block, plus the trace/output)

## 5. Compare
(how this relates to or differs from adjacent topics/techniques covered elsewhere in the course)

## 6. Common Mistakes
(3-5 concrete pitfalls learners/interviewees hit, as a bullet list)

## 7. Interview Angle
(how this shows up in interviews — typical framing, common follow-up questions/variations)

## 8. Memory Hook
(one short mnemonic or one-liner takeaway for recall)
```

Every lesson file must contain exactly these 8 `## ` headings, in this order, each populated (no empty sections). Code blocks use Python throughout.

---

### Task 1: Phase 01 — Complexity and Foundations

**Files:**
- Create: `DSA/Phase-01-Complexity-and-Foundations/01-Big-O-Big-Theta-Big-Omega.md`
- Create: `DSA/Phase-01-Complexity-and-Foundations/02-Time-and-Space-Complexity-Analysis.md`
- Create: `DSA/Phase-01-Complexity-and-Foundations/03-Recursion-Basics.md`
- Create: `DSA/Phase-01-Complexity-and-Foundations/04-Recurrence-Relations-and-Master-Theorem.md`
- Create: `DSA/Phase-01-Complexity-and-Foundations/05-Math-Prerequisites-for-DSA.md`

- [ ] **Step 1: Write the 5 lesson files**, each following the Lesson Format above exactly:
  - `01-Big-O-Big-Theta-Big-Omega.md`: what asymptotic notation communicates (worst/average/best case), formal definitions of O/Θ/Ω in plain language, the common complexity classes ordered (O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ) < O(n!)) with one canonical example algorithm per class. Example section: Python code for linear search (O(n)) vs binary search (O(log n)) on the same input, with an explicit line-count trace showing why one scales and the other doesn't. Common mistakes: confusing O (upper bound) with Θ (tight bound); dropping constants incorrectly when they matter for small n; assuming O(n log n) is always faster than O(n²) regardless of n's size.
  - `02-Time-and-Space-Complexity-Analysis.md`: how to derive complexity from code by counting loop nesting and recursive calls, auxiliary space vs input space, amortized analysis (why a dynamic array's `append` is O(1) amortized despite occasional O(n) resizes). Example: Python code for a dynamic-array-like `append` with manual resize doubling, tracing the amortized cost over a sequence of appends. Common mistakes: forgetting that recursive call stacks count as space; miscounting nested loops that don't run the full range (e.g. `for j in range(i)`, which is O(n²) total, not O(n) per call misread as O(n²) per call).
  - `03-Recursion-Basics.md`: base case + recursive case structure, the call stack model (each call is a frame with its own locals), how recursion trades code simplicity for stack space. Example: Python code for factorial and for computing Fibonacci naively (showing exponential blowup) with a printed call trace (using indentation per depth) so the reader sees the stack grow and shrink. Common mistakes: missing/wrong base case causing infinite recursion; recomputing overlapping subproblems (set up as the motivating pain point for Phase 11's memoization); off-by-one in the base case boundary.
  - `04-Recurrence-Relations-and-Master-Theorem.md`: writing a recurrence for a recursive algorithm (e.g. T(n) = 2T(n/2) + O(n) for merge sort), the three Master Theorem cases in plain-language form (compare f(n) to n^(log_b a)), when the Master Theorem doesn't apply (non-constant subproblem sizes, e.g. T(n) = T(n-1) + O(n)). Example: derive and solve the recurrence for merge sort (T(n) = 2T(n/2) + O(n) → O(n log n)) and for binary search (T(n) = T(n/2) + O(1) → O(log n)) side by side. Common mistakes: applying Master Theorem to recurrences with a non-constant number of subproblems; miscomparing f(n) against n^(log_b a) when they're asymptotically close (case 2 boundary).
  - `05-Math-Prerequisites-for-DSA.md`: logarithm rules used in complexity analysis (log(ab)=log a+log b, change of base), summation formulas (sum of first n integers, sum of a geometric series) used to derive complexities, basic combinatorics (nCr, nPr) needed for later backtracking/DP phases. Example: derive the O(n²) total operation count for a nested loop `for i in range(n): for j in range(i, n): ...` using the sum-of-first-n formula, showing the algebra step by step. Common mistakes: assuming log base doesn't matter for Big-O (it doesn't, since bases differ by a constant factor) but then misapplying that fact inside exact (non-asymptotic) calculations where the base does matter.

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-01-Complexity-and-Foundations/0*.md` — expect 8 for every file.
  Run: `grep -L '```python' DSA/Phase-01-Complexity-and-Foundations/0*.md` — expect no output (every lesson has a Python code block).

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-01-Complexity-and-Foundations
  git commit -m "Add DSA Phase 1: Complexity and Foundations"
  ```

---

### Task 2: Phase 02 — Arrays and Strings

**Files:**
- Create: `DSA/Phase-02-Arrays-and-Strings/01-Two-Pointers.md`
- Create: `DSA/Phase-02-Arrays-and-Strings/02-Sliding-Window.md`
- Create: `DSA/Phase-02-Arrays-and-Strings/03-Prefix-Sums.md`
- Create: `DSA/Phase-02-Arrays-and-Strings/04-In-Place-Array-Manipulation.md`
- Create: `DSA/Phase-02-Arrays-and-Strings/05-Kadanes-Algorithm.md`

- [ ] **Step 1: Write the 5 lesson files**, each following the Lesson Format:
  - `01-Two-Pointers.md`: opposite-direction pointers (sorted-array pair-sum) vs same-direction pointers (remove-duplicates style). Example: Python code for two-sum on a sorted array using opposite-direction pointers, with a step-by-step pointer-position trace. Common mistakes: using two pointers on an unsorted array without sorting first when the technique requires order; off-by-one on the `while left < right` boundary; forgetting to skip duplicate values when the problem requires unique pairs.
  - `02-Sliding-Window.md`: fixed-size window vs variable-size (expand/shrink) window, the invariant the window must maintain. Example: Python code for "longest substring without repeating characters" using a variable-size window with a set/dict tracking the window's contents, tracing window boundaries as they expand and contract. Common mistakes: forgetting to shrink the window when the invariant breaks; recomputing the window's state from scratch each iteration instead of incrementally updating it (turning O(n) into O(n²)).
  - `03-Prefix-Sums.md`: precomputing cumulative sums to answer range-sum queries in O(1), the prefix-sum-difference trick for subarray sum equal to k (using a hashmap of prefix sums seen so far). Example: Python code building a prefix-sum array and answering multiple range-sum queries, then a second example solving "subarray sum equals k" via prefix-sum + hashmap. Common mistakes: off-by-one when the prefix array is 0-indexed vs 1-indexed (prefix[i] = sum of first i elements vs first i+1); forgetting to initialize the hashmap with {0: 1} for the subarray-sum-equals-k pattern.
  - `04-In-Place-Array-Manipulation.md`: modifying an array without extra space using swap-based techniques, the "write pointer" pattern (e.g. remove element in place, move zeroes to end). Example: Python code for "move all zeroes to the end while preserving order of non-zero elements" using a write-pointer technique, with a trace of the array state after each swap. Common mistakes: using `list.remove()` or slicing inside a loop (breaks in-place O(1)-space guarantee and shifts indices unexpectedly); iterating and mutating the same list by index without accounting for the write pointer lagging behind the read pointer.
  - `05-Kadanes-Algorithm.md`: maximum subarray sum via tracking "best sum ending here" vs "best sum overall", why resetting the running sum to 0 when it goes negative is the key insight. Example: Python code for Kadane's algorithm on an array with negative numbers, tracing `current_sum` and `max_sum` at each index. Common mistakes: forgetting to handle all-negative arrays (returning 0 instead of the least-negative element); resetting `current_sum` to 0 unconditionally instead of only when it's worse than starting fresh at the current element.

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-02-Arrays-and-Strings/0*.md` — expect 8 per file.
  Run: `grep -L '```python' DSA/Phase-02-Arrays-and-Strings/0*.md` — expect no output.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-02-Arrays-and-Strings
  git commit -m "Add DSA Phase 2: Arrays and Strings"
  ```

---

### Task 3: Phase 03 — Linked Lists

**Files:**
- Create: `DSA/Phase-03-Linked-Lists/01-Singly-and-Doubly-Linked-Lists.md`
- Create: `DSA/Phase-03-Linked-Lists/02-Fast-Slow-Pointers.md`
- Create: `DSA/Phase-03-Linked-Lists/03-Reversal-Patterns.md`
- Create: `DSA/Phase-03-Linked-Lists/04-Cycle-Detection-Floyds-Algorithm.md`
- Create: `DSA/Phase-03-Linked-Lists/05-Merge-Patterns.md`

- [ ] **Step 1: Write the 5 lesson files**, each following the Lesson Format:
  - `01-Singly-and-Doubly-Linked-Lists.md`: node structure (`val`, `next`, and `prev` for doubly), why linked lists give O(1) insertion/deletion at a known position vs an array's O(n) shift. Example: Python `Node` class plus insert-at-head/insert-at-tail/delete-node functions for a singly linked list. Common mistakes: losing the reference to the rest of the list when reassigning `next` in the wrong order; forgetting to update `prev` pointers on both neighbors when deleting from a doubly linked list.
  - `02-Fast-Slow-Pointers.md`: the tortoise-and-hare technique for finding the middle node and for cycle detection, why the fast pointer moving 2x the slow pointer's speed guarantees they meet inside a cycle. Example: Python code to find the middle of a linked list in one pass using fast/slow pointers, with a trace of both pointers' positions per iteration. Common mistakes: not handling even-length lists correctly (which "middle" is expected — first or second of the two middles); null-pointer errors from not checking `fast and fast.next` before advancing.
  - `03-Reversal-Patterns.md`: iterative reversal using three pointers (prev/curr/next), reversing a sublist between positions m and n, reversing in groups of k. Example: Python code for iterative full-list reversal with a trace showing `prev`, `curr`, `next` at each step. Common mistakes: losing the reference to the next node before reassigning `curr.next`; off-by-one when reversing a sublist (stopping one node early/late).
  - `04-Cycle-Detection-Floyds-Algorithm.md`: Floyd's cycle detection (reusing fast/slow pointers), and the follow-up of finding the cycle's start node (reset one pointer to head, advance both at the same speed until they meet). Example: Python code detecting a cycle and then locating its starting node, with an explanation of the math (why resetting to head works, using the meeting-point distance relationship). Common mistakes: only detecting that a cycle exists without implementing the second phase to find its start; infinite loop from forgetting the initial null checks.
  - `05-Merge-Patterns.md`: merging two sorted linked lists via dummy-head technique, merging k sorted lists (naive pairwise vs using a heap — cross-reference to Phase 7). Example: Python code merging two sorted linked lists using a dummy head node, tracing pointer movement. Common mistakes: forgetting the dummy-head technique and mishandling the very first node specially; not advancing the pointer of the list whose current node was NOT selected, causing an infinite loop.

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-03-Linked-Lists/0*.md` — expect 8 per file.
  Run: `grep -L '```python' DSA/Phase-03-Linked-Lists/0*.md` — expect no output.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-03-Linked-Lists
  git commit -m "Add DSA Phase 3: Linked Lists"
  ```

---

### Task 4: Phase 04 — Stacks and Queues

**Files:**
- Create: `DSA/Phase-04-Stacks-and-Queues/01-Stack-Implementation-and-Operations.md`
- Create: `DSA/Phase-04-Stacks-and-Queues/02-Queue-and-Deque-Implementation.md`
- Create: `DSA/Phase-04-Stacks-and-Queues/03-Monotonic-Stack.md`
- Create: `DSA/Phase-04-Stacks-and-Queues/04-Min-Stack-and-Auxiliary-Structures.md`

- [ ] **Step 1: Write the 4 lesson files**, each following the Lesson Format:
  - `01-Stack-Implementation-and-Operations.md`: LIFO principle, implementing a stack with a Python list (`append`/`pop`), classic use cases (balanced parentheses, undo functionality, expression evaluation). Example: Python code validating balanced parentheses/brackets using a stack, tracing the stack's contents character by character. Common mistakes: using `pop(0)` on a list for a stack (that's O(n), breaks the O(1) guarantee — should pop from the end); forgetting to check the stack is non-empty before popping.
  - `02-Queue-and-Deque-Implementation.md`: FIFO principle, why a plain Python list is a bad queue (`pop(0)` is O(n)) and `collections.deque` is the right tool, deque supporting O(1) operations at both ends. Example: Python code implementing a sliding-window maximum using a deque holding indices (monotonic deque), tracing the deque's contents as the window slides. Common mistakes: using a list instead of `deque` for a queue in performance-sensitive code; storing values instead of indices in a monotonic deque when the original array positions matter.
  - `03-Monotonic-Stack.md`: maintaining a stack that's always increasing or decreasing, used for "next greater element" style problems, why elements are popped when they violate the monotonic property. Example: Python code for "next greater element" using a monotonic decreasing stack, tracing pushes/pops per index. Common mistakes: pushing values instead of indices when the answer needs positions, not values; using the wrong comparison direction (`>` vs `>=`) which silently changes behavior for duplicate values.
  - `04-Min-Stack-and-Auxiliary-Structures.md`: designing a stack that supports O(1) `getMin()` using an auxiliary stack that tracks the running minimum alongside the main stack. Example: Python `MinStack` class with `push`, `pop`, `top`, `getMin` all O(1), tracing both stacks in parallel through a sequence of operations. Common mistakes: pushing to the min-stack only when a new minimum is found (breaks correctness on pop — must push every time, or push a (value, min-so-far) tuple); forgetting to pop from both stacks together.

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-04-Stacks-and-Queues/0*.md` — expect 8 per file.
  Run: `grep -L '```python' DSA/Phase-04-Stacks-and-Queues/0*.md` — expect no output.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-04-Stacks-and-Queues
  git commit -m "Add DSA Phase 4: Stacks and Queues"
  ```

---

### Task 5: Phase 05 — Hashing

**Files:**
- Create: `DSA/Phase-05-Hashing/01-Hash-Maps-and-Sets.md`
- Create: `DSA/Phase-05-Hashing/02-Collision-Handling-Strategies.md`
- Create: `DSA/Phase-05-Hashing/03-Frequency-Counting-Patterns.md`
- Create: `DSA/Phase-05-Hashing/04-Two-Sum-Style-Problems.md`

- [ ] **Step 1: Write the 4 lesson files**, each following the Lesson Format:
  - `01-Hash-Maps-and-Sets.md`: how a hash function maps keys to bucket indices, why average-case O(1) lookup/insert/delete holds, Python's `dict`/`set` as the practical hash map/set. Example: Python code showing dict-based O(1) lookup replacing an O(n) linear scan, with a side-by-side timing-style comparison described in words (not actually benchmarked). Common mistakes: using a mutable type (list) as a dict key (raises TypeError — keys must be hashable); assuming dict iteration order matters for correctness in older mental models (Python 3.7+ preserves insertion order, but don't rely on it for hashing logic).
  - `02-Collision-Handling-Strategies.md`: chaining (bucket holds a list of entries) vs open addressing (linear/quadratic probing, double hashing), load factor and when a hash table resizes. Example: Python code implementing a tiny hash table from scratch using chaining (a list of buckets, each a list of (key, value) pairs), demonstrating insert/lookup with a manual hash function and showing a collision being resolved. Common mistakes: writing a hash function that clusters keys into too few buckets; forgetting to handle collisions when implementing a custom hash table from scratch, causing overwritten entries.
  - `03-Frequency-Counting-Patterns.md`: using a hashmap (or `collections.Counter`) to count occurrences, detecting anagrams via frequency comparison, finding the most/least frequent element. Example: Python code checking if two strings are anagrams by comparing `Counter` objects, and a second example finding the top-k frequent elements using a Counter plus sort. Common mistakes: comparing sorted strings for anagram checking when a hashmap/Counter is more efficient at scale; forgetting that `Counter` comparison ignores zero-count keys correctly but manual dict comparison might not.
  - `04-Two-Sum-Style-Problems.md`: the one-pass hashmap technique for two-sum (store value→index while scanning, check for complement), generalizing to three-sum (fix one element, two-pointer on the rest) and subarray-sum patterns. Example: Python code for the classic two-sum returning indices in O(n) using a single-pass hashmap, tracing the map's contents per index. Common mistakes: using the same element twice (checking the complement against itself before it's been excluded); not handling duplicate values correctly when the problem requires distinct indices or distinct value pairs.

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-05-Hashing/0*.md` — expect 8 per file.
  Run: `grep -L '```python' DSA/Phase-05-Hashing/0*.md` — expect no output.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-05-Hashing
  git commit -m "Add DSA Phase 5: Hashing"
  ```

---

### Task 6: Phase 06 — Trees and BST

**Files:**
- Create: `DSA/Phase-06-Trees-and-BST/01-Tree-Traversals.md`
- Create: `DSA/Phase-06-Trees-and-BST/02-Binary-Search-Tree-Operations.md`
- Create: `DSA/Phase-06-Trees-and-BST/03-Balanced-Trees-Conceptual-AVL-Red-Black.md`
- Create: `DSA/Phase-06-Trees-and-BST/04-Lowest-Common-Ancestor.md`

- [ ] **Step 1: Write the 4 lesson files**, each following the Lesson Format:
  - `01-Tree-Traversals.md`: preorder/inorder/postorder (recursive definitions), level-order (BFS with a queue), when each ordering is useful (inorder gives sorted order for a BST). Example: Python code for a binary tree `Node` class plus recursive preorder/inorder/postorder and iterative level-order traversal, run on the same example tree with the resulting sequences shown. Common mistakes: confusing the order of the recursive calls vs the print/visit statement (e.g. accidentally writing preorder when postorder was intended); forgetting to check for `None` before recursing, causing an AttributeError.
  - `02-Binary-Search-Tree-Operations.md`: the BST invariant (left < node < right), insert/search/delete, why delete is the tricky one (three cases: leaf, one child, two children — successor/predecessor replacement). Example: Python code for BST insert and search, plus the delete operation handling all three cases, tracing a delete-with-two-children case using the inorder successor. Common mistakes: breaking the BST invariant during delete by not correctly replacing the deleted node with its inorder successor/predecessor; assuming BST operations are O(log n) without acknowledging the O(n) worst case for a degenerate (skewed) tree.
  - `03-Balanced-Trees-Conceptual-AVL-Red-Black.md`: why unbalanced BSTs degrade to O(n), the balance factor concept in AVL trees, rotations (left/right/left-right/right-left) at a conceptual level, Red-Black trees' coloring invariants as the alternative balancing strategy used in most standard library implementations. Example: Python code for a single right rotation on an unbalanced 3-node subtree, showing the tree structure before and after. Common mistakes: assuming you need to implement full AVL/Red-Black balancing for interviews (usually you only need to explain the concept and know standard libraries handle it); confusing which rotation (left vs right) fixes which imbalance direction.
  - `04-Lowest-Common-Ancestor.md`: LCA in a BST (using the BST property to walk down from root: branch left/right based on where the two targets fall relative to the current node) vs LCA in a general binary tree (recursive: a node is the LCA if both targets are found in different subtrees). Example: Python code for both the BST-specific LCA (O(h) using the ordering property) and the general binary-tree LCA (post-order recursive search), on the same example tree. Common mistakes: using the general (slower, no-ordering-assumption) algorithm when the tree is known to be a BST, missing the faster O(h) approach; not handling the case where one target node is an ancestor of the other.

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-06-Trees-and-BST/0*.md` — expect 8 per file.
  Run: `grep -L '```python' DSA/Phase-06-Trees-and-BST/0*.md` — expect no output.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-06-Trees-and-BST
  git commit -m "Add DSA Phase 6: Trees and BST"
  ```

---

### Task 7: Phase 07 — Heaps and Priority Queues

**Files:**
- Create: `DSA/Phase-07-Heaps-and-Priority-Queues/01-Heap-Operations-and-Heapify.md`
- Create: `DSA/Phase-07-Heaps-and-Priority-Queues/02-Heap-Sort.md`
- Create: `DSA/Phase-07-Heaps-and-Priority-Queues/03-Top-K-Patterns.md`
- Create: `DSA/Phase-07-Heaps-and-Priority-Queues/04-Merge-K-Sorted-Lists.md`

- [ ] **Step 1: Write the 4 lesson files**, each following the Lesson Format:
  - `01-Heap-Operations-and-Heapify.md`: the complete-binary-tree-as-array representation (parent at i, children at 2i+1/2i+2), min-heap vs max-heap invariant, `sift-up` (on insert) and `sift-down` (on extract-min/max) operations, Python's `heapq` module (min-heap only — negate values for max-heap). Example: Python code using `heapq.heappush`/`heappop` to build a min-heap step by step, plus a manual sift-down trace for `heapify`. Common mistakes: forgetting `heapq` is a min-heap only and not negating values when a max-heap is needed; assuming heap order gives a fully sorted array when only the root is guaranteed to be the min/max.
  - `02-Heap-Sort.md`: building a max-heap from an unsorted array (heapify from the last non-leaf node upward), then repeatedly swapping the root with the last element and sifting down — deriving O(n log n) time and O(1) extra space. Example: Python code implementing heap sort from scratch (build-heap + repeated extract-max), tracing the array state after each extraction. Common mistakes: rebuilding the heap from scratch after every extraction instead of sifting down just the swapped root (turns O(n log n) into O(n² log n)); off-by-one errors in the parent/child index formulas.
  - `03-Top-K-Patterns.md`: using a min-heap of size k to find the k largest elements in O(n log k) instead of sorting the whole array (O(n log n)), the pattern of pushing then popping when the heap exceeds size k. Example: Python code finding the k most frequent elements using a Counter plus a min-heap of size k, tracing heap contents as elements are processed. Common mistakes: using a max-heap of the entire dataset instead of a min-heap capped at size k (loses the efficiency gain); forgetting to pop when the heap size exceeds k, letting it grow unbounded.
  - `04-Merge-K-Sorted-Lists.md`: merging k sorted lists using a min-heap holding one "current" element per list (with a pointer/index back to that list), repeatedly popping the smallest and pushing its list's next element — deriving O(n log k) vs the naive O(nk) pairwise merge. Example: Python code merging k sorted lists using `heapq` with tuples of (value, list_index, element_index), tracing which list contributes each output element. Common mistakes: pushing tuples that are unorderable when values tie (Python then tries to compare the next tuple element, which might not support `<` — fix by including a tie-breaking index); forgetting to push the next element from the same list after popping.

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-07-Heaps-and-Priority-Queues/0*.md` — expect 8 per file.
  Run: `grep -L '```python' DSA/Phase-07-Heaps-and-Priority-Queues/0*.md` — expect no output.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-07-Heaps-and-Priority-Queues
  git commit -m "Add DSA Phase 7: Heaps and Priority Queues"
  ```

---

### Task 8: Phase 08 — Graphs Traversal

**Files:**
- Create: `DSA/Phase-08-Graphs-Traversal/01-Graph-Representations.md`
- Create: `DSA/Phase-08-Graphs-Traversal/02-BFS-and-DFS.md`
- Create: `DSA/Phase-08-Graphs-Traversal/03-Topological-Sort.md`
- Create: `DSA/Phase-08-Graphs-Traversal/04-Union-Find-DSU.md`
- Create: `DSA/Phase-08-Graphs-Traversal/05-Cycle-Detection-in-Graphs.md`

- [ ] **Step 1: Write the 5 lesson files**, each following the Lesson Format:
  - `01-Graph-Representations.md`: adjacency list (dict of lists — space-efficient for sparse graphs) vs adjacency matrix (2D array — O(1) edge lookup, O(V²) space), directed vs undirected, weighted vs unweighted. Example: Python code building both representations for the same small graph and showing how to check "is there an edge from A to B" in each. Common mistakes: using an adjacency matrix for a large sparse graph (wastes memory); forgetting to add the edge in both directions for an undirected graph represented as an adjacency list.
  - `02-BFS-and-DFS.md`: BFS using a queue (level-by-level, finds shortest path in unweighted graphs), DFS using a stack or recursion (goes deep before backtracking), visited-set to avoid infinite loops in graphs with cycles. Example: Python code for both BFS (queue-based, iterative) and DFS (recursive) on the same graph, showing the different visit orders and highlighting BFS's shortest-path guarantee. Common mistakes: forgetting the visited set, causing infinite loops on cyclic graphs; marking a node visited when it's popped rather than when it's pushed/enqueued in BFS (can cause duplicate enqueues).
  - `03-Topological-Sort.md`: only defined for DAGs (directed acyclic graphs), Kahn's algorithm (BFS-based, using in-degree counting) vs DFS-based (post-order reversed). Example: Python code implementing Kahn's algorithm for topological sort (course-schedule style problem), tracing the in-degree array and queue contents. Common mistakes: applying topological sort to a graph with a cycle (undefined — must detect the cycle first, e.g. if not all nodes get processed by Kahn's algorithm, a cycle exists); reversing the DFS postorder incorrectly (or forgetting to reverse it at all).
  - `04-Union-Find-DSU.md`: the disjoint-set-union data structure for tracking connected components, path compression (flattening the tree on `find`) and union-by-rank/size (attaching the smaller tree under the larger) as the two optimizations that together give near-O(1) amortized operations. Example: Python code implementing `find` (with path compression) and `union` (with union-by-rank), tracing the parent array through a sequence of union operations. Common mistakes: implementing `find` without path compression (degrades to O(n) per call on skewed trees); implementing `union` without rank/size tracking (loses the balancing benefit).
  - `05-Cycle-Detection-in-Graphs.md`: cycle detection in an undirected graph (DFS with parent-tracking to avoid falsely flagging the edge back to the immediate parent as a cycle) vs in a directed graph (DFS with a recursion-stack/"currently visiting" set, since a back edge to any ancestor — not just the parent — indicates a cycle). Example: Python code for directed-graph cycle detection using a three-color (white/gray/black) DFS scheme, tracing color transitions. Common mistakes: using the undirected-graph algorithm (parent-check only) on a directed graph, which misses cycles that don't involve the immediate parent; forgetting to reset/remove a node from the "currently visiting" set when backtracking out of it.

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-08-Graphs-Traversal/0*.md` — expect 8 per file.
  Run: `grep -L '```python' DSA/Phase-08-Graphs-Traversal/0*.md` — expect no output.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-08-Graphs-Traversal
  git commit -m "Add DSA Phase 8: Graphs Traversal"
  ```

---

### Task 9: Phase 09 — Graphs Shortest Path and MST

**Files:**
- Create: `DSA/Phase-09-Graphs-Shortest-Path-and-MST/01-Dijkstras-Algorithm.md`
- Create: `DSA/Phase-09-Graphs-Shortest-Path-and-MST/02-Bellman-Ford-Algorithm.md`
- Create: `DSA/Phase-09-Graphs-Shortest-Path-and-MST/03-Floyd-Warshall-Algorithm.md`
- Create: `DSA/Phase-09-Graphs-Shortest-Path-and-MST/04-Prims-Algorithm.md`
- Create: `DSA/Phase-09-Graphs-Shortest-Path-and-MST/05-Kruskals-Algorithm.md`

- [ ] **Step 1: Write the 5 lesson files**, each following the Lesson Format:
  - `01-Dijkstras-Algorithm.md`: single-source shortest path for non-negative weighted graphs, using a min-heap to always expand the currently-closest unvisited node (greedy), why it fails with negative edge weights. Example: Python code implementing Dijkstra's using `heapq` with a distances dict, tracing which node is popped and relaxed at each step on a small weighted graph. Common mistakes: using Dijkstra's on a graph with negative edge weights (silently gives wrong answers instead of erroring); not skipping stale heap entries (when a node is popped again with an already-worse distance, it must be skipped, not reprocessed).
  - `02-Bellman-Ford-Algorithm.md`: single-source shortest path that tolerates negative edges, relaxing all edges V-1 times, the extra Vth pass to detect negative-weight cycles. Example: Python code implementing Bellman-Ford, tracing the distances array across each of the V-1 relaxation passes, then showing the negative-cycle detection pass. Common mistakes: forgetting the extra pass for negative-cycle detection (silently returns an incorrect finite answer); not understanding why it needs exactly V-1 passes (each pass guarantees one more edge of the shortest path is "settled").
  - `03-Floyd-Warshall-Algorithm.md`: all-pairs shortest path via dynamic programming over "allowed intermediate node" (dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])), O(V³) time, why the triple-loop order (k outermost) matters. Example: Python code implementing Floyd-Warshall on a small weighted graph's adjacency matrix, tracing the distance matrix after each value of k. Common mistakes: looping with k as the innermost loop instead of outermost (breaks the DP's correctness, since each k-iteration must fully complete before the next); using it on a large sparse graph where Dijkstra's run from every source would be more efficient.
  - `04-Prims-Algorithm.md`: minimum spanning tree via greedily growing a single tree, adding the cheapest edge that connects the tree to a new vertex, using a min-heap similarly to Dijkstra's but keyed on edge weight rather than cumulative distance. Example: Python code implementing Prim's using `heapq`, tracing which edge is added to the MST at each step on a small weighted graph. Common mistakes: confusing Prim's (grows one tree, good for dense graphs) with Dijkstra's (grows shortest paths from a source) since the code structure looks nearly identical; forgetting to skip an edge whose destination is already in the tree.
  - `05-Kruskals-Algorithm.md`: MST via sorting all edges by weight and greedily adding each edge that doesn't create a cycle, using Union-Find (from Phase 8) to detect cycles in O(α(n)) per check. Example: Python code implementing Kruskal's using the Union-Find structure from Phase 8, tracing which edges are accepted/rejected in sorted order. Common mistakes: forgetting to sort edges by weight first (breaks the greedy guarantee); using a naive cycle check (e.g. DFS) instead of Union-Find, which is far slower for this use case.

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-09-Graphs-Shortest-Path-and-MST/0*.md` — expect 8 per file.
  Run: `grep -L '```python' DSA/Phase-09-Graphs-Shortest-Path-and-MST/0*.md` — expect no output.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-09-Graphs-Shortest-Path-and-MST
  git commit -m "Add DSA Phase 9: Graphs Shortest Path and MST"
  ```

---

### Task 10: Phase 10 — Greedy and Backtracking

**Files:**
- Create: `DSA/Phase-10-Greedy-and-Backtracking/01-Interval-Scheduling-and-Activity-Selection.md`
- Create: `DSA/Phase-10-Greedy-and-Backtracking/02-Backtracking-Fundamentals-N-Queens.md`
- Create: `DSA/Phase-10-Greedy-and-Backtracking/03-Subsets-Permutations-Combinations.md`
- Create: `DSA/Phase-10-Greedy-and-Backtracking/04-Sudoku-Style-Backtracking.md`

- [ ] **Step 1: Write the 4 lesson files**, each following the Lesson Format:
  - `01-Interval-Scheduling-and-Activity-Selection.md`: the greedy-choice property (why sorting by end time and picking the earliest-ending non-conflicting interval maximizes count), how this differs from sorting by start time or duration (which don't work). Example: Python code for the activity-selection problem, sorting intervals by end time and greedily selecting, tracing which intervals are accepted/rejected. Common mistakes: sorting by start time or by interval length instead of end time (produces a suboptimal count on certain inputs); forgetting to update the "last selected end time" reference after accepting an interval.
  - `02-Backtracking-Fundamentals-N-Queens.md`: the choose-explore-unchoose pattern, pruning invalid branches early (constraint checking) rather than generating all possibilities then filtering, using N-Queens as the canonical example (checking column/diagonal conflicts row by row). Example: Python code solving N-Queens via backtracking, tracing the board state and which placements are pruned. Common mistakes: checking constraints only after placing all N queens instead of pruning early (massively increases runtime); forgetting to "unchoose" (remove the queen) when backtracking out of a branch, corrupting subsequent attempts.
  - `03-Subsets-Permutations-Combinations.md`: generating all subsets via include/exclude recursion (2ⁿ total), generating all permutations via swap-based or used-tracking recursion (n! total), generating combinations of size k via a start-index parameter to avoid duplicates. Example: Python code generating all subsets of a small set via backtracking, and a second example generating all permutations, both tracing the recursion tree depth by depth. Common mistakes: not passing a "start index" for combinations, producing duplicate combinations in different orders; mutating a shared list without copying it when appending to the results list (all results end up referencing the same mutated list).
  - `04-Sudoku-Style-Backtracking.md`: backtracking over a 2D grid with row/column/box constraint checking, why choosing the most-constrained cell first (fewest candidate values) prunes the search space faster than left-to-right scanning. Example: Python code solving a Sudoku board via backtracking with row/col/3x3-box validity checks, tracing a few placement/backtrack steps. Common mistakes: recomputing full row/column/box validity from scratch on every check instead of maintaining sets of used values (a correctness-neutral but significant performance mistake); not backtracking the board state (undoing a placed digit) when a branch fails.

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-10-Greedy-and-Backtracking/0*.md` — expect 8 per file.
  Run: `grep -L '```python' DSA/Phase-10-Greedy-and-Backtracking/0*.md` — expect no output.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-10-Greedy-and-Backtracking
  git commit -m "Add DSA Phase 10: Greedy and Backtracking"
  ```

---

### Task 11: Phase 11 — Dynamic Programming

**Files:**
- Create: `DSA/Phase-11-Dynamic-Programming/01-DP-Fundamentals-1D-DP.md`
- Create: `DSA/Phase-11-Dynamic-Programming/02-2D-DP-and-Grid-Problems.md`
- Create: `DSA/Phase-11-Dynamic-Programming/03-Knapsack-Variants.md`
- Create: `DSA/Phase-11-Dynamic-Programming/04-LCS-and-LIS.md`
- Create: `DSA/Phase-11-Dynamic-Programming/05-DP-on-Trees-and-Graphs.md`
- Create: `DSA/Phase-11-Dynamic-Programming/06-State-Space-Reduction.md`

- [ ] **Step 1: Write the 6 lesson files**, each following the Lesson Format:
  - `01-DP-Fundamentals-1D-DP.md`: identifying overlapping subproblems and optimal substructure (callback to Phase 1's naive-Fibonacci pain point), top-down memoization vs bottom-up tabulation, using climbing-stairs/Fibonacci as the canonical 1D example. Example: Python code showing naive recursive Fibonacci (exponential), then memoized top-down, then bottom-up tabulated, with a note on the time-complexity improvement at each step. Common mistakes: memoizing with a mutable default argument (classic Python bug — shared cache across calls if not handled carefully); forgetting the base cases when converting top-down to bottom-up.
  - `02-2D-DP-and-Grid-Problems.md`: extending the DP table to two dimensions for grid-traversal problems (unique paths, minimum path sum), the recurrence relating `dp[i][j]` to `dp[i-1][j]` and `dp[i][j-1]`. Example: Python code computing minimum path sum in a grid using a 2D DP table, tracing the table's fill order and final values. Common mistakes: filling the table in the wrong order (must respect the dependency direction — top-to-bottom, left-to-right here); off-by-one errors when initializing the first row/column's base cases.
  - `03-Knapsack-Variants.md`: 0/1 knapsack (each item used at most once — recurrence considers include/exclude), unbounded knapsack (each item reusable — recurrence considers staying on the same item), the space-optimization trick of iterating the weight dimension in reverse for 0/1 vs forward for unbounded. Example: Python code for 0/1 knapsack with a 2D table, then the space-optimized 1D version, explicitly calling out why the reverse iteration order is required for correctness in the 1D case. Common mistakes: using forward iteration for 0/1 knapsack's space-optimized 1D version (silently allows reusing an item, turning it into unbounded knapsack); confusing which knapsack variant a problem statement describes.
  - `04-LCS-and-LIS.md`: Longest Common Subsequence (2D DP comparing two sequences, recurrence based on character match/mismatch) and Longest Increasing Subsequence (both the O(n²) DP approach and the O(n log n) patience-sorting/binary-search approach). Example: Python code for LCS via 2D DP table, and for LIS via the O(n log n) binary-search-on-tails approach, tracing the "tails" array as it's built. Common mistakes: confusing subsequence (not required to be contiguous) with substring/subarray (contiguous) — using the wrong recurrence entirely; misapplying `bisect` direction in the O(n log n) LIS approach (need the leftmost insertion point for strict increasing).
  - `05-DP-on-Trees-and-Graphs.md`: DP over a tree structure via post-order traversal (compute children's DP values before the parent's, e.g. "house robber III" style include/exclude per node), DP over a DAG via topological order (longest path in a DAG). Example: Python code for tree DP solving "maximum sum of non-adjacent nodes in a binary tree" via post-order recursion returning a (include, exclude) pair per node. Common mistakes: trying to apply array-style DP indices to a tree without a traversal order, losing track of dependencies; forgetting that DP on a general graph (with cycles) isn't valid without first reducing to a DAG (e.g. via topological order or SCC condensation).
  - `06-State-Space-Reduction.md`: recognizing when a DP state has redundant dimensions (e.g. rolling-array technique reducing 2D to 1D when only the previous row is needed), bitmask DP as a state-compression technique for small n (foreshadowing Phase 13), when to stop optimizing (readability vs marginal space savings in an interview setting). Example: Python code converting a 2D DP solution (from Task 2's grid problem) into a rolling 1D array, showing the memory savings and the index-update logic needed. Common mistakes: over-optimizing state in an interview setting at the cost of a bug (interviewers generally prefer correct-and-clear over marginally more space-efficient-and-broken); incorrectly reusing the previous row's values after they've already been overwritten in-place (order-of-update bug).

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-11-Dynamic-Programming/0*.md` — expect 8 per file.
  Run: `grep -L '```python' DSA/Phase-11-Dynamic-Programming/0*.md` — expect no output.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-11-Dynamic-Programming
  git commit -m "Add DSA Phase 11: Dynamic Programming"
  ```

---

### Task 12: Phase 12 — Advanced Data Structures

**Files:**
- Create: `DSA/Phase-12-Advanced-Data-Structures/01-Trie.md`
- Create: `DSA/Phase-12-Advanced-Data-Structures/02-Segment-Tree.md`
- Create: `DSA/Phase-12-Advanced-Data-Structures/03-Fenwick-Tree-BIT.md`
- Create: `DSA/Phase-12-Advanced-Data-Structures/04-Sparse-Table.md`

- [ ] **Step 1: Write the 4 lesson files**, each following the Lesson Format:
  - `01-Trie.md`: prefix-tree structure (each node holds children keyed by character plus an end-of-word flag), O(L) insert/search where L is the word length, why this beats a hashset for prefix-based queries (autocomplete, word-search). Example: Python code implementing a `TrieNode`/`Trie` class with `insert`, `search`, and `starts_with`, tracing node creation as words are inserted. Common mistakes: forgetting the end-of-word marker, causing `search("cat")` to return true when only "catalog" was inserted; not distinguishing `search` (exact word) from `starts_with` (prefix) in the traversal logic.
  - `02-Segment-Tree.md`: building a binary-tree-over-an-array structure supporting O(log n) range queries (sum/min/max) and O(log n) point updates, the recursive build/query/update pattern, lazy propagation as the extension for O(log n) range updates. Example: Python code implementing a segment tree for range-sum queries with point updates (build, query, update methods), tracing a query that spans multiple tree levels. Common mistakes: off-by-one errors in the range boundaries (inclusive vs exclusive) during recursive query splitting; forgetting to push down lazy-propagation flags before recursing into children when range updates are involved.
  - `03-Fenwick-Tree-BIT.md`: the Binary Indexed Tree's bit-manipulation-based structure (each index stores a partial sum determined by its lowest set bit), O(log n) prefix-sum query and point update using `i & (-i)`, why it's simpler to implement than a segment tree for prefix-sum use cases. Example: Python code implementing a Fenwick tree with `update` and `prefix_sum` methods using the `i & -i` trick, tracing which indices get touched on an update. Common mistakes: using 0-indexed arrays directly with a Fenwick tree without the standard 1-indexing convention (breaks the `i & -i` traversal logic); confusing prefix-sum query with range-sum query (range sum = prefix_sum(r) - prefix_sum(l-1)).
  - `04-Sparse-Table.md`: O(n log n) preprocessing for O(1) range-minimum/maximum queries on a static (immutable) array, using overlapping power-of-two-sized ranges and the idempotency of min/max (overlapping ranges don't break correctness, unlike sum). Example: Python code building a sparse table for range-minimum-query and answering queries in O(1), tracing the table's precomputed values for a few (i, 2^j) entries. Common mistakes: applying the sparse table's O(1)-query technique to range-sum (doesn't work directly, since overlapping ranges double-count for sum, only works for idempotent operations like min/max/gcd); forgetting the array is static — a sparse table doesn't support updates without a full O(n log n) rebuild.

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-12-Advanced-Data-Structures/0*.md` — expect 8 per file.
  Run: `grep -L '```python' DSA/Phase-12-Advanced-Data-Structures/0*.md` — expect no output.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-12-Advanced-Data-Structures
  git commit -m "Add DSA Phase 12: Advanced Data Structures"
  ```

---

### Task 13: Phase 13 — Bit Manipulation and Number Theory

**Files:**
- Create: `DSA/Phase-13-Bit-Manipulation-and-Number-Theory/01-Bit-Manipulation-Basics.md`
- Create: `DSA/Phase-13-Bit-Manipulation-and-Number-Theory/02-Bitmask-DP.md`
- Create: `DSA/Phase-13-Bit-Manipulation-and-Number-Theory/03-GCD-LCM-and-Sieve-of-Eratosthenes.md`
- Create: `DSA/Phase-13-Bit-Manipulation-and-Number-Theory/04-Modular-Arithmetic-and-Fast-Exponentiation.md`

- [ ] **Step 1: Write the 4 lesson files**, each following the Lesson Format:
  - `01-Bit-Manipulation-Basics.md`: AND/OR/XOR/NOT/shift operators and their common idioms (checking a bit, setting a bit, clearing a bit, toggling a bit, `n & (n-1)` to drop the lowest set bit, XOR to find the unique element in a list of pairs). Example: Python code using `n & (n-1)` repeatedly to count set bits, and a second snippet using XOR to find the single non-duplicated element in an array. Common mistakes: forgetting Python integers are arbitrary-precision (no fixed-width overflow like in C/Java, which changes how some bit tricks are reasoned about); off-by-one in bit-index math (bit 0 is the least significant bit).
  - `02-Bitmask-DP.md`: representing a subset of up to ~20 elements as an integer bitmask, using the bitmask as a DP state dimension (e.g. Traveling Salesman DP: `dp[mask][i]` = shortest path visiting exactly the cities in `mask`, ending at city `i`), why this only scales to small n (2ⁿ states). Example: Python code solving the small-n Traveling Salesman Problem via bitmask DP, tracing a couple of `dp[mask][i]` transitions. Common mistakes: attempting bitmask DP on an n too large (over ~20) where 2ⁿ becomes intractable; off-by-one errors when checking `mask & (1 << i)` to test membership vs `mask | (1 << i)` to add an element.
  - `03-GCD-LCM-and-Sieve-of-Eratosthenes.md`: Euclid's algorithm for GCD (recursive, `gcd(a,b) = gcd(b, a%b)`), deriving LCM from GCD (`lcm(a,b) = a*b // gcd(a,b)`), the Sieve of Eratosthenes for finding all primes up to n in O(n log log n) by marking multiples. Example: Python code implementing Euclid's GCD recursively and the Sieve of Eratosthenes iteratively, tracing which multiples get marked composite for a small n. Common mistakes: computing `a*b` before dividing by GCD on very large numbers (can be avoided by dividing first: `(a // gcd(a,b)) * b`, to reduce overflow risk in fixed-width languages, and it's still good practice in Python); starting the sieve's marking loop from `2*p` instead of `p*p` (correct but less efficient — worth noting as an optimization, not a correctness bug).
  - `04-Modular-Arithmetic-and-Fast-Exponentiation.md`: why competitive problems ask for answers "mod 10^9+7" (to avoid huge numbers while keeping arithmetic properties for +, -, ×), the modular arithmetic rules for each operator (including handling negative results from subtraction), fast exponentiation (`pow(base, exp, mod)` in Python, or the manual divide-and-conquer approach) reducing O(exp) to O(log exp). Example: Python code implementing fast exponentiation manually via divide-and-conquer (`if exp is even: half = fast_pow(base, exp//2) ...`), then showing Python's built-in three-argument `pow(base, exp, mod)` as the practical equivalent. Common mistakes: forgetting to apply the modulus after every multiplication (not just at the end), which lets intermediate values grow unnecessarily large; not handling negative intermediate results correctly under a modulus (need `((x % m) + m) % m`).

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-13-Bit-Manipulation-and-Number-Theory/0*.md` — expect 8 per file.
  Run: `grep -L '```python' DSA/Phase-13-Bit-Manipulation-and-Number-Theory/0*.md` — expect no output.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-13-Bit-Manipulation-and-Number-Theory
  git commit -m "Add DSA Phase 13: Bit Manipulation and Number Theory"
  ```

---

### Task 14: Phase 14 — Interview Strategy

**Files:**
- Create: `DSA/Phase-14-Interview-Strategy/01-Pattern-Recognition-Framework.md`
- Create: `DSA/Phase-14-Interview-Strategy/02-Mock-Interview-Approach.md`
- Create: `DSA/Phase-14-Interview-Strategy/03-Time-Management-and-Problem-Approach.md`

- [ ] **Step 1: Write the 3 lesson files**, each following the Lesson Format (this phase is capstone/strategy-focused, so "Example" sections use a short worked walkthrough of applying the framework to a sample problem rather than a from-scratch algorithm):
  - `01-Pattern-Recognition-Framework.md`: a decision framework for mapping problem-statement clues to techniques (e.g. "sorted array + target" → two pointers or binary search; "contiguous subarray/substring + constraint" → sliding window; "shortest path unweighted" → BFS; "count ways / min-max optimal value with choices" → DP; "top/bottom k" → heap). Example: walk through a sample problem statement, identify its clue words, and show the reasoning chain from clue → technique → which earlier phase's lesson applies. Common mistakes: pattern-matching on surface keywords without verifying the underlying structure actually fits (e.g. seeing "subarray" and reaching for sliding window when the problem actually needs prefix sums because the constraint isn't monotonic).
  - `02-Mock-Interview-Approach.md`: the standard interview loop (clarify constraints and edge cases first, state a brute-force approach and its complexity, optimize, code, test with a trace on a small example, discuss complexity again), why narrating your thought process matters as much as the final code. Example: a short transcript-style walkthrough of talking through a problem out loud, from clarifying question through brute force to optimized approach. Common mistakes: jumping straight to coding without stating a plan (loses partial credit and wastes time on a wrong approach); not testing the solution against the interviewer's example before declaring it done.
  - `03-Time-Management-and-Problem-Approach.md`: budgeting time within a typical 30-45 minute interview slot (clarify ~2-3 min, brute force + optimize discussion ~5-8 min, coding ~15-20 min, testing/edge cases ~5 min), what to do when stuck (fall back to brute force and state it explicitly rather than going silent, or think aloud about which earlier-phase pattern might apply). Example: a sample time budget table for a 40-minute interview slot, plus a short scenario of "you're 25 minutes in and not converging — what do you do" with a concrete recommended action. Common mistakes: spending too long trying to find the optimal solution before writing any code (a working brute-force answer beats a silent 40 minutes); not communicating when stuck, leaving the interviewer unable to help or give hints.

- [ ] **Step 2: Verify structure**
  Run: `grep -c '^## ' DSA/Phase-14-Interview-Strategy/0*.md` — expect 8 per file.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/Phase-14-Interview-Strategy
  git commit -m "Add DSA Phase 14: Interview Strategy"
  ```

---

### Task 15: Projects/ — Multi-Pattern Combined Problems

**Files:**
- Create: `DSA/Projects/README.md`
- Create: `DSA/Projects/01-LRU-Cache.md`
- Create: `DSA/Projects/02-Course-Schedule.md`
- Create: `DSA/Projects/03-Word-Ladder.md`
- Create: `DSA/Projects/04-Meeting-Rooms-II.md`
- Create: `DSA/Projects/05-Word-Search-II.md`

- [ ] **Step 1: Write `README.md`**
  Explain the purpose: each project combines patterns from 2+ phases into one end-to-end problem, mirroring real interview problems that rarely test a single isolated technique. List all 5 projects in a table (`File | Patterns Combined | Phases`):
  - `01-LRU-Cache.md` — Hashing + Doubly Linked List — Phases 3, 5
  - `02-Course-Schedule.md` — Graph BFS/DFS + Topological Sort — Phase 8
  - `03-Word-Ladder.md` — BFS + Hashing — Phases 5, 8
  - `04-Meeting-Rooms-II.md` — Greedy + Heap — Phases 7, 10
  - `05-Word-Search-II.md` — Trie + Backtracking — Phases 10, 12

  Recommend attempting each project only after its listed phases are complete.

- [ ] **Step 2: Write the 5 project files**, each with sections `## Problem Statement`, `## Approach Discussion` (how the combined patterns apply, why each is needed), `## Solution` (full Python code), `## Complexity`:
  - `01-LRU-Cache.md`: design an LRU cache with O(1) `get`/`put` using a hashmap (key → node) plus a doubly linked list (maintains recency order, most-recently-used at one end). Solution: full Python `LRUCache` class with `Node`, `get`, `put`, internal `_remove`/`_add_to_front` helpers. Complexity: O(1) for both operations, O(capacity) space.
  - `02-Course-Schedule.md`: determine if all courses can be finished given prerequisite pairs (cycle detection in a directed graph) and, as a follow-up, return a valid course order (topological sort). Solution: full Python code using Kahn's algorithm, returning both the feasibility boolean and the order. Complexity: O(V + E) time and space.
  - `03-Word-Ladder.md`: shortest transformation sequence length from a start word to an end word, changing one letter at a time, each intermediate word must exist in a given word list — modeled as BFS over an implicit graph where edges connect words differing by one letter, using a hashset for O(1) word-list membership checks. Solution: full Python code doing BFS with a visited set and a helper generating all one-letter-different candidate words. Complexity: O(N × L² ) where N is word list size and L is word length (accounting for generating/hashing candidate words per BFS step).
  - `04-Meeting-Rooms-II.md`: minimum number of meeting rooms required given a list of intervals — solved by a greedy approach using a min-heap of end times (for each meeting sorted by start time, reuse a room if the earliest-ending room's meeting has already ended, else allocate a new room). Solution: full Python code sorting intervals by start time and using a min-heap of end times. Complexity: O(n log n) time, O(n) space.
  - `05-Word-Search-II.md`: given a 2D board of letters and a list of words, find all words present in the board (adjacent-cell paths, no cell reused) — solved by inserting all words into a Trie first, then backtracking (DFS) from every board cell while following the Trie to prune paths that can't match any word prefix. Solution: full Python code building the Trie and performing the backtracking search with in-place cell marking/unmarking. Complexity: O(rows × cols × 4^L) worst case where L is the max word length, dramatically pruned in practice by the Trie.

- [ ] **Step 3: Verify structure**
  Run: `grep -c '^## ' DSA/Projects/0*.md` — expect 4 per project file (Problem Statement, Approach Discussion, Solution, Complexity).
  Run: `grep -L '```python' DSA/Projects/0*.md` — expect no output.

- [ ] **Step 4: Commit**
  ```bash
  git add DSA/Projects
  git commit -m "Add DSA Projects: 5 multi-pattern combined problems"
  ```

---

### Task 16: Quick-Reference/ — Cheatsheet, Interview Q&A, Pattern Recognition Guide

**Files:**
- Create: `DSA/Quick-Reference/Cheatsheet.md`
- Create: `DSA/Quick-Reference/Interview-QA.md`
- Create: `DSA/Quick-Reference/Pattern-Recognition-Guide.md`

- [ ] **Step 1: Write `Cheatsheet.md`**
  Dense, topic-organized reference tables (style matching `Git/Git-Cheatsheet.md`), organized by section, each a `| Structure/Algorithm | Time | Space | Notes |` table:
  - Data structure operation costs: array, linked list, stack, queue, hashmap, BST (average + worst case), heap, trie, segment tree, Fenwick tree.
  - Algorithm complexity reference: all traversals/searches/sorts/graph algorithms covered in Phases 2–13, one row each.
  - Algorithm code-template snippets: short Python skeletons for two pointers, sliding window, BFS, DFS, binary search, backtracking skeleton, DP top-down skeleton — pulled directly from the patterns already established in the phase lessons (not new content, just condensed).

- [ ] **Step 2: Write `Interview-QA.md`**
  50 interview questions with answers, following the 50-question convention used in other courses (e.g. `LLD/Quick-Reference/Interview-QA.md`). Organize into groups matching the phase groupings: Q1-10 Foundations/Arrays/Strings/Linked Lists (Phases 1-3), Q11-20 Stacks/Queues/Hashing/Trees (Phases 4-6), Q21-30 Heaps/Graphs (Phases 7-9), Q31-40 Greedy/Backtracking/DP (Phases 10-11), Q41-50 Advanced Data Structures/Bit Manipulation/Number Theory/Strategy (Phases 12-14). Each entry: question, answer, and a 1-3 sentence explanation.

- [ ] **Step 3: Write `Pattern-Recognition-Guide.md`**
  A single lookup table: `| Problem Clue/Shape | Technique | Phase Reference |`, covering at least 25 rows spanning every phase (e.g. "sorted array + pair/triplet sum" → Two Pointers → Phase 2; "contiguous subarray/substring + size or sum constraint" → Sliding Window → Phase 2; "linked list middle/cycle" → Fast-Slow Pointers → Phase 3; "next greater/smaller element" → Monotonic Stack → Phase 4; "shortest path, unweighted" → BFS → Phase 8; "shortest path, weighted, non-negative" → Dijkstra's → Phase 9; "minimum spanning tree" → Prim's/Kruskal's → Phase 9; "count ways / min-max with overlapping subproblems" → DP → Phase 11; "prefix-based word lookup" → Trie → Phase 12; "range query on static array" → Sparse Table → Phase 12; etc). Written as original content for this course (not copied from `DSA-prep`).

- [ ] **Step 4: Verify structure**
  Run: `grep -c '^Q' DSA/Quick-Reference/Interview-QA.md` — expect 50 (or equivalent numbered-question count matching the file's actual numbering scheme).

- [ ] **Step 5: Commit**
  ```bash
  git add DSA/Quick-Reference
  git commit -m "Add DSA Quick-Reference: cheatsheet, interview Q&A, pattern recognition guide"
  ```

---

### Task 17: Course-level README.md

**Files:**
- Create: `DSA/README.md`

- [ ] **Step 1: Write the course README**
  Sections: `## Overview` (what this course covers: Data Structures and Algorithms from complexity foundations through competitive-programming-level advanced topics, framed for technical interview prep, using Python throughout); `## Course Structure` (the full tree: Phase-01 through Phase-14 + Projects + Quick-Reference, noting that phase directories contain numbered lesson files only — no per-phase README, a deliberate exception for this course); `## Learning Path` table with columns `Phase | Topic | Difficulty | Time`, one row per phase (Phases 1-5 Easy-Medium, Phases 6-9 Medium, Phases 10-13 Medium-Hard, Phase 14 n/a-strategy) plus a final row for Projects; `## Prerequisites` (basic Python syntax); link to `Phase-01-Complexity-and-Foundations/01-Big-O-Big-Theta-Big-Omega.md` to start (not a phase README, since none exists — link directly to the first lesson file).

- [ ] **Step 2: Verify all internal links resolve**
  Run: `grep -oE '\]\([^)]+\.md[^)]*\)' DSA/README.md` and manually confirm each referenced path exists via `ls`.

- [ ] **Step 3: Commit**
  ```bash
  git add DSA/README.md
  git commit -m "Add DSA course README"
  ```

---

## Self-Review Notes

- **Spec coverage:** All 14 phases covered (Tasks 1-14), Projects/ with 5 multi-pattern problems (Task 15), Quick-Reference/ with all 3 files including the course-unique Pattern-Recognition-Guide.md (Task 16), course README (Task 17). The explicit no-per-phase-README deviation is applied consistently — no task creates one, and Task 17's README links directly to the first lesson file rather than a nonexistent phase README.
- **Lesson format consistency:** Every phase task (1-14) uses the identical 8-section Lesson Format header defined once at the top of the plan, applied to all 62 lesson files, so there's no drift in section naming/order across phases.
- **Independence from DSA-prep:** No task references, links to, or migrates content from `/Users/ganeshpirikirala/Desktop/DSA-prep`; the Pattern-Recognition-Guide task explicitly notes it's original content despite covering similar ground.
- **Cross-references between phases:** Where a lesson's content naturally depends on an earlier phase (e.g. Phase 9's Kruskal's using Phase 8's Union-Find, Phase 11's bitmask-DP foreshadowing Phase 13, Phase 3's merge-k-lists cross-referencing Phase 7's heap), those references point to phases with lower numbers only — no forward dependency that would break if tasks are executed in order.
