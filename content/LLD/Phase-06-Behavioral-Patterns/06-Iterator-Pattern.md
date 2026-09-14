# Iterator Pattern — Complete Guide

## Table of Contents
1. [The Problem Iterator Solves](#1-the-problem-iterator-solves)
2. [The Bad Example](#2-the-bad-example)
3. [The Good Example](#3-the-good-example)
4. [Real-World Tie-In](#4-real-world-tie-in)
5. [Complete Runnable Code](#5-complete-runnable-code)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem Iterator Solves

A `Playlist` stores songs internally as, say, a linked list of nodes (not a plain Python list) for O(1) insert/remove anywhere. If client code needs to know about `Node.next` pointers to loop over songs, the playlist's internal data structure leaks into every piece of client code — and if you later switch the internal storage to an array or a tree, every caller breaks.

```
Without Iterator:
  node = playlist.head
  while node is not None:
      print(node.song)
      node = node.next
  # client code depends directly on the internal Node/linked-list structure
```

**Iterator Pattern**: provide a way to access the elements of a collection sequentially without exposing its underlying representation, via a standard interface (`has_next()`/`next()`, or Python's `__iter__`/`__next__`).

---

## 2. The Bad Example

```python
class Node:
    def __init__(self, song: str) -> None:
        self.song = song
        self.next: "Node | None" = None


class Playlist:
    def __init__(self) -> None:
        self.head: Node | None = None
        self.tail: Node | None = None

    def add(self, song: str) -> None:
        node = Node(song)
        if self.head is None:
            self.head = self.tail = node
        else:
            self.tail.next = node  # type: ignore[union-attr]
            self.tail = node


# client code -- has to know about Node/linked-list internals
playlist = Playlist()
playlist.add("Song A")
playlist.add("Song B")

node = playlist.head
while node is not None:
    print(node.song)
    node = node.next
```

Problems:
- Client code depends on `Node` and `.next` — a purely internal implementation detail.
- Can't use `for song in playlist` — the natural, idiomatic Python loop.
- Switching `Playlist`'s internal storage (e.g. to a `deque` or array) breaks every caller.
- No way to have two independent traversals over the same playlist at once (two `while` loops would need two separate `node` variables managed by the *caller*).

---

## 3. The Good Example

```
┌───────────────┐        ┌────────────────────┐
│   Playlist    │───────▶│  «interface»        │
│ (Aggregate)   │creates │      Iterator         │
│ +__iter__()    │        │ +__next__()           │
└───────────────┘        └────────────────────┘
                                    ▲
                          ┌──────────────────┐
                          │ PlaylistIterator  │
                          └──────────────────┘
```

`Playlist` exposes `__iter__()` which returns an iterator object; the iterator alone knows how to walk the internal nodes. Client code just writes `for song in playlist:` and never sees a `Node`.

---

## 4. Real-World Tie-In

Every Python `for` loop over a `list`, `dict`, `file object`, or generator relies on this exact protocol. Custom iterators are used for streaming large datasets (e.g. iterating over a huge log file or a paginated API response) without loading everything into memory at once — a database cursor or a `Queryset` in an ORM is a textbook Iterator.

---

## 5. Complete Runnable Code

```python
from __future__ import annotations
from typing import Iterator as TypingIterator


class Node:
    __slots__ = ("song", "next")

    def __init__(self, song: str) -> None:
        self.song = song
        self.next: "Node | None" = None


class PlaylistIterator:
    """Standalone iterator object -- holds its own traversal cursor."""

    def __init__(self, head: "Node | None") -> None:
        self._current = head

    def __iter__(self) -> "PlaylistIterator":
        return self

    def __next__(self) -> str:
        if self._current is None:
            raise StopIteration
        song = self._current.song
        self._current = self._current.next
        return song


class Playlist:
    """Aggregate: internal storage is a singly linked list, fully hidden from clients."""

    def __init__(self) -> None:
        self._head: Node | None = None
        self._tail: Node | None = None

    def add(self, song: str) -> None:
        node = Node(song)
        if self._head is None:
            self._head = self._tail = node
        else:
            self._tail.next = node  # type: ignore[union-attr]
            self._tail = node

    def __iter__(self) -> PlaylistIterator:
        """Return a FRESH iterator each time -- supports multiple independent loops."""
        return PlaylistIterator(self._head)


if __name__ == "__main__":
    playlist = Playlist()
    for song in ["Bohemian Rhapsody", "Hotel California", "Imagine"]:
        playlist.add(song)

    # idiomatic Python -- client never sees Node or .next
    for song in playlist:
        print(f"Now playing: {song}")

    # two independent traversals over the same playlist work correctly
    it1 = iter(playlist)
    it2 = iter(playlist)
    print(next(it1))  # Bohemian Rhapsody
    print(next(it1))  # Hotel California
    print(next(it2))  # Bohemian Rhapsody (it2 starts fresh, unaffected by it1)
```

Expected output:
```
Now playing: Bohemian Rhapsody
Now playing: Hotel California
Now playing: Imagine
Bohemian Rhapsody
Hotel California
Bohemian Rhapsody
```

---

## 6. When to Use / Trade-offs

**Use Iterator when:**
- You have a custom collection/data structure (linked list, tree, graph, paginated remote resource) and want clients to loop over it with `for x in collection` without knowing the internal layout.
- You need multiple independent traversals of the same collection simultaneously.
- You want to support lazy/streamed iteration over data too large to materialize as a list (a generator-based iterator only computes the next element when asked).

**Trade-offs:**
- For simple, already-list-backed collections, just returning `iter(self._items)` (delegating to the built-in list iterator) is enough — writing a custom iterator class is only worth it when the internal structure isn't already an iterable Python container.
- A hand-rolled iterator class (`__iter__`/`__next__`) is more verbose than a generator function (`yield`) that achieves the same protocol — prefer generators unless you need explicit iterator objects (e.g. supporting `.reset()` or peeking).
- Mutating a collection while iterating over it (adding/removing nodes mid-loop) is a classic bug source — document whether your iterator is fail-fast (raises on concurrent modification) or just undefined behavior.

| Aspect | Without Iterator | With Iterator |
|--------|-------------------|----------------|
| Client code | Must know internal `Node`/`.next` structure | `for x in collection` — internals fully hidden |
| Multiple simultaneous traversals | Caller manually manages multiple cursors | Each `iter(collection)` call returns an independent iterator |
| Swapping internal storage later | Breaks every caller | Zero impact on client code |

---

## 7. Interview Q&A

**Q: What problem does the Iterator pattern solve?**
Answer: It provides a uniform way to traverse a collection's elements sequentially without exposing how the collection is stored internally (array, linked list, tree, hash map). The collection (aggregate) exposes a method that returns an iterator object; the iterator alone knows how to move from one element to the next, so client code is decoupled from the internal representation and can be swapped out freely.

**Q: What is Python's iterator protocol, precisely?**
Answer: An **iterable** is any object implementing `__iter__(self)` that returns an **iterator**. An **iterator** implements both `__iter__(self)` (returning itself) and `__next__(self)` (returning the next element or raising `StopIteration` when exhausted). `for x in obj` desugars to calling `iter(obj)` once, then repeatedly calling `next()` on the result until `StopIteration` is raised.

**Q: What's the difference between an iterable and an iterator?**
Answer: An iterable can produce a *new* iterator every time you call `iter()` on it (e.g. a `list`, or the `Playlist` above) — so you can loop over it multiple times independently. An iterator is stateful — it holds a cursor and is exhausted after one full traversal; calling `iter()` on an iterator just returns itself. Confusing the two is why calling `next()` twice on "the same list" via two `for` loops works fine (two fresh iterators) but reusing one iterator object across two loops silently yields nothing the second time.

**Q: Implement the Iterator pattern from scratch for a binary tree in-order traversal, without recursion.**
Answer:
```python
class TreeNode:
    def __init__(self, value: int) -> None:
        self.value = value
        self.left: "TreeNode | None" = None
        self.right: "TreeNode | None" = None


class InOrderIterator:
    def __init__(self, root: "TreeNode | None") -> None:
        self._stack: list[TreeNode] = []
        self._push_left(root)

    def _push_left(self, node: "TreeNode | None") -> None:
        while node is not None:
            self._stack.append(node)
            node = node.left

    def __iter__(self) -> "InOrderIterator":
        return self

    def __next__(self) -> int:
        if not self._stack:
            raise StopIteration
        node = self._stack.pop()
        self._push_left(node.right)
        return node.value


root = TreeNode(2)
root.left, root.right = TreeNode(1), TreeNode(3)
print(list(InOrderIterator(root)))  # [1, 2, 3]
```

**Q: Could you implement the same Playlist iterator using a generator function instead of a class?**
Answer: Yes, and it's often simpler:
```python
class Playlist:
    def __init__(self) -> None:
        self._songs: list[str] = []

    def add(self, song: str) -> None:
        self._songs.append(song)

    def __iter__(self):
        for song in self._songs:
            yield song
```
`yield` automatically makes `__iter__` return a generator object that already satisfies the iterator protocol (`__next__` and `StopIteration` are handled for you). Use a full class-based iterator when you need extra state or methods beyond plain traversal (e.g. `peek()`, `reset()`, or supporting `__next__` calls interleaved with other operations).

**Q: What happens if you mutate a collection while iterating over it?**
Answer: It's undefined/dangerous unless explicitly handled. In Python, mutating a `list` while iterating (e.g. removing items) can skip elements or raise `RuntimeError` for dicts/sets ("dictionary changed size during iteration"). Well-designed custom iterators either snapshot the elements at iterator-creation time, or explicitly document and detect concurrent modification (e.g. tracking a version counter on the aggregate and raising if it changes mid-iteration, similar to Java's `ConcurrentModificationException`).
