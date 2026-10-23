# Response Handling and Status Codes — Complete Guide

## Table of Contents
1. [Nest's Default Response Serialization](#1-nests-default-response-serialization)
2. [@HttpCode() — Overriding the Default Status Code](#2-httpcode--overriding-the-default-status-code)
3. [@Header() — Custom Response Headers](#3-header--custom-response-headers)
4. [Throwing HttpException for Error Responses](#4-throwing-httpexception-for-error-responses)
5. [Built-In HttpException Subclasses](#5-built-in-httpexception-subclasses)
6. [@Redirect() — Redirect Responses](#6-redirect--redirect-responses)
7. [Worked Example — Status Codes Driven by Business Logic](#7-worked-example--status-codes-driven-by-business-logic)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Nest's Default Response Serialization

By default, a Nest handler's **return value becomes the HTTP response body**, automatically serialized to JSON, with a status code chosen by convention based on the HTTP method used.

```
  handler return value
        │
        ▼
  ┌─────────────────────────────────────────────────┐
  │  Is it a Promise? → awaited                      │
  │  Is it an Observable? → subscribed, last value    │
  │        used (RxJS interop)                        │
  │  Otherwise → used as-is                            │
  └─────────────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────────┐
  │  JSON.stringify() applied (unless the platform's  │
  │  response was already manually sent via @Res())   │
  └─────────────────────────────────────────────────┘
        │
        ▼
  Response sent with Content-Type: application/json
  and a default status code based on the HTTP verb
```

```typescript
import { Controller, Get, Post } from '@nestjs/common';

@Controller('status-demo')
export class StatusDemoController {
  @Get()
  getData() {
    return { message: 'hello' }; // 200 OK, body: {"message":"hello"}
  }

  @Post()
  createData() {
    return { created: true }; // 201 Created by default for POST
  }
}
```

### Default status codes by method

| Method | Default Status | Notes |
|---|---|---|
| `@Get()` | 200 OK | |
| `@Post()` | 201 Created | The one exception to "everything else is 200" |
| `@Put()` | 200 OK | |
| `@Patch()` | 200 OK | |
| `@Delete()` | 200 OK | Not 204 by default — must be set explicitly if desired |

Returning `undefined` or `null` still produces a 200/201 response with an empty or `null` body — Nest does not treat these as "no response needed." If a handler returns nothing meaningfully useful (e.g., a delete operation with no return value), it's common to explicitly set the status to `204 No Content` (see the next section) rather than leaving the default.

If a handler is `async` or returns an `Observable`, Nest awaits/subscribes and uses the resolved value the same way — the serialization behavior is identical regardless of whether the handler is synchronous, a Promise, or an Observable.

---

## 2. @HttpCode() — Overriding the Default Status Code

`@HttpCode()` overrides the default status code Nest would otherwise choose for a given HTTP method.

```typescript
import { Controller, Post, Delete, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('orders')
export class OrdersController {
  @Post()
  @HttpCode(HttpStatus.ACCEPTED) // 202, instead of the default 201
  create() {
    return { message: 'order queued for processing' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // 204 — response body is ignored by clients
  remove() {
    // returning nothing is idiomatic here since 204 means "no body"
  }
}
```

`HttpStatus` is an enum exported from `@nestjs/common` covering the full standard set of HTTP status codes (`HttpStatus.OK`, `HttpStatus.CREATED`, `HttpStatus.NO_CONTENT`, `HttpStatus.BAD_REQUEST`, and so on) — prefer it over hardcoded numeric literals for readability and to avoid typos like `422` vs `242`.

`@HttpCode()` only affects the **success path**. It has no effect on the status code used when the handler throws — that is controlled entirely by which `HttpException` (or subclass) is thrown, covered in section 4.

---

## 3. @Header() — Custom Response Headers

`@Header()` sets a specific response header on the success path, declaratively, without touching the response object directly.

```typescript
import { Controller, Get, Header } from '@nestjs/common';

@Controller('reports')
export class ReportsController {
  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Cache-Control', 'no-store')
  exportCsv() {
    return 'id,name,total\n1,Widget,42.50\n';
  }
}
```

Multiple `@Header()` decorators can be stacked on the same handler, each setting one header. For headers that need to be computed dynamically at request time (e.g., an `ETag` based on the response content, or a header value depending on a runtime condition), set them via the raw response object using `@Res({ passthrough: true })` instead, since `@Header()`'s value is fixed at decoration time and cannot easily depend on per-request logic.

```typescript
import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller('reports')
export class ReportsController {
  @Get('dynamic-export')
  exportDynamic(@Res({ passthrough: true }) res: Response) {
    const generatedAt = new Date().toISOString();
    res.setHeader('X-Generated-At', generatedAt); // computed per-request
    return { data: [] };
  }
}
```

---

## 4. Throwing HttpException for Error Responses

Error responses in Nest are produced by **throwing**, not by returning an error-shaped object. Throwing an `HttpException` (or one of its subclasses) is intercepted by Nest's built-in exception layer (or a custom exception filter, covered in Phase 8) and turned into a properly-coded JSON error response.

```typescript
import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';

@Controller('orders')
export class OrdersController {
  @Get(':id')
  findOne(@Param('id') id: string) {
    const order = this.lookup(id);
    if (!order) {
      // Base HttpException — takes a response body and a status code
      throw new HttpException(`Order ${id} not found`, HttpStatus.NOT_FOUND);
    }
    return order;
  }

  private lookup(id: string) {
    return null; // stand-in for a real lookup
  }
}
```

This produces:

```json
{
  "statusCode": 404,
  "message": "Order 42 not found"
}
```

`HttpException`'s constructor also accepts an object as the response body for more structured errors:

```typescript
throw new HttpException(
  {
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Invalid order state',
    details: { currentState: 'shipped', requestedState: 'pending' },
  },
  HttpStatus.BAD_REQUEST,
);
```

---

## 5. Built-In HttpException Subclasses

Rather than constructing `HttpException` manually every time, Nest provides a full set of named subclasses, each pre-bound to the correct status code — these are the idiomatic way to throw common errors.

| Class | Status | Typical Use |
|---|---|---|
| `BadRequestException` | 400 | Malformed input, failed validation |
| `UnauthorizedException` | 401 | Missing/invalid authentication |
| `ForbiddenException` | 403 | Authenticated but not permitted |
| `NotFoundException` | 404 | Resource does not exist |
| `MethodNotAllowedException` | 405 | Verb not supported on this route |
| `ConflictException` | 409 | Resource state conflict (e.g., duplicate) |
| `GoneException` | 410 | Resource existed but is permanently removed |
| `UnprocessableEntityException` | 422 | Semantically invalid despite valid syntax |
| `InternalServerErrorException` | 500 | Unexpected server-side failure |
| `NotImplementedException` | 501 | Endpoint intentionally not implemented yet |
| `ServiceUnavailableException` | 503 | Downstream dependency unavailable |

```typescript
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';

class CreateOrderDto {
  productId: string;
  quantity: number;
}

@Controller('orders')
export class OrdersController {
  @Get(':id')
  findOne(@Param('id') id: string) {
    const order = this.lookup(id);
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    if (dto.quantity <= 0) {
      throw new UnprocessableEntityException('Quantity must be greater than zero');
    }
    if (this.existsAlready(dto.productId)) {
      throw new ConflictException('An open order for this product already exists');
    }
    return { id: 'new-order-id', ...dto };
  }

  private lookup(id: string) {
    return null;
  }

  private existsAlready(productId: string) {
    return false;
  }
}
```

Any uncaught, non-`HttpException` error thrown in a handler (e.g., a plain `Error` or a database driver exception) is caught by Nest's global exception filter and converted into a generic `500 Internal Server Error` response, with the original error logged server-side but not leaked to the client by default — this is a safety net, not a substitute for throwing the correct specific exception for expected failure cases.

---

## 6. @Redirect() — Redirect Responses

`@Redirect()` marks a handler as producing an HTTP redirect, with a default URL and status code that can be overridden dynamically by the handler's return value.

```typescript
import { Controller, Get, Redirect, Query, HttpStatus } from '@nestjs/common';

@Controller('links')
export class LinksController {
  @Get('docs')
  @Redirect('https://docs.example.com', HttpStatus.MOVED_PERMANENTLY)
  toDocs() {}

  @Get('go')
  @Redirect('https://example.com', HttpStatus.FOUND)
  goSomewhere(@Query('to') to?: string) {
    if (to === 'github') {
      return { url: 'https://github.com/', statusCode: HttpStatus.MOVED_PERMANENTLY };
    }
    if (to === 'npm') {
      return { url: 'https://npmjs.com/' }; // statusCode falls back to decorator default (302)
    }
    // no return at all → uses decorator's default url and status entirely
  }
}
```

The handler's returned object must have the shape `{ url: string; statusCode?: number }` for the override to take effect; returning anything else (or nothing) falls back to the decorator's declared arguments.

---

## 7. Worked Example — Status Codes Driven by Business Logic

The following controller shows a realistic handler where the response status code depends entirely on the outcome of business logic — a common real-world shape (submitting an order that might succeed immediately, be queued, conflict with existing state, or fail validation).

```typescript
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Header,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

interface SubmitOrderDto {
  productId: string;
  quantity: number;
  requestId: string; // idempotency key
}

@Controller('orders')
export class OrdersController {
  private readonly processedRequestIds = new Set<string>();
  private readonly inventory: Record<string, number> = { widget: 5, gadget: 0 };

  @Post('submit')
  @HttpCode(HttpStatus.OK) // override default 201 — we decide the real code below
  @Header('X-Order-Service', 'orders-v1')
  submit(@Body() dto: SubmitOrderDto) {
    // Basic validation → 400
    if (!dto.productId || dto.quantity == null) {
      throw new BadRequestException('productId and quantity are required');
    }
    if (dto.quantity <= 0) {
      throw new BadRequestException('quantity must be a positive number');
    }

    // Idempotency conflict → 409
    if (this.processedRequestIds.has(dto.requestId)) {
      throw new ConflictException(`Request ${dto.requestId} was already processed`);
    }
    this.processedRequestIds.add(dto.requestId);

    // Unknown product → 404
    const availableStock = this.inventory[dto.productId];
    if (availableStock === undefined) {
      throw new NotFoundException(`Unknown product: ${dto.productId}`);
    }

    // Business outcome determines the *body* content, but since @HttpCode
    // pinned this route to 200 for all successful outcomes, differing
    // "success shapes" are communicated via the response body's own status
    // field instead of the HTTP code — a common and valid pattern for
    // representing sub-states within a single successful HTTP response.
    if (availableStock >= dto.quantity) {
      return { status: 'confirmed', productId: dto.productId, quantity: dto.quantity };
    }

    return { status: 'backordered', productId: dto.productId, quantity: dto.quantity };
  }

  @Get(':productId/stock')
  checkStock(@Param('productId') productId: string) {
    const stock = this.inventory[productId];
    if (stock === undefined) {
      throw new NotFoundException(`Unknown product: ${productId}`);
    }
    // 200 with a body describing availability — no special status code needed,
    // the information lives in the payload
    return { productId, inStock: stock > 0, quantity: stock };
  }
}
```

This example demonstrates the two legitimate ways business logic maps to a response: **HTTP-level status codes for true request-processing outcomes** (400 for bad input, 404 for missing resource, 409 for a conflicting duplicate request), and **body-level status fields for sub-states of an otherwise successful request** (`"confirmed"` vs `"backordered"`, both correctly HTTP 200). Conflating the two — for example, using a 409 or 404 to represent "backordered" — would misuse HTTP semantics and make the API harder for clients to handle generically.

---

## 8. Common Pitfalls

- **Returning an error-shaped object instead of throwing.** `return { error: 'not found' }` still produces a 200 OK — clients checking `response.status` will see success even though the payload represents a failure. Always throw an `HttpException` subclass for actual error conditions.
- **Forgetting POST defaults to 201, not 200.** Tests or client code that assert on `res.status === 200` for a POST endpoint will fail until `@HttpCode(HttpStatus.OK)` is added, or until the test is corrected to expect 201 — both are valid depending on intent, but the mismatch is a frequent source of confusing failing tests.
- **Using `@HttpCode()` and expecting it to apply to thrown errors.** `@HttpCode()` only governs the success path; an exception thrown from the same handler is still mapped to whatever status the specific `HttpException` subclass carries, regardless of what `@HttpCode()` says.
- **Setting headers with `@Header()` for values that must be computed per request.** `@Header()`'s arguments are fixed at class-definition time — attempting to reference `this` or per-request data inside it does not work as one might hope; use `@Res({ passthrough: true })` and `res.setHeader()` instead for dynamic headers.
- **Returning a malformed object from a `@Redirect()`-decorated handler.** If the returned object doesn't have a `url` property, Nest falls back to the decorator's default, which can silently mask a bug where the intended dynamic destination is never used.
- **Leaking internal error details in a thrown `HttpException`.** Passing raw database errors, stack traces, or internal identifiers as the exception message exposes implementation details to API clients; sanitize messages before throwing, especially for `InternalServerErrorException`.

---

## 9. Best Practices

- **Throw, don't return, for error conditions** — this keeps error handling composable with Nest's exception filters (Phase 8) and consistent with how clients expect HTTP APIs to signal failure.
- **Use the named `HttpException` subclasses** (`NotFoundException`, `ConflictException`, etc.) instead of constructing `new HttpException(msg, code)` by hand — it's more readable and self-documents intent.
- **Reserve `@HttpCode()` overrides for genuine exceptions to convention** (e.g., 202 Accepted for async processing, 204 No Content for deletes) rather than habitually overriding every route.
- **Keep body-level "sub-status" fields distinct from HTTP status codes** — use the HTTP code to represent whether the *request itself* succeeded, and a body field to represent business-level outcome nuance within a successful request.
- **Prefer `@Header()` for static headers and `@Res({ passthrough: true })` for anything computed per request** — don't reach for the raw response object just to set a header that never changes.
- **Use `@Redirect()`'s dynamic return-value override** rather than injecting `@Res()` to call `res.redirect()` manually, unless you need behavior `@Redirect()` doesn't support.

---

## 10. Hands-On Exercises

**Exercise 1:** Build a `POST /orders` endpoint and confirm via `curl -i` that it returns `201 Created` by default. Add `@HttpCode(HttpStatus.OK)` and confirm the response is now `200 OK` with no other code changes.

**Exercise 2:** Build a `DELETE /orders/:id` endpoint that returns nothing and uses `@HttpCode(HttpStatus.NO_CONTENT)`. Confirm with `curl -i` that the response is `204` with an empty body.

**Exercise 3:** Build a `GET /orders/:id` endpoint that throws `NotFoundException` when the id isn't in a small in-memory array, and returns the order otherwise. Verify both the 404 JSON error shape (`statusCode`, `message`) and the 200 success shape.

**Exercise 4:** Build a `POST /orders/submit` endpoint modeled on the worked example in section 7 — implement at least three distinct thrown exceptions (`BadRequestException`, `ConflictException`, `NotFoundException`) driven by different invalid inputs, plus two different successful body shapes (e.g., `"confirmed"` vs `"backordered"`) both returning HTTP 200. Test all five paths with `curl`.

**Exercise 5:** Build a `GET /go` endpoint using `@Redirect('https://example.com', 302)` as the default, where a `?to=github` query parameter causes it to return `{ url: 'https://github.com/', statusCode: 301 }` instead. Verify with `curl -i` (which shows the `Location` header and status code without following the redirect) that both the default and override paths produce the correct status code and `Location` header.

---

## 11. Interview Q&A

**Q: What does a NestJS handler need to do to produce an HTTP response, and what determines the default status code?**
Answer: By default, a handler's return value becomes the JSON-serialized response body, and Nest chooses a default status code based on the HTTP method decorator used — 200 for `@Get()`, `@Put()`, and `@Patch()`, 201 for `@Post()`, and 200 for `@Delete()` unless overridden. Promises are awaited and Observables are subscribed to automatically, with the resolved/emitted value used the same way a plain return value would be. This default can be overridden per-route with `@HttpCode()`.

**Q: How do you produce an error response in NestJS, and what's wrong with just returning an object like `{ error: 'not found' }`?**
Answer: Error responses are produced by throwing an `HttpException` or one of its named subclasses (e.g., `NotFoundException`, `BadRequestException`), which Nest's built-in exception layer intercepts and converts into a JSON error body with the correct HTTP status code. Returning an object like `{ error: 'not found' }` instead of throwing still results in a 200 OK response — the HTTP status line tells the client the request succeeded, even though the payload semantically represents a failure, which breaks standard client error-handling logic that checks `response.status` before parsing the body.

**Q: What is the relationship between `@HttpCode()` and a thrown exception's status code — does `@HttpCode()` ever apply to error responses?**
Answer: No — `@HttpCode()` only overrides the default status code used for a handler's successful (non-throwing) code path. If the handler throws an `HttpException` (or subclass), the status code sent to the client comes entirely from that exception (e.g., `NotFoundException` always sends 404), regardless of what `@HttpCode()` declares on the same handler. The two mechanisms are independent — one governs the success path's default, the other governs thrown-error responses.

**Q: How does `@Redirect()` work, and how can a handler override its default target dynamically?**
Answer: `@Redirect(url, statusCode)` marks a handler as producing an HTTP redirect with a default target URL and status code (302 if omitted). If the decorated handler's return value is an object of the shape `{ url: string; statusCode?: number }`, Nest uses those values instead of the decorator's defaults for that specific request; if the handler returns nothing (or something that doesn't match that shape), the decorator's static defaults are used. This lets a single route conditionally redirect to different destinations based on request data (e.g., a query parameter) while keeping the redirect logic declarative.

**Q: Why might a real-world API return HTTP 200 for both a "confirmed" and a "backordered" outcome on the same order-submission endpoint, rather than using different status codes for each?**
Answer: Because both outcomes represent the request itself succeeding — the server correctly received, validated, and processed the submission; the "confirmed" vs "backordered" distinction is a business-level sub-state of a successful operation, not an HTTP-level failure. Encoding it as a field in the response body rather than as a distinct HTTP status code follows standard REST semantics: 2xx codes communicate "the server did what was asked," while 4xx/5xx codes communicate genuine request-processing problems (bad input, missing resource, conflict, server error). Using something like 409 for "backordered" would incorrectly signal that the request itself was invalid or conflicting, which could cause client retry logic or error-handling code to behave incorrectly.

**Q: If you need to set a response header whose value depends on runtime data (not known at decoration time), can you use `@Header()`?**
Answer: Not directly — `@Header('name', 'value')`'s arguments are fixed when the decorator is applied to the class, so it can't reference per-request data like a computed timestamp or a value derived from the request body. For dynamic headers, the handler should inject `@Res({ passthrough: true }) res: Response` and call `res.setHeader(name, value)` directly with the computed value, while still returning a normal value from the handler for Nest to serialize as the body — the `passthrough: true` option ensures Nest's automatic response handling stays active for everything except the explicitly-set header.
