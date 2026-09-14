# 01 — Generics

> A comprehensive reference covering why generics exist, how they move type errors from runtime to compile time, generic classes and methods, bounded type parameters, and wildcards.

---

## Table of Contents

1. [The Problem: Object Soup and the Cast You Have to Trust](#1-the-problem-object-soup-and-the-cast-you-have-to-trust)
2. [The Analogy: The Labeled Shipping Container](#2-the-analogy-the-labeled-shipping-container)
3. [How Generics Actually Work](#3-how-generics-actually-work)
4. [Generic Classes and Generic Methods](#4-generic-classes-and-generic-methods)
5. [Bounded Type Parameters and Wildcards](#5-bounded-type-parameters-and-wildcards)
6. [Raw Types vs Generic Types](#6-raw-types-vs-generic-types)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Object Soup and the Cast You Have to Trust

Before generics existed (they were added in Java 5), a `List` had no idea what kind of thing it held. Every element went in and came back out as a plain `Object`. If you put a `String` into a list and later wanted to use it as a `String` again, you had to manually cast it back:

```java
List names = new ArrayList(); // pre-generics style: holds Object
names.add("Alice");
String first = (String) names.get(0); // you cast, and you'd better be right
```

That cast is a promise you're making to the compiler: "trust me, whatever comes out of this list is really a `String`." The compiler can't verify that promise — it just believes you. If someone else (or past-you, six months ago) had also added an `Integer` to that same list, the cast would compile perfectly fine and then blow up **at runtime** with a `ClassCastException`, often nowhere near the line that actually caused the problem.

The core problem: **how do you let a single collection or class work with many different types, without giving up the compiler's ability to catch a type mistake before the program ever runs?**

---

## 2. The Analogy: The Labeled Shipping Container

**Real-world analogy:** imagine a shipping yard where every container looks identical from the outside — you'd have to open one up to find out whether it holds glassware, machine parts, or produce. That's risky: a forklift operator might handle a "fragile glassware" container the same way as a "solid machine parts" container, because nothing on the outside says otherwise.

Now imagine every container has a large, checked label on it — **"Fragile: Glassware Only."** Before anything gets loaded, the label is checked against what's actually being put inside. Mismatches get rejected right there at the loading dock, not discovered later when a customer opens a badly-packed box.

**A raw, non-generic collection is the unlabeled container. A generic collection — `List<String>`, `Box<Integer>` — is the labeled one.** The type parameter (`<String>`, `<Integer>`) is the label, and the compiler is the inspector at the loading dock, rejecting the wrong "cargo" before your code ever ships (compiles) — not after it's already running in production.

---

## 3. How Generics Actually Work

Generics let a class or method declare a **type parameter** — a placeholder like `T` — that gets filled in with a real, specific type at the point of use. `Box<T>` isn't a concrete class by itself; `Box<String>` and `Box<Integer>` are concrete uses of it, each behaving as if you'd hand-written a separate `Box` just for that type, without you actually having to write it twice.

The payoff is that the compiler now knows, at every point in your code, exactly what type a generic class or method is working with — so:

- Adding the wrong type to a `Box<String>` is a **compile-time error**, not a runtime surprise.
- Reading from a `Box<String>` never requires a manual cast — the compiler already knows `.get()` returns a `String`, and inserts the (now provably safe) cast for you behind the scenes.

This is why generics are sometimes described as moving type-checking "left" — from something discovered by a crashing program in production, to something a red squiggly line in your editor catches before you even finish typing.

---

## 4. Generic Classes and Generic Methods

A **generic class** declares one or more type parameters in angle brackets right after the class name. A **generic method** does the same thing but scopes the type parameter to just that one method (useful when the method needs its own type parameter independent of the class it lives in, or when it lives in a non-generic class entirely).

```java
public class Box<T> {
    private T content;

    public void set(T content) {
        this.content = content;
    }

    public T get() {
        return content;
    }
}
```

`Box<T>` doesn't care what `T` ends up being — it just promises to store and return exactly that type, consistently:

```java
public class BoxDemo {
    public static void main(String[] args) {
        Box<String> stringBox = new Box<>(); // the "<>" is the diamond operator —
        stringBox.set("Hello, Generics!");    // it lets the compiler infer the type
        String greeting = stringBox.get();    // argument from the left-hand side,
        System.out.println(greeting);         // so you don't repeat <String> twice

        Box<Integer> intBox = new Box<>();
        intBox.set(42); // autoboxed: the int literal 42 becomes an Integer here
        int number = intBox.get(); // auto-unboxed back to a primitive int
        System.out.println(number);
    }
}
```

Output:

```
Hello, Generics!
42
```

Notice: no cast anywhere. `stringBox.get()` returns a `String` directly, and `intBox.get()` returns an `Integer` that's automatically unboxed into the primitive `int number` (autoboxing/unboxing is covered in depth in Phase 3).

A **generic method** declares its own type parameter just before the return type:

```java
import java.util.List;

public class ListUtils {
    public static <T> T firstElement(List<T> list) {
        return list.get(0);
    }

    public static void main(String[] args) {
        List<String> names = List.of("Ann", "Ben", "Cara");
        String first = firstElement(names); // T is inferred as String here
        System.out.println(first);
    }
}
```

Output:

```
Ann
```

The `<T>` right before `T firstElement(...)` declares that this method has its own type parameter, independent of any class-level one. Java infers `T` as `String` from the argument you pass in (`List<String>`), so the caller never has to spell out `ListUtils.<String>firstElement(names)`.

---

## 5. Bounded Type Parameters and Wildcards

Sometimes "any type at all" is too permissive — you need "any type, as long as it supports a specific operation." A **bounded type parameter** expresses that with `extends`:

```java
public class MaxFinder {
    public static <T extends Comparable<T>> T max(T a, T b) {
        return a.compareTo(b) >= 0 ? a : b;
    }

    public static void main(String[] args) {
        System.out.println(max(3, 7));               // 7
        System.out.println(max("apple", "banana"));   // banana
    }
}
```

`<T extends Comparable<T>>` reads as "`T` can be any type, as long as it implements `Comparable<T>`" (meaning it has a `compareTo` method that can rank two instances of itself — `Integer` and `String` both do). Without that bound, `a.compareTo(b)` wouldn't compile at all, because a plain unbounded `T` guarantees nothing beyond "it's some object." Tracing through: `3` boxes to `Integer`, and `Integer.compareTo` on `3.compareTo(7)` returns a negative number (3 is less than 7), so the condition `>= 0` is false and `b` (`7`) is returned. For the strings, `"apple".compareTo("banana")` is also negative ('a' sorts before 'b'), so `b` (`"banana"`) is returned.

**Wildcards** (`?`) solve a different, related problem: flexibility in *method parameters* that accept a generic type without caring about the exact type argument. Conceptually:

- `List<? extends Number>` — "a list of *some* subtype of `Number`, I don't know exactly which." You can safely **read** elements out of it as `Number` (every possible subtype is a `Number`), but you can't safely **add** to it (the compiler can't verify what you're adding matches the list's real, unknown element type).
- `List<? super Integer>` — "a list of `Integer` or some *supertype* of it." You can safely **write** `Integer`s into it (any such list is guaranteed to accept an `Integer`), but reading from it only safely gives you back an `Object`, since the real element type could be anything above `Integer` in the hierarchy.

A common mnemonic for this is **PECS: Producer Extends, Consumer Super** — use `? extends` when a generic parameter is *producing* values for you to read, and `? super` when it's *consuming* values you're writing into it.

---

## 6. Raw Types vs Generic Types

A **raw type** is a generic class used without any type argument at all (`List` instead of `List<String>`) — legal for backward compatibility with pre-Java-5 code, but it throws away everything generics give you.

```java
List rawList = new ArrayList();  // raw type — no <T> specified
rawList.add("a string");
rawList.add(42);                 // compiles fine — no type checking at all!

String s = (String) rawList.get(1); // compiles... but throws ClassCastException
                                     // at runtime, because element 1 is really an Integer
```

| | **Raw type (`List`)** | **Generic type (`List<String>`)** |
|---|---|---|
| **Compile-time type checking** | None — anything can be added | Enforced — only `String` (or a subtype) can be added |
| **Casting on read** | Manual, required | Automatic, inserted by the compiler |
| **Failure mode on type mismatch** | Runtime `ClassCastException`, often far from the real bug | Compile error, right where the mistake was made |
| **Compiler warnings** | "unchecked" warnings when mixed with generic code | None |
| **When you'd actually see it** | Legacy code predating Java 5 | All modern Java code |

---

**Common mistakes:**
- Using raw types (`List` instead of `List<String>`) "because it's less to type" — this silently throws away all compile-time type safety and defers the failure to a runtime `ClassCastException`.
- Confusing a bounded type parameter with a wildcard: reach for `<T extends Comparable<T>>` when you're defining a class/method that needs to *operate on* a specific capability (like comparing), and reach for `? extends`/`? super` when you're writing a method *parameter type* that just needs to flexibly accept a range of related generic types without adding to the "extends" side.

**Interview angle:** Interviewers often ask "what problem do generics solve, and what actually changes at runtime?" The key answer: generics are almost entirely a **compile-time** feature (via a mechanism called type erasure, where the compiler strips out the generic type information after checking it, so at runtime a `List<String>` and a raw `List` are actually the same class). Being able to say "generics catch type errors earlier, but the JVM itself doesn't see them at runtime" signals a real understanding, not just memorized syntax.

---

## 7. Hands-On Exercises

### Exercise 1 — Build a generic `Pair<A, B>` class

Write a generic class `Pair<A, B>` holding two values of potentially different types, with a constructor and `getFirst()`/`getSecond()` methods. Instantiate it once as `Pair<String, Integer>` (e.g. a name and an age) and print both values.

### Exercise 2 — Trigger a raw-type `ClassCastException` on purpose

Write a small program using a raw `List` (no `<T>`) that adds both a `String` and an `Integer`, then deliberately casts an element to the wrong type. Run it and observe the `ClassCastException` — then fix it by making the list a properly typed `List<String>` and note that the same mistake now becomes a compile error instead.

### Exercise 3 — Write a bounded generic method

Write a generic method `<T extends Comparable<T>> T min(List<T> items)` that returns the smallest item in a list, using `compareTo`. Test it with a `List<Integer>` and a `List<String>`.

---

## 8. Interview Q&A

### Q1. Why were generics added to Java?

**Answer:** To catch type mismatches at compile time instead of at runtime. Before generics, collections held plain `Object`s, so retrieving an element required an unchecked manual cast that could fail with a `ClassCastException` far from where the wrong type was actually inserted. Generics let the compiler verify type usage up front and eliminate that manual cast entirely.

---

### Q2. What is a bounded type parameter, and why would you use one?

**Answer:** A bounded type parameter, like `<T extends Comparable<T>>`, restricts a generic type to types that support a specific capability — here, being comparable to themselves. It's used when a generic method or class needs to call a method (like `compareTo`) on values of the generic type, which an unbounded `<T>` wouldn't allow, since an unbounded `T` guarantees nothing beyond being some `Object`.

---

### Q3. What's the difference between `? extends T` and `? super T`?

**Answer:** `? extends T` means "some unknown subtype of `T`," safe for reading values out (as `T` or a supertype) but not for adding to, since the real type is unknown. `? super T` means "some unknown supertype of `T`," safe for writing `T` values into, but only safely readable as `Object`. The mnemonic is PECS: Producer Extends, Consumer Super.

---

### Q4. What happens if you use a raw type instead of a generic type?

**Answer:** The code compiles (raw types exist for backward compatibility with pre-Java-5 code) but you lose all compile-time type checking on that collection or class — anything can be added, and the compiler generally emits an "unchecked" warning. Type mismatches that would have been compile errors with a proper generic type instead surface as a `ClassCastException` at runtime.

---

### Q5. Do generics exist at runtime in the JVM?

**Answer:** Not directly — Java generics use a mechanism called type erasure, where the compiler checks the generic type usage and then strips the type parameter information from the compiled bytecode, replacing it with `Object` (or the bound, if one exists) and inserting the necessary casts. This is why a `List<String>` and a raw `List` are actually represented by the same class at runtime.

---

> 🧠 **Memory hook:** "Generics are the checked shipping label — the compiler inspects it at the loading dock, so a `ClassCastException` never gets discovered later, mid-delivery."
