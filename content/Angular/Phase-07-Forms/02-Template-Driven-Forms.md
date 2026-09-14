# Template-Driven Forms — Complete Guide

## Table of Contents
1. [How Template-Driven Forms Work](#1-how-template-driven-forms-work)
2. [ngModel](#2-ngmodel)
3. [ngForm](#3-ngform)
4. [Reactive vs Template-Driven: When to Prefer Each](#4-reactive-vs-template-driven-when-to-prefer-each)
5. [Worked Example: Simple Template-Driven Form](#5-worked-example-simple-template-driven-form)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. How Template-Driven Forms Work

Template-Driven Forms build the form model *for you*, behind the scenes, purely from directives written in the template. You never instantiate a `FormControl` or `FormGroup` yourself.

```
Reactive:                          Template-Driven:
  YOU write:                         YOU write:
    new FormGroup({...})               <form> + ngModel directives
  Angular binds template to it       Angular BUILDS the FormGroup for you,
                                      asynchronously, as the template renders
```

To use it, import `FormsModule`:

```typescript
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './contact.component.html'
})
export class ContactComponent {}
```

Because the model is constructed as Angular processes the template (over a change detection cycle), it isn't available synchronously the instant the component initializes — this is the root of most of template-driven forms' limitations.

---

## 2. ngModel

`ngModel` is the workhorse directive — it creates an `NgModel` control directive under the hood (which itself wraps a `FormControl`) and wires up two-way binding.

```html
<input name="username" [(ngModel)]="username" required minlength="3" />
```

```typescript
export class ContactComponent {
  username = '';
}
```

`[(ngModel)]` is banana-in-a-box syntax — shorthand for:

```html
<input name="username"
       [ngModel]="username"
       (ngModelChange)="username = $event" />
```

Every `ngModel`-bound element **must** have a `name` attribute when it's inside a `<form>` — Angular uses `name` as the key to register the control on the parent `NgForm`. Forgetting it is the single most common template-driven forms bug.

Validation attributes are plain HTML5 attributes Angular recognizes and turns into validators automatically: `required`, `minlength`, `maxlength`, `pattern`.

---

## 3. ngForm

Every `<form>` element automatically gets an `NgForm` directive attached (as long as `FormsModule` is imported) — you don't add it explicitly. You access it via a template reference variable:

```html
<form #contactForm="ngForm" (ngSubmit)="submit(contactForm)">
  <input name="email" [(ngModel)]="email" required email />
  <button type="submit" [disabled]="contactForm.invalid">Send</button>
</form>
```

```typescript
import { NgForm } from '@angular/forms';

submit(form: NgForm): void {
  if (form.invalid) {
    return;
  }
  console.log(form.value);   // { email: '...' }
  form.resetForm();
}
```

`contactForm.invalid`, `contactForm.value`, `contactForm.controls['email']` all mirror the reactive `FormGroup` API — `NgForm` genuinely is a `FormGroup` internally, Angular just builds it for you from the template.

---

## 4. Reactive vs Template-Driven: When to Prefer Each

| | Reactive Forms | Template-Driven Forms |
|---|---|---|
| Form model | Explicit, in TypeScript | Implicit, generated from template |
| Testability | Unit test without rendering | Requires TestBed + change detection |
| Scalability | Handles dynamic/complex forms well | Gets unwieldy past a few fields |
| Validation | Composable, cross-field, async — straightforward | Possible but awkward, more boilerplate |
| Syntax | More TypeScript, less template | Less TypeScript, more template directives |
| Best for | Production forms, anything with logic | Quick prototypes, a single simple field, demos |

**This course prioritizes Reactive Forms** because almost every real form eventually needs one of: dynamic fields, cross-field validation, async validation, or unit tests that don't require a rendered DOM. Reactive Forms handle all of these without restructuring the form later. Template-Driven Forms are still worth knowing because:

- You'll encounter them in legacy Angular codebases (pre-2017 AngularJS-influenced style)
- For a genuinely trivial form (e.g. a one-field newsletter signup with no validation logic beyond `required`), the reduced boilerplate is a legitimate win
- Interviewers expect you to be able to compare both approaches with specifics, not just a memorized preference

The general rule: if you're not sure which to pick, pick Reactive. The set of forms that are simple enough for Template-Driven to stay simple is smaller than it looks — an extra checkbox or a "confirm password" field is enough to tip a template-driven form into awkward territory.

---

## 5. Worked Example: Simple Template-Driven Form

A newsletter signup form — a good fit for template-driven since it's small and has no cross-field logic.

```typescript
// newsletter.component.ts
import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

@Component({
  selector: 'app-newsletter',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './newsletter.component.html'
})
export class NewsletterComponent {
  email = '';
  subscribed = false;

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      return;
    }
    console.log('Subscribing:', form.value.email);
    this.subscribed = true;
    form.resetForm();
  }
}
```

```html
<!-- newsletter.component.html -->
<form #newsletterForm="ngForm" (ngSubmit)="onSubmit(newsletterForm)">
  <label for="email">Email</label>
  <input
    id="email"
    name="email"
    type="email"
    [(ngModel)]="email"
    required
    email
    #emailField="ngModel"
  />

  @if (emailField.invalid && emailField.touched) {
    <div class="error">
      @if (emailField.errors?.['required']) {
        <span>Email is required.</span>
      }
      @if (emailField.errors?.['email']) {
        <span>Enter a valid email address.</span>
      }
    </div>
  }

  <button type="submit" [disabled]="newsletterForm.invalid">Subscribe</button>

  @if (subscribed) {
    <p>Thanks for subscribing!</p>
  }
</form>
```

Note the `#emailField="ngModel"` template reference variable — this is the template-driven equivalent of getting a handle on an individual `FormControl`, used here purely to check `.invalid` / `.touched` / `.errors` for that one field.

---

## 6. Hands-On Exercises

**Exercise 1:** Build a single-field template-driven form (a "subscribe" email input) using `[(ngModel)]`, `required`, and `email` validation attributes. Disable the submit button while invalid.

**Exercise 2:** Deliberately omit the `name` attribute from an `ngModel`-bound input inside a `<form>` and observe the runtime error Angular throws. Then fix it.

**Exercise 3:** Add a `#field="ngModel"` template reference variable to an input and display a specific error message for each validator (`required` vs `minlength`) using `field.errors`.

**Exercise 4:** Convert the newsletter form from Section 5 into a Reactive Form using `FormBuilder`. Compare the amount of code in the template vs the component class before and after.

**Exercise 5:** Build a two-field template-driven form (name + email) and try to add a cross-field validator (e.g. "name must not equal email"). Note how much more awkward this is compared to the reactive equivalent covered in the next lesson.

---

## 7. Interview Q&A

**Q: How does Angular build the form model in a template-driven form?**
Answer: Angular scans the template for `ngModel` and `<form>` elements and constructs the corresponding `FormControl`/`FormGroup` (via `NgForm`) automatically during change detection. You never instantiate these classes yourself — the model is a byproduct of the template, which is why it isn't available synchronously at component construction time.

**Q: Why is the `name` attribute required on an `ngModel`-bound input inside a `<form>`?**
Answer: Angular uses the `name` attribute as the key under which the control is registered on the parent `NgForm` (which is itself a `FormGroup`). Without a unique `name`, Angular throws a runtime error because it has no key to register the control under, and two controls with the same missing/duplicate name would collide.

**Q: Why does this course (and most production code) prefer Reactive Forms over Template-Driven Forms?**
Answer: Reactive Forms define the model explicitly in TypeScript, making it synchronously testable without rendering the DOM, and they scale cleanly to dynamic fields, cross-field validation, and async validation. Template-Driven Forms generate the model implicitly from the template, which is fine for a trivial form but becomes awkward once you need anything beyond basic per-field validation — most real forms cross that line eventually.

**Q: What is `NgForm` and how do you access it?**
Answer: `NgForm` is a directive Angular automatically attaches to every `<form>` element when `FormsModule` is imported. It exposes a `FormGroup`-like API (`.value`, `.invalid`, `.controls`) aggregating all `ngModel`-bound controls inside it. You access it via a template reference variable, e.g. `<form #f="ngForm">`, and can pass it to a submit handler via `(ngSubmit)="submit(f)"`.

**Q: Give an example of a form where template-driven forms are still a reasonable choice.**
Answer: A small, static form with no cross-field or async validation and no dynamic fields — e.g. a single-field newsletter signup, or a simple "contact us" form with two or three independent fields. Once the form needs a dynamic list of fields, a custom cross-field validator, or unit tests that don't touch the DOM, reactive forms become the better fit.
