# React Server Components Mental Model

> "No `use client` = stays in the kitchen. `use client` = comes out to the counter and can talk back."

---

## Table of Contents

1. [The Problem: Every Component Pays a JS Tax](#1-the-problem-every-component-pays-a-js-tax)
2. [The Kitchen and the Counter](#2-the-kitchen-and-the-counter)
3. [Basic Definitions](#3-basic-definitions)
4. [The Render-and-Hydrate Flow](#4-the-render-and-hydrate-flow)
5. [A Server Component and a Client Component, Side by Side](#5-a-server-component-and-a-client-component-side-by-side)
6. [The Composition Rule: Which Way Can You Import?](#6-the-composition-rule-which-way-can-you-import)
7. [Server Component vs Client Component](#7-server-component-vs-client-component)
8. [Common Mistakes and Confusions](#8-common-mistakes-and-confusions)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Problem: Every Component Pays a JS Tax

In a fully client-rendered React app, every component gets bundled into JavaScript and shipped to the browser — whether or not it's ever interactive.

### The Cost, Concretely

```
A dashboard with 15 "read-only" panels
  (stats card, table, summary block — none of them click, hold
   state, or use a browser API)
      ↓
ships 15 panels' worth of JavaScript anyway
      ↓
browser burns CPU parsing/executing code that produces the
SAME static output every single time
      ↓
bundle grows in lockstep with the app, even for parts that are
functionally just server-rendered HTML wearing a React costume
```

React Server Components exist to stop charging that tax on components that don't need it.

---

## 2. The Kitchen and the Counter

### The Analogy

```
KITCHEN                              COUNTER
-------                              -------
Chopping, cooking, plating happen    Customer leans in directly —
behind the scenes. Customer only     points, asks for extra pickles,
sees the finished plate. Recipe      gets an immediate response to
changes tomorrow? Customer is        a request made in real time.
none the wiser.
```

### Mapped to React

```
Server Components  →  the KITCHEN. All the work — DB reads, formatting,
                       composing markup — happens on the server. Only
                       the finished plate (rendered HTML) reaches the browser.

Client Components  →  the COUNTER. The browser interacts directly: click
                       a button, type into a field, watch state change
                       instantly, because the component's actual code is
                       running right there.
```

---

## 3. Basic Definitions

### React Server Components (RSC)

```
Render entirely on the server
  ↳ Send only resulting HTML + a compact serialized RSC payload
    to the browser.
  ↳ NONE of that component's JavaScript ships to the client.
  ↳ Cannot become interactive later — its code was never sent.
```

### Client Components

```
"use client";  ← directive at the top of the file

  ↳ Still rendered on the server for the initial HTML (fast
    first paint, same as a Server Component).
  ↳ But its JavaScript DOES get sent afterward, so it can
    "hydrate" — attach event listeners, init state, respond
    to interaction.
```

### The Default in app/

```
Every component inside app/ is a Server Component by default.
No directive needed anywhere.

You only opt INTO client behavior by adding "use client" to a
specific file — that shifts just that component (and, per
Section 6, potentially things it imports) into the
"ships JS to the browser" category.
```

---

## 4. The Render-and-Hydrate Flow

```
Server Component tree (default in app/)
        │
        ▼
Rendered on the server → produces HTML + an RSC payload
(no JS for these components is bundled for the browser)
        │
        ▼
Sent to the browser as part of the initial page load
        │
        ▼
Any Client Components embedded in that tree "hydrate":
their JS (already included because they're marked "use client")
attaches event listeners to the HTML that's already on the page
        │
        ▼
Page is now interactive — clicks/state changes work in Client
Components, while Server Components remain static, inert HTML
```

### What Doesn't Happen

```
There is NO step where the browser "re-renders" a Server Component.
  ↳ Once its HTML lands, that's it — finished.
  ↳ Only Client Components hydrate, because only they have JS to attach.
```

---

## 5. A Server Component and a Client Component, Side by Side

### The Server Component

No directive, runs only on the server, `fetch`es data directly in the component body — no `useEffect` needed.

```jsx
// app/dashboard/UserGreeting.jsx  (Server Component — default, no directive)
async function getUser() {
  const res = await fetch("https://api.example.com/user/1");
  return res.json();
}

export default async function UserGreeting() {
  const user = await getUser();
  return <h2>Welcome back, {user.name}</h2>;
}
```

### The Client Component

Needs the directive because it uses `useState` and responds to a click — neither of which a Server Component is allowed to do.

```jsx
// app/dashboard/Counter.jsx
"use client";

import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  );
}
```

```
UserGreeting  ↳ code NEVER reaches the browser as JS — only its
                rendered HTML (<h2>Welcome back, Alice</h2>) does.

Counter       ↳ code DOES reach the browser — it must actually run
                there to respond to clicks and re-render its count.
```

---

## 6. The Composition Rule: Which Way Can You Import?

This is the single most common point of confusion once developers understand the basic split.

### Direction 1: Server → Client (Always Fine)

A Server Component can freely import and render a Client Component — the normal, universal pattern.

```jsx
// app/dashboard/page.js (Server Component)
import Counter from "./Counter"; // a Client Component

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Counter />
    </div>
  );
}
```

### Direction 2: Client → Server (The Anti-Pattern)

Importing a Server Component directly *inside* a Client Component file pulls that module into the client bundle graph — stripping away anything server-only it relied on (a direct DB call, a secret API key from `process.env`) and turning it into just another client-rendered component.

### The Fix: Pass It Down as children

When a Client Component genuinely needs to display Server Component content (e.g. a tab widget showing a data-heavy panel), the Server Component parent renders both and hands the Server Component's output down as `children` — the Client Component never imports it directly.

```jsx
// app/dashboard/page.js (Server Component — the parent)
import Tabs from "./Tabs";           // Client Component
import HeavyPanel from "./HeavyPanel"; // Server Component

export default function DashboardPage() {
  return (
    <Tabs>
      <HeavyPanel /> {/* rendered server-side, then handed to Tabs as children */}
    </Tabs>
  );
}
```

```jsx
// app/dashboard/Tabs.jsx (Client Component)
"use client";

import { useState } from "react";

export default function Tabs({ children }) {
  const [active, setActive] = useState(0);
  // Tabs never imports HeavyPanel itself — it just renders whatever
  // was already rendered server-side and handed to it as children.
  return <div className="tab-panel">{children}</div>;
}
```

```
One direction is one-way through a door:

  Client Component's own imports  → pulled INTO the client bundle
  Server Component's pre-rendered output → can still be HANDED to
                                            a Client Component without
                                            losing its server-only nature
```

---

## 7. Server Component vs Client Component

| Aspect | Server Component | Client Component |
|---|---|---|
| Can use hooks (`useState`, `useEffect`, etc.) | No | Yes |
| Can access backend directly (DB queries, secret API keys, filesystem) | Yes | No |
| Ships JavaScript to the browser | No | Yes |
| Can use browser-only APIs (`window`, `localStorage`, event handlers) | No | Yes |
| Needs a directive to opt in | No — this is the default in `app/` | Yes — requires `"use client"` at the top of the file |
| Can import and render the other type | Yes — freely renders Client Components | No — cannot directly import a Server Component; must receive it as `children`/props from a Server Component parent |

---

## 8. Common Mistakes and Confusions

**Slapping `"use client"` on every file "just in case."** Silently opts entire subtrees back into client-side rendering, shipping unnecessary JS. The directive should mark the smallest possible boundary — the interactive leaf, not the whole page.

**Using `useState`/`useEffect` in a file without `"use client"`.** Produces a build error — those hooks need a browser runtime to hold state and re-render; a Server Component runs once, on the server, and is done.

**Assuming Server Components mean "no HTML until interaction."** They still send full HTML for first paint, exactly like any server-rendered page — only their *JavaScript* is withheld, not their rendered output.

**Getting the composition direction backwards.** Assuming a Client Component can safely `import` and render a Server Component the way a Server Component renders a Client Component. It can't — pass the Server Component down as `children`/props from a Server Component parent instead (Section 6).

**Thinking `"use client"` marks only that one component.** In practice everything that file exports — and often things it imports without their own directive — gets pulled into the client bundle too. The boundary should be drawn thoughtfully, not automatically.

---

## 9. Hands-On Exercises

**Exercise 1:** Sketch a component tree for a blog post page: a `Post` Server Component containing a `PostBody` Server Component and a `LikeButton` Client Component. Label which parts ship JavaScript to the browser.

**Exercise 2:** Write out the `UserGreeting` Server Component from Section 5 and extend it to also fetch and display the user's most recent 3 posts, still with no `"use client"` directive anywhere.

**Exercise 3:** Take the `Tabs`/`HeavyPanel` composition example from Section 6 and extend it to two tabs, each showing a different Server Component passed in via a differently-named prop (not just `children`).

**Exercise 4:** Write a short paragraph, as if explaining to a teammate, describing what would go wrong, concretely, if `HeavyPanel` in Section 6 were imported directly inside `Tabs.jsx` instead of passed as `children` — assume `HeavyPanel` reads a secret API key from `process.env` to fetch data.

**Exercise 5:** Given a hypothetical dashboard with a static header, a live-updating notification bell, and a static footer, identify which pieces should be Server Components and which should be Client Components, and justify each choice in one sentence.

---

## 10. Interview Q&A

**Q: What's the fundamental difference between a Server Component and a Client Component in the Next.js App Router?**
A: A Server Component renders entirely on the server and sends only HTML to the browser — none of its JavaScript ships at all. A Client Component (marked `"use client"`) is also rendered on the server for the initial HTML, but its JavaScript does get sent afterward so it can hydrate and respond to interaction like clicks or state changes. Server Components are the default in the `app/` directory; Client Components are an explicit opt-in.

**Q: Can a Server Component render a Client Component, and can a Client Component render a Server Component?**
A: A Server Component can freely import and render a Client Component — that's the normal, universal pattern. The reverse doesn't work the same way: a Client Component cannot directly import a Server Component, because doing so would pull it into the client bundle graph and strip away anything server-only it depended on. Instead, the Server Component should be passed into the Client Component as `children` or another prop from a Server Component parent.

**Q: Why would you deliberately choose a Server Component over a Client Component for a given piece of UI?**
A: Mainly to reduce the amount of JavaScript shipped to the browser and to get direct, secure access to backend resources like a database or a secret API key without exposing them to the client. Anything that's purely presentational or read-only — a static header, a data table, a formatted price — is a strong candidate for staying a Server Component.

**Q: What happens if you try to use `useState` in a component without the `"use client"` directive?**
A: It fails at build time. Hooks like `useState` and `useEffect` require a browser runtime to hold state and re-render in response to changes, and a Server Component only ever runs once, on the server — there's no "later" for it to update in, so React rejects the usage rather than silently doing nothing.

**Q: Does marking a component `"use client"` mean nothing else in the app changes?**
A: No — it typically pulls that file's own imports into the client bundle as well, since the directive marks a *boundary* for the whole module graph rooted at that file, not just the one component. This is why the directive should be placed as close to the actual interactive leaf as possible, rather than at a high-level layout or page, to avoid needlessly ballooning the client bundle.
