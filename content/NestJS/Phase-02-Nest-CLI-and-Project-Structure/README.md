# Phase 2: Nest CLI & Project Structure

## What You'll Learn

How real NestJS projects get created, organized, and bootstrapped. This phase moves you from reading about NestJS to having a running application on disk: installing the `@nestjs/cli`, generating a project with `nest new`, using schematics (`nest g module/controller/service/resource`) to scaffold code consistently, understanding every file the generator produces, and learning how `main.ts` turns your module tree into a listening HTTP server. It closes with `@nestjs/config`, the standard way NestJS applications manage environment-specific settings with type safety and startup-time validation.

## Learning Objectives

- Install and use the Nest CLI (`nest new`, `nest generate`/`nest g`) to scaffold projects and building blocks
- Read and modify `nest-cli.json` and understand standard vs. monorepo workspace modes
- Explain the purpose of every file in a freshly generated Nest project (`main.ts`, `app.module.ts`, `app.controller.ts`, `app.service.ts`, `*.spec.ts`)
- Trace the full bootstrap lifecycle from `NestFactory.create()` to a listening server
- Register global pipes, filters, and interceptors at bootstrap time and understand why that differs from controller/method-level registration
- Configure CORS, a global route prefix, and versioning during bootstrap
- Explain the HTTP adapter abstraction and swap between the Express and Fastify platforms
- Load, validate, and type environment configuration with `@nestjs/config` and a validation schema
- Inject `ConfigService` into providers and build a strongly-typed configuration object

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Nest-CLI-and-Scaffolding.md](01-Nest-CLI-and-Scaffolding.md) | Nest CLI, Schematics, and Generated Project Structure | 3 hours |
| [02-Application-Bootstrap-Process.md](02-Application-Bootstrap-Process.md) | The Application Bootstrap Process — `main.ts`, `NestFactory`, and Platform Adapters | 3 hours |
| [03-Configuration-with-ConfigModule.md](03-Configuration-with-ConfigModule.md) | Configuration with `@nestjs/config` — `ConfigModule`, Env Files, and Validation | 2 hours |

## Estimated Time

1 day

## Previous Phase

→ [Phase 1: TypeScript and Node Fundamentals](../Phase-01-TypeScript-and-Node-Fundamentals/README.md)

## Next Phase

→ [Phase 3: Controllers and Routing](../Phase-03-Controllers-and-Routing/README.md)
