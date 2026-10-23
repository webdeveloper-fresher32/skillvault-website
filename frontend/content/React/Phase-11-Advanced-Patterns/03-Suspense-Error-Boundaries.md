# 03 — Suspense & Error Boundaries

> "Something is either still loading, or it broke. Every async UI is really just those two extra states bolted onto 'it worked' — Suspense handles the first, Error Boundaries handle the second."

---

## Table of Contents

1. [The Problem: Loading State and Crashes, Everywhere](#1-the-problem-loading-state-and-crashes-everywhere)
2. [Real-World Analogies](#2-real-world-analogies)
3. [Basic Definitions](#3-basic-definitions)
4. [Internal Working](#4-internal-working)
   - 4.1 [Nested Suspense Boundaries](#41-nested-suspense-boundaries)
   - 4.2 [An Error Boundary Catching a Crash](#42-an-error-boundary-catching-a-crash)
5. [Examples](#5-examples)
   - 5.1 [Suspense, Briefly Revisited](#51-suspense-briefly-revisited)
   - 5.2 [A Full Error Boundary Class Component](#52-a-full-error-boundary-class-component)
   - 5.3 [Suspense + Error Boundary, Combined](#53-suspense--error-boundary-combined)
6. [What Error Boundaries Catch vs. Don't Catch](#6-what-error-boundaries-catch-vs-dont-catch)
7. [Common Mistakes](#7-common-mistakes)
8. [Interview Answer](#8-interview-answer)
9. [Memory Hooks](#9-memory-hooks)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. The Problem: Loading State and Crashes, Everywhere

Let's start with two very ordinary, very annoying problems that show up in basically every non-trivial React app.

**Problem one — threading loading state through everything.**

Say you're building a dashboard. It has a profile card, a list of recent orders, and a notifications panel. Each of those needs to fetch its own data. Without any help from React, you end up writing this shape, over and over, in every single component:

```jsx
function ProfileCard() {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfile().then((data) => {
      setProfile(data);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return <Spinner />;
  return <div>{profile.name}</div>;
}
```

Now multiply that `isLoading` dance by every component that fetches anything. Every one of them needs its own boolean, its own conditional, its own spinner markup. It's not hard, it's just relentless — the exact same three lines, copy-pasted into every data-fetching component you'll ever write.

**Problem two — one bug takes down the whole app.**

Now imagine the notifications panel has a bug. Maybe the API sent back `null` where your code expected an array, and somewhere deep in a `.map()` call, this happens:

```jsx
function NotificationsPanel({ notifications }) {
  return (
    <ul>
      {notifications.map((n) => (
        <li key={n.id}>{n.text}</li>
      ))}
    </ul>
  );
}
```

`notifications` is `null`. `.map()` on `null` throws. And here's the part that used to genuinely surprise people coming from other UI frameworks: **that one thrown error, from one small panel, used to unmount your *entire* React application.** The profile card, the orders list, the nav bar — gone. Blank white screen. One broken widget just cost you the whole page, for every user, until you shipped a fix.

Neither of these problems is really about "how do I fetch data" or "how do I write correct code." They're both about *what does the UI show while something async is in flight, and what does it show when something goes wrong* — and React has a dedicated, built-in answer for each one.

---

## 2. Real-World Analogies

**Suspense — a "please wait" sign at one specific counter, not a note on the front door.**

Picture a large government office with ten service counters: passports, tax forms, driving licences, and so on. If counter 4 (passports) needs to step away for two minutes to grab a form from the back, the *sensible* thing is a small sign on counter 4: "Back in 2 minutes." Everyone else in the building keeps being served normally at their own counters.

The *bad* version is shutting the entire building's front door with one sign: "Closed — back in 2 minutes," because one single counter needed a moment. Now nobody can be served, even though nine out of ten counters were perfectly ready to help.

Suspense is the sign on one specific counter. You choose exactly which "counter" (which part of your UI) gets a "please wait" sign, and everything outside that boundary keeps working normally.

**Error Boundaries — a circuit breaker for one room, not the whole house.**

Your house has a fuse box with a separate circuit breaker for the kitchen, the bedrooms, and the garage. If you plug in a faulty toaster and it short-circuits, the kitchen's breaker trips — the kitchen goes dark for a moment — but your bedroom lights, your fridge, your wifi router, all of it stays on. One faulty appliance in one room doesn't take down power to the entire house.

An Error Boundary is that breaker, placed around a specific part of your component tree. If something inside it throws while rendering, only *that* section goes dark (shows a fallback), while the rest of the app — the nav bar, the sidebar, everything outside the boundary — keeps running like nothing happened.

---

## 3. Basic Definitions

Now that the intuition is in place, here are the plain definitions.

> **Suspense** is a component (`<Suspense fallback={...}>`) that lets you declaratively show a fallback UI for everything inside it, until whatever caused it to "suspend" — a lazy-loaded component's code arriving, or (in supported setups) data finishing loading — becomes ready. You met a first, narrow slice of this in Phase 08 with `React.lazy()`. This lesson is the fuller picture.

> **An Error Boundary** is a component that catches JavaScript errors thrown anywhere in its child component tree during rendering, in lifecycle methods, or in constructors — and, instead of letting that error unmount the whole app, renders a fallback UI for just that subtree.

Notice the shared shape between them: both are "wrap some part of your tree in a special component, and hand it a fallback to show under one specific condition." Suspense's condition is "still waiting." An Error Boundary's condition is "it broke." Loading and error are the two extra states every async piece of UI needs beyond just "it worked" — and React gives you one dedicated primitive for each.

---

## 4. Internal Working

### 4.1 Nested Suspense Boundaries

Here's the idea that trips people up the most, so let's go slow: **you are not limited to one giant Suspense boundary around your whole page.** You can nest them, and each one only "blocks" the part of the UI actually inside it.

Think back to that dashboard from Section 1 — a profile card, an orders list, and a notifications panel, each fetching independently. If you wrap the *entire page* in one Suspense boundary, you get this:

```text
┌──────────────────────────────────────────────────────────┐
│  <Suspense fallback={<FullPageSpinner />}>                │
│                                                            │
│     ProfileCard        OrdersList       Notifications    │
│     (ready in 100ms)   (ready in 2s)    (ready in 400ms)  │
│                                                            │
└──────────────────────────────────────────────────────────┘
                       |
                       v
   ONE fallback covers all three. Even though ProfileCard's
   data arrived in 100ms, the user still stares at a full-page
   spinner for a full 2 seconds — until the SLOWEST child
   (OrdersList) is ready. Fast children get held hostage by
   the slowest one.
```

That's the trap of one boundary at the very top: the whole page is only as fast as its slowest piece. Now watch what happens when you give each section its *own* boundary instead:

```text
┌──────────────────────────────────────────────────────────────────┐
│  Page (no Suspense at this level)                                 │
│                                                                     │
│  ┌───────────────────────┐  ┌───────────────────────┐            │
│  │ <Suspense              │  │ <Suspense              │            │
│  │  fallback={<Skeleton/>}>│  │  fallback={<Skeleton/>}>│            │
│  │   <ProfileCard />       │  │   <OrdersList />        │            │
│  │  ready @ 100ms          │  │  ready @ 2s             │            │
│  │ </Suspense>             │  │ </Suspense>             │            │
│  └───────────────────────┘  └───────────────────────┘            │
│                                                                     │
│  ┌───────────────────────┐                                        │
│  │ <Suspense              │                                        │
│  │  fallback={<Skeleton/>}>│                                        │
│  │   <Notifications />     │                                        │
│  │  ready @ 400ms          │                                        │
│  │ </Suspense>             │                                        │
│  └───────────────────────┘                                        │
└──────────────────────────────────────────────────────────────────┘
        |
        v
t=0ms    All three sections show their own small skeleton
t=100ms  ProfileCard pops in — its boundary resolves, independently
t=400ms  Notifications pops in — its boundary resolves, independently
t=2000ms OrdersList finally pops in — its boundary resolves, last

The user sees a page fill in piece by piece, fastest-first,
instead of nothing at all for 2 full seconds.
```

That's the entire pitch for nesting: **granularity.** Each Suspense boundary is an independent "please wait" sign. Put one boundary around the whole page, and the slowest thing inside it decides how long *everything* waits. Put a boundary around each independently-loading section instead, and each section reveals itself the moment it, specifically, is ready — nobody waits on anybody else's data.

The rule React actually follows here is simple: when something suspends, React walks *up* the tree and shows the fallback for the **nearest** enclosing `<Suspense>` boundary — not the topmost one. So if `OrdersList` has its own boundary right around it, only that boundary's fallback shows; `ProfileCard` and `Notifications`, sitting under their own separate boundaries (or not suspending at all), are completely unaffected.

A quick rule of thumb for where to draw these boundaries: put a boundary around any unit of UI that (a) loads independently of its siblings and (b) is fine to reveal on its own, out of order. A whole page transitioning from a route click is often one boundary. Several independent widgets on a dashboard are usually several.

---

### 4.2 An Error Boundary Catching an Error

Now the second diagram — what actually happens the instant a component throws while rendering.

```text
┌───────────────────────────────────────────────────────────────┐
│  <App>                                                          │
│    <Navbar />                    ← totally unaffected            │
│    <Sidebar />                   ← totally unaffected            │
│                                                                   │
│    <ErrorBoundary fallback={<PanelBroke />}>                    │
│        <NotificationsPanel notifications={null} />              │
│                    |                                             │
│                    v                                             │
│         notifications.map(...) THROWS during render             │
│                    |                                             │
│                    v                                             │
│         React catches this INSIDE the ErrorBoundary,            │
│         calls getDerivedStateFromError + componentDidCatch,     │
│         unmounts the broken subtree, renders fallback instead   │
│    </ErrorBoundary>                                              │
│                                                                   │
│    <Footer />                    ← totally unaffected            │
│  </App>                                                          │
└───────────────────────────────────────────────────────────────┘
        |
        v
Result on screen:  Navbar (fine) — Sidebar (fine) —
                   "Something went wrong in Notifications" (fallback) —
                   Footer (fine)

Without the ErrorBoundary, this same throw propagates all the way
up past Navbar, Sidebar, and App itself — unmounting the ENTIRE
tree — because nothing along the way "caught" it.
```

The key mechanic: React's rendering is a single synchronous walk down the tree. If nothing anywhere in that walk is specifically listening for a thrown error, the throw just keeps propagating upward, unmounting everything above it as it goes, all the way to the root. An Error Boundary is the thing that specifically listens, at whatever level you place it, and stops that propagation right there.

---

## 5. Examples

### 5.1 Suspense, Briefly Revisited

You've already seen this shape in Phase 08 — `React.lazy()` paired with `Suspense` for a code-split component:

```jsx
import { lazy, Suspense } from "react";

const AnalyticsPanel = lazy(() => import("./AnalyticsPanel"));

function Dashboard() {
  return (
    <Suspense fallback={<div>Loading analytics…</div>}>
      <AnalyticsPanel />
    </Suspense>
  );
}
```

`AnalyticsPanel`'s code hasn't downloaded yet the first time it's rendered, so it "suspends," and the nearest `<Suspense>` shows its fallback until that download finishes. That's Suspense's original, narrowest use case: waiting on a *chunk of JavaScript*.

**What about Suspense for data fetching, not just code?** Newer React (and frameworks built on it) extend the same mechanism to data: a component can "suspend" while a data fetch is in flight, not just while its own code is downloading. But here's the honest, important caveat: **you generally do not hand-roll this yourself.** Doing it correctly — caching, deduplicating requests, avoiding request waterfalls, integrating with the built-in cache — is genuinely tricky to get right by hand. In practice, teams reach for something that already wires this up for them:

- **React Query**, via its `useSuspenseQuery` hook, which suspends the component while the query is loading and throws to the nearest Error Boundary if it fails.
- **Relay**, GraphQL-focused, built around Suspense from the ground up.
- **Frameworks with React Server Components** — Next.js (App Router) and Remix let you `await` data directly inside server components, and Suspense boundaries around them control streaming and fallback UI without you writing any manual "did it suspend" logic at all.

The mental model stays identical to the lazy-loading case either way: something inside the boundary isn't ready yet, so show the fallback until it is. What changes is *what* that "something" is — a JS chunk, or now, a piece of data — and *who* wires up the suspending behavior — you, by hand, for lazy components, versus a library or framework for data.

---

### 5.2 A Full Error Boundary Class Component

Here's the part that catches almost everyone off guard the first time: **Error Boundaries must be class components.** There is no hook equivalent — no `useErrorBoundary` hook exists in React today. That's because the two lifecycle methods that make an Error Boundary work, `static getDerivedStateFromError` and `componentDidCatch`, are class-only lifecycle methods with no hook equivalents. If you want this behavior, you write a class, full stop.

```jsx
import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    // Track whether an error occurred, so we know whether
    // to render the fallback UI instead of children.
    this.state = { hasError: false, error: null };
  }

  // Called during the "render" phase, right after a descendant throws.
  // Its ONLY job is to return the next state — no side effects here.
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // Called during the "commit" phase, after the state update above.
  // This is where side effects belong: logging to Sentry/Datadog,
  // reporting to your backend, etc.
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo.componentStack);
    // logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Render whatever fallback was passed in as a prop,
      // or a sensible default if none was given.
      return (
        this.props.fallback ?? (
          <div role="alert">
            <p>Something went wrong.</p>
            <button onClick={() => this.setState({ hasError: false, error: null })}>
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

Using it is exactly like using Suspense — wrap whatever subtree you want protected:

```jsx
function Dashboard() {
  return (
    <ErrorBoundary fallback={<p>Notifications are unavailable right now.</p>}>
      <NotificationsPanel notifications={null} />
    </ErrorBoundary>
  );
}
```

Two lifecycle methods, two different jobs — this distinction comes up in interviews a lot, so it's worth locking in:

- **`getDerivedStateFromError(error)`** — a *static* method, runs during the render phase, and its only responsibility is computing the next state (so React knows to render the fallback). It must be pure — no logging, no API calls, no side effects here.
- **`componentDidCatch(error, errorInfo)`** — runs during the commit phase, *after* the fallback has been committed to the DOM. This is your one chance to do the side-effecty things: send the error to your logging service, include `errorInfo.componentStack` (a string showing exactly which component threw and its ancestry) in that report.

Because writing this class correctly — resetting state properly, handling nested boundaries, exposing a clean `resetErrorBoundary` API — is a bit fiddly to get exactly right, most real teams don't write their own from scratch. They reach for **`react-error-boundary`**, a small, well-tested library that wraps this exact class-component machinery behind a friendlier API:

```jsx
import { ErrorBoundary } from "react-error-boundary";

function Dashboard() {
  return (
    <ErrorBoundary
      fallback={<p>Notifications are unavailable right now.</p>}
      onError={(error, info) => logErrorToService(error, info)}
      onReset={() => refetchNotifications()}
    >
      <NotificationsPanel notifications={null} />
    </ErrorBoundary>
  );
}
```

Same idea underneath — a class component doing `getDerivedStateFromError` / `componentDidCatch` — just packaged so you don't have to hand-write and re-test it in every project.

---

### 5.3 Suspense + Error Boundary, Combined

This is where the two primitives really earn their keep together. Think back to Phase 10's testing lesson, where you tested a data-fetching component's loading, success, and error states. Suspense and Error Boundaries are the *rendering-side* answer to that exact same trio:

```jsx
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

function UserProfilePage() {
  return (
    <ErrorBoundary fallback={<p>Couldn't load this profile. Please try again.</p>}>
      <Suspense fallback={<ProfileSkeleton />}>
        <UserProfile />
      </Suspense>
    </ErrorBoundary>
  );
}
```

Walk through the three states this covers:

- **Loading** — `UserProfile` suspends while its data (or code) is in flight → the `Suspense` fallback (`<ProfileSkeleton />`) shows.
- **Success** — the data arrives → `UserProfile` renders normally, no fallback in sight.
- **Error** — the fetch fails, or `UserProfile` throws while rendering with bad data → that error skips right past `Suspense` (Suspense only knows about "still waiting," not "failed") and is caught by the `ErrorBoundary` instead, which shows its own fallback.

Notice the ordering: `ErrorBoundary` wraps `Suspense`, not the other way around. That's deliberate — you generally want the error fallback to have the final say over the entire "still loading OR failed" region, so a failure inside the loading boundary still gets caught by something above it.

---

## 6. What Error Boundaries Catch vs. Don't Catch

This is, hands down, the single most commonly tested fact about Error Boundaries — and the most commonly misunderstood. Read this table twice.

| Situation | Caught by an Error Boundary? | Why |
|---|---|---|
| An error thrown while rendering a child component | **Yes** | This is the core case Error Boundaries exist for. |
| An error thrown in a lifecycle method (`componentDidMount`, `componentDidUpdate`, etc.) of a child class component | **Yes** | These run as part of the same render/commit cycle Error Boundaries watch. |
| An error thrown in a child component's constructor | **Yes** | Construction happens before the component can render; still covered. |
| An error thrown inside an **event handler** (`onClick`, `onChange`, etc.) | **No** | Event handlers run outside of React's render cycle — the throw happens on its own call stack, not one React is watching. Use a plain `try/catch` inside the handler instead. |
| An error thrown inside **asynchronous code** (`setTimeout`, a `.then()` callback, an `async` function's body, a `fetch` that rejects) | **No** | By the time the async callback runs, React's render/commit work for that trigger is long finished. Handle these with `try/catch` around `await`, or `.catch()` on the promise. |
| An error thrown during **server-side rendering (SSR)** | **No** | Error Boundaries are a client-side (and now server-rendering-aware in newer React, but not via this exact mechanism) rendering concept; SSR error handling goes through separate APIs your framework provides. |
| An error thrown **inside the Error Boundary component itself** | **No** | A boundary can't catch its own failure — that's why boundaries are kept deliberately small and simple, with as little logic in them as possible. |

Two big takeaways from that table:

1. **"Caught" basically means "thrown during React's own rendering work."** If React itself is the one calling the function that threw — rendering a component, running its lifecycle methods, constructing it — an Error Boundary can see it. If some *other* piece of code triggers the callback (the browser calling your `onClick` handler, a timer firing, a promise resolving), React isn't the one holding the stack when it throws, so there's nothing for the boundary to intercept.
2. **Event handlers and async code need old-fashioned `try/catch`.** This isn't a gap you patch with more Error Boundaries — it's just a different tool for a different situation.

```jsx
function DeleteButton({ id }) {
  const [error, setError] = useState(null);

  async function handleClick() {
    try {
      await deleteItem(id);
    } catch (err) {
      // An Error Boundary would NOT catch this — it's inside an
      // event handler's async code. You handle it yourself.
      setError(err);
    }
  }

  if (error) return <p>Delete failed: {error.message}</p>;
  return <button onClick={handleClick}>Delete</button>;
}
```

---

## 7. Common Mistakes

**Mistake 1 — expecting an Error Boundary to catch a click-handler error.**

```jsx
function SubmitButton() {
  function handleClick() {
    throw new Error("Oops"); // an ErrorBoundary around this WILL NOT catch it
  }
  return <button onClick={handleClick}>Submit</button>;
}
```

Wrapping `<SubmitButton />` in an `<ErrorBoundary>` does nothing here. The throw happens inside the browser's own click-event callback, not during React's render — wrap the handler body in `try/catch` instead.

**Mistake 2 — expecting an Error Boundary to catch a rejected promise or a failed `setTimeout` callback.**

Same root cause as Mistake 1: by the time that async code runs, React has already finished the render/commit work that an Error Boundary is watching. `.catch()` the promise, or `try/catch` around the `await`.

**Mistake 3 — trying to write an Error Boundary as a function component with hooks.**

```jsx
// This does NOT work — there is no hook for this.
function ErrorBoundary({ children }) {
  // no useErrorBoundary hook exists in React
  return children;
}
```

There's no way around this one: Error Boundaries need `getDerivedStateFromError` and `componentDidCatch`, and both are class-only lifecycle methods. If you don't want to hand-write and maintain a class yourself, reach for `react-error-boundary`, which gives you a component-based, hook-friendly API (`useErrorBoundary` from that *library*, not from React itself) while still being a class underneath.

**Mistake 4 — one Suspense boundary at the very top, wrapping the entire page.**

```jsx
// Works, but everything waits on the SLOWEST child
<Suspense fallback={<FullPageSpinner />}>
  <ProfileCard />
  <OrdersList />
  <Notifications />
</Suspense>
```

As covered in Section 4.1, this means a fast section like `ProfileCard` (ready in 100ms) still sits behind a spinner until the slowest section (`OrdersList`, at 2 seconds) finishes. Give independently-loading sections their own nested boundaries so each reveals itself the moment it's ready.

**Mistake 5 — assuming Suspense handles errors too.**

Suspense only knows one thing: "is this still pending?" If the thing inside it *throws* — a fetch that rejected, or a component that crashes while rendering with bad data — Suspense has nothing to do with catching that. You still need an Error Boundary above (or around) it, exactly as shown in Section 5.3.

**Mistake 6 — forgetting that a rethrown/uncaught error inside an Error Boundary's own render still crashes upward.**

An Error Boundary can't save itself. Keep the boundary component itself tiny and boring — ideally just the class shown in Section 5.2 — so there's as little surface area as possible for it to fail on its own.

---

## 8. Interview Answer

"Error Boundaries are class components that catch JavaScript errors thrown during rendering, in lifecycle methods, or in constructors anywhere in their child tree, using `static getDerivedStateFromError` to compute fallback state and `componentDidCatch` to log the error as a side effect. What trips people up is what they *don't* catch: errors inside event handlers, errors in asynchronous code like `setTimeout` or promise callbacks, errors during server-side rendering, and errors thrown by the boundary itself — all of those need a regular `try/catch` instead. There's also no hook equivalent; if you need this behavior you either write a class or use a library like `react-error-boundary` that wraps one for you. In practice, Error Boundaries are often paired with Suspense: Suspense's fallback covers the 'still loading' state, and the Error Boundary's fallback covers the 'it failed' state, together giving you full coverage of a data-fetching component's loading/success/error lifecycle."

---

## 9. Memory Hooks

> **Memory hook (Suspense):** "A 'please wait' sign on one counter, not a 'closed' sign on the whole building — nest boundaries so fast sections don't wait on slow ones."

> **Memory hook (Error Boundaries):** "A circuit breaker for one room — a tripped kitchen breaker doesn't kill the whole house's power."

> **Memory hook (what's NOT caught):** "If React itself wasn't the one holding the stack when it threw — a click handler, a timer, a promise — an Error Boundary never even saw it happen."

> **Memory hook (class-only requirement):** "No `useErrorBoundary` hook exists in React — `getDerivedStateFromError` and `componentDidCatch` only live on classes, so a boundary is always a class underneath."

---

## 10. Hands-On Exercises

**Exercise 1 — Basic Error Boundary**

Write an `ErrorBoundary` class component from scratch (don't use a library) that implements `getDerivedStateFromError` and `componentDidCatch`, and renders a fallback `<p>` with the caught error's `.message`. Wrap a component that deliberately throws (`throw new Error("boom")` inside its render) and confirm the rest of your app around it keeps rendering normally.

**Exercise 2 — Nested Suspense Boundaries**

Build a mock dashboard with three components, each simulating a different fetch delay using `setTimeout` inside a promise (say, 100ms, 400ms, and 2000ms). First wrap all three in a single top-level `<Suspense>` and observe that nothing renders until the 2000ms one resolves. Then give each component its own `<Suspense>` boundary and observe each one appear independently, fastest first.

**Exercise 3 — What Gets Caught, What Doesn't**

Create three separate "break" buttons on a page, each wrapped in the same `ErrorBoundary`:
1. One that throws directly inside its render (should be caught).
2. One whose `onClick` handler throws (should NOT be caught — confirm the whole app doesn't crash, but also confirm the Error Boundary's fallback never appears).
3. One whose `onClick` handler calls `setTimeout(() => { throw new Error("async") }, 100)` (should NOT be caught, and note this one may actually still crash the tab in dev tools since nothing catches it at all — that's the point).

Write a short note explaining, in your own words, why cases 2 and 3 don't reach the boundary.

**Exercise 4 — Combined Loading/Success/Error Coverage**

Build a `UserProfile` component that can be told (via a prop or a mock function) to either succeed, stay pending forever, or throw. Wrap it in `<ErrorBoundary><Suspense fallback={...}>...</Suspense></ErrorBoundary>` and manually verify all three states render the correct UI.

**Exercise 5 — Resetting an Error Boundary**

Extend your Exercise 1 `ErrorBoundary` with a "Try again" button inside the fallback that calls `this.setState({ hasError: false })`. Confirm that clicking it re-attempts rendering the children. Then investigate (and write a short note on) why this alone isn't enough if the *same* bad data/props caused the error in the first place — what would you need to change about the surrounding component to make retry actually useful?

**Exercise 6 — react-error-boundary Refactor**

Install `react-error-boundary` in a scratch project and refactor your Exercise 1 class component to use the library's `<ErrorBoundary>` component with an `onReset` prop instead. Compare how much boilerplate the library removed versus your hand-written version.

---

## 11. Interview Q&A

**Q1: What problem does Suspense solve?**

A: It lets you declaratively show a fallback UI for a subtree while something inside it isn't ready yet — a lazy-loaded component's code still downloading, or (with framework/library support) data still being fetched — instead of manually threading an `isLoading` boolean through every component that needs one.

---

**Q2: What problem do Error Boundaries solve?**

A: Before Error Boundaries, an unhandled JavaScript error thrown while rendering any component would unmount the entire React application, producing a blank white screen for every user. Error Boundaries let you catch an error in a specific subtree and show a fallback for just that section, keeping the rest of the app running.

---

**Q3: Why must Error Boundaries be class components?**

A: Because the two lifecycle methods that implement this behavior — `static getDerivedStateFromError` (computes fallback state during the render phase) and `componentDidCatch` (handles side effects like logging during the commit phase) — are class-only lifecycle methods. React has no hook equivalent for either one, so there is no way to write an Error Boundary as a function component using only hooks.

---

**Q4: List everything an Error Boundary does NOT catch.**

A: Errors thrown inside event handlers (`onClick`, `onChange`, etc.), errors in asynchronous code (`setTimeout` callbacks, promise `.then()`/`.catch()` callbacks, `async` function bodies), errors during server-side rendering, and errors thrown by the Error Boundary component itself. Event handler and async errors need a regular `try/catch` around the code that can fail.

---

**Q5: Why don't Error Boundaries catch event handler errors?**

A: Error Boundaries hook into React's render/commit cycle. An event handler like `onClick` runs on a separate call stack triggered by the browser's event system, entirely outside of that render/commit cycle — React isn't "in the middle of" anything when the handler runs, so there's no render-phase mechanism for it to intercept the throw.

---

**Q6: What's the difference between `getDerivedStateFromError` and `componentDidCatch`?**

A: `getDerivedStateFromError` is a static method that runs during the render phase and must be pure — its only job is returning the state update needed to show a fallback UI. `componentDidCatch` runs afterward, during the commit phase, and is where you perform side effects, like logging the error and its component stack to an error-reporting service.

---

**Q7: Why do most teams use `react-error-boundary` instead of writing their own Error Boundary class?**

A: Writing a correct, reusable Error Boundary involves some fiddly details — resetting state cleanly on retry, exposing a clean reset API, handling nested boundaries well — that are easy to get slightly wrong. `react-error-boundary` is a small, well-tested library that wraps the same underlying class-component mechanism behind a friendlier, more ergonomic API, so teams don't re-solve and re-test the same problem in every project.

---

**Q8: What is the benefit of nesting multiple Suspense boundaries instead of using one at the top of a page?**

A: A single top-level Suspense boundary means the entire page waits on whichever piece of content is slowest to load, even if other sections are ready much sooner. Nesting a separate Suspense boundary around each independently-loading section lets each one reveal itself the moment it, specifically, is ready, instead of all of them being held back by the slowest one.

---

**Q9: When something suspends, how does React decide which Suspense boundary's fallback to show?**

A: React walks up the component tree from the suspending component and shows the fallback of the *nearest* enclosing `<Suspense>` boundary — not necessarily the topmost one in the app. This is exactly why nested boundaries work: an inner boundary "shields" its siblings and ancestors from having to show their own fallback for something suspending deep inside it.

---

**Q10: Can Suspense catch a thrown error the way an Error Boundary does?**

A: No. Suspense only handles the "still pending" case. If a component inside a Suspense boundary throws an actual error (say, a fetch that rejected, or bad data crashing during render), that error is not something Suspense understands — it needs an Error Boundary, typically wrapped around the Suspense boundary, to be caught and shown a fallback for.

---

**Q11: Why is manually hand-rolling Suspense for data fetching (without a library or framework) not a common pattern?**

A: Suspending correctly on data requires integrating with caching, request deduplication, avoiding request waterfalls, and re-suspending correctly on refetches — subtle behavior that's easy to get wrong by hand. Most teams instead rely on tooling that already implements this correctly: React Query's `useSuspenseQuery`, Relay, or frameworks with React Server Components like Next.js or Remix, which wire up the suspending behavior for you.

---

**Q12: How are Suspense and Error Boundaries typically combined for a data-fetching component?**

A: An `ErrorBoundary` wraps a `Suspense` boundary, which wraps the actual data-fetching component. While data is loading, the component suspends and Suspense's fallback shows. If the fetch succeeds, the component renders normally. If it fails (or the component throws while rendering with bad data), that error is caught by the `ErrorBoundary`, not Suspense, and its fallback shows instead. Together, this covers the loading/success/error trio.

---

**Q13: What is the discriminator between "will an Error Boundary catch this" and "will it not"?**

A: Whether React itself was the one executing the code that threw as part of its own render/commit work. Rendering, lifecycle methods, and constructors all run inside that cycle, so errors there are caught. Event handlers and async callbacks run outside that cycle — triggered later, by the browser or a timer/promise, on a different call stack — so errors there are missed by Error Boundaries entirely.

---

**Q14: What happens if an Error Boundary itself throws while rendering its fallback?**

A: It is not caught by itself — a boundary cannot protect against its own failure. The error propagates upward exactly as if there were no boundary there at all, and will be caught by the next Error Boundary further up the tree, if one exists; if none exists, it behaves like any other uncaught render error and can unmount the app above it. This is why Error Boundary components are kept intentionally small and simple.

---

**Q15: Give a concrete example of an error that would NOT be caught by an Error Boundary, and explain how you'd handle it instead.**

A: A `fetch` call inside an `async` `onClick` handler that rejects — for example, a "Delete" button whose handler awaits an API call that fails. Because this runs inside an event handler's async code, an Error Boundary around the button never sees it. Instead, wrap the `await` in a `try/catch` inside the handler, catch the rejection there, and set local component state (e.g., `setError(err)`) to render an inline error message yourself.
