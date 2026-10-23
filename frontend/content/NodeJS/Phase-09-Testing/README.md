# Phase 09 — Testing

## Overview

This phase covers how to test a Node.js/Express backend the way it's actually done in production codebases. You'll learn Jest fundamentals (test structure, matchers, setup/teardown), how to correctly test asynchronous code (promises, async/await, timers), how to isolate units with mocks and spies (including mocking a database layer), how to write integration tests against real Express routes with Supertest (including spinning up and tearing down a test database), and how to read coverage reports and wire tests into a CI pipeline with GitHub Actions.

## Files in This Phase

| File | Topic |
|------|-------|
| `01-Jest-Fundamentals.md` | Installing/configuring Jest, `describe`/`it`/`test`, matchers, `beforeEach`/`afterEach`/`beforeAll`/`afterAll`, testing a pure utility function |
| `02-Testing-Async-Code.md` | Testing promises and `async/await`, testing rejected promises, `done` callback, fake/mocked timers |
| `03-Mocking-and-Spies.md` | `jest.fn()`, `jest.spyOn()`, `jest.mock()`, mocking a database module, dependency injection for testability |
| `04-Integration-Testing-with-Supertest.md` | End-to-end testing of Express routes with Supertest, full CRUD API test suite, test database setup/teardown |
| `05-Test-Coverage-and-CI-Basics.md` | Coverage reports (`--coverage`), what's actually worth covering, running Jest in GitHub Actions |

## Prerequisites

- Phase 01–04: Node.js fundamentals, async/await, Express routing and middleware.
- Phase 05: REST API design (you'll be testing full CRUD endpoints).
- Phase 06: Databases (test database setup assumes a Mongo/SQL connection from this phase).

## What You Should Be Able to Do After This Phase

- Set up Jest in a Node project and write unit tests with correct `describe`/`it` structure and matchers.
- Test asynchronous code (promises, `async/await`, rejected promises) without false-positive passes.
- Use `jest.fn()`, `jest.spyOn()`, and `jest.mock()` to isolate a unit from its dependencies, including mocking a database call.
- Write integration tests for a full CRUD Express API using Supertest, with a test database that resets between runs.
- Generate and interpret a coverage report, and run the test suite automatically in CI on every push/PR.

---

Next: **Phase 10** — Advanced Node.
