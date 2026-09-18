# Phase 02 — SOLID Principles

## Overview

SOLID is the single most-tested topic in Low-Level Design interviews. Interviewers hand you a "bad" class and ask you to identify what's wrong and refactor it — almost always the answer traces back to one of these five principles. This phase covers each principle in depth: what it means in plain English, a realistic Python example that violates it, the refactored fix, and an interview-style exercise so you can practice the exact "spot the smell, refactor it" pattern interviewers use.

## What This Phase Covers

| # | File | Principle | Core Idea |
|---|------|-----------|-----------|
| 1 | `01-Single-Responsibility-Principle.md` | SRP | A class should have one, and only one, reason to change |
| 2 | `02-Open-Closed-Principle.md` | OCP | Open for extension, closed for modification |
| 3 | `03-Liskov-Substitution-Principle.md` | LSP | Subtypes must be substitutable for their base types |
| 4 | `04-Interface-Segregation-Principle.md` | ISP | Clients shouldn't depend on methods they don't use |
| 5 | `05-Dependency-Inversion-Principle.md` | DIP | Depend on abstractions, not concretions |

Each lesson follows the same structure:
1. Plain-English explanation
2. A "bad" Python example that violates the principle, with commentary on the smell
3. A "good" Python example that fixes it
4. An Interview-Style Exercise (refactor prompt + worked answer)
5. Interview Q&A (4-6 questions)

## Estimated Time

**4-6 hours** total (45-60 minutes per lesson, including typing out and running the code examples yourself).

## How to Study This Phase

- Don't just read the code — copy it into a `.py` file and run it. Break it, fix it, extend it.
- After each lesson, close the file and try to re-derive the "good" example from memory using only the principle's one-line definition.
- SOLID principles overlap (e.g., DIP and OCP often show up together in the same refactor) — by Phase 05 you'll see them combined inside real design patterns (Strategy, Factory, Observer, etc.).

---

Next: [Phase 03 — Design Patterns](../../../04-SYSTEMS-INFRASTRUCTURE/04-Developer-Tools/Git/Phase-01-Git-Core-Architecture-and-Plumbing/README.md)
