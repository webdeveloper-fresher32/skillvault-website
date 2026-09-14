# Execution Context and Hoisting — Complete Guide

## Table of Contents
1. [What Is an Execution Context](#1-what-is-an-execution-context)
2. [The Two Phases of Execution Context](#2-the-two-phases-of-execution-context)
3. [The Call Stack](#3-the-call-stack)
4. [Hoisting of var](#4-hoisting-of-var)
5. [Hoisting of Function Declarations](#5-hoisting-of-function-declarations)
6. [Hoisting of let and const, and the Temporal Dead Zone](#6-hoisting-of-let-and-const-and-the-temporal-dead-zone)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What Is an Execution Context

An **execution context** is the environment in which JavaScript code is evaluated and run — it holds the current value of variables, functions, and `this`. Every time your code runs, it runs inside one.

```
Three kinds of execution context:

  Global Execution Context (GEC)
    ↳ Created once, when the script first loads.
    ↳ Holds top-level variables/functions and the global "this".

  Function Execution Context (FEC)
    ↳ Created every single time a function is CALLED (not defined).
    ↳ Holds that call's local variables, parameters, and its own "this".
    ↳ Destroyed when the function returns (unless captured by a closure — next lesson).

  Eval Execution Context
    ↳ Created by code running inside eval(). Rare in modern code — ignore for now.
```

---

## 2. The Two Phases of Execution Context

Every execution context is built in two distinct phases before your code visibly "runs."

```
Phase 1: Creation Phase (a.k.a. "compile" phase)
  1. Create the Variable Object / Lexical Environment.
  2. Scan the code for "var" declarations → create them, initialize to undefined.
  3. Scan the code for function declarations → create them, fully initialized (whole function).
  4. Scan for "let"/"const" declarations → create them, but leave them UNINITIALIZED
     (this is what causes the Temporal Dead Zone — see section 6).
  5. Determine the value of "this" for this context.

Phase 2: Execution Phase
  1. Run the code top to bottom, line by line.
  2. Assign real values to variables as their assignment lines execute.
  3. Execute function calls, which push new execution contexts onto the call stack.
```

### Why This Explains Hoisting

"Hoisting" is not a separate mechanism — it's simply what the Creation Phase produces. Because `var` variables and function declarations are registered in memory *before* the Execution Phase begins, they appear to be usable "before they're declared" in the source code, even though nothing actually moved.

```js
console.log(typeof myVar);  // "undefined" — created in Creation Phase, not yet assigned
console.log(myFunc());       // "hello" — fully available in Creation Phase

var myVar = "value";
function myFunc() {
  return "hello";
}
```

---

## 3. The Call Stack

The **call stack** is a data structure (a LIFO stack — Last In, First Out) that tracks which function is currently executing and which functions are "waiting" for it to return.

```js
function third() {
  console.log("in third");
}
function second() {
  third();
  console.log("in second");
}
function first() {
  second();
  console.log("in first");
}
first();
```

### ASCII Diagram: Call Stack Growth and Unwinding

```
Step 1: first() is called
┌─────────────┐
│  first()    │  ← currently executing
└─────────────┘
Global Execution Context (always at the bottom)

Step 2: first() calls second()
┌─────────────┐
│  second()   │  ← currently executing
├─────────────┤
│  first()    │  ← waiting for second() to return
└─────────────┘
Global Execution Context

Step 3: second() calls third()
┌─────────────┐
│  third()    │  ← currently executing, logs "in third"
├─────────────┤
│  second()   │  ← waiting
├─────────────┤
│  first()    │  ← waiting
└─────────────┘
Global Execution Context

Step 4: third() returns — POPPED off the stack
┌─────────────┐
│  second()   │  ← resumes, logs "in second"
├─────────────┤
│  first()    │  ← waiting
└─────────────┘
Global Execution Context

Step 5: second() returns — POPPED off the stack
┌─────────────┐
│  first()    │  ← resumes, logs "in first"
└─────────────┘
Global Execution Context

Step 6: first() returns — POPPED off the stack
(empty — back to Global Execution Context only)

Output order: "in third", "in second", "in first"
```

### Stack Overflow

```js
function recurseForever() {
  return recurseForever();  // no base case — never stops calling itself
}
recurseForever();
// RangeError: Maximum call stack size exceeded
```

Every function call adds a new frame to the call stack. If frames are added faster than they're removed (typically from unterminated recursion), the stack exceeds its allocated memory and the engine throws a `RangeError`. This is why every recursive function needs a base case — covered in Lesson 3.

---

## 4. Hoisting of var

```js
console.log(a); // undefined — NOT a ReferenceError, because "a" was created (as undefined) in the Creation Phase
var a = 5;
console.log(a); // 5

// What the engine effectively does internally:
// var a;            <- hoisted to the top, initialized to undefined
// console.log(a);   <- undefined
// a = 5;             <- assignment happens where it was originally written
// console.log(a);   <- 5
```

```
var is hoisted WITH an initial value of undefined.
Only the DECLARATION is hoisted — the ASSIGNMENT stays in place.
```

### The Classic var Hoisting Trap in Loops (Recap from Phase 1)

```js
for (var i = 0; i < 3; i++) {}
console.log(i); // 3 — "i" leaked out of the loop entirely, because var is function/global scoped, not block scoped
```

---

## 5. Hoisting of Function Declarations

Function declarations are hoisted completely — name AND body — so they can be called before their line in the source.

```js
sayHi(); // "Hi!" — works, because the whole function was registered during the Creation Phase

function sayHi() {
  console.log("Hi!");
}
```

### Function Expressions Are NOT Hoisted the Same Way

```js
sayBye(); // TypeError: sayBye is not a function
          // (the variable "sayBye" was hoisted as undefined, but its VALUE — the function — was not)

var sayBye = function () {
  console.log("Bye!");
};
```

```
function declaration    →  entire function hoisted, callable anywhere in scope
function expression     →  only the variable binding is hoisted (per var/let/const rules);
                            the function VALUE is not assigned until that line runs
```

### What Happens When Both Exist With the Same Name

```js
console.log(typeof greet); // "function" — function declarations win over var declarations
                             // of the same name during the Creation Phase

var greet = "hello";
function greet() {
  return "hi";
}

console.log(typeof greet); // "string" — after the Execution Phase runs the "var greet = 'hello'"
                             // assignment line, it overwrites the function
```

---

## 6. Hoisting of let and const, and the Temporal Dead Zone

`let` and `const` ARE hoisted — contrary to the popular claim that they aren't — but they are hoisted into an **uninitialized** state, not `undefined`. This uninitialized zone, from the top of the scope until the actual declaration line executes, is called the **Temporal Dead Zone (TDZ)**.

```js
console.log(x); // ReferenceError: Cannot access 'x' before initialization
let x = 10;
```

```
If let/const were NOT hoisted at all, the above would throw
"ReferenceError: x is not defined" (variable doesn't exist anywhere yet).

Instead it throws "Cannot access 'x' before initialization" —
a DIFFERENT error message, which proves the engine already knows
"x" exists in this scope (it's hoisted), it just refuses to let you
touch it until its declaration line has actually executed.
```

### ASCII Diagram: The Temporal Dead Zone

```
{
  // ---- TEMPORAL DEAD ZONE for "y" starts here ----
  console.log(y);        // ReferenceError — inside the TDZ
  doSomething(y);         // ReferenceError — still inside the TDZ

  let y = 5;              // ---- TDZ ENDS here — "y" is now initialized ----

  console.log(y);         // 5 — safe, we're past the declaration
}
```

### Why the TDZ Is a Feature, Not a Bug

The TDZ was intentionally designed to catch a class of bugs that `var`'s silent `undefined` hoisting used to hide. If you accidentally reference a `let`/`const` variable before it's meant to be used, you get an immediate, loud error pointing at the exact problem — instead of a confusing `undefined` silently propagating through your program's logic and causing a bug somewhere else entirely.

```js
// var version — bug hides silently
console.log(count); // undefined — no error, but clearly not what you intended
var count = 0;

// let version — bug is caught immediately
console.log(total); // ReferenceError: Cannot access 'total' before initialization — caught immediately!
let total = 0;
```

### const Also Has a TDZ, Plus No Reassignment

```js
console.log(PI); // ReferenceError: Cannot access 'PI' before initialization
const PI = 3.14159;
```

---

## 7. Hands-On Exercises

**Exercise 1:** Write a small script that logs `typeof a` before declaring `var a = 1;`, then logs `typeof b` before declaring `let b = 2;`. Run both and record the different results (`"undefined"` vs a thrown `ReferenceError`). Write a one-paragraph explanation connecting the difference to the Creation Phase and the Temporal Dead Zone.

**Exercise 2:** Write three nested functions `outer`, `middle`, `inner`, where `outer` calls `middle`, which calls `inner`. Add a `console.log` with a unique message inside each function both before and after the nested call. Run it, and manually draw (in a text comment) the call stack at its deepest point, then trace the order all six log lines print in and confirm it matches LIFO unwinding.

**Exercise 3:** Write a function `countdown(n)` that recursively calls itself with `n - 1` until `n` reaches 0, logging each value. Then write a version with NO base case (always calls itself) and run it, observing the `RangeError: Maximum call stack size exceeded`. In a comment, explain why every recursive function needs a base case in terms of the call stack.

**Exercise 4:** Write a function declaration and a function expression with different names but identical bodies. Call each one on the line immediately before its definition, and record which one works and which one throws. Then create a variable and a function declaration with the exact same name (`var greet = "hi"; function greet(){}`) and log `typeof greet` immediately (before any further code runs) to confirm function declarations win during the Creation Phase.

**Exercise 5:** Write a block `{ }` containing a `console.log` referencing a `const` variable before its declaration line, followed by the `const` declaration and value, followed by another `console.log` after it. Run it and observe the `ReferenceError`. Then move the first `console.log` to AFTER the declaration and confirm it now logs the correct value — explain in a comment exactly where the Temporal Dead Zone began and ended in this block.

---

## 8. Interview Q&A

**Q: What is hoisting, and is it accurate to say that "variable declarations are moved to the top of the file"?**
Answer: Hoisting is the observable effect of the JavaScript engine's two-phase execution model — during the Creation Phase, before any code actually runs line-by-line, the engine scans the current scope and registers every `var` declaration (initialized to `undefined`) and every function declaration (fully initialized with its complete body) in memory. It is not literally accurate to say declarations are "moved" anywhere — nothing physically relocates in the source code — but the practical effect is indistinguishable from that description for `var` and function declarations, since both are usable before their written line executes. `let` and `const` are also hoisted in the sense that the engine is aware of them from the start of their scope, but they remain uninitialized and inaccessible until their actual declaration line runs, which is why they don't exhibit the same "usable early" behavior.

**Q: What is the Temporal Dead Zone, and why does it exist?**
Answer: The Temporal Dead Zone (TDZ) is the span of code between the start of a scope and the line where a `let` or `const` variable is actually declared — during this span, the variable technically exists (the engine has hoisted its name) but is in an uninitialized state, and any attempt to read or write it throws a `ReferenceError: Cannot access '<name>' before initialization`. It exists as a deliberate safety feature: before ES6, `var`'s silent hoisting to `undefined` let bugs slip through unnoticed, where code would happily run with an `undefined` value it wasn't expecting instead of erroring immediately. The TDZ makes early access to a `let`/`const` variable fail loudly and immediately, pointing directly at the mistake instead of letting an `undefined` value quietly cause a bug somewhere downstream.

**Q: What is the call stack, and what causes a "Maximum call stack size exceeded" error?**
Answer: The call stack is a Last-In-First-Out data structure the JavaScript engine uses to track the chain of function calls currently in progress — every time a function is called, a new execution context ("stack frame") is pushed on top, and when that function returns, its frame is popped off and control resumes in the frame beneath it. A "Maximum call stack size exceeded" `RangeError` occurs when frames are pushed faster than they're popped — almost always because of a recursive function that either lacks a base case entirely or has a base case that's never actually reached — causing the stack to grow past the fixed amount of memory the JavaScript engine allocates for it, at which point the engine aborts rather than allowing unbounded memory growth.

**Q: Why does `console.log(typeof myFunc)` return `"function"` even when called before the `function myFunc(){}` declaration line, but calling a function stored in a `var` the same way fails?**
Answer: Function declarations are hoisted completely during the Creation Phase — the engine registers not just the name but the entire function body in memory before any code executes, so the function is fully callable from the very top of its enclosing scope. A `var`-based function expression (`var myFunc = function(){}`) only has its variable *declaration* hoisted per `var`'s normal rules (initialized to `undefined`), while the *assignment* of the actual function value happens only when that specific line of code executes during the Execution Phase — so calling it before that line runs attempts to call `undefined` as a function, throwing `TypeError: myFunc is not a function`. This is the core practical distinction between function declarations and function expressions when it comes to hoisting.

**Q: If both a `var` and a `function` declaration share the same name in the same scope, which one "wins," and why?**
Answer: During the Creation Phase, function declarations are processed after `var` declarations are registered, and a function declaration completely overwrites any existing `var` binding of the same name — so immediately after the Creation Phase (before any of your written code has executed), `typeof theName` reports `"function"`, not `"undefined"`. However, once the Execution Phase begins running your code top to bottom, if there's a line like `var greet = "hello";`, that assignment executes in its normal position and overwrites the function value with the string, meaning by the time execution reaches later code, `greet` may now hold the string instead of the function — the final value entirely depends on the order of assignments in the source, even though the function declaration always wins the initial hoisting race.
