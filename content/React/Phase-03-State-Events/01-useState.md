# 01 — useState

> "A component that can't remember anything between renders isn't really a component — it's just a function that runs once and forgets everything."

---

## Table of Contents

1. [The Problem: Components Need to Remember Things](#1-the-problem-components-need-to-remember-things)
2. [Basic useState Syntax](#2-basic-usestate-syntax)
3. [What's Actually Happening Internally](#3-whats-actually-happening-internally)
4. [The Stale Value Trap — Why setValue Doesn't Update Immediately](#4-the-stale-value-trap--why-setvalue-doesnt-update-immediately)
5. [Functional Updates — setValue(prev => ...)](#5-functional-updates--setvalueprev--)
6. [State With Objects and Arrays — Why You Must Copy, Not Mutate](#6-state-with-objects-and-arrays--why-you-must-copy-not-mutate)
7. [Lazy Initial State](#7-lazy-initial-state)
8. [Each Component Instance Has Its Own State](#8-each-component-instance-has-its-own-state)
9. [Direct Update vs Functional Update — Comparison Table](#9-direct-update-vs-functional-update--comparison-table)
10. [Common Mistakes and Confusions](#10-common-mistakes-and-confusions)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The Problem: Components Need to Remember Things

Let's start with something that looks like it should work, but doesn't.

Say you're building a counter. Click a button, the number goes up. Sounds trivial — you've done this in plain JavaScript a hundred times. Let's try the "obvious" approach inside a React component.

```jsx
function Counter() {
  let count = 0;

  function handleClick() {
    count = count + 1;
    console.log(count); // this DOES print 1, 2, 3...
  }

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={handleClick}>+1</button>
    </div>
  );
}
```

Click the button five times. What does the screen show?

```
Count: 0
Count: 0
Count: 0
Count: 0
Count: 0
```

Still zero. Every single time. But the console log clearly printed 1, 2, 3, 4, 5. So the variable *is* incrementing... so why doesn't the screen update?

---

### Two separate problems are hiding here

**Problem 1 — the variable doesn't survive a re-render.**

A React component is just a function. Every time it runs, JavaScript starts that function fresh, from the top. `let count = 0` runs again, every single render, resetting `count` back to `0`. Plain local variables have no memory across renders — they're recreated from scratch every time.

**Problem 2 — even if the variable *did* survive, nothing tells React to re-render.**

React doesn't watch your variables. It has no idea that `count` changed. Unless something explicitly tells React "hey, go re-run this component and update the screen," the JSX you returned the first time just... stays on screen forever.

So a plain variable fails on both counts:

```
Does it survive between renders?     NO
Does changing it trigger a re-render?  NO
```

That's exactly the gap `useState` was built to close.

---

## 2. Basic useState Syntax

`useState` is a **Hook** — a special function that lets your component "hook into" React's internal machinery. It gives you two things:

1. A value that *does* survive across re-renders.
2. A function that, when called, tells React "please re-render this component."

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
  }

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={handleClick}>+1</button>
    </div>
  );
}
```

Now clicking the button actually works: `Count: 1`, `Count: 2`, `Count: 3`...

---

### Breaking down the syntax, piece by piece

```jsx
const [count, setCount] = useState(0);
//     ^       ^              ^
//     |       |              |
//   current  function to  the initial value,
//   value    request a    used only on the
//            new value    very first render
```

`useState(0)` returns an **array with exactly two elements**:

```js
[currentValue, setterFunction]
```

And we use **array destructuring** to pull them into two nicely named variables. You could technically write this instead:

```jsx
const countState = useState(0);
const count = countState[0];
const setCount = countState[1];
```

...but nobody does, because the destructuring shorthand is so much cleaner. You get to name both halves whatever makes sense for your component — `[isOpen, setIsOpen]`, `[name, setName]`, `[items, setItems]`. The naming convention `[thing, setThing]` is a community convention, not a rule enforced by React, but you should absolutely follow it — it makes every codebase instantly readable.

**The argument to `useState`** is the *initial* value. It's only ever used on the component's very first render. After that, React ignores it completely — the state is already being tracked internally, so passing `useState(0)` again on the second render doesn't reset anything back to zero.

---

## 3. What's Actually Happening Internally

This is the single most important diagram in this entire file. Read it slowly.

```text
┌──────────────────────────────────────────────────────────────────┐
│                  What happens when you call setCount(1)          │
│                                                                    │
│  1. User clicks the button                                        │
│         |                                                          │
│         v                                                          │
│  2. handleClick() runs, calls setCount(count + 1)                 │
│         |                                                          │
│         v                                                          │
│  3. React does NOT change `count` in place, right here, right now │
│     Instead, it just makes a note:                                │
│     "this component's state needs to become 1 —                  │
│      schedule a re-render"                                        │
│         |                                                          │
│         v                                                          │
│  4. The REST of handleClick() keeps running with the OLD          │
│     value of `count` still sitting in its closure                 │
│     (any code after setCount() in this same function call         │
│      still sees the value from THIS render)                       │
│         |                                                          │
│         v                                                          │
│  5. Once the current event handler finishes, React looks at       │
│     its "needs a re-render" notes and re-runs the Counter()       │
│     function from the top                                         │
│         |                                                          │
│         v                                                          │
│  6. On THIS new render, useState(0) returns the NEW value (1)     │
│     A brand new `count` variable is created for this render,      │
│     holding the updated value                                     │
│         |                                                          │
│         v                                                          │
│  7. React compares the new JSX output to the old one and          │
│     updates only the parts of the real DOM that actually changed  │
└──────────────────────────────────────────────────────────────────┘
```

The key sentence to tattoo on your brain:

> Calling the setter **schedules** a re-render. It does not reach back in time and mutate the variable you already have in your hand.

Each render gets its own fresh snapshot of `count`. Calling `setCount` doesn't change *this* render's snapshot — it just tells React "please give me a new snapshot, with an updated value, on the next render."

---

## 4. The Stale Value Trap — Why setValue Doesn't Update Immediately

Let's now walk straight into the most common beginner confusion in all of React, on purpose, so you actually feel it happen.

### The broken version

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
    console.log(count); // <-- what do you expect this to print?
  }

  return <button onClick={handleClick}>Count is: {count}</button>;
}
```

You click the button once, when `count` is `0`. What does `console.log(count)` print?

If you guessed `1` — that's the natural guess, and it's wrong. It prints **`0`**.

Why? Walk back through the diagram in Section 3. `setCount(count + 1)` schedules a re-render with a new value. It does **not** reach into the `count` variable that's already sitting in this function call and change it. That `count` variable was captured when this render of `Counter` happened, and it stays exactly as it was for the rest of this function call — this is often called a **closure** over that render's value. The `console.log` line runs immediately after `setCount`, in the *same* render, so it still sees the old, "stale" value.

```text
Render #1: count = 0
    |
    v
handleClick() called
    |
    v
setCount(0 + 1)  --------->  React notes: "schedule count = 1"
    |                              (this does NOT happen yet)
    v
console.log(count)  ------->  still prints 0
                               (this render's `count` never changes)
    |
    v
handleClick() finishes
    |
    v
React now processes the scheduled update
    |
    v
Render #2: count = 1   <-- the NEW value only exists starting here
```

### An even trickier version — calling setCount multiple times in a row

```jsx
function handleClick() {
  setCount(count + 1);
  setCount(count + 1);
  setCount(count + 1);
}
```

If you clicked this once, starting from `count = 0`, you might expect `count` to become `3`. It doesn't — it becomes `1`.

Why? Because all three lines run in the *same* render, and `count` is `0` in all three of them. Each line is really saying "set count to `0 + 1`", three times in a row. React doesn't add them up — it just ends up with the last instruction: "count should be `1`."

### The fix

The fix for both of these problems is the same: stop reading the *old* value out of the closure, and instead tell React to compute the new value *from whatever the latest value happens to be* at the moment the update actually runs. That's exactly what Section 5 is about.

```jsx
function handleClick() {
  setCount(prev => prev + 1);
  setCount(prev => prev + 1);
  setCount(prev => prev + 1);
}
```

Now clicking once really does take `count` from `0` all the way to `3`.

---

## 5. Functional Updates — setValue(prev => ...)

`useState`'s setter function accepts two different kinds of argument:

```jsx
setCount(5);            // direct value
setCount(prev => prev + 1); // functional update
```

### Direct value

```jsx
setCount(count + 1);
```

This says: "set the state to whatever `count + 1` evaluates to, using the value of `count` from *this* render's closure." That's fine — as long as you don't need perfect accuracy across multiple rapid updates.

### Functional update

```jsx
setCount(prev => prev + 1);
```

This says something different and much safer: "whenever you actually get around to applying this update, hand me whatever the true, most current state value is at that moment (called `prev` here), and I'll compute the new value from *that*." React guarantees that `prev` is the freshest value React knows about — not a stale snapshot from the render that scheduled the call.

### Why this matters — a concrete example

Say a "Like" button needs to increment likes by 3 when double-tapped quickly (a common pattern: batching several rapid actions into one handler).

```jsx
// BROKEN — uses the stale `likes` from this render's closure, three times
function handleTripleLike() {
  setLikes(likes + 1);
  setLikes(likes + 1);
  setLikes(likes + 1);
}
// Result: likes only goes up by 1, no matter how many times you call it

// FIXED — always builds on the true latest value
function handleTripleLike() {
  setLikes(prev => prev + 1);
  setLikes(prev => prev + 1);
  setLikes(prev => prev + 1);
}
// Result: likes correctly goes up by 3
```

### The rule of thumb

> If your new state depends on the *previous* state, use the functional form. If it doesn't depend on the previous state at all, a direct value is perfectly fine.

```jsx
setName("Alice");          // doesn't depend on old name — direct value is fine
setCount(prev => prev + 1); // depends on old count — use the functional form
setIsOpen(prev => !prev);   // depends on old boolean — use the functional form
```

This especially matters inside things like `setInterval` callbacks, event handlers that might fire multiple times before a re-render happens, or any code path where you're not 100% sure how "fresh" the closed-over variable still is. The functional form sidesteps the whole stale-closure problem by never reading the closure's value in the first place.

---

## 6. State With Objects and Arrays — Why You Must Copy, Not Mutate

Here's another trap that looks completely harmless.

```jsx
function ProfileForm() {
  const [user, setUser] = useState({ name: "Alice", age: 25 });

  function handleBirthday() {
    user.age = user.age + 1;   // mutating the object directly
    setUser(user);              // passing back the SAME object reference
  }

  return (
    <div>
      <p>{user.name} is {user.age}</p>
      <button onClick={handleBirthday}>Happy birthday!</button>
    </div>
  );
}
```

Click the button. Nothing happens on screen — even though if you `console.log(user.age)` it really did change.

### Why doesn't this work?

React needs a fast way to decide "did the state actually change, so I should re-render?" Instead of deeply comparing every field of every object (which would be slow, especially for big objects), React uses a cheap shortcut: **it compares object references.**

```text
oldUser === newUser  ?
```

When you mutate `user.age` directly and then call `setUser(user)`, you're passing back the *exact same object in memory*. As far as that `===` check is concerned, nothing changed — same reference in, same reference out. React sees no difference and may decide there's nothing to update.

### The fix — always create a new object (or array)

```jsx
function handleBirthday() {
  setUser({ ...user, age: user.age + 1 });
}
```

The spread syntax `{ ...user }` copies every existing key onto a **brand new object**, and then `age: user.age + 1` overwrites just that one key on the new copy. The old `user` object is left completely untouched. Now `oldUser === newUser` is `false`, exactly as it should be, and React knows to re-render.

```text
Before:  user = { name: "Alice", age: 25 }   (object A, in memory location X)

setUser({ ...user, age: 26 })

After:   user = { name: "Alice", age: 26 }   (object B, a brand new memory location Y)

X !== Y  -->  React correctly detects a change
```

### The exact same rule applies to arrays

```jsx
const [items, setItems] = useState(["apple", "banana"]);

// WRONG — mutates the existing array in place
function addItem(item) {
  items.push(item);
  setItems(items);
}

// RIGHT — creates a brand new array
function addItem(item) {
  setItems([...items, item]);
}

// WRONG — mutates in place
function removeFirst() {
  items.shift();
  setItems(items);
}

// RIGHT — creates a new array via filtering/slicing
function removeFirst() {
  setItems(items.slice(1));
}
```

Common array operations, mutating vs. non-mutating:

| Goal | Mutating (avoid) | Non-mutating (use this) |
|---|---|---|
| Add to end | `items.push(x)` | `[...items, x]` |
| Add to start | `items.unshift(x)` | `[x, ...items]` |
| Remove an item | `items.splice(i, 1)` | `items.filter((_, idx) => idx !== i)` |
| Update an item | `items[i] = x` | `items.map((it, idx) => idx === i ? x : it)` |
| Sort | `items.sort()` | `[...items].sort()` |

The general principle, one more time because it matters so much:

> **Treat state as read-only.** Never change an object or array that's currently stored in state. Always build a new one and hand that new one to the setter.

---

## 7. Lazy Initial State

Here's a smaller, more performance-focused concept, worth knowing but not worth losing sleep over.

```jsx
function ExpensiveComponent() {
  const [data, setData] = useState(computeExpensiveInitialValue());
  // ...
}
```

The problem: `computeExpensiveInitialValue()` runs on **every single render** of this component — even though its return value only actually gets *used* on the very first render. On every re-render after that, React throws the result away, but you still paid the cost of running the function.

The fix — pass a **function** to `useState` instead of a value:

```jsx
function ExpensiveComponent() {
  const [data, setData] = useState(() => computeExpensiveInitialValue());
  // ...
}
```

This is called **lazy initial state**. React only calls that function once, on the very first render, to get the initial value. On every subsequent render, React skips calling it entirely — it already knows the state, so there's no reason to.

```text
useState(computeExpensiveInitialValue())     <- runs the function EVERY render
useState(() => computeExpensiveInitialValue()) <- runs the function ONCE, ever
```

This matters when the initial value comes from something genuinely expensive — parsing a large JSON blob, reading from `localStorage`, running a heavy calculation. For something cheap like `useState(0)` or `useState("")`, this optimization isn't worth the extra syntax — save it for when it actually matters.

---

## 8. Each Component Instance Has Its Own State

One more thing worth knowing early, even though you'll feel its full weight later when you learn about reconciliation.

```jsx
function App() {
  return (
    <>
      <Counter />
      <Counter />
      <Counter />
    </>
  );
}
```

Even though all three `<Counter />` elements are rendered from the exact same function, each one gets its **own, completely independent** `count` state. Clicking the button on the first counter has zero effect on the second or third. React tracks state per component *instance* — think of each `<Counter />` on screen as its own separate little box of memory, not a shared variable that all three happen to read from.

---

## 9. Direct Update vs Functional Update — Comparison Table

| | Direct update `setValue(x)` | Functional update `setValue(prev => ...)` |
|---|---|---|
| Reads old state from | The closure of the current render | Whatever React's latest actual state is |
| Safe when new state doesn't depend on old state | Yes — perfectly fine | Also fine, but unnecessary |
| Safe when new state depends on old state | **Not safe** — can use a stale value | **Safe** — always correct |
| Safe for multiple rapid calls in one handler | No — later calls overwrite earlier ones | Yes — each call builds on the previous one |
| Typical use case | `setName("Alice")`, `setIsOpen(true)` | `setCount(prev => prev + 1)`, toggles, counters in loops |
| Risk if used incorrectly | Silent stale-value bugs, "off by however-many" counts | None — it's the always-safe choice |

If you're ever unsure which to use, the functional form is never wrong — it's just occasionally unnecessary. When in doubt, reach for `prev =>`.

---

## 10. Common Mistakes and Confusions

This is the section worth re-reading before an interview.

**Mistake 1 — Mutating state directly.**

```jsx
// WRONG
user.age = 26;
setUser(user);

// RIGHT
setUser({ ...user, age: 26 });
```

React's re-render decision leans on reference equality. Mutating in place keeps the same reference, so React may not notice anything changed.

**Mistake 2 — Reading state right after calling its setter and expecting the new value.**

```jsx
setCount(count + 1);
console.log(count); // still the OLD value — this render's snapshot never changes
```

The update is scheduled, not applied synchronously. The `count` variable in this render's closure is frozen for the life of this render.

**Mistake 3 — Assuming multiple setter calls in one handler will stack up.**

```jsx
setCount(count + 1);
setCount(count + 1); // still using the same stale `count` — doesn't add up to +2
```

Fix: use the functional form so each call builds on the true latest value, not a shared stale snapshot.

**Mistake 4 — Stale closures in things like `setInterval` or delayed callbacks.**

```jsx
useEffect(() => {
  const id = setInterval(() => {
    setCount(count + 1); // `count` here is frozen at whatever it was when the effect ran
  }, 1000);
  return () => clearInterval(id);
}, []); // count is missing from deps, so this closure never sees updated counts
```

The interval callback closes over the `count` value from whichever render set up the interval, and (with an empty dependency array) that effect never re-runs to "refresh" its closure. Using `setCount(prev => prev + 1)` sidesteps the problem entirely, since it never reads `count` from the closure at all.

**Mistake 5 — Thinking `setState` updates the screen synchronously, line by line.**

```jsx
setCount(5);
console.log("did the screen update yet?"); // no — this line runs before any re-render happens
```

Calling the setter never blocks or immediately re-renders mid-function. It schedules work; React decides when to actually do that work (typically once the current event handler function finishes running).

**Mistake 6 — Forgetting that `useState`'s argument is only used once.**

```jsx
const [count, setCount] = useState(getInitialCountFromSomewhere());
```

If `getInitialCountFromSomewhere()` returns a different value on a later render, it's ignored — the initial value only ever matters for the very first render of this component instance.

---

## 11. Hands-On Exercises

**Exercise 1 — Basic counter**

Build a `Counter` component with `+1`, `-1`, and `Reset` buttons using `useState`. Confirm that the displayed number updates correctly for all three buttons.

**Exercise 2 — Reproduce the stale value bug**

Write a component with a button whose click handler calls `setCount(count + 1)` three times in a row, followed by a `console.log(count)`. Predict what the console prints and what the final displayed count is *before* running it. Then run it and compare. Fix it using the functional update form so three clicks correctly adds 3.

**Exercise 3 — Object state without mutation**

Build a small profile editor: `{ name: "", email: "" }` in state, with two `<input>` fields. Each `onChange` should update only its own field, using spread syntax, without mutating the existing object. Add a `console.log` proving the object reference changes on every update (`oldValue === newValue` should be `false`).

**Exercise 4 — Array state: a simple to-do list**

Build a to-do list with an `items` array in state. Implement "add item," "remove item by index," and "toggle completed by index" — all without mutating the array in place. Use `map`, `filter`, and spread syntax as appropriate.

**Exercise 5 — Lazy initial state**

Write a function `computeExpensiveValue()` that has a `console.log("computing...")` inside it (simulating expensive work) and returns a number. Use it as `useState(computeExpensiveValue())` in a component that also has an unrelated piece of state that changes on a button click (to force re-renders). Watch the console log fire on every re-render. Fix it with the lazy form `useState(() => computeExpensiveValue())` and confirm the log only fires once.

**Exercise 6 — Independent component instances**

Render three `<Counter />` components side by side. Click the button on only the middle one several times. Confirm in the UI that the other two are unaffected, and explain in a one-sentence comment why that's the case.

---

## 12. Interview Q&A

**Q1: Why can't you just use a regular `let` variable to store a component's state?**

A: A component is a function, and every re-render calls that function again from scratch. A `let` variable declared inside the function body gets reinitialized to its starting value on every call, so it can't "remember" anything across renders. Even if it somehow could, changing a plain variable doesn't tell React to re-render — React only re-renders in response to state or prop changes it's explicitly tracking.

---

**Q2: What does `useState` return, and why is array destructuring used instead of an object?**

A: It returns a two-element array: `[currentValue, setterFunction]`. Array destructuring is used (instead of an object) because array destructuring lets you name both elements whatever you want at the call site — `const [count, setCount] = ...` — without needing to match specific key names. With an object you'd be stuck with fixed property names unless you used renaming syntax every time.

---

**Q3: Why is calling the state setter described as "asynchronous" or "scheduling" a re-render rather than updating state immediately?**

A: Calling the setter doesn't synchronously mutate anything in the current function call — it registers an update with React. React then decides when to actually process that update and re-render, typically batching it together with other updates from the same event handler for efficiency. Because of this, reading the state variable immediately after calling its setter, within the same render, still returns the old value — the new value only exists starting from the next render.

---

**Q4: What is React 18's "automatic batching," and how does it relate to this asynchronous behavior?**

A: Automatic batching means React groups multiple state updates that occur within the same event handler (and, since React 18, even inside promises, timeouts, and other async callbacks) into a single re-render, instead of re-rendering once per `setState` call. This is why calling a setter multiple times in one handler doesn't cause multiple separate re-renders, and it reinforces why you can't rely on reading updated state synchronously right after calling a setter.

---

**Q5: What's the difference between `setCount(count + 1)` and `setCount(prev => prev + 1)`?**

A: The first reads `count` from the current render's closure — a value that's frozen for that render, and can be stale if called multiple times or across delayed callbacks. The second passes a function that React calls with the true, most up-to-date state value at the moment the update actually gets applied, avoiding any stale-closure issues. Use the functional form whenever the new state depends on the previous state.

---

**Q6: If you call `setCount(count + 1)` three times in a row inside one click handler, what's the final count, and why?**

A: It only increases by 1, not 3. All three calls read `count` from the same render's closure, so all three effectively say "set state to `oldValue + 1}`" — React ends up applying the same instruction three times, not stacking three separate increments. Using `setCount(prev => prev + 1)` three times instead correctly increases the count by 3.

---

**Q7: Why must you create a new object or array instead of mutating state directly?**

A: React decides whether to re-render partly by comparing the old and new state values using reference equality (`===`). If you mutate an object or array in place and pass the same reference back into the setter, the reference hasn't changed, so React may conclude nothing changed and skip re-rendering — even though the data inside the object did change. Creating a new object/array (typically via spread syntax) guarantees a new reference, so React correctly detects the update.

---

**Q8: How do you correctly add an item to an array stored in state?**

A: Create a new array rather than mutating the existing one — for example, `setItems([...items, newItem])` instead of `items.push(newItem); setItems(items)`. The spread creates a new array containing all existing items plus the new one, leaving the original array reference untouched.

---

**Q9: What is lazy initial state, and when should you use it?**

A: It's passing a function to `useState`, like `useState(() => expensiveComputation())`, instead of passing the computed value directly, like `useState(expensiveComputation())`. With a direct value, the expensive computation runs on every render even though the result is only used on the first one. With the function form, React only calls it once, on the initial render. Use it when the initial value requires meaningfully expensive work — parsing large data, reading from storage — not for cheap defaults like `0` or `""`.

---

**Q10: Do multiple instances of the same component share state?**

A: No. Each rendered instance of a component gets its own, independent state. Rendering `<Counter />` three times creates three separate, isolated `count` values — updating one has no effect on the others. React tracks state per component instance internally, not per component function definition.

---

**Q11: What's a "stale closure," and how does it relate to `useState`?**

A: A stale closure happens when a function (like an event handler, a `setInterval` callback, or a `setTimeout` callback) captures a state variable's value at the time it was created, and that value never gets refreshed even as state changes later. For example, an interval set up once inside `useEffect` with an empty dependency array will keep referencing the state value from whenever the effect first ran. The usual fixes are using the functional update form (which doesn't depend on the closed-over value) or correctly including dependencies so the closure gets recreated with fresh values.

---

**Q12: If you call `useState(0)` inside a component, and the component re-renders 10 times, does `useState(0)` reset the state back to `0` each time?**

A: No. The argument passed to `useState` is only used to initialize state on the component instance's very first render. On every subsequent render, React already has the current state value stored internally and simply returns it — the initial-value argument is ignored from the second render onward.

---

**Q13: Why does `console.log(value)` right after `setValue(newValue)` print the old value instead of the new one?**

A: Because `setValue` doesn't mutate the `value` variable that already exists in the current render's closure — it schedules a re-render where a fresh `value` (equal to `newValue`) will exist. The `console.log` line runs in the same render, using the same closure, so it still sees whatever `value` was before the setter was called. The new value only becomes visible starting from the next render of the component.

---

**Q14: When is it safe to use a direct value update like `setName("Alice")` instead of a functional update?**

A: When the new state doesn't depend on the previous state at all — you're just replacing it with a fresh, independently-known value. Since there's no old value being read or built upon, there's no stale-closure risk. Functional updates matter specifically when the next state is computed *from* the current state, such as incrementing a counter or toggling a boolean.

---

**Q15: How would you update a single field in an object stored in state without affecting the other fields?**

A: Spread the existing object into a new object literal, then overwrite just the one field you want to change: `setUser({ ...user, email: newEmail })`. This copies every other existing key onto the new object unchanged, while the specified key gets the new value — and critically, it produces a brand new object reference, which is what lets React correctly detect the state change.

---

> **Memory hook:** "Calling the setter doesn't rewrite the note in your hand — it puts a fresh note on next render's desk."
