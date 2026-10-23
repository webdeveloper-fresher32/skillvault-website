# 01 — Design Principles and Common Pitfalls

> A comprehensive reference covering composition over inheritance, programming to an interface instead of a concrete implementation, and preferring immutability — three design habits that separate code that merely runs from code that stays maintainable.

---

## Table of Contents

1. [The Problem: Code That Merely Works Isn't Code That Lasts](#1-the-problem-code-that-merely-works-isnt-code-that-lasts)
2. [The Analogy: Modular Shelving vs a Carved Block of Wood](#2-the-analogy-modular-shelving-vs-a-carved-block-of-wood)
3. [Favor Composition Over Inheritance](#3-favor-composition-over-inheritance)
4. [Program to an Interface, Not an Implementation](#4-program-to-an-interface-not-an-implementation)
5. [Prefer Immutability Where Practical](#5-prefer-immutability-where-practical)
6. [Refactor Example: From Inheritance to Composition](#6-refactor-example-from-inheritance-to-composition)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Code That Merely Works Isn't Code That Lasts

Every lesson so far in this course has focused on getting Java code to compile and produce a correct result. That's a necessary skill, but it's not the same skill as writing code that's still easy to change six months from now — by someone else, or by you after you've forgotten every detail of how it works.

Code that "merely works" tends to accumulate specific, recognizable problems as a project grows:

- Classes that reach into each other's internals because "it was faster than doing it properly."
- Inheritance hierarchies built for convenience (`class ReportGenerator extends ArrayList<String>` just to get a free `.add()`), rather than because a genuine "is-a" relationship exists.
- Objects whose state can be quietly mutated from anywhere, making it impossible to reason locally about what a piece of code actually does.

None of this shows up as a compiler error. It shows up months later, as a bug that takes an afternoon to track down because three unrelated-looking classes turn out to share — and secretly corrupt — the same mutable list. The problem this lesson addresses: **how do you make design decisions today that keep the codebase changeable tomorrow, instead of accidentally locking it into a fragile shape?**

---

## 2. The Analogy: Modular Shelving vs a Carved Block of Wood

**Real-world analogy:** imagine furnishing a room two different ways. The first way: carve a single, beautiful shelving unit out of one solid block of wood, perfectly fitted to today's room. It looks great — until you need to add one more shelf, or move it to a smaller room, or replace just the bottom section because it warped. There's no way to do any of that without damaging or discarding the whole piece, because it was never built from separable parts.

The second way: buy a modular shelving system — separate cubes, brackets, and panels that snap together. Today you assemble it as a 3x3 grid. Next year you need one more row — you buy one more set of cubes and slot them in. One panel cracks — you replace that single panel, not the whole unit. Nothing about the design assumed it would stay exactly as originally assembled.

**The carved block is a class built around a rigid inheritance hierarchy. The modular shelving is a class built from composition — separate, swappable, independently replaceable objects wired together through a field.** Both can look identical the day they're built. The difference only shows up the first time something needs to change.

---

## 3. Favor Composition Over Inheritance

Phase 2 introduced inheritance (`class Employee extends Person`) as a way to model a genuine "is-a" relationship: an `Employee` really is a kind of `Person`, with everything a `Person` has, plus more. That's a legitimate use of inheritance, and nothing about this lesson contradicts it.

The pitfall is reaching for `extends` for a different reason entirely: to get free access to another class's methods, with no real "is-a" relationship backing it up. A classic example is extending `ArrayList<String>` just so a class inherits `.add()` and `.get()` for free, even though the class isn't conceptually "a kind of list" at all — it just happens to use one internally.

**Composition** is the alternative: instead of *becoming* the other class through `extends`, a class simply *holds a reference* to it as a field — a "has-a" relationship. A `ShoppingCart` doesn't need to *be* a `List<String>`; it just needs to *have* one, privately, and expose only the specific operations that make sense for a shopping cart (`addItem`, `totalPrice`) — not the entire public surface of `ArrayList` (`sort`, `subList`, `removeIf`, and dozens of other methods that were never part of the design).

Composition also sidesteps a deeper problem with inheritance: a subclass is tightly coupled to its superclass's *implementation*, not just its public contract. If the superclass's internal behavior changes in some future JDK version or library update, every subclass built on top of it can silently break in ways that are hard to trace. A class built from composition only depends on whatever public methods it explicitly calls — a much smaller, more stable surface area.

---

## 4. Program to an Interface, Not an Implementation

Phase 4 covered several concrete collection implementations — `ArrayList` and `LinkedList` both implement the `List` interface, and `HashMap`, `TreeMap`, and `LinkedHashMap` all implement `Map`. A recurring piece of advice from that phase applies here as a general design principle: **declare variables, fields, parameters, and return types using the interface type, not the concrete implementation type.**

Concretely, this means writing:

```java
List<String> names = new ArrayList<>();
```

instead of:

```java
ArrayList<String> names = new ArrayList<>();
```

The visible behavior of both lines is identical today. The difference appears the moment a design decision changes — say, this list turns out to need fast insertion at both ends instead of fast random access, and `LinkedList` (or `ArrayDeque`) becomes the better fit. With the field or variable typed as `List<String>`, swapping `new ArrayList<>()` for `new LinkedList<>()` is a one-line change. Every other line of code that calls `.add()`, `.get()`, or iterates over `names` keeps compiling and working exactly as before, because none of that code ever depended on which concrete implementation was behind the interface.

The same principle applies to method signatures: a method that accepts a `List<String>` parameter can be called with an `ArrayList`, a `LinkedList`, or any other `List` implementation a caller chooses — the method doesn't need to know or care. A method that insists on an `ArrayList<String>` parameter needlessly locks out every other valid implementation.

---

## 5. Prefer Immutability Where Practical

An **immutable** object is one whose state can never change after construction — every field is set once, in the constructor, and never reassigned afterward. Two examples already appeared earlier in this course without necessarily being framed as a *design choice*:

- Phase 3 covered that `String` is immutable — every "modifying" method like `.concat()` or `.trim()` returns a brand-new `String` rather than changing the original.
- Phase 10 covered that a `record`'s fields are implicitly `final` — a `record Point(int x, int y) {}` can never have its `x` or `y` silently changed after it's created.

Neither of those is an accident of language quirk — they reflect a deliberate design philosophy worth adopting in your own classes: **an object that cannot change after it's created cannot be corrupted, cannot be caught mid-modification by another piece of code, and — directly relevant to Phase 8 — cannot be the subject of a race condition.** Phase 8 showed that race conditions happen specifically because two threads try to read and modify the *same mutable state* at the same time without coordination. An immutable object has no mutable state after construction for two threads to race over in the first place — it's not that immutability makes concurrent access *safe by clever synchronization*, it's that there's nothing left to synchronize.

This doesn't mean every class should be immutable — a class explicitly modeling something that changes over time (an in-progress `ShoppingCart` being added to, a running counter) legitimately needs mutable state. The practical guideline is narrower: wherever an object's job is to represent a fixed value or fact (a coordinate, a money amount, a configuration snapshot), prefer making it immutable, and reserve mutability for objects whose entire purpose is to track something that changes.

---

## 6. Refactor Example: From Inheritance to Composition

Here's a small "before" class that makes both mistakes covered above at once: it inherits from a concrete class for no genuine "is-a" reason, and its field is typed to that same concrete class rather than an interface.

**Before — inheritance misused, and typed to a concrete implementation:**

```java
import java.util.ArrayList;
import java.util.Map;

// A ShoppingCart is not "a kind of" ArrayList — it just happens to use one
// internally. Extending ArrayList<String> exposes every ArrayList method
// (sort, subList, removeIf, clear, ...) as part of ShoppingCart's own public
// API, whether or not any of that makes sense for a shopping cart.
class ShoppingCart extends ArrayList<String> {

    public double totalPrice(Map<String, Double> priceLookup) {
        double total = 0.0;
        for (String item : this) {
            total += priceLookup.getOrDefault(item, 0.0);
        }
        return total;
    }
}
```

**After — composition, typed to the `List` interface:**

```java
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// ShoppingCart HAS a List of item names; it isn't a List itself.
class ShoppingCart {

    // Typed to the List interface, not the concrete ArrayList implementation —
    // the underlying implementation could later change to a LinkedList (or
    // anything else implementing List) with zero changes required anywhere
    // else in this class.
    private final List<String> items = new ArrayList<>();

    public void addItem(String item) {
        items.add(item);
    }

    public double totalPrice(Map<String, Double> priceLookup) {
        double total = 0.0;
        for (String item : items) {
            total += priceLookup.getOrDefault(item, 0.0);
        }
        return total;
    }
}
```

The rewritten `ShoppingCart` is easier to test — a unit test can construct one and call only `addItem`/`totalPrice`, the two operations that actually matter, instead of having to reason about every inherited `ArrayList` method a test might accidentally rely on. It's also easier to extend later: adding validation to `addItem` (rejecting a blank item name, say) is a one-line change inside the class, whereas the "before" version couldn't stop a caller from bypassing validation entirely by calling an inherited `.add()` directly.

---

## 7. Common Mistakes

- **Extending a class purely to reuse its methods when there's no genuine "is-a" relationship**, as in the "before" `ShoppingCart extends ArrayList<String>` example above — this creates a fragile hierarchy coupled to the superclass's implementation details, and leaks every one of its public methods into a class where most of them don't belong.
- **Exposing mutable internal state directly** — for example, adding a `getItems()` method to the "after" `ShoppingCart` that returns the internal `items` field by reference. Any caller could then call `.clear()` or `.add()` directly on that returned list, completely bypassing `addItem()` and silently corrupting the cart's invariants without the class ever knowing.

**Interview angle:** "How would you decide between inheritance and composition for two related classes?" is a common design-sense question. Interviewers are listening for whether you check for a genuine "is-a" relationship before reaching for `extends`, whether you mention that composition produces looser coupling to another class's implementation details, and whether you can explain *why* programming to an interface (`List` instead of `ArrayList`) makes a codebase easier to change later rather than reciting it as a rule with no reasoning behind it.

---

## 8. Hands-On Exercises

### Exercise 1 — Find and fix a misused inheritance relationship

Write a class `ReportBuilder` that extends `ArrayList<String>` (each element being one line of the report), with a method `printReport()` that prints every line. Notice which inherited `ArrayList` methods (`sort`, `removeIf`, `subList`, ...) now appear on `ReportBuilder` even though they were never part of the design. Rewrite it using composition — a private `List<String> lines` field typed to the `List` interface — exposing only `addLine(String)` and `printReport()`.

### Exercise 2 — Make a mutable class immutable

Take a simple mutable `Money` class with a non-final `amount` field and a `setAmount(double)` method. Rewrite it as an immutable class: make `amount` `final`, remove the setter, and add a method `withAmount(double newAmount)` that returns a *new* `Money` instance instead of modifying the existing one — mirroring how `String.concat()` returns a new `String` rather than modifying the original.

### Exercise 3 — Swap an implementation with zero call-site changes

Write a method that accepts a `List<Integer>` parameter and computes the sum of its elements. Call it once passing an `ArrayList<Integer>` and once passing a `LinkedList<Integer>` containing the same values, printing both sums. Confirm the method itself never needed to change, and never even mentions `ArrayList` or `LinkedList` by name.

---

## 9. Interview Q&A

### Q1. Why is "favor composition over inheritance" considered good design advice?

**Answer:** Inheritance creates a tight coupling between a subclass and its superclass's implementation details — if the superclass's internals change, subclasses can silently break. Inheritance should be reserved for genuine "is-a" relationships. Composition — holding a reference to another object as a field ("has-a") — only depends on that object's public methods, producing looser coupling and a smaller, more stable surface area to depend on.

### Q2. What does "program to an interface, not an implementation" mean in practice?

**Answer:** It means declaring variables, fields, and method parameters using an interface type (e.g. `List<String>`) rather than a concrete class (e.g. `ArrayList<String>`), even though you construct a specific implementation on the right-hand side of the assignment. This lets the concrete implementation be swapped later (e.g. `ArrayList` to `LinkedList`) without requiring any changes to code that only ever calls interface methods.

### Q3. Why does immutability matter for concurrency, beyond just "fewer bugs in general"?

**Answer:** Race conditions specifically require shared *mutable* state being read and modified by multiple threads without coordination. An immutable object's state is fixed after construction, so there is no mutable state left for two threads to race over — it removes an entire category of concurrency bug by construction rather than by careful synchronization.

### Q4. What's wrong with extending `ArrayList` to build a custom collection-like class?

**Answer:** It exposes every public method of `ArrayList` (`sort`, `removeIf`, `subList`, and more) as part of the new class's own API, whether or not any of them make sense for that class's purpose, and it ties the new class to `ArrayList`'s internal behavior. Composition — holding a `private List<T>` field and exposing only the specific operations the class actually needs — avoids both problems.

### Q5. Give an example of exposing mutable internal state that breaks encapsulation.

**Answer:** A class with a private `List<String> items` field that provides a `getItems()` method returning that same list object by reference. Any caller can then call `.add()` or `.clear()` directly on the returned reference, bypassing any validation the class's own methods perform and silently corrupting its internal state without the class having any way to detect or prevent it.

---

> 🧠 **Memory hook:** "Composition is modular shelving — swap a panel without rebuilding the unit. Inheritance carved from one block looks fine until the room changes shape."
