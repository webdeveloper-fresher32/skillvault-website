---
# JavaScript Quick Reference — Cheatsheet

---

### Variables & Data Types

```js
// Declarations
var oldWay = "function-scoped, hoisted, avoid";
let mutable = "block-scoped, reassignable";
const fixed = "block-scoped, cannot be reassigned";

// Primitive types
typeof 42;               // "number"
typeof 3.14;             // "number"
typeof "text";            // "string"
typeof true;              // "boolean"
typeof undefined;         // "undefined"
typeof Symbol("id");      // "symbol"
typeof 10n;               // "bigint"
typeof null;              // "object" (famous JS quirk)

// Reference types
typeof {};                // "object"
typeof [];                 // "object"
typeof function () {};     // "function"

// Type checks
Array.isArray([1, 2]);            // true
Number.isInteger(5);               // true
Number.isNaN(NaN);                  // true (safer than global isNaN)
Object.prototype.toString.call([]); // "[object Array]"

// Type conversion
Number("42");        // 42
String(42);           // "42"
Boolean(0);            // false
parseInt("42px", 10);  // 42
parseFloat("3.14m");   // 3.14
!!"non-empty";          // true (truthy coercion)
```

---

### Operators

```js
// Arithmetic
5 + 2; 5 - 2; 5 * 2; 5 / 2; 5 % 2; 5 ** 2;  // exponent
let x = 5; x++; x--; x += 3; x -= 1; x *= 2;

// Comparison
5 == "5";   // true  (loose equality, coerces types)
5 === "5";  // false (strict equality, no coercion — prefer this)
5 !== "5";  // true
1 < 2 && 2 < 3;   // logical AND
1 < 2 || 2 > 3;   // logical OR
!true;             // logical NOT

// Nullish & optional
let a = null ?? "default";     // "default" (only null/undefined trigger fallback)
let b = 0 ?? "default";         // 0 (0 is not null/undefined)
let c = obj?.prop?.nested;       // optional chaining, undefined if missing
obj?.method?.();                 // optional call

// Assignment shorthand (ES2021)
a ||= "fallback";   // assign if falsy
a &&= "newValue";    // assign if truthy
a ??= "fallback";     // assign if null/undefined

// Ternary
let result = age >= 18 ? "adult" : "minor";

// Spread/rest markers
[...arr1, ...arr2];
{ ...obj1, ...obj2 };
```

---

### Control Flow

```js
// if / else if / else
if (score >= 90) {
  grade = "A";
} else if (score >= 80) {
  grade = "B";
} else {
  grade = "C";
}

// switch
switch (day) {
  case "Mon":
  case "Tue":
    console.log("early week");
    break;
  case "Fri":
    console.log("almost weekend");
    break;
  default:
    console.log("midweek");
}

// Ternary chains
let label = score >= 90 ? "A" : score >= 80 ? "B" : "C";

// Short-circuit patterns
isLoggedIn && renderDashboard();
user.name || "Anonymous";
```

---

### Loops

```js
for (let i = 0; i < 5; i++) console.log(i);

// for...of — iterates VALUES (arrays, strings, Maps, Sets)
for (const value of [10, 20, 30]) console.log(value);

// for...in — iterates KEYS/indices (objects — avoid on arrays)
for (const key in { a: 1, b: 2 }) console.log(key);

// while / do-while
let i = 0;
while (i < 5) { console.log(i); i++; }

let j = 0;
do { console.log(j); j++; } while (j < 5);

// break / continue
for (let i = 0; i < 10; i++) {
  if (i === 3) continue;   // skip
  if (i === 7) break;      // exit
}

// Array iteration helpers (preferred in modern code)
[1, 2, 3].forEach((n, i) => console.log(n, i));
```

---

### Functions

