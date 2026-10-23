# Lifecycle Hooks — Complete Guide

## Table of Contents
1. [Why Lifecycle Hooks Exist](#1-why-lifecycle-hooks-exist)
2. [The Full Lifecycle, In Order](#2-the-full-lifecycle-in-order)
3. [ngOnChanges](#3-ngonchanges)
4. [ngOnInit](#4-ngoninit)
5. [ngDoCheck](#5-ngdocheck)
6. [ngAfterContentInit / ngAfterContentChecked](#6-ngaftercontentinit--ngaftercontentchecked)
7. [ngAfterViewInit / ngAfterViewChecked](#7-ngafterviewinit--ngafterviewchecked)
8. [ngOnDestroy](#8-ngondestroy)
9. [Parent/Child Execution Order](#9-parentchild-execution-order)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Why Lifecycle Hooks Exist

Angular creates a component, renders its template, projects content into it, checks it for changes on every change-detection cycle, and eventually destroys it. Lifecycle hooks are the interface methods a component or directive can implement to run code at each of these well-defined moments — instead of guessing when the DOM is "ready" or when an `@Input()` has changed.

```
Component instance created (constructor)
        │
        ▼
   ngOnChanges()   ← only if component has @Input()s, fires before ngOnInit and on every input change
        │
        ▼
   ngOnInit()      ← once, after first ngOnChanges
        │
        ▼
   ngDoCheck()     ← every change detection run
        │
        ▼
   ngAfterContentInit()     ← once, after projected content is initialized
        │
        ▼
   ngAfterContentChecked()  ← every change detection run, after content checked
        │
        ▼
   ngAfterViewInit()        ← once, after component's own view (and child views) initialized
        │
        ▼
   ngAfterViewChecked()     ← every change detection run, after view checked
        │
        ▼
        ... (repeats ngDoCheck → ngAfterContentChecked → ngAfterViewChecked on every CD cycle)
        │
        ▼
   ngOnDestroy()   ← once, right before Angular destroys the component
```

All hooks are optional — implement only the ones you need by declaring the corresponding interface (`OnInit`, `OnChanges`, etc.) and method. The interfaces are pure TypeScript contracts; Angular calls the method by name (`ngOnInit`), not via the interface at runtime, but implementing the interface protects you from typos.

---

## 2. The Full Lifecycle, In Order

| Order | Hook | Fires | Frequency |
|-------|------|-------|-----------|
| 1 | `ngOnChanges` | Before `ngOnInit`, and whenever a bound `@Input()` changes | Multiple |
| 2 | `ngOnInit` | After the first `ngOnChanges` (or immediately if no inputs) | Once |
| 3 | `ngDoCheck` | Every change detection cycle | Multiple |
| 4 | `ngAfterContentInit` | After content (`ng-content` projected nodes) is initialized | Once |
| 5 | `ngAfterContentChecked` | After every check of projected content | Multiple |
| 6 | `ngAfterViewInit` | After the component's view and child views are initialized | Once |
| 7 | `ngAfterViewChecked` | After every check of the component's view | Multiple |
| 8 | `ngOnDestroy` | Just before the component is removed from the DOM | Once |

```typescript
import { Component, Input, OnChanges, OnInit, DoCheck,
         AfterContentInit, AfterContentChecked,
         AfterViewInit, AfterViewChecked, OnDestroy,
         SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-demo',
  standalone: true,
  template: `<ng-content></ng-content>`,
})
export class DemoComponent implements OnChanges, OnInit, DoCheck,
  AfterContentInit, AfterContentChecked, AfterViewInit, AfterViewChecked, OnDestroy {

  @Input() userId!: string;

  ngOnChanges(changes: SimpleChanges) {
    console.log('ngOnChanges', changes);
  }
  ngOnInit() {
    console.log('ngOnInit');
  }
  ngDoCheck() {
    console.log('ngDoCheck');
  }
  ngAfterContentInit() {
    console.log('ngAfterContentInit');
  }
  ngAfterContentChecked() {
    console.log('ngAfterContentChecked');
  }
  ngAfterViewInit() {
    console.log('ngAfterViewInit');
  }
  ngAfterViewChecked() {
    console.log('ngAfterViewChecked');
  }
  ngOnDestroy() {
    console.log('ngOnDestroy');
  }
}
```

---

## 3. ngOnChanges

Fires **before** `ngOnInit`, and again every time any `@Input()`-bound property receives a new reference value from the parent. Angular passes a `SimpleChanges` object keyed by input property name, each with `previousValue`, `currentValue`, and `firstChange`.

```typescript
ngOnChanges(changes: SimpleChanges) {
  if (changes['userId'] && !changes['userId'].firstChange) {
    this.reloadUser(changes['userId'].currentValue);
  }
}
```

**Use cases:** react to an `@Input()` changing (e.g., refetch data when a `productId` input changes), validate incoming inputs, diff old vs new values.

**Pitfalls:**
- Only fires for **inputs bound from the template** — mutating an object's internal property in place (without reassigning the reference) will *not* trigger it, because Angular does a reference/shallow comparison, not a deep one.
- Fires *before* `ngOnInit` on first use, so don't assume `ngOnInit` has already run when reading component state inside it.
- If a component has no `@Input()`s at all, `ngOnChanges` never fires.

---

## 4. ngOnInit

Fires exactly **once**, right after the first `ngOnChanges` (or immediately if the component has no inputs). This is the idiomatic place to put initialization logic.

```typescript
export class UserProfileComponent implements OnInit {
  @Input() userId!: string;
  user?: User;

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.userService.getUser(this.userId).subscribe(u => this.user = u);
  }
}
```

**Use cases:** fetch initial data, set up subscriptions, initialize local state that depends on `@Input()` values.

**Pitfalls:**
- Don't do this work in the **constructor** — inputs are not yet bound in the constructor, only DI happens there. `ngOnInit` is the correct place once Angular has set the first round of inputs.
- Because it only runs once, it will *not* re-run if inputs change later — use `ngOnChanges` (or effects on signal inputs) for that.

---

## 5. ngDoCheck

Fires on **every** change detection cycle, immediately after `ngOnChanges`/`ngOnInit` in that cycle, giving you a hook to implement custom change detection that Angular's default reference checking misses (e.g., detecting a mutation inside an array or object).

```typescript
export class ListComponent implements DoCheck {
  @Input() items: string[] = [];
  private lastLength = 0;

  ngDoCheck() {
    if (this.items.length !== this.lastLength) {
      console.log('items array mutated in place');
      this.lastLength = this.items.length;
    }
  }
}
```

**Use cases:** detect deep mutations `ngOnChanges` would miss, custom dirty-checking for objects mutated by reference.

**Pitfalls:** **Runs on every single change detection cycle for every instance** — anything expensive here (deep equality checks, network calls) will tank performance app-wide. Keep the logic here as cheap as possible, and prefer immutable data patterns (signals, `OnPush` + new references) so you don't need `ngDoCheck` at all.

---

## 6. ngAfterContentInit / ngAfterContentChecked

Fire after Angular projects external content into the component via `<ng-content>` (see [02-Content-Projection.md](02-Content-Projection.md)). `ngAfterContentInit` runs once, after the projected content's own bindings are set for the first time; `ngAfterContentChecked` runs after every check of that content.

```typescript
@Component({
  selector: 'app-tab-group',
  standalone: true,
  template: `<ng-content></ng-content>`,
})
export class TabGroupComponent implements AfterContentInit {
  @ContentChildren(TabComponent) tabs!: QueryList<TabComponent>;

  ngAfterContentInit() {
    // Safe to read this.tabs here — projected content is initialized
    const active = this.tabs.find(t => t.active);
    console.log('active tab:', active?.title);
  }
}
```

**Use cases:** read/react to `@ContentChild`/`@ContentChildren` query results (e.g., a `TabGroupComponent` finding its projected `TabComponent`s and activating the first one).

**Pitfalls:** reading `@ContentChild` results **before** this hook (e.g., in `ngOnInit`) returns `undefined` — projected content isn't resolved yet at that point.

---

## 7. ngAfterViewInit / ngAfterViewChecked

Fire after Angular fully initializes the component's **own template view**, including any child components declared in that template. `ngAfterViewInit` runs once; `ngAfterViewChecked` on every check.

```typescript
@Component({
  selector: 'app-search-box',
  standalone: true,
  template: `<input #searchInput type="text" />`,
})
export class SearchBoxComponent implements AfterViewInit {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  ngAfterViewInit() {
    this.searchInput.nativeElement.focus(); // DOM element now exists
  }
}
```

**Use cases:** reading `@ViewChild`/`@ViewChildren` results, focusing a DOM element, measuring an element's size, integrating a third-party DOM library that needs the rendered DOM.

**Pitfalls:**
- Reading `@ViewChild` in `ngOnInit` returns `undefined` — the view doesn't exist yet.
- **Never mutate a bound `@Input()` of a child component from `ngAfterViewInit`** without wrapping it — doing so can trigger `ExpressionChangedAfterItHasBeenCheckedError` in dev mode because you're changing a value Angular already checked this cycle. Defer with a signal/`Promise.resolve().then()` or, better, restructure so the parent sets the value before the child view is checked.

---

## 8. ngOnDestroy

Fires **once**, immediately before Angular removes the component from the DOM (route navigation away, `*ngIf` becoming false, parent destroyed, etc.). This is the required cleanup hook.

```typescript
export class LiveTickerComponent implements OnInit, OnDestroy {
  private sub?: Subscription;
  private intervalId?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.sub = this.priceFeed.prices$.subscribe(p => this.updatePrice(p));
    this.intervalId = setInterval(() => this.refresh(), 5000);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    clearInterval(this.intervalId);
  }

  updatePrice(p: number) {}
  refresh() {}
}
```

**Use cases:** unsubscribe from RxJS `Observable`s that don't complete on their own, clear `setInterval`/`setTimeout` timers, detach event listeners added manually, close WebSocket connections, disconnect a `ResizeObserver`/`IntersectionObserver`.

**Pitfalls:** forgetting to unsubscribe is the single most common source of Angular memory leaks — every manual `.subscribe()` call needs a matching cleanup unless you used `async` pipe (which unsubscribes automatically) or `takeUntilDestroyed()`.

```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export class LiveTickerComponent {
  constructor(private priceFeed: PriceFeedService) {
    this.priceFeed.prices$
      .pipe(takeUntilDestroyed())
      .subscribe(p => this.updatePrice(p));
  }
  updatePrice(p: number) {}
}
```

---

## 9. Parent/Child Execution Order

Angular initializes children before finishing the parent's "after view" hooks, but a parent's `ngOnInit` still runs before its children's `ngOnInit` — because the parent's constructor and input-binding happen first, then Angular walks down to construct and initialize children as it builds the view.

```
ParentComponent constructor
ParentComponent ngOnChanges
ParentComponent ngOnInit
ParentComponent ngDoCheck
  ChildComponent constructor
  ChildComponent ngOnChanges
  ChildComponent ngOnInit
  ChildComponent ngDoCheck
  ChildComponent ngAfterContentInit
  ChildComponent ngAfterContentChecked
  ChildComponent ngAfterViewInit
  ChildComponent ngAfterViewChecked
ParentComponent ngAfterContentInit
ParentComponent ngAfterContentChecked
ParentComponent ngAfterViewInit    ← only now, after ALL children's view hooks
ParentComponent ngAfterViewChecked
```

The key takeaway: **`ngAfterViewInit` of a parent fires only after every child's full lifecycle (including its own `ngAfterViewInit`) has completed** — this is exactly why `@ViewChild` results are reliably available in the parent's `ngAfterViewInit`, not before.

---

## 10. Hands-On Exercises

**Exercise 1:** Build a component with an `@Input() count: number` and implement `ngOnChanges`. Log `changes['count'].previousValue` and `changes['count'].currentValue` from the parent template, and verify `firstChange` is `true` only on the very first binding.

**Exercise 2:** Implement `ngDoCheck` on a component that receives an `@Input() items: string[]`. From the parent, push a new item into the array **without** reassigning it (`this.items.push(x)`), and confirm `ngOnChanges` does NOT fire but `ngDoCheck` does — then add logic in `ngDoCheck` to detect the length change.

**Exercise 3:** Build a `TabGroupComponent` that projects `<app-tab>` children via `<ng-content>`, uses `@ContentChildren(TabComponent)` to collect them, and in `ngAfterContentInit` sets the first tab as active.

**Exercise 4:** Build a `SearchBoxComponent` with a template-referenced `<input #box>`, use `@ViewChild('box')`, and call `.nativeElement.focus()` in `ngAfterViewInit`. Verify it does NOT work if called from `ngOnInit` instead.

**Exercise 5:** Create a component that subscribes to an interval-based `Observable` in `ngOnInit` without unsubscribing. Add a button in the parent that toggles the component with `@if`. Use the browser's memory profiler (or just a console log counter) to observe the subscription keeps firing after the component is removed — then fix it with `ngOnDestroy` and `takeUntilDestroyed()`.

---

## 11. Interview Q&A

**Q: What is the correct order of Angular's lifecycle hooks?**
Answer: `ngOnChanges` → `ngOnInit` → `ngDoCheck` → `ngAfterContentInit` → `ngAfterContentChecked` → `ngAfterViewInit` → `ngAfterViewChecked` → (repeat `ngDoCheck`/`ngAfterContentChecked`/`ngAfterViewChecked` on every change detection cycle) → `ngOnDestroy` once at removal. `ngOnChanges` and `ngOnInit` only run for components with bound inputs / once respectively; the "checked" hooks run on every CD pass.

**Q: Why would you use `ngOnInit` instead of putting initialization code in the constructor?**
Answer: The constructor only runs dependency injection — `@Input()` bindings are not yet set when the constructor executes. `ngOnInit` runs after Angular sets the first round of inputs, so it's the safe place to use input values, make initial API calls, or set up subscriptions that depend on them.

**Q: When would `ngDoCheck` fire but not `ngOnChanges`?**
Answer: `ngOnChanges` only fires when Angular detects a new *reference* for a bound `@Input()`. If you mutate an object or array in place (e.g., `array.push()`) without reassigning it, the reference stays the same, so `ngOnChanges` never fires — but `ngDoCheck` still runs on every change detection cycle regardless, letting you implement custom deep-comparison logic to catch such mutations.

**Q: Why is `ngOnDestroy` important, and what commonly goes in it?**
Answer: `ngOnDestroy` is Angular's only cleanup hook, called right before a component is removed. Anything that keeps a live reference outside the component's lifetime — RxJS subscriptions not managed by the `async` pipe, `setInterval`/`setTimeout` timers, manually-attached DOM/window event listeners, `ResizeObserver`/`IntersectionObserver` instances, WebSocket connections — must be torn down here or the app leaks memory and keeps doing wasted work.

**Q: Why does a parent's `ngAfterViewInit` fire after a child's `ngAfterViewInit`, not before?**
Answer: Angular builds the component tree top-down for construction/inputs but bottom-up for "view ready" signaling: a parent's view isn't fully initialized until all of its children's views are. So each child completes its entire view-related lifecycle (`ngAfterViewInit`/`ngAfterViewChecked`) before the parent's `ngAfterViewInit` fires — which is exactly why `@ViewChild` references to children are guaranteed to be populated by the time the parent's `ngAfterViewInit` runs.
