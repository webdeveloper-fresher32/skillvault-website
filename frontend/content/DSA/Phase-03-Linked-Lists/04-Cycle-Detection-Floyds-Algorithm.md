# Cycle Detection (Floyd's Algorithm)

## 1. Problem

Suppose a linked list got corrupted — maybe a bug in some insertion code accidentally made a node's `next` point back to an earlier node instead of forward, creating a loop. If you naively traverse this list looking for the end (`while curr is not None`), you'll never terminate; you'll just keep looping through the cycle forever. Before you can safely process a linked list you didn't build yourself (or one you're debugging), you often need to first ask: does this list even have an end? And if it loops, exactly where does the loop begin — which node is being pointed back to?

This is Floyd's cycle detection algorithm (also called the tortoise-and-hare algorithm), and it's a direct extension of the fast/slow pointer mechanics from **02-Fast-Slow-Pointers** — same movement rule, different question being asked of it.

## 2. Analogy

Picture a circular running track (as opposed to the straight track from the previous lesson). Two runners start at the same point: one jogs, one sprints at double speed. On a straight track, the sprinter just finishes and leaves — no meeting ever happens beyond the finish line. But on a *circular* track, the sprinter eventually laps the jogger — they're guaranteed to be standing on the same spot at the same time again, precisely because the sprinter is gaining ground every lap and the track wraps around.

That guaranteed meeting is the "there's a cycle" signal. And there's a second, less obvious fact about circular tracks: if you now walk one runner back to the starting line and have both runners move at the *same* (jogging) pace, they will meet again exactly at the point where the loop rejoins itself — the entrance to the circular part of the track.

## 3. Internal Flow

**Phase 1 — detect a cycle** (identical to finding the middle, but the stopping condition is different):

1. Start `slow` and `fast` both at `head`.
2. Move `slow` one step, `fast` two steps, each iteration, guarded by `while fast and fast.next`.
3. If at any point `slow is fast` (same node, not just same value), a cycle exists — this is the meeting point.
4. If the loop instead ends because `fast` or `fast.next` becomes `None`, there's no cycle — a real end was reached.

**Phase 2 — find where the cycle starts** (only run if phase 1 found a meeting point):

1. Leave one pointer (call it `ptr2`) at the meeting point found in phase 1.
2. Reset the other pointer (`ptr1`) back to `head`.
3. Move *both* pointers one step at a time (same speed now, not 2x).
4. The node where `ptr1` and `ptr2` meet again is the start of the cycle.

**Why resetting to head works (the math):** let the distance from `head` to the cycle's entrance be `a`, the distance from the entrance to the meeting point (going around the cycle) be `b`, and the remaining distance around the cycle back to the entrance be `c` (so the cycle length is `b + c`). By the time `slow` and `fast` meet in phase 1, `slow` has traveled `a + b`, and `fast` — moving twice as fast — has traveled `2(a + b)`. Fast also has covered some whole number of extra laps around the cycle, so `2(a + b) = a + b + k(b + c)` for some integer `k`, which simplifies to `a = k(b + c) - b`. Since `k(b+c)` is a whole number of laps, `a` is equivalent (mod cycle length) to `c` — the distance from the meeting point *forward* to the entrance. That's exactly why walking `ptr1` from `head` for `a` steps lands it at the entrance at the same time as walking `ptr2` from the meeting point for `c` steps (i.e. `a` steps, mod the cycle length) also lands at the entrance.

## 4. Example

```python
class Node:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next

def build_list_with_cycle(values, cycle_start_index=None):
    nodes = [Node(v) for v in values]
    for i in range(len(nodes) - 1):
        nodes[i].next = nodes[i + 1]
    if cycle_start_index is not None:
        nodes[-1].next = nodes[cycle_start_index]
    return nodes[0] if nodes else None

def detect_cycle(head):
    slow = head
    fast = head
    step = 0
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        print(f"step {step}: slow.val={slow.val}, fast.val={fast.val}")
        if slow is fast:
            print(f"  -> cycle detected: slow and fast met at value {slow.val}")
            return slow
        step += 1
    print("no cycle: fast reached the end")
    return None

def find_cycle_start(head):
    meeting_point = detect_cycle(head)
    if meeting_point is None:
        return None
    ptr1 = head
    ptr2 = meeting_point
    step = 0
    while ptr1 is not ptr2:
        print(f"phase2 step {step}: ptr1.val={ptr1.val}, ptr2.val={ptr2.val}")
        ptr1 = ptr1.next
        ptr2 = ptr2.next
        step += 1
    print(f"phase2 step {step} (final): ptr1.val={ptr1.val}, ptr2.val={ptr2.val} -> cycle starts here")
    return ptr1

print("--- list [1,2,3,4,5] with cycle back to index 2 (value 3) ---")
head = build_list_with_cycle([1, 2, 3, 4, 5], cycle_start_index=2)
start = find_cycle_start(head)
print("cycle start value:", start.val)

print()
print("--- list [1,2,3] with no cycle ---")
head2 = build_list_with_cycle([1, 2, 3])
result2 = find_cycle_start(head2)
print("cycle start:", result2)
```

Output:

```
--- list [1,2,3,4,5] with cycle back to index 2 (value 3) ---
step 0: slow.val=2, fast.val=3
step 1: slow.val=3, fast.val=5
step 2: slow.val=4, fast.val=4
  -> cycle detected: slow and fast met at value 4
phase2 step 0: ptr1.val=1, ptr2.val=4
phase2 step 1: ptr1.val=2, ptr2.val=5
phase2 step 2 (final): ptr1.val=3, ptr2.val=3 -> cycle starts here
cycle start value: 3

--- list [1,2,3] with no cycle ---
step 0: slow.val=2, fast.val=3
no cycle: fast reached the end
cycle start: None
```

For `[1,2,3,4,5]` with node `5`'s `next` pointing back to node `3` (index 2), phase 1 finds `slow` and `fast` meeting at value `4` after 3 steps. Phase 2 then resets `ptr1` to `head` (value `1`) and walks both pointers one step at a time from there; they meet at value `3` after 3 steps — correctly identifying `3` as the entrance to the cycle, matching how the list was constructed. For `[1,2,3]` with no cycle, `fast` reaches `None` (past node `3`) after one step, and `detect_cycle` correctly reports no cycle without ever risking an infinite loop.

## 5. Compare

- Phase 1 here is exactly the fast/slow loop from **02-Fast-Slow-Pointers**, just asking "do they ever collide?" instead of "where does fast run out of room?" — same code shape, different question, different stopping condition.
- A hash-set-based alternative (store every visited node's identity in a `set`, stop when you see a repeat) also detects cycles and finds the start in one pass, using O(n) extra space; Floyd's algorithm gets the same answer in O(1) extra space at the cost of the two-phase walk — a classic space/time-vs-code-complexity tradeoff worth mentioning if asked "can you do it in O(1) space?"
- Compare to **05-Merge-Patterns**, where dummy-head bookkeeping is the "extra piece of state" that makes edge cases uniform — here, the "extra piece of state" is the second phase's reset-to-head walk, which similarly turns an easy-to-get-wrong edge case (finding the exact start) into a mechanical, repeatable procedure.

## 6. Common Mistakes

- Stopping after phase 1 and only reporting "yes, there's a cycle" without implementing phase 2 — many interview questions specifically ask for the cycle's *starting node*, not just a yes/no answer, and phase 2 is a completely separate walk that's easy to forget to add.
- Forgetting the `while fast and fast.next` guard (or writing just `while fast`) — without checking `fast.next` too, `fast.next.next` crashes on a list with no cycle once `fast` reaches the last node.
- Comparing values (`slow.val == fast.val`) instead of node identity (`slow is fast`) to detect the meeting — if two different nodes happen to hold equal values, value comparison gives a false positive.
- In phase 2, moving `ptr2` at double speed out of habit (carrying over the phase 1 speed) instead of the same speed as `ptr1` — phase 2 depends on both pointers moving at identical speed; getting this wrong breaks the meeting-point math derived above.
- Assuming an empty list or a single self-looping node needs special-case code — the same `while fast and fast.next` guard naturally handles `head is None` (loop body never runs) and a single node whose `next` is itself (loop finds `slow is fast` on the very first iteration).

## 7. Interview Angle

"Detect a cycle in a linked list" (LeetCode 141) is usually the opening ask, with "return the node where the cycle begins" (LeetCode 142) as the near-universal follow-up — treat these as one two-part question, not two independent ones, and be ready to explain *why* resetting to head works (the distance-relationship math above), since interviewers often push on the "why," not just "does the code work." Another common variant: "find the length of the cycle" (once you've found the start, walk forward from it, counting steps, until you return to it). Some interviewers also ask you to compare Floyd's algorithm to the hash-set approach and justify the tradeoff.

## 8. Memory Hook

"Same track, same starting line, same speed — reset one runner to the start, and the finish line for both is the cycle's front door."
