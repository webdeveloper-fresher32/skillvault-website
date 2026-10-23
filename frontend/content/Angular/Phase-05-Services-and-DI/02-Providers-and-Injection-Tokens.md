# Providers and Injection Tokens — Complete Guide

## Table of Contents
1. [What is a Provider?](#1-what-is-a-provider)
2. [useClass](#2-useclass)
3. [useValue](#3-usevalue)
4. [useFactory](#4-usefactory)
5. [useExisting](#5-useexisting)
6. [InjectionToken for Non-Class Dependencies](#6-injectiontoken-for-non-class-dependencies)
7. [Multi-Providers](#7-multi-providers)
8. [Worked Example: Token-Based Config Service](#8-worked-example-token-based-config-service)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. What is a Provider?

A **provider** is a recipe that tells Angular's injector how to create a value for a given token. `@Injectable({ providedIn: 'root' })` is shorthand for the simplest possible provider — "when asked for `X`, `new X()`." Angular actually supports four distinct provider shapes, each answering the question differently:

```
Token requested  ──▶  Injector looks up provider recipe  ──▶  Value produced
                                                                (cached after first creation)
```

| Provider shape | Answers | Typical use |
|---|---|---|
| `useClass` | "Build it from this other class" | Swap real/mock implementations |
| `useValue` | "Here's the literal value, don't build anything" | Constants, config objects |
| `useFactory` | "Run this function to produce it" | Values needing runtime logic or other injected deps |
| `useExisting` | "It's an alias for this other token" | Backward-compatible renames, interface aliasing |

Providers are registered in the `providers` array of a component/route, or via `bootstrapApplication`'s `providers` array for app-wide registration.

---

## 2. useClass

Substitutes a different class implementation for a token, without changing any consuming code.

```typescript
// logger.service.ts
export abstract class Logger {
  abstract log(msg: string): void;
}

@Injectable()
export class ConsoleLogger extends Logger {
  log(msg: string) { console.log(`[CONSOLE] ${msg}`); }
}

@Injectable()
export class RemoteLogger extends Logger {
  log(msg: string) {
    // send to a logging backend instead of the console
    fetch('/api/logs', { method: 'POST', body: msg });
  }
}
```

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: Logger, useClass: environment.production ? RemoteLogger : ConsoleLogger }
  ]
};
```

Any service that injects `Logger` gets whichever implementation was configured — the consuming code never mentions `ConsoleLogger` or `RemoteLogger` directly.

```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private logger: Logger) {} // doesn't know or care which impl
}
```

---

## 3. useValue

Supplies a plain object or primitive directly — no constructor is called, no class is instantiated.

```typescript
export interface AppConfig {
  apiUrl: string;
  enableAnalytics: boolean;
  maxRetries: number;
}

export const APP_CONFIG: AppConfig = {
  apiUrl: 'https://api.example.com',
  enableAnalytics: true,
  maxRetries: 3
};
```

```typescript
providers: [
  { provide: AppConfig, useValue: APP_CONFIG }
]
```

`useValue` is ideal for feature flags, environment constants, and mock objects in tests:

```typescript
// in a spec file
TestBed.configureTestingModule({
  providers: [
    { provide: UserService, useValue: { getUsers: () => [{ id: 1, name: 'Test User' }] } }
  ]
});
```

Note: `AppConfig` above is an interface, so `{ provide: AppConfig, ... }` won't actually compile as written — this is exactly the problem `InjectionToken` solves (Section 6).

---

## 4. useFactory

Runs a function to compute the value at injection time — the only provider type that lets you run arbitrary logic and, if needed, pull in other injected dependencies via `deps`.

```typescript
export function loggerFactory(platformId: object): Logger {
  return isPlatformBrowser(platformId) ? new ConsoleLogger() : new RemoteLogger();
}

providers: [
  {
    provide: Logger,
    useFactory: loggerFactory,
    deps: [PLATFORM_ID] // dependencies injected into the factory function, in order
  }
]
```

Another common case — building a service that depends on runtime environment values:

```typescript
export function apiClientFactory(http: HttpClient, config: AppConfig): ApiClient {
  return new ApiClient(http, config.apiUrl, config.maxRetries);
}

providers: [
  {
    provide: ApiClient,
    useFactory: apiClientFactory,
    deps: [HttpClient, APP_CONFIG_TOKEN]
  }
]
```

`useFactory` is the escape hatch whenever construction logic is more than "just call `new`" — conditional class selection, reading from `localStorage`, wrapping a third-party SDK, etc.

---

## 5. useExisting

Creates an alias — two tokens resolve to the **exact same instance** rather than two separate instances.

```typescript
@Injectable({ providedIn: 'root' })
export class NewLoggerService {
  log(msg: string) { console.log(`[NEW] ${msg}`); }
}

// Deprecated name kept for backward compatibility with old code
export abstract class OldLoggerService {}

providers: [
  NewLoggerService,
  { provide: OldLoggerService, useExisting: NewLoggerService }
]
```

Any code still injecting `OldLoggerService` receives the very same singleton instance as code injecting `NewLoggerService` — there's only one object in memory, just reachable via two tokens. Compare this to `useClass`, which would construct a **second, separate** instance:

```typescript
// useExisting: ONE instance, two tokens pointing at it
{ provide: OldLoggerService, useExisting: NewLoggerService }

// useClass: TWO instances — NewLoggerService's own instance, and a fresh
// OldLoggerService instance built by calling `new NewLoggerService()` again
{ provide: OldLoggerService, useClass: NewLoggerService }
```

---

## 6. InjectionToken for Non-Class Dependencies

Interfaces, plain object shapes, strings, and primitive config values have no runtime representation, so they can't be used as a DI token directly (`{ provide: AppConfig, ... }` from Section 3 doesn't actually work if `AppConfig` is an interface). `InjectionToken` creates a unique, dedicated runtime token to stand in for that value.

```typescript
// app-config.token.ts
import { InjectionToken } from '@angular/core';

export interface AppConfig {
  apiUrl: string;
  enableAnalytics: boolean;
  maxRetries: number;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('app.config');
```

```typescript
// app.config.ts
providers: [
  {
    provide: APP_CONFIG,
    useValue: {
      apiUrl: 'https://api.example.com',
      enableAnalytics: true,
      maxRetries: 3
    }
  }
]
```

```typescript
// some.service.ts
@Injectable({ providedIn: 'root' })
export class ApiService {
  private config = inject(APP_CONFIG); // fully typed as AppConfig

  fetchData() {
    return fetch(`${this.config.apiUrl}/data`);
  }
}
```

The string `'app.config'` passed to `InjectionToken` is purely a debugging label (shows up in error messages) — uniqueness is guaranteed by the token *object* itself, not the string, so two tokens created with the same description string are still distinct tokens.

`InjectionToken` also supports a built-in factory, letting you skip a separate provider registration entirely:

```typescript
export const APP_CONFIG = new InjectionToken<AppConfig>('app.config', {
  providedIn: 'root',
  factory: () => ({
    apiUrl: 'https://api.example.com',
    enableAnalytics: true,
    maxRetries: 3
  })
});
```

---

## 7. Multi-Providers

Normally, registering a token twice makes the last registration win. A **multi-provider** (`multi: true`) instead collects every provider registered against the same token into an array — Angular's own `HTTP_INTERCEPTORS` and `NG_VALIDATORS` tokens work this way.

```typescript
export const VALIDATION_RULE = new InjectionToken<ValidationRule>('validation.rule');

export interface ValidationRule {
  validate(value: string): boolean;
  message: string;
}

const notEmptyRule: ValidationRule = {
  validate: (v) => v.trim().length > 0,
  message: 'Value cannot be empty'
};

const maxLengthRule: ValidationRule = {
  validate: (v) => v.length <= 100,
  message: 'Value cannot exceed 100 characters'
};

providers: [
  { provide: VALIDATION_RULE, useValue: notEmptyRule, multi: true },
  { provide: VALIDATION_RULE, useValue: maxLengthRule, multi: true }
]
```

```typescript
@Injectable({ providedIn: 'root' })
export class ValidationService {
  private rules = inject(VALIDATION_RULE); // ValidationRule[], both rules present

  validateAll(value: string): string[] {
    return this.rules.filter(rule => !rule.validate(value)).map(rule => rule.message);
  }
}
```

Without `multi: true`, the second `provide: VALIDATION_RULE` entry would silently replace the first — only `maxLengthRule` would ever be injected.

---

## 8. Worked Example: Token-Based Config Service

Putting it together — a config service driven entirely by an `InjectionToken`, configurable differently per environment without touching the service's source.

```typescript
// tokens/feature-flags.token.ts
import { InjectionToken } from '@angular/core';

export interface FeatureFlags {
  newCheckoutFlow: boolean;
  darkModeDefault: boolean;
  betaDashboard: boolean;
}

export const FEATURE_FLAGS = new InjectionToken<FeatureFlags>('feature.flags');
```

```typescript
// feature-flag.service.ts
import { Injectable, inject } from '@angular/core';
import { FEATURE_FLAGS } from './tokens/feature-flags.token';

@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  private flags = inject(FEATURE_FLAGS);

  isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag];
  }
}
```

```typescript
// app.config.ts (production)
import { ApplicationConfig } from '@angular/core';
import { FEATURE_FLAGS } from './tokens/feature-flags.token';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: FEATURE_FLAGS,
      useValue: {
        newCheckoutFlow: true,
        darkModeDefault: false,
        betaDashboard: false
      }
    }
  ]
};
```

```typescript
// app.config.staging.ts (staging — betaDashboard turned on for QA)
export const stagingConfig: ApplicationConfig = {
  providers: [
    {
      provide: FEATURE_FLAGS,
      useValue: {
        newCheckoutFlow: true,
        darkModeDefault: false,
        betaDashboard: true
      }
    }
  ]
};
```

```typescript
// usage in a component
@Component({ selector: 'app-dashboard', standalone: true, template: `
  @if (featureFlags.isEnabled('betaDashboard')) {
    <app-beta-dashboard />
  } @else {
    <app-standard-dashboard />
  }
` })
export class DashboardComponent {
  featureFlags = inject(FeatureFlagService);
}
```

`FeatureFlagService`'s code never changes between environments — only the `useValue` object bound to `FEATURE_FLAGS` in `app.config.ts` changes, typically by swapping which config file `bootstrapApplication` loads per build.

---

## 9. Hands-On Exercises

**Exercise 1:** Define an abstract `PaymentGateway` class with a `charge(amount: number)` method. Create `StripeGateway` and `MockPaymentGateway` implementations. Use `useClass` to swap between them based on an `environment.production` flag.

**Exercise 2:** Create an `InjectionToken<string[]>` called `SUPPORTED_LOCALES` and provide it with `useValue: ['en-US', 'en-AU', 'fr-FR']`. Inject it into a component and render the list.

**Exercise 3:** Write a `useFactory` provider for a `Clock` service that returns a fake fixed-time clock in tests (`deps: []`, returns a hardcoded date) and a real `Date`-based clock in the app.

**Exercise 4:** Build a multi-provider `InjectionToken<Interceptor>` called `APP_INTERCEPTORS`, register two interceptor objects against it with `multi: true`, and write a service that injects the array and runs each interceptor in order.

**Exercise 5:** Take the `FEATURE_FLAGS` example from Section 8 and add a `useExisting` alias token `LEGACY_FEATURE_FLAGS` that points at the same `FEATURE_FLAGS` provider, then verify both tokens resolve to the identical object reference (`===`).

---

## 10. Interview Q&A

**Q: What are the four provider types Angular supports, and when would you use each?**
Answer: `useClass` builds the value via `new` on a specified class — good for swapping implementations (real vs. mock). `useValue` supplies a pre-built literal value directly with no construction — good for constants and config objects. `useFactory` runs a function (optionally with its own injected `deps`) to compute the value — needed when construction requires logic or other services. `useExisting` aliases one token to an already-existing instance of another token — used for renames or interface aliasing without creating a second instance.

**Q: Why can't you use an interface directly as a DI token, and what's the fix?**
Answer: TypeScript interfaces are erased at compile time and have no runtime representation, so the injector has nothing to key its lookup on. The fix is `InjectionToken<T>` — a unique runtime object created explicitly for DI purposes, typed generically so consumers still get full type safety when they inject it.

**Q: What does the multi: true flag do on a provider, and give a real Angular example of where it's used?**
Answer: `multi: true` tells Angular to collect every provider registered against the same token into an array, rather than the last registration overwriting earlier ones. Injecting that token then yields an array of all registered values, called in order. Angular's own `HTTP_INTERCEPTORS` token uses this — every interceptor you provide with `multi: true` is added to the interceptor chain rather than replacing previous ones.

**Q: What's the practical difference between useExisting and useClass when redirecting one token to another?**
Answer: `useExisting` makes the second token resolve to the exact same singleton instance as the first — no new object is created. `useClass` instead constructs a brand-new instance by calling the specified class's constructor again, so you end up with two separate objects in memory even though they're the same class. `useExisting` is the right choice when you want a true alias.

**Q: When would you reach for useFactory instead of useClass?**
Answer: When the value can't be produced by simply calling `new SomeClass()` — for example, choosing between implementations based on a runtime condition (browser vs. server), reading configuration that isn't itself injectable, or needing to inject other services into the construction logic via the factory's `deps` array. `useFactory` is the general-purpose escape hatch for any construction logic more complex than a bare constructor call.
