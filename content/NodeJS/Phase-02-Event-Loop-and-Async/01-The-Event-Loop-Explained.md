# The Event Loop Explained — Complete Guide

## Table of Contents
1. [Why Node is Single-Threaded but Non-Blocking](#1-why-node-is-single-threaded-but-non-blocking)
2. [libuv — The Engine Under Node](#2-libuv--the-engine-under-node)
3. [Call Stack vs Callback Queue vs Microtask Queue](#3-call-stack-vs-callback-queue-vs-microtask-queue)
4. [The 6 Event Loop Phases](#4-the-6-event-loop-phases)
5. [Full Cycle ASCII Diagram](#5-full-cycle-ascii-diagram)
6. [Concrete Code Example — Execution Order Traced](#6-concrete-code-example--execution-order-traced)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Node is Single-Threaded but Non-Blocking

Node.js runs your JavaScript on **one thread** (the main thread) — there's a single call stack, and only one line of your JS executes at a time. This is the same model as browser JS.

What makes Node *non-blocking* despite being single-threaded is that expensive I/O operations (reading a file, querying a database, making an HTTP request) are **not executed on the main thread**. They're handed off to the operating system (async syscalls like epoll/kqueue/IOCP) or to a background **thread pool**, and your JS code keeps running. When the I/O finishes, a callback is queued to run later on the main thread.

```
Synchronous (blocking) model — Python's default:
  readFile() ──▶ [thread blocked until disk I/O completes] ──▶ next line

Node's non-blocking model:
  readFile(callback) ──▶ [handed to libuv, JS continues immediately]
                                 │
                    (disk I/O happens in background)
                                 │
                                 ▼
                  callback queued ──▶ runs later on main thread
```

**Key takeaway:** Node is single-threaded for *your JavaScript code*, but multi-threaded under the hood for I/O (via libuv's thread pool) and delegates network I/O to the OS kernel's async facilities. This lets one Node process handle thousands of concurrent connections without spawning a thread per connection.

---

## 2. libuv — The Engine Under Node

**libuv** is a C library that gives Node its event loop, thread pool, and async I/O. It abstracts OS differences (epoll on Linux, kqueue on macOS, IOCP on Windows) behind one API.

```
┌───────────────────────────────────────────────────────────┐
│                     Your JavaScript                        │
│              (runs on V8, single thread)                   │
└───────────────────────────┬─────────────────────────────────┘
                             │ calls into
                             ▼
┌───────────────────────────────────────────────────────────┐
│                          libuv                              │
│  ┌─────────────────────┐   ┌────────────────────────────┐  │
│  │   Event Loop         │   │  Thread Pool (default: 4)  │  │
│  │  (single thread)      │   │  for fs, dns.lookup,       │  │
│  │  drives async I/O     │   │  crypto, zlib               │  │
│  │  via OS primitives    │   │                              │  │
│  └─────────────────────┘   └────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
                             │
                             ▼
                   OS Kernel (epoll / kqueue / IOCP)
                   handles actual sockets, files, timers
```

- **Network I/O** (HTTP requests, TCP sockets) uses the OS's native async mechanism — no thread pool needed.
- **File system, DNS lookups, crypto (pbkdf2), zlib** use libuv's **thread pool** (4 threads by default, tunable via `UV_THREADPOOL_SIZE`) because these OS APIs are blocking by nature.

This is why `fs.readFile` (async) doesn't block the main thread even though disk I/O is inherently blocking at the OS level — libuv farms it out to a worker thread.

---

## 3. Call Stack vs Callback Queue vs Microtask Queue

| Structure | What lives here | When it runs |
|-----------|-----------------|---------------|
| **Call Stack** | Currently executing function frames | Immediately, synchronously |
| **Microtask Queue** | `Promise` `.then`/`.catch`/`.finally` callbacks, `process.nextTick` (its own even-higher-priority queue) | After current call stack empties, **before** the next macrotask |
| **Callback/Macrotask Queue** | `setTimeout`, `setImmediate`, I/O callbacks, event loop phase callbacks | Once per event loop phase, after microtasks drain |

```
┌───────────────────┐
│    Call Stack      │  ← runs synchronous code first, always
└─────────┬─────────┘
          │ empties
          ▼
┌───────────────────┐
│ process.nextTick   │  ← highest priority, drains completely first
│      Queue          │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  Microtask Queue    │  ← Promise callbacks, drains completely
│ (Promise .then etc) │     (new microtasks added during drain also run)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  Macrotask/Callback │  ← setTimeout, setImmediate, I/O — ONE task
│      Queue           │     per loop iteration, then back to microtasks
└───────────────────┘
```

**Rule of thumb:** Call stack empties → drain `process.nextTick` → drain all microtasks (Promises) → run **one** macrotask → drain microtasks again → repeat.

---

## 4. The 6 Event Loop Phases

Each iteration ("tick") of the event loop runs through these phases **in order**:

| # | Phase | What runs here |
|---|-------|-----------------|
| 1 | **timers** | Callbacks scheduled by `setTimeout()` and `setInterval()` whose delay has elapsed |
| 2 | **pending callbacks** | I/O callbacks deferred from the previous cycle (some system-level errors, e.g. TCP errors) |
| 3 | **idle, prepare** | Internal use only (libuv housekeeping) — never used directly in app code |
| 4 | **poll** | Retrieves new I/O events; executes I/O-related callbacks (file reads, network data). Node will block here waiting for events if nothing else is scheduled |
| 5 | **check** | `setImmediate()` callbacks run here, immediately after the poll phase |
| 6 | **close callbacks** | `socket.on('close', ...)`, other cleanup callbacks for closed resources |

Between **every** phase transition (and between every individual callback within a phase), Node fully drains the `process.nextTick` queue and then the Promise microtask queue.

---

## 5. Full Cycle ASCII Diagram

```
   ┌───────────────────────────┐
┌─▶│           timers            │  setTimeout / setInterval callbacks due
│  └─────────────┬─────────────┘
│                ▼
│  ┌───────────────────────────┐
│  │      pending callbacks      │  deferred I/O callbacks (e.g. TCP errors)
│  └─────────────┬─────────────┘
│                ▼
│  ┌───────────────────────────┐
│  │        idle, prepare        │  internal only
│  └─────────────┬─────────────┘
│                ▼
│  ┌───────────────────────────┐      incoming connections,
│  │            poll             │◀──── data, file reads, etc.
│  │  (fetch new I/O events;     │
│  │   execute I/O callbacks)    │
│  └─────────────┬─────────────┘
│                ▼
│  ┌───────────────────────────┐
│  │            check            │  setImmediate() callbacks
│  └─────────────┬─────────────┘
│                ▼
│  ┌───────────────────────────┐
│  │       close callbacks       │  socket.on('close'), cleanup
│  └─────────────┬─────────────┘
│                │
└────────────────┘
     (loop repeats — each phase transition drains
      process.nextTick + microtask queues first)
```

---

## 6. Concrete Code Example — Execution Order Traced

```javascript
console.log('1: start');                              // sync

setTimeout(() => console.log('2: setTimeout'), 0);     // → timers phase

setImmediate(() => console.log('3: setImmediate'));    // → check phase

Promise.resolve().then(() => console.log('4: promise'));  // → microtask queue

process.nextTick(() => console.log('5: nextTick'));    // → nextTick queue (highest priority)

console.log('6: end');                                 // sync

/*
Expected output:
1: start
6: end
5: nextTick
4: promise
2: setTimeout      (or 3, order vs setImmediate is non-deterministic at top level)
3: setImmediate

Explanation:
- '1: start' and '6: end' run synchronously on the call stack first.
- Once the stack is empty, process.nextTick queue drains → '5: nextTick'.
- Then the microtask (Promise) queue drains → '4: promise'.
- Only now does the event loop move into its phases:
  timers phase picks up the 0ms setTimeout → '2: setTimeout'
  check phase picks up setImmediate → '3: setImmediate'
- NOTE: setTimeout(fn, 0) vs setImmediate() ordering at the TOP LEVEL of a
  script is not guaranteed — it depends on process startup timing/performance.
  Inside an I/O callback (e.g. within fs.readFile's callback), setImmediate
  ALWAYS fires before setTimeout(fn, 0), because the poll phase transitions
  directly into the check phase.
*/
```

### The "inside I/O callback" case — deterministic ordering

```javascript
const fs = require('fs');

fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});

/*
Output is ALWAYS:
immediate
timeout

Why: the readFile callback runs in the poll phase. Once poll finishes,
the loop moves straight to the check phase (setImmediate) BEFORE
looping back around to the timers phase (setTimeout).
*/
```

---

## 7. Hands-On Exercises

**Exercise 1:** Run the first code example above in Node and confirm the output order. Run it 5 times — note that `setTimeout` vs `setImmediate` order at the top level may flip between runs.

**Exercise 2:** Run the "inside I/O callback" example. Confirm `immediate` always logs before `timeout`, no matter how many times you run it.

**Exercise 3:** Write a script with 3 `setTimeout(fn, 0)` calls, 3 `Promise.resolve().then(fn)` calls, and 2 `process.nextTick(fn)` calls, all interleaved in the source. Predict the output on paper first, then run it and compare.

**Exercise 4:** Use `UV_THREADPOOL_SIZE=1 node script.js` with a script that calls `fs.readFile` on 4 large files simultaneously. Time it, then rerun with `UV_THREADPOOL_SIZE=4`. Observe the speedup — this proves the thread pool is real and finite.

**Exercise 5:** Write a CPU-bound synchronous loop (e.g., a `for` loop counting to 5 billion) and place a `setTimeout(fn, 0)` before it. Observe that the timeout callback does NOT fire until the loop finishes — proving Node is single-threaded for JS execution and the event loop cannot preempt synchronous code.

---

## 8. Interview Q&A

**Q: Is Node.js single-threaded?**
Answer: Node's JavaScript execution is single-threaded — one call stack, one line of your JS runs at a time. But Node itself is not single-threaded: libuv maintains a background thread pool (default 4 threads) for blocking operations like file I/O, DNS lookups, and crypto, and delegates network I/O to the OS kernel's async facilities (epoll/kqueue/IOCP). So "single-threaded" describes your JS code, not the whole runtime.

**Q: What are the phases of the Node.js event loop, in order?**
Answer: timers → pending callbacks → idle/prepare (internal) → poll → check → close callbacks. Timers phase runs due `setTimeout`/`setInterval` callbacks; poll retrieves new I/O events and runs their callbacks; check runs `setImmediate` callbacks; close callbacks handles cleanup like `socket.on('close')`. The loop cycles through these phases repeatedly as long as there's pending work.

**Q: What's the difference between the call stack, the microtask queue, and the macrotask (callback) queue?**
Answer: The call stack holds currently executing synchronous function frames and always runs first. The microtask queue holds Promise callbacks (and `process.nextTick`, which has its own higher-priority queue) and drains completely — including any new microtasks added during the drain — before the event loop proceeds. The macrotask queue holds things like `setTimeout` and `setImmediate` callbacks; only one macrotask runs per loop iteration, after which microtasks are drained again before the next macrotask.

**Q: Why does `setImmediate` fire before `setTimeout(fn, 0)` inside an I/O callback, but the order is unpredictable at the top level?**
Answer: Inside an I/O callback, execution is already in the poll phase; when poll completes, the loop moves directly into the check phase, where `setImmediate` runs, before ever cycling back to the timers phase. At the top level of a script, there's no I/O context — both timers are scheduled for "as soon as possible," and which one the loop reaches first depends on process startup overhead and system timing, making the order non-deterministic.

**Q: What is libuv and why does Node need it?**
Answer: libuv is a C library providing the event loop, a cross-platform abstraction over OS-specific async I/O mechanisms (epoll on Linux, kqueue on macOS, IOCP on Windows), and a thread pool for operations that don't have a native async OS API (file system operations, DNS lookups via `dns.lookup`, some crypto and zlib functions). Node needs it to achieve non-blocking I/O without spawning a thread per connection — it's the core reason Node can handle high concurrency on one thread.

**Q: If Node is non-blocking, why can a long synchronous loop freeze the whole server?**
Answer: Non-blocking I/O only applies to I/O operations handed off to libuv/the OS. Pure synchronous CPU-bound JavaScript (a long loop, heavy JSON parsing, synchronous crypto) still runs on the single main thread and blocks the call stack — no other JS, timers, or I/O callbacks can run until it finishes. This is why CPU-heavy work in Node should be offloaded to worker threads, child processes, or an external service.

**Q: What is the libuv thread pool used for, and how do you resize it?**
Answer: It's used for operations that are blocking at the OS level and lack a native async API: file system calls (`fs.*`), `dns.lookup`, some `crypto` functions (`pbkdf2`, `randomBytes`), and `zlib` compression. Default size is 4 threads; it can be resized (up to 128) by setting the `UV_THREADPOOL_SIZE` environment variable before the process starts. Network I/O (HTTP, TCP) does NOT use this pool — it relies on the OS's native async I/O.
