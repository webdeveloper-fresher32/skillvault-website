# Inheritance and Polymorphism — Complete Guide

## Table of Contents
1. [Why Inheritance Shows Up Constantly in LLD](#1-why-inheritance-shows-up-constantly-in-lld)
2. [Basic Inheritance](#2-basic-inheritance)
3. [The Problem With Copy-Pasted Classes](#3-the-problem-with-copy-pasted-classes)
4. [Fixing It With Inheritance](#4-fixing-it-with-inheritance)
5. [`super()` and Method Resolution Order](#5-super-and-method-resolution-order)
6. [Polymorphism](#6-polymorphism)
7. [Multiple Inheritance and MRO](#7-multiple-inheritance-and-mro)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Inheritance Shows Up Constantly in LLD

Nearly every LLD problem has a family of related things that share behavior but differ in specifics: `Car`/`Bike`/`Truck` in a parking lot, `CreditCardPayment`/`UpiPayment`/`WalletPayment` in a checkout system, `Circle`/`Rectangle` in a shapes library. Inheritance lets you write the shared behavior once in a base class and let each subclass specialize only what's different.

```
                 Vehicle (base class)
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
      Car           Bike         Truck
  (specialized)  (specialized)  (specialized)
```

---

## 2. Basic Inheritance

```python
class Vehicle:
    def __init__(self, license_plate: str) -> None:
        self.license_plate = license_plate

    def describe(self) -> str:
        return f"Vehicle {self.license_plate}"


class Car(Vehicle):
    pass


car = Car("KA01AB1234")
print(car.describe())  # Vehicle KA01AB1234 — inherited, no rewrite needed
print(isinstance(car, Vehicle))  # True
```

`Car` automatically has every attribute and method of `Vehicle` without redefining anything.

---

## 3. The Problem With Copy-Pasted Classes

### Bad Example — Duplicated Logic Across "Similar" Classes

```python
class CreditCardPayment:
    def __init__(self, amount: float) -> None:
        self.amount = amount

    def validate(self) -> bool:
        return self.amount > 0

    def pay(self) -> str:
        if not self.validate():
            return "Invalid payment"
        return f"Charged ${self.amount} to credit card"


class UpiPayment:
    def __init__(self, amount: float) -> None:
        self.amount = amount

    def validate(self) -> bool:
        return self.amount > 0          # duplicated

    def pay(self) -> str:
        if not self.validate():         # duplicated
            return "Invalid payment"
        return f"Paid ${self.amount} via UPI"
```

`validate()` and the "invalid payment" check are copy-pasted. Any bug fix (e.g., also rejecting amounts above a fraud limit) has to be applied in every payment class separately — a maintenance trap, and exactly the kind of design smell an interviewer is listening for.

---

## 4. Fixing It With Inheritance

```python
from abc import ABC, abstractmethod


class Payment(ABC):
    def __init__(self, amount: float) -> None:
        self.amount = amount

    def validate(self) -> bool:
        return self.amount > 0

    def process(self) -> str:
        if not self.validate():
            return "Invalid payment"
        return self._charge()

    @abstractmethod
    def _charge(self) -> str:
        """Each payment method implements its own charging logic."""


class CreditCardPayment(Payment):
    def _charge(self) -> str:
        return f"Charged ${self.amount} to credit card"


class UpiPayment(Payment):
    def _charge(self) -> str:
        return f"Paid ${self.amount} via UPI"


class WalletPayment(Payment):
    def _charge(self) -> str:
        return f"Debited ${self.amount} from wallet"


payments: list[Payment] = [
    CreditCardPayment(500),
    UpiPayment(200),
    WalletPayment(-50),
]

for p in payments:
    print(p.process())
# Charged $500 to credit card
# Paid $200 via UPI
# Invalid payment
```

`validate()` and `process()` are written once, in `Payment`. Each subclass only implements `_charge()`, the one piece that genuinely differs. Fixing the validation logic now means editing exactly one place.

---

## 5. `super()` and Method Resolution Order

`super()` lets a subclass call its parent's version of a method — usually to extend, not replace, the parent behavior.

```python
class Vehicle:
    def __init__(self, license_plate: str) -> None:
        self.license_plate = license_plate
        print(f"Vehicle created: {license_plate}")


class Car(Vehicle):
    def __init__(self, license_plate: str, num_doors: int) -> None:
        super().__init__(license_plate)   # let Vehicle set up its part first
        self.num_doors = num_doors
        print(f"Car created with {num_doors} doors")


car = Car("KA01AB1234", 4)
# Vehicle created: KA01AB1234
# Car created with 4 doors
```

Without `super().__init__(...)`, `Car` would have to reimplement `Vehicle`'s setup logic itself, reintroducing duplication.

---

## 6. Polymorphism

Polymorphism means objects of different classes can be used interchangeably through a common interface — calling `.process()` on any `Payment` subclass works, and the caller doesn't need to know (or care) which concrete subclass it has.

```
Caller code:
    for p in payments:
        p.process()     ← same call site, different behavior per object

  CreditCardPayment.process()  → "Charged ... to credit card"
  UpiPayment.process()         → "Paid ... via UPI"
  WalletPayment.process()      → "Debited ... from wallet"
```

This is what lets you add a new payment type (say, `CryptoPayment`) later without touching any code that already loops over `list[Payment]` and calls `.process()` — that's the Open/Closed Principle in action, and it's the payoff inheritance + polymorphism is really being tested for in interviews.

```python
class CryptoPayment(Payment):
    def _charge(self) -> str:
        return f"Transferred ${self.amount} in crypto"


payments.append(CryptoPayment(1000))
for p in payments:
    print(p.process())  # existing loop code needed ZERO changes
```

---

## 7. Multiple Inheritance and MRO

Python supports multiple inheritance — a class can inherit from more than one parent. Python resolves method lookup order using **C3 linearization**, exposed as `ClassName.__mro__` (Method Resolution Order).

```python
class Swimmer:
    def move(self) -> str:
        return "swimming"


class Runner:
    def move(self) -> str:
        return "running"


class Triathlete(Swimmer, Runner):
    pass


t = Triathlete()
print(t.move())            # "swimming" — Swimmer is listed first
print(Triathlete.__mro__)
# (<class 'Triathlete'>, <class 'Swimmer'>, <class 'Runner'>, <class 'object'>)
```

Python searches left-to-right through the classes listed in the `class Triathlete(Swimmer, Runner):` declaration. This is powerful but easy to make confusing — in LLD interviews, prefer **composition** (Lesson 05) over multiple inheritance whenever a "has multiple capabilities" relationship arises; reserve multiple inheritance mainly for small, focused mixins.

---

## 8. Hands-On Exercises

**Exercise 1:** Model `Shape` as a base class with an `area()` method that raises `NotImplementedError`. Create `Circle` and `Rectangle` subclasses implementing `area()`. Loop over a `list[Shape]` and print each area — this is polymorphism in action.

**Exercise 2:** Build a `Notification` base class with a `send(message: str)` method, and `EmailNotification`, `SmsNotification` subclasses. Add a shared `log(message)` method on the base class used by all subclasses via `super()` or direct inheritance.

**Exercise 3:** Create two mixin classes `JsonSerializableMixin` (adds `to_json()`) and `LoggableMixin` (adds `log()`), then a class `Order(JsonSerializableMixin, LoggableMixin)` that uses both. Print `Order.__mro__` and explain the order.

**Exercise 4:** Take the `Payment` hierarchy from Section 4 and add a `RefundablePayment` abstract subclass with an additional `refund()` abstract method. Implement it for `CreditCardPayment` only, and explain why `UpiPayment` should NOT inherit from it.

---

## 9. Interview Q&A

**Q: What is inheritance and why would you use it in a design?**
Answer: Inheritance lets a class (subclass) reuse the attributes and methods of another class (superclass), while adding or overriding behavior specific to itself. You use it when multiple classes share common structure or behavior — putting that shared logic in a base class avoids duplication and gives you a single place to fix bugs or extend behavior for the whole family.

**Q: What is polymorphism, and why does it matter in LLD interviews?**
Answer: Polymorphism means different classes can be used interchangeably through a shared interface — calling the same method name on objects of different types produces type-appropriate behavior. In LLD interviews it matters because it's what lets you add new types (a new vehicle type, a new payment method) without modifying existing code that already operates on the base type — this is a direct demonstration of the Open/Closed Principle, which interviewers explicitly look for.

**Q: What does `super()` do, and why not just call `Vehicle.__init__(self, ...)` directly?**
Answer: `super()` returns a proxy object that delegates method calls to the next class in the Method Resolution Order, based on the actual runtime type of `self` — not the literal class you're standing in. Calling `Vehicle.__init__(self, ...)` directly hardcodes the parent class name, which breaks down under multiple inheritance and makes refactoring the class hierarchy harder. `super()` is the idiomatic, MRO-aware way to invoke the next class's implementation.

**Q: What is Method Resolution Order (MRO) and how does Python compute it?**
Answer: MRO is the order Python searches through a class's ancestors when looking up an attribute or method, relevant whenever there's inheritance (especially multiple inheritance). Python computes it using the C3 linearization algorithm, which guarantees a consistent order where a subclass always appears before its parents, and parents appear in the order they were listed in the class definition. You can inspect it directly via `ClassName.__mro__` or `ClassName.mro()`.

**Q: Why is multiple inheritance considered risky, and what's usually preferred instead?**
Answer: Multiple inheritance can create ambiguous or hard-to-follow method resolution when several parent classes define the same method (the "diamond problem"), and it tightly couples a class to multiple hierarchies at once, making the design brittle to change. Composition (an object *holding* other objects that provide capabilities) is usually preferred because it keeps relationships explicit and flexible — you can swap out a composed component without restructuring the class hierarchy. Multiple inheritance is still reasonable for small, orthogonal mixins (e.g., a `LoggableMixin` that only adds a `log()` method).

**Q: If a subclass doesn't override a method, which version runs when you call it on a subclass instance?**
Answer: The subclass instance uses the parent class's implementation, found via MRO lookup — Python walks the MRO starting from the instance's actual class and uses the first matching method definition it finds. This is exactly what makes inheritance useful for code reuse: you don't need to redefine a method in the subclass unless its behavior actually needs to differ.
