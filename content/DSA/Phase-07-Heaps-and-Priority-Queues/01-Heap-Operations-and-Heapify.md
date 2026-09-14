# Heap Operations and Heapify

## 1. Problem

Some problems only ever care about the *smallest* or *largest* remaining item, over and over, while new items keep arriving. "Give me the next task with the highest priority." "What's the cheapest unvisited node right now?" "What are the current top-3 scores?" You could keep the collection fully sorted at all times, but that means paying O(n log n) (or at least O(n) for an insert into a sorted array) every single time something changes, just to maintain an order you don't fully need — you only ever look at one end of it. You could instead scan the whole collection every time you need the min or max, which is O(n) per query and gets expensive fast if it happens repeatedly.

A **heap** is the data structure built for exactly this narrower need: give up full sorting, and in exchange get O(log n) insert and O(log n) removal-of-the-min-or-max, with O(1) to *peek* at the min/max at any time. It never promises anything about the order of the other elements — only that the root is guaranteed to be the smallest (or largest). That's a deliberately weaker guarantee than "fully sorted," and that weakness is exactly what makes it cheap to maintain.

## 2. Analogy

Think of a hospital emergency room's triage board. Patients aren't seen in the order they arrived — they're seen in order of severity. The nurse doesn't need a fully sorted waiting list ranked patient-by-patient; she only ever needs to know **who is most critical right now**. When a new patient arrives, they get slotted in relative to their severity without re-ranking everyone. When the most critical patient is taken in, the *next* most critical patient rises to the top — but the relative order of everyone else waiting is never fully pinned down until they themselves become the most urgent case. That's a heap: cheap to update, always correct about who's "next," but silent about the exact order of everyone else.

## 3. Internal Flow

**Array representation of a complete binary tree.** A heap is conceptually a binary tree, but it's stored as a flat array — no pointers, no nodes, no wasted space. The trick is that the tree is always a *complete* binary tree (every level fully filled except possibly the last, which fills left to right), so a node's position alone tells you where its parent and children live:

- Parent of index `i` → `(i - 1) // 2`
- Left child of index `i` → `2*i + 1`
- Right child of index `i` → `2*i + 2`

No pointers are ever stored; the index arithmetic *is* the tree structure.

**The heap invariant.** A **min-heap** requires every parent to be ≤ both of its children — this guarantees (by induction, since it holds at every level) that the smallest element in the whole structure sits at the root, index 0. A **max-heap** flips the inequality: every parent ≥ both children, and the root is the largest. Note this is a much weaker guarantee than a sorted array — a min-heap tells you nothing about whether the *left* child is smaller or larger than the *right* child, only that both are ≥ the parent.

**Sift-up (used on insert).** To insert, append the new element at the very end of the array (the next open leaf position — this keeps the tree complete). That new element might now violate the heap invariant relative to its parent, so **sift it up**: compare it to its parent; if it's smaller (min-heap) than the parent, swap them, then repeat the comparison one level higher. Stop when the element is ≥ its (new) parent, or it reaches the root. This touches at most one node per level, so it costs O(log n).

**Sift-down (used on extract-min/extract-max).** The root is where users always read from, so removing it is the "extract" operation. Naively removing index 0 would shift every other element — expensive. Instead: move the *last* element in the array into the now-empty root position (this preserves completeness), shrink the array by one, then **sift it down**: compare it to its two children, swap with whichever child is smaller (breaks the invariant less), and repeat at the new position. Stop when it's ≤ both children, or it reaches a leaf. Also O(log n), for the same reason — one comparison-and-swap per level, and there are only O(log n) levels in a complete binary tree of n elements.

**Python's `heapq` module.** Python only ships a **min-heap** — `heapq.heappush(heap, x)` and `heapq.heappop(heap)` operate directly on a plain list, doing the sift-up/sift-down internally. There is no built-in max-heap. The standard workaround: negate every value on the way in (`heapq.heappush(heap, -x)`) and negate again on the way out (`-heapq.heappop(heap)`) — this flips "smallest of the negated values" into "largest of the original values," turning the min-heap into a max-heap by a sign trick rather than by writing a second implementation.

