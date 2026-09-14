# Merge K Sorted Lists

## 1. Problem

Merging two sorted lists is a single O(n) walk-and-compare (see `Phase-03-Linked-Lists/05-Merge-Patterns.md`). But what about merging *k* sorted lists at once — say, k sorted result pages from k database shards, or k sorted log streams that need interleaving into one timeline? The naive extension is to merge them pairwise: merge list 1 and 2, then merge that result with list 3, then with list 4, and so on. If each list has roughly n/k elements, the first merge costs O(n/k · 2), the second costs O(n/k · 3), ..., and the total works out to **O(nk)** — because the early, already-merged elements get re-touched by every subsequent merge.

The smarter approach uses a **min-heap holding one "current" candidate element per list at a time** — never more than k elements in the heap simultaneously — repeatedly extracting the global smallest and advancing only the one list it came from. This brings the total cost down to **O(n log k)**: still n total elements processed, but each one only costs a O(log k) heap operation instead of being re-compared across a growing merged result.

## 2. Analogy

Picture k separate checkout lines at a warehouse, each already sorted by package weight from lightest to heaviest, and you need to load a truck in strict order from lightest package overall to heaviest. Instead of comparing all k lines' front packages against each other from scratch every single time (which is what pairwise merging effectively re-does), you keep exactly one representative package from each line's front sitting in a small holding tray of size k. You always grab the lightest package currently in the tray, load it onto the truck, and immediately pull the *next* package from whichever line just gave up its package — refilling the tray back to size k. The tray never holds more than k packages at once, so every comparison you make is among at most k items, not among everything you've already loaded.

## 3. Internal Flow

