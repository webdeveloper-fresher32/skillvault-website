# Building a Full CRUD API — Complete Guide

## Table of Contents
1. [What We're Building](#1-what-were-building)
2. [Project Setup](#2-project-setup)
3. [The Data Layer (In-Memory Store)](#3-the-data-layer-in-memory-store)
4. [Validation Schemas](#4-validation-schemas)
5. [Full Route Implementation](#5-full-route-implementation)
6. [Wiring It All Together](#6-wiring-it-all-together)
7. [Testing the API with curl](#7-testing-the-api-with-curl)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What We're Building

A complete REST API for a **Task** resource applying everything from lessons 01-03:

```
GET    /api/v1/tasks           → list tasks (pagination, filtering, sorting)
POST   /api/v1/tasks           → create a task (validated)
GET    /api/v1/tasks/:id       → get one task
PUT    /api/v1/tasks/:id       → replace a task (validated, idempotent)
PATCH  /api/v1/tasks/:id       → partially update a task (validated)
DELETE /api/v1/tasks/:id       → delete a task
```

Data lives in an in-memory array (no database yet — that's a later phase), so you can run this file directly with `node` and immediately see everything working.

---

## 2. Project Setup

```bash
mkdir task-api && cd task-api
npm init -y
npm install express express-validator
```

```
task-api/
├── package.json
├── server.js          ← entry point
├── store.js           ← in-memory data + helpers
├── validators.js       ← express-validator schemas
└── routes/
    └── tasks.js        ← all task routes
```

---

## 3. The Data Layer (In-Memory Store)

```javascript
// store.js
let tasks = [
  { id: 1, title: 'Learn REST fundamentals', priority: 'high', done: false, createdAt: new Date().toISOString() },
  { id: 2, title: 'Build a CRUD API', priority: 'high', done: false, createdAt: new Date().toISOString() },
  { id: 3, title: 'Write tests', priority: 'medium', done: true, createdAt: new Date().toISOString() }
];
let nextId = 4;

module.exports = {
  getAll: () => tasks,
  getById: (id) => tasks.find(t => t.id === id),
  create: (data) => {
    const task = { id: nextId++, done: false, createdAt: new Date().toISOString(), ...data };
    tasks.push(task);
    return task;
  },
  replace: (id, data) => {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { id, createdAt: tasks[idx].createdAt, ...data };
    return tasks[idx];
  },
  update: (id, patch) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return null;
    Object.assign(task, patch);
    return task;
  },
  remove: (id) => {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return false;
    tasks.splice(idx, 1);
    return true;
  }
};
```

---

## 4. Validation Schemas

```javascript
// validators.js
const { body, param, query } = require('express-validator');

const idParam = param('id')
  .isInt({ min: 1 }).withMessage('id must be a positive integer')
  .toInt();

const createTaskRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('title is required')
    .isLength({ min: 3, max: 100 }).withMessage('title must be 3-100 characters')
    .escape(),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high']).withMessage('priority must be low, medium, or high'),
  body('done')
    .optional()
    .isBoolean().withMessage('done must be a boolean').toBoolean()
];

// PUT requires the full representation
const replaceTaskRules = [
  ...createTaskRules,
  body('priority').notEmpty().withMessage('priority is required for a full replace'),
  body('done').notEmpty().withMessage('done is required for a full replace')
];

// PATCH: every field optional, but at least one must be present (checked in handler)
const updateTaskRules = [
  body('title').optional().trim().isLength({ min: 3, max: 100 }).escape(),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('done').optional().isBoolean().toBoolean()
];

const listQueryRules = [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  query('done').optional().isBoolean().toBoolean(),
  query('priority').optional().isIn(['low', 'medium', 'high']),
  query('sort').optional().isString()
];

module.exports = { idParam, createTaskRules, replaceTaskRules, updateTaskRules, listQueryRules };
```

---

## 5. Full Route Implementation

```javascript
// routes/tasks.js
const express = require('express');
const { validationResult } = require('express-validator');
const store = require('../store');
const {
  idParam, createTaskRules, replaceTaskRules, updateTaskRules, listQueryRules
} = require('../validators');

const router = express.Router();

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// GET /tasks — list with pagination, filtering, sorting
router.get('/', listQueryRules, handleValidation, (req, res) => {
  let result = [...store.getAll()];

  if (req.query.done !== undefined) result = result.filter(t => t.done === req.query.done);
  if (req.query.priority) result = result.filter(t => t.priority === req.query.priority);

  if (req.query.sort) {
    const fields = req.query.sort.split(',');
    result.sort((a, b) => {
      for (const f of fields) {
        const desc = f.startsWith('-');
        const key = desc ? f.slice(1) : f;
        if (a[key] < b[key]) return desc ? 1 : -1;
        if (a[key] > b[key]) return desc ? -1 : 1;
      }
      return 0;
    });
  }

  const limit = req.query.limit || 20;
  const offset = req.query.offset || 0;
  const page = result.slice(offset, offset + limit);

  res.status(200).json({
    data: page,
    pagination: { limit, offset, total: result.length, hasMore: offset + limit < result.length }
  });
});

// GET /tasks/:id — read one
router.get('/:id', idParam, handleValidation, (req, res) => {
  const task = store.getById(req.params.id);
  if (!task) return res.status(404).json({ error: `Task ${req.params.id} not found` });
  res.status(200).json(task);
});

// POST /tasks — create
router.post('/', createTaskRules, handleValidation, (req, res) => {
  const { title, priority = 'medium', done = false } = req.body;
  const task = store.create({ title, priority, done });
  res.status(201).location(`/api/v1/tasks/${task.id}`).json(task);
});

// PUT /tasks/:id — full replace (idempotent)
router.put('/:id', idParam, replaceTaskRules, handleValidation, (req, res) => {
  const existing = store.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: `Task ${req.params.id} not found` });

  const { title, priority, done } = req.body;
  const task = store.replace(req.params.id, { title, priority, done });
  res.status(200).json(task);
});

// PATCH /tasks/:id — partial update
router.patch('/:id', idParam, updateTaskRules, handleValidation, (req, res) => {
  const existing = store.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: `Task ${req.params.id} not found` });

  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'PATCH requires at least one field to update' });
  }

  const task = store.update(req.params.id, req.body);
  res.status(200).json(task);
});

// DELETE /tasks/:id — remove
router.delete('/:id', idParam, handleValidation, (req, res) => {
  const existing = store.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: `Task ${req.params.id} not found` });

  store.remove(req.params.id);
  res.status(204).send();
});

module.exports = router;
```

---

## 6. Wiring It All Together

```javascript
// server.js
const express = require('express');
const taskRoutes = require('./routes/tasks');

const app = express();
app.use(express.json());

app.use('/api/v1/tasks', taskRoutes);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// 404 for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Centralized error handler — catches anything thrown/passed to next(err)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Task API listening on http://localhost:${PORT}`));
```

Run it:

```bash
node server.js
# Task API listening on http://localhost:3000
```

---

## 7. Testing the API with curl

```bash
# List tasks
curl http://localhost:3000/api/v1/tasks

# List with filtering, sorting, pagination
curl "http://localhost:3000/api/v1/tasks?done=false&sort=-priority&limit=10"

# Get one task
curl http://localhost:3000/api/v1/tasks/1

# Create a task — 201 Created
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Ship the CRUD API", "priority": "high"}'

# Invalid create — 400 Bad Request
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "ab"}'

# Full replace — 200 OK
curl -X PUT http://localhost:3000/api/v1/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn REST fundamentals (done)", "priority": "low", "done": true}'

# Partial update — 200 OK
curl -X PATCH http://localhost:3000/api/v1/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"done": true}'

# Delete — 204 No Content
curl -i -X DELETE http://localhost:3000/api/v1/tasks/1

# Not found — 404
curl -i http://localhost:3000/api/v1/tasks/999
```

---

## 8. Hands-On Exercises

**Exercise 1:** Run the full API above locally with `node server.js` and exercise every endpoint with the `curl` commands provided — confirm each returns the documented status code.

**Exercise 2:** Add a `DELETE /api/v1/tasks` (no id) route that deletes **all** tasks matching a query filter, e.g. `DELETE /api/v1/tasks?done=true`. Decide and justify what status code it should return.

**Exercise 3:** Add a `409 Conflict` case: reject `POST /tasks` if a task with the exact same `title` already exists.

**Exercise 4:** Extract the `handleValidation` middleware and the router into a reusable pattern, then add a second resource (e.g. `Project`) reusing the same store/validator/route structure.

**Exercise 5:** Add a request logging middleware (method, path, status code, response time in ms) applied globally in `server.js`, using `process.hrtime()` or `Date.now()` around `res.on('finish', ...)`.

---

## 9. Interview Q&A

**Q: Walk through what happens, step by step, when a client sends `PATCH /api/v1/tasks/1` with `{"done": true}`.**
Answer: Express matches the route, runs `idParam` validation (confirms `1` is a positive integer, coerces it), runs `updateTaskRules` (confirms `done` is a boolean if present), then `handleValidation` checks for errors and short-circuits with 400 if any exist. The handler then looks up the task by id (404 if missing), checks the body isn't empty (400 if it is), merges the patch into the existing task via `Object.assign`, and returns the updated task with 200.

**Q: Why does the PUT handler require all fields (title, priority, done) but PATCH doesn't?**
Answer: PUT represents a full replacement of the resource — by REST convention, whatever isn't sent is assumed to not exist, so requiring all fields prevents silently clearing data the client didn't intend to touch. PATCH is a partial update by definition, so every field is optional and only the fields present in the body are changed.

**Q: Why is validation middleware ordered before the route handler instead of inside it?**
Answer: Express middleware runs in the order it's registered, so putting validation rules and `handleValidation` before the handler ensures invalid requests are rejected with 400 before any business logic executes. This keeps handlers clean — they can assume `req.body`/`req.params`/`req.query` are already valid and correctly typed.

**Q: Why does creating a task return `location` header along with `201`?**
Answer: RFC 7231 recommends that a `201 Created` response include a `Location` header pointing to the URL of the newly created resource, so the client can immediately `GET` it without constructing the URL itself. Express provides `res.location(url)` for this.

**Q: How would you extend this in-memory API to use a real database without changing the route files?**
Answer: Because `store.js` exposes a small interface (`getAll`, `getById`, `create`, `replace`, `update`, `remove`), you can swap its internals to query a real database (e.g. MongoDB or PostgreSQL) while keeping the same function signatures. The routes never touch the array directly, so they don't need to change — this is the Repository pattern, isolating data access behind a stable interface.

**Q: Why check `Object.keys(req.body).length === 0` in the PATCH handler?**
Answer: PATCH with an empty body is a no-op that likely indicates a client bug (forgot to set the Content-Type header, or sent an empty object by mistake). Rejecting it with 400 gives the client immediate, clear feedback instead of silently succeeding and returning the resource unchanged, which could mask a real problem.
