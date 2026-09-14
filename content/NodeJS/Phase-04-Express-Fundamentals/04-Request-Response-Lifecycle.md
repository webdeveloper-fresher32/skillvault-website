# Request-Response Lifecycle — Complete Guide

## Table of Contents
1. [The Full Lifecycle, End to End](#1-the-full-lifecycle-end-to-end)
2. [Lifecycle Diagram](#2-lifecycle-diagram)
3. [`req` Object Reference](#3-req-object-reference)
4. [`res` Object Reference](#4-res-object-reference)
5. [`res.locals`](#5-reslocals)
6. [Chaining and Ending Responses](#6-chaining-and-ending-responses)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Full Lifecycle, End to End

Every HTTP request to an Express app goes through the same conceptual pipeline, regardless of how many middleware/routers you've added:

1. **TCP connection accepted** by Node's underlying `http.Server`.
2. **Express wraps** the raw Node `req`/`res` objects, adding its own methods/properties.
3. **Application-level middleware** (`app.use(...)`) runs in registration order.
4. **Router matching** — Express walks the route table top-to-bottom looking for a path+method match.
5. **Router-level middleware** (`router.use(...)`) runs for the matched router.
6. **Route-specific middleware** (extra args before the final handler) runs.
7. **Route handler** executes — reads `req`, does work (DB calls, business logic), calls a `res` method.
8. **Response sent** — headers + body written to the socket; the cycle ends.
9. If any error occurs at any step, control jumps to the nearest **error-handling middleware** instead of continuing normally.
10. If nothing matches, a fallback/404 handler (if present) generates the response.

This is the same conceptual model used by nearly every server-side web framework (Django middleware stack, Flask's request context, ASP.NET pipeline) — Express just makes the pipeline explicit as ordinary functions.

---

## 2. Lifecycle Diagram

```
                          Client (browser / React app / curl)
                                       │
                                       │  HTTP Request
                                       ▼
                     ┌─────────────────────────────────────┐
                     │   Node http.Server (TCP + parsing)   │
                     └─────────────────────────────────────┘
                                       │
                                       ▼
                     ┌─────────────────────────────────────┐
                     │      Express wraps req / res          │
                     └─────────────────────────────────────┘
                                       │
                                       ▼
              ┌────────────────────────────────────────────────┐
              │  App-level middleware (app.use)                 │
              │  express.json() → cors() → helmet() → logger    │
              └────────────────────────────────────────────────┘
                                       │  next()
                                       ▼
              ┌────────────────────────────────────────────────┐
              │  Route matching (method + path)                 │
              └────────────────────────────────────────────────┘
                                       │
                                       ▼
              ┌────────────────────────────────────────────────┐
              │  Router-level middleware (router.use)           │
              └────────────────────────────────────────────────┘
                                       │  next()
                                       ▼
              ┌────────────────────────────────────────────────┐
              │  Route-specific middleware (auth, validation)   │
              └────────────────────────────────────────────────┘
                                       │  next()
                                       ▼
              ┌────────────────────────────────────────────────┐
              │  Route handler  (req, res) => { ... }           │
              │     res.json() / res.send() / res.render()      │
              └────────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┴───────────────────┐
                    │ success path                          │ throws / next(err)
                    ▼                                        ▼
        ┌───────────────────────┐            ┌──────────────────────────────┐
        │ Response written to    │            │ Error-handling middleware     │
        │ socket, cycle ends     │            │ (err, req, res, next)         │
        └───────────────────────┘            └──────────────────────────────┘
                    │                                        │
                    ▼                                        ▼
                Client receives response            Client receives error response
```

If no route matches at all, the request falls through every registered route/router without any handler calling `res.send()`, ultimately hitting Express's default 404 handler (or your own catch-all middleware if you added one at the end).

---

## 3. `req` Object Reference

| Property/Method | Description | Example |
|------------------|-------------|---------|
| `req.method` | HTTP method | `'GET'`, `'POST'` |
| `req.url` | Path + query string as received | `'/users?active=true'` |
| `req.path` | Path only, no query string | `'/users'` |
| `req.params` | Route param values | `{ id: '42' }` |
| `req.query` | Parsed query string | `{ active: 'true' }` |
| `req.body` | Parsed request body (needs `express.json()`/`urlencoded()`) | `{ name: 'Alice' }` |
| `req.headers` | All request headers (lowercased keys) | `{ 'content-type': 'application/json' }` |
| `req.get(header)` | Case-insensitive single header lookup | `req.get('Content-Type')` |
| `req.cookies` | Parsed cookies (needs `cookie-parser` middleware) | `{ sessionId: 'abc' }` |
| `req.ip` | Client IP address | `'127.0.0.1'` |
| `req.hostname` | Host header value, without port | `'api.example.com'` |
| `req.protocol` | `'http'` or `'https'` | `'https'` |
| `req.secure` | `true` if `req.protocol === 'https'` | `true`/`false` |
| `req.xhr` | `true` if `X-Requested-With: XMLHttpRequest` | useful for legacy AJAX detection |

---

## 4. `res` Object Reference

| Property/Method | Description |
|------------------|-------------|
| `res.status(code)` | Sets HTTP status code; chainable |
| `res.json(obj)` | Sends a JSON response, ends the cycle |
| `res.send(data)` | Sends string/Buffer/object, ends the cycle |
| `res.sendStatus(code)` | Sets status + sends status text as body |
| `res.redirect([status,] url)` | Sends a redirect (default 302) |
| `res.set(header, value)` / `res.header(...)` | Sets a response header |
| `res.get(header)` | Reads a response header already set |
| `res.cookie(name, value, opts)` | Sets a cookie via `Set-Cookie` header |
| `res.clearCookie(name)` | Removes a cookie |
| `res.render(view, data)` | Renders a templating-engine view (see Lesson 05) |
| `res.locals` | Object scoped to the request/response cycle for passing data to views |
| `res.headersSent` | `true` once headers have already been sent (guards against double-send errors) |
| `res.end([data])` | Ends the response, optionally with raw data, without content-type inference |

---

## 5. `res.locals`

`res.locals` is an object that lives for the duration of a single request-response cycle. It's the standard way for one middleware to hand data to a later middleware or to a rendered view, without polluting `req.body`/`req.params` or attaching arbitrary properties to `req`.

```javascript
const express = require('express');
const app = express();

// Middleware 1: attaches computed data
app.use((req, res, next) => {
  res.locals.requestId = Math.random().toString(36).slice(2, 10);
  res.locals.startTime = Date.now();
  next();
});

// Middleware 2: uses data set by middleware 1
app.use((req, res, next) => {
  console.log(`[${res.locals.requestId}] handling ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  // res.locals is also automatically available inside res.render() views
  res.json({
    requestId: res.locals.requestId,
    tookMs: Date.now() - res.locals.startTime,
  });
});

app.listen(3000);
```

`res.locals` vs attaching to `req` directly:

```
req.someProp = value    →  common convention for data derived FROM the request
                            (e.g., req.user set by an auth middleware)

res.locals.someProp = value → common convention for data destined for the RESPONSE
                            (e.g., values a template will render, or response metadata)

Both are just properties on the same objects — the distinction is purely convention.
```

---

## 6. Chaining and Ending Responses

Only **one** terminating call (`res.send`, `res.json`, `res.end`, `res.redirect`, `res.render`) is allowed per request. Calling a second one throws `Error: Cannot set headers after they are sent to the client` — one of the most common Express runtime errors.

```javascript
// ❌ BUG: forgetting `return` causes a double response
app.get('/users/:id', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    res.status(404).json({ error: 'Not found' }); // sends response...
  }
  res.json(user); // ...but this ALSO runs and tries to send again → crash if user is undefined
});

// ✅ FIX: always `return` after sending in a branch
app.get('/users/:id', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'Not found' }); // stops execution here
  }
  res.json(user);
});
```

Chainable (non-terminating) methods can be stacked before the terminating call:

```javascript
res
  .status(201)
  .set('X-Custom-Header', 'value')
  .cookie('sessionId', 'abc123', { httpOnly: true })
  .json({ message: 'created' }); // terminates the chain
