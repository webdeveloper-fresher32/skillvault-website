# Signals Fundamentals — Complete Guide

## Table of Contents
1. [Why Signals Exist](#1-why-signals-exist)
2. [The Reactive Primitive: signal()](#2-the-reactive-primitive-signal)
3. [Reading, Writing, and Updating Signals](#3-reading-writing-and-updating-signals)
4. [Signals vs RxJS Observables](#4-signals-vs-rxjs-observables)
5. [Signal-Based Component APIs: input() and model()](#5-signal-based-component-apis-input-and-model)
6. [Worked Example: A Counter with Derived Display](#6-worked-example-a-counter-with-derived-display)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Signals Exist

Before Angular 16, change detection worked by having Zone.js monkey-patch async browser APIs (`setTimeout`, `addEventListener`, `Promise`, XHR, etc.). Any async event triggered Zone.js, which then told Angular to re-run change detection on the **entire component tree**, checking every binding top to bottom to see what changed.

```
Zone.js-driven change detection:

  User clicks button
        │
        ▼
  Zone.js intercepts the event
        │
        ▼
  Angular re-checks EVERY component in the tree
  (even components with no relation to the click)
        │
        ▼
  Bindings updated where dirty
```

This works, but it's coarse-grained: Angular doesn't actually know *which* piece of state changed, so it has to check everything. `OnPush` change detection strategy helps by skipping subtrees whose `@Input()`s haven't changed by reference, but you still have to opt in and reason about immutability manually.

Signals flip this model. A signal is a **wrapped value that knows who is reading it**. When the value changes, only the specific consumers (template bindings, `computed()`s, `effect()`s) that read that signal are notified and re-evaluated — not the whole tree.

```
Signal-driven change detection:

  count.set(5)
        │
        ▼
  Angular knows exactly which template bindings
  and computed()/effect() consumers read `count`
        │
        ▼
  Only those are re-evaluated
```

This is the same fine-grained reactivity model used by SolidJS, Vue's Composition API refs, and Preact Signals. Angular adopted it starting in v16 (developer preview) and stabilized it in v17, with `input()` and `model()` signal APIs landing in v17.1+.

---

## 2. The Reactive Primitive: signal()

A signal is created with the `signal()` function from `@angular/core`. It wraps a value and returns a **getter function** — calling it reads the current value.

```typescript
import { signal } from '@angular/core';

// Create a signal with an initial value
const count = signal(0);

// Read it by CALLING it like a function
console.log(count()); // 0
```

Note the syntax: `count` is not the value — it's a function. `count()` invokes the getter. This is deliberate: it lets Angular's reactivity system track *when* and *where* a signal is read, so it knows what to re-run when the value changes.

```typescript
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-counter',
  standalone: true,
  template: `
    <p>Count: {{ count() }}</p>
    <button (click)="increment()">+1</button>
  `,
})
export class CounterComponent {
  count = signal(0);

  increment() {
    this.count.update(value => value + 1);
  }
}
```

In the template, `count()` is called on every change detection pass, but Angular's signal-aware rendering only re-renders that specific interpolation when `count` actually changes — it does not re-check the whole component.

---

## 3. Reading, Writing, and Updating Signals

There are three ways to change a signal's value:

```typescript
const user = signal({ name: 'Priya', age: 29 });

// 1. set() — replace the value entirely
user.set({ name: 'Priya', age: 30 });

// 2. update() — derive the new value from the current one
user.update(current => ({ ...current, age: current.age + 1 }));

// 3. mutate() was REMOVED in Angular 17+ — signals require immutable updates.
// Always create a new object/array reference instead of mutating in place.
```

> **Important:** Angular's `signal()` (unlike some earlier RFCs) does not ship a `mutate()` method in the stable API. Always treat the value inside a signal as immutable — use `set()` or `update()` with a new reference. Mutating an object/array in place and expecting the template to update will NOT work, because Angular compares by reference to decide whether to notify consumers.

```typescript
// WRONG — mutates in place, signal doesn't know anything changed
const todos = signal<string[]>([]);
todos().push('Buy milk'); // template will NOT update

// RIGHT — creates a new array reference
todos.update(list => [...list, 'Buy milk']);
```

### Read-only signals

Calling `.asReadonly()` gives you a signal that can be read but not written — useful for exposing state from a service without letting consumers mutate it directly.

```typescript
export class CartService {
  private _items = signal<string[]>([]);
  readonly items = this._items.asReadonly();

  addItem(item: string) {
    this._items.update(list => [...list, item]);
  }
}
```

Components inject `CartService` and read `cartService.items()`, but can only add items through `addItem()` — they cannot call `.set()` on `items` because it's read-only.

---

## 4. Signals vs RxJS Observables

Angular still uses RxJS heavily (`HttpClient`, `Router` events, `AsyncPipe`), so signals do not replace Observables — they solve a different problem.

| | Signals | RxJS Observables |
|---|---|---|
| **Model** | Synchronous, pull-based state container | Asynchronous stream of values over time |
| **Has a current value?** | Yes — always readable synchronously via `signal()` | No — you must subscribe to receive values |
| **Multiple values over time** | Represents "now" (though it changes over time) | First-class: designed for sequences (clicks, HTTP retries, intervals) |
| **Operators** | `computed()` only (limited) | `map`, `switchMap`, `debounceTime`, `combineLatest`, dozens more |
| **Unsubscribing needed?** | No — signals clean up automatically | Yes — must unsubscribe or use `async` pipe/`takeUntilDestroyed()` |
| **Best for** | Component/UI state: form values, toggles, counters, derived view state | Async operations: HTTP calls, WebSocket streams, debounced search, complex event composition |

### Rule of thumb

- Use **signals** for state that lives in memory and represents "the current value of something" — a form field, a UI toggle, a list rendered in a template.
- Use **RxJS** for asynchronous processes with a timeline — an HTTP request, a debounced search-as-you-type stream, retry/backoff logic, or combining multiple async sources.
- You will frequently need both together. Angular provides two interop functions in `@angular/core/rxjs-interop`:

```typescript
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({ /* ... */ })
export class UserProfileComponent {
  private http = inject(HttpClient);

  // Convert an Observable (HTTP call) into a signal for the template
  user = toSignal(this.http.get<User>('/api/me'), { initialValue: null });

  // Convert a signal into an Observable to feed into RxJS operators
  searchTerm = signal('');
  searchTerm$ = toObservable(this.searchTerm);
}
```

`toSignal()` is the most common bridge — it lets you consume an HTTP response or router param stream as a signal in your template without manually subscribing/unsubscribing.

---

## 5. Signal-Based Component APIs: input() and model()

Angular 17.1+ introduced signal-based alternatives to the decorator-based `@Input()` and two-way-binding patterns.

### input() — replaces @Input()

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-user-card',
  standalone: true,
  template: `<h3>{{ name() }}</h3><p>Role: {{ role() }}</p>`,
})
export class UserCardComponent {
  // Required input — compiler enforces it must be bound
  name = input.required<string>();

  // Optional input with a default value
  role = input<string>('Member');
}
```

Parent usage is unchanged:

```html
<app-user-card [name]="user.name" [role]="user.role" />
```

The key difference from `@Input()`: `name` is now a **signal**, so it can be read inside `computed()` and `effect()`, and it participates in fine-grained reactivity — no more relying on `ngOnChanges()` to react to input changes.

```typescript
export class UserCardComponent {
  name = input.required<string>();
  greeting = computed(() => `Hello, ${this.name()}!`);
}
```

### model() — two-way binding with signals

`model()` replaces the old `@Input()` + `@Output()` pair used for two-way binding (`[(ngModel)]`-style custom components).

```typescript
import { Component, model } from '@angular/core';

@Component({
  selector: 'app-toggle',
  standalone: true,
  template: `<button (click)="toggle()">{{ checked() ? 'ON' : 'OFF' }}</button>`,
})
export class ToggleComponent {
  checked = model(false); // creates both an input AND an output automatically

  toggle() {
    this.checked.update(v => !v); // updates flow back to the parent
  }
}
```

Parent usage supports the banana-in-a-box syntax directly:

```html
<app-toggle [(checked)]="isDarkMode" />
```

Under the hood, `model()` generates a `checkedChange` output automatically — you don't have to declare `@Output() checkedChange = new EventEmitter()` yourself. This eliminates a huge amount of boilerplate compared to the old two-way binding pattern.

---

## 6. Worked Example: A Counter with Derived Display

```typescript
import { Component, signal, computed } from '@angular/core';

@Component({
  selector: 'app-step-counter',
  standalone: true,
  template: `
    <p>Count: {{ count() }}</p>
    <p>Status: {{ status() }}</p>
    <button (click)="decrement()">-1</button>
    <button (click)="increment()">+1</button>
    <button (click)="reset()">Reset</button>
  `,
})
export class StepCounterComponent {
  count = signal(0);

  // Derived state, recomputed only when count() changes
  status = computed(() => {
    if (this.count() === 0) return 'Zero';
    return this.count() > 0 ? 'Positive' : 'Negative';
  });

  increment() {
    this.count.update(v => v + 1);
  }

  decrement() {
    this.count.update(v => v - 1);
  }

  reset() {
    this.count.set(0);
  }
}
```

Every click updates exactly one signal. Angular knows the template interpolations and the `status` computed both depend on `count`, so only those are re-evaluated — the rest of the component tree is untouched.

---

## 7. Hands-On Exercises

**Exercise 1:** Build a standalone `TemperatureComponent` with a `celsius = signal(20)` and buttons to increment/decrement by 1. Display the value with `{{ celsius() }}°C`.

**Exercise 2:** Add a `fahrenheit = computed(() => this.celsius() * 9 / 5 + 32)` to the component from Exercise 1 and render both values side by side.

**Exercise 3:** Refactor a component that currently uses `@Input() userName: string` to use `userName = input.required<string>()` instead. Confirm the parent binding syntax doesn't change.

**Exercise 4:** Build a `RatingComponent` using `model<number>(0)` for a 5-star rating widget. Bind it with `[(rating)]` from a parent component and verify updates flow both directions.

**Exercise 5:** Take an existing `HttpClient.get()` call in a component and convert its subscription into a signal using `toSignal()` with an `initialValue`. Remove the manual `.subscribe()` call and any related `ngOnDestroy()` unsubscribe logic.

---

## 8. Interview Q&A

**Q: What problem do Signals solve that Zone.js-based change detection didn't?**
Answer: Zone.js triggers change detection on the entire component tree whenever any async event fires, because it has no idea which specific piece of state changed. Signals track exactly which template bindings, computed values, and effects read a given piece of state, so only those consumers are notified and re-evaluated when it changes — this is fine-grained, not tree-wide, reactivity.

**Q: Why is a signal read by calling it as a function, e.g. `count()`, instead of just `count`?**
Answer: Calling `count()` invokes a getter that Angular's reactivity system can intercept to record "this consumer (template/computed/effect) depends on this signal." If you could read `count` as a plain property, there'd be no way to track dependencies automatically — you'd need explicit subscribe/unsubscribe calls like RxJS requires.

**Q: When should you use a signal versus an RxJS Observable?**
Answer: Use signals for synchronous, in-memory UI state that always has a current value — form fields, toggles, counters, derived view state. Use RxJS for asynchronous processes with a timeline — HTTP requests, WebSocket streams, debounced search, or composing multiple async sources with operators like `switchMap` and `combineLatest`. Bridge between them with `toSignal()`/`toObservable()` when needed.

**Q: What does `input.required<T>()` give you that `@Input() name!: string` didn't?**
Answer: Compile-time and runtime enforcement that the input must be bound by the parent (no more relying on the `!` non-null assertion and hoping), and the resulting `name` is a signal — so it can be composed directly into `computed()` and `effect()` without needing `ngOnChanges()` to react to changes.

**Q: What does `model()` replace, and why is it less boilerplate?**
Answer: `model()` replaces the classic two-way binding pattern of declaring both `@Input() value` and `@Output() valueChange = new EventEmitter()`. Calling `model(initialValue)` automatically creates the input and its matching `*Change` output, so the parent can use `[(value)]="..."` banana-in-a-box syntax with a single line of component code instead of two separate declarations plus manual `.emit()` calls.
