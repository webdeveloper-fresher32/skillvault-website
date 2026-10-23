# 02 — Keys and Rendering Behavior

> "A key isn't a label for humans to read — it's the ID card React uses to recognize *which* instance of a component it's looking at, render after render."

---

## Table of Contents

1. [The Problem: State That Ends Up in the Wrong Place](#1-the-problem-state-that-ends-up-in-the-wrong-place)
2. [The Real-World Analogy: Musical Chairs with Name Tags](#2-the-real-world-analogy-musical-chairs-with-name-tags)
3. [What a Key Actually Is](#3-what-a-key-actually-is)
4. [Internal Working: Slots, Not Items](#4-internal-working-slots-not-items)
5. [Example 1 — The Classic Broken List-of-Inputs Bug](#5-example-1--the-classic-broken-list-of-inputs-bug)
6. [Example 2 — Deliberately Forcing a Remount with `key`](#6-example-2--deliberately-forcing-a-remount-with-key)
7. [Same Position, Different Type: Always a Remount](#7-same-position-different-type-always-a-remount)
8. [Compare: Update-in-Place vs. Destroy-and-Recreate](#8-compare-update-in-place-vs-destroy-and-recreate)
9. [Real-World Scenarios](#9-real-world-scenarios)
10. [Common Mistakes and Confusions](#10-common-mistakes-and-confusions)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The Problem: State That Ends Up in the Wrong Place

Here's a bug that trips up almost every React developer at least once, usually in a code review where someone says "wait, why does deleting *that* row change the text in *this* row?"

You've built a todo list. Each row has a checkbox and, when you click "edit," a text input pre-filled with that todo's text. You type into the input for item #2, changing it to "buy oat milk." Then you delete item #1 from the list.

Suddenly, the input that used to say "buy oat milk" now shows the *old* text from what used to be item #2 — but you swear you typed that into a different row.

Nothing crashed. No error was logged. The bug is silent, and that's what makes it dangerous — it ships to production, and a user notices their form data got scrambled after a totally unrelated row was removed.

There's a second, related surprise that goes the *other* way: sometimes you *want* a component to reset — say, you're editing "Record A" in a form, and the user switches to "Record B," but the form doesn't clear the old values. You expected a fresh component. You got a recycled one instead.

Both bugs — state mixing up between rows, and state *not* resetting when you expected it to — come from the exact same root cause: **how React decides whether a component on screen is the "same" component it rendered last time, or a brand new one.** That decision is called component identity, and it's the single most important idea in this file.

Here's why it's easy to miss in day-to-day development: most of the time, your list only ever grows at the *end*. You add a new todo, it appears at the bottom, nothing shifts. Everything looks fine for weeks. Then a product manager asks for a "delete" button, or "drag to reorder," or "sort by due date" — and suddenly the exact same component code starts exhibiting bugs that were always latent, just never triggered before. The component didn't change. The *shape of the changes happening to the list* did — and that's precisely the dimension that keys are designed to handle.

If you worked through `01-Virtual-DOM-Reconciliation.md` already, you've seen the mechanical side of this: React builds a new element tree on every render and diffs it against the previous one, deciding what to patch in the real DOM. What that file didn't dwell on is *how the diff figures out which old element corresponds to which new element* in the first place — that matching step is exactly what this file is about, and `key` is the tool you control it with.

---

## 2. The Real-World Analogy: Musical Chairs with Name Tags

Picture a row of chairs at a school assembly, numbered 1 through 5. Each chair has a small whiteboard clipped to it where a student writes their own name.

Now imagine the teacher runs attendance purely by **chair number**. "Chair 3, how's your homework going?" She never actually looks at who is sitting in chair 3 — she just assumes whoever answers is the same kid as yesterday, because they're in the same seat.

One day, the kid in chair 1 goes home sick, so everyone shifts down one seat to close the gap. The kid who used to be in chair 2 (with "still needs to finish essay" written on a sticky note handed to them by the teacher) is now sitting in chair 1. But the teacher, going strictly by chair number, hands *that* sticky note reminder to whoever is now in chair 2 — a completely different kid who never had an unfinished essay.

That's what happens when React tracks list items by **position alone**. The "sticky note" is component state (like the text typed into an input). If items shift position because one was removed, added, or reordered, and React has no better way to identify who's who, the state stays glued to the *seat number*, not the *student*. It gets handed off to whoever is now sitting there.

The fix in the real world is obvious: give every student a name tag. Now the teacher can say "Priya, how's the essay?" — regardless of which chair Priya happens to be sitting in that day. The name tag travels *with the student*, not with the seat.

A React `key` is that name tag. It tells React "identify this item by this stable, unique value — not by whatever position it happens to occupy this render."

> **Memory hook:** "Track the kid by their name tag, not by which chair they happen to be sitting in today."

---

## 3. What a Key Actually Is

A `key` is a special prop you pass when rendering a list of elements — it's not passed down to the component itself (you can't read `props.key` inside the component), it's metadata React's reconciler reads directly.

```jsx
{todos.map(todo => (
  <TodoRow key={todo.id} todo={todo} />
))}
```

`todo.id` here should be something stable and unique to that piece of data — a database ID, a UUID generated once when the item was created, something that does *not* change across renders and does *not* depend on the item's current position in the array.

Basic definition, now that the motivation is clear:

> A **key** is a hint you give React so it can match up elements across renders by *identity* rather than by *position*, allowing it to correctly decide which DOM node and component state to keep, move, or discard.

Without an explicit `key`, React falls back to matching by **position + component type** — which, as you just saw with the musical chairs, works fine until the list changes shape.

A few mechanical facts worth pinning down before moving on:

- **Keys must be strings or numbers.** React coerces them internally for comparison, but the value you hand it should be something simple and stable — an ID from your data, not an object or array.
- **Keys only need to be unique among siblings**, not globally across your whole app. Two different `<ul>` lists elsewhere on the page can both have an item with `key="1"` without any conflict — React only compares keys within the same parent.
- **The key has to sit on the outermost element returned for each list item**, not on some element nested inside it. If you map over data and return a wrapper component, the `key` goes on the component invocation itself (`<TodoRow key={todo.id} />`), not on a `<div>` buried inside `TodoRow`'s own JSX — by the time React is inside `TodoRow`, the matching decision for *that slot* has already been made.
- **`key` never arrives in `props`.** React intercepts it before your component function ever runs. If you need the same value inside the component, you have to pass it again under a different prop name (`<TodoRow key={todo.id} id={todo.id} />`).

### What if your data has no natural ID?

Sometimes you're rendering a list where the underlying data genuinely has no unique identifier — maybe it's a plain array of strings pulled from a text field, split on commas. A few real options, from most to least preferred:

1. **Generate a stable ID once, when the data is created or fetched, and store it alongside the data** — e.g., attach a `crypto.randomUUID()` to each object the moment it's added to your array or fetched from an API, and keep that ID with the object from then on (not regenerated on every render — generated *once*, then persisted in state right along with the rest of the item's fields).
2. **Combine multiple fields into a composite key**, if some combination of existing fields happens to be unique — e.g., `key={`${item.category}-${item.name}`}` — as long as that combination genuinely can't collide and doesn't change across renders.
3. **Fall back to the index, deliberately, only when the list is provably static** — no reordering, no filtering, no deletion from the middle, ever. This is a real, acceptable option in that narrow case — not every index-key usage is a bug, just the ones on lists whose shape can change.

What you should never do is generate the "stable" ID fresh on every render (covered in Mistake 2, Section 10) — the ID has to be computed once and then persisted, exactly like any other piece of state.

---

## 4. Internal Working: Slots, Not Items

Let's make this completely concrete with the exact scenario from Section 1: a list of todos, each with a text input, before and after deleting item #2.

**Setup:** three todos. Each row renders `<input>` pre-filled with editable text. The user has typed custom text into each input, so each input's *current* DOM value differs from its original prop.

```
Initial render — three rows:

  Row 1: todo.id=1   input value: "milk"
  Row 2: todo.id=2   input value: "eggs"
  Row 3: todo.id=3   input value: "bread"
```

Now the user deletes item #1 (`todo.id=1`) from the underlying array. The array is now `[todo2, todo3]`.

### WITHOUT keys (or with `key={index}`, which is really the same problem)

React reconciles by **position**. It looks at "slot 0" and "slot 1" — it does not know that the item formerly in slot 0 is gone; it only sees that the list is now shorter.

```
BEFORE delete                      AFTER delete (no stable key)

 Slot 0: <input> "milk"     ---->  Slot 0: <input> "eggs"   <-- WRONG! This DOM
 Slot 1: <input> "eggs"     ---->  Slot 1: <input> "bread"      node is REUSED
 Slot 2: <input> "bread"    ---->  (slot 2 removed)              from slot 0 —
                                                                  it still has
                                                                  the OLD "milk"
                                                                  text the user
                                                                  typed, now
                                                                  labeled as
                                                                  todo2's row!
```

React sees "slot 0 still exists, it's still an `<input>`" — so it keeps the *same DOM node and component instance* that used to be todo1's row, and just updates its `todo` prop to now point at todo2's data. But the DOM node's uncontrolled internal value (or any local component state tied to that instance) doesn't automatically reset — it's the *same instance*, just wearing todo2's label now.

If the input's value is controlled purely by props (`value={todo.text}`), you might not notice — the value prop *would* update correctly. But the moment there's ANY local state living in that row component (an "is this row currently being edited" boolean, an uncontrolled input's typed draft, a CSS transition state, focus) — that state stays behind, attached to the slot, and gets inherited by whatever data now occupies that slot.

### WITH stable keys (`key={todo.id}`)

```
BEFORE delete                      AFTER delete (key={todo.id})

 key=1: <input> "milk"      ---->  (todo1 removed — instance
                                     destroyed, DOM node removed)

 key=2: <input> "eggs"      ---->  key=2: <input> "eggs"    <-- SAME instance,
                                                                  correctly
                                                                  matched by key,
                                                                  state intact

 key=3: <input> "bread"     ---->  key=3: <input> "bread"   <-- SAME instance,
                                                                  correctly
                                                                  matched by key,
                                                                  state intact
```

React now matches elements by key first: "is there an existing instance with `key=2`? Yes — keep it, update its props if needed, don't touch its internal state." "Is there an existing instance with `key=1`? No, it's gone from this render — destroy it, remove its DOM node." Nothing shifts into the wrong bucket, because there are no anonymous "slots" anymore — every item is tracked by its own identity.

This is the entire mechanism. Reconciliation with keys is a **matching problem** ("which old elements correspond to which new elements, by key"), not a **positional diff** ("what's different about slot N compared to last time").

> **Memory hook:** "No keys means React tracks seat numbers. Keys mean React tracks people."

### What about a pure reorder — no delete, no insert?

It's worth walking through one more shape of change, because it shows the *cost* difference, not just the *correctness* difference. Say the same three todos get reordered — bread moves to the front — with nothing added or removed.

```
BEFORE reorder                     AFTER reorder (key={todo.id})

 key=1: "milk"                      key=3: "bread"   <-- MOVED here,
 key=2: "eggs"                      key=1: "milk"        same instance,
 key=3: "bread"                     key=2: "eggs"         same DOM node,
                                                           state intact
```

With stable keys, React recognizes all three keys are still present, just in a different order — so it **moves** the existing DOM nodes and instances to their new positions rather than destroying and recreating anything. Any state inside those rows (a focused input, an in-progress draft) survives the reorder untouched, and the browser only has to move three existing elements around, not tear down and rebuild three new ones.

Without stable keys, React has no way to know "bread" is the same logical item that used to be at the bottom — it just sees that slot 0's content changed from `"milk"` to `"bread"`, slot 1 changed from `"eggs"` to `"milk"`, and slot 2 changed from `"bread"` to `"eggs"`. Depending on what's inside each row, this can mean applying three separate prop updates (cheap) or, if there's local per-row state like an open `<details>` panel or scroll offset inside the row, that state stays glued to the slot and visibly "doesn't follow" the item it belongs to as it moves.

This is really the same slot-vs-item lesson as the delete case in Section 1, just triggered by a reorder instead of a deletion — same root cause, same fix.

### And one more shape: inserting at the front

Insertion at the *front* of a list is actually the single most dramatic illustration of why index keys are bad, because it forces a rewrite of every single slot, even though only one new thing was actually added.

```
BEFORE insert                       AFTER inserting "kale" at the front

WITHOUT stable keys (index-based)   WITH stable keys (todo.id-based)

 Slot 0: "milk"    ---> "kale"       key=4: "kale"   <-- genuinely NEW,
 Slot 1: "eggs"     ---> "milk"       key=1: "milk"       mounted fresh
 Slot 2: "bread"    ---> "eggs"       key=2: "eggs"   <-- all THREE of
 (slot 3 new)       ---> "bread"      key=3: "bread"      these just MOVED
                                                           down one spot,
                                                           same instances
```

Without keys, React sees every slot's content change — `"milk"` became `"kale"`, `"eggs"` became `"milk"`, `"bread"` became `"eggs"`, and a brand new slot 3 got `"bread"`. From React's point of view, it looks like *three updates and one addition*, even though conceptually only *one addition* really happened. Every row's local state (drafts, focus, scroll) gets shifted down one slot along with the content, exactly like the delete case in Section 4 — just in the opposite direction.

With stable keys, React's actual work matches your mental model exactly: one genuinely new instance is created for `key=4` ("kale"), and the three existing instances are left alone (or, in this specific "insert at front" case, moved — but never re-created, never re-initialized). This isn't just a correctness improvement — it's also strictly less work for React to do, which matters more as the list grows longer.

> **Memory hook:** "Adding one new name tag at the front of the line shouldn't require reprinting everyone else's."

---

## 5. Example 1 — The Classic Broken List-of-Inputs Bug

Let's write the actual broken code, then fix it.

### Broken version (index as key)

```jsx
function TodoList({ todos, onDelete }) {
  return (
    <ul>
      {todos.map((todo, index) => (
        // BUG: index is not a stable identity — it's a position
        <TodoRow key={index} todo={todo} onDelete={() => onDelete(todo.id)} />
      ))}
    </ul>
  );
}

function TodoRow({ todo, onDelete }) {
  // Local, uncontrolled draft state — lives INSIDE this component instance
  const [draft, setDraft] = useState(todo.text);

  return (
    <li>
      <input value={draft} onChange={e => setDraft(e.target.value)} />
      <button onClick={onDelete}>Delete</button>
    </li>
  );
}
```

Walk through it exactly as in Section 4:

1. Todos render: `["milk", "eggs", "bread"]` at indices `0, 1, 2`.
2. User edits the *second* row's draft to `"eggs (2 dozen)"`. That state lives in the `TodoRow` instance currently mounted at `key={1}`.
3. User deletes the *first* todo (milk). The array shifts: `["eggs", "bread"]`, now at indices `0, 1`.
4. React reconciles `key={0}` — same key as before, so it's treated as **the same instance**. That instance's local `draft` state (`"milk"`, untouched, since the user never edited row 1) survives, but its `todo` prop is now `eggs`. So the input momentarily shows `"milk"` next to a row whose checkbox and delete button now act on the `eggs` todo. Meanwhile, the instance that *was* at `key={1}` (holding the correctly-edited `"eggs (2 dozen)"` draft) is now `key={1}`'s new occupant — bread — and that carefully-typed edit is gone entirely, silently swallowed.

This is the exact bug from Section 1, now traced step by step through actual code.

### Fixed version (stable, data-derived key)

```jsx
function TodoList({ todos, onDelete }) {
  return (
    <ul>
      {todos.map(todo => (
        // FIX: todo.id is stable — it belongs to the DATA, not the POSITION
        <TodoRow key={todo.id} todo={todo} onDelete={() => onDelete(todo.id)} />
      ))}
    </ul>
  );
}
```

Nothing else changes. Now when milk (`id: 1`) is deleted, React looks for an existing instance keyed `1` — doesn't find one in the new render — destroys it. The instances keyed `2` (eggs) and `3` (bread) are untouched; their `draft` state travels with them, correctly, because their key never changed. The user's careful edit to the eggs row survives the deletion of an unrelated row.

> **Rule of thumb:** if the list can be reordered, filtered, or have items inserted/removed from the middle, the key must come from the *data itself* (an ID), never from the array index.

> **Memory hook:** "The key travels with the data. The index travels with the seat."

---

## 6. Example 2 — Deliberately Forcing a Remount with `key`

Now flip the bug into a feature. Sometimes you *want* React to throw away an existing component instance and start completely fresh — and changing the `key` is the officially sanctioned way to do it.

**Scenario:** you're editing a customer record in a form. The form has a pile of local state — text fields, a "has this field been touched" flag per input, maybe an uncommitted draft. When the user picks a *different* customer from a dropdown, you want the form to reset entirely, not carry over leftover edits from the previous customer.

### The problem, without a key change

```jsx
function CustomerEditor({ customerId }) {
  return <CustomerForm customerId={customerId} />;
}

function CustomerForm({ customerId }) {
  const customer = useCustomer(customerId); // fetches customer data
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email);
  // ...
}
```

`useState(customer.name)` only reads its argument on the *very first* render of this instance — that's how `useState` works, the initial value is not re-applied on every render. If `customerId` changes but `CustomerForm` stays mounted (same type, same position), `name` and `email` **do not reset**. The form keeps showing the previous customer's half-edited values, now incorrectly labeled as belonging to the new customer. This is the "component didn't reset when I expected it to" half of the bug from Section 1.

### The fix — change the key when the underlying "identity" changes

```jsx
function CustomerEditor({ customerId }) {
  // Changing customerId changes the key, which tells React:
  // "this is conceptually a NEW form, not an update to the old one."
  return <CustomerForm key={customerId} customerId={customerId} />;
}
```

Now, when `customerId` goes from `42` to `43`, the `key` prop changes from `42` to `43`. React sees a different key at this position and treats it as **destroy the old instance, mount a brand new one** — every `useState` call inside `CustomerForm` runs fresh, `name` and `email` re-initialize from the *new* customer's data, any "touched" flags reset to false, everything starts clean.

```
customerId=42                        customerId=43
        |                                    |
        v                                    v
<CustomerForm key={42}>            <CustomerForm key={43}>
  name: "Alice"                      (OLD instance destroyed)
  email: "alice@x.com"               (NEW instance mounted)
  touched: {name: true}              name: "Bob"        <- fresh from
                                      email: "bob@x.com"    useState(customer...)
                                      touched: {}         <- reset to {}
```

This is a genuinely common, recommended pattern — not a hack. You'll see it described in React's own documentation as "resetting state with a key." Other real examples: resetting a multi-step wizard when switching between two independent flows, resetting an `<input type="file">`'s selection, remounting a chart component when the dataset it visualizes changes identity (rather than trying to patch its internal animation/zoom state).

> **Memory hook:** "Change the key, get a brand-new component — clean slate, no leftovers from the last tenant."

### A second real example: resetting a form on "Add new" vs. "Edit existing"

Here's a variant of the same problem that shows up constantly in CRUD-style apps. A single `ItemForm` component is reused both for creating a brand new item and for editing an existing one:

```jsx
function ItemPage({ selectedItem }) {
  // selectedItem is either an existing item object, or null for "create new"
  return (
    <ItemForm
      key={selectedItem ? selectedItem.id : 'new'}
      initialValue={selectedItem}
    />
  );
}
```

Notice the key expression: `selectedItem ? selectedItem.id : 'new'`. Every existing item gets its own key (so switching between editing item 7 and item 12 remounts the form fresh, exactly like the customer example). But there's also a *dedicated* key, `'new'`, for the create-mode case — so switching from "editing item 7" to "create a new item," and then to "create another new item," reliably resets the form every time, because `'new'` is only ever reused when you're genuinely back in create mode with nothing filled in yet.

Without that dedicated `'new'` key, going from "editing item 7" straight to "create new" would still remount correctly (different key: `7` vs `'new'`) — but going from one blank "create new" session to *another* blank "create new" session (say, the user cancels and clicks "Add new" again) would keep reusing the same `'new'` key both times, and any state left in the form from the first attempt would still be sitting there. Whether that's desired or not depends on the product — but it's the kind of subtlety that only becomes visible once you're deliberately reasoning about keys as identity, not just as "the thing lists need."

---

## 7. Same Position, Different Type: Always a Remount

There's one more identity rule worth nailing down, because it resolves a common point of confusion: what happens when the same *position* in the tree renders a **different component type** depending on a condition?

```jsx
function AuthPanel({ mode }) {
  return mode === 'login' ? <LoginForm /> : <SignupForm />;
}
```

Every time `mode` flips between `'login'` and `'signup'`, React sees a different element type occupying that position — `LoginForm` versus `SignupForm` are simply not the same component function. React does not attempt to diff their internals or "translate" one's state into the other's shape. It unconditionally **destroys the old instance and mounts a brand new one**, no key required.

Contrast that with changing *props* on the *same* type:

```jsx
function AuthPanel({ mode }) {
  // Same component type every time — only the prop changes
  return <AuthForm mode={mode} />;
}
```

Here, `AuthForm` is the same function in the same position on every render. React keeps the *same instance* and simply passes it a new `mode` prop. Any local state inside `AuthForm` — like a "show password" toggle — survives the `mode` change entirely, because as far as React's identity check is concerned, nothing about "which component is this" has changed. If you actually wanted that `AuthForm` instance to reset when `mode` flips, you'd need to opt in explicitly with `key={mode}`, exactly as in Section 6.

So there are really three levers, not two:

1. **Different type in the same position** → always remounts. No key needed to force it; you can't prevent it either.
2. **Same type, same key (or no key, same position)** → same instance kept, props update, state preserved.
3. **Same type, different key** → treated as a different identity, remounts even though the type didn't change.

> **Memory hook:** "Different actor walking on stage always gets a new introduction — same actor just changing costume doesn't."

### A subtlety: conditionally rendering `null`

One more shape worth knowing: what happens when a component's position sometimes renders `null` instead of an element?

```jsx
function Row({ showDetails, data }) {
  return (
    <>
      <div>{data.title}</div>
      {showDetails ? <Details data={data} /> : null}
    </>
  );
}
```

Here, toggling `showDetails` from `true` to `false` and back doesn't just "hide" `Details` — it unmounts it entirely when `showDetails` is `false` (there's no element there at all, so no instance exists), and mounts a fresh instance when it flips back to `true`. Any state inside `Details` resets every time `showDetails` becomes `true` again, for the same reason as Section 7's type-switch: there was no instance to preserve while `null` was being rendered in its place. If you instead want `Details` to stay mounted and merely hidden (preserving its internal state across the toggle), you'd keep it always rendered and control visibility with CSS (e.g., `style={{ display: showDetails ? 'block' : 'none' }}`) instead of conditionally rendering it at all.

---

## 8. Compare: Update-in-Place vs. Destroy-and-Recreate

Here's the full identity decision table, boiled down to one place:

| Type across renders | Key across renders | What React does | State preserved? |
|---|---|---|---|
| Same component type | Same key (or no key, same position, list unchanged) | Update existing instance in place — reuse the DOM node, re-run the component function, apply new props | Yes |
| Same component type | Different key | Destroy old instance + DOM node, mount a brand new instance | No — fresh state |
| Different component type | (key irrelevant) | Always destroy old instance + DOM node, mount a brand new instance of the new type | No — fresh state |
| Same component type | Same key, but item's *position* shifted in a list (no key at all, using index) | Old instance at that position is reused for whatever data now lands there — this is the bug | Misleadingly "yes," but attached to the wrong data |

Notice the last row is the trap: state gets "preserved" in a technical sense — an instance really is kept alive — but it's preserved for the *wrong logical item*, because position, not true identity, was used to match it.

Let's walk each row once more, in plain language, because interviewers love asking you to explain this table without looking at it:

- **Row 1 (same type, same key)** is the everyday case — most of your app's re-renders. A parent re-renders, its children have the same types and keys as last time, so React just walks down, updates props where they changed, and leaves everything else — DOM nodes, hook state, refs — completely untouched. This is what makes React fast: it does the least work necessary, and "necessary" is defined by this exact matching rule.
- **Row 2 (same type, different key)** is the deliberate reset lever from Section 6. You're intentionally telling React "don't treat this as an update, treat it as a new thing," even though nothing about the component's *code* changed at all.
- **Row 3 (different type)** is automatic and unconditional — from Section 7. There's no "key trick" that can make React preserve state across a type change, and there's no way to accidentally preserve state across a type change either. Type changes are a hard boundary.
- **Row 4 (no key / index key, shape changed)** is the accidental version of Row 2's opposite — you *wanted* Row 1's behavior (preserve state for the item that has it), but because you gave React only a position to go on, it delivered Row 1's mechanics attached to the wrong logical item. This is the entire bug this file is about, restated one more time, because it's worth repeating: the mechanism didn't malfunction — it did exactly what a positional match is supposed to do. The mismatch is between what the *mechanism* tracks (a slot) and what *you* actually wanted tracked (an item).

---

## 9. Real-World Scenarios

Theory sticks better once you've seen the same identity rules play out across a few different domains. Here are three.

### 9.1 Drag-and-drop kanban board

A kanban board has columns ("To Do," "In Progress," "Done"), each holding an array of task cards. Dragging a card moves it from one column's array to another's — a classic reorder-plus-relocate operation, and cards commonly have an inline-editable title with its own local `useState` draft.

```jsx
function Column({ title, tasks }) {
  return (
    <div className="column">
      <h3>{title}</h3>
      {tasks.map(task => (
        // task.id must be a durable identifier, generated once when
        // the task was created — NOT the task's position in this
        // column, which changes every time a card is dragged.
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}

function TaskCard({ task }) {
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [isEditing, setIsEditing] = useState(false);
  // ...
}
```

If cards were keyed by their column-relative index instead, dragging card A from position 2 in "To Do" to position 0 in "In Progress" would, from React's point of view, look like "the card at index 0 in the destination column changed its title/content" — any card that happened to already be at index 0 in "In Progress" would have card A's data forced onto its existing instance, and *its* in-progress edit (if the user had one open) would vanish, replaced by card A's data wearing the wrong instance's clothes. Using `task.id` avoids all of this — cards carry their identity with them across columns exactly the way they should.

### 9.2 Chat application switching conversations

A messaging app shows a `MessageComposer` at the bottom of the screen — a text input with drafts, an emoji picker's open/closed state, maybe an "@mention" autocomplete state. Switching between conversations in the sidebar should give you a fresh composer per conversation, ideally restoring whatever draft you'd started typing in *that specific* conversation, not carrying over whatever you were typing in the previous one.

```jsx
function ChatApp({ activeConversationId }) {
  return (
    <div className="chat">
      <MessageList conversationId={activeConversationId} />
      <MessageComposer
        key={activeConversationId}
        conversationId={activeConversationId}
      />
    </div>
  );
}
```

`key={activeConversationId}` means switching conversations always remounts the composer fresh. If the product requirement is "restore my per-conversation draft," the composer's initializer reads that draft from storage keyed by `conversationId` on mount — since it's a genuinely new instance every time the conversation changes, its `useState` initializer runs again and picks up the right draft for the *new* conversation, rather than needing to manually detect "did the conversation change" inside an already-mounted instance.

### 9.3 E-commerce cart line items

A shopping cart lists line items, each letting the shopper adjust quantity with local input state before it's committed (say, on blur) to the actual cart total.

```jsx
function Cart({ items, onQuantityChange }) {
  return (
    <ul>
      {items.map(item => (
        <CartLine
          key={item.sku}
          item={item}
          onQuantityChange={onQuantityChange}
        />
      ))}
    </ul>
  );
}
```

`item.sku` (a stable product identifier) is the right key here — not the item's position in the cart. If a shopper removes a line item in the middle of the cart while they have an unsaved quantity edit typed into a *different* line's input, index-based keys would shift that unsaved edit onto the wrong product the instant the array shortens — exactly the Section 1 bug, this time with real money and real quantities on the line, which makes it a much more expensive place to have a silent bug than a todo app.

### 9.4 A note on testing: why this matters for test reliability too

If you write component tests (say, with React Testing Library), identity bugs show up there too, just wearing a different disguise. A test that renders a list, simulates deleting an item, and then asserts on the *remaining* rows' text can pass even when the underlying component has an index-key bug — because the test is often only checking what text is *currently displayed*, not which underlying instance is showing it. The test would only catch the bug if it specifically asserts on stateful behavior surviving a list mutation — e.g., "type into row 2's input, delete row 1, assert row 2's input still shows what was typed." That's a meaningfully different (and stronger) assertion than "assert the list now shows two items with the right labels," and it's worth writing deliberately, precisely because the label-only version of the test gives false confidence.

---

## 10. Common Mistakes and Confusions

**Mistake 1 — Using the array index as `key` on a reorderable/filterable/deletable list.**

This is the single most common React bug related to keys. It compiles fine, React doesn't warn you about it in every case (it *will* warn if there's no key at all, but `key={index}` silences that warning while not actually fixing the underlying problem). It only bites you once the list changes shape — which is exactly when it's hardest to notice in a quick manual test, because the bug depends on there being local state per row and on a delete/insert/reorder actually happening during a session.

If the list is truly static — never reordered, filtered, or spliced, items only ever appended at the end — index keys are harmless. But that's a narrow, easy-to-violate assumption, so the safe default is: reach for a stable data ID whenever one exists.

**Mistake 2 — Using an unstable value as the key, like `Math.random()` or `Date.now()`.**

This is the mirror-image mistake — instead of too little identity information, you're generating a *new* identity on every single render.

```jsx
// WRONG — a brand new random key every render means React
// thinks this is a NEW component every time, and remounts it
// constantly, destroying all its state and losing focus, scroll
// position, animation state, etc.
<TodoRow key={Math.random()} todo={todo} />
```

If you ever see input fields losing focus after every keystroke, an unmount/remount console log firing on every render, or CSS transitions restarting constantly for no visible reason — check whether a key is being regenerated fresh on every render. `Date.now()` computed at render time has the identical problem; it produces a different value practically every render.

**Mistake 3 — Not realizing a key change is a *deliberate, legitimate* tool.**

Because keys are introduced early on purely as "the thing React nags you about on lists," a lot of developers never learn the second half of the story: intentionally changing a key is a first-class technique for forcing a clean reset, and it's often simpler and more reliable than manually resetting a pile of `useState` calls with a `useEffect` that watches for the ID to change. Reaching for `key={someIdentityValue}` on a component you want to fully reset is usually *less* code and *more* correct than writing effect-based reset logic by hand.

**Mistake 4 — Assuming props changing on the same component type causes any reset at all.**

As covered in Section 7, changing props on an already-mounted instance of the same type never resets its internal state on its own. If you need a reset tied to a prop change, that reset has to be explicit — either via a key change, or via an effect that detects the specific prop change and calls the state setters itself.

**Mistake 5 — Putting the key on the wrong element.**

```jsx
// WRONG — key is on the <div> inside TodoRow, not on the TodoRow
// element itself. As far as the parent's reconciliation is concerned,
// EVERY TodoRow in this list is keyless, because the key never
// reached the slot where the matching decision actually happens.
function TodoList({ todos }) {
  return todos.map(todo => <TodoRow todo={todo} />);
}
function TodoRow({ todo }) {
  return <div key={todo.id}>{todo.text}</div>;
}
```

The key has to be visible to the parent doing the `.map()` — it belongs on the element the parent directly returns for each array entry, not buried a level deeper inside a child component's own render output. This one is easy to miss because it doesn't error or warn; the code above renders correctly at first glance, and only reveals itself as broken once the exact same delete/reorder bugs from Section 5 start showing up.

> **Memory hook:** "The name tag goes on the person entering the room — not on a badge they keep in their pocket."

**Mistake 6 — Forgetting that keyed fragments need `React.Fragment`, not the shorthand `<>`.**

Sometimes a list item needs to render multiple sibling elements without an extra wrapping `<div>` — say, a `<dt>`/`<dd>` pair per entry in a definition list. The shorthand fragment syntax `<>...</>` cannot take a `key`, because it isn't allowed to accept any props at all:

```jsx
// WRONG — the shorthand fragment <>...</> cannot carry a key prop,
// so this either fails to compile or, in looser setups, silently
// drops the key.
{entries.map(entry => (
  <>
    <dt>{entry.term}</dt>
    <dd>{entry.definition}</dd>
  </>
))}
```

The fix is to spell out `React.Fragment` explicitly, which — unlike the shorthand — does accept a `key`:

```jsx
// CORRECT — explicit React.Fragment accepts the key prop
{entries.map(entry => (
  <React.Fragment key={entry.id}>
    <dt>{entry.term}</dt>
    <dd>{entry.definition}</dd>
  </React.Fragment>
))}
```

---

### Debugging identity issues in practice

A few practical tells that an identity/key problem is at play, worth keeping in your back pocket:

- **The console warning** "Warning: Each child in a list should have a unique 'key' prop" is React telling you it fell back to positional matching for that list. It's not just noise — treat it as a direct pointer to a potential state-mixup bug waiting to happen the moment that list's shape changes.
- **React DevTools' Components panel** lets you inspect a component instance's hooks state directly. If you suspect state is "sticking" to the wrong row, select the suspicious row before and after the list changes, and watch whether the *same* instance (same hooks values) reappears attached to different data — that's the smoking gun.
- **An unexpected mount/unmount log** (e.g., a `useEffect(() => { console.log('mounted'); return () => console.log('unmounted'); }, [])` inside the suspicious component) firing far more often than you'd expect is the quickest way to catch an accidentally unstable key — if a component logs "mounted" on every render of its parent, its key is almost certainly changing every time.

---

### Quick-reference summary before you practice

Before jumping into the exercises, here's the entire file compressed into four lines — pin this to memory, everything else in this lesson is just justification for these four lines:

```
1. Same type + same key         → same instance, state preserved
2. Same type + different key    → destroyed and recreated, state reset
3. Different type (any key)     → always destroyed and recreated
4. No key, list shape changes   → matched by position, state can leak
                                    onto the wrong data (the bug)
```

---

## 11. Hands-On Exercises

**Exercise 1 — Reproduce the bug**

Build a list of "message drafts," each row containing a textarea pre-filled with `draft.text` and using local `useState` for the in-progress edit. Render the list with `key={index}`. Type distinct text into two different rows, then delete the first row. Observe (and write down, in your own words) exactly which row's text ends up where, and why.

> Hint: Log the `draft` state's initial value alongside a `console.log('mounted', index)` inside a mount-only effect. Watch which rows actually mount fresh versus which ones are reused after the delete — that tells you exactly which instance is "inheriting" the wrong text.

**Exercise 2 — Fix it**

Fix the component from Exercise 1 by switching to a stable, data-derived key (add an `id` field to each draft object if one doesn't exist yet). Re-run the same steps and confirm each row's edited text now stays attached to the correct draft after a deletion.

> Hint: If your draft objects come from an array literal you control in a test harness, generate the `id` once, e.g. with an incrementing counter or `crypto.randomUUID()`, at the moment each draft object is created — not inside the render function.

**Exercise 3 — Force a reset with a key**

Build a `<Counter>` component with a single `useState` counter starting at 0, with `+` and `-` buttons. Render two counters side by side for two different "user IDs" selected from a dropdown (`<Counter key={userId} userId={userId} />`). Increment one counter, then switch the dropdown away and back. Confirm the counter resets to 0 every time the `userId` (and therefore the key) changes — then remove the `key` prop and observe that the counter no longer resets, even though the `userId` prop still changes.

> Hint: Add a mount-only effect inside `Counter` that logs `"mounted for " + userId`. With the key present, you should see a fresh mount log every time you switch users. Without it, you won't.

**Exercise 4 — Same type vs. different type**

Build a component that conditionally renders either `<CommentEditor />` or `<CommentViewer />` based on an `isEditing` boolean, both of which manage their own `useState` for a "has unsaved changes" flag. Toggle `isEditing` back and forth and confirm the flag never survives the toggle, no matter what you do — then explain in one sentence why no key is needed to achieve that here.

> Hint: Try to "cheat" by giving both components the exact same `key` value. Confirm it makes no difference — they're still different types, so the key is irrelevant to this particular decision. This is the detail most people get wrong first try.

**Exercise 5 — Diagnose an unstable-key bug**

You're handed a component where a list of notification toasts is rendered with `key={Math.random()}`. Users report that toasts flicker and any "dismiss" animation is cut short. Explain, referencing Section 4's slot diagram style, what's happening on every re-render, and rewrite the key correctly.

> Hint: Toasts almost always have their own `id` already, generated when the toast is created (e.g., to support a "dismiss this specific toast" button). That pre-existing `id` is very likely sitting right there, unused as a key.

**Exercise 6 — Design decision**

A kanban board renders draggable task cards inside columns. Cards can move between columns (reordering the underlying array) and users can rename a card inline (local `useState` for the editable title while typing). Decide what should be used as each card's `key`, and explain what would go wrong if you used the card's *column-relative index* instead of a task ID.

> Hint: Revisit Section 9.1 — this exercise is a direct rerun of that scenario. Try writing out the before/after slot diagram yourself, in the same style as Section 4, before checking your answer against it.

---

## 12. Interview Q&A

**Q1: What problem does the `key` prop solve in React?**

A: It gives React a way to track element identity across renders by something more reliable than position. Without a stable key, React matches elements in a list by their index/position plus type, which breaks down the moment the list is reordered, has items inserted, or has items removed — state that belongs to one logical item can end up attached to a different item that now happens to occupy the same slot.

---

**Q2: Why is using the array index as a key considered an anti-pattern?**

A: An index describes *where* an item currently sits, not *what* the item is. If the list's order or membership can change (delete, insert, reorder), the index tied to a given piece of data changes too, so React ends up matching old component instances (and their state) to the wrong data. It's safe only for lists that never reorder, filter, or splice — items are only ever appended and never removed or reordered.

---

**Q3: Walk through exactly what happens, internally, when you delete the first item from a keyed list vs. an index-keyed list.**

A: With stable keys, React looks for an existing instance matching each new element's key. The deleted item's key simply doesn't appear in the new render, so its instance and DOM node are destroyed; every other item's key is unchanged, so those instances are reused as-is, with their internal state intact. With index keys, React matches by position: slot 0 in the old render and slot 0 in the new render are treated as "the same," even though slot 0 now holds different data (since everything shifted up by one) — so the state that belonged to old-slot-0 stays attached to that position and gets misapplied to the data that shifted into it.

---

**Q4: How does React decide whether to preserve or reset a component's state across renders?**

A: React preserves a component instance's state — keeping the same instance, DOM node, and internal hooks state — as long as the component type at a given tree position stays the same across renders, and, for lists, as long as its key (if any) stays the same. If the type changes, or if the key changes while the type stays the same, React treats it as a different identity: it destroys the previous instance entirely and mounts a fresh one, running all initializers again and discarding all prior state.

---

**Q5: If you conditionally render `<LoginForm />` or `<SignupForm />` based on a boolean, does React ever try to preserve state between them?**

A: No. They're different component types occupying the same tree position, so React always fully unmounts whichever one was showing and mounts the other fresh — there's no partial state carryover, and no key is needed to force this; it's automatic because the types themselves differ.

---

**Q6: Does changing a prop on a component reset its internal state?**

A: Not by itself. If the component type and its key both stay the same, React keeps the existing instance and simply re-renders it with the new prop values — any `useState` inside keeps its current value regardless of what changed in props. To force a reset tied to a specific prop change, you either derive the `key` from that prop (so a change in the prop becomes a change in identity) or handle the reset explicitly, e.g. in an effect.

---

**Q7: What is the "key reset" technique, and when would you reach for it?**

A: It's the practice of deliberately setting `key={someIdentityValue}` on a component so that whenever `someIdentityValue` changes, React treats it as a brand-new identity and remounts the component from scratch, wiping all of its internal state. It's the standard fix for components that hold a pile of local editing state (forms, wizards, uncontrolled inputs) that should fully reset whenever the record they're editing changes — for example, `<CustomerForm key={customerId} />` resetting whenever the user switches which customer they're editing.

---

**Q8: What's the difference between `key={item.id}` and `key={index}` in terms of what React actually stores per key?**

A: React maintains, per parent, a mapping from key to the fiber (its internal representation of the component instance, along with its hooks' state and its DOM references) that was rendered with that key last time. `item.id` ties that mapping to the data, so it survives reordering. `index` ties that mapping to a numeric position, which is meaningless once the data at that position changes — the fiber and its state get reassigned to whatever new data now occupies that index.

---

**Q9: Can two sibling elements have the same key?**

A: No — keys only need to be unique among siblings at the same level of the tree, but they must be unique there. Duplicate keys among siblings mean React can't reliably tell which element is which; in practice React will warn about duplicate keys and behavior around which instance is kept or discarded becomes unpredictable.

---

**Q10: Why does `Math.random()` or `Date.now()` make a bad key?**

A: Both generate a brand-new value on essentially every render, which means the key "changes" every time even though the underlying data item hasn't. React reads that as "this is a different identity now" and remounts the component on every single render — destroying and recreating its state, resetting scroll/focus/animation, and doing far more mount/unmount work than necessary. A key must be *stable across renders for the same logical item*, which a freshly-generated random or time-based value can never be.

---

**Q11: In a form-in-a-list scenario, why might a bug not show up during casual manual testing even though `key={index}` is used?**

A: Because the bug only manifests once the list's *shape* changes while some row has independent local state that differs from its neighbors — e.g., the user has typed something into one row's input, and then a row is deleted or reordered. If a developer only tests by adding items to the end of the list, or never edits more than one row before checking behavior, the mismatch between position and identity never gets triggered, even though the underlying schema is broken.

---

**Q12: How would you decide, in code review, whether an index key is acceptable?**

A: Ask whether the list can ever be reordered, filtered, or have items removed/inserted anywhere but the end, and whether any list item renders a component with meaningful local state (input drafts, open/closed toggles, animation state) or relies on DOM-level state like focus or scroll position. If the list is genuinely append-only and items carry no independent local state, index keys are harmless. If either condition is false, insist on a stable, data-derived key.

---

**Q13: What's the practical difference between forcing a remount via `key` and just calling a bunch of `setX(initialValue)` calls in a `useEffect`?**

A: A key change is declarative and comprehensive — React tears down the entire previous instance (all hooks, all state, all effects' cleanup, any DOM node it owned) and builds a genuinely fresh one, so there's no risk of forgetting to reset some piece of state. Manually calling setters in an effect requires you to enumerate and reset every single piece of state yourself, runs after an extra render (briefly showing stale state before the effect fires), and is easy to get subtly wrong if new state is added later and the reset logic isn't updated to match.

---

**Q14: Two components render at the same JSX position across renders — one is a class component, the other a function component with the same name. Does React preserve state between them?**

A: No. React's identity check is based on whether it's literally the same function/class reference (the component type), not the type's name or shape. Different definitions — even coincidentally sharing a name — are different types as far as React's reconciler is concerned, so switching between them always triggers a full unmount of the old instance and mount of the new one.

---

**Q15: A parent renders a list without any `key` prop at all on the children. What does React do, and how is that different from `key={index}`?**

A: If no `key` is supplied, React effectively falls back to matching children by their position in the array combined with type — which, for the purposes of the identity/state-preservation rules covered in this file, behaves identically to using the index as the key. React will also emit a console warning ("Each child in a list should have a unique key prop") in this case, whereas explicitly passing `key={index}` silences that warning without fixing the underlying positional-matching problem — which is exactly why it's a trap: the warning goes away, but the bug doesn't.
