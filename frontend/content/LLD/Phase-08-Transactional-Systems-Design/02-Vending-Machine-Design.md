# Vending Machine — LLD Walkthrough

## Table of Contents
1. [Step 1: Clarify Requirements](#1-step-1-clarify-requirements)
2. [Step 2: Identify Entities/Classes](#2-step-2-identify-entitiesclasses)
3. [Step 3: Define Relationships](#3-step-3-define-relationships)
4. [Step 4: Assign Responsibilities](#4-step-4-assign-responsibilities)
5. [Step 5: Apply SOLID](#5-step-5-apply-solid)
6. [Step 6: Apply Design Patterns](#6-step-6-apply-design-patterns)
7. [Step 7: Explain Extensibility](#7-step-7-explain-extensibility)
8. [Class Skeletons (Python)](#8-class-skeletons-python)
9. [Interview Follow-ups](#9-interview-follow-ups)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Step 1: Clarify Requirements

**Functional requirements:**
- Machine holds multiple products, each in a numbered **slot** with a price and a quantity.
- Customer **selects a product**, then **inserts money** (coins/notes/card — assume coins + card for v1).
- Machine validates: is the slot in stock? Has enough money been inserted?
- If overpaid with cash, machine **returns change**; if underpaid, machine prompts for more money or lets the customer **cancel** and get a refund.
- Machine **dispenses the product** and updates inventory.

**Non-functional requirements:**
- Machine must never dispense without collecting full payment (or must refund correctly on cancel).
- Machine tracks running inventory per slot; a slot at zero quantity is not selectable.
- Single machine, single currency for v1.

**Out of scope for v1:** multi-item purchases in one session, machine restocking workflow, network-connected inventory sync — call these out explicitly to the interviewer.

---

## 2. Step 2: Identify Entities/Classes

| Class | Represents |
|-------|------------|
| `VendingMachine` | Orchestrator; owns current state and inventory |
| `VendingMachineState` (+ subclasses) | Idle, HasMoney, Dispensing, OutOfStock |
| `Product` | Name + price of an item |
| `Inventory` | Slot number → (Product, quantity) mapping |
| `Coin` (Enum) | Accepted coin denominations |
| `Payment` | Tracks amount inserted so far during a session |
| `Transaction` | Record of a completed (or refunded) purchase |

---

## 3. Step 3: Define Relationships

```
VendingMachine "1" ── "1" Inventory        (composition — Inventory has no existence outside the machine)
VendingMachine "1" ── "1" VendingMachineState (association — current state, swapped at runtime)
VendingMachine "1" ── "1" Payment           (composition — one active payment session at a time)
Inventory "1" ── "*" Product                (aggregation — products could be reused/restocked independently)
VendingMachine "1" ── "*" Transaction       (composition — log of completed purchases)
```

### ASCII Class Diagram

```
┌────────────────────────────────┐
│         VendingMachine           │
├────────────────────────────────┤
│ - state: VendingMachineState     │
│ - inventory: Inventory            │
│ - payment: Payment                │
│ - selectedSlot: str | None       │
│ - transactions: list[Transaction]│
├────────────────────────────────┤
│ + selectProduct(slot)            │
│ + insertCoin(coin)                │
│ + dispense()                       │
│ + cancel()                          │
│ + setState(state)                  │
└───────────────┬────────────────┘
                │ delegates to
                ▼
┌────────────────────────────────┐
│      <<abstract>>                │
│      VendingMachineState          │
├────────────────────────────────┤
│ + selectProduct(vm, slot)        │
│ + insertCoin(vm, coin)             │
│ + dispense(vm)                      │
│ + cancel(vm)                        │
└───────────────┬────────────────┘
     ┌──────────┼───────────┬────────────┐
     ▼          ▼            ▼            ▼
┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────────┐
│IdleState│ │HasMoney  │ │Dispensing │ │OutOfStock  │
│         │ │State     │ │State      │ │State       │
└─────────┘ └──────────┘ └───────────┘ └────────────┘

┌───────────────────┐        ┌───────────────────────┐
│      Inventory       │──────▶│        Product          │
├───────────────────┤ 1  *   ├───────────────────────┤
│ - slots: dict[str,   │        │ - name                  │
│   tuple[Product,int]]│        │ - price                  │
├───────────────────┤        └───────────────────────┘
│ + getProduct(slot)   │
│ + hasStock(slot)      │
│ + decrementStock(slot)│
└───────────────────┘

┌───────────────────┐        ┌───────────────────────┐
│      Payment         │        │      Transaction        │
├───────────────────┤        ├───────────────────────┤
│ - amountInserted     │        │ - slot                  │
├───────────────────┤        │ - amountPaid            │
│ + addCoin(coin)        │        │ - change                │
│ + reset()              │        │ - status                │
└───────────────────┘        └───────────────────────┘
```

---

## 4. Step 4: Assign Responsibilities

| Class | Responsibility (and only this) |
|-------|----------------------------------|
| `VendingMachine` | Session orchestration; delegates behavior to current state |
| `VendingMachineState` subclasses | What's legal right now, and the next transition |
| `Inventory` | Own slot → product/quantity mapping; stock checks and decrements |
| `Payment` | Track money inserted this session; compute change owed |
| `Product` | Immutable value object: name + price |
| `Transaction` | Immutable record of a completed/cancelled purchase |

---

## 5. Step 5: Apply SOLID

- **SRP** — `Inventory` only manages stock counts; `Payment` only tracks money; neither knows about machine states.
- **OCP** — New payment method (e.g., card tap) is a new method on `Payment`/a new `insertCard` action on states, without touching `Inventory`. New state (e.g., `MaintenanceState`) is a new subclass.
- **LSP** — Any `VendingMachineState` can substitute for another in `VendingMachine.state`; illegal actions in a state simply no-op or raise, never crash the machine.
- **ISP** — Client code (a "buy" UI) only needs `selectProduct`, `insertCoin`, `dispense`, `cancel` — it never needs to see `Inventory`'s internal slot representation.
- **DIP** — If you introduce a `PaymentGateway` for card payments, `VendingMachine`/`Payment` should depend on a `PaymentGateway` interface, not a concrete card processor.

---

## 6. Step 6: Apply Design Patterns

### State Pattern — for machine lifecycle

```
IdleState ──selectProduct(in stock)──▶ HasMoneyState
    │                                       │
    │ selectProduct(out of stock)   insertCoin (sufficient) 
    ▼                                       ▼
OutOfStockState                       DispensingState
    │                                       │
  cancel/reset                       dispense complete
    │                                       │
    └──────────────▶ IdleState ◀────────────┘
                          ▲
                          │ cancel (refund)
                    HasMoneyState
```

Just like the ATM, the alternative is a `status` flag checked in every method — State pattern removes that duplication and makes each transition explicit and testable in isolation.

### Why not Strategy here?

Unlike the ATM (multiple transaction *types*) or Splitwise (multiple split *algorithms*), a vending machine has one "buy" flow — the variability is in **state**, not in **algorithm**. If the interviewer adds multiple payment *methods* (coin vs. card vs. mobile wallet), that's where you'd introduce a `PaymentMethod` strategy — call this out as a forward-looking observation rather than adding it prematurely (YAGNI).

---

## 7. Step 7: Explain Extensibility

- **New payment method** (card, mobile wallet): add a `PaymentMethod` strategy interface with `CoinPayment`, `CardPayment` implementations; `Payment` delegates to whichever is active. No change to `VendingMachineState` classes.
- **New machine state** (e.g., `MaintenanceState` when a slot jams): add one subclass; existing states are untouched.
- **Multi-item cart**: `Payment`/`selectedSlot` becomes a list; this is the one change that ripples further (state transitions need to allow "add another item" from `HasMoneyState`) — flag this explicitly as a bigger redesign, not a drop-in extension, to show the interviewer you can recognize the boundary of "extension" vs. "rewrite."
- **Restocking**: `Inventory.restock(slot, qty)` is a pure addition; no other class needs to change.

---

## 8. Class Skeletons (Java)

> Design skeletons focused on structure and key logic. A full runnable implementation lives in `LLD/Projects/`.

```java
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

// ---------- Domain data ----------

public enum Coin {
    NICKEL(5), DIME(10), QUARTER(25), DOLLAR(100);

    private final int value;
    Coin(int value) { this.value = value; }
    public int getValue() { return value; }
}

public record Product(String name, int priceCents) {}

public class Inventory {
    private static class SlotItem {
        Product product;
        int quantity;
        SlotItem(Product product, int quantity) {
            this.product = product;
            this.quantity = quantity;
        }
    }

    private final Map<String, SlotItem> slots = new ConcurrentHashMap<>();

    public void addProduct(String slot, Product product, int quantity) {
        slots.put(slot, new SlotItem(product, quantity));
    }

    public Product getProduct(String slot) {
        SlotItem item = slots.get(slot);
        return (item != null) ? item.product : null;
    }

    public boolean hasStock(String slot) {
        SlotItem item = slots.get(slot);
        return item != null && item.quantity > 0;
    }

    public synchronized void decrementStock(String slot) {
        SlotItem item = slots.get(slot);
        if (item == null || item.quantity <= 0) {
            throw new IllegalStateException("Out of stock");
        }
        item.quantity--;
    }

    public synchronized void restock(String slot, int count) {
        SlotItem item = slots.get(slot);
        if (item != null) {
            item.quantity += count;
        }
    }
}

public class Payment {
    private int amountInserted = 0;

    public synchronized void addCoin(Coin coin) {
        this.amountInserted += coin.getValue();
    }

    public synchronized boolean isSufficient(int priceCents) {
        return amountInserted >= priceCents;
    }

    public synchronized int changeDue(int priceCents) {
        return Math.max(0, amountInserted - priceCents);
    }

    public synchronized int reset() {
        int refunded = amountInserted;
        this.amountInserted = 0;
        return refunded;
    }

    public synchronized int getAmountInserted() {
        return amountInserted;
    }
}

public record VendingTransaction(
    String slot,
    int amountPaid,
    int changeReturned,
    String status
) {}

// ---------- State pattern ----------

public interface VendingMachineState {
    default void selectProduct(VendingMachine vm, String slot) {
        throw new IllegalStateException("Cannot select product in current state");
    }
    default void insertCoin(VendingMachine vm, Coin coin) {
        throw new IllegalStateException("Cannot insert coin in current state");
    }
    default void dispense(VendingMachine vm) {
        throw new IllegalStateException("Cannot dispense in current state");
    }
    default void cancel(VendingMachine vm) {
        throw new IllegalStateException("Nothing to cancel");
    }
}

public class IdleState implements VendingMachineState {
    @Override
    public void selectProduct(VendingMachine vm, String slot) {
        if (!vm.getInventory().hasStock(slot)) {
            vm.setSelectedSlot(slot);
            vm.setState(new OutOfStockState());
            return;
        }
        vm.setSelectedSlot(slot);
        vm.setState(new HasMoneyState());
    }
}

public class HasMoneyState implements VendingMachineState {
    @Override
    public void insertCoin(VendingMachine vm, Coin coin) {
        vm.getPayment().addCoin(coin);
        Product product = vm.getInventory().getProduct(vm.getSelectedSlot());
        if (vm.getPayment().isSufficient(product.priceCents())) {
            vm.setState(new DispensingState());
            vm.dispense();
        }
    }

    @Override
    public void cancel(VendingMachine vm) {
        vm.refund();
        vm.setState(new IdleState());
    }
}

public class DispensingState implements VendingMachineState {}

public class OutOfStockState implements VendingMachineState {
    @Override
    public void cancel(VendingMachine vm) {
        vm.setSelectedSlot(null);
        vm.setState(new IdleState());
    }
}

// ---------- Orchestrator ----------

public class VendingMachine {
    private VendingMachineState state = new IdleState();
    private final Inventory inventory;
    private final Payment payment = new Payment();
    private String selectedSlot;
    private final List<VendingTransaction> transactions = new ArrayList<>();

    public VendingMachine(Inventory inventory) {
        this.inventory = inventory;
    }

    public void setState(VendingMachineState state) { this.state = state; }
    public VendingMachineState getState() { return state; }
    public Inventory getInventory() { return inventory; }
    public Payment getPayment() { return payment; }
    public void setSelectedSlot(String slot) { this.selectedSlot = slot; }
    public String getSelectedSlot() { return selectedSlot; }

    public void selectProduct(String slot) { state.selectProduct(this, slot); }
    public void insertCoin(Coin coin) { state.insertCoin(this, coin); }
    public void cancel() { state.cancel(this); }

    public void dispense() {
        Product product = inventory.getProduct(selectedSlot);
        int change = payment.changeDue(product.priceCents());
        inventory.decrementStock(selectedSlot);
        transactions.add(new VendingTransaction(selectedSlot, payment.getAmountInserted(), change, "SUCCESS"));
        payment.reset();
        selectedSlot = null;
        setState(new IdleState());
    }

    public int refund() {
        int refunded = payment.reset();
        selectedSlot = null;
        return refunded;
    }
}
```

---

## 9. Interview Follow-ups

**"How would you handle the machine running out of change (can't make correct change for the customer)?"**
Before entering `DispensingState`, check a `ChangeDispenser` (mirrors the ATM's `CashDispenser`) for whether the required change denominations are available. If not, refuse the sale from `HasMoneyState` and force a `cancel()`/refund rather than dispensing and shorting the customer — surface this as a new guard condition in `insert_coin`, not a new state.

**"How would you support paying by card instead of coins?"**
Introduce a `PaymentMethod` strategy interface (`CoinPayment`, `CardPayment`) with a common `pay(amount) -> bool` contract; `Payment` composes the active method. Card payments settle instantly (no partial-insertion state), so `HasMoneyState.insert_coin`-equivalent becomes a single `pay()` call that jumps straight to sufficient-or-declined, rather than accumulating.

**"Two people press the same slot's button at the exact same time — what happens?"**
`Inventory.decrement_stock` needs to be atomic (a lock or compare-and-swap on quantity), and `select_product` should re-check `has_stock` at the moment of dispensing, not just at selection time — otherwise two sessions can both "reserve" the last unit. This is the same class of bug as the ATM's concurrent-withdrawal problem: funnel the mutation through one guarded method.

**"How would you support restocking without taking the machine offline?"**
`Inventory.restock()` is already a pure addition to the quantity map; as long as it's guarded by the same lock used by `decrement_stock`, restocking can happen concurrently with sales with no state-machine changes at all.

---

## 10. Interview Q&A

**Q: Why model `OutOfStockState` as a separate state instead of just raising an error from `IdleState.select_product`?**
Answer: Being out of stock for a *specific slot* is a distinct, user-visible condition with its own legal action (cancel/reset), not an exceptional failure. Modeling it as a state keeps the "what's legal right now" logic consistent with the rest of the design (every state explicitly declares its legal transitions) rather than mixing exception handling with the state machine.

**Q: Why does `Payment` live as its own class instead of being fields directly on `VendingMachine`?**
Answer: Single Responsibility — `Payment` encapsulates the rules around money accumulation and change calculation, which can be tested independently of the state machine and reused if, say, you add a second machine sharing payment logic. It also gives you one obvious place to plug in a `PaymentMethod` strategy later.

**Q: How do you decide the exact moment stock is decremented — at selection or at dispense?**
Answer: At dispense, not at selection — decrementing at selection would let a customer "reserve" a product indefinitely by never inserting money (or by walking away), starving other customers. Stock should only be committed once payment is confirmed sufficient, immediately before physical dispensing.

**Q: Why is `Transaction` created only in `dispense()` and not when the customer cancels?**
Answer: This is a design choice worth stating explicitly to the interviewer either way — logging cancellations as a `Transaction` with `status="CANCELLED"` is equally valid and often preferable for audit/analytics purposes (e.g., tracking abandoned purchases). The important point is picking one and being consistent, and explaining the tradeoff (audit completeness vs. only tracking revenue events).

**Q: What's the risk of putting `has_stock` and `decrement_stock` as two separate calls instead of one atomic `try_reserve(slot)` method?**
Answer: A check-then-act race: two threads can both pass `has_stock` as true before either calls `decrement_stock`, over-selling the last unit. In a concurrent environment you'd collapse these into one atomic method (e.g., `Inventory.try_reserve(slot) -> bool` using a lock or DB-level atomic decrement with a `WHERE quantity > 0` guard).
