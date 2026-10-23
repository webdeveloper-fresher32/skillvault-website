# Interceptors and the Request Pipeline — Complete Guide

## Table of Contents
1. [What Is an Interceptor](#1-what-is-an-interceptor)
2. [The NestInterceptor Interface](#2-the-nestinterceptor-interface)
3. [The Full Request Pipeline Order](#3-the-full-request-pipeline-order)
4. [ExecutionContext and CallHandler](#4-executioncontext-and-callhandler)
5. [RxJS Operators for Response Transformation](#5-rxjs-operators-for-response-transformation)
6. [Worked Example: Logging Interceptor with Duration](#6-worked-example-logging-interceptor-with-duration)
7. [Worked Example: Response-Transform Envelope Interceptor](#7-worked-example-response-transform-envelope-interceptor)
8. [Binding Interceptors — Method, Controller, Global](#8-binding-interceptors--method-controller-global)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. What Is an Interceptor

An interceptor is a class annotated with `@Injectable()` that implements the `NestInterceptor` interface. It sits around the route handler and can run code **before** the handler executes, **after** the handler returns (transforming or replacing the response), or **instead of** the handler entirely (e.g. serving a cached value). Interceptors are inspired directly by Aspect-Oriented Programming (AOP) — they let you factor out cross-cutting concerns (logging, caching, timing, response shaping, error mapping) without polluting every controller method with the same boilerplate.

```
  Interceptor capabilities:
  ┌─────────────────────────────────────────────────────────────┐
  │  1. Bind extra logic before/after method execution           │
  │  2. Transform the result returned from a function             │
  │  3. Transform the exception thrown from a function             │
  │  4. Extend basic function behavior                             │
  │  5. Completely override a function (e.g. for caching)          │
  └─────────────────────────────────────────────────────────────┘
```

Because interceptors wrap the handler, they are the only pipeline component that has access to both the request (before the handler runs) and the response (after it runs) in a single unit. Guards only ever see the request; pipes only transform arguments before the handler; filters only ever see errors. Interceptors are the one place you can measure round-trip time or reshape a return value.

---

## 2. The NestInterceptor Interface

Every interceptor implements a single method:

```typescript
import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

export interface NestInterceptor<T = any, R = any> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<R> | Promise<Observable<R>>;
}
```

`intercept()` receives the same `ExecutionContext` a guard receives (giving you access to the request, response, class, and handler), plus a `CallHandler`. Calling `next.handle()` invokes the route handler and returns an `Observable` of its result. Nest is built on RxJS internally even though most handlers just return plain values or Promises — the framework wraps whatever the handler returns into an Observable stream so that interceptors have a uniform, composable API (`pipe`, `map`, `tap`, `catchError`, etc.) regardless of whether the underlying handler is synchronous, a Promise, or already an Observable.

A minimal interceptor that changes nothing:

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class PassthroughInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Anything here runs BEFORE the handler executes
    return next.handle();
    // Anything chained with .pipe(...) on the returned Observable
    // runs AFTER the handler resolves (or throws)
  }
}
```

If `next.handle()` is never called, the route handler never executes at all — this is exactly how a caching interceptor short-circuits a request and returns a cached `Observable` instead.

---

## 3. The Full Request Pipeline Order

This is the order every incoming HTTP request travels through in a Nest application, end to end:

```
  Incoming HTTP Request
          │
          ▼
  ┌───────────────────┐
  │    Middleware      │   (Express/Fastify style, per-module or global)
  └───────────────────┘
          │
          ▼
  ┌───────────────────┐
  │      Guards        │   (canActivate — authn/authz, request in only)
  └───────────────────┘
          │  ── throws ForbiddenException on false/throw ──▶ Exception Filters
          ▼
  ┌───────────────────┐
  │  Interceptors      │   (pre-handler logic runs here, BEFORE next.handle())
  │   [before phase]   │
  └───────────────────┘
          │
          ▼
  ┌───────────────────┐
  │      Pipes         │   (validation/transformation of route arguments)
  └───────────────────┘
          │  ── throws BadRequestException ──▶ Exception Filters
          ▼
  ┌───────────────────┐
  │  Route Handler      │   (your controller method body)
  └───────────────────┘
          │
          ▼
  ┌───────────────────┐
  │  Interceptors      │   (post-handler logic runs here, in the .pipe()
  │   [after phase]    │    chain attached to next.handle()'s Observable)
  └───────────────────┘
          │
          ▼
  ┌───────────────────┐
  │  Exception Filters  │   (only invoked if something in the chain threw)
  └───────────────────┘
          │
          ▼
  Outgoing HTTP Response
```

Key ordering facts worth memorizing:

- **Middleware** runs first and has no knowledge of the eventual route handler or its metadata — it operates purely on the raw request/response, before routing is resolved.
- **Guards** run next, after routing has resolved the target handler (so `context.getHandler()` and `context.getClass()` are available), but before any argument pipes.
- **Interceptors run twice** conceptually — the code before `next.handle()` runs before pipes/handler; the code chained after `next.handle()` (via `.pipe(...)`) runs after the handler returns, but before the response is serialized and sent.
- **Pipes** run only on the individual route arguments, immediately before the handler is invoked.
- **Filters** are the only layer that runs on the error path — if a guard, pipe, interceptor, or handler throws, control jumps directly to the nearest matching exception filter, skipping any remaining pipeline stages.
- If a **guard** returns `false` or throws, interceptors never even reach their "before" phase for that request — the request is rejected before it gets there.

---

## 4. ExecutionContext and CallHandler

`ExecutionContext` extends `ArgumentsHost` (which you may have already seen in filters) with two extra methods that are especially useful in interceptors:

```typescript
export interface ExecutionContext extends ArgumentsHost {
  getClass<T = any>(): Type<T>;      // the controller class
  getHandler(): Function;             // the specific route handler method
}
```

```typescript
import { ExecutionContext } from '@nestjs/common';

function inspect(context: ExecutionContext) {
  const request = context.switchToHttp().getRequest();
  const response = context.switchToHttp().getResponse();
  const controllerName = context.getClass().name;   // e.g. "OrdersController"
  const handlerName = context.getHandler().name;    // e.g. "createOrder"
}
```

`CallHandler` is the object that lets the interceptor actually invoke (or skip) the downstream pipeline:

```typescript
export interface CallHandler<T = any> {
  handle(): Observable<T>;
}
```

Calling `next.handle()` triggers everything downstream — remaining pipes, the handler itself — and returns an `Observable` that will emit the handler's return value (or error) once it resolves. Because it's an `Observable`, you compose behavior with RxJS's `.pipe()` rather than `async/await`, which is what makes operators like `map`, `tap`, and `catchError` the natural vocabulary for interceptors.

---

## 5. RxJS Operators for Response Transformation

Three operators cover the overwhelming majority of interceptor use cases:

| Operator | Purpose | Typical Use |
|---|---|---|
| `map` | Transform the emitted value | Reshape response body, add an envelope |
| `tap` | Run a side effect without changing the value | Logging, metrics, timing |
| `catchError` | Intercept an error in the stream | Translate/rethrow errors, fallback values |

```typescript
import { map, tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

// map: reshape the value the handler returned
next.handle().pipe(
  map((data) => ({ success: true, data })),
);

// tap: observe without modifying (side effects only)
next.handle().pipe(
  tap((data) => console.log('Handler returned:', data)),
);

// catchError: intercept errors flowing through the Observable
next.handle().pipe(
  catchError((err) => {
    console.error('Handler threw:', err);
    return throwError(() => err); // rethrow so filters still catch it
  }),
);
```

A critical rule: `catchError` in an interceptor should almost always **rethrow** (via `throwError(() => err)`) rather than swallow the error, unless you deliberately intend to suppress it and provide a fallback value. If you swallow an error here, it never reaches your exception filters, and the client may receive a `200 OK` with no body, or an unhandled shape.

You can chain multiple operators together freely, since `.pipe()` composes left to right:

```typescript
next.handle().pipe(
  tap(() => console.log('handler resolved')),
  map((data) => ({ data })),
  catchError((err) => throwError(() => err)),
);
```

---

## 6. Worked Example: Logging Interceptor with Duration

This interceptor logs the HTTP method, URL, status code, and how long the request took, using `tap`'s two callbacks (next-value and error) to cover both the success and failure paths.

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - now;
          this.logger.log(
            `${method} ${originalUrl} ${response.statusCode} — ${duration}ms`,
          );
        },
        error: (err) => {
          const duration = Date.now() - now;
          this.logger.error(
            `${method} ${originalUrl} FAILED (${err.status ?? 500}) — ${duration}ms`,
            err.stack,
          );
        },
      }),
    );
  }
}
```

Register it globally in `main.ts` (or a module) so every route gets timing logs without individual controllers needing to know it exists:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new LoggingInterceptor());
  await app.listen(3000);
}
bootstrap();
```

Note that `app.useGlobalInterceptors(new LoggingInterceptor())` instantiates the interceptor manually, so it cannot inject other providers through Nest's DI container. If your interceptor needs dependency injection (e.g. an injected `ConfigService`), register it as a module-scoped global provider instead — see [Section 8](#8-binding-interceptors--method-controller-global).

---

## 7. Worked Example: Response-Transform Envelope Interceptor

A very common production pattern is wrapping every successful response body in a consistent envelope, e.g. `{ data, meta }`, so API consumers always know where the payload lives regardless of which endpoint they called.

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  meta: {
    timestamp: string;
    path: string;
  };
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      })),
    );
  }
}
```

A controller that returns a plain object or array requires no changes at all:

```typescript
import { Controller, Get, Param } from '@nestjs/common';

@Controller('orders')
export class OrdersController {
  @Get(':id')
  findOne(@Param('id') id: string) {
    return { id, item: 'Widget', quantity: 3 }; // untouched by the controller
  }
}
```

With `TransformInterceptor` bound, the client receives:

```json
{
  "data": { "id": "42", "item": "Widget", "quantity": 3 },
  "meta": {
    "timestamp": "2026-07-13T09:15:00.000Z",
    "path": "/orders/42"
  }
}
```

Because the transform happens in one central interceptor, controllers stay focused on business logic and never need to remember to wrap their own return values — the envelope shape is enforced structurally, not by convention.

A subtlety worth calling out: this interceptor should generally be scoped so it does **not** wrap error responses — errors are handled by exception filters, which run after interceptors on the error path and are expected to produce their own error envelope (see the next lesson). Since `map` here only touches the success channel of the Observable, error propagation to filters is unaffected.

---

## 8. Binding Interceptors — Method, Controller, Global

Interceptors can be scoped at three levels, following the same pattern as guards and pipes:

```typescript
// Method-scoped — applies only to this one handler
import { UseInterceptors, Get, Controller } from '@nestjs/common';

@Controller('orders')
export class OrdersController {
  @UseInterceptors(LoggingInterceptor)
  @Get()
  findAll() {
    return [];
  }
}
```

```typescript
// Controller-scoped — applies to every handler in the controller
@UseInterceptors(TransformInterceptor)
@Controller('orders')
export class OrdersController {
  // ...
}
```

```typescript
// Global via DI — preferred when the interceptor needs injected dependencies
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
```

Passing the class (`LoggingInterceptor`) rather than an instance to `@UseInterceptors()` lets Nest instantiate it through the DI container, so constructor injection works. When you need dependency injection **and** global scope, the `APP_INTERCEPTOR` provider token (used in the example above) is the correct approach — it is DI-aware, unlike `app.useGlobalInterceptors()` in `main.ts`, which instantiates manually outside the module graph.

Multiple interceptors can be stacked; they nest around the handler in the order listed, with the first interceptor's "before" phase running outermost:

```typescript
@UseInterceptors(LoggingInterceptor, TransformInterceptor)
@Get()
findAll() {
  return [];
}
// Execution: Logging(before) → Transform(before) → handler
//          → Transform(after, via map) → Logging(after, via tap)
```

---

## 9. Common Pitfalls

- **Forgetting to call `next.handle()`.** If your interceptor never calls it, the route handler never runs and the request hangs or returns `undefined`. Every interceptor must call `next.handle()` unless it deliberately intends to short-circuit (e.g. serve a cached value).
- **Swallowing errors in `catchError` without rethrowing.** This silently breaks your exception filter chain, often producing an empty `200` response instead of a proper error.
- **Registering DI-dependent interceptors with `app.useGlobalInterceptors(new Foo())`.** Manual instantiation bypasses the DI container entirely — any constructor-injected dependency will be `undefined`. Use the `APP_INTERCEPTOR` token pattern instead.
- **Doing heavy synchronous work in the "before" phase.** Code before `next.handle()` runs on every single request; expensive synchronous computation there (rather than async, non-blocking work) can bottleneck the whole app under load.
- **Assuming interceptor order is independent of decorator order.** Stacked `@UseInterceptors()` arguments and multiple `@UseInterceptors()` decorators combine in a specific, deterministic order — get this wrong and a transform interceptor may run before the logging interceptor captures the "real" response.
- **Applying a global response-transform interceptor after already-established API clients exist.** Wrapping every response in `{ data, meta }` is a breaking change for any consumer expecting the raw body — version your API or coordinate the rollout.
- **Using `map` to change the HTTP status code.** `map` only touches the emitted body; to change status codes you need to reach into `context.switchToHttp().getResponse()` and call `.status()` directly, which most transform interceptors should avoid doing implicitly.

---

## 10. Best Practices

- Keep interceptors single-purpose — one for logging, one for response transformation, one for caching — and compose them via `@UseInterceptors()` rather than writing one interceptor that does everything.
- Prefer the `APP_INTERCEPTOR` DI token for anything global that needs injected dependencies (config, logging services, metrics clients).
- Always rethrow in `catchError` unless you have a specific, documented reason to suppress the error and supply a fallback.
- Put response-shaping interceptors (like the envelope pattern) at the controller or global level, not scattered per-method, so the response contract is uniform and easy to document.
- Use `tap`'s `{ next, error }` observer form (rather than two separate `.pipe(tap(...), catchError(...))` calls) when you need to log both success and failure paths without altering the stream.
- Name interceptor classes for what they do, not how they do it (`ResponseEnvelopeInterceptor`, not `MapInterceptor`) so their purpose is clear from a stack trace or DI error.
- When timing requests, capture `Date.now()` (or `process.hrtime()` for higher precision) at the very start of `intercept()`, before `next.handle()` — this is the only point that captures pipe and handler execution time together.
- Document your global interceptor stack in one place (e.g. a comment in `AppModule`) since it silently changes every response's runtime behavior with no visible trace in the individual controllers.

---

## 11. Hands-On Exercises

**Exercise 1:** Build a `TimeoutInterceptor` that uses RxJS's `timeout` operator to abort a request that takes longer than 5 seconds, converting the resulting `TimeoutError` into a `RequestTimeoutException` inside a `catchError` block. Bind it globally and verify it fires against a handler that intentionally awaits a 6-second delay.

**Exercise 2:** Extend the `LoggingInterceptor` from Section 6 so it also logs the request body for `POST`/`PUT`/`PATCH` requests (but never for `GET`), and redacts any field named `password` or `token` before logging. Verify sensitive fields never reach your log output.

**Exercise 3:** Build a `CacheInterceptor` for a `GET /reports/:id` endpoint that stores the handler's result in an in-memory `Map` keyed by URL, and — on a cache hit — returns an `of(cachedValue)` Observable directly without ever calling `next.handle()`. Confirm (via a log statement inside the controller method) that the handler body does not execute on the second request.

**Exercise 4:** Implement the `TransformInterceptor` from Section 7, bind it globally with `APP_INTERCEPTOR`, and add a second global interceptor `LoggingInterceptor`. Log the order in which each interceptor's before/after code executes for a single request, and confirm it matches the nesting rule described in Section 8.

**Exercise 5:** Write an interceptor that measures handler execution time and attaches it as a custom `X-Response-Time` HTTP header on the response (using `context.switchToHttp().getResponse().setHeader(...)` inside a `tap` callback), without modifying the response body at all. Verify the header appears using `curl -i`.

---

## 12. Interview Q&A

**Q: What is the difference between a guard and an interceptor in NestJS?**
Answer: A guard's only job is to decide whether a request is allowed to proceed — its `canActivate()` method returns a boolean (or throws) and runs before pipes and the handler; it never sees the response. An interceptor wraps the entire handler execution and can run logic both before the handler executes and after it returns, by chaining RxJS operators onto the Observable returned by `next.handle()`. Interceptors can transform the response body, catch and rethrow errors, measure timing, or even skip the handler entirely (e.g. caching) — capabilities a guard simply doesn't have.

**Q: Why does calling next.handle() return an Observable instead of a Promise?**
Answer: Nest is built on RxJS to give a single, uniform, composable API for handling the handler's result regardless of whether the underlying method is synchronous, returns a Promise, or returns an Observable directly (e.g. from a microservice call). Observables also come with a rich operator library (`map`, `tap`, `catchError`, `timeout`, `retry`, etc.) that lets interceptors express before/after/error logic declaratively via `.pipe()`, which would be considerably more awkward to express with `async/await` alone, especially for things like automatic retries or timeouts.

**Q: Where do interceptors sit in the overall Nest request pipeline?**
Answer: The order is middleware, then guards, then interceptors (their pre-handler logic), then pipes, then the route handler, then interceptors again (their post-handler logic, chained via `.pipe()` on the Observable from `next.handle()`), and finally exception filters if anything in the chain threw. Interceptors are unique in running on both sides of pipes and the handler — everything else in the pipeline runs on only one side of the request/response boundary.

**Q: How do you make a globally-bound interceptor participate in dependency injection?**
Answer: Calling `app.useGlobalInterceptors(new MyInterceptor())` in `main.ts` instantiates the interceptor manually, outside of Nest's module graph, so any constructor-injected dependency will be `undefined`. To get a DI-aware global interceptor, register it inside a module's `providers` array using the `APP_INTERCEPTOR` injection token: `{ provide: APP_INTERCEPTOR, useClass: MyInterceptor }`. Nest then instantiates it through the container like any other provider, resolving its constructor dependencies normally, while still applying it globally to every route.

**Q: Why should catchError in an interceptor almost always rethrow the error?**
Answer: `catchError` intercepts the error channel of the Observable returned by `next.handle()`. If you don't rethrow (e.g. via `throwError(() => err)`), the error is effectively swallowed and never reaches Nest's exception filter chain — the client may receive an incomplete or empty successful response instead of a proper error status and body. Rethrowing preserves the pipeline contract: interceptors may observe, log, or translate an error, but exception filters remain the single source of truth for producing the final error response shape.

**Q: Give a concrete example of a case where an interceptor should skip calling next.handle() entirely.**
Answer: A caching interceptor is the canonical example — if a matching cached value already exists for the given request key, the interceptor can return `of(cachedValue)` (an Observable that immediately emits the cached data) without ever calling `next.handle()`. This means the route handler's body, and everything downstream of it including pipes for that call, never executes, which is exactly the performance benefit caching is meant to provide.
