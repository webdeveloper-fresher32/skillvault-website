# Express and REST APIs — Complete Guide

## Table of Contents
1. [What Express Is](#1-what-express-is)
2. [App Setup and Basic Routing](#2-app-setup-and-basic-routing)
3. [The Request and Response Objects](#3-the-request-and-response-objects)
4. [Middleware — Built-in, Custom, Third-Party](#4-middleware--built-in-custom-third-party)
5. [REST API Design Conventions](#5-rest-api-design-conventions)
6. [Error-Handling Middleware](#6-error-handling-middleware)
7. [Full Annotated Example: CRUD REST API](#7-full-annotated-example-crud-rest-api)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What Express Is

Express is a minimal, unopinionated web framework built on top of Node's core `http` module. Raw Node requires you to manually parse URLs, route by hand with `if/else` chains on `req.url`, and parse request bodies yourself. Express replaces all of that with a declarative routing API and a **middleware pipeline** — a chain of functions that each request passes through in order, any of which can inspect, modify, respond to, or reject the request before it reaches your route handler.

```
Raw Node http.createServer:              Express:
┌─────────────────────────┐              ┌─────────────────────────┐
│ if (req.url === "/a")    │              │ app.get("/a", handlerA) │
│   ... handle A           │              │ app.get("/b", handlerB) │
│ else if (req.url === "/b")│             │ app.use(middleware)     │
│   ... handle B           │              │ // declarative, ordered,│
│ else if (...)            │              │ // composable pipeline  │
│   ...                    │              └─────────────────────────┘
└─────────────────────────┘
  manual, imperative, grows unwieldy
```

---

## 2. App Setup and Basic Routing

```js
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// Built-in middleware to parse incoming JSON request bodies into req.body
app.use(express.json());

// Basic routes — method + path + handler
app.get("/", (req, res) => {
  res.send("Welcome to the API");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Route parameters — the :id segment becomes req.params.id
app.get("/users/:id", (req, res) => {
  res.json({ userId: req.params.id });
});

// Query parameters — everything after ? in the URL
app.get("/search", (req, res) => {
  const { q, page = 1 } = req.query; // /search?q=node&page=2
  res.json({ query: q, page: Number(page) });
});

// Route grouping with express.Router() — keeps large apps organized
const usersRouter = express.Router();
usersRouter.get("/", (req, res) => res.json({ users: [] }));
usersRouter.get("/:id", (req, res) => res.json({ id: req.params.id }));
app.use("/api/users", usersRouter); // mounted at /api/users/*

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

### HTTP Method Handlers

```js
app.get("/resource", handler);     // read
app.post("/resource", handler);    // create
app.put("/resource/:id", handler); // full replace
app.patch("/resource/:id", handler); // partial update
app.delete("/resource/:id", handler); // remove
app.all("/resource", handler);      // matches any HTTP method
```

---

## 3. The Request and Response Objects

Every route handler receives `(req, res, next)` — the incoming request, the outgoing response, and (for middleware) a function to pass control onward.

```js
app.post("/orders/:id/items", (req, res) => {
  // --- req: everything about the incoming request ---
  req.params.id;        // route params, e.g. { id: "42" }
  req.query;             // parsed query string, e.g. ?sort=asc → { sort: "asc" }
  req.body;              // parsed request body (requires express.json() middleware)
  req.headers;           // all headers, lowercase keys, e.g. req.headers["content-type"]
  req.method;            // "POST"
  req.path;              // "/orders/42/items"
  req.ip;                // client IP address

  // --- res: everything for building the outgoing response ---
  res.status(201);                          // set HTTP status code
  res.json({ created: true });               // send JSON, sets Content-Type automatically
  res.send("plain text or html");            // send raw text/html/buffer
  res.set("X-Custom-Header", "value");        // set a response header
  res.redirect("/orders/42");                  // 302 redirect
  res.sendStatus(204);                          // status only, no body

  // Chaining is common:
  res.status(201).json({ id: req.params.id, item: req.body });
});
```

---

## 4. Middleware — Built-in, Custom, Third-Party

Middleware is any function with the signature `(req, res, next)` (or `(err, req, res, next)` for error handlers). Each middleware can modify `req`/`res`, end the request-response cycle, or call `next()` to pass control to the next function in the pipeline.

```
Request  ──▶ [ cors() ] ──▶ [ morgan() ] ──▶ [ express.json() ] ──▶ [ auth() ] ──▶ [ route handler ] ──▶ Response
              logs/CORS      request log      body parsing         verifies JWT     your business logic

If any middleware does NOT call next() and does not send a response,
the request hangs forever — this is the most common Express bug.
```

### Built-in Middleware

```js
app.use(express.json());                      // parses application/json bodies into req.body
app.use(express.urlencoded({ extended: true })); // parses HTML form submissions
app.use(express.static("public"));              // serves static files (images, CSS, JS) from ./public
```

### Third-Party Middleware

```js
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";

app.use(helmet());                 // sets security-related HTTP headers
app.use(cors({ origin: "https://myapp.com" })); // controls cross-origin access
app.use(morgan("combined"));        // logs every request (method, path, status, timing)
```

### Custom Middleware

```js
// Logging middleware — runs for every request, must call next() to continue
function requestLogger(req, res, next) {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next(); // without this, every request hangs indefinitely
}
app.use(requestLogger);

// Route-specific middleware — only runs for routes that reference it
function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (key !== process.env.API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
    // note the `return` — prevents next() from also being called below
  }
  next();
}
app.get("/admin/stats", requireApiKey, (req, res) => {
  res.json({ stats: "..." });
});

// Middleware can also modify req/res before passing control on
function attachRequestId(req, res, next) {
  req.requestId = crypto.randomUUID();
  res.set("X-Request-Id", req.requestId);
  next();
}
```

---

## 5. REST API Design Conventions

REST (Representational State Transfer) maps CRUD operations onto HTTP methods and status codes over resource-oriented URLs.

### Resource Naming

```
Good — plural nouns, hierarchical, no verbs in the URL:
  GET    /users              list all users
  GET    /users/42           get one user
  POST   /users              create a user
  PUT    /users/42           replace user 42 entirely
  PATCH  /users/42           partially update user 42
  DELETE /users/42           delete user 42
  GET    /users/42/orders    list orders belonging to user 42 (nested resource)

Bad — verbs and non-resource paths:
  GET  /getUsers
  POST /createUser
  POST /deleteUser?id=42
```

### HTTP Status Codes

| Code | Meaning | Typical Use |
|------|---------|-------------|
| 200 OK | Success | Successful GET, PUT, PATCH |
| 201 Created | Resource created | Successful POST that creates something |
| 204 No Content | Success, no body | Successful DELETE |
| 400 Bad Request | Client sent invalid data | Failed validation |
| 401 Unauthorized | No/invalid authentication | Missing or bad token |
| 403 Forbidden | Authenticated but not allowed | Valid user, insufficient permissions |
| 404 Not Found | Resource doesn't exist | GET/PUT/DELETE on a missing ID |
| 409 Conflict | Request conflicts with current state | Duplicate unique field (e.g. email already registered) |
| 422 Unprocessable Entity | Semantically invalid data | Well-formed JSON, but fails business rules |
| 500 Internal Server Error | Unexpected server-side failure | Uncaught exception, database down |

```js
// Applying conventions together
app.post("/users", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email is required" });

  const existing = await findUserByEmail(email);
  if (existing) return res.status(409).json({ error: "email already registered" });

  const user = await createUser(req.body);
  res.status(201).json(user);
});
```

---

## 6. Error-Handling Middleware

Express recognizes error-handling middleware by its **four-argument signature**: `(err, req, res, next)`. It must be registered **after** all other routes and middleware.

```js
// Custom error classes give errors semantic meaning and an intended status code
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiError";
  }
}
class NotFoundError extends ApiError {
  constructor(resource) { super(404, `${resource} not found`); }
}
class ValidationError extends ApiError {
  constructor(message) { super(400, message); }
}

// Async route handlers must forward errors to next() — Express does NOT
// automatically catch rejected promises in older versions (4.x and earlier).
app.get("/users/:id", async (req, res, next) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) throw new NotFoundError("User");
    res.json(user);
  } catch (err) {
    next(err); // hands the error to the centralized error-handling middleware
  }
});

