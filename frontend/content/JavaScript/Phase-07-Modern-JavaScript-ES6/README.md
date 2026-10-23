# Phase 7: Modern JavaScript (ES6+)

## What You'll Learn

By this point you already know the ES6 fundamentals covered earlier in the course — `let`/`const`, arrow functions, template literals, and modules were introduced back in Phase 1 and Phase 3. This phase covers the newer additions to the language that round out a modern JavaScript skill set: safe navigation through possibly-missing data with optional chaining and nullish coalescing, the `Set`/`Map` collection types and when they beat plain objects and arrays, and the iterator/generator protocol that powers `for...of` loops and enables lazy, on-demand sequences. These features show up constantly in modern codebases and in interviews that probe whether you've kept up with the language past ES5/early ES6.

## Learning Objectives

- Use optional chaining (`?.`) to safely read deeply nested properties without a chain of manual `&&` guards
- Use nullish coalescing (`??`) to provide defaults specifically for `null`/`undefined`, and explain how it differs from `||`
- Use the assignment shorthand operators `??=`, `||=`, and `&&=` correctly
- Choose `Set`/`Map` over plain objects/arrays for deduplication, arbitrary key types, and predictable iteration order
- Explain the difference between `Map`/`Set` and `WeakMap`/`WeakSet`, and why the "weak" variants exist
- Explain the iterator protocol (`next()`, `{ value, done }`) and implement `Symbol.iterator` on a custom object
- Write generator functions with `function*` and `yield`, and explain how they pause and resume execution
- Use generators to implement lazy evaluation and infinite sequences safely

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Optional-Chaining-and-Nullish-Coalescing.md](01-Optional-Chaining-and-Nullish-Coalescing.md) | `?.`, `??`, `??=`, `||=`, `&&=`, safe deep property access patterns | 1 day |
| [02-Sets-and-Maps.md](02-Sets-and-Maps.md) | `Set`/`WeakSet`, `Map`/`WeakMap`, when to use over objects/arrays, iteration, deduplication, caching | 2 days |
| [03-Generators-and-Iterators.md](03-Generators-and-Iterators.md) | Iterator protocol, `Symbol.iterator`, generator functions, `yield`, lazy evaluation, infinite sequences | 2 days |

## Estimated Time

4–6 days

## Previous Phase

← [Phase 6: Object-Oriented JavaScript](../Phase-06-Object-Oriented-JavaScript/README.md)

## Next Phase

→ [Phase 8: Browser APIs](../Phase-08-Browser-APIs/README.md)
