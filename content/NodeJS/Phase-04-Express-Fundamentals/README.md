# Phase 04 — Express Fundamentals

Express is the de-facto standard web framework for Node.js — the Node equivalent of Flask/FastAPI in the Python world. This phase takes you from a bare `http` server (Phase 03) to a fully structured Express application: routing, middleware, modular routers, the request-response lifecycle, and serving files/views.

## Why This Phase Matters

Almost every Node.js backend job (and interview) assumes Express (or an Express-like framework such as Fastify/NestJS built on the same concepts). Middleware — the single biggest mental-model shift from Python's Flask/Django decorators or React's component tree — is asked about constantly: "explain the middleware chain," "write custom logging middleware," "what does `next()` do." Nailing this phase makes every later phase (REST API design, auth, error handling) click into place.

## Files in This Phase

| File | Topic |
|------|-------|
| `01-Express-Setup-and-Basic-Routing.md` | Installing Express, `app.get/post/put/delete`, route params, query strings, `req`/`res` core methods |
| `02-Middleware-Deep-Dive.md` | The middleware chain, `next()`, built-in middleware, custom middleware, ordering, error-handling middleware |
| `03-Router-and-Modular-Routes.md` | `express.Router()`, splitting routes into modules, route-level middleware, nested routers |
| `04-Request-Response-Lifecycle.md` | Full lifecycle diagram, `req`/`res` property reference, `res.locals`, response chaining |
| `05-Templating-and-Static-Files.md` | `express.static`, templating engines (EJS/Pug) overview, API-only vs server-rendered apps |

## Learning Path

| Step | Topic | Difficulty | Time |
|------|-------|------------|------|
| 1 | Express Setup and Basic Routing | Easy | 1-2 hrs |
| 2 | Middleware Deep Dive | Medium | 2-3 hrs |
| 3 | Router and Modular Routes | Medium | 1-2 hrs |
| 4 | Request-Response Lifecycle | Medium | 2 hrs |
| 5 | Templating and Static Files | Easy | 1 hr |

## Prerequisites

Phase 01 (Node fundamentals — modules, npm), Phase 02 (event loop/async — Express handlers are just async callbacks), Phase 03 (Core Modules — especially `http`, since Express wraps it).

## Outcome

By the end of this phase you can scaffold an Express app from scratch, explain and diagram the middleware chain from memory, split routes across modules the way a production codebase does, and decide when to serve JSON (API for a React frontend) versus server-rendered HTML.
