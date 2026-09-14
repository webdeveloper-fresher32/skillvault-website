# DSA Interview Q&A

50 questions covering the full DSA course, organized by phase grouping.

---

## Foundations, Arrays, Strings, Linked Lists (Q1–Q10)

**Q1. What is the difference between Big-O, Big-Theta, and Big-Omega?**
Answer: Big-O describes an asymptotic upper bound (worst case never worse than this), Big-Omega describes a lower bound (best case never better than this), and Big-Theta describes a tight bound where the upper and lower bounds match, meaning the algorithm behaves at exactly that rate for all large inputs. In interviews "complexity" almost always means Big-O, since it's the guarantee that matters for correctness of a time budget.

**Q2. Why is the Master Theorem useful, and what recurrence does merge sort produce?**
Answer: The Master Theorem gives a direct formula for solving recurrences of the form `T(n) = a·T(n/b) + f(n)` without expanding the recursion tree by hand, by comparing `f(n)` to `n^(log_b a)`. Merge sort produces `T(n) = 2T(n/2) + O(n)`, which falls into Master Theorem case 2 and resolves to `O(n log n)`.

**Q3. Why does naive recursive Fibonacci take exponential time, and how do you fix it?**
Answer: Naive recursive Fibonacci recomputes the same subproblems repeatedly — `fib(n)` calls `fib(n-1)` and `fib(n-2)`, each of which independently recomputes overlapping smaller values, producing roughly `O(2^n)` calls (e.g. `fib(30)` takes millions of calls). Memoizing with a cache (dict or `lru_cache`) so each unique subproblem is solved once collapses this to `O(n)`.

**Q4. When does two pointers beat a nested loop for array problems?**
Answer: Two pointers works when the array is sorted (or can be sorted) and you're looking for a pair/triplet satisfying a sum or difference condition — moving one pointer inward when the sum is too small and the other inward when too large exploits the sorted order to eliminate a whole range of candidates per step, turning an `O(n²)` nested scan into `O(n)`.

**Q5. What makes a sliding window "variable size" vs "fixed size," and how do you know when to shrink it?**
Answer: A fixed-size window slides by adding one new element and removing exactly one old element per step (e.g. max sum of any k consecutive elements). A variable-size window grows by extending the right edge and shrinks by advancing the left edge whenever a constraint is violated (e.g. "no more than two distinct characters") — the shrink condition is a `while` loop, not a single step, because a single extension can require multiple contractions to restore validity.

**Q6. How do prefix sums turn repeated range-sum queries into O(1) each?**
Answer: Precomputing a prefix array where `prefix[i]` holds the sum of all elements up to index `i` costs `O(n)` once; any subsequent range sum `sum(l, r)` is then just `prefix[r] - prefix[l-1]`, a single subtraction, regardless of how many queries follow.

