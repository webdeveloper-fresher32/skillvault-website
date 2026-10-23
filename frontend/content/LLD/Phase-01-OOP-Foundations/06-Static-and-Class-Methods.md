# Static Methods, Variables, and Utility Classes in Java — Complete Guide

## Table of Contents
1. [The `static` Keyword: Memory & Metaspace](#1-the-static-keyword-memory--metaspace)
2. [Static Factory Methods vs Constructors](#2-static-factory-methods-vs-constructors)
3. [Utility Classes & Non-Instantiability](#3-utility-classes--non-instantiability)
4. [Static Initializer Blocks (Eager vs Lazy)](#4-static-initializer-blocks-eager-vs-lazy)
5. [The Global State Anti-Pattern in LLD](#5-the-global-state-anti-pattern-in-lld)
6. [Real-World Example: Sequence Generator & Math Utility](#6-real-world-example-sequence-generator--math-utility)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The `static` Keyword: Memory & Metaspace

In Java, `static` members belong to the class itself rather than any specific heap object instance:
- **Static Variables**: Single shared memory location for all instances.
- **Static Methods**: Bound at compile-time to the class type; have no `this` reference.

---

## 2. Static Factory Methods vs Constructors

As advocated in *Effective Java* Item 1, **consider static factory methods instead of constructors**:

| Advantage | Benefit in LLD | Example |
| :--- | :--- | :--- |
| **Descriptive Names** | Disambiguates multiple constructors taking same types | `LocalTime.of(hour, min)` vs `LocalTime.parse("10:15")` |
| **No New Object Required** | Can return cached singletons or pooled instances | `Boolean.valueOf(true)`, `Integer.valueOf(127)` |
| **Return Subtypes** | Can return any subtype or interface implementation | `Collections.emptyList()`, `List.of()` |

```java
public class Money {
    private final double amount;
    private final String currency;

    private Money(double amount, String currency) {
        this.amount = amount;
        this.currency = currency;
    }

    public static Money ofUsd(double amount) {
        return new Money(amount, "USD");
    }

    public static Money ofEur(double amount) {
        return new Money(amount, "EUR");
    }

    public static Money zero(String currency) {
        return new Money(0.0, currency);
    }
}
```

---

## 3. Utility Classes & Non-Instantiability

Classes consisting solely of static utility methods (e.g., `Math`, `Collections`) should never be instantiated:

```java
public final class ValidationUtils {
    // Suppress default constructor for noninstantiability
    private ValidationUtils() {
        throw new AssertionError("Cannot instantiate utility class");
    }

    public static boolean isValidEmail(String email) {
        return email != null && email.matches("^[A-Za-z0-9+_.-]+@(.+)$");
    }
}
```

---

## 4. Static Initializer Blocks (Eager vs Lazy)

Static blocks run once when the class is first loaded by the ClassLoader:

```java
public class CurrencyRegistry {
    private static final Map<String, Double> FX_RATES = new HashMap<>();

    static {
        FX_RATES.put("USD", 1.0);
        FX_RATES.put("EUR", 0.92);
        FX_RATES.put("GBP", 0.78);
        FX_RATES.put("INR", 83.5);
    }

    public static double getRate(String currency) {
        return FX_RATES.getOrDefault(currency, 1.0);
    }
}
```

---

## 5. The Global State Anti-Pattern in LLD

> [!WARNING]
> Mutable static fields (`public static List<User> activeUsers = new ArrayList<>()`) represent global mutable state. They cause race conditions in multi-threaded environments, make unit testing brittle, and cause memory leaks. Keep static fields `final` and immutable!

---

## 6. Real-World Example: Sequence Generator & Math Utility

```java
import java.util.concurrent.atomic.AtomicLong;

public final class OrderIdGenerator {
    private static final AtomicLong COUNTER = new AtomicLong(1000);
    private static final String PREFIX = "ORD-";

    private OrderIdGenerator() {}

    public static String nextId() {
        return PREFIX + COUNTER.incrementAndGet();
    }
}
```

---

## 7. Interview Q&A

**Q: Can a static method call a non-static method directly?**  
*Answer:* No. A static method does not run in the context of an object instance, so there is no implicit `this` pointer. It can only call non-static methods if it explicitly instantiates or receives an instance of the class.
