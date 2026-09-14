# Computer Fundamentals — Complete Learning Course

Understand how computers and software actually work, below the application layer. This course is aimed at engineers who can already ship features but want to close the gap on "how does this actually work under the hood" — the kind of foundational knowledge that separates a mid-level engineer from a senior one, and the kind interviewers probe for when application-level questions run out.

It covers the full stack from raw bits to running programs: how numbers and text are represented in binary, how a CPU actually executes an instruction, why caches and memory hierarchies exist, what a bootloader and kernel do before your code ever runs, how compilers and interpreters turn source code into execution, what a program's memory actually looks like while it runs, and how to reason rigorously about algorithmic efficiency with Big-O.

This course complements the sibling **`OperatingSystems/`** course in this repo. Where `OperatingSystems/` goes deep on OS-specific concepts — processes, threads, scheduling, synchronization, deadlocks, virtual memory, file systems, and Linux internals — `ComputerFundamentals/` covers the layer underneath and around that: hardware/CPU mechanics, number representation, the compilation/execution pipeline, and complexity analysis. Read this course first (or alongside) `OperatingSystems/` for the fullest picture of the systems stack.

---

## Course Structure

```
ComputerFundamentals/
├── Phase-01-Number-Systems-and-Data-Representation/  → Binary, hex, two's complement, IEEE-754, encodings
├── Phase-02-Computer-Architecture-Basics/             → Von Neumann/Harvard, fetch-decode-execute, CISC vs RISC
├── Phase-03-CPU-Registers-and-Cache/                  → Registers, memory hierarchy, cache lines, coherence
├── Phase-04-Assembly-Basics/                          → Assembly mnemonics, registers, syscalls, stack/PC
├── Phase-05-The-Boot-Process/                         → BIOS/UEFI, bootloaders, POST, kernel handoff
├── Phase-06-Kernel-and-OS-Role/                       → Kernel responsibilities, monolithic vs microkernel
├── Phase-07-Compilers-vs-Interpreters/                → Compilation phases, interpretation, transpilation
├── Phase-08-Bytecode-and-Virtual-Machines/             → JVM/CPython bytecode, JIT compilation, process VMs
├── Phase-09-Memory-Layout-of-a-Program/               → Stack, heap, data, BSS, text segments; leaks & GC
├── Phase-10-Big-O-Notation/                           → Big-O/Omega/Theta, common complexity classes
├── Phase-11-Time-and-Space-Complexity-Analysis/       → Recurrence relations, amortized analysis, tradeoffs
├── Phase-12-Interview-Prep/                           → Consolidated review and mock interview questions
├── Quick-Reference/                                   → Cheatsheet + 50 interview Q&A
└── Projects/                                          → Beginner → Advanced hands-on projects
```

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Number Systems & Data Representation | Beginner | 2 days |
| 02 | Computer Architecture Basics | Beginner | 2 days |
| 03 | CPU, Registers & Cache | Intermediate | 3 days |
| 04 | Assembly Basics | Intermediate | 2 days |
| 05 | The Boot Process | Beginner | 1 day |
| 06 | Kernel & OS Role | Intermediate | 2 days |
| 07 | Compilers vs Interpreters | Intermediate | 2 days |
| 08 | Bytecode & Virtual Machines | Intermediate | 2 days |
| 09 | Memory Layout of a Program | Intermediate | 3 days |
| 10 | Big-O Notation | Beginner | 2 days |
| 11 | Time & Space Complexity Analysis | Intermediate | 3 days |
| 12 | Interview Prep | Advanced | 3 days |

**Total estimated time: 4-5 weeks**

---

## Prerequisites

- Comfortable writing code in at least one programming language (any of JavaScript, Python, Java, C, C++, Go).
- Basic command-line familiarity (navigating directories, running scripts).
- No prior background in hardware, compilers, or formal algorithms courses is assumed — this course builds that from the ground up.

---

## How to Use This Course

- Work through the phases roughly in order (01 → 12) — later phases (compilers, bytecode, complexity analysis) build on concepts introduced earlier (memory layout, architecture basics).
- Each phase directory has its own `README.md` summarizing that phase's goals and lesson files — start there before diving into numbered lesson files.
- This is interview-prep-oriented: if you're short on time, prioritize Phase-01 (number systems), Phase-09 (memory layout), Phase-10/11 (Big-O), and Phase-12 (interview prep) — these come up most frequently in technical interviews for full-stack/backend roles.
- Use `Quick-Reference/ComputerFundamentals-Cheatsheet.md` for rapid pre-interview review, and `Quick-Reference/Interview-QA.md` to self-test with 50 practice questions across the full course.
- Work through `Projects/` after finishing the phases to reinforce concepts hands-on rather than purely theoretically.
- Pair this course with `OperatingSystems/` for full-depth systems knowledge — concepts like virtual memory and process scheduling are covered there in detail rather than repeated here.

---

## Projects

| Project | Level | Description |
|---------|-------|-------------|
| Number Base Converter | Beginner | CLI tool converting between binary/hex/decimal/octal |
| Bitwise Flag System | Beginner | Implement a permissions/feature-flag system using bitmasks |
| Simple Stack-Based VM | Intermediate | Build a tiny bytecode interpreter/virtual machine |
| Custom Memory Allocator | Intermediate | Implement a simplified `malloc`/`free` over a fixed byte array |
| Mini Compiler Front-End | Advanced | Lexer + parser + AST for a small arithmetic language |
| Big-O Benchmark Suite | Advanced | Empirically measure and plot runtime growth of classic algorithms |

---

## Quick Reference

```
Quick-Reference/ComputerFundamentals-Cheatsheet.md   # dense, scannable last-minute review
Quick-Reference/Interview-QA.md                      # 50 numbered interview Q&A pairs
```
