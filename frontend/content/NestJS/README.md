# NestJS — Progressive Node.js Backend Framework Course

Master NestJS from the ground up: a TypeScript-first, Angular-inspired backend framework built on top of Express (or Fastify) that brings structure, dependency injection, and testability to Node.js server development. This course goes deep on the parts of NestJS that trip learners up most — the decorator/metadata-driven DI system, the request pipeline (pipes → guards → interceptors → filters), and module architecture — matching the depth of this repo's Spring Boot course, since NestJS is an equally "trick" backend framework once you're past the tutorial-level basics.

This course assumes comfort with modern TypeScript and basic Node.js. Phase 01 reviews the TypeScript features (decorators, metadata reflection) NestJS is built on, so you are not blindsided by "magic" annotations later.

---

## Course Structure

```text
NestJS/
├── Phase-01-TypeScript-and-Node-Fundamentals/       → Decorators, reflect-metadata, Node/Express recap
├── Phase-02-Nest-CLI-and-Project-Structure/         → Nest CLI, project scaffolding, bootstrap process
├── Phase-03-Controllers-and-Routing/                → Controllers, routing decorators, request/response handling
├── Phase-04-Providers-and-Dependency-Injection/      → Providers, injection tokens, scopes, circular deps
├── Phase-05-Modules-and-Application-Architecture/    → Modules, dynamic modules, feature/shared modules
├── Phase-06-Pipes-and-Validation/                    → Pipes, DTOs, class-validator/class-transformer
├── Phase-07-Guards-and-Authentication/               → Guards, Passport, JWT, role-based access
├── Phase-08-Interceptors-Filters-and-Custom-Decorators/ → Interceptors, exception filters, custom decorators
├── Phase-09-Database-Integration/                    → TypeORM & Prisma integration, repositories, migrations
├── Phase-10-Testing/                                 → Jest unit tests, e2e tests, mocking the Nest DI container
├── Phase-11-Microservices-and-Realtime/              → Microservice transporters, WebSockets, queues, GraphQL overview
├── Phase-12-Production-and-Deployment/               → Config management, logging, performance, deployment
├── Quick-Reference/                                  → Cheatsheet + 50 interview Q&A
└── Projects/                                         → Hands-on projects (Task API → microservices capstone)
```

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | TypeScript & Node Fundamentals | Beginner | 2 days |
| 02 | Nest CLI & Project Structure | Beginner | 1 day |
| 03 | Controllers & Routing | Beginner | 2 days |
| 04 | Providers & Dependency Injection | Intermediate | 3 days |
| 05 | Modules & Application Architecture | Intermediate | 2 days |
| 06 | Pipes & Validation | Intermediate | 2 days |
| 07 | Guards & Authentication | Intermediate-Advanced | 3 days |
| 08 | Interceptors, Filters & Custom Decorators | Advanced | 3 days |
| 09 | Database Integration | Advanced | 3 days |
| 10 | Testing | Intermediate | 3 days |
| 11 | Microservices & Realtime | Advanced | 3 days |
| 12 | Production & Deployment | Advanced | 2 days |

**Total estimated time: 5-6 weeks**

---

## Prerequisites

- Solid TypeScript fundamentals (types, interfaces, generics, decorators exposure helpful but not required)
- Basic Node.js and HTTP/REST knowledge
- Comfort with async/await and Promises

## How to Use This Course

1. Work through Phases 01-12 sequentially. Providers/DI (Phase 04) and Modules (Phase 05) are the conceptual core of the framework — do not skip ahead to Guards/Interceptors (Phases 07-08) without a solid grip on them, since the request pipeline builds directly on the DI container.
2. Every lesson includes a **Common Pitfalls** and **Best Practices** section in addition to worked examples — read these even if you already understand the happy path, since NestJS's proxy-based DI and decorator metadata produce failure modes that aren't obvious from the docs alone.
3. Build the projects in `Projects/` yourself in order — NestJS's opinionated structure only "clicks" once you've scaffolded a few modules with the CLI and felt the DI container wire things together.
4. Use `Quick-Reference/NestJS-Cheatsheet.md` for syntax review and `Quick-Reference/Interview-QA.md` to test recall before interviews.
