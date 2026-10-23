# Resolvers and Advanced Routing — Complete Guide

## Table of Contents
1. [Why Resolvers](#1-why-resolvers)
2. [Functional Resolvers](#2-functional-resolvers)
3. [Nested and Child Routes](#3-nested-and-child-routes)
4. [Named Router Outlets](#4-named-router-outlets)
5. [Route Animations Overview](#5-route-animations-overview)
6. [Worked Example: Resolver + Detail Page](#6-worked-example-resolver--detail-page)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Resolvers

Without a resolver, a detail component typically renders immediately with no data, then fetches it in `ngOnInit` — leaving the template to juggle loading spinners and null checks until the response arrives.

```
Without a resolver:
  Navigate → route activates instantly → component renders empty/loading state
           → ngOnInit fires HTTP call → data arrives late → template re-renders

With a resolver:
  Navigate → router calls resolver → HTTP call runs BEFORE activation
           → route activates only once data is ready → component renders with data already present
```

A resolver is a function the router runs **before** activating a route. Navigation waits for the resolver's Observable/Promise to complete (or error), and the resolved value is attached to `ActivatedRoute.data`. This trades a slightly delayed navigation for a component that never has to render a "loading" state for its primary data.

---

## 2. Functional Resolvers

Like guards, resolvers are plain functions (`ResolveFn<T>`) that use `inject()` to reach services.

```typescript
// product.resolver.ts
import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Product } from './product.model';
import { ProductService } from './product.service';

export const productResolver: ResolveFn<Product> = (route) => {
  const productService = inject(ProductService);
  const id = route.paramMap.get('id')!;
  return productService.getById(id); // Observable<Product> — router waits for it to emit
};
```

```typescript
// products.routes.ts
import { Routes } from '@angular/router';
import { productResolver } from './product.resolver';

export const PRODUCTS_ROUTES: Routes = [
  {
    path: ':id',
    loadComponent: () => import('./product-detail.component').then((m) => m.ProductDetailComponent),
    resolve: { product: productResolver },
  },
];
```

```typescript
// product-detail.component.ts
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Product } from '../product.model';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  template: `<h2>{{ product()?.name }}</h2><p>{{ product()?.price | currency }}</p>`,
})
export class ProductDetailComponent {
  private route = inject(ActivatedRoute);

  product = toSignal(this.route.data.pipe(map((d) => d['product'] as Product)));
}
```

The key `product` in `resolve: { product: productResolver }` becomes the key under `route.data` — `route.data['product']`. If the resolver's Observable errors, navigation is cancelled by default (handle errors inside the resolver itself, e.g. with `catchError`, if you want a graceful fallback instead of a blocked navigation).

---

## 3. Nested and Child Routes

Child routes render inside a **parent's own** `<router-outlet>`, not the root one — this is how layout shells (a dashboard with a persistent sidebar) keep chrome in place while only the inner content swaps.

```typescript
// dashboard.routes.ts
import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard-shell.component').then((m) => m.DashboardShellComponent),
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', loadComponent: () => import('./overview.component').then((m) => m.OverviewComponent) },
      { path: 'billing', loadComponent: () => import('./billing.component').then((m) => m.BillingComponent) },
      { path: 'settings', loadComponent: () => import('./settings.component').then((m) => m.SettingsComponent) },
    ],
  },
];
```

```typescript
// dashboard-shell.component.ts
import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: `
    <div class="layout">
      <aside>
        <a routerLink="overview">Overview</a>
        <a routerLink="billing">Billing</a>
        <a routerLink="settings">Settings</a>
      </aside>
      <main>
        <router-outlet /> <!-- child route renders here, sidebar stays put -->
      </main>
    </div>
  `,
})
export class DashboardShellComponent {}
```

`{ path: '', redirectTo: 'overview', pathMatch: 'full' }` handles the bare `/dashboard` URL by redirecting to `/dashboard/overview` — `pathMatch: 'full'` means "only redirect if the **entire** remaining URL is empty," as opposed to `'prefix'` (the default), which would match too eagerly.

---

## 4. Named Router Outlets

A component can have more than one `<router-outlet>` if each is given a name — used for things like a modal, a side panel, or an auxiliary "chat" pane that's independently routable alongside the primary content.

```typescript
export const routes: Routes = [
  { path: '', loadComponent: () => import('./home.component').then((m) => m.HomeComponent) },
  {
    path: 'compose',
    outlet: 'popup',
    loadComponent: () => import('./compose-modal.component').then((m) => m.ComposeModalComponent),
  },
];
```

```html
<!-- app.component.html -->
<router-outlet></router-outlet>
<router-outlet name="popup"></router-outlet>
```

Navigate to a named outlet using an outlets object, keeping the primary route untouched:

```typescript
this.router.navigate([{ outlets: { popup: ['compose'] } }]);

// clear the popup outlet, e.g. on modal close:
this.router.navigate([{ outlets: { popup: null } }]);
```

The URL reflects both outlets simultaneously, e.g. `/inbox(popup:compose)` — the primary outlet shows `Inbox`, and the named `popup` outlet shows `ComposeModalComponent`, both addressable and bookmarkable independently.

---

## 5. Route Animations Overview

Angular's router attaches a `data` value you control to each route, which the `@angular/animations` package can key off of to transition between pages (e.g. slide, fade). The general shape:

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: 'list', component: ListComponent, data: { animation: 'ListPage' } },
  { path: 'detail/:id', component: DetailComponent, data: { animation: 'DetailPage' } },
];
```

```typescript
// app.component.ts (excerpt)
import { Component, inject } from '@angular/core';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { trigger, transition, style, animate, query, group } from '@angular/animations';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  animations: [
    trigger('routeAnimations', [
      transition('ListPage <=> DetailPage', [
        query(':enter, :leave', style({ position: 'absolute', width: '100%' }), { optional: true }),
        group([
          query(':leave', [animate('200ms ease-out', style({ opacity: 0 }))], { optional: true }),
          query(':enter', [style({ opacity: 0 }), animate('200ms ease-in', style({ opacity: 1 }))], { optional: true }),
        ]),
      ]),
    ]),
  ],
  template: `<div [@routeAnimations]="getAnimationData()"><router-outlet /></div>`,
})
export class AppComponent {
  private route = inject(ActivatedRoute);
  getAnimationData() {
    return this.route.snapshot.firstChild?.data?.['animation'];
  }
}
```

The full animation DSL is out of scope here — the key routing concept is that `data` on a route is an arbitrary bag you attach to any route, and it flows through to `ActivatedRouteSnapshot.data`, making it usable for animation state, breadcrumbs, page titles, permission hints, or anything else route-specific.

---

## 6. Worked Example: Resolver + Detail Page

Putting resolvers and nested routing together — a product list with a nested detail route, where the detail route's data is pre-fetched by a resolver before the page renders.

```typescript
// product.model.ts
export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}
```

```typescript
// product.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from './product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  getById(id: string): Observable<Product> {
    return this.http.get<Product>(`/api/products/${id}`);
  }
}
```

```typescript
// product.resolver.ts
import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';
import { Product } from './product.model';
import { ProductService } from './product.service';

