# 02 — Variables, Data Types, and Operators

> A comprehensive reference covering Java's primitive types, variable declaration, static typing, and the arithmetic/relational/logical operators every program relies on.

---

## Table of Contents

1. [The Problem: A Program Needs Somewhere to Put Things](#1-the-problem-a-program-needs-somewhere-to-put-things)
2. [The Analogy: Labeled Storage Boxes of Fixed Shapes](#2-the-analogy-labeled-storage-boxes-of-fixed-shapes)
3. [Primitive Types, Declaration, and Static Typing](#3-primitive-types-declaration-and-static-typing)
4. [Operators: Arithmetic, Relational, and Logical](#4-operators-arithmetic-relational-and-logical)
5. [Code Example: Declaring, Printing, and Integer Division](#5-code-example-declaring-printing-and-integer-division)
6. [Primitive Types at a Glance](#6-primitive-types-at-a-glance)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: A Program Needs Somewhere to Put Things

A program that can't store data is useless. Even the simplest real program needs to hold a person's age, a product's price, a customer's name, and a flag saying whether an order shipped — all at once, all different *kinds* of data. An age is a whole number. A price usually needs decimal precision. A name is text. A shipped/not-shipped flag is one of exactly two states.

If a language let you store an age as a decimal, add text to it accidentally, or silently interpret a price as a whole number and drop the cents, your program would produce quietly wrong results instead of loud, obvious errors. The problem this chapter answers: **how does a program hold different kinds of data safely, in a way that catches mistakes before the program ever runs?**

---

## 2. The Analogy: Labeled Storage Boxes of Fixed Shapes

**Real-world analogy:** picture a set of storage boxes, each a fixed, different shape — a shoebox, a small jewelry box, a large moving box. You physically cannot fit a football into a shoebox, no matter how hard you try; the shape itself prevents the mistake before you even attempt it. Each box is also labeled, so anyone looking at it instantly knows what kind of thing belongs inside.

**Java's primitive types are those fixed-shape boxes.** An `int` variable is shaped to hold a whole number; it cannot hold `3.5` any more than a shoebox can hold a football. Declaring a variable is choosing which shaped box you want, and labeling it (giving it a type) up front means the compiler — not a confused user, weeks later — catches the mistake if you try to put the wrong kind of value in.

---

## 3. Primitive Types, Declaration, and Static Typing

Java has eight **primitive types** — simple, built-in value types that are not objects and hold their data directly, not through a reference:

- **`int`** — a whole number (the default choice for integers in everyday code).
- **`long`** — a whole number with a much larger range than `int`, for when `int` isn't big enough.
- **`double`** — a decimal (floating-point) number (the default choice for decimals).
- **`float`** — a decimal number with less precision than `double`, used less often in everyday code.
- **`boolean`** — exactly `true` or `false`, nothing else.
- **`char`** — a single character.
- **`byte`** and **`short`** — smaller whole-number types, used mainly to save memory in large arrays or interact with binary data (Phase 3 covers arrays).

Declaring a variable means stating its type and giving it a name; you can declare and initialize (assign a first value) in one line:

```java
int age = 30;
double price = 19.99;
boolean isShipped = false;
char grade = 'A';
```

The crucial idea underneath all of this: **Java is statically and strongly typed.** "Statically typed" means every variable's type is fixed the moment it's declared and is checked by the compiler *before* the program ever runs — not discovered by accident at runtime. "Strongly typed" means the compiler doesn't silently let you use a value where its type doesn't fit — assigning a `double` value directly to an `int` variable, for instance, is a compile error, not a runtime surprise. This is exactly the shoebox-and-football guarantee from the analogy, enforced by the compiler instead of by physical shape.

---

## 4. Operators: Arithmetic, Relational, and Logical

Operators combine or compare values:

- **Arithmetic** — `+`, `-`, `*`, `/` (division), `%` (remainder/modulo). These work on numeric types (`int`, `double`, `long`, and so on).
- **Relational** — `<`, `>`, `<=`, `>=`, `==` (equal to), `!=` (not equal to). These compare two values and always produce a `boolean` result (`true` or `false`).
- **Logical** — `&&` (logical AND), `||` (logical OR), `!` (logical NOT). These combine `boolean` values — `true`/`false` — into a single `boolean` result, and are how you write compound conditions like "age is at least 18 **and** has a valid ID."

A subtlety worth calling out immediately: `=` and `==` look similar but do completely different things. `=` is the **assignment** operator — it stores a value into a variable. `==` is the **relational equality** operator — it compares two values and produces `true` or `false`. Using one where you meant the other is a classic source of bugs, covered further in Common Mistakes below.

---

## 5. Code Example: Declaring, Printing, and Integer Division

```java
public class VariablesDemo {
    public static void main(String[] args) {
        int age = 30;
        double price = 19.99;
        boolean isShipped = false;
        char grade = 'A';

        System.out.println("Age: " + age);
        System.out.println("Price: " + price);
        System.out.println("Shipped? " + isShipped);
        System.out.println("Grade: " + grade);

        int wholeDivision = 7 / 2;      // int / int -> int result
        double exactDivision = 7.0 / 2; // double / int -> double result

        System.out.println("7 / 2 = " + wholeDivision);
        System.out.println("7.0 / 2 = " + exactDivision);
    }
}
```

Tracing the two division lines by hand: `7 / 2` is **integer division** because both `7` and `2` are `int` literals — Java computes the mathematically true result `3.5` and then **truncates** (discards) everything after the decimal point, giving exactly `3`, not `3.5` and not a rounded `4`. By contrast, `7.0 / 2` has a `double` operand (`7.0`), so Java performs the division as floating-point arithmetic and produces the full, exact result `3.5`. The printed output is:

```
Age: 30
Price: 19.99
Shipped? false
Grade: A
7 / 2 = 3
7.0 / 2 = 3.5
```

---

## 6. Primitive Types at a Glance

| Type | Size | Approximate Range | Default Value |
|---|---|---|---|
| `byte` | 8 bits | -128 to 127 | `0` |
| `short` | 16 bits | -32,768 to 32,767 | `0` |
| `int` | 32 bits | approx. -2.1 billion to 2.1 billion | `0` |
| `long` | 64 bits | approx. -9.2 quintillion to 9.2 quintillion | `0L` |
| `float` | 32 bits | large decimal range, ~7 significant digits of precision | `0.0f` |
| `double` | 64 bits | large decimal range, ~15-16 significant digits of precision | `0.0d` |
| `char` | 16 bits | a single Unicode character (0 to 65,535) | `'\u0000'` |
| `boolean` | conceptually 1 bit | `true` or `false` only | `false` |

("Default value" applies to instance/class fields that are declared but not explicitly initialized — Phase 2 covers fields in depth. Local variables inside a method, by contrast, have no default and must be explicitly initialized before use, or the compiler rejects the code.)

---

## 7. Common Mistakes

- Assuming `int / int` behaves like normal decimal division and being surprised when `7 / 2` silently produces `3` instead of `3.5` — Java does not raise an error here, it truncates silently, which can hide bugs in calculations like averages.
- Confusing `=` (assignment) with `==` (comparison) — writing `if (isShipped = true)` inside a condition assigns `true` to `isShipped` (and evaluates to `true`) instead of comparing it, which can silently change program state instead of just checking it.

**Interview angle:** Interviewers often ask "what does `7 / 2` evaluate to in Java, and why?" specifically to check whether you understand that the *types of the operands*, not just their values, determine how an operation behaves — the same mathematical division produces a different result depending on whether the operands are `int` or `double`. This ties directly into explaining why Java is called statically and strongly typed: the compiler locks in behavior based on declared types before the program ever runs.

---

## 8. Hands-On Exercises

### Exercise 1 — Predict, then verify

Before running any code, write down on paper what you predict each of these expressions evaluates to: `9 / 4`, `9.0 / 4`, `9 % 4`. Then write a small program that prints all three and check your predictions.

### Exercise 2 — Trigger a compile-time type error

Try to compile a line like `int total = 19.99;` (assigning a `double` literal directly to an `int` variable). Read the exact compiler error message and explain, in your own words, why Java refuses to compile this rather than silently truncating the value.

### Exercise 3 — Find the `=` vs `==` bug

Write a small program with a `boolean` variable named `isValid` set to `false`. Inside an `if` condition, deliberately write `if (isValid = true)` instead of `if (isValid == true)`, print something inside the `if` block, and run it. Explain why the block executes even though `isValid` started as `false`.

---

## 9. Interview Q&A

### Q1. What does it mean that Java is "statically and strongly typed"?

**Answer:** Statically typed means every variable's type is fixed at declaration and checked by the compiler before the program runs, not discovered at runtime. Strongly typed means the compiler doesn't allow a value to be used where its type doesn't fit — you can't assign a `double` directly to an `int` variable without an explicit conversion, for instance.

### Q2. What is the result of `7 / 2` in Java, and why?

**Answer:** `3`. Because both `7` and `2` are `int` literals, Java performs integer division, which truncates (discards) the decimal portion of the true mathematical result `3.5`, giving `3`.

### Q3. How do you get an exact (non-truncated) division result from two whole numbers?

**Answer:** Ensure at least one operand is a floating-point type, e.g. `7.0 / 2` or `7 / 2.0`, both of which produce `3.5` because the division is then performed as floating-point arithmetic.

### Q4. What's the difference between `=` and `==`?

**Answer:** `=` is the assignment operator — it stores a value into a variable. `==` is the relational equality operator — it compares two values and produces a `boolean` result. Mistakenly using `=` inside a condition assigns a value (and that assignment's result is used as the condition) instead of comparing.

### Q5. What's the difference between `int` and `Integer`... conceptually, why do primitives exist at all if Java also has objects?

**Answer:** Primitives (`int`, `double`, `boolean`, etc.) store their value directly and are not objects, which makes them fast and memory-efficient for everyday values. Java also provides object "wrapper" types (`Integer`, `Double`, `Boolean`) for situations that require an object — such as storing values in collections that only hold objects — covered in Phase 3.

---

> 🧠 **Memory hook:** "A variable's type is a fixed-shape box, chosen at declaration — the compiler checks the shape before the program ever runs."
