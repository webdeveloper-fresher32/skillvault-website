# Dynamic Modules and forRoot()/forFeature() — Complete Guide

## Table of Contents
1. [The Problem Static Modules Can't Solve](#1-the-problem-static-modules-cant-solve)
2. [The DynamicModule Interface](#2-the-dynamicmodule-interface)
3. [The forRoot() Convention](#3-the-forroot-convention)
4. [The forRootAsync() Convention](#4-the-forrootasync-convention)
5. [The forFeature() Convention](#5-the-forfeature-convention)
6. [Building a Custom Dynamic Module From Scratch](#6-building-a-custom-dynamic-module-from-scratch)
7. [Worked Example — A Configurable LoggerModule](#7-worked-example--a-configurable-loggermodule)
8. [How @nestjs/config and @nestjs/typeorm Use This Pattern](#8-how-nestjsconfig-and-nestjstypeorm-use-this-pattern)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The Problem Static Modules Can't Solve

Everything in Lesson 1 used **static modules** — the `@Module()` decorator's metadata (`imports`, `controllers`, `providers`, `exports`) is fixed at compile time. That works fine for `UsersModule` or `OrdersModule`, whose shape never changes between applications. But some modules need to be **configured by the consumer** at import time:

- A database module needs a connection string, host, and credentials that differ between environments.
- A config module needs to know which `.env` file to load, or whether to validate the loaded config against a schema.
- A logging module needs a minimum log level, and maybe a flag for whether to also ship logs to an external service.

A static `@Module()` has no mechanism for accepting arguments — you cannot write `imports: [LoggerModule({ level: 'debug' })]` against a plain class decorated with `@Module()`. This is exactly the gap **dynamic modules** fill: a module that exposes static factory methods (conventionally named `forRoot`, `forRootAsync`, or `forFeature`) which return a module definition *built at runtime* from the arguments passed in.

```
  Static module:                       Dynamic module:
  ┌───────────────────────┐            ┌────────────────────────────────┐
  │ @Module({ ... })       │            │ class LoggerModule {          │
  │ export class           │            │   static forRoot(options) {   │
  │   UsersModule {}        │            │     return { module: ...,     │
  │                        │            │              providers: [...],│
  │ Fixed metadata,        │            │              exports: [...] } │
  │ same every time it's   │            │   }                           │
  │ imported                │            │ }                              │
  └───────────────────────┘            │ Metadata built from `options` │
                                        │ passed by the consumer         │
                                        └────────────────────────────────┘
```

---

## 2. The DynamicModule Interface

A dynamic module is any object that satisfies Nest's `DynamicModule` interface, which extends the same shape `@Module()` accepts, plus a `module` property pointing back at the class itself:

```typescript
import { Type } from '@nestjs/common';

interface DynamicModule {
  module: Type<any>;             // the module class this metadata belongs to
  imports?: any[];
  controllers?: Type<any>[];
  providers?: Provider[];
  exports?: any[];
  global?: boolean;               // if true, behaves like @Global() (see Lesson 3)
}
```

Instead of decorating the class with static `@Module({...})` metadata, you give the class one or more **static methods** that return a `DynamicModule` object built from whatever arguments the caller passes in. Nest treats the return value of that static method exactly as if it were the module's `@Module()` metadata — it just computed it at runtime instead of at compile time.

```typescript
import { DynamicModule, Module } from '@nestjs/common';

@Module({}) // often left empty — the interesting metadata comes from the static method
export class ExampleModule {
  static forRoot(options: SomeOptions): DynamicModule {
    return {
      module: ExampleModule,
      providers: [{ provide: 'OPTIONS', useValue: options }, ExampleService],
      exports: [ExampleService],
    };
  }
}
```

Consumers then import it like a function call rather than a bare class reference:

```typescript
@Module({
  imports: [ExampleModule.forRoot({ apiKey: 'xyz' })],
})
export class AppModule {}
```

---

## 3. The forRoot() Convention

`forRoot()` is not a special Nest keyword — it is a **naming convention** the Nest ecosystem settled on for "configure this module once, application-wide." You will see it on `ConfigModule.forRoot()`, `TypeOrmModule.forRoot()`, `MongooseModule.forRoot()`, `ThrottlerModule.forRoot()`, and many third-party packages that follow the same idiom.

The defining characteristics of a `forRoot()`-style API:
- It is called **once**, almost always in the root `AppModule` (hence the name).
- It accepts a plain, synchronous options object.
- It typically registers the module as effectively singleton/global-ish configuration for the whole app (though it does not have to set `global: true` — `@nestjs/config`'s `ConfigModule.forRoot()` does, most others don't).

```typescript
// database/database.module.ts
import { DynamicModule, Module } from '@nestjs/common';
import { DATABASE_OPTIONS } from './database.constants';
import { DatabaseConnectionService } from './database-connection.service';

export interface DatabaseModuleOptions {
  host: string;
  port: number;
  database: string;
}

@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        { provide: DATABASE_OPTIONS, useValue: options },
        DatabaseConnectionService,
      ],
      exports: [DatabaseConnectionService],
    };
  }
}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    DatabaseModule.forRoot({
      host: 'localhost',
      port: 5432,
      database: 'app_production',
    }),
  ],
})
export class AppModule {}
```

---

## 4. The forRootAsync() Convention

`forRoot()` requires the options to be known synchronously at module-import time. But real applications frequently need to derive configuration from something asynchronous — most commonly, from `ConfigService` (itself provided by another dynamic module!) reading environment variables, or from a remote secrets manager. `forRootAsync()` is the conventional escape hatch, accepting a factory function (and its own dependencies) instead of a plain object.

```typescript
export interface DatabaseModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<DatabaseModuleOptions> | DatabaseModuleOptions;
}
```

```typescript
// database/database.module.ts (extended)
import { DynamicModule, Module } from '@nestjs/common';
import { DATABASE_OPTIONS } from './database.constants';
import { DatabaseConnectionService } from './database-connection.service';

@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        { provide: DATABASE_OPTIONS, useValue: options },
        DatabaseConnectionService,
      ],
      exports: [DatabaseConnectionService],
    };
  }

  static forRootAsync(options: DatabaseModuleAsyncOptions): DynamicModule {
    return {
      module: DatabaseModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: DATABASE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        DatabaseConnectionService,
      ],
      exports: [DatabaseConnectionService],
    };
  }
}
```

Consumed like this, mirroring exactly how `TypeOrmModule.forRootAsync()` is used in real projects:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        database: config.get<string>('DB_NAME', 'app'),
      }),
    }),
  ],
})
export class AppModule {}
```

The key mechanics: `useFactory` is invoked by Nest's DI container itself, so its parameters (`config: ConfigService`) are resolved via the `inject` array exactly like constructor injection — and because `ConfigService` lives in `ConfigModule`, that module must be re-imported into `imports` on the `forRootAsync()` call so the factory's dependencies are resolvable in that context.

---

## 5. The forFeature() Convention

Where `forRoot()`/`forRootAsync()` configure a module **once, globally**, `forFeature()` is the convention for registering **per-feature-module** pieces against configuration that was already set up by `forRoot()`. The canonical example is `@nestjs/typeorm`:

```typescript
// app.module.ts — forRoot() configures the ONE database connection, app-wide
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      // ...connection options
    }),
  ],
})
export class AppModule {}
```

```typescript
// users/users.module.ts — forFeature() registers THIS module's entities
// against the connection already configured by forRoot()
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

