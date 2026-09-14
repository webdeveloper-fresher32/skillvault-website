# Reversal Patterns

## 1. Problem

A classic requirement: reverse a linked list, either entirely (e.g. you built a history/undo stack by prepending events and now want them in chronological order) or partially (e.g. "reverse just the second half of this list" as a step in a palindrome check, or "reverse every group of k nodes" as in some LRU-cache-adjacent transformations). Because a linked list only exposes `next` pointers (no random access, no built-in `.reverse()`), reversing it means walking through and re-wiring every `next` pointer to point backward instead of forward — and doing this without ever losing your place in the list.

## 2. Analogy

Imagine a conga line where each person has their hand on the shoulder of the person in front. To reverse the line, you can't just announce "everyone turn around" — the "hand on shoulder" connections are what define the line's order, and someone has to physically walk down the line, un-clasping each hand and re-clasping it onto the *previous* person's shoulder instead. You have to grab the next person's shoulder-info *before* you break their current handhold, otherwise you lose track of who came next in the original line.

That's the essence of iterative reversal: before you rewire `curr.next` to point backward, you must first remember where it *used to* point, because after rewiring, that information is gone.

## 3. Internal Flow

**Full-list reversal**, using three pointers — `prev`, `curr`, `next_node`:

1. Start with `prev = None` and `curr = head`.
2. Before touching anything, save `next_node = curr.next` — this is the one piece of information you'd otherwise lose.
3. Rewire: `curr.next = prev` (point backward).
4. Slide the window forward: `prev = curr`, `curr = next_node`.
5. Repeat until `curr` is `None`. At that point, `prev` is the new head of the reversed list.

**Reversing a sublist between positions m and n** (1-indexed, inclusive) builds directly on the same three-pointer mechanic, with extra bookkeeping to reconnect the reversed segment back into the rest of the list:

1. Use a dummy node before `head` so that even "reverse starting at position 1" doesn't need special-casing.
2. Walk `m - 1` steps from the dummy to find `prev_m`, the node immediately *before* the segment to reverse.
3. Run the exact same three-pointer reversal loop as above, but only for `n - m + 1` steps, starting `curr` at `prev_m.next`.
4. After the loop, `prev_m.next` (still pointing at the *old* start of the segment, now the *tail* of the reversed segment) needs its `.next` set to `curr` (the node right after position `n`, which the loop naturally arrived at).
5. Finally, `prev_m.next` itself gets reassigned to `prev` (the new head of the reversed segment).

## 4. Example

Full iterative reversal, tracing `prev` / `curr` / `next` at every step:

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

def reverse_list(head):
    prev = None
    curr = head
    step = 0
    while curr is not None:
        next_node = curr.next
        print(f"step {step}: prev={prev.val if prev else None}, curr={curr.val}, next={next_node.val if next_node else None}")
        curr.next = prev
        prev = curr
        curr = next_node
        step += 1
    return prev

print("--- full reversal of [1,2,3,4,5] ---")
head = build_list([1, 2, 3, 4, 5])
new_head = reverse_list(head)
print("reversed list:", to_list(new_head))
```

Output:

```
--- full reversal of [1,2,3,4,5] ---
step 0: prev=None, curr=1, next=2
step 1: prev=1, curr=2, next=3
step 2: prev=2, curr=3, next=4
step 3: prev=3, curr=4, next=5
step 4: prev=4, curr=5, next=None
reversed list: [5, 4, 3, 2, 1]
```

Now the sublist-reversal variant — reverse only positions 2 through 4 (1-indexed) of `[1,2,3,4,5,6]`, leaving `1`, `5`, `6` untouched:

```python
def reverse_between(head, m, n):
    """Reverse the sublist from 1-indexed position m to n (inclusive)."""
    dummy = Node(0, next=head)
    prev_m = dummy
    for i in range(m - 1):
        prev_m = prev_m.next
    print(f"prev_m (node just before position m={m}): {prev_m.val}")

    curr = prev_m.next
    prev = None
    steps = n - m + 1
    for i in range(steps):
        next_node = curr.next
        print(f"  reversal step {i}: prev={prev.val if prev else None}, curr={curr.val}, next={next_node.val if next_node else None}")
        curr.next = prev
        prev = curr
        curr = next_node

    prev_m.next.next = curr
    prev_m.next = prev
    return dummy.next