```js
// Function declaration (hoisted)
function add(a, b) { return a + b; }

// Function expression (not hoisted)
const subtract = function (a, b) { return a - b; };

// Arrow function (no own `this`, `arguments`, or `super`)
const multiply = (a, b) => a * b;
const square = n => n * n;              // single param, no parens needed
const noop = () => {};                    // empty body
const makeObj = () => ({ key: "value" }); // wrap object literal in parens

// Default parameters
function greet(name = "Guest") { return `Hello, ${name}`; }

// Rest parameters
function sum(...nums) { return nums.reduce((a, b) => a + b, 0); }

// IIFE (Immediately Invoked Function Expression)
(function () { console.log("runs immediately"); })();

// Named function expression (useful for recursion/stack traces)
const factorial = function fact(n) { return n <= 1 ? 1 : n * fact(n - 1); };

// Higher-order functions
function withLogging(fn) {
  return (...args) => { console.log("calling", fn.name); return fn(...args); };
}
```

---

### Arrays

```js
const arr = [1, 2, 3, 4, 5];

// Adding / removing
arr.push(6);          // add to end, returns new length
arr.pop();              // remove from end, returns removed item
arr.unshift(0);          // add to start
arr.shift();              // remove from start
arr.splice(1, 2, "a");    // remove 2 items at index 1, insert "a"
arr.slice(1, 3);           // shallow copy [1,3) — non-mutating

// Searching
arr.indexOf(3);           // first index or -1
arr.lastIndexOf(3);        // last index or -1
arr.includes(3);            // true/false
arr.find(n => n > 3);        // first matching element
arr.findIndex(n => n > 3);   // first matching index
arr.findLast(n => n > 3);     // last matching element (ES2023)
arr.at(-1);                    // last element (supports negative index)

// Transforming
arr.map(n => n * 2);              // new array, transformed
arr.filter(n => n % 2 === 0);      // new array, matching items
arr.reduce((acc, n) => acc + n, 0); // single accumulated value
arr.reduceRight((acc, n) => acc + n, 0);
arr.flat(Infinity);                  // flatten nested arrays
arr.flatMap(n => [n, n * 2]);          // map + flatten one level
arr.sort((a, b) => a - b);              // in-place sort, ascending numbers
arr.reverse();                            // in-place reverse
arr.fill(0, 1, 3);                          // fill indices [1,3) with 0

// Testing
arr.every(n => n > 0);    // true if ALL pass
arr.some(n => n > 4);      // true if ANY pass

// Iterating / combining
arr.forEach(n => console.log(n));
arr.join("-");                // "1-2-3-4-5"
arr.concat([6, 7]);            // new merged array
Array.from({ length: 5 }, (_, i) => i);  // [0,1,2,3,4]
Array.of(1, 2, 3);                          // [1,2,3]
Array.isArray(arr);                          // true

// map vs filter vs reduce — quick rule of thumb
// map:    transform each item, same length out
// filter: keep some items, shorter/equal length out
// reduce: collapse into a single value (number, object, array)
```

---

### Objects

```js
// Creation
const user = { name: "Ana", age: 30 };
const empty = new Object();
const proto = Object.create(null);   // object with no prototype chain

// Property access
user.name;          // dot notation
user["name"];        // bracket notation (needed for dynamic keys)
user.address?.city;   // optional chaining

// Methods
Object.keys(user);          // ["name", "age"]
Object.values(user);          // ["Ana", 30]
Object.entries(user);          // [["name","Ana"], ["age",30]]
Object.fromEntries([["a", 1]]); // { a: 1 }
Object.assign({}, user, { age: 31 }); // shallow merge (mutates first arg)
{ ...user, age: 31 };                  // shallow merge, non-mutating (preferred)

// Freezing / sealing
Object.freeze(user);      // no add/remove/edit properties
Object.isFrozen(user);      // true
Object.seal(user);            // no add/remove, but can edit existing
Object.getPrototypeOf(user);   // Object.prototype

// Property descriptors
Object.defineProperty(user, "id", { value: 1, writable: false });
Object.getOwnPropertyDescriptor(user, "name");

// Checking keys
"name" in user;                 // true (checks prototype chain too)
user.hasOwnProperty("name");     // true (own property only)

// Shorthand syntax
const name = "Ana", age = 30;
const shorthand = { name, age };        // property shorthand
const withMethods = {
  greet() { return `Hi, ${name}`; },      // method shorthand
  [`computed_${age}`]: true,               // computed property key
};
```

