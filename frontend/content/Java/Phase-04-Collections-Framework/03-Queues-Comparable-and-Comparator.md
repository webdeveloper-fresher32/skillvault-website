# 03 — Queues, Comparable, and Comparator

> A comprehensive reference covering `Queue`/`Deque`/`PriorityQueue`, and how to define custom ordering for your own classes with `Comparable` and `Comparator`.

---

## Table of Contents

1. [The Problem: Ordered Processing and Custom Sorting Rules](#1-the-problem-ordered-processing-and-custom-sorting-rules)
2. [The Analogy: A Coffee Shop Line and an ER Waiting Room](#2-the-analogy-a-coffee-shop-line-and-an-er-waiting-room)
3. [Queue, Deque, and PriorityQueue](#3-queue-deque-and-priorityqueue)
4. [Comparable: An Object's Own Natural Ordering](#4-comparable-an-objects-own-natural-ordering)
5. [Comparator: An External Ranking Rule](#5-comparator-an-external-ranking-rule)
6. [Code Example: Sorting Person Objects Two Different Ways](#6-code-example-sorting-person-objects-two-different-ways)
7. [Comparable vs Comparator: Where the Ordering Logic Lives](#7-comparable-vs-comparator-where-the-ordering-logic-lives)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Ordered Processing and Custom Sorting Rules

Some workflows aren't "grab any item" — they're inherently sequential. A print job queue should print documents in the order they were submitted. A task scheduler should always run the *most urgent* task next, regardless of when it was added. Modeling either of these with a plain `List` means writing your own "find and remove the first/most-urgent element" logic by hand, every time.

A related but separate problem: sorting. `Collections.sort()` and `list.sort()` (Lesson 1 briefly used the latter) need to know *how* to compare two elements of your own custom class — Java has no built-in idea of whether one `Person` is "greater than" another. And you often need more than one ordering for the same class: sort employees by salary in one report, by hire date in another, without rewriting the `Employee` class itself for each need.

The core problem: **some data needs strictly ordered processing (a queue), and any data made of custom objects needs an explicit, and sometimes more than one, definition of what "sorted" even means.**

---

## 2. The Analogy: A Coffee Shop Line and an ER Waiting Room

**Real-world analogy — `Queue`:** a coffee shop line is strictly first-come, first-served. Whoever joined the line first gets served first, full stop — arrival order is the entire ordering rule.

**Real-world analogy — `PriorityQueue`:** an emergency room waiting area works completely differently. The patient who arrived three hours ago with a sprained ankle does *not* get seen before someone who just walked in having a heart attack. The room's "next" rule is priority (urgency), not arrival order.

**Real-world analogy — `Comparable` vs `Comparator`:** `Comparable` is a person's own driver's license stating their date of birth — an intrinsic fact about them, baked in, that any system can consult to rank people by age. A `Comparator` is a separate, external referee who can rank the exact same group of people by a completely different rule — height, alphabetically by last name, whatever the referee is instructed to check — without touching anything about the people themselves.

---

## 3. Queue, Deque, and PriorityQueue

`Queue<T>` is an interface describing "process in some defined order, one at a time," with methods deliberately named differently from `List`'s to signal they behave slightly differently at the edges — instead of throwing an exception on an empty queue, the queue-style methods return a sentinel value (`null` or `false`):

- `offer(element)` — adds an element, returns `false` if it couldn't be added (rare for unbounded queues).
- `poll()` — removes and returns the head element, or `null` if the queue is empty.
- `peek()` — returns the head element without removing it, or `null` if empty.

`Deque<T>` ("deck," short for **d**ouble-**e**nded **queue**) extends this idea to both ends — you can offer/poll/peek from either the front or the back (`offerFirst`/`offerLast`, `pollFirst`/`pollLast`, etc.), which makes a `Deque` usable as a queue, a stack, or both. `LinkedList` implements both `List` and `Deque`, so it can back a `Queue`. `ArrayDeque` is a resizable-array-backed `Deque` implementation that's generally faster than `LinkedList` for pure queue/stack use, since — as in Lesson 1 — contiguous array memory beats scattered linked nodes for most access patterns.

`PriorityQueue<T>` is a different beast entirely: instead of first-in-first-out, it always keeps the **smallest** element (by natural ordering, or a supplied `Comparator`) at the head, ready to `poll()` next — internally backed by a binary heap, a tree-shaped structure kept partially sorted just enough to always know its smallest element cheaply. Elements come out in ascending order regardless of the order they were added in:

```java
import java.util.PriorityQueue;

PriorityQueue<Integer> pq = new PriorityQueue<>();
pq.offer(5);
pq.offer(1);
pq.offer(3);

System.out.println(pq.poll()); // 1 — smallest first, not insertion order
System.out.println(pq.poll()); // 3
System.out.println(pq.poll()); // 5
```

---

## 4. Comparable: An Object's Own Natural Ordering

A class implements `Comparable<T>` to declare its own **natural ordering** — a single, built-in answer to "how do two instances of this class rank against each other?" It requires implementing one method:

```java
public int compareTo(T other);
```

The contract: return a negative number if `this` should sort *before* `other`, a positive number if `this` should sort *after* `other`, and `0` if they're considered equal for ordering purposes. You rarely need to hand-compute the exact magnitude — `Integer.compare(a, b)`, `Double.compare(a, b)`, and `String`'s own `compareTo` all do the comparison correctly for you.

Once a class implements `Comparable`, `Collections.sort(list)` and `list.sort(null)` both know how to sort it, and it can go straight into a `TreeSet`/`TreeMap` (Lesson 2) or a `PriorityQueue` (above) without any extra configuration — all of them fall back to natural ordering when no `Comparator` is supplied.

---

## 5. Comparator: An External Ranking Rule

A `Comparator<T>` is a *separate* object describing a ranking rule for `T`, entirely independent of whether `T` implements `Comparable` at all. It requires implementing one method:

```java
public int compare(T a, T b);
```

The return-value contract is identical to `compareTo`'s. The key difference is *where the logic lives*: a `Comparator` is written and passed in from the outside, so the same class can be sorted in as many different ways as you have `Comparator`s for it, without ever touching the class itself.

Modern Java makes writing one-off `Comparator`s far shorter with `Comparator.comparing(...)`, which takes a method reference (Phase 6 covers method references in depth) extracting the field to sort by:

```java
Comparator<Person> byName = Comparator.comparing(Person::getName);
```

`.reversed()` flips any `Comparator` to descending order, and `.thenComparing(...)` chains a tie-breaker for when the first comparison considers two elements equal:

```java
Comparator<Person> byAgeDescThenName =
    Comparator.comparing(Person::getAge).reversed()
              .thenComparing(Person::getName);
```

---

## 6. Code Example: Sorting Person Objects Two Different Ways

```java
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

class Person implements Comparable<Person> {
    private String name;
    private int age;

    public Person(String name, int age) {
        this.name = name;
        this.age = age;
    }

    public String getName() { return name; }
    public int getAge() { return age; }

    @Override
    public int compareTo(Person other) {
        return Integer.compare(this.age, other.age); // natural ordering: by age
    }

    @Override
    public String toString() {
        return name + "(" + age + ")";
    }
}

public class SortDemo {
    public static void main(String[] args) {
        List<Person> people = new ArrayList<>();
        people.add(new Person("Charlie", 35));
        people.add(new Person("Alice", 30));
        people.add(new Person("Bob", 25));

        Collections.sort(people); // uses Person's compareTo -> sorts by age
        System.out.println(people); // [Bob(25), Alice(30), Charlie(35)]

        people.sort(Comparator.comparing(Person::getName)); // overrides with name order
        System.out.println(people); // [Alice(30), Bob(25), Charlie(35)]
    }
}
```

Tracing through this: `people` starts as `[Charlie(35), Alice(30), Bob(25)]` in insertion order. `Collections.sort(people)` uses `Person`'s `compareTo`, which compares by `age` — ascending order gives `Bob(25)`, `Alice(30)`, `Charlie(35)`. That's exactly what the first printed line shows.

Then `people.sort(Comparator.comparing(Person::getName))` re-sorts the *same* list using an entirely different rule — alphabetical by name — without changing `Person` at all. Alphabetically, `"Alice"` < `"Bob"` < `"Charlie"`, so the result is `Alice(30)`, `Bob(25)`, `Charlie(35)`. Notice the ages in that order — 30, 25, 35 — are *not* in ascending order at all: Bob (25) lands in the middle purely because "Bob" comes after "Alice" alphabetically, even though 25 is the smallest age in the list. That's the point — this second sort has no idea age even exists; it was only ever looking at `name`.

---

## 7. Comparable vs Comparator: Where the Ordering Logic Lives

| | **Comparable** | **Comparator** |
|---|---|---|
| **Where the logic lives** | Inside the class itself (`compareTo`) | In a separate object, outside the class |
| **How many orderings** | Exactly one — the "natural" ordering | As many as you want to write |
| **Requires modifying the class?** | Yes — the class must implement the interface | No — works with any class, even ones you don't own the source of |
| **Used automatically by** | `Collections.sort(list)`, `TreeSet`/`TreeMap`, `PriorityQueue` (with no `Comparator` supplied) | `list.sort(comparator)`, or explicitly passed to `TreeSet`/`TreeMap`/`PriorityQueue`'s constructor |

**Common mistakes:**
- Implementing `compareTo` inconsistently with `equals` — the general contract (documented on `Comparable`) is that `x.compareTo(y) == 0` should usually agree with `x.equals(y)`. Violating this is subtle: a `TreeSet` uses `compareTo` (not `equals`) to decide whether two elements are "the same" for deduplication purposes, so two objects that are `compareTo`-equal but `.equals()`-different can silently vanish into a single `TreeSet` slot, appearing to "lose" an element.
- Manually inverting a comparison (writing `return Integer.compare(b.getAge(), a.getAge());` to sort descending, or worse, hand-rolling `if`/`else` logic) instead of just calling `.reversed()` on an existing ascending `Comparator` — it's easy to get an inverted comparison subtly backwards, and `.reversed()` is both clearer and harder to get wrong.

**Interview angle:** "When would you use `Comparable` versus `Comparator`?" tests whether you understand that `Comparable` defines a single, intrinsic, natural ordering that lives inside the class, while `Comparator` lets you define any number of external, swappable orderings — including for classes you don't control the source code of at all (like sorting a `List<String>` by length instead of `String`'s own alphabetical `compareTo`).

---

## 8. Hands-On Exercises

### Exercise 1 — A FIFO task queue

Using a `Queue<String>` backed by `ArrayDeque`, `offer()` five task names in order, then `poll()` them one at a time, printing each, and confirm they come out in the same order they went in.

### Exercise 2 — A priority task queue

Create a small `Task` class with a `name` and an `int priority` (lower number = more urgent), implement `Comparable<Task>` comparing by priority, and push several `Task` objects into a `PriorityQueue<Task>` in random priority order. Poll them all and confirm they come out from most to least urgent.

### Exercise 3 — Three orderings, one class

Take the `Person` class from this lesson and, without modifying it, write three separate `Comparator<Person>` values: by name ascending, by age descending (using `.reversed()`), and by age ascending then name ascending as a tie-breaker (using `.thenComparing(...)`). Sort the same starting list with each and print all three results side by side.

---

## 9. Interview Q&A

### Q1. What's the difference between `poll()` and `remove()` on a `Queue` when the queue is empty?

**Answer:** `poll()` returns `null` if the queue is empty. `remove()` (inherited from `Collection`) throws `NoSuchElementException` instead. `poll()`/`peek()` are the "safe," queue-style methods; use them when an empty queue is a normal, expected case.

---

### Q2. How does a `PriorityQueue` decide what `poll()` returns next?

**Answer:** It always returns the smallest element according to natural ordering (`Comparable`) or a supplied `Comparator`, not the element that was added first — it's not FIFO. Internally it's backed by a binary heap that keeps the smallest element cheaply accessible at the head.

---

### Q3. Can a class use both `Comparable` and one or more `Comparator`s?

**Answer:** Yes, and it's common — `Comparable` defines the class's single natural ordering (used automatically by `Collections.sort(list)` with no arguments), while any number of separate `Comparator` objects can be passed explicitly to sort the same class by other fields, without changing the class.

---

### Q4. Why should `compareTo` generally be consistent with `equals`?

**Answer:** Several collections — most notably `TreeSet` and `TreeMap` — use `compareTo` (not `equals`) to determine whether two elements are considered duplicates. If `compareTo` returns `0` for two objects that aren't actually `.equals()`, a `TreeSet` will treat them as the same element and silently keep only one, which can look like a data-loss bug.

---

### Q5. What does `Comparator.comparing(Person::getAge).reversed()` do?

**Answer:** `Comparator.comparing(Person::getAge)` builds a `Comparator<Person>` that sorts ascending by age. Calling `.reversed()` on it returns a new `Comparator` that sorts descending by age instead, without needing to manually rewrite the comparison logic.

---

> 🧠 **Memory hook:** "A `Queue` is a coffee-shop line; a `PriorityQueue` is an ER waiting room; `Comparable` is your own ID card, `Comparator` is an outside referee with their own rulebook."
