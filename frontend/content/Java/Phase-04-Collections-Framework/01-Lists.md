# 01 — Lists

> A comprehensive reference covering why plain arrays fall short, the `List` interface, `ArrayList` vs `LinkedList`, and how to choose between them.

---

## Table of Contents

1. [The Problem: Fixed-Size Arrays Can't Grow](#1-the-problem-fixed-size-arrays-cant-grow)
2. [The Analogy: An Expandable Row of Lockers](#2-the-analogy-an-expandable-row-of-lockers)
3. [The List Interface: ArrayList and LinkedList](#3-the-list-interface-arraylist-and-linkedlist)
4. [Code Example: Building and Iterating a List](#4-code-example-building-and-iterating-a-list)
5. [ArrayList vs LinkedList: Choosing the Right Implementation](#5-arraylist-vs-linkedlist-choosing-the-right-implementation)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Fixed-Size Arrays Can't Grow

Phase 3 covered plain arrays: `int[] scores = new int[5];` reserves exactly 5 slots, forever. That's fine when you know the exact count up front. But most real programs don't. A shopping cart might hold 1 item or 40. A list of search results might have 0 matches or 10,000. You don't know at compile time, and you often don't know even at the *start* of a method — items get added and removed as the program runs.

With a plain array, "I need one more slot" means: create a brand-new, bigger array, copy every existing element into it by hand, then discard the old one. Do that every time something is added, and you've written (and have to maintain) a resizing routine yourself, for every single collection of data in your program. Removing an item from the *middle* of an array is just as awkward — every element after it has to be shifted left by hand to close the gap.

The core problem: **arrays are a fixed-size container, but real programs need a container that grows and shrinks as data comes and goes, without the caller having to manage the resizing.**

---

## 2. The Analogy: An Expandable Row of Lockers

**Real-world analogy:** a plain array is a fixed row of lockers bolted to a wall — say, 5 of them. Once installed, that's it: no locker 6, no matter how badly you need one. If you need more storage, you have to tear the whole row out, install a bigger row, and manually move every item from the old lockers into the new ones yourself.

An `ArrayList` is a magical version of that same row of lockers: whenever you try to store something and there's no room left, it automatically extends the wall, bolts on more lockers behind the scenes, and moves your existing items over — all without you ever being involved. You just keep saying "store this" and "give me item #3," and the resizing is handled for you.

---

## 3. The List Interface: ArrayList and LinkedList

`List<T>` is an interface in the `java.util` package — a contract describing an **ordered**, **index-accessible**, **resizable** collection that can hold duplicates. It doesn't do anything by itself; you always create one of its concrete implementations. The two you'll reach for constantly are:

- **`ArrayList<T>`** — internally backed by a plain array that Java resizes automatically (typically by allocating a new array roughly 1.5x the size and copying elements over) whenever it fills up. Because the underlying storage is a contiguous array, accessing any element by index (`list.get(3)`) is a direct, constant-time jump to that memory slot.
- **`LinkedList<T>`** — internally a **doubly-linked list**: each element is a separate node holding a reference to the *previous* and *next* nodes, not a contiguous block of memory. Accessing `list.get(3)` means starting at one end and walking node-by-node until you reach the 4th one — there's no way to jump directly to it. But adding or removing an element right at the front or back of a `LinkedList` is very cheap, since it's just re-pointing a couple of node references, with no shifting of other elements required.

Both implement `List<T>`, so you can write code against the `List` interface and swap the concrete implementation later (Phase 12 revisits this as a design principle — "program to an interface, not an implementation").

Core `List` methods you'll use constantly:

- `add(element)` — appends to the end.
- `get(index)` — retrieves the element at that index (zero-based, same as arrays).
- `remove(index)` — removes the element at that index, shifting later elements to close the gap (for `ArrayList`).
- `size()` — the current number of elements (a method, not a field — unlike an array's `.length`).
- `contains(element)` — whether the list holds an element equal to this one.

The enhanced `for`-loop (`for-each`) works over any `List`, walking front to back without you managing an index at all:

```java
for (String name : names) {
    System.out.println(name);
}
```

---

## 4. Code Example: Building and Iterating a List

```java
import java.util.ArrayList;
import java.util.List;

public class ListDemo {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        names.add("Alice");
        names.add("Bob");
        names.add("Charlie");

        // Remove "Bob" by value (not by index)
        names.remove("Bob");

        System.out.println("Size after removal: " + names.size()); // 2

        for (String name : names) {
            System.out.println(name);
        }
    }
}
```

Tracing through this: `names` starts as `["Alice", "Bob", "Charlie"]` after the three `add` calls. `names.remove("Bob")` removes the *value* `"Bob"` — note `List` has an overloaded `remove(Object)` as well as `remove(int index)`; calling `remove("Bob")` matches the `Object` overload because `String` isn't `int`, so it searches for and removes the first element `.equals()` to `"Bob"`, leaving `["Alice", "Charlie"]`. `names.size()` is now `2`, and the loop prints:

```
Size after removal: 2
Alice
Charlie
```

A subtle trap worth calling out here: `names.remove(1)` (an `int` literal) would instead call the `remove(int index)` overload and remove whatever element sits at index 1 — which, on the original 3-element list, would also happen to remove `"Bob"`, but for a completely different reason (position, not value). If your list held `Integer` objects instead of `String`s, `remove(1)` would ambiguously *look* like it might mean "remove the value 1," but it still resolves to the `int` index overload — you'd need `remove(Integer.valueOf(1))` to remove the value `1` from an `Integer` list.

---

## 5. ArrayList vs LinkedList: Choosing the Right Implementation

| | **ArrayList** | **LinkedList** |
|---|---|---|
| **Backed by** | A resizable array | A doubly-linked chain of nodes |
| **Random access (`get(i)`)** | Fast — O(1), direct index into the array | Slow — O(n), must walk from an end |
| **Insert/remove at front or back** | Slower for the front (must shift every element), fast at the back (amortized O(1)) | Fast — O(1), just re-point a couple of node references |
| **Insert/remove in the middle** | O(n) — later elements shift | O(n) to *find* the position, then O(1) to actually splice it in |
| **Memory overhead per element** | Low — just the array slot | Higher — each node stores extra previous/next references |
| **When to prefer it** | The default choice for almost everything; especially anything read-heavy | Rare in practice — genuinely frequent insert/remove at the ends of a large list, or when also used as a `Queue`/`Deque` (Lesson 3) |

**Common mistakes:**
- Removing an element by index inside a plain `for` loop that also increments the index every iteration, and skipping the element that shifted into the just-vacated position — e.g. removing index `2` shifts what used to be index `3` back into index `2`, but the loop's next iteration jumps straight to index `3`, silently skipping it. Iterating backwards, using an `Iterator`'s own `remove()`, or collecting indices to remove first, all avoid this.
- Reaching for `LinkedList` "because it's supposedly better at insertion" without actually needing frequent middle-insertion — in practice, `ArrayList` is faster for the vast majority of real workloads (including many insertions), because contiguous-array access is far more CPU-cache-friendly than chasing node references scattered across memory. Default to `ArrayList` unless you have a specific, measured reason not to.

**Interview angle:** "When would you use a `LinkedList` over an `ArrayList`?" is a near-guaranteed question. The strong answer isn't "when I need to insert a lot" — it's that `ArrayList` should be your default, and `LinkedList` only wins in narrow cases (frequent addition/removal specifically at both ends of a large list, or when you want `Deque` behavior) — and even then, `ArrayDeque` (Lesson 3) usually beats `LinkedList` for pure queue/stack use.

---

## 6. Hands-On Exercises

### Exercise 1 — Build and shrink a list

Create an `ArrayList<Integer>` of the numbers 1 through 10. Remove every even number using an `Iterator`'s `remove()` method (research this method — it's the safe way to remove elements while iterating). Print the resulting list and confirm it contains only odd numbers.

### Exercise 2 — Time the difference

Write a small program that adds 100,000 elements to an `ArrayList<Integer>` and, separately, to a `LinkedList<Integer>`, timing each with `System.nanoTime()`. Then time 100,000 calls to `get(list.size() / 2)` (the middle element) on each. Observe which operation is faster on which implementation, and relate it back to the comparison table above.

### Exercise 3 — The index-shift bug, reproduced

Write a `List<String>` of 5 names. Write a plain `for` loop (`for (int i = 0; i < list.size(); i++)`) that removes every name starting with a particular letter by calling `list.remove(i)` inside the loop. Run it against a list deliberately containing two consecutive matching names, and confirm one of them survives unexpectedly — then fix the loop.

---

## 7. Interview Q&A

### Q1. What's the difference between `ArrayList` and `LinkedList`?

**Answer:** `ArrayList` is backed by a resizable array, giving fast O(1) random access by index but slower insertion/removal in the middle (elements must shift). `LinkedList` is a doubly-linked list of nodes, giving fast O(1) insertion/removal at the ends but slow O(n) random access, since it must walk node-by-node to reach a given position.

---

### Q2. Why is `ArrayList` usually the better default, even when you're doing a lot of insertions?

**Answer:** Contiguous array memory is far more CPU-cache-friendly than scattered linked-list nodes, so even operations `LinkedList` is theoretically good at often run faster in practice on `ArrayList` unless the list is large and insertions are specifically concentrated at the ends.

---

### Q3. What happens if you call `list.remove(1)` versus `list.remove(Integer.valueOf(1))` on a `List<Integer>`?

**Answer:** `remove(1)` with an `int` literal resolves to the `remove(int index)` overload and removes whatever element sits at index 1. `remove(Integer.valueOf(1))` passes an `Integer` object, resolving to the `remove(Object)` overload, which removes the first element *equal to the value* `1`, regardless of its position.

---

### Q4. Why can removing elements inside a plain `for` loop skip elements?

**Answer:** Removing an element shifts every later element one position to the left (for an `ArrayList`), including the element right after the one just removed. If the loop's index also increments on that same iteration, it jumps past the newly-shifted element without ever examining it.

---

### Q5. Is `List.length` valid?

**Answer:** No — `length` is a field on arrays (`array.length`), not a method. `List` has a `size()` method instead; calling `.length` or `.length()` on a `List` is a compile error.

---

> 🧠 **Memory hook:** "An array is a bolted-down row of lockers; an `ArrayList` bolts on more lockers for you; a `LinkedList` is a chain of lockers you can only reach by walking from one end."
