# Constructors and Classes — Complete Guide

## Table of Contents
1. [Objects Before Classes](#1-objects-before-classes)
2. [Constructor Functions](#2-constructor-functions)
3. [What `new` Actually Does](#3-what-new-actually-does)
4. [ES6 Class Syntax](#4-es6-class-syntax)
5. [Instance Methods vs Static Methods](#5-instance-methods-vs-static-methods)
6. [Getters and Setters](#6-getters-and-setters)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Objects Before Classes

Every object in JavaScript is a bag of key/value pairs. You can create one object at a time with an object literal:

```js
const car1 = { make: "Toyota", model: "Corolla", drive() { console.log(`${this.make} is driving`); } };
const car2 = { make: "Honda", model: "Civic", drive() { console.log(`${this.make} is driving`); } };
```

This works, but it duplicates the `drive` method on every single object — wasteful in memory, and error-prone to keep in sync if the method needs to change. Constructor functions (and later, classes) exist to solve exactly this: a repeatable template for creating many objects that share the same shape and behavior, while sharing methods through the **prototype** instead of copying them onto each instance.

---

## 2. Constructor Functions

A constructor function is an ordinary function, conventionally named with a capital letter, intended to be called with the `new` keyword.

```js
function Car(make, model) {
  this.make = make;
  this.model = model;
}

// Shared methods go on the prototype, NOT inside the constructor —
// this way every Car instance shares ONE copy of drive(), not a
// separate copy per instance.
Car.prototype.drive = function () {
  console.log(`${this.make} ${this.model} is driving.`);
};

const car1 = new Car("Toyota", "Corolla");
const car2 = new Car("Honda", "Civic");

car1.drive(); // "Toyota Corolla is driving."
car2.drive(); // "Honda Civic is driving."

console.log(car1.drive === car2.drive); // true — same function, shared via prototype
```

---

## 3. What `new` Actually Does

The `new` keyword is doing four distinct things behind the scenes. Understanding these four steps is the foundation for understanding classes, `this`, and the prototype chain.

```
new Car("Toyota", "Corolla")  performs, in order:

  1. Create a brand-new, empty plain object: {}

  2. Link that new object's internal [[Prototype]] to Car.prototype
     (this is what makes car1.drive() findable later — see Phase 6,
     Lesson 2 for the full prototype chain diagram)

  3. Call Car(...) with `this` bound to the new object, and the
     arguments ("Toyota", "Corolla") passed through normally
     → inside Car, `this.make = make` sets a property on the NEW object

  4. Return the new object automatically
     (UNLESS the constructor explicitly returns its OWN object —
     in that rare case, that returned object wins instead)
```

```js
// Manually reproducing what `new Car("Toyota", "Corolla")` does:
function manualNew(Constructor, ...args) {
  const obj = {};                                  // step 1
  Object.setPrototypeOf(obj, Constructor.prototype); // step 2
  const result = Constructor.apply(obj, args);      // step 3
  return (typeof result === "object" && result !== null) ? result : obj; // step 4
}

const car3 = manualNew(Car, "Ford", "Focus");
car3.drive(); // "Ford Focus is driving." — behaves identically to `new Car(...)`
```

### Forgetting `new`

```js
const brokenCar = Car("Toyota", "Corolla"); // NO `new` — common bug!
// Inside Car, `this` is NOT a new object — in non-strict mode `this`
// is the global object (window/globalThis), and in strict mode/modules
// `this` is undefined, causing a TypeError when Car tries `this.make = ...`
console.log(brokenCar); // undefined — Car() didn't explicitly return anything
```

This is exactly the bug that ES6 classes prevent — see below.

---

## 4. ES6 Class Syntax

ES6 introduced `class` syntax as a cleaner way to write the exact same constructor-function-plus-prototype pattern. **Classes are syntactic sugar** — under the hood, a `class` still creates a function with a `.prototype` object, and `new` still performs the same four steps from Section 3.

```js
class Car {
  constructor(make, model) {
    this.make = make;
    this.model = model;
  }

  drive() {
    console.log(`${this.make} ${this.model} is driving.`);
  }
}

const car1 = new Car("Toyota", "Corolla");
car1.drive(); // "Toyota Corolla is driving."

console.log(typeof Car);              // "function" — a class IS a function
console.log(Car.prototype.drive);     // the drive function — lives on the prototype, same as before
console.log(car1.drive === Car.prototype.drive); // true — no per-instance copy
```

### Field-by-Field Breakdown

```
class Car { ... }
  ↳ Declares a class named Car. Under the hood, this is a special
    kind of function declaration.

constructor(make, model) { ... }
  ↳ Runs automatically when `new Car(...)` is called — equivalent
    to the body of the old constructor FUNCTION.
  ↳ A class can have at most ONE constructor method.

drive() { ... }
  ↳ Defined WITHOUT the `function` keyword inside a class body.
  ↳ Automatically placed on Car.prototype — NOT copied per instance,
    exactly like Car.prototype.drive = function() {...} before.

Key protections classes add over raw constructor functions:
  - Calling Car() WITHOUT `new` throws a TypeError immediately:
    "Class constructor Car cannot be invoked without 'new'"
    (this prevents the "forgot new" bug from Section 3 entirely)
  - Class bodies are always executed in strict mode implicitly.
  - Class declarations are NOT hoisted the way function declarations
    are — you cannot use a class before its declaration in the code
    (technically hoisted into a "temporal dead zone", same as let/const).
```

---

## 5. Instance Methods vs Static Methods

```js
class Car {
  static totalCarsCreated = 0; // static field — belongs to the class itself

  constructor(make, model) {
    this.make = make;
    this.model = model;
    Car.totalCarsCreated++;
  }

  // Instance method — called on an INSTANCE (car1.drive()), needs `this`
  drive() {
    console.log(`${this.make} ${this.model} is driving.`);
  }

  // Static method — called on the CLASS itself (Car.compare(...)), no instance needed
  static compare(carA, carB) {
    return carA.make === carB.make ? "Same make" : "Different make";
  }

  static createRandom() {
    const makes = ["Toyota", "Honda", "Ford"];
    const models = ["Model A", "Model B", "Model C"];
    const make = makes[Math.floor(Math.random() * makes.length)];
    const model = models[Math.floor(Math.random() * models.length)];
    return new Car(make, model); // a static "factory method"
  }
}

const car1 = new Car("Toyota", "Corolla");
const car2 = new Car("Honda", "Civic");

console.log(Car.compare(car1, car2));  // "Different make"
console.log(Car.totalCarsCreated);     // 2
const car3 = Car.createRandom();       // factory pattern via static method

// car1.compare(...) would THROW — compare only exists on Car, not on instances
```

```
Instance methods                    Static methods
  - Called on an instance             - Called on the CLASS itself
    e.g. car1.drive()                   e.g. Car.compare(a, b)
  - Live on Car.prototype              - Live directly on the Car function/class
  - Have access to `this` = instance   - `this` inside refers to the class,
                                          NOT any particular instance
  - Use for: behavior that operates    - Use for: utility functions, factory
    on a single instance's own data      methods, and counters/state that
                                          belong to the class as a whole,
                                          not to any one instance
```

---

## 6. Getters and Setters

Getters and setters let you define properties that are computed on access, or validated on assignment, while still using ordinary property syntax (`car.speedMph`, not `car.getSpeedMph()`).

```js
class Car {
  constructor(make, model, speedKmh) {
    this.make = make;
    this.model = model;
    this._speedKmh = speedKmh; // convention: leading underscore = "internal", not truly private (see Lesson 3)
  }

  // getter — accessed like a property, NOT called like a method
  get speedMph() {
    return Math.round(this._speedKmh / 1.609);
  }

  // setter — assigned like a property, runs validation logic
  set speedMph(mph) {
    if (mph < 0) {
      throw new RangeError("Speed cannot be negative");
    }
    this._speedKmh = Math.round(mph * 1.609);
  }
}

const car = new Car("Toyota", "Corolla", 100);
console.log(car.speedMph);   // 62  ← reads like a plain property, no ()
car.speedMph = 80;           // ← assigns like a plain property, runs the setter's validation
console.log(car._speedKmh);  // 129

try {
  car.speedMph = -10; // triggers the RangeError inside the setter
} catch (err) {
  console.error(err.message); // "Speed cannot be negative"
}
```

Getters/setters are ideal for: values computed from other internal state (`speedMph` derived from `_speedKmh`), validation on write (rejecting invalid values before they're stored), and keeping a public, stable property-style API even while the internal representation changes.

---

## 7. Hands-On Exercises

**Exercise 1:** Write a constructor function `Book(title, author, pages)` with a `summary()` method on its prototype that logs `"<title> by <author>, <pages> pages"`. Create three books with `new`, call `.summary()` on each, and confirm with `console.log(book1.summary === book2.summary)` that all instances share one function rather than each having its own copy.

**Exercise 2:** Reproduce the "forgot new" bug from Section 3 with your `Book` constructor: call `Book("1984", "Orwell", 328)` without `new` in non-strict mode and observe what `this` becomes and what the call returns. Then convert `Book` to an ES6 `class` and attempt the same mistaken call — observe the `TypeError` classes throw automatically, and explain in a comment why this is safer.

**Exercise 3:** Extend your `Book` class with a static field `totalBooksCreated` incremented in the constructor, and a static method `Book.mostPages(bookArray)` that returns the book with the highest page count from an array. Create five books and confirm both the counter and the static method work correctly.

**Exercise 4:** Add a getter `isLongRead` to `Book` that returns `true` if `pages > 400`, and a setter `pages` that throws if you try to set a negative or non-numeric page count. Test both by creating books above and below the threshold, and by attempting to set an invalid page count and catching the resulting error.

**Exercise 5:** Manually implement the `manualNew` helper function from Section 3 from scratch (without looking at the lesson) and verify it produces an object behaviorally identical to using the real `new` keyword — same prototype chain (`instanceof` should return `true`), same own properties, same method behavior — for at least two different constructor functions of your choosing.

---

## 8. Interview Q&A

**Q: What exactly does the `new` keyword do when you call `new Car(make, model)`?**
Answer: `new` performs four steps in order: first, it creates a brand-new, empty plain object. Second, it links that new object's internal `[[Prototype]]` to the constructor function's `.prototype` property, which is what makes methods defined on the prototype findable from the instance later. Third, it invokes the constructor function with `this` bound to that new object, passing through whatever arguments were given, so any `this.property = value` assignments inside the constructor set properties on the new object. Fourth, unless the constructor explicitly returns its own object, `new` automatically returns that newly created and now-populated object as the result of the whole expression. All four of these steps happen regardless of whether you write a raw constructor function or an ES6 `class` — `class` is syntactic sugar over exactly this mechanism.

**Q: Are ES6 classes just "syntactic sugar," and if so, what does that actually mean in practice?**
Answer: Yes — under the hood, a `class` declaration still creates a function, methods defined in the class body are still placed on that function's `.prototype` object rather than copied onto each instance, and `new ClassName(...)` still performs the same four-step process described above. You can verify this directly: `typeof Car` returns `"function"` even when `Car` is declared with `class`, and `car1.drive === Car.prototype.drive` is `true`, proving the method lives on the shared prototype exactly as it would with a manually written constructor function. What `class` syntax adds are safety and ergonomics on top of the same mechanism: calling a class without `new` throws a `TypeError` immediately instead of silently corrupting `this`, class bodies run in strict mode automatically, and the syntax for defining methods, getters, setters, and static members is far more concise and readable than manually assigning to `.prototype`.

**Q: What is the difference between an instance method and a static method, and when would you use each?**
Answer: An instance method is called on an object created from the class — like `car1.drive()` — and inside it, `this` refers to that specific instance, so it's used for behavior that depends on or operates on that instance's own data. A static method is called directly on the class itself — like `Car.compare(carA, carB)` — and is never called on an instance; inside a static method, `this` refers to the class, not any particular object. Static methods are the right choice for utility or helper functions that logically belong to the class's namespace but don't need a particular instance's state, such as factory methods that construct and return new instances (`Car.createRandom()`), comparison functions between two instances, or class-level counters and aggregate statistics. If a method needs to read or modify a specific object's own properties, it should be an instance method; if it's a general-purpose operation related to the class as a concept, it should be static.

**Q: What are getters and setters used for, and how do they differ from an ordinary method?**
Answer: Getters and setters, declared with the `get` and `set` keywords inside a class or object, let you define logic that runs on property access or assignment while still using plain property syntax — `car.speedMph`, not `car.getSpeedMph()` — which keeps the public API looking like simple data even when it's backed by computation or validation. A getter is invoked automatically when the property is read, and is ideal for values derived from other internal state, such as computing `speedMph` from an internally stored `_speedKmh`. A setter is invoked automatically when the property is assigned, and is the natural place to put validation logic — for example, throwing a `RangeError` if someone tries to assign a negative speed — so invalid data is rejected right at the point of assignment rather than being silently stored and causing a bug somewhere else later. The key difference from an ordinary method is purely syntactic: callers interact with `obj.property` and `obj.property = value` rather than `obj.getProperty()` and `obj.setProperty(value)`, while the class author retains full control over what happens on each access.

**Q: What happens if you call a constructor function without the `new` keyword, and how do ES6 classes prevent this bug?**
Answer: Without `new`, a constructor function is invoked as an ordinary function call, so `this` is not bound to a freshly created object linked to the constructor's prototype — in non-strict mode, `this` defaults to the global object (`window` in browsers, `globalThis` in Node), meaning any `this.property = value` assignment inside the constructor accidentally creates or overwrites global variables instead of building a proper object; in strict mode or inside ES modules, `this` is `undefined`, so the same assignment throws a `TypeError` for trying to set a property on `undefined`. Either way, the function typically returns `undefined` because it never explicitly returns anything, leaving the caller with a broken result instead of an object. ES6 classes close this gap entirely: the specification requires that a class's constructor can only be invoked via `new`, so calling `Car(make, model)` without `new` throws an immediate, clear `TypeError` — "Class constructor Car cannot be invoked without 'new'" — turning a silent, confusing bug into a loud, immediate one at the exact call site where the mistake was made.
