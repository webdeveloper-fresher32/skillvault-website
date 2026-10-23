# Sets and Maps — Complete Guide

## Table of Contents
1. [Why Not Just Objects and Arrays](#1-why-not-just-objects-and-arrays)
2. [Set](#2-set)
3. [Map](#3-map)
4. [Map vs Plain Object](#4-map-vs-plain-object)
5. [WeakMap and WeakSet](#5-weakmap-and-weakset)
6. [Practical Use Cases](#6-practical-use-cases)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Not Just Objects and Arrays

Before ES6, JavaScript developers reached for plain objects to simulate "sets" (unique value collections) and "maps" (key-value stores), and arrays for everything else. This worked, but with real limitations: object keys are always coerced to strings (you can't use an object or a number as a distinct key), checking "does this array already contain this value" requires an O(n) scan (`array.includes(x)`), and plain objects carry inherited properties from `Object.prototype` that can collide with your own keys in edge cases. `Set` and `Map`, added in ES6, are purpose-built data structures that solve these problems directly.

---

## 2. Set

A `Set` is a collection of **unique** values of any type — adding a duplicate value is a silent no-op, and lookups (`has`) are fast.

```js
const uniqueNumbers = new Set([1, 2, 2, 3, 3, 3, 4]);
console.log(uniqueNumbers); // Set(4) {1, 2, 3, 4}  — duplicates removed automatically
console.log(uniqueNumbers.size); // 4  (NOT .length — Sets use .size)

uniqueNumbers.add(5);
uniqueNumbers.add(2);       // no-op — 2 is already in the set
console.log(uniqueNumbers.has(3)); // true
console.log(uniqueNumbers.has(10)); // false
uniqueNumbers.delete(1);
console.log(uniqueNumbers); // Set(4) {2, 3, 4, 5}

// Iteration — insertion order is preserved
for (const num of uniqueNumbers) {
  console.log(num); // 2, 3, 4, 5 — in the order they were added
}

// Converting back to an array
const asArray = [...uniqueNumbers]; // [2, 3, 4, 5]
```

### Field-by-Field Breakdown

```
new Set(iterable)
  ↳ Accepts any iterable (array, string, another Set) and builds
    a unique-value collection from it.

.add(value)   ↳ Adds a value. No-op if already present. Returns the Set (chainable).
.has(value)   ↳ O(1) average lookup — much faster than Array.includes()'s O(n) scan.
.delete(value) ↳ Removes a value. Returns true if it was present, false otherwise.
.size         ↳ NOT .length — Sets use .size, a common beginner mistake.
.clear()      ↳ Removes everything.

Uniqueness uses the SameValueZero algorithm — like ===, except
NaN is considered equal to itself (unlike ===, where NaN !== NaN):
  const s = new Set([NaN, NaN]); console.log(s.size); // 1, not 2
```

### Set Operations (Deduplication and Beyond)

```js
// The single most common real-world use: deduplicating an array
const withDupes = [1, 5, 5, 2, 2, 2, 3];
const unique = [...new Set(withDupes)]; // [1, 5, 2, 3]

// Set-theoretic operations (union, intersection, difference) via spread + filter:
const setA = new Set([1, 2, 3, 4]);
const setB = new Set([3, 4, 5, 6]);

const union = new Set([...setA, ...setB]);                             // {1,2,3,4,5,6}
const intersection = new Set([...setA].filter((x) => setB.has(x)));    // {3,4}
const difference = new Set([...setA].filter((x) => !setB.has(x)));     // {1,2}
```

`WeakSet` is covered in Section 5.

---

## 3. Map

A `Map` is a key-value collection, like a plain object, but with two crucial differences: **any value can be a key** (not just strings/symbols), and iteration order is **guaranteed** to be insertion order.

```js
const userRoles = new Map();

userRoles.set("alice", "admin");
userRoles.set("bob", "editor");

const configObject = { env: "prod" };
userRoles.set(configObject, "special-access"); // an OBJECT as a key — impossible with plain objects

console.log(userRoles.get("alice"));        // "admin"
console.log(userRoles.get(configObject));   // "special-access" — looked up by object REFERENCE
console.log(userRoles.size);                // 3   (again, .size, not .length)
console.log(userRoles.has("bob"));          // true

userRoles.delete("bob");
console.log(userRoles.size); // 2

// Iteration — guaranteed insertion order, unlike plain objects
for (const [key, value] of userRoles) {
  console.log(key, value);
}
// "alice" "admin"
// configObject "special-access"

console.log([...userRoles.keys()]);    // ["alice", configObject]
console.log([...userRoles.values()]);  // ["admin", "special-access"]
console.log([...userRoles.entries()]); // [["alice","admin"], [configObject,"special-access"]]
```

### Field-by-Field Breakdown

```
new Map(iterable)
  ↳ Can be initialized from an array of [key, value] pairs:
    new Map([["a", 1], ["b", 2]])

.set(key, value)  ↳ Adds/updates an entry. Returns the Map (chainable: map.set(a,1).set(b,2)).
.get(key)         ↳ Returns the value, or undefined if the key isn't present.
.has(key)         ↳ O(1) average lookup.
.delete(key)      ↳ Removes an entry. Returns true/false.
.size             ↳ Number of entries (not .length).
.clear()          ↳ Removes everything.
.keys() / .values() / .entries()
  ↳ Return iterators, usable in for...of or spread into arrays.
```

---

## 4. Map vs Plain Object

```
Feature                    Plain Object              Map
──────────────────────────────────────────────────────────────────────
Key types                  Strings/Symbols only       ANY value —
                            (numbers are coerced        objects, functions,
                            to strings)                 numbers, NaN, etc.

Iteration order             Not fully guaranteed        GUARANTEED
                             (integer-like keys sort     insertion order,
                             first, then insertion       always, no exceptions
                             order for the rest —
                             a real, surprising gotcha)

Size                        Object.keys(obj).length     .size — O(1),
                            — must build an array        directly available
                            first, O(n)

Default/inherited keys      Inherits from                Map has NO default
                            Object.prototype              keys at all — a
                            (toString, hasOwnProperty,    fresh Map is truly
                            etc. — can collide with       empty
                            a real key named
                            "toString", for example)

Performance for frequent    Slower for frequent          Optimized specifically
add/remove of keys          add/remove in some            for frequent
                            engines                       add/remove

Serialization               JSON.stringify(obj)          JSON.stringify(map)
                            works directly                produces "{}" —
                                                            Maps are NOT
                                                            JSON-serializable
                                                            without manual
                                                            conversion first
                                                            (e.g. via
                                                            Object.fromEntries)
```

**Rule of thumb:** use a plain object for simple, string-keyed, JSON-serializable data (API payloads, config). Use a `Map` when keys aren't known strings ahead of time, when you need guaranteed iteration order, when keys might be non-string values, or when you're frequently adding/removing entries and want `.size` without recomputing it.

---

## 5. WeakMap and WeakSet

`WeakMap` and `WeakSet` are restricted variants that hold their keys (WeakMap) or values (WeakSet) **weakly** — meaning the garbage collector is free to reclaim that memory if there are no other references to the object anywhere else in the program, even while it's still "in" the WeakMap/WeakSet.

```js
let user = { name: "Kavya" }; // one reference to this object exists: `user`

const metadata = new WeakMap();
metadata.set(user, { lastLogin: "2026-07-01" }); // object used as a key

console.log(metadata.get(user)); // { lastLogin: "2026-07-01" }

user = null; // the ONLY other reference to this object is gone now
// The object is now eligible for garbage collection — and once collected,
// its entry inside `metadata` disappears too, automatically.
// There is NO way to verify this from your code directly (no .size,
// no iteration, no forEach) — that's an intentional restriction.
```

```
Why WeakMap/WeakSet impose these restrictions
(no iteration, no .size, no .clear(), keys/values must be objects):

  A regular Map holding an object as a key creates a STRONG reference
  to that object — even if every other part of your program stops
  using it, the Map keeps it alive forever, which is a memory leak
  if you forget to manually .delete() it.

  A WeakMap's references are WEAK — they don't prevent garbage
  collection. This is exactly why WeakMap can't be iterated or sized:
  the engine could garbage-collect an entry at ANY moment, between
  any two lines of your code, so exposing "how many entries right
  now" or "let me loop through them" would be observing a constantly
  shifting, non-deterministic set — the API deliberately prevents you
  from relying on that.

Common use case: attaching metadata to an object (DOM node, class
instance) that should automatically disappear when that object is
no longer used anywhere else, WITHOUT you having to remember to
clean it up manually.
```

---

## 6. Practical Use Cases

```js
// Deduplication (the single most common Set use case)
function uniqueValues(array) {
  return [...new Set(array)];
}
console.log(uniqueValues([1, 1, 2, 3, 3, 3])); // [1, 2, 3]

// Fast membership testing (replacing repeated array.includes() scans)
const bannedWords = new Set(["spam", "scam", "phishing"]);
function containsBannedWord(text) {
  return text.split(" ").some((word) => bannedWords.has(word.toLowerCase()));
}

// Caching / memoization with Map (arbitrary argument as key)
function memoize(fn) {
  const cache = new Map();
  return function (arg) {
    if (cache.has(arg)) {
      console.log("cache hit for", arg);
      return cache.get(arg);
    }
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}

const slowSquare = (n) => { for (let i = 0; i < 1e8; i++); return n * n; };
const fastSquare = memoize(slowSquare);
fastSquare(5); // slow the first time
fastSquare(5); // "cache hit for 5" — instant the second time

// Counting occurrences (a classic Map use case)
function countWords(text) {
  const counts = new Map();
  for (const word of text.split(" ")) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}
console.log(countWords("the cat sat on the mat the cat ran"));
// Map(5) { 'the' => 3, 'cat' => 2, 'sat' => 1, 'on' => 1, 'mat' => 1, 'ran' => 1 }
```

---

## 7. Hands-On Exercises

**Exercise 1:** Write a function `removeDuplicates(array)` using `Set` that removes duplicate primitive values from an array while preserving the original first-seen order. Test it against an array of 20 numbers with heavy repetition and confirm the output length and order are correct.

**Exercise 2:** Build a `wordFrequency(text)` function using `Map` that counts occurrences of each word in a paragraph (case-insensitive, ignoring punctuation), then find and log the 3 most frequent words by converting the Map to an array of `[word, count]` pairs and sorting it.

**Exercise 3:** Write a `memoize(fn)` higher-order function (as in Section 6) that works for functions taking a SINGLE argument, using a `Map` as the cache. Test it with a deliberately slow recursive Fibonacci function `fib(n)` — time the first call to `fib(35)` versus a second, cached call to the same input, and log both durations to demonstrate the speedup.

**Exercise 4:** Create a `WeakMap` to attach private "click count" metadata to DOM button elements (or plain objects standing in for them if you're not in a browser), incrementing the count each time a simulated click happens. Explain in a comment why a `WeakMap` is the right choice here instead of a `Map` (hint: think about what happens when a button is removed from the page).

**Exercise 5:** Given two arrays representing user IDs from two different systems, use `Set` operations (union, intersection, difference, as shown in Section 2) to compute: which IDs exist in both systems, which exist only in system A, and which exist only in system B. Print all three results clearly labeled.

---

## 8. Interview Q&A

**Q: What are the main advantages of a `Set` over using a plain array to store unique values?**
Answer: A `Set` automatically enforces uniqueness — adding a value that already exists is silently a no-op, whereas with an array you'd have to manually check with `.includes()` before pushing, which is an O(n) linear scan every single time. `Set.prototype.has()` is optimized for average O(1) lookup, versus an array's `.includes()`, which must potentially scan every element; this difference becomes significant as the collection grows large or lookups happen frequently. `Set` also provides a direct `.size` property instead of needing `.length`, and offers a semantically clearer API for its specific purpose — `.add()`, `.has()`, `.delete()` — that documents intent (this collection guarantees uniqueness) directly in the code, rather than relying on a comment or convention around a plain array.

**Q: What can a `Map` do that a plain object cannot, and when would you actually choose `Map` in practice?**
Answer: A `Map` allows any value at all to be used as a key — objects, functions, numbers, even `NaN` — whereas a plain object coerces every key to a string (or allows Symbols), meaning you cannot use an object or a number as a genuinely distinct key without it being stringified first. A `Map` also guarantees that iteration happens in insertion order, always, with no exceptions, while plain objects have a more surprising iteration order in practice — integer-like string keys are actually iterated first in ascending numeric order, ahead of other string keys in insertion order, which is a real and commonly-cited gotcha. In practice, you'd choose `Map` when keys aren't guaranteed to be strings, when you need guaranteed insertion-order iteration for something like an ordered cache or history log, when you're frequently adding and removing entries and want a reliable `.size` without recomputing `Object.keys(obj).length`, or when you want to avoid any risk of key collision with inherited `Object.prototype` properties like `toString` or `hasOwnProperty`.

**Q: What is the difference between `Map`/`Set` and their "Weak" counterparts, `WeakMap`/`WeakSet`?**
Answer: A regular `Map` or `Set` holds strong references to whatever it stores — if an object is used as a key in a `Map`, that `Map` keeps the object alive in memory for as long as the `Map` itself exists, even if every other part of the program has stopped referencing that object, which can create a memory leak if you forget to explicitly remove the entry. `WeakMap` and `WeakSet` hold their keys (for `WeakMap`) or values (for `WeakSet`) weakly, meaning those references do not prevent the JavaScript engine's garbage collector from reclaiming that memory once no other strong reference to the object exists anywhere in the program — when that happens, the corresponding entry is automatically and silently removed. Because entries can vanish from a `WeakMap`/`WeakSet` at any unpredictable moment as a result of garbage collection, these types deliberately have no `.size`, no iteration methods (`.forEach`, `for...of`), and no `.clear()` — exposing those would mean observing a data structure whose contents can non-deterministically shrink between any two lines of code, which the API is specifically designed to prevent.

**Q: Why would you use a `WeakMap` in a real application instead of a regular `Map`?**
Answer: The classic use case is attaching metadata to an object — such as a DOM element, a class instance, or any object with its own independent lifecycle — where you want that metadata to automatically disappear once the object itself is no longer referenced anywhere else, without having to remember to manually clean it up. For example, tracking a "click count" or "last accessed" timestamp per DOM button using a regular `Map` keyed by the button element would keep every button alive in memory forever, even after it's been removed from the page, unless you explicitly call `.delete()` at the right moment — a `WeakMap` avoids this leak entirely, because once the button element itself is removed from the DOM and has no other references, the garbage collector can reclaim it, and its corresponding `WeakMap` entry disappears along with it, with zero manual bookkeeping required.

**Q: How would you deduplicate an array and compute the intersection of two arrays using `Set`?**
Answer: Deduplication is a one-liner: `[...new Set(array)]` constructs a `Set` from the array, which automatically drops duplicate values because `Set` only stores unique entries, and the spread operator (`...`) converts that `Set` back into a plain array, preserving the original first-seen order of each value. Computing an intersection between two arrays follows a similar pattern: convert both arrays into `Set`s, then filter one array (converted from its `Set`, or the original array directly) to keep only the elements for which `.has()` on the other `Set` returns `true` — for example, `[...setA].filter(x => setB.has(x))` gives every value present in both `setA` and `setB`. This approach is both more concise and more efficient than a naive nested-loop approach comparing every element of one array against every element of the other, because `Set.prototype.has()` is an average O(1) lookup rather than an O(n) scan, bringing the overall intersection computation down from roughly O(n²) to roughly O(n).
