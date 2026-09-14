# 02 — JSX Deep Dive

> "JSX isn't a templating language bolted onto JavaScript — it's syntax sugar for plain old function calls. Once you see what it compiles to, you stop being scared of it."

---

## Table of Contents

1. [The Problem JSX Solves](#1-the-problem-jsx-solves)
2. [What JSX Actually Compiles To](#2-what-jsx-actually-compiles-to)
3. [Embedding JavaScript Expressions](#3-embedding-javascript-expressions)
4. [JSX Attributes vs HTML Attributes](#4-jsx-attributes-vs-html-attributes)
5. [Conditional Rendering Inside JSX](#5-conditional-rendering-inside-jsx)
6. [The Single Root Element Rule and Fragments](#6-the-single-root-element-rule-and-fragments)
7. [JSX Children](#7-jsx-children)
8. [Common JSX Mistakes](#8-common-jsx-mistakes)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Problem JSX Solves

Let's start by doing something most React tutorials skip: writing UI **without** JSX.

Say you want to render this simple card:

```
┌───────────────────────────┐
│ Hello, Ganesh              │
│ Welcome back!               │
│ [ View Profile ]            │
└───────────────────────────┘
```

In plain React, with no JSX at all, that card looks like this:

```js
React.createElement(
  "div",
  { className: "card" },
  React.createElement("h2", null, "Hello, Ganesh"),
  React.createElement("p", null, "Welcome back!"),
  React.createElement(
    "button",
    { onClick: handleClick },
    "View Profile"
  )
);
```

That's... a lot, for three lines of visible UI. Now imagine a real page — a navbar, a sidebar, a list of 20 items, each with a few nested elements. You'd end up with `React.createElement` calls nested inside `React.createElement` calls, nested inside more `React.createElement` calls, five or six levels deep. Finding the closing parenthesis that matches which opening call becomes a genuine exercise in patience.

Here's the same card, in JSX:

```jsx
<div className="card">
  <h2>Hello, Ganesh</h2>
  <p>Welcome back!</p>
  <button onClick={handleClick}>View Profile</button>
</div>
```

Same output. Completely different experience to read, write, and scan. You can *see* the tree shape instantly, the same way you can look at HTML and immediately picture the page.

That's the entire reason JSX exists: **`React.createElement` calls are what React actually needs, but they're miserable for humans to write and read at scale. JSX is a thin layer of syntax that lets you write something that looks like the UI you're building, and a compiler turns it back into the function calls React needs.**

---

## 2. What JSX Actually Compiles To

This is the single most useful thing to understand about JSX, so let's slow down here.

### The basic definition

JSX is **not** valid JavaScript. Browsers cannot run it directly. It's a syntax extension that gets transformed — by a compiler like Babel or the TypeScript compiler — into regular JavaScript function calls *before* your code ever reaches the browser.

### Internal working — step by step

Here's the actual pipeline, from the file you write to the code that runs:

```text
┌──────────────────────────────────────────────────────────────────┐
│                  JSX Compilation Pipeline                        │
│                                                                    │
│  You write:        <h1 className="title">Hello</h1>             │
│         |                                                          │
│         v                                                          │
│  Step 1: Babel (or the TS compiler) parses the .jsx/.tsx file    │
│         |                                                          │
│         v                                                          │
│  Step 2: Every JSX tag is transformed into a function call       │
│          (React.createElement, or the newer jsx()/jsxs() calls)  │
│         |                                                          │
│         v                                                          │
│  Step 3: The output is plain JavaScript — this is what actually  │
│          ships to (or runs in) the browser                        │
│         |                                                          │
│         v                                                          │
│  Step 4: At runtime, calling that function doesn't touch the DOM  │
│          at all — it returns a plain JS object describing the     │
│          element (a "React element"), e.g.:                       │
│          { type: "h1", props: { className: "title",              │
│                                  children: "Hello" } }             │
│         |                                                          │
│         v                                                          │
│  Step 5: React's renderer (ReactDOM) reads that object tree and   │
│          decides what to actually create/update in the real DOM   │
└──────────────────────────────────────────────────────────────────┘
```

The part people find surprising is Step 4: a JSX element, once compiled and executed, is just a plain JavaScript object. It's not magic, it's not a DOM node, it's not even React-specific machinery — it's a description, a blueprint. React reads that blueprint later and decides what real DOM work needs to happen.

### There are two ways JSX gets compiled

**1. The "classic" runtime** — every JSX tag becomes a call to `React.createElement`. This was the only option for years, and it's why every file using JSX used to need `import React from 'react'` at the top, even if you never wrote `React.` anywhere yourself — the compiled output calls `React.createElement` behind the scenes, so `React` has to be in scope.

**2. The "automatic" JSX runtime** — introduced in React 17, and the default in modern tooling (Vite, Next.js, Create React App's later versions). The compiler instead imports special `jsx` / `jsxs` functions automatically from `react/jsx-runtime` and calls those. You no longer need to manually `import React` just to use JSX. It's mostly the same idea under the hood, just a slightly more optimized function shape and one less import you have to remember.

### Example — side by side

Here's a slightly richer example, so you can see both the JSX and the classic compiled output next to each other.

**JSX you write:**

```jsx
function Greeting({ name }) {
  return (
    <div className="greeting">
      <h1>Hello, {name}!</h1>
      <p>Nice to see you.</p>
    </div>
  );
}
```

**What it compiles to (classic runtime, `React.createElement`):**

```js
function Greeting({ name }) {
  return React.createElement(
    "div",
    { className: "greeting" },
    React.createElement("h1", null, "Hello, ", name, "!"),
    React.createElement("p", null, "Nice to see you.")
  );
}
```

**What it compiles to (automatic runtime, React 17+ — what most new projects actually generate today):**

```js
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

function Greeting({ name }) {
  return _jsxs("div", {
    className: "greeting",
    children: [
      _jsxs("h1", { children: ["Hello, ", name, "!"] }),
      _jsx("p", { children: "Nice to see you." })
    ]
  });
}
```

Notice `jsxs` (with an "s") gets used when there are multiple children, and `jsx` when there's just one — a small internal optimization so React doesn't have to check the shape of `children` at runtime.

Either way, the takeaway is identical: **your JSX becomes function calls that build plain objects describing the UI. There is no special JSX runtime living inside the browser — by the time your code runs, the JSX is long gone.**

### Compare with related concepts

| Concept | What it actually is |
|---|---|
| JSX | Syntax you write — not valid JS on its own |
| `React.createElement(...)` / `jsx(...)` | The compiled-down function call JSX turns into |
| React element | The plain JS object returned by that function call — `{ type, props }` |
| Real DOM node | What `ReactDOM` eventually creates/updates *based on* the React element tree |

### Common mistake

A common misconception: "JSX directly creates DOM elements." It doesn't. JSX → function call → plain JS object (a React element) → React's reconciliation process → real DOM updates. There are two full translation steps between what you type and what actually shows up on screen.

### Interview answer

"JSX is syntax sugar, not something browsers understand natively. A compiler — usually Babel or the TypeScript compiler — transforms every JSX tag into a function call, either the classic `React.createElement(type, props, ...children)` or, since React 17, the automatic runtime's `jsx()`/`jsxs()` calls imported from `react/jsx-runtime`. Calling that function doesn't touch the DOM — it returns a lightweight plain JavaScript object called a React element, essentially `{ type, props }`. React later walks that object tree during rendering and reconciliation to figure out what actual DOM operations are needed. So the flow is: JSX → compiled function call → React element (plain object) → real DOM, with two translation layers between the code you write and the pixels on screen."

> **Memory hook:** "JSX is just `React.createElement` wearing an HTML costume."

---

## 3. Embedding JavaScript Expressions

### What problem does this solve?

A static UI is boring. You need to drop actual values, computed results, and function results into your markup — a user's name, a formatted date, the result of a calculation.

### The rule

Anything inside a single pair of curly braces `{}` is evaluated as a JavaScript **expression**, and the result is inserted into the JSX at that spot.

```jsx
const name = "Ganesh";
const items = ["Docker", "Kubernetes", "MongoDB"];

function Dashboard() {
  return (
    <div>
      <h1>Welcome, {name}</h1>
      <p>You have {items.length} courses in progress.</p>
      <p>Next course: {items[0].toUpperCase()}</p>
      <p>2 + 2 = {2 + 2}</p>
    </div>
  );
}
```

Notice: variables, property/array access, function calls, arithmetic — all of it is fair game, as long as it's an **expression** (something that produces a value), not a **statement** (something that just does an action, like an `if` block or a `for` loop).

```jsx
// This works — ternary is an expression
<p>{isLoggedIn ? "Welcome back" : "Please log in"}</p>

// This does NOT work — if/else is a statement, not an expression
<p>{ if (isLoggedIn) { "Welcome back" } }</p>  // ❌ syntax error
```

That distinction — expression vs. statement — is exactly why you'll see ternaries and `&&` used for conditionals inside JSX instead of `if` statements. More on that in Section 5.

> **Memory hook:** "Curly braces are a window back into JavaScript — but only for things that produce a value."

---

## 4. JSX Attributes vs HTML Attributes

If you already know HTML, most of JSX attributes will feel familiar — until you hit the handful of places where JSX quietly does things differently. This trips up almost everyone in their first week with React, so it's worth a clean table.

| HTML | JSX | Why it's different |
|---|---|---|
| `class="card"` | `className="card"` | `class` is a reserved word in JavaScript, so JSX can't use it as a prop name |
| `for="email"` (on `<label>`) | `htmlFor="email"` | `for` is a reserved word in JavaScript (used in `for` loops) |
| `onclick="..."` | `onClick={handleClick}` | Event handlers are camelCase, and you pass an actual function reference, not a string |
| `style="color:red;"` (a string) | `style={{ color: "red" }}` | `style` takes a JS **object**, with camelCased CSS properties (`background-color` → `backgroundColor`) |
| `tabindex="0"` | `tabIndex={0}` | Most multi-word HTML attributes become camelCase in JSX |
| `<input value="x">` (a string) | `<input value={x} />` | Attribute values are commonly JS expressions, not raw strings, once inside `{}` |

A quick note on that `style` example, since the double curly braces confuse people the first time they see them:

```jsx
<div style={{ color: "red", fontSize: "20px" }}>Hello</div>
```

That's not special `style` syntax — it's just two things stacked: the outer `{}` says "this attribute's value is a JS expression," and the inner `{...}` is a plain JavaScript object literal. `{{ color: "red" }}` is "a JS expression that happens to be an object."

The underlying reason for almost every difference in this table is the same: **JSX attributes ultimately become properties on a JavaScript object** (remember, JSX compiles to `React.createElement(type, props, ...)` — and `props` is just an object). Since it's a JS object, its keys have to be valid, non-reserved JS identifiers, and that's why `class` becomes `className` and `for` becomes `htmlFor`.

---

## 5. Conditional Rendering Inside JSX

Since `{}` only accepts expressions (Section 3), and `if`/`else` are statements, JSX leans on a few expression-friendly patterns instead. This is just the introduction — the deeper patterns (rendering lists conditionally, early returns, switch-like patterns) get their own full treatment in Phase-03.

### Ternary — when you need an either/or

```jsx
function StatusBadge({ isOnline }) {
  return (
    <span>
      {isOnline ? "🟢 Online" : "⚪ Offline"}
    </span>
  );
}
```

### `&&` — when you only want to show something *sometimes*, with nothing as the fallback

```jsx
function Notifications({ count }) {
  return (
    <div>
      <h3>Inbox</h3>
      {count > 0 && <p>You have {count} new messages.</p>}
    </div>
  );
}
```

Here's what's happening: `count > 0 && <p>...</p>` relies on how JavaScript's `&&` works — if the left side is falsy, the whole expression short-circuits to that falsy value (and React renders nothing for `false`, `null`, `undefined`); if the left side is truthy, the expression evaluates to the right side (the JSX), and *that* gets rendered.

### A word of caution with `&&`

```jsx
// Careful with this one:
{count && <p>You have {count} new messages.</p>}
```

If `count` is `0`, this doesn't just render "nothing" — React actually renders the literal number `0` onto the page (a bare `0` shows up as text). This is a genuinely common bug. The fix is to make the left side an explicit boolean:

```jsx
{count > 0 && <p>You have {count} new messages.</p>}
```

> **Memory hook:** "`&&` shows the right side when the left side is truthy — but `0` is a truthy-looking landmine because it still renders as text."

---

## 6. The Single Root Element Rule and Fragments

### What problem does this solve?

Try writing this component:

```jsx
function UserInfo() {
  return (
    <h2>Ganesh</h2>
    <p>Frontend Developer</p>
  );
}
```

This throws a compile error: *"Adjacent JSX elements must be wrapped in an enclosing tag."* Why? Let's go back to what you learned in Section 2 — JSX compiles to function calls.

### Internal working — why the rule exists

```text
<h2>Ganesh</h2>
<p>Frontend Developer</p>

        |
        v  (compiles to...)

return React.createElement("h2", null, "Ganesh");
       React.createElement("p", null, "Frontend Developer");
```

Do you see the problem? A JavaScript function can only have **one** `return` statement's worth of value — you can't `return` two separate expressions back to back like that. It's not a React limitation at all, it's a plain JavaScript rule: a function returns exactly one value. Two adjacent `React.createElement(...)` calls with nothing wrapping them simply isn't valid JavaScript to return.

So every component's `return` must hand back exactly **one** value — which means exactly one root element, that may itself contain any number of children.

### The fix: wrap it in something

**Option 1 — a real wrapping element**, like a `<div>`:

```jsx
function UserInfo() {
  return (
    <div>
      <h2>Ganesh</h2>
      <p>Frontend Developer</p>
    </div>
  );
}
```

This works, but it adds a real, permanent `<div>` to your actual DOM output — sometimes that's fine, sometimes it messes up your CSS (imagine this component is meant to be a `<tr>`'s children, and now there's a stray `<div>` sitting inside a `<table>`, which is invalid HTML).

**Option 2 — a Fragment**, when you don't want an extra DOM node at all:

```jsx
function UserInfo() {
  return (
    <React.Fragment>
      <h2>Ganesh</h2>
      <p>Frontend Developer</p>
    </React.Fragment>
  );
}
```

**Option 3 — the shorthand Fragment syntax**, which is what you'll actually type 95% of the time:

```jsx
function UserInfo() {
  return (
    <>
      <h2>Ganesh</h2>
      <p>Frontend Developer</p>
    </>
  );
}
```

`<>...</>` and `<React.Fragment>...</React.Fragment>` compile to the same thing — a special component that groups children **without** rendering any actual wrapping element into the DOM. Open your browser's dev tools on a component that uses a Fragment, and you'll see the children sitting directly in the parent — no extra `<div>` anywhere.

One small catch: the shorthand `<>` cannot take a `key` prop (useful when rendering a list of fragments) — for that one case, you have to fall back to the explicit `<React.Fragment key={...}>` form.

### Compare with related concepts

| Approach | Extra DOM node? | Can take a `key` prop? | When to use |
|---|---|---|---|
| `<div>...</div>` | Yes | Yes | You actually want a wrapping element (for styling, semantics, etc.) |
| `<React.Fragment>...</React.Fragment>` | No | Yes | You need grouping + a `key` (e.g., inside a `.map()`) |
| `<>...</>` | No | No | The common case — just grouping, no key needed |

### Common mistake

Forgetting the wrapper entirely and getting the "Adjacent JSX elements must be wrapped" compile error — this is one of the very first errors nearly every React beginner hits, often within their first hour of writing components.

### Interview answer

"Every component must return a single value, because that's simply how JavaScript's `return` statement works — and JSX compiles down to function calls, so returning two adjacent JSX elements would mean returning two separate function call results with nothing combining them, which isn't valid JavaScript. To return multiple sibling elements, you wrap them in one parent — either a real DOM element like `<div>`, or a Fragment (`<React.Fragment>` or its shorthand `<>...</>`) when you don't want to introduce an actual extra node into the rendered DOM. Fragments exist specifically to satisfy the 'one root element' requirement without polluting your HTML output with meaningless wrapper `<div>`s."

> **Memory hook:** "One function, one return value — Fragments let you group siblings without adding a real box around them."

---

## 7. JSX Children

Whatever you put between a component's opening and closing tags becomes available inside that component as `props.children`.

```jsx
function Card({ children }) {
  return <div className="card">{children}</div>;
}

function App() {
  return (
    <Card>
      <h2>Title</h2>
      <p>Some content inside the card.</p>
    </Card>
  );
}
```

Here, `<h2>Title</h2>` and `<p>...</p>` are the `children` of `Card`. Internally, they're just another prop — remember, `React.createElement(type, props, ...children)` bundles everything after `props` into that `children` value. There's nothing structurally special about children compared to any other prop; JSX just gives you the more readable nested-tags syntax for it, instead of making you pass `children` explicitly like `<Card children={...} />` (which also works, but nobody writes it that way).

Children can be a single element, multiple elements, plain text, expressions, or even a mix:

```jsx
<Card>
  Just some text.
  {" "}
  <strong>{userName}</strong>
</Card>
```

This is the foundation of the **composition** pattern in React — building complex UIs by nesting simple components inside each other, letting a parent decide *what* goes inside without needing to know what that content actually is. That idea gets a full chapter in Phase-02.

> **Memory hook:** "Whatever sits between the tags becomes `props.children` — it's a prop like any other, just with friendlier syntax."

---

## 8. Common JSX Mistakes

A quick round-up of the mistakes almost everyone makes early on — some already mentioned above, gathered here in one place.

**1. Using `class` instead of `className`**

```jsx
// ❌ Wrong — silently does nothing useful (React will warn in the console)
<div class="card">...</div>

// ✅ Correct
<div className="card">...</div>
```

**2. Returning adjacent elements without a wrapper**

```jsx
// ❌ Compile error
return (
  <h1>Title</h1>
  <p>Body</p>
);

// ✅ Wrap in a Fragment (or a real element)
return (
  <>
    <h1>Title</h1>
    <p>Body</p>
  </>
);
```

**3. Forgetting `key` when rendering a list**

```jsx
// ❌ React will warn: "Each child in a list should have a unique key prop"
{items.map(item => <li>{item.name}</li>)}

// ✅ Add a stable, unique key
{items.map(item => <li key={item.id}>{item.name}</li>)}
```

This one is just a mention here — the full depth of *why* keys matter for React's reconciliation algorithm, and what makes a good vs. bad key, is covered properly in Phase-05.

**4. Using JavaScript reserved words as attribute names**

```jsx
// ❌ 'for' and 'class' are reserved words in JS — can't be object property... 
// actually they CAN be used as object keys, but React specifically expects
// the DOM property names, not the HTML attribute names
<label for="email">Email</label>

// ✅
<label htmlFor="email">Email</label>
```

**5. Passing a string to `style` instead of an object**

```jsx
// ❌ Throws — style expects an object, not a CSS string
<div style="color: red;">Hello</div>

// ✅
<div style={{ color: "red" }}>Hello</div>
```

**6. Treating `{}` as if it accepts statements**

```jsx
// ❌ Syntax error — if/else is a statement, not an expression
<div>{ if (loggedIn) { <p>Hi</p> } }</div>

// ✅ Use a ternary (an expression)
<div>{loggedIn ? <p>Hi</p> : null}</div>
```

---

## 9. Hands-On Exercises

**Exercise 1 — Manual `createElement`**

Take this JSX:

```jsx
<div className="alert">
  <strong>Warning:</strong> Disk space is low.
</div>
```

Write out, by hand, what it compiles to using `React.createElement`. Then verify your answer by pasting the JSX into the [Babel REPL](https://babeljs.io/repl) (or just reason through it using the compilation rules from Section 2).

**Exercise 2 — Fix the broken component**

The following component fails to compile. Identify why, and fix it two different ways (once with a `div`, once with a Fragment):

```jsx
function Profile() {
  return (
    <h2>Ganesh</h2>
    <p>Full-stack developer</p>
    <p>Based in Australia</p>
  );
}
```

**Exercise 3 — Attribute translation**

Convert this raw HTML snippet into valid JSX, fixing every attribute that needs to change:

```html
<div class="form-group">
  <label for="username">Username</label>
  <input class="input" onclick="handleClick()" style="border: 1px solid gray;" />
</div>
```

**Exercise 4 — Conditional rendering, and the `0` trap**

Write a `CartSummary` component that receives an `itemCount` prop. If `itemCount` is greater than 0, show `"You have {itemCount} items in your cart."` Otherwise, render nothing. Write it first using `&&` in a way that has the `0`-renders-as-text bug from Section 5, then fix it.

**Exercise 5 — Build a `Card` component using `children`**

Build a reusable `Card` component that accepts `children` and wraps them in a `<div className="card">`. Then use it three times in an `App` component, passing different content each time (a heading + paragraph in one, an image + caption in another, a button in the third).

**Exercise 6 — Classic vs automatic runtime**

Without running any code, write out what this component compiles to under (a) the classic `React.createElement` runtime and (b) the automatic `jsx`/`jsxs` runtime:

```jsx
function Alert({ message }) {
  return (
    <div className="alert">
      <span>⚠️</span>
      <p>{message}</p>
    </div>
  );
}
```

---

## 10. Interview Q&A

**Q1: What is JSX, technically?**

A: JSX is a syntax extension to JavaScript that looks like HTML/XML but is not valid JavaScript on its own. A compiler (Babel, the TypeScript compiler, or a bundler's built-in transform) converts every JSX tag into a function call — either `React.createElement(type, props, ...children)` under the classic runtime, or `jsx()`/`jsxs()` calls from `react/jsx-runtime` under the automatic runtime introduced in React 17. It exists purely to make deeply nested UI trees readable to write and scan.

---

**Q2: What does a compiled JSX expression evaluate to at runtime?**

A: A plain JavaScript object called a React element, structurally similar to `{ type: "div", props: { className: "card", children: [...] } }`. It is not a DOM node and does not touch the DOM. React's rendering and reconciliation process later reads this object tree and decides what real DOM operations are needed to make the screen match it.

---

**Q3: Why did older React code always need `import React from 'react'` even in files that never referenced `React` directly?**

A: Because under the classic JSX transform, every JSX tag compiles to a call to `React.createElement(...)`, so `React` had to be in scope even if the developer never typed `React.` themselves. The automatic JSX runtime (React 17+) removed this requirement by having the compiler import `jsx`/`jsxs` from `react/jsx-runtime` automatically wherever needed.

---

**Q4: Why is `className` used instead of `class` in JSX?**

A: Because `class` is a reserved word in JavaScript. JSX attributes ultimately become keys on a JavaScript props object (since JSX compiles to a function call whose second argument is that object), and `class` can't safely serve that role given its meaning elsewhere in the language, so React uses `className` instead — mirroring the actual DOM property name (`element.className`), not the HTML attribute name.

---

**Q5: Why can't a component return two sibling JSX elements without a wrapper?**

A: Because JSX compiles to function calls, and a JavaScript function's `return` statement can only return one value. Two adjacent JSX elements with nothing wrapping them would compile to two separate, unconnected `React.createElement(...)` calls, which isn't valid to return together. Wrapping them — in a real element or a Fragment — gives the `return` statement one single expression to hand back.

---

**Q6: What is a Fragment, and why would you choose it over a `<div>`?**

A: A Fragment (`<React.Fragment>` or its shorthand `<>...</>`) groups multiple children under one JSX root without adding an actual extra node to the rendered DOM. You'd choose it over a `<div>` when introducing an extra wrapping element would break styling assumptions (e.g., flex/grid layouts that expect direct children) or produce invalid HTML nesting (e.g., a stray `<div>` inside a `<table>` or `<tr>`).

---

**Q7: What's the difference between `<>...</>` and `<React.Fragment>...</React.Fragment>`?**

A: They compile to the same underlying construct and behave identically in terms of not rendering an extra DOM node. The one functional difference is that the shorthand `<>` syntax cannot accept a `key` prop, while the explicit `<React.Fragment key={...}>` form can — which matters when rendering a list of Fragments inside `.map()`.

---

**Q8: Can you use an `if` statement directly inside JSX curly braces? Why or why not?**

A: No. Curly braces in JSX only accept JavaScript **expressions** — things that evaluate to a value — not **statements** like `if/else`, `for`, or `switch`, which perform an action but don't themselves produce a value. This is why conditional rendering in JSX relies on expression-friendly constructs like the ternary operator (`condition ? a : b`) or short-circuit `&&`, or by computing the value in a variable *before* the `return` and just referencing that variable inside the JSX.

---

**Q9: What's the bug with `{count && <SomeComponent />}` when `count` can be `0`?**

A: JavaScript's `&&` returns the left operand if it's falsy, otherwise the right operand. If `count` is `0`, the whole expression evaluates to `0` — and React will actually render that `0` as visible text on the page, rather than rendering nothing. The fix is to force a boolean on the left side, e.g., `count > 0 && <SomeComponent />`.

---

**Q10: How is `style` different in JSX compared to plain HTML?**

A: In HTML, `style` is a string of CSS declarations, e.g. `style="color: red;"`. In JSX, `style` must be a JavaScript object, with CSS properties written in camelCase instead of kebab-case, e.g. `style={{ color: "red", backgroundColor: "blue" }}`. The double braces are just an object literal (`{ ... }`) passed as the value of the `style` attribute (`{ }`).

---

**Q11: What are `props.children`, and how do they relate to JSX syntax?**

A: `children` is simply another prop — whatever is nested between a component's opening and closing JSX tags gets collected and passed to that component as `props.children`. Under the hood, this is exactly the `...children` argument passed to `React.createElement(type, props, ...children)`; JSX's nested-tag syntax is just a more readable way of populating that argument compared to writing `children` explicitly as a named prop.

---

**Q12: Why does React warn about missing `key` props when rendering a list, and where does the fuller explanation live?**

A: React uses `key` to match list items across renders during its reconciliation process, so it can correctly reuse, reorder, or discard DOM elements instead of re-rendering the entire list from scratch. Missing keys can cause subtle bugs with component state and unnecessary re-renders. This lesson only flags the rule (always add a stable, unique `key` when rendering arrays of elements); the full mechanics of why keys matter for the diffing algorithm are covered in Phase-05 (Rendering & Reconciliation).

---

**Q13: What's the practical difference between the classic and automatic JSX runtimes?**

A: The classic runtime compiles every JSX tag to `React.createElement(...)` and requires `React` to be in scope in every file using JSX. The automatic runtime (default since React 17, and standard in modern tooling like Vite and current Next.js/CRA setups) compiles JSX to `jsx()`/`jsxs()` calls that the compiler imports automatically from `react/jsx-runtime`, removing the need for a manual `import React from 'react'` purely for JSX support, and shaving a small amount of runtime overhead by distinguishing single-child from multi-child calls (`jsx` vs `jsxs`).

---

**Q14: If JSX just becomes objects describing UI, why can't you set the DOM directly from those objects yourself?**

A: You technically could walk the object tree yourself, but you'd be reimplementing what ReactDOM (or another React renderer) already does: diffing the new element tree against the previous one, figuring out the minimal set of real DOM mutations needed, and applying them in the right order — including handling refs, event delegation, and effect timing. The React element object is intentionally a lightweight, renderer-agnostic description; the actual DOM-writing logic lives in the renderer, which is also why the same JSX/element model can target non-browser environments like React Native.

---

**Q15: Why does `<label for="email">` fail to behave correctly in JSX, and what's the fix?**

A: `for` is a reserved word in JavaScript (used to introduce `for` loops), so JSX can't use it as a prop name the way HTML uses it as an attribute name. React instead exposes the equivalent prop as `htmlFor`, matching the DOM property name (`labelElement.htmlFor`) rather than the HTML attribute name. The fix is simply `<label htmlFor="email">Email</label>`.
