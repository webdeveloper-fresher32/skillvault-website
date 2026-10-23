# 01 — Props Basics

> "Props are how a parent talks to a child. Callbacks are how a child talks back. The conversation only ever flows in those two directions — never sideways, never through the child reaching backward."

---

## Table of Contents

1. [The Problem Props Solve](#1-the-problem-props-solve)
2. [What Props Actually Are](#2-what-props-actually-are)
3. [Destructuring Props vs the Props Object](#3-destructuring-props-vs-the-props-object)
4. [Default Prop Values](#4-default-prop-values)
5. [Passing Different Types of Props](#5-passing-different-types-of-props)
   - 5.1 [Strings, Numbers, Booleans](#51-strings-numbers-booleans)
   - 5.2 [Objects and Arrays](#52-objects-and-arrays)
   - 5.3 [Function Props — The Callback Pattern](#53-function-props--the-callback-pattern)
6. [The `children` Prop, Briefly](#6-the-children-prop-briefly)
7. [Props Are Read-Only](#7-props-are-read-only)
8. [Type-Checking Props: PropTypes and TypeScript](#8-type-checking-props-proptypes-and-typescript)
9. [Props vs State](#9-props-vs-state)
10. [Common Mistakes](#10-common-mistakes)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The Problem Props Solve

Let's start with a scenario, not a definition.

You're building a UI and you need buttons. Lots of them:

```
"Save" button, green
"Delete" button, red
"Cancel" button, grey
"Submit" button, blue, disabled until the form is valid
"Learn More" button, blue, opens a link
```

Ten places in your app, ten buttons, all slightly different: different text, different color, different behavior when clicked.

**The naive approach:** write a separate component for each one.

```jsx
function SaveButton() {
  return <button className="green">Save</button>;
}

function DeleteButton() {
  return <button className="red">Delete</button>;
}

function CancelButton() {
  return <button className="grey">Cancel</button>;
}

// ...seven more of these, each one 95% identical to the last
```

Look at those three components. They're all a `<button>`. They all render some text. They all have a class name. The *only* thing that changes is the label and the color. Everything else is copy-pasted.

Now imagine the button's HTML needs to change — maybe you need to add an icon, or fix an accessibility attribute. You'd have to make that same edit in ten different files, and if you forget one, now you have ten buttons that are supposed to look and behave identically, quietly drifting apart.

That's the smell: **near-duplicate components that differ only in the data they're filled with, not in their structure.**

**The fix:** write the button *once*, and let whoever uses it pass in the parts that change.

```jsx
function Button({ label, color }) {
  return <button className={color}>{label}</button>;
}

// now every usage is one line
<Button label="Save" color="green" />
<Button label="Delete" color="red" />
<Button label="Cancel" color="grey" />
```

One component. Ten usages. Zero duplication.

That `label` and `color` — the values flowing in from the outside — are **props**. This entire file is about that one idea, and everything that follows from it.

---

## 2. What Props Actually Are

### The analogy first

Here's the cleanest way to think about it: **a component is a function, and props are its arguments.**

```js
// a plain JS function
function greet(name, greeting) {
  return `${greeting}, ${name}!`;
}

greet("Priya", "Good morning");
```

```jsx
// a React component — structurally the same idea
function Greeting({ name, greeting }) {
  return <p>{greeting}, {name}!</p>;
}

<Greeting name="Priya" greeting="Good morning" />
```

`greet("Priya", "Good morning")` and `<Greeting name="Priya" greeting="Good morning" />` are doing the exact same job: calling something reusable, and handing it the specific values it needs *this time*.

If you already have the instinct "don't hardcode values inside a function, pass them as arguments so the function stays reusable" — you already understand 80% of props. React just gives that idea a JSX spelling and a special name.

### The basic definition

**Props** ("properties") are the inputs a component receives from whoever renders it. They're written as JSX attributes on the component tag, and React collects all of them into a single object that gets passed to the component function.

```jsx
<Greeting name="Priya" greeting="Good morning" />
```

is really shorthand for React calling:

```js
Greeting({ name: "Priya", greeting: "Good morning" });
```

That's it. There's no framework magic beyond "collect the attributes into an object, call the function with that object."

### The one-way street

Here's the detail that matters more than anything else in this file:

> **Props flow in exactly one direction: from parent to child. Never sideways. Never from child back up automatically.**

Picture a component tree:

```
        <App>
          |
     renders <UserCard name="Priya" role="Admin" />
          |
          v
     <UserCard>  (the child)
```

`App` is the **parent**. `UserCard` is the **child**. `App` decides what data `UserCard` gets, by writing it as props on the JSX tag. `UserCard` has no say in this — it just receives whatever it's handed and renders it.

Now here's the part that trips people up: **`UserCard` cannot reach back up and hand data to `App`.** There is no built-in mechanism for a child to just "set" something on its parent. The arrow only points one way.

If that's true, how does a child ever tell its parent "hey, the user clicked something" or "hey, this input changed"? That question is important enough that it gets its own full section — [5.3, the callback pattern](#53-function-props--the-callback-pattern) — because the answer to it is one of the most-tested ideas in React interviews.

---

## 3. Destructuring Props vs the Props Object

React always hands your component function a single object — call it whatever you want, but by convention it's called `props`.

### Option A — the raw `props` object

```jsx
function UserCard(props) {
  return (
    <div>
      <h3>{props.name}</h3>
      <p>{props.role}</p>
    </div>
  );
}
```

This works fine. But notice you're typing `props.` in front of everything, and if the component has eight props, you're doing that eight times. It also makes it harder to tell, at a glance, exactly which props this component actually cares about — you'd have to read the whole body to find every `props.something`.

### Option B — destructuring in the function signature

```jsx
function UserCard({ name, role }) {
  return (
    <div>
      <h3>{name}</h3>
      <p>{role}</p>
    </div>
  );
}
```

Same component, same behavior. But now, just by glancing at the function signature — `{ name, role }` — you immediately know: "this component accepts exactly two props: `name` and `role`." That signature acts like free, self-documenting documentation.

This is why destructuring is the convention you'll see in almost every React codebase, tutorial, and job posting today. There's nothing wrong with Option A — it's the same JavaScript feature either way, just applied at a different spot — but Option B is what you should default to.

**One more subtlety worth knowing:** you can destructure *and* still keep the rest of the props around, using the rest operator:

```jsx
function Button({ label, ...rest }) {
  // rest now contains every other prop that was passed,
  // e.g. { onClick: ..., disabled: true }
  return <button {...rest}>{label}</button>;
}
```

This is a common pattern for building wrapper components — pull out the props you specifically care about, and forward everything else straight to the underlying element.

---

## 4. Default Prop Values

Sometimes a prop is optional, and you want a sensible fallback if the caller doesn't pass it.

```jsx
function Button({ label, color = "blue" }) {
  return <button className={color}>{label}</button>;
}

<Button label="Save" />              {/* color defaults to "blue" */}
<Button label="Delete" color="red" /> {/* color is "red" */}
```

This is nothing React-specific — it's plain JavaScript **default parameters**, applied at the point where you destructure. If `color` is `undefined` when the object is destructured, JavaScript fills in `"blue"` for you.

**A quick note on legacy syntax:** older React code (and older tutorials) sometimes use a static `defaultProps` property attached to the component:

```jsx
// legacy pattern — you'll still see this in older codebases
function Button({ label, color }) {
  return <button className={color}>{label}</button>;
}
Button.defaultProps = {
  color: "blue",
};
```

This still works, but it's considered legacy for function components — default parameters in the destructuring signature (the version at the top of this section) is the modern, preferred way, and it's what you should reach for in new code.

**One gotcha to file away:** default values only kick in when the prop is `undefined` — not when it's `null`, `0`, `false`, or `""`. If a parent explicitly passes `color={null}`, the child receives `null`, not `"blue"`. Keep that in mind if a "default that isn't applying" bug ever shows up.

---

## 5. Passing Different Types of Props

Props aren't limited to strings. Anything that's a valid JavaScript value can be a prop — including numbers, booleans, objects, arrays, and even functions.

### 5.1 Strings, Numbers, Booleans

```jsx
<Avatar
  name="Priya"        // string — quotes, just like an HTML attribute
  size={64}           // number — curly braces, because it's JS, not a string
  isOnline={true}     // boolean — curly braces again
/>
```

Notice the syntax difference. `name="Priya"` looks like a normal HTML attribute because it *is* a plain string literal. But the moment you want to pass something that isn't a string — a number, a boolean, an object, a variable — you switch to curly braces, because you're now writing a JavaScript expression, not a string.

A common beginner slip:

```jsx
<Avatar size="64" />   // this passes the STRING "64", not the number 64
<Avatar size={64} />   // this passes the actual number
```

Both might *look* fine on screen if the code happens to do string-to-number coercion somewhere, but they are not the same value, and if your component does math with `size` (like `size / 2`), passing a string can quietly produce bugs (`"64" / 2` happens to coerce correctly in JS, but `"64" + 1` would give you `"641"`, not `65`).

**Booleans have a shorthand.** Instead of writing:

```jsx
<Checkbox checked={true} />
```

you can just write:

```jsx
<Checkbox checked />
```

Writing the attribute name with no value at all is JSX's shorthand for "pass `true`." This is exactly parallel to plain HTML, where `<input disabled>` means "disabled is on" without needing `disabled="true"`.

### 5.2 Objects and Arrays

You can pass a whole object as a single prop, instead of spreading its fields into separate props one by one.

```jsx
const user = { name: "Priya", role: "Admin", joined: "2023" };

<UserCard user={user} />

function UserCard({ user }) {
  return (
    <div>
      <h3>{user.name}</h3>
      <p>{user.role}</p>
    </div>
  );
}
```

This is especially handy when you already have the data grouped together (say, it came back from an API as one object) — you're not forced to break it apart into `name="..."` `role="..."` on the JSX tag.

Arrays work the same way — useful for handing a list down to a component that's going to render it:

```jsx
const tags = ["react", "javascript", "frontend"];

<TagList tags={tags} />

function TagList({ tags }) {
  return (
    <ul>
      {tags.map((tag) => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  );
}
```

### 5.3 Function Props — The Callback Pattern

This is the section worth reading twice. If you remember one thing from this entire file besides "props flow down," make it this.

**The setup:** props flow one way, parent to child. So if a button lives inside a child component, and the *parent* needs to know when that button gets clicked... how does the child tell it? The child can't reach up and change something on the parent directly — that mechanism doesn't exist.

**The answer: the parent passes a function down as a prop, and the child calls that function when something happens.**

Walk through it slowly:

```jsx
function App() {
  function handleSave() {
    console.log("Saved!");
  }

  return <SaveButton onSave={handleSave} />;
}

function SaveButton({ onSave }) {
  return <button onClick={onSave}>Save</button>;
}
```

Here's what's happening, step by step:

1. `App` defines a function, `handleSave`. `App` owns this function — it lives in `App`'s scope, it can update `App`'s own state, it can do whatever `App` needs it to do.
2. `App` hands that function *down* to `SaveButton`, as a prop called `onSave`. This is still just a normal prop — a function is a perfectly ordinary JavaScript value, and props can be any value.
3. `SaveButton` doesn't know or care what `onSave` actually does internally. It just knows: "when the button is clicked, call whatever function I was given."
4. When the user clicks, `SaveButton` calls `onSave()` — which is really `handleSave()` running back in `App`'s scope.

The data (the function reference) moved down, from parent to child, exactly like every other prop. But because that piece of data happens to be a *callback*, calling it lets information effectively travel back up — without ever breaking the one-way rule.

### Seeing the whole loop as one diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                         <App>  (parent)                     │
│                                                               │
│   function handleSave() { ... }                              │
│                                                               │
│        │                                    ▲                │
│        │ 1. passes handleSave               │ 4. call        │
│        │    down as prop "onSave"            │    triggers    │
│        ▼                                    │    handleSave  │
│                                                │    running     │
│                    <SaveButton onSave={handleSave} />  back here│
│                              │                                │
│                              │ receives onSave as a prop      │
│                              ▼                                │
│                    <button onClick={onSave}>Save</button>     │
│                              │                                │
│                              │ 2. user clicks                 │
│                              ▼                                │
│                    3. onClick fires → calls onSave()           │
│                              │                                │
│                              └───────────────┘ (loops back up) │
└─────────────────────────────────────────────────────────────┘
```

Read that diagram as two separate trips:

- **Trip down (props, the normal direction):** the function reference travels from `App` to `SaveButton`, exactly like a string or a number would.
- **Trip up (the "escape hatch"):** when `SaveButton` *calls* that function, execution jumps back into `App`'s scope, letting `App` react to something that happened inside its child.

This is why people describe it as **"unidirectional data flow with a callback escape hatch."** Data still only flows one way structurally — but by passing a function as that data, you get a controlled, deliberate way for a child to notify its parent, instead of the child ever mutating the parent directly.

**A slightly richer example — passing information along with the call:**

```jsx
function App() {
  function handleDelete(userId) {
    console.log("Deleting user", userId);
  }

  return <UserRow userId={42} onDelete={handleDelete} />;
}

function UserRow({ userId, onDelete }) {
  return (
    <button onClick={() => onDelete(userId)}>
      Delete user #{userId}
    </button>
  );
}
```

Notice `onClick={() => onDelete(userId)}` — the child wraps the callback in its own arrow function so it can pass along *which* user was clicked. The parent ends up knowing exactly what happened inside the child (`userId` 42 was the one deleted), even though the child never touched the parent's state directly. It just called a function the parent handed it, and passed along the relevant details as an argument.

This exact pattern — `onSomething` prop, called by the child, handled by the parent — is how virtually every interactive component in React communicates upward: form inputs telling a parent "the value changed," a modal telling a parent "close me," a list item telling a parent "I was clicked." You will use this pattern constantly.

---

## 6. The `children` Prop, Briefly

There's one special prop worth knowing about here, even though the full treatment of it — and the composition patterns built on top of it — is coming in the next file in this phase (`02-Composition-Patterns.md`).

Whatever you put *between* a component's opening and closing tags is automatically passed to that component as a prop called `children`.

```jsx
<Card>
  <h2>Hello</h2>
  <p>This is inside the card.</p>
</Card>

function Card({ children }) {
  return <div className="card">{children}</div>;
}
```

`Card` never needs to know exactly what's inside it — a heading, a paragraph, another component entirely. It just says "put whatever `children` is, right here." This is what lets you build generic wrapper components (cards, modals, layout containers) that don't need to hardcode their contents.

For now, just file `children` away as "a prop that comes from what's written between the tags, instead of from an attribute." The deeper patterns — slots, compound components, render props — live in the next lesson.

---

## 7. Props Are Read-Only

Here's a rule that's easy to state and surprisingly easy to accidentally break:

> **A component must never modify its own props.**

Props belong to the parent. The child only *borrows* them for rendering. If a child reaches in and changes a prop directly, it's quietly editing data it doesn't own — and the parent has no idea this happened.

```jsx
// DON'T DO THIS
function UserCard({ user }) {
  user.name = user.name.toUpperCase(); // mutating a prop directly
  return <h3>{user.name}</h3>;
}
```

Why is this dangerous, specifically?

- If `user` is an object and you mutate one of its fields, and that *same object reference* is also being used somewhere else (maybe the parent passed the same object to two different children, or is holding onto it in state), your mutation leaks into every place that shares the reference. You've caused an invisible side effect nowhere near where the bug will actually show up.
- React relies on being able to compare "old props" vs "new props" to decide whether to re-render. Mutating in place can quietly break that comparison, since the object reference doesn't actually change even though its contents did — React may not notice anything changed at all.
- It also just breaks the mental model that makes components predictable: "given these inputs, render this output." A component that secretly rewrites its own inputs is no longer purely a function of its props.

**The correct approach: derive a new value instead of mutating the original.**

```jsx
// DO THIS
function UserCard({ user }) {
  const displayName = user.name.toUpperCase(); // a new value, original untouched
  return <h3>{displayName}</h3>;
}
```

Same result on screen. The difference is that `user` itself — the object the parent owns — is left completely untouched.

If a component genuinely needs to change data over time (a counter that increments, a form field that updates as you type), that's not a job for props at all — that's what **state** is for, which you'll meet properly in Phase 03. Props are the read-only snapshot handed in from outside; state is the data a component is allowed to change itself.

---

## 8. Type-Checking Props: PropTypes and TypeScript

Right now, nothing stops you from passing the wrong type of prop:

```jsx
<Avatar size="sixty-four" />   // was expecting a number, gets a string — no error, no warning
```

React won't crash. It'll just quietly do the wrong thing (or crash later, somewhere confusing, when your code tries to do math on a string). Two tools exist to catch this earlier.

**PropTypes** — a small library (`prop-types`) you can attach to a component to declare expected prop types at runtime:

```jsx
import PropTypes from "prop-types";

function Avatar({ name, size }) {
  return <img alt={name} width={size} />;
}

Avatar.propTypes = {
  name: PropTypes.string.isRequired,
  size: PropTypes.number,
};
```

If someone passes the wrong type in development, React logs a console warning telling you exactly which prop and which component. It doesn't stop your app from running — it's just a heads-up, and only in development mode.

**TypeScript** — the far more common approach in modern React codebases. Instead of a runtime check, the prop shape is defined as a type, and your editor/compiler catches mismatches *before* the code ever runs:

```tsx
type AvatarProps = {
  name: string;
  size?: number; // the ? marks it optional
};

function Avatar({ name, size = 40 }: AvatarProps) {
  return <img alt={name} width={size} />;
}

<Avatar size="sixty-four" />  // red squiggly line in your editor, immediately
```

The practical difference: PropTypes tells you about a mistake when the buggy code actually runs (and only if that code path gets hit during development). TypeScript tells you the moment you write the mistake, without running anything at all. That's a big part of why most modern React projects reach for TypeScript over PropTypes today.

This file only needed you to know these tools exist and roughly how each one is used. The deeper mechanics — union types, generics for props, complex shapes — belong to File 03 in this phase.

---

## 9. Props vs State

You've now seen props from every angle. Before moving on, it's worth drawing a hard line between props and their closest relative, state — even though state itself is a full topic for Phase 03. Knowing the boundary now will make that phase click much faster.

| | Props | State |
|---|---|---|
| **Who owns it** | The parent (passed down to the child) | The component itself |
| **Who can change it** | Only the parent — by re-rendering with new values | The component itself, via its own logic |
| **Can the component change it directly?** | No — read-only, must never be mutated | Yes — that's the whole point of state |
| **Where does it come from** | Passed in from outside, as JSX attributes | Declared and managed inside the component |
| **Direction of flow** | Top-down, parent → child | Local — lives and dies with the component instance |
| **Analogy** | Function arguments | A variable declared inside the function body |
| **Typical use** | Configuring how a reusable component behaves for this particular usage | Tracking something that changes over time (a counter, an input's current value, whether a modal is open) |

The short version, if you need one sentence: **props are handed to a component from the outside and must be treated as read-only; state is data a component manages and changes on its own.** A component can absolutely have both at once — props configuring what it is, state tracking what it's currently doing.

---

## 10. Common Mistakes

**Mistake 1 — Mutating a prop directly.**

```jsx
function List({ items }) {
  items.push("new item"); // mutating the array the parent handed you
  return <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>;
}
```

The parent still holds a reference to that same array. You just changed it out from under them, with no re-render triggered and no way for the parent to know. Build a new array instead: `const updated = [...items, "new item"]`.

---

**Mistake 2 — Expecting a prop to update itself over time.**

Props only change when the *parent* re-renders and passes new values. A component can't watch its own props and expect them to spontaneously change — nothing is "watching" a prop the way a spreadsheet cell watches a formula. If a value needs to change in response to user interaction inside the component, that's state, not a prop.

---

**Mistake 3 — Forgetting curly braces for non-string values.**

```jsx
<Counter startAt="10" />   // startAt is the STRING "10"
<Counter startAt={10} />   // startAt is the NUMBER 10
```

If your component later does `startAt + 1` expecting a number, the string version quietly gives you `"101"` instead of `11`. JSX only auto-treats quoted values as strings — everything else needs curly braces.

---

**Mistake 4 — Trying to "pass data back up" without a callback.**

Some beginners, on first learning that props flow down, try to find some way to write directly back into the parent's variables from inside the child. There isn't one, and there shouldn't be — that's exactly the invariant React is protecting. If a child needs to inform a parent of something, the parent hands the child a function as a prop, and the child calls it. That's the *only* sanctioned way information travels upward.

---

**Mistake 5 — Confusing "props changed" with "component re-rendered for another reason."**

A component can re-render for several reasons (its own state changed, its parent re-rendered, a context value changed) — not only because its props changed. Don't assume every re-render you see in a debugger means new props arrived; check what actually changed before concluding "it's a props problem."

---

## 11. Hands-On Exercises

**Exercise 1 — Build a Reusable Button**

Recreate the `Button` component from Section 1: it should accept `label` and `color` props, default `color` to `"blue"` if not provided, and render a `<button>` with the label as its text and the color as its class name. Render at least four different `<Button />` usages with different combinations of props (including one that omits `color` entirely, to prove the default works).

---

**Exercise 2 — Destructuring Practice**

Given this component written with the raw `props` object:

```jsx
function ProductCard(props) {
  return (
    <div>
      <h3>{props.name}</h3>
      <p>${props.price}</p>
      {props.inStock ? <span>In Stock</span> : <span>Sold Out</span>}
    </div>
  );
}
```

Rewrite it using destructuring in the function signature. Then add a default value so that if `inStock` isn't passed, it defaults to `true`.

---

**Exercise 3 — The Callback Pattern**

Build two components: `App` and `LikeButton`. `App` should keep track of a like count using a plain variable for now (state comes later — for this exercise, just `console.log` the new count). `LikeButton` should accept an `onLike` prop, and call it (with no arguments) when its button is clicked. Wire them together so clicking the button in `LikeButton` causes `App`'s function to run.

Then extend it: make `LikeButton` also accept a `postId` prop, and have it call `onLike(postId)` instead of `onLike()`, so the parent knows *which* post was liked.

---

**Exercise 4 — Objects and Arrays as Props**

You have this data:

```js
const article = {
  title: "Understanding Props",
  author: "Priya Sharma",
  tags: ["react", "beginner", "props"],
};
```

Build an `ArticlePreview` component that accepts a single `article` prop (the whole object) and renders the title, the author, and the tags as a bulleted list. Do not destructure individual fields like `title` and `author` as separate props — pass the entire object as one prop, and access its fields inside the component.

---

**Exercise 5 — Spot the Bug**

The following component has a bug related to props. Find it and explain, in one or two sentences, why it's a problem — then fix it.

```jsx
function Cart({ items }) {
  function addFreeGift() {
    items.push({ name: "Free Sticker", price: 0 });
  }

  addFreeGift();

  return (
    <ul>
      {items.map((item) => (
        <li key={item.name}>{item.name} — ${item.price}</li>
      ))}
    </ul>
  );
}
```

---

**Exercise 6 — Props vs State Sorting Exercise**

For each of the following pieces of data, decide whether it should be a **prop** or **state**, and justify your answer in one sentence:

1. The text label on a reusable `Button` component.
2. Whether a dropdown menu is currently open.
3. A user's `id`, passed from a parent list into a `UserRow` component.
4. The current value typed into a search input.
5. The color theme (`"light"` or `"dark"`) a `Card` component should render with, set by whoever uses the `Card`.

---

## 12. Interview Q&A

**Q1: What are props in React?**

A: Props ("properties") are the inputs a component receives from its parent. They're written as JSX attributes and collected by React into a single object passed to the component function. They let a single reusable component render differently depending on what's passed in, similar to how a function's arguments let one function body handle many different inputs.

---

**Q2: Explain React's unidirectional (one-way) data flow.**

A: Data — via props — only flows from parent components down to child components, never automatically the other way. A parent decides what props to pass; a child renders based on what it receives but has no built-in way to change its parent's data directly. This makes data flow predictable and easy to trace: to find where a value came from, you only ever look upward in the tree, never sideways or in a loop.

---

**Q3: If data only flows down, how does a child component communicate information back up to its parent?**

A: Through callback props. The parent defines a function and passes it down to the child as a prop (conventionally named `onSomething`, like `onClick` or `onSave`). The child calls that function — often with arguments describing what happened — when some event occurs. The function itself travels down like any other prop; calling it is what lets information effectively travel back up, without ever breaking the one-way flow or letting the child mutate the parent's data directly.

---

**Q4: Why is this pattern often called "unidirectional data flow with a callback escape hatch"?**

A: Because structurally, data still only ever moves one direction — from parent to child, as props. The "escape hatch" is that one of those props can be a function, and invoking a function transfers control (and effectively, information) back to wherever that function was originally defined — the parent's scope. It's not a violation of one-way flow; it's a controlled, explicit mechanism built on top of it.

---

**Q5: What's the difference between accessing `props.name` vs destructuring `{ name }` in the function signature?**

A: Both retrieve the same value from the same underlying props object — there's no functional difference. Destructuring in the signature is preferred by convention because it documents exactly which props the component expects, right at the top of the function, and avoids repeating `props.` throughout the component body.

---

**Q6: How do you give a prop a default value in a modern function component?**

A: Using a default parameter at the point of destructuring: `function Button({ color = "blue" }) { ... }`. If `color` is `undefined` when the component is called, JavaScript substitutes `"blue"`. The older `Component.defaultProps = {...}` syntax still works but is considered legacy for function components.

---

**Q7: Why does `<Avatar size="64" />` behave differently from `<Avatar size={64} />`?**

A: `size="64"` passes the string `"64"`; `size={64}` passes the number `64`. JSX treats quoted attribute values as string literals, exactly like HTML. Anything that isn't a plain string — numbers, booleans, objects, arrays, expressions, variables — must be wrapped in curly braces so it's evaluated as JavaScript. Passing the wrong type can cause silent bugs, like string concatenation happening where numeric addition was expected.

---

**Q8: What does it mean to say props are "read-only," and what's the risk of ignoring that?**

A: A component receives props from its parent and must not modify them directly — it can only read them and derive new values from them. Mutating a prop (especially an object or array) can silently affect other parts of the app that reference the same underlying value, and can break React's ability to correctly detect that something changed for re-rendering purposes. If a component needs to change data over time, that data should live in state, not props.

---

**Q9: What's the difference between props and state?**

A: Props are inputs handed to a component by its parent — owned by the parent, read-only from the child's perspective, and they change only when the parent re-renders with new values. State is data a component manages internally and can change itself, typically in response to user interaction or other events. Props configure a component from the outside; state tracks what's happening inside it over time.

---

**Q10: How do you pass an entire object as a single prop instead of spreading its fields into individual props?**

A: Just pass the object as the value of one prop: `<UserCard user={userObject} />`. Inside the component, destructure or access it as `{ user }` and then read `user.name`, `user.role`, and so on. This is convenient when the data already arrives grouped together (for example, from an API response) rather than as loose individual values.

---

**Q11: What is the `children` prop?**

A: `children` is a special, automatically-populated prop that contains whatever was written between a component's opening and closing JSX tags. It lets a component render arbitrary nested content passed in by its parent without needing to know in advance what that content is — commonly used for generic wrapper components like cards, modals, and layout containers.

---

**Q12: What's the practical difference between using PropTypes and using TypeScript to type-check props?**

A: PropTypes performs a runtime check in development: if a prop's type doesn't match what was declared, React logs a console warning while the app is running, but only if that code path actually executes. TypeScript performs a compile-time (and editor-time) check: a type mismatch is flagged immediately as you write the code, before anything runs, which catches the class of bug earlier and more reliably. This is a major reason most modern React codebases favor TypeScript over PropTypes.

---

**Q13: Can a boolean prop be passed without writing `={true}`?**

A: Yes. JSX has a shorthand where writing just the attribute name, with no value — `<Checkbox checked />` — is equivalent to `<Checkbox checked={true} />`. This mirrors plain HTML's boolean attribute behavior, like `<input disabled>`.

---

**Q14: A component receives a `users` array as a prop and needs to show only active users, sorted by name. Should it modify the `users` prop directly to filter and sort it?**

A: No — that would mutate a value owned by the parent. Instead, the component should derive a new array using non-mutating operations, e.g. `const visible = users.filter(u => u.active).sort((a, b) => a.name.localeCompare(b.name))`, and render `visible`. The original `users` prop passed in by the parent is left completely untouched.

---

**Q15: Why can't a child component just set a variable on its parent directly, the way it can call a callback prop?**

A: React components don't share a mutable scope with their parents — a child only ever receives what's explicitly passed to it as props, and has no reference to the parent's internal variables or state setters unless the parent deliberately hands one down (typically as a function). This is a deliberate design choice: it keeps data flow traceable and predictable, since every change to a parent's data has to go through something the parent itself exposed, rather than being reachable from anywhere in the tree.

---

> **Memory hook:** "Props flow down like water — gravity only pulls one way. If something needs to travel back up, you don't fight gravity; you hand the child a bucket (a callback function) and let it carry the message up for you."
