# Interfaces and Abstract Classes in Java LLD

## Table of Contents
1. [Core Philosophy & Distinction](#1-core-philosophy--distinction)
2. [Interface Evolution: Default & Static Methods](#2-interface-evolution-default--static-methods)
3. [When to Use Abstract Class vs Interface](#3-when-to-use-abstract-class-vs-interface)
4. [Functional Interfaces & Lambda Expressions](#4-functional-interfaces--lambda-expressions)
5. [Real-World Example: Notification Delivery Engine](#5-real-world-example-notification-delivery-engine)
6. [Side-by-Side Comparison](#6-side-by-side-comparison)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Core Philosophy & Distinction

In Java Low-Level Design, abstraction is the cornerstone of loose coupling and polymorphism.

```
┌─────────────────────────────────────────────────────────────┐
│ Interface: "CAN-DO" / Contract Definition                   │
│ Defines a capability/behavior that ANY class can implement  │
│ e.g., PaymentProcessor, Sortable, AutoCloseable             │
├─────────────────────────────────────────────────────────────┤
│ Abstract Class: "IS-A" / Partial Blueprint                  │
│ Shares common state (instance variables) & core algorithm   │
│ e.g., BaseVehicle, AbstractOrderValidator                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Interface Evolution: Default & Static Methods

Since Java 8, interfaces can provide:
- **Default Methods**: Backward-compatible method implementations with `default` keyword.
- **Static Methods**: Utility functions scoped directly to the interface.
- **Private Methods** (Java 9+): Helper methods shared among default methods without exposing them to implementers.

```java
public interface PaymentGateway {
    // 1. Abstract method: contract each provider must implement
    PaymentResponse processPayment(PaymentRequest request);

    // 2. Default method: common fallback or convenience logic
    default boolean validateRequest(PaymentRequest request) {
        return request != null && request.getAmount() > 0 && sanitize(request.getId());
    }

    // 3. Static method: factory or validator utility
    static PaymentGateway defaultProvider() {
        return new StripePaymentGateway();
    }

    // 4. Private helper (Java 9+)
    private boolean sanitize(String id) {
        return id != null && !id.trim().isEmpty();
    }
}
```

---

## 3. When to Use Abstract Class vs Interface

| Dimension | Interface (`interface`) | Abstract Class (`abstract class`) |
| :--- | :--- | :--- |
| **Multiple Inheritance** | A class can implement **multiple** interfaces | A class can extend **only one** abstract class |
| **State / Fields** | Only `public static final` constants | Can have instance variables (`private`, `protected`, etc.) |
| **Constructors** | Cannot have constructors | Can have constructors (called via `super()`) |
| **Design Intent** | Defines contract / role ("What can it do?") | Defines identity and shared state ("What is it?") |
| **Template Pattern** | Less ideal for complex stateful algorithms | Ideal (enforces algorithm skeleton with hook methods) |

---

## 4. Functional Interfaces & Lambda Expressions

A **Functional Interface** has exactly one abstract method (annotated with `@FunctionalInterface`). In LLD, this allows passing strategy implementations inline via lambdas.

```java
@FunctionalInterface
public interface DiscountStrategy {
    double calculateDiscount(double originalPrice);
}

// Inline instantiation in machine coding:
DiscountStrategy festiveDiscount = price -> price * 0.20;
DiscountStrategy clearanceDiscount = price -> price * 0.50;
```

---

## 5. Real-World Example: Notification Delivery Engine

```java
import java.time.Instant;
import java.util.Objects;

// 1. Capability interface for retry mechanism
interface Retryable {
    int getMaxRetries();
    default boolean shouldRetry(int currentAttempt) {
        return currentAttempt < getMaxRetries();
    }
}

// 2. Abstract Base Class capturing common notification state & logging
abstract class BaseNotificationService implements Retryable {
    protected final String serviceName;
    protected final int maxRetries;

    public BaseNotificationService(String serviceName, int maxRetries) {
        this.serviceName = Objects.requireNonNull(serviceName);
        this.maxRetries = maxRetries;
    }

    @Override
    public int getMaxRetries() {
        return maxRetries;
    }

    // Template method: orchestrates sending with standardized logging
    public final boolean send(String recipient, String message) {
        System.out.println(String.format("[%s] [%s] Initiating dispatch to: %s", 
                Instant.now(), serviceName, recipient));
        
        int attempt = 0;
        while (attempt <= maxRetries) {
            try {
                attempt++;
                deliver(recipient, message);
                System.out.println(String.format("[%s] Successfully delivered on attempt %d", serviceName, attempt));
                return true;
            } catch (Exception e) {
                System.err.println(String.format("[%s] Failed attempt %d: %s", serviceName, attempt, e.getMessage()));
                if (!shouldRetry(attempt)) break;
            }
        }
        return false;
    }

    // Primitive hook for subclasses
    protected abstract void deliver(String recipient, String message) throws Exception;
}

// 3. Concrete Implementations
class EmailNotificationService extends BaseNotificationService {
    public EmailNotificationService() {
        super("EmailService", 3);
    }

    @Override
    protected void deliver(String recipient, String message) throws Exception {
        if (!recipient.contains("@")) {
            throw new IllegalArgumentException("Invalid email: " + recipient);
        }
        System.out.println("Sending SMTP email body: " + message);
    }
}

class SmsNotificationService extends BaseNotificationService {
    public SmsNotificationService() {
        super("SmsService", 2);
    }

    @Override
    protected void deliver(String recipient, String message) {
        System.out.println("Sending SMS text: " + message);
    }
}
```

---

## 6. Side-by-Side Comparison

```
❌ BAD: Tight Coupling to Concrete Classes
┌───────────────────────────────────────┐
│ public class OrderService {           │
│     private EmailService emailService;│ // Inflexible! Cannot switch to SMS
│     public void notify() { ... }     │
│ }                                     │
└───────────────────────────────────────┘

✅ GOOD: Depend on Interface Contract
┌───────────────────────────────────────┐
│ public class OrderService {           │
│     private final NotificationService │ // Clean! Pluggable Email/SMS/Push
│             notificationService;      │
│     public OrderService(              │
│         NotificationService svc) {    │
│         this.notificationService=svc; │
│     }                                 │
│ }                                     │
└───────────────────────────────────────┘
```

---

## 7. Interview Q&A

**Q: Can an interface have instance variables in Java?**  
*Answer:* No. All variables declared in an interface are implicitly `public static final` (constants). If state tracking is required across instances, use an abstract class or composite object.

**Q: How does Java resolve conflict when two interfaces provide conflicting default methods?**  
*Answer:* The compiler forces the implementing class to explicitly override the conflicting method and resolve the ambiguity (e.g., `InterfaceA.super.methodName()`).
