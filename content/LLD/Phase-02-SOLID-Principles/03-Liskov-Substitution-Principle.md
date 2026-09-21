# Liskov Substitution Principle (LSP) in Java — Complete Guide

## Table of Contents
1. [Core Definition & Behavioral Subtyping](#1-core-definition--behavioral-subtyping)
2. [The Classic Violation: Rectangle vs Square](#2-the-classic-violation-rectangle-vs-square)
3. [The Subcontract Rules: Preconditions, Postconditions, Invariants](#3-the-subcontract-rules-preconditions-postconditions-invariants)
4. [LSP Violations with UnsupportedOperationException](#4-lsp-violations-with-unsupportedoperationexception)
5. [Refactoring: Replacing False Inheritance with Common Abstraction](#5-refactoring-replacing-false-inheritance-with-common-abstraction)
6. [Real-World Example: Read-Only Account vs Debit Account](#6-real-world-example-read-only-account-vs-debit-account)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Core Definition & Behavioral Subtyping

> *"Let $\Phi(x)$ be a property provable about objects $x$ of type $T$. Then $\Phi(y)$ should be true for objects $y$ of type $S$ where $S$ is a subtype of $T$."* — Barbara Liskov

In plain English: **Subtypes must be substitutable for their base types without altering the correctness of the program.**

---

## 2. The Classic Violation: Rectangle vs Square

In mathematics, a Square is a Rectangle. But in Object-Oriented Design, modeling Square as a subclass of Rectangle breaks behavioral substitutability:

```java
// ❌ BAD: Square breaks Rectangle contract
public class Rectangle {
    protected int width;
    protected int height;

    public void setWidth(int width) { this.width = width; }
    public void setHeight(int height) { this.height = height; }
    public int getArea() { return width * height; }
}

public class Square extends Rectangle {
    @Override
    public void setWidth(int width) {
        this.width = width;
        this.height = width; // Mutates height unexpectedly!
    }

    @Override
    public void setHeight(int height) {
        this.width = height;
        this.height = height; // Mutates width unexpectedly!
    }
}

// Breaking Program Correctness:
void verifyArea(Rectangle r) {
    r.setWidth(5);
    r.setHeight(4);
    // Caller expects 5 * 4 = 20
    assert r.getArea() == 20; // 💥 FAILS for Square! (Returns 16)
}
```

---

## 3. The Subcontract Rules: Preconditions, Postconditions, Invariants

When creating a subclass:
- **Preconditions cannot be strengthened**: Subclass cannot demand stricter input than parent.
- **Postconditions cannot be weakened**: Subclass must guarantee at least as much outcome as parent.
- **Invariants must be preserved**: Class rules valid in parent must remain valid in subclass.

---

## 4. LSP Violations with UnsupportedOperationException

A dead giveaway of an LSP violation in machine coding is throwing `UnsupportedOperationException`:

```java
// ❌ BAD: Violates LSP
public class ReadOnlyFile extends File {
    @Override
    public void write(byte[] data) {
        throw new UnsupportedOperationException("Read only file!"); // Breaks caller expectations!
    }
}
```

---

## 5. Refactoring: Replacing False Inheritance with Common Abstraction

```java
// ✅ Clean Design: Separate into capability interfaces
public interface Shape {
    int getArea();
}

public class Rectangle implements Shape {
    private final int width;
    private final int height;

    public Rectangle(int width, int height) {
        this.width = width;
        this.height = height;
    }

    @Override public int getArea() { return width * height; }
}

public class Square implements Shape {
    private final int side;

    public Square(int side) {
        this.side = side;
    }

    @Override public int getArea() { return side * side; }
}
```

---

## 6. Real-World Example: Read-Only Account vs Debit Account

```java
// Base Interface: readable balance
public interface Account {
    double getBalance();
}

// Specific Sub-Interface: accounts supporting withdrawals
public interface DebitAccount extends Account {
    void withdraw(double amount);
}

public class FixedDepositAccount implements Account {
    private final double principal;
    public FixedDepositAccount(double principal) { this.principal = principal; }
    @Override public double getBalance() { return principal; }
    // No withdrawal method -> No LSP violation!
}

public class CheckingAccount implements DebitAccount {
    private double balance;
    public CheckingAccount(double balance) { this.balance = balance; }
    @Override public double getBalance() { return balance; }
    @Override public void withdraw(double amount) { this.balance -= amount; }
}
```

---

## 7. Interview Q&A

**Q: How does LSP relate to polymorphism?**  
*Answer:* Polymorphism allows dynamic dispatch, but LSP ensures that dynamic dispatch preserves correctness. Without LSP, polymorphism leads to unpredictable runtime errors, hidden type checks (`if (obj instanceof SubClass)`), and fragile code.
