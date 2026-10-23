# Worker Threads — Complete Guide

## Table of Contents
1. [Three Ways to Get Parallelism in Node](#1-three-ways-to-get-parallelism-in-node)
2. [When to Use Which](#2-when-to-use-which)
3. [The Problem: CPU-Bound Work Blocks the Event Loop](#3-the-problem-cpu-bound-work-blocks-the-event-loop)
4. [The `worker_threads` Module](#4-the-worker_threads-module)
5. [Complete Example: Offloading a Heavy Computation](#5-complete-example-offloading-a-heavy-computation)
6. [Message Passing in Detail](#6-message-passing-in-detail)
7. [A Worker Pool Pattern](#7-a-worker-pool-pattern)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Three Ways to Get Parallelism in Node

Node.js gives you three distinct mechanisms for running more than "one thread, one script" — they solve different problems and are not interchangeable:

```
cluster           →  Multiple full Node PROCESSES, same app code, share a port.
                     Use for: scaling a server across CPU cores.

worker_threads    →  Multiple THREADS inside ONE process, can share memory.
                     Use for: offloading CPU-bound work without blocking the
                     main event loop, while staying in one process.

child_process     →  Spawn ANY external program/script (not just Node),
                     communicate via stdin/stdout/IPC.
                     Use for: running a different executable (ffmpeg, python
                     script, shell command) or true process isolation.
```

## 2. When to Use Which

| Need | Use |
|------|-----|
| Scale an HTTP server across all CPU cores | `cluster` |
| Run CPU-heavy JS (hashing, image processing, big data transforms) without blocking requests | `worker_threads` |
| Run a non-Node program, or need full OS-level process isolation | `child_process` |
| Share large binary data (e.g. a big buffer) between parallel workers with minimal copying | `worker_threads` (via `SharedArrayBuffer` / transferable objects) |
| Fire-and-forget a shell command (`git pull`, `ffmpeg -i ...`) | `child_process.exec`/`spawn` |

`worker_threads` is the newest and most targeted of the three for one specific job: taking CPU-bound JavaScript off the main thread while staying inside a single Node process, with the option to share memory efficiently. It doesn't replace `cluster` (that's about using multiple cores for a whole server) — it's normal to use both together (clustered workers, each of which spins up worker threads for heavy tasks).

## 3. The Problem: CPU-Bound Work Blocks the Event Loop

```javascript
// server.js — DO NOT do this in production
const express = require('express');
const app = express();

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/compute', (req, res) => {
  const result = fibonacci(42); // CPU-bound, takes several seconds
  res.json({ result });
});

app.listen(3000);
```

```
Timeline with a single event loop:

t=0s   GET /compute arrives  ──▶ fibonacci(42) starts running synchronously
t=0.1s GET /health arrives   ──▶ queued, CANNOT run — event loop is busy
t=1s   GET /health arrives   ──▶ still queued
t=4s   fibonacci(42) finishes, /compute responds
t=4s   /health FINALLY runs  ──▶ 4 seconds late, even though it does zero work

Every request — even trivial ones — is blocked behind the CPU-bound one.
```

This is the core problem `worker_threads` solves: move the CPU-bound computation to a separate thread so the main thread's event loop stays free to keep handling other requests.

## 4. The `worker_threads` Module

```
┌───────────────────────────────────────────────────────────────┐
│                      Main Thread (Node process)                │
│                                                                 │
│   Express app, event loop, handles HTTP requests               │
│                                                                 │
│        │  postMessage({ n: 42 })          ▲                    │
│        ▼                                  │ 'message' event    │
│   ┌─────────────────────────────────────────────┐              │
│   │              Worker Thread                   │              │
│   │  (separate V8 instance + its own event loop) │              │
│   │                                               │              │
│   │  Runs worker.js — computes fibonacci(42)     │              │
│   │  synchronously, WITHOUT blocking main thread │              │
│   └─────────────────────────────────────────────┘              │
│                                                                 │
│   Main thread's event loop stays responsive the whole time.     │
└───────────────────────────────────────────────────────────────┘
```

Key API pieces (from `require('worker_threads')`):

| Piece | Purpose |
|-------|---------|
| `Worker` | Class to spawn a new worker thread, pointing at a script file |
| `workerData` | Data passed to the worker at creation time (one-time input) |
| `parentPort` | Used inside the worker to send/receive messages to/from the main thread |
| `isMainThread` | Boolean — lets one file act as both main-thread and worker-thread entry point |

## 5. Complete Example: Offloading a Heavy Computation

**`worker.js`** — the code that runs inside the worker thread:

```javascript
// worker.js
const { parentPort, workerData } = require('worker_threads');

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// workerData was passed in when the Worker was created
const { n } = workerData;

const result = fibonacci(n);

// Send the result back to the main thread, then the worker exits
parentPort.postMessage({ result });
```

**`server.js`** — the main thread, an Express server that offloads to the worker:

```javascript
// server.js
const express = require('express');
const path = require('path');
const { Worker } = require('worker_threads');

const app = express();

// Wrap worker creation in a Promise for easy async/await usage
function runFibonacciInWorker(n) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'worker.js'), {
      workerData: { n },
    });

    worker.on('message', (msg) => resolve(msg.result));
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/compute', async (req, res) => {
  const n = Number(req.query.n) || 40;
  const result = await runFibonacciInWorker(n);
  res.json({ n, result });
});

app.listen(3000, () => console.log('Server on :3000'));
```

Now:

```
t=0s   GET /compute?n=42 arrives ──▶ worker thread spawned, computing...
t=0.1s GET /health arrives       ──▶ handled IMMEDIATELY (main thread is free)
t=1s   GET /health arrives       ──▶ handled IMMEDIATELY
t=4s   worker posts result       ──▶ /compute responds

/health was never blocked, because the heavy computation ran on a
separate thread, not on the main event loop.
```

## 6. Message Passing in Detail

Worker threads do **not** share memory with the main thread by default (except via explicit `SharedArrayBuffer`s). Communication happens through `postMessage`, which internally uses the **structured clone algorithm** — data is copied, not shared, unless you explicitly mark it as "transferable."

```javascript
// main.js
const { Worker } = require('worker_threads');
const worker = new Worker('./worker.js');

worker.postMessage({ type: 'start', payload: { a: 1, b: 2 } });

worker.on('message', (msg) => {
  console.log('Received from worker:', msg);
});

worker.on('error', (err) => {
  console.error('Worker crashed:', err);
});

worker.on('exit', (code) => {
  console.log(`Worker exited with code ${code}`);
});
```

```javascript
// worker.js
const { parentPort } = require('worker_threads');

parentPort.on('message', (msg) => {
  if (msg.type === 'start') {
    const sum = msg.payload.a + msg.payload.b;
    parentPort.postMessage({ type: 'result', sum });
  }
});
```

```
Main Thread                         Worker Thread
     │                                    │
     │──── postMessage({start, a, b}) ───▶│
     │                                    │  (data is COPIED across,
     │                                    │   not shared memory)
     │                                    │   compute sum = a + b
     │◀──── postMessage({result, sum}) ───│
     │                                    │
```

For large data (e.g. big buffers/images) where copying would be expensive, pass a `Transferable` (like an `ArrayBuffer`) as the second argument to `postMessage` — ownership moves to the receiver instead of copying:

```javascript
const buffer = new ArrayBuffer(1024 * 1024 * 50); // 50MB
worker.postMessage({ buffer }, [buffer]); // transferred, not copied — near-instant
```

## 7. A Worker Pool Pattern

Spawning a brand-new thread per request has overhead (each `Worker` needs its own V8 context). For frequent CPU-bound work, reuse a fixed pool of workers instead of creating one per request — this mirrors how you'd manage a database connection pool.

```javascript
// A minimal worker pool sketch
const { Worker } = require('worker_threads');
const os = require('os');

class WorkerPool {
  constructor(workerFile, poolSize = os.cpus().length) {
    this.workerFile = workerFile;
    this.pool = [];
    this.freeWorkers = [];
    this.queue = [];

    for (let i = 0; i < poolSize; i++) this.addNewWorker();
  }

  addNewWorker() {
    const worker = new Worker(this.workerFile);
    worker.on('message', (result) => {
      const { resolve } = worker.currentTask;
      worker.currentTask = null;
      resolve(result);
      this.freeWorkers.push(worker);
      this.processQueue();
    });
    this.pool.push(worker);
    this.freeWorkers.push(worker);
  }

  processQueue() {
    if (this.queue.length === 0 || this.freeWorkers.length === 0) return;
    const worker = this.freeWorkers.pop();
    const task = this.queue.shift();
    worker.currentTask = task;
    worker.postMessage(task.data);
  }

  runTask(data) {
    return new Promise((resolve) => {
      this.queue.push({ data, resolve });
      this.processQueue();
    });
  }
}

module.exports = WorkerPool;
```

In production, use the battle-tested `piscina` package instead of hand-rolling this — but understanding the pattern (fixed pool, task queue, reuse threads) is what interviewers are checking for.

---

## 8. Hands-On Exercises

**Exercise 1:** Build the `server.js` + `worker.js` example from Section 5. Confirm with two terminals that `/health` responds instantly while `/compute?n=42` is still running.

**Exercise 2:** Rewrite `/compute` from Section 3 (the blocking version, computed directly on the main thread) and time how long `/health` takes to respond while `/compute` is running. Compare against the worker-thread version's `/health` response time.

**Exercise 3:** Modify `worker.js` to accept an array of numbers via `workerData` and return the fibonacci result for each one, posting a single combined result message back.

**Exercise 4:** Add error handling: inside `worker.js`, throw an error if `n` is negative. Confirm the `'error'` event fires on the main thread's `Worker` instance and that your Express route responds with a 500 instead of hanging.

**Exercise 5:** Implement the `WorkerPool` sketch from Section 7 with a real `worker.js` that computes something (e.g. squares a number), submit 20 tasks via `runTask`, and confirm they're processed using only `poolSize` workers, queuing the rest.

---

## 9. Interview Q&A

**Q: What's the difference between `cluster`, `worker_threads`, and `child_process`?**
Answer: `cluster` forks multiple full Node processes running the same server code, sharing a listening port — it's for scaling a server across CPU cores. `worker_threads` runs multiple threads inside a single process, optionally sharing memory via `SharedArrayBuffer` — it's for offloading CPU-bound JavaScript work without blocking the main event loop. `child_process` spawns any external program (not necessarily Node) as a separate OS process, communicating via stdio or IPC — it's for running external executables or needing full process-level isolation.

**Q: Why would blocking the event loop with a CPU-bound task on the main thread be a problem, even in a clustered app?**
Answer: Clustering adds more processes, each still running its own single-threaded event loop. A CPU-bound task run directly on a worker process's main thread still blocks that one process's ability to serve any other request until it finishes — you've just multiplied the number of processes that can each get individually stuck, not fixed the underlying blocking behavior. `worker_threads` addresses the root cause: moving the CPU-bound work off the thread that's supposed to be handling I/O.

**Q: How do the main thread and a worker thread communicate, since they don't share memory by default?**
Answer: They communicate via `postMessage`/`on('message')`, using the structured clone algorithm to copy data between threads — similar to how `postMessage` works between browser tabs/web workers. For large data where copying would be expensive, you can pass `Transferable` objects (like `ArrayBuffer`) which move ownership to the receiver instead of copying, or use a `SharedArrayBuffer` for true shared memory when both sides need concurrent read/write access.

**Q: When would you NOT use worker_threads for a CPU-bound task?**
Answer: If the work is actually I/O-bound (waiting on a database, an API call, disk), worker_threads adds unnecessary complexity — the event loop already handles that efficiently without blocking. Worker threads are only worth the overhead (spawning a thread, message-passing serialization cost) for genuinely CPU-bound synchronous work that would otherwise block the event loop for a meaningful amount of time — a quick calculation that takes a few milliseconds usually isn't worth offloading.

**Q: What is a worker pool and why use one instead of creating a new Worker per request?**
Answer: Creating a `Worker` has real overhead — spinning up a new V8 isolate and thread takes time and memory. A worker pool pre-creates a fixed number of worker threads (often one per CPU core) and reuses them across many tasks, queuing tasks when all workers are busy — the same idea as a database connection pool. This avoids the repeated cost of thread creation/teardown under load. Libraries like `piscina` implement this pattern in production rather than hand-rolling it.

**Q: Can worker threads share memory, and how does that differ from Node's clustered processes?**
Answer: Yes — `worker_threads` supports `SharedArrayBuffer`, allowing multiple threads within the same process to read/write the same underlying memory concurrently (with `Atomics` for safe coordination). This isn't possible with `cluster`, where each worker is a fully separate OS process with entirely isolated memory — the only way to share state across cluster workers is through an external store like Redis or a database.
