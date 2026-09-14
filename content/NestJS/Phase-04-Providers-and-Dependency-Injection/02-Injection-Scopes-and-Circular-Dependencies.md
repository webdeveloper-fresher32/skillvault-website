# Injection Scopes & Circular Dependencies — Complete Guide

## Table of Contents
1. [Why Scopes Exist](#1-why-scopes-exist)
2. [`DEFAULT` Scope — the Application-Wide Singleton](#2-default-scope--the-application-wide-singleton)
3. [`REQUEST` Scope — One Instance Per Incoming Request](#3-request-scope--one-instance-per-incoming-request)
4. [`TRANSIENT` Scope — A Fresh Instance Every Injection](#4-transient-scope--a-fresh-instance-every-injection)
5. [The Real Cost of `REQUEST` Scope — Scope Bubbling](#5-the-real-cost-of-request-scope--scope-bubbling)
6. [When `REQUEST` Scope Is Actually Justified](#6-when-request-scope-is-actually-justified)
7. [Circular Dependencies — Why They Happen](#7-circular-dependencies--why-they-happen)
8. [Worked Example — Reproducing and Fixing a Circular Dependency](#8-worked-example--reproducing-and-fixing-a-circular-dependency)
9. [Detecting Circular Dependencies Before They Bite](#9-detecting-circular-dependencies-before-they-bite)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Why Scopes Exist

By default, every provider in Nest is a **singleton**: one instance, shared across the entire application's lifetime, handed out to every consumer that asks for it. This is the right default for the overwhelming majority of providers — stateless services, repositories, loggers — because it avoids the cost of re-instantiating objects on every request and makes sharing state (like an in-memory cache) trivial.

But singleton scope is wrong for providers that need to hold **per-request state** — for example, a value tied to the currently authenticated user, or a request ID used for structured logging correlation. For these cases, Nest exposes **injection scopes**, which control *how many instances* of a provider exist and *when* they get created.

```
  Scope                Instances                      Lifetime
  ─────                ─────────                      ────────
  DEFAULT              1 (per application)             Application startup → shutdown
  REQUEST              1 (per incoming request)        Request start → request end
  TRANSIENT            1 (per injection site)           New instance every time it's injected
```

Scope is declared via the `scope` property in the `@Injectable()` decorator options, using the `Scope` enum from `@nestjs/common`.

---

## 2. `DEFAULT` Scope — the Application-Wide Singleton

```typescript
import { Injectable } from '@nestjs/common';

@Injectable() // Scope.DEFAULT is implicit — no option needed
export class UsersService {
  private callCount = 0;

  findAll() {
    this.callCount++; // shared state — persists across every request, every caller
    return { callCount: this.callCount };
  }
}
```

`UsersService` here is constructed exactly once, at bootstrap (or lazily on first use, if lazy module loading is configured), and every controller or service that injects it receives the **same object**. The `callCount` field genuinely accumulates across all requests from all clients — this is the behavior almost every provider in a well-designed Nest app should have, because it is cheap (one instantiation, ever) and predictable.

This is why singleton-scoped providers must be written to be **stateless, or deliberately and safely shared-state** — never store anything request-specific (like "the current user") in a fields of a default-scoped provider, since that field is shared by every concurrent request.

---

## 3. `REQUEST` Scope — One Instance Per Incoming Request

```typescript
import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  getCorrelationId(): string {
    return (this.request.headers['x-correlation-id'] as string) ?? 'unknown';
  }
}
```

A `REQUEST`-scoped provider gets a **brand-new instance for every incoming HTTP request**, and that instance is discarded once the request completes. This is what makes it possible to inject the special `REQUEST` token (the underlying Express/Fastify request object) directly into a provider's constructor — something that would make no sense for a singleton, since there is no single "current request" at the application level.

Any provider injecting the `REQUEST` token, or injecting *another* `REQUEST`-scoped provider, must itself be `REQUEST`-scoped — this constraint is the root of the performance concern covered next.

---

## 4. `TRANSIENT` Scope — A Fresh Instance Every Injection

```typescript
import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class AuditTrailBuilder {
  private readonly entries: string[] = [];

  record(entry: string) {
    this.entries.push(entry);
  }

  getEntries() {
    return this.entries;
  }
}
```

`TRANSIENT` scope produces a **new instance every time the provider is injected** — not per request, but per *injection site* (per consuming class). If `OrdersService` and `PaymentsService` both inject `AuditTrailBuilder`, each gets its own separate instance, isolated from the other, even within the same request. This is useful for short-lived, single-use builder/accumulator-style objects that must never leak state between consumers.

`TRANSIENT` is less commonly needed than `REQUEST` scope in typical CRUD applications — reach for it specifically when you want per-consumer isolation without per-request semantics.

---

## 5. The Real Cost of `REQUEST` Scope — Scope Bubbling

This is the single most important performance fact about Nest's DI system: **scope is contagious upward through the dependency graph.** If `ServiceA` is `REQUEST`-scoped and `ServiceB` injects `ServiceA`, then `ServiceB` also becomes effectively request-scoped — Nest must re-resolve and re-instantiate the *entire subtree* of providers that (transitively) depend on a request-scoped provider, on every single request.

```
  Scope bubbling — one REQUEST-scoped leaf infects everything above it:

  AppController  ─┐
                   │ injects
  OrdersService  ──┼─── injects ──▶ PricingService ──▶ RequestContextService
  (becomes         │                (becomes              (Scope.REQUEST,
   request-scoped) │                 request-scoped)        the ORIGINAL cause)
                   │
  ReportsService ──┘ injects ──▶ PricingService (same instance graph — also infected)

  Result: OrdersService, PricingService, ReportsService, and AppController's
  route handlers that touch them are ALL rebuilt from scratch on EVERY request,
  even though only RequestContextService actually needed per-request data.
```

The performance cost compounds because:

- **Instantiation happens on every request**, not once at bootstrap — for a subtree with expensive constructors (database clients, third-party SDK setup, heavy computation), this cost is paid repeatedly instead of once.
- **The garbage collector works harder** — every request produces a fresh object graph that must later be collected, increasing GC pressure under load compared to a small, fixed set of singletons.
- **The blast radius is often much larger than intended.** A single `REQUEST`-scoped provider deep in a shared module (like an auth or logging module imported everywhere) can silently make dozens of otherwise-stateless singleton services request-scoped, without anyone realizing it until a load test shows a latency regression.

Because of this, Nest's own documentation and most production teams treat `REQUEST` scope as an **opt-in exception, applied as narrowly as possible** — never as a default posture, and never applied "just in case."

---

## 6. When `REQUEST` Scope Is Actually Justified

Despite the cost, there are legitimate cases where `REQUEST` scope is the right tool:

- **Multi-tenancy**, where a request must be handled against a tenant-specific database connection, schema, or configuration resolved from the request (e.g. a subdomain or header identifying the tenant) — the resolved tenant context genuinely cannot be a singleton, since two concurrent requests may belong to different tenants.
- **Request-scoped logging/tracing context**, where a correlation ID, authenticated user ID, or trace span needs to be threaded through every log line emitted while handling one request, without manually passing it as a parameter through every function call.
- **Per-request feature flag or A/B test resolution**, where the active variant is determined once per request (e.g. from a cookie or header) and must be consistent for every service touched during that request.

The mitigation strategy in all of these cases is the same: **keep the `REQUEST`-scoped provider small and narrow, and isolate it behind an interface** so that only the minimal set of providers that truly need per-request data become request-scoped, rather than letting a core, widely-injected service become request-scoped by accident.

```typescript
// Narrow, isolated REQUEST-scoped provider — the pattern to prefer
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private tenantId: string;

  constructor(@Inject(REQUEST) request: Request) {
    this.tenantId = request.headers['x-tenant-id'] as string;
  }

  getTenantId() {
    return this.tenantId;
  }
}

// Only THIS service becomes request-scoped by association —
// business logic services that need tenant context inject
// TenantContextService directly, keeping the infected subtree small.
@Injectable({ scope: Scope.REQUEST })
export class TenantAwareOrdersService {
  constructor(private readonly tenantContext: TenantContextService) {}

  findAll() {
    return `orders for tenant ${this.tenantContext.getTenantId()}`;
  }
}
```

An alternative that avoids scope bubbling entirely for cross-cutting context like correlation IDs is **Node's `AsyncLocalStorage`**, which threads a value through an async call chain without involving Nest's DI scope system at all — many production teams prefer this for logging context specifically, reserving `REQUEST` scope for cases (like multi-tenant DB connections) where the value must actually be a Nest-managed provider.

---

## 7. Circular Dependencies — Why They Happen

A **circular dependency** occurs when two (or more) providers or modules depend on each other, directly or transitively, such that resolving one requires the other to already be resolved — which is impossible on a first pass.

```
  Provider-level cycle:                Module-level cycle:

  UsersService ──needs──▶ AuthService   UsersModule ──imports──▶ AuthModule
       ▲                       │              ▲                       │
       └──────needs────────────┘              └───────imports─────────┘

  UsersService needs AuthService,        UsersModule imports AuthModule's
  AuthService needs UsersService         exports, AuthModule imports
  (e.g. to look up user roles)           UsersModule's exports
  (e.g. to validate credentials)         (e.g. AuthModule needs
                                          UsersService, UsersModule
                                          needs an auth guard)
```

Nest's container resolves dependencies by building each provider bottom-up — but a cycle has no "bottom": each side is waiting on the other. When Nest detects this, bootstrap fails, and depending on the exact shape of the cycle and Nest version, the error can be a somewhat opaque message about a provider being `undefined` at runtime (if the cycle went partially unnoticed) or an explicit circular dependency error naming the modules/providers involved.

---

## 8. Worked Example — Reproducing and Fixing a Circular Dependency

**The setup:** `UsersService` needs `AuthService` to check permissions, and `AuthService` needs `UsersService` to look up user records during login.

```typescript
// users.service.ts — BEFORE the fix (broken)
import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(private readonly authService: AuthService) {}

  canEditUser(requesterId: number, targetId: number): boolean {
    return this.authService.hasPermission(requesterId, 'users:edit');
  }
}
```

```typescript
// auth.service.ts — BEFORE the fix (broken)
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  hasPermission(userId: number, permission: string): boolean {
    const user = this.usersService.findById(userId);
    return user?.permissions.includes(permission) ?? false;
  }
}
```

Running this produces a bootstrap-time error along the lines of:

```
Error: Nest cannot create the UsersService instance.
The module at index [0] of the UsersService dependencies is undefined.

Potential causes:
- A circular dependency between UsersModule and AuthModule.
- Use forwardRef() to work around this.
```

**Fix 1 — `forwardRef()` (the quick, structural fix).** `forwardRef()` tells Nest "resolve this reference lazily — don't try to evaluate it right now, evaluate it once both sides exist." It must be applied on **both** the provider constructor parameter and, if the cycle also crosses module boundaries, in each module's `imports` array.

```typescript
// users.service.ts — AFTER the fix
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  canEditUser(requesterId: number, targetId: number): boolean {
    return this.authService.hasPermission(requesterId, 'users:edit');
  }
}
```

```typescript
// auth.service.ts — AFTER the fix
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  hasPermission(userId: number, permission: string): boolean {
    const user = this.usersService.findById(userId);
    return user?.permissions.includes(permission) ?? false;
  }
}
```

If `UsersService` and `AuthService` live in different modules, the modules importing each other also need `forwardRef()`:

```typescript
// users.module.ts
@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

// auth.module.ts
@Module({
  imports: [forwardRef(() => UsersModule)],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

**Fix 2 — refactor the cycle away (the preferred, structural fix).** `forwardRef()` makes the cycle *work*, but the cycle itself is often a design smell: two services needing each other directly usually means a piece of shared logic should be extracted into a third, lower-level provider that both depend on instead.

```typescript
// permissions.service.ts — the extracted shared logic, no cycle
import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly usersRepository: UsersRepository) {}

  hasPermission(userId: number, permission: string): boolean {
    const user = this.usersRepository.findById(userId);
    return user?.permissions.includes(permission) ?? false;
  }
}
```

```typescript
// users.service.ts — depends on PermissionsService, not AuthService
@Injectable()
export class UsersService {
  constructor(private readonly permissionsService: PermissionsService) {}

  canEditUser(requesterId: number): boolean {
    return this.permissionsService.hasPermission(requesterId, 'users:edit');
  }
}

// auth.service.ts — also depends on PermissionsService, not UsersService
@Injectable()
export class AuthService {
  constructor(private readonly permissionsService: PermissionsService) {}

  hasPermission(userId: number, permission: string): boolean {
    return this.permissionsService.hasPermission(userId, 'users:edit');
  }
}
```

Neither `UsersService` nor `AuthService` depends on the other anymore — both depend downward on `PermissionsService`, which depends only on `UsersRepository`. The cycle is gone, `forwardRef()` is no longer needed, and the dependency graph is a clean tree again.

---

## 9. Detecting Circular Dependencies Before They Bite

Circular dependencies are easiest to deal with when caught during code review, not at bootstrap. A few practical detection habits:

- **Enable Nest's verbose bootstrap logging.** Running with `NEST_DEBUG=1` or reviewing the default Nest logger output at startup shows the order providers are instantiated in — a provider that never appears, or an application that hangs during initialization, is a strong signal of an unresolved cycle.
- **Use a dependency graph tool on the compiled output.** Tools like `madge` (`npx madge --circular --extensions ts ./src`) analyze your TypeScript/JavaScript import graph directly and print any circular `import` chains between files — since a provider-level circular dependency in Nest almost always corresponds to a circular `import` between the two provider files, this catches the problem before you even run the app.
- **Watch for the specific error shape.** Nest's circular dependency errors typically mention "is undefined" for a constructor argument, or explicitly say "a circular dependency" — but a *partial* cycle (where only one provider actually needs to be lazy) can sometimes manifest as a subtler `undefined` property access deep in application logic, well after bootstrap, rather than a clean startup failure. Treat any bootstrap-time `undefined` dependency as a circular dependency suspect first.
- **Draw the dependency graph by hand for any module with more than 4-5 cross-module relationships.** A quick sketch (as in Section 7) of "what depends on what" during design review catches cycles before they're written into code, and is far cheaper than debugging them after the fact.

```
  Graph sketch to keep in your design notes before writing providers:

  UsersModule ──▶ AuthModule       (UsersService needs AuthService)
  AuthModule  ──▶ UsersModule      (AuthService needs UsersService)
                                   ▲
                                   └── CYCLE — flag this before writing code,
                                       decide up front: shared PermissionsService,
                                       or accept forwardRef() with a comment
                                       explaining why.
```

Catching cycles at design time, rather than at the moment `NestFactory.create()` throws, is significantly cheaper — it avoids writing code around a broken shape only to have to unwind it later.

---

## 10. Common Pitfalls

- **Reaching for `Scope.REQUEST` as a default "to be safe."** This is the single most damaging DI habit in Nest apps — it silently infects every consumer up the graph and re-instantiates a potentially large subtree on every request, often for data (like a logger) that could have been handled with `AsyncLocalStorage` or a narrowly-scoped provider instead.
- **Not realizing scope bubbles through the graph.** Making one deep, widely-shared provider request-scoped (e.g. inside a common logging or auth module) can quietly make dozens of unrelated singleton services request-scoped without any explicit `scope: Scope.REQUEST` on them.
- **Applying `forwardRef()` on only one side of a circular pair.** Both the provider *and* the module (if the cycle crosses modules) typically need `forwardRef()` on both sides — fixing only one direction still leaves an unresolved token on the other.
- **Treating `forwardRef()` as the permanent fix rather than a workaround.** It resolves the bootstrap error, but a persistent circular dependency between core domain services is usually a sign of poor separation of concerns; the long-term fix is almost always extracting shared logic into a lower-level provider.
- **Confusing `TRANSIENT` scope with `REQUEST` scope.** `TRANSIENT` creates a new instance per *injection site*, not per HTTP request — a `TRANSIENT` provider injected into two different singleton services will still only be constructed twice total (once per consumer), not once per request.
- **Storing per-request state on a `DEFAULT`-scoped provider "just this once."** Under concurrent load this causes cross-request data leaks (one user's data appearing in another user's response) — a subtle bug that often only surfaces in production under real traffic.

---

## 11. Best Practices

- Default to no scope declaration at all (implicit `DEFAULT`/singleton) for every provider unless you have a concrete, articulated reason to do otherwise.
- When you do need per-request context, isolate it in the **smallest possible `REQUEST`-scoped provider** and have other services depend on that narrow provider, rather than making a core business service itself request-scoped.
- Consider `AsyncLocalStorage` instead of `REQUEST` scope for pure logging/tracing correlation context — it avoids scope bubbling entirely and is the pattern most high-traffic Nest services converge on.
- Treat any circular dependency error as a design signal first, and a `forwardRef()` problem second — spend a few minutes asking whether the shared logic between the two providers can be extracted before reaching for `forwardRef()`.
- If you do use `forwardRef()`, apply it consistently on both sides of the cycle (both providers, and both modules if the cycle crosses module boundaries) and leave a comment explaining *why* the cycle exists, so a future refactor doesn't reintroduce it accidentally when "fixing" what looks like leftover boilerplate.
- Load-test any feature that introduces `REQUEST` scope before shipping it — the performance cost is easy to underestimate by reading code and only becomes obvious under concurrent request volume.

---

## 12. Hands-On Exercises

**Exercise 1:** Create a `Scope.DEFAULT` `CounterService` with an `increment()` method and a `getCount()` method. Inject it into two different controllers and confirm (by hitting both controllers' routes) that the count is shared — proving singleton scope really is one instance application-wide.

**Exercise 2:** Convert `CounterService` from Exercise 1 to `Scope.REQUEST`. Inject it into a controller, call `increment()` twice within the same request handler, and log `getCount()` before the response is sent. Make two separate HTTP requests and confirm the count resets to zero each time — proving request scope creates a fresh instance per request.

**Exercise 3:** Build a `TRANSIENT`-scoped `IdGeneratorService` with a `generate()` method returning an internal counter's next value. Inject it into two different singleton services (`ServiceA` and `ServiceB`), call `generate()` a few times on each, and confirm the counters are independent — proving transient scope creates one instance per injection site, not per request.

**Exercise 4:** Reproduce the circular dependency from Section 8 exactly as shown (two services in two different modules, each needing the other) without `forwardRef()`. Run the app and read the actual error Nest produces. Then apply `forwardRef()` to both the provider constructors and both modules' `imports` arrays, and confirm the app boots successfully.

**Exercise 5:** Refactor the fixed-with-`forwardRef()` example from Exercise 4 into the cycle-free design from Section 8 (extract a `PermissionsService` that both `UsersService` and `AuthService` depend on instead of depending on each other). Remove all `forwardRef()` usages and confirm the app still boots and behaves identically from the outside — demonstrating that the structural fix eliminates the need for the workaround entirely.

---

## 13. Interview Q&A

**Q: What are the three injection scopes in NestJS and how do their instance lifetimes differ?**
Answer: `DEFAULT` (singleton) creates exactly one instance for the entire application lifetime, shared by every consumer. `REQUEST` creates a new instance for every incoming HTTP request, discarded once that request completes — this is what allows injecting the `REQUEST` token (the raw request object) into a provider. `TRANSIENT` creates a new instance for every injection site (every distinct consumer class), independent of request boundaries — two consumers of a transient provider each get their own instance, but that instance is reused across multiple requests handled by the same consumer instance's lifetime scope.

**Q: Why is `REQUEST` scope described as expensive, and what exactly does "scope bubbling" mean?**
Answer: Scope bubbles upward through the dependency graph — if a provider is request-scoped, every provider that (directly or transitively) depends on it also becomes effectively request-scoped, because Nest must rebuild that entire subtree fresh on every request rather than resolving it once at bootstrap. This means a single request-scoped provider buried deep in a widely-shared module (like auth or logging) can silently force dozens of otherwise-stateless singleton services to be re-instantiated on every request, increasing both constructor overhead and garbage collection pressure under load — often far beyond what the developer who added the request-scoped provider intended.

**Q: Give a legitimate use case for `REQUEST` scope, and explain how to limit its performance cost.**
Answer: Multi-tenancy is a strong case — resolving a tenant-specific database connection or schema from request data (a header or subdomain) genuinely cannot be a singleton, since concurrent requests may belong to different tenants. Request-scoped logging/tracing context (correlation IDs, current user) is another common case, though many teams prefer Node's `AsyncLocalStorage` for that specifically since it avoids scope bubbling entirely. To limit the cost when `REQUEST` scope is genuinely needed, isolate it in the smallest possible dedicated provider (e.g. a `TenantContextService`) and have other services depend on that narrow provider, rather than making a core, widely-injected business service itself request-scoped.

**Q: What causes a circular dependency error in NestJS, and what are the two ways to fix it?**
Answer: A circular dependency happens when two or more providers (or modules) depend on each other directly or transitively, so neither side can be fully resolved before the other — Nest's bottom-up resolution has no valid starting point for a cycle. The first fix is `forwardRef()`, which wraps the circular reference in both the constructor's `@Inject()` call and, if the cycle crosses module boundaries, both modules' `imports` arrays — this tells Nest to resolve the reference lazily once both sides exist, rather than immediately. The second, generally preferred fix is refactoring: extracting the shared logic both providers need into a third, lower-level provider that each depends on independently, removing the cycle from the design entirely rather than working around it.

**Q: Why does `forwardRef()` need to be applied on both provider constructors and both modules' `imports`, not just one side?**
Answer: The cycle exists in both directions simultaneously — `A` needs `B` and `B` needs `A` — so if only one side is wrapped in `forwardRef()`, Nest still tries to eagerly resolve the other, unwrapped reference immediately, and that resolution still fails because the cycle hasn't actually been broken, only halved. `forwardRef()` must be applied everywhere the cycle crosses a boundary (both provider-level references, and both module-level `imports` entries if the two providers live in separate modules) so that Nest defers evaluation on every edge of the cycle, allowing both sides to fully construct before either forward reference is dereferenced.

**Q: Why is `forwardRef()` generally considered a workaround rather than a permanent solution?**
Answer: `forwardRef()` makes a circular dependency resolvable, but it doesn't address why the cycle exists in the first place — two services needing each other directly is usually a sign that a piece of logic they both depend on (like permission checks in the classic `UsersService`/`AuthService` example) should be its own provider that both depend on downward instead. Leaving the cycle in place with `forwardRef()` also makes the codebase harder to reason about for future contributors, who have to understand the lazy-resolution mechanism just to trace a dependency, whereas a refactored tree-shaped graph is self-evidently correct by inspection.
