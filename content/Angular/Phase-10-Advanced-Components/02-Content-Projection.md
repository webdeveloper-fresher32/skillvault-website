# Content Projection — Complete Guide

## Table of Contents
1. [What Content Projection Solves](#1-what-content-projection-solves)
2. [Single-Slot Projection with ng-content](#2-single-slot-projection-with-ng-content)
3. [Multi-Slot Projection with select](#3-multi-slot-projection-with-select)
4. [ng-template and Structural Templates](#4-ng-template-and-structural-templates)
5. [ngTemplateOutlet — Passing Templates as Data](#5-ngtemplateoutlet--passing-templates-as-data)
6. [Worked Example: A Reusable Card Component](#6-worked-example-a-reusable-card-component)
7. [Worked Example: A Reusable Modal Component](#7-worked-example-a-reusable-modal-component)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What Content Projection Solves

Without content projection, a reusable component can only display data through `@Input()` — fine for primitives, painful for arbitrary markup. Content projection lets the **consumer of a component** supply the actual HTML/template content that gets rendered inside it, while the component controls the surrounding structure (borders, layout, behavior).

```
Without projection:                    With projection:
<app-card                              <app-card>
  [title]="'Order #123'"                 <h3>Order #123</h3>
  [body]="'Ships tomorrow'">              <p>Ships tomorrow <strong>free</strong></p>
</app-card>                               <button>Track</button>
                                        </app-card>
Card component can only render         Card component renders whatever
plain strings it was given              markup the caller puts inside it
```

This is the same concept as `{children}` in React or `<slot>` in Web Components — Angular's version is `<ng-content>`.

---

## 2. Single-Slot Projection with ng-content

Any markup a consumer places between a component's opening and closing tags is captured and rendered wherever `<ng-content>` appears in that component's template.

```typescript
// panel.component.ts
@Component({
  selector: 'app-panel',
  standalone: true,
  template: `
    <div class="panel">
      <ng-content></ng-content>
    </div>
  `,
})
export class PanelComponent {}
```

```html
<!-- usage -->
<app-panel>
  <h2>Account Settings</h2>
  <p>Manage your profile and preferences.</p>
</app-panel>
```

```html
<!-- rendered DOM -->
<div class="panel">
  <h2>Account Settings</h2>
  <p>Manage your profile and preferences.</p>
</div>
```

If a consumer doesn't provide any content, you can supply a fallback by putting default markup *inside* `<ng-content>`:

```html
<ng-content>
  <p>No content provided.</p>
</ng-content>
```

---

## 3. Multi-Slot Projection with select

A component can define **multiple** projection slots using the `select` attribute on `<ng-content>`, routing different parts of the consumer's markup to different places based on a CSS selector (tag name, attribute, or class).

```typescript
// card.component.ts
@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <div class="card">
      <header class="card-header">
        <ng-content select="[card-title]"></ng-content>
      </header>
      <section class="card-body">
        <ng-content></ng-content>  <!-- catch-all: anything NOT matched above -->
      </section>
      <footer class="card-footer">
        <ng-content select="[card-actions]"></ng-content>
      </footer>
    </div>
  `,
})
export class CardComponent {}
```

```html
<!-- usage -->
<app-card>
  <h3 card-title>Delete Account</h3>

  <p>This action cannot be undone. All your data will be permanently removed.</p>

  <div card-actions>
    <button>Cancel</button>
    <button>Delete</button>
  </div>
</app-card>
```

**Rules for `select`:**
- Matching is based on the **original element**, evaluated in order the `<ng-content>` tags appear in the template — Angular checks each projected node against each selector once.
- An `<ng-content>` **without** a `select` attribute acts as the catch-all for anything not matched by an earlier, more specific slot — put it last, or it will swallow everything.
- Selectors can be a tag name (`select="app-tab"`), an attribute (`select="[card-title]"`), or a class (`select=".highlight"`).

---

## 4. ng-template and Structural Templates

`<ng-template>` declares a chunk of markup that Angular does **not** render immediately — it's a template definition, only rendered when something explicitly instantiates it (a structural directive like `*ngIf`/`@if` desugars to this, or manual APIs like `ngTemplateOutlet` / `ViewContainerRef`).

```html
<ng-template #loadingTpl>
  <p>Loading…</p>
</ng-template>

<ng-template #errorTpl let-message="message">
  <p class="error">Failed: {{ message }}</p>
</ng-template>
```

`<ng-template>` can declare **template input variables** with `let-x` — these become parameters that the code instantiating the template can supply, similar to a function's parameters.

---

## 5. ngTemplateOutlet — Passing Templates as Data

`ngTemplateOutlet` renders a `TemplateRef` (usually captured via `#refName` and `@ViewChild`, or received as an `@Input()`) at a location you choose, optionally with a context object supplying values to the template's `let-` variables. This lets a component accept an *entire chunk of markup* as a first-class value — not just projected content, but something it can conditionally render, render multiple times, or render with different data each time.

```typescript
// data-table.component.ts
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    @for (row of rows; track row.id) {
      <div class="row">
        <ng-container
          [ngTemplateOutlet]="rowTemplate"
          [ngTemplateOutletContext]="{ $implicit: row }">
        </ng-container>
      </div>
    }
  `,
})
export class DataTableComponent {
  @Input() rows: any[] = [];
  @Input() rowTemplate!: TemplateRef<{ $implicit: any }>;
}
```

```html
<!-- usage: caller decides how each row looks -->
<ng-template #row let-user>
  <span>{{ user.name }}</span>
  <span>{{ user.email }}</span>
</ng-template>

<app-data-table [rows]="users" [rowTemplate]="row"></app-data-table>
```

The `$implicit` key in the context object becomes the default `let-x` variable (`let-user` above binds to `context.$implicit`); named keys (`let-x="key"`) bind to matching context properties. This pattern — "render prop" style templates — is how Angular Material builds highly customizable components like tables and autocomplete panels.

---

## 6. Worked Example: A Reusable Card Component

Combining `ng-content` slots for a component that any feature team can reuse without modifying it:

```typescript
// card.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <div class="card">
      @if (hasTitle) {
        <header class="card-header"><ng-content select="[card-title]"></ng-content></header>
      }
      <section class="card-body"><ng-content></ng-content></section>
      <footer class="card-footer"><ng-content select="[card-actions]"></ng-content></footer>
    </div>
  `,
  styles: [`
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
    .card-header { font-weight: 600; margin-bottom: 8px; }
    .card-footer { margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end; }
  `],
})
export class CardComponent {
  hasTitle = true; // could be derived from @ContentChild presence checks
}
```

```html
<!-- three completely different usages, zero changes to CardComponent -->
<app-card>
  <span card-title>Invoice #4471</span>
  <p>Total: $128.00 — due July 20</p>
  <div card-actions><button>Pay Now</button></div>
</app-card>

<app-card>
  <span card-title>New Message</span>
  <p>You have 3 unread messages from support.</p>
</app-card>
```

---

## 7. Worked Example: A Reusable Modal Component

A modal built with content projection plus `ngTemplateOutlet` for the footer, so the caller controls both the body markup and, optionally, a custom footer:

```typescript
// modal.component.ts
import { Component, EventEmitter, Input, Output, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    @if (open) {
      <div class="backdrop" (click)="close.emit()">
        <div class="modal" (click)="$event.stopPropagation()">
          <header>
            <ng-content select="[modal-title]"></ng-content>
            <button (click)="close.emit()">&times;</button>
          </header>

          <section class="modal-body">
            <ng-content></ng-content>
          </section>

          <footer>
            @if (footerTemplate) {
              <ng-container [ngTemplateOutlet]="footerTemplate"></ng-container>
            } @else {
              <button (click)="close.emit()">Close</button>
            }
          </footer>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  @Input() open = false;
  @Input() footerTemplate?: TemplateRef<unknown>;
  @Output() close = new EventEmitter<void>();
}
```

```html
<!-- usage -->
<app-modal [open]="showModal" (close)="showModal = false">
  <span modal-title>Confirm Deletion</span>
  <p>Are you sure you want to delete this project? This cannot be undone.</p>
</app-modal>

<!-- with a custom footer template -->
<ng-template #customFooter>
  <button (click)="showModal = false">Cancel</button>
  <button class="danger" (click)="onDelete()">Delete Forever</button>
</ng-template>

<app-modal [open]="showModal" [footerTemplate]="customFooter">
  <span modal-title>Confirm Deletion</span>
  <p>This will permanently remove all associated data.</p>
</app-modal>
```

`ModalComponent` never needs to know what's inside the body or footer — it only owns the open/close mechanics and backdrop behavior, while callers plug in whatever markup and buttons they need.

---

## 8. Hands-On Exercises

**Exercise 1:** Build a `PanelComponent` with a single `<ng-content>`, and add fallback markup inside it that renders only when the caller passes nothing. Verify the fallback disappears once you add real content.

**Exercise 2:** Extend the `CardComponent` above with a third slot (`[card-badge]`) that renders a small status pill in the top-right corner. Confirm the catch-all `<ng-content>` (no `select`) still works correctly and doesn't also render the badge content.

**Exercise 3:** Build a `TabGroupComponent` that projects multiple `<app-tab title="...">` children via the catch-all slot, and write out (in comments) how you'd combine this with `@ContentChildren` from Phase 10 lesson 3 to make only the active tab visible.

**Exercise 4:** Build the `DataTableComponent` from section 5. Reuse it twice on the same page with two different `#row` templates — one rendering a compact single-line row, another rendering a two-line row with an avatar — to prove the same table component adapts to both.

**Exercise 5:** Build the `ModalComponent` from section 7. Use it once with the default footer (just a Close button) and once with a custom `footerTemplate` containing Cancel/Confirm buttons that call different parent methods.

---

## 9. Interview Q&A

**Q: What is content projection in Angular and what problem does it solve?**
Answer: Content projection (`<ng-content>`) lets a component render markup supplied by its consumer, rather than only accepting data through `@Input()`. It solves the problem of building generic wrapper/layout components (cards, modals, panels) that shouldn't need to know about every possible piece of content they might contain — the consumer places arbitrary HTML between the component's tags, and the component decides where in its own template that content appears.

**Q: How does multi-slot projection with `select` work, and what happens if two `<ng-content>` selectors could match the same element?**
Answer: Each `<ng-content select="...">` uses a CSS selector (tag, attribute, or class) to claim specific projected nodes. Angular evaluates the `<ng-content>` tags in the order they appear in the template and assigns each projected node to the first slot whose selector matches; a node matched by an earlier slot is not re-matched by a later one. An `<ng-content>` with no `select` attribute acts as the catch-all for anything unmatched, so it should always be placed last, or it will consume markup intended for a later, more specific slot.

**Q: What's the difference between `<ng-content>` and `<ng-template>`?**
Answer: `<ng-content>` is a projection *insertion point* — it renders content the consumer already placed in the DOM between the component's tags, and that content is rendered eagerly as part of the parent's view. `<ng-template>` defines markup that is NOT rendered at all until something explicitly instantiates it (a structural directive, or `ngTemplateOutlet`/`ViewContainerRef` imperatively) — it's a reusable, deferred template definition, optionally parameterized with `let-` variables.

**Q: When would you use `ngTemplateOutlet` instead of plain content projection?**
Answer: Plain `ng-content` only lets a component render content once, wherever the `<ng-content>` tag is — it can't repeat that content for each item in a list with different data, and it can't conditionally swap it out. `ngTemplateOutlet` renders a `TemplateRef` value that you can pass around like data, instantiate multiple times (e.g., once per row in a table via `@for`), and feed different context objects (via `ngTemplateOutletContext`) each time — enabling "render prop" style APIs like Angular Material's customizable table cells.

**Q: What is the `$implicit` key used for in a template context object?**
Answer: When you pass a context object to `ngTemplateOutletContext`, the value under the `$implicit` key becomes the default value bound by an unnamed `let-x` declaration on the `<ng-template>` — e.g. `let-user` binds to `context.$implicit`. Named context properties (e.g., `index`) require a matching `let-i="index"` declaration to be accessed inside the template.
