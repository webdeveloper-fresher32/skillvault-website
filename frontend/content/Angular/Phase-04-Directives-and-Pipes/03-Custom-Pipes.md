# Custom Pipes — Complete Guide

## Table of Contents
1. [What is a Pipe?](#1-what-is-a-pipe)
2. [Built-in Pipes Overview](#2-built-in-pipes-overview)
3. [Pure vs Impure Pipes](#3-pure-vs-impure-pipes)
4. [Writing a Custom Pipe: @Pipe and PipeTransform](#4-writing-a-custom-pipe-pipe-and-pipetransform)
5. [Worked Example: Truncate Pipe](#5-worked-example-truncate-pipe)
6. [Worked Example: Filter Pipe (and why it's usually a bad idea)](#6-worked-example-filter-pipe-and-why-its-usually-a-bad-idea)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is a Pipe?

A pipe transforms a value for display in a template without changing the underlying data. You apply it with the `|` symbol:

```html
<p>{{ user.createdAt | date:'mediumDate' }}</p>
<p>{{ product.price | currency:'AUD' }}</p>
<p>{{ description | uppercase }}</p>
```

```
Raw value:        2026-07-13T09:00:00Z
Piped through:     | date:'mediumDate'
Displayed as:      Jul 13, 2026
```

Pipes are pure functions (by default) that run only in the template — the component's underlying property (`user.createdAt`) is never mutated. You can chain multiple pipes and pass arguments with colons:

```html
{{ product.name | slice:0:20 | uppercase }}
{{ amount | currency:'USD':'symbol':'1.2-2' }}
```

---

## 2. Built-in Pipes Overview

| Pipe | Purpose | Example |
|------|---------|---------|
| `date` | Formats a `Date`, ISO string, or timestamp | `{{ today \| date:'yyyy-MM-dd' }}` |
| `currency` | Formats a number as currency | `{{ price \| currency:'AUD' }}` → `A$25.00` |
| `decimal` (`number`) | Formats a number with digit rules | `{{ pi \| number:'1.2-2' }}` → `3.14` |
| `percent` | Formats a number as a percentage | `{{ 0.256 \| percent }}` → `26%` |
| `uppercase` / `lowercase` | Case transforms a string | `{{ name \| uppercase }}` |
| `titlecase` | Capitalizes each word | `{{ 'hello world' \| titlecase }}` → `Hello World` |
| `slice` | Extracts a subset of an array or string | `{{ items \| slice:0:5 }}` |
| `json` | Pretty-prints an object as JSON — great for debugging | `<pre>{{ obj \| json }}</pre>` |
| `async` | Unwraps an `Observable` or `Promise` and auto-unsubscribes | `{{ data$ \| async }}` |

The `async` pipe deserves special mention: it subscribes to an `Observable`/`Promise` in the template, marks the component for a check when a new value arrives, and automatically unsubscribes when the component is destroyed — eliminating a whole category of manual-subscription memory leaks.

```typescript
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from './user.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (user$ | async; as user) {
      <h2>{{ user.name }}</h2>
      <p>{{ user.bio }}</p>
    }
  `,
})
export class ProfileComponent {
  private userService = inject(UserService);
  user$ = this.userService.getCurrentUser(); // Observable<User>
}
```

Note the `| async; as user` pattern combined with `@if` — this subscribes once and gives you a local template variable, avoiding multiple separate subscriptions to the same observable.

---

## 3. Pure vs Impure Pipes

By default every pipe is **pure**. Angular only re-runs a pure pipe's `transform()` when it detects the **input reference** has changed (a new object/array reference, or a changed primitive value) — not on every change-detection cycle.

```typescript
@Pipe({
  name: 'myPipe',
  standalone: true,
  pure: true, // default — can be omitted
})
```

```
Pure pipe:
  transform() called ONLY when input reference/primitive changes.
  {{ items | myPipe }}  → items = [...items, newItem] (new array) → re-runs
                         → items.push(newItem) (same reference)    → does NOT re-run

Impure pipe:
  transform() called on EVERY change detection cycle, regardless of input change.
  {{ items | myImpurePipe }} → re-runs on every keystroke, every timer tick,
                               every unrelated state change anywhere in the app
```

Mark a pipe impure explicitly:

```typescript
@Pipe({
  name: 'myImpurePipe',
  standalone: true,
  pure: false,
})
export class MyImpurePipe implements PipeTransform {
  transform(value: unknown[]): unknown[] {
    // runs constantly — keep this cheap!
    return value;
  }
}
```

`async` is Angular's one built-in impure pipe (it must re-check for new emitted values on every cycle since it can't detect "reference changes" on a stream), but you should almost never write your own impure pipe. Impure pipes reintroduce the exact performance problem pipes exist to solve — recomputing a transform far more often than needed. If you need to react to internal mutations of an array/object (like `.push()` without creating a new reference), the fix is almost always to make your data immutable (`items = [...items, newItem]`) and keep the pipe pure, not to make the pipe impure.

| | Pure pipe | Impure pipe |
|---|-----------|--------------|
| Runs when | Input reference/primitive changes | Every change-detection cycle |
| Performance | Cheap — cached until input changes | Expensive at scale — recomputes constantly |
| Default | Yes | Must opt in with `pure: false` |
| Built-in example | `date`, `currency`, `uppercase`, `slice`, `json` | `async` |
| When to actually use | Nearly always | Rare — avoid; fix data immutability instead |

---

## 4. Writing a Custom Pipe: @Pipe and PipeTransform

Every pipe is a class decorated with `@Pipe` that implements `PipeTransform`, which requires a single `transform()` method:

```typescript
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'exclaim', // the name used in templates: {{ value | exclaim }}
  standalone: true,
})
export class ExclaimPipe implements PipeTransform {
  transform(value: string, times: number = 1): string {
    return value + '!'.repeat(times);
  }
}
```

```html
<p>{{ 'Hello' | exclaim }}</p>        <!-- Hello! -->
<p>{{ 'Hello' | exclaim:3 }}</p>      <!-- Hello!!! -->
```

`transform(value, ...args)` — the first parameter is always the value on the left of the pipe; every argument after a colon in the template becomes an additional parameter, in order.

To use it, import the pipe class directly into a standalone component's `imports` array (no `CommonModule` needed for custom pipes):

```typescript
import { Component } from '@angular/core';
import { ExclaimPipe } from './exclaim.pipe';

@Component({
  selector: 'app-greeting',
  standalone: true,
  imports: [ExclaimPipe],
  template: `<p>{{ name | exclaim:2 }}</p>`,
})
export class GreetingComponent {
  name = 'World';
}
```

---

## 5. Worked Example: Truncate Pipe

A common real-world pipe: shorten long text and append an ellipsis.

```typescript
// truncate.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate',
  standalone: true,
})
export class TruncatePipe implements PipeTransform {
  transform(value: string, limit = 50, trail = '…'): string {
    if (!value) return '';
    if (value.length <= limit) return value;
    return value.slice(0, limit).trimEnd() + trail;
  }
}
```

```typescript
// article-card.component.ts
import { Component } from '@angular/core';
import { TruncatePipe } from './truncate.pipe';

@Component({
  selector: 'app-article-card',
  standalone: true,
  imports: [TruncatePipe],
  template: `
    <h3>{{ article.title }}</h3>
    <p>{{ article.body | truncate:120 }}</p>
    <p>{{ article.body | truncate:20:' [read more]' }}</p>
  `,
})
export class ArticleCardComponent {
  article = {
    title: 'Understanding Angular Pipes',
    body: 'Pipes let you transform displayed values in your templates without mutating the underlying component data, keeping your rendering logic declarative and reusable across the whole application.',
  };
}
```

This is a textbook pure pipe: given the same string and limit, it always returns the same output, and it only re-runs when `article.body` (or the arguments) change reference/value — perfectly cacheable.

---

## 6. Worked Example: Filter Pipe (and why it's usually a bad idea)

A filter pipe is instructive precisely because of its performance pitfall:

```typescript
// filter-by-name.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

interface Named {
  name: string;
}

@Pipe({
  name: 'filterByName',
  standalone: true,
  pure: true, // deliberately pure — see note below
})
export class FilterByNamePipe implements PipeTransform {
  transform<T extends Named>(items: T[], search: string): T[] {
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(term));
  }
}
```

```typescript
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FilterByNamePipe } from './filter-by-name.pipe';

