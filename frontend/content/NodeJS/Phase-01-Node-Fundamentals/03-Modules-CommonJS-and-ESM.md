# Modules: CommonJS and ESM — Complete Guide

## Table of Contents
1. [Why Modules Exist](#1-why-modules-exist)
2. [CommonJS: require and module.exports](#2-commonjs-require-and-moduleexports)
3. [How CommonJS Module Resolution Works](#3-how-commonjs-module-resolution-works)
4. [ES Modules: import and export](#4-es-modules-import-and-export)
5. [Enabling ESM: "type": "module"](#5-enabling-esm-type-module)
6. [CJS vs ESM: Key Differences](#6-cjs-vs-esm-key-differences)
7. [Interop Between CommonJS and ESM](#7-interop-between-commonjs-and-esm)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Modules Exist

Without modules, every variable and function in every file you load shares one giant global scope — exactly like including multiple `<script>` tags in an old-school HTML page. Modules let you split code into files with **private scope by default**, explicitly exporting only what you want other files to use.

```
Without modules (everything global):
  file1.js:  var name = "Alice";
  file2.js:  var name = "Bob";      ← silently overwrites file1's `name`!

With modules (isolated scope):
  file1.js:  module.exports = { name: "Alice" };
  file2.js:  module.exports = { name: "Bob" };
             ← each file's variables stay private unless exported
```

Node.js has supported two module systems over its history:

```
┌────────────────────────────────────────────────────────────┐
│  CommonJS (CJS)          →  Node's original module system  │
│  require() / module.exports    (synchronous, since 2009)   │
│                                                              │
│  ES Modules (ESM)        →  the JavaScript language's own  │
│  import / export                official module system      │
│                             (standardized in ES6/2015,      │
│                              usable in Node since ~2019+)   │
└────────────────────────────────────────────────────────────┘
```

You've already used ESM `import`/`export` syntax in React. This lesson explains both systems, since real-world Node codebases (and job interviews) still use CommonJS heavily, especially in older packages and existing enterprise code.

---

## 2. CommonJS: require and module.exports

### Exporting

```javascript
// math.js
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

// Export multiple things as an object
module.exports = { add, subtract };
```

```javascript
// math.js — alternative: export a single function/value directly
module.exports = function add(a, b) {
  return a + b;
};
```

```javascript
// math.js — you can also attach properties one at a time
exports.add = function (a, b) { return a + b; };
exports.subtract = function (a, b) { return a - b; };
```

> **Trap to know for interviews:** `exports` is just a shorthand reference to `module.exports`. If you reassign `exports = {...}` directly (instead of `module.exports = {...}`), you break that reference and Node will still export whatever `module.exports` originally pointed to — not your new object. Always reassign `module.exports`, and only use `exports.foo = ...` for adding properties.

### Importing

```javascript
// app.js
const { add, subtract } = require('./math');   // destructure named exports
console.log(add(2, 3));       // 5

const math = require('./math');   // or grab the whole exports object
console.log(math.subtract(5, 2)); // 3

const express = require('express');   // importing a package from node_modules
```

### Key mechanics

- `require()` is **synchronous** — it reads and executes the target file immediately, blocking until done, and returns `module.exports` from that file.
- Every file is wrapped by Node in a function before it runs, which is how `require`, `module`, `exports`, `__dirname`, and `__filename` become available without you importing them (more in Lesson 4):

```javascript
// Conceptually, Node wraps every CJS file like this before running it:
(function (exports, require, module, __filename, __dirname) {
  // your file's actual code goes here
});
```

- **Modules are cached.** The first `require('./math')` executes the file and caches the result; every subsequent `require('./math')` anywhere in the app returns the same cached object instantly, without re-running the file.

```javascript
// counter.js
let count = 0;
module.exports = {
  increment: () => ++count,
  getCount: () => count,
};
```

```javascript
// a.js
const counter = require('./counter');
counter.increment();

// b.js
const counter = require('./counter');
console.log(counter.getCount()); // 1 — same cached instance, not a fresh module
```

---

## 3. How CommonJS Module Resolution Works

When you call `require('something')`, Node follows a specific, predictable algorithm to figure out which file to load.

```
require('./math')          → relative path: look for exact file
require('/abs/path/math')  → absolute path: look for exact file
require('express')          → bare specifier: search node_modules
require('fs')                → matches a built-in core module name: use that
```

### Resolving relative and absolute paths (`./math`, `../utils/math`)

```
require('./math')
   │
   ├── 1. Try ./math.js               → found? use it.
   ├── 2. Try ./math.json             → found? parse as JSON, use it.
   ├── 3. Try ./math.node             → found? use it (compiled addon).
   ├── 4. Try ./math/package.json's "main" field  → found? use that file.
   └── 5. Try ./math/index.js         → found? use it.
                otherwise: throw "Cannot find module"
```

### Resolving bare specifiers (`require('express')`)

Node does **not** search a single global location — it walks up the directory tree looking for a `node_modules` folder at each level, starting from the requiring file's own directory:

```
/Users/you/projects/my-app/src/routes/users.js
    requires 'express'

Node searches, in order:
  1. /Users/you/projects/my-app/src/routes/node_modules/express
  2. /Users/you/projects/my-app/src/node_modules/express
  3. /Users/you/projects/my-app/node_modules/express        ← usually found here
  4. /Users/you/projects/node_modules/express
  5. /Users/you/node_modules/express
  6. /Users/node_modules/express
  7. /node_modules/express
     otherwise: throw "Cannot find module 'express'"
```

This is exactly why running `npm install` at your project root creates a single `node_modules` folder there, and every file anywhere inside the project — no matter how deeply nested — can still `require('express')` successfully, since Node keeps walking upward until it finds a match.

### Core modules

Names like `fs`, `path`, `http`, `os`, and `process` are built directly into the Node binary — no `node_modules` lookup happens at all; Node recognizes the name and returns its internal implementation immediately, which is also faster than filesystem lookups.

---

## 4. ES Modules: import and export

ESM is the module system built into the JavaScript language itself (not Node-specific) — the same syntax you already use in React/browser code with a bundler like Vite or webpack.

### Named exports

```javascript
// math.mjs (or math.js with "type": "module" in package.json)
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

export const PI = 3.14159;
```

```javascript
// app.mjs
import { add, subtract, PI } from './math.mjs';
console.log(add(2, 3)); // 5
```

### Default exports

```javascript
// logger.mjs
export default function log(message) {
  console.log(`[LOG] ${message}`);
}
```

```javascript
// app.mjs
import log from './logger.mjs';   // no curly braces — it's the default export
log('server started');
```

### Mixing named and default, and renaming

```javascript
// utils.mjs
export default function main() { /* ... */ }
export const helperA = () => {};
export const helperB = () => {};
```

```javascript
import main, { helperA, helperB as renamedHelper } from './utils.mjs';
```

### Importing built-in and npm packages with ESM

```javascript
import express from 'express';          // default export of the express package
import { readFile } from 'fs/promises'; // named export from a core module
import fs from 'fs';                     // or the whole module as a namespace-like default
```

### Dynamic import

Unlike `require`, `import` statements are normally static (evaluated at the top of the file, before any code runs). For conditional or lazy loading, use the `import()` function, which returns a Promise:

```javascript
async function loadFeature(condition) {
  if (condition) {
    const { feature } = await import('./feature.mjs');
    feature();
  }
}
```

---

## 5. Enabling ESM: "type": "module"

By default, Node treats `.js` files as **CommonJS**. To use `import`/`export` syntax in `.js` files, you have three options:

```
Option 1: File extension
  Name the file .mjs → always treated as ESM, regardless of package.json.
  Name the file .cjs → always treated as CommonJS, regardless of package.json.

Option 2: package.json "type" field
  { "type": "module" }    → all .js files in this package are ESM
  { "type": "commonjs" }  → all .js files in this package are CJS (this is the default)

Option 3: Mix explicitly with extensions
  Keep "type": "commonjs" (or omit it) but name specific files .mjs
  when you want ESM just for those.
```

```json
{
  "name": "my-esm-app",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  }
}
```

With `"type": "module"` set, every plain `.js` file in that package must use `import`/`export` — using `require()` there will throw `ReferenceError: require is not defined in ES module scope`.

```
package.json has "type": "module"?
   │
   ├── Yes → .js files are ESM (import/export). Use .cjs for any file
   │          that still needs require/module.exports.
   │
   └── No (default / "type": "commonjs") → .js files are CJS (require).
              Use .mjs for any file that needs import/export.
```

---

## 6. CJS vs ESM: Key Differences

| | CommonJS | ES Modules |
|---|---|---|
| Import syntax | `require('./mod')` | `import x from './mod.js'` |
| Export syntax | `module.exports = ...` | `export`, `export default` |
| Loading | Synchronous | Asynchronous (supports top-level `await`) |
| When resolved | At runtime, as code executes line by line | Statically analyzed before execution (imports are hoisted) |
| File extension needed in import path | Optional (`require('./math')` works without `.js`) | Required in Node (`import './math.js'`, extension mandatory) |
| `this` at module top level | `module.exports` (an empty object initially) | `undefined` |
| `__dirname` / `__filename` | Available automatically | Not available — must derive from `import.meta.url` |
| Conditional/lazy loading | `require()` can be called anywhere, anytime, inside an `if` | Static `import` must be top-level; use `import()` (returns a Promise) for conditional loading |
| Tree-shaking (dead code elimination by bundlers) | Hard — exports are dynamic objects, bundlers can't always tell what's unused | Easier — static structure lets bundlers like webpack/Vite/Rollup eliminate unused exports |
| Origin | Node.js-specific convention (predates ES6) | Official ECMAScript language standard |

Getting `__dirname` in an ESM file:

```javascript
// In CJS, __dirname just exists.
// In ESM, you derive it yourself:
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(__dirname);
```

---

## 7. Interop Between CommonJS and ESM

Real projects often need both systems to coexist — for example, an ESM project depending on an older package that only ships CommonJS.

### ESM importing a CommonJS package (works smoothly)

```javascript
// This works fine even in a "type": "module" project,
// because Node provides automatic CJS→ESM interop for named default access:
import express from 'express';   // express is a CJS package; this works
import _ from 'lodash';           // same here
```

Node wraps the CJS module's `module.exports` as the default export automatically. Named exports from CJS are also usually detectable via static analysis, but it's not always perfectly reliable — `import { something } from 'cjs-package'` can fail in edge cases, whereas `import pkg from 'cjs-package'; pkg.something` always works.

### CommonJS requiring an ES Module (does NOT work directly)

```javascript
// This throws an error — CJS's synchronous require() cannot load
// a module that may use top-level await or async resolution:
const mod = require('./esm-only-file.mjs'); // ERROR: Cannot require an ES Module
```

```
CJS require() → synchronous, wants an immediate answer
ESM module    → may need async resolution (top-level await)
─────────────────────────────────────────────────────────
Mismatch → CJS cannot require() a genuine ESM file directly.
```

The workaround is dynamic `import()`, which returns a Promise and works from CJS too:

```javascript
// From a CommonJS file:
async function main() {
  const mod = await import('./esm-only-file.mjs');
  mod.doSomething();
}
main();
```

### Practical guidance

```
Starting a brand-new Node/Express project today?
  → Use "type": "module" and import/export throughout.
    It's the modern standard and matches your React frontend syntax.

Working in/maintaining an existing large CommonJS codebase?
  → Stick with require/module.exports for consistency; introducing
    ESM halfway through a mature CJS project adds interop friction
    without much practical benefit.
```

---

## 8. Hands-On Exercises

**Exercise 1:** Create `math.js` using CommonJS (`module.exports = { add, subtract }`) and `app.js` that `require`s it and logs both function results. Run it with `node app.js`.

**Exercise 2:** Convert the same two files to ESM: rename them `math.mjs`/`app.mjs` (or add `"type": "module"` to a `package.json` and keep the `.js` extension), rewriting `module.exports`/`require` as `export`/`import`. Confirm it still runs identically with `node app.mjs` (or `node app.js`).

**Exercise 3:** Create two files, `counter.js` (CJS) with a module-level `let count = 0` and exported `increment`/`getCount` functions. `require` it from two different files and call `increment()` from one, then `getCount()` from the other — confirm the count is shared (proving module caching), not reset to 0.

**Exercise 4:** In an ESM file, derive `__dirname` using `import.meta.url`, `fileURLToPath`, and `dirname`, then `console.log` it. Compare against a CJS file in the same folder that just logs the built-in `__dirname` directly.

**Exercise 5:** Deliberately trigger the CJS→ESM `require` error: create `greet.mjs` with a simple `export default` function, then try `require('./greet.mjs')` from a `.js` CommonJS file. Read the exact error Node throws, then fix it using a dynamic `import()` inside an `async` function instead.

---

## 9. Interview Q&A

**Q: What is the difference between CommonJS and ES Modules in Node.js?**
Answer: CommonJS is Node's original, Node-specific module system using `require()`/`module.exports`, and it resolves modules synchronously at runtime. ES Modules (ESM) is the official JavaScript language standard using `import`/`export`, resolved statically (import statements are hoisted and analyzed before code runs), and it supports asynchronous features like top-level `await`. Node defaults `.js` files to CommonJS unless the nearest `package.json` sets `"type": "module"`, or the file uses a `.mjs` extension.

**Q: Why does reassigning `exports` directly not work in CommonJS, but `module.exports` does?**
Answer: `exports` is just a local variable that initially points to the same object as `module.exports`. Writing `exports.foo = bar` mutates that shared object, which works fine. But writing `exports = { foo: bar }` reassigns the local `exports` variable to point to a brand-new object, breaking its link to `module.exports` — Node still returns whatever `module.exports` references (the original, now-stale object), so your reassignment is silently ignored by anything that `require()`s the file. The safe pattern is always assigning to `module.exports` directly when replacing the whole export.

**Q: Are CommonJS modules cached? What does that mean in practice?**
Answer: Yes — Node caches the result of `require()` keyed by the resolved file path. The first `require('./x')` executes the module's code and stores its `module.exports` value; every subsequent `require('./x')` anywhere else in the app returns that same cached object instantly without re-running the file. This means module-level state (like a counter variable) is shared across every file that requires it, which is a common source of both useful singleton patterns and subtle bugs if unexpected.

**Q: How does Node resolve `require('express')` versus `require('./utils')`?**
Answer: A relative path like `./utils` is resolved directly against the requiring file's directory, trying `./utils.js`, `./utils.json`, then `./utils/index.js`, etc. A bare specifier like `express` (no `./` or `/` prefix) triggers Node's `node_modules` search algorithm: it looks for a `node_modules/express` folder starting in the current directory, then walks up the parent directory chain (`../node_modules`, `../../node_modules`, and so on) until it finds a match or reaches the filesystem root, at which point it throws `Cannot find module`.

**Q: Can a CommonJS file `require()` an ES Module, or vice versa?**
Answer: ESM importing CommonJS generally works — Node automatically wraps a CJS module's `module.exports` as the ESM default export, so `import express from 'express'` works fine even in a `"type": "module"` project. The reverse does not work directly: CommonJS's `require()` is synchronous and cannot load a genuine ES Module, which may rely on asynchronous resolution (e.g., top-level `await`); attempting it throws an error. The workaround is using the asynchronous `import()` function from within an `async` function in the CommonJS file.

**Q: How do you enable ES Modules in a Node.js project, and what are the tradeoffs of each method?**
Answer: You can either add `"type": "module"` to `package.json`, which makes all `.js` files in that package ESM (with `.cjs` used as an escape hatch for any file that still needs CommonJS), or you can name individual files with the `.mjs` extension regardless of the `package.json` setting, leaving the rest of the project as CommonJS. Setting `"type": "module"` project-wide is cleaner for new projects and matches modern JavaScript/React conventions, but it removes automatic access to `__dirname`/`__filename` and requires explicit file extensions in relative imports, which can require adjusting existing CommonJS-style code.
