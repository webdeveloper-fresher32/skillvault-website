# Phase 03 — UML and Object Modeling

## Why This Phase Matters

Before you can design any system in an interview — a parking lot, a ride-hailing app, a chat system — you need a shared vocabulary for describing *how objects relate to each other*. UML (Unified Modeling Language) is that vocabulary. You don't need to memorize a spec; you need to fluently read and hand-draw a handful of relationship types, and you need a repeatable technique for turning a vague prompt ("design WhatsApp") into a concrete list of classes.

This phase gives you both:

1. **The relationship vocabulary** — Association, Aggregation, Composition, Inheritance, Multiplicity — with ASCII diagrams and matching Python code, so you can translate between "the diagram on the whiteboard" and "the code you'd actually type."
2. **The noun-extraction technique** — a step-by-step method interviewers expect to see, worked through on multiple real prompts, so you can reproduce it under pressure.

## What's Inside

| File | Topic |
|------|-------|
| `01-Class-Diagrams-Basics.md` | UML relationship types (association, aggregation, composition, inheritance, multiplicity) with diagrams + Python code |
| `02-Identifying-Objects-and-Responsibilities.md` | The noun-extraction interview technique, worked through on 3 different design prompts |

## Learning Outcomes

By the end of this phase, you should be able to:

- Draw and explain the four core UML relationship arrows from memory.
- Look at a Python class and state which UML relationship it represents (and vice versa).
- Read a multiplicity notation like `1..*` or `0..1` and explain what it constrains.
- Given any "Design X" prompt, extract candidate classes, attributes, relationships, and responsibilities within the first few minutes of an interview — out loud, methodically.

## How to Use This Phase

Read `01` first — it's the vocabulary. Then read `02`, which applies that vocabulary as an interview technique. Do the worked examples by hand (on paper or a whiteboard) before reading the provided solutions — the value is in practicing the extraction process, not in memorizing the answers.

---

**Next phase:** `Phase-04-Creational-Patterns` — once you can model objects and their relationships, the next question is *how do you construct them cleanly*.
