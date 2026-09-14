# Test Coverage and CI Basics — Complete Guide

## Table of Contents
1. [What Coverage Actually Measures](#1-what-coverage-actually-measures)
2. [Generating a Coverage Report](#2-generating-a-coverage-report)
3. [Reading the Coverage Report](#3-reading-the-coverage-report)
4. [What to Actually Aim to Cover](#4-what-to-actually-aim-to-cover)
5. [Enforcing Coverage Thresholds](#5-enforcing-coverage-thresholds)
6. [Running Tests in CI with GitHub Actions](#6-running-tests-in-ci-with-github-actions)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What Coverage Actually Measures

Coverage measures which lines/branches/functions of your source code were **executed** while the test suite ran — it says nothing about whether the right *assertions* were made against the results.

```
100% coverage does NOT mean "well tested."
It means "every line ran at least once during the tests."

Example of 100% coverage with a useless test:

function add(a, b) { return a + b; }

test('add runs', () => {
  add(2, 2); // line executes → counted as covered
  // no expect() at all — this test can never fail, and adds zero confidence
});
```

Coverage is a **diagnostic tool** for finding untested code, not a target to game. Treat a coverage report as a map of blind spots, not a scoreboard.

---

## 2. Generating a Coverage Report

```bash
npx jest --coverage
```

Or add it as a script:

```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage"
  }
}
```

Jest uses Istanbul under the hood and prints a summary table plus writes a detailed report to `coverage/`:

```
------------------|---------|----------|---------|---------|-------------------
File              | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------|---------|----------|---------|---------|-------------------
All files         |   84.61 |    66.67 |     100 |   84.61 |
 orderService.js   |     100 |      100 |     100 |     100 |
 userController.js |   66.67 |       50 |     100 |   66.67 | 12-14
------------------|---------|----------|---------|---------|-------------------
```

`coverage/lcov-report/index.html` gives a browsable, line-by-line highlighted view (green = covered, red = not covered) — open it in a browser for the most useful view during local development.

---

## 3. Reading the Coverage Report

| Metric | What it means |
|---|---|
| **% Stmts** (statements) | Percentage of individual statements executed |
| **% Branch** | Percentage of `if`/`else`, `switch`, `&&`/`||`, ternary branches executed in *both* directions |
| **% Funcs** | Percentage of functions called at least once |
| **% Lines** | Percentage of executable lines run (usually close to statements) |

**Branch coverage is the most revealing number.** A function can have 100% statement coverage while only ever testing the `if` branch and never the `else`:

```javascript
function getDiscount(user) {
  if (user.isPremium) {
    return 0.2;
  }
  return 0; // never executed if every test uses a premium user → branch coverage catches this
}
```

`Uncovered Line #s` in the summary table points directly at line numbers never executed — the fastest way to find what to test next.

---

## 4. What to Actually Aim to Cover

Chasing 100% coverage everywhere wastes effort on low-value code and encourages the "useless test" trap from Section 1. Prioritize instead:

| Priority | What | Why |
|---|---|---|
| **High** | Business logic (pricing, validation, auth checks, state transitions) | Bugs here are expensive and easy to introduce silently |
| **High** | Error handling paths (what happens when a DB call fails, input is invalid) | These paths are rarely exercised manually and rot fast |
| **High** | Edge cases (empty arrays, zero, negative numbers, boundary values) | Where off-by-one and null-handling bugs live |
| **Medium** | Express routes/controllers (via integration tests) | Confirms wiring, not just isolated logic |
| **Low** | Simple pass-through code, framework glue, config files | Low bug density, low value per test written |
| **Skip** | Third-party library internals, generated code, `node_modules` | Not your code to test |

A reasonable rule of thumb for most backend teams: **70-85% overall coverage**, concentrated on business logic and error paths, is a healthier target than "100% everywhere" — which often means padding coverage of trivial code while critical logic still has gaps in its edge cases.

```javascript
// LOW VALUE — testing a trivial getter provides little confidence
class User {
  getName() { return this.name; }
}
test('getName returns name', () => {
  expect(new User('Ada').getName()).toBe('Ada'); // fine to skip if time is limited
});

// HIGH VALUE — this is where bugs actually hide
function calculateShipping(order) {
  if (order.weightKg <= 0) throw new Error('Invalid weight');
  if (order.destination === 'international') return order.weightKg * 15 + 10;
  if (order.weightKg > 20) return order.weightKg * 3; // bulk rate
  return order.weightKg * 5;
}
// Needs tests for: zero/negative weight, international, bulk threshold exactly at 20,
// bulk threshold at 21, domestic under 20kg.
```

---

## 5. Enforcing Coverage Thresholds

`jest.config.js` can fail the test run (useful in CI) if coverage drops below a set bar:

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',        // entry point, nothing to unit test
    '!src/config/**',        // config objects, low value
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
    // stricter threshold for critical business logic
    './src/services/pricingService.js': {
      branches: 90,
      functions: 100,
      lines: 95,
      statements: 95,
    },
  },
};
```

If coverage falls below any configured threshold, `jest --coverage` exits with a non-zero status code — which is exactly what turns this into a CI gate.

---

## 6. Running Tests in CI with GitHub Actions

A minimal but complete workflow that installs dependencies, runs the test suite with coverage, and fails the build (blocking a PR merge) if tests or thresholds fail.

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm run test:coverage
        env:
          TEST_DB_URI: mongodb://127.0.0.1:27017/myapp_test
          JWT_SECRET: ci-test-secret

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report-node-${{ matrix.node-version }}
          path: coverage/
```

If integration tests need a real database service, add it as a `services:` container available to the job:

```yaml
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
        options: >-
          --health-cmd="mongosh --eval 'db.adminCommand(\"ping\")'"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
```

Key points this workflow demonstrates:
- `npm ci` (not `npm install`) in CI — installs exactly what's in `package-lock.json`, faster and reproducible.
- A matrix build runs the suite against multiple Node versions to catch version-specific bugs.
- The `services:` block gives integration tests a real, disposable MongoDB instance scoped to the job — no manual setup, torn down automatically when the job ends.
- A failing test or unmet coverage threshold makes `npm run test:coverage` exit non-zero, which fails the GitHub Actions job — this is what should be configured as a required check before merging a PR.

---

## 7. Hands-On Exercises

**Exercise 1:** Run `npx jest --coverage` on any module you wrote earlier in this course. Open `coverage/lcov-report/index.html` in a browser and find one red (uncovered) line. Write a test that covers it, then re-run and confirm it turns green.

**Exercise 2:** Take the `calculateShipping` function from Section 4, write it as a real module, and write a test suite that achieves 100% branch coverage. Use the coverage report to confirm all branches are hit, not just all statements.

**Exercise 3:** Add a `coverageThreshold` to a `jest.config.js` in one of your projects, set intentionally too high (e.g., `95%` lines) for your current suite, run `npm run test:coverage`, and observe Jest fail the run. Lower it to a realistic number and confirm it passes.

**Exercise 4:** Write a GitHub Actions workflow file for a project of yours (real or from this course) that runs `npm ci` and `npm test` on push and pull request. If you have a GitHub repo, push it and confirm the Actions tab shows a passing run.

**Exercise 5:** Deliberately write a "coverage-gaming" test — one that calls a function but asserts nothing — and confirm it still counts toward coverage. Then explain in a comment why this is a false signal, and replace it with a real assertion.

---

## 8. Interview Q&A

**Q: Does 100% test coverage mean your code is bug-free?**
Answer: No. Coverage only measures which lines/branches executed during the test run — it says nothing about whether the test made correct assertions about the outcome. A test can call a function, ignore its return value, and still count that function's lines as "covered" while catching zero bugs. Coverage is a tool for finding untested code, not a proxy for correctness.

**Q: What's the difference between statement coverage and branch coverage, and why does branch coverage matter more?**
Answer: Statement coverage counts whether each line executed at least once; branch coverage counts whether each conditional path (`if`/`else`, ternary, `&&`/`||` short-circuits) was exercised in every direction. A function can hit 100% statement coverage while only ever testing the `if` branch of a condition and never the `else`, silently leaving an entire code path untested — branch coverage exposes that gap where statement coverage would hide it.

**Q: If you had limited time to write tests for a large legacy codebase, how would you prioritize what to cover?**
Answer: Focus on business-critical logic (pricing, auth, state transitions), error-handling paths (what happens when a dependency fails), and edge cases (boundaries, empty/zero/negative inputs) — these are where bugs are both likely and expensive. Deprioritize simple pass-through code, framework glue, and trivial getters/setters, since testing them adds little confidence per unit of effort. Coverage percentage is a byproduct of doing this well, not the goal itself.

**Q: Why use `npm ci` instead of `npm install` in a CI pipeline?**
Answer: `npm ci` installs dependencies strictly from `package-lock.json`, deleting `node_modules` first and failing if the lockfile and `package.json` are out of sync — this guarantees a reproducible install identical to what's committed. `npm install` can update the lockfile and resolve slightly different versions depending on what's already cached, which is undesirable in CI where you want every run to test the exact dependency versions the team has agreed on.

**Q: How would you make a GitHub Actions workflow fail a pull request if test coverage drops below an agreed threshold?**
Answer: Configure `coverageThreshold` in `jest.config.js` (globally and/or per-file) — when `jest --coverage` runs and any metric falls below its threshold, Jest exits with a non-zero status code. In GitHub Actions, any step exiting non-zero fails the job, and if that workflow is configured as a required status check on the branch protection rule, GitHub blocks the PR from merging until coverage is restored.

**Q: Why include a real database as a `services:` container in a CI workflow instead of mocking the database for all tests in CI?**
Answer: Unit tests (with a mocked DB) should already run in CI for fast, deterministic logic checks, but integration tests specifically exist to verify the app works against a real database — queries, schema, indexes, and driver behavior that a mock can't faithfully replicate. A `services:` container gives CI a real, disposable database scoped to that job with zero manual setup, so integration tests can run safely and repeatably on every push without needing a shared or persistent test environment.
