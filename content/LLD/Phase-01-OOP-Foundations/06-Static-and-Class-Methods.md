# Static and Class Methods — Complete Guide

## Table of Contents
1. [Three Kinds of Methods](#1-three-kinds-of-methods)
2. [Instance Methods (the default)](#2-instance-methods-the-default)
3. [`@staticmethod`](#3-staticmethod)
4. [`@classmethod`](#4-classmethod)
5. [The Factory Method Pattern With `@classmethod`](#5-the-factory-method-pattern-with-classmethod)
6. [Choosing the Right One](#6-choosing-the-right-one)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Three Kinds of Methods

```
┌───────────────────────────────────────────────────────────────────┐
│ class Order:                                                      │
│                                                                    │
│     def place(self, ...):          ← instance method (has self)   │
│         uses/modifies THIS object's state                         │
│                                                                    │
│     @staticmethod                                                 │
│     def is_valid_zip(zip_code):    ← no self, no cls              │
│         pure utility, doesn't touch class or instance state       │
│                                                                    │
│     @classmethod                                                  │
│     def from_json(cls, data):      ← has cls, not self            │
│         builds/operates on the CLASS itself, often used as        │
│         an alternate constructor                                  │
└───────────────────────────────────────────────────────────────────┘
```

| | Receives | Can access instance state | Can access/modify class state | Typical use |
|---|---|---|---|---|
| Instance method | `self` | Yes | Yes (via `self.__class__` or `type(self)`) | Normal behavior tied to one object |
| `@staticmethod` | nothing automatic | No | No | Pure helper/utility logically grouped with the class |
| `@classmethod` | `cls` | No | Yes | Alternate constructors, class-wide operations |

---

## 2. Instance Methods (the default)

```python
class Order:
    def __init__(self, item: str, price: float) -> None:
        self.item = item
        self.price = price

    def apply_discount(self, percent: float) -> None:   # instance method
        self.price -= self.price * (percent / 100)
```

`self` gives access to *this specific object's* data — the normal case, used whenever behavior depends on or modifies one instance.

---

## 3. `@staticmethod`

A static method behaves like a plain function that happens to live inside the class's namespace for organizational purposes — it receives no automatic first argument (`self` or `cls`) and cannot see instance or class state unless explicitly passed.

### Bad Example — A Free-Floating Function, Disconnected From Its Domain

```python
def is_valid_email(email: str) -> bool:
    return "@" in email and "." in email.split("@")[-1]


class User:
    def __init__(self, name: str, email: str) -> None:
        if not is_valid_email(email):   # helper lives far away, easy to lose track of
            raise ValueError("Invalid email")
        self.name = name
        self.email = email
```

`is_valid_email` is conceptually part of "how a User is validated," but it floats in module scope, disconnected from `User`. Anyone reading `User` in isolation, or importing it elsewhere, won't immediately see it's related.

### Good Example — `@staticmethod` Groups the Helper With Its Domain

```python
class User:
    def __init__(self, name: str, email: str) -> None:
        if not User.is_valid_email(email):
            raise ValueError("Invalid email")
        self.name = name
        self.email = email

    @staticmethod
    def is_valid_email(email: str) -> bool:
        return "@" in email and "." in email.split("@")[-1]


print(User.is_valid_email("asha@example.com"))  # True — callable without an instance
user = User("Asha", "asha@example.com")
print(user.is_valid_email("bad-email"))          # False — also callable on an instance
```

`is_valid_email` doesn't need `self` (it doesn't touch any instance data) and doesn't need `cls` (it doesn't touch class data either) — it's pure logic that's simply *related to* `User`. `@staticmethod` documents that relationship and lets it be called via `User.is_valid_email(...)` without creating an instance first.

---

## 4. `@classmethod`

A class method receives the class itself (`cls`) as its first argument instead of an instance. It's used when a method needs to operate on the class (e.g., to construct a new instance in a customized way) rather than on one specific object.

```python
class BankAccount:
    interest_rate: float = 0.03  # shared across all accounts

    def __init__(self, owner: str, balance: float) -> None:
        self.owner = owner
        self.balance = balance

    @classmethod
    def set_interest_rate(cls, rate: float) -> None:
        cls.interest_rate = rate    # modifies the CLASS variable, affecting all instances


acc1 = BankAccount("Asha", 1000)
acc2 = BankAccount("Ravi", 2000)

BankAccount.set_interest_rate(0.05)
print(acc1.interest_rate)  # 0.05
print(acc2.interest_rate)  # 0.05 — both see the class-wide change
```

Note `cls` is passed automatically, just like `self` — and using `cls.interest_rate = rate` (rather than hardcoding `BankAccount.interest_rate = rate`) means the method still works correctly even if called through a subclass.

---

## 5. The Factory Method Pattern With `@classmethod`

This is the single most common `@classmethod` use case in LLD interviews: providing alternate, named ways to construct an object, especially when the "natural" constructor signature isn't the only useful entry point.

### Bad Example — Overloading `__init__` With Awkward Flags

```python
class Vehicle:
    def __init__(
        self,
        license_plate: str,
        vehicle_type: str,
        from_json_data: dict | None = None,   # awkward: constructor doing two jobs
    ) -> None:
        if from_json_data is not None:
            self.license_plate = from_json_data["plate"]
            self.vehicle_type = from_json_data["type"]
        else:
            self.license_plate = license_plate
            self.vehicle_type = vehicle_type
```

`__init__` now has two unrelated responsibilities (plain construction vs. parsing JSON), tangled together with a sentinel flag argument. It only gets worse as more construction sources (CSV, database row, API response) are added.

### Good Example — `@classmethod` as Named Alternate Constructors

```python
from __future__ import annotations


class Vehicle:
    def __init__(self, license_plate: str, vehicle_type: str) -> None:
        self.license_plate = license_plate
        self.vehicle_type = vehicle_type

    @classmethod
    def from_json(cls, data: dict) -> "Vehicle":
        return cls(license_plate=data["plate"], vehicle_type=data["type"])

    @classmethod
    def from_csv_row(cls, row: str) -> "Vehicle":
        plate, vtype = row.split(",")
        return cls(license_plate=plate.strip(), vehicle_type=vtype.strip())

    def __repr__(self) -> str:
        return f"Vehicle({self.license_plate!r}, {self.vehicle_type!r})"


v1 = Vehicle("KA01AB1234", "CAR")                          # normal construction
v2 = Vehicle.from_json({"plate": "MH12CD5678", "type": "BIKE"})
v3 = Vehicle.from_csv_row("DL05EF9999, TRUCK")

print(v1, v2, v3)
# Vehicle('KA01AB1234', 'CAR') Vehicle('MH12CD5678', 'BIKE') Vehicle('DL05EF9999', 'TRUCK')
```

Each construction path has its own clearly-named method, `__init__` stays simple, and — crucially — using `cls(...)` instead of `Vehicle(...)` inside the classmethod means subclasses inherit working factories for free:

```python
class ElectricVehicle(Vehicle):
    pass


ev = ElectricVehicle.from_json({"plate": "EV-001", "type": "CAR"})
print(type(ev))  # <class '__main__.ElectricVehicle'> — cls correctly resolved to the subclass
```

If `from_json` had used `Vehicle(...)` instead of `cls(...)`, calling `ElectricVehicle.from_json(...)` would incorrectly return a plain `Vehicle`, not an `ElectricVehicle` — always prefer `cls` over hardcoding the class name inside a classmethod.

---

## 6. Choosing the Right One

```
Does the method need to read/modify THIS object's instance data (self.x)?
    │
    ├── Yes ──▶ instance method
    │
    └── No, but it constructs new instances, or needs the CLASS itself?
            │
            ├── Yes ──▶ @classmethod  (use cls, not the hardcoded class name)
            │
            └── No, it's just a related utility function with no self/cls needs?
                    │
                    └── Yes ──▶ @staticmethod
```

---

## 7. Hands-On Exercises

**Exercise 1:** Add `@staticmethod` validators `is_valid_phone(number: str)` and `is_valid_age(age: int)` to a `Customer` class, and use them inside `__init__`.

**Exercise 2:** Give a `Pizza` class a normal `__init__(self, size, toppings)`, then add `@classmethod` factories `margherita(cls, size)` and `pepperoni(cls, size)` that call `cls(size, [...])` with preset topping lists.

**Exercise 3:** Add a class-level counter `total_accounts_opened` to a `BankAccount` class, and a `@classmethod` `reset_counter(cls)` used only in tests. Confirm `cls` correctly targets subclasses if you create a `SavingsAccount(BankAccount)` subclass.

**Exercise 4:** Write a `Rectangle` class with a `@classmethod` factory `square(cls, side)` that constructs a rectangle with equal width and height, and a `@staticmethod` `is_valid_dimension(value)` used to validate `side` before construction.

---

## 8. Interview Q&A

**Q: What is the difference between `@staticmethod` and `@classmethod`?**
Answer: A `@staticmethod` receives no automatic first argument and cannot access instance (`self`) or class (`cls`) state — it's essentially a regular function namespaced inside the class because it's logically related to it. A `@classmethod` receives the class itself as its first argument (`cls`), letting it access or modify class-level state and, most commonly, construct new instances of the class (or subclass) in customized ways.

**Q: Why would you use `cls(...)` instead of the class's literal name inside a `@classmethod` factory?**
Answer: Using `cls(...)` makes the factory method inheritance-aware — when called on a subclass (e.g., `ElectricVehicle.from_json(...)`), `cls` is bound to `ElectricVehicle`, so the factory correctly returns an `ElectricVehicle` instance. If you hardcode the base class name instead (`Vehicle(...)`), calling the factory via a subclass would incorrectly still construct a plain `Vehicle`, breaking polymorphic construction.

**Q: What is the factory method pattern, and why is `@classmethod` a natural fit for it in Python?**
Answer: The factory method pattern provides alternate, descriptively-named ways to construct an object (e.g., `Vehicle.from_json(...)`, `Vehicle.from_csv_row(...)`) instead of overloading a single constructor with conditional logic and sentinel flags. `@classmethod` is a natural fit because it receives the class itself, so it can call `cls(...)` to build and return a properly-typed instance, and it reads clearly at the call site as `ClassName.factory_name(...)` rather than an awkward constructor call.

**Q: Can you call a `@staticmethod` or `@classmethod` on an instance instead of the class?**
Answer: Yes, both are callable through an instance as well as the class — `user.is_valid_email(...)` works the same as `User.is_valid_email(...)`, and similarly for classmethods. Python resolves the method the same way regardless of whether it's accessed via the class or an instance; the decorator determines what gets passed automatically (`cls`, nothing, or `self`), not how it's accessed.

**Q: If a class variable is modified inside a `@classmethod` using `cls.attribute = value`, does that affect all existing instances?**
Answer: Yes, as long as no instance has already shadowed that attribute with its own instance-level attribute of the same name (see Lesson 01, Section 4, on the mutable/shadowing behavior of `self.x += ...`). Since class variables are looked up via the class when no instance attribute exists, modifying the class variable through `cls` is visible to every instance that hasn't overridden it individually.

**Q: Would you ever choose an instance method over a `@staticmethod` even if the method doesn't use `self`?**
Answer: Generally no — if a method genuinely doesn't need `self` or `cls`, marking it `@staticmethod` is more honest about its dependencies and slightly cheaper (no implicit argument binding), and it signals to readers that the method has no dependency on instance state. Leaving it as a regular instance method that ignores `self` is technically legal but misleading, since it implies the method might use or need the object's state when it never does.
