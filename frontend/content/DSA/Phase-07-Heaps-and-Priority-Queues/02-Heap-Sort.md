# Heap Sort

## 1. Problem

You need to sort an array, in place, without the risk of merge sort's O(n) extra array or quicksort's worst-case O(n²) if the pivot choices go badly. You want a guaranteed O(n log n) upper bound — not just on average, but always — and you'd like to do it using O(1) extra space, no auxiliary arrays, no recursion depth blowing the stack. None of the classic three (merge sort, quicksort, insertion sort) hits all of these at once: merge sort guarantees O(n log n) but needs O(n) extra space; quicksort is in-place and fast in practice but degrades to O(n²) on adversarial input; insertion sort is in-place but O(n²) always.

**Heap sort** is the answer: it reuses the exact heap operations from the previous lesson — sift-down in particular — to guarantee O(n log n) time in every case, using only the input array itself as storage (O(1) extra space). The core insight: a max-heap's root is always the current maximum, and a heap is *just an array with an invariant* — so you can build the heap and pop from it entirely within the bounds of the same array you're sorting.

## 2. Analogy

Picture a bag of loose numbered tiles you need to line up from largest to smallest, using only the table space the tiles already occupy — no extra table. First, you rearrange the pile into a rough "priority order" shape (the build-heap step) where the single largest tile bubbles up to sit on top, though the rest are only loosely ordered underneath. Then you repeat one simple move: take the top tile (the current max), place it at the far right end of the table — its final resting spot — and pull the very last remaining tile into the vacated top spot, letting it sink down to wherever it belongs among what's left. Each repetition shrinks the "unsorted pile" by one and grows the "sorted row" on the right by one, using the same tiles and the same table space the whole way through — nothing extra is ever needed.

## 3. Internal Flow

**Phase 1 — build a max-heap from the raw array.** Rather than inserting elements one at a time (which would cost O(n log n) via n sift-ups), heap sort builds the heap bottom-up in O(n) time: start from the last non-leaf node — index `n // 2 - 1` — and sift each node down, moving backward toward index 0. Every leaf (indices `n//2` through `n-1`) is trivially a valid one-node heap already, so sifting starts one level above the leaves and works up to the root. By the time index 0 is sifted, its entire subtree (the whole array) satisfies the max-heap invariant, and the largest element sits at index 0.

