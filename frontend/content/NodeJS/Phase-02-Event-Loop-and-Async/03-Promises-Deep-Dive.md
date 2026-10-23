# Promises Deep Dive — Complete Guide

## Table of Contents
1. [What is a Promise?](#1-what-is-a-promise)
2. [The Three Promise States](#2-the-three-promise-states)
3. [.then, .catch, .finally](#3-then-catch-finally)
4. [Chaining Promises](#4-chaining-promises)
5. [Promise Combinators: all, allSettled, race, any](#5-promise-combinators-all-allsettled-race-any)
6. [Common Pitfalls](#6-common-pitfalls)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is a Promise?

A Promise is an object representing the eventual completion (or failure) of an asynchronous operation and its resulting value. It's a first-class replacement for error-first callbacks that supports chaining, composition, and unified error handling.

```javascript
const promise = new Promise((resolve, reject) => {
  // "executor" function — runs IMMEDIATELY, synchronously
  const success = true;
  setTimeout(() => {
    if (success) resolve('Data loaded!');   // fulfill the promise
    else reject(new Error('Load failed'));  // reject the promise
  }, 1000);
});

promise
  .then(result => console.log(result))   // runs if resolved
  .catch(err => console.error(err));     // runs if rejected
```

---

## 2. The Three Promise States

```
                    ┌─────────────┐
                    │   PENDING    │  ← initial state
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              ▼                          ▼
      ┌───────────────┐         ┌────────────────┐
      │   FULFILLED     │         │    REJECTED     │
      │ (resolve called) │         │ (reject called)  │
      └───────────────┘         └────────────────┘

  A Promise is "settled" once it leaves PENDING — it can only
  transition ONCE, and the result (value or reason) is then
  IMMUTABLE forever. Calling resolve()/reject() again is a no-op.
```

| State | Meaning |
|-------|---------|
| **Pending** | Initial state — operation hasn't completed yet |
| **Fulfilled** | Operation completed successfully — has a resulting value |
| **Rejected** | Operation failed — has a reason (usually an `Error`) |

---

## 3. .then, .catch, .finally

```javascript
fetchUser(1)
  .then(user => {
    console.log('Got user:', user);
    return user.id; // value passed to the NEXT .then
  })
  .catch(err => {
    console.error('Something failed:', err.message);
  })
  .finally(() => {
    console.log('Always runs — success or failure, cleanup here');
  });
```

- **`.then(onFulfilled, onRejected)`** — takes up to two callbacks; the first runs on fulfillment, the (optional) second on rejection.
- **`.catch(onRejected)`** — shorthand for `.then(undefined, onRejected)`; catches any rejection from earlier in the chain.
- **`.finally(onFinally)`** — runs regardless of outcome, receives no arguments, useful for cleanup (closing connections, hiding loaders). It passes through the original value/error unchanged.

---

## 4. Chaining Promises

Each `.then()` returns a **new Promise**, which is what enables chaining. If you `return` a value inside `.then`, it's wrapped as a resolved Promise for the next link; if you `return` a Promise, the chain waits for it.

```javascript
function delay(ms, value) {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

delay(100, 1)
  .then(n => {
    console.log('step 1:', n);   // step 1: 1
    return n + 1;                 // plain value → auto-wrapped in a Promise
  })
  .then(n => {
    console.log('step 2:', n);   // step 2: 2
    return delay(100, n + 1);    // returning a Promise → chain WAITS for it
  })
  .then(n => {
    console.log('step 3:', n);   // step 3: 3 (after another 100ms)
  });
```

A `.catch` anywhere in the chain catches errors from **any** preceding `.then` — this is the equivalent of centralizing `if (err)` checks from callback hell into one place.

```javascript
delay(100, 1)
  .then(n => { throw new Error('boom'); })
  .then(n => console.log('never runs')) // skipped — error propagates past it
  .catch(err => console.error('caught:', err.message)); // caught: boom
```

---

## 5. Promise Combinators: all, allSettled, race, any

| Combinator | Resolves when | Rejects when | Use case |
|------------|---------------|---------------|----------|
| `Promise.all` | ALL promises fulfill | ANY promise rejects (immediately, "fail-fast") | Run independent tasks in parallel, need all results |
| `Promise.allSettled` | ALL promises settle (fulfilled or rejected) | Never rejects | Run parallel tasks, need every outcome even if some fail |
| `Promise.race` | The FIRST promise to settle (fulfill or reject) | If the first to settle is a rejection | Timeouts, "whichever finishes first" |
| `Promise.any` | The FIRST promise to fulfill | Only if ALL promises reject (`AggregateError`) | "Any one success is enough" — e.g., multiple mirrors/fallback servers |

```javascript
const p1 = delay(100, 'A');
const p2 = delay(50, 'B');
const p3 = Promise.reject(new Error('C failed'));

// Promise.all — fail-fast
Promise.all([p1, p2])
  .then(results => console.log(results)); // ['A', 'B'] — order matches input, not completion order

Promise.all([p1, p3])
  .catch(err => console.error('all() rejected:', err.message)); // 'C failed' — first rejection wins

// Promise.allSettled — always resolves, gives you every outcome
Promise.allSettled([p1, p3]).then(results => {
  console.log(results);
  /*
  [
    { status: 'fulfilled', value: 'A' },
    { status: 'rejected', reason: Error('C failed') }
  ]
  */
});

// Promise.race — first to SETTLE (could be a rejection!)
Promise.race([p1, p2]).then(result => console.log(result)); // 'B' (settles at 50ms, before A's 100ms)

// Promise.any — first to FULFILL, ignores rejections unless ALL reject
Promise.any([p3, p1]).then(result => console.log(result)); // 'A' — p3's rejection is ignored
```

**`Promise.all` vs `Promise.race` timeout pattern** — a very common interview/real-world snippet:

```javascript
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timed out')), ms)
  );
  return Promise.race([promise, timeout]);
}

await withTimeout(fetchDataFromSlowAPI(), 3000); // rejects if fetch takes > 3s
```

---

## 6. Common Pitfalls

```javascript
// PITFALL 1: Forgetting to return inside .then — breaks the chain's value/wait
somePromise
  .then(value => {
    doSomethingAsync(value); // ❌ NOT returned — next .then doesn't wait for it!
  })
  .then(() => {
    console.log('this runs BEFORE doSomethingAsync finishes');
  });

// Fix:
somePromise
  .then(value => {
    return doSomethingAsync(value); // ✅ chain waits for this Promise
  })
  .then(() => {
    console.log('this correctly runs AFTER doSomethingAsync finishes');
  });

// PITFALL 2: Unhandled promise rejection
async function risky() {
  throw new Error('oops');
}
risky(); // ❌ no .catch — Node prints an UnhandledPromiseRejection warning
         //    and (in modern Node) CRASHES the process by default

risky().catch(err => console.error('handled:', err.message)); // ✅

// PITFALL 3: Nesting .then instead of chaining (recreates callback hell)
getUser().then(user => {
  getOrders(user.id).then(orders => {          // ❌ nested, not chained
    console.log(orders);
  });
});
// Fix: return the inner promise and chain flatly
getUser()
  .then(user => getOrders(user.id))  // ✅ flat chain
  .then(orders => console.log(orders));

// PITFALL 4: Mixing async executor mistakes — resolve/reject called multiple times
new Promise((resolve, reject) => {
  resolve('first');
  resolve('second'); // ❌ no-op — Promise settled once, ignored silently
});

// PITFALL 5: Throwing inside .then is NOT the same as a callback error —
// it correctly becomes a rejection, but only if there's a .catch downstream
new Promise((resolve) => resolve(1))
  .then(() => { throw new Error('sync throw inside then'); })
  .then(() => console.log('skipped'))
  .catch(err => console.log('caught:', err.message)); // works fine — this IS handled correctly
```

---

## 7. Hands-On Exercises

**Exercise 1:** Write a `delay(ms, value)` helper (as shown above) and chain 3 `.then()` calls, each adding 1 to the previous value with a 200ms delay between each. Log each intermediate value.

**Exercise 2:** Create 3 promises: one that resolves after 100ms, one that rejects after 50ms, one that resolves after 200ms. Run all four combinators (`all`, `allSettled`, `race`, `any`) against them and log/compare the results.

**Exercise 3:** Reproduce the "forgetting to return" pitfall — write a `.then` chain where a nested async call isn't returned, and prove with `console.log` timestamps that the next `.then` fires too early.

**Exercise 4:** Write a function `fetchWithRetry(fn, retries)` that calls an async function `fn`, and if it rejects, retries up to `retries` times using recursive `.catch()`, finally rejecting if all attempts fail.

**Exercise 5:** Trigger an unhandled promise rejection deliberately (call an async function that throws, without `.catch`). Observe Node's warning/crash behavior, then add `process.on('unhandledRejection', ...)` to catch it globally and log it instead.

---

## 8. Interview Q&A

**Q: What are the three states of a Promise, and can a Promise change state more than once?**
Answer: Pending, Fulfilled, and Rejected. A Promise starts Pending and can transition exactly once to either Fulfilled (via `resolve`) or Rejected (via `reject`) — this is called "settling." Once settled, the state and resulting value/reason are permanent; calling `resolve`/`reject` again has no effect.

**Q: What's the difference between `Promise.all` and `Promise.allSettled`?**
Answer: `Promise.all` resolves with an array of values only if ALL input promises fulfill; if any one rejects, `all` immediately rejects with that reason ("fail-fast"), and you lose visibility into the other promises' outcomes. `Promise.allSettled` always resolves (never rejects) once every promise has settled, giving you an array of `{status, value}` or `{status, reason}` objects for each — useful when you need every outcome, not just the first failure.

**Q: What's the difference between `Promise.race` and `Promise.any`?**
Answer: `Promise.race` settles as soon as the FIRST promise settles — whether that's a fulfillment or a rejection. `Promise.any` settles as soon as the FIRST promise fulfills, ignoring rejections along the way; it only rejects if ALL promises reject, in which case it rejects with an `AggregateError` containing all the individual errors.

**Q: What happens if you forget to `return` a Promise inside a `.then()` callback?**
Answer: The outer chain doesn't wait for that inner Promise to settle — it immediately proceeds to the next `.then()` with `undefined` as the resolved value, executing subsequent `.then()` callbacks before the un-returned async operation actually finishes. This is a very common source of race-condition bugs; always `return` any Promise you create or call inside a `.then()`.

**Q: What is an unhandled promise rejection, and what happens if you don't handle one in Node?**
Answer: It occurs when a Promise rejects but there's no `.catch()` (or second argument to `.then()`) anywhere in its chain to handle the rejection. Node emits an `unhandledRejection` event; in modern Node versions (15+), an unhandled rejection by default crashes the process with a non-zero exit code, similar to an uncaught synchronous exception. You can listen for `process.on('unhandledRejection', handler)` as a last-resort safety net, but the real fix is always adding proper `.catch()`/`try-catch` at the source.

**Q: How does `.finally()` differ from `.then()`/`.catch()`?**
Answer: `.finally()` runs regardless of whether the Promise fulfilled or rejected, and it receives no arguments (it can't access the value or error) — it exists purely for side effects like cleanup (closing a DB connection, stopping a spinner). It also transparently passes through the original settlement (value or reason) to the next link in the chain, unless it itself throws or returns a rejected Promise.

**Q: How do you implement a timeout for a Promise-based operation that has no built-in timeout?**
Answer: Race the operation against a Promise that rejects after a timer, using `Promise.race([operationPromise, timeoutPromise])`. Since `race` settles on whichever promise settles first, if the timer fires before the operation completes, the combined Promise rejects with the timeout error even though the original operation may still be running in the background (note: `race` doesn't cancel the loser — it just ignores its eventual result).