**Q7. What is Kadane's algorithm solving, and why doesn't it need a window or prefix sums?**
Answer: Kadane's algorithm finds the maximum-sum contiguous subarray in a single `O(n)` pass by tracking, at each index, "the best subarray sum ending exactly here" — if extending the previous running sum with the current element helps, keep extending; otherwise restart the running sum at the current element. It needs neither a shrinking window (there's no explicit size/property constraint to violate) nor prefix sums (there's no repeated-query pattern).

**Q8. Why is insertion at the head O(1) for a linked list but O(n) for an array?**
Answer: An array's elements are stored contiguously, so inserting at the front requires shifting every existing element one slot to the right — `O(n)` work. A linked list's head insertion is just creating a new node and repointing the head reference to it, with no other node's memory location changing — `O(1)`.

**Q9. How does Floyd's cycle detection (fast/slow pointers) find a cycle in O(1) extra space?**
Answer: Two pointers walk the list at different speeds — slow moves one node per step, fast moves two. If there's no cycle, fast reaches the end (`None`) first and the algorithm terminates. If there is a cycle, fast eventually laps slow and the two pointers land on the same node, proving a cycle exists — no hash set of visited nodes is needed, unlike the O(n)-space alternative.

**Q10. What is the practical difference between arrays and linked lists that interviewers are testing when they ask "which would you use here"?**
Answer: The core tradeoff is "fast to find, slow to insert" (array — direct index access but O(n) shifting for insert/delete in the middle) versus "slow to find, fast to insert" (linked list — O(n) walk to locate a node but O(1) unlinking/relinking once found). The right answer depends on whether the workload is read-heavy with random access (array) or write-heavy with frequent insertions/deletions once a position is known (linked list).

---

## Stacks, Queues, Hashing, Trees (Q11–Q20)

**Q11. Why is `list.pop(0)` a performance trap in Python, and what should be used instead for a queue?**
Answer: `list.pop(0)` removes the first element and then shifts every remaining element one index to the left, costing `O(n)` per call — for a queue processed element by element, that turns an intended `O(n)` total workload into `O(n²)`. `collections.deque` supports `append`, `appendleft`, `pop`, and `popleft` all in `O(1)`, because it's implemented as a doubly linked block structure rather than a flat contiguous array.

**Q12. What invariant does a monotonic stack maintain, and why is a nested-loop-looking algorithm actually O(n)?**
Answer: A monotonic stack keeps its elements in strictly increasing (or decreasing) order at all times — before pushing a new element, it pops off anything that would violate the invariant. Even though popping happens inside a loop nested within another loop, every element is pushed exactly once and popped at most once across the entire run, bounding total work at roughly `2n` operations — `O(n)` overall, not `O(n²)`.

**Q13. What problem does a min-stack solve that a plain stack can't answer in O(1)?**
Answer: A plain stack only exposes push/pop/peek at the top; asking "what's the minimum value currently in the stack" would require scanning all `n` elements. A min-stack keeps a second, parallel stack that tracks the running minimum at each depth, so `getMin()` becomes an `O(1)` peek into that auxiliary stack instead of an `O(n)` scan.

**Q14. Why is hash map lookup "average-case O(1)" rather than always O(1)?**
Answer: A hash function maps keys to bucket indices, and if it distributes keys well across the underlying array, each bucket holds very few entries, so lookup is effectively a single computation plus a short scan — average `O(1)`. But a pathological hash function (or adversarial input designed to collide) can pile many keys into the same bucket, degrading that bucket's lookup toward a linear scan — worst case `O(n)`.

**Q15. What are the two traversal orders that give you "process children before parent" vs "process parent before children" in trees, and which uses which data structure?**
Answer: Preorder (parent, then children) and postorder (children, then parent) are both depth-first traversals typically implemented recursively (using the call stack, `O(h)` space); level-order (breadth-first, processing all nodes at depth `d` before depth `d+1`) uses an explicit queue instead of the call stack, with space proportional to the tree's maximum width `O(w)` rather than its height.

**Q16. Why is BST search O(log n) on average but O(n) in the worst case?**
Answer: BST search follows a "compare and go left or right" path from root to the target, and the cost is proportional to the tree's height `h`. If the tree is reasonably balanced, `h ≈ log n`, giving `O(log n)`. But inserting values that already arrive in sorted order (with no rebalancing) produces a completely skewed tree where every node has exactly one child — `h` degenerates to `n`, matching a linked list's `O(n)` search.

**Q17. How do AVL trees and Red-Black trees guarantee O(log n) operations even in the worst case?**
Answer: Both are self-balancing BSTs that perform rotations after insertions/deletions to restore a height invariant — AVL keeps every node's left/right subtree heights within a balance factor of `{-1, 0, +1}` (stricter, faster lookups), while Red-Black trees allow a looser invariant (height at most twice the shortest root-to-leaf path) in exchange for fewer rotations on average. Both guarantee `h = O(log n)` regardless of insertion order, unlike an unbalanced BST.

**Q18. What's the time/space difference between finding the LCA in a BST versus a general binary tree?**
Answer: In a BST, the sorted-order property lets you find the LCA iteratively in `O(h)` time and `O(1)` extra space — walk down from the root, and the first node where the two target values split to different sides (or match the node itself) is the LCA. In a general binary tree (no ordering guarantee), you need a recursive search that checks both subtrees, costing `O(n)` time and `O(h)` recursion-stack space in the worst case.

**Q19. What's a collision, and name two strategies for handling it in a hash map.**
Answer: A collision happens when two different keys hash to the same bucket index. Separate chaining handles it by storing a small list (or linked list) of entries per bucket, so colliding keys just append to that bucket's list. Open addressing handles it by probing for the next available slot in the underlying array (linear probing, quadratic probing, or double hashing) instead of using auxiliary lists per bucket.

**Q20. Give an example of a frequency-counting pattern and explain why a hash map is the natural tool.**
Answer: Detecting whether two strings are anagrams is a frequency-counting problem — you need to know, for each character, how many times it appears in each string, then compare those counts. A hash map (or a fixed-size array for a known alphabet) lets you build and compare those counts in `O(n)` total time, versus sorting both strings first (`O(n log n)`) just to compare them character by character.

---

## Heaps, Graphs (Q21–Q30)

**Q21. Why is building a heap from n elements O(n) and not O(n log n)?**
Answer: Naively inserting `n` elements one at a time costs `O(n log n)` (each insert is `O(log n)`). But bottom-up heapify starts from the last non-leaf node and sifts down, and the key insight is that most nodes are near the bottom of the tree where sift-down does very little work — summing the actual work across all levels (weighted by how many nodes are at each level and how far they can sift) converges to `O(n)`, not `O(n log n)`.

**Q22. Walk through why heap sort is O(n log n) overall.**
Answer: Heap sort first builds a max-heap from the input in `O(n)` time, then repeatedly swaps the root (the current maximum) with the last unsorted element and sifts the new root down to restore the heap property. There are `n-1` such extractions, each costing `O(1)` for the swap plus `O(log n)` for the sift-down, giving `O(n log n)` total — and it uses only `O(1)` extra space since it sorts in place, though it is not a stable sort.

**Q23. When would you use a size-k min-heap instead of sorting the whole array for a "top K" problem?**
Answer: Sorting the entire array to find the top K elements costs `O(n log n)`. Maintaining a min-heap capped at size `k` — pushing each element and popping the smallest whenever the heap exceeds size `k` — costs `O(n log k)`, which is significantly cheaper when `k` is much smaller than `n`.

**Q24. How does merging K sorted lists with a heap beat the naive pairwise-merge approach?**
Answer: Naively merging lists one pair at a time costs `O(n·k)` (each of the `k` merges touches all `n` total elements). Using a min-heap seeded with the first element of each list, repeatedly popping the smallest and pushing the next element from that same list, produces the fully merged result in `O(n log k)`, since each of the `n` elements only costs one `O(log k)` heap operation instead of being touched `O(k)` times.

**Q25. What's the space tradeoff between representing a graph as an adjacency list versus an adjacency matrix?**
Answer: An adjacency list costs `O(V + E)` space and scales with the actual number of edges present, making it the default choice for sparse graphs. An adjacency matrix costs `O(V²)` space regardless of how many edges actually exist, which wastes memory on sparse graphs but gives `O(1)` edge-existence lookups, useful for dense graphs or when edge queries dominate.

**Q26. Both BFS and DFS visit every reachable node in O(V + E) — what's the actual difference between them in practice?**
Answer: Both traverse every vertex and edge exactly once, giving the same time complexity. The difference is order and space: BFS explores level by level using a queue (`O(V)` space for the queue and visited set) and is the right tool when you need the shortest path in an unweighted graph or "distance in steps." DFS explores as deep as possible before backtracking, typically via recursion (`O(V)` worst-case stack space for a skewed/path-like graph), and is the natural tool for cycle detection, topological sort, and connected-component enumeration.

**Q27. What does Union-Find (DSU) with path compression and union-by-rank give you, and what's it used for?**
Answer: Union-Find supports two operations — `find` (which set does this element belong to) and `union` (merge two sets) — and with both path compression (flattening the tree during `find`) and union-by-rank/size (attaching the smaller tree under the larger), each operation runs in amortized `O(α(n))`, effectively constant for any practical input. It's the standard tool for Kruskal's MST algorithm and for "are these connected" / "count groups" problems like counting islands or detecting redundant connections.

**Q28. How does topological sort differ between the Kahn's-algorithm approach and the DFS-based approach, and what do they have in common?**
Answer: Kahn's algorithm repeatedly removes nodes with in-degree zero, decrementing the in-degree of their neighbors, producing the ordering as nodes are removed (BFS-flavored, using a queue). The DFS-based approach runs DFS from every unvisited node and prepends each node to the result once all its descendants are fully explored (i.e., on the way back up the recursion). Both run in `O(V + E)` and only produce a valid ordering if the graph is a DAG (acyclic) — a cycle means no valid topological order exists.

**Q29. Why does cycle detection differ between directed and undirected graphs?**
Answer: In an undirected graph, a cycle is detected during DFS/BFS if you reach an already-visited node that isn't the immediate parent you just came from (since every edge is bidirectional, the parent will always appear "visited" and shouldn't count as a false cycle). In a directed graph, you need three states (unvisited, currently-in-recursion-stack, fully-done) — a cycle exists only if you reach a node that is currently in the active recursion stack ("gray"), not merely any previously visited node, since directed edges don't imply a path back.

