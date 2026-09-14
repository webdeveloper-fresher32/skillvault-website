# Global Modules and Application Layering — Complete Guide

## Table of Contents
1. [The @Global() Decorator](#1-the-global-decorator)
2. [When @Global() Is (Rarely) Appropriate](#2-when-global-is-rarely-appropriate)
3. [Why Overusing @Global() Is Dangerous](#3-why-overusing-global-is-dangerous)
4. [Layered Architecture in Nest Apps](#4-layered-architecture-in-nest-apps)
5. [The Controller Layer](#5-the-controller-layer)
6. [The Service Layer](#6-the-service-layer)
7. [The Repository Layer](#7-the-repository-layer)
8. [DTOs vs Entities](#8-dtos-vs-entities)
9. [Worked Example — Folder Structure for a Medium-Sized App](#9-worked-example--folder-structure-for-a-medium-sized-app)
10. [Monorepo vs Single App — When to Split](#10-monorepo-vs-single-app--when-to-split)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Best Practices](#12-best-practices)
13. [Hands-On Exercises](#13-hands-on-exercises)
14. [Interview Q&A](#14-interview-qa)

---

## 1. The @Global() Decorator

By default, every module's providers are scoped to that module and to whatever modules explicitly `import` it — this is the encapsulation model built up across Lessons 1 and 2. `@Global()` is the escape hatch: it marks a module's exported providers as available **everywhere** in the application, without requiring any other module to list it in `imports`.

```typescript
import { Global, Module } from '@nestjs/common';
import { AppLoggerService } from './logger/logger.service';

@Global()
@Module({
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class CommonModule {}
```

With `@Global()` applied, any provider anywhere in the app can inject `AppLoggerService` — even a feature module that never lists `CommonModule` in its own `imports` array. Important nuance: `@Global()` only affects the module it decorates, and that module must still be imported **once**, typically in `AppModule` — usually via `forRoot()` if it's also a dynamic module (`@nestjs/config`'s `ConfigModule.forRoot({ isGlobal: true })` uses exactly this combination internally). After that single import, `@Global()` makes its exports reachable from anywhere without further `imports` entries.

```
  Normal module:                          @Global() module:
  ┌──────────────┐                        ┌──────────────┐
  │ CommonModule │                        │ CommonModule │
  │ (no @Global) │                        │  @Global()   │
  └──────┬───────┘                        └──────┬───────┘
         │ must be imported                       │ imported ONCE (e.g. in AppModule)
         │ by EVERY consumer                       │
    ┌────┼────┐                                    ▼  (implicitly reachable everywhere)
    ▼    ▼    ▼                          ┌────┬────┬────┬─────────────┐
 Users Orders Payments                   Users Orders Payments  AnyOtherModule
 (each lists                             (none of these list CommonModule
  CommonModule                            in their own `imports` — it's
  in imports)                             just available)
```

---

## 2. When @Global() Is (Rarely) Appropriate

`@Global()` earns its keep for a narrow class of providers that are:

- **Truly used almost everywhere** in the application (not just "used by many feature modules," but genuinely foundational).
- **Stateless or safely shared** as a singleton — configuration readers, loggers, and similarly inert cross-cutting utilities.
- **Not part of your domain model** — global scope makes the most sense for infrastructure-level concerns, not business logic.

The textbook example is `@nestjs/config`'s `ConfigModule.forRoot({ isGlobal: true })`. Virtually every module in an application ends up needing `ConfigService` to read some environment-derived value, and re-importing `ConfigModule` into every single feature module purely to read `process.env` values adds ceremony without adding real safety — nobody meaningfully benefits from being forced to declare "this module needs configuration" over and over.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // ConfigService now available everywhere
    UsersModule,
  ],
})
export class AppModule {}
```

```typescript
// users/users.service.ts — no need to import ConfigModule here at all
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  constructor(private readonly config: ConfigService) {}
}
```

A hand-rolled `AppLoggerService` used by literally every controller/service in the app is a similarly reasonable candidate. A `PaymentsService`, on the other hand, almost never should be — that's domain logic that specific modules (Orders, Subscriptions) genuinely depend on, and that dependency should be visible in their `imports` array.

---

## 3. Why Overusing @Global() Is Dangerous

The entire value of Nest's module system is that the `imports` array documents a module's real dependencies. Marking modules `@Global()` liberally erodes that:

- **Hidden dependencies.** A feature module can inject a global provider without declaring any relationship to the module that owns it. Reading `UsersModule`'s code no longer tells you everything it depends on — you also have to know which modules elsewhere in the codebase happen to be marked `@Global()`.
- **Harder testing in isolation.** Unit/integration tests that build a minimal `Test.createTestingModule({ imports: [UsersModule] })` may unexpectedly fail (or unexpectedly *pass* when they shouldn't) depending on whether some unrelated global module happens to be registered, since global providers leak into every testing module too.
- **Naming collisions become app-wide.** Two unrelated `@Global()` modules that happen to export a provider under the same token will silently conflict, whereas normal module-scoped providers can reuse the same token safely because they're isolated by import boundaries.
- **Encourages "junk drawer" providers.** Once a module is global, there's a natural gravitational pull to keep adding "convenient" providers to it, since anything added becomes instantly available everywhere — this is precisely the dumping-ground failure mode module encapsulation is designed to prevent.

The practical rule of thumb: if you can imagine a plausible reason a *new* feature module might **not** want a given provider, it should not be global — it should be exported from a normal module and explicitly imported by whoever needs it.

---

## 4. Layered Architecture in Nest Apps

Beyond module boundaries, each feature module in a well-structured Nest app follows an internal layering convention. This isn't Nest-specific — it's the same controller/service/repository (or "handler/business-logic/data-access") layering found in most server frameworks — but Nest's decorators make each layer's responsibility explicit.

```
  HTTP Request
       │
       ▼
  ┌─────────────────────────────────────────────────────┐
  │ Controller layer                                     │
  │  - Route decorators (@Get, @Post, ...)               │
  │  - Parses/validates request shape via DTOs + Pipes    │
  │  - Delegates to service — NO business logic here      │
  └───────────────────────┬───────────────────────────────┘
                           ▼
  ┌─────────────────────────────────────────────────────┐
  │ Service layer                                         │
  │  - Business logic, orchestration, validation rules    │
  │  - Calls repository/other services                    │
  │  - Throws domain exceptions (NotFoundException, etc.) │
  └───────────────────────┬───────────────────────────────┘
                           ▼
  ┌─────────────────────────────────────────────────────┐
  │ Repository layer                                      │
  │  - Persistence only: queries, inserts, updates        │
  │  - No business rules — pure data access                │
  │  - Talks to DB driver / ORM / external data store      │
  └───────────────────────┬───────────────────────────────┘
                           ▼
                      Database / external store
```

Each layer only talks to the layer directly below it. A controller should never reach into a repository directly, and a repository should never contain business rules ("only allow cancellation within 24 hours") — that belongs in the service.

---

## 5. The Controller Layer

Controllers are the HTTP-facing edge. Their job is routing, parameter extraction, and delegating — nothing more.

```typescript
// orders/orders.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Delete(':id')
  cancel(@Param('id') id: string) {
    return this.ordersService.cancel(id);
  }
}
```

Notice there is no logic here beyond wiring HTTP verbs/params to service methods — the "can this order actually be cancelled" rule lives one layer down.

---

## 6. The Service Layer

Services hold the actual business rules and orchestrate calls to one or more repositories (and potentially other services, as seen with `OrdersService` depending on `UsersService` in Lesson 1).

```typescript
// orders/orders.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderStatus } from './entities/order.entity';

const CANCELLATION_WINDOW_HOURS = 24;

@Injectable()
export class OrdersService {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  create(dto: CreateOrderDto): Order {
    return this.ordersRepository.create(dto);
  }

  findOne(id: string): Order {
    const order = this.ordersRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  cancel(id: string): Order {
    const order = this.findOne(id);
    const hoursSinceCreation =
      (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60);

    // Business rule lives HERE, not in the controller or repository
    if (hoursSinceCreation > CANCELLATION_WINDOW_HOURS) {
      throw new BadRequestException(
        `Orders can only be cancelled within ${CANCELLATION_WINDOW_HOURS} hours`,
      );
    }

    return this.ordersRepository.updateStatus(id, OrderStatus.cancelled);
  }
}
```

---

## 7. The Repository Layer

The repository's only job is talking to storage. It knows nothing about business rules — it simply reads and writes.

```typescript
// orders/orders.repository.ts
import { Injectable } from '@nestjs/common';
import { Order, OrderStatus } from './entities/order.entity';

@Injectable()
export class OrdersRepository {
  private readonly orders = new Map<string, Order>();

  create(data: { userId: string; totalCents: number }): Order {
    const order: Order = {
      id: crypto.randomUUID(),
      userId: data.userId,
      totalCents: data.totalCents,
      status: OrderStatus.pending,
      createdAt: new Date(),
    };
    this.orders.set(order.id, order);
    return order;
  }

  findById(id: string): Order | undefined {
    return this.orders.get(id);
  }

  updateStatus(id: string, status: OrderStatus): Order {
    const order = this.orders.get(id)!;
    order.status = status;
    this.orders.set(id, order);
    return order;
  }
}
```

In a real application this class would wrap a TypeORM `Repository<Order>` (via `@InjectRepository(Order)`, using `forFeature()` from Lesson 2) or a Prisma client call instead of an in-memory `Map` — the point is that this layer is purely mechanical persistence, swappable independently of the business rules in `OrdersService`.

---

## 8. DTOs vs Entities

Two distinct data shapes flow through the layers, and conflating them is a common source of bugs and leaky abstractions.

- **DTO (Data Transfer Object)** describes the *shape of data crossing a boundary* — typically what a client sends in a request body, or what an API returns. DTOs are about the wire contract with validation rules (covered in depth in Phase 06 with `class-validator`).
- **Entity** describes the *shape of data as persisted* — it mirrors your database schema/ORM model and may carry fields (internal IDs, audit timestamps, soft-delete flags) that should never be exposed to or accepted from a client directly.

```typescript
// orders/dto/create-order.dto.ts — what a client is allowed to send
export class CreateOrderDto {
  userId: string;
  totalCents: number;
}
```

```typescript
// orders/entities/order.entity.ts — what actually gets persisted
export enum OrderStatus {
  pending = 'pending',
  cancelled = 'cancelled',
  fulfilled = 'fulfilled',
}

export class Order {
  id: string;
  userId: string;
  totalCents: number;
  status: OrderStatus;
  createdAt: Date;
}
```

A client creating an order supplies a `CreateOrderDto` (no `id`, no `status`, no `createdAt` — those are server-controlled). The service is the layer responsible for turning a DTO into a full entity, filling in the fields a client should never control directly. Returning entities straight from a controller is a common shortcut that later causes problems once an entity picks up fields (password hashes, internal foreign keys) that must never reach an API response — at that point, a third shape (a "response DTO" or serializer) is usually introduced.

---

## 9. Worked Example — Folder Structure for a Medium-Sized App

Combining Lessons 1-2's feature-module organization with this lesson's layering conventions, a medium-sized app (say, 5-8 domain areas) looks like this:

```
src/
├── main.ts
├── app.module.ts
│
├── common/                        ← @Global() candidate lives here (sparingly!)
│   ├── common.module.ts
│   ├── logger/
│   │   └── logger.service.ts
│   └── filters/
│       └── http-exception.filter.ts
│
├── config/
│   └── configuration.ts           ← plain function consumed by ConfigModule.forRoot()
│
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts        ← controller layer
│   ├── users.service.ts           ← service layer (business rules)
│   ├── users.repository.ts        ← repository layer (persistence)
│   ├── entities/
│   │   └── user.entity.ts
│   └── dto/
│       ├── create-user.dto.ts
│       └── update-user.dto.ts
│
├── orders/
│   ├── orders.module.ts
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   ├── orders.repository.ts
│   ├── entities/
│   │   └── order.entity.ts
│   └── dto/
│       └── create-order.dto.ts
│
├── payments/
│   ├── payments.module.ts
│   ├── payments.controller.ts
│   ├── payments.service.ts
│   ├── payments.repository.ts
│   ├── entities/
│   │   └── payment.entity.ts
│   └── dto/
│       └── create-payment.dto.ts
│
└── notifications/
    ├── notifications.module.ts
    ├── notifications.service.ts   ← no controller: internal-only module,
    │                                 consumed by Orders/Payments via events
    └── notifications.repository.ts
```

Each domain folder is internally layered (controller → service → repository, plus its own `entities/` and `dto/`), while `common/` holds the small set of genuinely cross-cutting utilities, and `config/` holds the plain configuration factory consumed by `ConfigModule.forRoot()`/`forRootAsync()` from Lesson 2. `NotificationsModule` shows that not every feature module needs a controller — some are purely internal collaborators invoked by other services or by event listeners.

---

## 10. Monorepo vs Single App — When to Split

Everything above still lives inside **one Nest application** — one `main.ts`, one deployable process, many internal modules. The Nest CLI also supports a **monorepo mode** (`nest generate app <name>`, `nest generate library <name>`) that lets a single repository host multiple independently deployable **apps** sharing common **libs**.

```
  Single-app mode (default):              Monorepo mode:
  my-project/                              my-project/
  ├── src/                                 ├── apps/
  │   ├── users/                           │   ├── api/
  │   ├── orders/                          │   │   └── src/ (controllers, main.ts)
  │   └── app.module.ts                    │   └── worker/
  ├── nest-cli.json                        │       └── src/ (queue consumers, main.ts)
  └── package.json                         ├── libs/
                                            │   ├── users/       ← shared feature lib
                                            │   ├── common/      ← shared utils lib
                                            │   └── database/    ← shared TypeORM setup
                                            ├── nest-cli.json (projects: {...})
                                            └── package.json (ONE set of deps for all apps)
```

**Stay a single app when:**
- You have one deployable process (one API server) and no strong need for a second one.
- Your feature modules already give you enough separation — the monorepo's main benefit (sharing code between *independently deployed* processes) doesn't apply if there's only one process.
- Your team is small, and the operational overhead of managing multiple `apps/*` entry points, build targets, and deploy pipelines isn't justified yet.

**Move to a Nest CLI monorepo when:**
- You genuinely need **multiple independently deployable processes** that share domain logic — e.g., a public REST API (`apps/api`) and a background job worker (`apps/worker`) that both need the same `UsersModule`/database entities, but must scale, deploy, and restart independently.
- You're extracting a piece of functionality into a **microservice** (Phase 11 covers Nest's microservice transporters) that still shares DTOs/entities/validation logic with the main API, and you want compile-time-checked shared code rather than a published npm package.
- You want strict internal boundaries enforced by tooling — libs in `libs/` can only be consumed via their public `index.ts` barrel export, giving you enforced encapsulation between teams/domains that plain feature-module folders inside one `src/` cannot enforce on their own.

**Do not reach for monorepo mode just to "organize" a single app better** — feature modules inside one `src/` tree (as shown in section 9) already solve the organizational problem. Monorepo mode solves a different problem: sharing code across multiple deployable Nest applications. Introducing it prematurely adds real overhead (separate `tsconfig` path mappings, per-app build configuration, more complex CI) with no corresponding benefit if there's still only one thing being deployed.

---

## 11. Common Pitfalls

- **Marking a module `@Global()` just to avoid re-typing `imports`.** This is almost always a shortcut that trades a few keystrokes for permanently hidden dependencies — it should be reserved for genuinely foundational, near-universal providers like configuration and logging.
- **Putting business logic in controllers.** A controller method that contains `if` statements implementing domain rules ("only cancel within 24 hours") makes that logic untestable without spinning up HTTP and impossible to reuse from, say, a queue consumer that needs the same rule.
- **Putting business logic in repositories.** Repositories that contain conditionals about *whether* an operation should happen (rather than just performing it) blur the boundary and make persistence code harder to swap out (e.g., migrating from TypeORM to Prisma) without also re-auditing business rules.
- **Returning entities directly from controllers.** Once an entity gains fields that must never be client-visible (password hashes, internal foreign keys, soft-delete markers), returning it as-is from a controller silently leaks that data in the JSON response.
- **Treating DTOs and entities as the same class.** A single class trying to serve both "what a client can submit" and "what gets persisted" inevitably grows optional fields and validation gaps, since the two shapes have different constraints.
- **Adopting monorepo mode prematurely.** Splitting into `apps/`+`libs/` before there is a second deployable process adds tooling overhead without any of the benefits multi-app sharing is meant to provide.

---

## 12. Best Practices

- Reserve `@Global()` for a small, deliberate set of infrastructure-level modules (configuration, logging) — treat every other cross-cutting need as a normal exported/imported module.
- Enforce the controller → service → repository layering consistently: controllers only orchestrate HTTP, services only implement business rules, repositories only touch storage.
- Keep DTOs and entities as separate classes even when they look identical today — they will diverge as soon as either side needs a field the other shouldn't have.
- Let each feature module's internal file layout (`*.controller.ts`, `*.service.ts`, `*.repository.ts`, `entities/`, `dto/`) stay consistent across the whole codebase, so any developer can navigate an unfamiliar feature module by pattern-matching against ones they already know.
- Don't reach for Nest CLI monorepo mode until you can name the second independently deployable process that needs to share code with the first.
- When you do adopt monorepo mode, put only genuinely shared, stable code in `libs/` — a lib that only one app ever imports is a sign the split wasn't necessary yet.

---

## 13. Hands-On Exercises

**Exercise 1:** Take an existing `PaymentsModule` and audit whether it should be `@Global()`. List three feature modules that would need to import it if it stayed non-global, and argue (in your own words, one paragraph) whether that repeated `imports: [PaymentsModule]` line is a cost worth paying for visibility, or genuine friction worth eliminating with `@Global()`.

**Exercise 2:** Refactor a controller that currently contains an inline business rule (e.g., `if (order.createdAt < someDate) throw ...` directly inside the `@Delete()` handler) by moving the rule into the service layer, leaving the controller as pure routing/delegation. Write a unit test for the service method that exercises the rule without touching HTTP at all.

**Exercise 3:** Create a `CreateProductDto` and a separate `Product` entity for a `ProductsModule`. Add a field to the entity (`internalCostCents`) that must never be returned to a client, and demonstrate the leak by returning the entity directly from a controller method, then fix it by mapping to a response shape that omits the field.

**Exercise 4:** Sketch (as a folder tree in a comment or scratch file) a medium-sized app with five feature modules of your choosing. For each module, decide whether it needs a controller at all, or whether it's a purely internal collaborator like `NotificationsModule` in section 9.

**Exercise 5:** Write a one-page (comment block) design decision memo: given a hypothetical app that currently has one API process, argue for or against introducing Nest CLI monorepo mode to add a second `apps/worker` process that consumes a queue and shares `UsersModule`'s entities with the API. Identify what would move into `libs/` versus what stays app-specific.

---

## 14. Interview Q&A

**Q: What does `@Global()` do, and why should it be used sparingly?**
Answer: `@Global()` makes a module's exported providers injectable from anywhere in the application without requiring consuming modules to list it in their own `imports` array — the module still needs to be imported once (usually in `AppModule`), but after that its exports are reachable everywhere. It should be used sparingly because it hides dependencies: a feature module injecting a global provider gives no indication in its own metadata of that relationship, which makes the codebase harder to read, harder to test in isolation, and more prone to naming collisions, since global providers implicitly leak into every module (including test modules) rather than being explicitly opted into.

**Q: Give an example of a legitimate use of @Global() and explain why it fits, contrasted with a case where it would be a mistake.**
Answer: `ConfigModule.forRoot({ isGlobal: true })` from `@nestjs/config` is a legitimate case — nearly every module in a real application needs to read configuration values, the provider (`ConfigService`) is stateless and safe to share, and it's infrastructure rather than domain logic, so forcing every module to explicitly re-import `ConfigModule` adds ceremony without real benefit. Marking a `PaymentsModule` as `@Global()`, by contrast, would be a mistake — payments are domain logic that only specific modules (Orders, Subscriptions) actually depend on, and hiding that dependency behind global scope removes useful information from the codebase about which parts of the system actually touch payment processing.

**Q: Describe the standard controller → service → repository layering in a Nest application and what belongs in each layer.**
Answer: The controller layer handles HTTP concerns only — route decorators, parameter/body extraction (via DTOs and pipes), and delegating to the service, with no business logic of its own. The service layer holds business rules, orchestrates calls to one or more repositories (or other services), and is responsible for throwing domain-level exceptions like `NotFoundException` or `BadRequestException`. The repository layer is purely mechanical persistence — queries, inserts, updates against a database or ORM — with no conditionals about whether an operation *should* happen, only how to perform it. Keeping these separate means business rules can be unit tested without HTTP or a live database, and either the transport layer or the persistence layer can be swapped independently.

**Q: What is the difference between a DTO and an entity, and why shouldn't a controller return an entity directly?**
Answer: A DTO describes the shape of data crossing an API boundary — what a client is allowed to send or what a response should look like — while an entity describes the shape of data as persisted, typically mirroring the database schema and carrying fields (internal IDs, audit fields, sensitive data) that a client should never see or set directly. Returning an entity straight from a controller risks leaking fields that were never meant to be public, such as password hashes or internal foreign keys; the safer pattern maps the entity to an explicit response shape (or a serialization decorator) at the controller/service boundary so the wire contract is deliberately controlled rather than accidental.

**Q: When should a team move from a single Nest application to Nest CLI monorepo mode with multiple apps and libs?**
Answer: Monorepo mode earns its cost when there are genuinely multiple independently deployable processes — for example a public API and a background worker — that need to share domain code (entities, DTOs, business logic) with compile-time checking rather than a published package. It should not be adopted merely to organize a single application better, since well-structured feature modules inside one `src/` directory already solve that problem; introducing `apps/`+`libs/` before a second deployable process exists adds real tooling overhead (separate build targets, path mappings, more complex CI) without a corresponding benefit.

**Q: How does a shared module (from Lesson 1) differ from a `@Global()` module in practice?**
Answer: Both let multiple feature modules use the same exported providers, but a shared module (like `CommonModule` in Lesson 1) still requires every consumer to explicitly list it in their own `imports` array, keeping the dependency visible and greppable in each module's metadata. A `@Global()` module removes that requirement entirely — once imported anywhere (typically in `AppModule`), its exports become available to every other module with no explicit `imports` entry needed. The practical trade-off is explicitness versus convenience: shared modules keep dependencies self-documenting at the cost of a repeated import line, while global modules trade that documentation away for reduced boilerplate, which is why global scope is reserved for a small set of truly foundational providers.
