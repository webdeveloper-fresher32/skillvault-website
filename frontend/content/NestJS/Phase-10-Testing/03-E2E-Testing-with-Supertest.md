# End-to-End Testing with Supertest — Complete Guide

## Table of Contents
1. [What E2E Tests Cover That Unit Tests Don't](#1-what-e2e-tests-cover-that-unit-tests-dont)
2. [The E2E Setup Pattern — app.init() vs. a Testing Module](#2-the-e2e-setup-pattern--appinit-vs-a-testing-module)
3. [Supertest Basics — Real HTTP Requests](#3-supertest-basics--real-http-requests)
4. [Wiring a Real (or Testcontainers) Database](#4-wiring-a-real-or-testcontainers-database)
5. [Worked Example — Authenticated Endpoint (Login, Then Use the Token)](#5-worked-example--authenticated-endpoint-login-then-use-the-token)
6. [Test Database Cleanup Strategies](#6-test-database-cleanup-strategies)
7. [Structuring an E2E Suite](#7-structuring-an-e2e-suite)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What E2E Tests Cover That Unit Tests Don't

Lessons 1 and 2 tested classes in isolation — a service with a mocked repository, a guard with a fake `ExecutionContext`, a pipe called directly. None of those tests prove the pieces are actually *wired together correctly*: that the guard is attached to the right route, that the validation pipe is bound to the right DTO, that the exception filter turns a thrown error into the right HTTP status code, that middleware runs in the right order, that the module's real dependency graph even compiles.

```
  Unit tests (lessons 1-2)              E2E tests (this lesson)
  ─────────────────────────             ───────────────────────
  new Guard(mockDep)                    app = moduleRef.createNestApplication()
  guard.canActivate(fakeContext)        await app.init()
                                         request(app.getHttpServer())
  ✓ authorization logic is correct        .post('/auth/login')
  ✗ does NOT prove the guard is           .send({ email, password })
    actually attached to a route
                                         ✓ proves the guard, pipe, controller,
                                           service, and (optionally) real DB
                                           are wired together correctly end
                                           to end, exactly as a real client
                                           would experience the API
```

E2E tests trade speed and isolation for confidence: they boot the actual Nest application (or something extremely close to it) and drive it through its real, public HTTP surface. They are slower, and a failure is harder to localize to one exact class — but they are the only test in the pyramid that can catch wiring bugs, and they're the layer that most closely mirrors what a real client of your API actually experiences.

---

## 2. The E2E Setup Pattern — app.init() vs. a Testing Module

The critical difference from lessons 1-2: instead of stopping at `TestingModule` and pulling individual providers out with `.get()`, an e2e test calls `.createNestApplication()` on the compiled module and then `app.init()` — producing a fully bootstrapped Nest application, complete with global pipes, guards, filters, and middleware, listening on an in-memory HTTP server.

```typescript
// test/users.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Replicate any global setup normally done in main.ts, since app.init()
    // does NOT run main.ts — only the module graph and bootstrap lifecycle.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/users (GET) returns 200 and an array', () => {
    return request(app.getHttpServer())
      .get('/users')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });
});
```

A subtlety that trips up many teams: **`app.init()` does not execute `main.ts`.** Anything your real bootstrap does — `app.useGlobalPipes(...)`, `app.useGlobalFilters(...)`, `app.setGlobalPrefix(...)`, CORS setup, Helmet, cookie parsing — must either be duplicated in the e2e test's `beforeAll`, or (the better long-term approach) extracted into a shared `configureApp(app: INestApplication)` function that both `main.ts` and every e2e spec call, so the two never drift out of sync:

```typescript
// src/bootstrap.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';

export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
}
```

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(3000);
}
bootstrap();
```

```typescript
// test/users.e2e-spec.ts (revised beforeAll)
import { configureApp } from '../src/bootstrap';

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.init();
});
```

Nest generates a `test/jest-e2e.json` config in every new project, kept separate from the unit test Jest config so e2e's slower, stateful tests don't run on every file save:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

---

## 3. Supertest Basics — Real HTTP Requests

Supertest wraps the underlying HTTP server object Nest exposes via `app.getHttpServer()` and issues genuine HTTP requests against it — no mocking, no stubbing, real request/response serialization including headers, status codes, and JSON bodies.

```typescript
import * as request from 'supertest';

// GET with query params
await request(app.getHttpServer())
  .get('/users')
  .query({ page: 1, limit: 10 })
  .expect(200);

// POST with a JSON body
const res = await request(app.getHttpServer())
  .post('/users')
  .send({ email: 'new@b.com', name: 'New User' })
  .expect(201);

// Custom headers, e.g. an Authorization bearer token
await request(app.getHttpServer())
  .get('/profile')
  .set('Authorization', `Bearer ${token}`)
  .expect(200);

// Asserting on the response body shape
expect(res.body).toMatchObject({ email: 'new@b.com' });
expect(res.body.id).toEqual(expect.any(Number));

// Asserting a validation failure surfaces the right status and message
await request(app.getHttpServer())
  .post('/users')
  .send({ email: 'not-an-email' })
  .expect(400)
  .expect((r) => {
    expect(r.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('email')]),
    );
  });
```

Because these requests go through the *entire* real pipeline — global `ValidationPipe`, guards, the controller, the service, and (per section 4) potentially a real database — a single e2e test like the last one above is implicitly testing several units at once: DTO validation rules, the global pipe's `whitelist`/`transform` configuration, and the exception filter that turns a validation error into a `400` with Nest's standard error body shape.

---

## 4. Wiring a Real (or Testcontainers) Database

There are two common approaches to the database in e2e tests, in increasing order of realism:

**Approach A — a dedicated test database, same engine as production.** Point `TypeOrmModule.forRoot()` (or your Prisma client) at a `myapp_test` database via environment variables loaded only in the e2e config. This is simple and fast to set up, but the database must already exist and be reachable (e.g., a Postgres container started by `docker-compose` before the test run).

```typescript
// test/setup-e2e.ts — loaded via jest-e2e.json's "setupFiles"
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://test:test@localhost:5433/myapp_test';
```

**Approach B — Testcontainers, spinning up an ephemeral database per test run.** This avoids any dependency on a pre-existing external database and guarantees a pristine schema every run — closer to true isolation, at the cost of slower startup (a container has to boot) and a Docker daemon being available in CI.

```typescript
// test/db-test-utils.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer;

export async function startTestDatabase(): Promise<string> {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('myapp_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  return container.getConnectionUri();
}

export async function stopTestDatabase(): Promise<void> {
  await container?.stop();
}
```

```typescript
// test/users.e2e-spec.ts (using Testcontainers)
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { startTestDatabase, stopTestDatabase } from './db-test-utils';

describe('Users (e2e, Testcontainers)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const connectionUri = await startTestDatabase();
    process.env.DATABASE_URL = connectionUri;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  }, 60_000); // container startup can exceed Jest's default 5s timeout

  afterAll(async () => {
    await app.close();
    await stopTestDatabase();
  });

  it('/users (POST) persists a new user to the real database', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'e2e@test.com', name: 'E2E User' })
      .expect(201);

    expect(res.body.id).toEqual(expect.any(Number));

    const fetched = await request(app.getHttpServer())
      .get(`/users/${res.body.id}`)
      .expect(200);

    expect(fetched.body.email).toBe('e2e@test.com');
  });
});
```

Whichever approach you pick, e2e tests should never point at a shared staging or production database — the whole point of this layer is deterministic, disposable state that tests can freely create, mutate, and destroy.

---

## 5. Worked Example — Authenticated Endpoint (Login, Then Use the Token)

The most realistic and common e2e pattern: log in through the real `/auth/login` endpoint to obtain a genuine JWT (produced by the real `AuthService` and `JwtService`, not a mock), then attach that token to a subsequent request against a protected route.

```typescript
// test/auth-profile.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { UsersService } from '../src/users/users.service';

