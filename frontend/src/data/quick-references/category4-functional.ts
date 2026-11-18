import { QuickReferenceTopic } from './types';

export const category4Functional: QuickReferenceTopic[] = [
  {
    id: 'higher-order-functions',
    number: 18,
    title: 'Higher-Order Functions',
    category: 'Functional JavaScript',
    categorySlug: 'functional',
    estimatedMinutes: 5,
    concept30Sec:
      'A Higher-Order Function (HOF) is a function that either takes one or more functions as arguments, returns a function as its result, or both. Higher-order functions are made possible in JavaScript because functions are first-class citizens (they can be assigned to variables, passed as arguments, and returned from other functions).',
    internals: {
      overview:
        'In V8, functions are objects of type JSFunction with an internal [[Call]] method and a closure pointer to their Lexical Environment. When an HOF returns a function, the returned function retains access to the outer function\'s parameter and variable bindings via heap-allocated closure contexts. This powers function currying, composition, memoization, and aspect-oriented programming.',
      flowSteps: [
        'First-Class Treatment: Functions are treated as values stored on the heap.',
        'Accepting Function: Outer function receives a function pointer as a parameter and invokes it on demand.',
        'Returning Function: Outer function constructs and returns a new function bound to the outer closure scope.',
        'Deferred Execution: The returned function can be executed at any future point in time.'
      ],
      diagram: `HIGHER-ORDER FUNCTION ARCHITECTURE:
[ Arguments: Config / Function ]
               |
               v
      +------------------+
      |      H.O.F       | ---> Generates Closure Context on Heap
      +------------------+
               |
               v
[ Returns Wrapped Function ] ---> Executes later with pre-configured behavior!`
    },
    codeExample: {
      code: `// Higher-Order Function: Async Error Handler / Wrapper for Express controllers
function asyncHandler(fn) {
  return function (req, res, next) {
    // Executes the controller fn and catches any rejected promises automatically
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Simulated Express Controller
const fetchUserData = async (req, res) => {
  if (!req.params.id) throw new Error('User ID is missing');
  return { id: req.params.id, username: 'octocat' };
};

// Wrapping controller with HOF:
const safeRouteHandler = asyncHandler(fetchUserData);

// Testing execution:
const fakeReq = { params: { id: 'usr_7' } };
const fakeRes = {};
const fakeNext = (err) => console.log('Passed to next:', err?.message);

safeRouteHandler(fakeReq, fakeRes, fakeNext);
console.log('asyncHandler generated callable route handler successfully.');`,
      language: 'javascript',
      output: `asyncHandler generated callable route handler successfully.`,
      whyOutput:
        'asyncHandler takes a function (fetchUserData) as an argument and returns a new wrapper function. The returned function executes fetchUserData and wraps the returned Promise, ensuring any unhandled error is forwarded to Express\'s next() error handler.',
      annotations: [
        'Line 2: asyncHandler takes a function as an argument and returns a function (HOF).',
        'Line 5: Automatically catches asynchronous promise rejections without try/catch boilerplate.',
        'Line 16: Controller logic remains clean and focused solely on business rules.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Express asyncHandler Wrappers & Decorators for Telemetry/Retry',
      description:
        'HOFs are the backbone of Node.js production architectures. They eliminate repetitive try/catch boilerplate across hundreds of Express/Fastify routes, provide automatic database query retry logic, enforce authentication/RBAC guards, and attach OpenTelemetry performance timings.',
      codeSnippet: `// Database query retry decorator using HOF
function withRetry(fn, maxRetries = 3, delayMs = 500) {
  return async function (...args) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await fn(...args);
      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) throw err;
        await new Promise(res => setTimeout(res, delayMs));
      }
    }
  };
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What qualifies a function as a Higher-Order Function?',
          spokenAnswer:
            'A function is higher-order if it does at least one of the following: 1) Accepts one or more functions as arguments (e.g. Array.prototype.map, setTimeout); or 2) Returns another function as its result (e.g. function factories, currying, middleware wrappers).'
        },
        {
          question: 'What is Function Composition?',
          spokenAnswer:
            'Function composition is the process of combining two or more functions to produce a new function: compose(f, g)(x) === f(g(x)). The output of the inner function becomes the input of the outer function.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the difference between Currying and Partial Application?',
        answer:
          'Currying transforms a function of N arguments into a sequence of N unary functions (each taking exactly one argument). Partial application fixes a subset of arguments on a function, returning a new function that takes all the remaining arguments at once.'
      },
      commonMistakes: [
        'Confusing Higher-Order Functions with Callback Functions (a callback is the function passed IN; an HOF is the function that RECEIVES or RETURNS it).',
        'Creating new HOF closures inside render loops or high-frequency loops, causing unnecessary garbage collection.'
      ]
    },
    quickRevision: {
      takeaways: [
        'HOF = takes a function as argument OR returns a function.',
        'Enabled because functions are first-class citizens in JavaScript.',
        'Powers Express middleware, async wrappers, currying, and memoization.',
        'Array methods (.map, .filter, .reduce) are built-in HOFs.'
      ],
      oneLineDefinition:
        'A Higher-Order Function is a function that accepts other functions as arguments or returns a function as its output.',
      interviewTip:
        'Distinguish between the HOF (the wrapper/container function) and the callback (the function passed into the HOF).'
    }
  },

  {
    id: 'callback-functions',
    number: 19,
    title: 'Callback Functions',
    category: 'Functional JavaScript',
    categorySlug: 'functional',
    estimatedMinutes: 5,
    concept30Sec:
      'A Callback Function is a function passed into another function as an argument, intended to be executed at a later time. Callbacks can be synchronous (executed immediately during the execution of the higher-order function, e.g. Array.forEach) or asynchronous (executed after an I/O operation or timer completes, e.g. fs.readFile, setTimeout).',
    internals: {
      overview:
        'Synchronous callbacks execute directly on the current Call Stack. Asynchronous callbacks are registered with Node.js\'s underlying Libuv C++ thread pool or OS event demultiplexer (epoll/kqueue). When the I/O finishes, Libuv enqueues the callback into the Event Loop\'s Task Queue. Once the Call Stack is empty, the Event Loop pushes the callback onto the Call Stack for execution.',
      flowSteps: [
        'Synchronous: Parent function invokes callback immediately on the active call stack frame.',
        'Asynchronous Registration: Callback passed to Node.js native API (fs, net, timers); handed off to Libuv.',
        'I/O Completion: Worker thread or OS notifies Libuv; callback placed into Event Loop queue.',
        'Execution: Event Loop transfers callback to Call Stack once Call Stack clears.',
        'Error-First Convention: In Node.js callbacks, the first parameter is reserved for an Error object (or null if successful).'
      ],
      diagram: `ASYNCHRONOUS CALLBACK LIFECYCLE (Node.js Libuv):
1. fs.readFile('data.json', callback)
       |
       v (Hands off to Libuv thread pool)
2. Libuv reads file from disk asynchronously
       |
       v (On completion)
3. Callback enqueued into Event Loop Poll Queue
       |
       v (When Call Stack is 100% empty)
4. Callback pushed to Call Stack: callback(null, fileBuffer)`
    },
    codeExample: {
      code: `// 1. Synchronous Callback: Executes immediately in-place
const numbers = [10, 20, 30];
console.log('Before sync callback');
numbers.forEach((n) => {
  // Executes synchronously on the current call stack
  console.log('Sync processing:', n);
});
console.log('After sync callback');

// 2. Asynchronous Error-First Callback (Node.js Convention)
function simulateAsyncDbQuery(query, callback) {
  setTimeout(() => {
    if (!query) {
      return callback(new Error('Query string is required'));
    }
    const result = { rows: [{ id: 1, name: 'Alice' }], count: 1 };
    callback(null, result); // Error is null on success!
  }, 10);
}

simulateAsyncDbQuery('SELECT * FROM users', (err, data) => {
  if (err) {
    console.error('DB Error:', err.message);
    return;
  }
  console.log('DB Query Succeeded. Rows returned:', data.count);
});`,
      language: 'javascript',
      output: `Before sync callback
Sync processing: 10
Sync processing: 20
Sync processing: 30
After sync callback
DB Query Succeeded. Rows returned: 1`,
      whyOutput:
        'The forEach callback executes synchronously before "After sync callback" is logged. simulateAsyncDbQuery registers a timer with the Node.js runtime and returns immediately; its callback is executed asynchronously in a subsequent tick of the Event Loop once the timer expires.',
      annotations: [
        'Line 4: forEach callback runs synchronously on the active call stack.',
        'Line 13: Node.js standard Error-First Callback convention: (err, result).',
        'Line 21: Asynchronous callbacks do not block synchronous code execution.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Node.js Error-First Pattern, Streams, and util.promisify',
      description:
        'While modern Node.js uses async/await, all core Node.js APIs (fs, child_process, crypto, zlib) were built on Error-First Callbacks. Senior developers frequently interact with callbacks when handling high-throughput event streams or converting legacy callback libraries using Node\'s native util.promisify.',
      codeSnippet: `import { readFile } from 'node:fs';
import { promisify } from 'node:util';

// Converting legacy Node.js callback API into modern Promise
const readFileAsync = promisify(readFile);

async function loadConfig() {
  // Clean async/await syntax backed by callback infrastructure!
  const data = await readFileAsync('./config.json', 'utf-8');
  return JSON.parse(data);
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the Error-First Callback pattern in Node.js and why is it standard?',
          spokenAnswer:
            'The Error-First Callback pattern dictates that the first argument of the callback is reserved for an Error object, and subsequent arguments carry the success data: callback(err, data). It is standard because asynchronous callbacks run on a separate stack frame where traditional try/catch cannot catch errors from previous ticks.'
        },
        {
          question: 'What is Callback Hell and how was it solved?',
          spokenAnswer:
            'Callback Hell (the Pyramid of Doom) occurs when multiple dependent asynchronous operations are nested inside callbacks, resulting in deeply indented, unreadable code with fragmented error handling. It was solved first by Promises (chaining .then() and .catch()) and subsequently by ES2017 async/await.'
        }
      ],
      trickyFollowUp: {
        question: 'Why can\'t a try/catch block wrap an asynchronous callback directly?',
        answer:
          'Because by the time the asynchronous callback is executed by the Event Loop, the original try/catch block has already finished executing and has been popped off the Call Stack. Any error thrown inside the callback bubbles up to the root of the Event Loop as an uncaught exception.'
      },
      commonMistakes: [
        'Wrapping asynchronous callback calls in synchronous try/catch blocks and expecting it to catch errors.',
        'Forgetting to "return callback(err)" when an error occurs, causing execution to continue and execute success logic.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Callback = function passed as an argument to execute later.',
        'Sync callbacks run immediately on the Call Stack; async callbacks run via the Event Loop.',
        'Node.js convention is Error-First: (err, data) => {}.',
        'Always return when passing an error: "return callback(err);".'
      ],
      oneLineDefinition:
        'A callback function is a function passed as an argument into another function to be invoked synchronously or asynchronously upon completion.',
      interviewTip:
        'Explain why try/catch fails across async callbacks: the original call stack has already unwound by the time the callback fires.'
    }
  },

  {
    id: 'pure-functions',
    number: 20,
    title: 'Pure Functions',
    category: 'Functional JavaScript',
    categorySlug: 'functional',
    estimatedMinutes: 5,
    concept30Sec:
      'A Pure Function is a function that satisfies two strict criteria: 1) Determinism: Given the exact same inputs, it will always return the exact same output; 2) Zero Side Effects: It does not read or mutate any external state, perform I/O operations, write to disks, or modify its arguments.',
    internals: {
      overview:
        'Pure functions guarantee Referential Transparency: an expression involving a pure function can be replaced with its resulting value without changing program behavior. Because pure functions have no external dependencies or mutations, V8 can optimize them heavily through memoization, inline caching, dead code elimination, and parallel execution across Worker Threads without locking overhead.',
      flowSteps: [
        'Input Reading: Only reads explicitly passed arguments.',
        'Calculation: Computes results without mutating inputs or external state.',
        'Return Value: Returns a fresh value or freshly allocated data structure.',
        'Side-Effect Free: No console.log, no Date.now(), no Math.random(), no network calls, no global state changes.'
      ],
      diagram: `PURE FUNCTION (Isolated Box):
Input (a, b) ===> [ Pure Function: return a + b; ] ===> Output (a + b)
                  * Zero external state read
                  * Zero external mutation
                  * 100% deterministic & repeatable`
    },
    codeExample: {
      code: `// 1. IMPURE FUNCTION: Has side effects & non-deterministic
let taxRate = 0.08;
const auditLog = [];

function calculateTotalImpure(items) {
  // Reads external mutable variable (taxRate)
  // Mutates external state (auditLog)
  // Non-deterministic: uses Date.now()
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const tax = total * taxRate;
  auditLog.push({ timestamp: Date.now(), total: total + tax });
  return total + tax;
}

// 2. PURE FUNCTION: Deterministic, referentially transparent, zero side effects
function calculateTotalPure(items, taxPercentage) {
  // Only relies on arguments; zero external mutation
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const tax = subtotal * taxPercentage;
  return subtotal + tax;
}

const cart = [{ price: 50 }, { price: 50 }];
console.log('Pure call 1:', calculateTotalPure(cart, 0.10)); // 110
console.log('Pure call 2:', calculateTotalPure(cart, 0.10)); // 110 (Always identical!)`,
      language: 'javascript',
      output: `Pure call 1: 110
Pure call 2: 110`,
      whyOutput:
        'calculateTotalPure depends strictly on its arguments (cart and taxPercentage). It does not alter cart, does not touch external state, and produces identical results regardless of when, where, or how many times it is invoked.',
      annotations: [
        'Line 5: calculateTotalImpure mutates external arrays and relies on mutable global taxRate.',
        'Line 15: calculateTotalPure is referentially transparent and fully deterministic.',
        'Line 24: Calling calculateTotalPure 1,000 times with identical arguments returns identical values.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Domain Business Logic, Pricing Engines, and Unit Testing Without Mocks',
      description:
        'In enterprise Node.js domain architectures, separating pure business logic (pricing calculators, discount validators, permission checkers) from impure I/O (database writes, HTTP calls) allows 100% unit test coverage without mocking frameworks. Pure functions can be tested instantly without database containers.',
      codeSnippet: `// Pure domain logic: Zero mocks required in Jest/Vitest!
export function calculateSubscriptionDiscount(planTier, tenureMonths, couponCode) {
  let discount = 0;
  if (tenureMonths >= 12) discount += 0.15;
  if (couponCode === 'ANNUAL_PROMO') discount += 0.05;
  return Math.min(discount, 0.25);
}

// Impure controller delegates to pure logic:
export async function billingController(req, res) {
  const discount = calculateSubscriptionDiscount(req.user.tier, req.user.months, req.body.coupon);
  await db.updateBilling(req.user.id, discount); // I/O isolated here
  res.json({ discount });
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is Referential Transparency in JavaScript?',
          spokenAnswer:
            'Referential Transparency means that any function call can be replaced with its corresponding return value without changing the program\'s behavior or correctness. This is only possible if the function is pure (deterministic and free of side effects).'
        },
        {
          question: 'Is console.log() considered a side effect in a function?',
          spokenAnswer:
            'Yes. console.log() performs synchronous I/O by writing to the process stdout file descriptor, which mutates the state of the external terminal/output stream. Therefore, any function containing console.log() is technically impure.'
        }
      ],
      trickyFollowUp: {
        question: 'Can a function that uses Math.random() or Date.now() ever be a pure function?',
        answer:
          'No. Because Math.random() and Date.now() return different values across invocations with identical arguments, they violate the determinism requirement of pure functions.'
      },
      commonMistakes: [
        'Assuming pure functions cannot allocate new objects (they can allocate new objects, as long as they don\'t mutate existing input objects).',
        'Testing business logic with heavy database mocks because it was tightly coupled with impure database queries.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Pure Function = Deterministic + Zero Side Effects.',
        'Same inputs -> Always identical outputs.',
        'Referentially transparent: can be safely cached/memoized.',
        'Isolate pure business logic from impure database/network I/O.'
      ],
      oneLineDefinition:
        'A pure function is a deterministic function that produces no observable side effects and whose return value depends exclusively on its arguments.',
      interviewTip:
        'State the two core rules immediately: 1) Determinism (same input = same output); 2) No side effects (no mutation of arguments or external state).'
    }
  },

  {
    id: 'immutability',
    number: 21,
    title: 'Immutability',
    category: 'Functional JavaScript',
    categorySlug: 'functional',
    estimatedMinutes: 5,
    concept30Sec:
      'Immutability is the design principle that data cannot be modified after it is created. Instead of mutating an existing object or array in place, modifications are performed by creating and returning a new data structure containing the updated values, leaving the original data untouched.',
    internals: {
      overview:
        'JavaScript primitives are inherently immutable (e.g. strings cannot be mutated: "str"[0] = "X" silently fails or throws). Objects are mutable by default. Object.freeze(obj) sets the internal [[Configurable]] and [[Writable]] attributes of own properties to false, preventing additions, deletions, or mutations. However, Object.freeze is SHALLOW: nested objects remain completely mutable unless recursively frozen.',
      flowSteps: [
        'Primitives: Stored as immutable values on stack/tagged pointers.',
        'Object.freeze(obj): Marks own property descriptors as writable: false, configurable: false.',
        'Shallow Limitation: Nested objects retain their original writable descriptors and can be mutated.',
        'Immutable Updates: Use spread { ...obj, key: newVal } or array methods (.map, .filter) that return fresh allocations.'
      ],
      diagram: `MUTATION vs IMMUTABLE UPDATE:
MUTATION:
Array [1, 2, 3] ---> arr.push(4) ---> Same Array [1, 2, 3, 4] (Corrupts prior references!)

IMMUTABLE UPDATE:
Array [1, 2, 3] ---> [ ...arr, 4 ] ---> Brand-New Array [1, 2, 3, 4]
(Original Array [1, 2, 3] remains 100% pristine!)`
    },
    codeExample: {
      code: `// 1. Object.freeze is SHALLOW: Classic production bug!
const databaseConfig = Object.freeze({
  engine: 'postgres',
  connection: {
    host: 'localhost',
    port: 5432
  }
});

// databaseConfig.engine = 'mysql'; // Fails silently (or throws in strict mode)
databaseConfig.connection.port = 9999; // MUTATES! Nested object was NOT frozen!
console.log('Shallow freeze nested port:', databaseConfig.connection.port); // 9999

// 2. Recursive Deep Freeze Implementation
function deepFreeze(obj) {
  Object.keys(obj).forEach((prop) => {
    if (typeof obj[prop] === 'object' && obj[prop] !== null && !Object.isFrozen(obj[prop])) {
      deepFreeze(obj[prop]);
    }
  });
  return Object.freeze(obj);
}

const lockedConfig = deepFreeze({
  auth: { secret: 'super_secret', ttl: 3600 }
});

try {
  lockedConfig.auth.ttl = 7200; // TypeError in strict mode!
} catch (err) {
  console.log('Deep freeze prevented mutation:', err.message);
}`,
      language: 'javascript',
      output: `Shallow freeze nested port: 9999
Deep freeze prevented mutation: Cannot assign to read only property 'ttl' of object '#<Object>'`,
      whyOutput:
        'Object.freeze only sets descriptors on first-level keys, leaving connection.port mutable. deepFreeze recursively walks every nested object, ensuring all levels have writable: false, preventing any mutation.',
      annotations: [
        'Line 10: Shallow freeze leaves nested objects vulnerable to mutations.',
        'Line 15: deepFreeze recursively locks every nested object graph.',
        'Line 28: Attempting to mutate a deeply frozen object throws TypeError in strict mode.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Cache Integrity in Node.js & Multi-Threaded Worker Data Safety',
      description:
        'In Node.js backends using in-memory caches (e.g. node-cache or Redis local caches), returning an object reference directly from the cache allows a downstream controller to mutate properties, corrupting the cached data for all subsequent user requests. Deep freezing or returning defensive copies guarantees cache immutability.',
      codeSnippet: `class InDatabaseCache {
  private cache = new Map();

  set(key, data) {
    // Deep freeze prevents any consumer from mutating cached master data
    this.cache.set(key, deepFreeze(structuredClone(data)));
  }

  get(key) {
    return this.cache.get(key); // Safe to share across concurrent requests!
  }
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the difference between const and Object.freeze()?',
          spokenAnswer:
            '"const" prevents reassignment of the variable identifier to a new memory address, but does not prevent mutations to the object\'s internal properties. "Object.freeze()" prevents mutation of the object\'s properties, but does not prevent the variable itself from being reassigned if declared with let.'
        },
        {
          question: 'What are the performance tradeoffs of immutability in Node.js?',
          spokenAnswer:
            'The benefit is bug-free, thread-safe, predictable state that eliminates shared-reference race conditions. The tradeoff is memory and garbage collection pressure: creating new objects on every modification increases heap allocations, which can cause V8 minor GC pauses in ultra-high-throughput systems.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the difference between Object.freeze(), Object.seal(), and Object.preventExtensions()?',
        answer:
          'Object.preventExtensions() prevents adding new properties; Object.seal() prevents adding/removing properties and marks existing properties as non-configurable; Object.freeze() does everything Object.seal() does PLUS marks all data properties as non-writable (completely read-only).'
      },
      commonMistakes: [
        'Believing Object.freeze() freezes nested objects automatically (it is strictly shallow).',
        'Confusing variable identifier protection (const) with object structure protection (freeze).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Immutability = data cannot be altered after creation.',
        'Object.freeze() is shallow; nested objects remain mutable.',
        'const freezes variable reassignment; Object.freeze freezes object properties.',
        'Immutable updates prevent cache corruption and shared-state side effects.'
      ],
      oneLineDefinition:
        'Immutability is the architectural practice of treating data as unchangeable, deriving updated state through new allocations rather than in-place mutations.',
      interviewTip:
        'Immediately articulate that Object.freeze is shallow, and contrast const (protects identifier binding) with Object.freeze (protects object property descriptors).'
    }
  },

  {
    id: 'functional-programming',
    number: 22,
    title: 'Functional Programming',
    category: 'Functional JavaScript',
    categorySlug: 'functional',
    estimatedMinutes: 5,
    concept30Sec:
      'Functional Programming (FP) is a declarative programming paradigm where applications are structured through the composition of pure functions, avoiding shared mutable state, side effects, and imperative loops. Core pillars include First-Class & Higher-Order Functions, Pure Functions, Immutability, and Function Composition/Pipelining.',
    internals: {
      overview:
        'Imperative programming focuses on HOW to achieve results through step-by-step state changes and loops (for, while). Functional programming focuses on WHAT to achieve through declarative expressions (map, reduce, filter, compose). V8 executes declarative function pipelines using closures to thread state smoothly between pure functions without intermediate mutable variables on the call stack.',
      flowSteps: [
        'Declarative over Imperative: Replace stateful loops with pure transformations.',
        'Currying / Partial Application: Functions take one argument at a time, enabling dynamic specialization.',
        'Pipelining / Composition: pipe(fnA, fnB, fnC)(input) passes data left-to-right through pure stages.',
        'No Shared Mutable State: Eliminates concurrency bugs and race conditions.'
      ],
      diagram: `FUNCTIONAL PIPELINE (pipe):
Data Input ===> [ validatePayload ]
                      |
                      v
                [ sanitizeInput ]
                      |
                      v
                [ hashPassword ]
                      |
                      v
                Output: Ready for Database Insertion`
    },
    codeExample: {
      code: `// Pipe utility: Compose functions left-to-right
const pipe = (...fns) => (x) => fns.reduce((v, fn) => fn(v), x);

// Atomic pure functions:
const trimEmail = (user) => ({ ...user, email: user.email.trim().toLowerCase() });
const addRole = (user) => ({ ...user, role: user.role || 'USER' });
const addAuditTimestamp = (user) => ({ ...user, registeredAt: '2026-01-01T00:00:00Z' });

// Composed Pipeline:
const sanitizeAndPrepareUser = pipe(
  trimEmail,
  addRole,
  addAuditTimestamp
);

const rawInput = { email: '  ALICE@company.COM  ', username: 'alice' };
const processedUser = sanitizeAndPrepareUser(rawInput);

console.log('Original Input:', rawInput); // Completely untampered!
console.log('Processed User:', processedUser);`,
      language: 'javascript',
      output: `Original Input: { email: '  ALICE@company.COM  ', username: 'alice' }
Processed User: {
  email: 'alice@company.com',
  username: 'alice',
  role: 'USER',
  registeredAt: '2026-01-01T00:00:00Z'
}`,
      whyOutput:
        'pipe chains trimEmail -> addRole -> addAuditTimestamp. Each function receives the output of the previous function and returns a new object with spread, ensuring rawInput remains 100% unaltered.',
      annotations: [
        'Line 2: pipe uses reduce to pass values sequentially through an array of functions.',
        'Line 5-7: Pure functions that return new immutable objects.',
        'Line 10: Composes individual small functions into an expressive pipeline.'
      ]
    },
    nodeJsApplication: {
      scenario: 'ETL Pipelines, Middleware Chains, and Stream Transformations in Node.js',
      description:
        'Node.js stream pipelines (stream.pipeline(readStream, transformA, transformB, writeStream)) and Express middleware onion architectures are practical implementations of functional programming. Data flows through a series of discrete transforms, keeping each stage testable and decoupled.',
      codeSnippet: `import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

// Functional stream pipeline
async function compressLogs(src, dest) {
  await pipeline(
    createReadStream(src),
    createGzip(), // Pure transform stream
    createWriteStream(dest)
  );
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What are the main advantages of Functional Programming in backend development?',
          spokenAnswer:
            '1) Eliminates shared mutable state, preventing concurrency bugs; 2) High testability, because pure functions need zero database or network mocking; 3) Reusability through function composition; 4) Predictable debugging and reasoning about code.'
        },
        {
          question: 'What is Currying and why is it useful?',
          spokenAnswer:
            'Currying transforms a multi-argument function into a series of single-argument functions: f(a, b, c) -> f(a)(b)(c). It is useful for creating specialized utility functions, pre-configuring configurations, and composing functions in pipelines.'
        }
      ],
      trickyFollowUp: {
        question: 'Is JavaScript a pure functional programming language?',
        answer:
          'No. JavaScript is a multi-paradigm language. It supports functional programming because functions are first-class citizens, but it also supports object-oriented, prototype-based, and imperative programming with mutable objects.'
      },
      commonMistakes: [
        'Over-engineering simple tasks with deeply nested compose/curry chains that reduce code readability.',
        'Mutating arguments inside functions that are supposed to be functional.'
      ]
    },
    quickRevision: {
      takeaways: [
        'FP focuses on pure functions, immutability, and declarative pipelines.',
        'Declarative (what to do) over Imperative (how to do it).',
        'Function composition (pipe/compose) connects small pure functions.',
        'JavaScript is multi-paradigm: use FP where it provides clarity and safety.'
      ],
      oneLineDefinition:
        'Functional Programming is a declarative paradigm that structures software through pure, composable functions without mutable shared state.',
      interviewTip:
        'Emphasize the core triad of FP: Pure Functions + Immutability + Function Composition.'
    }
  },

  {
    id: 'map-filter-reduce-find-some-every',
    number: 23,
    title: 'map(), filter(), reduce(), find(), some(), every()',
    category: 'Functional JavaScript',
    categorySlug: 'functional',
    estimatedMinutes: 5,
    concept30Sec:
      'These six declarative Array.prototype methods transform, query, and aggregate collections without imperative loops. map() transforms elements 1-to-1; filter() selects elements matching a predicate; reduce() aggregates an array into any single value; find() returns the first matching element; some() checks if at least one matches; and every() checks if all match.',
    internals: {
      overview:
        'All six methods accept a callback with signature (element, index, array). map and filter allocate brand-new arrays. find, some, and every feature Short-Circuit Optimization: they break iteration immediately once their condition is met, without traversing remaining elements. reduce passes an accumulator across iterations; if initialValue is omitted, index 0 becomes the accumulator and iteration starts at index 1.',
      flowSteps: [
        'map(): Returns new array of identical length with transformed values.',
        'filter(): Returns new array containing only elements where predicate returns truthy.',
        'reduce(cb, initialVal): Passes accumulator along iterations. Always specify initialValue to avoid empty array TypeErrors!',
        'find(): Returns first matching element or undefined (short-circuits).',
        'some(): Returns boolean true on first match; false if none match (short-circuits).',
        'every(): Returns boolean false on first failure; true if all pass (short-circuits).'
      ],
      diagram: `ARRAY METHODS COMPARISON:
Method      Return Type      Mutates?   Short-Circuits?   Purpose
----------------------------------------------------------------------
map()       New Array        No         No                1-to-1 transform
filter()    New Array        No         No                Subset selection
reduce()    Accumulator Val  No         No                Array aggregation
find()      Element | undef  No         YES (First match) Find single item
some()      Boolean          No         YES (First truthy)Existential check
every()     Boolean          No         YES (First falsy) Universal check`
    },
    codeExample: {
      code: `const transactions = [
  { id: 'tx_1', amount: 150, status: 'COMPLETED', type: 'PAYMENT' },
  { id: 'tx_2', amount: 300, status: 'PENDING',   type: 'REFUND'  },
  { id: 'tx_3', amount: 50,  status: 'COMPLETED', type: 'PAYMENT' },
  { id: 'tx_4', amount: 200, status: 'FAILED',    type: 'PAYMENT' }
];

// 1. filter() & map(): Extract completed payment amounts
const completedAmounts = transactions
  .filter(tx => tx.status === 'COMPLETED')
  .map(tx => tx.amount);
console.log('Completed Amounts:', completedAmounts); // [150, 50]

// 2. reduce(): Group transactions by status (Any data structure!)
const groupedByStatus = transactions.reduce((acc, tx) => {
  acc[tx.status] = (acc[tx.status] || 0) + 1;
  return acc;
}, {});
console.log('Grouped Count:', groupedByStatus);

// 3. find(), some(), every() (Short-circuiting demonstration)
const pendingTx = transactions.find(tx => tx.status === 'PENDING');
const hasFailedTx = transactions.some(tx => tx.status === 'FAILED');
const allCompleted = transactions.every(tx => tx.status === 'COMPLETED');

console.log('Found Pending ID:', pendingTx?.id); // tx_2
console.log('Has Failed?', hasFailedTx); // true
console.log('All Completed?', allCompleted); // false`,
      language: 'javascript',
      output: `Completed Amounts: [ 150, 50 ]
Grouped Count: { COMPLETED: 2, PENDING: 1, FAILED: 1 }
Found Pending ID: tx_2
Has Failed? true
All Completed? false`,
      whyOutput:
        'filter creates a new array of 2 elements, and map extracts their amounts. reduce folds the array into a counts map object. find short-circuits at tx_2, some short-circuits at tx_4, and every short-circuits at tx_2 immediately returning false.',
      annotations: [
        'Line 9: Declarative chaining: filter followed by map.',
        'Line 15: Always pass initialValue ({}) to reduce to prevent crashes on empty arrays.',
        'Line 22: find, some, and every stop iterating as soon as the answer is known.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Aggregating Database Result Sets & Role/Permission Checks in Middleware',
      description:
        'In Node.js backends, some() and every() are used for lightning-fast permission checks in auth middleware (e.g. user.permissions.some(p => required.includes(p))). reduce() is used for grouping database rows, calculating financial totals, and building in-memory lookup indexes.',
      codeSnippet: `// Express RBAC Middleware using .some()
function requireAnyPermission(...requiredPermissions) {
  return (req, res, next) => {
    // short-circuits on first matching permission!
    const isAuthorized = req.user?.permissions.some(p => requiredPermissions.includes(p));
    if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized' });
    next();
  };
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What happens if you call reduce() on an empty array without an initial value?',
          spokenAnswer:
            'It throws a TypeError: Reduce of empty array with no initial value. If an initialValue is provided, reduce() returns the initialValue without executing the callback. Therefore, in production code, always provide an explicit initialValue.'
        },
        {
          question: 'Can you break or return early from a forEach loop?',
          spokenAnswer:
            'No. A forEach loop will execute the callback for every element in the array and cannot be stopped using "break" or "return" (return only exits the current callback iteration). If early exit is needed, use some(), every(), find(), or a standard for...of loop.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the return value of [].every(fn) on an empty array?',
        answer:
          '[].every(...) returns true! In mathematical logic, this is called "vacuous truth": all elements in the empty set satisfy the condition because there are no elements to invalidate it.'
      },
      commonMistakes: [
        'Omitting initialValue in reduce() and getting unexpected behavior when handling 0 or 1 element arrays.',
        'Attempting to use break inside forEach or map.',
        'Using map when no return value is needed (use forEach or for...of instead).'
      ]
    },
    quickRevision: {
      takeaways: [
        'map: 1-to-1 transform (new array).',
        'filter: subset match (new array).',
        'reduce: aggregates array into any value; ALWAYS pass initialValue.',
        'find, some, every: short-circuit as soon as the condition is resolved.',
        '[].every(...) returns true (vacuous truth).'
      ],
      oneLineDefinition:
        'These six methods form JavaScript\'s declarative array toolkit for transforming, filtering, reducing, and querying collections with short-circuit optimizations.',
      interviewTip:
        'Highlight short-circuiting: find, some, and every do not iterate through the entire array once their match condition is met.'
    }
  }
];
