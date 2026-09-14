# Performance & Security Hardening — Complete Guide

## Table of Contents
1. [The Production Hardening Checklist](#1-the-production-hardening-checklist)
2. [The Fastify Adapter](#2-the-fastify-adapter)
3. [Migrating Express to Fastify — Considerations](#3-migrating-express-to-fastify--considerations)
4. [Securing HTTP Headers with Helmet](#4-securing-http-headers-with-helmet)
5. [Rate Limiting with @nestjs/throttler](#5-rate-limiting-with-nestjsthrottler)
6. [Compression](#6-compression)
7. [Response Caching with @nestjs/cache-manager](#7-response-caching-with-nestjscache-manager)
8. [Worked Example — Throttler + Helmet + Cached Endpoint](#8-worked-example--throttler--helmet--cached-endpoint)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The Production Hardening Checklist

Everything built in Phases 01-11 assumed a trusted, low-traffic environment: a developer's machine or a CI test run. Production traffic is neither trusted nor low-volume — it includes malicious actors probing for vulnerabilities, legitimate clients hammering endpoints faster than intended, and enough concurrent load that the underlying HTTP server's raw throughput starts to matter. This lesson covers five independent hardening layers that stack on top of each other:

```
  Incoming request
        │
        ▼
  ┌─────────────────────────────────────────────────────────┐
  │  HTTP adapter (Express or Fastify)                       │
  ├─────────────────────────────────────────────────────────┤
  │  Helmet — security headers                                │
  ├─────────────────────────────────────────────────────────┤
  │  Throttler — rate limiting                                │
  ├─────────────────────────────────────────────────────────┤
  │  Compression — response body size                          │
  ├─────────────────────────────────────────────────────────┤
  │  Cache interceptor — skip re-computation entirely          │
  ├─────────────────────────────────────────────────────────┤
  │  Your controllers / business logic                       │
  └─────────────────────────────────────────────────────────┘
```

None of these are mutually exclusive, and in most production Nest apps all five are present simultaneously.

---

## 2. The Fastify Adapter

Nest is HTTP-framework-agnostic under the hood — the `@nestjs/platform-express` adapter is the default, but `@nestjs/platform-fastify` is a drop-in alternative built on [Fastify](https://fastify.dev/), which benchmarks consistently faster than Express (often 2x or more raw requests/sec in synthetic benchmarks) due to a more efficient routing implementation and schema-based JSON serialization.

```bash
npm install @nestjs/platform-fastify
npm uninstall @nestjs/platform-express  # optional, if fully migrating
```

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }), // Nest's own logger handles this
  );

  await app.listen(3000, '0.0.0.0');
}
bootstrap();
```

The controller and provider layer — `@Controller`, `@Get`, `@Body`, dependency injection, guards, interceptors, pipes — is entirely unaffected by the choice of adapter. Nest abstracts the HTTP layer behind `HttpAdapterHost`, so the same business logic runs unmodified on either Express or Fastify. What changes is anything that reaches into the underlying request/response objects directly.

---

## 3. Migrating Express to Fastify — Considerations

Fastify is not a perfect drop-in replacement; a few things need attention during migration:

- **Raw request/response access.** Code that calls `@Req() req: Request` and relies on Express-specific methods (`res.status(200).json(...)` used directly instead of returning a value, `req.query` typed as Express's `Request`) needs its types changed to Fastify's `FastifyRequest`/`FastifyReply`. Prefer Nest's framework-agnostic decorators (`@Body()`, `@Query()`, `@Param()`) over raw `@Req()`/`@Res()` wherever possible — this is what keeps code adapter-independent in the first place.
- **Middleware compatibility.** Express middleware (the vast `connect`-style ecosystem) is not directly compatible with Fastify, which uses its own plugin system. Popular middleware like `helmet`, `@nestjs/throttler`, and `compression` all have Fastify-compatible integration paths (see sections 4 and 6), but a random Express-only middleware package may not have a Fastify equivalent.
- **`@Res()` mode disables Nest's response handling.** Injecting `@Res()` (on Fastify, `FastifyReply`) to manually control the response opts you out of Nest's automatic serialization, interceptors that transform the response body, and exception filters that would otherwise format errors consistently. This is true under Express too, but Fastify's raw reply API differs enough (`.send()` instead of `.json()`, no `.status().json()` chaining by default) that hand-migrated code often gets this subtly wrong.
- **File uploads.** Express commonly uses `multer`; Fastify uses `@fastify/multipart` with a different API. Multer-based interceptors (`FileInterceptor` from `@nestjs/platform-express`) do not work on Fastify without swapping to Fastify-specific equivalents.
- **Testing.** `supertest`, widely used for Nest e2e tests, works against Fastify's HTTP server the same way it does Express's, since both ultimately listen on a real HTTP socket during tests — this part typically requires no change.

**When to actually migrate:** Fastify's throughput advantage matters most for I/O-light, high-QPS services (a gateway, a hot read-path API) where the framework's own overhead is a meaningful fraction of request latency. For typical CRUD services bottlenecked by database round-trips, the adapter choice is largely immaterial to end-to-end latency — don't migrate an existing, stable Express-based service purely for a benchmark number without a specific throughput problem to solve.

---

## 4. Securing HTTP Headers with Helmet

[Helmet](https://helmetjs.github.io/) sets a collection of HTTP response headers that mitigate well-known classes of attacks — clickjacking, MIME-sniffing, and others — with sensible defaults. It works with both Express and Fastify, via different packages.

```bash
# Express
npm install helmet

# Fastify
npm install @fastify/helmet
```

```typescript
// main.ts (Express)
import helmet from 'helmet';
// ...
const app = await NestFactory.create(AppModule);
app.use(helmet());
await app.listen(3000);
```

```typescript
// main.ts (Fastify)
import fastifyHelmet from '@fastify/helmet';
// ...
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
await app.register(fastifyHelmet);
await app.listen(3000, '0.0.0.0');
```

Helmet's defaults include `X-Content-Type-Options: nosniff` (prevents browsers from MIME-sniffing a response away from its declared content type), `X-Frame-Options: SAMEORIGIN` (mitigates clickjacking), and a restrictive `Content-Security-Policy`. The CSP default is strict enough that it commonly needs tuning for apps that serve any inline scripts or styles, or load assets from a CDN:

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        scriptSrc: [`'self'`, `'unsafe-inline'`, 'cdn.example.com'],
        styleSrc: [`'self'`, `'unsafe-inline'`],
      },
    },
  }),
);
```

For a pure JSON API with no browser-rendered HTML, the CSP header is largely irrelevant to your own responses (browsers only enforce it against documents they render), but leaving Helmet's other headers on still costs nothing and closes off attack surface for any HTML error pages or documentation served from the same origin.

---

## 5. Rate Limiting with @nestjs/throttler

`@nestjs/throttler` implements request rate limiting per client (by default, keyed on IP address), protecting against both malicious abuse and accidental traffic spikes from a buggy client.

```bash
npm install @nestjs/throttler
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second window
        limit: 3, // 3 requests per second
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute window
        limit: 100, // 100 requests per minute
      },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

Registering `ThrottlerGuard` as an `APP_GUARD` applies both named limits (`short` and `long`) globally to every route. Override or skip the limit on a per-route or per-controller basis with decorators:

```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // tighter limit on a sensitive endpoint
  login() {
    /* ... */
  }

  @Get('status')
  @SkipThrottle() // exempt a cheap, frequently-polled endpoint
  status() {
    return { ok: true };
  }
}
```

In multi-instance deployments (more than one running pod/container), the default in-memory storage tracks request counts per-process — meaning a client could exceed the intended global limit by hitting different instances behind a load balancer. Use `@nestjs/throttler`'s Redis-backed storage in that case so all instances share one counter:

```bash
npm install @nest-lab/throttler-storage-redis ioredis
```

```typescript
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

ThrottlerModule.forRootAsync({
  useFactory: () => ({
    throttlers: [{ ttl: 60000, limit: 100 }],
    storage: new ThrottlerStorageRedisService(new Redis(process.env.REDIS_URL)),
  }),
});
```

---

## 6. Compression

Compression middleware reduces response payload size on the wire (gzip/brotli), trading a small amount of CPU for reduced bandwidth and faster client-perceived load times — particularly valuable for JSON APIs returning large collections.

```bash
# Express
npm install compression

# Fastify
npm install @fastify/compress
```

```typescript
// main.ts (Express)
import compression from 'compression';
app.use(compression());
```

```typescript
// main.ts (Fastify)
import fastifyCompress from '@fastify/compress';
await app.register(fastifyCompress, { global: true });
```

Compression is nearly free to enable and rarely worth disabling for JSON APIs, though it's worth excluding already-compressed payloads (images, video, pre-gzipped files) since re-compressing them wastes CPU for no size benefit — both packages support a `filter` option for this.

---

## 7. Response Caching with @nestjs/cache-manager

`@nestjs/cache-manager` wraps the `cache-manager` package to provide an interceptor-based response cache — repeated requests to the same route with the same cache key return a stored response instead of re-executing the handler.

```bash
npm install @nestjs/cache-manager cache-manager
# for a Redis-backed store instead of in-memory:
npm install cache-manager-redis-yet
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({ url: process.env.REDIS_URL }),
        ttl: 30_000, // default TTL in ms, overridable per-route
      }),
    }),
  ],
})
export class AppModule {}
```

Apply `CacheInterceptor` globally or per-route, and control the cache key and TTL with `@CacheKey()` / `@CacheTTL()`:

```typescript
import { Controller, Get, Param, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@Controller('products')
@UseInterceptors(CacheInterceptor)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @CacheKey('all_products')
  @CacheTTL(60_000) // cache the list for 60 seconds
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  // no explicit @CacheKey — CacheInterceptor derives one from the request URL,
  // so /products/1 and /products/2 are cached under distinct keys automatically
  @CacheTTL(120_000)
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }
}
```

`CacheInterceptor` only caches `GET` requests by default (mutating verbs are never automatically cached, since caching a `POST`/`PATCH`/`DELETE` response would silently skip side effects on subsequent calls). When a route has no explicit `@CacheKey()`, the interceptor derives the key from the full request URL — meaning query strings matter: `/products?page=1` and `/products?page=2` are cached separately, which is usually the desired behavior but is worth being aware of.

---

## 8. Worked Example — Throttler + Helmet + Cached Endpoint

A single bootstrap combining all three, protecting and speeding up a public product catalog endpoint that is read far more often than it changes.

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(helmet());
  app.use(compression());
  app.enableCors({ origin: process.env.ALLOWED_ORIGIN, credentials: true });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]), // 120 req/min per IP
    CacheModule.register({ isGlobal: true, ttl: 30_000 }),
    ProductsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

```typescript
// products/products.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { SkipThrottle } from '@nestjs/throttler';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30_000) // catalog list changes infrequently; 30s cache is safe
  async findAll(@Query('category') category?: string) {
    return this.productsService.findAll(category);
  }

  @Get('health-check-friendly-status')
  @SkipThrottle() // exempt from rate limiting, but NOT from caching
  status() {
    return { ok: true, timestamp: Date.now() };
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60_000)
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }
}
```

Request flow for `GET /products?category=electronics`: Helmet headers are attached, the Throttler guard checks and increments the per-IP counter (120/min budget), the `CacheInterceptor` computes a cache key from the URL (including the query string) and returns a stored response if present — only on a cache miss does `ProductsService.findAll()` actually run and hit the database — and the final response body is gzip/brotli compressed before being written to the socket.

---

## 9. Common Pitfalls

- **Rate limiting behind a load balancer without trusting `X-Forwarded-For` correctly.** If the app sits behind a reverse proxy and Express/Fastify isn't configured with `trust proxy` (Express) or an equivalent Fastify option, every request appears to originate from the proxy's IP — collapsing all clients into one throttler bucket. Configure the trust-proxy setting to read the real client IP from the forwarded header.
- **Caching authenticated or per-user responses under a shared key.** `CacheInterceptor`'s default key derivation is based on the URL alone — if two different users hit the same URL and get different personalized responses, the cache will serve one user's data to another unless the cache key incorporates the user identity.
- **Caching mutating requests.** Never wrap a `POST`/`PATCH`/`DELETE` handler with `CacheInterceptor` expecting it to help — by design it skips non-GET requests, but if a custom interceptor is built to "fix" this, side effects will silently stop firing on repeated calls.
- **In-memory throttler storage in a multi-instance deployment.** Each pod tracks its own counter, so a client can multiply its effective rate limit by the number of running instances. Use a shared store (Redis) once you run more than one instance.
- **A CSP that's too strict for an app serving any HTML.** Helmet's default Content-Security-Policy can silently break an admin dashboard or API documentation page (Swagger UI) that loads inline scripts — test any browser-rendered surface after adding Helmet, don't just assume the defaults are safe for every route.
- **Migrating to Fastify without auditing `@Req()`/`@Res()` usage.** Code that works fine under Express because it calls Express-specific response methods will throw at runtime under Fastify, not at compile time, since both are typed loosely as `any` in many older Nest codebases.

---

## 10. Best Practices

- Apply Helmet, compression, and a global throttler as defaults for every service — they are cheap, broadly applicable, and have essentially no downside for a typical JSON API.
- Set tighter, endpoint-specific throttle limits on sensitive routes (login, password reset, any endpoint that triggers an expensive downstream call or email send) rather than relying solely on the global default.
- Cache at the layer where it has the highest hit rate and lowest staleness risk — a public, rarely-changing catalog endpoint is a great caching candidate; a per-user dashboard with real-time data is not.
- Always include the identity/tenant dimension in the cache key for anything that varies by requester — either via a custom `CacheKey` factory or by explicitly excluding personalized endpoints from the interceptor.
- Benchmark before migrating to Fastify. Measure your actual bottleneck (often the database, not the HTTP framework) before spending migration effort chasing a framework-level throughput number that may not move end-to-end latency at all.
- Use a shared (Redis-backed) store for both the throttler and the cache the moment you run more than one instance of the service — in-memory stores silently stop being correct in a multi-instance deployment.
- Keep `@Res()`/raw response access to a minimum, and isolate it behind a small number of well-tested handlers if you must use it, so an adapter migration touches a small, known surface area.

---

## 11. Hands-On Exercises

**Exercise 1:** Add `helmet` to an existing Nest application (Express adapter). Use browser devtools or `curl -I` to inspect the response headers before and after, and identify at least three headers Helmet added.

**Exercise 2:** Configure `@nestjs/throttler` with a limit of 5 requests per 10 seconds on a single endpoint. Write a small script (or use `curl` in a loop) that fires 10 requests in quick succession and confirm the 6th request onward returns HTTP 429 with a `Retry-After` header.

**Exercise 3:** Add `@nestjs/cache-manager` with the default in-memory store to a `GET /reports/summary` endpoint that has an artificial 2-second delay (simulate a slow query with `await new Promise(r => setTimeout(r, 2000))`). Confirm the first request takes ~2 seconds and every subsequent request within the TTL window returns near-instantly.

**Exercise 4:** Migrate a small existing Nest+Express project to the Fastify adapter. Identify and fix every place that breaks — in particular anywhere using `@Res()` or importing types from `express`. Confirm your e2e tests (via `supertest`) still pass unmodified.

**Exercise 5:** Deliberately create the "shared cache key across users" bug described in Common Pitfalls: cache a `GET /me` endpoint that returns the authenticated user's own profile, using the default `CacheInterceptor` with no custom key. Log in as two different users and demonstrate that the second user incorrectly receives the first user's cached profile. Then fix it by implementing a custom `CacheKey` derivation (e.g. via a custom interceptor extending `CacheInterceptor` that includes the user ID) and confirm the bug is resolved.

---

## 12. Interview Q&A

**Q: What changes and what stays the same when swapping Nest's Express adapter for Fastify?**
Answer: The controller/provider/DI layer is entirely unaffected because Nest abstracts the HTTP framework behind `HttpAdapterHost` — decorators like `@Controller`, `@Get`, `@Body`, guards, interceptors, and pipes work identically regardless of adapter. What changes is anything touching the raw request/response objects directly via `@Req()`/`@Res()` (different types and APIs), middleware (Express's `connect`-style middleware isn't Fastify-compatible; equivalents like `@fastify/helmet` and `@fastify/compress` must be used instead), and file upload handling (`multer` vs `@fastify/multipart`). Fastify's main draw is raw throughput, which matters most for I/O-light, high-QPS services rather than database-bound CRUD APIs.

**Q: Why register a rate limiter as a global APP_GUARD instead of applying it per-controller?**
Answer: Registering `ThrottlerGuard` via `{ provide: APP_GUARD, useClass: ThrottlerGuard }` applies the configured limit(s) to every route in the application by default, giving you a safety net against abuse or accidental traffic spikes without having to remember to decorate every new controller. Individual routes can still opt out (`@SkipThrottle()`) or override the limit (`@Throttle()`) as needed — sensitive endpoints like login typically get a tighter override, cheap polling endpoints get skipped. This "secure by default, opt out explicitly" pattern is safer than requiring every new endpoint to remember to add rate limiting itself.

**Q: What's the risk of using in-memory storage for @nestjs/throttler or @nestjs/cache-manager in a production deployment?**
Answer: In-memory storage tracks state per-process. In any deployment running more than one instance of the service behind a load balancer — which is the norm for production — each instance maintains its own independent counter or cache. For the throttler, this means a client's effective rate limit multiplies by the number of running instances, since a different instance's counter doesn't know about requests routed elsewhere. For the cache, it means a cache hit on one instance is a guaranteed miss on another, reducing the effective hit rate and potentially serving stale data inconsistently across instances. Both problems are solved by pointing the store at a shared backend like Redis.

**Q: Why does CacheInterceptor only cache GET requests by default, and what's the risk of caching a personalized endpoint?**
Answer: Caching a mutating request (POST/PATCH/DELETE) would mean a repeated identical request silently skips its side effects on subsequent calls, since it would return the stored response from the first invocation instead of executing the handler — a correctness bug, not a performance win. For GET requests, the risk is different: `CacheInterceptor` by default derives its cache key from the request URL only, so a personalized endpoint (e.g. "get my profile") that returns different data per authenticated user will serve one user's cached response to a different user hitting the same URL, unless the cache key is customized to include the user or tenant identity.

**Q: When would you choose Helmet's default configuration versus customizing the Content-Security-Policy?**
Answer: For a pure JSON API with no browser-rendered HTML, Helmet's defaults are safe to apply as-is since the CSP header is only enforced by browsers against documents they render — a JSON response has no CSP-relevant content. Once the same origin serves any HTML surface — an admin dashboard, Swagger UI documentation, a server-rendered page — the default CSP is often too strict and will silently block inline scripts, inline styles, or CDN-hosted assets, breaking functionality without an obvious error message client-side. In that case, explicitly configure `contentSecurityPolicy.directives` to allowlist exactly the sources and inline exceptions the app actually needs, rather than disabling CSP outright.
