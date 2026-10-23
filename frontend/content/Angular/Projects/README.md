# Angular Master Course — Projects

This section contains six hands-on projects that take you from a handful of static, presentation-only components all the way to a production-ready, SSR-enabled, fully-tested Angular application. Complete them in order; each one builds on the skills introduced in earlier phases of the course, and every project uses Angular 17+ standalone components, Signals, and the new `@if`/`@for` control-flow syntax.

## Project Overview

| # | Project | Level | Phase Prerequisites | Description |
|---|---------|-------|---------------------|-------------|
| 1 | Recipe Card Gallery | Beginner | Phase 3 – Components & Templates | Build a static, reusable component library that renders a gallery of recipe cards using inputs, directives, and pipes |
| 2 | Task Manager | Beginner-Intermediate | Phase 5 – Services & DI | Build a task manager backed by an injectable service and Signal-based state, with add/complete/delete/filter operations |
| 3 | Bookstore Catalog | Intermediate | Phase 6-7 – Routing & Forms | Multi-page app with lazy-loaded routes, route guards, resolvers, and a reactive form for adding/editing books |
| 4 | E-commerce Storefront | Intermediate-Advanced | Phase 8 – HTTP & Interceptors | Storefront that fetches a product catalog from a real REST API, manages a cart with Signals, and submits a checkout form through an HTTP interceptor pipeline |
| 5 | Real-Time Dashboard | Advanced | Phase 9-10 – Signals & Advanced Components | Live-updating analytics dashboard driven entirely by Signals, `computed()`, and `effect()`, with content projection and `ViewChild` |
| 6 | Production-Ready Blog Platform | Advanced | Phase 11-12 – Testing & Performance | SSR-enabled blog with full unit test coverage, `OnPush` change detection, and a CI-ready optimized build |

---

## Project Summaries

### 1. Recipe Card Gallery (Beginner)
Build a small library of standalone, presentation-only components — a `RecipeCardComponent`, a `RatingStarsComponent`, and a `TagListComponent` — and compose them into a gallery using `@for` and `@if`. You will practise `@Input()`/`@Output()` bindings, structural control flow, a couple of built-in directives (`NgClass`/`class` bindings), and a custom pipe (`cookTime` → "1h 15m") to exercise everything covered in Phase 3 and 4 without touching services or routing yet.

### 2. Task Manager (Beginner-Intermediate)
Build a task manager where all state lives in an injectable `TaskService` using `signal()` and `computed()` rather than component fields. The UI subscribes to the service's signals to add, complete, delete, and filter tasks (all / active / completed), demonstrating dependency injection, a `providedIn: 'root'` singleton service, and Signal-based state sharing across sibling components.

### 3. Bookstore Catalog (Intermediate)
A multi-page catalog with a book list route, a book detail route (with a resolver that pre-fetches the book before the route activates), and an "Add/Edit Book" route protected by a route guard that only admins can reach. The add/edit form is built with Reactive Forms and custom validators, tying together routing, guards, resolvers, and forms from Phases 6 and 7.

### 4. E-commerce Storefront (Intermediate-Advanced)
A storefront that fetches its product catalog from the public Fake Store API using `HttpClient`, with a custom `HttpInterceptorFn` that attaches headers and centralizes error handling. Cart state is held in Signals so the cart badge and totals update reactively as items are added or removed, and checkout is submitted through a Reactive Form validated against the cart contents — exercising HTTP, interceptors, forms, and Signal-driven state together.

### 5. Real-Time Dashboard (Advanced)
An analytics dashboard where every metric tile is a `computed()` signal derived from a simulated live data stream (an `effect()` polling an interval or a `toSignal()`-wrapped `Observable`). Reusable widget components use content projection (`<ng-content>`) for custom tile layouts and `ViewChild` to imperatively trigger a chart redraw, going deep on the Signals API and advanced component composition from Phases 9 and 10.

### 6. Production-Ready Blog Platform (Advanced)
Take a blog application through Angular's SSR/hydration pipeline, add `ChangeDetectionStrategy.OnPush` across all components, write unit tests (Jasmine/Karma) for services and components until coverage crosses a meaningful threshold, and produce an optimized production build wired into a CI-ready npm script — the capstone that exercises testing, SSR, and performance tuning from Phases 11 and 12.
