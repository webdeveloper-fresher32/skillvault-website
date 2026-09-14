# Event Loop and Fetch API — Complete Guide

## Table of Contents
1. [The Single Thread Problem](#1-the-single-thread-problem)
2. [The Four Pieces: Call Stack, Web APIs, Callback Queue, Microtask Queue](#2-the-four-pieces-call-stack-web-apis-callback-queue-microtask-queue)
3. [Full Execution Trace](#3-full-execution-trace)
4. [Why Microtasks Jump Ahead of Macrotasks](#4-why-microtasks-jump-ahead-of-macrotasks)
5. [The Fetch API: Basics](#5-the-fetch-api-basics)
6. [The Fetch API: POST, Headers, and Error Handling](#6-the-fetch-api-post-headers-and-error-handling)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Single Thread Problem

JavaScript engines run on a single thread: one call stack, one instruction executing at any instant. If a long network request or a timer blocked that thread while waiting, the entire page — scrolling, clicks, animations — would freeze until it finished. The **event loop** is the mechanism that makes this not happen: it lets JavaScript hand off waiting to the browser (or Node.js) runtime, keep executing other code in the meantime, and come back to run a callback only once the wait is over, one task at a time, forever cycling.

This section is the single most interview-tested topic in JavaScript. Interviewers commonly show a short snippet mixing `console.log`, `setTimeout`, and `.then()` and ask you to predict the exact order of output. The rest of this lesson builds the mental model needed to answer that reliably, then traces a real example step by step.

---

## 2. The Four Pieces: Call Stack, Web APIs, Callback Queue, Microtask Queue

```
                         ┌─────────────────────────────┐
                         │        CALL STACK            │
                         │  (LIFO — one thing at a time)│
                         │                               │
                         │   currently executing frame   │
                         └───────────────┬───────────────┘
                                         │  pushes/pops as functions
                                         │  call and return
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
        ▼                                ▼                                ▼
┌───────────────┐              ┌──────────────────┐             ┌──────────────────┐
│   WEB APIs     │              │  MICROTASK QUEUE  │             │  CALLBACK QUEUE   │
│ (browser/Node  │              │  (a.k.a. Job Queue)│             │ (a.k.a. Macrotask │
│  C++ runtime)  │              │                    │             │  / Task Queue)    │
│                │              │  Promise .then/    │             │                   │
│ setTimeout     │──callback───▶│  .catch/.finally   │             │  setTimeout        │
│ fetch          │  when done   │  queeued.microtask │             │  setInterval        │
│ DOM events     │              │  MutationObserver  │             │  DOM events         │
│                │              │                    │             │  (their callbacks)  │
└───────────────┘              └─────────┬──────────┘             └─────────┬─────────┘
                                          │                                  │
                                          │   EVENT LOOP:                    │
                                          │   1. Run ALL microtasks         │
                                          │      until queue is EMPTY       │
                                          │   2. THEN take ONE macrotask     │
                                          │      from callback queue         │
                                          │   3. Run ALL microtasks again    │
                                          │   4. Repeat forever              │
                                          ▼                                  ▼
                              (only runs when call stack is completely empty)
```

- **Call stack** — where synchronously executing code actually runs. Functions push a frame when called, pop it when they return. Only one frame executes at a time.
- **Web APIs** (browser) / **C++ APIs** (Node) — `setTimeout`, `fetch`, DOM event listeners, file I/O are *not* implemented in JavaScript itself; they're handed off to the surrounding runtime, which does the actual waiting outside the JS thread and schedules a callback once done.
- **Callback queue** (macrotask queue) — where completed `setTimeout`/`setInterval` callbacks, DOM event callbacks, and I/O callbacks wait their turn to run.
- **Microtask queue** — where completed Promise callbacks (`.then`, `.catch`, `.finally`) and `queueMicrotask()` callbacks wait their turn. This queue has **strictly higher priority** than the callback queue.

The **event loop** itself is simple: it continuously checks "is the call stack empty?" — and when it is, it first drains the *entire* microtask queue (running every microtask, even ones added by other microtasks during this drain), and only once that queue is completely empty does it pull a single task from the macrotask/callback queue to run.

---

## 3. Full Execution Trace

Trace this exact script line by line:

```js
console.log("1: script start");

setTimeout(() => {
  console.log("2: setTimeout callback");
}, 0);

Promise.resolve()
  .then(() => {
    console.log("3: promise then #1");
  })
  .then(() => {
    console.log("4: promise then #2");
  });

console.log("5: script end");

// Output:
// 1: script start
// 5: script end
// 3: promise then #1
// 4: promise then #2
// 2: setTimeout callback
```

```
Step-by-step trace:

STEP 1 — call stack runs console.log("1: script start")
  Call stack: [main script, console.log]
  → prints "1: script start" immediately, pops off stack

STEP 2 — call stack runs setTimeout(cb, 0)
  setTimeout is a Web API call — the browser starts a 0ms timer
  in its own C++ runtime, OUTSIDE the JS thread, and immediately
  returns control to the script. The callback is NOT queued yet —
  it gets queued to the CALLBACK QUEUE only once the timer elapses.
  Call stack: [main script]   (setTimeout call already popped)

STEP 3 — call stack runs Promise.resolve().then(cb1).then(cb2)
  Promise.resolve() is ALREADY fulfilled synchronously.
  .then(cb1) queues cb1 to the MICROTASK QUEUE immediately
  (it does not run yet — .then always defers to at least a microtask tick).
  .then(cb2) is chained onto the Promise .then(cb1) returns, so cb2
  is only queued once cb1 actually finishes running.
  Call stack: [main script]
  Microtask queue: [cb1]

STEP 4 — call stack runs console.log("5: script end")
  → prints "5: script end" immediately

STEP 5 — main script finishes, call stack is now EMPTY
  Event loop checks: is the call stack empty? YES.
  → Drain the microtask queue COMPLETELY before touching the callback queue.

STEP 6 — run cb1 from microtask queue
  → prints "3: promise then #1"
  cb1 finishing causes cb2 to be queued to the microtask queue NOW.
  Microtask queue: [cb2]
  → Because we drain microtasks until EMPTY (not just once), we
    continue and run cb2 too, in this SAME pass, before moving on.

STEP 7 — run cb2 from microtask queue
  → prints "4: promise then #2"
  Microtask queue is now empty.

STEP 8 — microtask queue empty. NOW check the callback (macrotask) queue.
  The setTimeout's 0ms timer elapsed long ago (during steps 1-7,
  which took microseconds) — its callback has been sitting in the
  callback queue this whole time, waiting for its turn.
  → Pull it and run it.
  → prints "2: setTimeout callback"

Final output order:
  1: script start
  5: script end
  3: promise then #1
  4: promise then #2
  2: setTimeout callback
```

The key insight interviewers are testing: **`setTimeout(fn, 0)` does not mean "run immediately"** — it means "run as soon as possible, but only after the current synchronous script finishes AND after every pending microtask has drained." A Promise `.then()`, even chained multiple times, will always fully resolve before a `setTimeout(..., 0)` gets its turn.

---

## 4. Why Microtasks Jump Ahead of Macrotasks

This is a deliberate design decision in the JavaScript specification (ECMA-262), not an accident of implementation.

```
Rule: after the currently running script/task finishes, and before
the event loop is allowed to pick up the NEXT macrotask, it MUST
completely drain the microtask queue — including any new microtasks
added while draining it.

Why this ordering exists:
  Promises are meant to represent "the result of work that has
  ALREADY effectively finished, just needs its continuation run."
  Giving Promise callbacks priority means a chain of .then() calls
  resolves as tightly and predictably as possible, without other
  unrelated events (timers, clicks, I/O) being interleaved in the
  middle of a logical sequence of dependent steps.

  If macrotasks could interleave with a Promise chain's execution,
  a long .then().then().then() chain could have a setTimeout or a
  click handler fire in between links — breaking the "this happens
  right after that, atomically enough" guarantee developers rely on.

Practical consequence: an infinite chain of microtasks (e.g., a
.then() that queues another .then() recursively, forever) will
"starve" the callback queue completely — no setTimeout, no click
handler, no rendering will EVER get a turn, because the event loop
is stuck draining an ever-refilling microtask queue. This is a real
bug pattern, sometimes called "microtask starvation."
```

```js
// Microtask starvation example — DO NOT run this in a real page,
// it will freeze the UI forever:
function starve() {
  Promise.resolve().then(starve); // queues another microtask, forever
}
starve();
// setTimeout, clicks, and rendering will NEVER run after this —
// the microtask queue never empties.
```

---

## 5. The Fetch API: Basics

`fetch()` is the modern, Promise-based API for making HTTP requests, replacing the older callback-based `XMLHttpRequest`. `fetch()` itself returns a Promise that resolves with a `Response` object as soon as the HTTP response headers arrive — **before** the body has necessarily finished downloading or been parsed.

```js
async function getUsers() {
  const response = await fetch("https://api.example.com/users");
  const users = await response.json(); // a SECOND await — parses the body as JSON
  console.log(users);
}
```

### Field-by-Field Breakdown

```
fetch(url)
  ↳ Returns a Promise<Response>.
  ↳ Resolves as soon as the server sends response HEADERS — even a
    404 or 500 response resolves fetch's Promise successfully!
  ↳ fetch's Promise only REJECTS on network-level failures: DNS
    failure, no connection, CORS block. It does NOT reject on
    HTTP error status codes (see Section 6 — this trips people up).

response.ok
  ↳ Boolean — true if status is in the 200-299 range.

response.status / response.statusText
  ↳ The numeric HTTP status code (200, 404, 500...) and its text.

response.json()
  ↳ Returns ANOTHER Promise, resolving with the body parsed as JSON.
  ↳ Async because reading the response body is itself a streaming
    operation that may not have completed yet.

response.text()
  ↳ Like .json() but resolves with the raw response body as a string.

response.headers
  ↳ A Headers object. Use response.headers.get('Content-Type').
```

---

## 6. The Fetch API: POST, Headers, and Error Handling

```js
async function createUser(userData) {
  const response = await fetch("https://api.example.com/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer abc123token",
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    // fetch does NOT throw for 4xx/5xx — you must check response.ok
    // yourself and throw manually if you want error-style handling.
    const errorBody = await response.json().catch(() => null);
    throw new Error(
      `Request failed with status ${response.status}: ${errorBody?.message ?? response.statusText}`
    );
  }

  return response.json();
}

async function main() {
  try {
    const newUser = await createUser({ name: "Meera", email: "meera@example.com" });
    console.log("Created:", newUser);
  } catch (err) {
    console.error("Could not create user:", err.message);
  }
}
```

### Field-by-Field Breakdown

```
method: "POST"
  ↳ HTTP verb. Defaults to "GET" if omitted.

headers: { ... }
  ↳ Plain object or a Headers instance.
  ↳ "Content-Type": "application/json" tells the server how to
    parse the body you're sending.
  ↳ "Authorization" carries auth tokens — never hardcode real
    secrets in client-side JS shipped to a browser.

body: JSON.stringify(userData)
  ↳ fetch does NOT auto-serialize objects — you must stringify
    yourself, and the server must be told via Content-Type that
    it's receiving JSON.

if (!response.ok) { throw ... }
  ↳ THE critical error-handling step. Because fetch resolves
    (does not reject) on 404/500, YOU are responsible for checking
    response.ok (or response.status) and throwing manually if you
    want a failed HTTP request to behave like a rejected Promise
    that a .catch() or try/catch can handle.

.catch(() => null) on response.json()
  ↳ Defensive: an error response body might not even be valid JSON
    (e.g., an HTML error page from a proxy), so this prevents a
    second, unrelated parsing error from masking the real one.
```

```
Common mistake this section prevents:

  const response = await fetch(url);
  const data = await response.json();   // assumes success blindly

  If the server returns a 404 with a JSON error body like
  { "message": "Not found" }, this code happily "succeeds" and
  returns that error object as if it were valid data — because
  fetch's Promise resolved normally. Always check response.ok first.
```

---

## 7. Hands-On Exercises

**Exercise 1:** Without running any code, hand-trace the output order of this snippet on paper, labeling each `console.log` with the step number it executes at (call stack / microtask / macrotask), then run it in a browser console or Node.js to check your answer:
```js
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
setTimeout(() => console.log("D"), 0);
Promise.resolve().then(() => console.log("E")).then(() => console.log("F"));
console.log("G");
```

**Exercise 2:** Write and run the "microtask starvation" example from Section 4 in a Node.js script (not a browser tab, to avoid truly freezing your machine) with an added `let count = 0` guard that stops after 100,000 iterations and logs a message. Add a `setTimeout(() => console.log("did I ever run?"), 0)` before starting the starving chain, and confirm it never logs until the chain is capped.

**Exercise 3:** Use `fetch()` against a free public API (e.g., `https://jsonplaceholder.typicode.com/users`) to GET a list of users, log just their names, then POST a new fake post to `https://jsonplaceholder.typicode.com/posts` with a JSON body containing `title`, `body`, and `userId` fields, logging the server's response.

**Exercise 4:** Intentionally fetch a URL that returns a 404 (e.g., `https://jsonplaceholder.typicode.com/nonexistent-route`) and first observe that `response.ok` is `false` while the `await fetch(...)` line itself does NOT throw. Then wrap your fetch call with the `if (!response.ok) throw new Error(...)` pattern from Section 6 and confirm the same request now triggers your `catch` block.

**Exercise 5:** Write a small function `fetchWithTimeout(url, ms)` that races a `fetch(url)` call against a Promise that rejects after `ms` milliseconds (using `Promise.race`, from the previous lesson), so a slow or hanging request fails fast instead of waiting forever. Test it against a real endpoint with a generous timeout (should succeed) and a deliberately short timeout like `1ms` (should reject with your custom timeout error).

---

## 8. Interview Q&A

**Q: Walk through what the call stack, Web APIs, callback queue, and microtask queue each do, and how the event loop coordinates them.**
Answer: The call stack is where JavaScript actually executes code, one frame at a time, in a strict last-in-first-out order. When code calls an asynchronous browser or Node API — `setTimeout`, `fetch`, a DOM event listener — that work is handed off to the surrounding runtime's Web APIs (implemented outside the JS thread, often in C++), which does the actual waiting and, once done, places a completion callback into either the callback queue (for `setTimeout`, DOM events, I/O) or the microtask queue (for Promise `.then`/`.catch`/`.finally` and `queueMicrotask`). The event loop's job is simple but strict: whenever the call stack becomes completely empty, it first drains the entire microtask queue — running every microtask, including new ones added while draining — and only once that queue is fully empty does it pull a single task from the callback queue to execute. Then it repeats: drain microtasks again, pull one more macrotask, forever.

**Q: Why does a Promise's .then() callback run before a setTimeout(fn, 0) callback, even though both were scheduled at essentially the same time?**
Answer: This is because Promise callbacks are microtasks and `setTimeout` callbacks are macrotasks, and the event loop specification requires the microtask queue to be completely drained before the event loop is allowed to process even a single macrotask. So after the main synchronous script finishes, the engine checks the microtask queue first — every `.then()` callback that's ready gets run, including any additional microtasks those callbacks themselves queue — and only once that queue is fully empty does the engine look at the callback queue and pull one macrotask, such as a `setTimeout` callback, to run. This ordering is deliberate, not incidental: it lets a chain of dependent Promise continuations resolve as a tight, uninterrupted unit before any unrelated timer or event callback can be interleaved into the middle of that sequence.

**Q: What is "microtask starvation" and why is it dangerous?**
Answer: Microtask starvation happens when a microtask callback queues another microtask, which queues another, indefinitely — for example, a `.then()` handler that calls `Promise.resolve().then(sameHandler)` recursively. Because the event loop's rule is to fully drain the microtask queue before touching the callback queue, and because this pattern keeps refilling the microtask queue faster than it can ever become empty, the event loop gets stuck processing microtasks forever and never reaches the callback queue. In a browser, this means `setTimeout` callbacks, click handlers, and even rendering updates never get a chance to run — the page appears completely frozen even though the JavaScript thread is technically still executing code. It's a real production bug pattern, usually introduced accidentally through a recursive Promise chain that was meant to be a controlled retry loop but is missing a base case or a `setTimeout`-based yield back to the macrotask queue.

**Q: Does fetch() reject when the server responds with a 404 or 500 status code? How should you handle HTTP errors correctly?**
Answer: No — this is one of the most common `fetch` mistakes. The Promise returned by `fetch()` only rejects on network-level failures, such as a DNS lookup failure, no network connection, or a CORS policy block; it resolves successfully as soon as the server sends back ANY HTTP response, including 404s and 500s, because from `fetch`'s point of view, the HTTP request-response cycle itself completed without error. To handle HTTP-level failures correctly, you must explicitly check the `response.ok` boolean (true for status codes 200-299) or inspect `response.status` after awaiting `fetch()`, and manually `throw` an `Error` if the status indicates failure — only then will a surrounding `try`/`catch` or a `.catch()` on the chain actually catch it. Skipping this check is a common bug where code blindly calls `response.json()` on an error response and proceeds as if it received valid data.

**Q: What is the difference between fetch()'s first Promise resolving and response.json() resolving — why are there two separate await calls?**
Answer: `fetch()`'s returned Promise resolves as soon as the HTTP response headers have arrived from the server — at that point you know the status code, status text, and headers, but the response body may still be streaming in and has not necessarily been fully received or parsed yet. Calling `response.json()` (or `.text()`, `.blob()`, etc.) returns a second, separate Promise because reading and parsing the body is its own asynchronous operation, potentially requiring more data to arrive over the network and then be decoded. This two-step Promise design is intentional: it lets code inspect status and headers (for example, to decide whether to even bother parsing the body, or to parse it as JSON versus plain text) before committing to the cost of reading and parsing a potentially large response body.
