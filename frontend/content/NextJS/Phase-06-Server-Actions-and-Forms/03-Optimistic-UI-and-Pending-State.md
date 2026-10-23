# Optimistic UI and Pending State — Complete Guide

> "A barista writes your name on the cup the instant you order — the drink isn't made yet, but you already have something in your hand that says it's coming."

---

## Table of Contents
1. [The Problem: A Form That Goes Silent While the Server Responds](#1-the-problem-a-form-that-goes-silent-while-the-server-responds)
2. [The Card Reader Light and the Named Cup Analogy](#2-the-card-reader-light-and-the-named-cup-analogy)
3. [useFormStatus, Precisely](#3-useformstatus-precisely)
4. [useOptimistic, Precisely](#4-useoptimistic-precisely)
5. [useActionState: Combining Result and Pending State](#5-useactionstate-combining-result-and-pending-state)
6. [Diagram: The Optimistic Update Timeline](#6-diagram-the-optimistic-update-timeline)
7. [Code Walkthrough: An Optimistic Todo List and a Correct Submit Button](#7-code-walkthrough-an-optimistic-todo-list-and-a-correct-submit-button)
8. [Comparing useFormStatus, useOptimistic, and useActionState](#8-comparing-useformstatus-useoptimistic-and-useactionstate)
9. [Common Mistakes](#9-common-mistakes)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. The Problem: A Form That Goes Silent While the Server Responds

Lesson 2's `<form action={loginAction}>` removed the hand-rolled `fetch` plus `useState`, but that also removed the only thing giving the user feedback while the request is in flight.

```
Click "Log In"
        │
        ▼
Round trip to the server takes anywhere from tens of ms to a
full second or more
        │
        ▼
Button just sits there. Nothing visibly changes.
        │
        ▼
User can't tell "working, wait" from "broken, click didn't
register" → clicks again, sometimes several times
```

A second problem shows up in lists: adding a todo, posting a comment, liking a post. Waiting for the Server Action to return before adding the item to the rendered list means the user's own input doesn't appear until the full round trip finishes, even though there's realistically no reason to doubt it will succeed.

---

## 2. The Card Reader Light and the Named Cup Analogy

A card reader's light turns on the instant it starts talking to the bank and stays lit for however long that takes — it doesn't know the final answer, it only signals "something is in progress, don't walk away."

A coffee shop works differently: the barista writes your name on a cup and hands it to you before a single drop of coffee is made. You're holding proof your order was received, even though the drink is still being prepared. If the machine jams, the barista has to come find you and take the cup back — what you were holding was always a promise, not a finished product.

```
useFormStatus's pending flag   → the card reader's light
                                  (signal only — no guess at the result)

useOptimistic                  → the named cup
                                  (an assumed final state, handed over
                                  immediately, walked back if wrong)
```

---

## 3. useFormStatus, Precisely

`useFormStatus`, imported from `react-dom`, reports on the *nearest enclosing* `<form>`'s submission — most usefully a `pending` boolean, `true` for exactly the window between submission and the Server Action resolving.

```jsx
// app/todos/SubmitButton.js
"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Add Todo"}
    </button>
  );
}
```

The detail that trips nearly everyone up: `useFormStatus` only reports real status when called from a component that is itself rendered **as a descendant of** the `<form>` — never from the same component that renders the `<form>` tag directly.

```
<form action={...}>
  <SubmitButton />   ← useFormStatus() here WORKS — a descendant of <form>
</form>

function TodoList() {
  useFormStatus();   ← does NOT work here — TodoList is the form's
  return <form>...</form>   PARENT, not its descendant. pending stays
}                            false forever, silently.
```

The hook reads React's internal form-submission context, which is only established for components inside the form's subtree. Section 7 shows the parent `<form>` that makes `SubmitButton` actually work.

---

## 4. useOptimistic, Precisely

`useOptimistic(initialState, updateFn)` lets a Client Component render an assumed, not-yet-confirmed version of state immediately, while the real update is still in flight. It returns `[optimisticState, addOptimistic]`, mirroring `useState`'s `[state, setState]` shape.

```jsx
// app/todos/TodoList.js
"use client";

import { useOptimistic } from "react";
import { addTodo } from "./actions";

export default function TodoList({ todos }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (currentTodos, newTodoText) => [
      ...currentTodos,
      { id: "optimistic-" + Date.now(), text: newTodoText, pending: true },
    ]
  );

  async function formAction(formData) {
    const text = formData.get("text");
    addOptimisticTodo(text);       // ↳ runs synchronously, right now
    await addTodo(formData);       // ↳ the real Server Action, in the background
  }

  return (
    <>
      <form action={formAction}>
        <input type="text" name="text" required />
        <button type="submit">Add Todo</button>
      </form>
      <ul>
        {optimisticTodos.map((todo) => (
          <li key={todo.id} style={{ opacity: todo.pending ? 0.5 : 1 }}>
            {todo.text}
          </li>
        ))}
      </ul>
    </>
  );
}
```

```
addOptimisticTodo(someValue)
  ↳ does NOT touch real state — tells React "render as if
    updateFn(currentState, someValue) were already true, right now"

Server Action resolves and real state updates
  ↳ React reconciles the guess away, replaces it with the confirmed
    value — usually indistinguishable to the user

Server Action fails
  ↳ nothing rolls the guess back automatically — that's the calling
    code's job (Section 9)
```

---

## 5. useActionState: Combining Result and Pending State

A Server Action is just an `async` function — whatever it returns is normally only available to its caller, at the moment it resolves. `useActionState(actionFn, initialState)` keeps that returned value around as real component state, and returns `[state, formAction, isPending]`.

```jsx
// app/todos/AddTodoForm.js
"use client";

import { useActionState } from "react";
import { addTodoWithResult } from "./actions";

const initialState = { error: null };

export default function AddTodoForm() {
  const [state, formAction, isPending] = useActionState(addTodoWithResult, initialState);

  return (
    <form action={formAction}>
      <input type="text" name="text" required />
      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Add Todo"}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```

```js
// app/todos/actions.js — note the (prevState, formData) signature
// useActionState imposes this specific calling convention
export async function addTodoWithResult(prevState, formData) {
  const text = formData.get("text");
  if (!text || !text.trim()) return { error: "Todo text is required." };
  await db.todos.insert({ text });
  return { error: null };
}
```

**This hook's name has genuinely moved across React's evolution** — it shipped first as `useFormState` (in `react-dom`), then was renamed to `useActionState` (in `react`) as its scope broadened. Tutorials, older Next.js docs, and existing code may reference either name. Treat the exact name, its import source, and the returned tuple's shape as details to verify against your installed React/Next.js versions, not facts to memorize as permanent — the stable idea underneath is "keep an action's returned state around, with a pending flag alongside it."

---

## 6. Diagram: The Optimistic Update Timeline

```text
User types "Buy milk" and submits the form
        │
        ▼
addOptimisticTodo("Buy milk") runs synchronously
        │
        ▼
React re-renders NOW — dimmed "Buy milk" entry appears in the
list before any network activity has resolved at all
        │
        ▼
addTodo(formData) — the real Server Action — runs in the
background, over the network
        │
        ├── Success ──► real todos array (server-confirmed) is
        │                returned/revalidated; the optimistic
        │                entry is replaced, usually indistinguishably
        │
        └── Failure ──► the optimistic entry must be actively rolled
                         back (catch the error, re-render without the
                         guessed item) — nothing does this for free
```

The gap between the first arrow and the Success/Failure branch is exactly where `useOptimistic` is doing its job — rendering something unconfirmed on the bet that showing it early beats waiting for certainty. That bet only pays off if the failure branch is handled deliberately (Section 9).

---

## 7. Code Walkthrough: An Optimistic Todo List and a Correct Submit Button

Three files: the Server Action, a list using `useOptimistic`, and a submit button reading pending state via `useFormStatus`.

```js
// app/todos/actions.js
"use server";

export async function addTodo(formData) {
  const text = formData.get("text");
  if (!text || !text.trim()) {
    throw new Error("Todo text is required.");
  }
  await db.todos.insert({ text });
}
```

```jsx
// app/todos/TodoList.js
"use client";

import { useOptimistic } from "react";
import { addTodo } from "./actions";
import SubmitButton from "./SubmitButton";

export default function TodoList({ todos }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (currentTodos, newTodoText) => [
      ...currentTodos,
      { id: "optimistic-" + Date.now(), text: newTodoText, pending: true },
    ]
  );

  async function formAction(formData) {
    addOptimisticTodo(formData.get("text"));
    await addTodo(formData);
  }

  return (
    <>
      <form action={formAction}>
        <input type="text" name="text" required />
        <SubmitButton />
      </form>
      <ul>
        {optimisticTodos.map((todo) => (
          <li key={todo.id} style={{ opacity: todo.pending ? 0.5 : 1 }}>
            {todo.text}
          </li>
        ))}
      </ul>
    </>
  );
}
```

`SubmitButton` is the Section 3 component — because it's rendered as a *child* of the `<form>` here (not the component rendering the `<form>` tag itself), `useFormStatus` inside it correctly reports the enclosing form's real pending state. `TodoList` itself never calls `useFormStatus` — if it did, it would be asking about a form it renders, not one it's nested inside, exactly Section 9's mistake.

---

## 8. Comparing useFormStatus, useOptimistic, and useActionState

All three answer questions hand-rolled `useState` used to answer manually — each answers a genuinely different one, and mixing them up is a common source of reaching for the wrong tool.

| | `useFormStatus` | `useOptimistic` | `useActionState` |
|---|---|---|---|
| Question it answers | Is the enclosing form currently submitting? | What should the UI show *right now*, before the server confirms? | What did the action return, and is it pending? |
| Where it must be called | A descendant of the `<form>`, not the component rendering the tag | Anywhere state needs an optimistic variant | Anywhere a Server Action's result needs to be tracked as state |
| Typical use | Disabling/relabeling a submit button in flight | Showing a new list item/like/comment instantly | Surfacing a validation error alongside a pending flag |

The practical way to keep these straight: if the only gap is "the button doesn't look busy," `useFormStatus` alone is enough — the lightest of the three. If the gap is "the new item doesn't appear until the round trip finishes," reach for `useOptimistic`. If the gap is "I need to show *why* it failed, and also know when it's pending, in the same component that renders the form," `useActionState` covers both at once — though `useFormStatus` and `useOptimistic` can still be combined manually for more granular control over where each concern lives.

---

## 9. Common Mistakes

- **Calling `useFormStatus` in the same component that renders the `<form>` tag.** The hook only reports real status from a *descendant* of the form. Fix: move that piece of UI into its own small child component, exactly like `SubmitButton` in Sections 3 and 7, and render that child inside the `<form>`.
- **Using `useOptimistic` without handling the failure path.** The Section 6 diagram's "Failure" branch doesn't happen automatically — if the Server Action throws, the optimistic entry stays in the list looking exactly as confirmed as a real one unless the surrounding code explicitly catches the failure and removes or corrects it (typically wrapping the `await` in `try`/`catch`).
- **Assuming `useOptimistic`'s optimistic value is itself the new source of truth.** It's a rendering convenience only — the real state (the `todos` prop) still has to be updated through its normal path, typically via revalidation or a parent re-fetch, once the Server Action actually resolves.
- **Treating the hook names in this lesson as permanently fixed.** `useActionState` was previously `useFormState`, and names/return shapes in this area have shifted across React and Next.js releases. Copying a code sample verbatim from an older tutorial without checking it against the installed versions' current docs is a common source of "this hook doesn't exist" errors.

---

## 10. Hands-On Exercises

**Exercise 1:** Create `app/todos/actions.js` with `"use server"` and `async function addTodo(formData)` that reads `text`, throws if empty, otherwise logs it to the server console.

**Exercise 2:** Build `app/todos/SubmitButton.js` as its own Client Component using `useFormStatus()` to disable the button and show "Saving..." while `pending` is `true`, exactly as in Section 3.

**Exercise 3:** Build `app/todos/TodoList.js` as a Client Component accepting a `todos` prop, using `useOptimistic` to append an optimistic entry on submit, wiring its `<form>`'s `action` to a local `formAction` that calls `addOptimisticTodo` then `await addTodo(formData)`, and rendering `SubmitButton` as a child inside that `<form>`. Confirm the new todo appears dimmed instantly, before the server log line even prints.

**Exercise 4:** Modify `addTodo` to randomly throw roughly half the time (`if (Math.random() < 0.5) throw new Error('Simulated failure')`), then wrap `TodoList`'s `await addTodo(formData)` call in a `try`/`catch` that logs the failure. Observe what happens to the optimistic entry when the simulated failure fires — it stays in the list looking exactly like a successful add, confirming Section 9's rollback warning firsthand.

**Exercise 5:** Rewrite the Exercise 3 form to use `useActionState` instead: turn `addTodo` into `addTodoWithResult(prevState, formData)` returning `{ error: null }` or `{ error: '...' }` instead of throwing, then update the form component to call `useActionState(addTodoWithResult, { error: null })`, rendering `state.error` when present and using the returned `isPending` in place of a separate `useFormStatus` call.

---

## 11. Interview Q&A

**Q: What does `useFormStatus` return, and where can it correctly be called?**
It returns an object whose most commonly used field is `pending`, a boolean that's `true` while the nearest enclosing `<form>`'s submission is in flight. It only reports accurate status when called from a component that is a *descendant* of that `<form>` — not from the same component that renders the `<form>` tag itself, since the hook reads context that's only established for components nested inside the form's subtree.

**Q: What problem does `useOptimistic` solve, and what happens if the underlying action fails?**
It lets a component render an assumed new value immediately — a new list item, an incremented count — before the server has confirmed the change, closing the visible gap between the user's action and the screen updating. If the underlying Server Action fails, nothing rolls the optimistic entry back automatically; the surrounding code has to catch the failure explicitly and correct or remove the optimistic entry itself.

**Q: How is `useActionState` different from combining `useFormStatus` and `useOptimistic` manually?**
`useActionState` wraps a single Server Action and gives back its most recently returned value as real component state, plus a pending flag, in one hook call — useful when a component needs to show what an action returned (a validation error) alongside knowing whether it's currently running. `useFormStatus` and `useOptimistic` solve narrower, separate problems — pending-only feedback and optimistic rendering — and can be combined for more granular control, but don't by themselves surface an action's returned result as state.

**Q: Has the name `useActionState` always been called that?**
No — it previously shipped as `useFormState` in `react-dom`, and was later renamed and moved to `react` as `useActionState`. Because naming in this area has shifted across React and Next.js releases, the exact name, import source, and returned tuple shape are worth confirming against the project's installed versions rather than treated as permanently fixed.

**Q: Why does `SubmitButton` correctly report pending state in this lesson's todo-list example, while a hypothetical version inside `TodoList` itself would not?**
`SubmitButton` is rendered as a child *inside* the `<form>` element in `TodoList`'s returned JSX, so `useFormStatus`, called from within `SubmitButton`, is genuinely a descendant of that form and can read its real submission status. `TodoList` itself is the component that renders the `<form>` tag — it is the form's parent, not its descendant — so a `useFormStatus()` call placed directly in `TodoList`'s own body would never report the form's real pending state.
