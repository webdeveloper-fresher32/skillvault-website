# Composition vs Inheritance — Complete Guide

## Table of Contents
1. [The Most-Repeated Advice in LLD Interviews](#1-the-most-repeated-advice-in-lld-interviews)
2. [is-a vs has-a](#2-is-a-vs-has-a)
3. [Bad Example: Forcing Inheritance Where It Doesn't Belong](#3-bad-example-forcing-inheritance-where-it-doesnt-belong)
4. [Good Example: Fixing It With Composition](#4-good-example-fixing-it-with-composition)
5. [Why Composition Is Usually Preferred](#5-why-composition-is-usually-preferred)
6. [When Inheritance Is Still the Right Call](#6-when-inheritance-is-still-the-right-call)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Most-Repeated Advice in LLD Interviews

"Favor composition over inheritance" is repeated so often it risks becoming a cliché — but interviewers ask about it because inheritance misuse is the single most common design mistake candidates make when rushed. This lesson makes the distinction concrete with a worked example, not just the slogan.

```
Inheritance (is-a):                Composition (has-a):

   Vehicle                            Car
      ▲                                │
      │ is-a                           │ has-a
    Car                              Engine
```

---

## 2. is-a vs has-a

Ask: "Is a `Car` fundamentally a kind of `X`, sharing X's entire identity and interface?" or "Does a `Car` merely *use* or *contain* an `X` as one of its parts?"

| Relationship | Question | Example |
|---|---|---|
| **is-a** (inheritance) | "Is a Car a Vehicle?" → Yes, a Car IS a specific kind of Vehicle. | `Car(Vehicle)` |
| **has-a** (composition) | "Does a Car have an Engine?" → Yes, but a Car IS NOT an Engine. | `Car` holds an `Engine` instance |

A classic interview trap: modeling `Car` as inheriting from `Engine` because "cars need engines." That's backwards — a car *has* an engine, it *is not* an engine.

---

## 3. Bad Example: Forcing Inheritance Where It Doesn't Belong

```python
class PetrolEngine:
    def start(self) -> str:
        return "Petrol engine roaring to life"

    def fuel_type(self) -> str:
        return "Petrol"


class Car(PetrolEngine):  # WRONG: Car "is-a" PetrolEngine? No — it HAS one.
    def __init__(self, model: str) -> None:
        self.model = model

    def drive(self) -> str:
        return f"{self.model} driving, using {self.start()}"


class ElectricCar(PetrolEngine):  # Even more wrong — an electric car has NO petrol engine!
    def __init__(self, model: str) -> None:
        self.model = model
```

This forces every `Car` subtype to inherit petrol-engine behavior, even `ElectricCar`, which has no petrol engine at all. To "fix" it, you'd need an awkward parallel hierarchy (`ElectricEngine`, `HybridEngine`...) and cars would need multiple inheritance to combine, say, a chassis type with an engine type — exactly the fragile web multiple inheritance creates (Lesson 02, Section 7). Worse: if a car needs to *swap* its engine at runtime (e.g., in a simulation), inheritance can't do that at all — your class is permanently welded to one engine type from construction.

---

## 4. Good Example: Fixing It With Composition

```python
from abc import ABC, abstractmethod


class Engine(ABC):
    @abstractmethod
    def start(self) -> str:
        ...

    @abstractmethod
    def fuel_type(self) -> str:
        ...


class PetrolEngine(Engine):
    def start(self) -> str:
        return "Petrol engine roaring to life"

    def fuel_type(self) -> str:
        return "Petrol"


class ElectricMotor(Engine):
    def start(self) -> str:
        return "Electric motor humming silently"

    def fuel_type(self) -> str:
        return "Electricity"


class Car:
    def __init__(self, model: str, engine: Engine) -> None:
        self.model = model
        self.engine = engine  # HAS-A relationship: Car holds an Engine

    def drive(self) -> str:
        return f"{self.model} driving — {self.engine.start()} (fuel: {self.engine.fuel_type()})"

    def swap_engine(self, new_engine: Engine) -> None:
        self.engine = new_engine  # trivial at runtime — impossible with inheritance


petrol_car = Car("Sedan X", PetrolEngine())
electric_car = Car("EV Compact", ElectricMotor())

print(petrol_car.drive())    # Sedan X driving — Petrol engine roaring to life (fuel: Petrol)
print(electric_car.drive())  # EV Compact driving — Electric motor humming silently (fuel: Electricity)

petrol_car.swap_engine(ElectricMotor())
print(petrol_car.drive())    # Sedan X driving — Electric motor humming silently (fuel: Electricity)
```

`Car` no longer cares which concrete `Engine` it holds — it works with any object satisfying the `Engine` abstraction (tying directly back to Lesson 03's abstraction principle). Adding a `HybridEngine` later requires zero changes to `Car`.

---

## 5. Why Composition Is Usually Preferred

```
Inheritance couples subclass to superclass IMPLEMENTATION:
  - Fixed at class-definition time (can't change parent at runtime)
  - Deep hierarchies become fragile ("fragile base class problem")
  - Multiple inheritance for combining behaviors gets messy fast

Composition couples object to an INTERFACE:
  - Swappable at runtime (car.swap_engine(...))
  - Flat structure: Car has-a Engine, has-a Wheels, has-a GPS — no deep tree
  - Combine any number of capabilities without multiple-inheritance MRO puzzles
```

| Aspect | Inheritance | Composition |
|---|---|---|
| Relationship | is-a | has-a |
| Coupling | Tight (subclass depends on superclass internals) | Loose (depends only on an interface) |
| Flexibility | Fixed at class definition | Swappable at runtime |
| Combining behaviors | Multiple inheritance (messy MRO) | Just hold multiple objects |
| Typical LLD use | Truly hierarchical, stable "kind of" relationships (e.g., `Payment` types, `Shape` types) | Most "system built from parts" designs (e.g., `Car` has `Engine`, `GPS`, `Wheels`; `Order` has `PaymentMethod`, `ShippingStrategy`) |

The reason "favor composition" is repeated so much in LLD prep specifically is that most system-design problems (parking lot, elevator, ride-sharing, food delivery) are naturally **has-a** systems built from interchangeable parts — not deep taxonomies. Reaching for inheritance by default in those problems tends to produce rigid designs that fall apart the moment the interviewer adds a follow-up requirement ("now support electric vehicles too").

---

## 6. When Inheritance Is Still the Right Call

Composition doesn't replace inheritance everywhere — inheritance is correct when the relationship is a genuine, stable **is-a**, and you want shared behavior plus substitutability:

```python
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        ...


class Circle(Shape):
    def __init__(self, radius: float) -> None:
        self.radius = radius

    def area(self) -> float:
        return 3.14159 * self.radius ** 2


class Rectangle(Shape):
    def __init__(self, width: float, height: float) -> None:
        self.width = width
        self.height = height

    def area(self) -> float:
        return self.width * self.height
```

A `Circle` truly **is a** `Shape` — that relationship never needs to change at runtime, there's a genuinely shared abstract contract (`area()`), and every `Shape` subtype is meant to be substitutable wherever `Shape` is expected. This is the correct, narrow use case for inheritance: stable taxonomies of interchangeable types behind a shared abstraction — exactly what Lessons 02 and 03 covered.

**Practical rule for interviews:** default to composition when modeling "a system built from parts" (most LLD problems). Reach for inheritance only for a shallow (1-2 level), genuinely stable is-a taxonomy behind a shared abstract interface.

---

## 7. Hands-On Exercises

**Exercise 1:** Model a `Computer` class that has-a `CPU`, has-a `Storage` (abstracted so it could be `SSD` or `HDD`), and has-a `Memory`. Write a `boot()` method on `Computer` that delegates to each component.

**Exercise 2:** Take the bad "Car inherits PetrolEngine" example from Section 3 and identify at least two concrete problems it would cause if the interviewer then asked for a `HybridCar` that can switch between petrol and electric mid-drive.

**Exercise 3:** Design a `Robot` that has-a `MovementStrategy` (e.g., `WalkingStrategy`, `FlyingStrategy`, `RollingStrategy`) as a composed object, and demonstrate swapping strategies at runtime with `robot.set_movement_strategy(...)`.

**Exercise 4:** For a "Ride Sharing" LLD problem, decide which relationships should be inheritance and which should be composition: `Driver`/`Rider` extending a `User` base, a `Ride` having a `Vehicle`, a `Ride` having a `PricingStrategy`, an `ElectricCar` extending `Vehicle`. Justify each choice in 1-2 sentences.

---

## 8. Interview Q&A

**Q: What's the difference between an is-a and a has-a relationship, with an example?**
Answer: is-a means one type is fundamentally a specialized kind of another and should be modeled with inheritance — a `Car` is-a `Vehicle`. has-a means an object contains or uses another object as a component, modeled with composition — a `Car` has-a `Engine`, but a car is not itself a kind of engine. Confusing the two (e.g., making `Car` inherit from `Engine`) produces designs that don't reflect the real domain and become rigid under change.

**Q: Why is composition generally preferred over inheritance in LLD interviews?**
Answer: Most LLD problems (parking lots, ride-sharing, food delivery) model systems built from interchangeable parts rather than deep, stable taxonomies. Composition keeps coupling loose — an object depends only on an interface, not another class's internals — and allows swapping components at runtime (e.g., changing a car's engine, or a ride's pricing strategy) without restructuring the class hierarchy. Inheritance hardcodes the relationship at class-definition time and becomes fragile as hierarchies deepen or need to combine multiple behaviors.

**Q: Can you give an example of when inheritance is still the correct choice over composition?**
Answer: Inheritance is correct for genuinely stable is-a taxonomies behind a shared abstract interface, where every subtype must be substitutable for the base type — for example, `Circle` and `Rectangle` both is-a `Shape`, sharing the `area()` contract, and this relationship never needs to change at runtime. The key signals are: the relationship is truly hierarchical (not just "uses"), it's stable over the object's lifetime, and you want polymorphic substitutability, not runtime swapping.

**Q: What is the "fragile base class problem" and how does composition avoid it?**
Answer: The fragile base class problem occurs when a change to a superclass (even something that looks safe, like adding a new method or changing an internal detail) unexpectedly breaks subclasses that depend on it, because subclasses are tightly coupled to the superclass's implementation, not just its interface. Composition avoids this because a composing object only depends on the composed object's public interface — as long as that interface's contract holds, the composed object's internals can change freely without breaking anything that holds a reference to it.

**Q: How would you decide, in an interview, whether two classes should be related by inheritance or composition?**
Answer: Ask two questions: first, "is X fundamentally a specialized kind of Y, and will every X always need to behave substitutably as a Y?" — if yes, that leans inheritance. Second, "does X merely use, contain, or delegate to Y, or might X need to change which Y it works with over its lifetime?" — if yes, that leans composition. When in doubt, or when the relationship is about assembling a system from interchangeable parts (which is most LLD problems), default to composition — it's easier to extend and less likely to require a redesign when the interviewer adds a follow-up requirement.

**Q: Does using composition mean you never use abstract base classes?**
Answer: No — composition and abstraction work together. In the `Car`/`Engine` example, `Car` composes an `Engine`, but `Engine` itself is still defined as an abstract base class (or protocol) so that `PetrolEngine`, `ElectricMotor`, and any future engine type are all interchangeable from `Car`'s point of view. The abstraction defines the *interface* the composed object must satisfy; composition is *how* the containing object holds and uses it.
