# Custom Decorators and Metadata — Complete Guide

## Table of Contents
1. [Why Build Custom Decorators](#1-why-build-custom-decorators)
2. [createParamDecorator for Parameter Decorators](#2-createparamdecorator-for-parameter-decorators)
3. [Worked Example: @CurrentUser()](#3-worked-example-currentuser)
4. [SetMetadata — Attaching Metadata to Handlers](#4-setmetadata--attaching-metadata-to-handlers)
5. [Reading Metadata Back with Reflector](#5-reading-metadata-back-with-reflector)
6. [Composing Decorators with applyDecorators()](#6-composing-decorators-with-applydecorators)
7. [Worked Example: A Composed @ApiPaginatedResponse-Style Decorator](#7-worked-example-a-composed-apipaginatedresponse-style-decorator)
8. [Decorator Execution Order](#8-decorator-execution-order)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why Build Custom Decorators

By Phase 07 you were already using decorators Nest ships with — `@Get()`, `@Body()`, `@UseGuards()`, `@Roles()` (if you built it as an exercise). Custom decorators let you extend that same declarative style with your own reusable, self-documenting building blocks. Instead of writing `const user = request.user;` inside every handler that needs the authenticated user, you write `@CurrentUser() user: User` as a parameter — the extraction logic lives in exactly one place, and every handler's signature documents its own requirements.

Nest gives you three building blocks for this:

```
  ┌────────────────────────┬─────────────────────────────────────────────┐
  │ createParamDecorator    │ Build custom @Param()-style decorators       │
  │ SetMetadata              │ Attach arbitrary metadata to a handler/class │
  │ applyDecorators           │ Merge several decorators into one            │
  └────────────────────────┴─────────────────────────────────────────────┘
```

These three, combined with `Reflector` (used by guards and interceptors to read metadata back — covered in Phase 07 for `@Roles()`), are the complete toolkit behind almost every "magic" decorator you'll ever see in a Nest codebase or third-party library, including ones from `@nestjs/swagger` and `@nestjs/passport`.

---

## 2. createParamDecorator for Parameter Decorators

`createParamDecorator` builds a custom decorator usable exactly like `@Body()` or `@Param()` — as an argument to a route handler method. It takes a factory function that receives whatever data was passed to the decorator, plus an `ExecutionContext`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

The factory function signature is:

```typescript
(data: TData, ctx: ExecutionContext) => TReturn
```

- `data` is whatever you pass as the decorator's argument at the call site (e.g. `@CurrentUser('email')` → `data === 'email'`). Use it to let the same decorator extract either the whole object or a specific field.
- `ctx` is the familiar `ExecutionContext`, giving access to the raw request/response and the target handler/class.

The decorator can then be applied directly to a controller method parameter, and Nest resolves and injects the returned value automatically at request time, just as it does for `@Body()` or `@Query()`:

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('profile')
export class ProfileController {
  @Get()
  getProfile(@CurrentUser() user: User) {
    return user;
  }
}
```

---

## 3. Worked Example: @CurrentUser()

A more complete version supports both "give me the whole user" and "give me just this one field" from the same decorator, and assumes an upstream auth guard (e.g. a Passport `JwtAuthGuard` from Phase 07) has already attached `request.user`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      // The guard should have populated this — if not, fail loudly rather
      // than silently returning undefined to a handler that expects a user.
      return undefined;
    }

    return data ? user[data] : user;
  },
);
```

Usage — extracting the whole user object, or just one field:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  @Get('mine')
  findMyOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.findByUserId(user.id);
  }

  @Get('my-email')
  getMyEmail(@CurrentUser('email') email: string) {
    return { email };
  }
}
```

Note that `createParamDecorator`'s factory function runs on **every request** for that route, after guards have run (since it needs `request.user`, which a guard populated) but before the handler body executes — it is, in effect, a tiny, targeted, per-parameter interceptor.

A parameter decorator can also validate and throw, exactly like a pipe:

```typescript
import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const RequireCurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      throw new UnauthorizedException('No authenticated user on request');
    }
    return user;
  },
);
```

---

## 4. SetMetadata — Attaching Metadata to Handlers

`SetMetadata` attaches an arbitrary key/value pair to a route handler or controller class, storable in Nest's reflection metadata store (built on the `reflect-metadata` package covered in Phase 01). It doesn't do anything by itself — its entire value comes from being read back later by a guard or interceptor via `Reflector`. This is precisely the mechanism behind `@Roles()` from Phase 07.

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

Applied to a handler:

```typescript
import { Controller, Delete, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('orders')
@UseGuards(RolesGuard)
export class OrdersController {
  @Roles('admin', 'manager')
  @Delete(':id')
  remove() {
    // deletion logic
  }
}
```

At this point `@Roles('admin', 'manager')` has stored the array `['admin', 'manager']` under the key `'roles'` in the metadata attached to the `remove` handler function. Nothing has been enforced yet — enforcement is entirely the responsibility of whatever reads that metadata back, typically a guard.

`SetMetadata` can be used directly without a wrapper too, for one-off cases:

```typescript
import { SetMetadata } from '@nestjs/common';

@SetMetadata('isPublic', true)
@Get('health')
healthCheck() {
  return { status: 'ok' };
}
```

But defining a small named wrapper function (`Roles(...)`, `Public()`) is almost always preferable — it gives the metadata key a single source of truth, provides better type safety for the values, and reads more clearly at the call site than a raw string key.

---

## 5. Reading Metadata Back with Reflector

`Reflector` is the service that reads metadata attached by `SetMetadata` back out, typically inside a guard's `canActivate()` or an interceptor's `intercept()`:

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(), // method-level metadata takes priority
      context.getClass(),   // falls back to class-level metadata
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no @Roles() decorator present — no restriction
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    return requiredRoles.some((role) => user?.roles?.includes(role));
  }
}
```

`getAllAndOverride` is the method you almost always want: it checks the handler first, then the controller class, and returns the **first** match found — so a method-level `@Roles()` decorator overrides (rather than merges with) a class-level one. `getAllAndMerge` exists for cases where you actually want to combine both levels' values into one array instead.

---

## 6. Composing Decorators with applyDecorators()

`applyDecorators()` merges multiple decorators into a single custom decorator, so consumers apply one decorator instead of stacking several. This is invaluable once you find yourself repeatedly writing the same combination of decorators (a guard plus some metadata plus Swagger docs, for example) across many handlers.

```typescript
import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { ROLES_KEY } from './roles.decorator';

export function Auth(...roles: string[]) {
  return applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(JwtAuthGuard, RolesGuard),
  );
}
```

Instead of writing this on every protected, role-restricted endpoint:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Delete(':id')
remove() { /* ... */ }
```

Consumers now write just:

```typescript
@Auth('admin')
@Delete(':id')
remove() { /* ... */ }
```

`applyDecorators()` accepts any mix of decorator types — method decorators, class decorators, property decorators, parameter decorators — and applies them all to whatever it's attached to, in the order given. It is purely a composition helper; it introduces no new behavior of its own.

---

## 7. Worked Example: A Composed @ApiPaginatedResponse-Style Decorator

A common real-world need (directly inspired by `@nestjs/swagger`'s own decorators) is a single decorator that bundles OpenAPI documentation for a paginated list endpoint — response schema, a query-parameter description, and an example — so controllers don't need five separate Swagger decorators repeated on every list endpoint.

```typescript
import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiQuery,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const ApiPaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-indexed)' }),
    ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Items per page (max 100)' }),
    ApiOkResponse({
      description: `Paginated list of ${model.name}`,
      schema: {
        allOf: [
          {
            properties: {
              items: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              total: { type: 'number', example: 128 },
              page: { type: 'number', example: 1 },
              pageSize: { type: 'number', example: 20 },
            },
          },
        ],
      },
    }),
  );
};
```

Applied to a controller method:

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';
import { Order } from './entities/order.entity';

@Controller('orders')
export class OrdersController {
  @ApiPaginatedResponse(Order)
  @Get()
  findAll(@Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.ordersService.findAll(page, pageSize);
  }
}
```

One `@ApiPaginatedResponse(Order)` line now produces the equivalent of `@ApiExtraModels`, two `@ApiQuery` decorators, and a fully-typed `@ApiOkResponse` schema — all consistently shaped across every paginated endpoint in the API, with zero chance of one endpoint's documentation drifting out of sync with another's because someone forgot one of the five decorators.

---

## 8. Decorator Execution Order

Decorators in TypeScript execute **bottom-to-top** when multiple decorators are stacked on the same declaration — this applies to method decorators (like the ones Nest uses for routing, guards, and interceptors) exactly as it does to class or property decorators.

```typescript
function Log(label: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    console.log(`Decorating: ${label}`);
    return descriptor;
  };
}

class Demo {
  @Log('outer')
  @Log('middle')
  @Log('inner')
  method() {}
}

// Console output:
//   Decorating: inner
//   Decorating: middle
//   Decorating: outer
```

The decorator **closest to the declaration** runs first; decorators are then applied outward, like peeling layers off an onion in reverse — or equivalently, like function composition `outer(middle(inner(method)))`, where the innermost function must be constructed before it can be passed to the next one out.

This has a direct, practical consequence in Nest applications when you stack multiple `@UseGuards()`, `@UseInterceptors()`, or `@UseFilters()` decorators (or mix them with `@SetMetadata()`/`@Roles()`):

```typescript
@UseInterceptors(OuterInterceptor)
@UseInterceptors(InnerInterceptor)
@Get()
findAll() { /* ... */ }

// Decorator FACTORY functions run bottom-to-top when the class is defined
// (i.e. InnerInterceptor's decorator factory executes first), but this only
// affects the order metadata is REGISTERED — it does NOT change the order
// interceptors ACTUALLY RUN at request time, which Nest determines by the
// order interceptors were added to the metadata array, outer array position
// first. In practice, always prefer listing multiple guards/interceptors as
// ARGUMENTS to a single decorator call for a request-time order that reads
// top-to-bottom as written:

@UseInterceptors(OuterInterceptor, InnerInterceptor)
@Get()
findAll() { /* ... */ }
// Request-time order: OuterInterceptor(before) → InnerInterceptor(before)
//   → handler → InnerInterceptor(after) → OuterInterceptor(after)
```

This distinction — bottom-to-top *decorator factory evaluation* at class-definition time, versus left-to-right *array order* for request-time execution when multiple guards/interceptors/pipes are passed as arguments to one decorator — is one of the most commonly misunderstood details in Nest, and worth internalizing precisely because both orderings exist simultaneously in the same codebase and are easy to conflate.

For `applyDecorators()` specifically: since it just calls each supplied decorator in sequence at composition time, the same bottom-to-top rule that governs any stack of decorators applies to how `applyDecorators()` itself is defined internally, but as a *consumer* of a composed decorator like `@Auth('admin')`, you don't need to reason about internal ordering at all — that's precisely the point of composing them into one call.

---

## 9. Common Pitfalls

- **Assuming a parameter decorator built with `createParamDecorator` runs before guards.** It doesn't — parameter decorators resolve their value only when the handler is about to be invoked, which is after guards (and pipes acting on other parameters) have already run. If your decorator depends on something a guard attaches to the request (like `request.user`), that guard must be registered and must run first.
- **Forgetting that `SetMetadata` alone enforces nothing.** `@Roles('admin')` on a handler with no corresponding `RolesGuard` reading that metadata back is a complete no-op — the route remains fully open. The metadata and its enforcement guard are two separate pieces that must both be wired up.
- **Using `getAllAndMerge` when you meant `getAllAndOverride`, or vice versa.** `getAllAndOverride` takes the first (most specific) match only; `getAllAndMerge` combines every level's values. Using the wrong one silently produces different authorization behavior than intended — for instance, a class-level `@Roles('user')` unexpectedly widening a method-level `@Roles('admin')` if you used merge instead of override.
- **Conflating decorator-factory evaluation order with request-time execution order.** As shown in Section 8, these are two different orderings governed by different rules — don't assume that because decorator D was written above decorator E, D necessarily "runs first" in the sense of intercepting the request first.
- **Building a custom parameter decorator that silently returns `undefined` instead of throwing.** If `@CurrentUser()` returns `undefined` because no guard populated `request.user`, and the handler doesn't null-check, you get a confusing runtime error deep inside business logic rather than a clear 401 at the boundary.
- **Over-composing with `applyDecorators()`.** Bundling too many unrelated concerns into one custom decorator (e.g. auth + logging + caching + Swagger docs, all in one `@MegaDecorator()`) makes it hard to apply just one of those concerns independently later, and hides what's actually happening on a given route from a quick read of the controller.

---

## 10. Best Practices

- Give every `SetMetadata` key a named constant (e.g. `ROLES_KEY = 'roles'`) shared between the decorator and the guard/interceptor that reads it — never repeat the raw string key in two places, where it can silently drift out of sync.
- Wrap `SetMetadata` calls in a small, purpose-named function (`Roles(...)`, `Public()`, `RateLimit(...)`) rather than sprinkling raw `@SetMetadata('key', value)` calls through the codebase — this documents intent and centralizes the key/value contract.
- Use `Reflector#getAllAndOverride` as your default choice for reading metadata that can be set at both the method and class level, reserving `getAllAndMerge` for the specific cases where combining both levels' values is actually the desired behavior.
- Reach for `applyDecorators()` as soon as you notice the same 2–3 decorators appearing together across multiple handlers — this is a strong signal that they represent one logical concern (e.g. "this route requires an authenticated admin") that deserves its own name.
- Keep custom parameter decorators (`createParamDecorator`) narrowly scoped to extraction/validation of a single piece of request data — push anything more elaborate (business logic, database lookups) into a service the handler calls explicitly.
- Type your custom decorators as precisely as the built-in ones — a `data: keyof AuthenticatedUser | undefined` parameter, for example, gives you compile-time safety against typos like `@CurrentUser('emial')`.
- Document, in one place (ideally right next to the decorator's definition), which guards or interceptors a given piece of metadata depends on being read by — metadata with no consumer, or a consumer with no corresponding metadata-setting decorator, is a silent authorization gap waiting to happen.

---

## 11. Hands-On Exercises

**Exercise 1:** Build `@CurrentUser()` exactly as shown in Section 3, plumb a fake `JwtAuthGuard` that attaches a hardcoded `request.user` object, and confirm both `@CurrentUser()` (whole object) and `@CurrentUser('email')` (single field) work correctly on two different handlers.

**Exercise 2:** Build a `@Public()` decorator using `SetMetadata('isPublic', true)`, and a global `AuthGuard` that uses `Reflector#getAllAndOverride<boolean>('isPublic', [...])` to skip authentication entirely for any handler marked `@Public()`. Verify an unauthenticated request succeeds against a `@Public()` route and is rejected against every other route.

**Exercise 3:** Build the composed `@Auth(...roles)` decorator from Section 6 using `applyDecorators()`, bundling `@UseGuards(JwtAuthGuard, RolesGuard)` and `@SetMetadata(ROLES_KEY, roles)`. Apply it to a `DELETE` endpoint requiring the `'admin'` role and confirm a non-admin authenticated user receives a 403 while an admin succeeds.

**Exercise 4:** Write a small standalone script (outside of a Nest app, just plain TypeScript with `experimentalDecorators` enabled) with three stacked method decorators that each `console.log` a label when applied. Run it and confirm the output order matches the bottom-to-top rule described in Section 8. Then change one `@UseGuards(A)` / `@UseGuards(B)` pair on a real Nest controller into `@UseGuards(A, B)` and add logging inside each guard's `canActivate()` to confirm the request-time order matches the array-argument order, not the decorator-stack order.

**Exercise 5:** Build the `@ApiPaginatedResponse(Model)` composed decorator from Section 7 (or a simplified version without Swagger, if you don't have `@nestjs/swagger` installed — substitute any three arbitrary decorators you compose into one). Apply it to two different list endpoints for two different entities and confirm both correctly reflect their own entity's shape in the composed decorator's output/documentation.

---

## 12. Interview Q&A

**Q: What does createParamDecorator actually do, and when does its factory function execute relative to guards and pipes?**
Answer: `createParamDecorator` builds a custom decorator usable as a route handler parameter, exactly like the built-in `@Body()` or `@Param()`. Its factory function — which receives the decorator's argument data plus an `ExecutionContext` — executes when Nest resolves the handler's arguments, which happens after guards have run (since a custom parameter decorator commonly depends on something a guard attached to the request, like `request.user`) but immediately before the handler body executes. It is conceptually a small, targeted piece of argument-resolution logic, closer in spirit to a pipe than to a guard or interceptor.

**Q: How does SetMetadata relate to a decorator like @Roles(), and why doesn't SetMetadata do anything by itself?**
Answer: `SetMetadata(key, value)` attaches an arbitrary key/value pair to a handler or class's reflection metadata, built on the same `reflect-metadata` mechanism decorators use throughout Nest. `@Roles(...roles)` is simply a thin wrapper: `SetMetadata('roles', roles)`. By itself, this metadata is inert — it does not restrict access to anything. Enforcement only happens when a separate piece of code, typically a guard, reads that metadata back via `Reflector` (e.g. inside `canActivate()`) and makes an authorization decision based on it. The decorator and its enforcing guard are two independent pieces that must both be present for the metadata to have any effect.

**Q: What is the difference between Reflector's getAllAndOverride and getAllAndMerge?**
Answer: Both methods read metadata set at multiple levels (typically the handler method and the controller class) for a given key. `getAllAndOverride` checks each level in the order given and returns the value from the first level where metadata is present — so a method-level value fully overrides a class-level one, rather than combining with it. `getAllAndMerge` instead concatenates the values found at every level into one combined array. Choosing the wrong one produces silently different authorization behavior: for example, using merge when you meant override can cause a broad class-level role list to widen a narrower method-level restriction instead of being superseded by it.

**Q: What problem does applyDecorators() solve, and what does it not do?**
Answer: `applyDecorators()` merges several existing decorators into one new, named decorator, so that a combination of decorators repeatedly used together (like a guard plus role metadata plus Swagger documentation) can be applied to a handler with a single, self-documenting call instead of stacking several separate decorators every time. It does not add any new behavior of its own — it is purely a composition helper that applies each supplied decorator in sequence to whatever it's attached to. This keeps controllers concise and ensures a given combination of concerns (e.g. "requires an authenticated admin") stays consistent everywhere it's used, since there's only one place that combination is defined.

**Q: Explain decorator execution order in TypeScript for a stack of method decorators, and how this can be confused with Nest's request-time execution order.**
Answer: When multiple decorators are stacked on the same declaration, their decorator factory functions run bottom-to-top — the decorator closest to the method runs first, and execution proceeds outward, similar to nested function composition. This is a compile-/definition-time ordering. It is a separate concern from Nest's request-time execution order for something like `@UseGuards(A, B)` or `@UseInterceptors(A, B)`, where multiple items are passed as arguments to a single decorator call — there, Nest executes them in the left-to-right array order at actual request time. Conflating these two orderings — assuming that "decorator written last" always means "runs first at request time" — is one of the most common sources of confusion when reasoning about complex Nest pipelines.

**Q: Why would you throw an exception from inside a custom parameter decorator rather than letting it return undefined?**
Answer: A parameter decorator like `@CurrentUser()` is meant to guarantee that, by the time the handler body runs, the value it injects is valid and ready to use — that's the entire point of centralizing the extraction logic. If the expected upstream data (e.g. `request.user`, populated by an auth guard) is missing due to a misconfiguration or a bug, silently returning `undefined` defers the failure into the handler's business logic, where it manifests as a confusing, hard-to-trace runtime error. Throwing an explicit exception (e.g. `UnauthorizedException`) directly inside the decorator's factory function fails fast, at the boundary, with a clear and correctly-status-coded error — exactly where the actual problem is.
