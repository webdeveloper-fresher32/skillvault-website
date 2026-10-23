# 🧠 The Ultimate Guide to Strategy Pattern (LLD)

> **Core Philosophy:** *Encapsulate interchangeable behaviors behind a common contract, allowing behavior to switch dynamically at runtime without modifying existing code.*

---

## 📌 Table of Contents

1. [The Problem: Why Do We Need It?](#1-the-problem-why-do-we-need-it)
2. [The Core Architecture (The 3 Pillars)](#2-the-core-architecture-the-3-pillars)
3. [Step-by-Step Implementation (Java)](#3-step-by-step-implementation-java)
4. [UML Class Diagram &amp; Relationships](#4-uml-class-diagram--relationships)
5. [Execution Flow &amp; Runtime Polymorphism](#5-execution-flow--runtime-polymorphism)
6. [Side-by-Side Comparison: Bad Code vs Strategy Pattern](#6-side-by-side-comparison-bad-code-vs-strategy-pattern)
7. [When to Use &amp; When NOT to Use](#7-when-to-use--when-not-to-use)
8. [Pros &amp; Cons Trade-off Analysis](#8-pros--cons-trade-off-analysis)
9. [Real-World Everyday Examples](#9-real-world-everyday-examples)
10. [The Ultimate Checklist &amp; Mental Formula](#10-the-ultimate-checklist--mental-formula)

---

## 1. The Problem: Why Do We Need It?

Imagine designing a checkout system for an e-commerce platform.

### The Scenario

We want to perform **one single action** (`PAY MONEY`), but there are **multiple distinct ways** to do it:

```JavaScript
                  PAY MONEY (Single Action)
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   Credit Card 💳          UPI 📱           Net Banking 🏦
```

### The Naive Approach: One Monolithic Service

Putting all payment mechanisms inside a single class using `if-else` or `switch-case` leads to:

* ❌ **Rigid Code:** Adding Apple Pay, PayPal, or Crypto forces modification of existing, battle-tested code.
* ❌ **Violation of SRP & OCP:** One class manages unrelated business rules (violates Single Responsibility & Open/Closed Principles).
* ❌ **Testing Nightmare:** Every change requires regression testing on all payment mechanisms.

---

## 2. The Core Architecture (The 3 Pillars)

The Strategy Pattern eliminates conditionals by splitting behavior into three distinct components:

```
   ┌─────────────────────────────────────────────────────────────┐
   │ 1. Strategy Interface (Contract)                            │
   │    Defines the signature common to all supported algorithms.│
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ 2. Concrete Strategies (Implementations)                    │
   │    Separate classes implementing the interface independently│
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ 3. Context (Orchestrator)                                   │
   │    Holds a reference to the strategy interface and executes.│
   └─────────────────────────────────────────────────────────────┘
```

---

## 3. Step-by-Step Implementation (Java)

### Step 1: Define the Strategy Interface

Find what is common across all payment methods. They all make a payment:

```java
public interface PaymentStrategy {
    void pay(double amount);
}
```

---

### Step 2: Create Concrete Strategies

Each payment behavior gets its own encapsulated class:

#### 💳 Credit Card Strategy

```java
public class CreditCardPayment implements PaymentStrategy {
    @Override
    public void pay(double amount) {
        System.out.println("Paid ₹" + amount + " using Credit Card");
    }
}
```

#### 📱 UPI Strategy

```java
public class UPIPayment implements PaymentStrategy {
    @Override
    public void pay(double amount) {
        System.out.println("Paid ₹" + amount + " using UPI");
    }
}
```

#### 🏦 Net Banking Strategy

```java
public class NetBankingPayment implements PaymentStrategy {
    @Override
    public void pay(double amount) {
        System.out.println("Paid ₹" + amount + " using Net Banking");
    }
}
```

---

### Step 3: Define the Context Class

The Context holds a reference to the abstraction (`PaymentStrategy`), completely decoupled from concrete classes.

```java
public class PaymentService {
    private PaymentStrategy paymentStrategy;

    // Inject strategy via constructor (or setter)
    public PaymentService(PaymentStrategy paymentStrategy) {
        this.paymentStrategy = paymentStrategy;
    }

    // Optional setter to switch strategy on the fly
    public void setPaymentStrategy(PaymentStrategy paymentStrategy) {
        this.paymentStrategy = paymentStrategy;
    }

    public void makePayment(double amount) {
        paymentStrategy.pay(amount);
    }
}
```

> 💡 **Key Insight:** `PaymentService` does not know how UPI, Credit Card, or Net Banking works. It only knows: *"I have a `PaymentStrategy`, and I will invoke its `pay()` contract."*

---

### Step 4: Client Usage & Dynamic Behavior Switching

```java
public class Main {
    public static void main(String[] args) {
        // User selects UPI
        PaymentStrategy upi = new UPIPayment();
        PaymentService service = new PaymentService(upi);
        service.makePayment(1000); // Output: Paid ₹1000 using UPI

        // User switches to Credit Card at runtime
        PaymentStrategy card = new CreditCardPayment();
        service.setPaymentStrategy(card);
        service.makePayment(2500); // Output: Paid ₹2500 using Credit Card
    }
}
```

---

## 4. UML Class Diagram & Relationships

```JavaScript
                    ┌─────────────────────────┐
                    │    <<interface>>        │
                    │   PaymentStrategy       │
                    ├─────────────────────────┤
                    │ + pay(amount): void     │
                    └────────────▲────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              │ implements       │ implements       │ implements
              ▼                  ▼                  ▼
┌───────────────────┐  ┌───────────────────┐  ┌─────────────────────┐
│ CreditCardPayment │  │    UPIPayment     │  │ NetBankingPayment   │
├───────────────────┤  ├───────────────────┤  ├─────────────────────┤
│ + pay(amount)     │  │ + pay(amount)     │  │ + pay(amount)       │
└───────────────────┘  └───────────────────┘  └─────────────────────┘


                    ┌─────────────────────────┐
                    │       <<Context>>       │
                    │     PaymentService      │
                    ├─────────────────────────┤
                    │ - strategy              │
                    │   : PaymentStrategy     │
                    ├─────────────────────────┤
                    │ + makePayment(amount)   │
                    │ + setPaymentStrategy()  │
                    └────────────┬────────────┘
                                 │
                                 │ HAS-A (Composition)
                                 ▼
                         PaymentStrategy
```

### UML Relationships Explained

1. **`implements` (Realization):**
   `UPIPayment`, `CreditCardPayment`, and `NetBankingPayment` implement `PaymentStrategy`. They guarantee compliance with `pay(double amount)`.
2. **`HAS-A` (Composition / Aggregation):**
   `PaymentService` holds a private reference to `PaymentStrategy`. It depends upon abstraction, honoring the **Dependency Inversion Principle (DIP)**.

---

## 5. Execution Flow & Runtime Polymorphism

When `paymentService.makePayment(1000)` is invoked:

```
CLIENT
   │
   │ 1. Instantiates UPIPayment & passes to Context
   ▼
PaymentService (Context)
   │
   │ 2. Calls paymentStrategy.pay(1000)
   ▼
PaymentStrategy (Reference)
   │
   │ 3. Resolves at runtime via Dynamic Method Dispatch
   ▼
UPIPayment.pay(1000) (Concrete Execution)
   │
   ▼
"Paid ₹1000 using UPI" ✅
```

### 🤯 The Core Mechanism: Runtime Polymorphism

* Variable type: `PaymentStrategy` (Compile-time contract)
* Actual Object: `UPIPayment` or `CreditCardPayment` (Runtime entity)
* Java evaluates the exact instance method at runtime (**Dynamic Dispatch**).
* **Same method call (`pay()`) → completely different runtime behavior.**

---

## 6. Side-by-Side Comparison: Bad Code vs Strategy Pattern

| Metric                       | ❌ Without Strategy Pattern (Procedural / Monolithic)              | ✅ With Strategy Pattern                                              |
| :--------------------------- | :----------------------------------------------------------------- | :-------------------------------------------------------------------- |
| **Code Structure**     | Massive`if-else` or `switch` inside one service class.         | Clean, decoupled classes behind a common interface.                   |
| **Adding New Feature** | Modifies existing class (`else if (type.equals("PAYPAL"))`).     | Creates one new class (`PayPalPayment implements PaymentStrategy`). |
| **OCP Adherence**      | ❌ Violates Open/Closed Principle (modifies existing tested code). | ✅ Fully compliant (Open for extension, closed for modification).     |
| **Unit Testing**       | ❌ Complex; requires mocking and branch coverage testing.          | ✅ Trivial; test each strategy class in total isolation.              |
| **Merge Conflicts**    | ❌ High; multiple developers edit the same payment file.           | ✅ Low; developers work on independent strategy files.                |

```java
// ❌ BAD: Fragile, bloated, error-prone
public void pay(String type, double amount) {
    if (type.equals("UPI")) {
        // 50 lines of UPI logic
    } else if (type.equals("CARD")) {
        // 50 lines of Card logic
    } else if (type.equals("NET_BANKING")) {
        // 50 lines of Bank logic
    }
}

// ✅ CLEAN: Open for extension, closed for modification
public class PayPalPayment implements PaymentStrategy {
    @Override
    public void pay(double amount) {
        System.out.println("Paid using PayPal");
    }
}
// Zero changes to PaymentService, UPIPayment, or CreditCardPayment!
```

---

## 7. When to Use & When NOT to Use

### ✅ When to USE

1. **Multiple Algorithms for the Same Action:**
   * Sorting algorithms (`QuickSort`, `MergeSort`, `TimSort`).
   * Discount strategies (`NormalDiscount`, `FestivalDiscount`, `VipDiscount`).
2. **Multiple External Providers / Payment Methods:**
   * Payment gateways, Authentication providers (Google, GitHub, OTP).
3. **Dynamic Behavior Switching at Runtime:**
   * Game characters switching attack types (Sword, Gun, Magic).
   * Navigation routing (Fastest, Shortest, Avoid Tolls, Eco Route).
4. **Isolating Volatile Logic:**
   * When algorithms change frequently and need isolation from business services.

### ❌ When NOT to USE

1. **Only One Fixed Implementation:**
   * If UPI is your only supported method and will remain so, Strategy Pattern is overengineering.
2. **Different, Non-Interchangeable Behaviors:**
   * `registerUser()`, `deleteUser()`, `updateUser()` are completely different operations, not interchangeable strategies for the same action.
3. **Trivial, Static Conditions:**
   * A single boolean check (`if (isWeekend) discount = 0.1;`) does not warrant an interface, 2 classes, and a context.

---

## 8. Pros & Cons Trade-off Analysis

### 🟢 Advantages

1. **Eliminates Conditional Spaghetti:** Eradicates nested `if-else` and `switch` blocks.
2. **Open / Closed Principle:** Add new strategies without touching existing code.
3. **Single Responsibility Principle:** Each strategy encapsulates only its specific algorithm.
4. **Interchangeable at Runtime:** Behavior can be switched dynamically using setters or dependency injection.
5. **Independent Testability:** High unit test coverage with minimal mocking.

### 🔴 Disadvantages & Pitfalls

1. **Increased Number of Classes:** Every new behavior introduces a new class file.
2. **Client Must Select the Strategy:** The client needs to understand which strategy to choose.
   > 💡 *Industry Best Practice:* Combine **Factory Pattern + Strategy Pattern**. The Factory instantiates the appropriate Strategy based on user input or config, shielding the client.
   >

---

## 9. Real-World Everyday Examples

| Domain                             | Action               | Strategies                                                           |
| :--------------------------------- | :------------------- | :------------------------------------------------------------------- |
| 🚗**Navigation Apps**        | `calculateRoute()` | `FastestRoute`, `ShortestRoute`, `AvoidTolls`, `ScenicRoute` |
| 📦**Logistics / E-Commerce** | `shipPackage()`    | `AirDelivery`, `RoadDelivery`, `SeaCargo`                      |
| 🎮**Gaming Engine**          | `attack()`         | `SwordAttack`, `BowAndArrowAttack`, `MagicSpellAttack`         |
| 📬**Messaging Platform**     | `notify()`         | `EmailNotification`, `SmsNotification`, `PushNotification`     |
| 🗜️**Compression Tool**     | `compress()`       | `ZipCompression`, `RarCompression`, `GzipCompression`          |

---

## 10. The Ultimate Checklist & Mental Formula

### The Mental Formula

$$
\text{Interface (Contract)} + \text{Concrete Implementations (Algorithms)} + \text{Context (Has-A Reference)} = \mathbf{Strategy\ Pattern}
$$

### 6-Point Decision Checklist

* [ ] Do I have **one specific action/goal**?
* [ ] Are there **multiple ways/algorithms** to achieve it?
* [ ] Are those behaviors **interchangeable**?
* [ ] Do they share a **common method signature**?
* [ ] Do I need to **switch between them at runtime**?
* [ ] Are **new implementations expected** in the future?

> If you checked **YES** to most points 👉 **Use Strategy Pattern!**
