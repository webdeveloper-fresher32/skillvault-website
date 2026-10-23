# Async/Await and Error Handling — Complete Guide

## Table of Contents
1. [Why Async/Await Exists](#1-why-asyncawait-exists)
2. [async Functions and the await Keyword](#2-async-functions-and-the-await-keyword)
3. [Error Handling with try/catch](#3-error-handling-with-trycatch)
4. [Converting Promise Chains to Async/Await](#4-converting-promise-chains-to-asyncawait)
5. [Sequential vs Parallel Await](#5-sequential-vs-parallel-await)
6. [Common Pitfalls](#6-common-pitfalls)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Async/Await Exists

`async`/`await`, introduced in ES2017, is **syntactic sugar over Promises** — it does not replace Promises or introduce a new asynchronous mechanism. Every `async` function still returns a Promise, and `await` still works only on "thenable" values. What it changes is how the code *reads*: instead of chaining `.then()` calls, you write asynchronous code that looks and reads like ordinary synchronous, top-to-bottom code, while the engine still suspends and resumes execution behind the scenes without blocking the main thread.

```
Promise chain:                          async/await equivalent:

  fetchUser(id)                           async function loadOrder(id) {
    .then(user => fetchOrders(user))         const user = await fetchUser(id);
    .then(orders => fetchDetails(orders[0]))  const orders = await fetchOrders(user);
    .then(details => console.log(details))    const details = await fetchDetails(orders[0]);
    .catch(err => console.error(err));        console.log(details);
                                             }

Same behavior. The async/await version reads top-to-bottom like
synchronous code — no nested callbacks, no chain of .then() calls.
```

---

## 2. async Functions and the await Keyword

Adding the `async` keyword before a function declaration does two things: it makes the function **always return a Promise** (even if you `return` a plain value, it gets wrapped), and it allows you to use `await` inside that function's body.

```js
async function greet() {
  return "Hello!";
}

greet().then((msg) => console.log(msg)); // "Hello!"
console.log(greet());                     // Promise {<pending>} — logged BEFORE it resolves
```

`await` pauses execution of the `async` function (and only that function — not the whole program) until the Promise it's given settles. If the Promise fulfills, `await` evaluates to the fulfilled value. If it rejects, `await` throws that rejection as an exception, which is why `await` pairs naturally with `try`/`catch`.

```js
function delay(ms, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

async function run() {
  console.log("Starting...");
  const result = await delay(1000, "data loaded");
  console.log(result);           // "data loaded" — logged ~1 second later
  console.log("Done.");
}

run();
console.log("This logs BEFORE 'data loaded' — run() suspended, main thread kept going.");
```

```
Execution order for the code above:

  1. "Starting..."                                     (sync, inside run())
  2. run() hits `await delay(...)` and SUSPENDS here —
     control returns to whoever called run()
  3. "This logs BEFORE 'data loaded'..."                (sync, outside run())
  4. --- ~1000ms passes, main thread free to do other work ---
  5. delay's Promise resolves → run() RESUMES exactly where it paused
  6. "data loaded"
  7. "Done."
```

`await` can only be used directly inside a function marked `async` (with one modern exception: **top-level await**, allowed directly inside ES modules).

---

## 3. Error Handling with try/catch

Because a rejected `await` throws, you handle errors with an ordinary `try`/`catch` block — the same construct you'd use for synchronous errors.

```js
async function loadUser(id) {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    const user = await response.json();
    console.log("User loaded:", user);
    return user;
  } catch (err) {
    console.error("Failed to load user:", err.message);
    throw err; // re-throw so the CALLER can also react, if needed
  } finally {
    console.log("Load attempt finished."); // always runs, success or failure
  }
}
```

### Field-by-Field Breakdown

```
try { ... }
  ↳ Any awaited Promise that rejects inside this block throws here,
    exactly like a synchronous throw would.

catch (err) { ... }
  ↳ Catches BOTH: rejections from awaited Promises AND ordinary
    synchronous throws (e.g. throw new Error(...) on the line above).

finally { ... }
  ↳ Runs whether the try block succeeded or the catch block ran.
  ↳ Used for cleanup: hiding a spinner, closing a resource, resetting
    a "loading" flag — logic that must run no matter the outcome.

throw err (inside catch)
  ↳ Re-throwing propagates the rejection to whoever called loadUser().
  ↳ Without this line, the error is "swallowed" — the caller sees
    loadUser() as having simply returned undefined, silently.
```

### Catching at the Call Site Instead

You don't have to `try`/`catch` inside the `async` function itself — you can also treat the call as a Promise and use `.catch()`, since an `async` function's rejection is just its returned Promise rejecting:

```js
loadUser(42).catch((err) => console.error("Caller caught:", err.message));

// or, from inside another async function:
async function main() {
  try {
    await loadUser(42);
  } catch (err) {
    console.error("main() caught:", err.message);
  }
}
```

---

## 4. Converting Promise Chains to Async/Await

Converting is mechanical: each `.then(value => ...)` becomes a line with `const value = await ...`, and the trailing `.catch()` becomes a `try`/`catch` wrapping the whole sequence.

```js
// BEFORE — Promise chain
function loadDashboard(userId) {
  return fetchUser(userId)
    .then((user) => {
      return fetchOrders(user.id).then((orders) => ({ user, orders }));
    })
    .then(({ user, orders }) => {
      return fetchRecommendations(user.id).then((recs) => ({ user, orders, recs }));
    })
    .catch((err) => {
      console.error("Dashboard load failed:", err);
      throw err;
    });
}

// AFTER — async/await (flat, no nested .then callbacks needed)
async function loadDashboard(userId) {
  try {
    const user = await fetchUser(userId);
    const orders = await fetchOrders(user.id);
    const recs = await fetchRecommendations(user.id);
    return { user, orders, recs };
  } catch (err) {
    console.error("Dashboard load failed:", err);
    throw err;
  }
}
```

Notice how the `async`/`await` version eliminates the nested `.then()` inside `.then()` that was needed just to carry `user` and `orders` forward to the next step — with `await`, every previous value is simply a local variable, already in scope.

---

## 5. Sequential vs Parallel Await

This is the single most common `async`/`await` performance mistake. Writing multiple independent `await` calls one after another runs them **sequentially**, even though they don't depend on each other — each one waits for the previous one to fully finish before starting.

```js
// SEQUENTIAL — total time ≈ sum of all three (slow, and unnecessarily so)
async function loadAllSequential() {
  const user = await fetchUser(1);          // waits ~500ms
  const posts = await fetchPosts(1);        // THEN waits ~500ms
  const comments = await fetchComments(1);  // THEN waits ~500ms
  return { user, posts, comments };
  // Total: ~1500ms
}

// PARALLEL — total time ≈ the SLOWEST of the three (fast)
async function loadAllParallel() {
  const [user, posts, comments] = await Promise.all([
    fetchUser(1),      // all three requests fire
    fetchPosts(1),      // at essentially the same time
    fetchComments(1),
  ]);
  return { user, posts, comments };
  // Total: ~500ms (the slowest single call, not the sum)
}
```

```
Sequential await:              Parallel await (Promise.all):

  t=0    fetchUser starts        t=0    all three start together
  t=500  fetchUser resolves             fetchPosts starts
         fetchPosts starts              fetchComments starts
  t=1000 fetchPosts resolves     t=500  ALL THREE resolve
         fetchComments starts           (assuming each takes ~500ms)
  t=1500 fetchComments resolves
  ─────────────────────────      ─────────────────────────
  Total: 1500ms                  Total: ~500ms
```

The rule: only use sequential `await` when a later call genuinely **needs the result** of an earlier one (e.g., you need the user's `id` before you can fetch their orders). If the calls are independent, start them all at once and await them together with `Promise.all`.

```js
// Starting requests without awaiting immediately also works, and is
// equivalent to Promise.all for two independent operations:
async function loadTwoParallel() {
  const userPromise = fetchUser(1);     // fires immediately, NOT awaited yet
  const postsPromise = fetchPosts(1);   // fires immediately too — runs concurrently
  const user = await userPromise;       // now wait for both
  const posts = await postsPromise;
  return { user, posts };
}
```

---

## 6. Common Pitfalls

```
Pitfall 1: Forgetting `await` before an async call
  const user = fetchUser(1);       // WRONG: user is a Promise, not the data!
  console.log(user.name);          // undefined — you're reading .name off a Promise

  const user = await fetchUser(1); // CORRECT

Pitfall 2: Using .forEach with async callbacks, expecting it to wait
  ids.forEach(async (id) => {
    await fetchUser(id);           // forEach does NOT await this callback —
  });                              // it fires all calls and moves on immediately
  console.log("done");             // logs BEFORE any fetchUser call finishes

  // Fix: use a for...of loop (awaits sequentially) or map + Promise.all
  for (const id of ids) { await fetchUser(id); }        // sequential
  await Promise.all(ids.map((id) => fetchUser(id)));    // parallel

Pitfall 3: An unhandled rejection because of a missing try/catch or .catch()
  async function risky() { await Promise.reject(new Error("boom")); }
  risky();  // no .catch() anywhere → "Uncaught (in promise) Error: boom"
            // in Node this can even crash the process in strict configs

Pitfall 4: Wrapping an already-async function's error handling redundantly
  async function loadUser(id) {
    try {
      return await fetch(`/api/users/${id}`); // the `await` here IS needed —
    } catch (err) {                            // without it, a rejected fetch
      console.error(err);                      // Promise would NOT be caught by
    }                                           // this try/catch; it would just
  }                                             // be returned as a rejected Promise
                                                 // that escapes this function uncaught.

Pitfall 5: Blocking parallelism by awaiting inside a loop unnecessarily
  let total = 0;
  for (const id of ids) {
    const order = await fetchOrder(id); // sequential — fine if you need order,
    total += order.amount;              // but if orders are independent, this
  }                                      // is slower than Promise.all + reduce
```

---

## 7. Hands-On Exercises

**Exercise 1:** Write an `async` function `getWeather(city)` that internally calls a mock `fetchWeatherData(city)` (a function you write that returns a Promise resolving with `{ city, tempC: 22 }` after a 500ms delay, and rejecting for the city name `"Atlantis"`). Call `getWeather` for three real cities and once for `"Atlantis"`, using `try`/`catch` to log either the temperature or a friendly error message for each.

**Exercise 2:** Take the Promise-chain version of `loadDashboard` from Section 4 and, without looking at the "AFTER" version, convert it to `async`/`await` yourself. Add a `finally` block that logs `"dashboard load attempt complete"` regardless of success or failure. Test it against a mock `fetchOrders` that rejects roughly 30% of the time (using `Math.random()`) and confirm your error handling and `finally` both behave correctly across several runs.

**Exercise 3:** Write two versions of a function that loads a user's profile, avatar image URL, and notification count — three independent mock async calls, each taking a different random delay between 200–800ms. Version A uses three sequential `await` calls. Version B uses `Promise.all`. Time both versions with `console.time`/`console.timeEnd` and confirm Version B is consistently faster, roughly matching the slowest individual call rather than the sum of all three.

**Exercise 4:** Reproduce Pitfall 2 from Section 6: write an array of 5 ids and a mock `async function processId(id)` that awaits a 300ms delay then logs the id. First call it with `.forEach(async (id) => { await processId(id); })` and observe that `"all done"` logs immediately, before any id has been processed. Then fix it using a `for...of` loop, and separately fix it using `Promise.all(ids.map(...))`, observing the different timing behavior of each fix.

**Exercise 5:** Deliberately trigger an unhandled Promise rejection: write an `async` function that awaits a rejecting Promise with no `try`/`catch`, and call it without a trailing `.catch()`. Run it in Node.js and observe the `UnhandledPromiseRejection` warning/error in the console. Then add `process.on('unhandledRejection', (reason) => { ... })` at the top of your script to globally catch and log any rejection that slips through uncaught, and re-run to confirm it's now handled gracefully.

---

## 8. Interview Q&A

**Q: Is async/await a completely different asynchronous mechanism from Promises, or is it built on top of them?**
Answer: `async`/`await` is syntactic sugar built entirely on top of Promises — it introduces no new asynchronous primitive. An `async` function always returns a Promise, wrapping whatever value you `return` (or rejecting with whatever you `throw`), and `await` only works on "thenables" — it suspends the `async` function until the given Promise settles, then either evaluates to the fulfilled value or throws the rejection reason. Under the hood, the JavaScript engine still relies on the same event loop, microtask queue, and Promise resolution mechanics described in Phase 5's event loop lesson; `async`/`await` just lets you write that logic in a linear, top-to-bottom style instead of chaining `.then()` calls, which makes multi-step asynchronous logic dramatically easier to read and debug.

**Q: How do you handle errors in an async function, and what's the difference between handling them inside the function versus at the call site?**
Answer: Inside an `async` function, a rejected `await` throws, so you wrap the awaited calls in an ordinary `try`/`catch` block just as you would for synchronous code, and can use `finally` for cleanup that must run regardless of outcome. Alternatively, since an `async` function's rejection is really just its returned Promise rejecting, you can skip internal error handling and instead attach a `.catch()` to the call site, or `await` the call inside another `async` function's own `try`/`catch`. The choice matters for where responsibility lives: handling internally means the function can recover and still return a normal value to its caller, while pushing it to the call site means every caller must remember to handle the rejection, and forgetting to do so anywhere in the call chain produces an unhandled rejection.

**Q: What's the performance difference between three sequential await calls and using Promise.all, and when is sequential actually correct?**
Answer: Three sequential `await` calls run one after another — each call only starts once the previous one has fully resolved — so the total time is roughly the sum of all three durations. Wrapping the same three calls in `Promise.all` starts them essentially simultaneously and resolves once the slowest one finishes, so the total time is roughly the duration of the single slowest call, not the sum. Sequential `await` is only actually necessary when a later call depends on data produced by an earlier one — for instance, you must `await` a user record before you can fetch that user's orders, because you need the user's `id`. When calls are independent of each other, awaiting them sequentially is a genuine performance bug, and the fix is to start all the Promises first (or use `Promise.all`) so they run concurrently.

**Q: What's wrong with using `.forEach()` with an async callback, and what should you use instead?**
Answer: `Array.prototype.forEach` does not know or care whether the callback it's given returns a Promise — it calls the callback for each element, ignores whatever it returns, and moves on immediately without waiting. If you pass an `async` callback to `forEach`, every iteration fires its async work essentially in parallel with no ordering guarantee, and any code written after the `forEach` call runs before any of those async operations complete, which surprises developers who expect `forEach` to behave like a sequential loop. The fix depends on intent: use a `for...of` loop with `await` inside it if you want the iterations to run one at a time in order, or use `array.map(item => asyncFn(item))` combined with `await Promise.all(...)` if the operations are independent and you want them to run concurrently while still being able to await their combined completion.

**Q: What happens if an async function's Promise rejects and nothing ever calls .catch() on it or awaits it inside a try/catch?**
Answer: The rejection becomes an "unhandled Promise rejection." In browsers, this fires a global `unhandledrejection` event and typically logs a console error like "Uncaught (in promise) Error: ...". In Node.js, it emits an `unhandledRejection` event on the `process` object, and depending on the Node version and configuration, can print a deprecation warning or, in modern Node defaults, terminate the process entirely, treating it similarly to an uncaught synchronous exception. This is why every entry point into async code — a top-level call to an `async` function, or a Promise chain — needs some form of rejection handling, whether that's a `.catch()` at the call site, a `try`/`catch` wrapping an `await`, or, as a last line of defense in Node, a global `process.on('unhandledRejection', handler)` listener to log or gracefully recover from anything that slipped through.
