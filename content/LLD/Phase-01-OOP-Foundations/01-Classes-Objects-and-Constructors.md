# Classes, Objects, and Constructors — Complete Guide

## Table of Contents
1. [Why Object-Oriented Design Matters in LLD Interviews](#1-why-object-oriented-design-matters-in-lld-interviews)
2. [Classes vs Objects](#2-classes-vs-objects)
3. [The Constructor: `__init__`](#3-the-constructor-__init__)
4. [Instance Variables vs Class Variables](#4-instance-variables-vs-class-variables)
5. [The Mutable Default Trap](#5-the-mutable-default-trap)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Object-Oriented Design Matters in LLD Interviews

LLD interviews ask you to design systems like "Parking Lot," "Ride Sharing," or "Splitwise" as working Python classes in 30-45 minutes. The interviewer isn't grading your algorithm skills — they're grading whether you can:

- Identify the right **entities** (nouns) and turn them into classes.
- Give each entity the right **state** (attributes) and **behavior** (methods).
- Keep responsibilities separated so the design can evolve (add a new payment type, a new vehicle type) without rewriting everything.

Every other lesson in this course builds on the basic vocabulary covered here: classes, objects, and constructors.

---

## 2. Classes vs Objects

A **class** is a blueprint. An **object** (or **instance**) is a concrete thing built from that blueprint.

```
Class: Vehicle                       Objects (instances):
┌─────────────────────┐              ┌────────────────────────┐
│ Vehicle              │             │ car1: Vehicle           │
│ - license_plate      │  ──new()──▶ │   license_plate="KA01"  │
│ - vehicle_type       │             │   vehicle_type="CAR"    │
│ + honk()             │             └────────────────────────┘
└─────────────────────┘              ┌────────────────────────┐
                                      │ car2: Vehicle           │
                                      │   license_plate="MH12"  │
                                      │   vehicle_type="BIKE"   │
                                      └────────────────────────┘
```

One class, many independent objects — each with its own copy of instance data.

```python
class Vehicle:
    def __init__(self, license_plate: str, vehicle_type: str) -> None:
        self.license_plate = license_plate
        self.vehicle_type = vehicle_type

    def honk(self) -> str:
        return f"{self.license_plate} says beep!"


car1 = Vehicle("KA01AB1234", "CAR")
car2 = Vehicle("MH12CD5678", "BIKE")

print(car1.honk())  # KA01AB1234 says beep!
print(car2.honk())  # MH12CD5678 says beep!
print(car1 is car2)  # False — two distinct objects
```

---

## 3. The Constructor: `__init__`

Python calls `__init__` automatically right after an object is created, to set up its initial state. It is **not** technically the constructor (`__new__` is — it allocates the object) but for 99% of interview-level design, `__init__` is where you initialize state, and that's what people mean when they say "constructor" in Python.

```
Object creation sequence:
  Vehicle("KA01", "CAR")
        │
        ▼
  1. __new__  → allocates raw, empty object in memory
        │
        ▼
  2. __init__ → runs on the allocated object, sets attributes
        │
        ▼
  Fully-initialized Vehicle object returned to caller
```

### Bad Example — No Constructor, Attributes Set Ad-Hoc

```python
class Order:
    pass


order = Order()
order.item = "Laptop"
order.price = 75000
# Forgot to set order.quantity anywhere...

print(order.item, order.price)
print(order.quantity)  # AttributeError: 'Order' object has no attribute 'quantity'
```

Nothing guarantees an `Order` object is ever in a valid, complete state. Every caller can forget a field, and the bug only surfaces later, far from where the object was created.

### Good Example — Constructor Enforces a Valid Object

```python
class Order:
    def __init__(self, item: str, price: float, quantity: int = 1) -> None:
        if price < 0:
            raise ValueError("price cannot be negative")
        if quantity <= 0:
            raise ValueError("quantity must be positive")

        self.item = item
        self.price = price
        self.quantity = quantity

    def total(self) -> float:
        return self.price * self.quantity


order = Order("Laptop", 75000, quantity=2)
print(order.total())  # 150000

# Invalid orders are rejected at creation time, not discovered later:
Order("Mouse", -500)  # ValueError: price cannot be negative
```

The constructor is your single choke point for validation — every `Order` that exists is guaranteed valid.

---

## 4. Instance Variables vs Class Variables

- **Instance variables** live on `self` — every object has its own copy.
- **Class variables** are defined directly in the class body — they are shared by all instances of that class.

```
class BankAccount:
    bank_name = "Global Bank"     ← class variable (ONE copy, shared)

    def __init__(self, owner, balance):
        self.owner = owner        ← instance variable (per-object)
        self.balance = balance    ← instance variable (per-object)
```

```
                ┌─────────────────────────┐
                │ BankAccount (class)     │
                │  bank_name = "Global"   │  ← shared by everyone
                └─────────────────────────┘
                     ▲            ▲
        ┌────────────┘            └────────────┐
┌───────────────────┐               ┌───────────────────┐
│ acc1 (instance)    │               │ acc2 (instance)    │
│ owner="Asha"        │               │ owner="Ravi"        │
│ balance=1000         │               │ balance=500          │
└───────────────────┘               └───────────────────┘
```

### Bad Example — Using a Class Variable for Per-Object State

```python
class BankAccount:
    balance = 0  # Intended as a "default" — but it's a CLASS variable

    def __init__(self, owner: str) -> None:
        self.owner = owner

    def deposit(self, amount: float) -> None:
        self.balance += amount  # This looks fine... but watch closely


acc1 = BankAccount("Asha")
acc2 = BankAccount("Ravi")

acc1.deposit(1000)

print(acc1.balance)  # 1000  (looks correct)
print(acc2.balance)  # 0     (looks correct, but only by luck of += rebinding)
print(BankAccount.balance)  # 0 — the class-level default is untouched, for now
```

This *happens* to behave correctly because `self.balance += amount` creates a new **instance** attribute called `balance` the first time it runs (shadowing the class variable). But it is fragile: if any method reads `BankAccount.balance` directly, or if a future teammate stores a mutable default (a list, a dict) instead of a number, every instance ends up silently sharing and corrupting the same object. See Section 5 for exactly that failure mode.

### Good Example — Explicit Instance State, Class Variable Used Correctly

```python
class BankAccount:
    bank_name: str = "Global Bank"  # genuinely shared, read-only-ish metadata
    _next_account_id: int = 1000    # shared counter — used to generate unique IDs

    def __init__(self, owner: str, opening_balance: float = 0.0) -> None:
        self.owner = owner
        self.balance = opening_balance      # instance variable, always explicit
        self.account_id = BankAccount._next_account_id
        BankAccount._next_account_id += 1   # mutate the class variable deliberately

    def deposit(self, amount: float) -> None:
        self.balance += amount

    def __str__(self) -> str:
        return f"Account #{self.account_id} ({self.bank_name}) — {self.owner}: {self.balance}"


acc1 = BankAccount("Asha", opening_balance=1000)
acc2 = BankAccount("Ravi")

acc1.deposit(500)

print(acc1)  # Account #1000 (Global Bank) — Asha: 1500
print(acc2)  # Account #1001 (Global Bank) — Ravi: 0
```

Here, `bank_name` and `_next_account_id` are genuinely shared concepts (all accounts belong to the same bank; account IDs must be unique across all accounts), so class variables are the right tool. `balance` and `owner` are per-account, so they're always set explicitly in `__init__` on `self`.

**Rule of thumb:** if a value should differ between objects, it belongs on `self` inside `__init__`. If it's truly shared/global to the class (a counter, a constant, a registry), it belongs as a class variable.

---

## 5. The Mutable Default Trap

This is the single most common Python-specific OOP bug, and interviewers love probing for it.

### Bad Example

```python
class ShoppingCart:
    def __init__(self, owner: str, items: list = []) -> None:  # DANGER
        self.owner = owner
        self.items = items

    def add_item(self, item: str) -> None:
        self.items.append(item)


cart1 = ShoppingCart("Asha")
cart1.add_item("Laptop")

cart2 = ShoppingCart("Ravi")
print(cart2.items)  # ['Laptop']  <-- BUG! Ravi's cart already has Asha's item
```

Default argument values in Python are evaluated **once**, when the function is defined — not each time it's called. So every `ShoppingCart` that doesn't pass `items` explicitly shares the *exact same list object* as its default.

### Good Example

```python
from typing import Optional


class ShoppingCart:
    def __init__(self, owner: str, items: Optional[list[str]] = None) -> None:
        self.owner = owner
        self.items: list[str] = items if items is not None else []

    def add_item(self, item: str) -> None:
        self.items.append(item)


cart1 = ShoppingCart("Asha")
cart1.add_item("Laptop")

cart2 = ShoppingCart("Ravi")
print(cart2.items)  # [] — correctly empty and independent
```

**Rule:** never use a mutable object (`list`, `dict`, `set`, or a custom mutable class) as a default argument value. Default to `None` and create the mutable object fresh inside the function/`__init__` body.

---

## 6. Hands-On Exercises

**Exercise 1:** Write a `Book` class with `title`, `author`, and `price` set in `__init__`, with validation that `price >= 0`. Create three `Book` objects and print each with an f-string.

**Exercise 2:** Add a class variable `total_books_created` to `Book` that increments by 1 every time a new `Book` is constructed. Print `Book.total_books_created` after creating several books.

**Exercise 3:** Reproduce the mutable-default bug yourself with a `Playlist` class that takes `songs: list = []`, observe the shared-list behavior in a REPL, then fix it using the `Optional[list] = None` pattern.

**Exercise 4:** Write a `Employee` class where `company_name` is a class variable and `name`, `salary` are instance variables. Add a class method-free way (i.e., using `ClassName.attribute = value`) to change the company name for all employees at once, and prove existing employee objects see the update.

---

## 7. Interview Q&A

**Q: What is the difference between a class and an object in Python?**
Answer: A class is a blueprint that defines the structure (attributes) and behavior (methods) that its instances will have. An object is a concrete instance created from that class, with its own independent copy of instance data in memory. You can create any number of objects from one class, and modifying one object's instance attributes never affects another's.

**Q: Is `__init__` the constructor in Python?**
Answer: Not strictly. `__new__` is the actual constructor — it allocates and returns the new object. `__init__` is the initializer — it runs immediately after `__new__` on the already-allocated object and sets up its initial state. In everyday LLD design you almost never touch `__new__`; you use `__init__` to validate inputs and assign instance attributes, and colloquially call it "the constructor."

**Q: What's the difference between instance variables and class variables, and when would you use each?**
Answer: Instance variables are defined on `self` inside methods (typically `__init__`) and each object gets its own independent copy — use them for state that varies per object, like a bank account's `balance`. Class variables are defined in the class body and are shared across all instances — use them for truly shared data like configuration constants, or a counter used to generate unique IDs across every instance.

**Q: Why is using a mutable default argument like `def __init__(self, items=[])` dangerous?**
Answer: Default argument values are evaluated exactly once, at function-definition time, and that same object is reused on every call that doesn't override it. If the default is a mutable object like a list, every instance that doesn't pass its own `items` ends up sharing and mutating the *same* list, causing hard-to-trace bugs where unrelated objects appear to affect each other. The fix is to default to `None` and create a fresh mutable object inside the function body.

**Q: If I write `self.balance += amount` inside a method, but `balance` was only defined as a class variable, what happens?**
Answer: Python first looks up `self.balance` (found via the class, since no instance attribute exists yet), evaluates the addition, then assigns the result back to `self.balance`. That assignment always creates a new **instance** attribute on that specific object, shadowing the class variable from then on for that instance — it does not mutate the shared class variable. This is why numeric "counters" that use `self.x += 1` on a class-level default happen to work per-instance, but the same pattern on a mutable class-level default (like a list you `.append()` to) fails, because `.append()` mutates in place rather than rebinding `self.x`.

**Q: Can you validate constructor arguments in Python, and where should that validation live?**
Answer: Yes — inside `__init__`, before assigning to `self`, typically with `if` checks that `raise ValueError` or a custom exception on invalid input (e.g., negative price, empty string). Putting validation in the constructor guarantees that once an object exists, it is always in a valid state, which is far safer than validating scattered across the codebase every time the object's attributes are used.
