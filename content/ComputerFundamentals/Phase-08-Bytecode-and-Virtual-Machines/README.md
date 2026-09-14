# Phase 08: Bytecode and Virtual Machines

## Overview

Once you understand the compilation pipeline (Phase 07), the natural next question is: what does Python actually run when you type `python script.py`? What does `java MyClass` actually execute? The answer in both cases is **bytecode** — a compact, portable intermediate representation that runs on a **virtual machine** rather than directly on the CPU.

This phase builds directly on Phase 07's compilation pipeline: bytecode is simply a different code-generation target — instead of emitting native machine code for one specific CPU, the compiler emits instructions for an abstract, portable machine.

## Goals

By the end of this phase, you should be able to:
- Define bytecode as an intermediate representation and explain why it enables "write once, run anywhere" portability.
- Explain the relationship between bytecode and the virtual machine that interprets/executes it.
- Use Python's built-in `dis` module to disassemble a function and read real CPython bytecode instructions.
- Give an interview-level overview of the JVM (bytecode + JIT) and briefly explain how the same model generalizes to other runtimes like the .NET CLR.

## Files

| File | Topic |
|------|-------|
| `01-What-is-Bytecode.md` | Bytecode as an intermediate representation, portability, virtual machines |
| `02-Python-Bytecode-with-dis.md` | Hands-on: disassembling Python functions with `dis`, reading real bytecode |
| `03-The-JVM-and-Other-VMs-Briefly.md` | JVM overview (bytecode + JIT), generalizing to CLR and other runtimes |

## Prerequisites

Phase 07 (Compilers vs Interpreters) — especially the compilation pipeline and JIT concepts. Python 3 installed locally (for the hands-on `dis` exercises).

## Time Estimate

2-3 hours (reading + hands-on exercises).
