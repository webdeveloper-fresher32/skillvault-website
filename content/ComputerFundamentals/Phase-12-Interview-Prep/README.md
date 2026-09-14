# Phase 12 — Interview Prep

## Goal

This is the capstone phase. Instead of introducing new material, it connects everything from Phases 1–11 into a single mental model and drills it into interview-ready recall. By the end of this phase you should be able to walk an interviewer through *why* a piece of code behaves the way it does, tracing the explanation all the way from source code down to bits in memory.

## Why This Phase Exists

Most "computer fundamentals" interview questions are not asked in isolation — they're asked as follow-ups. An interviewer asks about a slow function, and the real test is whether you can chain together: algorithmic complexity → memory access patterns → cache behavior → language runtime overhead. Isolated facts ("two's complement flips bits and adds one") are necessary but not sufficient. This phase builds the connective tissue.

## Files in This Phase

| File | What It Covers |
|------|-----------------|
| `01-Putting-It-All-Together.md` | A synthesis lesson tracing one real scenario — a Python function running slower than expected — through number representation, architecture, memory layout, compilation/interpretation, and Big-O, all at once. |
| `02-Computer-Fundamentals-Rapid-Fire-QA.md` | 25 rapid-fire Q&A pairs covering the entire course, meant for final review the night before an interview. |

## How to Use This Phase

1. Read `01-Putting-It-All-Together.md` slowly — it's short but dense. Don't skim; the value is in seeing the chain of causation, not memorizing the specific example.
2. Use `02-Computer-Fundamentals-Rapid-Fire-QA.md` as a self-test. Cover the answers, say your answer out loud, then check. Anything you hesitate on, go back to the relevant phase.
3. Revisit the `Projects/` directory — being able to *build* a number converter or a stack VM is a stronger signal of understanding than reciting a definition, and interviewers notice the difference in how you explain concepts.

## Prerequisites

All of Phase 01 through Phase 11. This phase assumes you've already read:

- Phase 01 — Number Systems and Data Representation
- Phase 02 — Computer Architecture Basics
- Phase 03 — CPU, Registers, and Cache
- Phase 04 — Assembly Basics
- Phase 05 — The Boot Process
- Phase 06 — Kernel and OS Role
- Phase 07 — Compilers vs Interpreters
- Phase 08 — Bytecode and Virtual Machines
- Phase 09 — Memory Layout of a Program
- Phase 10 — Big-O Notation
- Phase 11 — Time and Space Complexity Analysis

## Time Estimate

45–60 minutes for a first pass, 15–20 minutes for review passes before an interview.
