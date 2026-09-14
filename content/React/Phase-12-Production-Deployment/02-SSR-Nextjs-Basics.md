# 02 — Server-Side Rendering & Next.js Basics

> "The browser shouldn't have to build the newspaper before you're allowed to read it."

---

## Table of Contents

1. [The Problem: A Blank Page Waiting on JavaScript](#1-the-problem-a-blank-page-waiting-on-javascript)
2. [What Server-Side Rendering Actually Is](#2-what-server-side-rendering-actually-is)
3. [Hydration — Attaching Life to Static HTML](#3-hydration--attaching-life-to-static-html)
   - 3.1 [How Hydration Works, Step by Step](#31-how-hydration-works-step-by-step)
   - 3.2 [Hydration Mismatches — The Classic SSR Bug](#32-hydration-mismatches--the-classic-ssr-bug)
4. [Next.js — SSR Without Hand-Rolling It Yourself](#4-nextjs--ssr-without-hand-rolling-it-yourself)
   - 4.1 [File-Based Routing](#41-file-based-routing)
   - 4.2 [Server Components vs Client Components](#42-server-components-vs-client-components)
5. [A Conceptual App Router Example](#5-a-conceptual-app-router-example)
6. [CSR vs SSR vs SSG — When Each One Makes Sense](#6-csr-vs-ssr-vs-ssg--when-each-one-makes-sense)
7. [Common Mistakes and Confusions](#7-common-mistakes-and-confusions)
8. [Interview Answer — Hydration in One Paragraph](#8-interview-answer--hydration-in-one-paragraph)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Problem: A Blank Page Waiting on JavaScript

You've spent this whole course building React apps with Vite. You run `npm run build`, deploy the `dist` folder, and it works. So what's actually wrong with that setup?

Let's look at the HTML that a plain client-side-rendered (CSR) React app actually ships to the browser. Open the `dist/index.html` from any Vite React project and you'll see something like this:

```html
<!doctype html>
<html>
  <head>
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-a1b2c3.js"></script>
  </body>
</html>
```

That's it. That's the *entire* page. `<div id="root"></div>` — empty. No content, no text, nothing a human or a search crawler can read.

Everything your user actually sees — the header, the product list, the "Welcome back, Alice" — doesn't exist yet. It's sitting inside `index-a1b2c3.js`, a JavaScript bundle that hasn't even started downloading.

Here's the sequence a real visitor on a real phone, on a real 4G connection, goes through:

```
1. Browser requests the page
2. Server sends back that nearly-empty HTML   -> still blank
3. Browser starts downloading the JS bundle    -> still blank
4. Browser parses the JS bundle                -> still blank
5. Browser executes the JS                     -> still blank
6. React runs, builds the DOM, renders content -> finally visible!
7. Page becomes interactive
```

Six steps of "still blank" before the user sees a single word. On a fast laptop with a warm cache, this might be 200ms and you'd never notice. On a mid-range phone with a shaky connection, this can be several seconds of a white screen. That's not a great first impression.

There's a second problem hiding here too: **SEO**. Search engine crawlers (and social media link-preview bots, and various scraping tools) don't all execute JavaScript equally well. Some do it slowly, some skip it, some time out before your bundle even finishes running. If your entire page's content only exists *after* JS execution, some of those crawlers see... nothing. An empty `<div id="root"></div>` and nothing else.

So we have two real problems:
1. Users stare at a blank screen longer than they should.
2. Some crawlers/bots see an empty page instead of your content.

Both problems have the same root cause: **the HTML the server sends contains no actual content — just a shell waiting for JavaScript to fill it in.**

What if the server just... filled it in before sending it?

---

## 2. What Server-Side Rendering Actually Is

**Real-world analogy first**, because this is genuinely the clearest way to get it:

> **CSR (Client-Side Rendering)** is like handing someone a blank sheet of paper and a portable printer. They have to plug in the printer, wait for it to warm up, and watch it print the newspaper line by line before they can read a single headline.
>
> **SSR (Server-Side Rendering)** is like handing someone a newspaper that's already been printed at the press. They can start reading the front page the instant it's in their hands.

That's the whole idea. With SSR, instead of sending an empty shell and letting the browser build the page, **the server runs your React components itself**, produces the actual HTML markup — headings, paragraphs, images, real text — and sends that fully-formed HTML to the browser immediately.

**Basic definition:** Server-Side Rendering is the technique of executing your React component tree on the server (in Node.js, typically) to generate real HTML up front, so the browser has something meaningful to display the moment the response arrives — before any JavaScript has even downloaded, let alone run.

Let's put the two approaches side by side as timelines, because seeing them next to each other makes the difference click immediately:

```
CSR TIMELINE
────────────────────────────────────────────────────────────
Request  →  [blank HTML]  →  download JS  →  parse/run JS  →  render  →  interactive
             (nothing            (nothing        (nothing       (finally
              visible)            visible)        visible)       visible!)

SSR TIMELINE
────────────────────────────────────────────────────────────
Request  →  [full HTML]  →  ------- JS downloads in background -------  →  hydration  →  interactive
             (content is                                                   (page was
              visible                                                       already
              immediately!)                                                 readable
                                                                              during this)
```

Notice the huge difference: with SSR, the "content visible" moment happens almost immediately — right when the HTML response arrives. The user can start *reading* the page while the JavaScript is still quietly downloading in the background. They just can't click buttons or type into forms yet, because none of that JS has attached itself to the page.

That's the trade SSR makes: **visible content, fast** — but **interactivity, slightly delayed** until the JS shows up and does its thing. And "its thing" has a name: hydration. Let's go there next, because this is the single most important — and most misunderstood — mechanic in all of SSR.

---

## 3. Hydration — Attaching Life to Static HTML

Here's a question worth sitting with for a second: if the server already sent fully-formed HTML, why does the browser need to run React's JavaScript *at all*? The page already looks right!

Because **looking right isn't the same as working right.** That server-rendered HTML has no event listeners. Click a button — nothing happens. Type into an input — nothing happens. State doesn't exist yet. It's a static picture of what the page *should* look like, not a living application.

**Hydration** is the process where React's JavaScript, once it finishes downloading and running in the browser, "wakes up" that static HTML — attaching event listeners, restoring component state, and taking over ownership of the DOM — *without throwing away and rebuilding the HTML that's already there.*

That last part is the whole point. React doesn't say "ignore all this HTML, let me build it fresh from scratch" (that would be wasteful and would cause a visible flicker). Instead, it walks through the existing DOM nodes and the component tree *in parallel*, matching them up one by one, and quietly attaches the interactive plumbing to what's already sitting on the page.

### 3.1 How Hydration Works, Step by Step

```
1. Server renders <App /> to HTML       →  sent to browser, shown immediately
2. Browser displays that static HTML    →  user can read it right now
3. JS bundle downloads in background    →  page still just sitting there, readable
4. JS finishes downloading and runs     →  React starts hydrating
5. React walks the DOM node-by-node,
   comparing it to what <App /> would
   render on the client                →  "does this match what I expected?"
6. Where it matches: React attaches
   event listeners + internal state
   to the EXISTING DOM nodes            →  no re-render, no flicker
7. Page is now fully interactive        →  buttons work, inputs work, state works
```

The critical assumption baked into step 5 is: **the HTML the server sent must match what the client would have rendered anyway.** Same tags, same text, same structure. If it doesn't match — that's a hydration mismatch, and it's the single most common real-world bug you'll hit with SSR.

### 3.2 Hydration Mismatches — The Classic SSR Bug

Let's build the intuition with a concrete, very-easy-to-write-by-accident example.

Imagine a Server Component that renders the current time:

```jsx
// A Server Component — runs ONLY on the server
function Timestamp() {
  return <p>Rendered at: {Date.now()}</p>;
}
```

Here's what happens:

1. The **server** runs this at, say, `10:00:00.123`. It sends HTML containing `Rendered at: 1735900800123`.
2. The browser displays that HTML immediately. Looks fine.
3. The JS bundle finishes downloading. React starts hydrating.
4. During hydration, React (in dev mode especially) checks: "if I rendered this component on the client *right now*, what would I get?"
5. On the client, `Date.now()` evaluates again — but time has moved on. Maybe it's now `10:00:01.847`.
6. **Mismatch.** The server said `1735900800123`. The client, hydrating, computes `1735900801847`. They don't match.

React's response to this is a console warning (something along the lines of "Text content does not match server-rendered HTML" / "Hydration failed because the initial UI does not match what was rendered on the server"), and in many cases it falls back to throwing away the server HTML for that part of the tree and re-rendering it on the client — which defeats the entire purpose of SSR for that content, and can cause a visible flicker.

`Math.random()` is the other classic offender for exactly the same reason:

```jsx
// Also a hydration-mismatch time bomb
function LuckyNumber() {
  return <p>Your lucky number: {Math.random()}</p>;
}
```

The server computes one random number. The moment the client hydrates and evaluates the same expression, it gets a *different* random number. Guaranteed mismatch, every single time.

**Why does this matter so much?** Because hydration's entire premise is: *"server output and client output must be identical, so I can safely reuse the existing DOM instead of rebuilding it."* Anything that produces different output depending on *when* or *where* it runs — the current time, a random number, `typeof window` checks, locale-dependent formatting that differs between server and client environments — breaks that promise.

The fix is straightforward once you see it: don't compute non-deterministic values directly during render on a path that's shared between server and client. Instead, compute the timestamp once (e.g., pass it in as a prop from a stable source, or compute it only after mount via an effect on the client side, accepting that it'll simply be blank/placeholder during the very first paint).

```jsx
// Fixed: only set the "live" value after mount, client-side only
'use client';
import { useState, useEffect } from 'react';

function Timestamp() {
  const [time, setTime] = useState(null); // null on both server and initial client render — matches!

  useEffect(() => {
    setTime(Date.now()); // only runs in the browser, after hydration is done
  }, []);

  return <p>Rendered at: {time ?? 'loading...'}</p>;
}
```

Now server and client agree on the *first* render (`null` → "loading..." on both sides), and the real timestamp only appears afterward, safely outside the hydration comparison.

---

## 4. Next.js — SSR Without Hand-Rolling It Yourself

You could, technically, build your own SSR pipeline: spin up a Node server, use React's `renderToString` (or `renderToPipeableStream`) API to turn your component tree into HTML, wire up routing yourself, handle data fetching timing, handle hydration on the client... It's a lot of plumbing, and most of it is the same plumbing every SSR app needs.

**Next.js** is the framework that packages all of that plumbing for you. It's currently the dominant way to build server-rendered React applications, precisely because it takes care of the boring, error-prone infrastructure — routing, bundling, server/client boundary management, data fetching conventions — so you can focus on components and logic.

Two of its biggest pieces, at a conceptual level:

### 4.1 File-Based Routing

Instead of configuring routes in a JavaScript file (like you did with React Router earlier in this course), Next.js looks at your **folder structure** and turns it into routes automatically.

```
app/
├── page.js              →  route: /
├── about/
│   └── page.js          →  route: /about
├── blog/
│   ├── page.js          →  route: /blog
│   └── [slug]/
│       └── page.js      →  route: /blog/:slug   (dynamic segment)
```

Create a folder, drop a `page.js` in it, and that's a route. No route config file to maintain, no manually mapping paths to components.

### 4.2 Server Components vs Client Components

This is the conceptually deepest part of modern Next.js, so let's slow down here.

In the **App Router** (Next.js's current routing system), every component you write is, by default, a **Server Component** — unless you explicitly opt out. This is a genuinely different model from "plain React," and it's worth understanding what each kind can and can't do.

**Server Components:**
- Run *only* on the server. Their JavaScript is never sent to the browser at all — not even as part of the bundle.
- Can directly access server-side resources: query a database, read a file from disk, call an internal API with a secret key — all without exposing any of that code or those credentials to the client.
- Cannot use browser-only things: no `useState`, no `useEffect`, no event handlers like `onClick`, no `window`, no `localStorage`. None of that exists on the server, so none of it is available here.

**Client Components:**
- Opt in by adding the `'use client'` directive at the very top of the file.
- Run in the browser (in addition to an initial server render for the HTML shell, followed by hydration, same as any SSR content).
- *Can* use `useState`, `useEffect`, event handlers, browser APIs — anything interactive.
- Their JavaScript *does* get shipped to the browser, because the browser needs to run it.

Here's the mental picture — a single component tree where some branches are server-only and some are client:

```
<Page>                          ← Server Component (default, no directive needed)
 │
 ├── <ProductDetails>            ← Server Component — fetches directly from the database
 │     │
 │     └── <AddToCartButton>     ← 'use client' — needs onClick + useState for cart count
 │
 └── <RecentlyViewed>            ← Server Component — reads from a recommendations service
       │
       └── <Carousel>            ← 'use client' — needs useState for "current slide"
```

The rule of thumb: push interactivity as *far down* the tree as possible, and keep it in small, isolated Client Components. Everything above and around it — the data-fetching, the layout, the static parts — stays as Server Components, which means less JavaScript shipped to the browser overall. Only the components that genuinely need `onClick` or `useState` pay the "ship JS to the client" cost.

---

## 5. A Conceptual App Router Example

Here's what this looks like woven together — a product page where the product data is fetched directly on the server, but the "Add to Cart" button needs client-side interactivity.

```jsx
// app/products/[id]/page.js
// No 'use client' directive here → this is a Server Component by default

async function getProduct(id) {
  // Runs ONLY on the server — could be a direct database call,
  // an internal service call, whatever your backend needs.
  const res = await fetch(`https://api.example.com/products/${id}`);
  return res.json();
}

export default async function ProductPage({ params }) {
  const product = await getProduct(params.id);

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p>${product.price}</p>

      {/* This nested component handles the interactive part */}
      <AddToCartButton productId={product.id} />
    </div>
  );
}
```

```jsx
// app/products/[id]/AddToCartButton.js
'use client'; // opt-in: this needs state and an event handler, so it runs in the browser

import { useState } from 'react';

export default function AddToCartButton({ productId }) {
  const [added, setAdded] = useState(false);

  function handleClick() {
    // in a real app: call an API, update a cart context, etc.
    setAdded(true);
  }

  return (
    <button onClick={handleClick}>
      {added ? 'Added!' : 'Add to Cart'}
    </button>
  );
}
```

Notice what just happened: `ProductPage` is `async` and directly `await`s a data call — no `useEffect`, no loading spinner state, no client-side fetch waterfall. It just fetches the data where the component is, on the server, and the resulting HTML (product name, description, price, all real text) is what gets sent to the browser immediately.

Meanwhile, `AddToCartButton` is the *only* part of this tree whose JavaScript actually ships to the browser — because it's the only part that needs `useState` and `onClick`. The rest of the page's logic (the data fetching, the layout) never becomes browser-side JavaScript at all.

---

## 6. CSR vs SSR vs SSG — When Each One Makes Sense

There's actually a third option we haven't discussed yet: **Static Site Generation (SSG)**, where the HTML is generated *once*, at build time (not per-request), and then just served as a static file from then on — no server-side rendering work happens on each visit at all.

| | CSR (Client-Side Rendering) | SSR (Server-Side Rendering) | SSG (Static Site Generation) |
|---|---|---|---|
| **When is HTML built?** | In the browser, after JS runs | On the server, per request | Once, at build time |
| **When is data fetched?** | After the page loads, in the browser | On the server, right before responding | At build time, before deployment |
| **SEO friendliness** | Weak — content only exists after JS runs | Strong — full HTML on every request | Strong — full HTML always available |
| **First content visible** | Slowest (waits for JS) | Fast (HTML arrives ready) | Fastest (often served from a CDN edge) |
| **Freshness of data** | Always live | Always fresh (recomputed each request) | Stale until the next rebuild |
| **Server cost per visit** | Low (just serves static files + API calls) | Higher (renders React on every request) | Lowest (just serves a static file) |
| **Best use case** | Interactive dashboard behind a login (no SEO need, data changes constantly per-user) | A page needing fresh per-request data *and* good SEO (a personalized storefront, a search results page) | A marketing page or blog post that rarely changes |

A few concrete calls to make this less abstract:

- **A logged-in analytics dashboard** — nobody's Googling their way into your private dashboard, and the data is deeply personal/interactive anyway. CSR is not just "fine" here, it's the right choice — you don't pay any server-rendering cost for something search engines will never see.
- **A company blog or marketing landing page** — content that maybe changes once a day, needs to rank on Google, and is the same for every visitor. SSG is ideal: build it once, serve it from a CDN, instant loads for everyone.
- **A product page with live inventory/pricing, or a personalized "recommended for you" section, that also needs to be crawlable** — this is SSR's home turf: fresh data on every request, real HTML for the crawler, no stale-until-rebuild problem.

---

## 7. Common Mistakes and Confusions

**Mistake 1: Hydration mismatches** — covered in depth in Section 3.2, but worth repeating as the single most common SSR bug you'll actually hit: rendering something non-deterministic (`Date.now()`, `Math.random()`, browser-locale-dependent formatting, anything that depends on *when* or *where* code runs) directly in output that's shared between server and client render paths. The fix is always some version of "make the first render deterministic and identical on both sides, then update it after mount, client-side only."

**Mistake 2: Assuming every page needs SSR** — SSR isn't free. It costs real server compute on every single request, and it adds complexity (server/client boundaries to think about, hydration to worry about). If a page's data doesn't need to be fresh per-request and doesn't need per-user personalization, SSG is simpler and cheaper. If a page is entirely behind a login and SEO is irrelevant, CSR is simpler still. Reach for SSR specifically when you need *both* fresh, per-request data *and* real HTML for SEO/fast-first-paint — not by default for every route.

**Mistake 3: Using browser-only APIs inside a Server Component** — this one trips up almost everyone the first time they touch the App Router:

```jsx
// This is a Server Component (no 'use client') — and this will error!
function WelcomeBanner() {
  const theme = localStorage.getItem('theme'); // ❌ localStorage doesn't exist on the server
  return <div className={theme}>Welcome!</div>;
}
```

`localStorage`, `window`, `document`, `navigator` — none of these exist in a Node.js server environment. There's no browser there. If a component needs any of them, it needs to be a Client Component (`'use client'` at the top), and ideally it should only touch those APIs inside `useEffect`, since even a Client Component's *first* render (during SSR/hydration) still happens on the server before it ever reaches the browser.

---

## 8. Interview Answer — Hydration in One Paragraph

"Hydration is the process by which React takes server-rendered static HTML and makes it interactive in the browser — it walks the existing DOM and attaches event listeners and component state to the nodes that are already there, instead of discarding and re-rendering everything from scratch. This only works safely if the HTML the server produced is identical to what the client would produce on its own first render; if they differ — because of non-deterministic values like `Date.now()` or `Math.random()`, or because a component reads browser-only state that doesn't exist during server rendering — React detects a hydration mismatch, logs a warning, and in many cases has to throw away and re-render the mismatched portion of the DOM, which causes visible flicker and defeats the performance benefit SSR was supposed to provide."

---

> **Memory hook:** "SSR hands you a printed newspaper you can read immediately — hydration is the moment someone quietly walks up and wires it into a live news ticker, without reprinting a single page. If the wiring doesn't match what's printed, sparks fly."

---

## 9. Hands-On Exercises

**Exercise 1 — Spot the Hydration Mismatch**

Given this component, explain exactly why it will produce a hydration mismatch warning, and rewrite it so the mismatch is fixed:

```jsx
function OrderSummary() {
  return <p>Order ID: {Math.floor(Math.random() * 1000000)}</p>;
}
```

**Exercise 2 — Server or Client?**

For each of the following components, decide whether it should be a Server Component or needs `'use client'`, and explain why:
1. A component that fetches a list of blog posts from a database and renders their titles.
2. A search input box that filters a list as the user types.
3. A footer that displays a copyright year computed once at build/deploy time (not per-request).
4. A "Like" button that toggles between filled/outline heart icons on click.

**Exercise 3 — CSR vs SSR vs SSG Triage**

For each scenario, pick CSR, SSR, or SSG and justify your choice in one or two sentences:
1. An internal admin tool only employees can access after logging in.
2. A company's public pricing page that changes maybe twice a year.
3. A flight search results page showing live seat availability and prices.

**Exercise 4 — Draw the Timeline**

By hand (or in a text file), draw the CSR timeline and the SSR timeline side by side, labeling the exact moment content becomes visible to the user in each case, and the exact moment the page becomes interactive in each case.

**Exercise 5 — Fix the Browser API Crash**

The following Server Component throws an error when rendered. Identify the problem and fix it using the Server/Client Component split described in Section 4.2:

```jsx
function ThemeToggle() {
  const savedTheme = localStorage.getItem('theme') ?? 'light';
  return <button>{savedTheme}</button>;
}
```

**Exercise 6 — Design a Component Tree**

You're building a documentation site page that: (a) fetches and renders Markdown content from a CMS, (b) has a "copy code" button next to each code block, and (c) has a live search box in the sidebar. Sketch the component tree, marking each component as Server or Client, and briefly explain your reasoning for each.

---

## 10. Interview Q&A

**Q1: What problem does Server-Side Rendering solve that plain client-side-rendered React doesn't?**

A: In a CSR app, the server sends an almost-empty HTML shell (just a `<div id="root">`), and the browser must download, parse, and execute the full JavaScript bundle before any content appears. This hurts perceived performance (a blank screen on slow connections/devices) and SEO (some crawlers don't execute JS well or reliably). SSR fixes both by having the server run the React component tree and send back real, populated HTML immediately.

---

**Q2: What is hydration, and why is it necessary even after the server has already sent full HTML?**

A: Server-rendered HTML is just markup — it has no event listeners, no component state, no interactivity. Hydration is the process where React's client-side JavaScript, once loaded, walks the existing DOM and attaches event handlers and internal state to it, "waking it up" into a fully interactive app, without discarding and rebuilding the DOM from scratch.

---

**Q3: What is a hydration mismatch, and what's a classic example that causes one?**

A: A hydration mismatch happens when the HTML the server rendered doesn't match what the client would render on its own first pass. React expects these to be identical so it can safely reuse the existing DOM. A classic cause is rendering `Date.now()` or `Math.random()` directly in render output — the value computed on the server (at request time) differs from the value computed again on the client (at hydration time), so the two don't match.

---

**Q4: How do you fix a hydration mismatch caused by a timestamp or random value?**

A: Don't compute the non-deterministic value directly during the shared render path. Instead, render a stable placeholder (like `null` or a fixed default) on both the server and the client's initial render, then update the value only after mount, client-side, typically inside a `useEffect`. This keeps the first render identical on both sides while still allowing the "live" value to appear shortly after.

---

**Q5: What are React Server Components, and how do they differ from traditional SSR?**

A: React Server Components are components that run exclusively on the server — their code and dependencies are never sent to the client at all, not even as part of the JS bundle. Traditional SSR still ships all component JavaScript to the client for hydration; Server Components go further by keeping certain components server-only permanently, meaning less JavaScript is downloaded by the browser overall, and server-only resources (databases, secrets) can be accessed directly and safely.

---

**Q6: How do you mark a component as a Client Component in the Next.js App Router, and why would you need to?**

A: Add the `'use client'` directive as the very first line of the file. You need this whenever a component requires browser-only capabilities: `useState`, `useEffect`, event handlers like `onClick`, or direct access to `window`/`localStorage`. Without the directive, components in the App Router are Server Components by default.

---

**Q7: Can a Server Component use `useState` or `onClick`? Why or why not?**

A: No. Server Components run only on the server, and things like `useState` (client-side memory that persists across re-renders in the browser) and `onClick` (a browser event) have no meaning in a server environment — there's no running "instance" of the component sitting in a browser tab to hold that state or receive that click. Any component needing these must be a Client Component.

---

**Q8: Why does Next.js push you toward keeping interactive components small and deep in the tree, rather than making entire pages Client Components?**

A: Every Client Component's code gets shipped to the browser as JavaScript. If you mark a large parent component `'use client'` just because one small child button needs `onClick`, you force the browser to download and run JavaScript for the entire subtree unnecessarily. Keeping Client Components small and isolated (e.g., just the button, not the whole page) minimizes the JavaScript payload sent to the browser.

---

**Q9: What's the difference between SSR and SSG?**

A: SSR renders the HTML on the server for every incoming request, so the data can be fresh each time. SSG renders the HTML once, at build time, and then serves that same static file for every subsequent visit until the next rebuild. SSR costs server compute per request but guarantees fresh data; SSG is essentially free per-request (often served from a CDN) but the content can go stale until you rebuild and redeploy.

---

**Q10: When would CSR actually be the right choice over SSR or SSG?**

A: When SEO doesn't matter (the content is behind a login, so search crawlers will never see it) and the content is highly interactive/personalized and changes constantly per user — like an analytics dashboard. Paying the server-rendering cost for content that's never publicly indexed and changes every second isn't worth it; plain client-side rendering is simpler and sufficient.

---

**Q11: Why can't you call `localStorage.getItem(...)` inside a Server Component?**

A: Server Components execute in a Node.js (or similar server) environment during rendering — there is no browser, so `localStorage`, `window`, `document`, and similar browser globals simply don't exist there. Attempting to use them throws a runtime error. Any code that needs those APIs must live in a Client Component, and ideally only run inside `useEffect` so it executes after the component has actually mounted in the browser.

---

**Q12: What does file-based routing mean in Next.js, and how is it different from the routing you set up manually with React Router?**

A: Instead of writing a routes configuration file that maps URL paths to components, Next.js infers routes directly from your folder structure inside the `app` directory — a folder named `blog` with a `page.js` inside it automatically becomes the `/blog` route, and a folder named `[slug]` creates a dynamic route segment. There's no separate routing configuration to keep in sync with your file structure.

---

**Q13: A teammate wants to mark every single page in the app as a Server Component "to be safe," including pages that are entirely interactive forms. Is that a good idea?**

A: Not necessarily. Server Components can't use `useState`, `useEffect`, or event handlers at all — so a genuinely interactive page (a multi-field form with live validation, for instance) needs to be a Client Component, or at minimum have its interactive parts extracted into Client Components. Defaulting everything to Server Components only makes sense for content that's actually static or server-fetched; forcing interactive UI into a Server Component simply won't compile/run correctly.

---

**Q14: Why is `renderToString` (or its streaming equivalent) relevant to understanding what Next.js does under the hood?**

A: These are the underlying React APIs that actually turn a component tree into an HTML string on the server — they're the mechanism Next.js (and any custom SSR setup) uses internally to produce the HTML that gets sent to the browser. Understanding that this is "just React rendering to a string on the server" demystifies SSR: Next.js isn't doing something exotic, it's automating the server setup, routing, data-fetching conventions, and hydration wiring around this core capability so you don't have to build that plumbing yourself.

---

**Q15: What's a good one-line way to remember the difference between CSR, SSR, and SSG?**

A: CSR builds the page in the browser, every time, after the JS runs. SSR builds the page on the server, fresh, on every request. SSG builds the page on the server, once, at build time, and reuses that same HTML for every visitor until the next deploy.
