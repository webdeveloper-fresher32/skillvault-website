# 01 — useEffect

> "Rendering is what your component *looks like*. Effects are what your component *does* to the outside world."

---

## Table of Contents

1. [The Problem useEffect Solves](#1-the-problem-useeffect-solves)
2. [Basic Syntax](#2-basic-syntax)
3. [The Dependency Array In Depth](#3-the-dependency-array-in-depth)
   - 3.1 [No Dependency Array](#31-no-dependency-array)
   - 3.2 [Empty Dependency Array](#32-empty-dependency-array)
   - 3.3 [Dependency Array With Values](#33-dependency-array-with-values)
4. [The Cleanup Function](#4-the-cleanup-function)
5. [Internal Working — The Full Timeline](#5-internal-working--the-full-timeline)
6. [Data Fetching With useEffect](#6-data-fetching-with-useeffect)
7. [Compare: No Deps vs Empty Array vs Deps With Values](#7-compare-no-deps-vs-empty-array-vs-deps-with-values)
8. [The exhaustive-deps Rule and Stale Closures](#8-the-exhaustive-deps-rule-and-stale-closures)
9. [useEffect vs useLayoutEffect](#9-useeffect-vs-uselayouteffect)
10. [Common Mistakes](#10-common-mistakes)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The Problem useEffect Solves

Let's start with what a React component's job actually is: **taking props and state, and returning some JSX that describes what the UI should look like.** That's it. That's the whole job of the function body.

But real applications need to do things that have nothing to do with "what does the UI look like":

```
Fetch data from a server
Subscribe to a WebSocket
Start a setInterval timer
Manually focus an input
Read/write to localStorage
Add a "resize" listener to the window
```

None of these are about describing UI. They're about **reaching outside** your component — touching the network, the browser, the DOM, timers, external systems. React has a name for this category of work: **side effects**.

Here's the problem: if you just run this code directly inside your component function, during render, you get chaos.

```jsx
function UserProfile({ userId }) {
  // DON'T DO THIS
  fetch(`/api/users/${userId}`).then(res => res.json());

  return <div>Profile</div>;
}
```

Why is this a problem? Because **render can happen many times** — React might render a component multiple times for the same output (especially in Strict Mode, or during certain scheduling scenarios), and render is supposed to be a pure calculation, not something that triggers network requests as a side gig. If fetching happened directly in the render body, every single re-render — even ones caused by something totally unrelated, like a parent re-rendering — would fire off a brand new network request. Your app would hammer the server for no reason.

React needs a way to say: "run this code, but *after* rendering has settled, and only when it actually needs to."

That's exactly what `useEffect` is for. It lets you say: "after this component renders (and the browser has painted the screen), go ahead and do this side effect."

---

## 2. Real-World Analogy

Think of a restaurant kitchen.

**Render** is the chef plating the dish — arranging food on a plate based on the order. That's a fast, self-contained task. It shouldn't involve driving to the grocery store or calling a supplier.

**Side effects** are things like restocking a low ingredient, calling a supplier when a delivery is late, or wiping down a table after customers leave. These aren't part of "making a dish look right" — they're separate tasks that happen *around* the main job, often triggered by something that happened, and often needing cleanup afterward (turning off the stove, putting the cutting board away).

`useEffect` is the kitchen's "after the plate goes out" checklist — a place to do these side tasks *after* the main plating work is done, without blocking or corrupting the plating itself.

---

## 3. Basic Syntax

Here's the shape of a `useEffect` call:

```jsx
import { useEffect } from 'react';

useEffect(() => {
  // side effect code goes here
}, [dependencies]);
```

Two arguments:

1. A function — the "effect" itself. This is the side-effect code that runs after render.
2. An array (optional) — the **dependency array**. This tells React "only re-run this effect if one of these values has changed since the last render."

A minimal, real example:

```jsx
import { useState, useEffect } from 'react';

function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    document.title = `The time is ${time.toLocaleTimeString()}`;
  }, [time]);

  return <h1>{time.toLocaleTimeString()}</h1>;
}
```

Every time `time` changes, React re-renders `Clock`, paints the new time to the screen, and *then* runs the effect, which updates the browser tab's title. Notice what didn't happen: the title update didn't happen *during* render — it happened as a distinct, separate step afterward.

---

## 4. The Dependency Array In Depth

This is, without exaggeration, the single most important — and most misunderstood — concept in this entire file. Get comfortable, because we're going to look at it from every angle.

The dependency array controls **when** React decides to re-run your effect. There are three forms, and each one means something completely different.

### 3.1 No Dependency Array

```jsx
useEffect(() => {
  console.log('This runs after EVERY render');
});
```

No second argument at all. This means: "run this effect after every single render, no matter what changed." Even if a totally unrelated piece of state updates, or a parent re-renders this component for any reason, the effect fires again.

**When is this actually useful?** Rarely, but it exists — for example, some debugging/logging effects, or effects that intentionally need to sync with literally everything about the latest render. Most of the time, if you find yourself omitting the array entirely, ask whether you actually meant to write `[]` or a real dependency list instead.

### 3.2 Empty Dependency Array

```jsx
useEffect(() => {
  console.log('This runs ONCE, right after the first render (mount)');
}, []);
```

An empty array `[]` means: "there are no values this effect depends on, so never re-run it." Since there's nothing to compare between renders, React just runs it once — after the very first render — and never again (until the component unmounts, which we'll cover in the cleanup section).

This is the classic pattern for "run this once when the component mounts" — for example, fetching initial data, setting up a subscription that should live for the component's entire life, or reading something from `localStorage` on startup.

### 3.3 Dependency Array With Values

```jsx
useEffect(() => {
  console.log(`userId changed to ${userId}, refetching...`);
}, [userId]);
```

This says: "after this render, compare each value in this array to its value from the *previous* render. If **any** of them are different, run the effect again. If none of them changed, skip it."

So with `[userId]`:

- Render where `userId` is `1` → effect runs (first render always runs the effect).
- Re-render where `userId` is still `1` (something else changed, like an unrelated state field) → effect is **skipped**.
- Re-render where `userId` is now `2` → effect runs again, because `1 !== 2`.

React does this comparison using `Object.is` (essentially `===` with a couple of edge-case fixes) — a shallow comparison. This matters a lot for objects and arrays: if you create a brand new object or array on every render (even with identical-looking contents), React sees it as "different" every time, because it's comparing references, not deep equality.

```jsx
// Danger: a new array is created on every render,
// so this effect thinks 'options' changed every single time
useEffect(() => {
  doSomething(options);
}, [options]); // options = { sort: 'asc' } recreated inline on every render
```

We'll come back to this trap in Section 8.

---

## 5. The Cleanup Function

Some side effects create something that needs to be undone later — a subscription needs to be unsubscribed, a timer needs to be cleared, an event listener needs to be removed. If you don't undo them, you get memory leaks, duplicate subscriptions, or "ghost" behavior from old effects still running in the background.

React gives you a way to declare this cleanup: **return a function from your effect.**

```jsx
useEffect(() => {
  const id = setInterval(() => {
    console.log('tick');
  }, 1000);

  // This is the cleanup function
  return () => {
    clearInterval(id);
  };
}, []);
```

**Exactly when does the cleanup function run?** Two situations, and both matter:

1. **Before the effect runs again** (when a dependency changes). React cleans up the *old* effect before setting up the *new* one.
2. **When the component unmounts** (is removed from the screen entirely). This is your last chance to tidy up before the component is gone for good.

Here's a subscription example that makes this concrete:

```jsx
function ChatRoom({ roomId }) {
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.connect();

    return () => {
      connection.disconnect();
    };
  }, [roomId]);

  return <h1>Welcome to room {roomId}</h1>;
}
```

Walk through what happens if `roomId` goes from `"general"` to `"random"`:

```
1. Component is showing "general" room, connected.
2. roomId prop changes to "random".
3. Component re-renders with the new roomId.
4. React runs the CLEANUP from the previous effect
   -> connection.disconnect() for "general"
5. React runs the NEW effect
   -> connection.connect() for "random"
```

Without that cleanup function, you'd stay connected to "general" *forever*, even after switching to "random" — a leaked connection, quietly still running, possibly still calling callbacks on a component that's no longer showing that room.

---

## 6. Internal Working — The Full Timeline

Let's put the whole lifecycle in one picture. This is the part worth staring at until it clicks, because once you have this timeline in your head, every "why did my effect run twice" or "why didn't my effect run" question becomes answerable.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     useEffect Full Timeline                          │
│                                                                        │
│   1. Component function runs (render phase)                          │
│      -> React calculates the JSX, nothing touches the screen yet      │
│                          |                                            │
│                          v                                            │
│   2. React commits the changes to the real DOM                       │
│                          |                                            │
│                          v                                            │
│   3. Browser PAINTS the screen (user visually sees the update)       │
│                          |                                            │
│                          v                                            │
│   4. Effect runs (asynchronously, after paint)                       │
│      -> your fetch / subscription / timer starts here                │
│                          |                                            │
│              (component re-renders due to a                          │
│               state/prop change relevant to this effect)             │
│                          |                                            │
│                          v                                            │
│   5. CLEANUP function runs FIRST                                     │
│      -> undoes whatever step 4 set up                                │
│                          |                                            │
│                          v                                            │
│   6. New effect runs again (step 4, repeated)                        │
│                          |                                            │
│                 ... this repeats for every relevant change ...       │
│                          |                                            │
│                          v                                            │
│   7. Component UNMOUNTS (removed from the screen)                    │
│                          |                                            │
│                          v                                            │
│   8. FINAL cleanup runs                                              │
│      -> last chance to disconnect / clear timers / remove listeners  │
└─────────────────────────────────────────────────────────────────────┘
```

The key insight buried in this diagram: **the browser paints BEFORE your effect runs.** This is deliberate. React doesn't want your side effects (which might be slow — a fetch, a big computation) to block the user from seeing the visual update. The screen updates first; your effect's extra work happens right after, without the user waiting on it.

Also notice: cleanup and re-run are a pair. React never just "adds another effect on top" — it always cleans up the previous instance first, then sets up the new one. Effects are self-contained: set up, tear down, set up, tear down, forever, ending with one final tear-down at unmount.

### A quick note on React 18 Strict Mode

If you're developing with `<React.StrictMode>` (which is on by default in apps created with modern tooling), you might notice your effects seem to run **twice** on mount, with a cleanup squeezed in between:

```
mount -> effect runs -> cleanup runs -> effect runs again
```

This is intentional, and it only happens in development, never in production. React is deliberately simulating "mount, unmount, remount" once to help you catch effects that aren't properly cleaning up after themselves. If your effect and its cleanup are written correctly (undoing exactly what the effect set up), this double-run is harmless and invisible to the user. If it breaks your app, that's React telling you that your cleanup logic is incomplete — not a bug in React.

---

## 7. Data Fetching With useEffect

Let's fetch some data for real, and handle the trickiest part properly: what happens if the component unmounts (or its props change) *before* the fetch finishes?

If you naively call `setState` after an unrelated fetch resolves, and the component is already gone, you'll see this warning in the console:

```
Warning: Can't perform a React state update on an unmounted component.
```

It's not just a cosmetic warning — it's flagging a real problem: you're holding onto a reference to something that should have been discarded, and the update is being thrown away, wasting the work (and in trickier cases, it can cause bugs where a stale, out-of-date response overwrites a newer one).

Here are the two standard ways to guard against it.

### Option A — AbortController (recommended)

```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchUser() {
      try {
        const response = await fetch(`/api/users/${userId}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Failed to load user');
        const data = await response.json();
        setUser(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      }
    }

    fetchUser();

    return () => {
      controller.abort(); // cancels the in-flight request
    };
  }, [userId]);

  if (error) return <p>Error: {error}</p>;
  if (!user) return <p>Loading...</p>;
  return <h1>{user.name}</h1>;
}
```

Walking through it: every time `userId` changes (or the component unmounts), the cleanup function fires `controller.abort()`, which cancels the request that's still in flight. The `fetch` call rejects with an `AbortError`, which we deliberately ignore (it's not a real error — it's just us cancelling on purpose), so `setUser`/`setError` never gets called for a request we no longer care about.

### Option B — the mounted-flag pattern

Some environments don't support `AbortController` cleanly (or you're cancelling something that isn't a `fetch`). A simpler, slightly less precise fallback is a boolean flag:

```jsx
useEffect(() => {
  let isMounted = true;

  async function fetchUser() {
    const response = await fetch(`/api/users/${userId}`);
    const data = await response.json();
    if (isMounted) {
      setUser(data);
    }
  }

  fetchUser();

  return () => {
    isMounted = false;
  };
}, [userId]);
```

This doesn't actually cancel the network request — it's still happening in the background — but it prevents the `setUser` call from ever running against a component that's already gone. Prefer `AbortController` when you can, since it actually cancels wasted work instead of just silently ignoring the result.

---

## 8. Compare: No Deps vs Empty Array vs Deps With Values

| Form | When it runs | Typical use case |
|------|--------------|-------------------|
| `useEffect(fn)` (no array) | After **every** render, no matter what changed | Rare — debugging/logging every render; usually a sign you meant one of the other two forms |
| `useEffect(fn, [])` | Once, right after the **first** render (mount); cleanup runs once, on unmount | "Run this on startup" — initial fetch, subscribing to something for the component's whole life |
| `useEffect(fn, [a, b])` | After the first render, and again whenever `a` or `b` changes between renders | "Re-sync when this specific thing changes" — refetching when an ID prop changes, reconnecting when a room changes |

A visual way to remember it: think of the array as **"the list of things this effect cares about."** An empty list means "cares about nothing, so never needs to re-run." No list at all means "there's no list — just run every time, unconditionally."

---

## 9. The exhaustive-deps Rule and Stale Closures

Here's where most real-world useEffect bugs live, so let's slow down.

React's ESLint plugin (`eslint-plugin-react-hooks`) ships a rule called `react-hooks/exhaustive-deps`. Its job: look inside your effect function, find every variable from the component's scope that it *actually uses*, and warn you if that variable isn't listed in the dependency array.

Why does this rule exist? Because of **closures**. When your effect function is created during a render, it "closes over" (captures) the values of props and state *as they were during that specific render*. If you tell React "only re-run this effect when `[]` changes" (i.e., never), but the effect actually uses a prop or state value inside it, that effect is now permanently holding onto the value from the very first render — forever. This is called a **stale closure**.

Let's see it happen:

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      console.log(count); // <- captured from the render where this effect was created
      setCount(count + 1); // <- BUG: always sets count to 1, forever
    }, 1000);

    return () => clearInterval(id);
  }, []); // <- lying to the dependency array: `count` is used here but not listed

  return <h1>{count}</h1>;
}
```

What actually happens: because the array is `[]`, this effect runs exactly once, when `count` was `0`. The `setInterval` callback captured `count = 0` forever. Every second, it logs `0`, and calls `setCount(0 + 1)`, so `count` becomes `1`... and then becomes `1` again next tick... and again... It never goes above `1`, because the closure never sees any `count` value except the one from that first render. This is the textbook stale closure bug, and it's extremely common with intervals, timeouts, and event listeners.

**The honest fix** is to actually include `count` in the dependency array:

```jsx
useEffect(() => {
  const id = setInterval(() => {
    setCount(count + 1);
  }, 1000);
  return () => clearInterval(id);
}, [count]); // now it re-creates the interval every time count changes — correct, but a bit wasteful
```

This works, but notice it means tearing down and recreating the interval every single second, just to capture the fresh `count`. A cleaner fix, when your update only *depends on the previous value*, is to use the **functional update form** of `setState`, which doesn't need to read `count` from the closure at all:

```jsx
useEffect(() => {
  const id = setInterval(() => {
    setCount(prevCount => prevCount + 1); // reads the latest value directly from React, no closure needed
  }, 1000);
  return () => clearInterval(id);
}, []); // genuinely correct with an empty array now — nothing here depends on stale state
```

This is the real lesson: **don't lie to the dependency array to "make the warning go away."** If ESLint says a variable should be in the array, and you remove it instead of fixing the underlying issue, you have most likely just created a stale closure bug that will show up as "weird, hard-to-reproduce" behavior — often only occasionally, and often not caught by simple manual testing.

> The dependency array isn't a "when should this run" dial you tune to get the behavior you want. It's an honest declaration of "these are the values my effect actually reads." Get the second part right, and the first part follows correctly.

---

## 10. useEffect vs useLayoutEffect

`useEffect` and `useLayoutEffect` have the exact same API shape — same arguments, same cleanup behavior — but they differ in **timing**, which matters more than it sounds like.

```
useEffect:        render -> browser PAINTS -> effect runs (asynchronous, after paint)
useLayoutEffect:  render -> effect runs (synchronous, BEFORE paint) -> browser PAINTS
```

`useEffect` fires *after* the browser has already drawn the screen. This is what you want almost all of the time — your side effect doesn't block the user from seeing the update.

`useLayoutEffect` fires *before* the browser paints, synchronously, blocking the paint until it finishes. Use this only when you need to measure or mutate the DOM in a way that must happen *before the user ever sees a visual flicker* — for example, measuring an element's size and repositioning it based on that measurement, where using `useEffect` would cause a visible one-frame "jump."

**Rule of thumb:** default to `useEffect`. Only reach for `useLayoutEffect` if you have a real, observable flicker problem caused by a DOM read/write that needs to happen before paint. Using `useLayoutEffect` everywhere "just in case" makes your app slower, since it blocks the browser from painting until your effect finishes.

---

## 11. Common Mistakes

### Mistake 1 — the infinite loop

```jsx
function BadCounter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(count + 1); // sets state...
  }, [count]); // ...which is also the dependency that re-triggers this effect

  return <h1>{count}</h1>;
}
```

Walk through it: the effect sets `count`, which changes `count`, which is a dependency, so the effect runs again, which sets `count` again... forever. Your component re-renders in a tight, endless loop, and the browser tab typically freezes or the app crashes.

**The fix:** if you truly need to update state in response to a dependency changing, add a condition that eventually stops:

```jsx
useEffect(() => {
  if (count < 5) {
    setCount(count + 1);
  }
}, [count]); // now it stabilizes once count reaches 5
```

Or — often better — ask whether this even needs to be an effect at all (see Mistake 3 below).

### Mistake 2 — missing cleanup, causing leaks and duplicate subscriptions

```jsx
useEffect(() => {
  window.addEventListener('resize', handleResize);
  // no cleanup! the old listener is never removed
}, []);
```

Every time this component mounts (say, it's inside a list item that gets remounted, or a modal that opens/closes), a new listener gets attached, and none of the old ones are ever removed. Over time, `handleResize` fires multiple times for a single resize event, and if `handleResize` refers to props/state from a now-unmounted component instance, that's also a memory leak — the old closure and the DOM node it references can't be garbage collected while the listener still exists.

**The fix:** always return a cleanup function whenever the effect creates a subscription, timer, or listener:

```jsx
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

A good habit: whenever you write an effect that "sets something up," immediately ask "how would I undo this?" before moving on.

### Mistake 3 — using useEffect for something that should just be computed during render

This one is subtle, and it's an overuse anti-pattern that even experienced developers fall into.

```jsx
function FullName({ firstName, lastName }) {
  const [fullName, setFullName] = useState('');

  // Unnecessary! This causes an extra re-render for no reason.
  useEffect(() => {
    setFullName(`${firstName} ${lastName}`);
  }, [firstName, lastName]);

  return <h1>{fullName}</h1>;
}
```

There's no side effect here at all — no network call, no subscription, no DOM API. `fullName` is a pure derivation of `firstName` and `lastName`. Running it in an effect means: render once with an empty/stale `fullName`, then render *again* after the effect fires with the correct value. That's a wasted render, and a brief flash of wrong content.

**The fix:** just compute it directly in the render body — no hook needed at all:

```jsx
function FullName({ firstName, lastName }) {
  const fullName = `${firstName} ${lastName}`;
  return <h1>{fullName}</h1>;
}
```

The general rule: **if a value can be calculated purely from existing props/state, calculate it during render — don't stash it in state and "sync" it with an effect.** Reach for `useEffect` only when you're doing something that genuinely reaches outside of React: network calls, subscriptions, timers, manual DOM manipulation, or logging/analytics.

---

## 12. Hands-On Exercises

**Exercise 1 — Dependency array forms**

Write three separate `useEffect` calls in one component that has `count` and `name` state: one that runs after every render (no array), one that runs only once on mount, and one that runs only when `count` changes (not when `name` changes). Add a `console.log` in each to verify the behavior by triggering different state updates.

**Exercise 2 — Cleanup with an interval**

Build a `Stopwatch` component that starts a `setInterval` counting seconds on mount, has a "Pause" button, and properly cleans up the interval both when paused and when the component unmounts. Verify (using console logs) that pausing and unpausing doesn't create multiple overlapping intervals.

**Exercise 3 — Data fetching with cancellation**

Build a `SearchResults` component that fetches `/api/search?q=<query>` whenever a `query` prop changes. Implement cancellation using `AbortController` so that if the user types quickly (causing `query` to change before the previous fetch resolves), only the response for the *latest* query ever gets applied to state.

**Exercise 4 — Fix the stale closure**

Given this buggy code:

```jsx
function Logger({ userId }) {
  useEffect(() => {
    const id = setInterval(() => {
      console.log(`Watching user: ${userId}`);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return null;
}
```

Explain, in your own words, what goes wrong when `userId` changes from `1` to `2` while this component stays mounted. Then fix it.

**Exercise 5 — Find the anti-pattern**

Given this component:

```jsx
function Cart({ items }) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setTotal(items.reduce((sum, item) => sum + item.price, 0));
  }, [items]);

  return <p>Total: ${total}</p>;
}
```

Identify why this is an unnecessary use of `useEffect`, and rewrite it without the hook.

**Exercise 6 — useLayoutEffect flicker**

Build a `Tooltip` component that measures its own width after mounting (using a `ref` and `getBoundingClientRect()`) and repositions itself so it never overflows off the right edge of the screen. Implement it first with `useEffect` and describe what visual glitch you'd expect on a slow render, then switch it to `useLayoutEffect` and explain why the glitch disappears.

---

## 13. Interview Q&A

**Q1: What is useEffect for, in one sentence?**

A: `useEffect` lets a component run "side effects" — code that reaches outside of rendering, like data fetching, subscriptions, timers, or manual DOM manipulation — after the component has rendered and the browser has painted, rather than during the render calculation itself.

---

**Q2: Explain the three forms of the dependency array and when each runs.**

A: No array at all means the effect runs after every render, unconditionally. An empty array `[]` means the effect runs exactly once, right after the first render (mount), and never again except its cleanup on unmount. An array with values, like `[a, b]`, means the effect runs after the first render and again any time `a` or `b` is different from its value in the previous render, using a shallow (`Object.is`) comparison.

---

**Q3: What does the cleanup function do, and exactly when does React call it?**

A: The cleanup function is whatever function you return from inside your effect. React calls it in two situations: right before running the effect again (if a dependency changed since the last run), and when the component unmounts entirely. Its job is to undo whatever the effect set up — unsubscribing, clearing a timer, removing an event listener — so you don't get duplicate subscriptions or memory leaks.

---

**Q4: Why does React run effects after the browser paints instead of during rendering?**

A: So that side effects — which can be slow (network calls, heavy DOM reads) — don't block the user from seeing the visual update. React commits the new UI to the DOM and lets the browser paint it first; only after that does it run effects. This keeps the app feeling responsive even if an effect takes a while to complete.

---

**Q5: What is a stale closure, and how does it relate to useEffect?**

A: A stale closure happens when a function (like the callback inside a `setInterval` in an effect) captures a prop or state value from the render it was created in, and that captured value never updates because the effect wasn't re-run with the new value. It's caused by omitting a variable from the dependency array even though the effect body actually uses it — the effect then keeps operating on outdated data indefinitely.

---

**Q6: What does the exhaustive-deps ESLint rule check for, and why shouldn't you just silence it?**

A: It statically analyzes the effect function and flags any variable from component scope that the effect reads but that isn't listed in the dependency array. Silencing the warning (or removing the variable instead of fixing the real problem) doesn't make the bug go away — it just hides the warning while leaving a stale closure bug in place, which typically surfaces later as confusing, hard-to-reproduce behavior.

---

**Q7: How do you avoid an infinite loop caused by an effect that sets state which is also its own dependency?**

A: Either add a condition inside the effect that stops updating once some terminal condition is reached, or — better — question whether the state update needs to happen in an effect at all. If the new value can be derived from existing props/state, compute it directly during render instead of syncing it through `useState` + `useEffect`, which removes the loop risk entirely.

---

**Q8: Why is it wrong to fetch data directly in the component's render body instead of inside useEffect?**

A: Rendering is supposed to be a pure calculation of what the UI should look like, and it can happen multiple times for reasons unrelated to needing fresh data (e.g., a parent re-rendering, React's internal scheduling, Strict Mode's double-invoke in development). Firing a network request directly during render means every one of those renders triggers a new request, with no control over when it actually should re-fetch. `useEffect` lets you control precisely when the fetch happens via the dependency array.

---

**Q9: How do you prevent a "setState on an unmounted component" warning when fetching data?**

A: Use a cleanup mechanism tied to the effect. The preferred approach is an `AbortController`: create one inside the effect, pass its `signal` to `fetch`, and call `controller.abort()` in the cleanup function — this actually cancels the in-flight request. A simpler fallback is a mounted boolean flag that's set to `false` in the cleanup and checked before calling `setState`, though this doesn't cancel the underlying request, just ignores its result.

---

**Q10: What's the difference between useEffect and useLayoutEffect?**

A: Both have the identical API, but they differ in timing. `useEffect` runs asynchronously, after the browser has painted the screen. `useLayoutEffect` runs synchronously, before the browser paints, blocking the paint until it finishes. Use `useLayoutEffect` only when you need to measure or mutate the DOM in a way that must be visually correct before the user ever sees a frame — otherwise `useEffect` is the right default, since it doesn't block rendering.

---

**Q11: A component's effect subscribes to a WebSocket connection based on a `roomId` prop. Walk through what happens when `roomId` changes.**

A: React re-renders the component with the new `roomId`. Because `roomId` is in the effect's dependency array and its value changed, React first runs the cleanup function from the *previous* effect run — disconnecting from the old room. Then it runs the effect again with the new `roomId`, establishing a fresh connection to the new room. This ensures you're never connected to two rooms at once and never leak the old connection.

---

**Q12: Why does React Strict Mode run effects twice in development?**

A: To help developers catch effects that don't clean up properly after themselves. Strict Mode deliberately simulates mount -> unmount -> remount once on initial mount (running the effect, then its cleanup, then the effect again) purely in development — never in production. If your effect and cleanup are written correctly, this double-run is harmless; if it causes visible bugs (like duplicated subscriptions or doubled counters), that reveals a missing or incorrect cleanup function, not a bug in React itself.

---

**Q13: Give an example of using useEffect when you shouldn't have, and explain the fix.**

A: Deriving a `fullName` state value from `firstName` and `lastName` props via `useEffect` + `setFullName` is unnecessary — it causes an extra render (once with a stale/empty value, then again after the effect fires) purely to compute something that could be calculated directly. The fix is to just compute `const fullName = \`${firstName} ${lastName}\`` inline during render, with no `useState` or `useEffect` involved at all. The rule of thumb: only use `useEffect` for things that reach outside of React (network, subscriptions, timers, manual DOM work), not for deriving values from existing props/state.

---

**Q14: Why might including an object or array literal in the dependency array cause an effect to run on every render, even if its contents look the same?**

A: React compares dependency array values using `Object.is`, which for objects and arrays compares by reference, not by deep value equality. If you create a new object or array literal inline on every render (e.g., `{ sort: 'asc' }` written directly in the JSX or component body), it's a structurally different reference every time, even though its contents never change — so React always sees it as "changed" and re-runs the effect. The fix is typically to memoize that value (e.g., with `useMemo`), depend on its primitive fields directly, or move the literal outside the component if it's truly constant.

---

**Q15: What's the functional update form of setState, and how does it help avoid stale closures inside effects like intervals?**

A: Instead of `setCount(count + 1)`, which reads the `count` value captured by the closure at the time the effect was created, `setCount(prevCount => prevCount + 1)` receives the actual latest state value directly from React when the update is applied, regardless of what the closure captured. This lets an interval or timeout set up once (with an empty dependency array) keep working correctly indefinitely, without needing to depend on — and constantly recreate the timer around — the state value it's updating.

---

> **Memory hook:** "Render describes the picture. useEffect goes and does the errands after the picture is painted — and always cleans up after itself before running the next errand."
