# Pipes Fundamentals — Complete Guide

## Table of Contents
1. [What Is a Pipe](#1-what-is-a-pipe)
2. [The PipeTransform Interface](#2-the-pipetransform-interface)
3. [Where Pipes Sit in the Request Pipeline](#3-where-pipes-sit-in-the-request-pipeline)
4. [Built-In Pipes](#4-built-in-pipes)
5. [Pipe Scope — Parameter, Handler, Controller, Global](#5-pipe-scope--parameter-handler-controller-global)
6. [Worked Example — A Custom Trimming/Sanitizing Pipe](#6-worked-example--a-custom-trimmingsanitizing-pipe)
7. [Pipes and Exceptions](#7-pipes-and-exceptions)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What Is a Pipe

A **pipe** is a class annotated with `@Injectable()` that implements the `PipeTransform` interface. Pipes have exactly two jobs, and NestJS does not distinguish between them at the type level — a single pipe can do either or both:

- **Transformation** — convert input data from one shape to another (e.g., a route param string `"42"` becomes a JavaScript `number`).
- **Validation** — evaluate input data and, if it is invalid, throw an exception rather than let it reach the route handler.

Pipes operate on the arguments being passed to a controller's route handler (`@Body()`, `@Param()`, `@Query()`, `@Headers()` values). NestJS inserts the pipe **between the point where the argument is extracted from the request and the point where the handler method is actually invoked**. If a pipe transforms a value, the handler receives the transformed value, not the original one. If a pipe throws, the handler is never called and the exception propagates to the nearest exception filter.

```
  Incoming HTTP request
         │
         ▼
  @Body() / @Param() / @Query() extracted from request
         │
         ▼
  ┌─────────────────────────────┐
  │           Pipe(s)           │  ← transform and/or validate here
  └─────────────────────────────┘
         │
         ▼
  Route handler method invoked with (possibly transformed) arguments
```

This is a deliberate design choice: by the time your controller method body runs, you should be able to trust that `id` really is a number and `body` really matches your DTO's shape. Pipes are what make that guarantee possible.

---

## 2. The PipeTransform Interface

Every pipe implements `PipeTransform<T, R>`, a generic interface with a single method:

```typescript
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class ExamplePipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    return parseInt(value, 10);
  }
}
```

- `T` is the type of the incoming value.
- `R` is the type returned by `transform()` — this is what the handler actually receives.
- `transform(value, metadata)` is called by the Nest runtime with the raw argument value and an `ArgumentMetadata` object describing where that value came from.

### ArgumentMetadata

```typescript
export interface ArgumentMetadata {
  type: 'body' | 'query' | 'param' | 'custom';
  metatype?: Type<unknown>;
  data?: string;
}
```

| Field      | Meaning                                                                                     |
|------------|-----------------------------------------------------------------------------------------------|
| `type`     | Which decorator supplied the value — `body`, `query`, `param`, or `custom` (a custom decorator) |
| `metatype` | The TypeScript type declared for the parameter, e.g. `CreateUserDto` — undefined if the param has no type or is a primitive without design:type metadata reflection enabled |
| `data`     | The string passed to the decorator, e.g. `@Param('id')` → `data` is `'id'`                    |

`metatype` is what makes automatic DTO validation possible — the global `ValidationPipe` inspects `metatype` to decide which class's decorators to validate against (covered in lesson 2). If a parameter has no explicit type (or is a native JS type like `String`, `Boolean`, `Number`, `Array`, `Object`), most validation pipes skip it, since there's nothing meaningful to validate against.

---

## 3. Where Pipes Sit in the Request Pipeline

NestJS's full request pipeline, in order, is:

```
  Client Request
       │
       ▼
  1. Middleware           (Express/Fastify-level, no NestJS execution context)
       │
       ▼
  2. Guards                (canActivate — authorization decisions, run per route)
       │
       ▼
  3. Interceptors (pre)    (code before calling handler.handle())
       │
       ▼
  4. Pipes                 (transform & validate route handler arguments)
       │
       ▼
  5. Route Handler         (your controller method body executes)
       │
       ▼
  6. Interceptors (post)   (code after handler.handle(), can transform response)
       │
       ▼
  7. Exception Filters     (only if something threw along the way)
       │
       ▼
  Client Response
```

The key relationship to memorize: **pipes run after guards, but before the route handler.** This ordering is intentional —

- **Guards run first** because authorization ("is this caller allowed to hit this endpoint at all?") should be decided before you spend any effort parsing or validating the payload. There's no point validating a body that an unauthorized caller sent.
- **Pipes run right before the handler** because their entire purpose is to guarantee the data reaching the handler is well-formed. Nothing should run between "pipes finished validating" and "handler executes" that could still produce bad data.
- **Interceptors wrap around pipes and the handler** — an interceptor's pre-handler logic runs before pipes even resolve their arguments (interceptors wrap the entire `CallHandler`, which includes argument resolution and pipe execution), and its post-handler logic runs after the handler returns, letting interceptors transform responses (e.g., `ClassSerializerInterceptor`, covered in lesson 3).

If a pipe throws (e.g., `ParseIntPipe` receives a non-numeric string), the route handler is never invoked, and the thrown exception (by default a `BadRequestException`, HTTP 400) is caught by the exception filter layer and turned into an HTTP response.

---

## 4. Built-In Pipes

NestJS ships several ready-made pipes in `@nestjs/common` for the most common transform/validate needs on route parameters and query strings.

### ParseIntPipe

Converts a string to an integer, throwing `BadRequestException` if the value isn't a valid integer.

```typescript
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';

@Controller('products')
export class ProductsController {
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    // id is guaranteed to be a number here
    return { id, type: typeof id };
  }
}
```

`GET /products/42` → `id` is `42` (number). `GET /products/abc` → `400 Bad Request` before `findOne` is ever called.

### ParseUUIDPipe

Validates that a string is a well-formed UUID (v3, v4, or v5 by default; configurable via options).

```typescript
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

@Controller('orders')
export class OrdersController {
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return { id };
  }
}
```

### ParseBoolPipe

Converts the strings `'true'` / `'false'` into actual booleans; anything else throws.

```typescript
import { Controller, Get, Query, ParseBoolPipe } from '@nestjs/common';

@Controller('reports')
export class ReportsController {
  @Get()
  findAll(@Query('includeArchived', ParseBoolPipe) includeArchived: boolean) {
    return { includeArchived };
  }
}
```

### DefaultValuePipe

Supplies a fallback value when the incoming value is `undefined` (e.g., an optional query param that wasn't sent). It's almost always combined with another parsing pipe, since an absent query param arrives as `undefined`, which most parse pipes would otherwise reject.

```typescript
import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';

@Controller('items')
export class ItemsController {
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return { page, limit };
  }
}
```

`GET /items` → `page = 1, limit = 20`. `GET /items?page=3` → `page = 3, limit = 20`. Pipes passed as an array to a decorator run left to right — `DefaultValuePipe` fills in the default first, then `ParseIntPipe` converts whatever value (default or supplied) results.

### Other Built-Ins Worth Knowing

| Pipe                | Purpose                                                                 |
|----------------------|--------------------------------------------------------------------------|
| `ParseArrayPipe`     | Parses a delimited string or JSON array into a typed array, optionally validating each item against a DTO |
| `ParseEnumPipe`      | Validates a value is one of a TypeScript enum's members                 |
| `ParseFloatPipe`     | Converts a string to a floating-point number                            |
| `ValidationPipe`     | Validates an object (typically `@Body()`) against a class's `class-validator` decorators — the subject of lesson 2 |

---

## 5. Pipe Scope — Parameter, Handler, Controller, Global

Pipes can be bound at four levels. NestJS resolves them from most specific to least specific, running **global pipes first, then controller-level, then handler-level, then parameter-level** for each matching argument.

### Parameter-scoped

Applied directly in the decorator for a single parameter. Only affects that one argument.

```typescript
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.service.findOne(id);
}
```

### Handler-scoped (method-scoped)

Applied with `@UsePipes()` on a single route handler method. Runs for every parameter of that handler that the pipe applies to (most pipes bail out gracefully on arguments they don't recognize, but a poorly written pipe can end up processing arguments it shouldn't — see Common Pitfalls).

```typescript
import { UsePipes, ValidationPipe } from '@nestjs/common';

@Post()
@UsePipes(new ValidationPipe({ transform: true }))
create(@Body() dto: CreateProductDto) {
  return this.service.create(dto);
}
```

### Controller-scoped

Applied with `@UsePipes()` on the controller class. Runs for every handler in that controller.

```typescript
import { Controller, UsePipes, ValidationPipe } from '@nestjs/common';

@Controller('products')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class ProductsController {
  // every route handler in this controller is covered
}
```

### Global

Applied once for the entire application, in `main.ts` (or via a global-scoped provider token for DI-aware pipes). Runs for every route in the app.

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(3000);
}
bootstrap();
```

Global pipes registered this way via `app.useGlobalPipes()` cannot inject dependencies from the Nest DI container (they're instantiated outside any module context). If your global pipe needs DI (for example, an async uniqueness validator that needs a repository), register it as a provider in `AppModule` using the `APP_PIPE` token instead:

```typescript
import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

@Module({
  providers: [
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule {}
```

```
  Scope resolution order for a given argument:
  ┌───────────────────────────────────────────────────┐
  │ Global (main.ts / APP_PIPE)                        │
  │        │                                           │
  │        ▼                                           │
  │ Controller (@UsePipes on class)                    │
  │        │                                           │
  │        ▼                                           │
  │ Handler (@UsePipes on method)                       │
  │        │                                           │
  │        ▼                                           │
  │ Parameter (inline in @Body()/@Param()/@Query())    │
  └───────────────────────────────────────────────────┘
  All applicable pipes run — scope is additive, not "either/or".
```

**When to use which:**
- **Global** for the app-wide `ValidationPipe` — almost every production Nest app registers this once and never touches per-route validation config again.
- **Controller/handler** for cross-cutting transforms specific to one resource or endpoint (e.g., a legacy endpoint that needs looser validation rules than the rest of the app).
- **Parameter** for one-off primitive parsing like `ParseIntPipe` on a single `:id` param — this is by far the most common use of parameter scope.

---

## 6. Worked Example — A Custom Trimming/Sanitizing Pipe

A common real-world need: strip leading/trailing whitespace from every string field of an incoming body before validation runs, so `"  bob@example.com  "` doesn't fail an `@IsEmail()` check purely because of stray whitespace.

```typescript
// trim-strings.pipe.ts
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class TrimStringsPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Only process request bodies — leave params/queries to other pipes
    if (metadata.type !== 'body' || value === null || typeof value !== 'object') {
      return value;
    }
    return this.trimDeep(value);
  }

  private trimDeep(input: unknown): unknown {
    if (typeof input === 'string') {
      return input.trim();
    }
    if (Array.isArray(input)) {
      return input.map((item) => this.trimDeep(item));
    }
    if (input !== null && typeof input === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
        result[key] = this.trimDeep(val);
      }
      return result;
    }
    return input;
  }
}
```

Applied at the handler level, run *before* the validation pipe so validation sees already-trimmed data:

```typescript
// users.controller.ts
import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { TrimStringsPipe } from './trim-strings.pipe';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  @Post()
  @UsePipes(TrimStringsPipe, new ValidationPipe({ transform: true }))
  create(@Body() dto: CreateUserDto) {
    // dto.email has already been trimmed by the time validation ran
    return { received: dto };
  }
}
```

Pipes passed to `@UsePipes()` (or inline in a parameter decorator) as an array/comma-separated list execute **in the order given**. Here `TrimStringsPipe` runs first, sanitizing the raw body; `ValidationPipe` runs second, validating the sanitized result against `CreateUserDto`'s decorators.

If you want this behavior for every body in the app, register `TrimStringsPipe` globally *before* the `ValidationPipe`:

```typescript
app.useGlobalPipes(new TrimStringsPipe(), new ValidationPipe({ transform: true }));
```

Order matters for `useGlobalPipes` too — pipes passed together execute in array order, same as `@UsePipes()`.

---

## 7. Pipes and Exceptions

By default, any pipe that determines its input is invalid should throw. Nest's built-in pipes throw `BadRequestException`, which the default exception filter serializes to a `400` response. A custom pipe follows the same convention:

```typescript
import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

@Injectable()
export class PositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new BadRequestException(
        `Validation failed for parameter "${metadata.data}": expected a positive integer, got "${value}"`,
      );
    }
    return parsed;
  }
}
```

You can throw any HTTP exception from `@nestjs/common` (`UnprocessableEntityException`, `NotFoundException`, etc.) if a different status code is more semantically correct for your use case — pipes are not restricted to `BadRequestException`, that's just the sensible default for "malformed input."

---

## 8. Common Pitfalls

- **Forgetting pipes only run on the arguments Nest resolves via decorators.** A pipe cannot inspect or transform values you read manually off the raw `Request` object (e.g., via `@Req()` and then `req.body` directly) — it only intercepts arguments extracted through `@Body()`, `@Param()`, `@Query()`, `@Headers()`, and custom param decorators.
- **Expecting `metatype` to always be populated.** For primitive types (`String`, `Number`, `Boolean`, `Array`, `Object`) TypeScript's `design:type` metadata is often the JS wrapper type or missing entirely, so a validation pipe checking `metatype` needs to explicitly skip these — otherwise it may try (and fail) to validate a plain string as if it were a class.
- **Ordering pipes incorrectly in `@UsePipes()`.** Pipes run left to right; putting `ValidationPipe` before a sanitizing pipe like `TrimStringsPipe` means validation sees unsanitized data and can reject values the sanitizer would have fixed.
- **Registering a stateful/DI-dependent pipe with `app.useGlobalPipes()` instead of `APP_PIPE`.** `useGlobalPipes()` instantiates the pipe outside the Nest DI container, so `constructor(private readonly usersService: UsersService)` silently fails (or throws) because nothing gets injected. Use the `APP_PIPE` provider token in a module when the pipe needs injected dependencies.
- **Applying `ParseIntPipe` to an optional parameter without `DefaultValuePipe`.** If the query param is genuinely optional and absent, `ParseIntPipe` receives `undefined` and throws — pair it with `DefaultValuePipe` or make the pipe itself tolerate `undefined`.
- **Assuming a pipe's transformation persists across the whole request.** Pipes only affect the specific argument they're bound to; if the same value needs a transformed shape somewhere else (e.g., a guard reading the raw `Param`), the guard sees the original untransformed request data, since pipes run after guards in the pipeline.

---

## 9. Best Practices

- **Register the global `ValidationPipe` once in `main.ts`** with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true` — treat this as non-negotiable boilerplate for any real Nest app (details in lesson 2).
- **Keep parameter-scoped pipes for primitive coercion only** (`ParseIntPipe`, `ParseUUIDPipe`) — reserve DTO-level validation for the class-validator/ValidationPipe combo rather than hand-rolling per-field pipes.
- **Make custom pipes pure and side-effect free where possible** — a pipe's job is to transform/validate the value it's given, not to perform business logic like writing to a database (exception: async uniqueness validators, which are a validator concern, not a pipe concern — see lesson 3).
- **Throw semantically appropriate exceptions.** Prefer `BadRequestException` for malformed syntax and consider `UnprocessableEntityException` (422) when the payload is syntactically valid but semantically wrong, if your API's conventions distinguish the two.
- **Order sanitization before validation** when combining pipes, so validators see cleaned data.
- **Use `APP_PIPE` instead of `useGlobalPipes()`** the moment a global pipe needs constructor-injected dependencies.
- **Prefer DTO-driven validation over ad hoc pipes** for anything beyond simple type coercion — it keeps validation rules colocated with the shape they validate and self-documenting via decorators.

---

## 10. Hands-On Exercises

**Exercise 1:** Scaffold a `products` resource (`nest g resource products`). Add a `GET /products/:id` endpoint whose `id` parameter uses `ParseIntPipe`. Verify `GET /products/42` resolves normally and `GET /products/abc` returns a `400` with a message mentioning the failed validation, before your handler's code ever executes (add a `console.log` at the top of the handler to confirm it's never reached for the invalid case).

**Exercise 2:** Add a `GET /products` endpoint that accepts optional `page` and `limit` query params, each combining `DefaultValuePipe` and `ParseIntPipe` (defaults `1` and `10`). Confirm all four combinations behave correctly: no params, only `page`, only `limit`, both provided, and an invalid non-numeric value for either.

**Exercise 3:** Write a custom pipe `ParsePositiveIntPipe` (not using the built-in `ParseIntPipe`) that throws `BadRequestException` for zero, negative numbers, or non-numeric strings, and returns a valid positive integer otherwise. Apply it at the parameter level on a `DELETE /products/:id` route and confirm the three rejection cases and the success case all behave as expected.

**Exercise 4:** Build the `TrimStringsPipe` from this lesson and apply it handler-scoped, ordered before a `ValidationPipe({ transform: true })`, on a `POST /users` endpoint whose DTO has an `@IsEmail()` field. Send a request with `"  test@example.com  "` (leading/trailing spaces) and confirm validation passes and the stored/returned email has no surrounding whitespace. Then temporarily swap the pipe order (validation first) and observe the request fail validation, demonstrating why order matters.

**Exercise 5:** Register a `ValidationPipe` three different ways in a small demo app — parameter-scoped on one route, controller-scoped via `@UsePipes()` on the controller class, and application-wide via `app.useGlobalPipes()` in `main.ts`. Comment out each registration one at a time and observe which routes stop validating, to build intuition for how scope resolution actually behaves at runtime.

---

## 11. Interview Q&A

**Q: What is the purpose of a pipe in NestJS, and what two things can it do?**
Answer: A pipe is a class implementing `PipeTransform` that operates on arguments extracted for a route handler (via `@Body()`, `@Param()`, `@Query()`, etc.) before the handler is invoked. It has two responsibilities that can be combined in a single pipe: transformation (converting data from one shape to another, like a route param string to a number) and validation (rejecting malformed input by throwing an exception, typically `BadRequestException`, before the handler runs). This guarantees the handler only ever receives well-formed data.

**Q: Where do pipes run relative to guards and interceptors in the request lifecycle?**
Answer: The order is middleware, then guards, then interceptors' pre-handler logic, then pipes, then the route handler, then interceptors' post-handler logic, then exception filters if anything threw. Pipes run after guards because authorization decisions should happen before you spend effort validating a payload from a caller who might not even be allowed to hit the endpoint. Pipes run immediately before the handler because their entire purpose is ensuring the data the handler receives is trustworthy — nothing should intervene between validation succeeding and the handler executing.

**Q: What are the four scopes at which a pipe can be applied, and how does Nest resolve them when multiple scopes apply to the same argument?**
Answer: Pipes can be parameter-scoped (inline in a decorator like `@Param('id', ParseIntPipe)`), handler-scoped (`@UsePipes()` on a single method), controller-scoped (`@UsePipes()` on the class), or global (`app.useGlobalPipes()` in `main.ts`, or via the `APP_PIPE` provider token). Scope is additive, not exclusive — Nest runs global pipes first, then controller-level, then handler-level, then parameter-level, so all applicable pipes execute for a given argument rather than only the most specific one winning.

**Q: Why would you use the `APP_PIPE` token instead of `app.useGlobalPipes()` to register a global pipe?**
Answer: `app.useGlobalPipes()` instantiates the pipe outside of any Nest module context, so it cannot have dependencies injected via the constructor — if your pipe needs a repository or service (for example, an async uniqueness validator), the injection will silently fail. Registering the pipe as a provider using the `APP_PIPE` token inside a module (typically `AppModule`) lets Nest's DI container construct it with full access to other providers, while still applying it globally to every route.

**Q: What does `DefaultValuePipe` do and why is it almost always paired with another pipe like `ParseIntPipe`?**
Answer: `DefaultValuePipe` supplies a fallback value when the incoming argument is `undefined` — most commonly for optional query parameters that weren't sent in the request. It's paired with a parsing pipe like `ParseIntPipe` because query parameters always arrive as strings (or `undefined` if absent); `ParseIntPipe` alone would throw on `undefined` since it isn't a valid numeric string, so `DefaultValuePipe` runs first to substitute a default value, and then `ParseIntPipe` converts whichever value (the default or the supplied one) into a number.

**Q: What is `ArgumentMetadata` and why does the `metatype` field matter for validation pipes?**
Answer: `ArgumentMetadata` is the second argument passed to a pipe's `transform()` method, describing the argument being processed: its `type` (`body`, `query`, `param`, or `custom`), its `metatype` (the TypeScript class/type declared for the parameter, e.g. `CreateUserDto`), and `data` (the string key passed to the decorator, if any). The `metatype` field is what lets a generic validation pipe like `ValidationPipe` know which class's `class-validator` decorators to validate the incoming object against — without it, the pipe would have no way to know what "valid" means for that particular argument. Pipes typically skip validation when `metatype` is a native JS type (`String`, `Boolean`, `Number`, `Array`, `Object`) since there are no decorators to check against.
