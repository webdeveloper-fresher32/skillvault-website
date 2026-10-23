# State Management Overview — Complete Guide

## Table of Contents
1. [Where State Lives in an Angular App](#1-where-state-lives-in-an-angular-app)
2. [Do You Need a State Management Library?](#2-do-you-need-a-state-management-library)
3. [The Signal-Based Store Pattern](#3-the-signal-based-store-pattern)
4. [Selectors, Actions, and Encapsulation](#4-selectors-actions-and-encapsulation)
5. [Comparison: Signals-in-a-Service vs NgRx](#5-comparison-signals-in-a-service-vs-ngrx)
6. [When a Heavier Library Is Justified](#6-when-a-heavier-library-is-justified)
7. [Worked Example: A Todo Store Service](#7-worked-example-a-todo-store-service)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Where State Lives in an Angular App

State in a typical Angular app falls into a few tiers:

```
┌───────────────────────────────────────────────────────────────┐
│ Component-local state                                         │
│   e.g. "is this dropdown open" — signal() inside the component│
├───────────────────────────────────────────────────────────────┤
│ Feature-shared state                                          │
│   e.g. "current shopping cart" — signal-based service, shared │
│   by a handful of related components                          │
├───────────────────────────────────────────────────────────────┤
│ App-wide / cross-feature state                                │
│   e.g. "logged-in user", "active theme", "notifications feed" │
│   — service (signals) or a store library (NgRx) if complex    │
├───────────────────────────────────────────────────────────────┤
│ Server state (cached, remote)                                 │
│   e.g. "list of products from the API" — often best handled  │
│   with RxJS + HttpClient, or a dedicated cache layer          │
└───────────────────────────────────────────────────────────────┘
```

Most Angular apps do **not** need a dedicated state management library for the top three tiers — signals plus Angular's dependency injection are often sufficient. The mistake many teams make is reaching for NgRx on day one, before they've felt the pain it solves.

---

## 2. Do You Need a State Management Library?

Ask these questions before adding NgRx, Akita, Elf, or similar to a project:

- **Is state shared across many unrelated feature areas**, such that prop-drilling or scattered services become hard to trace? → Leans toward a store.
- **Do you need time-travel debugging, action replay, or a strict audit log of every state change** (common in fintech, complex forms, or enterprise workflow apps)? → Leans toward a store.
- **Is your team already large and needs an enforced, predictable pattern** for how state changes happen, reviewed consistently across many contributors? → Leans toward a store.
- **Is most of your state actually just "the result of an HTTP call, cached for a bit"?** → Often better solved with `HttpClient` + `toSignal()`, or a lightweight cache utility — not a global store.
- **Is your state mostly local to one feature or one page?** → A signal-based service scoped to that feature is almost always enough.

If none of the "leans toward a store" boxes are checked, a signal-based service (below) is simpler, has zero extra dependencies, and is easier for new team members to understand.

---

## 3. The Signal-Based Store Pattern

The core idea: put a **private, writable signal** inside an `@Injectable()` service, expose it as a **read-only signal**, and expose **methods** as the only way to mutate it. This mirrors the "single source of truth + controlled mutation" idea from Redux/NgRx, without any of the ceremony (actions, reducers, effects, selectors as separate concepts).

```typescript
import { Injectable, signal, computed } from '@angular/core';

export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

@Injectable({ providedIn: 'root' })
export class TodoStore {
  // Private, writable — only this service can change it
  private readonly _todos = signal<Todo[]>([]);

  // Public, read-only — components can read but not directly write
  readonly todos = this._todos.asReadonly();

  // Computed selectors, derived from the private state
  readonly completedCount = computed(() =>
    this._todos().filter(t => t.done).length
  );

  readonly pendingTodos = computed(() =>
    this._todos().filter(t => !t.done)
  );

  // Public methods are the ONLY way to mutate state
  add(text: string) {
    const newTodo: Todo = { id: Date.now(), text, done: false };
    this._todos.update(list => [...list, newTodo]);
  }

  toggle(id: number) {
    this._todos.update(list =>
      list.map(t => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  remove(id: number) {
    this._todos.update(list => list.filter(t => t.id !== id));
  }
}
```

Any component can inject `TodoStore` and read `store.todos()` or `store.completedCount()` reactively in its template, but cannot bypass `add()`/`toggle()`/`remove()` to mutate state directly — `todos` is read-only. This gives you the main benefit people reach for NgRx for (a single, controlled source of truth) with a fraction of the code.

---

## 4. Selectors, Actions, and Encapsulation

Mapping the store pattern's vocabulary onto more familiar Redux/NgRx terms:

| Redux/NgRx concept | Signal-store equivalent |
|---|---|
| Store (single source of truth) | Private `signal()` inside an `@Injectable()` |
| Selector | `computed()` derived from the private signal |
| Action | A named public method (`add()`, `toggle()`, `remove()`) |
| Reducer | The logic inside `.update()` calls in each method |
| Dispatch | Just calling the method directly — no dispatcher needed |
| Effects (async side effects) | Regular async methods, or `effect()` if reacting to state changes |

The main difference: there's no dispatch mechanism, no action-type strings, and no separate reducer functions to wire up. Encapsulation is achieved the same way you'd encapsulate anything else in TypeScript — `private` fields plus a curated public API — rather than through a framework contract.

For async work (e.g., loading todos from an API), add methods that call `HttpClient` and then `set()`/`update()` the private signal when the response arrives:

```typescript
@Injectable({ providedIn: 'root' })
export class TodoStore {
  private readonly _todos = signal<Todo[]>([]);
  private readonly _loading = signal(false);

  readonly todos = this._todos.asReadonly();
  readonly loading = this._loading.asReadonly();

  constructor(private http: HttpClient) {}

  async load() {
    this._loading.set(true);
    const todos = await firstValueFrom(this.http.get<Todo[]>('/api/todos'));
    this._todos.set(todos);
    this._loading.set(false);
  }
}
```

---

## 5. Comparison: Signals-in-a-Service vs NgRx

| | Signal-based service | NgRx |
|---|---|---|
| **Boilerplate** | Minimal — one class, plain methods | Significant — actions, reducers, selectors, effects, feature modules |
| **Learning curve** | Low — plain TypeScript + signals you already know | Steep — Redux pattern, RxJS operators, NgRx-specific APIs |
| **DevTools / time-travel debugging** | Not built in | Yes — Redux DevTools integration out of the box |
| **Enforced unidirectional data flow** | By convention only (discipline required) | Enforced by the architecture itself |
| **Handling complex async chains** | Doable, but you write the RxJS/async logic by hand | `@ngrx/effects` gives a dedicated, testable place for this |
| **Best fit** | Most apps; small-to-medium teams; feature-scoped state | Very large apps, many teams, complex cross-cutting async flows, strict auditability needs |
| **Bundle size / dependencies** | Zero extra dependencies (built into `@angular/core`) | Adds `@ngrx/store`, `@ngrx/effects`, etc. to the bundle |

Signal-based stores and NgRx are not mutually exclusive — some teams use signal-based services for feature-local state and NgRx only for the small slice of genuinely complex, cross-cutting state (e.g., a multi-step checkout flow with retries and rollback logic).

---

## 6. When a Heavier Library Is Justified

Reach for NgRx (or Akita, Elf, or NgRx SignalStore) when:

- **State changes need to be traceable and replayable** for debugging production issues — e.g., "what sequence of actions led to this broken UI state" in a support ticket.
- **Many independent teams contribute to the same state slice**, and you need an enforced contract (actions/reducers) to prevent ad-hoc, inconsistent mutation patterns creeping in.
- **You have genuinely complex async orchestration** — retries, debouncing, race-condition handling, optimistic updates with rollback — where `@ngrx/effects` and RxJS operators meaningfully reduce hand-written complexity.
- **You need built-in dev tooling** (Redux DevTools' time-travel, action log, state diffing) as a hard requirement for your team's workflow.

If none of these apply — which is true for the majority of line-of-business Angular apps — a signal-based service gives you nearly all the practical benefit (single source of truth, controlled mutation, reactive selectors) at a fraction of the complexity and dependency weight. Note also that the NgRx team itself now ships `@ngrx/signals` (SignalStore), which is essentially a more structured, convention-driven version of the pattern shown in this lesson — a middle ground worth knowing exists if you outgrow a hand-rolled service but still want to avoid classic action/reducer boilerplate.

---

## 7. Worked Example: A Todo Store Service

```typescript
// todo.store.ts
import { Injectable, signal, computed } from '@angular/core';

export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

@Injectable({ providedIn: 'root' })
export class TodoStore {
  private readonly _todos = signal<Todo[]>([]);
  private readonly _filter = signal<'all' | 'active' | 'completed'>('all');

  readonly todos = this._todos.asReadonly();
  readonly filter = this._filter.asReadonly();

  readonly visibleTodos = computed(() => {
    const all = this._todos();
    switch (this._filter()) {
      case 'active': return all.filter(t => !t.done);
      case 'completed': return all.filter(t => t.done);
      default: return all;
    }
  });

  readonly stats = computed(() => ({
    total: this._todos().length,
    completed: this._todos().filter(t => t.done).length,
  }));

  add(text: string) {
    this._todos.update(list => [...list, { id: Date.now(), text, done: false }]);
  }

  toggle(id: number) {
    this._todos.update(list =>
      list.map(t => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  setFilter(filter: 'all' | 'active' | 'completed') {
    this._filter.set(filter);
  }
}
```

```typescript
// todo-list.component.ts
import { Component, inject } from '@angular/core';
import { TodoStore } from './todo.store';

@Component({
  selector: 'app-todo-list',
  standalone: true,
  template: `
    <p>{{ store.stats().completed }} / {{ store.stats().total }} done</p>

    <button (click)="store.setFilter('all')">All</button>
    <button (click)="store.setFilter('active')">Active</button>
    <button (click)="store.setFilter('completed')">Completed</button>

    <ul>
      @for (todo of store.visibleTodos(); track todo.id) {
        <li (click)="store.toggle(todo.id)"
            [style.textDecoration]="todo.done ? 'line-through' : 'none'">
          {{ todo.text }}
        </li>
      }
    </ul>
  `,
})
export class TodoListComponent {
  store = inject(TodoStore);
}
```

Because `TodoStore` is `providedIn: 'root'`, it's a singleton shared across every component that injects it — any component can add/toggle/filter todos, and every other component reading `visibleTodos()` or `stats()` updates automatically, with zero manual event wiring.

---

## 8. Hands-On Exercises

**Exercise 1:** Convert a component that currently holds `favorites = signal<string[]>([])` directly into a shared `FavoritesStore` service with `add()`, `remove()`, and a read-only `favorites` signal. Inject it into two sibling components and confirm both stay in sync.

**Exercise 2:** Add a `computed()` selector `isFavorite(id: string)` — as a method returning a `computed()`, or a `favoriteIds` computed `Set` — to check membership efficiently without scanning the array in the template.

**Exercise 3:** Add a `loading` and `error` signal pair to a store service that loads data via `HttpClient`, and render loading/error states in a component's template using `@if`.

**Exercise 4:** Take the `TodoStore` example and add a `clearCompleted()` method. Write it so it only ever calls `.update()` with a new array reference (no in-place mutation).

**Exercise 5:** Write a short comparison (a few sentences) for a hypothetical app you've worked on or imagined: would you use a signal-based service or NgRx for its main state, and why? Identify at least one concrete requirement (from Section 6) that would push you toward NgRx if it existed.

---

## 9. Interview Q&A

**Q: What is the "signal-based store" pattern, and what problem does it solve?**
Answer: It's a pattern where an `@Injectable()` service holds a private, writable `signal()` as the single source of truth, exposes it publicly only as a read-only signal via `.asReadonly()`, and exposes named methods as the sole way to mutate state. It solves the same core problem NgRx solves — a single, controlled source of truth instead of scattered, directly-mutable state — without actions, reducers, or a dispatch mechanism.

**Q: How do you prevent components from mutating a shared signal directly in this pattern?**
Answer: Keep the writable signal `private` inside the service, and expose only `.asReadonly()` version publicly, plus named methods (`add()`, `remove()`, etc.) that internally call `.set()`/`.update()`. Consumers can read the public signal in templates and computeds, but TypeScript's type system prevents them from calling `.set()` on a read-only signal, and they have no reference to the private writable one.

**Q: When is a signal-based service NOT enough, and you should reach for NgRx instead?**
Answer: When you need traceable/replayable state changes for debugging (time-travel via Redux DevTools), when many independent teams need an enforced contract for how state can change (actions/reducers as a hard boundary), or when async orchestration is genuinely complex — retries, race conditions, optimistic updates with rollback — where `@ngrx/effects` meaningfully reduces hand-written complexity versus ad-hoc async code in a service.

**Q: How does a computed() selector in a signal store compare to a selector function in NgRx?**
Answer: Both derive a value from the underlying state without mutating it, and both are memoized so repeated reads are cheap. The difference is mechanical: an NgRx selector is a pure function composed via `createSelector` and read through the `Store`'s `select()`/`selectSignal()` API, while a signal-store's `computed()` is just a class property that auto-tracks its dependencies — no selector-composition API or `Store` service needed.

**Q: Is @ngrx/signals (SignalStore) the same thing as the hand-rolled service pattern in this lesson?**
Answer: They're conceptually related but not identical. SignalStore is NgRx's own opinionated, convention-driven implementation of state-as-signals-in-a-service, providing a shared shape (`withState`, `withComputed`, `withMethods`) and integrations (devtools, entity management) so teams don't each invent their own store shape by hand. It's a middle ground between a fully hand-rolled service and classic action/reducer NgRx.
