# Role-Based Access Control & Custom Auth Decorators — Complete Guide

## Table of Contents
1. [From Authentication to Authorization](#1-from-authentication-to-authorization)
2. [SetMetadata and the @Roles() Decorator](#2-setmetadata-and-the-roles-decorator)
3. [Reading Metadata with Reflector](#3-reading-metadata-with-reflector)
4. [Building the RolesGuard](#4-building-the-rolesguard)
5. [Guard Execution Order — Why Auth Must Run Before Authorization](#5-guard-execution-order--why-auth-must-run-before-authorization)
6. [Combining JwtAuthGuard and RolesGuard](#6-combining-jwtauthguard-and-rolesguard)
7. [The @CurrentUser() Parameter Decorator](#7-the-currentuser-parameter-decorator)
8. [A @Public() Bypass Decorator](#8-a-public-bypass-decorator)
9. [Full Worked Example](#9-full-worked-example)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. From Authentication to Authorization

Lesson 2 covered **authentication** — proving *who* is calling (via a verified JWT). This lesson covers **authorization** — deciding *what that identity is allowed to do*. Role-based access control (RBAC) is the most common authorization model: each user has one or more roles (`admin`, `editor`, `viewer`), and each route declares which roles may access it.

```
  Authentication  →  "who are you?"          →  JwtAuthGuard (lesson 2)
  Authorization   →  "what can you do?"       →  RolesGuard   (this lesson)

  Both are implemented as guards, but they answer different questions
  and — critically — must run in that order, never reversed.
```

Nest doesn't ship a built-in RBAC system because "roles" mean different things in different apps (flat roles, hierarchical roles, permission-based ACLs). Instead, Nest gives you the primitives to build exactly the authorization model your app needs: custom metadata via `SetMetadata`, and a `Reflector` service to read that metadata inside a guard. This is the same general-purpose mechanism you'd reach for regardless of whether your model is roles, permissions, feature flags, or scopes.

---

## 2. SetMetadata and the @Roles() Decorator

`SetMetadata(key, value)` attaches arbitrary metadata to a route handler or a controller class using `reflect-metadata` under the hood. Calling it directly works but reads awkwardly at every call site, so the standard pattern wraps it in a small custom decorator:

```typescript
// roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type Role = 'admin' | 'editor' | 'viewer';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// usage
@Roles('admin')
@Delete(':id')
remove(@Param('id') id: string) { /* ... */ }

@Roles('admin', 'editor')
@Patch(':id')
update(@Param('id') id: string, @Body() dto: UpdateArticleDto) { /* ... */ }
```

`@Roles('admin')` by itself does **nothing** at runtime beyond attaching the array `['admin']` as metadata under the key `'roles'` on that method. It has no enforcement power on its own — it is inert data until something reads and acts on it, which is exactly what `RolesGuard` does in section 4. Exporting the key as a constant (`ROLES_KEY`) rather than a raw string literal in both the decorator and the guard avoids typo bugs where the two sides silently disagree on the metadata key.

---

## 3. Reading Metadata with Reflector

`Reflector` is an injectable Nest service that wraps `reflect-metadata`'s lookup APIs, making them ergonomic to use inside guards. It must be injected like any other provider — it is not a static/global utility.

```typescript
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  // ...
}
```

The most useful method for this pattern is `getAllAndOverride`, which checks handler-level metadata first and falls back to controller-level metadata if none is found on the handler — this lets you set a default at the controller level and override it per-route:

```typescript
const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
  context.getHandler(), // checked first (more specific)
  context.getClass(),   // checked second (fallback)
]);
```

```
  getAllAndOverride(key, [handler, class]):

  1. Look for metadata `key` on `handler` (the specific route method).
     Found?  →  use it, stop.
  2. Not found on handler → look on `class` (the controller).
     Found?  →  use it, stop.
  3. Not found on either  →  return undefined.

  Contrast with getAllAndMerge(), which combines metadata from BOTH
  levels into a single array instead of taking the first match — useful
  if handler-level roles should ADD TO controller-level roles rather
  than override them. Pick based on whether your semantics are
  "override" or "accumulate".
```

---

## 4. Building the RolesGuard

```typescript
// roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator present → route has no role restriction,
    // so this guard imposes nothing (authentication may still apply
    // via a separate guard).
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If there's no authenticated user by the time RolesGuard runs,
    // something upstream (JwtAuthGuard) was skipped or misordered.
    if (!user) {
      return false;
    }

    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

Note `RolesGuard` deliberately returns `false` (→ generic 403) rather than throwing when the role check fails — a `403 Forbidden` is the semantically correct response for "authenticated but not permitted," which is exactly the situation being handled. Compare this with `JwtAuthGuard` in lesson 2, which throws `UnauthorizedException` (401) for "not authenticated at all" — the two guards deliberately produce different status codes because they're answering different questions.

---

## 5. Guard Execution Order — Why Auth Must Run Before Authorization

`RolesGuard.canActivate()` reads `request.user`. That property only exists because `JwtAuthGuard` (via `JwtStrategy.validate()`) set it earlier in the pipeline. If `RolesGuard` runs *before* `JwtAuthGuard`, `request.user` is `undefined` and every role check fails — or worse, if written carelessly, silently passes when it shouldn't.

```
  CORRECT order:
  ┌─────────────────┐     ┌──────────────────┐
  │  JwtAuthGuard    │ ──▶ │   RolesGuard      │
  │  (authenticate)  │     │  (authorize)      │
  └─────────────────┘     └──────────────────┘
    sets request.user       reads request.user
                             (already populated)


  WRONG order:
  ┌──────────────────┐     ┌─────────────────┐
  │   RolesGuard      │ ──▶ │  JwtAuthGuard    │
  │  (authorize)      │     │  (authenticate)  │
  └──────────────────┘     └─────────────────┘
    reads request.user       sets request.user
    → undefined, every        (too late — RolesGuard
      role check fails          already ran)
```

Nest evaluates guards passed to `@UseGuards()` **in the array order given**, left to right. This means order is not automatic or inferred from guard "type" — it is entirely the developer's responsibility to list `JwtAuthGuard` before `RolesGuard`:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard) // correct: auth, then authz
@UseGuards(RolesGuard, JwtAuthGuard) // BUG: authz guard runs with no user set
```

This is one of the single most common real-world Nest auth bugs — it produces a guard that appears to work in manual testing (if you always test with a valid admin token that happens to also pass some other coincidental check) but fails inconsistently, or fails everything, depending on subtle changes elsewhere.

---

## 6. Combining JwtAuthGuard and RolesGuard

```typescript
// articles.controller.ts
import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard) // order matters: authenticate first
@Controller('articles')
export class ArticlesController {
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return { deleted: id };
  }
}
```

For an application-wide policy, both guards are commonly registered globally instead, again preserving order in the `providers` array registration — though note that `APP_GUARD` providers are also applied in registration order:

```typescript
// app.module.ts
import { APP_GUARD } from '@nestjs/core';

@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // registered first: authenticate
    { provide: APP_GUARD, useClass: RolesGuard },    // registered second: authorize
  ],
})
export class AppModule {}
```

With both applied globally, individual routes only need `@Roles(...)` — no `@UseGuards()` boilerplate per route — and routes with no `@Roles()` decorator are accessible to any authenticated user (since `RolesGuard` returns `true` when no roles are required, per section 4).

---

## 7. The @CurrentUser() Parameter Decorator

Reading `request.user` via `@Req() req: Request` works but leaks the raw Express `Request` type into every controller method and couples handlers to the transport layer. `createParamDecorator` lets you build a custom parameter decorator that extracts exactly the value you need:

```typescript
// current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    // Supports both @CurrentUser() for the whole object and
    // @CurrentUser('email') for a single field.
    return data ? user?.[data] : user;
  },
);
```

```typescript
// usage — clean, transport-agnostic, and precisely typed
@UseGuards(JwtAuthGuard)
@Get('me')
getProfile(@CurrentUser() user: AuthenticatedUser) {
  return user;
}

@UseGuards(JwtAuthGuard)
@Get('me/email')
getEmail(@CurrentUser('email') email: string) {
  return { email };
}
```

`createParamDecorator`'s factory function receives two arguments: `data` (whatever argument the decorator was called with, e.g. `'email'`) and `context: ExecutionContext` (the same object guards receive), so it has exactly the same request-extraction power as a guard, just scoped to producing one method parameter's value.

---

## 8. A @Public() Bypass Decorator

When `JwtAuthGuard` is applied globally (section 6), some routes — login, registration, health checks, public docs — need to be explicitly exempted. The standard pattern is a `@Public()` marker decorator plus a check inside the guard:

```typescript
// public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// jwt-auth.guard.ts (extended from lesson 2)
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // skip Passport entirely for this route
    }

    return super.canActivate(context);
  }
}
```

```typescript
// auth.controller.ts
@Public()
@Post('login')
async login(@Body() dto: LoginDto) { /* ... */ }
```

This is the exact same `SetMetadata` + `Reflector` mechanism as `@Roles()`, applied to grant a bypass instead of an additional restriction — recognizing this pattern is the key insight that unifies this entire lesson.

---

## 9. Full Worked Example

```typescript
// articles.controller.ts — everything from this phase combined
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { CreateArticleDto } from './dto/create-article.dto';
import { ArticlesService } from './articles.service';

@UseGuards(JwtAuthGuard, RolesGuard) // authenticate, THEN authorize
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Public() // no auth required at all — bypasses JwtAuthGuard entirely
  @Get()
  findAll() {
    return this.articlesService.findAll();
  }

  // Any authenticated user, no specific role required
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.articlesService.findOneWithViewTracking(id, user.id);
  }

  @Roles('editor', 'admin')
  @Post()
  create(@Body() dto: CreateArticleDto, @CurrentUser('id') authorId: string) {
    return this.articlesService.create(dto, authorId);
  }

  @Roles('admin') // only admins may delete
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(id);
  }
}
```

Trace this carefully: `findAll()` is marked `@Public()`, so `JwtAuthGuard` returns `true` immediately without running the JWT strategy at all, and `RolesGuard` finds no `@Roles()` metadata so it also returns `true` — the route is fully open. `findOne()` requires authentication (no `@Public()`) but no specific role. `create()` and `remove()` both require authentication *and* specific roles, checked in that order.

---

## 9.1 Testing RolesGuard in Isolation

Like the guards in lesson 1, `RolesGuard` can be unit tested with a hand-built `ExecutionContext` and a mock `Reflector` — no Nest bootstrap required. This is the same testing shape used throughout the phase, now extended to cover the metadata-reading path.

```typescript
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function createMockContext(user?: { roles: string[] }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when no @Roles() metadata is present', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createMockContext({ roles: ['viewer'] }))).toBe(true);
  });

  it('denies access when the user lacks the required role', () => {
    const reflector = { getAllAndOverride: () => ['admin'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createMockContext({ roles: ['viewer'] }))).toBe(false);
  });

  it('denies access when request.user is missing entirely', () => {
    const reflector = { getAllAndOverride: () => ['admin'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createMockContext(undefined))).toBe(false);
  });

  it('allows access when the user has one of several accepted roles', () => {
    const reflector = { getAllAndOverride: () => ['admin', 'editor'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createMockContext({ roles: ['editor'] }))).toBe(true);
  });
});
```

The third test case is the one worth internalizing: it directly exercises the "guard order bug" failure mode from section 5 — if `RolesGuard` ran before `JwtAuthGuard` in production, `request.user` would be `undefined` exactly like this test simulates, and the request would be denied (safe, if confusing) rather than incorrectly allowed. Writing this case explicitly turns an easy-to-miss ordering bug into a guarded regression.

---

## 10. Common Pitfalls

- **Forgetting to provide/inject `Reflector`.** `Reflector` must be injected via the constructor like any provider (`constructor(private reflector: Reflector) {}`); it does not need to appear in a module's `providers` array (it's provided by `@nestjs/core` globally), but a guard that fails to inject it and instead tries to call static reflect-metadata APIs directly will not correctly handle the handler/class fallback behavior `getAllAndOverride` provides.
- **Guard execution order bugs.** Listing `RolesGuard` before `JwtAuthGuard` in `@UseGuards()` (or registering the `APP_GUARD` providers in the wrong order) means `request.user` is `undefined` when `RolesGuard` runs — this is the single most common bug in this entire phase, covered in depth in section 5.
- **Storing JWT secrets insecurely.** Committing `JWT_SECRET` to source control, reusing the same secret across environments (dev/staging/prod), or using a short/guessable secret all undermine the entire authentication layer regardless of how correct the guard logic is — see lesson 2, section 10, for the same point in more depth.
- **Using string literals instead of exported metadata key constants.** Writing `SetMetadata('role', ...)` in the decorator but `reflector.get('roles', ...)` in the guard (note the typo/mismatch) fails silently — `getAllAndOverride` just returns `undefined`, which most implementations then treat as "no restriction," silently granting access.
- **Treating `@Roles()` as self-enforcing.** The decorator only attaches metadata; without `RolesGuard` actually applied to the route (directly or globally), `@Roles('admin')` has zero effect and the route remains open to any (or any authenticated) caller.
- **Not handling the "no roles required" case explicitly.** A `RolesGuard` that doesn't special-case an empty/missing `requiredRoles` array will incorrectly deny access to every route that doesn't use `@Roles()` at all.
- **Comparing roles with strict single-role equality instead of intersection.** `user.role === requiredRole` breaks the moment a user can have multiple roles; use an array-based `some()`/`includes()` check against `user.roles` as shown in section 4.

---

## 11. Best Practices

- Always pair an authorization guard with an authentication guard explicitly, and put authentication first — never rely on assumed default ordering.
- Export metadata keys (`ROLES_KEY`, `IS_PUBLIC_KEY`) as constants shared between the decorator and the guard that reads it, rather than repeating string literals.
- Prefer `getAllAndOverride` for "more specific wins" semantics (handler overrides controller); use `getAllAndMerge` only when accumulation is genuinely the desired behavior.
- Keep `@CurrentUser()` and similar decorators returning plain, transport-agnostic data shapes — never leak the Express `Request`/`Response` types through custom decorators used across many controllers.
- Register cross-cutting guards (`JwtAuthGuard`, `RolesGuard`) globally via `APP_GUARD` once the app has more than a couple of protected controllers, and use `@Public()`/`@Roles()` metadata to fine-tune per-route rather than repeating `@UseGuards()` everywhere.
- Write at least one test per guard confirming both the allow and deny paths, and one integration test confirming guard *order* — e.g., an unauthenticated request to a role-protected route must return 401, not 403, proving `JwtAuthGuard` ran and failed before `RolesGuard` ever got a chance to run.
- Keep the list of valid roles as a typed union (or enum) rather than bare strings, so `@Roles('adnim')` (typo) fails at compile time instead of silently creating a role nobody has.

---

## 12. Hands-On Exercises

**Exercise 1:** Implement `Roles`, `ROLES_KEY`, and `RolesGuard` exactly as in sections 2 and 4. Apply `@UseGuards(JwtAuthGuard, RolesGuard)` at the controller level and `@Roles('admin')` on a `DELETE` route. Confirm: an unauthenticated request → 401; an authenticated non-admin request → 403; an authenticated admin request → success.

**Exercise 2:** Deliberately swap the guard order to `@UseGuards(RolesGuard, JwtAuthGuard)` on a test route and observe the failure mode described in section 5. Document what status code you get and why, then fix the order and re-verify.

**Exercise 3:** Build the `@CurrentUser()` decorator from section 7, including the single-field extraction form (`@CurrentUser('email')`). Write two route handlers side by side — one using `@Req() req: Request` plus manual `req.user` access, one using `@CurrentUser()` — and compare the resulting type safety and readability.

**Exercise 4:** Implement the `@Public()` decorator and modify `JwtAuthGuard` per section 8. Register `JwtAuthGuard` and `RolesGuard` globally via `APP_GUARD` (in the correct order), then confirm a route marked `@Public()` is reachable with no `Authorization` header at all, while every other route now requires one by default.

**Exercise 5:** Extend the role model to support a hierarchy (`admin` implicitly has all `editor` and `viewer` permissions) instead of flat role matching. Modify `RolesGuard`'s comparison logic to expand a user's roles against a hierarchy map (e.g., `{ admin: ['admin', 'editor', 'viewer'], editor: ['editor', 'viewer'], viewer: ['viewer'] }`) before checking intersection with `requiredRoles`, and write down two test cases that would have behaved differently under flat matching versus hierarchical matching.

---

## 13. Interview Q&A

**Q: How does `@Roles('admin')` actually enforce anything — what mechanism connects the decorator to the guard?**
Answer: `@Roles('admin')` is built on `SetMetadata`, which attaches the array `['admin']` as reflect-metadata on the decorated method under a shared key constant. By itself this does nothing — it's inert data. `RolesGuard` (injected with a `Reflector`) reads that metadata off the current handler/class via `reflector.getAllAndOverride(ROLES_KEY, [context.getHandler(), context.getClass()])` and only then makes an allow/deny decision by comparing it against `request.user.roles`. The decorator and the guard are two independent halves connected only by that shared metadata key.

**Q: Why must a `JwtAuthGuard` run before a `RolesGuard`, and what happens if a project gets this backwards?**
Answer: `RolesGuard` decides access by reading `request.user.roles`, and `request.user` is only populated because an authentication guard (via the Passport strategy's `validate()` return value) set it earlier in the pipeline. If `RolesGuard` runs first, `request.user` is `undefined`, so every role check fails against `undefined.roles` — in the best case this manifests as every protected route becoming completely inaccessible (safe but broken); in a carelessly written guard it could instead default to allowing access, which is a serious security hole. Guard order in `@UseGuards()` (or `APP_GUARD` provider registration order) is left-to-right and is entirely the developer's responsibility — Nest does not infer or enforce a "correct" order.

**Q: What is `Reflector`, and why can't a guard just call `Reflect.getMetadata` directly instead?**
Answer: `Reflector` is an injectable Nest service (from `@nestjs/core`) that wraps the lower-level `reflect-metadata` API with Nest-aware convenience methods, most importantly `getAllAndOverride` and `getAllAndMerge`, which understand Nest's handler/class hierarchy and can check both levels with override or merge semantics in one call. You technically could call `Reflect.getMetadata` directly, but you'd have to hand-roll the handler-then-class fallback logic yourself, and you'd lose the clean DI-based testability that comes from `Reflector` being an injectable, mockable service.

**Q: What's the difference in intent between `RolesGuard` returning `false` versus throwing an exception, and which is correct for an authorization failure?**
Answer: Returning `false` produces a generic `403 Forbidden`, which is exactly the correct semantic for authorization failure — the caller is authenticated but simply isn't permitted to perform this action. This is different from an authentication guard, which should throw `UnauthorizedException` (401) to signal "you haven't proven who you are at all." Using the two different mechanisms deliberately preserves the 401-vs-403 distinction that well-behaved API clients rely on to decide whether to prompt for re-login (401) versus show a permissions error (403).

**Q: How would you exempt specific routes from a globally-applied authentication guard without removing the guard entirely?**
Answer: Build a marker decorator like `@Public()` using `SetMetadata` (the exact same primitive as `@Roles()`), then have the global guard's `canActivate` check for that metadata via `Reflector.getAllAndOverride` before doing any real authentication work, returning `true` immediately if the route is marked public. This reuses the identical metadata-and-reflector mechanism used for role restriction, just to grant a bypass rather than impose an additional check — recognizing that guards, `SetMetadata`, and `Reflector` form one general-purpose "read declarative per-route metadata inside a guard" pattern is the key unifying idea.

**Q: Why is `@CurrentUser()` preferred over `@Req() req: Request` plus manual `req.user` access in controller methods?**
Answer: `@CurrentUser()`, built with `createParamDecorator`, gives you a strongly-typed, transport-agnostic value extracted exactly once, in one place, rather than requiring every handler to know that the authenticated user lives at `request.user` and to import the framework-specific `Request` type just to reach it. It also supports single-field extraction (`@CurrentUser('email')`) and centralizes any future change to where/how the user is stored on the request (e.g., switching from Passport's default `request.user` to a custom property) to one decorator file instead of every controller that reads it.
