# 🧠 The Ultimate Guide to Adapter Pattern (LLD)

> **Core Philosophy:** *Convert the interface of a class into another interface clients expect. Adapter lets classes work together that couldn't otherwise because of incompatible interfaces.*

---

## 📌 Table of Contents
1. [The Problem: Why Do We Need It?](#1-the-problem-why-do-we-need-it)
2. [Class Adapter vs Object Adapter](#2-class-adapter-vs-object-adapter)
3. [The Core Architecture (The 4 Participants)](#3-the-core-architecture-the-4-participants)
4. [Step-by-Step Implementation (Java)](#4-step-by-step-implementation-java)
5. [UML Class Diagram & Relationships](#5-uml-class-diagram--relationships)
6. [Execution Flow: Translating Incompatible Calls](#6-execution-flow-translating-incompatible-calls)
7. [Side-by-Side Comparison: Bad Code vs Adapter](#7-side-by-side-comparison-bad-code-vs-adapter)
8. [When to Use & When NOT to Use](#8-when-to-use--when-not-to-use)
9. [Pros & Cons Trade-off Analysis](#9-pros--cons-trade-off-analysis)
10. [Real-World Everyday Examples](#10-real-world-everyday-examples)
11. [The Ultimate Checklist & Mental Formula](#11-the-ultimate-checklist--mental-formula)

---

## 1. The Problem: Why Do We Need It?

### Real-World Domain Example: Modern Payment Gateway Integrating Legacy Core Banking XML 💳 ↔️ 🏛️
Imagine building a modern e-commerce checkout platform. Your entire system processes orders using clean, JSON-based `ModernPaymentGateway` interfaces (`processPayment(String customerId, double amountInUsd)`).

Suddenly, your company partners with a massive legacy banking provider. Their SDK only accepts a legacy interface with XML payloads, currency in Indian Paise/Cents, and method names like `executeWireTransfer(XmlPayload payload)`:

```
    Modern Checkout Service ──── expects ────►  ModernPaymentGateway (JSON)
                                                         ❌ INCOMPATIBLE!
                                                LegacyBankingService (XML)
```

### The Naive Approach: Modifying Existing Code
* ❌ **Modifying Vendor SDKs:** You cannot edit third-party closed-source SDKs or legacy banking code.
* ❌ **Polluting Modern Business Logic:** Injecting raw XML serialization, currency conversions, and legacy error handlers directly into your clean checkout flow creates spaghetti code.

---

## 2. Class Adapter vs Object Adapter

| Feature | Object Adapter (Recommended ✅) | Class Adapter |
| :--- | :--- | :--- |
| **Mechanism** | Uses **Composition** (`HAS-A` adaptee reference). | Uses **Multiple Inheritance** (extends Adaptee & implements Target). |
| **Flexibility** | Can adapt an adaptee and all its subclasses dynamically. | Statically binds to one specific adaptee class. |
| **Language Support**| Works in Java, C#, Python, C++, Go. | Not supported in Java/C# (no multiple class inheritance). |

---

## 3. The Core Architecture (The 4 Participants)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Target (Interface)                                       │
│    The domain-specific interface that your client expects.  │
└──────────────────────────────▲──────────────────────────────┘
                               │ implements
┌──────────────────────────────┴──────────────────────────────┐
│ 2. Adapter (Wrapper Class)                                  │
│    Implements Target and translates requests to Adaptee.    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HAS-A (Composition)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Adaptee (Incompatible Class / Third-party)              │
│    Has useful functionality, but an incompatible interface. │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Step-by-Step Implementation (Java)

### Step 1: The Target Interface (What your modern app uses)

```java
public interface ModernPaymentGateway {
    void processPayment(String customerId, double amountInUsd);
}
```

---

### Step 2: The Adaptee (Legacy Vendor / Incompatible Library)

```java
// Closed-source third-party or legacy class
public class LegacyCoreBankService {
    public void executeWireTransfer(String xmlPayload) {
        System.out.println("Executing legacy wire transfer via XML gateway:");
        System.out.println(xmlPayload);
    }
}
```

---

### Step 3: The Adapter (The Translator Bridge)

```java
public class BankApiAdapter implements ModernPaymentGateway {
    private final LegacyCoreBankService legacyBankService;

    // Composition: holds reference to adaptee
    public BankApiAdapter(LegacyCoreBankService legacyBankService) {
        this.legacyBankService = legacyBankService;
    }

    @Override
    public void processPayment(String customerId, double amountInUsd) {
        // 1. Convert data & units (USD to Cents)
        long amountInCents = Math.round(amountInUsd * 100);

        // 2. Translate JSON request into Legacy XML format
        String xmlPayload = "<WireTransfer>"
                + "<CustId>" + customerId + "</CustId>"
                + "<Cents>" + amountInCents + "</Cents>"
                + "</WireTransfer>";

        // 3. Delegate execution to adaptee
        legacyBankService.executeWireTransfer(xmlPayload);
    }
}
```

---

### Step 4: Client Usage

```java
public class CheckoutService {
    public static void main(String[] args) {
        // Legacy system instance
        LegacyCoreBankService legacyService = new LegacyCoreBankService();

        // Wrap it in Adapter to satisfy modern interface
        ModernPaymentGateway paymentGateway = new BankApiAdapter(legacyService);

        // Client makes a clean modern call
        paymentGateway.processPayment("CUST-9921", 149.99);
    }
}
```

---

## 5. UML Class Diagram & Relationships

```
┌──────────────────────────────────────────────┐
│       <<interface>> ModernPaymentGateway     │
├──────────────────────────────────────────────┤
│ + processPayment(custId: String, amt: double)│
└──────────────────────▲───────────────────────┘
                       │ implements
┌──────────────────────┴───────────────────────┐
│               BankApiAdapter                 │
├──────────────────────────────────────────────┤
│ - legacyBankService: LegacyCoreBankService   │
├──────────────────────────────────────────────┤
│ + processPayment(custId: String, amt: double)│
└──────────────────────┬───────────────────────┘
                       │ HAS-A (Composition)
                       ▼
┌──────────────────────────────────────────────┐
│            LegacyCoreBankService             │
├──────────────────────────────────────────────┤
│ + executeWireTransfer(xmlPayload: String)    │
└──────────────────────────────────────────────┘
```

---

## 6. Execution Flow: Translating Incompatible Calls

```
CheckoutService
   │
   ├─► calls paymentGateway.processPayment("CUST-9921", 149.99)
   │
BankApiAdapter
   │
   ├─► Translates 149.99 USD ──► 14999 Cents
   ├─► Serializes parameters into XML string
   ├─► Calls legacyBankService.executeWireTransfer("<WireTransfer>...")
   │
LegacyCoreBankService
   │
   └─► Executes wire transfer
   ▼
Success! The checkout service never knew XML or Cents existed!
```

---

## 7. Side-by-Side Comparison: Bad Code vs Adapter

| Metric | ❌ Direct Inlining (Bad) | ✅ Adapter Pattern |
| :--- | :--- | :--- |
| **Coupling** | Checkout service tightly coupled to vendor XML libraries. | Checkout service only knows standard interface. |
| **Maintainability** | If legacy XML format changes, rewrite checkout logic. | Only edit the adapter class. |
| **Reusability** | XML translation code copy-pasted across services. | Centralized in one reusable adapter. |

---

## 8. When to Use & When NOT to Use

### ✅ When to USE
* You want to use an existing class, but its interface does not match the rest of your system.
* You are integrating third-party libraries, legacy systems, or vendor APIs with incompatible contracts.
* You want to create a reusable library that cooperates with unrelated or unforeseen classes.

### ❌ When NOT to USE
* When you have full control over both classes and can simply refactor them to share an interface.
* When interfaces are already compatible and only minor behavioral differences exist (use **Strategy** or **Decorator** instead).

---

## 9. Pros & Cons Trade-off Analysis

### 🟢 Advantages
* **Single Responsibility Principle:** Separates interface or data conversion code from the primary business logic.
* **Open/Closed Principle:** Introduce new types of adapters without breaking existing client code.
* Works seamlessly with closed-source 3rd-party JARs/SDKs.

### 🔴 Disadvantages
* Increases overall code complexity by introducing new interfaces and adapter classes.
* Minor performance overhead due to extra layer of delegation.

---

## 10. Real-World Everyday Examples

| Domain | Target Interface | Adapter | Adaptee (Legacy/Incompatible) |
| :--- | :--- | :--- | :--- |
| 🔌 **Hardware** | USB-C Port | USB-C to HDMI Adapter | HDMI Cable / Monitor |
| 📊 **Analytics** | JSON Metric Logger | XML-to-JSON Analytics Adapter | Legacy SOAP Monitoring Tool |
| 🗄️ **Storage** | CloudStorage (`upload(byte[])`) | S3StorageAdapter | AWS S3 SDK Client |
| ☕ **Java StdLib** | `java.util.Iterator` | `IteratorAdapter` | `java.util.Enumeration` |

---

## 11. The Ultimate Checklist & Mental Formula

### The Mental Formula
$$\text{Expected Target Interface} + \text{Composition Wrapper (Adapter)} + \text{Incompatible Class (Adaptee)} = \mathbf{Adapter\ Pattern}$$

### Decision Checklist
* [ ] Does an existing class have the functionality you need, but an incompatible interface?
* [ ] Is the incompatible class closed for modification (3rd party or legacy)?
* [ ] Does the adapter translate data formats or signatures transparently?
