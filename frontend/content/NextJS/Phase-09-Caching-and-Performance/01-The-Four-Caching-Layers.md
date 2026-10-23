# The Four Caching Layers — Complete Guide

> "Between a factory and a customer's kitchen there's a stockroom, a warehouse, and a store shelf — 'the shipment already went out' can mean four different things depending on which one you're asking about."

---

## Table of Contents
1. [The Problem: One Page, Four Different Caches](#1-the-problem-one-page-four-different-caches)
2. [The Analogy: Factory to Kitchen Table](#2-the-analogy-factory-to-kitchen-table)
3. [The Mechanism: Four Layers in Order](#3-the-mechanism-four-layers-in-order)
4. [Diagram: Tracing One Page Load Through All Four](#4-diagram-tracing-one-page-load-through-all-four)
5. [Comparing All Four Layers](#5-comparing-all-four-layers)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: One Page, Four Different Caches

"Why isn't my data updating?" sounds like a single question, but in a Next.js App Router app it can be caused by four unrelated mechanisms, each caching something different, at a different layer, with a different reset condition. Fixing the wrong one leaves the actual staleness untouched.

### The Symptom Is the Same, the Cause Isn't

```text
"I updated the database, but the page still shows the old value."

Possible cause 1 → a fetch() result is still cached (Data Cache)
Possible cause 2 → the whole route's rendered HTML is still cached
                    (Full Route Cache)
Possible cause 3 → the browser is reusing a cached client-side
                    navigation instead of asking the server again
                    (Router Cache)
Possible cause 4 → actually nothing is stale — the same request
                    is just being deduped mid-render (Request
                    Memoization), which isn't the bug at all
```

### Why This Matters Before Learning the Fix

Phase 4, Lesson 1 already covered one of these four layers in depth — the Data Cache, and `fetch`'s `cache` / `next.revalidate` options. This lesson doesn't re-derive that; it places the Data Cache alongside the other three so debugging "stale" pages starts with "which layer?" instead of guessing.

---

## 2. The Analogy: Factory to Kitchen Table

A product travels through four storage points before it reaches a customer's kitchen: the factory's own stockroom, a regional warehouse, a shelf at the local store, and finally the customer's own fridge. "Is it fresh?" has a different answer at each stop.

### Mapping Each Stop to a Cache Layer

```text
Factory's stockroom   → Request Memoization
  (goods made once per order, reused instantly for that
   same order — but forgotten the moment the order ships)

Regional warehouse    → Data Cache
  (holds stock across many separate orders, potentially
   for a long time, restocked on its own schedule)

Store shelf           → Full Route Cache
  (a finished, ready-to-hand-over product sitting out
   front — no assembly needed when a customer walks in)

Customer's fridge     → Router Cache
  (the customer's own copy, kept client-side, reused for
   snappy return visits without asking the store again)
```

### Why Four Separate Stops Instead of One

Each stop solves a different problem: the stockroom avoids redoing work within one order, the warehouse avoids re-manufacturing the same goods for every order, the store shelf avoids rebuilding the product per customer, and the fridge avoids a trip back to the store at all. Collapsing them into "one cache" hides which one is actually stale.

---

## 3. The Mechanism: Four Layers in Order

Each layer caches a different unit of work, at a different point in a request's life, cleared by a different trigger.

### Layer 1: Request Memoization

Within a single render pass, if multiple components call `fetch` with the identical URL and options, Next.js's `fetch` dedupes them — only one real call happens, and every caller receives the same result. This scope is intentionally narrow: it exists only for the duration of that one render, then disappears.

```text
Scope     → one single render pass, server-side only
Lifetime  → gone the instant that render finishes
Purpose   → stop the same data being fetched N times because
             N different components each need it
```

### Layer 2: Data Cache

`fetch` results can also persist far beyond one render — across separate requests, and across deploys — governed by the `cache` and `next: { revalidate }` options Phase 4, Lesson 1 already covered in depth (`no-store`, time-based `revalidate: N`, and the version-dependent default). This lesson doesn't repeat those mechanics; the point here is just where this layer sits relative to the other three.

```text
Scope     → persists across requests, across users, across deploys
Lifetime  → per the cache option on that fetch call, until
             revalidated (time-based or on-demand — Lesson 2)
Purpose   → avoid re-fetching from an origin API/DB for data
             that hasn't actually changed
```

### Layer 3: Full Route Cache

For routes Next.js can render statically (or via ISR), it caches the fully rendered result — HTML plus the React Server Component payload — so a matching request can be served without re-running the render at all.

```text
Scope     → one cache entry per route, server-side, shared
             across all users requesting that route
Lifetime  → persists until a rebuild/redeploy, a time-based
             revalidate window (Phase 4), or on-demand
             revalidation (Lesson 2)
Purpose   → skip re-executing Server Components for a route
             whose output hasn't changed
```

### Layer 4: Router Cache

Entirely client-side: as a user navigates between routes, the App Router keeps a short-lived, in-memory cache of previously visited segments' React Server Component payloads, so back/forward navigation feels instant instead of re-requesting the server.

```text
Scope     → one browser tab, client-side memory only
Lifetime  → short and session-bound (exact duration is
             version-dependent — treat it as "temporary," not
             a fixed number to memorize); a hard refresh clears it
Purpose   → instant back/forward navigation without a
             round trip to the server for segments already seen
```

---

## 4. Diagram: Tracing One Page Load Through All Four

Following one concrete visit — and then a second, client-side navigation back — through all four layers makes the ordering concrete.

### First Visit: `/blog/my-post`

```text
Browser requests /blog/my-post
        │
        ▼
Server starts rendering the route
        │
        ▼
Full Route Cache checked first
  ├── HIT  → cached HTML/RSC payload served immediately,
  │          nothing below this line runs at all
  └── MISS → actually render the Server Components
        │
        ▼
      (render in progress)
Component A calls fetch(url) ─┐
Component B calls fetch(url) ─┼─ Request Memoization dedupes
Component C calls fetch(url) ─┘  these into a single call
        │
        ▼
That single call checks the Data Cache
  ├── HIT  → cached data reused, no origin request
  └── MISS → real network/DB call, result stored per
              its cache option
        │
        ▼
Rendered HTML + RSC payload sent to the browser,
and (if eligible) stored in the Full Route Cache for
the next visitor
```

### Then: Client-Side Navigation Back to `/blog/my-post`

```text
User navigates away, then clicks "back"
        │
        ▼
Router Cache checked first, entirely in the browser
  ├── HIT  → previously stored RSC payload reused instantly,
  │          no request reaches the server at all
  └── MISS → a real request is sent, re-entering the
              "First Visit" flow above from the top
```

Request Memoization never appears in the second trace — it only ever existed for the duration of the first render and had nothing to do with the client-side Router Cache.

---

## 5. Comparing All Four Layers

All four cache something, but they differ sharply in scope, how long an entry survives, and what actually clears it — which is exactly the information needed to debug "why is this stale" correctly.

### Side-by-Side Table

| Layer | Scope | Persists across deploys? | Primary control mechanism |
|---|---|---|---|
| Request Memoization | One render pass, server-side | No — doesn't outlive one render | Automatic; not manually configured |
| Data Cache | Across requests/users, server-side | Yes | `fetch`'s `cache` / `next.revalidate` options (Phase 4); `revalidatePath` / `revalidateTag` (Lesson 2) |
| Full Route Cache | Per-route, server-side, shared | Yes (until rebuild or revalidation) | Route segment config (Lesson 3), time-based `revalidate`, on-demand revalidation (Lesson 2) |
| Router Cache | Per-browser-tab, client-side | No — client memory only | Navigation itself; forced with `router.refresh()` or a hard reload |

### Takeaway

Debugging staleness starts with naming which layer is actually holding the old value, since each one is reset by a completely different action — bumping a `revalidate` number does nothing for a stale Router Cache, and calling `router.refresh()` does nothing for a Data Cache entry that legitimately hasn't expired yet.

---

## 6. Common Mistakes

- **Assuming there's only one cache.** "Next.js caches `fetch`" is true but incomplete — a page can look stale because of the Full Route Cache or the Router Cache even when the underlying Data Cache entry is already fresh.
- **Working around the wrong layer.** A common failure mode: a Server Action updates the database and calls `revalidateTag` (Lesson 2) to bust the Data Cache correctly, yet the page still looks stale in the browser — because the client-side Router Cache is still serving a previously cached navigation. The fix there is `router.refresh()` (or a full reload) on the client, not another change to the server-side revalidation logic.
- **Treating Request Memoization as a persistent cache.** It only dedupes calls within one render pass; the very next request starts over from zero, with no memory of the previous one.

---

## 7. Hands-On Exercises

**Exercise 1:** In a Server Component, call the same `fetch(url)` from two different child components during the same render, each logging a timestamp right before the call. Confirm only one real network call actually happens (Request Memoization), even though the log fires twice.

**Exercise 2:** Add `{ next: { revalidate: 30 } }` to that fetch. Reload the page repeatedly within 30 seconds and confirm the underlying data doesn't change; reload again after 30 seconds and confirm it does — this is the Data Cache from Phase 4, not a new mechanism.

**Exercise 3:** Build two pages linked with `next/link`. Visit page A, navigate to page B, then click "back" to page A. Add a visible timestamp rendered server-side on page A, and confirm it does **not** update on the "back" navigation — that's the Router Cache serving a previously visited segment.

**Exercise 4:** From page B, add a button that calls `router.refresh()` before navigating back to page A. Confirm the timestamp **does** update this time, demonstrating that `router.refresh()` — not a Data Cache change — is the correct tool for busting a stale Router Cache.

**Exercise 5:** Write a one-paragraph explanation, for a teammate who just filed a "stale data" bug, of which of the four layers you'd check first and why, given only the symptom "the page shows old data after a database update."

---

## 8. Interview Q&A

**Q: How many distinct caching layers does the Next.js App Router have, and why does that matter?**
Four: Request Memoization (dedupes identical `fetch` calls within one render pass), the Data Cache (persists `fetch` results across requests and deploys), the Full Route Cache (caches a route's rendered HTML/RSC payload server-side), and the Router Cache (a client-side cache of visited route segments for instant back/forward navigation). It matters because "the page is stale" can be caused by any one of these independently, and each is cleared by a different mechanism — treating them as one undifferentiated "cache" leads to fixing the wrong thing.

**Q: What's the difference in scope between the Data Cache and the Router Cache?**
The Data Cache lives on the server, is shared across all users and requests, and persists across deploys until revalidated. The Router Cache lives entirely in one user's browser tab, holds only that user's recently visited route segments, and is not shared with anyone or persisted across a hard reload. They can be independently stale — busting one has no effect on the other.

**Q: If a Server Action updates a database row and calls `revalidateTag`, but the browser still shows the old value, what's the likely cause?**
The Data Cache invalidation almost certainly worked as intended, but the client-side Router Cache is still serving a previously cached navigation for that route. The fix is `router.refresh()` (or a hard reload) on the client — a further change to server-side revalidation logic won't touch a client-side cache.

**Q: What's the narrowest-scoped of the four layers, and why is it not a source of "stale data" bugs?**
Request Memoization — it only dedupes identical `fetch` calls within a single render pass and is discarded the instant that render finishes. Because it never survives past one render, it has no way to serve genuinely outdated data to a later request; it only prevents redundant work within the same one.

**Q: Why can't a single `revalidate` number fix every kind of staleness?**
A time-based `revalidate` window only affects the Data Cache and Full Route Cache entries configured with it — it says nothing about the Router Cache, which is client-side and reset by navigation behavior (or `router.refresh()`), not by a server-side timer at all. Fixing Router Cache staleness requires a client-side action, not a larger or smaller `revalidate` value.
