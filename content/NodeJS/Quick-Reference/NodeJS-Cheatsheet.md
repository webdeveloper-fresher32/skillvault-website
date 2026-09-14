# Node.js + Express Cheatsheet

---

### Core Concepts (One-Liners)

- **Node.js** — a runtime that executes JavaScript outside the browser using Google's V8 engine plus **libuv** for async I/O.
- **libuv** — the C library that gives Node its event loop, thread pool (default 4 threads) for filesystem/DNS/crypto, and OS-level async I/O (epoll/kqueue/IOCP).
- **Single-threaded** — your JS callback code runs on one thread; expensive I/O and some crypto/zlib ops are offloaded to libuv's thread pool, not the main thread.
- **CommonJS (CJS)** — `require()`/`module.exports`, synchronous, resolved at runtime, default in `.js` unless `"type": "module"` is set.
- **ESM (ES Modules)** — `import`/`export`, asynchronous, statically analyzable, used in `.mjs` or with `"type": "module"` in `package.json`.
- **Buffer** — a fixed-length chunk of raw binary memory (outside the V8 heap) used for handling binary data (files, sockets, streams).
- **Stream types** — `Readable` (source, e.g. `fs.createReadStream`), `Writable` (sink, e.g. `fs.createWriteStream`), `Duplex` (both, e.g. TCP socket), `Transform` (duplex that modifies data, e.g. `zlib.createGzip`).
- **EventEmitter** — the pub/sub base class (`.on`, `.emit`, `.once`, `.off`) underlying HTTP servers, streams, and most async Node APIs.
- **process** — global object exposing `process.env`, `process.argv`, `process.exit()`, `process.nextTick()`, and lifecycle events (`exit`, `uncaughtException`, `unhandledRejection`).
- **Module resolution** — CJS `require` resolves synchronously walking `node_modules` up the directory tree; ESM resolution is spec-driven and needs explicit file extensions.

---

### npm Command Reference

| Command | Purpose |
|---|---|
| `npm install` (`npm i`) | Install all deps from `package.json`, update `package-lock.json` |
| `npm install <pkg>` | Install and add to `dependencies` |
| `npm install -D <pkg>` (`--save-dev`) | Install and add to `devDependencies` |
| `npm install -g <pkg>` | Install globally |
| `npm ci` | Clean install strictly from `package-lock.json`; deletes `node_modules` first — used in CI for reproducible, fast installs |
| `npm uninstall <pkg>` | Remove a package |
| `npm update` | Update packages within semver ranges in `package.json` |
| `npm outdated` | List installed vs latest/wanted versions |
| `npm run <script>` | Run a script defined in `package.json` `"scripts"` |
| `npm start` / `npm test` | Shorthand for `run start` / `run test` |
| `npm audit` / `npm audit fix` | Scan for known vulnerabilities / auto-patch |
| `npm publish` | Publish package to registry |
| `npm version patch\|minor\|major` | Bump version in `package.json`, create git tag |
| `npm link` | Symlink a local package for local dev testing |
| `npm ls` | List installed dependency tree |
| `npx <pkg>` | Execute a package binary without installing it globally |

**Semver ranges:** `^1.2.3` = compatible (minor+patch), `~1.2.3` = patch only, `1.2.3` = exact, `*`/`latest` = any.

---

### Event Loop Phases & Task Priority

```
   ┌───────────────────────────┐
┌─>│           timers          │  setTimeout, setInterval callbacks
│  ├───────────────────────────┤
│  │     pending callbacks     │  deferred I/O callbacks (e.g. some TCP errors)
│  ├───────────────────────────┤
│  │       idle, prepare       │  internal use
│  ├───────────────────────────┤
│  │           poll            │  fetch new I/O events; execute I/O callbacks
│  ├───────────────────────────┤
│  │           check           │  setImmediate callbacks
│  ├───────────────────────────┤
│  │      close callbacks      │  socket.on('close', ...)
│  └───────────────────────────┘
   (loop repeats while event loop has work)
```

**Microtask/macrotask priority (highest to lowest), drained between every phase transition and after every callback:**

```
1. process.nextTick() queue     — Node-specific, always first
2. Promise microtask queue      — .then/.catch/.finally, async/await continuations
3. setTimeout / setInterval     — macrotask (timers phase)
4. setImmediate                 — macrotask (check phase, after poll)
5. I/O callbacks                — macrotask (poll phase)
```

