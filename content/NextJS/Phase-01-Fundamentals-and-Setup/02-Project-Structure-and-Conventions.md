# Project Structure and Conventions

> "The folder IS the URL; the filename IS the behavior."

---

## Table of Contents

1. [The Problem: Every Team Invents Its Own Routing Setup](#1-the-problem-every-team-invents-its-own-routing-setup)
2. [The app/ Directory: File-Based Routing Overview](#2-the-app-directory-file-based-routing-overview)
3. [Folder-to-URL Mapping, Concretely](#3-folder-to-url-mapping-concretely)
4. [A Minimal page.js, Start to Finish](#4-a-minimal-pagejs-start-to-finish)
5. [public/, next.config.js, and Other Root Files](#5-public-nextconfigjs-and-other-root-files)
6. [Dynamic Segments and Nested Routes, Previewed](#6-dynamic-segments-and-nested-routes-previewed)
7. [app/ vs Legacy pages/ Router](#7-app-vs-legacy-pages-router)
8. [Common Mistakes](#8-common-mistakes)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Problem: Every Team Invents Its Own Routing Setup

### No Shared Convention, No Shared Map

```
Project A: routes in src/routes/, wired by a hand-written <Routes> list
Project B: routes in src/pages/, registered in a different file entirely
Project C: route components scattered in src/features/*/views/
           with no single file listing every URL at all
```

Jumping into any of these means reverse-engineering how URLs map to files before you can even locate the code for a page — and there's no guarantee the mapping is documented or accurate.

### The Fix: Location IS the Configuration

Next.js's App Router convention removes the mapping problem entirely — instead of a routing file kept in sync with wherever pages happen to live, *the location of the file itself* is the configuration. Learn the convention once, navigate any App Router project without hunting for a routes file.

---

## 2. The app/ Directory: File-Based Routing Overview

The `app/` directory defines your routes; the folder structure directly maps to URL paths. Reserved filenames inside a route's folder — `page.js`, `layout.js`, and others covered in Phase 2 — trigger framework behavior just by existing at that path. No separate registration step.

```text
app/
├── page.js                    →  /
├── about/
│   └── page.js                →  /about
└── dashboard/
    ├── layout.js               (shared UI wrapper for everything under /dashboard)
    └── settings/
        └── page.js             →  /dashboard/settings
```

### The Two Filenames That Matter Now

```
page.js    → makes a folder an actual, visitable route.
             A folder without one is just an organizational segment.

layout.js  → wraps a route (and everything nested under it) in shared UI
             (nav, sidebar) without duplicating markup per page.
             Layouts nest: root layout wraps the whole app; a folder's
             own layout.js wraps only routes inside that folder.
```

This preview is deliberately shallow — `loading.js`, `error.js`, `not-found.js`, and route groups are Phase 2's subject.

---

## 3. Folder-to-URL Mapping, Concretely

Rule of thumb: **a folder becomes a URL segment**, and **a `page.js` inside it makes that segment visitable.**

```text
app/page.js                              →  /
app/about/page.js                        →  /about
app/contact/page.js                      →  /contact
app/blog/page.js                         →  /blog
app/blog/[slug]/page.js                  →  /blog/:slug            (dynamic segment)
app/dashboard/settings/page.js           →  /dashboard/settings
app/dashboard/settings/billing/page.js   →  /dashboard/settings/billing
app/products/[category]/[id]/page.js     →  /products/:category/:id (two dynamic segments)
```

### Reading the List Correctly

```
app/dashboard/settings/billing/page.js
  ↳ All THREE segments matter — not just the last one.

app/dashboard/  (no page.js of its own)
  ↳ Purely organizational. /dashboard itself is NOT a route,
    even though /dashboard/settings still is.

[slug], [category], [id]
  ↳ Square brackets = dynamic segment. Its actual value at request
    time (e.g. "running-shoes") is handed to the page as a route
    parameter. Full handling is Phase 2 material.
```

---

## 4. A Minimal page.js, Start to Finish

### The Smallest Possible Route

```jsx
// app/about/page.js
export default function Page() {
  return <h1>Hello</h1>
}
```

```
export default function Page()
  ↳ A default-exported function component, in a file named
    literally "page.js", inside a folder named after the URL
    segment. That's the entire requirement for /about to exist.
```

No import to add elsewhere, no route object to register — Next.js discovers this by walking the `app/` directory itself.

### Scaled Up to a Real Tree

```text
my-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── about/
│   │   └── page.tsx
│   └── blog/
│       └── [slug]/
│           └── page.tsx
├── public/
│   ├── logo.png
│   └── favicon.ico
├── next.config.js
├── package.json
└── tsconfig.json
```

Every `page.tsx` here does exactly the same job as the one-liner above — just with real content.

---

## 5. public/, next.config.js, and Other Root Files

Two more pieces of the convention live outside `app/`, at the project root.

### public/ — Static, Unprocessed Assets

Files here are served from the site's root URL, with the `public/` prefix dropped entirely.

```jsx
export default function Page() {
  return <img src="/logo.png" alt="Company logo" />
}
```

```
public/logo.png  →  requested by the browser as /logo.png
                     (never /public/logo.png)
```

### next.config.js — Build- and Framework-Level Config

Redirects, headers, allowed image domains, experimental flags — all app-wide, not per-route.

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;
```

A minimal one is often just an empty export — it lives at the root because it affects the whole application, not one route.

---

## 6. Dynamic Segments and Nested Routes, Previewed

### Nested Static Routes

```text
app/dashboard/settings/billing/page.js   →  /dashboard/settings/billing
```

Each folder (`dashboard`, `settings`, `billing`) is a fixed, literal segment.

### Dynamic Segments

```text
app/blog/[slug]/page.js
```

```
/blog/hello-world       → matches this file, slug = "hello-world"
/blog/my-second-post    → matches the SAME file, slug = "my-second-post"
```

One file handles every value at that position — no new file per blog post.

### Combining Both

```text
app/products/[category]/[id]/page.js   →  one file, every category/id combination
```

Reading the captured values inside a component is Phase 2 material; here the point is purely which URLs a file responds to.

---

## 7. app/ vs Legacy pages/ Router

Next.js originally shipped with a different convention, the `pages/` directory. Worth recognizing in older codebases even though this course builds exclusively on the App Router.

| Aspect | `app/` (App Router) | `pages/` (legacy Pages Router) |
|---|---|---|
| Route definition | Folder + reserved filename (`page.js` inside a folder) | The file itself is directly the route (`pages/about.js` → `/about`) |
| Default component type | Server Component (no JS shipped unless opted in with `"use client"`) | No RSC concept — also server-renders/pre-renders HTML by default (SSR/SSG predate the App Router), but every component's JS ships and fully hydrates/re-renders on the client |
| Layouts | Built-in `layout.js` convention, nested and composable | No built-in layout primitive — handled manually via a custom `_app.js` |
| Data fetching | `fetch` directly inside async Server Components | Special exported functions like `getServerSideProps` / `getStaticProps` |
| Course coverage | This course's entire scope | Recognize-only; not built upon here |

### The Nuance Worth Remembering

```
Server rendering itself is NOT new to the App Router
  ↳ Pages Router could server-render years before Server
    Components existed.

What IS new: the OPTION for a component to ship ZERO JS
  ↳ In Pages Router, every component's JS always ships and
    hydrates, whether or not it needs interactivity.
```

---

## 8. Common Mistakes

**Creating `app/about.js` instead of `app/about/page.js`.** A bare file directly inside `app/` is not a route — it must live inside a folder and be named exactly `page.js`. `app/about.js` is simply ignored.

**Referencing assets as `/public/logo.png`.** `public/` is the serving *root*, not a URL prefix — the correct path is `/logo.png`.

**Assuming any file in a route folder is special.** Only reserved filenames (`page.js`, `layout.js`, and others from Phase 2) matter. A stray `helpers.js` next to `page.js` is just a regular importable module.

**Expecting `pages/`-style data fetching inside `app/`.** `getServerSideProps` / `getStaticProps` are Pages Router-only; the App Router uses `fetch` directly inside async Server Components — copying old code won't work.

**Losing track of nested-folder URL depth.** `app/blog/drafts/2024/page.js` maps to `/blog/drafts/2024` — all three segments matter, not just the last.

---

## 9. Hands-On Exercises

**Exercise 1 — Build the minimal route.** In a fresh `create-next-app` project, replace `app/page.js` with the minimal example from Section 4. Confirm `/` renders "Hello."

**Exercise 2 — Add a static nested route.** Create `app/dashboard/settings/page.js` without creating `app/dashboard/page.js`. Confirm `/dashboard/settings` works and `/dashboard` returns a 404.

**Exercise 3 — Add a dynamic route.** Create `app/blog/[slug]/page.js` rendering "Post: unknown" (parameters themselves are Phase 2 material). Visit `/blog/hello-world` and `/blog/anything-else` and confirm both hit the same file.

**Exercise 4 — Reference a public asset correctly.** Drop an image into `public/` as `logo.png`. Render it with `<img src="/logo.png" />`, then deliberately try `<img src="/public/logo.png" />` and confirm that one is broken.

**Exercise 5 — Spot the router mismatch.** Given `app/about.js` (a bare file, no folder), predict whether `/about` will work. Run it, confirm your prediction, then fix it into `app/about/page.js`.

---

## 10. Interview Q&A

**Q: How does routing work in the Next.js App Router?**
A: The App Router uses file-based routing — the folder structure under the `app/` directory directly maps to the site's URL structure. A folder becomes a URL segment, and it only becomes an actual visitable route once it contains a file named `page.js` (or `page.tsx`). There's no separate route-configuration file to maintain; the filesystem itself is the source of truth.

**Q: What's the difference between a folder that just organizes routes and one that's an actual route?**
A: Any folder under `app/` contributes a segment to the URL path, but a folder is only reachable as an actual page if it directly contains a `page.js` file. A folder without one (e.g., `app/dashboard/` with no `page.js` of its own, only a nested `settings/page.js`) is purely organizational — `/dashboard` itself wouldn't resolve, even though `/dashboard/settings` would.

**Q: How are static assets like images served in Next.js, and what's a common mistake with them?**
A: Static assets go in the `public/` directory at the project root and are served from the site's URL root — a file at `public/logo.png` is requested as `/logo.png`. A common mistake is referencing it as `/public/logo.png`, which is wrong because `public/` is the serving root, not a URL path segment.

**Q: How does the App Router's routing model differ from the legacy Pages Router?**
A: In the Pages Router, a file placed directly in `pages/` is itself the route (`pages/about.js` → `/about`), and data fetching happens through special exported functions like `getServerSideProps`. In the App Router, routes are folder-plus-`page.js`, layouts are a first-class nested convention, and data fetching happens via `fetch` inside async Server Components. Both routers can server-render HTML by default — that's not new to the App Router — but only the App Router has the concept of a component whose JavaScript never ships to the client at all (Server Components); Pages Router components always ship their JS and hydrate.

**Q: What determines whether a segment in the URL is a fixed path or a dynamic parameter?**
A: A plain folder name (like `about` or `settings`) is a fixed, literal URL segment. A folder name wrapped in square brackets (like `[slug]` or `[id]`) is a dynamic segment — a single file underneath it matches any value in that position of the URL, and that value is made available to the page as a route parameter.
