# Phase 09 — I/O Systems

## Why This Phase Matters

Every full-stack engineer eventually asks: "why is Node.js good at handling thousands of concurrent connections with one thread?" or "why does Python need `asyncio` instead of just using threads?" The answer lives entirely in this phase — how the OS talks to hardware, and the three fundamental models (blocking, non-blocking, asynchronous) an application can use to do I/O.

This phase connects operating-systems theory directly to tools you already use every day: Node's event loop, Python's `asyncio`, and the `epoll`/`kqueue` syscalls that power both.

## What You'll Learn

| # | Lesson | Core Question Answered |
|---|--------|------------------------|
| 01 | I/O Hardware and Device Drivers | How does software talk to a physical disk or network card? |
| 02 | Blocking vs Non-Blocking vs Async I/O | What actually happens (thread state, syscalls) in each I/O model? |
| 03 | I/O Multiplexing (select/poll/epoll) | How does one thread monitor thousands of sockets at once? |

## Prerequisites

- Phase-02 (Processes and Threads) — you should know what a thread and a context switch are.
- Phase-04 (Process Synchronization) — helpful but not required.

## How to Study This Phase

1. Read lessons in order — 02 and 03 build directly on the vocabulary introduced in 01.
2. Don't skip the ASCII diagrams — I/O models are about *timing and control flow*, and diagrams make the difference between blocking/non-blocking/async concrete in a way prose can't.
3. If you use Node.js or Python day-to-day, pay close attention to the cross-references in lessons 02 and 03 — this phase directly explains mechanisms you rely on without realizing it (see also `NodeJS/Phase-02-Event-Loop-and-Async` in this repo).
4. Do the hands-on exercises — several use `strace`/`dtrace` or small scripts to *observe* blocking vs non-blocking behavior directly, which cements the concept far better than reading alone.

## Files in This Phase

```
Phase-09-IO-Systems/
├── README.md
├── 01-IO-Hardware-and-Device-Drivers.md
├── 02-Blocking-vs-Non-Blocking-IO.md
└── 03-IO-Multiplexing.md
```
