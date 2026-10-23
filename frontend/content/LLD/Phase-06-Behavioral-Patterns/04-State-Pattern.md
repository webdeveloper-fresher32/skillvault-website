# 🧠 The Ultimate Guide to State Pattern (LLD)

> **Core Philosophy:** *Allow an object to alter its behavior when its internal state changes. The object will appear to change its class.*

---

## 📌 Table of Contents
1. [The Problem: Why Do We Need It?](#1-the-problem-why-do-we-need-it)
2. [State vs Strategy: The Key Difference](#2-state-vs-strategy-the-key-difference)
3. [The Core Architecture (The 3 Participants)](#3-the-core-architecture-the-3-participants)
4. [Step-by-Step Implementation (Java)](#4-step-by-step-implementation-java)
5. [UML Class Diagram & Relationships](#5-uml-class-diagram--relationships)
6. [Finite State Machine (FSM) Transition Diagram](#6-finite-state-machine-fsm-transition-diagram)
7. [Side-by-Side Comparison: Nested Switch vs State](#7-side-by-side-comparison-nested-switch-vs-state)
8. [When to Use & When NOT to Use](#8-when-to-use--when-not-to-use)
9. [Pros & Cons Trade-off Analysis](#9-pros--cons-trade-off-analysis)
10. [Real-World Everyday Examples](#10-real-world-everyday-examples)
11. [The Ultimate Checklist & Mental Formula](#11-the-ultimate-checklist--mental-formula)

---

## 1. The Problem: Why Do We Need It?

### Real-World Domain Example: Automated Vending Machine Lifecycle 🥤
Imagine designing an Automated Vending Machine. The machine supports 4 actions:
1. `insertCoin()`
2. `ejectCoin()`
3. `selectProduct()`
4. `dispense()`

However, what each button does depends completely on the **machine's current state**:
* **No Coin State:** Cannot select product or dispense; inserting coin moves to `Has Coin`.
* **Has Coin State:** Can eject coin or select product; selecting product moves to `Sold`.
* **Sold State:** Dispenses item, then moves to `No Coin` (or `Sold Out`).
* **Sold Out State:** Rejects all coins and actions.

```
       ┌───────────────┐        insertCoin()        ┌───────────────┐
       │    No Coin    ├───────────────────────────►│    Has Coin   │
       └───────▲───────┘                            └───────┬───────┘
               │                                            │
    dispense() │                                            │ selectProduct()
               │                                            ▼
       ┌───────┴───────┐                            ┌───────────────┐
       │   Dispensing  │◄───────────────────────────┤      Sold     │
       └───────────────┘                            └───────────────┘
```

### The Naive Antipattern: Huge Nested Switch Statements
```java
// Fragile, monster conditional block in EVERY method:
public void selectProduct() {
    if (state == NO_COIN) {
        System.out.println("Please insert coin first.");
    } else if (state == HAS_COIN) {
        System.out.println("Product selected...");
        state = SOLD;
    } else if (state == SOLD) {
        System.out.println("Already dispensing!");
    } else if (state == SOLD_OUT) {
        System.out.println("Machine empty!");
    }
}
```
* Adding a new state (e.g., `RefillState` or `MaintenanceState`) forces edits across every single method!

---

## 2. State vs Strategy: The Key Difference

| Dimension | Strategy Pattern | State Pattern |
| :--- | :--- | :--- |
| **Intent** | Swap interchangeable algorithms. | Change behavior based on internal state. |
| **Awareness** | Strategies are completely unaware of each other. | States usually know about each other and trigger **transitions**. |
| **Initiator** | Chosen by the **Client** externally. | Swapped **internally** by the context or states as events occur. |

---

## 3. The Core Architecture (The 3 Participants)

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│ Context (VendingMachine)             │       │ <<interface>> VendingMachineState    │
├──────────────────────────────────────┤       ├──────────────────────────────────────┤
│ - state : VendingMachineState        │◄──────┤ + insertCoin()                       │
│ + setState(s: VendingMachineState)   │HAS-A  │ + ejectCoin()                        │
│ + insertCoin()                       │       │ + selectProduct()                    │
│ + dispense()                         │       │ + dispense()                         │
└──────────────────────────────────────┘       └──────────────────▲───────────────────┘
                                                                  │ implements
                                       ┌──────────────────────────┴──────────────────────────┐
                                       ▼                                                     ▼
                            ┌─────────────────────┐                               ┌─────────────────────┐
                            │     NoCoinState     │                               │     HasCoinState    │
                            └─────────────────────┘                               └─────────────────────┘
```

---

## 4. Step-by-Step Implementation (Java)

### Step 1: The State Interface

```java
public interface VendingState {
    void insertCoin();
    void ejectCoin();
    void selectProduct();
    void dispense();
}
```

---

### Step 2: The Context (Vending Machine)

```java
public class VendingMachine {
    // Available State Singletons or Instances
    private final VendingState noCoinState;
    private final VendingState hasCoinState;
    private final VendingState soldState;

    private VendingState currentState;
    private int itemCount;

    public VendingMachine(int itemCount) {
        this.itemCount = itemCount;
        noCoinState = new NoCoinState(this);
        hasCoinState = new HasCoinState(this);
        soldState = new SoldState(this);

        this.currentState = noCoinState;
    }

    public void setState(VendingState state) { this.currentState = state; }

    // Actions delegated directly to current state!
    public void insertCoin() { currentState.insertCoin(); }
    public void ejectCoin() { currentState.ejectCoin(); }
    public void selectProduct() { currentState.selectProduct(); }
    public void dispense() { currentState.dispense(); }

    public void releaseProduct() {
        if (itemCount > 0) {
            System.out.println("🥤 Bottle of soda drops into dispenser tray!");
            itemCount--;
        }
    }

    // State getters
    public VendingState getNoCoinState() { return noCoinState; }
    public VendingState getHasCoinState() { return hasCoinState; }
    public VendingState getSoldState() { return soldState; }
}
```

---

### Step 3: Concrete State Implementations

#### State 1: No Coin State
```java
public class NoCoinState implements VendingState {
    private final VendingMachine machine;

    public NoCoinState(VendingMachine machine) { this.machine = machine; }

    @Override
    public void insertCoin() {
        System.out.println("Coin accepted. ₹20 inserted.");
        machine.setState(machine.getHasCoinState()); // Transition to HasCoin
    }

    @Override
    public void ejectCoin() { System.out.println("No coin to return."); }
    @Override
    public void selectProduct() { System.out.println("Please insert a coin first!"); }
    @Override
    public void dispense() { System.out.println("Payment required before dispensing."); }
}
```

#### State 2: Has Coin State
```java
public class HasCoinState implements VendingState {
    private final VendingMachine machine;

    public HasCoinState(VendingMachine machine) { this.machine = machine; }

    @Override
    public void insertCoin() { System.out.println("Already have a coin inserted!"); }

    @Override
    public void ejectCoin() {
        System.out.println("Coin returned to tray.");
        machine.setState(machine.getNoCoinState()); // Transition back
    }

    @Override
    public void selectProduct() {
        System.out.println("Product selection confirmed.");
        machine.setState(machine.getSoldState()); // Transition to Sold
    }

    @Override
    public void dispense() { System.out.println("Select a product first."); }
}
```

#### State 3: Sold State
```java
public class SoldState implements VendingState {
    private final VendingMachine machine;

    public SoldState(VendingMachine machine) { this.machine = machine; }

    @Override
    public void insertCoin() { System.out.println("Please wait, currently dispensing."); }
    @Override
    public void ejectCoin() { System.out.println("Cannot return coin; product already chosen."); }
    @Override
    public void selectProduct() { System.out.println("Already processing your selection."); }

    @Override
    public void dispense() {
        machine.releaseProduct();
        machine.setState(machine.getNoCoinState()); // Transition back to ready
    }
}
```

---

### Step 4: Client Usage

```java
public class Main {
    public static void main(String[] args) {
        VendingMachine machine = new VendingMachine(5);

        // Try invalid action
        machine.selectProduct(); // "Please insert a coin first!"

        // Valid purchase flow
        machine.insertCoin();    // "Coin accepted. ₹20 inserted."
        machine.selectProduct(); // "Product selection confirmed."
        machine.dispense();      // "🥤 Bottle drops!" ──► Transitions back to NoCoin
    }
}
```

---

## 5. UML Class Diagram & Relationships

```
┌──────────────────────────────────────────────┐
│                VendingMachine                │
├──────────────────────────────────────────────┤
│ - currentState : VendingState                │
│ - itemCount : int                            │
├──────────────────────────────────────────────┤
│ + insertCoin()                               │
│ + ejectCoin()                                │
│ + selectProduct()                            │
│ + dispense()                                 │
│ + setState(s: VendingState)                  │
└──────────────────────┬───────────────────────┘
                       │ HAS-A
                       ▼
┌──────────────────────────────────────────────┐
│            <<interface>> VendingState        │
├──────────────────────────────────────────────┤
│ + insertCoin()                               │
│ + ejectCoin()                                │
│ + selectProduct()                            │
│ + dispense()                                 │
└──────────────────────▲───────────────────────┘
                       │ implements
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌───────────────────┐       ┌───────────────────┐
│    NoCoinState    │       │    HasCoinState   │
└───────────────────┘       └───────────────────┘
```

---

## 6. Finite State Machine (FSM) Transition Diagram

```
                 insertCoin()
        ┌─────────────────────────────┐
        ▼                             │
┌───────────────┐             ┌───────┴───────┐
│    No Coin    │             │    Has Coin   │
└───────▲───────┘             └───────┬───────┘
        │                             │
        │ dispense()                  │ selectProduct()
        │                             ▼
┌───────┴───────┐             ┌───────────────┐
│     Sold      │◄────────────┤   Dispensing  │
└───────────────┘             └───────────────┘
```

---

## 7. Side-by-Side Comparison: Nested Switch vs State

| Metric | ❌ Nested Conditionals | ✅ State Pattern |
| :--- | :--- | :--- |
| **Complexity** | 100+ lines of nested switch statements. | Small, dedicated classes for each state. |
| **Adding New State** | Modify every single method in the monolith. | Add one new state class. Open/Closed Principle compliant! |
| **State Invariants** | Easy to corrupt transitions by accident. | Explicit, encapsulated transition rules. |

---

## 8. When to Use & When NOT to Use

### ✅ When to USE
* An object has behavior that changes depending on its internal state, and its behavior must change dynamically at runtime.
* Operations have massive, multipart conditional statements that depend on the object's state.

### ❌ When NOT to USE
* When a state machine only has 2 states and transitions are trivial (e.g. `isActive = true/false`).

---

## 9. Pros & Cons Trade-off Analysis

### 🟢 Advantages
* **Single Responsibility Principle:** Organizes code related to particular states into separate classes.
* **Open/Closed Principle:** Introduces new states without changing existing state classes or context.
* Eliminates massive conditionals.

### 🔴 Disadvantages
* Can be overkill if a state machine has few states and rarely changes.

---

## 10. Real-World Everyday Examples

| Domain | States | Context |
| :--- | :--- | :--- |
| 🛒 **Order Fulfillment** | `Ordered`, `Paid`, `Shipped`, `Delivered`, `Cancelled` | E-Commerce Order |
| 📺 **Media Player** | `Playing`, `Paused`, `Stopped`, `Buffering` | Video Player |
| 📄 **Document Workflow** | `Draft`, `Moderation`, `Published`, `Archived` | CMS Article |

---

## 11. The Ultimate Checklist & Mental Formula

### The Mental Formula
$$\text{Context (Current State Ref)} + \text{State Interface} + \text{Concrete States (Triggering Transitions)} = \mathbf{State\ Pattern}$$
