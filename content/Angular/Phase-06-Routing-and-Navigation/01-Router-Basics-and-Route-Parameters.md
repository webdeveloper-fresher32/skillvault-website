# Router Basics and Route Parameters — Complete Guide

## Table of Contents
1. [Why Client-Side Routing](#1-why-client-side-routing)
2. [Setting Up the Router (Standalone)](#2-setting-up-the-router-standalone)
3. [RouterLink and RouterOutlet](#3-routerlink-and-routeroutlet)
4. [Route Parameters](#4-route-parameters)
5. [Query Parameters](#5-query-parameters)
6. [ActivatedRoute Deep Dive](#6-activatedroute-deep-dive)
7. [Programmatic Navigation](#7-programmatic-navigation)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Client-Side Routing

A Single Page Application (SPA) loads one HTML shell and swaps components in and out of the DOM as the URL changes — no full page reload. The Angular Router owns this: it maps a URL to a component tree, keeps the browser's back/forward buttons working, and lets deep-links (`/products/42`) load the app straight into the right state.

```
Browser URL: /products/42
                 │
                 ▼
        Angular Router matches
        path: 'products/:id' → ProductDetailComponent
                 │
                 ▼
        <router-outlet> renders ProductDetailComponent
        (no network round-trip, no full reload)
```

Without a router you'd hand-roll `*ngIf` toggles for every "page" and lose URL-driven state, bookmarking, and browser history — the router replaces all of that with a declarative config.

---

## 2. Setting Up the Router (Standalone)

Modern Angular (17+) configures the router with `provideRouter` in `app.config.ts` — no `RouterModule.forRoot()` or `AppRoutingModule` needed.

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { AboutComponent } from './about/about.component';
import { ProductDetailComponent } from './products/product-detail.component';
import { NotFoundComponent } from './not-found/not-found.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Home' },
  { path: 'about', component: AboutComponent, title: 'About Us' },
  { path: 'products/:id', component: ProductDetailComponent },
  { path: '**', component: NotFoundComponent, title: 'Page Not Found' }, // wildcard, must be last
];
```

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
  ],
};
```

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig);
```

`withComponentInputBinding()` is a router feature that automatically binds route/query params to component `@Input()` properties — covered in section 4. Other common features: `withHashLocation()` (use `#` in URLs instead of the HTML5 History API), `withDebugTracing()` (logs every navigation event to the console).

### Route Matching Order

Routes are matched **top to bottom**, first match wins. Static paths must come before parameterized ones that could shadow them, and the wildcard `**` must always be last.

```typescript
export const routes: Routes = [
  { path: 'products/new', component: NewProductComponent },  // must come before :id
  { path: 'products/:id', component: ProductDetailComponent },
  { path: '**', component: NotFoundComponent },
];
```

If `products/:id` were listed first, a navigation to `/products/new` would match it with `id = 'new'` instead of hitting `NewProductComponent`.

---

## 3. RouterLink and RouterOutlet

`RouterOutlet` is a directive that marks where the matched component renders. `RouterLink` replaces `href` for internal navigation — it prevents full page reloads and integrates with the router's state.

```typescript
// app.component.ts
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <nav>
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
      <a routerLink="/about" routerLinkActive="active">About</a>
      <a [routerLink]="['/products', 42]" routerLinkActive="active">Product 42</a>
    </nav>

    <router-outlet />
  `,
})
export class AppComponent {}
```

- `routerLink="/about"` — static path, string form.
- `[routerLink]="['/products', 42]"` — array form, useful when segments are dynamic.
- `routerLinkActive="active"` — adds the `active` CSS class when that link's path matches the current URL.
- `[routerLinkActiveOptions]="{ exact: true }"` — without this, the `Home` link (`/`) would stay "active" on every route, since `/` is a prefix of every path.

---

## 4. Route Parameters

Route parameters (`:id`) capture a dynamic segment of the URL. With `withComponentInputBinding()` enabled, you can bind them directly as component inputs — no manual subscription required.

```typescript
// app.routes.ts
{ path: 'products/:id', component: ProductDetailComponent }
```

```typescript
// product-detail.component.ts
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  template: `<h2>Product #{{ id }}</h2>`,
})
export class ProductDetailComponent {
  @Input() id!: string; // auto-populated from :id route param
}
```

Without input binding, read the parameter manually through `ActivatedRoute` (covered in section 6) — necessary in older Angular versions or when you need to react to parameter changes without the component being recreated.

---

## 5. Query Parameters

Query params (`?sort=price&page=2`) are optional key/value pairs appended after `?`, not part of the route path itself — used for filters, sorting, pagination.

```html
<a [routerLink]="['/products']" [queryParams]="{ sort: 'price', page: 2 }">
  Sorted Products
</a>
<!-- navigates to /products?sort=price&page=2 -->
```

Read them with `ActivatedRoute.queryParamMap`:

```typescript
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({ selector: 'app-product-list', standalone: true, template: `Sort: {{ sort() }}` })
export class ProductListComponent {
  private route = inject(ActivatedRoute);

