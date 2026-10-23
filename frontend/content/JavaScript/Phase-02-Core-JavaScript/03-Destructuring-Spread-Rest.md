# Destructuring, Spread, and Rest — Complete Guide

## Table of Contents
1. [Array Destructuring](#1-array-destructuring)
2. [Object Destructuring](#2-object-destructuring)
3. [Nested Destructuring](#3-nested-destructuring)
4. [Default Values in Destructuring](#4-default-values-in-destructuring)
5. [Spread Operator](#5-spread-operator)
6. [Rest Parameters](#6-rest-parameters)
7. [Default Parameters (Full Treatment)](#7-default-parameters-full-treatment)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Array Destructuring

Array destructuring unpacks values out of an array into individual variables, matched by position.

```js
const coordinates = [10, 20, 30];

const [x, y, z] = coordinates;
console.log(x, y, z); // 10 20 30

// Skipping elements with empty commas
const [first, , third] = coordinates;
console.log(first, third); // 10 30

// Swapping variables without a temp variable
let a = 1, b = 2;
[a, b] = [b, a];
console.log(a, b); // 2 1
```

### Field-by-Field Breakdown

```
const [x, y, z] = coordinates;
        │  │  │
        │  │  └── 3rd variable ← coordinates[2]
        │  └────── 2nd variable ← coordinates[1]
        └───────── 1st variable ← coordinates[0]

Destructuring is purely POSITIONAL for arrays — order matters, names don't.
```

### Destructuring Function Return Values

```js
function getMinMax(numbers) {
  return [Math.min(...numbers), Math.max(...numbers)];
}

const [min, max] = getMinMax([4, 1, 9, 2]);
console.log(min, max); // 1 9
```

---

## 2. Object Destructuring

Object destructuring unpacks values matched by **property name**, not position.

```js
const user = { name: "Alice", age: 30, city: "Sydney" };

const { name, age } = user;
console.log(name, age); // "Alice" 30

// Order doesn't matter — names must match the object's keys
const { city, name: userName } = user; // renaming "name" to "userName" — see next section
console.log(city, userName); // "Sydney" "Alice"
```

### Renaming While Destructuring

```js
const response = { data: { userId: 42 }, statusCode: 200 };

const { statusCode: status } = response; // extract "statusCode" but call it "status" locally
console.log(status); // 200
// console.log(statusCode);  // ✗ ReferenceError — the original name no longer exists locally
```

### Destructuring Function Parameters

```js
function printUser({ name, age }) {
  console.log(`${name} is ${age} years old`);
}
printUser({ name: "Bob", age: 25, city: "Perth" }); // "Bob is 25 years old" — extra props ignored
```

---

## 3. Nested Destructuring

Both array and object destructuring can be nested arbitrarily deep to match the shape of nested data.

```js
const company = {
  name: "TechCorp",
  address: {
    city: "Sydney",
    coordinates: [-33.8688, 151.2093]
  },
  employees: [
    { name: "Alice", role: "Engineer" },
    { name: "Bob", role: "Designer" }
  ]
};

const {
  address: {
    city,
    coordinates: [lat, lng]
  },
  employees: [firstEmployee]
} = company;

console.log(city);          // "Sydney"
console.log(lat, lng);      // -33.8688 151.2093
console.log(firstEmployee); // { name: "Alice", role: "Engineer" }
```

### Field-by-Field Breakdown

```
address: { city, coordinates: [lat, lng] }
  │        │      │
  │        │      └── destructure the "coordinates" ARRAY into lat/lng by position
  │        └── destructure the "city" property directly
  └── first navigate INTO the "address" object — this key itself is NOT
      bound to a variable unless you also write "address: address" (or just "address")

employees: [firstEmployee]
  ↳ "employees" is an array; take its first element and bind it to "firstEmployee"
```

---

## 4. Default Values in Destructuring

Default values apply when the destructured value is `undefined` — not when it's missing entirely, and not for other falsy values like `0` or `""`.

```js
const settings = { theme: "dark" };

const { theme = "light", fontSize = 14 } = settings;
console.log(theme, fontSize); // "dark" 14 — theme exists so its own value wins; fontSize is missing, default kicks in

const { fontSize: size = 12, volume = 0 } = { fontSize: undefined, volume: 5 };
console.log(size, volume); // 12 5 — fontSize is explicitly undefined, so default applies; volume has a real value (5), default ignored

// Defaults combined with renaming
const { theme: appTheme = "light" } = {};
console.log(appTheme); // "light"
```

### Array Destructuring Defaults

```js
const [a = 10, b = 20, c = 30] = [1, undefined];
console.log(a, b, c); // 1 20 30 — "a" gets its real value, "b" is undefined so default applies, "c" is missing so default applies
```

---

## 5. Spread Operator

The spread operator (`...`) expands an iterable (array, string) or an object's own enumerable properties into individual elements.

### Spread in Arrays

```js
const nums1 = [1, 2, 3];
const nums2 = [4, 5, 6];

const combined = [...nums1, ...nums2];
console.log(combined); // [1, 2, 3, 4, 5, 6]

// Copying an array (shallow copy — new array, same references for nested objects)
const original = [1, 2, 3];
const copy = [...original];
copy.push(4);
console.log(original); // [1, 2, 3] — untouched
console.log(copy);     // [1, 2, 3, 4]

// Inserting in the middle
const withInsert = [...nums1.slice(0, 1), "NEW", ...nums1.slice(1)];
console.log(withInsert); // [1, "NEW", 2, 3]

// Spreading a string into characters
console.log([..."hello"]); // ["h", "e", "l", "l", "o"]
```

### Spread in Objects

```js
const base = { name: "Alice", age: 30 };
const withCity = { ...base, city: "Sydney" };
console.log(withCity); // { name: "Alice", age: 30, city: "Sydney" }

// Overriding properties — later spread/properties win
const updated = { ...base, age: 31 };
console.log(updated); // { name: "Alice", age: 31 }

// Merging multiple objects — rightmost wins on conflicts
const defaults = { theme: "light", fontSize: 14 };
const userPrefs = { fontSize: 18 };
const finalConfig = { ...defaults, ...userPrefs };
console.log(finalConfig); // { theme: "light", fontSize: 18 }
```

### Spread in Function Calls

```js
function sum3(a, b, c) {
  return a + b + c;
}

const nums = [1, 2, 3];
console.log(sum3(...nums)); // 6 — array elements expanded into three separate arguments

console.log(Math.max(...[4, 1, 9, 2])); // 9 — Math.max doesn't accept arrays directly, spread fixes that
```

### Spread Is Shallow

```js
const original = { name: "Alice", address: { city: "Sydney" } };
const copy = { ...original };

copy.name = "Bob";
console.log(original.name); // "Alice" — top-level primitive is independent

copy.address.city = "Melbourne";
console.log(original.address.city); // "Melbourne" — nested OBJECT is shared by reference!
```

Just like `Object.freeze`, spread only performs a **shallow** copy — nested objects and arrays are still shared by reference between the original and the copy.

---

## 6. Rest Parameters

Rest parameters collect any remaining arguments into a real array. They look identical to spread (`...`) but do the opposite job — spread *expands*, rest *collects*.

```js
function sum(...numbers) {
  console.log(Array.isArray(numbers)); // true — a REAL array, unlike "arguments"
  return numbers.reduce((total, n) => total + n, 0);
}
console.log(sum(1, 2, 3, 4)); // 10
console.log(sum());           // 0
```

### Rest Must Be the Last Parameter

```js
function logFirstAndRest(first, ...rest) {
  console.log("First:", first);
  console.log("Rest:", rest);
}
logFirstAndRest(1, 2, 3, 4);
// First: 1
// Rest: [2, 3, 4]

// function invalid(...rest, last) {}  // ✗ SyntaxError — rest parameter must be last
```

### Rest in Destructuring

```js
const { name, ...otherDetails } = { name: "Alice", age: 30, city: "Sydney" };
console.log(name);          // "Alice"
console.log(otherDetails);  // { age: 30, city: "Sydney" }

const [first, ...restOfArray] = [1, 2, 3, 4];
console.log(first);         // 1
console.log(restOfArray);   // [2, 3, 4]
```

```
Spread (...)  → EXPANDS a collection into individual elements    [...arr]   used in literals/calls
Rest (...)    → COLLECTS individual elements into a collection    (...args) used in parameters/destructuring

Same syntax, opposite direction — context (where it appears) tells them apart.
```

---

## 7. Default Parameters (Full Treatment)

```js
function createUser(name, role = "member", isActive = true) {
  return { name, role, isActive };
}

console.log(createUser("Alice"));                  // { name: "Alice", role: "member", isActive: true }
console.log(createUser("Bob", "admin"));           // { name: "Bob", role: "admin", isActive: true }
console.log(createUser("Carol", "admin", false));  // { name: "Carol", role: "admin", isActive: false }
```

### Defaults Can Reference Earlier Parameters

```js
function createRectangle(width, height = width) {
  return { width, height };
}
console.log(createRectangle(5));     // { width: 5, height: 5 } — height defaults to width's value
console.log(createRectangle(5, 10)); // { width: 5, height: 10 }
```

### Combining Defaults with Destructured Parameters

```js
function connect({ host = "localhost", port = 8080, secure = false } = {}) {
  const protocol = secure ? "https" : "http";
  console.log(`${protocol}://${host}:${port}`);
}

connect();                          // "http://localhost:8080"
connect({ port: 3000 });            // "http://localhost:3000"
connect({ secure: true, host: "api.example.com" }); // "https://api.example.com:8080"
```

The `= {}` at the very end of the parameter is essential — without it, calling `connect()` with zero arguments would try to destructure `undefined` and throw a `TypeError`.

---

## 8. Hands-On Exercises

**Exercise 1:** Given `const rgb = [255, 99, 71];`, destructure it into `red`, `green`, `blue` variables in one line. Then write a function `swap(arr)` that uses array destructuring to swap the first and last elements of a 2-element array without a temporary variable, and test it on `[1, 2]`.

**Exercise 2:** Given an API-shaped object `const apiResponse = { data: { id: 1, name: "Widget", price: 9.99 }, meta: { page: 1, totalPages: 5 } };`, destructure `id` and `name` out of `data`, rename `price` to `unitPrice`, and destructure `totalPages` out of `meta`, all in a single destructuring statement.

**Exercise 3:** Write a function `mergeConfigs(userConfig)` that merges a `userConfig` object on top of a hardcoded `defaultConfig` object (`{ theme: "light", language: "en", notifications: true }`) using spread, so any key present in `userConfig` overrides the default, and any key absent falls back to the default. Test it with a partial override and confirm unspecified keys keep their defaults.

**Exercise 4:** Write a function `logAll(label, ...values)` that logs `label` followed by each of the remaining arguments, using a rest parameter. Then write a companion function `callWithArgs(fn, argsArray)` that calls `fn` with the elements of `argsArray` spread as individual arguments, and demonstrate both working together by calling `logAll` through `callWithArgs`.

**Exercise 5:** Write a function `createNotification({ title, message = "No message provided", type = "info" } = {})` that logs a formatted string like `"[INFO] Title: message"`. Call it with no arguments, with only a `title`, and with all three properties, confirming defaults behave correctly in each case. Add a comment explaining why the `= {}` default on the whole parameter is necessary.

---

## 9. Interview Q&A

**Q: What is the difference between array destructuring and object destructuring?**
Answer: Array destructuring matches values by **position** — `const [a, b] = arr` always takes `arr[0]` and `arr[1]` regardless of what you name the variables, so the order in the destructuring pattern must correspond to the order of elements in the array. Object destructuring matches values by **property name** — `const { name, age } = obj` looks up the properties literally called `name` and `age` on the object, so the order you write them in doesn't matter, but the variable names must match the object's keys (unless you use the `oldKey: newName` renaming syntax). This reflects the underlying data structures themselves: arrays are ordered collections accessed by index, while objects are unordered collections accessed by key.

**Q: What is the difference between the spread operator and rest parameters, given they use identical `...` syntax?**
Answer: Spread and rest use the exact same three-dot syntax but perform opposite operations, and JavaScript tells them apart entirely by context. Spread *expands* a collection into individual elements — used inside an array literal (`[...arr]`), an object literal (`{...obj}`), or a function call (`fn(...args)`) to unpack an existing collection into separate values or a new copy. Rest *collects* individual values into a single array or object — used inside a function parameter list (`function f(...args)`) to gather any remaining arguments into a real array, or inside a destructuring pattern (`const { a, ...rest } = obj`) to gather any properties not already destructured into a new object.

**Q: Why is spread/`Object.freeze`-style copying described as "shallow," and what problem does that cause?**
Answer: Both the spread operator and `Object.assign` create a new top-level object or array, but any property whose value is itself an object or array is not copied — the new structure simply holds a reference to the *same* nested object as the original. This means that primitive values (strings, numbers, booleans) at the top level are safely independent after a spread copy, but if you mutate a nested object's properties through the copy (`copy.address.city = "X"`), that change is visible on the original too, because both are pointing at the identical nested object in memory. To fully protect against this you need a "deep clone" — either a recursive copy function, `structuredClone()` (a built-in modern API), or a library like Lodash's `cloneDeep`.

**Q: When destructuring with a default value, under what exact condition does the default get used?**
Answer: A default value in a destructuring pattern is applied if — and only if — the corresponding value is `undefined`, whether that's because the property/index is completely missing from the source, or because it exists but was explicitly set to `undefined`. Critically, the default is *not* triggered by other falsy values: if a property's actual value is `0`, `""`, `false`, or `null`, that real value is used as-is and the default is ignored, because those values are not `undefined`. This distinction trips up developers who expect defaults to behave like the `||` operator (which falls back on any falsy value) — destructuring defaults are narrower and only guard against the specific absence represented by `undefined`.

**Q: Why does a function like `function connect({ host, port } = {})` need that trailing `= {}`, and what breaks without it?**
Answer: When a function parameter is itself a destructuring pattern, JavaScript must first evaluate the argument passed in and then attempt to pull properties out of it — if no argument is passed at all, the parameter's value is `undefined`, and you cannot destructure properties out of `undefined` (doing so throws `TypeError: Cannot destructure property 'host' of 'undefined' as it is undefined`). Adding `= {}` as a default for the *entire parameter* means that if no argument is passed, the destructuring pattern operates on an empty object instead of `undefined`, which safely yields `undefined` for every individual property inside it, letting their own inner defaults (like `host = "localhost"`) kick in as expected. Without the outer `= {}`, calling the function with zero arguments crashes immediately, even if every individual destructured property has its own default value defined.
