# 02 — Nested & Dynamic Routes

> "A layout isn't a page. A page is just whatever gets slotted into the layout today."

---

## Table of Contents

1. [The Problem: Shared Layout and Data-Driven URLs](#1-the-problem-shared-layout-and-data-driven-urls)
2. [Dynamic Route Params](#2-dynamic-route-params)
3. [Nested Routes and the Outlet](#3-nested-routes-and-the-outlet)
4. [Index Routes](#4-index-routes)
5. [Query Parameters vs Route Params](#5-query-parameters-vs-route-params)
6. [Protected / Private Routes](#6-protected--private-routes)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Shared Layout and Data-Driven URLs

Let's say you've already got basic routing working. You've got a `<Route>` for `/`, one for `/about`, one for `/contact`. Each one renders a full page component. Life is good.

Then your product manager asks for two very normal things, and suddenly your flat routing setup starts creaking.

**Request 1 — "Every page needs the same sidebar and header."**

Sure, easy — just import `<Sidebar />` and `<Header />` into every single page component and wrap your content with them.

```jsx
function Dashboard() {
  return (
    <>
      <Header />
      <Sidebar />
      <div>Dashboard content</div>
    </>
  );
}

function Settings() {
  return (
    <>
      <Header />
      <Sidebar />
      <div>Settings content</div>
    </>
  );
}
```

Except now watch what happens when you navigate from `/dashboard` to `/settings`. React Router swaps out the whole matched route element. That means `<Header />` and `<Sidebar />` get **unmounted and remounted** on every single navigation — even though visually they never actually changed. If your sidebar was holding onto scroll position, a collapsed/expanded state, or was running its own `useEffect` on mount to fetch nav data, all of that resets. Every. Single. Click.

And you're copy-pasting `<Header />` and `<Sidebar />` into every page component. That's not a routing problem anymore — that's just repetition.

**Request 2 — "Add a product details page."**

Simple enough:

```jsx
<Route path="/product-1" element={<Product1 />} />
<Route path="/product-2" element={<Product2 />} />
```

Except your product catalog has 40,000 products. You cannot write 40,000 `<Route>` lines. What you actually want is **one** route that says "anything shaped like `/products/<some-id>` goes to the same `Product` component, and that component figures out *which* product from the URL itself."

Both of these problems — persistent shared layout, and one route template handling infinite real data — are exactly what this lesson solves. Nested routes fix the first. Dynamic route params fix the second. And once you have both, you'll also need to know how to protect certain routes behind login, which we'll cover too.

---

## 2. Dynamic Route Params

### The analogy

Think of a dynamic route like a mail slot with a label that says "Apartment #___." The building (the route) is fixed — `/products/`. The blank is filled in per-visitor — `123`, `456`, whatever. The mail carrier (React Router) doesn't need a separate slot carved out for every apartment number that could ever exist. One slot, a variable label.

### The basic definition

A dynamic route param is a segment of a URL path that starts with a colon in your route definition, and matches *any* value at that position:

```jsx
<Route path="/products/:productId" element={<ProductPage />} />
```

That `:productId` matches `/products/123`, `/products/abc`, `/products/anything-at-all`. Whatever value actually shows up there gets handed to your component through the `useParams()` hook.

### A concrete example

```jsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

function ProductPage() {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "not-found"

  useEffect(() => {
    setStatus("loading");
    fetch(`/api/products/${productId}`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((data) => {
        setProduct(data);
        setStatus("ready");
      })
      .catch(() => setStatus("not-found"));
  }, [productId]);

  if (status === "loading") return <p>Loading product...</p>;
  if (status === "not-found") return <p>No product matches "{productId}".</p>;

  return (
    <div>
      <h1>{product.name}</h1>
      <p>${product.price}</p>
    </div>
  );
}
```

Notice the dependency array: `[productId]`. This matters more than it looks. If you navigate from `/products/1` to `/products/2`, React Router does **not** remount `ProductPage` — it's the same component instance, just re-rendered with a new `productId`. If you forgot that dependency, your `useEffect` would only run once, on the very first product, and never re-fetch when the user clicks through to a different product. The URL would change, the param would change, but the screen would keep showing product #1 forever.

You can have more than one dynamic segment too:

```jsx
<Route path="/users/:userId/orders/:orderId" element={<OrderDetail />} />

// useParams() returns { userId: "42", orderId: "987" }
```

**Interview answer:** "A dynamic route param is a placeholder segment in a route's path — declared with a colon, like `:productId` — that matches any value at that position in the URL. `useParams()` reads the actual matched values back out as a plain object inside the component, which is how one route definition can serve an unlimited number of real records instead of needing one hardcoded route per record."

> **Memory hook:** "One mail slot labeled `Apt #___` serves every apartment — you don't carve a new slot for every tenant."

---

## 3. Nested Routes and the Outlet

This is the single most important idea in this file, so let's take it slow.

### The analogy

A nested route layout is a **picture frame** with an interchangeable picture inside it. The frame — the wooden border, the hook on the wall — never moves. You just swap out which picture sits inside it. The frame is your layout (header, sidebar, footer). The picture is whatever page content matches the current URL. `<Outlet />` is the empty rectangle in the middle of the frame where the picture goes.

### The basic definition

A nested route is a `<Route>` rendered *inside* another `<Route>`. The parent route renders a layout component, and somewhere inside that layout component, it places an `<Outlet />` element. Whichever child route currently matches the URL gets rendered exactly where that `<Outlet />` sits. The parent itself does not remount when you navigate between children — only the `<Outlet />`'s contents change.

### Setting it up

```jsx
import { Routes, Route, Outlet, Link } from "react-router-dom";

function DashboardLayout() {
  return (
    <div className="dashboard">
      <Header />
      <Sidebar />
      <main>
        <Outlet /> {/* <-- child route renders HERE */}
      </main>
    </div>
  );
}

function Overview() {
  return <h2>Overview</h2>;
}

function Billing() {
  return <h2>Billing</h2>;
}

function App() {
  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route path="overview" element={<Overview />} />
        <Route path="billing" element={<Billing />} />
      </Route>
    </Routes>
  );
}
```

Notice the child routes' `path` values do **not** start with `/dashboard` again — they're relative to the parent. `path="overview"` under a parent of `/dashboard` means the full matched URL is `/dashboard/overview`.

### What's happening internally

Here's the route tree this creates, and how it behaves as the URL changes:

```text
Route tree:

  /dashboard  ───────────►  DashboardLayout
     │                      renders: <Header /><Sidebar /><main><Outlet/></main>
     │
     ├── overview  ───────► Overview     (renders INTO the Outlet slot)
     └── billing   ───────► Billing      (renders INTO the Outlet slot)


URL: /dashboard/overview                URL: /dashboard/billing
┌─────────────────────────┐            ┌─────────────────────────┐
│ Header (mounted once)   │            │ Header (still mounted)  │
│ Sidebar (mounted once)  │            │ Sidebar (still mounted) │
│ ┌─────────────────────┐ │            │ ┌─────────────────────┐ │
│ │ <Outlet/> renders:  │ │  navigate  │ │ <Outlet/> renders:  │ │
│ │   <Overview/>       │ │  ───────►  │ │   <Billing/>        │ │
│ └─────────────────────┘ │            │ └─────────────────────┘ │
└─────────────────────────┘            └─────────────────────────┘
```

The crucial part: `DashboardLayout` itself — and everything inside it *except* the `<Outlet />` — is rendered exactly once and stays mounted across the navigation. `Header` and `Sidebar` do not re-run their effects, do not lose local state, do not flicker. Only the outlet's content swaps out. This is precisely the problem from Section 1 — solved.

Under the hood, `<Outlet />` works a lot like `props.children` in plain React — it's a placeholder that React Router fills in with whatever the currently-matched child route's `element` is. The difference is that with `<Outlet />`, React Router decides what goes there based on the URL, not based on what you explicitly passed as a child prop.

### Nesting can go more than one level deep

```jsx
<Route path="/dashboard" element={<DashboardLayout />}>
  <Route path="settings" element={<SettingsLayout />}>
    <Route path="profile" element={<ProfileForm />} />
    <Route path="security" element={<SecurityForm />} />
  </Route>
</Route>
```

Here `SettingsLayout` itself needs its *own* `<Outlet />` to render `ProfileForm` or `SecurityForm`. Each layout level manages its own slot. `/dashboard/settings/profile` passes through `DashboardLayout`'s outlet, into `SettingsLayout`, into *its* outlet, and finally renders `ProfileForm`.

### Why this actually matters for performance and state

Go back to the sidebar problem from Section 1. Say `Sidebar` fetches the list of nav links from an API on mount:

```jsx
function Sidebar() {
  const [links, setLinks] = useState([]);

  useEffect(() => {
    fetch("/api/nav-links").then((r) => r.json()).then(setLinks);
  }, []);

  return <nav>{links.map((l) => <Link key={l.id} to={l.to}>{l.label}</Link>)}</nav>;
}
```

Without nesting, that `fetch("/api/nav-links")` call fires on *every single page navigation*, because `Sidebar` gets remounted along with the rest of the page. With nesting, `Sidebar` lives inside the parent layout, mounts exactly once, and stays mounted for as long as the user stays anywhere under `/dashboard/*`. One fetch, not one-per-click. That's the real payoff of the Outlet mechanism — it's not just tidier code, it changes how often things actually run.

**Interview answer:** "Nested routes let a parent route render a persistent layout component containing an `<Outlet />`. React Router matches the deepest applicable child route and renders that child's element into the `Outlet` slot, while the parent layout itself is reconciled as the same element across navigations and therefore stays mounted. This avoids remounting shared chrome like headers, sidebars, or nav bars on every route change, which both saves re-running mount effects and preserves local UI state in that shared chrome."

> **Memory hook:** "The picture frame stays on the wall — only the picture inside it changes."

---

## 4. Index Routes

Say a user goes to `/dashboard` — not `/dashboard/overview`, just the bare parent path. What renders inside the `<Outlet />`? By default: nothing. The parent layout shows up, but the outlet is empty, because no child route matched.

That's rarely what you want. Usually you want *some* default content to show. That's what an **index route** is for — the child route shown when the parent's path is matched exactly, with no further segment.

```jsx
import { Routes, Route, Outlet } from "react-router-dom";

<Routes>
  <Route path="/dashboard" element={<DashboardLayout />}>
    <Route index element={<Overview />} />       {/* default child */}
    <Route path="billing" element={<Billing />} />
  </Route>
</Routes>
```

Notice: an index route has **no `path` prop** — just `index`. It matches exactly when the parent path matches and nothing else is appended. So `/dashboard` now renders `DashboardLayout` with `Overview` sitting in the outlet, and `/dashboard/billing` renders `DashboardLayout` with `Billing` in the outlet.

Think of the index route as "the picture that's already in the frame before you've chosen a different one to hang."

A quick gotcha: an index route cannot have its own children. It represents a leaf — the default content shown at that exact level — so if you find yourself wanting to nest something under an index route, that's a sign it should really be a named child route (`path="overview"`) instead, possibly with its own index route one level further down.

> **Memory hook:** "The index route is the picture already hanging in the frame before you swap in a new one."

---

## 5. Query Parameters vs Route Params

You now have two different-looking ways to get dynamic information out of a URL: `useParams()` and `useSearchParams()`. When do you reach for which?

### The rule of thumb

**Route params identify a specific resource.** They answer "which one?" — and without them, the route doesn't even make sense. `/products/:productId` — there's no meaningful "products page" without knowing *which* product.

**Query params represent optional state — usually filters, sorting, or pagination.** They answer "how should I view this?" — and the page works fine without them, just with some default behavior. `/search?q=react&sort=newest` — the search page still makes sense even if `sort` isn't present; it just falls back to a default order.

### Reading query params

```jsx
import { useSearchParams } from "react-router-dom";

function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "relevance";

  function handleSortChange(newSort) {
    setSearchParams({ q: query, sort: newSort });
  }

  return (
    <div>
      <p>Showing results for "{query}", sorted by {sort}</p>
      <button onClick={() => handleSortChange("newest")}>Newest first</button>
    </div>
  );
}
```

`useSearchParams()` gives you back a `URLSearchParams`-like object (read with `.get()`) plus a setter function — very similar in shape to `useState()`, except it's backed by the URL's query string instead of component memory. Update it, and the URL updates too, which means it's shareable and bookmarkable — a huge win for something like a search page with filters.

### Side-by-side comparison

| | `useParams()` | `useSearchParams()` |
|---|---|---|
| Reads from | The path segment, e.g. `:productId` | The query string, e.g. `?q=...` |
| Example URL | `/products/123` | `/search?q=react&sort=newest` |
| Answers | "Which specific resource?" | "What optional view/filter state?" |
| Required for route to match? | Yes — part of the route pattern | No — route matches with or without it |
| Typical use | Product ID, user ID, order ID | Search text, sort order, page number, active tab |
| Route definition needed? | Yes: `path="/products/:productId"` | No: `path="/search"` alone is enough |
| Shape of return value | Plain object: `{ productId: "123" }` | `[URLSearchParams, setter]` pair |

A good gut-check question: "If I stripped this value out of the URL entirely, would the page still basically work, just with some default?" If yes — query param. If the page becomes meaningless or errors out — route param.

One more wrinkle worth knowing: multiple query params with the same key are legal (`?tag=react&tag=hooks`), and `URLSearchParams` supports `.getAll("tag")` to read all of them back as an array, whereas a route param position can only ever hold one value.

**Interview answer:** "Route params and query params both let a URL encode dynamic information, but they answer different questions. A route param, read with `useParams()`, is part of the route's path pattern and identifies a specific, required resource — the route doesn't match without it. A query param, read with `useSearchParams()`, is appended after a `?` and represents optional, non-identity state like filters or sort order — the page still renders sensibly if it's missing. A practical test: if removing the value would break the page's meaning entirely, it belongs in the path; if the page just falls back to a default, it belongs in the query string."

> **Memory hook:** "The path says *which thing* — the query string says *how you'd like to look at it*."

---

## 6. Protected / Private Routes

### The problem

Some pages should only be visible to logged-in users — a dashboard, an account settings page, an admin panel. If an unauthenticated visitor types that URL directly into their browser, you want to redirect them to a login page instead of showing the protected content.

### The analogy

Think of a protected route as a bouncer standing in front of a specific set of `<Outlet />` doors. Everyone walks up to the same doorway. The bouncer checks ID. If you're on the list, the doors open (`<Outlet />` renders). If not, you're redirected to a different line entirely (`<Navigate />` to `/login`).

### The pattern

The bouncer itself is just a small wrapper component:

```jsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./auth-context";

function ProtectedRoute() {
  const { user, isCheckingAuth } = useAuth();

  if (isCheckingAuth) {
    return <p>Checking your session...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

And you use it by wrapping it *around* the routes you want protected, exactly like a layout route:

```jsx
<Routes>
  <Route path="/login" element={<Login />} />

  <Route element={<ProtectedRoute />}>
    <Route path="/dashboard" element={<DashboardLayout />}>
      <Route index element={<Overview />} />
      <Route path="billing" element={<Billing />} />
    </Route>
    <Route path="/account" element={<Account />} />
  </Route>
</Routes>
```

Notice `<ProtectedRoute>` has no `path` of its own here — it's a **layout route without a path**, which React Router allows specifically for this "wrapper that doesn't add a URL segment" use case. Every route nested inside it passes through the auth check first.

Walking through what happens when a logged-out user visits `/dashboard/billing`:

```text
1. Router matches /dashboard/billing against the tree
2. It has to render ProtectedRoute first, since it wraps the match
3. ProtectedRoute checks: is isCheckingAuth true? -> show a spinner, wait
4. Once resolved: is user null? -> yes
5. <Navigate to="/login" replace /> fires
6. Browser URL changes to /login, DashboardLayout/Billing never render
```

And for a logged-in user:

```text
1. Router matches /dashboard/billing
2. ProtectedRoute checks: user exists -> render <Outlet/>
3. Outlet renders the next matched route: DashboardLayout
4. DashboardLayout's own <Outlet/> renders Billing
```

Two outlets are actually doing work here — `ProtectedRoute`'s outlet hands off to `DashboardLayout`, and `DashboardLayout`'s own outlet hands off to `Billing`. Nesting stacks cleanly like this, no matter how many layers deep.

**Why `replace` on the `<Navigate>`?** Without it, the redirect adds a new entry to browser history. That means if the user then hits the back button after logging in, they'd bounce right back to the `/dashboard` URL that redirected them, and get redirected again. `replace` swaps the current history entry instead of adding one, so back navigation skips over the redirect entirely.

**Why check `isCheckingAuth` at all?** Most real apps don't know if a user is logged in synchronously — they have to check a token, maybe ping an API. If you skip this check and just test `!user`, you'll redirect every single visitor to `/login` for a split second on page load, even ones who are actually logged in, because the auth state hasn't finished loading yet. Always handle the "we don't know yet" state explicitly.

### A nice bonus: sending the user back where they came from

A thoughtful touch is remembering *where* the user was trying to go, so after logging in you can send them back there instead of dumping them on a generic dashboard:

```jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";

function ProtectedRoute() {
  const { user, isCheckingAuth } = useAuth();
  const location = useLocation();

  if (isCheckingAuth) return <p>Checking your session...</p>;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
```

Then in `Login`, after a successful sign-in:

```jsx
const location = useLocation();
const from = location.state?.from?.pathname ?? "/dashboard";
navigate(from, { replace: true });
```

This is a small detail, but it's the difference between an app that feels considerate and one that annoyingly always dumps you back at square one after logging in.

**Interview answer:** "A protected route is implemented as a wrapper component — often a path-less layout route — that checks authentication state before letting its nested routes render. It shows a loading indicator while auth status is still being resolved, redirects unauthenticated users to a login page with `<Navigate replace />` so the protected URL doesn't pollute browser history, and renders `<Outlet />` to let the actual protected content through once the user is confirmed authenticated. Optionally, it can carry the originally requested location in navigation state so login can redirect back to where the user was headed."

> **Memory hook:** "A bouncer checks ID at one doorway — everything behind it is off-limits until you're on the list."

---

## 7. Common Mistakes

**Mistake 1 — Forgetting the `<Outlet />` in a layout component.**

```jsx
// BROKEN — no Outlet anywhere
function DashboardLayout() {
  return (
    <div>
      <Header />
      <Sidebar />
      {/* forgot <Outlet /> here */}
    </div>
  );
}
```

The routes still "match" as far as React Router is concerned — no error is thrown, nothing crashes. The child route's component is computed, but there's nowhere for it to render, so it silently never shows up. This is a nasty one to debug precisely *because* nothing complains. If a nested page seems to "disappear," the very first thing to check is whether the parent layout has `<Outlet />` in it.

**Mistake 2 — Confusing route params with query params.**

Writing `/products?productId=123` and then trying to read it with `useParams()` (which will return an empty object, because there's no `:productId` segment in the route). Or the reverse: defining `path="/search/:q"` and expecting users to be able to omit `q` sometimes — they can't, because a route param is part of the path pattern; leaving it out means the route simply doesn't match at all. If the value is optional, it almost always belongs in the query string, not the path.

**Mistake 3 — Not handling the "not found" state for a dynamic param.**

```jsx
// INCOMPLETE
function ProductPage() {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetch(`/api/products/${productId}`)
      .then((res) => res.json())
      .then(setProduct);
  }, [productId]);

  return <h1>{product.name}</h1>; // boom if product is still null, or the fetch 404'd
}
```

`:productId` matches *any* string — `/products/999999` matches the route just fine even if product 999999 doesn't exist. If you don't explicitly handle the loading state (`product` is still `null`) and the not-found state (the fetch came back 404), you'll get a crash trying to read `.name` off of `null`, or a page that quietly shows nothing with no explanation to the user. Always model three states for a dynamic-data page: loading, ready, not-found.

**Mistake 4 — Nesting the child route's path with a leading slash.**

```jsx
<Route path="/dashboard" element={<DashboardLayout />}>
  <Route path="/billing" element={<Billing />} /> {/* wrong */}
</Route>
```

A leading slash on a nested route's `path` makes it an **absolute** path, not a relative one — React Router won't treat it as `/dashboard/billing` the way you'd expect. Nested child paths should be written relative, without the leading slash: `path="billing"`.

---

## 8. Hands-On Exercises

**Exercise 1 — Basic dynamic route**

Build a `<Route path="/articles/:articleId" element={<ArticlePage />} />`. Inside `ArticlePage`, use `useParams()` to read `articleId` and display it. Then add a `useEffect` that "fetches" from a hardcoded in-memory array of articles based on that ID, and handle loading/ready/not-found states.

**Exercise 2 — Nested layout with Outlet**

Create a `SettingsLayout` component with a small nav (`Profile` | `Security` | `Notifications`) and an `<Outlet />`. Wire up three nested routes under `/settings` so each nav link renders a different child component inside the same layout, without the nav itself remounting. Add a `console.log` inside `SettingsLayout`'s render body and confirm it only logs once even as you click between the three links.

**Exercise 3 — Index route**

Take the `/settings` setup from Exercise 2 and add an index route so that visiting `/settings` directly (with no further segment) shows the `Profile` content by default.

**Exercise 4 — Query params for filtering**

Build a `/products` page that reads a `category` query param with `useSearchParams()` (e.g. `/products?category=shoes`). Render a row of category buttons that update the query param when clicked, and filter a hardcoded product list based on the current value. Confirm the filter still works correctly after a full page refresh.

**Exercise 5 — Protected route wrapper**

Write a `ProtectedRoute` component using a fake `useAuth()` hook (you can hardcode `{ user: null, isCheckingAuth: false }` to start). Wrap a `/profile` route with it. Confirm that visiting `/profile` redirects to `/login`. Then flip the hardcoded `user` to a truthy value and confirm `/profile` now renders normally.

**Exercise 6 — Combine everything**

Build a small "admin area": `/admin` is protected and has a layout with a sidebar and `<Outlet />`. It has an index route showing a dashboard summary, and a `/admin/users/:userId` nested dynamic route showing details for one user, read via `useParams()`. Add a "Back to list" link that also demonstrates `useSearchParams()` by preserving a `?page=2` value across the navigation.

---

## 9. Interview Q&A

**Q1: What problem does nested routing with `<Outlet />` solve?**

A: Without nesting, every route renders a completely separate element tree, so shared UI like a header or sidebar has to be duplicated in every page component — and worse, that shared UI unmounts and remounts on every navigation between pages, losing any local state or re-running mount effects. Nested routing lets a parent route render a persistent layout once, with an `<Outlet />` placeholder inside it. Child routes render only into that placeholder, so the surrounding layout stays mounted across navigations between children.

---

**Q2: What exactly does `<Outlet />` do, mechanically?**

A: `<Outlet />` is a component that renders whatever the currently best-matched child route's `element` is, based on the current URL. It's conceptually similar to `props.children`, except React Router — not the parent's own JSX — decides what fills the slot, driven by which nested `<Route>` path matches the remaining URL segment.

---

**Q3: Why doesn't a layout route re-render its header/sidebar every time you navigate between its child routes?**

A: Because React reconciles by element identity/position in the tree. The `<Route>` for the parent layout doesn't change when only the child route changes — React sees the same `DashboardLayout` element in the same position, so it keeps that component instance mounted and only swaps out what's rendered inside `<Outlet />`, which corresponds to a different part of the tree.

---

**Q4: What is a dynamic route param, and how do you read it?**

A: A dynamic route param is a URL path segment declared with a colon prefix in the route definition, e.g. `path="/products/:productId"`, which matches any value at that position. Inside the matched component, `useParams()` returns an object with the actual matched values, e.g. `{ productId: "123" }`.

---

**Q5: What is an index route and when do you need one?**

A: An index route is declared with the `index` prop instead of a `path`, and it renders as the default child of a parent route when the parent's path matches exactly with no further nested segment. You need one whenever a layout route should show some default content — rather than an empty `<Outlet />` — when the user lands on the bare parent path.

---

**Q6: What's the difference between `useParams()` and `useSearchParams()`, and how do you decide which to use?**

A: `useParams()` reads values embedded in the path itself (`/products/:productId`) and is used for values that identify a specific resource — without them, the route doesn't meaningfully exist. `useSearchParams()` reads the query string (`?q=react&sort=newest`) and is used for optional, non-identity state like filters, sorting, or pagination — the page still functions with sensible defaults if they're absent.

---

**Q7: Why would you choose a query param over a route param for a search page's search term?**

A: Because a search term is optional context, not a distinct resource — `/search` alone is still a valid, meaningful page (it can show recent searches or an empty state), whereas the term itself is more like a filter applied to that page. Route params are reserved for values the route cannot function without.

---

**Q8: How do you implement a protected route in React Router?**

A: Create a wrapper component that checks the current auth state. If authentication is still being determined, show a loading state. If the user is not authenticated, render `<Navigate to="/login" replace />` to redirect. If authenticated, render `<Outlet />` so nested/child routes proceed normally. Wrap this component around the routes that require auth using it as a path-less parent `<Route>`.

---

**Q9: Why use `replace` on the `<Navigate>` inside a protected route redirect?**

A: Without `replace`, the redirect pushes a new entry onto browser history, meaning the protected URL the user tried to visit stays in the back-button history. After logging in and later hitting back, they'd land back on that URL and get redirected again in a loop-like way. `replace` swaps the current history entry instead of adding a new one, so back navigation skips past the redirect.

---

**Q10: What happens if a layout route's component forgets to render `<Outlet />`?**

A: Nothing crashes and no route-matching error occurs — the child route is still considered "matched" internally, and its component is still computed. But since there's no `<Outlet />` in the parent's render tree, there's nowhere for that child element to actually appear, so it silently never shows up on screen. This is a common, hard-to-spot bug precisely because it fails silently.

---

**Q11: How should you handle a dynamic route param that doesn't correspond to any real data (e.g., `/products/999999` where that ID doesn't exist)?**

A: The route itself will match happily, since `:productId` matches any string. You need to explicitly model three states in the component: loading (data hasn't arrived yet), ready (data arrived and is valid), and not-found (the fetch failed or returned nothing for that ID) — and render appropriate UI for each, rather than assuming the fetched data will always exist.

---

**Q12: Can nested routes go more than one level deep?**

A: Yes. A route can be nested inside another nested route indefinitely. Each layout level in the chain needs its own `<Outlet />` to hand off rendering to whichever of its own child routes currently matches, and the URL path segments accumulate — a grandchild route's full matched path is the concatenation of every ancestor's path plus its own relative path.

---

**Q13: Why should a nested child route's `path` typically be written without a leading slash?**

A: A leading slash makes the path absolute rather than relative to its parent, which breaks the intended nesting — React Router won't automatically prefix it with the parent's matched path the way a relative path (`path="billing"` under a parent `/dashboard`, producing `/dashboard/billing`) does.

---

**Q14: How would you preserve a previously-set query parameter (like a page number) while navigating to a different nested route?**

A: Read the current value with `useSearchParams()` before navigating, and either include it in the `to` prop of a `<Link>` (e.g. building the URL string manually with the existing query string appended) or call the `setSearchParams` setter/`useNavigate()` with the value carried over explicitly, since query params are not automatically preserved across a route change unless you pass them along yourself.

---

**Q15: In one sentence, why is nested routing with `Outlet` considered a better fit for shared layouts than just importing `<Header />`/`<Sidebar />` into every page component?**

A: Because it lets the shared layout mount exactly once for the lifetime of a navigation session across sibling routes — preserving its internal state and avoiding repeated mount-effect work — while eliminating the duplication of manually wrapping every single page component with the same layout markup.