`TypeOrmModule.forFeature([User])` doesn't open a new database connection — it registers a `Repository<User>` provider (injectable via `@InjectRepository(User)`) scoped to `UsersModule`, wired against the connection `forRoot()` already established. This split exists precisely because of the module encapsulation model from Lesson 1: each feature module should only need to know about *its own* entities, not about the database connection details owned by the app root.

```
  forRoot()  → configures shared/global resources ONCE (connection, client, transport)
  forFeature() → registers PER-MODULE artifacts (entities, repositories, schemas)
                 against the resource forRoot() already set up

  AppModule
    └─ TypeOrmModule.forRoot({ ...connection... })
         │
         ├─ UsersModule
         │    └─ TypeOrmModule.forFeature([User])  → Repository<User>
         │
         └─ OrdersModule
              └─ TypeOrmModule.forFeature([Order]) → Repository<Order>
```

---

## 6. Building a Custom Dynamic Module From Scratch

Here is the general recipe, independent of any specific library:

1. Define an **options interface** describing what the consumer can configure.
2. Define **injection tokens** (usually a `Symbol` or string constant) for anything you'll provide via `useValue`/`useFactory`, since interfaces don't exist at runtime and can't be used as DI tokens.
3. Give the module class a static `forRoot(options)` method (and optionally `forRootAsync()`) that returns a `DynamicModule` object.
4. Inside that object, provide the options under your token, and any services that depend on those options via constructor injection of the token.
5. `export` the services consumers need, exactly as with a static module.

