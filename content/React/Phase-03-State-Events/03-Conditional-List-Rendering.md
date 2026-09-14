# 03 — Conditional & List Rendering

> "Your UI is never one fixed picture — it's a function of your data. Change the data, and the picture should just... follow."

---

## Table of Contents

1. [The Problem: UI That Depends on State](#1-the-problem-ui-that-depends-on-state)
2. [Conditional Rendering Patterns](#2-conditional-rendering-patterns)
   - 2.1 [The Ternary Operator](#21-the-ternary-operator)
   - 2.2 [The Logical `&&` Operator](#22-the-logical--operator)
   - 2.3 [Early Return](#23-early-return)
   - 2.4 [Which One Should You Actually Use?](#24-which-one-should-you-actually-use)
3. [The `&&` Falsy-Zero Bug — Full Depth](#3-the--falsy-zero-bug--full-depth)
4. [Rendering Lists with `.map()`](#4-rendering-lists-with-map)
5. [The `key` Prop — Full Depth](#5-the-key-prop--full-depth)
   - 5.1 [Why React Demands a Key](#51-why-react-demands-a-key)
   - 5.2 [What Actually Happens Internally](#52-what-actually-happens-internally)
   - 5.3 [The Index-as-Key Trap](#53-the-index-as-key-trap)
   - 5.4 [The Math.random() Trap](#54-the-mathrandom-trap)
6. [Compare: Ternary vs `&&` vs Early Return](#6-compare-ternary-vs--vs-early-return)
7. [Common Mistakes & Confusions](#7-common-mistakes--confusions)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: UI That Depends on State

Let's start with something every single app you've ever used does, dozens of times a minute, without you noticing:

```
Show a spinner while data is loading.
Show an error message if the request failed.
Show the actual content once it's ready.
```

Three completely different UIs, for the exact same little corner of the screen, depending on nothing but *state*.

Here's the naive way a beginner might reach for this, and honestly — it doesn't work in JSX at all:

```jsx
function Profile({ status, user }) {
  return (
    <div>
      if (status === "loading") {
        <Spinner />
      } else {
        <UserCard user={user} />
      }
    </div>
  );
}
```

That's not valid. JSX is an *expression* — it gets compiled down to `React.createElement(...)` calls — and you cannot drop a statement like `if` in the middle of an expression. JSX doesn't know what to do with a bare `if` sitting between tags.

So immediately you hit the real question this whole file is about:

> **How do you make what's rendered depend on data, when JSX only accepts expressions, not statements?**

And there's a second, equally common problem sitting right next to it. Say your state isn't a single status flag but an *array* — a list of todos, a list of comments, a list of search results. You don't want to hand-write:

```jsx
<li>Buy milk</li>
<li>Walk the dog</li>
<li>Finish the report</li>
```

...because that list isn't fixed. It comes from a database, a user, an API — it could have 0 items or 10,000. You need to turn *data* into *elements*, automatically, for however many items happen to exist right now.

Both problems — "which UI, based on a condition" and "how many elements, based on an array" — come up in nearly every component you'll ever write. Let's solve them properly.

---

## 2. Conditional Rendering Patterns

### 2.1 The Ternary Operator

The ternary is just JavaScript's `condition ? valueIfTrue : valueIfFalse`, and since it's an *expression* (it produces a value), it slots straight into JSX.

```jsx
function Profile({ status, user }) {
  return (
    <div>
      {status === "loading" ? <Spinner /> : <UserCard user={user} />}
    </div>
  );
}
```

Read it out loud: "if status is loading, show a Spinner, otherwise show a UserCard." That's it. No new syntax to learn — this is plain JavaScript, wrapped in `{ }` so React knows to evaluate it.

**Best for:** exactly two branches, both fairly short, both actually rendering *something*.

---

### 2.2 The Logical `&&` Operator

Sometimes you don't have two branches — you have one branch, and "render nothing" as the other. That's where `&&` shines:

```jsx
function Inbox({ unreadCount }) {
  return (
    <div>
      <h2>Inbox</h2>
      {unreadCount > 0 && <Badge count={unreadCount} />}
    </div>
  );
}
```

`&&` short-circuits: if the left side is falsy, JavaScript never even evaluates the right side — it just returns the falsy value. React then renders "nothing" for `false`, `null`, or `undefined`. If the left side is truthy, the whole expression evaluates to the right side — your JSX.

**Best for:** "show this thing, or show nothing at all" — no second branch needed.

Hold onto this one. Section 3 is entirely about the sharp edge hiding inside it.

---

### 2.3 Early Return

Sometimes the "condition" isn't a small fragment inside your markup — it's the *entire* component. Rather than nesting ternaries three levels deep, just return early:

```jsx
function Profile({ status, user, error }) {
  if (status === "loading") {
    return <Spinner />;
  }

  if (status === "error") {
    return <ErrorMessage message={error} />;
  }

  return <UserCard user={user} />;
}
```

This works because a component is just a function — and functions can `return` whenever they want. Nothing stops you from returning different JSX from different branches, as long as you always return *something* renderable (or `null`).

**Best for:** three or more mutually-exclusive states, or when the "other" branch is a completely different chunk of UI, not a small tweak.

---

### 2.4 Which One Should You Actually Use?

Rule of thumb, in one sentence: **the more branches you have, and the bigger each branch is, the more you should reach for early return over nested ternaries.**

A nested ternary like this is technically legal, and a genuine readability hazard:

```jsx
// Please don't do this
return status === "loading" ? <Spinner /> : status === "error" ? <ErrorMessage /> : <UserCard />;
```

Compare that to the early-return version above. Same logic, dramatically easier to scan.

---

## 3. The `&&` Falsy-Zero Bug — Full Depth

Here's a bug that has probably shipped to production in every company that's ever used React. It's subtle, it looks completely reasonable, and it slips past code review constantly.

### The setup

You're building a shopping cart icon. You want a little badge showing the item count — but only if there *are* items. Zero items, no badge. Seems simple:

```jsx
function CartIcon({ itemCount }) {
  return (
    <div className="cart-icon">
      🛒
      {itemCount && <span className="badge">{itemCount}</span>}
    </div>
  );
}
```

Looks completely fine, right? "If itemCount is truthy, show the badge." Let's actually trace what happens when the cart is empty — `itemCount` is `0`.

```
itemCount && <span className="badge">{itemCount}</span>

0 && <span>...</span>

    &&  short-circuits on the LEFT operand.
    0 is falsy.
    So the whole expression evaluates to... 0.

Result: the expression's VALUE is the number 0.
```

Now here's the part that catches people off guard. React happily renders `false`, `null`, and `undefined` as *nothing* — but `0` is a real, meaningful number, and React renders it as **text**. Literally, the digit `0` shows up on the page, sitting right next to your cart icon, with no badge styling around it:

```
🛒 0
```

Not "no badge." A stray, unstyled zero, permanently glued to your cart icon, every time the cart is empty. That's the bug.

### Why does this happen?

Because `&&` doesn't produce a *boolean* — it produces one of its two *operands*, unmodified:

```js
0 && "anything"      // → 0            (not false!)
"" && "anything"     // → ""           (not false!)
NaN && "anything"    // → NaN          (not false!)
1 && "anything"      // → "anything"
"hi" && "anything"   // → "anything"
```

Any falsy value that *isn't* `false`, `null`, or `undefined` — namely `0`, `""`, and `NaN` — gets rendered by React as literal text, because as far as React is concerned, "0" and "" and "NaN" are valid renderable children, not "please render nothing" signals.

### The fix

Force the left side into an actual boolean before the `&&`, so the result is always either `true`/`false` or your JSX — never a bare number:

```jsx
// Fix 1 — explicit comparison
{itemCount > 0 && <span className="badge">{itemCount}</span>}

// Fix 2 — double-negation (coerces to a real boolean)
{!!itemCount && <span className="badge">{itemCount}</span>}

// Fix 3 — ternary, sidesteps the whole issue
{itemCount ? <span className="badge">{itemCount}</span> : null}
```

Any of the three work. `itemCount > 0` is usually the clearest to read, because it says exactly what you mean instead of relying on truthy/falsy coercion.

### The general rule to internalize

> Never put a bare number (or a bare string) directly to the left of `&&` in JSX. Always compare it to something (`> 0`, `!== ""`, `.length > 0`) so the left side is a genuine boolean.

This bites people constantly with:

```jsx
{items.length && <List items={items} />}       // BUG: renders "0" for an empty array
{messageCount && <Badge n={messageCount} />}    // BUG: renders "0" when zero messages
{errorText && <p>{errorText}</p>}               // safe — "" is falsy AND renders as nothing... but wait
```

That last one is actually fine, because `""` (empty string) renders as nothing in React — it's only `0` (and `NaN`) among the "weird" falsy values that visibly show up. Still, the safest habit is to always write an explicit comparison rather than memorizing which specific falsy values are "visually safe" and which aren't.

---

## 4. Rendering Lists with `.map()`

Now the second core problem: turning an array of data into an array of elements. JavaScript's `.map()` is the tool — it already does exactly this job for plain arrays, and JSX just needs an array of elements to render.

```jsx
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

Walk through it:

```
todos = [
  { id: "a1", text: "Buy milk" },
  { id: "a2", text: "Walk the dog" },
  { id: "a3", text: "Finish the report" }
]

todos.map(todo => <li key={todo.id}>{todo.text}</li>)

  → [
      <li key="a1">Buy milk</li>,
      <li key="a2">Walk the dog</li>,
      <li key="a3">Finish the report</li>
    ]
```

`.map()` transforms the data array into an *array of JSX elements*, and React is perfectly happy rendering an array of elements anywhere you'd normally put a single element. Add a todo, remove one, reorder them — `.map()` just runs again on whatever the array currently looks like, and the UI follows automatically.

Notice that `key={todo.id}` sitting on the `<li>`. Don't skip past it — it's not decoration. Section 5 is the whole rest of this file's "full depth" section, because that one prop is the single most misunderstood thing about list rendering in React.

---

## 5. The `key` Prop — Full Depth

### 5.1 Why React Demands a Key

Here's an analogy that makes this click immediately.

Imagine a classroom with assigned seats, but no name tags on the students. The teacher looks away for a second, three students swap seats, and one new student walks in.

```
Before:  [Alice] [Bob] [Carol]
After:   [Carol] [Alice] [Bob] [Dave]
```

Without name tags, the teacher — looking only at *seat positions*, not the people — has no way to tell "Alice moved from seat 1 to seat 2" apart from "the person who used to be Alice left, and someone new sat in seat 2." Same visual result, completely different reality.

Now give every student a name tag:

```
Before:  [Alice] [Bob] [Carol]
After:   [Carol] [Alice] [Bob] [Dave]
```

With name tags, the teacher immediately knows: Alice, Bob, and Carol are the *same three people*, just reshuffled — and Dave is genuinely new. Nothing about Alice, Bob, or Carol needs to be "recreated." They just moved.

That's exactly the role of the `key` prop. React doesn't track your list items by their position on screen — it tracks them by their `key`, the way the teacher tracks students by name tag, not by seat number.

### 5.2 What Actually Happens Internally

Let's make this concrete with something that actually breaks visibly: a list of todos, where each row has its own text `<input>` that the user can type into (say, an "edit note" field per todo).

**Scenario: user deletes the first item from a 3-item list.**

```
BEFORE deletion:
  index 0 → key="a1" → <input value="note for milk" />
  index 1 → key="a2" → <input value="note for dog walk" />
  index 2 → key="a3" → <input value="note for report" />

User deletes item "a1" (Buy milk).

Array is now: [a2, a3]
```

**WITH stable, unique keys (`key={todo.id}`):**

```
AFTER deletion, React compares by KEY:
  key="a2" existed before, still exists → REUSE that <input>,
                                            keep "note for dog walk" attached to it
  key="a3" existed before, still exists → REUSE that <input>,
                                            keep "note for report" attached to it
  key="a1" existed before, now gone     → UNMOUN Ted, discarded

Result: correct! Each input's typed text stays with the right todo.
```

**WITHOUT stable keys — using the array index as the key (`key={index}`):**

```
BEFORE deletion (keys are just 0, 1, 2 — the index):
  index 0 → key=0 → <input value="note for milk" />
  index 1 → key=1 → <input value="note for dog walk" />
  index 2 → key=2 → <input value="note for report" />

User deletes item at original index 0 (Buy milk).
Remaining items SHIFT UP, so now:
  index 0 → key=0 → (this is now "Walk the dog"'s row)
  index 1 → key=1 → (this is now "Finish the report"'s row)

React compares by KEY again:
  key=0 existed before, still exists → REUSE that <input>...
                                         ...but that <input> still holds
                                         "note for milk" in its DOM state!
  key=1 existed before, still exists → REUSE that <input>...
                                         ...still holds "note for dog walk"!

Result: WRONG. The "Walk the dog" row now visually shows
"note for milk" in its input box, because React thinks
key=0 is the "same" element it was before — it has no idea
the underlying todo behind that position changed.
```

That's the crux of it. `key={index}` tells React "the thing at position 0 is always the same thing," which is only true when the list *never* reorders, filters, inserts in the middle, or deletes anything except the very last item. The moment order changes, index-as-key actively lies to React about identity — and React trusts it, because that's the entire point of providing a key in the first place.

### 5.3 The Index-as-Key Trap

To spell out exactly when this bites you:

```
Safe to use index as key:
  - The list is static and NEVER reorders, filters, or has items
    inserted/removed from the middle.
  - List items have no internal state (no <input>, no open/closed
    toggle, no per-item animation) that needs to "stick" to the
    right piece of data.

Dangerous to use index as key:
  - Todo lists, comment threads, search results — anything that can
    be filtered, sorted, reordered, or have items deleted/inserted
    anywhere but the very end.
  - Any list item containing form inputs, checkboxes, or local
    component state.
```

React actually warns you in the console when you skip keys entirely on a list:

```
Warning: Each child in a list should have a unique "key" prop.
```

That warning exists precisely because this bug is so easy to introduce without noticing — everything *looks* fine until someone deletes an item from the middle of the list or a filter re-sorts it, and suddenly state appears to teleport onto the wrong row.

**The fix:** use a stable identifier that belongs to the *data itself* and travels with it regardless of position — a database ID, a UUID generated once when the item was created, anything that uniquely and permanently identifies that particular todo/comment/row.

```jsx
// Good — id comes from the data, survives reordering
{todos.map((todo) => <li key={todo.id}>{todo.text}</li>)}

// Risky — index comes from POSITION, breaks on reordering
{todos.map((todo, index) => <li key={index}>{todo.text}</li>)}
```

### 5.4 The Math.random() Trap

If index-as-key is "too stable" (tied to position instead of identity), `Math.random()` as a key is the opposite mistake — "not stable at all":

```jsx
// Actively wrong — do not do this
{todos.map((todo) => <li key={Math.random()}>{todo.text}</li>)}
```

Every single time this component re-renders — even for a reason that has nothing to do with this list, like a totally unrelated piece of state changing elsewhere in the app — `Math.random()` runs again and generates a *brand new* key for every item. As far as React is concerned, every item looks like it was deleted and a completely new one was inserted in its place, on every render.

The result: React throws away and recreates every single DOM node in the list, every render. Any input focus, typed text, scroll position, or CSS transition tied to those elements gets wiped, constantly. It's strictly worse than using no key at all — at least a missing key only misbehaves on structural changes; `Math.random()` misbehaves on *every* render.

> **The key must be stable across re-renders and unique among siblings.** Not "unique across the whole app" — just unique among the items in that one list. A generated ID, a database primary key, or a slug is right. The array index or a fresh random value on every render is wrong.

---

## 6. Compare: Ternary vs `&&` vs Early Return

| Pattern | Syntax | Idiomatic when... | Watch out for |
|---|---|---|---|
| **Ternary** | `cond ? <A/> : <B/>` | Exactly two branches, both render something, both reasonably short | Nesting ternaries inside ternaries — hurts readability fast |
| **Logical `&&`** | `cond && <A/>` | One branch, "or render nothing" — no meaningful "else" case | The falsy-zero bug: bare numbers/strings on the left side render as literal text instead of "nothing" |
| **Early return** | `if (cond) return <A/>;` | Three or more mutually exclusive states, or each branch is a sizable chunk of markup | Must remember every path still returns valid JSX (or `null`) — don't fall through with nothing returned |

---

## 7. Common Mistakes & Confusions

**Mistake 1 — The `&&` falsy-zero bug.** Covered at full depth in Section 3. The short version: `count && <Badge/>` silently renders a literal "0" on the page when `count` is `0`, because `&&` returns its falsy operand as-is, and React renders `0` (and `NaN`) as visible text, unlike `false`/`null`/`undefined`. Fix: always compare (`count > 0 && ...`) instead of relying on raw truthiness.

**Mistake 2 — Using array index as key on a reorderable/filterable list.** Covered at full depth in Section 5. The short version: index-as-key ties identity to *position*, not to the actual data. Delete, insert, sort, or filter the list, and React can attach the wrong internal state (typed input text, toggled checkboxes, open/closed accordions) to the wrong visible row, because it thinks "position 0 is still the same item as before."

**Mistake 3 — Forgetting keys entirely.** React still renders the list, but logs a console warning: `Warning: Each child in a list should have a unique "key" prop.` Under the hood, React falls back to using the item's position anyway — so you get all the same reordering risks as index-as-key, just without even having typed the index explicitly. Always add a key; don't rely on the fallback.

**Mistake 4 — Using `Math.random()` (or `Date.now()`) as a key.** This generates a new key on every render, which tells React "every item is brand new" every single time, even when nothing actually changed. React tears down and rebuilds the entire list's DOM on every re-render — worse for performance and worse for any element with local state (like an unsaved input) than not keying at all.

**Mistake 5 — Putting the key on the wrong element.** The key belongs on the outermost element returned directly inside the `.map()` callback — not on some nested child a few levels deeper.

```jsx
// Wrong — key is buried inside, React can't see it at the top level
{todos.map((todo) => (
  <li>
    <span key={todo.id}>{todo.text}</span>
  </li>
))}

// Right — key is on the element .map() directly returns
{todos.map((todo) => (
  <li key={todo.id}>{todo.text}</li>
))}
```

**Mistake 6 — Rendering a raw JavaScript object directly in JSX.** Not strictly a conditional/list issue, but it shows up constantly in list rendering when someone forgets to pull out a specific field: `{todo}` instead of `{todo.text}` throws "Objects are not valid as a React child." React can render strings, numbers, elements, arrays of these, and booleans/`null`/`undefined` (as nothing) — never a plain object.

---

## 8. Hands-On Exercises

**Exercise 1 — Ternary vs `&&`**

Build a `<LoginButton isLoggedIn={...} />` component. When `isLoggedIn` is `true`, render a "Log out" button; when `false`, render a "Log in" button. Implement it with a ternary, then re-implement the exact same behavior using two separate `&&` expressions side by side. Which reads more clearly, and why?

**Exercise 2 — Fix the falsy-zero bug**

You're given this broken component:

```jsx
function NotificationBell({ unreadCount }) {
  return (
    <div>
      🔔
      {unreadCount && <span className="badge">{unreadCount}</span>}
    </div>
  );
}
```

Reproduce the bug by rendering `<NotificationBell unreadCount={0} />` and describing what appears on screen. Then fix it two different ways (an explicit comparison, and a ternary), and explain in one sentence why each fix works.

**Exercise 3 — Early return refactor**

Take this deeply nested ternary and refactor it into an early-return version:

```jsx
function StatusView({ status, data, error }) {
  return status === "loading"
    ? <Spinner />
    : status === "error"
    ? <ErrorBanner message={error} />
    : status === "empty"
    ? <EmptyState />
    : <DataTable rows={data} />;
}
```

**Exercise 4 — Build a filterable todo list and break it on purpose**

Build a todo list where each `<li>` contains an `<input>` for an editable "note" per todo, using `key={index}`. Add a "Show only incomplete" filter checkbox. Type distinct notes into two different rows, then toggle the filter so the list reorders. Observe which note ends up on the wrong row. Then fix it by switching to `key={todo.id}` and confirm the bug disappears.

**Exercise 5 — Spot every key mistake**

Given this snippet, list every mistake it contains, and rewrite it correctly:

```jsx
{comments.map((comment) => (
  <div>
    <p key={Math.random()}>{comment.text}</p>
  </div>
))}
```

**Exercise 6 — Empty list state**

Extend the todo list from Exercise 4 so that when the (possibly filtered) array has zero items, it renders a friendly "Nothing here yet" message instead of an empty `<ul>`. Decide whether a ternary, `&&`, or early return is the cleanest fit, and justify your choice against the comparison table in Section 6.

---

## 9. Interview Q&A

**Q1: Why can't you write a plain `if` statement directly inside JSX?**

A: JSX compiles down to `React.createElement(...)` calls (or the newer JSX runtime's equivalent), and everything inside `{ }` in JSX must be a JavaScript *expression* — something that evaluates to a value — not a *statement*. `if` is a statement, so it can't be embedded inline. That's why conditional rendering leans on expressions instead: the ternary operator, the `&&` operator, or moving the decision above the `return` entirely via early return.

---

**Q2: What's the difference between using a ternary and using `&&` for conditional rendering?**

A: A ternary (`cond ? <A/> : <B/>`) always produces one of two explicit branches — use it when both "true" and "false" cases render something meaningful. `&&` (`cond && <A/>`) only has one branch — if the condition is falsy, nothing renders. Use `&&` when there's no meaningful "else," just "show this, or show nothing."

---

**Q3: Explain the `count && <Badge/>` bug in detail. Why does it happen, and how do you fix it?**

A: `&&` returns one of its two operands unmodified, not a boolean. If `count` is `0`, `count && <Badge/>` evaluates to `0` itself, not `false`. React renders `false`, `null`, and `undefined` as nothing, but it renders `0` (and `NaN`) as literal visible text, since those are legitimate numeric values as far as React's rendering rules are concerned. The fix is to force a genuine boolean on the left side — `count > 0 && <Badge/>` — so the expression never falls through to a bare number.

---

**Q4: Why does React require a `key` prop on list items?**

A: React needs a stable way to match up list items between renders so it knows which DOM elements to reuse, update, or discard — without diffing every possible attribute of every item. The `key` acts like a permanent identity tag: as long as an item's key stays the same across a re-render, React treats it as "the same conceptual item," reuses its existing DOM node and internal state, and only updates what actually changed on it. Without a stable key, React falls back to matching by position, which silently misattributes state whenever the list is reordered, filtered, or has items removed from the middle — a checkbox's checked state or an input's typed text can end up glued to the wrong row.

---

**Q5: Why is using the array index as a key considered risky?**

A: The index describes an item's *position*, not its *identity*. As long as the list never reorders and items are only ever added/removed at the very end, index and identity happen to coincide, so it's harmless. The moment you delete an item from the middle, insert one, sort, or filter the list, items shift to different indices — but React still thinks "index 0 is the same item as last render," because that's literally what index-as-key tells it. Any local state tied to a specific row (typed text in an input, a toggled checkbox, scroll position) can then appear on the wrong item after the shift.

---

**Q6: Why is `Math.random()` (or a fresh timestamp) worse than using the array index as a key?**

A: Index-as-key is stable across renders as long as the list order doesn't change — it only breaks on reordering. `Math.random()` generates a brand-new value on *every single render*, regardless of whether the list changed at all. React sees a completely different key for every item every time, concludes every item is new, and destroys and recreates the entire list's DOM on every re-render — losing focus, input state, and animation state constantly, even for renders totally unrelated to the list itself.

---

**Q7: What happens if you forget the `key` prop on a list entirely?**

A: React still renders the list, but logs a console warning: `Warning: Each child in a list should have a unique "key" prop.` Internally, without an explicit key, React falls back to using the item's position in the array — so you inherit all the same identity-mismatch risks as manually using `key={index}`, just implicitly.

---

**Q8: Can two sibling elements in the same list share the same key?**

A: No — keys only need to be unique among *siblings* in that specific list (not globally unique across the whole app), but duplicate keys within the same list confuse React's matching: it can't tell the duplicated items apart, which typically produces incorrect rendering or a console warning about duplicate keys.

---

**Q9: Is it ever acceptable to use the array index as a key?**

A: Yes — when the list is genuinely static: it never reorders, is never filtered, and items are only ever appended at the end or the whole list is replaced wholesale (never spliced from the middle). If list items also carry no internal state (no inputs, no per-item toggle state), the risk drops even further, since there's no state that could get misattached to the wrong row. As soon as any of those conditions might change, prefer a data-backed identifier instead.

---

**Q10: What's the correct fix for a component that throws "Objects are not valid as a React child"?**

A: This happens when a plain JavaScript object (not a string, number, valid element, or array of these) is placed directly inside JSX — most often inside a `.map()` when someone renders `{item}` instead of a specific field like `{item.text}`. The fix is to render a specific primitive field of the object, or explicitly serialize it (e.g., `JSON.stringify(item)`) if you genuinely want to debug-print it.

---

**Q11: When would you prefer early return over a ternary for conditional rendering?**

A: When there are three or more mutually exclusive UI states (loading / error / empty / loaded, for example), or when each branch renders a substantially different, sizable chunk of markup. Nested ternaries handling more than two branches become hard to read at a glance; early returns let each state read as a clear, flat, top-to-bottom sequence of "if this state, return this UI" checks.

---

**Q12: Does the `key` prop get passed down to the component as a regular prop?**

A: No. `key` (along with `ref`) is a special prop that React intercepts for its own internal bookkeeping — it's never passed into the component function as part of its `props` object. If a component needs the same value for its own logic, it must be passed again under a different prop name.

---

**Q13: Why does `{errorMessage && <p>{errorMessage}</p>}` not have the same bug as `{count && <Badge/>}`?**

A: Because when `errorMessage` is falsy, it's typically an empty string `""`, and unlike `0`, an empty string renders as literally nothing on the page — React just displays no visible text for `""`. The falsy-zero bug specifically affects `0` and `NaN`, the two falsy values that React still renders as visible text. That said, relying on this distinction is fragile — writing an explicit check (`errorMessage.length > 0 && ...`) is safer than memorizing which falsy values are "visually safe."

---

**Q14: How would you render "Nothing to show" when a list is empty, cleanly?**

A: Check the array's length before mapping, and branch on it — typically an early return or a ternary at the top of the component, since "empty list" and "populated list" are two full, different chunks of UI, not a subtle inline tweak:

```jsx
if (todos.length === 0) {
  return <p>Nothing here yet.</p>;
}

return (
  <ul>
    {todos.map((todo) => <li key={todo.id}>{todo.text}</li>)}
  </ul>
);
```

---

**Q15: In one sentence, why do stable keys matter for reconciliation?**

A: Stable, unique keys give React a reliable way to recognize "this is the same logical item as before, just possibly moved," letting it preserve that item's DOM node and internal state across renders instead of matching purely by position and risking state ending up attached to the wrong row.

---

> **Memory hook:** "A key is a name tag, not a seat number — React tracks who you are, not where you're standing."
