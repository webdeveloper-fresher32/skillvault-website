# Phase 4: Providers & Dependency Injection

## What You'll Learn

This is the conceptual core of NestJS — the part of the framework that is not optional to understand, because everything else (modules, guards, interceptors, database repositories) is built on top of it. A **provider** is any class Nest can create and manage on your behalf — services, repositories, factories, helpers — and **dependency injection (DI)** is the mechanism Nest uses to hand a class the collaborators it needs without that class having to construct them itself. Nest's DI system is powered by an **IoC (Inversion of Control) container**: at bootstrap, Nest reads the metadata attached by decorators, builds a dependency graph across your entire application, and instantiates providers in the correct order, wiring each one's constructor arguments automatically.

This phase goes deep on the parts that trip learners up most: what "provider" actually means beyond `@Injectable()` services, how to register non-class values and factories as providers, how injection tokens work when you're not injecting a class, the three injection **scopes** and the very real performance trade-off of the non-default ones, and how to diagnose and fix circular dependency errors — one of the most common "it just doesn't work and the error message is unhelpful" moments in NestJS.

By the end of this phase you should be able to read a `providers: []` array in any NestJS module and explain exactly what object gets constructed, when, how many times, and why — instead of treating DI as magic that "just works most of the time."

## Learning Objectives

- Explain what a provider is in Nest's sense, and how it differs from "just a class with `@Injectable()`"
- Describe conceptually how the IoC container resolves and builds the dependency graph at application bootstrap
- Use constructor-based injection idiomatically, and explain why Nest prefers it over Angular-style `inject()`
- Register custom providers with `useClass`, `useValue`, `useFactory`, and `useExisting`, and know when each is appropriate
- Use string, Symbol, and class-based injection tokens, and know when a plain class reference is not enough
- Configure a factory provider (`useFactory`) that itself depends on another provider (e.g. `ConfigService`) via `inject`
- Explain the three injection scopes — `DEFAULT`, `REQUEST`, `TRANSIENT` — and their instantiation lifetimes
- Identify why `REQUEST` scope is expensive (scope "bubbles up" through the injection graph) and when it is justified
- Recognize a circular dependency error from its stack trace and fix it with `forwardRef()` or by refactoring the cycle away
- Explain why providers are private to their declaring module by default, and use `exports` correctly to share them

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Providers-and-Injectable-Services.md](01-Providers-and-Injectable-Services.md) | Providers & Injectable Services — `@Injectable()`, constructor injection, the IoC container, custom providers, injection tokens | 1.5 days |
| [02-Injection-Scopes-and-Circular-Dependencies.md](02-Injection-Scopes-and-Circular-Dependencies.md) | Injection Scopes & Circular Dependencies — `DEFAULT`/`REQUEST`/`TRANSIENT`, scope bubbling, `forwardRef()` | 1 day |
| [03-Module-Encapsulation-and-Provider-Visibility.md](03-Module-Encapsulation-and-Provider-Visibility.md) | Module Encapsulation & Provider Visibility — `exports`, why imports alone don't share providers | 0.5 day |

## Estimated Time
3 days

## Previous Phase
→ [Phase 3: Controllers & Routing](../Phase-03-Controllers-and-Routing/README.md)

## Next Phase
→ [Phase 5: Modules & Application Architecture](../Phase-05-Modules-and-Application-Architecture/README.md)
