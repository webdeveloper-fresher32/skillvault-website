# Node.js Concurrency Model

> **This lesson is a recap, not a deep dive.** For the full mechanics of libuv's event loop phases, the microtask/macrotask queue, and complete `worker_threads`/`cluster` code, see:
> - `NodeJS/Phase-02-Event-Loop-and-Async/01-The-Event-Loop-Explained.md`
> - `NodeJS/Phase-10-Advanced-Node/01-Clustering-and-the-Cluster-Module.md`
> - `NodeJS/Phase-10-Advanced-Node/02-Worker-Threads.md`
>
> Here we connect that Node-specific knowledge back to the OS concepts from earlier phases (processes, threads, scheduling) and contrast it directly with Python's model from Lessons 01-02.

## Table of Contents
1. [The Single-Threaded Event Loop, Recapped](#1-the-single-threaded-event-loop-recapped)
2. [How Node Gets Concurrency Without OS Threads (for I/O)](#2-how-node-gets-concurrency-without-os-threads-for-io)
3. [Where Node Actually Does Use Threads](#3-where-node-actually-does-use-threads)
4. [When Node Needs worker_threads or cluster for True Parallelism](#4-when-node-needs-worker_threads-or-cluster-for-true-parallelism)
5. [Node vs Python Side-by-Side](#5-node-vs-python-side-by-side)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Single-Threaded Event Loop, Recapped

Node runs your JavaScript on exactly **one thread** — the main thread. There is one call stack; only one line of your JS executes at any instant, same as Python under the GIL for bytecode execution. The difference is *what happens when work isn't ready yet*.

```
Your JS code:                     Node's event loop (single thread):

app.get('/users', (req, res) => {   ┌─────────────────────────────┐
  db.query(sql, (err, rows) => {    │  timers  →  pending callbacks│
    res.json(rows);                 │      ↑              ↓        │
  });                               │  close cb  ←   idle, prepare │
});                                 │      ↑              ↓        │
                                    │  check   ←    poll (I/O)     │
                                    └─────────────────────────────┘
The callback (err, rows) => {...}   Each phase processes its queue,
is registered and the function      then hands control to the next
returns immediately — Node moves    phase. I/O completions land in
on to the next request/event.       the "poll" phase's queue.
```

For the full 6-phase breakdown (timers, pending callbacks, idle/prepare, poll, check, close callbacks) and how microtasks (`Promise.then`, `process.nextTick`) interleave between phases, see `NodeJS/Phase-02-Event-Loop-and-Async/01-The-Event-Loop-Explained.md` — that lesson traces a concrete code example step by step.

---

## 2. How Node Gets Concurrency Without OS Threads (for I/O)

This is the key architectural idea: Node achieves **high I/O concurrency using one thread**, by never letting the main thread block waiting on I/O.

```
Traditional thread-per-request model (e.g. old Apache, many Java servers):

  Request 1 ──▶ Thread 1 ──▶ [blocks on DB query] ──▶ response
  Request 2 ──▶ Thread 2 ──▶ [blocks on DB query] ──▶ response
  Request 3 ──▶ Thread 3 ──▶ [blocks on DB query] ──▶ response
  1000 concurrent requests = 1000 OS threads = high memory
  (each thread needs its own stack, ~1-8MB depending on OS defaults)
  + expensive context switches between them (Phase-02/Phase-03)

Node's event-loop model:

  Request 1 ──▶ registers DB query, callback queued, thread FREE
  Request 2 ──▶ registers DB query, callback queued, thread FREE
  Request 3 ──▶ registers DB query, callback queued, thread FREE
  1000 concurrent requests = 1 thread, all waiting handled by the
  OS kernel's async I/O primitives (epoll/kqueue/IOCP) — Node just
  asks the kernel "wake me when any of these sockets are ready"
```

The mechanism: for network I/O (HTTP requests, TCP/UDP sockets, most DB drivers), libuv registers the operation with the OS kernel's native async facility — `epoll` on Linux, `kqueue` on macOS/BSD, IOCP on Windows — and the main thread returns to running your JS immediately. The kernel notifies libuv when data is ready; libuv queues the corresponding JS callback to run in the poll phase. No OS thread sat there blocked the whole time — this is what lets a single Node process comfortably hold open tens of thousands of concurrent socket connections (a "C10K"-style workload) with a memory footprint that would be untenable with one OS thread per connection.

This is fundamentally different from Python's default synchronous model, where a blocking call like `requests.get()` genuinely blocks the calling thread until the OS returns data (which is exactly why Python needs `threading` or `asyncio` to get concurrency for I/O-bound work — see Lesson 01, Section 6).

---

## 3. Where Node Actually Does Use Threads

Node isn't *purely* single-threaded end to end — it's single-threaded for **your JavaScript**. Under the hood, libuv maintains a small **thread pool** (4 threads by default, tunable via the `UV_THREADPOOL_SIZE` environment variable) for operations that have no native async OS API:

```
Uses OS async I/O directly (no thread pool needed):
  - Network sockets (HTTP, TCP, UDP, most DB clients over TCP)

Uses libuv's thread pool (blocking OS APIs, no async equivalent):
  - File system operations (fs.readFile, fs.stat, etc.)
  - DNS lookups (dns.lookup — NOT dns.resolve, which is async-native)
  - crypto (pbkdf2, scrypt, randomBytes when async)
  - zlib compression/decompression
```

So when you call `fs.readFile('big.txt', callback)`, Node hands the actual disk read to one of those 4 background threads; your main thread stays free. When the read finishes, the thread pool worker's completion is picked up by the event loop and the callback is queued to run on the main thread. Full detail: `NodeJS/Phase-02-Event-Loop-and-Async/01-The-Event-Loop-Explained.md`, Section 2 ("libuv — The Engine Under Node").

---

## 4. When Node Needs worker_threads or cluster for True Parallelism

The event loop model solves I/O-bound concurrency beautifully — it does **not** solve CPU-bound work. A CPU-heavy synchronous function (e.g., a naive recursive Fibonacci, image resizing done in pure JS, parsing a huge JSON payload) runs entirely on the main thread and **blocks the entire event loop** while it runs — no other request, timer, or I/O callback can be processed until it finishes, because there's only one thread and one call stack.

```
Single Node process, one CPU-bound request comes in:

  Main thread: [ handling req A ][ CPU-bound work for req A ......][ handling req B ]
                                   ▲
                    ALL other requests (B, C, D...) queue up and
                    wait, even simple ones like a health check,
                    because the ONE thread is busy computing.
```

Two tools fix this, for two different goals:

```
worker_threads  → offload the CPU-bound function to a separate
                   thread WITHIN the same process, so the main
                   thread stays free to keep serving other requests.
                   Full example: NodeJS/Phase-10-Advanced-Node/02-Worker-Threads.md

cluster         → fork multiple full Node PROCESSES (one per CPU
                   core, typically), each with its own event loop,
                   sharing a single listening port via round-robin
                   or OS-level load balancing.
                   Full example: NodeJS/Phase-10-Advanced-Node/01-Clustering-and-the-Cluster-Module.md
```

The decision mirrors Python's threading-vs-multiprocessing choice from Lesson 02, just with different names and a different default starting point:

```
                Python default          Node default
I/O-bound   →   threading/asyncio   →   already handled by the
                (needs opt-in)          event loop, nothing extra needed

CPU-bound   →   multiprocessing     →   worker_threads (stay in-process,
                (separate processes)    shared memory possible) or
                                        cluster (separate processes,
                                        for scaling a whole server)
```

Note the asymmetry: in Python you must actively choose `threading` to get I/O concurrency; in Node, I/O concurrency is the default, free behavior of the event loop, and you only reach for `worker_threads`/`cluster` when you hit CPU-bound work or want to use more cores. See `NodeJS/Phase-10-Advanced-Node/02-Worker-Threads.md` Section 1 ("Three Ways to Get Parallelism in Node") for how `worker_threads`, `cluster`, and `child_process` differ from each other.

---

## 5. Node vs Python Side-by-Side

| | Node.js | Python (CPython) |
|---|---|---|
| Default execution | 1 thread runs your code | 1 thread runs bytecode at a time (GIL), but you can spawn many OS threads |
| I/O concurrency | Free — event loop + OS async I/O, no extra code | Requires explicit `threading` or `asyncio` |
| CPU-bound parallelism | `worker_threads` (in-process) or `cluster` (multi-process) | `multiprocessing` (multi-process) |
| Memory sharing for parallel CPU work | Possible via `SharedArrayBuffer`/transferable objects in `worker_threads` | Requires `multiprocessing.shared_memory`, `Value`, `Array` — processes don't share memory by default |
| Scaling across cores for a server | `cluster` module, or a process manager (PM2) | Multiple `gunicorn`/`uwsgi` worker processes (same idea — one process per core) |
| Blocking the "main" execution | A synchronous CPU-heavy function blocks the ENTIRE process (no other request runs) | A CPU-bound function blocks that one thread (GIL still lets I/O-bound threads elsewhere in the process resume once the GIL is released) |

---

## 6. Hands-On Exercises

**Exercise 1:** Write a small Express app (or read the example in `NodeJS/Phase-10-Advanced-Node/02-Worker-Threads.md`, Section 3) with a `/health` route and a `/compute` route that does a slow synchronous CPU-bound calculation (e.g., naive recursive `fibonacci(40)`). Hit `/compute` then immediately hit `/health` from another terminal — observe that `/health` doesn't respond until `/compute` finishes. Explain why in terms of the single-threaded event loop.

**Exercise 2:** Fix the app from Exercise 1 by offloading the Fibonacci calculation to a `worker_threads` worker (follow the pattern in `NodeJS/Phase-10-Advanced-Node/02-Worker-Threads.md`, Section 5). Re-run the same test — confirm `/health` now responds instantly even while `/compute` is running.

**Exercise 3:** Read `NodeJS/Phase-10-Advanced-Node/01-Clustering-and-the-Cluster-Module.md` and set up `cluster` to fork one worker process per CPU core for the app from Exercise 1 (without the worker_threads fix). Does clustering alone fix the blocking problem for a *single* slow request, or does it only help when there are *multiple concurrent* slow requests? Explain the difference.

**Exercise 4:** Use `dns.lookup` (uses the libuv thread pool) vs `dns.resolve` (uses native async DNS, no thread pool) in a small script. Set `UV_THREADPOOL_SIZE=1` as an environment variable and fire 4 concurrent `dns.lookup` calls for different hostnames — time how long they take compared to `UV_THREADPOOL_SIZE=4`. Explain the result in terms of the thread pool size limiting parallelism.

**Exercise 5:** Compare: implement the same "5 slow API calls" scenario from Lesson 02's `threading_io_bound.py` example, but in Node using `Promise.all` with 5 `setTimeout`-wrapped promises instead of real HTTP calls. Time it. Explain why Node achieves the same ~5x overlap as Python's threaded version, but without spawning any additional OS threads for the waiting itself.

---

## 7. Interview Q&A

**Q: How does Node.js handle thousands of concurrent connections with only one thread?**
Answer: Node's main thread never blocks waiting for I/O. When you make a network request, libuv registers it with the OS kernel's native async I/O facility (epoll on Linux, kqueue on macOS, IOCP on Windows) and the main thread immediately returns to processing other work. The kernel notifies libuv when data is ready, and the corresponding JS callback is queued to run on the main thread during the event loop's poll phase. This means one thread can have thousands of sockets "in flight" simultaneously without needing a thread per connection.

**Q: Is Node.js truly single-threaded?**
Answer: Your JavaScript code runs on a single thread, yes — but Node/libuv internally maintains a thread pool (4 threads by default) for blocking OS operations that have no native async equivalent, like file system access, DNS lookups via `dns.lookup`, and some crypto/zlib operations. So "single-threaded" describes the JS execution model, not literally every thread the Node process uses.

**Q: What happens if you run a CPU-heavy synchronous function in a Node HTTP server?**
Answer: It blocks the entire event loop — since there's only one thread and one call stack for your JS, no other request, timer callback, or I/O completion can be processed until that function returns. Even a trivial `/health` endpoint would be unresponsive during that time. This is Node's main weakness for CPU-bound work.

**Q: How do you fix a CPU-bound bottleneck in Node without blocking the event loop?**
Answer: Use `worker_threads` to move the CPU-heavy computation to a separate thread within the same process — the main thread stays free to keep handling other requests, and results come back via message passing (or shared memory via `SharedArrayBuffer` for large data). This is the direct analog of Python's need to escape the GIL for CPU-bound work, except Node's worker threads live in-process rather than requiring separate processes.

**Q: What's the difference between `cluster` and `worker_threads` in Node, and when would you use each?**
Answer: `cluster` forks multiple full Node processes (typically one per CPU core), each running the entire application with its own event loop, sharing a listening port — it's about scaling an entire server across cores, and is the more common production choice for horizontal scaling. `worker_threads` runs multiple threads inside a single process, useful for offloading one specific CPU-bound task without spinning up a whole separate process, and can share memory more cheaply. They solve different problems and are commonly combined: a clustered worker process can itself spawn worker threads for heavy tasks.

**Q: How does Node's concurrency model compare to Python's default model for I/O-bound work?**
Answer: Node gets I/O concurrency "for free" as the default behavior of its event loop — you don't opt into anything special to have many requests in flight. Python's default execution is synchronous and blocking; to get I/O concurrency you must explicitly use `threading` (relying on the GIL being released during blocking calls) or `asyncio` (an event-loop model similar in spirit to Node's, but requiring `async`/`await` syntax throughout the I/O call chain).