print("--- reverse sublist m=2, n=4 of [1,2,3,4,5,6] ---")
head = build_list([1, 2, 3, 4, 5, 6])
result = reverse_between(head, 2, 4)
print("result list:", to_list(result))
```

Output:

```
--- reverse sublist m=2, n=4 of [1,2,3,4,5,6] ---
prev_m (node just before position m=2): 1
  reversal step 0: prev=None, curr=2, next=3
  reversal step 1: prev=2, curr=3, next=4
  reversal step 2: prev=3, curr=4, next=5
result list: [1, 4, 3, 2, 5, 6]
```

`prev_m` lands on node `1` (the node one before position 2). The inner loop reverses exactly 3 nodes (`2`, `3`, `4`), producing `4 -> 3 -> 2`. After the loop, `curr` has advanced to node `5` — that's what `prev_m.next.next` (the *old* front of the segment, node `2`, now the tail of the reversed piece) gets wired to, and `prev_m.next` is reassigned to `prev` (node `4`, the new front). Final list: `[1, 4, 3, 2, 5, 6]` — exactly the middle three reversed, both ends untouched.

## 5. Compare

- Reversal in groups of k (not coded here, left as a natural extension) is really the sublist-reversal logic applied repeatedly: reverse positions `1..k`, then `k+1..2k`, and so on, reconnecting each group to the next.
- Reversal pairs naturally with **02-Fast-Slow-Pointers**: many problems (palindrome check, reorder list) find the middle with fast/slow, then reverse the second half using exactly the three-pointer technique from this lesson.
- Compare to reversing an array in place with opposite-direction two pointers (Phase 2, **01-Two-Pointers**) — arrays can swap values directly because of random access; linked lists can't swap values in place nearly as cheaply, so instead they re-wire pointers, which is a fundamentally different (though related in spirit) operation.

## 6. Common Mistakes

- Writing `curr.next = prev` *before* saving `next_node = curr.next` — this overwrites the only reference to the rest of the list, permanently disconnecting everything after `curr`.
- Off-by-one on sublist bounds: walking `m` steps instead of `m - 1` to find `prev_m`, or running the reversal loop for `n - m` steps instead of `n - m + 1` — both stop one node early or late, either leaving a node out of the reversed segment or reversing one node too many.
- Forgetting to reconnect *both* ends of a reversed sublist — it's not enough to point `prev_m.next` at the new front; the old front (now the tail of the reversed piece) also needs its `.next` pointed at whatever came after position `n`.
- Returning `head` instead of `prev` after a full reversal — by the time the loop ends, `head` is the *last* node of the original list (the new tail), not the new head; the new head is `prev`.
- Not using a dummy node for sublist reversal when `m == 1` — without a dummy, reversing starting at the very first node requires special-casing the head update; a dummy node makes it uniform.

## 7. Interview Angle

"Reverse a linked list" (fully) is often the very first linked-list question asked, precisely because it's the simplest test of whether you can manipulate pointers without losing references — expect it to be asked both iteratively and recursively (the recursive version reverses on the way back up the call stack; ask if either is acceptable). "Reverse between positions m and n" (LeetCode 92) and "reverse in groups of k" (LeetCode 25) are natural, frequently-asked follow-ups that test whether you can generalize the three-pointer idea to a bounded segment instead of the whole list. A common trap question: "can you do it in one pass, without extra space?" — the iterative three-pointer approach already satisfies both, so know it cold rather than defaulting to a recursive-with-extra-stack-space answer.

## 8. Memory Hook

"Before you let go of curr's hand, grab next's hand first — prev, curr, next: save next, point curr back at prev, then slide the whole window forward."
