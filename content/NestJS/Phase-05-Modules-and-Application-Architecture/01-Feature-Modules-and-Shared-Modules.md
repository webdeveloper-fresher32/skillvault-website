# Feature Modules and Shared Modules — Complete Guide

## Table of Contents
1. [Why Modules Exist](#1-why-modules-exist)
2. [Anatomy of @Module()](#2-anatomy-of-module)
3. [Organizing by Feature, Not by Layer](#3-organizing-by-feature-not-by-layer)
4. [Building a Feature Module — UsersModule](#4-building-a-feature-module--usersmodule)
5. [A Second Feature Module — OrdersModule](#5-a-second-feature-module--ordersmodule)
6. [Shared/Common Modules for Cross-Cutting Utilities](#6-sharedcommon-modules-for-cross-cutting-utilities)
7. [The Root AppModule — Composing Everything](#7-the-root-appmodule--composing-everything)
8. [Worked Example — Full Multi-Module App Structure](#8-worked-example--full-multi-module-app-structure)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why Modules Exist

Every Nest application has at least one module — the root `AppModule` — and in practice grows to have many. A module is not just an organizational convenience; it is the unit the Nest IoC (Inversion of Control) container uses to build the dependency graph. Every controller and provider must be declared in **exactly one** module. When Nest boots, it reads the module tree starting from the root, resolves each module's `imports`, and only then instantiates the providers and controllers declared within it.

```
  Application bootstrap:
  ┌───────────────────────────────────────────────────────────┐
  │  NestFactory.create(AppModule)                            │
  │                     │                                     │
  │                     ▼                                     │
  │       Nest reads AppModule's imports/controllers/providers│
  │                     │                                     │
  │                     ▼                                     │
  │   For each imported module, recursively resolve ITS       │
  │   imports/controllers/providers first (depth-first)       │
  │                     │                                     │
  │                     ▼                                     │
  │   Build a dependency injection graph across all modules   │
  │                     │                                     │
  │                     ▼                                     │
  │   Instantiate providers, wire constructor injection,      │
  │   register controller routes with the HTTP adapter        │
  └───────────────────────────────────────────────────────────┘
```

Without modules, a large application would be one flat bag of providers and controllers — impossible to reason about, and impossible to encapsulate. Modules give you:

- **Encapsulation** — a provider is private to its module unless explicitly `export`ed.
- **Reusability** — a well-designed feature module can be imported into multiple applications or dropped into a monorepo lib.
- **Lazy/scoped instantiation boundaries** — module boundaries interact with provider scopes (`REQUEST`, `TRANSIENT`) covered in Phase 04.
- **A map of the domain** — the module tree usually mirrors your business domains (Users, Orders, Payments, Notifications), which is far more maintainable than organizing purely by technical layer.

---

## 2. Anatomy of @Module()

The `@Module()` decorator accepts a single metadata object with four properties, all optional but each with a precise meaning.

```typescript
import { Module } from '@nestjs/common';

@Module({
  imports: [],      // other modules whose exported providers this module needs
  controllers: [],  // controllers instantiated and registered as part of this module
  providers: [],    // providers instantiated in this module's DI container
  exports: [],       // subset of `providers` (or re-exported imports) made available to consumers
})
export class ExampleModule {}
```

### `imports`

An array of other modules. Importing a module makes that module's **exported** providers available for injection inside the current module. It does not expose the imported module's controllers or its own non-exported providers.

### `controllers`

An array of classes decorated with `@Controller()`. Nest instantiates them and registers their route handlers with the underlying HTTP adapter (Express or Fastify). A controller is only ever declared in the `controllers` array of the module that owns it — never imported/exported.

### `providers`

An array of classes (or provider definition objects — see Phase 04 for custom providers, `useValue`, `useFactory`, `useClass`) that Nest instantiates and manages inside this module's DI container. These become injectable within the module, and into any controller/provider declared in the same module.

### `exports`

A subset of `providers` (or of imported modules/tokens) that becomes visible to any module that `imports` this one. Anything left out of `exports` is a private implementation detail of the module — this is the primary encapsulation mechanism in Nest.

```typescript
@Module({
  providers: [UsersService, UsersRepository],
  exports: [UsersService], // UsersRepository stays private to this module
})
export class UsersModule {}
```

Here, a consumer that imports `UsersModule` can inject `UsersService`, but cannot inject `UsersRepository` directly — it must go through the service. This is exactly the same idea as a private class member versus a public method.

---

## 3. Organizing by Feature, Not by Layer

A common early mistake is organizing a Nest project by **technical layer**:

```
src/
├── controllers/
│   ├── users.controller.ts
│   └── orders.controller.ts
├── services/
│   ├── users.service.ts
│   └── orders.service.ts
└── repositories/
    ├── users.repository.ts
    └── orders.repository.ts
```

This scales poorly. To understand "everything related to Users" you must open three different directories, and there is no natural module boundary — everything tends to end up in one giant `AppModule`. The idiomatic Nest structure organizes by **feature/domain**, with each feature module internally layered:

```
src/
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.repository.ts
│   ├── entities/
│   │   └── user.entity.ts
│   └── dto/
│       ├── create-user.dto.ts
│       └── update-user.dto.ts
├── orders/
│   ├── orders.module.ts
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   ├── orders.repository.ts
│   ├── entities/
│   │   └── order.entity.ts
│   └── dto/
│       └── create-order.dto.ts
├── common/
│   └── (shared cross-cutting code — see section 6)
└── app.module.ts
```

Each feature directory is a self-contained vertical slice: its own module, controller, service, persistence layer, DTOs, and entities. This mirrors how the Nest CLI's `nest generate resource` scaffolds things by default, and it is the structure assumed throughout the rest of this course.

---

## 4. Building a Feature Module — UsersModule

```typescript
// users/entities/user.entity.ts
export class User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}
```

```typescript
// users/dto/create-user.dto.ts
export class CreateUserDto {
  email: string;
  displayName: string;
}
```

```typescript
// users/users.repository.ts
import { Injectable } from '@nestjs/common';
import { User } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  private readonly users: User[] = [];

  create(data: { email: string; displayName: string }): User {
    const user: User = {
      id: crypto.randomUUID(),
      email: data.email,
      displayName: data.displayName,
      createdAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  findById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  findAll(): User[] {
    return this.users;
  }
}
```

```typescript
// users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  create(dto: CreateUserDto): User {
    return this.usersRepository.create(dto);
  }

  findOne(id: string): User {
    const user = this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  findAll(): User[] {
    return this.usersRepository.findAll();
  }
}
```

```typescript
// users/users.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
```

```typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService], // other modules can inject UsersService, not the repository
})
export class UsersModule {}
```

`UsersModule` is now a complete, self-contained vertical slice. It can be imported anywhere it's needed, and everything it depends on internally (the repository) stays hidden from consumers.

---

## 5. A Second Feature Module — OrdersModule

The real value of feature modules shows up once a second module needs to depend on the first. Suppose creating an order requires validating that the referenced user exists — `OrdersModule` needs `UsersService`.

```typescript
// orders/entities/order.entity.ts
export class Order {
  id: string;
  userId: string;
  totalCents: number;
  createdAt: Date;
}
```

```typescript
// orders/dto/create-order.dto.ts
export class CreateOrderDto {
  userId: string;
  totalCents: number;
}
```

```typescript
// orders/orders.repository.ts
import { Injectable } from '@nestjs/common';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersRepository {
  private readonly orders: Order[] = [];

  create(data: { userId: string; totalCents: number }): Order {
    const order: Order = {
      id: crypto.randomUUID(),
      userId: data.userId,
      totalCents: data.totalCents,
      createdAt: new Date(),
    };
    this.orders.push(order);
    return order;
  }

  findAll(): Order[] {
    return this.orders;
  }
}
```

```typescript
// orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { OrdersRepository } from './orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly usersService: UsersService, // cross-feature dependency
  ) {}

  create(dto: CreateOrderDto): Order {
    // Throws NotFoundException if the user doesn't exist — reuses UsersModule's logic
    this.usersService.findOne(dto.userId);
    return this.ordersRepository.create(dto);
  }

  findAll(): Order[] {
    return this.ordersRepository.findAll();
  }
}
```

```typescript
// orders/orders.controller.ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }
}
```

```typescript
// orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule], // gives access to UsersModule's *exported* providers
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService],
})
export class OrdersModule {}
```

`OrdersModule` imports `UsersModule` because it needs `UsersService`. It could not inject `UsersRepository` even if it tried — that provider was never exported. This is the encapsulation boundary from section 2 working exactly as intended: cross-feature dependencies flow through public services, never through another feature's persistence internals.

---

## 6. Shared/Common Modules for Cross-Cutting Utilities

Not everything belongs to a single feature. Things like a logging service, a date/currency formatting utility, or a wrapper around an external SDK are used by many feature modules but don't "belong" to any one of them. These live in a **shared module**, conventionally under `src/common/` or `src/shared/`.

```typescript
// common/logger/logger.service.ts
import { Injectable, Scope } from '@nestjs/common';

@Injectable()
export class AppLoggerService {
  log(context: string, message: string): void {
    console.log(`[${new Date().toISOString()}] [${context}] ${message}`);
  }

  error(context: string, message: string, trace?: string): void {
    console.error(`[${new Date().toISOString()}] [${context}] ERROR: ${message}`, trace ?? '');
  }
}
```

```typescript
// common/common.module.ts
import { Module } from '@nestjs/common';
import { AppLoggerService } from './logger/logger.service';

@Module({
  providers: [AppLoggerService],
  exports: [AppLoggerService], // the entire point of a shared module: export what others need
})
export class CommonModule {}
```

Any feature module that needs logging simply imports `CommonModule`:

```typescript
// users/users.module.ts (updated)
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
```

A module can be imported by many other modules simultaneously without being instantiated multiple times — Nest's module registry deduplicates by module class reference, so `CommonModule`'s providers are singletons shared across the whole app (unless the provider itself is scoped otherwise — see Phase 04). This is different from `@Global()` (covered in Lesson 3), which removes the need to `import` the module at all; a shared module like `CommonModule` still requires an explicit import in every consumer, which keeps the dependency visible and greppable.

---

## 7. The Root AppModule — Composing Everything

The root module's job is composition, not implementation. A healthy `AppModule` contains almost no logic of its own — it just wires together feature and shared modules.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [CommonModule, UsersModule, OrdersModule],
  controllers: [], // typically empty or just a health-check controller
  providers: [],   // typically empty — app-wide providers usually belong in CommonModule
})
export class AppModule {}
```

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

If `AppModule` starts accumulating its own controllers, providers, or business logic, that's a signal a new feature module should be extracted.

---

## 8. Worked Example — Full Multi-Module App Structure

Putting it all together, a small e-commerce-style backend with users, orders, and a shared logging/config layer looks like this:

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── common.module.ts
│   └── logger/
│       └── logger.service.ts
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.repository.ts
│   ├── entities/
│   │   └── user.entity.ts
│   └── dto/
│       └── create-user.dto.ts
└── orders/
    ├── orders.module.ts
    ├── orders.controller.ts
    ├── orders.service.ts
    ├── orders.repository.ts
    ├── entities/
    │   └── order.entity.ts
    └── dto/
        └── create-order.dto.ts
```

```
  Module dependency graph for this app:

  ┌───────────────┐
  │   AppModule    │
  └───────┬────────┘
          │ imports
     ┌────┼─────────────┬────────────┐
     ▼    ▼              ▼           
┌─────────┐  ┌──────────────┐  ┌──────────────┐
│ Common  │  │ UsersModule  │  │ OrdersModule │
│ Module  │◄─┤ (imports     │◄─┤ (imports     │
│         │  │  Common)     │  │  Users +     │
└─────────┘  └──────────────┘  │  Common)     │
                                └──────────────┘

  Exports flow the opposite direction:
  CommonModule  --exports AppLoggerService-->  Users, Orders
  UsersModule   --exports UsersService------->  Orders
```

Notice the graph is a DAG (directed acyclic graph) — `OrdersModule` depends on `UsersModule`, but `UsersModule` never depends on `OrdersModule`. Circular module dependencies are possible in Nest (via `forwardRef()`) but are a smell worth avoiding — they usually mean a piece of shared logic should be extracted into a third module both can depend on instead.

---

## 9. Common Pitfalls

- **Putting everything in `AppModule`.** As the app grows, developers add controllers/providers directly to `AppModule` "just to get it working," and the root module becomes an unmaintainable dumping ground. Extract a feature module as soon as a domain concept has more than one file.
- **Forgetting to `export` a provider.** A very common early error: `OrdersModule` imports `UsersModule` but injecting `UsersService` in `OrdersService` throws `Nest can't resolve dependencies` — because `UsersModule` never added `UsersService` to its `exports` array.
- **Forgetting to `import` the module at all.** The inverse mistake: `exports` is set correctly, but the consuming module never lists the provider's module in its own `imports` array. Exporting makes a provider *available*; importing is what actually *grants access* to it.
- **Exporting internal repositories/DAOs.** Exporting `UsersRepository` alongside `UsersService` defeats the purpose of layering — other modules should depend on behavior (the service), not on how data happens to be persisted.
- **Organizing by technical layer instead of by feature.** A `controllers/`, `services/`, `repositories/` top-level split scales poorly past a handful of endpoints and fights against Nest's module-per-feature philosophy.
- **Re-declaring a provider in multiple modules instead of sharing it.** If two feature modules each declare their own copy of, say, a caching service, you end up with two separate instances (and, if it holds state, subtly diverging behavior) instead of one shared singleton via a common module.
- **Circular imports between feature modules.** `UsersModule` importing `OrdersModule` while `OrdersModule` imports `UsersModule` will throw at bootstrap unless wrapped in `forwardRef(() => X)` on both sides — and even then, it usually indicates the two modules should share a third module instead.

---

## 10. Best Practices

- Default to **one module per feature/domain**, with the module, controller, service, repository, DTOs, and entities co-located in one directory.
- Keep `AppModule` a thin composition root — `imports` only, ideally.
- Export the **minimum surface** a module needs to expose — usually just the primary service, never repositories or internal helpers.
- Use a `common/` (or `shared/`) module for genuinely cross-cutting, stateless utilities — logging, generic HTTP client wrappers, date/currency helpers. If a "shared" module ends up needing feature-specific knowledge, that's a sign it should not be shared.
- Let the module dependency graph mirror your actual domain dependencies. If `OrdersModule` needs user data, that dependency should be explicit and visible via `imports: [UsersModule]` — don't reach around modules with global singletons.
- Use the Nest CLI (`nest g module users`, `nest g resource users`) to scaffold new feature modules consistently rather than hand-rolling file layouts each time.
- Prefer `forwardRef()` only as an escape hatch for legitimate circular relationships (rare) — treat recurring circular-import errors as a design signal to extract a shared module.

---

## 11. Hands-On Exercises

**Exercise 1:** Scaffold a `products/` feature module using the Nest CLI (`nest g resource products`). Give it a `ProductsController`, `ProductsService`, and an in-memory `ProductsRepository`. Export only `ProductsService` from `ProductsModule` and verify (by trying to inject the repository elsewhere) that `ProductsRepository` is genuinely inaccessible outside the module.

**Exercise 2:** Create a `ReviewsModule` that depends on `ProductsModule` to validate a `productId` exists before creating a review. Wire the import correctly, and deliberately remove `ProductsService` from `ProductsModule`'s `exports` array to reproduce and observe the `Nest can't resolve dependencies of ReviewsService` error, then fix it.

**Exercise 3:** Build a `CommonModule` containing an `AppLoggerService` and a simple `RequestIdService` (generates a UUID per call). Import `CommonModule` into two different feature modules and confirm (by logging an internal instance counter incremented in the service constructor) that only one instance of each shared provider is created across the whole app.

**Exercise 4:** Deliberately create a circular dependency: have `UsersModule` import `OrdersModule` (e.g., to show a user's order count) while `OrdersModule` already imports `UsersModule`. Observe the bootstrap error, then resolve it using `forwardRef(() => OrdersModule)` / `forwardRef(() => UsersModule)` on both sides. Afterward, discuss (in a comment) whether extracting a third module would have been the better fix.

**Exercise 5:** Take an intentionally "flat" small app (all controllers/services/repositories declared directly on `AppModule`) and refactor it into at least two feature modules plus one shared module, without changing any external HTTP behavior. Verify all existing routes still respond identically after the refactor.

---

## 12. Interview Q&A

**Q: What is the purpose of the `exports` array in `@Module()`, and what happens if you forget it?**
Answer: `exports` defines which of a module's providers (or re-exported imported modules) are visible to any module that imports it. Everything declared in `providers` but left out of `exports` is private to that module — an encapsulation boundary similar to a private class member. If you forget to export a provider that another module needs, Nest throws a `Nest can't resolve dependencies` error at bootstrap when the consuming module tries to inject it, because the DI container has no route to that provider from outside its owning module.

**Q: What's the difference between a provider being available via `providers` versus via `exports`?**
Answer: `providers` makes a class injectable *within* the module that declares it — into its own controllers and other providers in the same module. `exports` additionally makes it injectable in any module that lists this module in its own `imports` array. A provider can be in `providers` without being in `exports` (private to the module), but it cannot be usefully in `exports` without also being in `providers` (or imported from elsewhere) — you can only export what the module actually has access to.

**Q: Why does Nest recommend organizing an application by feature module rather than by technical layer (controllers/services/repositories folders)?**
Answer: Organizing by feature keeps everything related to one domain concept (routes, business logic, persistence, DTOs, entities) co-located and independently understandable, testable, and reusable — you can look at one directory to understand "everything about Orders." Organizing by technical layer scatters related code across three or more top-level folders, provides no natural module boundary, and tends to funnel everything into one oversized `AppModule` since there's no obvious unit to split into separate modules.

**Q: Can two different modules both import the same shared module — does that create two separate instances of its providers?**
Answer: No. Nest's module registry treats a module class as a singleton within the application's dependency graph (for the default module scope) — importing the same module from multiple places does not re-instantiate it or its providers. So a `CommonModule` exporting a `LoggerService` will result in exactly one `LoggerService` instance shared by every module that imports `CommonModule`, unless that specific provider is explicitly given a non-default scope like `REQUEST` or `TRANSIENT`.

**Q: When should cross-feature dependencies be avoided, and how do you handle a case where two feature modules seem to need each other?**
Answer: A cross-feature dependency is fine when it's a genuine one-directional domain relationship (Orders needs to validate a User exists). It becomes a problem when it's bidirectional — Module A needs something from B and B needs something from A — which produces a circular import that Nest can only resolve with `forwardRef()` on both sides. Rather than reaching for `forwardRef()` as a default fix, the better long-term solution is usually to extract the shared concern into a third module (or a shared interface/event) that both original modules can depend on independently, restoring a directed-acyclic module graph.

**Q: What should — and should not — live in the root `AppModule`?**
Answer: `AppModule` should primarily contain an `imports` array composing feature modules and shared/common modules; it is a composition root, not a place for business logic. It typically has an empty or near-empty `controllers`/`providers` array (perhaps a health-check controller). If `AppModule` starts accumulating its own controllers or providers directly, that is a signal that a new feature module should be extracted rather than growing the root module further — a bloated `AppModule` is one of the clearest signs of poor module architecture in a Nest codebase.
