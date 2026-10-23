# Phase 02 — Processes and Threads

## Overview

This phase is the heart of most OS interview rounds. You'll learn what a process actually is under the hood (and the Process Control Block that represents it to the kernel), the states a process moves through during its life, how threads differ from processes and from each other, what really happens during a context switch, how isolated processes talk to each other (IPC), and — because it's asked in nearly every interview — a dedicated deep dive on "process vs thread" mapped to real languages like Python and Node.js.

## Lessons

| # | File | Topic |
|---|------|-------|
| 01 | [Processes Explained](./01-Processes-Explained.md) | What a process is, the PCB, process states, `fork()`/`exec()` |
| 02 | [Threads Explained](./02-Threads-Explained.md) | What a thread is, shared vs isolated memory, user vs kernel threads, multithreading trade-offs |
| 03 | [Context Switching](./03-Context-Switching.md) | What gets saved/restored, why it's expensive, what triggers it |
| 04 | [Interprocess Communication](./04-Interprocess-Communication.md) | Pipes, message queues, shared memory, sockets, and their trade-offs |
| 05 | [Process vs Thread — Interview Deep Dive](./05-Process-vs-Thread-Interview-Deep-Dive.md) | Consolidated comparison table + Python multiprocessing/threading + Node's event loop |

## Time Estimate

| Activity | Time |
|----------|------|
| Reading all 5 lessons | 3 – 3.5 hours |
| Hands-on exercises | 2 – 2.5 hours |
| Interview Q&A review | 45 – 60 minutes |
| **Total** | **~6 – 7 hours** |

## Prerequisites

Phase 01 — Introduction to Operating Systems (kernel vs user space, system calls, process memory layout). Comfort reading short Python snippets helps for the hands-on exercises.

## What's Next

Phase 03 builds directly on process states covered here — it explains how the OS decides *which* ready process gets the CPU next (scheduling algorithms).
