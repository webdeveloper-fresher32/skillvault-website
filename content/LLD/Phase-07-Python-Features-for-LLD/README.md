# Phase 07 — Python Features for LLD

## Why This Phase Matters

By this point you know the OOP fundamentals (Phase 01), SOLID (Phase 02), how to model relationships (Phase 03), and the classic GoF patterns (Phases 04–06). Those ideas are language-agnostic — but *how* you express them in an interview is not. A candidate who writes `if type == "car": ...` chains instead of an `Enum`, or hand-rolls an interface check instead of using `abc.ABC` or `typing.Protocol`, signals weaker Python fluency even if the underlying design is correct.

This phase covers the Python-specific language features that make LLD code idiomatic, type-safe, and interview-ready: abstract base classes and structural typing for defining contracts, enums and dataclasses for clean value modeling, generics for reusable containers, context managers for resource safety, and dependency injection for testable, SOLID-compliant services. None of these are new *patterns* — they are the vocabulary and syntax you use to implement the patterns you already know, the way a fluent Python engineer would.

## What's Inside

| File | Feature | Real-World Tie-In |
|------|---------|--------------------|
| `01-Abstract-Base-Classes.md` | `abc.ABC`, `@abstractmethod` | Enforcing a `PaymentGateway` / `Shape` interface |
| `02-Type-Hints-and-Protocols.md` | Type hints, `typing.Protocol` | Structural interfaces without inheritance |
| `03-Enums-and-Dataclasses-in-LLD.md` | `Enum`, `@dataclass` | `OrderStatus`, `VehicleType`, immutable value objects |
| `04-Generics-Basics.md` | `TypeVar`, `Generic[T]` | Generic `Stack[T]`, `Repository[T]` |
| `05-Context-Managers.md` | `__enter__`/`__exit__`, `contextlib` | DB connection handling, file-based locks |
| `06-Dependency-Injection.md` | Constructor injection | Swappable `NotificationChannel` / `PaymentGateway` |

## Learning Outcomes

By the end of this phase, you should be able to:

- Choose correctly between `abc.ABC` and `typing.Protocol` when defining a contract, and explain the trade-off (nominal vs structural typing) to an interviewer.
- Replace magic strings/booleans with `Enum` and model immutable data with `@dataclass`, improving readability and reducing bugs in state-machine-style designs (orders, bookings, vehicles).
- Write a basic generic class (`Stack[T]`, `Repository[T]`) using `TypeVar`/`Generic` and explain why generics matter for reusable, type-safe LLD components.
- Implement a custom context manager for a resource (connection, lock, file) and explain why `with` beats manual try/finally.
- Apply constructor-based dependency injection to satisfy the Dependency Inversion Principle (Phase 02) without a DI framework, and explain how it improves testability.

## How to Use This Phase

Read in order — ABCs first since Protocol is best understood as an alternative to it. Enums/dataclasses and generics are independent and can be read in either order, but both build on the class fundamentals from Phase 01. Context managers and dependency injection close the phase because both are commonly used *inside* the systems you'll design in Phases 08–11 (e.g., a booking system using DI for payment gateways, a transactional system using a context manager for connection handling). For every lesson, run the code examples yourself — all snippets are complete and runnable as-is.

---

**Previous phase:** `Phase-06-Behavioral-Patterns` — the last of the GoF pattern families.
**Next phase:** `Phase-08-Transactional-Systems-Design` — where these Python idioms and all prior patterns/principles get applied to full LLD interview problems.
