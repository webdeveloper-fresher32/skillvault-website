# Selecting and Modifying Elements — Complete Guide

## Table of Contents
1. [What Is the DOM](#1-what-is-the-dom)
2. [Selecting Elements](#2-selecting-elements)
3. [textContent vs innerHTML vs innerText](#3-textcontent-vs-innerhtml-vs-innertext)
4. [classList](#4-classlist)
5. [The style Property](#5-the-style-property)
6. [Working with Attributes](#6-working-with-attributes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What Is the DOM

The **DOM** (Document Object Model) is the browser's live, in-memory tree representation of an HTML page. Every tag becomes a **node** in this tree, and JavaScript can read or change any part of it, with the browser instantly re-rendering the visible page to match.

### ASCII Diagram: HTML to DOM Tree

```
HTML:
  <body>
    <div id="app">
      <h1>Title</h1>
      <p class="intro">Hello</p>
    </div>
  </body>

DOM Tree:
                    document
                       │
                     <body>
                       │
                  <div id="app">
                    /          \
              <h1>          <p class="intro">
                │                    │
            "Title"              "Hello"
           (text node)         (text node)
```

The global `document` object is the entry point into this tree from JavaScript — every selection method in this lesson starts from `document` (or from another element, to search only within it).

---

## 2. Selecting Elements

### querySelector / querySelectorAll — Modern, CSS-Selector Based

```js
// Selects the FIRST matching element, or null if none found
const firstButton = document.querySelector("button");
const byId = document.querySelector("#app");
const byClass = document.querySelector(".intro");
const nested = document.querySelector("#app .intro");
const attribute = document.querySelector('input[type="email"]');

// Selects ALL matching elements as a static NodeList
const allButtons = document.querySelectorAll("button");
const allIntros = document.querySelectorAll(".intro");

console.log(allButtons.length);  // number of matches
allButtons.forEach(btn => console.log(btn.textContent)); // NodeList has forEach built in
```

### Field-by-Field Breakdown

```
document.querySelector("#app .intro")
                        │
                        └── ANY valid CSS selector string — id (#), class (.),
                            tag name, attribute selectors, combinators (space,
                            >, +, ~) — anything you'd write in a stylesheet.

Returns:
  querySelector      → the FIRST matching Element, or null
  querySelectorAll   → a static NodeList of ALL matches (empty NodeList if none — never null)
```

### Older, More Specific Selection Methods

```js
const byIdOld = document.getElementById("app");              // no "#" prefix here, just the raw id
const byClassOld = document.getElementsByClassName("intro");  // returns a LIVE HTMLCollection
const byTagOld = document.getElementsByTagName("p");           // returns a LIVE HTMLCollection

console.log(byIdOld);      // <div id="app">...
console.log(byClassOld[0]); // first element with class "intro"
```

```
getElementById            → single element, fastest lookup, no "#" in the argument
getElementsByClassName    → LIVE HTMLCollection — auto-updates if the DOM changes later
getElementsByTagName      → LIVE HTMLCollection — same live-updating behavior
querySelectorAll          → STATIC NodeList — a snapshot, does NOT auto-update
```

### Live vs Static Collections — A Critical Difference

```js
const liveList = document.getElementsByClassName("item"); // LIVE
const staticList = document.querySelectorAll(".item");     // STATIC

console.log(liveList.length, staticList.length); // e.g. 3, 3

const newItem = document.createElement("div");
newItem.className = "item";
document.body.appendChild(newItem);

console.log(liveList.length);   // 4 — automatically reflects the newly added element
console.log(staticList.length); // 3 — unchanged, it was a snapshot taken at query time
```

This is one of the most commonly misunderstood aspects of DOM selection — using a live `HTMLCollection` inside a loop that also modifies the DOM can cause confusing bugs (the loop's length changes mid-iteration), which is one reason `querySelectorAll` is generally preferred in modern code.

### Selecting Within an Element (Scoped Search)

```js
const app = document.querySelector("#app");
const introInsideApp = app.querySelector(".intro"); // only searches DESCENDANTS of #app, not the whole page
```

---

## 3. textContent vs innerHTML vs innerText

```html
<div id="demo"><strong>Hello</strong> <span style="display:none">Hidden</span> World</div>
```

```js
const demo = document.querySelector("#demo");

console.log(demo.textContent); // "Hello Hidden World" — ALL text, including hidden elements, no HTML parsing
console.log(demo.innerText);   // "Hello World"          — only VISIBLE text, respects CSS (display:none excluded)
console.log(demo.innerHTML);   // "<strong>Hello</strong> <span style=\"display:none\">Hidden</span> World" — raw markup

demo.textContent = "<b>New</b>"; // sets literal text — renders as the STRING "<b>New</b>", not bold
demo.innerHTML = "<b>New</b>";    // PARSES the string as HTML — renders as actual bold text "New"
```

### Security Warning: innerHTML and XSS

```js
// DANGEROUS if "userInput" comes from an untrusted source (e.g. a URL parameter, a comment field)
const userInput = "<img src=x onerror=\"alert('hacked')\">";
demo.innerHTML = userInput; // ✗ executes the attacker's script — a Cross-Site Scripting (XSS) vulnerability

// SAFE — textContent never parses HTML, so malicious markup is rendered as inert text
demo.textContent = userInput; // ✓ safely displays the literal string, no code execution
```

```
Rule of thumb:
  Use textContent when you're inserting plain text — it's faster and immune to XSS.
  Use innerHTML only for trusted, sanitized, or hardcoded markup you control.
  Use innerText sparingly — it's slower (triggers a layout/reflow to determine
    visibility) and its behavior varies slightly across browsers.
```

---

## 4. classList

`classList` is the modern API for reading and modifying an element's CSS classes, replacing manual string manipulation of the `className` property.

```js
const box = document.querySelector(".box");

box.classList.add("active");            // add a class
box.classList.add("highlighted", "big"); // add multiple classes in one call
box.classList.remove("big");             // remove a class
box.classList.toggle("active");          // removes it if present, adds it if absent
box.classList.toggle("visible", true);   // force-add ("true" forces add, "false" forces remove)

console.log(box.classList.contains("active")); // true or false
console.log(box.classList);                     // DOMTokenList(2) ["highlighted", "visible"]
console.log(box.className);                      // "highlighted visible" — the raw string, old-style access
```

### Field-by-Field Breakdown

```
box.classList.toggle("active")
              │       └── if "active" is currently present → REMOVE it, return false
              │           if "active" is currently absent  → ADD it, return true
              └── the DOMTokenList API — designed specifically to avoid the bugs
                  of manually splitting/joining className strings
```

### Why classList Beats Manual className String Manipulation

```js
// Old, error-prone way — manual string manipulation
box.className = box.className + " active"; // risk of double spaces, duplicate classes, hard to remove safely

// Modern way — classList handles all of this correctly and safely
box.classList.add("active"); // no duplicates, no whitespace bugs, clear intent
```

---

## 5. The style Property

The `style` property gives direct read/write access to an element's **inline** styles (the `style="..."` HTML attribute) — it cannot read styles applied via an external or `<style>` stylesheet.

```js
const box = document.querySelector(".box");

box.style.backgroundColor = "blue";  // camelCase in JS ↔ background-color in CSS
box.style.fontSize = "20px";          // units are required as part of the string
box.style.border = "1px solid black";

console.log(box.style.backgroundColor); // "blue"
console.log(box.style.color);            // "" — empty string if never set inline, EVEN IF a stylesheet sets it
```

### Reading Computed Styles (Including Stylesheet Rules)

```js
const computed = getComputedStyle(box);
console.log(computed.color);          // the ACTUAL rendered color, from any source (inline, stylesheet, browser default)
console.log(computed.backgroundColor); // reflects stylesheet rules too, not just inline style
```

```
box.style.X          → only reads/writes INLINE styles set directly on the element
getComputedStyle(box) → reads the FINAL rendered style, from every source combined
                        (read-only — you cannot assign to it to change styles)
```

### Preferred Pattern: Toggle Classes, Not Inline Styles

```js
// Less maintainable — styling logic scattered across JS files
box.style.display = "none";

// More maintainable — CSS owns the actual style rules, JS just toggles a class
box.classList.add("hidden"); // where .hidden { display: none; } lives in a stylesheet
```

Most teams prefer toggling CSS classes over setting individual inline style properties from JavaScript, because it keeps all visual styling centralized in stylesheets rather than scattered across script files.

---

## 6. Working with Attributes

```js
const link = document.querySelector("a");

console.log(link.getAttribute("href"));  // reads the raw attribute value, exactly as written in HTML
link.setAttribute("href", "https://example.com"); // sets/overwrites an attribute
link.removeAttribute("target");                    // removes an attribute entirely
console.log(link.hasAttribute("href"));             // true or false

// Many common attributes also have direct property shortcuts
console.log(link.href);   // similar to getAttribute("href") but RESOLVED to a full absolute URL
link.href = "https://example.com"; // equivalent to setAttribute for most standard attributes
```

### Data Attributes — the dataset API

```html
<div id="product" data-id="42" data-in-stock="true"></div>
```

```js
const product = document.querySelector("#product");

console.log(product.dataset.id);        // "42"        — note: always a STRING, even though it looks numeric
console.log(product.dataset.inStock);    // "true"      — "data-in-stock" becomes camelCase "inStock"

product.dataset.category = "electronics"; // sets a NEW attribute: data-category="electronics"
console.log(product.getAttribute("data-category")); // "electronics"
```

```
HTML attribute        JS dataset property
data-id                dataset.id
data-in-stock          dataset.inStock      ← kebab-case becomes camelCase automatically
data-user-name         dataset.userName
```

`data-*` attributes are the standard, HTML-valid way to attach custom application data directly to an element without inventing non-standard attributes.

---

## 7. Hands-On Exercises

**Exercise 1:** Build a small HTML page with a `<div id="app">` containing three `<p class="item">` elements with different text. Using only JavaScript, select all three with `querySelectorAll`, log each one's `textContent` in a loop, then select just the second one specifically using a CSS `:nth-child` selector inside `querySelector`.

**Exercise 2:** Demonstrate the live-vs-static collection difference: capture both `getElementsByClassName("item")` and `querySelectorAll(".item")` into variables, then dynamically add a fourth `.item` element with `document.createElement` and `appendChild`, and log both collections' `.length` before and after — confirm one updates automatically and the other doesn't.

**Exercise 3:** Create a `<div id="demo">` containing a mix of visible and `display:none` child elements with text. Log `textContent`, `innerText`, and `innerHTML` for the same element and write a comment explaining the exact differences you observe in the output.

**Exercise 4:** Create a button that toggles an `"active"` class on a target `<div>` using `classList.toggle`, and a second button that force-adds a `"highlight"` class using `classList.toggle("highlight", true)` regardless of current state. Add a `classList.contains` check that logs whether the div is currently active every time either button is clicked.

**Exercise 5:** Create an element with a `data-user-id` and `data-role` attribute hardcoded in the HTML. Read both values via `dataset`, log them, then use JavaScript to add a new `data-last-login` attribute via `dataset` and confirm with `getAttribute("data-last-login")` that it was correctly set. Explain in a comment why `dataset` values are always strings, even for attributes that look numeric or boolean.

---

## 8. Interview Q&A

**Q: What is the difference between `querySelectorAll` and `getElementsByClassName`, beyond just the selector syntax?**
Answer: The syntax difference is that `querySelectorAll` accepts any valid CSS selector string (classes, ids, attribute selectors, combinators), while `getElementsByClassName` only accepts a class name. The more important practical difference is that `getElementsByClassName` (like `getElementsByTagName`) returns a **live** `HTMLCollection` that automatically updates in real time as the DOM changes — if you add a matching element later, the previously captured collection's length and contents reflect that change immediately. `querySelectorAll` returns a **static** `NodeList` that is a snapshot at the moment the query ran — later DOM changes have no effect on it. This distinction matters especially in loops that also modify the DOM, where a live collection's changing length mid-iteration can cause subtle, hard-to-debug logic errors.

**Q: What is the security risk of `innerHTML`, and when is it safe to use?**
Answer: Setting `innerHTML` causes the browser to parse the assigned string as actual HTML markup and insert the resulting nodes into the DOM — if that string comes from an untrusted source, such as user-submitted text or a URL parameter, an attacker can inject a `<script>` tag or an event-handler attribute like `onerror` that executes arbitrary JavaScript in the context of your page, a vulnerability known as Cross-Site Scripting (XSS). It is safe to use `innerHTML` only with content you fully control and trust — hardcoded markup in your own source files, or content that has been properly sanitized through a dedicated sanitization library before insertion. For any content that originates from user input or an external, untrusted source, `textContent` should be used instead, since it always inserts the string as literal, inert text and never parses or executes it as markup.

**Q: What is the difference between the `style` property and `getComputedStyle()`?**
Answer: `element.style` only reflects and controls the element's **inline** styles — those explicitly set via the `style="..."` HTML attribute or assigned directly through JavaScript (`el.style.color = "red"`) — it has no visibility into styles that come from an external stylesheet or a `<style>` block, so `el.style.color` returns an empty string if color was set only via a CSS class, even though the element visibly renders in that color. `getComputedStyle(element)` returns the fully resolved, final rendered style for every CSS property, combining inline styles, stylesheet rules, inherited values, and browser defaults into one read-only result — it accurately reflects what's actually displayed on screen regardless of where the style came from, but you cannot assign to it to change anything; it's purely for reading the current computed state.

**Q: How does `classList` improve on manually manipulating the `className` string property?**
Answer: `className` exposes an element's classes as a single raw space-separated string, so adding or removing a class manually requires splitting the string, checking for duplicates, filtering out the class you want to remove, and rejoining it — error-prone work that's easy to get wrong, leading to bugs like double spaces, accidentally duplicated class names, or partial-match removal bugs (like accidentally matching "active" inside a class named "inactive"). `classList` is a purpose-built API (a `DOMTokenList`) that provides `add()`, `remove()`, `toggle()`, and `contains()` methods that correctly handle whitespace, avoid duplicates automatically, and operate on exact whole-class-name matches, making class manipulation both safer and far more readable and expressive than direct string manipulation.

**Q: What are `data-*` attributes and the `dataset` API used for, and why are all `dataset` values strings?**
Answer: `data-*` attributes are the standards-compliant way to attach custom, application-specific data directly onto an HTML element without inventing non-standard attributes that could conflict with future HTML specifications or confuse validators — common uses include storing a database ID, a category, or a feature flag directly on the element that represents it. The `dataset` property provides convenient JavaScript access to these attributes, automatically converting the attribute's kebab-case name (`data-user-id`) into a camelCase property (`dataset.userId`). Every value read through `dataset` is always a plain string, no matter how it looks in the HTML, because HTML attributes are fundamentally text — there's no attribute-level type system distinguishing a numeric-looking `"42"` from a boolean-looking `"true"` — so code that needs an actual number or boolean must explicitly convert it, for example with `Number(dataset.userId)` or `dataset.inStock === "true"`.
