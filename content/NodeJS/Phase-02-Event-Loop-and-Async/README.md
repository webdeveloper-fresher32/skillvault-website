# Phase 02 — Event Loop and Async

Node.js's single most-interviewed topic. This phase builds a precise mental model of how Node executes JavaScript: the call stack, libuv's event loop phases, the microtask/macrotask queues, and every async pattern built on top of them (callbacks, Promises, async/await).

## Why This Phase Matters

If you're coming from Python/React, you already know `async`/`await` and Promises conceptually — but Node's execution model (single-threaded, event-driven, non-blocking I/O via libuv) is different enough from Python's asyncio or the browser's event loop that interviewers probe it heavily. "Predict the console.log output order" questions are a Node interview staple.

## Files in This Phase

| File | Topic |
|------|-------|
| `01-The-Event-Loop-Explained.md` | libuv, the 6 event loop phases, call stack vs queues, why single-threaded + non-blocking |
| `02-Callbacks-and-Callback-Hell.md` | Error-first callbacks, pyramid of doom, flattening strategies |
| `03-Promises-Deep-Dive.md` | Promise states, combinators (`all`/`allSettled`/`race`/`any`), chaining pitfalls |
| `04-Async-Await.md` | Syntax sugar over Promises, sequential vs parallel awaits, top-level await |
| `05-Microtasks-vs-Macrotasks.md` | Exact execution ordering of `nextTick`, microtasks, `setTimeout`, `setImmediate` |

## Learning Path

| Step | Topic | Difficulty | Time |
|------|-------|------------|------|
| 1 | The Event Loop Explained | Hard | 3-4 hrs |
| 2 | Callbacks and Callback Hell | Easy | 1-2 hrs |
| 3 | Promises Deep Dive | Medium | 2-3 hrs |
| 4 | Async/Await | Medium | 2 hrs |
| 5 | Microtasks vs Macrotasks | Hard | 2-3 hrs |

## Prerequisites

Phase 01 (Node fundamentals) — comfortable running Node scripts and reading `require`/`module.exports`.

## Outcome

By the end of this phase you can explain, whiteboard, and predict the output of any event-loop ordering question — the highest-leverage topic for Node.js interviews.
