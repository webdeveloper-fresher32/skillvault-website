# Jest Fundamentals — Complete Guide

## Table of Contents
1. [Why Jest](#1-why-jest)
2. [Installing and Configuring Jest](#2-installing-and-configuring-jest)
3. [Anatomy of a Test: describe, it, test](#3-anatomy-of-a-test-describe-it-test)
4. [Matchers](#4-matchers)
5. [Setup and Teardown](#5-setup-and-teardown)
6. [Complete Example: Testing a Pure Utility Function](#6-complete-example-testing-a-pure-utility-function)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Jest

Jest is a JavaScript test framework maintained by Meta. It bundles everything a Node/React project needs into one dependency:

```
Jest = test runner + assertion library + mocking library + coverage tool
```

Compare to the Python world you already know: Jest ≈ `pytest` + `unittest.mock` + `coverage.py` combined into a single package, with zero config needed for a typical Node project.

| Concept | Python (pytest) | JavaScript (Jest) |
|---|---|---|
| Test file naming | `test_*.py` | `*.test.js` or `*.spec.js` |
| Group of tests | class or module | `describe()` block |
| Single test | `def test_x():` | `it()` / `test()` |
| Assertion | `assert x == y` | `expect(x).toBe(y)` |
| Setup/teardown | fixtures | `beforeEach` / `afterEach` |
| Mocking | `unittest.mock.patch` | `jest.fn()` / `jest.mock()` |

---

## 2. Installing and Configuring Jest

```bash
npm install --save-dev jest
```

Add a script to `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

Jest auto-discovers test files matching `**/*.test.js`, `**/*.spec.js`, or anything inside a `__tests__/` folder — no config file required to get started.

Optional `jest.config.js` for explicit control:

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',      // 'node' for backend (not 'jsdom')
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  verbose: true,
};
```

Run tests:

```bash
npx jest                 # run once
npx jest --watch         # re-run on file change
npx jest math.test.js    # run a single file
npx jest -t "adds"       # run tests whose name matches "adds"
```

---

## 3. Anatomy of a Test: describe, it, test

```javascript
// math.js
function add(a, b) {
  return a + b;
}

module.exports = { add };
```

```javascript
// math.test.js
const { add } = require('./math');

describe('add()', () => {
  it('adds two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('adds a negative and a positive number', () => {
    expect(add(-1, 5)).toBe(4);
  });

  test('adds two negative numbers', () => {
    // `test` is an alias for `it` — use whichever reads better
    expect(add(-2, -3)).toBe(-5);
  });
});
```

- `describe(name, fn)` — groups related tests, purely organizational (shows up in output as a nested block).
- `it(name, fn)` / `test(name, fn)` — a single test case. `it` reads like a sentence: "it adds two positive numbers".
- Tests can be nested: `describe` blocks inside `describe` blocks for sub-grouping (e.g., "add() > with integers", "add() > with floats").
- `it.skip(...)` / `xit(...)` — skip a test temporarily.
- `it.only(...)` — run only this test in the file (useful while debugging one failure).
- `it.todo('should validate negative input')` — placeholder for a test you haven't written yet; shows up in output as pending.

---

## 4. Matchers

Matchers are the assertion functions attached to `expect()`.

| Matcher | Use |
|---|---|
| `.toBe(value)` | Strict equality (`===`) — primitives |
| `.toEqual(value)` | Deep equality — objects/arrays |
| `.toStrictEqual(value)` | Deep equality, also checks `undefined` props and types |
| `.toBeNull()` / `.toBeUndefined()` / `.toBeDefined()` | Nullish checks |
| `.toBeTruthy()` / `.toBeFalsy()` | Truthiness |
| `.toBeGreaterThan(n)` / `.toBeLessThanOrEqual(n)` | Numeric comparisons |
| `.toContain(item)` | Array/string contains |
| `.toHaveLength(n)` | Array/string length |
| `.toMatch(/regex/)` | String matches regex |
| `.toThrow()` / `.toThrow('message')` | Function throws |
| `.toHaveProperty('key', value)` | Object has a property (optionally with value) |
| `.not.toBe(value)` | Negation — chainable on any matcher |

```javascript
test('matcher examples', () => {
  expect(2 + 2).toBe(4);                          // exact primitive
  expect({ a: 1, b: 2 }).toEqual({ a: 1, b: 2 });  // deep equal, different object refs
  expect([1, 2, 3]).toContain(2);
  expect([1, 2, 3]).toHaveLength(3);
  expect('hello world').toMatch(/world/);
  expect(() => { throw new Error('boom'); }).toThrow('boom');
  expect(null).toBeNull();
  expect(0).toBeFalsy();
  expect({ id: 1, name: 'Ada' }).toHaveProperty('name', 'Ada');
  expect(5).not.toBe(6);
});
```

`.toBe` vs `.toEqual` is the most common gotcha for people coming from Python's `==`:

```javascript
expect({ a: 1 }).toBe({ a: 1 });    // FAILS — different object references
expect({ a: 1 }).toEqual({ a: 1 }); // PASSES — same structure/values
```

---

## 5. Setup and Teardown

Jest gives you four lifecycle hooks, scoped to whatever `describe` block they're declared in (or the whole file if declared at the top level).

```javascript
describe('UserRepository', () => {
  let db;

  beforeAll(() => {
    // runs once, before any test in this block
    console.log('connecting to test db...');
  });

  beforeEach(() => {
    // runs before EVERY test in this block — use to reset state
    db = createInMemoryDb();
    db.seed([{ id: 1, name: 'Ada' }]);
  });

  afterEach(() => {
    // runs after EVERY test — use to clean up
    db.clear();
  });

  afterAll(() => {
    // runs once, after all tests in this block finish
    console.log('closing test db connection...');
  });

  it('finds a user by id', () => {
    expect(db.findById(1).name).toBe('Ada');
  });

  it('returns undefined for a missing id', () => {
    expect(db.findById(999)).toBeUndefined();
  });
});
```

Execution order for two tests in one `describe`:

```
beforeAll
  beforeEach → test 1 → afterEach
  beforeEach → test 2 → afterEach
afterAll
```

Use `beforeEach`/`afterEach` (not `beforeAll`) whenever tests could otherwise leak state into each other — it's the single most common cause of "tests pass alone but fail together."

---

## 6. Complete Example: Testing a Pure Utility Function

A realistic utility module you'd find in any Express backend — validating and normalizing an email, plus a small price-formatting helper — tested exhaustively.

```javascript
// utils/format.js
function normalizeEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new Error('Invalid email');
  }
  return email.trim().toLowerCase();
}

function formatPriceCents(cents) {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error('Price must be a non-negative integer (cents)');
  }
  return `$${(cents / 100).toFixed(2)}`;
}

module.exports = { normalizeEmail, formatPriceCents };
```

```javascript
// utils/format.test.js
const { normalizeEmail, formatPriceCents } = require('./format');

describe('normalizeEmail()', () => {
  it('lowercases the email', () => {
    expect(normalizeEmail('Ada@Example.com')).toBe('ada@example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeEmail('  ada@example.com  ')).toBe('ada@example.com');
  });

  it('throws for a non-string input', () => {
    expect(() => normalizeEmail(42)).toThrow('Invalid email');
  });

  it('throws when there is no @ symbol', () => {
    expect(() => normalizeEmail('not-an-email')).toThrow('Invalid email');
  });
});

describe('formatPriceCents()', () => {
  it('formats whole dollars', () => {
    expect(formatPriceCents(500)).toBe('$5.00');
  });

  it('formats cents correctly', () => {
    expect(formatPriceCents(1099)).toBe('$10.99');
  });

  it('formats zero', () => {
    expect(formatPriceCents(0)).toBe('$0.00');
  });

  it('throws for negative values', () => {
    expect(() => formatPriceCents(-100)).toThrow(/non-negative/);
  });

  it('throws for non-integer values', () => {
    expect(() => formatPriceCents(9.5)).toThrow();
  });
});
```

Running `npx jest format.test.js` reports each `it` as a pass/fail leaf under its `describe` block — this is the shape every Jest suite in this course will follow.

---

## 7. Hands-On Exercises

**Exercise 1:** Create a `stringUtils.js` module with `capitalize(str)` and `truncate(str, maxLen)` functions. Write a `stringUtils.test.js` with at least 4 tests covering normal input, empty string, and edge cases (e.g., `truncate` when `maxLen` is longer than the string).

**Exercise 2:** Write a function `isValidPassword(password)` that returns `true` only if the password is 8+ characters and contains at least one digit. Test it with `describe` blocks separating "valid passwords" from "invalid passwords".

**Exercise 3:** Take the `formatPriceCents` example above and add a `beforeEach` that logs `"running a price test"` before every test — run `npx jest --verbose` and observe where the log lines appear relative to test output.

**Exercise 4:** Deliberately write a test using `.toBe()` to compare two different array instances with the same contents, run it, watch it fail, then fix it with `.toEqual()`. Explain in a comment why the first version failed.

**Exercise 5:** Add `it.skip` to one test and `it.todo` to a new one describing a test you haven't implemented yet. Run the suite and note how Jest reports skipped vs todo tests differently.

---

## 8. Interview Q&A

**Q: What's the difference between `describe`, `it`, and `test` in Jest?**
Answer: `describe(name, fn)` groups related tests for organization and readable output — it doesn't run assertions itself. `it(name, fn)` and `test(name, fn)` are the same function under two names, each defining one test case that runs assertions via `expect()`. Convention: use `describe` for the unit under test (a function or module) and `it` for behavior ("it does X").

**Q: What's the difference between `.toBe()` and `.toEqual()`?**
Answer: `.toBe()` uses `Object.is` (essentially strict `===`) — correct for primitives (numbers, strings, booleans) but fails for two different objects/arrays with identical contents because it compares references. `.toEqual()` performs a recursive deep-equality check on the value's structure, which is what you want for objects and arrays. `.toStrictEqual()` goes further, also failing if one object has an explicit `undefined` property the other lacks.

**Q: When would you use `beforeEach` over `beforeAll`?**
Answer: `beforeAll` runs once before all tests in a block — good for expensive one-time setup like opening a real DB connection. `beforeEach` runs before every individual test — required whenever a test mutates shared state (e.g., seeding data, resetting a mock), because relying on `beforeAll` for mutable state causes one test's leftover state to leak into and break the next test.

**Q: How do you run only a single test or test file in Jest?**
Answer: Use `it.only(...)` (or `test.only`) in the code to run just that test within a file, `npx jest path/to/file.test.js` to run one file, or `npx jest -t "partial test name"` to run every test whose name matches a substring/regex, across all files.

**Q: Why should you avoid testing implementation details and focus on behavior?**
Answer: Tests coupled to internal implementation (e.g., asserting a private variable's exact value, or that a specific internal function was called) break every time you refactor, even if the public behavior is unchanged — this makes the suite a maintenance burden instead of a safety net. Testing observable behavior (given this input, the function returns/throws this) lets you refactor freely as long as the contract holds.

**Q: What does Jest do if a test function throws an unhandled exception versus a failed `expect()`?**
Answer: Both are reported as a failing test — Jest wraps each test body in a try/catch internally. A failed `expect()` throws a `JestAssertionError` with a diff of expected vs received; an unrelated thrown error (e.g., calling a function on `undefined`) is reported with its own stack trace. Either way, one failing assertion or thrown error fails only that `it` block — subsequent tests still run.
