# 03 — Wrapper Classes and Autoboxing

> A comprehensive reference covering why wrapper classes exist, how autoboxing/unboxing work, the notorious `Integer` caching gotcha, and why `.equals()` — not `==` — is the safe way to compare wrapper objects.

---

## Table of Contents

1. [The Problem: Collections Can't Hold Primitives](#1-the-problem-collections-cant-hold-primitives)
2. [The Analogy: A Gift Box Around a Primitive Value](#2-the-analogy-a-gift-box-around-a-primitive-value)
3. [Wrapper Classes and Autoboxing](#3-wrapper-classes-and-autoboxing)
4. [The Integer Caching Gotcha](#4-the-integer-caching-gotcha)
5. [Parsing Strings to Numbers](#5-parsing-strings-to-numbers)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Collections Can't Hold Primitives

Java's primitive types (`int`, `double`, `boolean`, and the rest, introduced in Phase 1) are not objects — they're raw values with no methods and no ability to be `null`. That's normally fine, but Java's collection classes (`List`, `Map`, `Set`, covered in full in Phase 4) are designed to hold **objects**, not primitives — a `List<int>` is not valid Java at all. So how do you put something as basic as a single `int` into a `List`? The core problem: **primitives are fast and lightweight but can't participate anywhere an object is required — so how do you bridge the two worlds?**

---

## 2. The Analogy: A Gift Box Around a Primitive Value

**Real-world analogy:** a wrapper class is a gift box wrapped around a raw item. The item inside — say, a coin — doesn't change at all; it's still the exact same coin. But now it's packaged in a box that can be carried, labeled, and placed on a shelf designed for boxes, not loose coins. Anywhere that specifically requires "a box," a bare coin won't do, no matter how valid the coin itself is.

**A wrapper class (`Integer`, `Double`, `Boolean`, ...) is that box around a primitive value** — the underlying value is unchanged, but now it's an object, and can go wherever Java requires an object.

---

## 3. Wrapper Classes and Autoboxing

Every primitive type has a corresponding wrapper class: `int` → `Integer`, `double` → `Double`, `boolean` → `Boolean`, `char` → `Character`, `long` → `Long`, and so on. Each wrapper is an ordinary object that holds one primitive value internally, plus useful methods (like parsing, covered below).

Since Java 5, the compiler automatically converts between a primitive and its wrapper wherever needed — you rarely have to do this by hand:

```java
int primitive = 42;
Integer boxed = primitive;        // autoboxing: int -> Integer, inserted automatically by the compiler
int backToPrimitive = boxed;      // unboxing: Integer -> int, also automatic

List<Integer> numbers = new ArrayList<>();
numbers.add(5);   // autoboxing: the int literal 5 becomes an Integer object here
int first = numbers.get(0); // unboxing: the Integer is converted back to int
```

**Autoboxing** is the automatic conversion from a primitive to its wrapper object; **unboxing** is the reverse. The compiler silently inserts calls like `Integer.valueOf(...)` (boxing) and `.intValue()` (unboxing) behind the scenes — you write plain-looking code, and the compiler bridges the primitive/object gap for you. This is exactly what makes `numbers.add(5)` above valid at all — `add` requires an `Integer` object, and the compiler boxes the literal `5` to satisfy that.

---

## 4. The Integer Caching Gotcha

Because `Integer` (and the other numeric wrappers) are objects, `==` on two `Integer` variables compares references, just like it does for `String` (Phase 3, Lesson 2) — "are these the same object?" — not their numeric value. `.equals()` compares the actual wrapped value. That distinction alone would be simple enough, except for one detail that makes it genuinely confusing in practice:

```java
Integer a = 100;
Integer b = 100;
System.out.println(a == b); // true

Integer x = 200;
Integer y = 200;
System.out.println(x == y); // false
```

Trace through why these two nearly-identical snippets give different answers. The JVM maintains an internal cache of `Integer` objects for values from **-128 to 127** (a range guaranteed by the Java Language Specification). When autoboxing a value inside that range, `Integer.valueOf(...)` returns a *shared, cached* object rather than creating a new one — so `a` and `b`, both boxing `100`, actually end up pointing at the very same cached object, making `a == b` true. But `200` is outside the cached range, so each autoboxing operation creates a genuinely separate `Integer` object — `x` and `y` are two distinct objects with the same value, making `x == y` false.

This means `==` on wrapper types can *appear* to work correctly for small numbers purely by coincidence of the cache, then break for larger ones — a classic source of a bug that "worked in testing" with small sample values. The fix is the same one used for Strings: always compare wrapper values with `.equals()`, which compares content regardless of caching:

```java
System.out.println(a.equals(b));   // true
System.out.println(x.equals(y));   // true — correct, regardless of caching
```

---

**Comparison — primitive vs wrapper:**

| | Primitive (`int`) | Wrapper (`Integer`) |
|---|---|---|
| **Can be `null`** | No | Yes |
| **Can go in a `List`/`Map`** | No — must be boxed first | Yes |
| **Comparison with `==`** | Compares actual value | Compares object reference (unreliable for value equality) |
| **Memory/performance** | Lightweight, stored directly | Heavier — a full object, with method call overhead |
| **Default value (as a field)** | `0` | `null` |

## 5. Parsing Strings to Numbers

A very common need is converting text (e.g. user input, or data read from a file — Phase 7) into a numeric type. The wrapper classes provide static parsing methods for exactly this:

```java
String input = "42";
int parsed = Integer.parseInt(input);   // 42, as a primitive int
System.out.println(parsed + 8);         // 50
```

`Integer.parseInt(...)` returns a primitive `int` directly (not an `Integer`), and throws a `NumberFormatException` if the text isn't a valid number — e.g. `Integer.parseInt("abc")` fails at runtime rather than silently returning `0`.

**Common mistakes:**
- Relying on `==` for wrapper comparison because it happened to "work" during testing with small numbers (inside the -128 to 127 cached range), then seeing it silently fail once real data includes larger values.
- Unboxing a `null` wrapper — for example, calling a method that returns `Integer` and might legitimately return `null`, then using that result directly in an expression expecting a primitive `int`. The automatic unboxing calls `.intValue()` internally, and calling any method on `null` throws a `NullPointerException` — a bug that's easy to miss because the code looks perfectly ordinary.

**Interview angle:** "Why does `Integer a = 100; Integer b = 100; a == b` return `true`, but the same code with `200` returns `false`?" is a favorite trick question specifically because it exposes whether a candidate actually understands autoboxing and reference comparison, or has just memorized "use `.equals()` for objects." A strong answer names the -128 to 127 cache explicitly and explains *why* it exists (small integer values are extremely common, so reusing objects for them saves memory and allocation overhead) rather than treating it as unexplained magic.

---

## 6. Hands-On Exercises

### Exercise 1 — Reproduce the caching gotcha

Write a program that declares two pairs of `Integer` variables — one pair both set to `100`, one pair both set to `200` — and prints the result of `==` for each pair. Then add `.equals()` comparisons for both pairs and confirm they both report `true` regardless of caching. Try the boundary values `127` and `128` as a fourth pair and predict the `==` result before running it.

### Exercise 2 — Trigger and explain a NullPointerException

Write a method that returns `Integer` and can return `null` for one input. Call it in a way that unboxes the result into a primitive `int` (e.g. adding it to another number) when the method returns `null`, and observe the resulting `NullPointerException`. Then fix it by checking for `null` before unboxing.

### Exercise 3 — Parse and validate user input

Write a small program that attempts `Integer.parseInt(...)` on a hardcoded string that isn't a valid number, wrapped in a `try`/`catch` (a forward reference to Phase 5) that catches `NumberFormatException` and prints a friendly error message instead of letting the program crash.

---

## 7. Interview Q&A

### Q1. What is autoboxing, and why does Java need it?

**Answer:** Autoboxing is the compiler's automatic conversion of a primitive value into its corresponding wrapper object (e.g. `int` into `Integer`) wherever an object is required, such as adding a primitive value into a `List`. It exists because Java's collections and generics work only with objects, not primitives, so autoboxing lets code look like it's storing primitives directly while the compiler quietly bridges the gap.

---

### Q2. Why does `Integer a = 100; Integer b = 100;` make `a == b` true, but the same pattern with `200` makes it false?

**Answer:** The JVM caches `Integer` objects for values from -128 to 127. Autoboxing a value in that range reuses a shared cached object, so both variables end up referencing the same object. 200 falls outside the cache, so autoboxing creates two distinct objects with the same value, making `==` (reference comparison) false even though both hold `200`.

---

### Q3. What's the safe way to compare two `Integer` (or other wrapper) values?

**Answer:** Always use `.equals()`, which compares the actual wrapped numeric value regardless of whether the objects happen to be the same cached instance or two separate ones. `==` should only be used on wrapper types when you specifically intend to check object identity, which is rarely the goal.

---

### Q4. How can unboxing cause a `NullPointerException`?

**Answer:** If a wrapper variable holds `null` and code tries to use it in a context requiring the primitive (e.g. an arithmetic expression, or assigning it to a primitive variable), the compiler inserts an automatic unboxing call like `.intValue()`. Calling any method on a `null` reference throws `NullPointerException`, so the crash happens at the unboxing point, often far from where the `null` was actually introduced.

---

### Q5. What does `Integer.parseInt("abc")` do, and how should you handle it?

**Answer:** It throws a `NumberFormatException` at runtime because `"abc"` isn't a valid integer literal. Code that parses untrusted or user-supplied input should wrap the call in a `try`/`catch` for `NumberFormatException` (Phase 5 covers exception handling in depth) rather than assuming the input will always be well-formed.

---

> 🧠 **Memory hook:** "-128 to 127 live in the cache, share the same box. Step outside that range, and every box is freshly wrapped — always check the contents with `.equals()`, never the box itself with `==`."
