# Hierarchical Dependency Injection — Complete Guide

## Table of Contents
1. [Why Hierarchical DI Exists](#1-why-hierarchical-di-exists)
2. [The Injector Tree](#2-the-injector-tree)
3. [Root Injector](#3-root-injector)
4. [Environment/Module Injector](#4-environmentmodule-injector)
5. [Element Injector](#5-element-injector)
6. [How Resolution Walks Up the Tree](#6-how-resolution-walks-up-the-tree)
7. [Overriding Parent Providers in a Child Injector](#7-overriding-parent-providers-in-a-child-injector)
8. [@Optional, @Self, @SkipSelf](#8-optional-self-skipself)
9. [Worked Example: Per-Tab State with Component-Scoped Services](#9-worked-example-per-tab-state-with-component-scoped-services)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Why Hierarchical DI Exists

If Angular only had one global injector, every service would be forced into a single application-wide instance — there'd be no way to give each open tab, each modal, or each row in a list its own private copy of a stateful service. Hierarchical DI solves this by letting the injector itself mirror the **component tree**: every component can optionally spin up its own child injector, scoped to itself and its descendants.

```
Without hierarchy:                  With hierarchy:
  ONE injector for everything          Injector per component subtree
  ONE instance of CartService          Independent CartService per <app-cart-tab>
  All tabs share state (bug!)          Each tab has isolated state (correct)
```

---

## 2. The Injector Tree

Angular builds a **tree of injectors** that parallels the component tree. Every injector (except the root) has exactly one parent, and a lookup that misses locally walks up toward the root.

```
                    ┌─────────────────────┐
                    │    Root Injector     │  ← providedIn: 'root' services live here
                    │  (Platform + App)    │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Environment Injector │  ← lazy-loaded route providers
                    │   (per lazy route)     │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                                 │
     ┌────────▼────────┐              ┌─────────▼────────┐
     │  Element Injector │              │  Element Injector │
     │  AppComponent      │              │  (other branch)    │
     └────────┬───────────┘              └────────────────────┘
              │
     ┌────────▼─────────────┐
     │   Element Injector     │  ← component `providers: []` creates this
     │   TabComponent          │
     └────────┬───────────────┘
              │
     ┌────────▼─────────────┐
     │   Element Injector     │  ← child components inherit parent's injector
     │   TabContentComponent   │     unless they declare their own providers
     └────────────────────────┘
```

Three tiers matter in practice: the **root injector**, **environment injectors** (module/route level), and **element injectors** (component level).

---

## 3. Root Injector

The root injector is created once when the app bootstraps. Anything registered with `@Injectable({ providedIn: 'root' })`, or listed in the `providers` array passed to `bootstrapApplication()`, lives here.

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig);
```

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    { provide: APP_CONFIG, useValue: { apiUrl: 'https://api.example.com' } }
  ]
};
```

Everything here is a true application-wide singleton — one instance shared by the whole app for its entire lifetime.

---

## 4. Environment/Module Injector

When a feature is **lazy-loaded** via the router, Angular creates a new environment injector scoped to that lazy-loaded chunk. Providers declared on a route's config are registered here — visible to that route's component tree, but not to the rest of the app.

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes'),
    providers: [
      { provide: FEATURE_SCOPE, useValue: 'admin' } // only visible inside /admin
    ]
  }
];
```

Any service or component under `/admin` can inject `FEATURE_SCOPE` and get `'admin'`. Code outside that lazy chunk cannot see this provider at all — it doesn't exist for them, not even as an override.

---

## 5. Element Injector

Every component (and directive) instance gets its own **element injector**. Most of the time it's empty and just forwards lookups to its parent — but as soon as a component declares a `providers` array, Angular populates that component's element injector with fresh instances of those services.

```typescript
@Component({
  selector: 'app-cart-tab',
  standalone: true,
  providers: [CartService], // this component's element injector gets its own CartService
  template: `<app-cart-summary />`
})
export class CartTabComponent {}
```

`CartTabComponent` and everything nested inside its template (like `<app-cart-summary>`) share this same `CartService` instance — but a sibling `<app-cart-tab>` elsewhere in the tree gets its own, separate instance.

---

## 6. How Resolution Walks Up the Tree

When a component asks for a dependency, Angular searches injectors starting at that component's own element injector and walking outward toward the root, stopping at the first injector that has a matching provider.

```
Lookup for CartService from <app-cart-summary>:

  1. app-cart-summary's element injector   → no provider for CartService, keep looking
  2. app-cart-tab's element injector       → HAS CartService provider → STOP, use this instance
  3. (root injector never reached)
```

If no injector in the chain has a provider and the token wasn't declared with `providedIn: 'root'`, Angular throws `NullInjectorError: No provider for X`.

---

## 7. Overriding Parent Providers in a Child Injector

Because resolution stops at the **first** matching provider, a child injector can shadow — completely replace — whatever the parent provides, without touching the parent's registration.

```typescript
@Injectable({ providedIn: 'root' })
export class ThemeService {
  currentTheme = 'light';
}

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  // shadows the root ThemeService — everything inside app-admin-panel
  // gets THIS instance instead of the app-wide one
  providers: [{ provide: ThemeService, useValue: { currentTheme: 'dark' } }],
  template: `<app-panel-header />`
})
export class AdminPanelComponent {}
```

`<app-panel-header>`, nested inside `<app-admin-panel>`, injects `ThemeService` and receives the dark-themed override — while every other component in the app still sees the root `ThemeService` with `currentTheme: 'light'`. This is the mechanism that makes per-section theming, per-tab state, and testing overrides all possible without any conditional logic inside the service itself.

---

## 8. @Optional, @Self, @SkipSelf

These parameter decorators fine-tune exactly *where* in the injector chain a dependency is allowed to resolve from.

### @Optional — don't throw if missing

```typescript
import { Optional } from '@angular/core';

@Component({ selector: 'app-widget', standalone: true, template: `...` })
export class WidgetComponent {
  constructor(@Optional() private analytics: AnalyticsService | null) {
    // if AnalyticsService has no provider anywhere, `analytics` is null
    // instead of Angular throwing NullInjectorError
    this.analytics?.track('widget_viewed');
  }
}
```

### @Self — only look in this component's own element injector

```typescript
import { Self } from '@angular/core';

@Component({
  selector: 'app-tab',
  standalone: true,
  providers: [TabStateService],
  template: `...`
})
export class TabComponent {
  // requires TabStateService to be provided directly on THIS component;
  // will NOT walk up to a parent or root provider, even if one exists
  constructor(@Self() private tabState: TabStateService) {}
}
```

### @SkipSelf — skip this component's own injector, start at the parent

```typescript
import { SkipSelf } from '@angular/core';

@Component({
  selector: 'app-tab-content',
  standalone: true,
  template: `...`
})
export class TabContentComponent {
  // ignores any TabStateService provided on app-tab-content itself
  // (there isn't one here, but the point is it would be skipped)
  // and grabs the one from the parent app-tab component instead
  constructor(@SkipSelf() private tabState: TabStateService) {}
}
```

`@SkipSelf` is most useful for structural/control-flow directives that need to explicitly reach past their own host element and grab a service the parent supplied — Angular's own `ControlContainer` (used by nested `NgForm`/`FormGroupName`) relies on this pattern.

These can combine: `@Optional() @Self()` means "look only in this component's own injector, and return `null` instead of throwing if nothing's registered there."

---

## 9. Worked Example: Per-Tab State with Component-Scoped Services

A tab container where each tab keeps its own draft-editing state, isolated from sibling tabs, using an element-injector-scoped service.

```typescript
// tab-state.service.ts
import { Injectable } from '@angular/core';

@Injectable() // NOTE: no providedIn — must be explicitly provided per component
export class TabStateService {
  private draftText = '';
  private isDirty = false;

  setDraft(text: string): void {
    this.draftText = text;
    this.isDirty = true;
  }

  getDraft(): string {
    return this.draftText;
  }

  hasUnsavedChanges(): boolean {
    return this.isDirty;
  }

  save(): void {
    this.isDirty = false;
  }
}
```

```typescript
// tab.component.ts
import { Component, inject } from '@angular/core';
import { TabStateService } from './tab-state.service';
import { TabEditorComponent } from './tab-editor.component';

@Component({
  selector: 'app-tab',
  standalone: true,
  imports: [TabEditorComponent],
  providers: [TabStateService], // fresh instance for EACH <app-tab>
  template: `
    <div class="tab" [class.dirty]="tabState.hasUnsavedChanges()">
      <app-tab-editor />
    </div>
  `
})
export class TabComponent {
  tabState = inject(TabStateService);
}
```

```typescript
// tab-editor.component.ts
import { Component, inject } from '@angular/core';
import { TabStateService } from './tab-state.service';

@Component({
  selector: 'app-tab-editor',
  standalone: true,
  template: `
    <textarea
      [value]="tabState.getDraft()"
      (input)="tabState.setDraft($any($event.target).value)">
    </textarea>
    <button (click)="tabState.save()">Save</button>
  `
})
export class TabEditorComponent {
  // no providers array here — inherits TabComponent's TabStateService
  // by walking up to the nearest ancestor element injector that has one
  tabState = inject(TabStateService);
}
```

```typescript
// tab-container.component.ts
import { Component } from '@angular/core';
import { TabComponent } from './tab.component';

@Component({
  selector: 'app-tab-container',
  standalone: true,
  imports: [TabComponent],
  template: `
    <app-tab /> <!-- own TabStateService instance -->
    <app-tab /> <!-- separate, independent TabStateService instance -->
    <app-tab /> <!-- separate, independent TabStateService instance -->
  `
})
export class TabContainerComponent {}
```

Each `<app-tab>` creates its own element injector holding its own `TabStateService`. Typing in one tab's `<textarea>` never affects another tab's draft — no manual keying by tab ID, no shared root-level map of `{ tabId: state }` to manage. `TabEditorComponent` (a child of `TabComponent`) resolves `TabStateService` by walking up one level to its parent's element injector, per the resolution rule from Section 6.

---

## 10. Hands-On Exercises

**Exercise 1:** Draw (as a comment block, ASCII is fine) the injector tree for an app with a root `AuthService` (`providedIn: 'root'`), a lazy-loaded `/reports` route providing a `ReportContextService`, and a `ChartWidgetComponent` used three times inside a report page, each providing its own `ChartStateService`.

**Exercise 2:** Build a `ThemeService` provided at root with `currentTheme = 'light'`. Create an `AdminSectionComponent` that overrides it locally to `'dark'` via `providers: [{ provide: ThemeService, useValue: {...} }]`. Confirm components outside `AdminSectionComponent` still see `'light'`.

**Exercise 3:** Add `@Optional()` to a component's constructor injection of a service that is deliberately NOT provided anywhere. Confirm the app doesn't crash and the injected value is `null`.

**Exercise 4:** Recreate the per-tab state example from Section 9. Add a fourth tab, type different text into each, and verify (via browser dev tools or console logs) that all four `TabStateService` instances hold independent draft text.

**Exercise 5:** Modify `TabEditorComponent` from Section 9 to use `@SkipSelf()` on its `TabStateService` injection even though it has no local provider — confirm the app behaves identically, then explain in a comment why `@SkipSelf` made no observable difference here.

---

## 11. Interview Q&A

**Q: What are the three main levels of Angular's injector hierarchy?**
Answer: The root injector (application-wide singletons, `providedIn: 'root'` and app-level `bootstrapApplication` providers), environment injectors (created per lazy-loaded route, scoping providers to that feature), and element injectors (created per component instance when a component declares its own `providers` array, scoping a service to that component and its descendants).

**Q: How does Angular resolve a dependency when multiple injectors in the tree could provide it?**
Answer: Angular starts at the requesting component's own element injector and walks up the tree — parent element injector, then environment injector, then root — stopping at the very first injector that has a matching provider. This means a child's provider always shadows a parent's/root's provider of the same token; the search never continues past the first match.

**Q: What problem does providing a service at the component level solve that providedIn: 'root' can't?**
Answer: `providedIn: 'root'` always yields exactly one shared instance app-wide, which is wrong whenever different parts of the UI need isolated state — for example, per-tab draft text, per-row selection state, or per-modal form state. Declaring the service in a component's `providers` array creates a new instance per component instance, scoped to that subtree and destroyed with the component, giving each instance its own private state.

**Q: What do @Optional, @Self, and @SkipSelf do?**
Answer: `@Optional()` tells Angular to return `null` instead of throwing `NullInjectorError` if no provider is found anywhere in the chain. `@Self()` restricts the lookup to only the requesting component's own element injector, ignoring parents entirely (throws if not found there). `@SkipSelf()` does the opposite — it skips the requesting component's own injector and starts the search at the parent, useful when a component must explicitly defer to an ancestor's instance of a service.

**Q: Give a concrete example of when you'd need @SkipSelf in a real Angular app.**
Answer: Angular's own forms module uses this pattern internally — a nested `NgModelGroup`/`FormGroupName` needs to attach itself to the parent form's `ControlContainer` rather than creating its own, so it injects `ControlContainer` with `@SkipSelf()` to explicitly reach past its own element and bind to the ancestor form group. More generally, any component that must compose into a parent-managed structure (nested menus, wizard steps sharing one wizard-level state) rather than starting a fresh scope of its own is a candidate for `@SkipSelf`.
