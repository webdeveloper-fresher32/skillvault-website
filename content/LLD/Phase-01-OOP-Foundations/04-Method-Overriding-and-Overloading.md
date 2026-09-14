# Method Overriding and Overloading — Complete Guide

## Table of Contents
1. [Two Concepts With Confusingly Similar Names](#1-two-concepts-with-confusingly-similar-names)
2. [Method Overriding](#2-method-overriding)
3. [Why Python Doesn't Have Real Method Overloading](#3-why-python-doesnt-have-real-method-overloading)
4. [Simulating Overloading: Default Arguments](#4-simulating-overloading-default-arguments)
5. [Simulating Overloading: `*args` / `**kwargs`](#5-simulating-overloading-args--kwargs)
6. [Simulating Overloading: `@singledispatch`](#6-simulating-overloading-singledispatch)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Two Concepts With Confusingly Similar Names

- **Overriding**: a subclass provides its own implementation of a method that its parent already defines. Happens at **runtime**, resolved by the actual object type. Fully supported in Python.
- **Overloading**: multiple methods with the **same name** but **different parameter signatures** in the *same* class. Resolved at **compile time** in languages like Java/C++. Python does **not** support this natively — a later `def` with the same name simply replaces the earlier one.

```
Overriding (runtime, different classes):
  Vehicle.honk()  →  "generic honk"
  Truck.honk()    →  "loud air horn"      (Truck OVERRIDES Vehicle's honk)

Overloading (compile-time, same class, Java-style — NOT native to Python):
  add(int, int)
  add(int, int, int)
  add(double, double)
```

---

## 2. Method Overriding

Overriding is native, first-class Python — a subclass simply redefines a method its parent already has.

### Bad Example — Overriding Without Preserving the Contract

```python
class Vehicle:
    def calculate_toll(self, distance_km: float) -> float:
        return distance_km * 2.0  # base rate: $2/km


class Truck(Vehicle):
    def calculate_toll(self, distance_km: float, num_axles: int) -> float:
        # Added a required parameter — breaks the base class's contract!
        return distance_km * 2.0 * num_axles


def print_toll(vehicle: Vehicle, distance: float) -> None:
    print(vehicle.calculate_toll(distance))  # works for Vehicle, Car, Bike...


print_toll(Truck(), 10)
# TypeError: Truck.calculate_toll() missing 1 required positional argument: 'num_axles'
```

`Truck.calculate_toll` changed the method's signature, so it can no longer be used polymorphically wherever a `Vehicle` is expected — this violates the **Liskov Substitution Principle** (a subclass should be usable anywhere its parent is expected).

### Good Example — Overriding That Preserves the Contract

```python
class Vehicle:
    def calculate_toll(self, distance_km: float) -> float:
        return distance_km * 2.0


class Car(Vehicle):
    pass  # uses Vehicle's toll calculation as-is


class Truck(Vehicle):
    AXLE_SURCHARGE_PER_KM = 1.5

    def __init__(self, num_axles: int) -> None:
        self.num_axles = num_axles

    def calculate_toll(self, distance_km: float) -> float:
        base = super().calculate_toll(distance_km)          # reuse parent logic
        surcharge = distance_km * self.AXLE_SURCHARGE_PER_KM * (self.num_axles - 2)
        return base + max(surcharge, 0)


def print_toll(vehicle: Vehicle, distance: float) -> None:
    print(f"${vehicle.calculate_toll(distance):.2f}")


print_toll(Car(), 10)             # $20.00
print_toll(Truck(num_axles=4), 10)  # $50.00
```

`Truck.calculate_toll` keeps the exact same signature `(self, distance_km)`, so any code written against `Vehicle` works unmodified with `Truck` — the override *extends* behavior instead of changing the contract.

---

## 3. Why Python Doesn't Have Real Method Overloading

```python
class Calculator:
    def add(self, a: int, b: int) -> int:
        return a + b

    def add(self, a: int, b: int, c: int) -> int:   # this REPLACES the one above
        return a + b + c


calc = Calculator()
calc.add(1, 2)        # TypeError: missing 1 required positional argument: 'c'
```

Python classes are just namespaces (dictionaries under the hood) — defining `add` twice simply overwrites the same dictionary key. There is no signature-based dispatch built into the language the way there is in Java or C++. Python instead offers several idiomatic alternatives.

---

## 4. Simulating Overloading: Default Arguments

The simplest tool — give parameters default values so one method handles multiple "shapes" of call.

```python
class InvoiceService:
    def create_invoice(
        self,
        customer: str,
        amount: float,
        tax_rate: float = 0.0,
        discount: float = 0.0,
    ) -> float:
        taxed = amount * (1 + tax_rate)
        return taxed - discount


svc = InvoiceService()
print(svc.create_invoice("Asha", 100))                     # 100.0
print(svc.create_invoice("Ravi", 100, tax_rate=0.18))       # 118.0
print(svc.create_invoice("Meera", 100, tax_rate=0.18, discount=10))  # 108.0
```

One method, callable in several "shapes" — this covers the majority of real overloading needs in LLD interviews (optional configuration parameters).

---

## 5. Simulating Overloading: `*args` / `**kwargs`

Use when the number or kind of arguments genuinely varies, not just optional tweaks.

```python
class Logger:
    def log(self, *args: object, level: str = "INFO") -> None:
        message = " ".join(str(a) for a in args)
        print(f"[{level}] {message}")


logger = Logger()
logger.log("Server started")                     # [INFO] Server started
logger.log("User", 42, "logged in")              # [INFO] User 42 logged in
logger.log("Disk full", level="ERROR")           # [ERROR] Disk full
```

This is flexible but loses type safety and self-documentation — use it sparingly, and prefer explicit named parameters (Section 4) whenever the set of valid call shapes is small and known.

---

## 6. Simulating Overloading: `@singledispatch`

`functools.singledispatch` gives you real overloading based on the **type** of the first argument — the closest Python gets to Java-style overload resolution, and a strong signal of Python fluency in interviews.

```python
from functools import singledispatch


@singledispatch
def calculate_shipping_cost(item: object) -> float:
    raise NotImplementedError(f"No shipping rule for type: {type(item).__name__}")


@calculate_shipping_cost.register
def _(item: str) -> float:          # item is a plain text document identifier
    return 5.0


@calculate_shipping_cost.register
def _(item: int) -> float:          # item is a weight in grams
    return 0.01 * item


@calculate_shipping_cost.register
def _(item: list) -> float:         # item is a list of package weights
    return sum(calculate_shipping_cost(w) for w in item)


print(calculate_shipping_cost("document-123"))   # 5.0
print(calculate_shipping_cost(500))              # 5.0
print(calculate_shipping_cost([100, 200, 300]))  # 6.0
```

For dispatching on a method inside a class, use `singledispatchmethod`:

```python
from functools import singledispatchmethod


class DiscountCalculator:
    @singledispatchmethod
    def apply_discount(self, coupon: object, amount: float) -> float:
        raise NotImplementedError

    @apply_discount.register
    def _(self, coupon: float, amount: float) -> float:   # flat percentage, e.g. 0.10
        return amount * (1 - coupon)

    @apply_discount.register
    def _(self, coupon: str, amount: float) -> float:      # coupon code
        codes = {"SAVE10": 0.10, "SAVE20": 0.20}
        return amount * (1 - codes.get(coupon, 0.0))


calc = DiscountCalculator()
print(calc.apply_discount(0.15, 1000))       # 850.0
print(calc.apply_discount("SAVE20", 1000))   # 800.0
```

---

## 7. Hands-On Exercises

**Exercise 1:** Model a `Shape` base class with `area()`, and `Circle`/`Rectangle` subclasses overriding it. Verify that calling `area()` on a list of mixed shapes dispatches correctly — this is overriding + polymorphism.

**Exercise 2:** Write a `report_generator` method using default arguments that can be called as `generate()`, `generate(format="pdf")`, and `generate(format="pdf", include_charts=True)`.

**Exercise 3:** Use `@singledispatch` to write a `describe(value)` function that returns a different description string depending on whether `value` is an `int`, `str`, `list`, or `dict`.

**Exercise 4:** Take the bad `Truck.calculate_toll` example from Section 2 and explain, in your own words, which SOLID principle it violates and how the fixed version restores it. Then write a `Bus` subclass that also overrides `calculate_toll` correctly.

---

## 8. Interview Q&A

**Q: What is the difference between method overriding and method overloading?**
Answer: Overriding is when a subclass redefines a method that its parent class already defines, keeping the same signature but changing behavior — resolved at runtime based on the object's actual type. Overloading is defining multiple methods with the same name but different parameter signatures within the same class — resolved at compile time in languages like Java. Python fully supports overriding; it does not support true overloading because it has no compile-time type-based dispatch on method signatures.

**Q: Why doesn't Python support method overloading the way Java does?**
Answer: Python classes store methods in a dictionary keyed by name. Defining a method with the same name twice simply overwrites the previous entry in that dictionary — there's no mechanism that inspects argument types or counts at definition time to keep multiple versions around. Python's dynamic typing also makes signature-based overload resolution far less natural than in statically-typed languages, since types aren't known until runtime.

**Q: What are the main ways to simulate overloading behavior in Python?**
Answer: The three common approaches are: (1) default argument values, letting one method handle several "shapes" of call with optional parameters; (2) `*args`/`**kwargs` for genuinely variable argument counts, at the cost of type safety and self-documentation; and (3) `functools.singledispatch` (or `singledispatchmethod` for class methods), which dispatches to different function implementations based on the runtime type of the first argument — the closest Python equivalent to real overloading.

**Q: What is the Liskov Substitution Principle and how does it relate to overriding?**
Answer: LSP states that objects of a subclass should be substitutable for objects of the superclass without breaking the correctness of the program. When you override a method, changing its signature (adding required parameters) or narrowing what inputs it accepts, or widening what exceptions it can raise, violates LSP — code written against the base class can no longer safely call the method on the subclass. Correct overriding preserves the parent's method signature and honors its behavioral contract while only changing the internal implementation.

**Q: When would you choose `@singledispatch` over a series of `isinstance` checks inside one function?**
Answer: `@singledispatch` keeps each type-specific implementation in its own small function, registered against the generic function, rather than accumulating a growing `if isinstance(...) elif isinstance(...)` chain in one place. This is more extensible — adding support for a new type means registering a new function without touching existing code (matching the Open/Closed Principle) — and it's more readable once you have more than two or three type branches.

**Q: If a subclass overrides `__init__` and adds new required parameters, what problem can that cause?**
Answer: It breaks polymorphic construction — any code that creates instances generically (e.g., a factory that does `cls(*args)` for a list of classes assumed to share a constructor signature) will fail for that subclass. It's usually better to give new parameters sensible defaults, or to accept configuration via a separate method/factory, so subclasses stay substitutable at construction time too, not just at the method-call level.
