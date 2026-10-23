# 01 — What is React

> "React isn't a framework that hands you a house — it's a really good hammer. You still build the house yourself, but the hammer makes every nail a lot less painful to drive."

---

## Table of Contents

1. [The Problem: DOM Manipulation Gets Out of Hand](#1-the-problem-dom-manipulation-gets-out-of-hand)
2. [Declarative vs Imperative](#2-declarative-vs-imperative)
3. [UI as a Function of State](#3-ui-as-a-function-of-state)
4. [What Is a Component?](#4-what-is-a-component)
5. [The Virtual DOM — A First Look](#5-the-virtual-dom--a-first-look)
6. [A Little Bit of History](#6-a-little-bit-of-history)
7. [React vs Other Approaches](#7-react-vs-other-approaches)
8. [Function Components vs Class Components](#8-function-components-vs-class-components)
9. [Common Beginner Misconceptions](#9-common-beginner-misconceptions)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. The Problem: DOM Manipulation Gets Out of Hand

Let's not start with a definition of React. Let's start with the pain that made React worth inventing.

Imagine you're building a simple counter. A button, a number, click the button, the number goes up. Easy, right? Here's how you'd do it with plain JavaScript and the DOM:

```html
<button id="incrementBtn">+1</button>
<p id="countDisplay">Count: 0</p>

<script>
  let count = 0;
  const countDisplay = document.getElementById("countDisplay");
  const incrementBtn = document.getElementById("incrementBtn");

  incrementBtn.addEventListener("click", () => {
    count = count + 1;
    countDisplay.textContent = "Count: " + count;
  });
</script>
```

Fine. That's five lines of actual logic, and it works. No problem yet.

Now let's make it slightly more real. Add a "reset" button. Add a rule: if the count goes above 10, show a warning message. Add a rule: disable the increment button once the count hits 20.

```html
<button id="incrementBtn">+1</button>
<button id="resetBtn">Reset</button>
<p id="countDisplay">Count: 0</p>
<p id="warning" style="display: none;">Careful, getting high!</p>

<script>
  let count = 0;
  const countDisplay = document.getElementById("countDisplay");
  const incrementBtn = document.getElementById("incrementBtn");
  const resetBtn = document.getElementById("resetBtn");
  const warning = document.getElementById("warning");

  function render() {
    countDisplay.textContent = "Count: " + count;
    warning.style.display = count > 10 ? "block" : "none";
    incrementBtn.disabled = count >= 20;
  }

  incrementBtn.addEventListener("click", () => {
    count = count + 1;
    render();
  });

  resetBtn.addEventListener("click", () => {
    count = 0;
    render();
  });
</script>
```

Notice what just happened. You, the developer, are now personally responsible for remembering **every single place in the DOM that depends on `count`**, and manually updating each one, every time `count` changes. You had to write a `render()` function yourself, and remember to call it from *every* place that changes state.

Now imagine this isn't a toy counter. Imagine it's a real dashboard: 40 pieces of state, a dozen buttons, some fields that depend on three other fields, a sidebar that needs to refresh when the count changes, a notification badge, a chart. Every new interaction is another spot where you have to ask yourself: "wait, what *else* on this page needs to change because of this?"

Miss one spot, and you get a bug where the screen shows stale data — the classic "UI out of sync with reality" bug. This was extremely common in the jQuery era of web development, where large apps became a tangle of `.addEventListener`, `.html()`, `.css()`, `.attr()` calls scattered across dozens of files, each one manually pushing changes into the DOM.

That's the actual problem React was built to solve: **as an app grows, manually keeping the DOM in sync with your data becomes unmanageable.**

---

## 2. Declarative vs Imperative

### What problem does this solve?

The counter example above is what's called **imperative** code. You're giving the computer a step-by-step recipe: "find this element, now set its text, now check this condition, now toggle that style." You're describing *how* to update the screen, one instruction at a time.

The problem with imperative UI code isn't that it's wrong — it works fine for five lines. The problem is that it doesn't scale. Every new feature means finding every existing instruction sequence that might be affected, and inserting new steps into it correctly. The complexity grows faster than the app does.

### Real-world analogy

Think about giving directions to a taxi driver two different ways.

**Imperative:** "Turn left at the light. Now go straight for two blocks. Now turn right at the gas station. Now go straight until you see a blue house, then stop."

**Declarative:** "Take me to 42 Ocean Avenue."

In the imperative version, *you* are doing the navigating — you have to track where the car is at every step and issue the next correct instruction. In the declarative version, you just describe the destination — the *desired end state* — and the driver (who knows the roads much better than you) figures out the turns.

React is the taxi driver. You tell it what the UI should look like for a given set of data. React figures out the DOM operations needed to get there.

### Basic definition

- **Imperative** code describes the *steps* to reach a result: "find this element, then change its text, then toggle this class."
- **Declarative** code describes the *desired result* itself: "given this data, the screen should look like this." The mechanism that gets you there is somebody else's job — in React's case, React's own job.

### Internal working

Here's the mental shift, as a simple before/after:

```text
IMPERATIVE (vanilla DOM)                DECLARATIVE (React)
-------------------------               -------------------------
You track: "what does the                You track: "what is the
DOM currently look like?"                current data/state?"
        |                                        |
        v                                        v
You write: "find element X,              You write: "here's what the
change this one property"                UI should look like, given
        |                                this data" (a JSX description)
        v                                        |
You repeat this for every                        v
place in the DOM affected                React compares old vs new
by the change                            description, and applies
        |                                only the necessary DOM
        v                                changes itself
Risk: miss a spot, DOM
goes out of sync with data               Risk: much lower — React
                                          always re-derives the full
                                          picture from your data
```

### Example — side by side

Here's the exact same counter, imperative vs declarative.

**Before React (imperative):**

```js
let count = 0;
const countDisplay = document.getElementById("countDisplay");
const incrementBtn = document.getElementById("incrementBtn");

function render() {
  countDisplay.textContent = "Count: " + count;
}

incrementBtn.addEventListener("click", () => {
  count = count + 1;
  render(); // you must remember to call this
});
```

**With React (declarative):**

```jsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```

Look closely at what's missing from the React version: there's no `document.getElementById`, no `.textContent =`, no manually-written `render()` function that you have to remember to call. You just wrote *what the UI should look like* — "a paragraph showing the count, and a button." When `setCount` runs, React re-runs this function, gets the new description, and quietly patches the DOM to match. You never touched the DOM directly.

### Compare with related concepts

| Aspect | Imperative (vanilla DOM / jQuery) | Declarative (React) |
|---|---|---|
| What you write | Step-by-step DOM instructions | A description of the UI for given data |
| Who tracks "what changed on screen" | You, manually | React, automatically |
| Risk of UI/data mismatch | High — easy to miss an update spot | Low — UI is re-derived from data every time |
| Code growth as app grows | Grows faster than linearly (tangled dependencies) | Grows roughly linearly (each component is isolated) |
| Debugging question | "Which line changed this pixel?" | "What was the state at this render?" |

### Common mistakes/confusions

A common beginner mistake is thinking "declarative just means using JSX instead of `createElement`." That's not it — JSX is just syntax. The *declarative* part is the mindset: you describe outcomes ("show this if that condition is true"), not instructions ("run this line, then that line"). You could write ugly imperative-style code inside a React component too (though you rarely need to) — the framework nudges you toward declarative thinking, but it isn't magic that forbids the alternative.

Another mix-up: people think declarative means "no logic allowed." Not true — you can absolutely have conditionals and loops in your JSX description (`count > 10 && <Warning />`), you're just describing conditions on the *output*, not manually toggling `style.display` on an existing DOM node.

### Interview answer

"Imperative code describes the sequence of steps to manipulate the DOM directly — you find an element and mutate it. Declarative code describes what the UI should look like for a given state, and lets the library figure out the actual DOM operations. React is declarative: components return a description of the UI as a function of their current state, and React handles reconciling that description against the real DOM. This removes an entire class of bugs where the UI silently drifts out of sync with the underlying data, because the UI is always re-derived from the data rather than incrementally patched by hand."

> **Memory hook:** "Imperative is giving turn-by-turn directions. Declarative is giving an address and letting the driver handle the turns."

---

## 3. UI as a Function of State

### What problem does this solve?

Once you accept "describe the result, don't script the steps," a natural question follows: describe the result *based on what*? What's the input to that description?

The answer is: your **state** — whatever data currently describes the situation (is the modal open? what did the user type? how many items are in the cart?). React's whole model rests on one idea:

```text
UI = f(state)
```

Read that as: "the UI is a function of state." Give the same state, get the same UI, every single time — just like a well-behaved math function.

### Real-world analogy

Think of a thermostat display. It doesn't "remember" what it showed five minutes ago and nudge the display incrementally. It just reads the current temperature and shows *that number*, freshly, every time. Feed it 72°F, it shows "72°F." Feed it 72°F again tomorrow, it shows "72°F" again — same input, same output, no matter what it showed in between.

React components work the same way. Give a component the same props and state, and it renders the same output — every time, predictably.

### Basic definition

"UI as a function of state" means: your component is (conceptually) a pure function that takes the current state as input and returns a description of what the UI should look like. You don't push individual updates into the DOM — you re-describe the *entire* UI for the current state, and React works out the minimal real changes needed.

### Internal working

```text
State changes (e.g. setCount(5))
        |
        v
React calls your component function again
        |
        v
Component function runs top to bottom,
using the NEW state value, and returns
a fresh UI description (JSX)
        |
        v
React compares this new description
to the previous one
        |
        v
React updates only the parts of the
real DOM that actually differ
```

The important part: your component function doesn't "patch" anything. It just re-runs from scratch and returns the whole picture again, honestly, based on whatever the state is *right now*. React is the one responsible for turning "here's the whole new picture" into "here's the small diff to actually apply."

### Example

```jsx
function Greeting({ isLoggedIn, username }) {
  if (isLoggedIn) {
    return <h1>Welcome back, {username}!</h1>;
  }
  return <h1>Please log in.</h1>;
}
```

Notice this function doesn't say "change the h1's text from A to B." It just says: "given `isLoggedIn` and `username` right now, here's what the heading should be." Call it with `{ isLoggedIn: false }` and you always get the login prompt. Call it with `{ isLoggedIn: true, username: "Alice" }` and you always get "Welcome back, Alice!" — no matter what was rendered the call before.

A slightly bigger example, tying state and UI together explicitly:

```jsx
import { useState } from "react";

function CartSummary() {
  const [items, setItems] = useState([]);

  // The UI below is entirely DERIVED from `items`.
  // Change `items`, and this whole description changes with it.
  return (
    <div>
      <p>{items.length} item(s) in cart</p>
      {items.length === 0 && <p>Your cart is empty.</p>}
      <button onClick={() => setItems([...items, "New Item"])}>
        Add item
      </button>
    </div>
  );
}
```

Every time `setItems` runs, React re-runs `CartSummary()` with the new `items`, gets a fresh description, and updates the screen to match. You never wrote a line that says "now update the item count text."

### Compare with related concepts

| Model | How the UI is produced |
|---|---|
| Manual DOM manipulation | You write imperative code to mutate specific nodes whenever data changes |
| jQuery | Similar to manual DOM, with convenience selectors/helpers, but still imperative |
| React (`UI = f(state)`) | UI is re-derived fresh from state on every change; React computes and applies the DOM diff |
| Spreadsheet (as an analogy) | A cell's formula re-evaluates whenever its inputs change — you don't manually recalculate it |

### Common mistakes/confusions

A very common early mistake: trying to directly change what's on screen instead of changing state. For example, reaching for `document.querySelector` inside a React component to tweak something manually. If you ever feel the urge to reach into the DOM directly to make something appear or disappear, that's a signal: there's probably a piece of state you haven't modeled yet. The fix is almost always "store the thing that changes as state, and let your JSX describe both cases (before/after)."

Another confusion: people think "UI = f(state)" means state and props are the same thing. They're related but distinct — **props** are inputs handed down from a parent (like function arguments), while **state** is data a component owns and manages itself (introduced properly in a later phase). Both feed into the same idea: what you see on screen is derived from data, not hand-maintained.

### Interview answer

"React models UI as a pure function of state: `UI = f(state)`. Instead of mutating the DOM to reflect individual changes, a component re-renders — re-runs its function — whenever its state changes, producing a full new description of what the UI should look like for that state. React then reconciles that description against the previous one and applies only the minimal necessary DOM updates. This makes UI behavior predictable and testable: the same state always produces the same UI, and you reason about 'what should this look like given this data' rather than tracking a long history of incremental DOM mutations."

> **Memory hook:** "Don't nudge the screen — redescribe it, and let React figure out the nudge."

---

## 4. What Is a Component?

### What problem does this solve?

Even with the declarative mindset, one large chunk of JSX describing an entire page would still be unwieldy — one giant function juggling a header, a sidebar, a product list, a footer, all tangled together. You'd end up right back where you started: one big blob that's hard to reason about.

### Real-world analogy

Think of a component like a Lego brick. A single brick is small and understandable on its own — "this is a 2x4 red brick." You don't need to know how the entire castle is built to understand what one brick does. You combine bricks to build bigger things, and each brick can be reused anywhere in the model.

### Basic definition

A **component** is a self-contained, reusable piece of UI — described by a function that returns what that piece should look like, given some input (called *props*) and its own internal state. A page is just components made of components, all the way down: a `Page` is made of a `Header`, a `Sidebar`, and a `Footer`; the `Header` might itself be made of a `Logo` and a `NavMenu`.

### Internal working

```text
<App>
  |
  |-- <Header>
  |     |-- <Logo>
  |     |-- <NavMenu>
  |
  |-- <ProductList>
  |     |-- <ProductCard>  (repeated per product)
  |     |-- <ProductCard>
  |     |-- <ProductCard>
  |
  |-- <Footer>
```

Each box in that tree is its own function, responsible only for its own little piece of the UI. `ProductCard` doesn't need to know anything about the `Footer` — it just needs to know how to render one product.

### Example

```jsx
function ProductCard({ name, price }) {
  return (
    <div className="card">
      <h3>{name}</h3>
      <p>${price}</p>
    </div>
  );
}

function ProductList({ products }) {
  return (
    <div>
      {products.map((product) => (
        <ProductCard key={product.id} name={product.name} price={product.price} />
      ))}
    </div>
  );
}
```

`ProductCard` is a small, focused, reusable unit. `ProductList` doesn't know or care *how* a card renders internally — it just hands each product's data down and trusts `ProductCard` to do its job. That separation is the entire point: components let you build a big, complex UI out of small, independently understandable pieces.

### Common mistakes/confusions

Beginners sometimes think a component has to be visually complex to "count." It doesn't — a component can be as small as a single `<Badge>` that just renders a colored dot, or as large as an entire `<Dashboard>`. Size isn't the defining trait; being a self-contained, reusable description of a piece of UI is.

> **Memory hook:** "A component is a Lego brick — small, self-contained, and reusable in bigger builds."

---

## 5. The Virtual DOM — A First Look

### What problem does this solve?

Real DOM operations are relatively expensive — measuring layout, repainting pixels, recalculating styles. If React re-ran your whole component function on every state change and then blindly tore down and rebuilt the *entire* real DOM every time, your app would be painfully slow. Re-rendering the description should be cheap; only the actual visible changes should touch the real DOM.

*(This is an introductory look — the actual diffing algorithm and fiber architecture get covered in depth in Phase 05. For now, just build the mental model.)*

### Real-world analogy

Imagine you're repainting a wall, and instead of repainting the entire wall every time one small scuff appears, you first take a photo of "what the wall should look like now," compare it to a photo of "what it currently looks like," spot the one scuffed patch, and touch up *only that patch*. Comparing two photos is cheap. Repainting the whole wall every time would be wasteful.

### Basic definition

The **Virtual DOM** is a lightweight, in-memory JavaScript representation of what the UI *should* look like — essentially a plain object tree describing your components' output. It's not the real, on-screen DOM; it's React's own cheap internal copy that it can create and compare quickly, without touching the browser.

### Internal working

```text
State changes
      |
      v
Component function re-runs, produces a
NEW Virtual DOM tree (in-memory, cheap)
      |
      v
React compares the NEW Virtual DOM tree
against the PREVIOUS Virtual DOM tree
      |
      v
React computes the minimal set of real
DOM operations needed to reconcile
the difference
      |
      v
React applies ONLY those specific
changes to the real, on-screen DOM
```

The key insight: comparing two lightweight in-memory trees is fast. Actually touching the real, rendered DOM is comparatively slow. So React does as much "figuring out" as possible in the cheap, in-memory world, and only touches the expensive real DOM for the parts that genuinely changed.

### Example, conceptually

Say your counter goes from 3 to 4:

```jsx
<div>
  <p>Count: 3</p>
  <button>+1</button>
</div>

// becomes:

<div>
  <p>Count: 4</p>
  <button>+1</button>
</div>
```

React compares these two in-memory trees, notices that only the text inside the `<p>` changed, and issues exactly one real DOM instruction: update that text node. The `<div>` and `<button>` are untouched — even though your component function returned a "whole new" description of everything.

### Compare with related concepts

| Concept | What it is |
|---|---|
| Real DOM | The browser's actual live representation of the page — expensive to query/mutate repeatedly |
| Virtual DOM | React's lightweight in-memory JS object tree describing the desired UI — cheap to create and compare |
| Reconciliation | The process of diffing the new Virtual DOM against the previous one to find the minimal real changes |

### Common mistakes/confusions

A very common misconception: "the Virtual DOM makes React faster than plain JavaScript at everything." That's an oversimplification — hand-tuned, surgical vanilla JS DOM updates can absolutely outperform React in narrow benchmarks. What the Virtual DOM actually gives you is a good *default* performance strategy without you having to hand-optimize every single update yourself, while keeping the declarative programming model. It's a tradeoff for developer sanity and consistently decent performance, not a guarantee of "fastest possible" in every case.

> **Memory hook:** "Don't repaint the whole wall for one scuff — compare photos first, then touch up only what changed."

---

## 6. A Little Bit of History

This isn't a history exam, so keep this light — just enough context to understand *why* React exists.

**The problem in the early 2010s:** websites were turning into full-blown single-page applications (SPAs) — think Facebook's news feed, constantly updating without full page reloads. Managing that much dynamic, interactive UI with jQuery-style direct DOM manipulation was becoming genuinely painful at scale (this is exactly the problem from Section 1, just at a much bigger scale).

**Facebook's answer:** engineers there built React to solve their own internal pain — specifically, keeping a live news feed with likes, comments, and notifications all in sync without the codebase collapsing into unmanageable spaghetti. React was released as open source and the ideas spread fast: declarative UI, and — maybe even more importantly — genuinely **reusable components**. Instead of a `Button` being copy-pasted markup and script in five different places, it became one component, used in five places, fixed in one place.

That reusability angle is a big deal in practice. Once your UI is built from small components, a design change to "how buttons look" happens in one file, and every button in the app updates automatically.

> **Memory hook:** "React was born from Facebook's own pain keeping a live, constantly-updating feed in sync — then it turned out everyone else had that same pain too."

---

## 7. React vs Other Approaches

No single approach is "wrong" — each one made sense for the kind of web that existed when it was popular, and each has real, factual tradeoffs.

| Approach | How UI updates happen | Reusability | Typical fit |
|---|---|---|---|
| Vanilla JS DOM manipulation | You manually select elements and mutate them | Low — logic is often copy-pasted across pages | Small pages, simple scripts, performance-critical micro-widgets |
| jQuery | Same idea as vanilla JS, with a friendlier API for selecting/mutating elements | Low-to-medium — helper functions can be shared, but no strong component model | Pages needing modest interactivity without a big framework investment |
| React | Declarative — describe UI as a function of state; React reconciles DOM changes | High — the component model is the whole point | Apps with a lot of dynamic, interactive, changing UI |
| Other component-based frameworks (e.g. Vue, Angular, Svelte) | Also declarative, also component-based, but differ in syntax, state model, and how much tooling/structure is built in | High — similar goals to React | Apps needing the same kind of interactivity, chosen based on team preference, ecosystem, or existing conventions |

The honest takeaway: React, Vue, Angular, and Svelte are all solving the *same underlying problem* (declarative, component-based UI) with different syntax and philosophies. Vanilla JS and jQuery are still perfectly reasonable choices for genuinely simple pages — the pain that justifies reaching for React only shows up once an app's state and UI complexity grows past a certain point.

> **Memory hook:** "It's not 'React vs. everything else is bad' — it's 'pick the tool sized to how tangled your UI's state actually gets.'"

---

## 8. Function Components vs Class Components

Just a short, honest note here, because you'll definitely encounter both if you read older React code or tutorials.

React originally only had **class components** — components written as ES6 classes, with lifecycle methods like `componentDidMount` and `componentDidUpdate`, and state managed via `this.state` and `this.setState()`.

```jsx
// A class component (older style — you'll see this in legacy code)
class Counter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }

  render() {
    return (
      <button onClick={() => this.setState({ count: this.state.count + 1 })}>
        Count: {this.state.count}
      </button>
    );
  }
}
```

Later, React introduced **Hooks**, which let plain **function components** manage state and other features that used to require a class:

```jsx
// The same thing as a function component with Hooks (modern style)
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

Function components with Hooks became the modern standard — less boilerplate, no confusing `this` binding, easier to reuse stateful logic between components. **This course focuses entirely on function components and Hooks.** You should be able to recognize a class component if you come across one in older documentation or a legacy codebase, but you won't need to write one to work through this material.

> **Memory hook:** "Class components are the old road — still there, still drivable, but this course only teaches the new highway: function components and Hooks."

---

## 9. Common Beginner Misconceptions

A few things that trip up almost everyone in week one:

**"JSX is HTML."** It looks like HTML, but it's not. JSX is syntax sugar that compiles down to plain JavaScript function calls that build up that Virtual DOM tree you read about in Section 5. That's why JSX has small differences from HTML — `className` instead of `class`, camelCase event handlers like `onClick` instead of `onclick`, and the ability to drop in `{ }` to embed real JavaScript expressions right inside the markup. Under the hood, it's JavaScript describing UI, not a markup language on its own.

**"React is a full framework, like Angular."** React itself is deliberately a **UI library**, not a full framework. It's focused on one job: building component-based, declarative user interfaces. Things a full framework usually bundles in — routing, data fetching conventions, form handling, project structure opinions — are, in React's world, typically separate libraries you choose and add yourself (or bundled together for you by a React-based framework built on top of React). This is a deliberate design choice, not a missing feature: it's why React pairs with such a wide ecosystem of different tools.

**"The Virtual DOM means React updates are always instant/free."** As covered in Section 5, the Virtual DOM makes re-render *comparisons* cheap, and helps React avoid unnecessary real DOM work by default — but it's not magic, and it's not literally free. Poorly structured components can still cause real performance problems (a topic for later phases on optimization).

**"State and props are the same thing."** They're both "data that feeds into a component's output," but props come *in* from a parent (like a function argument you don't own or change yourself), while state is owned and managed by the component itself. This distinction gets its own full phase later — for now, just know they're not interchangeable.

> **Memory hook:** "JSX isn't HTML, React isn't a framework, and the Virtual DOM isn't magic — it's just a good default strategy."

---

## 10. Hands-On Exercises

**Exercise 1 — Feel the imperative pain yourself**

Build the "counter with warning and disable" example from Section 1 using only vanilla JavaScript and `document.getElementById`. Add one more rule: show a "Max reached!" message once the count hits 20, and hide the increment button entirely (not just disable it) at that point. Notice how many separate spots in your code now need to know about `count`.

**Exercise 2 — Convert imperative to declarative**

Take your vanilla JS counter from Exercise 1 and rewrite it as a React function component using `useState`. Compare line counts and, more importantly, compare how many places you had to remember to manually update the DOM (should be zero in the React version).

**Exercise 3 — UI as a function of state**

Write a function component `TrafficLight` that takes a prop `color` (one of `"red"`, `"yellow"`, `"green"`) and returns a `<div>` with a background color matching the light, plus text saying what drivers should do ("Stop", "Slow down", "Go"). Call it three times with different `color` values and confirm the output only ever depends on the input — never on anything left over from a previous render.

**Exercise 4 — Break a page into components**

Sketch (on paper or in comments) a component tree for a blog homepage: a header with a logo and nav links, a list of post previews (title, excerpt, "read more" link), and a footer with copyright text. Identify which piece would be `PostPreview` and explain why it's a good candidate for reuse.

**Exercise 5 — Spot the Virtual DOM diff**

Given this before/after JSX for a to-do list item:

```jsx
// before
<li className="todo">Buy milk</li>

// after
<li className="todo done">Buy milk</li>
```

What is the *minimal* real DOM operation React should perform? (Hint: think about which single attribute actually changed — nothing about the text or the element type did.)

**Exercise 6 — Identify the misconception**

A teammate says: "I added `document.querySelector('.badge').style.display = 'none'` inside my React component to hide a badge conditionally — it works!" Explain, in your own words, why this fights against React's model, and rewrite it the "React way" using state and a conditional in JSX.

---

## 11. Interview Q&A

**Q1: What problem was React created to solve?**

A: As web applications grew into single-page applications with lots of dynamic, interactive UI, manually keeping the DOM in sync with changing data using direct DOM manipulation (as was common with vanilla JS or jQuery) became unmanageable. Every new feature meant tracking every place in the DOM affected by a data change and updating it by hand, which was error-prone and didn't scale. React solves this by letting developers describe the UI declaratively as a function of state, and having React handle the actual DOM updates.

---

**Q2: What is the difference between declarative and imperative programming, in the context of UI?**

A: Imperative UI code describes the step-by-step instructions to change the DOM — find an element, mutate a property. Declarative UI code describes what the UI should look like for a given piece of data, and leaves the "how to actually update the DOM" mechanism to the library. React is declarative: you write components that return a description of the UI, and React figures out the minimal real DOM changes needed to match that description.

---

**Q3: Explain "UI is a function of state."**

A: It means a component's rendered output is entirely determined by its current state (and props) — expressed as `UI = f(state)`. Given the same state, a component always produces the same UI output, similar to a pure function. When state changes, React re-runs the component function to get a fresh UI description, rather than incrementally patching the previous output by hand.

---

**Q4: What is a component in React?**

A: A component is a self-contained, reusable piece of UI, typically written as a function that returns a description of what that piece should render, given some input data (props) and possibly its own internal state. Components can be composed — larger components are built from smaller ones — allowing a complex UI to be broken down into small, independently understandable, reusable pieces.

---

**Q5: What is the Virtual DOM, at a conceptual level?**

A: The Virtual DOM is a lightweight, in-memory JavaScript representation of what the UI should currently look like. When state changes, React creates a new Virtual DOM tree, compares it against the previous one, and computes the minimal set of real DOM operations needed to reconcile the difference — then applies only those changes to the actual browser DOM. This avoids the cost of unnecessarily re-rendering the entire real DOM on every change.

---

**Q6: Is React a framework or a library, and why does that distinction matter?**

A: React is commonly described as a UI library rather than a full framework. It focuses specifically on building component-based, declarative user interfaces. Things a full framework typically provides out of the box — routing, data-fetching conventions, form handling, opinionated project structure — are left to separate libraries in the React ecosystem (or bundled by React-based frameworks built on top of React). This gives more flexibility in tool choice, at the cost of more upfront decisions for a team to make.

---

**Q7: Why was React originally created?**

A: React was built at Facebook to address the growing difficulty of keeping a large, constantly updating interface (like a live news feed with likes, comments, and notifications) in sync using direct DOM manipulation. It was later open-sourced, and its declarative, component-based model — along with genuine UI reusability — resonated broadly as web applications increasingly became single-page applications.

---

**Q8: What is the difference between function components and class components?**

A: Class components are ES6 classes that extend `React.Component`, managing state via `this.state`/`this.setState()` and using lifecycle methods like `componentDidMount`. Function components are plain JavaScript functions; with the introduction of Hooks, they gained the ability to manage state and other features previously exclusive to classes, without needing `this` or lifecycle methods. Function components with Hooks are now the modern standard due to less boilerplate and easier reuse of stateful logic.

---

**Q9: Is JSX the same as HTML?**

A: No. JSX looks similar to HTML but is syntax that compiles into JavaScript function calls building a UI description (ultimately contributing to the Virtual DOM tree). This is why JSX has differences from HTML, such as using `className` instead of `class` and camelCase event handler names like `onClick`, and why you can embed real JavaScript expressions directly inside JSX using curly braces.

---

**Q10: Does the Virtual DOM guarantee that React is always faster than manual DOM manipulation?**

A: No. The Virtual DOM makes comparing "what should the UI look like now" against "what did it look like before" cheap, and helps avoid unnecessary real DOM operations by default. But hand-tuned, surgical manual DOM updates can still outperform React in narrow cases. The Virtual DOM's real value is providing a solid default performance strategy while preserving a declarative programming model, not guaranteeing the fastest possible outcome in every scenario.

---

**Q11: What's the difference between props and state?**

A: Props are data passed into a component from its parent — similar to arguments passed into a function — and a component does not modify its own props. State is data that a component owns and manages internally, and can change over time in response to events like user interaction. Both feed into a component's rendered output, but they have different owners and different mutability rules.

---

**Q12: Why does breaking a UI into components help as an application grows?**

A: Components let you isolate a piece of UI logic and markup into a small, self-contained, reusable unit. Instead of one large function trying to describe an entire page, each component is responsible for its own small piece, making the codebase easier to reason about, test, and reuse. A change to how a component looks or behaves can be made in one place and automatically applies everywhere that component is used.

---

**Q13: What is reconciliation?**

A: Reconciliation is the process React uses to compare a newly generated Virtual DOM tree against the previous one, determine what actually changed, and compute the minimal set of real DOM operations required to update the browser's DOM to match the new description. It's the mechanism that lets components "re-describe the whole UI" on every state change without incurring the cost of literally rebuilding the entire real DOM every time.

---

**Q14: A junior developer says "I'll just grab the DOM node directly with `document.querySelector` inside my component to update it." What's wrong with that in a React app?**

A: This bypasses React's model entirely — React expects the UI to be derived from state via re-rendering, not mutated directly. Reaching for direct DOM manipulation inside a React component is usually a sign that a piece of state hasn't been modeled yet. The fix is to represent whatever changes as state, and describe both the "before" and "after" cases declaratively in JSX, letting React handle the actual DOM update through its normal render and reconciliation process.

---

**Q15: Why does this course focus on function components and Hooks rather than class components?**

A: Function components with Hooks became React's modern standard: they require less boilerplate, avoid the confusing behavior of `this` binding found in classes, and make it easier to reuse stateful logic across components. While class components still exist and appear in legacy codebases and older documentation, new React code is overwhelmingly written with function components and Hooks, which is why this course teaches that approach as the primary model.
