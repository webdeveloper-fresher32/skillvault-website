# 01 — Controlled vs Uncontrolled Forms

> "In an uncontrolled input, the DOM remembers what you typed. In a controlled input, React has to be told — and React only knows what it's told."

---

## Table of Contents

1. [The Problem: Where Does Form Data Actually Live?](#1-the-problem-where-does-form-data-actually-live)
2. [A Real-World Analogy](#2-a-real-world-analogy)
3. [Basic Definitions](#3-basic-definitions)
4. [How a Controlled Input Actually Works, Step by Step](#4-how-a-controlled-input-actually-works-step-by-step)
5. [Examples: Controlled and Uncontrolled Side by Side](#5-examples-controlled-and-uncontrolled-side-by-side)
   - 5.1 [Controlled Input](#51-controlled-input)
   - 5.2 [Uncontrolled Input with useRef](#52-uncontrolled-input-with-useref)
   - 5.3 [Multiple Fields: One State Object vs Many useState Calls](#53-multiple-fields-one-state-object-vs-many-usestate-calls)
   - 5.4 [File Inputs: The Mandatory Exception](#54-file-inputs-the-mandatory-exception)
6. [Controlled vs Uncontrolled: Comparison Table](#6-controlled-vs-uncontrolled-comparison-table)
7. [Common Mistakes and Confusions](#7-common-mistakes-and-confusions)
8. [Interview Answer](#8-interview-answer)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Problem: Where Does Form Data Actually Live?

Here's a scenario you'll hit in almost every React app you ever build.

You've got a signup form. Email, password, confirm password. The requirements are the usual ones:

```
- Disable the "Submit" button until all fields are filled in
- Show "passwords don't match" the moment the user types a mismatched confirm-password
- Send { email, password } to an API when the user clicks submit
```

Now think about plain HTML for a second. If you write:

```html
<input type="text" id="email" />
```

...and the user types "alice@example.com" into it, where does that text live? It lives in the browser's DOM — inside the actual `<input>` element, in a property called `value`. The browser manages it entirely on its own. You never told it to store anything; it just does, because that's what an `<input>` does.

That's normally fine — for a plain HTML form that just gets submitted the old-fashioned way (a full page POST), the browser handling its own input state is exactly what you want.

But React apps aren't plain HTML forms. You need to:

```
- Know the current value of every field, in JavaScript, at any moment
- Decide whether the submit button should be enabled — that's a JS decision
- Compare two fields against each other for validation
- Send the values somewhere via fetch/axios, not a browser form POST
```

All of that requires the value to exist somewhere JavaScript can read it *right now*, not "only when the form gets submitted." And the DOM's own internal state is invisible to your component's logic unless you go and ask for it.

So the real question this lesson answers is: **who owns the current value of an input — the DOM, or your React state?** That single decision is the entire controlled-vs-uncontrolled question. Everything else in this lesson is detail.

---

## 2. A Real-World Analogy

Picture two ways of taking down someone's spoken words.

**Controlled = dictation.**

Someone speaks a sentence, word by word. You write down *every single word* as you hear it, and you read back exactly what's written so far so the speaker can see it too. If they say "no wait, change that last word," you erase it and write the new one immediately. At every instant, what's on your paper matches — exactly — what's been said. You are the single source of truth for what's been recorded, and you're actively participating in every keystroke, so to speak.

That's a controlled input. React holds the value in state, gives it to the input to *display*, and listens to every single change so it can update its own copy immediately.

**Uncontrolled = a notepad on someone else's desk.**

Someone jots notes on their own notepad, at their own desk, whenever they feel like it. You don't watch them write. You don't know what's on the notepad right now. But if you ever *need* to know — say, when they hand the form in — you walk over and read the notepad at that moment.

That's an uncontrolled input. The DOM owns the value the whole time. React doesn't watch every keystroke — it just reaches in and reads the current value (via a `ref`) only when it actually needs to, usually at submit time.

Neither approach is "wrong." Dictation is exactly what you want when you need to react to every word as it's spoken — like live validation. A notepad is exactly what you want when you genuinely don't care what's on the page until the very end — like a simple "read the value once, on submit" form.

---

## 3. Basic Definitions

Now that the mental picture is in place, here are the textbook definitions — which should now feel obvious rather than abstract.

**Controlled component:** a form element whose `value` is driven by React state, and whose changes are pushed back into that state via an `onChange` handler. React is the single source of truth. The DOM's displayed value is always just a reflection of state.

```jsx
<input value={email} onChange={(e) => setEmail(e.target.value)} />
```

**Uncontrolled component:** a form element that manages its own value internally, in the DOM, the same way plain HTML always has. React doesn't track every keystroke — it reads the value only when needed, using a `ref`.

```jsx
<input ref={emailRef} defaultValue="" />
// later: emailRef.current.value
```

Notice the uncontrolled version uses `defaultValue`, not `value`. That's not a small stylistic choice — it's the exact signal that tells React "let the DOM manage this one, I'm just setting the *initial* value."

> **Memory hook:** "Controlled = dictation, React writes down every word as it's spoken. Uncontrolled = a notepad on someone else's desk, only read when you actually ask for it."

---

## 4. How a Controlled Input Actually Works, Step by Step

This is the part worth slowing down for, because it's the loop you'll be reasoning about every single time you touch a form in React.

Here's the mental model, laid out as a cycle:

```text
┌─────────────────────────────────────────────────────────────────┐
│                  The Controlled Input Loop                      │
│                                                                   │
│   1. React state holds the current value                        │
│         const [email, setEmail] = useState("");                 │
│                          |                                       │
│                          v                                       │
│   2. That state is passed to the input's value prop             │
│         <input value={email} ... />                             │
│                          |                                       │
│                          v                                       │
│   3. The DOM renders the input showing that value                │
│         (screen shows: empty box)                                │
│                          |                                       │
│                          v                                       │
│   4. User types a character, say "a"                             │
│         The DOM briefly *wants* to show "a" itself               │
│                          |                                       │
│                          v                                       │
│   5. The onChange event fires, carrying e.target.value = "a"    │
│                          |                                       │
│                          v                                       │
│   6. Your handler calls setEmail("a")                            │
│                          |                                       │
│                          v                                       │
│   7. React schedules a re-render                                 │
│                          |                                       │
│                          v                                       │
│   8. Component re-runs, email is now "a"                         │
│                          |                                       │
│                          v                                       │
│   9. value={email} is passed to the input again — now as "a"    │
│                          |                                       │
│                          v                                       │
│   10. DOM value is set to "a" (matches what the user just typed) │
│                          |                                       │
│                          └──────────── loop back to step 4 ──────┘
└─────────────────────────────────────────────────────────────────┘
```

Here's the detail that trips people up: in step 4, the DOM *does* briefly show the typed character on its own — browsers update the visible text of an input as you type, that's just how a text box works at the OS/browser level. But React then, on the very next render, sets `value` again based on state. If state agrees with what was typed (the normal case — you called `setEmail(e.target.value)`), nothing looks different to the user. The DOM's "own" value and React's state-driven value happen to match, so the re-render is invisible.

But — and this is the important consequence — **if your onChange handler does anything other than faithfully copying `e.target.value` into state**, the displayed value will visibly snap to whatever state says, even overriding what the user just typed. This is actually a *feature*, not a bug: it's exactly how you build things like "always uppercase this field" or "strip non-digit characters from a phone number as you type."

```jsx
function PhoneInput() {
  const [phone, setPhone] = useState("");

  function handleChange(e) {
    // Strip anything that isn't a digit, always
    const digitsOnly = e.target.value.replace(/\D/g, "");
    setPhone(digitsOnly);
  }

  return <input value={phone} onChange={handleChange} />;
}
```

Try typing a letter into that input. It'll flash onto the screen for a fraction of a render, then vanish — because `onChange` fires, your handler strips it out before calling `setPhone`, and the next render forces the input back to whatever's actually in state. That's the controlled loop working exactly as designed: **the DOM never wins an argument with state.** State is passed to `value` on every render, no exceptions.

---

## 5. Examples: Controlled and Uncontrolled Side by Side

### 5.1 Controlled Input

```jsx
import { useState } from "react";

function ControlledEmailField() {
  const [email, setEmail] = useState("");

  return (
    <div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      <p>You typed: {email}</p>
      <button disabled={email.length === 0}>Submit</button>
    </div>
  );
}
```

Notice how naturally the requirements from Section 1 fall out of this:

```
- Disable submit until filled in?  → email.length === 0, right there in JSX
- Validate as they type?           → just read `email` in the render body
- Send { email } to an API?        → email is already sitting in a variable
```

None of that required "reaching into the DOM" for anything. The value was already in JavaScript, because React put it there.

---

### 5.2 Uncontrolled Input with useRef

```jsx
import { useRef } from "react";

function UncontrolledEmailField() {
  const emailRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    // Only NOW do we reach into the DOM and ask for the value
    console.log("Submitting:", emailRef.current.value);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" ref={emailRef} defaultValue="" placeholder="you@example.com" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

No `useState`. No `onChange`. React doesn't know what's in that box, keystroke by keystroke — and it doesn't need to. The component never re-renders while the user types, because nothing is calling `setState`. React only asks the DOM directly, through the ref, at the one moment it actually cares: submit time.

This is genuinely simpler code for a genuinely simpler requirement — "just get me the value when the form is submitted, I don't need to react to every keystroke." Don't reach for `useState` out of habit if you don't actually need per-keystroke reactivity.

---

### 5.3 Multiple Fields: One State Object vs Many useState Calls

Real forms rarely have just one field. You've got two main options for structuring the state, and each has a real tradeoff.

**Option A — one `useState` per field:**

```jsx
function SignupFormA() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <form>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
      <input
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        type="password"
      />
    </form>
  );
}
```

Simple, explicit, and each field's setter is trivial to read. The downside shows up once you have 10+ fields — you're writing the same three lines (state, setter, onChange) over and over, and passing eight separate values around gets noisy.

**Option B — one state object for the whole form:**

```jsx
function SignupFormB() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: ""
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <form>
      <input name="email" value={form.email} onChange={handleChange} />
      <input name="password" value={form.password} onChange={handleChange} type="password" />
      <input
        name="confirmPassword"
        value={form.confirmPassword}
        onChange={handleChange}
        type="password"
      />
    </form>
  );
}
```

One `handleChange` handles every field, using the input's `name` attribute as the key. This scales much better as the form grows. The tradeoff: **every keystroke in any field re-creates the entire `form` object** (because of that `...prev` spread), which triggers a re-render of every input tied to `form`. For a handful of fields this is completely irrelevant performance-wise — React re-rendering a form component on a keystroke is cheap. It only starts to matter in genuinely large, complex forms, at which point people usually reach for a dedicated form library instead of hand-rolling either approach.

**Rule of thumb:** a handful of independent, unrelated fields → separate `useState` calls are perfectly fine and arguably more readable. A form with many related fields, especially if they're validated together or submitted as one payload → one state object is usually less code overall.

---

### 5.4 File Inputs: The Mandatory Exception

Every input type we've discussed can go either way — controlled or uncontrolled, your choice. File inputs are the one exception, and it isn't a style choice, it's a hard browser security rule.

```jsx
function AvatarUpload() {
  const fileInputRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    const file = fileInputRef.current.files[0];
    console.log("Selected file:", file?.name);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="file" ref={fileInputRef} />
      <button type="submit">Upload</button>
    </form>
  );
}
```

Why must this always be uncontrolled? Because a file input's `value` is deliberately **read-only from JavaScript's perspective**. Browsers do not allow a script to programmatically set what file is "selected" in a file picker — imagine the alternative: a malicious webpage silently setting `input.value = "C:\\Users\\you\\secret.txt"` and uploading it without you ever clicking anything. Browsers block exactly that scenario by making file input values impossible to set via code, full stop.

So this will not work, and React will actively complain if you try:

```jsx
// This is not possible — browsers refuse to let JS set a file input's value.
<input type="file" value={someFileName} onChange={...} />
```

You always read a file input via `.files` on a ref (or from `e.target.files` inside an `onChange`, if you do want to react to the selection — that part is fine, it's only *setting* the value that's forbidden). You never drive it with a `value` prop.

---

## 6. Controlled vs Uncontrolled: Comparison Table

| Aspect | Controlled | Uncontrolled |
|---|---|---|
| Who owns the current value | React state | The DOM itself |
| How you read the value | Already in a variable (state) | Reach in via `ref.current.value`, on demand |
| Triggers a re-render per keystroke | Yes — every `onChange` calls `setState` | No — DOM updates itself, component doesn't re-render |
| Live validation ("passwords don't match" as you type) | Easy — value is available on every render | Awkward — you'd have to attach your own listener and manage state anyway, defeating the point |
| Conditionally disabling a button based on input | Easy — just read state in JSX | Requires extra plumbing (a manual listener) |
| Formatting/transforming input as you type (e.g., strip non-digits) | Natural — done in the `onChange` handler | Not really possible without becoming controlled |
| Boilerplate for a simple "read on submit" form | More than necessary | Minimal — just a ref and a submit handler |
| Integrating with non-React code / a legacy library that wants a raw DOM node | Awkward | Natural — a ref *is* the raw DOM node |
| File inputs (`<input type="file">`) | Not possible — browsers forbid setting the value | Always required |
| React warning if misused | Warns if `value` is given without `onChange` | Warns if you switch a field from uncontrolled to controlled (or vice versa) mid-lifecycle |

---

## 7. Common Mistakes and Confusions

### Mistake 1 — `value` without `onChange` (the "my input won't update" trap)

This is probably the single most common controlled-forms bug, and it usually happens when someone is *midway* through converting an uncontrolled input into a controlled one.

```jsx
function BrokenInput() {
  const [email, setEmail] = useState("");

  // Bug: value is provided, but nothing ever calls setEmail
  return <input value={email} />;
}
```

What happens when you try to type into this? Nothing. Literally nothing appears. Here's why, walking back through the loop from Section 4: the DOM tries to show what you typed, but on every render React forces `value` back to `email` — which is still `""`, because nothing ever calls `setEmail`. Every keystroke gets silently overwritten back to empty, instantly. From the user's point of view, the input is completely frozen — it *looks* like a normal text box, but it's actually a **read-only field wearing a text-box costume**.

React also warns you about this in the console:

```
Warning: You provided a `value` prop to a form field without an `onChange` handler.
This will render a read-only field. If the field should be mutable use `defaultValue`.
Otherwise, set either `onChange` or `readOnly`.
```

Read that warning carefully — React is telling you exactly what's going on and exactly how to fix it. Three ways out:

```
1. You meant it to be controlled and editable → add the missing onChange
2. You meant it to be genuinely read-only     → add the readOnly prop, keep value
3. You just wanted an initial value, not full control → switch value to defaultValue
```

Almost always, in practice, option 1 is what people actually meant — they forgot the `onChange` line while wiring things up.

> **Memory hook:** "`value` without `onChange` is a padlock, not a text box — React will keep snapping it shut on every keystroke."

---

### Mistake 2 — Switching a component between controlled and uncontrolled across renders

React expects an input to commit to one mode — controlled or uncontrolled — for its whole lifetime. Flip-flopping between them mid-render is a second, related warning:

```jsx
function FlipFlop({ initialEmail }) {
  // If initialEmail starts as undefined, then later becomes a real string,
  // this input silently switches from uncontrolled to controlled.
  const [email, setEmail] = useState(initialEmail);

  return <input value={email} onChange={(e) => setEmail(e.target.value)} />;
}
```

If `initialEmail` is `undefined` on the first render, then `value={email}` is `undefined` too — and an input with `value={undefined}` is treated by React as **uncontrolled** (the DOM manages it, just like `defaultValue`). If a prop update later makes `initialEmail` a real string, the same input suddenly becomes controlled. React detects this and warns:

```
Warning: A component is changing an uncontrolled input to be controlled.
This is likely caused by the value changing from undefined to a defined value,
which should not happen. Decide between using a controlled or uncontrolled
input element for the lifetime of the component.
```

The fix is simple once you see it: never let `value` be `undefined`. Give it a real fallback from the very first render:

```jsx
const [email, setEmail] = useState(initialEmail ?? "");
```

Now `email` is always a string, `value={email}` is always defined, and the input is controlled from the very first render onward — no mode-switching, no warning.

---

### Mistake 3 — Trying to control a file input's value

Covered in depth in Section 5.4, but worth repeating as a "mistake" in its own right because it's easy to attempt out of sheer habit once you're used to controlling everything else:

```jsx
// Don't do this — browsers will not allow it, this is not a React limitation
<input type="file" value={fileName} onChange={handleFileChange} />
```

File inputs are always uncontrolled. Read the selected file(s) from `e.target.files` inside `onChange` if you need to react to the selection (e.g., to show a filename preview), or from `ref.current.files` at submit time — but never attempt to *set* `value`.

---

## 8. Interview Answer

"A controlled component's form value lives in React state — the input's `value` prop is set from state, and an `onChange` handler pushes every keystroke back into that state, so React is the single source of truth and the value is available in JavaScript at all times, which makes live validation, conditional disabling, and input formatting straightforward. An uncontrolled component leaves the value living in the DOM itself, the same way plain HTML inputs always have, and React only reads it on demand via a ref — usually at submit time — which means less code and no per-keystroke re-renders, at the cost of not having the value available for anything that needs to react as the user types. File inputs are the one case where the browser forces uncontrolled behavior for security reasons: JavaScript is never allowed to set what file is selected. The classic bug in this area is passing a `value` prop without an `onChange` handler, which silently produces a frozen, read-only-looking input and triggers a React console warning — the fix is either to add the missing handler, add `readOnly` if that was intentional, or switch to `defaultValue` if only an initial value was needed."

---

## 9. Hands-On Exercises

**Exercise 1 — Build a controlled login form**

Build a `LoginForm` component with `email` and `password` fields, both controlled via `useState`. Disable the submit button until both fields are non-empty. Display the current values below the form as you type, to visually confirm state and the DOM are in sync.

**Exercise 2 — Convert an uncontrolled form to controlled**

Start from this broken/uncontrolled version:

```jsx
function NameForm() {
  const nameRef = useRef(null);
  return (
    <form>
      <input ref={nameRef} defaultValue="" />
    </form>
  );
}
```

Convert it to a controlled component that displays a live character count ("12/50 characters") below the input as the user types. Explain, in a comment, why this requirement is difficult to satisfy with the uncontrolled version.

**Exercise 3 — Reproduce the "frozen input" bug on purpose**

Write an input with a `value` prop but no `onChange` handler. Run it, try to type into it, and confirm it does nothing. Check your browser console for the exact React warning text. Then fix it three different ways: (a) add the missing `onChange`, (b) add `readOnly` instead, (c) switch to `defaultValue`. Note how the input's behavior differs in each of the three fixes.

**Exercise 4 — Trigger the controlled/uncontrolled switch warning on purpose**

Write a component that takes a prop `startingValue` and initializes state with `useState(startingValue)`, then renders `<input value={value} onChange={...} />` without a fallback. Render it first with `startingValue={undefined}`, then update it (e.g., via a button click that re-renders the parent with a real string prop) so `startingValue` becomes `"hello"`. Confirm the console warning appears. Fix it using `useState(startingValue ?? "")` and confirm the warning disappears.

**Exercise 5 — Build a multi-field signup form both ways**

Build the same three-field signup form (email, password, confirmPassword) twice: once using three separate `useState` calls, and once using a single state object with one shared `handleChange`. Add a validation message that appears when `password !== confirmPassword`. Compare how many lines each approach takes, and note at what point (in your own judgment) you'd switch from one style to the other.

**Exercise 6 — File upload with a preview**

Build an uncontrolled file input (using a ref) that lets the user pick an image, and displays a filename plus file size (in KB) below the input the moment a file is selected — without ever attempting to set the input's `value`. Use the `onChange` event's `e.target.files[0]` to read the selected file's metadata.

---

## 10. Interview Q&A

**Q1: What is the fundamental difference between a controlled and an uncontrolled component in React?**

A: In a controlled component, the form element's `value` is driven by React state, and an `onChange` handler updates that state on every change — React is the single source of truth. In an uncontrolled component, the DOM manages the value internally, the way a plain HTML input always has, and React only reads the current value on demand through a ref, rather than tracking every change.

---

**Q2: Why would you ever choose an uncontrolled input over a controlled one?**

A: When you don't need the value available to JavaScript on every keystroke — for example, a simple form where you only care about the values at submit time. Uncontrolled inputs need less code (no state, no `onChange` handler), avoid a re-render on every keystroke, and are the natural choice when integrating with non-React code that expects to manage a raw DOM node itself.

---

**Q3: Why must file inputs always be uncontrolled?**

A: Browsers deliberately forbid JavaScript from programmatically setting a file input's `value`, as a security measure — otherwise a script could silently "select" an arbitrary file from the user's disk and upload it without their knowledge. Because you can never assign a value to `input.value` for `type="file"`, you can only read the selection via `e.target.files` or `ref.current.files`; you cannot control it in the React sense.

---

**Q4: What causes the "You provided a `value` prop to a form field without an `onChange` handler" warning, and what actually happens to the input when this occurs?**

A: It happens when `value` is set from state or a prop but no `onChange` handler is attached to update that state. Because React re-applies the `value` prop on every render and nothing ever changes the underlying state, every keystroke the user makes gets immediately overwritten back to the original value — the input becomes effectively read-only, even though it looks like a normal editable text box.

---

**Q5: What are the three valid fixes for an input that has `value` but no `onChange`?**

A: (1) Add the missing `onChange` handler if the field was meant to be editable and controlled. (2) Add the `readOnly` prop if the field genuinely should not be editable, keeping `value` as is. (3) Switch from `value` to `defaultValue` if you only wanted to set an initial value and let the DOM manage it from there — i.e., make it uncontrolled.

---

**Q6: What causes React's "changing an uncontrolled input to be controlled" warning?**

A: It happens when an input's `value` prop is `undefined` on an early render (which React treats as uncontrolled, same as omitting `value` entirely) and then becomes a defined string on a later render. React expects a form element to commit to one mode for its entire lifetime, and switching modes mid-lifecycle produces this warning. The usual cause is initializing state from a prop that starts out `undefined`, such as data that hasn't finished loading yet.

---

**Q7: How do you prevent the controlled/uncontrolled switching warning when initial data comes from an asynchronous source, like an API response?**

A: Give the state a defined fallback value from the very first render, so `value` is never `undefined` — for example `useState(initialValue ?? "")` instead of `useState(initialValue)`. That way the input is controlled (with an empty string) from the first render onward, and later populates with real data without ever passing through an "uncontrolled" phase.

---

**Q8: Walk through what happens, step by step, when a user types a character into a controlled input.**

A: The DOM briefly reflects the typed character on its own, as any text input naturally does. The `onChange` event fires, carrying the new value via `e.target.value`. The handler calls the state setter with that value. React schedules and performs a re-render. The component function re-runs with the updated state. The input's `value` prop is passed again, now reflecting the new state. React applies that value to the DOM node, which — assuming the handler just copied the typed value through unchanged — matches what the user already sees, so nothing visibly changes.

---

**Q9: If a controlled input's `onChange` handler transforms the typed value (e.g., stripping non-digit characters), what visibly happens on screen?**

A: The character briefly appears as typed, but on the very next render the input's displayed value snaps to whatever the transformed state actually is — for instance, a typed letter in a digits-only phone field disappears immediately, because the handler never puts non-digit characters into state, and React always re-applies `value` from state on every render, overriding whatever the DOM briefly showed.

---

**Q10: What's the tradeoff between using one `useState` call per field versus a single state object for a multi-field form?**

A: Separate `useState` calls per field are simple and explicit but become repetitive and harder to pass around as the field count grows. A single state object with one shared `handleChange` (keyed by the input's `name` attribute) scales better for larger forms and centralizes the update logic, but every keystroke replaces the whole object (via a spread), which re-renders every field tied to that state — a cost that's negligible for small forms but worth considering for very large or complex ones.

---

**Q11: Can you make a text input's value uneditable without fully controlling it via state?**

A: Yes — pass the `readOnly` prop alongside `value` (with no `onChange` needed, since `readOnly` tells React the missing handler is intentional and suppresses the warning). This differs from `disabled`, which also prevents focus and excludes the field from form submission; `readOnly` still allows focus and selection/copying, it just blocks editing.

---

**Q12: Why does an uncontrolled input typically use `defaultValue` instead of `value`?**

A: `defaultValue` sets only the input's *initial* value when it first mounts and then lets the DOM take over managing it from there, which is exactly the uncontrolled contract. `value` tells React to actively re-apply that value on every render, which is the controlled contract — using `value` on an input with no corresponding `onChange` accidentally locks it, since there's no state to update it.

---

**Q13: How would you read a selected file's name and size without making the file input controlled?**

A: Attach an `onChange` handler (reading is allowed, only setting is forbidden) that reads `e.target.files[0]`, which is a `File` object exposing `.name` and `.size`, and store those details in regular React state for display purposes. Alternatively, attach a `ref` to the input and read `ref.current.files[0]` at submit time. Either way, you never pass a `value` prop to the file input itself.

---

**Q14: In a form with live "passwords don't match" validation, why is a controlled approach almost mandatory?**

A: The validation message needs to update on every keystroke as the user types into either the password or confirm-password field, which means the component needs to re-render with the current values of both fields available in JavaScript at all times. That's exactly what controlled inputs provide for free, via state. An uncontrolled approach would require manually attaching your own `onChange`-style listener and storing the value somewhere reactive anyway — at which point you've essentially reinvented a controlled component, just without React's built-in support for it.

---

**Q15: Is a controlled input inherently slower than an uncontrolled one, since it re-renders on every keystroke?**

A: For the overwhelming majority of forms, no — React re-rendering a form component on a keystroke is cheap, and the difference is imperceptible. It can become a genuine concern in forms with a very large number of fields all tied to one shared state object, where every keystroke re-renders far more of the tree than necessary; in those cases, techniques like splitting state per-field, memoizing field components, or reaching for a dedicated form library (which manages subscriptions more surgically) become worth considering — but this is an optimization for a real, measured problem, not a reason to default to uncontrolled inputs everywhere.
