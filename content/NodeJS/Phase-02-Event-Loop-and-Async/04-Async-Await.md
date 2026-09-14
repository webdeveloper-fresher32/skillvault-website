# Async/Await — Complete Guide

## Table of Contents
1. [Async/Await is Syntax Sugar Over Promises](#1-asyncawait-is-syntax-sugar-over-promises)
2. [try/catch Error Handling](#2-trycatch-error-handling)
3. [Sequential vs Parallel Awaits](#3-sequential-vs-parallel-awaits)
4. [The "await in a loop" Mistake](#4-the-await-in-a-loop-mistake)
5. [Top-Level Await](#5-top-level-await)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Async/Await is Syntax Sugar Over Promises

`async`/`await` doesn't introduce a new concurrency model — it's syntax built entirely on top of Promises, letting asynchronous code read like synchronous code.

```javascript
// Promise-based
function getUser(id) {
  return fetch(`/api/users/${id}`).then(res => res.json());
}

// Equivalent async/await
async function getUser(id) {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}
```

**Two key rules:**
1. An `async function` **always returns a Promise** — even if you `return` a plain value, it's automatically wrapped: `return 5` inside an `async function` is equivalent to `return Promise.resolve(5)`.
2. `await` can only be used inside an `async function` (or at the top level of an ES module — see section 5). It pauses execution of that function until the awaited Promise settles, then either returns the resolved value or throws the rejection reason.

```javascript
async function double(x) {
  return x * 2; // implicitly wrapped
}

double(5).then(result => console.log(result)); // 10 — double() returns a Promise

async function willThrow() {
  await Promise.reject(new Error('failure'));
}

willThrow().catch(err => console.log(err.message)); // 'failure' — rejection propagates as a rejected Promise
```

`await` **desugars** to `.then()` under the hood — the engine transforms your `async` function into a state machine of `.then()` chains, but you never have to write that yourself.

---

## 2. try/catch Error Handling

Because `await` throws (rather than passing an error to a callback, or requiring `.catch()`), you handle async errors with ordinary `try/catch` — the same tool you already use for synchronous errors:

```javascript
async function fetchUserProfile(id) {
  try {
    const user = await fetchUser(id);          // throws if fetchUser's Promise rejects
    const orders = await fetchOrders(user.id); // throws if fetchOrders' Promise rejects
    return { user, orders };
  } catch (err) {
    console.error('Failed to build profile:', err.message);
    throw err; // re-throw if the caller needs to know, or return a fallback
  } finally {
    console.log('Cleanup — always runs');
  }
}
```

**Important:** a `try/catch` around an `await` only catches errors from that awaited expression (and any synchronous code in the same `try` block) — it does NOT catch errors from unrelated, unawaited async calls started inside the block:

```javascript
async function example() {
  try {
    someAsyncCall(); // ❌ NOT awaited — if it rejects, this try/catch will NOT catch it
    await anotherAsyncCall();
  } catch (err) {
    console.log('caught:', err.message); // only catches anotherAsyncCall's errors
  }
}
```

---

## 3. Sequential vs Parallel Awaits

`await`-ing one Promise after another runs them **sequentially** — each waits for the previous to finish before starting. If the operations are independent, this wastes time.

```javascript
// SEQUENTIAL — total time ≈ 100ms + 100ms + 100ms = 300ms
async function sequential() {
  const a = await delay(100, 'A'); // waits 100ms
  const b = await delay(100, 'B'); // THEN waits another 100ms
  const c = await delay(100, 'C'); // THEN waits another 100ms
  return [a, b, c];
}

// PARALLEL — total time ≈ 100ms (all three run concurrently)
async function parallel() {
  const [a, b, c] = await Promise.all([
    delay(100, 'A'),
    delay(100, 'B'),
    delay(100, 'C'),
  ]);
  return [a, b, c];
}
```

```
Sequential timeline:
|--- A (100ms) ---|--- B (100ms) ---|--- C (100ms) ---|   total: 300ms

Parallel timeline (Promise.all):
|--- A (100ms) ---|
|--- B (100ms) ---|   all start together   total: 100ms
|--- C (100ms) ---|
```

**Rule of thumb:** use sequential `await` only when each step genuinely *depends* on the previous step's result. If operations are independent, start them all first (without awaiting immediately), then await together with `Promise.all`.

```javascript
// Independent calls started together, awaited together — same effect as Promise.all
async function parallelAlt() {
  const promiseA = delay(100, 'A'); // starts immediately, NOT awaited yet
  const promiseB = delay(100, 'B'); // starts immediately too — runs concurrently with A
  const a = await promiseA;
  const b = await promiseB;
  return [a, b]; // total time ≈ 100ms, not 200ms
}
```

---

## 4. The "await in a loop" Mistake

A very common performance bug: using `await` inside a `for`/`forEach` loop for independent async operations, which serializes work that could run in parallel.

```javascript
// ❌ MISTAKE — processes users ONE AT A TIME, sequentially
async function notifyAllUsers(userIds) {
  for (const id of userIds) {
    await sendNotification(id); // waits for EACH notification before starting the next
  }
}
// If sendNotification takes 200ms and there are 10 users: total = 2000ms

// ✅ FIX — fire all requests, then wait for all of them together
async function notifyAllUsers(userIds) {
  await Promise.all(userIds.map(id => sendNotification(id)));
}
// Total ≈ 200ms (limited by the slowest single request, not the sum)
```

**When `await` in a loop is actually CORRECT:**
```javascript
// Correct use: each step genuinely depends on the previous result
async function processInOrder(items) {
  let result = null;
  for (const item of items) {
    result = await processStep(item, result); // each step needs the PREVIOUS result
  }
  return result;
}

// Correct use: intentionally throttling to avoid overwhelming a resource
// (e.g., rate-limited API, limited DB connections)
async function throttledRequests(urls) {
  const results = [];
  for (const url of urls) {
    results.push(await fetch(url)); // deliberately one-at-a-time to respect a rate limit
  }
  return results;
}
```

**Also watch out for `forEach` with async callbacks — it does NOT wait:**
```javascript
// ❌ BROKEN — forEach does not await its callback; this logs "done" before any file is read
async function readAll(files) {
  files.forEach(async (file) => {
    const content = await fs.promises.readFile(file, 'utf8');
    console.log(content);
  });
  console.log('done'); // ❌ this runs FIRST, immediately — forEach doesn't wait for async callbacks
}

// ✅ FIX — use Promise.all with map, which returns awaitable promises
async function readAll(files) {
  await Promise.all(files.map(async (file) => {
    const content = await fs.promises.readFile(file, 'utf8');
    console.log(content);
  }));
  console.log('done'); // ✅ correctly runs after all files are read
}
```

---

## 5. Top-Level Await

Historically, `await` was only legal inside an `async function`. Modern Node (14.8+ with a flag, stable since Node 16 in ES modules) allows **top-level await** — using `await` directly in module scope, without wrapping it in an `async function`, but ONLY in ES modules (`.mjs` files, or `.js` files with `"type": "module"` in `package.json`).

```javascript
// top-level-await-example.mjs
import { readFile } from 'fs/promises';

const config = await readFile('./config.json', 'utf8'); // ✅ works — no async wrapper needed
console.log(JSON.parse(config));

const data = await fetch('https://api.example.com/data').then(r => r.json());
console.log(data);
```

**Why it matters:**
- Simplifies module initialization that depends on async setup (e.g., loading a config file or establishing a DB connection before the rest of the module runs).
- A module using top-level await effectively makes any module that `import`s it wait for it to finish before continuing — this can affect application startup ordering, so use it thoughtfully.
- **Not available in CommonJS** (`require`-based `.js` files) — only in ES modules.

```javascript
// CommonJS — top-level await is a SyntaxError
const data = await fetch(url); // ❌ SyntaxError: await is only valid in async functions and ES modules

// Workaround in CommonJS: wrap in an immediately-invoked async function
(async () => {
  const data = await fetch(url); // ✅ works
})();
```

---

## 6. Hands-On Exercises

**Exercise 1:** Write an `async function getWeather(city)` using the `delay` helper from the Promises lesson to simulate an API call. Wrap the caller in `try/catch` and test both a resolving and rejecting path.

**Exercise 2:** Write two versions of a function that fetches 3 independent pieces of data (user, product, cart) using `delay(100, value)`: one using sequential `await`, one using `Promise.all`. Time both with `console.time`/`console.timeEnd` and confirm the parallel version is ~3x faster.

**Exercise 3:** Reproduce the "await in a loop" mistake: write a function that sends 5 simulated notifications (200ms delay each) using a `for...of` loop with `await`. Time it, then refactor to `Promise.all` + `map` and time again.

**Exercise 4:** Reproduce the `forEach` + async bug: use `files.forEach(async file => {...})` and observe that a `console.log('done')` after the loop fires before any async work completes. Fix it with `Promise.all(files.map(...))`.

**Exercise 5:** Create an `.mjs` file that uses top-level await to read a JSON config file and log it, with no wrapping `async function`. Confirm it fails if you rename the file to `.js` without `"type": "module"` in `package.json`.

---

## 7. Interview Q&A

**Q: Is `async`/`await` a completely different concurrency model from Promises?**
Answer: No — `async`/`await` is syntax sugar that compiles down to Promise chains. An `async function` always returns a Promise (wrapping a plain return value automatically), and `await` is equivalent to attaching a `.then()` to the awaited expression and pausing the function's execution until it resolves. Anything expressible with `async`/`await` can be rewritten with `.then()`/`.catch()`, and vice versa.

**Q: How do you handle errors with `async`/`await`, and what's a common mistake?**
Answer: Wrap `await` expressions in `try/catch` — a rejected awaited Promise throws inside the function, caught like a synchronous exception. A common mistake is calling an async function without `await`-ing it inside a `try` block; since it isn't awaited, its rejection happens outside the synchronous flow of the `try/catch` and won't be caught there, potentially becoming an unhandled rejection instead.

**Q: What's the difference between running awaits sequentially vs. in parallel, and when should you use each?**
Answer: Sequential awaits (`await a(); await b();`) run one after another, with total time being the sum of each step — appropriate when each step depends on the previous one's result. Parallel execution (starting all Promises first, then awaiting them together via `Promise.all`) runs independent operations concurrently, with total time bounded by the slowest single operation — appropriate whenever operations don't depend on each other, since it's significantly faster.

**Q: What's wrong with using `await` inside a `for` loop, and when is it actually correct?**
Answer: If each loop iteration performs an independent async operation, awaiting inside the loop serializes them unnecessarily — each iteration waits for the previous one to finish even though they don't depend on each other, multiplying total time by the number of iterations. It IS correct when each iteration's operation genuinely depends on the result of the previous iteration, or when you're intentionally throttling requests to respect a rate limit or resource constraint.

**Q: Why doesn't `Array.prototype.forEach` work correctly with async callbacks?**
Answer: `forEach` ignores the return value of its callback and does not wait for any Promise the callback returns — it fires all callback invocations and moves on immediately, so code after the `forEach` call runs before any of the async callbacks complete. The fix is to use `Array.prototype.map` to produce an array of Promises, then `await Promise.all(...)` on that array, which correctly waits for every async operation to finish.

**Q: What is top-level await, and what are its constraints?**
Answer: Top-level await lets you use `await` directly at module scope, outside any `async function`, in ES modules (`.mjs` files or `.js` files under `"type": "module"`). It's useful for async module initialization, like loading config before the rest of the module runs. Its constraint is it's not supported in CommonJS modules (`require`-based) — attempting it there is a `SyntaxError` — and it can delay the resolution of any module that imports a module using it, since the importer effectively waits for the awaited operation to complete.

**Q: Does `await` block the Node.js event loop while waiting?**
Answer: No. `await` only pauses the execution of the current `async function` — it yields control back to the event loop, which continues processing other callbacks, timers, and I/O while the awaited Promise is pending. This is the entire point of async/non-blocking design: other code keeps running concurrently, and the `async function` resumes exactly where it left off once the awaited Promise settles.
