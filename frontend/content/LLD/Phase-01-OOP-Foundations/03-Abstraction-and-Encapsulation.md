# Abstraction and Encapsulation in Java — Complete Guide

## Table of Contents
1. [Definitions: Hiding Complexity vs Guarding State](#1-definitions-hiding-complexity-vs-guarding-state)
2. [Encapsulation: Access Modifiers & Invariant Protection](#2-encapsulation-access-modifiers--invariant-protection)
3. [Abstraction: Abstract Classes & Interfaces](#3-abstraction-abstract-classes--interfaces)
4. [TDA Principle: Tell, Don't Ask](#4-tda-principle-tell-dont-ask)
5. [Real-World Example: Smart Home Automated Lock System](#5-real-world-example-smart-home-automated-lock-system)
6. [Side-by-Side Comparison: Anemic Domain Model vs Encapsulated Model](#6-side-by-side-comparison-anemic-domain-model-vs-encapsulated-model)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Definitions: Hiding Complexity vs Guarding State

```
┌─────────────────────────────────────────────────────────────┐
│ Encapsulation: "Binds data with code; guards internal state"│
│ - Keeps instance variables `private`                        │
│ - Provides controlled access via methods that guard invariants│
├─────────────────────────────────────────────────────────────┤
│ Abstraction: "Hides implementation complexity from caller"  │
│ - Exposes WHAT an object does, hides HOW it achieves it     │
│ - Implemented via abstract classes, interfaces, and facades │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Encapsulation: Access Modifiers & Invariant Protection

Java provides 4 levels of access control:

| Modifier | Same Class | Same Package | Subclass (any package) | World |
| :--- | :---: | :---: | :---: | :---: |
| `private` | ✅ | ❌ | ❌ | ❌ |
| *(default / package-private)* | ✅ | ✅ | ❌ | ❌ |
| `protected` | ✅ | ✅ | ✅ | ❌ |
| `public` | ✅ | ✅ | ✅ | ✅ |

In LLD, fields must almost always be `private`. State transformations must happen via domain methods that validate business invariants.

---

## 3. Abstraction: Abstract Classes & Interfaces

```java
// Abstraction: Caller interacts with CoffeeMachine without knowing boiler internals
public interface CoffeeMachine {
    Coffee brewEspresso();
    Coffee brewLatte();
}
```

---

## 4. TDA Principle: Tell, Don't Ask

Instead of asking an object for its data, making a decision outside, and modifying the object's data, **tell the object what to do**!

```java
// ❌ BAD: Asking for data and mutating outside (Violates Encapsulation)
if (account.getBalance() >= amount) {
    account.setBalance(account.getBalance() - amount);
}

// ✅ GOOD: Tell the object to perform the action (TDA Principle)
account.debit(amount); // Account internally verifies balance and throws if invalid!
```

---

## 5. Real-World Example: Smart Home Automated Lock System

```java
public class SmartLock {
    private boolean locked;
    private int consecutiveFailedAttempts;
    private final String hashedPasscode;

    public SmartLock(String hashedPasscode) {
        this.hashedPasscode = Objects.requireNonNull(hashedPasscode);
        this.locked = true;
        this.consecutiveFailedAttempts = 0;
    }

    // Encapsulated state transition with security rules
    public synchronized boolean unlock(String candidatePasscode) {
        if (consecutiveFailedAttempts >= 5) {
            throw new SecurityException("Lock is disabled due to too many failed attempts!");
        }

        if (verifyHash(candidatePasscode, this.hashedPasscode)) {
            this.locked = false;
            this.consecutiveFailedAttempts = 0;
            System.out.println("Door unlocked successfully.");
            return true;
        } else {
            this.consecutiveFailedAttempts++;
            System.err.println("Invalid code! Failed attempts: " + consecutiveFailedAttempts);
            return false;
        }
    }

    public synchronized void lock() {
        this.locked = true;
    }

    public boolean isLocked() { return locked; }

    private boolean verifyHash(String candidate, String target) {
        return candidate.equals(target); // Simplified for demonstration
    }
}
```

---

## 6. Side-by-Side Comparison: Anemic Domain Model vs Encapsulated Model

```
❌ Anemic Domain Model:
- Plain getters and setters on everything
- Business rules scattered all over controllers/services
- Invariants easily corrupted by external callers

✅ Rich Encapsulated Model:
- Private fields, no indiscriminate setters
- Methods express domain intent: `order.cancel()`, `flight.bookSeat()`
- Invariants guaranteed 100% of the time
```

---

## 7. Interview Q&A

**Q: Why are public fields considered dangerous in LLD?**  
*Answer:* Public fields prevent validation, break encapsulation, make it impossible to enforce thread safety, and couple calling code to internal implementation details, preventing future refactoring.
