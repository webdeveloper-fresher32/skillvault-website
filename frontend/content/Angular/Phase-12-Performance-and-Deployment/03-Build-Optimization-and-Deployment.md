# Build Optimization and Deployment — Complete Guide

## Table of Contents
1. [Production Builds](#1-production-builds)
2. [Lazy Loading and Bundle Size](#2-lazy-loading-and-bundle-size)
3. [Deferrable Views (@defer)](#3-deferrable-views-defer)
4. [Bundle Analysis](#4-bundle-analysis)
5. [Deployment Targets](#5-deployment-targets)
6. [Worked Example: A Full @defer Block](#6-worked-example-a-full-defer-block)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Production Builds

`ng build` on its own (Angular 17+) already defaults to a production-optimized build, but it's worth understanding what "production configuration" actually turns on, because it explains *why* bundle sizes shrink and errors change between `ng serve` and a real build.

```bash
ng build --configuration production
# Angular 17+: `ng build` defaults to the production configuration already,
# but being explicit is still common in CI scripts.
```

```
Development build:                    Production build:
- Source maps: inline, verbose        - Source maps: optional, separate files
- Minification: off                   - Minification: on (esbuild/Terser)
- Tree-shaking: partial               - Tree-shaking: aggressive (dead code removed)
- AOT compilation: on (17+ default)   - AOT compilation: on
- Bundle budgets: warn only           - Bundle budgets: ENFORCED (build fails if exceeded)
- Angular checks: extra dev warnings  - Angular checks: stripped for size/speed
```

`angular.json` defines size budgets per configuration:

```json
{
  "budgets": [
    { "type": "initial", "maximumWarning": "500kb", "maximumError": "1mb" },
    { "type": "anyComponentStyle", "maximumWarning": "4kb", "maximumError": "8kb" }
  ]
}
```

Exceeding `maximumError` **fails the production build** — this is a deliberate guardrail so a large dependency doesn't silently balloon your initial bundle without anyone noticing.

---

## 2. Lazy Loading and Bundle Size

Every route loaded eagerly (imported directly in `app.routes.ts` or a component's `imports`) ships in the **initial bundle** — the JS the browser must download before the app can render anything at all. Lazy loading defers a route's code until the user actually navigates to it.

```typescript
// app.routes.ts

// ❌ Eager — ProductsComponent and its dependencies ship in the initial bundle
import { ProductsComponent } from './products/products.component';
export const routes: Routes = [
  { path: 'products', component: ProductsComponent },
];

// ✅ Lazy — this route's JS is a separate chunk, fetched on navigation
export const routes: Routes = [
  {
    path: 'products',
    loadComponent: () => import('./products/products.component').then(m => m.ProductsComponent),
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },
];
```

```
Without lazy loading:                 With lazy loading:
┌───────────────────────┐             ┌───────┐  ┌──────────┐  ┌───────┐
│   main.js (huge)      │             │main.js│  │products.js│ │admin.js│
│  home+products+admin  │             │(home) │  │ (on-demand)│(on-demand)
│  all fetched upfront  │             └───────┘  └──────────┘  └───────┘
└───────────────────────┘             Initial download is small; feature
Initial download: everything          chunks fetched only when visited
```

The practical effect: a 2MB app split across 15 lazy routes might have an initial bundle of only 150-200KB — everything else downloads on demand, right before it's needed.

---

## 3. Deferrable Views (@defer)

Lazy loading works at the **route** level. `@defer` (Angular 17+) works at the **template** level — deferring the loading and rendering of a chunk of a component's own template (and the components it uses) until some trigger fires.

```html
@defer (on viewport) {
  <app-comments-section [postId]="postId()" />
} @placeholder {
  <p>Comments will load when you scroll here.</p>
} @loading (minimum 200ms) {
  <app-spinner />
} @error {
  <p>Couldn't load comments. Please refresh.</p>
}
```

Available triggers:

| Trigger | Fires when |
|---|---|
| `on idle` (default) | Browser is idle after initial render |
| `on viewport` | The block scrolls into the viewport |
| `on interaction` | User clicks/taps the placeholder (or a referenced element) |
| `on hover` | User hovers the placeholder |
| `on timer(Xms)` | X milliseconds after the page becomes stable |
| `when <expression>` | A custom condition (e.g. a signal) becomes true |

`@defer` blocks and everything they reference are compiled into **separate lazy-loaded chunks** by the build, automatically — no manual `import()` needed like route-level lazy loading.

```
Initial page load:                    Later (trigger fires):
main.js — no comments-section code    comments-section-chunk.js fetched
Fast initial paint, smaller bundle    Rendered in place of the placeholder
```

---

## 4. Bundle Analysis

`source-map-explorer` visualizes exactly what's contributing to bundle size, using the source maps generated by a build.

```bash
npm install --save-dev source-map-explorer

ng build --configuration production --source-map

npx source-map-explorer dist/my-app/browser/*.js
```

This opens an interactive treemap in the browser — box size proportional to bytes contributed. Typical findings:

```
main-XYZ123.js (312 KB)
├── @angular/core            (68 KB)
├── @angular/router          (22 KB)
├── rxjs                     (31 KB)
├── moment.js                (67 KB)  ← red flag: heavy, often replaceable
│     (imported for one date format call)
├── lodash (full import)     (71 KB)  ← red flag: should be lodash-es + tree-shaking
└── your app code            (53 KB)
```

Common wins once you can see this breakdown: replacing `moment` with `date-fns` or native `Intl.DateTimeFormat`, importing individual `lodash-es` functions instead of the whole library, and moving anything only needed by a rarely-visited route behind `loadComponent`/`@defer` instead of the initial bundle.

Angular CLI also prints a build stats table by default:

```
Initial chunk files   | Names         |  Raw size
main-ABC123.js        | main          | 187.42 kB
polyfills-DEF456.js   | polyfills     |  33.99 kB
styles-GHI789.css     | styles        |  12.10 kB

Lazy chunk files      | Names         |  Raw size
products-JKL012.js    | products      |  41.55 kB
admin-MNO345.js       | admin         |  76.20 kB
```

---

## 5. Deployment Targets

Angular apps typically ship to one of three kinds of target, depending on whether SSR is in use.

### Static hosting (CSR-only apps)

The `dist/my-app/browser` output is plain static files — deployable to any static host (Netlify, Vercel, S3+CloudFront, GitHub Pages, Firebase Hosting).

```bash
ng build --configuration production
# upload dist/my-app/browser/* to your static host
```

Requires a rewrite rule so deep links (`/products/42`) fall back to `index.html` for the Angular router to handle client-side.

### Docker container with Nginx (CSR-only apps)

```dockerfile
# Stage 1: build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

# Stage 2: serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist/my-app/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# nginx.conf — SPA fallback so client-side routing works
server {
  listen 80;
  root /usr/share/nginx/html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### Node SSR server (apps using @angular/ssr)

SSR apps need a running Node process, not just static files, since HTML is rendered per-request.

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist/my-app ./dist/my-app
COPY --from=build /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/my-app/server/server.mjs"]
```

```
Static hosting:        CDN serves files directly, cheapest, no server cost
Docker + Nginx:        Full control over headers/caching, container orchestration
Node SSR server:       Required if using @angular/ssr — needs a running process
                       (Cloud Run, ECS, a VM, or a platform like Vercel/Render
                        that supports Node server deployments)
```

| Target | Use when |
|---|---|
| Static hosting | CSR-only app, no SSR, cheapest and simplest |
| Docker + Nginx | Need custom headers/caching/auth in front of a CSR build, or standardized container deployment |
| Node SSR server | App uses `@angular/ssr` — HTML must be rendered per request |

---

## 6. Worked Example: A Full @defer Block

A product detail page where the main product info should render immediately, but a "related products" carousel (which needs its own API call and image-heavy component) should only load once the user scrolls near it.

```html
<!-- product-detail.component.html -->
<article>
  <h1>{{ product().name }}</h1>
  <p>{{ product().description }}</p>
  <p class="price">{{ product().price | currency }}</p>
</article>

@defer (on viewport; prefetch on idle) {
  <app-related-products [productId]="product().id" />
} @placeholder (minimum 100ms) {
  <div class="related-placeholder">
    <p>More products like this</p>
  </div>
} @loading (after 100ms; minimum 300ms) {
  <app-skeleton-carousel />
} @error {
  <p class="error-text">
    Couldn't load related products.
    <button (click)="retry()">Try again</button>
  </p>
}
```

```typescript
// product-detail.component.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RelatedProductsComponent } from './related-products.component';
import { SkeletonCarouselComponent } from './skeleton-carousel.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RelatedProductsComponent, SkeletonCarouselComponent],
  templateUrl: './product-detail.component.html',
})
export class ProductDetailComponent {
  product = input.required<Product>();

  retry() {
    // re-trigger the @defer block, e.g. by toggling a signal it depends on
  }
}
```

What this achieves:

- **`on viewport`** — the related-products chunk isn't fetched or rendered until the user scrolls close to it, so it never delays the initial product render.
- **`prefetch on idle`** — the *code* for `RelatedProductsComponent` is prefetched as soon as the browser is idle (even before it's in view), so when the viewport trigger does fire, there's no network wait — only the API call for the actual data remains.
- **`@placeholder (minimum 100ms)`** — avoids a flash of placeholder content if the block resolves almost instantly.
- **`@loading (after 100ms; minimum 300ms)`** — only shows the skeleton if loading takes longer than 100ms, and once shown, keeps it for at least 300ms to avoid a jarring flicker.
- **`@error`** — if the related-products chunk or its data fetch fails, the user gets a retry affordance instead of a broken page.
- **`RelatedProductsComponent` and `SkeletonCarouselComponent` code ship in separate lazy chunks**, verifiable in the build output and in a `source-map-explorer` treemap — neither contributes to the initial bundle size of the product detail page.

---

## 7. Hands-On Exercises

**Exercise 1:** Run `ng build --configuration production` on an app with a deliberately oversized dependency (e.g. the full `lodash` or `moment`) until the build fails its budget check in `angular.json`. Lower `maximumError` if needed to force the failure, then fix it by removing/replacing the dependency.

**Exercise 2:** Convert two eagerly-imported routes to `loadComponent`/`loadChildren`. Rebuild and confirm in the CLI's build output table that each now appears under "Lazy chunk files" instead of contributing to `main.js`.

**Exercise 3:** Install `source-map-explorer`, build with `--source-map`, and run it against your `dist` output. Identify the single largest third-party dependency and propose (or make) one concrete change to shrink it.

**Exercise 4:** Wrap a heavy, below-the-fold component in `@defer (on viewport)` with `@placeholder`, `@loading`, and `@error` blocks. Confirm in the Network tab that its chunk isn't requested until you scroll it into view.

**Exercise 5:** Write a two-stage Dockerfile (build stage + Nginx serve stage) for a CSR-only Angular app, including an `nginx.conf` SPA fallback rule. Build the image, run the container, and confirm both the root route and a deep-linked route (e.g. `/products/42` typed directly into the browser) load correctly.

---

## 8. Interview Q&A

**Q: What does `ng build --configuration production` change compared to a default/dev build?**
Answer: It enables aggressive minification and tree-shaking, produces separate (optional) source maps instead of inline dev ones, strips extra development-only Angular checks, and enforces the size budgets defined in `angular.json` — a build that exceeds `maximumError` for a budget fails outright, which is a deliberate guardrail against unnoticed bundle bloat.

**Q: How does lazy loading routes reduce initial bundle size, and what's the syntax for it in a standalone Angular app?**
Answer: Code for a route is only fetched when the user navigates to it, instead of being bundled into `main.js` upfront. In a standalone-components setup this is done with `loadComponent: () => import('./x.component').then(m => m.XComponent)` for a single component, or `loadChildren` pointing at a routes file for a whole feature area — each becomes its own chunk in the build output.

**Q: How is `@defer` different from route-level lazy loading, and what triggers can control it?**
Answer: Route-level lazy loading defers loading an entire routed feature; `@defer` defers loading and rendering a piece of a component's own template, along with the components it references, and is compiled into a separate chunk automatically. Triggers include `on idle` (default), `on viewport`, `on interaction`, `on hover`, `on timer(Xms)`, and a custom `when <expression>`, plus optional `@placeholder`, `@loading`, and `@error` sub-blocks for UI states.

**Q: What does `source-map-explorer` show you, and what's a typical finding it surfaces?**
Answer: Given a production build's source maps, it renders an interactive treemap where box size is proportional to the bytes each module/dependency contributes to a bundle. A typical finding is a large third-party dependency (e.g. full `lodash` or `moment`) pulled in for a small feature — prompting a swap to a tree-shakeable alternative (`lodash-es`, `date-fns`) or moving that code behind lazy loading/`@defer`.

**Q: When would you deploy an Angular app to static hosting versus a Node SSR server?**
Answer: A CSR-only app (no `@angular/ssr`) is just static files after build and can go to any static host or a Docker+Nginx container with an SPA fallback rule — cheap and simple. An app using Angular's built-in SSR must render HTML per request, so it needs a running Node process (bare Node, Docker container running `server.mjs`, or a platform that supports Node servers) rather than pure static hosting.
