# LLD (Low-Level Design) — Complete Interview Prep Course

A self-contained, Python-first Low-Level Design course built for interview prep at the **~3 years experience** level (Python full-stack — React + Node/Python roles). Every lesson is written so you never need to leave this repo to prepare: concepts, bad-vs-good code, real-world domain examples, class diagrams, and interview Q&A are all inline.

This course does not assume staff-level system design depth. It targets what most product companies actually ask at 2-5 YOE: clean OOP, SOLID, the common design patterns, and the ability to design a handful of classic systems (Parking Lot, Splitwise, Cab Booking, ATM, etc.) end-to-end on a whiteboard.

---

## Course Structure

```
LLD/
├── Phase-01-OOP-Foundations/            → Classes, inheritance, polymorphism, composition, dataclasses, magic methods
├── Phase-02-SOLID-Principles/           → SRP, OCP, LSP, ISP, DIP with bad/good refactors
├── Phase-03-UML-and-Object-Modeling/    → Class diagrams, relationships, noun-extraction technique
├── Phase-04-Creational-Patterns/        → Singleton, Factory Method, Abstract Factory, Builder, Prototype
├── Phase-05-Structural-Patterns/        → Adapter, Decorator, Facade, Proxy, Composite
├── Phase-06-Behavioral-Patterns/        → Strategy, Observer, Command, State, Template Method, Iterator, Mediator, Chain of Responsibility, Memento
├── Phase-07-Python-Features-for-LLD/    → ABCs, Protocols, Enums, Generics, Context Managers, Dependency Injection
├── Phase-08-Transactional-Systems-Design/ → ATM, Vending Machine, Splitwise (design walkthroughs)
├── Phase-09-Booking-Systems-Design/     → Parking Lot, Movie Booking, Cab Booking, Hotel Booking (design walkthroughs)
├── Phase-10-Platform-Systems-Design/    → Food Delivery, Library System, Elevator, URL Shortener (design walkthroughs)
├── Phase-11-Social-Media-Systems-Design/→ WhatsApp, Spotify, Amazon Cart (design walkthroughs)
├── Phase-12-Interview-Process-and-Advanced/ → How to run the interview live, drill problems, staff-level discussion designs
├── Projects/                            → 5 fully coded, runnable reference implementations (Parking Lot, Movie Booking, Splitwise, Cab Booking, ATM)
├── Quick-Reference/                     → Cheatsheet, 50 Interview Q&A, 30-Day Study Plan
├── Reference-Code/                      → Original standalone .py scripts (bad_example.py / good_example.py per pattern) — one folder per topic, runnable independently of the lessons
└── Design-Patterns-Overview.pdf         → Original slide-deck overview of all pattern categories
```

Phases 8-11 teach the **design process** (requirements → entities → relationships → responsibilities → SOLID → patterns → extensibility) for 14 classic interview problems. `Projects/` holds **fully runnable code** for the 5 most commonly asked of those problems — read the design phase first, then the full implementation.

Each phase folder that has an original PDF companion (e.g. `Phase-04-Creational-Patterns/01-Singleton-Pattern.pdf` next to `01-Singleton-Pattern.md`) keeps it alongside the matching lesson — treat the PDF as a slide-style visual companion to that lesson, not a separate reading. `Reference-Code/` holds the original standalone Python scripts (same patterns, same bad/good structure) if you'd rather run bare `.py` files than copy code out of the markdown.

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | OOP Foundations | Beginner | 4 days |
| 02 | SOLID Principles | Beginner | 3 days |
| 03 | UML & Object Modeling | Beginner | 2 days |
| 04 | Creational Patterns | Intermediate | 3 days |
| 05 | Structural Patterns | Intermediate | 3 days |
| 06 | Behavioral Patterns | Intermediate | 4 days |
| 07 | Python Features for LLD | Intermediate | 2 days |
| 08 | Transactional Systems Design | Advanced | 3 days |
| 09 | Booking Systems Design | Advanced | 3 days |
| 10 | Platform Systems Design | Advanced | 3 days |
| 11 | Social Media Systems Design | Advanced | 2 days |
| 12 | Interview Process & Advanced | Advanced | 2 days |

**Total estimated time: ~4-5 weeks** — see [Quick-Reference/30-Day-Study-Plan.md](Quick-Reference/30-Day-Study-Plan.md) for a day-by-day schedule.

---

## How to Use This Course

1. Work through Phases 01-07 in order — they're cumulative (patterns lean on OOP + SOLID; Python features lean on patterns).
2. For Phases 08-11, read the design walkthrough first, think through it yourself, then compare against the reasoning given.
3. For the 5 problems in `Projects/`, actually run the code locally (`python <file>.py` after pasting the code block into a file) before your interview — running it beats reading it.
4. Use `Quick-Reference/Cheatsheet.md` for last-minute review and `Quick-Reference/Interview-QA.md` for rapid-fire drilling.

## Prerequisites

- Comfortable writing Python (functions, classes, basic syntax)
- No prior design pattern or UML knowledge required — Phase-01 through Phase-03 build it from scratch
