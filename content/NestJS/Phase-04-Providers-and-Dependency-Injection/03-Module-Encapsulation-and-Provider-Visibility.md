# Module Encapsulation & Provider Visibility — Complete Guide

## Table of Contents
1. [The Encapsulation Rule — Providers Are Private by Default](#1-the-encapsulation-rule--providers-are-private-by-default)
2. [Why Nest Enforces This](#2-why-nest-enforces-this)
3. [The `exports` Array — Opting a Provider Into Visibility](#3-the-exports-array--opting-a-provider-into-visibility)
4. [Importing a Module Does Not Import Its Imports](#4-importing-a-module-does-not-import-its-imports)
5. [Re-Exporting — Passing a Provider Through](#5-re-exporting--passing-a-provider-through)
6. [Worked Example — The "Service Not Found" Bug and Its Fix](#6-worked-example--the-service-not-found-bug-and-its-fix)
7. [A Debugging Checklist for Resolution Errors](#7-a-debugging-checklist-for-resolution-errors)
8. [Global Modules — the Escape Hatch, Used Sparingly](#8-global-modules--the-escape-hatch-used-sparingly)
9. [Dynamic Modules and Visibility](#9-dynamic-modules-and-visibility)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. The Encapsulation Rule — Providers Are Private by Default

Every NestJS module defines a **DI boundary**. A provider registered in a module's `providers` array is visible only *inside that module* — to its own controllers and to its own other providers — unless it is explicitly listed in that module's `exports` array. This is true no matter how the module ends up being imported elsewhere in the application.

```
  UsersModule
  ┌────────────────────────────────────────────┐
  │  providers: [ UsersService, UsersRepository ] │
  │  exports:   [ UsersService ]                  │
  │                                                │
  │  UsersService     ◀── visible OUTSIDE too     │
  │  UsersRepository  ◀── visible ONLY inside     │
  │                       UsersModule             │
  └────────────────────────────────────────────┘
```

`UsersRepository` can be injected freely by `UsersService` or any controller declared *inside* `UsersModule` — but no other module, even one that imports `UsersModule`, can inject `UsersRepository` directly. Only `UsersService` crosses the boundary, because only `UsersService` appears in `exports`.

This is deliberate module **encapsulation**, directly analogous to access modifiers in object-oriented languages: `providers` without `exports` behaves like a "private" member of the module, and anything added to `exports` behaves like a "public" member other modules can depend on.

---

## 2. Why Nest Enforces This

Encapsulation is not an arbitrary restriction — it's what makes modules genuinely modular rather than just organizational folders. If every provider were automatically visible everywhere, importing any one feature module would silently expose its entire internal implementation (repositories, internal helpers, low-level clients) to the rest of the application, and:

- **Internal refactors would become breaking changes.** If `UsersRepository` were visible application-wide by default, renaming or removing it inside `UsersModule` could break code in a completely unrelated module that happened to inject it — encapsulation guarantees that only what's in `exports` is a "public contract" other modules can rely on.
- **Dependency direction would become unclear.** Explicit `exports` force a module's author to decide, on purpose, what the module offers to the rest of the application — turning the module into a designed unit with an interface, not just an implicit grab-bag of everything it happens to contain.
- **Circular and accidental coupling become easier to spot.** When visibility must be explicitly granted, an unexpected dependency (module X reaching into module Y's internals) shows up immediately as a missing export/import error at bootstrap, rather than silently working and creating hidden coupling that surfaces only during a later refactor.

---

## 3. The `exports` Array — Opting a Provider Into Visibility

```typescript
// users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService], // only UsersService is available to importing modules
})
export class UsersModule {}
```

A module can only export a provider that it also declares in its own `providers` array (or, as covered in Section 5, one it re-exports from an import). Any *importing* module then gains access to everything in `exports` — but only after adding `UsersModule` to its own `imports` array:

```typescript
// orders.module.ts
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { OrdersService } from './orders.service';

@Module({
  imports: [UsersModule], // required to see UsersModule's exports
  providers: [OrdersService],
})
export class OrdersModule {}
```

```typescript
// orders.service.ts
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service'; // exported — resolvable
// import { UsersRepository } from '../users/users.repository'; // NOT exported — would fail

@Injectable()
export class OrdersService {
  constructor(private readonly usersService: UsersService) {}

  async createOrder(userId: number, item: string) {
    const user = this.usersService.findOne(userId); // fine — UsersService is public
    return { user, item };
  }
}
```

Two separate steps are required for cross-module injection to work, and both are easy to forget: the **exporting module** must list the provider in `exports`, and the **consuming module** must list the exporting module in `imports`. Missing either one produces a bootstrap-time resolution error.

---

## 4. Importing a Module Does Not Import Its Imports

A subtlety that catches out even experienced developers: importing a module gives you access to that module's **own** providers listed in its `exports` — it does **not** transitively give you access to providers from modules that *that* module itself imports, unless the first module explicitly re-exports them.

```
  Scenario: OrdersModule imports UsersModule.
  UsersModule imports and uses ConfigModule internally.

  ConfigModule ──imports──▶ UsersModule ──imports──▶ OrdersModule
   (exports                 (uses ConfigService        (does NOT
    ConfigService)           internally, does NOT       automatically
                              re-export it)              get ConfigService)

  OrdersModule importing UsersModule does NOT grant OrdersModule
  access to ConfigService — UsersModule never re-exported it.
  OrdersModule would need to import ConfigModule directly itself,
  OR UsersModule would need to add ConfigModule to its own `exports`.
```

This is the exact reason "both modules import a shared module" is not sufficient for two *sibling* modules to see each other's providers. Importing a shared module (like a `DatabaseModule`) gives you what *that* module exports — it does not create any visibility between the two importing modules themselves. If `UsersModule` and `OrdersModule` both import `DatabaseModule`, `UsersModule` still cannot inject anything from `OrdersModule` and vice versa; they are only both independently connected to `DatabaseModule`'s exports.

---

## 5. Re-Exporting — Passing a Provider Through

A module can pass along a provider it imported from elsewhere, without re-declaring it in its own `providers` array, simply by listing the *imported module* (not the provider) in both `imports` and `exports`:

```typescript
// database.module.ts
import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
```

```typescript
// users.module.ts — re-exports DatabaseModule so ITS consumers get DatabaseService too
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { UsersService } from './users.service';

@Module({
  imports: [DatabaseModule],
  providers: [UsersService],
  exports: [UsersService, DatabaseModule], // re-export the whole module
})
export class UsersModule {}
```

Now any module that imports `UsersModule` transitively gains access to `DatabaseService` as well, because `UsersModule` explicitly chose to re-export `DatabaseModule` rather than keep it as a private implementation detail. This is a deliberate design decision, not a default — re-export only when it's genuinely part of the contract you want `UsersModule` to offer, since it means changes to `DatabaseModule`'s exports now ripple through `UsersModule`'s own public surface.

---

## 6. Worked Example — The "Service Not Found" Bug and Its Fix

**The setup:** an e-commerce app has a `NotificationsModule` providing `NotificationsService`, and both `OrdersModule` and `UsersModule` import a shared `DatabaseModule`. A developer assumes that because `OrdersModule` and `NotificationsModule` both eventually connect to the same application, `OrdersService` should be able to inject `NotificationsService` just by having `NotificationsModule` somewhere in the module tree.

```typescript
// notifications.module.ts — the bug: no exports array at all
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [NotificationsService],
  // exports: [] — MISSING. NotificationsService is private to this module.
})
export class NotificationsModule {}
```

```typescript
// orders.module.ts
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersService } from './orders.service';

@Module({
  imports: [NotificationsModule], // imported correctly...
  providers: [OrdersService],
})
export class OrdersModule {}
```

```typescript
// orders.service.ts
import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
  constructor(private readonly notificationsService: NotificationsService) {}

  async placeOrder(userId: number, item: string) {
    // ... order logic ...
    await this.notificationsService.notify(userId, `Your order for ${item} has shipped.`);
  }
}
```

Even though `OrdersModule` correctly imports `NotificationsModule`, the application fails to bootstrap with an error like:

```
Error: Nest can't resolve dependencies of the OrdersService (?).
Please make sure that the argument NotificationsService at index [0]
is available in the OrdersModule context.

Potential solutions:
- Is NotificationsModule a valid NestJS module?
- If NotificationsService is a provider, is it part of the current OrdersModule?
- If NotificationsService is exported from a separate @Module, is that module imported within OrdersModule?
  @Module({
    imports: [ /* the Module containing NotificationsService */ ]
  })
```

The error message is precise once you know to read it carefully: `NotificationsModule` **is** imported correctly, but `NotificationsService` was never added to `NotificationsModule`'s own `exports` array — so from Nest's perspective, `NotificationsModule` has *nothing* to offer any importer, regardless of how it's imported elsewhere.

**The fix** is one line, in the module that owns the provider — not in the consuming module:

```typescript
// notifications.module.ts — FIXED
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [NotificationsService],
  exports: [NotificationsService], // now visible to any module that imports NotificationsModule
})
export class NotificationsModule {}
```

No change to `OrdersModule` or `OrdersService` was needed — the `imports: [NotificationsModule]` line was always correct. The bug was entirely on the *providing* side: a module cannot share what it never declared as shareable, no matter how correctly other modules import it.

---

## 7. A Debugging Checklist for Resolution Errors

"Nest can't resolve dependencies" is one of the most common errors developers hit while learning module encapsulation, and the framework's own error message (shown in Section 6) is genuinely trying to help — but only if you read it methodically. When you hit this error, work through these checks in order rather than guessing:

```
  Resolution error triage:
  ┌──────────────────────────────────────────────────────────────────┐
  │ 1. Does the provider even exist in ANY module's `providers`       │
  │    array? (Typo in the class name, or forgot to register it       │
  │    entirely — this is the "index [0]" argument named in the       │
  │    error message; check that index against the constructor.)      │
  │                                                                    │
  │ 2. Is the class decorated with @Injectable()? A plain class with   │
  │    no decorator has no metadata Nest can use, even if listed in    │
  │    `providers`.                                                    │
  │                                                                    │
  │ 3. Does the OWNING module export the provider?                     │
  │    (`exports: [ProviderX]` — the Section 6 bug lives here.)        │
  │                                                                    │
  │ 4. Does the CONSUMING module import the owning module?             │
  │    (`imports: [OwningModule]`)                                     │
  │                                                                    │
  │ 5. If the chain is A → B → C (A imports B, B imports C), does B    │
  │    re-export C? Transitive access requires an explicit re-export   │
  │    at every hop (Section 4).                                       │
  │                                                                    │
  │ 6. Is there a circular dependency between the two modules          │
  │    involved? (Phase 04-02 — the error shape for this is slightly   │
  │    different, often naming `undefined` rather than "not part of    │
  │    the module context.")                                          │
  └──────────────────────────────────────────────────────────────────┘
```

Reading the error message's **index** (e.g. "argument NotificationsService at index [0]") and matching it against the failing class's constructor parameter list is the fastest way to identify *which* dependency is unresolved when a constructor takes several — a common mistake is assuming the error refers to the first parameter you happen to be staring at, when the index points at a different one entirely.

---

## 8. Global Modules — the Escape Hatch, Used Sparingly

Nest offers `@Global()` as a way to make a module's exports available **everywhere** in the application without every consuming module needing to add it to `imports`:

```typescript
// config.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';

@Global()
export class ConfigModule {}

@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
```

A `@Global()` module still needs to be imported **once**, typically in the root `AppModule` — but after that single import, its exports are visible to every other module in the application without those modules needing to list it in their own `imports` array.

This is appropriate for truly cross-cutting, low-level infrastructure (configuration, a shared logger, a database connection pool) that nearly every feature module needs — but it should be used sparingly. Overusing `@Global()` erodes the very encapsulation benefits described in Section 2: if everything is global, the explicit `imports`/`exports` contract stops telling you anything meaningful about a module's real dependencies, and you lose the ability to trace "who actually needs this" by reading module metadata.

---

## 9. Dynamic Modules and Visibility

Dynamic modules (built with a static `forRoot()`/`forRootAsync()`/`register()` method returning a `DynamicModule` object) follow exactly the same encapsulation rules as ordinary modules — the only difference is that the `providers` and `exports` arrays are computed at call time instead of hardcoded in the `@Module()` decorator.

```typescript
// mailer.module.ts — a dynamic module with the same exports rules
import { DynamicModule, Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { MAILER_OPTIONS, MailerOptions } from './mailer.constants';

@Module({})
export class MailerModule {
  static forRoot(options: MailerOptions): DynamicModule {
    return {
      module: MailerModule,
      providers: [
        { provide: MAILER_OPTIONS, useValue: options },
        MailerService,
      ],
      exports: [MailerService], // still required — dynamic modules are not "automatically public"
    };
  }
}
```

```typescript
// app.module.ts
@Module({
  imports: [
    MailerModule.forRoot({ host: 'smtp.example.com', port: 587 }),
  ],
})
export class AppModule {}
```

A common misconception is that because `forRoot()` looks like a one-time application-wide configuration call, everything it registers becomes globally visible. It doesn't — the returned `DynamicModule` object's `exports` array is checked exactly the same way as a static module's, and any module wanting `MailerService` still needs `MailerModule` (configured or not) in its own `imports` array, unless `MailerModule` is separately marked `@Global()` inside the returned object (`{ .... , global: true }` is supported on the `DynamicModule` return shape as an alternative to the `@Global()` class decorator). This detail matters because third-party dynamic modules (like `@nestjs/config`'s `ConfigModule.forRoot()` or `@nestjs/typeorm`'s `TypeOrmModule.forRoot()`) rely on exactly this mechanism, and understanding it demystifies why some of them need to be imported in every feature module while others (when configured with `isGlobal: true`, as `ConfigModule.forRoot({ isGlobal: true })` supports) do not.

---

## 10. Common Pitfalls

- **Assuming "both modules import a shared module" creates visibility between them.** It doesn't — importing `DatabaseModule` in both `UsersModule` and `OrdersModule` connects each of them to `DatabaseModule`'s exports independently; it creates no direct visibility between `UsersModule` and `OrdersModule` themselves.
- **Forgetting that a correct `imports` entry doesn't help if the source module has no `exports`.** This is the exact bug in Section 6 — the fix belongs in the *providing* module, not the consuming one, and developers often waste time double-checking the consuming module's imports when the real problem is on the other side.
- **Exporting a provider without also exporting the module that provides its own dependencies.** If `UsersService` depends on `DatabaseService` and `UsersModule` exports `UsersService` but never imported `DatabaseModule` at all, `UsersService` itself will fail to construct — exporting only fixes visibility to consumers, it doesn't substitute for a module's own valid `imports`.
- **Treating `@Global()` as a shortcut to avoid writing `imports` everywhere.** This trades a small amount of typing for a much larger loss of clarity about real module dependencies, and makes every module's actual dependency footprint impossible to determine just by reading its metadata.
- **Re-exporting a module without meaning to make a permanent commitment to it.** Once `UsersModule` re-exports `DatabaseModule`, any module importing `UsersModule` can now reach `DatabaseService` — removing that re-export later is a breaking change for anyone who came to rely on it, even implicitly.
- **Exporting an entire module's provider list "just in case."** Export only what other modules genuinely need to consume — a module with everything in `exports` provides no more architectural clarity than one with no encapsulation at all.

---

## 11. Best Practices

- Treat a module's `exports` array as its **public API** — decide deliberately what a feature module offers to the rest of the app, and keep implementation details (repositories, internal helper providers, low-level clients) unexported.
- When debugging a "Nest can't resolve dependencies" error, check **both halves** in order: first, is the module that owns the provider exporting it; second, is the consuming module importing that module. The Section 6 bug is caused by missing the first half while the second half looks (and is) correct.
- Reserve `@Global()` for genuinely cross-cutting infrastructure modules (config, core logging, database connection) imported once at the root — do not reach for it as a general convenience for feature modules.
- When re-exporting an imported module, add a short comment explaining why (e.g. `// re-exported so ReportsModule can also use DatabaseService`) — this makes the re-export's purpose legible to future readers instead of looking like an accident.
- Keep each feature module's `providers` array as the "implementation" and `exports` as the deliberately-chosen "interface" — this mirrors good practice in any modular system and makes internal refactors safe as long as the exported contract doesn't change.
- Use `nest g module <name>` (the Nest CLI generator) to scaffold new modules consistently, then immediately decide what belongs in `exports` before wiring up any cross-module consumers — deciding this upfront avoids the Section 6 bug entirely.

---

## 12. Hands-On Exercises

**Exercise 1:** Create a `PaymentsModule` with a `PaymentsService` and a `PaymentsGatewayClient` (an internal helper provider `PaymentsService` uses but nothing else should). Export only `PaymentsService`. Import `PaymentsModule` into a new `CheckoutModule` and successfully inject `PaymentsService` into a `CheckoutService`. Then attempt to inject `PaymentsGatewayClient` directly into `CheckoutService` and confirm you get a resolution error, demonstrating that only exported providers cross the module boundary.

**Exercise 2:** Reproduce the exact bug from Section 6: create a provider in one module without adding it to that module's `exports`, import the module correctly elsewhere, and attempt to inject the provider. Copy the exact error message NestJS produces and annotate it — which line tells you the module needs to export the provider, versus which line would have told you the import itself was missing?

**Exercise 3:** Build three modules: `DatabaseModule` (exports `DatabaseService`), `UsersModule` (imports `DatabaseModule`, does NOT re-export it), and `ReportsModule` (imports `UsersModule` only, not `DatabaseModule` directly). Attempt to inject `DatabaseService` into a service in `ReportsModule` and confirm it fails, proving that importing `UsersModule` does not transitively grant access to `DatabaseModule`'s exports. Then fix it two different ways: (a) have `ReportsModule` import `DatabaseModule` directly, and (b) have `UsersModule` re-export `DatabaseModule` instead. Compare the two fixes and note the trade-off each implies for `UsersModule`'s public surface.

**Exercise 4:** Create a `LoggerModule` decorated with `@Global()`, exporting a `LoggerService`. Import `LoggerModule` exactly once in `AppModule`. Confirm that a service in a completely separate feature module (with no `imports` entry for `LoggerModule` at all) can still inject `LoggerService` successfully. Then remove `@Global()` and confirm the same injection now fails until you add `LoggerModule` to that feature module's own `imports` array.

**Exercise 5:** Take any two of your existing feature modules from earlier phases (or two you build for this exercise) and audit their `exports` arrays: for each exported provider, write one sentence justifying why it needs to be public. For each provider left un-exported, confirm nothing outside the module actually needs it. If you find an exported provider with no real external consumer, remove it from `exports` and confirm the app still builds and runs — practicing the discipline of treating `exports` as a deliberate, minimal public API rather than a default "export everything" habit.

**Exercise 6:** Convert a static `SettingsModule` into a dynamic module with a `SettingsModule.forRoot(options)` static method, following the pattern in Section 9. Register a configuration object via `useValue` inside the returned `DynamicModule`, and export the `SettingsService` that consumes it. Import `SettingsModule.forRoot({...})` into `AppModule`, then try injecting `SettingsService` into a sibling feature module that has NOT imported `SettingsModule` itself, and confirm it fails — proving that `forRoot()` does not make a module implicitly global.

---

## 13. Interview Q&A

**Q: Why are providers private to their declaring module by default in NestJS?**
Answer: Encapsulation makes modules genuinely modular rather than just organizational folders — if every provider were automatically visible application-wide, importing any feature module would silently expose its entire internal implementation (repositories, helpers, low-level clients), making internal refactors into unintended breaking changes for unrelated modules. Requiring an explicit `exports` array forces a module's author to deliberately decide what the module offers as its public contract, and makes any accidental or unwanted cross-module coupling show up immediately as a bootstrap-time resolution error rather than silently working and creating hidden dependencies.

**Q: What two things must both be true for `ModuleA` to inject a provider from `ModuleB`?**
Answer: `ModuleB` must list the provider in its own `exports` array, and `ModuleA` must list `ModuleB` in its own `imports` array. Both conditions are independent and commonly confused — a correct `imports` entry in the consuming module does nothing if the providing module never exported the thing being injected, which is exactly the "service not found despite correct import" bug that trips up many developers.

**Q: If `ModuleA` imports `ModuleB`, and `ModuleB` internally imports `ModuleC`, does `ModuleA` automatically get access to `ModuleC`'s exports?**
Answer: No — importing a module only grants access to that module's own `exports`; it is not transitive through the imported module's own imports. `ModuleA` would only gain access to `ModuleC`'s exports if `ModuleB` explicitly re-exports `ModuleC` (by listing `ModuleC` in both its own `imports` and `exports` arrays). Without that re-export, `ModuleB`'s use of `ModuleC` internally is a private implementation detail invisible to anything importing `ModuleB`.

**Q: Two sibling modules both import the same shared `DatabaseModule`. Does that give them visibility into each other's providers?**
Answer: No. Each sibling module independently gains access to whatever `DatabaseModule` exports, but importing the same shared module creates no direct visibility between the two siblings themselves. If `UsersModule` needs something from `OrdersModule` (or vice versa), one of them must explicitly import the other and the providing one must export the needed provider — sharing a common dependency is not a substitute for a direct import/export relationship between the two modules that actually need to talk to each other.

**Q: What is `@Global()` and why should it be used sparingly?**
Answer: `@Global()` marks a module so that, once imported anywhere (typically once in the root `AppModule`), its exports become available to every other module in the application without those modules needing to add it to their own `imports` array. It's appropriate for genuinely cross-cutting infrastructure like configuration or a core logger, but overusing it erodes the clarity that explicit `imports`/`exports` normally provides — when many modules are global, a module's declared `imports` array no longer tells you its true dependency footprint, making the codebase harder to reason about and refactor safely.

**Q: A developer sees "Nest can't resolve dependencies of X" even though the module providing the missing dependency is correctly listed in the consuming module's `imports` array. What's the most likely cause?**
Answer: The most likely cause is that the providing module never added the dependency to its own `exports` array — a module can only make a provider visible to importers if it explicitly exports it, regardless of whether the importing side did everything correctly. The fix belongs in the providing module (add the provider to its `exports`), not the consuming module, which is a common source of wasted debugging time since developers instinctively re-check their own `imports` line first when the actual defect is on the other side of the boundary.

**Q: Does a dynamic module configured with `forRoot()` automatically become globally visible across the application?**
Answer: No — a dynamic module's `DynamicModule` return object follows exactly the same `exports` visibility rules as a static module; calling `SomeModule.forRoot(options)` once in `AppModule` does not implicitly make its providers available everywhere. Any module wanting to inject something from it still needs `SomeModule` (configured or not) in its own `imports` array, unless the dynamic module explicitly opts into global visibility by setting `global: true` on the returned object or using the `@Global()` decorator — this is exactly how `ConfigModule.forRoot({ isGlobal: true })` from `@nestjs/config` achieves its commonly-seen "import once, use everywhere" behavior.
