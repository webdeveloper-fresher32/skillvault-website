# Data Binding & Control Flow

Angular templates use a specific syntax to connect the TypeScript class logic to the HTML view. 

## 1. Data Binding Types

There are four main ways to bind data in Angular:

### Interpolation: `{{ value }}` (Class -> DOM)
Used to display text in the HTML based on a variable in your component.

```html
<!-- If userName is "Alice" in TS, this renders as "Hello Alice" -->
<h1>Hello {{ userName }}</h1>

<!-- You can do simple expressions -->
<p>Total: {{ price * quantity }}</p>
```

### Property Binding: `[property]="value"` (Class -> DOM)
Used to set properties of HTML elements or custom components. 

```html
<!-- Disables the button if the 'isFormInvalid' variable is true -->
<button [disabled]="isFormInvalid">Submit</button>

<!-- Binds the image source -->
<img [src]="userProfileImage" alt="Profile">

<!-- Setting a class dynamically (there are other ways, but this works) -->
<div [className]="statusClass">...</div>
```

### Event Binding: `(event)="handler()"` (DOM -> Class)
Used to listen to DOM events (clicks, keypresses) or custom events from child components.

```html
<!-- Calls the 'saveData()' method in TS when clicked -->
<button (click)="saveData()">Save</button>

<!-- Passing the event object to the handler -->
<input type="text" (input)="onSearch($event)">
```

### Two-Way Binding: `[(ngModel)]="value"` (Class <-> DOM)
Combines property binding and event binding. Mostly used in Forms. You need to import `FormsModule` to use it.

```html
<!-- As the user types, 'searchTerm' updates in TS. 
     If 'searchTerm' updates in TS, the input value changes. -->
<input type="text" [(ngModel)]="searchTerm">
```
*(Mnemonic: "Banana in a box" `[()]`)*

---

## 2. Modern Control Flow (Angular v17+)

In Angular v17, a new, highly performant control flow syntax was introduced built directly into the framework. It replaces the old structural directives (`*ngIf`, `*ngFor`, `*ngSwitch`).

### Conditional Rendering: `@if`

```html
@if (isLoggedIn) {
  <user-dashboard></user-dashboard>
} @else if (isGuest) {
  <guest-view></guest-view>
} @else {
  <login-form></login-form>
}
```

### Iteration: `@for`

The `@for` block requires a `track` expression. This is crucial for performance—it tells Angular how to identify individual items so it can update the DOM efficiently without re-rendering the whole list.

```html
<ul>
  @for (user of users; track user.id) {
    <li>{{ user.name }}</li>
  } @empty {
    <li>No users found.</li>
  }
</ul>
```
*Notice the `@empty` block! It renders automatically if the array is empty.*

### Switch statements: `@switch`

```html
@switch (userRole) {
  @case ('ADMIN') {
    <admin-panel></admin-panel>
  }
  @case ('USER') {
    <user-dashboard></user-dashboard>
  }
  @default {
    <p>Unauthorized access</p>
  }
}
```

*(Note: In older codebases, you will see `<div *ngIf="isLoggedIn">` and `<div *ngFor="let user of users">`. Modern Angular still supports them, but `@if` and `@for` are the new standard).*
