# 01 — Classes, Objects, and Constructors

> A comprehensive reference covering why loose variables stop scaling, how classes and objects solve that, and how constructors (including the implicit default one) actually build an object.

---

## Table of Contents

1. [The Problem: Passing Loose Variables Everywhere](#1-the-problem-passing-loose-variables-everywhere)
2. [The Analogy: A Cookie Cutter and Its Cookies](#2-the-analogy-a-cookie-cutter-and-its-cookies)
3. [Anatomy of a Class: Fields, `new`, and Objects](#3-anatomy-of-a-class-fields-new-and-objects)
4. [Constructors, the Implicit No-Arg Constructor, and `this`](#4-constructors-the-implicit-no-arg-constructor-and-this)
5. [Class vs Object: Quick Comparison](#5-class-vs-object-quick-comparison)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Passing Loose Variables Everywhere

Imagine you're tracking people in a small program: a name, an age, an email. At first, three separate variables — `name`, `age`, `email` — feel manageable. Now you need to track a *second* person. Do you make `name2`, `age2`, `email2`? A third? A hundred?

Worse, once you have functions that operate on a person — `printPerson`, `isAdult`, `sendEmail` — each one now needs three separate parameters instead of "the person." Pass them in the wrong order once (swap `age` and something else that's also an `int`) and the compiler won't catch it, because as far as Java is concerned, they're just three unrelated `int`/`String` values with no enforced relationship to each other.

The underlying problem: **once related data grows past a couple of fields, treating each field as an independent variable becomes unwieldy and error-prone.** You need a way to bundle related data — and the behavior that operates on it — into a single, reusable unit.

---

## 2. The Analogy: A Cookie Cutter and Its Cookies

**Real-world analogy:** a **class** is a cookie cutter. It defines a shape once — round, star-shaped, whatever — but it isn't a cookie you can eat. An **object** is an actual cookie stamped out using that cutter. You can stamp out as many cookies as you like from the same cutter, and each one is a separate, independent cookie — decorating one doesn't change the others, and eating one doesn't destroy the cutter.

In Java terms: you write a `class` definition exactly once, describing what fields (data) and methods (behavior) every instance of it will have. Then, every time you use the `new` keyword, you stamp out a fresh, independent **object** — formally called an *instance* of that class — with its own copy of those fields.

---

## 3. Anatomy of a Class: Fields, `new`, and Objects

A class declaration bundles two things together:

- **Fields** — variables that belong to the class, describing the data each object will hold (e.g. `name`, `age`).
- **Methods** — functions that belong to the class, describing behavior (covered more in later lessons; this lesson focuses on fields and construction).

```java
public class Person {
    String name;
    int age;
}
```

This alone doesn't create any people — it only defines the *shape* a `Person` object will have. To actually get a usable object, you use the `new` keyword, which:

1. Allocates memory for a brand-new object matching the class's shape.
2. Runs a **constructor** (covered next) to initialize its fields.
3. Returns a reference to that new object, which you typically store in a variable.

```java
Person alice = new Person();
alice.name = "Alice";
alice.age = 30;
```

Here, `alice` is a variable holding a reference *to* the object, not the object itself sitting inside the variable. Two different `Person` objects created this way are completely independent — changing `alice.age` has zero effect on any other `Person` object.

---

## 4. Constructors, the Implicit No-Arg Constructor, and `this`

A **constructor** is a special block of code, named exactly the same as the class, with no return type (not even `void`), that runs automatically when `new` creates an object. Its job is to set the object up in a valid initial state.

If you don't write *any* constructor yourself, Java silently supplies an **implicit no-argument constructor** that does nothing but leave every field at its default value (`0` for numbers, `false` for `boolean`, `null` for objects like `String`). That's what let the previous section write `new Person()` with no arguments at all — `Person` never declared a constructor, so Java provided one for free.

The moment you write **any** constructor of your own, that free implicit one disappears. If you want a no-arg constructor *and* a constructor that takes arguments, you must now write both explicitly.

Inside a constructor, `this` refers to **the specific object currently being constructed** — it's how you distinguish a field from a constructor parameter that happens to share the same name:

```java
public class Person {
    String name;
    int age;

    public Person(String name, int age) {
        this.name = name;   // this.name = the field; name = the parameter
        this.age = age;
    }

    public static void main(String[] args) {
        Person alice = new Person("Alice", 30);
        Person bob = new Person("Bob", 25);

        System.out.println(alice.name + " is " + alice.age);
        System.out.println(bob.name + " is " + bob.age);
    }
}
```

Tracing this by hand: `alice` is constructed with `name = "Alice"`, `age = 30`; `bob` is constructed independently with `name = "Bob"`, `age = 25`. The two `println` calls produce:

```
Alice is 30
Bob is 25
```

Note that `Person` no longer has an implicit no-arg constructor — because a constructor with two parameters was written explicitly, calling `new Person()` with no arguments would now be a compile error.

---

## 5. Class vs Object: Quick Comparison

| | **Class** | **Object** |
|---|---|---|
| What it is | A blueprint / template | A concrete instance built from that blueprint |
| How many exist | One definition in your source code | As many as you `new` up at runtime |
| Holds actual data? | No — only describes what data instances will have | Yes — each object has its own field values |
| Created with | `class` keyword (a definition, compiled once) | `new` keyword (creates a new instance each time) |
| Analogy | The cookie cutter | A single cookie stamped from it |

---

## 6. Common Mistakes

- **Forgetting that defining any constructor removes the implicit no-arg one.** Adding a `Person(String name, int age)` constructor and then still calling `new Person()` elsewhere in the code will fail to compile, because Java no longer generates the free no-arg constructor once you've written one yourself.
- **Confusing the class with an object.** `Person` is not "a person" — it's the definition of what a person object looks like. Saying "I have a `Person`" is loose shorthand for "I have an object that is an *instance* of the `Person` class." This distinction matters once inheritance and polymorphism (later lessons) are in play.

**Interview angle:** "What's the difference between a class and an object?" is a near-universal warm-up question. Interviewers are listening for the blueprint/instance distinction stated precisely, plus a demonstration that you understand `new` is what actually allocates memory and triggers a constructor — many candidates can recite "class vs object" as a memorized definition but stumble when asked to trace through what `new Person("Alice", 30)` actually does step by step.

---

## 7. Hands-On Exercises

You only need a JDK and a text editor for these — no IDE or build tool required.

### Exercise 1 — Write and run a two-field class

Create a file `Book.java` with a `Book` class holding `title` (String) and `pages` (int) fields, a constructor that sets both, and a `main` method that creates two different `Book` objects and prints each one's title and page count. Compile with `javac Book.java` and run with `java Book`.

### Exercise 2 — Prove the implicit constructor disappears

Start with a class that has no constructor at all, and confirm `new YourClass()` compiles. Then add a constructor that takes one parameter, and confirm the previously-working no-arg call now fails to compile with an error mentioning that no suitable constructor was found. Read the exact compiler error message.

### Exercise 3 — Independence of objects

Create two objects of the same class, change a field on only one of them, and print both objects' fields to confirm the other object was completely unaffected.

---

## 8. Interview Q&A

### Q1. What is the difference between a class and an object?

**Answer:** A class is a blueprint or template that defines what fields and methods its instances will have; it doesn't hold any actual data by itself. An object is a concrete instance created from that blueprint using the `new` keyword, with its own independent copy of the class's fields.

---

### Q2. What happens if you don't write a constructor for a class?

**Answer:** Java automatically supplies an implicit no-argument constructor that initializes every field to its default value (`0`, `false`, or `null` depending on the type). This implicit constructor disappears the moment you define any constructor of your own — at that point you must explicitly write a no-arg constructor too if you still want one.

---

### Q3. What does `this` refer to inside a constructor?

**Answer:** `this` refers to the specific object currently being constructed. It's most commonly used to disambiguate between a field and a constructor parameter that share the same name, e.g. `this.age = age;` assigns the parameter's value to the object's field.

---

### Q4. Are two objects created from the same class independent of each other?

**Answer:** Yes. Each call to `new` allocates a separate block of memory for that object's fields. Modifying one object's fields has no effect on any other object, even if both were created from the exact same class using the exact same constructor arguments.

---

### Q5. Can a class have more than one constructor?

**Answer:** Yes — this is called constructor overloading. A class can define multiple constructors as long as each has a different parameter list (different number and/or types of parameters), letting objects be created in more than one way, e.g. `Person(String name)` defaulting age separately, alongside `Person(String name, int age)`.

---

> 🧠 **Memory hook:** "The class is the cookie cutter; `new` is the stamping motion; the object is the cookie — same cutter, endless independent cookies."
