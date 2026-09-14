# Events — Complete Guide

## Table of Contents
1. [addEventListener Basics](#1-addeventlistener-basics)
2. [The Event Object](#2-the-event-object)
3. [Event Bubbling and Capturing](#3-event-bubbling-and-capturing)
4. [Event Delegation](#4-event-delegation)
5. [preventDefault and stopPropagation](#5-preventdefault-and-stoppropagation)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. addEventListener Basics

`addEventListener` attaches a function that runs whenever a specified event occurs on an element.

```js
const button = document.querySelector("button");

button.addEventListener("click", function () {
  console.log("Button was clicked!");
});

// Arrow function version — same effect
button.addEventListener("click", () => {
  console.log("Clicked again!");
});
```

### Field-by-Field Breakdown

```
button.addEventListener("click", handlerFunction)
                          │       │
                          │       └── the function to run WHEN the event fires
                          │           (called the "event handler" or "listener")
                          └── the event TYPE — a string naming what to listen for
                              ("click", "input", "submit", "keydown", "mouseover", ...)
```

### Multiple Listeners on the Same Event

```js
button.addEventListener("click", () => console.log("First handler"));
button.addEventListener("click", () => console.log("Second handler"));
// Clicking the button logs BOTH — unlike the older onclick property, addEventListener
// does NOT overwrite previous listeners; you can attach as many as you want.

button.onclick = () => console.log("Only one allowed this way");
button.onclick = () => console.log("This OVERWRITES the previous onclick assignment");
// Clicking now only logs the second message — the older "on___" property style
// can only ever hold ONE handler per event type.
```

### Removing a Listener

```js
function handleClick() {
  console.log("Handled once, then removed");
  button.removeEventListener("click", handleClick); // must reference the SAME named function
}
button.addEventListener("click", handleClick);

// Anonymous/arrow functions CANNOT be removed later — you have no reference to pass to removeEventListener
button.addEventListener("click", () => console.log("Can't remove this one"));
```

### The once Option

```js
button.addEventListener("click", () => {
  console.log("This only ever runs on the FIRST click");
}, { once: true }); // automatically removes itself after firing one time
```

---

## 2. The Event Object

Every event handler automatically receives an **event object** describing what happened, as its first argument.

```js
button.addEventListener("click", function (event) {
  console.log(event.type);          // "click" — the event's type
  console.log(event.target);        // the actual element that triggered the event
  console.log(event.currentTarget); // the element the LISTENER is attached to (may differ from target — see bubbling)
  console.log(event.clientX, event.clientY); // mouse coordinates relative to the viewport (for mouse events)
  console.log(event.timeStamp);     // time since the page loaded, in milliseconds
});
```

### Keyboard Events

```js
document.addEventListener("keydown", function (event) {
  console.log(event.key);        // "Enter", "a", "Shift", "ArrowUp" — the actual key pressed
  console.log(event.code);       // "Enter", "KeyA", "ShiftLeft"      — the physical key location (layout-independent)
  console.log(event.shiftKey);   // true if Shift was held during this key press
  console.log(event.ctrlKey);    // true if Ctrl was held
});
```

### Input/Form Events

```js
const input = document.querySelector("input");

input.addEventListener("input", function (event) {
  console.log(event.target.value); // the current value, updated on EVERY keystroke
});

input.addEventListener("change", function (event) {
  console.log(event.target.value); // fires only when the input LOSES FOCUS after a change (not every keystroke)
});
```

```
"input"  → fires on every single character typed/changed — real-time feedback (e.g. live character count)
"change" → fires once, after the value has changed AND the element loses focus — good for final validation
```

---

## 3. Event Bubbling and Capturing

When an event fires on an element, it doesn't just run handlers on that element — it travels through the DOM tree in a specific, well-defined order.

### ASCII Diagram: The Three Phases of Event Propagation

```
  <div id="grandparent">
    <div id="parent">
      <button id="child">Click Me</button>
    </div>
  </div>

  User clicks the <button id="child">

  PHASE 1: CAPTURING (top-down, root to target)
    document → html → body → #grandparent → #parent → #child
    (listeners registered with { capture: true } fire during THIS phase, outer-most first)

  PHASE 2: TARGET
    The event fires directly on #child — the actual element clicked.

  PHASE 3: BUBBLING (bottom-up, target back to root)
    #child → #parent → #grandparent → body → html → document
    (listeners registered normally — the DEFAULT — fire during THIS phase, inner-most first)
```

### Demonstrating Bubbling (the Default)

```js
document.querySelector("#grandparent").addEventListener("click", () => console.log("Grandparent"));
document.querySelector("#parent").addEventListener("click", () => console.log("Parent"));
document.querySelector("#child").addEventListener("click", () => console.log("Child"));

// Clicking the button logs, IN THIS ORDER:
// "Child"       ← fires first, on the actual target
// "Parent"       ← then bubbles UP to the parent
// "Grandparent"  ← then bubbles UP to the grandparent
```

### Demonstrating Capturing (Opt-In)

```js
document.querySelector("#grandparent").addEventListener("click", () => console.log("Grandparent (capture)"), { capture: true });
document.querySelector("#parent").addEventListener("click", () => console.log("Parent (capture)"), { capture: true });
document.querySelector("#child").addEventListener("click", () => console.log("Child (capture)"), { capture: true });

// Clicking the button logs, IN THIS ORDER:
// "Grandparent (capture)"  ← fires first, DOWNWARD from the root
// "Parent (capture)"
// "Child (capture)"         ← reaches the actual target last
```

### target vs currentTarget

```js
document.querySelector("#grandparent").addEventListener("click", function (event) {
  console.log("target:", event.target.id);               // "child" — the element ACTUALLY clicked, never changes
  console.log("currentTarget:", event.currentTarget.id);  // "grandparent" — the element THIS listener is attached to
});
```

```
event.target         → the DEEPEST element where the event actually originated — FIXED for the whole propagation
event.currentTarget  → the element the CURRENTLY RUNNING listener is attached to — changes at each phase/listener
```

---

## 4. Event Delegation

**Event delegation** exploits bubbling: instead of attaching a listener to every individual child element (especially ones that might be added dynamically later), you attach ONE listener to a stable parent and inspect `event.target` to figure out which child was actually interacted with.

```html
<ul id="todo-list">
  <li>Buy milk</li>
  <li>Walk the dog</li>
  <li>Write code</li>
</ul>
<button id="add-item">Add Item</button>
```

```js
const list = document.querySelector("#todo-list");

// ONE listener on the stable parent, instead of one per <li>
list.addEventListener("click", function (event) {
  if (event.target.tagName === "LI") {
    event.target.classList.toggle("done");
    console.log(`Toggled: ${event.target.textContent}`);
  }
});

// New items added LATER are automatically handled too — no need to attach a new listener!
document.querySelector("#add-item").addEventListener("click", function () {
  const newItem = document.createElement("li");
  newItem.textContent = `New task ${list.children.length + 1}`;
  list.appendChild(newItem);
  // clicking THIS new item still works, because the listener lives on #todo-list, not on individual <li> elements
});
```

### Why Event Delegation Matters

```
Without delegation:
  - Attach a listener to EVERY <li> individually.
  - Any <li> added dynamically LATER has no listener at all,
    unless you remember to attach one manually every single time.
  - Many listeners = more memory overhead for large lists.

With delegation:
  - ONE listener on the parent, registered ONCE.
  - Works automatically for elements that don't exist yet at
    setup time — because the event simply bubbles up to the
    parent regardless of when the child was added.
  - Standard, recommended pattern for lists, tables, and any
    UI with dynamically added/removed elements.
```

---

## 5. preventDefault and stopPropagation

These two methods are frequently confused but solve entirely different problems.

### preventDefault — Stops the Browser's Default Behavior

```js
const form = document.querySelector("form");
form.addEventListener("submit", function (event) {
  event.preventDefault(); // stops the browser's default full-page reload/navigation on form submit
  console.log("Form submission intercepted — handle it with JavaScript instead");
});

const link = document.querySelector("a");
link.addEventListener("click", function (event) {
  event.preventDefault(); // stops the browser from navigating to the link's href
  console.log("Link click intercepted");
});
```

### stopPropagation — Stops the Event from Bubbling/Capturing Further

```js
document.querySelector("#parent").addEventListener("click", () => console.log("Parent handler ran"));

document.querySelector("#child").addEventListener("click", function (event) {
  event.stopPropagation(); // the event will NOT continue bubbling up to #parent
  console.log("Child handler ran");
});

// Clicking #child now logs ONLY "Child handler ran" — "Parent handler ran" never fires,
// because stopPropagation() halted the event's journey up the DOM tree.
```

### Field-by-Field Breakdown

```
event.preventDefault()
  ↳ Cancels the BROWSER'S BUILT-IN behavior for this event
    (form submission reload, link navigation, checkbox toggling, etc.)
  ↳ Does NOT stop the event from bubbling to parent elements —
    other listeners still run normally.

event.stopPropagation()
  ↳ Stops the event from continuing its journey through the
    DOM tree (bubbling up OR capturing down, depending on phase).
  ↳ Does NOT cancel the browser's default action — a form could
    still submit/reload even if you call this alone.

They solve DIFFERENT problems and are often used TOGETHER,
but neither one implies the other.
```

### stopImmediatePropagation — The Third, Less Common Option

```js
button.addEventListener("click", function (event) {
  console.log("First listener");
  event.stopImmediatePropagation(); // stops bubbling AND prevents any OTHER listeners on this SAME element from running
});
button.addEventListener("click", function () {
  console.log("Second listener — never runs due to stopImmediatePropagation above");
});
```

---

## 6. Hands-On Exercises

**Exercise 1:** Attach two separate `click` listeners to the same button using `addEventListener` and confirm both fire on a single click. Then replace both with a single `button.onclick = ...` assignment done twice, and confirm only the second one ever runs — write a comment explaining why.

**Exercise 2:** Build three nested `<div>` elements (grandparent, parent, child) each with a visible border via CSS. Attach `click` listeners to all three using default bubbling and log each one's name when clicked. Then change all three listeners to use `{ capture: true }` and observe the reversed firing order. Log both `event.target.id` and `event.currentTarget.id` inside the grandparent's handler to see they differ when you click the innermost child.

**Exercise 3:** Build a `<ul>` with 3 `<li>` items and an "Add Item" button. Implement event delegation with ONE listener on the `<ul>` that toggles a `"done"` CSS class (e.g., strikethrough styling) on whichever `<li>` was clicked, using `event.target`. Confirm that items added dynamically after page load via the button are still clickable and toggle correctly without adding any new listeners.

**Exercise 4:** Build a `<form>` with a text input and a submit button. Add a `submit` event listener that calls `event.preventDefault()` and instead logs the input's value to the console. Remove the `preventDefault()` call temporarily and observe the page reloading/navigating on submit — then restore it and confirm the behavior is intercepted.

**Exercise 5:** Build two nested clickable `<div>` elements. Add a `stopPropagation()` call inside the inner div's handler and confirm the outer div's handler never runs when you click the inner one (but does run when you click the outer div directly, outside the inner one). Then remove `stopPropagation()` and add `preventDefault()` instead on an `<a>` tag inside the inner div, and write a comment explaining why the outer handler STILL runs even though `preventDefault()` was called (because `preventDefault` and `stopPropagation` are unrelated).

---

## 7. Interview Q&A

**Q: What is event bubbling, and how is it different from event capturing?**
Answer: When an event occurs on an element, the browser doesn't just notify listeners on that exact element — it propagates the event through the DOM tree in three phases: first capturing, where the event travels top-down from the document root toward the target element (triggering any listeners registered with `{ capture: true }` along the way, outermost first); then the target phase, where the event fires on the actual element that triggered it; then bubbling, the default phase, where the event travels back up bottom-to-top from the target toward the document root, triggering normally-registered listeners on every ancestor, innermost first. Most developers only ever interact with the bubbling phase, since `addEventListener`'s third argument defaults to `false` (bubbling), but understanding capturing matters for edge cases like intercepting an event before it reaches a deeply nested target, or building certain kinds of modal/overlay click-outside detection.

**Q: What is event delegation, and why is it considered a best practice for lists or dynamically generated content?**
Answer: Event delegation means attaching a single event listener to a stable parent element rather than attaching individual listeners to every child element, and then using `event.target` inside that one listener to determine which specific child actually triggered the event — this works because events bubble up from the child to the parent by default. It's considered best practice for two reasons: first, it dramatically reduces the number of listeners needed (one instead of potentially hundreds), improving memory efficiency for large lists; second, and more importantly, it automatically handles elements that don't exist yet at the time the listener was set up — if you dynamically add a new list item later, clicking it still bubbles up to the parent's existing listener with no extra code required, whereas attaching listeners individually would require remembering to add a fresh listener every single time a new element is created.

**Q: What is the difference between `event.preventDefault()` and `event.stopPropagation()`?**
Answer: `preventDefault()` cancels the browser's own built-in default behavior associated with that particular event type — for example, stopping a form from actually submitting and reloading the page, or stopping a clicked link from navigating to its `href`. `stopPropagation()` does something entirely unrelated: it halts the event from continuing its journey through the DOM tree, preventing it from reaching any further listeners on ancestor (or, during capturing, descendant) elements, but it has no effect whatsoever on the browser's default action — a form could still reload the page even if only `stopPropagation()` was called. These two methods are commonly used together but address completely separate problems: one controls whether the browser performs its native behavior, the other controls whether the event continues propagating to other listeners.

**Q: What is the difference between `event.target` and `event.currentTarget`?**
Answer: `event.target` always refers to the specific, deepest element in the DOM where the event actually originated — for instance, if you click a button nested inside several `<div>` wrappers, `event.target` is the button itself, and this value stays fixed throughout the entire propagation, no matter which element's listener is currently executing. `event.currentTarget` refers to whichever element the currently-executing listener happens to be attached to, and changes value at every stage of propagation — if a listener is attached to an outer `<div>` that a click bubbles up to, `currentTarget` inside that listener is the `<div>`, even though `target` still correctly identifies the originally-clicked button deep inside it. This distinction is exactly what makes event delegation possible: you attach the listener (and thus fix `currentTarget`) on a stable parent, while reading `target` to discover which specific descendant was actually interacted with.

**Q: Why can't you remove an event listener that was added as an anonymous or inline arrow function?**
Answer: `removeEventListener` requires a reference to the *exact same function* that was originally passed to `addEventListener`, because internally the browser compares function references (identity), not the function's source code or behavior, to determine which listener to detach. When you write `element.addEventListener("click", () => console.log("hi"))`, that arrow function is a brand-new, anonymous function object created inline — you have no variable holding a reference to it, so there is no way to later call `removeEventListener` with an equivalent reference, since even an arrow function with identical code written a second time is a completely different function object in memory. The practical fix is to assign the handler to a named variable or function declaration first (`function handleClick() {...}`), pass that named reference to `addEventListener`, and later pass that same reference to `removeEventListener` when you want to detach it.
