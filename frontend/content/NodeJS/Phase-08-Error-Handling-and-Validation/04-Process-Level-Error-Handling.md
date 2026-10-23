# Process-Level Error Handling — Complete Guide

## Table of Contents
1. [What Happens When Nothing Catches an Error](#1-what-happens-when-nothing-catches-an-error)
2. [uncaughtException](#2-uncaughtexception)
3. [unhandledRejection](#3-unhandledrejection)
4. [Why Crash-and-Restart Beats "Keep Going"](#4-why-crash-and-restart-beats-keep-going)
5. [Graceful Shutdown on SIGTERM/SIGINT](#5-graceful-shutdown-on-sigtermsigint)
6. [A Complete Production-Ready Bootstrap](#6-a-complete-production-ready-bootstrap)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What Happens When Nothing Catches an Error

Every error-handling technique in this phase so far — `try/catch`, Express's centralized error handler, `asyncHandler` — operates on the assumption that *something* in your code is positioned to catch the error. Process-level handlers are the last line of defense for the cases where nothing was: a bug in a background job with no `try/catch`, a rejected Promise nobody awaited, a `throw` inside a `setInterval` callback.

```
Request comes in
   │
   ▼
Route handler ──throws──▶ asyncHandler ──▶ next(err) ──▶ centralized error handler ──▶ JSON response
                                                                (Section 02)

Background job / timer / stray promise ──throws/rejects──▶ NOTHING is listening
                                                                    │
                                                                    ▼
                                                    process-level 'uncaughtException'
                                                    or 'unhandledRejection' handler
                                                    (this lesson — LAST resort only)
```

Process-level handlers are not a substitute for proper error handling elsewhere in your app — they're a safety net for catching what slipped through, logging it, and shutting down in a controlled way.

---

## 2. uncaughtException

Fired on the global `process` object when a synchronous error is thrown and nothing in the call stack caught it.

```javascript
process.on('uncaughtException', (err, origin) => {
  console.error('UNCAUGHT EXCEPTION — this indicates a bug:', err);
  console.error('Origin:', origin); // 'uncaughtException' or 'unhandledRejection'

  // Do NOT try to keep serving traffic after this. Log, then exit.
  process.exit(1);
});

// Somewhere else in the app — a genuine bug, no try/catch anywhere near it
setTimeout(() => {
  const config = undefined;
  console.log(config.database.host); // TypeError: Cannot read properties of undefined
}, 100);
```

Without the handler above, Node.js would print the stack trace to `stderr` and exit with a non-zero code automatically — that default behavior is actually correct and desirable. The reason to add your own handler is to **log the error properly** (structured logging, send to an error tracker like Sentry) and to **shut down gracefully** (Section 5) instead of dying mid-request.

**Critical rule: never use `uncaughtException` to "catch and continue."**

```javascript
// ANTI-PATTERN — do not do this
process.on('uncaughtException', (err) => {
  console.error('Ignoring error and continuing:', err);
  // no process.exit() — the process stays alive
});
```

Once an uncaught exception fires, the process is in an **unknown state**. Some in-flight operations may have partially completed, some may have leaked (a DB connection never released, a lock never freed, a variable left in an inconsistent shape). Continuing to serve new requests on top of that is how you get intermittent, nearly-impossible-to-reproduce production bugs — data corruption, memory leaks, cascading failures. Log it, shut down cleanly, and let your process manager restart with a known-good state.

---

## 3. unhandledRejection

Fired when a Promise rejects and no `.catch()` (or awaiting `try/catch`) ever handles it.

```javascript
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  // Treat this exactly as seriously as uncaughtException — convert it into one,
  // so it goes through the same shutdown path.
  throw reason;
});

process.on('uncaughtException', (err) => {
  console.error('Fatal error, shutting down:', err);
  process.exit(1);
});

// Example that triggers it — a detached promise nobody awaited or caught
async function loadUser(id) {
  if (!id) throw new Error('id is required');
  return { id, name: 'Ganesh' };
}

loadUser(); // called without await AND without .catch() — id is undefined, this rejects into the void
```

### Why this exists as a separate event from `uncaughtException`

Promises can reject long after the code that created them has finished running, and historically Node let a rejected Promise with no handler fail completely silently — a serious footgun, since it hid real bugs. `unhandledRejection` closes that gap. As of **Node.js 15+**, the default behavior (if you register no handler at all) changed from "print a warning" to "crash the process," which now matches `uncaughtException`'s severity — a good default, since an unhandled rejection is just as indicative of a bug as a thrown exception.

```javascript
// Common real-world source of unhandled rejections: a fire-and-forget call
function logAnalyticsEvent(event) {
  // Missing await/catch — if this endpoint is down, the rejection is unhandled
  analyticsClient.send(event);
}

// FIX 1: await it and handle failure
async function logAnalyticsEventFixed(event) {
  try {
    await analyticsClient.send(event);
  } catch (err) {
    console.warn('Analytics event failed to send (non-fatal):', err.message);
  }
}

// FIX 2: explicit .catch() when you deliberately don't want to await (fire-and-forget)
function logAnalyticsEventFireAndForget(event) {
  analyticsClient.send(event).catch((err) => {
    console.warn('Analytics event failed to send (non-fatal):', err.message);
  });
}
```

Note the distinction in Fix 2 — some rejections genuinely are fine to ignore in terms of program flow (a non-critical analytics call shouldn't fail the user's request), but they must still be **explicitly** caught with `.catch()`. "Ignore on purpose with a `.catch()`" is completely different from "never handled at all," which is what triggers `unhandledRejection`.

---

## 4. Why Crash-and-Restart Beats "Keep Going"

This is a frequent point of confusion for engineers used to web frameworks (Flask/Django dev server, or a React error boundary) where "catch the error, show a fallback, keep the app alive" is exactly the right instinct. For a **process handling many concurrent requests**, that instinct is dangerous once the error is a genuine programmer error (recall the operational vs. programmer distinction from `01-Error-Handling-Fundamentals.md`).

| Keep the process alive after an uncaught exception | Crash and let a process manager restart |
|---|---|
| Internal state may be corrupted (partial writes, stuck locks, leaked handles) — you don't know | Restart begins from a clean, known-good state |
| The *same* bug will likely be hit again by the next request, possibly compounding damage | One failed request is lost; the rest of the fleet (if running multiple instances) keeps serving |
| Memory leaks accumulate silently until an eventual, harder-to-diagnose crash | Fast failure surfaces the bug immediately, with a clean stack trace, close to when it happened |
| Debugging becomes archaeology — the crash you eventually see may be far removed from the actual bug | Logs point directly at the actual failure |

The standard production pattern is:

```
Bug happens → uncaughtException/unhandledRejection fires
           → log full details (Sentry/structured logs)
           → stop accepting new connections (Section 5)
           → finish in-flight requests if possible (bounded time)
           → process.exit(1)
           → process manager (PM2, systemd, Kubernetes) detects exit code 1
           → automatically restarts the process
           → (if running multiple replicas/pods, other instances kept serving throughout)
```

This is exactly why Kubernetes Pods, PM2, and systemd all exist in part to **restart failed processes automatically** — the platform assumes your app will occasionally crash on a genuine bug, and treats "crash cleanly and restart" as the expected, healthy failure mode rather than something to avoid at all costs.

---

## 5. Graceful Shutdown on SIGTERM/SIGINT

Whether triggered by a deliberate deploy (Kubernetes sending `SIGTERM` before killing a Pod), a manual `Ctrl+C` (`SIGINT`), or your own `uncaughtException` handler calling `process.exit()`, an abrupt process death mid-request causes dropped connections, half-written responses, and (worse) half-completed database transactions. Graceful shutdown means: stop accepting new work, finish what's in flight (with a timeout), then exit.

```javascript
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('OK'));
app.get('/slow', async (req, res) => {
  await new Promise((r) => setTimeout(r, 5000)); // simulate slow work
  res.send('done after 5s');
});

const server = app.listen(3000, () => console.log('Listening on :3000'));

let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return; // ignore duplicate signals during shutdown
  isShuttingDown = true;
  console.log(`${signal} received — starting graceful shutdown`);

  // 1. Stop accepting NEW connections immediately.
  //    In-flight requests are allowed to finish.
  server.close((err) => {
    if (err) {
      console.error('Error during server close:', err);
      process.exit(1);
    }
    console.log('All connections closed cleanly.');

    // 2. Close other resources here — DB pools, message queue connections, etc.
    // db.pool.end();
    // redisClient.quit();

    console.log('Shutdown complete. Exiting.');
    process.exit(0);
  });

  // 3. Safety net: if requests don't finish within a timeout, force exit anyway
  //    (e.g. a stuck connection that would otherwise hang shutdown forever).
  setTimeout(() => {
    console.error('Forced shutdown after timeout — some requests may have been dropped.');
    process.exit(1);
  }, 10_000).unref(); // .unref() so this timer alone can't keep the process alive
}

process.on('SIGTERM', () => shutdown('SIGTERM')); // sent by process managers/orchestrators (k8s, systemd)
process.on('SIGINT', () => shutdown('SIGINT'));   // sent by Ctrl+C in a terminal
```

Try it: start the server, `curl localhost:3000/slow` in one terminal, then `Ctrl+C` the server in another within the 5 seconds. You'll see `SIGINT received` logged immediately, but the process keeps running until that in-flight `/slow` request finishes (or the 10s force-exit timer fires) — new requests during that window are refused because `server.close()` stops listening for new connections.

### Why both SIGTERM and SIGINT matter

| Signal | Typical source | Meaning |
|---|---|---|
| `SIGTERM` | Kubernetes (before force-killing a Pod), `systemctl stop`, `docker stop`, PM2 restart | "Please shut down cleanly" — the standard, polite termination request |
| `SIGINT` | Ctrl+C in an interactive terminal | Same intent, but from a human at a terminal |
| `SIGKILL` | Forceful kill (`kill -9`), or the orchestrator after a grace period expires | Cannot be caught or handled at all — the process is terminated immediately, no cleanup possible |

Kubernetes specifically sends `SIGTERM`, waits for a configurable `terminationGracePeriodSeconds` (default 30s), and if the process hasn't exited by then, sends `SIGKILL`. This is precisely why the force-exit timeout in the example above exists — you want your own graceful window to be comfortably shorter than the orchestrator's, so you control the shutdown rather than being killed mid-cleanup.

---

## 6. A Complete Production-Ready Bootstrap

Putting process-level safety nets, graceful shutdown, and the centralized error handling from earlier lessons together into one realistic entry point:

```javascript
// server.js
const express = require('express');
const { errorHandler } = require('./middleware/errorHandler');
const { notFoundHandler } = require('./middleware/notFound');
const usersRouter = require('./routes/users');

const app = express();
app.use(express.json());
app.use('/users', usersRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server listening on :${PORT} (pid ${process.pid})`);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    console.log('HTTP server closed. Closing DB connections...');
    // db.disconnect().then(() => process.exit(0));
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Graceful shutdown timed out — forcing exit.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Last-resort safety nets — log everything, then fail fast and cleanly.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
  // Re-throwing converts this into an uncaughtException, funnelling both
  // failure modes through ONE shutdown code path below.
  throw reason;
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception — process is in an unknown state:', err);
  // Attempt the same graceful close, but bound it tightly — we don't fully
  // trust process state anymore, so don't linger.
  server.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 3_000).unref();
});

module.exports = server;
```

This is the shape you'll find (with more moving parts — DB pools, message queue consumers, metrics flush) at the entry point of most production Node.js services.

---

## 7. Hands-On Exercises

**Exercise 1:** Build the Express app from Section 5. Start it, run a slow request, and `Ctrl+C` mid-request. Confirm the in-flight request completes and the process exits cleanly afterward, while a NEW request attempted during shutdown is refused (connection error).

**Exercise 2:** Add an `uncaughtException` handler that logs the error and calls `process.exit(1)`. Trigger it deliberately with a bad route (`app.get('/boom', () => { null.x; })` outside of `asyncHandler`, and not awaited) and confirm the process exits with code 1 (check with `echo $?` after it exits).

**Exercise 3:** Write a function that calls an async operation without `await` or `.catch()`, deliberately causing an `unhandledRejection`. Add a handler for it, log the reason, and re-throw so it's caught by your `uncaughtException` handler too — confirm both console messages appear in the right order.

**Exercise 4:** Reduce the force-exit timeout to 2 seconds and start a request that takes 10 seconds. Confirm the process force-exits with the "forced shutdown" message rather than waiting for the slow request — this demonstrates why the timeout safety net matters.

**Exercise 5:** Research (from documentation you already have, or infer from behavior) what `terminationGracePeriodSeconds` does in a Kubernetes Pod spec, and explain in writing why your app's own graceful-shutdown timeout should always be set shorter than that value.

---

## 8. Interview Q&A

**Q: What is the difference between `uncaughtException` and `unhandledRejection`?**
Answer: `uncaughtException` fires when a synchronously thrown error propagates all the way up with nothing catching it. `unhandledRejection` fires when a Promise rejects and no `.catch()` or awaiting `try/catch` ever handles that rejection. They're conceptually the same failure mode (an error nothing was positioned to handle) but surface through different mechanisms because synchronous throws and Promise rejections propagate differently. Since Node 15+, an unhandled rejection with no listener crashes the process by default, matching `uncaughtException`'s severity.

**Q: Why shouldn't you use `process.on('uncaughtException', ...)` to simply log the error and let the process keep running?**
Answer: Once an uncaught exception occurs, the process's internal state is unverifiable — in-flight operations may be partially complete, resources (DB connections, file handles, locks) may have leaked, and shared in-memory state could be inconsistent. Continuing to serve new requests on top of that unknown state risks data corruption and unpredictable cascading failures that are far harder to debug than a clean crash. The correct pattern is to log full details, attempt a bounded graceful shutdown, and exit — letting a process manager restart from a known-good state.

**Q: Why is "crash and restart" often safer than "catch everything and keep running" for a Node.js server process?**
Answer: A crash-and-restart strategy guarantees every new process starts from a clean, known state, and isolates the blast radius of any single failure to the requests active at the time of the crash. "Catch and continue" risks compounding a corrupted state across many subsequent requests and hides bugs behind seemingly-successful responses until a much harder-to-diagnose failure surfaces later. This is precisely why process managers (PM2, systemd) and orchestrators (Kubernetes) are designed around automatically restarting crashed processes — a fast, clean failure is the expected and preferred outcome for genuine bugs.

**Q: What does graceful shutdown mean, and why do you need both a `server.close()` call and a timeout?**
Answer: Graceful shutdown means stopping acceptance of new connections/requests while allowing already-in-flight requests to finish, then releasing other resources (DB pools, queue connections) before exiting — this avoids dropping active client requests or leaving transactions half-committed. `server.close()` alone can hang indefinitely if a connection never completes (a stuck request, a client that never closes its socket), so a timeout is added as a safety net to force `process.exit()` after a bounded wait, ensuring shutdown never blocks forever.

**Q: Why does Kubernetes send SIGTERM before SIGKILL, and how should an application respond to SIGTERM?**
Answer: SIGTERM is a polite request to terminate that the process can intercept and handle — the application is expected to stop accepting new traffic, finish in-flight work within a grace period (`terminationGracePeriodSeconds`, default 30s in Kubernetes), release resources, and exit voluntarily. If the process hasn't exited by the end of that grace period, Kubernetes sends SIGKILL, which cannot be caught or handled and terminates the process immediately with no cleanup. An application should register a SIGTERM handler that performs graceful shutdown with its own internal timeout set comfortably shorter than the orchestrator's grace period, so it controls its own exit rather than being forcibly killed mid-cleanup.

**Q: Give an example of a bug that would trigger `unhandledRejection` in real code, and how you'd fix it.**
Answer: A common case is a "fire-and-forget" async call made without `await` or `.catch()` — for example, `analyticsClient.send(event)` called inside a synchronous function, where `send()` returns a Promise that later rejects because the analytics service is down. Since nothing observes that rejection, it becomes unhandled. The fix is either to `await` it inside a `try/catch` if the caller can be `async`, or to explicitly attach `.catch(err => console.warn(...))` if the call is intentionally fire-and-forget — the key is that some handler must exist, even if it just logs and swallows a non-critical failure.
