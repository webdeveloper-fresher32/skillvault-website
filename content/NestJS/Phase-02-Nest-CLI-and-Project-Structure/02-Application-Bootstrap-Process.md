# The Application Bootstrap Process — main.ts, NestFactory, and Platform Adapters — Complete Guide

## Table of Contents
1. [What "Bootstrap" Means in NestJS](#1-what-bootstrap-means-in-nestjs)
2. [NestFactory.create() and the Bootstrap Lifecycle](#2-nestfactorycreate-and-the-bootstrap-lifecycle)
3. [Registering Global Pipes, Filters, and Interceptors](#3-registering-global-pipes-filters-and-interceptors)
4. [Enabling CORS](#4-enabling-cors)
5. [Setting a Global Prefix and API Versioning](#5-setting-a-global-prefix-and-api-versioning)
6. [The HTTP Adapter Abstraction — Express vs Fastify](#6-the-http-adapter-abstraction--express-vs-fastify)
7. [Graceful Shutdown and Lifecycle Hooks](#7-graceful-shutdown-and-lifecycle-hooks)
8. [Worked Example — A Fully Configured main.ts](#8-worked-example--a-fully-configured-maints)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. What "Bootstrap" Means in NestJS

Every other part of a NestJS application is declarative: you decorate classes with `@Module`, `@Controller`, `@Injectable`, and Nest's DI container figures out how to instantiate and wire everything together. `main.ts` is the one place where that stops being true — it is a plain imperative `async function bootstrap()` that:

1. Builds the entire dependency graph from your root module.
2. Attaches cross-cutting behavior (pipes, filters, interceptors, middleware, CORS) that should apply to *every* request, not just one controller.
3. Starts an HTTP server listening on a port.

```
  Declarative world                       Imperative world
  (modules, controllers, providers)       (main.ts)
  ───────────────────────────────         ─────────────────
  @Module({...})                          NestFactory.create(AppModule)
  @Controller('users')                →   app.useGlobalPipes(...)
  @Injectable()                           app.enableCors()
                                           app.listen(3000)
```

Understanding `main.ts` deeply matters because it is the *only* place certain configuration can happen correctly — global pipes/filters registered here apply uniformly to the whole app, in a way that per-controller decorators cannot fully replicate (notably, exceptions thrown before a request reaches any controller, such as unhandled 404s, are only caught by a globally-registered filter).

---

## 2. NestFactory.create() and the Bootstrap Lifecycle

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

`NestFactory.create(AppModule)` is an async operation that performs, in order:

```
  1. Instantiate the IoC container
  2. Recursively resolve AppModule's imports
       → for each imported module, resolve its imports, providers, controllers
       → build a full dependency graph (topological, cycle-checked)
  3. Instantiate providers (respecting scope: DEFAULT / REQUEST / TRANSIENT)
  4. Instantiate controllers, injecting resolved providers into constructors
  5. Run lifecycle hooks in this order across the whole graph:
       OnModuleInit → OnApplicationBootstrap
  6. Return an INestApplication instance (NOT yet listening on a port)
  7. app.listen(port) binds the underlying HTTP server and starts accepting
     connections; this is when OnApplicationBootstrap-adjacent hooks like
     BeforeApplicationShutdown become relevant on shutdown
```

The returned `app` object is an `INestApplication` — a small wrapper around the platform's HTTP server (Express or Fastify) plus Nest-specific methods (`useGlobalPipes`, `enableCors`, `setGlobalPrefix`, `listen`, `close`, `get` for pulling providers out of the container, etc.).

Because `NestFactory.create()` is asynchronous and does real, non-trivial work (module resolution, provider instantiation, running `onModuleInit`/`onApplicationBootstrap` hooks across the entire graph), a large or misconfigured module tree is the most common reason a Nest app is slow to start or throws immediately on boot rather than at request time — errors like "Nest can't resolve dependencies of X" are thrown during this step, before `listen()` is ever reached.

You can also create an app with no HTTP server at all, for pure microservice or CLI-style workers:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // ApplicationContext skips the HTTP layer entirely — useful for
  // one-off scripts, cron jobs, or CLI tools that just need the DI container
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const someService = appContext.get(SomeService);
  await someService.runJob();
  await appContext.close();
}
bootstrap();
```

---

## 3. Registering Global Pipes, Filters, and Interceptors

Nest lets you register pipes, filters, guards, and interceptors at three scopes: method (`@UseGuards()` on a handler), controller (`@UseGuards()` on the class), and **global** (in `main.ts`, applied to every route in the application). Bootstrap-time registration is the only way to guarantee something runs for literally every incoming request.

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validates & transforms every incoming request body/query/params
  // against DTO classes decorated with class-validator decorators
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // strip properties not in the DTO
      forbidNonWhitelisted: true, // throw if extra properties are sent
      transform: true,           // auto-convert payloads to DTO instances
    }),
  );

  // Catches every unhandled exception across all controllers
  app.useGlobalFilters(new AllExceptionsFilter());

  // Runs around every request/response — e.g., logging, timing, response mapping
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.listen(3000);
}
bootstrap();
```

There is an important nuance for global *filters* and *interceptors* that need dependency injection (e.g., a filter that injects a logging service from the DI container): instantiating them with `new` in `main.ts` bypasses Nest's DI container entirely. The recommended pattern for DI-aware global providers is to register them from within a module instead, using the `APP_FILTER` / `APP_PIPE` / `APP_INTERCEPTOR` / `APP_GUARD` injection tokens:

```typescript
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
```

This registers the same global scope but lets `AllExceptionsFilter`/`LoggingInterceptor` receive constructor-injected dependencies (e.g., a `LoggerService`) just like any other provider, because Nest's container — not `new` in `main.ts` — is responsible for constructing them.

```
  app.useGlobalPipes(new X())        APP_PIPE token in a module
  ──────────────────────────         ───────────────────────────
  Instantiated with `new`            Instantiated by the DI container
  Cannot inject other providers      Can inject other providers
  Simple, fewer moving parts         Required when X has dependencies
```

---

## 4. Enabling CORS

Cross-Origin Resource Sharing must be explicitly enabled for browser clients on a different origin (different scheme, host, or port) to call your API.

```typescript
const app = await NestFactory.create(AppModule);

// Simplest form — reflects the request's Origin header, allows common methods
app.enableCors();

// Production-realistic configuration
app.enableCors({
  origin: ['https://app.example.com', 'https://admin.example.com'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // allow cookies / Authorization headers to be sent cross-origin
});
```

`origin` also accepts a function for dynamic allow-listing (e.g., checking against a database of registered client domains):

```typescript
app.enableCors({
  origin: (requestOrigin, callback) => {
    const allowed = ['https://app.example.com', 'https://staging.example.com'];
    callback(null, !requestOrigin || allowed.includes(requestOrigin));
  },
});
```

CORS is enforced entirely by the browser reading response headers Nest sets — it does nothing to protect a server-to-server or curl request, so it is not a substitute for authentication/authorization.

---

## 5. Setting a Global Prefix and API Versioning

```typescript
const app = await NestFactory.create(AppModule);

// Every route becomes /api/... instead of /...
app.setGlobalPrefix('api');

// Exclude specific routes from the prefix (e.g., health checks load balancers hit directly)
app.setGlobalPrefix('api', {
  exclude: [{ path: 'health', method: RequestMethod.GET }],
});
```

NestJS also has built-in support for API versioning, commonly combined with a global prefix:

```typescript
import { VersioningType } from '@nestjs/common';

app.setGlobalPrefix('api');
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});
// Routes become /api/v1/... by default; a controller/handler can opt into
// @Controller({ path: 'users', version: '2' }) to serve /api/v2/users
```

---

## 6. The HTTP Adapter Abstraction — Express vs Fastify

NestJS does not implement its own HTTP server. Instead, `@nestjs/platform-express` (the default) and `@nestjs/platform-fastify` wrap Express and Fastify respectively behind a common `HttpAdapter` interface, so controllers, decorators (`@Get`, `@Req`, `@Res`, `@Body`), pipes, guards, and interceptors work identically regardless of which platform is underneath.

```
  Your Controllers / Decorators / Pipes / Guards
                      │
                      ▼
             NestJS HttpAdapter (abstraction)
              /                        \
             ▼                          ▼
  ExpressAdapter                 FastifyAdapter
  (@nestjs/platform-express)     (@nestjs/platform-fastify)
             │                          │
             ▼                          ▼
        Express.js                  Fastify
```

By default, `NestFactory.create(AppModule)` uses Express. Switching to Fastify (commonly done for its lower overhead and higher raw throughput) means installing the Fastify platform package and passing an adapter instance explicitly:

```bash
npm install @nestjs/platform-fastify
```

```typescript
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  await app.listen(3000, '0.0.0.0');
}
bootstrap();
```

The generic type parameter (`NestFactory.create<NestFastifyApplication>`) is what gives you access to Fastify-specific methods (e.g., `app.register()` for Fastify plugins) on the returned `app` object, versus the default `NestExpressApplication` type which exposes Express-specific methods (e.g., `app.set('view engine', 'ejs')`).

```
  Choosing a platform:
  ┌────────────────────────────┬───────────────────────────┐
  │ Express (default)          │ Fastify                    │
  ├────────────────────────────┼───────────────────────────┤
  │ Largest middleware/plugin  │ Smaller ecosystem, but      │
  │ ecosystem                  │ growing fast                │
  │ Most tutorials/StackOverflow│ ~2x raw request throughput │
  │ answers assume Express     │ in most benchmarks          │
  │ Safe default choice        │ Worth it under genuinely    │
  │                            │ high request volume         │
  └────────────────────────────┴───────────────────────────┘
```

A subtlety of the abstraction: code written against `@Req()`/`@Res()` handler decorators receives the *underlying* platform's request/response object (an Express `Request`/`Response` or a Fastify `FastifyRequest`/`FastifyReply`), so directly manipulating `@Res()` ties your handler to one platform. Preferring Nest's own return-value-based responses (just `return someValue;` from a handler) keeps controller code platform-agnostic.

---

## 7. Graceful Shutdown and Lifecycle Hooks

`main.ts` is also where you opt into Nest listening for OS shutdown signals so in-flight requests can drain and `onModuleDestroy`/`beforeApplicationShutdown` hooks run (e.g., closing a database connection pool cleanly):

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks(); // listens for SIGTERM/SIGINT
  await app.listen(3000);
}
bootstrap();
```

Any provider can then implement `OnModuleDestroy`:

```typescript
import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  async onModuleDestroy() {
    // close pools/connections before the process exits
    await this.pool?.end();
  }
}
```

Without `enableShutdownHooks()`, Nest does not listen for termination signals by default, and `onModuleDestroy`/`onApplicationShutdown` hooks will not run when the process receives `SIGTERM` (e.g., from `docker stop` or a Kubernetes pod eviction) — this is a common cause of connection leaks or abrupt request termination in containerized deployments.

---

## 8. Worked Example — A Fully Configured main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Buffer logs until a real logger is configured (useful with custom loggers)
    bufferLogs: true,
  });

  // --- Security & platform hardening ---
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? '*',
    credentials: true,
  });

  // --- Global request pipeline ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // --- Routing conventions ---
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // --- Graceful shutdown ---
  app.enableShutdownHooks();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`Application listening on http://localhost:${port}/api/v1`);
}

bootstrap().catch((err) => {
  // Ensures a rejected bootstrap promise fails loudly (non-zero exit)
  // instead of leaving the process in a half-started state
  // eslint-disable-next-line no-console
  console.error('Fatal error during bootstrap', err);
  process.exit(1);
});
```

This example demonstrates the typical production checklist executed at bootstrap: security headers (`helmet`), CORS, global validation, a global prefix with URI versioning, graceful shutdown, and an explicit `.catch()` on the top-level `bootstrap()` call so startup failures are never silently swallowed.

---

## 9. Common Pitfalls

- **Forgetting `await` on `bootstrap()` or on `NestFactory.create()`.** Both are asynchronous; omitting `await` (or not chaining `.catch()` on the outer call) can let unhandled promise rejections during startup fail silently, especially in older Node versions or in process managers that don't treat unhandled rejections as fatal.
- **Registering DI-dependent filters/interceptors/guards with `new` in `main.ts`.** `app.useGlobalFilters(new MyFilter())` cannot inject other providers — `MyFilter`'s constructor only ever receives what you pass with `new`. Use the `APP_FILTER`/`APP_GUARD`/`APP_INTERCEPTOR`/`APP_PIPE` tokens inside a module when the global provider needs injected dependencies.
- **Enabling CORS with `credentials: true` and `origin: '*'` together.** Browsers reject this combination outright (the CORS spec disallows a wildcard origin alongside credentialed requests) — you must enumerate explicit origins when `credentials: true` is set.
- **Mixing `@Res()` handler responses with Nest's standard response flow.** Once you inject `@Res() res: Response` and call `res.send(...)` yourself, Nest's own response pipeline (including some interceptors) is bypassed for that route unless you explicitly pass `{ passthrough: true }` to `@Res()`.
- **Not calling `enableShutdownHooks()` in containerized environments.** Without it, `SIGTERM` from Docker/Kubernetes kills the process without running `onModuleDestroy` — leading to connection pool leaks and requests being cut mid-flight instead of drained.
- **Assuming `setGlobalPrefix` and `enableVersioning` compose the way you expect without checking route output.** Prefix and version ordering (`/api/v1/...` vs `/v1/api/...`) depends on call order and configuration and is easy to get backwards; always hit an actual route after configuring both to confirm the final path.

---

## 10. Best Practices

- Keep `main.ts` focused on wiring — global pipes, filters, interceptors, CORS, prefix, versioning, and `listen()`. Business logic belongs in modules/services, never in `bootstrap()`.
- Prefer `APP_PIPE`/`APP_FILTER`/`APP_INTERCEPTOR`/`APP_GUARD` tokens over `app.useGlobal*(new X())` as soon as the global provider needs any injected dependency (a logger, a config service, a repository).
- Always attach a `.catch()` to the top-level `bootstrap()` call and exit with a non-zero code on failure, so container orchestrators correctly detect a crashed/failed startup.
- Call `enableShutdownHooks()` in any environment where the process can receive `SIGTERM`/`SIGINT` from an external supervisor — this is effectively every containerized or process-managed deployment.
- Read `PORT` and other bootstrap-time settings from environment variables (ideally via `ConfigService`, covered in the next lesson) rather than hardcoding them, so the same build works across dev/staging/production.
- Choose Fastify only when you have measured or anticipate high throughput requirements; otherwise stick with the default Express adapter for its larger middleware ecosystem and lower cognitive overhead.

---

## 11. Hands-On Exercises

**Exercise 1:** In a scaffolded Nest project, modify `main.ts` to call `app.setGlobalPrefix('api')` and `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`. Restart the server and confirm that the default `GET /` route now only responds at `GET /api/v1`. Add a second controller method with an explicit `@Controller({ path: 'status', version: '2' })` and confirm it responds only at `/api/v2/status`.

**Exercise 2:** Add `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))` to `main.ts`. Create a simple DTO class with `class-validator` decorators (e.g., `@IsString() name: string;`) and a POST route accepting it. Send a request with an extra, undeclared field and confirm the server responds with a 400 error naming the offending property.

**Exercise 3:** Write a global exception filter class and register it two ways: first with `app.useGlobalFilters(new MyFilter())` in `main.ts`, then refactored to use the `APP_FILTER` token inside `AppModule`. Give the filter a constructor-injected dependency (e.g., a simple `LoggerService` provider) and confirm the `new MyFilter()` version throws or silently receives `undefined` for that dependency, while the `APP_FILTER` version correctly receives it.

**Exercise 4:** Install `@nestjs/platform-fastify`, and change `main.ts` to use `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())`. Start the app and confirm existing routes still work unchanged. Then attempt to use an Express-specific method (e.g., `app.set(...)`) and observe the TypeScript compile error, demonstrating how the generic type parameter enforces platform-specific typing.

**Exercise 5:** Add `app.enableShutdownHooks()` to `main.ts` and implement `OnModuleDestroy` on a simple provider that logs `"shutting down"` to the console. Run the app, then send it a `SIGTERM` (e.g., `kill -TERM <pid>` or `Ctrl+C` in a terminal running it directly) and confirm the log line appears before the process exits. Remove `enableShutdownHooks()` and repeat the test to confirm the hook no longer fires.

---

## 12. Interview Q&A

**Q: What exactly happens when you call `NestFactory.create(AppModule)`?**
Answer: It recursively resolves the entire module graph starting from `AppModule` — following every `imports` array, instantiating providers according to their scope (singleton by default), constructing controllers with their dependencies injected, and running `onModuleInit`/`onApplicationBootstrap` lifecycle hooks across every provider in the graph that implements them. It returns an `INestApplication` instance wrapping the underlying HTTP adapter (Express by default), but the server is not yet accepting connections — that only happens once `app.listen(port)` is called separately.

**Q: Why would you register a global pipe using the `APP_PIPE` provider token inside a module instead of calling `app.useGlobalPipes()` in `main.ts`?**
Answer: `app.useGlobalPipes(new MyPipe())` instantiates the pipe with a plain `new` call, completely outside Nest's DI container, so the pipe cannot have any constructor-injected dependencies (like a config service or logger) — those parameters would simply be `undefined`. Registering it via `{ provide: APP_PIPE, useClass: MyPipe }` inside a module's `providers` array lets Nest's container construct the pipe just like any other provider, resolving and injecting its dependencies normally, while still applying it globally to every route in the application.

**Q: How does NestJS support both Express and Fastify under the same controller code?**
Answer: NestJS defines its own `HttpAdapter` abstraction that both `@nestjs/platform-express` and `@nestjs/platform-fastify` implement, translating Nest's routing/middleware concepts into calls against the underlying framework. Controllers, route decorators (`@Get`, `@Post`, etc.), pipes, guards, and interceptors are written entirely against Nest's abstraction and never talk to Express or Fastify directly, so the same controller code runs unmodified on either platform — you only choose the platform by passing (or omitting) a `FastifyAdapter` instance to `NestFactory.create()`. The main place platform-specific code leaks in is when a handler uses `@Req()`/`@Res()` to access the raw request/response object directly, since that object's shape differs between Express and Fastify.

**Q: What is the difference between a global prefix and API versioning in NestJS, and how do they interact?**
Answer: `app.setGlobalPrefix('api')` prepends a fixed static segment (`/api`) to every route in the application, typically used to namespace an API away from other concerns on the same host (like static assets or health checks, which can be excluded via the `exclude` option). `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })` instead inserts a version segment (`/v1`) that individual controllers or handlers can override via `@Controller({ version: '2' })`, allowing multiple versions of the same route to coexist. Combined, they typically produce routes like `/api/v1/users`, with the prefix providing a stable namespace and versioning allowing incremental, non-breaking API evolution underneath it.

**Q: Why is `enableShutdownHooks()` important in a containerized deployment, and what happens without it?**
Answer: Container orchestrators like Docker and Kubernetes terminate processes by sending `SIGTERM` (with a grace period) before `SIGKILL`. `app.enableShutdownHooks()` makes Nest listen for these signals and, on receiving one, invoke `onModuleDestroy`, `beforeApplicationShutdown`, and `onApplicationShutdown` lifecycle hooks across every provider that implements them — giving code like database connection pools or message queue consumers a chance to close cleanly. Without calling it, Nest does not intercept `SIGTERM` at all, so the Node process (and any open connections or in-flight requests) is terminated abruptly by the OS/orchestrator, which can lead to connection leaks, corrupted in-flight writes, or ungraceful client-facing errors during deploys and pod evictions.

**Q: What's the risk of using `@Res()` in a Nest route handler, and how does `passthrough: true` address it?**
Answer: Injecting `@Res() res: Response` gives a handler direct access to the underlying platform's response object, and as soon as you call a method like `res.send()` or `res.json()` on it, Nest considers the response "handled" by your code and skips its own response-processing pipeline for that route (including certain global interceptors that transform return values). This silently breaks features built on Nest's standard flow — like a global response-mapping interceptor — for that one route. Passing `{ passthrough: true }` to `@Res({ passthrough: true })` tells Nest you only want access to the response object for side effects (e.g., setting a cookie or header) while still returning a value normally from the handler, preserving Nest's standard response pipeline.