## 4. Example

```python
import heapq

# --- Part 1: building a min-heap step by step with heapq ---
heap = []
values_to_insert = [5, 3, 8, 1, 9, 2]

for v in values_to_insert:
    heapq.heappush(heap, v)
    print(f"push {v:>2} -> heap array: {heap}")

print()
print("Root (smallest element):", heap[0])
print()

print("Popping in order:")
while heap:
    smallest = heapq.heappop(heap)
    print(f"pop -> {smallest:>2}, remaining heap array: {heap}")

print()
print("--- Part 2: max-heap via negation ---")
max_heap = []
for v in values_to_insert:
    heapq.heappush(max_heap, -v)
    print(f"push {v:>2} (stored as {-v:>3}) -> heap array: {max_heap}")

print()
print("Root negated back (largest element):", -max_heap[0])

print()
print("--- Part 3: manual sift-down trace for heapify ---")

def sift_down(arr, n, i):
    """Sift the element at index i down to restore the min-heap property,
    assuming both subtrees rooted at i's children are already valid heaps."""
    while True:
        smallest = i
        left = 2 * i + 1
        right = 2 * i + 2
        if left < n and arr[left] < arr[smallest]:
            smallest = left
        if right < n and arr[right] < arr[smallest]:
            smallest = right
        if smallest == i:
            break
        print(f"  swap index {i} (val={arr[i]}) with index {smallest} (val={arr[smallest]})")
        arr[i], arr[smallest] = arr[smallest], arr[i]
        i = smallest

def heapify(arr):
    n = len(arr)
    # Last non-leaf node is at index n//2 - 1
    for i in range(n // 2 - 1, -1, -1):
        print(f"sift-down starting at index {i} (val={arr[i]})")
        sift_down(arr, n, i)
        print(f"  array now: {arr}")

arr = [9, 4, 7, 1, 2, 6, 3]
print("Before heapify:", arr)
heapify(arr)
print("After heapify (valid min-heap array):", arr)
```

Executed output:

```
push  5 -> heap array: [5]
push  3 -> heap array: [3, 5]
push  8 -> heap array: [3, 5, 8]
push  1 -> heap array: [1, 3, 8, 5]
push  9 -> heap array: [1, 3, 8, 5, 9]
push  2 -> heap array: [1, 3, 2, 5, 9, 8]

Root (smallest element): 1

Popping in order:
pop ->  1, remaining heap array: [2, 3, 8, 5, 9]
pop ->  2, remaining heap array: [3, 5, 8, 9]
pop ->  3, remaining heap array: [5, 9, 8]
pop ->  5, remaining heap array: [8, 9]
pop ->  8, remaining heap array: [9]
pop ->  9, remaining heap array: []

--- Part 2: max-heap via negation ---
push  5 (stored as  -5) -> heap array: [-5]
push  3 (stored as  -3) -> heap array: [-5, -3]
push  8 (stored as  -8) -> heap array: [-8, -3, -5]
push  1 (stored as  -1) -> heap array: [-8, -3, -5, -1]
push  9 (stored as  -9) -> heap array: [-9, -8, -5, -1, -3]
push  2 (stored as  -2) -> heap array: [-9, -8, -5, -1, -3, -2]

Root negated back (largest element): 9

--- Part 3: manual sift-down trace for heapify ---
Before heapify: [9, 4, 7, 1, 2, 6, 3]
sift-down starting at index 2 (val=7)
  swap index 2 (val=7) with index 6 (val=3)
  array now: [9, 4, 3, 1, 2, 6, 7]
sift-down starting at index 1 (val=4)
  swap index 1 (val=4) with index 3 (val=1)
  array now: [9, 1, 3, 4, 2, 6, 7]
sift-down starting at index 0 (val=9)
  swap index 0 (val=9) with index 1 (val=1)
  swap index 1 (val=9) with index 4 (val=2)
  array now: [1, 2, 3, 4, 9, 6, 7]
After heapify (valid min-heap array): [1, 2, 3, 4, 9, 6, 7]
```