**Phase 2 — repeatedly extract the max.** For `end` running from `n - 1` down to `1`:
1. Swap `arr[0]` (the current max, root of the heap) with `arr[end]` (the last position in the still-unsorted prefix). This places the max in its final sorted position and moves some arbitrary element into the root.
2. Shrink the "heap" boundary to exclude index `end` (it's now sorted and untouchable) — conceptually, the heap now only spans indices `0..end-1`.
3. Sift down *just* the element now sitting at the root, within the shrunk heap. This is the critical step: only one sift-down (O(log n)) is needed per extraction, because everything below the root was already a valid heap before the swap — only the newly-placed root element can possibly violate the invariant.

After n-1 extractions, the array is fully sorted in ascending order, built entirely from the original array's storage.

**Complexity.** Build-heap is O(n) (a known tighter bound than the naive O(n log n) estimate, because most nodes are near the leaves and sift only a short distance). Each of the n-1 extractions costs one swap (O(1)) plus one sift-down (O(log n)), for O(n log n) total. Overall: **O(n log n)** time, dominated by the extraction phase, and **O(1)** extra space, since every operation happens by swapping elements within the input array itself.

## 4. Example

```python
def sift_down(arr, n, i):
    """Restore the max-heap property at index i, within the first n elements of arr."""
    while True:
        largest = i
        left = 2 * i + 1
        right = 2 * i + 2
        if left < n and arr[left] > arr[largest]:
            largest = left
        if right < n and arr[right] > arr[largest]:
            largest = right
        if largest == i:
            break
        arr[i], arr[largest] = arr[largest], arr[i]
        i = largest

def build_max_heap(arr):
    n = len(arr)
    for i in range(n // 2 - 1, -1, -1):
        sift_down(arr, n, i)

def heap_sort(arr):
    n = len(arr)
    build_max_heap(arr)
    print(f"After build-max-heap: {arr}")
    for end in range(n - 1, 0, -1):
        arr[0], arr[end] = arr[end], arr[0]     # move current max to the end
        sift_down(arr, end, 0)                   # re-heapify only the shrunk prefix
        print(f"extracted {arr[end]:>2} -> sorted suffix {arr[end:]}, "
              f"heap prefix {arr[:end]}")
    return arr

data = [7, 1, 5, 9, 3, 8, 2, 6]
print("Original array:", data)
heap_sort(data)
print("Final sorted array:", data)
```

Executed output:

```
Original array: [7, 1, 5, 9, 3, 8, 2, 6]
After build-max-heap: [9, 7, 8, 6, 3, 5, 2, 1]
extracted  9 -> sorted suffix [9], heap prefix [8, 7, 5, 6, 3, 1, 2]
extracted  8 -> sorted suffix [8, 9], heap prefix [7, 6, 5, 2, 3, 1]
extracted  7 -> sorted suffix [7, 8, 9], heap prefix [6, 3, 5, 2, 1]
extracted  6 -> sorted suffix [6, 7, 8, 9], heap prefix [5, 3, 1, 2]
extracted  5 -> sorted suffix [5, 6, 7, 8, 9], heap prefix [3, 2, 1]
extracted  3 -> sorted suffix [3, 5, 6, 7, 8, 9], heap prefix [2, 1]
extracted  2 -> sorted suffix [2, 3, 5, 6, 7, 8, 9], heap prefix [1]
Final sorted array: [1, 2, 3, 5, 6, 7, 8, 9]
```

Watch the "sorted suffix" grow from the right (`[9]`, then `[8, 9]`, then `[7, 8, 9]`, ...) while the "heap prefix" shrinks by one element at a time and gets re-sifted after every swap. By the last line, the sorted suffix has absorbed everything except a single remaining element, which is trivially in place — the whole array is now `[1, 2, 3, 5, 6, 7, 8, 9]`, and every step happened by rearranging the same 8 slots, no auxiliary array allocated.

## 5. Compare

Heap sort, merge sort, and quicksort all achieve O(n log n) time on average, but they diverge on guarantees and space: merge sort is O(n log n) in the *worst case* too, but needs O(n) auxiliary space for merging; quicksort is in-place (O(log n) stack space) but degrades to O(n²) on adversarial or already-sorted input unless pivots are chosen carefully; heap sort matches merge sort's worst-case O(n log n) guarantee while matching quicksort's O(1) (excluding recursion-free sift-down, which is iterative here) space — the best of both on paper. In practice heap sort tends to lose to quicksort on real-world data because of poor cache locality (sift-down jumps around the array via `2*i+1`/`2*i+2`, unlike quicksort's mostly-sequential partitioning), which is why quicksort (or hybrid introsort) remains the default in most standard libraries despite heap sort's cleaner worst-case bound. Heap sort is also **not stable** — equal elements can be reordered relative to each other, unlike merge sort.

## 6. Common Mistakes

- **Rebuilding the entire heap from scratch after every extraction** instead of sifting down just the swapped root — this turns the O(log n)-per-extraction step into an O(n)-per-extraction rebuild, degrading the whole algorithm from O(n log n) to O(n² log n) (or worse, O(n²) if the rebuild is done naively).
- **Off-by-one errors in the parent/child index formulas** — using `2*i` instead of `2*i + 1` for the left child, or forgetting the shrinking heap boundary `n` inside `sift_down`, silently comparing against already-sorted elements past the current heap boundary.
- **Sifting down the wrong index after the swap** — the newly placed root element (formerly `arr[end]`) is the only one that can violate the invariant; sifting from any other index wastes work or, worse, misses the actual violation.
- **Forgetting to shrink the heap size (`end`) on each iteration**, which lets sift-down treat already-finalized sorted elements as still part of the heap, corrupting the sorted suffix.
- **Assuming heap sort is stable.** Because sift-down can swap equal-valued elements past each other, heap sort does not preserve the relative order of equal elements — don't reach for it when stability is a requirement.

## 7. Interview Angle

Heap sort itself is rarely the direct ask ("implement heap sort" is uncommon compared to quicksort/mergesort), but it's a frequent *comparison* question: "name a sorting algorithm with guaranteed O(n log n) time and O(1) space" has heap sort as essentially the only correct answer among the standard comparison sorts. Interviewers may also probe whether you understand *why* build-heap is O(n) rather than the naive O(n log n) estimate — a good signal of genuinely understanding amortized analysis rather than having memorized a complexity table. Expect to be asked to trace build-heap and the extraction loop by hand on a small array, and to explain in one sentence why heap sort isn't stable while merge sort is.

## 8. Memory Hook

**"Build the max-heap once, then just keep swap-and-shrink-and-sift."** Root always holds the current max — swap it to the back (its final home), shrink the heap by one, sift the new root down. Two phases, one array, zero extra space: **build is O(n), n extractions at O(log n) each give O(n log n) overall.**