Rule of thumb: `process.nextTick` > Promises > `setTimeout(fn, 0)` ≈ `setImmediate` (order between the last two is non-deterministic outside an I/O callback; inside an I/O callback, `setImmediate` always fires before `setTimeout`).

---

### Express Essentials

**App methods**

| Method | Purpose |
|---|---|
| `app.get/post/put/patch/delete(path, ...handlers)` | Register route handler for an HTTP verb |
| `app.all(path, handler)` | Match any HTTP verb |
| `app.use([path,] middleware)` | Mount middleware (or sub-router) |
| `app.route(path).get().post()` | Chainable route definitions for one path |
| `app.param(name, cb)` | Middleware that runs when a route param is matched |
| `app.set(name, value)` | Set an app setting (e.g. `'view engine'`) |
| `app.listen(port, cb)` | Start the HTTP server |
| `Router()` | Create a modular, mountable route handler |

**Common middleware**

| Middleware | Purpose |
|---|---|
| `express.json()` | Parse `application/json` request bodies |
| `express.urlencoded({extended:true})` | Parse form-encoded bodies |
| `express.static(dir)` | Serve static files |
| `cors()` | Enable Cross-Origin Resource Sharing |
| `helmet()` | Set security-related HTTP headers |
| `morgan('dev')` | HTTP request logger |
| `cookie-parser` | Parse `Cookie` header into `req.cookies` |
| custom error handler `(err, req, res, next)` | 4-arg signature signals Express to treat it as an error handler |

**req / res cheat table**

| Object | Property/Method | Meaning |
|---|---|---|
| `req` | `.params` | Route params (`/users/:id` → `req.params.id`) |
| `req` | `.query` | Query string (`?a=1` → `req.query.a`) |
| `req` | `.body` | Parsed request body (needs body-parsing middleware) |
| `req` | `.headers` | Request headers object |
| `req` | `.method`, `.path`, `.originalUrl` | Verb, path, full URL |
| `res` | `.status(code)` | Set HTTP status code (chainable) |
| `res` | `.json(obj)` | Send JSON response |
| `res` | `.send(body)` | Send response (string/Buffer/object) |
| `res` | `.redirect(url)` | 302 redirect |
| `res` | `.set(header, val)` | Set a response header |
| `res` | `.cookie(name, val, opts)` | Set a cookie |
| `next` | `next()` / `next(err)` | Pass control to next middleware / trigger error handler |

---

### HTTP Status Codes (Most Common)

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 301/302 | Moved Permanently / Found (redirect) |
| 304 | Not Modified (cache) |
| 400 | Bad Request |
| 401 | Unauthorized (no/invalid auth) |
| 403 | Forbidden (authenticated, not allowed) |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 409 | Conflict (e.g. duplicate resource) |
| 422 | Unprocessable Entity (validation failure) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |
| 502 | Bad Gateway |
| 503 | Service Unavailable |

---

### JWT vs Session-Based Auth

| Aspect | JWT | Session |
|---|---|---|
| State | Stateless — token holds claims | Stateful — server stores session data |
| Storage | Client (localStorage/cookie) | Server (memory/Redis/DB) + session ID cookie on client |
| Scaling | Easy horizontal scale, no shared store needed | Needs shared session store across instances |
| Revocation | Hard (must blacklist/short expiry) | Easy — delete session server-side |
| Payload size | Larger (sent every request) | Small (just an opaque ID) |
| Typical use | APIs, mobile, microservices, SPA + API | Traditional server-rendered web apps |

---

### Common npm Packages

| Package | Purpose |
|---|---|
| `express` | Minimal HTTP/web framework for routing & middleware |
| `mongoose` | ODM for MongoDB — schemas, validation, models |
| `prisma` | Type-safe ORM/query builder for SQL databases |
| `jsonwebtoken` | Create/verify JWTs |
| `bcrypt` | Hash and compare passwords (salted hashing) |
| `jest` | Test runner, assertions, mocking, coverage |
| `supertest` | HTTP assertions for testing Express endpoints |
| `joi` / `zod` | Schema-based request/data validation |
| `dotenv` | Load `.env` file into `process.env` |
| `cors` | Configure Cross-Origin Resource Sharing headers |
| `helmet` | Set secure HTTP headers (CSP, HSTS, etc.) |
| `express-rate-limit` | Rate-limit requests per IP/key |
| `socket.io` | Real-time, bidirectional WebSocket communication |
| `winston` / `pino` | Structured, leveled application logging |
