# SOLID Principles Master Comparison & Unified Case Study in Java

## Table of Contents
1. [The 5 Principles Quick Reference Matrix](#1-the-5-principles-quick-reference-matrix)
2. [End-to-End Case Study: E-Commerce Checkout System](#2-end-to-end-case-study-e-commerce-checkout-system)
3. [The Monolithic Anti-Pattern (All 5 Violated)](#3-the-monolithic-anti-pattern-all-5-violated)
4. [The Refactored Architecture (All 5 Applied)](#4-the-refactored-architecture-all-5-applied)
5. [Whiteboard Rubric: What Interviewers Check](#5-whiteboard-rubric-what-interviewers-check)
6. [Interview Q&A](#6-interview-qa)

---

## 1. The 5 Principles Quick Reference Matrix

| Principle | Primary Goal | Smells When Violated | Java Solution |
| :--- | :--- | :--- | :--- |
| **SRP** | High Cohesion | Large classes, multiple reasons to change | Separate model, persistence, and presentation |
| **OCP** | Extensibility | `switch`/`if-else` chains on types | Strategy Pattern, interfaces, lambdas |
| **LSP** | Correct Subtyping | `UnsupportedOperationException`, breaking parent invariants | Inherit behavior contracts only; prefer composition |
| **ISP** | Lean Interfaces | Empty dummy methods in implementers | Split fat interfaces into small role interfaces |
| **DIP** | Decoupling | `new ConcreteClass()` in business methods | Constructor Dependency Injection |

---

## 2. End-to-End Case Study: E-Commerce Checkout System

Let's inspect how an unprincipled E-Commerce checkout violates all 5 principles simultaneously, and how to refactor it into clean Java architecture.

---

## 3. The Monolithic Anti-Pattern (All 5 Violated)

```java
// ❌ HORRIBLE DESIGN: Violates SRP, OCP, LSP, ISP, DIP simultaneously
public class MonolithicOrderProcessor {
    public void process(String type, double amount, String email) {
        // Violates OCP: if-else on payment types
        if ("CARD".equals(type)) {
            System.out.println("Card charge: " + amount);
        } else if ("PAYPAL".equals(type)) {
            System.out.println("PayPal charge: " + amount);
        }

        // Violates SRP & DIP: hardcoded database write
        System.out.println("INSERT INTO orders VALUES (" + amount + ")");

        // Violates SRP: email sending mixed into checkout
        System.out.println("Sending SMTP email to " + email);
    }
}
```

---

## 4. The Refactored Architecture (All 5 Applied)

```java
import java.util.*;

// 1. Domain Entities (SRP)
public record Order(String id, double total, String customerEmail) {}

// 2. Extensible Payment Abstraction (OCP, DIP, LSP)
public interface PaymentGateway {
    boolean charge(double amount);
}

public class StripeGateway implements PaymentGateway {
    @Override
    public boolean charge(double amount) {
        System.out.println("Stripe charge processed: $" + amount);
        return true;
    }
}

// 3. Storage Abstraction (DIP, SRP)
public interface OrderRepository {
    void save(Order order);
}

public class SqlOrderRepository implements OrderRepository {
    @Override
    public void save(Order order) {
        System.out.println("Saved order " + order.id() + " to SQL DB.");
    }
}

// 4. Notification Role Interface (ISP, SRP)
public interface NotificationService {
    void notifyCustomer(String email, String message);
}

public class EmailNotificationService implements NotificationService {
    @Override
    public void notifyCustomer(String email, String message) {
        System.out.println("Email sent to " + email + ": " + message);
    }
}

// 5. High-Level Orchestrator (DIP Constructor Injection, Pure SRP)
public class CheckoutService {
    private final PaymentGateway paymentGateway;
    private final OrderRepository orderRepository;
    private final NotificationService notificationService;

    public CheckoutService(
        PaymentGateway paymentGateway,
        OrderRepository orderRepository,
        NotificationService notificationService
    ) {
        this.paymentGateway = Objects.requireNonNull(paymentGateway);
        this.orderRepository = Objects.requireNonNull(orderRepository);
        this.notificationService = Objects.requireNonNull(notificationService);
    }

    public boolean checkout(Order order) {
        if (!paymentGateway.charge(order.total())) {
            return false;
        }
        orderRepository.save(order);
        notificationService.notifyCustomer(order.customerEmail(), "Your order is confirmed!");
        return true;
    }
}
```

---

## 5. Whiteboard Rubric: What Interviewers Check

During a 45-minute LLD round, interviewers watch for:
1. **Did you start with interfaces or concrete classes?** (Interface-first demonstrates DIP/OCP maturity).
2. **Are fields private and constructors validating inputs?** (Encapsulation).
3. **Did you split domain logic from DB/API logic?** (SRP).
4. **Is the design open to new features without rewriting existing classes?** (OCP).

---

## 6. Interview Q&A

**Q: Can adhering too strictly to SOLID cause overengineering?**  
*Answer:* Yes. Creating separate interfaces, factories, and DTOs for a 5-line static script violates KISS and YAGNI. SOLID is designed for systems that evolve over time. Apply SOLID at the boundaries of your domain where business requirements change most frequently.
