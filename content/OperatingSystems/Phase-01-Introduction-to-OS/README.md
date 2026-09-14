# Phase 01 — Introduction to Operating Systems

## Overview

This phase builds the mental model you need before diving into processes, memory, concurrency, and I/O in later phases. You'll learn what an OS actually *does*, the different flavors of OS you'll encounter in interviews and in the wild, how a running program asks the kernel for help, and a first look at how memory is laid out for a process — the foundation for stack/heap questions that come up constantly in interviews.

## Lessons

| # | File | Topic |
|---|------|-------|
| 01 | [What is an Operating System](./01-What-is-an-Operating-System.md) | OS as resource manager & hardware abstraction, kernel vs user space, system calls, monolithic vs microkernel |
| 02 | [Types of Operating Systems](./02-Types-of-Operating-Systems.md) | Batch, time-sharing, real-time, distributed OS |
| 03 | [OS Structure and System Calls](./03-OS-Structure-and-System-Calls.md) | Syscall mechanism, user mode ↔ kernel mode transition, worked example |
| 04 | [Stack vs Heap and Program Memory Basics](./04-Stack-vs-Heap-and-Program-Memory-Basics.md) | Process memory layout: text, data, heap, stack |

## Time Estimate

| Activity | Time |
|----------|------|
| Reading all 4 lessons | 2.5 – 3 hours |
| Hands-on exercises | 1.5 – 2 hours |
| Interview Q&A review | 30 – 45 minutes |
| **Total** | **~4.5 – 6 hours** |

## Prerequisites

None — this is the starting phase of the Operating Systems course. Basic familiarity with running commands in a terminal and reading small C or Python snippets is helpful but not required.

## What's Next

Phase 02 builds on this foundation to cover processes and threads in depth — process states, context switching, and the process control block.
