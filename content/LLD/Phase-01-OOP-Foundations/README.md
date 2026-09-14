# Phase 01 — OOP Foundations

Low-Level Design (LLD) interviews are, at their core, a test of how well you apply object-oriented principles to model real systems (parking lots, ride-sharing, elevators, payment processors). This phase rebuilds those OOP foundations in Python — not as academic theory, but as the exact tools you'll reach for when designing classes under interview pressure.

Every lesson follows the same pattern: a plain-English explanation, a "bad" example showing what goes wrong without the concept, a "good" example fixing it with realistic domains (banking, payments, ride-sharing, e-commerce), and interview Q&A to check retention.

## What This Phase Covers

- How Python actually creates and initializes objects, and the instance-vs-class-variable trap that bites almost everyone.
- Inheritance and polymorphism as tools for shared behavior and interchangeable interfaces.
- Abstraction (hiding complexity behind an interface) and encapsulation (protecting internal state) via ABCs and property-based access control.
- The difference between overriding (real, runtime) and "overloading" (simulated, via defaults/`*args`/`@singledispatch`) in Python.
- Composition vs inheritance — why "favor composition" is repeated so often in LLD interviews, and when inheritance is still correct.
- `@staticmethod` vs `@classmethod` vs instance methods, and the classmethod-as-factory pattern used constantly in LLD solutions.
- Magic methods (`__str__`, `__repr__`, `__eq__`, `__hash__`, `__lt__`) and `@property` for building well-behaved, Pythonic objects.
- `@dataclass` as the modern, low-boilerplate way to model value objects and DTOs in LLD answers.

## Lesson Files

| # | File | Topic |
|---|------|-------|
| 01 | `01-Classes-Objects-and-Constructors.md` | Classes, objects, `__init__`, instance vs class variables |
| 02 | `02-Inheritance-and-Polymorphism.md` | Inheritance, method resolution, polymorphism |
| 03 | `03-Abstraction-and-Encapsulation.md` | ABCs, access control, a `PaymentProcessor` example |
| 04 | `04-Method-Overriding-and-Overloading.md` | Overriding vs Python-style overloading |
| 05 | `05-Composition-vs-Inheritance.md` | is-a vs has-a, `Car`/`Engine` example |
| 06 | `06-Static-and-Class-Methods.md` | `@staticmethod`, `@classmethod`, factory methods |
| 07 | `07-Magic-Methods-and-Properties.md` | Dunder methods and `@property` |
| 08 | `08-Dataclasses.md` | `@dataclass`, `field()`, `frozen=True` |

## Estimated Time

**4-5 days** (1-2 lessons/day, including writing and running the code examples yourself).

## Prerequisites

- Working Python 3.10+ installation (for `@singledispatch`, `@dataclass`, type hints).
- Basic Python syntax (functions, conditionals, loops) — no prior OOP experience assumed.
