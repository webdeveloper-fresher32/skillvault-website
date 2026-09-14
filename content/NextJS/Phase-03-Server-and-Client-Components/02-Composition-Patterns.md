# Composition Patterns — Complete Guide

> "Pass the finished plate through the serving window — the dining room doesn't need the recipe, just the meal."

---

## Table of Contents
1. [The Problem: Interactive Wrappers Need Server Content Inside Them](#1-the-problem-interactive-wrappers-need-server-content-inside-them)
2. [The Serving Window Model](#2-the-serving-window-model)
3. [Code Flow: Page, Tabs, and the Server-Rendered Panel](#3-code-flow-page-tabs-and-the-server-rendered-panel)
4. [Extending to Multiple Named Slots](#4-extending-to-multiple-named-slots)
5. [Import-and-Render vs Pass-as-Children](#5-import-and-render-vs-pass-as-children)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Interactive Wrappers Need Server Content Inside Them

Lesson 1's hard rule: a Client Component can't directly import and render a genuine Server Component — it pulls that module into the client graph and strips its server-only capability. But plenty of real UI needs exactly that combination.

```
Tabs widget:
  active-tab state   → needs client-side interactivity  → Client Component
  tab content        → e.g. a DB-backed report panel     → wants to stay
                                                            a Server Component
                                                            (zero JS shipped)
```

`Tabs.js` can't just `import` the panel directly (Lesson 1). This lesson covers the pattern Next.js actually supports.

---

## 2. The Serving Window Model

A restaurant serving window: the kitchen cooks entirely out of sight, plates the dish, sets it on the ledge. The server in the dining room picks it up and places it on the table — never touches a stove, never sees the recipe.

```
Server Component (kitchen)  → does the work (fetch, query DB) on the server
                            → hands over only the FINISHED OUTPUT, as children
Client Component (server)   → receives the already-rendered plate as a prop
                            → places it in its own layout — no import needed
```

Crucially, the food is cooked *before* it reaches the window: the Server Component renders first, on the server, and only its finished output — not source code, not data-fetching logic — travels into the Client Component's slot.

---

## 3. Code Flow: Page, Tabs, and the Server-Rendered Panel

```jsx
// app/dashboard/page.js  (Server Component)
import Tabs from "./Tabs";
import HeavyPanel from "./HeavyPanel";

export default function Page() {
  return (
    <Tabs>
      <HeavyPanel />
      {/* ↳ rendered server-side FIRST, then handed to Tabs as children */}
    </Tabs>
  );
}
```

```jsx
// app/dashboard/HeavyPanel.js  (Server Component)
async function getReport() {
  const res = await fetch("https://api.example.com/report", {
    headers: { Authorization: `Bearer ${process.env.SECRET_API_KEY}` },
  });
  return res.json();
}

export default async function HeavyPanel() {
  const report = await getReport();
  return <div className="report">{report.summary}</div>;
}
```

```jsx
// app/dashboard/Tabs.js  (Client Component — never imports HeavyPanel)
"use client";

import { useState } from "react";

export default function Tabs({ children }) {
  const [active, setActive] = useState(0);

  return (
    <div className="tabs">
      <div className="tab-buttons">
        <button onClick={() => setActive(0)}>Overview</button>
        <button onClick={() => setActive(1)}>Report</button>
      </div>
      {active === 1 && <div className="tab-panel">{children}</div>}
    </div>
  );
}
```

`Tabs` never knew `children` came from a component reading a secret API key — it just received finished content and placed it in the DOM. `HeavyPanel`'s server-only code never entered the client bundle.

---

## 4. Extending to Multiple Named Slots

`children` covers the single-slot case. A two-tab widget where each tab shows a *different* Server Component needs multiple named props — any prop name can carry pre-rendered JSX:

```jsx
// app/dashboard/page.js  (Server Component)
import Tabs from "./Tabs";
import OverviewPanel from "./OverviewPanel"; // Server Component
import ReportPanel from "./ReportPanel";     // Server Component

export default function Page() {
  return (
    <Tabs
      overviewSlot={<OverviewPanel />}
      reportSlot={<ReportPanel />}
    />
  );
}
```

```jsx
// app/dashboard/Tabs.js  (Client Component)
"use client";

import { useState } from "react";

export default function Tabs({ overviewSlot, reportSlot }) {
  const [active, setActive] = useState(0);

  return (
    <div className="tabs">
      <div className="tab-buttons">
        <button onClick={() => setActive(0)}>Overview</button>
        <button onClick={() => setActive(1)}>Report</button>
      </div>
      {active === 0 && <div className="tab-panel">{overviewSlot}</div>}
      {active === 1 && <div className="tab-panel">{reportSlot}</div>}
    </div>
  );
}
```

Both panels are rendered server-side, ahead of time, by `page.js` — `Tabs` still doesn't import either one; it just holds two labeled slots and shows whichever is active.

---

## 5. Import-and-Render vs Pass-as-Children

| Pattern | Server → Client | Client → Server |
|---|---|---|
| Import and render directly | Works — standard, universal direction (Lesson 1) | Fails — pulls the Server Component into the client graph, strips its server-only capability |
| Pass as `children`/named prop | Works — a Server Component parent hands a Client Component its own or another component's pre-rendered output | Works — the actual supported mechanism for getting Server Component content inside a Client Component |

The right column is the point of this lesson: passing as `children`/props is the *only* direction that lets a Client Component display Server Component content — because the Server Component parent, not the Client Component, is the one doing the rendering and importing.

---

## 6. Common Mistakes

- **Trying to import a Server Component directly inside a Client Component file.** Lesson 1's anti-pattern resurfacing here — fails to preserve server-only behavior. It also fails more immediately than that: most Server Components (like `HeavyPanel`) are `async`, and React doesn't support `async`/`await` Client Components at all.
- **Over-using the children-as-slot pattern for trivial, non-interactive cases.** If nothing needs state, event handlers, or a browser API, it doesn't need a Client Component wrapper at all — it can stay a plain Server Component, rendered directly.
- **Assuming the Client Component can inspect or re-render the passed-in content.** Once handed over as `children`, it can be positioned, wrapped, conditionally shown/hidden — but not reached into, re-fetched, or reconfigured; it's already-finished output, not live code.

---

## 7. Hands-On Exercises

**Exercise 1:** Build the three-file `page.js` / `HeavyPanel.js` / `Tabs.js` trio from Section 3 (a `fetch` to any placeholder API is fine). Confirm clicking between tabs shows/hides the panel, and confirm no server-only code appears in the browser's downloaded JS.

**Exercise 2:** Extend into the two-slot version from Section 4 — add `OverviewPanel.js`, update `page.js` and `Tabs.js` to pass `overviewSlot` and `reportSlot` as named props.

**Exercise 3:** Add a third named slot, `settingsSlot`, backed by `SettingsPanel.js`, plus a third tab button. Confirm the pattern scales without changes to how `Tabs` obtains its content.

**Exercise 4:** Temporarily change `Tabs.js` to `import HeavyPanel from "./HeavyPanel"` directly and render it inline instead of receiving it as a prop. Observe the resulting build error or broken behavior, then revert.

**Exercise 5:** Write a one-paragraph explanation for a PR reviewer of why a static `<Footer />` should **not** be threaded through `Tabs` as a named slot — argue for it staying a plain Server Component rendered directly inside `page.js`.

---

## 8. Interview Q&A

**Q: How do you display Server Component content inside a Client Component if you can't import it directly?**
By having a Server Component parent render the Server Component itself and pass its already-rendered output down as `children` (or another named prop) into the Client Component. The Client Component never imports the Server Component — it just receives finished JSX as a prop value and places it in its own markup.

**Q: Why does passing a Server Component as `children` work when importing it directly doesn't?**
Because of when rendering happens. The Server Component parent renders content into finished output entirely on the server, before it's handed to the Client Component. By the time the Client Component receives it, it's just a plain React element in a prop — not a module the client bundle needs to pull in and execute — so none of the server-only dependencies need to travel to the browser.

**Q: Can a component accept more than one piece of Server Component content at once?**
Yes — `children` is just the conventional name for a single default slot; a component can define any number of additional props (`overviewSlot`, `reportSlot`, etc.) and receive a different pre-rendered Server Component in each, exactly like passing multiple ordinary props.

**Q: If a Client Component receives Server Component output as `children`, can it inspect or modify that content?**
No — it can only position it: render it, conditionally show/hide it, wrap it in other markup. It can't reach into its internals, re-fetch its data, or alter its props, because that content already finished rendering on the server before it arrived.

**Q: Should every interactive wrapper component use the children-as-slot pattern?**
Only when it genuinely needs to combine client-side interactivity with server-rendered content. If a piece of UI has no state, no event handlers, and no browser APIs at all, it doesn't need to be a Client Component in the first place — it should just stay a plain Server Component.
