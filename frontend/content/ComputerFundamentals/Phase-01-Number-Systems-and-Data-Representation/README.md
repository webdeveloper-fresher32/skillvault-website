# Phase 01 — Number Systems and Data Representation

## Why This Phase Exists

Every abstraction you use as a full-stack engineer — a JSON `true`, a JavaScript `NaN`, a `char` in Java, a UUID, a hex color code `#FF5733` — is, underneath, a pattern of bits. This phase builds the foundation for everything else in this course: how numbers, text, and fractions are actually stored in memory, and why that occasionally causes bugs (floating-point rounding, integer overflow, encoding mismatches) that trip up even experienced engineers.

This is **below the OS layer**. We are not talking about processes or files yet — just: what is a bit, what is a byte, and how do we represent the information you work with every day using only 0s and 1s.

## What You'll Learn

| # | Lesson | Core Question |
|---|--------|----------------|
| 01 | Binary and Hexadecimal | How do computers represent numbers with only two symbols, and why do we use hex as shorthand? |
| 02 | Two's Complement and Signed Numbers | How does a computer represent `-5` using only 0s and 1s? |
| 03 | Floating-Point Representation | Why does `0.1 + 0.2 != 0.3` in nearly every programming language? |
| 04 | Character Encoding | How does a byte become the letter "A" or the emoji "🚀"? |

## Prerequisites

None — this is the ground floor. Basic comfort with arithmetic and any one programming language (examples use Python) is all you need.

## How to Study This Phase

1. Read each lesson top to bottom — don't skip the worked examples, do the conversions by hand before checking the answer.
2. Run every Python snippet yourself. Typing `0.1 + 0.2` into a REPL and seeing `0.30000000000000004` is more convincing than reading about it.
3. Complete the Hands-On Exercises at the end of each lesson before moving to the next lesson.
4. Use the Interview Q&A sections as a final review pass — these are the exact style of questions asked in full-stack/backend interviews to test fundamentals.

## Outcomes

By the end of this phase you will be able to:
- Convert confidently between binary, decimal, and hexadecimal by hand.
- Perform and reason about bitwise operations (`AND`, `OR`, `XOR`, shifts) — used constantly in flags, permissions, and low-level optimizations.
- Explain how negative numbers and overflow work in fixed-width binary (two's complement).
- Explain why floating-point arithmetic is imprecise, and know the standard mitigations (epsilon comparison, decimal types, integer cents).
- Explain the difference between ASCII, Unicode, and UTF-8/UTF-16, and debug real-world "mojibake" / encoding bugs.

Next: [Phase 02 — Computer Architecture Basics](../Phase-02-Computer-Architecture-Basics/README.md)
