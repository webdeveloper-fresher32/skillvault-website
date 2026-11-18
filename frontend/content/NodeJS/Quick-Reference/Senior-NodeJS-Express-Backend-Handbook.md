# Express.js – Backend Development | Senior Node.js Interview Revision Handbook

> Module 4 of the Senior Node.js Developer Interview Revision Handbook.
> Available interactively in the web application under the **[Quick References](/quick-references)** tab.

---

## Table of Contents

### Category A: Express Fundamentals and Architecture
1. [Express Architecture](#1-express-architecture)
2. [Project Structure](#2-project-structure)
3. [Routing](#3-routing)
4. [Route Parameters and Query Parameters](#4-route-parameters-and-query-parameters)

### Category B: Middleware and Request Lifecycle
5. [Middleware](#5-middleware)
6. [Custom Middleware](#6-custom-middleware)
7. [Middleware Execution Order](#7-middleware-execution-order)
8. [Request and Response Lifecycle](#8-request-and-response-lifecycle)
9. [Error-Handling Middleware](#9-error-handling-middleware)
10. [Centralized Exception Handling](#10-centralized-exception-handling)

### Category C: Backend Architecture and Design Patterns
11. [Controllers and Services](#11-controllers-and-services)
12. [Repository Pattern](#12-repository-pattern)
13. [Dependency Injection](#13-dependency-injection)
- *[Complete Architecture Diagram: HTTP Request to Database](#complete-layered-architecture-diagram)*

### Category D: Validation and File Handling
14. [Request Validation (Joi and Zod)](#14-request-validation-joi-and-zod)
- *[Comparison Table: Zod vs Joi](#zod-vs-joi-comparison-table)*
15. [File Uploads (Multer)](#15-file-uploads-multer)
16. [Static Files](#16-static-files)

### Category E: HTTP State and Security-Related Middleware
17. [Cookies and Sessions](#17-cookies-and-sessions)
- *[Comparison Table: Cookies vs Sessions vs JWT](#cookies-vs-sessions-vs-jwt-table)*
18. [CORS](#18-cors)
19. [Rate Limiting](#19-rate-limiting)

### Category F: REST API Development
20. [Pagination, Filtering and Sorting](#20-pagination-filtering-and-sorting)
21. [API Versioning](#21-api-versioning)

### Category G: Production and Application Lifecycle
22. [Graceful Shutdown](#22-graceful-shutdown)
23. [Production Configuration](#23-production-configuration)

---

## 1. Express Architecture
- **30 Seconds:** Express is a minimalist, unopinionated routing and middleware engine built on Node.js native `node:http`. An Express app is a callable request listener backed by a sequential pipeline of `Layer` objects that transform incoming requests.
- **Internals:** `express()` wraps native `http.createServer(app)`. Every `app.use()` or route pushes a compiled `Layer` (with a regex matcher from `path-to-regexp`) into the router stack. Requests traverse this stack sequentially.
- **Key Senior Takeaway:** `app.listen()` is just a convenience wrapper for `http.createServer(app).listen()`.

---

## 2. Project Structure
- **30 Seconds:** Production Express requires separating transport, domain logic, and data access. Decoupling `app.ts` (middleware/routes) from `server.ts` (port listening/DB bootstrap) enables in-memory headless testing with Supertest.
- **Internals:** 3-Tier Architecture: Controllers handle HTTP transport; Services handle business domain rules; Repositories handle database persistence.
- **Key Senior Takeaway:** Never pass Express `req` or `res` into Services or Repositories: keep business logic 100% transport-agnostic.

---

## 3. Routing
- **30 Seconds:** Express routing maps HTTP verbs and URIs to handler pipelines. `express.Router()` creates isolated, mountable mini-applications with their own dedicated middleware stacks.
- **Internals:** Sub-routers strip parent mount prefixes before matching child paths. In nested routers (e.g. `/users/:userId/posts`), you MUST set `express.Router({ mergeParams: true })` so child routes can access parent route parameters.
- **Key Senior Takeaway:** Express 5 upgraded `path-to-regexp` to v8, requiring explicit wildcard syntax (e.g. `/*splat`).

---

## 4. Route Parameters and Query Parameters
- **30 Seconds:** Route parameters (`req.params`) are required URL segments identifying specific entities (`/users/:id`). Query parameters (`req.query`) are optional key-value pairs (`?page=1&sort=desc`) used for filtering, pagination, and sorting.
- **Internals:** Everything in `req.params` and `req.query` is a STRING by default. Query strings like `?id=1&id=2` parse into arrays, risking runtime crashes if unvalidated.
- **Key Senior Takeaway:** Beware of string boolean traps: `Boolean("false") === true`! Always validate and coerce query parameters with Zod.

---

## 5. Middleware
- **30 Seconds:** The foundational building block of Express. Middleware functions access `(req, res, next)` and execute sequentially. Every middleware must either terminate the cycle (sending a response) or call `next()`.
- **Internals:** Calling `next()` advances the internal router index pointer. Calling `next(err)` skips all remaining normal middleware and jumps straight to 4-argument error handlers.
- **Key Senior Takeaway:** If a middleware neither sends a response nor calls `next()`, the client request hangs indefinitely until socket timeout.

---

## 6. Custom Middleware
- **30 Seconds:** Custom middleware encapsulates cross-cutting concerns like distributed correlation IDs (`X-Request-Id`), request timing, and role-based access control (RBAC).
- **Internals:** Use higher-order middleware factories (closures) to create configurable middleware (e.g. `authorize(['ADMIN', 'MANAGER'])`).
- **Key Senior Takeaway:** Always use `return res.status(...).json(...)` when rejecting requests inside middleware to prevent subsequent code from executing.

---

## 7. Middleware Execution Order
- **30 Seconds:** Execution order is strictly determined by registration order. Placement of body parsers, auth, routes, 404 catch-alls, and error handlers dictates application behavior.
- **Internals:** Express searches top-to-bottom. If a route terminates the response, downstream standard middleware is never executed. Error middleware MUST be registered last because Express only searches forward for 4-argument handlers.
- **Key Senior Takeaway:** Never call `next()` after sending a response without a return statement: this triggers `ERR_HTTP_HEADERS_SENT`.

---

## 8. Request and Response Lifecycle
- **30 Seconds:** The complete lifecycle spans: TCP Handshake $\rightarrow$ `node:http` parser $\rightarrow$ Express Router $\rightarrow$ Middleware $\rightarrow$ Controller $\rightarrow$ Service $\rightarrow$ Repository $\rightarrow$ Database $\rightarrow$ `res.json()` $\rightarrow$ socket flush (`res.end()`).
- **Internals:** Native `http.ServerResponse` emits `"finish"` when all data is flushed to the OS kernel, and `"close"` if the client terminates the connection prematurely.
- **Key Senior Takeaway:** Listen to `res.on('close')` to abort long-running queries via `AbortController` when users cancel or disconnect.

---

## 9. Error-Handling Middleware
- **30 Seconds:** Defined with exactly four parameters: `(err, req, res, next)`. Express uses function arity (`fn.length === 4`) to distinguish error handlers from regular middleware.
- **Internals:** Even if `next` is not used inside the handler, it MUST be declared: `(err, req, res)` has `length === 3` and will be ignored by Express!
- **Key Senior Takeaway:** Express 5 natively catches rejected promises in async route handlers without needing `express-async-errors`.

---

## 10. Centralized Exception Handling
- **30 Seconds:** Architectural practice of funneling all application errors through a single pipeline using a custom `AppError` class that distinguishes operational errors from programmer bugs.
- **Internals:** Operational errors (`isOperational: true`, known HTTP codes like 400/404) return sanitized, client-safe messages. Programmer bugs (500, TypeErrors) log critical alerts and mask internal system details.
- **Key Senior Takeaway:** Handle 404s via a catch-all middleware (`app.all('*')`) right before the centralized error handler.

---

## 11. Controllers and Services
- **30 Seconds:** Controllers handle HTTP transport (unpacking `req.body`, setting status codes, serializing JSON); Services contain pure business domain logic with zero Express dependencies.
- **Internals:** Keeping services transport-agnostic allows business rules to be reused across Express REST endpoints, Kafka message consumers, and CLI cron jobs.
- **Key Senior Takeaway:** Never pass `req` or `res` into service methods.

---

## 12. Repository Pattern
- **30 Seconds:** Isolates business domain services from database access details (SQL, Prisma, Mongoose) using an abstract collection-like interface.
- **Internals:** Services depend on repository contracts (e.g. `IUserRepository`). Encapsulates complex joins, index queries, and connection pools.
- **Key Senior Takeaway:** Allows fast unit testing of services using mock in-memory repositories without spinning up live databases.

---

## 13. Dependency Injection
- **30 Seconds:** Design pattern where components receive dependencies from an external assembler (Composition Root) via constructors or factories rather than hardcoding imports.
- **Internals:** Pure DI (constructor injection) provides 100% compile-time TypeScript safety without the runtime overhead or decorators of heavy IoC containers.
- **Key Senior Takeaway:** Beware of lost `this` context when passing class controller methods to Express routes: use arrow methods or constructor binding.

---

### Complete Layered Architecture Diagram

```
Client HTTP Request (POST /api/v1/orders)
       |
       v
[ Express Router: app.use('/api/v1', apiRouter) ]
       |
       v
[ Middleware: authMiddleware -> validate(OrderSchema) ]
       |
       v
[ Controller: OrderController.create(req, res, next) ]
       | (Clean JS parameters: userId, items)
       v
[ Service: OrderService.checkout(userId, items) ] (Pure Domain Logic)
       |
       v
[ Repository: OrderRepository.save(order) ] (Encapsulates SQL/ORM)
       |
       v
[ Database: PostgreSQL / MongoDB ]
       |
       v (Returns entity)
[ Controller: res.status(201).json(orderDto) ]
```

---

## 14. Request Validation (Joi and Zod)
- **30 Seconds:** Validating `req.body`, `req.query`, and `req.params` at the middleware perimeter before controllers execute, rejecting invalid payloads with HTTP 400.
- **Internals:** Zod enables native TypeScript type inference via `z.infer<typeof Schema>` with zero dependencies, replacing legacy Joi.
- **Key Senior Takeaway:** Sanitize inputs to prevent Mass Assignment privilege escalation vulnerabilities.

### Zod vs Joi Comparison Table

| Feature | Zod | Joi | Senior Recommendation |
|---|---|---|---|
| **TypeScript Inference** | Native `z.infer<typeof Schema>` | Requires manual type duplication | Zod is modern TS standard |
| **Bundle Size** | Lightweight (~12kb gzip), works in Browser & Node | Heavy (~140kb), Node-centric | Zod allows shared schemas |
| **Type Coercion** | Explicit (`z.coerce.number()`) | Implicit by default | Explicit coercion prevents bugs |
| **Ecosystem** | Standard in tRPC, Next.js, Prisma | Legacy standard in older Express apps | Choose Zod for all new code |

---

## 15. File Uploads (Multer)
- **30 Seconds:** Multipart/form-data streaming middleware for handling file uploads, enforcing size limits and storage destinations (`memoryStorage` vs `diskStorage`).
- **Internals:** Client-supplied `file.mimetype` and extensions are easily spoofed. Production systems must verify true binary File Signatures (Magic Numbers) using `file-type`.
- **Key Senior Takeaway:** Replace user filenames with randomized UUIDs to prevent Directory Traversal attacks.

---

## 16. Static Files
- **30 Seconds:** `express.static()` serves static assets with automatic ETag calculation, Cache-Control headers, and conditional HTTP 304 Not Modified caching.
- **Internals:** In production high-scale deployments, Node.js should NEVER serve static files directly: offload to Nginx, AWS CloudFront, or S3.
- **Key Senior Takeaway:** Never aggressively cache HTML files (`Cache-Control: no-cache`); use `immutable` on hashed JS/CSS assets.

---

## 17. Cookies and Sessions
- **30 Seconds:** Cookies store state on the browser; Sessions store state on the server (Redis) mapped to an opaque signed session ID cookie.
- **Internals:** Essential security flags: `HttpOnly` (blocks XSS), `Secure` (HTTPS only), `SameSite` (blocks CSRF). Never use `MemoryStore` in production.
- **Key Senior Takeaway:** Signed cookies prevent tampering, but they are NOT encrypted (readable in plaintext).

### Cookies vs Sessions vs JWT Table

| Attribute | HTTP Cookies | Server Sessions (Redis) | JWT (Stateless) |
|---|---|---|---|
| **Storage Location** | Browser (~4KB cap) | Server / Redis | Client (Cookie / LocalStorage) |
| **Security Flags** | HttpOnly, Secure, SameSite | Session ID in HttpOnly cookie | Vulnerable to XSS in LocalStorage |
| **Revocation** | Client deletion / Expiry | Instant: Delete Redis key | Difficult without Redis blacklist |
| **Multi-Instance** | Stateless across pods | Requires shared Redis cluster | Stateless across any pod count |

---

## 18. CORS
- **30 Seconds:** Browser-enforced security mechanism allowing servers to whitelist which origins can read responses, relaxing the Same-Origin Policy.
- **Internals:** CORS does NOT protect your API from unauthorized access: curl, Postman, and backend servers bypass CORS completely.
- **Key Senior Takeaway:** You cannot use wildcard `origin: '*'` when `credentials: true` is enabled. Cache preflights with `Access-Control-Max-Age`.

---

## 19. Rate Limiting
- **30 Seconds:** Restricts the frequency of client requests to protect against DoS attacks, credential stuffing, and resource exhaustion.
- **Internals:** When behind reverse proxies (ALB/Cloudflare), you MUST set `app.set('trust proxy', 1)`, otherwise all users share the load balancer IP.
- **Key Senior Takeaway:** In multi-pod deployments, use Redis (`rate-limit-redis`) for shared distributed atomic rate limiting.

---

## 20. Pagination, Filtering and Sorting
- **30 Seconds:** Pagination bounds database query size: Offset-based (`(page - 1) * limit`) for standard admin tables; Cursor-based (`WHERE id > :cursor`) for high-volume infinite feeds.
- **Internals:** Offset pagination degrades to $O(N)$ on deep pages because the database scans and discards offset rows. Cursor pagination uses B-Tree indexes for instantaneous $O(1)$ seeks.
- **Key Senior Takeaway:** Always enforce a strict `max` limit (e.g. max 100) to protect the V8 heap from memory exhaustion.

---

## 21. API Versioning
- **30 Seconds:** Managing API changes over time without breaking existing integrations. Versioning is strictly required for Breaking Changes.
- **Internals:** URI Path Versioning (`/api/v1`) is the industry standard for clarity and reverse proxy routing. Version controllers and DTOs, NOT the core domain services.
- **Key Senior Takeaway:** Attach `Deprecation` and `Sunset` HTTP headers to give clients advance notice before shutting down old versions.

---

## 22. Graceful Shutdown
- **30 Seconds:** Cleanly terminating a Node.js server upon receiving OS signals (`SIGTERM`/`SIGINT`), stopping new connections while allowing in-flight requests to complete.
- **Internals:** Sequence: 1) Mark `/readyz` unhealthy; 2) `server.close()`; 3) `server.closeIdleConnections()`; 4) Drain database pools; 5) 15-second watchdog timer force exit.
- **Key Senior Takeaway:** Never call `process.exit(0)` immediately upon `SIGTERM`: active user transactions will be abruptly dropped!

---

## 23. Production Configuration
- **30 Seconds:** Preparing Express for enterprise observability and stability via 12-Factor env validation with Zod, structured JSON logging with Pino, and dual health checks.
- **Internals:** Liveness (`/livez`) checks if the process event loop is responsive; Readiness (`/readyz`) checks if external databases/caches are connected.
- **Key Senior Takeaway:** Never put database queries in `/livez`: temporary database spikes will cause Kubernetes to restart healthy Node.js pods.