@Component({
  selector: 'app-contact-list',
  standalone: true,
  imports: [FormsModule, FilterByNamePipe],
  template: `
    <input [(ngModel)]="searchTerm" placeholder="Search contacts..." />
    <ul>
      @for (contact of contacts | filterByName:searchTerm; track contact.name) {
        <li>{{ contact.name }}</li>
      }
    </ul>
  `,
})
export class ContactListComponent {
  searchTerm = '';
  contacts = [{ name: 'Amelia' }, { name: 'Ben' }, { name: 'Chidi' }];
}
```

Why this is risky even though it's marked `pure: true`: a pure pipe re-runs whenever any of its **arguments** change by reference or value — and `searchTerm` changes on every keystroke, so `transform()` re-filters the entire array on every keystroke anyway. That's usually fine for small lists, but for large ones it's better to move the filtering into the component (e.g., a `computed()` signal or a method called from `(ngModelChange)`) rather than a template pipe, since the pipe re-executes as part of every change-detection pass that touches this template, not just on `contacts` changes.

**General rule of thumb:** filter/sort pipes are a common Angular anti-pattern. They look convenient but re-run non-trivially often and can't be memoized across template re-renders the way a computed signal in the component class can. Prefer filtering in the component (a `computed()` signal derived from a search signal) and keep pipes for pure formatting/display transforms like `truncate`, `date`, and `currency`.

---

## 7. Hands-On Exercises

**Exercise 1:** Write a `truncate` pipe (as in Section 5) and use it in a component that renders a list of blog post summaries, each truncated to 100 characters.

**Exercise 2:** Write a pure `initials` pipe that takes a full name string and returns the initials, e.g., `{{ 'Ada Lovelace' | initials }}` → `AL`.

**Exercise 3:** Write an `exclaim` pipe (Section 4) that accepts an optional second argument for repeat count, and chain it with the built-in `uppercase` pipe: `{{ name | exclaim:2 | uppercase }}`.

**Exercise 4:** Reproduce the `filterByName` example from Section 6, then refactor the filtering logic out of the pipe and into a `computed()` signal in the component instead. Compare re-render behavior for both approaches (you can log from `transform()` and from the `computed()` to see how often each runs).

**Exercise 5:** Deliberately create an impure pipe (`pure: false`) that logs a message every time `transform()` runs, place it in a component with an unrelated `setInterval` triggering change detection every second, and observe in the console how much more often it fires compared to a pure pipe bound to a value that never changes.

---

## 8. Interview Q&A

**Q: What is the difference between a pure and an impure pipe?**
Answer: A pure pipe's `transform()` only re-runs when Angular detects that its input reference (for objects/arrays) or primitive value has changed — it's cached otherwise, which is efficient. An impure pipe re-runs on every single change-detection cycle in the entire application, regardless of whether its inputs changed, which is expensive. Pipes are pure by default; you opt into impure with `pure: false` in the `@Pipe` decorator. The built-in `async` pipe is impure because it needs to check a stream for new values that reference-equality checks can't detect.

**Q: Why doesn't a pure pipe re-run when you `.push()` an item into an array bound to it?**
Answer: A pure pipe compares the input by reference (or value, for primitives) between change-detection cycles. `array.push(item)` mutates the array in place — the reference stays identical — so Angular's pure-pipe check sees "no change" and skips re-running `transform()`. To trigger it, you need a new array reference, e.g., `this.items = [...this.items, item]`, which is also the same practice React/immutable-state patterns rely on.

**Q: When would you make a pipe impure, and why is it usually discouraged?**
Answer: You'd make a pipe impure only when you must react to internal mutations of an object/array that don't change its reference and you can't easily switch to immutable updates — e.g. wrapping a third-party mutable data structure you don't control. It's discouraged because an impure pipe reruns on every change-detection cycle anywhere in the component tree, not just when its own inputs change, which can seriously hurt performance in a large app. In almost all cases, switching to immutable data updates and keeping the pipe pure is the better fix.

**Q: What does the `async` pipe do, and why is it useful?**
Answer: The `async` pipe subscribes to an `Observable` or resolves a `Promise` directly in the template, returns its latest emitted value, and marks the component for change detection when a new value arrives. It also automatically unsubscribes when the component is destroyed. This removes the need to manually subscribe in the component class and unsubscribe in `ngOnDestroy`, eliminating a common source of memory leaks, and pairs well with `@if (data$ | async; as data)` to both unwrap and locally alias the value.

**Q: Why is a filter/sort pipe often considered an anti-pattern in Angular?**
Answer: A pipe bound with a changing argument (like a live search term) re-executes its `transform()` on essentially every relevant change-detection pass, since a pure pipe still re-runs whenever its arguments change — and search terms change on every keystroke. For large collections this becomes an expensive, un-memoized filter running far more often than necessary. It's generally better to perform filtering/sorting in the component using a `computed()` signal (or a method invoked explicitly on input change), reserving pipes for cheap, presentation-only transforms like formatting dates, currency, or truncating strings.
