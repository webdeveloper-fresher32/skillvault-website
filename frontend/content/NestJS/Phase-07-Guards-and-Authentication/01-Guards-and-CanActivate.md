# Guards & CanActivate — Complete Guide

## Table of Contents
1. [What Is a Guard](#1-what-is-a-guard)
2. [Where Guards Sit in the Request Pipeline](#2-where-guards-sit-in-the-request-pipeline)
3. [The CanActivate Interface](#3-the-canactivate-interface)
4. [ExecutionContext — Getting the Request Out](#4-executioncontext--getting-the-request-out)
5. [Handler-Scoped, Controller-Scoped, and Global Guards](#5-handler-scoped-controller-scoped-and-global-guards)
6. [Worked Example — an API-Key Guard](#6-worked-example--an-api-key-guard)
7. [Guards and Dependency Injection](#7-guards-and-dependency-injection)
8. [Asynchronous Guards](#8-asynchronous-guards)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. What Is a Guard

A **guard** is a class annotated with `@Injectable()` that implements the `CanActivate` interface. Its single responsibility is to answer one yes/no question: **"is this request allowed to proceed to the route handler?"** Guards are Nest's dedicated mechanism for **authorization** — not authentication, not validation, not transformation. That single-responsibility split matters:

- **Middleware** — general-purpose request processing (logging, CORS, body parsing). No knowledge of which handler will run.
- **Guards** — authorization decisions ("can this request continue?"). Full knowledge of the target handler/class via `ExecutionContext`.
- **Pipes** — validation and transformation of route parameters (covered in Phase 6).
- **Interceptors** — wrap the handler call to add cross-cutting behavior before/after execution (logging, caching, response transformation).
- **Exception filters** — catch and format errors thrown anywhere in the pipeline.

Guards return (or resolve to) a `boolean`. `true` means the request continues; `false` means Nest immediately throws a `403 Forbidden` (`ForbiddenException`) without ever invoking the route handler. A guard can also throw its own exception (e.g., `UnauthorizedException`) to produce a more specific status code and message than the default 403.

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class AlwaysAllowGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return true; // request is always allowed through
  }
}
```

---

## 2. Where Guards Sit in the Request Pipeline

Understanding *when* a guard runs relative to everything else is essential — it explains what data is and isn't available to it, and why guards (not interceptors) are the right place for auth checks.

```
  Incoming HTTP Request
          │
          ▼
  ┌───────────────────────────────────────────────────┐
  │  1. Middleware                                     │
  │     (app.use(), functional or class-based)          │
  │     - runs for every matching route                 │
  │     - no knowledge of the target handler            │
  └───────────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────────────────────────────────────────┐
  │  2. Guards  (CanActivate)                           │
  │     - knows the target handler + class              │
  │     - authorization decision: allow / deny           │
  │     - runs BEFORE any pipe or interceptor            │
  └───────────────────────────────────────────────────┘
          │  (only if guard returns/resolves true)
          ▼
  ┌───────────────────────────────────────────────────┐
  │  3. Interceptors (pre-controller phase)             │
  │     - "before" logic runs here                      │
  └───────────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────────────────────────────────────────┐
  │  4. Pipes                                           │
  │     - validate/transform @Body()/@Param()/@Query()  │
  └───────────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────────────────────────────────────────┐
  │  5. Route Handler                                   │
  │     - your controller method executes               │
  └───────────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────────────────────────────────────────┐
  │  6. Interceptors (post-controller phase)            │
  │     - "after" logic (response mapping, logging)     │
  └───────────────────────────────────────────────────┘
          │
          ▼
  ┌───────────────────────────────────────────────────┐
  │  7. Exception Filters (only if something threw)     │
  └───────────────────────────────────────────────────┘
          │
          ▼
  Outgoing HTTP Response
```

Two consequences fall directly out of this ordering:

1. **Guards run before pipes.** A guard cannot rely on a DTO having already been validated/transformed — it only has the raw incoming request. If you need the *parsed* body to make an authorization decision, you either parse it yourself inside the guard or move that check into the handler.
2. **Guards run before interceptors.** This is why guards — not interceptors — are the correct layer for authentication and authorization. An interceptor that runs "before" logic still runs *after* a guard has already decided the request is allowed; putting an auth check in an interceptor means it runs too late to stop side effects that guards would have prevented (like logging metrics for a request that should never have started).

---

## 3. The CanActivate Interface

The interface has one method:

```typescript
interface CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean>;
}
```

`canActivate` can return synchronously (`boolean`), asynchronously (`Promise<boolean>` — the common case, since most real checks involve a DB lookup or token verification), or as an RxJS `Observable<boolean>`. Nest awaits/subscribes appropriately regardless of which form you choose.

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class SimpleAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['authorization'];

    if (!token) {
      // Throwing gives a precise status/message; returning false
      // would just produce a generic 403 Forbidden.
      throw new UnauthorizedException('Missing authorization header');
    }

    return this.isValid(token);
  }

  private async isValid(token: string): Promise<boolean> {
    // pretend async verification (DB lookup, JWT verify, etc.)
    return token.startsWith('Bearer ');
  }
}
```

A guard that returns `false` (without throwing) results in Nest raising `ForbiddenException` (`403`) automatically. Throwing your own exception (`UnauthorizedException` → `401`, `ForbiddenException` → `403`) gives callers a more accurate, more debuggable response and is the preferred pattern for real auth guards.

---

## 4. ExecutionContext — Getting the Request Out

`ExecutionContext` is the object Nest passes into `canActivate`. It extends `ArgumentsHost` and adds two capabilities beyond it: access to the current handler function and the current controller class, which is what makes metadata-driven guards (like the `RolesGuard` in lesson 3) possible.

```typescript
export interface ExecutionContext extends ArgumentsHost {
  getClass<T = any>(): Type<T>;
  getHandler(): Function;
}
```

`ArgumentsHost` itself is transport-agnostic — the same guard code can run under HTTP, WebSockets, or gRPC/microservices by switching context:

```typescript
const httpCtx = context.switchToHttp();
const request = httpCtx.getRequest<Request>();
const response = httpCtx.getResponse<Response>();

// For microservices:
// const rpcCtx = context.switchToRpc();
// const data = rpcCtx.getData();

// For WebSockets:
// const wsCtx = context.switchToWs();
// const client = wsCtx.getClient();
```

For a typical HTTP guard, the pattern is always the same three lines:

```typescript
@Injectable()
export class ExampleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    // request.headers, request.params, request.query, request.body, request.user...
    return true;
  }
}
```

`getHandler()` returns a reference to the specific controller method being invoked (e.g., `UsersController.prototype.findAll`), and `getClass()` returns the controller class itself (e.g., `UsersController`). Both are plain function/class references with no metadata attached by default — but `reflect-metadata` (via `SetMetadata`/`Reflector`, see lesson 3) lets you attach and read custom metadata off them, which is exactly how `@Roles()` communicates with `RolesGuard` without any direct coupling between the decorator and the guard.

```
  getHandler()  →  reference to the exact method,   e.g. findAll()
  getClass()    →  reference to the controller class, e.g. UsersController

  Both are used as "keys" to look up metadata attached via SetMetadata,
  using Reflector.getAllAndOverride() — see lesson 3.
```

---

## 5. Handler-Scoped, Controller-Scoped, and Global Guards

Guards can be applied at three levels, and Nest evaluates them outward-in when more than one applies to a request.

**Handler-scoped** — applies to one route method only:

```typescript
@Controller('users')
export class UsersController {
  @UseGuards(SimpleAuthGuard)
  @Get('me')
  getProfile() {
    return { message: 'profile' };
  }
}
```

**Controller-scoped** — applies to every route in the controller:

```typescript
@UseGuards(SimpleAuthGuard)
@Controller('users')
export class UsersController {
  @Get()
  findAll() { /* ... */ }

  @Get(':id')
  findOne() { /* ... */ }
}
```

**Global** — applies to every route in the application. Registered in `main.ts` or, preferably, as a provider in a module so the guard can use dependency injection (see section 7):

```typescript
// main.ts — guard has NO access to DI container
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalGuards(new SimpleAuthGuard());
  await app.listen(3000);
}
```

```typescript
// app.module.ts — guard CAN use DI (recommended)
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: SimpleAuthGuard,
    },
  ],
})
export class AppModule {}
```

```
  Execution order when multiple scopes apply to one request:

  Global guards  →  Controller guards  →  Handler guards
       │                    │                    │
       └── all must return/resolve true for the request to proceed ──┘

  ANY guard returning false (or throwing) short-circuits the chain
  immediately — later guards in the chain never run.
```

---

## 6. Worked Example — an API-Key Guard

A complete, realistic guard that protects internal/service-to-service routes with a static API key read from configuration — a common pattern for webhooks, admin endpoints, or internal microservice calls that don't warrant a full JWT flow.

```typescript
// api-key.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers['x-api-key'];

    if (!providedKey || typeof providedKey !== 'string') {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const expectedKey = this.configService.get<string>('INTERNAL_API_KEY');

    if (!expectedKey) {
      // Fail closed: a missing server-side secret must never be treated
      // as "any key is valid".
      throw new UnauthorizedException('API key auth is not configured');
    }

    if (providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
```

```typescript
// webhooks.controller.ts
import { Controller, Post, UseGuards, Body } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

@Controller('webhooks')
export class WebhooksController {
  @UseGuards(ApiKeyGuard)
  @Post('payment-provider')
  handlePaymentWebhook(@Body() payload: unknown) {
    // Only reachable if ApiKeyGuard.canActivate() returned true.
    return { received: true };
  }
}
```

```typescript
// webhooks.module.ts — ConfigService must be available for injection
import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { ApiKeyGuard } from './api-key.guard';

@Module({
  controllers: [WebhooksController],
  providers: [ApiKeyGuard],
})
export class WebhooksModule {}
```

Note the guard uses **timing-safe-ish equality only conceptually** here (`!==`) — for genuinely high-security static-secret comparisons, prefer `crypto.timingSafeEqual` to avoid timing side channels; a plain `!==` string comparison is fine for most internal tooling but is called out here so you know the gap exists.

---

## 7. Guards and Dependency Injection

Because guards are plain `@Injectable()` classes, they participate fully in Nest's DI container — they can inject any provider available in their module's scope (`ConfigService`, a `UsersService` for looking up a user record, a `Reflector`, etc.). This is precisely why `app.useGlobalGuards(new MyGuard())` in `main.ts` is discouraged for anything beyond the most trivial guard: instantiating the guard manually with `new` bypasses the DI container entirely, so any constructor dependency will be `undefined`. Always prefer the `APP_GUARD` token pattern shown in section 5 for global guards that need injected dependencies.

```typescript
@Module({
  imports: [ConfigModule],
  providers: [
    ApiKeyGuard, // now injectable elsewhere too, and DI-managed
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard, // Nest constructs it via DI, ConfigService resolves correctly
    },
  ],
})
export class AppModule {}
```

---

## 8. Asynchronous Guards

Almost every real guard needs to be asynchronous — verifying a JWT signature, looking up a user or an API key in a database, or calling an external identity provider are all async operations. Nest handles this transparently as long as `canActivate` returns a `Promise<boolean>`:

```typescript
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionsService: SessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionId = request.cookies?.sessionId;

    if (!sessionId) return false;

    const session = await this.sessionsService.findActive(sessionId);
    if (!session) return false;

    request.user = session.user; // attach for downstream handlers/decorators
    return true;
  }
}
```

Attaching the resolved identity onto `request.user` (or a similar property) inside the guard is the standard way authentication guards hand off the authenticated identity to the rest of the pipeline — it's exactly what Passport's `AuthGuard` does internally, and exactly what the `@CurrentUser()` decorator in lesson 3 reads from.

---

## 8.1 Testing Guards in Isolation

Because a guard is just a class with a `canActivate` method, it can be unit tested without bootstrapping any part of Nest — you only need an object shaped like an `ExecutionContext`. This is worth knowing well before lesson 2 introduces guards with real DI dependencies (`ConfigService`, `Reflector`), since the same mocking shape is reused throughout the phase.

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

function createMockContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  it('rejects a request with no x-api-key header', () => {
    const configService = { get: () => 'expected-key' } as any;
    const guard = new ApiKeyGuard(configService);
    const context = createMockContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('allows a request with a matching key', () => {
    const configService = { get: () => 'expected-key' } as any;
    const guard = new ApiKeyGuard(configService);
    const context = createMockContext({ 'x-api-key': 'expected-key' });

    expect(guard.canActivate(context)).toBe(true);
  });
});
```

Note that the guard is instantiated directly with `new ApiKeyGuard(configService)` here rather than through Nest's DI container — for a unit test this is exactly right, since it isolates the guard's logic from the wiring concerns covered in section 7. Only integration/e2e tests need the full Nest `TestingModule` bootstrap.

---

## 9. Common Pitfalls

- **Doing authorization in an interceptor instead of a guard.** Interceptors run after guards and are meant for cross-cutting "wrap the call" behavior, not admission control. An auth check in an interceptor still lets earlier interceptor logic and (depending on ordering) some side effects run before the check fails.
- **Returning `false` instead of throwing a specific exception.** A bare `false` always produces a generic `403 Forbidden`, which is less useful to API consumers than `401 Unauthorized` (not authenticated) vs `403 Forbidden` (authenticated but not permitted) — a distinction clients often branch on.
- **Instantiating global guards with `new` in `main.ts`.** This bypasses DI — any injected dependency in the guard's constructor will be `undefined` at runtime, often failing silently until the guard is actually exercised.
- **Forgetting a guard doesn't stop middleware side effects.** Middleware runs before guards, so if middleware has already mutated request state or wrote logs, a guard rejecting the request afterward will not undo that.
- **Assuming `request.body` is validated inside a guard.** Guards run before pipes, so `@Body()` DTOs have not yet been validated/transformed when a guard executes — never trust shape or types of the raw body inside a guard.
- **Not fail-closing when configuration is missing.** As shown in section 6, a missing expected secret/config value must reject the request, not silently allow it.

---

## 10. Best Practices

- Keep guards focused on the yes/no admission decision — push any heavier business logic (like fetching a full user profile) to a service the guard calls, not inline in the guard itself.
- Throw specific exceptions (`UnauthorizedException`, `ForbiddenException`) rather than returning `false`, so API consumers get meaningful status codes.
- Prefer the `APP_GUARD` provider pattern over `app.useGlobalGuards()` whenever the guard has any constructor dependencies.
- Attach the resolved identity to the request object (`request.user`) so downstream code (handlers, custom parameter decorators) has a single, consistent place to read it from.
- Combine guards with metadata (`SetMetadata` + `Reflector`) rather than writing many near-duplicate guard classes for slightly different authorization rules — see lesson 3.
- Write guards to fail closed: any ambiguous, missing, or misconfigured state should deny the request, never allow it by default.

---

## 11. Hands-On Exercises

**Exercise 1:** Implement a `MaintenanceModeGuard` that reads a `MAINTENANCE_MODE` environment variable via `ConfigService`. When `true`, the guard should throw a `ServiceUnavailableException` for every request except ones to a `/health` route. Apply it globally via `APP_GUARD`.

**Exercise 2:** Build an `IpAllowlistGuard` that extracts the client IP from `ExecutionContext` (`request.ip`) and checks it against a hardcoded allowlist array injected via a custom `ALLOWLIST` provider token. Apply it at controller scope on an `AdminController`.

**Exercise 3:** Modify the `ApiKeyGuard` from section 6 to support **multiple valid keys** (e.g., one per external partner), each mapped to a partner name, and attach the resolved partner name onto `request['partner']` so the controller can log which partner called the webhook.

**Exercise 4:** Write a unit test (conceptually — describe the test, no test runner needed for this Markdown-only course) for `ApiKeyGuard` that constructs a mock `ExecutionContext` via `createMock` or a hand-rolled object exposing `switchToHttp().getRequest()`, and verifies both the success and `UnauthorizedException` paths.

**Exercise 5:** Create three guards representing global, controller, and handler scope simultaneously on one route, each logging its own name to the console when invoked. Trace and write down the exact console output order to confirm the global → controller → handler execution sequence described in section 5.

---

## 12. Interview Q&A

**Q: Where do guards run in the Nest request lifecycle, and why does that matter?**
Answer: Guards run after middleware but before interceptors and pipes. Because they run before pipes, a guard cannot rely on `@Body()`/`@Query()` DTOs already being validated or transformed — it only sees the raw request. Because they run before interceptors, guards are the correct place for authorization checks: rejecting a request in a guard prevents any interceptor "before" logic, any pipe validation, and the handler itself from ever running, which is the whole point of an admission-control layer.

**Q: What is the difference between returning `false` from `canActivate` and throwing an exception?**
Answer: Returning `false` causes Nest to automatically throw a generic `ForbiddenException` (403). Throwing your own exception — `UnauthorizedException` (401) for "not authenticated" or `ForbiddenException` (403) for "authenticated but not permitted" — gives API consumers a more precise, more actionable status code and message. In production auth code you almost always want to throw explicitly rather than return `false`.

**Q: What does `ExecutionContext` give you that a plain Express request doesn't?**
Answer: `ExecutionContext` extends `ArgumentsHost` and adds `getHandler()` and `getClass()`, which return references to the exact controller method and controller class handling the request. This lets guards be transport-agnostic (`switchToHttp()`, `switchToRpc()`, `switchToWs()`) and, critically, lets them read custom metadata attached to a handler or class via `SetMetadata` — the mechanism behind `@Roles()` and similar decorators.

**Q: Why is `app.useGlobalGuards(new MyGuard())` discouraged compared to the `APP_GUARD` provider token?**
Answer: `useGlobalGuards` with a manually constructed instance bypasses Nest's DI container entirely — any constructor dependency on the guard (a service, `ConfigService`, `Reflector`, etc.) will be `undefined` at runtime. Registering the guard as a provider with the `APP_GUARD` injection token instead lets Nest construct it through the DI container like any other provider, so all its dependencies resolve correctly. The only time `useGlobalGuards` with `new` is acceptable is for a guard with zero dependencies.

**Q: How does guard scoping interact when a route has global, controller, and handler-level guards all applied?**
Answer: All applicable guards must return or resolve to `true` for the request to proceed; Nest evaluates them in outward-in order — global guards first, then controller-scoped guards, then handler-scoped guards. Any guard in the chain returning `false` or throwing immediately short-circuits the remaining guards and the handler itself, and the request never reaches interceptors or pipes.

**Q: Why are guards considered the "authorization" layer rather than the "authentication" layer, even though guards like `AuthGuard('jwt')` clearly perform authentication?**
Answer: Conceptually Nest treats guards as a general admission-control mechanism answering "can this request proceed?" — authentication (verifying identity) is one common *input* into that decision, but the guard's job is still the binary allow/deny call. In practice, an authentication guard like `JwtAuthGuard` both verifies identity and performs the binary check in one step, which is why it's implemented as a guard rather than as middleware: it needs `ExecutionContext` awareness (to read `@Public()` metadata, for instance) that plain middleware doesn't have.
