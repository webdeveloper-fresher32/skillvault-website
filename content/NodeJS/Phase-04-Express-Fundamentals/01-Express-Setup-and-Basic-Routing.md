# Express Setup and Basic Routing — Complete Guide

## Table of Contents
1. [Why Express Instead of Raw `http`](#1-why-express-instead-of-raw-http)
2. [Installing and Bootstrapping Express](#2-installing-and-bootstrapping-express)
3. [Basic Routing: GET/POST/PUT/DELETE](#3-basic-routing-getpostputdelete)
4. [Route Parameters](#4-route-parameters)
5. [Query Strings](#5-query-strings)
6. [Key `req`/`res` Methods](#6-key-reqres-methods)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Express Instead of Raw `http`

In Phase 03 you built servers with Node's built-in `http` module — manually parsing URLs, checking `req.method`, and writing headers by hand. That works, but it doesn't scale:

```
Raw http module (Phase 03):
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/users') { ... }
    else if (req.method === 'GET' && req.url.startsWith('/users/')) { ... }
    else if (req.method === 'POST' && req.url === '/users') { ... }
    else { res.statusCode = 404; res.end('Not found'); }
  });
  → every route is a manual if/else branch, no route params, no middleware
```

Express is a thin, unopinionated layer on top of `http` that gives you:
- A **declarative routing API** (`app.get('/users/:id', handler)`)
- **Middleware** — composable functions that run before your route handler
- Convenience methods on `req`/`res` (`res.json()`, `req.params`, `req.query`, etc.)

If you know Flask or Express-like decorators from Python (`@app.route('/users/<id>')`), the mental model transfers almost 1:1.

---

## 2. Installing and Bootstrapping Express

```bash
mkdir my-express-app && cd my-express-app
npm init -y
npm install express
```

Minimal server:

```javascript
// server.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
```

Run it:

```bash
node server.js
# Server listening on http://localhost:3000
```

```
express()  →  creates an "app" object (like Flask's app = Flask(__name__))
app.get()  →  registers a route handler for GET requests
app.listen() →  starts the underlying http server on a port
```

Under the hood, `app` is still backed by Node's `http.createServer` — Express just wraps it:

```javascript
// This is roughly what app.listen(3000) does internally
const http = require('http');
http.createServer(app).listen(3000);
// `app` itself is a callback function: (req, res) => { ... }
```

---

## 3. Basic Routing: GET/POST/PUT/DELETE

Express maps HTTP methods directly to `app` methods:

```javascript
const express = require('express');
const app = express();

app.use(express.json()); // needed to parse JSON request bodies (see Phase 04-02)

// In-memory "database" for demonstration
let users = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

// GET — list all users
app.get('/users', (req, res) => {
  res.json(users);
});

// POST — create a user
app.post('/users', (req, res) => {
  const newUser = { id: users.length + 1, name: req.body.name };
  users.push(newUser);
  res.status(201).json(newUser);
});

// PUT — replace/update a user
app.put('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.name = req.body.name;
  res.json(user);
});

// DELETE — remove a user
app.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  users = users.filter((u) => u.id !== id);
  res.status(204).end(); // 204 No Content — success, no body
});

app.listen(3000, () => console.log('Listening on port 3000'));
```

| HTTP Method | Express Method | Typical Use |
|-------------|-----------------|-------------|
| GET | `app.get()` | Read/fetch a resource |
| POST | `app.post()` | Create a new resource |
| PUT | `app.put()` | Replace an entire resource |
| PATCH | `app.patch()` | Partially update a resource |
| DELETE | `app.delete()` | Remove a resource |
| ALL | `app.all()` | Match any HTTP method |

---

## 4. Route Parameters

Route parameters (`:name`) capture dynamic segments of the URL path — Express parses them into `req.params`:

```javascript
// Single param
app.get('/users/:id', (req, res) => {
  res.json({ requestedId: req.params.id }); // req.params = { id: '42' }
});

// Multiple params
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
});
// GET /users/7/posts/99  →  { userId: '7', postId: '99' }
```

Note: `req.params` values are always **strings** — convert with `Number()` when you need numeric comparisons (as shown in the PUT example above).

Optional/wildcard-style params (Express 5 syntax):

```javascript
// Optional param — matches /files and /files/report
app.get('/files{/:name}', (req, res) => {
  res.send(req.params.name ? `File: ${req.params.name}` : 'Listing all files');
});
```

```
Route pattern:   /users/:userId/posts/:postId
Incoming URL:    /users/7/posts/99
                   │              │
                   ▼              ▼
             params.userId   params.postId
                = '7'           = '99'
```

---

## 5. Query Strings

Query strings (`?key=value&key2=value2`) are parsed into `req.query`, independent of route params:

```javascript
// GET /search?q=express&page=2&sort=asc
app.get('/search', (req, res) => {
  const { q, page = 1, sort = 'desc' } = req.query;
  res.json({ query: q, page: Number(page), sort });
});
// req.query = { q: 'express', page: '2', sort: 'asc' }
```

Route params vs query strings:

| | Route Param | Query String |
|---|---|---|
| Syntax | `/users/:id` | `/users?id=5` |
| Purpose | Identify a specific resource | Filter, sort, paginate, search |
| Access | `req.params` | `req.query` |
| Required? | Usually yes (part of the path) | Usually optional |
| Example | `/users/42` | `/users?active=true&limit=10` |

---

## 6. Key `req`/`res` Methods

```javascript
app.get('/demo', (req, res) => {
  // --- Common req properties ---
  console.log(req.method);   // 'GET'
  console.log(req.url);      // '/demo'
  console.log(req.headers);  // { host: 'localhost:3000', ... }
  console.log(req.params);   // route params object
  console.log(req.query);    // query string object
  console.log(req.body);     // parsed body (needs express.json() middleware)

  // --- Common res methods ---
  res.status(200);           // set status code (chainable)
  res.json({ ok: true });    // send JSON, sets Content-Type automatically, ends response
  // res.send('plain text');  // send string/buffer/object; less strict than res.json
  // res.sendStatus(404);     // shortcut: sets status AND sends its text as body
  // res.redirect('/login');  // 302 redirect
  // res.end();               // end response with no body
});
```

| Method | Purpose |
|--------|---------|
| `res.status(code)` | Sets the HTTP status code; returns `res` for chaining |
| `res.json(obj)` | Serializes `obj` to JSON, sets `Content-Type: application/json`, sends response |
| `res.send(data)` | Sends a string, Buffer, or object (auto-detects content type) |
| `res.sendStatus(code)` | Sets status and sends the status text as the body (e.g., `res.sendStatus(404)` → body `"Not Found"`) |
| `res.redirect(url)` | Sends a redirect response (default 302) |
| `res.set(header, value)` | Sets a response header |
| `res.end()` | Ends the response without any data |

Chaining is idiomatic Express:

```javascript
app.post('/users', (req, res) => {
  if (!req.body.name) {
    return res.status(400).json({ error: 'name is required' });
  }
  res.status(201).json({ id: 3, name: req.body.name });
});
```

---

## 7. Hands-On Exercises

**Exercise 1:** Create a new Express app with `npm init -y && npm install express`. Add a single `GET /` route that returns `res.send('Hello Express')`. Verify with `curl http://localhost:3000`.

**Exercise 2:** Build an in-memory `/books` resource (array of `{ id, title, author }`) with full CRUD: `GET /books`, `GET /books/:id`, `POST /books`, `PUT /books/:id`, `DELETE /books/:id`. Use `res.status()` correctly for each case (200, 201, 204, 404).

**Exercise 3:** Add a `GET /books/search?author=&title=` route that filters the in-memory array using `req.query`. Test with `curl "http://localhost:3000/books/search?author=Tolkien"`.

**Exercise 4:** Add a route `GET /users/:userId/orders/:orderId` that returns both params as JSON. Confirm both `req.params.userId` and `req.params.orderId` are strings, not numbers.

**Exercise 5:** Deliberately request a `POST /books` without a `title` in the body and return a `400` with a JSON error message — practice the "validate, then respond early" pattern.

---

## 8. Interview Q&A

**Q: What is Express and why use it over the raw `http` module?**
Answer: Express is a minimal, unopinionated web framework built on top of Node's `http` module. It adds declarative routing (`app.get/post/put/delete`), a composable middleware pipeline, and convenience methods on `req`/`res` (like `res.json()`, `req.params`). Raw `http` requires manually branching on `req.method`/`req.url` and writing headers by hand — Express eliminates that boilerplate and is the de-facto standard for Node backends.

**Q: What is the difference between route parameters and query strings?**
Answer: Route parameters (`/users/:id`) are part of the URL path and identify a specific resource — accessed via `req.params`. Query strings (`/users?active=true`) come after `?` and are typically used for optional filtering, sorting, or pagination — accessed via `req.query`. Both are always parsed as strings.

**Q: What's the difference between `res.send()` and `res.json()`?**
Answer: `res.json()` always serializes the argument to a JSON string and sets `Content-Type: application/json`. `res.send()` is more general — it accepts strings, Buffers, or objects, and infers the content type (if given an object, it internally calls `res.json()` anyway). In practice, use `res.json()` for API responses for explicitness.

**Q: Why does `res.status(201).json(user)` work — how does chaining happen?**
Answer: Most `res` methods that don't end the response (like `res.status()`, `res.set()`) return the `res` object itself, enabling a fluent/chainable API. `res.json()` and `res.send()` end the chain because they actually write and finish the response.

**Q: How would you handle a route param that should be a number, like `/users/:id`?**
Answer: `req.params.id` is always a string regardless of the URL looking numeric. Convert explicitly with `Number(req.params.id)` or `parseInt(req.params.id, 10)` before using it in comparisons or database queries, and validate that it's not `NaN`.

**Q: What status code should `DELETE` and `POST` typically return?**
Answer: `POST` that creates a resource typically returns `201 Created` along with the created resource in the body. `DELETE` that succeeds typically returns `204 No Content` with an empty body, since there's nothing meaningful left to return.
