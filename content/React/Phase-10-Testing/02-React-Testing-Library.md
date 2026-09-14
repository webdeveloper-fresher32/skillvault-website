# 02 — React Testing Library

> "The more your tests resemble the way your software is used, the more confidence they can give you."

---

## Table of Contents

1. [The Problem: Tests That Break When Nothing Actually Broke](#1-the-problem-tests-that-break-when-nothing-actually-broke)
2. [The Core Philosophy: Test Behavior, Not Implementation](#2-the-core-philosophy-test-behavior-not-implementation)
3. [What Is React Testing Library, Really?](#3-what-is-react-testing-library-really)
4. [render() and screen](#4-render-and-screen)
5. [Choosing the Right Query: getBy vs queryBy vs findBy](#5-choosing-the-right-query-getby-vs-queryby-vs-findby)
6. [Query Priority: Why getByRole Beats getByTestId](#6-query-priority-why-getbyrole-beats-getbytestid)
7. [Simulating User Interaction with userEvent](#7-simulating-user-interaction-with-userevent)
8. [Full Worked Example: A Component That Fetches Data](#8-full-worked-example-a-component-that-fetches-data)
9. [Comparison Tables](#9-comparison-tables)
10. [Common Mistakes](#10-common-mistakes)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The Problem: Tests That Break When Nothing Actually Broke

Picture this. You've got a `Counter` component. You write a test for it — a good, honest, well-intentioned test:

```js
test('increments count', () => {
  const wrapper = shallowRender(<Counter />);
  wrapper.instance().handleIncrement();
  expect(wrapper.state('count')).toBe(1);
});
```

This test reaches straight into the component's insides — calling its internal method directly, then reading its internal state directly. It never touches a button. It never looks at what's on the screen. It just... pokes the component's guts and checks the guts moved.

It passes. Green checkmark. Ship it.

Then, three weeks later, a teammate refactors `Counter` to use a reducer instead of raw `useState`, and renames `handleIncrement` to `dispatch({ type: 'increment' })` internally. The button still says "+1". Clicking it still increments the number on screen. A real user notices **absolutely nothing different**.

But the test explodes. `wrapper.instance().handleIncrement is not a function`. Red build. Panic. Someone has to stop and "fix" a test that was never actually protecting anything a user cares about.

This is the exact pain that React Testing Library (RTL) was built to prevent. The bug here isn't in the component — it's in the test. The test was coupled to *how* the component worked internally, not to *what* the component does for the person using it.

---

## 2. The Core Philosophy: Test Behavior, Not Implementation

Here's the sentence that matters more than any API in this file:

> "The more your tests resemble the way your software is used, the more confidence they can give you."

That's not marketing copy — it's the actual guiding principle written by Kent C. Dodds, the creator of RTL, and it explains every single design decision the library makes.

Let's unpack it slowly, because it changes how you should think about testing forever.

**Two ways to test the same component:**

```text
IMPLEMENTATION-DETAIL TESTING          BEHAVIOR TESTING (RTL's way)
------------------------------          ------------------------------
"Does the internal state              "If I click the button a user
 variable equal 1?"                    would click, does the number a
                                        user would see change to 1?"

wrapper.instance().handleIncrement()   const button = screen.getByRole(
wrapper.state('count') === 1              'button', { name: /increment/i })
                                        await userEvent.click(button)
                                        expect(screen.getByText('1'))
                                          .toBeInTheDocument()
```

Notice the difference isn't cosmetic — it's philosophical. The left column asks a question about the component's **internal wiring**. The right column asks a question about the component's **observable output**: what does a real person see and do?

Why does this matter so much?

**Reason 1 — refactors shouldn't break tests.** If you rewrite `Counter` from `useState` to `useReducer`, from a class to a function, from local state to a state library — none of that changes what the user sees or does. A behavior-based test survives all of it untouched. An implementation-based test breaks on every single one, even though nothing user-visible changed.

**Reason 2 — implementation-detail tests give you false confidence.** A test that checks `wrapper.state('count') === 1` can pass even if the actual rendered button is invisible, disabled, or the number never actually appears on screen due to a rendering bug. You "tested" something, but you didn't test the thing that matters: does the user actually see the number change?

**Reason 3 — it matches how your users experience the app.** Your users don't have access to your component's state or its instance methods. They have a screen, a mouse, and a keyboard. If your tests interact with the component the same way — reading what's rendered, clicking what's clickable, typing into what's typeable — then a passing test is genuinely strong evidence that a real person can use this feature successfully.

---

### Real-world analogy: the mystery shopper

Think of an RTL test as a **mystery shopper** sent to evaluate a retail store.

A mystery shopper does not walk into the back office and start flipping through the inventory ledger to check if the stock count variable is correct. They don't interrogate the cashier about which internal database they use. That's not their job, and frankly, it's not what the store's real customers experience or care about either.

Instead, the mystery shopper does exactly what a normal customer would do:

```text
Mystery Shopper Behavior                Store's Actual Customers
-------------------------               -------------------------
Walks up to the visible shelf       ==   Walk up to the visible shelf
Reads the visible price tag         ==   Read the visible price tag
Asks a staff member a question      ==   Ask a staff member a question
Pays at the visible register        ==   Pay at the visible register

NEVER: sneaks into the back office to inspect inventory records
NEVER: asks to see the internal accounting spreadsheet
```

If the mystery shopper can find the product, read the price, get help, and pay — the store passes. It doesn't matter one bit whether the back office uses a spreadsheet or a fancy ERP system internally. That's an implementation detail, invisible to the customer, and therefore irrelevant to whether the store actually works.

RTL tests your React components the exact same way: by pretending to be a real user, interacting only with what's visible and clickable, never reaching behind the curtain.

> **Memory hook:** "Test like a mystery shopper, not an auditor — interact with the shop floor, never the back office."

---

## 3. What Is React Testing Library, Really?

Now that the *why* is locked in, here's the plain definition:

**React Testing Library** is a testing utility that renders your React components into a lightweight, in-memory DOM (using `jsdom`, typically inside a runner like Jest or Vitest), and gives you a set of functions to **query that DOM the way a user would perceive it** — by visible text, by accessible role, by label — and to **interact with it** the way a user would — by clicking, typing, tabbing.

It deliberately does **not** give you easy access to:

- Component instances
- Internal state
- Internal props
- Private methods

There's no `wrapper.state()` or `wrapper.instance()` in RTL — and that's not a missing feature, it's the entire point. The library's official tagline states it directly:

> "The more your tests resemble the way your software is used, the more confidence they can give you."

RTL runs on top of a test runner (Jest or Vitest handle running the test files, `describe`/`test`/`expect`, and mocking) — RTL itself only handles the *rendering* and *querying* part. Think of Jest/Vitest as the stage and RTL as the actor performing on it the way a real audience member would watch.

---

## 4. render() and screen

Two building blocks you'll use in almost every single RTL test.

### `render()`

`render()` takes your component and mounts it into a detached DOM node (via `jsdom`), attached to `document.body`.

```js
import { render } from '@testing-library/react';

render(<Greeting name="Ana" />);
```

That's it. Your component is now "alive" in a fake browser environment, ready to be queried.

### `screen`

Older testing tools made you destructure query functions off the `render()` result:

```js
// old, clunkier style — still works, but not recommended
const { getByText } = render(<Greeting name="Ana" />);
getByText('Hello, Ana');
```

Modern RTL style uses `screen` instead — a single object that always points at the current `document.body`, so you don't have to juggle destructured variables across a growing test:

```js
import { render, screen } from '@testing-library/react';

render(<Greeting name="Ana" />);
screen.getByText('Hello, Ana');
```

Think of `screen` as literally "the screen the user is looking at." Every query — `getByRole`, `getByText`, `getByLabelText`, `getByPlaceholderText` — hangs off of it.

```js
screen.getByRole('button', { name: /submit/i });
screen.getByText(/welcome/i);
screen.getByLabelText('Email address');
screen.getByPlaceholderText('Search...');
```

---

## 5. Choosing the Right Query: getBy vs queryBy vs findBy

This is the single most commonly confused — and most commonly interview-tested — idea in all of RTL. Get this one fully locked in.

RTL gives you **three families of query**, and each family answers a fundamentally different question:

| Question you're asking | Query family |
|---|---|
| "This element should exist **right now**. Give it to me." | `getBy...` |
| "This element might **not exist**, and that's fine — tell me if it's there or not." | `queryBy...` |
| "This element doesn't exist **yet**, but it will show up soon after something async happens." | `findBy...` |

### getBy — "it's there, I know it, throw if I'm wrong"

`getByRole`, `getByText`, `getByLabelText`, etc. are **synchronous** and **throw an error immediately** if no matching element is found.

```js
screen.getByText('Welcome back'); // throws right away if not found
```

Use `getBy` when the element should already be in the DOM at the moment you check — no waiting required. It's your default choice for "assert this thing exists."

### queryBy — "tell me if it's absent, don't yell at me"

`queryByRole`, `queryByText`, etc. behave almost identically to `getBy`, with one critical difference: instead of throwing when nothing matches, they quietly return `null`.

```js
expect(screen.queryByText('Error: invalid password')).not.toBeInTheDocument();
```

This is the *only* correct tool for asserting that something is **absent**. If you used `getByText` here instead, it would throw the instant it didn't find a match — your test would crash with an error, rather than giving you a clean, readable assertion failure about absence.

### findBy — "it's not there yet, but wait for it"

`findByRole`, `findByText`, etc. are **asynchronous** — they return a Promise, and they keep retrying (polling) until either the element appears or a timeout is hit (default ~1000ms).

```js
const successMessage = await screen.findByText('Profile updated!');
```

Use `findBy` whenever the element appears **after something async resolves** — a fetch call completing, a `setTimeout`, a promise-based state update. This is exactly the situation where `getBy` would fail: `getBy` checks the DOM *immediately*, and if your fetch hasn't resolved yet, the element genuinely isn't there yet — `getBy` throws before the data even has a chance to arrive.

### The decision tree

```text
                    Do you need to find an element?
                                |
                +---------------+----------------+
                |                                 |
       Does it exist RIGHT NOW               Are you asserting
       (no async involved)?                  it is ABSENT?
                |                                 |
               YES                               YES
                |                                 |
                v                                 v
           getByRole()                       queryByRole()
        (throws if missing —              (returns null if missing —
         that's what you want,              perfect for
         it should already                  expect(...).not.toBeInTheDocument())
         be there)
                |
                v
      Will it appear LATER, after
      something async resolves
      (fetch, timer, promise)?
                |
               YES
                |
                v
          await findByRole()
       (polls the DOM until it shows
        up, or times out ~1000ms)
```

One more nuance worth calling out: each of these three families also has an "AllBy" variant — `getAllByRole`, `queryAllByText`, `findAllByRole` — which returns an **array** of matches instead of a single element, for when more than one match is expected (e.g., a list of list items).

> **Memory hook:** "getBy shouts if it's missing, queryBy shrugs, findBy waits patiently by the door."

---

## 6. Query Priority: Why getByRole Beats getByTestId

RTL doesn't just give you a pile of equally-valid query functions and shrug. The library explicitly recommends a **priority order**, and the reasoning behind it is genuinely one of the more valuable things you'll learn from this whole topic.

Here's the recommended order, from most preferred to least:

```text
1. getByRole          <-- prefer this almost always
2. getByLabelText      (great for form fields)
3. getByPlaceholderText
4. getByText           (great for non-interactive content)
5. getByDisplayValue
6. getByAltText
7. getByTitle
8. getByTestId         <-- last resort
```

### Why does this order exist?

Here's the insight: **accessible queries double as an accessibility check.**

When you write:

```js
screen.getByRole('button', { name: /submit/i });
```

you are only able to find that element *because* it exposes an accessible role (`button`) and an accessible name ("Submit") — the same information a **screen reader** uses to announce that element to a blind or low-vision user. If `getByRole('button', { name: /submit/i })` can find your button, that's actually decent evidence that a screen reader user can find and understand your button too.

Now flip it around. Imagine your "button" is actually a `<div onClick={...}>` styled to look like a button, with no `role="button"` and no accessible label:

```jsx
{/* Looks like a button visually — but isn't one, accessibility-wise */}
<div className="btn" onClick={handleSubmit}>Submit</div>
```

`screen.getByRole('button', { name: /submit/i })` will **fail to find this** — because it genuinely has no button role. And that failure isn't just annoying for your test — it's your test **catching a real accessibility bug**, for free, before a screen reader user ever hits it in production. That's the non-obvious insight here: writing tests the "recommended" RTL way isn't just a style preference, it's a built-in accessibility linter that runs every time you run your test suite.

Compare that to reaching straight for `getByTestId`:

```jsx
<div className="btn" data-testid="submit-btn" onClick={handleSubmit}>Submit</div>
```

```js
screen.getByTestId('submit-btn'); // finds it... but tells you nothing about accessibility
```

This test passes just fine. But it tells you *nothing* about whether a real user — using a mouse, a keyboard, or a screen reader — can actually find and activate this element. `data-testid` is invisible to everyone except your test suite; it's not part of the accessibility tree, not read by screen readers, not something a sighted user notices either. It's purely a testing hook, bolted on from outside.

That's why `getByTestId` sits dead last in the priority list — it's an escape hatch for the rare cases where there's genuinely no accessible way to identify an element (e.g., a purely decorative or highly dynamic container), not a first resort because it feels easiest to reach for.

### Rule of thumb

If you find yourself reaching for `getByTestId` as your *first* instinct, stop and ask: "Could a screen reader user find this element some other way?" If the honest answer is "no, not really" — that's not a testing problem, that's a bug in your markup, and RTL just surfaced it.

> **Memory hook:** "If a screen reader can't find it by role or label, neither can `getByRole` — and that's a bug in your app, not your test."

---

## 7. Simulating User Interaction with userEvent

Once you can find an element, the next question is: how do you actually *do something* to it — click it, type into it, tab to it?

RTL ships with a companion package, `@testing-library/user-event`, and it is **strongly preferred over** the lower-level `fireEvent` that comes bundled with RTL core.

### Why userEvent over fireEvent?

`fireEvent.click(button)` fires exactly one synthetic DOM event — a raw `click` — and nothing else.

A real click, though, is never *just* a click. In a real browser, clicking a button actually fires a whole sequence: `pointerdown`, `mousedown`, `focus`, `pointerup`, `mouseup`, then finally `click`. Typing a character into an input fires `keydown`, `keypress`, an `input` event with the character actually inserted, then `keyup` — not just one bare event.

`userEvent` simulates that **entire realistic sequence**, not just the single terminal event. That matters more than it sounds like it should — plenty of real bugs only show up when, say, a `focus` handler needs to run before a `click` handler, or when an `input` event (not just a raw keypress) is what actually updates the value RTL sees.

### Setting it up

```js
import userEvent from '@testing-library/user-event';

test('submits the form', async () => {
  const user = userEvent.setup(); // sets up the user-event session
  render(<LoginForm />);

  const emailInput = screen.getByLabelText(/email/i);
  await user.type(emailInput, 'ana@example.com');

  const submitButton = screen.getByRole('button', { name: /log in/i });
  await user.click(submitButton);

  expect(await screen.findByText(/welcome/i)).toBeInTheDocument();
});
```

Notice `userEvent.setup()` up front — modern `userEvent` (v14+) requires this call once per test, and it returns the `user` object you call `.click()`, `.type()`, `.tab()`, `.hover()`, `.selectOptions()` and friends on.

### The single most important rule here: **`await` everything**

Every `userEvent` method — `.click()`, `.type()`, `.tab()`, `.selectOptions()` — returns a **Promise**. That's because, under the hood, it's simulating a realistic sequence of events with the timing a real browser would use, and that simulation is asynchronous.

```js
// WRONG — missing await
user.click(submitButton);
expect(screen.getByText('Submitted!')).toBeInTheDocument(); // may run BEFORE the click finishes

// RIGHT
await user.click(submitButton);
expect(screen.getByText('Submitted!')).toBeInTheDocument();
```

Forget the `await`, and your assertion can race ahead of the interaction actually completing — leading to flaky, confusing, intermittent test failures that seem to make no sense at first glance.

> **Memory hook:** "userEvent doesn't just click — it acts out the whole scene. Wait for the curtain call: `await` it."

---

## 8. Full Worked Example: A Component That Fetches Data

Let's put everything together — `render`, `screen`, query priority, `getBy` vs `findBy`, and `userEvent` — in one realistic test.

**The component:**

```jsx
// UserProfile.jsx
import { useState } from 'react';

function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleLoad() {
    setLoading(true);
    const response = await fetch('/api/user/1');
    const data = await response.json();
    setUser(data);
    setLoading(false);
  }

  return (
    <div>
      <button onClick={handleLoad}>Load profile</button>
      {loading && <p>Loading...</p>}
      {user && <h2>{user.name}</h2>}
    </div>
  );
}

export default UserProfile;
```

**The test:**

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserProfile from './UserProfile';

// Mock the global fetch so the test doesn't hit a real network
beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({ name: 'Ana Rodriguez' }),
    })
  );
});

test('loads and displays the user name after clicking the button', async () => {
  const user = userEvent.setup();
  render(<UserProfile />);

  // 1. Before clicking, the profile heading definitely does NOT exist.
  //    We use queryBy here — getBy would THROW, and we want to assert absence.
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();

  // 2. Find the button the way a real user would — by its accessible role and name.
  const loadButton = screen.getByRole('button', { name: /load profile/i });

  // 3. Click it — and await, because userEvent.click() returns a Promise.
  await user.click(loadButton);

  // 4. The name appears only AFTER the fetch resolves — that's async,
  //    so getBy would fail here. findBy waits for it to show up.
  const heading = await screen.findByRole('heading', { name: /ana rodriguez/i });
  expect(heading).toBeInTheDocument();
});
```

Walk through what each query choice is doing and why:

- **`queryByRole('heading')`** — asserting the heading is *absent* before the click. `getBy` would throw here, which is the wrong tool for proving something isn't there.
- **`getByRole('button', ...)`** — the button exists right now, synchronously, the moment the component renders. `getBy` is exactly right.
- **`await user.click(...)`** — realistic click simulation, awaited because it's a Promise.
- **`await screen.findByRole('heading', ...)`** — the heading only appears after `fetch` resolves and state updates. That's async, so `findBy` is the only query that will correctly wait for it instead of failing instantly.

Every single query in this test was chosen deliberately based on *when* the element becomes available — not just picked at random.

---

## 9. Comparison Tables

### getBy vs queryBy vs findBy

| | Behavior when not found | Sync or Async | Correct use case |
|---|---|---|---|
| **getBy...** | Throws an error immediately | Synchronous | Element should already exist in the DOM right now |
| **queryBy...** | Returns `null` | Synchronous | Asserting an element is **absent** |
| **findBy...** | Rejects the Promise (after retrying, ~1000ms default) | Asynchronous (returns a Promise — must `await`) | Element appears later, after an async action (fetch, timer, state update) |

### Query priority (most to least recommended)

| Priority | Query | Why |
|---|---|---|
| 1 | `getByRole` | Matches how assistive tech (screen readers) identify elements — best accessibility signal |
| 2 | `getByLabelText` | Mirrors how a user finds a form field via its visible label |
| 3 | `getByPlaceholderText` | Weaker than a real label, but still visible to the user |
| 4 | `getByText` | Great for non-interactive content like paragraphs, headings without a role query |
| 5 | `getByDisplayValue` | Finds form elements by their current value |
| 6 | `getByAltText` | For images — matches what a screen reader announces |
| 7 | `getByTitle` | Rarely used; `title` attributes aren't consistently announced |
| 8 | `getByTestId` | Last resort — invisible to users and assistive tech; escape hatch only |

---

## 10. Common Mistakes

**Mistake 1 — Testing implementation details.**

```js
// BAD — reaching into internal state after forcing a re-render
const { rerender } = render(<Counter />);
rerender(<Counter />);
expect(wrapper.state('count')).toBe(1); // there is no wrapper.state in RTL!
```

RTL doesn't even expose an easy way to do this — and that's deliberate. If you catch yourself trying to inspect state or call internal methods, stop and ask "what would the *user* see differently?" and assert that instead.

**Mistake 2 — Reaching for `getByTestId` first.**

```js
// Weaker — tells you nothing about accessibility
screen.getByTestId('submit-btn');

// Stronger — also verifies the button is accessible
screen.getByRole('button', { name: /submit/i });
```

Save `data-testid` for genuinely last-resort cases — a decorative wrapper `div` with no semantic role, for instance — not as your default habit.

**Mistake 3 — Using `getBy` for something that hasn't appeared yet.**

```js
// BAD — throws instantly, before the fetch has any chance to resolve
await user.click(loadButton);
const heading = screen.getByRole('heading', { name: /ana/i }); // 💥 throws

// GOOD — waits for it
const heading = await screen.findByRole('heading', { name: /ana/i });
```

If the element depends on anything async — a promise, a timer, a state update triggered by an effect — reach for `findBy`, not `getBy`.

**Mistake 4 — Forgetting `await` with `userEvent` or `findBy`.**

```js
// BAD — assertion can run before the click's simulated events finish
user.click(button);
expect(screen.getByText('Saved!')).toBeInTheDocument();

// BAD — findBy returns a Promise; without await you get a Promise object, not an element
const heading = screen.findByRole('heading');

// GOOD
await user.click(button);
const heading = await screen.findByRole('heading');
```

Both `userEvent` methods and every `findBy` query return Promises. Missing `await` is one of the most common sources of flaky, hard-to-explain RTL test failures — the test sometimes passes and sometimes doesn't, purely based on timing luck.

**Mistake 5 — Using `queryBy` where `getBy` is correct (and vice versa).**

```js
// Confusing — if this fails, you get "expected true to be true"-style unhelpful output,
// because queryBy just quietly returns null rather than throwing a descriptive error
expect(screen.queryByRole('button', { name: /submit/i })).toBeInTheDocument();

// Clearer — getBy throws a descriptive error immediately if missing, pointing at the DOM tree
screen.getByRole('button', { name: /submit/i });
```

Use `getBy` whenever you expect the element to exist — you'll get a much more useful failure message. Reserve `queryBy` specifically for absence checks.

---

## 11. Hands-On Exercises

**Exercise 1 — Basic render and query**

Write a `Greeting` component that renders `<h1>Hello, {name}!</h1>`. Write a test using `render` and `screen.getByRole('heading', ...)` to assert the greeting displays the correct name.

**Exercise 2 — getBy vs queryBy**

Build a `PasswordField` component that shows an error message (`"Password must be at least 8 characters"`) only when the entered password is too short. Write two tests: one using `queryByText` to assert the error is **absent** when the password is valid, and one using `getByText` to assert the error **is present** when the password is too short.

**Exercise 3 — findBy with an async fetch**

Build a `TodoList` component that fetches todos from `/api/todos` on mount (inside a `useEffect`) and renders each todo's title in a list once loaded. Mock `fetch`, then write a test using `await screen.findByText(...)` to assert a specific todo title eventually appears. Explain in a comment why `getByText` would fail here.

**Exercise 4 — userEvent typing and submission**

Build a `LoginForm` with email and password inputs (each with a proper `<label>`) and a submit button. Write a test that uses `userEvent.setup()`, `user.type()` to fill both fields via `getByLabelText`, and `user.click()` to submit. Assert a success message appears afterward.

**Exercise 5 — Fixing a bad test**

You're given this broken test:

```js
test('shows updated count', () => {
  const wrapper = render(<Counter />);
  wrapper.container.querySelector('button').click();
  expect(wrapper.container.textContent).toContain('1');
});
```

Rewrite it using `screen`, `getByRole`, and `userEvent`, following RTL's recommended query priority. Explain in a sentence why the rewritten version gives more confidence than the original.

**Exercise 6 — Accessibility bug hunt**

You're given this markup:

```jsx
<span onClick={handleDelete} className="delete-icon">🗑</span>
```

Try to write a test using `getByRole('button', { name: /delete/i })` to find this element. Explain why it fails, and fix the markup (hint: use a real `<button>` with an accessible name, e.g. via `aria-label`) so the same query succeeds.

---

## 12. Interview Q&A

**Q1: What is the guiding philosophy behind React Testing Library?**

A: "The more your tests resemble the way your software is used, the more confidence they can give you." RTL is built around testing components the way a real user experiences them — through visible text, accessible roles, and realistic interactions like clicking and typing — rather than through internal implementation details like component state or instance methods. This means tests survive refactors that don't change user-visible behavior, and fail only when something a real user would notice actually breaks.

---

**Q2: Why does RTL deliberately avoid exposing component internal state or instance methods?**

A: Because testing internals couples the test to *how* a component is built rather than *what* it does for the user. If a component is refactored internally — say, from `useState` to `useReducer` — but the rendered output and user interactions are unchanged, a behavior-based test still passes. An implementation-based test would break for no user-relevant reason, creating false negatives and eroding trust in the test suite.

---

**Q3: What's the difference between `getBy`, `queryBy`, and `findBy`?**

A: `getBy...` is synchronous and throws immediately if no match is found — use it when the element should already exist. `queryBy...` is synchronous and returns `null` instead of throwing — it's the correct (and only sensible) choice for asserting an element is absent. `findBy...` is asynchronous, returns a Promise, and polls the DOM until the element appears or a timeout is hit (~1000ms default) — use it for elements that appear after an async action like a fetch resolving.

---

**Q4: Why would `getByText` fail in a test for a component that fetches data on mount?**

A: `getByText` checks the DOM synchronously, at the exact moment it's called. If the fetch hasn't resolved yet, the element genuinely isn't in the DOM — so `getByText` throws immediately rather than waiting. `findByText` is built for exactly this scenario: it polls the DOM repeatedly until the awaited async work finishes and the element appears, or it times out.

---

**Q5: Explain RTL's recommended query priority order, and why `getByRole` comes first.**

A: The recommended order is `getByRole` > `getByLabelText` > `getByPlaceholderText` > `getByText` > `getByDisplayValue` > `getByAltText` > `getByTitle` > `getByTestId`. `getByRole` is preferred because it queries by accessible role and name — the same information assistive technology like screen readers rely on. If `getByRole` can find an element, that's evidence a screen reader user can also find and understand it. Queries lower on the list carry progressively weaker accessibility signal, and `getByTestId` carries none at all — it's invisible to real users and assistive tech alike.

---

**Q6: Why is `getByTestId` considered a "last resort" rather than a good default?**

A: Because `data-testid` attributes are purely testing hooks — they don't correspond to anything a real user or a screen reader perceives. A test that passes using `getByTestId` tells you the element exists somewhere in the DOM, but tells you nothing about whether it's actually usable — findable by role, labeled correctly, keyboard accessible. Reaching for `getByTestId` as a first instinct sacrifices the free accessibility check that role- and label-based queries provide.

---

**Q7: What's the difference between `fireEvent` and `userEvent`, and why is `userEvent` preferred?**

A: `fireEvent` dispatches a single, low-level DOM event — e.g., `fireEvent.click()` fires just a `click` event. `userEvent` simulates the full, realistic sequence of events a browser would actually fire during that interaction (e.g., `pointerdown`, `mousedown`, `focus`, `pointerup`, `mouseup`, `click` for a click; `keydown`, `input`, `keyup` for typing). Because real user interactions are never a single isolated event, `userEvent` produces more realistic test conditions and catches bugs that only manifest across that full event sequence — like handlers that depend on focus happening before click.

---

**Q8: Why must you `await` `userEvent` methods?**

A: Every `userEvent` method (`.click()`, `.type()`, `.tab()`, etc.) returns a Promise, because it's simulating a realistic, timed sequence of DOM events internally. If you don't `await` it, your subsequent assertions can run before the simulated interaction has actually finished updating the DOM, leading to intermittent, timing-dependent test failures ("flaky tests").

---

**Q9: When should you use `queryByText` instead of `getByText`?**

A: When you are asserting that an element is **absent** — for example, `expect(screen.queryByText('Error')).not.toBeInTheDocument()`. `getByText` would throw the moment it fails to find a match, crashing your test with an unhelpful error rather than letting you make a clean assertion about absence. `queryByText` returns `null` when nothing matches, which is exactly what `.not.toBeInTheDocument()` needs to check against.

---

**Q10: Give an example of testing an implementation detail, and explain why it's problematic.**

A: Example: `expect(wrapper.state('isOpen')).toBe(true)` after simulating a menu toggle click. This is problematic because it only works if the component happens to store an `isOpen` boolean in local state under that exact name — a refactor to `useReducer`, a rename, or moving that state to a parent component via props would all break this test, even though the menu still visibly opens and closes correctly for real users. The RTL-preferred version instead asserts on the visible outcome: `expect(screen.getByRole('menu')).toBeInTheDocument()` after the click.

---

**Q11: What does `render()` actually do under the hood?**

A: `render()` mounts your React component into an in-memory DOM environment (`jsdom`) that's attached to `document.body`, giving you a real (if simulated) DOM tree to query and interact with — just as a browser would produce, minus actual visual rendering or a real browser engine.

---

**Q12: What is `screen` and why is it preferred over destructuring queries from `render()`'s return value?**

A: `screen` is an object bound to the current `document.body` that exposes all the query functions (`getByRole`, `queryByText`, `findByLabelText`, etc.) without needing to destructure them from `render()`'s return value each time. It keeps tests cleaner as they grow, and it always reflects the live DOM state, so you don't have to worry about stale references after re-renders.

---

**Q13: A test fails with "Unable to find an accessible element with the role 'button' and name /submit/i" — what are the likely causes?**

A: Either the element genuinely isn't a `<button>` (or doesn't have `role="button"`) — e.g. it's a styled `<div onClick={...}>` — or it lacks an accessible name matching "submit" (no visible text, no `aria-label`, no associated `<label>`). This failure is often not just a test bug — it's frequently a real accessibility gap: if `getByRole` can't find it, a screen reader user likely can't identify it either.

---

**Q14: How would you test a component that shows a loading spinner, then either an error message or successful data, depending on a fetch outcome?**

A: Use `findBy` for whichever end-state appears after the async fetch resolves — e.g., `await screen.findByText(/failed to load/i)` for the error path, or `await screen.findByRole('heading', { name: /.../i })` for success. Use `queryBy` if you need to assert the spinner has disappeared once loading finishes: `expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()`. Mock `fetch` to control which branch resolves in each test case.

---

**Q15: Why does RTL's approach reduce "false positive" tests — tests that pass but don't actually verify anything meaningful?**

A: Because every RTL query and interaction is scoped to what's actually rendered and observable in the DOM — the same surface a real user interacts with. A test can't pass by accident just because some internal variable happens to have the expected value while the actual screen shows something broken or invisible. If `screen.getByRole('heading', { name: /welcome/i })` passes, that heading really is present, really is labeled that way, and really is discoverable the way a user (including one using assistive technology) would discover it — not just correct in some internal data structure disconnected from the rendered page.
