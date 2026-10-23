# 02 — Composition & Children

> "You wanted a thousand kinds of picture frame. React gives you one frame, and lets you put anything inside it."

---

## Table of Contents

1. [The Problem: Generic Wrappers Without Inheritance](#1-the-problem-generic-wrappers-without-inheritance)
2. [The `children` Prop In Depth](#2-the-children-prop-in-depth)
3. [What's Happening Internally](#3-whats-happening-internally)
4. [A Full Example: A Reusable Card](#4-a-full-example-a-reusable-card)
5. [Named Slots: Composition With Multiple Content Props](#5-named-slots-composition-with-multiple-content-props)
6. [The Specialization Pattern](#6-the-specialization-pattern)
7. [Composition vs. Inheritance](#7-composition-vs-inheritance)
8. [Common Mistakes and Confusions](#8-common-mistakes-and-confusions)
9. [A Quick Preview: Render Props](#9-a-quick-preview-render-props)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. The Problem: Generic Wrappers Without Inheritance

Let's start with a scenario, not a definition.

You're building a `Card` component. A card is just a white box with rounded corners and a shadow — the kind of thing you see everywhere on a modern web page.

The first card you need holds a user's profile:

```jsx
function ProfileCard() {
  return (
    <div className="card">
      <img src="/avatar.png" alt="User avatar" />
      <h2>Jane Doe</h2>
      <p>Frontend Engineer</p>
    </div>
  );
}
```

Fine. Except tomorrow, someone asks for a card that holds a pricing plan. And the day after, a card that holds a product listing. And the day after that, a card that holds... you get the idea.

Your naive instinct — the one carried over from object-oriented languages — is to reach for *inheritance*:

```
Card (base class)
  |
  +-- ProfileCard (extends Card)
  +-- PricingCard (extends Card)
  +-- ProductCard (extends Card)
```

Each subclass would "inherit" the card's shell (the border, the shadow, the padding) and add its own content. That's exactly how you'd solve this in, say, Java or C++ — a `Card` base class with an abstract `renderContent()` method that subclasses override.

But here's the catch: **React doesn't have a class inheritance model for components.** There's no `class ProfileCard extends Card` pattern that React recommends, wants, or even makes convenient. So how do you get the same "one shell, many contents" flexibility?

React's answer is: **stop thinking about extending a base component, and start thinking about wrapping content inside a component.**

```jsx
<Card>
  <img src="/avatar.png" alt="User avatar" />
  <h2>Jane Doe</h2>
  <p>Frontend Engineer</p>
</Card>
```

`Card` doesn't need to know — and doesn't want to know — whether it's holding a profile, a price tag, or a product photo. It just knows "I am a box, and something goes inside me." That "something" is what this entire lesson is about: the `children` prop.

---

### Why this actually matters

This isn't a stylistic preference. It solves a real explosion problem.

With inheritance, if you have 3 "shapes" of wrapper (Card, Modal, Panel) and 10 "kinds" of content (profile, pricing, product, settings...), you'd theoretically need up to 30 subclasses to cover every combination — one for `ProfileCard`, one for `ProfilePanel`, one for `ProfileModal`, and so on.

```text
┌────────────────────────────────────────────────────────────────┐
│         The mental shift: extend vs. wrap                      │
│                                                                  │
│   Inheritance question:                                         │
│   "What new subclass do I need to add this content              │
│    to this shell?"                                               │
│                                                                  │
│   Composition question:                                         │
│   "What existing shell do I nest this content inside?"          │
│                                                                  │
│   The first question grows a new component for every            │
│   shell x content combination. The second question              │
│   never needs a new component at all — just a new                │
│   arrangement of the ones you already have.                      │
└────────────────────────────────────────────────────────────────┘
```

With composition, you need exactly 3 wrapper components and 10 content pieces. You mix and match them at the point of use:

```jsx
<Card><ProfileInfo /></Card>
<Modal><ProfileInfo /></Modal>
<Panel><ProfileInfo /></Panel>
```

Same content, dropped into three different shells, zero new components created. That's the whole game.

> **Memory hook:** "Don't build a thousand custom picture frames — build one adjustable frame, and let people put any picture in it."

---

## 2. The `children` Prop In Depth

Here's the basic definition, now that you've seen why it exists:

> **`children`** is a special prop that automatically holds whatever JSX you nest *between* a component's opening and closing tags.

Whenever you write this:

```jsx
<Wrapper>
  <SomeContent />
</Wrapper>
```

React takes everything between `<Wrapper>` and `</Wrapper>` and hands it to `Wrapper` as `props.children`. You never pass `children` explicitly like a normal prop (no `children={...}` attribute needed) — nesting tags *is* how you pass it.

```jsx
function Wrapper(props) {
  console.log(props.children); // <SomeContent />
  return <div className="wrapper">{props.children}</div>;
}
```

If you're destructuring props (which you should be, by now, coming out of Phase 02's props basics), it looks like this:

```jsx
function Wrapper({ children }) {
  return <div className="wrapper">{children}</div>;
}
```

### `children` isn't always a single element

This trips people up the first time they see it. `children` can be:

```jsx
// A single element
<Wrapper><p>Hello</p></Wrapper>
// props.children === <p>Hello</p>

// Multiple elements (an array, under the hood)
<Wrapper>
  <p>Hello</p>
  <p>World</p>
</Wrapper>
// props.children === [<p>Hello</p>, <p>World</p>]

// Plain text
<Wrapper>Hello</Wrapper>
// props.children === "Hello"

// A mix of text and elements
<Wrapper>
  Hello <b>world</b>!
</Wrapper>
// props.children === ["Hello ", <b>world</b>, "!"]

// Nothing at all
<Wrapper />
// props.children === undefined
```

React doesn't force `children` into any one shape. Whatever you put between the tags is exactly what shows up — a single node, an array of nodes, a string, or `undefined` if you self-close the tag. This is precisely why `{children}` just works when you drop it into JSX — React already knows how to render a single element, an array of elements, or a string.

### `children` is still just a prop

It's easy to start thinking of `children` as some special language keyword, like `this` in a class. It isn't. It's an ordinary property on the props object, with one ordinary quirk: JSX nesting syntax is the conventional way to fill it in, instead of writing `children={...}` as an explicit attribute (though nothing stops you from doing that manually — `<Wrapper children={<Child />} />` behaves identically to `<Wrapper><Child /></Wrapper>`, it's just far less common and far less readable).

> **Memory hook:** "`children` isn't magic — it's just the prop that JSX nesting quietly fills in for you."

---

## 3. What's Happening Internally

It's worth seeing this translation happen step by step, because once it clicks, `children` stops feeling like magic.

Remember: JSX is just syntax sugar. `<Wrapper><Child /></Wrapper>` doesn't run as-is — it gets compiled (by Babel, or whatever your build tool uses) into a plain JavaScript function call.

```text
   JSX you write:
   ─────────────────────────────
   <Wrapper>
     <Child />
   </Wrapper>


   Compiles down to (roughly):
   ─────────────────────────────
   React.createElement(
     Wrapper,             <-- the component
     null,                <-- its props (none passed as attributes here)
     React.createElement(Child, null)   <-- THIS becomes children
   )


   Which, at render time, becomes a call like:
   ─────────────────────────────
   Wrapper({
     children: React.createElement(Child, null)
   })
```

So the third argument (and any arguments after it) passed to `React.createElement` gets bundled up into a `children` prop on the props object. That's the entire mechanism. There's no separate "children pipeline" — it's just a prop, assembled by the JSX compiler from whatever sat between your tags.

```text
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│   <Wrapper>                                                 │
│     <Child />                                                │
│   </Wrapper>                                                 │
│                                                              │
│                        │  JSX compiler                       │
│                        ▼                                     │
│                                                              │
│   Wrapper({ children: <Child /> })                          │
│                                                              │
│                        │  Wrapper's function body runs       │
│                        ▼                                     │
│                                                              │
│   return <div className="wrapper">{children}</div>          │
│                                                              │
│                        │  children gets rendered in place    │
│                        ▼                                     │
│                                                              │
│   <div class="wrapper"><Child's rendered output/></div>     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Same story if you pass attributes *and* nest content — the attributes become named props, and the nested JSX still becomes `children` alongside them:

```jsx
<Wrapper title="Dashboard">
  <Child />
</Wrapper>

// becomes roughly:
Wrapper({ title: "Dashboard", children: <Child /> })
```

`children` really is just a prop with a reserved name and a special piece of JSX syntax (nesting) dedicated to filling it in.

### What if there's more than one nested element?

Let's trace through the multiple-children case too, since it's the one that surprises people the most.

```text
   JSX you write:
   ─────────────────────────────
   <Wrapper>
     <Child1 />
     <Child2 />
   </Wrapper>


   Compiles down to (roughly):
   ─────────────────────────────
   React.createElement(
     Wrapper,
     null,
     React.createElement(Child1, null),   <-- 3rd argument
     React.createElement(Child2, null)    <-- 4th argument
   )


   Which becomes:
   ─────────────────────────────
   Wrapper({
     children: [
       React.createElement(Child1, null),
       React.createElement(Child2, null)
     ]
   })
```

Every argument to `createElement` after the props object gets collected into a single `children` value — one element if there was only one, an array if there were several. `Wrapper` doesn't have to do anything differently to handle either case; `{children}` renders a single element exactly the same way it renders an array of elements. React already knows how to walk an array of nodes and render each one.

---

## 4. A Full Example: A Reusable Card

Let's build the `Card` component from Section 1 for real, and prove it can hold literally anything.

```jsx
function Card({ children }) {
  return (
    <div className="card">
      {children}
    </div>
  );
}
```

That's it. That's the entire component. It knows nothing about profiles, prices, or products.

Now watch it flex:

```jsx
function ProfileCard() {
  return (
    <Card>
      <img src="/avatar.png" alt="User avatar" />
      <h2>Jane Doe</h2>
      <p>Frontend Engineer</p>
    </Card>
  );
}

function PricingCard() {
  return (
    <Card>
      <h2>Pro Plan</h2>
      <p className="price">$29 / month</p>
      <ul>
        <li>Unlimited projects</li>
        <li>Priority support</li>
      </ul>
      <button>Subscribe</button>
    </Card>
  );
}

function EmptyStateCard() {
  return (
    <Card>
      <p>No items yet. Add your first one to get started.</p>
    </Card>
  );
}
```

Three completely different pieces of content, one wrapper, zero new "Card variants" created. `Card` supplies the shell (`className="card"`, whatever CSS gives it the border and shadow); the caller supplies the substance.

You can even nest `Card`s inside other components that also use composition:

```jsx
function Dashboard() {
  return (
    <div className="dashboard">
      <Card>
        <ProfileCard />
      </Card>
      <Card>
        <PricingCard />
      </Card>
    </div>
  );
}
```

(That particular nesting is a bit redundant since `ProfileCard` and `PricingCard` already wrap themselves in a `Card` — but it illustrates the point: composition stacks cleanly, with no special-casing needed anywhere.)

### Accepting extra props alongside `children`

Real-world wrappers usually need a *little* bit of configuration on top of the content — say, an optional `onClick` handler for a clickable card, or a `variant` for styling. That's not a problem; `children` happily coexists with as many other named props as you like:

```jsx
function Card({ children, variant = "default", onClick }) {
  return (
    <div className={`card card--${variant}`} onClick={onClick}>
      {children}
    </div>
  );
}
```

```jsx
<Card variant="highlighted" onClick={() => console.log("Card clicked")}>
  <ProfileCard />
</Card>
```

`Card` still doesn't know or care what's inside it — it's just grown a couple of small, optional configuration knobs alongside the content it wraps. This is the normal shape of a real composable component: a handful of configuration props, plus `children` (or named slots) for the actual content.

**Where you'll see this pattern in the wild:** almost every UI component library you've ever used — Material UI's `Card`, Chakra UI's `Box`, Bootstrap's `Modal` — is built exactly this way. A thin, styled wrapper accepts `children` (or several named slot props) plus a handful of configuration props like `variant`, `size`, or `padding`. You are, right now, learning the exact pattern that underlies most component libraries you'll ever install from npm.

---

## 5. Named Slots: Composition With Multiple Content Props

`children` handles the *one blob of content in the middle* case beautifully. But what about a layout that has several distinct content areas — a header, a sidebar, and a footer — each of which needs to be arbitrary JSX?

You can't jam three unrelated regions into a single `children` prop and expect `Layout` to know which part goes where. So instead, you pass each region as its **own, separately named prop** — each one just happens to hold JSX instead of a string or number.

```jsx
function Layout({ header, sidebar, footer, children }) {
  return (
    <div className="layout">
      <header className="layout-header">{header}</header>

      <div className="layout-body">
        <aside className="layout-sidebar">{sidebar}</aside>
        <main className="layout-main">{children}</main>
      </div>

      <footer className="layout-footer">{footer}</footer>
    </div>
  );
}
```

And using it:

```jsx
function App() {
  return (
    <Layout
      header={<TopNav />}
      sidebar={<NavMenu />}
      footer={<p>© 2026 SkillVault</p>}
    >
      <ArticleContent />
    </Layout>
  );
}
```

Notice something interesting: `header`, `sidebar`, and `footer` are passed like ordinary props (`header={<TopNav />}`), while the main content is passed via nesting and lands in `children`. Both are the exact same mechanism underneath — a prop that happens to hold a React element — just with different syntax at the call site. Nesting (`<Layout>...</Layout>`) is really just a convenient shorthand for the *one* prop you use most often; named props are for everything else.

This is often called **"slot"-style composition** — think of `Layout` as a physical page template with labeled slots cut out of it (`header`, `sidebar`, `footer`, `children`/`main`), and you're free to drop whatever content you like into each slot.

**When to reach for this:** as soon as a component needs more than one independent "hole" for arbitrary content. If there's only one hole, `children` alone is simpler and more idiomatic — don't invent a `content` prop when `children` already does the job.

> **Memory hook:** "One hole in the box, use `children`. Several labeled holes, give each one its own named prop."

---

## 6. The Specialization Pattern

Composition doesn't just solve "one generic shell, many contents." It also solves the opposite direction: building a *specific*, opinionated component out of a *generic* one — without subclassing anything.

Imagine a generic `Dialog` component:

```jsx
function Dialog({ title, message, children }) {
  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">{children}</div>
      </div>
    </div>
  );
}
```

`Dialog` is deliberately generic — it doesn't know about "welcome," "confirm delete," or "session expired." It just knows it has a title, a message, and some action buttons.

Now, instead of writing an inheritance chain (`class WelcomeDialog extends Dialog`), you build `WelcomeDialog` by *configuring* `Dialog` through props and composition:

```jsx
function WelcomeDialog() {
  return (
    <Dialog
      title="Welcome to SkillVault"
      message="Let's get your account set up in under two minutes."
    >
      <button>Get Started</button>
      <button>Skip for now</button>
    </Dialog>
  );
}
```

And right next to it, a totally different specialization of the very same `Dialog`:

```jsx
function ConfirmDeleteDialog({ onConfirm, onCancel }) {
  return (
    <Dialog
      title="Delete this item?"
      message="This action cannot be undone."
    >
      <button onClick={onConfirm}>Delete</button>
      <button onClick={onCancel}>Cancel</button>
    </Dialog>
  );
}
```

`WelcomeDialog` and `ConfirmDeleteDialog` are both "specialized" versions of `Dialog` — but neither one *extends* `Dialog` in any class sense. They're just ordinary components that happen to render a `<Dialog>` with particular props and particular children plugged in. This is literally React's own recommended replacement for the "specialization via inheritance" pattern from OOP: **specialize by rendering a more generic component with specific configuration, not by subclassing it.**

Notice too that you can go a level deeper without any extra machinery. Say you want a `ConfirmDeleteManyDialog` that's just `ConfirmDeleteDialog` with a pluralized message — you'd simply write another small component that renders `<Dialog>` with yet another specific `title`/`message` combination, or even one that renders `<ConfirmDeleteDialog>` and tweaks a prop. There's no ceiling of "levels of subclassing" to worry about, because there's no subclassing at all — just components calling components.

### One more example, to make the pattern stick

Here's the same idea applied to a generic `Button`:

```jsx
function Button({ variant = "default", children, ...rest }) {
  return (
    <button className={`btn btn--${variant}`} {...rest}>
      {children}
    </button>
  );
}
```

Now the "specialized" buttons your team actually reaches for every day:

```jsx
function DangerButton(props) {
  return <Button variant="danger" {...props} />;
}

function PrimaryButton(props) {
  return <Button variant="primary" {...props} />;
}
```

```jsx
<DangerButton onClick={handleDelete}>Delete Account</DangerButton>
<PrimaryButton onClick={handleSave}>Save Changes</PrimaryButton>
```

Neither `DangerButton` nor `PrimaryButton` extends `Button`. Each is a small function that renders `Button`, pre-filling one prop (`variant`) and forwarding everything else (`{...props}`, which includes `children`, `onClick`, and anything else the caller passes). That's the specialization pattern, doing exactly the same job a `class DangerButton extends Button` might have tried to do in another language — just without the class, and without the hierarchy.

> **Memory hook:** "Don't subclass the dialog — just decorate a plain dialog differently each time you use it."

---

## 7. Composition vs. Inheritance

This is the single most commonly asked interview question in this whole lesson, so let's make the comparison explicit.

| | Inheritance (classic OOP) | Composition (React's model) |
|---|---|---|
| **How specialization works** | A subclass extends a base class and overrides/adds behavior | A component renders another component, configured via props and children |
| **Relationship type** | "is-a" (`WelcomeDialog` *is a* `Dialog`) | "has-a" / "uses-a" (`WelcomeDialog` *renders* / *uses* a `Dialog`) |
| **Coupling** | Tight — subclass depends on base class internals, can break if the base class changes | Loose — parent only depends on the child's public props interface |
| **Reuse mechanism** | Class hierarchy (`extends`) | Nesting components (`<Wrapper><Content /></Wrapper>`) and passing props |
| **Flexibility for "many shells x many contents"** | Combinatorial explosion of subclasses | Mix-and-match at the call site, no new components needed |
| **Does React provide this mechanism for components?** | No — there is no `Component.extend()` style API for building component variants | Yes — this is the explicitly documented, recommended approach |

React's own documentation is direct about this: **"React has a powerful composition model, and we recommend using composition instead of inheritance to reuse code between components."** In practice, the team has found no compelling use case for a component-inheritance hierarchy — everything people wanted inheritance for (sharing a shell, adding configuration, specializing behavior) is expressible through props, `children`, and composition instead.

Why does React take this stance so firmly?

- **Components are mostly just functions.** Functions don't "extend" other functions in a meaningful, built-in way — you compose them (call one from inside another), you don't subclass them.
- **Inheritance hierarchies get fragile fast.** Two or three levels deep, it becomes hard to know which class actually defines a given piece of behavior. Composition keeps everything visible at the call site — you can see exactly which `Dialog` props `WelcomeDialog` is passing, right there in one function.
- **Composition covers everything inheritance was used for**, including passing data down (props), providing a customizable content region (`children`, or named slots), and specializing generic behavior (Section 6's pattern) — without introducing a rigid hierarchy.

> **Memory hook:** "In React, components don't extend each other — they render each other."

---

## 8. Common Mistakes and Confusions

**Mistake 1 — trying to force an inheritance-shaped design.**

If you ever catch yourself writing (or wishing you could write) something like this:

```jsx
// Not a real, supported React pattern — don't reach for this
class WelcomeDialog extends Dialog {
  renderContent() {
    return <button>Get Started</button>;
  }
}
```

...stop, and go back to Section 6's composition version instead. React function components don't extend one another, and trying to bolt an inheritance model on top (even by hand-rolling something similar with classes) fights the grain of the library rather than working with it.

**Mistake 2 — prop-drilling content through many layers instead of composing.**

Say `Page` needs to render a `Toolbar`, which needs to render a `Button`, which needs some custom icon content. The prop-drilling instinct is to thread a prop like `icon` through every intermediate layer:

```jsx
// Awkward — Toolbar has to know about, and forward, a prop it never uses itself
function Page({ icon }) {
  return <Toolbar icon={icon} />;
}
function Toolbar({ icon }) {
  return <Button icon={icon} />;
}
function Button({ icon }) {
  return <button>{icon} Save</button>;
}
```

`Toolbar` doesn't care about `icon` at all — it's just a pass-through pipe. Compare that to composition, where the icon is nested directly where it's used, and the intermediate layers don't need to know it exists:

```jsx
function Page() {
  return (
    <Toolbar>
      <Button><StarIcon /> Save</Button>
    </Toolbar>
  );
}
function Toolbar({ children }) {
  return <div className="toolbar">{children}</div>;
}
```

Whenever you find yourself forwarding the same prop through two or three components that never actually use it themselves, that's usually a sign the content belongs in `children` (or a named slot), not in a drilled prop.

> **Memory hook:** "If a component is just forwarding a prop it never touches, that content probably wanted to be `children` all along."

**Mistake 3 — assuming `children` is always a single React element.**

As Section 2 showed, `children` might be a string, an array, a single element, or `undefined`. If your component does something like `children.props.something`, it'll break the moment someone passes plain text or multiple children instead of exactly one element. Render `{children}` directly whenever you can, and only reach for more advanced children-inspection utilities when you have a genuine reason to.

**Mistake 4 — forgetting that an "empty" wrapper still renders its shell.**

If `Card` unconditionally renders `<div className="card">{children}</div>`, then `<Card />` with no children still renders an empty, styled box — border, shadow, padding, and all, just with nothing inside it. Sometimes that's exactly what you want (an empty-state placeholder that gets filled in later). Other times it's an accidental empty box sitting on the page because a data-fetch hasn't resolved yet and nothing was passed in. If that matters, guard for it explicitly: `{children ? <div className="card">{children}</div> : null}`, or give the component a sensible fallback.

> **Memory hook:** "An empty frame still hangs on the wall — decide on purpose whether that's what you want."

---

## 9. A Quick Preview: Render Props

There's one more composition technique worth knowing exists, even though it deserves its own full lesson later (Phase 11 covers it in depth): **render props.**

So far, `children` has always been *content* — JSX to display. But `children` (or any prop, really) can also be a *function* — one that the wrapper component calls, often passing it some data the wrapper knows about internally:

```jsx
function MouseTracker({ children }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  return (
    <div onMouseMove={(e) => setPosition({ x: e.clientX, y: e.clientY })}>
      {children(position)}
    </div>
  );
}

// Usage — children is a function, not JSX
<MouseTracker>
  {(position) => <p>Mouse is at {position.x}, {position.y}</p>}
</MouseTracker>
```

`MouseTracker` doesn't know or care *how* the position is displayed — a paragraph, a custom cursor, a chart marker — it just knows how to track the position and hand it off. That's the same composition philosophy from this whole lesson (a generic wrapper, arbitrary content), just with the wrapper also sharing some data with the content, via a function instead of a static prop value.

It's worth noticing that this is still exactly the `children`-as-a-prop mechanism from Section 2 and 3 — nothing new is happening mechanically. `{(position) => <p>...</p>}` nested between `<MouseTracker>` tags becomes `props.children` exactly like any other nested JSX would; it just so happens that this particular `children` value is a function instead of an element, and `MouseTracker` calls it (`children(position)`) instead of just rendering it (`{children}`). Same prop, same nesting syntax, one extra step (a function call) before rendering.

Filing this away for now — the deep dive, including where render props are still genuinely useful versus where custom hooks have replaced them for sharing stateful logic, is coming later in Phase 11.

> **Memory hook:** "A render prop is still just `children` — except this time, you call it instead of just displaying it."

---

## 10. Hands-On Exercises

**Exercise 1 — Build a `Panel` wrapper**

Create a `Panel` component that renders a `<section className="panel">` around whatever `children` it receives. Use it to wrap three different pieces of content: a paragraph of text, a small form with two inputs, and another component of your choosing. Confirm all three render correctly inside the same `Panel` shell.

**Exercise 2 — Inspect `children`'s shape**

Write a component called `ChildrenInspector` that receives `children` and, instead of rendering it, logs `Array.isArray(children)` and `typeof children` to the console. Render it three separate times: once with a single child element, once with two sibling child elements, and once with plain text. Note what gets logged each time.

**Exercise 3 — Named slots for a `Layout` component**

Build the `Layout` component from Section 5 (`header`, `sidebar`, `footer`, and `children` for the main area). Use it once for a blog post page (header = site nav, sidebar = table of contents, footer = copyright, children = article body) and once for a settings page (header = page title, sidebar = settings menu, footer = save button, children = the active settings form).

**Exercise 4 — Specialize a generic `Alert`**

Build a generic `Alert` component that accepts `tone` (`"info"`, `"warning"`, or `"error"`) and `children`, and renders a styled box with the appropriate class. Then build three specialized components on top of it — `InfoAlert`, `WarningAlert`, and `ErrorAlert` — each of which renders `Alert` pre-configured with the right `tone`, exposing only a `message` prop to its own callers.

**Exercise 5 — Refactor away prop-drilling**

You're given a `Page` → `Toolbar` → `IconButton` chain where an `icon` prop is manually forwarded through `Page` and `Toolbar`, even though neither uses it directly (mirroring Mistake 2 in Section 8). Refactor the chain so the icon is passed via composition (nesting) instead of a drilled prop, and confirm `Toolbar` no longer needs to know an `icon` prop exists at all.

**Exercise 6 — Compose a `Modal` two ways**

Build a `Modal` component that takes `children` for its body and an `actions` prop (a named slot, per Section 5) for its footer buttons. Then build two specializations on top of it: a `ConfirmModal` (message + Confirm/Cancel buttons) and an `InfoModal` (message + a single OK button) — both built purely through composition, with no class inheritance involved.

---

## 11. Interview Q&A

**Q1: What is the `children` prop in React?**

A: `children` is a special, automatically-populated prop that holds whatever JSX (or text, or nothing) is nested between a component's opening and closing tags. Writing `<Wrapper><Child /></Wrapper>` is equivalent to passing `<Child />` as the `children` prop to `Wrapper` — React assembles this for you from the nested JSX; you don't set it explicitly as an attribute.

---

**Q2: Why does React recommend composition over inheritance?**

A: React components — especially function components — don't have a built-in mechanism for one component to extend or subclass another the way classes do in traditional OOP. React's own documentation explicitly recommends composition instead. Composition lets you build a generic wrapper (like `Card` or `Dialog`) once, and reuse it for unlimited different contents by nesting JSX inside it or configuring it via props, rather than needing a subclass for every content/shell combination. It keeps components loosely coupled (a parent only relies on a child's props interface, not its internals), avoids the fragility of deep class hierarchies, and the React team has found no scenario where inheritance was actually necessary once composition, props, and `children` are available.

---

**Q3: How does `<Wrapper><Child /></Wrapper>` become `props.children` internally?**

A: JSX is compiled into calls to `React.createElement(component, props, ...children)`. Whatever is nested between a component's tags is passed as the third (and later) argument(s) to `createElement`, and React bundles those into a `children` property on the props object that gets passed to the component function. So `<Wrapper><Child /></Wrapper>` compiles roughly to `React.createElement(Wrapper, null, React.createElement(Child, null))`, which at render time calls `Wrapper({ children: <Child /> })`.

---

**Q4: Can `children` be something other than a single React element?**

A: Yes. `children` can be a single element, an array of elements (when multiple JSX siblings are nested), a plain string (when text is nested), a mix of strings and elements, or `undefined` (when the tag is self-closed with no nested content, e.g. `<Wrapper />`). Components that render `{children}` directly handle all these cases automatically; components that try to inspect or manipulate `children.props` assuming it's always a single element can break.

---

**Q5: What is "slot"-style composition, and when would you use it over plain `children`?**

A: It's the pattern of passing multiple, separately named props (e.g. `header`, `sidebar`, `footer`) that each hold their own piece of arbitrary JSX, used when a component has more than one independent content region. Plain `children` only gives you one "hole" to fill; named slots give you as many as you need, each addressable by name. If a component only needs one flexible content area, `children` is simpler and more idiomatic — introduce named slots only once there's a genuine need for multiple independent regions.

---

**Q6: What is the "specialization" pattern in React, and how does it replace inheritance-based specialization?**

A: It's building a specific component (like `WelcomeDialog`) by rendering a more generic component (like `Dialog`) configured with particular props and children, instead of subclassing the generic component. `WelcomeDialog` doesn't extend `Dialog` — it's a normal function component whose body renders `<Dialog title="..." message="...">{...}</Dialog>`. This achieves the same goal as inheritance-based specialization (reusing a generic base while customizing details) without any class hierarchy.

---

**Q7: Give a concrete example of the combinatorial explosion inheritance would cause, that composition avoids.**

A: With 3 wrapper "shapes" (Card, Modal, Panel) and 10 kinds of content (profile, pricing, product, etc.), an inheritance approach could require up to 30 subclasses — `ProfileCard`, `ProfileModal`, `ProfilePanel`, `PricingCard`, and so on — one for every shell/content combination. With composition, you need only the 3 wrapper components and the 10 content pieces; you combine them freely at the point of use (`<Modal><ProfileInfo /></Modal>`), with zero new components required for each combination.

---

**Q8: Is it possible to pass both named props and `children` to the same component?**

A: Yes. Attributes on the opening tag (e.g. `<Layout header={<TopNav />}>`) become ordinary named props, while anything nested between the opening and closing tags becomes `children` — both are delivered on the same props object, just filled in through different JSX syntax (attribute vs. nesting).

---

**Q9: What's a common mistake when trying to replicate inheritance-style patterns in React?**

A: Trying to build class hierarchies where one component "extends" another (e.g., `class WelcomeDialog extends Dialog`) and overrides a method to supply content. React doesn't support or expect this for components — it fights against the library's design. The idiomatic fix is the specialization-via-composition pattern: render the generic component with specific props and children instead.

---

**Q10: What is prop-drilling, and how does composition help avoid it for content?**

A: Prop-drilling is manually forwarding a prop through several intermediate components that don't use it themselves, just to get it to a deeply nested component that does. For content specifically, composition avoids this: instead of passing `icon` through `Page → Toolbar → Button` as a prop none of the middle layers need, you nest the content directly where it's used (`<Toolbar><Button><StarIcon /> Save</Button></Toolbar>`), so intermediate components never need to know the content exists.

---

**Q11: How would you build a generic `Card` component that can render arbitrary content?**

A: Give it a `children` prop and render `{children}` inside whatever wrapper markup provides the shell (border, padding, shadow): `function Card({ children }) { return <div className="card">{children}</div>; }`. Any content — a profile, a pricing plan, a product listing — can then be nested inside `<Card>...</Card>` without `Card` needing any awareness of what it contains.

---

**Q12: What are render props, and how do they relate to composition?**

A: A render prop is a prop (commonly `children`) whose value is a function rather than static JSX. The wrapper component calls that function, typically passing along some data or state it manages internally, and renders whatever the function returns. It's still composition — a generic wrapper, arbitrary content — except the wrapper also shares data with the content via a function call instead of just accepting static JSX. It gets full coverage in a later lesson, since hooks have replaced many of its historical use cases.

---

**Q13: If a component's document/example needs "one blob of arbitrary content," should you reach for `children` or a named prop like `content`?**

A: Prefer `children` — it's the idiomatic, JSX-native way to express "arbitrary content nested here," and it lets callers use the natural nesting syntax (`<Wrapper>...</Wrapper>`) rather than an awkward `content={<...>}` attribute. Reserve named props (slots) for cases where a component genuinely needs more than one independent content region.

---

**Q14: What happens if you self-close a component's tag, like `<Wrapper />`, that expects `children`?**

A: `props.children` will be `undefined`. If the component unconditionally renders `{children}`, React simply renders nothing for that expression — no error is thrown. If the component tries to call a method on `children` (assuming it's always present), that will throw, since `undefined` has no methods. Defensive components either provide a fallback (`children || <DefaultContent />`) or document that `children` is required.

---

**Q15: Does using composition mean React components can never share logic with each other?**

A: No — composition is specifically about *reusing structure and content flexibility* (a shell that can wrap anything), not the only tool for sharing logic. Shared *logic* (state, side effects, calculations) is typically handled through separate mechanisms like custom hooks, which are covered in a later phase. Composition and hooks solve different problems and are commonly used together: a generic wrapper built with composition might internally use a custom hook for its own logic, while still accepting arbitrary `children` from its caller.
