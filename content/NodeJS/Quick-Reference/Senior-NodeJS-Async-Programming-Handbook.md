# Asynchronous Programming – Senior Node.js Interview Revision Handbook

> Module 3 of the Senior Node.js Developer Interview Revision Handbook.
> Available interactively in the web application under the **[Quick References](/quick-references)** tab.

---

## Table of Contents

### Category A: Asynchronous Programming Fundamentals
1. [Synchronous vs Asynchronous Execution](#1-synchronous-vs-asynchronous-execution)
2. [Callbacks](#2-callbacks)
3. [Callback Hell](#3-callback-hell)

### Category B: Promises
4. [Promises](#4-promises)
5. [Promise Lifecycle](#5-promise-lifecycle)
6. [Promise Chaining](#6-promise-chaining)
7. [async / await](#7-async--await)

### Category C: Promise Combinators
8. [Promise.all()](#8-promiseall)
9. [Promise.allSettled()](#9-promiseallsettled)
10. [Promise.race()](#10-promiserace)
11. [Promise.any()](#11-promiseany)
- *[Comparison Table: Promise Combinators](#promise-combinators-comparison-table)*

### Category D: Error Handling
12. [Error Handling with try/catch](#12-error-handling-with-trycatch)

### Category E: Concurrency and Execution Control
13. [Sequential vs Parallel Execution](#13-sequential-vs-parallel-execution)
14. [Promise Concurrency Limits](#14-promise-concurrency-limits)

### Category F: Advanced Asynchronous Problems
15. [Race Conditions](#15-race-conditions)
16. [Deadlocks](#16-deadlocks)

### Category G: Cancellation and Resilience
17. [Cancellation with AbortController](#17-cancellation-with-abortcontroller)
18. [Retry Mechanisms](#18-retry-mechanisms)
19. [Exponential Backoff](#19-exponential-backoff)

---

## 1. Synchronous vs Asynchronous Execution
- **30 Seconds:** Synchronous code executes sequentially on V8 single call stack, halting further instructions until done. Asynchronous code offloads long-running tasks (network I/O, file access, timers) to libuv or the OS kernel, freeing the call stack to process other concurrent requests.
- **Internals:** Network I/O is handled by kernel notification mechanisms (`epoll`/`kqueue`/`IOCP`) without consuming threads. Disk I/O and crypto run on the libuv thread pool. When I/O finishes, callbacks/reactions are placed into event loop queues and executed when the call stack clears.
- **Key Senior Takeaway:** Latency hiding: Node.js does not make I/O faster; it frees the CPU from idling while waiting for external I/O.

---

## 2. Callbacks
- **30 Seconds:** A callback is a function passed as an argument to another function, intended to be executed later upon operation completion. Node.js standardizes on the error-first convention: `callback(err, data)` where `err === null` on success.
- **Internals:** Callbacks represent continuation-passing style (CPS). Because async callbacks run on a future event loop tick, the original caller execution context is already popped off the call stack. Hence, standard `try/catch` cannot catch errors originating inside asynchronous callbacks.
- **Key Senior Takeaway:** Never release Zalgo: if a function accepts a callback, ensure it is ALWAYS called asynchronously (e.g. using `queueMicrotask` or `process.nextTick`).

---

## 3. Callback Hell
- **30 Seconds:** An anti-pattern ("Pyramid of Doom") occurring when multiple sequential asynchronous operations are nested inside each other. Beyond visual indentation, it causes inversion of control, fragmented error bubbling, and impossible control flow.
- **Internals:** Inversion of control means trusting a third-party callback to run exactly once. Every nested level must manually handle errors. Flattening via Promises restores linear control flow and centralized error propagation.
- **Key Senior Takeaway:** Named callbacks only fix code indentation; Promises fundamentally fix control flow, value return, and error propagation.

---

## 4. Promises
- **30 Seconds:** An ECMAScript standard object representing the eventual completion (or failure) of an asynchronous operation. Acts as an immutable proxy for a future value, allowing async methods to return values like synchronous methods.
- **Internals:** V8 internal slots: `[[PromiseState]]`, `[[PromiseResult]]`, `[[PromiseFulfillReactions]]`, and `[[PromiseRejectReactions]]`. The executor function runs SYNCHRONOUSLY inside the constructor. Settling schedules a `PromiseReactionJob` onto the Microtask Queue, guaranteeing handlers run before macrotasks (Timers/IO).
- **Key Senior Takeaway:** The executor runs synchronously; `.then()` handlers always execute asynchronously as microtasks.

---

## 5. Promise Lifecycle
- **30 Seconds:** Three mutually exclusive states: `pending`, `fulfilled`, and `rejected`. A promise starts as pending and transitions exactly once to fulfilled (value) or rejected (reason). Once settled, its state and value are permanently immutable.
- **Internals:** Monotonic finite state machine. Transitions are strictly one-way: `Pending -> Fulfilled` OR `Pending -> Rejected`. Subsequent calls to `resolve()` or `reject()` are silently ignored. Handlers attached after settlement immediately receive the cached result via microtasks.
- **Key Senior Takeaway:** Idempotent consumption: a promise can be subscribed to multiple times by different consumers, always yielding the identical cached result.

---

## 6. Promise Chaining
- **30 Seconds:** Linking multiple `.then()`, `.catch()`, and `.finally()` calls sequentially. Every call to `.then()` returns a brand new Promise. Returned primitives are auto-wrapped, returned Promises are auto-unwrapped/flattened, and errors bubble until caught.
- **Internals:** Handlers return values that V8 converts into new promises. If a handler returns another Promise $P$, the outer promise enters pending and adopts the state of $P$. Rejections bypass intermediate fulfillment handlers and bubble down to the nearest `.catch()`.
- **Key Senior Takeaway:** Returning a value from `.catch()` recovers the chain into a fulfilled state!

---

## 7. async / await
- **30 Seconds:** Syntactic sugar over Promises and Generator coroutines. An `async` function always returns a Promise. The `await` keyword pauses the execution of the async function until the promise settles, freeing the call stack without blocking the event loop.
- **Internals:** At `await expr`, V8 saves local variables in the Heap, suspends the function context, and pops it from the call stack. When the promise settles, a microtask restores the context and resumes execution on the next line.
- **Key Senior Takeaway:** Always use `return await promise;` inside `try/catch` blocks so that errors are caught by the local `catch` rather than bypassing it!

---

## 8. Promise.all()
- **30 Seconds:** Accepts an iterable of promises and fulfills with an array of values in input order when ALL succeed. Short-circuits immediately on the FIRST rejection.
- **Internals:** Tracks `remainingElementsCount`. Stores results by input index. Rejection fast-fails immediately, but DOES NOT cancel pending operations in the background.
- **Key Senior Takeaway:** Rejection does NOT abort in-flight requests—pair with `AbortController` if true cancellation is required.

---

## 9. Promise.allSettled()
- **30 Seconds:** Waits for ALL input promises to settle (fulfilled or rejected). It NEVER rejects. Returns an array of `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }`.
- **Internals:** Maintains a settlement counter. Attaches handlers to both fulfill and reject paths. Fulfills once counter hits 0.
- **Key Senior Takeaway:** Perfect for bulk operations, mass emails, and microservice health checks where partial success is acceptable.

---

## 10. Promise.race()
- **30 Seconds:** Settles as soon as the FIRST promise settles (either fulfilled OR rejected), adopting that winner's value or error.
- **Internals:** Hooks resolve/reject to all input promises. The fastest promise locks the master outcome. Losers continue executing in the background.
- **Key Senior Takeaway:** `Promise.race([])` (empty array) hangs forever in pending state!

---

## 11. Promise.any()
- **30 Seconds:** Fulfills as soon as ANY promise fulfills (first success wins). Ignores rejections until ALL have failed, at which point it rejects with an `AggregateError`.
- **Internals:** Rejection accumulator tracks all failures. Rejects with `AggregateError(errors)` only when all fail. `Promise.any([])` rejects immediately.
- **Key Senior Takeaway:** Inverse of `Promise.all`: first success wins, fails only on total failure.

---

### Promise Combinators Comparison Table

| Combinator | Settles When | Short-Circuits? | Failure Behavior | Return Value on Success | Key Real-World Use Case |
|---|---|---|---|---|---|
| **Promise.all()** | All fulfill OR first rejects | Yes, on first rejection | Rejects immediately with first error (in-flight tasks still run!) | Array of resolved values in input order | Transactional workflows where all parts must succeed (e.g. order checkout) |
| **Promise.allSettled()** | All promises settle (never short-circuits) | No, waits for every promise | Never rejects; reports rejections inside status objects | Array of objects: `{ status: "fulfilled"\|"rejected", value\|reason }` | Batch background operations, bulk notifications, independent data collection |
| **Promise.race()** | First promise settles (either fulfilled OR rejected) | Yes, on first settlement | Rejects immediately if first settled promise rejects | Value or reason of the first settled promise | Request timeouts (racing an API fetch against a timer promise) |
| **Promise.any()** | First promise fulfills OR all reject | Yes, on first fulfillment | Ignores rejections until ALL fail, then rejects with AggregateError | Value of the first successfully fulfilled promise | Fastest replica query, CDN fallback, multi-DNS provider queries |

---

## 12. Error Handling with try/catch
- **30 Seconds:** Standard `try/catch` works seamlessly with `await`, capturing asynchronous promise rejections locally. Throwing inside an `async` function returns a rejected promise.
- **Internals:** Modern Node.js (v15+) crashes the process on unhandled promise rejections (`exit code 1`). Express centralized error handling middleware requires exactly 4 parameters: `(err, req, res, next)`.
- **Key Senior Takeaway:** Never write `return promise;` without `await` inside a `try/catch` block.

---

## 13. Sequential vs Parallel Execution
- **30 Seconds:** Sequential execution runs tasks in series using `for...of` with `await` ($T = \sum t_i$). Parallel execution runs tasks concurrently using `Promise.all` ($T = \max(t_i)$).
- **Internals:** In sequential loops, the coroutine yields after each task. In parallel execution, all sockets/handles are initialized on the same tick and managed concurrently by the OS kernel.
- **Key Senior Takeaway:** `Array.prototype.forEach` is NOT promise-aware and does NOT await async callbacks. Always use `for...of` for sequential async loops.

---

## 14. Promise Concurrency Limits
- **30 Seconds:** Constraining simultaneously active async tasks to a fixed limit $K$ (e.g. at most 5 concurrent tasks) to prevent socket exhaustion (`EMFILE`), memory spikes, and DB connection pool starvation.
- **Internals:** A worker pool spawns $K$ worker coroutines that pull tasks from a shared iterator. As soon as one task finishes, the worker immediately grabs the next task, keeping active concurrency strictly capped at $K$.
- **Key Senior Takeaway:** Worker pools replenish slots continuously, avoiding the head-of-line blocking found in naive chunking/batching.

---

## 15. Race Conditions
- **30 Seconds:** Occurs when the correctness of a program depends on relative timing of operations. Even though JavaScript is single-threaded, `await` suspension points yield execution, allowing concurrent requests to interleave and create "read-modify-write" inconsistencies.
- **Internals:** Multiple concurrent requests read the same initial state before any write finishes (e.g. double spending).
- **Key Senior Takeaway:** Single-threaded != race-free: solve via atomic SQL updates (`SET balance = balance - 100 WHERE balance >= 100`), pessimistic row locks (`SELECT ... FOR UPDATE`), or optimistic concurrency (version column).

---

## 16. Deadlocks
- **30 Seconds:** A deadlock occurs when concurrent operations hold locks that each other requires, creating a circular wait where none can progress. Race conditions produce corrupted data; deadlocks cause complete execution freezing.
- **Internals:** Tx1 locks Resource A and requests Resource B; Tx2 locks Resource B and requests Resource A. Circular dependency.
- **Key Senior Takeaway:** Prevent deadlocks by enforcing Global Lock Ordering: always acquire locks in a deterministic, sorted order (e.g. sorting resource IDs) and setting strict lock timeouts.

---

## 17. Cancellation with AbortController
- **30 Seconds:** Standard ECMAScript interface for cooperative cancellation. Connects an `AbortController` (which calls `abort()`) to an `AbortSignal`, destroying underlying OS sockets and rejecting promises cleanly.
- **Internals:** Unlike `Promise.race()`, which leaves losing network sockets open in the background, `AbortController` actively destroys the TCP socket handle in kernel space.
- **Key Senior Takeaway:** Node 18+ provides `AbortSignal.timeout(ms)` for clean declarative timeouts, and `AbortSignal.any([sig1, sig2])` for composite cancellation.

---

## 18. Retry Mechanisms
- **30 Seconds:** Automatically re-executes failed operations to overcome transient faults. Retries must strictly be applied only to transient errors (429, 503, `ECONNRESET`), NEVER to permanent errors (400, 401, 404), and must use idempotency keys.
- **Internals:** Naive retries trigger "Retry Storms" that crash recovering downstream services. Resilient retries enforce an attempt budget (2-3 retries), error classification, and idempotency headers (`Idempotency-Key: <uuid>`).
- **Key Senior Takeaway:** Always categorize errors into transient vs permanent before retrying.

---

## 19. Exponential Backoff
- **30 Seconds:** Algorithm increasing delay exponentially between retries ($t = \text{base} \times 2^{\text{attempt}}$). Adding randomness (Jitter) is vital to decorrelate client retries and eliminate the "Thundering Herd" problem.
- **Internals:** Without jitter, all failing clients retry at the exact same millisecond. Full Jitter (`Math.random() * rawBackoff`) diffuses retries uniformly across the time window. Always respect the `Retry-After` header when provided.
- **Key Senior Takeaway:** Full Jitter produces the lowest service contention and shortest recovery time in distributed architectures.
