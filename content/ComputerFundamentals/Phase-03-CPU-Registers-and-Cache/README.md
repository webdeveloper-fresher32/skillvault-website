# Phase 03: CPU Registers and Cache

## Overview

Before you can reason about why some code is fast and other code is slow, you need to understand what happens *inside* the CPU when your program runs. This phase peels back one layer of the stack from Phase 02 (Computer Architecture Basics) and looks specifically at the CPU's fastest storage — registers — and the layers of caching that sit between the CPU and main memory.

This is the phase where "why is this loop slow even though it does the same number of operations?" starts to have a real answer.

## Why This Matters for Interviews

- System design and performance interviews often probe whether you understand *why* certain data structures or access patterns are fast (arrays vs linked lists, row-major vs column-major traversal).
- "Cache-friendly code" and "cache misses" are common phrases in performance-focused interviews, especially for backend/infra roles.
- Understanding the memory hierarchy is foundational for later phases (Memory Layout of a Program, Big-O in practice, and real-world time complexity discussions).

## What You'll Learn

| # | Lesson | Key Takeaway |
|---|--------|---------------|
| 01 | Registers Explained | What registers are, the common types (PC, IR, general-purpose, SP), and why they're the fastest storage in a computer |
| 02 | The Memory Hierarchy | How storage is layered from registers → cache → RAM → disk, trading size for speed |
| 03 | Cache Locality and Performance | Temporal/spatial locality, and a concrete before/after example of cache-friendly vs cache-unfriendly code |

## Files in This Phase

```
Phase-03-CPU-Registers-and-Cache/
├── README.md
├── 01-Registers-Explained.md
├── 02-The-Memory-Hierarchy.md
└── 03-Cache-Locality-and-Performance.md
```

## Prerequisites

- Phase 02: Computer Architecture Basics (CPU, ALU, control unit, buses)

## Time Estimate

2–3 hours (reading + hands-on exercises)

## Next Phase

Phase 04: Assembly Basics — where registers stop being an abstract concept and become the actual operands of real instructions.
