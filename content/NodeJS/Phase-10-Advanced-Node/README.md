# Phase 10 — Advanced Node

## Overview

A single Node.js process runs your JavaScript on one thread. That's fine for I/O-bound work (the event loop shines there), but it means one process can only ever use one CPU core, and any CPU-heavy computation blocks every other request until it finishes. This phase covers how production Node services get around both limits: the `cluster` module to use every core on the box, `worker_threads` to run genuinely CPU-bound code without blocking the event loop, Redis-backed caching to avoid repeating expensive database work, memory profiling to find and fix the leaks that eventually kill a long-running process, and rate limiting/job queues to keep a service responsive under load instead of falling over. This is the material that separates "I built a CRUD API" from "I can run this in production."

## Files in This Phase

| File | Topic |
|------|-------|
| `01-Clustering-and-the-Cluster-Module.md` | Single-threaded event loop recap, the `cluster` module, forking one worker per CPU core, load balancing across workers |
| `02-Worker-Threads.md` | `worker_threads` vs `cluster` vs `child_process`, offloading CPU-bound work, message passing between main thread and worker |
| `03-Caching-with-Redis.md` | Why caching matters, Redis from Node with `ioredis`, cache-aside pattern, TTL, caching a database query |
| `04-Performance-Profiling-and-Memory-Leaks.md` | `--inspect` and Chrome DevTools, common Node memory leak patterns, how to spot and fix them |
| `05-Rate-Limiting-and-Queues.md` | In-memory vs Redis-backed rate limiting, background job queues with Bull/BullMQ, sync vs queued work |

## Prerequisites

- Phase 01–02: Node fundamentals and the event loop — this phase assumes you're comfortable with the event loop model and can explain why Node is single-threaded.
- Phase 06: Databases — the caching lesson caches real database query results.
- Phase 08: Error handling — production-grade clustering and queues need the same operational-error discipline.

## What You Should Be Able to Do After This Phase

- Explain why Node.js is single-threaded and how that shapes its performance characteristics.
- Fork a worker per CPU core with the `cluster` module and understand how the master distributes incoming connections.
- Decide between `cluster`, `worker_threads`, and `child_process` for a given workload, and offload CPU-bound work to a worker thread without blocking the event loop.
- Implement the cache-aside pattern with Redis, including TTL and cache invalidation, to cut down on repeated database work.
- Use `--inspect` with Chrome DevTools to profile a running Node process, and recognize the code patterns (unbounded caches, dangling event listeners, closures) that cause memory leaks.
- Implement rate limiting both in-memory and with Redis, and decide when work belongs in a background job queue instead of the request/response cycle.

---

Next: **Phase 11** — Realtime and Microservices (WebSockets, message queues, service-to-service communication).
