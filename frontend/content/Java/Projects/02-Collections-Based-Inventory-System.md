# Project 02 — Collections-Based Inventory System

## Goal

Model a small store's inventory using the Collections Framework, practicing the `List`/`Map` implementation choices, core methods, and custom ordering (`Comparable`/`Comparator`) covered in Phase 4.

## What You'll Build

A console-driven inventory manager backed by a `List<Item>` of a custom `Item` class (name, quantity, price), supporting adding items, removing them by name, searching, and printing the inventory sorted in different ways on demand.

## Phases Required

- Phase 4 — Collections Framework
- Phase 2 — Object-Oriented Programming (for the `Item` class itself)

## Requirements

- Define an `Item` class with at least `name` (`String`), `quantity` (`int`), and `price` (`double`) fields, private with accessor methods (encapsulation from Phase 2).
- Store items in an `ArrayList<Item>` (justify in a comment why `ArrayList` rather than `LinkedList` is the right default here, per Phase 4 Lesson 1).
- Support: adding a new item, removing an item by name, searching for an item by name (`contains`-style lookup), and updating an existing item's quantity.
- Implement `Comparable<Item>` on `Item` for a sensible natural ordering (e.g. by name), and separately write at least two `Comparator<Item>` instances (e.g. by quantity ascending, by price descending) using `Comparator.comparing(...)` and `.reversed()`.
- Print the inventory sorted three different ways in one run: natural order, and each of your two `Comparator`s — using `Collections.sort(list)` for the first and `list.sort(comparator)` for the others, to show both call the same underlying mechanism the course covers.
- Use a `HashMap<String, Integer>` (or a second, faster lookup path) to demonstrate at least one place where map-based lookup by key is more appropriate than scanning the `List` linearly — e.g. a quick "does this item name already exist?" check.

## Suggested Approach

1. Write the `Item` class first, including `compareTo`, `equals`/`hashCode` if you plan to use it as a map key, and a `toString()` useful for printing.
2. Build the `ArrayList<Item>` and the add/remove/search operations against it, testing each one individually with a small hardcoded dataset before wiring up any menu.
3. Add the `HashMap<String, Integer>` name-to-quantity index alongside the list, and decide (and document in a comment) how you'll keep the two in sync whenever an item is added, removed, or updated.
4. Write your two `Comparator<Item>` fields using `Comparator.comparing(...)`, `.reversed()`, and optionally `.thenComparing(...)` for a tie-breaker.
5. Print the same inventory three times — natural order, then each `Comparator` — and manually verify the orderings differ the way you expect, the same way the course's `Person` sorting example does.
6. Wrap the whole thing in a simple loop-driven console menu (add / remove / search / print) if you want an interactive tool, or a fixed sequence of demo operations in `main` if you'd rather keep it non-interactive.

## Stretch Goals

- Add a `LinkedHashMap` variant of the name index and demonstrate that its iteration order differs from the plain `HashMap`'s, per Phase 4 Lesson 2.
- Add a low-stock alert: iterate the inventory and print any item below a configurable quantity threshold.
- Add a `TreeMap<String, Item>` view of the inventory and show that iterating it yields items in sorted key order automatically, with no explicit `sort` call needed.

## Evaluation Checklist

- [ ] `Item` correctly implements `Comparable<Item>` with a natural ordering you can explain.
- [ ] At least two distinct `Comparator<Item>` orderings are demonstrated on the same list, producing different printed results.
- [ ] Add/remove/search operations work correctly against a multi-item test dataset, including removing an item that doesn't exist (no crash).
- [ ] The `HashMap`-based lookup and the `ArrayList` stay consistent with each other after every add/remove.
- [ ] You can explain, in a code comment or README-free note, why `ArrayList` was chosen over `LinkedList` for the backing list.
