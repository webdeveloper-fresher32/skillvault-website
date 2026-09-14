# Controllers and HTTP Method Decorators — Complete Guide

## Table of Contents
1. [What Is a Controller](#1-what-is-a-controller)
2. [The @Controller() Decorator and Path Prefixes](#2-the-controller-decorator-and-path-prefixes)
3. [HTTP Method Decorators](#3-http-method-decorators)
4. [Parameterized Routes](#4-parameterized-routes)
5. [Wildcard Routes](#5-wildcard-routes)
6. [Route Ordering — Static vs Dynamic Conflicts](#6-route-ordering--static-vs-dynamic-conflicts)
7. [Worked Example — A Full CRUD Controller](#7-worked-example--a-full-crud-controller)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What Is a Controller

A controller in NestJS is a class whose job is to receive incoming HTTP requests and return responses to the client. It is the layer that sits directly behind Nest's underlying HTTP adapter (Express by default, or Fastify) and translates raw HTTP traffic into typed method calls.

```
  Client Request
        │
        ▼
  ┌─────────────────────────────────────────────┐
  │  HTTP Adapter (Express / Fastify)            │
  └─────────────────────────────────────────────┘
        │  Nest matches method + path to a route
        ▼
  ┌─────────────────────────────────────────────┐
  │  Controller class                            │
  │    @Controller('users')                      │
  │    class UsersController {                   │
  │      @Get(':id')  findOne(@Param('id') id)   │
  │    }                                          │
  └─────────────────────────────────────────────┘
        │  handler executes, returns a value
        ▼
  ┌─────────────────────────────────────────────┐
  │  Response pipeline serializes return value    │
  │  → JSON body + status code sent to client     │
  └─────────────────────────────────────────────┘
```

Controllers are deliberately "thin" in idiomatic Nest applications — they should parse and validate incoming data, delegate the actual work to a provider (a service, injected via the constructor), and shape the response. Business logic belongs in providers (covered in Phase 4), not in the controller itself.

A controller is just a plain TypeScript class decorated with `@Controller()`. Nest discovers it by having it listed in the `controllers` array of a module (`@Module({ controllers: [UsersController] })`), at which point Nest instantiates it, resolves its constructor dependencies, and registers its routes with the underlying HTTP adapter during application bootstrap.

---

## 2. The @Controller() Decorator and Path Prefixes

`@Controller()` marks a class as a Nest controller and optionally attaches a **path prefix** that applies to every route defined inside it. This keeps related routes grouped together without repeating the prefix on every method decorator.

```typescript
import { Controller, Get } from '@nestjs/common';

// No prefix — routes are registered at the application root
@Controller()
export class AppController {
  @Get()
  getHello(): string {
    return 'Hello World!';
  }
}
```

```typescript
import { Controller, Get } from '@nestjs/common';

// Prefix: every route in this controller is under /users
@Controller('users')
export class UsersController {
  @Get()          // GET /users
  findAll() {
    return [];
  }

  @Get('active')  // GET /users/active
  findActive() {
    return [];
  }
}
```

### Multi-segment and versioned prefixes

The prefix can be a multi-segment path, and it can include a route parameter placeholder shared by every handler in the controller:

```typescript
@Controller('api/v1/users')
export class UsersV1Controller {
  @Get()  // GET /api/v1/users
  findAll() {
    return [];
  }
}
```

For real API versioning, prefer Nest's built-in versioning support over baking `v1` into the string prefix — it lets multiple versions of a controller coexist and be selected by header, media type, URI, or custom logic:

```typescript
// main.ts
import { VersioningType } from '@nestjs/common';

app.enableVersioning({
  type: VersioningType.URI, // GET /v1/users, GET /v2/users
});
```

```typescript
import { Controller, Get, Version } from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Version('1')
  @Get()
  findAllV1() {
    return { version: 1, data: [] };
  }

  @Version('2')
  @Get()
  findAllV2() {
    return { version: 2, data: [], meta: { total: 0 } };
  }
}
```

### Controller-level options object

`@Controller()` also accepts an options object, useful for scoping a controller to a specific host (subdomain routing) in addition to a path:

```typescript
@Controller({ path: 'admin', host: 'admin.example.com' })
export class AdminController {
  @Get('dashboard') // matches admin.example.com/admin/dashboard only
  getDashboard() {
    return { ok: true };
  }
}
```

---

## 3. HTTP Method Decorators

Each HTTP verb has a corresponding method decorator, all imported from `@nestjs/common`. A decorator applied to a controller method registers a route: `<controller prefix> + <decorator's path argument>`, matched against `<HTTP method> + <request path>`.

| Decorator | HTTP Method | Typical Use |
|-----------|-------------|--------------|
| `@Get()` | GET | Read a resource or collection |
| `@Post()` | POST | Create a new resource |
| `@Put()` | PUT | Replace a resource entirely |
| `@Patch()` | PATCH | Partially update a resource |
| `@Delete()` | DELETE | Remove a resource |
| `@Head()` | HEAD | Like GET but headers only, no body |
| `@Options()` | OPTIONS | CORS preflight / capability discovery |
| `@All()` | any | Matches any HTTP method for that path |

```typescript
import { Controller, Get, Post, Put, Patch, Delete } from '@nestjs/common';

@Controller('products')
export class ProductsController {
  @Get()
  findAll() {
    return [];
  }

  @Post()
  create() {
    return { id: 1 };
  }

  @Put(':id')
  replace() {
    return { id: 1, replaced: true };
  }

  @Patch(':id')
  update() {
    return { id: 1, updated: true };
  }

  @Delete(':id')
  remove() {
    return { id: 1, deleted: true };
  }
}
```

The decorator's path argument is optional. Omitting it (`@Get()`) registers the route at exactly the controller's prefix; passing a string (`@Get('active')`) appends a segment.

---

## 4. Parameterized Routes

Route parameters are declared with a colon prefix (`:id`) inside the path string passed to a method decorator. Nest extracts the matched segment and makes it available via `@Param()` (covered in depth in lesson 2 of this phase).

```typescript
import { Controller, Get, Param } from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get(':id')
  findOne(@Param('id') id: string) {
    return { id };
  }

  // Multiple params in one route
  @Get(':id/orders/:orderId')
  findOrder(@Param('id') id: string, @Param('orderId') orderId: string) {
    return { id, orderId };
  }

  // Optional parameter segment (Express adapter: append '?')
  @Get(':id/profile/:section?')
  findProfileSection(
    @Param('id') id: string,
    @Param('section') section?: string,
  ) {
    return { id, section: section ?? 'default' };
  }
}
```

Route params are always extracted as strings — Nest does not infer or coerce numeric types automatically. If `id` must be a number, either parse it manually or apply `ParseIntPipe` (`@Param('id', ParseIntPipe) id: number`), which is covered in the Pipes phase.

---

## 5. Wildcard Routes

Nest supports Express/Fastify-style wildcard patterns for matching flexible path shapes — useful for catch-all handlers, proxying, or matching a variable-depth path.

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('files')
export class FilesController {
  // Matches /files/abc, /files/abc/def, /files/abc/def/ghi, etc.
  @Get('*')
  serveAny() {
    return { message: 'wildcard matched' };
  }
}
```

```
  Wildcard matching examples for @Get('*'):
  ┌───────────────────────┬─────────────┐
  │ Request path           │ Matches?   │
  ├───────────────────────┼─────────────┤
  │ /files/report.pdf      │ yes        │
  │ /files/2024/report.pdf │ yes        │
  │ /files                 │ no (needs  │
  │                        │ a segment  │
  │                        │ after it)  │
  └───────────────────────┴─────────────┘
```

Named wildcard-style patterns using `*` as part of a segment are also valid (e.g. `ab*cd` matches `abcd`, `abXcd`, `abXYcd`). As of the underlying `path-to-regexp` versions used by recent Nest/Express releases, some advanced wildcard syntaxes changed between major versions — always verify wildcard behavior against the installed `@nestjs/platform-express` version, since overly clever patterns are a common source of route-matching regressions after a framework upgrade.

A catch-all route (`@All('*')`) at the end of a controller, or in a dedicated fallback controller, is a common pattern for returning a consistent 404 JSON payload instead of the platform's default HTML error page.

---

## 6. Route Ordering — Static vs Dynamic Conflicts

This is one of the most common early bugs in Nest routing. **Nest registers and matches routes in the order the handler methods are declared within the controller** (and in the order controllers are loaded for routes with equal specificity). A dynamic (parameterized) route declared before a static route with an overlapping shape will "steal" requests intended for the static route.

```typescript
@Controller('users')
export class UsersController {
  // BUG: this dynamic route is declared FIRST
  @Get(':id')
  findOne(@Param('id') id: string) {
    return { id };
  }

  // This will NEVER be reached — requests to /users/active
  // are already matched and consumed by findOne() above,
  // with id = 'active'
  @Get('active')
  findActive() {
    return { message: 'active users' };
  }
}
```

```
  Request: GET /users/active

  Declared order:           Actual match:
  1. @Get(':id')      ──────▶ MATCHES first → id = 'active'
  2. @Get('active')          never reached
```

The fix is simple but easy to forget under time pressure: **declare all static (literal) routes before any dynamic (parameterized) route that could overlap with them.**

```typescript
@Controller('users')
export class UsersController {
  @Get('active')        // static route declared FIRST
  findActive() {
    return { message: 'active users' };
  }

  @Get(':id')            // dynamic route declared AFTER
  findOne(@Param('id') id: string) {
    return { id };
  }
}
```

The same ordering hazard applies to any pair of routes where one is a strict subset match of the other, including nested static segments after a dynamic prefix (`:id/settings` declared after a catch-all `:id/*`), and to wildcard routes, which should almost always be declared last in a controller since `*` is maximally greedy.

---

## 7. Worked Example — A Full CRUD Controller

The following controller demonstrates prefixes, all five primary HTTP verb decorators, parameterized routes, and correct static-before-dynamic ordering, delegating actual persistence to an injected service (providers are covered in depth in Phase 4 — here `UsersService` is just illustrative).

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Static routes declared BEFORE the dynamic ':id' route below
  @Get('count')
  count() {
    // GET /users/count
    return { total: this.usersService.count() };
  }

  @Get('active')
  findActive() {
    // GET /users/active
    return this.usersService.findActive();
  }

  @Get()
  findAll() {
    // GET /users
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    // GET /users/42  (declared AFTER the static routes above)
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    // POST /users
    return this.usersService.create(createUserDto);
  }

  @Put(':id')
  replace(@Param('id') id: string, @Body() dto: CreateUserDto) {
    // PUT /users/42 — full replacement, requires the complete resource shape
    return this.usersService.replace(id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    // PATCH /users/42 — partial update, all fields optional in UpdateUserDto
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    // DELETE /users/42
    return this.usersService.remove(id);
  }
}
```

```typescript
// dto/create-user.dto.ts
export class CreateUserDto {
  name: string;
  email: string;
}

// dto/update-user.dto.ts — every field optional for a partial update
export class UpdateUserDto {
  name?: string;
  email?: string;
}
```

Note the ordering: `count` and `active` (static) come before `findAll` (no params, but least specific) and `:id` (dynamic) — this guarantees `GET /users/count` and `GET /users/active` never get accidentally captured as `id = 'count'` or `id = 'active'`.

---

## 8. Common Pitfalls

- **Declaring dynamic routes before static ones.** As shown above, `@Get(':id')` before `@Get('active')` silently swallows requests meant for the static route. This is the single most common controller routing bug in Nest apps and is easy to introduce when adding a new static endpoint to an existing controller without checking what already exists above it.
- **Forgetting that route params are always strings.** `@Param('id') id: string` receiving `/users/42` gives you the string `"42"`, not the number `42`. Comparing it with `===` against a number, or passing it directly into a query expecting a number type in some ORMs, causes subtle bugs. Use `ParseIntPipe` or manual coercion.
- **Overlapping prefixes across controllers.** Two controllers with the same or overlapping `@Controller()` prefix registered in the same module tree can produce confusing "which one wins" behavior, particularly with wildcard or catch-all routes. Keep prefixes unique per resource.
- **Wildcard routes registered too early.** A `@Get('*')` declared as the first method in a controller will match everything below it, making every subsequent route in that controller unreachable.
- **Assuming trailing slashes are equivalent.** Depending on the underlying adapter and its configuration, `/users` and `/users/` may or may not be treated as the same route. Don't rely on implicit normalization; be consistent in how clients and tests construct URLs.
- **Mixing up PUT and PATCH semantics.** Using `@Put()` for partial updates (and accepting a partial DTO) breaks the HTTP contract that PUT is a full replacement. Clients relying on standard REST semantics can end up with unintentionally nulled-out fields if your handler blindly overwrites the whole record with a partial body.

---

## 9. Best Practices

- **Keep one controller per resource**, with a clear, singular-or-plural-but-consistent prefix (`users`, not `user` in one controller and `users` in another).
- **Order handlers within a controller from most-specific-static to least-specific-dynamic**, and put wildcard/catch-all handlers last.
- **Keep controllers thin.** Controllers should extract/validate input and call a provider; they should not contain business logic, direct database calls, or complex conditionals — that logic belongs in an injectable service.
- **Use DTOs (typed classes) for request bodies** instead of `any` or inline object literals, even before wiring up `class-validator` (covered in Phase 6) — it documents the expected shape and gives you compile-time safety on property access.
- **Prefer Nest's built-in versioning (`@Version()` / `enableVersioning`)** over hand-rolled `v1`/`v2` string prefixes once you need more than one API version live simultaneously.
- **Use `@All('*')` sparingly and deliberately** — reserve it for genuinely generic behavior (proxies, catch-all 404 handlers), not as a substitute for specific route decorators.

---

## 10. Hands-On Exercises

**Exercise 1:** Scaffold a new `products` resource with the Nest CLI (`nest g controller products`, `nest g service products`). Implement `@Get()` (list all), `@Get(':id')` (find one), `@Post()` (create), `@Patch(':id')` (update), and `@Delete(':id')` (remove), backed by an in-memory array in the service. Verify all five routes with `curl` or an HTTP client.

**Exercise 2:** Deliberately introduce the static-vs-dynamic ordering bug: add a `@Get('featured')` route to your `products` controller declared *after* `@Get(':id')`. Confirm with a request to `/products/featured` that it is incorrectly captured by `findOne()` with `id = 'featured'`. Then fix the ordering and re-verify.

**Exercise 3:** Add a wildcard route `@Get('search/*')` to a controller that logs the full matched path. Test it against `/products/search/electronics`, `/products/search/electronics/laptops`, and plain `/products/search` — document which requests match and which don't, and explain why.

**Exercise 4:** Add API versioning to your `products` controller using `app.enableVersioning({ type: VersioningType.URI })` in `main.ts` and `@Version('1')` / `@Version('2')` on two variants of the `findAll()` handler. Confirm `GET /v1/products` and `GET /v2/products` route to the correct handler.

**Exercise 5:** Create a second controller, `ReportsController`, with prefix `reports`, containing a route `@Get(':year/:month')`. Add a static route `@Get('summary')` to the *same* controller in the wrong order (after the dynamic route), observe the bug via a request to `/reports/summary`, then correct the ordering. Write down, in your own words, the general rule you'd give a teammate to avoid this class of bug in code review.

---

## 11. Interview Q&A

**Q: What does the `@Controller()` decorator do, and what happens if you pass it a string argument?**
Answer: `@Controller()` marks a class as a Nest controller responsible for handling incoming HTTP requests, and registers it so that Nest's module system can discover and instantiate it. Passing a string argument (e.g. `@Controller('users')`) sets a path prefix that is prepended to every route declared by HTTP method decorators inside that class, so `@Get(':id')` inside `@Controller('users')` becomes the route `GET /users/:id`. Without an argument, routes are registered relative to the application root (or any global prefix set via `app.setGlobalPrefix()`).

**Q: Why would you get an unexpected result when calling GET /users/active if your controller also has a GET /users/:id route?**
Answer: Nest matches routes in the order handler methods are declared in the controller. If `@Get(':id')` is declared before `@Get('active')`, a request to `/users/active` matches the dynamic route first, treating `"active"` as the value of the `id` parameter — the static `active` route is never reached. The fix is to always declare more specific, static routes before dynamic/parameterized routes that could overlap with them.

**Q: What's the difference between using `@Put()` and `@Patch()` for an update endpoint, and does Nest enforce this semantic difference?**
Answer: By REST convention, PUT represents a full replacement of a resource (the client sends the complete new representation) while PATCH represents a partial update (only the fields being changed are sent). Nest does not enforce this semantic distinction itself — both decorators just register routes for their respective HTTP verbs and hand you whatever body was sent. Enforcing the difference is the developer's responsibility, typically by using a strict, fully-required DTO for `@Put()` handlers and an all-optional DTO for `@Patch()` handlers, combined with validation pipes.

**Q: How do wildcard routes work in Nest, and why is declaration order especially important for them?**
Answer: Nest passes wildcard patterns like `*` straight through to the underlying HTTP adapter's router (Express or Fastify), which treats `*` as matching any sequence of path segments after the prefix. Because a wildcard is maximally greedy, it will capture any request whose path matches its shape — so if a wildcard route is declared before more specific routes in the same controller, it intercepts requests meant for those routes. The best practice is to always declare wildcard/catch-all routes last in a controller.

**Q: How would you version a NestJS API, and why might you prefer Nest's built-in versioning over prefixing routes manually with `v1`/`v2`?**
Answer: Nest provides `app.enableVersioning()` in `main.ts` along with the `@Version()` decorator (usable at the controller or method level) to support URI-based, header-based, media-type-based, or custom versioning strategies. This is preferable to manually prefixing route strings with `v1`/`v2` because it's declarative, supports multiple versions of the same handler cleanly, integrates with Swagger/OpenAPI tooling, and supports strategies beyond the URL path (e.g., a version header), which a hand-rolled string prefix cannot express at all.

**Q: Can two different controllers register overlapping routes, and what happens if they do?**
Answer: Yes — Nest does not prevent two controllers (even in different modules) from declaring routes that resolve to the same HTTP method and path. The result depends on load order: whichever controller's route is registered with the underlying adapter first will handle matching requests, and the other route effectively becomes dead code, usually without any startup warning. This is why keeping controller prefixes unique per resource, and being deliberate about module import order, matters in larger applications — it's a class of bug that's easy to introduce silently when multiple teams own different modules.
