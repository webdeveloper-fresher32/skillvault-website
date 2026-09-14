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

## 8. Class Skeletons (Python)

> Design skeletons focused on structure and key logic. A full runnable implementation lives in `LLD/Projects/`.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum


# ---------- Domain data ----------

class Coin(Enum):
    NICKEL = 5
    DIME = 10
    QUARTER = 25
    DOLLAR = 100


@dataclass(frozen=True)
class Product:
    """Immutable value object."""
    name: str
    price: int  # cents


class Inventory:
    """Owns slot -> (Product, quantity). Knows nothing about payment or state."""

    def __init__(self, slots: dict[str, tuple[Product, int]]):
        self.slots = slots

    def get_product(self, slot: str) -> Product:
        return self.slots[slot][0]

    def has_stock(self, slot: str) -> bool:
        return self.slots.get(slot, (None, 0))[1] > 0

    def decrement_stock(self, slot: str) -> None:
        product, qty = self.slots[slot]
        self.slots[slot] = (product, qty - 1)

    def restock(self, slot: str, qty: int) -> None:
        product, current = self.slots[slot]
        self.slots[slot] = (product, current + qty)


class Payment:
    """Tracks money inserted during the current session."""

    def __init__(self):
        self.amount_inserted = 0

    def add_coin(self, coin: Coin) -> None:
        self.amount_inserted += coin.value

    def is_sufficient(self, price: int) -> bool:
        return self.amount_inserted >= price

    def change_due(self, price: int) -> int:
        return max(0, self.amount_inserted - price)

    def reset(self) -> None:
        self.amount_inserted = 0


@dataclass
class Transaction:
    slot: str
    amount_paid: int
    change_returned: int
    status: str = "SUCCESS"


# ---------- State pattern ----------

class InvalidOperationError(Exception):
    pass


class VendingMachineState(ABC):
    def select_product(self, vm: "VendingMachine", slot: str) -> None:
        raise InvalidOperationError("Cannot select product in this state")

    def insert_coin(self, vm: "VendingMachine", coin: Coin) -> None:
        raise InvalidOperationError("Cannot insert coin in this state")

    def dispense(self, vm: "VendingMachine") -> None:
        raise InvalidOperationError("Cannot dispense in this state")

    def cancel(self, vm: "VendingMachine") -> None:
        raise InvalidOperationError("Nothing to cancel")


class IdleState(VendingMachineState):
    def select_product(self, vm: "VendingMachine", slot: str) -> None:
        if not vm.inventory.has_stock(slot):
            vm.selected_slot = slot
            vm.set_state(OutOfStockState())
            return
        vm.selected_slot = slot
        vm.set_state(HasMoneyState())


class HasMoneyState(VendingMachineState):
    def insert_coin(self, vm: "VendingMachine", coin: Coin) -> None:
        vm.payment.add_coin(coin)
        price = vm.inventory.get_product(vm.selected_slot).price
        if vm.payment.is_sufficient(price):
            vm.set_state(DispensingState())
            vm.dispense()

    def cancel(self, vm: "VendingMachine") -> None:
        vm.refund()
        vm.set_state(IdleState())


class DispensingState(VendingMachineState):
    """Transient — machine performs the dispense + change return, then resets to Idle."""
    pass


class OutOfStockState(VendingMachineState):
    def cancel(self, vm: "VendingMachine") -> None:
        vm.selected_slot = None
        vm.set_state(IdleState())


# ---------- Orchestrator ----------

class VendingMachine:
    def __init__(self, inventory: Inventory):
        self.state: VendingMachineState = IdleState()
        self.inventory = inventory
        self.payment = Payment()
        self.selected_slot: str | None = None
        self.transactions: list[Transaction] = []

    def set_state(self, state: VendingMachineState) -> None:
        self.state = state

    def select_product(self, slot: str) -> None:
        self.state.select_product(self, slot)

    def insert_coin(self, coin: Coin) -> None:
        self.state.insert_coin(self, coin)

    def cancel(self) -> None:
        self.state.cancel(self)

    def dispense(self) -> None:
        """Decrement stock, compute + return change, log transaction, reset to Idle."""
        product = self.inventory.get_product(self.selected_slot)
        change = self.payment.change_due(product.price)
        self.inventory.decrement_stock(self.selected_slot)
        self.transactions.append(
            Transaction(self.selected_slot, self.payment.amount_inserted, change)
        )
        self.payment.reset()
        self.selected_slot = None
        self.set_state(IdleState())

    def refund(self) -> None:
        """Return all inserted money on cancel."""
        self.payment.reset()
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
