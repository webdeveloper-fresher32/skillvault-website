# Phase 6: Object-Oriented JavaScript

## What You'll Learn

JavaScript's object-oriented model is fundamentally different from classical OOP languages like Java or C++ — it uses **prototypes**, not classes, as its underlying inheritance mechanism, even though ES6 gave it `class` syntax that looks classical on the surface. This phase starts with constructor functions and the `new` keyword to build a solid mental model of what a "class" actually is under the hood, then layers ES6 `class` syntax, getters/setters, and static methods on top of that foundation. From there you'll trace the prototype chain — the actual mechanism behind property lookup and inheritance — with a full diagram, learn `extends`/`super`, and finish with the pillars of encapsulation (private fields, closures) and polymorphism (method overriding, mixins). By the end you'll be able to explain not just how to write a JavaScript class, but what the engine is actually doing when you do.

## Learning Objectives

- Write constructor functions and explain exactly what the `new` keyword does step by step
- Convert constructor functions to ES6 `class` syntax and explain that classes are "syntactic sugar" over the same prototype mechanism
- Distinguish instance methods from static methods, and explain when each is appropriate
- Implement getters and setters with `get`/`set` and explain their use for computed or validated properties
- Trace how property lookup walks the prototype chain from an instance up to `Object.prototype`
- Explain the difference between `__proto__` and `prototype`, and why the distinction confuses beginners
- Use `Object.create()` to build objects with a specific prototype without a constructor function
- Implement inheritance with `class ... extends` and call `super()` correctly in both constructors and overridden methods
- Implement true private state with `#field` syntax, and the pre-ES2022 closure-based privacy pattern
- Demonstrate polymorphism through method overriding and explain mixins as an alternative to single inheritance

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Constructors-and-Classes.md](01-Constructors-and-Classes.md) | Constructor functions, `new` keyword mechanics, ES6 class syntax, instance vs. static methods, getters/setters | 2 days |
| [02-Inheritance-and-Prototypes.md](02-Inheritance-and-Prototypes.md) | Prototype chain diagram, `__proto__` vs `prototype`, `Object.create`, `class extends`/`super`, method overriding | 2 days |
| [03-Encapsulation-and-Polymorphism.md](03-Encapsulation-and-Polymorphism.md) | Private fields (`#field`), closures for privacy, polymorphism, mixins | 2 days |

## Estimated Time

5–7 days

## Previous Phase

← [Phase 5: Asynchronous JavaScript](../Phase-05-Asynchronous-JavaScript/README.md)

## Next Phase

→ [Phase 7: Modern JavaScript ES6+](../Phase-07-Modern-JavaScript-ES6/README.md)
