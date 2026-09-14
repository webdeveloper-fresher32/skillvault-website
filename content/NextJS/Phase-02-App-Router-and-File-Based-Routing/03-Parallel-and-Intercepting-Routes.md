# Parallel and Intercepting Routes — Complete Guide

> "A parallel route is picture-in-picture for your layout; an intercepting route is the pop-up preview you get from clicking inside the app, versus the full page you'd get from typing the URL cold."

---

## Table of Contents
1. [The Problem: Independent Sections and Origin-Dependent UI](#1-the-problem-independent-sections-and-origin-dependent-ui)
2. [Two Analogies: Picture-in-Picture and the Pop-Up Preview](#2-two-analogies-picture-in-picture-and-the-pop-up-preview)
3. [Parallel Routes: @slot Folders](#3-parallel-routes-slot-folders)
4. [Intercepting Routes: (.), (..), and (...) Prefixes](#4-intercepting-routes---and--prefixes)
5. [Combining Both: The Modal Photo Pattern](#5-combining-both-the-modal-photo-pattern)
6. [Comparison Table: Parallel Routes vs Intercepting Routes](#6-comparison-table-parallel-routes-vs-intercepting-routes)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Independent Sections and Origin-Dependent UI

### Two Independent Sections, One Screen

Layouts, dynamic segments, and route groups all still assume a single active `page.js` occupies the "current content" slot. That breaks down for a dashboard where two genuinely separate, independently-navigable sections must be visible *at the same time* — a feed on the left, a notifications panel on the right — each changing without disturbing the other.

```
Clicking "next page" in the feed  → only the feed should update
Clicking into a notification      → only the panel should update
  ↳ neither is "nested inside" the other — they're siblings, each
    needing its own slice of navigation state, in one layout at once.
  ↳ a single {children} slot only has room for ONE such region.
```

### Same URL, Different UI Depending on How You Got There

A subtler problem: the *same* URL sometimes needs to render differently depending on *how* the user arrived. Clicking a photo thumbnail from within a photo-grid app should pop the photo up as an overlay modal. Opening that same photo's URL directly — a fresh tab, a hard refresh — has no grid to overlay onto, so it needs the full standalone page instead.

```
A plain page.js per URL cannot tell:
  "soft-navigated here by clicking a link inside the app"
  from
  "browser is loading this URL cold"
  ↳ both hit the exact same route — solving this needs a mechanism
    aware of WHERE the navigation came from, not just where it's going.
```

---

## 2. Two Analogies: Picture-in-Picture and the Pop-Up Preview

A parallel route (`@analytics`) is TV picture-in-picture: the main broadcast plays in the big frame while a second, independent broadcast plays in a small overlay box — changing one doesn't touch the other. Each `@slotName` folder is its own independently-navigable broadcast, rendered alongside `children` rather than nested inside it.

An intercepting route (`(.)`, `(..)`, `(...)`) is a pop-up preview that only appears when you click a link from inside an already-open app. Type that same URL into a brand-new tab — nothing to pop up over — and you get the real, full destination instead.

---

## 3. Parallel Routes: @slot Folders

A parallel route is a folder whose name starts with `@`; its contents are handed to the nearest shared `layout.js` as a named prop matching that folder's name — not merged into `children`, but delivered as its own separate slot.

```text
app/
├── layout.js              (receives BOTH children AND analytics as props)
├── page.js                →  the DEFAULT slot (children)
└── @analytics/
    └── page.js            →  the ANALYTICS slot
```

```jsx
// app/layout.js
export default function DashboardLayout({ children, analytics }) {
  return (
    <div className="dashboard-grid">
      <main>{children}</main>
      <aside>{analytics}</aside>
    </div>
  );
}
```

```
children (app/page.js) and analytics (app/@analytics/page.js) render
side by side, each independently routable.
  ↳ navigating within analytics doesn't force main to re-render,
    and vice versa — this is Section 1's feed+notifications dashboard.
```

---

## 4. Intercepting Routes: (.), (..), and (...) Prefixes

A dot-prefixed folder name describes, in filesystem terms, how far up the tree to reach for the route it intercepts — deliberately mirroring relative-path syntax.

```
(.)folder     → intercepts a route at the SAME level
(..)folder    → intercepts a route ONE level up
(...)folder   → intercepts a route from the ROOT, regardless of depth
(..)(..)folder → chain repeats for TWO levels up, and so on
```

```
The prefix only applies to in-app navigation (a <Link> click, a
client-side route change).
  ↳ A hard navigation (typed URL, full refresh) always falls through
    to the real, non-intercepted page.js — this is the exact
    mechanism Section 1's "same URL, different UI" problem needed.
```

```text
app/
├── feed/
│   ├── page.js                  →  /feed              (the photo grid)
│   └── (.)photo/
│       └── [id]/
│           └── page.js          →  intercepted modal, only when
│                                    navigated to FROM /feed
└── photo/
    └── [id]/
        └── page.js              →  /photo/:id  (the real, full page —
                                     always used on direct visit/refresh)
```

---

## 5. Combining Both: The Modal Photo Pattern

A modal needs both mechanisms at once: an independent slot to render into (so it layers *over* the grid instead of replacing it) and interception logic (so it only appears on soft in-app navigation).

```text
app/
├── layout.js                      (receives children AND @modal)
├── feed/
│   ├── page.js                    →  /feed
│   └── photo/
│       └── [id]/
│           └── page.js            →  the FULL PAGE version — always
│                                      used on direct visit or refresh
└── @modal/
    ├── default.js                 (renders null — no modal active)
    └── (.)feed/
        └── photo/
            └── [id]/
                └── page.js        →  the MODAL version, shown in the
                                       @modal slot, only reached by
                                       clicking a thumbnail in /feed
```

```jsx
// app/layout.js
export default function RootLayout({ children, modal }) {
  return (
    <html lang="en">
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
```

```
Click a thumbnail on /feed → soft-navigates to /feed/photo/42
  ↳ origin was /feed, so (.)feed/photo/[id]/page.js intercepts it,
    rendering the modal into @modal, layered on the mounted feed.
Hard refresh on /feed/photo/42 → no in-app origin to intercept from
  ↳ falls straight through to app/feed/photo/[id]/page.js, the full page.
```

---

## 6. Comparison Table: Parallel Routes vs Intercepting Routes

| Aspect | Parallel Routes (`@slot`) | Intercepting Routes (`(.)folder`) |
|---|---|---|
| Problem solved | Two+ independently-navigable sections in one layout at once | A route rendering differently by navigation origin (in-app vs. direct) |
| Mechanism | Named slot props (`children`, `@analytics`) passed into a shared `layout.js` | Dot-prefixed folder matches a route only via in-app soft navigation |
| Commonly combined | N/A | Yes — a modal needs a parallel `@modal` slot to render into, plus interception to trigger only on soft navigation |
| Needs a fallback file | `default.js` per slot, for when no matching sub-route is active | The full, non-intercepted `page.js` still needs to exist for direct visits |

---

## 7. Common Mistakes

- **Forgetting a parallel slot needs its own `default.js`.** Navigating to a route with no matching sub-page for one parallel slot (e.g. deep into `children` with no matching `@analytics` route) needs a fallback — without `default.js`, that slot has no defined render and navigation can error.
- **Assuming an intercepting route replaces the full page entirely.** It only layers a modal-style view on top of the existing page for soft navigation from a matching origin — the real, full `page.js` still needs to exist and render correctly for direct visits or hard refreshes.
- **Mixing up `(.)`, `(..)`, and `(...)` and intercepting the wrong level.** The dot count has to correspond exactly to how many folder levels separate the interceptor from the route it's meant to catch, or it silently intercepts the wrong route (or nothing at all).
- **Expecting parallel slots to share state automatically.** Each `@slotName` is independently routed and rendered; nothing synchronizes state between slots automatically — any coordination (shared context, URL search params) has to be built explicitly.

---

## 8. Hands-On Exercises

**Exercise 1 — Build a parallel slot.** Create `app/dashboard/layout.js` accepting `{ children, analytics }`, `app/dashboard/page.js` as main content, and `app/dashboard/@analytics/page.js` as a small stats widget. Confirm both render side by side at `/dashboard`.

**Exercise 2 — Add a default.js.** Add `app/dashboard/settings/page.js` with no corresponding `@analytics/settings/page.js`. Navigate to `/dashboard/settings` without a `default.js` in `@analytics` and observe the error; add `app/dashboard/@analytics/default.js` returning `null` and confirm it clears.

**Exercise 3 — Build the intercepting modal pattern.** Following Section 5's structure, create a `/feed` grid linking to `/feed/photo/[id]`, a full `app/feed/photo/[id]/page.js`, and an intercepted `app/feed/@modal/(.)feed/photo/[id]/page.js` wired into a `@modal` slot on the root layout. Confirm clicking a grid thumbnail shows a modal.

**Exercise 4 — Prove interception only applies to soft navigation.** With Exercise 3 in place, open `/feed/photo/2` in a fresh browser tab (or hard-refresh it). Confirm it renders as the full standalone page, not the modal.

**Exercise 5 — Deliberately mis-nest an intercepting route.** Move the `(.)feed/photo/[id]` folder from Exercise 3 one level shallower than it should be. Confirm clicking a thumbnail no longer shows the modal, then move it back and confirm it works again.

---

## 9. Interview Q&A

**Q: What problem do parallel routes solve that a single `page.js` per route can't?**
A: A single `page.js` only fills one `children` slot per layout, so it can't represent two or more genuinely independent, simultaneously-navigable sections on the same screen — like a main feed and a notifications panel that should each update without disturbing the other. Parallel routes (`@slotName` folders) solve this by handing a shared layout multiple named slots as separate props, each independently routable.

**Q: How does an intercepting route decide whether to show the intercepted version or the full page?**
A: It depends entirely on navigation origin, not the URL by itself. If the user reaches the route via in-app soft navigation (clicking a `<Link>` from a matching origin), the intercepting folder's version renders. If the same URL is loaded directly — a fresh tab, a hard refresh, a bookmark — there's no in-app origin to intercept from, so it falls through to the real, non-intercepted `page.js` at that path.

**Q: What do the `(.)`, `(..)`, and `(...)` prefixes on an intercepting route folder mean?**
A: They describe, in relative-path terms, how far up the route tree the intercepted route lives relative to the interceptor's own location: `(.)` intercepts a route at the same level, `(..)` intercepts one level up, and `(...)` intercepts from the root regardless of how deeply nested the interceptor itself is.

**Q: Why are parallel routes and intercepting routes so often used together for modals?**
A: A modal needs two things simultaneously: somewhere to render that doesn't replace the underlying page (a parallel `@modal` slot, layered alongside the default `children` slot), and logic that only shows the modal when the user got there by clicking something inside the app rather than visiting the URL directly (an intercepting route). Neither mechanism alone solves the full problem — parallel routes alone would show the modal slot for every visit including direct ones, and intercepting routes alone have no dedicated slot to render a modal into without replacing the main content.

**Q: If you set up an intercepting route for a modal, do you still need to build the full, non-intercepted page?**
A: Yes. The intercepting route only handles the soft-navigation case; a direct visit or hard refresh to that same URL has no in-app context to intercept from, so it always falls through to the ordinary, full `page.js` at that path. Skipping that file means direct visits or refreshes to that URL would 404 instead of showing the full content.
