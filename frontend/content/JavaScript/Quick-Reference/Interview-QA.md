---
# JavaScript Interview Questions & Answers

---

## Core Language Fundamentals (Q1–Q10)

**Q1: What is a closure and why is it useful?**

**A:** A closure is the combination of a function bundled together with references to its surrounding lexical scope, such that the function retains access to variables from an outer scope even after that outer function has finished executing. JavaScript creates a closure every time a function is defined, because functions in JS keep a reference to the scope chain in which they were created rather than the scope in which they are called. Closures are useful for data privacy (simulating private variables before classes had private fields), for creating factory functions that produce configured functions, and for maintaining state across multiple invocations without polluting the global scope, as in the classic counter example.

```js
function makeCounter() {
  let count = 0;
  return () => ++count;
}
const counter = makeCounter();
counter(); // 1 — count persists between calls, inaccessible from outside
```

---

**Q2: What is hoisting, and how does it differ for `var`, `let`/`const`, and function declarations?**

**A:** Hoisting is JavaScript's behavior of processing variable and function declarations during the compile/creation phase, before code executes line by line. `var` declarations are hoisted and initialized with `undefined`, so referencing a `var` before its declaration line returns `undefined` rather than throwing. `let` and `const` are also hoisted, but they land in a "temporal dead zone" (TDZ) — the binding exists but cannot be accessed until the actual declaration line executes, so referencing them earlier throws a `ReferenceError`. Function declarations are hoisted entirely, including their body, so they can be called before their definition appears in the source. Function expressions and arrow functions assigned to `let`/`const`/`var` follow the hoisting rules of the variable they're assigned to, not the function-declaration rule.

---

**Q3: What is the difference between `==` and `===`?**

**A:** `===` (strict equality) compares both value and type without any type coercion — `5 === "5"` is `false` because one operand is a number and the other a string. `==` (loose equality) first coerces the operands to a common type before comparing, following a set of rules defined in the spec (the Abstract Equality Comparison Algorithm), which can produce surprising results like `[] == false` being `true` or `null == undefined` being `true` while `null === undefined` is `false`. Because the coercion rules are complex and easy to misuse, the near-universal best practice is to always use `===` and `!==`, and rely on explicit conversion (`Number()`, `String()`, `Boolean()`) when a conversion is actually intended.

---

**Q4: Explain the concept of the "temporal dead zone" (TDZ).**

**A:** The temporal dead zone is the period between entering a scope (where a `let` or `const` variable is hoisted) and the line where that variable is actually declared, during which the variable exists but cannot be read or written. Accessing a variable while it's in the TDZ throws a `ReferenceError: Cannot access 'x' before initialization`, which is different from accessing an undeclared variable (which throws `x is not defined`) and different from a hoisted `var`, which would simply be `undefined`. The TDZ exists to catch bugs earlier — it prevents code from silently working with a variable before its intended initialization value is set, which was a common source of confusing bugs with `var`.

---

**Q5: What is the difference between `null` and `undefined`?**

**A:** `undefined` is the default value JavaScript assigns to a variable that has been declared but not yet given a value, to a function parameter that wasn't passed an argument, and to the return value of a function with no explicit `return`. `null` is an assignment value that a developer explicitly sets to represent "no value" or "empty" intentionally — the language itself never automatically assigns `null`. They are loosely equal (`null == undefined` is `true`) but strictly different types and not strictly equal (`null === undefined` is `false`), and `typeof null` famously returns `"object"` due to a decades-old bug in the original JS implementation that was never fixed for backward compatibility.

---

**Q6: What are the primitive types in JavaScript, and how do primitives differ from objects?**

**A:** JavaScript has seven primitive types: `string`, `number`, `boolean`, `undefined`, `null`, `symbol`, and `bigint`. Primitives are immutable — you can't change a string in place, only create a new one — and they are compared and copied by value, so `let a = 5; let b = a;` gives two completely independent copies. Objects (including arrays and functions) are compared and copied by reference: assigning an object to a new variable copies the reference to the same underlying data, so mutating it through one variable is visible through the other. This distinction is the root cause of many bugs around accidental shared mutable state, and it's why techniques like the spread operator or `structuredClone` are used to create independent copies of objects.

---

**Q7: What is the difference between `map`, `filter`, and `reduce`, and when would you use each?**

**A:** All three are array iteration methods that don't mutate the original array, but they solve different problems. `.map()` transforms every element and returns a new array of the exact same length — use it when you need a one-to-one transformation, like converting an array of user objects into an array of names. `.filter()` tests every element with a predicate and returns a new array containing only the elements that passed — use it when you need a subset of the original data, like getting only active users. `.reduce()` is the most general: it walks the array accumulating a single value (which could be a number, a new array, or an object) by applying a reducer function to an accumulator and each element — use it when the output doesn't map cleanly to "same-length array" or "subset," such as summing values, grouping items by a key, or flattening nested structures. In practice, `reduce` can implement `map` and `filter` internally, but using the more specific method when it fits communicates intent better and is usually easier to read.

---