describe('Auth + Profile (e2e)', () => {
  let app: INestApplication;
  let usersService: UsersService;

  const testUser = {
    email: 'e2e-user@test.com',
    password: 'CorrectHorseBatteryStaple1!',
    name: 'E2E User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    usersService = moduleFixture.get<UsersService>(UsersService);

    // Seed a real user through the real service, hitting the real (test) database.
    await usersService.create(testUser);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects access to /profile without a token', () => {
    return request(app.getHttpServer()).get('/profile').expect(401);
  });

  it('rejects login with the wrong password', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: 'wrong-password' })
      .expect(401);
  });

  it('logs in with correct credentials and returns an access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('uses the token from login to access the protected profile route', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    const { accessToken } = loginRes.body;

    const profileRes = await request(app.getHttpServer())
      .get('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(profileRes.body.email).toBe(testUser.email);
    expect(profileRes.body.password).toBeUndefined(); // never leak the password hash
  });

  it('rejects a malformed or tampered token', () => {
    return request(app.getHttpServer())
      .get('/profile')
      .set('Authorization', 'Bearer not-a-real-jwt')
      .expect(401);
  });
});
```

This suite exercises the real `AuthGuard`, the real `JwtService` signing and verifying with the real secret from test config, the real `AuthService.login()` password comparison against a real (test-database-persisted) bcrypt hash, and the real `ProfileController` reading `request.user` the guard attached — none of which any single unit test from lessons 1-2 could verify together. It also demonstrates a key e2e assertion habit: verifying sensitive fields (`password`) are absent from the response, which is exactly the kind of cross-cutting serialization concern (an `@Exclude()` decorator or `ClassSerializerInterceptor`) that only shows up when you inspect a real, fully-serialized response body.

---

## 6. Test Database Cleanup Strategies

E2E tests that touch a real database need a strategy for returning to a known state between tests — otherwise tests become order-dependent (a later test sees data left behind by an earlier one) and non-repeatable.

### Strategy 1 — Transaction-per-test (rollback)

Wrap each test in a database transaction that begins in a `beforeEach` and is rolled back in `afterEach`, so nothing the test writes is ever actually committed. This is the fastest strategy since there's no data to physically remove, but it requires your application code to run its queries against a per-test transaction/connection rather than opening its own pooled connection per request — which typically means overriding the repository/`DataSource` provider in the testing module to force it onto a single controlled connection for the duration of the test.

```typescript
import { DataSource, QueryRunner } from 'typeorm';

