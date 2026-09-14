# Logging & Observability — Complete Guide

## Table of Contents
1. [Why the Default Logger Isn't Enough](#1-why-the-default-logger-isnt-enough)
2. [Nest's Built-In Logger](#2-nests-built-in-logger)
3. [Structured JSON Logging with Pino](#3-structured-json-logging-with-pino)
4. [Request-Scoped Logging Context](#4-request-scoped-logging-context)
5. [Winston as an Alternative](#5-winston-as-an-alternative)
6. [Health Checks with @nestjs/terminus](#6-health-checks-with-nestjsterminus)
7. [Worked Example — Full /health Endpoint](#7-worked-example--full-health-endpoint)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Why the Default Logger Isn't Enough

In development, `console.log`-style output is fine — a human is watching the terminal. In production, nobody is watching a terminal. Logs get shipped to a log aggregator (CloudWatch, Datadog, Loki, Elasticsearch) where they are searched, filtered, and alerted on programmatically. That requires two things Nest's default logger does not give you out of the box: **structured (JSON) output** and **consistent per-request correlation** so you can pull every log line belonging to one request out of a firehose of concurrent traffic.

```
  Development                          Production
  ┌───────────────────────┐            ┌───────────────────────────────────┐
  │ [Nest] 12345  - LOG   │            │ {"level":30,"time":169..,         │
  │ [UsersService] Found  │   ───▶     │  "context":"UsersService",         │
  │ user 42               │            │  "reqId":"a1b2c3","msg":"Found... │
  └───────────────────────┘            └───────────────────────────────────┘
   Human reads it directly              Machine parses it: alert, dashboard,
                                        trace a single request across services
```

The default `Logger` writes plain-text lines to stdout with colors and timestamps meant for a human eyeball. There is no built-in way to attach a request ID to every line emitted while handling that request, and no built-in JSON transport. Both are essential once you have more than one instance of your service running behind a load balancer — plain text logs from N pods interleaved in a dashboard are close to useless without structure.

---

## 2. Nest's Built-In Logger

Nest ships with a `Logger` class (`@nestjs/common`) that is perfectly fine for local development and even acceptable in production if you pair it with a JSON-aware transport. It supports the standard log levels — `log`, `error`, `warn`, `debug`, `verbose` — and can be scoped to a context string (typically the class name) for readability.

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  async createOrder(userId: string, total: number) {
    this.logger.log(`Creating order for user ${userId}, total=${total}`);
    try {
      // ... persistence logic
      this.logger.log(`Order created successfully for user ${userId}`);
    } catch (err) {
      this.logger.error(
        `Failed to create order for user ${userId}: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }
}
```

You can globally replace Nest's logger implementation at bootstrap while keeping the same `Logger` API surface, via `app.useLogger()`:

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // buffer logs until a custom logger is attached
  });

  app.useLogger(app.get(Logger)); // swap in a custom Logger provider, see section 3
  await app.listen(3000);
}
bootstrap();
```

`bufferLogs: true` matters: without it, any log statements emitted by modules during application bootstrap (before your custom logger is wired up) are lost or fall back to the console. Buffering holds them until `useLogger()` runs, then flushes them through the real logger.

The built-in Logger is a reasonable stopgap, but it write synchronously to stdout with a formatting function tuned for readability, not for machine parsing or high-throughput logging. For anything serving real traffic, replace it with a dedicated logging library.

---

## 3. Structured JSON Logging with Pino

[Pino](https://getpino.io/) is one of the fastest Node.js loggers available, and `nestjs-pino` wires it into Nest's DI system while keeping the familiar `Logger` interface. Pino logs JSON by default — ideal for log aggregators — and supports "pretty printing" only in development via a separate transport.

```bash
npm install nestjs-pino pino-http pino-pretty
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined // raw JSON in production
            : { target: 'pino-pretty', options: { colorize: true } },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),
        customProps: (req) => ({
          userId: (req as any).user?.id ?? 'anonymous',
        }),
      },
    }),
  ],
})
export class AppModule {}
```

`redact` strips sensitive headers before they ever hit disk — a mandatory control if you log authorization headers or cookies. `genReqId` assigns a correlation ID per incoming request (reusing an upstream `x-request-id` if present, generating a UUID otherwise), and `customProps` attaches arbitrary fields — like the authenticated user ID once a guard has populated `req.user` — to every log line for that request.

Swap the `Logger` bootstrap for the Pino-backed one:

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.listen(3000);
}
bootstrap();
```

