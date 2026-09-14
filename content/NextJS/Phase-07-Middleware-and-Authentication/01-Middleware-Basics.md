# Middleware Basics — Complete Guide

> "A building's front-desk guard checks every visitor's badge once, at the door — not a separate guard posted outside each office."

---

## Table of Contents

1. [The Problem: Checks That Shouldn't Live in Every Route](#1-the-problem-checks-that-shouldnt-live-in-every-route)
2. [The Front-Desk Security Guard Analogy](#2-the-front-desk-security-guard-analogy)
3. [The Mechanism: middleware.js and config.matcher](#3-the-mechanism-middlewarejs-and-configmatcher)
4. [Diagram: Where Middleware Runs in the Request Lifecycle](#4-diagram-where-middleware-runs-in-the-request-lifecycle)
5. [Code Walkthrough: Matcher-Decision Logic](#5-code-walkthrough-matcher-decision-logic)
6. [Comparing Middleware to a Per-Page Auth Check](#6-comparing-middleware-to-a-per-page-auth-check)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Checks That Shouldn't Live in Every Route

Some logic needs to run *before* a request ever reaches a specific page or Route Handler: redirecting an unauthenticated visitor, bucketing a user into an A/B test variant, or routing a request differently based on geolocation.

### Repeating the Same Check in Every Route

```text
Without a shared checkpoint:
  app/dashboard/page.js        → re-check "is this user logged in?"
  app/settings/page.js         → re-check "is this user logged in?"
  app/api/orders/route.js      → re-check "is this user logged in?"
  ...repeated in every route that needs the same guard
```

### What's Missing

Copy-pasting the same check into every route that needs it works, but it's duplicated logic that has to be remembered and kept in sync everywhere it's pasted. What's missing is a single place upstream of all of them where the check can happen once.

---

## 2. The Front-Desk Security Guard Analogy

A large office building doesn't post a separate security guard outside every floor and every office door. It posts one guard at the front desk who checks every visitor's badge before they're allowed anywhere past the lobby.

### One Guard, Not One Per Office

```text
No front desk  → a guard stationed outside Floor 3, another outside
                  Floor 7, another outside the server room — badge
                  checked separately, redundantly, at every door

Front desk     → one guard, one checkpoint, checked once — by the
                  time a visitor reaches any specific floor, the
                  badge check has already happened
```

### Mapping the Analogy to Middleware

The guard doesn't need to know what happens inside any particular office — only whether this visitor is allowed past the lobby at all. Middleware plays exactly that role for incoming requests.

---

## 3. The Mechanism: middleware.js and config.matcher

A single `middleware.js` file at the project root exports a `middleware(request)` function that Next.js runs before a matched request reaches its route.

### The middleware.js File

```js
// middleware.js
import { NextResponse } from 'next/server';

export function middleware(request) {
  const isLoggedIn = request.cookies.has('session');

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next(); // continue to the actual route as normal
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*'],
};
```

### Reading the Return Values and the Matcher

```text
NextResponse.redirect(url) → send the browser somewhere else entirely
NextResponse.rewrite(url)  → serve different content, URL bar unchanged
NextResponse.next()        → let the request continue, unmodified

config.matcher              → an array of path patterns; middleware only
                               runs for requests whose path matches one
                               of them — everything else skips it entirely
```

### Running on the Edge Runtime

As referenced in Phase 5, Lesson 3, this `middleware(request)` function has historically executed on the Edge runtime by default — the same restricted, Web-standard-APIs-only environment Route Handlers can opt into with `runtime = 'edge'` — and unlike a Route Handler, it hasn't been a per-file opt-in choice. Middleware's runtime support has itself been an active area of change across recent Next.js releases, so this is worth verifying against your installed version's current docs rather than treating "Edge, always" as a permanent fact — but whichever runtime it ends up on, it still runs ahead of every matched request, which is exactly why it needs to stay fast and lightweight (Section 7).

---

## 4. Diagram: Where Middleware Runs in the Request Lifecycle

### The Request Lifecycle

```text
Incoming request
        │
        ▼
Does the request path match config.matcher?
        │
   ┌────┴────┐
   No         Yes
   │           │
   ▼           ▼
Middleware   middleware.js runs (Edge runtime, by default)
skipped      → decides: redirect / rewrite / next()
   │           │
   │      ┌────┴─────┐
   │    redirect/   next()
   │    rewrite       │
   │      │           ▼
   │      │    The matched route's Server Component
   │      │    or Route Handler runs as normal
   ▼      ▼           │
Route runs  Response sent
as normal   for the redirect/
            rewrite instead
```

### Reading the Diagram

Only when Middleware calls `NextResponse.next()` does the originally requested route's own rendering or handler logic ever execute — a redirect or rewrite short-circuits everything downstream of it.

---

## 5. Code Walkthrough: Matcher-Decision Logic

`config.matcher` patterns are ultimately just path-matching rules. The underlying decision — "should Middleware run for this path?" — is plain, testable logic, independent of any actual HTTP request:

### The Matcher-Decision Function

```js
// matcher-logic.js — pure logic, runnable/testable in isolation, no
// Next.js runtime required to exercise it

function pathMatchesPattern(path, pattern) {
  // Convert a matcher-style pattern ("/dashboard/:path*") into a regex.
  const regexPattern = pattern
    .replace(/:path\*/g, '.*')   // :path* → match any remaining segments
    .replace(/:path\+/g, '.+');  // :path+ → match one or more segments

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

function shouldRunMiddleware(path, matcherList) {
  return matcherList.some((pattern) => pathMatchesPattern(path, pattern));
}

// Example usage:
shouldRunMiddleware('/dashboard/settings', ['/dashboard/:path*']); // true
shouldRunMiddleware('/about', ['/dashboard/:path*', '/settings/:path*']); // false
shouldRunMiddleware('/settings', ['/settings/:path*']); // true
```

### What This Simplifies

```text
This is a simplification of Next.js's actual matcher-compilation
internals, but it captures the real decision being made: is the
incoming path one of the ones this middleware.js cares about at all?
Test it directly with a few (path, matcherList) pairs and check the
boolean it returns — no server needed to verify the logic itself.
```

---

## 6. Comparing Middleware to a Per-Page Auth Check

Both an auth check written directly inside every protected Server Component and a check written once inside Middleware can enforce "only logged-in users allowed" — the difference is where and how often the check happens.

### Middleware vs Per-Page Check

| | Middleware | Per-Page Check (inside a Server Component) |
|---|---|---|
| Runs when | Before routing/rendering starts, for every request matching `config.matcher` | After the route has already been selected, as part of that component's own render |
| Where maintained | One file, one place to update the rule | Duplicated into every component that needs the same guard |
| Runtime | Historically the Edge runtime by default (verify against your installed version) | Whatever runtime that route itself uses |
| Granularity | Coarse — "is this request allowed past at all" | Can be fine-grained — specific to that page's own data |

### Takeaway

Middleware's advantage is consolidation: one checkpoint instead of one guard per office, enforced before any per-page work even begins. It doesn't replace page-level checks that need to reason about specific data, only the boilerplate of running the same coarse gate over and over — Phase 7, Lesson 3 covers exactly how the two layer together rather than substitute for each other.

---

## 7. Common Mistakes

- **Forgetting `config.matcher` entirely.** Without it, Middleware runs on every single request by default — including static assets like images and CSS — needlessly running logic that was only meant to guard a handful of routes.
- **Doing heavy or slow work inside Middleware.** Because it typically runs on the restricted, latency-sensitive runtime discussed in Section 3 ahead of every matched request, a slow database call or expensive computation there adds latency to every page it touches — Middleware should stay fast and lightweight, deferring anything heavier to the actual route.
- **Assuming Middleware alone is a complete authorization system.** It's well-suited to a coarse "is there a session at all" gate, not to record-specific decisions like "does this particular user own this particular resource" — Lesson 3 picks this distinction up in detail.

---

## 8. Hands-On Exercises

**Exercise 1:** Create a `middleware.js` at the project root that checks `request.cookies.has('session')` and redirects to `/login` with `NextResponse.redirect` when it's missing, otherwise calling `NextResponse.next()`.

**Exercise 2:** Add `export const config = { matcher: ['/dashboard/:path*'] };` to the same file. Confirm requests to `/dashboard` and `/dashboard/settings` trigger the redirect when no `session` cookie is set, while a request to `/about` is unaffected.

**Exercise 3:** Set a `session` cookie manually in your browser's dev tools, then confirm `/dashboard` now loads normally instead of redirecting.

**Exercise 4:** Write the `pathMatchesPattern` and `shouldRunMiddleware` functions from Section 5 in a standalone file, then write at least three `console.assert` calls confirming both a matching and a non-matching path against a multi-pattern matcher list.

**Exercise 5:** Extend the same `middleware.js` to also call `NextResponse.rewrite` to `/maintenance` for every request, regardless of path, then narrow `config.matcher` down to only `/` so the rewrite applies solely to the homepage — confirm the difference in browser behavior between a rewrite and a redirect (URL bar stays the same for one, changes for the other).

---

## 9. Interview Q&A

**Q: What problem does Middleware solve that a check inside each individual page can't solve as cleanly?**
It gives a single place to run logic that needs to happen before a request even reaches a specific route — redirecting unauthenticated users, A/B test bucketing, geolocation-based routing — instead of duplicating the same check inside every page or Route Handler that needs it. One `middleware.js` file, guarded by `config.matcher`, replaces what would otherwise be repeated boilerplate scattered across the codebase.

**Q: What runtime does Middleware execute on, and why does that matter?**
Middleware has historically run on the Edge runtime by default — the same restricted, Web-standard-APIs-only environment a Route Handler can opt into via `runtime = 'edge'` (Phase 5, Lesson 3) — though Middleware's runtime support has itself been an active area of change across recent Next.js releases, so the exact current behavior is worth checking against your installed version's docs rather than assuming it's fixed forever. Whichever runtime applies, it runs ahead of every matched request, so it needs to stay fast and lightweight; a restricted Edge-style environment in particular wouldn't have access to Node-specific modules like `fs` or raw database drivers, and slow logic here adds latency to every request it touches.

**Q: What does `config.matcher` actually control, and what happens if it's omitted?**
It's an array of path patterns restricting which requests Middleware runs for. If it's omitted, Middleware runs on every request by default, including static assets — which is rarely what's intended and adds needless overhead to requests that never needed the check in the first place.

**Q: What's the difference between `NextResponse.redirect()`, `NextResponse.rewrite()`, and `NextResponse.next()`?**
`redirect()` sends the browser to a different URL entirely, visibly changing the address bar. `rewrite()` serves different content for the same URL, with the address bar left unchanged from the user's perspective. `next()` lets the request continue unmodified to whatever route it originally targeted — this is the "do nothing, proceed as normal" case.

**Q: Is Middleware alone sufficient to protect a route?**
It's sufficient for a coarse gate — "does this request even have a session at all" — but not for fine-grained, data-specific authorization like "is this particular user allowed to see this particular record." That kind of check needs access to the actual session and the actual resource being requested, which typically happens inside the Server Component or Route Handler itself, layered on top of Middleware's coarser check rather than instead of it.
