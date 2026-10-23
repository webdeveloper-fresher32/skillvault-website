# Operators and Control Flow — Complete Guide

## Table of Contents
1. [Arithmetic Operators](#1-arithmetic-operators)
2. [Comparison Operators](#2-comparison-operators)
3. [== vs === in Depth](#3--vs--in-depth)
4. [Logical Operators](#4-logical-operators)
5. [if / else](#5-if--else)
6. [switch](#6-switch)
7. [Ternary Operator](#7-ternary-operator)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Arithmetic Operators

```js
console.log(10 + 3);   // 13  addition
console.log(10 - 3);   // 7   subtraction
console.log(10 * 3);   // 30  multiplication
console.log(10 / 3);   // 3.3333333333333335  division
console.log(10 % 3);   // 1   remainder (modulo)
console.log(10 ** 3);  // 1000 exponentiation (10 to the power of 3)

let count = 5;
count++;               // post-increment: count is now 6
count--;                // post-decrement: count is now 5
count += 10;            // count is now 15  (shorthand for count = count + 10)
count -= 5;             // count is now 10
count *= 2;             // count is now 20
count /= 4;             // count is now 5
```

### Modulo Is More Useful Than It Looks

```js
// Check if a number is even or odd
function isEven(n) {
  return n % 2 === 0;
}
console.log(isEven(4)); // true
console.log(isEven(7)); // false

// Wrap an index around the length of an array (circular indexing)
const days = ["Mon", "Tue", "Wed"];
console.log(days[5 % days.length]); // days[2] = "Wed"
```

### Pre vs Post Increment

```js
let a = 5;
console.log(a++); // 5 — logs the OLD value, THEN increments
console.log(a);   // 6

let b = 5;
console.log(++b); // 6 — increments FIRST, then logs the NEW value
console.log(b);   // 6
```

---

## 2. Comparison Operators

```js
console.log(5 > 3);    // true
console.log(5 < 3);    // false
console.log(5 >= 5);   // true
console.log(5 <= 4);   // false
console.log(5 == "5"); // true  — loose equality, coerces types
console.log(5 === "5"); // false — strict equality, no coercion
console.log(5 != "5");  // false — loose inequality
console.log(5 !== "5"); // true  — strict inequality
```

---

## 3. == vs === in Depth

This is one of the most important distinctions in JavaScript and a near-guaranteed interview topic.

```
==  (loose equality)
  ↳ Coerces both operands to the same type before comparing.
  ↳ Follows a complex set of coercion rules (the "Abstract Equality Comparison Algorithm").
  ↳ Produces surprising results in edge cases.

=== (strict equality)
  ↳ Compares both type AND value.
  ↳ No coercion — if types differ, the result is immediately false.
  ↳ Predictable, recommended for all production code.
```

### Surprising == Results

```js
console.log(1 == "1");      // true  — string coerced to number
console.log(1 == true);     // true  — boolean coerced to number (true → 1)
console.log(0 == false);    // true  — false coerced to number (false → 0)
console.log(0 == "");       // true  — empty string coerced to number (0)
console.log(0 == "0");      // true  — "0" coerced to number (0)
console.log("" == "0");     // false — both strings, compared directly, not equal
console.log(null == undefined); // true — special case in the spec
console.log(null == 0);     // false — null only loosely equals undefined, nothing else
console.log(NaN == NaN);    // false — NaN is never equal to anything, including itself
```

### The Same Comparisons with ===

```js
console.log(1 === "1");     // false — different types, no coercion attempted
console.log(1 === true);    // false
console.log(0 === false);   // false
console.log(null === undefined); // false — different types
```

### The Rule of Thumb

```
Always use === and !== in application code.

Only use == in one specific idiom, if at all:
  if (value == null) { ... }
  ↳ This matches BOTH null and undefined in one check,
    because null == undefined is true and nothing else
    loosely equals null. Some style guides permit this
    single exception; most codebases still prefer explicit
    (value === null || value === undefined).
```

---

## 4. Logical Operators

```js
console.log(true && false);   // false — AND: both must be true
console.log(true || false);   // true  — OR: at least one must be true
console.log(!true);           // false — NOT: inverts the boolean
```

### Short-Circuit Evaluation

`&&` and `||` don't just return `true`/`false` — they return one of their actual operands, which makes them useful beyond simple boolean logic.

```js
// && returns the first falsy value, or the last value if all are truthy
console.log("hello" && "world");  // "world" — both truthy, returns the last one
console.log("" && "world");       // ""      — short-circuits at the first falsy value
console.log(0 && "anything");     // 0       — stops immediately, "anything" never evaluated

// || returns the first truthy value, or the last value if all are falsy
console.log("" || "default");     // "default" — "" is falsy, falls through
console.log("value" || "default"); // "value"  — short-circuits, "default" never evaluated
console.log(null || undefined || "fallback"); // "fallback"
```

### Practical Pattern: Default Values

```js
function greet(name) {
  const safeName = name || "Guest";   // if name is falsy (undefined, "", null), use "Guest"
  console.log(`Hello, ${safeName}!`);
}
greet("Alice"); // "Hello, Alice!"
greet();        // "Hello, Guest!"
greet("");      // "Hello, Guest!"  ← note: this may be unintended if "" is a valid name!
```

### Nullish Coalescing (??) — The Safer Alternative

```js
// ?? only falls back on null or undefined, NOT on other falsy values like "" or 0
console.log("" ?? "default");   // ""       — "" is not null/undefined, kept as-is
console.log(0 ?? "default");    // 0        — 0 is not null/undefined, kept as-is
console.log(null ?? "default"); // "default"
console.log(undefined ?? "default"); // "default"
```

### Guard Pattern with &&

```js
const user = { name: "Alice", isAdmin: true };

// Only run the right-hand side if the left-hand side is truthy
user.isAdmin && console.log("Welcome, admin!");

// Common in optional access before optional chaining existed
user.profile && console.log(user.profile.bio);
```

---

## 5. if / else

```js
const age = 20;

if (age >= 18) {
  console.log("Adult");
} else if (age >= 13) {
  console.log("Teenager");
} else {
  console.log("Child");
}
```

### Field-by-Field Breakdown

```
if (age >= 18) { ... }
  ↳ Condition is evaluated. If truthy, this block runs and the rest is skipped.

else if (age >= 13) { ... }
  ↳ Only checked if the first condition was falsy.
    Can chain as many else-if blocks as needed.

else { ... }
  ↳ Runs only if every preceding condition was falsy. Optional.
```

### Nested Conditions vs Combined Conditions

```js
// Nested — harder to read as conditions grow
if (isLoggedIn) {
  if (isAdmin) {
    console.log("Admin dashboard");
  }
}

// Combined with && — flatter, usually preferred
if (isLoggedIn && isAdmin) {
  console.log("Admin dashboard");
}
```

---

## 6. switch

`switch` compares one value against multiple possible cases using strict equality (`===`).

```js
const day = "Tue";

switch (day) {
  case "Mon":
    console.log("Start of the week");
    break;
  case "Tue":
  case "Wed":
  case "Thu":
    console.log("Midweek");
    break;
  case "Fri":
    console.log("Almost the weekend");
    break;
  default:
    console.log("Weekend");
}
// Output: "Midweek"
```

### Field-by-Field Breakdown

```
switch (day)
  ↳ The expression being tested. Compared to each case using === (strict).

case "Mon":
  ↳ If day === "Mon", execution starts here and falls through
    to every subsequent line until a break or the end of the switch.

break;
  ↳ Exits the switch block immediately. Forgetting break is
    a classic bug — execution "falls through" into the next case.

case "Tue":
case "Wed":
case "Thu":
  ↳ Stacking cases with no code between them and no break
    is an intentional pattern — it groups multiple values
    to share one block of code ("Midweek" for all three days).

default:
  ↳ Runs if no case matched. Optional, but good practice to include.
    Does not need to be the last case, but conventionally is.
```

### The Fall-Through Bug

```js
const grade = "B";

switch (grade) {
  case "A":
    console.log("Excellent");
  case "B":                     // no break above! falls through
    console.log("Good");
  case "C":                     // no break here either!
    console.log("Pass");
    break;
  default:
    console.log("Fail");
}
// Output: "Good" then "Pass" — both print because "break" was missing after case "B"
```

---

## 7. Ternary Operator

The ternary is a compact one-line `if/else` that returns a value, making it useful for assignments and JSX/template expressions.

```js
const age = 20;
const status = age >= 18 ? "adult" : "minor";
console.log(status); // "adult"

// Field-by-field:
// condition ? valueIfTrue : valueIfFalse
```

### Chaining Ternaries (Use Sparingly)

```js
const score = 75;
const grade = score >= 90 ? "A"
            : score >= 80 ? "B"
            : score >= 70 ? "C"
            : "F";
console.log(grade); // "C"
```

Chained ternaries are powerful but hurt readability past two or three branches — beyond that, an `if/else if` chain or a lookup table is usually clearer.

### Ternary vs if/else — When to Use Which

```
Use a ternary when:
  - You need to produce a VALUE (assignment, return, template literal)
  - There are exactly two outcomes
  - The expressions on both sides are short

Use if/else when:
  - You need to run multiple statements per branch
  - The logic doesn't return a value, it performs an action
  - There are more than two or three logical branches
```

---

## 8. Hands-On Exercises

**Exercise 1:** Write a function `remainder(a, b)` that returns `a % b`, and use it to write a `isDivisibleBy(num, divisor)` function returning `true`/`false`. Test it with `isDivisibleBy(15, 3)` and `isDivisibleBy(15, 4)`.

**Exercise 2:** Create a list of ten `==` comparisons involving mixed types (numbers, strings, booleans, `null`, `undefined`, `NaN`) — predict each result on paper first, then run them in a console and mark which predictions were correct. Rewrite the same ten comparisons using `===` and note which ones change result.

**Exercise 3:** Write a function `describeTemperature(celsius)` using `if/else if/else` that returns `"freezing"` for ≤ 0, `"cold"` for 1–15, `"mild"` for 16–25, and `"hot"` for above 25. Then rewrite the exact same logic as a chained ternary expression, and as a `switch` statement using a helper that buckets the temperature into a category string first (since `switch` needs discrete values, not ranges).

**Exercise 4:** Write a `switch` statement over a `dayNumber` (1–7) that logs the day name, intentionally omitting one `break` statement to observe fall-through behavior, then fix it and confirm the correct output.

**Exercise 5:** Write a function `getDiscount(user)` where `user` may or may not have a `discountCode` property. Use `||` to default to `"NONE"` if missing, run it against `{ discountCode: "" }` and observe the (likely unintended) result, then rewrite using `??` and explain in a comment why the result differs for the empty-string case.

---

## 9. Interview Q&A

**Q: What is the difference between `==` and `===`, and which should you use in production code?**
Answer: `==` (loose equality) coerces both operands to a common type before comparing them, following the Abstract Equality Comparison Algorithm defined in the ECMAScript spec — this produces surprising results like `0 == "0"` being `true` or `1 == true` being `true`. `===` (strict equality) compares both the type and the value with no coercion, so operands of different types are immediately `false`, no matter their values. Production code should use `===` almost universally, because it is predictable and self-documenting — the one common exception some style guides allow is `value == null`, which conveniently matches both `null` and `undefined` in a single check, since `null == undefined` is `true` and nothing else loosely equals `null`.

**Q: How do short-circuit operators `&&` and `||` actually work, and how are they used beyond boolean logic?**
Answer: `&&` evaluates its left operand; if it's falsy, it returns that value immediately without evaluating the right operand at all (`0 && expensiveCall()` never calls `expensiveCall`). If the left operand is truthy, it evaluates and returns the right operand. `||` works the opposite way — it returns the left operand if it's truthy, short-circuiting before evaluating the right side, and only evaluates and returns the right operand if the left one is falsy. Because they return actual values rather than a coerced boolean, they're commonly used for default values (`const name = input || "Guest"`) and conditional execution guards (`isLoggedIn && renderDashboard()`), though `??` (nullish coalescing) is now generally preferred over `||` for defaults, since `||` incorrectly falls back on legitimate falsy values like `0` or `""`.

**Q: What is the fall-through behavior in a `switch` statement, and why is it considered both a feature and a common source of bugs?**
Answer: When a `case` block in a `switch` statement doesn't end with a `break` (or `return`), execution continues into the next `case` block regardless of whether its condition matches — this is called fall-through. It's a deliberate design that lets you group multiple case values to share one block of code by stacking empty cases (`case "Tue": case "Wed": ...`), but it becomes a bug when a developer simply forgets to add `break` at the end of a case that should have been isolated, causing unintended code from subsequent cases to execute. Because of this risk, many linters (like ESLint's `no-fallthrough` rule) flag any case without an explicit `break`, `return`, or an intentional comment marking the fall-through as deliberate.

**Q: When would you choose a ternary operator over an `if/else` statement?**
Answer: A ternary is appropriate when you need to compute and use a value inline — such as during a variable assignment, a function return, or inside a template literal — and there are exactly two possible outcomes with short expressions on each side, for example `const status = age >= 18 ? "adult" : "minor"`. An `if/else` statement is better when you need to execute multiple statements per branch, when the logic performs actions rather than producing a value (like calling several functions), or when there are more than two or three branches, since chaining many ternaries together becomes difficult to read. The general engineering guideline is: ternary for value selection, `if/else` for control flow and side effects.

**Q: Why does `NaN === NaN` evaluate to `false`, and how do you correctly check if a value is `NaN`?**
Answer: `NaN` (Not-a-Number) is defined by the IEEE 754 floating-point standard, which JavaScript's number type follows, to never be equal to any value — including itself — as a mathematical convention representing the result of an invalid or indeterminate numeric operation, such as `0/0` or `"abc" - 1`. This means both `NaN == NaN` and `NaN === NaN` return `false`, which surprises many developers expecting equality to be reflexive. The correct way to check for `NaN` is `Number.isNaN(value)`, which specifically tests whether a value is exactly `NaN`; the older global `isNaN(value)` function is less reliable because it first coerces its argument to a number, so `isNaN("hello")` returns `true` even though `"hello"` was never actually `NaN` — it just failed to convert to a valid number.
