# Change Detection and OnPush — Complete Guide

## Table of Contents
1. [Why Change Detection Exists](#1-why-change-detection-exists)
2. [Zone.js and the Default Strategy](#2-zonejs-and-the-default-strategy)
3. [OnPush Change Detection Strategy](#3-onpush-change-detection-strategy)
4. [Immutability Patterns Required by OnPush](#4-immutability-patterns-required-by-onpush)
5. [Signals and Zoneless Change Detection](#5-signals-and-zoneless-change-detection)
6. [trackBy for @for Loops](#6-trackby-for-for-loops)
7. [Worked Example: Before / After](#7-worked-example-before--after)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Change Detection Exists

Angular renders a component tree to the DOM once, then has to know **when data changes** so it can re-render the affected parts. Unlike frameworks that require you to manually call `setState`, Angular's default behavior is to check every component in the tree, top to bottom, whenever *anything* could have changed — a click, an HTTP response, a `setTimeout`, a promise resolving.

```
User clicks button
      │
      ▼
Zone.js detects the async event
      │
      ▼
Angular runs change detection on the ENTIRE component tree
      │
      ▼
Every component's template expressions are re-evaluated
      │
      ▼
DOM is patched wherever a value differs from last check
```

This is simple to reason about but expensive at scale — a tree of 500 components re-checks all 500 on every keystroke, every interval tick, every HTTP response, by default.

---

## 2. Zone.js and the Default Strategy

Zone.js is a library Angular has historically depended on (included in `polyfills.ts` up through Angular 16, opt-in after). It monkey-patches asynchronous browser APIs — `addEventListener`, `setTimeout`, `Promise.then`, `XMLHttpRequest` — so that Angular is notified whenever *any* async operation completes anywhere in the app.

```typescript
// Simplified mental model of what zone.js does
const originalSetTimeout = window.setTimeout;
window.setTimeout = (fn, delay) => {
  return originalSetTimeout(() => {
    fn();
    ngZone.onMicrotaskEmpty.emit(); // triggers Angular's change detection
  }, delay);
};
```

With `ChangeDetectionStrategy.Default` (the implicit default), Angular's change detector walks the **entire component tree** from the root every time zone.js signals that something happened, comparing every template-bound expression against its previous value.

```typescript
@Component({
  selector: 'app-user-card',
  standalone: true,
  template: `<p>{{ user.name }}</p>`,
  // no `changeDetection` set → ChangeDetectionStrategy.Default
})
export class UserCardComponent {
  @Input() user!: { name: string };
}
```

This is correct but wasteful: a `UserCardComponent` deep in a list gets re-checked even when a completely unrelated sibling component's input changed.

---

## 3. OnPush Change Detection Strategy

`ChangeDetectionStrategy.OnPush` tells Angular: "only check this component (and its children) when one of these specific things happens":

1. An `@Input()` reference changes (a *new object reference*, not a mutated property).
2. An event originates from within the component's own template (e.g. `(click)`).
3. An `Observable` bound with the `async` pipe emits a new value.
4. A signal read in the template changes.
5. Change detection is manually triggered (`ChangeDetectorRef.markForCheck()`).

```typescript
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-user-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>{{ user.name }}</p>`,
})
export class UserCardComponent {
  @Input() user!: { name: string };
}
```

```
Default strategy:               OnPush strategy:
┌─────────────┐                 ┌─────────────┐
│  AppRoot    │ checked          │  AppRoot    │ checked
│  ├─ Header  │ checked          │  ├─ Header  │ SKIPPED (input unchanged)
│  ├─ List    │ checked          │  ├─ List    │ checked (input ref changed)
│  │  ├─ Item │ checked          │  │  ├─ Item │ checked (part of List)
│  │  └─ Item │ checked          │  │  └─ Item │ SKIPPED (own input unchanged)
│  └─ Footer  │ checked          │  └─ Footer  │ SKIPPED (input unchanged)
└─────────────┘                 └─────────────┘
```

`OnPush` doesn't change *what* is rendered — it changes *how many components Angular bothers to check* on each detection pass, which is where the performance win comes from in large trees.

---

## 4. Immutability Patterns Required by OnPush

`OnPush` compares `@Input()` values by **reference**, not by deep equality. Mutating an object or array in place will *not* trigger a re-check, because the reference stays the same.

```typescript
// ❌ WRONG — mutates in place, OnPush component never re-renders
addTodo(todo: Todo) {
  this.todos.push(todo); // same array reference
}

// ✅ RIGHT — creates a new reference, OnPush picks it up
addTodo(todo: Todo) {
  this.todos = [...this.todos, todo];
}
```

```typescript
// ❌ WRONG
updateUser(name: string) {
  this.user.name = name; // mutates existing object
}

// ✅ RIGHT
updateUser(name: string) {
  this.user = { ...this.user, name }; // new object reference
}
```

| Mutation (breaks OnPush) | Immutable equivalent (works with OnPush) |
|---|---|
| `arr.push(item)` | `arr = [...arr, item]` |
| `arr.splice(i, 1)` | `arr = arr.filter((_, idx) => idx !== i)` |
| `obj.prop = value` | `obj = { ...obj, prop: value }` |
| `arr[i] = newItem` | `arr = arr.map((x, idx) => idx === i ? newItem : x)` |

This is why NgRx, signals, and most modern Angular state patterns lean heavily on spread syntax and immutable updates — it's not a style preference, it's what makes `OnPush` actually detect changes.

---

## 5. Signals and Zoneless Change Detection

Signals (`signal()`, `computed()`, `effect()`, introduced fully in Angular 16-17) are reactive primitives that track their own dependencies. When a signal's value changes, Angular knows **exactly** which components read that signal in their templates — no zone.js, no tree-walk needed.

```typescript
import { Component, signal, computed } from '@angular/core';

@Component({
  selector: 'app-counter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>Count: {{ count() }}</p>
    <p>Doubled: {{ doubled() }}</p>
    <button (click)="increment()">+1</button>
  `,
})
export class CounterComponent {
  count = signal(0);
  doubled = computed(() => this.count() * 2);

  increment() {
    this.count.update(c => c + 1); // notifies only consumers of `count`
  }
}
```

Because signals track fine-grained dependencies, Angular 17+ ships an **experimental zoneless** mode: the app runs without zone.js entirely, relying on signals (and other explicit notification points like `markForCheck`) to know when to re-render.

```typescript
// main.ts — opting into zoneless change detection (Angular 17+ preview API)
import { bootstrapApplication } from '@angular/platform-browser';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideExperimentalZonelessChangeDetection(),
  ],
});
```

```
Zone.js world:                        Zoneless world:
Any async op anywhere               Signal changes
      │                                    │
      ▼                                    ▼
Angular checks whole tree            Angular schedules a check for
(bounded by OnPush where used)       exactly the components that
                                      read that signal
```

Benefits: no zone.js bundle cost (~30-100KB depending on config), no monkey-patched globals, and change detection scoped precisely to what actually changed — signals make `OnPush`-style performance the *default* behavior instead of something you have to opt into manually everywhere.

---

## 6. trackBy for @for Loops

The new `@for` control flow block (Angular 17+) **requires** a track expression — unlike the old `*ngFor`, where `trackBy` was optional (and frequently forgotten).

```html
<!-- Without a good track key, Angular destroys/recreates DOM nodes
     on every array reference change, even if items are the same -->
@for (item of items(); track item.id) {
  <app-item-card [item]="item" />
} @empty {
  <p>No items yet.</p>
}
```

```typescript
// Old syntax, for comparison — trackBy function had to be written by hand
trackByItemId(index: number, item: Item): number {
  return item.id;
}
```

```html
<!-- *ngFor equivalent, shown for contrast -->
<app-item-card *ngFor="let item of items; trackBy: trackByItemId" [item]="item" />
```

Tracking by `item.id` (instead of the default object identity) means Angular reuses existing DOM nodes and child component instances when the list is replaced with a new array (e.g. after an immutable update for `OnPush`), instead of tearing down and rebuilding every row. This matters a lot combined with `OnPush`: a filtered/sorted array is a new reference, but with `track item.id` the individual `<app-item-card>` instances survive and their own `OnPush` checks stay cheap.

---

## 7. Worked Example: Before / After

**Before — Default strategy, mutation-based updates:**

```typescript
@Component({
  selector: 'app-todo-list',
  standalone: true,
  imports: [FormsModule],
  template: `
    <input [(ngModel)]="draft" (keyup.enter)="add()" />
    @for (todo of todos; track todo.id) {
      <app-todo-item [todo]="todo" />
    }
  `,
})
export class TodoListComponent {
  todos: Todo[] = [];
  draft = '';

  add() {
    this.todos.push({ id: Date.now(), text: this.draft, done: false }); // mutation
    this.draft = '';
  }
}
```

Every keystroke in the unrelated search box elsewhere in the app re-checks this component and every `<app-todo-item>` in it, because there's no `OnPush` boundary.

**After — OnPush + signals + immutable updates:**

```typescript
@Component({
  selector: 'app-todo-list',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input [(ngModel)]="draft" (keyup.enter)="add()" />
    @for (todo of todos(); track todo.id) {
      <app-todo-item [todo]="todo" />
    }
  `,
})
export class TodoListComponent {
  todos = signal<Todo[]>([]);
  draft = '';

  add() {
    this.todos.update(list => [...list, { id: Date.now(), text: this.draft, done: false }]);
    this.draft = '';
  }
}
```

```typescript
@Component({
  selector: 'app-todo-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p [class.done]="todo.done">{{ todo.text }}</p>`,
})
export class TodoItemComponent {
  @Input({ required: true }) todo!: Todo;
}
```

Result: unrelated UI updates (search box, unrelated inputs, timers elsewhere) no longer trigger a check on `TodoListComponent` or any `TodoItemComponent`. Only an actual `todos` signal update — or an event inside this subtree — schedules a check, and `track todo.id` means existing, unchanged todo rows aren't torn down when the array is replaced.

---

## 8. Hands-On Exercises

**Exercise 1:** Take an existing `Default`-strategy component with an `@Input() items: Item[]` and add `changeDetection: ChangeDetectionStrategy.OnPush`. Mutate the array with `.push()` in the parent and confirm the child no longer re-renders; fix it by replacing the array with a spread copy.

**Exercise 2:** Build a `CounterComponent` using `signal()` and `computed()` as shown in Section 5. Add a sibling component that updates an unrelated signal on an interval, and use Chrome DevTools Performance/Angular DevTools to confirm the counter's own change detection isn't triggered by the sibling's updates.

**Exercise 3:** Convert a `*ngFor` with a hand-written `trackBy` function to the new `@for ... track` syntax. Confirm behavior is equivalent by logging component `ngOnInit`/`ngOnDestroy` in the child and checking they don't fire when the array is re-sorted.

**Exercise 4:** Enable `provideExperimentalZonelessChangeDetection()` in a small standalone app's `main.ts`, remove `zone.js` from `polyfills`, and fix any component that silently relied on zone.js's automatic tree checks (e.g. a `setTimeout` mutating a plain property without a signal or `markForCheck()`).

**Exercise 5:** Use Angular DevTools' "Profiler" tab to record a change detection cycle on an app before and after adding `OnPush` to a deeply nested list. Compare the number of components checked in each recording.

---

## 9. Interview Q&A

**Q: What triggers Angular's default change detection, and why is it expensive at scale?**
Answer: Zone.js monkey-patches async browser APIs (events, timers, promises, XHR) and notifies Angular whenever any of them complete. With `ChangeDetectionStrategy.Default`, Angular responds by walking and checking the *entire* component tree on every such notification, regardless of which component actually changed — which gets costly as the tree grows.

**Q: How does OnPush decide when to re-check a component?**
Answer: An `OnPush` component is only re-checked when one of a fixed set of triggers occurs: an `@Input()` receives a new object reference, a DOM event originates from inside its own template, an `async`-piped Observable emits, a signal read in its template changes, or someone calls `ChangeDetectorRef.markForCheck()` explicitly.

**Q: Why does mutating an array or object break OnPush, and how do you fix it?**
Answer: OnPush compares `@Input()` bindings by reference equality, not deep equality. Mutating in place (`arr.push(x)`, `obj.prop = y`) keeps the same reference, so Angular sees "no change" and skips the check. The fix is immutable updates — spread into a new array/object (`arr = [...arr, x]`, `obj = { ...obj, prop: y }`) so the reference itself changes.

**Q: How do signals enable zoneless change detection?**
Answer: Signals track their own read/write dependencies at a fine granularity, so Angular knows precisely which templates depend on a given signal. When a signal updates, Angular can schedule a check for just those consumers instead of relying on zone.js's "something happened somewhere" notification and tree-walk — this is what Angular 17+'s experimental `provideExperimentalZonelessChangeDetection()` builds on.

**Q: Why does the new `@for` block require a `track` expression, and how does it interact with OnPush?**
Answer: `track` tells Angular how to identify "the same" item across re-renders (usually a stable ID) so it can reuse existing DOM nodes and component instances instead of destroying and recreating them when the bound array reference changes. This pairs naturally with OnPush/immutable updates: replacing the array (needed for OnPush to notice the change) doesn't force a full re-render of every row, because `track item.id` lets Angular match up unchanged items.