**Q30. When would you reach for Dijkstra's over BFS for a shortest-path problem?**
Answer: BFS finds shortest paths correctly only when every edge has the same (or no) weight, since it counts steps, not cost. As soon as edges have different non-negative weights, Dijkstra's algorithm is needed — it greedily expands the frontier by cumulative path cost (via a min-heap) rather than by number of hops, running in `O((V + E) log V)` with a binary heap.

---

## Greedy, Backtracking, Dynamic Programming (Q31–Q40)

**Q31. Why does sorting by end time (not start time) make interval scheduling / activity selection greedy-correct?**
Answer: Sorting by end time and always picking the next interval whose start time is at or after the last picked interval's end time is provably optimal because finishing earliest always leaves the most room for future intervals — sorting by start time doesn't have this property, since an interval that starts early but runs very long can block out many later, shorter intervals that would together fit better.

**Q32. What are the three named steps in the backtracking template, and what does each one do?**
Answer: Choose (add a candidate to the current partial solution path), Explore (recurse deeper with that choice in place), and Unchoose (remove the candidate from the path before trying the next option at this level) — the unchoose step is what makes backtracking work with a single shared mutable path/state object instead of copying it at every recursive call, since it restores the state to exactly what it was before this branch was tried.

**Q33. Why are subsets O(2ⁿ), permutations O(n!), and combinations O(C(n,k)) — what's driving each count?**
Answer: Subsets: each of the `n` elements independently is either included or excluded, giving `2^n` total possibilities. Permutations: every distinct ordering of all `n` elements counts separately, giving `n!`. Combinations of size `k`: order doesn't matter and only `k` of the `n` elements are chosen, giving `C(n, k) = n! / (k!(n-k)!)`, which is always bounded well below `2^n` (its largest value, at `k = n/2`, is still asymptotically smaller than the full subset count).

