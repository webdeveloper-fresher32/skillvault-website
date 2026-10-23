# Arrays — Complete Guide

## Table of Contents
1. [Array Creation](#1-array-creation)
2. [Indexing and Length](#2-indexing-and-length)
3. [Mutation Methods](#3-mutation-methods)
4. [Iteration Methods](#4-iteration-methods)
5. [Array vs Array-Like](#5-array-vs-array-like)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Array Creation

```js
// Array literal — the standard, idiomatic way
const fruits = ["apple", "banana", "cherry"];

// Array constructor — rarely used, has a confusing edge case
const arr1 = new Array(1, 2, 3);   // [1, 2, 3]
const arr2 = new Array(3);          // [ <3 empty items> ] — a single number argument means "length 3", NOT the value 3!

// Array.of — fixes the Array constructor's ambiguity
console.log(Array.of(3));           // [3] — always treats arguments as elements

// Array.from — builds an array from an iterable or array-like object
console.log(Array.from("hello"));   // ["h", "e", "l", "l", "o"]
console.log(Array.from({ length: 3 }, (_, i) => i * 2)); // [0, 2, 4]

// Array can hold mixed types
const mixed = [1, "two", true, null, { key: "value" }, [5, 6]];
```

---

## 2. Indexing and Length

```js
const colors = ["red", "green", "blue"];

console.log(colors[0]);        // "red"  — indexing starts at 0
console.log(colors[2]);        // "blue"
console.log(colors[colors.length - 1]); // "blue" — last element
console.log(colors[10]);       // undefined — out-of-bounds returns undefined, no error
console.log(colors.length);    // 3

colors[1] = "yellow";          // mutate an element by index
console.log(colors);           // ["red", "yellow", "blue"]

colors[5] = "purple";          // assigning beyond length extends the array
console.log(colors);           // ["red", "yellow", "blue", <2 empty items>, "purple"]
console.log(colors.length);    // 6

colors.length = 2;             // truncating length deletes trailing elements
console.log(colors);           // ["red", "yellow"]
```

### ASCII Diagram: Array Memory Layout (Conceptual)

```
  const colors = ["red", "green", "blue"];

  index:    0        1        2
           ┌────────┬────────┬────────┐
  value:   │ "red"  │"green" │ "blue" │
           └────────┴────────┴────────┘
  length: 3  (always one more than the highest index)
```

---

## 3. Mutation Methods

These methods change the original array in place.

### push / pop — End of Array

```js
const stack = [1, 2, 3];
stack.push(4);          // adds to the end, returns new length
console.log(stack);     // [1, 2, 3, 4]

const popped = stack.pop(); // removes from the end, returns the removed element
console.log(popped);    // 4
console.log(stack);     // [1, 2, 3]
```

### shift / unshift — Start of Array

```js
const queue = [1, 2, 3];
queue.unshift(0);        // adds to the start, returns new length
console.log(queue);      // [0, 1, 2, 3]

const shifted = queue.shift(); // removes from the start, returns the removed element
console.log(shifted);    // 0
console.log(queue);      // [1, 2, 3]
```

```
push/pop    → END of array    → fast, O(1) — no other elements need to shift index
shift/unshift → START of array → slow, O(n) — every remaining element's index shifts by one
```

### splice — Swiss Army Knife (Insert, Remove, Replace)

```js
const letters = ["a", "b", "c", "d", "e"];

// Remove 2 elements starting at index 1
const removed = letters.splice(1, 2);
console.log(removed);   // ["b", "c"]
console.log(letters);   // ["a", "d", "e"]

// Insert without removing (deleteCount = 0)
letters.splice(1, 0, "x", "y");
console.log(letters);   // ["a", "x", "y", "d", "e"]

// Replace elements (remove then insert in one call)
letters.splice(1, 2, "REPLACED");
console.log(letters);   // ["a", "REPLACED", "d", "e"]
```

### Field-by-Field Breakdown: splice

```
array.splice(start, deleteCount, item1, item2, ...)
              │       │            │
              │       │            └── items to insert at "start" (optional, any number)
              │       └── how many elements to remove starting at "start" (0 = insert only)
              └── index to begin at
Returns: an array of the removed elements (empty array if none removed)
Mutates: the original array, in place
```

### sort and reverse (Also Mutating!)

```js
const nums = [10, 1, 21, 2];
nums.sort();              // ⚠ default sort is LEXICOGRAPHIC (string-based), not numeric!
console.log(nums);        // [1, 10, 2, 21] — surprising!

nums.sort((a, b) => a - b); // correct numeric ascending sort
console.log(nums);        // [1, 2, 10, 21]

nums.sort((a, b) => b - a); // numeric descending sort
console.log(nums);        // [21, 10, 2, 1]

const arr = [1, 2, 3];
arr.reverse();
console.log(arr);         // [3, 2, 1] — mutates in place
```

### Non-Mutating Alternatives (Modern Best Practice)

```js
const original = [3, 1, 2];

// slice — returns a shallow copy of a portion, does NOT mutate
console.log(original.slice(0, 2)); // [3, 1]
console.log(original);              // [3, 1, 2] — unchanged

// toSorted / toReversed (ES2023) — non-mutating versions of sort/reverse
console.log(original.toSorted((a, b) => a - b)); // [1, 2, 3]
console.log(original);                             // [3, 1, 2] — unchanged

// concat — merges arrays into a new one
const merged = [1, 2].concat([3, 4]);
console.log(merged); // [1, 2, 3, 4]
```

```
Mutating methods (change the original):
  push, pop, shift, unshift, splice, sort, reverse, fill, copyWithin

Non-mutating methods (return a new array/value, leave original untouched):
  map, filter, reduce, slice, concat, find, some, every, includes,
  toSorted, toReversed, toSpliced (ES2023 non-mutating siblings)
```

---

## 4. Iteration Methods

These are the workhorses of modern JavaScript — prefer them over manual `for` loops when transforming or querying data.

### map — Transform Every Element, Return New Array (Same Length)

```js
const prices = [10, 20, 30];
const withTax = prices.map(price => price * 1.1);
console.log(withTax); // [11, 22, 33]
console.log(prices);  // [10, 20, 30] — original untouched
```

### filter — Keep Elements That Pass a Test

```js
const numbers = [1, 2, 3, 4, 5, 6];
const evens = numbers.filter(n => n % 2 === 0);
console.log(evens); // [2, 4, 6]
```

### reduce — Fold an Array Down to a Single Value

```js
const cart = [{ price: 10 }, { price: 20 }, { price: 30 }];

const total = cart.reduce((accumulator, item) => accumulator + item.price, 0);
console.log(total); // 60
```

### Field-by-Field Breakdown: reduce

```
cart.reduce((accumulator, item) => accumulator + item.price, 0)
              │              │                                │
              │              │                                └── initial value of accumulator
              │              └── current array element being processed
              └── running result carried from one call to the next

Execution trace:
  accumulator=0,  item={price:10} → returns 10
  accumulator=10, item={price:20} → returns 30
  accumulator=30, item={price:30} → returns 60
  Final result: 60
```

### More reduce Patterns

```js
// Group an array of objects by a key
const people = [
  { name: "Alice", dept: "Eng" },
  { name: "Bob", dept: "Sales" },
  { name: "Carol", dept: "Eng" }
];
const byDept = people.reduce((acc, person) => {
  (acc[person.dept] ||= []).push(person.name);
  return acc;
}, {});
console.log(byDept); // { Eng: ["Alice", "Carol"], Sales: ["Bob"] }

// Count occurrences
const votes = ["yes", "no", "yes", "yes", "no"];
const tally = votes.reduce((acc, vote) => {
  acc[vote] = (acc[vote] || 0) + 1;
  return acc;
}, {});
console.log(tally); // { yes: 3, no: 2 }
```

### find and findIndex — First Match

```js
const users = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];

const user = users.find(u => u.id === 2);
console.log(user); // { id: 2, name: "Bob" }

const index = users.findIndex(u => u.id === 2);
console.log(index); // 1

const missing = users.find(u => u.id === 99);
console.log(missing); // undefined — no match found
```

### forEach — Run a Side Effect on Every Element (No New Array)

```js
const items = ["a", "b", "c"];
items.forEach((item, index) => {
  console.log(`${index}: ${item}`);
});
// 0: a
// 1: b
// 2: c
// forEach ALWAYS returns undefined — never use it to build a new array; use map instead
```

### some and every — Boolean Tests Across the Array

```js
const ages = [22, 17, 30, 15];

console.log(ages.some(age => age < 18));  // true  — at least one is under 18
console.log(ages.every(age => age < 18)); // false — not all are under 18
console.log(ages.every(age => age > 0));  // true  — all are positive
```

### Chaining Iteration Methods

```js
const orders = [
  { id: 1, total: 100, status: "shipped" },
  { id: 2, total: 250, status: "pending" },
  { id: 3, total: 75, status: "shipped" },
  { id: 4, total: 300, status: "shipped" }
];

const totalShipped = orders
  .filter(order => order.status === "shipped")
  .map(order => order.total)
  .reduce((sum, total) => sum + total, 0);

console.log(totalShipped); // 100 + 75 + 300 = 475
```

### Iteration Method Cheat Sheet

```
map      → transform each element      → returns NEW array, SAME length
filter   → keep matching elements      → returns NEW array, length ≤ original
reduce   → fold to a single value      → returns ANY type (number, object, array, string...)
find     → first matching element      → returns the ELEMENT itself, or undefined
findIndex→ index of first match        → returns a NUMBER, or -1
forEach  → run a side effect           → returns undefined (never chain after it)
some     → "does at least one match?"  → returns BOOLEAN
every    → "do all match?"             → returns BOOLEAN
```

---

## 5. Array vs Array-Like

Not everything that "looks like" an array actually is one. An **array-like object** has a `length` property and indexed elements, but doesn't have array methods like `map` or `filter`.

```js
function logArgs() {
  console.log(arguments);          // Arguments(3) [1, 2, 3] — looks array-like
  console.log(Array.isArray(arguments)); // false — it's NOT a real array!
  // arguments.map(x => x * 2);    // TypeError: arguments.map is not a function
}
logArgs(1, 2, 3);

// Converting an array-like to a real array
function logArgsFixed() {
  const realArray = Array.from(arguments);
  console.log(realArray.map(x => x * 2)); // [2, 4, 6] — now it works
}
logArgsFixed(1, 2, 3);
```

```js
// document.querySelectorAll returns a NodeList — also array-like, not a true array
// const divs = document.querySelectorAll("div");
// divs.forEach(...)   // NodeList DOES have forEach (a modern convenience), but not map/filter/reduce
// const realArray = Array.from(divs);  // convert first for full array method access
```

### How to Detect a Real Array

```js
console.log(Array.isArray([1, 2, 3]));        // true
console.log(Array.isArray("hello"));          // false — a string is iterable but not an array
console.log(Array.isArray({ length: 3 }));    // false
console.log(typeof [1, 2, 3]);                // "object" — typeof can't distinguish array from object!
```

`typeof` reports `"object"` for arrays, which is why `Array.isArray()` — not `typeof` — is the correct way to check whether something is really an array.

---

## 6. Hands-On Exercises

**Exercise 1:** Create an array `const inventory = ["sword", "shield", "potion"];`. Use `push` to add `"bow"` to the end, `unshift` to add `"map"` to the start, `pop` to remove the last item and store it in a variable, and `splice` to remove `"shield"` from the middle without knowing its index in advance (use `indexOf` first). Log the array after each step.

**Exercise 2:** Given `const temps = [72, 68, 90, 55, 100, 61];`, use `filter` to get temps above 70, use `map` to convert every temp from Fahrenheit to Celsius (`(f - 32) * 5/9`), and use `reduce` to compute the average temperature. Chain `filter` and `map` together in one expression to get the Celsius equivalents of only the temps above 70.

**Exercise 3:** Given an array of order objects `{ id, total, status }` (at least 6 entries, mixed statuses "shipped"/"pending"/"cancelled"), write a `reduce` that groups totals by status into an object like `{ shipped: 450, pending: 120, cancelled: 30 }`. Then write a separate one-liner using `some` to check if any order exceeds $1000, and one using `every` to check if all orders have a positive total.

**Exercise 4:** Write a function `sumEvens(arr)` that returns the sum of all even numbers in an array, implemented three different ways: (a) a manual `for` loop with an `if` check, (b) `filter` then `reduce` chained, (c) a single `reduce` with a conditional inside. Compare their readability in a comment.

**Exercise 5:** Inside a function, log `arguments` and confirm with `Array.isArray` that it is not a true array. Convert it to a real array with `Array.from(arguments)` (or the rest parameter `...args`, previewed in the next lesson) and call `.map()` on the result to double every numeric argument. Then explain in a comment why `arguments.map` would have thrown an error directly.

---

## 7. Interview Q&A

**Q: What is the difference between `map`, `filter`, and `reduce`, and when would you use each?**
Answer: `map` transforms every element in an array according to a callback and returns a new array of the exact same length, making it the right choice whenever you need to convert each item into something else — like turning an array of prices into an array of prices-with-tax. `filter` tests every element against a predicate callback and returns a new array containing only the elements that passed, always the same length or shorter than the original — appropriate whenever you need a subset of the original data. `reduce` is the most general of the three: it folds the entire array down into a single accumulated value of any type — a number, an object, a string, even another array — by running a callback that carries a running result from one element to the next, making it the tool of choice for totals, grouping, counting, or building up any single composite result from a list.

**Q: Which array methods mutate the original array, and why does this distinction matter?**
Answer: Methods like `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, and `fill` all mutate the array in place and, in most cases, also return something other than the modified array itself (for example `push` returns the new length, and `splice` returns the removed elements, not the mutated array). Methods like `map`, `filter`, `slice`, `concat`, `find`, and the newer `toSorted`/`toReversed`/`toSpliced` (ES2023) leave the original array untouched and return a new array or value instead. This distinction matters enormously in modern JavaScript, especially in frameworks like React that rely on detecting whether a piece of state has changed by reference — if you mutate an array in place, the reference stays the same and the framework may not notice the change, whereas returning a new array via `map` or spread syntax produces a new reference that change-detection systems can reliably pick up.

**Q: How does `reduce` actually work internally — walk through what happens on each call.**
Answer: `reduce` takes a callback function and an optional initial value, and it iterates through the array from left to right, calling the callback once per element with two key arguments: the accumulator (the running result, which starts as the initial value or, if omitted, the array's first element) and the current element being processed. Whatever the callback returns becomes the new accumulator value passed into the next call, and after the final element is processed, `reduce` returns the accumulator's final value. For example, summing `[10, 20, 30]` with `reduce((acc, item) => acc + item, 0)` runs three times: first `acc=0, item=10` returns `10`; then `acc=10, item=20` returns `30`; then `acc=30, item=30` returns `60`, which is the final result returned by `reduce`.

**Q: What is an array-like object, and how is it different from a real array?**
Answer: An array-like object has a numeric `length` property and indexed properties (`0`, `1`, `2`, ...) that make it look like an array when inspected, but it does not inherit from `Array.prototype`, so it lacks array methods like `map`, `filter`, and `reduce`. The classic example is the `arguments` object available inside a non-arrow function, and another common one is the `NodeList` returned by `document.querySelectorAll()` — both let you access elements by index and check `.length`, but calling `.map()` directly on either throws a `TypeError`. The fix is to convert them into a genuine array first, either with `Array.from(arrayLikeObject)` or the spread operator `[...arrayLikeObject]`, after which all standard array methods become available.

**Q: Why is `Array.isArray()` preferred over `typeof` for checking whether a value is an array?**
Answer: `typeof` returns `"object"` for both plain objects and arrays because, under the hood, JavaScript arrays are a specialized kind of object — there's no distinct `"array"` type in the `typeof` type system, so `typeof` alone cannot distinguish the two. `Array.isArray()` was added specifically to solve this problem: it checks the value's actual internal `[[Class]]`/prototype chain to definitively confirm whether it's a real Array instance, correctly returning `false` for array-like objects, strings, and plain objects, and `true` only for genuine arrays, including ones created across different execution contexts like iframes where `instanceof Array` can unreliably fail.
