# 01 — Functional Interfaces and Lambda Expressions

> A comprehensive reference covering functional interfaces, lambda expression syntax, the built-in `java.util.function` interfaces, method references, and the variable-capture rules that govern what a lambda can safely touch.

---

## Table of Contents

1. [The Problem: Passing Behavior as Data](#1-the-problem-passing-behavior-as-data)
2. [The Analogy: A Sticky Note vs a Formal Memo](#2-the-analogy-a-sticky-note-vs-a-formal-memo)
3. [What a Functional Interface Actually Is](#3-what-a-functional-interface-actually-is)
4. [Lambda Expression Syntax](#4-lambda-expression-syntax)
5. [Method References: An Even Shorter Form](#5-method-references-an-even-shorter-form)
6. [Code Example: Three Ways to Sort a List](#6-code-example-three-ways-to-sort-a-list)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Passing Behavior as Data

Most of the Java you've seen so far (Phases 1-5) passes *data* around — an `int`, a `String`, a `List<Person>`. But sometimes what you actually want to hand to another piece of code isn't a value, it's a small piece of **behavior**: "sort using this comparison rule," "run this task later," "call this function on every element."

Before Java 8, the only way to pass behavior as a parameter was to write an entire anonymous inner class — a class with no name, defined inline, that implements some interface just so you can override its one method:

```java
Collections.sort(names, new Comparator<String>() {
    @Override
    public int compare(String a, String b) {
        return a.compareTo(b);
    }
});
```

Six lines of ceremony (the `new Comparator<String>() { ... }` boilerplate, the `@Override`, the method signature) to express one idea: "compare two strings using their natural ordering." The actual logic — `a.compareTo(b)` — is a single line buried inside a wall of syntax. The problem lambdas solve: **how do you pass a small piece of behavior somewhere without writing a whole class declaration around it?**

---

## 2. The Analogy: A Sticky Note vs a Formal Memo

**Real-world analogy:** imagine you need to tell a coworker "please water the office plant every Tuesday." You could write a formal memo — letterhead, a subject line, a signature block, a date, three paragraphs of preamble — to convey that one instruction. Or you could just stick a Post-it note on their monitor that says "water plant, Tuesdays." Both convey the exact same information. The Post-it note is faster to write, faster to read, and doesn't bury the one useful sentence in ceremony.

**The anonymous inner class is the formal memo. The lambda is the sticky note.** Same instruction — a piece of behavior handed to someone else to execute later — with almost all the ceremony stripped away.

---

## 3. What a Functional Interface Actually Is

A **functional interface** is an interface with **exactly one abstract method**. That's the entire definition. It might have other `default` or `static` methods (Phase 2 introduced `default` methods on interfaces), but only one method has no implementation — one "slot" that needs to be filled in.

You've already met a few without necessarily naming them that:

- `Runnable` — one abstract method, `void run()`.
- `Comparator<T>` — one abstract method, `int compare(T a, T b)`.

Java 8 also introduced a whole toolbox of general-purpose functional interfaces in the `java.util.function` package, so you don't have to declare your own for common shapes of behavior:

| Interface | Abstract method | Takes | Returns | Typical use |
|---|---|---|---|---|
| `Function<T, R>` | `R apply(T t)` | one value | a (possibly different-typed) value | transforming a value |
| `Predicate<T>` | `boolean test(T t)` | one value | `boolean` | a yes/no check |
| `Supplier<T>` | `T get()` | nothing | a value | producing/lazily generating a value |
| `Consumer<T>` | `void accept(T t)` | one value | nothing | doing something with a value (e.g. printing it) |

A lambda expression is only legal where the compiler can determine the *target type* is a functional interface — the compiler needs to know exactly which single abstract method your lambda is meant to implement.

---

## 4. Lambda Expression Syntax

A lambda expression has the shape `(parameters) -> body`. The body is either a single expression (whose value is automatically returned) or a `{ }` block (which needs an explicit `return` if it produces a value):

```java
// Expression body — value is implicitly returned
(String a, String b) -> a.compareTo(b)

// Parameter types can usually be omitted; the compiler infers them
// from the functional interface's method signature
(a, b) -> a.compareTo(b)

// Single parameter: parentheses are optional
name -> name.length()

// Block body — needs an explicit `return`
(a, b) -> {
    int result = a.compareTo(b);
    return result;
}

// No parameters: empty parentheses are required
() -> "Hello!"
```

The compiler figures out the parameter types by looking at the functional interface the lambda is being assigned to (this is why `(a, b) -> a.compareTo(b)` is legal for a `Comparator<String>` — the compiler already knows both parameters must be `String`, so you don't have to spell it out).

Using the interfaces from the table above:

```java
import java.util.function.*;

Function<String, Integer> length = s -> s.length();
Predicate<String> isEmpty      = s -> s.isEmpty();
Supplier<String> greeting      = () -> "Hello!";
Consumer<String> printer       = s -> System.out.println(s);

System.out.println(length.apply("Java"));  // 4
System.out.println(isEmpty.test(""));      // true
System.out.println(greeting.get());        // Hello!
printer.accept("Streams next");            // Streams next
```

Each interface's single abstract method is what you actually call: `.apply(...)` for `Function`, `.test(...)` for `Predicate`, `.get()` for `Supplier`, `.accept(...)` for `Consumer`. The lambda you wrote becomes the *body* of that method.

---

## 5. Method References: An Even Shorter Form

If a lambda's entire body is just calling one already-existing method, you can skip the lambda syntax entirely and reference the method directly, using `::`:

```java
// Lambda that just delegates to an existing method...
Function<String, Integer> length1 = s -> s.length();

// ...is identical in behavior to this method reference
Function<String, Integer> length2 = String::length;
```

`String::length` reads as "the `length` method on `String`, called on whatever argument gets passed in." There are a few shapes of method reference:

- `ClassName::staticMethod` — e.g. `Integer::parseInt`.
- `ClassName::instanceMethod` — e.g. `String::compareTo` (the first parameter becomes the instance the method is called on, the rest become its arguments).
- `object::instanceMethod` — e.g. `System.out::println` (calling `println` on the already-existing `System.out` object).
- `ClassName::new` — a constructor reference, e.g. `ArrayList::new`.

Method references are purely a shorthand — anything expressible as a method reference could also be written as an equivalent (slightly longer) lambda. Reach for one whenever a lambda would do nothing but forward its arguments straight into an existing method.

---

## 6. Code Example: Three Ways to Sort a List

Here's the progression from Section 1's anonymous-class version, through a lambda, to a method reference — same behavior, decreasing ceremony:

```java
import java.util.*;

public class SortNames {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>(List.of("Charlie", "alice", "Bob"));

        // Version 1: anonymous inner class (pre-Java 8 style)
        Collections.sort(names, new Comparator<String>() {
            @Override
            public int compare(String a, String b) {
                return a.compareTo(b);
            }
        });
        System.out.println(names); // [Bob, Charlie, alice]

        // Version 2: lambda expression — identical behavior, far less code
        Collections.sort(names, (a, b) -> a.compareTo(b));
        System.out.println(names); // [Bob, Charlie, alice]

        // Version 3: method reference — the lambda body was just a method call
        names.sort(String::compareTo);
        System.out.println(names); // [Bob, Charlie, alice]
    }
}
```

All three print the same result: `[Bob, Charlie, alice]`. `String.compareTo` compares strings by character (Unicode code point) values, and uppercase letters sort before lowercase ones (`'B'` is 66, `'C'` is 67, `'a'` is 97) — so `"Bob"` and `"Charlie"` (both starting with an uppercase letter) sort before `"alice"` (starting with a lowercase one), regardless of which of the three syntaxes expresses the comparison.

---

## 7. Common Mistakes

- **Trying to use a lambda where the target type isn't actually a functional interface.** If an interface has two or more abstract methods, the compiler has no way to know which one your lambda is supposed to implement, and you'll get a compile error. Lambdas only work against single-abstract-method interfaces.
- **Capturing a local variable in a lambda that isn't effectively final.** A lambda can read a local variable from its surrounding scope, but only if that variable is never reassigned after being initialized (a rule called "effectively final"). This fails to compile:

```java
int count = 0;
Runnable increment = () -> {
    count++; // COMPILE ERROR: variable used in lambda should be final or effectively final
};
```

Because `count++` reassigns `count`, the compiler rejects the capture — a lambda can *read* a snapshot of an enclosing local variable, but it cannot reach back out and mutate the original variable itself.

**Interview angle:** "What is a functional interface, and why does Java need one for lambdas to work?" is a common warm-up question. Interviewers want to hear the precise definition (exactly one abstract method — not "any interface"), that lambdas are essentially inline implementations of that one method, and that the *effectively final* capture rule exists because a lambda might be invoked later, possibly on a different thread, by which point a plain mutable local variable could have already changed or gone out of scope entirely.

---

## 8. Hands-On Exercises

### Exercise 1 — Rewrite three anonymous classes as lambdas

Write three tiny anonymous-inner-class implementations: a `Runnable` that prints `"running"`, a `Comparator<Integer>` that sorts descending, and a custom functional interface `interface Greeter { String greet(String name); }` implemented to return `"Hello, " + name`. Rewrite all three as lambdas and confirm (by reading, since this repo has no build system) they express identical behavior with far less code.

### Exercise 2 — Method reference scavenger hunt

For each of these lambdas, write the equivalent method reference: `s -> s.toUpperCase()`, `s -> Integer.parseInt(s)`, `s -> System.out.println(s)`. Identify which "shape" of method reference (instance method on a parameter, static method, or method on an existing object) each one is.

### Exercise 3 — Trigger the effectively-final compile error on purpose

Write a small class with a `main` method that declares an `int total = 0;`, defines a lambda that reads `total` inside a `System.out.println`, and then reassigns `total` on a later line. Note (in a comment) exactly what the compiler error message says, and explain in one sentence why Java enforces this rule.

---

## 9. Interview Q&A

### Q1. What is a functional interface?

**Answer:** An interface with exactly one abstract method. It may have any number of `default` or `static` methods, but only one method has no body — that single method is what a lambda expression or method reference implements. `Runnable`, `Comparator<T>`, and the `java.util.function` interfaces (`Function`, `Predicate`, `Supplier`, `Consumer`) are all functional interfaces.

---

### Q2. What's the difference between a lambda expression and an anonymous inner class?

**Answer:** Functionally, for implementing a single-method interface, they're largely interchangeable — a lambda is syntactic sugar that avoids writing out the full `new Interface() { @Override ... }` boilerplate. The practical differences are conciseness (a lambda is typically one line) and how `this` behaves inside them (an anonymous class has its own `this`, referring to the anonymous class instance; a lambda's `this` refers to the enclosing class instance, since a lambda doesn't create a new class scope of its own).

---

### Q3. What does "effectively final" mean, and why does it matter for lambdas?

**Answer:** A local variable is effectively final if it's assigned exactly once and never reassigned afterward, even though it isn't explicitly marked `final`. A lambda can only capture (read) local variables that are effectively final, because the lambda might be executed later or on a different thread, after the original variable's stack frame may no longer exist — capturing a stable snapshot avoids that inconsistency.

---

### Q4. What is a method reference, and when would you use one over a lambda?

**Answer:** A method reference (`ClassName::methodName`, `object::methodName`, or `ClassName::new`) is shorthand for a lambda whose entire body is a single existing method call. Use one whenever a lambda would do nothing but forward its argument(s) directly into an existing method — `String::compareTo` instead of `(a, b) -> a.compareTo(b)`, for example — since it's shorter and communicates "this just delegates" clearly.

---

### Q5. Can you use a lambda for an interface with two abstract methods?

**Answer:** No. Lambdas can only target functional interfaces — interfaces with exactly one abstract method — because the compiler needs to know unambiguously which method the lambda's body is implementing. An interface with two or more abstract methods requires a full class (or anonymous class) implementation instead.

---

> 🧠 **Memory hook:** "A lambda is a sticky note, not a memo — same instruction, none of the ceremony — and it can only be stuck to something with exactly one open slot (a functional interface)."
