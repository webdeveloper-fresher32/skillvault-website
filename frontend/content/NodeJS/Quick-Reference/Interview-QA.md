# Node.js + Express Interview Q&A

50 questions covering the full Node.js course, organized by topic.

---

## Node Fundamentals & Modules (Q1–Q8)

**Q1. What is Node.js and why is it well-suited for I/O-heavy applications?**
Answer: Node.js is a JavaScript runtime built on Google's V8 engine that executes JS outside the browser, paired with libuv to provide an event-driven, non-blocking I/O model. Instead of spawning a new OS thread per request (as many traditional server stacks do), Node runs application code on a single main thread and delegates I/O operations (network, disk, DNS) to the OS or a background thread pool, resuming JS callbacks when results are ready. This makes Node extremely efficient for I/O-bound workloads like APIs, real-time apps, and proxies, since it can handle thousands of concurrent connections without the memory overhead of thread-per-connection models. It is less ideal for CPU-bound work, since heavy synchronous computation blocks the single JS thread.

---

**Q2. What is the difference between CommonJS and ES Modules in Node?**
Answer: CommonJS (CJS) is Node's original module system using `require()` and `module.exports`; it resolves and loads modules synchronously at runtime, so `require` calls can be conditional or dynamic anywhere in code. ES Modules (ESM), enabled via `"type": "module"` in `package.json` or `.mjs` files, use `import`/`export` syntax, are statically analyzed at parse time (enabling tree-shaking), and load asynchronously. ESM also has strict mode by default, no `__dirname`/`__filename` (must derive from `import.meta.url`), and top-level `await` support. Interop exists but has rough edges — a CJS module can be `require`d from CJS easily, while importing CJS into ESM works via default-export interop, but importing ESM into CJS requires a dynamic `import()`.

---

**Q3. What is npm's `package-lock.json` for, and why does CI use `npm ci` instead of `npm install`?**
Answer: `package-lock.json` pins the exact resolved version (and integrity hash) of every dependency and transitive dependency, ensuring that everyone installing the project — regardless of when — gets an identical dependency tree, not just versions satisfying semver ranges in `package.json`. `npm ci` reads only the lockfile (it errors if `package.json` and the lockfile are out of sync), deletes any existing `node_modules`, and performs a clean, deterministic install, which is both faster and safer for CI/CD pipelines than `npm install`, which can update the lockfile and introduce drift.

---

**Q4. What is a Buffer in Node.js and when would you use one?**
Answer: A `Buffer` is a fixed-length, raw block of binary memory allocated outside the V8 JS heap, used to work with binary data such as file contents, TCP/socket payloads, or image data — data that isn't naturally represented as UTF-8 strings. Buffers let Node handle binary streams efficiently without expensive encoding/decoding round-trips. Typical uses include reading file streams (`fs.createReadStream` emits Buffer chunks), handling raw request bodies, and cryptographic operations. Buffers can be converted to/from strings with specified encodings (`buf.toString('utf8')`) and are the building block underlying Node's Stream implementation.

---

**Q5. What are the four types of Streams in Node and how do you use `pipe()`?**
Answer: Node has four stream types: `Readable` (a source of data, e.g. `fs.createReadStream`), `Writable` (a destination, e.g. `fs.createWriteStream` or the HTTP response object), `Duplex` (both readable and writable, e.g. a TCP socket), and `Transform` (a duplex stream that modifies data as it passes through, e.g. `zlib.createGzip()` or a CSV parser). `pipe()` connects a Readable's output directly to a Writable's input, automatically managing backpressure — pausing the source if the destination can't keep up — which is far more memory-efficient than reading an entire file into memory before processing it. A common pattern is `readStream.pipe(transformStream).pipe(writeStream)`.

---

**Q6. What is the purpose of `package.json`'s `main`, `exports`, and `scripts` fields?**
Answer: `main` specifies the default entry file loaded when the package is `require`d (legacy, CJS-oriented). `exports` is the modern replacement that lets a package define multiple named entry points and conditionally serve different files for `import` vs `require`, or for Node vs browser, while also restricting which internal files can be imported by consumers (encapsulation). `scripts` defines named shell commands runnable via `npm run <name>` (e.g. `start`, `test`, `build`, `dev`), standardizing how a project builds, tests, and runs regardless of underlying tooling.

---

