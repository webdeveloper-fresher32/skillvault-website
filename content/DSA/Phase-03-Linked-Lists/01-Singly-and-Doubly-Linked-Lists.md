# Singly and Doubly Linked Lists

## 1. Problem

Imagine you're building a music player's "up next" queue. Songs get added to the front constantly (someone hits "play next"), removed from the middle occasionally (someone removes a song they no longer want), and the queue can grow to thousands of entries during a long session. If you stored this as an array, inserting a song at the front means shifting every other song one slot to the right — O(n) work for a single insert. Do that a few thousand times and your "instant" queue starts to lag.

A linked list solves this by giving up random access (no more `queue[500]` in O(1)) in exchange for O(1) insertion and deletion *at a position you already have a reference to* — no shifting required, because nodes aren't stored contiguously in memory; they're stored wherever, and connected by pointers. This is the foundational data structure behind the rest of this phase: every pattern (fast/slow pointers, reversal, cycle detection, merging) is built on top of the basic node-and-pointer mechanics covered here.

## 2. Analogy

Think of an array as a row of numbered parking spots — car #1 in spot 1, car #2 in spot 2, and so on. To insert a new car at the front, every other car has to shift over one spot. Painful.

A singly linked list is more like a scavenger hunt: each clue (node) tells you where to find the *next* clue, but nothing points backward. You can only walk forward, one clue at a time, and to insert a new clue at some point in the hunt, you just rewrite two arrows — no one else has to move.

A doubly linked list is the same scavenger hunt, except each clue also has a note on the back telling you where the *previous* clue was. Now you can walk the hunt in either direction, and when you remove a clue, you have two notes to fix (the one pointing forward into it, and the one pointing backward into it) instead of one.

## 3. Internal Flow

A singly linked list node holds two things: a value (`val`) and a reference to the next node (`next`), which is `None` if it's the last node. The list itself is just a reference to the first node (`head`) — everything else is reached by following `next` pointers.

**Insert at head** (O(1)):
1. Create a new node whose `next` points at the current `head`.
2. Make the new node the new `head`.

**Insert at tail** (O(n) for singly, unless you keep a `tail` reference):
1. Walk from `head` following `next` until you reach the last node (`curr.next is None`).
2. Set that last node's `next` to the new node.

**Delete a node by value** (O(n) to find it, O(1) to unlink once found):
1. If the node to delete is the `head` itself, just move `head` to `head.next`.
2. Otherwise, walk with two references — `prev` and `curr` — until `curr` is the node to delete.
3. Set `prev.next = curr.next`, which skips over `curr` entirely. `curr` is now unreachable and gets garbage collected.

A **doubly linked list** node adds a third field: `prev`, a reference to the previous node. This changes deletion: instead of needing a `prev` reference tracked manually during a walk, every node already knows its own predecessor. To delete a node:
1. Point the previous node's `next` at the deleted node's `next` (same as singly).
2. Point the next node's `prev` at the deleted node's `prev` (the new step doubly lists require).
3. If the deleted node was the head, update `head` to the deleted node's `next`.

Both of these neighbor updates matter — skip either one and you get a list that's broken in one direction while looking fine in the other.

## 4. Example

Singly linked list — insert at head, insert at tail, delete a node:

```python
class Node:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next

def insert_at_head(head, val):
    new_node = Node(val, next=head)
    return new_node

def insert_at_tail(head, val):
    new_node = Node(val)
    if head is None:
        return new_node
    curr = head
    while curr.next is not None:
        curr = curr.next
    curr.next = new_node
    return head

def delete_node(head, target_val):
    if head is None:
        return None
    if head.val == target_val:
        return head.next
    prev, curr = head, head.next
    while curr is not None:
        if curr.val == target_val:
            prev.next = curr.next
            return head
        prev, curr = curr, curr.next
    return head

def to_list(head):
    out = []
    curr = head
    while curr is not None:
        out.append(curr.val)
        curr = curr.next
    return out

head = None
head = insert_at_head(head, 3)
head = insert_at_head(head, 2)
head = insert_at_head(head, 1)
print("after inserting 1,2,3 at head one by one:", to_list(head))

head = insert_at_tail(head, 4)
print("after insert_at_tail(4):", to_list(head))

head = delete_node(head, 2)
print("after delete_node(2):", to_list(head))
```

Output:

```
after inserting 1,2,3 at head one by one: [1, 2, 3]
after insert_at_tail(4): [1, 2, 3, 4]
after delete_node(2): [1, 3, 4]
```

Notice: inserting `1`, then `2`, then `3` "at head" one at a time produces `[1, 2, 3]`, not `[3, 2, 1]` — because each insert makes its own value the new front, and since we inserted 3, then 2, then 1 in that order, `1` ends up frontmost.

