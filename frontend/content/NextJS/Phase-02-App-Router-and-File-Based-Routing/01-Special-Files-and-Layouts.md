# Special Files and Layouts — Complete Guide

> "A layout is a picture frame around a rotating art exhibit — the frame stays fixed while the art underneath it changes."

---

## Table of Contents
1. [The Problem: Repeating the Header and Footer in Every Page](#1-the-problem-repeating-the-header-and-footer-in-every-page)
2. [The Special Filenames Catalog](#2-the-special-filenames-catalog)
3. [Nested Layouts: How They Stack](#3-nested-layouts-how-they-stack)
4. [layout.js vs template.js vs page.js](#4-layoutjs-vs-templatejs-vs-pagejs)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Repeating the Header and Footer in Every Page

Phase 1 previewed the `app/` folder convention shallowly: a folder becomes a URL segment, `page.js` makes it visitable. It deliberately skipped everything else a route folder can hold — starting with how shared UI (nav, footer, sidebar) gets applied without copy-pasting it into every page.

```jsx
// app/about/page.js — repeated in every route, by hand
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main><h1>About</h1></main>
      <Footer />
    </>
  );
}
```

```
Ten routes, each importing <Nav /> + <Footer /> by hand:
  ↳ A nav change means editing ten files — miss one, it drifts.
  ↳ Every navigation unmounts + remounts Nav/Footer from scratch,
    even though their content never changed — any local state inside
    them (a mobile menu's open/closed flag) resets every click.
```

### The Frame-and-Exhibit Analogy

A museum frame stays mounted on the wall; only the print behind the glass swaps out. `layout.js` is the frame — it wraps a route (and everything nested under it) exactly once, and it persists across navigation instead of tearing down and rebuilding.

```jsx
// app/dashboard/layout.js
export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard-shell">
      <Sidebar />
      {children}
    </div>
  );
}
```

```
{children}
  ↳ Whatever the active route's page.js (or a deeper layout) renders.
<Sidebar />
  ↳ Never re-executes when navigating between sibling routes under
    this layout — only the {children} slot gets replaced.
```

---

## 2. The Special Filenames Catalog

`page.js` isn't the only reserved filename the App Router recognizes inside a route folder. Each triggers framework behavior purely by existing at that path — no import, no registration.

```
page.js      → the route's actual UI. No page.js = a purely
               organizational folder (Phase 1).
layout.js    → shared UI wrapping the page + everything nested under
               it. Persists across sibling navigation — the frame.
template.js  → structurally identical to layout.js (same folder,
               same children prop) but re-mounts fresh on EVERY
               navigation instead of persisting.
loading.js   → wraps the segment in a React <Suspense> boundary
               automatically; its export is the fallback UI while
               data loads. No manual <Suspense> JSX required.
error.js     → a Client Component error boundary scoped to that
               segment (must start with "use client"). Catches
               render errors from the segment and everything nested
               inside it. Full mechanics: Phase 10.
```

### Zero Registration Needed

Dropping a file named exactly `loading.js` next to a `page.js` is the entire activation step — Next.js discovers and wires it in automatically, the same filesystem-convention idea Phase 1 introduced for routing itself.

---

## 3. Nested Layouts: How They Stack

Layouts nest the same way route folders nest. A root `app/layout.js` wraps the entire app; a folder's own `layout.js` wraps only routes inside that folder — and both apply simultaneously, outside-in.

### The Nesting Diagram

```text
app/layout.js                    (root — wraps EVERYTHING, required)
  └─ <html><body>
        {children} ─────────────┐
                                 │
app/dashboard/layout.js          │  (wraps only /dashboard/*)
  └─ <div className="shell">    │
        <Sidebar />              │
        {children} ──────────┐  │
                              │  │
app/dashboard/page.js         │  │   →  /dashboard
  renders into the innermost  │
  {children} slot above       │
                              │
app/dashboard/settings/page.js   →  /dashboard/settings
  renders into the SAME dashboard layout's {children} slot —
  the sidebar above it never unmounts navigating here
```

### Building a Root Layout and a Nested Layout

Every project requires exactly one root layout at `app/layout.js` — the only place `<html>`/`<body>` may render, since it's the outermost wrapper for the whole document.

```jsx
// app/layout.js — the ROOT layout, required
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <TopNav />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
```

A nested layout never touches `<html>`/`<body>` — those already exist — it only adds what's specific to its own subtree:

```jsx
// app/dashboard/layout.js — wraps only /dashboard and everything under it
export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard-shell">
      <DashboardSidebar />
      <section className="dashboard-content">{children}</section>
    </div>
  );
}
```

```
/dashboard/settings composes, outside-in:
  root <html>/<body> → <TopNav/> → dashboard sidebar/wrapper →
  app/dashboard/settings/page.js dropped into the innermost {children}
```

---

## 4. layout.js vs template.js vs page.js

| Aspect | `layout.js` | `template.js` | `page.js` |
|---|---|---|---|
| Persists across sibling navigation | Yes | No — re-mounts every navigation | N/A — it *is* the changing part |
| Required at root (`app/layout.js`) | Yes | No | No |
| Receives `children` prop | Yes | Yes | No |
| Re-runs effects/animations per navigation | No | Yes — that's its purpose | N/A |
| Typical use | Nav, sidebar, footer — stable chrome | Per-page mount animations, resetting local UI state | Route-specific content |

```
Rule of thumb:
  ↳ Default to layout.js — persistence is what you want almost always.
  ↳ Reach for template.js only when you WANT a fresh mount every visit
    (e.g. a page-enter transition that should replay every time).
```

---

## 5. Common Mistakes

- **Forgetting the root `app/layout.js` needs `<html>`/`<body>`.** Nested layouts never render these, so it's easy to assume Next.js supplies them somewhere. It doesn't — omitting them at the root is build-breaking, not stylistic.
- **Putting page-specific logic in `layout.js` and expecting it to re-run per navigation.** A layout stays mounted across sibling navigations, so a `console.log` or fetch there fires once on mount, not again on every click between sibling routes — that's `template.js`'s job, not a bug.
- **Assuming a nested layout replaces the root layout instead of stacking with it.** `app/dashboard/layout.js` doesn't opt out of `app/layout.js` — both apply simultaneously, outside-in. No mechanism skips an ancestor layout from a descendant route.

---

## 6. Hands-On Exercises

**Exercise 1 — Build a root layout with real chrome.** Edit `app/layout.js` to render `<TopNav>` above `{children}` and `<SiteFooter>` below it. Confirm every route shows both.

**Exercise 2 — Add a nested layout.** Create `app/dashboard/layout.js` with a sidebar, plus `app/dashboard/page.js` and `app/dashboard/settings/page.js`. Confirm both dashboard routes show the sidebar and `/` does not.

**Exercise 3 — Prove layouts persist across navigation.** Add a `useState` counter with a button inside the Exercise 2 sidebar. Click it to 3, navigate `/dashboard` → `/dashboard/settings`, confirm it's still 3.

**Exercise 4 — Swap in a template.js.** Replace `app/dashboard/layout.js` with a bare passthrough rendering only `{children}`. Create `app/dashboard/template.js` holding the sidebar-plus-counter from Exercise 3. Navigate between the two routes again and confirm the counter now resets to 0 every time.

**Exercise 5 — Add a loading.js.** Give `app/dashboard/settings/page.js` an artificial delay (`await new Promise(r => setTimeout(r, 1500))`). Add `app/dashboard/loading.js` exporting "Loading settings…". Confirm it appears automatically during the delay with no hand-written `<Suspense>`.

---

## 7. Interview Q&A

**Q: What's the difference between `layout.js` and `page.js` in the App Router?**
A: `page.js` is the actual, route-specific UI for a segment — it's what changes as a user navigates between routes. `layout.js` is shared UI that wraps a route and everything nested under it, received via a `children` prop, and it persists across navigation between sibling routes instead of unmounting and remounting each time.

**Q: Why would a `console.log` inside a `layout.js` only fire once, even after navigating between several pages that all use it?**
A: Because a layout stays mounted across navigations between the routes it wraps — only the innermost `page.js` content (passed in as `children`) actually swaps out. Any code that only runs on mount only fires the first time that layout mounts, not on every subsequent navigation within its subtree.

**Q: When would you use `template.js` instead of `layout.js`?**
A: When you specifically want a fresh mount on every navigation rather than a persistent wrapper — a per-page enter animation that should replay every time, or local state that should reset per visit rather than persist. `layout.js` is the right default; `template.js` is the exception for when re-mounting is the goal.

**Q: What does `loading.js` do, and what do you have to write to activate it?**
A: `loading.js` automatically wraps its route segment in a React `<Suspense>` boundary and renders as the fallback UI while that segment's data is loading. Activation requires no manual `<Suspense>` JSX at all — creating a file with the exact name `loading.js` next to a `page.js` is the entire setup.

**Q: Does every route folder need its own `layout.js`?**
A: No — only the root `app/layout.js` is required, because it's the one place `<html>` and `<body>` get rendered for the whole document. Any other folder's `layout.js` is optional; a folder without one simply falls through to whichever ancestor layout is closest above it.
