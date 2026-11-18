# Node.js Internals & Architecture – Senior Interview Revision Handbook

> Module 2 of the Senior Node.js Developer Interview Revision Handbook.
> Available interactively in the web application under the **[Quick References](/quick-references)** tab.

---

## Table of Contents

### Category A: Node.js Fundamentals and Architecture
1. [What is Node.js?](#1-what-is-nodejs)
2. [Node.js Architecture](#2-nodejs-architecture)
3. [V8 JavaScript Engine](#3-v8-javascript-engine)
4. [libuv](#4-libuv)
5. [Single-threaded Event Loop](#5-single-threaded-event-loop)

### Category B: Event Loop and Asynchronous Execution
6. [Event Loop Phases](#6-event-loop-phases)
7. [Microtasks and Macrotasks](#7-microtasks-and-macrotasks)
8. [process.nextTick()](#8-processnexttick)
9. [setImmediate()](#9-setimmediate)
10. [setTimeout()](#10-settimeout)
11. [Blocking vs Non-blocking Operations](#11-blocking-vs-non-blocking-operations)
12. [Synchronous vs Asynchronous APIs](#12-synchronous-vs-asynchronous-apis)

### Category C: Concurrency and Parallelism
13. [Worker Threads](#13-worker-threads)
14. [Cluster Module](#14-cluster-module)
15. [Child Processes](#15-child-processes)
- *[Comparison Table: Worker Threads vs Cluster vs Child Processes](#concurrency-comparison-table)*

### Category D: Data Handling and Core Modules
16. [Streams (Readable, Writable, Duplex, Transform, Backpressure)](#16-streams)
17. [Buffers](#17-buffers)
18. [EventEmitter](#18-eventemitter)
19. [File System (fs) Module](#19-file-system-fs-module)
20. [Process and Environment Variables](#20-process-and-environment-variables)

### Category E: Memory Management and Performance
21. [Memory Management (Stack vs Heap, V8 Spaces)](#21-memory-management)
22. [Garbage Collection (Scavenge vs Mark-Sweep-Compact)](#22-garbage-collection)
23. [Memory Leaks and Heap Snapshots](#23-memory-leaks-and-heap-snapshots)
24. [CPU-intensive vs I/O-intensive Workloads](#24-cpu-intensive-vs-io-intensive-workloads)

---

## 1. What is Node.js?
- **30 Seconds:** Open-source, cross-platform JavaScript runtime built on Chrome's V8 engine and libuv. It executes JS outside the browser using an event-driven, non-blocking I/O model designed for high-throughput, low-latency network applications.
- **Internals:** NOT a framework or language. C++ runtime pairing V8 (JS execution/heap) with libuv (event loop, OS socket demultiplexing, and worker thread pool).
- **Key Senior Takeaway:** JavaScript is single-threaded; the Node.js runtime is multi-threaded.

---

## 2. Node.js Architecture
- **30 Seconds:** Layered architecture: JS Application Code -> Node Core JS Library -> C++ Bindings -> V8 & libuv -> Operating System Kernel.
- **Internals & Dispatching:**
  - *Main Thread:* User JS, JSON parsing, business logic.
  - *OS Non-blocking (epoll/kqueue/IOCP):* Network TCP/UDP sockets, incoming HTTP.
  - *libuv Thread Pool:* File I/O (`fs.*`), DNS lookups (`dns.lookup`), crypto (`pbkdf2`, `randomBytes`), compression (`zlib`).
- **Key Senior Takeaway:** Network I/O does NOT use the thread pool!

---

## 3. V8 JavaScript Engine
- **30 Seconds:** Google's open-source C++ engine. Parses JS into an AST, interprets bytecode via Ignition, compiles hot code into native machine code via TurboFan, and manages Heap allocations.
- **Internals:** Uses Hidden Classes (Shapes) and Inline Caching (IC). Objects initialized with identical property order share shapes. Using `delete obj.prop` forces dictionary mode and triggers de-optimizations.

---

## 4. libuv
- **30 Seconds:** Cross-platform C library providing asynchronous I/O abstractions, the 6-phase Event Loop, OS socket polling, and the background worker thread pool (`UV_THREADPOOL_SIZE`, default 4, max 1024).
- **Internals:** Unifies Linux `epoll`, macOS `kqueue`, and Windows `IOCP`. Handles blocking file and crypto tasks on worker threads.

---

## 5. Single-threaded Event Loop
- **30 Seconds:** Concurrency model implementing the Reactor Pattern. Handles thousands of concurrent connections on one thread by registering sockets with the OS kernel and executing callbacks sequentially when data arrives.
- **Key Senior Takeaway:** 50,000 idle connections consume only socket file descriptors (~150MB RAM), avoiding the 50GB RAM cost of thread-per-request architectures (like traditional Tomcat).

---

## 6. Event Loop Phases
- **The 6 Phases in Exact Order:**
  1. **Timers:** `setTimeout` and `setInterval`.
  2. **Pending Callbacks:** Deferred system/I/O errors (e.g. `ECONNREFUSED`).
  3. **Idle, Prepare:** Internal libuv housekeeping.
  4. **Poll:** Retrieves new I/O events, reads socket buffers, executes I/O callbacks.
  5. **Check:** `setImmediate()` callbacks.
  6. **Close Callbacks:** `socket.on('close')`.
- **Key Senior Rule:** Inside any I/O callback, `setImmediate()` ALWAYS runs before `setTimeout(fn, 0)` because the Check phase immediately follows the Poll phase.

---

## 7. Microtasks and Macrotasks
- **Priority Pipeline:** Synchronous Call Stack -> `process.nextTick` Queue -> Promise Microtask Queue -> Next Event Loop Macrotask.
- **Key Senior Rule:** In Node.js 11+, the microtask queue drains after EVERY single individual callback on the call stack.

---

## 8. process.nextTick()
- **30 Seconds:** Runs immediately upon completion of the active call stack frame, before the event loop advances to any phase.
- **Use Cases:** Emitting events in constructors after caller attaches listeners; normalizing APIs to be consistently asynchronous (preventing Zalgo).
- **Hazard:** Recursive `process.nextTick()` completely starves the Event Loop.

---

## 9. setImmediate()
- **30 Seconds:** Executes in the Check Phase immediately following the Poll Phase.
- **Use Cases:** Cooperative multitasking—chunking heavy loops across event loop turns so the server can service incoming HTTP traffic between chunks.

---

## 10. setTimeout()
- **30 Seconds:** Registers a callback in libuv's timer min-heap to run after a MINIMUM threshold of milliseconds.
- **Key Senior Rules:** Delays are minimums, not guarantees; 0ms is clamped to 1ms; `timer.unref()` allows the process to exit without waiting for the timer.

---

## 11. Blocking vs Non-blocking Operations
- **30 Seconds:** Blocking operations freeze the single main thread and halt the event loop. Non-blocking operations register handlers with the kernel/libuv and yield control immediately.
- **Key Senior Rule:** CPU-heavy synchronous JavaScript (e.g. catastrophic regex ReDoS or parsing 50MB JSON) blocks the event loop just as severely as synchronous file I/O!

---

## 12. Synchronous vs Asynchronous APIs
- **Production Rule:** Synchronous APIs (`fs.readFileSync`, `crypto.pbkdf2Sync`) are acceptable ONLY during initial server bootstrap before `server.listen()`. Calling them inside request handlers is a fatal architectural defect.

---

<a id="concurrency-comparison-table"></a>
## Concurrency Comparison Table: Worker Threads vs Cluster vs Child Processes

| Feature | Worker Threads (`node:worker_threads`) | Cluster Module (`node:cluster`) | Child Processes (`node:child_process`) |
| :--- | :--- | :--- | :--- |
| **Process / Thread** | Multiple threads in **1 OS Process (1 PID)** | Multiple **OS Processes (Multiple PIDs)** | Completely independent **OS Processes** |
| **V8 Instances** | Separate V8 Isolate per thread | Separate V8 Instance per process | Separate V8 (for `fork`) or external binary |
| **Memory Model** | Shared process RAM; `SharedArrayBuffer` | Completely **Isolated memory** | Completely **Isolated memory** |
| **Communication** | `MessagePort` / `SharedArrayBuffer` | IPC socket handoff / IPC messages | `stdin`/`stdout` streams or IPC (`fork`) |
| **Port Sharing** | No native port sharing | **Shares identical TCP port** | No native port sharing (must proxy/bind different ports) |
| **Primary Use Case** | **CPU-bound JavaScript compute** (PDFs, hashing) | **Scaling HTTP servers** across CPU cores | **Executing external binaries** (Python, FFmpeg, Bash) |

---

## 16. Streams
- **4 Types:** Readable, Writable, Duplex, Transform.
- **Backpressure:** When writable buffer hits `highWaterMark` (default 64KB for binary, 16 for objectMode), `write()` returns `false` -> readable pauses -> writable drains -> emits `"drain"` -> readable resumes.
- **Production Standard:** Always use `stream.pipeline()` instead of `.pipe()` to guarantee proper error forwarding and automatic stream destruction.

---

## 17. Buffers
- **30 Seconds:** Fixed-size chunks of raw binary data allocated in native C++ memory outside the V8 heap. Subclass of `Uint8Array`.
- **Security Rule:** Always use `Buffer.alloc()` (zero-filled); avoid `Buffer.allocUnsafe()` in APIs to prevent leaking uninitialized stale RAM bytes.

---

## 18. EventEmitter
- **30 Seconds:** Observer pattern implementation in `node:events`. All streams and sockets inherit from it.
- **Key Traps:**
  1. Listeners execute **SYNCHRONOUSLY** in registration order.
  2. Emitting an `"error"` event without an attached listener **CRASHES the process**.
  3. Default 10 listener limit warns against memory leaks.

---

## 19. File System (fs) Module
- **30 Seconds:** Core file operations via `node:fs/promises`. Runs on libuv worker threads, not OS epoll.
- **Production Rules:** Always close `FileHandle` instances in `finally` blocks to prevent `EMFILE: too many open files` errors; protect against Directory Traversal with `path.resolve()`.

---

## 20. Process and Environment Variables
- **30 Seconds:** Global process control, environment variables, memory diagnostics, and OS signals.
- **Traps & Standards:**
  - `process.env` values are ALWAYS coerced to strings (`process.env.FLAG = false` is TRUTHY!).
  - Intercept `SIGTERM` and `SIGINT` to execute Graceful Shutdowns in Docker/Kubernetes.

---

## 21. Memory Management
- **Stack vs Heap:** Stack = LIFO primitives and call frames (fast); Heap = dynamic objects, closures, arrays (GC managed).
- **V8 Heap Spaces:** New Space (Nursery + Intermediate), Old Pointer Space, Old Data Space, Large Object Space, Code Space.
- **Default 64-bit Heap Limit:** ~1.4GB to 2GB. Increase via `node --max-old-space-size=4096 app.js`.

---

## 22. Garbage Collection
- **Minor GC (Scavenger):** Operates on New Space semi-spaces ("From" and "To"). Fast (1–2ms). Surviving objects promoted to Old Space.
- **Major GC (Mark-Sweep-Compact):** Runs on Old Space. Marks live roots, sweeps dead memory, compacts pages to eliminate fragmentation.
- **Orinoco:** V8's concurrent, parallel, and incremental GC eliminating Stop-the-World pauses.

---

## 23. Memory Leaks and Heap Snapshots
- **Top 4 Causes:** Unbounded in-memory caches, forgotten `setInterval`, unremoved `EventEmitter` listeners, accidental global variables.
- **Diagnostics:** Capture heap snapshots via `v8.getHeapSnapshot()` or Chrome DevTools. Sort by **Retained Size** (total memory freed if the object is collected). Use `lru-cache` or `WeakMap` for prevention.

---

## 24. CPU-intensive vs I/O-intensive Workloads
- **Rule:** Node.js excels at I/O workloads (95% waiting) and suffers on CPU workloads (single thread blocked).
- **Myth Busted:** Wrapping synchronous CPU math inside `new Promise()` or an `async` function does NOT make it asynchronous—it still runs synchronously on the main thread!
- **Architecture Solutions:** Worker Threads (Piscina), Background Job Queues (BullMQ + Redis), or Go/Rust microservices.
