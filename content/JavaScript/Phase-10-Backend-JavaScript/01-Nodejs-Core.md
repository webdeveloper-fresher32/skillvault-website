# Node.js Core — Complete Guide

## Table of Contents
1. [What Node.js Is](#1-what-nodejs-is)
2. [V8 and libuv](#2-v8-and-libuv)
3. [The Event Loop and Its Phases](#3-the-event-loop-and-its-phases)
4. [The Thread Pool](#4-the-thread-pool)
5. [CommonJS vs ES Modules](#5-commonjs-vs-es-modules)
6. [Core Module: fs](#6-core-module-fs)
7. [Core Module: path](#7-core-module-path)
8. [Core Module: process](#8-core-module-process)
9. [Core Module: os](#9-core-module-os)
10. [Environment Variables with dotenv](#10-environment-variables-with-dotenv)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. What Node.js Is

Node.js is a JavaScript runtime built on Chrome's V8 engine that lets JavaScript run outside the browser — on a server, on your laptop, anywhere. It has no `window`, no `document`, no DOM; instead it exposes operating-system capabilities — the filesystem, networking, processes — as JavaScript APIs. Node's defining architectural choice is that it is **single-threaded and non-blocking by default**: instead of spawning a thread per request (like traditional multi-threaded servers), Node runs your JavaScript on one thread and delegates slow operations (disk I/O, network calls, DNS lookups) to the operating system or a background thread pool, picking the result back up later via callbacks, Promises, or `async`/`await`.

---

## 2. V8 and libuv

Node.js is really the combination of two independent C++ projects glued together with a JavaScript-facing API layer.

```
┌──────────────────────────────────────────────────────────────────┐
│                         Your JavaScript Code                     │
├──────────────────────────────────────────────────────────────────┤
│                    Node.js Bindings / APIs (C++ ↔ JS)             │
├───────────────────────────────┬──────────────────────────────────┤
│              V8                │              libuv               │
│  Compiles & executes JS        │  Event loop, thread pool,        │
│  Manages the JS heap & GC       │  async I/O, timers, networking  │
│  Runs the call stack           │  (written in C, cross-platform)  │
└───────────────────────────────┴──────────────────────────────────┘
```

- **V8** is Google's JavaScript engine (also used in Chrome). It parses and JIT-compiles your JavaScript to machine code, manages the heap and garbage collection, and executes synchronous code on the **call stack**. V8 has no concept of asynchrony on its own.
- **libuv** is a C library that provides the event loop, a thread pool for offloading blocking work, and cross-platform abstractions over the OS's async I/O primitives (epoll on Linux, kqueue on macOS, IOCP on Windows). Everything asynchronous in Node — timers, file I/O, network sockets — is coordinated by libuv, not V8.

Node's core insight: keep V8 doing what it's good at (running JS fast, synchronously, single-threaded) and let libuv handle waiting for slow things, notifying V8's call stack only when there's actual work to do.

---

## 3. The Event Loop and Its Phases

The event loop is libuv's mechanism for deciding what callback to run next. It's not a single queue — it's a cycle of distinct **phases**, each with its own callback queue, executed in a fixed order, over and over, for as long as the process has work to do.

```
   ┌───────────────────────────┐
┌─▶│           timers          │  setTimeout / setInterval callbacks
│  └─────────────┬─────────────┘  whose delay has elapsed
│  ┌─────────────▼─────────────┐
│  │     pending callbacks     │  I/O callbacks deferred from
│  └─────────────┬─────────────┘  the previous loop iteration
│  ┌─────────────▼─────────────┐
│  │        idle, prepare      │  internal use only
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │           poll            │  retrieve new I/O events;
│  │                           │  executes I/O callbacks (fs, network)
│  │                           │  blocks here if nothing else to do
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │           check           │  setImmediate() callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │      close callbacks      │  e.g. socket.on('close', ...)
│  └─────────────┬─────────────┘
└────────────────┘
   (repeats while the process has pending work)

Between EVERY phase transition (and after every callback), Node drains:
  1. process.nextTick() queue      (highest priority, always first)
  2. microtask queue (Promise .then/.catch/.finally, queueMicrotask)
```

```js
console.log("1: sync");

setTimeout(() => console.log("2: timers phase (macrotask)"), 0);

setImmediate(() => console.log("3: check phase (macrotask)"));

Promise.resolve().then(() => console.log("4: microtask"));

process.nextTick(() => console.log("5: nextTick (highest priority)"));

console.log("6: sync");

// Actual output order:
// 1: sync
// 6: sync
// 5: nextTick (highest priority)
// 4: microtask
// 2: timers phase (macrotask)      ← order vs setImmediate can vary
// 3: check phase (macrotask)          if called from top-level code
```

### Why This Matters

- All synchronous code runs first, top to bottom, on the call stack — the event loop cannot start processing phases until the call stack is empty.
- `process.nextTick()` callbacks always run before Promise microtasks, and both always run before the next event loop phase — this is why you can accidentally starve I/O by recursively scheduling `nextTick()` calls.
- `setTimeout(fn, 0)` and `setImmediate(fn)` are similar but not identical: `setTimeout` fires in the timers phase (subject to a minimum ~1ms clamp and OS timer precision), while `setImmediate` fires in the check phase, specifically designed to run "immediately after the current poll phase completes" — their relative order from top-level code is not guaranteed, but inside an I/O callback, `setImmediate` is always guaranteed to fire before a `setTimeout(fn, 0)` scheduled at the same point.

---

## 4. The Thread Pool

Not everything can be handled by the OS's async I/O primitives efficiently — some operations (certain filesystem calls, DNS lookups via `dns.lookup`, and CPU-heavy crypto/zlib functions) are offloaded by libuv to a background **thread pool**, separate from the single JS execution thread.

```
Main Thread (V8 + your JS)          libuv Thread Pool (default size: 4)
──────────────────────────          ──────────────────────────────────
  fs.readFile(cb)  ──────────────▶  Thread 1: reads file from disk
  crypto.pbkdf2(cb) ─────────────▶  Thread 2: computes hash (CPU-heavy)
  your JS keeps running            Thread 3: idle
  (never blocked)                  Thread 4: idle

  When a thread finishes, its callback is queued back onto
  the event loop's poll phase to run on the main thread.
```

The pool defaults to 4 threads (configurable via the `UV_THREADPOOL_SIZE` environment variable). This is why running many concurrent `fs.readFile` calls or password-hashing operations can create a bottleneck — the 5th concurrent operation must wait for one of the 4 threads to free up, even though your JS code never blocks.

---

## 5. CommonJS vs ES Modules

Node supports two module systems, and understanding the difference (and how to mix them) is essential in any real project.

```js
// ===== CommonJS (CJS) — the original Node module system =====
// math.js
function add(a, b) { return a + b; }
module.exports = { add };

// app.js
const { add } = require("./math.js"); // synchronous, resolved at require-time
console.log(add(2, 3));
```

```js
// ===== ES Modules (ESM) — the standard JS module system =====
// math.mjs (or math.js with "type": "module" in package.json)
export function add(a, b) { return a + b; }

// app.mjs
import { add } from "./math.mjs"; // asynchronous under the hood, statically analyzed
console.log(add(2, 3));
```

### Key Differences

| | CommonJS | ES Modules |
|---|---|---|
| File extension | `.js` (default) or `.cjs` | `.mjs`, or `.js` with `"type": "module"` in `package.json` |
| Import syntax | `require()` | `import` / `export` |
| Loading | Synchronous, at the point of `require()` | Asynchronous, resolved before execution ("hoisted") |
| `this` at top level | `module.exports` object | `undefined` |
| `__dirname` / `__filename` | Available globally | Not available — use `import.meta.url` instead |
| Dynamic imports | `require()` can be called conditionally anywhere | `import()` returns a Promise, usable conditionally |
| Tree-shaking | Not possible (dynamic, resolved at runtime) | Possible (static structure, analyzable at build time) |

```js
// package.json determines the default module system for .js files
{
  "type": "module",       // .js files are treated as ESM; use .cjs for CommonJS files
  // "type": "commonjs"    // (default if omitted) .js files are CommonJS; use .mjs for ESM
}
```

```js
// Getting __dirname equivalent in ESM
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

You generally should not mix the two styles within the same file, but Node does allow ESM files to `import` CommonJS modules (CommonJS exports are exposed as the default export), while CommonJS files cannot `require()` an ESM file synchronously — they'd need a dynamic `import()`.

---

## 6. Core Module: fs

The `fs` module provides three parallel APIs for filesystem access: synchronous (blocking), callback-based (traditional async), and Promise-based (modern async).

```js
import fs from "fs";
import fsPromises from "fs/promises";

// --- Synchronous: blocks the entire event loop until done ---
// Use only for startup/config code, never inside a request handler.
const configSync = fs.readFileSync("./config.json", "utf-8");

// --- Callback-based: the original async style, non-blocking ---
fs.readFile("./config.json", "utf-8", (err, data) => {
  if (err) {
    console.error("Failed to read file:", err.message);
    return;
  }
  console.log(JSON.parse(data));
});

// --- Promise-based: modern async style, works with async/await ---
async function loadConfig() {
  try {
    const data = await fsPromises.readFile("./config.json", "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to read file:", err.message);
    throw err;
  }
}

// Writing files
await fsPromises.writeFile("./output.txt", "Hello, Node!\n");
await fsPromises.appendFile("./output.txt", "Another line\n");

// Checking existence and metadata without throwing
try {
  const stats = await fsPromises.stat("./config.json");
  console.log(stats.isFile(), stats.size, stats.mtime);
} catch {
  console.log("File does not exist");
}

// Directory operations
await fsPromises.mkdir("./data", { recursive: true }); // like `mkdir -p`
const files = await fsPromises.readdir("./data");
```

**Rule of thumb:** always prefer the Promise-based (`fs/promises`) API in server code — it composes cleanly with `async`/`await` and never blocks the event loop, whereas the `Sync` variants freeze the entire process (including every other in-flight request) for the duration of the operation.

---

## 7. Core Module: path

The `path` module builds and manipulates filesystem paths in a way that works correctly across operating systems (Windows uses `\`, POSIX uses `/`).

```js
import path from "path";

path.join("/users", "alice", "../bob", "file.txt");
// "/users/bob/file.txt" — resolves ".." segments, joins with the correct separator

path.resolve("data", "file.txt");
// absolute path from process.cwd(), e.g. "/home/alice/project/data/file.txt"

path.basename("/users/alice/report.pdf");    // "report.pdf"
path.dirname("/users/alice/report.pdf");     // "/users/alice"
path.extname("/users/alice/report.pdf");     // ".pdf"

path.parse("/users/alice/report.pdf");
// { root: '/', dir: '/users/alice', base: 'report.pdf', ext: '.pdf', name: 'report' }

path.isAbsolute("/etc/config");  // true
path.isAbsolute("./config");     // false
```

`path.join` and `path.resolve` should always be used instead of manual string concatenation (`dir + "/" + file`) — manual concatenation breaks on Windows and mishandles edge cases like trailing slashes or `..` segments.

---

## 8. Core Module: process

`process` is a global object giving access to the current Node.js process — its environment, arguments, and lifecycle.

```js
// Environment variables (see Section 10 for .env files)
console.log(process.env.NODE_ENV); // "development", "production", etc.

// Command-line arguments (index 0 = node binary, 1 = script path, 2+ = actual args)
console.log(process.argv); // ["/usr/bin/node", "/app/index.js", "--port", "3000"]

// Current working directory
console.log(process.cwd());

// Graceful shutdown handling
process.on("SIGINT", () => {
  console.log("Received SIGINT — shutting down gracefully");
  // close server, database connections, etc.
  process.exit(0);
});

// Catching unhandled errors (last line of defense — log and exit, don't rely on this)
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  process.exit(1);
});

// Exit codes: 0 = success, non-zero = failure (used by CI/CD, shell scripts, PM2)
process.exit(0);

// High-resolution timing, useful for benchmarking
const start = process.hrtime.bigint();
// ... do work ...
const end = process.hrtime.bigint();
console.log(`Took ${(end - start) / 1_000_000n}ms`);
```

---

## 9. Core Module: os

The `os` module exposes information about the underlying operating system — useful for logging, scaling decisions, and diagnostics.

```js
import os from "os";

os.platform();     // "darwin", "linux", "win32"
os.arch();          // "x64", "arm64"
os.cpus().length;   // number of logical CPU cores — useful for deciding cluster worker count
os.totalmem();      // total system memory in bytes
os.freemem();        // available memory in bytes
os.hostname();       // machine's hostname
os.uptime();         // system uptime in seconds
os.homedir();        // current user's home directory
```

A common real-world use: spinning up one Node worker process per CPU core with the built-in `cluster` module, using `os.cpus().length` to decide how many workers to fork.

---

## 10. Environment Variables with dotenv

Production configuration (database URLs, API keys, secrets) should never be hardcoded in source code. The standard pattern is a `.env` file (excluded from version control via `.gitignore`) loaded into `process.env` at startup.

```bash
# .env (never commit this file — add it to .gitignore)
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
JWT_SECRET=a-very-long-random-string
PORT=3000
NODE_ENV=development
```

```js
// Load .env into process.env — must happen before anything reads process.env
import "dotenv/config"; // ESM shorthand; equivalent to require("dotenv").config()

// Or explicitly:
// import dotenv from "dotenv";
// dotenv.config();

const port = process.env.PORT || 3000;
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

console.log(`Starting server on port ${port} in ${process.env.NODE_ENV} mode`);
```

### Common Pitfalls

```
1. process.env values are ALWAYS strings — even booleans and numbers.
     process.env.PORT === "3000"        // string "3000", not number 3000
     process.env.DEBUG === "true"       // string "true", truthy even if you meant false!
     Fix: explicitly convert — Number(process.env.PORT), process.env.DEBUG === "true"

2. Missing .env values silently become `undefined`, not an error.
     Always validate required variables exist at startup (fail fast),
     rather than discovering a missing secret deep inside a request handler.

3. .env is for LOCAL development convenience.
     In real deployments (Docker, cloud platforms, CI), environment
     variables are typically injected directly by the platform —
     dotenv simply becomes a no-op if the file doesn't exist, which is fine.

4. Never commit .env to git — commit a .env.example with placeholder
   keys instead, documenting what variables are required without leaking secrets.
```

---

## 11. Hands-On Exercises

**Exercise 1:** Write a script that logs the exact order of execution for a mix of `console.log`, `setTimeout(fn, 0)`, `setImmediate(fn)`, `process.nextTick(fn)`, and `Promise.resolve().then(fn)`, all called from the top level of the file. Run it multiple times and note whether `setTimeout` vs `setImmediate` order is consistent. Then wrap the same five calls inside an `fs.readFile` callback and observe how the order changes — explain why in a comment, referencing the phase diagram in Section 3.

**Exercise 2:** Create two small files, one using CommonJS (`math.cjs` with `module.exports`) and one using ESM (`math.mjs` with `export`), each exporting an `add` and `multiply` function. Write a third file that imports from both — demonstrate that a `.mjs` file can `import` from a `.cjs` file directly, but attempting the reverse (a `.cjs` file using top-level `require()` on a `.mjs` file) throws an error, and show the `import()` dynamic-import workaround instead.

**Exercise 3:** Write a Promise-based function `readJsonFile(path)` using `fs/promises` that reads a file, parses it as JSON, and throws a descriptive custom error if the file doesn't exist or the JSON is malformed (catch both error types separately). Test it against a valid JSON file, a missing file, and a file with broken JSON syntax.

**Exercise 4:** Write a `getSystemInfo()` function using the `os` module that returns an object with platform, architecture, CPU core count, total/free memory in gigabytes (converted from bytes), and uptime formatted as `"Xh Ym"`. Log the result and use `os.cpus().length` to explain, in a comment, how many worker processes you'd start if using Node's `cluster` module on this machine.

**Exercise 5:** Set up a `.env` file with `PORT`, `NODE_ENV`, and `API_KEY` variables, load them with `dotenv`, and write a `validateEnv()` function that runs at startup and throws a clear error listing all missing required variables (rather than crashing on first access of `undefined`). Add a `.env.example` file with the same keys but placeholder values, and verify `.env` itself is excluded via `.gitignore`.

---

## 12. Interview Q&A

**Q: Explain the relationship between V8 and libuv, and why Node.js needs both.**
Answer: V8 is Google's JavaScript engine — it compiles and executes JavaScript, manages the heap and garbage collection, and runs your synchronous code on a single call stack, but it has no built-in concept of asynchronous I/O or timers. libuv is a separate C library that provides the event loop, a background thread pool, and cross-platform bindings to the operating system's async I/O facilities (epoll, kqueue, IOCP). Node.js combines them: V8 executes your JavaScript, and whenever your code calls an async API (reading a file, making a network request, setting a timer), Node hands that operation off to libuv, which tracks it using the OS's non-blocking primitives (or a thread pool for things that can't be done non-blockingly) and, once complete, schedules the corresponding callback to run back on V8's single JS thread during the appropriate event loop phase.

**Q: Walk through what happens, in order, when this code runs: `console.log("a"); setTimeout(() => console.log("b"), 0); Promise.resolve().then(() => console.log("c")); console.log("d");`**
Answer: The output is `a`, `d`, `c`, `b`. First, all synchronous code on the call stack runs to completion — `console.log("a")` and `console.log("d")` execute immediately, in order, before anything asynchronous can run, because JavaScript is single-threaded and the event loop cannot process any callback while the call stack is non-empty. Once the stack is empty, Node drains the microtask queue (Promise callbacks) before moving to the next macrotask phase, so `console.log("c")` runs next. Only after all microtasks are drained does the event loop proceed to the timers phase, where the `setTimeout` callback — a macrotask — finally runs, printing `"b"` last, even though its delay was `0`.

**Q: What is the difference between CommonJS and ES Modules in Node, and can you mix them in one project?**
Answer: CommonJS is Node's original module system, using `require()` and `module.exports`; it resolves and loads modules synchronously at the exact point `require()` is called, and its dynamic nature means tooling can't statically determine what's imported without executing the code. ES Modules use `import`/`export` syntax, are resolved and loaded asynchronously ("hoisted" so all imports are available before any module code runs), and because their structure is statically analyzable, bundlers can perform tree-shaking to eliminate unused exports. You can mix them in a project — an ESM file can `import` a CommonJS module, receiving its `module.exports` as the default export — but a CommonJS file cannot synchronously `require()` an ES Module; it would need to use the asynchronous `import()` function instead, since ESM loading is inherently async.

**Q: Why is it bad practice to use `fs.readFileSync` inside an Express request handler?**
Answer: `fs.readFileSync` blocks the entire event loop until the file read completes — since Node is single-threaded, no other request can be processed, no other timer can fire, and no other I/O callback can run during that time, even though the operation is only slow for one specific request. In a server handling many concurrent requests, this turns what should be a scalability advantage (non-blocking I/O letting one thread serve many clients) into a bottleneck where every request queues up behind the synchronous file read. The fix is to always use the asynchronous variant — `fs.promises.readFile` with `async`/`await`, or the callback-based `fs.readFile` — which delegates the actual disk read to libuv's thread pool or the OS, freeing the main thread to keep handling other requests while waiting.

**Q: Why should sensitive configuration like database URLs and API keys be stored in environment variables instead of hardcoded in source code?**
Answer: Hardcoding secrets in source code means they get committed to version control, potentially exposed in a public repository, visible to anyone with repo access, and baked permanently into git history even if later removed. Environment variables, typically loaded from a `.env` file locally (excluded from git) and injected directly by the hosting platform in production, keep secrets out of the codebase entirely and allow the same code to run against different configurations — a different database URL in development, staging, and production — without any code changes. The important caveat is that `process.env` values are always strings, so numeric or boolean-looking values need explicit conversion, and any required variable should be validated at startup so the application fails fast with a clear error rather than crashing unpredictably later when a missing variable is finally accessed.