**Q7. How does Node.js handle uncaught exceptions and unhandled promise rejections?**
Answer: An uncaught synchronous exception that bubbles all the way up crashes the process by default, emitting `process.on('uncaughtException')` first if a handler is registered — but relying on this to keep running is discouraged since the process may be in a corrupted state; best practice is to log and exit, letting a process manager (PM2, Kubernetes) restart it. An unhandled promise rejection (a rejected Promise with no `.catch`) emits `process.on('unhandledRejection')`; since Node 15+, unhandled rejections terminate the process by default (configurable). The safe pattern is to always attach `.catch()` or use `try/catch` with `async/await`, and use centralized error-handling middleware in Express to avoid rejections escaping route handlers.

---

**Q8. What's the difference between `process.argv`, `process.env`, and `process.cwd()`?**
Answer: `process.argv` is an array of command-line arguments passed when the Node process started — index 0 is the Node binary path, index 1 is the script path, and subsequent indices are user-supplied args. `process.env` is an object exposing all environment variables available to the process (used for config like `NODE_ENV`, database URLs, secrets — typically populated via `.env` files with `dotenv` in development). `process.cwd()` returns the current working directory the process was launched from, which can differ from `__dirname` (the directory of the currently executing file) — a common source of bugs when resolving relative file paths.

---

## Event Loop & Async (Q9–Q18)

**Q9. Explain the Node.js event loop and its phases.**
Answer: The event loop is the mechanism that lets Node perform non-blocking I/O despite JS being single-threaded. It runs in a cycle through fixed phases: **timers** (execute expired `setTimeout`/`setInterval` callbacks), **pending callbacks** (some system-level deferred callbacks), **idle/prepare** (internal), **poll** (retrieve new I/O events and execute their callbacks; the loop will block here waiting for I/O if there's nothing else to do), **check** (execute `setImmediate` callbacks), and **close callbacks** (e.g. `socket.on('close')`). Between transitioning through phases — and after each individual callback — Node drains the microtask queues (`process.nextTick` then Promise callbacks) before continuing. The loop keeps spinning as long as there are pending timers, I/O, or handles keeping the process alive.

---

**Q10. What is the difference between `process.nextTick()` and `setImmediate()`?**
Answer: `process.nextTick()` schedules a callback to run at the very end of the current operation, before the event loop continues to the next phase — it has the highest priority of any async scheduling mechanism in Node and is drained completely (including any nextTicks scheduled by nextTicks) before microtasks or the loop proceeds. `setImmediate()` schedules a callback to run in the **check** phase, after the current poll phase completes. If called from the main module (top-level), execution order between `setImmediate` and `setTimeout(fn, 0)` is non-deterministic; but inside an I/O callback, `setImmediate` always executes before `setTimeout`, because the check phase immediately follows poll while timers is a full loop iteration away.

---

**Q11. Where do Promises fit relative to `process.nextTick` and macrotasks like `setTimeout`?**
Answer: Promises use the microtask queue, which is drained after `process.nextTick`'s queue but before the event loop proceeds to any macrotask phase (timers, poll, check). So the strict priority order is: `process.nextTick` queue fully drained → Promise microtask queue fully drained → next macrotask (a `setTimeout`/`setInterval` callback in the timers phase, or I/O/`setImmediate` callbacks in later phases). This is why `Promise.resolve().then(cb)` always executes before a `setTimeout(cb, 0)`, but after any pending `process.nextTick(cb)` calls, even though all three appear "immediate."

---

**Q12. What problem does `async`/`await` solve compared to callbacks and raw Promises?**
Answer: Callbacks nested for sequential async operations produce "callback hell" — deeply indented, hard-to-read, hard-to-error-handle code. Raw Promises improve this with chainable `.then()`, but chains of transformations and conditional branching can still get unwieldy, and error handling requires `.catch()` placement discipline. `async/await` is syntactic sugar over Promises that lets asynchronous code be written and read like synchronous code, with `try/catch` for error handling — the same mental model developers already use for sync code. Under the hood, an `async function` always returns a Promise, and `await` pauses execution of that function (not the whole thread) until the awaited Promise settles.

---

**Q13. How does the libuv thread pool relate to the event loop, and which operations use it?**
Answer: The event loop itself runs on the main thread, but certain operations that don't have a native async OS API — filesystem operations (`fs.readFile`), DNS lookups (`dns.lookup`), some `crypto` functions (`pbkdf2`, `scrypt`), and `zlib` compression — are offloaded by libuv to a background thread pool (default size 4, configurable via `UV_THREADPOOL_SIZE`). When a thread pool task completes, its callback is queued into the poll phase to be executed on the main thread like any other I/O callback. Network I/O, by contrast, typically uses the OS's native async mechanisms (epoll on Linux, kqueue on macOS, IOCP on Windows) and doesn't need the thread pool at all.

---

**Q14. What is the difference between the `cluster` module and `worker_threads`?**
Answer: `cluster` forks multiple independent Node.js **processes** that each run a full copy of the application and share listening ports via the OS, load-balancing incoming connections across them (typically round-robin on Linux) — each worker has its own V8 instance, event loop, and memory space, communicating via IPC. `worker_threads` creates multiple **threads** within a single process, each with its own V8 isolate and event loop, but they can share memory efficiently via `SharedArrayBuffer` and `MessageChannel`, with lower overhead than spawning processes. Use `cluster` to utilize multiple CPU cores for a typical stateless HTTP server (scaling throughput); use `worker_threads` for CPU-intensive, in-process computation (image processing, data parsing) that would otherwise block the main event loop, especially when shared memory access is beneficial.

---

**Q15. Why does a synchronous, CPU-intensive function block the entire Node server, and how do you fix it?**
Answer: Because Node runs JS on a single main thread, any long-running synchronous computation (a huge loop, JSON.parse of a massive payload, a slow regex) occupies that thread completely, meaning the event loop cannot process any other event — no other request's I/O callback, no timer, nothing — until the function returns. This causes every concurrent request to stall. Fixes include: offloading the work to a `worker_thread` (or a separate process/service), breaking the computation into chunks and yielding control periodically (e.g. via `setImmediate`), using a native async library, or moving the workload to a job queue processed by dedicated workers outside the request/response cycle.

---

**Q16. What is "callback hell" and what patterns solve it besides `async/await`?**
Answer: Callback hell refers to deeply nested callback functions that result from chaining multiple sequential async operations using the callback style (`fn1(a, (err, res1) => fn2(res1, (err, res2) => ...))`), producing code that's hard to read, debug, and error-handle consistently. Beyond `async/await`, solutions include: Promisifying callback-based APIs (`util.promisify`) and chaining with `.then()`; using control-flow libraries (historically `async.js`) that provide `series`, `parallel`, `waterfall` helpers; and named function extraction to flatten nesting. Modern Node code almost universally prefers Promises/`async-await` since Node's core APIs now ship Promise-based variants (e.g. `fs.promises`).

---

**Q17. What happens if you `await` inside a `for` loop versus using `Promise.all()`?**
Answer: Awaiting inside a `for` loop (`for (const item of items) { await doAsync(item); }`) runs each async operation **sequentially** — the loop pauses at each iteration until that operation resolves before starting the next, which is correct when operations depend on each other but wastes time when they're independent. `Promise.all(items.map(item => doAsync(item)))` starts all the async operations **concurrently** (they're already "in flight" once `map` runs) and waits for all to settle, which is much faster for independent I/O-bound work, but note that `Promise.all` rejects immediately on the first failure (use `Promise.allSettled` if you need all results regardless of individual failures).

