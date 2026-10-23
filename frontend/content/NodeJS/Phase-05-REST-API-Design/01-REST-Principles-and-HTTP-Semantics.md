# REST Principles and HTTP Semantics — Complete Guide

## Table of Contents
1. [What REST Actually Means](#1-what-rest-actually-means)
2. [Statelessness](#2-statelessness)
3. [Resources and the Uniform Interface](#3-resources-and-the-uniform-interface)
4. [HTTP Verbs — Correct Usage](#4-http-verbs--correct-usage)
5. [Idempotency and Safety](#5-idempotency-and-safety)
6. [HTTP Status Code Reference](#6-http-status-code-reference)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What REST Actually Means

REST (**Re**presentational **S**tate **T**ransfer) is an architectural style defined by Roy Fielding in his 2000 dissertation. It is **not** "JSON over HTTP" — that's just the common implementation. REST is a set of constraints:

```
1. Client-Server        → separation of UI concerns from data storage
2. Statelessness         → server holds no client session state between requests
3. Cacheability           → responses declare whether they can be cached
4. Uniform Interface      → resources identified by URLs, manipulated via representations
5. Layered System         → client can't tell if it's talking to the server directly or through a proxy
6. Code on Demand (opt.)  → server can extend client behavior (e.g. sending JS) — rarely used in APIs
```

Most "REST APIs" in the wild are actually **RESTful** (loosely follow the style) rather than strictly RESTful (following all constraints, including HATEOAS — Hypermedia As The Engine Of Application State, where responses include links to related actions). Interviewers care most about statelessness, resource orientation, and correct HTTP semantics — that's the practical 80%.

---

## 2. Statelessness

Each request must contain **all information needed to process it**. The server does not remember anything about the client between requests.

```
❌ Stateful (server remembers):
  Request 1: POST /login          → server stores "user X is logged in" in memory
  Request 2: GET /orders          → server checks its memory, knows it's user X

✅ Stateless (client proves identity every time):
  Request 1: POST /login          → server returns a token
  Request 2: GET /orders
              Authorization: Bearer <token>   → server verifies token, no memory needed
```

Why it matters:
- **Scalability** — any server instance can handle any request (no "sticky sessions" needed).
- **Reliability** — a server restart doesn't lose client state.
- **Simplicity** — no session storage/synchronization across servers.

```javascript
// ❌ Stateful anti-pattern — storing "current user" in server memory
let currentUser = null;

app.post('/login', (req, res) => {
  currentUser = req.body.username; // BAD: shared mutable state, breaks with 2+ server instances
  res.json({ message: 'logged in' });
});

app.get('/profile', (req, res) => {
  res.json({ user: currentUser }); // BAD: relies on server memory between requests
});
```

```javascript
// ✅ Stateless — every request carries its own proof of identity
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev-secret';

app.post('/login', (req, res) => {
  const { username } = req.body;
  const token = jwt.sign({ username }, SECRET, { expiresIn: '1h' });
  res.json({ token });
});

app.get('/profile', (req, res) => {
  const authHeader = req.headers.authorization; // 'Bearer <token>'
  const token = authHeader?.split(' ')[1];
  try {
    const payload = jwt.verify(token, SECRET);
    res.json({ user: payload.username });
  } catch {
    res.status(401).json({ error: 'Invalid or missing token' });
  }
});
```

---

## 3. Resources and the Uniform Interface

A **resource** is any noun your API exposes: a user, an order, a product, a comment. Resources are identified by URLs, and clients interact with them through a fixed set of operations (the HTTP verbs) and representations (usually JSON).

```
Resource: "task"
  Collection URL:  /tasks           → the set of all tasks
  Single item URL: /tasks/42        → one specific task

Representation returned:
{
  "id": 42,
  "title": "Write REST lesson",
  "done": false
}
```

The uniform interface means: **the same verb always means the same thing, regardless of which resource it's applied to.** `DELETE /tasks/42` and `DELETE /users/7` both mean "remove this specific resource" — a client doesn't need resource-specific documentation to guess that.

---

## 4. HTTP Verbs — Correct Usage

| Verb | Meaning | Request Body? | Typical Use |
|------|---------|---------------|-------------|
| `GET` | Retrieve a resource or collection | No | `GET /tasks`, `GET /tasks/42` |
| `POST` | Create a new resource (server assigns ID) | Yes | `POST /tasks` |
| `PUT` | Replace a resource entirely | Yes | `PUT /tasks/42` (send full object) |
| `PATCH` | Partially update a resource | Yes | `PATCH /tasks/42` (send only changed fields) |
| `DELETE` | Remove a resource | No (usually) | `DELETE /tasks/42` |
| `HEAD` | Like GET but headers only, no body | No | Check if resource exists / cache validation |
| `OPTIONS` | List allowed methods on a resource | No | CORS preflight |

```javascript
const express = require('express');
const app = express();
app.use(express.json());

let tasks = [{ id: 1, title: 'Learn REST', done: false }];

// GET — safe, read-only
app.get('/tasks', (req, res) => res.json(tasks));

// POST — create, server assigns the id
app.post('/tasks', (req, res) => {
  const task = { id: tasks.length + 1, title: req.body.title, done: false };
  tasks.push(task);
  res.status(201).json(task);
});

// PUT — full replacement, client must send the complete object
app.put('/tasks/:id', (req, res) => {
  const idx = tasks.findIndex(t => t.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });
  tasks[idx] = { id: tasks[idx].id, title: req.body.title, done: req.body.done };
  res.json(tasks[idx]);
});

// PATCH — partial update, only send fields that changed
app.patch('/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  Object.assign(task, req.body); // merge only provided fields
  res.json(task);
});

// DELETE — remove
app.delete('/tasks/:id', (req, res) => {
  const idx = tasks.findIndex(t => t.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });
  tasks.splice(idx, 1);
  res.status(204).send(); // no content
});
```

A very common interview trap: **using POST for everything** (`POST /getTasks`, `POST /deleteTask`). This is RPC-style, not REST, and throws away the uniform interface's benefits (cacheability of GET, idempotency guarantees, correct tooling behavior).

---

## 5. Idempotency and Safety

Two properties every HTTP method has, and interviewers love asking about them:

- **Safe**: does not modify server state. (`GET`, `HEAD`, `OPTIONS`)
- **Idempotent**: calling it N times has the same effect as calling it once. (`GET`, `PUT`, `DELETE`, `HEAD`, `OPTIONS` — but **not** `POST` or `PATCH` in general)

| Method | Safe? | Idempotent? | Why |
|--------|-------|-------------|-----|
| `GET` | Yes | Yes | Read-only, repeating it changes nothing |
| `PUT` | No | Yes | Replacing with the same data twice leaves the same end state |
| `DELETE` | No | Yes | Deleting an already-deleted resource still ends with "resource gone" |
| `POST` | No | No | Calling `POST /tasks` twice creates two tasks |
| `PATCH` | No | Not guaranteed | `{"done": true}` is idempotent; `{"views": views + 1}` is not |

```javascript
// PUT is idempotent: sending this exact request 5 times in a row
// leaves the resource in the SAME final state every time.
app.put('/tasks/1', (req, res) => {
  tasks[0] = { id: 1, title: req.body.title, done: req.body.done };
  res.json(tasks[0]);
});

// POST is NOT idempotent: each call creates a brand-new resource.
app.post('/tasks', (req, res) => {
  const task = { id: tasks.length + 1, title: req.body.title, done: false };
  tasks.push(task); // calling this 5 times → 5 new tasks
  res.status(201).json(task);
});
```

Why this matters in practice: clients (and proxies) safely **retry** idempotent requests on network failure without fear of side effects. A flaky network calling `DELETE /tasks/42` twice is harmless. Retrying `POST /tasks` twice can double-create data — this is why payment APIs use idempotency keys on POST requests.

---

## 6. HTTP Status Code Reference

### 2xx — Success

| Code | Name | When to Use |
|------|------|-------------|
| `200 OK` | OK | Successful GET, PUT, PATCH — response has a body |
| `201 Created` | Created | Successful POST that created a resource — include `Location` header and the resource |
| `202 Accepted` | Accepted | Request accepted for async processing, not yet complete |
| `204 No Content` | No Content | Successful DELETE, or PUT/PATCH with nothing useful to return |

### 3xx — Redirection

| Code | Name | When to Use |
|------|------|-------------|
| `301 Moved Permanently` | Moved Permanently | Resource URL has permanently changed |
| `304 Not Modified` | Not Modified | Conditional GET (`If-None-Match`) — client's cached copy is still valid |
| `307 Temporary Redirect` | Temporary Redirect | Temporary redirect, method/body must be preserved on retry |

### 4xx — Client Errors

| Code | Name | When to Use |
|------|------|-------------|
| `400 Bad Request` | Bad Request | Malformed syntax, invalid JSON, failed validation |
| `401 Unauthorized` | Unauthorized | Missing or invalid authentication credentials |
| `403 Forbidden` | Forbidden | Authenticated, but not allowed to perform this action |
| `404 Not Found` | Not Found | Resource/route does not exist |
| `405 Method Not Allowed` | Method Not Allowed | Route exists but this verb isn't supported on it |
| `409 Conflict` | Conflict | Request conflicts with current state (duplicate email, version mismatch) |
| `422 Unprocessable Entity` | Unprocessable Entity | Syntactically valid but semantically invalid (e.g. failed business-rule validation) |
| `429 Too Many Requests` | Too Many Requests | Rate limit exceeded |

### 5xx — Server Errors

| Code | Name | When to Use |
|------|------|-------------|
| `500 Internal Server Error` | Internal Server Error | Unhandled exception — generic catch-all |
| `502 Bad Gateway` | Bad Gateway | Upstream service (proxy, load balancer) got an invalid response |
| `503 Service Unavailable` | Service Unavailable | Server temporarily overloaded or down for maintenance |
| `504 Gateway Timeout` | Gateway Timeout | Upstream service took too long to respond |

```javascript
// Practical usage in an Express handler
app.post('/tasks', (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'title is required and must be a string' }); // 400
  }

  const exists = tasks.some(t => t.title === title);
  if (exists) {
    return res.status(409).json({ error: 'A task with this title already exists' }); // 409
  }

  const task = { id: tasks.length + 1, title, done: false };
  tasks.push(task);
  res.status(201).location(`/tasks/${task.id}`).json(task); // 201
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' }); // 500 catch-all
});
```

`400` vs `422` is a common source of confusion: use `400` when the request itself is malformed (bad JSON, wrong type), and `422` when it's well-formed JSON but violates a business rule (e.g. `endDate` before `startDate`). Many APIs use `400` for both — either is defensible as long as you're consistent.

---

## 7. Hands-On Exercises

**Exercise 1:** Build an Express route `GET /health` that returns `200` with `{ status: 'ok' }`. Then add a route `GET /health/fail` that returns `503` with `{ status: 'unavailable' }` to simulate a dependency being down.

**Exercise 2:** Take the `PUT /tasks/:id` handler above and prove it's idempotent: call it 3 times in a row with the same body using `curl`, and confirm the resource ends up identical each time.

**Exercise 3:** Take the `POST /tasks` handler and prove it's NOT idempotent: call it 3 times with the same body and show 3 different tasks get created.

**Exercise 4:** Add a route that returns `404` for an unknown task ID and `400` for an invalid ID (e.g. `/tasks/abc` where `abc` isn't a number). Write both checks explicitly.

**Exercise 5:** Add a global 404 handler (for unmatched routes) and a global error-handling middleware (for uncaught exceptions) to an Express app, returning proper JSON bodies for both.

---

## 8. Interview Q&A

**Q: What does it mean for an API to be "stateless," and why does it matter?**
Answer: Statelessness means the server does not store any client session context between requests — each request must carry everything needed to process it (e.g. an auth token). This matters because it lets any server instance handle any request, which is essential for horizontal scaling and load balancing, and it removes the need to synchronize session state across servers.

**Q: What's the difference between PUT and PATCH?**
Answer: PUT replaces the entire resource — the client must send the full representation, and any field omitted is typically treated as cleared or reset. PATCH applies a partial update — the client sends only the fields that changed, and the server merges them into the existing resource.

**Q: Is POST idempotent? Is PATCH?**
Answer: POST is not idempotent — calling it multiple times with the same payload typically creates multiple new resources. PATCH is idempotent only if the operation itself is (e.g. setting a field to a fixed value); it's not idempotent for relative updates like incrementing a counter.

**Q: When would you return 401 vs 403?**
Answer: 401 Unauthorized means the request lacks valid authentication — the server doesn't know who you are (missing/invalid token). 403 Forbidden means the server knows who you are, but you don't have permission to perform this action on this resource.

**Q: Why is using POST for every operation (POST /deleteUser, POST /getUsers) considered bad REST design?**
Answer: It throws away the uniform interface — clients, proxies, and caches can no longer rely on HTTP semantics (GET is cacheable and safe, DELETE is idempotent, etc.). It also makes the API harder to reason about and loses free behaviors like browser/CDN caching of GET requests.

**Q: What status code would you return for a successful DELETE, and why?**
Answer: 204 No Content is most correct since there's nothing useful to return after deletion. Some APIs return 200 with a confirmation body instead — both are acceptable, but 204 is the more precise REST convention.
