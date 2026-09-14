# Clustering and the Cluster Module — Complete Guide

## Table of Contents
1. [Recap: Node is Single-Threaded](#1-recap-node-is-single-threaded)
2. [The Problem: One Process, One Core](#2-the-problem-one-process-one-core)
3. [The Cluster Module](#3-the-cluster-module)
4. [Complete Example: Forking Workers](#4-complete-example-forking-workers)
5. [How Load Balancing Works](#5-how-load-balancing-works)
6. [Zero-Downtime Restarts and Worker Crashes](#6-zero-downtime-restarts-and-worker-crashes)
7. [Cluster vs a Process Manager (PM2)](#7-cluster-vs-a-process-manager-pm2)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Recap: Node is Single-Threaded

Node.js runs your JavaScript on a **single thread** driven by the event loop. I/O (disk, network, database calls) is delegated to the OS or libuv's thread pool, so the main thread is free to keep handling other requests while I/O is in flight. That's why Node handles thousands of concurrent I/O-bound connections well on one thread.

```
Single Node process:

┌─────────────────────────────────────────────┐
│              Event Loop (1 thread)           │
│                                               │
│  Request A ──▶ query DB ──▶ (waiting...)     │
│  Request B ──▶ query DB ──▶ (waiting...)     │  ← non-blocking I/O,
│  Request C ──▶ query DB ──▶ (waiting...)     │    all handled concurrently
│                                               │
└─────────────────────────────────────────────┘
        Uses exactly ONE CPU core, always.
```

The catch: your JavaScript itself — the code between `async`/`await` points — always runs on that one thread. A CPU-heavy computation (image resizing, a big sort, cryptographic hashing, JSON-parsing a huge payload) blocks that single thread completely. Every other request, no matter how simple, waits until the computation finishes.

## 2. The Problem: One Process, One Core

A modern server has multiple CPU cores (4, 8, 16, sometimes more). A single `node server.js` process uses exactly one of them — the rest sit idle unless you do something about it.

```
8-core machine, single Node process:

Core 1: [████████████] Node process (100% busy under load)
Core 2: [            ] idle
Core 3: [            ] idle
Core 4: [            ] idle
Core 5: [            ] idle
Core 6: [            ] idle
Core 7: [            ] idle
Core 8: [            ] idle

7/8 of the machine's compute capacity is wasted.
```

The fix isn't to make Node multi-threaded — it's to run **multiple Node processes**, one per core, and spread incoming requests across them. That's exactly what the `cluster` module automates.

## 3. The Cluster Module

`cluster` is a built-in Node module that lets a single script spawn multiple child processes ("workers") that all share the same server port. It uses a **master/worker** architecture:

- The **master** process doesn't handle requests itself — it forks workers and hands off incoming connections to them.
- Each **worker** is a full, independent Node.js process (its own event loop, its own memory, its own V8 instance) running the same application code.

```
                    ┌─────────────────────┐
                    │   Master Process    │
                    │  (no app logic —    │
                    │   just forks +      │
                    │   distributes)      │
                    └──────────┬──────────┘
                               │ fork()
        ┌───────────┬─────────┼─────────┬───────────┐
        ▼           ▼         ▼         ▼           ▼
   ┌─────────┐ ┌─────────┐┌─────────┐┌─────────┐┌─────────┐
   │Worker 1 │ │Worker 2 ││Worker 3 ││Worker 4 ││Worker N │
   │ (core 1)│ │ (core 2)││ (core 3)││ (core 4)││ (core N)│
   │  :3000  │ │  :3000  ││  :3000  ││  :3000  ││  :3000  │
   └─────────┘ └─────────┘└─────────┘└─────────┘└─────────┘
        All workers listen on the same port (3000)
        via the master's shared listening socket.
```

Because workers are separate OS processes, a crash in one worker does not take down the others — the master can detect the crash and fork a replacement.

## 4. Complete Example: Forking Workers

```javascript
// server.js
const cluster = require('cluster');
const os = require('os');
const http = require('http');

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  // ---- MASTER PROCESS ----
  console.log(`Master ${process.pid} is running`);
  console.log(`Forking ${numCPUs} workers (one per CPU core)`);

  // Fork one worker per CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Replace a worker if it dies unexpectedly
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (code: ${code}, signal: ${signal})`);
    console.log('Forking a replacement worker...');
    cluster.fork();
  });

  cluster.on('online', (worker) => {
    console.log(`Worker ${worker.process.pid} is online`);
  });

} else {
  // ---- WORKER PROCESS ----
  // Each worker runs this branch and starts its own HTTP server.
  // All workers bind to the same port; the OS/master handles distribution.
  http.createServer((req, res) => {
    // Simulate a tiny bit of work so we can see which worker handled it
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'Hello from a worker',
      workerPid: process.pid,
    }));
  }).listen(3000);

  console.log(`Worker ${process.pid} started, listening on port 3000`);
}
```

Run it and hammer it with requests:

```bash
node server.js
# Master 12345 is running
# Forking 8 workers (one per CPU core)
# Worker 12346 is online
# Worker 12347 is online
# ... (8 total)

