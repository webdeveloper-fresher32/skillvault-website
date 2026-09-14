# LRU Cache

## Problem Statement

Design a data structure for a Least Recently Used (LRU) cache that supports two operations, both in **O(1)** time:

- `get(key)` — return the value associated with `key` if it exists in the cache, else return `-1`. Accessing a key counts as "using" it.
- `put(key, value)` — insert or update the value for `key`. If inserting a new key would exceed the cache's fixed `capacity`, evict the **least recently used** key first.

Example: with `capacity = 2`, after `put(1,1)`, `put(2,2)`, `get(1)` (returns 1, and 1 is now most-recently-used), `put(3,3)` evicts key `2` (the least recently used), not key `1`.

## Approach Discussion

Break the requirement into its two halves and notice that no single structure covers both:

- **O(1) lookup by key** — this is exactly what a hash map gives you (`DSA/Phase-05-Hashing/01-Hash-Maps-and-Sets.md`). Without it, finding whether a key exists and where its value lives would require an O(n) scan.
- **O(1) reordering to track recency, plus O(1) eviction of the least-recently-used item** — a hash map alone cannot do this; it has no notion of order. An array could track order but shifting elements to update recency is O(n). A **doubly linked list** (`DSA/Phase-03-Linked-Lists/01-Singly-and-Doubly-Linked-Lists.md`) solves this: moving a node to the front (mark as most-recently-used) or removing a node from anywhere (evict) is O(1) *if you already have a pointer to that node* — because a doubly linked list lets you unlink a node using only its own `prev`/`next` pointers, with no need to traverse from the head to find its neighbors.

The combination is the key insight: the hash map stores `key → node reference`, giving O(1) access to *the exact node in the linked list* for any key, and the doubly linked list maintains recency order so the node at one end is always the least-recently-used and can be evicted in O(1). Neither structure alone satisfies both requirements — the hash map has no order, and a linked list alone has no O(1) key lookup (finding a node by key would require a linear scan). Two sentinel (dummy) head/tail nodes remove edge-case branching when adding to an empty list or removing the only node.

On every `get` or `put` that touches an existing key, the node is unlinked from its current position and relinked at the front (most-recently-used end). On `put` for a new key that would exceed `capacity`, the node just before the tail sentinel (least-recently-used) is unlinked and its key removed from the hash map.

## Solution

```python
class Node:
    def __init__(self, key=0, value=0):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None


class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = {}  # key -> Node

        # Dummy head/tail sentinels. head.next is most-recently-used,
        # tail.prev is least-recently-used.
        self.head = Node()
        self.tail = Node()
        self.head.next = self.tail
        self.tail.prev = self.head

    def _remove(self, node):
        prev_node, next_node = node.prev, node.next
        prev_node.next = next_node
        next_node.prev = prev_node

    def _add_to_front(self, node):
        node.next = self.head.next
        node.prev = self.head
        self.head.next.prev = node
        self.head.next = node

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        node = self.cache[key]
        self._remove(node)
        self._add_to_front(node)
        return node.value

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            node = self.cache[key]
            node.value = value
            self._remove(node)
            self._add_to_front(node)
            return

        if len(self.cache) >= self.capacity:
            lru = self.tail.prev
            self._remove(lru)
            del self.cache[lru.key]

        node = Node(key, value)
        self.cache[key] = node
        self._add_to_front(node)


if __name__ == "__main__":
    cache = LRUCache(2)
    cache.put(1, 1)
    cache.put(2, 2)
    print(cache.get(1))    # returns 1
    cache.put(3, 3)        # evicts key 2
    print(cache.get(2))    # returns -1 (not found)
    cache.put(4, 4)        # evicts key 1
    print(cache.get(1))    # returns -1 (not found)
    print(cache.get(3))    # returns 3
    print(cache.get(4))    # returns 4
```

**Actual output when run:**

```
1
-1
-1
3
4
```

This matches the classic LeetCode 146 trace exactly: `get(1)` returns `1`, then `put(3,3)` evicts key `2` (least recently used at that point), so `get(2)` returns `-1`; `put(4,4)` then evicts key `1` (which was least recently used after `3` became more recent), so `get(1)` returns `-1`, while `get(3)` and `get(4)` both succeed.

## Complexity

- **Time**: O(1) for both `get` and `put`. Hash map lookup is O(1) average case; unlinking and relinking a node in a doubly linked list is O(1) since both operations only touch a constant number of `prev`/`next` pointers, regardless of list size.
- **Space**: O(capacity) — the hash map and linked list each hold at most `capacity` entries at any time.
