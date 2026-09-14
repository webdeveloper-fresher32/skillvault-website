# Integration Testing with Supertest — Complete Guide

## Table of Contents
1. [Unit Tests vs Integration Tests](#1-unit-tests-vs-integration-tests)
2. [Installing and Using Supertest](#2-installing-and-using-supertest)
3. [Setting Up a Test Database](#3-setting-up-a-test-database)
4. [Complete Example: Full CRUD API Test Suite](#4-complete-example-full-crud-api-test-suite)
5. [Testing Auth-Protected Routes](#5-testing-auth-protected-routes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Unit Tests vs Integration Tests

| | Unit test (Phase 09, lessons 1-3) | Integration test (this lesson) |
|---|---|---|
| Scope | One function/module, dependencies mocked | Full request → route → controller → DB → response |
| Speed | Milliseconds | Slower (real DB I/O), but still fast enough for CI |
| Confidence | "This function is correct in isolation" | "This endpoint actually works end-to-end" |
| Example | `getUserHandler` with a mocked repository | `GET /api/users/1` against a real Express app + test DB |

Neither replaces the other. A healthy backend test suite has many fast unit tests (Phase 09.1-09.3) and a smaller number of integration tests (this lesson) confirming the pieces are actually wired together correctly — middleware runs, routes are mounted, validation rejects bad input, status codes are right, the DB query actually persists data.

---

## 2. Installing and Using Supertest

Supertest wraps an Express app and lets you make HTTP-like requests against it directly in a test, with no need to actually bind to a port.

```bash
npm install --save-dev supertest
```

Basic shape:

```javascript
// app.js — export the app WITHOUT calling app.listen() here
const express = require('express');
const app = express();
app.use(express.json());

app.get('/ping', (req, res) => {
  res.status(200).json({ message: 'pong' });
});

module.exports = app;
```

```javascript
// server.js — the actual entry point that starts listening
const app = require('./app');
app.listen(3000, () => console.log('Server running on port 3000'));
```

```javascript
// app.test.js
const request = require('supertest');
const app = require('./app');

describe('GET /ping', () => {
  it('responds with pong', async () => {
    const response = await request(app).get('/ping');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'pong' });
  });
});
```

Splitting `app.js` (the Express app definition) from `server.js` (the thing that calls `.listen()`) is the pattern that makes this work cleanly — Supertest needs the app object, not a running server on a real port.

Supertest supports chaining, sending a JSON body, and setting headers:

```javascript
await request(app)
  .post('/api/users')
  .set('Authorization', `Bearer ${token}`)
  .send({ name: 'Ada', email: 'ada@example.com' })
  .expect('Content-Type', /json/)
  .expect(201);
```

---

## 3. Setting Up a Test Database

Integration tests for routes that touch a database need a real (but isolated) database — never point tests at production or shared dev data.

Common approaches:

| Approach | How | Trade-off |
|---|---|---|
| Separate test DB/database name | `mongodb://localhost:27017/myapp_test` | Simple, needs a running DB server |
| In-memory MongoDB | `mongodb-memory-server` package | No external DB needed, spins up per test run |
| Dockerized test DB in CI | `services:` block in GitHub Actions | Matches production DB engine exactly |
| SQLite for SQL apps | `:memory:` database via the same ORM | Fast, but only viable if your app doesn't rely on Postgres/MySQL-specific SQL |

Example using `mongoose` with a dedicated test database and full reset between test files:

```javascript
// test/setup.js
const mongoose = require('mongoose');

const TEST_DB_URI = process.env.TEST_DB_URI || 'mongodb://127.0.0.1:27017/myapp_test';

async function connectTestDb() {
  await mongoose.connect(TEST_DB_URI);
}

async function clearTestDb() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

async function closeTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
}

module.exports = { connectTestDb, clearTestDb, closeTestDb };
```

Using it in a test suite:

```javascript
const { connectTestDb, clearTestDb, closeTestDb } = require('./test/setup');

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await clearTestDb(); // every test starts with a clean, empty DB
});

afterAll(async () => {
  await closeTestDb();
});
```

`afterEach` (not `afterAll`) clearing the DB is what guarantees tests don't leak state into each other and can run in any order.

---

## 4. Complete Example: Full CRUD API Test Suite

A minimal but complete "Tasks" API — create, read, update, delete — tested end-to-end.

```javascript
// models/Task.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  done: { type: Boolean, default: false },
});

module.exports = mongoose.model('Task', taskSchema);
```

```javascript
// routes/tasks.js
const express = require('express');
const Task = require('../models/Task');
const router = express.Router();

router.post('/', async (req, res) => {
  if (!req.body.title) {
    return res.status(400).json({ error: 'title is required' });
  }
  const task = await Task.create({ title: req.body.title });
  res.status(201).json(task);
});

router.get('/', async (req, res) => {
  const tasks = await Task.find();
  res.status(200).json(tasks);
});

router.get('/:id', async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.status(200).json(task);
});

router.put('/:id', async (req, res) => {
  const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.status(200).json(task);
});

router.delete('/:id', async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.status(204).send();
});

module.exports = router;
```

```javascript
// app.js
const express = require('express');
const tasksRouter = require('./routes/tasks');

const app = express();
app.use(express.json());
app.use('/api/tasks', tasksRouter);

module.exports = app;
```

```javascript
// tasks.test.js
const request = require('supertest');
const app = require('./app');
const { connectTestDb, clearTestDb, closeTestDb } = require('./test/setup');

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

describe('Tasks API', () => {
  describe('POST /api/tasks', () => {
    it('creates a task and returns 201', async () => {
      const res = await request(app).post('/api/tasks').send({ title: 'Buy milk' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ title: 'Buy milk', done: false });
      expect(res.body._id).toBeDefined();
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(app).post('/api/tasks').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('title is required');
    });
  });

  describe('GET /api/tasks', () => {
    it('returns an empty array when there are no tasks', async () => {
      const res = await request(app).get('/api/tasks');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all created tasks', async () => {
      await request(app).post('/api/tasks').send({ title: 'Task A' });
      await request(app).post('/api/tasks').send({ title: 'Task B' });

      const res = await request(app).get('/api/tasks');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('returns a single task by id', async () => {
      const created = await request(app).post('/api/tasks').send({ title: 'Find me' });

      const res = await request(app).get(`/api/tasks/${created.body._id}`);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Find me');
    });

    it('returns 404 for a non-existent id', async () => {
      const res = await request(app).get('/api/tasks/507f1f77bcf86cd799439011');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('updates a task', async () => {
      const created = await request(app).post('/api/tasks').send({ title: 'Old title' });

      const res = await request(app)
        .put(`/api/tasks/${created.body._id}`)
        .send({ title: 'New title', done: true });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ title: 'New title', done: true });
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('deletes a task and returns 204', async () => {
      const created = await request(app).post('/api/tasks').send({ title: 'To delete' });

      const deleteRes = await request(app).delete(`/api/tasks/${created.body._id}`);
      expect(deleteRes.status).toBe(204);

      const getRes = await request(app).get(`/api/tasks/${created.body._id}`);
      expect(getRes.status).toBe(404); // confirms it's actually gone
    });
  });
});
```

Notice the suite tests real behavior end-to-end: JSON parsing middleware, route matching, Mongoose validation, actual persistence, and correct status codes — nothing here is mocked, which is exactly the point of an integration test.

---

## 5. Testing Auth-Protected Routes

Routes behind authentication middleware (Phase 07) need a valid token/session in the test request:

```javascript
// Assuming a JWT-based auth middleware from Phase 07
const jwt = require('jsonwebtoken');

function generateTestToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

describe('GET /api/tasks (protected)', () => {
  it('rejects requests with no token', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('allows requests with a valid token', async () => {
    const token = generateTestToken('user_123');

    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
```

---

## 6. Hands-On Exercises

**Exercise 1:** Build the Tasks API above (or reuse a CRUD API from Phase 05) and write the full Supertest suite exactly as shown, running it against `mongodb-memory-server` instead of a real local MongoDB — install the package and adapt `test/setup.js` to use it.

**Exercise 2:** Add a `PATCH /api/tasks/:id/complete` endpoint that sets `done: true` without requiring a request body. Write tests for both the success case and the "task doesn't exist" case.

**Exercise 3:** Add pagination to `GET /api/tasks` (`?page=1&limit=10`) and write tests confirming the correct subset and count are returned for at least two different pages.

**Exercise 4:** Add JWT-based auth middleware (from Phase 07) to the Tasks routes. Write tests confirming: no token → 401, invalid/expired token → 401, valid token → 200/201 as appropriate.

**Exercise 5:** Intentionally remove the `afterEach(clearTestDb)` call and observe a test failure caused by data leaking between tests (e.g., the "empty array" test failing because a previous test's task still exists). Restore it and confirm the suite is stable again.

---

## 7. Interview Q&A

**Q: Why does Supertest need you to export the Express `app` object separately from calling `app.listen()`?**
Answer: Supertest can bind directly to an in-memory server using the app object, without actually opening a real network port — this makes tests fast and avoids port conflicts between parallel test runs. If `app.listen()` is called at import time (e.g., inside `app.js`), importing the app for testing would also start a real server as a side effect, which is both slow and can crash the test run if the port is already in use.

**Q: What's the difference between a unit test and an integration test in the context of an Express API?**
Answer: A unit test isolates one function or module (e.g., a controller) by mocking its dependencies (like the database layer), verifying its logic in isolation and running in milliseconds. An integration test (using Supertest) sends a real HTTP-style request through the actual Express app — middleware, routing, controller, and a real (test) database — verifying the pieces are correctly wired together end-to-end. Both are needed: unit tests catch logic bugs fast; integration tests catch wiring/config bugs unit tests can't see.

**Q: Why is it important to clear the test database between tests rather than only at the very end of the suite?**
Answer: Without clearing state between tests, data created by one test (e.g., a task inserted in a POST test) persists and can cause unrelated tests to fail or pass incorrectly (e.g., a "returns empty array" test failing because leftover data exists, or two tests colliding on the same unique field). Clearing in `afterEach` (or `beforeEach`) guarantees each test starts from a known, empty state and can run in any order or in isolation.

**Q: What are the trade-offs between using a real local test database versus something like `mongodb-memory-server` for integration tests?**
Answer: A real local test database (with a distinct test database name) is closer to production behavior but requires a running DB server, which is an extra dependency for developers and CI to set up. An in-memory database like `mongodb-memory-server` spins up automatically inside the test process, needs no external service, and is faster to reset — at the cost of possibly missing engine-specific behavior/version differences. Many teams use in-memory/dockerized DBs locally and in CI specifically to avoid environment setup friction.

**Q: How would you test a route protected by authentication middleware without hitting a real login flow in every test?**
Answer: Generate a valid token/session directly in the test setup (e.g., calling the same `jwt.sign()` function the real login route uses, with a test secret) and attach it via the `Authorization` header on the Supertest request, bypassing the need to actually call `POST /login` in every single protected-route test. It's still worth having a small number of tests that exercise the real login flow itself, but every other protected-route test can use a pre-generated token to stay focused and fast.

**Q: If a Supertest assertion checks `res.body` immediately after `await request(app).post(...)`, why is that safe — doesn't the response need time to arrive?**
Answer: `await` on the Supertest request promise already resolves only after the full HTTP response cycle completes (request sent, Express handler finished, response received and parsed) — Supertest handles all of that internally. By the time `await` returns, `res.status` and `res.body` are fully populated, so no additional waiting or polling is needed.