Notice that `heap.pop()` outputs come out in fully sorted order (1, 2, 3, 5, 8, 9) — that's a side effect of popping repeatedly, not a property of the heap array itself at any single moment. Look at the intermediate array after the first pop: `[2, 3, 8, 5, 9]` — that is *not* sorted (8 sits before 5 and 9), yet it is a perfectly valid min-heap, because only the parent/child relationship is guaranteed, not left-to-right order. The heapify trace tells the same story: after heapify, `[1, 2, 3, 4, 9, 6, 7]` satisfies the heap invariant at every parent/child pair, but 9 sitting before 6 and 7 shows the array as a whole is nowhere close to sorted.

## 5. Compare

A heap trades away the full ordering guarantee a sorted array or a balanced BST gives you, in exchange for cheaper maintenance: insert and extract-min/max are both O(log n) on a heap (versus O(n) to insert into a sorted array, or O(log n) on a balanced BST but with higher constant factors and pointer overhead). Where a BST supports arbitrary search, in-order traversal, and range queries, a heap supports none of that — it can only efficiently answer "what's currently the min/max," nothing about the k-th smallest or "is x present." That narrow contract is precisely what makes heaps the right structure for priority queues, and useful as a building block for heap sort, top-k problems, and k-way merges — anywhere the real question is repeatedly "give me the extreme value," not "keep everything ordered."

## 6. Common Mistakes

- **Forgetting `heapq` is min-heap only** and pushing raw values when a max-heap is actually needed — the root will silently be the smallest element instead of the largest, with no error to flag the mistake. Fix: negate on push and negate again on pop.
- **Assuming heap order means the array is fully sorted.** Only `heap[0]` is guaranteed to be the min (or max) — nothing is guaranteed about the relative order of any other two elements in the array, as the traces above show directly.
- **Mixing up sift-up and sift-down.** Sift-up runs from a newly appended leaf upward toward the root (used on insert); sift-down runs from the root downward toward the leaves (used on extract). Applying the wrong one after the wrong operation leaves the heap invariant broken.
- **Off-by-one errors in the index formulas** — writing `2*i` instead of `2*i + 1` for the left child, or forgetting the `- 1` in the parent formula `(i - 1) // 2`. These bugs don't crash; they quietly point at the wrong node and corrupt the heap invariant.
- **Negating a value twice (or not at all) inconsistently** in a max-heap-via-negation implementation — e.g. negating on push but forgetting to negate back on read, leaving callers with the wrong sign.

## 7. Interview Angle

Interviewers rarely ask you to implement a heap from scratch (that's `heapq`'s job) — they ask questions where recognizing "this needs a priority queue" is the actual skill being tested. Cues: "give me the k largest/smallest," "process items by priority, not arrival order," "repeatedly need the current min/max as the collection changes." Be ready to state the four operations and their costs from memory — insert O(log n), extract-min/max O(log n), peek-min/max O(1), and building a heap from n elements in one shot is O(n) (not O(n log n) — that's a genuinely surprising result worth knowing: bottom-up heapify does less total work than n individual inserts because most nodes are near the leaves and sift down only a short distance). Also expect to be asked "how would you get a max-heap out of `heapq`?" — the negation trick is a near-universal follow-up.

## 8. Memory Hook

**"Complete tree, flat array, index math instead of pointers."** Insert appends at the end and **sifts up** (new leaf rising to find its place); extract swaps the root with the last element, shrinks, and **sifts down** (that element sinking to find its place). `heapq` only ever gives you a min-heap — **negate to flip it into a max-heap**. And always remember: the heap only promises the *root*, never the rest of the order.