describe('Orders (e2e, transactional)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  beforeEach(async () => {
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
  });

  afterEach(async () => {
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  });

  afterAll(async () => {
    await app.close();
  });

  // tests here write data freely; nothing persists past afterEach
});
```

This strategy is powerful but adds real setup complexity (routing every repository call through the same `queryRunner`), so many teams reserve it for suites with a large number of write-heavy tests where truncation overhead adds up.

### Strategy 2 — Truncate between tests

Simpler to reason about: let each test commit normally, then truncate the relevant tables in `afterEach` (or `beforeEach`) so every test starts from an empty, known state.

```typescript
afterEach(async () => {
  const dataSource = app.get(DataSource);
  const entities = dataSource.entityMetadatas;

  for (const entity of entities) {
    const repository = dataSource.getRepository(entity.name);
    await repository.query(`TRUNCATE TABLE "${entity.tableName}" RESTART IDENTITY CASCADE`);
  }
});
```

`RESTART IDENTITY` resets auto-increment sequences so IDs are predictable across test runs (helpful for assertions like `expect(res.body.id).toBe(1)`), and `CASCADE` truncates dependent rows in foreign-key-linked tables in the same statement.

### Strategy 3 — Fresh schema per test file (or per run)

Drop and recreate the schema (`synchronize: true` against a scratch database, or re-run migrations) once per test *file* in a `beforeAll`/`afterAll`, combined with truncation between individual tests within that file. This is a reasonable middle ground: full isolation at the file boundary, cheap cleanup within it.

```
  Strategy comparison
  ┌───────────────────────┬───────────┬──────────────┬────────────────────┐
  │ Strategy              │ Speed     │ Isolation    │ Setup complexity   │
  ├───────────────────────┼───────────┼──────────────┼────────────────────┤
  │ Transaction rollback  │ Fastest   │ Perfect      │ High (query runner │
  │                       │           │ (per test)   │ must be threaded   │
  │                       │           │              │ through all repos) │
  │ Truncate between      │ Fast      │ Perfect      │ Low                │
  │ tests                 │           │ (per test)   │                    │
  │ Fresh schema per file │ Slower    │ Per file only│ Medium             │
  └───────────────────────┴───────────┴──────────────┴────────────────────┘
