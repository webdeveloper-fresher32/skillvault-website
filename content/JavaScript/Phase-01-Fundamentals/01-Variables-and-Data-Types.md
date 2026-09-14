# Variables and Data Types — Complete Guide

## Table of Contents
1. [Why Variables Matter](#1-why-variables-matter)
2. [var, let, and const](#2-var-let-and-const)
3. [Scoping Rules](#3-scoping-rules)
4. [Primitive Types](#4-primitive-types)
5. [typeof Operator](#5-typeof-operator)
6. [Type Coercion Basics](#6-type-coercion-basics)
7. [Template Literals](#7-template-literals)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Variables Matter

A **variable** is a named container for a value that your program can read and change over time. Without variables, every program would be a single line of literal values with no way to remember, compare, or reuse data. JavaScript gives you three keywords to create variables — `var`, `let`, and `const` — and choosing the right one affects where the variable is visible, whether it can be reassigned, and how subtle bugs do or don't creep into your code.

```js
let score = 0;       // a variable named "score", holding the number 0
score = score + 10;  // reassign it — now score holds 10
console.log(score);  // 10
```

---

## 2. var, let, and const

### The Three Keywords

```
var    → function-scoped, can be redeclared, can be reassigned, hoisted with "undefined"
let    → block-scoped, cannot be redeclared in the same scope, can be reassigned
const  → block-scoped, cannot be redeclared, cannot be reassigned (binding is frozen, not the value)
```

### var — The Old Way (Avoid in Modern Code)

```js
var name = "Alice";
var name = "Bob";     // no error — var allows redeclaration
console.log(name);    // "Bob"

var age = 25;
age = 26;              // reassignment is fine
```

`var` predates ES6 (2015). It is function-scoped, not block-scoped, which leads to bugs where a variable "leaks" out of an `if` block or a loop. Modern JavaScript style guides recommend never using `var` in new code.

### let — Reassignable, Block-Scoped

```js
let city = "Sydney";
city = "Melbourne";    // fine — let allows reassignment
console.log(city);     // "Melbourne"

let city = "Perth";    // SyntaxError: Identifier 'city' has already been declared
```

Use `let` when you know the variable's value needs to change later — a loop counter, a running total, a value that gets updated after an API call.

### const — Reassignment Forbidden

```js
const PI = 3.14159;
PI = 3.14;             // TypeError: Assignment to constant variable.

const user = { name: "Alice" };
user.name = "Bob";     // ✓ allowed — we're mutating the object, not reassigning "user"
user = {};              // ✗ TypeError — this would reassign the binding itself
```

### Field-by-Field Breakdown: const with Objects

```
const user = { name: "Alice" };
  ↳ "user" is a binding that permanently points at one specific object in memory.

user.name = "Bob";
  ↳ We're not touching the binding. We're reaching INTO the object and
    changing one of its properties. The binding "user" still points at
    the same object — so this is legal.

user = {};
  ↳ This tries to make "user" point at a DIFFERENT object entirely.
    That's a reassignment of the binding, which const forbids.
```

`const` protects the *binding*, not the *contents*. If you need a value that truly never changes (including its contents), use `Object.freeze()` — covered in Phase 2.

### Which One Should You Use?

```
Default choice: const
  ↳ Signals to every reader "this value will not be reassigned."
  ↳ Prevents accidental reassignment bugs.

Use let only when you know reassignment is coming:
  ↳ Loop counters (let i = 0; i < 10; i++)
  ↳ Accumulators (let total = 0; total += price;)
  ↳ Values reassigned after a conditional or async operation

Avoid var entirely in new code:
  ↳ Function-scoping instead of block-scoping causes subtle bugs.
  ↳ Hoisting behavior (see Phase 3) is confusing and error-prone.
```

---

## 3. Scoping Rules

**Scope** determines where in your code a variable is visible and usable.

```
Global scope    → declared outside any function or block; visible everywhere
Function scope  → var is visible anywhere inside the function it's declared in
Block scope     → let/const are visible only inside the { } block they're declared in
```

### var Leaks Out of Blocks

```js
if (true) {
  var leaked = "I'm visible outside this block";
}
console.log(leaked); // "I'm visible outside this block" — var ignored the { } boundary

if (true) {
  let contained = "I'm only visible inside this block";
}
console.log(contained); // ReferenceError: contained is not defined
```

### ASCII Diagram: Block Scope vs Function Scope

```
function outer() {
  var functionScoped = "visible anywhere in outer()";

  if (true) {
    let blockScoped = "visible only inside this if-block";
    var stillFunctionScoped = "visible anywhere in outer() — var ignores blocks";
    console.log(functionScoped);      // ✓ visible
    console.log(blockScoped);         // ✓ visible (we're inside its block)
  }

  console.log(functionScoped);        // ✓ visible
  console.log(stillFunctionScoped);   // ✓ visible — var "leaked" out of the if-block
  console.log(blockScoped);           // ✗ ReferenceError — outside its block
}
```

### The Classic Loop Bug

```js
// var — all three callbacks share ONE "i", which is 3 by the time they run
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// Output: 3, 3, 3

// let — each loop iteration gets its OWN "i"
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// Output: 0, 1, 2
```

This is one of the most commonly asked JavaScript interview questions, and the fix — switching `var` to `let` — is a direct, practical consequence of block scoping.

---

## 4. Primitive Types

JavaScript has seven primitive types. A primitive is an immutable value that is not an object and has no methods of its own (though JavaScript temporarily "boxes" primitives to let you call methods like `"hi".toUpperCase()`).

```
1. string     "hello", 'hello', `hello`
2. number     42, 3.14, -7, Infinity, NaN
3. boolean    true, false
4. null       intentional absence of a value (must be explicitly assigned)
5. undefined  a variable that has been declared but not assigned
6. symbol     a unique, immutable identifier (ES6)
7. bigint     integers larger than Number.MAX_SAFE_INTEGER (ES2020)
```

### string

```js
let first = "double quotes";
let second = 'single quotes';
let third = `backticks — also enable template literals`;
```

### number

JavaScript has only one numeric type — there is no separate "integer" type. All numbers are 64-bit floating point (IEEE 754).

```js
let count = 42;
let price = 19.99;
let negative = -7;
let big = Infinity;
let notANumber = NaN;          // "Not a Number" — result of invalid math

console.log(typeof NaN);       // "number" — NaN is technically a number!
console.log(NaN === NaN);      // false — NaN is never equal to itself
console.log(Number.isNaN(NaN)); // true — the correct way to check for NaN
```

### boolean

```js
let isActive = true;
let isComplete = false;
```

### null vs undefined

```js
let a;
console.log(a);          // undefined — declared, never assigned

let b = null;
console.log(b);          // null — explicitly assigned "no value"

console.log(typeof undefined); // "undefined"
console.log(typeof null);      // "object" — a famous, long-standing JS bug (kept for backward compatibility)

console.log(null == undefined);  // true  — loose equality treats them as equivalent
console.log(null === undefined); // false — strict equality checks type too
```

### symbol

```js
const id1 = Symbol("id");
const id2 = Symbol("id");
console.log(id1 === id2);  // false — every symbol is unique, even with the same description

// Common use: unique object property keys that won't collide with other code
const user = {
  name: "Alice",
  [id1]: "hidden-unique-key"
};
```

### bigint

```js
const max = Number.MAX_SAFE_INTEGER;
console.log(max);            // 9007199254740991

const big = 9007199254740995n; // "n" suffix creates a BigInt
console.log(typeof big);       // "bigint"
console.log(big + 10n);        // 9007199254740995n + 10n — must mix BigInt with BigInt, not Number
```

---

## 5. typeof Operator

`typeof` returns a string describing the type of its operand.

```js
console.log(typeof "hello");     // "string"
console.log(typeof 42);          // "number"
console.log(typeof true);        // "boolean"
console.log(typeof undefined);   // "undefined"
console.log(typeof null);        // "object"  ← the famous quirk
console.log(typeof Symbol());    // "symbol"
console.log(typeof 10n);         // "bigint"
console.log(typeof {});          // "object"
console.log(typeof []);          // "object"  ← arrays are objects
console.log(typeof function(){}); // "function"
```

```
typeof quirks worth memorizing:

  typeof null         → "object"     (bug from JS's original 1995 implementation)
  typeof []            → "object"     (use Array.isArray() to detect arrays)
  typeof NaN           → "number"     (NaN is a special numeric value)
  typeof function(){}  → "function"   (functions are callable objects, but typeof special-cases them)
```

---

## 6. Type Coercion Basics

JavaScript is **dynamically typed** and will automatically convert values between types in many expressions — this is called **type coercion**. Understanding it prevents a large class of bugs.

### String Coercion with +

```js
console.log("5" + 3);      // "53"  — number 3 is coerced to string, then concatenated
console.log("5" + 3 + 1);  // "531" — left to right: "5"+3="53", then "53"+1="531"
console.log(5 + 3 + "1");  // "81"  — 5+3=8 (both numbers) first, then 8+"1"="81"
```

### Numeric Coercion with -, *, /

```js
console.log("5" - 3);      // 2   — "-" only means subtraction, so "5" is coerced to number
console.log("5" * "2");    // 10  — both coerced to numbers
console.log("10" / "2");   // 5
console.log("abc" - 1);    // NaN — "abc" cannot be coerced to a number
```

### Boolean Coercion (Truthy / Falsy)

```
Falsy values (there are only 8):
  false, 0, -0, 0n, "", null, undefined, NaN

Everything else is truthy, including:
  "0"        (non-empty string, even though it looks like zero)
  "false"    (non-empty string)
  []         (empty array — truthy!)
  {}         (empty object — truthy!)
```

```js
if ("") console.log("truthy");       // does not run — "" is falsy
if ("0") console.log("truthy");      // runs — "0" is a non-empty string, truthy
if ([]) console.log("truthy");       // runs — empty array is truthy
if (0) console.log("truthy");        // does not run — 0 is falsy
```

### == vs === (Preview — Full Detail in Lesson 2)

```js
console.log(0 == "0");     // true  — "==" coerces types before comparing
console.log(0 === "0");    // false — "===" checks type AND value, no coercion

console.log("" == 0);      // true  — both coerce to 0
console.log(null == undefined); // true — special-cased as loosely equal
console.log(null === undefined); // false
```

---

## 7. Template Literals

Template literals use backticks (`` ` ``) instead of quotes and support embedded expressions and multi-line strings without escape characters.

```js
const name = "Alice";
const age = 30;

// Old way — string concatenation
const oldGreeting = "Hello, " + name + "! You are " + age + " years old.";

// New way — template literal
const newGreeting = `Hello, ${name}! You are ${age} years old.`;

console.log(newGreeting); // "Hello, Alice! You are 30 years old."
```

### Field-by-Field Breakdown

```
`Hello, ${name}! You are ${age} years old.`
 ↳ Backticks replace quotes.

${name}
 ↳ Anything inside ${ } is a JavaScript expression, evaluated and
   converted to a string, then inserted in place.

${age + 1}
 ↳ You can put any expression inside — not just variable names.
```

### Multi-Line Strings

```js
// Old way — needed \n manually
const oldMultiline = "Line one\nLine two\nLine three";

// New way — actual line breaks are preserved
const newMultiline = `Line one
Line two
Line three`;
```

### Expressions Inside Template Literals

```js
const price = 19.99;
const quantity = 3;

console.log(`Total: $${(price * quantity).toFixed(2)}`);
// "Total: $59.97"

const isMember = true;
console.log(`Status: ${isMember ? "Member" : "Guest"}`);
// "Status: Member"
```

---

## 8. Hands-On Exercises

**Exercise 1:** Open a JS console (browser DevTools or Node REPL) and declare three variables using `var`, `let`, and `const` respectively, each holding your name as a string. Try reassigning each one to a different string and observe which succeed and which throw errors. Then try re-declaring each with the same keyword in the same scope (e.g. `let x = 1; let x = 2;`) and note which throw `SyntaxError`.

**Exercise 2:** Write a function that demonstrates the `var` loop bug. Use a `for` loop with `var i` and three `setTimeout` calls logging `i` after 0ms — observe that all three log the same final value. Then change `var` to `let` and observe that each logs its own iteration's value. Write a one-paragraph explanation of why this happens, referencing block scope.

**Exercise 3:** Create a variable for each of the seven primitive types (`string`, `number`, `boolean`, `null`, `undefined`, `symbol`, `bigint`) and run `typeof` on each one. Write down the actual output next to your prediction — pay special attention to `typeof null` and explain why it doesn't say `"null"`.

**Exercise 4:** Predict the output of the following five expressions before running them, then run each one and compare: `"5" + 3`, `"5" - 3`, `"5" + 3 + 1`, `5 + 3 + "1"`, `[] + []`, `[] + {}`. For any prediction you got wrong, write one sentence explaining the coercion rule you missed.

**Exercise 5:** Rewrite the following string-concatenation code using a template literal: `const msg = "Dear " + user + ", your order #" + orderId + " totaling $" + total.toFixed(2) + " has shipped.";`. Then extend it to a multi-line template literal that also conditionally appends `"(Express Shipping)"` if a boolean `isExpress` is true, using a ternary inside the `${}`.

---

## 9. Interview Q&A

**Q: What are the differences between `var`, `let`, and `const`?**
Answer: `var` is function-scoped, can be redeclared and reassigned, and is hoisted with an initial value of `undefined`, which means it can be referenced (as `undefined`) before its declaration line runs. `let` and `const` are both block-scoped, meaning they only exist within the nearest enclosing `{ }`, and neither can be redeclared in the same scope. The difference between `let` and `const` is reassignment: `let` allows the variable to be reassigned later, while `const` creates a binding that can never be reassigned after its initial value is set. Importantly, `const` only protects the binding, not the contents of an object or array — you can still mutate properties of a `const` object, you just can't make the `const` variable point at a different object entirely.

**Q: Why is `typeof null` equal to `"object"` when `null` is not an object?**
Answer: This is a bug baked into JavaScript's very first implementation in 1995. Internally, JavaScript values were represented with a type tag, and objects had the type tag `0`. `null` was represented as the null pointer (`0x00`), which happened to share that same type tag, so `typeof` reported it as `"object"`. By the time this was recognized as a mistake, so much code depended on the existing behavior that fixing it would have broken the web, so it was never corrected — it's now permanently part of the language specification for backward compatibility. The practical takeaway is that you should never rely on `typeof` to check for `null`; instead compare directly with `value === null`.

**Q: What is type coercion, and can you give an example where it produces a non-obvious result?**
Answer: Type coercion is JavaScript's automatic conversion of a value from one type to another when an operator or context expects a different type. A classic non-obvious example is `[] + []`, which evaluates to `""` (empty string) — both arrays are coerced to strings via their `toString()` method (which produces `""` for an empty array), and then the `+` operator concatenates two empty strings. An even more surprising one is `[] + {}`, which evaluates to `"[object Object]"` — the array becomes `""` and the object becomes `"[object Object]"`, concatenated together. These examples show why relying on implicit coercion in production code is risky, and why many teams enforce explicit conversions (`String(x)`, `Number(x)`) and strict equality (`===`) instead.

**Q: What are truthy and falsy values in JavaScript?**
Answer: Every value in JavaScript is truthy or falsy when evaluated in a boolean context, such as an `if` condition. There are exactly eight falsy values: `false`, `0`, `-0`, `0n` (BigInt zero), `""` (empty string), `null`, `undefined`, and `NaN`. Every other value is truthy — critically, this includes `"0"` (a non-empty string), an empty array `[]`, and an empty object `{}`, all of which are truthy despite intuitively seeming "empty" or "falsy." This trips up developers who write `if (someArray)` expecting it to check for an empty array — an empty array is still truthy, so you need `if (someArray.length > 0)` to actually test emptiness.

**Q: What's the practical difference between `null` and `undefined`?**
Answer: `undefined` is what JavaScript assigns automatically — a declared but unassigned variable, a missing function argument, or a non-existent object property all evaluate to `undefined`. `null` is a value a developer assigns deliberately to represent "no value" or "empty" on purpose. The convention in well-written code is that you should never manually assign `undefined` — let JavaScript use it to mean "this hasn't been set yet" — and use `null` when you want to explicitly signal the intentional absence of a value, such as resetting a `user` object to `null` after logout. They are loosely equal (`null == undefined` is `true`) but not strictly equal (`null === undefined` is `false`), because `==` treats them as an equivalence class while `===` also compares their distinct types.
