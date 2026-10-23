# Phase 04 — Creational Patterns

## Why This Phase Matters

Once you can model objects and their relationships (Phase 03), the next recurring interview question is *how do you construct them cleanly*? Naive object creation — scattered `if/elif` chains, telescoping constructors, uncontrolled global instances — is one of the fastest ways to fail an LLD interview, because it signals you haven't seen these problems before. Creational patterns are the standard, interviewer-recognized vocabulary for solving them.

This phase covers the five creational patterns that show up most often in Python LLD interviews, each built around a realistic domain example (payment gateways, UI themes, pizza orders, game characters) rather than an abstract diagram, so you can map the pattern to a story you can retell under pressure.

## What's Inside

| File | Pattern | Real-World Tie-In |
|------|---------|--------------------|
| `01-Singleton-Pattern.md` | Singleton | Logger, DB connection pool |
| `02-Factory-Method-Pattern.md` | Factory Method | Payment gateway (Stripe/PayPal/Razorpay) |
| `03-Abstract-Factory-Pattern.md` | Abstract Factory | Cross-platform notification senders (Email + SMS per region) |
| `04-Builder-Pattern.md` | Builder | Pizza order / HTTP request builder |
| `05-Prototype-Pattern.md` | Prototype | Cloning game characters / document templates |

## Learning Outcomes

By the end of this phase, you should be able to:

- Explain the intent of each of the five GoF creational patterns and recognize which one solves which construction problem.
- Write a bad/naive version of code first, identify exactly what pain it causes as requirements grow, then refactor it into the pattern — this is how interviewers expect you to *arrive* at a pattern, not just recite it.
- Implement each pattern from scratch in Python, using idiomatic features (`__new__`, metaclasses, `@classmethod`, `copy.deepcopy`, `ABC`) rather than a mechanical Java-style translation.
- Discuss trade-offs and know when *not* to use a pattern (e.g., Singleton and testability, Builder for simple objects being overkill).

## How to Use This Phase

Read each lesson in order — Singleton first because it's the simplest and most misused, then Factory Method → Abstract Factory (Abstract Factory is "a factory of factories," so Factory Method must come first), then Builder and Prototype, which solve a different problem (staged/complex construction and cheap duplication, respectively). For each lesson, read the bad example, understand *why* it hurts, then read the refactor. Attempt the "implement from scratch" interview question before checking the code in the lesson.

---

**Previous phase:** `Phase-03-UML-and-Object-Modeling` — modeling objects and relationships.
**Next phase:** `Phase-05-Structural-Patterns` — once objects can be constructed cleanly, the next question is *how do you compose them into larger structures*.
