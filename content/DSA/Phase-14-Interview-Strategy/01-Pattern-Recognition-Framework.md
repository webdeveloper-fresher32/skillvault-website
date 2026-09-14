# Pattern Recognition Framework

## 1. Problem

By the time you're sitting in an interview, you've studied thirteen phases of individual techniques — two pointers, sliding window, BFS, DP, heaps, tries, and more. The gap that trips people up isn't "I don't know sliding window," it's "I read this problem and froze because I couldn't tell it *was* a sliding window problem." A fresh problem statement doesn't come labeled with a phase number. It comes as English prose — "find the longest substring with at most two distinct characters," "find the cheapest way to connect all cities" — and the real skill being tested is translating that prose into a shortlist of candidate techniques fast enough to leave time for actually solving it. Without a deliberate framework for that translation step, candidates either panic-guess the first technique that comes to mind, or burn ten of their forty minutes silently re-reading the prompt hoping the right idea appears.

## 2. Analogy

Think of a doctor doing differential diagnosis. A patient doesn't walk in and say "I have appendicitis" — they say "I have pain in my lower right abdomen that got worse over six hours." The doctor doesn't jump to a diagnosis from the first symptom; they extract specific signs (location, onset, accompanying fever) and match that *cluster* of signs against known patterns, while also running tests to rule out look-alikes (is it actually a hernia, or food poisoning?). Reading a DSA problem statement works the same way: the words are the symptoms, the techniques from Phases 2–13 are the diagnoses, and pattern recognition is the disciplined process of extracting the real signs (not just the flashiest word) and checking that the diagnosis actually fits before you commit to treatment (i.e., before you start coding).

## 3. Internal Flow

The framework runs in three steps every time, for every problem:

**Step 1 — Extract structural clues, not surface words.** Read past the nouns ("array", "string", "tree") and identify: Is the input sorted? Is there a *contiguous* window constraint (subarray/substring) or can elements be picked non-contiguously? Is there a graph/relationship structure (even if not stated as "graph")? Does the problem ask to *count ways* or find a *min/max over choices with overlapping subproblems*? Is only the *top/bottom K* of something needed, not a full sort? Does the answer depend on relative order among elements as they're processed (monotonic behavior)?

**Step 2 — Map the clue cluster to a shortlist of techniques.** This is a lookup, not a derivation — you should have this table memorized from Phases 2–13, not reinvented live:

| Clue in the problem statement | Likely technique | Course reference |
|---|---|---|
| Sorted array + looking for a target/pair | Two pointers or binary search | `DSA/Phase-02-Arrays-and-Strings/01-Two-Pointers.md` |
| Contiguous subarray/substring + a size or property constraint that grows/shrinks monotonically | Sliding window | `DSA/Phase-02-Arrays-and-Strings/02-Sliding-Window.md` |
| Repeated range-sum queries over a fixed array | Prefix sums | `DSA/Phase-02-Arrays-and-Strings/03-Prefix-Sums.md` |
| "Maximum subarray sum" specifically (no window, no fixed size) | Kadane's algorithm | `DSA/Phase-02-Arrays-and-Strings/05-Kadanes-Algorithm.md` |
| Linked list, "find the middle," or "does it cycle" | Fast/slow pointers | `DSA/Phase-03-Linked-Lists/02-Fast-Slow-Pointers.md`, `DSA/Phase-03-Linked-Lists/04-Cycle-Detection-Floyds-Algorithm.md` |
| "Next greater/smaller element," or maintaining increasing/decreasing order while scanning | Monotonic stack | `DSA/Phase-04-Stacks-and-Queues/03-Monotonic-Stack.md` |
| Counting frequencies, checking existence in O(1), grouping by a derived key | Hash map / set | `DSA/Phase-05-Hashing/01-Hash-Maps-and-Sets.md`, `DSA/Phase-05-Hashing/03-Frequency-Counting-Patterns.md` |
| "Shortest path" in an *unweighted* graph, or "minimum number of steps/levels" | BFS | `DSA/Phase-08-Graphs-Traversal/02-BFS-and-DFS.md` |
| "Shortest path" with *weighted* edges (all non-negative) | Dijkstra's algorithm | `DSA/Phase-09-Graphs-Shortest-Path-and-MST/01-Dijkstras-Algorithm.md` |
| "Order of tasks with dependencies," "can this finish given prerequisites" | Topological sort | `DSA/Phase-08-Graphs-Traversal/03-Topological-Sort.md` |
| "Are these connected," "count groups/islands," union of sets over time | Union-Find (DSU) | `DSA/Phase-08-Graphs-Traversal/04-Union-Find-DSU.md` |
| "Top K," "Kth largest," "K closest" | Heap | `DSA/Phase-07-Heaps-and-Priority-Queues/03-Top-K-Patterns.md` |
| Count the number of ways, or min/max achievable value, with choices that reuse overlapping subproblems | Dynamic programming | `DSA/Phase-11-Dynamic-Programming/01-DP-Fundamentals-1D-DP.md`, `DSA/Phase-11-Dynamic-Programming/03-Knapsack-Variants.md` |
| Generate all subsets/permutations/combinations, or "explore every valid placement" (N-Queens, Sudoku) | Backtracking | `DSA/Phase-10-Greedy-and-Backtracking/02-Backtracking-Fundamentals-N-Queens.md`, `DSA/Phase-10-Greedy-and-Backtracking/03-Subsets-Permutations-Combinations.md` |
| "Maximize/minimize non-overlapping intervals chosen greedily," and a greedy local choice is provably optimal | Greedy (interval scheduling) | `DSA/Phase-10-Greedy-and-Backtracking/01-Interval-Scheduling-and-Activity-Selection.md` |
| Autocomplete, prefix search over many strings | Trie | `DSA/Phase-12-Advanced-Data-Structures/01-Trie.md` |
| Repeated range updates *and* range queries on an array | Segment tree or Fenwick tree | `DSA/Phase-12-Advanced-Data-Structures/02-Segment-Tree.md`, `DSA/Phase-12-Advanced-Data-Structures/03-Fenwick-Tree-BIT.md` |
| Small N (≤ ~20) with subsets as state in a DP | Bitmask DP | `DSA/Phase-13-Bit-Manipulation-and-Number-Theory/02-Bitmask-DP.md` |