Inject `PinoLogger` (or plain `Logger` from `@nestjs/common`, which `nestjs-pino` transparently backs) into any provider exactly as before:

```typescript
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class PaymentsService {
  constructor(@InjectPinoLogger(PaymentsService.name) private readonly logger: PinoLogger) {}

  async charge(orderId: string, amountCents: number) {
    this.logger.info({ orderId, amountCents }, 'Charging order');
    // ...
  }
}
```

Passing an object as the first argument (`{ orderId, amountCents }`) merges those fields directly into the JSON log line rather than interpolating them into a message string — this is the structured-logging idiom: fields you'll want to filter or aggregate on belong in the object, not baked into text.

---

## 4. Request-Scoped Logging Context

`pino-http` (used internally by `nestjs-pino`) automatically attaches a per-request child logger to `req.log`, and every log call made through the injected `PinoLogger` during that request's lifecycle is automatically enriched with the request ID set by `genReqId`. This is what makes it possible to grep a log aggregator for `reqId:"a1b2c3"` and see every line — across every service and provider touched — for that single request.

```
  Incoming request ──▶ pino-http assigns reqId=a1b2c3
        │
        ▼
  Controller.handler() ──▶ logger.info(...)      { reqId: "a1b2c3", msg: "..." }
        │
        ▼
  OrdersService.create() ──▶ logger.info(...)    { reqId: "a1b2c3", msg: "..." }
        │
        ▼
  PaymentsService.charge() ──▶ logger.error(...)  { reqId: "a1b2c3", msg: "..." }

  All three lines share reqId — trivially correlated in Kibana/Datadog/Loki
```

For cases where you need custom per-request context beyond what `pino-http` gives you automatically — for example propagating a tenant ID through several layers without threading it as a function argument — combine `nestjs-pino` with Node's `AsyncLocalStorage`, exposed conveniently via `nestjs-cls` (Continuation Local Storage):

```typescript
import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ClsModule.forRoot({
      middleware: { mount: true, generateId: true },
    }),
    LoggerModule.forRootAsync({
      inject: [], // ClsService is available via DI once mounted
      useFactory: () => ({
        pinoHttp: { level: 'info' },
      }),
    }),
  ],
})
export class AppModule {}
```

```typescript
import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class TenantContextInterceptor {
  constructor(private readonly cls: ClsService) {}

  setTenant(tenantId: string) {
    this.cls.set('tenantId', tenantId);
  }

  getTenant(): string | undefined {
    return this.cls.get('tenantId');
  }
}
```

Any provider deep in the call graph can then call `cls.get('tenantId')` without the value being passed explicitly through every intermediate function — the same mechanism that underlies request-scoped providers, but without the DI performance cost of `Scope.REQUEST` (see Phase 04).

---

## 5. Winston as an Alternative

Winston is the older, more configurable — and correspondingly more verbose — Node logging library. `nest-winston` wires it into Nest the same way `nestjs-pino` wires in Pino. Reach for Winston when you need transports Pino doesn't support well out of the box (e.g. shipping directly to a specific vendor's API, or multiple simultaneous file/console/HTTP transports with different formats each).

```bash
npm install nest-winston winston
```

```typescript
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

export const winstonLogger = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
});
```

```typescript
// main.ts
const app = await NestFactory.create(AppModule, { logger: winstonLogger });
```