// A small wrapper avoids repeating try/catch in every async handler
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
app.get("/orders/:id", asyncHandler(async (req, res) => {
  const order = await findOrderById(req.params.id);
  if (!order) throw new NotFoundError("Order");
  res.json(order);
}));

// Centralized error-handling middleware — registered LAST, after all routes
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(`[${req.method} ${req.path}]`, err);
  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Catch-all for unmatched routes — registered before the error handler,
// after all real routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});
```

---

## 7. Full Annotated Example: CRUD REST API

A complete in-memory CRUD API for a `tasks` resource, demonstrating everything above working together.

```js
import express from "express";
import { randomUUID } from "crypto";

const app = express();
app.use(express.json());

// In-memory "database" for demonstration — a real app would use MongoDB/SQL (Lesson 3)
let tasks = [
  { id: "1", title: "Learn Express", done: false },
  { id: "2", title: "Build a REST API", done: false },
];

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const tasksRouter = express.Router();

// GET /tasks — list all, with optional ?done=true filter
tasksRouter.get("/", (req, res) => {
  const { done } = req.query;
  let result = tasks;
  if (done !== undefined) {
    result = tasks.filter(t => t.done === (done === "true"));
  }
  res.status(200).json(result);
});

// GET /tasks/:id — fetch one, 404 if missing
tasksRouter.get("/:id", (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) throw new ApiError(404, `Task ${req.params.id} not found`);
  res.status(200).json(task);
});

