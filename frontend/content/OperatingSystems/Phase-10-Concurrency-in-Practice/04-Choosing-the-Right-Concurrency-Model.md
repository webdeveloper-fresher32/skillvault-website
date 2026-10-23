# Choosing the Right Concurrency Model

## Table of Contents
1. [Step 1 — Classify the Workload](#1-step-1--classify-the-workload)
2. [Step 2 — Decision Tree](#2-step-2--decision-tree)
3. [The Master Comparison Table](#3-the-master-comparison-table)
4. [Worked Examples](#4-worked-examples)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Step 1 — Classify the Workload

Every concurrency decision starts with one question: **where does the task spend its time?**

```
CPU-bound:  the bottleneck is the processor actively computing.
            Examples: image/video encoding, cryptographic hashing,
            parsing large files, numerical simulation, compression,
            machine learning inference on CPU.
            → Adding more "waiters" doesn't help; you need more
              CPU cores actually crunching numbers simultaneously.

I/O-bound:  the bottleneck is waiting — on network, disk, or another
            service — while the CPU sits idle.
            Examples: HTTP API calls, database queries, file reads
            over a network mount, waiting on a message queue.
            → The CPU is free during the wait; the win comes from
              overlapping many waits instead of doing them one at a time.

Mixed:      most real systems have both — e.g., an API that fetches
            data (I/O) then transforms/validates it heavily (CPU).
            → Identify each phase separately and pick a tool per phase
              (see Lesson 03, Section 4's fetch → process pipeline idea).
```

A quick self-test: if you 10x the CPU speed but keep the network/disk the same, does the task get dramatically faster? If yes, it's CPU-bound. If the task's time is dominated by "waiting for a response," it's I/O-bound.

---

## 2. Step 2 — Decision Tree

```
                         ┌───────────────────────────┐
                         │   Classify the workload    │
                         └─────────────┬─────────────┘
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 ▼                                            ▼
           I/O-BOUND                                    CPU-BOUND
                 │                                            │
     ┌───────────┴───────────┐                   ┌───────────┴───────────┐
     ▼                       ▼                   ▼                       ▼
  Python                   Node.js             Python                  Node.js
     │                       │                   │                       │
     ▼                       ▼                   ▼                       ▼
 threading OR           Native — event      multiprocessing        worker_threads
 asyncio                loop handles it     (separate GIL          (offload from
 (asyncio scales        automatically;      per process, true      main thread) or
 better for very        no extra code       parallel execution)    cluster (scale
 high connection        needed for                                 across cores for
 counts; threading      normal async I/O                           a whole server)
 is simpler for a
 handful of calls)
```

**Rule of thumb for picking between Python threading and asyncio (both I/O-bound tools):** use `threading` (or `concurrent.futures.ThreadPoolExecutor`) when you're calling existing blocking libraries (most synchronous DB drivers, `requests`) and don't want to rewrite them as async. Use `asyncio` when you're building something from scratch with async-native libraries (`aiohttp`, `asyncpg`) and expect very high connection counts (thousands+), since asyncio's single-threaded cooperative model has lower per-connection overhead than one OS thread per connection.

---

## 3. The Master Comparison Table

| Workload | Python Tool | Node.js Tool | Why |
|---|---|---|---|
| Many parallel API/DB calls | `threading` / `asyncio` | Native (`async`/`await`, `Promise.all`) | GIL/event loop releases control during I/O wait; overlap wins |
| Image/video processing, hashing, compression | `multiprocessing` | `worker_threads` | Needs actual CPU parallelism across cores |
| Scaling a web server to use all CPU cores | Multiple WSGI/ASGI worker processes (gunicorn `-w N`) | `cluster` module | One process (or worker) per core, OS load-balances |
| Numerical/scientific computing | `multiprocessing`, or NumPy (releases GIL internally in C) | `worker_threads` (rare — most numeric work isn't done in Node) | True parallel execution needed |
| A single slow request must not block other requests | `threading` (if I/O) or offload to `multiprocessing`/task queue (if CPU) | `worker_threads` (CPU) — I/O is already non-blocking by default | Keep the "front door" thread/process responsive |
| Background job processing (emails, thumbnails, reports) | `multiprocessing`, Celery/RQ (separate worker processes) | `worker_threads`, or a job queue (BullMQ) backed by separate processes | Decouple slow work from request-handling path entirely |
| High-throughput low-latency network server (10K+ connections) | `asyncio` (e.g., FastAPI + Uvicorn) | Native event loop (Node's default strength) | Cooperative single-thread model has the lowest per-connection overhead |

---

## 4. Worked Examples

**Example A — A REST API endpoint that calls 3 downstream microservices, then returns a combined response.**
```
Classification: I/O-bound (waiting on 3 network calls)

Python:  asyncio + aiohttp, `await asyncio.gather(call1(), call2(), call3())`
         (or threading + ThreadPoolExecutor if using a sync HTTP client)

Node.js: Promise.all([fetch(url1), fetch(url2), fetch(url3)])
         — no extra threads needed, this is the event loop's default job
```

**Example B — Resizing 10,000 uploaded images to thumbnails.**
```
Classification: CPU-bound (pixel manipulation, encoding)

Python:  multiprocessing.Pool mapping resize_image over the file list,
         using all available cores

Node.js: worker_threads pool (or offload to a separate process/service
         written in a faster language via child_process, since Node
         itself isn't ideal for heavy pixel math)
```

**Example C — A Node.js server that occasionally needs to generate a large PDF report (CPU-heavy) while continuing to serve other API requests.**
```
Classification: Mixed — most requests are I/O-bound, but PDF generation
                is a CPU-bound outlier that must not stall the server

Node.js: Keep normal requests on the main event loop (already
         non-blocking). Offload PDF generation to a worker_threads
         worker (or a background job queue like BullMQ backed by a
         separate worker process) so /health and other requests stay
         responsive while the report is generated.
```

**Example D — A Python data pipeline: download 100 CSV files from S3, then parse + aggregate them.**
```
Classification: Mixed, two distinct phases

Phase 1 (download, I/O-bound):    ThreadPoolExecutor to fetch all
                                   100 files concurrently
Phase 2 (parse/aggregate, CPU-bound): ProcessPoolExecutor to parse
                                   and crunch the downloaded data
                                   across cores

This is exactly the two-stage pipeline pattern from Lesson 02,
Section 5 and Exercise 5 — right tool for each phase's bottleneck.
```

---

## 5. Common Mistakes

```
Mistake 1: Using multiprocessing/worker_threads for I/O-bound work.
  → Wastes memory and startup time on parallelism you don't need;
    threading/asyncio (Python) or nothing extra (Node) is enough,
    since the CPU is idle during I/O waits anyway.

Mistake 2: Using threading for CPU-bound work in Python and being
  surprised there's no speedup.
  → This is the GIL trap from Lesson 01 — threads don't parallelize
    Python bytecode execution. Use multiprocessing instead.

Mistake 3: Running a CPU-heavy synchronous function directly in a
  Node request handler "because it's just one function call."
  → Blocks the ENTIRE event loop, stalling every other request.
    Always offload real CPU work to worker_threads or a separate
    service/queue.

Mistake 4: Spawning a new process/thread per task in a hot loop
  instead of using a pool.
  → Startup overhead (especially for processes — see Lesson 02,
    Section 4) dominates if tasks are small and frequent. Use
    ThreadPoolExecutor/ProcessPoolExecutor or a worker_threads pool
    that reuses workers.

Mistake 5: Assuming asyncio and threading are interchangeable in
  Python without checking library compatibility.
  → A blocking call (e.g., a sync DB driver) inside an `async def`
    function still blocks the entire asyncio event loop — there's
    no free lunch. You need an async-native driver, or you must run
    the blocking call in a thread pool via
    `loop.run_in_executor(None, blocking_fn)`.
```

---

## 6. Hands-On Exercises

**Exercise 1:** Take a real (or hypothetical) feature you've built — a signup flow, a report generator, a search endpoint — and classify each step as CPU-bound or I/O-bound. Draw the Section 2 decision tree with your actual steps filled in, and state which Python and Node tool you'd pick for each step.

**Exercise 2:** Reproduce Worked Example A: build a small Python async function using `asyncio.gather` that "calls" 3 fake downstream services (via `asyncio.sleep`), and a Node.js equivalent using `Promise.all` with `setTimeout`-wrapped promises. Time both — they should show similar overlap behavior despite very different underlying mechanisms.

**Exercise 3:** Deliberately commit Mistake 2 — write a Python threading version of a CPU-bound task (reuse `count_down` from Lesson 01) and measure it against a `multiprocessing` version to confirm the difference firsthand rather than just reading about it.

**Exercise 4:** In a Node Express app, add a route that calls a blocking, CPU-heavy synchronous function directly (Mistake 3), and a second route offloading the same function to `worker_threads`. Load-test both with a tool like `autocannon` or simple concurrent `curl` calls, hitting `/health` during the load test, and compare responsiveness.

**Exercise 5:** For Worked Example D's two-stage pipeline (download then parse), estimate: if downloading 100 files sequentially takes 50s and takes 3s with 20 threads, and sequential parsing takes 20s but 5s with 4 processes, what's the total pipeline time using the right tool for each phase versus doing everything sequentially? Compute the overall speedup.

---

## 7. Interview Q&A

**Q: How do you decide whether a task needs threading/asyncio versus multiprocessing/worker_threads?**
Answer: First classify the task's bottleneck. If it spends most of its time waiting (network calls, disk I/O, DB queries), the CPU is idle during that wait, so threading (Python) or the event loop (Node, by default) is enough — you're overlapping waits, not needing more compute. If it spends most of its time actively computing (parsing, hashing, image processing), you need genuine parallel CPU execution, which means multiprocessing in Python (separate GIL per process) or worker_threads/cluster in Node (offloading from the single main thread).

**Q: Why can't you just always use multiprocessing/worker_threads to be safe, regardless of workload type?**
Answer: Processes and dedicated threads for CPU offload carry real overhead — much higher memory usage, slower startup (creating a new process is ~10-100x more expensive than a thread), and more complex communication (data must be pickled/serialized between Python processes, or passed via message-passing in worker_threads). For I/O-bound work, that overhead buys you nothing extra beyond what a cheap thread or the default event loop already provides, since the bottleneck was never CPU availability in the first place.

**Q: In a mixed workload — some I/O, some CPU-bound — how would you architect the solution?**
Answer: Split the pipeline into phases and match a tool to each phase's bottleneck: use threading/asyncio (Python) or the default event loop (Node) for the I/O phase to overlap waits, then hand off to multiprocessing (Python) or worker_threads (Node) for the CPU-heavy phase to use multiple cores. Trying to force one concurrency model to handle both phases usually means the I/O phase pays unnecessary process overhead, or the CPU phase doesn't get real parallelism.

**Q: A Python `async def` function calls a synchronous, blocking database driver. What goes wrong, and how do you fix it?**
Answer: Because the function is `async` doesn't make the blocking call itself non-blocking — if the driver blocks the OS thread while waiting for the DB, it blocks the entire asyncio event loop (which runs on one thread), stalling every other coroutine, not just the one making the call. Fixes: use an async-native driver (e.g., `asyncpg` instead of `psycopg2`), or explicitly run the blocking call in a thread pool via `loop.run_in_executor(None, blocking_fn)` so it doesn't block the event loop's thread.

**Q: What's the practical difference between scaling a Python web app with multiple worker processes (e.g., gunicorn `-w 4`) versus Node's cluster module?**
Answer: They solve the same problem the same way — running multiple OS processes, each with its own interpreter/runtime and event loop or request-handling logic, typically one per CPU core, to use all available cores for a server that would otherwise be limited to one core's worth of throughput (Python due to the GIL limiting one process to one core of real parallel work; Node due to being single-threaded per process). Both usually sit behind a load balancer or use OS-level socket sharing to distribute incoming connections across the worker processes.

**Q: If you're building a brand-new high-throughput network service and could choose either ecosystem's default concurrency model, what would you pick and why?**
Answer: Both Node's event loop and Python's asyncio are strong choices for I/O-bound, high-connection-count services — they use a single-threaded, cooperative model with low per-connection overhead, avoiding the memory cost of a thread per connection. The deciding factor is usually less about raw concurrency model and more about ecosystem fit (available async-native libraries, team familiarity, existing codebase) and whether the service also has a genuinely CPU-bound component, in which case you'd plan from day one for worker_threads/multiprocessing to offload that part regardless of which language you pick.
