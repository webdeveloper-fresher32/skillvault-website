# Phase 5: Services & Dependency Injection

## What You'll Learn

Learn how Angular's Dependency Injection (DI) system lets you write services once and share them cleanly across components — instead of instantiating classes manually or passing data through endless `@Input()` chains. You'll go from basic `@Injectable` services to configuring providers with tokens, and understand how Angular's injector tree lets you scope service instances at different levels of your app.

## Learning Objectives

- Explain what Dependency Injection is and the problem it solves in Angular apps
- Create injectable services with `@Injectable({ providedIn: 'root' })` and use the modern `inject()` function
- Configure providers with `useClass`, `useValue`, `useFactory`, and `useExisting`
- Use `InjectionToken` to inject non-class values (config objects, constants) safely
- Understand the injector hierarchy (root, module, element) and use `@Optional`, `@Self`, and `@SkipSelf` to control resolution

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Dependency-Injection-Basics.md](01-Dependency-Injection-Basics.md) | What is DI, `@Injectable`, `providedIn: 'root'`, constructor injection, `inject()` | 1 day |
| [02-Providers-and-Injection-Tokens.md](02-Providers-and-Injection-Tokens.md) | Provider types, `InjectionToken`, multi-providers, token-based config | 0.5 day |
| [03-Hierarchical-DI.md](03-Hierarchical-DI.md) | Injector tree, provider overriding, `@Optional`/`@Self`/`@SkipSelf`, per-component service scoping | 0.5 day |

## Estimated Time

2 days

## Next Phase

→ [Phase 6: Routing & Navigation](../Phase-06-Routing-and-Navigation/README.md)
