# Phase 7: Virtual Memory

## What You'll Learn

Phase 6 showed you how the OS maps a process's address space onto physical RAM using paging. This phase asks the next question: what happens when there isn't enough RAM for every page of every process, all the time? The answer is virtual memory — the illusion, given to every process, of a large, private, contiguous address space, backed by a combination of RAM and disk, filled in on demand. You'll learn how page faults work, how the OS decides which pages to evict when RAM is full, what happens when it evicts too aggressively (thrashing), and how memory leaks and garbage collection sit on top of this whole machinery.

## Learning Objectives

- Explain why virtual memory exists and how it gives each process the illusion of a large, private, contiguous address space
- Trace the full page fault handling flow, from a CPU memory access to a page being loaded from disk
- Simulate and compare FIFO, LRU, and Optimal page replacement algorithms on a reference string, and explain Belady's anomaly
- Define thrashing, explain why it happens, and describe the working set model and how the OS detects/mitigates thrashing
- Distinguish memory leaks at the OS/process level from language-level leaks, and explain how reference counting, mark-and-sweep, and generational GC interact with virtual memory

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-What-is-Virtual-Memory.md](01-What-is-Virtual-Memory.md) | Why virtual memory exists, virtual vs physical address space, demand paging | 1 day |
| [02-Page-Replacement-Algorithms.md](02-Page-Replacement-Algorithms.md) | FIFO, LRU, Optimal — worked examples, Belady's anomaly | 1-2 days |
| [03-Thrashing.md](03-Thrashing.md) | What thrashing is, working set model, detection and mitigation | 1 day |
| [04-Memory-Leaks-and-Garbage-Collection.md](04-Memory-Leaks-and-Garbage-Collection.md) | OS vs language-level leaks, reference counting, mark-and-sweep, generational GC | 1 day |

## Estimated Time

4-5 days

## Prerequisites

Phase 6 (Memory Management) — you should be comfortable with pages, frames, and page tables before adding the "demand" and "eviction" pieces on top.

## Next Phase

→ [Phase 8: File Systems and Storage](../Phase-08-File-Systems-and-Storage/README.md)
