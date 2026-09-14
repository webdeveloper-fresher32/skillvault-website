# Spring Boot Master Course — Projects

This section contains six hands-on projects that take you from a single-resource CRUD API all the way to a two-service microservices system with resilience patterns and containerised deployment. Complete them in order; each one builds on the skills introduced in earlier phases of the course.

## Project Overview

| # | Project | Level | Phase Prerequisites | Description |
|---|---------|-------|---------------------|-------------|
| 1 | Notes REST API | Beginner | Phase 3 – REST APIs (Spring Web) | Build a single-resource CRUD API with `@RestController`, DTOs, and Bean Validation over an in-memory store |
| 2 | Task Manager API | Beginner-Intermediate | Phase 4-5 – Data Access (JPA) & Services/Transactions | Persist Users and Tasks with a JPA one-to-many relationship, wrap business rules in a `@Transactional` service layer |
| 3 | Blog API with Security | Intermediate | Phase 6-7 – Exception Handling & Spring Security | Add global exception handling with `ProblemDetail`, Bean Validation, and JWT-based auth with author-only edit rules |
| 4 | E-commerce Product Catalog | Intermediate-Advanced | Phase 8-9 – Testing & Advanced Data | Dynamic search with JPA Specifications, pagination/sorting, projections, and a full test suite (unit, slice, Testcontainers) |
| 5 | Order Processing System | Advanced | Phase 10 – Caching & Async | Cache product lookups, send order-confirmation emails asynchronously, and run a nightly `@Scheduled` report job |
| 6 | Microservices: Order + Inventory | Advanced (Capstone) | Phase 11-12 – Microservices Basics & Production/Actuator | Two Spring Boot services communicating over WebClient, a Resilience4j circuit breaker on the inter-service call, Actuator health/metrics, and a Dockerfile per service |

---

## Project Summaries

### 1. Notes REST API (Beginner)
Build a minimal `@RestController` exposing full CRUD (`GET`/`POST`/`PUT`/`DELETE`) for a `Note` resource. You will practise request/response DTOs, `ResponseEntity`, path variables, and basic Bean Validation (`@NotBlank`, `@Size`) — the daily mechanics of writing a Spring Web endpoint before any database is involved.

### 2. Task Manager API (Beginner-Intermediate)
Model a real domain: a `User` has many `Task`s. Persist both with Spring Data JPA, define the relationship with `@OneToMany`/`@ManyToOne`, and move business rules (e.g. "a user cannot have more than 20 open tasks") into a `@Service` layer wrapped in `@Transactional`. You will see why controllers should stay thin and services should own the transaction boundary.

### 3. Blog API with Security (Intermediate)
Layer production concerns onto a `Post`/`Author` domain: a `@RestControllerAdvice` returning RFC 7807 `ProblemDetail` responses for every error case, Bean Validation on request DTOs, and a JWT-based Spring Security filter chain. Only the authenticated author who owns a post may edit or delete it — everyone else gets `403 Forbidden`, enforced with a custom `@PreAuthorize` expression.

### 4. E-commerce Product Catalog (Intermediate-Advanced)
Build a `Product` catalog with dynamic, composable search using JPA `Specification`s (filter by category, price range, and in-stock status in any combination), paginated and sortable results via `Pageable`, and a lightweight DTO projection for list views. The project ships with a full test pyramid: `@ExtendWith(MockitoExtension.class)` unit tests for the service, `@DataJpaTest` slice tests for the repository/specifications, `@WebMvcTest` for the controller, and a `@SpringBootTest` with Testcontainers spinning up real PostgreSQL for end-to-end integration coverage.

### 5. Order Processing System (Advanced)
Introduce cross-cutting performance and reliability patterns: `@Cacheable`/`@CacheEvict` around product lookups so repeated reads skip the database, `@Async` for firing order-confirmation emails without blocking the checkout request, and a `@Scheduled` cron job that compiles a nightly sales report. You will configure a dedicated `TaskExecutor` and reason about cache invalidation on stock updates.

### 6. Microservices: Order + Inventory (Advanced Capstone)
Split the domain into two independently deployable Spring Boot services — `order-service` and `inventory-service` — that call each other over `WebClient`. A Resilience4j circuit breaker (with a fallback method) protects the Order service from Inventory outages, Spring Boot Actuator exposes `/actuator/health` and `/actuator/metrics` on both services, and each service ships with its own multi-stage `Dockerfile` plus a `docker-compose.yml` that wires them together — the capstone that ties the whole course's REST, data, security, testing, and resilience skills into one deployable system.
