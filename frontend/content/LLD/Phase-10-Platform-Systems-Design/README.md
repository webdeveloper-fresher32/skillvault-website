# Phase 10 — Platform Systems Design

## Overview

This phase applies everything from Phases 01–09 (OOP, SOLID, UML, design patterns, Java
idioms and concurrency) to a set of classic "platform" Low-Level Design interview problems — the kind
where an interviewer says "design a food delivery app" and gives you 45 minutes on a
whiteboard.

Every lesson in this phase walks the **same 7-step design process**, in the same order,
so the process itself becomes muscle memory. In an interview, narrating these steps out
loud is often worth more than the code you produce.

---

## The 7-Step Design Process

| Step | What you do | Why it matters to the interviewer |
|------|-------------|-----------------------------------|
| 1. **Clarify requirements** | Ask/state functional & non-functional requirements, list what's in scope vs out of scope | Shows you don't jump to code before understanding the problem |
| 2. **Identify entities/classes** | Extract the nouns of the problem — the "things" the system manages | Shows you can decompose a fuzzy problem into concrete objects |
| 3. **Define relationships** | Association, aggregation, composition, inheritance between entities | Shows you understand object modeling, not just syntax |
| 4. **Assign responsibilities** | Decide which class owns which behavior (methods) | Shows you think about cohesion, not just data bags |
| 5. **Apply SOLID** | Check each class/interface against SRP, OCP, LSP, ISP, DIP | Shows you write maintainable, extensible code, not just working code |
| 6. **Apply design patterns where appropriate** | Introduce a pattern only where it solves a real, named problem in this design | Shows judgement — patterns are tools, not decorations |
| 7. **Explain extensibility** | Answer "how would this change if we added X?" before being asked | Shows you're thinking one step ahead, like a senior engineer |

---

## Lessons in This Phase

| File | Problem | Key patterns/ideas |
|------|---------|---------------------|
| `01-Food-Delivery-Design.md` | Food Delivery App (Swiggy/DoorDash-style) | Observer (order tracking), Strategy (delivery partner assignment) |
| `02-Library-Management-System-Design.md` | Library Management System | Aggregation vs composition, state transitions for loans/holds |
| `03-Elevator-System-Design.md` | Elevator System | State pattern, SCAN/LOOK scheduling |
| `04-URL-Shortener-Design.md` | URL Shortener (TinyURL-style) | Strategy (short-code generation), Repository abstraction |

---

## How to Use This Phase

1. Read the problem statement in each lesson and **pause** — try the 7 steps yourself on
   paper before reading the walkthrough.
2. Compare your class list and relationships against the lesson's.
3. Study the "Key Decisions" section — these are the trade-offs interviewers actually
   probe on.
4. Drill the "Interview Follow-ups" and "Interview Q&A" out loud, not just silently.

---

## What's Next

Phase 11 applies the same process to social-media-style systems (News Feed, Notification
System, Rate Limiter), which lean more heavily on Observer, Strategy, and concurrency
concerns.
