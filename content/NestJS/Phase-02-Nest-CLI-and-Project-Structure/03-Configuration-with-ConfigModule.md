# Configuration with @nestjs/config — ConfigModule, Env Files, and Validation — Complete Guide

## Table of Contents
1. [Why Configuration Needs Its Own Module](#1-why-configuration-needs-its-own-module)
2. [Installing @nestjs/config](#2-installing-nestjsconfig)
3. [ConfigModule.forRoot() Basics](#3-configmoduleforroot-basics)
4. [Environment-Specific .env Files](#4-environment-specific-env-files)
5. [Injecting and Using ConfigService](#5-injecting-and-using-configservice)
6. [Namespaced Configuration with registerAs](#6-namespaced-configuration-with-registeras)
7. [Validation with Joi](#7-validation-with-joi)
8. [Validation with class-validator](#8-validation-with-class-validator)
9. [Worked Example — A Strongly-Typed AppConfig](#9-worked-example--a-strongly-typed-appconfig)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Why Configuration Needs Its Own Module

Every non-trivial application needs values that change between environments — database URLs, API keys, feature flags, port numbers — without changing code. Reading `process.env.X` directly scattered across the codebase works for a toy app but creates real problems at scale:

```
  Scattered process.env.X                 Centralized ConfigModule
  ─────────────────────────                ────────────────────────
  No single place to see all config       One place lists every setting
  Typos in env var names fail silently    Validated at startup — fails fast
  No type safety (always string|undefined) Typed accessors via generics
  Hard to mock in tests                   Trivially overridden in test modules
  No default values without repeating     Centralized defaults + validation
  yourself in every file                  schema
```

`@nestjs/config` is NestJS's official wrapper around `dotenv` that turns environment variables into a first-class, injectable, validated configuration source — a `ConfigService` provider you inject anywhere in the DI graph, exactly like any other service.

---

## 2. Installing @nestjs/config

```bash
npm install @nestjs/config
```

For schema validation, you additionally install either `joi` (a general-purpose schema validator commonly used with `@nestjs/config`) or lean on `class-validator`/`class-transformer` (already idiomatic in Nest for DTOs) if you prefer typed configuration classes instead of a plain schema object:

```bash
# Option A: Joi-based validation
npm install joi

# Option B: class-validator-based validation
npm install class-validator class-transformer
```

---

## 3. ConfigModule.forRoot() Basics

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // makes ConfigService injectable everywhere without re-importing
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

By default, `ConfigModule.forRoot()` looks for a `.env` file at the project root, parses it with `dotenv`, and merges its keys into `process.env` (existing `process.env` values always take priority over `.env` file values, which matters in CI/production where real environment variables are injected by the platform rather than a file).

```bash
# .env
PORT=3000
DATABASE_URL=postgres://user:pass@localhost:5432/app_dev
JWT_SECRET=dev-only-secret-change-me
```

Without `isGlobal: true`, every feature module that wants to inject `ConfigService` would need to import `ConfigModule` itself — `isGlobal: true` is the standard choice for application-wide settings, since environment configuration is almost always needed broadly.

---

## 4. Environment-Specific .env Files

Real projects need different values per environment (local dev, test, staging, production) without hardcoding an environment name into the config module import. `@nestjs/config` supports selecting a file based on `NODE_ENV`:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: !process.env.NODE_ENV
    ? '.env'
    : `.env.${process.env.NODE_ENV}`,
});
```

```
project-root/
├── .env                 ← local development defaults (gitignored)
├── .env.test             ← used when NODE_ENV=test (e.g., CI test runs)
├── .env.staging           ← used when NODE_ENV=staging
├── .env.production        ← used when NODE_ENV=production (often values injected
│                            by the platform instead of a committed file)
└── .env.example           ← committed template listing required keys with no
                             real secrets, for onboarding new developers
```

`envFilePath` also accepts an array, letting you layer a base file with an environment-specific override — later files in the array win over earlier ones for the same key:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: ['.env.local', `.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
});
```

Actual secrets (database passwords, JWT signing keys, third-party API keys) should never be committed to `.env` files that get checked into git — `.env` is conventionally gitignored, and only `.env.example` (with placeholder or empty values) is tracked, so new developers know which variables they must supply.

---

## 5. Injecting and Using ConfigService

Once `ConfigModule` is registered (globally or imported into a feature module), inject `ConfigService` into any provider or controller constructor exactly like any other Nest provider.

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService {
  private readonly connectionString: string;

  constructor(private readonly configService: ConfigService) {
    // get() returns `string | undefined` by default — provide a fallback
    // or use the generic form below for stronger typing
    this.connectionString = this.configService.get<string>('DATABASE_URL', {
      infer: true,
    })!;
  }
}
```

```typescript
// Reading with a default value if the key is missing
const port = configService.get<number>('PORT', 3000);

// Reading a required value and asserting it exists
const jwtSecret = configService.getOrThrow<string>('JWT_SECRET');
// getOrThrow() throws immediately if the key is undefined — preferred for
// values the application cannot run without
```

`ConfigService.get()` returning `string | undefined` for everything is the main pain point of using it against raw environment variable keys — the next two sections (`registerAs` and validation) address both the "everything is a string" and "I only find out a variable is missing at runtime" problems.

---

## 6. Namespaced Configuration with registerAs

`registerAs` groups related configuration values under a namespace, producing a typed factory function instead of scattering flat string keys everywhere.

```typescript
// config/database.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  name: process.env.DATABASE_NAME ?? 'app_dev',
}));
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig], // registers the namespaced factory
    }),
  ],
})
export class AppModule {}
```

```typescript
// database.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigType } from '@nestjs/config';
import databaseConfig from './config/database.config';

@Injectable()
export class DatabaseService {
  constructor(
    // ConfigType<typeof databaseConfig> gives you the exact inferred shape
    // of the object returned by the factory — full type safety, no `get<T>` casts
    @Inject(databaseConfig.KEY)
    private readonly dbConfig: ConfigType<typeof databaseConfig>,
  ) {
    console.log(this.dbConfig.host, this.dbConfig.port); // fully typed
  }
}
```

Namespacing this way is the recommended middle ground between raw `configService.get('SOME_ENV_VAR')` calls (untyped, stringly-keyed) and building a completely separate configuration system — you get grouped, typed, injectable configuration slices per concern (database, auth, mail, redis, etc.).

---

## 7. Validation with Joi

Without validation, a missing or malformed environment variable is discovered only when the code that reads it finally runs — potentially deep into a request, in production. `@nestjs/config` supports validating the entire parsed environment at bootstrap time using a Joi schema, so the application refuses to start if configuration is invalid.

```typescript
// config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  CORS_ORIGINS: Joi.string().optional(),
});
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true, // don't fail on extra env vars the OS/CI injects
        abortEarly: false,  // report every validation error at once, not just the first
      },
    }),
  ],
})
export class AppModule {}
```

If `DATABASE_URL` is missing or `JWT_SECRET` is shorter than 32 characters, `NestFactory.create()` throws immediately during bootstrap:

```
Error: Config validation error: "DATABASE_URL" is required, "JWT_SECRET" length must be at least 32 characters long
```

This is exactly the fail-fast behavior you want — a misconfigured deployment crashes on startup with a clear message, instead of surfacing as a confusing runtime error (or worse, a silent security issue like an empty JWT secret) once real traffic arrives.

---

## 8. Validation with class-validator

An alternative to a Joi schema object is a plain TypeScript class annotated with `class-validator` decorators, validated via a custom `validate` function passed to `ConfigModule.forRoot()`. This approach keeps configuration validation in the same style as DTO validation elsewhere in a Nest app.

```typescript
// config/env.validation.ts
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  Min,
  Max,
  MinLength,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Test = 'test',
  Staging = 'staging',
  Production = 'production',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(0)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true, // "3000" (string) → 3000 (number) for @IsInt fields
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate, // called once with process.env at bootstrap time
    }),
  ],
})
export class AppModule {}
```

Both approaches (Joi schema vs `class-validator` class) achieve the same fail-fast goal — pick whichever matches your team's existing validation style. Joi is a slightly smaller, more declarative option when configuration validation is all you need; `class-validator` is a natural fit for teams already leaning on it heavily for DTOs and who want the *type itself* (`EnvironmentVariables`) to double as documentation of every setting the app requires.

---

## 9. Worked Example — A Strongly-Typed AppConfig

This example combines namespacing (`registerAs`), Joi validation, and a single strongly-typed `AppConfig` shape that the rest of the application depends on — the pattern most production Nest apps converge on.

```typescript
// config/app.config.ts
import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  environment: 'development' | 'test' | 'staging' | 'production';
  database: {
    url: string;
    poolSize: number;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
  };
  cors: {
    origins: string[];
  };
}

export default registerAs('app', (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  environment: (process.env.NODE_ENV as AppConfig['environment']) ?? 'development',
  database: {
    url: process.env.DATABASE_URL ?? '',
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE ?? '10', 10),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
  },
}));
```

```typescript
// config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  DATABASE_POOL_SIZE: Joi.number().integer().min(1).max(100).default(10),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  CORS_ORIGINS: Joi.string().allow('').optional(),
});
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import { envValidationSchema } from './config/env.validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: !process.env.NODE_ENV
        ? '.env'
        : `.env.${process.env.NODE_ENV}`,
      load: [appConfig],
      validationSchema: envValidationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

```typescript
// app.service.ts — consuming the typed config elsewhere in the app
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import appConfig from './config/app.config';

@Injectable()
export class AppService {
  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  getConnectionSummary(): string {
    // Fully typed — config.database.url, config.auth.jwtExpiresIn, etc.
    // all have compiler-checked types, no `get<string>()` casts anywhere
    return `Running in ${this.config.environment} on port ${this.config.port}, ` +
      `pool size ${this.config.database.poolSize}`;
  }
}
```

```typescript
// main.ts — bootstrap also benefits from the typed config
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const config = configService.get<AppConfig>('app')!;

  app.enableCors({ origin: config.cors.origins, credentials: true });
  await app.listen(config.port);
}
bootstrap();
```

This structure gives every part of the application — bootstrap code, services, controllers — access to the same validated, typed `AppConfig` shape, with the actual `process.env` parsing and defaulting logic centralized in exactly one file (`app.config.ts`) and the validity of the environment guaranteed by Joi before any of that code runs.

---

## 10. Common Pitfalls

- **Reading `process.env.X` directly in feature code alongside `ConfigService`.** This defeats the purpose of centralizing configuration — every environment variable read should go through `ConfigService` (or a namespaced config object) so validation and defaulting apply uniformly.
- **Forgetting `isGlobal: true` and re-importing `ConfigModule` inconsistently.** Without it, every feature module that injects `ConfigService` must explicitly `imports: [ConfigModule]`, and it's easy to forget in a newly generated module, producing a confusing "cannot resolve dependency" DI error.
- **Assuming `ConfigService.get<number>('PORT')` returns an actual number.** By default it returns whatever type the environment variable naturally is — a string — unless you configure `ConfigModule` with numeric parsing or read from a `registerAs` factory that does `parseInt` itself. The generic type parameter on `.get<T>()` only affects the TypeScript type, not runtime coercion.
- **Committing real secrets in a tracked `.env` file.** `.env` should be gitignored; only `.env.example` (with placeholder values) belongs in version control. A leaked `JWT_SECRET` or database password in git history is a security incident.
- **Not validating configuration at all, and discovering a missing variable in production only when the code path that uses it finally executes.** This is the exact failure mode `validationSchema`/`validate` prevents — validate everything the app depends on at bootstrap, not lazily at first use.
- **Relying on `process.env` values already being set before `.env` file is parsed, without understanding priority.** `@nestjs/config` gives real `process.env` variables priority over `.env` file values by default — this is usually what you want (platform-injected production secrets should win over an accidentally-deployed `.env` file), but it can surprise developers who expect the `.env` file to always take effect.

---

## 11. Best Practices

- Always set `isGlobal: true` on `ConfigModule.forRoot()` in the root module unless you have a specific reason to scope configuration to particular feature modules.
- Validate configuration at bootstrap with either a Joi schema or a `class-validator` class — never let a Nest app start with configuration it cannot actually run on.
- Group related settings with `registerAs` (database, auth, mail, redis, etc.) instead of scattering flat string keys through `configService.get('SOME_KEY')` calls across the codebase.
- Maintain a committed `.env.example` documenting every environment variable the application needs, with placeholder (non-secret) values, so new developers and CI pipelines know exactly what to configure.
- Prefer `getOrThrow()` over `get()` with a non-null assertion (`!`) for values the application genuinely cannot function without — it fails with a clearer error message at the point of use.
- Keep `.env`, `.env.local`, `.env.*.local` in `.gitignore`; never commit real secrets, and rotate any secret that is accidentally committed.

---

## 12. Hands-On Exercises

**Exercise 1:** Install `@nestjs/config` in a scaffolded Nest project. Add `ConfigModule.forRoot({ isGlobal: true })` to `AppModule`. Create a `.env` file with a `GREETING` variable, inject `ConfigService` into `AppService`, and change `getHello()` to return the value of `GREETING` from the environment instead of a hardcoded string.

**Exercise 2:** Create `.env.development` and `.env.production` files with different `PORT` values. Configure `envFilePath` to select the file based on `NODE_ENV`. Run the app with `NODE_ENV=development npm run start:dev` and then `NODE_ENV=production node dist/main.js` (after building) and confirm each picks up its respective port.

**Exercise 3:** Install `joi` and write a validation schema requiring `DATABASE_URL` (a valid URI) and `JWT_SECRET` (minimum 32 characters). Wire it into `ConfigModule.forRoot({ validationSchema })`. Remove `DATABASE_URL` from your `.env` file entirely and confirm the application refuses to start, printing a clear validation error naming the missing variable. Add it back and confirm normal startup.

**Exercise 4:** Create a `registerAs('database', () => ({...}))` factory grouping `host`, `port`, and `name` fields parsed from environment variables. Inject it into a `DatabaseService` using `@Inject(databaseConfig.KEY)` and `ConfigType<typeof databaseConfig>`, and log the fully-typed config object at startup. Confirm your editor gives you autocomplete on `dbConfig.host` without any manual type assertions.

**Exercise 5:** Build the full `AppConfig` pattern from the worked example in this lesson: a typed `AppConfig` interface, a `registerAs('app', ...)` factory implementing it, a Joi validation schema covering every field, and a `main.ts` that reads the typed config via `configService.get<AppConfig>('app')` to configure CORS and the listen port. Deliberately set `JWT_SECRET` to a 10-character string in `.env` and confirm bootstrap fails with a validation error before the server ever starts listening.

---

## 13. Interview Q&A

**Q: What problem does `@nestjs/config` solve that reading `process.env` directly does not?**
Answer: Reading `process.env` directly scatters untyped, unvalidated string lookups throughout a codebase — every read can silently return `undefined` on a typo or missing variable, with no single place documenting what configuration the app actually needs, and no way to catch a missing required value before the code path that uses it executes at runtime. `@nestjs/config` centralizes environment loading through `ConfigModule`, exposes it as an injectable `ConfigService` (or typed namespaced objects via `registerAs`) that fits naturally into Nest's DI container, and — critically — supports schema validation at bootstrap time so a misconfigured deployment fails immediately and loudly rather than producing confusing runtime errors or security gaps later.

**Q: What does `isGlobal: true` do in `ConfigModule.forRoot()`, and when would you omit it?**
Answer: `isGlobal: true` registers `ConfigModule` as a global module, meaning `ConfigService` (and any `registerAs` namespaces loaded into it) becomes injectable in any provider throughout the application without that module needing to explicitly `imports: [ConfigModule]`. Most applications set it because environment configuration is needed broadly across many feature modules. You would omit it only if you deliberately want configuration scoped to specific modules — for example, a plugin or library module that manages its own isolated configuration namespace and shouldn't leak into the rest of the application's DI graph.

**Q: How do you make configuration in NestJS fail fast on startup instead of failing at request time?**
Answer: By passing a `validationSchema` (a Joi object schema) or a `validate` function (typically built with `class-validator`/`class-transformer` validating a typed class) to `ConfigModule.forRoot()`. Either mechanism runs once, synchronously, against the fully merged `process.env` during `NestFactory.create()` — before any controller or provider is instantiated — and throws if required variables are missing or malformed. This turns a class of bugs that would otherwise only surface when a specific code path finally reads the bad/missing variable (potentially in production, under real traffic) into an immediate, clearly-messaged startup crash.

**Q: What is `registerAs` and why would you use it instead of calling `configService.get()` everywhere?**
Answer: `registerAs(namespace, factory)` creates a typed configuration "slice" — a named factory function whose return value's shape TypeScript can infer — that gets loaded into `ConfigModule` via the `load` array. Instead of calling `configService.get<string>('DATABASE_URL')` (untyped-by-default, one flat string key at a time) throughout the codebase, you inject the whole namespaced object with `@Inject(databaseConfig.KEY)` typed as `ConfigType<typeof databaseConfig>`, getting full property-level type safety and autocomplete, plus a natural grouping of related settings (e.g., all database settings together) instead of scattered flat keys.

**Q: What is the precedence between a real `process.env` variable and the same key defined in a `.env` file loaded by `ConfigModule`?**
Answer: By default, `@nestjs/config` gives priority to variables already present in `process.env` over the same key parsed from a `.env` file — the `.env` file only fills in values that are not already set. This matters in deployed environments where the platform (Docker, Kubernetes, a PaaS) injects real environment variables directly; those should win over any `.env` file that might accidentally be present in a built image, so production secrets and settings are never silently overridden by a stale or leftover configuration file.

**Q: Joi schema validation vs a `class-validator`-decorated configuration class — what's the practical difference?**
Answer: Both run once at bootstrap against the parsed environment and both fail startup on invalid configuration, so functionally they achieve the same fail-fast goal. A Joi schema is a compact, declarative object describing constraints (`Joi.string().uri().required()`) without needing a separate TypeScript class, making it slightly less code for simple cases. A `class-validator` class instead defines an actual typed `EnvironmentVariables` class with decorators like `@IsInt()`/`@MinLength(32)`, which doubles as living documentation of every configuration value the app expects and fits teams that already validate DTOs the same way elsewhere in the app — the tradeoff is mostly stylistic consistency with the rest of the codebase rather than a functional difference.