---

**Q18. What is the difference between `setTimeout(fn, 0)` and `setImmediate(fn)`?**
Answer: Both schedule `fn` to run asynchronously on a "next macrotask" basis, but they belong to different event loop phases: `setTimeout(fn, 0)` (which is internally clamped to at least ~1ms) runs in the **timers** phase, while `setImmediate(fn)` runs in the **check** phase. When called from the top-level main module, their relative order is not guaranteed because it depends on the loop's timing and startup overhead. But when called from within an I/O callback (inside the poll phase), `setImmediate` reliably fires first, because the check phase directly follows poll, whereas the timers phase requires the loop to complete a full cycle back to the top. In practice, `setImmediate` is preferred when you want a callback to run "right after I/O completes."

---

## Express & Middleware (Q19–Q26)

**Q19. What is middleware in Express and what is the significance of the `next()` function?**
Answer: Middleware are functions with the signature `(req, res, next)` (or `(err, req, res, next)` for error handlers) that execute in the order they're registered via `app.use()` or route methods, each having access to the request and response objects and the ability to modify them, end the response, or pass control onward. Calling `next()` hands off execution to the next matching middleware/handler in the stack; if `next()` is never called and the response isn't sent, the request hangs forever. Calling `next(err)` skips all remaining regular middleware and jumps directly to the nearest error-handling middleware (identified by its 4-argument signature).

---

