# Form Validation — Complete Guide

## Table of Contents
1. [How Validators Work](#1-how-validators-work)
2. [Built-In Validators](#2-built-in-validators)
3. [Custom Synchronous Validators](#3-custom-synchronous-validators)
4. [Async Validators](#4-async-validators)
5. [Cross-Field Validation](#5-cross-field-validation)
6. [Displaying Error Messages](#6-displaying-error-messages)
7. [Worked Example: Password Match Validator](#7-worked-example-password-match-validator)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. How Validators Work

A validator is just a function with the signature `(control: AbstractControl) => ValidationErrors | null`. Angular runs every validator attached to a control whenever its value changes, and merges the results.

```
control.value changes
        │
        ▼
run every validator function attached to the control
        │
        ▼
null from all of them?  →  control.errors = null,  control.valid = true
any returns an object?  →  control.errors = { ...merged }, control.valid = false
```

`ValidationErrors` is just `{ [key: string]: any }` — e.g. `{ required: true }` or `{ minlength: { requiredLength: 8, actualLength: 3 } }`. The key names (`required`, `minlength`, etc.) are what you check for in the template or component to decide which error message to show.

---

## 2. Built-In Validators

All live on the static `Validators` class from `@angular/forms`.

```typescript
import { Validators } from '@angular/forms';

this.fb.group({
  email: ['', [Validators.required, Validators.email]],
  username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
  zipCode: ['', [Validators.pattern(/^\d{5}$/)]],
  age: [null, [Validators.min(18), Validators.max(120)]]
});
```

| Validator | Checks |
|-----------|--------|
| `Validators.required` | Value is not empty/null/undefined |
| `Validators.email` | Value matches a basic email regex |
| `Validators.minLength(n)` / `maxLength(n)` | String/array length bounds |
| `Validators.pattern(regexOrString)` | Value matches a regex |
| `Validators.min(n)` / `max(n)` | Numeric bounds |
| `Validators.requiredTrue` | Value must be exactly `true` (checkboxes, e.g. "I agree to terms") |

Multiple validators on one control are passed as an array — all of them run, and their errors merge into a single object.

In a template-driven form, the equivalent attributes are `required`, `minlength`, `maxlength`, `pattern`, `email` — Angular converts these HTML attributes into the same validator functions internally.

---

## 3. Custom Synchronous Validators

A custom validator is a plain function (or a factory returning one) matching `ValidatorFn`:

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Simple validator — no configuration needed
export function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  const isWhitespace = (control.value ?? '').trim().length === 0;
  return isWhitespace ? { whitespace: true } : null;
}

// Validator factory — needs configuration, so it returns a ValidatorFn
export function forbiddenNameValidator(forbidden: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const isForbidden = control.value?.toLowerCase() === forbidden.toLowerCase();
    return isForbidden ? { forbiddenName: { name: control.value } } : null;
  };
}
```

Usage:

```typescript
username: ['', [Validators.required, forbiddenNameValidator('admin')]],
displayName: ['', [Validators.required, noWhitespaceValidator]]
```

Notice the naming convention: return `null` for valid, and an object keyed by a descriptive error name (matching what you'll check for in the template) for invalid.

---

## 4. Async Validators

Async validators check the `AsyncValidatorFn` signature — they return an `Observable<ValidationErrors | null>` or `Promise<ValidationErrors | null>`, typically used for server-side checks like "is this username already taken?"

```typescript
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, first, map, switchMap } from 'rxjs/operators';

export function uniqueUsernameValidator(userService: UserService): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!control.value) {
      return of(null);
    }
    return control.valueChanges.pipe(
      debounceTime(300),
      switchMap(() => userService.checkUsernameTaken(control.value)),
      map(taken => (taken ? { usernameTaken: true } : null)),
      first(),
      catchError(() => of(null))
    );
  };
}
```

Register it as the third constructor/config argument (sync validators are the second):

```typescript
username: ['', [Validators.required], [uniqueUsernameValidator(this.userService)]]
```

While an async validator is running, `control.status === 'PENDING'` and `control.valid` is `false` until it resolves — this is exactly what `statusChanges` (covered in the Reactive Forms lesson) is for, e.g. showing a spinner next to the field.

Async validators only run **after** all synchronous validators pass — Angular doesn't waste a network call validating an already-invalid value.

---

## 5. Cross-Field Validation

A validator that needs to compare two sibling controls (e.g. password + confirm password) can't live on a single `FormControl` — it must be attached to the parent `FormGroup`, since only the group has access to both controls.

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function passwordMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;

    if (!password || !confirmPassword) {
      return null; // don't flag until both fields have a value
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  };
}
```

Attach it as the group's validator (second argument to `fb.group`):

```typescript
this.fb.group(
  {
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required]
  },
  { validators: passwordMatchValidator() }
);
```

The error (`passwordMismatch`) ends up on the **group**, not on either individual control — `signupForm.get('passwords')?.errors` — which is important when deciding where in the template to display the message.

---

## 6. Displaying Error Messages

The standard pattern: check `invalid` AND `touched` (or `dirty`) before showing an error, so messages don't appear before the user has interacted with the field.

```html
<input formControlName="email" />

@if (registrationForm.get('email')?.invalid && registrationForm.get('email')?.touched) {
  <div class="error">
    @if (registrationForm.get('email')?.errors?.['required']) {
      <span>Email is required.</span>
    }
    @if (registrationForm.get('email')?.errors?.['email']) {
      <span>Enter a valid email address.</span>
    }
  </div>
}
```

Repeating `registrationForm.get('email')` is noisy — pull it into a getter or a local template variable:

```html
@if (registrationForm.get('email'); as email) {
  @if (email.invalid && email.touched) {
    <div class="error">
      @if (email.errors?.['required']) { <span>Email is required.</span> }
      @if (email.errors?.['email']) { <span>Enter a valid email address.</span> }
    </div>
  }
}
```

Control state flags worth knowing:

| Flag | Meaning |
|------|---------|
| `pristine` / `dirty` | Has the value ever changed from its initial value? |
| `untouched` / `touched` | Has the control ever lost focus (blur)? |
| `valid` / `invalid` | Do all validators currently pass? |
| `pending` | Is an async validator currently running? |

`markAllAsTouched()` on a group (called on submit) is the standard way to force all error messages to appear even for fields the user never focused, e.g. if they click Submit immediately.

---

## 7. Worked Example: Password Match Validator

A complete signup form combining a custom sync validator, cross-field validation, and proper error display.

```typescript
// signup.component.ts
import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  if (!password || !confirmPassword) {
    return null;
  }
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './signup.component.html'
})
export class SignupComponent {
  private fb = inject(FormBuilder);

  signupForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    passwords: this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required]
      },
      { validators: passwordMatchValidator }
    )
  });

  get passwordsGroup() {
    return this.signupForm.get('passwords');
  }

  submit(): void {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }
    console.log(this.signupForm.getRawValue());
  }
}
```

```html
<!-- signup.component.html -->
<form [formGroup]="signupForm" (ngSubmit)="submit()">
  <input formControlName="email" placeholder="Email" />
  @if (signupForm.get('email'); as email) {
    @if (email.invalid && email.touched) {
      @if (email.errors?.['required']) { <p class="error">Email is required.</p> }
      @if (email.errors?.['email']) { <p class="error">Enter a valid email.</p> }
    }
  }

  <div formGroupName="passwords">
    <input formControlName="password" type="password" placeholder="Password" />
    <input formControlName="confirmPassword" type="password" placeholder="Confirm password" />

    @if (passwordsGroup?.errors?.['passwordMismatch'] && passwordsGroup?.get('confirmPassword')?.touched) {
      <p class="error">Passwords do not match.</p>
    }
  </div>

  <button type="submit" [disabled]="signupForm.invalid">Sign Up</button>
</form>
```

Key detail: the mismatch error is read from `passwordsGroup.errors`, not from either individual `password`/`confirmPassword` control — because the validator is attached to the `passwords` group, that's where the error object lives.

---

## 8. Hands-On Exercises

**Exercise 1:** Add `Validators.required`, `Validators.minLength(8)`, and `Validators.pattern(/\d/)` (must contain a digit) to a password field. Display a distinct message per failing validator.

**Exercise 2:** Write a custom synchronous validator `noSpecialCharsValidator` that rejects usernames containing anything other than letters and numbers. Attach it alongside `Validators.required`.

**Exercise 3:** Write an async validator (mock it with `of(true).pipe(delay(500))` instead of a real HTTP call) that simulates checking if an email is already registered. Show a "Checking..." message while `control.pending` is true.

**Exercise 4:** Build the password-match example from Section 7 yourself from scratch, then break it deliberately (make the validator always return `null`) and confirm the error message disappears — to prove you understand where the error actually lives.

**Exercise 5:** Add a "Submit" button that calls `markAllAsTouched()` on an empty form and confirm every required-field error message appears immediately, even for fields the user never focused.

---

## 9. Interview Q&A

**Q: What is the function signature of a custom validator, and what should it return?**
Answer: A synchronous validator is a `ValidatorFn`: `(control: AbstractControl) => ValidationErrors | null`. It returns `null` when the control is valid, or an object like `{ errorKey: true }` (or with extra detail, `{ errorKey: { ...info } }`) when invalid. Angular merges the returned objects from all validators on a control into `control.errors`.

**Q: Why does cross-field validation (like password match) need to be attached to a FormGroup instead of a FormControl?**
Answer: A validator attached to an individual `FormControl` only receives that one control as its argument — it has no way to read a sibling control's value. A validator needs access to both `password` and `confirmPassword`, so it must be attached to their common parent `FormGroup`, which exposes both via `group.get('password')` and `group.get('confirmPassword')`.

**Q: How does an async validator differ from a synchronous one, and when does it run?**
Answer: An async validator (`AsyncValidatorFn`) returns an `Observable<ValidationErrors | null>` or `Promise<...>` instead of a plain value — used for checks that require a server round-trip, like uniqueness checks. Angular only runs async validators after all synchronous validators on the control pass, and the control's status is `PENDING` while the async check is in flight, avoiding unnecessary network calls on already-invalid input.

**Q: What's the standard pattern for deciding when to show a validation error message?**
Answer: Check both `invalid` and `touched` (or `dirty`) before rendering an error — showing errors on every field the instant the form loads is poor UX. On submit, call `markAllAsTouched()` on the form so validation messages appear even for fields the user never interacted with, in case they click Submit on an empty form.

**Q: What's the difference between `Validators.required` and a custom validator like a forbidden-name check?**
Answer: `Validators.required` is one of Angular's built-in `ValidatorFn` implementations, covering a generic presence check reusable across any form. A custom validator like a forbidden-name check encodes domain-specific business logic that Angular can't know about — you write the function yourself following the same `ValidatorFn` contract, and attach it the same way as a built-in validator.
