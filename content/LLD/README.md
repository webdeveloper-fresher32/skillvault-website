# LLD (Low-Level Design) — Complete Java Masterclass & Interview Prep Course

A self-contained, production-grade **Java-first Low-Level Design course** built for software engineers preparing for top-tier product and enterprise LLD interviews (SDE-1, SDE-2, SDE-3 / Senior Backend roles). Every lesson is crafted with idiomatic, thread-safe Java: core principles, before-and-after refactorings, GoF design patterns (all 23), concurrent multi-threading patterns, UML diagrams, real-world domain architectures, and exhaustive interview Q&A.

This masterclass targets what leading tech companies (Amazon, Google, Microsoft, Uber, Flipkart, Swiggy) evaluate: clean object-oriented architecture, SOLID compliance, thread safety & concurrency handling, memory-conscious data structures, and the ability to design and live-code end-to-end platforms on a whiteboard or pair-programming screen.

---

## Course Structure

```
LLD/
├── Phase-01-OOP-Foundations/             → Classes, Objects, Inheritance, Polymorphism, Encapsulation, Composition, Records
├── Phase-02-SOLID-Principles/            → SRP, OCP, LSP, ISP, DIP with production Java refactorings & comparisons
├── Phase-03-UML-and-Object-Modeling/     → Class diagrams, PlantUML/Mermaid, Object identification & responsibilities
├── Phase-04-Creational-Patterns/         → Singleton, Factory Method, Abstract Factory, Builder, Prototype
├── Phase-05-Structural-Patterns/         → Adapter, Decorator, Facade, Proxy, Composite, Bridge, Flyweight
├── Phase-06-Behavioral-Patterns/         → Strategy, Observer, Command, State, Template Method, Iterator, Mediator,
│                                           Chain of Responsibility, Memento, Visitor, Interpreter
├── Phase-07-Java-Features-and-Concurrency-for-LLD/ → Interfaces, Generics, Records, Streams, AutoCloseable, DI,
│                                                     java.util.concurrent (Locks, Semaphores, ExecutorService, Concurrent Collections)
├── Phase-08-Transactional-Systems-Design/→ ATM, Vending Machine, Splitwise (comprehensive design walkthroughs)
├── Phase-09-Booking-Systems-Design/      → Parking Lot, Movie Ticket Booking, Cab Booking, Hotel Booking
├── Phase-10-Platform-Systems-Design/     → Food Delivery (Swiggy/DoorDash), Library Management, Elevator, URL Shortener
├── Phase-11-Social-Media-Systems-Design/ → WhatsApp, Spotify, Amazon Cart (real-time states, pub-sub & order flows)
├── Phase-12-Interview-Process-and-Advanced/ → 7-step live interview blueprint, rapid drills, staff-level system discussions
├── Projects/                             → 5 complete, runnable reference implementations in single-file Java
│                                           (Parking Lot, Movie Ticket Booking, Splitwise, Cab Booking, ATM)
├── Quick-Reference/                      → Cheatsheet, 50 Interview Q&A, 30-Day Study Plan
└── 0.Assets/                             → Diagrams, architecture charts, and visual reference assets
```

Phases 08–11 teach the repeatable **7-step design process** (Requirements → Entities → Relationships → Responsibilities → SOLID → Patterns → Extensibility) across 14 high-frequency interview platforms. `Projects/` provides **complete, self-contained runnable Java applications** for the 5 most critical problems — executable directly with `java <ClassName>.java` (Java 11+ source launch).

---

## Learning Path

| Phase | Topic | Key Java Focus | Difficulty | Time |
|---|---|---|---|---|
| **01** | **OOP Foundations** | Classes, Records, Inheritance, Polymorphism, Composition, Immutability | Beginner | 4 days |
| **02** | **SOLID Principles** | SRP, OCP, LSP, ISP, DIP with clean interface contracts | Beginner | 3 days |
| **03** | **UML & Object Modeling** | Class diagrams, Aggregation vs Composition, GRASP principles | Beginner | 2 days |
| **04** | **Creational Patterns** | Bill Pugh Singleton, Factory, Abstract Factory, Builder, Prototype | Intermediate | 3 days |
| **05** | **Structural Patterns** | Adapter, Decorator, Facade, Proxy, Composite, Bridge, Flyweight | Intermediate | 4 days |
| **06** | **Behavioral Patterns** | Strategy, Observer, Command, State, Template, Iterator, Mediator, CoR, Memento, Visitor, Interpreter | Intermediate | 5 days |
| **07** | **Java & Concurrency in LLD** | Generics, Records, Streams, ReentrantLock, ReadWriteLock, Atomic, ThreadPools | Intermediate | 4 days |
| **08** | **Transactional Systems** | ATM State Machine, Vending Dispenser, Splitwise Debt Minimization | Advanced | 3 days |
| **09** | **Booking Systems** | Parking Lot Allocation, Movie Ticket Lock/Book, Cab Dispatch, Hotel Inventory | Advanced | 3 days |
| **10** | **Platform Systems** | Swiggy/DoorDash, Library Catalog, Elevator Controller, TinyURL Base62 | Advanced | 3 days |
| **11** | **Social & Media Systems** | WhatsApp Read Receipts, Spotify Audio State, Amazon Cart Discounts | Advanced | 3 days |
| **12** | **Interview Process & Drills** | 7-Step live coding methodology, Chess, Tic-Tac-Toe, Staff-level discussions | Advanced | 2 days |

**Total estimated time: ~5-6 weeks** — see [Quick-Reference/30-Day-Study-Plan.md](Quick-Reference/30-Day-Study-Plan.md) for a condensed 30-day study sprint.

---

## How to Use This Course

1. **Foundations First**: Master Phases 01–07 in order. Pay special attention to Phase 07 (Concurrency & Thread-Safety) as concurrency questions are standard in Java backend interviews.
2. **Interactive Design**: For Phases 08–11, read the requirements and pause. Sketch your classes, interfaces, and state transitions before reading the solution.
3. **Run the Code**: In `Projects/`, run the full single-file implementations directly using `java <ProjectName>Demo.java`. Experiment with edge cases (race conditions, invalid operations).
4. **Interview Warm-up**: Review `Quick-Reference/Cheatsheet.md` and practice the rapid drills in `Phase-12/02-Object-Identification-Practice-Drills.md`.

## Prerequisites

- Core Java proficiency (JDK 17 or higher recommended: Records, Pattern Matching, Switch Expressions)
- Basic understanding of data structures and collections (`List`, `Map`, `Set`, `PriorityQueue`)
- No prior design pattern or UML experience required — the course builds concepts from ground zero.
