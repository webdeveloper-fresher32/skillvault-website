# Lazy Loading and Guards — Complete Guide

## Table of Contents
1. [Why Lazy Load](#1-why-lazy-load)
2. [Lazy Loading a Standalone Component](#2-lazy-loading-a-standalone-component)
3. [Lazy Loading a Route Group (loadChildren)](#3-lazy-loading-a-route-group-loadchildren)
4. [Functional Route Guards](#4-functional-route-guards)
5. [CanActivate — Auth Guard Worked Example](#5-canactivate--auth-guard-worked-example)
6. [CanDeactivate — Unsaved Changes Guard](#6-candeactivate--unsaved-changes-guard)
7. [Combining Guards and Lazy Loading](#7-combining-guards-and-lazy-loading)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Lazy Load

By default, every component you reference in your routes gets bundled into the app's initial JavaScript payload. For a large app, that means users downloading code for an admin panel they'll never open, just to see the login page. Lazy loading splits routes into separate chunks that the browser fetches **only when the user navigates there**.

```
Eager (everything in one bundle):
  main.js: [Home + About + Admin + Reports + Settings] → 850 KB downloaded up front

Lazy (route-based code splitting):
  main.js: [Home + About]                     → 120 KB downloaded up front
  admin-chunk.js: [Admin]                     → fetched only on /admin
  reports-chunk.js: [Reports]                 → fetched only on /reports
```

Angular's build tooling (esbuild/Webpack under the CLI) automatically creates separate chunks for any route that uses `loadComponent` or `loadChildren` — no extra config needed beyond writing the dynamic `import()`.

---

## 2. Lazy Loading a Standalone Component

Use `loadComponent` with a dynamic `import()` instead of `component`. The import must point at a **default export** or use `.then(m => m.SomeComponent)`.

```typescript
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent) },
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
    title: 'Admin Dashboard',
  },
];
```

Nothing changes in `admin-dashboard.component.ts` itself — it's a normal standalone component. The only difference is the route config references it through a dynamic import rather than a static one, which is what triggers the bundler to split it into its own chunk.

---

## 3. Lazy Loading a Route Group (loadChildren)

When a whole feature area has multiple routes (list, detail, edit), lazy-load the entire group at once with `loadChildren`, pointing at a file that exports a `Routes` array.

```typescript
// features/products/products.routes.ts
import { Routes } from '@angular/router';

export const PRODUCTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./product-list.component').then((m) => m.ProductListComponent) },
  { path: ':id', loadComponent: () => import('./product-detail.component').then((m) => m.ProductDetailComponent) },
  { path: ':id/edit', loadComponent: () => import('./product-edit.component').then((m) => m.ProductEditComponent) },
];
```

```typescript
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent) },
  {
    path: 'products',
    loadChildren: () => import('./features/products/products.routes').then((m) => m.PRODUCTS_ROUTES),
  },
];
```

All three product routes ship in a single `products-chunk.js`, fetched the first time the user navigates to anything under `/products`. This is the standalone-era replacement for lazy-loading an `NgModule` — no module, just an exported `Routes` array.

---

## 4. Functional Route Guards

Guards decide whether a navigation is allowed to proceed, whether it can leave the current route, or what data to attach before it activates. Modern Angular (14+) guards are **plain functions** created with `CanActivateFn`, `CanDeactivateFn`, etc. — not injectable classes implementing an interface, though the class-based style still works.

| Guard type | Runs when | Returns |
|-----------|-----------|---------|
| `CanActivateFn` | Before a route is activated (entered) | `boolean \| UrlTree \| Observable/Promise` of either |
| `CanActivateChildFn` | Before any child route is activated | same as above |
| `CanDeactivateFn<T>` | Before navigating away from the current route | same as above |
| `CanMatchFn` | Before the router even attempts to match this route (useful to fall through to another route entirely) | same as above |

A functional guard is just a function conforming to the signature — use `inject()` inside it to reach services, since there's no constructor.

```typescript
import { CanActivateFn } from '@angular/router';

export const exampleGuard: CanActivateFn = (route, state) => {
  // route: ActivatedRouteSnapshot for the route being activated
  // state: RouterStateSnapshot, has state.url for the target URL
  return true;
};
```

Returning a `UrlTree` (via `router.createUrlTree([...])` or `router.parseUrl(...)`) redirects instead of just blocking — this is the modern replacement for manually calling `router.navigate()` and returning `false`.

---

## 5. CanActivate — Auth Guard Worked Example

```typescript
// auth.service.ts
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private loggedIn = signal(false);
  isLoggedIn = this.loggedIn.asReadonly();

  login() { this.loggedIn.set(true); }
  logout() { this.loggedIn.set(false); }
}
```

```typescript
// auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }

  // redirect to /login, remembering where the user was headed
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
```

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent) },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
];
```

```typescript
// login.component.ts (relevant excerpt)
import { Component, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({ selector: 'app-login', standalone: true, template: `<button (click)="onLogin()">Log in</button>` })
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  onLogin() {
    this.auth.login();
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
    this.router.navigateByUrl(returnUrl);
  }
}
```

An unauthenticated visit to `/dashboard` is redirected to `/login?returnUrl=%2Fdashboard`, and logging in sends the user right back where they intended to go.

---

## 6. CanDeactivate — Unsaved Changes Guard

`CanDeactivate` protects against navigating away and silently losing unsaved work. It calls a method on the component being left, so the component decides for itself whether it's safe to leave.

```typescript
// can-component-deactivate.guard.ts
import { CanDeactivateFn } from '@angular/router';

export interface CanComponentDeactivate {
  canDeactivate: () => boolean | Promise<boolean>;
}

export const unsavedChangesGuard: CanDeactivateFn<CanComponentDeactivate> = (component) => {
  return component.canDeactivate();
};
```

```typescript
// product-edit.component.ts
import { Component, signal } from '@angular/core';
import { CanComponentDeactivate } from '../can-component-deactivate.guard';

@Component({ selector: 'app-product-edit', standalone: true, template: `...` })
export class ProductEditComponent implements CanComponentDeactivate {
  isDirty = signal(false);

  canDeactivate(): boolean {
    if (!this.isDirty()) return true;
    return confirm('You have unsaved changes. Leave anyway?');
  }
}
```

```typescript
// products.routes.ts
{
  path: ':id/edit',
  loadComponent: () => import('./product-edit.component').then((m) => m.ProductEditComponent),
  canDeactivate: [unsavedChangesGuard],
}
```

The guard is generic (`CanDeactivateFn<CanComponentDeactivate>`), so it's reusable across any component that implements `canDeactivate()` — a single guard function covers edit forms for products, users, settings, etc.

---

## 7. Combining Guards and Lazy Loading

Guards and lazy loading compose cleanly — a lazy-loaded route can carry `canActivate`/`canDeactivate` just like an eager one, and multiple guards run in array order, all must pass:

```typescript
{
  path: 'admin',
  canActivate: [authGuard, adminRoleGuard],
  loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
}
```

If `authGuard` returns a `UrlTree` redirect, `adminRoleGuard` never runs, and the `admin` chunk is never even downloaded — guard evaluation happens before the lazy chunk is fetched.

---

## 8. Hands-On Exercises

**Exercise 1:** Convert two eager routes (`home`, `about`) to `loadComponent`. Open your browser's Network tab, navigate between them, and confirm separate JS chunks load on demand.

**Exercise 2:** Build a `features/products` folder with a `products.routes.ts` exporting list/detail routes, wired into `app.routes.ts` via `loadChildren`. Verify all product routes load in one chunk.

**Exercise 3:** Implement `authGuard` exactly as shown above, with a signal-based `AuthService`. Protect a `/dashboard` route and confirm unauthenticated visits redirect to `/login?returnUrl=...`.

**Exercise 4:** Extend the login flow to read `returnUrl` from query params and navigate there after login. Test navigating directly to `/dashboard` while logged out, logging in, and landing back on `/dashboard`.

**Exercise 5:** Implement `unsavedChangesGuard` and apply it to a form component with a dirty flag. Confirm a confirmation dialog appears when navigating away with unsaved changes, and that navigation proceeds unblocked when the form is clean.

---

## 9. Interview Q&A

**Q: What is lazy loading in Angular routing, and what triggers a route to be split into its own chunk?**
Answer: Lazy loading defers downloading a route's JavaScript until the user actually navigates to it, instead of bundling everything into the initial payload. Using `loadComponent: () => import(...)` or `loadChildren: () => import(...)` in a route definition — a dynamic `import()` — is what signals the Angular build tooling to split that code into a separate chunk.

**Q: What's the difference between `loadComponent` and `loadChildren`?**
Answer: `loadComponent` lazy-loads a single standalone component for one route. `loadChildren` lazy-loads an entire group of routes at once, pointing at a file that exports a `Routes` array — used when a feature area (e.g. `/products/*`) has multiple related routes that should ship together in one chunk.

**Q: How do functional guards differ from the older class-based guards?**
Answer: Functional guards are plain functions matching a signature like `CanActivateFn`, using `inject()` inside the function body to access services, rather than injectable classes implementing `CanActivate`. They're less boilerplate — no class, no constructor — and are now the recommended style, though class-based guards are still supported for backward compatibility.

**Q: How do you redirect an unauthenticated user from within a `CanActivate` guard instead of just blocking navigation?**
Answer: Return a `UrlTree` (built with `router.createUrlTree([...])` or `router.parseUrl(...)`) instead of `false`. The router treats a returned `UrlTree` as "cancel this navigation and navigate to this URL instead," which is cleaner than manually calling `router.navigate()` and returning `false` from the guard.

**Q: What problem does `CanDeactivate` solve, and how does it get information from the component being left?**
Answer: It prevents users from accidentally losing unsaved changes by navigating away from a form or editor. The guard function receives the component instance being deactivated as its first argument, so it can call a method (e.g. `canDeactivate()`) defined by that component to ask whether leaving is safe — the decision logic lives in the component, the guard just wires it into routing.
