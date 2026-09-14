# Why Next.js

> "React hands you the engine. Next.js hands you the car — wheels, chassis, and a windshield already fitted."

---

## Table of Contents

1. [The Problem: A Blank Screen Until JavaScript Catches Up](#1-the-problem-a-blank-screen-until-javascript-catches-up)
2. [The Request Lifecycle, Side by Side](#2-the-request-lifecycle-side-by-side)
3. [What Next.js Adds #1 — Server Rendering Out of the Box](#3-what-nextjs-adds-1--server-rendering-out-of-the-box)
4. [What Next.js Adds #2 — File-Based Routing Out of the Box](#4-what-nextjs-adds-2--file-based-routing-out-of-the-box)
5. [What Next.js Adds #3 — A Production Build Pipeline Out of the Box](#5-what-nextjs-adds-3--a-production-build-pipeline-out-of-the-box)
6. [Scaffolding a Project: create-next-app Walkthrough](#6-scaffolding-a-project-create-next-app-walkthrough)
7. [Next.js vs Plain React (CRA/Vite)](#7-nextjs-vs-plain-react-cravite)
8. [Common Misconceptions](#8-common-misconceptions)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Problem: A Blank Screen Until JavaScript Catches Up

Forget the definition of Next.js for a second. Look at what a plain client-rendered React app (Vite or Create React App) actually sends over the wire.

### The Empty HTML Shell

```html
<!DOCTYPE html>
<html>
  <head><title>My App</title></head>
  <body>
    <div id="root"></div>
    <script src="/assets/index-a1b2c3.js"></script>
  </body>
</html>
```

```
<div id="root"></div>
  ↳ No headline, no product list, no readable text. Everything
    the user is supposed to see lives inside the JS bundle below.

<script src="/assets/index-a1b2c3.js"></script>
  ↳ Hasn't even started downloading yet when this HTML arrives.
```

### Six Steps Before Anything Real Appears

```
1. Browser receives empty HTML → paints blank white screen
2. Browser requests index-a1b2c3.js
3. Browser downloads the bundle (fraction of a second on wifi,
   seconds on a mid-range phone over 4G)
4. Browser parses + executes JS → React builds the component tree
5. Component mounts → fires useEffect → fetch starts NOW
6. Data arrives → React re-renders with real content
   ↳ ONLY NOW does the user see the page they came for
```

Steps are mostly sequential — step 5 can't start until step 4 finishes. That queue is exactly what shows up as slow First Contentful Paint / Largest Contentful Paint on real devices.

### The SEO Problem

A crawler that doesn't execute JavaScript reads the same empty `<div id="root">` the browser does — no title, no article body, no product description. For a marketing site or storefront, that's a direct hit to search rankings and link previews.

### Missing Pieces: Routing and Code-Splitting

Plain React also gives you no built-in answer for **routing** (you install `react-router` yourself) or **code-splitting** (possible via manual `React.lazy()`, but easy to forget).

```
The actual problem Next.js solves:
  A plain client-rendered React app ships an empty shell and does
  everything — rendering, data fetching, routing — after the fact,
  in the browser. You're on your own for wiring up the rest.
```

---

## 2. The Request Lifecycle, Side by Side

Same six steps from Section 1, now next to what happens with Next.js's App Router.

```text
PLAIN REACT (client-only)                    NEXT.JS (App Router)
--------------------------                   --------------------------
Browser requests page                        Browser requests page
        |                                            |
        v                                            v
Server sends near-empty HTML                 Server RUNS React components,
  <div id="root"></div>                      fetches data ON THE SERVER
        |                                            |
        v                                            v
Browser downloads JS bundle                  Server sends back FULL HTML
  (blocks everything below                   (already contains the real
   until it finishes)                         content a crawler can read)
        |                                            |
        v                                            v
Browser parses + executes JS                 Browser paints that HTML
  React builds the component tree             IMMEDIATELY — real content
        |                                     right away
        v                                            |
Component mounts, fires useEffect                    v
  to fetch data                               Browser downloads a much
        |                                     SMALLER JS bundle (only
        v                                     interactive-part code)
Data arrives, React re-renders                       |
        |                                            v
        v                                     React "hydrates" — attaches
User FINALLY sees the actual page             event listeners to the
                                               HTML already on screen
                                                      |
                                                      v
                                               Page becomes interactive
```

### Why the Order Matters

```
Plain React: "user sees real content" = LAST step
  ↳ gated behind JS download + parse + execute + fetch

Next.js:     "user sees real content" = FIRST response
  ↳ server already ran components + fetched data before sending
```

Client-side JS doesn't disappear — the page still needs to hydrate. But that download happens *after* the user already has something real on screen, not as the gatekeeper for whether they see anything at all.

---

## 3. What Next.js Adds #1 — Server Rendering Out of the Box

Next.js runs your component code on the server (or ahead of time at build) and produces real HTML before the response reaches the browser.

### Default Behavior, No Opt-In

In the App Router, this isn't an extra config flag — every component you write is server-rendered by default, unless you mark it with `"use client"` (that opt-out is Lesson 3's entire subject).

```jsx
// app/products/page.jsx — this runs on the SERVER by default
async function getProducts() {
  const res = await fetch("https://api.example.com/products");
  return res.json();
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}
```

```
async function ProductsPage()
  ↳ No useState for products, no useEffect to trigger the fetch,
    no loading boolean, no placeholder UI.

await getProducts()
  ↳ Runs BEFORE anything is sent to the browser — no user is
    staring at a blank screen while this awaits.
```

---

## 4. What Next.js Adds #2 — File-Based Routing Out of the Box

### The Plain-React Way

```jsx
// A plain-React app has to do this itself
import { BrowserRouter, Routes, Route } from "react-router-dom";

<BrowserRouter>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/about" element={<About />} />
    <Route path="/blog/:slug" element={<BlogPost />} />
  </Routes>
</BrowserRouter>;
```

A separate config file, mapping paths to elements, that has to stay in sync with your component files.

### The Next.js Way

Next.js replaces that config file with a filesystem convention — the folder structure under `app/` *is* the routing table.

```text
app/
├── page.js                →  /
├── about/
│   └── page.js            →  /about
└── blog/
    └── [slug]/
        └── page.js        →  /blog/:slug   (dynamic segment)
```

Create `app/about/page.js` and `/about` exists — nothing to register anywhere else. (Only previewed here; full routing rules are Phase 2's subject.)

---

## 5. What Next.js Adds #3 — A Production Build Pipeline Out of the Box

Plain React also leaves bundling, code-splitting, minification, and image optimization to you — a Vite/CRA bundler works, but per-route splitting is something you configure yourself via dynamic `import()`.

### next build, Automatically Per Route

```bash
next build

Route (app)                              Size     First Load JS
┌ ○ /                                    142 B          87.4 kB
├ ○ /about                               138 B          87.3 kB
└ ƒ /blog/[slug]                         1.2 kB         89.1 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

```
Each route → its own JS chunk + a shared baseline (React, framework code)
  ↳ A visitor to /about never downloads /blog/[slug]'s code.
  ↳ Same category of win a plain React setup COULD achieve manually —
    Next.js just does it by default, per route, with nothing to wire up.
```

---

## 6. Scaffolding a Project: create-next-app Walkthrough

```bash
npx create-next-app@latest my-app
```

### The Prompts

```text
✔ Would you like to use TypeScript? … Yes
✔ Would you like to use ESLint? … Yes
✔ Would you like to use Tailwind CSS? … Yes
✔ Would you like your code inside a `src/` directory? … No
✔ Would you like to use App Router? (recommended) … Yes
✔ Would you like to customize the import alias (@/* by default)? … No

Creating a new Next.js app in /Users/you/my-app.
Using npm.

Installing dependencies:
- react
- react-dom
- next

Success! Created my-app at /Users/you/my-app
```

### The Resulting Project

```text
my-app/
├── app/
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── public/
├── next.config.js
├── package.json
└── tsconfig.json
```

Server rendering, file-based routing, and a build pipeline — already wired in, nothing left to install.

```bash
cd my-app
npm run dev
```

```text
   ▲ Next.js 14.2.3
   - Local:        http://localhost:3000

 ✓ Ready in 890ms
```

`http://localhost:3000` is already server-rendered, routed, and bundled — compare to a fresh Vite project, where all three are still ahead of you.

---

## 7. Next.js vs Plain React (CRA/Vite)

| Aspect | CRA / Vite + React | Next.js |
|---|---|---|
| Routing | Manual — install and configure `react-router-dom`, keep a `<Routes>` list in sync | Built in — file-based, derived from the `app/` directory structure |
| Rendering | Client-only — initial HTML is an empty shell until JS runs | Server + client — HTML arrives with real content already rendered |
| Data fetching | Manual — `useEffect` + `useState` + a loading flag per component | `fetch` directly inside async Server Components, no loading-state boilerplate |
| Zero-config SSR | No — build and maintain a Node server + renderer yourself | Yes — SSR/SSG available immediately |
| Code-splitting | Possible via manual `React.lazy()` + bundler config | Automatic — every route gets its own JS chunk by default |
| SEO / crawlable content | Poor by default — non-JS crawlers see an empty page | Strong by default — real HTML in the initial response |

---

## 8. Common Misconceptions

**"Next.js is just React with some extra config."** Config changes *how* a tool behaves; Server Components change *where your code runs*. In the App Router, component code executes on the server by default — that's a shift in execution model, not a settings tweak (Lesson 3's subject).

**"If I'm using Next.js, I don't need to think about client vs. server anymore."** The opposite — Next.js makes that a first-class, per-component decision (`"use client"` or not), rather than something a client-only app never has to think about.

**"Every project should use Next.js."** Not necessarily. A purely client-side internal tool behind a login wall, with no SEO or first-paint requirement, gains little and picks up structure it doesn't need.

**"Server rendering means the page is static and can't be interactive."** No — server-rendered HTML is the *starting point*; interactivity still comes from client-side JS hydrating parts of the page afterward.

---

## 9. Hands-On Exercises

**Exercise 1 — Feel the blank-page problem.** Scaffold `npm create vite@latest my-plain-app -- --template react`, open the Network tab, throttle to "Slow 3G," reload. Time how long the screen stays blank.

**Exercise 2 — Scaffold a Next.js project.** Run `npx create-next-app@latest my-next-app` (TypeScript, ESLint, App Router). Start with `npm run dev`, view page source, and confirm real text content is present — not just an empty `<div id="root">`.

**Exercise 3 — Compare the raw HTML.** With both apps running, `curl localhost:5173` (Vite) and `curl localhost:3000` (Next.js). Confirm the Vite response is an empty shell and the Next.js response already contains real markup.

**Exercise 4 — Add a route with zero configuration.** In your Next.js project, create `app/about/page.jsx` returning a heading. Without touching any router config, confirm `/about` works.

**Exercise 5 — Inspect the build output.** Run `npx next build` and read the route-by-route size table. Identify static (`○`) vs dynamic (`ƒ`) routes, and note each route has its own "First Load JS" size.

---

## 10. Interview Q&A

**Q: What problem does Next.js solve that plain React (via Vite or CRA) doesn't?**
A: A plain client-rendered React app ships an essentially empty HTML shell; the browser has to download, parse, and execute the JS bundle, then fetch data, before the user sees any real content — which hurts first-paint performance and means non-JS-executing crawlers see nothing for SEO purposes. Next.js renders on the server by default, so the initial HTML response already contains real content, and it also provides file-based routing and an automatic, per-route build pipeline that a plain React setup would otherwise require you to configure by hand.

**Q: Walk through the difference in request lifecycle between a plain React SPA and a Next.js App Router app.**
A: In a plain React SPA, the server returns an empty HTML shell; the browser downloads and executes the JS bundle, React builds the component tree, a `useEffect` fires a data fetch, and only after that data arrives does the user see real content. In Next.js, the server runs the React components and fetches data before responding, so the very first HTML response already contains the finished content; the browser paints that immediately, then downloads a smaller JS bundle just to hydrate the interactive parts.

**Q: Is Next.js "just React with some config," or is there a more fundamental difference?**
A: It's a more fundamental difference. Configuration changes how existing behavior is tuned; Next.js's App Router changes where component code actually executes — by default, on the server rather than in the browser. That's a shift in execution model (Server Components), not a settings change, and it affects what a component can and can't do (e.g., direct database access on the server vs. `useState`/browser APIs on the client).

**Q: When would you choose plain React over Next.js?**
A: When the application is purely client-side with no SEO requirement and no need for fast initial paint — for example, an internal tool or dashboard sitting behind a login wall. In that case, Next.js's server-rendering and file-based-routing conventions add structure without a corresponding payoff, and a simpler client-only setup (e.g., Vite + React + a router library) is a better fit.

**Q: How does Next.js's file-based routing compare to manually configuring react-router?**
A: With `react-router`, you install the library and maintain a route configuration (a `<Routes>` list mapping paths to components) as a separate source of truth from your file structure. In Next.js's App Router, the folder structure under `app/` directly determines the routes — creating `app/about/page.js` makes `/about` a working route with nothing else to register, so there's a single source of truth instead of two that need to stay in sync.
