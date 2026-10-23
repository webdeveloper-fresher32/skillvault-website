# NestJS Master Course — Projects

This section contains six hands-on projects that take you from a single-resource CRUD API all the way to a two-service microservices system with containerised deployment and health checks. Complete them in order; each one builds on the skills introduced in earlier phases of the course. All projects that touch a database use **TypeORM** consistently, so the persistence layer you learn in Project 2 carries forward unchanged through the capstone.

## Project Overview

| # | Project | Level | Phase Prerequisites | Description |
|---|---------|-------|---------------------|-------------|
| 1 | Notes/Todo REST API | Beginner | Phase 3 – Controllers and Routing | Build a single-resource CRUD API with `@Controller`, plain DTOs, and an in-memory array store |
| 2 | Task Manager API | Beginner-Intermediate | Phase 4-6 – Providers/DI, Modules, Pipes & Validation | Persist Users and Tasks with TypeORM, wrap business rules in an injectable service layer, validate every request with `class-validator` DTOs |
| 3 | Blog API with Auth | Intermediate | Phase 7-8 – Guards/Auth & Interceptors/Filters | Add JWT authentication with Passport, role-based `CanActivate` guards, a global exception filter, and a response-transform interceptor |
| 4 | E-commerce Product Catalog | Intermediate-Advanced | Phase 9-10 – Database Integration & Testing | Relational Products/Categories/Orders with TypeORM, and a full Jest test suite: unit tests with mocked repositories plus e2e tests with Supertest |
| 5 | Real-time Notification System | Advanced | Phase 11 – Microservices and Realtime | A WebSocket `Gateway` for live in-app notifications, backed by a BullMQ queue that processes email jobs asynchronously |
| 6 | Microservices: Orders + Inventory | Advanced (Capstone) | Phase 11-12 – Microservices Basics & Production/Deployment | Two independently deployable Nest services communicating over a TCP microservice transporter, each with its own production `Dockerfile` and `@nestjs/terminus` health checks |

---

## Project Summaries

### 1. Notes/Todo REST API (Beginner)
Build a minimal `@Controller('notes')` exposing full CRUD (`GET`/`POST`/`PATCH`/`DELETE`) for a `Note` resource, backed by a plain in-memory array (no database yet). You will practise route decorators (`@Get`, `@Post`, `@Param`, `@Body`), a hand-rolled request/response DTO shape, and basic manual validation — the daily mechanics of a Nest controller before dependency injection or a database is involved.

### 2. Task Manager API (Beginner-Intermediate)
Model a real domain: a `User` has many `Task`s. Persist both with TypeORM entities and a `@OneToMany`/`@ManyToOne` relationship, move all business rules (e.g. "a user cannot have more than 20 open tasks") into an injectable `@Injectable() TasksService`, and validate every incoming request with `class-validator` DTOs wired up through Nest's global `ValidationPipe`. You will see why controllers should stay thin, why providers exist, and how Nest's DI container resolves constructor dependencies.

### 3. Blog API with Auth (Intermediate)
Layer production concerns onto a `Post`/`Author` domain: a Passport `JwtStrategy` plus a custom `JwtAuthGuard` protect write endpoints, a `RolesGuard` reads metadata set by a custom `@Roles()` decorator to enforce author-only edit rules, a global `AllExceptionsFilter` (`@Catch()`) normalizes every error response, and a `TransformInterceptor` wraps every successful response in a consistent `{ data, timestamp }` envelope. This is where Nest's full request pipeline — pipe → guard → interceptor → handler → interceptor → filter — becomes concrete.

### 4. E-commerce Product Catalog (Intermediate-Advanced)
Build a `Product`/`Category`/`Order` schema with TypeORM relations (`@ManyToOne` category, `@OneToMany` order items), query builder-based filtered search (category, price range, in-stock), and pagination via `skip`/`take`. The project ships with a full test pyramid: Jest unit tests for services with repositories mocked via `getRepositoryToken`, and e2e tests using `@nestjs/testing`'s `Test.createTestingModule` plus Supertest driving a real in-memory SQLite database end to end.

### 5. Real-time Notification System (Advanced)
Introduce asynchronous and real-time patterns: a `NotificationsGateway` (`@WebSocketGateway`) pushes live notifications to connected clients over Socket.IO, while a BullMQ queue (`@nestjs/bullmq`) processes "send email" jobs in a separate `Processor` so the HTTP request that triggers a notification returns immediately. You will configure a Redis-backed queue, reason about job retries/backoff, and broadcast queue-completion events back out over the WebSocket gateway.

### 6. Microservices: Orders + Inventory (Advanced Capstone)
Split the domain into two independently deployable Nest applications — `orders-service` and `inventory-service` — that communicate over Nest's built-in TCP microservice transporter (`@MessagePattern`/`ClientProxy`). Each service exposes `/health` via `@nestjs/terminus`, ships with its own multi-stage `Dockerfile`, and is wired together with a `docker-compose.yml` — the capstone that ties the whole course's controllers, DI, validation, auth, database, testing, and microservices skills into one deployable system.
