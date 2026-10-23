# Testing and Debugging — Complete Guide

## Table of Contents
1. [Why Automated Testing Matters](#1-why-automated-testing-matters)
2. [Jest Fundamentals](#2-jest-fundamentals)
3. [Mocking with jest.fn and jest.mock](#3-mocking-with-jestfn-and-jestmock)
4. [Testing Asynchronous Code](#4-testing-asynchronous-code)
5. [Debugging Node with --inspect and DevTools](#5-debugging-node-with---inspect-and-devtools)
6. [Console Methods Beyond console.log](#6-console-methods-beyond-consolelog)
7. [Custom Error Classes](#7-custom-error-classes)
8. [Centralized Error Handling Patterns](#8-centralized-error-handling-patterns)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Why Automated Testing Matters

Manual testing — clicking through an app or hitting endpoints with `curl` — doesn't scale. As a codebase grows, manually re-verifying every existing feature after every change becomes impossible, and regressions slip through unnoticed until a user reports them. Automated tests encode "this behavior must always hold" as executable code that runs in seconds, on every change, catching regressions before they reach production.

```
Without tests:                          With tests:
  change code ──▶ deploy ──▶ hope         change code ──▶ run tests (seconds)
                                                          ──▶ pass? deploy
       ▲                                                  ──▶ fail? fix before it
       └── user reports bug ──┘                                ever ships
           days/weeks later
```

---

## 2. Jest Fundamentals

Jest is the most widely used JavaScript testing framework — it provides a test runner, an assertion library (`expect`), and built-in mocking, all in one package.

```js
// math.js
export function add(a, b) { return a + b; }
export function divide(a, b) {
  if (b === 0) throw new Error("Cannot divide by zero");
  return a / b;
}

// math.test.js
import { add, divide } from "./math.js";

// describe() groups related tests into a labeled block
describe("add", () => {
  // it() (alias: test()) defines a single test case
  it("adds two positive numbers", () => {
    expect(add(2, 3)).toBe(5);
  });

  it("handles negative numbers", () => {
    expect(add(-1, -1)).toBe(-2);
  });
});

describe("divide", () => {
  it("divides two numbers", () => {
    expect(divide(10, 2)).toBe(5);
  });

  it("throws when dividing by zero", () => {
    expect(() => divide(10, 0)).toThrow("Cannot divide by zero");
    // note: the function must be wrapped in an arrow function for toThrow to work —
    // expect(divide(10, 0)).toThrow() would throw immediately, before expect runs
  });
});
```

### Common Matchers

```js
expect(value).toBe(5);                 // strict equality (===), primitives
expect(obj).toEqual({ a: 1 });          // deep equality, objects/arrays
expect(value).not.toBe(5);              // negation
expect(arr).toContain(3);               // array/iterable membership
expect(value).toBeTruthy();              // truthy value
expect(value).toBeFalsy();               // falsy value
expect(value).toBeNull();                // === null
expect(value).toBeUndefined();           // === undefined
expect(value).toBeGreaterThan(10);       // numeric comparison
expect(fn).toThrow();                    // function throws any error
expect(fn).toThrow("specific message");  // function throws with matching message
expect(obj).toHaveProperty("email");     // object has a given key
expect(arr).toHaveLength(3);              // array/string length
```

### Setup and Teardown

```js
describe("Database connection", () => {
  let db;

  beforeAll(async () => {
    db = await connectToTestDatabase(); // runs once, before all tests in this block
  });

  afterAll(async () => {
    await db.close(); // runs once, after all tests in this block
  });

  beforeEach(async () => {
    await db.clear(); // runs before EVERY test — ensures clean state, no test pollution
  });

  it("inserts a record", async () => {
    await db.users.insert({ email: "a@x.com" });
    expect(await db.users.count()).toBe(1);
  });

  it("starts empty", async () => {
    // passes even if run before or after the test above, because beforeEach cleared it
    expect(await db.users.count()).toBe(0);
  });
});
```

---

## 3. Mocking with jest.fn and jest.mock

Mocking replaces real dependencies (a database, an external API, a slow function) with fake, controllable stand-ins — isolating the code under test from things outside its control.

```js
// jest.fn() creates a standalone mock function you can inspect and configure
test("callback is called with the right arguments", () => {
  const callback = jest.fn();

  function processItems(items, cb) {
    items.forEach(item => cb(item));
  }
  processItems([1, 2, 3], callback);

  expect(callback).toHaveBeenCalledTimes(3);
  expect(callback).toHaveBeenCalledWith(1);
  expect(callback).toHaveBeenNthCalledWith(2, 2);
});

// Mock return values
test("mock function with a fixed return value", () => {
  const getDiscount = jest.fn().mockReturnValue(0.1);
  expect(getDiscount()).toBe(0.1);
});

// Mock implementation — full custom logic
test("mock function with custom implementation", () => {
  const fetchUser = jest.fn().mockImplementation((id) => ({ id, name: "Test User" }));
  expect(fetchUser(42)).toEqual({ id: 42, name: "Test User" });
});
```

```js
// jest.mock() replaces an entire module — useful for mocking things like
// an API client or database module imported by the code under test
// emailService.js
export async function sendEmail(to, subject) {
  // in real life: calls an external email provider
}

// userService.js
import { sendEmail } from "./emailService.js";
export async function registerUser(email) {
  // ... save user ...
  await sendEmail(email, "Welcome!");
  return { email, registered: true };
}

// userService.test.js
import { registerUser } from "./userService.js";
import { sendEmail } from "./emailService.js";

jest.mock("./emailService.js"); // auto-mocks every exported function

test("registerUser sends a welcome email", async () => {
  sendEmail.mockResolvedValue(undefined); // control the mocked async function's behavior

  const result = await registerUser("alice@example.com");

  expect(sendEmail).toHaveBeenCalledWith("alice@example.com", "Welcome!");
  expect(result.registered).toBe(true);
  // real email provider was NEVER actually called — test runs instantly, no network
});
```

---

## 4. Testing Asynchronous Code

```js
// Testing a Promise-returning function — return or await the promise
// so Jest waits for it before considering the test complete
async function fetchUserName(id) {
  const user = await db.users.findById(id);
  if (!user) throw new Error("User not found");
  return user.name;
}

test("resolves with the user's name", async () => {
  const name = await fetchUserName(1);
  expect(name).toBe("Alice");
});

test("rejects for a missing user", async () => {
  // must use rejects matcher, or wrap in try/catch — a plain toThrow()
  // does NOT work on promises, only on synchronous throws
  await expect(fetchUserName(999)).rejects.toThrow("User not found");
});

// Common mistake: forgetting to return/await the promise —
// Jest marks the test as passed before the assertion inside ever runs
test("BROKEN — false positive", () => {
  fetchUserName(999).catch(err => {
    expect(err.message).toBe("User not found"); // never actually checked!
  });
  // test function returns before the promise settles — Jest doesn't wait
});
```

---

## 5. Debugging Node with --inspect and DevTools

```bash
# Start Node with the inspector enabled, paused at the first line
node --inspect-brk index.js

# Or without pausing immediately
node --inspect index.js
```

```
1. Run: node --inspect-brk index.js
2. Node prints a debugger URL, e.g.:
     Debugger listening on ws://127.0.0.1:9229/...
     For help, see: https://nodejs.org/en/docs/inspector
3. Open Chrome, navigate to: chrome://inspect
4. Click "Configure..." and ensure localhost:9229 is listed
5. Click "inspect" under Remote Target — opens Chrome DevTools
   connected directly to your running Node process
6. Set breakpoints in the Sources tab, step through code, inspect
   variables in scope, exactly like debugging client-side JS
```

```js
// Alternative: the debugger statement pauses execution wherever
// it appears, IF the process was started with --inspect / --inspect-brk
function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    debugger; // execution pauses here in DevTools, lets you inspect `item`, `total`
    total += item.price;
  }
  return total;
}
```

For editor-integrated debugging, VS Code's built-in JavaScript debugger can attach to a Node process the same way, using a `launch.json` configuration, without needing Chrome at all.

---

## 6. Console Methods Beyond console.log

```js
// console.table — formats arrays of objects as a readable table
console.table([
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 },
]);
// ┌─────────┬─────────┬─────┐
// │ (index) │  name   │ age │
// ├─────────┼─────────┼─────┤
// │    0    │ 'Alice' │ 30  │
// │    1    │  'Bob'  │ 25  │
// └─────────┴─────────┴─────┘

// console.time / console.timeEnd — measure elapsed time between two points
console.time("dbQuery");
await db.users.find({});
console.timeEnd("dbQuery"); // "dbQuery: 42.315ms"

// console.trace — prints the current call stack, useful for figuring out
// WHERE a function was called from without throwing an actual error
function suspiciousFunction() {
  console.trace("Called from:");
}

// console.group / console.groupEnd — visually nest related log lines
console.group("Processing order #123");
console.log("Validating items...");
console.log("Calculating total...");
console.groupEnd();

// console.assert — logs only if the condition is FALSE (opposite of most APIs)
console.assert(total > 0, "Total should never be zero or negative", { total });

// console.count — tracks how many times a labeled line has been hit
function handleRequest() {
  console.count("requests handled"); // "requests handled: 1", then ": 2", etc.
}

// console.error / console.warn — separate output streams (stderr),
// distinct from console.log's stdout — matters for log filtering/piping
console.error("This is an error-level message");
console.warn("This is a warning-level message");
```

---

## 7. Custom Error Classes

Plain `Error` objects carry only a `message` and `stack`. Custom error classes let you attach structured metadata (a status code, an error code, which field failed validation) and let calling code distinguish error types with `instanceof`.

```js
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name; // "AppError", or the subclass name
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes "expected" errors from programmer bugs
    Error.captureStackTrace(this, this.constructor); // excludes constructor from the stack trace
  }
}

class ValidationError extends AppError {
  constructor(message, field) {
    super(message, 400);
    this.field = field;
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404);
  }
}

class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401);
  }
}

// Usage — callers can branch on error type precisely
function validateAge(age) {
  if (typeof age !== "number" || age < 0) {
    throw new ValidationError("Age must be a non-negative number", "age");
  }
}

try {
  validateAge(-5);
} catch (err) {
  if (err instanceof ValidationError) {
    console.log(`Validation failed on field "${err.field}": ${err.message}`);
  } else if (err instanceof AppError) {
    console.log(`Known app error (${err.statusCode}): ${err.message}`);
  } else {
    console.log(`Unexpected error: ${err.message}`); // a genuine bug, not a handled case
  }
}
```

---

## 8. Centralized Error Handling Patterns

```js
// The isOperational flag (Section 7) distinguishes errors we EXPECT and
// handle gracefully (bad input, missing resource) from unexpected bugs —
// this distinction drives how aggressively the process should react.
function isOperationalError(err) {
  return err instanceof AppError && err.isOperational;
}

// Express centralized error handler applying the distinction
app.use((err, req, res, next) => {
  if (isOperationalError(err)) {
    // Known, expected error — safe to show a clean message, keep the process running
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Unknown error — log full details for debugging, but never leak internals to the client
  console.error("UNEXPECTED ERROR:", err);
  res.status(500).json({ error: "Internal Server Error" });

  // In many production setups, an unexpected (non-operational) error is
  // considered a sign the process may be in a corrupted state — some
  // teams intentionally crash and let a process manager (PM2, Kubernetes)
  // restart cleanly, rather than keep serving from a possibly-broken state.
});

// Process-level safety net — the LAST line of defense, not a substitute
// for proper error handling throughout the app
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception, shutting down:", err);
  process.exit(1); // let the process manager restart a fresh, known-good process
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  process.exit(1);
});
```

---

## 9. Hands-On Exercises

**Exercise 1:** Set up Jest in a small project (`npm install --save-dev jest`, add `"test": "jest"` to `package.json` scripts). Write a `stringUtils.js` module with `capitalize`, `truncate(str, maxLength)`, and `slugify` functions, then write a full test suite covering normal input, empty strings, and edge cases (e.g. `truncate` when `maxLength` exceeds the string's length).

**Exercise 2:** Write a `userService.js` with a `getUser(id)` function that depends on an injected `database` object (`database.findById(id)`). Write tests using `jest.fn()` to mock the database, verifying `getUser` returns the found user, throws a `NotFoundError` (from Section 7) when the database returns `null`, and that the database's `findById` was called with the correct id.

**Exercise 3:** Write an async function `retryWithBackoff(fn, maxAttempts)` that retries a failing async function up to `maxAttempts` times. Write tests using `jest.fn().mockRejectedValueOnce(...).mockResolvedValueOnce(...)` to simulate a function that fails twice then succeeds, verifying `retryWithBackoff` returns the eventual success and was called the expected number of times.

**Exercise 4:** Start a small Express app with `node --inspect-brk`, connect Chrome DevTools via `chrome://inspect`, set a breakpoint inside a route handler, trigger the route with `curl`, and step through execution — inspect `req.body`, watch a local variable change value, and use the console panel in DevTools to evaluate an expression against the paused scope.

**Exercise 5:** Implement the `AppError`/`ValidationError`/`NotFoundError`/`AuthenticationError` hierarchy from Section 7 and the centralized handler from Section 8 in an Express app. Write one route that throws each error type and one route that throws a raw, unexpected `TypeError` (e.g. calling `.toUpperCase()` on `undefined`) — verify operational errors return their specific status code and message, while the unexpected error returns a generic 500 without leaking the internal error message to the client.

---

## 10. Interview Q&A

**Q: What is the difference between `toBe` and `toEqual` in Jest, and when would using the wrong one cause a test to fail unexpectedly?**
Answer: `toBe` uses `Object.is` (essentially strict equality, `===`), which for objects and arrays compares references, not contents — two separately created objects with identical properties are not `toBe`-equal because they're different objects in memory. `toEqual` performs a recursive, deep equality check, comparing the actual contents of objects and arrays regardless of reference identity. Using `toBe` to compare two structurally identical but separately constructed objects would fail even though the data is "the same," which is a common source of confusing test failures for developers new to Jest — the fix is simply to use `toEqual` for object/array comparisons and reserve `toBe` for primitives (numbers, strings, booleans) or intentional reference-identity checks.

**Q: Why does a Jest test sometimes pass even when an assertion inside a `.then()` or `.catch()` callback actually fails?**
Answer: If a test function doesn't `return` or `await` the promise it's working with, Jest has no way of knowing the test isn't finished yet — the synchronous test function body returns immediately (before the promise resolves or rejects), and Jest considers the test complete and passing at that point. Any assertion inside a `.then()`/`.catch()` callback that runs later, after Jest has already moved on, never actually gets evaluated against the test's pass/fail outcome — even a failing `expect()` call inside that dangling callback will not fail the test (it may show up as an unhandled rejection warning in the console, but not as a test failure). The fix is to always `return` the promise chain, or better, use `async/await` in the test function directly, so Jest genuinely waits for the asynchronous work to complete before deciding pass or fail.

**Q: What's the purpose of `jest.mock()` versus `jest.fn()`, and when would you reach for each?**
Answer: `jest.fn()` creates a single, standalone mock function that you can pass around, configure return values or implementations for, and make assertions against (like `toHaveBeenCalledWith`) — it's the right tool when you need a fake callback or a fake single dependency injected directly into the function under test. `jest.mock()` replaces an entire module's exports with automatically generated mock functions, which is useful when the code under test imports a dependency directly (rather than receiving it via dependency injection) — for example, mocking an entire `emailService.js` module so that calling code that imports and calls `sendEmail` doesn't actually hit a real email provider during tests. In short: `jest.fn()` for a single function you control the reference to, `jest.mock()` for intercepting an entire imported module's behavior.

**Q: How does the Node inspector (`--inspect`) let you debug a running server, and what's the difference between `--inspect` and `--inspect-brk`?`**
Answer: Both flags start Node with the V8 Inspector Protocol enabled, exposing a WebSocket debugging endpoint that tools like Chrome DevTools or VS Code can connect to and use to set breakpoints, step through execution, inspect variables in scope, and evaluate expressions in the paused context — essentially the same debugging experience as debugging client-side JavaScript in a browser, but attached to your actual server process. The difference is timing: `--inspect` starts running your code immediately and only pauses when it hits a breakpoint or a `debugger` statement, which means very early startup code could execute before you've had a chance to attach a debugger; `--inspect-brk` pauses execution on the very first line of the script and waits for a debugger to attach before continuing, which is essential when you need to debug something that happens during module initialization or very early in the request lifecycle.

**Q: What is the difference between an "operational" error and a "programmer" error, and why does that distinction matter for how you handle errors in production?**
Answer: An operational error is an expected failure mode inherent to the system's normal operation — invalid user input, a resource that doesn't exist, a network timeout calling an external service — and the application can anticipate and gracefully handle it, typically by returning an appropriate error response to the client. A programmer error is a genuine bug — a `TypeError` from calling a method on `undefined`, an off-by-one array access, a logic mistake — and its occurrence means the application's internal state or assumptions may now be unreliable in ways that are hard to predict. This distinction matters because operational errors should be caught, logged at an appropriate level, and turned into a clean client-facing response without disrupting the running process, whereas many production teams treat an unexpected programmer error as a signal to log full diagnostic detail and deliberately let the process crash and restart (via a process manager or orchestrator) rather than risk continuing to serve requests from a process whose internal state might now be corrupted.
