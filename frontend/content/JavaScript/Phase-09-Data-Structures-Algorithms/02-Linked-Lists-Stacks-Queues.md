# Linked Lists, Stacks, and Queues — Complete Guide

## Table of Contents
1. [Why Linked Lists Exist](#1-why-linked-lists-exist)
2. [Singly Linked List Implementation](#2-singly-linked-list-implementation)
3. [Doubly Linked List Implementation](#3-doubly-linked-list-implementation)
4. [Stack Implementation](#4-stack-implementation)
5. [Queue Implementation](#5-queue-implementation)
6. [Use Cases Compared](#6-use-cases-compared)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Linked Lists Exist

A JS array is backed by contiguous-ish storage — great for O(1) random access, but expensive for inserting/removing at the front or middle (Phase 9, Lesson 1). A **linked list** trades away random access entirely in exchange for O(1) insertion and removal at any point you already have a reference to, because nodes don't need to shift — you just rewire pointers.

```
Array:  [ 10 | 20 | 30 | 40 ]      contiguous memory, index i = base + i*size
                                    insert at front → shift everything right

Linked List:  head
              │
              ▼
            ┌────┬───┐    ┌────┬───┐    ┌────┬───┐    ┌────┬──────┐
            │ 10 │ ●─┼───▶│ 20 │ ●─┼───▶│ 30 │ ●─┼───▶│ 40 │ null │
            └────┴───┘    └────┴───┘    └────┴───┘    └────┴──────┘
            each node lives independently in memory, linked by pointers
            insert at front → just create a node and point it at the old head
```

---

## 2. Singly Linked List Implementation

Each node holds a `value` and a `next` pointer to the following node (or `null` at the end). The list itself tracks only the `head` (and optionally a `tail` and `size` for O(1) length/append).

```js
class ListNode {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class SinglyLinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  // Add to the end — O(1) because we track `tail`
  append(value) {
    const node = new ListNode(value);
    if (!this.head) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.size++;
    return this;
  }

  // Add to the front — O(1), no shifting required (unlike Array.unshift)
  prepend(value) {
    const node = new ListNode(value);
    node.next = this.head;
    this.head = node;
    if (!this.tail) this.tail = node; // list was empty
    this.size++;
    return this;
  }

  // Find a node by value — O(n), must walk from head
  find(value) {
    let current = this.head;
    while (current) {
      if (current.value === value) return current;
      current = current.next;
    }
    return null;
  }

  // Remove the first node matching value — O(n) to find, O(1) to unlink
  remove(value) {
    if (!this.head) return false;

    if (this.head.value === value) {
      this.head = this.head.next;
      if (!this.head) this.tail = null; // list became empty
      this.size--;
      return true;
    }

    let prev = this.head;
    let current = this.head.next;
    while (current) {
      if (current.value === value) {
        prev.next = current.next;       // unlink: skip over `current`
        if (current === this.tail) this.tail = prev;
        this.size--;
        return true;
      }
      prev = current;
      current = current.next;
    }
    return false;
  }

  // Reverse the list in place — O(n) time, O(1) extra space
  reverse() {
    let prev = null;
    let current = this.head;
    this.tail = this.head;
    while (current) {
      const next = current.next; // save before we overwrite it
      current.next = prev;       // flip the pointer
      prev = current;
      current = next;
    }
    this.head = prev;
    return this;
  }

  toArray() {
    const out = [];
    let current = this.head;
    while (current) {
      out.push(current.value);
      current = current.next;
    }
    return out;
  }
}

const list = new SinglyLinkedList();
list.append(10).append(20).append(30);
list.prepend(5);
console.log(list.toArray()); // [5, 10, 20, 30]
list.reverse();
console.log(list.toArray()); // [30, 20, 10, 5]
```

### Field-by-Field Breakdown

```
ListNode
  value  ↳ the data payload — can be any type
  next   ↳ pointer to the next ListNode, or null at the tail

SinglyLinkedList
  head   ↳ entry point — all traversal starts here
  tail   ↳ cached reference to the last node, enabling O(1) append
           (without it, append would need to walk the whole list — O(n))
  size   ↳ cached count, avoiding an O(n) walk just to answer "how long?"
```

---

## 3. Doubly Linked List Implementation

A doubly linked list adds a `prev` pointer to each node, enabling O(1) traversal in both directions and O(1) removal of a node once you have a reference to it (no need to walk from head to find its predecessor).

```
              head                                    tail
               │                                       │
               ▼                                       ▼
       null ◀─┬────┬───▶  ◀─┬────┬───▶   ◀─┬────┬───▶  ┬────┬─▶ null
              │ 10 │ ●    ●│ 20 │ ●     ● │ 30 │ ●   ● │ 40 │
              └────┴───    ───┴────┴───   ───┴────┴───  ┴────┘
                prev/next both directions — walk forward OR backward
```

```js
class DoublyListNode {
  constructor(value) {
    this.value = value;
    this.next = null;
    this.prev = null;
  }
}

class DoublyLinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  append(value) {
    const node = new DoublyListNode(value);
    if (!this.tail) {
      this.head = this.tail = node;
    } else {
      node.prev = this.tail;
      this.tail.next = node;
      this.tail = node;
    }
    this.size++;
    return this;
  }

  // Remove a specific node reference in O(1) — no traversal needed
  // because the node already knows its own neighbors.
  removeNode(node) {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;         // node was the head

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;          // node was the tail

    node.next = node.prev = null; // detach fully to help garbage collection
    this.size--;
  }

  toArrayForward() {
    const out = [];
    let current = this.head;
    while (current) { out.push(current.value); current = current.next; }
    return out;
  }

  toArrayBackward() {
    const out = [];
    let current = this.tail;
    while (current) { out.push(current.value); current = current.prev; }
    return out;
  }
}

const dll = new DoublyLinkedList();
dll.append(1).append(2).append(3);
console.log(dll.toArrayForward());  // [1, 2, 3]
console.log(dll.toArrayBackward()); // [3, 2, 1]
```

The `prev` pointer is what makes `removeNode` O(1): given any node, you can splice it out without walking the list to find its predecessor. This is exactly why browser history (back/forward) and LRU caches are commonly built on doubly linked lists.

---

## 4. Stack Implementation

A stack is a **LIFO** (Last In, First Out) structure — think of a stack of plates: you add and remove from the top only.

```
push(4)        pop() → 4
   │                │
   ▼                ▼
┌─────┐         ┌─────┐
│  4  │  top     │  3  │  top
├─────┤         ├─────┤
│  3  │         │  2  │
├─────┤         ├─────┤
│  2  │         │  1  │
├─────┤         └─────┘
│  1  │
└─────┘
```

Arrays make an excellent stack because `push`/`pop` operate at the end — both O(1).

```js
class Stack {
  #items = []; // private field — encapsulation, no direct external access

  push(value) {
    this.#items.push(value); // O(1)
    return this;
  }

  pop() {
    return this.#items.pop(); // O(1), returns undefined if empty
  }

  peek() {
    return this.#items[this.#items.length - 1];
  }

  isEmpty() {
    return this.#items.length === 0;
  }

  get size() {
    return this.#items.length;
  }
}

// Classic use case: valid parentheses checking
function isValidParens(str) {
  const stack = new Stack();
  const pairs = { ")": "(", "]": "[", "}": "{" };

  for (const char of str) {
    if (char === "(" || char === "[" || char === "{") {
      stack.push(char);
    } else if (char in pairs) {
      if (stack.isEmpty() || stack.pop() !== pairs[char]) return false;
    }
  }
  return stack.isEmpty();
}

console.log(isValidParens("({[]})")); // true
console.log(isValidParens("({[)]}")); // false — mismatched
```

---

## 5. Queue Implementation

A queue is a **FIFO** (First In, First Out) structure — the first item added is the first one removed, like a checkout line.

```
enqueue(4)                    dequeue() → 1
front                back      front       back
  │                    │         │           │
  ▼                    ▼         ▼           ▼
┌───┬───┬───┬───┐              ┌───┬───┬───┐
│ 1 │ 2 │ 3 │ 4 │      ──▶     │ 2 │ 3 │ 4 │
└───┴───┴───┴───┘              └───┴───┴───┘
```

### The Naive (Slow) Approach

```js
// AVOID: Array.shift() is O(n) — every remaining element shifts left.
// Using this for a queue silently makes every dequeue O(n).
class SlowQueue {
  #items = [];
  enqueue(value) { this.#items.push(value); }      // O(1)
  dequeue() { return this.#items.shift(); }         // O(n) — the bug
}
```

### The Correct Approach: Linked-List-Backed Queue

```js
class QueueNode {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class Queue {
  #front = null;
  #back = null;
  #size = 0;

  enqueue(value) {
    const node = new QueueNode(value);
    if (!this.#back) {
      this.#front = this.#back = node;
    } else {
      this.#back.next = node;
      this.#back = node;
    }
    this.#size++;
    return this;
  }

  dequeue() {
    if (!this.#front) return undefined;
    const node = this.#front;
    this.#front = this.#front.next;
    if (!this.#front) this.#back = null; // queue became empty
    this.#size--;
    return node.value;
  }

  peek() {
    return this.#front ? this.#front.value : undefined;
  }

  get size() {
    return this.#size;
  }
}

const q = new Queue();
q.enqueue(1).enqueue(2).enqueue(3);
console.log(q.dequeue()); // 1
console.log(q.dequeue()); // 2
console.log(q.size);      // 1
```

Both `enqueue` and `dequeue` are true O(1) here because we track both `front` and `back` pointers — no shifting, no scanning.

---

## 6. Use Cases Compared

| Structure | Access Pattern | Real-World Use Cases |
|-----------|----------------|------------------------|
| Singly Linked List | Sequential, forward only | Building blocks for stacks/queues, memory-efficient sequences with frequent insert/remove at known positions |
| Doubly Linked List | Sequential, both directions | Browser back/forward history, LRU cache (evict from one end, promote at the other), undo/redo stacks |
| Stack (LIFO) | Add/remove from one end | Function call stack, undo functionality, expression/parentheses validation, DFS traversal (Lesson 3), the JS event loop's call stack itself |
| Queue (FIFO) | Add at back, remove from front | Task scheduling, print queues, BFS traversal (Lesson 3), request buffering, message queues (rate limiting, job processing) |

---

## 7. Hands-On Exercises

**Exercise 1:** Extend `SinglyLinkedList` with an `insertAt(index, value)` method and a `removeAt(index)` method, both O(n). Handle edge cases: inserting at index 0 (should behave like `prepend`), inserting at `size` (should behave like `append`), and out-of-bounds indices (throw or return `false`).

**Exercise 2:** Implement `hasCycle(list)` using Floyd's cycle detection (the "tortoise and hare" algorithm) — two pointers, one moving one node at a time and one moving two nodes at a time; if they ever meet, there's a cycle. Manually construct a linked list with a cycle (by pointing the last node's `next` back to an earlier node) to test it.

**Exercise 3:** Implement `Stack`-based `evaluatePostfix(expression)` that evaluates a postfix (Reverse Polish) arithmetic expression like `"3 4 + 2 *"` (should return `14`). Push operands; when you hit an operator, pop two operands, apply the operator, and push the result back.

**Exercise 4:** Implement a `CircularQueue` with a fixed capacity backed by a plain array and `front`/`rear` indices that wrap around using modulo arithmetic (`(index + 1) % capacity`), rather than the linked-list version. Add `isFull()` and `isEmpty()` checks, and explain in a comment why a naive fixed-array queue without wraparound would waste space after repeated enqueue/dequeue cycles.

**Exercise 5:** Implement an LRU (Least Recently Used) cache using a doubly linked list plus a `Map` for O(1) lookup: `get(key)` moves the accessed node to the front (most recently used) and returns its value; `put(key, value)` adds a new node at the front and evicts the node at the back if capacity is exceeded. This is the canonical real-world combination of Sections 3 and the hash maps covered in Lesson 4.

---

## 8. Interview Q&A

**Q: What is the fundamental trade-off between an array and a linked list?**
Answer: An array offers O(1) random access by index because elements sit in contiguous memory and the address of any element can be computed directly from its index, but inserting or removing anywhere except the end costs O(n) because every subsequent element must shift. A linked list gives up random access entirely — finding the k-th element requires walking from the head, O(n) — but insertion and removal are O(1) once you have a reference to the relevant node, because you only need to rewire a couple of pointers rather than move any other data. The choice depends on the dominant operation: frequent indexed reads favor arrays; frequent insert/remove at arbitrary points (especially the front, or given a node reference) favors linked lists.

**Q: Why does a doubly linked list support O(1) removal given a node reference, while a singly linked list does not?**
Answer: To remove a node, you need to update its predecessor's `next` pointer to skip over it. In a doubly linked list, every node stores a `prev` pointer, so given the node itself you immediately know its predecessor — O(1) removal. In a singly linked list, nodes only know their `next`, not their `prev`, so removing a given node still requires walking from the head to find the node right before it, which is O(n). This is precisely why structures like LRU caches, which need to promote and evict arbitrary nodes in O(1), are built on doubly linked lists rather than singly linked ones.

**Q: Why is using `Array.prototype.shift()` to implement a queue considered a performance anti-pattern?**
Answer: `shift()` removes the first element of an array, and because arrays are contiguous, every remaining element must be shifted one position to the left to fill the gap — an O(n) operation. If you use `shift()` for every `dequeue()` in a queue, what looks like a single O(1) queue operation is secretly O(n), and a loop that dequeues n items becomes O(n²) overall instead of the O(n) a proper queue should deliver. The fix is to back the queue with a linked list (tracking `front` and `back` pointers) or a circular buffer with index-based wraparound, both of which achieve true O(1) enqueue and dequeue.

**Q: How does the "tortoise and hare" (Floyd's) algorithm detect a cycle in a linked list, and why does it work?**
Answer: Two pointers start at the head: the slow pointer advances one node per step, the fast pointer advances two nodes per step. If the list has no cycle, the fast pointer reaches `null` and the loop ends without the pointers ever meeting. If the list does have a cycle, both pointers eventually enter the cycle, and because the fast pointer gains on the slow pointer by one node's distance every step (within a finite loop), it is mathematically guaranteed to eventually catch up to and meet the slow pointer — much like a faster runner lapping a slower one on a circular track. This detects cycles in O(n) time and O(1) space, compared to a hash-set approach that would use O(n) extra space to track visited nodes.

**Q: When would you choose a stack versus a queue to solve a traversal or scheduling problem?**
Answer: The choice comes down to whether you want depth-first or breadth-first behavior, or whether ordering matters as first-in-first-out versus last-in-first-out. A stack (LIFO) naturally implements depth-first traversal — you fully explore one branch before backtracking — and is the right tool for parsing/matching problems like balanced parentheses, undo functionality, and the call stack behind recursion itself. A queue (FIFO) naturally implements breadth-first traversal, processing items in the order they arrived, which is why it's used for level-order tree traversal, job/task scheduling, and any scenario where fairness (first come, first served) is a requirement, such as request handling or print queues.
