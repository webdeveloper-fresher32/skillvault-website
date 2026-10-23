# CSS Modules and Global Styles — Complete Guide

> "A plain global stylesheet is one shared coat rack — hang two coats on the same hook and one of them falls."

---

## Table of Contents

1. [The Problem: Global Class Name Collisions](#1-the-problem-global-class-name-collisions)
2. [The Name-Tag Analogy](#2-the-name-tag-analogy)
3. [The Mechanism: CSS Modules and globals.css](#3-the-mechanism-css-modules-and-globalscss)
4. [Code Walkthrough: Card.module.css and Card.js](#4-code-walkthrough-cardmodulecss-and-cardjs)
5. [Comparing CSS Modules to Global CSS](#5-comparing-css-modules-to-global-css)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Global Class Name Collisions

A plain, app-wide CSS file has exactly one namespace: the class name itself. Two components that both decide to call something `.card` are actually fighting over the very same rule.

### Two Components, One Class Name

```text
styles.css
  .card { padding: 16px; border: 1px solid #ddd; }

ProductCard.js   → <div className="card"> ... expects the padding/border
UserCard.js      → <div className="card"> ... written later, unrelated component

Both components render with whichever `.card` rule was defined last —
whichever file happens to load last in the cascade wins, silently.
```

### Why This Gets Worse as an App Grows

```text
Small app   → a handful of class names, collisions are rare and easy to spot
Large app   → dozens of components, dozens of contributors, the same
              generic names (.card, .title, .button, .list) get reused
              independently, and nobody notices until a style breaks
              somewhere completely unrelated to the file just edited
```

### What's Missing

Nothing about a plain `.css` file stops two components from claiming the same class name — there's no built-in concept of "this class belongs to this component only." What's missing is a way to scope a class name to the file that defines it.

---

## 2. The Name-Tag Analogy

At a large conference, if everyone's badge just says "Alex," any hallway conversation risks the wrong Alex answering. A better badge prints a unique ID alongside the name — `Alex #4471` — so there's never any doubt about which Alex is meant.

### Shared Name vs Unique ID

```text
Plain name tag        → "Alex" — collides with every other Alex at the event
Name tag with unique ID → "Alex #4471" — guaranteed to refer to one specific person
```

### Mapping the Analogy to CSS Modules

A CSS Module gives every class name it defines a unique, generated ID as a suffix, the same way the conference badge does. `.card` in one component's module file and `.card` in another's are never actually the same rule once the build tool is done with them — each is uniquely tagged.

---

## 3. The Mechanism: CSS Modules and globals.css

A file named with the `.module.css` suffix is treated specially by Next.js's build tooling: every class name inside it gets rewritten to a unique name at build time, and importing it gives back an object mapping the original names to their rewritten versions.

### The .module.css Naming Trigger

```text
Card.module.css     → CSS Modules scoping applies (unique names generated)
Card.css             → treated as a plain, unscoped stylesheet — no renaming
globals.css          → also plain and unscoped, imported once, applies app-wide
```

### Importing and Using a Module

```js
// Card.js
import styles from './Card.module.css';

export default function Card() {
  return <div className={styles.card}>Hello</div>;
}
```

### Where globals.css Fits

```js
// app/layout.js
import './globals.css'; // imported exactly once, at the root — applies everywhere

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`globals.css` is the right home for things that are genuinely global by intent — a CSS reset, base typography, CSS custom properties — not for one component's specific look.

---

## 4. Code Walkthrough: Card.module.css and Card.js

Following the class name from source file through to the rendered DOM makes the scoping mechanism concrete rather than abstract.

### Card.module.css

```css
/* Card.module.css */
.card {
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.title {
  font-size: 1.25rem;
  font-weight: 600;
}
```

### Card.js Using the Module

```js
// Card.js
import styles from './Card.module.css';

export default function Card({ heading, children }) {
  return (
    <div className={styles.card}>          {/* ↳ styles.card, not the string "card" */}
      <h3 className={styles.title}>{heading}</h3>
      {children}
    </div>
  );
}
```

### What the Build Tool Actually Produces

```text
Source:            .card { ... }
Rendered className: "Card_card__a1B2c" (exact hash format varies by build)

styles.card         → resolves to the rewritten, unique string above, not "card"
Another component's
.card in its own
.module.css file    → rewritten to a *different* unique string entirely

Two components can both write ".card" in their own module file and
never collide in the final rendered HTML.
```

---

## 5. Comparing CSS Modules to Global CSS

Both CSS Modules and a global stylesheet are plain CSS underneath — the difference is entirely about scope: whether a class name is private to the component that imports it, or shared and visible to the whole app.

### CSS Modules vs Global CSS

| | CSS Modules (`*.module.css`) | Global CSS (`globals.css`) |
|---|---|---|
| Scoping | Automatically scoped/renamed uniquely per file | Unscoped — one shared namespace for the whole app |
| Best for | Component-specific styles (a `Card`, a `Modal`, a `Navbar`) | App-wide resets, base typography, CSS variables, third-party overrides |
| Collision risk | None — every file's class names are uniquified independently | High in a large app — same generic name reused by different files |
| Import pattern | `import styles from './X.module.css'`, used as `styles.x` | Imported once, typically in the root `layout.js`, applies everywhere |

### Takeaway

Reach for CSS Modules by default for anything that belongs to one specific component, and reserve `globals.css` for the handful of things that genuinely need to apply everywhere — mixing the two according to that split avoids both unnecessary boilerplate and unnecessary collision risk.

---

## 6. Common Mistakes

- **Putting component-specific styles in `globals.css`.** A `.card` rule meant for exactly one component, dropped into `globals.css`, is immediately back to the collision problem from Section 1 — any other file that also writes `.card` competes with it.
- **Forgetting the `.module.css` filename suffix.** Scoping is triggered purely by the filename pattern — a file named `Card.css` (missing `.module`) is treated as an ordinary global stylesheet instead of a scoped one. In practice this usually surfaces immediately rather than silently: importing a plain, non-module CSS file from anywhere other than the root App/Layout is a build-time error in Next.js ("Global CSS cannot be imported from files other than your Custom `<App>`"), not a quietly `undefined` `styles.card`.
- **Using a plain string instead of the imported object.** Writing `className="card"` instead of `className={styles.card}` bypasses the whole mechanism — the rewritten, unique class name only exists on the `styles` object returned by the import, never as the original literal string.

---

## 7. Hands-On Exercises

**Exercise 1:** Create `Card.module.css` with a `.card` class (padding, border, border-radius) and a `.title` class (font-size, font-weight). Import it into a `Card.js` component and apply both classes via `styles.card` and `styles.title`.

**Exercise 2:** Create a second component, `Banner.js`, with its own `Banner.module.css` that also defines a `.card` class with completely different styling. Render both `Card` and `Banner` on the same page and confirm neither one's styling leaks into the other.

**Exercise 3:** Create `app/globals.css` with a small CSS reset (`* { box-sizing: border-box; margin: 0; }`) and a couple of CSS custom properties (`:root { --brand-color: #0070f3; }`). Import it once in `app/layout.js` and confirm it applies across every page without being imported anywhere else.

**Exercise 4:** Deliberately rename `Card.module.css` to `Card.css` (dropping `.module`) and update the import path in a component that isn't the root App/Layout. Observe the build-time error Next.js raises about global CSS only being importable from the Custom App/root layout — confirming that scoping is filename-triggered, and that importing an unscoped stylesheet from an ordinary component isn't a silent failure but a hard build error.

**Exercise 5:** Add a `.title` class to `globals.css` with different styling than the `.title` class in `Card.module.css`. Import both a plain `className="title"` element and a `className={styles.title}` element on the same page, and confirm which styling each one actually receives.

---

## 8. Interview Q&A

**Q: What problem do CSS Modules solve that a plain global stylesheet doesn't?**
A plain global stylesheet has exactly one namespace — every class name defined anywhere in the app competes for the same name. Two components that both use `.card` collide, and whichever rule loads last in the cascade silently wins. CSS Modules solve this by automatically rewriting every class name in a `*.module.css` file to a unique name at build time, so the same class name written in two different module files never actually refers to the same rule.

**Q: What triggers CSS Modules scoping, and what happens without it?**
The `.module.css` filename suffix is what triggers it — a file named `Card.module.css` gets its class names uniquified, while a file named `Card.css` is treated as an ordinary, unscoped stylesheet even if its content looks identical. Forgetting the suffix is a common mistake, and it doesn't fail quietly: importing a plain, non-module CSS file from anywhere other than the root App/Layout is a build-time error in Next.js, not a silently `undefined` value on the imported object.

**Q: When is `globals.css` the right choice over a CSS Module?**
`globals.css` is right for things that are genuinely meant to apply everywhere — a CSS reset, base typography, CSS custom properties, or overrides for a third-party library's own global classes. It's imported exactly once, typically in the root `layout.js`. Anything scoped to one specific component belongs in that component's own `.module.css` file instead.

**Q: How does importing a CSS Module actually work in a component?**
`import styles from './Card.module.css'` returns an object whose keys are the original class names from that file and whose values are the rewritten, unique class name strings. `className={styles.card}` then applies the rewritten string, not the literal word "card" — which is why writing `className="card"` directly instead of using the `styles` object bypasses the scoping entirely.

**Q: Can CSS Modules and global CSS coexist in the same app?**
Yes, and in practice most apps use both — `globals.css` for the small set of truly app-wide concerns, and a `*.module.css` file per component for everything else. The two aren't in competition; they're suited to different scopes, and the common mistake is only in misapplying one where the other belongs, such as putting component-specific styling into the global file.