---

### Destructuring & Spread

```js
// Array destructuring
const [first, second, ...rest] = [1, 2, 3, 4];
const [, , third] = [1, 2, 3];         // skip elements
const [a = 10, b = 20] = [undefined];    // defaults -> a=10, b=20

// Object destructuring
const { name, age } = user;
const { name: userName } = user;          // rename
const { role = "guest" } = user;            // default value
const { address: { city } = {} } = user;     // nested with fallback

// Swapping
[a, b] = [b, a];

// Function parameter destructuring
function printUser({ name, age = 18 }) { console.log(name, age); }

// Spread (expand)
const combined = [...arr1, ...arr2];
const merged = { ...obj1, ...obj2 };
function sum3(...nums) { return nums.reduce((s, n) => s + n); } // rest here

// Spread in function calls
Math.max(...[1, 5, 3]);
```

---

### Closures & `this`

```js
// Closure: inner function retains access to outer scope after outer returns
function makeCounter() {
  let count = 0;
  return () => ++count;
}
const counter = makeCounter();
counter(); // 1
counter(); // 2

// `this` binding rules (in order of precedence):
// 1. new Foo()          -> this = the newly created object
// 2. fn.call/apply/bind -> this = explicitly provided object
// 3. obj.method()        -> this = obj (the object left of the dot)
// 4. plain function()     -> this = undefined (strict mode) or global object
// 5. arrow function        -> this = lexical, inherited from enclosing scope

const obj = {
  value: 42,
  regular: function () { return this.value; },   // this = obj when called as obj.regular()
  arrow: () => this,                                // this = enclosing scope, NOT obj
};

function greetAs(greeting) { return `${greeting}, ${this.name}`; }
greetAs.call({ name: "Ana" }, "Hi");     // invoke with explicit `this`
greetAs.apply({ name: "Ana" }, ["Hi"]);   // like call, args as array
const bound = greetAs.bind({ name: "Ana" }); // returns new fn with `this` locked
```

---

### Classes & Prototypes

```js
class Animal {
  #privateField = "hidden";       // private field (ES2022)
  static count = 0;                  // static property

  constructor(name) {
    this.name = name;
    Animal.count++;
  }

  speak() { return `${this.name} makes a sound`; }     // prototype method
  get label() { return `[${this.name}]`; }               // getter
  set label(value) { this.name = value; }                 // setter
  static create(name) { return new Animal(name); }         // static method
}

class Dog extends Animal {
  speak() {
    return `${super.speak()}, specifically barks`;   // call parent method
  }
}

const rex = new Dog("Rex");
rex instanceof Animal;   // true
rex.speak();

// Underlying prototype mechanics (what `class` sugar compiles to)
function Cat(name) { this.name = name; }
Cat.prototype.speak = function () { return `${this.name} meows`; };
const felix = new Cat("Felix");
Object.getPrototypeOf(felix) === Cat.prototype; // true
```

---

### Promises & Async/Await

```js
// Creating a promise
const wait = (ms) => new Promise((resolve, reject) => {
  setTimeout(() => resolve(`waited ${ms}ms`), ms);
});

// Consuming with .then/.catch/.finally
wait(100)
  .then(result => console.log(result))
  .catch(err => console.error(err))
  .finally(() => console.log("done"));

// async/await (syntactic sugar over promises)
async function run() {
  try {
    const result = await wait(100);
    console.log(result);
  } catch (err) {
    console.error(err);
  }
}

// Combinators
Promise.all([p1, p2, p3]);          // rejects fast if any rejects
Promise.allSettled([p1, p2, p3]);     // never rejects, returns status per promise
Promise.race([p1, p2]);                 // settles as soon as ONE settles
Promise.any([p1, p2]);                    // resolves as soon as ONE resolves

// Immediately resolved/rejected
Promise.resolve(42);
Promise.reject(new Error("failed"));
```

