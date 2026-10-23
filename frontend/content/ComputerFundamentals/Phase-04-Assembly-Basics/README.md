# Phase 04: Assembly Basics

## Overview

Assembly language is the last stop before raw machine code — the point where "code" and "hardware instructions" are almost the same thing. You will very likely never write production assembly as a full-stack engineer, but being able to *read* a snippet of it removes a lot of mystery from how compilers, debuggers, and profilers work, and it makes concepts like registers, the stack, and function calls concrete instead of abstract.

This phase builds directly on Phase 03 (registers and cache) and sets up Phase 07 (Compilers vs Interpreters), where you'll see how high-level code becomes exactly this kind of instruction stream.

## Why This Matters for Interviews

- Some interviews (especially for lower-level, embedded, performance, or "how does X actually work" rounds) ask you to read a small assembly snippet and explain what it does.
- Understanding assembly demystifies stack traces, segmentation faults, and "undefined behavior" bugs.
- It's a strong signal of engineering depth — you don't need to write assembly, but being unfazed by it stands out.

## What You'll Learn

| # | Lesson | Key Takeaway |
|---|--------|---------------|
| 01 | What is Assembly Language | Assembly as a thin, human-readable layer over machine code; registers, instructions, opcodes |
| 02 | Reading Simple Assembly | Mapping small `mov`/`add`/`jmp`/`cmp` snippets to equivalent C/Python-like pseudocode |
| 03 | From High-Level Code to Assembly | A conceptual walkthrough of how a small function compiles down to instructions |

## Files in This Phase

```
Phase-04-Assembly-Basics/
├── README.md
├── 01-What-is-Assembly-Language.md
├── 02-Reading-Simple-Assembly.md
└── 03-From-High-Level-Code-to-Assembly.md
```

## Prerequisites

- Phase 02: Computer Architecture Basics
- Phase 03: CPU Registers and Cache

## Time Estimate

2–3 hours (reading + hands-on exercises)

## Next Phase

Phase 05: The Boot Process — how a computer goes from "power button pressed" to "operating system running," using the same low-level building blocks covered here.
