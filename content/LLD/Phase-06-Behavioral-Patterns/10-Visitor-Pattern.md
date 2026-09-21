# 🧠 The Ultimate Guide to Visitor Pattern (LLD)

> **Core Philosophy:** *Represent an operation to be performed on the elements of an object structure. Visitor lets you define a new operation without changing the classes of the elements on which it operates.*

---

## 📌 Table of Contents
1. [The Problem: Why Do We Need It?](#1-the-problem-why-do-we-need-it)
2. [The Double Dispatch Mechanism Explained](#2-the-double-dispatch-mechanism-explained)
3. [The Core Architecture (The 4 Participants)](#3-the-core-architecture-the-4-participants)
4. [Step-by-Step Implementation (Java)](#4-step-by-step-implementation-java)
5. [UML Class Diagram & Relationships](#5-uml-class-diagram--relationships)
6. [Execution Flow: The Double Dispatch Ping-Pong](#6-execution-flow-the-double-dispatch-ping-pong)
7. [Side-by-Side Comparison: Polluting Domain vs Visitor](#7-side-by-side-comparison-polluting-domain-vs-visitor)
8. [When to Use & When NOT to Use](#8-when-to-use--when-not-to-use)
9. [Pros & Cons Trade-off Analysis](#9-pros--cons-trade-off-analysis)
10. [Real-World Everyday Examples](#10-real-world-everyday-examples)
11. [The Ultimate Checklist & Mental Formula](#11-the-ultimate-checklist--mental-formula)

---

## 1. The Problem: Why Do We Need It?

### Real-World Domain Example: E-Commerce Shopping Cart Multi-Format Operations (Tax & Shipping) 🛒 📦
Imagine an e-commerce platform with diverse cart items:
* `Book` (Zero customs duty, flat shipping)
* `Electronics` (18% GST / luxury tax, insured shipping by weight)
* `PerishableFood` (5% tax, expedited cold-storage freight)

```
                            SHOPPING CART ITEMS
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
      Book (Item)            Electronics (Item)        PerishableFood (Item)
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     ▼
                   We constantly need NEW operations:
                      1. Calculate Tax by State / Country
                      2. Calculate Shipping Freight Cost
                      3. Generate Customs Export Manifest
```

### The Class Pollution Antipattern
Every time the marketing or finance department wants a new report or tax scheme, developers edit `Book.java`, `Electronics.java`, and `PerishableFood.java` to add `calculateCustomsTax()`, `calculateShippingCost()`, `exportToXml()`.
* ❌ Core business domain classes become bloated with unrelated peripheral operations.
* ❌ Violates Single Responsibility and Open/Closed Principles.

---

## 2. The Double Dispatch Mechanism Explained

Java uses **Single Dispatch**: method calls are resolved at runtime based on the **runtime type of the receiver object**, but parameters are statically typed at compile time.

The **Visitor Pattern** simulates **Double Dispatch**:
1. **1st Dispatch:** You call `element.accept(visitor)` (polymorphically dispatches to `Electronics` or `Book`).
2. **2nd Dispatch:** Inside `accept()`, the element calls `visitor.visit(this)` (passes exact concrete type to visitor!).

---

## 3. The Core Architecture (The 4 Participants)

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│        <<interface>> CartItem        │       │        <<interface>> CartVisitor     │
├──────────────────────────────────────┤       ├──────────────────────────────────────┤
│ + accept(visitor: CartVisitor)       │       │ + visit(book: Book)                  │
└──────────────────▲───────────────────┘       │ + visit(electronics: Electronics)    │
                   │ implements                └──────────────────▲───────────────────┘
         ┌─────────┴─────────┐                                    │ implements
         ▼                   ▼                         ┌──────────┴──────────┐
┌──────────────────┐┌──────────────────┐               ▼                     ▼
│       Book       ││   Electronics    │      ┌─────────────────┐   ┌─────────────────┐
├──────────────────┤├──────────────────┤      │  TaxCalculator  │   │ShippingEstimator│
│ + accept(visitor)││ + accept(visitor)│      └─────────────────┘   └─────────────────┘
└──────────────────┘└──────────────────┘
```

---

## 4. Step-by-Step Implementation (Java)

### Step 1: The Element Interface

```java
public interface CartItem {
    void accept(CartVisitor visitor);
}
```

---

### Step 2: The Visitor Interface (Overloaded visit methods)

```java
public interface CartVisitor {
    void visit(Book book);
    void visit(Electronics electronics);
}
```

---

### Step 3: Concrete Elements (Cart Items)

```java
public class Book implements CartItem {
    private final String title;
    private final double price;

    public Book(String title, double price) {
        this.title = title;
        this.price = price;
    }

    public double getPrice() { return price; }
    public String getTitle() { return title; }

    // DOUBLE DISPATCH: Passes `this` (typed as Book) to visitor!
    @Override
    public void accept(CartVisitor visitor) {
        visitor.visit(this);
    }
}

public class Electronics implements CartItem {
    private final String name;
    private final double price;
    private final double weightKg;

    public Electronics(String name, double price, double weightKg) {
        this.name = name;
        this.price = price;
        this.weightKg = weightKg;
    }

    public double getPrice() { return price; }
    public double getWeightKg() { return weightKg; }
    public String getName() { return name; }

    // DOUBLE DISPATCH: Passes `this` (typed as Electronics) to visitor!
    @Override
    public void accept(CartVisitor visitor) {
        visitor.visit(this);
    }
}
```

---

### Step 4: Concrete Visitors (Operations!)

#### Operation 1: Tax Calculation Visitor
```java
public class TaxVisitor implements CartVisitor {
    private double totalTax = 0;

    @Override
    public void visit(Book book) {
        // Books have 0% tax (educational goods)
        System.out.println("Tax on Book '" + book.getTitle() + "': ₹0 (Tax Free)");
    }

    @Override
    public void visit(Electronics electronics) {
        // Electronics have 18% GST
        double tax = electronics.getPrice() * 0.18;
        totalTax += tax;
        System.out.println("Tax on Electronics '" + electronics.getName() + "': ₹" + tax);
    }

    public double getTotalTax() { return totalTax; }
}
```

#### Operation 2: Shipping Cost Visitor
```java
public class ShippingCostVisitor implements CartVisitor {
    private double totalShipping = 0;

    @Override
    public void visit(Book book) {
        // Flat ₹40 book delivery
        totalShipping += 40;
        System.out.println("Shipping for Book: ₹40 flat rate");
    }

    @Override
    public void visit(Electronics electronics) {
        // ₹100 per kg for fragile electronics
        double cost = electronics.getWeightKg() * 100;
        totalShipping += cost;
        System.out.println("Shipping for Electronics (" + electronics.getWeightKg() + "kg): ₹" + cost);
    }

    public double getTotalShipping() { return totalShipping; }
}
```

---

### Step 5: Client Usage

```java
import java.util.Arrays;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<CartItem> cart = Arrays.asList(
            new Book("Clean Code", 800),
            new Electronics("PlayStation 5", 50000, 4.5)
        );

        // 1. Calculate Taxes across cart
        System.out.println("=== 1. CALCULATING TAXES ===");
        TaxVisitor taxVisitor = new TaxVisitor();
        for (CartItem item : cart) {
            item.accept(taxVisitor);
        }
        System.out.println("Total Cart Tax: ₹" + taxVisitor.getTotalTax());

        // 2. Calculate Shipping across cart without altering Book or Electronics!
        System.out.println("\n=== 2. CALCULATING SHIPPING ===");
        ShippingCostVisitor shippingVisitor = new ShippingCostVisitor();
        for (CartItem item : cart) {
            item.accept(shippingVisitor);
        }
        System.out.println("Total Shipping Cost: ₹" + shippingVisitor.getTotalShipping());
    }
}
```

---

## 5. UML Class Diagram & Relationships

```
┌──────────────────────────────────────────────┐
│             <<interface>> CartItem           │
├──────────────────────────────────────────────┤
│ + accept(visitor: CartVisitor)               │
└──────────────────────▲───────────────────────┘
                       │ implements
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌──────────────────┐        ┌──────────────────┐
│       Book       │        │   Electronics    │
├──────────────────┤        ├──────────────────┤
│ + accept(visitor)│        │ + accept(visitor)│
└──────────────────┘        └──────────────────┘

┌──────────────────────────────────────────────┐
│           <<interface>> CartVisitor          │
├──────────────────────────────────────────────┤
│ + visit(book: Book)                          │
│ + visit(electronics: Electronics)            │
└──────────────────────▲───────────────────────┘
                       │ implements
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌──────────────────┐        ┌──────────────────┐
│    TaxVisitor    │        │ShippingCostVisit │
└──────────────────┘        └──────────────────┘
```

---

## 6. Execution Flow: The Double Dispatch Ping-Pong

```
Client calls item.accept(taxVisitor)
   │
   ├─► 1st Dispatch: Resolves item at runtime to Book.accept(...)
   │
Book.accept(taxVisitor)
   │
   └─► 2nd Dispatch: Calls taxVisitor.visit(this) ── passes `Book` instance!
          │
          ▼
       TaxVisitor.visit(Book book) executes tax calculations!
```

---

## 7. Side-by-Side Comparison: Polluting Domain vs Visitor

| Metric | ❌ Bloating Domain Classes | ✅ With Visitor Pattern |
| :--- | :--- | :--- |
| **Adding New Operation**| Must edit every class (`Book`, `Electronics`, `Food`). | Just create one new `Visitor` class. Zero domain edits! |
| **Class Focus (SRP)** | `Book` knows about taxes, JSON, PDF export, shipping. | `Book` only knows book data. Visitors handle operations. |
| **Code Scattering** | Tax logic for 10 items scattered in 10 different files.| All tax logic grouped together inside `TaxVisitor`. |

---

## 8. When to Use & When NOT to Use

### ✅ When to USE
* You need to perform an operation over all elements of a complex object structure (e.g., AST syntax tree, document DOM).
* You want to add operations to classes without changing their source code.
* The element class hierarchy is **stable and rarely changes**, but you frequently add new operations.

### ❌ When NOT to USE
* When the element class hierarchy changes often (adding a new `CartItem` requires adding a new `visit()` method to the visitor interface and all concrete visitors).

---

## 9. Pros & Cons Trade-off Analysis

### 🟢 Advantages
* **Open/Closed Principle:** Add operations to classes of complex structures without modifying the structures themselves.
* **Single Responsibility Principle:** Moves unrelated operations into dedicated visitor classes.
* Accumulates state while traversing trees or collections.

### 🔴 Disadvantages
* Adding a new element class requires updating all existing visitors.
* Visitors might lack access to private fields of elements.

---

## 10. Real-World Everyday Examples

| Domain | Elements | Visitor Operations |
| :--- | :--- | :--- |
| 🧑‍💻 **Compilers (AST)** | `BinaryExpression`, `VariableNode` | `TypeCheckerVisitor`, `CodeGeneratorVisitor`, `BytecodeVisitor` |
| 📄 **Document Parsers** | `Paragraph`, `Table`, `Image` | `HtmlExportVisitor`, `PdfExportVisitor`, `WordCountVisitor` |

---

## 11. The Ultimate Checklist & Mental Formula

### The Mental Formula
$$\text{Element accept(visitor)} + \text{Visitor visit(element)} = \mathbf{Double\ Dispatch\ (Visitor\ Pattern)}$$
