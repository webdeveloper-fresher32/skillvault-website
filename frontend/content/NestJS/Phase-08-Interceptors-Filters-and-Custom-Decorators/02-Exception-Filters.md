# Exception Filters — Complete Guide

## Table of Contents
1. [What Is an Exception Filter](#1-what-is-an-exception-filter)
2. [The @Catch() Decorator and ExceptionFilter Interface](#2-the-catch-decorator-and-exceptionfilter-interface)
3. [The Built-In Exception Filter](#3-the-built-in-exception-filter)
4. [The HttpException Hierarchy](#4-the-httpexception-hierarchy)
5. [ArgumentsHost in Filters](#5-argumentshost-in-filters)
6. [Global vs Controller-Scoped vs Method-Scoped Filters](#6-global-vs-controller-scoped-vs-method-scoped-filters)
7. [Worked Example: Global AllExceptionsFilter](#7-worked-example-global-allexceptionsfilter)
8. [Filter Execution Order and Matching Precedence](#8-filter-execution-order-and-matching-precedence)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. What Is an Exception Filter

An exception filter is the last line of defense in the Nest request pipeline — it is the only component that runs when something throws. Its job is to catch whatever error propagated up from middleware, guards, pipes, interceptors, or the route handler itself, and turn it into a well-formed HTTP response with an appropriate status code and body.

```
  Any layer throws...
  ┌──────────────────────────────────────────────────────┐
  │  Guard throws ForbiddenException                     │
  │  Pipe throws BadRequestException                     │
  │  Handler throws (intentionally or via a bug)          │
  │  Interceptor rethrows via catchError                   │
  └──────────────────────────────────────────────────────┘
                        │
                        ▼
              Nearest matching Exception Filter
                        │
                        ▼
              Formatted HTTP error response
```

Without any custom filters, Nest ships with a built-in **global exception filter** that already handles this reasonably well — but production applications almost always want a consistent, custom error shape (for API consumers, logging, and correlating with monitoring tools), which is what custom filters are for.

---

## 2. The @Catch() Decorator and ExceptionFilter Interface

A filter is a class decorated with `@Catch()`, implementing `ExceptionFilter`:

```typescript
import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';

export interface ExceptionFilter<T = any> {
  catch(exception: T, host: ArgumentsHost): void;
}
```

`@Catch()` takes zero or more exception types as arguments. This determines which exceptions the filter is invoked for:

```typescript
import { Catch, ExceptionFilter, ArgumentsHost, HttpException } from '@nestjs/common';

@Catch(HttpException) // only catches HttpException and its subclasses
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

`@Catch()` with **no arguments** catches every exception, regardless of type — this is exactly what you want for a top-level, catch-all safety net (see Section 7).

```typescript
@Catch() // catches EVERYTHING, including non-HttpException errors
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // exception could be a TypeError, a database driver error, anything
  }
}
```

---

## 3. The Built-In Exception Filter

Out of the box, Nest wraps every route handler in its **global built-in exception filter**, `BaseExceptionFilter`. It already:

- Catches any thrown `HttpException` and formats it as `{ statusCode, message }`, using the exception's own status code.
- Catches any *other* unrecognized error (a raw `Error`, a driver exception, a `TypeError`) and falls back to a generic `500 Internal Server Error` response, without leaking the original error's message or stack trace to the client (though it does log it server-side).

This is why, even in a brand-new Nest project with zero custom filters, throwing `throw new NotFoundException('Order not found')` from a controller already produces a sensible `404` JSON response — you are relying on the built-in filter. Custom filters exist to **override or extend** this default behavior — commonly to (a) standardize the error response shape across the whole API, (b) add request correlation IDs or logging, or (c) map domain-specific errors (e.g. a database unique-constraint violation) into appropriate HTTP status codes.

You can extend `BaseExceptionFilter` directly rather than reimplementing it from scratch:

```typescript
import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class LoggingExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    console.error('Unhandled exception:', exception);
    super.catch(exception, host); // delegate to Nest's default formatting
  }
}
```

---

## 4. The HttpException Hierarchy

`HttpException` is the base class for all HTTP-aware errors in Nest. It takes a response body (string or object) and an HTTP status code:

```typescript
import { HttpException, HttpStatus } from '@nestjs/common';

throw new HttpException('Order not found', HttpStatus.NOT_FOUND);

// Equivalent, with a structured body:
throw new HttpException(
  { statusCode: HttpStatus.NOT_FOUND, error: 'Order not found', orderId: '42' },
  HttpStatus.NOT_FOUND,
);
```

Nest ships with a full set of built-in subclasses covering the common HTTP status codes, so you rarely need to construct `HttpException` directly:

| Class | Status Code |
|---|---|
| `BadRequestException` | 400 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `MethodNotAllowedException` | 405 |
| `NotAcceptableException` | 406 |
| `RequestTimeoutException` | 408 |
| `ConflictException` | 409 |
| `GoneException` | 410 |
| `PayloadTooLargeException` | 413 |
| `UnsupportedMediaTypeException` | 415 |
| `UnprocessableEntityException` | 422 |
| `InternalServerErrorException` | 500 |
| `NotImplementedException` | 501 |
| `BadGatewayException` | 502 |
| `ServiceUnavailableException` | 503 |
| `GatewayTimeoutException` | 504 |

```typescript
import { NotFoundException, ConflictException } from '@nestjs/common';

// Preferred over new HttpException(msg, HttpStatus.NOT_FOUND)
throw new NotFoundException('Order 42 not found');
throw new ConflictException('Order 42 already exists');
```

All of these subclasses extend `HttpException`, so a filter written as `@Catch(HttpException)` catches every one of them uniformly — you rarely need to `@Catch()` each specific subclass unless you want genuinely different handling per status code (see Section 8 on ordering).

`HttpException` exposes two key instance methods every filter relies on:

```typescript
exception.getStatus();   // number, e.g. 404
exception.getResponse(); // string | object, the body passed to the constructor
```

---

## 5. ArgumentsHost in Filters

Filters receive `ArgumentsHost` rather than `ExecutionContext` (which is only available to guards and interceptors), because a filter may need to handle errors thrown outside of a normal HTTP request context (e.g. in a WebSocket gateway or a microservice handler). `ArgumentsHost` lets you switch to the correct context type:

```typescript
import { ArgumentsHost } from '@nestjs/common';

catch(exception: unknown, host: ArgumentsHost) {
  const ctx = host.switchToHttp();
  const response = ctx.getResponse<import('express').Response>();
  const request = ctx.getRequest<import('express').Request>();
  // response.status(...).json(...) etc.
}
```

`host.switchToHttp()`, `host.switchToWs()`, and `host.switchToRpc()` let the same filter interface be reused across transport types, though in practice most filters in a typical REST API only ever call `switchToHttp()`.

---

## 6. Global vs Controller-Scoped vs Method-Scoped Filters

Like guards, pipes, and interceptors, filters can be bound at three levels:

```typescript
// Method-scoped
import { UseFilters, Get, Controller } from '@nestjs/common';

@Controller('orders')
export class OrdersController {
  @UseFilters(HttpExceptionFilter)
  @Get(':id')
  findOne() { /* ... */ }
}
```

```typescript
// Controller-scoped — applies to every handler in the controller
@UseFilters(HttpExceptionFilter)
@Controller('orders')
export class OrdersController { /* ... */ }
```

```typescript
// Global via main.ts — simplest, but not DI-aware
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(3000);
}
bootstrap();
```

```typescript
// Global via DI — preferred when the filter needs injected dependencies
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
```

Exactly as with interceptors, `app.useGlobalFilters(new Foo())` instantiates the filter manually and outside Nest's DI container — any constructor-injected dependency (e.g. a logging service) will be `undefined`. Use the `APP_FILTER` token when the filter needs injected providers.

Filters bound at a narrower scope (method, then controller) take precedence for matching requests over broader-scoped ones (global) — Nest applies the most specific applicable filter for a given exception, working outward if no narrower filter matches the thrown exception's type.

---

## 7. Worked Example: Global AllExceptionsFilter

This is the pattern most production Nest applications converge on: one global, catch-everything filter that guarantees every error — whether a deliberate `HttpException` or an unexpected bug — produces the exact same response envelope shape.

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
}

@Catch() // no argument — catches HttpException subclasses AND everything else
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.resolveStatusAndMessage(exception);

    const body: ErrorResponseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    };

    // Log full detail server-side, including stack traces for unexpected errors
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${status}: ${message}`);
    }

    response.status(status).json(body);
  }

  private resolveStatusAndMessage(
    exception: unknown,
  ): { status: number; message: string | string[] } {
    // Case 1: a Nest HttpException (BadRequestException, NotFoundException, ...)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // class-validator's ValidationPipe throws with { message: string[] }
      if (typeof payload === 'object' && payload !== null && 'message' in payload) {
        return { status, message: (payload as any).message };
      }
      return { status, message: exception.message };
    }

    // Case 2: a driver-level or truly unexpected error (TypeError, DB error, etc.)
    // Never leak internal details to the client — log them, but return a generic message.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }
}
```

Register it globally through DI so it applies to every route in the app, including ones added later:

```typescript
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
```

A request that hits a `NotFoundException('Order 42 not found')` now returns:

```json
{
  "statusCode": 404,
  "timestamp": "2026-07-13T09:20:11.502Z",
  "path": "/orders/42",
  "method": "GET",
  "message": "Order 42 not found"
}
```

And a request that triggers an unexpected bug — say, calling `.toUpperCase()` on `undefined` deep inside a service — returns exactly the same shape, with a safe generic message and a `500`, while the full stack trace is still logged server-side for debugging:

```json
{
  "statusCode": 500,
  "timestamp": "2026-07-13T09:21:47.118Z",
  "path": "/orders/42/summary",
  "method": "GET",
  "message": "Internal server error"
}
```

This is the essential value of a catch-all filter: API consumers, monitoring dashboards, and frontend error handlers can rely on one predictable shape, and unexpected server bugs never leak stack traces or internal error messages to the client.

---

## 8. Filter Execution Order and Matching Precedence

When multiple filters are registered, Nest resolves which one handles a given thrown exception using two rules, applied together:

**Rule 1 — scope precedence.** Nest looks for a matching filter starting from the narrowest scope outward: method-scoped first, then controller-scoped, then global. The first scope that has a filter whose `@Catch()` types match the thrown exception wins.

**Rule 2 — type specificity within a scope.** If a scope has multiple filters bound (e.g. via `@UseFilters(SpecificFilter, GeneralFilter)`), and more than one of them could catch the thrown exception type, order matters — list your **most specific** exception filter first and your catch-all filter last, since Nest evaluates filters bound at the same scope in the order they were provided.

```typescript
@Catch(NotFoundException)
export class NotFoundFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    // handle 404s with a specific shape, e.g. include a "didYouMean" suggestion
  }
}

