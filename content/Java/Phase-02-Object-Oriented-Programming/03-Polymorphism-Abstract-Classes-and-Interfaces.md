# 03 — Polymorphism, Abstract Classes, and Interfaces

> A comprehensive reference covering how a parent-type reference can operate on any subtype through dynamic dispatch, and how abstract classes and interfaces each let you define a shared contract without knowing the concrete implementation in advance.

---

## Table of Contents

1. [The Problem: Code That Works With "Any Animal"](#1-the-problem-code-that-works-with-any-animal)
2. [The Analogy: The Universal Remote Control](#2-the-analogy-the-universal-remote-control)
3. [Polymorphism and Dynamic Dispatch](#3-polymorphism-and-dynamic-dispatch)
4. [Abstract Classes: Partial Blueprints](#4-abstract-classes-partial-blueprints)
5. [Interfaces: Pure Contracts (and `default` Methods)](#5-interfaces-pure-contracts-and-default-methods)
6. [Abstract Class vs Interface](#6-abstract-class-vs-interface)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Code That Works With "Any Animal"

Say you have `Dog` and `Cat` classes (both `extends Animal` from the inheritance lesson), and you want to write one loop that makes every animal in a zoo make its sound. Without a shared way to treat them uniformly, you'd need separate code paths per type:

```java
if (creature instanceof Dog) {
    System.out.println(((Dog) creature).bark());
} else if (creature instanceof Cat) {
    System.out.println(((Cat) creature).meow());
}
```

This doesn't scale — every time a new animal type is added, every single place that does this kind of check needs a new branch. What you actually want is to write "call `makeSound()` on this animal" once, and have it automatically do the right, species-specific thing regardless of which concrete subtype it happens to be — without the calling code needing to know or care.

---

## 2. The Analogy: The Universal Remote Control

**Real-world analogy:** a universal remote control has one "power" button. Press it, and it works — whether it's pointed at a Sony TV, a Samsung TV, or a random off-brand one. The remote's button doesn't contain brand-specific logic; each TV brand implements "what happens when power is pressed" in its own way internally, but from the remote's point of view, it's always the same single action: press power. You (the remote) don't need to know which TV you're pointed at — you just call `power()`, and whichever TV is actually listening handles it correctly on its own terms.

---

## 3. Polymorphism and Dynamic Dispatch

**Polymorphism** ("many forms") is the ability for a single reference type to refer to objects of different concrete subtypes, with method calls automatically resolving to whichever subtype's version is appropriate. In Java, a variable declared with a parent type can hold a reference to any subtype object:

```java
Animal a = new Dog("Rex"); // an Animal-typed reference pointing at a Dog object
```

When you call `a.makeSound()`, Java doesn't use the *declared* type of the variable (`Animal`) to decide which method body runs — it uses the *actual* type of the object it refers to at runtime (`Dog`). This is called **dynamic dispatch** (or "runtime polymorphism"): the decision of which overridden method body executes is made while the program is running, based on the real object, not at compile time based on the variable's declared type.

```java
public abstract class Animal {
    protected String name;

    public Animal(String name) {
        this.name = name;
    }

    public abstract String makeSound();
}

public class Dog extends Animal {
    public Dog(String name) { super(name); }

    @Override
    public String makeSound() {
        return name + " says Woof!";
    }
}

public class Cat extends Animal {
    public Cat(String name) { super(name); }

    @Override
    public String makeSound() {
        return name + " says Meow!";
    }
}

public class Zoo {
    public static void main(String[] args) {
        Animal[] animals = { new Dog("Rex"), new Cat("Whiskers") };
        for (Animal a : animals) {
            System.out.println(a.makeSound());
        }
    }
}
```

Tracing this by hand: the array holds one `Dog` object and one `Cat` object, both accessed through `Animal`-typed array slots. The loop calls `a.makeSound()` on each — for the first element, the actual object is a `Dog`, so `Dog`'s `makeSound()` runs; for the second, `Cat`'s does. The output is:

```
Rex says Woof!
Whiskers says Meow!
```

Notice the `Zoo` class never checked `instanceof Dog` or `instanceof Cat` anywhere — it just called `makeSound()` and trusted dynamic dispatch to route to the right implementation.

---

## 4. Abstract Classes: Partial Blueprints

An **abstract class** (declared with the `abstract` keyword, as `Animal` is above) is a class that's explicitly incomplete — it can declare **abstract methods**, which have a signature but no body (`public abstract String makeSound();`, ending in a semicolon, no `{ }`). An abstract class:

- **Cannot be instantiated directly** — `new Animal("Generic")` is a compile error, because `Animal` doesn't fully specify what `makeSound()` does.
- **Can still hold real, shared state and concrete methods** — `Animal`'s `name` field and its constructor are fully real and inherited by every subclass; only `makeSound()` is left as a promise each subclass must keep.
- **Forces subclasses to fill in the gaps** — any concrete (non-abstract) subclass *must* override every abstract method, or the compiler rejects it.

Abstract classes are the right tool when subtypes genuinely share meaningful state or common concrete behavior (here: every `Animal` has a `name` and a real constructor), but also each need to do at least one thing differently.

---

## 5. Interfaces: Pure Contracts (and `default` Methods)

An **interface** is a purer contract: historically, it could declare *only* method signatures (no fields holding per-instance state, no constructors) — a class that `implements` an interface promises to provide real implementations for all of its methods.

```java
public interface Powerable {
    void powerOn();

    default void restart() {
        // a default method: a real body ships inside the interface itself
        powerOn();
    }
}
```

`default` methods (added in Java 8) are the modern addition to that "pure contract" idea: an interface method *can* now ship with a real body, giving every implementing class a usable default behavior for free, while still allowing any implementing class to override it if it needs different behavior. Unlike an abstract class, a class can `implements` **multiple** interfaces at once — Java doesn't allow extending more than one class, but a class can fulfill as many interface contracts as it needs.

---

## 6. Abstract Class vs Interface

| | **Abstract Class** | **Interface** |
|---|---|---|
| Instance state (fields) | Yes — full fields with real values | No per-instance fields (only `static final` constants) |
| Constructors | Yes — subclasses call them via `super(...)` | No constructors |
| Multiple inheritance | A class can `extends` only one | A class can `implements` many |
| Method bodies | Freely mixes abstract and concrete methods | Traditionally none; `default`/`static` methods now allowed |
| When to use | Subtypes share real state/behavior, plus some type-specific logic | You just need to guarantee "this class can do X," possibly across otherwise-unrelated classes |

---

## 7. Common Mistakes

- **Trying to instantiate an abstract class directly.** `new Animal("Generic")` is a compile error — "Animal is abstract; cannot be instantiated" — because the compiler can't guarantee `makeSound()` has any real implementation to run.
- **Confusing overloading with overriding when trying to fulfill an abstract method.** Suppose a subclass tries to satisfy `Animal`'s `abstract String makeSound();` but introduces an extra parameter by mistake:

  ```java
  public class Dog extends Animal {
      public Dog(String name) { super(name); }

      // BUG: this OVERLOADS makeSound (different parameter list),
      // it does NOT override the no-arg abstract method.
      public String makeSound(String volume) {
          return name + " says WOOF (" + volume + ")";
      }
  }
  ```

  Because `makeSound(String)` has a different signature than the abstract `makeSound()`, it does not fulfill the abstract method at all. `Dog` still has an unfulfilled abstract method inherited from `Animal`, so the compiler rejects the class outright: "Dog is not abstract and does not override abstract method makeSound() in Animal." This is the compiler catching a signature typo immediately, rather than letting it silently produce a `Dog` that's secretly still incomplete.

**Interview angle:** "When would you use an abstract class instead of an interface?" is one of the most common Java OOP interview questions, especially since Java 8's `default` methods narrowed the practical gap between them. The strongest answer leads with *state and constructors*: reach for an abstract class when subtypes genuinely share real fields and constructor logic (an `Animal`'s `name`), and reach for an interface when you only need to guarantee a capability (`Powerable`, `Comparable`) across classes that may otherwise be completely unrelated and might already extend something else.

---

## 8. Hands-On Exercises

### Exercise 1 — Build the `Animal`/`Dog`/`Cat` hierarchy

Type in the abstract `Animal` class, `Dog`, and `Cat` subclasses, and the `Zoo` example exactly as shown, across separate files (`Animal.java`, `Dog.java`, `Cat.java`, `Zoo.java`, since each is `public`). Compile all four with `javac *.java` and run `java Zoo`, confirming the output matches what was traced above.

### Exercise 2 — Confirm an abstract class can't be instantiated

Add a line `new Animal("Generic");` inside `Zoo`'s `main` method and recompile. Read the exact compiler error message and confirm it mentions that `Animal` is abstract.

### Exercise 3 — Add a third animal type and an interface

Add a `Bird extends Animal` class implementing `makeSound()` differently, and add it to the `animals` array without changing the loop in `Zoo` at all. Separately, write a small `Flyable` interface with an abstract `fly()` method and a `default` method `landingAnnouncement()` that just prints a fixed message, then have `Bird` implement it.

---

## 9. Interview Q&A

### Q1. What is polymorphism, concretely, in Java?

**Answer:** Polymorphism is the ability for a variable declared with a parent (or interface) type to hold a reference to any subtype object, with overridden method calls resolved at runtime based on the object's actual type rather than the variable's declared type — this runtime resolution is called dynamic dispatch.

---

### Q2. Why can't you instantiate an abstract class?

**Answer:** An abstract class can declare abstract methods that have no body — a signature with no implementation. Instantiating it directly would mean creating an object where calling that method has nothing to run, so the compiler forbids it outright; only a concrete subclass that has supplied real implementations for every abstract method can be instantiated.

---

### Q3. Can a class implement more than one interface? Can it extend more than one class?

**Answer:** A class can `implements` any number of interfaces, but can `extends` only one class. This is why interfaces are the tool of choice when a class needs to fulfill multiple unrelated capability contracts, especially since it may already extend some other class.

---

### Q4. What is the difference between method overloading and method overriding, in the context of abstract methods?

**Answer:** Overriding requires the exact same method signature (name and parameter types) as the one being replaced; overloading is a different signature under the same name. If a subclass tries to "override" an abstract method but accidentally changes the parameter list, it isn't overriding it at all — it's creating an unrelated overload, and the abstract method remains unfulfilled, which the compiler will reject.

---

### Q5. What are `default` methods on an interface, and why were they added?

**Answer:** `default` methods (Java 8+) let an interface provide a real, callable method body directly, instead of only bare method signatures. They were added mainly so existing interfaces in widely-used libraries could gain new methods without breaking every class that already implemented them — old implementers simply inherit the default behavior unless they choose to override it.

---

> 🧠 **Memory hook:** "A universal remote's power button always works the same way to press — which TV actually responds to it is decided the instant you press it, not when the remote was manufactured."
