# Inheritance and Polymorphism in Java — Complete Guide

## Table of Contents
1. [Core Concepts: Inheritance (IS-A) & Polymorphism](#1-core-concepts-inheritance-is-a--polymorphism)
2. [Compile-Time vs Runtime Polymorphism](#2-compile-time-vs-runtime-polymorphism)
3. [Virtual Method Invocation & Dynamic Dispatch](#3-virtual-method-invocation--dynamic-dispatch)
4. [The `super` Keyword and Constructor Order](#4-the-super-keyword-and-constructor-order)
5. [The Fragile Base Class Problem](#5-the-fragile-base-class-problem)
6. [Real-World Example: Multi-Tier Payment Processor](#6-real-world-example-multi-tier-payment-processor)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Core Concepts: Inheritance (IS-A) & Polymorphism

In Java:
- **Inheritance (`extends`)**: Allows a subclass to acquire fields and methods of a parent class.
- **Polymorphism ("many forms")**: Allows treating a subclass instance as an instance of its superclass or interface.

```
                  ┌──────────────────────┐
                  │       Vehicle        │
                  │   + startEngine()    │
                  └──────────┬───────────┘
                             │ extends
           ┌─────────────────┴─────────────────┐
           ▼                                   ▼
┌──────────────────────┐            ┌──────────────────────┐
│         Car          │            │      Motorcycle      │
│   + startEngine()    │            │   + startEngine()    │
└──────────────────────┘            └──────────────────────┘
```

---

## 2. Compile-Time vs Runtime Polymorphism

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Compile-Time (Static) Polymorphism: Method Overloading   │
│    Resolved by method signature at compile time.            │
│    e.g., search(String query), search(String query, int max)│
├─────────────────────────────────────────────────────────────┤
│ 2. Runtime (Dynamic) Polymorphism: Method Overriding        │
│    Resolved via JVM vtable lookup based on heap object type.│
│    e.g., Vehicle v = new Car(); v.startEngine();            │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Virtual Method Invocation & Dynamic Dispatch

In Java, all non-static, non-private, non-final methods are **virtual** by default:

```java
public abstract class Notification {
    public abstract void send(String message);
}

public class EmailNotification extends Notification {
    @Override
    public void send(String message) {
        System.out.println("Sending Email: " + message);
    }
}

public class SmsNotification extends Notification {
    @Override
    public void send(String message) {
        System.out.println("Sending SMS: " + message);
    }
}

// Polymorphic Dispatch:
List<Notification> channelList = List.of(new EmailNotification(), new SmsNotification());
for (Notification n : channelList) {
    n.send("Flash sale is live!"); // Dynamically resolves to correct method!
}
```

---

## 4. The `super` Keyword and Constructor Order

When constructing a subclass, the superclass constructor **must execute first**:

```java
public class Employee {
    private final String id;
    public Employee(String id) {
        this.id = id;
        System.out.println("1. Employee constructor executed");
    }
}

public class Manager extends Employee {
    private final int teamSize;
    public Manager(String id, int teamSize) {
        super(id); // Must be the first statement in constructor
        this.teamSize = teamSize;
        System.out.println("2. Manager constructor executed");
    }
}
```

---

## 5. The Fragile Base Class Problem

Inheritance creates a tight coupling between parent and child classes. Modifying a base class method can unexpectedly break subclass invariants.

```
❌ Fragile Base Class:
If BaseClass.add() calls BaseClass.addAll(), and SubClass overrides
both methods with its own counting logic, calling sub.addAll() results
in double-counting! Favor Composition over Inheritance to prevent this.
```

---

## 6. Real-World Example: Multi-Tier Payment Processor

```java
public sealed interface PaymentMethod permits CreditCardPayment, UpiPayment, CryptoPayment {
    boolean executePayment(double amount);
}

public record CreditCardPayment(String cardNumber, String cvv) implements PaymentMethod {
    @Override
    public boolean executePayment(double amount) {
        System.out.println("Charging $" + amount + " to Credit Card " + cardNumber);
        return true;
    }
}

public record UpiPayment(String vpa) implements PaymentMethod {
    @Override
    public boolean executePayment(double amount) {
        System.out.println("Routing $" + amount + " via UPI VPA: " + vpa);
        return true;
    }
}

public record CryptoPayment(String walletAddress) implements PaymentMethod {
    @Override
    public boolean executePayment(double amount) {
        System.out.println("Transferring $" + amount + " in stablecoin to " + walletAddress);
        return true;
    }
}
```

---

## 7. Interview Q&A

**Q: Can you override a `static` method in Java?**  
*Answer:* No. Static methods are bound at compile time based on the reference type (method hiding), not dynamic runtime dispatch.

**Q: What does the `sealed` keyword introduced in Java 17 achieve in domain modeling?**  
*Answer:* `sealed` permits only explicitly declared classes to extend or implement the interface. This gives complete control over class hierarchies (algebraic data types) and enables exhaustive pattern matching without needing fallback cases.
