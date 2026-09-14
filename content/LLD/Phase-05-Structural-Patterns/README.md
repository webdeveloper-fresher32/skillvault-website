# Phase 05 — Structural Patterns

## Overview

Structural patterns are about **composition** — how classes and objects are wired together to form larger, more capable structures without making the whole system rigid. Where Phase 04 (Creational Patterns) answered "how do I build an object?", this phase answers "how do I combine objects cleanly?"

These are the patterns you reach for constantly in real backend/full-stack work: wrapping a third-party SDK, adding cross-cutting behavior (logging, auth, caching) without touching business logic, hiding a messy subsystem behind one clean call, controlling access to an expensive or sensitive object, and modeling tree-shaped domains like file systems or org charts.

## What You'll Learn

| # | Pattern | Core Idea | Real-World Tie-In |
|---|---------|-----------|--------------------|
| 01 | Adapter | Convert one interface into another the client expects | Wrapping a third-party Payment SDK |
| 02 | Decorator | Attach new behavior to an object dynamically, without subclassing | Django/Flask middleware, coffee/pizza toppings |
| 03 | Facade | Provide a single simplified interface over a complex subsystem | `OrderFacade` hiding Inventory + Payment + Shipping + Notification |
| 04 | Proxy | Stand in for another object to control access to it | Lazy-loaded images, protected DB connections |
| 05 | Composite | Treat individual objects and groups of objects uniformly | File system (File/Folder), org chart |

## Files in This Phase

```
Phase-05-Structural-Patterns/
├── README.md
├── 01-Adapter-Pattern.md
├── 02-Decorator-Pattern.md
├── 03-Facade-Pattern.md
├── 04-Proxy-Pattern.md
└── 05-Composite-Pattern.md
```

## How to Study This Phase

1. Read each lesson's "bad example" first — feel the pain the pattern removes.
2. Type out the "good example" code yourself; don't just read it.
3. Answer the Interview Q&A from memory before checking the given answers.
4. After finishing all five, try to spot at least one place in a codebase you've worked on where each pattern already exists (even if nobody named it).

## Prerequisites

- Phase 01 (OOP Foundations) — especially composition vs inheritance
- Phase 02 (SOLID Principles) — especially Open/Closed and Interface Segregation
- Comfortable reading Python `ABC`, `@abstractmethod`, and type hints

---

Next: **Phase 06 — Behavioral Patterns**