export const productResolver: ResolveFn<Product | null> = (route) => {
  const productService = inject(ProductService);
  const id = route.paramMap.get('id')!;
  return productService.getById(id).pipe(
    catchError(() => of(null)), // don't block navigation on a failed fetch — let the component handle "not found"
  );
};
```

```typescript
// products.routes.ts
import { Routes } from '@angular/router';
import { productResolver } from './product.resolver';

export const PRODUCTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./product-list.component').then((m) => m.ProductListComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./product-detail.component').then((m) => m.ProductDetailComponent),
    resolve: { product: productResolver },
    title: 'Product Details',
  },
];
```

```typescript
// product-detail.component.ts
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CurrencyPipe } from '@angular/common';
import { Product } from '../product.model';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  template: `
    @if (product(); as p) {
      <h2>{{ p.name }}</h2>
      <p>{{ p.price | currency }}</p>
      <p>{{ p.description }}</p>
    } @else {
      <p>Product not found. <a routerLink="/products">Back to list</a></p>
    }
  `,
})
export class ProductDetailComponent {
  private route = inject(ActivatedRoute);
  product = toSignal(this.route.data.pipe(map((d) => d['product'] as Product | null)));
}
```

By the time `ProductDetailComponent` is created, `product()` already holds the resolved value — no loading spinner, no `ngOnInit` fetch, and a graceful "not found" branch if the resolver's `catchError` returned `null`.

---

## 7. Hands-On Exercises

**Exercise 1:** Write a `productResolver` using `ResolveFn<Product>` against a mock `ProductService`. Wire it into a `:id` route and confirm `ActivatedRoute.data` contains the resolved product before the component's template renders.

**Exercise 2:** Build a `dashboard` layout with a persistent sidebar and three child routes (`overview`, `billing`, `settings`) rendering into the shell's own `<router-outlet>`. Add a redirect so bare `/dashboard` lands on `/dashboard/overview`.

**Exercise 3:** Add a named `popup` outlet to your root component. Create a route with `outlet: 'popup'` and navigate to it with `router.navigate([{ outlets: { popup: ['compose'] } }])`. Confirm the URL shows both outlets, e.g. `/dashboard(popup:compose)`.

**Exercise 4:** Make the resolver from Exercise 1 resilient: use `catchError` to return `null` instead of letting navigation fail when the HTTP call errors. Update the component template to show a "not found" branch when the resolved value is `null`.

**Exercise 5:** Attach `data: { animation: 'ListPage' }` and `data: { animation: 'DetailPage' }` to a list and detail route respectively, and read `route.snapshot.firstChild?.data['animation']` from the root component to confirm the value flows through correctly (full animation wiring is optional).

---

## 8. Interview Q&A

**Q: What problem do resolvers solve, and when should you avoid using one?**
Answer: Resolvers pre-fetch data before a route activates, so the component never has to render an empty/loading state for its primary data — the router waits for the resolver to complete first. Avoid them for slow or non-critical data (e.g. a secondary analytics call), since the entire navigation blocks until the resolver resolves; in that case, fetch it in the component instead and show a loading indicator.

**Q: How do nested (child) routes differ from top-level routes in terms of rendering?**
Answer: A top-level route renders into the root `<router-outlet>` in `AppComponent`. A child route (declared under a parent's `children: [...]`) renders into the **parent component's own** `<router-outlet>`, letting you keep shared layout (like a sidebar or header) in place while only the inner content changes as the child route changes.

**Q: What does `pathMatch: 'full'` do, and when do you need it?**
Answer: It tells the router that a route should only match if the **entire remaining URL** is consumed, not just a prefix. It's required on empty-path redirects (`{ path: '', redirectTo: 'overview', pathMatch: 'full' }`) — without it, the default `pathMatch: 'prefix'` would treat every URL under that parent as matching the empty path and always redirect.

**Q: What is a named router outlet used for, and how do you navigate to one?**
Answer: A named outlet (`<router-outlet name="popup">`) lets a component render more than one independently-routable region at once, e.g. a modal or side panel alongside the primary view. You navigate to it with an outlets object, e.g. `router.navigate([{ outlets: { popup: ['compose'] } }])`, and clear it by setting that outlet's value to `null`.

**Q: If a resolver's Observable throws an error, what happens to the navigation by default, and how do you change that?**
Answer: By default, an error in a resolver cancels the navigation entirely — the route never activates and the user stays on the previous page. To avoid blocking navigation on a failed fetch, catch the error inside the resolver itself (e.g. `catchError(() => of(null))`) and let the component's template handle the fallback/"not found" case instead.