// POST /tasks — create, 400 if validation fails
tasksRouter.post("/", asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== "string") {
    throw new ApiError(400, "title is required and must be a string");
  }
  const newTask = { id: randomUUID(), title, done: false };
  tasks.push(newTask);
  res.status(201).json(newTask); // 201 Created + the new resource
}));

// PATCH /tasks/:id — partial update
tasksRouter.patch("/:id", (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) throw new ApiError(404, `Task ${req.params.id} not found`);

  const { title, done } = req.body;
  if (title !== undefined) task.title = title;
  if (done !== undefined) task.done = done;

  res.status(200).json(task);
});

// DELETE /tasks/:id — remove, 204 No Content on success
tasksRouter.delete("/:id", (req, res) => {
  const index = tasks.findIndex(t => t.id === req.params.id);
  if (index === -1) throw new ApiError(404, `Task ${req.params.id} not found`);

  tasks.splice(index, 1);
  res.status(204).send(); // no body on 204
});

app.use("/tasks", tasksRouter);

// 404 handler for unmatched routes
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// Centralized error handler — must be registered last
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(err);
  res.status(statusCode).json({ error: err.message || "Internal Server Error" });
});

app.listen(3000, () => console.log("Task API running on port 3000"));
```

### Field-by-Field Breakdown

```
express.Router()
  ↳ Groups related routes under one mount point (/tasks), keeping the
    main app.js free of every individual route definition.

asyncHandler(fn)
  ↳ Wraps async route handlers so a rejected Promise (thrown error inside
    an `await`) is automatically forwarded to next(err) instead of
    crashing the process or hanging the request.

throw new ApiError(404, ...)
  ↳ Thrown synchronously inside a non-async handler — Express's default
    error handling catches synchronous throws automatically and routes
    them to the error-handling middleware without needing asyncHandler.

res.status(201).json(newTask)
  ↳ 201 signals "created", and convention is to return the created
    resource (including its generated id) in the response body.

res.status(204).send()
  ↳ 204 means success with no body — send() with no argument to avoid
    sending an empty JSON object.

app.use((err, req, res, next) => {...})
  ↳ Four parameters is what makes Express treat this as error-handling
    middleware rather than regular middleware — must be LAST in the chain.
```

---

## 8. Hands-On Exercises

**Exercise 1:** Build the `tasks` API from Section 7 and test every endpoint with `curl` or a REST client: create three tasks, list them, filter by `?done=true`, update one with PATCH, delete one, and verify a GET on a deleted or non-existent id returns a 404 with a JSON error body.

**Exercise 2:** Write a custom middleware `requestTimer` that records `Date.now()` when a request starts, and after the response finishes (hook into the `res.on("finish", ...)` event), logs the method, path, status code, and elapsed milliseconds. Apply it globally with `app.use()` before any routes.

**Exercise 3:** Add input validation to the POST `/tasks` route so that `title` must be a non-empty string under 200 characters — return a 400 with a clear error message listing exactly what validation rule failed. Then add a `PUT /tasks/:id` route (full replace, unlike PATCH) that requires both `title` and `done` in the body, returning 400 if either is missing.

**Exercise 4:** Extend the API with a nested resource: `GET /tasks/:id/comments` and `POST /tasks/:id/comments`, storing comments as an array on each task object. Make sure requesting comments for a non-existent task id returns 404 before attempting to read `.comments`.

**Exercise 5:** Add `helmet`, `cors`, and `morgan` to the app. Configure `cors` to only allow requests from `http://localhost:5173` (a typical Vite dev server origin), and configure `morgan` to use the `"dev"` format. Then deliberately trigger a 500 error (e.g. by adding a route that calls `undefinedFunction()`) and confirm your centralized error handler catches it and returns a JSON error response instead of an Express HTML stack trace page.

