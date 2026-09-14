# The RSC/Client Boundary — Complete Guide

> "Crossing the checkpoint doesn't just change you — it changes everyone you bring in with you."

---

## Table of Contents
1. [The Problem: Where Does "use client" Actually Stop?](#1-the-problem-where-does-use-client-actually-stop)
2. [The Checkpoint Model](#2-the-checkpoint-model)
3. [Tracing the Tree: Two Branches](#3-tracing-the-tree-two-branches)
4. [Code Walkthrough: Page, Counter, and ClickCount](#4-code-walkthrough-page-counter-and-clickcount)
5. [Crossing Directions: Top-Down vs Bottom-Up](#5-crossing-directions-top-down-vs-bottom-up)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Where Does "use client" Actually Stop?

Phase 1 established the basic split — Server Components by default, `"use client"` opts a file into the client bundle. Left unanswered: what happens to the *other* components that file imports?

```
Two wrong assumptions:
  1. "use client" reaches BACKWARD  → turns the importing parent client-side too. FALSE.
  2. "use client" is scoped to ONLY that one component  → anything it imports stays
     server-only unless it says otherwise. ALSO FALSE.
```

`"use client"` marks a *module*, not a component — and the client bundle is built by walking that module's own imports outward from there.

---

## 2. The Checkpoint Model

Think of a border checkpoint. A traveler standing on the server side can wave someone over without crossing anything themselves — that's a Server Component rendering a Client Component. But once *you* cross (a file declares `"use client"`), everything you carry crosses with you — no per-item passport check.

```
"use client" propagation:

  UPWARD (to the importer)     → NOT inherited. Server Component stays server-side
                                  even though it renders a Client Component.

  DOWNWARD (into its imports)  → IS inherited, transitively. Any component the
                                  Client Component imports — even with no directive
                                  of its own — ships to the browser, because the
                                  bundler is already walking client territory.
```

The practical consequence: the smallest, least-considered presentational component can land in the client bundle purely by accident of where it's imported from — not because of anything it does.

---

## 3. Tracing the Tree: Two Branches

```
ServerComponent  (app/dashboard/page.js — no directive)
      │
      ├──▶ ClientComponent  ("use client" — e.g. Counter.js)
      │           │
      │           └──▶ ChildA  (no directive)
      │                        bundled client-side — parent already
      │                        crossed the checkpoint
      │
      └──▶ ChildB  (no directive)
                   stays server-side — parent (ServerComponent)
                   never crossed the checkpoint
```

`ChildA` and `ChildB` are syntactically identical files — neither has `"use client"` written anywhere. Only the importer decides their fate.

---

## 4. Code Walkthrough: Page, Counter, and ClickCount

```jsx
// app/dashboard/page.js  (Server Component — no directive)
import Counter from "./Counter";

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Counter />
      {/* ↳ Server → Client, always fine; Page stays server-side */}
    </div>
  );
}
```

```jsx
// app/dashboard/Counter.js
"use client";

import { useState } from "react";
import ClickCount from "./ClickCount"; // ↳ no directive, but pulled in anyway

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      <ClickCount value={count} />
    </button>
  );
}
```

```jsx
// app/dashboard/ClickCount.js  (no directive — purely presentational)
export default function ClickCount({ value }) {
  return <span>Clicked {value} times</span>;
}
```

`ClickCount` ships to the browser despite having no directive — it's imported by `Counter.js`, which already crossed the checkpoint. `page.js` never crosses; it only renders a Client Component, which is the safe direction.

---

## 5. Crossing Directions: Top-Down vs Bottom-Up

| Direction | Example | Allowed? |
|---|---|---|
| Server Component imports & renders a Client Component | `page.js` renders `<Counter />` | Yes — standard, universal pattern; `page.js` stays server-side |
| Client Component imports a component with no directive | `Counter.js` imports `<ClickCount />` | Yes, but `ClickCount` is pulled into the client bundle regardless |
| Client Component imports & directly renders a genuine Server Component | `Counter.js` tries `import ServerOnlyPanel from "./ServerOnlyPanel"` | Not supported — `ServerOnlyPanel` gets absorbed into the client graph and loses its server-only capability; fix is the children-passing pattern (Lesson 2) |

Worth noting: most real Server Components are `async` functions (data fetching is their whole reason for existing — see `getUser`/`UserGreeting` in Phase 1). Even setting aside the capability problem, React doesn't support `async`/`await` Client Components at all — so there's no code path that would let a Client Component's render function wait on one. Either problem alone rules out direct import; together they compound.

---

## 6. Common Mistakes

- **Putting `"use client"` on a top-level layout "to be safe."** Propagates downward through every subsequent import — pulls the entire page tree beneath it into the client bundle.
- **Trying to `import` and directly render a genuine Server Component from inside a Client Component.** The imported module gets absorbed into the client graph, stripping anything server-only it depended on (DB call, secret env var) — it errors out the moment it tries to do the server-only thing it was written for.
- **Assuming a directive-free component is always server-only.** Its fate depends entirely on who imports it — the same file can be server-side in one part of the tree and client-side in another.
- **Believing the directive marks "this one component," full stop.** It marks a module boundary for the whole dependency graph rooted at that file.

---

## 7. Hands-On Exercises

**Exercise 1:** Recreate the `page.js` / `Counter.js` / `ClickCount.js` trio from Section 4 exactly. Confirm clicking the button updates the count, proving both hydrated.

**Exercise 2:** Add a second presentational child, `ResetLabel.js` (no directive, renders a `<small>` reset hint), imported by `Counter.js` alongside `ClickCount`. Confirm it renders correctly without ever adding `"use client"` to it.

**Exercise 3:** Temporarily move `<ClickCount value={count} />` so `page.js` imports and renders `ClickCount` directly, with a hardcoded number instead of `count`. Confirm it works fine — the same file is valid from a Server Component too; only its position inside `Counter` made it client-side.

**Exercise 4:** Add `"use client"` to `app/dashboard/layout.js` wrapping several static pages. Inspect the bundle size for that route segment, then remove the directive and compare.

**Exercise 5:** Write a one-paragraph explanation for a teammate of why `ChildB` in Section 3's diagram stays server-side even though it's character-for-character identical to `ChildA`.

---

## 8. Interview Q&A

**Q: If a file has no `"use client"` directive, is it guaranteed to run only on the server?**
Not by itself — it depends on who imports it. A directive-free component imported by a Server Component stays server-side, but the exact same component imported by a Client Component gets pulled into the client bundle, because `"use client"` propagates downward through the importing file's own dependency graph, not just to the one file it's written on.

**Q: Does marking a component `"use client"` affect the component that renders it?**
No — the directive is not inherited upward. A Server Component can import and render a Client Component and remain a Server Component itself; that's the standard direction of composition. Propagation only flows downward, into whatever the Client Component itself goes on to import.

**Q: What actually goes wrong if you import a genuine Server Component directly inside a Client Component file?**
The imported module gets pulled into the client bundle graph, which strips away anything server-only it depended on — a direct database call, a secret API key read from `process.env` — turning it into a broken client-rendered component. The fix is to have a Server Component parent render both and pass the Server Component's output down as `children` or a prop.

**Q: Why does adding `"use client"` to a high-level layout tend to bloat the bundle far more than adding it to a small leaf component?**
Because the directive's effect isn't confined to that one file — it pulls every component the layout imports, and everything those components import in turn, into the client bundle. A layout sits near the root of a large subtree, so marking it client-side drags a correspondingly large portion of the tree across the boundary.

**Q: Can the same component file be a Server Component in one place and part of the client bundle in another?**
Yes. A directive-free file's bundle membership is determined by the importer, not by anything written in the file itself — a presentational component imported from a Server Component in one route and a Client Component in another is server-side in the first case and client-side in the second.
