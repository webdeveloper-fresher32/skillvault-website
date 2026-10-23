# Closures and Scope — Complete Guide

## Table of Contents
1. [Lexical Scope](#1-lexical-scope)
2. [What Is a Closure](#2-what-is-a-closure)
3. [Practical Closures: Counter](#3-practical-closures-counter)
4. [Practical Closures: Memoization](#4-practical-closures-memoization)
5. [The this Keyword — Global Context](#5-the-this-keyword--global-context)
6. [The this Keyword — Method Calls](#6-the-this-keyword--method-calls)
7. [The this Keyword — Arrow Functions](#7-the-this-keyword--arrow-functions)
8. [call, apply, and bind](#8-call-apply-and-bind)
9. [IIFE (Immediately Invoked Function Expression)](#9-iife-immediately-invoked-function-expression)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Lexical Scope

**Lexical scope** means a function's access to variables is determined by *where it is physically written in the source code*, not by where or how it's later called. JavaScript resolves variable lookups by walking outward through nested scopes, from innermost to outermost, until it finds a match — this chain is called the **scope chain**.

```js
const globalVar = "I'm global";

function outer() {
  const outerVar = "I'm in outer";

  function inner() {
    const innerVar = "I'm in inner";
    console.log(innerVar);  // found in inner's own scope
    console.log(outerVar);  // not found in inner, look up the chain → found in outer
    console.log(globalVar); // not found in inner or outer, look up the chain → found in global
  }

  inner();
}
outer();
```

### ASCII Diagram: The Scope Chain

```
  Global Scope
  ┌─────────────────────────────────────────────┐
  │  globalVar = "I'm global"                    │
  │                                               │
  │  outer() Scope                                │
  │  ┌─────────────────────────────────────────┐ │
  │  │  outerVar = "I'm in outer"                │ │
  │  │                                            │ │
  │  │  inner() Scope                             │ │
  │  │  ┌───────────────────────────────────────┐ │ │
  │  │  │  innerVar = "I'm in inner"             │ │ │
  │  │  │                                        │ │ │
  │  │  │  Lookup for "outerVar":                │ │ │
  │  │  │    not here → check outer() scope → ✓  │ │ │
  │  │  │  Lookup for "globalVar":                │ │ │
  │  │  │    not here → not in outer() → global ✓│ │ │
  │  │  └───────────────────────────────────────┘ │ │
  │  └─────────────────────────────────────────┘ │
  └─────────────────────────────────────────────┘

  Scope is determined by NESTING IN THE SOURCE CODE (lexical),
  not by which function called which at runtime.
```

---

## 2. What Is a Closure

A **closure** is formed when a function "remembers" the variables from its lexical scope even after the outer function that created those variables has finished running and returned.

```js
function makeGreeter(greeting) {
  return function (name) {          // this inner function is a closure
    console.log(`${greeting}, ${name}!`);
  };
}

const greetHello = makeGreeter("Hello");
const greetHi = makeGreeter("Hi");

greetHello("Alice"); // "Hello, Alice!"
greetHi("Bob");       // "Hi, Bob!"
```

### Why This Works

`makeGreeter("Hello")` runs and returns an inner function, and you might expect `greeting` to be garbage-collected once `makeGreeter` finishes executing — its execution context is popped off the call stack, after all. But because the returned inner function references `greeting` in its body, JavaScript keeps that variable alive in memory, attached to the inner function, for as long as the inner function itself still exists. This is the closure: the function "closes over" the variables it needs from its birthplace.

```
Without closures, this pattern would be impossible:
  greetHello and greetHi would have NO memory of which
  greeting string they were created with, because
  makeGreeter's local scope would be destroyed the
  instant makeGreeter finished running.

With closures:
  greetHello permanently remembers greeting = "Hello"
  greetHi permanently remembers greeting = "Hi"
  Each closure has its OWN independent copy of the enclosing variables.
```

---

## 3. Practical Closures: Counter

A classic use of closures is creating private state that can only be modified through controlled functions — the JavaScript equivalent of "private" instance variables.

```js
function createCounter() {
  let count = 0;               // "private" — not accessible from outside this function

  return {
    increment() {
      count++;
      return count;
    },
    decrement() {
      count--;
      return count;
    },
    getCount() {
      return count;
    }
  };
}

const counter = createCounter();
console.log(counter.increment()); // 1
console.log(counter.increment()); // 2
console.log(counter.decrement()); // 1
console.log(counter.getCount());  // 1
console.log(counter.count);       // undefined — "count" is NOT directly accessible, only through the methods
```

### Two Independent Counters

```js
const counterA = createCounter();
const counterB = createCounter();

counterA.increment();
counterA.increment();
counterB.increment();

console.log(counterA.getCount()); // 2 — its own independent "count"
console.log(counterB.getCount()); // 1 — a completely separate "count"
```

Each call to `createCounter()` creates a brand-new `count` variable and a brand-new closure around it — the two counters never interfere with each other.

---

## 4. Practical Closures: Memoization

Memoization uses a closure to cache the results of expensive function calls, keyed by their arguments, so repeated calls with the same input return instantly instead of recomputing.

```js
function memoize(fn) {
  const cache = {};          // captured by the closure, persists across all calls

  return function (...args) {
    const key = JSON.stringify(args);

    if (key in cache) {
      console.log("Cache hit for", key);
      return cache[key];
    }

    console.log("Computing for", key);
    const result = fn(...args);
    cache[key] = result;
    return result;
  };
}

function slowSquare(n) {
  for (let i = 0; i < 1e8; i++) {} // simulate expensive work
  return n * n;
}

const fastSquare = memoize(slowSquare);

console.log(fastSquare(5)); // "Computing for [5]"  → 25 (slow the first time)
console.log(fastSquare(5)); // "Cache hit for [5]"   → 25 (instant the second time)
console.log(fastSquare(6)); // "Computing for [6]"  → 36 (different argument, computed fresh)
```

### Field-by-Field Breakdown

```
function memoize(fn) {
  const cache = {};
    ↳ Created ONCE, when memoize(slowSquare) is first called.
      The returned inner function closes over this SAME "cache"
      object on every subsequent call — it's not recreated each time.

  return function (...args) {
    ↳ Every call to fastSquare(...) runs THIS function, which still
      has access to the one shared "cache" from when memoize ran.
```

---

## 5. The this Keyword — Global Context

```js
console.log(this); // in a browser script (non-module): the global "window" object
                     // in a Node.js CommonJS module: an empty object {} (module.exports)
                     // in strict mode or an ES module: undefined
```

`this` at the top level of a script, outside any function, refers to the global object in traditional non-strict scripts, but this varies by environment and module system — modern ES modules always have `this` as `undefined` at the top level.

---

## 6. The this Keyword — Method Calls

`this` inside a regular function is determined entirely by **how the function is called** — specifically, what is to the left of the dot at the call site.

```js
const user = {
  name: "Alice",
  greet() {
    console.log(`Hi, I'm ${this.name}`);
  }
};

user.greet();               // "Hi, I'm Alice" — called as user.greet(), so this = user

const fn = user.greet;
fn();                        // "Hi, I'm undefined" — called with no object before the dot, this = undefined/global

const anotherUser = { name: "Bob", greet: user.greet };
anotherUser.greet();          // "Hi, I'm Bob" — same function, but called as anotherUser.greet(), so this = anotherUser
```

```
Rule of thumb: "this" is determined at CALL TIME, not DEFINITION TIME.
Ask: "What object is immediately to the left of the dot when this function is invoked?"
That object is "this". If there's no object at all, "this" is
undefined (strict mode) or the global object (non-strict mode).
```

### Losing this in Callbacks

```js
const timer = {
  seconds: 0,
  start() {
    setInterval(function () {
      this.seconds++;                  // ✗ "this" here is NOT timer — regular functions passed
      console.log(this.seconds);        //   as callbacks lose their intended "this"
    }, 1000);
  }
};
// timer.start() would log NaN repeatedly — this.seconds is undefined++, which is NaN
```

---

## 7. The this Keyword — Arrow Functions

Arrow functions do not have their own `this`. Instead, they capture `this` **lexically** — from the nearest enclosing regular function or the surrounding scope at the point where the arrow function was *written*, exactly like a normal variable would be resolved via the scope chain.

```js
const timerFixed = {
  seconds: 0,
  start() {
    setInterval(() => {
      this.seconds++;              // ✓ arrow function — "this" is inherited from start()'s "this",
      console.log(this.seconds);    //   which correctly refers to "timerFixed"
    }, 1000);
  }
};
// timerFixed.start() correctly logs 1, 2, 3, 4, ...
```

### Side-by-Side Comparison

```js
const obj = {
  name: "MyObject",
  regularMethod() {
    console.log("regular:", this.name);   // "regular: MyObject" — this = obj, the caller

    function regularNested() {
      console.log("nested regular:", this.name); // "nested regular: undefined" — this = global/undefined, NOT obj
    }
    regularNested();

    const arrowNested = () => {
      console.log("nested arrow:", this.name);    // "nested arrow: MyObject" — inherits this from regularMethod
    };
    arrowNested();
  }
};
obj.regularMethod();
```

```
Regular function → gets its OWN "this", freshly determined by the call site every time it's called.
Arrow function   → has NO "this" of its own; permanently uses whatever "this" was
                    in the enclosing scope at the moment it was DEFINED (lexical, like a normal variable).
```

This is precisely why arrow functions are the standard choice for callbacks nested inside object methods — they preserve the outer `this` automatically, with no extra work.

---

## 8. call, apply, and bind

These three methods let you explicitly control what `this` refers to inside a regular function, overriding whatever the normal call-site rules would produce.

### call — Invoke Immediately, Arguments Listed Individually

```js
function introduce(greeting, punctuation) {
  console.log(`${greeting}, I'm ${this.name}${punctuation}`);
}

const person = { name: "Alice" };

introduce.call(person, "Hello", "!"); // "Hello, I'm Alice!"
// call(thisArg, arg1, arg2, ...) — runs the function NOW, with "this" set to thisArg
```

### apply — Invoke Immediately, Arguments as an Array

```js
introduce.apply(person, ["Hi", "?"]); // "Hi, I'm Alice?"
// apply(thisArg, [argsArray]) — identical to call, but arguments come as a single array
```

### bind — Returns a New Function, Does NOT Invoke Immediately

```js
const introduceAsAlice = introduce.bind(person, "Hey");
introduceAsAlice("!!!"); // "Hey, I'm Alice!!!" — "this" permanently locked to "person",
                          // "greeting" permanently locked to "Hey", only "punctuation" still open

console.log(typeof introduceAsAlice); // "function" — bind returns a NEW function, doesn't call it
```

### Field-by-Field Breakdown

```
call(thisArg, a, b, c)     → runs NOW,        this = thisArg,  args passed individually
apply(thisArg, [a, b, c])  → runs NOW,        this = thisArg,  args passed as ONE array
bind(thisArg, a, b)        → returns a NEW function, permanently bound,
                              call it later with any additional arguments
```

### The Classic bind Fix for Lost this

```js
const timerBound = {
  seconds: 0,
  start() {
    setInterval(function () {
      this.seconds++;
      console.log(this.seconds);
    }.bind(this), 1000);   // .bind(this) locks "this" to timerBound BEFORE setInterval calls it
  }
};
// timerBound.start() correctly logs 1, 2, 3, 4, ... — same fix as the arrow function version, done manually
```

---

## 9. IIFE (Immediately Invoked Function Expression)

An IIFE is a function that is defined and executed in the same expression, creating an isolated scope that doesn't leak variables into the surrounding code.

```js
(function () {
  const secret = "hidden from outside";
  console.log("IIFE ran:", secret);
})();

// console.log(secret); // ✗ ReferenceError — "secret" never escaped the IIFE's scope
```

### Field-by-Field Breakdown

```
(function () { ... })();
 │                    │└── second pair of parens — CALLS the function immediately
 │                    └── first pair of parens — wraps the function expression so
 │                        the engine parses it as an EXPRESSION, not a declaration
 └── the function itself, anonymous, never assigned to a named variable
```

### Why IIFEs Were Historically Important

Before `let`/`const` gave us real block scoping, and before ES6 modules gave us real file-level isolation, `var` was the only option and it leaked everywhere. IIFEs were the standard trick to fake a private scope:

```js
var myModule = (function () {
  let privateCounter = 0;   // hidden from the outside world

  return {
    increment() {
      privateCounter++;
      return privateCounter;
    }
  };
})();

console.log(myModule.increment()); // 1
console.log(myModule.increment()); // 2
console.log(myModule.privateCounter); // undefined — truly private
```

In modern JavaScript, ES6 modules (Lesson 3 of this phase) and block-scoped `let`/`const` have replaced most historical uses of IIFEs, but you will still encounter them in older codebases, in some bundler-generated output, and occasionally for one-off scope isolation in scripts loaded directly via a `<script>` tag.

---

## 10. Hands-On Exercises

**Exercise 1:** Write `makeMultiplier(factor)` that returns a function multiplying its argument by `factor`. Create `double = makeMultiplier(2)` and `triple = makeMultiplier(3)`, and confirm they behave independently — calling `double` never affects `triple`. Add a comment explaining, in terms of closures, why each returned function "remembers" its own `factor`.

**Exercise 2:** Extend the `createCounter` example from this lesson to add a `reset()` method that sets the private `count` back to 0, and a `step` parameter to `createCounter(step = 1)` so `increment()` adds `step` instead of always 1. Create two counters with different steps and confirm they don't interfere.

**Exercise 3:** Implement `memoize(fn)` yourself from scratch (without looking at this lesson's version) for a `slowFib(n)` naive recursive Fibonacci function. Time the first call to `memoizedFib(30)` versus the second identical call using `console.time`/`console.timeEnd`, and confirm the cached call is dramatically faster.

**Exercise 4:** Create an object with a method that uses a regular `function` inside `setTimeout` and observe `this` becoming `undefined`/global. Fix it three different ways: (a) storing `const self = this;` before the callback and using `self` instead of `this`, (b) using `.bind(this)` on the callback, (c) replacing the callback with an arrow function. Confirm all three produce the correct result.

**Exercise 5:** Write a function `introduce(greeting)` that logs `` `${greeting}, I'm ${this.name}` ``. Create two objects with different `name` properties. Call `introduce` on the first object using `.call()`, on the second using `.apply()`, and create a permanently bound version for the first object using `.bind()` and call it separately. Confirm all three produce the expected `this`.

---

## 11. Interview Q&A

**Q: What is a closure, and why does it exist as a consequence of lexical scope?**
Answer: A closure is formed when a function retains access to variables from its enclosing lexical scope even after the outer function that defined those variables has finished executing and its execution context has been popped off the call stack. This happens because JavaScript resolves variables lexically — based on where a function is written in the source, not where it's called — so when an inner function references an outer variable, the JavaScript engine keeps that variable alive in memory for as long as the inner function itself exists, rather than destroying it the moment the outer function returns. Closures aren't a special separate feature bolted onto the language; they're the natural, inevitable result of combining first-class functions (functions that can be returned and passed around) with lexical scoping.

**Q: How would you use a closure to implement private state, and why can't you achieve the same thing with a plain object property?**
Answer: You implement private state by declaring a variable inside an outer function and returning an inner function (or object of functions) that references that variable — since the variable is never directly exposed, and only accessible through the specific functions you chose to return, no outside code can read or modify it except through the interface you've deliberately provided, exactly like the `createCounter` pattern where `count` can only change via `increment()`/`decrement()`. A plain object property (`{ count: 0 }`) doesn't achieve this because any code with a reference to the object can freely read or overwrite `obj.count` directly — there's no enforcement boundary. Before native private class fields (`#field`) were added to JavaScript, closures were the only reliable mechanism for genuinely hiding data from external mutation.

**Q: How is `this` determined differently in a regular function versus an arrow function?**
Answer: In a regular function, `this` is dynamic — it's determined entirely by how the function is invoked at the call site, specifically by what object (if any) appears immediately to the left of the dot; the same function can have a completely different `this` on each call depending on whether it's called as `obj.method()`, as a detached `fn()`, or via `call`/`apply`/`bind`. An arrow function has no `this` of its own at all — it doesn't create a new binding when defined or called, and instead looks up `this` exactly like it would look up any other variable through the lexical scope chain, permanently inheriting whatever `this` was active in the nearest enclosing regular function (or the global scope) at the moment the arrow function was written in the source code. This is why arrow functions are the standard fix for the classic "`this` becomes `undefined` inside a callback" bug — since they don't create their own `this`, they simply keep using the surrounding method's `this`.

**Q: What is the difference between `call`, `apply`, and `bind`?**
Answer: All three let you explicitly control what `this` refers to inside a function call, overriding the normal call-site-based rules, but they differ in when the function executes and how arguments are passed. `call(thisArg, arg1, arg2, ...)` invokes the function immediately, with `this` set to `thisArg` and the remaining arguments passed individually, one after another. `apply(thisArg, [argsArray])` also invokes the function immediately with the same `this`-binding behavior, but expects all the arguments bundled into a single array instead of listed separately — useful when you already have an array of arguments rather than discrete values. `bind(thisArg, arg1, ...)` is different from the other two in that it does not call the function at all — it returns a brand-new function with `this` permanently locked to `thisArg` (and optionally some arguments pre-filled), which you can then invoke at any later point, as many times as you like, always with that same fixed `this`.

**Q: What is an IIFE, and what problem was it originally designed to solve?**
Answer: An Immediately Invoked Function Expression is a function that is both defined and executed in a single expression — typically written as `(function() { ... })()` — which creates its own isolated function scope that variables inside it cannot escape from. Before ES6 introduced block-scoped `let`/`const` and native ES modules, `var` was the only variable declaration available and it leaked into the global or enclosing function scope, meaning every script loaded on a page shared one giant global namespace, risking name collisions between unrelated scripts or libraries. Developers used IIFEs to manually create a private, isolated scope — anything declared inside the IIFE stayed contained, and only whatever was deliberately returned (often assigned to a single global variable representing the "module") was exposed to the outside world, effectively simulating the module isolation that modern JavaScript now provides natively through ES6 modules.