**Q20. How does Express match routes, and what's the difference between `app.use()` and `app.get()`?**
Answer: Express matches routes by iterating its middleware/route stack in registration order and testing each entry's path pattern (and, for route methods, HTTP verb) against the incoming request; the first match wins for terminal responses, but non-terminal middleware just modifies `req`/`res` and calls `next()`. `app.use(path, mw)` matches **any HTTP method** and treats `path` as a **prefix** (so `app.use('/api', router)` matches `/api`, `/api/users`, `/api/users/1`, etc.) — it's used to mount middleware or sub-routers. `app.get(path, handler)` (and `.post`, `.put`, etc.) matches only that specific HTTP verb and requires an **exact** path match (accounting for route params like `:id`).

---

**Q21. What is the purpose of `express.Router()` and how does it support modular route organization?**
Answer: `express.Router()` creates a self-contained, mini Express application — a mountable route handler that supports its own middleware stack and route definitions, independent of the main `app`. This lets you organize routes by resource or feature (e.g. `usersRouter`, `ordersRouter`) in separate files, then mount them onto the main app with a base path via `app.use('/users', usersRouter)`. Routers can also nest (a router can `use()` another router), and support `mergeParams: true` to access parent route params in nested routers, which is essential for RESTful, resource-oriented API structures at scale.

---

