# Phase 09: Memory Layout of a Program

## Why This Phase Matters

Every program you've ever run — a Python script, a Node server, a compiled C binary — lives inside a process with a very specific, well-organized chunk of memory. Understanding this layout explains *why* recursion blows the stack, *why* `malloc` and garbage collection exist, *why* a "dangling pointer" is dangerous, and *why* Python passes arguments the way it does. These are classic interview topics for engineers who claim to understand what happens "under the hood," even if you write JavaScript or Python all day.

This phase builds a mental model from the ground up: what a process's address space looks like, how the stack and heap behave differently, and how pointers/references tie it all together — grounded in both C (for the low-level mechanics) and Python (since that's likely your daily language).

## What You'll Learn

| # | Lesson | Core Idea |
|---|--------|-----------|
| 01 | Program Memory Segments | The five segments of a process's address space: text, data, BSS, heap, stack |
| 02 | The Stack in Detail | Stack frames, call/return mechanics, and why deep recursion overflows the stack |
| 03 | The Heap and Dynamic Memory | Dynamic allocation, manual memory management vs garbage collection, dangling pointers |
| 04 | Pointers and References | What a pointer really is, and Python's pass-by-object-reference model |

## Prerequisites

- Phase 04 (Assembly Basics) — helpful for understanding registers like the stack pointer, but not required.
- Basic familiarity with Python and/or C syntax (no expert-level knowledge needed).

## How to Study This Phase

1. Read each lesson in order — the segments lesson sets up vocabulary the others rely on.
2. Actually run the Python code examples yourself. Seeing a real `RecursionError` traceback is more memorable than reading about one.
3. Do the Hands-On Exercises at the end of each lesson before moving on.
4. Use the Interview Q&A sections as flash cards during interview prep — read the question, answer out loud, then check yourself.

## Time Estimate

Roughly 3–4 hours total, including exercises.

---

Next phase: **Phase-10-Big-O-Notation**