---

## 9. Interview Q&A

**Q: What is middleware in Express, and what happens if a middleware function forgets to call `next()`?**
Answer: Middleware is any function with the signature `(req, res, next)` that sits in the request-processing pipeline between the incoming request and the final route handler — it can inspect or modify the request/response, perform side effects like logging or authentication, and then either end the response itself or pass control forward by calling `next()`. If a middleware function neither calls `next()` nor sends a response (via `res.send`, `res.json`, `res.end`, etc.), the request hangs indefinitely — the client's connection stays open until it times out, because nothing downstream in the pipeline ever executes and nothing tells Express the request is finished. This is one of the most common Express bugs, especially in conditional logic where a code path forgets the `next()` call.

**Q: Why do async route handlers in older versions of Express need special error handling that synchronous handlers don't?**
Answer: Express's built-in error handling can automatically catch errors thrown *synchronously* inside a route handler and forward them to the error-handling middleware. But if a handler is `async` and an `await`ed call rejects, that rejection becomes a rejected Promise rather than a synchronous throw that Express's call stack can intercept — in Express 4.x and earlier, an unhandled rejection inside an async handler does not automatically reach `next(err)`, so the error is silently swallowed and the request just hangs without a response. The fix is to wrap the handler's logic in a `try/catch` that calls `next(err)` explicitly, or use a generic `asyncHandler` wrapper that converts any rejected promise into a call to `next(err)` automatically. (Express 5 fixes this by catching rejected promises from async handlers automatically.)

**Q: Explain the difference between PUT and PATCH, and why choosing the wrong one is a common REST API mistake.**
Answer: PUT is defined as a full replacement of a resource — the request body should represent the resource's complete new state, and any fields omitted are conventionally expected to be cleared or reset to defaults. PATCH is a partial update — the request body contains only the fields that should change, leaving everything else on the existing resource untouched. A common mistake is using PUT for partial updates: if a client sends `PUT /users/42` with only `{ "email": "new@example.com" }`, a strict RESTful implementation could interpret every other field (name, phone, etc.) as intentionally being cleared, silently destroying data the client never meant to touch. Using PATCH for partial updates makes the intent explicit and avoids this class of bug.

**Q: Why should validation errors return 400 or 422 instead of 500, and why does that distinction matter to API consumers?**
Answer: Status codes in the 4xx range signal that the *client* did something wrong — sent malformed data, omitted a required field, or violated a business rule — and the fix lies in changing the request. Status codes in the 5xx range signal that the *server* failed unexpectedly, through no fault of the client's request, and retrying the exact same request might succeed once the server-side issue is resolved. If a validation failure incorrectly returns 500, client code (and monitoring/alerting systems) may treat it as a server outage requiring investigation or automatic retries, when in fact the request will never succeed until the client fixes its input — conflating the two erodes the API's usefulness as a machine-readable contract and can trigger unnecessary retry storms or false alarms in production monitoring.

**Q: How would you structure error handling in an Express app to avoid repeating try/catch blocks in every route, and why does the position of the error-handling middleware in the app matter?**
Answer: The standard pattern is to define custom `Error` subclasses (like `ApiError`, `NotFoundError`, `ValidationError`) that carry a `statusCode` alongside the message, throw them from anywhere in the business logic, and register exactly one centralized error-handling middleware — recognizable by its four-argument `(err, req, res, next)` signature — that reads `err.statusCode` and formats a consistent JSON error response. To avoid repeating try/catch in every async handler, a small `asyncHandler` wrapper function catches any rejected promise and forwards it to `next(err)` automatically. The error-handling middleware's position matters because Express processes middleware and routes strictly in registration order — if the error handler were registered before the routes, it would never receive errors thrown by routes that haven't been reached yet in the pipeline; it must be the very last thing registered so that every preceding route and middleware has a chance to call `next(err)` and reach it.
