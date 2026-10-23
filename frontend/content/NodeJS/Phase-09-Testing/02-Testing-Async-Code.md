# Testing Async Code — Complete Guide

## Table of Contents
1. [Why Async Tests Need Special Handling](#1-why-async-tests-need-special-handling)
2. [Testing Promises](#2-testing-promises)
3. [Testing async/await Code](#3-testing-asyncawait-code)
4. [Testing Rejected Promises](#4-testing-rejected-promises)
5. [The done Callback (Legacy Callback-Style Code)](#5-the-done-callback-legacy-callback-style-code)
6. [Mocking Timers](#6-mocking-timers)
7. [Complete Example: An Async Order Service](#7-complete-example-an-async-order-service)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Async Tests Need Special Handling

If a test function returns before an async operation resolves, Jest marks the test as **passed** even if the assertion inside the promise never ran or would have failed. This is the single most common way async tests silently lie.

```javascript
// WRONG — this test always passes, even if fetchUser is broken
it('fetches a user', () => {
  fetchUser(1).then(user => {
    expect(user.name).toBe('Ada'); // this assertion may never even execute
  });
  // test function returns immediately here — Jest doesn't wait
});
```

Jest needs to know the test isn't done until the async work finishes. There are three correct patterns: **return the promise**, **use `async/await`**, or **use the `done` callback** (legacy).

---

## 2. Testing Promises

**Return the promise** — Jest waits for it before marking the test complete:

```javascript
// userService.js
function fetchUser(id) {
  if (id === 1) return Promise.resolve({ id: 1, name: 'Ada' });
  return Promise.reject(new Error('User not found'));
}

module.exports = { fetchUser };
```

```javascript
// userService.test.js
const { fetchUser } = require('./userService');

it('fetches a user (returning the promise)', () => {
  return fetchUser(1).then(user => {
    expect(user.name).toBe('Ada');
  });
});

// Jest also supports resolves/rejects matchers directly:
it('fetches a user (using .resolves)', () => {
  return expect(fetchUser(1)).resolves.toEqual({ id: 1, name: 'Ada' });
});
```

The key rule: **always `return` (or `await`) a promise inside a test** — never fire-and-forget it.

---

## 3. Testing async/await Code

`async/await` is the cleanest style — it reads like synchronous code and Jest naturally awaits it because the test function itself becomes a promise.

```javascript
it('fetches a user (async/await)', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Ada');
});
```

You can mix multiple awaited calls and assertions freely, exactly like a normal async function:

```javascript
it('fetches then transforms a user', async () => {
  const user = await fetchUser(1);
  const greeting = `Hello, ${user.name}!`;
  expect(greeting).toBe('Hello, Ada!');
});
```

---

## 4. Testing Rejected Promises

Three correct ways to assert that a promise rejects — get this wrong and, like above, the test can pass even when the code never throws.

```javascript
// Option 1: expect().rejects (cleanest, recommended)
it('rejects for an unknown user', () => {
  return expect(fetchUser(999)).rejects.toThrow('User not found');
});

// Option 2: async/await with try/catch + expect.assertions
it('rejects for an unknown user (try/catch)', async () => {
  expect.assertions(1); // guarantees the catch block actually ran
  try {
    await fetchUser(999);
  } catch (err) {
    expect(err.message).toBe('User not found');
  }
});

// Option 3: async/await + expect().rejects, awaited
it('rejects for an unknown user (awaited)', async () => {
  await expect(fetchUser(999)).rejects.toThrow('User not found');
});
```

`expect.assertions(n)` is important in the try/catch style: without it, a test where the promise unexpectedly *resolves* (bug in your code) would skip the `catch` block entirely and pass with zero assertions run — a false positive. `expect.assertions(1)` fails the test if exactly one assertion doesn't execute.

---

## 5. The done Callback (Legacy Callback-Style Code)

For code that uses Node-style callbacks instead of promises, Jest supports a `done` parameter:

```javascript
// legacyLoader.js
function loadConfig(callback) {
  setTimeout(() => {
    callback(null, { env: 'test' });
  }, 10);
}

module.exports = { loadConfig };
```

```javascript
const { loadConfig } = require('./legacyLoader');

it('loads config via callback', done => {
  loadConfig((err, config) => {
    expect(err).toBeNull();
    expect(config.env).toBe('test');
    done(); // tells Jest the test is finished
  });
});
```

If `done()` is never called, the test times out (default 5s) and fails — that timeout is itself a useful safety net for code that never calls its callback. Prefer promisifying legacy callback APIs (via `util.promisify`) and using `async/await` wherever possible; reach for `done` only when you're stuck with raw callback APIs.

---

## 6. Mocking Timers

Real `setTimeout`/`setInterval` delays make test suites slow and flaky. Jest's fake timers let you control time itself.

```javascript
// reminder.js
function scheduleReminder(callback, delayMs) {
  setTimeout(callback, delayMs);
}

module.exports = { scheduleReminder };
```

```javascript
const { scheduleReminder } = require('./reminder');

describe('scheduleReminder()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls the callback after the delay, instantly in test time', () => {
    const callback = jest.fn();

    scheduleReminder(callback, 5000);

    expect(callback).not.toHaveBeenCalled(); // hasn't fired yet

    jest.advanceTimersByTime(5000); // fast-forward 5 real seconds instantly

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not fire early', () => {
    const callback = jest.fn();
    scheduleReminder(callback, 5000);

    jest.advanceTimersByTime(4999);
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
```

`jest.runAllTimers()` fires every pending timer immediately (careful with `setInterval` — it can loop forever). `jest.advanceTimersByTime(ms)` is the safer, more explicit choice for most tests.

---

## 7. Complete Example: An Async Order Service

A realistic async module — placing an order involves an async inventory check and an async payment charge, both of which can fail.

```javascript
// orderService.js
async function placeOrder({ productId, quantity }, { inventory, payments }) {
  const inStock = await inventory.checkStock(productId, quantity);
  if (!inStock) {
    throw new Error('Insufficient stock');
  }

  const charge = await payments.charge(productId, quantity);
  if (!charge.success) {
    throw new Error('Payment failed');
  }

  return { orderId: charge.transactionId, status: 'confirmed' };
}

module.exports = { placeOrder };
```

```javascript
// orderService.test.js
const { placeOrder } = require('./orderService');

describe('placeOrder()', () => {
  it('confirms the order when stock and payment succeed', async () => {
    const inventory = { checkStock: jest.fn().mockResolvedValue(true) };
    const payments = {
      charge: jest.fn().mockResolvedValue({ success: true, transactionId: 'tx_1' }),
    };

    const result = await placeOrder({ productId: 'p1', quantity: 2 }, { inventory, payments });

    expect(result).toEqual({ orderId: 'tx_1', status: 'confirmed' });
    expect(inventory.checkStock).toHaveBeenCalledWith('p1', 2);
    expect(payments.charge).toHaveBeenCalledWith('p1', 2);
  });

  it('rejects when stock is insufficient', async () => {
    const inventory = { checkStock: jest.fn().mockResolvedValue(false) };
    const payments = { charge: jest.fn() };

    await expect(
      placeOrder({ productId: 'p1', quantity: 2 }, { inventory, payments })
    ).rejects.toThrow('Insufficient stock');

    expect(payments.charge).not.toHaveBeenCalled(); // short-circuited before charging
  });

  it('rejects when payment fails', async () => {
    const inventory = { checkStock: jest.fn().mockResolvedValue(true) };
    const payments = { charge: jest.fn().mockResolvedValue({ success: false }) };

    await expect(
      placeOrder({ productId: 'p1', quantity: 2 }, { inventory, payments })
    ).rejects.toThrow('Payment failed');
  });
});
```

This example previews Phase 09's next lesson (mocking) — `inventory` and `payments` are passed in as dependencies rather than imported directly, which is exactly what makes them trivial to fake here.

---

## 8. Hands-On Exercises

**Exercise 1:** Write a `delay(ms)` function that returns a promise resolving after `ms` milliseconds. Test it using fake timers, asserting it hasn't resolved before the delay and has resolved after `jest.advanceTimersByTime`.

**Exercise 2:** Write an async function `fetchWithRetry(fn, retries)` that calls `fn()` and retries up to `retries` times if it rejects, then rejects with the last error if all retries fail. Test both the success-after-one-retry case and the all-retries-fail case.

**Exercise 3:** Take the `fetchUser` example and write a test using all three rejection-testing styles (`.rejects`, try/catch with `expect.assertions`, awaited `.rejects`) for the same scenario — confirm they produce identical pass/fail results.

**Exercise 4:** Write a test for a promise-returning function using the WRONG pattern (fire-and-forget, no `return`/`await`) with an assertion that would fail if it ran. Confirm the test passes anyway, then fix it.

**Exercise 5:** Write an async function `debounceAsync(fn, delayMs)` and test it with fake timers, verifying that calling it multiple times within `delayMs` only results in one actual call to `fn`.

---

## 9. Interview Q&A

**Q: What happens if you don't return or await a promise inside a Jest test?**
Answer: Jest's test function completes synchronously, so the test is marked as passed before the promise resolves or rejects — any assertions inside the `.then()`/`.catch()` callback run after Jest has already recorded the result, so a failing assertion there is silently swallowed. You must `return` the promise, `await` it in an `async` test function, or use `done()`.

**Q: What's the difference between `expect(promise).resolves.toBe(x)` and `await promise; expect(result).toBe(x)`?**
Answer: They're functionally equivalent — `.resolves` unwraps a promise's resolved value before applying the matcher, and internally still needs to be `return`ed or `await`ed itself since it produces a promise. `await promise` is more explicit and reads more naturally when you need the value for multiple assertions or intermediate logic; `.resolves`/`.rejects` are more concise for a single assertion.

**Q: Why use `expect.assertions(n)` when testing a rejected promise with try/catch?**
Answer: Without it, if the code has a bug and the promise unexpectedly resolves instead of rejecting, the `catch` block is skipped entirely, no assertion runs, and the test passes with a false sense of safety. `expect.assertions(n)` tells Jest to fail the test if exactly `n` assertions were not called during that test, catching this class of false positive.

**Q: How do fake timers help with testing code that uses setTimeout/setInterval?**
Answer: `jest.useFakeTimers()` replaces the real timer functions with mock implementations that don't actually wait in real time. `jest.advanceTimersByTime(ms)` synchronously fires any timers scheduled within that window, letting you test a 5-second delay in milliseconds of real test-runtime instead of actually waiting 5 seconds — making the suite both fast and deterministic.

**Q: When would you still use the `done` callback instead of async/await in a Jest test?**
Answer: When testing code built on raw Node-style callbacks (error-first callback APIs, event emitters, or third-party libraries that don't return promises) where converting to `async/await` isn't practical. In new code, prefer promisifying the callback API (`util.promisify`) and using `async/await`, since `done`-based tests are easier to get wrong (e.g., forgetting to call `done()` on an error path, causing a timeout instead of a clear failure).

**Q: If an async test throws an error that isn't caught, what does Jest report?**
Answer: An unhandled rejection or thrown error inside an `async` test function causes that test's returned promise to reject, and Jest reports it as a failing test with the error's message and stack trace — the same as a failed `expect()`. This is why wrapping the whole body in `async () => { ... }` and letting errors propagate (instead of swallowing them) is usually correct: it converts an unexpected failure into a visible, clearly diagnosed test failure.