**Q8: What is destructuring and why is it useful?**

**A:** Destructuring is syntax that lets you unpack values from arrays or properties from objects into distinct variables in a single expression, rather than accessing them one at a time. Array destructuring unpacks by position (`const [first, second] = arr`) while object destructuring unpacks by property name (`const { name, age } = user`), and both support default values, renaming, and nesting. It's useful because it reduces boilerplate when extracting multiple values (especially common with function parameters and API responses), makes intent clearer at the call site, and pairs naturally with the rest pattern to capture "everything else" (`const { id, ...rest } = obj`). It's heavily used in modern React and Node.js code for pulling props, state, and config out of objects concisely.

---

**Q9: What is the spread operator and how does it differ from rest parameters?**

**A:** Both use the same `...` syntax but serve opposite purposes depending on context. Spread expands an iterable (array, string, or, for objects, own enumerable properties) into individual elements — used in array/object literals (`[...arr1, ...arr2]`) or function calls (`Math.max(...numbers)`) to "unpack" a collection. Rest does the opposite: it collects multiple individual elements into a single array or object — used in function parameter lists (`function sum(...nums)`) or destructuring (`const [first, ...rest] = arr`) to "gather up" the remaining items. The distinguishing rule is position and context: in a destructuring or parameter list, `...` gathers (rest); in a literal or call, `...` expands (spread).

---

**Q10: What is strict mode and why would you enable it?**

**A:** Strict mode, enabled with `"use strict"` at the top of a file or function (and automatically on inside ES modules and classes), changes JavaScript's semantics to eliminate some silently problematic behaviors and turn them into thrown errors instead. Under strict mode, assigning to an undeclared variable throws instead of creating a global, assigning to a read-only or non-existent property throws instead of failing silently, `this` inside a plain function call is `undefined` instead of defaulting to the global object, and duplicate parameter names and octal literals are disallowed. It's useful because it surfaces bugs earlier during development, prevents accidental global variable creation, and is a prerequisite for certain optimizations and newer language features — which is why all ES module code and class bodies run in strict mode implicitly, even without the explicit directive.

---

## Async & Event Loop (Q11–Q18)

**Q11: Explain how the JavaScript event loop works.**

**A:** JavaScript is single-threaded, meaning it has one call stack that executes one operation at a time, but it achieves non-blocking asynchronous behavior through the event loop, which coordinates the call stack with two queues: the microtask queue and the macrotask (callback) queue. Synchronous code runs on the call stack first, running to completion before anything else. When an asynchronous operation (like a `setTimeout` or a network request) completes, its callback is placed in a queue rather than run immediately. The event loop's job is to check, on every "tick," whether the call stack is empty, and if so, to pull the next task from a queue and push it onto the stack to execute. Crucially, the entire microtask queue is drained before a single macrotask is processed, which is why promise callbacks consistently run before `setTimeout` callbacks even when the timeout is `0`.

---

**Q12: What is the difference between the microtask queue and the macrotask (task) queue?**

**A:** The macrotask queue holds callbacks from sources like `setTimeout`, `setInterval`, I/O events, and UI rendering — the event loop processes exactly one macrotask per loop iteration. The microtask queue holds callbacks from Promise `.then`/`.catch`/`.finally`, `async`/`await` continuations, and `queueMicrotask` — critically, the event loop fully drains the microtask queue after every single task (whether that task was a macrotask or the initial synchronous script) before moving on, and even before rendering the next frame. This means microtasks always run before the next macrotask, and if microtasks keep scheduling more microtasks, they can in theory starve macrotasks and rendering entirely — a real performance pitfall to be aware of in recursive promise chains.

---

**Q13: What is a Promise and what are its possible states?**

**A:** A Promise is an object representing the eventual result of an asynchronous operation — it acts as a placeholder for a value that isn't available yet. A promise exists in exactly one of three states at any time: **pending** (the initial state, neither fulfilled nor rejected), **fulfilled** (the operation completed successfully, and the promise now has a resolved value accessible via `.then`), or **rejected** (the operation failed, and the promise has a reason accessible via `.catch`). Once a promise transitions to fulfilled or rejected, it is "settled" and its state and value are immutable forever — calling `.then` on an already-settled promise fires the callback on the next microtask tick with the already-determined result, which is why promises are safe to attach handlers to even after they've already resolved.

---

**Q14: How does `async`/`await` relate to Promises?**

**A:** `async`/`await` is syntactic sugar built entirely on top of Promises — it doesn't introduce a new concurrency mechanism, it just makes asynchronous code read like synchronous code. Declaring a function `async` guarantees it always returns a Promise (wrapping non-promise return values automatically, and turning thrown errors into rejected promises). The `await` keyword can only be used inside an `async` function and pauses execution of that function (without blocking the rest of the program) until the awaited promise settles, then either returns the resolved value or throws the rejection reason, which can be caught with a normal `try`/`catch` block. Under the hood, the JS engine transforms `await` into a `.then()` continuation, meaning code after an `await` effectively runs as a microtask once the promise resolves.

