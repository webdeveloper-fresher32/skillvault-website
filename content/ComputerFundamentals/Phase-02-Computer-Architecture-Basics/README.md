# Phase 02 — Computer Architecture Basics

## Why This Phase Exists

Phase 01 covered how data is *represented* as bits. This phase covers what actually *processes* those bits: the CPU, memory, and the fetch-decode-execute cycle that runs every program you've ever written, from a Python script to a React component to a database engine. This is still below the OS layer — we're looking at the hardware and the raw execution model, not processes, threads, or scheduling (covered in the sibling `OperatingSystems/` course).

Understanding this layer demystifies things full-stack engineers use daily without thinking about: why clock speed alone doesn't determine performance, why compiled languages are generally faster than interpreted ones, what "machine code" actually is, and what your code becomes by the time it actually runs.

## What You'll Learn

| # | Lesson | Core Question |
|---|--------|----------------|
| 01 | Von Neumann Architecture | What are the fundamental parts of a computer, and how do they talk to each other? |
| 02 | CPU Components | What's inside the CPU itself, and what do terms like "clock speed," "RISC," and "CISC" actually mean? |
| 03 | How a Program Actually Runs | From the code you write to the electrons moving in the CPU — what really happens? |

## Prerequisites

Phase 01 (Number Systems and Data Representation) — this phase assumes you're comfortable with binary and hex, since machine instructions and memory addresses are expressed in those terms.

## How to Study This Phase

1. Focus on the ASCII diagrams — architecture concepts are inherently spatial/structural, and the diagrams are meant to be traced with your finger, not just read.
2. Lesson 03's worked trace is the payoff of this phase — don't skip to it before understanding Lessons 01–02, since it assumes you know what fetch-decode-execute and registers are.
3. Connect each concept back to something you already know: e.g., "the bus" is like an API contract between CPU and memory; "clock cycles" are like a metronome the whole CPU marches to.

## Outcomes

By the end of this phase you will be able to:
- Draw and explain the Von Neumann architecture (CPU, memory, I/O, bus) from memory.
- Explain the fetch-decode-execute cycle step by step.
- Explain what the ALU, control unit, and registers each do, and why clock speed alone is a poor performance metric.
- Explain the difference between CISC and RISC instruction sets at a high level.
- Trace, instruction by instruction, how a tiny program moves through fetch-decode-execute — connecting source code to compiled/interpreted machine instructions to actual CPU execution.

Previous: [Phase 01 — Number Systems and Data Representation](../Phase-01-Number-Systems-and-Data-Representation/README.md)
