# Mocking and Spies — Complete Guide

## Table of Contents
1. [Why Mock at All](#1-why-mock-at-all)
2. [jest.fn() — Standalone Mock Functions](#2-jestfn--standalone-mock-functions)
3. [jest.spyOn() — Spying on Existing Methods](#3-jestspyon--spying-on-existing-methods)
4. [jest.mock() — Mocking Entire Modules](#4-jestmock--mocking-entire-modules)
5. [Mocking a Database Call](#5-mocking-a-database-call)
6. [Dependency Injection for Testability](#6-dependency-injection-for-testability)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Mock at All

A **unit test** should test one unit of logic in isolation. If `OrderService.placeOrder()` calls a real database and a real payment gateway, you're no longer testing a unit — you're running a slow, flaky integration test that fails when the network hiccups, and you can't easily simulate a payment failure.

Mocking replaces a real dependency with a fake, controllable stand-in:

```
Real dependency:  OrderService → real DB → real network → real payment API
Mocked:           OrderService → fake DB (jest.fn()) → returns whatever you tell it to
```

This gives you three things a real dependency can't: **speed** (no network/disk I/O), **determinism** (same result every run), and **control** (trivially simulate errors, edge cases, and rare states).

---

## 2. jest.fn() — Standalone Mock Functions

`jest.fn()` creates a fake function that records how it was called and lets you control what it returns.

```javascript
test('jest.fn() basics', () => {
  const mockCallback = jest.fn();

  mockCallback('hello');
  mockCallback('world');

  expect(mockCallback).toHaveBeenCalled();
  expect(mockCallback).toHaveBeenCalledTimes(2);
  expect(mockCallback).toHaveBeenCalledWith('world');
  expect(mockCallback.mock.calls).toEqual([['hello'], ['world']]);
});

test('jest.fn() with a return value', () => {
  const add = jest.fn((a, b) => a + b);
  expect(add(2, 3)).toBe(5);
  expect(add).toHaveBeenCalledWith(2, 3);
});

test('jest.fn() controlling return values directly', () => {
  const getUser = jest.fn();
  getUser.mockReturnValue({ id: 1, name: 'Ada' });

  expect(getUser()).toEqual({ id: 1, name: 'Ada' });
});

test('jest.fn() with async return values', async () => {
  const fetchUser = jest.fn().mockResolvedValue({ id: 1, name: 'Ada' });
  const fetchUserFail = jest.fn().mockRejectedValue(new Error('not found'));

  await expect(fetchUser()).resolves.toEqual({ id: 1, name: 'Ada' });
  await expect(fetchUserFail()).rejects.toThrow('not found');
});

test('mockReturnValueOnce for sequential different results', () => {
  const roll = jest.fn();
  roll.mockReturnValueOnce(1).mockReturnValueOnce(6).mockReturnValue(3);

  expect(roll()).toBe(1);
  expect(roll()).toBe(6);
  expect(roll()).toBe(3); // falls back to the default after the "once" values are used
  expect(roll()).toBe(3);
});
```

---

## 3. jest.spyOn() — Spying on Existing Methods

`jest.spyOn(object, methodName)` wraps a real method so you can observe calls to it — and optionally replace its behavior — while still being able to restore the original.

```javascript
// mailer.js
const mailer = {
  send(to, subject) {
    // pretend this actually sends an email over SMTP
    console.log(`Sending "${subject}" to ${to}`);
    return true;
  },
};

module.exports = mailer;
```

```javascript
const mailer = require('./mailer');

describe('mailer spy', () => {
  afterEach(() => {
    jest.restoreAllMocks(); // undo spies after each test
  });

  it('records calls without changing behavior', () => {
    const spy = jest.spyOn(mailer, 'send');

    mailer.send('ada@example.com', 'Welcome');

    expect(spy).toHaveBeenCalledWith('ada@example.com', 'Welcome');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('can override behavior like jest.fn()', () => {
    const spy = jest.spyOn(mailer, 'send').mockReturnValue(false);

    const result = mailer.send('ada@example.com', 'Welcome');

    expect(result).toBe(false); // real implementation never ran
    expect(spy).toHaveBeenCalled();
  });

  it('can still call through to the real implementation', () => {
    const spy = jest.spyOn(mailer, 'send').mockImplementation((to, subject) => {
      // custom fake behavior, e.g., logging without sending
      return `mock-sent:${to}`;
    });

    expect(mailer.send('ada@example.com', 'Hi')).toBe('mock-sent:ada@example.com');
  });
});
```

`jest.fn()` vs `jest.spyOn()`:

| | `jest.fn()` | `jest.spyOn()` |
|---|---|---|
| Use when | You're creating a brand-new fake (e.g., a callback passed as an argument) | You want to observe/override a method on an existing object/module |
| Original implementation | Doesn't exist — you define it entirely | Preserved unless you call `.mockImplementation()`/`.mockReturnValue()` |
| Restoring | N/A (nothing to restore) | `spy.mockRestore()` or `jest.restoreAllMocks()` |

---

## 4. jest.mock() — Mocking Entire Modules

`jest.mock('module-path')` replaces every export of a module with auto-mocked (or manually defined) versions, for the entire test file.

```javascript
// emailNotifier.js
const nodemailer = require('nodemailer'); // hypothetical real email library

function notifyUser(transporter, to) {
  return transporter.sendMail({ to, subject: 'Notification' });
}

module.exports = { notifyUser };
```

```javascript
// __mocks__/nodemailer.js  (manual mock, auto-used by Jest when jest.mock('nodemailer') is called)
module.exports = {
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
  })),
};
```

```javascript
// emailNotifier.test.js
jest.mock('nodemailer'); // hoisted to the top of the file automatically by Jest

const nodemailer = require('nodemailer');
const { notifyUser } = require('./emailNotifier');

it('sends a notification email', async () => {
  const transporter = nodemailer.createTransport();
  const result = await notifyUser(transporter, 'ada@example.com');

  expect(result).toEqual({ messageId: 'mock-id' });
});
```

For local project modules (not third-party packages), you often don't need a `__mocks__` folder — a factory function passed directly to `jest.mock()` is simpler:

```javascript
// paymentService.js
function charge(amount) {
  // real implementation calls a payment gateway
}
module.exports = { charge };
```

```javascript
jest.mock('./paymentService', () => ({
  charge: jest.fn().mockResolvedValue({ success: true, transactionId: 'tx_123' }),
}));

const paymentService = require('./paymentService');

it('uses the mocked payment service', async () => {
  const result = await paymentService.charge(1000);
  expect(result.success).toBe(true);
});
```

---

## 5. Mocking a Database Call

This is the pattern you'll use constantly when unit-testing Express controllers/services: replace the real DB layer with a mock so tests don't need a real database connection.

```javascript
// userRepository.js — the real DB layer (e.g., using a MongoDB driver or an ORM)
const db = require('./db'); // hypothetical DB connection module

async function findUserById(id) {
  return db.collection('users').findOne({ id });
}

module.exports = { findUserById };
```

```javascript
// userController.js — the unit under test
const userRepository = require('./userRepository');

async function getUserHandler(req, res) {
  const user = await userRepository.findUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.status(200).json(user);
}

module.exports = { getUserHandler };
```

```javascript
// userController.test.js
jest.mock('./userRepository');

const userRepository = require('./userRepository');
const { getUserHandler } = require('./userController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('getUserHandler()', () => {
  afterEach(() => {
    jest.clearAllMocks(); // reset call history between tests, keeps the mock impl
  });

  it('returns 200 and the user when found', async () => {
    userRepository.findUserById.mockResolvedValue({ id: '1', name: 'Ada' });
    const req = { params: { id: '1' } };
    const res = mockRes();

    await getUserHandler(req, res);

    expect(userRepository.findUserById).toHaveBeenCalledWith('1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ id: '1', name: 'Ada' });
  });

  it('returns 404 when the user is not found', async () => {
    userRepository.findUserById.mockResolvedValue(null);
    const req = { params: { id: '999' } };
    const res = mockRes();

    await getUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });
});
```

No real database, no network — this test suite runs in milliseconds and covers both the happy path and the not-found path deterministically. `jest.clearAllMocks()` in `afterEach` prevents one test's `mockResolvedValue` from leaking into the next.

---

## 6. Dependency Injection for Testability

The mocking above required `jest.mock()` to intercept a `require()`. An alternative — often cleaner — is **dependency injection**: pass dependencies into a function/class explicitly instead of importing them directly, so tests can substitute fakes with zero mocking magic.

```javascript
// Without DI — hard to test, requires jest.mock()
const userRepository = require('./userRepository');
async function getUserHandler(req, res) {
  const user = await userRepository.findUserById(req.params.id);
  // ...
}

// With DI — the dependency is a parameter, tests just pass a plain object
async function getUserHandler(req, res, { userRepository }) {
  const user = await userRepository.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.status(200).json(user);
}

module.exports = { getUserHandler };
```

```javascript
// userController.test.js — no jest.mock() needed at all
const { getUserHandler } = require('./userController');

it('returns the user when found (via DI, no jest.mock needed)', async () => {
  const fakeRepo = { findUserById: jest.fn().mockResolvedValue({ id: '1', name: 'Ada' }) };
  const req = { params: { id: '1' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await getUserHandler(req, res, { userRepository: fakeRepo });

  expect(res.status).toHaveBeenCalledWith(200);
});
```

In a real Express app this usually takes the shape of a small factory that wires dependencies once at startup and injects them into routes/controllers/services:

```javascript
// app.js (simplified)
function createApp({ userRepository }) {
  const app = express();
  app.get('/users/:id', (req, res) => getUserHandler(req, res, { userRepository }));
  return app;
}

module.exports = { createApp };

// In production: createApp({ userRepository: realUserRepository })
// In tests:       createApp({ userRepository: fakeUserRepository })
```

`jest.mock()` and dependency injection solve the same problem from different angles: `jest.mock()` intercepts what a module imports; DI avoids the need for interception by making dependencies explicit inputs. DI tends to produce simpler, more explicit tests and is generally preferred for new code, but `jest.mock()` is essential for testing code you can't easily refactor (including third-party libraries).

---

## 7. Hands-On Exercises

**Exercise 1:** Write a `logger.js` module with a `log(message)` method that calls `console.log`. Use `jest.spyOn(console, 'log')` to test that calling `logger.log('hi')` results in `console.log` being called with `'hi'`, without actually printing to the terminal (hint: `mockImplementation(() => {})`).

**Exercise 2:** Write a `ProductRepository` module with `findById`, `save`, and `delete` methods that would normally hit a real database. Write a `ProductService.deleteProduct(id)` function that calls `repository.findById` first and throws `'Product not found'` if it returns null, otherwise calls `repository.delete`. Test both branches using `jest.mock()`.

**Exercise 3:** Take the DI-based `getUserHandler` example and add a second dependency, `logger`, that must be called with `'User not found'` whenever the 404 branch executes. Write a test asserting the fake logger was called correctly.

**Exercise 4:** Using `jest.fn()`, write a test for a `retry(fn, times)` helper where `fn` fails twice then succeeds on the third call using `mockRejectedValueOnce` chained twice, followed by `mockResolvedValue`.

**Exercise 5:** Convert one of your Phase 06 database repository modules (or write a small new one) to use dependency injection for its DB client, and write a unit test for it with a fake in-memory client instead of a real database.

---

## 8. Interview Q&A

**Q: What's the difference between `jest.fn()` and `jest.spyOn()`?**
Answer: `jest.fn()` creates a brand-new mock function from scratch — there's no "real" implementation involved. `jest.spyOn(obj, 'method')` wraps an existing method on a real object, preserving the original implementation by default (you can still call `.mockImplementation()`/`.mockReturnValue()` to override it) and letting you restore the original later with `mockRestore()`. Use `jest.fn()` for fresh fakes (like a callback argument); use `spyOn` when you need to observe or override a method that already exists.

**Q: What does `jest.mock('./module')` actually do, and where does it run relative to your imports?**
Answer: It tells Jest to replace every export of that module with automatic (or manually provided) mock functions for the rest of the test file. Jest hoists `jest.mock()` calls to the top of the file, above `require`/`import` statements, specifically so that when the real module is required elsewhere in the file (including inside the module under test), it receives the mocked version instead of the real one.

**Q: Why would you mock a database call instead of testing against a real test database?**
Answer: Mocking the DB layer keeps unit tests fast (no I/O), deterministic (no dependency on data state or a running DB process), and able to simulate edge cases that are hard to reproduce with a real DB (like a connection timeout or a malformed record). Real-database tests still have value — but as integration tests, run less frequently, against a dedicated test database, not as part of the fast unit test suite that runs on every save.

**Q: What is dependency injection and how does it improve testability?**
Answer: Dependency injection means a function/class receives its dependencies as parameters (or via a constructor) rather than importing/creating them internally. This lets tests substitute a real dependency with a lightweight fake by simply passing a different argument — no module-mocking machinery required — which makes tests more explicit, easier to read, and decoupled from Jest-specific APIs like `jest.mock()`.

**Q: What's the danger of not resetting mocks between tests, and how do you fix it?**
Answer: Mock functions retain call history and configured return values (`mockResolvedValue`, etc.) across tests by default, so a return value or call count set in one test can silently leak into and corrupt the next test, causing confusing failures or false passes. Fix it with `jest.clearAllMocks()` (clears call history) or `jest.resetAllMocks()` (also clears implementations) in an `afterEach`/`beforeEach`, or configure `clearMocks: true` in `jest.config.js` to do it automatically for every test.

**Q: If you spy on a method with `jest.spyOn()` but never call `mockRestore()`, what happens?**
Answer: The spy's override (if you set one via `mockImplementation`/`mockReturnValue`) persists on that object beyond the current test, potentially affecting other tests that use the same object/module — especially dangerous with singletons or shared modules. Always call `jest.restoreAllMocks()` in an `afterEach`, or configure `restoreMocks: true` in `jest.config.js`, so every test starts from the real, unmodified implementation.
