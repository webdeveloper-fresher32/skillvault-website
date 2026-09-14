# Phase 08 — Error Handling and Validation

## Overview

Working code that never handles failure is a demo, not a backend. This phase covers how Node.js and Express applications should detect, classify, and respond to failure — from a single `try/catch` around a database call all the way up to what should happen when the entire process hits an error it cannot recover from. You'll build a reusable custom error hierarchy, a centralized Express error handler with a consistent JSON error shape, an `asyncHandler` wrapper so you never again write a bare `try/catch` in a route, deep schema validation with Joi and Zod, and process-level safety nets (`uncaughtException`, `unhandledRejection`, graceful shutdown) that keep a production service from dying ugly — or worse, staying alive in a corrupted state.

## Files in This Phase

| File | Topic |
|------|-------|
| `01-Error-Handling-Fundamentals.md` | Sync/async `try/catch`, error-first callbacks recap, custom `Error` subclasses, operational vs programmer errors |
| `02-Centralized-Error-Handling-in-Express.md` | Express error-handling middleware, a complete centralized handler, `asyncHandler` for async routes, consistent JSON error format |
| `03-Input-Validation-Patterns.md` | Joi and Zod schema validation in depth, nested object/array validation, custom validators |
| `04-Process-Level-Error-Handling.md` | `uncaughtException`, `unhandledRejection`, graceful shutdown on `SIGTERM`/`SIGINT`, why crash-and-restart beats "keep going" |

## Prerequisites

- Phase 01–02: Node fundamentals, the event loop, Promises/async-await.
- Phase 04: Express middleware — this phase builds directly on `next()` and the middleware chain.
- Phase 05: Basic request validation (`express-validator`/Joi intro) — this phase goes deeper.

## What You Should Be Able to Do After This Phase

- Explain the difference between operational errors (expected, recoverable) and programmer errors (bugs) — and defend it in an interview.
- Design a custom `Error` class hierarchy (`AppError`, `NotFoundError`, `ValidationError`, etc.) used consistently across an app.
- Write a single centralized Express error-handling middleware that returns a consistent JSON error shape for every failure mode.
- Wrap every async route handler so a rejected promise can never crash the process or hang a request.
- Validate deeply nested request bodies with Joi or Zod, including custom business-rule validators.
- Wire up `uncaughtException`/`unhandledRejection` handlers and a graceful shutdown sequence, and explain why "log and continue" is the wrong instinct after an uncaught exception.

---

Next: **Phase 09** — Testing (unit tests, integration tests, mocking, test-driven Express development).
