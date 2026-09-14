# Fast-Slow Pointers

## 1. Problem

Say you need to find the exact middle node of a linked list — maybe you're implementing merge sort for linked lists (split in half, recurse, merge), or you need to find the median of a running stream stored as a list. If you don't know the length ahead of time, the naive approach is to walk the whole list once to count its length, then walk it again to the halfway point. That's two passes.

The fast-slow pointer technique (also called the "tortoise and hare") gets you there in a single pass: one pointer moves at normal speed, one moves twice as fast, and when the fast one runs out of list, the slow one is sitting exactly at the middle. The same mechanism — one pointer moving twice as fast as another — is also the basis for detecting cycles in a linked list, covered in depth in **04-Cycle-Detection-Floyds-Algorithm**.

## 2. Analogy

Picture two runners on a straight track that has a finish line at some unknown distance. One runner (slow / "tortoise") jogs at a normal pace. The other (fast / "hare") sprints at exactly double that pace. Both start at the same point, at the same time.

By the time the hare crosses the finish line, the tortoise — having covered exactly half the distance in the same amount of time — is standing right at the midpoint. You never had to measure the track in advance; the relative speeds do the measuring for you.

## 3. Internal Flow

1. Start both `slow` and `fast` at `head`.
2. On each iteration, move `slow` forward by one node (`slow = slow.next`) and `fast` forward by two nodes (`fast = fast.next.next`).
3. Keep going as long as `fast` and `fast.next` are both not `None` — this guard is what prevents a crash when `fast` tries to jump two steps past the end of the list.
4. When the loop stops (because `fast` ran out of room), `slow` is at the middle. For an odd-length list, this is *the* middle. For an even-length list, this lands on the *second* of the two middle nodes (because `fast` reaching `None` — not just `fast.next` being `None` — is what ends the loop one iteration later, dragging `slow` one step further).
5. If you need the *first* of the two middles for an even-length list instead, change the loop condition to stop one iteration earlier, or use `fast.next and fast.next.next` as the condition instead.

## 4. Example

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

def find_middle(head):
    slow = head
    fast = head
    step = 0
    while fast and fast.next:
        print(f"step {step}: slow.val={slow.val}, fast.val={fast.val}")
        slow = slow.next
        fast = fast.next.next
        step += 1
    print(f"step {step} (final): slow.val={slow.val}, fast={'None' if fast is None else fast.val}")
    return slow

print("--- odd length list [1,2,3,4,5] ---")
head_odd = build_list([1, 2, 3, 4, 5])
mid = find_middle(head_odd)
print("middle value:", mid.val)

print()
print("--- even length list [1,2,3,4,5,6] ---")
head_even = build_list([1, 2, 3, 4, 5, 6])
mid2 = find_middle(head_even)
print("middle value (second of the two middles):", mid2.val)
```

Output:

```
--- odd length list [1,2,3,4,5] ---
step 0: slow.val=1, fast.val=1
step 1: slow.val=2, fast.val=3
step 2 (final): slow.val=3, fast=5
middle value: 3

--- even length list [1,2,3,4,5,6] ---
step 0: slow.val=1, fast.val=1
step 1: slow.val=2, fast.val=3
step 2: slow.val=3, fast.val=5
step 3 (final): slow.val=4, fast=None
middle value (second of the two middles): 4
```

For `[1,2,3,4,5]` (5 nodes), the loop runs while `fast` and `fast.next` exist. After 2 steps, `fast` sits at node `5` with `fast.next = None`, so the loop stops with `slow` at `3` — the true middle. For `[1,2,3,4,5,6]` (6 nodes), `fast` reaches `None` entirely (having stepped past node `6`), which takes one more iteration, dragging `slow` to `4` — the *second* of the two middle values (`3` and `4`).

## 5. Compare

- This is the same "two pointers moving at different rates" idea as **02-Fast-Slow-Pointers** shares its name with — but note the crucial difference from **01's** opposite-direction two pointers (from Phase 2): here both pointers start at the *same* end and move in the *same* direction, just at different speeds, rather than starting at opposite ends and converging.
- The identical fast/slow mechanics power **04-Cycle-Detection-Floyds-Algorithm**: instead of asking "where does fast run out of list," that lesson asks "does fast ever catch up to slow inside a loop" — same movement rule, different stopping question.
- Compare to counting the length first and then walking to `length // 2` — that's a correct but two-pass alternative; fast/slow gets you the same answer in one pass, which matters when you can't afford (or don't want) to traverse the list twice.

## 6. Common Mistakes

- Not deciding in advance which "middle" is wanted for an even-length list (first or second of the two) — the loop condition (`fast and fast.next` vs. `fast.next and fast.next.next`) determines which one you get, and getting this backward silently gives the wrong node in exactly half of all test cases (even-length ones).
- Advancing `fast` without checking `fast.next` first — writing `fast = fast.next.next` when `fast.next` is `None` crashes with an `AttributeError` on `None.next`. Always guard with `while fast and fast.next`.
- Forgetting the loop needs to check *both* `fast` and `fast.next` — checking only `fast` isn't enough, since `fast.next.next` still needs `fast.next` to exist.
- Assuming fast/slow only works for even-speed ratios of 2x — the technique generalizes (e.g. 3x for other problems), but 2x is what guarantees the "meet inside a cycle" property used in cycle detection, so don't casually change the ratio without re-deriving the guarantee.

## 7. Interview Angle

"Find the middle of a linked list in one pass" is a frequent standalone question, and it's also a building block interviewers expect you to reach for unprompted when solving bigger problems — e.g. "check if a linked list is a palindrome" (find middle, reverse second half, compare) or "reorder a list" (LeetCode 143: find middle, reverse second half, merge alternately). A common follow-up is exactly the even/odd middle ambiguity above — be ready to state which middle your implementation returns and why, and to adjust the loop condition on request. Another common follow-up: "can you do this without extra space?" — fast/slow already is O(1) extra space, which is usually the expected answer over "count then walk."

## 8. Memory Hook

"Hare goes two steps for every one the tortoise takes — when the hare hits the wall, the tortoise is standing in the middle of the room."