```

---

## 7. Hands-On Exercises

**Exercise 1:** Write a middleware that sets `res.locals.requestId` to a random string, then log it inside two subsequent middleware functions and a final route handler — confirm all three see the same value.

**Exercise 2:** Deliberately write a route with the double-response bug (missing `return` in an if-branch) and reproduce the "Cannot set headers after they are sent" error. Then fix it.

**Exercise 3:** Build a route that logs every property in the `req` reference table above (`method`, `path`, `params`, `query`, `headers`, `ip`) for a single incoming request, to see them all populated at once.

**Exercise 4:** Chain `res.status(201).set('X-Custom', 'test').json({ ok: true })` in a route and verify with `curl -i` that both the status code and the custom header appear.

**Exercise 5:** Draw (on paper or in a comment block) the full lifecycle diagram from memory for a `POST /orders` request that passes through a logger, a body parser, an auth middleware, and a route handler — labeling where `next()` is called at each step.

---

## 8. Interview Q&A

**Q: Walk through the full lifecycle of a request in Express, from socket to response.**
Answer: The raw TCP request is accepted by Node's `http.Server`; Express wraps the native `req`/`res` with its own methods. The request flows through app-level middleware in registration order, then Express matches it against registered routes/routers, running any router-level and route-specific middleware, before finally reaching the route handler, which sends the response via `res.json()`/`res.send()`. If an error is thrown or `next(err)` is called at any point, control jumps to error-handling middleware instead of continuing the normal chain.

**Q: What is `res.locals` used for, and how is it different from setting a property on `req`?**
Answer: `res.locals` is an object scoped to a single request-response cycle, conventionally used to pass computed data forward to later middleware or to a rendered view (e.g., `res.render()` templates can read `locals` directly). Properties on `req` (like `req.user`) are conventionally used for data derived from parsing the incoming request. Functionally both are just plain object properties — the difference is convention, not enforcement.

**Q: What causes the "Cannot set headers after they are sent to the client" error, and how do you prevent it?**
Answer: It happens when a response-terminating method (`res.send`, `res.json`, `res.end`, `res.redirect`) is called more than once for the same request — typically from a missing `return` in an if/else branch, letting execution fall through to a second terminating call. Prevent it by always `return`-ing immediately after sending a response inside a conditional branch.

**Q: What's the difference between `req.url` and `req.path`?**
Answer: `req.url` is the full path plus query string as sent by the client (e.g., `/users?active=true`). `req.path` is just the path portion, with the query string stripped (`/users`). Use `req.path` when you only care about the route, and `req.query` (already parsed) rather than manually parsing `req.url`'s query string.

**Q: Why must error-handling middleware be registered after all routes?**
Answer: Express dispatches middleware/routes strictly in registration order for a matching request. Error-handling middleware only gets invoked via `next(err)` calls that occur in middleware/routes registered *before* it — anything registered after it in the chain is never reached if an earlier handler already threw/forwarded an error. Registering it last ensures it can catch errors from anywhere earlier in the pipeline.

**Q: Can a single response have multiple headers set and still be one terminating call?**
Answer: Yes — non-terminating methods like `res.status()`, `res.set()`, and `res.cookie()` return `res` for chaining and only mutate response metadata; only one terminating call (`res.send`/`res.json`/`res.end`/`res.redirect`/`res.render`) is allowed, and it should come last in the chain.