```js
async function fetchUser(id) {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch user:", err);
    throw err;
  }
}
```

---

**Q15: What is the difference between `Promise.all`, `Promise.allSettled`, `Promise.race`, and `Promise.any`?**

**A:** `Promise.all` takes an array of promises and resolves with an array of their results once every promise fulfills, but it rejects immediately as soon as any single promise rejects (fail-fast) — appropriate when all results are required and any failure should abort the whole operation. `Promise.allSettled` waits for every promise to settle regardless of outcome and returns an array of `{status, value}` or `{status, reason}` objects for each — appropriate when you want to know the outcome of every operation even if some fail, like batch-uploading files where you want a per-file success/failure report. `Promise.race` settles as soon as the first promise settles, whether fulfilled or rejected — commonly used to implement timeouts by racing a real operation against a `setTimeout`-based rejection. `Promise.any` resolves as soon as the first promise fulfills, ignoring rejections, and only rejects if all promises reject — useful when you want the fastest successful result from redundant sources and don't care which one wins.

---

**Q16: What is callback hell and how do Promises/async-await solve it?**

**A:** Callback hell refers to deeply nested callback functions that result from chaining sequential asynchronous operations using the callback pattern, where each step's callback contains the next step's call, producing a pyramid-shaped, hard-to-read, and hard-to-error-handle code structure. Promises solve this by allowing asynchronous steps to be chained flatly with `.then()`, each returning a new promise, and by centralizing error handling in a single `.catch()` at the end of the chain instead of requiring error checks at every nesting level. `async`/`await` goes further by letting sequential asynchronous steps be written as flat, linear statements that look like synchronous code, with errors handled by ordinary `try`/`catch` blocks — this is generally considered the most readable and maintainable pattern for sequential async logic in modern JavaScript.

---

**Q17: What is `setTimeout(fn, 0)` actually doing, and why doesn't it run immediately?**

**A:** `setTimeout(fn, 0)` schedules `fn` to run as a macrotask with a minimum delay of roughly 0 milliseconds, but it does not run synchronously or immediately — it is queued and will only execute after the current synchronous code finishes AND the entire microtask queue has been drained. This makes `setTimeout(fn, 0)` a common technique for deferring execution to "the next tick" of the event loop, letting the browser handle pending rendering or higher-priority microtasks first. It's important to note browsers also enforce a minimum clamp (historically 4ms after several nested timeouts) so "0ms" is really "as soon as possible after the current execution context and microtasks," not a hard real-time guarantee.

---

**Q18: How would you handle errors in async code, and what's a common mistake developers make?**

**A:** In promise chains, errors should be handled with `.catch()` placed at the end of the chain so it catches rejections from any step; in `async`/`await` code, errors should be wrapped in `try`/`catch` around the `await` calls that might reject. A common mistake is forgetting to await a promise-returning function inside a `try` block — if you `return somePromiseFn()` without `await` inside a `try`, and the promise rejects after the function has already returned, the `catch` block never fires because the `try` block already exited; the fix is to `return await somePromiseFn()` so the rejection is thrown from within the `try`. Another common mistake is silently swallowing errors by adding an empty `.catch(() => {})`, which hides real failures — errors should always be logged, re-thrown, or surfaced to the user in some meaningful way, and unhandled promise rejections should be monitored in production via `process.on('unhandledRejection')` in Node or the `unhandledrejection` window event in browsers.

---

## OOP & Prototypes (Q19–Q24)

**Q19: How does prototypal inheritance work in JavaScript?**

**A:** Every JavaScript object has an internal link to another object called its prototype, accessible via `Object.getPrototypeOf()` or the `__proto__` accessor, forming a chain that ends at `null`. When you access a property on an object and it isn't found directly on that object, the engine automatically walks up the prototype chain, checking each linked object in turn, until it finds the property or reaches the end of the chain (returning `undefined`). This is fundamentally different from classical inheritance in languages like Java — instead of classes being blueprints that stamp out instances, JavaScript objects delegate to other live objects, and modifying a prototype's method after objects are created still affects all objects linked to it, because the lookup happens at access time, not at creation time.

---

**Q20: What does the `class` syntax actually do under the hood?**

**A:** ES6 `class` syntax is primarily syntactic sugar over JavaScript's existing prototype-based inheritance model — it does not introduce a fundamentally new object model. When you write `class Animal { speak() {} }`, the engine creates a constructor function named `Animal` and attaches `speak` to `Animal.prototype`, exactly as if you had written `function Animal() {}; Animal.prototype.speak = function() {};` manually. The `extends` keyword sets up the prototype chain between the subclass's prototype and the parent's prototype (equivalent to `Object.setPrototypeOf(Child.prototype, Parent.prototype)`), and `super()` calls the parent constructor. The main behavioral differences classes add are: class bodies always run in strict mode, class declarations are not hoisted the way function declarations are (they're in the TDZ), and methods defined in a class body are non-enumerable by default, unlike prototype methods assigned the old way.

---

**Q21: What is the difference between `call`, `apply`, and `bind`?**

