# Phase 08 — Transactional Systems Design

## Table of Contents
1. [Overview](#1-overview)
2. [The 7-Step LLD Interview Process](#2-the-7-step-lld-interview-process)
3. [What You'll Design in This Phase](#3-what-youll-design-in-this-phase)
4. [How to Use This Phase](#4-how-to-use-this-phase)

---

## 1. Overview

"Transactional systems" are LLD interview problems built around a **stateful device or ledger that moves money (or value) between parties** — an ATM, a vending machine, a bill-splitting app. They are interviewer favorites because they force you to demonstrate:

- Modeling a system that has **explicit states** (idle, authenticated, dispensing, out of stock).
- Modeling **money-safe operations** (you cannot dispense cash twice, you cannot split an expense incorrectly).
- Choosing the right **design pattern** for state transitions and for pluggable strategies (payment types, split types).

This phase does **not** hand you a full production-grade implementation to memorize. Full runnable code for these systems lives in `LLD/Projects/`. Instead, this phase teaches you the **design process** — the exact sequence of decisions an interviewer expects to see, out loud, in 30–40 minutes.

---

## 2. The 7-Step LLD Interview Process

Every lesson in this phase (and every LLD interview you will ever sit) follows the same seven steps. Internalize this order — it is the rubric interviewers grade against, even when they don't say so.

| Step | Name | What you do | What it prevents |
|------|------|--------------|-------------------|
| 1 | **Clarify requirements** | Ask scoping questions; write functional + non-functional requirements | Designing the wrong system |
| 2 | **Identify entities/classes** | Extract nouns from the requirements — these become candidate classes | Missing core abstractions |
| 3 | **Define relationships** | Decide composition vs. aggregation vs. association between classes | A flat, disconnected class list |
| 4 | **Assign responsibilities** | Decide which class owns which behavior (methods) | God classes / anemic classes |
| 5 | **Apply SOLID** | Check each class against SRP, OCP, LSP, ISP, DIP | Rigid, hard-to-extend design |
| 6 | **Apply design patterns** | Introduce State, Strategy, Factory, Observer, etc. only where they solve a real problem | Pattern-forcing / over-engineering |
| 7 | **Explain extensibility** | Narrate how the design absorbs new requirements without a rewrite | A design that collapses under the interviewer's follow-up |

```
┌─────────────┐   ┌───────────┐   ┌──────────────┐   ┌────────────────┐
│ 1. Clarify  │──▶│ 2. Entities│──▶│ 3. Relations │──▶│ 4. Responsibil.│
│ requirements│   │  / classes │   │              │   │                │
└─────────────┘   └───────────┘   └──────────────┘   └────────────────┘
                                                              │
      ┌───────────────────────────────────────────────────────┘
      ▼
┌─────────────┐   ┌────────────────┐   ┌──────────────────┐
│ 5. Apply     │──▶│ 6. Apply design│──▶│ 7. Extensibility  │
│    SOLID     │   │    patterns    │   │    story          │
└─────────────┘   └────────────────┘   └──────────────────┘
```

You will walk through this exact loop three times in this phase — once per problem — until it becomes muscle memory.

---

## 3. What You'll Design in This Phase

| Lesson | System | Core Pattern(s) | Core Challenge |
|--------|--------|------------------|-----------------|
| `01-ATM-Machine-Design.md` | ATM Machine | State, Strategy | Modeling device states + PIN auth + cash dispensing |
| `02-Vending-Machine-Design.md` | Vending Machine | State | Modeling states around inventory + partial payment |
| `03-Splitwise-Design.md` | Splitwise (expense splitting) | Strategy | Split algorithms + debt simplification (min cash flow) |

---

## 4. How to Use This Phase

1. Read each lesson **without** looking at the class skeletons first — try to derive the classes and states yourself from the requirements section.
2. Compare your answer to the lesson's step-by-step walkthrough.
3. Work through the "Interview Follow-ups" out loud, as if an interviewer just asked you the question — these are the questions that separate a pass from a strong pass.
4. Only after finishing all three lessons, go implement the full working version in `LLD/Projects/`.

---

**Next:** [01-ATM-Machine-Design.md](./01-ATM-Machine-Design.md)