**Step 3 — Verify the fit before committing.** Pick the top candidate from the shortlist and stress-test it mentally against the actual constraint, not just the keyword. Ask: "does the property I need actually behave monotonically as the window grows/shrinks?" (required for sliding window to work), "are all edge weights really non-negative?" (required for Dijkstra), "do subproblems actually overlap, or is every subproblem independent?" (required for DP to beat plain recursion). If the verification fails, drop back to Step 2 and try the next candidate — this is the step most candidates skip, and it's the one that catches you before you've written ten minutes of code for the wrong approach.

## 4. Example

Sample problem statement: *"Given a string `s`, find the length of the longest substring that contains at most two distinct characters."*

Reasoning chain:
1. **Extract clues**: "substring" → contiguous range of the string, not an arbitrary subsequence. "at most two distinct characters" → a constraint on window contents that can be checked incrementally as characters enter/leave the window. "longest" → we want to *grow* the window as much as possible while the constraint holds.
2. **Map to shortlist**: Contiguous range + a shrinking/growing constraint on window contents is exactly the clue pattern for sliding window (`DSA/Phase-02-Arrays-and-Strings/02-Sliding-Window.md`). A competing candidate might be "just try every substring" (brute force, O(n²) or O(n³)), which is always the fallback but not the target.
3. **Verify the fit**: Does "number of distinct characters in the window" behave monotonically as the window expands? Yes — adding a character can only keep the distinct count the same or increase it, and removing one from the left can only keep it the same or decrease it. That monotonic behavior is precisely the property sliding window depends on (once the window becomes invalid, you only ever need to shrink from the left, never restart from scratch) — so the fit is confirmed, and it's safe to commit: maintain a right pointer that expands the window and a hash map of character counts (`DSA/Phase-05-Hashing/01-Hash-Maps-and-Sets.md`) tracking distinct characters in the current window, shrinking from the left whenever distinct count exceeds two.

Contrast: if the problem had instead asked for "the longest substring where the *sum* of a non-monotonic scoring function is maximized," the surface word "substring" would still be present, but the constraint wouldn't shrink/grow monotonically — that's a signal to fall back to prefix sums or Kadane's-style scanning instead, which is exactly the kind of check Step 3 exists to catch.

## 5. Compare

| Approach to pattern recognition | Speed to correct technique | Risk |
|---|---|---|
| Keyword pattern-matching only (Step 2, no Step 3) | Fast | High — commits to a plausible-looking technique that doesn't actually fit, discovered only after coding has started |
| Full framework (Steps 1–3) | Slightly slower up front (30–60 extra seconds of thinking) | Low — catches mismatches before code is written, net faster overall |
| No framework, brainstorm from scratch | Slow and inconsistent | High — reinvents technique selection under time pressure instead of recalling it |
| Memorizing solutions to specific past problems | Fast for seen problems, useless otherwise | Very high on novel problems — doesn't generalize |

The full framework costs a little time at the very start of the interview but saves far more time later by preventing a wrong-approach detour — see `DSA/Phase-14-Interview-Strategy/03-Time-Management-and-Problem-Approach.md` for how this trades off against the interview clock directly.

## 6. Common Mistakes

- Pattern-matching on a surface keyword ("subarray," "substring," "tree") without running Step 3's verification — e.g., seeing "subarray" and reaching immediately for sliding window when the target property (say, "maximum product," which can flip sign) isn't monotonic as the window grows, so the technique silently produces wrong answers.
- Treating the table lookup as the entire skill and skipping Step 1 — jumping to "graph problem" because the word "network" appears, without first checking whether the relationships described are actually weighted, directed, or even a graph at all versus a simpler tree or array relationship.
- Committing to the first technique that comes to mind and coding for several minutes before noticing the fit is wrong, rather than spending 30 seconds verifying before writing any code.
- Forgetting that many problems combine two patterns (e.g., a hash map for O(1) lookups *inside* a sliding window) and stopping the search after finding just one applicable technique.
- Confusing "sorted" with "monotonic constraint" — a sorted array clue and a monotonic-window clue point to different techniques (two pointers/binary search vs. sliding window) and are easy to conflate because both sound like "things get easier as you move left to right."

## 7. Interview Angle

Interviewers watch *how* you get from the problem statement to a technique far more closely than they watch whether you happen to already know the answer. Saying out loud "this is a contiguous-range problem with a monotonic constraint, so I'm thinking sliding window — let me check that the constraint actually behaves monotonically before I commit" demonstrates the exact diagnostic process a senior engineer uses when facing a genuinely novel problem in production, which is what the interview is actually trying to assess. Candidates who silently pattern-match and get lucky look weaker under this lens than candidates who narrate a structured (even if slightly slower) reasoning chain, especially when the "lucky guess" candidate can't explain why a technique applies when asked a follow-up like "would this still work if the array weren't sorted?"

## 8. Memory Hook

"**Clues, not nouns.**" Don't diagnose from the word "subarray" — diagnose from the *behavior* (contiguous? monotonic? overlapping subproblems? unweighted shortest path?). Extract → Match → Verify, every time, and only start coding after Verify passes.
