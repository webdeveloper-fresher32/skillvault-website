# Reactive Forms — Complete Guide

## Table of Contents
1. [Why Reactive Forms](#1-why-reactive-forms)
2. [FormControl](#2-formcontrol)
3. [FormGroup](#3-formgroup)
4. [FormBuilder](#4-formbuilder)
5. [FormArray](#5-formarray)
6. [Reading and Writing Values](#6-reading-and-writing-values)
7. [valueChanges and statusChanges](#7-valuechanges-and-statuschanges)
8. [Worked Example: Multi-Field Reactive Form](#8-worked-example-multi-field-reactive-form)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Why Reactive Forms

Reactive Forms model form state explicitly in the component class (TypeScript), not the template. The template just binds to an already-existing model.

```
Template-Driven:              Reactive:
  Form model lives in the       Form model lives in the
  directives Angular creates    component class, built by you
  from your template            explicitly with FormControl/FormGroup

  Async, hard to unit test      Synchronous, trivial to unit test
  Good for: simple forms        Good for: complex, dynamic,
                                 validation-heavy forms
```

Because the model is a plain TypeScript object, you can:
- Unit test form logic without rendering a template
- Build forms dynamically (add/remove fields at runtime)
- Compose complex validation (cross-field, async) predictably
- Push values to the form and read them back synchronously

This is why the course — and most production Angular codebases — treats Reactive Forms as the default.

To use them, import `ReactiveFormsModule` in a standalone component:

```typescript
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './signup.component.html'
})
export class SignupComponent {}
```

---

## 2. FormControl

The atomic unit of a reactive form — tracks the value and validation state of a single input.

```typescript
import { FormControl } from '@angular/forms';

// Angular 14+ typed FormControl — infers <string>
email = new FormControl('', { nonNullable: true });

email.value;        // ''
email.valid;         // true (no validators yet)
email.setValue('a@b.com');
email.value;         // 'a@b.com'
```

Bind it to a template with `[formControl]`:

```html
<input [formControl]="email" />
```

`nonNullable: true` (Angular 14+) means `reset()` restores the initial value instead of `null`, and the control's type is `string` instead of `string | null` — worth using by default.

---

## 3. FormGroup

Groups multiple `FormControl`s (or nested `FormGroup`s / `FormArray`s) into a single object with an aggregate value and validity.

```typescript
import { FormGroup, FormControl } from '@angular/forms';

profileForm = new FormGroup({
  firstName: new FormControl('', { nonNullable: true }),
  lastName: new FormControl('', { nonNullable: true }),
  address: new FormGroup({
    street: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true })
  })
});

profileForm.value;
// { firstName: '', lastName: '', address: { street: '', city: '' } }

profileForm.get('address.city')?.value;   // dotted path lookup
profileForm.get(['address', 'city'])?.value; // array path — equivalent
```

Bind it to a template with `[formGroup]` and `formControlName`:

```html
<form [formGroup]="profileForm">
  <input formControlName="firstName" />
  <input formControlName="lastName" />

  <div formGroupName="address">
    <input formControlName="street" />
    <input formControlName="city" />
  </div>
</form>
```

`FormGroup` validity is an aggregate: it's `VALID` only when every child control is `VALID`.

---

## 4. FormBuilder

Writing `new FormControl(...)` for every field is verbose. `FormBuilder` is an injectable service that shortens this.

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './signup.component.html'
})
export class SignupComponent {
  private fb = inject(FormBuilder);

  signupForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    address: this.fb.group({
      street: [''],
      city: ['']
    })
  });
}
```

`fb.group({...})` is functionally identical to `new FormGroup({...})` with `new FormControl(...)` for each field — it just infers types and defaults `nonNullable` for you. Prefer `FormBuilder` in real code; use raw `FormGroup`/`FormControl` when you need full control or are teaching the underlying model.

---

## 5. FormArray

A resizable list of controls — used for "add another item" style UI (e.g. phone numbers, order line items).

```typescript
import { FormArray, FormBuilder, Validators } from '@angular/forms';

export class OrderComponent {
  private fb = inject(FormBuilder);

  orderForm = this.fb.group({
    customerName: ['', Validators.required],
    items: this.fb.array([
      this.createItem()
    ])
  });

  get items(): FormArray {
    return this.orderForm.get('items') as FormArray;
  }

  createItem() {
    return this.fb.group({
      product: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]]
    });
  }

  addItem(): void {
    this.items.push(this.createItem());
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }
}
```

```html
<form [formGroup]="orderForm">
  <input formControlName="customerName" />

  <div formArrayName="items">
    @for (item of items.controls; track item; let i = $index) {
      <div [formGroupName]="i">
        <input formControlName="product" placeholder="Product" />
        <input formControlName="quantity" type="number" />
        <button type="button" (click)="removeItem(i)">Remove</button>
      </div>
    }
  </div>

  <button type="button" (click)="addItem()">Add Item</button>
</form>
```

---

## 6. Reading and Writing Values

Three ways to write values into a form, each with different semantics:

```typescript
// setValue — must provide EVERY control's value, or it throws
profileForm.setValue({
  firstName: 'Ada',
  lastName: 'Lovelace',
  address: { street: '1 Analytical Engine Way', city: 'London' }
});

// patchValue — partial updates, missing keys are left untouched
profileForm.patchValue({ firstName: 'Grace' });

// reset — clears to initial values (or null if not nonNullable)
profileForm.reset();
```

Reading values:

```typescript
profileForm.value;          // current value snapshot (typed object)
profileForm.getRawValue();  // includes disabled controls too (.value excludes them)
profileForm.get('firstName')?.value;
profileForm.valid;          // boolean
profileForm.errors;         // ValidationErrors | null (group-level errors)
```

`patchValue` is what you reach for 95% of the time — e.g. populating a form from an API response that might not include every field.

---

## 7. valueChanges and statusChanges

Every control and group exposes `valueChanges` and `statusChanges` as RxJS Observables — this is where reactive forms earn their name.

```typescript
import { debounceTime, distinctUntilChanged } from 'rxjs';

export class SearchComponent {
  searchControl = new FormControl('', { nonNullable: true });

  constructor() {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(term => {
        console.log('Search for:', term);
        // call a search service here
      });
  }
}
```

`statusChanges` emits `'VALID' | 'INVALID' | 'PENDING' | 'DISABLED'` whenever validation state changes — useful for showing a spinner while an async validator runs:

```typescript
profileForm.statusChanges.subscribe(status => {
  this.isPending = status === 'PENDING';
});
```

Both observables fire on the group as a whole (aggregate value/status) and on individual controls independently — subscribe at whichever level matches what you're reacting to.

---

## 8. Worked Example: Multi-Field Reactive Form

A registration form combining `FormBuilder`, nested groups, a `FormArray`, and `valueChanges`.

```typescript
// registration.component.ts
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './registration.component.html'
})
export class RegistrationComponent {
  private fb = inject(FormBuilder);

