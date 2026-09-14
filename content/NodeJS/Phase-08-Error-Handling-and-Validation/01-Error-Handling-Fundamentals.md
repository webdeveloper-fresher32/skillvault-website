# Error Handling Fundamentals — Complete Guide

## Table of Contents
1. [Why Error Handling Is Different in Node.js](#1-why-error-handling-is-different-in-nodejs)
2. [try/catch with Synchronous Code](#2-trycatch-with-synchronous-code)
3. [try/catch with Async/Await](#3-trycatch-with-asyncawait)
4. [Error-First Callbacks Recap](#4-error-first-callbacks-recap)
5. [Custom Error Classes](#5-custom-error-classes)
6. [Operational vs Programmer Errors](#6-operational-vs-programmer-errors)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Error Handling Is Different in Node.js

Coming from Python/React, you're used to exceptions propagating up a single synchronous call stack, and React error boundaries catching render errors. Node.js adds a wrinkle: **most of your I/O is asynchronous**, and a `throw` inside a callback, a `.then()`, or a detached `Promise` does **not** propagate to the surrounding `try/catch` the way you'd expect.

```javascript
function readConfigBroken() {
  try {
    setTimeout(() => {
      throw new Error('boom'); // NOT caught below — different call stack/tick
    }, 0);
  } catch (err) {
    console.log('caught:', err.message); // never runs
  }
}

readConfigBroken();
// Result: unhandled exception crashes the process (in newer Node versions)
```

The `try/catch` only guards code that runs **synchronously within it**. Once `setTimeout` schedules the callback for a later tick, it executes outside that `try` block entirely. This is the single most common error-handling bug for engineers coming from synchronous languages.

The fix depends on the async pattern in use: callbacks use the error-first convention, Promises use `.catch()`, and `async/await` lets you use `try/catch` again — but only if you `await` the promise inside the `try`.

---

## 2. try/catch with Synchronous Code

Synchronous `try/catch` in Node.js works exactly like it does in most languages.

```javascript
function parseUserInput(rawJson) {
  try {
    const data = JSON.parse(rawJson);
    return { ok: true, data };
  } catch (err) {
    // JSON.parse throws SyntaxError on invalid JSON
    return { ok: false, error: `Invalid JSON: ${err.message}` };
  }
}

console.log(parseUserInput('{"name":"Ganesh"}')); // { ok: true, data: { name: 'Ganesh' } }
console.log(parseUserInput('{bad json'));
// { ok: false, error: 'Invalid JSON: Unexpected token b in JSON at position 1' }
```

### `finally` always runs

```javascript
function withResourceCleanup() {
  let resourceOpen = true;
  try {
    console.log('using resource');
    throw new Error('something failed while using it');
  } catch (err) {
    console.log('handled:', err.message);
  } finally {
    resourceOpen = false;
    console.log('resource closed, resourceOpen =', resourceOpen);
  }
}

withResourceCleanup();
// using resource
// handled: something failed while using it
// resource closed, resourceOpen = false
```

`finally` is the right place for cleanup (closing a DB connection, releasing a lock) because it runs whether the `try` succeeded, threw, or even `return`ed early.

---

## 3. try/catch with Async/Await

`async/await` is syntactic sugar over Promises, and critically, an `await`ed rejection behaves like a synchronous `throw` **inside that function** — so `try/catch` works as expected as long as you `await` inside the `try` block.

```javascript
const fs = require('fs/promises');

async function readJsonFile(path) {
  try {
    const raw = await fs.readFile(path, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Config file not found: ${path}`);
    }
    throw err; // re-throw anything we don't specifically handle
  }
}

async function main() {
  try {
    const config = await readJsonFile('./config.json');
    console.log(config);
  } catch (err) {
    console.error('Failed to load config:', err.message);
  }
}

main();
```

### The classic mistake: forgetting to `await`

```javascript
async function brokenLoad() {
  try {
    readJsonFile('./config.json'); // missing await!
    console.log('loaded fine'); // runs immediately, before the read even settles
  } catch (err) {
    console.log('never reached, even if readJsonFile rejects');
  }
}
```

Without `await`, the returned Promise is detached from the `try/catch` entirely. If it rejects later, it becomes an **unhandled promise rejection** (see Phase 08-04). Always `await` (or explicitly `.catch()`) a Promise you care about.

### Handling multiple concurrent awaits

```javascript
async function loadUserAndOrders(userId) {
  try {
    // Runs concurrently, but a rejection from EITHER throws here
    const [user, orders] = await Promise.all([
      fetchUser(userId),
      fetchOrders(userId),
    ]);
    return { user, orders };
  } catch (err) {
    // err is whichever promise rejected first
    throw new Error(`Failed loading user data: ${err.message}`);
  }
}
```

`Promise.allSettled` is the alternative when you want partial results instead of "one failure kills everything":

```javascript
async function loadUserAndOrdersSettled(userId) {
  const [userResult, ordersResult] = await Promise.allSettled([
    fetchUser(userId),
    fetchOrders(userId),
  ]);

  return {
    user: userResult.status === 'fulfilled' ? userResult.value : null,
    orders: ordersResult.status === 'fulfilled' ? ordersResult.value : [],
    errors: [userResult, ordersResult]
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason.message),
  };
}
```

---

## 4. Error-First Callbacks Recap

Before Promises were standard, Node's convention (still used by some core APIs and older libraries) was the **error-first callback**: the first argument is always `error` (or `null` if none), the rest are results.

```javascript
const fs = require('fs');

fs.readFile('./config.json', 'utf-8', (err, data) => {
  if (err) {
    // Always check err FIRST, before touching data
    console.error('Read failed:', err.message);
    return; // stop here — do not fall through to using `data`
  }
  console.log('Config:', JSON.parse(data));
});
```

### Why this pattern exists

Callbacks have no `throw`/`try-catch` channel of their own — a callback that throws synchronously would crash the process, since by the time it runs, the original call stack (and its `try/catch`) is long gone. So Node's core APIs pass the error as data instead.

```javascript
// A hand-rolled error-first async function, the "old" way
function delayedDivide(a, b, callback) {
  setTimeout(() => {
    if (b === 0) {
      return callback(new Error('Division by zero'));
    }
    callback(null, a / b);
  }, 10);
}

delayedDivide(10, 2, (err, result) => {
  if (err) return console.error(err.message);
  console.log('Result:', result); // Result: 5
});

delayedDivide(10, 0, (err, result) => {
  if (err) return console.error(err.message); // Division by zero
  console.log('Result:', result);
});
```

You'll rarely write new error-first callback code today (Promises/`async-await` won), but you must recognize it — `fs`, some `net`/`http` internals, and many older npm packages (`request`, older `mysql`) still use it. `util.promisify` converts an error-first function into a Promise-returning one:

```javascript
const util = require('util');
const delayedDividePromise = util.promisify(delayedDivide);

async function run() {
  const result = await delayedDividePromise(10, 2);
  console.log(result); // 5
}
run();
```

---

## 5. Custom Error Classes

Throwing plain `Error` objects or, worse, strings, makes it impossible for calling code to distinguish "user sent bad input" from "database is down" from "a bug in my code." A custom error hierarchy fixes this — the same way you'd define exception subclasses in Python (`class NotFoundError(Exception)`).

```javascript
// errors/AppError.js

/**
 * Base class for all "expected" errors the app deliberately throws.
 * Every operational error should extend this.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // marks this as an expected, handled error

    // Excludes the constructor call itself from the stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
};
```

### Using the hierarchy

```javascript
const { NotFoundError, ValidationError } = require('./errors/AppError');

async function getUserById(id) {
  if (!/^[0-9a-f]{24}$/.test(id)) {
    throw new ValidationError('Invalid user id format', { field: 'id', value: id });
  }

  const user = await db.users.findById(id);
  if (!user) {
    throw new NotFoundError('User');
  }
  return user;
}

async function main() {
  try {
    await getUserById('not-a-valid-id');
  } catch (err) {
    if (err instanceof ValidationError) {
      console.log(`400 - ${err.message}`, err.details);
    } else if (err instanceof NotFoundError) {
      console.log(`404 - ${err.message}`);
    } else {
      console.log('500 - Unexpected error', err);
    }
  }
}

main();
```

This pattern is the foundation for the centralized Express error handler in the next lesson — the handler will simply read `err.statusCode` and `err.isOperational` instead of `instanceof`-checking every error type by hand.

### `Error.captureStackTrace` and `.cause`

Two details worth knowing:

- `Error.captureStackTrace(this, this.constructor)` removes the `AppError` constructor itself from the printed stack trace, so the trace points at where `NotFoundError` was actually thrown, not at the base class internals. (V8-specific; a no-op on other engines, but Node.js is V8, so it's safe.)
- Modern Node (14.5+, and standardized in newer JS) supports an `options.cause` on `Error`, useful for wrapping a lower-level error without losing it:

```javascript
try {
  await db.connect();
} catch (dbErr) {
  throw new AppError('Failed to start application', 500, null, { cause: dbErr });
}
// err.cause === dbErr, so nothing is lost when you log err
```

(Note: to support a fourth `options` argument you'd extend the `AppError` constructor signature — shown here for awareness, not wired into the class above to keep it simple.)

---

## 6. Operational vs Programmer Errors

This is one of the most important mental models in Node.js error handling — and a very common interview question.

| | Operational Errors | Programmer Errors |
|---|---|---|
| **Definition** | Expected failures in a working system | Bugs — the code itself is wrong |
| **Examples** | Invalid user input, DB connection timeout, external API down, file not found, duplicate key | `undefined is not a function`, `Cannot read property 'x' of undefined`, passing wrong argument types, a typo |
| **Is the process "sick"?** | No — the app's logic is fine, the world just didn't cooperate | Yes — the app is in an unknown/inconsistent state |
| **How to handle** | Catch it, return a proper error response, keep serving other requests | Let it crash the process; restart via a process manager |
| **Where it's caught** | Route-level `try/catch`, centralized Express error handler | `uncaughtException`/`unhandledRejection` (last resort only) |

```javascript
// Operational error — expected, recoverable, tell the user what went wrong
async function withdrawFunds(accountId, amount) {
  const account = await db.accounts.findById(accountId);
  if (!account) {
    throw new NotFoundError('Account'); // operational — bad input from caller
  }
  if (account.balance < amount) {
    throw new ValidationError('Insufficient funds', { balance: account.balance, amount });
  }
  return db.accounts.debit(accountId, amount);
}

// Programmer error — a bug. There is no sensible "error response" for this;
// the code needs to be fixed, not handled.
function calculateDiscount(price, discountPercent) {
  return price * discountPercent.toFixed(2); // BUG: .toFixed() returns a string,
  // this silently does string*number coercion — will produce NaN or wrong math
  // in some cases. This should be caught by tests/review, not runtime handling.
}
```

The distinction drives an important operational decision, covered fully in `04-Process-Level-Error-Handling.md`: **operational errors should never crash your process**, but **programmer errors should** (after logging), because continuing to run with a corrupted internal state is more dangerous than a clean restart.

A practical litmus test: "If I catch this and let the request continue, is the application's internal state still trustworthy?" If yes → operational, handle it and move on. If no (a bug means you don't actually know what state anything is in) → programmer error, let it crash.

`AppError.isOperational = true` (set in Section 5) is exactly this flag — the centralized error handler and the process-level handlers both check it to decide whether to gracefully respond/log, or to shut the process down.

---

## 7. Hands-On Exercises

**Exercise 1:** Write a function `safeDivide(a, b)` using `try/catch` that throws a plain `Error` for division by zero, and a separate function `safeDivideAsync` that does the same thing but resolves after a `setTimeout` delay. Prove to yourself (with a code comment) why a plain `try/catch` around the call to `safeDivideAsync` fails unless you `await` it.

**Exercise 2:** Convert an error-first callback function `fetchUserCb(id, callback)` (fake it with `setTimeout`) into a Promise-based version using `util.promisify`, then call it with `async/await` inside a `try/catch`.

**Exercise 3:** Build the `AppError` hierarchy from Section 5 in a file `errors.js`. Write three functions that each throw a different subclass, and a caller that uses `instanceof` to print a different message per error type.

**Exercise 4:** For each of the following, label it "operational" or "programmer error" and justify in one sentence: (a) a required `req.body.email` is missing, (b) calling `.map()` on a variable that turned out to be `undefined`, (c) a third-party payment API times out, (d) a typo in a variable name causes a `ReferenceError`.

**Exercise 5:** Write an async function that uses `Promise.allSettled` to fetch three different mock resources (some resolving, some rejecting), and returns an object summarizing which succeeded and which failed, without ever throwing.

---

## 8. Interview Q&A

**Q: Why doesn't a `try/catch` around `setTimeout` or a detached Promise catch the thrown error?**
Answer: `try/catch` only guards the synchronous execution frame it wraps. Once code is deferred to the event loop's macrotask/microtask queue (a `setTimeout` callback, a `.then()` handler, a detached Promise), it runs in a completely separate call stack after the original `try/catch` has already finished executing. Errors thrown there either need their own `try/catch` inside the callback, a `.catch()` on the Promise, or must be `await`ed inside an `async function`'s `try/catch`.

**Q: What is the error-first callback convention and why did Node.js adopt it?**
Answer: Node core APIs pass `(err, ...results)` to callbacks — `err` is `null` on success, or an `Error` on failure, and must be checked first. This exists because a callback that threw synchronously would propagate up the event loop's internal call stack (not the caller's original stack) and could crash the process — there was no reliable `try/catch` channel for async callbacks before Promises. Passing the error as a normal argument sidesteps that entirely.

**Q: What's the difference between an operational error and a programmer error, and why does the distinction matter?**
Answer: Operational errors are expected failures in a correctly-written system — bad input, a timed-out external call, a missing file. Programmer errors are bugs — the code did something it was never supposed to do (`undefined is not a function`, wrong types). The distinction matters because operational errors should be caught and handled gracefully (return a 4xx, retry, log and move on) while programmer errors indicate the process is in an unknown state and should generally be allowed to crash and restart cleanly via a process manager, rather than limp along.

**Q: Why extend `Error` for custom error classes instead of just throwing an object literal like `{ message: 'not found', code: 404 }`?**
Answer: `Error` subclasses preserve the stack trace (critical for debugging), work correctly with `instanceof` checks, integrate with tools that expect real `Error` objects (loggers, Express's default error handler, test frameworks), and let you attach structured metadata (`statusCode`, `isOperational`, `details`) while still behaving like a normal JS error everywhere else.

**Q: What happens if you forget to `await` a Promise inside an `async function`'s `try/catch`?**
Answer: The `try/catch` only executes synchronously up to the point of encountering the un-awaited call; the returned Promise is disconnected from that `try/catch` scope. If it later rejects, no `catch` block will observe it — it becomes an unhandled promise rejection, which since Node 15 terminates the process by default.

**Q: How would you decide whether to use `Promise.all` or `Promise.allSettled` when fetching from multiple sources?**
Answer: Use `Promise.all` when every result is required for the operation to make sense — any single failure should abort the whole thing (e.g., you can't render an order page without both the order and the user). Use `Promise.allSettled` when partial success is acceptable and you want to know exactly which calls failed without losing the ones that succeeded (e.g., a dashboard that shows whatever widgets loaded, greying out the ones that didn't).
