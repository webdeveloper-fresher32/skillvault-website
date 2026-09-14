# Performance Profiling and Memory Leaks — Complete Guide

## Table of Contents
1. [Why Profile a Node App](#1-why-profile-a-node-app)
2. [Using `--inspect` and Chrome DevTools](#2-using---inspect-and-chrome-devtools)
3. [What "Memory Leak" Means in a Garbage-Collected Language](#3-what-memory-leak-means-in-a-garbage-collected-language)
4. [Common Leak Pattern 1: Unbounded Caches](#4-common-leak-pattern-1-unbounded-caches)
5. [Common Leak Pattern 2: Event Listener Leaks](#5-common-leak-pattern-2-event-listener-leaks)
6. [Common Leak Pattern 3: Closures Holding References](#6-common-leak-pattern-3-closures-holding-references)
7. [How to Spot a Leak in Practice](#7-how-to-spot-a-leak-in-practice)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Profile a Node App

A Node process that runs for weeks (a long-lived server, unlike a short CLI script) will surface two classes of problems that never show up in quick local testing:

- **CPU bottlenecks** — code that's slower than it needs to be, blocking the event loop longer than expected.
- **Memory leaks** — memory usage that climbs steadily over time and never comes back down, eventually causing the process to slow down (excessive garbage collection) or crash (`JavaScript heap out of memory`).

Both are invisible in a five-minute local test but devastating in production after days of uptime. Profiling tools let you see *inside* a running process instead of guessing.

## 2. Using `--inspect` and Chrome DevTools

Node has a built-in debugging/profiling protocol you enable with a flag:

```bash
node --inspect server.js
# Debugger listening on ws://127.0.0.1:9229/<uuid>
# For help, see: https://nodejs.org/en/docs/inspector
```

Then open Chrome and navigate to `chrome://inspect` — Chrome detects the running Node process and gives you a "inspect" link that opens the full DevTools UI, connected to your Node process instead of a web page. From there:

```
┌─────────────────────────────────────────────────────────────┐
│                  Chrome DevTools (attached to Node)          │
│                                                                │
│  Sources tab   → set breakpoints, step through server code    │
│  Console tab   → run expressions against the live process     │
│  Memory tab    → take heap snapshots, compare them over time  │
│  Profiler tab  → record CPU profiles, see a flame graph of    │
│                   where time is actually being spent          │
└─────────────────────────────────────────────────────────────┘
```

Key workflows:

- **CPU profiling**: Profiler tab → "Start" → hit your slow endpoint a few times → "Stop" → DevTools shows a flame graph of which functions consumed the most CPU time. This turns "I think the JSON serialization is slow" into "72% of time was actually spent in `validateSchema()`."
- **Heap snapshots** (for memory leaks): Memory tab → take a snapshot → perform some actions (e.g. hit an endpoint 100 times) → take a second snapshot → use "Comparison" view to see what grew between the two. Objects that keep growing in count across repeated identical operations are your leak suspects.
- **`--inspect-brk`** instead of `--inspect` pauses execution on the very first line, useful when you need to set breakpoints before any code runs (e.g. debugging startup logic).

```bash
node --inspect server.js       # start debugging, don't pause
node --inspect-brk server.js   # start debugging, pause on line 1
```

For quick memory checks without the full DevTools UI, `process.memoryUsage()` gives a fast readout from inside the code itself:

```javascript
setInterval(() => {
  const mem = process.memoryUsage();
  console.log({
    rss: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,        // total memory the process holds
    heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`, // JS objects currently in use
    heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`, // heap size allocated by V8
  });
}, 5000);
```

If `heapUsed` climbs steadily over many intervals and never drops even after garbage collection would be expected to reclaim it, that's the signature of a leak.

## 3. What "Memory Leak" Means in a Garbage-Collected Language

JavaScript has automatic garbage collection — you never call `free()`. So how can memory still "leak"? A leak in a GC'd language means: **something is still holding a reference to an object that your program logically no longer needs**, so the garbage collector correctly considers it "still reachable" and never frees it.

```
Garbage collector's rule: an object is freed ONLY when NOTHING references it anymore.

Memory leak = a reference to unneeded data is accidentally kept alive somewhere
              (a global array, a cache with no eviction, a forgotten listener)
              → GC correctly refuses to free it → memory grows forever
```

It's not a bug in the garbage collector — it's a bug in your code's reference graph.

## 4. Common Leak Pattern 1: Unbounded Caches

A cache that never evicts old entries grows forever as new keys are added — this is one of the most common leak sources in real Node apps.

```javascript
// LEAKY: a plain object used as a cache, with no size limit and no eviction
const cache = {};

app.get('/users/:id', async (req, res) => {
  const id = req.params.id;
  if (cache[id]) return res.json(cache[id]);

  const user = await db.findUser(id);
  cache[id] = user; // grows forever — one entry per DISTINCT id ever requested
  res.json(user);
});

// After serving 2 million distinct user IDs over a few weeks,
// `cache` holds 2 million entries and never shrinks.
```

**Fix**: use a cache with a bounded size and/or TTL — either Redis (external, Lesson 03) or an in-process LRU cache that evicts the least-recently-used entries once a size limit is hit:

```javascript
const { LRUCache } = require('lru-cache');

const cache = new LRUCache({
  max: 1000,              // never hold more than 1000 entries
  ttl: 1000 * 60 * 5,     // entries expire after 5 minutes
});

app.get('/users/:id', async (req, res) => {
  const id = req.params.id;
  if (cache.has(id)) return res.json(cache.get(id));

  const user = await db.findUser(id);
  cache.set(id, user); // old/unused entries are automatically evicted
  res.json(user);
});
```

## 5. Common Leak Pattern 2: Event Listener Leaks

Every time you call `.on()`/`.addListener()` without ever calling `.off()`/`.removeListener()`, you attach one more listener that stays in memory, holding a reference to whatever closure it captured. If listeners are attached repeatedly (e.g. once per request) without cleanup, they accumulate forever.

```javascript
// LEAKY: attaches a new listener to a shared, long-lived emitter on EVERY request
const EventEmitter = require('events');
const dataBus = new EventEmitter(); // long-lived, shared across the whole app

app.get('/subscribe', (req, res) => {
  dataBus.on('update', (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`); // captures `res` in a closure!
  });
  // res is NEVER removed from the listener list when the request/connection ends
});

// After 10,000 requests: dataBus has 10,000 listeners, each holding a
// reference to a (probably closed) `res` object that can never be garbage collected.
```

Node even warns about this by default — if an `EventEmitter` accumulates more than 10 listeners for the same event, you'll see:

```
(node:12345) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
11 update listeners added. Use emitter.setMaxListeners() to increase limit.
```

**Do not just raise the limit to silence the warning** — that hides the leak instead of fixing it. Fix it by removing the listener when it's no longer needed:

```javascript
app.get('/subscribe', (req, res) => {
  const onUpdate = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  dataBus.on('update', onUpdate);

  // Clean up when the client disconnects — this is the fix
  req.on('close', () => {
    dataBus.off('update', onUpdate);
  });
});
```

## 6. Common Leak Pattern 3: Closures Holding References

A closure keeps every variable in its enclosing scope alive for as long as the closure itself is reachable — even variables the closure doesn't actually use if they're referenced elsewhere in the same scope chain in some engines' implementations, but more commonly the issue is a closure explicitly retaining a large object longer than intended.

```javascript
// LEAKY: each interval callback closes over `largeBuffer`, and the interval
// itself is never cleared, so largeBuffer can NEVER be garbage collected.
function startPolling() {
  const largeBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB, meant to be temporary

  setInterval(() => {
    // this closure holds a reference to largeBuffer forever,
    // and the interval itself is never stopped
    console.log('buffer size:', largeBuffer.length);
  }, 10000);
}

startPolling(); // 50MB is now permanently retained, and calling this
                 // repeatedly (e.g. once per request) leaks 50MB each time
```

**Fix**: clear intervals/timeouts when they're no longer needed, and avoid capturing large objects in long-lived closures if they're only needed once:

```javascript
function startPolling() {
  let intervalId;

  function poll() {
    const stats = collectStats(); // small, recomputed each time — not captured long-term
    console.log(stats);
  }

  intervalId = setInterval(poll, 10000);

  return () => clearInterval(intervalId); // caller can stop it, freeing everything
}

const stopPolling = startPolling();
// later, when no longer needed:
stopPolling();
```

A related pattern: forgetting to clear a `setTimeout`/`setInterval` when a request ends or a component unmounts (in server-rendered apps) — the timer, and everything its callback closure references, stays alive until it fires or is explicitly cleared.

## 7. How to Spot a Leak in Practice

```
Symptom checklist:
  ☐ Memory usage (RSS/heapUsed) climbs steadily over hours/days, never drops
  ☐ Restarting the process "fixes" the slowness — a strong leak signal
  ☐ MaxListenersExceededWarning appears in logs
  ☐ Process eventually crashes with "JavaScript heap out of memory"

Investigation steps:
  1. Watch process.memoryUsage() over time (or use a monitoring tool like
     PM2's built-in metrics, or an APM) — confirm heapUsed trends upward
     under STEADY load (not just growing because load itself is growing).
  2. Attach --inspect, open Chrome DevTools → Memory tab.
  3. Take a heap snapshot (baseline).
  4. Perform a repeatable action many times (e.g. hit one endpoint 500 times).
  5. Take a second heap snapshot.
  6. Use the "Comparison" view — sort by "# Delta" (object count growth).
     Whatever object type grew by roughly the number of actions you performed
     (e.g. 500 more "Object" or "EventListener" entries after 500 requests)
     is very likely your leak.
  7. Trace the "Retainers" panel for one of those objects — it shows exactly
     what is holding a reference to it, pointing you at the leaking code.
```

---

## 8. Hands-On Exercises

**Exercise 1:** Start a simple Express server with `node --inspect server.js`, open `chrome://inspect`, and connect DevTools. Set a breakpoint inside a route handler and confirm it pauses execution when you hit that route with `curl`.

**Exercise 2:** Build the leaky unbounded-cache example from Section 4. Hit it with 1000 distinct IDs (`for i in {1..1000}; do curl -s "localhost:3000/users/$i" > /dev/null; done`) and log `process.memoryUsage().heapUsed` before and after. Then swap in `lru-cache` with `max: 100` and repeat — compare heap growth.

**Exercise 3:** Build the leaky SSE/event-listener example from Section 5. Open and close several connections without ever disconnecting the listener; watch the `MaxListenersExceededWarning` appear. Fix it with `req.on('close', ...)` and confirm the warning no longer appears.

**Exercise 4:** Build the closure/interval leak example from Section 6. Call the leaky `startPolling()` 10 times in a loop and observe memory grow by roughly 500MB (10 × 50MB). Fix it so calling `stopPolling()` actually frees the memory (confirm via `process.memoryUsage()` after a manual `global.gc()` — run with `node --expose-gc` to make `global.gc()` available).

**Exercise 5:** Using Chrome DevTools' Memory tab, take two heap snapshots around the leaky cache exercise from Exercise 2, and use the Comparison view to identify which object type grew — confirm it matches your expectation (roughly one new entry per distinct ID you requested).

---

## 9. Interview Q&A

**Q: JavaScript has garbage collection — so how can a Node app "leak" memory?**
Answer: Garbage collection only frees memory that is no longer reachable from any live reference. A "leak" in a GC'd language means the program is unintentionally keeping a reference alive to data it no longer actually needs — an unbounded cache, a forgotten event listener, an uncleared interval closing over a large object. The GC is doing its job correctly (it can't free something still referenced); the bug is in the application's reference graph, not the garbage collector.

**Q: Name three common causes of memory leaks in a Node.js server and how you'd fix each.**
Answer: (1) Unbounded in-memory caches — a plain object or Map that grows with every distinct key ever seen; fix with an LRU cache with a max size and/or TTL, or move the cache to Redis. (2) Event listener leaks — repeatedly calling `.on()` on a long-lived `EventEmitter` (e.g. once per request) without ever calling `.off()`; fix by removing the listener when the associated resource (e.g. the request/connection) ends. (3) Closures holding large objects via uncleared `setInterval`/`setTimeout` — a timer callback that closes over a large buffer and is never cleared with `clearInterval`/`clearTimeout`; fix by always storing and clearing timer handles, and avoiding capturing large data in long-lived closures unnecessarily.

**Q: How would you use Chrome DevTools to actually find a memory leak in a running Node process, rather than guessing?**
Answer: Start the process with `--inspect`, open `chrome://inspect` in Chrome, and connect DevTools to it. In the Memory tab, take a baseline heap snapshot, perform the suspected leaking action repeatedly (e.g. hit an endpoint N times), then take a second snapshot. The Comparison view shows which object types grew and by how much between the two snapshots — an object count growing roughly in step with the number of repeated actions is a strong leak signal. From there, the Retainers panel on a specific object shows exactly what's still holding a reference to it, pointing directly at the leaking code.

**Q: What does the `MaxListenersExceededWarning` mean, and is raising the limit a valid fix?**
Answer: It means more than 10 listeners (the default limit) have been attached to the same event on a single `EventEmitter` instance, which is Node's heuristic warning that you might be leaking listeners (e.g. attaching one per request without ever removing it). Raising the limit with `setMaxListeners()` silences the warning but does not fix anything — if listeners really are being leaked, you've just delayed the point at which memory usage becomes visibly a problem. The correct fix is to ensure listeners are removed (`.off()`/`.removeListener()`) when they're no longer needed.

**Q: What's the practical difference between profiling for CPU issues versus profiling for memory leaks?**
Answer: CPU profiling (DevTools Profiler tab, or `--prof`) answers "where is time being spent during execution" — it records a flame graph over a short recording window while you exercise the slow code path, useful for finding hot functions or unexpectedly expensive operations. Memory leak investigation instead compares heap snapshots taken minutes or hours apart under repeated, otherwise-identical operations — the question isn't "what's slow right now" but "what keeps growing and never shrinks," which requires observing the process over time rather than a single point-in-time recording.

**Q: A production Node service needs restarting every few days because it slows down and eventually crashes with "JavaScript heap out of memory." What's your first step to investigate?**
Answer: Confirm it's actually a leak and not just growing traffic by watching `process.memoryUsage().heapUsed` over time under steady (not increasing) load — if it climbs without bound under constant load, that's a leak. Then attach `--inspect`, take heap snapshots before and after a period of normal operation (or a repeated specific action if you suspect a particular endpoint), and use the Comparison view to find which object type is accumulating. The fact that restarting "fixes" it temporarily is itself a strong signal that something's reference graph is growing unbounded rather than the app simply needing more baseline memory.