**A:** All three let you explicitly control what `this` refers to inside a function, but they differ in how they invoke it and what they return. `.call(thisArg, arg1, arg2, ...)` invokes the function immediately with `this` set to `thisArg` and arguments passed individually. `.apply(thisArg, [argsArray])` does the same but takes arguments as a single array, which is useful when you already have an array of arguments (though the spread operator has made this less necessary today). `.bind(thisArg, arg1, ...)` does not invoke the function immediately — instead it returns a new function with `this` permanently bound to `thisArg` (and optionally some arguments pre-filled, called partial application), which is commonly used to lock in context for callbacks or event handlers, such as binding a class method in a constructor so it retains the right `this` when passed as a React event handler.

---

**Q22: Explain the four ways `this` can be determined in JavaScript.**

**A:** `this` is determined by how a function is called, not where it is defined (except for arrow functions). First, if the function is called with `new` (as a constructor), `this` is the newly created object. Second, if the function is called via `.call()`, `.apply()`, or `.bind()`, `this` is explicitly set to whatever object is passed. Third, if the function is called as a method on an object (`obj.method()`), `this` is that object — the one immediately to the left of the dot at call time, regardless of where the method was defined. Fourth, if the function is called plainly (`someFunction()`), `this` is `undefined` in strict mode or the global object in non-strict mode. Arrow functions are the exception to all of this: they have no `this` binding of their own and instead lexically inherit `this` from the enclosing scope at the time they were defined, which is why arrow functions are commonly used for callbacks inside methods where you want `this` to still refer to the outer object.

---

**Q23: What is the difference between classical inheritance and JavaScript's prototypal inheritance?**

**A:** Classical inheritance (Java, C++) is based on classes as abstract blueprints that are compiled and then instantiated into objects — the class hierarchy is fixed at compile time and objects cannot change their fundamental type after creation. JavaScript's prototypal inheritance is based on live objects delegating to other live objects — there's no real distinction between a "class" and an "instance" under the hood, since `class` is sugar over prototype chains, and an object's prototype can even be reassigned at runtime with `Object.setPrototypeOf`. This makes JavaScript's model more flexible (you can mix in behavior dynamically, use `Object.create` to build custom inheritance chains without any constructor functions at all) but also more prone to subtle bugs if developers assume Java-like class semantics, such as expecting private state or truly sealed hierarchies, which only became closer to reality with ES2022 private class fields (`#field`).

---

**Q24: What are the benefits of using classes and encapsulation (private fields) in modern JavaScript?**

**A:** ES2022 introduced true private instance fields and methods using a `#` prefix (`#balance`, `#validate()`), which are enforced by the engine itself — unlike the old convention of prefixing "private" properties with an underscore, which was purely a naming convention with no actual access restriction, real private fields throw a `SyntaxError` if accessed from outside the class body, even via bracket notation or reflection. This gives genuine encapsulation: internal state and helper methods can be hidden from consumers of a class, reducing the risk of external code depending on or mutating implementation details, which makes refactoring safer and the public API surface clearer. Classes combined with private fields, getters/setters for controlled access, and static methods/properties for class-level utilities give JavaScript OOP patterns that are much closer to what developers coming from Java or C# expect, while still being built entirely on the underlying prototype model.

---

## DOM & Events (Q25–Q30)

**Q25: What is event bubbling and event capturing?**

**A:** When an event fires on an element, it doesn't just trigger listeners on that element — it propagates through the DOM tree in two phases. In the **capturing** phase, the event travels from the `window` down through ancestors to the target element; in the **bubbling** phase (the default and far more commonly used), the event travels from the target back up through each ancestor to the `window`. By default, `addEventListener(type, handler)` registers the handler for the bubbling phase; passing `true` or `{ capture: true }` as the third argument registers it for the capturing phase instead. Understanding this propagation is essential for reasoning about which handlers fire and in what order when a click happens on a deeply nested element, and it's the mechanism that makes event delegation possible.

---

**Q26: What is event delegation and why is it a useful pattern?**

**A:** Event delegation is the technique of attaching a single event listener to a common ancestor element instead of attaching individual listeners to many child elements, relying on event bubbling to catch events as they propagate up from whichever child was actually interacted with. Inside the handler, you inspect `event.target` (the actual element that triggered the event) to determine what was clicked, often using `element.matches(selector)` or `closest()` to check if it matches the elements you care about. This pattern is useful for performance (one listener instead of hundreds), and critically, it automatically handles dynamically added elements — if new list items are added to a list after the page loads, a delegated listener on the parent `<ul>` still catches clicks on them without needing to re-attach listeners, whereas individually-bound listeners would need to be manually re-attached to each new element.

```js
document.querySelector("ul").addEventListener("click", (e) => {
  if (e.target.matches("li")) {
    console.log("Clicked item:", e.target.textContent);
  }
});
```

---

**Q27: What is the difference between `stopPropagation()` and `preventDefault()`?**

