# Method Overriding and Overloading in Java — Complete Guide

## Table of Contents
1. [Definitions: Static Polymorphism vs Dynamic Dispatch](#1-definitions-static-polymorphism-vs-dynamic-dispatch)
2. [Method Overloading: Signature, Rules, and Ambiguities](#2-method-overloading-signature-rules-and-ambiguities)
3. [Method Overriding: The @Override Annotation & Liskov Substitution](#3-method-overriding-the-override-annotation--liskov-substitution)
4. [Covariant Return Types in Java](#4-covariant-return-types-in-java)
5. [Exception Rules in Overriding](#5-exception-rules-in-overriding)
6. [Side-by-Side Comparison](#6-side-by-side-comparison)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Definitions: Static Polymorphism vs Dynamic Dispatch

```
┌─────────────────────────────────────────────────────────────┐
│ Overloading: Same method name, DIFFERENT parameter list.    │
│ Resolved at COMPILE TIME by the compiler based on types.    │
├─────────────────────────────────────────────────────────────┤
│ Overriding: Same method name, SAME signature in subclass.   │
│ Resolved at RUN TIME by the JVM based on actual heap object.│
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Method Overloading: Signature, Rules, and Ambiguities

A method signature in Java consists of:
`Method Name + Parameter Types (and order)`

> [!NOTE]
> Return type is **NOT** part of the method signature! You cannot overload a method simply by changing the return type.

```java
public class QueryBuilder {
    // 1. Base query
    public String build(String table) {
        return "SELECT * FROM " + table;
    }

    // 2. Overload: with limit
    public String build(String table, int limit) {
        return build(table) + " LIMIT " + limit;
    }

    // 3. Overload: with columns and condition
    public String build(String table, List<String> columns, String condition) {
        return "SELECT " + String.join(", ", columns) + " FROM " + table + " WHERE " + condition;
    }
}
```

---

## 3. Method Overriding: The @Override Annotation & Liskov Substitution

Always annotate overridden methods with `@Override`. It tells the compiler to verify that the method actually matches a superclass/interface signature, preventing subtle typos.

```java
public class Account {
    public double calculateInterest(double balance) {
        return balance * 0.03;
    }
}

public class SavingsAccount extends Account {
    @Override
    public double calculateInterest(double balance) {
        return balance * 0.06; // Specific savings interest
    }
}
```

---

## 4. Covariant Return Types in Java

In Java 5+, an overriding method in a subclass is permitted to return a **subtype** of the return type declared in the superclass:

```java
public class Animal {
    public Animal giveBirth() {
        return new Animal();
    }
}

public class Dog extends Animal {
    @Override
    public Dog giveBirth() { // Dog is a subtype of Animal — 100% legal covariant return!
        return new Dog();
    }
}

// Caller usage: No cast needed!
Dog puppy = new Dog().giveBirth();
```

---

## 5. Exception Rules in Overriding

When overriding a method that declares checked exceptions:
1. The subclass method can declare **fewer** or **narrower** checked exceptions, or **no** checked exceptions at all.
2. The subclass method **cannot** declare broader or new checked exceptions.
3. Unchecked exceptions (`RuntimeException`) have no restrictions.

```java
public class FileStorage {
    public void save(String data) throws java.io.IOException { ... }
}

public class MemoryStorage extends FileStorage {
    @Override
    public void save(String data) { // Legal: Omitting checked IOException because memory save cannot throw it!
        System.out.println("Saved in RAM");
    }
}
```

---

## 6. Side-by-Side Comparison

| Feature | Method Overloading | Method Overriding |
| :--- | :--- | :--- |
| **Location** | Within same class or hierarchy | Subclass overriding parent class method |
| **Parameters** | Must differ (count or type) | Must be identical |
| **Return Type** | Can be different | Must be identical or covariant |
| **Resolution** | Compile-time (Static binding) | Runtime (Dynamic dispatch) |
| **Private / Final** | Can be overloaded | Cannot be overridden |

---

## 7. Interview Q&A

**Q: Can you override a private or final method in Java?**  
*Answer:* No. `private` methods are not visible to subclasses, so defining the same method in a subclass simply creates a new independent method. `final` methods explicitly forbid overriding and will produce a compile error.