**Q34. What is the "aha" that lets Sudoku-style backtracking with constraint checks avoid exploring the full O(9⁹⁹)-style brute force?**
Answer: Rather than filling all cells and validating at the end, constrained backtracking checks row/column/box validity before placing each digit and prunes immediately — an invalid placement never gets explored further, so entire subtrees of the search space are cut off early. This pruning is what makes backtracking with constraint propagation practically fast, even though its theoretical worst case is still exponential.

**Q35. What makes a problem a DP candidate rather than plain recursion or greedy?**
Answer: A problem is a DP candidate when it has optimal substructure (the optimal solution to the whole problem can be built from optimal solutions to subproblems) and overlapping subproblems (the same subproblem gets recomputed multiple times under plain recursion). If subproblems don't overlap, plain recursion/divide-and-conquer is enough; if there's no optimal substructure, DP doesn't apply and you may need brute force or a different technique.

**Q36. What's the difference between top-down (memoization) and bottom-up (tabulation) DP, and when would you prefer one?**
Answer: Top-down keeps the natural recursive structure but caches each subproblem's result (in a dict or via `lru_cache`) the first time it's computed, so repeat calls are `O(1)` lookups. Bottom-up builds a table iteratively from the smallest subproblems up to the final answer, avoiding recursion overhead and stack-depth limits entirely. Bottom-up is often preferred when the full subproblem space is needed anyway or recursion depth risks a stack overflow; top-down is often more natural to write and only computes the subproblems actually reachable from the top query.

