# Enums and Dataclasses in LLD — Complete Guide

## Table of Contents
1. [The Problem: Magic Strings and Booleans](#1-the-problem-magic-strings-and-booleans)
2. [Enum Fundamentals](#2-enum-fundamentals)
3. [Enums Modeling State Machines](#3-enums-modeling-state-machines)
4. [Dataclass Fundamentals](#4-dataclass-fundamentals)
5. [Combining Enum + Dataclass for Value Objects](#5-combining-enum--dataclass-for-value-objects)
6. [Why This Matters for LLD Interviews](#6-why-this-matters-for-lld-interviews)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Magic Strings and Booleans

A very common beginner (and mid-level) mistake in LLD interviews is representing a fixed set of states or categories using raw strings or booleans:

```python
class Order:
    def __init__(self, status: str) -> None:
        self.status = status  # "pending", "PENDING", "Pending" — no consistency!

order = Order("pending")
if order.status == "Paid":   # typo bug — silently never true, no error raised
    ship(order)
```

Problems this causes:
- **Typos are silent bugs** — `"Paid"` vs `"paid"` mismatches compile fine and fail silently.
- **No IDE autocomplete** — you can't discover valid values without reading documentation or source.
- **No enforcement** — nothing stops `Order(status="bananas")`.
- **Booleans don't scale** — `is_paid: bool` works for two states, but real systems have `PENDING`, `PAID`, `SHIPPED`, `CANCELLED`, `REFUNDED` — you'd need a combinatorial mess of booleans.

---

## 2. Enum Fundamentals

Python's `enum.Enum` gives you a fixed, named, type-checked set of values:

```python
from enum import Enum, auto


class OrderStatus(Enum):
    PENDING = auto()
    PAID = auto()
    SHIPPED = auto()
    DELIVERED = auto()
    CANCELLED = auto()


status = OrderStatus.PENDING
print(status)               # OrderStatus.PENDING
print(status.name)          # "PENDING"
print(status.value)         # 1  (auto() assigns 1, 2, 3, ...)

# Type-safe comparison — no typo risk
if status == OrderStatus.PENDING:
    print("Order not yet paid")

# Invalid values are rejected outright
try:
    OrderStatus["BANANAS"]
except KeyError as e:
    print(f"Invalid status: {e}")
```

`StrEnum`-style (string-backed) enums are useful when you need the value to serialize cleanly (e.g., to JSON/an API response):

```python
from enum import Enum


class VehicleType(Enum):
    CAR = "CAR"
    TRUCK = "TRUCK"
    MOTORCYCLE = "MOTORCYCLE"


v = VehicleType.CAR
print(v.value)          # "CAR" — clean for JSON serialization
print(VehicleType("CAR") is VehicleType.CAR)  # True — safe reverse lookup
```

---

## 3. Enums Modeling State Machines

Enums shine when combined with a **valid-transitions map** — a common LLD interview requirement (e.g., "an order cannot go from DELIVERED back to PENDING"):

```python
from enum import Enum, auto


class OrderStatus(Enum):
    PENDING = auto()
    PAID = auto()
    SHIPPED = auto()
    DELIVERED = auto()
    CANCELLED = auto()


VALID_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PENDING: {OrderStatus.PAID, OrderStatus.CANCELLED},
    OrderStatus.PAID: {OrderStatus.SHIPPED, OrderStatus.CANCELLED},
    OrderStatus.SHIPPED: {OrderStatus.DELIVERED},
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}


class Order:
    def __init__(self, order_id: str) -> None:
        self.order_id = order_id
        self.status = OrderStatus.PENDING

    def transition_to(self, new_status: OrderStatus) -> None:
        allowed = VALID_TRANSITIONS[self.status]
        if new_status not in allowed:
            raise ValueError(
                f"Cannot transition from {self.status.name} to {new_status.name}"
            )
        self.status = new_status
        print(f"Order {self.order_id}: {self.status.name}")


order = Order("ORD-1")
order.transition_to(OrderStatus.PAID)       # Order ORD-1: PAID
order.transition_to(OrderStatus.SHIPPED)    # Order ORD-1: SHIPPED

try:
    order.transition_to(OrderStatus.PENDING)  # invalid — SHIPPED can't go back
except ValueError as e:
    print(e)  # Cannot transition from SHIPPED to PENDING
```

This is a common LLD interview requirement (parking lot spot states, elevator states, order lifecycle, booking states) and the enum + transition map combination is the idiomatic way to implement it.

---

## 4. Dataclass Fundamentals

`@dataclass` auto-generates `__init__`, `__repr__`, and `__eq__` for classes that primarily hold data — eliminating repetitive boilerplate:

```python
from dataclasses import dataclass


# Without dataclass — verbose boilerplate
class MoneyOld:
    def __init__(self, amount: float, currency: str) -> None:
        self.amount = amount
        self.currency = currency

    def __repr__(self) -> str:
        return f"MoneyOld(amount={self.amount}, currency={self.currency!r})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, MoneyOld):
            return NotImplemented
        return self.amount == other.amount and self.currency == other.currency


# With dataclass — same behavior, far less code
@dataclass
class Money:
    amount: float
    currency: str


m1 = Money(49.99, "USD")
m2 = Money(49.99, "USD")
print(m1)              # Money(amount=49.99, currency='USD')
print(m1 == m2)         # True — field-by-field equality, generated for free
```

Use `frozen=True` to make instances immutable — ideal for **value objects** (things identified by their value, not their identity, per DDD terminology often used in LLD interviews):

```python
@dataclass(frozen=True)
class Money:
    amount: float
    currency: str


price = Money(49.99, "USD")
try:
    price.amount = 59.99   # frozen — reassignment raises
except Exception as e:
    print(f"{type(e).__name__}: {e}")
    # FrozenInstanceError: cannot assign to field 'amount'
```

---

## 5. Combining Enum + Dataclass for Value Objects

The real power for LLD shows up when Enums (for categorical fields) and dataclasses (for structured, immutable data) are combined:

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class VehicleType(Enum):
    CAR = "CAR"
    TRUCK = "TRUCK"
    MOTORCYCLE = "MOTORCYCLE"


class OrderStatus(Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    SHIPPED = "SHIPPED"


@dataclass(frozen=True)
class Vehicle:
    license_plate: str
    vehicle_type: VehicleType


@dataclass
class Order:
    order_id: str
    vehicle: Vehicle
    status: OrderStatus = OrderStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)

    def mark_paid(self) -> None:
        self.status = OrderStatus.PAID


car = Vehicle(license_plate="KA-01-AB-1234", vehicle_type=VehicleType.CAR)
order = Order(order_id="ORD-42", vehicle=car)

print(order)
# Order(order_id='ORD-42', vehicle=Vehicle(license_plate='KA-01-AB-1234',
#       vehicle_type=<VehicleType.CAR: 'CAR'>), status=<OrderStatus.PENDING: 'PENDING'>,
#       created_at=...)

order.mark_paid()
print(order.status)  # OrderStatus.PAID
```

Notes:
- `field(default_factory=datetime.now)` is required instead of `created_at: datetime = datetime.now()` — a bare mutable/callable default would be evaluated once at class-definition time and shared across all instances, which is exactly the "mutable default argument" trap Python developers must know to avoid.
- `Vehicle` is `frozen=True` (a true value object — two vehicles with the same plate and type are equal and cannot be mutated), while `Order` is a regular mutable dataclass because its status legitimately changes over its lifecycle.

---

## 6. Why This Matters for LLD Interviews

- **Enums make state machines explicit and safe** — parking lots, elevators, order/booking lifecycles (Phases 08–09) all require modeling a fixed set of states with controlled transitions; `Enum` + a transitions map is the standard idiomatic solution.
- **Dataclasses eliminate boilerplate under time pressure** — in a 45-minute interview, hand-writing `__init__`/`__eq__`/`__repr__` for every small class wastes time you need for the actual design; `@dataclass` gets you there in one line.
- **`frozen=True` demonstrates understanding of value objects vs entities** — a distinction interviewers sometimes probe directly ("is `Money` identified by identity or by value?").
- **Avoids a classic Python bug (mutable defaults)** — correctly using `field(default_factory=...)` instead of a bare mutable default is a small detail interviewers notice as a sign of real Python experience.
- **Readability for the interviewer** — `status: OrderStatus` reads clearly on a whiteboard/shared editor; `status: str` invites the interviewer to ask "what are the valid values?" — a question you'd rather have already answered.

---

## 7. Hands-On Exercises

**Exercise 1:** Model `BookingStatus` (`REQUESTED`, `CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`, `CANCELLED`) as an `Enum`, with a `VALID_TRANSITIONS` map, and a `Booking` class that enforces transitions via a `transition_to` method.

**Exercise 2:** Create a `frozen=True` dataclass `Address` with fields `street`, `city`, `postal_code`. Prove two `Address` instances with identical field values are `==` to each other despite being different objects (`is` returns `False`, `==` returns `True`).

**Exercise 3:** Create a `Reservation` dataclass with a `created_at: datetime` field defaulting via `field(default_factory=datetime.now)`. Explain (in a comment) what would go wrong if you instead wrote `created_at: datetime = datetime.now()`.

**Exercise 4:** Combine an `Enum` (`SeatClass`: `ECONOMY`, `BUSINESS`, `FIRST`) with a dataclass `Seat` (`seat_number: str`, `seat_class: SeatClass`, `is_occupied: bool = False`). Write a function that filters a `list[Seat]` down to unoccupied `BUSINESS` seats.

---

## 8. Interview Q&A

**Q: Why prefer `Enum` over raw strings or integers for a field like order status?**
Answer: `Enum` gives you a fixed, named, type-checked set of valid values. Typos like `"Paid"` vs `"paid"` become impossible because you reference `OrderStatus.PAID`, not a string literal; IDEs autocomplete the valid members; and invalid values are rejected (`OrderStatus("bananas")` raises `ValueError`). Raw strings/ints offer none of these guarantees and let invalid states slip through silently.

**Q: What does `@dataclass` generate for you automatically?**
Answer: By default it generates `__init__` (based on the annotated fields), `__repr__` (a readable string representation), and `__eq__` (field-by-field equality comparison). Optional flags add more: `order=True` adds ordering methods (`<`, `<=`, etc.), and `frozen=True` makes instances immutable by disabling attribute reassignment after construction.

**Q: What's the difference between a mutable dataclass and a `frozen=True` dataclass, and when would you use each?**
Answer: A mutable dataclass allows fields to be reassigned after construction — appropriate for entities whose state legitimately changes over time, like an `Order` transitioning through statuses. A `frozen=True` dataclass raises an error on any attempted mutation — appropriate for value objects like `Money` or `Address`, which should be treated as immutable and compared by value, not identity.

**Q: Why is `field(default_factory=list)` (or `datetime.now`) necessary instead of a plain default value like `created_at: datetime = datetime.now()`?**
Answer: A bare default expression is evaluated exactly once, at class-definition time, and that same object/value is then shared across every instance created without an explicit argument. For a timestamp, every instance would get the same "frozen at import time" datetime; for a mutable default like a list, every instance would share and mutate the *same* list object. `default_factory` defers evaluation to each instance's construction time, giving every instance its own fresh value.

**Q: How would you model an order's lifecycle (pending → paid → shipped → delivered) so that invalid transitions are impossible?**
Answer: Define the states as an `Enum` (`OrderStatus`), then define a `VALID_TRANSITIONS: dict[OrderStatus, set[OrderStatus]]` mapping each state to the set of states it's allowed to move to. A `transition_to(new_status)` method looks up the current status in that map and raises a `ValueError` if the requested transition isn't in the allowed set — this is a lightweight, dependency-free state machine and is the standard way to enforce state transitions in Python LLD problems.

**Q: Are Enum members singletons — i.e., is `OrderStatus.PAID is OrderStatus.PAID` always `True`?**
Answer: Yes. Enum members are created once when the `Enum` class is defined and are guaranteed to be singleton instances — every reference to `OrderStatus.PAID` anywhere in the program returns the exact same object. This means identity comparison (`is`) works reliably for Enum members, unlike for most other Python objects where `==` is the safer comparison.
