# Web Workers — Complete Guide

## Table of Contents
1. [Why Web Workers Exist](#1-why-web-workers-exist)
2. [Main Thread vs Worker Thread](#2-main-thread-vs-worker-thread)
3. [Creating and Communicating with a Worker](#3-creating-and-communicating-with-a-worker)
4. [A Complete Worked Example](#4-a-complete-worked-example)
5. [Limitations of Web Workers](#5-limitations-of-web-workers)
6. [When to Use a Worker](#6-when-to-use-a-worker)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Web Workers Exist

JavaScript in the browser runs on a single main thread — the same thread responsible for rendering the page, running your application code, and responding to clicks, scrolls, and keystrokes. If a computation takes too long (say, processing a large array, running a complex calculation, or parsing a huge JSON blob), it **blocks** that single thread entirely — the page becomes visibly unresponsive, scrolling stutters or freezes, and clicks don't register, until the computation finishes.

```
Without a Web Worker — everything competes for ONE thread:

  Main Thread
  ┌──────────────────────────────────────────────────────────┐
  │  Render page → Handle click → Handle scroll →             │
  │  [ 3-second heavy computation — thread is BLOCKED here ]  │
  │  → page frozen, no clicks/scrolls/renders processed        │
  │  → Handle click → Render page → ...                       │
  └──────────────────────────────────────────────────────────┘

With a Web Worker — heavy computation moves to its OWN thread:

  Main Thread                          Worker Thread
  ┌───────────────────────────┐        ┌──────────────────────┐
  │ Render page                │        │                      │
  │ Handle click                │        │  3-second heavy       │
  │ Handle scroll  (never      │◄──────►│  computation runs      │
  │ blocked — stays responsive) │postMsg │  HERE, independently   │
  │ Render page                 │        │  of the main thread    │
  └───────────────────────────┘        └──────────────────────┘
```

Web Workers are the browser's built-in mechanism for running JavaScript on a genuinely separate OS-level thread, so expensive computation no longer has to compete with rendering and user interaction for the same single thread.

---

## 2. Main Thread vs Worker Thread

```
Main Thread                              Worker Thread
────────────────────────────────────────────────────────────────
Has full DOM access — can query,          NO DOM access whatsoever —
modify, and render elements                cannot touch document,
                                            window, or any DOM node
                                            directly

Runs your application's primary logic,     Runs an ENTIRELY SEPARATE
event handlers, rendering                  script file, in its own
                                            isolated global scope

Shares memory space with the page's        Does NOT share memory with
rendering pipeline                          the main thread — communicates
                                            ONLY via message-passing
                                            (postMessage), which
                                            serializes data being sent

Blocking this thread freezes the           Blocking THIS thread has
entire visible page                        ZERO effect on page
                                            responsiveness — that's
                                            the whole point

Can create/terminate workers                Can create further NESTED
                                            workers (rare in practice),
                                            and use fetch(), setTimeout,
                                            and other non-DOM Web APIs
```

The key architectural constraint: since a worker cannot touch the DOM, it is only useful for **pure computation** — number crunching, data transformation, parsing — not for anything that needs to read or update what's on screen. The main thread remains responsible for all rendering; the worker just does the heavy lifting and reports results back.

---

## 3. Creating and Communicating with a Worker

A worker is created from a separate JavaScript file. Communication in both directions happens exclusively through `postMessage()` (to send) and an `onmessage`/`message` event listener (to receive) — there is no shared variable or direct function call between the two threads.

```js
// main.js  (runs on the MAIN thread)
const worker = new Worker("worker.js");

worker.postMessage({ command: "start", payload: [1, 2, 3, 4, 5] });

worker.onmessage = (event) => {
  console.log("Received from worker:", event.data);
};

worker.onerror = (error) => {
  console.error("Worker error:", error.message, "at", error.filename, ":", error.lineno);
};

// When you're completely done with the worker, terminate it to free resources:
// worker.terminate();
```

```js
// worker.js  (runs on the WORKER thread — a completely separate global scope)
self.onmessage = (event) => {
  const { command, payload } = event.data;

  if (command === "start") {
    const result = payload.map((n) => n * n); // pretend this is expensive work
    self.postMessage({ status: "done", result });
  }
};
```

### Field-by-Field Breakdown

```
new Worker("worker.js")
  ↳ Loads and starts running worker.js in a brand-new thread and
    global scope. The path is relative to the current page's URL.

worker.postMessage(data)
  ↳ Sends `data` to the worker. `data` is (deep) CLONED using the
    structured clone algorithm — it is NOT the same object in memory
    on both sides. Functions, DOM nodes, and some other types cannot
    be cloned and will throw if you try to send them.

worker.onmessage = (event) => { ... }
  ↳ Runs on the MAIN thread whenever the worker calls postMessage.
    event.data contains whatever the worker sent.

self.onmessage = (event) => { ... }   (inside worker.js)
  ↳ `self` refers to the worker's own global scope (there is no
    `window` inside a worker — DOM-related globals don't exist there).
  ↳ Runs INSIDE the worker whenever the main thread calls postMessage.

self.postMessage(data)   (inside worker.js)
  ↳ Sends data back to the main thread, received by worker.onmessage there.

worker.terminate()
  ↳ Immediately stops the worker and frees its thread/resources.
    Always terminate workers you no longer need — like an
    un-cleared watchPosition, an abandoned worker silently
    consumes memory and a thread indefinitely.
```

---

## 4. A Complete Worked Example

A realistic scenario: the main thread needs to process a large array (say, checking which of 5 million numbers are prime) without freezing the UI.

```js
// main.js
const statusEl = document.getElementById("status");
const worker = new Worker("prime-worker.js");

document.getElementById("startBtn").addEventListener("click", () => {
  statusEl.textContent = "Working...";
  worker.postMessage({ upperLimit: 2_000_000 });
});

worker.onmessage = (event) => {
  const { primeCount, elapsedMs } = event.data;
  statusEl.textContent = `Found ${primeCount} primes in ${elapsedMs}ms`;
};

// Meanwhile, the page's own animations, scrolling, and click handling
// continue working perfectly smoothly — try scrolling the page or
// clicking another button WHILE the worker is crunching numbers,
// and confirm the UI never stutters.
```

```js
// prime-worker.js
function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false;
  }
  return true;
}

self.onmessage = (event) => {
  const { upperLimit } = event.data;
  const start = performance.now();

  let primeCount = 0;
  for (let n = 2; n <= upperLimit; n++) {
    if (isPrime(n)) primeCount++;
  }

  const elapsedMs = Math.round(performance.now() - start);
  self.postMessage({ primeCount, elapsedMs });
};
```

If this same prime-counting loop ran directly on the main thread instead, the page would completely freeze — no scrolling, no click response, no repaints — for however long the computation takes. Moving it into a worker keeps the page fully interactive throughout, at the cost of the worker needing to message the result back rather than simply returning it inline.

---

## 5. Limitations of Web Workers

```
1. NO DOM access
   Cannot use document, cannot query or modify elements, cannot
   attach event listeners to page elements. A worker can only
   compute and message results back to the main thread, which then
   updates the DOM itself.

2. NO access to `window`
   Many main-thread-only globals (window, parent, and DOM-specific
   Web APIs) simply don't exist inside a worker's scope. Workers DO
   have access to: self, fetch, setTimeout/setInterval, WebSockets,
   IndexedDB, and most non-DOM Web APIs.

3. Communication is message-passing only, with cloned data
   You cannot share a JavaScript object by reference between the
   main thread and a worker — every postMessage call performs a
   deep clone (via the structured clone algorithm) of the data being
   sent, which has a real performance cost for very large payloads.
   (Transferable objects like ArrayBuffer can be MOVED rather than
   cloned for better performance in advanced use cases, but that's
   an optimization beyond this lesson's scope.)

4. Separate script file required
   A worker's code must live in its own JS file (or be constructed
   from a Blob URL for advanced dynamic-worker-creation scenarios) —
   you cannot simply pass an inline function the way you might
   expect from other concurrency APIs.

5. Startup and messaging have overhead
   Creating a worker and passing messages back and forth isn't free —
   for very small, fast computations, the overhead of spinning up a
   worker and cloning data across the boundary can exceed the time
   saved, making workers most worthwhile for GENUINELY expensive work.
```

---

## 6. When to Use a Worker

```
Good fits for a Web Worker:
  - Heavy numeric computation (image/audio processing, cryptography,
    complex simulations, large dataset transformations)
  - Parsing very large JSON or CSV payloads
  - Running a computationally expensive algorithm (pathfinding, a
    large sort/search) that would otherwise cause visible jank

Poor fits for a Web Worker:
  - Anything that needs direct, frequent DOM manipulation
  - Very short/cheap computations, where thread + message overhead
    would outweigh the benefit
  - Simple async I/O (a normal fetch() call) — fetch is ALREADY
    non-blocking on the main thread via the event loop (see Phase 5),
    so wrapping a simple fetch in a worker adds complexity without
    solving a real blocking problem
```

---

## 7. Hands-On Exercises

**Exercise 1:** Recreate the prime-counting example from Section 4 exactly as written. First run the prime-counting loop directly on the main thread (no worker) with a click handler, and try scrolling/clicking elsewhere on the page while it's running — observe the freeze. Then move the same logic into a worker as shown, and confirm the page stays fully responsive during the same computation.

**Exercise 2:** Build a worker that takes a large array of numbers (generate at least 1,000,000 random numbers on the main thread) and computes their sum, average, minimum, and maximum, sending all four results back in a single message. Measure and log how long the round trip takes using `performance.now()` on both the main thread (total time including message overhead) and inside the worker (pure computation time), and compare the two.

**Exercise 3:** Deliberately try to access `document` inside your worker script (e.g., `document.title = "test"`) and observe the exact error that occurs, pasting it into a code comment. Also try accessing `window` inside the worker and note whether that specific reference even exists there.

**Exercise 4:** Write a worker that receives an array of objects (not just primitives) via `postMessage`, modifies a property on one of the received objects inside the worker, and sends the modified array back. On the main thread, keep a reference to the ORIGINAL array you sent and confirm, after receiving the worker's response, that your original array on the main thread was NOT mutated — demonstrating that `postMessage` clones data rather than sharing it by reference.

**Exercise 5:** Build a small UI with a "Start heavy task" button (spawns a worker to do a few seconds of computation) and a "Cancel" button that calls `worker.terminate()` mid-computation. Confirm that clicking "Cancel" partway through immediately stops the worker (no further `onmessage` ever fires for that worker instance) and log a message confirming termination.

---

## 8. Interview Q&A

**Q: What problem do Web Workers solve, and why can't you just use `setTimeout` or a Promise to avoid blocking the main thread instead?**
Answer: JavaScript in the browser runs on a single main thread shared by application logic, rendering, and user-interaction handling, so any sufficiently expensive synchronous computation — a large loop, heavy number crunching, parsing a huge payload — blocks that one thread entirely for its duration, freezing scrolling, click handling, and rendering until it finishes. `setTimeout` and Promises don't solve this at all: they only control *when* a piece of code starts running relative to the event loop's queues (see Phase 5's event loop lesson), but once that code actually starts executing, it still runs synchronously on the same single main thread and blocks it just as much as if it had been called directly — wrapping an expensive loop in a `setTimeout(fn, 0)` doesn't make the loop itself run any faster or on a different thread, it just delays when the blocking starts. Web Workers are fundamentally different: they run JavaScript on a genuinely separate OS-level thread, so expensive computation happening inside a worker literally cannot block the main thread's ability to render and respond to interaction, because the two are physically separate execution contexts.

**Q: Why can't a Web Worker access the DOM, and what does that constrain it to being used for?**
Answer: The DOM is not thread-safe — allowing multiple threads to simultaneously read and mutate the same document structure would create serious race conditions and correctness problems in the browser's rendering engine, so the browser simply does not expose `document`, `window`, or any DOM-related API inside a worker's global scope at all; a worker runs in its own isolated context where those globals don't exist. This constrains workers to being useful only for pure computation that doesn't need to touch what's on screen — numeric processing, data transformation, parsing — with the worker sending its computed *result* back to the main thread via `postMessage`, and the main thread being the one that actually updates the DOM with that result. This division of labor — worker computes, main thread renders — is the fundamental architectural pattern for using workers correctly.

**Q: How do the main thread and a worker actually communicate, given that a worker can't share variables directly with the main thread?**
Answer: Communication happens exclusively through message-passing: the main thread calls `worker.postMessage(data)` to send data to the worker, which receives it inside a `self.onmessage` handler via `event.data`; the worker can send data back the same way, calling `self.postMessage(data)`, which the main thread receives through the `worker.onmessage` handler it registered. Critically, the data passed through `postMessage` is not shared by reference — it undergoes a deep clone via the structured clone algorithm, meaning the object received on the other side is a separate copy, not the same object in memory; mutating the received copy inside the worker has no effect whatsoever on the original object still held by the main thread, and vice versa. This is a deliberate design choice that avoids the far more complex and error-prone alternative of true shared, mutable memory across threads, at the cost of a real (though usually acceptable) performance overhead for cloning large payloads across the boundary.

**Q: Given the overhead of creating a worker and cloning data across the main-thread/worker boundary, when is it actually NOT worth using a Web Worker?**
Answer: Workers are not worth the overhead for computations that are already fast or cheap — spinning up a worker thread and cloning data across the postMessage boundary both have real, measurable cost, and for a computation that would only take a few milliseconds on the main thread anyway, that overhead can easily exceed whatever time would theoretically be "saved," making the worker version net slower and unnecessarily more complex. Workers are also the wrong tool for anything that fundamentally needs the DOM — since a worker cannot touch `document` at all, tasks involving frequent DOM reads or updates simply cannot be offloaded this way, regardless of how expensive they are. Finally, workers are unnecessary for ordinary asynchronous I/O like a typical `fetch()` call, because `fetch` is already non-blocking on the main thread by nature of the browser's event loop and Web APIs model (covered in Phase 5) — the network request itself doesn't tie up the main thread while waiting, so wrapping a plain `fetch` call in a worker adds complexity without solving an actual blocking problem; workers earn their overhead specifically for genuinely CPU-bound, synchronous computation that would otherwise run for a noticeable, blocking duration on the main thread.

**Q: What happens to a Web Worker's resources if you forget to call `terminate()` on it, and when should you call it?**
Answer: A worker that is never explicitly terminated continues running indefinitely in its own thread, holding onto whatever memory and thread resources it was allocated, even after the main-thread code that created it has finished using it or moved on to other logic — this is directly analogous to forgetting to call `clearWatch()` after a Geolocation `watchPosition` subscription, or forgetting to remove an event listener that's no longer needed, and is a real, avoidable resource leak. You should call `worker.terminate()` as soon as you know the worker's job is genuinely finished and no more messages will be sent to or expected from it — for example, when a user navigates away from a feature that used a worker in a single-page application, when a cancel button is clicked mid-computation, or once a worker has sent back its final result and won't be reused. Properly terminating workers you no longer need is a basic but easily overlooked piece of resource hygiene in any application that creates them dynamically rather than keeping exactly one long-lived worker for the entire page's lifetime.
