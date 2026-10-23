# Providers & Injectable Services — Complete Guide

## Table of Contents
1. [What Is a Provider](#1-what-is-a-provider)
2. [`@Injectable()` and Constructor-Based Injection](#2-injectable-and-constructor-based-injection)
3. [Nest's Constructor Injection vs Angular's `inject()`](#3-nests-constructor-injection-vs-angulars-inject)
4. [The IoC Container — How Nest Resolves the Dependency Graph](#4-the-ioc-container--how-nest-resolves-the-dependency-graph)
5. [Custom Providers — `useClass`, `useValue`, `useFactory`, `useExisting`](#5-custom-providers--useclass-usevalue-usefactory-useexisting)
6. [Injection Tokens — Strings, Symbols, and Classes](#6-injection-tokens--strings-symbols-and-classes)
7. [Worked Example — A Factory Provider That Depends on `ConfigService`](#7-worked-example--a-factory-provider-that-depends-on-configservice)
8. [Optional Dependencies and Overriding Providers in Tests](#8-optional-dependencies-and-overriding-providers-in-tests)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. What Is a Provider

In NestJS, a **provider** is a broader concept than "a service class." Officially, a provider is anything that can be **injected as a dependency** — a service, a repository, a factory function's return value, a configuration object, a helper, even a raw string or number. Controllers, guards, interceptors, and pipes can all *consume* providers, but they are not providers themselves in the sense that matters here: providers are the things registered in a module's `providers` array and made available to the DI container.

```
  A NestJS module's moving parts:
  ┌────────────────────────────────────────────────────────┐
  │  @Module({                                              │
  │    controllers: [ UsersController ]   ← handles HTTP    │
  │    providers:   [ UsersService,       ← injectable       │
  │                    UsersRepository,      classes/values  │
  │                    { provide: 'API_KEY', useValue: ... } │
  │                  ]                                       │
  │    exports:      [ UsersService ]     ← shared outward   │
  │  })                                                      │
  └────────────────────────────────────────────────────────┘
```

The most common provider is a plain class decorated with `@Injectable()`. But the `providers` array also accepts **provider objects** — configuration shapes that tell Nest exactly how to construct the value behind a token (covered in Section 5). This flexibility is what lets Nest inject things that aren't classes at all: connection pools, environment config, third-party SDK clients, or values computed asynchronously at bootstrap.

The key mental model: a provider is a **recipe for producing a value**, registered under a **token** (usually the class itself), that Nest's container can hand to anything that asks for it by that token.

---

## 2. `@Injectable()` and Constructor-Based Injection

`@Injectable()` is a decorator that marks a class as something the Nest IoC container is allowed to manage — instantiate, track, and inject elsewhere. It attaches design-time metadata (via `reflect-metadata`, covered in Phase 01) that records the class's constructor parameter types, which Nest reads at bootstrap to resolve dependencies.

```typescript
// users.service.ts
import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findAll() {
    return this.usersRepository.findAll();
  }

  findOne(id: number) {
    return this.usersRepository.findById(id);
  }
}
```

```typescript
// users.repository.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersRepository {
  private readonly users = [{ id: 1, name: 'Ada Lovelace' }];

  findAll() {
    return this.users;
  }

  findById(id: number) {
    return this.users.find((u) => u.id === id);
  }
}
```

Nest's idiomatic style is **constructor-based injection**: every dependency a class needs is declared as a typed constructor parameter, typically with a `private readonly` access modifier that both declares and assigns the field in one line (a TypeScript parameter-property shorthand — no `this.usersRepository = usersRepository` needed). Nest sees `UsersRepository` as the parameter's type, looks it up in the container, and passes the resolved instance in automatically when it constructs `UsersService`.

This works because TypeScript, when configured with `emitDecoratorMetadata: true` (the Nest CLI does this by default), emits the parameter types of a decorated class as runtime-readable metadata. Nest's container reads that metadata to know *what* to inject, not just *that* something should be injected.

---

## 3. Nest's Constructor Injection vs Angular's `inject()`

NestJS is explicitly modeled on Angular's DI system (both were designed by overlapping teams and share the decorator + `reflect-metadata` foundation), but the two have diverged on the *preferred* injection style, and this trips up developers coming from one framework to the other.

**Angular** (since v14) increasingly favors the `inject()` function, which can be called directly in a field initializer or outside a constructor entirely:

```typescript
// Angular style — NOT idiomatic Nest, shown only for contrast
class UsersComponent {
  private usersService = inject(UsersService); // function call, not a constructor param
}
```

`inject()` exists in Angular because Angular has injection contexts outside of classes with constructors (standalone functions, route guards defined as functions, etc.), and because it plays nicer with Angular's signal-based reactivity primitives that are often set up as class fields.

**NestJS has no equivalent, idiomatic `inject()` function**, and constructor injection remains the *only* recommended style for ordinary providers:

```typescript
// NestJS style — the correct and idiomatic approach
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}
}
```

Why the difference persists:

- Nest's request lifecycle is server-side and class-instance-centric — there is no equivalent to Angular's component tree where "inject anywhere" is convenient.
- Constructor injection makes a class's dependencies **visible in one place** and enforces that a class cannot exist in a half-constructed state without its dependencies — this matters more in backend code where a missing dependency should fail loudly at bootstrap, not at first use.
- Testing conventions in Nest (see Phase 10) lean on constructing classes directly or via `Test.createTestingModule()` and passing constructor arguments/mocks — a pattern that works naturally with constructor injection and awkwardly with field-based `inject()`-style injection.

If you see `@Inject()` used inside a Nest constructor parameter list, it is not Angular's `inject()` function — it is a **parameter decorator** used to specify a non-class **injection token** (Section 6), still within the constructor injection style:

```typescript
@Injectable()
export class BillingService {
  constructor(@Inject('PAYMENT_GATEWAY_URL') private readonly gatewayUrl: string) {}
}
```

---

## 4. The IoC Container — How Nest Resolves the Dependency Graph

Conceptually, when your application calls `NestFactory.create(AppModule)`, Nest does not just start the HTTP listener — it first builds and instantiates an entire object graph:

```
  Bootstrap-time resolution (conceptual):
  ┌───────────────────────────────────────────────────────────┐
  │ 1. Nest scans AppModule's imports/providers/controllers    │
  │    metadata recursively across every imported module.      │
  │                                                              │
  │ 2. For each provider, Nest reads its constructor parameter  │
  │    metadata to determine its dependencies (by token).       │
  │                                                              │
  │ 3. Nest builds a dependency graph:                          │
  │                                                              │
  │        AppController                                        │
  │             │ needs                                         │
  │             ▼                                                │
  │        UsersService                                         │
  │             │ needs                                         │
  │             ▼                                                │
  │        UsersRepository                                       │
  │             │ needs                                          │
  │             ▼                                                 │
  │        (no further deps — leaf node)                         │
  │                                                              │
  │ 4. Nest instantiates LEAF nodes first, then works back up   │
  │    the graph — UsersRepository before UsersService before    │
  │    AppController — so every constructor receives an already-  │
  │    built instance, never a placeholder.                      │
  │                                                              │
  │ 5. Instances are cached per DI subtree (see Phase 04-02 on   │
  │    scopes) — by default, one instance per provider for the   │
  │    whole application lifetime (a singleton).                 │
  └───────────────────────────────────────────────────────────┘
```

This is why Nest is described as **inversion of control**: `UsersService` does not call `new UsersRepository()` itself — it declares that it *needs* a `UsersRepository`, and control over *when* and *how* that instance is created is inverted to the framework. This is what makes Nest applications testable (swap the real `UsersRepository` for a mock at the container level, with zero changes to `UsersService`) and modular (a provider can be relocated, replaced, or scoped differently without touching its consumers' code).

If the graph cannot be resolved — a token has no matching provider, or two providers depend on each other in a cycle Nest cannot untangle — bootstrap fails immediately with a descriptive error (or, in the circular case, a much less obvious one; see Phase 04-02). This fail-fast behavior is intentional: a missing dependency is a startup-time configuration error, not a runtime surprise waiting to happen on the first request.

---

## 5. Custom Providers — `useClass`, `useValue`, `useFactory`, `useExisting`

Most of the time, a provider entry is just a class name shorthand: `providers: [UsersService]`. This is sugar for the full provider object:

```typescript
providers: [
  { provide: UsersService, useClass: UsersService },
]
```

Nest exposes four provider shapes that let you control *how* the value behind a token is produced. Developers coming from **Spring** will recognize this immediately — it mirrors Spring's `@Bean` method patterns (a `@Bean` returning `new Impl()` is `useClass`, a `@Bean` returning a pre-built singleton value is `useValue`, a `@Bean` method with `@Autowired` parameters that constructs something conditionally is `useFactory`, and a `@Bean` that just returns an existing bean under a different qualifier is `useExisting`/aliasing).

| Shape | Purpose | Spring parallel |
|-------|---------|------------------|
| `useClass` | Instantiate a class (default). Also used to swap implementations per environment. | `@Bean` returning `new Impl()`, or `@Profile`-based bean swapping |
| `useValue` | Register a pre-built value — an object, primitive, mock, or third-party client instance. No instantiation happens. | `@Bean` returning a constant/pre-built object |
| `useFactory` | Register a value returned by a function, optionally injecting other providers as factory arguments via `inject`. Supports `async` factories. | `@Bean` method with `@Autowired` parameters |
| `useExisting` | Create an alias — a second token that resolves to the exact same instance as an existing token. | A second bean name/qualifier for one existing bean |

```typescript
// useClass — swap implementation per environment
providers: [
  {
    provide: MailerService,
    useClass: process.env.NODE_ENV === 'production' ? SesMailerService : ConsoleMailerService,
  },
]
```

```typescript
// useValue — register a pre-built constant or mock
export const API_KEY = 'STRIPE_API_KEY';

providers: [
  { provide: API_KEY, useValue: process.env.STRIPE_SECRET_KEY },
]
```

```typescript
// useFactory — compute the value with a function, optionally async
providers: [
  {
    provide: 'DATABASE_CONNECTION',
    useFactory: async () => {
      const connection = await createConnection({ url: process.env.DB_URL });
      return connection;
    },
  },
]
```

```typescript
// useExisting — alias one token to another's instance
providers: [
  LoggerService,
  { provide: 'AliasedLoggerService', useExisting: LoggerService },
]
```

`useExisting` is distinct from `useClass` with the same class: `useClass` would create a **second, separate instance** of `LoggerService` under the alias token, while `useExisting` resolves the alias to the **same singleton instance** already created for `LoggerService`.

---

## 6. Injection Tokens — Strings, Symbols, and Classes

Every provider is registered under a **token** — the key the DI container uses to look up "which value satisfies this dependency." When you write `providers: [UsersService]`, the class itself (`UsersService`) *is* the token — this works because classes are values at runtime in TypeScript (not just compile-time types), so Nest can use the class reference as a map key.

But not everything you want to inject is a class. Primitive values, interfaces (which vanish at runtime — TypeScript interfaces have no runtime representation), and configuration objects need a different kind of token:

```typescript
// String token
export const APP_NAME = 'APP_NAME';

providers: [{ provide: APP_NAME, useValue: 'SkillVault API' }]

// Consuming it — must use @Inject() because there's no class to infer from
@Injectable()
export class GreetingService {
  constructor(@Inject(APP_NAME) private readonly appName: string) {}
}
```

```typescript
// Symbol token — avoids string collisions across the codebase
export const CACHE_MANAGER = Symbol('CACHE_MANAGER');

providers: [{ provide: CACHE_MANAGER, useFactory: () => new RedisCacheClient() }]

@Injectable()
export class ReportService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: RedisCacheClient) {}
}
```

Nest does not ship a dedicated `InjectionToken` *class* the way Angular does (Angular's `InjectionToken<T>` wraps a description string and a generic type for stronger typing). In Nest, a plain string constant or a `Symbol` **serves the same purpose** — both are opaque, unique-enough keys, and combining them with a shared interface for typing gives you the equivalent type safety:

```typescript
// The Nest-idiomatic equivalent of Angular's InjectionToken<T> pattern:
export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const CACHE_CLIENT = Symbol('CACHE_CLIENT');

providers: [
  { provide: CACHE_CLIENT, useFactory: (): CacheClient => new RedisCacheClient() },
]

@Injectable()
export class ReportService {
  // the interface types the field; the Symbol resolves the value at runtime
  constructor(@Inject(CACHE_CLIENT) private readonly cache: CacheClient) {}
}
```

Rule of thumb: use the **class itself** as the token whenever you're injecting a concrete class (the overwhelmingly common case). Reach for a **string or Symbol token** only when the thing you're injecting is an interface, a primitive, a third-party value with no injectable class wrapper, or when you deliberately want multiple swappable implementations behind one stable key.

---

## 7. Worked Example — A Factory Provider That Depends on `ConfigService`

A common real-world need: construct a provider (an API client, a database pool, a cache connector) whose configuration comes from environment variables, which are themselves exposed through `@nestjs/config`'s `ConfigService`. This requires a factory provider that **itself has a dependency** — Nest resolves this via the `inject` array alongside `useFactory`.

```typescript
// mailer.provider.ts
import { ConfigService } from '@nestjs/config';
import { Provider } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export const MAILER_CLIENT = 'MAILER_CLIENT';

export const mailerProvider: Provider = {
  provide: MAILER_CLIENT,
  // `inject` tells Nest which providers to resolve and pass as arguments,
  // in order, to the `useFactory` function.
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    return nodemailer.createTransport({
      host: configService.get<string>('SMTP_HOST'),
      port: configService.get<number>('SMTP_PORT'),
      auth: {
        user: configService.get<string>('SMTP_USER'),
        pass: configService.get<string>('SMTP_PASS'),
      },
    });
  },
};
```

```typescript
// mailer.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { mailerProvider } from './mailer.provider';
import { MailerService } from './mailer.service';

@Module({
  imports: [ConfigModule], // ConfigService must be visible here (Phase 04-03 explains why)
  providers: [mailerProvider, MailerService],
  exports: [MailerService],
})
export class MailerModule {}
```

```typescript
// mailer.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { Transporter } from 'nodemailer';
import { MAILER_CLIENT } from './mailer.provider';

@Injectable()
export class MailerService {
  constructor(@Inject(MAILER_CLIENT) private readonly transporter: Transporter) {}

  async sendWelcomeEmail(to: string) {
    await this.transporter.sendMail({
      from: 'no-reply@skillvault.dev',
      to,
      subject: 'Welcome!',
      text: 'Thanks for signing up.',
    });
  }
}
```

Walking through what Nest does at bootstrap:

1. It sees `mailerProvider` needs a `ConfigService` (from the `inject` array) and resolves that first — `ConfigModule` must be imported into `MailerModule` for this lookup to succeed.
2. It calls the `useFactory` function with the resolved `ConfigService` instance, producing a configured `nodemailer.Transporter`, and caches that return value under the `MAILER_CLIENT` token (as a singleton, by default scope).
3. `MailerService` asks for `MAILER_CLIENT` via `@Inject()` (required here since the token is a string, not a class) and receives the cached transporter instance.

This pattern — a factory provider consuming `ConfigService` — is the standard way to bridge environment-driven configuration into any third-party client Nest doesn't have native support for (search clients, message queue connections, payment SDKs, and so on).

---

## 8. Optional Dependencies and Overriding Providers in Tests

Not every dependency a class *could* use is one it strictly *requires*. Nest supports **optional dependencies** via the `@Optional()` parameter decorator — if the container cannot resolve the token, Nest injects `undefined` instead of throwing a resolution error at bootstrap:

```typescript
import { Injectable, Optional, Inject } from '@nestjs/common';

@Injectable()
export class AnalyticsService {
  constructor(
    @Optional() @Inject('ANALYTICS_API_KEY') private readonly apiKey?: string,
  ) {}

  track(event: string) {
    if (!this.apiKey) {
      return; // gracefully no-op if analytics isn't configured for this environment
    }
    // send event using this.apiKey ...
  }
}
```

Use `@Optional()` sparingly — for genuinely optional integrations (an analytics key that only exists in production, a feature flag client not wired up in local dev) — not as a way to paper over a module wiring mistake. If a dependency is truly required for correct behavior, let Nest fail loudly at bootstrap rather than silently degrading at runtime.

The provider system's design — everything resolved by token — is also exactly what makes Nest's testing utilities powerful. `Test.createTestingModule()` (from `@nestjs/testing`, covered fully in Phase 10) lets you swap any real provider for a mock **by token**, without touching the consuming class at all:

```typescript
import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  it('returns a user by id', async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository, // same token the real UsersRepository uses
          useValue: { findById: jest.fn().mockReturnValue({ id: 1, name: 'Ada' }) },
        },
      ],
    }).compile();

    const usersService = module.get(UsersService);
    expect(usersService.findOne(1)).toEqual({ id: 1, name: 'Ada' });
  });
});
```

Because `UsersService` only ever asked the container for "whatever satisfies the `UsersRepository` token," it has no way to tell the difference between the real repository and the test double — this is the practical payoff of everything covered in this lesson: providers, tokens, and constructor injection together are what make a Nest application's business logic testable in isolation.

---

## 9. Common Pitfalls

- **Forgetting `@Injectable()`.** A class with no decorator has no metadata for Nest to read. It will either fail to resolve dependencies (if it has constructor params) or, worse, silently work with `undefined` dependencies in looser TypeScript configs — always decorate anything registered as a provider.
- **Missing `@Inject()` on non-class tokens.** If you inject via a string or Symbol token but forget the `@Inject()` decorator on that constructor parameter, Nest has no type metadata to fall back on (there is no class to infer) and throws a "Nest can't resolve dependencies" error naming an `undefined` token.
- **Using an interface as if it were a runtime token.** `constructor(private readonly cache: CacheClient)` with no `@Inject()` compiles fine but fails at runtime — TypeScript interfaces are erased during compilation, so Nest sees no token at all. Always pair an interface-typed dependency with an explicit string/Symbol token and `@Inject()`.
- **Confusing `useClass` and `useExisting` when aliasing.** Reaching for `useClass: LoggerService` to "alias" an existing provider actually constructs a second, independent instance — defeating any shared state (like an in-memory cache or connection) the original instance held. Use `useExisting` for a true alias.
- **Factory providers with the wrong `inject` order.** The `inject` array's order must exactly match the `useFactory` function's parameter order — a mismatched order silently passes the wrong instances to the wrong parameters instead of raising an error, since everything still type-checks as "some provider."
- **Registering a provider without exporting what depends on it.** A factory provider like `mailerProvider` and the service that uses it need consistent visibility; if `MAILER_CLIENT` isn't in `providers` in the same module as `MailerService` (or exported from an imported module), you'll get a resolution error even though the code compiles.

---

## 10. Best Practices

- Default to **constructor injection with typed class references** for the vast majority of providers — reach for string/Symbol tokens only when injecting non-class values.
- Keep injection tokens as **exported named constants** (`export const MAILER_CLIENT = 'MAILER_CLIENT'`) in the same file as the provider definition, so consumers import the token rather than retyping the string, eliminating a class of typo bugs.
- Prefer `useFactory` over ad-hoc instantiation inside a service's constructor whenever a value needs configuration derived from other providers (like `ConfigService`) — this keeps the construction logic testable and swappable independent of the consuming service.
- Type factory-produced tokens with an interface even when the underlying token is a string/Symbol (as in the `CacheClient` example) — you get full IDE autocomplete and compile-time checking on the injected value without needing Nest to understand the interface at runtime.
- Group a token, its provider definition, and its interface (if any) into one file per concern (e.g. `mailer.provider.ts`) rather than scattering them — this makes "what does this token resolve to" a one-file answer.
- Reserve `useValue` for genuinely static or precomputed values (config constants, mocks in tests) — if the value needs any per-request or lazily-computed logic, that's a sign you want `useFactory` instead.

---

## 11. Hands-On Exercises

**Exercise 1:** Create a `LoggerModule` with a plain `@Injectable()` `LoggerService` that has a `log(message: string)` method printing to the console with a timestamp prefix. Inject it into a `UsersService` via constructor injection and call it from a `findAll()` method. Verify the log line appears when you hit the corresponding controller route.

**Exercise 2:** Register an `APP_VERSION` string token using `useValue` with a hardcoded version string (e.g. `'1.4.0'`). Inject it into a controller using `@Inject(APP_VERSION)` and expose it from a `GET /version` endpoint. Then change the provider to use `useFactory` instead, reading the version from `process.env.npm_package_version` (or a hardcoded fallback), and confirm the endpoint's behavior is unchanged from the consumer's perspective — proving the consumer doesn't care which provider shape produced the value.

**Exercise 3:** Build a `useExisting` alias: register `LoggerService` normally, then add a second provider entry `{ provide: 'AuditLogger', useExisting: LoggerService }`. Inject both `LoggerService` (directly) and `'AuditLogger'` (via `@Inject`) into the same consumer, call a stateful method on each (e.g. one that increments an internal counter), and prove via console output that both point to the identical instance (the counter increments are shared). Then swap `useExisting` for `useClass: LoggerService` and observe that the counter is no longer shared — two separate instances now exist.

**Exercise 4:** Write a `useFactory` provider for a fake "payment gateway client" that depends on `ConfigService` for an API key and an API URL (add these to a `.env` file and wire up `@nestjs/config`). Have the factory return a plain object with a `charge(amount: number)` method that logs the configured URL and API key before "processing" the charge. Inject the resulting token into a `PaymentsService` and call it from a controller route.

**Exercise 5:** Deliberately break dependency resolution: inject an interface-typed constructor parameter with no `@Inject()` decorator and no matching class provider (e.g. `constructor(private readonly cache: CacheClient)` where `CacheClient` is only an interface). Run the app, read the resulting Nest error message carefully, and write down in your own words what part of the message tells you the problem is a missing/unresolvable token rather than a business logic bug. Then fix it using a Symbol token and `@Inject()`.

---

## 12. Interview Q&A

**Q: What is a provider in NestJS, and how is it different from just "a service class"?**
Answer: A provider is any value that Nest's IoC container can construct (or otherwise produce) and inject into other classes — it is a broader concept than "a service," which is just the most common *kind* of provider. Providers are registered in a module's `providers` array either as a bare class (shorthand for `{ provide: SomeClass, useClass: SomeClass }`) or as an explicit provider object using `useClass`, `useValue`, `useFactory`, or `useExisting`. This means providers can represent non-class values too — configuration constants, third-party client instances, or factory-computed connections — anything the container needs to hand out by token.

**Q: Explain conceptually how Nest resolves the dependency graph at bootstrap.**
Answer: When `NestFactory.create()` runs, Nest scans every module's metadata (imports, providers, controllers) to build a full dependency graph before instantiating anything. It reads each provider's constructor parameter types (via `reflect-metadata`, emitted because of `emitDecoratorMetadata`) to know what each provider depends on, then instantiates providers bottom-up — leaf dependencies (those needing nothing else) first, then working back up so that every constructor always receives fully-built instances. This is inversion of control: a class never constructs its own dependencies; it declares what it needs and the container decides when and how to build it.

**Q: Why does Nest recommend constructor injection over an Angular-style `inject()` function?**
Answer: Nest has no idiomatic equivalent of Angular's `inject()` — constructor injection is the sole recommended style for ordinary providers. This is partly historical (Nest predates Angular's `inject()` function) and partly architectural: Nest's server-side, class-instance-centric model benefits from having all of a class's dependencies visible in one place (the constructor signature), and it plays cleanly with Nest's testing utilities, which construct classes or testing modules by passing dependencies explicitly. `@Inject()` does still appear in Nest code, but as a parameter decorator for specifying non-class tokens within constructor injection — not as a substitute for it.

**Q: What are the four custom provider shapes and when would you use each?**
Answer: `useClass` instantiates a class and is the default/most common shape, also used to swap implementations conditionally (e.g. by environment). `useValue` registers a pre-built value with no instantiation — ideal for constants, config values, or test mocks. `useFactory` computes the value via a function, optionally injecting other providers as arguments through the paired `inject` array, and supports async factories — the right tool whenever construction needs other providers' data. `useExisting` creates a true alias, where a second token resolves to the exact same singleton instance as an existing token, unlike `useClass` which would construct an independent second instance.

**Q: When do you need an injection token that isn't a class, and how do string/Symbol tokens compare?**
Answer: You need a non-class token whenever the thing you're injecting has no runtime representation as a class — primitives, interfaces (erased at compile time), or third-party values without an injectable wrapper. String tokens are simple but can collide across a large codebase if two unrelated features pick the same string; Symbol tokens guarantee uniqueness since every `Symbol()` call produces a distinct value even with an identical description. Nest doesn't ship a dedicated `InjectionToken` class like Angular does, but the combination of a string/Symbol token plus a TypeScript interface for typing the injected value achieves the same effect.

**Q: Walk through what happens if a `useFactory` provider depends on `ConfigService` but the module doesn't import `ConfigModule`.**
Answer: Nest resolves the factory's `inject` array entries the same way it resolves any constructor dependency — by looking up the token in the current module's own providers, then in any imported modules' exported providers. If `ConfigModule` isn't imported (or if it is imported but doesn't export `ConfigService`, which `@nestjs/config`'s `ConfigModule` does by default), Nest throws an unresolved-dependency error at bootstrap naming `ConfigService` as unfindable in that module's context — the fix is adding `ConfigModule` to the consuming module's `imports` array so the token becomes visible.
