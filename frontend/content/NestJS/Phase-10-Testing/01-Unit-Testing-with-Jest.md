# Unit Testing with Jest — Complete Guide

## Table of Contents
1. [Why Nest's DI Makes Unit Testing Easy](#1-why-nests-di-makes-unit-testing-easy)
2. [Nest's Default Jest Setup](#2-nests-default-jest-setup)
3. [Test.createTestingModule() — Building an Isolated Container](#3-testcreatetestingmodule--building-an-isolated-container)
4. [Overriding Providers with Mocks](#4-overriding-providers-with-mocks)
5. [jest.fn() and jest.mock() Basics](#5-jestfn-and-jestmock-basics)
6. [Worked Example — Unit Testing a Service with a Mocked Repository](#6-worked-example--unit-testing-a-service-with-a-mocked-repository)
7. [Testing Async Code, Errors, and Edge Cases](#7-testing-async-code-errors-and-edge-cases)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Why Nest's DI Makes Unit Testing Easy

Every Nest provider — service, repository wrapper, guard, interceptor — receives its dependencies through constructor injection, resolved by tokens (classes or strings) rather than by directly importing and instantiating concrete implementations. That indirection is exactly what makes unit testing painless: a test does not need a real database connection to test business logic in a service, because the test can hand the service a fake object that satisfies the same injection token.

```
  Production wiring                    Test wiring
  ──────────────────                   ────────────
  UsersService                         UsersService
      │ constructor(repo)                  │ constructor(repo)
      ▼                                     ▼
  TypeORM Repository<User>             { find: jest.fn(), save: jest.fn() }
  (real Postgres connection)           (plain object, no I/O)
```

Because the class under test never reaches for its dependency by name — it only knows "something that satisfies this token was injected" — you can substitute any object with a compatible shape. This is the core reason Nest ships its own testing utilities (`@nestjs/testing`) instead of just telling you to `new UsersService(fakeRepo)` directly: real applications wire dependencies through modules, and `Test.createTestingModule()` lets you exercise that same module-based wiring in tests, just with substitutions in place.

Unit tests in this lesson never touch a real network socket, real filesystem, or real database. They test one class's logic against controlled, in-memory stand-ins for its collaborators. That's what keeps them fast (milliseconds, not seconds) and deterministic (no flaky network calls).

---

## 2. Nest's Default Jest Setup

A project generated with `nest new` ships with Jest preconfigured. Two relevant blocks live in `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsx/cjs node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

The important convention: **unit tests live next to the code they test**, as `<name>.spec.ts` files inside `src/`. Nest's CLI generates a spec file alongside every service, controller, and resolver it scaffolds:

```
src/
└── users/
    ├── users.module.ts
    ├── users.controller.ts
    ├── users.controller.spec.ts
    ├── users.service.ts
    └── users.service.spec.ts
```

End-to-end tests are configured separately (`test/jest-e2e.json`), live in a top-level `test/` directory as `*.e2e-spec.ts` files, and are covered in lesson 3. Keeping the two configs separate matters because unit tests should run on every save (`test:watch`) in well under a second, while e2e tests boot a full application and often a database — you don't want that in your inner dev loop.

---

## 3. Test.createTestingModule() — Building an Isolated Container

`Test.createTestingModule()` is Nest's test-only replacement for `NestFactory.create()`. It accepts the same kind of metadata object (`imports`, `controllers`, `providers`) as a real `@Module()` decorator, builds a real Nest DI container from it, and lets you `.compile()` that container into a `TestingModule` you can pull instances out of with `.get()`.

```typescript
// src/users/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  let service: UsersService;
  let repository: UsersRepository;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            findOne: jest.fn(),
            findAll: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<UsersService>(UsersService);
    repository = moduleRef.get<UsersRepository>(UsersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

A few things are worth noticing:

- **You do not need to import the whole `UsersModule`.** Listing only `UsersService` plus a stand-in for `UsersRepository` in `providers` gives you exactly the dependency graph the test needs — nothing more. This is deliberate: importing the full production module would pull in real database modules, config modules, and everything else, defeating the purpose of isolation.
- **`.compile()` is asynchronous** because Nest may need to resolve dynamic modules and lifecycle hooks; always `await` it.
- **A fresh `TestingModule` is built in `beforeEach`**, not once in `beforeAll`. This guarantees every test starts from a clean DI container and clean mocks — one test's calls to `jest.fn()` mocks cannot leak into the next.

---

## 4. Overriding Providers with Mocks

Listing a substitute provider directly in `providers` (as above) works well when a dependency is simple. For larger modules — especially when you want to import a real feature module but replace just one deep dependency — `overrideProvider()` is the more surgical tool. It's part of the `TestingModuleBuilder` fluent API returned by `Test.createTestingModule()`, applied before `.compile()`:

```typescript
import { Test } from '@nestjs/testing';
import { UsersModule } from './users.module';
import { UsersRepository } from './users.repository';
import { MailService } from '../mail/mail.service';

const moduleRef = await Test.createTestingModule({
  imports: [UsersModule], // pulls in the real module graph
})
  .overrideProvider(UsersRepository)
  .useValue({
    findOne: jest.fn().mockResolvedValue({ id: 1, email: 'a@b.com' }),
    save: jest.fn(),
  })
  .overrideProvider(MailService)
  .useValue({ sendWelcomeEmail: jest.fn() })
  .compile();
```

`overrideProvider(token)` returns a builder with three terminal methods:

| Method | Use case |
|--------|----------|
| `.useValue(mockObject)` | Replace with a plain object — the most common case for mocking a repository or client |
| `.useClass(MockClass)` | Replace with a different class Nest instantiates and injects into |
| `.useFactory({ factory })` | Replace with a factory function, optionally with its own `inject` deps |

`overrideProvider` only rewires the token — it does **not** change the shape callers expect. If `UsersRepository` exposes `findOne(id: number): Promise<User>`, your mock must return a shape compatible with that signature or the test will pass for the wrong reason (or fail confusingly downstream). Prefer typing your mocks against the real class's interface where practical:

```typescript
type MockRepository<T = any> = Partial<Record<keyof T, jest.Mock>>;

const createMockRepository = <T = any>(): MockRepository<T> => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
});
```

This `createMockRepository` helper is a common pattern across Nest test suites: it gives you an object with the right *keys*, typed loosely enough to configure per test, while keeping call signatures close to the real repository.

---

## 5. jest.fn() and jest.mock() Basics

`jest.fn()` creates a standalone mock function. It records every call (arguments, return values, how many times it was invoked) and lets you script its behavior:

```typescript
const mockFn = jest.fn();

mockFn.mockReturnValue(42);              // always returns 42
mockFn.mockResolvedValue({ id: 1 });     // returns a resolved Promise (for async fns)
mockFn.mockRejectedValue(new Error());   // returns a rejected Promise
mockFn.mockImplementation((x) => x * 2); // custom logic per call

mockFn.mockReturnValueOnce(1).mockReturnValueOnce(2); // different value per call

expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith(5);
expect(mockFn).toHaveBeenCalledTimes(2);
```

`jest.mock()` goes further — it replaces an entire imported module with an auto-mocked version, useful when a dependency is a third-party library or a module you import directly (not through Nest's DI) rather than injecting:

```typescript
import { hash } from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

it('hashes the password before saving', async () => {
  await service.register({ email: 'a@b.com', password: 'plain' });
  expect(hash).toHaveBeenCalledWith('plain', 10);
});
```

In Nest, prefer `overrideProvider`/constructor injection over `jest.mock()` whenever the dependency is itself an injectable Nest provider — it keeps the DI container as the single source of truth for wiring, and avoids the fragility of module-level mocking (which mocks *every* import of that module in the test file, including ones used only for types). Reach for `jest.mock()` mainly for library-level calls like `bcrypt`, `fs`, or the Node `crypto` module that are called directly rather than injected.

---

## 6. Worked Example — Unit Testing a Service with a Mocked Repository

Consider a `UsersService` backed by a TypeORM repository:

```typescript
// src/users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findById(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const user = this.usersRepository.create(dto);
    return this.usersRepository.save(user);
  }
}
```

The full spec file, using `getRepositoryToken()` to reproduce the exact injection token TypeORM's `@InjectRepository()` decorator generates:

```typescript
// src/users/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';

type MockRepo = Partial<Record<keyof Repository<User>, jest.Mock>>;

const createMockRepo = (): MockRepo => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let repo: MockRepo;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepo(),
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repo = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      const mockUser = { id: 1, email: 'a@b.com' } as User;
      (repo.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findById(1);

      expect(result).toEqual(mockUser);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('throws NotFoundException when the user does not exist', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates and saves a new user when the email is unused', async () => {
      const dto = { email: 'new@b.com', name: 'New User' };
      const created = { id: 2, ...dto } as User;

      (repo.findOne as jest.Mock).mockResolvedValue(null);
      (repo.create as jest.Mock).mockReturnValue(created);
      (repo.save as jest.Mock).mockResolvedValue(created);

      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(repo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(created);
    });

    it('throws ConflictException when the email is already registered', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({ id: 1, email: 'dup@b.com' });

      await expect(
        service.create({ email: 'dup@b.com', name: 'Dup' }),
      ).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
```

Notice the tests never construct a `Repository<User>` — they only assert that `UsersService` calls the *shape* it depends on with the right arguments, and reacts correctly to what that shape returns. This is what makes the test resilient to swapping TypeORM for Prisma later: only this spec file and the mock shape would need to change, not the assertions about `UsersService`'s business logic.

---

## 7. Testing Async Code, Errors, and Edge Cases

Jest's `rejects`/`resolves` matchers keep async assertions terse and avoid the classic bug of forgetting to `await` an assertion (which lets a test pass even though the promise actually rejected):

```typescript
// Prefer this:
await expect(service.findById(99)).rejects.toThrow(NotFoundException);

// Over this — the missing await means Jest never sees the rejection:
expect(service.findById(99)).rejects.toThrow(NotFoundException); // BUG: missing await
```

When a method under test calls multiple dependencies conditionally, assert both the "happy path called" and "unhappy path not called" sides — as the `create()` tests above do with `expect(repo.save).not.toHaveBeenCalled()`. This catches bugs where an early return is missing and the code proceeds to call a mutating method it shouldn't have.

For services with a system clock or randomness, prefer injecting a clock/`Date` abstraction over faking global time in every spec, but when you must, `jest.useFakeTimers()` and `jest.setSystemTime()` handle it cleanly:

```typescript
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});
```

---

## 8. Common Pitfalls

- **Importing the real feature module instead of listing minimal providers.** `imports: [UsersModule]` pulls in every dependency `UsersModule` declares, including ones that reach for real database connections or config — turning a "unit" test into a slow, fragile integration test. Only import the module when you specifically need `overrideProvider` to swap one deep dependency inside an otherwise-real graph.
- **Forgetting `getRepositoryToken()` (or the equivalent for your ORM).** Providing `{ provide: UsersRepository, useValue: mock }` will not satisfy `@InjectRepository(User)` — the actual injection token TypeORM registers is `getRepositoryToken(User)`, a Symbol/string, not the `Repository` class itself. Mismatched tokens produce a `Nest can't resolve dependencies` error at `.compile()` time.
- **Not resetting mocks between tests.** Without `jest.clearAllMocks()` (or `restoreAllMocks()`) in `afterEach`, call counts and `mockResolvedValueOnce` queues from one test bleed into the next, causing order-dependent flakiness.
- **Missing `await` on promise-returning assertions.** `expect(promise).rejects.toThrow()` without `await` silently passes regardless of what the promise does, because Jest never waits for it to settle.
- **Testing the mock instead of the service.** A test that only asserts `repo.save` was called, without also asserting what `service.create()` returned or threw, verifies wiring but not behavior — mutation testing frequently kills these tests without producing a real regression signal.
- **Building a new `TestingModule` once in `beforeAll` and reusing it across tests that mutate shared mock state.** This works until a test mutates a mock's return value and a later test unexpectedly inherits it; prefer `beforeEach` for anything stateful.

---

## 9. Best Practices

- Keep unit test suites structured to mirror the service's public methods: one top-level `describe` block per method, with nested `it` blocks for happy path, not-found/error path, and edge cases.
- Prefer `useValue` mocks with `jest.fn()` per method over `useClass` fakes, unless the fake needs internal state across multiple calls (e.g., an in-memory list) — plain jest mocks are easier to configure per-test and show clearer failure output.
- Extract a `createMock<T>()` helper (or use a library like `jest-mock-extended`'s `mock<T>()`) once you have more than two or three repositories to mock across a codebase, to avoid re-declaring the same shape everywhere.
- Assert on both the return value/thrown error *and* the arguments passed to mocked dependencies — this catches both "wrong result" and "right result for the wrong reason" bugs.
- Run `test:cov` regularly and treat branch coverage gaps in `catch` blocks and guard clauses as a signal you're missing an edge-case test, not just a metric to chase.
- Keep unit tests fast: if a single `.spec.ts` file takes more than a second or two to run, look for an accidental real I/O call slipping through an unmocked dependency.

---

## 10. Hands-On Exercises

**Exercise 1:** Create an `OrdersService` with a constructor-injected `OrdersRepository` (`findOne`, `save`) and an injected `InventoryService` (`reserveStock`, `releaseStock`). Write `placeOrder(dto)` so it calls `reserveStock` before saving the order, and `releaseStock` if `save` throws. Write a full spec using `Test.createTestingModule()` with both dependencies mocked via `useValue`, covering: successful placement, stock reservation failure (order never saved), and save failure after successful reservation (stock released).

**Exercise 2:** Take the `UsersService` from this lesson and add a `deactivate(id)` method that throws `NotFoundException` if the user doesn't exist and otherwise sets `isActive: false` and saves. Write specs for both branches, asserting the exact object passed to `repo.save`.

**Exercise 3:** Refactor one of your mock repositories in this lesson to use `overrideProvider(UsersRepository).useFactory({ factory: () => createMockRepo() })` instead of listing it directly in `providers`. Confirm the tests still pass and explain in a comment why `useFactory` might be preferable when the mock needs to read other providers from the container (e.g., a shared in-memory config value).

**Exercise 4:** Write a spec for a `PasswordService.hash(plain)` method that calls `bcrypt.hash` directly (not injected). Use `jest.mock('bcrypt')` to stub it, and assert `hash` was called with the expected salt rounds.

**Exercise 5:** Introduce a deliberate bug — remove the `if (existing) throw new ConflictException(...)` check from `create()` — run the test suite, and confirm which specific test(s) fail. Restore the check, then add one more test that asserts `repo.findOne` was called with `{ where: { email: dto.email } }` specifically, to guard against a future refactor that checks the wrong field.

---

## 11. Interview Q&A

**Q: What problem does `Test.createTestingModule()` solve that plain `new UsersService(mockRepo)` wouldn't?**
Answer: `new UsersService(mockRepo)` works for trivial single-dependency classes, but real Nest providers are often resolved through module-level wiring — custom injection tokens (`getRepositoryToken`), `@Optional()` dependencies, provider factories with their own `inject` arrays, and nested module imports. `Test.createTestingModule()` builds an actual Nest DI container from the same kind of metadata used in production (`providers`, `imports`), so the resolution logic under test is the real Nest resolution logic, just with selected tokens overridden. It also lets you reuse `overrideProvider()` to swap a single dependency deep in a real module graph without needing to know the whole constructor signature by hand.

**Q: When would you use `overrideProvider().useValue()` versus just listing the mock in the `providers` array?**
Answer: Listing the mock directly in `providers` is simplest when you're building a minimal module from scratch with only the class under test and its direct dependencies. `overrideProvider()` is for when you want to import a real, larger module (e.g., the actual `UsersModule`) to preserve its real wiring, but need to swap out one or two deep dependencies — such as a repository or an external HTTP client — with a mock. It avoids having to reconstruct the entire provider list yourself and keeps the rest of the module's real behavior intact.

**Q: Why is `getRepositoryToken(User)` needed instead of providing `Repository<User>` or `UsersRepository` directly?**
Answer: `@InjectRepository(User)` is a Nest decorator that, under the hood, injects using a dynamically generated token specific to that entity — not the generic `Repository` class. `getRepositoryToken(User)` produces that exact same token, so overriding it in a test module correctly intercepts the value the real `@InjectRepository(User)` decorator would have resolved. Providing the plain `Repository` class as the token would not match, and Nest would either fail to resolve the dependency or resolve an unrelated provider.

**Q: What's the risk of using `jest.mock()` to mock a Nest-injectable class instead of overriding it through the testing module?**
Answer: `jest.mock()` operates at the module system level — it replaces every import of that module within the test file, including type-only imports, and doesn't interact with the Nest DI container at all. This can hide dependency-resolution bugs (e.g., a provider genuinely missing from a module) that `Test.createTestingModule()` would surface as a compile-time DI error. It's better reserved for mocking library calls that aren't part of Nest's own DI graph, like `bcrypt` or `fs`, while DI-managed dependencies should be overridden through `overrideProvider()` or a `useValue` provider so the test exercises the same resolution path as production.

**Q: How do you avoid state leaking between tests when using `jest.fn()` mocks?**
Answer: Rebuild the `TestingModule` in `beforeEach` rather than `beforeAll` so each test gets a fresh container and fresh mock instances, and call `jest.clearAllMocks()` (or `jest.restoreAllMocks()` if using spies) in `afterEach` to reset call counts and any `mockReturnValueOnce`/`mockResolvedValueOnce` queues. Without this, a mock configured with `mockResolvedValueOnce` in one test can silently affect the next test's assertions, producing order-dependent failures that are hard to diagnose because the tests pass individually but fail when run together.

**Q: How would you unit test a method that depends on the current date, without making tests flaky?**
Answer: Use Jest's fake timers — `jest.useFakeTimers()` combined with `jest.setSystemTime(new Date(...))` — to pin `Date.now()` and `new Date()` to a fixed instant for the duration of the test, then restore real timers in `afterEach` with `jest.useRealTimers()`. An even more testable design injects a clock abstraction (e.g., a `ClockService` with a `now()` method) as a constructor dependency, which can then be mocked like any other provider via `overrideProvider` — this avoids relying on global time-faking altogether and keeps the dependency explicit.