  registrationForm = this.fb.group({
    account: this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    }),
    profile: this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required]
    }),
    skills: this.fb.array([this.fb.control('', Validators.required)])
  });

  get skills() {
    return this.registrationForm.get('skills') as import('@angular/forms').FormArray;
  }

  constructor() {
    this.registrationForm.get('account.email')?.valueChanges.subscribe(email => {
      console.log('Email changed to', email);
    });
  }

  addSkill(): void {
    this.skills.push(this.fb.control('', Validators.required));
  }

  submit(): void {
    if (this.registrationForm.invalid) {
      this.registrationForm.markAllAsTouched();
      return;
    }
    console.log(this.registrationForm.getRawValue());
  }
}
```

```html
<!-- registration.component.html -->
<form [formGroup]="registrationForm" (ngSubmit)="submit()">
  <div formGroupName="account">
    <input formControlName="email" placeholder="Email" />
    <input formControlName="password" type="password" placeholder="Password" />
  </div>

  <div formGroupName="profile">
    <input formControlName="firstName" placeholder="First name" />
    <input formControlName="lastName" placeholder="Last name" />
  </div>

  <div formArrayName="skills">
    @for (skill of skills.controls; track skill; let i = $index) {
      <input [formControlName]="i" placeholder="Skill" />
    }
  </div>
  <button type="button" (click)="addSkill()">Add Skill</button>

  <button type="submit" [disabled]="registrationForm.invalid">Register</button>
</form>
```

This mirrors real forms: nested logical groups (`account`, `profile`), a dynamic list (`skills`), reacting to a specific field's changes, and a submit guard that checks `.invalid` before proceeding.

---

## 9. Hands-On Exercises

**Exercise 1:** Build a `FormGroup` with `firstName` and `lastName` `FormControl`s using the raw API (no `FormBuilder`). Log `.value` to the console on every change using `valueChanges`.

**Exercise 2:** Rewrite Exercise 1 using `FormBuilder.group()`. Confirm the resulting form behaves identically.

**Exercise 3:** Build a `FormArray` of email addresses with an "Add email" button and a "Remove" button per row. Log the full array value whenever it changes.

**Exercise 4:** Create a form with a nested `FormGroup` (e.g. `shippingAddress`) and use `patchValue` to populate only the city field without touching the rest of the form. Then use `setValue` and observe what happens if you omit a field.

**Exercise 5:** Add a `searchControl` with `valueChanges.pipe(debounceTime(300))` that logs the term to the console. Type quickly and confirm intermediate keystrokes are skipped.

---

## 10. Interview Q&A

**Q: What is the core difference between Reactive Forms and Template-Driven Forms?**
Answer: In Reactive Forms, the form model (`FormControl`/`FormGroup`) is created explicitly in the TypeScript class and the template binds to it — the model exists independent of the DOM, making it synchronous and easy to unit test. In Template-Driven Forms, Angular creates the form model implicitly from directives (`ngModel`) in the template — the model is asynchronous and tied to change detection, harder to test in isolation.

**Q: What's the difference between `setValue` and `patchValue`?**
Answer: `setValue` requires you to supply a value for every control in the group — it throws if any key is missing, which catches typos and structural drift early. `patchValue` accepts a partial object and only updates the controls you provide, leaving the rest untouched — this is what you use for partial updates like populating a form from an incomplete API response.

**Q: What does `FormArray` give you that `FormGroup` doesn't?**
Answer: `FormGroup` has a fixed, known set of named controls. `FormArray` holds an ordered, resizable list of controls of the same shape, with `push()`, `removeAt()`, and `insert()` methods — it's the right tool for "add another" UI patterns like multiple phone numbers or dynamic line items, where the number of controls isn't known ahead of time.

**Q: How would you implement debounced search-as-you-type using reactive forms?**
Answer: Subscribe to the `FormControl`'s `valueChanges` observable and pipe it through RxJS operators — typically `debounceTime(300)` to wait for a pause in typing and `distinctUntilChanged()` to skip duplicate values — before calling the search service. Because `valueChanges` is a plain Observable, all standard RxJS operators apply directly, no extra wiring needed.

**Q: When would you use `getRawValue()` instead of `.value`?**
Answer: `.value` excludes disabled controls from the resulting object. `getRawValue()` includes them. Use `getRawValue()` when you need the full form data regardless of disabled state — e.g. submitting a form where some fields are conditionally disabled but their values should still be sent to the server.
