# 03 — Custom Hooks

> "A custom hook is a recipe, not a shared kitchen. Every cook who follows it gets their own dish — nobody's eating off the same plate."

---

## Table of Contents

1. [The Problem: Duplicated Stateful Logic](#1-the-problem-duplicated-stateful-logic)
2. [The Naming Rule: Why It Must Start With `use`](#2-the-naming-rule-why-it-must-start-with-use)
3. [Building Your First Custom Hook, Step by Step](#3-building-your-first-custom-hook-step-by-step)
4. [The Rules of Hooks — and Why They Exist](#4-the-rules-of-hooks--and-why-they-exist)
5. [Internal Working: How React Tracks Hooks by Call Order](#5-internal-working-how-react-tracks-hooks-by-call-order)
6. [Full Example: `useFetch(url)`](#6-full-example-usefetchurl)
7. [Custom Hooks Don't Share State](#7-custom-hooks-dont-share-state)
8. [Composing Custom Hooks From Other Custom Hooks](#8-composing-custom-hooks-from-other-custom-hooks)
9. [Compare With Related Concepts](#9-compare-with-related-concepts)
10. [Common Mistakes](#10-common-mistakes)
11. [Interview Answer: Why Do the Rules of Hooks Exist?](#11-interview-answer-why-do-the-rules-of-hooks-exist)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. The Problem: Duplicated Stateful Logic

Let's start with a scenario you've probably lived through.

You're building a dashboard. One component needs to know the browser window's width, so it can switch between a mobile and desktop layout:

```jsx
function Dashboard() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width < 768 ? <MobileLayout /> : <DesktopLayout />;
}
```

Fine. Ships. Works.

A week later, the sidebar *also* needs to know the window width, for its own reason (collapsing itself on small screens):

```jsx
function Sidebar() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width < 768 ? null : <nav>...</nav>;
}
```

Look at that. You just copy-pasted `useState`, `useEffect`, the event listener, and the cleanup function — word for word — into a second component. And now there's a third component that wants the same thing. And a fourth.

**Here's the question that matters:** why can't you just pull this into a normal function, like you would with any other duplicated logic?

```js
// Tempting, but this DOES NOT work
function getWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth); // ❌ illegal here
  useEffect(() => { /* ... */ });
  return width;
}
```

Call `getWindowWidth()` from inside `Dashboard`, and React has no idea this function is even related to hooks — as far as the *rules* go, that's fine syntactically, but conceptually it's broken: a plain JavaScript function has no special relationship with React's rendering system. It doesn't get remembered between renders, it doesn't get "attached" to the calling component's state, it's just a function that happens to call other functions.

The truth is, `useState` and `useEffect` aren't really "callable" in the abstract sense — they only work because React is quietly tracking *which component is currently rendering* when they're called, and storing state that belongs to *that specific component instance*. A regular function extraction doesn't break this — but it doesn't give you anything useful either, unless React recognizes what's going on.

**Custom hooks are the actual solution.** A custom hook is just a JavaScript function — nothing magical about its runtime behavior — but by convention and by React's rules, it's allowed to call other hooks (`useState`, `useEffect`, `useRef`, or other custom hooks) and have that state "belong" to whichever component called it.

```js
// This works — because it's a hook, not a plain function
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}
```

Now both components shrink down to one line each:

```jsx
function Dashboard() {
  const width = useWindowWidth();
  return width < 768 ? <MobileLayout /> : <DesktopLayout />;
}

function Sidebar() {
  const width = useWindowWidth();
  return width < 768 ? null : <nav>...</nav>;
}
```

Same behavior. Zero duplication. And this is the whole point of custom hooks in one sentence:

> Custom hooks let you extract **stateful logic** — logic that depends on `useState`, `useEffect`, `useRef`, and friends — into a reusable function, in a way plain function extraction never could.

> **Memory hook:** "A recipe card, not a shared kitchen — anyone can follow it, but each cook still ends up with their own dish."

---

## 2. The Naming Rule: Why It Must Start With `use`

Here's a rule you'll see stated flatly in every React doc: **a custom hook's name must start with `use`.** `useWindowWidth`, `useFetch`, `useDebounce` — all fine. `getWindowWidth`, `windowWidthHook` — not fine, even if the code inside is identical.

At first this looks like a cosmetic naming convention, like `camelCase` vs `snake_case`. It isn't. It's load-bearing.

Here's why. React (and the ESLint plugin `eslint-plugin-react-hooks` that ships alongside it) needs to know, while looking at your code, *which function calls are hook calls* — because hook calls have special rules attached to them (you'll see the actual rules in Section 4). But at the level of plain JavaScript, there's no built-in way to distinguish "a function that calls `useState`" from "a function that doesn't." The linter can't run your code to find out. It has to guess from *how the function is named*.

So the React team made a deal with you: **if your function's name starts with `use`, the linter will treat it as a hook** — it will check that you're only calling it from the top level of a component or another hook, that you're not calling other hooks conditionally inside it, and so on. If your function doesn't start with `use`, the linter has no idea it needs to apply any of those checks, and violations slip through silently.

```js
// Named like a hook — linter enforces Rules of Hooks inside it
function useThing() {
  const [x, setX] = useState(0); // linter watches this
}

// NOT named like a hook — linter has no idea useState is even in play
function doThing() {
  const [x, setX] = useState(0); // linter can still flag this specific line,
  // but doThing() itself won't be checked for hook-calling-hook rules,
  // and other developers calling doThing() get zero signal that it's
  // secretly stateful and hook-restricted
}
```

So the `use` prefix isn't decoration — it's the flag that turns on the safety net. Skip it, and you lose the linter's ability to catch the mistakes described in Section 4.

---

## 3. Building Your First Custom Hook, Step by Step

Let's slow down and actually walk through the extraction process, rather than just showing the "after" picture.

**Step 1 — notice the duplication.** You have `Dashboard` and `Sidebar`, both containing this identical block:

```js
const [width, setWidth] = useState(window.innerWidth);

useEffect(() => {
  function handleResize() {
    setWidth(window.innerWidth);
  }
  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);
```

**Step 2 — write a new function, named with the `use` prefix, containing exactly that logic.**

```js
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}
```

Notice what didn't change: the `useState` call, the `useEffect` call, the event listener, the cleanup. You didn't rewrite the logic — you just wrapped it in a function and gave that function a `use`-prefixed name.

**Step 3 — decide what the hook returns.** In this case, just the current width value. Some hooks return a tuple (like `useState` itself does), some return an object, some return nothing at all (if the hook is purely a side-effect, like a "set the page title" hook).

**Step 4 — replace the duplicated block in each component with a single call.**

```jsx
function Dashboard() {
  const width = useWindowWidth();
  return width < 768 ? <MobileLayout /> : <DesktopLayout />;
}

function Sidebar() {
  const width = useWindowWidth();
  return width < 768 ? null : <nav>...</nav>;
}
```

**Step 5 — where does this function live?** Typically its own file, e.g. `useWindowWidth.js`, imported wherever it's needed — same as any other reusable module in your codebase.

That's genuinely the entire process. There's no special "create hook" API, no registration step, no config. A custom hook is a function, named with `use`, that calls other hooks. That's the full definition.

---

## 4. The Rules of Hooks — and Why They Exist

React ships with exactly two rules for hooks, and they apply equally to built-in hooks (`useState`, `useEffect`) and to your own custom hooks:

**Rule 1 — Only call hooks at the top level.** Never inside loops, never inside conditions, never inside nested functions.

```jsx
// ❌ Illegal — conditional hook call
function Profile({ userId }) {
  if (userId) {
    const [name, setName] = useState(""); // breaks the rule
  }
}

// ❌ Illegal — hook inside a loop
function List({ items }) {
  items.forEach(() => {
    useEffect(() => {}); // breaks the rule
  });
}

// ✅ Legal — hook always runs, condition happens *inside* it
function Profile({ userId }) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (userId) {
      // conditional logic INSIDE the hook is totally fine
    }
  }, [userId]);
}
```

**Rule 2 — Only call hooks from React function components, or from other custom hooks.** Never from a regular JavaScript function, a class component, or an event handler callback.

```js
// ❌ Illegal — regular utility function, not a component or hook
function formatUser(user) {
  const [x] = useState(0); // breaks the rule — this isn't a component or a hook
}

// ✅ Legal — this is itself a custom hook (name starts with `use`),
// and it's calling another hook
function useCurrentUser() {
  const [user, setUser] = useState(null);
  return user;
}
```

Both rules sound like arbitrary bureaucracy until you understand the mechanism behind them — which is exactly what Section 5 covers. Once you see *how* React actually implements hooks internally, both rules stop being "rules you must memorize" and become "the only possible way this could work."

---

## 5. Internal Working: How React Tracks Hooks by Call Order

This is the single most important fact in this entire file, so let's sit with it.

**React does not track your hooks by name.** It has no idea that a particular `useState` call is "the width state" versus "the loading state." What React actually does is much dumber, and much more mechanical: for each component instance, React keeps an internal, ordered list of "hook slots," and every time that component renders, it walks through that list *in order*, matching the Nth hook call in your code to the Nth slot in its internal list.

Here's what that looks like conceptually for a component that calls three hooks:

```text
Component instance: <Dashboard />
─────────────────────────────────────────────
React's internal hook list for THIS instance:

  Slot 0  →  useState(window.innerWidth)   →  value: 1024
  Slot 1  →  useEffect(resize listener)    →  cleanup fn stored
  Slot 2  →  useRef(someValue)             →  ref object

─────────────────────────────────────────────
Render #1:
  Call useState(...)  → React says "this is call #0, give it slot 0"
  Call useEffect(...) → React says "this is call #1, give it slot 1"
  Call useRef(...)    → React says "this is call #2, give it slot 2"

Render #2 (re-render, e.g. after setWidth fires):
  Call useState(...)  → React says "this is call #0 AGAIN, reuse slot 0"
  Call useEffect(...) → React says "this is call #1 AGAIN, reuse slot 1"
  Call useRef(...)    → React says "this is call #2 AGAIN, reuse slot 2"
```

React isn't reading your variable names (`width`, `setWidth`) to figure out which state is which — by the time React's internals are involved, that information doesn't even exist anymore. All React has is **"the call at position 0," "the call at position 1,"** and so on, for this specific component instance. Position is the *entire* identity of a hook call.

Now watch what happens the moment you make a hook call conditional:

```text
Render #1 (userId is truthy):
  Call useState(...)     → position 0 → slot 0 (some name state)
  Call useState(...)     → position 1 → slot 1 (some ANOTHER state, only called if userId)
  Call useEffect(...)    → position 2 → slot 2

Render #2 (userId is now falsy, so the second useState call is SKIPPED):
  Call useState(...)     → position 0 → slot 0 (fine, same as before)
  Call useEffect(...)    → position 1 → slot 1 !! ← WRONG SLOT

  React thinks this useEffect call is "the same call" as the
  useState call that used to live in slot 1. It hands the
  useEffect call the STATE STORAGE that was meant for a
  useState hook. Everything downstream is now corrupted —
  wrong values, wrong cleanup functions, silent bugs or hard
  crashes.
```

That's the mechanism. It's not that React is "being strict for no reason" — it's that the *entire hook system is built on the assumption that the same component always calls the same hooks, in the same order, every single render*. Break that assumption, and the slot-matching scheme has no way to recover — there's no name, no key, no identifier to fall back on. Position is all it has.

This is also exactly why **Rule 2** exists. A plain utility function can be called from anywhere, any number of times, in any order relative to other calls — there's no guarantee it participates in a component's fixed, ordered render cycle at all. Hooks only work because a component's body runs top-to-bottom, the same way, every render. Restricting hook calls to components and other hooks is what makes that guarantee hold.

---

## 6. Full Example: `useFetch(url)`

Let's build something a bit more substantial than `useWindowWidth` — a data-fetching hook, since "fetch data, track loading/error/data state" is probably the single most duplicated piece of stateful logic in any real React codebase.

**Before — duplicated in two components:**

```jsx
function UserProfile({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/users/${userId}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <div>{data.name}</div>;
}

function ProductDetails({ productId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/products/${productId}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <div>{data.title}</div>;
}
```

Same shape, twice. Only the URL and the field name (`data.name` vs `data.title`) differ.

**After — extracted into `useFetch`:**

```js
import { useState, useEffect } from "react";

function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Guards against setting state after the component unmounts,
    // or after a newer request has already started (a stale response
    // for an old URL arriving late).
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, error };
}

export default useFetch;
```

**Now both components collapse:**

```jsx
function UserProfile({ userId }) {
  const { data, loading, error } = useFetch(`/api/users/${userId}`);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <div>{data.name}</div>;
}

function ProductDetails({ productId }) {
  const { data, loading, error } = useFetch(`/api/products/${productId}`);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <div>{data.title}</div>;
}
```

The fetch logic, the `cancelled` guard, the loading/error bookkeeping — written once, tested once, fixed once when a bug shows up. Every component that needs remote data just calls `useFetch(url)` and gets back `{ data, loading, error }`.

---

## 7. Custom Hooks Don't Share State

Here's a misconception that trips up almost everyone the first time they use custom hooks, so let's be extremely explicit about it.

**Calling the same custom hook from two different components does NOT connect them.** Each call gets its own, completely independent copy of the state. There is no hidden shared store, no singleton, no "one `useFetch` for the whole app."

```jsx
function ComponentA() {
  const { data } = useFetch("/api/users/1");
  // this call's `data` state lives ONLY in ComponentA's hook slot
}

function ComponentB() {
  const { data } = useFetch("/api/users/1"); // same URL!
  // this is a COMPLETELY SEPARATE useState, useEffect, and fetch
  // request from ComponentA's — even though the URL is identical,
  // React does not deduplicate or share anything here
}
```

Go back to the recipe-card analogy from the top of this file: a recipe card is a set of instructions anyone can follow. Give the same card to two different cooks, and you get two separate dishes — not one dish that both cooks are somehow simultaneously stirring. `useFetch` is the recipe. `ComponentA` and `ComponentB` are the cooks. Each cook follows the same steps, but ends up with their own state, their own network request, their own independent lifecycle.

Why does this trip people up? Because in everyday programming, "shared function" often implies "shared data" — think of a singleton service, or a module-level cache. Custom hooks look similar on the surface (one function, called from multiple places) but behave completely differently: **the state lives with the caller, not with the hook.**

If you *do* want two components to see the same data — say, both should reflect the same logged-in user, updating in sync — a custom hook alone cannot do that. You need something that genuinely lives in one shared place: Context (Phase 6), a state management library, or lifting the state up to a common ancestor component and passing it down. The custom hook packages *behavior*, not a shared *data store*.

> **Common mistake to watch for:** assuming that because two components call `useWindowWidth()`, updating the width in one somehow updates it in the other. It doesn't — they're two entirely separate `useState` calls that happen to run identical code.

> **Memory hook:** "Same recipe, different pots — no cook is stirring anyone else's soup."

---

## 8. Composing Custom Hooks From Other Custom Hooks

Nothing stops a custom hook from calling other custom hooks — this is completely normal, and it's how more complex behavior gets built out of small, well-tested pieces.

Say you want a `useDebouncedFetch(url, delayMs)` hook — one that waits until the URL stops changing for a bit before firing the request (useful for a live search box, so you're not firing a request on every keystroke).

You already have `useFetch`. You just need a `useDebouncedValue` hook too:

```js
function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
```

Now compose them:

```js
function useDebouncedFetch(url, delayMs = 300) {
  const debouncedUrl = useDebouncedValue(url, delayMs);
  const result = useFetch(debouncedUrl);
  return result;
}
```

Used like this:

```jsx
function SearchResults({ query }) {
  const url = `/api/search?q=${encodeURIComponent(query)}`;
  const { data, loading, error } = useDebouncedFetch(url, 300);
  // fetch only fires 300ms after the user stops typing
}
```

Three hooks deep — `useDebouncedFetch` calls `useDebouncedValue` and `useFetch`, each of which calls `useState`/`useEffect` — and every single one of them still obeys the same two Rules of Hooks from Section 4, because at the bottom of the stack, it's always the same top-level, unconditional, ordered sequence of hook calls per render. Composition doesn't relax the rules; it just means there are more layers where the rules apply.

---

## 9. Compare With Related Concepts

It helps to see custom hooks next to the other "reusability" tools you'll meet across this repo, so you know which tool actually solves which problem.

| Tool | Can hold/reuse stateful logic (`useState`, `useEffect`)? | Can hold/reuse pure computation? | Renders UI itself? | Typical use |
|---|---|---|---|---|
| **Custom Hook** | Yes — this is its entire purpose | Yes | No — returns data/functions, not JSX | Sharing logic like `useFetch`, `useWindowWidth`, `useDebounce` |
| **Regular utility function** | No — cannot legally call hooks | Yes | No | Pure helpers: `formatDate()`, `sumTotals()` |
| **Higher-Order Component (HOC)** (Phase 11) | Indirectly — the HOC itself can use hooks internally and pass results as props | Yes | Yes — wraps and returns a new component | Cross-cutting concerns applied to a whole component, e.g. `withAuth(Component)` |
| **Render Props** (Phase 11) | Indirectly — the provider component can use hooks and expose results via a function-as-child | Yes | Yes — the wrapping component renders, and calls a render function you supply | Similar goal to HOCs, slightly different ergonomics |

The short version: a **regular function** can share logic, but never stateful logic — it has no way to call `useState`/`useEffect` and have that state belong to a component. A **custom hook** closes exactly that gap. **HOCs** and **render props** solve a related but different problem — they were the pre-hooks way of sharing cross-cutting *component* behavior (like "inject this prop into whatever you wrap"), and they do involve rendering, which a custom hook never does. In modern React, most of what used to require a HOC or render-props wrapper is written as a custom hook instead, because it's less nesting and easier to follow.

---

## 10. Common Mistakes

**Mistake 1 — calling a hook conditionally.**

```js
// ❌ Wrong
function useThing(shouldTrack) {
  if (shouldTrack) {
    useEffect(() => { /* track something */ }); // breaks call-order tracking
  }
}

// ✅ Right — always call the hook, move the condition inside it
function useThing(shouldTrack) {
  useEffect(() => {
    if (shouldTrack) {
      // track something
    }
  }, [shouldTrack]);
}
```

**Mistake 2 — assuming two calls to the same custom hook share state.** Covered in depth in Section 7 — worth repeating here because it's the single most common misconception with custom hooks. Each call is its own independent `useState`/`useEffect` instance. No hidden sharing, ever.

**Mistake 3 — forgetting the `use` prefix.** If you write `getWindowWidth()` but it internally calls `useState`, the ESLint Rules-of-Hooks plugin has no way of knowing it needs to check this function for hook violations. You lose your safety net silently — the code might even work today, until someone calls it conditionally and nothing warns them.

**Mistake 4 — calling a hook inside a loop over a dynamic list.**

```js
// ❌ Wrong — number of hook calls changes with items.length
function useAllWidths(items) {
  return items.map(() => useWindowWidth()); // illegal
}
```

If `items` has 3 elements on one render and 4 on the next, the number of hook calls changes between renders — exactly the call-order corruption described in Section 5. The fix is almost always to restructure so each item is its own component, and that component calls the hook once, unconditionally.

**Mistake 5 — putting a hook call inside an event handler or a plain callback passed to `.then()`/`.map()`/`setTimeout()`.**

```js
// ❌ Wrong
function useThing() {
  fetch("/api").then(() => {
    const [x] = useState(0); // not a component, not a hook — illegal, and won't even lint cleanly
  });
}
```

Hooks can only be called synchronously during the render of a component or another hook — never inside an asynchronous callback, timer, or promise handler.

---

## 11. Interview Answer: Why Do the Rules of Hooks Exist?

If you're asked this in an interview, here's a tight, complete answer:

"React doesn't track hook state by variable name or by any identifier in your source code — it tracks each hook call by its *position* in the sequence of hook calls made during a single render of a given component instance. Internally, React keeps an ordered list of 'hook slots' per component instance, and on every render it walks through your hook calls in the exact order they appear, matching call #0 to slot #0, call #1 to slot #1, and so on. This only works if the same component calls the same hooks, in the same order, on every single render. The Rules of Hooks — call hooks only at the top level, and only from components or other hooks — exist purely to guarantee that invariant. Call a hook conditionally, and on a render where the condition is false, every hook call after it shifts into the wrong slot, silently pairing the wrong state or effect with the wrong hook call. There's no name-based fallback to recover from that — position is the only identity the system has."

---

## 12. Hands-On Exercises

**Exercise 1 — Extract a duplicate.**

You have two components. `LoginForm` and `SignupForm` both contain this identical block for tracking whether the browser tab is currently focused:

```js
const [isFocused, setIsFocused] = useState(document.hasFocus());

useEffect(() => {
  const onFocus = () => setIsFocused(true);
  const onBlur = () => setIsFocused(false);
  window.addEventListener("focus", onFocus);
  window.addEventListener("blur", onBlur);
  return () => {
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("blur", onBlur);
  };
}, []);
```

Extract this into a `useWindowFocus()` custom hook and rewrite both components to use it.

**Exercise 2 — Build `useLocalStorage(key, initialValue)`.**

Write a custom hook that behaves like `useState`, but persists its value to `localStorage` under the given `key`, and reads the existing value back out on mount if one exists. It should return `[value, setValue]`, just like `useState`.

**Exercise 3 — Find the Rules-of-Hooks violation.**

```js
function useUserStatus(userId) {
  if (!userId) {
    return "unknown";
  }
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    fetchStatus(userId).then(setStatus);
  }, [userId]);
  return status;
}
```

Identify the violation, explain in your own words (using the call-order mechanism from Section 5) exactly what breaks when `userId` changes from falsy to truthy across renders, and rewrite it correctly.

**Exercise 4 — Prove hooks don't share state.**

Using `useFetch` from Section 6, render two `<UserProfile userId={1} />` components side by side on the same page. Add a `console.log` inside `useFetch`'s effect. Run it and observe: does the network request fire once or twice? Explain why, referencing Section 7.

**Exercise 5 — Compose two hooks.**

Build `useOnlineStatus()` (tracks `navigator.onLine`, updates on the `online`/`offline` window events) and then build `useSyncIndicator()`, which composes `useOnlineStatus()` and `useFetch("/api/sync-status")` to return a single string: `"offline"`, `"syncing"`, or `"synced"`.

**Exercise 6 — HOC vs custom hook.**

Take this legacy Higher-Order Component that injects a `theme` prop:

```jsx
function withTheme(Component) {
  return function ThemedComponent(props) {
    const theme = useContext(ThemeContext);
    return <Component {...props} theme={theme} />;
  };
}
```

Rewrite the same behavior as a custom hook `useTheme()` instead, and rewrite one consumer component to use it. Which version has less nesting in the component tree?

---

## 13. Interview Q&A

**Q1: What problem do custom hooks solve that a regular JavaScript function cannot?**

A: A regular function cannot call `useState`, `useEffect`, or other hooks and have that state "belong" to the calling component — plain functions have no participation in React's per-component, per-render hook tracking. Custom hooks solve this: they're ordinary functions that are *allowed* to call other hooks, letting you extract and reuse stateful logic (not just pure computation) across multiple components.

---

**Q2: Why must a custom hook's name start with `use`?**

A: It's not cosmetic — it's the signal that lets ESLint's `eslint-plugin-react-hooks` (and conceptually, React itself) know that this function calls hooks internally and therefore must obey the Rules of Hooks. Without the `use` prefix, the linter has no way to know it needs to check the function for conditional hook calls or other violations, and those bugs slip through silently.

---

**Q3: State the two Rules of Hooks.**

A: (1) Only call hooks at the top level of a function — never inside loops, conditions, or nested functions. (2) Only call hooks from React function components, or from other custom hooks — never from regular functions, class components, or callbacks like event handlers or promise `.then()` handlers.

---

**Q4: Why does React require hooks to be called in the same order on every render?**

A: Because React tracks each hook's state by its *position* in the sequence of hook calls for a given component instance, not by name. It keeps an ordered list of "hook slots" per instance and matches call #0 to slot #0, call #1 to slot #1, and so on, every render. If the order changes — for example, a hook call is skipped because of a conditional — every subsequent hook call shifts into the wrong slot, and React ends up pairing the wrong stored state or effect with the wrong hook call.

---

**Q5: Do two components calling the same custom hook share state?**

A: No. Each call to a custom hook creates its own, completely independent set of `useState`/`useEffect`/etc. calls, scoped to whichever component instance called it. There is no hidden shared store. If two components need to observe the *same* state, you need something that actually lives in one place — Context, a shared parent's state passed down as props, or a state management library — not a custom hook.

---

**Q6: Walk through building a `useWindowWidth` custom hook from scratch.**

A: Start with the duplicated logic in two components: a `useState(window.innerWidth)` call plus a `useEffect` that adds a `resize` listener, updates state on resize, and removes the listener on cleanup. Wrap that exact logic in a new function named `useWindowWidth`, return the `width` value, and replace the duplicated blocks in each component with a single `const width = useWindowWidth();` call.

---

**Q7: What is the difference between a custom hook and a Higher-Order Component?**

A: Both can package up reusable stateful behavior, but a HOC does it by wrapping a component and returning a new component (it renders something and injects props), adding a layer of nesting to the component tree. A custom hook is a plain function called from inside a component's body — it returns values or functions directly, and renders nothing itself, so it adds no extra nesting. Most logic-sharing that used to require a HOC is now written as a custom hook instead.

---

**Q8: Can a custom hook call other custom hooks?**

A: Yes — this is normal and encouraged. For example, `useDebouncedFetch(url, delay)` can be built by composing `useDebouncedValue(url, delay)` and `useFetch(debouncedUrl)`. As long as every hook in the chain still follows the Rules of Hooks (called unconditionally, at the top level), composition works cleanly at any depth.

---

**Q9: What happens if you call a hook inside a loop whose iteration count changes between renders?**

A: The number of hook calls changes between renders, which corrupts the call-order-to-slot mapping described in Q4 — hook calls after the loop shift into slots that belonged to different hooks on the previous render. The fix is usually to restructure the code so each loop item is rendered by its own component, and that component calls the hook exactly once per render, unconditionally.

---

**Q10: Give an example of a custom hook that wraps `useRef` and `useEffect` together.**

A: A `usePrevious(value)` hook: it keeps a `useRef` that stores the previous render's value, and a `useEffect` that updates that ref *after* each render. On the current render, before the effect runs, the ref still holds the value from the last render — so returning `ref.current` gives you "what this value was, one render ago." This is a common pattern for comparing current vs. previous props.

---

**Q11: Why can't you call a hook inside a `.then()` callback of a Promise?**

A: Hooks must be called synchronously during the render of a component or another hook, so React can track them by call position within that render. A `.then()` callback runs asynchronously, outside of any render pass — there's no "current render" for React to attach the hook call to, so it's not just against convention, it genuinely cannot work with how hooks are implemented.

---

**Q12: If `useFetch` is called with the exact same URL in two sibling components, does React deduplicate the network request?**

A: No, not by itself. Each call to `useFetch` is a fully independent hook invocation with its own `useState` and `useEffect` — React has no built-in request deduplication or caching between separate hook calls. If you need request deduplication or a shared cache across components, you'd reach for a data-fetching library (like React Query or SWR) or lift the fetch into a shared Context provider.

---

**Q13: What's a case where a plain utility function is the *right* choice instead of a custom hook?**

A: Anything that's pure computation with no need to call `useState`/`useEffect`/other hooks — for example, `formatCurrency(amount)`, `sumInvoiceLines(lines)`, or `slugify(title)`. Wrapping these in a custom hook (naming them `useFormatCurrency`, etc.) would add no value and would mislead other developers into thinking they carry state or side effects.

---

**Q14: In the internal hook-tracking model, what exactly identifies a given `useState` call to React?**

A: Its position in the ordered sequence of hook calls made during that component instance's current render — nothing else. Not the variable name you destructure it into, not the argument you pass, not where in the file the call appears relative to other functions. Only "this is the 3rd hook call in this component's render" matters, and that position must stay identical, render after render, for state to stay correctly matched up.

---

**Q15: You're reviewing a PR and see a function named `checkAuth()` that internally calls `useContext(AuthContext)`. What's wrong, and what's the fix?**

A: The function calls a hook (`useContext`) but isn't named with the `use` prefix, so `eslint-plugin-react-hooks` won't recognize it as a hook and won't enforce the Rules of Hooks on it — for example, if someone later calls `checkAuth()` conditionally or inside a loop, the linter won't catch it, and the call-order corruption described in Q4 becomes a live risk. The fix is simply to rename it to `useAuth()` (or similar), which both signals its nature to other developers and re-enables lint-time enforcement of the Rules of Hooks wherever it's used.