---

### Event Loop Quick Model

```
Call Stack  →  runs synchronous code, one frame at a time
Web APIs    →  setTimeout, fetch, DOM events run outside the stack
Microtask Q →  Promise .then/.catch/.finally, queueMicrotask, async/await continuations
Macrotask Q →  setTimeout, setInterval, I/O, UI rendering

Order per loop tick:
1. Run all synchronous code (call stack empties)
2. Drain the ENTIRE microtask queue
3. Run ONE macrotask
4. Drain microtask queue again
5. Repeat

console.log("1");
setTimeout(() => console.log("2"), 0);   // macrotask
Promise.resolve().then(() => console.log("3")); // microtask
console.log("4");
// Output: 1, 4, 3, 2  (microtasks always beat the next macrotask)
```

---

### ES6+ Features

```js
// Optional chaining & nullish coalescing
user?.profile?.avatar ?? "/default.png";

// Template literals
const name = "Ana";
`Hello, ${name}! ${1 + 1}`;
const tag = (strings, ...values) => strings.raw.join("|");

// Sets — unique values
const set = new Set([1, 2, 2, 3]);
set.add(4); set.has(2); set.delete(1); set.size; [...set];

// Maps — key-value pairs with any key type
const map = new Map([["a", 1]]);
map.set("b", 2); map.get("a"); map.has("b"); map.delete("a"); map.size;
for (const [k, v] of map) console.log(k, v);

// WeakMap / WeakSet — keys garbage-collected, no iteration
const wm = new WeakMap();

// Generators — pausable functions
function* idGenerator() {
  let id = 1;
  while (true) yield id++;
}
const gen = idGenerator();
gen.next().value; // 1
gen.next().value; // 2

// Symbols — unique identifiers
const sym = Symbol("id");

// Modules (ESM)
export const PI = 3.14;
export default function main() {}
import main, { PI } from "./module.js";

// Array/object destructuring defaults + computed properties covered above

// String helpers
"  hi  ".trim(); "hi".padStart(5, "0"); "hi".at(-1); "Hi".replaceAll("i", "o");
```

---

### DOM Quick Reference

```js
// Selecting elements
document.getElementById("app");
document.querySelector(".card");           // first match
document.querySelectorAll("li");            // NodeList of all matches
document.getElementsByClassName("item");     // live HTMLCollection
document.getElementsByTagName("div");

// Creating & modifying elements
const div = document.createElement("div");
div.textContent = "Hello";
div.innerHTML = "<b>Bold</b>";
div.classList.add("active");
div.classList.remove("hidden");
div.classList.toggle("open");
div.setAttribute("data-id", "42");
div.getAttribute("data-id");
div.style.color = "red";

// Inserting into the DOM
parent.appendChild(div);
parent.append(div, "text node");
parent.prepend(div);
parent.insertBefore(div, referenceNode);
div.remove();

// Events
button.addEventListener("click", (e) => console.log(e.target));
button.removeEventListener("click", handler);
button.addEventListener("click", handler, { once: true });

// Event delegation (attach one listener to a parent)
list.addEventListener("click", (e) => {
  if (e.target.matches("li")) console.log("clicked", e.target.textContent);
});

// Bubbling vs capturing
e.stopPropagation();     // stop the event from bubbling further
e.preventDefault();        // stop default browser action (e.g., form submit)
```

---

### Browser Storage APIs

