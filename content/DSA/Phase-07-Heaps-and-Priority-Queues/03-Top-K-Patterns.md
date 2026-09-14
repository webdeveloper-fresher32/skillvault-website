# Top-K Patterns

## 1. Problem

"Find the k largest elements" sounds like it just wants sorting, and the obvious approach — sort the whole array, take the last k — works, but it's overkill: sorting establishes a total order over *every* element, when the question only cares about the boundary between the top k and everything else. Sorting the whole thing costs O(n log n) regardless of how small k is; if n is a million and k is 10, you've done a huge amount of unnecessary work ordering the 999,990 elements nobody asked about.

The **top-k pattern** answers this more cheaply: maintain a **min-heap capped at size k** as you scan through the data once. The heap never holds more than k elements, so every push/pop against it costs O(log k), not O(log n) — and since you only do this n times (once per input element), the total cost is **O(n log k)**, which is dramatically cheaper than O(n log n) when k is much smaller than n.

## 2. Analogy

Imagine you're a scout recruiting the top 5 players from a season of tryouts, watching one player audition at a time, and you can only keep 5 names on your clipboard at once. Every time a new player auditions, you jot them onto the clipboard. If the clipboard now has 6 names, you cross off the *weakest* of the 6 — never the strongest, since you're hunting for the top performers, so the weakest is the one least likely to matter. By the end of tryouts, your clipboard holds exactly the top 5 seen so far — and crucially, you never had to rank the hundreds of players who clearly weren't going to make the cut; you only ever compared against your current weakest kept player.

That's the min-heap-of-size-k trick: the heap's root is deliberately the *worst* of the *best* seen so far, so a single comparison against the root tells you instantly whether a new candidate is even worth considering.

## 3. Internal Flow

The core pattern for "k largest" (or, in the frequency-counting variant below, "k most frequent"):

