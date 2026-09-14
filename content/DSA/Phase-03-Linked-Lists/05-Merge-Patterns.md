# Merge Patterns

## 1. Problem

You have two sorted linked lists — say, two sorted logs of timestamped events from two different servers — and you need to combine them into a single sorted list. Doing this with arrays would mean allocating a new array and copying values in sorted order, which is straightforward but costs extra space. With linked lists, you can merge by *re-wiring existing nodes* instead of copying values, so no new nodes need to be allocated at all — just pointers redirected.

This single building block — merge two sorted lists — is also the seed of a much bigger interview question: merging **k** sorted lists, which shows up in log aggregation, distributed sorted-run merging, and is a frequent "hard" interview problem.

## 2. Analogy

Picture two people each holding a stack of index cards, sorted smallest-to-largest, face up. To combine them into one sorted stack, you don't need to re-sort anything — you just compare the top card of each stack, take whichever is smaller, place it down, and repeat. Whoever's stack you *didn't* take from keeps their same top card for the next comparison; only the stack you took from reveals a new top card.

The subtlety worth noticing: you need somewhere to start placing cards down. If you try to remember "is this the very first card I'm placing?" for every single comparison, the bookkeeping gets messy. Instead, imagine you start with a blank placeholder card already on the table — that way, "placing the first real card" and "placing every card after it" become the exact same action (attach after the last card placed), no special case needed. That placeholder is the dummy-head technique.

## 3. Internal Flow

**Merging two sorted lists** with a dummy head:

1. Create a `dummy` node (value doesn't matter) and a `tail` pointer starting at `dummy`.
2. While both `l1` and `l2` still have nodes: compare `l1.val` and `l2.val`. Attach whichever is smaller (or equal — pick either consistently) to `tail.next`, then advance *that* list's pointer (`l1 = l1.next` or `l2 = l2.next`) and advance `tail` to the node just attached.
3. Once one list is exhausted, the other list (if anything remains) is already sorted — attach it wholesale to `tail.next`; no need to walk it node by node.
4. The merged list's real head is `dummy.next` (the dummy itself is discarded).

**Merging k sorted lists** builds on this in one of two ways:

- **Naive pairwise:** merge list 1 and list 2 using the two-list merge above, then merge that result with list 3, then with list 4, and so on. If there are `k` lists with a total of `n` nodes combined, each merge pass touches the growing merged list plus the next one — this ends up doing O(n·k) work in the worst case, since early nodes get re-touched by every subsequent merge.
- **Heap-based:** put the *head* node of each of the k lists into a min-heap keyed by value. Repeatedly pop the smallest, attach it to the result, and push that popped node's `next` (if it exists) back into the heap. This does O(n log k) work — each of the n nodes is pushed/popped once, and each heap operation costs O(log k) for a heap of size k. This is the standard "better" answer to the k-list merge question, and it's covered properly (heap mechanics, push/pop cost) in the later Heaps phase of this course — worth a forward-reference here since interviewers expect you to *name* this approach even before you've built a heap from scratch.

## 4. Example

Merging two sorted linked lists with a dummy head, tracing which list each value is pulled from:

```python
class Node:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next

def build_list(values):
    head = None
    tail = None
    for v in values:
        node = Node(v)
        if head is None:
            head = node
            tail = node
        else:
            tail.next = node
            tail = node
    return head

def to_list(head):
    out = []
    curr = head
    while curr is not None:
        out.append(curr.val)
        curr = curr.next
    return out

def merge_two_sorted(l1, l2):
    dummy = Node(0)
    tail = dummy
    step = 0
    while l1 is not None and l2 is not None:
        if l1.val <= l2.val:
            print(f"step {step}: pick from l1 (val={l1.val}) over l2 (val={l2.val})")
            tail.next = l1
            l1 = l1.next
        else:
            print(f"step {step}: pick from l2 (val={l2.val}) over l1 (val={l1.val})")
            tail.next = l2
            l2 = l2.next
        tail = tail.next
        step += 1
    remainder = l1 if l1 is not None else l2
    print(f"step {step}: one list exhausted, attach remainder starting at "
          f"{remainder.val if remainder else None}")
    tail.next = remainder
    return dummy.next

l1 = build_list([1, 3, 5, 7])
l2 = build_list([2, 4, 6])
print("l1:", to_list(build_list([1, 3, 5, 7])))
print("l2:", to_list(build_list([2, 4, 6])))
merged = merge_two_sorted(l1, l2)
print("merged:", to_list(merged))
```

Output:

```
l1: [1, 3, 5, 7]
l2: [2, 4, 6]
step 0: pick from l1 (val=1) over l2 (val=2)
step 1: pick from l2 (val=2) over l1 (val=3)
step 2: pick from l1 (val=3) over l2 (val=4)
step 3: pick from l2 (val=4) over l1 (val=5)
step 4: pick from l1 (val=5) over l2 (val=6)
step 5: pick from l2 (val=6) over l1 (val=7)
step 6: one list exhausted, attach remainder starting at 7
merged: [1, 2, 3, 4, 5, 6, 7]
```

The comparisons alternate between `l1` and `l2` at every step because the two lists happen to interleave perfectly (odds vs. evens). After 6 comparisons, `l2` is exhausted (its last value, `6`, was just taken), leaving `l1` with only `7` remaining — that remainder is attached in one shot (`tail.next = remainder`) rather than being walked node by node, since it's already sorted.

## 5. Compare

- The dummy-head technique here is the same "eliminate special-casing the first element" idea used implicitly in **03-Reversal-Patterns** for sublist reversal (a dummy node before `head` avoids special-casing `m == 1`).
- Merging two sorted lists is the merge step of merge sort — if you recursively split a list in half (using fast/slow pointers from **02** to find the middle), sort each half, and merge with this exact function, you get merge sort for linked lists, an O(n log n) sort that needs no extra array allocation.
- The heap-based k-way merge described above is a preview of the Heaps phase later in this course — come back to this lesson after that phase to actually implement it; for now, know the *shape* of the approach (push k heads, pop-and-repush) and its complexity (O(n log k)) even without the heap code itself.

## 6. Common Mistakes

- Not using a dummy head and instead trying to special-case "is this the first node of the result" on every comparison — this works but adds a branch and an extra variable (`result_head` vs. `tail`) that the dummy-head trick eliminates entirely.
- After picking a node from, say, `l1`, forgetting to advance `l1` itself (only advancing `tail`) — this leaves `l1` pointing at the same already-used node forever, causing the same value to be compared (and possibly re-attached) indefinitely, which is an infinite loop.
- Advancing the *wrong* list's pointer — e.g. advancing `l2` in the branch where you picked from `l1` — silently drops nodes from whichever list didn't get advanced and duplicates nodes from the one that did.
- Forgetting the leftover-list attachment at the end (`tail.next = remainder`) and instead trying to walk the remaining list node-by-node — functionally fine but unnecessary work, since the remaining list is already sorted and can be attached as a whole chunk.
- For k-way merge, defaulting to pairwise merging without recognizing (or being able to name) the heap-based alternative and its better complexity — interviewers frequently ask for the complexity comparison even if they don't require you to code the heap version on the spot.

## 7. Interview Angle

"Merge two sorted linked lists" (LeetCode 21) is an extremely common warm-up, mostly to check for clean dummy-head usage and correct pointer advancement. The natural, frequently-asked follow-up is "merge k sorted lists" (LeetCode 23) — expect to be asked to first state the naive pairwise approach and its complexity, then asked "can you do better?", which is your cue to describe the heap-based approach and its O(n log k) complexity. A less common but real follow-up: "merge two sorted **doubly** linked lists" — same logic, but remember to also wire up `prev` pointers on the merged result (tying back to **01-Singly-and-Doubly-Linked-Lists**).

## 8. Memory Hook

"Dummy head first, then it's just: compare, attach the smaller, advance *that* list, repeat — and whatever's left over is already sorted, so just bolt it on."
