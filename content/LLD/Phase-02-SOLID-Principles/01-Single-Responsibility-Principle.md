# Single Responsibility Principle (SRP) in Java — Complete Guide

## Table of Contents
1. [Core Definition & Philosophy](#1-core-definition--philosophy)
2. [Identifying Reasons to Change (Actors & Roles)](#2-identifying-reasons-to-change-actors--roles)
3. [The Anti-Pattern: The "God Class"](#3-the-anti-pattern-the-god-class)
4. [Refactoring to Clean Single Responsibility Architecture](#4-refactoring-to-clean-single-responsibility-architecture)
5. [Real-World Example: Order Fulfillment Pipeline](#5-real-world-example-order-fulfillment-pipeline)
6. [Code Smell Checklist: How to Detect SRP Violations](#6-code-smell-checklist-how-to-detect-srp-violations)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Core Definition & Philosophy

> *"A class should have one, and only one, reason to change."* — Robert C. Martin (Uncle Bob)

A "reason to change" is tied to a **specific stakeholder or actor** in the organization. If finance rules, database administration, and notification formatting all trigger modifications in the same Java file, SRP is breached.

---

## 2. Identifying Reasons to Change (Actors & Roles)

```
                       ┌───────────────────────┐
                       │     INVOICE CLASS     │
                       └───────────┬───────────┘
                                   │
      ┌────────────────────────────┼────────────────────────────┐
      ▼                            ▼                            ▼
  Accounting                   DevOps / DBA                  Marketing
  "Change VAT/tax rate"        "Migrate to Postgres"         "Update email template"
```

When changes requested by different business teams collide in the same source file, you face merge conflicts, regression bugs, and tight coupling.

---

## 3. The Anti-Pattern: The "God Class"

```java
// ❌ BAD: 3 distinct reasons to change in one class!
public class InvoiceManager {
    private final String invoiceId;
    private final double amount;

    public InvoiceManager(String invoiceId, double amount) {
        this.invoiceId = invoiceId;
        this.amount = amount;
    }

    // Reason 1: Finance / Tax Calculation
    public double calculateTotalWithTax(double taxRate) {
        return amount + (amount * taxRate);
    }

    // Reason 2: Database Persistence
    public void saveToDatabase() {
        System.out.println("Executing: INSERT INTO invoices VALUES ('" + invoiceId + "', " + amount + ")");
    }

    // Reason 3: Notification Formatting
    public void sendEmailReceipt(String email) {
        System.out.println("Connecting to SMTP server at smtp.mail.com:587...");
        System.out.println("Dispatching email to: " + email);
    }
}
```

---

## 4. Refactoring to Clean Single Responsibility Architecture

```java
// ✅ 1. Pure Domain Model & Financial Calculation
public class Invoice {
    private final String invoiceId;
    private final double amount;

    public Invoice(String invoiceId, double amount) {
        this.invoiceId = invoiceId;
        this.amount = amount;
    }

    public double calculateTotalWithTax(double taxRate) {
        return amount + (amount * taxRate);
    }

    public String getInvoiceId() { return invoiceId; }
    public double getAmount() { return amount; }
}

// ✅ 2. Persistence Layer
public class InvoiceRepository {
    public void save(Invoice invoice) {
        System.out.println("Saving invoice " + invoice.getInvoiceId() + " to SQL database.");
    }
}

// ✅ 3. Notification Service
public class InvoiceNotificationService {
    public void sendEmailReceipt(Invoice invoice, String recipientEmail) {
        System.out.println("Sending HTML invoice receipt to " + recipientEmail);
    }
}
```

---

## 5. Real-World Example: Order Fulfillment Pipeline

```java
public class OrderFulfillmentCoordinator {
    private final PaymentProcessor paymentProcessor;
    private final InventoryManager inventoryManager;
    private final ShippingService shippingService;

    public OrderFulfillmentCoordinator(
        PaymentProcessor paymentProcessor,
        InventoryManager inventoryManager,
        ShippingService shippingService
    ) {
        this.paymentProcessor = paymentProcessor;
        this.inventoryManager = inventoryManager;
        this.shippingService = shippingService;
    }

    public boolean fulfill(Order order) {
        if (!inventoryManager.hasStock(order.getProductId(), order.getQuantity())) {
            return false;
        }
        if (!paymentProcessor.charge(order.getCustomerId(), order.getTotal())) {
            return false;
        }
        shippingService.scheduleDispatch(order);
        return true;
    }
}
```

---

## 6. Code Smell Checklist: How to Detect SRP Violations

1. **Large Class Size**: A class with >300 lines of code or >10 public methods.
2. **Diverse Import Statements**: Class imports both `java.sql.*`, `javax.mail.*`, and `com.fasterxml.jackson.*`.
3. **Methods with "And" in Their Names**: `saveAndNotify()`, `validateAndCalculate()`.
4. **Frequent Merge Conflicts**: Multiple developers editing the same class for unrelated user stories.

---

## 7. Interview Q&A

**Q: Does SRP mean a class should only have a single method?**  
*Answer:* No. SRP is about cohesion, not method count. A class can have multiple methods as long as they all collaborate toward fulfilling a single, unified responsibility (e.g., a `UserValidator` might have `validateEmail()`, `validateAge()`, and `validatePassword()`, all under the single responsibility of user input validation).
