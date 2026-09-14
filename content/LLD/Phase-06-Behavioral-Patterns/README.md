# Phase 06 — Behavioral Patterns

## Overview

Behavioral patterns are about **how objects communicate and share responsibility** at runtime. Where Phase 04 (Creational) answered "how do I build an object?" and Phase 05 (Structural) answered "how do I compose objects?", this phase answers "how do objects collaborate, react to events, and change behavior over time without turning into a tangle of `if/elif` chains?"

These are the patterns that show up constantly in interviews because they map directly onto real systems: swapping payment algorithms, notifying subscribers of state changes, undoing actions, modeling order/ride status transitions, writing reusable pipelines, iterating custom collections, decoupling chat participants, chaining approval workflows, and snapshotting state for undo.

## What You'll Learn

| # | Pattern | Core Idea | Real-World Tie-In |
|---|---------|-----------|--------------------|
| 01 | Strategy | Encapsulate interchangeable algorithms behind a common interface | Payment methods (Credit Card, UPI, Net Banking, Wallet) |
| 02 | Observer | Notify multiple dependents automatically when subject state changes | WeatherStation pushing updates to Mobile/TV displays |
| 03 | Command | Turn a request into a standalone object that can be queued, logged, undone | Waiter → Order commands → Chef, undo/redo |
| 04 | State | Let an object change its behavior when its internal state changes | Order status machine (Placed → Shipped → Delivered) |
| 05 | Template Method | Fix an algorithm's skeleton, let subclasses override specific steps | Data pipeline (parse → validate → transform → save) |
| 06 | Iterator | Provide sequential access to a collection without exposing its internals | Custom Playlist using `__iter__`/`__next__` |
| 07 | Mediator | Centralize complex communication between objects | Chat room coordinating Users, ATC tower |
| 08 | Chain of Responsibility | Pass a request along a chain of handlers until one handles it | Expense approval (Manager → Director → VP) |
| 09 | Memento | Capture and restore an object's internal state without breaking encapsulation | Text editor undo history |

## Files in This Phase

```
Phase-06-Behavioral-Patterns/
├── README.md
├── 01-Strategy-Pattern.md
├── 02-Observer-Pattern.md
├── 03-Command-Pattern.md
├── 04-State-Pattern.md
├── 05-Template-Method-Pattern.md
├── 06-Iterator-Pattern.md
├── 07-Mediator-Pattern.md
├── 08-Chain-of-Responsibility-Pattern.md
└── 09-Memento-Pattern.md
```

## How to Study This Phase

1. Read each lesson's "bad example" first — feel the pain (rigid `if/elif`, tight coupling, god objects) the pattern removes.
2. Type out the "good example" code yourself; don't just read it. All examples are complete and runnable with `python3 filename.py` style snippets in your head.
3. Answer the Interview Q&A from memory before checking the given answers — especially the "implement X from scratch" questions, since they are asked in nearly every LLD interview.
4. After finishing all nine, pick two patterns that felt similar (e.g. Strategy vs State, Command vs Chain of Responsibility) and write one paragraph on how you'd tell them apart in an interview.

## Prerequisites

- Phase 01 (OOP Foundations) — especially composition, polymorphism, interfaces via ABCs
- Phase 02 (SOLID Principles) — especially Open/Closed and Dependency Inversion
- Phase 05 (Structural Patterns) — Decorator and Composite share DNA with Chain of Responsibility and Composite-style iteration
- Comfortable reading Python `ABC`, `@abstractmethod`, `Enum`, `dataclasses`, and type hints

---

Next: **Phase 07 — Python Features for LLD**