For most greenfield Nest projects, Pino is the better default: it is measurably faster (Pino's benchmarks routinely show 5-10x the throughput of Winston under load because it avoids synchronous string formatting on the hot path) and its API surface is smaller. Choose Winston primarily when your organization has existing Winston transports/infrastructure you must integrate with, or you need a log format Pino's ecosystem doesn't cover.

---

## 6. Health Checks with @nestjs/terminus

An orchestrator (Kubernetes, ECS, a load balancer) needs a machine-readable answer to "is this instance healthy?" so it knows when to route traffic to a pod and when to restart or evict one that's stuck. `@nestjs/terminus` provides a `HealthCheckService` plus a library of built-in indicators for common dependencies (database, disk, memory, HTTP pings) and a pattern for writing custom indicators.

```bash
npm install @nestjs/terminus @nestjs/axios
```

```typescript
// health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

### Built-in indicators

| Indicator | Package | Checks |
|-----------|---------|--------|
| `TypeOrmHealthIndicator` | `@nestjs/terminus` | Can the app run a query against the configured TypeORM connection |
| `MemoryHealthIndicator` | `@nestjs/terminus` | Heap / RSS memory usage under a configured ceiling |
| `DiskHealthIndicator` | `@nestjs/terminus` | Disk usage under a configured threshold |
| `HttpHealthIndicator` | `@nestjs/terminus` | An HTTP dependency (e.g. a downstream service) responds successfully |
| `MicroserviceHealthIndicator` | `@nestjs/terminus` | A microservice transporter (Redis, RabbitMQ) is reachable |

A distinction that matters in Kubernetes terms: a **liveness** check answers "is this process alive, or should it be killed and restarted?" (memory checks, deadlock detection) — a false positive here causes unnecessary restarts, so keep liveness checks cheap and dependency-free. A **readiness** check answers "can this instance currently serve traffic?" (database reachable, downstream dependencies up) — this is allowed to fail transiently (e.g. during a deploy while migrations run) without the pod being killed, just temporarily removed from the load balancer's rotation.

---

## 7. Worked Example — Full /health Endpoint

### Custom indicator

A custom indicator extends `HealthIndicator` and implements whatever check is specific to your application — here, verifying a critical external payment gateway is reachable.

```typescript
// health/payment-gateway.health.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PaymentGatewayHealthIndicator extends HealthIndicator {
  constructor(private readonly http: HttpService) {
    super();
  }

  async check(key: string): Promise<HealthIndicatorResult> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${process.env.PAYMENT_GATEWAY_URL}/ping`, { timeout: 2000 }),
      );
      const isHealthy = response.status === 200;
      const result = this.getStatus(key, isHealthy);

      if (!isHealthy) {
        throw new HealthCheckError('Payment gateway check failed', result);
      }
      return result;
    } catch (err) {
      throw new HealthCheckError(
        'Payment gateway check failed',
        this.getStatus(key, false, { message: err.message }),
      );
    }
  }
}
```

### Health controller combining database, memory, disk, and the custom indicator

```typescript
// health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheck,
} from '@nestjs/terminus';
import { PaymentGatewayHealthIndicator } from './payment-gateway.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly paymentGateway: PaymentGatewayHealthIndicator,
  ) {}

  // Liveness: cheap, no external dependencies — "is the process alive?"
  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB ceiling
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024), // 500MB ceiling
    ]);
  }

  // Readiness: dependency-aware — "can this instance serve traffic right now?"
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1500 }),
      () => this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 }),
      () => this.paymentGateway.check('payment_gateway'),
    ]);
  }

  // Combined view, useful for a dashboard or manual curl
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1500 }),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }
}
```

```typescript
// health/health.module.ts (final, wiring in the custom indicator)
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { PaymentGatewayHealthIndicator } from './payment-gateway.health';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [PaymentGatewayHealthIndicator],
})
export class HealthModule {}
```

A successful call to `GET /health/ready` returns:

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "disk": { "status": "up" },
    "payment_gateway": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "disk": { "status": "up" },
    "payment_gateway": { "status": "up" }
  }
}
```

If any check fails, Terminus automatically returns HTTP `503 Service Unavailable` with the failing indicator under `error` — exactly the signal a Kubernetes readiness probe or a load balancer health check is designed to react to.

```yaml
# excerpt of a Kubernetes Deployment spec using these two endpoints
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 15
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## 8. Common Pitfalls

