# Type Hints and Protocols — Complete Guide

## Table of Contents
1. [Why Type Hints Matter in LLD Code](#1-why-type-hints-matter-in-lld-code)
2. [Type Hint Fundamentals](#2-type-hint-fundamentals)
3. [The Problem ABCs Don't Solve](#3-the-problem-abcs-dont-solve)
4. [typing.Protocol — Structural Typing](#4-typingprotocol--structural-typing)
5. [Protocol vs ABC — When to Use Which](#5-protocol-vs-abc--when-to-use-which)
6. [Why This Matters for LLD Interviews](#6-why-this-matters-for-lld-interviews)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Type Hints Matter in LLD Code

Python is dynamically typed — nothing stops you from passing the wrong object into a function. In a whiteboard or live-coding LLD interview, type hints do three jobs at once:

1. They **document intent** without needing comments — anyone reading `def charge(amount: float) -> bool` instantly knows the contract.
2. They let a **static checker** (`mypy`, or the IDE's own linting) catch mistakes before running the code.
3. They make your class relationships (Phase 03) explicit in code, not just in a diagram.

```python
# Without hints — reader must guess
def process_order(order, gateway):
    ...

# With hints — self-documenting
def process_order(order: "Order", gateway: "PaymentGateway") -> bool:
    ...
```

---

## 2. Type Hint Fundamentals

```python
from typing import Optional

# Variables
name: str = "Alice"
age: int = 29
price: float = 19.99
is_active: bool = True

# Collections (Python 3.9+ built-in generics)
items: list[str] = ["pen", "notebook"]
scores: dict[str, int] = {"math": 90, "eng": 85}
coordinates: tuple[float, float] = (12.5, 45.2)
unique_ids: set[int] = {1, 2, 3}

# Optional — value can be None
discount_code: Optional[str] = None   # equivalent to: str | None

# Function signatures
def apply_discount(price: float, code: Optional[str] = None) -> float:
    if code is None:
        return price
    return price * 0.9

# Forward references (class refers to itself or a class defined later)
class Node:
    def __init__(self, value: int, next_node: "Node | None" = None) -> None:
        self.value = value
        self.next_node = next_node
```

Type hints are **not enforced at runtime** by the interpreter — `mypy` (or your IDE) is what actually checks them. In an interview, writing correct hints signals precision even if no checker is running.

---

## 3. The Problem ABCs Don't Solve

Recall from the previous lesson: `abc.ABC` gives you an enforced interface, but it requires every implementing class to **explicitly inherit** from it:

```python
from abc import ABC, abstractmethod

class Flyer(ABC):
    @abstractmethod
    def fly(self) -> str: ...

class Bird(Flyer):
    def fly(self) -> str:
        return "Flapping wings"
```

But what about a class that already has a `fly()` method, written by someone else, that you don't own or can't modify to inherit from `Flyer` — e.g., a third-party `Airplane` class?

```python
class Airplane:  # from an external library — you cannot edit this file
    def fly(self) -> str:
        return "Jet engines roaring"
```

`Airplane` behaves exactly like a `Flyer` (it has a compatible `fly()` method) but is **not** a `Flyer` in Python's type system, because it doesn't inherit from it. This is where nominal typing (ABC) hits a wall, and structural typing (`Protocol`) steps in.

---

## 4. typing.Protocol — Structural Typing

`typing.Protocol` defines an interface based on **shape** (which methods/attributes exist), not on inheritance. Any class with matching methods automatically satisfies the Protocol — no explicit `class X(Protocol)` inheritance needed. This is duck typing, but checkable by a static type checker.

```python
from typing import Protocol


class Flyer(Protocol):
    def fly(self) -> str:
        ...  # signature only — no implementation


class Bird:
    def fly(self) -> str:
        return "Flapping wings"


class Airplane:
    def fly(self) -> str:
        return "Jet engines roaring"


class Kite:
    def soar(self) -> str:   # different method name — does NOT match Flyer
        return "Riding the wind"


def launch(flyer: Flyer) -> None:
    print(flyer.fly())


launch(Bird())       # OK — Bird has a compatible fly() method
launch(Airplane())   # OK — Airplane has a compatible fly() method, no inheritance needed
launch(Kite())       # mypy error: Kite has no attribute "fly"
                      # (would also fail at runtime with AttributeError)
```

Neither `Bird` nor `Airplane` inherits from `Flyer` — they satisfy the Protocol purely by having a matching `fly(self) -> str` method. `mypy` verifies this statically; at runtime, Python still relies on the method actually existing when called (same as duck typing).

You can also check Protocol conformance at runtime with `@runtime_checkable`:

```python
from typing import Protocol, runtime_checkable


@runtime_checkable
class Flyer(Protocol):
    def fly(self) -> str:
        ...


print(isinstance(Bird(), Flyer))       # True
print(isinstance(Airplane(), Flyer))   # True
print(isinstance(Kite(), Flyer))       # False
```

---

## 5. Protocol vs ABC — When to Use Which

| | `abc.ABC` | `typing.Protocol` |
|---|---|---|
| Typing style | Nominal (must explicitly inherit) | Structural (matches by shape) |
| Enforces at instantiation | Yes — `TypeError` if abstract methods missing | No — only static type-checker warnings (unless `@runtime_checkable` + `isinstance`) |
| Works with classes you don't own/can't edit | No | Yes |
| Best for | Interface you design and control, where you want hard runtime enforcement | Interfaces satisfied by existing/third-party classes, or when you want loose coupling without inheritance |
| Common LLD use | `PaymentGateway`, `NotificationChannel` you define from scratch | Passing in any object with a `.read()` method, `.close()` method, etc. |

Practical rule of thumb: **if you're designing the whole hierarchy from scratch and want Python to hard-enforce the contract, use `ABC`. If you want to accept "anything that quacks like X" — including classes outside your control — use `Protocol`.** Many real Python codebases (and the standard library's own `typing` module, e.g. `SupportsInt`, `Iterable`) use Protocol-style structural typing for exactly this reason.

---

## 6. Why This Matters for LLD Interviews

- **Type hints demonstrate precision.** In a live-coding interview, hinting `def process(self, item: OrderItem) -> None` instead of `def process(self, item)` is a small thing that reads as senior-level fluency.
- **Protocol solves a real DIP problem ABCs can't:** if your `NotificationService` needs to accept any object with a `send(message: str) -> None` method — including ones from a library you can't modify — `Protocol` lets you depend on the abstraction (Phase 02's DIP) without forcing inheritance on unrelated classes.
- **Shows you know Python beyond "Java translated to Python":** many candidates only know `ABC` because it maps directly to Java interfaces. Knowing when `Protocol` is the more idiomatic Python choice is a differentiator.
- **Pairs naturally with Strategy (Phase 06):** a `Strategy` Protocol lets you swap in any callable/class with the right shape, including ones from outside your codebase, without touching your class hierarchy.

---

## 7. Hands-On Exercises

**Exercise 1:** Define a `Comparable` Protocol with a method `compare_to(self, other) -> int`. Write two unrelated classes (`Money`, `Version`) that each implement `compare_to` without inheriting from `Comparable`. Write a `sort_items` function typed to accept `list[Comparable]`.

**Exercise 2:** Add `@runtime_checkable` to a Protocol and use `isinstance()` to check whether an object at runtime satisfies it. Test it against a matching and a non-matching class.

**Exercise 3:** Take the `PaymentGateway` ABC from the previous lesson and rewrite it as a `Protocol` instead. Discuss (in writing) one scenario where the ABC version is better and one where the Protocol version is better.

**Exercise 4:** Add type hints to a small ungrammatical function of your own (no hints) and run `mypy` on it (or trace through manually) to find at least one bug the hints reveal.

---

## 8. Interview Q&A

**Q: What is the difference between nominal typing and structural typing in Python?**
Answer: Nominal typing (used by `abc.ABC`) requires a class to explicitly declare that it implements an interface, typically via inheritance — the relationship is based on the class's declared name/hierarchy. Structural typing (used by `typing.Protocol`) only checks whether a class has the required methods/attributes with matching signatures — the relationship is based on shape, regardless of inheritance. Python's duck typing is structural typing without static checking; `Protocol` adds the static-checking layer on top.

**Q: When would you choose `typing.Protocol` over `abc.ABC`?**
Answer: When you want to accept objects that satisfy an interface's shape without forcing them into an inheritance hierarchy — especially useful for third-party classes you don't own, or when you want looser coupling. Protocol is ideal for "accept anything with a `.method()` like this" scenarios, whereas ABC is better when you're designing the whole class family yourself and want Python to enforce the contract at instantiation.

**Q: Does `typing.Protocol` provide any runtime enforcement?**
Answer: By default, no — `Protocol` is purely a static-typing construct checked by tools like `mypy`; at runtime, Python will only fail if you actually call a missing method (standard duck-typing behavior). If you decorate the Protocol with `@runtime_checkable`, you can use `isinstance()` against it, but that check only verifies method *names* exist, not that their signatures match.

**Q: Are Python type hints enforced by the interpreter at runtime?**
Answer: No. Type hints are purely informational/documentation unless you use a separate tool. The Python interpreter ignores them at runtime (aside from making them available via `__annotations__`); static checkers like `mypy`, or IDE tooling, are what actually validate them before or during development.

**Q: Can a class satisfy multiple Protocols at once without any special declaration?**
Answer: Yes — because Protocol conformance is structural, a single class automatically satisfies every Protocol whose required methods it happens to implement, with zero explicit declaration. This is useful in LLD designs where an object naturally plays multiple roles (e.g., a class that is both `Comparable` and `Serializable` just by having both sets of methods).

**Q: How do type hints and Protocols relate to the Dependency Inversion Principle from Phase 02?**
Answer: DIP says high-level modules should depend on abstractions, not concretions. Type-hinting a parameter as an ABC or Protocol type (e.g., `gateway: PaymentGateway`) rather than a concrete class (`gateway: StripeGateway`) makes that dependency-on-an-abstraction explicit and checkable — Protocol additionally lets that abstraction be satisfied by classes you don't control, which is often necessary in real systems that integrate third-party code.
