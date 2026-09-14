# Custom Directives — Complete Guide

## Table of Contents
1. [Why Write a Custom Directive?](#1-why-write-a-custom-directive)
2. [Custom Attribute Directives](#2-custom-attribute-directives)
3. [Worked Example: Highlight-on-Hover Directive](#3-worked-example-highlight-on-hover-directive)
4. [Custom Structural Directives](#4-custom-structural-directives)
5. [Worked Example: appUnless Structural Directive](#5-worked-example-appunless-structural-directive)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Write a Custom Directive?

Reach for a custom directive whenever you find yourself repeating the same DOM manipulation, event-listener, or conditional-rendering logic across many components. Directives let you package that behavior once and apply it declaratively with an attribute:

```
Without a directive:                    With a directive:
  Every component wires up its own        <p appHighlight>Hover me</p>
  (mouseenter)/(mouseleave) handlers       <p appHighlight color="yellow">Hover me</p>
  and manually sets styles. Repeated       One line, reusable everywhere.
  in every template that needs it.
```

Two categories:
- **Attribute directives** — change appearance/behavior of an existing element (`NgClass`, `NgStyle`, your own `appHighlight`).
- **Structural directives** — change DOM structure by adding/removing elements (`NgIf`, `NgFor`, your own `appUnless`).

---

## 2. Custom Attribute Directives

An attribute directive is a class decorated with `@Directive`, using `@HostListener` to react to DOM events and `@HostBinding` to bind to host element properties, plus `@Input` to accept configuration.

```typescript
import { Directive, HostListener, HostBinding, Input } from '@angular/core';

@Directive({
  selector: '[appHighlight]',
  standalone: true,
})
export class HighlightDirective {
  @Input('appHighlight') highlightColor = '';
  @Input() defaultColor = 'lightyellow';

  @HostBinding('style.backgroundColor') backgroundColor = '';

  @HostListener('mouseenter')
  onMouseEnter() {
    this.backgroundColor = this.highlightColor || this.defaultColor;
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.backgroundColor = '';
  }
}
```

Key building blocks:

| Decorator | Purpose |
|-----------|---------|
| `@Directive({ selector: '[appHighlight]' })` | Attribute selector — matches elements with the `appHighlight` attribute, unlike component selectors which match element tags |
| `@Input()` | Accepts configuration from the host template, e.g. `[appHighlight]="'orange'"` |
| `@HostBinding('style.x')` / `@HostBinding('class.x')` | Binds a directive property to a property/attribute/class of the host element |
| `@HostListener('event')` | Subscribes to a DOM event on the host element and runs a method when it fires |

`selector: '[appHighlight]'` — the square brackets mean "match on attribute," not element tag. This lets the directive attach to any element: `<p appHighlight>`, `<div appHighlight>`, `<span appHighlight>`.

---

## 3. Worked Example: Highlight-on-Hover Directive

Full directive with a configurable color, plus usage:

```typescript
// highlight.directive.ts
import { Directive, HostListener, HostBinding, Input } from '@angular/core';

@Directive({
  selector: '[appHighlight]',
  standalone: true,
})
export class HighlightDirective {
  /** Usage: <p [appHighlight]="'lightblue'"> */
  @Input('appHighlight') highlightColor = '';
  @Input() defaultColor = 'lightyellow';

  @HostBinding('style.backgroundColor') backgroundColor = '';
  @HostBinding('style.transition') transition = 'background-color 0.2s ease-in';

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.backgroundColor = this.highlightColor || this.defaultColor;
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.backgroundColor = '';
  }
}
```

```typescript
// app.component.ts
import { Component } from '@angular/core';
import { HighlightDirective } from './highlight.directive';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HighlightDirective],
  template: `
    <p appHighlight>Default yellow highlight on hover</p>
    <p [appHighlight]="'lightgreen'">Custom green highlight on hover</p>
    <p appHighlight defaultColor="lightcoral">Custom default via separate input</p>
  `,
})
export class AppComponent {}
```

Notice `@Input('appHighlight')` aliases the input to the same name as the selector — this is the standard Angular pattern (see `NgClass`, `RouterLink`) that lets you configure the directive with the same attribute you used to apply it: `[appHighlight]="'lightgreen'"` both attaches the directive and passes the color in one binding.

A quick auto-focus directive shows the same pattern applied to lifecycle instead of events:

```typescript
import { Directive, ElementRef, AfterViewInit } from '@angular/core';

@Directive({
  selector: '[appAutofocus]',
  standalone: true,
})
export class AutofocusDirective implements AfterViewInit {
  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.el.nativeElement.focus();
  }
}
```

```html
<input appAutofocus placeholder="Focused automatically on load" />
```

`ElementRef` gives direct access to the host's native DOM node — useful for imperative operations like `.focus()` that have no declarative host-binding equivalent. Prefer `@HostBinding`/`@HostListener` over direct `ElementRef` manipulation wherever possible, since direct DOM writes bypass Angular's rendering abstraction and can break under server-side rendering.

---

## 4. Custom Structural Directives

A structural directive controls whether and how a chunk of template is rendered. It works with two collaborators injected via the constructor:

| Injected type | Role |
|---------------|------|
| `TemplateRef<T>` | A reference to the `<ng-template>` content the directive is attached to — the "blueprint" to stamp out |
| `ViewContainerRef` | The place in the DOM where the directive can insert or clear views |

```typescript
import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[appUnless]',
  standalone: true,
})
export class UnlessDirective {
  private hasView = false;

  constructor(
    private templateRef: TemplateRef<unknown>,
    private viewContainer: ViewContainerRef,
  ) {}

  @Input() set appUnless(condition: boolean) {
    if (!condition && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (condition && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
```

When Angular sees `*appUnless="cond"` on an element, it desugars it exactly like `*ngIf`:

```html
<!-- What you write -->
<p *appUnless="isLoggedIn">You are not logged in.</p>

<!-- What Angular actually compiles -->
<ng-template [appUnless]="isLoggedIn">
  <p>You are not logged in.</p>
</ng-template>
```

`TemplateRef` becomes a reference to that `<ng-template>`'s content, and `ViewContainerRef.createEmbeddedView()` stamps it into the DOM at that location; `.clear()` removes it.

---

## 5. Worked Example: appUnless Structural Directive

Complete directive plus a component using it as the inverse of `*ngIf`:

```typescript
// unless.directive.ts
import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[appUnless]',
  standalone: true,
})
export class UnlessDirective {
  private hasView = false;

  constructor(
    private templateRef: TemplateRef<unknown>,
    private viewContainer: ViewContainerRef,
  ) {}

  @Input() set appUnless(condition: boolean) {
    if (!condition && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (condition && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
```

```typescript
// app.component.ts
import { Component, signal } from '@angular/core';
import { UnlessDirective } from './unless.directive';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [UnlessDirective],
  template: `
    <button (click)="isLoggedIn.set(!isLoggedIn())">Toggle login</button>

    <p *appUnless="isLoggedIn()">You must log in to see this content.</p>
    <p *appUnless="!isLoggedIn()">Welcome back!</p>
  `,
})
export class AppComponent {
  isLoggedIn = signal(false);
}
```

This mirrors `*ngIf` but inverted — a good exercise for understanding how `NgIf` itself must be implemented, since Angular's own source for `NgIf` follows this exact `TemplateRef`/`ViewContainerRef` pattern.

---

## 6. Hands-On Exercises

**Exercise 1:** Build the `HighlightDirective` from Section 3 from scratch and apply it to three `<p>` elements with three different colors passed via `[appHighlight]`.

**Exercise 2:** Extend `HighlightDirective` to also add a `box-shadow` on hover using a second `@HostBinding`, and a `@HostListener('click')` that logs the current color to the console.

**Exercise 3:** Build `AutofocusDirective` and use it on a login form's username `<input>` so it's focused automatically when the form renders.

**Exercise 4:** Build the `UnlessDirective` from Section 5 and use it alongside `*ngIf` on sibling elements (in separate `<ng-container>`s) to show/hide a "logged in" vs "logged out" message.

**Exercise 5:** Write a structural directive `appRepeat` that takes a number `n` via `*appRepeat="5"` and renders its host template `n` times, using `createEmbeddedView` in a loop with a context object exposing `$implicit` as the current index.

---

## 7. Interview Q&A

**Q: What's the difference between `@HostBinding` and `@HostListener`?**
Answer: `@HostBinding('property')` binds a directive class property to a property, attribute, class, or style of the host element — Angular writes to the DOM whenever that class property changes. `@HostListener('event')` does the reverse — it subscribes to a DOM event on the host element and invokes the decorated method when that event fires. Together they let a directive both react to and modify its host element without touching the DOM directly.

**Q: Why does a custom structural directive need both `TemplateRef` and `ViewContainerRef`?**
Answer: `TemplateRef` is a reference to the `<ng-template>` content the directive is attached to — essentially a compiled blueprint that hasn't been rendered yet. `ViewContainerRef` represents a location in the DOM where views can be created or destroyed. The directive uses `viewContainer.createEmbeddedView(templateRef)` to instantiate the template's content into the DOM, and `viewContainer.clear()` to remove it — neither object alone is sufficient; you need the "what" (template) and the "where" (container).

**Q: What does `*appUnless="cond"` desugar to?**
Answer: Just like `*ngIf`, it desugars to `<ng-template [appUnless]="cond"><!-- original element --></ng-template>`. The directive is applied to the `<ng-template>`, not the element inside it, and it decides whether to instantiate that template's embedded view based on the input value.

**Q: Why prefer `@HostBinding`/`@HostListener` over injecting `ElementRef` and manipulating the DOM directly?**
Answer: `ElementRef` gives raw access to the native DOM node, so setting styles or attributes directly bypasses Angular's rendering pipeline and change detection. This breaks under server-side rendering (no real DOM exists) and web workers, and it's harder for Angular to optimize or sanitize. `@HostBinding`/`@HostListener` keep the directive declarative and let Angular manage the actual DOM writes, which is safer and more portable. `ElementRef` is acceptable for operations with no declarative equivalent, like calling `.focus()`.

**Q: Can a single host element have multiple attribute directives but only one structural directive (pre-Angular 17 syntax)?**
Answer: Yes. Attribute directives just add behavior/bindings to an existing element, so you can stack many: `<div appHighlight appTooltip appDraggable>`. A structural directive with `*` syntax desugars to wrapping the element in an `<ng-template>`, and you can't wrap the same element in two different `<ng-template>`s simultaneously — so only one `*` directive is allowed per element; combining two requires nesting via `<ng-container>`.