```typescript
// mailer/mailer.constants.ts
export const MAILER_OPTIONS = Symbol('MAILER_OPTIONS');
```

```typescript
// mailer/mailer-options.interface.ts
export interface MailerModuleOptions {
  fromAddress: string;
  transport: 'smtp' | 'ses';
}
```

```typescript
// mailer/mailer.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { MAILER_OPTIONS } from './mailer.constants';
import { MailerModuleOptions } from './mailer-options.interface';

@Injectable()
export class MailerService {
  constructor(
    @Inject(MAILER_OPTIONS) private readonly options: MailerModuleOptions,
  ) {}

  send(to: string, subject: string): void {
    console.log(
      `[${this.options.transport}] From ${this.options.fromAddress} to ${to}: ${subject}`,
    );
  }
}
```

```typescript
// mailer/mailer.module.ts
import { DynamicModule, Module } from '@nestjs/common';
import { MAILER_OPTIONS } from './mailer.constants';
import { MailerModuleOptions } from './mailer-options.interface';
import { MailerService } from './mailer.service';

@Module({})
export class MailerModule {
  static forRoot(options: MailerModuleOptions): DynamicModule {
    return {
      module: MailerModule,
      providers: [
        { provide: MAILER_OPTIONS, useValue: options },
        MailerService,
      ],
      exports: [MailerService],
    };
  }
}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { MailerModule } from './mailer/mailer.module';

@Module({
  imports: [
    MailerModule.forRoot({ fromAddress: 'no-reply@example.com', transport: 'smtp' }),
  ],
})
export class AppModule {}
```

---

## 7. Worked Example — A Configurable LoggerModule

Putting the full pattern together — `forRoot()`, an injection token, and a service that reads its own configuration — for a `LoggerModule` that accepts a minimum log level:

```typescript
// logger/logger.constants.ts
export const LOGGER_OPTIONS = Symbol('LOGGER_OPTIONS');

export enum LogLevel {
  debug = 0,
  info = 1,
  warn = 2,
  error = 3,
}
```

```typescript
// logger/logger-options.interface.ts
import { LogLevel } from './logger.constants';

export interface LoggerModuleOptions {
  level: keyof typeof LogLevel;
}
```

```typescript
// logger/logger.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_OPTIONS, LogLevel } from './logger.constants';
import { LoggerModuleOptions } from './logger-options.interface';

@Injectable()
export class LoggerService {
  private readonly minLevel: LogLevel;

  constructor(@Inject(LOGGER_OPTIONS) options: LoggerModuleOptions) {
    this.minLevel = LogLevel[options.level];
  }

  private write(level: LogLevel, label: string, message: string): void {
    if (level < this.minLevel) return;
    console.log(`[${label.toUpperCase()}] ${message}`);
  }

  debug(message: string): void {
    this.write(LogLevel.debug, 'debug', message);
  }

  info(message: string): void {
    this.write(LogLevel.info, 'info', message);
  }

  warn(message: string): void {
    this.write(LogLevel.warn, 'warn', message);
  }

  error(message: string): void {
    this.write(LogLevel.error, 'error', message);
  }
}
```

```typescript
// logger/logger.module.ts
import { DynamicModule, Module } from '@nestjs/common';
import { LOGGER_OPTIONS } from './logger.constants';
import { LoggerModuleOptions } from './logger-options.interface';
import { LoggerService } from './logger.service';

@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions): DynamicModule {
    return {
      module: LoggerModule,
      providers: [
        { provide: LOGGER_OPTIONS, useValue: options },
        LoggerService,
      ],
      exports: [LoggerService],
    };
  }
}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { LoggerModule } from './logger/logger.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    LoggerModule.forRoot({ level: 'debug' }), // in production you'd likely pass 'warn' or 'error'
    UsersModule,
  ],
})
export class AppModule {}
```

```typescript
// users/users.service.ts (consuming the configured LoggerService)
import { Injectable } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class UsersService {
  constructor(private readonly logger: LoggerService) {}

  create(email: string) {
    this.logger.debug(`Creating user with email ${email}`);
    // ... creation logic
  }
}
```

Because `LoggerModule.forRoot({ level: 'debug' })` was called only in `AppModule`, every module that imports `LoggerModule` (bare, without calling `forRoot()` again) receives the same configured `LoggerService` singleton — you configure once, consume everywhere.

---

## 8. How @nestjs/config and @nestjs/typeorm Use This Pattern

