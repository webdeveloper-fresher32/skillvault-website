# Inheritance and Prototypes — Complete Guide

## Table of Contents
1. [The Prototype Chain](#1-the-prototype-chain)
2. [`__proto__` vs `prototype`](#2-__proto__-vs-prototype)
3. [Object.create](#3-objectcreate)
4. [Class `extends` and `super`](#4-class-extends-and-super)
5. [Method Overriding](#5-method-overriding)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Prototype Chain

Every JavaScript object has an internal, hidden link to another object called its **prototype**. When you access a property on an object and that object doesn't have it as an own property, JavaScript doesn't give up — it looks at the object's prototype, then that prototype's prototype, and so on, until it either finds the property or reaches the end of the chain (`null`). This is the **prototype chain**, and it is the actual mechanism behind everything that looks like "inheritance" in JavaScript.

```
                    car1 = new Car("Toyota", "Corolla")
                    ┌─────────────────────────────┐
                    │  OWN properties:             │
                    │    make: "Toyota"            │
                    │    model: "Corolla"          │
                    └──────────────┬──────────────┘
                                   │ [[Prototype]]  (internal link)
                                   ▼
                    Car.prototype
                    ┌─────────────────────────────┐
                    │    drive()                   │
                    │    constructor: Car           │
                    └──────────────┬──────────────┘
                                   │ [[Prototype]]
                                   ▼
                    Object.prototype
                    ┌─────────────────────────────┐
                    │    toString()                │
                    │    hasOwnProperty()           │
                    │    valueOf()                  │
                    │    isPrototypeOf()             │
                    └──────────────┬──────────────┘
                                   │ [[Prototype]]
                                   ▼
                                 null            ← chain ENDS here

Property lookup for car1.drive():
  1. Is "drive" an OWN property of car1?           NO
  2. Is "drive" an own property of Car.prototype?  YES → found, use it, STOP

Property lookup for car1.toString():
  1. Is "toString" an own property of car1?             NO
  2. Is "toString" an own property of Car.prototype?    NO
  3. Is "toString" an own property of Object.prototype? YES → found, STOP

Property lookup for car1.nonExistentThing:
  1. car1?  NO   2. Car.prototype?  NO   3. Object.prototype?  NO
  4. Reached null → lookup stops, returns undefined (NOT an error)
```

This is why every plain object in JavaScript has `.toString()`, `.hasOwnProperty()`, and similar methods available "for free" — they live on `Object.prototype`, which sits at the top of every prototype chain (unless deliberately broken with `Object.create(null)`).

---

## 2. `__proto__` vs `prototype`

This naming collision is one of the most common sources of confusion for people learning JavaScript OOP. They are two completely different things that happen to sound alike.

```
Car.prototype
  ↳ A property that exists ONLY on FUNCTIONS (specifically, functions
    intended to be used as constructors).
  ↳ It is the object that will become the [[Prototype]] of any
    instance created via `new Car(...)`.
  ↳ This is where you define shared methods: Car.prototype.drive = ...

car1.__proto__
  ↳ A property that exists on virtually every OBJECT (including
    instances like car1).
  ↳ It is a (legacy, but still widely supported) getter/setter that
    exposes the object's actual internal [[Prototype]] link.
  ↳ car1.__proto__ === Car.prototype  → TRUE. They point to the SAME object.
  ↳ Modern code should use Object.getPrototypeOf(car1) instead of
    car1.__proto__ directly — __proto__ is a legacy accessor that
    was only formally standardized for web compatibility, not because
    it's the recommended API.

The relationship, spelled out:
  Car.prototype        is the BLUEPRINT object itself
  car1.__proto__        is car1's LINK, pointing AT that blueprint object
  car1.__proto__ === Car.prototype                    → true
  Object.getPrototypeOf(car1) === Car.prototype        → true (preferred syntax)
```

```js
function Car(make) { this.make = make; }
Car.prototype.drive = function () { console.log(`${this.make} driving`); };

const car1 = new Car("Toyota");

console.log(car1.__proto__ === Car.prototype);            // true
console.log(Object.getPrototypeOf(car1) === Car.prototype); // true (preferred)
console.log(Car.prototype.__proto__ === Object.prototype);  // true — the chain continues
console.log(Car.prototype.constructor === Car);              // true — round trip back to Car
```

---

## 3. Object.create

`Object.create(proto)` creates a brand-new object with its `[[Prototype]]` set directly to whatever object you pass in — no constructor function or `new` keyword required at all. It's the most direct, explicit way to set up a prototype chain.

```js
const animalMethods = {
  speak() {
    console.log(`${this.name} makes a sound.`);
  },
  eat() {
    console.log(`${this.name} is eating.`);
  },
};

const dog = Object.create(animalMethods); // dog's [[Prototype]] IS animalMethods
dog.name = "Rex";
dog.speak(); // "Rex makes a sound." — found via the prototype chain, not an own property

console.log(dog.hasOwnProperty("speak")); // false — it's inherited, not own
console.log(Object.getPrototypeOf(dog) === animalMethods); // true

// Object.create(null) creates an object with NO prototype at all —
// not even Object.prototype. Useful for a "pure dictionary" with
// zero inherited properties/methods (no toString, no hasOwnProperty).
const pureDict = Object.create(null);
pureDict.key = "value";
console.log(pureDict.toString); // undefined — no Object.prototype in its chain
```

`Object.create` is also what `class extends` uses internally to wire up inheritance between a subclass's prototype and its parent's prototype — see Section 4.

---

## 4. Class `extends` and `super`

`extends` sets up the prototype chain between two classes, and `super` gives you a way to call the parent class's constructor or methods from within a subclass.

```js
class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    console.log(`${this.name} makes a sound.`);
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name);       // MUST call super() before using `this` in a subclass constructor
    this.breed = breed;
  }

  speak() {
    super.speak();     // call the PARENT's version of speak() first
    console.log(`${this.name} barks!`);
  }
}

const rex = new Dog("Rex", "Labrador");
rex.speak();
// Rex makes a sound.
// Rex barks!

console.log(rex instanceof Dog);     // true
console.log(rex instanceof Animal);  // true — Dog's prototype chain includes Animal
```

### Field-by-Field Breakdown

```
class Dog extends Animal
  ↳ Sets Dog.prototype's [[Prototype]] to Animal.prototype.
    (Equivalent to: Object.setPrototypeOf(Dog.prototype, Animal.prototype))
  ↳ This is what makes `rex instanceof Animal` true, and what lets
    Dog instances fall through to Animal's methods if Dog doesn't
    define its own.

super(name)
  ↳ Calls the PARENT class's constructor, with `this` already bound
    to the new instance being constructed.
  ↳ MANDATORY before any use of `this` inside a subclass constructor —
    omitting it throws: "Must call super constructor before accessing
    'this' or returning from derived constructor."
  ↳ This requirement exists because in a derived class, `this` isn't
    actually initialized until the parent constructor runs.

super.speak()
  ↳ Calls the PARENT class's version of a method, from INSIDE an
    overriding method of the same name.
  ↳ Lets you "extend" a parent's behavior instead of fully replacing it.
```

```
The prototype chain that `extends` builds:

    rex (instance)
       │ [[Prototype]]
       ▼
    Dog.prototype  { speak (overridden) }
       │ [[Prototype]]
       ▼
    Animal.prototype  { speak (original), constructor }
       │ [[Prototype]]
       ▼
    Object.prototype
       │
       ▼
      null
```

---

## 5. Method Overriding

When a subclass defines a method with the same name as one on its parent, the subclass's version is found first during prototype chain lookup — this is **overriding**.

```js
class Shape {
  area() {
    return 0; // default/base implementation
  }
  describe() {
    console.log(`This shape has an area of ${this.area()}`);
  }
}

class Circle extends Shape {
  constructor(radius) {
    super();
    this.radius = radius;
  }
  area() {                       // OVERRIDES Shape.prototype.area
    return Math.PI * this.radius ** 2;
  }
}

class Square extends Shape {
  constructor(side) {
    super();
    this.side = side;
  }
  area() {                       // a DIFFERENT override
    return this.side ** 2;
  }
}

const shapes = [new Circle(2), new Square(3), new Shape()];
shapes.forEach((shape) => shape.describe());
// This shape has an area of 12.566370614359172   ← Circle's own area()
// This shape has an area of 9                     ← Square's own area()
// This shape has an area of 0                      ← base Shape's area()
```

Notice `describe()` is defined only once, on `Shape.prototype`, yet it produces different output for each subclass — because `this.area()` inside `describe()` always resolves to whichever `area()` is closest to the actual instance in the prototype chain. This is the mechanism behind polymorphism, covered fully in the next lesson.

---

## 6. Hands-On Exercises

**Exercise 1:** Using raw `Object.create`, build a prototype chain three levels deep: a `livingThingMethods` object with a `breathe()` method, an `animalMethods` object created with `Object.create(livingThingMethods)` that adds a `move()` method, and a `dog` object created with `Object.create(animalMethods)` that adds a `bark()` method. Call all three methods on `dog` and use `Object.getPrototypeOf()` three times in a row to walk the chain back up to `livingThingMethods`.

**Exercise 2:** Write out, in a code comment, the full prototype chain (as an ASCII diagram similar to Section 1) for an instance created from a `class Cat extends Animal`, ending at `null`. Then verify your diagram against reality using `Object.getPrototypeOf()` calls and `instanceof` checks in actual code.

**Exercise 3:** Create a `Vehicle` base class with a constructor accepting `make` and `topSpeed`, and a method `describe()`. Create a `SportsCar` subclass that calls `super()` in its constructor, adds a `hasTurbo` property, and overrides `describe()` to call `super.describe()` first and then append extra sports-car-specific details. Confirm both `instanceof Vehicle` and `instanceof SportsCar` return `true` for a `SportsCar` instance.

**Exercise 4:** Deliberately trigger the "must call super before this" error: write a subclass constructor that sets `this.someProp = value` before calling `super(...)`, run it, and paste the exact error message you get into a comment. Then fix it by reordering the calls.

**Exercise 5:** Build the `Shape`/`Circle`/`Square` example from Section 5 yourself, then add a third subclass `Triangle` with its own `area()` override, plus a fourth item in the `shapes` array that is a raw `Shape` instance. Loop through the array calling `.describe()` on each and confirm the base `Shape.describe()` method correctly dispatches to each subclass's own `area()` without `describe()` itself needing any changes.

---

## 7. Interview Q&A

**Q: What is the prototype chain, and what happens when you access a property that doesn't exist directly on an object?**
Answer: The prototype chain is the sequence of internal `[[Prototype]]` links connecting an object to another object, which is connected to another, and so on, terminating at `null`. When you access a property on an object, the JavaScript engine first checks whether that object has it as an own property; if not, it walks up to the object's prototype and checks there, then that prototype's prototype, continuing until either the property is found somewhere along the chain or the chain ends at `null`. If the chain ends without finding the property, the result is simply `undefined` — it is not an error, which is a common source of subtle bugs when a typo'd property name silently returns `undefined` instead of throwing. This chain is the actual mechanism behind everything that behaves like inheritance in JavaScript, whether you write raw constructor functions, `Object.create`, or ES6 `class` syntax with `extends` — all of them are, underneath, just wiring up `[[Prototype]]` links.

**Q: What is the difference between `.prototype` and `.__proto__`, and why do people confuse them?**
Answer: `.prototype` is a property that exists only on functions intended to be used as constructors — it's the object that will become the `[[Prototype]]` of any instance created by calling that function with `new`, and it's where you define methods meant to be shared across all instances. `.__proto__`, by contrast, exists on ordinary objects (including instances) and is a legacy getter/setter that exposes that object's actual internal `[[Prototype]]` link — for an instance created via `new Car(...)`, `car1.__proto__` and `Car.prototype` point to the exact same object, which is why `car1.__proto__ === Car.prototype` evaluates to `true`. The confusion arises because the names are nearly identical and describe closely related concepts from two different vantage points — one is the blueprint object itself (`Car.prototype`), the other is an instance's reference pointing at that blueprint (`car1.__proto__`). Modern code should prefer `Object.getPrototypeOf(car1)` over directly reading `car1.__proto__`, since `__proto__` is a legacy accessor kept mainly for web compatibility rather than a recommended, forward-looking API.

**Q: What does `Object.create()` do, and how is it different from using a constructor function with `new`?**
Answer: `Object.create(proto)` creates a brand-new, empty object whose `[[Prototype]]` is set directly to whatever object you pass as the argument — there's no constructor function involved, no `new` keyword, and no automatic property initialization; you get a bare object linked to the given prototype, and you assign any own properties yourself afterward. This is different from `new Constructor(...)`, which not only sets up the prototype link (to `Constructor.prototype`) but also runs the constructor function's body with `this` bound to the new object, allowing initialization logic to run automatically. `Object.create` is useful when you want precise, explicit control over an object's prototype without the ceremony of defining a constructor function — for example, building a single one-off object with shared behavior, or creating a "pure dictionary" object with `Object.create(null)` that has no prototype at all, not even `Object.prototype`, so it lacks even `toString` or `hasOwnProperty`.

**Q: Why must you call `super()` before using `this` in a subclass constructor, and what does `super.methodName()` do differently?**
Answer: In a derived class (one using `extends`), the JavaScript engine does not initialize `this` for the subclass until the parent class's constructor has actually run — this is a deliberate design decision reflecting the idea that the parent portion of the object must be constructed before the subclass can add its own properties on top of it. If you try to access or assign to `this` before calling `super(...)`, the engine throws a `ReferenceError` because `this` is not yet initialized. Calling `super(name)` at the very start of the subclass constructor runs the parent's constructor with `this` properly bound to the instance being built, after which the subclass constructor can safely continue adding its own properties. `super.methodName()`, used inside an overriding method rather than a constructor, is a different mechanism — it explicitly calls the parent class's version of that method, letting the subclass extend rather than completely replace the inherited behavior, such as calling `super.describe()` first and then appending additional subclass-specific output.

**Q: How does `class Dog extends Animal` set up the prototype chain, and how would you verify it programmatically?**
Answer: `extends` links `Dog.prototype`'s internal `[[Prototype]]` to `Animal.prototype`, which is functionally equivalent to calling `Object.setPrototypeOf(Dog.prototype, Animal.prototype)` — so when a `Dog` instance looks up a method that isn't defined directly on `Dog.prototype`, the lookup continues to `Animal.prototype` and finds it there, exactly following the ordinary prototype chain rules. This is what makes `rex instanceof Animal` evaluate to `true` for a `Dog` instance `rex` — `instanceof` works by checking whether `Animal.prototype` appears anywhere along the object's prototype chain, not by checking some separate "class hierarchy" data structure. You can verify this directly in code with `Object.getPrototypeOf(Dog.prototype) === Animal.prototype`, which should return `true`, and by chaining `Object.getPrototypeOf` calls starting from an instance (`Object.getPrototypeOf(rex) === Dog.prototype`, then `Object.getPrototypeOf(Dog.prototype) === Animal.prototype`, and so on) to manually walk the same chain the engine walks internally on every property lookup.
