# Higher-Order Functions, Recursion, and Modules — Complete Guide

## Table of Contents
1. [Callbacks](#1-callbacks)
2. [Higher-Order Functions](#2-higher-order-functions)
3. [Recursion](#3-recursion)
4. [Recursion and the Call Stack](#4-recursion-and-the-call-stack)
5. [ES6 Modules — Named Exports](#5-es6-modules--named-exports)
6. [ES6 Modules — Default Exports](#6-es6-modules--default-exports)
7. [Mixing Named and Default, and Re-exporting](#7-mixing-named-and-default-and-re-exporting)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Callbacks

A **callback** is a function passed as an argument to another function, to be invoked (called back) at some point inside that function's execution — either synchronously, right away, or asynchronously, later.

```js
function processUserInput(callback) {
  const name = "Alice";     // pretend this came from a form
  callback(name);
}

processUserInput(function (name) {
  console.log(`Received: ${name}`);
});
// "Received: Alice"

// Passing a named function instead of an inline anonymous one
function logName(name) {
  console.log(`Name is ${name}`);
}
processUserInput(logName); // "Name is Alice"
```

### Synchronous vs Asynchronous Callbacks

```js
// Synchronous — callback runs immediately, before processSync() returns
function processSync(callback) {
  callback("done synchronously");
}
processSync(msg => console.log(msg));
console.log("This logs AFTER the callback, because everything above was synchronous");

// Asynchronous — callback runs LATER, after the current code finishes
function processAsync(callback) {
  setTimeout(() => callback("done asynchronously"), 1000);
}
processAsync(msg => console.log(msg));
console.log("This logs BEFORE the callback, because setTimeout defers it");
```

Asynchronous callbacks are the foundation of everything in Phase 5 (Promises, `async`/`await`) — understanding that a callback might run "now" or "later" is essential before tackling that phase.

---

## 2. Higher-Order Functions

A **higher-order function** is any function that either accepts another function as an argument, returns a function, or both. `map`, `filter`, and `reduce` (Phase 2) are all higher-order functions — this lesson looks at writing your own.

```js
// Accepts a function as an argument
function repeat(n, action) {
  for (let i = 0; i < n; i++) {
    action(i);
  }
}
repeat(3, i => console.log(`Iteration ${i}`));
// Iteration 0
// Iteration 1
// Iteration 2

// Returns a function
function makeAdder(x) {
  return function (y) {
    return x + y;
  };
}
const add5 = makeAdder(5);
console.log(add5(10)); // 15
```

### Composing Functions

Higher-order functions unlock **function composition** — building complex behavior by combining small, single-purpose functions.

```js
const double = x => x * 2;
const increment = x => x + 1;
const square = x => x * x;

function compose(...fns) {
  return function (input) {
    return fns.reduceRight((acc, fn) => fn(acc), input);
  };
}

const doubleThenIncrementThenSquare = compose(square, increment, double);
console.log(doubleThenIncrementThenSquare(3));
// double(3) = 6, increment(6) = 7, square(7) = 49
```

### Field-by-Field Breakdown

```
fns.reduceRight((acc, fn) => fn(acc), input)
    │            │    │       │        │
    │            │    │       │        └── initial value: the input to the whole pipeline
    │            │    │       └── apply the current function to the running result
    │            │    └── the current function being applied
    │            └── the running result so far
    └── reduceRight processes the array RIGHT TO LEFT — this makes
        compose(f, g, h)(x) equivalent to f(g(h(x))), the standard
        mathematical convention for function composition
```

### Practical Higher-Order Function: A Simple Event Emitter

```js
function createEmitter() {
  const listeners = {};

  return {
    on(event, callback) {                     // accepts a function (callback)
      (listeners[event] ||= []).push(callback);
    },
    emit(event, ...args) {
      (listeners[event] || []).forEach(cb => cb(...args)); // calls stored functions
    }
  };
}

const emitter = createEmitter();
emitter.on("greet", name => console.log(`Hello, ${name}!`));
emitter.emit("greet", "Alice"); // "Hello, Alice!"
```

---

## 3. Recursion

A **recursive function** is a function that calls itself, breaking a problem down into smaller versions of the same problem until it reaches a **base case** — the smallest version of the problem, solved directly without further recursion.

```js
function factorial(n) {
  if (n <= 1) return 1;          // base case — stops the recursion
  return n * factorial(n - 1);   // recursive case — calls itself with a smaller problem
}
console.log(factorial(5)); // 5 * 4 * 3 * 2 * 1 = 120
```

### Field-by-Field Breakdown

```
function factorial(n) {
  if (n <= 1) return 1;
    ↳ BASE CASE — the smallest input the function knows how to
      answer directly, with no further recursive calls. Every
      recursive function needs at least one of these, or it
      recurses forever (Stack Overflow, see Lesson 1).

  return n * factorial(n - 1);
    ↳ RECURSIVE CASE — solves the problem by combining the
      current value (n) with the result of solving a SMALLER
      version of the same problem (factorial(n - 1)).
}
```

---

## 4. Recursion and the Call Stack

Recursion is entirely powered by the call stack (introduced in Lesson 1) — each recursive call pushes a new frame, and results are combined as those frames pop back off.

### ASCII Diagram: factorial(4) Call Stack

```
Calls pushed going DOWN into the recursion:

  factorial(4)
    calls factorial(3)
      calls factorial(2)
        calls factorial(1)
          → base case! returns 1 directly, no further calls

Stack at its DEEPEST point:
┌───────────────────┐
│ factorial(1) → 1  │  ← currently executing, about to return
├───────────────────┤
│ factorial(2)       │  ← waiting for factorial(1) to return
├───────────────────┤
│ factorial(3)       │  ← waiting for factorial(2) to return
├───────────────────┤
│ factorial(4)       │  ← waiting for factorial(3) to return
└───────────────────┘
Global Execution Context

Results combined going BACK UP as the stack unwinds:

  factorial(1) returns 1
  factorial(2) returns 2 * 1 = 2
  factorial(3) returns 3 * 2 = 6
  factorial(4) returns 4 * 6 = 24

Final result: factorial(4) = 24
```

### Recursion vs Iteration

```js
// Recursive version
function sumRecursive(n) {
  if (n === 0) return 0;
  return n + sumRecursive(n - 1);
}

// Iterative version — no call stack growth, uses a loop instead
function sumIterative(n) {
  let total = 0;
  for (let i = 1; i <= n; i++) {
    total += i;
  }
  return total;
}

console.log(sumRecursive(5), sumIterative(5)); // 15 15
```

```
Recursion is often more readable for problems that are naturally
self-similar — tree traversal, nested data structures, divide-and-conquer
algorithms — but each call consumes call stack memory, so very deep
recursion (tens of thousands of calls) risks a stack overflow where an
equivalent loop would not. Some languages optimize "tail call" recursion
to avoid this; standard JavaScript engines generally do not, so
iteration is usually preferred for simple linear counting problems.
```

---

## 5. ES6 Modules — Named Exports

ES6 modules let you split code across files, explicitly declaring what each file exposes (`export`) and what it consumes (`import`). Modules run in **strict mode** automatically and have their own top-level scope — nothing leaks between files unless explicitly exported.

```js
// file: mathUtils.js
export const PI = 3.14159;

export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

// Alternative: declare everything first, export together at the bottom
// function multiply(a, b) { return a * b; }
// export { multiply };
```

```js
// file: main.js
import { PI, add, subtract } from "./mathUtils.js";

console.log(PI);          // 3.14159
console.log(add(2, 3));   // 5
console.log(subtract(5, 2)); // 3

// Renaming on import
import { add as addNumbers } from "./mathUtils.js";
console.log(addNumbers(1, 2)); // 3

// Importing everything as a namespace object
import * as MathUtils from "./mathUtils.js";
console.log(MathUtils.PI, MathUtils.add(1, 1)); // 3.14159 2
```

### Field-by-Field Breakdown

```
export const PI = 3.14159;
 └── "export" in front of a declaration makes it available to
     other files that import from this module. You can have
     MANY named exports per file.

import { PI, add } from "./mathUtils.js";
        │              └── the module path — relative paths need
        │                  the file extension in native ES modules
        └── the names must match EXACTLY what was exported
            (curly braces = named imports, matched by name)
```

---

## 6. ES6 Modules — Default Exports

Each module can have exactly **one** default export — typically used for a file's single "main" thing, like a class or a primary function.

```js
// file: Logger.js
export default function log(message) {
  console.log(`[LOG]: ${message}`);
}
```

```js
// file: main.js
import log from "./Logger.js";   // NO curly braces for default imports
log("Application started");       // "[LOG]: Application started"

// The imported name can be ANYTHING — it doesn't have to match the original
import myLogger from "./Logger.js";
myLogger("Renamed on import, still works"); // default imports have no fixed name to match
```

```
Named export     export const x = 1;          import { x } from "...";     name MUST match, {} required
Default export   export default function(){}  import anyNameYouWant from "...";  {} NOT used, name is free
```

---

## 7. Mixing Named and Default, and Re-exporting

```js
// file: shapes.js
export default class Circle { /* ... */ }
export const PI = 3.14159;
export function area(radius) { return PI * radius * radius; }
```

```js
// file: main.js
import Circle, { PI, area } from "./shapes.js";  // default + named, combined in one import statement
```

```js
// file: index.js — a common "barrel" pattern that re-exports from multiple files
export { add, subtract } from "./mathUtils.js";
export { default as Logger } from "./Logger.js";
```

```js
// file: main.js
import { add, subtract, Logger } from "./index.js"; // single import point for consumers
```

### Module Scope Recap

```
Every ES module has:
  - its own top-level scope (no accidental globals leaking across files)
  - automatic strict mode
  - a "this" of undefined at the top level
  - imports are LIVE bindings — if the exporting module later changes
    an exported "let" value, importers see the updated value
```

---

## 8. Hands-On Exercises

**Exercise 1:** Write a higher-order function `withLogging(fn)` that returns a new function which logs `"Calling <fn.name> with args: [...]"` before invoking `fn` with the same arguments, and returns whatever `fn` returns. Wrap a simple `add(a, b)` function with it and confirm both the logging and the correct return value work.

**Exercise 2:** Implement your own simplified `compose(...fns)` function from scratch (don't copy this lesson's version verbatim — write it independently) that applies functions right-to-left, and a `pipe(...fns)` function that applies functions left-to-right. Test both with the same three simple functions and confirm they produce different results when the functions aren't commutative (e.g. `double` then `increment` vs `increment` then `double`).

**Exercise 3:** Write a recursive function `sumDigits(n)` that returns the sum of all digits in a non-negative integer (e.g. `sumDigits(1234)` returns `10`), using the pattern `n % 10` for the last digit and `Math.floor(n / 10)` for the rest. Identify and write down the base case explicitly in a comment.

**Exercise 4:** Write a recursive function `flattenArray(arr)` that flattens an arbitrarily nested array (e.g. `[1, [2, [3, [4, 5]], 6]]` becomes `[1, 2, 3, 4, 5, 6]`) without using the built-in `Array.prototype.flat()`. Manually trace (in a comment) the call stack for a small 2-level-deep example.

**Exercise 5:** Create two files: `stringUtils.js` exporting named functions `capitalize(str)` and `reverse(str)`, plus a default export `formatTitle(str)` that applies both. Create a `main.js` that imports all three (mixing default and named in one `import` statement) and demonstrates each. If you don't have a bundler set up, describe in a comment how you'd run this in a browser (`<script type="module">`) or in Node (`"type": "module"` in `package.json`, or `.mjs` extension).

---

## 9. Interview Q&A

**Q: What is a higher-order function, and why are `map`, `filter`, and `reduce` examples of them?**
Answer: A higher-order function is any function that takes one or more functions as arguments, returns a function as its result, or both — this is possible in JavaScript because functions are "first-class citizens," meaning they can be treated like any other value: stored in variables, passed as arguments, and returned from other functions. `map`, `filter`, and `reduce` all qualify because each one accepts a callback function as an argument and uses it internally to decide how to transform, test, or accumulate the array's elements — the array method itself doesn't know in advance what transformation or test to apply; it delegates that decision entirely to whatever function you pass in, which is the defining characteristic of a higher-order function.

**Q: What is a base case in recursion, and what happens if a recursive function doesn't have one?**
Answer: A base case is the simplest version of the problem that a recursive function can answer directly, without making any further recursive calls — for example, in a factorial function, `factorial(1)` returns `1` immediately rather than calling `factorial(0)` and beyond. Every recursive function must have at least one reachable base case, because it's the only thing that stops the chain of recursive calls; without one, or with a base case that's structured so it's never actually reached for certain inputs, the function keeps calling itself indefinitely, continuously pushing new frames onto the call stack until the engine runs out of allocated stack memory and throws a `RangeError: Maximum call stack size exceeded`.

**Q: How does recursion relate to the call stack, and why can deep recursion sometimes be less efficient than an equivalent loop?**
Answer: Every recursive call is, mechanically, just a regular function call — it pushes a new stack frame that holds that call's local variables and remembers where to resume once the call returns, exactly like any other function call would. As a recursive function keeps calling itself before resolving, the stack keeps growing deeper and deeper until it hits the base case, at which point results are combined and returned back up the chain as each frame is popped off in reverse order. This makes deep recursion (say, tens of thousands of levels) risk a stack overflow that a simple iterative loop, which doesn't grow the call stack at all since it just repeats within a single frame, would never hit — which is why performance- or safety-sensitive code sometimes rewrites deeply recursive algorithms as iterative ones, or restructures them to use an explicit stack data structure instead of the call stack.

**Q: What is the difference between a default export and a named export in ES6 modules?**
Answer: A module can have any number of named exports, each exported with an explicit name (`export const PI = 3.14`), and anyone importing them must use that exact name wrapped in curly braces (`import { PI } from "./file.js"`), optionally renaming it with `as`. A module can have at most one default export (`export default function(){}`), which represents that file's single "main" export, and when importing it you don't use curly braces and you can choose absolutely any local name you want for it, since there's no name to match against — the import is positional, not name-based. In practice, named exports are preferred for utility modules exposing multiple related functions or constants, while default exports are common for files whose entire purpose is a single class or component.

**Q: Why do ES6 modules automatically run in strict mode, and what practical difference does that make compared to a classic script?**
Answer: The ES6 module specification mandates strict mode for every module automatically, without needing the `"use strict"` directive, as part of establishing modules as a cleaner, safer execution environment than legacy global scripts — this was a deliberate design decision to avoid modules inheriting decades of legacy, loosely-enforced script behavior. Practically, this means assignments to undeclared variables throw a `ReferenceError` instead of silently creating global variables, `this` at the top level is `undefined` rather than the global object, duplicate parameter names are a syntax error, and several other error-prone legacy behaviors are disabled — combined with the fact that each module has its own isolated top-level scope (nothing is implicitly global unless explicitly exported), this makes modules significantly more predictable and less prone to the accidental-global and silent-failure bugs common in older, non-modular JavaScript.