**Q37. Why can 0/1 knapsack's 2D DP table be compressed from O(n × capacity) space to O(capacity)?**
Answer: Each row of the knapsack table only depends on the row directly above it (the previous item's results), so if you iterate the capacity dimension in the right direction (descending, for 0/1 knapsack, to avoid reusing an item twice within the same pass) a single 1D array can be overwritten in place instead of keeping every item's full row — dropping space from `O(n × capacity)` to `O(capacity)` with no change in time complexity.

**Q38. What is the state and transition for the classic LCS (Longest Common Subsequence) DP, and what's its complexity?**
Answer: The state `dp[i][j]` represents the LCS length of the first `i` characters of string A and the first `j` characters of string B. If the characters match, `dp[i][j] = dp[i-1][j-1] + 1`; otherwise `dp[i][j] = max(dp[i-1][j], dp[i][j-1])`. Filling the full `n × m` table costs `O(n·m)` time and space.

**Q39. Why does LIS (Longest Increasing Subsequence) have both an O(n²) and an O(n log n) solution, and what enables the faster one?**
Answer: The straightforward DP where `dp[i]` = length of the longest increasing subsequence ending at index `i`, checking all earlier indices `j < i`, is `O(n²)`. The faster `O(n log n)` version (patience sorting) instead maintains a list of "smallest tail values for increasing subsequences of each length" and uses binary search to find where the current element belongs, replacing or extending that list in `O(log n)` per element instead of scanning all previous elements.

**Q40. When would you use DP on trees or graphs instead of array-based DP, and what changes structurally?**
Answer: Tree/graph DP is needed when the "subproblems" are defined over subtrees or nodes rather than array prefixes — e.g. "maximum path sum in a binary tree" or "longest path in a DAG" — and the recurrence is typically computed via a post-order traversal (children's DP values must be known before combining them at the parent), rather than a simple left-to-right or top-left-to-bottom-right fill order used in array DP.

---

## Advanced Data Structures, Bit Manipulation, Number Theory, Strategy (Q41–Q50)

**Q41. Why is a Trie's insert/search O(L) rather than depending on the number of words stored?**
Answer: A Trie organizes characters as a tree where each path from root to a node represents a prefix, so inserting or searching a word of length `L` only ever walks `L` nodes deep, regardless of how many other words are already stored — the cost is driven entirely by the word's own length, not the dataset size.

**Q42. What's the key structural difference between a segment tree and a Fenwick tree (BIT), given both support O(log n) update and range query?**
Answer: A segment tree is a full binary tree (typically array-backed with size `4n`) where each node explicitly stores an aggregate (sum/min/max/etc.) over a range, supporting both point and range updates plus arbitrary associative range queries. A Fenwick tree is a more compact implicit structure (a single array of size `n`) specialized for prefix-sum-style queries via bit manipulation of indices — it's simpler and uses less memory, but is naturally suited to sums (and other invertible operations) rather than arbitrary min/max range queries.

**Q43. Why can't a sparse table support updates, and when is it still the right structure to reach for?**
Answer: A sparse table precomputes answers for every power-of-two-length window starting at every index (`O(n log n)` build), and range queries for idempotent operations like min/max combine two overlapping precomputed windows in `O(1)`. But because every precomputed window's answer would need to be recomputed if a single underlying value changed, there's no efficient incremental update — it's the right structure specifically for static arrays with many range-min/max/gcd queries and zero future updates.

**Q44. What does `n & (n - 1)` do, and what's it commonly used for?**
Answer: `n & (n - 1)` clears the lowest set bit of `n` (since `n - 1` flips all bits after and including the lowest set bit, and ANDing with the original zeroes that bit out). It's commonly used to count set bits efficiently — looping `while n: n &= n - 1; count += 1` runs in `O(popcount(n))` time rather than scanning every bit position, and to quickly check if a number is a power of two (`n & (n-1) == 0`).

**Q45. What is bitmask DP, and why is it used for problems like the Traveling Salesman Problem (TSP)?**
Answer: Bitmask DP represents "which subset of items/cities has been visited so far" as an integer bitmask, letting the DP state be `dp[mask][last]` = best cost to have visited exactly the cities in `mask`, ending at city `last`. For TSP this brings the complexity down from brute-force `O(n!)` permutations to `O(2ⁿ · n²)` time and `O(2ⁿ · n)` space — dramatically better for `n` up to about 20, though still exponential and impractical beyond that.

**Q46. Why is Euclid's algorithm for GCD O(log(min(a,b))) instead of O(min(a,b))?**
Answer: The naive approach (checking every integer down from `min(a,b)`) is `O(min(a,b))`. Euclid's algorithm instead repeatedly replaces `(a, b)` with `(b, a mod b)`, and each such step reduces the smaller number by at least a factor of roughly the golden ratio (a mathematical property of the modulo operation) — so the number of steps needed is logarithmic in the smaller input, `O(log(min(a,b)))`.

**Q47. Why is the Sieve of Eratosthenes O(n log log n) rather than O(n √n)?**
Answer: A naive method that trial-divides every number up to `n` by all numbers up to its square root costs `O(n√n)`. The Sieve instead marks off multiples of each prime starting from that prime's square, and the sum of `n/p` across all primes `p ≤ n` converges (by a known number-theoretic result) to `O(n log log n)` — a much slower-growing bound than `√n`, making the sieve dramatically faster for finding all primes up to `n`.

**Q48. How does fast (binary) exponentiation compute `a^b mod m` in O(log b) instead of O(b)?**
Answer: Instead of multiplying `a` by itself `b` times, binary exponentiation repeatedly squares the base and halves the exponent, using the binary representation of `b` to decide which squared values to multiply into the running result — since a number's binary representation has `O(log b)` bits, only `O(log b)` squarings and multiplications are needed instead of `b` sequential multiplications. Python's built-in `pow(base, exp, mod)` uses this same approach internally, in C.

**Q49. In an interview, how do you use structural clues in a problem statement to pick a technique before writing any code?**
Answer: Extract signals rather than surface nouns — is the input sorted, is there a contiguous-window constraint, is there an implicit graph/relationship structure, does it ask to count ways or optimize over overlapping choices, does it only need the top/bottom K rather than a full order — and match that cluster of signals against a memorized shortlist of techniques (the same mapping taught in Phase 14's Pattern Recognition Framework and condensed in this Quick-Reference's Pattern Recognition Guide), then verify the fit against the actual constraints (e.g., "are all edge weights really non-negative?") before committing to write code.

**Q50. What's a sound way to budget time during a 40–45 minute coding interview across understanding, coding, and testing?**
Answer: A reasonable split is roughly 5–10 minutes clarifying the problem and stating a plan/approach out loud before writing any code, 20–25 minutes implementing while narrating your reasoning, and 5–10 minutes tracing through test cases (including edge cases like empty input, single element, and duplicates) and fixing anything that surfaces — skipping the upfront clarification step is the single most common cause of building the wrong solution correctly.

---

**See also:** `DSA/Quick-Reference/Cheatsheet.md` for dense complexity tables and code skeletons, and `DSA/Quick-Reference/Pattern-Recognition-Guide.md` for the clue-to-technique lookup table.
