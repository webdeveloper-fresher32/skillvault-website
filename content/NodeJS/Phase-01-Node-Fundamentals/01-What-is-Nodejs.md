# What is Node.js — Complete Guide

## Table of Contents
1. [The Problem Node.js Solves](#1-the-problem-nodejs-solves)
2. [What is Node.js?](#2-what-is-nodejs)
3. [The V8 Engine](#3-the-v8-engine)
4. [Node.js Architecture](#4-nodejs-architecture)
5. [Node vs Browser JavaScript](#5-node-vs-browser-javascript)
6. [The Single-Threaded Event Loop Model](#6-the-single-threaded-event-loop-model)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem Node.js Solves

Before 2009, JavaScript lived only in the browser. If you wanted a web server, you reached for PHP, Python, Java, or Ruby — a different language than your frontend. This meant:

```
Traditional full-stack setup (pre-Node):

  Frontend:  JavaScript (in the browser)
  Backend:   Python / Java / PHP / Ruby (on the server)

  Result: two languages, two mental models, two sets of
  standard libraries, code cannot be shared between them.
```

Node.js took Chrome's JavaScript engine (V8), pulled it out of the browser, bolted on filesystem/network/OS APIs, and let JavaScript run as a standalone program on a server or your laptop — no browser required.

```
With Node.js:

  Frontend:  JavaScript / React
  Backend:   JavaScript / Node.js

  Result: one language across the whole stack. Shared
  validation logic, shared types (with TypeScript), one
  hiring pool, one set of syntax rules to remember.
```

This is exactly why Node.js exploded in popularity with teams that already had strong JavaScript/React skills on the frontend — the backend became approachable without learning a second language.

---

## 2. What is Node.js?

**Node.js is not a language, not a framework — it is a runtime.** A runtime is the environment that executes your code and gives it capabilities beyond what the language itself defines.

```
JavaScript (the language)
   + V8 (Google's JS engine — compiles/runs JS)
   + libuv (C++ library — async I/O, thread pool, event loop)
   + Bindings to OS features (filesystem, network, processes)
   ─────────────────────────────────────────────────────
   = Node.js (a runtime for executing JS outside a browser)
```

Formally: **Node.js is a JavaScript runtime built on Chrome's V8 engine that lets you run JavaScript outside a web browser, with built-in APIs for file I/O, networking, and operating system interaction.**

Node.js is used to build:
- HTTP servers and REST/GraphQL APIs (what this course focuses on)
- Command-line tools (npm itself is built on Node)
- Build tooling (webpack, vite, babel all run on Node)
- Real-time applications (chat, live dashboards) via WebSockets
- Desktop apps (Electron — VS Code, Slack, Discord run on Node under the hood)

What Node.js is **not**:
- Not a language — you still write plain JavaScript (or TypeScript, compiled down to JS).
- Not a web framework — Express, Fastify, and NestJS are frameworks that run *on top of* Node.
- Not multi-threaded by default — more on this in section 6.

---

## 3. The V8 Engine

V8 is an open-source JavaScript engine written in C++ by Google, originally built for Chrome. Its job: take JavaScript source code and execute it as fast as possible.

```
Your .js file
     │
     ▼
┌─────────────────────────────────────────────┐
│                  V8 Engine                   │
│                                               │
│  1. Parser        → builds an AST            │
│                      (Abstract Syntax Tree)  │
│  2. Ignition      → interpreter, produces    │
│                      bytecode quickly        │
│  3. TurboFan      → JIT compiler, optimizes  │
│                      "hot" (frequently run)  │
│                      code into fast machine  │
│                      code                    │
│  4. Garbage       → automatically frees      │
│     Collector       memory no longer in use  │
└─────────────────────────────────────────────┘
     │
     ▼
  Machine code executed by your CPU
```

Key facts about V8:
- **JIT (Just-In-Time) compiled**: JavaScript is not interpreted line-by-line forever — hot code paths get compiled to optimized machine code while the program runs, which is why modern JS is fast.
- **Same engine, two hosts**: Chrome embeds V8 to run page scripts; Node.js embeds the exact same V8 to run server scripts. The engine doesn't know or care whether it's in a browser tab or a terminal.
- **Node adds what V8 doesn't have**: V8 alone only understands the JavaScript language (ECMAScript spec) — `Array`, `Promise`, `JSON`, `Math`, etc. It has **no** concept of files, network sockets, or `require`. Node.js wraps V8 and injects those extra APIs.

```
                V8 knows about:              Node.js adds:
                ─────────────────            ─────────────────
                let, const, functions         fs (filesystem)
                Array, Object, Map            http, net (networking)
                Promise, async/await          process
                JSON, Math, Date              require/module
                classes, closures             Buffer
                                              child_process, os, path...
```

---

## 4. Node.js Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                         Your JS Code                          │
│              (server.js, app.js, route handlers)              │
└───────────────────────────────────┬───────────────────────────┘
                                     │
┌───────────────────────────────────▼───────────────────────────┐
│                      Node.js Bindings / APIs                  │
│     fs, http, path, process, Buffer, require/import, etc.     │
└───────────────────────┬─────────────────────┬─────────────────┘
                         │                     │
                ┌────────▼────────┐   ┌────────▼─────────────┐
                │   V8 Engine     │   │       libuv          │
                │ (runs JS code,  │   │ (event loop, async   │
                │  memory mgmt)   │   │  I/O, thread pool,   │
                │                 │   │  timers, networking) │
                └─────────────────┘   └───────────────────────┘
                                                 │
                                     ┌───────────▼────────────┐
                                     │   Operating System     │
                                     │ (disk, network, CPU)   │
                                     └─────────────────────────┘
```

**libuv** is the unsung hero of Node.js — a C library that provides the event loop and a thread pool. It's what allows Node to say "go read this file, and call me back when you're done" instead of freezing while waiting on disk I/O. You'll go deep on the event loop in a later phase; for now, just know it's the reason Node can serve thousands of concurrent connections on one thread.

---

## 5. Node vs Browser JavaScript

Both environments run JavaScript through V8 (or a V8-like engine), but they expose completely different sets of built-in objects because they solve different problems.

| Capability | Browser | Node.js |
|---|---|---|
| `window`, `document` | Yes — the DOM | No DOM at all |
| `fetch` | Yes (built-in) | Available globally since Node 18+ |
| File system access | No (sandboxed for security) | Yes — full `fs` module |
| `require`/`import` modules | ES Modules only (via `<script type="module">`) | Both CommonJS (`require`) and ESM (`import`) |
| `localStorage`/`sessionStorage` | Yes | No (that's a browser-only storage API) |
| Networking | `fetch`, `XMLHttpRequest`, `WebSocket` (client) | `http`, `net`, `dgram` (can act as client *or* server) |
| `process` object | No | Yes — env vars, argv, exit codes |
| Multiple browser tabs / windows | Yes (each is its own JS context) | N/A — Node runs as an OS process |
| Global object name | `window` (or `self`) | `global` (or `globalThis` in both) |
| Security model | Sandboxed — can't touch your OS | Full OS access — same privileges as the user running it |

```
Browser JS mental model:
┌───────────────────────────────┐
│  Sandbox (can't read your     │
│  disk, can't open raw sockets)│
│                                │
│  window / document / DOM      │
│  Runs whatever the page loads │
└───────────────────────────────┘

Node.js mental model:
┌───────────────────────────────┐
│  Full OS process (like a      │
│  Python script)                │
│                                │
│  No DOM. Has fs, net, process │
│  Runs a file you tell it to   │
└───────────────────────────────┘
```

**Practical implication for a React developer moving to Node**: code you write for the browser (e.g., `document.querySelector`, `localStorage`, `alert`) simply does not exist in Node and will throw a `ReferenceError`. Conversely, `require('fs')` or `process.env` do not exist in browser JS. Isomorphic/universal JavaScript (code meant to run in both) has to avoid environment-specific globals or check for their existence first.

---

## 6. The Single-Threaded Event Loop Model

This is the single most important mental model to build correctly before you write any Node backend code.

```
Traditional threaded server (e.g. classic Apache/PHP):

  Request 1 ──▶ Thread 1 (blocks while waiting on DB)
  Request 2 ──▶ Thread 2 (blocks while waiting on DB)
  Request 3 ──▶ Thread 3 (blocks while waiting on DB)

  1000 concurrent requests → 1000 threads → high memory,
  OS context-switching overhead.
```

```
Node.js model:

  Request 1 ──┐
  Request 2 ──┼──▶ Single Main Thread (Event Loop)
  Request 3 ──┘         │
                         │  "I'm not going to wait for slow
                         │   I/O — I'll hand it off and move
                         │   on to the next request."
                         ▼
              ┌─────────────────────────┐
              │  libuv thread pool /    │
              │  OS async I/O           │
              │  (disk, network, DNS)   │
              └───────────┬─────────────┘
                          │  "Done! Here's the result."
                          ▼
                   Callback queued back
                   onto the main thread
```

Key idea: **Node.js runs your JavaScript on a single thread**, but it does *not* wait around for slow operations (reading a file, querying a database, making an HTTP call) to finish. It delegates that waiting to the OS or a background thread pool (via libuv), and keeps handling other requests in the meantime. When the slow operation finishes, its callback gets scheduled back onto the single thread.

```javascript
console.log('1: Request received');

// This does NOT block the thread — Node hands it off
// and immediately moves to the next line.
setTimeout(() => {
  console.log('3: Timer finished (ran later)');
}, 0);

console.log('2: Continuing without waiting');

// Output order:
// 1: Request received
// 2: Continuing without waiting
// 3: Timer finished (ran later)
```

This is why Node.js is described as **single-threaded, non-blocking, and event-driven**:
- **Single-threaded**: your JS callback code all runs on one thread, one line at a time — no data races between two pieces of your JS running simultaneously.
- **Non-blocking**: I/O operations don't freeze that thread; they're delegated and resumed later via callbacks/promises.
- **Event-driven**: the "event loop" continuously checks: "is there a completed operation whose callback needs to run?" and runs it.

The tradeoff: if you write **CPU-heavy synchronous code** (e.g., a huge loop, complex synchronous computation), it *does* block the single thread — no other request can be handled until it finishes. This is why Node.js is a poor fit for CPU-bound workloads (image processing, heavy math) without offloading to worker threads or a separate service, but an excellent fit for I/O-bound workloads (APIs that mostly wait on databases and network calls), which is most typical backend/web traffic.

```javascript
// BAD in Node: blocks the single thread for everyone
function blockEventLoop() {
  const start = Date.now();
  while (Date.now() - start < 5000) {
    // busy-wait for 5 seconds — nothing else can run!
  }
}
```

We'll cover the event loop's internal phases (timers, I/O callbacks, `setImmediate`, microtasks) in depth in a later phase. For now: **Node is single-threaded for your code, but multi-threaded under the hood for I/O.**

---

## 7. Hands-On Exercises

**Exercise 1:** Install Node.js (see the next lesson if you haven't already) and run `node -v`. Then start the interactive REPL by typing `node` with no arguments, and evaluate `1 + 1`, `typeof window`, and `typeof process` to confirm which globals exist.

**Exercise 2:** Create a file `hello.js` containing `console.log('Hello from Node');` and run it with `node hello.js`. Then try running the same file by pasting its content into a browser's DevTools console — confirm it also works (since it's just JS), then try `console.log(process.version)` in DevTools and confirm it fails.

**Exercise 3:** Write a script that logs three `console.log` statements, with a `setTimeout(..., 0)` sandwiched between the first and the third. Run it and explain out loud (or in a comment) why the order is 1, 3, 2 instead of 1, 2, 3.

**Exercise 4:** Write a small script that intentionally blocks the event loop for 3 seconds using a `while` loop like the example above. Add a `setTimeout` before the blocking loop that logs a message after 1 second. Run it and observe that the timer's callback is delayed until *after* the blocking loop finishes, not at the 1-second mark.

**Exercise 5:** In one sentence each, write down: (a) what V8 is, (b) what libuv is, (c) what Node.js adds on top of both. Then check your answers against Section 3 and 4 of this lesson.

---

## 8. Interview Q&A

**Q: What is Node.js? Is it a language or a framework?**
Answer: Node.js is neither a language nor a framework — it is a JavaScript runtime. It embeds Google's V8 engine (the same engine Chrome uses) to execute JavaScript, and adds APIs for filesystem access, networking, and OS interaction that don't exist in browser JavaScript. Frameworks like Express run on top of Node.js; they are not Node itself.

**Q: What is V8, and what is its relationship to Node.js?**
Answer: V8 is Google's open-source JavaScript engine, written in C++, that parses and executes JavaScript by compiling it to machine code (via an interpreter, Ignition, and a JIT compiler, TurboFan). Chrome embeds V8 to run web page scripts; Node.js embeds the exact same V8 engine to run scripts outside the browser. V8 only understands the JavaScript language itself — Node.js wraps it with additional non-standard APIs like `fs`, `http`, and `process`.

**Q: Is Node.js single-threaded or multi-threaded?**
Answer: Your JavaScript callback code executes on a single thread in Node.js. However, Node is not single-threaded end-to-end: it uses libuv's thread pool and the operating system's async I/O facilities under the hood to handle file, network, and DNS operations without blocking that main thread. So it's more precise to say Node.js has a single-threaded event loop for JS execution, backed by multi-threaded I/O.

**Q: Why is Node.js well-suited for I/O-bound applications but poorly suited for CPU-bound ones?**
Answer: Node's non-blocking I/O model means the single JS thread can hand off slow operations (database queries, file reads, network calls) to the background and keep serving other requests while waiting — ideal for typical web APIs, which spend most of their time waiting on I/O. But if you run CPU-intensive synchronous code (heavy computation, large loops, image processing) directly on that single thread, it blocks everything else until it finishes, since there's only one thread executing JS. CPU-bound work should be offloaded to worker threads or a separate service.

**Q: What are the key differences between the Node.js environment and the browser environment?**
Answer: The browser provides a DOM (`window`, `document`), client-side storage (`localStorage`), and a sandboxed security model with no direct filesystem or OS access. Node.js has no DOM at all, but provides `process`, `fs`, `http`/`net`, and full access to the operating system with the same privileges as the user running the script. Both run JavaScript through a V8-based engine, but the surrounding global APIs are entirely different because they're designed for different jobs — rendering pages vs. running server/CLI programs.

**Q: Why did Node.js become popular with teams that already used JavaScript on the frontend?**
Answer: Before Node.js, a JavaScript frontend (e.g., a React app) had to be paired with a different backend language (Python, Java, PHP, Ruby), forcing teams to maintain two languages, two standard libraries, and often two sets of engineers. Node.js let the same language run on both sides of the stack, enabling shared validation/utility code, a single hiring pool, and one syntax to reason about across the whole application — which is a major reason it's a common first backend choice for full-stack JS/React teams.
