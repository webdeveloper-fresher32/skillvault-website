# Classes, Objects, and Constructors in Java — Complete Guide

## Table of Contents
1. [Why Object-Oriented Design Matters in Java LLD Interviews](#1-why-object-oriented-design-matters-in-java-lld-interviews)
2. [Classes vs Objects: The Blueprint & Instance Model](#2-classes-vs-objects-the-blueprint--instance-model)
3. [Constructors: Initialization, Overloading, and this()](#3-constructors-initialization-overloading-and-this)
4. [Instance Variables vs Static (Class) Variables](#4-instance-variables-vs-static-class-variables)
5. [The Mutable Reference Leak Trap (Defensive Copying)](#5-the-mutable-reference-leak-trap-defensive-copying)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Object-Oriented Design Matters in Java LLD Interviews

Low-Level Design (LLD) interviews ask you to design systems like "Parking Lot," "Ride Sharing," or "Splitwise" as clean, working Java classes in 30-45 minutes. The interviewer evaluates whether you can:

- Identify the right **entities** (nouns) and turn them into classes.
- Give each entity the right **state** (attributes) and **behavior** (methods).
- Ensure **encapsulation** so internal states cannot be corrupted.
- Write robust, thread-safe constructors with proper validation.

---

## 2. Classes vs Objects: The Blueprint & Instance Model

A **class** is a blueprint. An **object** (or **instance**) is a concrete entity allocated on the JVM heap.

```
Class: Vehicle                       Objects (instances on heap):
┌─────────────────────┐              ┌────────────────────────┐
│ Vehicle              │             │ car1: Vehicle           │
│ - licensePlate       │  ──new()──▶ │   licensePlate="KA01"   │
│ - vehicleType        │             │   vehicleType=CAR       │
│ + honk()             │             └────────────────────────┘
└─────────────────────┘              ┌────────────────────────┐
                                      │ car2: Vehicle           │
                                      │   licensePlate="MH12"   │
                                      │   vehicleType=BIKE      │
                                      └────────────────────────┘
```

```java
public class Vehicle {
    private final String licensePlate;
    private final VehicleType vehicleType;

    public Vehicle(String licensePlate, VehicleType vehicleType) {
        if (licensePlate == null || licensePlate.isBlank()) {
            throw new IllegalArgumentException("License plate cannot be empty");
        }
        this.licensePlate = licensePlate;
        this.vehicleType = Objects.requireNonNull(vehicleType, "Vehicle type required");
    }

    public String honk() {
        return licensePlate + " says beep!";
    }

    public String getLicensePlate() { return licensePlate; }
    public VehicleType getVehicleType() { return vehicleType; }
}
```

---

## 3. Constructors: Initialization, Overloading, and this()

In Java, constructors initialize object state before any method can be called:
- **Default No-Arg Constructor**: Provided by JVM *only* if no other constructor is declared.
- **Constructor Overloading**: Multiple constructors with different parameters.
- **Constructor Chaining (`this(...)`)**: Delegates common validation to a single master canonical constructor.

```java
public class UserAccount {
    private final String id;
    private final String email;
    private final boolean active;

    // Primary Canonical Constructor
    public UserAccount(String id, String email, boolean active) {
        this.id = Objects.requireNonNull(id, "ID required");
        this.email = Objects.requireNonNull(email, "Email required");
        this.active = active;
    }

    // Overloaded convenience constructor with default active=true
    public UserAccount(String id, String email) {
        this(id, email, true); // Chains to canonical constructor
    }
}
```

---

## 4. Instance Variables vs Static (Class) Variables

- **Instance Variables**: Allocated per object instance on the heap. Each object has its own copy.
- **Static Variables**: Belong to the class itself, stored in the Metaspace/Heap, shared among all instances.

```java
public class TicketCounter {
    private static int globalSequence = 1000; // Shared across all tickets
    private final int ticketNumber;           // Unique per ticket instance

    public TicketCounter() {
        this.ticketNumber = ++globalSequence;
    }

    public int getTicketNumber() { return ticketNumber; }
}
```

---

## 5. The Mutable Reference Leak Trap (Defensive Copying)

A common bug in machine coding: exposing or accepting mutable collections without copying them. Callers outside can mutate the internal state of your class!

```java
// ❌ BROKEN: Escaping mutable reference
public class Order {
    private List<String> items;
    public Order(List<String> items) { this.items = items; } // External caller can mutate items!
    public List<String> getItems() { return items; }         // Caller can call getItems().clear()!
}

// ✅ SECURE: Defensive Copying
public class Order {
    private final List<String> items;

    public Order(List<String> items) {
        this.items = (items == null) ? List.of() : new ArrayList<>(items);
    }

    public List<String> getItems() {
        return Collections.unmodifiableList(items); // Read-only view!
    }
}
```

---

## 6. Hands-On Exercises

1. Design a `BankAccount` class with `accountId`, `balance`, and thread-safe `deposit(double amount)` and `withdraw(double amount)` methods.
2. Implement constructor chaining on a `ParkingSpot` class supporting compact, large, and electric spot categories.

---

## 7. Interview Q&A

**Q: Can a constructor be marked `final`, `static`, or `abstract` in Java?**  
*Answer:* No. A constructor cannot be inherited, so `final` is meaningless. A constructor belongs to object instantiation, so `static` is invalid. An `abstract` constructor cannot exist because constructors must initialize state.

**Q: What happens if an exception is thrown inside a constructor?**  
*Answer:* Object construction fails and no reference is returned to the caller. However, if the object registered `this` into an event listener or background thread *before* the exception, a "partially constructed object" can escape, which is a major concurrency vulnerability.
