# Phase 12: Production & Deployment

> The final phase: taking a NestJS application from "runs on my machine" to "runs reliably in production."

---

## What You'll Learn

Every prior phase built the application itself — controllers, providers, modules, pipes, guards, interceptors, database access, tests, and microservices. This phase closes the loop by covering everything that sits *around* the application once it needs to survive real traffic, real incidents, and real deployments: structured logging you can actually search, health checks an orchestrator can poll, a faster HTTP adapter, security headers, rate limiting, response caching, and a production-grade Docker image with graceful shutdown.

By the end of this phase you will be able to take any Nest application built in Phases 01–11 and make it observable, secure, performant, and deployable — the same bar a senior backend engineer is expected to clear before an application goes live.

---

## Learning Objectives

- Replace Nest's built-in `Logger` with a production logger (Pino via `nestjs-pino`, or Winston) that emits structured JSON and preserves per-request context.
- Wire up `@nestjs/terminus` health checks — including database and memory indicators, and a custom indicator — and expose a `/health` endpoint suitable for Kubernetes liveness/readiness probes.
- Understand when and how to swap the default Express adapter for the Fastify adapter, and what changes when you do.
- Harden HTTP responses with `helmet`, protect endpoints from abuse with `@nestjs/throttler`, shrink payloads with compression, and cache expensive responses with `@nestjs/cache-manager`.
- Write a production-grade multi-stage Dockerfile that produces a slim runtime image, and manage environment variables safely across build and runtime.
- Implement graceful shutdown — `enableShutdownHooks()`, `OnModuleDestroy`, and SIGTERM handling — so in-flight requests and database connections close cleanly during a deploy or scale-down event.
- Know where to look next: this repo's Docker and Kubernetes courses for the deployment mechanics that sit below the application layer.

---

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Logging-and-Observability.md](./01-Logging-and-Observability.md) | Logging & Observability | 5-6 hours |
| [02-Performance-and-Security-Hardening.md](./02-Performance-and-Security-Hardening.md) | Performance & Security Hardening | 5-6 hours |
| [03-Containerization-and-Deployment.md](./03-Containerization-and-Deployment.md) | Containerization & Deployment | 5-6 hours |

---

## Estimated Time

**2 days** (as scoped in the course overview), or roughly 16-18 hours if you work through every worked example and exercise carefully.

---

## Previous Phase

[Phase 11: Microservices & Realtime](../Phase-11-Microservices-and-Realtime/README.md)

---

## What's Next

This is the final phase of the structured learning path. From here:

- **[Quick-Reference/](../Quick-Reference/)** — the NestJS cheatsheet for fast syntax lookup, and 50 interview questions spanning the entire course to test recall before an interview.
- **[Projects/](../Projects/)** — apply everything from Phases 01-12 in progressively larger hands-on builds, culminating in a microservices capstone. Re-run the production hardening from this phase (logging, health checks, throttler, Dockerfile) against your capstone project as a final integration exercise.
