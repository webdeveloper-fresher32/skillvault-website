# Phase 12: Performance & Deployment

> Change detection internals, zoneless Angular, server-side rendering with hydration, and shipping optimized production builds.

---

## What You'll Learn

This is the final phase of the Angular course. It moves past "how do I build features" into "how do I make this fast and get it into production." You'll learn how Angular actually detects changes and re-renders the DOM, how to opt out of the default zone.js-based checking with `OnPush` and signals, how to render your app on the server for better SEO and perceived performance, and how to shrink and ship your final bundle across real deployment targets (static hosting, Docker + Nginx, Node SSR servers).

---

## Learning Objectives

- Understand Angular's default change detection mechanism (zone.js) and how `ChangeDetectionStrategy.OnPush` reduces unnecessary checks.
- Explain how Signals enable zoneless change detection and know the immutability patterns `OnPush` requires.
- Implement Server-Side Rendering (SSR) with non-destructive hydration, and use `TransferState` to avoid duplicate data fetches.
- Use deferrable views (`@defer`) to split bundles and lazy-load non-critical UI.
- Produce and analyze a production build, then deploy it to static hosting, a Docker/Nginx container, or a Node SSR server.

---

## Topics

| # | File | Topic | Duration |
|---|------|-------|----------|
| 01 | [01-Change-Detection-and-OnPush.md](./01-Change-Detection-and-OnPush.md) | Change Detection & OnPush | 1 day |
| 02 | [02-SSR-and-Hydration.md](./02-SSR-and-Hydration.md) | SSR & Hydration | 1 day |
| 03 | [03-Build-Optimization-and-Deployment.md](./03-Build-Optimization-and-Deployment.md) | Build Optimization & Deployment | 1 day |

---

## Estimated Time

**3 days**

---

## Prerequisites

Before starting this phase, make sure you're comfortable with:

- Signals, `computed`, and `effect` (Phase 09)
- Standalone components and the `@if` / `@for` control flow (Phase 03)
- The Angular CLI and workspace basics (Phase 02)

---

## Up Next

This is the last phase in the learning path. From here:

- **`Quick-Reference/`** — the Angular cheatsheet and 50-question interview Q&A bank, covering the whole course including this phase.
- **`Projects/`** — build the Task Manager and E-commerce storefront projects end-to-end, applying `OnPush`, `@defer`, and a production build/deploy pipeline to real code.

---

*Phase 12 of the Angular Learning Series*
