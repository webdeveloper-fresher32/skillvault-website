# 02 — Event Handling

> "State tells your component what to remember. Events tell your component when to change its mind."

---

## Table of Contents

1. [The Problem: Talking to the User](#1-the-problem-talking-to-the-user)
2. [Basic Event Handler Syntax](#2-basic-event-handler-syntax)
   - 2.1 [Passing a Reference vs Calling a Function](#21-passing-a-reference-vs-calling-a-function)
   - 2.2 [Passing Arguments to a Handler](#22-passing-arguments-to-a-handler)
   - 2.3 [The Inline Arrow Function Performance Note](#23-the-inline-arrow-function-performance-note)
3. [SyntheticEvent — React's Wrapper Around the DOM](#3-syntheticevent--reacts-wrapper-around-the-dom)
   - 3.1 [Why React Wraps Native Events at All](#31-why-react-wraps-native-events-at-all)
   - 3.2 [What's Inside a SyntheticEvent](#32-whats-inside-a-syntheticevent)
   - 3.3 [Event Pooling — A Legacy Quirk](#33-event-pooling--a-legacy-quirk)
4. [How It Works Internally: Event Delegation](#4-how-it-works-internally-event-delegation)
5. [A Concrete Example: onClick and onChange Together](#5-a-concrete-example-onclick-and-onchange-together)
6. [Common Events at a Glance](#6-common-events-at-a-glance)
7. [Forms and preventDefault](#7-forms-and-preventdefault)
8. [Event Bubbling and stopPropagation](#8-event-bubbling-and-stoppropagation)
9. [Common Mistakes](#9-common-mistakes)
10. [Interview Answer: What Is SyntheticEvent?](#10-interview-answer-what-is-syntheticevent)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The Problem: Talking to the User

Think about the last app you used. A shopping cart. You clicked "Add to Cart." You typed your address into a form. You hit "Submit." Every single one of those moments was you, the human, doing something — and the app had to *notice*, and then *react*.

That's the whole problem event handling solves: **how does a React component find out that a user just did something, and run code in response?**

Without any of this, a component is just a static picture. `useState` (which you saw in the previous lesson) gives a component something to remember. But something still has to trigger the *change* to that memory. A counter that starts at `0` doesn't magically become `1` — a click has to say "go."

```
useState  →  gives the component a memory
events    →  give the component a reason to update that memory
```

They're a pair. In practice, you will almost never write a `useState` call without an event handler sitting right next to it, calling the setter.

---

## 2. Basic Event Handler Syntax

**Real-world analogy first.** Think of a doorbell. You don't wire the doorbell button directly to a bell that's already ringing — you wire it to a button that, *when pressed*, causes the bell to ring. The button doesn't do anything on its own. It waits.

That's exactly the relationship between a JSX element and an event handler. The button doesn't run your code just by existing on the page — it runs your code exactly when the browser tells it "I was clicked."

Here's the plain definition: an **event handler** is a function you attach to a JSX element via a special prop (`onClick`, `onChange`, `onSubmit`, and so on) that React calls automatically when that interaction happens.

```jsx
function Greeter() {
  function handleClick() {
    alert("Hello!");
  }

  return <button onClick={handleClick}>Say Hello</button>;
}
```

Read that `onClick={handleClick}` very carefully — no parentheses after `handleClick`. That's not a typo, and it's the single most important detail in this entire lesson. Let's slow down on it.

---

### 2.1 Passing a Reference vs Calling a Function

You are not telling React "run `handleClick()` right now." You are telling React "here's the function — hang onto it, and you call it, later, when the click actually happens."

```jsx
onClick={handleClick}     // ✅ pass the function itself (a reference)
onClick={handleClick()}   // ❌ CALLS the function immediately, during render
```

Say that second line out loud: `handleClick()` — with the parentheses — runs *the moment React renders this JSX*, not when the user clicks. React then takes whatever `handleClick()` *returns* (probably `undefined`, since most handlers don't return anything) and assigns that as the `onClick` prop instead.

So what actually happens if you make this mistake?

```
Render happens
    |
    v
JSX evaluates onClick={handleClick()}
    |
    v
handleClick() runs IMMEDIATELY (during render — wrong time!)
    |
    v
Its return value (often undefined) becomes the onClick prop
    |
    v
Now the button has onClick={undefined}
    |
    v
User clicks the button... and nothing happens.
```

This is, hands down, the most common beginner mistake in all of React event handling. It shows up in two flavors:

```jsx
// Flavor 1: forgetting you added parens
<button onClick={handleClick()}>Click me</button>

// Flavor 2: same mistake, but now it also fires an infinite loop
// because handleClick calls setState, which triggers a re-render,
// which calls handleClick() again during that render, forever.
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
  }

  // BUG: this calls setCount on every single render,
  // which schedules another render, which calls it again...
  return <button onClick={handleClick()}>{count}</button>;
}
```

We'll come back to this exact trap again in Section 9, because it deserves to be seen more than once before it truly sinks in.

> **Memory hook:** "Hand over the doorbell button, not a recording of it already being pressed." `onClick={handleClick}` hands over the button. `onClick={handleClick()}` hands over a recording — made once, during render, and never triggered by an actual click again.

---

### 2.2 Passing Arguments to a Handler

Now, what if you actually *need* to call the function with an argument — say, deleting item #3 from a list, and you need to tell the handler *which* item?

You can't write `onClick={deleteItem(3)}` — we just established that calls it immediately, during render. So how do you pass `3` along, but only at click time?

**The answer: wrap it in a new, inline arrow function.**

```jsx
function TodoItem({ id, text, onDelete }) {
  return (
    <li>
      {text}
      <button onClick={() => onDelete(id)}>Delete</button>
    </li>
  );
}
```

Look closely at what's happening. `() => onDelete(id)` is itself a function — a brand new one, defined right there in the JSX. *That* function is what gets passed to `onClick`. React doesn't call it during render (it's just a reference, same as before). It only gets called when the user actually clicks — and *at that point*, it runs its little body, which calls `onDelete(id)` with the `id` you captured.

```
onClick={() => onDelete(id)}
         ^^^^^^^^^^^^^^^^^^
         a NEW function, created fresh on every render,
         that — when eventually invoked by a click —
         calls onDelete with the argument you wanted
```

So the rule of thumb is simple:

```
No arguments needed?     onClick={handleClick}
Arguments needed?         onClick={() => handleClick(arg)}
```

---

### 2.3 The Inline Arrow Function Performance Note

Here's something sharp-eyed readers will notice: `() => onDelete(id)` creates a *brand new function* on every single render of `TodoItem`. Doesn't that mean a new function object gets allocated every time, even if nothing actually changed?

Yes — and for the overwhelming majority of apps, this cost is genuinely too small to matter. Creating a tiny closure is cheap; JavaScript engines are very good at it.

Where it *can* matter is when this button lives inside a child component wrapped in `React.memo()` — because a new function reference on every render means that child's props are never `===` equal to the previous render's props, which can defeat the memoization and cause re-renders you were trying to avoid.

That's a real, valid concern — but it's a **Phase 8 (Performance)** topic, where you'll learn `useCallback` and how to actually measure whether this matters for your specific component. For now, the takeaway is just: know that this tradeoff exists, don't panic about it, and don't go rewriting every handler to "optimize" it before you've actually measured a problem.

> Prematurely optimizing this is like reinforcing a bookshelf's screws before you've put a single book on it. Build first. Measure. Then reinforce only what actually creaks.

---

## 3. SyntheticEvent — React's Wrapper Around the DOM

### 3.1 Why React Wraps Native Events at All

Here's a problem you'd run into if you were writing raw, no-framework JavaScript in the 2010s: browsers didn't always agree on how events worked. Internet Explorer had its own event object shape, quirky property names, different ways of stopping propagation. Code that handled a click in Chrome might silently misbehave in IE.

**Real-world analogy:** imagine you run a call center that takes calls from customers speaking five different dialects. Instead of training every single agent to understand all five dialects, you hire one translator who converts every incoming call into one standard language before it reaches an agent. Agents only ever have to learn *one* format, no matter which dialect the customer originally spoke.

That translator is exactly what React's **SyntheticEvent** is. Whenever a real DOM event happens — a click, a keypress, a form submission — React doesn't hand your handler the raw, browser-specific native event. It wraps it in its own object, called a `SyntheticEvent`, that behaves *identically* across every browser React supports.

```
Native browser event (React w3c-noncompliant differences across browsers)
        |
        v
React wraps it into a SyntheticEvent
(same properties, same methods, everywhere)
        |
        v
Your handler receives the SyntheticEvent
```

Practically, this means you never have to write browser-sniffing code like "if this is IE, use `event.srcElement`, otherwise use `event.target`." You just always write `event.target`, and React guarantees it works.

### 3.2 What's Inside a SyntheticEvent

A `SyntheticEvent` looks and feels almost exactly like the native DOM event you already know, with the same familiar API:

```jsx
function SearchBox() {
  const [query, setQuery] = useState("");

  function handleChange(e) {
    console.log(e.target.value);   // the current input's value
    setQuery(e.target.value);
  }

  return <input value={query} onChange={handleChange} />;
}
```

The two properties/methods you'll reach for constantly:

- **`e.target`** — the DOM element the event actually happened on. For an `<input>`, `e.target.value` gives you the current text.
- **`e.preventDefault()`** — stops the browser's default behavior for that event (more on this in Section 7).

If you ever need the *actual* underlying native browser event — rare, but it happens, usually for some obscure browser-specific API — React gives you an escape hatch: `e.nativeEvent`.

> **Memory hook:** "One translator at the door, so every agent inside speaks the same language — no matter which dialect walked in."

### 3.3 Event Pooling — A Legacy Quirk

Here's a bit of React history that's worth knowing, mostly so old blog posts and Stack Overflow answers don't confuse you.

In React versions before 17, SyntheticEvent objects were **pooled** — meaning React reused the same event object across multiple events for performance reasons, and nulled out all its fields immediately after your handler function finished running. This meant code like this used to break:

```jsx
// This used to be BROKEN in React < 17
function handleClick(e) {
  setTimeout(() => {
    console.log(e.type);   // ❌ would log null — event was already "recycled"
  }, 1000);
}
```

You had to explicitly call `e.persist()` to opt an event out of pooling if you needed to hang onto it asynchronously.

**The good news: as of React 17, event pooling was removed entirely.** Modern React (17 and later, which includes every version you're likely using today) does not pool or recycle SyntheticEvents. You can freely access event properties inside a `setTimeout`, a promise callback, or anywhere else, with no special handling required. `e.persist()` still exists but is now a harmless no-op kept around for backward compatibility.

> If you're reading a tutorial that warns you about event pooling as if it's an active concern — that tutorial is describing pre-2020 React. It's a legacy quirk, not something you need to design around today.

---

## 4. How It Works Internally: Event Delegation

Here's a question worth asking: if you have a to-do list with 500 items, each with its own "Delete" button, does React attach 500 separate click listeners to the DOM — one per button?

No. And this is a deliberate, clever design decision called **event delegation**.

**Real-world analogy:** imagine an apartment building with 500 individual mailboxes. Instead of stationing a security guard at every single mailbox, the building puts *one* guard at the front door. Every visitor has to pass through that one door, and the guard figures out — based on who they say they're visiting — which mailbox the event is actually "for."

```
┌─────────────────────────────────────────────────────────┐
│                    Browser DOM tree                      │
│                                                            │
│   React 17+: ONE listener attached at the root container │
│   (the element you called createRoot() / render() on)    │
│                                                            │
│         root                                              │
│          |                                                │
│         ul (todo list)                                    │
│        / | \                                              │
│      li  li  li     <- 500 of these                       │
│      |    |    |                                          │
│    button button button   <- each has onClick in JSX,     │
│                                but NO listener actually    │
│                                attached here directly      │
└─────────────────────────────────────────────────────────┘

User clicks button #347
        |
        v
Native click event fires, bubbles up through the DOM tree
        |
        v
React's ONE root-level listener catches it
        |
        v
React looks at which virtual element the click originated from
        |
        v
React calls YOUR onClick handler for button #347 specifically
```

A quick historical note: before React 17, this single listener was attached to `document` itself. Starting with React 17, React moved it down to attach at the **root DOM container** you render into — the element you pass to `createRoot()` — instead of `document`. This change made it easier to embed multiple React versions/apps side-by-side on one page without them fighting over `document`-level listeners. The *concept* of one delegated listener rather than one-per-element hasn't changed; only its exact attachment point has, and only since 17.

Why go to all this trouble? Performance and memory. Attaching 500 native DOM listeners is measurably more expensive — memory-wise and setup-wise — than attaching one, and letting the browser's natural event bubbling do the routing work. You get to write `onClick={handleDelete}` on every single button as if each one had its own listener, and React handles the plumbing so it behaves that way — without actually paying that cost underneath.

---

## 5. A Concrete Example: onClick and onChange Together

Let's put this all together in one small, realistic component — a live character counter for a tweet-style input box.

```jsx
import { useState } from "react";

function TweetBox() {
  const [text, setText] = useState("");
  const maxLength = 280;

  function handleChange(e) {
    setText(e.target.value);
  }

  function handleClear() {
    setText("");
  }

  const remaining = maxLength - text.length;

  return (
    <div>
      <textarea
        value={text}
        onChange={handleChange}
        maxLength={maxLength}
        placeholder="What's happening?"
      />
      <p>{remaining} characters remaining</p>
      <button onClick={handleClear}>Clear</button>
    </div>
  );
}
```

Walk through what happens on every keystroke:

```
User types a character
        |
        v
Browser fires a native "input" event on the <textarea>
        |
        v
React's delegated listener catches it, wraps it as a SyntheticEvent
        |
        v
React calls handleChange(e)
        |
        v
e.target.value  →  the textarea's current full text
        |
        v
setText(e.target.value)  →  schedules a re-render
        |
        v
Component re-renders, "remaining" recalculates, <p> updates
```

And clicking "Clear" is even simpler — `handleClick` takes no argument, so it's passed by plain reference: `onClick={handleClear}`, no parentheses, no wrapping arrow function needed.

---

## 6. Common Events at a Glance

You don't need to memorize every event React supports (there are dozens) — but these handful cover the vast majority of real UI code you'll ever write.

| Event Prop | Fires When | Typically Attached To |
|---|---|---|
| `onClick` | An element is clicked | `<button>`, `<a>`, `<div>`, basically anything |
| `onChange` | An input's value changes | `<input>`, `<textarea>`, `<select>` |
| `onSubmit` | A form is submitted (button click or Enter key) | `<form>` |
| `onKeyDown` | A key is pressed down | `<input>`, or any focusable element |
| `onKeyUp` | A key is released | `<input>`, or any focusable element |
| `onFocus` | An element gains focus | `<input>`, `<textarea>`, `<button>` |
| `onBlur` | An element loses focus | `<input>`, `<textarea>` |
| `onMouseEnter` | The pointer enters an element's bounds | `<div>`, cards, tooltips |
| `onMouseLeave` | The pointer leaves an element's bounds | `<div>`, cards, tooltips |

A quick note on naming: React events are always written in **camelCase** (`onClick`, not `onclick`), which is a small but deliberate departure from raw HTML attributes (`onclick`). This is your first hint, in every single piece of JSX you write, that you're not writing HTML — you're writing something that *looks* like HTML but compiles to JavaScript function calls underneath.

---

## 7. Forms and preventDefault

Try this experiment mentally: you have a `<form>` with a submit button. The user fills it in and clicks "Submit," or just hits Enter. What does the browser do, by default, the instant that happens?

It reloads the page. That's the browser's default behavior for form submission — it's been that way since the 1990s, back when forms genuinely did POST to a server and get a fresh page back.

In a React app, you almost never want that. Your JSX-rendered UI would get wiped out and the whole page would flash and reload — losing all your component state in the process.

**The fix:** call `e.preventDefault()`, right at the top of your submit handler.

```jsx
function LoginForm() {
  const [email, setEmail] = useState("");

  function handleSubmit(e) {
    e.preventDefault();      // stop the browser's default full-page reload
    console.log("Submitting:", email);
    // ...send this to your API, update state, etc.
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit">Log In</button>
    </form>
  );
}
```

Notice `onSubmit` lives on the `<form>` element itself — not on the button. This matters: a `<form>`'s submit event fires whether the user clicks a `type="submit"` button *or* just presses Enter while focused inside the form. If you only attached a click handler to the button, pressing Enter would skip your logic entirely.

This is exactly the same `preventDefault()` idea you'll dig into much more deeply in **Phase 9 (Forms & Validation)** — this lesson is just giving you the event-handling half of the picture.

---

## 8. Event Bubbling and stopPropagation

Native DOM events **bubble** — meaning an event fired on a deeply nested element travels back up through every one of its ancestors, triggering their handlers too, unless something stops it.

```jsx
function Card() {
  function handleCardClick() {
    console.log("Card clicked");
  }

  function handleButtonClick(e) {
    e.stopPropagation();          // stop the bubble here
    console.log("Button clicked");
  }

  return (
    <div onClick={handleCardClick} style={{ padding: 20, border: "1px solid" }}>
      Card content
      <button onClick={handleButtonClick}>Click just me</button>
    </div>
  );
}
```

Without `e.stopPropagation()`, clicking the button would log **both** "Button clicked" and "Card clicked" — because the click event, after triggering the button's own handler, keeps bubbling upward and also triggers the enclosing `<div>`'s `onClick`.

```
Click lands on <button>
        |
        v
button's onClick fires  →  "Button clicked" logged
        |
        v
(without stopPropagation) event keeps bubbling up the tree
        |
        v
div's onClick fires too  →  "Card clicked" logged
```

Recall Section 4: React delegates listening to one root element, using the DOM's natural bubbling to figure out which handlers should fire, in order, from the innermost element outward. That's precisely *why* `e.stopPropagation()` still works exactly as you'd expect, even though your handler isn't attached directly to the DOM node — React is faithfully replaying the same bubble-based semantics you'd get with native listeners, just funneled through its one delegated root listener.

---

## 9. Common Mistakes

**Mistake 1 — Calling the handler instead of passing it (worth repeating one more time).**

```jsx
// ❌ WRONG — runs immediately during render
<button onClick={handleClick()}>Click</button>

// ✅ RIGHT — passes a reference, runs later, on click
<button onClick={handleClick}>Click</button>

// ✅ RIGHT — need to pass an argument? wrap it
<button onClick={() => handleClick(someId)}>Click</button>
```

By now you've seen this three separate times in this lesson. That's deliberate — it's the single mistake that trips up nearly every beginner at least once, usually manifesting as "my button does nothing" or, worse, "my app is stuck in an infinite render loop."

**Mistake 2 — Forgetting `preventDefault()` on a form, and wondering why the page flashes/reloads.**

```jsx
// ❌ Missing preventDefault — full page reload on submit
function handleSubmit(e) {
  console.log("submitting...");
}

// ✅ Correct
function handleSubmit(e) {
  e.preventDefault();
  console.log("submitting...");
}
```

**Mistake 3 — Reading `e.target.value` after an async gap, in very old React code, without `e.persist()`.**

This one is dead in modern React (17+) — SyntheticEvents are no longer pooled, so `e.target.value` remains valid even inside a `setTimeout` or `.then()`. But if you ever see `e.persist()` calls scattered through an old codebase, now you know exactly what problem they were guarding against.

**Mistake 4 — Attaching `onClick` to a non-interactive element and forgetting accessibility.**

```jsx
// Works, but a screen reader / keyboard user can't easily trigger this
<div onClick={handleClick}>Submit</div>

// Better — buttons are keyboard-accessible and semantically correct by default
<button onClick={handleClick}>Submit</button>
```

`<div>`s and `<span>`s don't get keyboard focus or Enter/Space activation for free the way `<button>` does. If you must use a non-button element as a click target, you'd need to add `tabIndex={0}` and an `onKeyDown` handler for Enter/Space — extra work that a real `<button>` gives you automatically.

---

## 10. Interview Answer: What Is SyntheticEvent?

If an interviewer asks "what is a SyntheticEvent in React, and why does it exist," here's a crisp, complete answer:

"A SyntheticEvent is a cross-browser wrapper that React creates around the native DOM event, with the same interface — `target`, `preventDefault()`, `stopPropagation()`, and so on — regardless of which browser triggered it. React introduced this so developers never have to write browser-specific event-handling code; you write one consistent handler and React guarantees consistent behavior everywhere. Internally, React attaches a single listener at the root of your app (previously at `document`, moved to the root container as of React 17) rather than one native listener per element, using event bubbling to figure out which component's handler to invoke — a technique called event delegation, which is far more memory-efficient than attaching thousands of individual DOM listeners. Historically, before React 17, these SyntheticEvent objects were pooled and nulled out right after the handler ran, requiring `e.persist()` if you needed to access them asynchronously — but that pooling was removed in React 17, so modern React SyntheticEvents behave like ordinary objects you can reference at any time."

---

## 11. Hands-On Exercises

**Exercise 1 — Fix the Bug**

The following component is broken — the counter increments on its own, infinitely, without any click. Find the bug and fix it.

```jsx
function BrokenCounter() {
  const [count, setCount] = useState(0);

  function increment() {
    setCount(count + 1);
  }

  return <button onClick={increment()}>{count}</button>;
}
```

**Exercise 2 — Delete Button with an Argument**

You have an array of `{ id, name }` objects rendered as a list. Write a `<li>` for each one with a "Remove" button that calls `onRemove(id)` when clicked — using the correct inline arrow function syntax so the id is captured correctly for each item.

**Exercise 3 — A Controlled Search Input**

Build a `SearchBar` component with a single `<input>`. Use `useState` to track its value, and an `onChange` handler that reads `e.target.value`. Add a "Clear" button that resets the value back to an empty string, using a plain function reference (no arrow-function wrapping needed).

**Exercise 4 — Form Submission**

Build a `FeedbackForm` with a `<textarea>` and a submit button inside a `<form>`. On submit: call `e.preventDefault()`, log the current textarea value to the console, and then clear the textarea. Verify the page does NOT reload when you submit.

**Exercise 5 — Stop the Bubble**

Build a `Card` component: an outer `<div>` with an `onClick` that logs `"card clicked"`, containing an inner `<button>` with its own `onClick` that logs `"button clicked"` and calls `e.stopPropagation()`. Click the button and confirm only `"button clicked"` logs. Then remove `stopPropagation()` and confirm both log, in the correct bubbling order.

**Exercise 6 — Keyboard Accessibility**

Take the `<div onClick={...}>Submit</div>` example from Mistake 4 in Section 9. Rewrite it as an accessible custom clickable element using a `<div>` with `role="button"`, `tabIndex={0}`, and both `onClick` and `onKeyDown` handlers (triggering on Enter or Space). Then compare how much simpler the same behavior is if you'd just used a real `<button>`.

---

## 12. Interview Q&A

**Q1: What's the difference between `onClick={handleClick}` and `onClick={handleClick()}`?**

A: `onClick={handleClick}` passes a *reference* to the function — React holds onto it and calls it later, when the click actually happens. `onClick={handleClick()}` immediately *invokes* `handleClick` during render, and whatever it returns (usually `undefined`) becomes the `onClick` prop instead. This is the most common beginner mistake in React event handling, and if `handleClick` calls a state setter, it can also trigger an infinite re-render loop.

---

**Q2: How do you pass an argument to an event handler in JSX?**

A: Wrap the call in an inline arrow function: `onClick={() => handleClick(someArg)}`. The arrow function itself is what gets passed to `onClick` as a reference; it isn't invoked until the click occurs, at which point it runs its body and calls `handleClick` with the captured argument.

---

**Q3: What is a SyntheticEvent?**

A: A cross-browser wrapper React creates around native DOM events, exposing a consistent API (`target`, `preventDefault()`, `stopPropagation()`, etc.) regardless of which browser fired the underlying event. It exists so developers don't have to write browser-specific event-handling logic.

---

**Q4: Does React still pool/reuse SyntheticEvent objects?**

A: No, not since React 17. Before React 17, SyntheticEvents were pooled for performance and their fields were nulled out right after your handler ran, so accessing them asynchronously (e.g., in a `setTimeout`) required calling `e.persist()` first. As of React 17, event pooling was removed entirely; SyntheticEvents behave like normal objects you can reference at any later point.

---

**Q5: How does React attach event listeners under the hood — one per element, or something else?**

A: React uses event delegation: it attaches a single listener at the root DOM container (the element passed to `createRoot()`), rather than attaching a native listener to every individual element with an `onClick`/`onChange`/etc. prop. When a native event bubbles up to that root, React inspects where it originated and dispatches to the correct component's handler. This is far cheaper in memory and setup cost than one listener per element.

---

**Q6: Where was React's delegated root listener attached before React 17, and what changed?**

A: Before React 17, the single delegated listener was attached to the `document` object. Starting in React 17, React moved it down to the actual root DOM container the app renders into. This makes it possible to embed multiple versions of React, or multiple independent React apps, on the same page without their root-level event listeners interfering with each other.

---

**Q7: Why do you need `e.preventDefault()` in a form's `onSubmit` handler?**

A: By default, submitting an HTML form triggers the browser's native behavior of reloading the page (a holdover from traditional server-rendered form submissions). In a React single-page app, that reload would wipe out all component state and the in-memory UI. Calling `e.preventDefault()` at the top of the submit handler stops that default behavior so your JavaScript can handle the submission instead.

---

**Q8: Why attach `onSubmit` to the `<form>` element instead of `onClick` on the submit button?**

A: A form's submit event fires both when a `type="submit"` button is clicked *and* when the user presses Enter while focused in the form. If you only used `onClick` on the button, pressing Enter would bypass your handler entirely. `onSubmit` on the `<form>` catches both trigger paths.

---

**Q9: What does `e.stopPropagation()` do, and why does it still work given React's delegation model?**

A: It stops a native event from continuing to bubble up to ancestor elements once the current handler has run. Even though React attaches only one physical listener at the root, it faithfully replicates the DOM's natural bubbling order when dispatching to component handlers — so calling `stopPropagation()` inside an inner element's handler still prevents an outer element's handler from firing, exactly as it would with native listeners.

---

**Q10: What common events would you use for a text input versus a form versus a button?**

A: A text `<input>` typically uses `onChange` (value updates) and sometimes `onFocus`/`onBlur`/`onKeyDown`. A `<form>` uses `onSubmit`. A `<button>` (or clickable element) uses `onClick`. Matching the event to the element it's semantically meant for avoids missing trigger paths, like the Enter-key case in Q8.

---

**Q11: Why does React use camelCase for event props (`onClick`) instead of lowercase HTML attribute names (`onclick`)?**

A: JSX props are just JavaScript object properties, not literal HTML attributes, and JavaScript convention is camelCase. This naming also signals, at a glance, that `onClick={handleClick}` compiles down to a function assignment in React's internal representation, not a literal HTML attribute the browser parses directly.

---

**Q12: Is it expensive to create a new inline arrow function on every render for event handlers, like `onClick={() => onDelete(id)}`?**

A: In the vast majority of components, no — creating a small closure is cheap and not something to worry about. It can matter specifically when the element receiving that handler is a child wrapped in `React.memo()`, because a new function reference every render defeats prop-equality memoization checks and can cause unnecessary re-renders. That specific optimization, using `useCallback` to stabilize the function reference, is covered in the Performance phase — it should only be reached for after measuring an actual problem, not applied preemptively everywhere.

---

**Q13: What happens internally, step by step, when a user clicks a button with an `onClick` handler in a list of 100 items?**

A: The native click event fires on the actual DOM button and bubbles upward. React's single delegated listener at the root container catches it. React determines, from its internal fiber tree, which component's `onClick` prop corresponds to the element the event originated on, wraps the native event in a SyntheticEvent, and invokes your handler with that SyntheticEvent as its argument — all without a dedicated native listener having been attached to that specific button.

---

**Q14: What's wrong with `<div onClick={handleClick}>Submit</div>` from an accessibility standpoint?**

A: A plain `<div>` isn't natively focusable or keyboard-activatable — a keyboard-only or screen-reader user can't Tab to it or press Enter/Space to trigger it the way they can with a real `<button>`. To make a non-button element behave accessibly, you'd need to manually add `tabIndex={0}`, a `role="button"`, and an `onKeyDown` handler that checks for Enter/Space — work a native `<button>` already gives you for free.

---

**Q15: Can you attach multiple different event handlers to the same JSX element?**

A: Yes — an element can have as many distinct event props as are relevant to it, e.g., an `<input>` with both `onChange` and `onBlur` and `onKeyDown` simultaneously. Each corresponds to a different native event type, and React dispatches to whichever handlers match the event that actually fired, all through the same delegated listener mechanism described above.