  sort = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('sort') ?? 'name')),
    { initialValue: 'name' },
  );
}
```

Query params persist across navigations unless explicitly cleared — pass `queryParamsHandling: 'preserve'` or `'merge'` when navigating programmatically to keep or merge them.

---

## 6. ActivatedRoute Deep Dive

`ActivatedRoute` holds everything the router knows about the currently activated route: params, query params, data, url segments, and the parent/child route tree.

| Property | Type | Use |
|----------|------|-----|
| `paramMap` | `Observable<ParamMap>` | Reactive route params — fires again if params change without component destruction |
| `snapshot.paramMap` | `ParamMap` | One-time read at the moment of activation — no updates |
| `queryParamMap` | `Observable<ParamMap>` | Reactive query params |
| `data` | `Observable<Data>` | Static route `data` plus resolved data from resolvers |
| `url` | `Observable<UrlSegment[]>` | The matched URL segments for this route |

```typescript
import { Component, inject } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProductService } from './product.service';

@Component({ selector: 'app-product-detail', standalone: true, template: `{{ product()?.name }}` })
export class ProductDetailComponent {
  private route = inject(ActivatedRoute);
  private products = inject(ProductService);

  product = toSignal(
    this.route.paramMap.pipe(
      switchMap((params: ParamMap) => this.products.getById(params.get('id')!)),
    ),
  );
}
```

Use `paramMap` (Observable), not `snapshot.paramMap`, whenever the same component instance can be reused for a new set of params — e.g. navigating from `/products/1` to `/products/2` without leaving `ProductDetailComponent`. The snapshot would silently go stale.

---

## 7. Programmatic Navigation

Inject the `Router` service to navigate from code — after a form submit, a button click handler, or a guard.

```typescript
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({ selector: 'app-login', standalone: true, template: `<button (click)="onLogin()">Log in</button>` })
export class LoginComponent {
  private router = inject(Router);

  onLogin() {
    // ... authenticate ...
    this.router.navigate(['/dashboard'], { queryParams: { welcome: true } });
  }

  goToProduct(id: number) {
    this.router.navigate(['/products', id]);
  }

  goByUrl() {
    this.router.navigateByUrl('/products/42?sort=price');
  }
}
```

| Method | When to use |
|--------|-------------|
| `router.navigate(commands, extras)` | Array-based path segments, relative to `ActivatedRoute` if `relativeTo` is set |
| `router.navigateByUrl(url)` | A single absolute or fully-formed URL string |
| `extras.replaceUrl: true` | Replace the current history entry instead of pushing a new one (e.g. after login redirect) |
| `extras.relativeTo: this.route` | Navigate relative to the current route instead of the app root |

---

## 8. Hands-On Exercises

**Exercise 1:** Create a standalone app with three routes: `''` (Home), `'about'` (About), and `'**'` (NotFound). Wire up `provideRouter` in `app.config.ts` and add `RouterLink`/`RouterOutlet` to the root component's nav.

**Exercise 2:** Add a `products/:id` route. Build `ProductDetailComponent` with an `@Input() id` bound via `withComponentInputBinding()`. Verify navigating to `/products/7` renders "Product #7".

**Exercise 3:** Add a query-param-driven product list: `/products?sort=price`. Read `sort` via `ActivatedRoute.queryParamMap` and display it, defaulting to `'name'` when absent.

**Exercise 4:** Add `routerLinkActive="active"` styling to your nav links, and fix the Home link so it isn't marked active on every route (hint: `routerLinkActiveOptions`).

**Exercise 5:** Add a login button that calls `router.navigate(['/dashboard'], { replaceUrl: true })` on click. Confirm via browser dev tools that the login page is not left in the back-button history.

---

## 9. Interview Q&A

**Q: How do you configure the Angular Router in a standalone (non-NgModule) application?**
Answer: Call `provideRouter(routes)` inside the `providers` array of `ApplicationConfig` (in `app.config.ts`), and pass that config to `bootstrapApplication()`. Router features like `withComponentInputBinding()`, `withHashLocation()`, or `withPreloading()` are added as additional arguments to `provideRouter()`.

**Q: What's the difference between `ActivatedRoute.paramMap` and `ActivatedRoute.snapshot.paramMap`?**
Answer: `paramMap` is an Observable that emits every time route parameters change, including when the same component instance is reused for a new URL (e.g. `/products/1` → `/products/2`). `snapshot.paramMap` is a one-time synchronous read taken at activation — it goes stale if the component is reused, so it should only be used when you know the component will be destroyed and recreated on every navigation.

**Q: How do route parameters differ from query parameters?**
Answer: Route parameters (`:id`) are part of the path itself and are required for the route to match (`/products/:id`). Query parameters (`?sort=price`) are optional key-value pairs appended after `?`, used for filters/sorting/pagination, and persist across navigations if you use `queryParamsHandling: 'merge'` or `'preserve'`.

**Q: What does `withComponentInputBinding()` do?**
Answer: It's a router feature (passed to `provideRouter`) that automatically maps route parameters, query parameters, and resolved data to a component's `@Input()` properties by matching names — removing the need to manually inject `ActivatedRoute` and subscribe to `paramMap` for simple cases.

**Q: Why must the wildcard route (`path: '**'`) always be the last entry in a Routes array?**
Answer: Routes are matched in array order, and `**` matches any URL. If it were placed earlier, it would shadow every route defined after it, since the router stops at the first match.
