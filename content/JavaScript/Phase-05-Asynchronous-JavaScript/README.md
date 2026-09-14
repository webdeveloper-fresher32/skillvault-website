# Phase 5: Asynchronous JavaScript

## What You'll Learn

JavaScript is single-threaded, yet it routinely juggles network requests, timers, and user input without blocking the page. This phase explains how — starting from the callback patterns that made this possible, through Promises that tamed "callback hell," to `async`/`await` that lets asynchronous code read like synchronous code. The centerpiece of this phase is the event loop: the mechanism that decides, tick by tick, whether your `setTimeout` callback or your resolved Promise runs next. Event loop questions ("what does this code log, and in what order?") are among the most common JavaScript interview questions, so this phase goes deep with a full trace of the call stack, Web APIs, microtask queue, and macrotask (callback) queue. You'll finish with the Fetch API, the modern standard for making HTTP requests from the browser.

## Learning Objectives

- Recognize callback hell and explain why it makes code hard to read, debug, and compose
- Describe the three Promise states (pending, fulfilled, rejected) and why a Promise can only settle once
- Chain `.then()`, `.catch()`, and `.finally()` correctly, including error propagation through a chain
- Choose the right Promise combinator — `Promise.all`, `Promise.allSettled`, `Promise.race`, `Promise.any` — for a given concurrency scenario
- Construct a custom Promise around a callback-based or event-based API using the `Promise` constructor
- Write `async`/`await` code with correct `try`/`catch` error handling
- Convert an existing `.then()` chain into equivalent `async`/`await` code
- Explain the difference between sequential `await` calls and running awaited operations in parallel with `Promise.all`
- Trace a script through the call stack, Web APIs, microtask queue, and macrotask (callback) queue, and predict console output order
- Explain why Promise callbacks (microtasks) always run before the next `setTimeout` callback (macrotask)
- Use the Fetch API to make GET and POST requests, set headers, parse JSON, and handle non-2xx HTTP responses as errors

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Callbacks-and-Promises.md](01-Callbacks-and-Promises.md) | Callback hell, Promise states, `.then`/`.catch`/`.finally`, `Promise.all`/`allSettled`/`race`/`any`, building custom Promises | 2 days |
| [02-Async-Await-and-Error-Handling.md](02-Async-Await-and-Error-Handling.md) | `async`/`await` syntax, `try`/`catch` with async functions, converting chains to `async`/`await`, sequential vs. parallel `await`, common pitfalls | 2 days |
| [03-Event-Loop-and-Fetch-API.md](03-Event-Loop-and-Fetch-API.md) | Call stack, Web APIs, callback queue, microtask queue, full execution trace, why Promises jump ahead of `setTimeout`, Fetch API basics | 2 days |

## Estimated Time

5–7 days

## Previous Phase

← [Phase 4: DOM Manipulation](../Phase-04-DOM-Manipulation/README.md)

## Next Phase

→ [Phase 6: Object-Oriented JavaScript](../Phase-06-Object-Oriented-JavaScript/README.md)