# In another terminal:
for i in {1..10}; do curl -s http://localhost:3000; echo; done
# {"message":"Hello from a worker","workerPid":12346}
# {"message":"Hello from a worker","workerPid":12349}
# {"message":"Hello from a worker","workerPid":12347}
# ... different PIDs — requests are being spread across workers
```

Now all 8 cores are doing useful work instead of 7 sitting idle.

## 5. How Load Balancing Works

On most platforms (Linux), `cluster` uses a **round-robin** scheduling approach by default: the master accepts incoming connections and hands them out to workers in turn, one after another. On Windows and some other setups, the OS kernel itself distributes connections across the processes sharing the socket.

```
Incoming requests: 1  2  3  4  5  6  7  8  9  10
                    │  │  │  │  │  │  │  │  │  │
Master round-robin: ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼
                    W1 W2 W3 W1 W2 W3 W1 W2 W3 W1
                    (with 3 workers, cycling through them)
```

Important nuance: each worker has its **own memory** — no shared variables. If Worker 1 stores something in a plain JS object (like an in-memory cache or a rate-limit counter), Worker 2 has no idea it exists. This is exactly why clustered apps need external shared state (Redis, a database) for anything that must be consistent across workers — see Lessons 03 and 05.

```
Worker 1 memory: { cache: {...} }    ← isolated
Worker 2 memory: { cache: {...} }    ← isolated, different object!
Worker 3 memory: { cache: {...} }    ← isolated, different object!

Two requests hitting different workers see DIFFERENT in-memory state.
Solution: put shared state in Redis, not in a worker's memory.
```

## 6. Zero-Downtime Restarts and Worker Crashes

Because each worker is independent, you can restart workers one at a time without ever taking the whole service down:

```javascript
// Graceful, one-at-a-time restart of all workers (e.g. after a deploy)
function restartWorkers() {
  const workers = Object.values(cluster.workers);

  function restartNext(i) {
    if (i >= workers.length) return;
    const worker = workers[i];

    worker.on('exit', () => {
      if (!worker.exitedAfterDisconnect) return; // crashed, not part of restart
      const newWorker = cluster.fork();
      newWorker.on('listening', () => restartNext(i + 1)); // restart next only once new one is ready
    });

    worker.disconnect(); // ask worker to stop accepting new connections and exit
  }

  restartNext(0);
}
```

If a worker crashes (uncaught exception, segfault, `process.exit(1)`), the `'exit'` event fires on the master, and the `cluster.fork()` call in the `exit` handler (see Section 4) spins up a replacement — the other workers keep serving traffic the whole time.

## 7. Cluster vs a Process Manager (PM2)

In practice, most production deployments don't hand-roll `cluster` code — they use a process manager that does it for you:

| Approach | How it works | When to use |
|----------|--------------|-------------|
| `cluster` module (manual) | You write the master/fork logic yourself | Learning the mechanics; full control; embedding in custom orchestration |
| **PM2** (`pm2 start app.js -i max`) | PM2 wraps `cluster` for you — forks, restarts, log aggregation, zero-downtime reload | Most production Node deployments on VMs/bare metal |
| **Container orchestration** (Kubernetes) | Run N single-process containers; the orchestrator load-balances and restarts pods | Containerized deployments — clustering happens at the infra layer instead |

Even when Kubernetes handles process-level scaling (running multiple pods), you'll often still see `cluster` used *inside* a pod to use all the cores allocated to that container. Understanding the raw `cluster` module is what lets you reason correctly about either setup in an interview or in production.

---

## 8. Hands-On Exercises

**Exercise 1:** Save the example from Section 4 as `server.js` and run it. Confirm in the terminal output that it forks one worker per core reported by `os.cpus().length` on your machine.

**Exercise 2:** Send 20 requests in a loop (`for i in {1..20}; do curl -s http://localhost:3000; echo; done`) and collect the `workerPid` values. Confirm requests are distributed across multiple different PIDs, not always the same one.

