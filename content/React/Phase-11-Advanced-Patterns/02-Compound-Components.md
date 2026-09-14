# 02 — Compound Components

> "A restaurant menu doesn't ask you to pass a `restaurantId` to every appetizer you order. The menu, the sections, and the dishes already know they belong to the same restaurant."

---

## Table of Contents

1. [The Problem: Rigid APIs vs. Prop-Wiring Nightmares](#1-the-problem-rigid-apis-vs-prop-wiring-nightmares)
2. [The Real-World Analogy: A Restaurant Menu](#2-the-real-world-analogy-a-restaurant-menu)
3. [Basic Definition](#3-basic-definition)
4. [Internal Working — Context Under the Hood](#4-internal-working--context-under-the-hood)
5. [A Full Example: Building `Tabs` Step by Step](#5-a-full-example-building-tabs-step-by-step)
6. [Compare With Related Concepts](#6-compare-with-related-concepts)
7. [Common Mistakes and Confusions](#7-common-mistakes-and-confusions)
8. [Interview Answer](#8-interview-answer)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Problem: Rigid APIs vs. Prop-Wiring Nightmares

Let's start with a component you've almost certainly had to build: a `Select` dropdown, or a `Tabs` widget. Something with several moving parts that all need to agree on one shared piece of state.

Your first instinct, especially if you're coming from a "just pass props" mindset, is to build it as one big configurable component:

```jsx
<Tabs
  tabs={[
    { label: "Profile", content: <ProfilePanel /> },
    { label: "Settings", content: <SettingsPanel /> },
    { label: "Billing", content: <BillingPanel /> },
  ]}
/>
```

This looks clean. It even works, for a while. But watch what happens the moment a real product requirement shows up:

- "Can the Billing tab have a little red 'new' badge next to its label?"
- "Can we put a search input between the tab list and the tab panels?"
- "Can the Settings tab be disabled with a tooltip explaining why?"
- "Can we reorder the tabs on mobile, but keep the config array order for desktop?"

Every single one of these forces you to keep bolting more optional fields onto that `tabs` array — `badge`, `disabled`, `disabledReason`, `mobileOrder` — and `Tabs` itself has to grow more and more internal logic to interpret all of it. The config object was supposed to make things simple, but it's turning into its own tiny templating language.

Now consider the opposite instinct: give the consumer full JSX control, and let them wire up the pieces themselves.

```jsx
function ProfileTabsPage() {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div>
      <button onClick={() => setActiveTab("profile")}>Profile</button>
      <button onClick={() => setActiveTab("settings")}>Settings</button>
      <button onClick={() => setActiveTab("billing")}>Billing</button>

      {activeTab === "profile" && <ProfilePanel />}
      {activeTab === "settings" && <SettingsPanel />}
      {activeTab === "billing" && <BillingPanel />}
    </div>
  );
}
```

This is flexible — you can put anything anywhere — but now *every single consumer* of `Tabs` has to reinvent the same `activeTab` state, the same click handlers, the same conditional rendering, from scratch, every time. There's no shared `Tabs` component at all anymore; you've just written one-off tab logic that happens to look tab-shaped.

**Here's the real tension:**

```text
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│   Config-object API              Fully manual, hand-wired JSX     │
│   <Tabs tabs={[...]} />          <button onClick={...}>...        │
│                                                                    │
│   + Coordination is automatic    + Total control over structure   │
│     (Tabs manages the state)       and styling                    │
│   - Rigid — every new visual     - No shared coordination logic — │
│     tweak needs a new config       every consumer reinvents the   │
│     field                          same state and click handlers  │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

What you actually want is *both* halves of that table at once: the coordination handled automatically, behind the scenes, **and** the consumer free to arrange, style, and mix in whatever markup they like, in whatever order they like.

That "both at once" is exactly what the **compound component pattern** gives you.

```jsx
<Tabs defaultTab="profile">
  <Tabs.List>
    <Tabs.Tab id="profile">Profile</Tabs.Tab>
    <Tabs.Tab id="settings">
      Settings <Badge>new</Badge>
    </Tabs.Tab>
    <Tabs.Tab id="billing" disabled>Billing</Tabs.Tab>
  </Tabs.List>

  <Tabs.Panel id="profile"><ProfilePanel /></Tabs.Panel>
  <Tabs.Panel id="settings"><SettingsPanel /></Tabs.Panel>
  <Tabs.Panel id="billing"><BillingPanel /></Tabs.Panel>
</Tabs>
```

Look at what just happened. There's no `tabs` config array anymore — the consumer writes plain, ordinary JSX, nests a `<Badge>` wherever they want, marks one tab `disabled` directly, and could reorder these tags freely. Yet `Tabs.Tab` and `Tabs.Panel` still somehow know which tab is active, without a single prop being manually passed between them by the consumer. That "somehow" is the whole subject of this lesson.

> **Memory hook:** "A config-object prop is a form you fill out. A compound component is a set of LEGO pieces that already know how to snap together."

---

## 2. The Real-World Analogy: A Restaurant Menu

Picture a restaurant's printed menu.

```
MENU
├── Appetizers
│     ├── Spring Rolls .......... $6
│     └── Soup of the Day ....... $5
├── Mains
│     ├── Grilled Salmon ........ $22
│     └── Pasta Primavera ....... $18
└── Desserts
      └── Tiramisu .............. $8
```

Notice something about this structure: nobody hands the "Spring Rolls" line a `restaurantId` prop. Nobody wires up "Appetizers" to know it belongs to "MENU." The whole thing is printed as one coherent object, and every section and every dish implicitly belongs to the same menu, the same restaurant, the same ordering system — just by being *nested inside it*.

Now imagine you, the customer, are free to read the menu in any order. Skip straight to desserts if you want. Read appetizers twice. The menu doesn't enforce a reading order — it just presents itself as a tree of related pieces, and trusts you (the consumer) to navigate it however makes sense for you.

That's the compound component pattern:

- `Tabs` is the menu.
- `Tabs.List`, `Tabs.Tab`, `Tabs.Panel` are the sections and dishes.
- They all implicitly know they belong to the same `Tabs` instance — the same way "Spring Rolls" implicitly belongs to this particular restaurant's menu — without you, the consumer, manually threading an ID or a callback to each one.
- And just like the menu, you (the consumer) decide the exact structure: where the badge goes, which tab is disabled, what sits between the tab list and the panels.

> **Memory hook:** "Menu, Menu.Appetizers, Menu.Mains — you never pass the restaurant's ID to the soup. They already know which kitchen they came from."

---

## 3. Basic Definition

With the problem and the analogy in your head, here's the formal shape of it:

> **A compound component** is a set of components that are used together, as siblings (or nested siblings) under one shared parent, where the parent manages shared state internally and the children silently coordinate through it — without the consumer having to manually wire props between them.

The tell-tale signature in JSX is always some version of:

```jsx
<Parent>
  <Parent.PieceA />
  <Parent.PieceB />
</Parent>
```

Two things define this pattern, and it's worth burning both into memory:

1. **The consumer controls structure.** They decide what's nested where, in what order, with what's mixed in between (like that `<Badge>` earlier).
2. **The state coordination is hidden.** `Parent` privately tracks whatever shared state matters (which tab is active, which option is selected), and `PieceA`/`PieceB` read and update that shared state without the consumer ever seeing a wire between them.

That second point is the part that feels like magic the first time you see it. So let's immediately kill the magic and look underneath.

---

## 4. Internal Working — Context Under the Hood

Here's the single most important thing to understand in this entire lesson, so let's say it as plainly as possible:

> **Compound components are not a new React feature. They are Composition (nesting components as children) plus Context (sharing state without prop-drilling), combined into a consumer-facing API.**

You already learned both halves of this separately:

- **Composition** (Phase 02) — nesting arbitrary JSX inside a parent via `children`, so the parent doesn't need to know what's inside it.
- **Context** (Phase 06) — sharing a value across a tree of components without manually passing it down through props at every level.

Compound components just point both of those tools at the same problem, at the same time. `Tabs` is the `children`-accepting wrapper from composition. And instead of the sub-components ignoring the tree and reading a manually-drilled prop, they read from a `Context` that `Tabs` set up.

Here's the wiring, drawn out:

```text
┌───────────────────────────────────────────────────────────────────┐
│                                                                     │
│   function Tabs({ children, defaultTab }) {                        │
│     const [activeTab, setActiveTab] = useState(defaultTab);        │
│                                                                     │
│     ┌─────────────────────────────────────────────────────────┐    │
│     │  TabsContext.Provider                                   │    │
│     │  value={{ activeTab, setActiveTab }}                     │    │
│     │                                                          │    │
│     │     {children}   <-- whatever the CONSUMER nested here   │    │
│     │                      (Tabs.List, Tabs.Panel, anything)   │    │
│     │                                                          │    │
│     └─────────────────────────────────────────────────────────┘    │
│   }                                                                 │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
                              │
                              │  Provider broadcasts { activeTab, setActiveTab }
                              │  down the tree — no props threaded manually
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│                                                                     │
│   function Tabs.Tab({ id, children }) {                            │
│     const { activeTab, setActiveTab } = useContext(TabsContext);   │
│     //         ^ reads the SAME state Tabs is holding                │
│                                                                     │
│     return (                                                       │
│       <button                                                      │
│         className={id === activeTab ? "tab active" : "tab"}        │
│         onClick={() => setActiveTab(id)}                           │
│       >                                                             │
│         {children}                                                 │
│       </button>                                                    │
│     );                                                             │
│   }                                                                 │
│                                                                     │
│   function Tabs.Panel({ id, children }) {                          │
│     const { activeTab } = useContext(TabsContext);                  │
│     //         ^ reads the SAME state too — no props from Tab       │
│                                                                     │
│     return activeTab === id ? <div>{children}</div> : null;        │
│   }                                                                 │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

Walk through what's happening, piece by piece:

1. `Tabs` holds the one piece of shared state that matters — `activeTab` — using ordinary `useState`, exactly like any component would.
2. `Tabs` creates a `Context.Provider` internally and hands it `{ activeTab, setActiveTab }` as the broadcast value.
3. `Tabs` renders `{children}` *inside* that Provider. Whatever the consumer nested between `<Tabs>` and `</Tabs>` — `Tabs.List`, `Tabs.Tab`, `Tabs.Panel`, a stray `<Badge>`, anything — is now inside the Provider's tree, whether it's a direct child or buried three levels deep.
4. `Tabs.Tab` and `Tabs.Panel` call `useContext(TabsContext)` to read that same `{ activeTab, setActiveTab }` value directly — completely bypassing the consumer. The consumer never touched `activeTab`, never passed it as a prop, never even needs to know it exists.
5. Click a tab → `setActiveTab(id)` runs → `Tabs` re-renders → the Provider broadcasts the new value → every `Tabs.Panel` (and `Tabs.Tab`) consuming that context re-renders too, automatically, and picks the new active id up.

That's the entire trick. There is no special "compound component" API in React — `createContext`, `Context.Provider`, and `useContext` are the exact same three tools from Phase 06's Context lesson. The only thing new here is *where* you put them: hidden inside a family of components that are designed to be used together, so the coordination "just happens" from the consumer's point of view.

---

## 5. A Full Example: Building `Tabs` Step by Step

Let's build the real thing, from nothing, in order.

### Step 1 — create the context and the parent

```jsx
import { createContext, useContext, useState } from "react";

const TabsContext = createContext(null);

function Tabs({ children, defaultTab }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}
```

Nothing exotic yet — `Tabs` is just a component with some state, wrapped around whatever `children` it's given, broadcasting that state via Context.

### Step 2 — build a small helper hook for reading the context safely

This isn't required, but it's a habit worth building immediately, because it catches Mistake 1 later in this lesson before it ever ships:

```jsx
function useTabsContext() {
  const context = useContext(TabsContext);
  if (context === null) {
    throw new Error(
      "Tabs.Tab / Tabs.Panel must be rendered inside a <Tabs> component."
    );
  }
  return context;
}
```

Instead of every sub-component calling `useContext(TabsContext)` directly and silently getting `null` if it's misused, they'll call `useTabsContext()`, which fails loudly with a clear message the moment something's wired up wrong.

### Step 3 — build `Tabs.List` and `Tabs.Tab`

```jsx
function TabsList({ children }) {
  return <div className="tabs-list" role="tablist">{children}</div>;
}

function Tab({ id, children, disabled = false }) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === id;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      className={isActive ? "tab tab--active" : "tab"}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  );
}
```

`Tab` never received `activeTab` as a prop from anyone. It reached into the shared context and grabbed it itself. `TabsList` doesn't even touch the context — it's purely a styling wrapper, proving that not every piece of a compound component needs to consume the shared state; some pieces are just structural.

### Step 4 — build `Tabs.Panel`

```jsx
function Panel({ id, children }) {
  const { activeTab } = useTabsContext();

  if (activeTab !== id) return null;

  return <div role="tabpanel">{children}</div>;
}
```

Simple — render your content only if your `id` matches the currently active tab. `Panel` never received the active id from `Tab`. They're siblings; neither one knows the other exists. They both just separately asked the same shared `Tabs` for the current state.

### Step 5 — attach the sub-components as properties on `Tabs`

This is the step that actually creates the `Tabs.Tab`, `Tabs.List`, `Tabs.Panel` dot-syntax you saw back in Section 1:

```jsx
Tabs.List = TabsList;
Tabs.Tab = Tab;
Tabs.Panel = Panel;

export default Tabs;
```

That's it — no framework magic. `Tabs` is just a plain function, and JavaScript happily lets you attach properties to a function. `Tabs.Tab` is simply `Tab`, reachable as a property of `Tabs`. This single step is what turns three separately-defined components into one cohesive, dot-notated family from the consumer's point of view.

### Step 6 — use it

```jsx
function ProfileTabsPage() {
  return (
    <Tabs defaultTab="profile">
      <Tabs.List>
        <Tabs.Tab id="profile">Profile</Tabs.Tab>
        <Tabs.Tab id="settings">Settings</Tabs.Tab>
        <Tabs.Tab id="billing" disabled>Billing</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel id="profile"><ProfilePanel /></Tabs.Panel>
      <Tabs.Panel id="settings"><SettingsPanel /></Tabs.Panel>
      <Tabs.Panel id="billing"><BillingPanel /></Tabs.Panel>
    </Tabs>
  );
}
```

Click "Settings" → `Tab`'s `onClick` fires `setActiveTab("settings")` → `Tabs` re-renders with the new `activeTab` → the Provider re-broadcasts → every `Tab` and every `Panel` reading the context re-renders, and the right `Panel` shows itself. Zero props were ever manually passed between `Tab` and `Panel`. That's the whole payoff.

### A quick reveal: the consumer really is free

Go back and notice what the consumer could do that a config-object `<Tabs tabs={[...]} />` API could never let them do easily:

```jsx
<Tabs defaultTab="profile">
  <Tabs.List>
    <Tabs.Tab id="profile">Profile</Tabs.Tab>
    <SearchBox />                         {/* arbitrary JSX, mixed right in */}
    <Tabs.Tab id="settings">
      Settings <Badge>new</Badge>          {/* arbitrary nested content */}
    </Tabs.Tab>
  </Tabs.List>

  <Tabs.Panel id="profile"><ProfilePanel /></Tabs.Panel>
  <Tabs.Panel id="settings"><SettingsPanel /></Tabs.Panel>
</Tabs>
```

`<SearchBox />` sits right there, inside `Tabs.List`, next to the tabs, and nothing broke. It's not part of the tab-switching logic at all — it's just JSX, nested wherever the consumer wanted it. That's the composition half of the pattern doing its job: `Tabs` and `TabsList` never restrict or inspect what's nested inside them; they just render `{children}` and let context handle the coordination for the pieces that care about it.

---

## 6. Compare With Related Concepts

There's more than one way to get sub-components talking to each other. Here's how the three main approaches stack up.

| | Compound Components (via Context) | Compound Components (via `React.Children` / `cloneElement`) | Config-Object Props API |
|---|---|---|---|
| **Coordination mechanism** | A `Context.Provider` created by the parent; children call `useContext` | Parent walks `props.children` with `React.Children.map`, and injects props into each child via `React.cloneElement` | A single prop (e.g. `tabs={[...]}`) fully describes the structure; parent renders everything itself |
| **Consumer's structural freedom** | Full — nest anything, anywhere, in any order, mixed with unrelated components | Restricted — the parent typically must inspect/assume its children are its own known sub-components (e.g. it may skip or break on a stray `<SearchBox />`) | None — structure is dictated by the shape of the config object, not JSX nesting |
| **Depth of nesting supported** | Any depth — context is readable from anywhere inside the Provider, no matter how deeply nested | Shallow, usually only direct children — `cloneElement` typically only walks immediate children, so deeply nested sub-components are easy to miss | N/A — there's no nesting, just data |
| **Type-checking children** | Not needed — any component can call `useContext` regardless of who its parent or siblings are | Often needed — the parent may need to check "is this child actually a `Tabs.Tab`?" before cloning props into it | N/A |
| **Boilerplate** | A touch more setup (create context, provider, a safety hook) but simple, standard React tools throughout | More — `Children.map`/`cloneElement` logic tends to get fiddly fast, especially with conditional or nested children | Least boilerplate for the simplest cases |
| **When it's the right choice** | Multi-part UI where consumers need real layout/content flexibility — tabs, accordions, selects, menus | Legacy codebases, or simple cases where children are shallow and always the component's own direct children | A component with one obvious configuration shape and little need for custom per-item rendering |

The historical note worth knowing: `React.Children.map` + `React.cloneElement` is how compound components were often built *before* the Context API existed in its current, ergonomic form. You'll still see it in some older libraries and blog posts. But it comes with real downsides — it typically only walks direct children (so `<Tabs.List><div><Tabs.Tab/></div></Tabs.List>` can silently break because `Tabs.Tab` is now a grandchild, not a direct child), and it usually forces the parent to inspect what type each child is before deciding whether to clone props into it. Context sidesteps both problems entirely: it doesn't care how deeply nested a consumer is, and it doesn't care what else is mixed in alongside it. That's why **Context is the modern, recommended way to build compound components**, and it's the only approach you should reach for in new code.

---

## 7. Common Mistakes and Confusions

**Mistake 1 — using a sub-component outside its required parent.**

```jsx
// Broken — Tabs.Tab rendered with no <Tabs> ancestor at all
function BrokenPage() {
  return <Tabs.Tab id="profile">Profile</Tabs.Tab>;
}
```

Without a `<Tabs>` ancestor, there's no `TabsContext.Provider` anywhere above `Tabs.Tab` in the tree, so `useContext(TabsContext)` returns whatever default value `createContext(...)` was given — in the example above, `null`. If `Tab` doesn't guard against that, it crashes trying to destructure `activeTab` off of `null`, and the resulting error message ("Cannot destructure property 'activeTab' of null") gives the next developer zero clue about what actually went wrong.

This is exactly why Step 2 in Section 5 built `useTabsContext()` — a tiny wrapper that throws a clear, specific error ("`Tabs.Tab` / `Tabs.Panel` must be rendered inside a `<Tabs>` component") the instant this mistake happens, instead of an obscure runtime crash three layers removed from the real cause. Any compound component with an internal Context should have a guard like this from day one.

**Mistake 2 — forgetting to attach the sub-components as properties.**

```jsx
// Defined, but never attached
function Tabs({ children, defaultTab }) { /* ... */ }
function Tab({ id, children }) { /* ... */ }
function Panel({ id, children }) { /* ... */ }

export default Tabs;
// Oops — forgot: Tabs.Tab = Tab; Tabs.Panel = Panel;
```

Consumers now try `<Tabs.Tab id="profile">` and get a runtime error, because `Tabs.Tab` is simply `undefined` — nobody ever assigned `Tab` to it. This is a purely mechanical step (Section 5, Step 5) but it's the one people forget most often, especially when refactoring a compound component into multiple files. If you split `Tab` and `Panel` into their own modules, the attachment (`Tabs.Tab = Tab`) has to happen somewhere central — usually in the same file that defines and exports `Tabs` itself — or the dot-syntax silently breaks.

**Mistake 3 — over-engineering a simple component into a compound one.**

Not every multi-part UI needs this pattern. If a component has a small, fixed, well-known shape — say, a `LabeledInput` that's always just a label plus one input — reaching for Context, a Provider, and three sub-components is pure overhead:

```jsx
// Over-engineered for what this actually needs to do
<LabeledInput.Root>
  <LabeledInput.Label>Email</LabeledInput.Label>
  <LabeledInput.Field type="email" />
</LabeledInput.Root>

// A plain props API says the exact same thing, with far less ceremony
<LabeledInput label="Email" type="email" />
```

The compound pattern earns its complexity when consumers genuinely need to rearrange, omit, or inject arbitrary content between the pieces (recall the `<SearchBox />` mixed into `Tabs.List` back in Section 5) — not just because a component happens to have more than one visual part. Ask yourself: "would a customer of this component ever want to nest something unusual, reorder pieces, or skip one entirely?" If the honest answer is no, a normal props API is simpler to write, simpler to read, and simpler to use correctly.

> **Memory hook:** "Compound components are for when the menu changes every week. If it's always the same three dishes, just print a normal menu card."

---

## 8. Interview Answer

If you only remember one paragraph from this entire lesson, make it this one:

"Compound components achieve implicit state sharing by combining two things you already know separately: composition and Context. The parent component (like `Tabs`) holds the shared state — say, which tab is active — in ordinary `useState`, and broadcasts it through a `Context.Provider` that wraps its `children`. Because the consumer's JSX is rendered inside that Provider (whatever they nested there, at whatever depth), every sub-component (`Tabs.Tab`, `Tabs.Panel`) can call `useContext` to read and update that same shared state directly — without the consumer manually wiring props between siblings, and without the parent needing a rigid config-object API. The sub-components are attached as properties on the parent function (`Tabs.Tab = Tab`) purely for a clean, discoverable dot-syntax at the call site; the real coordination work is 100% ordinary Context, doing exactly what it does in any other part of a React app."

---

## 9. Hands-On Exercises

**Exercise 1 — Build `Accordion`**

Build an `Accordion` compound component: `<Accordion><Accordion.Item id="a"><Accordion.Header>Q1</Accordion.Header><Accordion.Body>Answer 1</Accordion.Body></Accordion.Item></Accordion>`. Only one item can be expanded at a time. Use a `TabsContext`-style pattern: `Accordion` holds `openId` in state and a Context Provider; `Accordion.Header` toggles it on click; `Accordion.Body` renders only when its parent item's `id` matches `openId`.

**Exercise 2 — Add a "safety hook" guard**

Take the `Tabs` example from Section 5 and deliberately trigger Mistake 1 — render `<Tabs.Tab id="x">Oops</Tabs.Tab>` with no surrounding `<Tabs>`. Confirm you get the crash. Then add the `useTabsContext()` guard from Step 2 and confirm you now get a clear, descriptive thrown error instead.

**Exercise 3 — Multi-select `Select`**

Build a compound `Select`: `<Select multiple><Select.Option value="a">A</Select.Option><Select.Option value="b">B</Select.Option></Select>`. `Select` holds an array of selected values in state via Context; `Select.Option` reads the context to know if it's selected and calls a `toggle(value)` function from context when clicked. Render a visual checkmark next to selected options.

**Exercise 4 — Compare implementations**

Re-implement the `Tabs` component from Section 5 using `React.Children.map` and `React.cloneElement` instead of Context — the parent should walk its `children`, find any that are `Tab` or `Panel`, and inject `activeTab`/`setActiveTab` as props directly. Get it working for the flat case from Section 5, then try nesting a `Tabs.Tab` one level deeper inside a `<div>` and observe what breaks, compared to the Context version.

**Exercise 5 — Add a compound `Menu` with a stray child**

Build a `Menu` compound component (`Menu`, `Menu.Item`) using Context, where `Menu` tracks which `Menu.Item` is currently highlighted (e.g., via keyboard arrow keys). Then prove the composition half of the pattern by rendering an unrelated `<Divider />` component between two `Menu.Item`s, confirming it renders fine and doesn't interfere with the highlight-tracking logic.

**Exercise 6 — Refactor a config-object component**

Take a `<Wizard steps={[{ title, content }, ...]} />` config-object component (write a minimal version first) and refactor it into a compound `Wizard` / `Wizard.Step` API using Context to track the current step index. Afterwards, write down two things the new compound version lets a consumer do that the old config-object version couldn't.

---

## 10. Interview Q&A

**Q1: What is the compound component pattern?**

A: It's a set of components — a parent and several related sub-components, like `Tabs` and `Tabs.Tab`/`Tabs.Panel` — that are designed to be nested together as siblings under the parent, where the parent manages shared state internally and the sub-components implicitly read and update that state without the consumer having to manually wire props between them. The consumer retains full control over structure, ordering, and styling; only the state coordination is hidden.

---

**Q2: What two existing React concepts does the compound component pattern actually combine?**

A: Composition (Phase 02) and Context (Phase 06). The parent accepts `children` and renders whatever the consumer nests inside it — that's plain composition. Internally, the parent also wraps that `children` in a `Context.Provider` carrying whatever shared state matters, and the sub-components call `useContext` to read it — that's plain Context. There is no separate "compound component" mechanism in React itself; it's these two tools pointed at the same problem together.

---

**Q3: Why not just give `Tabs` a single `tabs={[...]}` config-object prop instead?**

A: A config object is simpler at first, but it forces every visual variation — a badge on a tab, a disabled state with a tooltip, an element inserted between the tab list and panels — to become a new field on every array entry, and `Tabs` has to grow logic to interpret each one. It also can't easily support arbitrary custom content mixed in between tabs. A compound component gives consumers ordinary JSX nesting instead, so they add badges, custom elements, or reordering directly, with no new "config fields" ever needed.

---

**Q4: How does `Tabs.Tab` know which tab is currently active without receiving it as a prop from `Tabs`?**

A: `Tabs` holds `activeTab` in `useState` and passes `{ activeTab, setActiveTab }` as the `value` of a `Context.Provider` that wraps its `children`. `Tabs.Tab` calls `useContext` on that same context object to read `activeTab` directly, and calls `setActiveTab` on click. Neither the consumer nor `Tabs` manually forwards a prop into `Tabs.Tab` — the sub-component reaches into the shared context itself.

---

**Q5: What does `Tabs.Tab = Tab;` actually do, mechanically?**

A: It attaches the `Tab` function as a property named `Tab` on the `Tabs` function object. JavaScript functions are objects, so they can have arbitrary properties assigned to them. This is purely a naming/ergonomics step — it lets consumers write `<Tabs.Tab>` instead of importing and using a separately-named `Tab` component — and has nothing to do with how the state coordination itself works.

---

**Q6: What happens if `Tabs.Tab` is rendered without a `<Tabs>` ancestor above it?**

A: `useContext(TabsContext)` returns the default value passed to `createContext(...)` (commonly `null`), since there's no `Provider` above it in the tree to override that default. If the sub-component doesn't guard against this, it typically crashes trying to destructure fields off of `null`. The recommended fix is a small wrapper hook (e.g. `useTabsContext()`) that checks for the missing context and throws a clear, specific error naming the required parent.

---

**Q7: Compare building compound components with Context versus with `React.Children.map` / `React.cloneElement`.**

A: The Context approach lets the parent broadcast shared state to any descendant, at any nesting depth, regardless of what else is mixed in among the children — sub-components just call `useContext` wherever they are. The `Children`/`cloneElement` approach has the parent walk its direct children and inject props into the ones it recognizes; it typically only reaches immediate children (so a sub-component nested one level deeper, e.g. inside a wrapping `<div>`, gets missed), and it often needs to type-check each child to decide whether to clone props into it. Context is generally the cleaner, more robust, and now-recommended approach for new code.

---

**Q8: Where would you encounter this pattern in real-world code?**

A: It's exactly how many popular headless UI libraries structure their component APIs — libraries like Radix UI and Headless UI expose components as families such as `Dialog`, `Dialog.Trigger`, `Dialog.Content`, `Dialog.Title`, or `Select`, `Select.Trigger`, `Select.Content`, `Select.Item`, all coordinating shared state (open/closed, selected value) internally via Context while giving the consuming application full control over markup, styling, and structure.

---

**Q9: What's the main benefit compound components give the consumer that a single monolithic component with many props doesn't?**

A: Structural freedom. The consumer decides exactly what's nested where — reordering pieces, omitting ones they don't need, inserting unrelated custom content between them (like a search box between tabs) — all with ordinary JSX, instead of being limited to whatever shape a single component's props were designed to support.

---

**Q10: Is a compound component always the right choice for a multi-part UI?**

A: No. If a component has a small, fixed, well-known shape and consumers never need to rearrange, omit, or inject custom content between its parts, a simple props-based API is simpler to write and use. Reach for the compound pattern specifically when consumers genuinely need real flexibility over structure and content — not just because a component happens to render more than one visual piece.

---

**Q11: In the `Tabs` example, why does `TabsList` not need to call `useContext` at all?**

A: `TabsList` is purely structural — it just renders a styled wrapper (`<div role="tablist">`) around whatever `children` it's given. It doesn't need to know which tab is active or change any state, so it has no reason to read the shared context. This shows that not every piece of a compound component consumes the shared state; some pieces exist purely for composition/structure, and only the pieces that actually need the shared data call `useContext`.

---

**Q12: How would you prevent a developer from misusing a sub-component outside its parent, in a way that fails loudly instead of silently?**

A: Wrap the raw `useContext(SomeContext)` call in a small custom hook (e.g. `useTabsContext()`) that checks whether the returned value is the context's default (commonly `null`, if no ancestor `Provider` set a real value) and throws a descriptive error naming exactly which parent component is required. Every sub-component then calls this wrapper hook instead of `useContext` directly, so misuse fails immediately with a clear message rather than crashing later with a confusing "cannot read property of null" error.

---

**Q13: Does the compound component pattern require class components or any special React API beyond what's used elsewhere?**

A: No. It's built entirely from ordinary function components, `useState`, `createContext`, `Context.Provider`, and `useContext` — the exact same tools used for any other stateful, context-sharing feature in a React app. The only unusual part is organizational: sub-components are attached as properties on the parent function purely for a clean dot-syntax API, and the Provider is set up inside the parent rather than at the top of the whole app.

---

**Q14: If two completely separate `<Tabs>` instances are rendered on the same page, do they interfere with each other's active tab?**

A: No. Each `<Tabs>` instance creates its own `useState` call and its own `Context.Provider` wrapping only its own `children`. `Tabs.Tab`/`Tabs.Panel` nested inside one `<Tabs>` instance read the nearest enclosing Provider above them in the tree — the one created by that specific `Tabs` instance — so multiple `<Tabs>` trees on the same page each track their own independent `activeTab` state without any cross-talk.

---

**Q15: What's the risk of over-applying this pattern to every multi-part component in a codebase?**

A: Unnecessary complexity for consumers and maintainers. Each compound component adds a Context, a Provider, a safety-guard hook, and several sub-components that all need to be understood together before anyone can use or modify the component correctly. For components with a simple, fixed shape and no real need for structural flexibility, this is more machinery than the problem calls for — a plain props-based API achieves the same result with far less code to read, test, and maintain.
