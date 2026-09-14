# ViewChild and ContentChild — Complete Guide

## Table of Contents
1. [Why Query Decorators Exist](#1-why-query-decorators-exist)
2. [@ViewChild and @ViewChildren](#2-viewchild-and-viewchildren)
3. [@ContentChild and @ContentChildren](#3-contentchild-and-contentchildren)
4. [Static vs Dynamic Queries](#4-static-vs-dynamic-queries)
5. [Signal-Based Queries: viewChild() and contentChild()](#5-signal-based-queries-viewchild-and-contentchild)
6. [Worked Example: Parent Controlling a Child Imperatively](#6-worked-example-parent-controlling-a-child-imperatively)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Query Decorators Exist

Angular's default data flow is one-directional: parent → child via `@Input()`, child → parent via `@Output()`. Sometimes that's not enough — a parent component needs to **call a method** on a child directly (e.g., `videoPlayer.play()`), or a component needs a **reference to a native DOM element** in its own template (e.g., an `<input>` to call `.focus()`), or a wrapper component needs to **discover which child components** were projected into it. Query decorators (`@ViewChild`, `@ContentChild`, and their `*Children` plural forms) solve exactly these three problems.

```
@ViewChild    → look inside MY OWN template (elements, directives, child components I declared)
@ContentChild → look inside content PROJECTED INTO ME by a consumer (via <ng-content>)
```

---

## 2. @ViewChild and @ViewChildren

`@ViewChild` retrieves a single reference from the component's **own template** — a template reference variable (`#name`), a child component/directive type, or a `TemplateRef`. `@ViewChildren` retrieves all matches as a `QueryList`.

```typescript
import { Component, ViewChild, ViewChildren, QueryList, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-video-player',
  standalone: true,
  template: `<video #videoEl [src]="src"></video>`,
})
export class VideoPlayerComponent {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @Input() src = '';

  play() { this.videoEl.nativeElement.play(); }
  pause() { this.videoEl.nativeElement.pause(); }
}

@Component({
  selector: 'app-checkbox-list',
  standalone: true,
  imports: [CheckboxComponent],
  template: `
    @for (label of labels; track label) {
      <app-checkbox [label]="label"></app-checkbox>
    }
  `,
})
export class CheckboxListComponent implements AfterViewInit {
  @ViewChildren(CheckboxComponent) checkboxes!: QueryList<CheckboxComponent>;
  labels = ['A', 'B', 'C'];

  ngAfterViewInit() {
    console.log(this.checkboxes.length); // 3
    this.checkboxes.changes.subscribe(list => console.log('list changed', list.length));
  }
}
```

`@ViewChild`/`@ViewChildren` results are available starting in `ngAfterViewInit` (see [01-Lifecycle-Hooks.md](01-Lifecycle-Hooks.md)) — reading them in `ngOnInit` returns `undefined`. `QueryList` also emits a `.changes` `Observable` whenever the matched set changes (e.g., items added/removed by `@for`).

---

## 3. @ContentChild and @ContentChildren

`@ContentChild`/`@ContentChildren` retrieve references from content **projected into the component** by a consumer (see [02-Content-Projection.md](02-Content-Projection.md)), rather than from the component's own template.

```typescript
// tab.component.ts
@Component({
  selector: 'app-tab',
  standalone: true,
  template: `
    @if (active) {
      <div class="tab-panel"><ng-content></ng-content></div>
    }
  `,
})
export class TabComponent {
  @Input() title = '';
  active = false;
}

// tab-group.component.ts
@Component({
  selector: 'app-tab-group',
  standalone: true,
  template: `
    <nav class="tab-bar">
      @for (tab of tabs; track tab.title) {
        <button (click)="select(tab)" [class.active]="tab.active">{{ tab.title }}</button>
      }
    </nav>
    <ng-content></ng-content>
  `,
})
export class TabGroupComponent implements AfterContentInit {
  @ContentChildren(TabComponent) tabs!: QueryList<TabComponent>;

  ngAfterContentInit() {
    if (this.tabs.length) {
      this.tabs.first.active = true;
    }
  }

  select(tab: TabComponent) {
    this.tabs.forEach(t => t.active = (t === tab));
  }
}
```

```html
<!-- usage -->
<app-tab-group>
  <app-tab title="Profile">Profile content here</app-tab>
  <app-tab title="Billing">Billing content here</app-tab>
  <app-tab title="Security">Security content here</app-tab>
</app-tab-group>
```

`@ContentChild`/`@ContentChildren` results are available starting in `ngAfterContentInit` — one step earlier in the lifecycle than `@ViewChild`, because content projection resolves before the component's own view.

---

## 4. Static vs Dynamic Queries

`@ViewChild` accepts a second options argument, `{ static: true | false }`, controlling **when** Angular resolves the reference.

```typescript
@ViewChild('header', { static: true }) header!: ElementRef;   // resolved before ngOnInit
@ViewChild('footer', { static: false }) footer!: ElementRef;  // resolved in/after ngAfterViewInit (this is the default)
```

- **`static: true`** — use only when the queried element is **never** inside a conditional structural block (`@if`, `*ngIf`) — i.e., it's always present. Angular resolves it earlier, making it available already in `ngOnInit`.
- **`static: false`** (the default since Angular 9, and what you get if you omit the option) — use whenever the queried element **might** be conditionally rendered, or when in doubt. It's resolved after the view is fully composed, available starting `ngAfterViewInit`.

```typescript
@Component({
  template: `
    @if (showDetails) {
      <div #detailsPanel>...</div>
    }
  `,
})
export class MyComponent {
  // MUST be dynamic (static: false / default) — detailsPanel doesn't exist until showDetails is true
  @ViewChild('detailsPanel') detailsPanel?: ElementRef;
}
```

Using `static: true` on something inside an `@if` will resolve to `undefined` and silently not update later — always default to dynamic unless you're certain the element is unconditionally rendered.

---

## 5. Signal-Based Queries: viewChild() and contentChild()

Angular 17+ introduces function-based query APIs — `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()` — that return a **signal** instead of requiring a decorator + separate class property. They're initialized as class fields, are always "dynamic" (no static option needed since signals are lazily/reactively read), and compose naturally with `computed()` and `effect()`.

```typescript
import { Component, viewChild, viewChildren, ElementRef, effect } from '@angular/core';

@Component({
  selector: 'app-search-box',
  standalone: true,
  template: `<input #searchInput type="text" />`,
})
export class SearchBoxComponent {
  // signal-based — no @ViewChild decorator, no separate lifecycle hook needed to read it safely
  searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  focusInputEffect = effect(() => {
    // safe to call — Angular runs effects after the view is ready
    this.searchInput().nativeElement.focus();
  });
}
```

```typescript
@Component({ /* ... */ })
export class CheckboxListComponent {
  checkboxes = viewChildren(CheckboxComponent); // Signal<readonly CheckboxComponent[]>

  checkedCount = computed(() =>
    this.checkboxes().filter(c => c.checked()).length
  );
}
```

```typescript
@Component({ /* ... */ })
export class TabGroupComponent {
  tabs = contentChildren(TabComponent); // Signal<readonly TabComponent[]>

  activateFirst = effect(() => {
    const list = this.tabs();
    if (list.length) list[0].active = true;
  });
}
```

**Key differences from the decorator API:**

| | Decorator (`@ViewChild`) | Signal-based (`viewChild()`) |
|---|---|---|
| Declaration | Property + decorator, needs `!` or `?` | Function call assigned to a readonly field |
| Required variant | N/A — always possibly `undefined` until view init | `viewChild.required(...)` throws if not found, returns non-nullable type |
| Reading safely | Must wait for `ngAfterViewInit`/`ngAfterContentInit` | Read anywhere — returns `undefined` (or throws for `.required`) before resolved, updates reactively |
| Reacting to changes | Subscribe to `QueryList.changes` | Use in a `computed()` or `effect()` — reactivity is automatic |
| Static option | `{ static: true }` needed for pre-view-init access | Not needed — signals are read lazily, always current |

`viewChild.required()`/`contentChild.required()` variants throw immediately if the query never matches anything, giving you a non-nullable return type instead of `Signal<T | undefined>` — preferred when you know the element/component always exists.

---

## 6. Worked Example: Parent Controlling a Child Imperatively

A `VideoPlayerComponent` exposing `play()`/`pause()`, controlled imperatively by a parent — using both the classic decorator approach and the modern signal-based equivalent, side by side.

```typescript
// video-player.component.ts
import { Component, ElementRef, Input, viewChild } from '@angular/core';

@Component({
  selector: 'app-video-player',
  standalone: true,
  template: `<video #videoEl [src]="src" width="480"></video>`,
})
export class VideoPlayerComponent {
  @Input() src = '';

  private videoEl = viewChild.required<ElementRef<HTMLVideoElement>>('videoEl');

  play()  { this.videoEl().nativeElement.play(); }
  pause() { this.videoEl().nativeElement.pause(); }
  seekTo(seconds: number) { this.videoEl().nativeElement.currentTime = seconds; }
}
```

```typescript
// player-controls.component.ts — the PARENT that drives the child imperatively
import { Component, viewChild } from '@angular/core';
import { VideoPlayerComponent } from './video-player.component';

@Component({
  selector: 'app-player-controls',
  standalone: true,
  imports: [VideoPlayerComponent],
  template: `
    <app-video-player #player src="/assets/demo.mp4"></app-video-player>

    <button (click)="player_.play()">Play</button>
    <button (click)="player_.pause()">Pause</button>
    <button (click)="player_.seekTo(30)">Skip to 0:30</button>
  `,
})
export class PlayerControlsComponent {
  // signal-based query for the CHILD COMPONENT itself, not just a DOM node
  private player = viewChild.required(VideoPlayerComponent);

  // convenience getter so the template can call methods directly
  get player_() { return this.player(); }
}
```

The parent never touches the child's internal `<video>` element or DOM APIs directly — it calls the child's public methods (`play()`, `pause()`, `seekTo()`), keeping the child's implementation details encapsulated while still allowing full imperative control, exactly the way you'd call a method on any other object reference.

---

## 7. Hands-On Exercises

**Exercise 1:** Build a `SearchBoxComponent` with a template-referenced `<input>`. Implement it twice: once using `@ViewChild('input') input!: ElementRef` read in `ngAfterViewInit`, and once using `viewChild.required('input')` read inside an `effect()`. Confirm both correctly focus the input, and compare how much boilerplate each requires.

**Exercise 2:** Build a `TabGroupComponent`/`TabComponent` pair from section 3. Convert the `@ContentChildren(TabComponent)` decorator version to the signal-based `contentChildren(TabComponent)` equivalent, and re-implement the "activate first tab" logic using an `effect()` instead of `ngAfterContentInit`.

**Exercise 3:** Take a component with an element inside an `@if` block, and add a `@ViewChild(..., { static: true })` query for it. Run the app and observe the reference is `undefined` even after the `@if` becomes true — then fix it by removing the `static: true` option (or switching to `viewChild()`), and explain why the static option broke it.

**Exercise 4:** Build the `VideoPlayerComponent` + `PlayerControlsComponent` pair from section 6. Add a `seekTo(seconds: number)` method and a numeric input in the parent's template that lets the user type a time and click a "Seek" button to call it.

**Exercise 5:** Build a `CheckboxListComponent` that renders `N` `app-checkbox` children via `@for`, and use `viewChildren(CheckboxComponent)` plus a `computed()` signal that derives `checkedCount`. Add a button that unchecks all checkboxes by calling a method on each item returned by the query.

---

## 8. Interview Q&A

**Q: What's the difference between `@ViewChild` and `@ContentChild`?**
Answer: `@ViewChild` queries elements/components declared inside the component's *own template* — things the component author wrote. `@ContentChild` queries elements/components that were *projected into* the component via `<ng-content>` by whoever is consuming it. `@ViewChild` results are available starting `ngAfterViewInit`; `@ContentChild` results are available one step earlier, starting `ngAfterContentInit`, because content projection resolves before the component's own view.

**Q: What does the `static` option on `@ViewChild` control, and when should you use `static: true`?**
Answer: `static` controls when Angular resolves the query. `static: true` resolves the reference before `ngOnInit`, so it's available earlier — but only works correctly for elements that are unconditionally present in the template (never behind `*ngIf`/`@if`). `static: false` (the default) resolves after the view is fully composed, available from `ngAfterViewInit` onward, and correctly handles conditionally-rendered elements. When in doubt, use the default (dynamic) — `static: true` on a conditional element silently resolves to `undefined`.

**Q: How do the signal-based `viewChild()`/`contentChild()` functions differ from the `@ViewChild`/`@ContentChild` decorators?**
Answer: The function-based queries (Angular 17+) return a `Signal` instead of requiring a separately-declared property with a decorator. They can be read anywhere in the class (returning `undefined` until resolved, or throwing for the `.required()` variant) instead of only being safe to read after a specific lifecycle hook, and they compose directly with `computed()`/`effect()` for reactivity — no manual subscription to `QueryList.changes` needed, and no `static` option to configure since signals are always read lazily and reflect the current state.

**Q: Why would a parent component use `@ViewChild`/`viewChild()` to get a reference to a child *component* instead of just using `@Input()`/`@Output()`?**
Answer: `@Input()`/`@Output()` are the standard declarative data flow and should be preferred for most cases. But sometimes a parent needs to imperatively *invoke a method* on a child at an arbitrary moment driven by something outside the normal data flow — e.g., a "Play" button calling `videoPlayer.play()`, or a form calling `child.resetValidation()`. A `@ViewChild`/`viewChild()` reference to the child component instance gives direct access to its public methods and properties for exactly this kind of imperative control.

**Q: What does `QueryList` provide that a plain array doesn't, when using `@ViewChildren`/`@ContentChildren`?**
Answer: `QueryList` is a live, Angular-managed collection that automatically updates when the underlying DOM/projected content changes (e.g., items added or removed via `@for`), and it exposes a `.changes` `Observable` that emits whenever the matched set is updated — so you can react to items being added/removed at runtime instead of only reading a fixed snapshot once in `ngAfterViewInit`/`ngAfterContentInit`.
