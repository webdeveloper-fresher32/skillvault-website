# State Pattern — Complete Guide

## Table of Contents
1. [The Problem State Solves](#1-the-problem-state-solves)
2. [The Bad Example](#2-the-bad-example)
3. [The Good Example](#3-the-good-example)
4. [Real-World Tie-In](#4-real-world-tie-in)
5. [Complete Runnable Code](#5-complete-runnable-code)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem State Solves

An `Order` moves through statuses: `Placed → Shipped → Delivered`, or `Placed → Cancelled`. Every action (`ship()`, `deliver()`, `cancel()`) is only valid from certain statuses, and behavior (e.g. what a status string displays, whether a refund is allowed) differs per status. Modeling this with a plain `status: str` field and `if/elif` checks scattered across the codebase quickly becomes unmanageable and error-prone (illegal transitions slip through).

```
Without State:
  Order.ship()
     if self.status == "placed":
        self.status = "shipped"
     else:
        raise Exception("Cannot ship from this status")

  Order.cancel()
     if self.status in ("placed", "shipped"):
        self.status = "cancelled"
     else:
        raise Exception("Cannot cancel from this status")
  # every new status/action multiplies these checks combinatorially
```

**State Pattern**: allow an object to alter its behavior when its internal state changes, by delegating state-specific behavior to separate state objects — the object appears to change its class at runtime.

---

## 2. The Bad Example

```python
class Order:
    def __init__(self) -> None:
        self.status = "placed"

    def ship(self) -> None:
        if self.status == "placed":
            print("Order shipped")
            self.status = "shipped"
        else:
            raise ValueError(f"Cannot ship from status: {self.status}")

    def deliver(self) -> None:
        if self.status == "shipped":
            print("Order delivered")
            self.status = "delivered"
        else:
            raise ValueError(f"Cannot deliver from status: {self.status}")

    def cancel(self) -> None:
        if self.status in ("placed", "shipped"):
            print("Order cancelled")
            self.status = "cancelled"
        else:
            raise ValueError(f"Cannot cancel from status: {self.status}")
```

Problems:
- Every method re-implements the same "is this transition legal" logic with raw strings — typo-prone, no compiler help.
- Adding a new status (e.g. `"returned"`) means touching every method.
- `Order` mixes transition rules with business logic — Single Responsibility violated.

---

## 3. The Good Example

```
┌───────────┐        ┌────────────────────┐
│   Order   │◆──────│    «interface»       │
│(Context)  │ has-a  │    OrderState         │
│ - state    │        │ + ship(order)         │
└───────────┘        │ + deliver(order)      │
                       │ + cancel(order)       │
                       └────────────────────┘
                                 ▲
        ┌───────────────┬───────────────┬────────────────┐
┌────────────┐ ┌─────────────┐ ┌─────────────────┐ ┌──────────────┐
│PlacedState │ │ShippedState │ │ DeliveredState   │ │CancelledState│
└────────────┘ └─────────────┘ └─────────────────┘ └──────────────┘
```

Each concrete state knows exactly which transitions are legal from itself, and tells the `Order` (context) to move to the next state object. Illegal transitions raise from a single, well-defined place per state.

---

## 4. Real-World Tie-In

This is how ride-hailing apps model a trip's transport mode/status (`Requested → DriverAssigned → InProgress → Completed`), how document workflows model `Draft → InReview → Approved → Published`, and how a TCP connection's state machine (`Listen → SynReceived → Established → Closed`) is textbook State pattern.

---

## 5. Complete Runnable Code

```python
from __future__ import annotations
from abc import ABC, abstractmethod


class OrderState(ABC):
    """Common interface for every order status."""

    name: str = "base"

    @abstractmethod
    def ship(self, order: "Order") -> None: ...

    @abstractmethod
    def deliver(self, order: "Order") -> None: ...

    @abstractmethod
    def cancel(self, order: "Order") -> None: ...

    def _illegal(self, action: str) -> None:
        raise ValueError(f"Cannot {action} an order in '{self.name}' state")


class PlacedState(OrderState):
    name = "placed"

    def ship(self, order: "Order") -> None:
        print("Order shipped")
        order.set_state(ShippedState())

    def deliver(self, order: "Order") -> None:
        self._illegal("deliver")

    def cancel(self, order: "Order") -> None:
        print("Order cancelled")
        order.set_state(CancelledState())


class ShippedState(OrderState):
    name = "shipped"

    def ship(self, order: "Order") -> None:
        self._illegal("ship")

    def deliver(self, order: "Order") -> None:
        print("Order delivered")
        order.set_state(DeliveredState())

    def cancel(self, order: "Order") -> None:
        print("Order cancelled while in transit")
        order.set_state(CancelledState())


class DeliveredState(OrderState):
    name = "delivered"

    def ship(self, order: "Order") -> None:
        self._illegal("ship")

    def deliver(self, order: "Order") -> None:
        self._illegal("deliver")

    def cancel(self, order: "Order") -> None:
        self._illegal("cancel")


class CancelledState(OrderState):
    name = "cancelled"

    def ship(self, order: "Order") -> None:
        self._illegal("ship")

    def deliver(self, order: "Order") -> None:
        self._illegal("deliver")

    def cancel(self, order: "Order") -> None:
        self._illegal("cancel")


class Order:
    """Context: delegates all status-dependent behavior to the current state object."""

    def __init__(self, order_id: str) -> None:
        self.order_id = order_id
        self._state: OrderState = PlacedState()

    def set_state(self, state: OrderState) -> None:
        self._state = state

    @property
    def status(self) -> str:
        return self._state.name

    def ship(self) -> None:
        self._state.ship(self)

    def deliver(self) -> None:
        self._state.deliver(self)

    def cancel(self) -> None:
        self._state.cancel(self)


if __name__ == "__main__":
    order = Order("ORD-1001")
    print(order.status)   # placed
    order.ship()
    print(order.status)   # shipped
    order.deliver()
    print(order.status)   # delivered

    try:
        order.cancel()
    except ValueError as e:
        print(f"Error: {e}")
```

Expected output:
```
placed
Order shipped
shipped
Order delivered
delivered
Error: Cannot cancel an order in 'delivered' state
```

---

## 6. When to Use / Trade-offs

**Use State when:**
- An object's behavior depends heavily on its current status, and that status changes at runtime through well-defined transitions (order status, ride/trip status, workflow/document approval, TCP connection states, game character states).
- You have illegal-transition bugs today because status is a raw string/enum checked with scattered `if` statements.

**Trade-offs:**
- More classes than a single `status` field + `if/elif` — overkill for 2-3 statuses with trivial rules.
- State objects can be made stateless singletons (since they usually hold no instance data) to avoid allocating a new object on every transition — worth mentioning in interviews as an optimization.
- Debugging requires knowing which state class is active; a plain enum is easier to log/serialize (mitigate by exposing `order.status` as a string property, as done above).

| Aspect | Without State | With State |
|--------|-------------------|----------------|
| Illegal transitions | Checked ad-hoc per method, easy to miss | Each state only implements the transitions it allows |
| Adding a new status | Edit every method's `if/elif` | Add one new class implementing the interface |
| Behavior varying by status | Duplicated `if status ==` checks everywhere | Polymorphic dispatch — no `if` needed at call site |

---

## 7. Interview Q&A

**Q: What problem does the State pattern solve?**
Answer: It lets an object change its behavior when its internal state changes, without littering the codebase with conditionals on a status field. Each state is a class implementing a common interface; the context delegates to the "current state" object, and the state object itself decides which state comes next, keeping transition rules colocated with the state they belong to.

**Q: How is State different from Strategy? (Very common follow-up)**
Answer: They have identical structure (context holds an interface reference), but different intent and lifecycle. Strategy: the client explicitly picks and can swap the algorithm at any time; strategies don't know about each other. State: transitions happen automatically as a side effect of business events, driven by the state objects themselves, and each state usually knows which state(s) it can move to next. If your "strategies" start referencing each other and deciding what comes next, you've actually implemented State.

**Q: Should state objects be stateless singletons?**
Answer: Often yes — if a state class holds no per-instance data, you can share one instance across all contexts (e.g. `SHIPPED = ShippedState()` module-level singleton) rather than allocating a new one on every transition. This is a common micro-optimization to mention, though for clarity many implementations still create fresh instances, which is fine unless profiling shows it matters.

**Q: Implement a State-pattern state machine from scratch for a traffic light (Red -> Green -> Yellow -> Red).**
Answer:
```python
from abc import ABC, abstractmethod


class TrafficLightState(ABC):
    @abstractmethod
    def next(self, light: "TrafficLight") -> None: ...
    @abstractmethod
    def color(self) -> str: ...


class RedState(TrafficLightState):
    def next(self, light: "TrafficLight") -> None:
        light.set_state(GreenState())

    def color(self) -> str:
        return "RED"


class GreenState(TrafficLightState):
    def next(self, light: "TrafficLight") -> None:
        light.set_state(YellowState())

    def color(self) -> str:
        return "GREEN"


class YellowState(TrafficLightState):
    def next(self, light: "TrafficLight") -> None:
        light.set_state(RedState())

    def color(self) -> str:
        return "YELLOW"


class TrafficLight:
    def __init__(self) -> None:
        self._state: TrafficLightState = RedState()

    def set_state(self, state: TrafficLightState) -> None:
        self._state = state

    def change(self) -> None:
        self._state.next(self)
        print(f"Light is now {self._state.color()}")


light = TrafficLight()
for _ in range(4):
    light.change()  # GREEN, YELLOW, RED, GREEN
```

**Q: Can you implement State without a class per state, e.g. using an enum + transition table?**
Answer: Yes, for simpler machines a transition table (`dict[tuple[State, Event], State]`) driven by an `Enum` is lighter weight and easier to visualize/serialize than a class hierarchy. The class-per-state approach (GoF State pattern) wins when each state also carries distinct *behavior* (not just a label) — e.g. `DeliveredState` might disable refunds while `ShippedState` allows partial refunds, which is awkward to express in a pure transition table.

**Q: What's a real bug that the State pattern prevents?**
Answer: "Double shipping" or "shipping a cancelled order" bugs — where a raw `status` string check is missed in one code path (e.g. a new admin endpoint forgets to check `if status == "cancelled"`) and an illegal transition silently succeeds. Because each state class only exposes the transitions valid from it, an illegal call fails loudly and consistently everywhere, not just where someone remembered to add a guard.
