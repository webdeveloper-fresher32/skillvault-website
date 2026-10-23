# 01 — var, Records and Sealed Classes

> A comprehensive reference covering local variable type inference with `var`, boilerplate-free immutable data carriers with `record`, and restricting a class hierarchy to a known, closed set with `sealed`.

---

## Table of Contents

1. [The Problem: Java Keeps Evolving, and Old Code Isn't "The Only Way"](#1-the-problem-java-keeps-evolving-and-old-code-isnt-the-only-way)
2. [The Analogy: Ordering "The Usual" and a Pre-Printed Form](#2-the-analogy-ordering-the-usual-and-a-pre-printed-form)
3. [var — Local Variable Type Inference](#3-var--local-variable-type-inference)
4. [Records — Data Carriers Without the Boilerplate](#4-records--data-carriers-without-the-boilerplate)
5. [Sealed Classes and Interfaces — Closing Off a Hierarchy](#5-sealed-classes-and-interfaces--closing-off-a-hierarchy)
6. [Traditional Class vs Record: Side by Side](#6-traditional-class-vs-record-side-by-side)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Java Keeps Evolving, and Old Code Isn't "The Only Way"

A huge amount of Java material in the wild — tutorials, Stack Overflow answers, legacy codebases you'll be asked to maintain — predates a series of genuinely useful additions to the language itself. If you only ever learn from code written for Java 8, you'll come away thinking that every immutable data class *must* be ten lines of hand-written fields, a constructor, getters, `equals`, `hashCode`, and `toString` — because that used to be true.

It no longer is. Since Java 10, 14, and 16-17 respectively, the language has added `var` (local type inference), `record` (concise immutable data carriers), and `sealed` classes/interfaces (closed, known hierarchies). None of these change what's *possible* in Java — everything they do could already be hand-written — but they remove enormous amounts of repetitive, error-prone boilerplate for extremely common patterns. The problem this lesson solves: knowing that this boilerplate is no longer required, so you don't keep writing (or maintaining) the long way by default.

---

## 2. The Analogy: Ordering "The Usual" and a Pre-Printed Form

**`var` is like ordering "the usual" at a coffee shop you visit every day.** The barista already knows exactly what that resolves to — a large oat-milk latte, no sugar — because the context makes it obvious. You don't need to spell out the full order every single time; you just need the context (what's on the right-hand side of the assignment) to make the answer unambiguous. If you walked into a shop you'd never been to and said "the usual," nobody could figure out what you meant — and that's exactly why `var` still needs an initializer the compiler can look at.

**A `record` is like a pre-printed form with fixed blanks.** Instead of hand-writing the same boilerplate paperwork every time — "here are the fields, here's a constructor, here's how to compare two of these for equality, here's how to print one" — you fill in the blanks once (the field names and types) and receive a complete, correctly-behaving, ready-to-use document. Nobody re-derives the form's structure from scratch each time; the form itself guarantees consistency.

**A `sealed` type is a guest list posted at the door.** Only the names on that list are allowed in — the compiler (and anyone reading the code) can trust that the hierarchy is complete and closed, rather than wondering whether some unknown class, written by someone else entirely, might show up and implement the interface in a way nobody accounted for.

---

## 3. var — Local Variable Type Inference

`var` lets you declare a local variable without writing out its type explicitly — the compiler infers it from the initializer expression, at **compile time**. This is a crucial distinction from dynamically-typed languages: `var` is not "Java going dynamic." The type is still fixed the moment the variable is declared, still checked by the compiler, and still cannot change later — `var` is purely a way to skip typing something the compiler can already see for itself.

```java
var name = "Ganesh";                    // inferred as String
var count = 10;                         // inferred as int
var ratio = 3.14;                       // inferred as double
var prices = new ArrayList<Double>();   // inferred as ArrayList<Double>

// The type is still fixed — this does NOT compile:
// count = "not a number";  // error: incompatible types
```

`var` only works for **local variables** — method-local variables, `for`-loop variables, and try-with-resources resources. It cannot be used for fields, method parameters, or method return types; the language deliberately restricts it to places where an initializer is always right there to infer from.

There's one sharp edge worth knowing up front: `var` infers from the *declared* type of the right-hand side, not from some smarter guess about intent. `var list = new ArrayList<>();` infers `ArrayList<Object>`, not `ArrayList<String>`, because without an explicit type argument or a target type to look at, `Object` is what the diamond operator (`<>`, which tells the compiler to infer the generic type argument from context) falls back to. Compare that to `List<String> list = new ArrayList<>();`, where the diamond correctly infers `String` because the *left-hand side* gives it a target type to match — `var` removes exactly that target.

---

## 4. Records — Data Carriers Without the Boilerplate

A huge fraction of classes in any real codebase exist purely to hold a fixed set of related values together — a coordinate, a range, a money amount and currency, an API response's fields — with no real behavior beyond storing and exposing that data. Before Java 16, writing one of these "plain data" classes correctly meant hand-writing:

- Private final fields
- A constructor assigning every field
- An accessor (getter) method per field
- `equals()` and `hashCode()` overrides consistent with each other
- A `toString()` override that's actually useful for debugging

Get any one of those wrong or forget it entirely, and you get subtle bugs — objects that look equal but aren't, or a `toString()` that just prints a memory address like `Point@4554617c`.

A `record` generates all of the above automatically from a one-line declaration:

```java
// Traditional, hand-written immutable class:
public final class PointOld {
    private final int x;
    private final int y;

    public PointOld(int x, int y) {
        this.x = x;
        this.y = y;
    }

    public int getX() { return x; }
    public int getY() { return y; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PointOld)) return false;
        PointOld other = (PointOld) o;
        return x == other.x && y == other.y;
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(x, y);
    }

    @Override
    public String toString() {
        return "PointOld{x=" + x + ", y=" + y + "}";
    }
}

// The same thing, as a record:
public record Point(int x, int y) {}
```

That one line generates: a canonical constructor `Point(int x, int y)`, accessor methods named exactly after the components — `x()` and `y()` (not `getX()`/`getY()` — records use the component's own name, not JavaBean-style prefixes), an `equals()`/`hashCode()` pair based on all components, and a `toString()`.

```java
Point p = new Point(3, 4);
System.out.println(p.x());       // 3
System.out.println(p.y());       // 4
System.out.println(p);           // Point[x=3, y=4]

Point p2 = new Point(3, 4);
System.out.println(p.equals(p2)); // true — equal because all components are equal
```

The generated `toString()` follows a specific, predictable format: `ClassName[component1=value1, component2=value2]` — for `Point(3, 4)` that's exactly `Point[x=3, y=4]`, not the `ClassName{field=value}` style you might hand-write yourself, and not the default `Object.toString()`'s class-name-plus-hashcode format.

A record's components are **implicitly `final`** — there is no way to reassign `x` or `y` after construction, matching the intent that a record is an immutable data carrier, not a general-purpose mutable class. A record can still implement interfaces and add its own methods (including a custom, validating constructor), but it cannot extend another class (it implicitly extends `java.lang.Record`) and it is implicitly `final` — you cannot subclass a record.

---

## 5. Sealed Classes and Interfaces — Closing Off a Hierarchy

Ordinarily, any class or interface in Java can be extended or implemented by absolutely anyone, anywhere, at any time — including code you'll never see, written after you've shipped. Most of the time that's fine, but sometimes you want the opposite guarantee: "I know, right now, the *complete* and *final* list of everything that can possibly be a `Shape`." A `sealed` type gives you exactly that.

```java
public sealed interface Shape permits Circle, Square {}

public record Circle(double radius) implements Shape {}
public record Square(double side) implements Shape {}
```

The `permits` clause names every class/interface allowed to directly extend or implement the sealed type — nothing else may. Each permitted subtype must itself be exactly one of: `final` (no further extension at all), `sealed` (extendable only by its own explicitly permitted list), or `non-sealed` (explicitly reopened to unrestricted extension). Records implementing a sealed interface, like `Circle` and `Square` above, automatically satisfy this — records are always implicitly `final`, so there's nothing further to declare.

The real payoff shows up once you combine a sealed hierarchy with pattern matching for `switch` (covered in the next lesson): because the compiler knows the *complete* set of possible subtypes, it can verify a `switch` over a sealed type has covered every case, with no `default` branch needed and no risk of silently missing a case that gets added later without anyone noticing.

---

## 6. Traditional Class vs Record: Side by Side

| | **Traditional class** | **`record`** |
|---|---|---|
| **Fields** | Hand-declared, any mutability you choose | Auto-declared from components, implicitly `private final` |
| **Constructor** | Hand-written | Auto-generated canonical constructor (customizable) |
| **Accessors** | Hand-written, typically `getX()` | Auto-generated, named after the component: `x()` |
| **`equals()`/`hashCode()`** | Hand-written (easy to get inconsistent) | Auto-generated, consistent by construction |
| **`toString()`** | Hand-written or the unhelpful default | Auto-generated: `ClassName[field=value, ...]` |
| **Mutability** | Whatever you write — mutable by default | Implicitly immutable — components can't be reassigned |
| **Can extend a class?** | Yes | No — implicitly extends `java.lang.Record` |
| **Can be extended?** | Yes, unless marked `final` | No — implicitly `final` |
| **Best for** | Classes with real behavior, mutable state, or an inheritance role | Plain, immutable data carriers |

**Common mistakes:**
- Using `var` where the inferred type genuinely isn't obvious from the line itself (e.g. `var result = process();`) — this trades a small amount of typing for a reader having to go find `process()`'s return type just to understand the code, which hurts readability instead of helping it.
- Writing `var list = new ArrayList<>();` and being surprised later that it's an `ArrayList<Object>` rather than the type you meant — without a target type on the left, the diamond operator has nothing to infer from and defaults to `Object`.
- Assuming a record's components are mutable, or trying to add a setter — components are implicitly `final`, and there is no `setX()`-style method generated; a record that needs to change should produce a new record instance instead.
- Forgetting that a sealed type's permitted subtypes must each be `final`, `sealed`, or `non-sealed`, and typically must live in the same module (or package, without a module system) as the sealed type itself.

**Interview angle:** Interviewers often ask "what problem do records solve?" or "walk me through what a record generates automatically" — the expected answer is the specific list (constructor, accessors named after the component, `equals`/`hashCode`, `toString`, implicit immutability), not just "it's shorter." A strong follow-up they may probe is whether you know `var` doesn't affect runtime typing at all — it's a compile-time-only convenience — and whether you can explain *why* `sealed` types pair naturally with exhaustive `switch` handling, which is where the two features connect directly with the next lesson.

---

## 7. Hands-On Exercises

### Exercise 1 — Rewrite a class as a record

Write a traditional `Rectangle` class by hand with `width` and `height` fields, a constructor, getters, `equals`, `hashCode`, and `toString`. Then rewrite it as a one-line `record Rectangle(double width, double height) {}`. Create one instance of each, print both with `System.out.println`, and compare the exact output.

### Exercise 2 — Add validation to a record's constructor

Records support a "compact canonical constructor" that can validate input before the fields are assigned, written as `public Range { if (low > high) throw new IllegalArgumentException("low > high"); }` (the parameter list is omitted entirely — it's implied from the record header — and no explicit field assignment is needed, since the compiler still assigns the fields for you afterward). Write a `record Range(int low, int high)` with this validation and confirm constructing `new Range(10, 5)` throws.

### Exercise 3 — Build a small sealed hierarchy

Declare `sealed interface PaymentMethod permits CreditCard, BankTransfer` with two record implementations. Write a method that takes a `PaymentMethod` and prints details differently depending on which concrete type it received (a plain `if`/`instanceof` chain is fine for now — pattern matching `switch` over this exact hierarchy is the next lesson).

---

## 8. Interview Q&A

### Q1. What does `var` actually do, and what does it *not* do?

**Answer:** `var` tells the compiler to infer a local variable's type from its initializer at compile time. The type is fixed the moment the variable is declared and is checked exactly as strictly as if you'd written it explicitly — `var` does not make Java dynamically typed, and it cannot be used without an initializer or for fields/parameters/return types.

### Q2. What exactly does declaring `record Point(int x, int y) {}` generate?

**Answer:** A canonical constructor `Point(int x, int y)`, accessor methods `x()` and `y()` named after the components, an `equals()`/`hashCode()` pair based on all components, and a `toString()` in the format `Point[x=..., y=...]`. The components are implicitly `private final`.

### Q3. Can a record be mutable, or extend another class?

**Answer:** No to both. A record's components are implicitly `final` and there are no generated setters — a record that needs a "changed" version produces a new instance. A record also cannot `extend` another class (it implicitly extends `java.lang.Record`), though it can implement interfaces.

### Q4. What problem does a `sealed` interface solve that a plain interface doesn't?

**Answer:** A plain interface can be implemented by any class anywhere, so code consuming it can never assume it has seen every possible implementation. A `sealed` interface's `permits` clause names the complete, closed set of allowed implementers, which lets both readers and the compiler treat the hierarchy as fully known — most usefully, enabling exhaustive `switch` handling with no `default` branch required.

### Q5. Why does `var list = new ArrayList<>();` infer `ArrayList<Object>` instead of a more specific type?

**Answer:** The diamond operator (`<>`) infers its type argument from context, and with `var` on the left there is no target type for it to match against — so it falls back to `Object`. Declaring the target type explicitly, e.g. `List<String> list = new ArrayList<>();`, gives the diamond something concrete to infer from.

---

> 🧠 **Memory hook:** "`var` skips saying the obvious; `record` fills in a pre-printed form; `sealed` posts the guest list at the door."
