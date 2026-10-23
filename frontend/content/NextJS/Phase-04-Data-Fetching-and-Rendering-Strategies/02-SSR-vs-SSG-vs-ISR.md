# SSR vs SSG vs ISR — Complete Guide

> "The same page, generated once, generated every time, or generated once and quietly reprinted — three different answers to 'how fresh does this need to be?'"

---

## Table of Contents
1. [The Problem: One Freshness Strategy Doesn't Fit All Pages](#1-the-problem-one-freshness-strategy-doesnt-fit-all-pages)
2. [SSG, SSR, and ISR at a Glance](#2-ssg-ssr-and-isr-at-a-glance)
3. [ISR's Stale-While-Revalidate Behavior](#3-isrs-stale-while-revalidate-behavior)
4. [Code Walkthrough: generateStaticParams Plus revalidate](#4-code-walkthrough-generatestaticparams-plus-revalidate)
5. [Comparing SSG, SSR, and ISR](#5-comparing-ssg-ssr-and-isr)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: One Freshness Strategy Doesn't Fit All Pages

Lesson 1 showed a single `fetch` call can cache indefinitely, never cache, or cache for a fixed window. Zoom out to a whole *page*, and the same question reappears at a bigger scale: how often does this page's content actually need to change?

```text
Marketing homepage  → changes only on deploy   → rebuilding per request is wasted work
Live inventory page → must be exact, always    → serving a stale snapshot is just wrong
Product catalog     → changes a few times/day  → needs SOMETHING between the two extremes
```

Next.js names three answers to this — **SSG**, **SSR**, and **ISR** — and picking the right one per *page* (not per app) is this lesson's skill.

---

## 2. SSG, SSR, and ISR at a Glance

### Static Site Generation (SSG) — Built Once at Deploy Time

HTML is generated exactly once, at build/deploy time, and the same output is served to every visitor until the next deploy. Like a newspaper print run: every copy handed out today is identical.

```jsx
// Maps directly onto Lesson 1's default fetch behavior:
async function getPage() {
  const res = await fetch("https://api.example.com/page"); // cached indefinitely
  return res.json();
}
```

Best for content stable between deploys — marketing pages, published blog posts, docs.

### Server-Side Rendering (SSR) — Built Fresh on Every Request

HTML is regenerated from scratch on every incoming request, with zero reuse. Like a live broadcast: every viewer gets the feed happening right now, at the cost of running that feed for each of them.

```jsx
async function getLiveData() {
  const res = await fetch("https://api.example.com/live", {
    cache: "no-store", // Lesson 1's SSR-equivalent option
  });
  return res.json();
}
```

Best for per-user or must-be-exact data — dashboards, live inventory, personalized views.

### Incremental Static Regeneration (ISR) — Cached, but Self-Refreshing

A page is built once, like SSG, but a `revalidate` window (in seconds) is attached to it. Once that window passes, the next request triggers a background regeneration, and the refreshed HTML replaces the cache for subsequent visitors.

```jsx
async function getCatalog() {
  const res = await fetch("https://api.example.com/catalog", {
    next: { revalidate: 60 }, // Lesson 1's ISR-equivalent option, at page scope
  });
  return res.json();
}
```

Best for content that changes periodically but not per-request — product catalogs, trending lists, blog indexes.

---

## 3. ISR's Stale-While-Revalidate Behavior

The single most commonly misunderstood detail about ISR is *who* waits for the rebuild. It is never the visitor who triggers it.

```text
Request comes in for an ISR page
        │
        ▼
Is the cached HTML still within its revalidate window?
        │
        ├── YES ──► Serve the cached HTML immediately. Done.
        │
        └── NO (window passed — cache is "stale")
                │
                ▼
        STILL serve the existing (stale) HTML to THIS
        request, immediately — no waiting
                │
                ▼
        Trigger a background regeneration
        (does NOT block the response already sent)
                │
                ▼
        Cache is updated with the fresh HTML once
        regeneration finishes
                │
                ▼
        The NEXT request after that point receives
        the newly regenerated version
```

```text
Key rule: the request that TRIGGERS regeneration is served
the STALE version, immediately, and does NOT wait for the
rebuild. Only the request AFTER the rebuild finishes gets fresh HTML.
```

Freshness catches up automatically, but never at the expense of the visitor who happened to ask first.

---

## 4. Code Walkthrough: generateStaticParams Plus revalidate

A common pattern: pre-build known dynamic pages at deploy time (SSG), then let each self-refresh periodically (ISR).

```jsx
// app/blog/[slug]/page.js

// Pre-build these exact slugs at deploy time
export async function generateStaticParams() {
  const posts = await fetch("https://api.example.com/posts").then((res) =>
    res.json()
  );
  return posts.map((post) => ({ slug: post.slug }));
}

// Re-check for fresh content at most once every hour after that
export const revalidate = 3600;

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const res = await fetch(`https://api.example.com/posts/${slug}`);
  const post = await res.json();

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
    </article>
  );
}
```

```text
generateStaticParams()
  ↳ Tells Next.js exactly which "slug" values exist at build time —
    those pages are pre-rendered up front, not built on first visit.

export const revalidate = 3600
  ↳ Layers ISR on top: for up to an hour after each build, visitors
    get the pre-built page instantly. After that, the NEXT visit
    triggers a background regen — Section 3's rule, unchanged.
```

---

## 5. Comparing SSG, SSR, and ISR

| Aspect | SSG | SSR | ISR |
|---|---|---|---|
| When HTML is generated | Once, at build/deploy time | Fresh, on every single request | Once at build, then regenerated in the background after `revalidate` passes |
| Server load per visit | Lowest — serving an already-built file | Highest — full render on every request | Low — occasional background rebuilds only |
| Data freshness | Fixed until next full deploy | Always current, by definition | Slightly stale for up to `revalidate`, then catches up |
| Best for | Marketing pages, published docs | Dashboards, live inventory, personalized views | Product catalogs, blog indexes, trending lists |

---

## 6. Common Mistakes

- **Assuming the visitor who triggers ISR's revalidation waits for the rebuild.** They don't — they get the stale cached HTML immediately; only a *later* visitor sees the rebuilt version.
- **Choosing SSR by default "to be safe."** SSR pays full render cost on every request, even for pages that haven't changed. SSG or ISR is usually the better fit.
- **Forgetting SSG has no self-update mechanism.** An SSG page is frozen until the next deploy — if that's unacceptable, the page needs ISR's periodic refresh or SSR's per-request freshness, not plain SSG.
- **Treating any staleness as a bug.** ISR serving stale HTML for a short window past `revalidate` is the intended design, not an error to eliminate.

---

## 7. Hands-On Exercises

**Exercise 1:** Build `app/blog/[slug]/page.js` as in Section 4, with `generateStaticParams` pre-building slugs from a placeholder API. Confirm the pre-built slugs load instantly.

**Exercise 2:** Add `export const revalidate = 30;`. Change a post's title via your backend (or a mock), reload within 30 seconds and confirm the old title still shows. Reload again right after 30 seconds pass and confirm the old title is *still* shown on that exact reload (Section 3's rule), then reload once more and confirm the new title appears.

**Exercise 3:** Build `app/dashboard/page.js` fetching with `cache: 'no-store'` from an endpoint returning the current timestamp. Reload repeatedly and confirm the timestamp changes every time.

**Exercise 4:** Build `app/about/page.js` with no dynamic data fetching — just static JSX. Confirm via your build output that it's treated as purely static, with no per-request server work, contrasting it with Exercise 3's dashboard.

**Exercise 5:** Write a one-paragraph recommendation, for a teammate building an e-commerce site, of which strategy (SSG, SSR, ISR) fits: the homepage, an individual product page, and the logged-in user's order history — justified with Section 5's trade-offs.

---

## 8. Interview Q&A

**Q: What's the core difference between SSG and SSR?**
SSG generates a page's HTML once at build/deploy time and reuses it for every visitor until the next deploy. SSR generates HTML fresh, on the server, for every single incoming request — always current, at the cost of paying full render work every time.

**Q: When a cached ISR page becomes stale, does the user who triggers the revalidation see the old page or the new one?**
The old (stale) page, served immediately from cache with no wait. Next.js triggers a background regeneration in response to that request but doesn't block the response on it — the freshly regenerated version only becomes visible to requests that arrive *after* the regeneration finishes, not to the one that triggered it.

**Q: What does the `revalidate` export do on a Next.js page?**
It sets how many seconds a page's cached HTML is considered fresh before Next.js regenerates it in the background on a subsequent request — the page-level version of the `{ next: { revalidate: N } }` fetch option from Lesson 1, applied at a coarser scope.

**Q: Why might choosing SSR for a page that rarely changes be a bad decision?**
SSR re-runs the full rendering work, including data fetches, on every request regardless of whether the data actually changed. For a mostly-static page, that's wasted server capacity that SSG or ISR would avoid by reusing a previously built result.

**Q: What does `generateStaticParams` do, and how does it relate to ISR?**
It tells Next.js which specific values of a dynamic route segment (like a blog post's `slug`) to pre-render at build time, so those pages are ready immediately rather than built on a visitor's first request. It's commonly paired with a `revalidate` export so those pre-built pages also periodically self-refresh in the background — pre-building's speed plus ISR's ongoing freshness.
