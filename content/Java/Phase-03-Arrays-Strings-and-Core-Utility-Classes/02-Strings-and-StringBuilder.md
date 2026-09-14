# 02 — Strings and StringBuilder

> A comprehensive reference covering String immutability, why `==` and `.equals()` behave differently for Strings, common String methods, and when to reach for StringBuilder instead of repeated concatenation.

---

## Table of Contents

1. [The Problem: Why Is String Concatenation in a Loop Slow?](#1-the-problem-why-is-string-concatenation-in-a-loop-slow)
2. [The Analogy: A Sealed Book vs a Whiteboard](#2-the-analogy-a-sealed-book-vs-a-whiteboard)
3. [String Immutability](#3-string-immutability)
4. [`==` vs `.equals()`](#4--vs-equals)
5. [Common String Methods](#5-common-string-methods)
6. [StringBuilder for Efficient Concatenation](#6-stringbuilder-for-efficient-concatenation)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Why Is String Concatenation in a Loop Slow?

Text manipulation is everywhere — building messages, formatting output, assembling reports. The obvious way to build up a long string is to keep adding to it with `+`:

```java
String result = "";
for (int i = 0; i < 10000; i++) {
    result = result + i + ",";
}
```

This *works*, but it gets dramatically slower as the loop grows, in a way that surprises people used to languages where strings can be modified in place. Something about how Java represents a `String` in memory is fighting against this pattern. The core problem: **why does repeatedly "modifying" a String in a loop actually get more expensive with every iteration, and what should you do instead?**

---

## 2. The Analogy: A Sealed Book vs a Whiteboard

**Real-world analogy:** a `String` is like a sealed, published book — once it's printed, its content can never change. If you want a sentence changed, you don't scribble in the margins of the existing book; you print an entirely new book with the new sentence, and the old book still sits on the shelf, unchanged, exactly as it was printed.

A `StringBuilder`, on the other hand, is a whiteboard. You can erase part of it and write something new, or add more text at the end, all on the *same* whiteboard — no new whiteboard needs to be manufactured every time you make an edit.

**Every `String` "modification" in Java actually prints a brand-new book. A `StringBuilder` is the whiteboard you reach for when you expect to make many edits.**

---

## 3. String Immutability

A `String` in Java is **immutable** — once created, its internal character content can never be changed. Every method on `String` that sounds like it modifies the string — `concat`, `toUpperCase`, `replace`, `trim`, `substring` — actually **returns a brand-new `String` object** containing the result, leaving the original completely untouched. If you don't capture that return value, the "modification" is simply lost.

```java
String s = "a";
s.concat("b");
System.out.println(s); // prints "a" — NOT "ab"
```

Trace through it: `s.concat("b")` computes a new `String` with content `"ab"` and returns it — but nothing in this code stores that returned value anywhere. `s` itself was never reassigned, so it still points at the original `"a"`. The correct way to actually keep the result is `s = s.concat("b");`, after which `s` would refer to the new `"ab"` string and printing `s` would show `"ab"`.

This is exactly why concatenating in a loop with `+` is expensive: `result = result + i + ",";` doesn't edit `result` in place — it builds an entirely new `String` object every single iteration, copying all of the previous content into it each time, then discards the old one. For 10,000 iterations, that's 10,000 new String objects created, with the amount of copying growing larger on every pass.

---

## 4. `==` vs `.equals()`

Because Strings are objects, `==` on two `String` variables compares **references** — "do these two variables point at the exact same object in memory?" — not their content. `.equals()`, inherited and overridden by `String`, compares **actual character content**.

```java
String a = "hello";
String b = "hello";
String c = new String("hello");

System.out.println(a == b);        // true  — both refer to the same pooled literal
System.out.println(a == c);        // false — c is a distinct object, created explicitly with `new`
System.out.println(a.equals(c));   // true  — content is identical
```

`a` and `b` are both written as the literal `"hello"` in the source code. Java maintains a **string pool** for literals — identical literal text is stored once and reused, so `a` and `b` actually point at the same object, making `a == b` true. But `c` is created explicitly with `new String("hello")`, which deliberately forces the creation of a brand-new, separate object with the same content, outside the pool — so `a == c` is `false` even though the text is identical. `.equals()` looks past *which object* is being referenced and compares the actual characters, correctly reporting `true` in both cases.

---

## 5. Common String Methods

A handful of `String` methods cover the overwhelming majority of everyday text handling:

```java
String text = "  Hello, Java World!  ";

System.out.println(text.trim());              // "Hello, Java World!" (leading/trailing whitespace removed)
System.out.println(text.trim().indexOf("Java")); // 7 (index where "Java" starts, within the trimmed string)
System.out.println(text.trim().substring(7, 11)); // "Java" (characters from index 7 up to, not including, 11)

String csv = "a,b,c";
String[] parts = csv.split(",");               // {"a", "b", "c"}
System.out.println(parts.length);              // 3
```

Every one of these — `trim`, `indexOf`, `substring`, `split` — returns a *new* value (a new `String` or a new `String[]`) rather than modifying `text` or `csv` themselves, consistent with immutability.

---

## 6. StringBuilder for Efficient Concatenation

`StringBuilder` is a genuinely **mutable** sequence of characters. Unlike `String`, calling `.append(...)` on a `StringBuilder` modifies its own internal buffer directly — no new object is created on every call.

```java
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 10000; i++) {
    sb.append(i).append(",");
}
String result = sb.toString();
```

Here, `sb` grows one buffer in place across all 10,000 iterations (occasionally resizing its internal capacity, but far less often than "every single append"), then `.toString()` is called exactly once at the end to produce the final `String`. This turns an operation that got progressively slower with `String` + concatenation into one with roughly constant work per iteration.

---

**Comparison — `String` vs `StringBuilder` vs `StringBuffer`:**

| | `String` | `StringBuilder` | `StringBuffer` |
|---|---|---|---|
| **Mutable?** | No — every "change" returns a new object | Yes — modifies its own buffer in place | Yes — modifies its own buffer in place |
| **Thread-safe?** | N/A (immutable objects are inherently safe to share) | No — not synchronized | Yes — methods are synchronized |
| **Performance** | Slow for repeated modification (many objects created) | Fast — no synchronization overhead | Slower than `StringBuilder` due to synchronization, even in single-threaded code |
| **When to use** | Fixed or rarely-changing text | Building/modifying text within a single thread (the common case) | Building/modifying text shared across multiple threads (rare in modern code — Phase 8 covers better concurrency tools) |

**Common mistakes:**
- Using `==` to compare `String` content instead of `.equals()` — it can appear to "work" for two string literals (thanks to the string pool) and then mysteriously fail once one of the strings comes from `new String(...)`, user input, or `.substring()`/concatenation at runtime.
- Building strings with `+` inside a loop that runs many times, instead of using a `StringBuilder` — for a handful of concatenations it doesn't matter, but it scales badly.

**Interview angle:** "Why is `String` immutable in Java?" is a near-guaranteed interview question. The strongest answer covers more than "you can't change it" — it should mention that immutability makes Strings safe to share across threads without synchronization, safe to use as `HashMap` keys (their `hashCode()` can be cached once and never goes stale), and enables the string pool to safely reuse identical literals, since no code can ever corrupt a shared literal for everyone else referencing it.

---

## 7. Hands-On Exercises

### Exercise 1 — Prove immutability to yourself

Write a small program that creates a `String`, calls three different "modifying-sounding" methods on it (`toUpperCase()`, `trim()`, `replace(...)`) without ever reassigning the variable, and prints the original string afterward to confirm it's completely unchanged. Then rewrite it correctly, reassigning after each call, and print the final result.

### Exercise 2 — The `==` trap, reproduced

Write a program with two `String` variables created as literals (`"test"`) and a third created with `new String("test")`. Print the result of all three possible `==` comparisons and all three `.equals()` comparisons, and write a one-sentence explanation next to each result.

### Exercise 3 — Time it yourself

Write two versions of a loop that builds a string of 50,000 numbers separated by commas — one using `+` concatenation on a `String`, one using `StringBuilder.append`. Time both using `System.currentTimeMillis()` before and after each loop, and print the difference. Confirm the `StringBuilder` version is meaningfully faster.

---

## 8. Interview Q&A

### Q1. Why does `s.concat("b")` not change `s` if `s` was `"a"`?

**Answer:** `String` is immutable — `concat` computes a brand-new `String` containing `"ab"` and returns it, but never touches the original object referenced by `s`. If the return value isn't captured (`s = s.concat("b")`), it's simply discarded, and `s` continues pointing at the original, unchanged `"a"`.

---

### Q2. What's the difference between `==` and `.equals()` for Strings?

**Answer:** `==` compares whether two references point at the exact same object in memory. `.equals()` (overridden by `String`) compares actual character content. Two Strings can have identical content but be different objects (e.g. one from a literal, one from `new String(...)`), in which case `==` is `false` but `.equals()` is `true`.

---

### Q3. Why can two String literals with the same text be `==` equal?

**Answer:** Java maintains a string pool for literal text — identical literal content written in the source code is stored once and reused by every variable assigned that same literal, so two variables both holding the literal `"hello"` genuinely point at the same pooled object. This optimization doesn't apply to Strings built with `new String(...)`, which explicitly forces a new, separate object outside the pool.

---

### Q4. Why is building a string with `+` in a loop considered bad practice?

**Answer:** Because `String` is immutable, each `+` concatenation produces an entirely new `String` object, copying all prior content into it. Across many loop iterations, that's a growing amount of redundant copying and object creation. `StringBuilder` avoids this by modifying one mutable internal buffer in place across all iterations.

---

### Q5. When would you choose `StringBuffer` over `StringBuilder`?

**Answer:** Only when the same builder object is genuinely shared and modified by multiple threads concurrently — `StringBuffer`'s methods are synchronized for thread safety, while `StringBuilder`'s are not. In the far more common single-threaded case, `StringBuilder` is preferred since it avoids the unnecessary synchronization overhead.

---

> 🧠 **Memory hook:** "A String is a sealed book — print a new one for every edit. A StringBuilder is the whiteboard you actually want for a rough draft."