1. **Seed the heap.** Push one entry per list — the current front element of each list — onto a min-heap. Each entry needs enough information to know which list it came from and where within that list it sits, so a natural entry shape is a tuple `(value, list_index, element_index)`.
2. **Repeat until the heap is empty:**
   - Pop the smallest entry from the heap — by the min-heap invariant, this is guaranteed to be the smallest value among all lists' current front elements, which means it's the smallest value remaining across *all* k lists combined (every other unconsidered element in any list is ≥ its own list's current front, which is ≥ the popped value).
   - Append that value to the output.
   - If the list it came from has a next element, push `(next_value, list_index, next_element_index)` onto the heap — this refills the "one representative per active list" invariant.
3. The heap never holds more than k elements at once (one per still-active list), so each push/pop costs O(log k). Since every one of the n total elements across all lists gets pushed and popped exactly once, the total cost is **O(n log k)**.

**Why the tie-breaking index matters.** When two entries have equal values, Python's tuple comparison needs to fall back to comparing the *next* element of the tuple to break the tie (`(5, 0, 2)` vs `(5, 1, 0)` — since the first elements tie at 5, Python compares `0` vs `1` next). Including `list_index` (and, if needed, `element_index`) as tuple fields guarantees that fallback comparison is always between two plain integers, which are always orderable — instead of falling through to comparing whatever object comes after the value, which might not support `<` at all.

## 4. Example

```python
import heapq

def merge_k_sorted(lists):
    heap = []
    # seed the heap with the first element of each list
    for list_index, lst in enumerate(lists):
        if lst:
            heapq.heappush(heap, (lst[0], list_index, 0))

    print("Initial heap (value, list_index, element_index):", heap)
    result = []
    while heap:
        value, list_index, elem_index = heapq.heappop(heap)
        result.append(value)
        print(f"pop {value} from list {list_index} (element_index={elem_index}) "
              f"-> result so far: {result}")
        next_index = elem_index + 1
        if next_index < len(lists[list_index]):
            next_value = lists[list_index][next_index]
            heapq.heappush(heap, (next_value, list_index, next_index))
            print(f"  pushed next element from list {list_index}: "
                  f"(value={next_value}, elem_index={next_index}) -> heap: {heap}")
    return result

lists = [
    [1, 4, 7],
    [2, 2, 8],
    [0, 5, 6],
]
print("Input lists:", lists)
merged = merge_k_sorted(lists)
print("Merged result:", merged)
```

Executed output:

```
Input lists: [[1, 4, 7], [2, 2, 8], [0, 5, 6]]
Initial heap (value, list_index, element_index): [(0, 2, 0), (2, 1, 0), (1, 0, 0)]
pop 0 from list 2 (element_index=0) -> result so far: [0]
  pushed next element from list 2: (value=5, elem_index=1) -> heap: [(1, 0, 0), (2, 1, 0), (5, 2, 1)]
pop 1 from list 0 (element_index=0) -> result so far: [0, 1]
  pushed next element from list 0: (value=4, elem_index=1) -> heap: [(2, 1, 0), (5, 2, 1), (4, 0, 1)]
pop 2 from list 1 (element_index=0) -> result so far: [0, 1, 2]
  pushed next element from list 1: (value=2, elem_index=1) -> heap: [(2, 1, 1), (5, 2, 1), (4, 0, 1)]
pop 2 from list 1 (element_index=1) -> result so far: [0, 1, 2, 2]
  pushed next element from list 1: (value=8, elem_index=2) -> heap: [(4, 0, 1), (5, 2, 1), (8, 1, 2)]
pop 4 from list 0 (element_index=1) -> result so far: [0, 1, 2, 2, 4]
  pushed next element from list 0: (value=7, elem_index=2) -> heap: [(5, 2, 1), (8, 1, 2), (7, 0, 2)]
pop 5 from list 2 (element_index=1) -> result so far: [0, 1, 2, 2, 4, 5]
  pushed next element from list 2: (value=6, elem_index=2) -> heap: [(6, 2, 2), (8, 1, 2), (7, 0, 2)]
pop 6 from list 2 (element_index=2) -> result so far: [0, 1, 2, 2, 4, 5, 6]
pop 7 from list 0 (element_index=2) -> result so far: [0, 1, 2, 2, 4, 5, 6, 7]
pop 8 from list 1 (element_index=2) -> result so far: [0, 1, 2, 2, 4, 5, 6, 7, 8]
Merged result: [0, 1, 2, 2, 4, 5, 6, 7, 8]
```

Notice the tie between the two `2`s: list 1's own second element (`2`, at `element_index=1`) and the pending entry from list 0 (`2`) at that point in the trace — the heap correctly returns both `2`s consecutively (from list 1 twice in a row) before moving on to `4`, without ever raising a comparison error, because `list_index`/`element_index` breaks any tie on value alone. Also notice list 2 contributes the very first (`0`) and, later, two more values in a row (`5` then `6`) once the other lists' fronts are temporarily larger — the heap always routes to whichever list currently holds the global minimum, regardless of which list that was on the previous step.

To make the tie-breaking necessity concrete, here's what happens *without* an orderable tie-breaker, using plain objects as the second tuple element instead of a list index:

```python
import heapq

class ListNode:
    def __init__(self, val):
        self.val = val

heap = []
heapq.heappush(heap, (1, ListNode(10)))
try:
    heapq.heappush(heap, (1, ListNode(20)))
except TypeError as e:
    print("TypeError raised:", e)
```

Executed output:

```
TypeError raised: '<' not supported between instances of 'ListNode' and 'ListNode'
```

Both entries tie on the first tuple field (`1`), so Python's comparison falls through to the second field — but `ListNode` objects don't define `<`, so the comparison crashes. This is exactly why the working version above always includes `list_index` (and `element_index`) as integer tie-breakers before any non-comparable payload.

## 5. Compare

Naive pairwise merging costs O(nk) total, because each of the k-1 sequential merges re-touches the entire result built so far. The heap-based approach costs **O(n log k)** — a real win whenever k is more than a small constant, since log k grows far slower than k. An alternative, **divide-and-conquer pairwise merging** (merge lists in pairs, then merge those results in pairs, recursively — like the merge step of merge sort applied across lists instead of within one array) also achieves O(n log k), with the same asymptotic cost as the heap approach but no explicit heap needed; it's a reasonable alternative to mention, though the heap version is usually simpler to implement and reason about for streaming k lists that may not all be needed in full at once. Both beat naive pairwise merging by the same asymptotic factor of k / log k.

## 6. Common Mistakes

- **Pushing tuples that become unorderable on a tie** — if two entries have equal `value` and the tuple's next element isn't itself comparable (e.g. two `ListNode` objects, as shown above), Python raises `TypeError: '<' not supported...`. Fix: always include an integer tie-breaker (`list_index`, and `element_index` if needed) between the value and any non-comparable payload.
- **Forgetting to push the next element from the same list after popping** — this silently drops the rest of that list from the merge, since nothing re-adds its remaining elements back into consideration.
- **Pushing the *wrong* list's next element** after a pop — e.g. always pushing from list 0 regardless of which list the popped entry actually came from — corrupts the result by repeating or skipping elements.
- **Forgetting to check whether a list is empty before seeding the heap**, or forgetting to check bounds before pushing the "next" element — both cause an `IndexError` reaching past the end of a list.
- **Assuming O(n log k) is always better in practice than pairwise merging** for very small k (e.g. k=2 or k=3) — the constant-factor overhead of maintaining a heap can make simple pairwise merging faster in practice for small, fixed k, even though the heap approach has the better asymptotic bound.

## 7. Interview Angle

"Merge k sorted lists" (LeetCode 23) is a canonical follow-up to "merge two sorted lists" (LeetCode 21) — see `Phase-03-Linked-Lists/05-Merge-Patterns.md` for that base case. Interviewers expect you to first state the naive pairwise approach and its O(nk) cost, then be prompted (or proactively volunteer) "can we do better?" as the cue to introduce the heap-based approach and derive O(n log k). A common deeper follow-up: "what if the lists are linked lists rather than arrays?" — the pattern is identical, just push `(node.val, list_index, node)` and advance via `node.next` instead of an index; some interviewers also ask about the divide-and-conquer pairwise-merge alternative as a way to check whether you know more than one O(n log k) strategy.

## 8. Memory Hook

**"One representative per list in the heap, always advance the list you just popped from."** The heap only ever holds ≤ k elements, so every pop is O(log k), and there are n total pops: **O(n log k)**, beating naive pairwise merging's O(nk). And whenever values can tie, remember: **tuple ties fall through to the next field — make sure that next field is always a comparable integer.**
