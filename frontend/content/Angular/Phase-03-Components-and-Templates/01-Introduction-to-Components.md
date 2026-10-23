# Introduction to Components (Standalone)

Components are the fundamental building blocks of an Angular application. They control a patch of screen called a **view**. 

In modern Angular (v14+ and especially v17+), we use **Standalone Components**. This means the component manages its own dependencies without needing an `NgModule`.

## 1. Anatomy of a Component

A component consists of three main parts:
1. A TypeScript class containing the logic and state.
2. An HTML template determining the UI.
3. A CSS/SCSS file for component-specific styles.

Here is a basic Standalone component:

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-user-card',
  standalone: true, // This makes it standalone!
  imports: [], // Dependencies go here (other components, pipes, directives)
  templateUrl: './user-card.component.html',
  styleUrls: ['./user-card.component.css']
})
export class UserCardComponent {
  // 1. State
  userName: string = 'John Doe';
  role: string = 'Admin';

  // 2. Logic (Methods)
  changeName(newName: string) {
    this.userName = newName;
  }
}
```

## 2. The `@Component` Decorator Metadata

The `@Component` decorator tells Angular that the class immediately below it is a component, and provides configuration metadata:

- **`selector`**: The CSS selector that tells Angular to instantiate this component wherever it finds this tag in parent HTML. If the selector is `app-user-card`, you use it like `<app-user-card></app-user-card>`.
- **`standalone`**: Must be `true` for modern Angular.
- **`imports`**: If your template uses other components, directives (like `NgClass`), or pipes (like `DatePipe`), you must import them here.
- **`templateUrl` / `template`**: The HTML for the component. You can use `template` for inline HTML, but `templateUrl` pointing to a separate file is standard.
- **`styleUrls` / `styles`**: The CSS for the component. Styles defined here are **encapsulated** — they will not leak out and affect the rest of the application.

## 3. Using a Component inside another

Because Standalone Components manage their own dependencies, using `UserCardComponent` inside `AppComponent` is very straightforward.

**app.component.ts**:
```typescript
import { Component } from '@angular/core';
import { UserCardComponent } from './user-card/user-card.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [UserCardComponent], // <--- Import it here!
  template: `
    <main>
      <h1>My Application</h1>
      <app-user-card></app-user-card> <!-- Use it here! -->
    </main>
  `
})
export class AppComponent {}
```

## 4. Lifecycle Hooks (Briefly)

Components have a lifecycle managed by Angular. Angular creates it, renders it, creates and renders its children, checks it when data-bound properties change, and destroys it before removing it from the DOM.

You can tap into these events by implementing lifecycle hook interfaces:

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({ ... })
export class MyComponent implements OnInit, OnDestroy {
  
  // Called once, after Angular has initialized all data-bound properties
  // This is where you should fetch data from APIs!
  ngOnInit() {
    console.log('Component initialized');
  }

  // Called just before Angular destroys the component.
  // Use this to unsubscribe from Observables and detach event handlers to avoid memory leaks.
  ngOnDestroy() {
    console.log('Component destroyed');
  }
}
```

---
Next, we will look at how to bind data from the class to the template, and how to handle user events.
