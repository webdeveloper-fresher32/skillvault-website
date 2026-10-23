# 01 — Jest Fundamentals

> "A test you didn't write is a bug you haven't found yet."

---

## Table of Contents

1. [The Problem: Manual Testing Doesn't Scale](#1-the-problem-manual-testing-doesnt-scale)
2. [What Jest Actually Is](#2-what-jest-actually-is)
   - 2.1 [Jest vs. Vitest](#21-jest-vs-vitest)
3. [Anatomy of a Test File](#3-anatomy-of-a-test-file)
   - 3.1 [describe()](#31-describe)
   - 3.2 [test() / it()](#32-test--it)
   - 3.3 [expect() and Matchers](#33-expect-and-matchers)
4. [How a Test Run Actually Works](#4-how-a-test-run-actually-works)
5. [A Complete, Concrete Example](#5-a-complete-concrete-example)
6. [Setup and Teardown: beforeEach, afterEach, beforeAll, afterAll](#6-setup-and-teardown-beforeeach-aftereach-beforeall-afterall)
7. [Test Isolation as a Principle](#7-test-isolation-as-a-principle)
8. [toBe vs toEqual vs toStrictEqual](#8-tobe-vs-toequal-vs-tostrictequal)
9. [Mocking Basics: jest.fn()](#9-mocking-basics-jestfn)
10. [Common Mistakes](#10-common-mistakes)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The Problem: Manual Testing Doesn't Scale

Picture this. You've built a `calculateDiscount()` function. It works. You click through the app, add an item to a cart, apply a coupon, and — yep, the discount shows up correctly. Ship it.

Two weeks later, someone asks you to add support for "buy 2 get 1 free" promotions. You touch the same file. Does your original 10%-off logic still work? You don't actually know — so you go back, click through the app again, add an item, apply the old coupon, check the number.

Now imagine that same function is used in 15 different places across the app: the cart page, the checkout summary, the invoice PDF, the admin dashboard, the email receipt. Every single change to that function means manually re-checking all 15 places, by hand, every time. Forever.

This is where manual regression testing quietly turns into the biggest bottleneck in a codebase. Nobody enjoys clicking through the same 15 screens after every change, so — realistically — people start skipping it. That's exactly when the shipped bug happens.

**The core problem in one sentence:** as an application grows, verifying "did I just break something that used to work?" by hand becomes slower than writing new features, and eventually people stop doing it.

Automated tests exist to solve exactly this. Instead of a human clicking around, you write code that clicks around for you — and that code can run in milliseconds, as many times as you want, forever, without ever getting bored or careless.

---

### The pilot's checklist analogy

Think about an airline pilot before takeoff. Every single flight — even the pilot's 10,000th flight — they run through the exact same pre-flight checklist. Fuel levels. Flaps. Instruments. Doors. Every time, no exceptions, even though "it worked fine yesterday."

Why bother, if it always passes? Because the one time something *is* wrong, the checklist is what catches it — before 200 passengers are in the air. The pilot doesn't trust memory ("I'm sure the flaps are fine, they were fine last time"). They trust a repeatable, mechanical process that doesn't get complacent.

An automated test suite is your pre-flight checklist for code. You don't run it because you expect it to fail — you run it because the one time it *does* fail, that's the bug you just avoided shipping to production.

---

## 2. What Jest Actually Is

**Basic definition:** Jest is a JavaScript testing framework — and it bundles together three things you'd otherwise need three separate tools for:

1. **A test runner** — finds your test files, executes them, and reports pass/fail.
2. **An assertion library** — gives you `expect(value).toBe(otherValue)`-style checks.
3. **A mocking framework** — lets you fake functions, modules, and timers so you can test code in isolation.

Most testing tools historically made you glue these three together yourself (say, Mocha for running + Chai for assertions + Sinon for mocking). Jest's pitch from day one was: "here's all three, pre-wired, zero config to get started."

Because of that, a brand-new project can usually run `npm install --save-dev jest`, write one `.test.js` file, run `npx jest`, and immediately see results. No configuration file required to get going.

---

### 2.1 Jest vs. Vitest

You'll increasingly see **Vitest** mentioned alongside Jest, especially in newer projects. Here's the honest picture:

- **Jest** was built by Facebook/Meta, is battle-tested across a massive number of production codebases, and is still the default choice for most existing React and Node projects (especially anything using Create React App or a typical Node backend).
- **Vitest** is built specifically for projects using **Vite** as their build tool. If your project already uses Vite (very common in modern React + TypeScript setups), Vitest reuses Vite's config and transform pipeline, so tests start up and run noticeably faster — no separate Babel/webpack transform step to configure.
- The good news: Vitest deliberately mirrors Jest's API. `describe`, `test`/`it`, `expect`, `beforeEach`, `jest.fn()` (aliased as `vi.fn()`) — almost everything in this lesson applies to both, often letter-for-letter.

**Practical takeaway:** learn Jest's API deeply — that knowledge transfers almost directly to Vitest. If you're starting a brand-new Vite-based React project today, Vitest is a very reasonable, increasingly popular default. If you're joining an existing project, you use whichever one is already there.

---

## 3. Anatomy of a Test File

Before diving into a full example, let's name the three building blocks you'll see in literally every Jest test file.

### 3.1 describe()

`describe()` groups related tests together under a label. It doesn't run any assertions itself — it's purely organizational, like a folder for your tests.

```js
describe("calculateDiscount", () => {
  // tests about calculateDiscount go here
});
```

You can nest `describe` blocks too, to group things further (e.g., a `describe` for "when the user is a new customer" inside a bigger `describe` for the whole function).

### 3.2 test() / it()

`test()` (and its alias `it()` — they're identical, `it()` just reads more like a sentence: "it should return zero for an empty cart") is a single, individual test case.

```js
test("returns 0 when the cart is empty", () => {
  // the actual check goes here
});
```

```js
it("returns 0 when the cart is empty", () => {
  // exactly the same thing as above
});
```

Pick one style and stay consistent across your codebase — there's no functional difference.

### 3.3 expect() and Matchers

`expect()` wraps a value you want to check, and you chain a **matcher** onto it to describe what you expect to be true about that value.

```js
expect(2 + 2).toBe(4);
expect([1, 2, 3]).toContain(2);
expect("hello world").toMatch(/world/);
expect(someArray).toHaveLength(3);
```

Some of the most common matchers:

| Matcher | What it checks |
|---|---|
| `toBe(x)` | Exact same value (primitives) or exact same object reference |
| `toEqual(x)` | Same *value*, recursively — for objects/arrays |
| `toContain(x)` | Array/string contains `x` |
| `toBeTruthy()` / `toBeFalsy()` | Value is truthy/falsy in a boolean context |
| `toBeNull()` | Value is exactly `null` |
| `toBeUndefined()` | Value is exactly `undefined` |
| `toBeGreaterThan(x)` | Numeric comparison |
| `toThrow()` | Function throws when called |
| `toHaveLength(n)` | Array or string has length `n` |

We're going to spend an entire dedicated section (Section 8) on `toBe` vs `toEqual`, because mixing them up is one of the single most common Jest mistakes — and it doesn't throw a syntax error, it just quietly fails (or, worse, quietly passes when it shouldn't).

---

## 4. How a Test Run Actually Works

It helps to have a mental picture of what actually happens, step by step, when you run `npx jest`.

```text
┌───────────────────────────────────────────────────────────────────┐
│                     Jest Test Run — Step by Step                  │
│                                                                     │
│  1. Jest scans your project for test files                        │
│     (anything matching *.test.js, *.spec.js, or in a __tests__/)  │
│                                                                     │
│  2. For each test file, Jest loads it and finds all describe()    │
│     blocks — these just group tests, nothing runs yet             │
│                                                                     │
│  3. For each test() inside a describe():                          │
│        a. beforeEach() runs (if defined) — fresh setup            │
│        b. the test's own function body runs                       │
│        c. every expect() inside either PASSES or FAILS             │
│        d. afterEach() runs (if defined) — cleanup                  │
│        e. this test's result (pass/fail) is recorded independently │
│                                                                     │
│  4. Step 3 repeats for every test — each one gets its own fresh    │
│     beforeEach/afterEach cycle, so tests don't share leftover state│
│                                                                     │
│  5. Once every test file finishes, Jest prints a summary:          │
│     X passed, Y failed, Z total — plus details for any failures   │
└───────────────────────────────────────────────────────────────────┘
```

The single most important detail in that diagram: **step 3 repeats independently for every test.** Each `test()` gets its own clean `beforeEach` run. Test B never "sees" whatever test A left behind. That's what makes automated tests trustworthy — a failure in test B is actually about test B, not some leftover mess from test A.

---

## 5. A Complete, Concrete Example

Let's ground all of this in one real example: testing a small, pure `calculateDiscount` function.

**The function under test** (`discount.js`):

```js
// discount.js
function calculateDiscount(cartTotal, couponCode) {
  if (cartTotal <= 0) return 0;

  if (couponCode === "SAVE10") {
    return cartTotal * 0.1;
  }

  if (couponCode === "SAVE20") {
    return cartTotal * 0.2;
  }

  return 0;
}

module.exports = { calculateDiscount };
```

**The test file** (`discount.test.js`):

```js
// discount.test.js
const { calculateDiscount } = require("./discount");

describe("calculateDiscount", () => {
  test("returns 0 for an empty or zero cart total", () => {
    expect(calculateDiscount(0, "SAVE10")).toBe(0);
  });

  test("returns 0 when no coupon code is given", () => {
    expect(calculateDiscount(100, undefined)).toBe(0);
  });

  test("applies a 10% discount for SAVE10", () => {
    expect(calculateDiscount(100, "SAVE10")).toBe(10);
  });

  test("applies a 20% discount for SAVE20", () => {
    expect(calculateDiscount(200, "SAVE20")).toBe(40);
  });

  test("ignores unknown coupon codes", () => {
    expect(calculateDiscount(100, "NOT_A_REAL_CODE")).toBe(0);
  });
});
```

Run it:

```bash
npx jest discount.test.js
```

And you'd see output roughly like this:

```text
 PASS  ./discount.test.js
  calculateDiscount
    ✓ returns 0 for an empty or zero cart total
    ✓ returns 0 when no coupon code is given
    ✓ applies a 10% discount for SAVE10
    ✓ applies a 20% discount for SAVE20
    ✓ ignores unknown coupon codes

Tests:       5 passed, 5 total
```

Five tests, five independent checks, run in milliseconds. Now if you go add "buy 2 get 1 free" logic to `calculateDiscount` and accidentally break the `SAVE10` case, this same file — the one you already wrote — tells you immediately. No manual click-through required.

---

## 6. Setup and Teardown: beforeEach, afterEach, beforeAll, afterAll

Real tests often need some setup before they run — a fresh object to test against, a mock database connection, a reset counter. Writing that setup code inside every single `test()` gets repetitive fast. That's what these four hooks solve.

```js
describe("ShoppingCart", () => {
  let cart;

  beforeEach(() => {
    // runs before EVERY test in this describe block
    cart = new ShoppingCart();
  });

  afterEach(() => {
    // runs after EVERY test in this describe block
    cart.clearLogs();
  });

  beforeAll(() => {
    // runs ONCE, before any test in this describe block starts
    connectToTestDatabase();
  });

  afterAll(() => {
    // runs ONCE, after all tests in this describe block finish
    disconnectFromTestDatabase();
  });

  test("starts empty", () => {
    expect(cart.items).toHaveLength(0);
  });

  test("adds an item", () => {
    cart.add({ name: "Book", price: 12 });
    expect(cart.items).toHaveLength(1);
  });
});
```

**Why these four exist, in plain terms:**

- `beforeEach` / `afterEach` — run around *every single test*. Use these for anything that needs to be fresh for each test, like our `cart` object above. If test 1 adds an item to the cart, `beforeEach` guarantees test 2 still starts with a brand-new, empty cart — not the one test 1 left behind.
- `beforeAll` / `afterAll` — run *once* for the whole `describe` block. Use these for expensive setup that's safe to share, like opening a database connection or spinning up a test server. You wouldn't want to reconnect to a database before every single test — that's wasteful when the connection itself can safely be reused.

**The rule of thumb:** if the state needs to be fresh per-test (so tests don't affect each other), it belongs in `beforeEach`. If it's expensive and safe to share across the whole group, it belongs in `beforeAll`.

---

## 7. Test Isolation as a Principle

This deserves its own section because it's genuinely one of the most important ideas in testing, not just a Jest detail.

**Test isolation means:** one test's actions must never leak into, or affect the outcome of, another test.

Here's what a violation of this principle looks like:

```js
// BAD — tests depend on shared, mutating state
let cart = new ShoppingCart();

test("adds an item", () => {
  cart.add({ name: "Book", price: 12 });
  expect(cart.items).toHaveLength(1);
});

test("cart starts empty", () => {
  // this test SILENTLY DEPENDS on running before the test above
  expect(cart.items).toHaveLength(0); // FAILS if run second — cart already has 1 item!
});
```

Run these tests in the order they're written, and both might pass — pure luck. Reorder them (or let Jest run them in parallel, or a future teammate adds a new test in between), and the second one fails for a reason that has nothing to do with the code being broken. The *test order* became a hidden dependency. That's a huge red flag: your tests are supposed to prove your code is correct, not secretly test "did these run in the right sequence."

**The fix is exactly what Section 6 gave you:**

```js
// GOOD — fresh cart for every single test
describe("ShoppingCart", () => {
  let cart;

  beforeEach(() => {
    cart = new ShoppingCart(); // brand-new instance, every test, guaranteed
  });

  test("adds an item", () => {
    cart.add({ name: "Book", price: 12 });
    expect(cart.items).toHaveLength(1);
  });

  test("cart starts empty", () => {
    expect(cart.items).toHaveLength(0); // always true now, no matter the order
  });
});
```

Now each test gets its own untouched `cart`. Run them in any order, run them in parallel, add ten more tests in between — none of it matters. Each test proves one thing about the code, and nothing else.

**Why this matters beyond "clean code":** Jest doesn't guarantee your tests run in file-declaration order across suites, and CI systems often run test files in parallel across multiple workers for speed. A test suite that secretly depends on execution order is a ticking time bomb — it might pass for months and then mysteriously start failing the day someone reorders a file or upgrades Jest.

> **Memory hook:** "Every test should start the story fresh — no test should ever get to read yesterday's diary."

---

## 8. toBe vs toEqual vs toStrictEqual

This is, hands down, one of the most commonly misunderstood parts of Jest — and one of the most commonly asked interview questions. Let's slow all the way down.

### The trap, in one line

```js
expect({ name: "John" }).toBe({ name: "John" }); // FAILS!
```

Wait — those look identical. Why does this fail?

### The reason: toBe checks *reference identity*, not value

`toBe()` uses `Object.is()` under the hood — essentially the same as JavaScript's `===`. For primitives (numbers, strings, booleans), that's exactly what you want:

```js
expect(2 + 2).toBe(4);          // PASS — same primitive value
expect("a" + "b").toBe("ab");   // PASS — same primitive value
```

But for objects and arrays, `===` (and therefore `toBe`) checks whether they're the **exact same object in memory** — not whether they *look* the same.

```js
const a = { name: "John" };
const b = { name: "John" };

console.log(a === b); // false — two different objects, even though they look identical!

expect(a).toBe(b); // FAILS — same reason as above
expect(a).toBe(a); // PASSES — literally the same object in memory
```

`a` and `b` are two separate objects sitting in two separate places in memory. They happen to contain the same data, but `toBe`/`===` doesn't care about the data — it cares whether it's literally the same object reference.

### The fix: toEqual checks *value equality*, recursively

```js
expect({ name: "John" }).toEqual({ name: "John" }); // PASSES
```

`toEqual()` walks into the object (or array), field by field, and checks that the *values* match — regardless of whether they're the same object in memory. This is what you want almost every time you're comparing objects or arrays in a test.

```js
expect([1, 2, 3]).toEqual([1, 2, 3]);              // PASSES
expect({ a: 1, b: { c: 2 } }).toEqual({ a: 1, b: { c: 2 } }); // PASSES, even nested
```

### So what's toStrictEqual for?

`toStrictEqual()` does everything `toEqual()` does, plus two extra, stricter checks:

1. It cares about `undefined` properties — `toEqual` treats `{ a: 1, b: undefined }` the same as `{ a: 1 }`; `toStrictEqual` does **not** — it considers them different.
2. It cares about the object's actual class/constructor — a plain object `{}` is not strictly equal to an instance of a custom class with the same fields, even if `toEqual` would call them equal.

```js
expect({ a: 1, b: undefined }).toEqual({ a: 1 });       // PASSES — toEqual ignores undefined props
expect({ a: 1, b: undefined }).toStrictEqual({ a: 1 }); // FAILS — toStrictEqual is pickier
```

### Comparison table

| Matcher | What it actually compares | Use it for |
|---|---|---|
| `toBe` | Reference identity for objects/arrays (`Object.is`); exact value for primitives | Numbers, strings, booleans, `null`/`undefined`; or intentionally checking "is this the *same* object instance" |
| `toEqual` | Deep, recursive value equality — ignores `undefined` properties and doesn't check class type | Comparing objects and arrays where you care about the data, not the identity (the vast majority of real test cases) |
| `toStrictEqual` | Same as `toEqual`, plus checks `undefined` properties are present/absent exactly, and checks object type/class | Strict data-shape guarantees — e.g. verifying an API response has *exactly* the fields you expect, no more, no less |

### The rule that will save you the most pain

> **If you're comparing an object or an array, reach for `toEqual`, not `toBe` — by default.** Only use `toBe` for primitives, or when you genuinely need to prove two variables point at the exact same object in memory (which is rare in everyday assertions).

---

## 9. Mocking Basics: jest.fn()

Sometimes the thing you're testing calls another function — and you don't want to run that other function for real. Maybe it hits a real database, sends a real email, or is simply something you just want to observe being called correctly. That's what mocking is for.

`jest.fn()` creates a **mock function** — a fake function that records everything that happens to it (how many times it was called, with what arguments) without needing any real implementation.

```js
test("calls the onSave callback with the right data", () => {
  const onSave = jest.fn(); // a fake function, tracked by Jest

  saveForm({ name: "John" }, onSave);

  expect(onSave).toHaveBeenCalled();
  expect(onSave).toHaveBeenCalledWith({ name: "John" });
  expect(onSave).toHaveBeenCalledTimes(1);
});
```

What just happened, step by step:

```text
1. jest.fn() creates a mock function — it does nothing by default,
   but silently RECORDS every call made to it
2. saveForm(...) runs, and internally calls onSave({ name: "John" })
3. Jest recorded: "onSave was called, 1 time, with argument { name: 'John' }"
4. Our expect() calls just ask Jest to report back what it recorded
```

A few of the most common assertions you'll make against a mock:

```js
expect(mockFn).toHaveBeenCalled();              // was it called at all, at least once?
expect(mockFn).toHaveBeenCalledTimes(2);        // called exactly twice?
expect(mockFn).toHaveBeenCalledWith(arg1, arg2); // called (at least once) with these exact args?
expect(mockFn).not.toHaveBeenCalled();          // was it NEVER called?
```

You can also give a mock function a fake return value or implementation, when the code under test needs it to actually return something:

```js
const getDiscount = jest.fn().mockReturnValue(10);

expect(getDiscount()).toBe(10); // it doesn't run real logic — just returns 10 every time
```

This is only the entry point — real mocking (mocking whole modules, mocking API calls, mocking timers) gets its own dedicated deep dive in the next lesson (03 — Mocking & Integration Tests). For now, the important foundation is just this: **`jest.fn()` gives you a fake function you can both call and later ask questions about.**

---

## 10. Common Mistakes

### Mistake 1 — Using toBe instead of toEqual for objects/arrays

Already covered in full in Section 8, but it's worth repeating as "the #1 mistake" because it's so easy to write without noticing:

```js
// WRONG — will fail even though the data is correct
expect(getUser()).toBe({ name: "John", age: 30 });

// RIGHT
expect(getUser()).toEqual({ name: "John", age: 30 });
```

The frustrating part about this mistake is that it *looks* completely reasonable when you write it. The failure message will show you two seemingly identical objects and say they don't match — that's your signal you reached for `toBe` when you meant `toEqual`.

### Mistake 2 — Tests that depend on execution order

Covered in depth in Section 7. The symptom: a test passes when run alone, or passes when run in the "normal" order, but fails when run after some other specific test, or fails when the file is reordered. The fix is always the same: move any state creation into `beforeEach` so every test starts from scratch.

### Mistake 3 — Not resetting mocks between tests

Mock functions remember every call they've ever received, across the *entire test file*, unless you tell Jest to reset them. This can quietly corrupt your assertions:

```js
describe("logger", () => {
  const mockLog = jest.fn();

  test("logs once on save", () => {
    save(mockLog);
    expect(mockLog).toHaveBeenCalledTimes(1); // PASSES
  });

  test("logs once on delete", () => {
    deleteItem(mockLog);
    expect(mockLog).toHaveBeenCalledTimes(1); // FAILS — it's actually 2!
                                               // (the first test's call is still remembered)
  });
});
```

The fix is to clear the mock's call history before every test, exactly the same way you'd reset any other shared state:

```js
describe("logger", () => {
  const mockLog = jest.fn();

  beforeEach(() => {
    mockLog.mockClear(); // wipes call history, keeps the mock itself
  });

  test("logs once on save", () => {
    save(mockLog);
    expect(mockLog).toHaveBeenCalledTimes(1); // PASSES
  });

  test("logs once on delete", () => {
    deleteItem(mockLog);
    expect(mockLog).toHaveBeenCalledTimes(1); // PASSES now — clean slate
  });
});
```

Jest even has a global config option, `clearMocks: true` (in `jest.config.js`), that automatically does this `mockClear()` before every single test in your whole project — many teams turn this on by default so nobody has to remember it manually.

---

## Interview Answer — toBe vs toEqual

"`toBe` uses `Object.is`, which is essentially the same as `===` — it checks that two values are the exact same primitive value, or for objects/arrays, that they're literally the same reference in memory. `toEqual` instead performs a deep, recursive comparison of the actual values inside an object or array, ignoring whether they're the same instance. This distinction matters constantly in real tests: two objects built independently — say, one you constructed as an expected value and one returned by the function under test — will almost never be the same reference, even when their data is identical, so using `toBe` on them fails for the wrong reason. The practical rule is to always reach for `toEqual` when comparing objects or arrays, and reserve `toBe` for primitives or for the rare case where you specifically need to prove two variables point at the exact same object."

> **Memory hook:** "toBe asks 'are you the same box?' — toEqual asks 'do your boxes hold the same stuff?'"

---

## 11. Hands-On Exercises

**Exercise 1 — Basic describe/test/expect**

Write a pure function `isValidEmail(email)` that returns `true` for strings containing an `@` and at least one `.` after it, `false` otherwise. Write a `describe` block with at least 4 `test()` cases covering: a valid email, a missing `@`, a missing `.`, and an empty string.

**Exercise 2 — toBe vs toEqual, hands-on**

Write a function `createUser(name, age)` that returns `{ name, age, isActive: true }`. Write one test using `toBe` that you expect to fail, observe the actual Jest failure output, then fix it using `toEqual`. Write a short comment explaining, in your own words, why the first version failed.

**Exercise 3 — beforeEach for test isolation**

Build a simple `Counter` class with `increment()`, `decrement()`, and a `value` property starting at 0. Write a `describe` block with a `beforeEach` that creates a fresh `Counter` before every test. Write tests for: starts at 0, increments correctly, decrements correctly, and does NOT let value go below 0 (design the class to clamp at 0). Prove test isolation by writing the tests in an order where, without `beforeEach`, an earlier test's mutation would break a later one.

**Exercise 4 — jest.fn() basics**

Write a function `processOrder(order, onComplete)` that calls `onComplete(order.id)` only if `order.total > 0`. Using `jest.fn()`, write tests proving: (a) `onComplete` is called with the correct ID when total is positive, (b) `onComplete` is NOT called when total is 0 or negative, (c) `onComplete` is called exactly once, never more.

**Exercise 5 — Fixing a broken mock reset**

Given this buggy test file, identify the bug, explain why the second test fails, and fix it:

```js
const mockNotify = jest.fn();

test("notifies once on signup", () => {
  handleSignup(mockNotify);
  expect(mockNotify).toHaveBeenCalledTimes(1);
});

test("notifies once on login", () => {
  handleLogin(mockNotify);
  expect(mockNotify).toHaveBeenCalledTimes(1);
});
```

**Exercise 6 — beforeAll vs beforeEach**

You're testing a module that reads from an in-memory fake database. Connecting to the fake database takes some setup time but is safe to share across tests; however, each test should start with an empty set of records so tests don't interfere with each other. Write the `describe` block skeleton (hooks only, no real test bodies needed) showing which setup goes in `beforeAll` and which goes in `beforeEach`, and explain your choice in a one-sentence comment above each hook.

---

## 12. Interview Q&A

**Q1: What is Jest, and what three things does it bundle together?**

A: Jest is a JavaScript testing framework that combines a test runner (discovers and executes test files, reports pass/fail), an assertion library (`expect().toBe()`-style checks), and a mocking framework (`jest.fn()` and related utilities), all in a single tool with minimal required configuration.

---

**Q2: What is the difference between `toBe` and `toEqual`?**

A: `toBe` checks exact reference identity for objects/arrays (essentially `===`/`Object.is`) and exact primitive value for numbers/strings/booleans. `toEqual` performs a deep, recursive comparison of the actual contents of an object or array, regardless of whether they're the same instance in memory. Comparing two structurally identical but separately-created objects with `toBe` will fail even though the data matches — use `toEqual` for objects and arrays.

---

**Q3: What does `toStrictEqual` add on top of `toEqual`?**

A: Two extra checks: it treats explicit `undefined` properties as significant (whereas `toEqual` ignores them, treating `{a:1, b:undefined}` the same as `{a:1}`), and it checks that both values share the same object type/class, not just the same shape.

---

**Q4: What is the purpose of `describe()` if it doesn't run any assertions?**

A: `describe()` is purely organizational — it groups related `test()`/`it()` cases under a shared label for readability in output, and lets you scope `beforeEach`/`afterEach`/`beforeAll`/`afterAll` hooks to just the tests inside that block.

---

**Q5: What's the difference between `beforeEach` and `beforeAll`?**

A: `beforeEach` runs before every single test in its scope, ideal for resetting state so each test starts fresh and stays isolated from the others. `beforeAll` runs exactly once before any test in its scope starts, ideal for expensive setup that's safe to share across tests, like opening a database connection.

---

**Q6: Why does test isolation matter, and how do Jest's hooks support it?**

A: Test isolation means one test's side effects never influence another test's outcome. Without it, tests can pass or fail depending on execution order — a hidden dependency that has nothing to do with whether the code under test is actually correct, and that can break unpredictably when tests are reordered, added, or run in parallel. `beforeEach`/`afterEach` support isolation by resetting shared state (like re-creating an object or clearing a mock) before/after every test, so each test always starts from an identical, known baseline.

---

**Q7: What's a red flag that a test suite has poor test isolation?**

A: Tests that only pass when run in a specific order, or that fail when a new test is inserted between them, or that fail only in CI (where tests may run in a different order or in parallel) but pass locally. This usually means some test is silently relying on state — a variable, a mock's call history, a database row — left behind by an earlier test, instead of setting up its own state fresh.

---

**Q8: What does `jest.fn()` do, and what can you check about it afterward?**

A: `jest.fn()` creates a mock function that records how it was called, without requiring a real implementation. Afterward you can assert things like whether it was called at all (`toHaveBeenCalled`), how many times (`toHaveBeenCalledTimes`), and with what specific arguments (`toHaveBeenCalledWith`). You can also configure it to return a fake value using `.mockReturnValue()`.

---

**Q9: Why do you need to reset mocks between tests, and how do you do it?**

A: A `jest.fn()` accumulates its call history for as long as it exists — if the same mock instance is reused across multiple tests without resetting it, an earlier test's calls will still count toward a later test's assertions, like `toHaveBeenCalledTimes`, producing incorrect failures. Reset it with `mockFn.mockClear()` (typically inside `beforeEach`), or enable Jest's global `clearMocks: true` config option to do this automatically before every test.

---

**Q10: If you're testing a function that returns an array of objects, which matcher should you use to check the result, and why?**

A: `toEqual`, because arrays and the objects inside them are compared by their actual contents, not by whether they're the same reference in memory. Using `toBe` here would fail even for a perfectly correct implementation, since the array returned by the function under test is a different object in memory from any array literal you write in the test to compare against.

---

**Q11: What is Vitest, and how does it relate to Jest?**

A: Vitest is a test runner built specifically for projects using Vite as their build tool, reusing Vite's configuration and transform pipeline for faster startup and execution. It deliberately mirrors Jest's API very closely (`describe`, `test`, `expect`, `beforeEach`, and `vi.fn()` as the equivalent of `jest.fn()`), so knowledge of Jest transfers almost directly. It's an increasingly popular default for new Vite-based projects, while Jest remains the more common choice in existing or non-Vite codebases.

---

**Q12: What actually happens, step by step, when Jest runs a single test?**

A: Jest first runs any `beforeEach` hooks in scope to set up fresh state, then executes the body of the `test()`/`it()` function, then evaluates every `expect()` assertion inside it (each either passing or failing), then runs any `afterEach` hooks for cleanup, and finally records that individual test's pass/fail result independently of every other test in the file.

---

**Q13: Why might `expect(mockFn).toHaveBeenCalledTimes(1)` unexpectedly fail even though the function under test only calls the mock once?**

A: The most common cause is a mock that wasn't reset between tests — if the same `jest.fn()` instance was already called in a previous test and its call history was never cleared (via `mockClear()` or `beforeEach`), the count from the earlier test carries over and inflates the total.

---

**Q14: When would you deliberately choose `toBe` over `toEqual`?**

A: When comparing primitives (numbers, strings, booleans, `null`, `undefined`), where `toBe` is the natural, simplest choice and behaves identically to `toEqual` anyway. Also when you specifically want to assert that two variables reference the exact same object instance — for example, verifying a memoized function returns the cached object rather than a newly constructed one.

---

**Q15: How do `beforeEach` and test isolation relate to writing tests that are safe to run in parallel or in any order?**

A: Test runners, including Jest, may run test files across multiple workers in parallel or in a different order than declared, especially in CI, for speed. A test suite is only safe under that behavior if no test's outcome depends on another test having already run — which is exactly what `beforeEach` (resetting fresh state before every test) and mock-clearing hooks guarantee. Tests written this way produce the same pass/fail result no matter what order or concurrency they run under.

---

> **Memory hook:** "Every good test is a story told from scratch — new setup, one clear check, cleaned up before the next story begins."
