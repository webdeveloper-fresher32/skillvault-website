# Phase 3: Advanced JavaScript

## What You'll Learn

This is the phase where JavaScript stops being a set of syntax rules and starts making sense as a system. You'll learn what actually happens when the JavaScript engine runs your code — how execution contexts are created, why `var` declarations appear to "move" to the top of a function, and how the call stack tracks function invocations. From there you'll master closures (the mechanism behind nearly every advanced JavaScript pattern you'll encounter), the notoriously tricky `this` keyword across every context it can appear in, and higher-order functions, recursion, and ES6 modules. This phase is the single most interview-critical block of the entire course — nearly every "gotcha" JavaScript interview question traces back to a concept covered here.

## Learning Objectives

- Explain the two-phase creation of an execution context (creation phase, execution phase)
- Trace a program's execution using the call stack, including what happens on function call and return
- Explain hoisting for `var`, `let`, `const`, and function declarations, and define the Temporal Dead Zone
- Explain lexical scope and demonstrate how closures capture variables from an enclosing scope
- Build practical closure-based patterns: private counters, memoization
- Determine the value of `this` in every calling context: global, method call, arrow function, and explicit binding via `call`/`apply`/`bind`
- Explain what an IIFE is and why it was historically used for scope isolation
- Write and use higher-order functions that accept or return other functions
- Write recursive functions and trace their call stack growth and unwinding
- Use ES6 modules with named and default exports/imports

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Execution-Context-and-Hoisting.md](01-Execution-Context-and-Hoisting.md) | Execution context creation phases, call stack, hoisting of var/let/const/function, Temporal Dead Zone | 2 days |
| [02-Closures-and-Scope.md](02-Closures-and-Scope.md) | Lexical scope, closures (counter/memoization), `this` in all contexts, call/apply/bind, IIFE | 2.5 days |
| [03-Higher-Order-Functions-and-Modules.md](03-Higher-Order-Functions-and-Modules.md) | Callbacks, higher-order functions, recursion with call stack visualization, ES6 modules (import/export) | 2 days |

## Estimated Time

6–7 days

## Previous Phase

← [Phase 2: Core JavaScript](../Phase-02-Core-JavaScript/README.md)

## Next Phase

→ [Phase 4: DOM Manipulation](../Phase-04-DOM-Manipulation/README.md)