- **Logging secrets or PII.** Logging full request bodies, authorization headers, or credit card numbers is a compliance and security incident waiting to happen. Always configure `redact` (Pino) or an equivalent formatter (Winston) before shipping to production.
- **Using one endpoint for both liveness and readiness.** If your liveness probe checks the database and the database has a transient blip, Kubernetes restarts a perfectly healthy process — solving nothing and potentially causing a restart storm. Keep liveness dependency-free.
- **Forgetting `bufferLogs: true`.** Without it, logs emitted during module initialization (before `app.useLogger()` runs) go to the raw console instead of your structured logger, creating a gap in otherwise-structured output.
- **Blocking the event loop with synchronous logging.** The default `console.log` and naive file-append loggers are synchronous I/O; under load this measurably slows request handling. Pino's default transport is asynchronous for exactly this reason — don't undo that by adding a synchronous custom transport.
- **No request correlation ID.** Without a `reqId` (or equivalent) attached to every log line, debugging a production incident means grep-ing timestamps across log lines and guessing which belong together — nearly impossible under real concurrency.
- **Health checks that are too permissive.** A `/health` that always returns `200 OK` regardless of database state defeats the entire purpose — it will happily route traffic to an instance that cannot actually serve requests.
- **Not setting timeouts on health check indicators.** An indicator that hangs waiting on a slow downstream dependency can make the health endpoint itself time out, which orchestrators typically also treat as unhealthy — always bound each check (`{ timeout: 1500 }`).

---

## 9. Best Practices

- Default to JSON structured logging (Pino) in every environment except local development, where pretty-printing is a legitimate developer-experience override — but keep the underlying fields identical so parsing logic doesn't diverge between environments.
- Attach a request ID at the edge (accept an incoming `x-request-id` header if present, generate one if not) and propagate it through every downstream call, including to other microservices, so a single trace can be reconstructed end-to-end.
- Separate liveness (process health) from readiness (dependency health) as two distinct endpoints, and wire your orchestrator's probes accordingly.
- Keep custom health indicators fast and bounded with explicit timeouts — a health check is on the hot path of your uptime, not a place for a slow diagnostic query.
- Log at `info` for business events worth alerting on or auditing, `debug` for verbose diagnostic detail (disabled in production by default), and `error` only for genuine failures — not for expected control flow like a 404 from a bad lookup.
- Centralize logger configuration in one module (`LoggerModule.forRoot(...)`) rather than instantiating ad hoc loggers per file, so redaction rules and correlation IDs apply consistently everywhere.
- Version your `/health` response shape and treat it as a contract — orchestrators, dashboards, and on-call runbooks come to depend on its exact fields.

---

## 10. Hands-On Exercises

**Exercise 1:** Add `nestjs-pino` to an existing Nest project. Configure `pinoHttp.redact` to strip the `authorization` header and confirm (by making an authenticated request and inspecting stdout) that the header value is replaced with `[Redacted]` rather than logged in plaintext.

**Exercise 2:** Configure `genReqId` to reuse an incoming `x-request-id` header when present, and generate a UUID otherwise. Make two requests — one with the header set, one without — and confirm in the logs that the first request's ID matches what you sent, and the second gets a freshly generated UUID.

**Exercise 3:** Install `@nestjs/terminus` and build a `/health/ready` endpoint checking a TypeORM connection and memory heap usage. Temporarily stop your database container and confirm the endpoint returns HTTP 503 with the `database` indicator reporting `down`; restart the database and confirm it returns to `200 OK`.