**Q22. How do you implement centralized error handling in Express?**
Answer: Define an error-handling middleware as the **last** `app.use()` call, with exactly four parameters: `(err, req, res, next)` — Express recognizes this signature specifically and routes errors to it. Every route handler should either wrap async code in a try/catch that calls `next(err)`, or use a wrapper utility that catches rejected promises and forwards them automatically (since Express 4 doesn't natively catch rejected promises from `async` handlers — Express 5 does). The centralized handler then inspects `err` (custom error classes with `statusCode` properties are common), logs it appropriately, and sends a consistent JSON error response, avoiding duplicated try/catch/response logic scattered across every route.

---

**Q23. What is the difference between application-level, router-level, and error-handling middleware?**
Answer: Application-level middleware is bound to the `app` instance via `app.use()` or `app.METHOD()` and applies globally or to matched paths across the whole app. Router-level middleware works identically but is bound to an `express.Router()` instance, scoping it to whatever path the router is mounted on. Error-handling middleware is any middleware function with four parameters `(err, req, res, next)`, registered after all other routes/middleware, and is only invoked when `next(err)` is called or a synchronous error is thrown inside a handler. Express also has built-in middleware (`express.json()`, `express.static()`) and third-party middleware (`cors`, `helmet`), which are just application- or router-level middleware from external packages.

---

**Q24. How would you validate incoming request bodies in an Express app, and why not do it manually with if-statements?**
Answer: Schema validation libraries like `zod` or `joi` let you declare the exact shape, types, and constraints expected of a request body/query/params once, then validate incoming data against that schema in a single call, returning either the parsed/coerced data or a structured list of validation errors. This is preferable to manual `if (!req.body.email) return res.status(400)...` chains because it's declarative, centralizes validation logic away from business logic, handles edge cases (type coercion, nested objects, arrays) consistently, and produces uniform, machine-readable error messages. A common pattern is a validation middleware factory: `validate(schema) => (req, res, next) => { try { req.body = schema.parse(req.body); next(); } catch (err) { next(err); } }`.

---

**Q25. What does `express.json()` do, and what happens if you forget to include it?**
Answer: `express.json()` is built-in middleware (based on `body-parser`) that inspects incoming requests with a `Content-Type: application/json` header, reads and buffers the raw request stream, parses it as JSON, and populates `req.body` with the resulting object. If you forget to add it (or add it after your routes), `req.body` will be `undefined` for JSON requests, since Express does not parse request bodies by default — the raw body remains an unconsumed stream. This is a very common early bug: a POST request "works" (200 status) but all expected fields in `req.body` come back undefined.

---

**Q26. How do you structure a production Express app to keep routes, controllers, and business logic separate?**
Answer: A common layered structure separates: **routes** (thin files mapping URL patterns + HTTP verbs to controller functions, using `express.Router()`), **controllers** (handle `req`/`res`, call service functions, format responses, handle HTTP-specific concerns like status codes), **services** (contain business logic, orchestrate operations, are framework-agnostic and testable without mocking `req`/`res`), and **models/repositories** (data access layer — Mongoose schemas, Prisma queries). This separation of concerns improves testability (services can be unit tested without spinning up Express), makes controllers thin and readable, and allows swapping the web framework or database layer with minimal ripple effect.

---

## REST API Design (Q27–Q32)

**Q27. What are the key principles of RESTful API design?**
Answer: REST (Representational State Transfer) APIs model the system as resources (nouns, e.g. `/users`, `/orders`) manipulated via standard HTTP verbs (GET, POST, PUT, PATCH, DELETE) with predictable semantics. Key principles: statelessness (each request contains all information needed; no server-side session state between requests), uniform resource identification via URIs, use of HTTP status codes to convey outcome, HATEOAS (optionally, responses include links to related actions), and layered, cacheable responses where appropriate (`Cache-Control`, `ETag`). Good REST APIs use plural nouns for collections (`/users`), nested resources for relationships (`/users/:id/orders`), and avoid verbs in URLs (`/getUser` is not RESTful — that's what GET `/users/:id` is for).

---

**Q28. What is the difference between PUT and PATCH?**
Answer: `PUT` is meant to **replace** a resource entirely — the request body should represent the full desired state of the resource, and fields omitted from the body are typically treated as should-be-removed/reset (implementations vary, but semantically PUT is idempotent full replacement). `PATCH` applies a **partial update** — the request body contains only the fields to change, leaving the rest of the resource untouched. Both are meant to be idempotent (repeating the same PUT/PATCH produces the same end state), unlike POST. In practice, many APIs implement PUT loosely like PATCH, but interview-correct semantics are: PUT = full replace, PATCH = partial modify.

---

**Q29. How should API versioning be handled, and what are the tradeoffs of different approaches?**
Answer: Common approaches: **URI versioning** (`/api/v1/users`) — simplest, highly visible, cacheable, but clutters URLs and can lead to full-route duplication across versions; **header versioning** (custom header like `Accept-Version: 2` or content negotiation via `Accept: application/vnd.myapi.v2+json`) — keeps URLs clean but is less discoverable and harder to test manually (can't just hit a URL in a browser); **query parameter versioning** (`?version=2`) — easy to add but easy to omit accidentally, less semantically correct. URI versioning is by far the most common in practice for its simplicity and cache-friendliness, despite being architecturally "less pure" than header-based approaches.

---

**Q30. How do you design pagination for a REST API that returns large collections?**
Answer: Two dominant patterns: **offset/limit pagination** (`?page=2&limit=20` or `?offset=20&limit=20`) — simple to implement and understand, supports jumping to arbitrary pages, but suffers from performance degradation on large offsets (databases must scan/skip rows) and consistency issues if records are inserted/deleted between requests (page drift). **Cursor-based pagination** (`?cursor=<opaque_token>&limit=20`, where the cursor typically encodes the last seen sort key, e.g. an ID or timestamp) — scales much better on large datasets (no OFFSET scan) and is stable against concurrent inserts/deletes, but doesn't support jumping to arbitrary pages and requires a stable sort order. Responses should include pagination metadata (`totalCount`, `nextCursor`/`hasMore`) so clients know how to fetch subsequent pages.

---

**Q31. What is idempotency in the context of REST APIs, and which HTTP methods are idempotent?**
Answer: An idempotent operation produces the same end-state no matter how many times it's repeated with the same input — a critical property for safe retries over unreliable networks. `GET`, `PUT`, `DELETE`, `HEAD`, and `OPTIONS` are specified as idempotent (calling `DELETE /users/5` twice leaves the user deleted either way; calling `PUT /users/5` twice with the same body leaves the same final state). `POST` is **not** idempotent by default — calling it twice typically creates two resources — which is why clients should be cautious retrying failed POST requests, and why some APIs support an `Idempotency-Key` header to let the server deduplicate accidental retries of a logically-single create operation.

---

**Q32. How would you design consistent error responses across a REST API?**
Answer: Establish a single JSON error shape used everywhere, typically including a machine-readable `code` or `type`, a human-readable `message`, and optionally a `details`/`errors` array for field-level validation failures (e.g. `{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details": [{ "field": "email", "issue": "required" }] } }`). Pair this with correct, consistent HTTP status codes (400 for client validation errors, 401/403 for auth failures, 404 for missing resources, 409 for conflicts, 500 for unexpected server errors) and centralize the formatting in one error-handling middleware so every part of the app produces uniform errors rather than each route inventing its own shape.

---

## Database Integration (Q33–Q37)

**Q33. When would you choose MongoDB (via Mongoose) over a SQL database (via Prisma) for a Node backend, and vice versa?**
Answer: Choose MongoDB when your data is naturally document-shaped, schema flexibility/evolution is important, you need to store deeply nested or variable-structure data (e.g. user-generated forms, event logs, catalogs with varying attributes per item), or your access patterns favor denormalized reads over complex joins. Choose a SQL database (Postgres/MySQL) when data has strong relational structure, you need multi-table transactional consistency (ACID across entities, e.g. financial transactions, inventory + orders), complex joins/aggregations are common, or you need strict schema enforcement at the database layer. Many production systems use both — SQL for core transactional/relational data, MongoDB or a similar document store for flexible or high-volume unstructured data.

---

**Q34. What is the difference between an ODM (Mongoose) and an ORM (Prisma/Sequelize)?**
Answer: An ODM (Object-Document Mapper), like Mongoose, maps application objects to documents in a document database (MongoDB), providing schema definition (even though MongoDB itself is schemaless), validation, middleware hooks (`pre`/`post` save), and query building tailored to MongoDB's document/collection model. An ORM (Object-Relational Mapper), like Prisma or Sequelize, maps application objects to rows/tables in a relational database, handling SQL generation, joins, migrations, and relational constraints. Both aim to let developers work with JS objects instead of writing raw queries/documents directly, but they solve different underlying data models and their APIs reflect that (Mongoose has `.populate()` for document references; Prisma has `include`/`select` for SQL joins).

---

**Q35. How do you manage database connections efficiently in a Node.js app under load?**
Answer: Use connection pooling — rather than opening a new database connection per request (expensive and slow), maintain a pool of reusable connections (Mongoose/MongoDB driver and Prisma both pool connections internally, configurable via pool size settings). Establish the connection/pool once at application startup (not per-request), and ensure only a single instance of the DB client is shared across the app (common in serverless/lambda environments to avoid exhausting connection limits by reconnecting on every cold start — using connection caching patterns). Also set sensible timeouts, retry/backoff logic for transient failures, and gracefully close pools on process shutdown (`SIGTERM` handler) to avoid connection leaks.

---

**Q36. What are database transactions and how do you implement them in Node with Prisma or Mongoose?**
Answer: A transaction groups multiple operations so they either all succeed (commit) or all fail and roll back (abort), preserving data consistency when an operation spans multiple writes that must stay in sync (e.g. debit one account, credit another). In Prisma, `prisma.$transaction([...])` (sequential array form) or the interactive callback form `prisma.$transaction(async (tx) => {...})` wraps multiple queries atomically. In Mongoose/MongoDB, transactions require a replica set (or sharded cluster) and are used via `session = await mongoose.startSession(); session.startTransaction(); ... await session.commitTransaction();` with all operations passed the `{ session }` option. Without transactions, a crash or error partway through multiple related writes can leave data in an inconsistent state.

---

**Q37. What is the N+1 query problem and how do you avoid it in a Node/Express + ORM app?**
Answer: The N+1 problem occurs when code fetches a list of N parent records, then executes one additional query per record to fetch related data (e.g. fetching 50 users, then querying each user's orders individually — 1 + 50 = 51 queries), which scales terribly. The fix is to eagerly load related data in a single query using the ORM's join/include mechanism: in Prisma, `prisma.user.findMany({ include: { orders: true } })` generates a single (or minimal) query set instead of one per record; in Mongoose, `.populate('orders')` does the equivalent for referenced documents. Recognizing N+1 patterns in logs (a spike in near-identical queries proportional to result set size) is a key performance debugging skill.

---

## Auth & Security (Q38–Q43)

**Q38. Walk through how JWT-based authentication works end-to-end in an Express API.**
Answer: On login, the server verifies credentials (comparing a bcrypt-hashed password), then signs a JWT containing claims (user ID, role, expiry) using a secret or private key (`jsonwebtoken.sign(payload, secret, { expiresIn: '1h' })`) and returns it to the client. The client stores the token (memory, httpOnly cookie, or less securely localStorage) and includes it on subsequent requests, typically in the `Authorization: Bearer <token>` header. An authentication middleware extracts and verifies the token (`jwt.verify(token, secret)`) on protected routes — if valid and unexpired, it attaches the decoded payload to `req.user` and calls `next()`; if invalid/expired, it responds 401. Because JWTs are stateless, no server-side session lookup is needed, but this also means a compromised token remains valid until it expires (unless a revocation/blacklist mechanism exists).

---

**Q39. Why should you always hash passwords with bcrypt (or similar) rather than storing them plaintext or with a fast hash like MD5/SHA-256?**
Answer: Storing plaintext passwords means a single database breach exposes every user's real password. Fast general-purpose hashes like MD5/SHA-256 are deliberately optimized for speed, which makes them terrible for password storage — attackers can brute-force or rainbow-table billions of guesses per second on cheap hardware. bcrypt (and similarly scrypt, Argon2) is intentionally slow and includes a built-in salt and configurable work factor (cost/rounds), making brute-force attacks computationally expensive even after a breach, and the salt prevents precomputed rainbow-table attacks and ensures two users with the same password get different hashes. Always compare with the library's constant-time compare function (`bcrypt.compare`) rather than manual string equality, to avoid timing attacks.

---

**Q40. What is CORS and why does a browser block cross-origin API requests by default?**
Answer: CORS (Cross-Origin Resource Sharing) is a browser security mechanism that enforces the Same-Origin Policy — by default, a webpage loaded from `origin-a.com` cannot make JS-initiated requests to `origin-b.com` (different scheme, domain, or port counts as a different origin) unless the server at `origin-b.com` explicitly opts in via CORS response headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, etc.). This exists to prevent malicious sites from silently making authenticated requests to other sites on a victim's behalf using the victim's cookies/session. In Express, the `cors` middleware sets these headers; for "complex" requests (custom headers, non-simple methods like PUT/DELETE), the browser first sends a preflight `OPTIONS` request that the server must also respond to correctly.

---

**Q41. What is the difference between authentication and authorization, and how do you implement role-based access control (RBAC) in Express?**
Answer: Authentication answers "who are you?" — verifying identity (login, token validation). Authorization answers "what are you allowed to do?" — determining whether an authenticated identity has permission for a specific action. RBAC implements authorization by assigning users one or more roles (admin, editor, viewer), each with a defined set of permissions, then checking the current user's role against the required role/permission for a route — typically as a second middleware layered after authentication: `authenticate` (sets `req.user`) → `authorize('admin')` (checks `req.user.role === 'admin'`, else 403) → route handler. More granular systems use permission-based checks (`can('delete', 'post')`) rather than coarse roles when access rules get complex.

---

**Q42. What security headers and practices does `helmet` provide, and why are they important?**
Answer: `helmet` is Express middleware that sets a collection of HTTP response headers that harden an app against common web vulnerabilities: `Content-Security-Policy` (restricts which sources scripts/styles/images can load from, mitigating XSS), `Strict-Transport-Security` (forces HTTPS for future requests), `X-Content-Type-Options: nosniff` (prevents MIME-type sniffing attacks), `X-Frame-Options` (prevents clickjacking via iframes), and removal of the `X-Powered-By` header (avoids leaking that the app runs Express, reducing fingerprinting for attackers). While helmet doesn't replace input validation, output encoding, or proper auth, it closes a class of easy, well-known browser-level attack vectors with a single line: `app.use(helmet())`.

---

**Q43. How would you protect an Express API against brute-force login attempts and denial-of-service via excessive requests?**
Answer: Use `express-rate-limit` (or a Redis-backed equivalent for multi-instance deployments) to cap the number of requests a client (by IP or user ID) can make in a time window, returning 429 Too Many Requests once exceeded — apply a stricter limit specifically on `/login` and `/register` endpoints than on general API routes. Combine this with account lockout/backoff after repeated failed login attempts, CAPTCHA on suspicious patterns, and monitoring/alerting on spikes. At the infrastructure level, a reverse proxy or WAF (e.g. Cloudflare, AWS WAF) can absorb larger-scale DoS traffic before it even reaches the Node process, since application-level rate limiting alone can't stop a sufficiently large distributed attack.

---

## Testing (Q44–Q47)

**Q44. What is the difference between unit, integration, and end-to-end tests in a Node/Express app?**
Answer: Unit tests exercise a single function or module in isolation, mocking all external dependencies (database, network, filesystem) — fast, numerous, and precise about which piece of logic broke, e.g. testing a service function's business logic with Jest and mocked repository calls. Integration tests verify that multiple units work together correctly, often including a real (or realistic, e.g. in-memory) database and testing a full request/response cycle through Express using `supertest` — slower than unit tests but catch wiring/interface mismatches unit tests miss. End-to-end tests exercise the entire deployed system as a user would, often through a browser or full HTTP client against a running staging environment, covering the whole stack (frontend + backend + database) — slowest and most brittle, but highest confidence that features work as a whole.

---

**Q45. How do you use `supertest` with Jest to test an Express route?**
Answer: `supertest` wraps your Express `app` instance (no need to actually bind a port) and provides a chainable API to make HTTP requests and assert on responses: `const res = await request(app).post('/users').send({ name: 'Alice' }); expect(res.status).toBe(201); expect(res.body.name).toBe('Alice');`. This is combined with Jest's test runner (`describe`/`it`/`expect`) and typically a test database (separate from dev/prod, often reset between tests via `beforeEach`/`afterEach` hooks) or an in-memory database (e.g. `mongodb-memory-server`) so tests are isolated, repeatable, and don't pollute real data.

---

**Q46. What is mocking and when should you mock a dependency versus using the real implementation in a test?**
Answer: Mocking replaces a real dependency (a database call, an external API client, the system clock, a third-party payment SDK) with a controllable fake that returns predetermined responses, letting a test isolate the behavior of the code under test without the cost, flakiness, or side effects of the real dependency (network calls, rate limits, non-determinism). Mock external services and slow/non-deterministic dependencies always in unit tests. Prefer the real implementation (or a close in-memory substitute) in integration tests when you specifically want to verify the interaction/wiring is correct — over-mocking integration tests can hide real bugs (e.g. mocking your ORM entirely means you never catch a broken query). Jest provides `jest.fn()`, `jest.mock()`, and `jest.spyOn()` for creating and tracking mocks/spies.

---

**Q47. How would you set up test isolation so tests don't interfere with each other or leave residual state?**
Answer: Use a dedicated test database (never the dev/prod database), and reset state between tests using lifecycle hooks: `beforeEach`/`afterEach` to clear collections/tables, or wrap each test in a transaction that's rolled back afterward (fast, avoids full-database wipes) for SQL databases. For MongoDB, `mongodb-memory-server` spins up an isolated, ephemeral in-memory Mongo instance per test run. Avoid shared global state (module-level caches, singletons holding data) across tests, run test suites with fresh module registries when needed (`jest.resetModules()`), and ensure tests don't depend on execution order — each test should independently set up its own preconditions (fixtures/factories) rather than relying on data left by a previous test.

---

## Scaling & Production (Q48–Q50)

**Q48. How does the `cluster` module let a Node app use multiple CPU cores, and what are its limitations?**
Answer: Since a single Node process runs on one thread and thus effectively one CPU core, `cluster` forks multiple worker processes (typically one per CPU core, `os.cpus().length`) from a primary process; the primary process manages workers and, on Linux, the OS load-balances incoming connections across them since they share the same listening socket. This multiplies throughput on multi-core machines without changing application code. Limitations: each worker has independent memory, so in-memory state (caches, session stores, WebSocket connection maps) isn't shared across workers unless externalized to Redis or similar; a crashed worker needs to be manually respawned (the primary should listen for `'exit'` and fork a replacement); and it doesn't help CPU-bound work within a single request (that's what `worker_threads` is for).

---

**Q49. What does "graceful shutdown" mean for a Node/Express server, and how do you implement it?**
Answer: Graceful shutdown means that when a process receives a termination signal (`SIGTERM` from Kubernetes/Docker/PM2 during a deploy or scale-down), it stops accepting new connections, finishes processing in-flight requests, closes database connections and other resources cleanly, and then exits — rather than dying abruptly mid-request and dropping client connections or leaving corrupted state. Implementation: `process.on('SIGTERM', async () => { server.close(() => process.exit(0)); await db.disconnect(); })`, where `server.close()` stops accepting new connections but lets existing ones finish, combined with a hard timeout fallback (`setTimeout(() => process.exit(1), 10000)`) in case something hangs. This is essential for zero-downtime deploys and rolling restarts in containerized/orchestrated environments.

---

**Q50. What are the key strategies for monitoring and diagnosing performance issues in a production Node.js app?**
Answer: Use structured logging (`winston` or `pino`) with consistent log levels and correlation/request IDs to trace a request across services; expose application metrics (request rate, latency percentiles, error rate, event loop lag, memory/CPU usage) to a monitoring system (Prometheus/Grafana, Datadog, New Relic); specifically track **event loop lag** (via libraries like `perf_hooks` or the `toobusy-js` pattern) since a rising lag indicates the main thread is being blocked by synchronous work, which is a Node-specific health signal not present in traditional multi-threaded runtimes. For deeper diagnosis, use the `--inspect` flag with Chrome DevTools or `clinic.js` to profile CPU flame graphs and detect memory leaks (heap snapshots comparing growth over time), and always set `NODE_ENV=production` to disable expensive dev-only behaviors (verbose error stacks in responses, non-minified stack traces) and enable framework-level production optimizations.
