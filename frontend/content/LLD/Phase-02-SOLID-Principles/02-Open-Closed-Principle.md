# Open/Closed Principle (OCP) in Java — Complete Guide

## Table of Contents
1. [Core Philosophy: Open for Extension, Closed for Modification](#1-core-philosophy-open-for-extension-closed-for-modification)
2. [The Anti-Pattern: Switch Statements & Type Checks](#2-the-anti-pattern-switch-statements--type-checks)
3. [The Solution: Strategy Pattern & Polymorphic Abstraction](#3-the-solution-strategy-pattern--polymorphic-abstraction)
4. [Real-World Example: Discount Calculation Engine](#4-real-world-example-discount-calculation-engine)
5. [OCP via Plugins & Functional Interfaces](#5-ocp-via-plugins--functional-interfaces)
6. [Interview Q&A](#6-interview-qa)

---

## 1. Core Philosophy: Open for Extension, Closed for Modification

> *"Software entities (classes, modules, functions) should be open for extension, but closed for modification."* — Bertrand Meyer

You should be able to introduce new behavior or business rules **without editing existing, tested, and deployed source code**.

---

## 2. The Anti-Pattern: Switch Statements & Type Checks

```java
// ❌ BAD: Every time a new payment method is added (e.g. ApplePay, UPI),
// this existing, critical production method MUST be modified!
public class PaymentService {
    public void processPayment(String method, double amount) {
        if ("CREDIT_CARD".equalsIgnoreCase(method)) {
            System.out.println("Processing credit card charge: $" + amount);
        } else if ("PAYPAL".equalsIgnoreCase(method)) {
            System.out.println("Redirecting to PayPal API: $" + amount);
        } else if ("BITCOIN".equalsIgnoreCase(method)) {
            System.out.println("Broadcasting crypto transaction: $" + amount);
        } else {
            throw new UnsupportedOperationException("Unknown payment: " + method);
        }
    }
}
```

---

## 3. The Solution: Strategy Pattern & Polymorphic Abstraction

Define an interface contract. New payment methods simply implement the interface without touching `PaymentService`:

```java
// 1. Stable Abstraction (Closed for Modification)
public interface PaymentMethod {
    void pay(double amount);
}

// 2. Concrete Extensibility (Open for Extension)
public class CreditCardPayment implements PaymentMethod {
    @Override
    public void pay(double amount) {
        System.out.println("Processing credit card charge: $" + amount);
    }
}

public class PayPalPayment implements PaymentMethod {
    @Override
    public void pay(double amount) {
        System.out.println("Redirecting to PayPal API: $" + amount);
    }
}

public class UpiPayment implements PaymentMethod {
    @Override
    public void pay(double amount) {
        System.out.println("Executing instant UPI transaction: $" + amount);
    }
}

// 3. Client Service (Never needs changes when new providers arrive!)
public class PaymentService {
    public void processPayment(PaymentMethod paymentMethod, double amount) {
        Objects.requireNonNull(paymentMethod, "Payment method required");
        paymentMethod.pay(amount);
    }
}
```

---

## 4. Real-World Example: Discount Calculation Engine

```java
@FunctionalInterface
public interface DiscountStrategy {
    double applyDiscount(double originalAmount);
}

public class SeasonalDiscount implements DiscountStrategy {
    @Override
    public double applyDiscount(double originalAmount) {
        return originalAmount * 0.90; // 10% off
    }
}

public class VipDiscount implements DiscountStrategy {
    @Override
    public double applyDiscount(double originalAmount) {
        return originalAmount * 0.80; // 20% off
    }
}

public class CheckoutCalculator {
    public double calculateFinal(double total, DiscountStrategy discount) {
        return discount.applyDiscount(total);
    }
}
```

---

## 5. OCP via Plugins & Functional Interfaces

With Java lambdas, new strategies can be passed directly without even declaring new classes:

```java
CheckoutCalculator calculator = new CheckoutCalculator();
// Flash sale discount added on the fly:
double finalPrice = calculator.calculateFinal(100.0, amount -> amount - 15.0);
```

---

## 6. Interview Q&A

**Q: Does OCP mean we can NEVER modify existing code?**  
*Answer:* No. Bug fixes, security patches, or changes in core requirements inevitably require modifying existing code. OCP specifically guides us to design extension points around features likely to grow (e.g., payment methods, file parsers, export formats).
