# Phase 10: Backend JavaScript

## What You'll Learn

This phase takes JavaScript out of the browser and into the server. You'll learn how the Node.js runtime actually works under the hood — the V8 engine, the libuv event loop, and the module systems available to you — before building real HTTP APIs with Express, the most widely used Node web framework. From there you'll add the two things every production backend needs: a way to authenticate users safely and a way to persist data reliably, covering password hashing, JWT-based authentication, and both NoSQL (MongoDB) and SQL (`pg`/`mysql2`) database access. By the end of this phase you will be able to design, build, and secure a complete REST API backed by a real database, entirely in JavaScript.

## Learning Objectives

- Explain the Node.js architecture — V8, libuv, the event loop and its phases, the thread pool
- Choose correctly between CommonJS and ES modules in a Node project and convert between them
- Use Node's core modules (`fs`, `path`, `process`, `os`) in both sync, callback, and Promise-based styles
- Manage environment-specific configuration with `.env` files and `dotenv`
- Build an Express application with routing, built-in/custom/third-party middleware, and structured error handling
- Design a REST API following resource-naming and HTTP status code conventions
- Hash passwords correctly with bcrypt and explain why plain-text or unsalted hashing is unsafe
- Implement JWT-based authentication: signing, verifying, protecting routes, and the refresh-token pattern
- Connect to and query MongoDB (via the native driver or Mongoose) and a SQL database (via `pg` or `mysql2`) safely, using parameterized queries to prevent SQL injection

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Nodejs-Core.md](01-Nodejs-Core.md) | Node.js architecture (V8 + libuv), event loop phases, CommonJS vs ES modules, core modules (fs/path/process/os), environment variables with dotenv | 2 days |
| [02-Express-and-REST-APIs.md](02-Express-and-REST-APIs.md) | Express setup, routing, middleware types, request/response objects, REST design conventions, error-handling middleware, full annotated CRUD API | 3 days |
| [03-Authentication-and-Databases.md](03-Authentication-and-Databases.md) | bcrypt password hashing, JWT signing/verification/refresh tokens, MongoDB with Mongoose, SQL with `pg`/`mysql2`, parameterized queries | 3 days |

## Estimated Time

8–10 days

## Previous Phase

← [Phase 9: Data Structures & Algorithms](../Phase-09-Data-Structures-Algorithms/README.md)

## Next Phase

→ [Phase 11: Production & Deployment](../Phase-11-Production-Deployment/README.md)