@Catch(HttpException)
export class GeneralHttpFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    // handle every other HttpException generically
  }
}

@Catch()
export class CatchAllFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // last resort — anything not caught above, including non-HttpException errors
  }
}
```

```typescript
@UseFilters(NotFoundFilter, GeneralHttpFilter, CatchAllFilter)
@Controller('orders')
export class OrdersController { /* ... */ }
```

The ordering here — most specific to least specific, catch-all last — mirrors how you'd order `catch` blocks by exception subtype in any typed language: if the broad filter were listed first, it would intercept `NotFoundException` too (since `NotFoundException` **is** an `HttpException`), and `NotFoundFilter` would never run.

In practice, most real applications simplify this to just **one** global catch-all filter (Section 7's `AllExceptionsFilter`) that internally branches on `exception instanceof SomeSpecificError` rather than registering many separate filter classes — this avoids ordering subtleties entirely and keeps error-shaping logic in one auditable place. Reach for multiple filter classes only when different exception types genuinely need to be bound at different scopes (e.g. a `WsExceptionFilter` only for a gateway, alongside a global HTTP filter).

---

## 9. Common Pitfalls

- **Registering `app.useGlobalFilters(new Foo())` when the filter needs DI.** Just like interceptors, manual instantiation bypasses the container — use the `APP_FILTER` token for anything with injected dependencies.
- **Leaking internal error details in a catch-all filter.** Returning `exception.message` or `exception.stack` for *every* error type (rather than just `HttpException`s, which are safe by design) can leak database connection strings, file paths, or internal implementation details to API consumers.
- **Ordering a general filter before a specific one.** As shown in Section 8, `@Catch(HttpException)` also matches `NotFoundException` and every other subclass — if it's listed before a more specific filter at the same scope, the specific filter is dead code.
- **Forgetting that `@Catch()` with no arguments still needs to guard against non-`HttpException` values.** `exception: unknown` might not even be an `Error` instance (e.g. a rejected Promise with a plain string) — always check `exception instanceof HttpException` (or `instanceof Error`) before assuming shape.
- **Not logging unexpected (500-level) errors server-side.** If your filter converts everything into a generic "Internal server error" message for the client, make sure you still log the *original* exception and stack trace somewhere, or you lose all debuggability for production incidents.
- **Assuming filters run for uncaught promise rejections outside the Nest request context.** Exception filters only catch errors thrown during processing of an HTTP request Nest itself dispatched — they will not catch, say, an unhandled rejection inside a `setTimeout` callback fired outside the request lifecycle.
- **Mismatched response methods for Fastify vs Express.** `response.status(status).json(body)` is the Express API; the Fastify adapter uses `response.status(status).send(body)`. Filters written against one HTTP adapter are not automatically portable to the other.

---

## 10. Best Practices

- Always register a single global catch-all `AllExceptionsFilter` (via `APP_FILTER`) as your safety net, even if you also add more specific filters — never let an unhandled error type produce a raw framework-default response in production.
- Keep the error response body shape consistent and documented (`statusCode`, `timestamp`, `path`, `message` is a common convention) so API consumers, frontend error handlers, and monitoring tools can rely on one contract.
- Log full detail (stack trace, exception object) for anything resolving to `500`, but keep the client-facing message generic for those cases — never trust an internal error's message to be safe for external consumers.
- Use `class-validator`'s structured `message` array (from `ValidationPipe`, see Phase 06) directly in your error body for `400`s, since it already contains per-field validation messages that are genuinely useful to API consumers.
- Extend `BaseExceptionFilter` rather than reimplementing default behavior from scratch when you only need to add logging or a correlation ID on top of Nest's existing formatting.
- Prefer one catch-all filter with internal branching (`instanceof` checks) over many separate filter classes, unless you have a concrete scoping reason (e.g. WebSocket vs HTTP) to split them — this sidesteps filter ordering pitfalls entirely.
- Attach a request correlation ID (from a header or generated per-request) to both your logs and your error response body — this is invaluable when correlating a client-reported error with server logs during an incident.

---

## 11. Hands-On Exercises

**Exercise 1:** Implement the `AllExceptionsFilter` from Section 7 in a fresh Nest project. Add a route that throws `throw new ConflictException('Duplicate email')` and another that intentionally throws a raw `TypeError` (e.g. calling a method on `undefined`). Confirm both produce the same JSON shape, with the correct status codes (409 and 500 respectively), and that only the 500 case logs a full stack trace server-side.

**Exercise 2:** Write a `ValidationExceptionFilter` scoped with `@Catch(BadRequestException)` that reformats `class-validator`'s default `message: string[]` array into a `{ field, error }[]` structure by parsing each message string. Bind it at the controller level for one specific controller, and confirm the global `AllExceptionsFilter` still handles every other error type for that same controller.

**Exercise 3:** Create a fake database service method that throws a raw driver-style error object (not an `Error` instance) — e.g. `throw { code: 'ER_DUP_ENTRY', sqlMessage: '...' }`. Extend `AllExceptionsFilter` to detect this shape specifically and map it to a `409 Conflict` with a friendly message, while everything else still falls through to the generic 500 path.

**Exercise 4:** Demonstrate filter ordering: create `NotFoundFilter` (`@Catch(NotFoundException)`), `GeneralHttpFilter` (`@Catch(HttpException)`), and `CatchAllFilter` (`@Catch()`), then bind all three at the controller level with `@UseFilters(NotFoundFilter, GeneralHttpFilter, CatchAllFilter)`. Trigger a `NotFoundException` and confirm `NotFoundFilter` handles it. Then swap the order to put `GeneralHttpFilter` first and confirm `NotFoundFilter` is now dead code for that exception type.

**Exercise 5:** Add a request correlation ID: write a small middleware that generates a UUID and attaches it to `request.correlationId` if no `X-Correlation-Id` header is present, then update `AllExceptionsFilter` to include that ID in both the JSON error body and the server-side log line. Verify a client-supplied `X-Correlation-Id` header is honored and propagated end to end.

---

## 12. Interview Q&A

**Q: What is the purpose of the @Catch() decorator, and what happens if you call it with no arguments?**
Answer: `@Catch()` marks a class as an exception filter and specifies which exception types it should handle — for example `@Catch(HttpException)` only invokes the filter for `HttpException` and its subclasses. Calling `@Catch()` with no arguments makes the filter catch every exception regardless of type, including raw `Error` instances, driver-level errors, or even non-`Error` thrown values. This no-argument form is exactly what you use to build a global catch-all safety net that guarantees a consistent error response for literally anything that can go wrong in the request pipeline.

**Q: How does Nest's built-in exception filter behave for exceptions it doesn't recognize?**
Answer: Nest's built-in `BaseExceptionFilter` correctly formats any thrown `HttpException` (and its subclasses) using that exception's own status code and message. For anything else — a plain `Error`, a `TypeError`, a database driver exception — it falls back to a generic `500 Internal Server Error` response and deliberately does not leak the original error's message or stack trace to the client, though it does log the error server-side. Custom global filters like `AllExceptionsFilter` typically replicate and extend this same safe-fallback behavior while adding a consistent response shape across the whole API.

**Q: Why does ArgumentsHost exist separately from ExecutionContext, and which one do filters receive?**
Answer: Filters receive `ArgumentsHost` rather than `ExecutionContext` because exceptions can originate from any transport layer Nest supports — HTTP, WebSockets, or microservice RPC calls — not just HTTP requests. `ArgumentsHost` provides generic `switchToHttp()`, `switchToWs()`, and `switchToRpc()` methods so the same filter interface can operate across transport types. `ExecutionContext` extends `ArgumentsHost` with `getClass()` and `getHandler()`, which are only meaningful before a handler has been resolved and invoked (as in guards and interceptors) — by the time an exception filter runs, that additional context isn't part of the contract.

**Q: How do you scope exception filters, and how does Nest decide which one applies when several are registered?**
Answer: Filters can be bound at the method level (`@UseFilters()` on a handler), the controller level (`@UseFilters()` on the class), or globally (`app.useGlobalFilters()` or the `APP_FILTER` DI token). Nest resolves the applicable filter starting from the narrowest scope outward — method, then controller, then global — and within a given scope, filters are evaluated in the order they were provided to `@UseFilters()`. Because a general filter like `@Catch(HttpException)` also matches every one of its subclasses, more specific filters must be listed before more general ones at the same scope, or the general filter will shadow them.

**Q: Why is the APP_FILTER token preferred over app.useGlobalFilters() for a filter with injected dependencies?**
Answer: `app.useGlobalFilters(new MyFilter())` in `main.ts` instantiates the filter manually, outside of Nest's dependency injection container, so any constructor-injected provider (like a `LoggingService` or `ConfigService`) will simply be `undefined` at runtime. Registering the filter as `{ provide: APP_FILTER, useClass: MyFilter }` inside a module's `providers` array lets Nest instantiate it through the DI container like any other provider, correctly resolving its constructor dependencies, while still applying it globally across the entire application.

**Q: In a catch-all AllExceptionsFilter, how should you distinguish an expected HttpException from a truly unexpected error, and why does it matter?**
Answer: You check `exception instanceof HttpException` — if true, the exception was deliberately thrown by your own code (or a Nest pipe) with an intentional status code and message that is safe to return to the client as-is. If false, the exception is unexpected — a bug, a database error, a null-reference — and its raw message or stack trace must never be sent to the client, since it may contain internal implementation details or sensitive information; instead you return a generic message (e.g. "Internal server error") with a 500 status, while still logging the full original exception server-side for debugging. This distinction is what keeps a catch-all filter both safe for production and useful for developers.
