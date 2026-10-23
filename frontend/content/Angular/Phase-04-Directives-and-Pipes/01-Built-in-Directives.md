# Built-in Directives — Complete Guide

## Table of Contents
1. [What is a Directive?](#1-what-is-a-directive)
2. [Structural vs Attribute Directives](#2-structural-vs-attribute-directives)
3. [Modern Control Flow: @if / @for / @switch](#3-modern-control-flow-if--for--switch)
4. [Legacy Structural Directives: *ngIf / *ngFor / *ngSwitch](#4-legacy-structural-directives-ngif--ngfor--ngswitch)
5. [NgClass and NgStyle](#5-ngclass-and-ngstyle)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What is a Directive?

A directive is a class that attaches behavior to a DOM element. Components are technically directives with a template. Angular ships three kinds:

```
Component            → directive WITH a template (@Component)
Structural directive → changes DOM structure (adds/removes elements)
Attribute directive  → changes appearance or behavior of an existing element
```

Everything you write in a template that isn't plain HTML — `*ngFor`, `[ngClass]`, `@if`, `routerLink` — is a directive doing work behind the scenes.

---

## 2. Structural vs Attribute Directives

```
Structural directive:
  <div *ngIf="isVisible">Hello</div>
  → Angular ADDS or REMOVES the <div> from the DOM entirely.
  → Prefixed with * (syntactic sugar for <ng-template>).

Attribute directive:
  <div [ngClass]="{active: isActive}">Hello</div>
  → The <div> STAYS in the DOM.
  → Only its class/style/attributes/behavior change.
```

| Aspect | Structural | Attribute |
|--------|-----------|-----------|
| Effect on DOM | Adds/removes elements | Modifies existing element |
| Syntax | `*ngIf`, `*ngFor`, `@if`, `@for` | `[ngClass]`, `[ngStyle]`, `appHighlight` |
| Can appear multiple times per element | No (only one structural directive per host element, pre-Angular 17) | Yes, many attribute directives can stack |
| Built-in examples | `NgIf`, `NgFor`, `NgSwitch` | `NgClass`, `NgStyle`, `RouterLink` |

Since Angular 17, the built-in control flow (`@if`, `@for`, `@switch`) replaces `*ngIf`/`*ngFor`/`*ngSwitch` as the recommended default — it's block syntax, not a directive, and compiles to more efficient instructions with no need to import `CommonModule` directives.

---

## 3. Modern Control Flow: @if / @for / @switch

### @if / @else if / @else

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-status',
  standalone: true,
  template: `
    @if (status() === 'loading') {
      <p>Loading...</p>
    } @else if (status() === 'error') {
      <p class="error">Something went wrong.</p>
    } @else {
      <p>Data loaded successfully.</p>
    }
  `,
})
export class StatusComponent {
  status = signal<'loading' | 'error' | 'ready'>('loading');
}
```

No import needed — `@if` is built into the template compiler, unlike `*ngIf` which required `CommonModule`.

### @for with mandatory track

```typescript
import { Component, signal } from '@angular/core';

interface Todo {
  id: number;
  title: string;
  done: boolean;
}

@Component({
  selector: 'app-todo-list',
  standalone: true,
  template: `
    <ul>
      @for (todo of todos(); track todo.id) {
        <li [class.done]="todo.done">{{ todo.title }}</li>
      } @empty {
        <li>No todos yet — add one!</li>
      }
    </ul>
  `,
})
export class TodoListComponent {
  todos = signal<Todo[]>([
    { id: 1, title: 'Learn Angular directives', done: false },
    { id: 2, title: 'Ship a feature', done: true },
  ]);
}
```

`track todo.id` is **mandatory** in `@for` — it tells Angular how to identify items across re-renders (equivalent to `trackBy` in `*ngFor`, but enforced by the compiler so you can't forget it). The `@empty` block renders when the collection is empty, replacing the old two-template `*ngIf="list.length === 0"` workaround.

`@for` also exposes contextual variables:

```html
@for (item of items(); track item.id; let i = $index, isFirst = $first, isLast = $last) {
  <div [class.first]="isFirst" [class.last]="isLast">{{ i }}: {{ item.name }}</div>
}
```

Available variables: `$index`, `$count`, `$first`, `$last`, `$even`, `$odd`.

### @switch

```typescript
@Component({
  selector: 'app-role-badge',
  standalone: true,
  template: `
    @switch (role()) {
      @case ('admin') {
        <span class="badge badge-admin">Admin</span>
      }
      @case ('editor') {
        <span class="badge badge-editor">Editor</span>
      }
      @default {
        <span class="badge badge-viewer">Viewer</span>
      }
    }
  `,
})
export class RoleBadgeComponent {
  role = signal<'admin' | 'editor' | 'viewer'>('viewer');
}
```

`@switch` requires no `[ngSwitch]` attribute binding or `CommonModule` import — it's plain template syntax.

---

## 4. Legacy Structural Directives: *ngIf / *ngFor / *ngSwitch

You'll still see this syntax constantly in existing codebases and interviews, so know it well even though new code should prefer `@if`/`@for`/`@switch`.

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-legacy-list',
  standalone: true,
  imports: [CommonModule], // required for *ngIf, *ngFor, ngClass, ngStyle
  template: `
    <div *ngIf="user; else noUser">
      Welcome, {{ user.name }}
    </div>
    <ng-template #noUser>
      <div>Please log in.</div>
    </ng-template>

    <ul>
      <li *ngFor="let item of items; let i = index; trackBy: trackById">
        {{ i }}: {{ item.name }}
      </li>
    </ul>

    <div [ngSwitch]="role">
      <span *ngSwitchCase="'admin'">Admin</span>
      <span *ngSwitchCase="'editor'">Editor</span>
      <span *ngSwitchDefault>Viewer</span>
    </div>
  `,
})
export class LegacyListComponent {
  user = { name: 'Priya' };
  items = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }];
  role: 'admin' | 'editor' | 'viewer' = 'viewer';

  trackById(index: number, item: { id: number }) {
    return item.id;
  }
}
```

Key differences from the modern syntax:

| Legacy | Modern |
|--------|--------|
| `*ngIf="cond; else tpl"` + `<ng-template #tpl>` | `@if (cond) {...} @else {...}` inline, no template refs |
| `*ngFor="let x of items; trackBy: fn"` (opt-in, easy to forget) | `@for (x of items; track x.id)` (mandatory) |
| Requires importing `CommonModule` | No import required |
| Desugars to `<ng-template>` under the hood | Compiles to dedicated, more efficient instructions |
| No native "empty" case — needs a second `*ngIf` | `@empty` block built in |

**Under the hood**, `*ngIf="cond"` on `<div>` desugars to:

```html
<ng-template [ngIf]="cond">
  <div>...</div>
</ng-template>
```

This is why only one structural directive was ever allowed per host element pre-v17 — you can't have two `<ng-template>` wrappers on the same tag without an intermediate `<ng-container>`.

---

## 5. NgClass and NgStyle

Both are **attribute directives** — they don't add/remove elements, they modify the host element's `class` or `style` attribute. They still require `CommonModule` (or standalone import) regardless of whether you use modern or legacy control flow.

```typescript
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="card"
      [ngClass]="{ 'card--active': isActive(), 'card--disabled': !isActive() }"
      [ngStyle]="{ 'border-color': isActive() ? 'green' : 'gray', 'opacity': isActive() ? 1 : 0.6 }"
    >
      {{ title }}
    </div>

    <!-- Simpler alternatives for single class/style bindings -->
    <div [class.card--active]="isActive()" [style.opacity]="isActive() ? 1 : 0.6">
      {{ title }}
    </div>
  `,
})
export class CardComponent {
  title = 'Order #4821';
  isActive = signal(true);
}
```

In practice: prefer the plain `[class.foo]="cond"` and `[style.prop]="value"` bindings for single conditions — they're simpler and don't need `CommonModule`. Reach for `[ngClass]`/`[ngStyle]` only when toggling several classes/styles at once from an object or array.

```typescript
// ngClass accepts a string, array, or object
[ngClass]="'card active'"                       // string
[ngClass]="['card', 'active']"                  // array
[ngClass]="{ active: isActive, disabled: !isActive }" // object (most common)
```

---

## 6. Hands-On Exercises

**Exercise 1:** Build a standalone component that renders a list of products with `@for`, using `track product.id`, and shows a "No products found" message via `@empty` when the array is empty.

**Exercise 2:** Rewrite the same list using legacy `*ngFor` with `trackBy`, `*ngIf; else`, and a `<ng-template>` for the empty case. Compare the two versions side by side.

**Exercise 3:** Build a status badge component using `@switch`/`@case`/`@default` for three states (`pending`, `shipped`, `delivered`), each rendering a differently styled `<span>`.

**Exercise 4:** Add `[ngClass]` to a card component that toggles `highlighted`, `disabled`, and `urgent` classes based on three independent boolean signals. Then refactor it to use three separate `[class.x]` bindings instead and note which is more readable.

**Exercise 5:** In the `@for` list from Exercise 1, add `let i = $index, isFirst = $first` and render "1. " prefix using `i + 1`, plus a distinct style on the first item using `isFirst`.

---

## 7. Interview Q&A

**Q: What is the difference between a structural directive and an attribute directive?**
Answer: A structural directive changes the DOM's structure by adding, removing, or replacing elements — e.g., `*ngIf` removes an element entirely when false. An attribute directive changes the appearance or behavior of an element that stays in the DOM — e.g., `[ngClass]` toggles CSS classes without adding/removing the element. Structural directives are prefixed with `*` (or use the modern `@if`/`@for`/`@switch` block syntax); attribute directives use property binding syntax `[directive]`.

**Q: Why does `@for` require a `track` expression while `*ngFor`'s `trackBy` was optional?**
Answer: Without a tracking key, Angular has to destroy and recreate DOM nodes for every item whenever the array reference changes, even if most items are unchanged — this is expensive for large or frequently-updated lists. `trackBy` in `*ngFor` fixed this but was easy to forget since it was optional. The new `@for` block makes `track` a compiler-enforced requirement, so every loop gets efficient DOM reuse by default.

**Q: What does `*ngIf="cond"` desugar to internally?**
Answer: `<div *ngIf="cond">` desugars to `<ng-template [ngIf]="cond"><div>...</div></ng-template>`. The `NgIf` directive is actually applied to an `<ng-template>`, and it conditionally instantiates that template's content into the DOM via `ViewContainerRef`. This is also why only one structural directive could be placed directly on a single host element pre-Angular 17 — you'd need nested `<ng-container>` elements to combine two.

**Q: When would you use `[ngClass]` over a plain `[class.foo]` binding?**
Answer: Use `[class.foo]="condition"` for a single class toggle — it's simpler and doesn't require importing `CommonModule`. Use `[ngClass]` when you need to toggle multiple classes at once from an object, array, or string expression, e.g., `[ngClass]="{active: isActive, disabled: !isEnabled, urgent: priority === 'high'}"`.

**Q: Do you still need to import `CommonModule` when using `@if`/`@for`/`@switch`?**
Answer: No. The new control-flow blocks are built into the Angular template compiler itself, not implemented as directives, so they require no imports at all. `NgClass`, `NgStyle`, and the legacy `*ngIf`/`*ngFor`/`*ngSwitch` directives are still regular directives and do require importing `CommonModule` (or the individual directive) into a standalone component's `imports` array.
