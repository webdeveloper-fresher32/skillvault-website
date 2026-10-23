# Interface Segregation Principle (ISP) in Java — Complete Guide

## Table of Contents
1. [Core Philosophy: Lean Interfaces vs Fat Interfaces](#1-core-philosophy-lean-interfaces-vs-fat-interfaces)
2. [The Anti-Pattern: The Bloated "Worker" Interface](#2-the-anti-pattern-the-bloated-worker-interface)
3. [The Fix: Segregated Role Interfaces](#3-the-fix-segregated-role-interfaces)
4. [Real-World Example: Multi-Function Printer](#4-real-world-example-multi-function-printer)
5. [Interface Segregation in the Java Standard Library](#5-interface-segregation-in-the-java-standard-library)
6. [Interview Q&A](#6-interview-qa)

---

## 1. Core Philosophy: Lean Interfaces vs Fat Interfaces

> *"Clients should not be forced to depend upon interfaces that they do not use."* — Robert C. Martin

Large, "fat" interfaces force implementing classes to provide dummy implementations or throw exceptions for methods they do not need. ISP advocates breaking bloated interfaces into **small, role-specific contracts**.

---

## 2. The Anti-Pattern: The Bloated "Worker" Interface

```java
// ❌ BAD: Fat interface forcing robots to eat!
public interface Worker {
    void work();
    void eat();
    void sleep();
}

public class RobotWorker implements Worker {
    @Override public void work() { System.out.println("Assembling parts..."); }
    @Override public void eat() { /* Does nothing! Robots don't eat */ }
    @Override public void sleep() { /* Does nothing! Robots don't sleep */ }
}
```

---

## 3. The Fix: Segregated Role Interfaces

```java
// ✅ Lean, role-focused interfaces
public interface Workable {
    void work();
}

public interface Feedable {
    void eat();
}

public interface Restable {
    void sleep();
}

// Human implements all relevant roles:
public class HumanWorker implements Workable, Feedable, Restable {
    @Override public void work() { System.out.println("Working..."); }
    @Override public void eat() { System.out.println("Eating lunch..."); }
    @Override public void sleep() { System.out.println("Sleeping..."); }
}

// Robot implements ONLY Workable:
public class RobotWorker implements Workable {
    @Override public void work() { System.out.println("Automated machining..."); }
}
```

---

## 4. Real-World Example: Multi-Function Printer

```java
// Segregated Capability Interfaces
public interface Printable {
    void print(Document doc);
}

public interface Scannable {
    Document scan();
}

public interface Faxable {
    void fax(Document doc, String number);
}

// Basic Home Printer: only prints
public class BasicPrinter implements Printable {
    @Override
    public void print(Document doc) {
        System.out.println("Printing: " + doc.getTitle());
    }
}

// Enterprise All-in-One Office Machine: prints, scans, faxes
public class EnterpriseOfficeMachine implements Printable, Scannable, Faxable {
    @Override public void print(Document doc) { ... }
    @Override public Document scan() { ... }
    @Override public void fax(Document doc, String number) { ... }
}
```

---

## 5. Interface Segregation in the Java Standard Library

Java's standard library is a masterclass in ISP:
- `Runnable` has only `run()`.
- `Callable<V>` has only `call()`.
- `Comparable<T>` has only `compareTo(T)`.
- `Iterable<T>` has only `iterator()`.
- `AutoCloseable` has only `close()`.

Classes combine these small interfaces (`implements Serializable, Comparable<T>, Iterable<T>`) rather than implementing one giant `Everything` interface.

---

## 6. Interview Q&A

**Q: How does ISP interact with the Single Responsibility Principle (SRP)?**  
*Answer:* SRP applies to the cohesion of an implementing class (one reason to change), whereas ISP applies to the cohesion of an interface contract (clients only depend on methods they actually call). High ISP naturally supports high SRP.
