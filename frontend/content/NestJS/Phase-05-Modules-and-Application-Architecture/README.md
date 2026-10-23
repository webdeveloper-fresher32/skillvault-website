# Phase 5: Modules & Application Architecture

## What You'll Learn

Modules are the organizational backbone of every Nest application — every controller and provider must belong to exactly one module's compilation context, and the module graph is what the Nest IoC container actually resolves when it wires up dependency injection. This phase moves past the single-module "hello world" app from earlier phases into how real, multi-feature Nest applications are structured: feature modules that own a vertical slice of the domain, shared modules for cross-cutting utilities, dynamic modules that accept runtime configuration (the `forRoot()`/`forFeature()` pattern used by `@nestjs/config` and `@nestjs/typeorm`), the `@Global()` decorator and why it should be used sparingly, and the layered architecture conventions (controller → service → repository, DTOs, entities) that keep a growing codebase navigable. By the end you'll be able to design a module graph for a medium-sized application and know when it's time to split into a Nest monorepo with multiple apps and libs.

## Learning Objectives

- Explain the four properties of `@Module()` — `imports`, `controllers`, `providers`, `exports` — and how they define a module's public/private surface
- Organize an application into feature modules (e.g. `UsersModule`, `OrdersModule`) that each own their own controllers, services, and entities
- Build shared/common modules for cross-cutting utilities (logging, config, database clients) and re-export them correctly
- Compose a root `AppModule` that imports feature modules without becoming a dumping ground
- Implement the `DynamicModule` interface and understand the `forRoot()` / `forRootAsync()` / `forFeature()` conventions
- Build a custom configurable dynamic module from scratch (a `LoggerModule.forRoot({...})` example)
- Know when (rarely) `@Global()` is appropriate, and why overusing it undermines module boundaries
- Apply a layered architecture (controller → service → repository, DTOs, entities) inside each feature module
- Decide when a growing application should split into a Nest CLI monorepo with multiple apps/libs, versus staying a single app

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Feature-Modules-and-Shared-Modules.md](01-Feature-Modules-and-Shared-Modules.md) | Feature Modules & Shared Modules — `@Module()` anatomy, organizing by domain, the root `AppModule` | 1 day |
| [02-Dynamic-Modules-and-forRoot-forFeature.md](02-Dynamic-Modules-and-forRoot-forFeature.md) | Dynamic Modules — `DynamicModule`, `forRoot()`/`forRootAsync()`/`forFeature()`, building a configurable module | Half day |
| [03-Global-Modules-and-Application-Layering.md](03-Global-Modules-and-Application-Layering.md) | Global Modules & Application Layering — `@Global()`, controller/service/repository layering, monorepo vs single app | Half day |

## Estimated Time

2 days

## Previous Phase

→ [Phase 4: Providers and Dependency Injection](../Phase-04-Providers-and-Dependency-Injection/README.md)

## Next Phase

→ [Phase 6: Pipes and Validation](../Phase-06-Pipes-and-Validation/README.md)
