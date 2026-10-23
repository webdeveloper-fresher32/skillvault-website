# 02 — Encapsulation and Inheritance

> A comprehensive reference covering why directly-editable fields are dangerous, how access modifiers and getters/setters enforce valid state, and how `extends`/`super` let one class build on another.

---

## Table of Contents

1. [The Problem: Nothing Stops Invalid Data](#1-the-problem-nothing-stops-invalid-data)
2. [The Analogies: Dashboard vs Engine Bay, and the Animal Family Tree](#2-the-analogies-dashboard-vs-engine-bay-and-the-animal-family-tree)
3. [Encapsulation: Access Modifiers and Getters/Setters](#3-encapsulation-access-modifiers-and-getterssetters)
4. [Inheritance: `extends`, `super`, and Overriding](#4-inheritance-extends-super-and-overriding)
5. [Access Modifiers Compared](#5-access-modifiers-compared)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Nothing Stops Invalid Data

Picture the `Person` class from the previous lesson, with a plain public `int age` field. Anyone, anywhere in the codebase, can write:

```java
alice.age = -5;
```

Nothing about the language stops this. There's no way to say "an age must never be negative" — the field is just a bag of bits sitting there, directly writable by any code that has a reference to the object. As a codebase grows and more people touch it, this becomes a real liability: invalid states creep in silently, and by the time something crashes (or worse, silently produces wrong output), the actual bad assignment could have happened anywhere.

Separately, once you have a `Person` class, you'll often want a more specific version of it — an `Employee` is a person, plus a salary and maybe a job title. Rewriting `name` and `age` handling from scratch for `Employee` duplicates code and risks the two classes drifting apart over time.

The core problem: **how do you control how data gets modified, and how do you reuse an existing class's behavior in a more specific one, without duplicating it?**

---

## 2. The Analogies: Dashboard vs Engine Bay, and the Animal Family Tree

**Encapsulation** is a car's dashboard versus its engine bay. As a driver, you interact with the car through a small set of controlled interfaces — the steering wheel, the pedals, the ignition switch. You never reach directly into the engine bay and rewire the fuel injectors by hand; the dashboard exposes exactly the operations you're allowed to perform, and the car's internals enforce the rest (you can't press the accelerator hard enough to physically damage the engine — the systems in between prevent that). The engine bay isn't a secret, exactly — it's just not how you're meant to interact with the car day to day.

**Inheritance** is a species family tree. A `Dog` "is-a" `Animal` — it automatically has everything an `Animal` has (it eats, breathes, has a name), plus its own specifics (it barks). You don't redefine "has a name" separately for every species; you define it once on `Animal`, and every subtype inherits it for free while adding what makes it distinct.

---

## 3. Encapsulation: Access Modifiers and Getters/Setters

Java gives you access modifiers to control *who* can see or touch a field or method:

- **`private`** — visible only inside the same class.
- **(no modifier / "package-private")** — visible to any class in the same package.
- **`protected`** — visible in the same package, plus subclasses in other packages.
- **`public`** — visible from anywhere.

The standard pattern to enforce valid state is: make fields `private`, and expose controlled access through public methods — conventionally a **getter** (`getAge()`, just returns the value) and a **setter** (`setAge(int age)`, which can validate before assigning). This is the encapsulation pattern in practice: the field itself is hidden, but the outside world can still read and write it *through a checkpoint you control*.

```java
public class Person {
    private String name;
    private int age;

    public Person(String name, int age) {
        this.name = name;
        setAge(age); // route even the constructor through validation
    }

    public void setAge(int age) {
        if (age < 0) {
            throw new IllegalArgumentException("Age cannot be negative: " + age);
        }
        this.age = age;
    }

    public int getAge() {
        return age;
    }

    public String getName() {
        return name;
    }
}
```

Now `alice.age = -5;` won't even compile — `age` is `private`, so it isn't visible outside the class at all. The only way to change it is `alice.setAge(-5)`, which throws an exception instead of silently accepting invalid data.

---

## 4. Inheritance: `extends`, `super`, and Overriding

A class declares that it inherits from another using `extends`. The class being inherited from is the **superclass** (or parent class); the one doing the inheriting is the **subclass** (or child class). The subclass automatically gets every non-private field and method the superclass defines, and can add its own on top.

`super` is how a subclass's constructor calls the superclass's constructor — it must be the very first statement in the subclass constructor, and it's how you make sure the inherited part of the object (`name`, `age`) gets initialized the same validated way the superclass already handles it, instead of duplicating that logic.

```java
public class Employee extends Person {
    private double salary;

    public Employee(String name, int age, double salary) {
        super(name, age); // calls Person's constructor first
        this.salary = salary;
    }

    @Override
    public String toString() {
        return getName() + " (" + getAge() + "), salary: " + salary;
    }

    public static void main(String[] args) {
        Employee emp = new Employee("Carol", 40, 75000.0);
        System.out.println(emp);

        try {
            emp.setAge(-5);
        } catch (IllegalArgumentException e) {
            System.out.println("Rejected: " + e.getMessage());
        }
    }
}
```

*(In a real project, `Person` and `Employee` would live in their own `Person.java` and `Employee.java` files — Java only allows one `public` top-level class per file.)*

Tracing this by hand: `Employee`'s constructor calls `super("Carol", 40)`, which runs `Person`'s constructor, which calls `setAge(40)` — valid, so `age` becomes `40` and `name` becomes `"Carol"`. Back in `Employee`'s constructor, `salary` is set to `75000.0`. `System.out.println(emp)` implicitly calls `emp.toString()` — the `@Override` version — producing:

```
Carol (40), salary: 75000.0
```

Then `emp.setAge(-5)` runs the inherited (not overridden) `setAge`, which throws `IllegalArgumentException("Age cannot be negative: -5")`. The `catch` block prints:

```
Rejected: Age cannot be negative: -5
```

`@Override` is an **annotation** — a compiler-checked marker, not a runtime keyword — that tells the compiler "this method is meant to replace a method with the exact same signature from the superclass." If no matching method actually exists in the superclass (commonly due to a typo), the compiler produces an error immediately instead of silently letting you create an unrelated new method by accident.

---

## 5. Access Modifiers Compared

| Modifier | Same class | Same package | Subclass (different package) | Everywhere |
|---|---|---|---|---|
| `private` | Yes | No | No | No |
| *(none) — package-private* | Yes | Yes | No | No |
| `protected` | Yes | Yes | Yes | No |
| `public` | Yes | Yes | Yes | Yes |

---

## 6. Common Mistakes

- **Making fields `public` "just to make it easier."** This throws away every benefit of encapsulation described above — any code anywhere can set an invalid value, and you lose the one place (a setter) where you could add validation later without changing every caller.
- **Forgetting `@Override` and accidentally overloading instead of overriding.** Suppose `Person` intends to override `Object`'s `equals(Object other)` method for content comparison, but a typo produces this instead:

  ```java
  public class Person {
      // BUG: parameter type is Person, not Object — this OVERLOADS
      // Object.equals(Object), it does NOT override it.
      public boolean equals(Person other) {
          return this.name.equals(other.name);
      }
  }
  ```

  This compiles without error, because Java sees it as a brand-new overloaded method, not a matching override — the signature `equals(Person)` is different from `Object`'s `equals(Object)`. Anything that calls `equals` polymorphically through an `Object` reference (which is exactly how collections like `HashSet` and `List.contains` call it) will silently keep using `Object`'s default identity-based comparison. Adding `@Override` above the buggy method would have caused an immediate compile error — "method does not override a method from its superclass" — catching the typo right away.

**Interview angle:** "Why use getters and setters instead of public fields?" and "What's the difference between overloading and overriding?" are two of the most common OOP interview questions. For the first, emphasize validation and the ability to change internal representation later without breaking callers. For the second, be precise: overloading is same method name with a *different* parameter list, resolved at compile time; overriding is the *exact same* signature in a subclass, resolved at runtime — and `@Override` is your safety net for catching an accidental overload when you meant to override.

---

## 7. Hands-On Exercises

### Exercise 1 — Add validation to a setter

Write a `BankAccount` class with a `private double balance` field, a `deposit(double amount)` method that rejects negative amounts by throwing `IllegalArgumentException`, and a `getBalance()` getter. Write a `main` method that attempts both a valid and an invalid deposit, catching and printing the exception message for the invalid one.

### Exercise 2 — Build a two-level inheritance chain

Create an `Animal` class with a `name` field and a `protected` constructor, then a `Dog extends Animal` subclass that adds a `breed` field and calls `super(name)` in its constructor. Print a `Dog` object's full details from a `main` method to confirm the inherited field is accessible.

### Exercise 3 — Break `@Override` on purpose

Write a method in a subclass intended to override a superclass method, but give it a slightly different parameter type. Compile without `@Override` and confirm it compiles (silently creating an overload). Then add `@Override` and confirm the compiler now reports an error, pinpointing the mismatch.

---

## 8. Interview Q&A

### Q1. What is encapsulation, and why does it matter?

**Answer:** Encapsulation means hiding a class's internal fields (typically by making them `private`) and exposing controlled access through public methods like getters and setters. It matters because it lets the class enforce its own validity rules (e.g. rejecting a negative age) at the single point where a field can be changed, rather than trusting every piece of calling code to behave correctly.

---

### Q2. What is the difference between `protected` and package-private (default) access?

**Answer:** Package-private (no modifier) is visible to any class in the same package, but not to subclasses outside that package. `protected` extends that visibility to also include subclasses in other packages, specifically to support inheritance across package boundaries.

---

### Q3. What does `super(...)` do, and where must it appear?

**Answer:** `super(...)` calls a constructor of the immediate superclass, letting a subclass initialize the inherited part of its state using the superclass's own (possibly validated) constructor logic instead of duplicating it. It must be the first statement in a subclass constructor.

---

### Q4. What is the difference between method overloading and overriding?

**Answer:** Overloading means multiple methods in the same class (or an inherited one) share a name but differ in their parameter list; which one is called is decided at compile time based on the arguments. Overriding means a subclass provides a new implementation for a method with the exact same signature as one in its superclass; which version runs is decided at runtime based on the actual object's type (dynamic dispatch).

---

### Q5. What does the `@Override` annotation actually do?

**Answer:** It tells the compiler that the annotated method is intended to override a superclass (or interface) method with the same signature. If no such method actually exists — commonly due to a typo in the method name or parameter types — the compiler reports an error immediately, rather than silently letting the mismatched method exist as an unrelated overload.

---

> 🧠 **Memory hook:** "Private fields behind a dashboard, public controls in front — and `extends` hands a subclass the whole engine for free, plus room to bolt on more."
