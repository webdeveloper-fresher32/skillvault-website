# Testing Controllers, Guards, and Pipes — Complete Guide

## Table of Contents
1. [Where These Fit in the Testing Pyramid](#1-where-these-fit-in-the-testing-pyramid)
2. [Testing Controllers by Mocking the Service Layer](#2-testing-controllers-by-mocking-the-service-layer)
3. [Constructing a Fake ExecutionContext](#3-constructing-a-fake-executioncontext)
4. [Testing Guards in Isolation](#4-testing-guards-in-isolation)
5. [Testing Pipes Directly](#5-testing-pipes-directly)
6. [Worked Example — Custom Guard](#6-worked-example--custom-guard)
7. [Worked Example — Custom Pipe](#7-worked-example--custom-pipe)
8. [Testing Reflector-Based Metadata (Roles, Decorators)](#8-testing-reflector-based-metadata-roles-decorators)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Where These Fit in the Testing Pyramid

Controllers, guards, and pipes all sit on the request pipeline, but none of them require an actual running HTTP server to test. Each is a plain class with a well-defined method Nest calls at a specific point in the pipeline — `handle()` on the controller method itself, `canActivate()` on a guard, `transform()` on a pipe. Because Nest calls these methods with plain objects (an `ExecutionContext`, an `ArgumentMetadata`, a value), you can call them the same way yourself in a test, without touching Express/Fastify, sockets, or serialization.

```
  Request Pipeline (what runs on every real HTTP request)
  ┌──────────┐   ┌───────┐   ┌──────────────┐   ┌──────┐   ┌────────────┐
  │ Middleware│─▶│ Guards│─▶│    Pipes     │─▶│Handler│─▶│Interceptors│
  └──────────┘   └───────┘   └──────────────┘   └──────┘   └────────────┘
                     ▲              ▲               ▲
                     │              │               │
              canActivate()   transform()    controller method
              (unit-testable) (unit-testable)  (unit-testable with
                                                 mocked service)
```

This lesson stays entirely at the unit level: no `app.init()`, no Supertest, no real HTTP request/response cycle. That's covered in lesson 3. The payoff of testing at this level is speed and precision — a guard test that constructs a fake `ExecutionContext` runs in milliseconds and pinpoints exactly which authorization rule is broken, without the noise of routing, serialization, or database state that an e2e test would carry.

---

## 2. Testing Controllers by Mocking the Service Layer

A well-designed Nest controller is thin: it accepts a request, delegates immediately to a service, and shapes the response. Because controllers are Nest providers themselves, they go through `Test.createTestingModule()` exactly like a service — the only dependency worth mocking is the service layer underneath.

```typescript
// src/users/users.controller.ts
import { Controller, Get, Post, Body, Param, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
```

```typescript
// src/users/users.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: { findById: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  it('returns the user the service resolves', async () => {
    const user = { id: 1, email: 'a@b.com' };
    service.findById.mockResolvedValue(user);

    const result = await controller.findOne(1);

    expect(result).toEqual(user);
    expect(service.findById).toHaveBeenCalledWith(1);
  });

  it('propagates NotFoundException thrown by the service', async () => {
    service.findById.mockRejectedValue(new NotFoundException());

    await expect(controller.findOne(99)).rejects.toThrow(NotFoundException);
  });

  it('delegates creation to the service with the DTO', async () => {
    const dto = { email: 'new@b.com', name: 'New' };
    const created = { id: 2, ...dto };
    service.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });
});
```

Two things worth calling out. First, `controller.findOne(1)` calls the method directly with a plain `number` — the test never invokes `ParseIntPipe`, because pipes are middleware for *how a value arrives at the parameter*, not part of the method body. Testing that a string route param gets parsed into a number is a pipe concern (section 5) or an e2e concern (lesson 3), not a controller-unit-test concern. Second, this test module lists `UsersController` under `controllers`, not `providers` — Nest's testing module builder accepts controllers exactly as `@Module()` does, and resolves their constructor dependencies against the `providers` array the same way.

---

## 3. Constructing a Fake ExecutionContext

Guards, interceptors, and custom param decorators all receive an `ExecutionContext` — Nest's abstraction over "the current request, regardless of transport." In a real HTTP request it wraps the underlying Express/Fastify `Request`/`Response`; in a test, you construct a minimal object satisfying the same interface so `canActivate()` can call `context.switchToHttp().getRequest()` exactly as it would in production.

```typescript
import { ExecutionContext } from '@nestjs/common';

function createMockExecutionContext(overrides: {
  user?: any;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  handler?: Function;
  classRef?: Function;
} = {}): ExecutionContext {
  const request = {
    user: overrides.user,
    headers: overrides.headers ?? {},
    params: overrides.params ?? {},
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => jest.fn(),
    }),
    getHandler: () => overrides.handler ?? jest.fn(),
    getClass: () => overrides.classRef ?? jest.fn(),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({ getData: () => ({}), getContext: () => ({}) }),
    switchToWs: () => ({ getData: () => ({}), getClient: () => ({}) }),
    getType: () => 'http',
  } as unknown as ExecutionContext;
}
```

You do not need to implement every method of `ExecutionContext` with production-faithful behavior — only the parts your guard/pipe/interceptor under test actually calls. Most HTTP-only guards only ever call `context.switchToHttp().getRequest()` and, if they read decorator metadata, `context.getHandler()`/`context.getClass()`. The `as unknown as ExecutionContext` cast is standard here: you're deliberately building a partial fake and telling TypeScript to trust that it's good enough for this test's purposes.

```
  Real ExecutionContext (HTTP)              Fake ExecutionContext (test)
  ┌────────────────────────────┐            ┌────────────────────────────┐
  │ switchToHttp()             │            │ switchToHttp()             │
  │   getRequest() → Express   │            │   getRequest() → plain obj │
  │     Request (real headers, │            │     { user, headers,      │
  │     real socket, etc.)     │            │       params }            │
  │ getHandler() → route fn    │            │ getHandler() → jest.fn()  │
  │ getClass() → controller    │            │   or the real handler ref │
  │   class ref                │            │   (for Reflector tests)   │
  └────────────────────────────┘            └────────────────────────────┘
```

---

## 4. Testing Guards in Isolation

A guard implements `CanActivate` and returns (or resolves to) a boolean, or throws. Testing it in isolation means instantiating the guard directly — with `new`, or via `Test.createTestingModule()` if it has injected dependencies — and calling `canActivate()` with a fake `ExecutionContext`.

```typescript
// src/auth/guards/auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
```

```typescript
// src/auth/guards/auth.guard.spec.ts
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: { verifyAsync: jest.Mock };

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    guard = new AuthGuard(jwtService as unknown as JwtService);
  });

  const buildContext = (headers: Record<string, string>) => {
    const request: any = { headers };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;
  };

  it('throws UnauthorizedException when no Authorization header is present', async () => {
    const context = buildContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the header is not a Bearer token', async () => {
    const context = buildContext({ authorization: 'Basic abc123' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when jwtService rejects the token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
    const context = buildContext({ authorization: 'Bearer bad.token.here' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('allows the request and attaches the decoded user on a valid token', async () => {
    const payload = { sub: 1, email: 'a@b.com' };
    jwtService.verifyAsync.mockResolvedValue(payload);
    const request: any = { headers: { authorization: 'Bearer good.token.here' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual(payload);
  });
});
```

Notice the last test asserts a *side effect* — `request.user` being populated — not just the boolean return value. Guards commonly attach data (`request.user`, `request.tenantId`) that later handlers depend on, so a guard test that only checks the return value misses half the contract.

---

## 5. Testing Pipes Directly

A pipe implements `PipeTransform` with a single `transform(value, metadata)` method. Because it's a pure(ish) function of its input, it's the simplest thing in the whole pipeline to unit test — no `ExecutionContext` needed at all, just the value and an `ArgumentMetadata` object describing where the value came from.

```typescript
import { ArgumentMetadata } from '@nestjs/common';

const metadata: ArgumentMetadata = {
  type: 'param',       // 'body' | 'query' | 'param' | 'custom'
  metatype: Number,
  data: 'id',
};
```

Most tests only need `type` and `metatype` filled in when the pipe's logic branches on them; a loosely-typed literal is usually enough.

---

## 6. Worked Example — Custom Guard

A `RolesGuard` that reads required roles off a custom `@Roles()` decorator via `Reflector`, and compares them against `request.user.roles`:

```typescript
// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// src/auth/guards/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // route has no @Roles() restriction
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.roles) {
      return false;
    }

    return requiredRoles.some((role) => user.roles.includes(role));
  }
}
```

```typescript
// src/auth/guards/roles.guard.spec.ts
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  const buildContext = (user?: any) => {
    const request = { user };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as any;
  };

  it('allows access when the route declares no required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = guard.canActivate(buildContext({ roles: ['user'] }));

    expect(result).toBe(true);
  });

  it('denies access when the user has none of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    const result = guard.canActivate(buildContext({ roles: ['user'] }));

    expect(result).toBe(false);
  });

  it('allows access when the user has a matching role', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'moderator']);

    const result = guard.canActivate(buildContext({ roles: ['moderator'] }));

    expect(result).toBe(true);
  });

  it('denies access when the request has no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    const result = guard.canActivate(buildContext(undefined));

    expect(result).toBe(false);
  });

  it('reads roles metadata from both the handler and the class', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const handler = () => {};
    const classRef = class {};
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { roles: ['admin'] } }) }),
      getHandler: () => handler,
      getClass: () => classRef,
    } as any;

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith('roles', [handler, classRef]);
  });
});
```

Mocking `Reflector` rather than constructing a real one keeps this test independent of `reflect-metadata`'s global state and lets you assert precisely which metadata keys and targets the guard queries — a common source of subtle bugs when `@SetMetadata` decorators are applied to a controller class versus an individual handler method.

---

## 7. Worked Example — Custom Pipe

A `ParseObjectIdPipe` that validates and transforms a MongoDB-style ObjectId string route parameter, throwing a `BadRequestException` on malformed input:

```typescript
// src/common/pipes/parse-object-id.pipe.ts
import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!OBJECT_ID_REGEX.test(value)) {
      throw new BadRequestException(
        `${metadata.data ?? 'value'} must be a valid ObjectId, got "${value}"`,
      );
    }
    return value;
  }
}
```

```typescript
// src/common/pipes/parse-object-id.pipe.spec.ts
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ParseObjectIdPipe } from './parse-object-id.pipe';

describe('ParseObjectIdPipe', () => {
  let pipe: ParseObjectIdPipe;

  beforeEach(() => {
    pipe = new ParseObjectIdPipe();
  });

  const metadata: ArgumentMetadata = { type: 'param', data: 'id', metatype: String };

  it('returns the value unchanged when it is a valid ObjectId', () => {
    const validId = '507f1f77bcf86cd799439011';

    expect(pipe.transform(validId, metadata)).toBe(validId);
  });

  it('throws BadRequestException for a string that is too short', () => {
    expect(() => pipe.transform('abc123', metadata)).toThrow(BadRequestException);
  });

  it('throws BadRequestException for a string with invalid characters', () => {
    expect(() => pipe.transform('zzzzzzzzzzzzzzzzzzzzzzzz', metadata)).toThrow(
      BadRequestException,
    );
  });

  it('includes the parameter name from metadata in the error message', () => {
    try {
      pipe.transform('not-an-id', { type: 'param', data: 'userId', metatype: String });
      fail('expected transform to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toContain('userId');
    }
  });
});
```

No `ExecutionContext`, no `Test.createTestingModule()`, not even a mocked dependency — `ParseObjectIdPipe` has none. This is the cheapest test in the whole pipeline to write and the fastest to run, which is exactly why validation logic belongs in a pipe rather than scattered across controller method bodies: it becomes trivially testable in complete isolation.

---

## 8. Testing Reflector-Based Metadata (Roles, Decorators)

When a guard or interceptor reads custom metadata set via `@SetMetadata()` (or a decorator built on top of it, like `@Roles()`), you have two valid testing strategies:

1. **Mock `Reflector` entirely** (as in section 6) — fast, and precisely asserts which key and targets were queried, at the cost of not exercising the real `reflect-metadata` machinery.
2. **Use a real `Reflector` with a real decorated class** — closer to production behavior, useful as a smoke test that your decorator and guard agree on the same metadata key:

```typescript
import { Reflector } from '@nestjs/core';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

class FakeController {
  @Roles('admin')
  restrictedRoute() {}

  unrestrictedRoute() {}
}

it('reads the real @Roles() metadata via a live Reflector', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const controller = new FakeController();

  const context = {
    switchToHttp: () => ({ getRequest: () => ({ user: { roles: ['admin'] } }) }),
    getHandler: () => controller.restrictedRoute,
    getClass: () => FakeController,
  } as any;

  expect(guard.canActivate(context)).toBe(true);
});
```

Keep the mocked-`Reflector` tests as your primary suite for exhaustively covering the guard's branching logic, and add one or two real-`Reflector` smoke tests to catch metadata-key mismatches between the decorator and the guard — a bug the mocked version cannot detect, since a typo'd string literal would happily match on both sides of the mock.

---

## 9. Common Pitfalls

- **Testing pipes and guards only through the controller/e2e layer.** This buries validation and authorization logic under HTTP and routing noise, makes failures hard to localize, and is slower to run. Test them directly at the unit level as shown here; reserve e2e tests for confirming they're actually wired into the route.
- **Building an `ExecutionContext` fake that implements every method "just in case."** This produces bloated test fixtures that obscure what the guard actually depends on. Implement only what the guard under test calls, and let TypeScript's structural typing (with an `as any`/`as unknown as ExecutionContext` cast) handle the rest.
- **Forgetting that `context.getHandler()` and `context.getClass()` must return the actual function/class references a real `Reflector` (or your mock) expects.** A guard test using `jest.fn()` as a stand-in for `getHandler()` is fine when `Reflector` itself is mocked, but breaks silently if you switch to a real `Reflector`, since `SetMetadata` attaches metadata to the actual decorated function reference.
- **Asserting only the guard's boolean return value, ignoring side effects on the request object.** Guards frequently populate `request.user`, `request.tenantId`, or similar — omit that assertion and a regression that stops populating `request.user` will pass every guard test while breaking every downstream handler that reads it.
- **Not testing the pipe's error path with metadata that includes the actual field name.** Error messages that don't include which field failed make debugging validation errors in production much harder; test that the message actually surfaces `metadata.data`.
- **Re-running full DI container compilation (`Test.createTestingModule()`) for guards/pipes with zero or trivial dependencies.** For a guard/pipe with no injected dependencies (or dependencies you're mocking directly with `new`), plain instantiation (`new SomeGuard(mockDep)`) is faster and simpler than building a testing module — reserve `Test.createTestingModule()` for controllers and services where DI resolution itself is part of what you want exercised.

---

## 10. Best Practices

- Give every guard and pipe a single, obviously named responsibility so its unit tests read as a short, exhaustive list of branches (auth present/absent, role match/mismatch, valid/invalid input) rather than a sprawling matrix.
- Build one shared `createMockExecutionContext()` helper per test suite (or a shared test-utils module) rather than re-declaring context fakes ad hoc in every guard spec — keeps fakes consistent and reduces the chance one test's fake silently omits a method another guard needs.
- When a guard depends on `Reflector`, mock it for the bulk of your branch-coverage tests, but keep one real-`Reflector` integration-style test per guard to catch metadata key typos between the decorator and the guard.
- For pipes, test both the "return transformed value" and "throw on invalid value" paths, and assert on the exception type (`BadRequestException`, not just "any error") so a refactor that accidentally throws the wrong exception type is caught.
- Keep controller unit tests focused on delegation and error propagation — assert the service was called with the right arguments and that its return value/thrown error passes through unchanged. Leave HTTP-level concerns (status codes, actual param parsing via pipes, serialization) to e2e tests.
- Co-locate `*.spec.ts` files next to the guard/pipe/controller they test, matching Nest's CLI-generated convention, so ownership and coverage gaps are easy to spot in a directory listing.

---

## 11. Hands-On Exercises

**Exercise 1:** Write a `ThrottleGuard` that reads a `@Throttle(limit, windowMs)` custom decorator via `Reflector` and denies requests once an in-memory counter (keyed by `request.ip`) exceeds `limit` within `windowMs`. Unit test it with a mocked `Reflector` covering: no `@Throttle` metadata (always allow), under the limit (allow), at the limit (deny), and a different IP not being affected by another IP's count.

**Exercise 2:** Write a `TrimStringsPipe` whose `transform()` recursively trims whitespace from every string property of an object body. Unit test it directly (no `ExecutionContext` needed) with nested objects, arrays of strings, and non-string values that should pass through unchanged.

**Exercise 3:** Take the `RolesGuard` from section 6 and add support for a wildcard role `'*'` that always passes regardless of the user's roles. Write the additional test case, and make sure your existing tests still pass.

**Exercise 4:** Write a controller unit test for an endpoint that calls two different service methods depending on a query parameter (e.g., `?includeDeleted=true` calls `findAllIncludingDeleted()` instead of `findAll()`). Assert the correct method is called for each branch and that the unused one is not.

**Exercise 5:** Extend the `ParseObjectIdPipe` real-`Reflector`-style test pattern from section 8: write a smoke test that decorates a fake controller method parameter with `@Param('id', ParseObjectIdPipe)` conceptually (simulate by calling `pipe.transform()` with the metadata Nest would generate for that parameter) and confirm the error message correctly names `id` when given a malformed value.

---

## 12. Interview Q&A

**Q: Why can you test a guard's `canActivate()` without starting an HTTP server?**
Answer: `canActivate()` is a plain method that receives an `ExecutionContext` object and returns a boolean or a Promise of one (or throws). Nest itself constructs that `ExecutionContext` from the real HTTP request during a live request, but nothing about the guard's logic requires the object to come from a real server — a plain object satisfying the same shape (`switchToHttp().getRequest()`, `getHandler()`, `getClass()`) is indistinguishable to the guard. This lets you unit test authorization logic directly and quickly, reserving actual HTTP requests for e2e tests that confirm the guard is correctly wired into the route via `@UseGuards()`.

**Q: What is the minimum an `ExecutionContext` test fake needs to implement?**
Answer: Only the methods the code under test actually calls. Most HTTP-only guards call `context.switchToHttp().getRequest()` to read the request, and — if they consult custom metadata — `context.getHandler()` and `context.getClass()` to pass to a `Reflector`. A fake that implements exactly those, cast with `as unknown as ExecutionContext`, is sufficient; implementing `switchToRpc()`, `switchToWs()`, or every method of the interface with production-faithful behavior adds no value for an HTTP-only guard's tests.

**Q: Why test a pipe's `transform()` method directly instead of only through a full request?**
Answer: A pipe's `transform(value, metadata)` is a near-pure function — given the same value and metadata, it always produces the same output or throws the same error, with no dependency on HTTP transport, routing, or serialization. Testing it directly is the fastest and most precise way to exhaustively cover its validation branches (valid input, boundary values, malformed input, missing metadata) without the overhead and noise of booting a server and making real HTTP calls. E2E tests should still confirm the pipe is actually attached to the right route parameter, but that's a wiring concern, not a validation-logic concern.

**Q: When testing a `RolesGuard` built on `Reflector.getAllAndOverride()`, why mock `Reflector` for most tests but keep one test with a real `Reflector`?**
Answer: Mocking `Reflector` lets you directly control what metadata the guard "sees" for each test case, which makes it fast and precise for covering every branch of the guard's authorization logic (no roles required, role match, role mismatch, no authenticated user). But a fully mocked `Reflector` can't catch a bug where the `@Roles()` decorator and the guard disagree on the metadata key string (e.g., one uses `'roles'` and the other `'role'`) — both sides of the mock would just silently "agree" on whatever key you configured. A single test using a real `Reflector` against an actual decorated class exercises the real `reflect-metadata` read/write path and catches that class of bug.

**Q: What's the difference between mocking the service in a controller unit test versus using `overrideProvider()` in a full module test?**
Answer: In a controller unit test, you typically list a `useValue` mock for the service directly in the `providers` array of a minimal `Test.createTestingModule()` call, alongside just the controller under test — this builds the smallest possible DI graph. `overrideProvider()` is used when you additionally import a real, larger module (e.g., the actual feature module with its real providers wired together) and want to swap out only one specific provider deep in that graph while keeping everything else real. For a pure controller unit test focused on delegation to a service, the minimal-providers approach is usually simpler and sufficient.

**Q: A guard's test suite passes, but in production the guard never runs. What testing gap does this suggest, and how would you close it?**
Answer: This points to a wiring gap rather than a logic gap — the guard's `canActivate()` method may be entirely correct, but it's never invoked because it was never actually attached via `@UseGuards()` on the controller/handler, or because a global guard was never registered in `main.ts`/the app module. Unit tests that call `canActivate()` directly cannot catch this, because they bypass Nest's own binding mechanism entirely. Closing the gap requires an e2e test (lesson 3) that boots the real application and sends an actual request expected to be blocked or allowed by the guard — only that exercises Nest's real guard-registration and dispatch path.
