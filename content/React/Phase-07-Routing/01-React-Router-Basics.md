# 01 — React Router Basics

> "A single-page app only ever loads one page from the server. Everything after that — every 'page' the user thinks they're visiting — is an illusion your JavaScript is maintaining."

---

## Table of Contents

1. [The Problem: One Page Pretending to Be Many](#1-the-problem-one-page-pretending-to-be-many)
2. [The Theater Analogy](#2-the-theater-analogy)
3. [What React Router Actually Is](#3-what-react-router-actually-is)
4. [Internal Working — How Navigation Happens Without a Reload](#4-internal-working--how-navigation-happens-without-a-reload)
5. [Basic Setup — BrowserRouter, Routes, Route](#5-basic-setup--browserrouter-routes-route)
6. [Link vs a Plain `<a>` Tag](#6-link-vs-a-plain-a-tag)
7. [useNavigate — Programmatic Navigation](#7-usenavigate--programmatic-navigation)
8. [Catch-All / 404 Routes](#8-catch-all--404-routes)
9. [Absolute vs Relative Paths](#9-absolute-vs-relative-paths)
10. [Common Mistakes](#10-common-mistakes)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The Problem: One Page Pretending to Be Many

Let's start with something that trips up almost everyone the first time they build a React app: **a React app is, technically, one HTML page.**

One. Not a homepage, a login page, and a product page as three separate files sitting on a server. Just one — usually called `index.html` — that the server sends down exactly once.

So if that's true, how does this work?

```
https://myshop.com/               → Homepage
https://myshop.com/products/42    → Product page
https://myshop.com/login          → Login page
https://myshop.com/cart           → Cart page
```

Four different URLs. Four different-looking screens. But behind the scenes, all four requests could be served the *exact same* `index.html` file, with the *exact same* JavaScript bundle.

Here's the thing users expect from all four of those URLs, regardless of how the app is built:

```
1. Each one is bookmarkable — I should be able to save
   https://myshop.com/products/42 and come back to it directly.

2. Each one is shareable — I should be able to paste that URL
   into a chat and have my friend land on the same product page.

3. The browser's Back and Forward buttons should work — going
   "back" from the cart should return me to the product page.

4. Refreshing the page shouldn't dump me back at the homepage.
```

Traditional multi-page websites get all four of these for free — every URL really does correspond to a different file (or server route) that returns different HTML. A single-page application gets none of them for free. If you write a React app with zero routing, you have exactly one URL, and it never changes no matter what the user clicks.

**This is the actual problem React Router solves:** faking the experience of a multi-page website — different URLs, different visible content, working Back/Forward, bookmarkable/shareable links — while still only ever loading one real page from the server.

---

## 2. The Theater Analogy

Here's a mental picture that makes the rest of this file click into place.

**Old-school multi-page website — building a new theater for every scene.**

Imagine a play where, for every scene change, the audience has to get up, leave the building, and walk into a completely different theater that's been built just for that scene. That's what a full page navigation is: the browser throws away everything currently loaded, sends a fresh request to the server, waits, and rebuilds the entire page from scratch — HTML, CSS, JS, all of it, all over again.

It works. But it's slow, and everything about the previous "theater" is gone. Any state you had — say, "the cart drawer was open," or "the video was playing" — is gone the instant you leave.

**Single-page app with React Router — one stage, instantly changing backdrops.**

Now imagine a single stage. The audience never leaves their seats. Between scenes, the lights dim for a split second, the crew swaps the backdrop, and the lights come back up on a totally different-looking scene — new backdrop, new furniture, new characters. The building itself, the audience, the seats — none of that was torn down and rebuilt. Only the *backdrop* changed.

That's React Router. The "theater" (the browser tab, the loaded JavaScript, any state you're holding onto like a logged-in session) never gets torn down. Navigating to a new "page" just swaps out which components are currently rendered — instantly, with no trip back to the server.

---

## 3. What React Router Actually Is

Now the plain definition, which should make much more sense after that analogy:

> **React Router** is a library that lets you associate URL paths with React components, and re-renders the matching component whenever the URL changes — all without asking the server for a new page.

It doesn't change how your server works at all. Your server still only sends down one `index.html` (plus your JS bundle). React Router's entire job happens **in the browser, after that JS has loaded**: watching the URL bar, and deciding what to show based on what it currently says.

---

## 4. Internal Working — How Navigation Happens Without a Reload

This is the single most important concept in this whole file. If you only remember one diagram from this lesson, make it this one.

The trick React Router relies on is a browser feature called the **History API**, specifically two methods: `pushState` and `replaceState`. These have existed in browsers for a long time, long before React Router — React Router is just a very convenient wrapper around them.

Here's the key fact about `pushState`: **it can change the URL shown in the address bar without the browser making a new request to the server.** The browser just... trusts you, and updates the bar. No network round trip. No page reload. No losing any JavaScript state.

Let's trace through an actual click, step by step:

```
┌─────────────────────────────────────────────────────────────────────┐
│  User clicks a <Link to="/products/42"> on the homepage             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Link's onClick handler fires and calls event.preventDefault()      │
│  → this STOPS the browser's default "go fetch a new page" behavior  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  React Router calls history.pushState() under the hood              │
│  → the URL bar now reads https://myshop.com/products/42             │
│  → NO request was sent to the server for this                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  React Router is listening for URL changes (it subscribes to        │
│  this internally) and notices the path is now "/products/42"        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  It matches "/products/42" against your list of <Route> definitions │
│  → finds the Route with path="/products/:id"                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  React re-renders — swaps out <HomePage /> for <ProductPage />      │
│  → this is a normal React re-render, same as any state update       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Result: URL bar shows /products/42, screen shows the product page, │
│  and the ENTIRE thing happened without a single server request.     │
└─────────────────────────────────────────────────────────────────────┘
```

Take a moment with that middle step, because it's the whole trick: `pushState` is a browser-native way to *lie* to the address bar. You're telling the browser "pretend the user is at this URL now" — and the browser goes along with it, no questions asked, no network activity.

The Back and Forward buttons still work, too, because `pushState` also adds an entry to the browser's session history stack — the exact same stack that Back/Forward navigate through. React Router listens for the `popstate` event (fired when the user clicks Back/Forward) and re-matches routes the same way.

And what happens if the user hits refresh, or types `myshop.com/products/42` directly into the address bar and hits Enter? That *does* go all the way to the server — because a manual page load always does. This is why, in a real deployed app, your server (or hosting platform) needs to be configured to respond to *any* path with the same `index.html`, and let React Router figure out the rest client-side. If your server doesn't do that, refreshing on `/products/42` will 404, because there's genuinely no file at that path on the server — only your client-side router knows what to do with it.

---

## 5. Basic Setup — BrowserRouter, Routes, Route

With the theory out of the way, here's what this actually looks like in code. First, install it:

```bash
npm install react-router-dom
```

Three building blocks, used together:

```jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage";
import ProductPage from "./pages/ProductPage";
import LoginPage from "./pages/LoginPage";
import CartPage from "./pages/CartPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/products/:id" element={<ProductPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cart" element={<CartPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

Let's break down each piece:

- **`<BrowserRouter>`** — sits once, near the top of your app. It's the component that actually hooks into the History API and starts listening for URL changes. Nothing below it works without this wrapping it.
- **`<Routes>`** — a container that looks at the current URL and picks exactly one matching `<Route>` to render (the *most specific* match, if more than one could technically match).
- **`<Route path="..." element={...} />`** — one URL pattern paired with one component. Note it's `element={<ProductPage />}` — you pass an actual JSX element, not the bare component reference. This is the v6+ API; older tutorials you might stumble across online use `component={ProductPage}`, which is the outdated v5 syntax.

Notice the `:id` in `/products/:id` — that's a **route parameter**. It matches anything in that position (`/products/42`, `/products/abc`, whatever), and inside `ProductPage`, you can read it back out with the `useParams` hook:

```jsx
import { useParams } from "react-router-dom";

function ProductPage() {
  const { id } = useParams();
  return <h1>Showing product #{id}</h1>;
}
```

Visit `/products/42` and `id` will be the string `"42"`. That's it — that's the whole basic wiring.

---

## 6. Link vs a Plain `<a>` Tag

Here's the trap that catches nearly every React beginner at least once, and it connects directly back to the internal-working section above.

You already know that HTML has a built-in way to link to another page:

```html
<a href="/products/42">View product</a>
```

So... why doesn't React Router just let you use that?

**Because a plain `<a href>` does exactly what it's always done: it tells the browser to throw away the current page and fetch a brand new one from the server.** That's not a bug in your app — that's `<a>` doing precisely its job, the same job it's had since the web began. But it's the *opposite* of what you want in an SPA. It defeats the entire point:

```
Click <a href="/products/42">
        │
        ▼
Browser discards current page entirely
        │
        ▼
Sends a full HTTP request to the server for /products/42
        │
        ▼
Server would need to actually have something at that path
(and if it's a typical SPA server, it just serves the same
index.html again — but only AFTER a full round trip)
        │
        ▼
Entire JS bundle re-downloads and re-initializes from scratch
        │
        ▼
ALL React state is wiped out — open modals close, form input
you were typing is gone, your Redux/Context state resets, etc.
```

That last line is the painful part. Say your app has a shopping cart held in React state (or Context, or Redux) with three items in it. The user clicks an `<a href="/products/42">` link. Boom — full reload, cart state gone, because the entire JavaScript app just restarted from zero.

**This is exactly why `<Link>` exists.** `<Link>` renders an `<a>` tag under the hood (so it still looks like a link, still shows the URL on hover, still works with "open in new tab") — but it attaches a click handler that calls `event.preventDefault()` to stop the browser's default full-navigation behavior, and instead calls `pushState` itself, exactly as traced through in Section 4.

```jsx
import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/products/42">Featured Product</Link>
      <Link to="/cart">Cart</Link>
    </nav>
  );
}
```

Note the prop is `to`, not `href` — a small but deliberate reminder that this isn't a plain anchor tag doing the plain anchor tag thing.

### Compare: `<a href>` vs `<Link>`

| | `<a href="...">` | `<Link to="...">` |
|---|---|---|
| What happens on click | Full page reload — browser requests a fresh page from the server | `preventDefault()` + `pushState()` — URL changes, no server request |
| React app state | Wiped out completely (JS re-downloads, re-runs from scratch) | Fully preserved (cart, form input, Context, everything) |
| Speed | Slower — network round trip + full re-parse of JS | Instant — just a React re-render |
| Works for external sites (e.g. `google.com`) | Yes — and this is correct, it *should* be a real navigation | No — `<Link>` only understands routes registered inside your own `<Routes>` |
| Shows up in browser history (Back/Forward) | Yes | Yes |
| Right tool for... | Linking to a completely different website/domain, or a non-SPA download link | Linking between "pages" within your own React app |

That last row matters: `<Link>` is not *always* correct either. If you're linking out to `https://github.com/facebook/react`, a plain `<a href="https://github.com/facebook/react">` is exactly right — you genuinely want a real, full navigation to a different site. `<Link>` is purpose-built for *internal* navigation only.

---

## 7. useNavigate — Programmatic Navigation

`<Link>` covers navigation the user triggers by clicking something. But plenty of navigation isn't click-driven — it's triggered by *code*. The classic example: a user submits a login form, the request succeeds, and you want to redirect them to `/dashboard` — there's no link to click, you just decide, in your `onSubmit` handler, that it's time to move.

That's what the `useNavigate` hook is for:

```jsx
import { useNavigate } from "react-router-dom";

function LoginForm() {
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();

    const success = await loginUser(/* ...credentials */);

    if (success) {
      navigate("/dashboard");
    } else {
      alert("Invalid credentials");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* email/password inputs here */}
      <button type="submit">Log In</button>
    </form>
  );
}
```

`useNavigate()` gives you back a function — call it `navigate` (the name is your choice, it's just a variable). Calling `navigate("/dashboard")` does the exact same underlying thing as clicking a `<Link to="/dashboard">` would: `pushState`, URL change, route re-match, re-render. No page reload here either.

A couple of extra tricks worth knowing:

```jsx
// Go back one step in history — same as clicking the browser's Back button
navigate(-1);

// Navigate but REPLACE the current history entry instead of adding a new one
// (useful after login, so hitting "Back" doesn't return the user to the login form)
navigate("/dashboard", { replace: true });
```

That `replace: true` option matters more than it looks. Without it, after logging in, the history stack looks like: `[..., /login, /dashboard]`. Hit Back, and you land right back on the login page — often showing a stale form or triggering a "session expired" flash. With `replace: true`, `/login` is swapped out for `/dashboard` in the stack instead of sitting underneath it, so Back skips over the login page entirely.

---

## 8. Catch-All / 404 Routes

What happens if a user navigates (or types in the address bar) a path that matches none of your `<Route>`s — say, `/this-page-does-not-exist`?

By default: nothing renders. `<Routes>` looks through its children, finds no match, and renders... nothing. Not an error, not a helpful message — just a blank screen. That's a bad experience, and it's an easy one to prevent.

The fix is a **catch-all route**, using `path="*"`:

```jsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/products/:id" element={<ProductPage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/cart" element={<CartPage />} />
  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

`*` matches literally anything that didn't match one of the routes above it. Since `<Routes>` checks routes in a "most specific match wins" way (not strictly top-to-bottom), it's still good practice to keep your catch-all at the bottom of the list for readability — it reads naturally as "and anything else, show this."

```jsx
function NotFoundPage() {
  return (
    <div>
      <h1>404 — Page Not Found</h1>
      <Link to="/">Go back home</Link>
    </div>
  );
}
```

Simple, but it turns a silent blank screen into a helpful dead end with a way back out.

---

## 9. Absolute vs Relative Paths

One more spot where people get tangled up: paths inside nested routes.

An **absolute path** starts with `/` and is always measured from the root of your site, no matter where it's written in your code:

```jsx
<Link to="/cart">Cart</Link>
```

This always means "the cart page at the site root" — full stop, regardless of what page you're currently on.

A **relative path** does *not* start with `/`, and instead builds on top of whatever the current route already is:

```jsx
// Assume we're currently rendering something nested under "/dashboard"
<Link to="settings">Settings</Link>
```

If the current URL is `/dashboard`, this relative link resolves to `/dashboard/settings`. But if it's used somewhere nested deeper, like `/dashboard/team`, that exact same `<Link to="settings">` would resolve to `/dashboard/team/settings` instead — because "relative" means "relative to wherever this component happens to currently be rendered," which can shift depending on your route nesting.

The practical guideline: **when in doubt, use absolute paths** (`/cart`, `/dashboard`, `/login`). They behave the same no matter where the `<Link>` lives in your component tree, which makes your navigation far easier to reason about. Reach for relative paths deliberately — mainly inside nested routing setups where a component should link to a sibling route without caring or knowing what the parent path happens to be.

---

## 10. Common Mistakes

**Mistake 1 — using `<a href>` for internal navigation.**

This is the single most common one, and it's covered in full in Section 6, but it's worth repeating as a checklist item: if you're linking to something inside your own app, it should almost always be `<Link to="...">`, never `<a href="...">`. The symptom, if you get it wrong, is usually reported as "my app feels laggy" or "my cart keeps getting cleared randomly" — when the real cause is a stray `<a href>` silently forcing full page reloads.

**Mistake 2 — forgetting a catch-all route.**

Without a `path="*"` route, an unmatched URL renders a blank screen with zero explanation. Users assume the site is broken, not that they mistyped a URL. Always add one (see Section 8).

**Mistake 3 — confusing absolute and relative paths.**

A `<Link to="settings">` (no leading slash) behaves completely differently depending on where in your route tree it's rendered. If a link seems to go to the "wrong" nested place, this is usually why. Default to absolute paths (`/settings`) unless you have a specific reason to use a relative one.

**Mistake 4 — putting `<Route>` components anywhere other than inside `<Routes>`.**

`<Route>` doesn't do anything meaningful on its own — it's a plain data descriptor that only makes sense as a direct child of `<Routes>`, which is the component that actually reads all the `<Route>` children and decides which one to render.

**Mistake 5 — forgetting `<BrowserRouter>` at the top entirely.**

Without it, none of `useNavigate`, `<Link>`, `useParams`, or `<Routes>` have anything to hook into, and you'll get a runtime error telling you these hooks/components must be used inside a Router context.

---

## 11. Hands-On Exercises

**Exercise 1 — Basic Route Setup**

Build a small app with four pages: Home (`/`), About (`/about`), Contact (`/contact`), and a 404 catch-all. Wire up `BrowserRouter`, `Routes`, and `Route`, and add a nav bar using `<Link>` for all three real pages.

**Exercise 2 — Route Parameters**

Add a route `/users/:username` that renders a `UserProfile` component. Use `useParams` to read `username` out and display "Now viewing: {username}" on the page. Test it by visiting `/users/alice` and `/users/bob` directly in the address bar.

**Exercise 3 — The `<a>` vs `<Link>` Experiment**

Build a page with some piece of visible state — a counter that increments on button click is enough. Add one navigation link using `<Link to="/other-page">` and a second, separate link using a plain `<a href="/other-page">`. Click each one, then navigate back, and observe what happened to the counter in each case. Write one sentence explaining, in your own words, why the two behaved differently.

**Exercise 4 — Programmatic Navigation After a Form**

Build a fake login form (any username/password, no real backend needed — just simulate a successful login). On submit, use `useNavigate` to redirect to `/dashboard`. Then add the `{ replace: true }` option and verify (by clicking the browser's Back button after logging in) that you no longer land back on the login form.

**Exercise 5 — 404 Handling**

Take the app from Exercise 1. Temporarily delete the catch-all `path="*"` route, visit a URL that doesn't exist, and observe the blank screen. Then add the catch-all route back with a proper `NotFoundPage` component that includes a `<Link>` back to home, and confirm it now works.

**Exercise 6 — Absolute vs Relative Paths**

Create two components nested at different depths — say, one rendered under `/dashboard` and one rendered under `/dashboard/team`. Inside both, add a `<Link to="settings">` (relative, no leading slash) and observe where each one actually navigates to. Then replace both with `<Link to="/dashboard/settings">` (absolute) and confirm both now go to the same place regardless of nesting depth.

---

## 12. Interview Q&A

**Q1: What problem does React Router actually solve?**

A: A single-page application loads exactly one HTML page from the server. But users expect distinct, bookmarkable, shareable URLs for different views, along with working browser Back/Forward buttons — the experience of a traditional multi-page site. React Router provides client-side routing: it maps URL paths to React components and swaps the rendered component tree when the URL changes, without any additional requests to the server.

---

**Q2: Explain, step by step, how client-side routing changes the URL without a full page reload.**

A: When a user clicks a `<Link>`, its click handler calls `event.preventDefault()` to stop the browser's normal full-navigation behavior. React Router then calls the browser's History API method `pushState()`, which updates the URL shown in the address bar and adds an entry to the session history stack — without triggering any network request to the server. React Router is subscribed to these URL changes, matches the new path against the registered `<Route>` definitions, and re-renders the matching component. The whole cycle — from click to new screen — happens entirely in the browser via a normal React re-render.

---

**Q3: Why shouldn't you use a plain `<a href="/some-path">` for internal navigation in a React Router app?**

A: A plain `<a href>` performs the browser's default full-page navigation: it discards the current page, sends a fresh HTTP request to the server, and re-downloads and re-initializes the entire JavaScript bundle. Any in-memory React state — cart contents, open modals, form input, Context/Redux state — is wiped out. `<Link>` renders an `<a>` tag visually but intercepts the click with `preventDefault()` and performs the URL change via the History API instead, so the app never reloads and all state survives.

---

**Q4: Is `<a href>` ever the correct choice inside a React Router app?**

A: Yes — for links to genuinely external destinations, like a different domain or website. In that case a full navigation is exactly what should happen, since the destination isn't part of your client-side routed app at all. `<Link>` is only meaningful for internal routes registered in your own `<Routes>`.

---

**Q5: What are `BrowserRouter`, `Routes`, and `Route`, and how do they relate to each other?**

A: `BrowserRouter` wraps the app once near the top and hooks into the browser's History API, enabling everything else to function. `Routes` is a container that inspects the current URL and picks the single best-matching child route to render. `Route` pairs one URL `path` with one `element` (a JSX element, not a bare component reference, in React Router v6+) — it's a declarative description of "if the URL looks like this, render that."

---

**Q6: How do you read a dynamic segment out of the URL, like the `42` in `/products/42`?**

A: Define the route with a parameter placeholder, e.g. `<Route path="/products/:id" element={<ProductPage />} />`, then inside `ProductPage`, call the `useParams()` hook, which returns an object whose keys match the placeholder names — `const { id } = useParams();` gives you `id` as a string.

---

**Q7: What happens if no `<Route>` matches the current URL, and how do you handle it?**

A: By default, `<Routes>` renders nothing — a blank screen, with no error and no explanation to the user. The fix is to add a catch-all route with `path="*"` (typically placed last, rendering a `NotFoundPage` component with a link back home), so unmatched URLs show a helpful 404 experience instead of an empty page.

---

**Q8: What is `useNavigate` used for, and how does it differ from `<Link>`?**

A: `useNavigate` returns a function for triggering navigation *programmatically* from inside event handlers or effects — for example, redirecting to `/dashboard` after a successful login form submission, where there's no link for the user to click. `<Link>` handles navigation the user initiates by clicking; `useNavigate` handles navigation your code decides to perform. Both ultimately go through the same underlying History API mechanism and avoid a full page reload.

---

**Q9: What does `navigate("/dashboard", { replace: true })` do differently from `navigate("/dashboard")`?**

A: A plain call pushes a new entry onto the browser's history stack, so the previous page remains reachable via the Back button. `{ replace: true }` replaces the current history entry instead of adding a new one — useful after a login redirect, so that clicking Back doesn't return the user to the login page/form that's no longer relevant.

---

**Q10: What's the difference between an absolute path and a relative path in a `<Link>`?**

A: An absolute path starts with `/` (e.g. `/cart`) and always resolves the same way regardless of where the `<Link>` is rendered in the component tree. A relative path has no leading slash (e.g. `settings`) and resolves relative to the current route's location, meaning the exact same `<Link to="settings">` can point to different destinations depending on how deeply nested the component currently is. Absolute paths are the safer default; relative paths are used deliberately in nested routing setups.

---

**Q11: Why does refreshing the browser on a deep route like `/products/42` sometimes produce a 404 from the server, even though the same route works fine when navigated to via `<Link>` inside the app?**

A: Clicking a `<Link>` never leaves the already-loaded page — React Router handles the URL change entirely client-side. But a manual refresh (or typing the URL directly and hitting Enter) is a real, full request to the server for that exact path. If the server has no file or route configured at `/products/42`, it returns a 404 — because as far as the server is concerned, only the client-side JavaScript knows what to do with that path. This is fixed by configuring the server/hosting platform to serve `index.html` for any unmatched path, letting React Router take over from there.

---

**Q12: What's wrong with writing `<Route component={ProductPage} />` in a modern React Router (v6+) app?**

A: That's the React Router v5 API. In v6+, `Route` takes an `element` prop with an actual JSX element, not a `component` prop with a bare component reference: `<Route path="/products/:id" element={<ProductPage />} />`. Mixing up the two APIs is a common source of confusion when following outdated tutorials.

---

**Q13: In the theater analogy for React Router, what does the "stage" represent, and what does the "backdrop" represent?**

A: The stage represents the browser tab and the already-loaded JavaScript application — it never gets torn down during client-side navigation. The backdrop represents the currently rendered component tree (the "page" the user sees) — this is what changes, instantly, when the route changes. The audience never has to leave their seats (no full reload) even though what's in front of them completely changes.

---

**Q14: Why does using `<a href>` instead of `<Link>` specifically break state like a shopping cart held in Context or Redux?**

A: Context and Redux state (like any React state) lives entirely in memory, inside the running JavaScript process. A full page reload — which is what a plain `<a href>` triggers — tears down that entire JavaScript process and starts a brand-new one from scratch when the new page loads. There is no "memory" carried over between the old process and the new one, so any state that wasn't persisted somewhere durable (like localStorage or a server) is simply gone.

---

**Q15: Besides `pushState`, what other History API concept does React Router rely on to make the browser's Back/Forward buttons work correctly?**

A: The `popstate` event. When the user clicks Back or Forward, the browser fires `popstate` and updates the URL to the corresponding history entry — again, without a network request. React Router listens for this event the same way it listens for its own `pushState` calls, re-matches the new URL against the registered routes, and re-renders accordingly, keeping Back/Forward navigation consistent with clicking `<Link>`s.

> **Memory hook:** "A `<Link>` politely asks the browser to *pretend* — a plain `<a>` actually walks out the door and starts over."
