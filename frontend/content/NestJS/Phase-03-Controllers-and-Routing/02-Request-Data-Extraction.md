# Request Data Extraction — Complete Guide

## Table of Contents
1. [Why Extraction Decorators Exist](#1-why-extraction-decorators-exist)
2. [@Param() — Route Parameters](#2-param--route-parameters)
3. [@Query() — Query String Parameters](#3-query--query-string-parameters)
4. [@Body() — Request Body](#4-body--request-body)
5. [@Headers() and @Ip()](#5-headers-and-ip)
6. [@Req() — The Raw Request Object](#6-req--the-raw-request-object)
7. [@Res() and Why It Disables Automatic Response Handling](#7-res-and-why-it-disables-automatic-response-handling)
8. [Worked Example — Multi-Source Extraction and Validation](#8-worked-example--multi-source-extraction-and-validation)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why Extraction Decorators Exist

Every incoming HTTP request carries data in several distinct places: the URL path (route parameters), the query string, the request body, the headers, and connection metadata like the client's IP address. A framework built directly on Express or Fastify would have you reach into a single `req` object and manually pick these apart (`req.params.id`, `req.query.page`, `req.body`, `req.headers['authorization']`).

Nest replaces this with **parameter decorators** — small annotations placed on a handler method's parameters that tell Nest exactly which slice of the incoming request to extract and hand to that parameter, already typed.

```
  Incoming HTTP Request
  ┌─────────────────────────────────────────────────────┐
  │ PATCH /orders/42?notify=true                         │
  │ Headers: { authorization: 'Bearer ...', ... }         │
  │ Body:    { status: 'shipped' }                        │
  │ From:    203.0.113.7                                  │
  └─────────────────────────────────────────────────────┘
                        │
                        ▼
  @Patch(':id')
  update(
    @Param('id') id: string,             ← '42'
    @Query('notify') notify: string,     ← 'true'
    @Body() body: UpdateOrderDto,        ← { status: 'shipped' }
    @Headers('authorization') auth: string, ← 'Bearer ...'
    @Ip() ip: string,                    ← '203.0.113.7'
  ) { ... }
```

This is more than syntactic sugar: it means handler signatures document exactly what data a route consumes, it plugs into Nest's pipe system (so a `@Body()` parameter can be automatically validated and transformed before the handler body ever runs), and it keeps handler code testable without needing to construct fake Express request/response objects.

---

## 2. @Param() — Route Parameters

`@Param()` extracts values captured by `:name` placeholders in the route path (see lesson 1 of this phase for how those placeholders are declared).

```typescript
import { Controller, Get, Param } from '@nestjs/common';

@Controller('orders')
export class OrdersController {
  // Extract a single named param
  @Get(':id')
  findOne(@Param('id') id: string) {
    return { id };
  }

  // Extract all params as an object
  @Get(':id/items/:itemId')
  findItem(@Param() params: { id: string; itemId: string }) {
    return params; // { id: '...', itemId: '...' }
  }
}
```

Calling `@Param()` with no argument returns an object containing every route parameter for that path. Calling it with a string argument (`@Param('id')`) extracts just that one value. All route parameter values arrive as `string` — there is no automatic type coercion, even for numeric-looking segments.

---

## 3. @Query() — Query String Parameters

`@Query()` extracts values from the URL's query string (everything after `?`).

```typescript
import { Controller, Get, Query } from '@nestjs/common';

@Controller('orders')
export class OrdersController {
  // GET /orders?page=2&limit=10&status=shipped
  @Get()
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status?: string,
  ) {
    return { page, limit, status };
  }

  // Extract the entire query object at once
  @Get('search')
  search(@Query() query: Record<string, string>) {
    return query;
  }
}
```

Like route params, query values arrive as strings by default (or as an array of strings for repeated keys like `?tag=a&tag=b`). Numeric filters, pagination limits, and boolean flags in the query string all need explicit parsing or a validation pipe with `class-transformer` (covered in Phase 6) to become the types your business logic expects.

---

## 4. @Body() — Request Body

`@Body()` extracts the parsed request body — Nest relies on the underlying platform's body parser (Express's `body-parser`/`express.json()`, or Fastify's built-in JSON parsing) to have already turned the raw request stream into a JavaScript object before your handler runs.

```typescript
import { Controller, Post, Body } from '@nestjs/common';

class CreateOrderDto {
  productId: string;
  quantity: number;
}

@Controller('orders')
export class OrdersController {
  // Extract the whole body, typed as a DTO
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return { received: dto };
  }

  // Extract a single top-level property from the body
  @Post('quick')
  quickCreate(@Body('productId') productId: string) {
    return { productId };
  }
}
```

Unlike route params and query values, `@Body()` typically carries values with their JSON-native types already intact (numbers stay numbers, booleans stay booleans) — the coercion problem for `@Body()` is less about strings-vs-numbers and more about validating that the shape and contents actually match your DTO, since without an explicit `ValidationPipe`, Nest does not enforce that the incoming object matches `CreateOrderDto` at runtime; TypeScript's type annotation is compile-time only.

---

## 5. @Headers() and @Ip()

`@Headers()` extracts HTTP headers, and `@Ip()` extracts the client's IP address as resolved by the underlying platform (respecting `X-Forwarded-For` when trust proxy settings are configured).

```typescript
import { Controller, Get, Headers, Ip } from '@nestjs/common';

@Controller('diagnostics')
export class DiagnosticsController {
  // Extract a single header (case-insensitive lookup)
  @Get('auth-check')
  authCheck(@Headers('authorization') auth: string) {
    return { received: Boolean(auth) };
  }

  // Extract all headers as an object
  @Get('headers')
  allHeaders(@Headers() headers: Record<string, string>) {
    return headers;
  }

  @Get('client-ip')
  clientIp(@Ip() ip: string) {
    return { ip };
  }
}
```

---

## 6. @Req() — The Raw Request Object

`@Req()` gives you the platform's native request object directly — an Express `Request` or a Fastify `FastifyRequest`, depending on which adapter your app uses.

```typescript
import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('orders')
export class OrdersController {
  @Get('debug')
  debug(@Req() request: Request) {
    return {
      path: request.path,
      method: request.method,
      params: request.params,
      query: request.query,
      cookies: request.cookies,
    };
  }
}
```

### Decorators vs the raw request object

| Aspect | Parameter decorators (`@Param`, `@Query`, etc.) | `@Req()` |
|---|---|---|
| Platform coupling | None — works identically on Express or Fastify | Tied to the specific adapter's types (`Request` from `express` vs `FastifyRequest`) |
| Testability | Trivial to unit test — pass plain values | Requires mocking a request-shaped object |
| Pipe integration | Fully integrated (validation/transformation pipes apply) | Bypassed unless you manually pass extracted values through pipes |
| Readability | Handler signature documents exactly what's consumed | Signature just says "give me everything" |
| When to use | The default choice for almost all handlers | Only when you need something the decorators don't expose (raw stream, platform-specific extension, session object from a non-Nest middleware) |

The practical guidance: reach for the specific decorators first. Only fall back to `@Req()` when you need platform-specific functionality the decorators don't surface — for example, a `req.session` object attached by an Express session middleware, or streaming the raw request body for a file upload that bypasses the JSON body parser.

---

## 7. @Res() and Why It Disables Automatic Response Handling

`@Res()` injects the platform's native response object (Express `Response` or Fastify `FastifyReply`), giving you direct control to call `.status()`, `.json()`, `.send()`, `.redirect()`, and so on.

```typescript
import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller('legacy')
export class LegacyController {
  @Get('ping')
  ping(@Res() res: Response) {
    res.status(200).json({ pong: true });
  }
}
```

This looks harmless — and it works — but it has a consequence that trips up nearly every developer coming from Express: **injecting `@Res()` switches the handler into "library-specific response mode," and Nest stops automatically handling the response for that route entirely.** Concretely:

- Whatever value you `return` from the handler is **ignored** — Nest will not serialize it to JSON or send it. If you both `return someValue` and never call `res.send()`/`res.json()`, the client's connection **hangs** waiting for a response that never arrives.
- `@HttpCode()`, `@Header()`, and interceptors that rely on Nest's normal response pipeline (e.g., a global response-transforming interceptor) are **bypassed** for that handler, because the response has already been sent directly through the platform object.
- Exception filters still catch thrown errors, but any exception filter logic that assumes it can shape the response via Nest's mechanisms must instead also use the raw response object consistently.

```
  Normal Nest response flow:
  handler returns value ──▶ Nest serializes ──▶ interceptors run ──▶ response sent

  With @Res() injected:
  handler calls res.json(...) ──▶ response sent immediately
  (handler's return value, @HttpCode, @Header, and response-shaping
   interceptors are all bypassed for this route)
```

```typescript
// BUG: mixes @Res() with a return statement — the return value is
// silently discarded, and if res.json() were forgotten, this route
// would hang forever with no response sent.
@Get('broken')
broken(@Res() res: Response) {
  return { message: 'this is never sent to the client' };
}
```

If you must use `@Res()` (for example, to stream a file, set a cookie via a platform-specific API not covered by `@Header()`, or perform a manual redirect with fine-grained control), pass `{ passthrough: true }` to keep Nest's standard response handling active for everything except what you explicitly call on the response object:

```typescript
import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller('files')
export class FilesController {
  @Get('download-token')
  downloadToken(@Res({ passthrough: true }) res: Response) {
    res.cookie('download-token', 'abc123', { httpOnly: true });
    return { message: 'token issued' }; // still serialized normally by Nest
  }
}
```

With `passthrough: true`, calling `res.cookie(...)`, `res.setHeader(...)`, etc. still works directly against the response object, but Nest still takes the handler's return value and serializes it as the response body — you get the best of both without hanging the request.

---

## 8. Worked Example — Multi-Source Extraction and Validation

The following handler pulls data from every source covered above in one request — route parameter, query string, body, a header, and the client IP — and performs basic manual validation before delegating to a service. (Automatic DTO validation via `class-validator` and `ValidationPipe` is covered in depth in Phase 6; here the validation is done explicitly to show what the pipes will later automate.)

```typescript
import {
  Controller,
  Patch,
  Param,
  Query,
  Body,
  Headers,
  Ip,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

class UpdateOrderStatusDto {
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
}

@Controller('orders')
export class OrdersController {
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Query('notify') notify: string | undefined,
    @Body() dto: UpdateOrderStatusDto,
    @Headers('authorization') authHeader: string | undefined,
    @Ip() clientIp: string,
  ) {
    // Header validation — reject if no bearer token present
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed authorization header');
    }

    // Route param sanity check — id must look like a positive integer
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException(`Invalid order id: ${id}`);
    }

    // Body validation — status must be one of the known values
    const allowedStatuses = ['pending', 'shipped', 'delivered', 'cancelled'];
    if (!allowedStatuses.includes(dto.status)) {
      throw new BadRequestException(`Invalid status: ${dto.status}`);
    }

    // Query param — optional boolean-like flag, parsed manually
    const shouldNotify = notify === 'true';

    return {
      orderId: Number(id),
      newStatus: dto.status,
      notified: shouldNotify,
      requestedFrom: clientIp,
    };
  }
}
```

A request such as `PATCH /orders/42/status?notify=true` with body `{ "status": "shipped" }` and an `Authorization: Bearer xyz` header pulls all five pieces of data through their respective decorators, with each one validated in isolation before the combined result is returned — demonstrating how each decorator isolates exactly one part of the request without needing to touch a raw `req` object.

### Reducing repetition with a custom parameter decorator

When the same extraction-plus-validation logic (like the bearer-token check above) is needed across many handlers, repeating it inline becomes noisy. Nest lets you compose a custom parameter decorator with `createParamDecorator`, wrapping the raw request access in a reusable, typed extraction step — the full mechanics of custom decorators are covered in Phase 8, but a minimal preview is useful here since it directly builds on `@Req()`:

```typescript
import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const BearerToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed authorization header');
    }
    return header.slice('Bearer '.length);
  },
);
```

```typescript
@Patch(':id/status')
updateStatus(@Param('id') id: string, @BearerToken() token: string) {
  return { id, tokenPreview: token.slice(0, 6) };
}
```

This is functionally equivalent to manually reading `@Headers('authorization')` and validating it in every handler, but centralizes the extraction-and-validation logic in one place, keeping individual handlers focused on business logic rather than repeated boilerplate.

---

## 9. Common Pitfalls

- **Mixing `@Res()` with a `return` statement.** As shown in section 7, the return value is silently dropped once `@Res()` is injected without `passthrough: true`. If the code path also forgets to call `res.send()`/`res.json()`, the request hangs with no response and no error — a notoriously hard bug to diagnose because nothing throws.
- **Assuming query/param values are typed.** `@Query('page') page: number` does not actually make `page` a number at runtime — it's still the string `"2"` unless a transformation pipe is applied. Arithmetic or strict equality against a number silently misbehaves (`"2" + 1 === "21"`, not `3`).
- **Forgetting `@Body()` returns `undefined` for GET/DELETE requests without a body parser configured for them**, or when the client sends the wrong `Content-Type` header (e.g., `text/plain` instead of `application/json`) — the body parser may not parse it into an object at all.
- **Reaching for `@Req()` reflexively out of Express habit.** Developers coming from raw Express often default to `@Req()` for everything, losing the platform independence, testability, and pipe integration that the specific decorators provide.
- **Trusting `@Ip()` or the `X-Forwarded-For` header blindly** when the app isn't actually behind a trusted proxy — client-supplied headers can be spoofed, and Express's `trust proxy` setting must be configured correctly for `@Ip()` to reflect the real client IP rather than the proxy's.
- **Not validating header presence before using it.** `@Headers('authorization')` returns `undefined` if the header is absent — code that does `authHeader.startsWith(...)` without a null check throws an unhandled `TypeError` instead of a clean 401/400 response.

---

## 10. Best Practices

- **Prefer specific decorators over `@Req()`/`@Res()`** in the vast majority of handlers — they're more testable, platform-agnostic, and self-documenting.
- **If `@Res()` is unavoidable, always pass `{ passthrough: true }`** unless you genuinely need to take over the entire response lifecycle (e.g., streaming a file with fine-grained control over headers and chunking).
- **Never mix an unguarded `@Res()` injection with a `return` statement** — pick one response strategy per handler and be consistent.
- **Treat every extracted string value as untrusted and untyped until validated/transformed** — route params, query values, and headers are always strings (or `undefined`), regardless of what your parameter's TypeScript annotation says.
- **Use dedicated DTO classes for `@Body()`**, and move toward `class-validator` + `ValidationPipe` (Phase 6) as soon as you're past a proof-of-concept, rather than hand-rolling validation like the worked example above indefinitely.
- **Group related extracted values into small typed objects** when a handler pulls from three or more sources, to keep the parameter list from becoming unreadable.

---

## 11. Hands-On Exercises

**Exercise 1:** Build a `GET /search` endpoint that accepts query parameters `q` (search term, required), `page` (default `"1"` if absent), and `limit` (default `"20"` if absent). Return an object echoing back the parsed values, with `page` and `limit` converted to numbers manually. Test with and without each query parameter present.

**Exercise 2:** Build a `POST /feedback` endpoint that extracts the body as a `FeedbackDto` (`{ message: string; rating: number }`), plus the `User-Agent` header via `@Headers('user-agent')`, plus the client IP via `@Ip()`. Return all three combined. Verify the response with a tool like `curl -H "User-Agent: test-agent"`.

**Exercise 3:** Deliberately write a broken handler that injects `@Res()` and also has a `return` statement without calling `res.send()`. Send a request to it and observe the hanging behavior (use a short timeout on your HTTP client to avoid waiting forever). Then fix it two ways: (a) remove the `return` and call `res.json()` explicitly, and (b) instead use `@Res({ passthrough: true })` and keep the `return`. Compare the two working versions.

**Exercise 4:** Write a handler that reads the `Authorization` header and throws `UnauthorizedException` if it's missing or doesn't start with `"Bearer "`. Verify: a request with no header returns 401, a request with `Authorization: Basic xyz` returns 401, and a request with `Authorization: Bearer abc` succeeds.

**Exercise 5:** Add a `@Get('debug')` handler that injects `@Req()` and logs (or returns) `request.path`, `request.method`, `request.query`, and `request.headers`. Compare the amount of code and type-safety versus writing the equivalent handler using `@Query()` and `@Headers()` decorators instead. Write down which approach you'd choose for a production endpoint and why.

---

## 12. Interview Q&A

**Q: What is the practical difference between using `@Query('page')` and injecting `@Req()` and reading `request.query.page` yourself?**
Answer: Functionally they retrieve the same underlying value, but `@Query('page')` is platform-agnostic (works unchanged whether the app runs on Express or Fastify), integrates with Nest's pipe system so a validation/transformation pipe can run against just that value, and keeps the handler's signature self-documenting about what data it consumes. Reading `request.query.page` via `@Req()` ties the handler to the specific platform's request type, bypasses pipes unless you manually route the value through one, and makes unit testing harder since you now need to construct a request-shaped mock object instead of just passing a string.

**Q: Why does using `@Res()` disable Nest's automatic response handling, and what's the classic bug that results?**
Answer: Once `@Res()` (without `passthrough: true`) is injected into a handler, Nest assumes you are taking full manual control of the response and stops automatically serializing and sending the handler's return value — it also skips applying `@HttpCode()`, `@Header()`, and any response-shaping interceptors for that route, since the platform-native response object has already been used directly. The classic bug is writing a handler that both injects `@Res()` and has a `return` statement without ever calling `res.send()`/`res.json()`/`res.end()` — the return value is silently discarded, no response is ever sent, and the client's request hangs with no error thrown anywhere in the code.

**Q: How do you use `@Res()` without losing Nest's automatic response handling?**
Answer: Pass `{ passthrough: true }` as an option to the decorator: `@Res({ passthrough: true }) res: Response`. This still gives direct access to the native response object for operations Nest doesn't expose through its own decorators (like setting a cookie or a highly custom header), but Nest still takes whatever value the handler returns and serializes it as the JSON response body — so you get the benefit of manual response object access without having to hand-roll the entire response.

**Q: Are values extracted via `@Param()` and `@Query()` automatically converted to the type declared in the handler's TypeScript signature?**
Answer: No. TypeScript's type annotations are compile-time only and have no effect on runtime behavior — `@Param('id') id: number` does not coerce the extracted route segment into an actual JavaScript number; it remains a string at runtime. The same is true for `@Query()`. To get real runtime coercion, you need an explicit pipe (like `ParseIntPipe`) applied to that specific parameter, or a broader validation/transformation pipeline using `class-transformer`, which is covered in the Pipes and Validation phase.

**Q: When would you legitimately need `@Req()` instead of the specific extraction decorators?**
Answer: Cases where the decorators don't expose what you need — for example, reading a session object attached by an Express session middleware (`req.session`), accessing the raw request stream for a custom file upload handler that bypasses the standard JSON body parser, reading platform-specific properties not represented by any Nest decorator, or needing the full request object to pass into a third-party library function that expects an Express/Fastify request shape. Outside of these cases, the specific decorators are preferred for testability and platform independence.

**Q: What happens if a client sends a request body with the wrong Content-Type header, e.g. `text/plain` for a JSON payload?**
Answer: The underlying body parser (Express's `express.json()` or Fastify's built-in JSON content type parser) typically only parses the body when the `Content-Type` header matches what it's configured to handle — usually `application/json`. If the client sends `text/plain` or omits the header, `@Body()` may receive `undefined`, an empty object, or the raw unparsed string depending on adapter configuration, rather than throwing an error automatically. This is why validating that `@Body()` actually contains the expected shape (ideally via a `ValidationPipe` and DTO) is important — a missing or malformed body should produce a clear 400 error rather than silently proceeding with `undefined` fields.
