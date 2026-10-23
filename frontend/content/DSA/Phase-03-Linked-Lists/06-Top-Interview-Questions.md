# Top Interview Questions — Linked Lists

Master these 15 essential interview problems covering Pointer Reversals, Fast & Slow Pointers (Floyd's Cycle Algorithm), Merging, In-Place Reordering, and Sentinel Dummy Nodes.

---

### Common Node Definition
All solutions assume the following standard singly linked list node structure:
```python
class ListNode:
    def __init__(self, val: int = 0, next: 'ListNode' = None):
        self.val = val
        self.next = next
```

---

### Problem 1: Reverse a Singly Linked List
**Difficulty: Easy | Pattern: Three-Pointer Iterative Reversal**

#### Problem Statement
Given the head of a singly linked list, reverse the list and return its reversed head. Implement both iterative and recursive solutions.

#### Python Solution
```python
def reverse_list_iterative(head: ListNode) -> ListNode:
    prev = None
    curr = head
    
    while curr:
        nxt = curr.next     # 1. Save next node
        curr.next = prev    # 2. Reverse pointer
        prev = curr         # 3. Advance prev
        curr = nxt          # 4. Advance curr
        
    return prev

def reverse_list_recursive(head: ListNode) -> ListNode:
    if not head or not head.next:
        return head
        
    new_head = reverse_list_recursive(head.next)
    head.next.next = head   # Repoint next node back to current node
    head.next = None        # Clear current node's next pointer
    return new_head
```

#### Complexity
- **Iterative:** Time $O(n)$, Space $O(1)$
- **Recursive:** Time $O(n)$, Space $O(n)$ call stack depth

---

### Problem 2: Linked List Cycle II (Find Start of Cycle)
**Difficulty: Medium | Pattern: Floyd's Tortoise & Hare with Mathematical Meeting Proof**

#### Problem Statement
Given the head of a linked list, return the node where the cycle begins. If there is no cycle, return `None`. Do not modify the linked list and use $O(1)$ extra space.

#### Mathematical Proof
- Let $L_1$ be distance from `head` to cycle start.
- Let $L_2$ be distance from cycle start to meeting point.
- Let $C$ be the circumference of the cycle.
- When `slow` and `fast` meet:
  - Distance of `slow` $= L_1 + L_2$
  - Distance of `fast` $= L_1 + L_2 + k \cdot C = 2(L_1 + L_2)$
  - Simplifying: $L_1 = k \cdot C - L_2 = (k - 1)C + (C - L_2)$.
- Therefore, if we place one pointer at `head` and keep one pointer at the meeting point, moving both 1 step at a time, they **must meet exactly at the cycle entrance**!

#### Python Solution
```python
def detect_cycle_start(head: ListNode) -> ListNode:
    slow = fast = head
    
    # Step 1: Detect if a cycle exists
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow == fast:
            break
    else:
        return None  # No cycle found
        
    # Step 2: Find cycle entrance
    pointer = head
    while pointer != slow:
        pointer = pointer.next
        slow = slow.next
        
    return pointer
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(1)$

---

### Problem 3: Merge Two Sorted Lists
**Difficulty: Easy | Pattern: Sentinel Dummy Head + Two Pointers**

#### Problem Statement
Merge two sorted linked lists and return it as a new sorted list. The new list should be made by splicing together the nodes of the first two lists.

#### Python Solution
```python
def merge_two_lists(l1: ListNode, l2: ListNode) -> ListNode:
    dummy = ListNode(-1)
    curr = dummy
    
    while l1 and l2:
        if l1.val <= l2.val:
            curr.next = l1
            l1 = l1.next
        else:
            curr.next = l2
            l2 = l2.next
        curr = curr.next
        
    # Attach remaining elements directly
    curr.next = l1 if l1 else l2
    return dummy.next
```

#### Complexity
- **Time:** $O(n + m)$
- **Space:** $O(1)$ auxiliary space

---

### Problem 4: Remove N-th Node From End of List
**Difficulty: Medium | Pattern: Fast/Slow Pointers with Gap of N**

#### Problem Statement
Given the head of a linked list, remove the $n$-th node from the end of the list and return its head in a single pass.

#### Python Solution
```python
def remove_nth_from_end(head: ListNode, n: int) -> ListNode:
    dummy = ListNode(0, head)
    fast = slow = dummy
    
    # Advance fast pointer by n + 1 steps to create the required window
    for _ in range(n + 1):
        fast = fast.next
        
    # Advance both until fast reaches the end
    while fast:
        fast = fast.next
        slow = slow.next
        
    # slow is now strictly before the target node to delete
    slow.next = slow.next.next
    return dummy.next
```

#### Complexity
- **Time:** $O(n)$ in exactly one pass.
- **Space:** $O(1)$

---

### Problem 5: Reorder List (Fold List: $L_0 \to L_n \to L_1 \to L_{n-1} \dots$)
**Difficulty: Medium | Pattern: Find Middle + Reverse Second Half + Alternating Merge**

#### Problem Statement
You are given the head of a singly linked list. Reorder the list so that nodes alternate from beginning and end: $L_0 \to L_n \to L_1 \to L_{n-1} \dots$ in-place without altering node values.

#### Python Solution
```python
def reorder_list(head: ListNode) -> None:
    if not head or not head.next:
        return
        
    # Step 1: Find middle using fast/slow pointers
    slow, fast = head, head
    while fast.next and fast.next.next:
        slow = slow.next
        fast = fast.next.next
        
    second = slow.next
    slow.next = None  # Sever first half from second half
    
    # Step 2: Reverse second half
    prev = None
    curr = second
    while curr:
        nxt = curr.next
        curr.next = prev
        prev = curr
        curr = nxt
    second = prev
    
    # Step 3: Interleave first and reversed second half
    first = head
    while second:
        tmp1, tmp2 = first.next, second.next
        first.next = second
        second.next = tmp1
        first, second = tmp1, tmp2
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(1)$ auxiliary space

---

### Problem 6: Intersection of Two Linked Lists
**Difficulty: Easy-Medium | Pattern: Pointer Alignment via Head Switching**

#### Problem Statement
Given the heads of two singly linked lists `headA` and `headB`, return the node at which the two lists intersect. If they do not intersect, return `None`. Solve in $O(n + m)$ time and $O(1)$ space.

#### Python Solution
```python
def get_intersection_node(headA: ListNode, headB: ListNode) -> ListNode:
    if not headA or not headB:
        return None
        
    pA, pB = headA, headB
    
    # When pA reaches end of list A, switch to headB.
    # When pB reaches end of list B, switch to headA.
    # Both pointers traverse exactly len(A) + len(B) steps, meeting at intersection or None.
    while pA != pB:
        pA = pA.next if pA else headB
        pB = pB.next if pB else headA
        
    return pA
```

#### Complexity
- **Time:** $O(n + m)$
- **Space:** $O(1)$

---

### Problem 7: Palindrome Linked List
**Difficulty: Easy-Medium | Pattern: Middle Finding + Half Reversal + In-Place Restoration**

#### Problem Statement
Given the head of a singly linked list, return `True` if it is a palindrome, or `False` otherwise in $O(n)$ time and $O(1)$ extra space.

#### Python Solution
```python
def is_palindrome_list(head: ListNode) -> bool:
    if not head or not head.next:
        return True
        
    # Step 1: Find middle node
    slow = fast = head
    while fast.next and fast.next.next:
        slow = slow.next
        fast = fast.next.next
        
    # Step 2: Reverse second half
    def reverse(node):
        prev = None
        while node:
            nxt = node.next
            node.next = prev
            prev = node
            node = nxt
        return prev

    second_head = reverse(slow.next)
    
    # Step 3: Check palindrome match
    p1, p2 = head, second_head
    is_pal = True
    while p2:
        if p1.val != p2.val:
            is_pal = False
            break
        p1 = p1.next
        p2 = p2.next
        
    # Step 4: Restore list structure (interview best practice)
    slow.next = reverse(second_head)
    return is_pal
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(1)$

---

### Problem 8: Add Two Numbers
**Difficulty: Medium | Pattern: Carry Simulation with Dummy Head**

#### Problem Statement
You are given two non-empty linked lists representing two non-negative integers stored in reverse order. Add the two numbers and return the sum as a linked list.

#### Python Solution
```python
def add_two_numbers(l1: ListNode, l2: ListNode) -> ListNode:
    dummy = ListNode(0)
    curr = dummy
    carry = 0
    
    while l1 or l2 or carry:
        val1 = l1.val if l1 else 0
        val2 = l2.val if l2 else 0
        
        total = val1 + val2 + carry
        carry = total // 10
        curr.next = ListNode(total % 10)
        curr = curr.next
        
        if l1: l1 = l1.next
        if l2: l2 = l2.next
        
    return dummy.next
```

#### Complexity
- **Time:** $O(\max(n, m))$
- **Space:** $O(\max(n, m))$ for result list.

---

### Problem 9: Copy List with Random Pointer
**Difficulty: Medium-Hard | Pattern: In-Place Node Interweaving without Hash Map**

#### Problem Statement
A linked list of length $n$ is given where each node contains an additional `random` pointer. Construct a deep copy of the list with $O(1)$ auxiliary space.

#### Node Definition
```python
class Node:
    def __init__(self, val: int, next: 'Node' = None, random: 'Node' = None):
        self.val = val
        self.next = next
        self.random = random
```

#### Python Solution
```python
def copy_random_list(head: 'Node') -> 'Node':
    if not head:
        return None
        
    # Step 1: Interweave copied nodes: A -> A' -> B -> B' -> ...
    curr = head
    while curr:
        copy = Node(curr.val, curr.next)
        curr.next = copy
        curr = copy.next
        
    # Step 2: Assign random pointers to copied nodes
    curr = head
    while curr:
        if curr.random:
            curr.next.random = curr.random.next
        curr = curr.next.next
        
    # Step 3: Separate original list and cloned list
    curr = head
    cloned_head = head.next
    while curr:
        copy = curr.next
        curr.next = copy.next
        if copy.next:
            copy.next = copy.next.next
        curr = curr.next
        
    return cloned_head
```

#### Complexity
- **Time:** $O(n)$ in 3 linear passes.
- **Space:** $O(1)$ auxiliary space (ignoring cloned nodes).

---

### Problem 10: Reverse Nodes in k-Group
**Difficulty: Hard | Pattern: Block Reversal with Lookahead Count**

#### Problem Statement
Given the head of a linked list, reverse the nodes of the list $k$ at a time, and return the modified list. If the number of nodes is not a multiple of $k$, the left-out nodes at the end should remain as-is. Solve with $O(1)$ extra space.

#### Python Solution
```python
def reverse_k_group(head: ListNode, k: int) -> ListNode:
    # Check if there are at least k nodes remaining
    curr = head
    count = 0
    while curr and count < k:
        curr = curr.next
        count += 1
        
    if count == k:
        # Reverse first k nodes
        prev = None
        curr = head
        for _ in range(k):
            nxt = curr.next
            curr.next = prev
            prev = curr
            curr = nxt
            
        # head is now the tail of reversed block; recurse on remaining list
        head.next = reverse_k_group(curr, k)
        return prev
        
    return head
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(n/k)$ recursion stack (or $O(1)$ if converted to fully iterative loop).

---

### Problem 11: Odd Even Linked List
**Difficulty: Medium | Pattern: Dual-Pointer Separation and Reconnection**

#### Problem Statement
Group all odd-indexed nodes together followed by even-indexed nodes. The relative order inside both groups must remain preserved. Must run in $O(1)$ extra space.

#### Python Solution
```python
def odd_even_list(head: ListNode) -> ListNode:
    if not head or not head.next:
        return head
        
    odd = head
    even = head.next
    even_head = even
    
    while even and even.next:
        odd.next = even.next
        odd = odd.next
        even.next = odd.next
        even = even.next
        
    odd.next = even_head
    return head
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(1)$

---

### Problem 12: Sort List ($O(n \log n)$ Merge Sort on Linked List)
**Difficulty: Medium-Hard | Pattern: Fast/Slow Split + Divide and Conquer Merge**

#### Problem Statement
Given the head of a linked list, return the list after sorting it in ascending order in $O(n \log n)$ time and $O(\log n)$ memory.

#### Python Solution
```python
def sort_list(head: ListNode) -> ListNode:
    if not head or not head.next:
        return head
        
    # Split list into two halves using slow/fast pointers
    prev = None
    slow, fast = head, head
    while fast and fast.next:
        prev = slow
        slow = slow.next
        fast = fast.next.next
        
    prev.next = None  # Break list into two halves
    
    left = sort_list(head)
    right = sort_list(slow)
    
    # Merge two sorted lists
    dummy = ListNode(0)
    curr = dummy
    while left and right:
        if left.val <= right.val:
            curr.next = left
            left = left.next
        else:
            curr.next = right
            right = right.next
        curr = curr.next
    curr.next = left or right
    
    return dummy.next
```

#### Complexity
- **Time:** $O(n \log n)$
- **Space:** $O(\log n)$ recursion stack.

---

### Problem 13: Remove Duplicates from Sorted List II
**Difficulty: Medium | Pattern: Sentinel Node + Duplicate Scanning**

#### Problem Statement
Given the head of a sorted linked list, delete all nodes that have duplicate numbers, leaving only distinct numbers from the original list.

#### Python Solution
```python
def delete_duplicates(head: ListNode) -> ListNode:
    dummy = ListNode(0, head)
    prev = dummy
    
    while head:
        # If current node has duplicates
        if head.next and head.val == head.next.val:
            # Skip all duplicate nodes
            while head.next and head.val == head.next.val:
                head = head.next
            # Sever duplicates: link prev to the node after duplicates
            prev.next = head.next
        else:
            prev = prev.next
        head = head.next
        
    return dummy.next
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(1)$

---

### Problem 14: Rotate List by K
**Difficulty: Medium | Pattern: Ring Transformation and Break**

#### Problem Statement
Given the head of a linked list, rotate the list to the right by `k` places.

#### Python Solution
```python
def rotate_right(head: ListNode, k: int) -> ListNode:
    if not head or not head.next or k == 0:
        return head
        
    # Step 1: Compute length and find old tail
    length = 1
    tail = head
    while tail.next:
        tail = tail.next
        length += 1
        
    k %= length
    if k == 0:
        return head
        
    # Step 2: Make it a circular ring
    tail.next = head
    
    # Step 3: Find new tail: (length - k) steps from head
    steps_to_new_tail = length - k
    new_tail = head
    for _ in range(steps_to_new_tail - 1):
        new_tail = new_tail.next
        
    new_head = new_tail.next
    new_tail.next = None  # Break the ring
    
    return new_head
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(1)$

---

### Problem 15: Flatten a Multilevel Doubly Linked List
**Difficulty: Medium | Pattern: Depth-First Pointer Splicing with Stack**

#### Problem Statement
You are given a doubly linked list where each node has a `child` pointer that may point to a separate doubly linked list. Flatten the list so that all nodes appear in a single-level doubly linked list (in depth-first order).

#### Python Solution
```python
class NodeD:
    def __init__(self, val, prev=None, next=None, child=None):
        self.val = val
        self.prev = prev
        self.next = next
        self.child = child

def flatten(head: 'NodeD') -> 'NodeD':
    if not head:
        return None
        
    curr = head
    while curr:
        if curr.child:
            nxt = curr.next
            child_tail = curr.child
            while child_tail.next:
                child_tail = child_tail.next
                
            # Connect curr to child
            curr.next = curr.child
            curr.child.prev = curr
            
            # Connect child_tail to nxt
            if nxt:
                child_tail.next = nxt
                nxt.prev = child_tail
                
            curr.child = None  # Clear child pointer
            
        curr = curr.next
        
    return head
```

#### Complexity
- **Time:** $O(n)$
- **Space:** $O(1)$
