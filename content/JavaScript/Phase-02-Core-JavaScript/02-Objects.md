# Objects — Complete Guide

## Table of Contents
1. [Object Literals](#1-object-literals)
2. [Property Access: Dot vs Bracket](#2-property-access-dot-vs-bracket)
3. [Object Methods (this)](#3-object-methods-this)
4. [Object.keys, values, entries](#4-objectkeys-values-entries)
5. [Object.freeze](#5-objectfreeze)
6. [Computed Property Names](#6-computed-property-names)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Object Literals

An object literal is a comma-separated list of `key: value` pairs wrapped in `{ }`. Objects model real-world entities — a user, a product, a configuration — as a single structured value.

```js
const user = {
  name: "Alice",
  age: 30,
  isActive: true,
  address: {
    city: "Sydney",
    country: "Australia"
  },
  hobbies: ["reading", "hiking"]
};
```

### Field-by-Field Breakdown

```
const user = {
  name: "Alice",
    ↳ Key "name" (a string, quotes optional if it's a valid identifier),
      mapped to the value "Alice".

  address: { city: "Sydney", country: "Australia" },
    ↳ Values can be objects themselves — objects nest freely.

  hobbies: ["reading", "hiking"]
    ↳ Values can be arrays, functions, or any other type.
};
```

### Shorthand Property Names (ES6)

```js
const name = "Alice";
const age = 30;

// Old way — repeating the variable name as both key and value
const userOld = { name: name, age: age };

// Shorthand — when the key and variable name match, write it once
const userNew = { name, age };
console.log(userNew); // { name: "Alice", age: 30 }
```

---

## 2. Property Access: Dot vs Bracket

```js
const user = { name: "Alice", "favorite-color": "blue" };

// Dot notation — concise, but the key must be a valid identifier (no spaces, no hyphens, can't start with a number)
console.log(user.name); // "Alice"

// Bracket notation — required when the key isn't a valid identifier, or is dynamic
console.log(user["favorite-color"]); // "blue"
// console.log(user.favorite-color);  // ✗ SyntaxError-ish behavior: parsed as (user.favorite - color)

// Bracket notation with a variable key — this is the big reason bracket notation exists
const key = "name";
console.log(user[key]); // "Alice" — dot notation CANNOT do this: user.key would look for a property literally called "key"
```

### When You Must Use Bracket Notation

```
Use bracket notation when:
  1. The key is stored in a variable (dynamic access)          user[key]
  2. The key has spaces, hyphens, or special characters         user["favorite-color"]
  3. The key starts with a number                                user["123abc"]
  4. The key is itself computed at runtime                       user[getKeyName()]

Otherwise, dot notation is preferred for its readability.
```

### Adding, Updating, and Deleting Properties

```js
const car = { make: "Toyota" };

car.model = "Corolla";        // add a new property
car.make = "Honda";           // update an existing property
delete car.model;             // remove a property entirely

console.log(car);             // { make: "Honda" }
console.log("model" in car);  // false — "in" checks whether a key exists on the object
console.log(car.model);       // undefined — missing property, not an error
```

### Optional Chaining (Preview)

```js
const user = { profile: { bio: "Hi there" } };

console.log(user.profile?.bio);       // "Hi there"
console.log(user.settings?.theme);    // undefined — no error, short-circuits safely
// console.log(user.settings.theme);  // ✗ TypeError: Cannot read properties of undefined
```

Optional chaining (`?.`) prevents "Cannot read properties of undefined" errors when accessing a property that might not exist on a nested object — a full treatment appears in Phase 7 (Modern JavaScript/ES6+).

---

## 3. Object Methods (this)

A method is simply a function stored as an object property.

```js
const calculator = {
  value: 0,
  add(n) {                 // method shorthand (ES6) — equivalent to add: function(n) {...}
    this.value += n;
    return this;            // returning "this" enables chaining
  },
  subtract(n) {
    this.value -= n;
    return this;
  },
  getValue() {
    return this.value;
  }
};

calculator.add(10).subtract(3).add(5);
console.log(calculator.getValue()); // 12
```

### Field-by-Field Breakdown

```
add(n) { this.value += n; return this; }
  │       │
  │       └── "this" refers to the object the method was called ON
  │           (calculator, in calculator.add(10)) — NOT the object
  │           where the method happens to be defined.
  └── method shorthand syntax — no "function" keyword needed
```

`this` inside a regular method is determined by *how the function is called*, not where it's defined — a subtlety explored fully in Phase 3, Lesson 2.

```js
const greeter = {
  name: "Alice",
  greet() {
    console.log(`Hi, I'm ${this.name}`);
  }
};

greeter.greet();               // "Hi, I'm Alice" — called as greeter.greet(), this = greeter

const detachedGreet = greeter.greet;
detachedGreet();               // "Hi, I'm undefined" (or throws in strict mode)
                                // — called with no object context, this is no longer "greeter"
```

---

## 4. Object.keys, values, entries

These three static methods let you turn an object's contents into arrays, which unlocks every array iteration method (`map`, `filter`, `reduce`) for object data.

```js
const scores = { math: 90, science: 85, art: 70 };

console.log(Object.keys(scores));    // ["math", "science", "art"]
console.log(Object.values(scores));  // [90, 85, 70]
console.log(Object.entries(scores)); // [["math", 90], ["science", 85], ["art", 70]]
```

### Practical Patterns

```js
// Total of all values
const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
console.log(total); // 245

// Filter an object down to entries matching a condition
const passing = Object.entries(scores)
  .filter(([subject, score]) => score >= 80)
  .reduce((acc, [subject, score]) => {
    acc[subject] = score;
    return acc;
  }, {});
console.log(passing); // { math: 90, science: 85 }

// Iterate keys and values together
for (const [subject, score] of Object.entries(scores)) {
  console.log(`${subject}: ${score}`);
}
// math: 90
// science: 85
// art: 70

// Build an object back up from entries (the reverse of Object.entries)
const doubled = Object.fromEntries(
  Object.entries(scores).map(([subject, score]) => [subject, score * 2])
);
console.log(doubled); // { math: 180, science: 170, art: 140 }
```

---

## 5. Object.freeze

`Object.freeze` makes an object immutable — no properties can be added, removed, or changed.

```js
const config = Object.freeze({ apiUrl: "https://api.example.com", retries: 3 });

config.retries = 10;          // silently fails (throws in strict mode / modules)
config.newProp = "test";      // silently fails — cannot add new properties
delete config.apiUrl;         // silently fails — cannot delete properties

console.log(config); // { apiUrl: "https://api.example.com", retries: 3 } — completely unchanged
```

```js
"use strict";
const frozen = Object.freeze({ x: 1 });
frozen.x = 2; // TypeError: Cannot assign to read only property 'x' of object — strict mode throws instead of silently failing
```

### Object.freeze Is Shallow

```js
const user = Object.freeze({
  name: "Alice",
  address: { city: "Sydney" }
});

user.name = "Bob";              // blocked — top-level property is frozen
user.address.city = "Melbourne"; // ✓ allowed! — freeze does NOT protect nested objects

console.log(user.address.city); // "Melbourne" — the nested object was still mutable
```

To deeply freeze an object, you must recursively call `Object.freeze` on every nested object, or use a utility/library that does this for you.

### Checking Frozen Status

```js
console.log(Object.isFrozen(config)); // true
console.log(Object.isFrozen({}));      // false
```

---

## 6. Computed Property Names

Computed property names let you use an expression, evaluated at object-creation time, as a property key.

```js
const key = "score";
const dynamicKey = "user_" + 1;

const obj = {
  [key]: 100,                  // key is the STRING "score", evaluated from the variable
  [dynamicKey]: "Alice",        // key becomes "user_1"
  [`${key}_bonus`]: 10          // template literals work too — key becomes "score_bonus"
};

console.log(obj); // { score: 100, user_1: "Alice", score_bonus: 10 }
```

### Practical Use: Building an Object Dynamically

```js
function createSettings(settingName, value) {
  return {
    [settingName]: value,      // the property name isn't known until the function runs
    updatedAt: new Date().toISOString()
  };
}

console.log(createSettings("theme", "dark"));
// { theme: "dark", updatedAt: "2026-07-13T..." }
```

### Without Computed Property Names (the Old Workaround)

```js
// Before ES6, you had to build the object first, then assign the dynamic key separately
function createSettingsOld(settingName, value) {
  const settings = {};
  settings[settingName] = value;   // bracket notation, but AFTER creation
  return settings;
}
```

---

## 7. Hands-On Exercises

**Exercise 1:** Create an object `product` with properties `name`, `price`, `"in-stock"` (deliberately using a hyphen), and a nested `dimensions` object with `width` and `height`. Access `name` with dot notation, `"in-stock"` with bracket notation (explain in a comment why dot notation would fail here), and `dimensions.width` with chained dot notation.

**Exercise 2:** Write an object `bankAccount` with a `balance` property and methods `deposit(amount)` and `withdraw(amount)`, each returning `this` so calls can be chained. Chain three operations together in one statement (e.g. `deposit(100).withdraw(30).deposit(50)`) and log the final balance. Then extract `withdraw` into a standalone variable, call it detached from the object, and observe/explain the `this` failure.

**Exercise 3:** Given `const inventory = { apples: 50, bananas: 30, cherries: 80, dates: 10 };`, use `Object.entries` combined with `filter` and `reduce` to build a new object containing only items with a quantity greater than 25. Then use `Object.values` and `reduce` to compute the total quantity across all items.

**Exercise 4:** Create a `Object.freeze`-protected `appConfig` object with a nested `theme` object inside it. Attempt to reassign a top-level property (observe it silently fails or throws under `"use strict"`), then attempt to mutate a property inside the nested `theme` object and observe that it succeeds — write a comment explaining why `Object.freeze` is shallow and what you'd need to do to freeze the nested object too.

**Exercise 5:** Write a function `tagObject(tagName, tagValue, baseObject)` that returns a new object equal to `baseObject` plus one additional property whose key is `tagName` and whose value is `tagValue`, using computed property names and the spread operator (previewed here, detailed in the next lesson): `{ ...baseObject, [tagName]: tagValue }`. Test it with a base object and a few different dynamic tag names.

---

## 8. Interview Q&A

**Q: What is the difference between dot notation and bracket notation for accessing object properties, and when is bracket notation required?**
Answer: Dot notation (`obj.property`) is concise and readable but only works when the property name is a valid JavaScript identifier known at the time you write the code — it can't contain spaces, hyphens, or start with a digit, and it can't be substituted with a variable. Bracket notation (`obj["property"]` or `obj[variable]`) is required in three situations: when the key contains characters that aren't valid in an identifier (like `"favorite-color"`), when the key needs to be looked up dynamically from a variable or the return value of a function at runtime (`obj[someVariable]`), or when the key starts with a number. In practice, dot notation is preferred by default for readability, and bracket notation is reserved specifically for these dynamic or non-identifier cases.

**Q: How does `this` behave inside an object method, and what happens if you detach the method from its object?**
Answer: Inside a regular (non-arrow) method, `this` is determined dynamically by how the function is invoked, not by where it's defined — when you call `obj.method()`, JavaScript sets `this` to `obj` for the duration of that call. If you extract the method into a standalone variable and call it without an object reference (`const fn = obj.method; fn();`), `this` is no longer bound to `obj` — in non-strict mode it defaults to the global object (`window` in browsers), and in strict mode or ES modules it's `undefined`, which typically causes an error the moment the method tries to access `this.someProperty`. This is exactly why utility libraries and class-based code often use `.bind(this)` or arrow functions for callbacks that get passed around and later invoked without their original object context.

**Q: What does `Object.freeze` do, and why is it described as "shallow"?**
Answer: `Object.freeze()` locks an object so that no properties can be added, removed, or reassigned, and any attempt to do so is silently ignored in non-strict mode or throws a `TypeError` in strict mode/ES modules. It's described as shallow because freezing only protects the object's own direct, top-level properties — if one of those properties holds a reference to another object (a nested object or array), that nested object is completely unaffected by the freeze and remains fully mutable. To make an object truly immutable at every level, you have to recursively freeze every nested object yourself, which is why many codebases use a small recursive `deepFreeze` helper function or a library rather than relying on `Object.freeze` alone.

**Q: What are `Object.keys`, `Object.values`, and `Object.entries` used for, and how do they enable functional-style operations on objects?**
Answer: These three static methods convert an object's properties into arrays: `Object.keys` returns an array of just the property names, `Object.values` returns an array of just the corresponding values, and `Object.entries` returns an array of `[key, value]` pairs, one per property. Their main power is that objects themselves don't have `map`, `filter`, or `reduce` methods, but arrays do — so converting an object to an array via `Object.entries` (or `Object.values`) lets you use the entire array iteration toolkit to transform, filter, or aggregate object data, and then `Object.fromEntries()` converts a processed array of `[key, value]` pairs back into a plain object, completing the round trip.

**Q: What is a computed property name, and what problem does it solve?**
Answer: A computed property name lets you use a JavaScript expression, wrapped in square brackets, as an object key at the moment the object literal is created — for example `{ [someVariable]: value }` uses whatever string `someVariable` currently holds as the actual property name. Before this ES6 feature existed, if you wanted an object's key to be determined dynamically (say, from a function parameter or a variable computed elsewhere), you had to first create the object with `{}` and then assign the dynamic key afterward using bracket notation on a separate line. Computed property names collapse that into a single expression, which is especially useful when building objects inline — such as constructing a lookup table keyed by an ID that's only known at runtime, or spreading a base object while adding one dynamically-named field, as seen in patterns like `{ ...base, [dynamicKey]: value }`.
