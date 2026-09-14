# Abstract Base Classes — Complete Guide

## Table of Contents
1. [The Problem: Unenforced Contracts](#1-the-problem-unenforced-contracts)
2. [What is an Abstract Base Class?](#2-what-is-an-abstract-base-class)
3. [abc.ABC and @abstractmethod in Practice](#3-abcabc-and-abstractmethod-in-practice)
4. [Abstract Properties and Mixing Concrete Methods](#4-abstract-properties-and-mixing-concrete-methods)
5. [ABC vs Duck Typing](#5-abc-vs-duck-typing)
6. [Why This Matters for LLD Interviews](#6-why-this-matters-for-lld-interviews)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Unenforced Contracts

In Phase 02 you learned the Liskov Substitution Principle and the Dependency Inversion Principle — code should depend on abstractions, not concrete classes. Python lets you write a "fake interface" using a plain class:

```python
class PaymentGateway:
    def charge(self, amount: float) -> bool:
        raise NotImplementedError
```

This looks like an interface, but nothing stops a subclass from forgetting to override `charge`, and nothing stops someone from instantiating `PaymentGateway` directly:

```python
class BrokenGateway(PaymentGateway):
    pass  # forgot to implement charge()

gw = BrokenGateway()
gw.charge(100)  # AttributeError only at RUNTIME, when charge() is called
```

The bug surfaces late — at call time, not at class-definition time or instantiation time. In a large codebase (or a live interview), that delay is exactly the kind of mistake an interviewer is watching for.

---

## 2. What is an Abstract Base Class?

An **Abstract Base Class (ABC)** is a class that:
- Cannot be instantiated directly.
- Declares one or more `@abstractmethod`s that subclasses **must** override.
- Fails at `instantiation time` (not call time) if a subclass hasn't implemented every abstract method.

This turns a "hope everyone remembers" contract into a Python-enforced contract — the interpreter itself validates that your interface is satisfied.

```
Plain class "interface":           ABC:
  no enforcement                     enforced at instantiation
  bug found at call time             bug found immediately
  relies on convention               relies on the language
```

---

## 3. abc.ABC and @abstractmethod in Practice

```python
from abc import ABC, abstractmethod


class PaymentGateway(ABC):
    """Abstract interface every concrete gateway must implement."""

    @abstractmethod
    def charge(self, amount: float) -> bool:
        """Charge the given amount. Returns True on success."""
        ...

    @abstractmethod
    def refund(self, amount: float) -> bool:
        """Refund the given amount. Returns True on success."""
        ...


class StripeGateway(PaymentGateway):
    def charge(self, amount: float) -> bool:
        print(f"[Stripe] Charging ${amount:.2f}")
        return True

    def refund(self, amount: float) -> bool:
        print(f"[Stripe] Refunding ${amount:.2f}")
        return True


class BrokenGateway(PaymentGateway):
    def charge(self, amount: float) -> bool:
        return True
    # refund() is missing!


# Usage
stripe = StripeGateway()
stripe.charge(49.99)

try:
    broken = BrokenGateway()
except TypeError as e:
    print(f"Cannot instantiate: {e}")
    # Cannot instantiate: Can't instantiate abstract class BrokenGateway
    # with abstract method refund
```

Note the key difference from Section 1: `BrokenGateway()` fails **immediately**, at instantiation — long before anyone calls `refund()`. This is the entire value proposition of ABCs.

---

## 4. Abstract Properties and Mixing Concrete Methods

ABCs aren't limited to abstract methods — you can mix in concrete (shared) methods and even abstract properties. This is useful when several subclasses share common behavior but each must supply its own piece of data.

```python
from abc import ABC, abstractmethod


class Shape(ABC):
    @property
    @abstractmethod
    def area(self) -> float:
        """Every shape must know how to compute its own area."""
        ...

    def describe(self) -> str:
        """Concrete method — shared by all subclasses, not overridden."""
        return f"{self.__class__.__name__} with area {self.area:.2f}"


class Circle(Shape):
    def __init__(self, radius: float) -> None:
        self.radius = radius

    @property
    def area(self) -> float:
        return 3.14159 * self.radius ** 2


class Rectangle(Shape):
    def __init__(self, width: float, height: float) -> None:
        self.width = width
        self.height = height

    @property
    def area(self) -> float:
        return self.width * self.height


shapes: list[Shape] = [Circle(3), Rectangle(4, 5)]
for shape in shapes:
    print(shape.describe())
# Circle with area 28.27
# Rectangle with area 20.00
```

`describe()` is written once on the ABC and inherited by every subclass — this is the Template Method pattern from Phase 06, and ABCs are the natural vehicle for it.

---

## 5. ABC vs Duck Typing

Python's philosophy is famously "duck typing" — if it walks like a duck and quacks like a duck, treat it like a duck, regardless of its declared type:

```python
class Duck:
    def quack(self) -> str:
        return "Quack!"

class Dog:
    def quack(self) -> str:
        return "Woof (pretending to quack)"

def make_it_quack(entity) -> None:
    print(entity.quack())  # works for anything with a .quack() method

make_it_quack(Duck())
make_it_quack(Dog())
```

No inheritance, no interface declaration required — this is idiomatic, "Pythonic" flexibility. So when should you reach for an ABC instead?

| Use Duck Typing when... | Use `abc.ABC` when... |
|---|---|
| The codebase is small/exploratory | You are designing a system with multiple interchangeable implementations (Strategy, Factory outputs) |
| You genuinely don't care about the type, only the behavior | You want a **hard failure** if a class forgets to implement required behavior |
| One-off scripts, prototyping | Team codebases / interviews, where the contract needs to be explicit and documented |
| You can't or don't want to modify the classes being duck-typed | You control the class hierarchy and want a formal, enforced interface |

In LLD interviews, ABCs are almost always the better choice for defining interfaces like `PaymentGateway`, `NotificationChannel`, or `Shape` — they make your design intent explicit to the interviewer and catch mistakes immediately, rather than relying on informal convention. (See the next lesson for `typing.Protocol`, which gives you structural typing *with* static type-checking, splitting the difference between the two.)

---

## 6. Why This Matters for LLD Interviews

- **Enforces DIP (Phase 02):** high-level modules (e.g., `OrderService`) depend on the `PaymentGateway` abstraction, not on `StripeGateway` directly. ABCs make that abstraction a real, checkable Python construct instead of a comment.
- **Backbone of Strategy, Factory, and Template Method (Phases 04–06):** every "family of interchangeable algorithms/objects" you designed in those phases should be modeled with an ABC defining the shared contract.
- **Signals language fluency:** interviewers explicitly look for `abc.ABC` / `@abstractmethod` instead of `raise NotImplementedError` in a plain class — it shows you know Python's built-in tools rather than reinventing them.
- **Fails fast:** catching a missing implementation at `instantiation` time (not deep in a call stack) is a concrete, demonstrable correctness argument you can make out loud while coding in an interview.

---

## 7. Hands-On Exercises

**Exercise 1:** Define an abstract `NotificationChannel` with abstract method `send(self, message: str) -> None`. Implement `EmailChannel` and `SMSChannel`. Try instantiating `NotificationChannel` directly and observe the `TypeError`.

**Exercise 2:** Add a concrete method `log_delivery(self, message: str) -> None` to `NotificationChannel` that all subclasses inherit unchanged. Confirm it works without being overridden.

**Exercise 3:** Add an abstract property `channel_name` to `NotificationChannel`. Implement it in both subclasses and use it inside `log_delivery`.

**Exercise 4:** Deliberately create a subclass missing one abstract method, and add code that instantiates it inside a `try/except TypeError` block to print a helpful message.

---

## 8. Interview Q&A

**Q: What is the difference between `abc.ABC` and just raising `NotImplementedError` in a base class method?**
Answer: With `NotImplementedError`, Python lets you instantiate the subclass even if it forgot to override the method — the bug only surfaces when that method is actually called, potentially much later. With `abc.ABC` and `@abstractmethod`, Python refuses to instantiate any subclass that hasn't implemented every abstract method — the error happens immediately at instantiation time, which is far easier to catch and debug.

**Q: Can you instantiate a class that inherits from `ABC` but doesn't implement all abstract methods?**
Answer: No. Python raises a `TypeError` at instantiation time listing exactly which abstract methods are missing. This is enforced by the `ABCMeta` metaclass that `ABC` uses internally to track abstract methods across the class hierarchy.

**Q: Can an ABC have concrete (non-abstract) methods?**
Answer: Yes. An ABC can mix abstract methods (which subclasses must implement) with concrete methods (shared logic inherited as-is). This is the basis of the Template Method pattern — the ABC defines the overall algorithm using concrete methods, delegating specific steps to abstract methods that subclasses fill in.

**Q: When would you use duck typing instead of an ABC?**
Answer: For small, exploratory scripts, or when working with classes you don't own and can't force into an interface hierarchy, duck typing is simpler and more flexible — Python doesn't check types, only that the object supports the method being called. For larger designs with multiple interchangeable implementations (Strategy, Factory products) where you want the interface enforced and self-documenting, an ABC (or `typing.Protocol`) is preferable.

**Q: How do abstract properties work, and why would you use one?**
Answer: Stacking `@property` and `@abstractmethod` (with `@property` on top) declares an attribute-like value that subclasses must supply via their own `@property`. It's used when every subclass needs to expose a computed or stored value (e.g., `area`, `channel_name`) through attribute-style access, but the actual computation differs per subclass — the ABC enforces that the property exists without dictating how it's computed.

**Q: Does using an ABC hurt performance compared to a plain class?**
Answer: The overhead is negligible — `ABCMeta` only adds bookkeeping at class-definition and instantiation time to check for unimplemented abstract methods. There is no runtime cost per method call. The trade-off is purely about correctness and design clarity, not performance.
