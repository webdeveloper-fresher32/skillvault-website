# Full-Stack Engineer Career Roadmap

> "A Full-Stack Engineer bridges client-side user experience and backend system reliability: building accessible, reactive web applications, architecting robust REST/GraphQL APIs, modeling relational databases, and deploying containerized cloud workloads."

---

## The Learning Sequence

```
                         Full-Stack Engineer
                                  │
                                  ▼
                Phase 1: CS Foundations & DSA
                                  │
                                  ▼
                Phase 2: Modern Frontend Engineering
                                  │
                                  ▼
                Phase 3: Backend Runtime & APIs
                                  │
                                  ▼
                Phase 4: Database Modeling & Caching
                                  │
                                  ▼
                Phase 5: Software Engineering & Testing
                                  │
                                  ▼
                Phase 6: Application Security & Hardening
                                  │
                                  ▼
                Phase 7: Cloud & CI/CD Deployment
```

---

## Phase Breakdown & Curriculum Links

### Phase 1: CS Foundations & Algorithmic Problem Solving
- [Computer Fundamentals](../01-FOUNDATIONS/01-Computer-Fundamentals/README.md) — Binary logic, CPU memory hierarchy, compilation.
- [Data Structures & Algorithms (DSA)](../01-FOUNDATIONS/02-DSA/README.md) — Arrays, hash tables, trees, heaps, two pointers, sliding window.
- [Operating Systems & Linux](../01-FOUNDATIONS/03-OS/README.md) — Processes, threads, virtual memory, shell commands.
- [Computer Networking](../01-FOUNDATIONS/04-Networking/README.md) — OSI model, TCP/UDP, DNS, HTTP/1.1 to HTTP/3, TLS.

### Phase 2: Modern Frontend Engineering
- [JavaScript Deep Dive](../03-APPLICATION-DEVELOPMENT/01-Frontend/JavaScript/README.md) — Event loop, closures, prototypes, asynchronous programming.
- [TypeScript](../03-APPLICATION-DEVELOPMENT/01-Frontend/TypeScript/README.md) — Strict typing, generics, discriminated unions, utility types.
- [React Architecture](../03-APPLICATION-DEVELOPMENT/01-Frontend/React/README.md) — Virtual DOM, hooks, reconciliation, custom hooks, context.
- [Next.js App Router](../03-APPLICATION-DEVELOPMENT/01-Frontend/NextJS/README.md) — React Server Components (RSC), SSR, SSG, Server Actions.

### Phase 3: Backend Runtimes & API Design
- Choose your primary backend runtime:
  - [Node.js](../03-APPLICATION-DEVELOPMENT/02-Backend/NodeJS/README.md) / [NestJS](../03-APPLICATION-DEVELOPMENT/02-Backend/NestJS/README.md) (JavaScript / TypeScript ecosystem)
  - [Java](../03-APPLICATION-DEVELOPMENT/02-Backend/Java/) / [Spring Boot](../03-APPLICATION-DEVELOPMENT/02-Backend/SpringBoot/README.md) (Enterprise JVM ecosystem)
- [Payment Gateways Integration](../03-APPLICATION-DEVELOPMENT/02-Backend/PaymentGateways/README.md) — Stripe, Razorpay, webhooks, idempotency keys.

### Phase 4: Database Modeling & In-Memory Caching
- [Database Fundamentals](../03-APPLICATION-DEVELOPMENT/03-Databases/Fundamentals/README.md) — Relational vs NoSQL, ACID vs BASE, B-Tree indexes.
- [PostgreSQL](../03-APPLICATION-DEVELOPMENT/03-Databases/PostgreSQL/README.md) — Schema modeling, foreign keys, MVCC, EXPLAIN ANALYZE.
- [Redis Caching](../03-APPLICATION-DEVELOPMENT/03-Databases/Redis/README.md) — Cache-aside pattern, TTLs, session storage, distributed rate limiting.

### Phase 5: Software Engineering, Patterns & Quality Assurance
- [Low-Level Design (LLD)](../02-SOFTWARE-ENGINEERING/01-LLD/README.md) — SOLID principles, class diagrams, schema design.
- [Design Patterns](../02-SOFTWARE-ENGINEERING/02-Design-Patterns/README.md) — Factory, Builder, Adapter, Decorator, Strategy, Observer.
- [Software Testing](../02-SOFTWARE-ENGINEERING/03-Testing/README.md) — Test pyramid, Vitest/Jest unit testing, Supertest integration testing, Playwright E2E.

### Phase 6: Application Security & Hardening
- [Security Guide](../02-SOFTWARE-ENGINEERING/04-Security/README.md) — OWASP Top 10, Argon2id hashing, JWT + refresh token rotation, OAuth2/OIDC, CSRF/CORS.

### Phase 7: Cloud Infrastructure & Deployment
- [Git & Productivity](../04-SYSTEMS-INFRASTRUCTURE/04-Developer-Tools/Git/README.md) — Git DAG, branching strategies, interactive rebasing.
- [Docker](../04-SYSTEMS-INFRASTRUCTURE/03-DevOps/Docker/README.md) — Multi-stage builds, containerization, Docker Compose.
- [GitHub Actions](../04-SYSTEMS-INFRASTRUCTURE/03-DevOps/GithubActions/README.md) — Automated linting, test suites, and continuous deployment.
- [AWS Cloud Basics](../04-SYSTEMS-INFRASTRUCTURE/02-Cloud/AWS/README.md) — S3 static assets, EC2/ECS compute, RDS managed databases.

---

## Recommended Portfolio Projects

| Tier | Project | Key Stack |
|---|---|---|
| **Beginner** | [Thread-Safe LRU Cache](../06-PROJECTS/01-Beginner/README.md) | DSA, Generics, Doubly-Linked List + Hash Map |
| **Intermediate** | [Full-Stack Task & Project Management Engine](../06-PROJECTS/02-Intermediate/README.md) | Next.js, Express/NestJS, PostgreSQL, JWT Auth |
| **Advanced** | [Event-Driven Real-Time Notification Service](../06-PROJECTS/03-Advanced/README.md) | WebSockets, Redis Pub/Sub, Node.js |
| **Capstone** | [Production Multi-Tenant SaaS Platform](../06-PROJECTS/04-Capstones/README.md) | Next.js App Router, NestJS, Postgres, Stripe Billing, Docker, AWS |

---

## Interview & Career Readiness

- [Aptitude Preparation](../07-INTERVIEW-PREP/01-Aptitude/README.md) — Numerical, logical, and verbal practice.
- [HR & Behavioral Interview Prep](../07-INTERVIEW-PREP/02-HR-Interview-QA.md) — STAR method behavioral answers and leadership principles.
