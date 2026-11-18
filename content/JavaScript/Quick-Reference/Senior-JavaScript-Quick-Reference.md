# JavaScript & Senior Node.js Interview Quick Reference Handbook

> Designed for Senior Node.js Engineering interviews and twice-a-week rapid revision.
> Available interactively in the web application under the **[Quick References](/quick-references)** tab.

---

## Table of Contents

### Category 1: JavaScript Fundamentals and Execution
1. [var, let, const](#1-var-let-const)
2. [Scope: Global, Function, and Block Scope](#2-scope-global-function-and-block-scope)
3. [Hoisting](#3-hoisting)
4. [Temporal Dead Zone (TDZ)](#4-temporal-dead-zone-tdz)
5. [Closures](#5-closures)
6. [Lexical Environment](#6-lexical-environment)
7. [Execution Context](#7-execution-context)
8. [Call Stack](#8-call-stack)

### Category 2: Functions and Object-Oriented JavaScript
9. [this Keyword](#9-this-keyword)
10. [Arrow Functions vs Regular Functions](#10-arrow-functions-vs-regular-functions)
11. [Prototypes and Prototype Chain](#11-prototypes-and-prototype-chain)
12. [Prototypal Inheritance](#12-prototypal-inheritance)
13. [call(), apply(), bind()](#13-call-apply-bind)

### Category 3: Objects and Data Handling
14. [Shallow Copy vs Deep Copy](#14-shallow-copy-vs-deep-copy)
15. [Pass by Value and Object References](#15-pass-by-value-and-object-references)
16. [Destructuring](#16-destructuring)
17. [Spread and Rest Operators](#17-spread-and-rest-operators)

### Category 4: Functional JavaScript
18. [Higher-Order Functions](#18-higher-order-functions)
19. [Callback Functions](#19-callback-functions)
20. [Pure Functions](#20-pure-functions)
21. [Immutability](#21-immutability)
22. [Functional Programming](#22-functional-programming)
23. [map(), filter(), reduce(), find(), some(), every()](#23-map-filter-reduce-find-some-every)

### Category 5: Error Handling and Modules
24. [Error Handling](#24-error-handling)
25. [ES Modules vs CommonJS](#25-es-modules-vs-commonjs)

---

## 1. var, let, const

### A. Concept in 30 Seconds
JavaScript provides three declaration keywords. `var` is function-scoped, hoisted, and initialized to undefined, allowing redeclaration. `let` and `const` are block-scoped and hoisted into the Temporal Dead Zone (TDZ) without initialization. `const` creates an immutable identifier binding (the variable cannot be reassigned), though internal object properties remain mutable.

### B. How It Works Internally
During the compilation/creation phase, V8 parses declarations into Environment Records. `var` variables are bound to the `VariableEnvironment` and immediately initialized to `undefined`. `let` and `const` are registered in the `LexicalEnvironment` in an `UNINITIALIZED` state. Accessing an uninitialized binding triggers an internal engine trap throwing `ReferenceError`. `const` sets an internal `[[IsConstantDeclaration]]` flag that causes any subsequent assignment to throw `TypeError`.

### C. Practical Code Example
```javascript
function testScope() {
  console.log(a); // undefined (hoisted + initialized)
  // console.log(b); // ReferenceError: Cannot access 'b' before initialization
  var a = 10;
  let b = 20;
  const config = { port: 3000 };
  config.port = 8080; // Valid: mutating an object property

  if (true) {
    var a = 99; // Re-declares function-scoped 'a'
    let b = 50; // Shadows outer 'b' inside this block only
  }

  console.log(a); // 99 (modified!)
  console.log(b); // 20 (unaffected!)
}
testScope();
```

### D. Real-World Node.js Application
In asynchronous Node.js operations (such as processing an array of database queries or Kafka messages with timers/promises), using `var` creates a single shared variable binding across all iterations, leading to the classic bug where all callbacks receive the final loop value. `let` creates a new lexical binding per iteration, ensuring each asynchronous closure captures its own distinct value.

### E. Interview Preparation
- **What to say:** `"var" is function-scoped and hoisted with undefined. "let" and "const" are block-scoped and protected by the Temporal Dead Zone in an uninitialized state. "const" additionally enforces an immutable identifier binding.`
- **Tricky Follow-up:** *Why does `typeof undeclared` return `"undefined"`, but `typeof letVar` in TDZ throw `ReferenceError`?* Because TC39 designed TDZ to explicitly break the `typeof` safety net to prevent accessing variables before declaration.

### F. Quick Revision
- `var` = Function scope, hoisted as undefined, re-declarable.
- `let` = Block scope, hoisted into TDZ, re-assignable.
- `const` = Block scope, hoisted into TDZ, constant reference pointer.
- One-line definition: `var` is function-scoped and initialized as undefined; `let` and `const` are block-scoped and protected by TDZ, with `const` enforcing an immutable identifier binding.

---

## 2. Scope: Global, Function, and Block Scope

### A. Concept in 30 Seconds
Scope defines the accessibility and lifetime of variables and functions during runtime. JavaScript uses lexical (static) scoping, meaning variable accessibility is resolved at parse time based on code nesting. The three primary scope types are Global Scope (accessible everywhere), Function Scope (confined to function execution), and Block Scope (confined to pairs of curly braces with `let`/`const`).

### B. How It Works Internally
Every Execution Context contains an `EnvironmentRecord` and an outer reference pointer (`[[OuterEnv]]`). When an identifier is queried, V8 checks the current `EnvironmentRecord`. If not found, it traverses up the scope chain via `[[OuterEnv]]` until it reaches the Global Environment Record. If not found in strict mode, it throws `ReferenceError`.

### C. Practical Code Example
```javascript
const globalVal = 'GLOBAL';

function processOrder() {
  const functionVal = 'FUNCTION';
  if (true) {
    const blockVal = 'BLOCK';
    var functionScopedVar = 'HOISTED_TO_FUNCTION';
    console.log(globalVal, functionVal, blockVal);
  }
  console.log(functionScopedVar); // Accessible (var ignored if-block!)
  // console.log(blockVal); // ReferenceError: blockVal is not defined
}
processOrder();
```

### D. Real-World Node.js Application
In Node.js, files are NOT executed in the global scope. Node wraps every module in a wrapper function: `(function (exports, require, module, __filename, __dirname) { ... })`. Declaring a variable at the top of a file puts it in Module Scope, not Global Scope. However, omitting declaration keywords (`leak = { data }`) in non-strict mode assigns it to the process-wide `global` object, causing massive memory leaks in high-throughput services.

### E. Interview Preparation
- **What to say:** `Scope Chain is used for identifier resolution across lexically nested code blocks. Prototype Chain is used for property lookup on object instances via their internal [[Prototype]] link.`
- **Tricky Follow-up:** *Are root-level variables in a Node.js file global?* No, they exist within the module wrapper's function scope.

### F. Quick Revision
- JavaScript uses Lexical Scoping: resolved at parse time.
- Scope chain traverses inwards-out; outer scopes never see inner variables.
- Node.js wraps files in an IIFE module wrapper.

---

## 3. Hoisting

### A. Concept in 30 Seconds
Hoisting is JavaScript's compilation behavior where variable and function declarations are registered in memory during the Creation Phase of the Execution Context before any code is executed. Function declarations are hoisted with their complete implementation, `var` is hoisted and initialized to undefined, while `let` and `const` are hoisted into an uninitialized state (TDZ).

### B. How It Works Internally
The V8 engine runs in two distinct phases: Creation Phase and Execution Phase. In the Creation Phase, the compiler scans the AST for declarations. Function declarations are stored in the heap and bound directly to their identifiers in the Environment Record. `var` variables are bound to `undefined`. `let` and `const` variables are allocated as uninitialized slots.

### C. Practical Code Example
```javascript
// Function Declaration Hoisting: Works!
console.log(calculateTax(100)); // 15
function calculateTax(amount) { return amount * 0.15; }

// var Hoisting: Returns undefined
console.log(orderStatus); // undefined
var orderStatus = 'CONFIRMED';

// Function Expression with var: Throws TypeError!
try {
  initServer(); // TypeError: initServer is not a function
} catch (err) {
  console.log(err.message);
}
var initServer = function() { console.log('Started'); };
```

### D. Real-World Node.js Application
In production Express.js route handlers, senior developers use function declarations to keep public exported controller methods at the top of the file for immediate readability, while hoisting private helper functions defined at the bottom.

### E. Interview Preparation
- **What to say:** `Hoisting is the compiler phase where memory is allocated for declarations before line-by-line bytecode execution begins. Function declarations hoist with their body; var hoists as undefined; let/const hoist into TDZ.`
- **Tricky Follow-up:** *Why does calling a var function expression before declaration throw TypeError instead of ReferenceError?* Because the variable itself IS declared and initialized with undefined. Calling undefined() triggers TypeError.

### F. Quick Revision
- Happens during Creation Phase of Execution Context.
- Function declarations hoist completely; callable anywhere in scope.
- `var` hoists as undefined; `let`/`const` hoist into uninitialized TDZ.

---

## 4. Temporal Dead Zone (TDZ)

### A. Concept in 30 Seconds
The Temporal Dead Zone (TDZ) is the runtime period between entering a scope and the line where a `let` or `const` variable is declared and initialized. During this time window, the variable exists in memory but is marked uninitialized. Any attempt to read or write to it immediately throws a `ReferenceError`.

### B. How It Works Internally
When entering a block, V8 instantiates a `DeclarativeEnvironmentRecord` and registers all block-scoped identifiers with a special internal sentinel value: `TheHole` (uninitialized). When the bytecode compiler encounters an identifier access, if the target slot holds `TheHole`, V8 triggers a bail-out exception and throws `ReferenceError: Cannot access X before initialization`.

### C. Practical Code Example
```javascript
function testTDZ() {
  try {
    console.log(token);
  } catch (err) {
    console.log('TDZ Error:', err.message); // Cannot access 'token' before initialization
  }
  let token = 'JWT_SECRET_KEY';

  // TDZ in default parameters:
  function compute(a = b, b = 2) { return a + b; }
  // compute(); // Throws ReferenceError: Cannot access 'b' before initialization
}
testTDZ();
```

### D. Real-World Node.js Application
In production Node.js services, TDZ catches critical asynchronous initialization race conditions. If a service attempts to access a database connection or decrypted secret before the asynchronous bootstrap sequence completes, TDZ guarantees an immediate, fail-fast `ReferenceError` rather than silently operating with `undefined`.

### E. Interview Preparation
- **What to say:** `TDZ was introduced to catch early runtime bugs where variables are accessed before declaration, and to strictly protect the semantics of "const".`
- **Tricky Follow-up:** *Why is it called TEMPORAL and not SPATIAL?* Because the dead zone is time-based. A function declared above a let variable can safely reference that variable as long as the function is EXECUTED after the declaration line has been evaluated.

### F. Quick Revision
- TDZ spans from scope entry until declaration evaluation.
- Reading or writing an uninitialized `let`/`const` throws `ReferenceError`.
- `typeof` is NOT safe inside TDZ.

---

## 5. Closures

### A. Concept in 30 Seconds
A closure is a function bundled together with references to its surrounding lexical environment. In JavaScript, a closure gives an inner function access to an outer function's variables even after the outer function has finished executing and returned.

### B. How It Works Internally
Normally, local variables reside on the execution stack and are destroyed when the stack frame pops. When V8 detects that an inner function references variables from an outer function, the compiler promotes those variables from the stack to a heap-allocated `Context` object. The inner function retains an internal `[[Scopes]]` property pointing to this heap Context, keeping the variables alive.

### C. Practical Code Example
```javascript
function createRateLimiter(maxRequests) {
  let count = 0; // Encapsulated private state on heap
  return function(userId) {
    count++;
    if (count > maxRequests) return { allowed: false, user: userId };
    return { allowed: true, current: count, remaining: maxRequests - count };
  };
}
const limiter = createRateLimiter(2);
console.log(limiter('usr_1')); // { allowed: true, current: 1, remaining: 1 }
console.log(limiter('usr_1')); // { allowed: true, current: 2, remaining: 0 }
console.log(limiter('usr_1')); // { allowed: false, user: 'usr_1' }
```

### D. Real-World Node.js Application
Closures power Node.js middleware factories (`express.json({ limit: "10mb" })`, `cors(options)`). The outer factory accepts configuration options once at startup, returning a middleware handler function that closes over those options for every incoming HTTP request.

### E. Interview Preparation
- **What to say:** `A closure is a function that retains access to variables from its outer lexical scope even after the outer function has returned. It enables state encapsulation, data privacy, and middleware factories.`
- **Tricky Follow-up:** *Can closures cause memory leaks in Node.js?* Yes. If a long-lived object (like an EventEmitter or global cache) retains a reference to a closure that captured large buffers or request objects, those variables cannot be garbage-collected.

### F. Quick Revision
- Closure = Function + Lexical Scope pointer.
- Captured variables are promoted to Heap Contexts.
- Core mechanism for private variables and middleware factories.

---

*(For the complete interactive experience with all 25 topics, real-time search, interactive filter tabs, code copying, and Twice-a-Week revision tracking, visit the **Quick References** tab in the application!)*