```

Truncate-between-tests is the most common default for Nest e2e suites because it needs no changes to production repository/connection code — the truncation runs entirely from the test file using the same `DataSource` the app already has, pulled out of the compiled `TestingModule` with `.get(DataSource)`.

---

## 7. Structuring an E2E Suite

A pattern that scales well across a growing e2e suite: build the `INestApplication` once per test *file* (not per test — that would be prohibitively slow), reuse it across every `it()` in that file, and clean data between tests rather than rebuilding the whole app.

```typescript
describe('Orders (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE "order", "order_item" RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  // grouped by endpoint/scenario
  describe('POST /orders', () => { /* ... */ });
  describe('GET /orders/:id', () => { /* ... */ });
  describe('DELETE /orders/:id', () => { /* ... */ });
});
```

For larger applications, a small `test/utils/` helper module — with functions like `createAuthenticatedRequest(app, user)` that logs in and returns a pre-configured Supertest agent with the `Authorization` header already set — removes a lot of duplication across e2e spec files that all need an authenticated user.

---

## 8. Common Pitfalls

- **Forgetting `app.init()` does not run `main.ts`.** Global pipes, filters, prefixes, and middleware configured only in `main.ts` silently do not apply in e2e tests unless extracted into a shared `configureApp()` function (section 2) called from both places.
- **Rebuilding the `INestApplication` in `beforeEach` instead of `beforeAll`.** Bootstrapping a full Nest app (and possibly a database connection) is expensive; doing it before every single test turns a fast test file into a multi-minute one. Build once per file, clean data between tests instead.
- **Pointing e2e tests at a shared database used by other developers or CI jobs running in parallel.** Concurrent test runs will stomp on each other's data, causing flaky, hard-to-reproduce failures. Use a dedicated database per CI job/worker, or Testcontainers for full per-run isolation.
- **Not increasing the Jest timeout for Testcontainers-backed suites.** Container startup can take several seconds to tens of seconds; Jest's default 5-second timeout will fail `beforeAll` before the container is even ready. Pass an explicit timeout as the second argument to `beforeAll(fn, timeoutMs)`.
- **Truncating tables without `RESTART IDENTITY`.** Auto-increment IDs keep climbing across tests, making assertions on specific ID values (`expect(res.body.id).toBe(1)`) flaky depending on run order; either reset identity sequences or assert on `expect.any(Number)` instead of exact IDs.
- **Never asserting on response body shape, only status codes.** A test that only checks `.expect(200)` misses regressions where the correct status code is returned with a broken, empty, or wrongly-shaped body — always assert on at least the key fields of the response payload for meaningful coverage.
- **Leaking authentication tokens or app instances across test files.** Each e2e spec file should build (and close) its own `INestApplication`; sharing a live app instance across files via a module-level singleton makes tests order-dependent and breaks Jest's ability to run files in parallel workers.

---

## 9. Best Practices

- Extract shared bootstrap logic (`configureApp()`) so `main.ts` and every e2e spec apply identical global pipes, filters, and prefixes — this is the single highest-value fix for e2e/production configuration drift.
- Build the `INestApplication` once per file in `beforeAll`, and use table truncation (or a lighter transaction-rollback strategy for write-heavy suites) in `afterEach` to reset state cheaply between individual tests.
- Prefer seeding test data through real service/repository calls (`usersService.create(...)`) over raw SQL inserts, so the seed itself exercises the same code path (hashing, validation, defaults) production traffic would.
- For authenticated-route suites, build a small `createAuthenticatedRequest(app, credentials)` test helper that performs the real login flow once and returns a Supertest agent pre-configured with the bearer token, to avoid repeating the login boilerplate in every test.
- Use Testcontainers (or docker-compose in CI) for a dedicated, disposable test database rather than ever pointing e2e tests at shared staging/production infrastructure.
- Keep e2e suites focused on cross-cutting wiring and critical user journeys (auth, core CRUD flows, permission boundaries) rather than exhaustively re-testing every validation branch already covered by pipe/service unit tests — that duplication makes the suite slow without adding proportional confidence.
- Run e2e tests in CI on every pull request, but keep them out of the local pre-commit/watch loop — they're a correctness gate, not a rapid-feedback tool for day-to-day development.

---

## 10. Hands-On Exercises

**Exercise 1:** Write an e2e suite for a `POST /users` endpoint using a full `INestApplication` booted via `app.init()`. Cover: successful creation returns `201` with the created user (minus any sensitive fields), duplicate email returns `409`, and invalid email format returns `400` with a validation message mentioning the `email` field.

**Exercise 2:** Extract your app's global `ValidationPipe` and any exception filters into a shared `configureApp()` function used by both `main.ts` and your e2e spec's `beforeAll`. Deliberately misconfigure the e2e spec's inline pipe setup (e.g., omit `whitelist: true`) before the refactor, and show the e2e test result differs from `main.ts`'s real behavior — then show the refactor fixes it.

**Exercise 3:** Write the login-then-protected-route e2e suite from section 5 for your own app's auth flow (or the worked example as given), and add a case where the JWT has expired (mock a very short `expiresIn` in test config, wait past it, or sign a token in the past) to confirm the guard rejects expired tokens with `401`.

**Exercise 4:** Implement truncate-between-tests cleanup for a suite covering `Order` and `OrderItem` entities, including `RESTART IDENTITY CASCADE`. Prove it works by writing two tests that each create an order expecting `id: 1`, and confirm both pass independently of run order.

**Exercise 5:** Set up a Testcontainers-backed Postgres instance for one e2e spec file, wiring the connection string into `TypeOrmModule` before `Test.createTestingModule(...).compile()`. Confirm the suite passes with no external database running on your machine, and measure (via Jest's timing output) how much slower this suite is than an equivalent one using a pre-existing local test database — document the tradeoff in a code comment.

---

## 11. Interview Q&A

**Q: What is the key structural difference between an e2e test and the unit tests from earlier lessons?**
Answer: A unit test resolves a `TestingModule` and pulls individual provider instances out with `.get()`, calling their methods directly with mocked dependencies. An e2e test instead calls `.createNestApplication()` on the compiled module and `await app.init()`, producing a fully bootstrapped, listening Nest application with its real guards, pipes, filters, and middleware wired in exactly as they would be in production. Requests are then made through Supertest against `app.getHttpServer()` as genuine HTTP calls, rather than direct method invocations — this is what lets e2e tests catch wiring bugs (a guard not actually attached to a route, a pipe not bound to the right parameter) that isolated unit tests structurally cannot detect.

**Q: Why doesn't `app.init()` pick up global pipes or filters configured in `main.ts`?**
Answer: `app.init()` only runs the Nest application bootstrap lifecycle for the module graph passed into `Test.createTestingModule()` — it does not execute the `bootstrap()` function in `main.ts` at all, since that file is never imported or run by the test. Anything `main.ts` configures imperatively after `NestFactory.create()` — `app.useGlobalPipes()`, `app.useGlobalFilters()`, `app.setGlobalPrefix()`, CORS, cookie parsing — must be reapplied in the test's own setup. The robust fix is extracting that configuration into a shared function (e.g., `configureApp(app)`) called identically from both `main.ts` and every e2e spec's `beforeAll`, so the two can never silently drift apart.

**Q: How does Supertest actually issue requests against a Nest application in tests, without a real network port?**
Answer: Supertest wraps the underlying HTTP server instance Nest exposes via `app.getHttpServer()` (an Express or Fastify server) and drives it directly at the Node HTTP layer, without needing the server to actually bind to a TCP port. This produces a real, complete HTTP request/response cycle — real header parsing, real body serialization, real status codes — running entirely in-process, which is both fully realistic and fast since there's no real network round-trip involved.

**Q: What's the tradeoff between transaction-rollback and truncate-between-tests as database cleanup strategies?**
Answer: Transaction-rollback wraps each test in a database transaction that's rolled back afterward, so nothing is ever actually committed — this is the fastest option since there's no physical data removal, but it requires routing every repository/query call in the code under test through the same controlled connection/query runner for the duration of the test, which adds real setup complexity to application code that wasn't written with that in mind. Truncate-between-tests lets each test commit normally and then wipes the relevant tables afterward — slightly slower since data is actually written and removed, but requires no changes to how the application code obtains its database connection, making it the simpler default for most Nest e2e suites.

**Q: Why seed test data by calling the real service (e.g., `usersService.create(...)`) instead of inserting rows directly via SQL?**
Answer: Seeding through the real service exercises the same code path production traffic uses — password hashing, default value assignment, validation, and any side effects the service triggers — so the seeded data is guaranteed to be in the exact shape and state real application logic produces. Raw SQL inserts bypass all of that, which risks seeding data that doesn't actually reflect what the application would ever create (e.g., a plaintext password where the service would have hashed it), silently invalidating any test that depends on that invariant, such as a login test that expects to compare against a bcrypt hash.

**Q: In the authenticated-endpoint worked example, why does the test log in via `/auth/login` rather than just mocking a JWT and setting it directly on the request?**
Answer: Logging in through the real endpoint exercises the entire authentication chain end-to-end — the real password comparison against a real stored hash, the real `JwtService` signing a token with the real secret and expiry configured for the test environment, and the real `AuthGuard` verifying that exact token format on the subsequent request. Fabricating a token directly (e.g., signing one by hand with a guessed secret, or bypassing the guard) would only prove the protected route's handler logic works, not that the actual login-to-access-token-to-authorized-request journey a real client experiences functions correctly — which is precisely the class of bug e2e tests exist to catch.
