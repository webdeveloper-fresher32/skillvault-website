# Class Diagrams Basics — Association, Aggregation, Composition, Inheritance, Multiplicity

## Table of Contents
1. [Why UML Relationships Matter for LLD Interviews](#1-why-uml-relationships-matter-for-lld-interviews)
2. [The UML Class Box](#2-the-uml-class-box)
3. [Association](#3-association)
4. [Aggregation](#4-aggregation)
5. [Composition](#5-composition)
6. [Inheritance](#6-inheritance)
7. [Multiplicity](#7-multiplicity)
8. [Comparison Table — Which Relationship to Use When](#8-comparison-table--which-relationship-to-use-when)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Why UML Relationships Matter for LLD Interviews

Every LLD interview eventually needs you to answer: "does `Car` **own** its `Engine`, or does it just **use** one?" That distinction changes your code — who constructs the object, who destroys it, whether it can be shared. UML gives you five precise relationship types to answer that question, and once you know them, reading or drawing a class diagram takes seconds.

```
The core question every relationship answers:

  "If object A is destroyed, what happens to object B?"

  Composition  → B is destroyed too (A owns B exclusively)
  Aggregation  → B survives (A just references B)
  Association  → B was never "owned" — A just knows about B temporarily
  Inheritance  → B (subclass) IS-A A (superclass); not about ownership at all
```

---

## 2. The UML Class Box

Every class in a diagram is drawn as a three-part box:

```
┌───────────────────────────┐
│         ClassName         │  ← class name
├───────────────────────────┤
│ - attribute1: type        │  ← attributes (- private, + public, # protected)
│ - attribute2: type        │
├───────────────────────────┤
│ + method1(args): retType  │  ← methods
│ + method2(args): retType  │
└───────────────────────────┘
```

Example:

```
┌───────────────────────────┐
│           Book             │
├───────────────────────────┤
│ - isbn: str                │
│ - title: str                │
│ - is_available: bool       │
├───────────────────────────┤
│ + checkout(): None         │
│ + return_book(): None       │
└───────────────────────────┘
```

```python
class Book:
    def __init__(self, isbn: str, title: str):
        self._isbn = isbn
        self._title = title
        self._is_available = True

    def checkout(self) -> None:
        self._is_available = False

    def return_book(self) -> None:
        self._is_available = True
```

---

## 3. Association

**Definition:** A general relationship where one class *uses* or *knows about* another, with no ownership implied. Both objects have independent lifecycles and typically already exist before the relationship happens (often expressed as a method parameter or return value, not a stored field).

```
┌───────────────┐                    ┌───────────────┐
│    Teacher     │ ─────────────────▶ │    Student     │
└───────────────┘        teaches      └───────────────┘

  Plain arrow, no diamond = "uses / knows about",
  no ownership, no lifecycle dependency.
```

A `Teacher` doesn't own the `Student` objects it teaches — students exist independently, before and after any particular class. The relationship is expressed through behavior, not through a stored reference the teacher is responsible for.

```python
class Student:
    def __init__(self, name: str):
        self.name = name


class Teacher:
    def __init__(self, name: str):
        self.name = name

    # Association: Teacher operates ON a Student passed in from outside.
    # Teacher does not create it, does not store it long-term, does not own it.
    def teach(self, student: "Student") -> None:
        print(f"{self.name} is teaching {student.name}")


teacher = Teacher("Ms. Rao")
student = Student("Amit")
teacher.teach(student)   # Teacher and Student are otherwise unrelated objects
```

**Key signal in code:** the related object shows up as a **method parameter or return type**, not as a `self.xxx` attribute set in `__init__`.

---

## 4. Aggregation

**Definition:** A "has-a" relationship where one class holds a reference to another, but the referenced object is **created externally** and can outlive the container. This is a "whole-part" relationship with weak ownership.

```
┌───────────────┐                    ┌───────────────┐
│  Department     │ ◇──────────────── │    Professor    │
└───────────────┘      has            └───────────────┘

  Hollow diamond (◇) on the "whole" side = aggregation.
  A Professor can exist without a Department, and can move
  between departments — Department does not own its lifecycle.
```

```python
class Professor:
    def __init__(self, name: str):
        self.name = name


class Department:
    def __init__(self, name: str):
        self.name = name
        self.professors: list[Professor] = []

    # Aggregation: Professor objects are created OUTSIDE and passed in.
    # Department only stores a reference — it doesn't create or destroy them.
    def add_professor(self, professor: Professor) -> None:
        self.professors.append(professor)


# Professor is created independently of any Department
prof = Professor("Dr. Sen")

cs_dept = Department("Computer Science")
cs_dept.add_professor(prof)

# The professor can be removed from the department and still exist,
# or even be added to a second department — its lifecycle is independent.
math_dept = Department("Mathematics")
math_dept.add_professor(prof)
```

**Key signal in code:** the object is **passed into** a method (constructor or setter) from the outside and simply **stored by reference**; it was not `new`'d up (instantiated) inside the container class.

---

## 5. Composition

**Definition:** The strongest "has-a" relationship — one class is fully responsible for creating **and** destroying another. The part cannot meaningfully exist without the whole.

```
┌───────────────┐                    ┌───────────────┐
│      Car        │ ◆──────────────── │     Engine      │
└───────────────┘    owns/contains    └───────────────┘

  Filled diamond (◆) on the "whole" side = composition.
  If the Car is destroyed, its Engine is destroyed with it —
  this specific Engine object was never shared with anyone else.
```

```python
class Engine:
    def __init__(self, horsepower: int):
        self.horsepower = horsepower

    def start(self) -> None:
        print(f"Engine ({self.horsepower} HP) starting...")


class Car:
    def __init__(self, model: str, horsepower: int):
        self.model = model
        # Composition: Engine is created INSIDE Car's __init__.
        # Car owns this Engine exclusively — it has no existence outside the Car.
        self.engine = Engine(horsepower)

    def start(self) -> None:
        self.engine.start()
        print(f"{self.model} is ready to drive")


car = Car("Tesla Model 3", 283)
car.start()
# When `car` is garbage-collected, its `engine` goes with it —
# nothing else in the program holds a reference to that Engine.
```

**Key signal in code:** the object is **instantiated with `ClassName(...)` inside `__init__`** (or another method) of the owning class — construction and ownership happen in the same place.

---

## 6. Inheritance

**Definition:** An "IS-A" relationship where a subclass inherits the structure and behavior of a superclass and can override or extend it. Unlike the previous three, this is not about object *composition* at runtime — it's about the *type hierarchy* at design time.

```
                  ┌───────────────┐
                  │     Payment      │
                  │  (abstract)      │
                  ├───────────────┤
                  │ + pay(amount)    │
                  └───────△───────┘
                          │
           ┌──────────────┼──────────────┐
           │                              │
┌───────────────┐              ┌───────────────┐
│  CreditCardPay   │              │   UpiPayment    │
├───────────────┤              ├───────────────┤
│ + pay(amount)    │              │ + pay(amount)    │
└───────────────┘              └───────────────┘

  Hollow triangle (▷) pointing to the parent = inheritance ("IS-A").
  CreditCardPayment IS-A Payment; UpiPayment IS-A Payment.
```

```python
from abc import ABC, abstractmethod


class Payment(ABC):
    @abstractmethod
    def pay(self, amount: float) -> None:
        ...


# Inheritance: class X(Y) — CreditCardPayment IS-A Payment
class CreditCardPayment(Payment):
    def pay(self, amount: float) -> None:
        print(f"Charging ${amount:.2f} to credit card")


class UpiPayment(Payment):
    def pay(self, amount: float) -> None:
        print(f"Paying ${amount:.2f} via UPI")


def checkout(payment: Payment, amount: float) -> None:
    payment.pay(amount)   # works with ANY subclass — polymorphism


checkout(CreditCardPayment(), 49.99)
checkout(UpiPayment(), 12.50)
```

**Key signal in code:** `class Subclass(Superclass):` — nothing is stored as a field; the relationship exists in the class definition itself.

---

## 7. Multiplicity

Multiplicity specifies **how many** instances of one class relate to **how many** instances of another. It's written as a number or range next to each end of a relationship line.

| Notation | Meaning |
|----------|---------|
| `1` | exactly one |
| `0..1` | zero or one (optional) |
| `*` or `0..*` | zero or more |
| `1..*` | one or more (at least one) |
| `3..5` | between 3 and 5 |

```
┌───────────────┐  1        1..*  ┌───────────────┐
│      Order       │ ────────────────▶ │  OrderItem     │
└───────────────┘                    └───────────────┘

  One Order has one or more OrderItems.
  Each OrderItem belongs to exactly one Order.
```

```python
class OrderItem:
    def __init__(self, product_name: str, quantity: int):
        self.product_name = product_name
        self.quantity = quantity


class Order:
    def __init__(self, order_id: str):
        self.order_id = order_id
        # multiplicity 1..* : an Order must have at least one item
        # (enforced in code, not just implied by the type hint)
        self.items: list[OrderItem] = []

    def add_item(self, item: OrderItem) -> None:
        self.items.append(item)

    def place(self) -> None:
        if not self.items:
            raise ValueError("Cannot place an order with zero items")
        print(f"Order {self.order_id} placed with {len(self.items)} item(s)")


order = Order("ORD-100")
order.add_item(OrderItem("Keyboard", 1))
order.add_item(OrderItem("Mouse", 2))
order.place()
```

Multiplicity in Python is rarely enforced by the type system alone (`list[OrderItem]` doesn't stop you from having zero items) — you typically enforce lower/upper bounds with validation logic, as shown in `place()` above. Calling this out explicitly in an interview signals maturity.

---

## 8. Comparison Table — Which Relationship to Use When

| Relationship | Diagram symbol | Ownership | Lifecycle coupling | Code signal | Example |
|---|---|---|---|---|---|
| **Association** | plain arrow `──▶` | None | Independent | Object passed as method arg/return, not stored in `__init__` | `Teacher.teach(student)` |
| **Aggregation** | hollow diamond `◇──` | Weak ("has-a") | Independent — part outlives whole | Object passed into constructor/setter, stored by reference | `Department` holds `Professor` objects |
| **Composition** | filled diamond `◆──` | Strong ("owns") | Bound — part dies with whole | Object created with `ClassName()` inside owner's `__init__` | `Car` creates its own `Engine` |
| **Inheritance** | hollow triangle `▷` | N/A (type relationship) | N/A | `class Sub(Super):` | `CreditCardPayment(Payment)` |
| **Multiplicity** | number/range on the line | N/A (a constraint, not a relationship type) | N/A | Validation logic (`len(items) >= 1`) | `1..*` items per `Order` |

**Rule of thumb when deciding between aggregation and composition in an interview:** ask "if I delete the parent right now, should the child still make sense on its own, possibly attached to something else?" If yes → aggregation. If the child is meaningless or orphaned without the parent → composition.

---

## 9. Hands-On Exercises

**Exercise 1:** Model a `Library` and `Book`. Decide: is this composition or aggregation? Justify your answer, then write the Python code.

**Exercise 2:** Model a `Playlist` and `Song`. A song can belong to multiple playlists and exists independently in a music library. Which relationship is this? Write the code.

**Exercise 3:** Draw an inheritance hierarchy (ASCII, using `▷`) for `Shape` → `Circle`, `Rectangle`, `Triangle`, each implementing an `area()` method. Then implement it in Python with an abstract base class.

**Exercise 4:** For a `House` and `Room`, decide between composition and aggregation. Write the multiplicity (e.g., `1..*`) for how many rooms a house has, and add validation logic that enforces it.

**Exercise 5:** Take the `Order`/`OrderItem` example from Section 7 and extend it with a `Customer` class related to `Order` by association (a customer places orders, but an `Order` doesn't need to permanently own a `Customer` object beyond an ID reference). Justify why this is association and not aggregation.

---

## 10. Interview Q&A

**Q: What is the difference between aggregation and composition?**
Answer: Both are "has-a" relationships, but they differ in ownership strength and lifecycle. In composition, the "whole" creates and fully owns the "part" — the part cannot exist independently and is destroyed with the whole (e.g., a `Car` and its `Engine`). In aggregation, the "whole" merely references a "part" that was created externally and can outlive the whole or be shared elsewhere (e.g., a `Department` and its `Professor`s). In code, composition shows up as the child being instantiated inside the parent's `__init__`; aggregation shows up as the child being passed in from outside and stored by reference.

**Q: How would you represent inheritance vs. composition when deciding a design — "is-a" vs "has-a"?**
Answer: Use inheritance when the subclass genuinely IS-A specialization of the superclass and should be substitutable wherever the superclass is expected (Liskov Substitution Principle) — e.g., `UpiPayment` IS-A `Payment`. Use composition when one object is built out of / contains another as a functional part — e.g., a `Car` HAS-A `Engine`; a car is not a specialization of an engine. A common interview trap is over-using inheritance for code reuse when composition ("favor composition over inheritance") would produce a more flexible design, since composition allows swapping the contained object at runtime while inheritance fixes the relationship at compile/class-definition time.

**Q: What does multiplicity mean in a UML diagram, and how do you enforce it in Python?**
Answer: Multiplicity specifies the allowed number of instances on each end of a relationship — e.g., `1..*` means "one or more." Python's type hints (like `list[OrderItem]`) don't enforce these bounds by themselves; you typically enforce them with explicit validation logic (e.g., raising a `ValueError` if a list is empty when the lower bound is 1) or through constructor requirements that force at least one item to be supplied at creation time.

**Q: Give an example where the same two classes could be modeled as either aggregation or composition depending on context.**
Answer: A `Team` and a `Player`. If a `Player` can exist without any team (a free agent) and can move between teams, it's aggregation — the `Team` just references `Player` objects created elsewhere. If instead you're modeling a game engine where a `Player` object is meaningless outside a specific `Team` instance and is created fresh whenever a team is formed and destroyed when the team disbands, it's composition. The relationship type depends on the *lifecycle rules of your specific domain*, not on the class names alone — always state your assumption explicitly in an interview.

**Q: How do you identify an association relationship in existing code, and how is it different from a dependency?**
Answer: Association is when one class holds knowledge of another via a stored field or regularly reused reference, but without ownership — e.g., a `Teacher` field that references a `School` it belongs to. A dependency is even weaker and more transient: one class merely *uses* another briefly, usually as a local variable or method parameter, without storing a reference to it long-term at all — e.g., a method that takes a `Logger` argument just for the duration of one call. In practice, association implies "the objects have some standing relationship," while dependency implies "this class needs that class to do one job right now."

**Q: Why does "favor composition over inheritance" matter in LLD interviews?**
Answer: Deep inheritance hierarchies are rigid — a change to a base class can ripple unpredictably through every subclass, and you can only inherit from one class chain at a time in most designs (avoiding multiple inheritance pitfalls). Composition lets you assemble behavior from independent, swappable parts at runtime (e.g., a `Car` can be given different `Engine` objects without changing the `Car` class itself), which maps directly onto design patterns like Strategy and Decorator that interviewers expect you to reach for instead of building brittle class hierarchies.
