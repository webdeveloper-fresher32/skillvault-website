# Callbacks and Promises — Complete Guide

## Table of Contents
1. [What is Asynchronous Code](#1-what-is-asynchronous-code)
2. [Callbacks](#2-callbacks)
3. [Callback Hell](#3-callback-hell)
4. [Promises: The Three States](#4-promises-the-three-states)
5. [Consuming Promises: .then/.catch/.finally](#5-consuming-promises-thencatchfinally)
6. [Chaining and Error Propagation](#6-chaining-and-error-propagation)
7. [Promise Combinators](#7-promise-combinators)
8. [Creating Custom Promises](#8-creating-custom-promises)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. What is Asynchronous Code

JavaScript runs on a single thread — one call stack, one thing happening at a time. Yet a browser tab can fetch data over the network, wait 3 seconds, and respond to a click, all without freezing. It does this by handing time-consuming work (network requests, timers, file reads in Node.js) off to the browser or Node runtime, and continuing to run other code while that work happens in the background. When the background work finishes, the runtime schedules a callback to run on the main thread.

```
Synchronous code:                  Asynchronous code:
  line 1 runs                        line 1 runs
  line 2 runs (waits for line 1)     line 2 starts a timer, does NOT wait
  line 3 runs (waits for line 2)     line 3 runs immediately
  ...                                 ... (timer fires later, its
                                          callback runs when the timer
                                          completes, whenever that is)
```

Asynchronous programming in JavaScript has gone through three generations of syntax, in this order: **callbacks** → **Promises** → **async/await**. All three ultimately describe the same thing — "do this, and when it's done, do that" — but each generation makes the code easier to read and reason about than the last. This lesson covers the first two.

---

## 2. Callbacks

A **callback** is a function passed as an argument to another function, to be invoked later — usually once some operation completes.

```js
function greetAfterDelay(name, callback) {
  setTimeout(() => {
    console.log(`Hello, ${name}!`);
    callback();
  }, 1000);
}

greetAfterDelay("Asha", () => {
  console.log("Greeting complete.");
});

// Output (after ~1 second):
// Hello, Asha!
// Greeting complete.
```

Callbacks are the foundation asynchronous JavaScript is built on — `setTimeout`, DOM event listeners (`addEventListener`), and Node.js's `fs.readFile` all use the callback pattern. But callbacks have a well-known weakness once you need to run several async steps **in sequence**, each depending on the result of the last.

---

## 3. Callback Hell

Consider fetching a user, then their orders, then the details of their most recent order — each step depends on the previous step's result, and each step is asynchronous.

```js
getUser(userId, (err, user) => {
  if (err) {
    console.error("Failed to get user:", err);
  } else {
    getOrders(user.id, (err, orders) => {
      if (err) {
        console.error("Failed to get orders:", err);
      } else {
        getOrderDetails(orders[0].id, (err, details) => {
          if (err) {
            console.error("Failed to get order details:", err);
          } else {
            applyDiscount(details, (err, finalPrice) => {
              if (err) {
                console.error("Failed to apply discount:", err);
              } else {
                console.log("Final price:", finalPrice);
              }
            });
          }
        });
      }
    });
  }
});
```

This shape — nested callbacks marching diagonally across the screen — is universally nicknamed **"callback hell"** or the **"pyramid of doom"**. It has three concrete problems, not just a cosmetic one:

```
1. Readability
   The success path is buried inside four levels of indentation.
   You have to mentally track which `err` belongs to which call.

2. Error handling is repetitive and easy to get wrong
   Every level needs its own if (err) check. Forget one, and an
   error silently disappears or crashes trying to read a property
   of undefined.

3. Composition is hard
   There is no simple way to say "run these three independently and
   wait for all of them" or "run this only if that other thing
   succeeds" without writing more nested/branching callback code.
```

Promises were designed specifically to solve these three problems.

---

## 4. Promises: The Three States

A **Promise** is an object representing the eventual result of an asynchronous operation. It exists in exactly one of three states at any time, and once it leaves the `pending` state, it can never change state again — this is called being **settled**.

```
                    ┌───────────┐
                    │  pending  │   ← initial state, operation in progress
                    └─────┬─────┘
               resolve(v) │  reject(e)
              ┌───────────┴───────────┐
              ▼                       ▼
      ┌───────────────┐       ┌───────────────┐
      │   fulfilled    │       │   rejected    │
      │ (has a value)  │       │ (has a reason)│
      └───────────────┘       └───────────────┘

  Once a Promise is fulfilled or rejected, it is "settled" —
  it CANNOT transition to any other state, ever. Calling resolve()
  a second time, or calling reject() after resolve(), has no effect.
```

- **pending** — the initial state. The operation hasn't completed yet.
- **fulfilled** — the operation completed successfully, and the Promise now holds a resulting value.
- **rejected** — the operation failed, and the Promise now holds a reason (usually an `Error`).

```js
const promise = new Promise((resolve, reject) => {
  const success = true;
  setTimeout(() => {
    if (success) {
      resolve("Data loaded!");   // → fulfilled
    } else {
      reject(new Error("Load failed")); // → rejected
    }
  }, 1000);
});

console.log(promise); // Promise { <pending> }  — immediately after creation
```

A Promise is also described as **settled** (fulfilled or rejected, as opposed to pending) and a fulfilled/rejected Promise is sometimes called **resolved** — though "resolved" technically means "locked in to follow the state of another promise or value," which is a subtlety beyond day-to-day use.

---

## 5. Consuming Promises: .then/.catch/.finally

You attach callbacks to a Promise using `.then()`, `.catch()`, and `.finally()`. All three return a **new Promise**, which is what makes chaining possible.

```js
function fetchUser(id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id > 0) {
        resolve({ id, name: "Priya" });
      } else {
        reject(new Error("Invalid user id"));
      }
    }, 500);
  });
}

fetchUser(1)
  .then((user) => {
    console.log("Got user:", user.name);   // runs on fulfillment
  })
  .catch((err) => {
    console.error("Error:", err.message);  // runs on rejection
  })
  .finally(() => {
    console.log("Request finished.");      // runs either way
  });
```

### Field-by-Field Breakdown

```
.then(onFulfilled, onRejected)
  ↳ onFulfilled runs if the Promise resolves. Receives the resolved value.
  ↳ onRejected (2nd arg, rarely used directly) runs if it rejects.
  ↳ Prefer .catch() over the second argument — see chaining section below.
  ↳ Returns a NEW Promise, resolved with whatever onFulfilled returns.

.catch(onRejected)
  ↳ Shorthand for .then(undefined, onRejected).
  ↳ Catches a rejection from THIS promise, or from any .then() before it
    in the chain that didn't already have its own .catch().

.finally(onFinally)
  ↳ Runs regardless of fulfillment or rejection.
  ↳ Does not receive the value or the error — used for cleanup only
    (hiding a spinner, closing a connection, stopping a loading flag).
  ↳ Passes the original settlement through unchanged to the next link.
```

---

## 6. Chaining and Error Propagation

Because `.then()` returns a new Promise, you can chain multiple asynchronous steps in a flat sequence instead of nesting them — directly solving the "pyramid of doom" from Section 3.

```js
function getUser(id) {
  return Promise.resolve({ id, name: "Rahul" });
}
function getOrders(user) {
  return Promise.resolve([{ id: 101, total: 250 }]);
}
function getOrderDetails(order) {
  return Promise.resolve({ ...order, item: "Keyboard" });
}

getUser(1)
  .then((user) => getOrders(user))
  .then((orders) => getOrderDetails(orders[0]))
  .then((details) => {
    console.log("Order details:", details);
  })
  .catch((err) => {
    // A single .catch() at the end catches an error from ANY step above.
    console.error("Something failed along the chain:", err.message);
  });
```

```
Flat chain (readable, one level of indentation):

  getUser(1)
     │  .then → getOrders(user)
     │  .then → getOrderDetails(orders[0])
     │  .then → log details
     │
     └──────────────► .catch (catches a rejection from ANY link above)

If getOrders() rejects, execution SKIPS getOrderDetails() and the
next .then(), jumping straight to the nearest .catch() below it —
just like a try/catch skips straight to the catch block.
```

### Throwing Inside a .then()

If you `throw` inside a `.then()` handler (or return a rejected Promise), the chain's next `.catch()` receives it — exceptions in a `.then()` do not crash your program, they become a rejection.

```js
getUser(1)
  .then((user) => {
    if (!user.name) throw new Error("User has no name");
    return user;
  })
  .catch((err) => console.error(err.message));
```

---

## 7. Promise Combinators

When you need to run **multiple** Promises concurrently rather than one after another, use one of the four combinator methods. They differ in how they treat rejections.

```
Promise.all([p1, p2, p3])
  ↳ Waits for ALL to fulfill. Resolves with an array of values, in order.
  ↳ If ANY promise rejects, Promise.all immediately rejects with that
    reason — the other still-pending promises are NOT cancelled, but
    their results are discarded by Promise.all (they keep running).
  ↳ Use when: you need every result, and any single failure should
    fail the whole operation ("fetch user + fetch settings, both required").

Promise.allSettled([p1, p2, p3])
  ↳ Waits for ALL to settle (fulfilled OR rejected) — never rejects itself.
  ↳ Resolves with an array of { status, value } or { status, reason }
    objects, one per input promise, in order.
  ↳ Use when: you want every result regardless of individual failures
    ("send 5 independent analytics pings, report which ones failed").

Promise.race([p1, p2, p3])
  ↳ Settles as soon as the FIRST promise settles — fulfilled or rejected.
  ↳ Use when: you want the fastest result, win-or-lose
    ("fetch from primary and backup server, use whichever answers first").

Promise.any([p1, p2, p3])
  ↳ Settles as soon as the FIRST promise FULFILLS.
  ↳ If ALL promises reject, it rejects with an AggregateError containing
    all individual errors.
  ↳ Use when: you want the first SUCCESS, ignoring failures along the way
    ("try 3 CDNs, use whichever one succeeds first").
```

```js
const p1 = new Promise((res) => setTimeout(() => res("A"), 300));
const p2 = new Promise((res) => setTimeout(() => res("B"), 100));
const p3 = new Promise((_, rej) => setTimeout(() => rej("C failed"), 200));

Promise.all([p1, p2])
  .then((results) => console.log("all:", results)); // all: ['A', 'B'] (after ~300ms)

Promise.allSettled([p1, p2, p3])
  .then((results) => console.log("allSettled:", results));
  // [{status:'fulfilled',value:'A'}, {status:'fulfilled',value:'B'},
  //  {status:'rejected',reason:'C failed'}]

Promise.race([p1, p2, p3])
  .then((winner) => console.log("race winner:", winner)) // 'B' (fastest at 100ms)
  .catch((err) => console.log("race lost to a rejection:", err));

Promise.any([p3, p1, p2])
  .then((firstSuccess) => console.log("any:", firstSuccess)); // 'B' (first fulfillment)
```

---

## 8. Creating Custom Promises

Any callback-based or event-based API can be **promisified** — wrapped in a `new Promise()` so it can be used with `.then()` or `await`.

```js
function delay(ms, value) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

delay(1000, "done waiting").then(console.log); // "done waiting" after 1s

// Promisifying a Node-style (error-first) callback API:
function readFilePromise(path, readFileCallback) {
  return new Promise((resolve, reject) => {
    readFileCallback(path, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

// Promisifying an XMLHttpRequest (older browser API):
function getJSON(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "json";
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(new Error(`Request failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send();
  });
}
```

### Field-by-Field Breakdown

```
new Promise((resolve, reject) => { ... })
  ↳ The "executor" function runs IMMEDIATELY and SYNCHRONOUSLY,
    the instant the Promise is constructed — not later.
  ↳ resolve(value)  → moves the Promise to "fulfilled" with that value.
  ↳ reject(reason)  → moves the Promise to "rejected" with that reason.
  ↳ Calling resolve/reject after the Promise already settled does nothing.
  ↳ If the executor throws synchronously, the Promise auto-rejects
    with the thrown error — no need to wrap it in try/catch yourself.
```

---

## 9. Hands-On Exercises

**Exercise 1:** Write a function `wait(ms)` that returns a Promise resolving after `ms` milliseconds with the string `"waited"`. Chain three calls: `wait(1000).then(...).then(() => wait(500)).then(...)`, logging a message at each step with `console.log(new Date().toISOString())` so you can observe the real elapsed time between logs.

**Exercise 2:** Take the callback-hell example from Section 3 (`getUser` → `getOrders` → `getOrderDetails` → `applyDiscount`) and rewrite each function to return a Promise instead of accepting a callback. Then rewrite the whole nested pyramid as a flat `.then()` chain with a single `.catch()` at the end. Add an artificial failure (make `getOrders` reject for a specific user id) and confirm the `.catch()` handles it without needing changes anywhere else in the chain.

**Exercise 3:** Create three Promises that resolve after random delays between 100ms and 2000ms with different string values, and one Promise that always rejects after 500ms. Run all four through `Promise.allSettled()` and log the full results array. Then run just the three resolving ones through `Promise.race()` and confirm the fastest one wins. Explain in a code comment why running the same four (including the rejecting one) through `Promise.race()` could produce an unexpected result if the rejection is the fastest to settle.

**Exercise 4:** Build a `promisifiedGeolocation()` function that wraps the browser's `navigator.geolocation.getCurrentPosition(successCallback, errorCallback)` (a callback-based API) in a `new Promise()`. Call it with `.then()` to log the latitude/longitude, and `.catch()` to log a friendly message if the user denies permission.

**Exercise 5:** Simulate fetching from three CDN mirrors, where each is a function returning a Promise that rejects with a 40% chance (use `Math.random()`) after a random delay, and resolves with `"content from mirror N"` otherwise. Use `Promise.any()` to get content from whichever mirror succeeds first. Run the whole exercise 10 times in a loop and log how many times `Promise.any()` itself rejected (meaning all three mirrors failed) versus succeeded — this should roughly match the probability of three independent 40%-failure-rate calls all failing together (0.4³ ≈ 6.4%).

---

## 10. Interview Q&A

**Q: What is "callback hell" and what specific problems does it cause beyond deep indentation?**
Answer: Callback hell is the pattern where each asynchronous step is nested inside the callback of the previous step, producing code that marches diagonally across the screen. Beyond being visually unpleasant, it causes three concrete engineering problems: readability suffers because the success path is buried under increasing indentation and it becomes hard to trace which `err` parameter belongs to which call; error handling becomes repetitive and error-prone because every nesting level needs its own `if (err)` check, and a forgotten check can silently swallow an error or throw trying to read a property of `undefined`; and composition becomes difficult because there's no clean built-in way to express "run these operations concurrently and wait for all of them" or "run this only if that other operation succeeded" without writing more branching callback code by hand. Promises solve all three by returning first-class values that can be chained, combined, and centrally error-handled.

**Q: Explain the three states of a Promise and why a Promise can only settle once.**
Answer: A Promise starts in the `pending` state and transitions exactly once to either `fulfilled` (holding a resolved value) or `rejected` (holding a reason, usually an Error) — this one-way transition is called "settling." Once settled, a Promise's state and value are frozen forever; calling `resolve()` again, or calling `reject()` after `resolve()` already ran, simply has no effect. This immutability is a deliberate design choice: it means any code that later attaches a `.then()` to an already-settled Promise gets the same, unchanging answer, and consumers never need to worry about a "yes" flipping into a "no" after the fact. It's what makes Promises safe to pass around and hand to multiple consumers, unlike a callback which could in principle be invoked multiple times or with conflicting results.

**Q: What is the difference between Promise.all and Promise.allSettled, and when would you choose one over the other?**
Answer: `Promise.all` waits for every input promise to fulfill and resolves with an array of their values in order, but it "fails fast" — the moment any single promise rejects, `Promise.all` immediately rejects with that reason, even though the other promises may still be running in the background. `Promise.allSettled`, by contrast, never rejects; it waits for every promise to settle, whether fulfilled or rejected, and resolves with an array of `{status, value}` or `{status, reason}` objects describing each outcome. Use `Promise.all` when every result is required and a single failure should invalidate the whole operation, such as loading a user record and their permissions where you can't proceed without both. Use `Promise.allSettled` when the operations are independent and you want to know the outcome of each regardless of others failing, such as firing off five analytics beacons where you want a report of which succeeded and which didn't, without one failure preventing you from seeing the others' results.

**Q: What happens if you throw an error inside a .then() callback?**
Answer: Throwing inside a `.then()` handler does not crash the program or bubble up as an uncaught synchronous exception — it is caught internally by the Promise machinery and converted into a rejection of the Promise that `.then()` returned. That rejection then propagates down the chain, skipping any subsequent `.then()` handlers, until it reaches the nearest `.catch()` (or the second argument of a `.then()`, though `.catch()` is idiomatic). This is exactly analogous to how a `throw` inside a `try` block skips to the nearest `catch`. It's what allows a single `.catch()` at the end of a long chain to handle both explicit rejections (`reject(...)`) and accidental thrown errors from any step in that chain.

**Q: Why would you use Promise.any instead of Promise.race, and what happens if every input promise rejects?**
Answer: `Promise.race` settles as soon as the first input promise settles, whether that settlement is a fulfillment or a rejection — so if the fastest promise happens to be one that fails, `Promise.race` rejects even though other, slower promises might have succeeded. `Promise.any` is specifically designed to ignore rejections and settle as soon as the first promise fulfills, which makes it the right tool for "try several sources and use whichever one actually succeeds first," such as querying redundant API mirrors or CDNs. If every single input promise rejects, `Promise.any` itself rejects, but not with any individual error — it rejects with an `AggregateError` whose `.errors` property is an array containing all of the individual rejection reasons, so the caller can inspect why every attempt failed.
