# Dataclasses — Complete Guide

## Table of Contents
1. [The Boilerplate Problem](#1-the-boilerplate-problem)
2. [`@dataclass` Basics](#2-dataclass-basics)
3. [`field()` for Defaults and Mutable Defaults](#3-field-for-defaults-and-mutable-defaults)
4. [`frozen=True` — Immutable Value Objects](#4-frozentrue--immutable-value-objects)
5. [Dataclasses vs Plain Classes vs `NamedTuple`](#5-dataclasses-vs-plain-classes-vs-namedtuple)
6. [When NOT to Use a Dataclass](#6-when-not-to-use-a-dataclass)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Boilerplate Problem

Plain classes that mostly just hold data require a lot of repetitive, error-prone boilerplate: `__init__` assigning every field, `__repr__` for debugging, `__eq__` for comparison — all hand-written and easy to let drift out of sync as fields are added.

### Bad Example — Hand-Rolled Data Holder

```python
class Coordinates:
    def __init__(self, latitude: float, longitude: float) -> None:
        self.latitude = latitude
        self.longitude = longitude

    def __repr__(self) -> str:
        return f"Coordinates(latitude={self.latitude!r}, longitude={self.longitude!r})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Coordinates):
            return NotImplemented
        return self.latitude == other.latitude and self.longitude == other.longitude


c1 = Coordinates(12.9716, 77.5946)
c2 = Coordinates(12.9716, 77.5946)
print(c1 == c2)   # True — but it took writing __init__, __repr__, and __eq__ by hand
print(c1)         # Coordinates(latitude=12.9716, longitude=77.5946)
```

Three lines of *actual* information (two fields) required roughly fifteen lines of ceremony, and every future field addition means touching three separate methods, each of which could be forgotten or written inconsistently.

---

## 2. `@dataclass` Basics

`@dataclass` generates `__init__`, `__repr__`, and `__eq__` automatically from type-annotated class attributes.

```python
from dataclasses import dataclass


@dataclass
class Coordinates:
    latitude: float
    longitude: float


c1 = Coordinates(12.9716, 77.5946)
c2 = Coordinates(12.9716, 77.5946)

print(c1)         # Coordinates(latitude=12.9716, longitude=77.5946) — __repr__ generated
print(c1 == c2)   # True — __eq__ generated, compares field by field
print(c1.latitude)  # 12.9716 — plain attribute access, exactly like a normal class
```

Same behavior as Section 1's hand-written version, in four lines instead of fifteen. You can still add regular methods to a dataclass exactly as you would to any class:

```python
from dataclasses import dataclass
from math import radians, sin, cos, sqrt, atan2


@dataclass
class Coordinates:
    latitude: float
    longitude: float

    def distance_km_to(self, other: "Coordinates") -> float:
        R = 6371.0
        lat1, lat2 = radians(self.latitude), radians(other.latitude)
        dlat = lat2 - lat1
        dlon = radians(other.longitude - self.longitude)
        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        return R * 2 * atan2(sqrt(a), sqrt(1 - a))


bengaluru = Coordinates(12.9716, 77.5946)
mumbai = Coordinates(19.0760, 72.8777)
print(round(bengaluru.distance_km_to(mumbai)))  # ~840 (km)
```

---

## 3. `field()` for Defaults and Mutable Defaults

Just like `__init__` (Lesson 01, Section 5), dataclasses need special handling for mutable default values — but they make the trap impossible to hit accidentally by raising an error instead of silently sharing state.

### Bad Example — The Same Mutable-Default Trap, But Caught Immediately

```python
from dataclasses import dataclass


@dataclass
class ShoppingCart:
    owner: str
    items: list[str] = []   # dataclass REFUSES this outright
```

Running this raises immediately at class-definition time:

```
ValueError: mutable default <class 'list'> for field items is not allowed:
use default_factory
```

This is a real improvement over plain `__init__` and Section 5 of Lesson 01 — the bug there was silent and only showed up when two instances mysteriously shared data; here, Python refuses to even define the class.

### Good Example — `field(default_factory=...)`

```python
from dataclasses import dataclass, field


@dataclass
class ShoppingCart:
    owner: str
    items: list[str] = field(default_factory=list)   # fresh list per instance
    discount_percent: float = 0.0                     # plain immutable defaults are fine directly


cart1 = ShoppingCart("Asha")
cart1.items.append("Laptop")

cart2 = ShoppingCart("Ravi")
print(cart2.items)  # [] — correctly independent, no shared-list bug possible
```

`field(default_factory=list)` tells the generated `__init__` to call `list()` fresh for every new instance, exactly like the `items if items is not None else []` pattern from Lesson 01 — but enforced by the dataclass machinery instead of relying on the developer remembering it.

`field()` also supports other useful options:

```python
from dataclasses import dataclass, field


@dataclass
class Order:
    order_id: str
    items: list[str] = field(default_factory=list)
    internal_notes: str = field(default="", repr=False)   # exclude from generated __repr__
    _computed_total: float = field(default=0.0, compare=False)  # exclude from generated __eq__


o = Order("ORD-1", ["Laptop"], internal_notes="VIP customer")
print(o)  # Order(order_id='ORD-1', items=['Laptop']) — internal_notes hidden from repr
```

---

## 4. `frozen=True` — Immutable Value Objects

`frozen=True` makes instances immutable after construction — any attempted attribute assignment raises an error. This is ideal for value objects that should never change once created (money amounts, coordinates, IDs).

### Bad Example — Mutable Value Object, Accidentally Modified

```python
from dataclasses import dataclass


@dataclass
class Money:
    amount: float
    currency: str


def apply_discount(price: Money, percent: float) -> Money:
    price.amount -= price.amount * (percent / 100)   # mutates the CALLER's object!
    return price


original_price = Money(1000, "USD")
discounted = apply_discount(original_price, 10)

print(original_price.amount)  # 900.0 — the caller's original object was silently mutated!
```

Because `Money` is mutable, `apply_discount` accidentally corrupts the caller's original object instead of producing a new one — a classic source of hard-to-trace bugs when value-like objects are passed around and functions assume they're safe to read.

### Good Example — `frozen=True` Prevents Accidental Mutation

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Money:
    amount: float
    currency: str


def apply_discount(price: Money, percent: float) -> Money:
    new_amount = price.amount - price.amount * (percent / 100)
    return Money(new_amount, price.currency)   # forced to return a NEW object


original_price = Money(1000, "USD")
discounted = apply_discount(original_price, 10)

print(original_price.amount)  # 1000 — untouched
print(discounted.amount)      # 900.0 — new object

original_price.amount = 5000  # dataclasses.FrozenInstanceError: cannot assign to field 'amount'
```

`frozen=True` also automatically makes `__hash__` available (using all fields), so frozen dataclasses can be used directly as dict keys or set members — unlike regular (mutable) dataclasses, which are unhashable by default once `__eq__` is generated (the same `__eq__`-without-`__hash__` rule from Lesson 07, Section 3).

```python
prices_seen: set[Money] = {Money(100, "USD"), Money(100, "USD"), Money(200, "USD")}
print(len(prices_seen))  # 2 — duplicates by value collapse, thanks to generated __hash__
```

---

## 5. Dataclasses vs Plain Classes vs `NamedTuple`

| | Plain class | `@dataclass` | `@dataclass(frozen=True)` | `NamedTuple` |
|---|---|---|---|---|
| Boilerplate | You write everything | Auto: `__init__`, `__repr__`, `__eq__` | Same, plus immutability + hashability | Auto, tuple-based |
| Mutable | Yes | Yes (by default) | No | No |
| Can add custom methods | Yes | Yes | Yes | Yes |
| Can add validation logic | Yes (in `__init__`) | Yes (via `__post_init__`) | Yes (via `__post_init__`, though fields are frozen after) | Limited |
| Behaves like a tuple (unpacking, indexing) | No | No | No | Yes |
| Best for | Rich objects with behavior + encapsulated state | Data-holding objects that also need custom methods | Value objects (money, coordinates, IDs) that should never change | Simple, tuple-like records, especially for interop with code expecting tuples |

Validation with `@dataclass` uses `__post_init__`, which runs automatically right after the generated `__init__`:

```python
from dataclasses import dataclass


@dataclass
class Order:
    item: str
    price: float
    quantity: int = 1

    def __post_init__(self) -> None:
        if self.price < 0:
            raise ValueError("price cannot be negative")
        if self.quantity <= 0:
            raise ValueError("quantity must be positive")


Order("Laptop", -500)  # ValueError: price cannot be negative — raised via __post_init__
```

---

## 6. When NOT to Use a Dataclass

Dataclasses are for objects whose primary purpose is **holding data**, optionally with a few convenience methods. They're the wrong tool when:

- The object's whole purpose is **behavior and encapsulated state**, not exposed data — e.g., `PaymentProcessor` or `BankAccount` from earlier lessons, where hiding `__balance` behind controlled methods (Lesson 03) is the entire point. A dataclass, by contrast, is designed to expose its fields directly.
- You need an **abstract base class** — `@dataclass` and `ABC`/`@abstractmethod` can technically be combined, but the moment a class is primarily about defining a *contract* for subclasses rather than holding data, a plain `ABC` is clearer.
- Fields need complex, interdependent validation or derived state that's cleaner expressed with full `@property` getters/setters (Lesson 07) than a single `__post_init__` block.

```python
# Good use of dataclass: DTO / value object — data-first
@dataclass(frozen=True)
class OrderLineItem:
    product_id: str
    quantity: int
    unit_price: float

    @property
    def subtotal(self) -> float:
        return self.quantity * self.unit_price


# Poor use of dataclass: behavior-first object — encapsulation is the point
class BankAccount:  # deliberately NOT a dataclass — balance must stay protected
    def __init__(self, owner: str, balance: float = 0.0) -> None:
        self.owner = owner
        self.__balance = balance

    def deposit(self, amount: float) -> None:
        ...
```

---

## 7. Hands-On Exercises

**Exercise 1:** Convert a hand-written `Address` class (street, city, zip_code) with manual `__init__`, `__repr__`, `__eq__` into a `@dataclass`, and confirm behavior is identical.

**Exercise 2:** Create a `@dataclass` `CartItem` with a `list[str] = field(default_factory=list)` field for tags, and demonstrate the mutable-default error you'd get without `field()`.

**Exercise 3:** Create `@dataclass(frozen=True) class ProductId: value: str` and use instances of it as dictionary keys in a `dict[ProductId, int]` inventory map — explain why this only works because of `frozen=True`.

**Exercise 4:** Add `__post_init__` validation to a `@dataclass class Rectangle: width: float; height: float` that rejects non-positive dimensions, plus a computed `@property area`.

---

## 8. Interview Q&A

**Q: What does `@dataclass` generate for you automatically?**
Answer: By default, `@dataclass` generates `__init__` (assigning each annotated class attribute as a constructor parameter), `__repr__` (a readable representation showing all fields), and `__eq__` (field-by-field equality comparison). Optional flags add more: `frozen=True` makes instances immutable and hashable; `order=True` generates `__lt__`, `__le__`, `__gt__`, `__ge__` based on field order.

**Q: Why can't you write `items: list = []` as a dataclass field default, and what's the fix?**
Answer: This is the same mutable-default-argument trap that affects plain `__init__` methods — a single shared list object would be reused across every instance that doesn't override it. Dataclasses actively detect this and raise a `ValueError` at class-definition time rather than allowing the bug to exist silently. The fix is `field(default_factory=list)`, which tells the generated `__init__` to call `list()` fresh for every new instance.

**Q: What does `frozen=True` do, and why would you want it for something like a `Money` or `Coordinates` class?**
Answer: `frozen=True` makes dataclass instances immutable — any attempt to assign to a field after construction raises `dataclasses.FrozenInstanceError`. For value objects that represent a fixed quantity (a price, a coordinate, an ID), immutability prevents a whole class of bugs where a function receives such an object, mutates it in place, and unexpectedly corrupts the caller's original data; instead, operations must explicitly construct and return new instances. As a bonus, frozen dataclasses are also hashable by default, so they can be used in sets and as dict keys.

**Q: When would you choose a plain class over a `@dataclass`?**
Answer: When the class's purpose is primarily behavior and encapsulated internal state rather than exposing data — for example, a `BankAccount` or `PaymentProcessor` where the whole design goal is to hide implementation details (like a private balance) behind controlled methods. Dataclasses are optimized for the opposite case: objects whose fields are meant to be read and compared directly, like DTOs, coordinates, or configuration objects.

**Q: How do you add custom validation to a dataclass?**
Answer: Define a `__post_init__` method — the dataclass-generated `__init__` calls it automatically immediately after setting all the fields, so you can validate the now-fully-populated instance and raise an exception if something is invalid (e.g., a negative price or zero quantity). This keeps validation co-located with the class while still getting all the generated boilerplate (`__init__`, `__repr__`, `__eq__`) for free.

**Q: Are dataclasses just syntactic sugar, or do they behave differently from a class with manually written `__init__`/`__repr__`/`__eq__`?**
Answer: Functionally, a correctly hand-written class and an equivalent `@dataclass` behave the same at runtime — `@dataclass` is a class decorator that inspects the type-annotated class attributes and generates the same kind of methods you'd write by hand. The real value is reduced boilerplate and consistency: fields can't get out of sync between `__init__`, `__repr__`, and `__eq__` because they're all generated from the same single source of truth (the annotated fields), and dataclass-specific safety nets (like rejecting mutable defaults) catch bugs earlier than the equivalent hand-written class would.
