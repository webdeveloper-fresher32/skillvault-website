# Phase 10 — Concurrency in Practice

## Why This Phase Exists

Phases 1–9 covered concurrency and synchronization from the **operating system's** point of view: processes, threads, schedulers, locks, deadlocks. This phase bridges that theory to what you actually touch as a full-stack engineer — **Python's Global Interpreter Lock** and **Node.js's single-threaded event loop**. Both are runtime-level decisions built on top of OS primitives (threads, processes) from earlier phases, and both come up constantly in interviews for backend/full-stack roles.

By the end of this phase, you should be able to explain, with working code, why `threading` doesn't speed up a CPU-bound Python function, why Node.js doesn't need thread pools to serve thousands of concurrent connections, and how to pick the right concurrency tool for a given workload in either ecosystem.

---

## What You'll Learn

| # | Lesson | Core Question |
|---|--------|----------------|
| 01 | [Python's GIL Explained](01-Pythons-GIL-Explained.md) | Why can only one thread run Python bytecode at a time? |
| 02 | [Threading vs Multiprocessing in Python](02-Threading-vs-Multiprocessing-in-Python.md) | Given a task, threads or processes — and how do I write either? |
| 03 | [Node.js Concurrency Model](03-Nodejs-Concurrency-Model.md) | How does a single thread serve thousands of clients — and when isn't that enough? |
| 04 | [Choosing the Right Concurrency Model](04-Choosing-the-Right-Concurrency-Model.md) | Given a workload, which language/tool/model actually fits? |

---

## Prerequisites

- **Phase-02-Processes-and-Threads** — process vs thread, context switching cost.
- **Phase-03-CPU-Scheduling** — how the OS scheduler picks what runs next.
- **Phase-04-Process-Synchronization** — locks, mutexes, race conditions.

## Cross-References in This Repo

- `NodeJS/Phase-02-Event-Loop-and-Async/01-The-Event-Loop-Explained.md` — the deep dive on libuv's phases, microtasks vs macrotasks.
- `NodeJS/Phase-10-Advanced-Node/01-Clustering-and-the-Cluster-Module.md` and `02-Worker-Threads.md` — full, hands-on treatment of scaling Node beyond one thread.

This phase deliberately keeps the Node.js content to a **recap + decision-making layer**; go to the NodeJS course for line-by-line libuv mechanics.

---

## Time Estimate

~4-6 hours (reading + running every code sample yourself).

## How to Study This Phase

1. Don't just read the Python code — **run it**. The GIL is one of those topics where the "aha" moment comes from watching a `time.sleep`-free CPU loop *not* get faster with threads on your own machine.
2. For lesson 03, keep the NodeJS course open in a second tab/window — the cross-references assume you'll jump over for depth.
3. Finish with lesson 04's decision table and try to reconstruct it from memory — that table is effectively a distilled interview answer.