- **`@nestjs/config`**: `ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })` loads and validates environment variables once, and — unusually — sets `global: true` internally so `ConfigService` doesn't need to be re-imported into every feature module. `ConfigModule.forRootAsync()` also exists for cases where the env file path itself must be derived dynamically.
- **`@nestjs/typeorm`**: `TypeOrmModule.forRoot(options)` (or `forRootAsync`) opens the single database connection for the whole app in `AppModule`. Every feature module then calls `TypeOrmModule.forFeature([Entity1, Entity2])` to get `Repository<Entity>` providers for its own entities, injectable via `@InjectRepository(Entity1)`.
- **`@nestjs/mongoose`**: follows the identical shape — `MongooseModule.forRoot(uri)` app-wide, `MongooseModule.forFeature([{ name: Cat.name, schema: CatSchema }])` per feature module.
- **`@nestjs/bull` / `@nestjs/microservices` client registration**: also lean on `registerAsync()`/`forRootAsync()`-style factories for the same reason — connection details often come from `ConfigService`, which is itself async-resolved.

The pattern is consistent enough across the ecosystem that recognizing "`forRoot` = configure once app-wide, `forFeature` = register this module's slice against that shared resource" transfers directly to any third-party dynamic module you encounter.

---

## 9. Common Pitfalls

- **Calling `forRoot()` more than once for a connection-style resource.** Calling `TypeOrmModule.forRoot()` in more than one module typically tries to open a second connection, which is rarely what you want — `forRoot()` is meant to be called exactly once, in the composition root.
- **Using an interface directly as a DI token.** TypeScript interfaces are erased at compile time; `@Inject(SomeOptionsInterface)` does not work. You must provide a concrete token — a string, a `Symbol`, or an injectable class — and inject via that token.
- **Forgetting to re-import dependency modules in `forRootAsync()`'s `imports`.** If your `useFactory` injects `ConfigService`, but you forget to add `imports: [ConfigModule]` inside the `forRootAsync()` call itself, Nest cannot resolve `ConfigService` at that point in the graph even if `ConfigModule` is imported elsewhere in the app.
- **Confusing `forFeature()` with a second `forRoot()`.** `forFeature()` is meant to register lightweight, per-module artifacts against configuration a `forRoot()` already established — it should not re-specify connection details.
- **Making the dynamic module's own `@Module({})` decorator non-empty when it doesn't need to be.** If the static factory method supplies all the real metadata, leaving stray `providers`/`exports` on the class-level decorator creates confusion about which providers exist unconditionally versus only when `forRoot()` is called.
- **Not exporting the constructed provider.** Just like static modules, a dynamic module's returned `DynamicModule` object still needs an `exports` array — it's easy to forget when hand-building the returned object literal.

---

## 10. Best Practices

- Name your static factory methods `forRoot()`, `forRootAsync()`, and `forFeature()` to match ecosystem convention — even for fully custom modules, this makes your API instantly recognizable to any Nest developer.
- Always provide a `forRootAsync()` variant alongside `forRoot()` for any module whose configuration might plausibly come from `ConfigService`, a secrets manager, or another async source.
- Use a `Symbol` (not a bare string) for options injection tokens to guarantee uniqueness and avoid accidental collisions with other libraries' string tokens.
- Keep the options interface and the injection token in their own small files (e.g. `*.constants.ts`, `*-options.interface.ts`) so they can be imported independently of the module class itself.
- Validate options early — throw a clear error inside `forRoot()` if required fields are missing, rather than letting a cryptic failure surface later inside the service.
- Reserve `forFeature()` for genuinely per-consumer-module registration; if a piece of configuration is truly global and singleton, it belongs in `forRoot()`, not repeated via `forFeature()` calls.

---

## 11. Hands-On Exercises

**Exercise 1:** Build a `CacheModule` with a `forRoot({ ttlSeconds: number })` static method that provides a `CacheService` with a configurable default TTL. Import it once in `AppModule` and inject `CacheService` into two different feature modules, confirming both receive the same configured instance.

**Exercise 2:** Add a `forRootAsync()` variant to the `CacheModule` from Exercise 1 that derives `ttlSeconds` from a (mocked) `ConfigService`, following the `imports`/`inject`/`useFactory` shape shown in section 4. Verify it resolves correctly when `ConfigModule` is imported inside the `forRootAsync()` call's own `imports` array, and reproduce the resolution error when you remove that import.

**Exercise 3:** Implement a minimal `forFeature()`-style API for a fictional `EventStoreModule`: `EventStoreModule.forRoot({ connectionString })` configures a shared connection-like service once in `AppModule`, and `EventStoreModule.forFeature(['OrderCreated', 'OrderShipped'])` registers per-module event-name constants as an injectable provider inside a feature module.

