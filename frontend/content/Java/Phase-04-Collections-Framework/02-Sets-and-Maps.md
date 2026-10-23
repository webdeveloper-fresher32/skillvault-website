# 02 — Sets and Maps

> A comprehensive reference covering `Set` and `Map`, their `Hash`/`Tree`/`LinkedHash` variants, and how to choose between them.

---

## Table of Contents

1. [The Problem: No Duplicates, and Instant Lookup by Key](#1-the-problem-no-duplicates-and-instant-lookup-by-key)
2. [The Analogy: A Guest List and a Dictionary](#2-the-analogy-a-guest-list-and-a-dictionary)
3. [Set Implementations: HashSet, LinkedHashSet, and TreeSet](#3-set-implementations-hashset-linkedhashset-and-treeset)
4. [Map Implementations: HashMap, LinkedHashMap, and TreeMap](#4-map-implementations-hashmap-linkedhashmap-and-treemap)
5. [Code Example: Deduplicating Names and Counting Word Frequency](#5-code-example-deduplicating-names-and-counting-word-frequency)
6. [Choosing the Right Set or Map Implementation](#6-choosing-the-right-set-or-map-implementation)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: No Duplicates, and Instant Lookup by Key

Lesson 1's `List` is great at "an ordered sequence of things, accessed by position," but it models two very common needs badly:

- **"No duplicates allowed."** Nothing stops you from calling `list.add("Alice")` five times, ending up with five identical entries. If what you actually need is "the set of unique usernames who logged in today," a `List` forces you to write your own duplicate-checking logic (`if (!list.contains(x)) list.add(x);`) by hand, every time.
- **"Look this up instantly by something other than position."** Finding "the user whose email is `bob@example.com`" in a `List<User>` means scanning every element one by one — checking each user's email field until you find a match, or reach the end. That's O(n) work for every single lookup, no matter how large the list gets.

The core problem: **sometimes the right question isn't "what's at position 3?" but "is this value already present?" or "what value is associated with this specific key?" — and a `List` answers neither of those efficiently.**

---

## 2. The Analogy: A Guest List and a Dictionary

**Real-world analogy — `Set`:** think of a wedding guest list at the door. A name is either on it or it isn't — there's no such thing as "on the list twice." The bouncer doesn't care what order names were added in; they only care whether a given name is present, and they can check that in a glance because the list is organized for exactly that kind of lookup.

**Real-world analogy — `Map`:** think of a dictionary (the book, not the Java class). You don't find a word's definition by reading page 1, then page 2, then page 3 until you stumble on it — you jump straight to the word itself (the *key*) and read its definition (the *value*) right next to it. You never look things up "by page number" in a dictionary; you look them up by the word.

**A `Set` is the guest list. A `Map` is the dictionary.** Both are built around the same core mechanism under the hood — hashing — which is what makes "is this here?" and "what's the value for this key?" both close to instant, rather than a slow linear scan.

---

## 3. Set Implementations: HashSet, LinkedHashSet, and TreeSet

`Set<T>` is an interface describing a collection with **no duplicate elements** — adding an element already present (by `.equals()`) simply has no effect. Three implementations you'll meet constantly:

- **`HashSet<T>`** — the default choice. Backed by a hash table (conceptually, an array of "buckets" indexed by each element's `hashCode()`). Checking whether an element is present, or adding a new one, is O(1) on average. The trade-off: **iteration order is not predictable** and should never be relied on — it depends on internal hashing details, not insertion order.
- **`LinkedHashSet<T>`** — the same hashing mechanism as `HashSet`, but it *additionally* maintains a linked list threading through the elements in the order they were inserted. Iterating a `LinkedHashSet` always visits elements in insertion order, at a small extra memory/performance cost over `HashSet`.
- **`TreeSet<T>`** — backed by a self-balancing binary search tree (a red-black tree), keeping elements in **sorted order** at all times (natural ordering via `Comparable`, covered in Lesson 3, or a custom `Comparator`). Lookups are O(log n) — slower than `HashSet`'s O(1), but you get sorted iteration for free.

---

## 4. Map Implementations: HashMap, LinkedHashMap, and TreeMap

`Map<K, V>` is an interface describing key → value associations — every key maps to at most one value, and looking up a value by its key is the primary operation (note `Map` does *not* extend `Collection` — it's a separate interface, since its shape is fundamentally key-value pairs rather than a plain sequence of elements). The same three-way split applies:

- **`HashMap<K, V>`** — the default choice. O(1) average lookup/insertion by key, hashed the same way as `HashSet` (in fact, `HashSet` is implemented internally using a `HashMap` where every value is a shared dummy placeholder). No predictable iteration order.
- **`LinkedHashMap<K, V>`** — like `HashMap`, but preserves insertion order (or, optionally, access order) when iterating.
- **`TreeMap<K, V>`** — keeps entries sorted by key at all times, O(log n) operations, sorted iteration for free.

Core `Map` methods:

- `put(key, value)` — inserts or overwrites the value for a key.
- `get(key)` — returns the value for a key, or `null` if the key isn't present.
- `containsKey(key)` — whether a key is present, without risking a `null` mix-up (since `get` returning `null` could mean either "no key" or "key mapped to `null`").
- `getOrDefault(key, defaultValue)` — returns the value for a key if present, otherwise returns `defaultValue` without inserting it — extremely useful for counting patterns (see the code example below).

To iterate a `Map`'s entries together (key *and* value at once), use `.entrySet()`:

```java
for (Map.Entry<String, Integer> entry : counts.entrySet()) {
    System.out.println(entry.getKey() + " -> " + entry.getValue());
}
```

---

## 5. Code Example: Deduplicating Names and Counting Word Frequency

```java
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class SetMapDemo {
    public static void main(String[] args) {
        // Deduplicating with a HashSet
        List<String> names = Arrays.asList("Alice", "Bob", "Alice", "Charlie", "Bob");
        Set<String> uniqueNames = new HashSet<>(names);
        System.out.println("Unique count: " + uniqueNames.size()); // 3

        // Counting word frequency with a HashMap
        String[] words = {"apple", "banana", "apple", "cherry", "banana", "apple"};
        Map<String, Integer> counts = new HashMap<>();
        for (String word : words) {
            counts.put(word, counts.getOrDefault(word, 0) + 1);
        }
        System.out.println("apple: " + counts.get("apple"));   // 3
        System.out.println("banana: " + counts.get("banana")); // 2
        System.out.println("cherry: " + counts.get("cherry")); // 1
    }
}
```

Tracing through the counting loop: `counts` starts empty. For `"apple"`, `getOrDefault("apple", 0)` finds no existing key and returns `0`, so `counts.put("apple", 1)` runs. For `"banana"`, likewise `counts.put("banana", 1)`. The second `"apple"` now finds an existing entry — `getOrDefault` returns `1` — so it becomes `counts.put("apple", 2)`. The second `"banana"` becomes `2`. `"cherry"` becomes `1`. The final `"apple"` becomes `3`. Final state: `apple=3, banana=2, cherry=1` — exactly matching the three `get` calls above. Note this example deliberately reads specific keys with `.get(...)` instead of iterating `counts.entrySet()` and printing it directly — with a plain `HashMap`, the *order* entries print in in a loop is unspecified and shouldn't be relied on or assumed to match insertion order.

---

## 6. Choosing the Right Set or Map Implementation

| | **Hash (`HashSet`/`HashMap`)** | **LinkedHash (`LinkedHashSet`/`LinkedHashMap`)** | **Tree (`TreeSet`/`TreeMap`)** |
|---|---|---|---|
| **Ordering** | Unspecified, effectively unpredictable | Insertion order preserved | Sorted order (natural or custom `Comparator`) |
| **Lookup/insert speed** | O(1) average | O(1) average (slightly more overhead) | O(log n) |
| **When to use** | Default choice when order doesn't matter | Need predictable, insertion-ordered iteration | Need entries sorted, or need "closest key" style queries |

**Common mistakes:**
- Assuming `HashMap`/`HashSet` iteration happens in insertion order (or any predictable order) just because it *seemed* consistent in a quick test — it isn't guaranteed, and relying on it is a latent bug waiting to surface after a JDK upgrade or a different set of inputs. Use `LinkedHashMap`/`LinkedHashSet` explicitly if insertion order matters.
- Using a mutable custom object as a `HashMap` key (or `HashSet` element) and then changing a field that its `hashCode()` depends on *after* inserting it. The object gets placed into a bucket based on its hash code at insertion time; if that hash code changes afterward, a later `map.get(sameObject)` can fail to find it, because the lookup now computes a different bucket than the one it's actually sitting in.

**Interview angle:** "Why doesn't `HashMap` guarantee order, and what would you use instead if you needed it?" tests whether you understand hashing is about speed, not sequence, and that Java gives you `LinkedHashMap` (insertion order) and `TreeMap` (sorted order) as explicit opt-ins rather than expecting you to fight `HashMap`'s internals.

---

## 7. Hands-On Exercises

### Exercise 1 — Deduplicate and sort

Given a `List<String>` of repeated city names in random order, produce a `TreeSet<String>` containing each unique name in alphabetical order. Print it and confirm the sort.

### Exercise 2 — Frequency counter, generalized

Write a method `Map<Character, Integer> countLetters(String text)` that counts how many times each letter appears in a string (ignore case, ignore spaces). Test it against a few sentences and verify the counts by hand.

### Exercise 3 — Break a HashMap key on purpose

Create a small mutable class `MutableKey` with one `int` field and `hashCode()`/`equals()` based on that field. Insert an instance as a `HashMap` key, then mutate the field, then call `map.get(...)` with an object that's `.equals()` to the (now-mutated) key. Observe the lookup fail, and explain why in a comment.

---

## 8. Interview Q&A

### Q1. What's the core difference between a `Set` and a `List`?

**Answer:** A `List` is an ordered sequence that allows duplicates and is accessed by position (index). A `Set` guarantees no duplicate elements and is primarily accessed by membership ("is this present?") rather than by position.

---

### Q2. Why is `HashMap` lookup so much faster than scanning a `List`?

**Answer:** `HashMap` computes a hash code for the key and uses it to jump almost directly to the bucket where a matching entry would live, making lookup O(1) on average. A `List` has no such structure, so finding an element means checking each one in sequence — O(n).

---

### Q3. What's the difference between `HashMap`, `LinkedHashMap`, and `TreeMap`?

**Answer:** `HashMap` gives fast O(1) average operations with no predictable iteration order. `LinkedHashMap` adds insertion-order iteration on top of the same hashing mechanism. `TreeMap` keeps keys sorted at all times, with slower O(log n) operations in exchange for sorted iteration.

---

### Q4. What does `getOrDefault` help avoid?

**Answer:** Without it, checking for an existing count requires an explicit `containsKey` check (or a `null` check on `get`) before deciding whether to initialize or increment a value. `getOrDefault(key, 0)` collapses that into a single expression, returning a safe default when the key isn't present yet.

---

### Q5. Why can a mutable object make a bad `HashMap` key?

**Answer:** A `HashMap` places a key into a bucket based on its `hashCode()` at the moment of insertion. If the object is later mutated in a way that changes its `hashCode()`, a subsequent lookup computes a different bucket than the one the entry actually lives in, and `get()` silently fails to find it — even though an `.equals()` object exists somewhere in the map.

---

> 🧠 **Memory hook:** "A `Set` is a guest list — on it or not, never twice; a `Map` is a dictionary — you jump straight to the word (key), not page 1."
