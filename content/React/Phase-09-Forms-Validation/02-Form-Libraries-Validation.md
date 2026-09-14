# 02 — Form Libraries & Validation

> "A form isn't just a bag of inputs — it's a bag of inputs that all need to be watched, checked, and complained about individually, without making the user reprint the whole page every time they make one mistake."

---

## Table of Contents

1. [The Problem: When 15 Fields Break `useState`](#1-the-problem-when-15-fields-break-usestate)
2. [The Clinic Intake Form Analogy](#2-the-clinic-intake-form-analogy)
3. [What React Hook Form Actually Is](#3-what-react-hook-form-actually-is)
4. [Internal Working — Uncontrolled Refs vs. Re-Render-Per-Keystroke](#4-internal-working--uncontrolled-refs-vs-re-render-per-keystroke)
5. [Basic Usage — `useForm`, `register`, `handleSubmit`](#5-basic-usage--useform-register-handlesubmit)
6. [Schema-Based Validation with Zod](#6-schema-based-validation-with-zod)
7. [Validation Timing Strategies](#7-validation-timing-strategies)
8. [Async Validation (e.g. Username Availability)](#8-async-validation-eg-username-availability)
9. [Common Mistakes](#9-common-mistakes)
10. [Interview Answer — Why Is This More Performant?](#10-interview-answer--why-is-this-more-performant)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The Problem: When 15 Fields Break `useState`

Picture a job-application form. Not a toy example — a real one:

```
Full name
Email
Phone
Address line 1
Address line 2
City
State
Zip
LinkedIn URL
Portfolio URL
Years of experience
Desired salary
Cover letter
Resume upload
"How did you hear about us?"
```

Fifteen fields. Every single one needs:

```
A value
A "has this field been touched yet?" flag
A "has this field been changed from its default?" flag
An error message, if it's invalid
A rule for WHEN to check it (on blur? on every keystroke? on submit?)
```

If you learned forms the way most people first learn them — one `useState` per field — your component starts looking like this:

```jsx
const [name, setName] = useState("");
const [nameTouched, setNameTouched] = useState(false);
const [nameError, setNameError] = useState("");

const [email, setEmail] = useState("");
const [emailTouched, setEmailTouched] = useState(false);
const [emailError, setEmailError] = useState("");

// ...repeat this shape 13 more times
```

That's already exhausting to write. But writing it isn't even the real problem — the real problem shows up once the user starts typing.

Every keystroke in the `name` field calls `setName`. React schedules a re-render. That re-render re-runs the *entire* component function — which means it re-evaluates all 15 fields' worth of JSX, all their validation checks, all their error messages — just because one letter was typed into one box.

```
User types "J" in the Full Name field
        |
        v
setName("J") is called
        |
        v
The WHOLE form component re-renders
        |
        v
All 15 fields' JSX gets re-evaluated
(even though only ONE character in ONE field changed)
```

On a small form, you'd never notice. On a 15-field form — especially one with per-keystroke validation, conditional fields, or a live "profile strength" meter — this adds up to a form that feels sluggish, especially on lower-end devices.

And that's before you've even written the validation logic itself: an if-chain for every field, checked in every possible place a submit or blur could happen. It becomes unmanageable fast — not because any single check is hard, but because there are 15 of them, each slightly different, each easy to forget.

This is the exact pain that File 01 in this phase warned about: controlled inputs are wonderful for a 2-field login form, but they don't scale gracefully to a 15-field form without help. This file is about the tool built specifically to fix that: **React Hook Form**, plus schema-based validation to tame the if-chains.

---

## 2. The Clinic Intake Form Analogy

Think about the last time you filled out a real, physical intake form at a doctor's clinic.

**The bad version of this experience:** you fill out the entire multi-page form, hand it to the receptionist, and she says "you missed your date of birth" — and hands you the *entire form back*, telling you to redo the whole thing from page one.

Nobody would tolerate that. It's absurd. And yet that's basically what a "validate everything, re-render everything" naive form does.

**The good version:** the receptionist skims the form, circles the ONE box you left blank with a red pen, and hands it back with just that one box needing attention. Everything else you already filled in correctly stays exactly as it is. You fix the one box, hand it back, done.

That's the experience a good form library gives you:

```
Only the field with a problem gets flagged.
Everything else is left alone — untouched, unre-rendered, exactly as you left it.
```

React Hook Form is built around this exact philosophy. It watches your fields quietly in the background (like the receptionist glancing over your shoulder), and only steps in — only causes a re-render — when there's actually something to report, like a validation error appearing or disappearing.

---

## 3. What React Hook Form Actually Is

Now that you've felt the pain and seen the analogy, here's the plain definition:

**React Hook Form (RHF)** is a form library that manages field values, validation, touched/dirty tracking, and submission state for you — while deliberately avoiding the "re-render the whole form on every keystroke" trap that hand-rolled `useState`-per-field forms fall into.

It doesn't ask you to store every field's value in React state. Instead, it grabs a **ref** to each input's underlying DOM node, and reads values directly off the DOM when it actually needs them (like on submit, or on blur if you've asked it to validate then).

That single design decision — "read from the DOM via refs, instead of storing every keystroke in React state" — is the most important thing to understand about this library, and it's directly the uncontrolled-vs-controlled distinction from File 01, applied deliberately for performance. Let's go look at that in detail.

---

## 4. Internal Working — Uncontrolled Refs vs. Re-Render-Per-Keystroke

Here's the side-by-side comparison. First, the naive controlled-with-`useState` version:

```text
┌─────────────────────────────────────────────────────────────┐
│         Plain useState-per-field form (controlled)          │
│                                                               │
│   User types "J" in Name field                               │
│           |                                                   │
│           v                                                   │
│   onChange fires -> setName("J")                              │
│           |                                                   │
│           v                                                   │
│   React schedules a re-render of the WHOLE component          │
│           |                                                   │
│           v                                                   │
│   Every field's JSX is re-evaluated                            │
│   Every validation check tied to render logic re-runs          │
│           |                                                   │
│           v                                                   │
│   Repeat this ENTIRE cycle for every single keystroke,         │
│   in every single field, across all 15 fields                  │
└─────────────────────────────────────────────────────────────┘
```

Now, React Hook Form's approach:

```text
┌─────────────────────────────────────────────────────────────┐
│      React Hook Form (uncontrolled, ref-based) approach       │
│                                                               │
│   register("name") attaches a ref + native event listeners    │
│   directly to the <input> DOM node — no useState involved      │
│           |                                                   │
│           v                                                   │
│   User types "J" in Name field                                │
│           |                                                   │
│           v                                                   │
│   The DOM input updates itself natively (the browser already   │
│   does this for free — no React re-render needed at all)       │
│           |                                                   │
│           v                                                   │
│   RHF's internal store quietly records the new value           │
│   (outside of React state — no re-render triggered)            │
│           |                                                   │
│           v                                                   │
│   Does anything visible need to change? (e.g. did a           │
│   validation error just appear or disappear?)                  │
│           |                                                   │
│      ------------------------                                 │
│      |                      |                                 │
│     NO                     YES                                 │
│      |                      |                                 │
│      v                      v                                  │
│  Nothing re-renders     ONLY the specific field(s) whose        │
│  Form stays idle        error state changed re-render           │
│                         (via a small internal subscription)     │
└─────────────────────────────────────────────────────────────┘
```

Notice the crucial difference: in the RHF version, typing a keystroke does **not**, by itself, cause a React re-render. The input is uncontrolled — the DOM manages its own value, the same way a plain `<input>` on a plain HTML page would, with no framework involved at all. RHF just reads that value off the ref whenever it's actually needed (submit time, or blur time if you configured blur-based validation).

A re-render only happens when something the user can actually *see* needs to change — like an error message flipping from hidden to visible. That's a targeted, surgical re-render of just the affected field, not a blanket re-render of the entire 15-field form.

This is why RHF is fast even on huge forms: **the cost of typing is decoupled from the cost of rendering.** You can have 100 fields, and typing into any one of them costs roughly the same as typing into a plain uncontrolled `<input>` with no library at all.

**Tying this back to File 01:** the controlled/uncontrolled tradeoff there was framed as "controlled gives you full control and instant access to every value, uncontrolled gives you better performance but you have to reach into the DOM to read values." React Hook Form is the library-level answer to "can I get uncontrolled's performance without giving up validation and tracking?" The answer is yes — RHF does the DOM-reaching for you, behind `register()`, and layers validation, error state, and submission handling neatly on top.

> **Memory hook:** "The receptionist doesn't rewrite your whole form every time you write a letter — she just glances over, and only reaches for her red pen when a box is actually wrong."

---

## 5. Basic Usage — `useForm`, `register`, `handleSubmit`

Let's build the core pieces one at a time.

### Step 1 — `useForm()`

This hook sets up the form's internal state and hands you back a toolbox of functions and objects:

```jsx
import { useForm } from "react-hook-form";

function ApplicationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  // ... more below
}
```

- `register` — the function you attach to every input, so RHF knows this field exists and should be tracked.
- `handleSubmit` — wraps your own submit handler, runs validation first, and only calls your function if everything passes.
- `formState.errors` — an object holding the current validation errors, keyed by field name.

### Step 2 — `register()` on every field

```jsx
<input {...register("fullName", { required: "Full name is required" })} />
```

Spread `register("fullName", ...)` directly onto the input. Under the hood, this hands the input a `ref`, plus `name`, `onChange`, and `onBlur` — all wired up for you. That's the ref-based tracking from Section 4, made concrete.

### Step 3 — `handleSubmit()` wraps your submit logic

```jsx
function onValid(data) {
  console.log("Form is valid, submitting:", data);
  // data = { fullName: "...", email: "...", ... } — every registered field's value
}

<form onSubmit={handleSubmit(onValid)}>
```

`handleSubmit` runs all validation first. If everything passes, it calls `onValid` with a single object containing every registered field's current value — read straight from the DOM refs. If something fails, `onValid` never runs; instead, `formState.errors` gets populated.

### Full example

```jsx
import { useForm } from "react-hook-form";

function ApplicationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  function onValid(data) {
    console.log("Submitting:", data);
  }

  return (
    <form onSubmit={handleSubmit(onValid)}>
      <label>Full Name</label>
      <input {...register("fullName", { required: "Full name is required" })} />
      {errors.fullName && <p className="error">{errors.fullName.message}</p>}

      <label>Email</label>
      <input
        {...register("email", {
          required: "Email is required",
          pattern: {
            value: /^\S+@\S+\.\S+$/,
            message: "Enter a valid email address",
          },
        })}
      />
      {errors.email && <p className="error">{errors.email.message}</p>}

      <label>Years of Experience</label>
      <input
        type="number"
        {...register("yearsExperience", {
          required: "This field is required",
          min: { value: 0, message: "Can't be negative" },
        })}
      />
      {errors.yearsExperience && (
        <p className="error">{errors.yearsExperience.message}</p>
      )}

      <button type="submit">Submit Application</button>
    </form>
  );
}
```

Notice what's *missing* compared to the hand-rolled version in Section 1: no `useState` calls anywhere. No manual `onChange` handlers. No manually-written if-chains for each field's validation. `register`'s second argument — a plain options object — carries all of that instead.

This already handles all 15 fields from Section 1's scenario with roughly a fifth of the code, and none of the per-keystroke re-render cost.

---

## 6. Schema-Based Validation with Zod

The inline `register("email", { required: ..., pattern: ... })` approach works, but once you have 15 fields, each with 2-4 rules, your JSX gets cluttered with validation logic mixed into markup. It also makes rules hard to reuse or test in isolation, separate from any component.

**The fix: describe your entire form's validation rules in ONE schema, in one place, declaratively** — then hand that schema to RHF and let it apply the rules for you.

[Zod](https://zod.dev) is a popular schema-validation library for this. (Yup is another well-established option with a very similar API shape — the concept transfers directly.)

### Step 1 — Define the schema

```jsx
import { z } from "zod";

const applicationSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  yearsExperience: z
    .number({ invalid_type_error: "Must be a number" })
    .min(0, "Can't be negative"),
  desiredSalary: z.number().min(0, "Can't be negative").optional(),
  linkedinUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});
```

Read that top to bottom and it reads almost like a sentence: "fullName is a string, at least 1 character. email is a string, at least 1 character, and must look like an email. yearsExperience is a number, at least 0." One place, one shape, one source of truth for every rule in the form.

### Step 2 — Wire it into `useForm` with a resolver

RHF doesn't understand Zod schemas natively — it needs a small adapter function called a **resolver**, provided by the `@hookform/resolvers` package, to translate a Zod schema's validation result into the shape RHF expects.

```jsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm({
  resolver: zodResolver(applicationSchema),
});
```

That's the entire integration. From here on, `register("fullName")` doesn't need a second argument with inline rules anymore — the schema is the single source of truth, and `errors.fullName.message` will automatically be populated with whatever message the schema defined.

```jsx
<input {...register("fullName")} />
{errors.fullName && <p className="error">{errors.fullName.message}</p>}
```

### Why this is worth the extra setup

- **One place to read, one place to change.** Need to add a max-length rule to `fullName`? Change one line in the schema, not a `register()` call buried somewhere in a 400-line JSX tree.
- **Reusable outside of forms.** The same Zod schema can validate an API request body on the server, or validate data coming back from a database — not just a form. Define the shape of valid data once, use it everywhere.
- **Type-safety, for free, in TypeScript.** Zod can infer a TypeScript type directly from the schema (`type Application = z.infer<typeof applicationSchema>`), so your form data's shape and your validation rules can never silently drift apart.
- **Composable.** Schemas can be built from smaller schemas — an `addressSchema` can be nested inside a larger `applicationSchema`, mirroring how you'd naturally break a big form into logical sections.

```jsx
const addressSchema = z.object({
  line1: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  zip: z.string().regex(/^\d{5}$/, "Enter a valid 5-digit zip"),
});

const applicationSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  address: addressSchema, // nested schema, reused elsewhere too
});
```

Notice `errors.address?.city?.message` mirrors this nesting exactly — the shape of your errors object always matches the shape of your schema.

> **Memory hook:** "Write the rulebook once, on one page — don't scatter one sticky note of rules on every single box of the form."

---

## 7. Validation Timing Strategies

Knowing *what* to validate is only half the story — *when* you validate has a huge effect on how the form actually feels to use.

RHF controls this with the `mode` option on `useForm`:

```jsx
useForm({
  resolver: zodResolver(applicationSchema),
  mode: "onBlur", // <- this is the timing strategy
});
```

| Strategy | When validation runs | Feels like | Best for |
|---|---|---|---|
| `onSubmit` (default) | Only when the form is submitted | Nothing happens until you hit submit — then everything lights up red at once | Short, simple forms (login, search box) where interrupting typing would be annoying |
| `onBlur` | When the user leaves a field (tabs or clicks away) | Errors appear right after you finish a field, before you've moved on to the next one | Most real-world forms — this is the generally recommended default for longer forms |
| `onChange` | On every keystroke | Errors appear (and disappear) as you type, live | Fields where instant feedback matters a lot, like a password-strength meter — but risky if overused |
| `onTouched` | `onBlur` first, then `onChange` for that field afterward | Quiet until you've visited a field once, then live-updates after that | A middle ground: doesn't nag you before you've even reached a field, but gives fast feedback once you have |
| `all` | Both blur and change, from the start | Most aggressive validation timing | Rarely the right default; mostly used for specific fields via `reValidateMode`, not the whole form |

**The UX tradeoff, spelled out:**

- Validate on every keystroke (`onChange`), and a user typing their email one letter at a time sees "Enter a valid email address" flash red after literally every character — including while they're still in the middle of typing it. That's the form nagging them for something that isn't even finished yet. Naggy, annoying, makes the form feel judgmental.
- Validate only on submit (`onSubmit`), and a user can fill out all 15 fields, hit submit, and get hit with a wall of 6 error messages all at once — including for a mistake they made in field #2, ten minutes ago, that they'd have happily fixed immediately if only they'd been told at the time. That's too late — the feedback loop is too far removed from the mistake.
- `onBlur` sits in the sweet spot for most forms: the user finishes typing a field, moves on, and *then* gets told if something's wrong — while it's still fresh, but without being interrupted mid-keystroke.

A common, well-regarded pattern in real production forms: use `mode: "onBlur"` for the first validation of a field, then switch to `onChange`-style *re*-validation for that specific field once it's already shown an error — the idea being, once you've told the user something's wrong, you should tell them the instant it's fixed, without waiting for them to blur away again. RHF supports this via the separate `reValidateMode` option.

```jsx
useForm({
  resolver: zodResolver(applicationSchema),
  mode: "onBlur",        // first-time validation: wait until blur
  reValidateMode: "onChange", // once errored, re-check live as they fix it
});
```

> **Memory hook:** "Don't heckle the user mid-sentence — but once you've pointed out a typo, tell them the second they've fixed it."

---

## 8. Async Validation (e.g. Username Availability)

Some validation can't be answered just by looking at the value itself — it needs a round-trip to the server. The classic example: "is this username already taken?"

This is fundamentally different from the rules you've seen so far, because it's **slow** (a network request) and **expensive** (you don't want to hit your server on every keystroke).

Zod schemas support this via `.refine()`, which accepts an async function:

```jsx
const signupSchema = z.object({
  username: z
    .string()
    .min(3, "Must be at least 3 characters")
    .refine(async (value) => {
      const res = await fetch(`/api/check-username?u=${value}`);
      const { available } = await res.json();
      return available;
    }, "That username is already taken"),
});
```

But wiring this in naively — checking on every keystroke — would hammer your server with a request per letter typed. Two things fix that in practice:

1. **Pick a sane validation timing** for this specific field — `onBlur` is a natural fit for async checks like this, since you genuinely don't need to check availability until the user has finished typing a candidate username and moved on.
2. **Debounce it anyway**, even on blur-triggered checks, if the check is expensive or rate-limited — wait a few hundred milliseconds after the last keystroke before firing the request, in case the user is still editing.

A simplified pattern, combining a debounce with RHF's field-level `trigger()` (which manually re-runs validation for a specific field):

```jsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef } from "react";

function SignupForm() {
  const { register, handleSubmit, trigger, formState: { errors, isValidating } } =
    useForm({ resolver: zodResolver(signupSchema), mode: "onBlur" });

  const debounceRef = useRef();

  function handleUsernameChange() {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      trigger("username"); // manually re-validate just this field, after the pause
    }, 400);
  }

  return (
    <form onSubmit={handleSubmit(onValid)}>
      <input {...register("username")} onChange={handleUsernameChange} />
      {isValidating && <span>Checking availability...</span>}
      {errors.username && <p className="error">{errors.username.message}</p>}
    </form>
  );
}
```

Note the `isValidating` flag from `formState` — this is exactly what you'd use to show a "Checking..." spinner while the async check is in flight, so the user isn't left wondering whether anything is happening.

The core lesson: async validation needs its own timing discipline — it's not free like a synchronous regex check, so you deliberately throttle how often it fires, independent of whatever `mode` the rest of the form uses.

**What's happening internally, step by step, for the debounced check above:**

```text
User types a character in the username field
        |
        v
onChange fires -> handleUsernameChange() runs
        |
        v
clearTimeout cancels any PENDING check from a moment ago
        |
        v
A new setTimeout is scheduled, 400ms out
        |
        v
Does the user type another character within 400ms?
        |
   ----------------
   |              |
  YES             NO
   |              |
   v              v
The cycle       trigger("username") finally runs,
repeats —       which re-validates just this field,
timer resets    including the async .refine() —
again           ONE network request, not one per keystroke
```

Only once the user *pauses* for 400ms does the actual network request fire — no matter how fast or slow they type, at most one request goes out per pause, not one per character.

---

## 9. Common Mistakes

**Mistake 1 — Forgetting to `register()` a field.**

```jsx
// WRONG — this input isn't tracked by RHF at all
<input name="phone" />

// RIGHT
<input {...register("phone")} />
```

If a field isn't registered, RHF has no ref to it, no idea it exists, and won't include it in the data passed to your submit handler — and won't validate it either. This is an easy mistake with custom or third-party input components, where you have to explicitly forward the ref RHF gives you (via `register`'s `ref` property) down to the actual `<input>` DOM node inside that component.

**Mistake 2 — Over-aggressive validation timing.**

Defaulting every field to `mode: "onChange"` because "more feedback is always better" backfires. It's the single most common way a form built with a genuinely good library still ends up feeling worse than a plain, dumb HTML form — because it interrupts the user mid-thought, on every keystroke, for fields they haven't even finished typing yet.

**Mistake 3 — Misreading `formState.errors`.**

`errors` is not a flat list — it's an object shaped like your form data, and each present key holds an error object with a `.message` (and a `.type`, describing which rule failed).

```jsx
// WRONG — errors is not an array
{errors.map((e) => <p>{e}</p>)}

// RIGHT — access the specific field, then its .message
{errors.email && <p>{errors.email.message}</p>}
```

For nested fields (say, `address.city`), the errors object nests the same way: `errors.address?.city?.message`. Forgetting the optional-chaining here is a frequent source of "cannot read property of undefined" crashes, since a field with no error simply won't have a key in `errors` at all.

**Mistake 4 — Destructuring `formState` incorrectly and losing reactivity.**

```jsx
// Subtle bug: reading formState once, outside of render-tracked destructuring,
// can miss updates in some setups
const formState = useForm().formState;
const hasErrors = Object.keys(formState.errors).length > 0; // may not update as expected
```

RHF uses a subscription model (a small proxy) to know which parts of `formState` your component actually reads, so it can re-render only when *those specific* parts change. Destructure what you need directly from the hook's return value — `const { formState: { errors, isSubmitting } } = useForm()` — rather than storing the whole object separately, so RHF's proxy can correctly detect what you're using.

**Mistake 5 — Treating async validation like it's free.**

Wiring an availability check straight into `onChange` with no debounce means a genuine network request fires on every keystroke of a username field. That's not just wasteful — it can also cause race conditions, where an earlier, slower request resolves *after* a later one and overwrites its (more current) result. Always debounce, and prefer resolving on blur rather than change for anything that leaves the browser.

---

## 10. Interview Answer — Why Is This More Performant?

If you're asked "why is React Hook Form considered more performant than a form built with `useState` per field," here's a tight answer:

> "Because it manages fields as uncontrolled inputs. Instead of storing every field's value in React state and re-rendering the whole component tree on every keystroke — the way a `useState`-per-field form does — React Hook Form attaches refs directly to the DOM inputs via `register()`, and lets the browser's native input behavior handle keystrokes without involving React at all. It only reads the current values off those refs when it actually needs them, like on submit or blur. Re-renders are triggered surgically, only for the specific fields whose visible state actually changes — like an error message appearing — via an internal subscription model, rather than blanket re-rendering every field on every keystroke anywhere in the form. On a large form with many fields, this decouples 'cost of typing' from 'cost of rendering,' which is exactly the bottleneck a naive controlled-forms approach runs into at scale."

---

## 11. Hands-On Exercises

**Exercise 1 — Convert a hand-rolled form**

Take a login form built the "hard way," with one `useState` per field (`email`, `password`) plus manual `onChange` handlers and manual if-checks on submit. Rewrite it using `useForm`, `register`, and `handleSubmit`. Confirm the submitted data object shape matches what your manual version produced.

**Exercise 2 — Build the schema**

Write a Zod schema for a 5-field "Create Account" form: `username` (min 3 chars), `email` (valid email), `password` (min 8 chars), `confirmPassword` (must match `password` — hint: use `.refine()` on the object schema, comparing both fields), and `age` (a number, at least 13). Wire it into `useForm` via `zodResolver` and render errors for each field.

**Exercise 3 — Timing strategy comparison**

Build the same 3-field form three times, differing only in the `mode` option: once with `onSubmit`, once with `onBlur`, once with `onChange`. Fill out each version the same way (deliberately typing an invalid email first, then correcting it) and write down, in your own words, the difference in how each version feels to use.

**Exercise 4 — Async username check**

Add a `username` field with an async `.refine()` check against a fake `/api/check-username` endpoint (you can mock it with a `setTimeout` that resolves `{ available: false }` for the string `"admin"` and `true` for everything else). Add a debounce so the check doesn't fire on every keystroke, and show a "Checking availability..." indicator using `formState.isValidating`.

**Exercise 5 — Find the bug**

Given this snippet, identify all three mistakes from Section 9 that are present, and fix them:

```jsx
function ProfileForm() {
  const { register, handleSubmit, formState } = useForm();
  const errors = formState.errors;

  return (
    <form onSubmit={handleSubmit(onValid)}>
      <input name="displayName" onChange={(e) => console.log(e.target.value)} />
      {errors.map((err) => <p>{err}</p>)}
      <button type="submit">Save</button>
    </form>
  );
}
```

**Exercise 6 — Measure the re-render difference**

Build two versions of the same 10-field form — one with `useState` per field, one with React Hook Form — and add a `console.log("re-rendered")` at the top of each component's function body. Type into a single field in each version and count how many times "re-rendered" logs in each case while you type a 10-character value. Explain the difference you observe in terms of Section 4's internal-working diagram.

---

## 12. Interview Q&A

**Q1: What problem does React Hook Form solve that hand-rolled `useState` forms don't handle well?**

A: At scale (many fields, each needing validation, touched/dirty tracking, and error messages), `useState`-per-field forms become unmanageable to write and cause the entire form to re-render on every keystroke in any field. React Hook Form centralizes field tracking, validation, and submission state, and avoids the re-render-per-keystroke cost by managing fields as uncontrolled inputs internally.

---

**Q2: Are React Hook Form's inputs controlled or uncontrolled by default?**

A: Uncontrolled. `register()` attaches a ref (plus native `onChange`/`onBlur` listeners) directly to the DOM input, rather than storing the value in React state. The DOM manages the input's value the same way it would with no framework involved; RHF reads the value off the ref only when it needs it (submit, blur-triggered validation, etc.).

---

**Q3: Why does using uncontrolled inputs internally make React Hook Form faster than a controlled `useState` approach?**

A: Because typing a keystroke doesn't, by itself, trigger a React re-render. In a controlled form, every keystroke calls `setState`, which re-renders the whole component. In RHF, the browser's native input handling takes each keystroke, and RHF only triggers a re-render when something visible actually needs to change — like an error message appearing — via an internal subscription, and only for the specific field(s) affected.

---

**Q4: What does `register()` actually do?**

A: It returns an object containing a `ref`, `name`, `onChange`, and `onBlur`, meant to be spread directly onto an `<input>` (or forwarded to a custom input component's underlying DOM node). This is how RHF attaches itself to a field, tracks its value via the ref, and knows to include it when `handleSubmit` gathers form data.

---

**Q5: What happens if you forget to `register()` an input?**

A: RHF has no ref to that field and doesn't know it exists. It won't appear in the data object passed to your submit handler, and it won't be validated, regardless of any validation rules you thought you'd defined for it elsewhere.

---

**Q6: What is a "resolver" in the context of React Hook Form?**

A: A resolver is an adapter function, provided via `useForm({ resolver })`, that translates a schema-validation library's (e.g. Zod's or Yup's) validation result into the internal shape React Hook Form expects for populating `formState.errors`. `@hookform/resolvers` provides ready-made resolvers like `zodResolver` and `yupResolver`.

---

**Q7: What's the advantage of schema-based validation (Zod/Yup) over inline `register()` validation rules?**

A: All validation rules live in one declarative object, separate from JSX markup, making them easier to read, test, and reuse (e.g. the same schema can validate API request bodies, not just form fields). In TypeScript, the schema can also be the single source of truth for the form's data type, via type inference, preventing the form's shape and its validation rules from drifting apart.

---

**Q8: Compare `onSubmit`, `onBlur`, and `onChange` validation timing in terms of UX.**

A: `onSubmit` only validates when the form is submitted — quiet while typing, but can surface a wall of errors all at once, possibly for mistakes made long ago. `onChange` validates on every keystroke — the fastest feedback, but can feel naggy, flagging errors before the user has even finished typing a field. `onBlur` validates when the user leaves a field — a middle ground that gives feedback promptly, right after a field is finished, without interrupting active typing. `onBlur` is the generally recommended default for most real-world, multi-field forms.

---

**Q9: What is `reValidateMode` and why would you set it differently from `mode`?**

A: `mode` controls when a field is validated the first time; `reValidateMode` controls when it's re-checked after it has already shown an error. A common pattern is `mode: "onBlur"` paired with `reValidateMode: "onChange"` — wait until the user leaves a field before the first check (avoiding premature nagging), but once an error is showing, re-validate live as they type, so they get instant confirmation the moment they've fixed it.

---

**Q10: Why can't async validation (like a username-availability check) just use `mode: "onChange"` directly?**

A: Because it involves a network request. Firing that request on every keystroke would hammer the server, waste bandwidth, and can cause race conditions where an older, slower response resolves after a newer one and overwrites its result. Async checks should be debounced (waiting for a pause in typing) and are often better tied to `onBlur` than `onChange`, since there's rarely a need to check availability before the user has finished typing a candidate value.

---

**Q11: How would you show a loading indicator while an async validation check is in flight?**

A: Use `formState.isValidating`, which React Hook Form sets to `true` while any validation (including an async schema `.refine()`) is currently running, and `false` once it resolves. Render a "Checking..." message or spinner conditionally on that flag.

---

**Q12: What shape is `formState.errors`, and what's a common mistake when reading it?**

A: It's an object mirroring your form's field structure, not a flat array — each key present corresponds to a field that currently has a validation error, and its value is an object with a `.message` (and a `.type`). A common mistake is treating it like an array (e.g. `errors.map(...)`), or forgetting optional chaining for nested fields like `errors.address?.city?.message`, since fields with no error simply have no key in the object at all.

---

**Q13: Why does React Hook Form recommend destructuring `formState` directly from `useForm()`'s return value, rather than storing it in a separate variable first?**

A: RHF uses an internal proxy/subscription mechanism on `formState` to detect exactly which properties (`errors`, `isSubmitting`, `isValidating`, etc.) a given component actually reads, so it can re-render that component only when those specific properties change. Reading `formState` indirectly, or storing it separately before accessing its fields, can interfere with that detection and cause the component to miss updates it should have reacted to.

---

**Q14: What is `handleSubmit` responsible for, precisely?**

A: It wraps your own "on valid" submit function. When the form's submit event fires, `handleSubmit` first runs all registered fields through validation (whether inline rules or a schema resolver). If validation passes, it calls your function with a single data object containing every registered field's current value, read from their refs. If validation fails, your function is never called, and `formState.errors` is populated instead so the UI can display the failures.

---

**Q15: In what scenario would you still reach for controlled inputs (`useState` + `value`/`onChange`) instead of React Hook Form's uncontrolled `register()` approach, even knowing RHF is generally more performant?**

A: When you need the component's rendered output to depend on the value on every single keystroke — for example, a live character counter, a search-as-you-type autocomplete list, or an input that reformats itself as you type (like inserting dashes into a phone number). React Hook Form does support controlled usage too, via its `Controller` component or the `useController`/`watch` APIs, for exactly these cases — but the plain `register()` path intentionally avoids per-keystroke re-renders, so when you truly need the render to track every keystroke, you opt back into that cost deliberately, rather than getting it by default everywhere.
