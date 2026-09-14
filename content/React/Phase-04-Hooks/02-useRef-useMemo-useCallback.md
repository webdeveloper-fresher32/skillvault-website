# 02 — useRef, useMemo, useCallback

> "Not every re-render is a problem. Not every value needs to be memoized. The skill isn't knowing these hooks exist — it's knowing when reaching for them actually helps."

---

## Table of Contents

1. [useRef — Escaping the Render Cycle](#1-useref--escaping-the-render-cycle)
   - 1.1 [Problem 1: Touching the Real DOM](#11-problem-1-touching-the-real-dom)
   - 1.2 [Problem 2: A Value That Survives Renders Without Causing One](#12-problem-2-a-value-that-survives-renders-without-causing-one)
   - 1.3 [useRef Internals](#13-useref-internals)
   - 1.4 [useRef vs useState](#14-useref-vs-usestate)
2. [useMemo — Caching a Calculation](#2-usememo--caching-a-calculation)
   - 2.1 [The Problem](#21-the-problem)
   - 2.2 [How useMemo Decides](#22-how-usememo-decides)
   - 2.3 [Referential Equality and React.memo](#23-referential-equality-and-reactmemo)
3. [useCallback — Caching a Function](#3-usecallback--caching-a-function)
   - 3.1 [The Problem](#31-the-problem)
   - 3.2 [useCallback Is Just useMemo In Disguise](#32-usecallback-is-just-usememo-in-disguise)
   - 3.3 [Breaking useEffect Dependency Loops](#33-breaking-useeffect-dependency-loops)
4. [Comparison Table](#4-comparison-table)
5. [The Overuse Warning — When NOT to Use These](#5-the-overuse-warning--when-not-to-use-these)
6. [Common Mistakes](#6-common-mistakes)
7. [Interview Answer: useMemo vs useCallback](#7-interview-answer-usememo-vs-usecallback)
8. [A Note on the React Compiler](#8-a-note-on-the-react-compiler)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. useRef — Escaping the Render Cycle

Let's start with a sentence you should hold onto for this entire section:

> "`useRef` gives you a box that survives between renders, but writing to that box never triggers a render."

That's it. That's the whole hook. Everything below is just two different situations where "a box that quietly survives" turns out to be exactly what you need.

---

### 1.1 Problem 1: Touching the Real DOM

Here's a very ordinary requirement: when a form loads, put the cursor in the first input automatically. The user shouldn't have to click it first.

In plain JavaScript, this is trivial:

```js
document.getElementById("email").focus();
```

But in React, you don't usually reach into the DOM by ID like that — React is busy managing the DOM *for* you, and constantly querying `document.getElementById` fights against that model. You need a React-native way to say "give me a handle to the actual DOM node this JSX renders."

That's exactly what `useRef` does here.

```jsx
import { useRef, useEffect } from "react";

function LoginForm() {
  const emailInputRef = useRef(null);

  useEffect(() => {
    emailInputRef.current.focus();
  }, []);

  return (
    <form>
      <input ref={emailInputRef} type="email" placeholder="Email" />
      <input type="password" placeholder="Password" />
    </form>
  );
}
```

Walk through what just happened:

```
1. useRef(null) creates a ref object: { current: null }
2. That ref is attached to the <input> via the `ref` attribute
3. After React mounts the DOM, it sets ref.current = <the actual input DOM node>
4. Our useEffect runs after mount, and emailInputRef.current is now
   a real HTMLInputElement — so .focus() works exactly like plain JS
```

The `ref` attribute is the bridge. Any DOM element can take a `ref`, and after that element mounts, `ref.current` points straight at it.

**Other things you'll do with this exact pattern:**

```jsx
// Measure an element's size after it renders
const boxRef = useRef(null);
useEffect(() => {
  console.log(boxRef.current.getBoundingClientRect());
}, []);

// Scroll a container to the bottom (e.g. a chat window)
const listRef = useRef(null);
useEffect(() => {
  listRef.current.scrollTop = listRef.current.scrollHeight;
}, [messages]);

// Play/pause a video imperatively
const videoRef = useRef(null);
const handlePlay = () => videoRef.current.play();
```

Notice the theme: focusing, measuring, scrolling, playing — none of these are things you can express by just rendering different JSX. They're *imperative* actions you perform *on* an already-rendered DOM node. That's precisely the gap `useRef` fills.

> **Memory hook:** "`ref={...}` is a name tag you stick on a DOM element so you can find it in the crowd later."

---

### 1.2 Problem 2: A Value That Survives Renders Without Causing One

Here's a completely different scenario. You're building a "click me rapidly" button that logs how many times it's been clicked — but you do *not* want that click count to show up in the UI, and you definitely don't want it triggering extra re-renders.

Or maybe you're storing a `setTimeout` ID so you can cancel it later. Or you want to remember "what was the previous value of this prop" for a comparison. None of these values need to be *displayed*. They just need to *persist* between renders.

Your first instinct might be `useState`:

```jsx
function Timer() {
  const [timeoutId, setTimeoutId] = useState(null);

  const startTimer = () => {
    const id = setTimeout(() => console.log("done"), 1000);
    setTimeoutId(id); // this triggers a re-render — for what benefit?
  };
  // ...
}
```

But storing the timeout ID in state means calling `setTimeoutId` re-renders the entire component, just to remember a number nobody displays. That's wasted work.

**The fix: use a ref instead of state.**

```jsx
import { useRef } from "react";

function Timer() {
  const timeoutIdRef = useRef(null);

  const startTimer = () => {
    timeoutIdRef.current = setTimeout(() => console.log("done"), 1000);
    // no re-render happened — and that's exactly what we want
  };

  const cancelTimer = () => {
    clearTimeout(timeoutIdRef.current);
  };

  return (
    <div>
      <button onClick={startTimer}>Start</button>
      <button onClick={cancelTimer}>Cancel</button>
    </div>
  );
}
```

Changing `timeoutIdRef.current` is silent — React has no idea it happened, and no re-render is scheduled. The value is still there next time the component re-renders (for some other reason), sitting in the same box, exactly where you left it.

**A second classic example — tracking a render count, or "the previous value":**

```jsx
function PriceTicker({ price }) {
  const previousPriceRef = useRef(price);
  const renderCountRef = useRef(0);

  renderCountRef.current = renderCountRef.current + 1;

  const direction =
    price > previousPriceRef.current ? "up" :
    price < previousPriceRef.current ? "down" : "same";

  useEffect(() => {
    previousPriceRef.current = price; // stash it for next time, after this render is committed
  });

  return (
    <p>
      ${price} ({direction}) — rendered {renderCountRef.current} times
    </p>
  );
}
```

`previousPriceRef` remembers what the price *was* on the last render, purely so this render can compare "old vs new" and decide the arrow direction — all without needing a second piece of state and a second re-render just to track history.

> **Memory hook:** "A ref is a sticky note on your desk — you can scribble on it any time, and it's still there tomorrow, but sticking a note never rings a bell to tell anyone the room changed. `useState` rings the bell. `useRef` doesn't."

---

### 1.3 useRef Internals

`useRef(initialValue)` returns one single object, and that object is the *same* object across every re-render:

```js
{ current: initialValue }
```

```text
┌───────────────────────────────────────────────────────────┐
│                  useRef, render after render               │
│                                                              │
│  Render 1: const ref = useRef(0)                            │
│            React internally creates { current: 0 }          │
│            and stores it on the fiber (the component's      │
│            internal bookkeeping node)                       │
│                                                              │
│  ref.current = 5   ← mutated directly, no setter function   │
│                                                              │
│  Render 2 (triggered by something else entirely):            │
│            const ref = useRef(0)                             │
│            React returns the *same* object from before,      │
│            ignoring the "0" you passed — { current: 5 }      │
│                                                              │
│  The object's IDENTITY never changes across renders.         │
│  Only .current changes, and that never schedules a render.  │
└───────────────────────────────────────────────────────────┘
```

Two things fall directly out of this:

1. `useRef(0)` only actually uses `0` on the *very first* render. Every render after that, React just hands you back the exact same object it already built — your `initialValue` argument is ignored on renders 2, 3, 4...
2. Because it's a plain mutable object, you can read and write `.current` anywhere — inside event handlers, inside effects, even inside the render body itself (though mutating during render is unusual and should be done carefully, as in the price-ticker example above where we only write inside an effect).

---

### 1.4 useRef vs useState

Put side by side, the difference is one sentence: **state changes cause a re-render, ref changes don't.**

```jsx
function Comparison() {
  const [stateCount, setStateCount] = useState(0);
  const refCount = useRef(0);

  const bumpState = () => setStateCount(c => c + 1); // re-renders, UI updates
  const bumpRef = () => { refCount.current += 1; };   // silent, UI does NOT update

  return (
    <div>
      <p>State count: {stateCount}</p>
      <p>Ref count: {refCount.current}</p> {/* stays stale until something ELSE re-renders */}
      <button onClick={bumpState}>Bump state</button>
      <button onClick={bumpRef}>Bump ref (won't visibly update)</button>
    </div>
  );
}
```

Click "Bump ref" ten times in a row — the number on screen won't move, because nothing told React to re-render. Click "Bump state" once, and it updates instantly. This is the entire lesson of `useRef`: it's for values your *logic* needs, not values your *UI* needs to show.

---

## 2. useMemo — Caching a Calculation

### 2.1 The Problem

Picture a component that filters and sorts a list of ten thousand products every time it renders:

```jsx
function ProductList({ products, searchTerm }) {
  const [theme, setTheme] = useState("light");

  const visibleProducts = products
    .filter(p => p.name.includes(searchTerm))
    .sort((a, b) => a.price - b.price);

  return (
    <div className={theme}>
      <button onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>
        Toggle theme
      </button>
      {visibleProducts.map(p => <ProductRow key={p.id} product={p} />)}
    </div>
  );
}
```

Here's the annoying part: clicking "Toggle theme" has *nothing to do with* `products` or `searchTerm`. But because it's a state update, the whole component re-renders — and that means `.filter().sort()` runs again, from scratch, over all ten thousand products, purely to produce the exact same list it produced last time.

That's wasted CPU work, and if the list is big enough, it's a visible UI stutter every time you toggle something totally unrelated.

**The fix:** tell React "only redo this expensive work if its actual inputs changed."

```jsx
import { useMemo, useState } from "react";

function ProductList({ products, searchTerm }) {
  const [theme, setTheme] = useState("light");

  const visibleProducts = useMemo(() => {
    return products
      .filter(p => p.name.includes(searchTerm))
      .sort((a, b) => a.price - b.price);
  }, [products, searchTerm]); // only recompute when THESE change

  return (
    <div className={theme}>
      <button onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>
        Toggle theme
      </button>
      {visibleProducts.map(p => <ProductRow key={p.id} product={p} />)}
    </div>
  );
}
```

Now toggling the theme re-renders the component (as it must — `theme` changed), but the filter-and-sort work is *skipped*, because `products` and `searchTerm` are exactly what they were last time. React just hands back the cached array from the previous render.

**The analogy that makes this stick:** think of `useMemo` as writing down the answer to a hard math problem on a sticky note, along with the numbers you used to get there. Next time someone asks you the same question with the same numbers, you just read the sticky note instead of doing the long division again. Only when the input numbers actually change do you pick the pencil back up.

**Basic shape:**

```js
const memoizedValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);
```

- First argument: a function that computes and *returns* a value.
- Second argument: the dependency array — the values that, when changed, mean "the cached answer is no longer valid, please recompute."

---

### 2.2 How useMemo Decides

```text
┌─────────────────────────────────────────────────────────────────┐
│                  useMemo, on every render                        │
│                                                                    │
│   Component re-renders for ANY reason                            │
│              |                                                    │
│              v                                                    │
│   React looks at the dependency array you passed THIS render     │
│   and compares it, item by item, to the array from the LAST      │
│   render (using Object.is, the same check React uses everywhere) │
│              |                                                    │
│      ------------------------                                    │
│      |                       |                                    │
│  All deps are            At least one dep                        │
│  the same as              is different                            │
│  last time                                                        │
│      |                       |                                    │
│      v                       v                                   │
│  SKIP the function     RUN the function again,                  │
│  Return the CACHED      cache the new return value,               │
│  value from last        return the new value                    │
│  render                                                            │
└─────────────────────────────────────────────────────────────────┘
```

The comparison is shallow — React checks "is this the same reference / primitive value as last time," not "did anything deep inside this object change." That's important: if `products` is a brand-new array reference every render (even if it holds identical items), `useMemo` will treat it as changed and recompute anyway. Memoization is only as good as the stability of what you feed it.

---

### 2.3 Referential Equality and React.memo

Here's the second, arguably more common reason people reach for `useMemo` — it's not about CPU time at all, it's about **object identity**.

```jsx
const ExpensiveChart = React.memo(function ExpensiveChart({ config }) {
  console.log("ExpensiveChart rendering...");
  return <canvas>{/* imagine heavy drawing logic here */}</canvas>;
});

function Dashboard({ data }) {
  const [count, setCount] = useState(0);

  // 🚨 A brand-new object, with a brand-new reference, on EVERY render
  const chartConfig = { data, color: "blue" };

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Clicked {count} times</button>
      <ExpensiveChart config={chartConfig} />
    </div>
  );
}
```

`ExpensiveChart` is wrapped in `React.memo`, which is supposed to skip re-rendering it when its props haven't *meaningfully* changed. But `{ data, color: "blue" }` creates a *new object* every single render — `chartConfig` on render 1 and `chartConfig` on render 2 are `===` false, even though their contents look identical. `React.memo`'s shallow prop comparison sees "different reference" and re-renders `ExpensiveChart` anyway. Clicking the unrelated counter button re-renders the expensive chart every time. `React.memo` is completely defeated.

**Fix it with useMemo:**

```jsx
function Dashboard({ data }) {
  const [count, setCount] = useState(0);

  const chartConfig = useMemo(
    () => ({ data, color: "blue" }),
    [data] // only a new object when `data` itself actually changes
  );

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Clicked {count} times</button>
      <ExpensiveChart config={chartConfig} />
    </div>
  );
}
```

Now, clicking the counter button re-renders `Dashboard`, but `chartConfig` keeps returning the *same object reference* as before (because `data` hasn't changed), so `React.memo` correctly sees "same props" and skips re-rendering `ExpensiveChart` entirely.

> **Memory hook:** "`useMemo` is a sticky note with yesterday's answer taped to it — read the note instead of redoing the math, as long as the question hasn't changed."

---

## 3. useCallback — Caching a Function

### 3.1 The Problem

Every time a component re-renders, every function *declared inside it* is recreated from scratch — it's a brand new function object in memory, even if the code inside looks byte-for-byte identical to the previous render's function.

Usually that's harmless. But it becomes a real problem in two specific situations.

**Situation 1 — it breaks `React.memo` on a child, exactly like the object problem above:**

```jsx
const SearchButton = React.memo(function SearchButton({ onSearch }) {
  console.log("SearchButton rendering...");
  return <button onClick={onSearch}>Search</button>;
});

function SearchBar({ query }) {
  const [count, setCount] = useState(0);

  // 🚨 A new function reference every render
  const handleSearch = () => {
    console.log("Searching for:", query);
  };

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Unrelated: {count}</button>
      <SearchButton onSearch={handleSearch} />
    </div>
  );
}
```

Same story as `useMemo` and objects: `handleSearch` is a new function every render, so `React.memo` on `SearchButton` never sees "unchanged props," and the memoization is pointless.

**Situation 2 — it causes a `useEffect` to fire on every render, or even loop forever:**

```jsx
function SearchResults({ query }) {
  const [results, setResults] = useState([]);

  // 🚨 New function reference every render
  const fetchResults = () => {
    fetch(`/api/search?q=${query}`).then(r => r.json()).then(setResults);
  };

  useEffect(() => {
    fetchResults();
  }, [fetchResults]); // fetchResults is "different" every render...
  // ...so this effect re-runs on EVERY render, refetching every time,
  // which is at best wasteful and at worst an infinite request loop
  // if fetchResults itself triggers a state update that causes a re-render.

  return <ul>{results.map(r => <li key={r.id}>{r.name}</li>)}</ul>;
}
```

Because `fetchResults` is a new reference every render, and it's listed as a dependency, React sees "a dependency changed" on every single render and reruns the effect every single time. That's the exact bug `useCallback` is built to prevent.

**The fix:**

```jsx
import { useCallback, useEffect, useState } from "react";

function SearchResults({ query }) {
  const [results, setResults] = useState([]);

  const fetchResults = useCallback(() => {
    fetch(`/api/search?q=${query}`).then(r => r.json()).then(setResults);
  }, [query]); // same function reference unless `query` changes

  useEffect(() => {
    fetchResults();
  }, [fetchResults]); // now this only reruns when `query` actually changes

  return <ul>{results.map(r => <li key={r.id}>{r.name}</li>)}</ul>;
}
```

Now `fetchResults` keeps the *same function reference* across renders as long as `query` hasn't changed, the effect's dependency array sees "nothing changed," and the effect only re-runs when it actually should.

**Basic shape:**

```js
const memoizedFn = useCallback(() => doSomething(a, b), [a, b]);
```

---

### 3.2 useCallback Is Just useMemo In Disguise

This is one of the most commonly asked interview facts about these two hooks, so let's make it completely explicit. `useCallback(fn, deps)` behaves *exactly* the same as calling `useMemo` and having it return the function itself, rather than the function's result:

```js
// These two lines do the same thing:
const memoizedFn = useCallback(fn, deps);
const memoizedFn = useMemo(() => fn, deps);
```

Read that carefully. `useMemo(() => fn, deps)` is: "here's a function that, when called, returns `fn` (the function itself, unexecuted)." That's precisely what `useCallback(fn, deps)` gives you too. `useCallback` is really just a convenience wrapper — a shorthand for the common case of memoizing a function reference, so you don't have to write `useMemo(() => fn, deps)` every time.

The core distinction between the two hooks in one line:

- `useMemo` memoizes **what a function returns** — the computed *value*.
- `useCallback` memoizes **the function itself** — the *reference*, unexecuted.

> **Memory hook:** "`useCallback` is like saving a friend's phone number in your contacts instead of asking them to repeat it and writing it down fresh every single time you want to call them. The *number* (the function) stays the same — you're not calling it yet, just holding onto a stable way to reach it later."

---

### 3.3 Breaking useEffect Dependency Loops

Worth calling out on its own: the `SearchResults` example above is one of the single most common real-world reasons `useCallback` gets used — not "performance" in the abstract, but concretely to stop a `useEffect` from re-running when it shouldn't. If you ever see a `useEffect` firing far more often than makes sense, and one of its dependencies is a function defined in the same component, `useCallback` (wrapped around that function, with the right dependency array) is very often the fix.

---

## 4. Comparison Table

| | `useRef` | `useMemo` | `useCallback` |
|---|---|---|---|
| **Returns** | A mutable object `{ current: value }` | A memoized **value** (the result of your function) | A memoized **function reference** (unexecuted) |
| **Recomputed when...** | Never automatically — you mutate `.current` yourself, whenever you want | Dependency array changes | Dependency array changes |
| **Causes a re-render when updated?** | No, never | N/A — computing it happens *during* a render that already occurred for another reason | N/A — same as useMemo |
| **Typical use** | DOM access, mutable instance variables (timers, previous values, counters) | Expensive calculations, stabilizing object/array references for `React.memo` or effect deps | Stabilizing function references for `React.memo` or effect deps |
| **Equivalent to** | — | — | `useMemo(() => fn, deps)` |

---

## 5. The Overuse Warning — When NOT to Use These

Here's something that trips up a lot of developers who've just learned about `useMemo` and `useCallback`: they start wrapping *everything* in them, "just in case." This is almost always a mistake, and it's worth understanding exactly why.

**These hooks are not free.** Every time you call `useMemo` or `useCallback`, React has to:

1. Store the previous dependency array and the previous cached value/function somewhere in memory.
2. On every render, run a comparison across every item in the dependency array.
3. Only *then* decide whether to skip the work or redo it.

For a cheap calculation — say, `const total = price * quantity` — the cost of *comparing dependencies and checking the cache* can genuinely be more expensive than just recalculating the value directly. You've added bookkeeping overhead to save time on work that barely took any time in the first place. That's a net loss, not a win.

```jsx
// 🚨 Overkill — multiplying two numbers is not "expensive"
const total = useMemo(() => price * quantity, [price, quantity]);

// ✅ Just do this
const total = price * quantity;
```

There's also a real readability cost. Every `useMemo` and `useCallback` you add is one more dependency array a future reader (including future you) has to double-check for correctness. Get a dependency array wrong — miss a value, or include a value that changes too often — and you've introduced a stale-closure bug or defeated the memoization entirely, either of which is harder to spot than plain, un-memoized code would have been.

**So when is it actually worth it?** Two situations, and really only two:

1. **You measured a real performance problem.** You profiled the app (React DevTools Profiler, or just watching the UI visibly stutter), found a specific calculation that's genuinely slow (sorting/filtering large datasets, complex geometry, heavy string parsing), and confirmed it's re-running more than necessary.
2. **You have a real referential-equality requirement.** You're passing a prop into a component wrapped in `React.memo` and need the reference to stay stable across renders, or you're putting a value into a `useEffect` (or another hook's) dependency array and need it to *not* change on every render.

Outside of those two cases, plain values and plain functions are simpler, faster to read, and just as fast to run. "Wrap it in `useMemo`, just in case" is not a performance strategy — it's usually a pessimization dressed up as an optimization.

> **Memory hook:** "Don't buy insurance on a paperclip. Memoization has a cost too — only pay it when the thing you're protecting is actually expensive."

---

## 6. Common Mistakes

**Mistake 1 — Memoizing everything "just in case."**

Covered at length above, but it bears repeating as a "mistake" in its own right: wrapping every value and every function in `useMemo`/`useCallback` regardless of whether there's a measured problem. It adds overhead and noise without a corresponding benefit.

**Mistake 2 — Forgetting that `useCallback` returns a function, not a value.**

```jsx
// 🚨 Wrong — this makes `result` a function, not the calculated total
const result = useCallback(() => a + b, [a, b]);
console.log(result); // logs the function itself, not a + b

// ✅ Right — you need to CALL it, or use useMemo instead
const result = useMemo(() => a + b, [a, b]);
console.log(result); // logs the actual sum
```

If what you want is *a value*, reach for `useMemo`. If what you want is *a function you'll call later* (typically as an event handler or effect dependency), reach for `useCallback`. Mixing the two up is one of the most common beginner errors with these hooks.

**Mistake 3 — Mutating `ref.current` and expecting the screen to update.**

```jsx
function Counter() {
  const countRef = useRef(0);

  const increment = () => {
    countRef.current += 1; // 🚨 the UI below will NEVER update from this alone
  };

  return (
    <div>
      <p>Count: {countRef.current}</p>
      <button onClick={increment}>+1</button>
    </div>
  );
}
```

Click that button all day — the number on screen stays frozen at `0`, because changing `.current` never tells React to re-render. If you want the *screen* to reflect a changing value, that value needs to live in `useState` (or trigger a re-render some other way). Reach for `useRef` only when you're deliberately choosing *not* to re-render.

**Mistake 4 — An empty or wrong dependency array on `useMemo`/`useCallback`.**

```jsx
// 🚨 `query` is used inside, but missing from the deps array —
// this function will keep using the FIRST query forever, even after it changes
const search = useCallback(() => {
  fetch(`/api/search?q=${query}`);
}, []); // should be [query]
```

This is the exact same "stale closure" trap covered for `useEffect` — any value read inside the memoized function that can change over time needs to be listed as a dependency, or the memoized version keeps referring to old data forever.

---

## 7. Interview Answer: useMemo vs useCallback

This is one of the most frequently asked React hook questions, so it's worth having a tight, one-paragraph answer ready:

> "`useMemo` and `useCallback` both take a function and a dependency array, and both skip re-computation when the dependencies haven't changed since the last render — the difference is purely in *what gets cached*. `useMemo` calls the function you give it and caches its *return value*, so you use it when you want to avoid re-running an expensive calculation or to keep an object/array reference stable across renders. `useCallback` does not call the function at all — it caches the *function reference itself*, so you use it when you want to avoid re-running effects that depend on that function, or to avoid breaking a `React.memo`-wrapped child that receives the function as a prop. In fact, `useCallback(fn, deps)` is exactly equivalent to `useMemo(() => fn, deps)` — `useCallback` is really just a shorthand for the specific, common case of memoizing a function."

---

## 8. A Note on the React Compiler

As of recent React versions, the React team has been building the **React Compiler** — a build-time tool that analyzes your component code and automatically inserts memoization (conceptually similar to what `useMemo`/`useCallback`/`React.memo` do by hand) wherever it determines it's safe and useful to do so. The intent is that, over time, developers will need to reach for manual `useMemo`/`useCallback` far less often, because the compiler handles the common cases automatically.

That said, as of this writing the React Compiler is still in an emerging, gradually-rolling-out state across the ecosystem — plenty of codebases you'll work in (and most existing production code) are not using it yet, and understanding *why* and *when* `useMemo`/`useCallback` matter is still very much a core, expected React skill (and a near-certain interview topic) regardless of whether the compiler eventually reduces how often you write them by hand yourself.

---

## 9. Hands-On Exercises

**Exercise 1 — Autofocus and Measurement with useRef**

Build a `<Modal>` component that, the moment it opens, automatically focuses its first input, and also logs the modal's rendered width and height to the console (using `getBoundingClientRect()`). Use exactly one `useRef` for the DOM node and one `useEffect` to perform both actions after mount.

**Exercise 2 — A Stopwatch Using useRef for the Timer ID**

Build a `<Stopwatch>` component with Start, Stop, and Reset buttons, and a running `seconds` count displayed on screen (this part *does* need `useState`, since it must visibly update). Store the `setInterval` ID itself in a `useRef` — not `useState` — and explain in a comment why a ref is the right choice for the interval ID specifically, while `seconds` is not.

**Exercise 3 — Fixing a Broken React.memo with useMemo**

You're given this code:

```jsx
const UserCard = React.memo(function UserCard({ user }) {
  console.log("UserCard rendered for", user.name);
  return <div>{user.name} — {user.email}</div>;
});

function App() {
  const [tick, setTick] = useState(0);
  const user = { name: "Priya", email: "priya@example.com" };

  return (
    <div>
      <button onClick={() => setTick(t => t + 1)}>Tick: {tick}</button>
      <UserCard user={user} />
    </div>
  );
}
```

Clicking the button re-renders `UserCard` every time, even though `user`'s actual contents never change. Fix it using `useMemo`, and explain in one sentence why `React.memo` alone wasn't enough.

**Exercise 4 — Fixing a useEffect That Fires Too Often**

You're given this code:

```jsx
function Weather({ city }) {
  const [temp, setTemp] = useState(null);

  const loadWeather = () => {
    fetch(`/api/weather?city=${city}`).then(r => r.json()).then(d => setTemp(d.temp));
  };

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  return <p>{city}: {temp}°</p>;
}
```

Every re-render of `Weather` (for any reason at all) re-fetches the weather, even when `city` hasn't changed. Fix it with `useCallback` so the effect only fires when `city` actually changes.

**Exercise 5 — useMemo vs. Just Computing It**

Given this component:

```jsx
function OrderSummary({ items }) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  return <p>Total: ${total.toFixed(2)}</p>;
}
```

Decide, and justify in writing: does *any* line here genuinely need `useMemo`? Under what circumstance (think: size of `items`, or what else the component renders) would wrapping `subtotal`'s calculation in `useMemo` actually be worth the overhead? Under what circumstance would it clearly not be?

**Exercise 6 — Previous Value Tracking**

Build a `<PriceAlert price={number}>` component that displays "Price went up!" or "Price went down!" compared to the previous render's price, using a `useRef` to remember the previous value (mirroring the `PriceTicker` pattern from Section 1.2). Explain why `useState` would be the wrong tool here if all you need is to *remember* the last value for a comparison, not display it directly.

---

## 10. Interview Q&A

**Q1: What are the two distinct use cases for `useRef`?**

A: (1) Accessing a real DOM node directly — for example, calling `.focus()`, `.scrollIntoView()`, or measuring an element with `getBoundingClientRect()` — by attaching the ref to a JSX element's `ref` attribute. (2) Holding a mutable value across renders that your application logic needs but your UI does not need to display — like a timer ID, a previous prop value, or a render counter — without triggering a re-render when that value changes.

---

**Q2: What is the key difference between `useRef` and `useState`?**

A: Updating state via its setter schedules a re-render, and the new value is available starting from the next render. Updating a ref's `.current` property is a plain, synchronous mutation that never schedules a re-render — the component keeps showing whatever it last rendered, even though the ref's value has changed underneath it.

---

**Q3: Does calling `useRef(initialValue)` reset the ref back to `initialValue` on every render?**

A: No. `initialValue` is only used on the very first render, to create the `{ current: initialValue }` object. On every subsequent render, React returns the exact same object it created the first time, ignoring whatever you pass as the argument — the object's identity is stable across the component's entire lifetime.

---

**Q4: What problem does `useMemo` solve?**

A: It prevents an expensive calculation from re-running on every render when its inputs haven't actually changed. `useMemo(() => computeExpensiveValue(a, b), [a, b])` reruns the function only when `a` or `b` change since the last render; otherwise it returns the cached result from before.

---

**Q5: What problem does `useCallback` solve?**

A: It gives a function a stable reference across renders, so it doesn't get recreated (and therefore treated as "changed") on every render. This matters in two situations: (1) passing a function as a prop to a child wrapped in `React.memo`, where a new function reference every render would defeat the memoization; (2) listing a function as a dependency in a `useEffect` (or similar hook), where a new reference every render would cause the effect to re-run every render.

---

**Q6: Is `useCallback(fn, deps)` equivalent to any expression written with `useMemo`?**

A: Yes — `useCallback(fn, deps)` is exactly equivalent to `useMemo(() => fn, deps)`. `useMemo` here is given a function that, when called, simply returns `fn` unexecuted; that's precisely what `useCallback` produces. `useCallback` is a convenience shorthand for this specific, very common pattern.

---

**Q7: What does `useMemo` memoize, versus what `useCallback` memoizes?**

A: `useMemo` memoizes the *return value* of the function you give it — it calls the function and caches the result. `useCallback` memoizes the *function itself* — it never calls the function; it just hands back the same function reference as long as the dependencies haven't changed.

---

**Q8: Why might wrapping every value in `useMemo` "just in case" actually hurt performance?**

A: `useMemo` isn't free — on every render, React has to store the previous dependency array and cached value, then compare each dependency to detect whether a recompute is needed. For a cheap operation (like multiplying two numbers), that bookkeeping can cost more than simply redoing the calculation directly. Overusing memoization can therefore make code both slower and harder to read, with no real benefit.

---

**Q9: Under what two circumstances is it actually worth reaching for `useMemo` or `useCallback`?**

A: (1) You've measured a genuine performance problem — profiling shows a specific calculation is slow and rerunning unnecessarily. (2) You have a real referential-equality requirement — the value or function needs a stable reference because it feeds into `React.memo` on a child component, or into another hook's dependency array (like `useEffect`), where a new reference every render would cause incorrect or excessive re-execution.

---

**Q10: What happens if you forget to update a value referenced inside a `useCallback`'s dependency array?**

A: You get a stale closure — the memoized function keeps a reference to the old value of that variable from whenever it was last recreated, even after the real value has changed elsewhere in the component. This is the same class of bug as a missing `useEffect` dependency, and it typically manifests as "this function seems to be using old data."

---

**Q11: If a component mutates `ref.current` inside its render body (not inside an effect or event handler), why is this generally discouraged?**

A: Mutating a ref during render is technically possible but risky, because React may render a component multiple times without committing (e.g., in Strict Mode's double-invocation for development, or with certain concurrent features), and the render body is supposed to be a pure function of props and state. Ref mutations are considered a side effect, and side effects belong in event handlers or `useEffect`, which are guaranteed to run in sync with the actual committed DOM, not merely a rendering attempt.

---

**Q12: How would you fix a `React.memo`-wrapped child that keeps re-rendering unnecessarily because its parent passes a new object literal as a prop every render?**

A: Wrap the object's construction in `useMemo` with the correct dependency array, so the same object reference is returned across renders as long as its actual inputs haven't changed. `React.memo`'s shallow prop comparison will then correctly detect "no change" and skip re-rendering the child.

---

**Q13: What is the React Compiler, and does it make `useMemo`/`useCallback` obsolete?**

A: The React Compiler is a build-time tool that analyzes component code and automatically applies memoization where it determines it's safe and beneficial, aiming to reduce how often developers need to write `useMemo`/`useCallback` by hand. It does not make understanding these hooks obsolete — it is still an emerging feature not universally adopted across existing codebases, and reasoning about referential equality and re-render costs remains a fundamental, frequently interviewed React skill.

---

**Q14: A `useEffect` depends on a function defined inside the same component and fires on every render even though its "real" dependency (say, a prop) rarely changes. What's the likely cause and fix?**

A: The function is being recreated fresh on every render, giving it a new reference each time, which the effect's dependency array detects as "changed" every render. The fix is to wrap the function in `useCallback` with a dependency array containing only the values it actually needs (like the prop), so its reference stays stable unless that prop changes, and the effect only reruns when appropriate.

---

**Q15: Give an example where `useRef` is the correct choice specifically because you do NOT want a re-render.**

A: Storing a `setInterval`/`setTimeout` ID so it can later be cleared. The ID itself is never displayed in the UI — it's purely bookkeeping needed by the component's logic (to call `clearInterval`/`clearTimeout` later). Storing it in `useState` would trigger a pointless re-render every time the timer starts, for a value nobody ever renders on screen; `useRef` stores it silently with zero re-render cost.
