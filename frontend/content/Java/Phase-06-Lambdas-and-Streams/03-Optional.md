# 03 — Optional

> A comprehensive reference covering why `Optional` exists, how to create and safely unwrap one, chaining transformations on the value it might hold, and where `Optional` is (and isn't) meant to be used.

---

## Table of Contents

1. [The Problem: The Silent Null](#1-the-problem-the-silent-null)
2. [The Analogy: A Labeled Gift Box](#2-the-analogy-a-labeled-gift-box)
3. [Creating an Optional](#3-creating-an-optional)
4. [Checking Presence and Extracting a Value Safely](#4-checking-presence-and-extracting-a-value-safely)
5. [Chaining with map and filter](#5-chaining-with-map-and-filter)
6. [Code Example: findUserByEmail](#6-code-example-finduserbyemail)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Silent Null

Consider a method like "find a user by email" — a perfectly normal operation that might legitimately have no result if no such user exists. Historically, Java methods like this simply returned `null` to signal "nothing found":

```java
String findUserByEmail(String email) {
    // ... returns the matching name, or null if nobody matches
}
```

Nothing about that method's signature — `String findUserByEmail(String email)` — warns a caller that `null` is a possible return value. The caller has to already know (from documentation, from convention, from having been bitten before) that they need to check for `null` before using the result. Forget that check even once, and you get a `NullPointerException` at the exact line that tried to use the missing value — often far away from, and much later than, wherever the `null` actually originated. The problem: **how do you make "this might have no result" visible in the type itself, instead of relying on every caller to remember to check?**

---

## 2. The Analogy: A Labeled Gift Box

**Real-world analogy:** imagine two boxes handed to you. One is completely unlabeled — you have to open it to find out whether there's a gift inside or nothing at all, and if you're not paying attention, you might reach in expecting something and come up empty-handed with no warning. The other box has a big label on the outside that says either "Contains: 1 gift" or "EMPTY" — you know, before you even open it, whether reaching inside will find something.

**A raw, nullable return value is the unlabeled box. `Optional` is the labeled one.** `Optional<String>` as a return type tells every caller, right there in the method signature, "this might have nothing inside — you are expected to handle that case," instead of leaving it an unstated assumption that only shows up as a crash when someone forgets.

---

## 3. Creating an Optional

There are three factory methods for building an `Optional`:

```java
Optional<String> present = Optional.of("Alice");        // must NOT be null, or this itself throws
Optional<String> empty   = Optional.empty();             // explicitly "no value"
Optional<String> maybe   = Optional.ofNullable(possiblyNullValue); // wraps null as empty, non-null as present
```

- `Optional.of(value)` wraps a value you already know is non-null — passing `null` here throws `NullPointerException` immediately, so only use it when you're certain the value can't be `null`.
- `Optional.empty()` explicitly represents "no value," with no wrapped object at all.
- `Optional.ofNullable(value)` is the flexible middle ground: if `value` is `null`, you get an empty `Optional`; if it's non-null, you get a present one. This is the one you'll reach for most often when wrapping something that might legitimately be `null` (like the result of a `Map.get(...)` lookup).

---

## 4. Checking Presence and Extracting a Value Safely

Once you have an `Optional<T>`, there are a few ways to get the value back out, ranging from "check first" to "give me a fallback if it's empty":

```java
Optional<String> maybe = Optional.ofNullable(lookup());

if (maybe.isPresent()) {
    System.out.println(maybe.get()); // safe here, because presence was just checked
}

if (maybe.isEmpty()) {              // isEmpty() is simply the inverse of isPresent()
    System.out.println("nothing found");
}

String value1 = maybe.orElse("default");              // fallback value if empty
String value2 = maybe.orElseGet(() -> computeFallback()); // fallback computed lazily, only if empty
String value3 = maybe.orElseThrow(() -> new NoSuchElementException("no value")); // throw a specific exception if empty
```

`orElse` always evaluates its argument (even when the `Optional` is present and the fallback ends up unused), while `orElseGet` only calls its `Supplier` lambda if the `Optional` actually turns out to be empty — worth knowing if computing the fallback is expensive.

---

## 5. Chaining with map and filter

`Optional` itself supports `map` and `filter`, mirroring the Stream API's operations from Lesson 2 — each returns a new `Optional`, letting you transform or narrow down a value only if one is actually present, without ever manually checking `isPresent()` yourself:

```java
Optional<String> name = Optional.of("Alice");

Optional<Integer> nameLength = name.map(String::length); // Optional[5] — only runs because name was present
Optional<String> onlyIfLong  = name.filter(n -> n.length() > 10); // Optional.empty — "Alice" has 5 characters
```

If the original `Optional` were empty, both `.map(...)` and `.filter(...)` would simply pass the emptiness through unchanged — the lambda inside them never even runs, because there's no value to hand it.

---

## 6. Code Example: findUserByEmail

```java
import java.util.*;

public class UserLookup {
    static Optional<String> findUserByEmail(String email) {
        Map<String, String> users = Map.of(
            "alice@example.com", "Alice",
            "bob@example.com", "Bob"
        );
        return Optional.ofNullable(users.get(email)); // Map.get returns null on a missing key
    }

    public static void main(String[] args) {
        String found = findUserByEmail("alice@example.com").orElse("not found");
        System.out.println(found); // Alice

        String missing = findUserByEmail("zed@example.com").orElse("not found");
        System.out.println(missing); // not found

        Optional<Integer> foundLength = findUserByEmail("alice@example.com").map(String::length);
        System.out.println(foundLength.orElse(0)); // 5
    }
}
```

`users.get("alice@example.com")` returns `"Alice"`, so `Optional.ofNullable(...)` wraps it as present, and `.orElse("not found")` returns `"Alice"` unchanged since there's a value to return. `users.get("zed@example.com")` returns `null` (no matching key), so `Optional.ofNullable(...)` produces an empty `Optional`, and `.orElse("not found")` falls back to the default string. Neither call path ever risks a `NullPointerException` — the caller never touches a raw, possibly-null value directly.

---

## 7. Common Mistakes

- **Calling `.get()` directly on an `Optional` without checking presence first.** This defeats the entire purpose of `Optional` — if it happens to be empty, `.get()` throws `NoSuchElementException`, which is exactly the kind of unchecked, easy-to-forget failure `Optional` exists to help you avoid. Prefer `orElse`, `orElseGet`, `orElseThrow` (with an intentional, specific exception), or an explicit `isPresent()`/`isEmpty()` check first.
- **Using `Optional` as a field type or method parameter.** `Optional` was designed primarily as a **return type**, signaling "this method might not have a result" to its callers. Using it for a class field or a method parameter is generally discouraged in the Java community — it adds an extra wrapping/unwrapping layer without the same clear benefit, and a field can usually just be assigned (or left unset with normal null-handling) directly.

**Interview angle:** "Why does `Optional` exist if we already have `null`?" is a common question. The answer interviewers want is about *visibility*: `null` is a value any reference type can silently take on, with nothing in a method's signature warning a caller it might happen, while `Optional<T>` as a return type makes "this might have no result" an explicit, checkable part of the API contract — pushing the "what if there's nothing here" handling into the type system instead of leaving it as an unstated assumption.

---

## 8. Hands-On Exercises

### Exercise 1 — Rewrite a nullable-returning method to use Optional

Write a method `String findCapital(String country)` that returns `null` when the country isn't in a small lookup map. Rewrite it to return `Optional<String>` instead using `Optional.ofNullable(...)`, and update the caller to use `.orElse(...)` instead of a manual `null` check.

### Exercise 2 — Chain map and filter on an Optional

Given `Optional<String> word = Optional.of("Streams");`, write one expression that uppercases the word only if it's longer than 5 characters, using `.filter(...)` followed by `.map(...)`, and print the final result using `.orElse("too short")`.

### Exercise 3 — Trigger `NoSuchElementException` on purpose

Write a small program that creates an empty `Optional` (via `Optional.empty()`) and calls `.get()` on it directly. Confirm (by reasoning through the API, or running it if a JDK is available) that this throws `NoSuchElementException`, and rewrite the same line using `orElseThrow(...)` with a custom, more descriptive exception instead.

---

## 9. Interview Q&A

### Q1. What problem does `Optional` solve?

**Answer:** It makes "this method might legitimately have no result" an explicit, visible part of a method's return type, instead of relying on every caller remembering to check for `null` on their own. A method returning `Optional<T>` documents, in the signature itself, that the absence of a value is a normal, expected outcome the caller must handle.

---

### Q2. What's the difference between `Optional.of`, `Optional.empty`, and `Optional.ofNullable`?

**Answer:** `Optional.of(value)` wraps a known non-null value and throws `NullPointerException` immediately if you pass it `null`. `Optional.empty()` explicitly creates an empty `Optional` with no value at all. `Optional.ofNullable(value)` is the flexible option — it produces an empty `Optional` if `value` is `null`, and a present one otherwise, making it the right choice when wrapping something that might or might not be `null`.

---

### Q3. Why is calling `.get()` on an `Optional` without checking presence considered a mistake?

**Answer:** Because it reintroduces the exact failure mode `Optional` was designed to prevent — if the `Optional` happens to be empty, `.get()` throws `NoSuchElementException` at that exact call site, just as unpredictably as an unchecked `null` dereference would have thrown `NullPointerException`. Safer alternatives like `orElse`, `orElseGet`, or `orElseThrow` force you to think about the empty case explicitly.

---

### Q4. Should you use `Optional` as a field type or a method parameter?

**Answer:** Generally no. `Optional` is intended primarily as a return type to signal "this call might produce nothing." Using it for fields or parameters adds wrapping/unwrapping overhead without a comparable benefit, since a field can be left unset (or documented as nullable) directly, and a missing parameter can usually be handled with method overloading or a sensible default instead.

---

### Q5. What do `map` and `filter` do on an `Optional`?

**Answer:** `map` transforms the wrapped value (only if one is present) into a new `Optional` holding the transformed result, leaving an empty `Optional` untouched. `filter` keeps the wrapped value only if it satisfies a given `Predicate`, otherwise producing an empty `Optional`. Both let you express "if there's a value, do this to it" without ever manually calling `isPresent()` yourself.

---

> 🧠 **Memory hook:** "`Optional` is the gift box with a label on it — you know whether it's empty before you ever reach inside, so you never grab at nothing by accident."