**A:** These solve two unrelated problems that are frequently confused. `event.stopPropagation()` stops the event from continuing to propagate through the DOM tree (bubbling up to ancestors or capturing down to descendants) — it does not stop the browser's default behavior for that event. `event.preventDefault()` stops the browser's default action associated with the event — such as a link navigating to its `href`, a form submitting and reloading the page, or a checkbox toggling — but it does not stop the event from bubbling to parent elements, which will still see the event fire. In practice both are often used together, for example in a single-page application form handler you'd call `preventDefault()` to stop the actual page reload on submit, and separately call `stopPropagation()` if you specifically need to prevent a parent element's click handler (like a modal-closing overlay) from also reacting to the same click.

---

**Q28: How do you select and traverse DOM elements efficiently?**

**A:** `document.querySelector()` and `document.querySelectorAll()` accept any valid CSS selector and are the most flexible and commonly used modern selection methods — `querySelector` returns the first match or `null`, while `querySelectorAll` returns a static (non-live) `NodeList` of all matches. Older methods like `getElementById`, `getElementsByClassName`, and `getElementsByTagName` are generally faster for simple lookups but return live `HTMLCollection`s (for class/tag name) that automatically update as the DOM changes, which can cause subtle bugs if you iterate over them while modifying the DOM. For traversal, elements expose `parentElement`, `children`, `nextElementSibling`, `previousElementSibling`, and `closest(selector)` (which walks up the ancestor chain looking for a match) — `closest()` is especially useful in event delegation to find the relevant ancestor of an event target regardless of exactly which descendant was clicked.

---

**Q29: What is the difference between `innerHTML`, `textContent`, and `innerText`?**

