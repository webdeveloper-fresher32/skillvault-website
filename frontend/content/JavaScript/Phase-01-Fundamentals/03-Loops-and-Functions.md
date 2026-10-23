# Loops and Functions — Complete Guide

## Table of Contents
1. [for Loop](#1-for-loop)
2. [while and do-while Loops](#2-while-and-do-while-loops)
3. [for-of Loop](#3-for-of-loop)
4. [for-in Loop](#4-for-in-loop)
5. [break and continue](#5-break-and-continue)
6. [Function Declarations](#6-function-declarations)
7. [Function Expressions](#7-function-expressions)
8. [Arrow Functions (Introduction)](#8-arrow-functions-introduction)
9. [Function Scope vs Block Scope](#9-function-scope-vs-block-scope)
10. [Parameters](#10-parameters)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. for Loop

The classic `for` loop gives you full control over initialization, condition, and increment in one line.

```js
for (let i = 0; i < 5; i++) {
  console.log(i);
}
// 0, 1, 2, 3, 4
```

### Field-by-Field Breakdown

```
for (let i = 0; i < 5; i++) { ... }
     │         │       │
     │         │       └── increment: runs AFTER each loop body execution
     │         └────────── condition: checked BEFORE every iteration; loop stops when false
     └──────────────────── initializer: runs ONCE, before the loop starts

Execution order:
  1. i = 0                 (initializer, runs once)
  2. i < 5?  true  → run body, log 0
  3. i++     → i = 1
  4. i < 5?  true  → run body, log 1
  5. i++     → i = 2
  ... repeats until i < 5 is false (i = 5), loop exits
```

### Looping Over an Array by Index

```js
const fruits = ["apple", "banana", "cherry"];
for (let i = 0; i < fruits.length; i++) {
  console.log(`${i}: ${fruits[i]}`);
}
// 0: apple
// 1: banana
// 2: cherry
```

### Nested for Loops

```js
for (let row = 1; row <= 3; row++) {
  let line = "";
  for (let col = 1; col <= 3; col++) {
    line += `(${row},${col}) `;
  }
  console.log(line);
}
// (1,1) (1,2) (1,3)
// (2,1) (2,2) (2,3)
// (3,1) (3,2) (3,3)
```

---

## 2. while and do-while Loops

### while — Checks Condition Before Running

```js
let count = 0;
while (count < 3) {
  console.log(count);
  count++;
}
// 0, 1, 2
```

Use `while` when you don't know in advance how many iterations you need — for example, reading from a stream until it ends, or retrying an operation until it succeeds.

```js
let attempts = 0;
let success = false;
while (!success && attempts < 5) {
  attempts++;
  success = tryConnect();     // pretend this sometimes returns true
}
```

### do-while — Checks Condition After Running (Guarantees at Least One Run)

```js
let n = 10;
do {
  console.log(n);
  n++;
} while (n < 5);
// 10 — runs once even though the condition (10 < 5) was already false
```

### Field-by-Field Breakdown

```
while (condition) { body }
  ↳ Condition checked FIRST. If false immediately, body never runs at all.

do { body } while (condition);
  ↳ Body runs FIRST, condition checked AFTER.
  ↳ Guarantees at least one execution, no matter the condition.
  ↳ Common use: menu loops that must show at least once before checking exit.
```

---

## 3. for-of Loop

`for-of` iterates over the **values** of any iterable — arrays, strings, Maps, Sets. It is the modern, preferred way to loop over array values when you don't need the index.

```js
const colors = ["red", "green", "blue"];
for (const color of colors) {
  console.log(color);
}
// red, green, blue

const word = "hi";
for (const char of word) {
  console.log(char);
}
// h, i

// With index, using .entries()
for (const [index, color] of colors.entries()) {
  console.log(`${index}: ${color}`);
}
// 0: red
// 1: green
// 2: blue
```

---

## 4. for-in Loop

`for-in` iterates over the **enumerable property keys** of an object. It is the wrong tool for arrays — use `for-of` or array methods there instead.

```js
const user = { name: "Alice", age: 30, city: "Sydney" };
for (const key in user) {
  console.log(`${key}: ${user[key]}`);
}
// name: Alice
// age: 30
// city: Sydney
```

### Why Not for-in on Arrays

```js
const arr = ["a", "b", "c"];
arr.customProp = "oops"; // arrays are objects — you CAN add arbitrary properties

for (const key in arr) {
  console.log(key);
}
// "0", "1", "2", "customProp"  ← includes the unwanted extra property, and keys are STRINGS not numbers

for (const value of arr) {
  console.log(value);
}
// "a", "b", "c"  ← only the actual array elements, correctly
```

```
Rule of thumb:
  for-in   → object property keys (use rarely; prefer Object.keys/values/entries, Phase 2)
  for-of   → iterable values (arrays, strings, Maps, Sets) — use this for arrays
```

---

## 5. break and continue

```js
// break — exits the loop entirely
for (let i = 0; i < 10; i++) {
  if (i === 5) break;
  console.log(i);
}
// 0, 1, 2, 3, 4  (stops entirely once i hits 5)

// continue — skips the rest of THIS iteration, moves to the next
for (let i = 0; i < 5; i++) {
  if (i === 2) continue;
  console.log(i);
}
// 0, 1, 3, 4  (2 is skipped, but the loop keeps going)
```

---

## 6. Function Declarations

```js
function add(a, b) {
  return a + b;
}
console.log(add(2, 3)); // 5
```

### Field-by-Field Breakdown

```
function add(a, b) { return a + b; }
  │        │   │           │
  │        │   │           └── return value — exits the function immediately with this value
  │        │   └── parameters — local variables that receive the arguments passed in
  │        └── function name — used to call it and shown in stack traces
  └── keyword — declares a named function
```

Function declarations are **hoisted** — the entire function (name and body) is available before its line runs in the file, so you can call it above where it's written:

```js
console.log(square(5)); // 25 — works even though square is called before its definition
function square(n) {
  return n * n;
}
```

---

## 7. Function Expressions

A function expression assigns an (often anonymous) function to a variable. Unlike declarations, function expressions are **not hoisted** with their body — only the variable declaration is hoisted (per the `var`/`let`/`const` rules from Lesson 1).

```js
const multiply = function (a, b) {
  return a * b;
};
console.log(multiply(4, 5)); // 20

// Named function expression — name is useful in stack traces / recursion
const factorial = function fact(n) {
  return n <= 1 ? 1 : n * fact(n - 1);
};
console.log(factorial(5)); // 120
```

```js
console.log(subtract(5, 2)); // TypeError: Cannot access 'subtract' before initialization
const subtract = function (a, b) {
  return a - b;
};
```

---

## 8. Arrow Functions (Introduction)

Arrow functions are a more concise syntax for function expressions, introduced in ES6. This is a first look — the deep-dive on how arrow functions handle `this` differently is in Phase 3.

```js
// Traditional function expression
const add1 = function (a, b) {
  return a + b;
};

// Arrow function — equivalent behavior, shorter syntax
const add2 = (a, b) => {
  return a + b;
};

// Arrow function with implicit return (no braces, no "return" keyword)
const add3 = (a, b) => a + b;

// Single parameter — parentheses optional
const square = n => n * n;

// No parameters — parentheses required
const greet = () => console.log("Hello!");

console.log(add1(2, 3), add2(2, 3), add3(2, 3), square(4)); // 5 5 5 16
```

### Field-by-Field Breakdown

```
const add3 = (a, b) => a + b;
              │       │  └── implicit return — no braces means the expression's
              │       │      value is automatically returned
              │       └── arrow — replaces the "function" keyword
              └── parameters — same as any function

If you use curly braces, you must use an explicit "return":
  const add4 = (a, b) => { return a + b; };   ✓ correct
  const add5 = (a, b) => { a + b; };           ✗ returns undefined — no "return" keyword
```

### Quick Comparison Table

```
function declaration   function add(a,b) { return a+b; }   hoisted, has its own "this"
function expression    const add = function(a,b){...}      not hoisted, has its own "this"
arrow function         const add = (a,b) => a+b;           not hoisted, NO own "this" (inherits from enclosing scope)
```

We'll return to arrow functions' `this`-binding behavior in detail in Phase 3, Lesson 2, once you've seen how `this` works in regular functions.

---

## 9. Function Scope vs Block Scope

```js
function demo() {
  var functionScoped = "var ignores blocks";
  let blockScoped = "let respects blocks";

  {
    console.log(functionScoped); // ✓ still visible — plain braces are still a block
    console.log(blockScoped);    // ✓ visible here, inside its own block
    var innerVar = "still function-scoped";
    let innerLet = "block-scoped to these braces only";
  }

  console.log(innerVar);  // ✓ visible — var leaked out of the inner block
  console.log(innerLet);  // ✗ ReferenceError — let stayed inside the inner block
}
```

Every function call creates a new function scope. Parameters and any `var`/`let`/`const` declared directly inside the function body are local to that call and disappear when the function returns (unless captured by a closure — Phase 3).

---

## 10. Parameters

```js
// Basic parameters
function greet(name, greeting) {
  console.log(`${greeting}, ${name}!`);
}
greet("Alice", "Hello"); // "Hello, Alice!"

// Missing arguments become undefined
greet("Bob"); // "undefined, Bob!"

// Default parameters (ES6) — used when argument is undefined or omitted
function greetWithDefault(name, greeting = "Hello") {
  console.log(`${greeting}, ${name}!`);
}
greetWithDefault("Bob"); // "Hello, Bob!"
greetWithDefault("Bob", "Hi"); // "Hi, Bob!"
greetWithDefault("Bob", undefined); // "Hello, Bob!" — undefined triggers the default
greetWithDefault("Bob", null); // "null, Bob!" — null does NOT trigger the default, it's an explicit value

// Extra arguments beyond declared parameters are simply ignored (unless using rest — Phase 2)
function onlyTwo(a, b) {
  console.log(a, b);
}
onlyTwo(1, 2, 3, 4); // logs 1 2 — the 3 and 4 are silently dropped
```

### Parameters Are Local Copies (for Primitives)

```js
function increment(num) {
  num = num + 1;
  console.log("inside:", num);
}

let value = 5;
increment(value);
console.log("outside:", value);
// inside: 6
// outside: 5   ← the original variable is untouched — primitives are passed by value
```

Objects and arrays behave differently — they are passed by reference to the underlying object, so mutating their contents inside a function is visible outside. This is covered fully in Phase 2 (Objects and Arrays).

---

## 11. Hands-On Exercises

**Exercise 1:** Write a `for` loop that prints all even numbers from 2 to 20 inclusive. Then rewrite it as a `while` loop, and again as a `do-while` loop, producing identical output all three ways.

**Exercise 2:** Given `const scores = [55, 82, 91, 40, 76];`, use `for-of` to print each score, then use a `for` loop with an index to print `"Score 1: 55"`, `"Score 2: 82"`, etc. (1-indexed). Add a `continue` so any score below 60 is skipped in the printed output, and a `break` so the loop stops entirely once a score above 90 is found.

**Exercise 3:** Given `const car = { make: "Toyota", model: "Corolla", year: 2022 };`, use `for-in` to log every key and value as `"make: Toyota"` etc. Then add `car.start = function() { return "vroom"; };` (a method) and observe that `for-in` also picks up function-valued properties — explain in a comment why this can be a footgun when iterating objects that might have methods.

**Exercise 4:** Write the same function three ways — as a function declaration, a function expression, and an arrow function — each named/assigned `isPositive` and returning whether a number is greater than zero. Then write a short comment explaining which of the three can be called before its line of code executes, and why.

**Exercise 5:** Write a function `formatPrice(amount, currency = "USD")` using a default parameter. Call it with just an amount, then with both arguments, then with `undefined` explicitly passed as the second argument (confirm the default still applies), then with `null` explicitly passed (confirm the default does NOT apply, and handle that case with an explicit check inside the function body).

---

## 12. Interview Q&A

**Q: What is the difference between `for-in` and `for-of`, and why shouldn't you use `for-in` on arrays?**
Answer: `for-in` iterates over the enumerable property *keys* of an object, while `for-of` iterates over the *values* of any iterable, such as arrays, strings, Maps, and Sets. Because JavaScript arrays are technically objects with numeric-looking string keys, `for-in` will iterate over an array's indices as strings (`"0"`, `"1"`, `"2"`) and, worse, will also pick up any additional properties added to the array object itself (like a custom method or flag attached directly to the array), which are not actual array elements. `for-of`, by contrast, correctly and exclusively iterates over the array's actual values in order, using the iterable protocol, making it the correct choice for arrays, while `for-in` remains appropriate only for plain objects where you specifically want the keys.

**Q: What's the difference between a function declaration and a function expression?**
Answer: A function declaration (`function add(a, b) { return a + b; }`) is hoisted in its entirety — both the name and the function body are available anywhere in the enclosing scope, even before the line where it's written, because the JavaScript engine registers the whole function during the compilation/hoisting phase. A function expression (`const add = function(a, b) { return a + b; }`) assigns a function to a variable, and only the variable declaration is hoisted according to the rules of `var`/`let`/`const` — the function itself is not usable until that line of code actually executes, meaning calling it earlier throws a `ReferenceError` (for `let`/`const`, due to the temporal dead zone) or returns `undefined is not a function` (for `var`). This matters practically: you can safely call a function declaration anywhere in its scope, but you can only call a function expression after its assignment has run.

**Q: How do arrow functions differ from regular functions, beyond just shorter syntax?**
Answer: Beyond the concise syntax and implicit return for single expressions, the most important difference is that arrow functions do not have their own `this` binding — they inherit `this` lexically from the enclosing scope at the time they're defined, whereas regular functions get their own `this` determined by how they're called. Arrow functions also cannot be used as constructors (you can't call `new` on one), do not have their own `arguments` object, and are never hoisted with their function body the way declarations are, since they must be assigned to a variable first. These differences make arrow functions especially useful inside callbacks and methods where you want `this` to remain tied to the surrounding context rather than being reset by the callback's own invocation — a topic covered in depth in Phase 3.

**Q: What does it mean that primitives are "passed by value" into a function, and how does that differ from objects?**
Answer: When you pass a primitive value (string, number, boolean, etc.) as a function argument, the function receives a completely independent copy of that value — any reassignment or modification to the parameter inside the function has no effect on the original variable outside, because they are two separate pieces of memory holding the same starting value. Objects and arrays behave differently: what's copied is a reference (essentially a pointer) to the same underlying object in memory, so while reassigning the parameter itself to a brand-new object won't affect the caller's variable, mutating the object's properties or array's elements through that reference absolutely does affect the original object, since both the caller and the function are looking at the exact same object in memory. This distinction — value semantics for primitives, reference semantics for mutation of objects — is a frequent source of bugs and a frequent interview question, and it's covered in more depth once objects and arrays are introduced in Phase 2.

**Q: When would you choose `while` over `for`, and what does `do-while` guarantee that `while` doesn't?**
Answer: `for` is the natural choice when you know in advance how many iterations you need, or you're iterating with a counter that has a clear start, condition, and increment, because all three pieces live together on one line. `while` is preferable when the number of iterations isn't known ahead of time and instead depends on some condition changing during the loop — such as retrying a network call until it succeeds or reading from a stream until it's exhausted. `do-while` is a variant of `while` that checks its condition *after* running the loop body instead of before, which guarantees the body executes at least once even if the condition is false from the very start; a common use case is displaying a menu or prompt that must appear at least once before checking whether the user wants to exit.