**Exercise 4:** Write a custom health indicator that checks whether a required environment variable (e.g. `JWT_SECRET`) is set and non-empty, throwing a `HealthCheckError` if missing. Wire it into the health check array and verify the behavior by unsetting the variable and restarting the app.

**Exercise 5:** Using `nestjs-cls` (or a request-scoped provider from Phase 04), thread a `tenantId` value set in a middleware through two layers of service calls, and confirm every log line emitted for that request — regardless of which service emitted it — carries the same `tenantId` field in its JSON output.

---

## 11. Interview Q&A

**Q: Why would a production NestJS application replace the built-in Logger with Pino or Winston?**
Answer: The built-in `Logger` is designed for human-readable console output during development — it lacks structured JSON output and per-request correlation, both of which are essential once logs are shipped to an aggregator and searched programmatically rather than read directly. Pino in particular is also significantly faster under load because it avoids synchronous string formatting on the request hot path. `nestjs-pino` and `nest-winston` both preserve Nest's `Logger` API surface via DI, so the swap doesn't require rewriting call sites — just the bootstrap configuration.

**Q: What is the difference between a liveness probe and a readiness probe, and why does it matter for health check design?**
Answer: A liveness probe answers "is this process alive, or should it be restarted?" — it should be cheap and dependency-free, because a failure triggers a restart, and restarting a process whose only problem is a transient downstream outage solves nothing. A readiness probe answers "can this instance serve traffic right now?" — it's allowed to check dependencies like the database, because a failure here just temporarily removes the pod from the load balancer's rotation without killing it. Conflating the two — e.g. checking the database in a liveness probe — causes restart storms when a dependency has a brief blip.

**Q: How does @nestjs/terminus structure a health check, and what does a failing indicator return?**
Answer: `HealthCheckService.check()` takes an array of indicator functions, each returning a `HealthIndicatorResult` (a status keyed by indicator name). Built-in indicators like `TypeOrmHealthIndicator`, `MemoryHealthIndicator`, and `DiskHealthIndicator` cover common cases; custom indicators extend `HealthIndicator` and throw a `HealthCheckError` on failure. If any indicator in the array fails, Terminus automatically returns HTTP 503 with the failing indicator(s) surfaced under an `error` key in the response body, while successful indicators appear under `info` — this is the exact signal orchestrators and load balancers are built to react to.

**Q: What is request-scoped logging context and how do you implement it without Scope.REQUEST providers?**
Answer: Request-scoped logging context means every log line emitted while handling a given request carries a shared identifier (and optionally other contextual fields like tenant ID) without that value being threaded explicitly through every function call. `pino-http` does this automatically for the request ID via `genReqId`. For custom fields, `nestjs-cls` wraps Node's `AsyncLocalStorage` to provide the same effect without the DI overhead of `Scope.REQUEST` providers, which force Nest to build a new instance of the entire provider subtree per request — a meaningful performance cost at scale that CLS avoids.

**Q: What are the risks of naive production logging, and how do you mitigate them?**
Answer: The two biggest risks are leaking sensitive data (auth headers, PII, payment details) into logs that may be retained for months and accessed by a wider audience than the original request, and blocking the event loop with synchronous I/O under high log volume. Mitigate the first with explicit redaction rules (Pino's `redact` option or an equivalent Winston formatter) applied centrally rather than per call site, and the second by using a logger whose default transport is asynchronous (Pino's default) rather than a synchronous `fs.appendFileSync`-style approach.

**Q: Why keep custom health indicators fast and bounded with explicit timeouts?**
Answer: A health endpoint sits on the hot path of your uptime signal — orchestrators poll it frequently and often have their own timeout after which they treat a slow response as a failure anyway. An indicator that blocks on a slow or hung downstream dependency can make the entire health endpoint appear unhealthy even though the core application is fine, and can also tie up event loop resources under repeated polling. Bounding every check with an explicit timeout (e.g. `{ timeout: 1500 }` on a database ping) ensures a slow dependency degrades to a clear "down" status rather than an ambiguous hang.