**A:** `innerHTML` gets or sets the HTML markup inside an element, parsing any string you assign as HTML — this is powerful but dangerous, since assigning unsanitized user input via `innerHTML` opens the door to XSS (cross-site scripting) attacks, so it should only be used with trusted or properly sanitized content. `textContent` gets or sets the raw text content of an element and all its descendants, ignoring styling and always including text from hidden elements, without parsing any HTML in the assigned string (it's treated as plain text) — this makes it the safe choice when inserting user-generated content. `innerText` is similar to `textContent` but is aware of CSS styling: it excludes text from elements hidden via CSS (`display: none`) and triggers a reflow to compute visible text, which makes it more expensive performance-wise and slightly less predictable across browsers than `textContent`.

---

**Q30: How would you create and insert a new element into the DOM?**

**A:** The standard approach is to call `document.createElement(tagName)` to create a detached element in memory, configure it (set `textContent`, attributes via `setAttribute`, classes via `classList.add`), and then attach it to the visible DOM using a method like `parentElement.appendChild(newElement)`, or the more flexible modern methods `append()` (accepts multiple nodes and strings) and `prepend()`. For inserting relative to an existing element rather than at the start/end of a parent, `insertBefore(newNode, referenceNode)` or the newer `referenceNode.before()`/`after()` methods are used. When inserting many elements at once, it's a performance best practice to build them inside a `DocumentFragment` first and append the fragment once, rather than triggering a separate reflow/repaint for each individual `appendChild` call directly against the live DOM.

---

## ES6+ Features & Modules (Q31–Q36)

**Q31: What is the difference between CommonJS and ES Modules?**

**A:** CommonJS (`require`/`module.exports`) is Node.js's original module system: modules are loaded synchronously at runtime, `require()` can be called conditionally or dynamically anywhere in the code, and the entire module's exports object is evaluated and cached the first time it's required. ES Modules (`import`/`export`) are the standardized, native JavaScript module system: imports and exports are statically analyzable at parse time (before any code runs), which enables tree-shaking by bundlers, imports are hoisted to the top and must appear at the top level (though dynamic `import()` returning a promise is allowed for lazy loading), and ESM modules run in strict mode by default with live bindings — meaning if the exporting module later reassigns an exported variable, importers see the updated value, unlike CommonJS's snapshot-style copy. Node.js supports both today, distinguishing them via the `.mjs`/`.cjs` extensions or the `"type"` field in `package.json`.

---

**Q32: What are `let` and `const` block scoping, and how does that differ from `var`'s function scoping?**

**A:** `var` is function-scoped (or globally scoped if declared outside any function) — a `var` declared inside an `if` block or a `for` loop is actually accessible throughout the entire enclosing function, which frequently causes bugs, especially in loops where closures created inside the loop all end up sharing the same single `var` binding. `let` and `const` are block-scoped, meaning their visibility is limited to the nearest enclosing pair of curly braces (`{}`) — an `if` block, a `for` loop body, or any bare block — which matches the scoping intuition most developers expect from other languages. This is why `for (let i = 0; ...)` creates a fresh binding of `i` for each iteration (so closures capture the correct per-iteration value), while the equivalent `for (var i = 0; ...)` shares one binding across all iterations, a classic interview gotcha.

---

**Q33: What are template literals and tagged templates?**

**A:** Template literals, delimited by backticks, allow embedded expressions via `${expression}` interpolation and support multi-line strings without escape characters, which is a major readability improvement over string concatenation. Tagged templates take this further: prefixing a template literal with a function name (`tag\`Hello ${name}\``) calls that function with the literal string segments (as an array, with a `.raw` property for the unescaped versions) and the interpolated values as separate arguments, letting you intercept and transform the template before it becomes a final string. This is the mechanism behind libraries like `styled-components` (processing CSS-in-JS templates) and safe SQL/HTML templating utilities that automatically escape interpolated values to prevent injection attacks.

---

**Q34: What are Sets and Maps, and when would you use them instead of arrays/objects?**

**A:** A `Set` is a collection of unique values of any type, with `O(1)` average lookup via `.has()`, making it the right choice whenever you need to deduplicate a list or perform fast membership checks — for example, `[...new Set(array)]` is the idiomatic one-liner to remove duplicates from an array. A `Map` is a collection of key-value pairs where keys can be of any type (unlike plain objects, whose keys are coerced to strings), preserves insertion order, provides a `.size` property, and offers better performance for frequent additions/removals of keys compared to plain objects. You'd reach for a `Map` over a plain object when keys aren't necessarily strings (e.g., using objects or DOM nodes as keys), when you need guaranteed iteration order, or when you're doing many dynamic insert/delete operations, since objects were not originally designed as general-purpose dictionaries.

---

**Q35: What is optional chaining and nullish coalescing, and what problem do they solve?**

**A:** Optional chaining (`?.`) lets you safely access deeply nested properties or call methods without manually checking each level for `null`/`undefined` first — `user?.profile?.avatar` returns `undefined` immediately (short-circuiting) if `user` or `profile` is nullish, instead of throwing `Cannot read property 'avatar' of undefined`. Nullish coalescing (`??`) provides a fallback value, but specifically only when the left-hand side is `null` or `undefined` — unlike `||`, which falls back on any falsy value including `0`, `""`, or `false`, which was a longstanding source of bugs when a legitimately valid falsy value (like a quantity of `0`) got incorrectly replaced by a default. Together, `user?.settings?.volume ?? 50` correctly handles a missing settings object while still respecting an explicitly-set volume of `0`.

---

**Q36: What are generators and how do they differ from regular functions?**

**A:** A generator function, declared with `function*`, can pause its execution at `yield` expressions and resume later, maintaining its internal state (local variables, execution position) between resumptions — calling a generator function doesn't run its body immediately but instead returns an iterator object with a `.next()` method that runs the function up to the next `yield` and returns `{ value, done }`. This lazy, pausable execution model makes generators useful for representing infinite sequences (like an ID generator) without computing all values upfront, for implementing custom iterables that work with `for...of`, and historically, for writing asynchronous code in a synchronous-looking style before `async`/`await` existed (libraries like `co` used generators plus promises for exactly this). `async`/`await` is, in fact, conceptually built on the same coroutine-like pausing mechanism as generators, just specialized for promises.

---

## Node.js, Express & Backend (Q37–Q44)

**Q37: What is middleware in Express, and how does the request-response cycle flow through it?**

**A:** Middleware in Express is a function with the signature `(req, res, next)` that has access to the request and response objects and can execute code, modify `req`/`res`, end the request-response cycle, or call `next()` to pass control to the next middleware in the stack. Express processes middleware in the exact order it's registered with `app.use()` or route-specific handlers, forming a pipeline — a request might flow through a logging middleware, then a body-parsing middleware, then an authentication middleware, then the route handler itself, and finally an error-handling middleware if anything threw. If a middleware function never calls `next()` and never sends a response, the request hangs indefinitely, which is a very common bug for developers new to Express. Error-handling middleware is distinguished by having four parameters `(err, req, res, next)` and is only invoked when `next(err)` is called or a synchronous error is thrown inside a route handler.

---

**Q38: How would you design RESTful API routes for a resource like "posts" with comments?**

**A:** RESTful design maps HTTP verbs and hierarchical URLs onto CRUD operations on resources. For posts: `GET /posts` lists all posts, `GET /posts/:id` retrieves one, `POST /posts` creates a new post, `PUT /posts/:id` replaces a post entirely, `PATCH /posts/:id` partially updates it, and `DELETE /posts/:id` removes it. For the nested comments resource, you'd nest under the parent: `GET /posts/:postId/comments` lists comments for a post, `POST /posts/:postId/comments` creates a comment under that post, and `DELETE /posts/:postId/comments/:commentId` removes a specific one. Good REST design also means using plural nouns (not verbs) in URLs, using appropriate status codes (201 for creation, 204 for deletion, 404 for missing resources), supporting pagination via query parameters (`?page=2&limit=20`) for list endpoints, and keeping the API stateless — each request should carry all the information needed to process it, typically via a bearer token, rather than relying on server-side session state.

---

**Q39: How does JWT-based authentication work at a high level?**

**A:** JSON Web Tokens (JWT) are a compact, self-contained way to represent claims (like user ID and role) as a signed string, structured as three base64url-encoded segments separated by dots: a header (algorithm and token type), a payload (the claims), and a signature (computed by signing the header and payload with a secret or private key). The typical flow is: a user logs in with credentials, the server verifies them and issues a JWT signed with a server-side secret, the client stores this token (commonly in an httpOnly cookie or, less securely, localStorage) and sends it in the `Authorization: Bearer <token>` header on subsequent requests, and the server verifies the signature on each request to confirm the token hasn't been tampered with and hasn't expired, without needing to query a database or session store — this statelessness is JWT's main advantage over server-side sessions. The tradeoff is that a JWT can't be easily revoked before its expiry (since the server doesn't track "active" tokens), which is usually mitigated with short expiry times plus a refresh-token mechanism.

---

**Q40: What is the difference between `fs.readFile` and `fs.readFileSync` in Node.js, and why does it matter?**

**A:** `fs.readFileSync` blocks the single JavaScript thread until the entire file is read from disk, meaning no other code — including handling other incoming HTTP requests in a server — can run during that time. `fs.readFile` (callback-based) or its promise-based counterpart in `fs/promises` performs the read asynchronously via Node's libuv thread pool, immediately returning control to the event loop so other work can proceed, and invoking the callback (or resolving the promise) once the read completes. This distinction matters enormously in server code: using synchronous file operations in a request handler in a production Node server would stall every concurrent request while one file read completes, effectively serializing what should be concurrent I/O — synchronous methods are generally reserved for startup-time scripts or CLI tools where blocking briefly is acceptable and there's no concurrent request load to protect.

---

**Q41: What is the purpose of `package.json` and what do `dependencies` vs `devDependencies` mean?**

**A:** `package.json` is the manifest file describing a Node.js project: its name, version, entry point, scripts, and — critically — its dependencies. `dependencies` lists packages required for the application to actually run in production, such as `express` or a database driver; these get installed whenever someone runs `npm install` and are what get bundled/deployed with the app. `devDependencies` lists packages only needed during development or testing, like test runners (`jest`), linters (`eslint`), or build tools (`webpack`) — these are installed by default during development but can be skipped in a production install via `npm install --omit=dev` (or the older `--production` flag), keeping production deployments leaner. The `scripts` field defines named shell commands (like `"start"`, `"test"`, `"build"`) runnable via `npm run <name>`, and semantic versioning ranges in dependency version strings (`^4.18.2` allows minor/patch updates, `~4.18.2` allows only patch updates) control how aggressively `npm update` is allowed to bump installed versions.

---

**Q42: How do you handle environment-specific configuration in a Node.js/Express app?**

**A:** The standard approach is to read configuration from environment variables via `process.env`, keeping secrets and environment-specific values (database URLs, API keys, port numbers) out of the source code entirely. In local development, a `.env` file (loaded with a package like `dotenv`) is used to populate `process.env` without committing secrets to version control — `.env` should always be listed in `.gitignore`. In deployed environments (staging, production), the actual environment variables are set through the hosting platform's configuration (container environment variables, a secrets manager, or CI/CD pipeline variables) rather than a file at all. Well-structured apps centralize this into a single config module that reads all needed environment variables once at startup, validates that required ones are present (failing fast with a clear error if not), and exports a typed configuration object, rather than scattering `process.env.X` reads throughout the codebase.

---

**Q43: What is CORS and why does it matter for a Node/Express backend serving a frontend on a different origin?**

**A:** Cross-Origin Resource Sharing (CORS) is a browser security mechanism that restricts web pages from making requests to a different origin (different scheme, domain, or port) than the one that served the page, unless the server explicitly opts in via response headers. When a frontend on `https://app.example.com` tries to call an API on `https://api.example.com`, the browser first may send a "preflight" `OPTIONS` request (for non-simple requests) asking the server if the actual request is permitted, and the server must respond with headers like `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers` for the browser to allow the real request through. In Express, this is typically handled with the `cors` middleware package (`app.use(cors({ origin: 'https://app.example.com', credentials: true }))`), and getting this configuration wrong is one of the most common sources of confusing "network error" bugs when frontend and backend are deployed separately, since the failure happens silently in the browser before the request is even sent to the actual route handler in the "blocked" case.

---

**Q44: How would you structure error handling in a production Express application?**

**A:** A robust approach centralizes error handling rather than scattering `try`/`catch` inconsistently across routes. Route handlers should either be wrapped in a helper that catches rejected promises and forwards them to `next(err)` (since Express doesn't automatically catch async errors thrown inside `async` route handlers without such a wrapper, prior to Express 5), or explicitly use `try`/`catch` and call `next(err)` on failure. A single error-handling middleware, registered last with the four-argument signature `(err, req, res, next)`, then normalizes the response: mapping known error types (like a custom `ValidationError` or `NotFoundError` class) to appropriate status codes and user-facing messages, logging the full stack trace server-side for unexpected errors, and never leaking internal stack traces or sensitive details to the client in production. It's also good practice to define custom error classes extending `Error` with a `statusCode` property, so the centralized handler can generically read `err.statusCode || 500` rather than needing a giant switch statement of error types.

---

## Data Structures, Algorithms & Misc (Q45–Q50)

**Q45: What is the time complexity of common array operations in JavaScript?**

**A:** Accessing an array element by index (`arr[i]`) is O(1) since arrays are backed by contiguous, indexable memory. `.push()` and `.pop()` (operating at the end) are O(1) amortized, since they don't require shifting other elements. `.unshift()` and `.shift()` (operating at the start) are O(n), because every remaining element must be re-indexed/shifted after the insertion or removal point. Searching with `.indexOf()`, `.includes()`, or `.find()` is O(n) since, absent additional structure, the engine must check elements one by one. `.sort()` is typically O(n log n), implemented as some form of Timsort or similar comparison sort in modern engines. Knowing these complexities matters in practice — for example, repeatedly calling `.unshift()` inside a loop to build a large array is a classic performance anti-pattern, since it turns an O(n) operation into an O(n²) total cost across the loop.

---

**Q46: When would you use a Map over a plain object for a lookup table, from a performance and correctness perspective?**

**A:** Beyond the API differences (arbitrary key types, guaranteed insertion order, a `.size` property), `Map` avoids a specific class of correctness bugs that plain objects are prone to: object keys are always coerced to strings, so using non-string values (numbers, objects) as keys silently collapses distinct values to the same string key, and there's a risk of prototype pollution or collision with inherited properties like `toString` or `constructor` if you're not careful (mitigated with `Object.create(null)` but that's an easy step to forget). Performance-wise, `Map` is generally optimized by JS engines for frequent additions and deletions of keys, which can outperform plain objects in that specific workload, though for a fixed, mostly-read-only lookup table, either performs comparably and the choice is more about correctness and clarity of intent — reaching for `Map` communicates "this is a general-purpose key-value dictionary," while a plain object often implies "this is a fixed-shape record with known property names."

---

**Q47: How would you deep clone an object in JavaScript, and what are the tradeoffs of different approaches?**

**A:** `structuredClone(obj)`, a global function available in modern browsers and Node 17+, is the current recommended approach — it performs a true deep clone supporting circular references, `Map`s, `Set`s, `Date`s, and typed arrays, but it cannot clone functions, DOM nodes, or object prototypes (it throws on those). The older common trick, `JSON.parse(JSON.stringify(obj))`, works for simple plain-data objects but silently loses `undefined` values, functions, `Date` objects (converted to strings), `Map`/`Set` (converted to `{}`), and breaks entirely on circular references (throws), so it's only safe for JSON-serializable data. For objects containing functions, class instances, or other non-serializable data, you'd need a manual recursive clone function or a library like Lodash's `cloneDeep`, which handles more edge cases (like preserving prototypes) at the cost of an added dependency.

---

**Q48: What is memoization and how would you implement it in JavaScript?**

**A:** Memoization is an optimization technique that caches the result of an expensive function call keyed by its input arguments, so that subsequent calls with the same arguments return the cached result instantly instead of recomputing it — it trades memory for speed, and is most valuable for pure functions (same input always produces same output, no side effects) that are called repeatedly with a limited set of distinct inputs, such as recursive Fibonacci or expensive derived-state calculations in a UI. A simple implementation wraps the target function in a higher-order function that maintains a cache (often a `Map`, keyed by a serialized representation of the arguments), checks the cache before invoking the real function, and stores the result after computing it for the first time.

```js
function memoize(fn) {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
```

---

**Q49: How would you check for a palindrome or reverse a string in JavaScript, and what's the complexity?**

**A:** A common approach converts the string to an array, reverses it, and rejoins: `str.split("").reverse().join("") === str`, which is O(n) time (each step is a linear pass) and O(n) additional space for the intermediate arrays/strings, since JavaScript strings are immutable and every transformation produces a new string. A more memory-efficient approach for just checking palindrome status (without needing the reversed string itself) uses two pointers starting at each end of the string and moving inward, comparing characters at each step and returning `false` as soon as a mismatch is found — this is still O(n) time but avoids allocating extra arrays, and it can short-circuit early on a mismatch near the start, whereas the reverse-and-compare approach always does the full reversal regardless of where a mismatch would occur.

---

**Q50: What is the difference between a stack and a queue, and how would you implement each using a plain JavaScript array?**

**A:** A stack is a Last-In-First-Out (LIFO) structure — the most recently added item is the first one removed — and maps naturally onto JavaScript array's `.push()` (add to end) and `.pop()` (remove from end), both O(1) operations, making arrays a natural and efficient stack implementation; call stacks, undo/redo history, and depth-first traversal all rely on this LIFO behavior. A queue is First-In-First-Out (FIFO) — the earliest added item is the first removed — which can be implemented with `.push()` (add to end, O(1)) paired with `.shift()` (remove from start), but `.shift()` is O(n) because every remaining element must be re-indexed, making a plain array a poor choice for a high-throughput queue; a more efficient queue implementation for performance-critical code uses a circular buffer or a linked list with head/tail pointers to achieve O(1) enqueue and dequeue, or two-stack tricks, avoiding the O(n) cost inherent to shifting a JS array's front element.

---
