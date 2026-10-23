# Phase 04 — Process Synchronization

## Overview

Modern software is concurrent by default — multi-threaded web servers, background job workers, async pipelines. Whenever two or more threads touch shared data at the same time, correctness stops being obvious. This phase builds the mental model for reasoning about concurrent code: what a race condition is, why it happens, and the tools (locks, semaphores) the OS and language runtimes give you to prevent it. This is one of the most heavily asked topics in backend/full-stack interviews — expect to write or debug a race condition live.

## Lessons

| # | File | Topic |
|---|------|-------|
| 01 | [Race Conditions and Critical Sections](./01-Race-Conditions-and-Critical-Sections.md) | What a race condition is, broken-counter example, critical section requirements |
| 02 | [Mutex and Locks](./02-Mutex-and-Locks.md) | Mutual exclusion with locks, fixing the broken counter, deadlock preview |
| 03 | [Semaphores](./03-Semaphores.md) | Counting vs binary semaphores, mutex vs semaphore, producer-consumer with semaphores |
| 04 | [Classic Synchronization Problems](./04-Classic-Synchronization-Problems.md) | Producer-Consumer, Dining Philosophers, Readers-Writers |
| 05 | [Synchronization in Practice](./05-Synchronization-in-Practice.md) | Python GIL, Node.js single-threaded model, database-level locking |

## Time Estimate

| Activity | Time |
|----------|------|
| Reading all 5 lessons | 3 – 4 hours |
| Hands-on exercises (running the Python examples) | 2 – 3 hours |
| Interview Q&A review | 45 – 60 minutes |
| **Total** | **~6 – 8 hours** |

## Prerequisites

Phase 02 (Processes and Threads) — you should understand the difference between a process and a thread, and how threads share memory within a process. Basic Python (functions, loops) is enough to follow every code example; no prior threading experience is assumed.

## What's Next

Phase 05 covers Deadlocks — what happens when synchronization primitives like locks are used incorrectly and multiple threads end up waiting on each other forever.
