# Dependency Injection Basics — Complete Guide

## Table of Contents
1. [The Problem DI Solves](#1-the-problem-di-solves)
2. [What is Dependency Injection?](#2-what-is-dependency-injection)
3. [Creating a Service with @Injectable](#3-creating-a-service-with-injectable)
4. [providedIn: 'root' vs Component-Level Providers](#4-providedin-root-vs-component-level-providers)
5. [Constructor Injection](#5-constructor-injection)
6. [The inject() Function (Modern Angular)](#6-the-inject-function-modern-angular)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem DI Solves

### Without DI — manual wiring

```typescript
class Logger {
  log(msg: string) { console.log(`[LOG] ${msg}`); }
}

class UserService {
  private logger = new Logger(); // hard-coded dependency

  getUser(id: number) {
    this.logger.log(`Fetching user ${id}`);
    // ...
  }
}

class OrderService {
  private logger = new Logger(); // duplicated everywhere
  // ...
}
```

Every class that needs a `Logger` creates its own instance. If `Logger` later needs a constructor argument (e.g. a log level), you must edit every call site. Testing is painful — you can't swap in a fake `Logger` without changing `UserService`'s source.

### With DI — Angular wires it for you

```typescript
@Injectable({ providedIn: 'root' })
class Logger {
  log(msg: string) { console.log(`[LOG] ${msg}`); }
}

@Injectable({ providedIn: 'root' })
class UserService {
  constructor(private logger: Logger) {} // Angular supplies this

  getUser(id: number) {
    this.logger.log(`Fetching user ${id}`);
  }
}
```

Angular creates the `Logger` instance once, and hands it to anything that asks for it. Swapping `Logger` for a mock in a test is a one-line provider override — no source changes.

---

## 2. What is Dependency Injection?

DI is a design pattern where a class **declares what it needs** (its dependencies) instead of creating those dependencies itself. A separate system — the **injector** — is responsible for constructing and supplying them.

```
┌─────────────────────────────────────────────────────────┐
│                      Angular Injector                   │
│                                                           │
│   Registry: { Logger -> Logger instance,                 │
│               UserService -> UserService instance, ... }  │
│                                                           │
│   1. Component asks for UserService                       │
│   2. Injector checks registry — not built yet             │
│   3. Injector sees UserService needs a Logger              │
│   4. Injector builds Logger first                          │
│   5. Injector builds UserService(logger)                   │
│   6. Injector caches both instances                        │
│   7. Component receives the ready-to-use UserService       │
└─────────────────────────────────────────────────────────┘
```

Three participants in every DI setup:

| Role | Description |
|------|-------------|
| **Dependency** | The thing being injected (e.g. `Logger`) |
| **Client** | The class that needs it (e.g. `UserService`) |
| **Injector** | Angular's runtime system that creates and supplies dependencies |

DI gives you:
- **Loose coupling** — classes depend on abstractions/services, not concrete construction logic
- **Testability** — swap real services for mocks/stubs in unit tests
- **Singletons by default** — one shared instance across the app, avoiding wasted memory and inconsistent state
- **Centralized configuration** — change how a dependency is built in one place (a provider), not at every usage site

---

## 3. Creating a Service with @Injectable

A service is just a plain TypeScript class. The `@Injectable()` decorator tells Angular's compiler that this class participates in DI — it can have its own dependencies injected, and it can itself be injected elsewhere.

```typescript
// user.service.ts
import { Injectable } from '@angular/core';

export interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private users: User[] = [
    { id: 1, name: 'Asha Patel', email: 'asha@example.com' },
    { id: 2, name: 'Leo Chen', email: 'leo@example.com' }
  ];

  getUsers(): User[] {
    return this.users;
  }

  getUserById(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }

  addUser(user: User): void {
    this.users.push(user);
  }
}
```

Even a service with **zero dependencies** should carry `@Injectable()` — it's what makes the class eligible for Angular's compiler-generated dependency metadata (`ɵfac`), and it's required the moment you add a constructor dependency later.

---

## 4. providedIn: 'root' vs Component-Level Providers

### providedIn: 'root' — application-wide singleton

```typescript
@Injectable({ providedIn: 'root' })
export class UserService { /* ... */ }
```

- Angular registers the service with the **root injector**.
- One single instance is shared across the **entire application** (every component, every route).
- Tree-shakable: if nothing ever injects `UserService`, it's not included in the production bundle.
- This is the default and recommended approach for most services (API clients, auth state, caching).

### Component-level providers — scoped instance

```typescript
@Component({
  selector: 'app-shopping-cart',
  standalone: true,
  providers: [CartService], // new instance for this component subtree
  template: `...`
})
export class ShoppingCartComponent {}
```

- Angular creates a **new instance** of `CartService` for this component and shares it only with `ShoppingCartComponent` and its children.
- Useful when state must NOT leak across unrelated parts of the app (e.g. a wizard's draft state, a per-widget cache).
- Every time the component is created (e.g. re-rendered inside an `@for` loop), a fresh instance is created — and destroyed when the component is destroyed.

```
providedIn: 'root'                    Component-level provider
──────────────────                    ───────────────────────
      Root Injector                          Root Injector
      ┌───────────┐                          ┌───────────┐
      │UserService│ (1 instance)              │           │
      └───────────┐                          └───────────┘
       shared by ALL components                     │
                                          ┌──────────┴──────────┐
                                    Component A            Component B
                                    ┌────────────┐         ┌────────────┐
                                    │ CartService│ (new)   │ CartService│ (new)
                                    └────────────┘         └────────────┘
                                    Own instance             Own instance
```

| | `providedIn: 'root'` | Component `providers: []` |
|---|---|---|
| Scope | Whole app | This component + its descendants |
| Instances | Always 1 | 1 per component instance |
| Lifetime | App lifetime | Component lifetime |
| Tree-shakable | Yes | No (always bundled if component is used) |
| Typical use | API services, auth, global state | Per-feature/per-widget local state |

---

## 5. Constructor Injection

The classic way to receive a dependency is to declare it as a constructor parameter with an access modifier (`private`/`public`/`readonly`). TypeScript's parameter properties syntax turns the parameter directly into a class field.

```typescript
// user-list.component.ts
import { Component, OnInit } from '@angular/core';
import { UserService, User } from './user.service';

@Component({
  selector: 'app-user-list',
  standalone: true,
  template: `
    <ul>
      @for (user of users; track user.id) {
        <li>{{ user.name }} — {{ user.email }}</li>
      }
    </ul>
  `
})
export class UserListComponent implements OnInit {
  users: User[] = [];

  // Angular sees the UserService type and supplies an instance automatically
  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.users = this.userService.getUsers();
  }
}
```

Angular reads the **type** of each constructor parameter and resolves it against the injector at the point the component is created. This is why the dependency's type must be a real class (or a token — see Lesson 2) — TypeScript interfaces alone don't survive to runtime and can't be used as injection markers.

Multiple dependencies just become multiple constructor parameters:

```typescript
constructor(
  private userService: UserService,
  private logger: Logger,
  private http: HttpClient
) {}
```

---

## 6. The inject() Function (Modern Angular)

Angular 14+ introduced `inject()`, a function you call inside a property initializer, constructor body, or any "injection context" to pull a dependency without a constructor parameter. Angular 17+ style favors this in many codebases because it composes better and works in plain functions, not just classes.

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { UserService, User } from './user.service';

@Component({
  selector: 'app-user-list',
  standalone: true,
  template: `...`
})
export class UserListComponent implements OnInit {
  // Injected as a field — no constructor needed
  private userService = inject(UserService);

  users: User[] = [];

  ngOnInit(): void {
    this.users = this.userService.getUsers();
  }
}
```

### Why inject() over constructor injection?

```typescript
// Constructor injection: dependency list grows into a long parameter block
export class DashboardComponent {
  constructor(
    private userService: UserService,
    private orderService: OrderService,
    private analytics: AnalyticsService,
    private auth: AuthService,
    private logger: Logger
  ) {}
}

// inject(): flat, easy to scan, easy to extend, works with inheritance
export class DashboardComponent {
  private userService = inject(UserService);
  private orderService = inject(OrderService);
  private analytics = inject(AnalyticsService);
  private auth = inject(AuthService);
  private logger = inject(Logger);
}
```

`inject()` also works in places constructors can't reach, such as standalone functions used as route guards or resolvers:

```typescript
// auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService); // no class, no constructor — still works
  return auth.isLoggedIn();
};
```

`inject()` must be called synchronously within an "injection context" — inside a field initializer, a constructor, or a function Angular explicitly runs within one (like `CanActivateFn`). Calling it inside a `setTimeout` callback or after an `await` will throw.

---

## 7. Hands-On Exercises

**Exercise 1:** Create a `NotificationService` with `@Injectable({ providedIn: 'root' })` that exposes a `notify(message: string)` method logging to the console. Inject it into a component via the constructor and call it from a button click.

**Exercise 2:** Rewrite the component from Exercise 1 to use `inject()` instead of constructor injection. Confirm the app behaves identically.

**Exercise 3:** Create a `CounterService` with a `count` field and `increment()`/`decrement()` methods. Add it to the `providers` array of two sibling components. Verify — by logging the injected instance's `count` — that each component gets its own independent counter.

**Exercise 4:** Take the `CounterService` from Exercise 3 and instead provide it with `providedIn: 'root'` and no component-level `providers`. Verify both sibling components now share the same counter value.

**Exercise 5:** Write a route guard function using `CanActivateFn` that calls `inject(AuthService)` and redirects to `/login` (using `inject(Router)`) when the user isn't authenticated.

---

## 8. Interview Q&A

**Q: What is Dependency Injection and why does Angular use it?**
Answer: DI is a pattern where a class declares the dependencies it needs (typically via constructor parameters or `inject()`) instead of instantiating them itself, and a runtime injector supplies them. Angular uses it to decouple components/services from how their dependencies are constructed, which makes code more testable (mocks can be swapped in via providers), promotes singleton reuse of services, and centralizes configuration.

**Q: What does @Injectable({ providedIn: 'root' }) do?**
Answer: It registers the class with Angular's root injector so a single, application-wide instance is created lazily the first time it's requested, and that same instance is shared by every consumer thereafter. It also makes the service tree-shakable — if the app never injects it, it's excluded from the production bundle.

**Q: What's the difference between providing a service in `providedIn: 'root'` versus a component's `providers` array?**
Answer: `providedIn: 'root'` creates exactly one instance for the whole app, shared everywhere. Adding the service to a component's `providers` array creates a new instance scoped to that component and its descendants — a fresh instance per component instance, destroyed when the component is destroyed. Use component-level providers when state must not leak between unrelated parts of the UI.

**Q: How does inject() differ from constructor injection, and when would you have to use it?**
Answer: Constructor injection declares dependencies as typed constructor parameters; `inject()` retrieves a dependency by calling a function inside an "injection context" (field initializer, constructor body, or a function Angular runs in one). They resolve dependencies identically — `inject()` is just a different syntax. You must use `inject()` in places without a constructor, such as standalone `CanActivateFn` route guards, functional resolvers, or `provideAppInitializer` callbacks.

**Q: Why can't you inject a TypeScript interface directly?**
Answer: TypeScript interfaces are a compile-time-only construct — they're erased during compilation and have no representation at runtime, so Angular's injector (which resolves dependencies using the constructor parameter's runtime type/token) has nothing to look up. To inject something that isn't a concrete class, you use an `InjectionToken` instead (covered in the next lesson).