**Exercise 4:** Take the `LoggerModule.forRoot({ level: 'debug' })` example from section 7 and extend the options interface to also accept an optional `prefix: string` that gets prepended to every log line. Update `LoggerService`'s constructor and `write()` method accordingly, and confirm two feature modules using the same `forRoot()`-configured logger both show the prefix.

**Exercise 5:** Deliberately misuse an interface as an injection token (`@Inject(LoggerModuleOptions)` instead of `@Inject(LOGGER_OPTIONS)`) to reproduce the TypeScript/runtime error this causes, then fix it by switching back to the `Symbol` token. Write one sentence explaining, in your own words, why interfaces cannot serve as DI tokens.

---

## 12. Interview Q&A

**Q: What is a dynamic module in NestJS, and how does it differ from a regular static module?**
Answer: A dynamic module is a module whose `@Module()`-equivalent metadata (`imports`, `controllers`, `providers`, `exports`) is computed at runtime by a static factory method — conventionally `forRoot()`, `forRootAsync()`, or `forFeature()` — rather than being fixed at compile time in the `@Module()` decorator. It implements Nest's `DynamicModule` interface, which is the same shape as static module metadata plus a `module` property referencing the class itself. This lets a module accept configuration options (connection strings, log levels, feature flags) supplied by the consumer at import time, which a plain static `@Module({...})` class cannot do.

**Q: Why can't you just pass configuration directly into a module's constructor instead of using `forRoot()`?**
Answer: Nest modules aren't instantiated by application code directly — the Nest IoC container instantiates them as part of building the dependency graph, and a module class has no constructor arguments a developer controls at the `imports: []` call site. `forRoot()` sidesteps this by being a plain static method invoked directly in the `imports` array (e.g., `imports: [FooModule.forRoot({...})]`), returning a `DynamicModule` object where the options have already been baked into a provider (typically via `useValue` against a dedicated injection token) that the module's own services can then inject.

**Q: What is the difference between `forRoot()` and `forRootAsync()`?**
Answer: `forRoot()` accepts a plain, synchronously-available options object — used when configuration is known immediately at import time. `forRootAsync()` accepts a factory-based options object instead (`useFactory`, plus `inject` for the factory's own dependencies, and often its own `imports`) so the configuration can be derived asynchronously or from another injectable, most commonly `ConfigService` reading environment variables. Under the hood, `forRootAsync()` typically registers the options provider with `useFactory`/`inject` instead of `useValue`, letting Nest's DI container resolve the factory's dependencies before invoking it.

**Q: What problem does `forFeature()` solve that `forRoot()` doesn't, using TypeORM as an example?**
Answer: `forRoot()` configures a single, shared, application-wide resource once — for TypeORM, that's the database connection, set up in `AppModule`. `forFeature()` is called separately inside each feature module (e.g., `TypeOrmModule.forFeature([User])` in `UsersModule`) to register that module's own entities against the connection already established by `forRoot()`, producing scoped `Repository<Entity>` providers. This split respects module encapsulation — a feature module should know about its own entities, not about how or where the database connection was configured.

**Q: Why must you use a `Symbol` or string token instead of an interface type when injecting configuration options in a dynamic module?**
Answer: TypeScript interfaces exist only at compile time and are completely erased from the emitted JavaScript, so there is nothing for Nest's runtime reflection-based DI container to look up if you tried to use an interface as an `@Inject()` token. Instead, dynamic modules define a concrete runtime value — conventionally a `Symbol` (to guarantee uniqueness and avoid collisions with other libraries) or a string constant — provide the options object against that token with `useValue` (or `useFactory` for the async variant), and consumers inject via `@Inject(TOKEN)` while still typing the parameter as the original interface for compile-time safety.

**Q: If two different feature modules both import a dynamic module without calling `forRoot()` again — just `imports: [LoggerModule]` — do they get separately configured instances?**
Answer: No — as long as `forRoot()` was called once somewhere in the module graph (typically `AppModule`) and the module isn't re-invoked with different options elsewhere, all consumers importing the bare module class receive the same configured providers, because Nest's module registry deduplicates by module reference and the options were already baked in via `useValue`/`useFactory` at that first `forRoot()` call. Calling `forRoot()` a second time with different options in another module, however, would generally create a distinct module registration with its own instance of the options-dependent providers — which is why `forRoot()`-style APIs are conventionally called exactly once, in the composition root.
