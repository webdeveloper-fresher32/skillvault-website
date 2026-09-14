# 02 — Code Splitting & Lazy Loading

> "The fastest code to download is the code you never send. Don't make the user wait for a Settings page they'll open next Tuesday, if ever."

---

## Table of Contents

1. [The Problem: One Giant Bundle](#1-the-problem-one-giant-bundle)
2. [The Real-World Analogy](#2-the-real-world-analogy)
3. [What Code Splitting Actually Is](#3-what-code-splitting-actually-is)
4. [Internal Working — How the Bundle Gets Cut Up](#4-internal-working--how-the-bundle-gets-cut-up)
5. [React.lazy() and Suspense in Practice](#5-reactlazy-and-suspense-in-practice)
   - 5.1 [Why Suspense Is Required Here](#51-why-suspense-is-required-here)
   - 5.2 [Route-Based Code Splitting](#52-route-based-code-splitting)
   - 5.3 [Splitting Heavy, Rarely-Used Features](#53-splitting-heavy-rarely-used-features)
6. [Comparison: Eager Import vs Lazy Import](#6-comparison-eager-import-vs-lazy-import)
7. [Common Mistakes](#7-common-mistakes)
8. [When NOT to Split](#8-when-not-to-split)
9. [Interview Answer](#9-interview-answer)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. The Problem: One Giant Bundle

Let's start with what actually happens when you don't think about this at all.

You build a React app. It has a homepage, a dashboard, a settings page, a billing page, an admin panel, and a rich-text blog editor buried three clicks deep that maybe 2% of users ever open. You write normal, everyday imports:

```js
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Billing from "./pages/Billing";
import AdminPanel from "./pages/AdminPanel";
import BlogEditor from "./pages/BlogEditor";
```

Nothing wrong with this code. It's exactly how you're taught to write React. But here's the part that's easy to miss: your bundler (Vite, Webpack, whatever) sees every one of these `import` statements and says, "okay, all of this needs to ship together." It walks the whole import graph, starting from your entry file, and glues everything it finds into one file:

```
bundle.js  →  4.8 MB
```

Now think about the very first thing that happens when a brand-new visitor opens your app. They land on the homepage. That's it. That's all they want. But their browser has to download, parse, and execute all 4.8 MB before React can even render that homepage — including the code for the admin panel they'll never see, the billing page they haven't reached yet, and a rich-text editor library they may never touch.

That's the problem. **By default, one bundle means one download, and that download includes code the user doesn't need yet.** As your app grows — more pages, more features, more third-party libraries — that one bundle only gets bigger, and your homepage gets slower for everyone, even users who only ever visit the homepage.

---

## 2. The Real-World Analogy

Imagine you're packing for a two-week trip: a few days at the beach, a few days in the mountains, one fancy dinner.

**Bad approach — one giant duffel bag.** You throw everything in: swimsuits, hiking boots, a suit, sunscreen, a snow jacket. Every single time you need something — say, your sunscreen on day one — you have to unzip the entire bag and dig past the snow jacket and the suit to find it. You're hauling all of it around from the very first minute, whether or not you'll use it that day.

**Good approach — separate, labeled boxes.** Beach stuff in one box. Hiking stuff in another. The suit in its own garment bag. On day one, at the beach, you only open the beach box. The hiking boots and the suit stay packed away, untouched, until the day you actually need them.

Code splitting is packing your app the second way. Instead of one duffel bag (`bundle.js`) containing everything, you get labeled boxes (chunks) — a homepage chunk, a settings chunk, an admin chunk — and the browser only opens the box for the page the user is actually on.

---

## 3. What Code Splitting Actually Is

Okay, now the plain definition, which should feel obvious after that analogy:

> **Code splitting** is the practice of breaking your JavaScript bundle into multiple smaller files ("chunks"), so the browser only has to download the chunk it needs right now — not the entire application.

**Lazy loading** is the companion idea: instead of loading every chunk up front, you defer loading a chunk until the exact moment it's needed — typically, when the user navigates to a route or opens a feature that chunk contains.

They're two sides of one coin. Code splitting is *how* the bundler cuts the app into pieces. Lazy loading is *when* your app actually asks for one of those pieces.

---

## 4. Internal Working — How the Bundle Gets Cut Up

Let's look at what actually changes on disk and over the network, before we touch any syntax.

**Without code splitting** — one bundler output:

```text
┌─────────────────────────────────────────────────┐
│                  bundle.js  (4.8 MB)             │
│                                                   │
│   Homepage code                                  │
│   Dashboard code                                 │
│   Settings code                                  │
│   Billing code                                   │
│   Admin panel code                               │
│   Rich-text editor library                       │
│   Charting library                               │
│                                                   │
└─────────────────────────────────────────────────┘
        |
        v
Browser must download + parse + execute ALL of it
before the homepage can even render.
```

**With route-based code splitting** — the bundler produces several smaller files instead of one:

```text
┌───────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│  main-bundle.js        │  │  settings-chunk.js  │  │  reports-chunk.js  │
│  (400 KB)              │  │  (180 KB)           │  │  (650 KB, includes │
│                        │  │                     │  │  charting library) │
│  React itself          │  │  Settings page code │  │  Reports page code │
│  App shell / router    │  │                     │  │                    │
│  Homepage code         │  │                     │  │                    │
└───────────────────────┘  └────────────────────┘  └────────────────────┘
```

Now watch what actually crosses the network as a user moves through the app:

```text
Time  →   Event                              Network activity
─────────────────────────────────────────────────────────────────────
t=0       User opens the app (homepage)       GET main-bundle.js (400 KB)
                                               (that's it — page renders)

t=8s      User clicks "Settings" in the nav    GET settings-chunk.js (180 KB)
                                               (brief loading spinner, then
                                               Settings page renders)

t=25s     User clicks "Reports"                GET reports-chunk.js (650 KB)
                                               (loading spinner while the
                                               charting library downloads)
```

Compare the two timelines: in the "one giant bundle" world, the user pays the *full* 4.8 MB cost at `t=0`, before they've even seen the homepage. In the split world, they pay 400 KB at `t=0`, and only pay for `settings-chunk.js` or `reports-chunk.js` *if and when* they actually go looking for those features. A user who never opens Reports never downloads the charting library at all.

That's the entire win, in one sentence: **you shift cost from "every user, every time" to "only the users who need it, only when they need it."**

---

## 5. React.lazy() and Suspense in Practice

Now let's write the code that actually produces those separate chunks.

Everything starts with a completely ordinary JavaScript feature: the **dynamic `import()`**. You've probably only ever used the static form:

```js
// static import — resolved at build time, bundled in eagerly
import Settings from "./pages/Settings";
```

But JavaScript also has a dynamic form, which returns a Promise:

```js
// dynamic import — a function call, resolved at RUN time
import("./pages/Settings").then((module) => {
  console.log(module.default); // the Settings component
});
```

This one line is the actual boundary. When your bundler scans your code and sees `import("./pages/Settings")` written as a function call instead of a static `import` statement, it treats that as a signal: **"pull everything `Settings` needs into its own separate file, and don't include it in the main bundle."** That separate file is the chunk.

`React.lazy()` is a thin wrapper that turns that dynamic import into something you can render as a component:

```jsx
import { lazy } from "react";

const Settings = lazy(() => import("./pages/Settings"));
```

Read that line out loud: "`Settings` is a component that, when it's first rendered, needs to fetch its own code first." That's genuinely all `React.lazy` does — it takes a function that returns a dynamic `import()`, and gives you back something you can drop into JSX exactly like any other component.

---

### 5.1 Why Suspense Is Required Here

Here's the part that trips people up the first time, so let's slow down.

A component you get from `lazy()` is not immediately ready to render. Its code hasn't arrived yet — the browser has to go fetch `settings-chunk.js` over the network first, which takes time (even if it's fast, it's never instant). So the very first time React tries to render `<Settings />`, it hits a problem: *there's nothing to render yet.*

React's answer to "I don't have what I need to render yet, but I will soon" is `Suspense`. When a lazy component "suspends" like this, React looks up the tree for the nearest `<Suspense>` boundary and renders its `fallback` instead — usually a spinner or skeleton — until the chunk finishes downloading and the real component is ready.

```jsx
import { lazy, Suspense } from "react";

const Settings = lazy(() => import("./pages/Settings"));

function App() {
  return (
    <Suspense fallback={<div>Loading settings…</div>}>
      <Settings />
    </Suspense>
  );
}
```

If you forget the `<Suspense>` wrapper, React has no fallback to show while it waits, and it throws an error at you rather than silently rendering nothing. That's not React being fussy for no reason — it genuinely has no instructions for what to put on screen during that gap, so it insists you tell it.

This is actually a nice, concrete first taste of `Suspense` before you meet its fuller life in data-fetching and streaming (covered later, in Phase 11). Here, the "async thing" Suspense is waiting on is simply *a chunk of JavaScript arriving over the network* — which is a much easier mental model to start with than "a data fetch inside a component."

> **Memory hook:** "`lazy()` says 'I need to go fetch my code first' — `Suspense` is the only thing that knows what to show while it's fetching."

---

### 5.2 Route-Based Code Splitting

By far the most common — and highest-impact — place to apply this is at your routes. Think back to your routing setup (Phase 07): each route already represents a natural, self-contained chunk of your UI that the user only visits some of the time.

```jsx
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const Billing = lazy(() => import("./pages/Billing"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="page-loading">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

One `<Suspense>` boundary, wrapped around the whole `<Routes>` block, is enough here — whichever route matches will suspend on its own chunk, and the fallback covers all of them. Every page above now lives in its own chunk, downloaded only the moment the user actually navigates there. This single change is usually what people mean when they say "we added code splitting to our app" — it's the 80/20 of this whole topic.

---

### 5.3 Splitting Heavy, Rarely-Used Features

Routes aren't the only meaningful boundary. Some *components* are heavy enough, and used rarely enough, to deserve their own chunk even if they live on a page that loads immediately.

Classic examples:

- A rich text editor (like a WYSIWYG editor) that only appears once the user clicks "Write a post"
- A charting library that only renders once the user opens an "Analytics" tab
- A modal that isn't shown on initial page load — say, an "Upgrade to Pro" dialog

```jsx
import { lazy, Suspense, useState } from "react";

const UpgradeModal = lazy(() => import("./components/UpgradeModal"));

function BillingPage() {
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <div>
      <button onClick={() => setShowUpgrade(true)}>Upgrade Plan</button>

      {showUpgrade && (
        <Suspense fallback={<div>Loading…</div>}>
          <UpgradeModal onClose={() => setShowUpgrade(false)} />
        </Suspense>
      )}
    </div>
  );
}
```

Notice the `showUpgrade &&` guard — the lazy import doesn't even kick off until the user actually clicks the button. Most users who never click "Upgrade Plan" never download that modal's code at all.

---

## 6. Comparison: Eager Import vs Lazy Import

| | Static (`import ... from`) | Dynamic (`React.lazy(() => import(...))`) |
|---|---|---|
| **When the code loads** | Immediately, as part of the initial bundle | On demand, the first time the component is rendered |
| **Bundle impact** | Bundled into `main-bundle.js` (or whatever entry chunk it's imported from) | Split into its own separate chunk file |
| **Needs `Suspense`?** | No | Yes — required, or React throws |
| **Best for** | Things needed on first paint (layout, nav, homepage) | Routes, heavy rarely-used features, modals not shown immediately |
| **Effect on initial load** | Adds directly to initial download size | Keeps initial download smaller |
| **Effect on later navigation** | No extra request (already downloaded) | One extra network request the first time that chunk is needed |

---

## 7. Common Mistakes

**Mistake 1 — forgetting the `Suspense` wrapper.**

```jsx
const Settings = lazy(() => import("./pages/Settings"));

function App() {
  return <Settings />; // ❌ no Suspense boundary above this
}
```

React needs somewhere to look for a fallback while the chunk downloads. Without a `<Suspense>` ancestor, this throws an error instead of quietly failing — which is actually helpful, because it tells you immediately rather than shipping a broken loading experience to users.

**Mistake 2 — lazy-loading something needed on first paint.**

It's tempting to wrap *everything* in `lazy()` once you learn about it — including your `Header`, your `Nav`, or your `Home` page itself when it's the very first thing every user sees.

Don't. If `Home` is lazy, here's what actually happens: the browser downloads `main-bundle.js`, and *then* has to make a second round trip to fetch `home-chunk.js` before it can render anything at all. You've turned "one download, then render" into "two downloads in sequence, then render" — which makes the very first thing every user sees *slower*, not faster. Code splitting only pays off for code that's genuinely conditional — a different route, a feature behind a click — not for what's guaranteed to be needed immediately.

**Mistake 3 — over-splitting into too many tiny chunks.**

Each chunk is a separate network request, and every request carries its own overhead — a round trip, HTTP headers, connection handling. If you lazy-load every single small component (a button, a tooltip, a badge), you can end up with dozens of tiny chunks, each just a few KB, and the *overhead* of fetching them all separately can outweigh whatever bundle-size savings you were chasing. Code splitting is a tool for meaningful boundaries — routes, genuinely heavy libraries, rarely-used features — not a rule to apply to every component you write.

---

## 8. When NOT to Split

A quick, practical rule of thumb before moving on: split at **boundaries that are large and conditional**, and leave everything else alone.

```
Good candidates:
  - A route/page (Settings, Admin, Reports)
  - A heavy third-party library used in one place (rich text editor, charts, PDF generator)
  - A modal or panel not visible on initial load

Poor candidates:
  - A small presentational component (Button, Badge, Avatar)
  - Anything rendered above the fold on first paint
  - Anything so small that the extra network request costs more than it saves
```

If you're not sure whether something is "heavy enough" to split out, that's usually a sign it isn't — worth splitting is generally obvious (a charting library is hundreds of KB; a `Badge` component is a few lines of JSX).

---

## 9. Interview Answer

> "Code splitting is the practice of breaking a JavaScript bundle into smaller chunks so the browser only downloads what the current view actually needs, instead of the entire application up front. In React, `React.lazy()` combined with a dynamic `import()` marks a component as its own chunk boundary, and `Suspense` provides the fallback UI React shows while that chunk is being fetched over the network — it's required because React has to render *something* during that gap. The most common and highest-leverage application of this is route-based code splitting: each page in your router becomes its own lazy-loaded chunk, so a user who only visits the homepage never pays the download cost for the admin panel, the billing page, or any other route they haven't navigated to yet."

---

## 10. Hands-On Exercises

**Exercise 1 — Basic lazy route**

You have an `About` page component at `./pages/About.jsx`. Convert its import to `React.lazy`, and wrap it in a `Suspense` boundary with a fallback of `<p>Loading About…</p>`. Confirm (conceptually) that a static import of `Home` sits outside that `Suspense` boundary and loads immediately.

**Exercise 2 — Full route-based splitting**

Take a router with five routes (`Home`, `Dashboard`, `Settings`, `Billing`, `Admin`) that currently all use static imports. Rewrite it so every route except `Home` is lazy-loaded, with a single shared `Suspense` boundary wrapping the `<Routes>` block. Explain in one sentence why `Home` should stay a static import.

**Exercise 3 — Lazy-loading a modal**

You have an `UpgradeModal` component that is only shown after the user clicks a button. Write the component that lazy-loads `UpgradeModal` and only triggers the import when `showModal` is `true`, wrapped in its own local `Suspense` boundary.

**Exercise 4 — Spot the mistake**

Here's a snippet:

```jsx
const Header = lazy(() => import("./components/Header"));

function App() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <Header />
      <MainContent />
    </Suspense>
  );
}
```

`Header` renders on every single page, immediately, above the fold. Explain what's wrong with lazy-loading it and what the fix is.

**Exercise 5 — Over-splitting judgment call**

You have a `Tooltip` component used in 40 places across the app, each instance only a few lines of JSX with no external dependencies. A teammate suggests wrapping it in `React.lazy()` "to be safe." Write 2-3 sentences explaining whether you'd agree, referencing network request overhead.

**Exercise 6 — Reading a bundle report**

Imagine your bundler's output report shows: `main-bundle.js` (420 KB), `settings-chunk.js` (30 KB), `reports-chunk.js` (610 KB, includes a charting library). A user who only ever visits Settings never visits Reports. Describe, in terms of bytes downloaded, the difference between this app and a version with no code splitting at all.

---

## 11. Interview Q&A

**Q1: What problem does code splitting solve?**

A: Without it, a bundler packages an entire application — every page, every feature, every third-party library — into one JavaScript file. Every user has to download, parse, and execute all of it before anything can render, even if they only ever visit one page. Code splitting breaks that single bundle into smaller chunks so users only download the code the current view actually needs.

---

**Q2: What does `React.lazy()` actually do?**

A: It takes a function that returns a dynamic `import()` and wraps it so the result can be rendered as a normal React component. The dynamic `import()` call is the signal the bundler uses to pull that module's code into its own separate chunk file, rather than including it in the main bundle. The component's actual code isn't fetched until the first time `React.lazy`'s returned component is rendered.

---

**Q3: Why is `Suspense` required when using `React.lazy()`?**

A: A lazy component's code has to be fetched over the network before React can render it, and that fetch is never instant. React needs something to display during that gap. `Suspense` provides that fallback: when a lazy component "suspends" because its chunk hasn't arrived yet, React renders the nearest `Suspense` boundary's `fallback` instead. Without a `Suspense` ancestor, React has no fallback to show and throws an error.

---

**Q4: What is the most common and highest-impact code-splitting pattern?**

A: Route-based code splitting — lazy-loading each page/route in your router so a user only downloads the code for the pages they actually visit, instead of every page in the app up front.

---

**Q5: What's the difference between a static `import` and a dynamic `import()`?**

A: A static `import` is resolved at build time and is always bundled in wherever it's imported. A dynamic `import()` is a function call that returns a Promise, resolved at run time — it tells the bundler to split that module into its own separate chunk that's fetched only when the function actually executes.

---

**Q6: Should you lazy-load your Home page if it's the first thing every user sees?**

A: No. Lazy-loading something needed on first paint adds an extra network round trip before it can render — the browser downloads the main bundle, then has to make a second request for the lazy chunk before rendering anything. That makes the initial load slower, not faster. Code splitting should target code the user might not need right away, not the very first screen.

---

**Q7: What's the risk of over-splitting an app into too many tiny chunks?**

A: Every chunk is a separate network request, and each request carries overhead (round trip time, HTTP headers, connection setup). If you split dozens of tiny components into their own chunks, that per-request overhead can outweigh whatever bundle-size savings you were hoping for. Code splitting pays off at meaningful boundaries — routes, heavy libraries, rarely-used features — not for every small component.

---

**Q8: Give three examples of good code-splitting boundaries besides routes.**

A: A heavy third-party library used in only one place (a rich text editor, a charting library, a PDF generator), a modal or panel that isn't visible on initial page load (like an "Upgrade to Pro" dialog), and any feature that's behind a user action most visitors never take (an admin-only panel, an advanced settings tab).

---

**Q9: What happens if you forget to wrap a lazy component in `Suspense`?**

A: React throws an error, because it has no fallback UI to render while the component's chunk is still being fetched. It's not a silent failure — React insists you provide instructions for what to show during that loading gap.

---

**Q10: Can a single `Suspense` boundary cover multiple lazy components, like an entire set of routes?**

A: Yes. Wrapping a whole `<Routes>` block in one `Suspense` boundary is common and sufficient — whichever route matches will suspend against that same boundary and show its fallback while its chunk loads. You don't need one `Suspense` per lazy component; you need one per meaningful "loading region" of your UI.

---

**Q11: How does code splitting affect a user who only ever visits one page of a multi-page app?**

A: They only download the main bundle plus the chunk for the one page they visit. They never pay the download cost for any other route's code — the settings chunk, the admin chunk, the reports chunk (and any libraries only those pages use) simply never get requested.

---

**Q12: What is the relationship between code splitting and lazy loading?**

A: Code splitting is how the bundler cuts the application into separate chunk files. Lazy loading is when your app actually requests one of those chunks — typically deferred until the moment a route is visited or a feature is used, rather than up front. They work together: splitting creates the pieces, lazy loading decides when to fetch each piece.

---

**Q13: Why is route-based splitting described as tying back to your router setup?**

A: Each route in something like React Router already represents a self-contained section of the UI that the user only visits some of the time — exactly the shape code splitting wants. Wrapping each route's element in `React.lazy()` turns a routing decision you've already made ("this URL shows this page") directly into a bundle-loading decision ("this page's code loads only when this URL is visited"), with almost no extra design work.

---

**Q14: Does code splitting reduce the total amount of code the user downloads over the lifetime of using the app, or just the initial load?**

A: It primarily improves the *initial* load — total bytes downloaded across a full session may end up similar (or even slightly higher, due to per-chunk overhead) if the user eventually visits every page. The real win is fewer bytes needed before the first meaningful render, and zero bytes spent on features/pages the user never visits at all.

---

**Q15: How does `React.lazy()` relate to Suspense's fuller role in data fetching, covered later in this course?**

A: `React.lazy()` is really just one specific case of a more general idea: `Suspense` lets a component "pause" rendering while something asynchronous resolves, and shows a fallback in the meantime. Here, the asynchronous thing is a network fetch for a JavaScript chunk. Later (Phase 11), you'll see the same `Suspense` mechanism used for asynchronous *data* fetching — a component pausing while it waits for an API response rather than a script file. The mental model — "something async is pending, show a fallback until it resolves" — is identical in both cases.

> **Memory hook:** "Don't ship the whole warehouse to every customer — pack only the box for the aisle they're walking into, and hand them a 'one moment' sign while it's on its way."
