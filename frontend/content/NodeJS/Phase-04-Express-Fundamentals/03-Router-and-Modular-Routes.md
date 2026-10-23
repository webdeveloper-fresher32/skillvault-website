# Router and Modular Routes — Complete Guide

## Table of Contents
1. [The Problem: One Giant `server.js`](#1-the-problem-one-giant-serverjs)
2. [`express.Router()` Basics](#2-expressrouter-basics)
3. [Organizing Routes into Files](#3-organizing-routes-into-files)
4. [Route-Level Middleware](#4-route-level-middleware)
5. [Nested Routers](#5-nested-routers)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: One Giant `server.js`

Small apps put everything in one file. As routes grow, that file becomes unmaintainable:

```javascript
// server.js — DON'T do this at scale
app.get('/users', ...);
app.get('/users/:id', ...);
app.post('/users', ...);
app.get('/posts', ...);
app.get('/posts/:id', ...);
app.post('/posts', ...);
app.get('/comments', ...);
// ... 50 more routes, all in one 2000-line file
```

Production Express apps mirror how a Python/Flask project uses **Blueprints**, or how a React app splits pages into separate files/folders — each resource gets its own route module.

---

## 2. `express.Router()` Basics

`express.Router()` creates a mini, self-contained Express app — it supports its own middleware and routes, and can be "mounted" onto a path in the main app.

```javascript
// routes/users.js
const express = require('express');
const router = express.Router(); // mini-app

let users = [{ id: 1, name: 'Alice' }];

router.get('/', (req, res) => {
  res.json(users);
});

router.get('/:id', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

router.post('/', (req, res) => {
  const newUser = { id: users.length + 1, name: req.body.name };
  users.push(newUser);
  res.status(201).json(newUser);
});

module.exports = router;
```

```javascript
// server.js
const express = require('express');
const usersRouter = require('./routes/users');

const app = express();
app.use(express.json());

app.use('/users', usersRouter); // mount the router at /users

app.listen(3000);
```

Note that routes *inside* `routes/users.js` are defined relative to the mount path:

```
router.get('/')      +  app.use('/users', router)  →  GET  /users
router.get('/:id')   +  app.use('/users', router)  →  GET  /users/:id
router.post('/')     +  app.use('/users', router)  →  POST /users
```

---

## 3. Organizing Routes into Files

A typical modular Express project layout:

```
project/
├── server.js               # entry point — mounts routers
├── routes/
│   ├── users.js
│   ├── posts.js
│   └── comments.js
├── controllers/            # optional: extract handler logic from routes
│   ├── userController.js
│   └── postController.js
└── middleware/
    ├── auth.js
    └── errorHandler.js
```

Separating **routes** (URL → handler mapping) from **controllers** (actual handler logic) keeps files small and testable — similar to Flask's view functions or a Django/DRF ViewSet separated from `urls.py`.

```javascript
// controllers/userController.js
let users = [{ id: 1, name: 'Alice' }];

exports.getAllUsers = (req, res) => {
  res.json(users);
};

exports.getUserById = (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
};

exports.createUser = (req, res) => {
  const newUser = { id: users.length + 1, name: req.body.name };
  users.push(newUser);
  res.status(201).json(newUser);
};
```

```javascript
// routes/users.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);

module.exports = router;
```

```javascript
// server.js
const express = require('express');
const usersRouter = require('./routes/users');
const postsRouter = require('./routes/posts');

const app = express();
app.use(express.json());

app.use('/users', usersRouter);
app.use('/posts', postsRouter);

app.listen(3000, () => console.log('Listening on port 3000'));
```

---

## 4. Route-Level Middleware

A `Router` can have its own middleware, applied via `router.use()`, scoping it to only routes mounted under that router — without affecting the rest of the app.

```javascript
// middleware/auth.js
function requireAuth(req, res, next) {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}
module.exports = { requireAuth };
```

```javascript
// routes/orders.js
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth); // applies to EVERY route below, only within this router

router.get('/', (req, res) => res.json({ orders: [] }));
router.post('/', (req, res) => res.status(201).json({ message: 'Order created' }));

module.exports = router;
```

You can also attach middleware to a single route only:

```javascript
router.get('/:id', requireAuth, validateOrderId, (req, res) => {
  res.json({ orderId: req.params.id });
});
```

---

## 5. Nested Routers

Routers can be nested — useful for resources belonging to a parent (e.g., `/users/:userId/posts`). Use `{ mergeParams: true }` so a nested router can access params from its parent router's path.

```javascript
// routes/posts.js — nested under /users/:userId/posts
const express = require('express');
const router = express.Router({ mergeParams: true }); // needed to access :userId

router.get('/', (req, res) => {
  // req.params.userId is available here because of mergeParams: true
  res.json({ userId: req.params.userId, posts: [] });
});

router.post('/', (req, res) => {
  res.status(201).json({ userId: req.params.userId, title: req.body.title });
});

module.exports = router;
```

```javascript
// routes/users.js
const express = require('express');
const router = express.Router();
const postsRouter = require('./posts');

router.get('/:userId', (req, res) => {
  res.json({ userId: req.params.userId });
});

// Nest: any request to /users/:userId/posts/* is delegated to postsRouter
router.use('/:userId/posts', postsRouter);

module.exports = router;
```

```javascript
// server.js
app.use('/users', usersRouter);
// GET /users/5/posts  → resolved by postsRouter, req.params.userId === '5'
```

Mounting diagram:

```
app  ──use('/users')──▶  usersRouter
                              │
                              └──use('/:userId/posts')──▶  postsRouter (mergeParams: true)
                                                                  │
                                                          req.params = { userId, ... }

Request: GET /users/5/posts/12
  app        matches '/users'         → delegates rest ('/5/posts/12') to usersRouter
  usersRouter matches '/:userId/posts' → delegates rest ('/12') to postsRouter, userId='5'
  postsRouter matches '/:id'           → final handler runs with { userId: '5', id: '12' }
```

---

## 6. Hands-On Exercises

**Exercise 1:** Create `routes/products.js` using `express.Router()` with `GET /`, `GET /:id`, `POST /`. Mount it in `server.js` at `/products`. Verify `curl http://localhost:3000/products` works.

**Exercise 2:** Refactor Exercise 1 by moving the handler logic into `controllers/productController.js`, keeping `routes/products.js` as pure route-to-controller mapping.

**Exercise 3:** Write a `middleware/auth.js` with `requireAuth`, apply it via `router.use()` inside `routes/orders.js` only — confirm `/orders` requires the header but `/products` does not.

**Exercise 4:** Build a nested router: `/stores/:storeId/products` where the nested `products` router uses `{ mergeParams: true }` to read `storeId` alongside its own `:id` param.

**Exercise 5:** Add a `router.use()` logging middleware inside just one router (e.g., `orders.js`) that prints a message only for requests to that resource, and confirm other routers' requests are unaffected.

---

## 7. Interview Q&A

**Q: What is `express.Router()` and why use it?**
Answer: `express.Router()` creates a mini, self-contained instance of an Express app — it can define its own routes and middleware. It's used to split a large route table into separate, per-resource files (e.g., `routes/users.js`, `routes/posts.js`), which the main `app` mounts with `app.use('/path', router)`. This keeps large applications organized and modular, similar to Flask Blueprints.

**Q: How does mounting a router affect the paths defined inside it?**
Answer: Routes defined inside a router are relative to its mount path. If a router defines `router.get('/:id', ...)` and is mounted with `app.use('/users', router)`, the effective route becomes `GET /users/:id`. The router itself has no knowledge of the mount path — it just handles whatever remains after the mount prefix is stripped.

**Q: What is `mergeParams: true` used for?**
Answer: By default, a nested router cannot see route params defined by its parent router (e.g., `:userId` from `/users/:userId/posts`). Passing `{ mergeParams: true }` to `express.Router()` makes the child router inherit the parent's `req.params`, which is required for nested resource routes like `/users/:userId/posts/:postId`.

**Q: How do you apply middleware to only some routes within a router?**
Answer: Either call `router.use(middleware)` to apply it to all routes defined after that line within that router, or pass the middleware as an extra argument directly to a specific route: `router.get('/:id', requireAuth, handler)`. This scopes the middleware without affecting other routers mounted elsewhere in the app.

**Q: Why separate "routes" from "controllers" in an Express project?**
Answer: Routes define the URL-to-handler mapping (the "what path triggers what"), while controllers contain the actual business logic. Separating them keeps route files small and declarative, makes handler logic independently unit-testable (you can call a controller function directly without spinning up an HTTP server), and mirrors familiar patterns like Django views or DRF ViewSets separated from `urls.py`.

**Q: What happens if two routers both handle overlapping paths?**
Answer: Express matches middleware/routers in registration order and uses the first one that matches, calling `next()` internally to fall through if a router doesn't fully handle the request. If a router mounted earlier calls `res.send()`/`res.json()` for a matching path, later routers/routes for that same path are never reached — so route/router registration order still matters even across files.
