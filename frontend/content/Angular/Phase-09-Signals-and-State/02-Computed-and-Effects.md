# Computed and Effects — Complete Guide

## Table of Contents
1. [computed() — Derived State](#1-computed--derived-state)
2. [effect() — Side Effects](#2-effect--side-effects)
3. [Effect Cleanup Functions](#3-effect-cleanup-functions)
4. [untracked() — Reading Without Subscribing](#4-untracked--reading-without-subscribing)
5. [Common Pitfalls](#5-common-pitfalls)
6. [Worked Example: Shopping Cart Total](#6-worked-example-shopping-cart-total)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. computed() — Derived State

`computed()` creates a **read-only signal** whose value is calculated from other signals. It is lazy (only recalculates when read after a dependency changes) and memoized (repeated reads without a dependency change return the cached value instantly).

```typescript
import { signal, computed } from '@angular/core';

const price = signal(100);
const quantity = signal(3);

const subtotal = computed(() => price() * quantity());

console.log(subtotal()); // 300

quantity.set(5);
console.log(subtotal()); // 500 — recalculated because a dependency changed
```

Key properties:

- **Automatic dependency tracking** — you never declare `[price, quantity]` as a dependency array like you would with `useMemo` in React. Angular tracks every signal read *during* the computation function's execution.
- **Read-only** — `subtotal.set(...)` does not exist; a computed's value can only change by its dependencies changing.
- **Lazy + memoized** — the function only re-runs the first time it's read after a dependency changes; if nothing it depends on has changed, repeated calls return the cached value without re-running the function body.

```
price.set(200)
      │
      ▼
subtotal is marked "dirty" (not recomputed yet)
      │
      ▼
Only when something calls subtotal() does the function body actually re-run
```

Computed signals can depend on other computed signals, forming a dependency graph:

```typescript
const subtotal = computed(() => price() * quantity());
const tax = computed(() => subtotal() * 0.1);
const total = computed(() => subtotal() + tax());
```

Updating `price` or `quantity` transparently invalidates `subtotal`, `tax`, and `total` — but each only recalculates once it's actually read.

---

## 2. effect() — Side Effects

`effect()` runs a function whenever any signal it reads changes — used for side effects that aren't about producing a value for the template: logging, syncing to `localStorage`, imperative DOM/third-party library calls, analytics.

```typescript
import { Component, signal, effect } from '@angular/core';

@Component({ /* ... */ })
export class SettingsComponent {
  theme = signal('light');

  constructor() {
    effect(() => {
      console.log(`Theme changed to: ${this.theme()}`);
      localStorage.setItem('theme', this.theme());
    });
  }
}
```

Effects must generally be created in an **injection context** — typically a component/directive/service constructor, or a field initializer. If you need to create one later (e.g., inside a method), pass an explicit `Injector`:

```typescript
import { Injector, effect } from '@angular/core';

export class ReportComponent {
  constructor(private injector: Injector) {}

  startWatching(data: Signal<number>) {
    effect(() => {
      console.log(data());
    }, { injector: this.injector });
  }
}
```

Angular runs the effect once immediately upon creation (to establish its dependencies), then again whenever a dependency changes — always **after** the current change detection cycle, asynchronously, batched with other effects.

### effect() vs computed()

| | `computed()` | `effect()` |
|---|---|---|
| Returns a value? | Yes — a readable signal | No — returns an `EffectRef` (for `.destroy()`) |
| Purpose | Derive state for use elsewhere (templates, other computeds) | Perform a side effect (logging, storage, DOM, subscriptions) |
| Should have side effects? | No — must be a pure function | Yes — that's its entire purpose |

A common mistake is using `effect()` to derive a value that should be a `computed()` instead — see Pitfalls below.

---

## 3. Effect Cleanup Functions

An effect callback can accept an `onCleanup` function, called right before the effect re-runs, and when the effect is destroyed (e.g., component destroyed). Use it to cancel timers, remove listeners, or abort in-flight work started by the previous run.

```typescript
import { Component, signal, effect } from '@angular/core';

@Component({ /* ... */ })
export class PollingComponent {
  intervalMs = signal(5000);

  constructor() {
    effect((onCleanup) => {
      const ms = this.intervalMs();
      const id = setInterval(() => console.log('poll'), ms);

      onCleanup(() => clearInterval(id));
    });
  }
}
```

When `intervalMs` changes, Angular calls the cleanup from the *previous* run (clearing the old interval) before executing the effect body again with the new value — preventing leaked timers accumulating on every change.

Effects are also automatically cleaned up when their containing component/directive/service is destroyed — you don't need a manual `ngOnDestroy()` for effects created in the constructor.

---

## 4. untracked() — Reading Without Subscribing

Sometimes you need to read a signal's *current* value inside a `computed()` or `effect()` without making that read a dependency — so changes to it don't trigger re-execution. `untracked()` does exactly this.

```typescript
import { signal, effect, untracked } from '@angular/core';

const userId = signal(1);
const debugMode = signal(false);

effect(() => {
  const id = userId(); // tracked — effect re-runs when userId changes
  const debug = untracked(() => debugMode()); // NOT tracked

  if (debug) {
    console.log(`Fetching user ${id}`);
  }
});
```

Here, toggling `debugMode` alone will not re-trigger the effect — only changes to `userId` will. This is useful when a value is read purely for its current snapshot (e.g., reading a config flag, or reading `untracked(() => someSignal())` to avoid circular effect dependencies).

---

## 5. Common Pitfalls

### Pitfall 1: Effects causing infinite loops

Writing to a signal inside an `effect()` that also reads that same signal (directly or transitively) creates an infinite loop — the write triggers the effect again, which writes again, forever.

```typescript
// WRONG — infinite loop
const count = signal(0);

effect(() => {
  console.log(count());
  count.set(count() + 1); // writing to a signal the effect also reads!
});
```

Angular will actually throw `NG0600: Writing to signals is not allowed in a computed or effect` for many cases like this by default (`effect()` disallows writes during its own execution unless explicitly opted in with `allowSignalWrites: true` in older APIs — in current versions, prefer restructuring instead of opting in).

**Fix:** Don't write to a signal that the same effect reads. If you need derived state, use `computed()`. If you truly need to write a *different* signal based on this one, make sure there's no cycle.

### Pitfall 2: Using effect() where computed() belongs

```typescript
// WRONG — using effect() to "derive" a value into another signal
const price = signal(100);
const quantity = signal(2);
const total = signal(0);

effect(() => {
  total.set(price() * quantity()); // should be a computed(), not an effect()
});
```

```typescript
// RIGHT
const total = computed(() => price() * quantity());
```

If you're deriving a value purely from other signals, always prefer `computed()`. It's more efficient (memoized, no manual signal write) and communicates intent clearly. Reserve `effect()` for genuine side effects that leave the signal graph — logging, storage, network calls, imperative APIs.

### Pitfall 3: Forgetting effects need an injection context

```typescript
// WRONG — throws NG0203 if called outside injection context
function setupLogger(value: Signal<number>) {
  effect(() => console.log(value())); // no injector available here
}
```

Either call `effect()` directly in a constructor/field initializer, or pass `{ injector }` explicitly when creating it outside one.

### Pitfall 4: Over-computing expensive work

`computed()` re-runs its full body when a dependency changes, even if only a small part of the output actually depends on that change. Keep computed functions cheap, and split large computations into smaller composed computeds so Angular can memoize each piece independently.

---

## 6. Worked Example: Shopping Cart Total

```typescript
import { Component, signal, computed } from '@angular/core';

interface CartItem {
  name: string;
  price: number;
  quantity: number;
}

@Component({
  selector: 'app-cart',
  standalone: true,
  template: `
    <ul>
      @for (item of items(); track item.name) {
        <li>{{ item.name }} — {{ item.quantity }} × \${{ item.price }}</li>
      }
    </ul>
    <p>Subtotal: \${{ subtotal() }}</p>
    <p>Tax (10%): \${{ tax() }}</p>
    <p><strong>Total: \${{ total() }}</strong></p>
  `,
})
export class CartComponent {
  items = signal<CartItem[]>([
    { name: 'Keyboard', price: 80, quantity: 1 },
    { name: 'Mouse', price: 25, quantity: 2 },
  ]);

  // Each computed depends only on `items`, and total composes the others
  subtotal = computed(() =>
    this.items().reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

  tax = computed(() => Math.round(this.subtotal() * 0.1 * 100) / 100);

  total = computed(() => this.subtotal() + this.tax());

  addItem(item: CartItem) {
    // New array reference — required for signals to detect the change
    this.items.update(list => [...list, item]);
  }

  removeItem(name: string) {
    this.items.update(list => list.filter(item => item.name !== name));
  }
}
```

Adding or removing an item only ever touches the `items` signal. `subtotal`, `tax`, and `total` cascade automatically and recompute lazily — no manual recalculation code, no `ngOnChanges`, no subscription management.

---

## 7. Hands-On Exercises

**Exercise 1:** Build a `fullName = computed(() => \`${this.first()} ${this.last()}\`)` from two signals `first` and `last`. Verify it updates when either changes and is memoized (add a `console.log` inside and confirm it doesn't log on unrelated re-renders).

**Exercise 2:** Write an `effect()` that logs to the console whenever a `darkMode = signal(false)` toggles, and also sets a `class` on `document.body` accordingly. Confirm it runs once immediately on creation.

**Exercise 3:** Create an effect with a cleanup function that starts a `setInterval` based on a signal `intervalMs = signal(1000)`. Change `intervalMs` and confirm (via console logs) that the old interval is cleared before a new one starts.

**Exercise 4:** Deliberately write a signal inside an effect that also reads it, run the app, and observe the `NG0600` error Angular throws. Then fix it by moving the logic into a `computed()`.

**Exercise 5:** Extend the shopping cart example to add a `freeShipping = computed(() => this.subtotal() > 100)` computed, and render "Free shipping!" conditionally in the template using `@if`.

---

## 8. Interview Q&A

**Q: What is the difference between computed() and effect(), and when would you use each?**
Answer: `computed()` returns a new read-only signal derived from other signals — it must be a pure function with no side effects, and is used whenever you need a value (for a template or another computed). `effect()` performs side effects — logging, storage writes, DOM manipulation, imperative third-party APIs — and does not return a usable value. Use `computed()` for "what value should this be," and `effect()` for "what should happen when this changes."

**Q: Is computed() lazy or eager, and why does that matter?**
Answer: `computed()` is lazy and memoized — it only recalculates the first time it's read after one of its dependencies changes, and returns a cached value on subsequent reads until then. This matters because you can build large chains of computed signals without worrying about redundant recalculation; Angular only does the work when the value is actually needed.

**Q: How can an effect() cause an infinite loop, and how do you avoid it?**
Answer: If an effect writes to a signal that it also reads (directly or transitively), the write re-triggers the effect, which writes again, looping forever. Angular guards against many such cases by throwing `NG0600` for signal writes during effect/computed execution. The fix is to restructure the logic: if you're deriving a value, use `computed()` instead of writing to a signal from inside an effect.

**Q: What does an effect's cleanup function do, and when is it called?**
Answer: The cleanup function passed via `onCleanup` inside an effect callback runs right before the effect re-executes (due to a dependency change) and when the effect itself is destroyed (e.g., its component is destroyed). It's used to tear down resources from the previous run — clearing timers, removing event listeners, aborting in-flight requests — preventing leaks as the effect re-runs repeatedly.

**Q: What does untracked() do and give an example of when you'd need it?**
Answer: `untracked()` lets you read a signal's current value inside a `computed()` or `effect()` without registering it as a dependency, so changes to that signal alone won't trigger re-execution. A common use case is reading a debug/config flag inside an effect that should only actually re-run based on a different, "real" dependency — you want the current value of the flag, but you don't want toggling it to retrigger the whole effect.