1. Maintain a **min-heap** — note this is the *opposite* heap type you might instinctively reach for. You might expect a max-heap to find the largest elements, but a max-heap would need to hold *all* n elements to guarantee correctness (the true max always has to be reachable). A **min-heap capped at size k** instead only needs to answer "is this candidate better than my current worst-of-the-top-k?" — and the root of a min-heap is exactly that worst-of-the-top-k value.
2. For each incoming element, push it onto the heap.
3. If the heap's size now exceeds k, pop the root (the smallest element currently held) — this discards whichever of the k+1 candidates is weakest, restoring size k.
4. After processing all elements, the heap holds exactly the k largest values (or k most frequent, or k closest, depending on what you're comparing) seen across the whole input — in no particular internal order beyond the min-heap invariant, but that's fine since the question asked for the *set* of top k, not their sorted order.

This generalizes directly beyond raw "k largest": any time you need "top k by some score," push `(score, item)` pairs and let the heap order by score. A very common variant is **top-k frequent elements** — first tally frequencies with a `Counter`, then run the same min-heap-of-size-k pattern over `(count, value)` pairs instead of raw values.

## 4. Example

```python
import heapq
from collections import Counter

def top_k_frequent(nums, k):
    counts = Counter(nums)
    print("Frequency counts:", dict(counts))
    min_heap = []   # holds (count, value) pairs, smallest count at heap[0]
    for value, count in counts.items():
        heapq.heappush(min_heap, (count, value))
        print(f"pushed (count={count}, value={value}) -> heap: {min_heap}")
        if len(min_heap) > k:
            popped = heapq.heappop(min_heap)
            print(f"  heap exceeded size {k}, popped smallest {popped} -> heap: {min_heap}")
    return [value for count, value in min_heap]

nums = [1, 1, 1, 2, 2, 3, 4, 4, 4, 4]
k = 2
print("Input:", nums, " k =", k)
result = top_k_frequent(nums, k)
print("Top", k, "most frequent elements (heap contents, order not guaranteed sorted):", result)
print("Sorted by frequency for readability:", sorted(result, key=lambda v: -Counter(nums)[v]))
```

Executed output:

```
Input: [1, 1, 1, 2, 2, 3, 4, 4, 4, 4]  k = 2
Frequency counts: {1: 3, 2: 2, 3: 1, 4: 4}
pushed (count=3, value=1) -> heap: [(3, 1)]
pushed (count=2, value=2) -> heap: [(2, 2), (3, 1)]
pushed (count=1, value=3) -> heap: [(1, 3), (3, 1), (2, 2)]
  heap exceeded size 2, popped smallest (1, 3) -> heap: [(2, 2), (3, 1)]
pushed (count=4, value=4) -> heap: [(2, 2), (3, 1), (4, 4)]
  heap exceeded size 2, popped smallest (2, 2) -> heap: [(3, 1), (4, 4)]
Top 2 most frequent elements (heap contents, order not guaranteed sorted): [1, 4]
Sorted by frequency for readability: [4, 1]
```

Value `3` (count 1) was pushed and then immediately evicted the moment the heap exceeded size 2, since it was the least frequent of the three candidates seen at that point — the heap never had to compare it against the eventual winner (value 4, count 4) at all beyond that single push-then-pop. By the end, only `1` (count 3) and `4` (count 4) survive, matching the two truly most frequent values in the input.

## 5. Compare

Sorting the entire input to find the top k costs O(n log n) and needs to fully order every element, including the n-k elements nobody asked about. The min-heap-of-size-k pattern costs **O(n log k)** — a real asymptotic win whenever k ≪ n, since the heap's size (and therefore the cost of each push/pop) never grows past k regardless of how large the input is. A third alternative, the **quickselect** algorithm (partition-based, like quicksort but only recursing into the side that contains the k-th element), achieves O(n) average time — asymptotically better than the heap approach — but only works when you need a one-shot answer over a static, fully-available array; it doesn't stream, and its worst case is O(n²) without care. The heap approach's real edge is that it works on a **stream** — data arriving one element at a time, without ever needing the whole input in memory at once — which quickselect and full sorting both require.

## 6. Common Mistakes

- **Using a max-heap over the entire dataset instead of a min-heap capped at size k.** A max-heap of everything correctly finds the max, but finding the *k* largest that way means popping k times from a heap that's still size n — you lose the O(log k) win entirely and pay O(n + k log n) with none of the streaming/memory benefit of capping the heap.
- **Forgetting to pop when the heap size exceeds k**, letting it grow unbounded — this silently turns the algorithm into "collect everything," defeating the entire point of the pattern and blowing past the O(log k) cost per operation.
- **Popping before checking size, unconditionally, on every push** — this can evict a valid top-k candidate before the heap has even reached size k, corrupting the result for small inputs.
- **Confusing "min-heap for top-k-largest" as if it were backwards.** It feels counterintuitive at first (why use a *min*-heap to find the *largest*?) — but the root of the capped min-heap is exactly the cutoff you compare new candidates against, which is the weakest member of the current top-k, not the answer itself.
- **Forgetting the tuple ordering matters when pushing `(score, item)` pairs** — if two items tie on score and `item` isn't directly comparable (e.g. a custom object), Python's tuple comparison falls through to comparing `item`, which can raise `TypeError`. (See the k-way merge lesson for the same issue solved with a tie-breaking index.)

## 7. Interview Angle

"Find the k largest/smallest/most frequent/closest" is one of the most common heap-adjacent interview families — LeetCode 215 (Kth Largest Element), 347 (Top K Frequent Elements), and 973 (K Closest Points to Origin) are all the exact same pattern wearing different clothes. The strongest signal you can give an interviewer is naming the complexity trade-off unprompted: "I could sort in O(n log n), but since we only need k elements, a min-heap capped at size k gets this down to O(n log k)." A frequent follow-up is "what if k is very close to n?" — worth noting that when k ≈ n, O(n log k) approaches O(n log n) anyway, so the heap approach's advantage specifically comes from k being meaningfully smaller than n.

## 8. Memory Hook

**"Min-heap, capped at k, push-then-pop-if-over."** The heap's root is always the *weakest of the best-so-far* — that's what makes it a min-heap even though you're hunting for the largest values. Every element gets one push and, at most, one pop: **O(n log k)**, not O(n log n).
