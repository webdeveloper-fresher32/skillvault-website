# Enums, Records, and Immutability in Java LLD

## Table of Contents
1. [Immutability as the Ultimate Concurrency Defense](#1-immutability-as-the-ultimate-concurrency-defense)
2. [Java Rich Enums: More Than Just Constants](#2-java-rich-enums-more-than-just-constants)
3. [The Strategy Pattern Inside Enums](#3-the-strategy-pattern-inside-enums)
4. [Java Records: Clean Domain Value Objects](#4-java-records-clean-domain-value-objects)
5. [Validation with Compact Constructors](#5-validation-with-compact-constructors)
6. [Real-World Example: Banking Transaction & Account Model](#6-real-world-example-banking-transaction--account-model)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Immutability as the Ultimate Concurrency Defense

In multi-threaded machine coding rounds, mutable objects require locks and synchronization. An **immutable object** (whose state cannot change after construction) is **inherently thread-safe**:
- No race conditions
- No locks needed for reads
- Safe to share across threads, queues, and caches

```
┌─────────────────────────────────────────────────────────────┐
│ ❌ Mutable Entity: Needs Synchronization                     │
│ user.setName("Alice"); // Thread 1                           │
│ user.setName("Bob");   // Thread 2 (Corrupts state!)         │
├─────────────────────────────────────────────────────────────┤
│ ✅ Immutable Record / Value Object                           │
│ UserRecord u = new UserRecord("USR-1", "Alice");             │
│ // Completely safe to share across 100 concurrent threads!   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Java Rich Enums: More Than Just Constants

Unlike C/C++ or basic string constants, Java `enum` is a full-fledged class with methods, constructors, and instance variables.

```java
public enum OrderStatus {
    CREATED("Order placed, awaiting payment", true),
    PAYMENT_PENDING("Processing payment gateway", true),
    PAID("Payment confirmed, preparing shipment", true),
    SHIPPED("Dispatched via courier", false),
    DELIVERED("Delivered to customer", false),
    CANCELLED("Order cancelled and refunded", false);

    private final String description;
    private final boolean canBeCancelled;

    OrderStatus(String description, boolean canBeCancelled) {
        this.description = description;
        this.canBeCancelled = canBeCancelled;
    }

    public String getDescription() { return description; }
    public boolean canBeCancelled() { return canBeCancelled; }

    // State Transition Guard
    public boolean canTransitionTo(OrderStatus next) {
        return switch (this) {
            case CREATED -> next == PAYMENT_PENDING || next == CANCELLED;
            case PAYMENT_PENDING -> next == PAID || next == CANCELLED;
            case PAID -> next == SHIPPED || next == CANCELLED;
            case SHIPPED -> next == DELIVERED;
            case DELIVERED, CANCELLED -> false;
        };
    }
}
```

---

## 3. The Strategy Pattern Inside Enums

Enums can implement abstract methods on each constant, providing an elegant, self-contained Strategy Pattern without creating separate class files:

```java
public enum PricingTier {
    REGULAR {
        @Override
        public double calculateFee(double basePrice, int hours) {
            return basePrice * hours;
        }
    },
    PREMIUM {
        @Override
        public double calculateFee(double basePrice, int hours) {
            return (basePrice * hours) * 0.85; // 15% discount
        }
    },
    CORPORATE {
        @Override
        public double calculateFee(double basePrice, int hours) {
            return (basePrice * hours) * 0.70; // 30% bulk discount
        }
    };

    public abstract double calculateFee(double basePrice, int hours);
}
```

---

## 4. Java Records: Clean Domain Value Objects

Introduced in Java 14+ (standard in Java 16+), a `record` automatically generates:
- Private `final` fields
- Public getters (named `field()`, e.g., `id()`)
- Canonical constructor
- High-performance `equals()`, `hashCode()`, and `toString()` implementations

```java
// Replaces 60 lines of boilerplate POJO code with 1 clean line!
public record Money(double amount, String currency) {}
```

---

## 5. Validation with Compact Constructors

In LLD, value objects must never be instantiated in an invalid state. Use record's compact constructor:

```java
public record GeoLocation(double latitude, double longitude) {
    // Compact constructor — parameter list omitted
    public GeoLocation {
        if (latitude < -90.0 || latitude > 90.0) {
            throw new IllegalArgumentException("Latitude must be between -90 and 90: " + latitude);
        }
        if (longitude < -180.0 || longitude > 180.0) {
            throw new IllegalArgumentException("Longitude must be between -180 and 180: " + longitude);
        }
    }

    public double distanceTo(GeoLocation other) {
        // Haversine formula calculation...
        return Math.hypot(this.latitude - other.latitude, this.longitude - other.longitude);
    }
}
```

---

## 6. Real-World Example: Banking Transaction & Account Model

```java
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

// 1. Transaction Type Enum with state transition logic
public enum TransactionType {
    DEPOSIT {
        @Override
        public double apply(double currentBalance, double amount) {
            return currentBalance + amount;
        }
    },
    WITHDRAWAL {
        @Override
        public double apply(double currentBalance, double amount) {
            if (currentBalance < amount) {
                throw new IllegalStateException("Insufficient funds");
            }
            return currentBalance - amount;
        }
    };

    public abstract double apply(double currentBalance, double amount);
}

// 2. Immutable Transaction Receipt (Record)
public record TransactionReceipt(
    String transactionId,
    String accountId,
    TransactionType type,
    double amount,
    double balanceAfter,
    Instant timestamp
) {
    public TransactionReceipt {
        Objects.requireNonNull(transactionId, "Transaction ID required");
        Objects.requireNonNull(accountId, "Account ID required");
        if (amount <= 0) {
            throw new IllegalArgumentException("Amount must be strictly positive");
        }
    }

    public static TransactionReceipt of(String accountId, TransactionType type, double amount, double newBalance) {
        return new TransactionReceipt(
            UUID.randomUUID().toString(),
            accountId,
            type,
            amount,
            newBalance,
            Instant.now()
        );
    }
}
```

---

## 7. Interview Q&A

**Q: Can a Java `record` extend another class?**  
*Answer:* No. Every Java `record` implicitly extends `java.lang.Record` and is final. However, records can implement any number of interfaces (e.g., `Comparable`, `Serializable`).

**Q: Why is an `enum` preferred for Singleton implementations in Java?**  
*Answer:* As advocated by Joshua Bloch, an Enum Singleton provides JVM-level guarantees against multiple instantiation, even during complex serialization, deserialization, or aggressive reflection attacks.
