# Component Communication

Components rarely exist in isolation. They form a tree, and data needs to flow up and down that tree.

## 1. Parent to Child: `@Input()`

To pass data from a parent component down to a child component, the child uses the `@Input()` decorator.

**Child Component (user-detail.component.ts)**
```typescript
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  template: `<p>Name: {{ name }}, Age: {{ age }}</p>`
})
export class UserDetailComponent {
  // We expect the parent to provide these values
  @Input({ required: true }) name!: string; 
  @Input() age: number = 0; // default value if not provided
}
```

**Parent Component (app.component.html)**
```html
<!-- Property binding `[name]` passes the `userName` variable to the child's `@Input() name` -->
<app-user-detail 
  [name]="userName" 
  [age]="25">
</app-user-detail>
```

### 1.1 Modern Angular v17+: `input()` Signals
In the newest versions of Angular, `@Input()` decorators are being replaced by Signal inputs, which are much more powerful for reactivity:

```typescript
import { Component, input } from '@angular/core';

@Component({ ... })
export class UserDetailComponent {
  // This creates an InputSignal
  name = input.required<string>();
  age = input<number>(0); 
  
  // Usage in TS requires calling it like a function: this.name()
}
```
*(In the HTML template, you still bind exactly the same way!)*

## 2. Child to Parent: `@Output()` and `EventEmitter`

To send data from a child *up* to its parent, the child emits an event.

**Child Component (delete-button.component.ts)**
```typescript
import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-delete-button',
  standalone: true,
  template: `<button (click)="onDeleteClick()">Delete</button>`
})
export class DeleteButtonComponent {
  // Create an EventEmitter that emits a number (e.g., an ID)
  @Output() itemDeleted = new EventEmitter<number>();

  onDeleteClick() {
    const idToDelete = 42;
    // Emit the event!
    this.itemDeleted.emit(idToDelete);
  }
}
```

**Parent Component (app.component.html)**
```html
<!-- Listen to the `(itemDeleted)` event, and call the parent's `handleDeletion` method, passing the emitted data using `$event` -->
<app-delete-button (itemDeleted)="handleDeletion($event)"></app-delete-button>
```

## 3. Advanced Communication

If components are NOT in a direct parent-child relationship (e.g., deeply nested children, or sibling components), using Inputs and Outputs becomes tedious (prop-drilling).

In those cases, you use a **Service** to share data and state. We will cover this in Phase 05.
