# Centralized Error Handling in Express — Complete Guide

## Table of Contents
1. [The Problem: Scattered try/catch Everywhere](#1-the-problem-scattered-trycatch-everywhere)
2. [Express Error-Handling Middleware](#2-express-error-handling-middleware)
3. [Building a Complete Centralized Error Handler](#3-building-a-complete-centralized-error-handler)
4. [The asyncHandler Pattern](#4-the-asynchandler-pattern)
5. [A Consistent JSON Error Response Shape](#5-a-consistent-json-error-response-shape)
6. [Putting It All Together](#6-putting-it-all-together)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Scattered try/catch Everywhere

Without a centralized strategy, every route handler ends up with near-identical error-handling boilerplate:

```javascript
// The pattern you want to avoid repeating in every single route
app.get('/users/:id', async (req, res) => {
  try {
    const user = await db.users.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

app.post('/users', async (req, res) => {
  try {
    // ... same try/catch shape, repeated
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});
```

This is the Express equivalent of wrapping every Flask view or Django view in its own duplicate `except Exception` block. It's repetitive, easy to get inconsistent (one route forgets to log, another returns a different error shape), and mixes error-formatting concerns into business logic. Express solves this with a special category of middleware: **error-handling middleware**.

---

## 2. Express Error-Handling Middleware

Express recognizes an error-handling middleware function by its **arity — exactly four parameters**: `(err, req, res, next)`. This is not a convention you can skip; Express literally checks `fn.length === 4` internally to decide whether a middleware is an error handler.

```javascript
// This is ONLY treated as an error handler because it has 4 params.
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: { message: 'Something went wrong' } });
});
```

Key rules:

1. **Error handlers must be registered last**, after all routes and other middleware — Express matches middleware top-to-bottom, and error handlers are only invoked when something calls `next(err)`.
2. **You reach an error handler by calling `next(err)`** — not by `throw`ing in normal middleware (throwing works automatically only inside `async` route handlers wrapped correctly, or in Express 5+; see Section 4).
3. Multiple error handlers can exist — calling `next(err)` inside one passes to the next one, letting you chain (e.g., a logging handler, then a formatting handler).

```javascript
const express = require('express');
const app = express();

app.get('/crash', (req, res, next) => {
  const err = new Error('Deliberate failure');
  err.statusCode = 400;
  next(err); // hands off to error-handling middleware — skips all normal middleware/routes
});

// Regular middleware/routes below are SKIPPED once next(err) is called
app.get('/never-reached-on-error-path', (req, res) => {
  res.send('this route is fine on its own, unrelated to /crash');
});

// Error handler — must be defined AFTER routes, with exactly 4 args
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ error: { message: err.message } });
});

app.listen(3000);
```

---

## 3. Building a Complete Centralized Error Handler

A production-grade centralized handler needs to:

- Distinguish operational (`AppError`) from unexpected/programmer errors.
- Log full details server-side, but never leak stack traces or internals to the client.
- Return a consistent JSON shape regardless of error source.
- Handle known third-party error types (e.g., Mongoose `CastError`, `ValidationError`, JWT errors) by translating them into the same shape.

```javascript
// errors/AppError.js
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { AppError };
```

```javascript
// middleware/errorHandler.js
const { AppError } = require('../errors/AppError');

/**
 * Normalizes various error shapes (our own AppError, Mongoose errors,
 * JWT errors, or a raw unexpected Error) into a single response format.
 */
function normalizeError(err) {
  // Our own operational errors already have the right shape
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message, details: err.details };
  }

  // Mongoose invalid ObjectId, e.g. GET /users/not-an-id
  if (err.name === 'CastError') {
    return { statusCode: 400, message: `Invalid ${err.path}: ${err.value}`, details: null };
  }

  // Mongoose schema validation errors
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return { statusCode: 400, message: 'Validation failed', details };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return { statusCode: 409, message: `Duplicate value for field: ${field}`, details: null };
  }

  // JWT errors (jsonwebtoken package)
  if (err.name === 'JsonWebTokenError') {
    return { statusCode: 401, message: 'Invalid token', details: null };
  }
  if (err.name === 'TokenExpiredError') {
    return { statusCode: 401, message: 'Token expired', details: null };
  }

  // Anything else: treat as an unexpected programmer error, hide details from client
  return { statusCode: 500, message: 'Internal server error', details: null };
}

function errorHandler(err, req, res, next) {
  const { statusCode, message, details } = normalizeError(err);
  const isProgrammerError = statusCode === 500;

  // Log full detail server-side always — this is what you'd ship to
  // a real logger (pino/winston) and/or an error tracker (Sentry) in production.
  console.error({
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    statusCode,
    isOperational: err.isOperational || false,
  });

  res.status(statusCode).json({
    error: {
      message,
      ...(details ? { details } : {}),
      // Only include stack trace in non-production environments — never leak internals
      ...(process.env.NODE_ENV !== 'production' && isProgrammerError
        ? { stack: err.stack }
        : {}),
    },
  });
}

module.exports = { errorHandler };
```

### A 404 handler for unmatched routes

A very common companion piece — routes that don't match anything should also flow through the same error shape:

```javascript
// middleware/notFound.js
const { AppError } = require('../errors/AppError');

function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

module.exports = { notFoundHandler };
```

---

## 4. The asyncHandler Pattern

In Express 4 (still the most widely deployed version), a `throw` or rejected Promise inside an `async` route handler is **not** automatically caught and forwarded to `next()` — you must catch it and call `next(err)` yourself, or the process may hang the request (Express 4) or crash it as an unhandled rejection.

```javascript
// BROKEN in Express 4 — a rejected promise here is NEVER caught by Express.
// The request just hangs (no response ever sent), and the rejection becomes
// an unhandled promise rejection at the process level.
app.get('/users/:id', async (req, res) => {
  const user = await db.users.findById(req.params.id); // throws if DB is down
  res.json(user);
});
```

The fix is either wrapping every handler in `try/catch` and manually calling `next(err)` (repetitive — back to Section 1's problem), or using a small wrapper function once:

```javascript
// utils/asyncHandler.js

/**
 * Wraps an async Express route handler so any rejected promise
 * is automatically forwarded to next(err) -> centralized error handler.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
```

Usage — every async route becomes one line shorter and structurally identical:

```javascript
const { asyncHandler } = require('../utils/asyncHandler');
const { NotFoundError } = require('../errors/AppError');

router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) throw new NotFoundError('User');
  res.json(user);
}));

router.post('/users', asyncHandler(async (req, res) => {
  const user = await db.users.create(req.body);
  res.status(201).json(user);
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  const deleted = await db.users.deleteById(req.params.id);
  if (!deleted) throw new NotFoundError('User');
  res.status(204).send();
}));
```

`Promise.resolve(fn(...)).catch(next)` works because:
- `fn(req, res, next)` calls your async function, which always returns a Promise.
- `Promise.resolve(...)` is a safety net in case `fn` isn't actually `async` and throws synchronously instead of rejecting — wrapping a thrown value in `Promise.resolve` isn't quite right on its own, but since `fn` runs inside `wrapped` (a normal function), a synchronous throw inside an `async fn` is automatically converted to a rejected Promise by the `async` keyword itself, so `.catch(next)` still catches it.
- `.catch(next)` forwards any rejection reason directly into Express's `next(err)`, routing it into the centralized error handler from Section 3.

> **Note on Express 5:** Express 5 (major version, adopted increasingly as of 2024+) natively catches rejected promises returned from route handlers and middleware, making `asyncHandler` largely unnecessary there. It's still essential knowledge because most production codebases and interview questions target Express 4, and the wrapper pattern is a good general lesson in "eliminate boilerplate with one small utility."

---

## 5. A Consistent JSON Error Response Shape

Frontend and mobile clients (a React app, in your case) need to parse errors reliably — that requires the **same shape every time**, regardless of whether the error came from validation, a 404, or an unexpected crash.

```javascript
// Success response shape
{
  "data": { "id": "123", "name": "Ganesh" }
}

// Error response shape — always under an "error" key, always has "message"
{
  "error": {
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "must be a valid email address" }
    ]
  }
}

// A simpler error, no extra details
{
  "error": {
    "message": "User not found"
  }
}
```

A shared shape lets the frontend write one generic error-handling function:

```javascript
// Example: how a React app might consume this consistently
async function apiRequest(url, options) {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) {
    // Every error from this API has the same shape — one handler covers all of them
    throw new Error(body.error?.message || 'Unknown error');
  }
  return body.data;
}
```

Keep the contract intentionally small and stable: `error.message` (always present), `error.details` (optional, array or object, for validation-style errors). Avoid returning raw stack traces, database error codes, or internal file paths to clients in production — those belong in server-side logs only (as shown in Section 3).

---

## 6. Putting It All Together

```javascript
// app.js
const express = require('express');
const { asyncHandler } = require('./utils/asyncHandler');
const { AppError, NotFoundError, ValidationError } = require('./errors/AppError');
const { notFoundHandler } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(express.json());

// Fake in-memory "DB" for a runnable example
const users = new Map([['1', { id: '1', name: 'Ganesh' }]]);

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = users.get(req.params.id);
  if (!user) throw new NotFoundError('User');
  res.json({ data: user });
}));

app.post('/users', asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Validation failed', [
      { field: 'name', message: 'name is required and must be a string' },
    ]);
  }
  const id = String(users.size + 1);
  const user = { id, name };
  users.set(id, user);
  res.status(201).json({ data: user });
}));

// Simulate an unexpected programmer error, e.g. a typo/bug
app.get('/boom', asyncHandler(async (req, res) => {
  const x = undefined;
  res.json(x.toUpperCase()); // throws TypeError — an unexpected error
}));

// 404 catch-all for unmatched routes — must come after all real routes
app.use(notFoundHandler);

// Centralized error handler — must be registered LAST, with 4 args
app.use(errorHandler);

app.listen(3000, () => console.log('Listening on :3000'));
```

Requests and results:

```
GET /users/1        -> 200 { "data": { "id": "1", "name": "Ganesh" } }
GET /users/99        -> 404 { "error": { "message": "User not found" } }
POST /users {}        -> 400 { "error": { "message": "Validation failed", "details": [...] } }
GET /boom             -> 500 { "error": { "message": "Internal server error" } } (stack logged server-side)
GET /nonexistent-path -> 404 { "error": { "message": "Route not found: GET /nonexistent-path" } }
```

Every single failure mode — expected 4xx, unmatched route, and even a raw programmer bug — flows through one function and produces one predictable shape.

---

## 7. Hands-On Exercises

**Exercise 1:** Build the full `app.js` from Section 6 in a scratch project (`npm init -y && npm i express`). Hit all five example routes with `curl` and confirm the response shapes match.

**Exercise 2:** Add a new route `PATCH /users/:id` using `asyncHandler` that throws a `ValidationError` if the body is empty, and a `NotFoundError` if the id doesn't exist. Verify both paths return the correct status code and JSON shape.

**Exercise 3:** Remove `asyncHandler` from one route and replace the throw with a rejected Promise (e.g. `return Promise.reject(new Error('boom'))`). Observe what happens to the request in Express 4 (no `asyncHandler`) — does the client ever get a response? Then re-wrap it and confirm the behavior is fixed.

**Exercise 4:** Extend `normalizeError` in `errorHandler.js` to handle a `SyntaxError` thrown by `express.json()` when a client sends malformed JSON (hint: Express passes this to your error handler automatically — try sending `curl -X POST -H "Content-Type: application/json" -d '{bad' http://localhost:3000/users`).

**Exercise 5:** Add request logging (method, path, status code, response time) as separate middleware, and confirm it still logs correctly even for requests that end up in the error handler.

---

## 8. Interview Q&A

**Q: How does Express know a middleware function is an error handler?**
Answer: By its arity — Express inspects the function's parameter count and treats any middleware with exactly four parameters, `(err, req, res, next)`, as an error-handling middleware. It must also be registered after all normal routes/middleware, since Express only invokes it when `next(err)` is called (or, in Express 5, when an async handler throws/rejects).

**Q: Why should error-handling middleware be registered last in an Express app?**
Answer: Express matches and executes middleware/routes in registration order. An error handler is only reached via `next(err)`, which causes Express to skip all remaining normal middleware and jump straight to the next error-handling middleware in the chain. If you registered it before your routes, it simply wouldn't be in position to catch errors thrown by them.

**Q: What problem does the `asyncHandler` wrapper solve, and how does it work internally?**
Answer: In Express 4, a rejected promise inside an `async` route handler is not automatically forwarded to Express's error handling — the request can hang or the rejection becomes an unhandled process-level rejection. `asyncHandler(fn)` returns a new function that calls `fn(req, res, next)`, wraps the result in `Promise.resolve()`, and attaches `.catch(next)` — so any rejection (from a `throw` inside the async function or an awaited rejected promise) is passed directly into `next(err)`, routing it into the centralized error handler.

**Q: Why keep a consistent JSON shape for all API errors instead of letting each route format its own error response?**
Answer: Client code (a React frontend, a mobile app, another service) needs to parse errors reliably. If every route returns a different shape (`{error: "msg"}` here, `{message: "msg"}` there, a raw string somewhere else), the client needs bespoke handling per endpoint. A single shape (`{ error: { message, details? } }`) lets client code write one generic error handler for the entire API surface.

**Q: Should a centralized error handler ever expose a stack trace or internal error details to the client?**
Answer: Not in production. Stack traces and internal messages (database connection strings, file paths, library internals) are a security and information-disclosure risk. The handler should log full details server-side (for debugging/observability) but return a generic message to the client for unexpected (5xx) errors, while still returning specific, safe messages for expected operational errors (validation failures, 404s) since those are meant to guide the client's behavior.

**Q: What's the difference in async error handling behavior between Express 4 and Express 5?**
Answer: In Express 4, route handlers that are `async` functions do not have their rejections automatically caught by Express — you must manually call `next(err)` or use a wrapper like `asyncHandler`. Express 5 changed this: if a route handler or middleware returns a rejected Promise, Express automatically calls `next(err)` for you, making manual wrapping largely unnecessary. Most production code today still targets Express 4 (or needs to support both), so knowing the `asyncHandler` pattern remains essential.