**Exercise 3:** Add a route `/crash` that calls `process.exit(1)` inside a worker. Hit it, then immediately check the master's log output — confirm a new worker is forked to replace the dead one, and that requests to `/` still succeed throughout.

**Exercise 4:** Add an in-memory counter (`let count = 0`) that increments on every request and is returned in the response. Send several requests and observe that the count does **not** increase monotonically overall — because each worker keeps its own separate `count`. This demonstrates why shared state needs an external store.

**Exercise 5:** Modify the fork loop to fork a *fixed* number of workers (e.g. always 2) regardless of `os.cpus().length`, and explain in a comment why you might deliberately under-provision workers relative to core count in a real deployment (e.g. leaving cores for other processes on the box).

---

## 9. Interview Q&A

**Q: Why does Node.js need a clustering strategy at all, given that it's designed to be highly concurrent?**
Answer: Node's concurrency model (the event loop) makes it excellent at handling many concurrent I/O-bound operations on a single thread, but that single thread is still just one thread — it can only use one CPU core, and any CPU-bound JavaScript execution blocks it entirely. A machine with 8 cores running one Node process wastes 7 of them. Clustering runs multiple Node processes (one per core), so the app can use the whole machine's compute capacity, not just I/O concurrency on one core.

**Q: What is the master/worker model in the `cluster` module?**
Answer: The master process forks one or more worker processes, each a full independent Node.js process running the application's code. The master itself typically doesn't serve requests — it distributes incoming connections to the workers (round-robin on most platforms) and monitors them, forking replacements if a worker dies. Workers share the same listening port via the master's socket but have completely separate memory.

**Q: If I have an in-memory cache or rate limiter in a clustered app, what goes wrong?**
Answer: Each worker is a separate OS process with its own memory space — nothing is shared between them automatically. If worker A caches a value in a plain object, worker B (which might handle the very next request from the same client) has no knowledge of it. This breaks anything that needs to be globally consistent, like rate limiting, session data, or caching. The fix is to move that shared state to an external store like Redis, which every worker can read/write to.

**Q: What happens if a worker process crashes?**
Answer: The master receives an `'exit'` event for that worker with the exit code/signal. Because workers are independent processes, the crash doesn't affect other workers currently serving traffic — the app as a whole stays up. A well-written master listens for `'exit'` and calls `cluster.fork()` again to replace the dead worker, so capacity is restored automatically.

**Q: How is `cluster` different from using PM2 or running multiple containers in Kubernetes?**
Answer: `cluster` is the low-level Node.js API for forking worker processes that share a port — you write the fork/restart/monitoring logic yourself. PM2 is a process manager that wraps `cluster` (or spawns separate processes) and adds operational features like zero-downtime reloads, log aggregation, and auto-restart out of the box, so most teams use it instead of hand-rolling cluster code. Kubernetes takes a different approach: it doesn't use Node's `cluster` module at all — it runs multiple single-process pods (each a separate container) and load-balances at the infrastructure/networking layer, though `cluster` can still be used inside a single pod to use all cores allocated to that container.

**Q: Does clustering help with a memory leak or a slow database query?**
Answer: No — clustering multiplies your CPU capacity, it doesn't fix underlying inefficiencies. A memory leak still leaks in each worker independently (so you now have N processes slowly leaking instead of one). A slow database query still takes just as long per request; clustering just lets more of those slow requests happen in parallel across cores rather than fixing why each one is slow. Clustering solves "I'm not using all my CPU cores," not "my code is doing wasteful or broken work."