```js
// localStorage — persists until explicitly cleared
localStorage.setItem("token", "abc123");
localStorage.getItem("token");
localStorage.removeItem("token");
localStorage.clear();

// sessionStorage — cleared when the tab closes
sessionStorage.setItem("draft", JSON.stringify({ title: "Untitled" }));
JSON.parse(sessionStorage.getItem("draft"));

// Cookies — sent with every HTTP request, small size limit
document.cookie = "theme=dark; max-age=86400; path=/";

// IndexedDB — for larger structured/offline data (async, more setup)
// const request = indexedDB.open("MyDB", 1);
```

---

### Node.js Core Module Quick Reference

```js
// fs — file system
const fs = require("fs");
fs.readFileSync("file.txt", "utf8");
fs.writeFileSync("file.txt", "content");
fs.appendFileSync("file.txt", "more");
fs.existsSync("file.txt");

// Promise-based (preferred for async code)
const fsp = require("fs/promises");
await fsp.readFile("file.txt", "utf8");
await fsp.writeFile("file.txt", "content");

// path — cross-platform path handling
const path = require("path");
path.join("dir", "sub", "file.txt");
path.resolve("file.txt");            // absolute path
path.extname("file.txt");              // ".txt"
path.basename("/a/b/file.txt");         // "file.txt"
path.dirname("/a/b/file.txt");           // "/a/b"

// process — runtime info & control
process.argv;                // CLI arguments
process.env.NODE_ENV;         // environment variables
process.exit(1);               // exit with code
process.cwd();                   // current working directory
process.on("exit", () => {});     // lifecycle hooks
```

---

### Express.js Quick Reference

```js
const express = require("express");
const app = express();

// Middleware
app.use(express.json());               // parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => { console.log(req.method, req.url); next(); }); // custom logger

// Routing
app.get("/users", (req, res) => res.json({ users: [] }));
app.post("/users", (req, res) => res.status(201).json(req.body));
app.get("/users/:id", (req, res) => res.json({ id: req.params.id }));
app.put("/users/:id", (req, res) => res.sendStatus(200));
app.delete("/users/:id", (req, res) => res.sendStatus(204));

// Router modules
const router = express.Router();
router.get("/", (req, res) => res.send("list"));
app.use("/api/items", router);

// Error handling middleware (must have 4 args)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// Start server
app.listen(3000, () => console.log("Server running on port 3000"));
```

**Common HTTP status codes**

| Code | Meaning | Typical Use |
|------|---------|-------------|
| 200 | OK | Successful GET/PUT |
| 201 | Created | Successful POST that created a resource |
| 204 | No Content | Successful DELETE, no body returned |
| 301 | Moved Permanently | Permanent redirect |
| 304 | Not Modified | Cached response is still valid |
| 400 | Bad Request | Malformed request/invalid input |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Authenticated but not permitted |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource / state conflict |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled server exception |
| 503 | Service Unavailable | Server temporarily overloaded/down |

---

### npm / package.json Quick Commands

```bash
# Project setup
npm init -y                    # create package.json with defaults

# Installing packages
npm install express              # save as a dependency
npm install --save-dev jest        # save as a devDependency
npm install -g nodemon               # install globally
npm install express@4.18.2             # install a specific version
npm uninstall express                    # remove a package

# Running scripts (defined in "scripts" in package.json)
npm run dev
npm start
npm test

# Housekeeping
npm list --depth=0            # list top-level installed packages
npm outdated                     # check for outdated packages
npm update                          # update within semver ranges
npm audit                             # check for vulnerabilities
npm audit fix                           # auto-fix vulnerabilities
npx cowsay "hi"                            # run a package without installing it globally

# package.json essentials
# {
#   "name": "my-app",
#   "version": "1.0.0",
#   "main": "index.js",
#   "type": "module",
#   "scripts": { "start": "node index.js", "dev": "nodemon index.js" },
#   "dependencies": { "express": "^4.18.2" },
#   "devDependencies": { "jest": "^29.0.0" }
# }
```

---