Now the doubly linked list variant — insert at head and delete, with `prev` pointers actually maintained and used for a backward traversal:

```python
class DNode:
    def __init__(self, val, prev=None, next=None):
        self.val = val
        self.prev = prev
        self.next = next

def dll_insert_at_head(head, val):
    new_node = DNode(val, prev=None, next=head)
    if head is not None:
        head.prev = new_node
    return new_node

def dll_delete(head, target_val):
    curr = head
    while curr is not None:
        if curr.val == target_val:
            if curr.prev is not None:
                curr.prev.next = curr.next
            else:
                head = curr.next
            if curr.next is not None:
                curr.next.prev = curr.prev
            return head
        curr = curr.next
    return head

def dll_to_list(head):
    out = []
    curr = head
    while curr is not None:
        out.append(curr.val)
        curr = curr.next
    return out

def dll_to_list_backward(tail):
    out = []
    curr = tail
    while curr is not None:
        out.append(curr.val)
        curr = curr.prev
    return out

dhead = None
dhead = dll_insert_at_head(dhead, 30)
dhead = dll_insert_at_head(dhead, 20)
dhead = dll_insert_at_head(dhead, 10)
print("DLL after inserting 10,20,30 at head one by one (forward):", dll_to_list(dhead))

dtail = dhead
while dtail.next is not None:
    dtail = dtail.next
print("DLL backward traversal from tail using prev:", dll_to_list_backward(dtail))

dhead = dll_delete(dhead, 20)
print("DLL after deleting 20:", dll_to_list(dhead))
dtail = dhead
while dtail.next is not None:
    dtail = dtail.next
print("DLL backward traversal after delete:", dll_to_list_backward(dtail))
```

Output:

```
DLL after inserting 10,20,30 at head one by one (forward): [10, 20, 30]
DLL backward traversal from tail using prev: [30, 20, 10]
DLL after deleting 20: [10, 30]
DLL backward traversal after delete: [30, 10]
```

The backward traversal proves `prev` pointers are actually wired correctly both before and after the delete — after removing `20`, walking backward from the tail (`30`) via `.prev` correctly lands on `10`, skipping the deleted node in both directions.

## 5. Compare

- Arrays give O(1) random access but O(n) insert/delete at arbitrary positions (everything after the insertion point shifts). Linked lists flip this: O(n) to *reach* a position (no random access) but O(1) to insert/delete once you're there.
- A doubly linked list trades a little extra memory (one more pointer per node) for the ability to traverse backward and to delete a node in O(1) *if you already hold a reference to it* — no need to track a `prev` variable during a walk, since every node carries its own.
- Every subsequent lesson in this phase builds on the singly linked list node shown here: fast/slow pointers (**02**) and reversal (**03**) both operate purely on `next` pointers; cycle detection (**04**) reuses fast/slow; merging (**05**) reuses the head/insert mechanics from this lesson.

## 6. Common Mistakes

- Reassigning `curr.next` before saving a reference to the rest of the list — e.g. writing `curr.next = prev` before capturing `next_node = curr.next` — permanently loses access to everything after `curr`.
- In a doubly linked list, updating only one neighbor's pointer during a delete (e.g. fixing the previous node's `next` but forgetting the next node's `prev`) — the list looks correct walking forward but is broken walking backward.
- Forgetting to handle the head-deletion special case: if the node to delete *is* the head, there's no `prev` node to redirect, so you must reassign `head` itself.
- Losing the `tail` reference in a singly linked list and re-walking the entire list every time you need to append — correct, but silently turns your O(1) "amortized" appends into O(n) each.
- Comparing nodes with `==` when you mean identity (`is`) or vice versa — if `Node` doesn't define `__eq__`, `==` falls back to identity anyway, but relying on that by accident is a common source of confusion once value-based equality gets added later.

## 7. Interview Angle

Interviewers use linked lists as a warm-up to check you understand pointer manipulation before moving to harder patterns (reversal, cycle detection, merging — all later in this phase). Typical framing: "implement insert/delete for a singly linked list," "convert this to a doubly linked list," or "what's the time complexity of inserting into the middle of an array vs. a linked list, and why?" A common follow-up is to ask you to implement the same operation *without* a dummy/sentinel node and then *with* one, to see if you understand why sentinels simplify edge cases (more on this in **05-Merge-Patterns**). Another common ask: "how would you detect if two lists share a common tail node?" which tests whether you're thinking in terms of references, not values.

## 8. Memory Hook

"Array: fast to find, slow to insert. Linked list: slow to find, fast to insert — and doubly just means every node remembers who came before."
