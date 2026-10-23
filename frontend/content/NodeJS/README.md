# Node.js + Express — Complete Backend Learning Course

Master Node.js and Express from the ground up through production-grade backend systems. This course covers the runtime internals (event loop, streams, buffers), building REST APIs with Express, database integration, authentication/security, testing, and scaling to production — written for a Python/React full-stack engineer picking up Node.js as a second backend stack.

This repo already has full **MongoDB** and **MySQL** courses, and full **Docker**/**Kubernetes** courses — this course cross-references those for deep database and containerization/orchestration content rather than re-teaching it, and focuses on the Node-specific layer: how you actually use these tools from a Node/Express codebase.

---

## Course Structure

```
NodeJS/
├── Phase-01-Node-Fundamentals/         → Runtime, modules (CJS/ESM), npm, globals/process
├── Phase-02-Event-Loop-and-Async/      → Event loop phases, callbacks, promises, async/await, micro/macrotasks
├── Phase-03-Core-Modules/              → fs, path/os, streams, buffers, EventEmitter, raw http server
├── Phase-04-Express-Fundamentals/      → Routing, middleware, Router, request/response lifecycle
├── Phase-05-REST-API-Design/           → REST principles, resource design, validation, full CRUD API
├── Phase-06-Databases/                 → Mongoose, Prisma, connection pooling, transactions (Node integration layer)
├── Phase-07-Auth-and-Security/         → bcrypt, JWT, sessions, RBAC, OWASP basics
├── Phase-08-Error-Handling-and-Validation/ → Centralized error handling, async error wrapping, process-level errors
├── Phase-09-Testing/                   → Jest, mocking, Supertest integration tests, coverage/CI
├── Phase-10-Advanced-Node/             → Clustering, worker threads, Redis caching, profiling, rate limiting/queues
├── Phase-11-Realtime-and-Microservices/→ WebSockets/Socket.io, SSE, pub/sub, service-to-service patterns
├── Phase-12-Production/                → Config/secrets, PM2, Docker, logging/monitoring, CI/CD, scaling
├── Quick-Reference/                    → Cheatsheet + 50 interview Q&A
└── Projects/                           → Beginner → Advanced hands-on projects (CLI tool through microservices)
```

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Node Fundamentals | Beginner | 3 days |
| 02 | Event Loop & Async | Beginner-Intermediate | 4 days |
| 03 | Core Modules | Intermediate | 3 days |
| 04 | Express Fundamentals | Intermediate | 3 days |
| 05 | REST API Design | Intermediate | 3 days |
| 06 | Databases | Intermediate | 3 days |
| 07 | Auth & Security | Intermediate-Advanced | 3 days |
| 08 | Error Handling & Validation | Intermediate | 2 days |
| 09 | Testing | Intermediate | 3 days |
| 10 | Advanced Node | Advanced | 4 days |
| 11 | Realtime & Microservices | Advanced | 3 days |
| 12 | Production | Advanced | 3 days |

**Total estimated time: 6-8 weeks**

---

## Prerequisites

- Solid JavaScript fundamentals (functions, closures, `this`, ES6+ syntax)
- Basic command line usage
- No prior backend/Node experience required — Phase-01 builds it from scratch

## How to Use This Course

1. Work through Phases 01-05 in order — the event loop (Phase-02) is foundational to everything that follows and is one of the most heavily interviewed Node topics.
2. Phase-06 assumes you either already know MongoDB/MySQL fundamentals or are working through the sibling `../Databases/MongoDB/` and `../Databases/MySQL/` courses in parallel — it only covers the Node integration layer (Mongoose/Prisma).
3. Phase-12's Docker lesson assumes Docker fundamentals — see `../Docker/` if you need those first; Kubernetes is referenced as the natural next step after this course, not covered here.
4. Build each project in `Projects/` yourself rather than just reading it — running real code is where Node's async behavior actually clicks.
5. Use `Quick-Reference/NodeJS-Cheatsheet.md` for last-minute review and `Quick-Reference/Interview-QA.md` for rapid-fire drilling.
