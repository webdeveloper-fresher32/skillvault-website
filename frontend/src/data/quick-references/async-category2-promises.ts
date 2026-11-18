import { QuickReferenceTopic } from './types';

export const asyncCategory2Promises: QuickReferenceTopic[] = [
  {
    id: 'async-promises-fundamentals',
    number: 4,
    title: 'Promises',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Promises and Async/Await',
    categorySlug: 'promises-async',
    estimatedMinutes: 5,
    concept30Sec:
      'A Promise is an ECMAScript standard object representing the eventual completion (or failure) of an asynchronous operation and its resulting value. It acts as a proxy for a value not necessarily known when the promise is created, allowing asynchronous methods to return values like synchronous methods.',
    internals: {
      overview:
        'Internally in V8, a Promise is a C++ heap object containing internal slots: [[PromiseState]] ("pending", "fulfilled", or "rejected"), [[PromiseResult]] (undefined, the resolved value, or rejection reason), and [[PromiseFulfillReactions]] / [[PromiseRejectReactions]]. When .then() or .catch() is called, handlers are queued into these reaction lists. When settled, V8 enqueues a PromiseReactionJob into the Microtask Queue, guaranteeing handlers run asynchronously on the microtask checkpoint.',
      flowSteps: [
        '1. Creation: new Promise((resolve, reject) => { ... }) executes the executor function synchronously immediately.',
        '2. Internal State: Created with [[PromiseState]]: "pending", [[PromiseResult]]: undefined.',
        '3. Handler Registration: .then(onFulfill, onReject) attaches reaction records to the internal lists.',
        '4. Settlement: resolve(val) transitions state from "pending" to "fulfilled" and freezes [[PromiseResult]] = val.',
        '5. Microtask Enqueueing: V8 schedules all registered fulfill reactions as Microtasks (PromiseReactionJob).',
        '6. Microtask Draining: Call stack empties, microtasks run BEFORE next event loop phase or timer.'
      ],
      diagram: `V8 PROMISE ANATOMY & MICROTASK DISPATCH:

  +--------------------------------------------------------+
  | Promise Instance (Heap Object)                         |
  |  - [[PromiseState]]:  "pending" -> "fulfilled"         |
  |  - [[PromiseResult]]: { id: 101, name: "Order" }       |
  |  - [[PromiseFulfillReactions]]: [ HandlerFuncA ]       |
  +--------------------------------------------------------+
                             |
             resolve(data) executes inside V8
                             |
                             v
  +--------------------------------------------------------+
  | V8 Microtask Queue (PromiseReactionJob)                |
  |  [ HandlerFuncA(result) ]  <-- Runs before any Timer/IO|
  +--------------------------------------------------------+`
    },
    codeExample: {
      code: `console.log('1: Synchronous script start');

// The executor function runs SYNCHRONOUSLY inside the constructor!
const orderPromise = new Promise((resolve, reject) => {
  console.log('2: Executor running synchronously');
  setTimeout(() => {
    resolve({ orderId: 'ORD-9842', status: 'PAID' });
  }, 10);
});

// Handlers are queued as Microtasks upon resolution
orderPromise.then((order) => {
  console.log('4: Promise fulfilled handler (Microtask):', order.orderId);
});

console.log('3: Synchronous script end');`,
      language: 'javascript',
      output: `1: Synchronous script start
2: Executor running synchronously
3: Synchronous script end
4: Promise fulfilled handler (Microtask): ORD-9842`,
      whyOutput:
        'Line 1 logs first. Line 2 logs immediately because the Promise executor runs synchronously during instantiation. Line 3 logs before the setTimeout completes. After 10ms, setTimeout fires in the Timers phase, calls resolve(), which queues the .then() callback into the Microtask Queue, executing immediately at the microtask checkpoint (Line 4).'
    },
    nodeJsApplication: {
      scenario: 'Wrapping Third-Party Callback Libraries into Promises',
      description:
        'Enterprise Node.js codebases often interface with legacy SDKs or C++ addons that do not return Promises natively. Wrapping them cleanly via new Promise((resolve, reject) => ...) provides unforgeable async handles with standardized microtask semantics.',
      codeSnippet: `import crypto from 'node:crypto';

// Wrapping legacy callback crypto into a modern Promise
function generateSecureToken(byteLength = 32): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(byteLength, (err, buffer) => {
      if (err) return reject(err);
      resolve(buffer.toString('hex'));
    });
  });
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Does the Promise executor function execute synchronously or asynchronously?',
          spokenAnswer:
            'The Promise executor function executes SYNCHRONOUSLY and immediately upon instantiation. Any code inside new Promise((resolve, reject) => { ... }) runs on the call stack before subsequent lines of code. Only the handlers attached via .then(), .catch(), or .finally() execute asynchronously as microtasks.'
        },
        {
          question: 'What is the internal mechanism that guarantees Promise handlers run asynchronously?',
          spokenAnswer:
            'Even if a Promise is already resolved (e.g., Promise.resolve(42)), invoking .then() never executes synchronously. The ECMAScript specification mandates that settling a promise enqueues a PromiseReactionJob onto the Microtask Queue. The V8 engine will only drain microtasks after the current synchronous execution context has fully cleared.'
        }
      ],
      trickyFollowUp: {
        question: 'What happens if you call both resolve("A") and reject("B") inside the same executor?',
        answer:
          'A Promise can only settle once. Whichever settlement function (resolve or reject) is called first permanently transitions the internal [[PromiseState]] (e.g., to "fulfilled"). All subsequent calls to resolve, reject, or throwing exceptions inside that executor are completely ignored.'
      },
      commonMistakes: [
        'Assuming new Promise((resolve, reject) => ...) defers execution to the next event loop tick: the body runs synchronously immediately.',
        'Creating the "Deferred Anti-pattern" (manually creating a promise and resolving it in another scope when not needed).',
        'Not handling rejection: unhandled rejections trigger unhandledRejection events and can crash modern Node.js processes.'
      ]
    },
    quickRevision: {
      takeaways: [
        'A Promise is a stateful proxy with 3 internal states: pending, fulfilled, or rejected.',
        'The executor function executes synchronously; .then() handlers execute asynchronously as microtasks.',
        'Settling is irreversible: once resolved or rejected, subsequent calls are silently ignored.'
      ],
      oneLineDefinition:
        'A Promise is an object representing the eventual result of an asynchronous operation, providing guaranteed microtask delivery and immutable settlement.',
      interviewTip:
        'Emphasize that .then() handlers are scheduled on the Microtask Queue, which drains immediately before any Event Loop macrotask (timers/I/O).',
      keyDistinction:
        'Callbacks vs Promises: Callbacks surrender control to the caller; Promises return an immutable first-class token representing the future value.'
    }
  },
  {
    id: 'async-promise-lifecycle',
    number: 5,
    title: 'Promise Lifecycle',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Promises and Async/Await',
    categorySlug: 'promises-async',
    estimatedMinutes: 5,
    concept30Sec:
      'The Promise lifecycle consists of three mutually exclusive states: pending, fulfilled, and rejected. A promise starts as pending and transitions exactly once to either fulfilled (with a value) or rejected (with a reason). Once settled (fulfilled or rejected), its state and result become completely immutable.',
    internals: {
      overview:
        'A Promise state machine is strictly monotonic. Transitions are permanent: Pending -> Fulfilled, or Pending -> Rejected. Once in a settled state, the promise internal slots [[PromiseState]] and [[PromiseResult]] are frozen. If handlers are registered on an already-settled promise, V8 immediately schedules a microtask with the cached value, ensuring consistent idempotent behavior.',
      flowSteps: [
        '1. Pending: Initial state. Operation in progress. Handlers (.then/.catch) stored in reaction arrays.',
        '2. Transition Trigger: resolve(val) or reject(reason) invoked, or an unhandled throw occurs in executor.',
        '3. State Mutation: [[PromiseState]] changes from "pending" to "fulfilled" or "rejected".',
        '4. Result Freezing: [[PromiseResult]] is set permanently; further attempts to resolve/reject are no-ops.',
        '5. Reaction Execution: Registered handlers are pushed to Microtask queue and cleared from the instance.',
        '6. Post-Settlement Attachment: Any .then() attached AFTER settlement still schedules a microtask with the cached result.'
      ],
      diagram: `PROMISE FINITE STATE MACHINE:

                     +-------------------+
                     |      PENDING      |
                     +-------------------+
                               |
             +-----------------+-----------------+
             | (resolve(val))                    | (reject(err) or throw)
             v                                   v
   +-------------------+               +-------------------+
   |     FULFILLED     |               |     REJECTED      |
   | (Settled / Value) |               | (Settled / Reason)|
   +-------------------+               +-------------------+
             |                                   |
             +====== IMMUTABLE / FINAL ==========+
          (No further state transitions are possible)`
    },
    codeExample: {
      code: `const p = new Promise((resolve, reject) => {
  resolve('FIRST_SETTLED_VALUE'); // Transitions Pending -> Fulfilled
  reject(new Error('This will be ignored')); // Silently ignored!
  resolve('SECOND_VALUE'); // Silently ignored!
});

p.then((val) => {
  console.log('Result 1:', val);
});

// Attaching a handler AFTER the promise is already settled:
setTimeout(() => {
  p.then((val) => {
    console.log('Result 2 (Attached 50ms later):', val);
  });
}, 50);`,
      language: 'javascript',
      output: `Result 1: FIRST_SETTLED_VALUE
Result 2 (Attached 50ms later): FIRST_SETTLED_VALUE`,
      whyOutput:
        'The first resolve() permanently locks the promise state to fulfilled with value "FIRST_SETTLED_VALUE". The subsequent reject and resolve calls are no-ops. When a new .then() handler is attached 50ms later via setTimeout, the promise immediately dispenses its cached result via a microtask.'
    },
    nodeJsApplication: {
      scenario: 'Cache-Aside Pattern with In-Flight Request Deduplication',
      description:
        'Because Promise settlement is immutable and can be subscribed to multiple times, engineers cache the Promise itself (rather than just raw data) to collapse concurrent duplicate requests into a single database/API call.',
      codeSnippet: `const inFlightRequests = new Map();

function fetchUserProfileDeduplicated(userId) {
  // If request is already pending, return the existing Promise!
  if (inFlightRequests.has(userId)) {
    return inFlightRequests.get(userId);
  }

  const promise = db.query('SELECT * FROM users WHERE id = $1', [userId])
    .finally(() => {
      // Clean up cache once settled
      inFlightRequests.delete(userId);
    });

  inFlightRequests.set(userId, promise);
  return promise;
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What are the three states of a Promise, and what does "settled" mean?',
          spokenAnswer:
            'The three states are pending, fulfilled, and rejected. "Settled" is not a state itself, but a term used to describe a promise that is no longer pending—meaning it has transitioned to either fulfilled or rejected. Once settled, its state and value cannot change.'
        },
        {
          question: 'What happens if you attach a .then() handler to a promise that has already resolved minutes ago?',
          spokenAnswer:
            'It will still work properly and execute asynchronously. The promise caches its resolved value in its internal [[PromiseResult]] slot. When .then() is attached to an already-settled promise, V8 immediately schedules a microtask to invoke the callback with the cached value on the next microtask checkpoint.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the state of a Promise initialized with Promise.resolve(anotherPromise)?',
        answer:
          'If you pass a Promise to Promise.resolve(p), it returns p directly without creating a new promise. If you pass a thenable or pending promise to the Promise constructor resolve(otherPromise), the outer promise remains pending until the inner promise settles (Promise Resolution Procedure).'
      },
      commonMistakes: [
        'Believing "settled" is a fourth distinct state in JavaScript (it is merely a collective term for fulfilled or rejected).',
        'Expecting a Promise to cancel or reset its state if an error occurs later in the program.',
        'Not realizing that unhandled exceptions inside the Promise executor automatically reject the promise.'
      ]
    },
    quickRevision: {
      takeaways: [
        '3 states: pending, fulfilled, rejected. Settled = fulfilled or rejected.',
        'Transitions are strictly one-way and irreversible: Pending -> Fulfilled OR Pending -> Rejected.',
        'Handlers attached after settlement receive the cached result via a microtask.'
      ],
      oneLineDefinition:
        'The Promise lifecycle is a monotonic state machine transitioning from pending to permanently fulfilled or rejected.',
      interviewTip:
        'Mention "idempotent consumption": a promise can be subscribed to multiple times by different consumers, always yielding the identical cached result.',
      keyDistinction:
        'Pending vs Settled: Pending is unresolved work in progress; Settled is finalized with an immutable value or rejection reason.'
    }
  },
  {
    id: 'async-promise-chaining',
    number: 6,
    title: 'Promise Chaining',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Promises and Async/Await',
    categorySlug: 'promises-async',
    estimatedMinutes: 5,
    concept30Sec:
      'Promise chaining is the pattern of linking multiple .then(), .catch(), and .finally() calls sequentially. Every call to .then() returns a completely new Promise. Values returned by a handler are wrapped in the new promise, returned Promises are automatically flattened, and errors bubble down until caught.',
    internals: {
      overview:
        'When .then(f) is invoked, it creates and returns Promise2 immediately. When Promise1 fulfills, f is executed in a microtask. If f returns a primitive value x, Promise2 fulfills with x. If f returns another Promise (or thenable) P, Promise2 adopts the state of P (Promise unwrapping/flattening). If f throws an error, Promise2 rejects with that error, bypassing subsequent fulfill handlers until a reject handler or .catch() is reached.',
      flowSteps: [
        '1. Creation: p1.then(h1) instantiates p2 and links p2 settlement to the outcome of h1.',
        '2. Execution: When p1 fulfills, h1 runs with p1 result.',
        '3. Return Primitive: If h1 returns a value (e.g., number, string, object), p2 fulfills with that value.',
        '4. Return Promise: If h1 returns a Promise p3, p2 enters pending and chains onto p3, fulfilling only when p3 fulfills.',
        '5. Error Throw: If h1 throws an exception, p2 immediately rejects with that error.',
        '6. Error Bubbling: Rejected promises skip subsequent onFulfilled callbacks until hitting the nearest .catch().'
      ],
      diagram: `PROMISE CHAINING & VALUE FLATTENING:

  Promise 1: fetchUser(10)
      | (fulfills with user)
      v
  .then(user => fetchOrders(user.id))  <-- Returns new Promise (Auto-Unwrapped)
      | (fulfills with orders)
      v
  .then(orders => orders.length)       <-- Returns primitive 5 (Wrapped in Promise)
      | (fulfills with 5)
      v
  .then(count => console.log(count))
      | (any step throws or rejects)
      +---------------------------------------\\
                                              v
                                       .catch(err => log(err))`
    },
    codeExample: {
      code: `function step1(val) {
  return val + 10; // Primitive return: automatically wrapped in resolved Promise
}

function step2(val) {
  // Returns a Promise: automatically unwrapped/flattened
  return new Promise((resolve) => {
    setTimeout(() => resolve(val * 2), 20);
  });
}

function step3(val) {
  if (val > 100) throw new Error('Value exceeded limit');
  return \`Final value: \${val}\`;
}

Promise.resolve(5)
  .then(step1)        // 5 + 10 = 15
  .then(step2)        // 15 * 2 = 30 (unwrapped from promise)
  .then(step3)        // Returns "Final value: 30"
  .then((res) => {
    console.log('Result:', res);
  })
  .catch((err) => {
    console.error('Error caught in chain:', err.message);
  });`,
      language: 'javascript',
      output: `Result: Final value: 30`,
      whyOutput:
        'Promise.resolve(5) triggers step1, returning 15. The returned primitive is promoted to Promise.resolve(15). step2 returns an asynchronous Promise, which the engine automatically flattens. Once resolved after 20ms with 30, step3 formats the string and the final .then() logs the output.'
    },
    nodeJsApplication: {
      scenario: 'Middleware Pipeline and Database Transaction Rollbacks',
      description:
        'Promise chains allow linear database transaction pipelines where commit, rollback, and connection cleanup are deterministically executed via .then(), .catch(), and .finally().',
      codeSnippet: `function executeUserTransaction(client, userData) {
  return client.query('BEGIN')
    .then(() => client.query('INSERT INTO users(name) VALUES($1) RETURNING id', [userData.name]))
    .then((res) => client.query('INSERT INTO audit_logs(user_id) VALUES($1)', [res.rows[0].id]))
    .then(() => client.query('COMMIT'))
    .catch((err) => {
      return client.query('ROLLBACK').then(() => {
        throw new Error(\`Transaction aborted: \${err.message}\`);
      });
    })
    .finally(() => {
      client.release(); // ALWAYS release DB pool connection
    });
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is returned by a .then() call, and how does returning a Promise differ from returning a primitive?',
          spokenAnswer:
            'A .then() call always returns a brand new Promise. If the handler returns a primitive value, the new Promise immediately resolves with that value. If the handler returns another Promise, the new Promise automatically flattens (unwraps) and adopts the state and value of the returned Promise, waiting for it to settle.'
        },
        {
          question: 'What is "Error Bubbling" in a Promise chain and where should .catch() be placed?',
          spokenAnswer:
            'When an error is thrown or a promise rejects anywhere in a chain, the rejection skips all intermediate .then() fulfill handlers and bubbles down until it encounters an onRejected handler or a .catch(). A single .catch() at the end of the chain handles errors from any previous step.'
        }
      ],
      trickyFollowUp: {
        question: 'What happens if you return a value from inside a .catch() handler?',
        answer:
          'Returning a value from a .catch() handler recovers from the error! It fulfills the next Promise in the chain with that returned value. If you want the chain to remain rejected, you must explicitly throw an error or return Promise.reject(err) inside the .catch().'
      },
      commonMistakes: [
        'The "Promise Hell" mistake: nesting .then() inside .then() instead of returning the promise and chaining horizontally.',
        'Forgetting to return the promise inside a .then() handler, causing subsequent handlers to receive undefined immediately.',
        'Not placing a .catch() at the end of a chain, leaving potential unhandled rejections.'
      ]
    },
    quickRevision: {
      takeaways: [
        '.then() always returns a new Promise; returning another promise auto-flattens it.',
        'Errors bubble down the chain automatically until caught by a .catch().',
        'Returning a value from .catch() recovers the chain into a fulfilled state.'
      ],
      oneLineDefinition:
        'Promise chaining is the sequential linking of asynchronous operations where each .then() produces a new promise and errors bubble to .catch().',
      interviewTip:
        'Highlight "Promise unwrapping": V8 recursively resolves thenables so you never receive a nested Promise<Promise<T>>.',
      keyDistinction:
        'return promise vs promise.then() inside handler: Always return the promise to keep the chain flat and preserve error bubbling.'
    }
  },
  {
    id: 'async-await-fundamentals',
    number: 7,
    title: 'async / await',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Promises and Async/Await',
    categorySlug: 'promises-async',
    estimatedMinutes: 5,
    concept30Sec:
      'async/await is syntactic sugar built on top of ECMAScript Promises and Generator functions. An async function always returns a Promise. The await keyword pauses the execution of the async function until the awaited promise settles, freeing the V8 call stack without blocking the Node.js event loop.',
    internals: {
      overview:
        'When an async function encounters await expr, V8 evaluates expr as Promise.resolve(expr). It creates an internal coroutine continuation, suspends the function execution context, and pops it off the V8 call stack. The main thread continues processing other event loop tasks. When the awaited promise fulfills, a microtask is queued. When drained, V8 restores the suspended execution context back onto the call stack and resumes execution on the line following await.',
      flowSteps: [
        '1. Function Entry: async function caller() executes synchronously until the first await keyword.',
        '2. Expression Evaluation: await x coerces x to a Promise via Promise.resolve(x).',
        '3. Coroutine Suspension: The function pauses, saves its local variables, and returns a pending Promise to the caller.',
        '4. Call Stack Freed: The main thread exits the async function and executes subsequent synchronous code or event loop ticks.',
        '5. Promise Settlement: When the awaited promise resolves, its reaction queues a Microtask.',
        '6. Context Resumption: Microtask runs, restores local state onto V8 call stack, assigns resolved value, and proceeds.'
      ],
      diagram: `HOW ASYNC/AWAIT SUSPENDS & RESUMES WITHOUT BLOCKING:

Call Stack:
  1. main() enters asyncFn()
  2. asyncFn() executes lines until: await fetchRemoteData()
  3. [SUSPEND]: asyncFn state saved in Heap; returns Pending Promise!
  4. Call stack is now EMPTY -> Event Loop processes other HTTP requests!
  ...
  5. fetchRemoteData() resolves -> Enqueues Microtask
  6. Microtask executes: RESTORES asyncFn state to Call Stack
  7. asyncFn continues execution: const data = result;`
    },
    codeExample: {
      code: `async function fetchUserData(userId) {
  console.log('2: Inside async function before await');

  // await pauses fetchUserData execution, frees call stack!
  const user = await new Promise((resolve) => {
    setTimeout(() => resolve({ id: userId, name: 'Alex' }), 10);
  });

  console.log('4: Resumed after await, user is:', user.name);
  return user;
}

console.log('1: Synchronous start');
const promiseObj = fetchUserData(42);
console.log('3: Synchronous end - caller received:', promiseObj.constructor.name);`,
      language: 'javascript',
      output: `1: Synchronous start
2: Inside async function before await
3: Synchronous end - caller received: Promise
4: Resumed after await, user is: Alex`,
      whyOutput:
        'fetchUserData runs synchronously up to line 2. At await, it suspends and immediately returns a pending Promise to the caller, allowing line 3 to run synchronously. When the internal promise resolves after 10ms, a microtask resumes fetchUserData, logging line 4.'
    },
    nodeJsApplication: {
      scenario: 'Clean Sequential Business Logic with Centralized Error Handling',
      description:
        'Express/Koa route handlers use async/await to express complex multi-step workflows (authentication, database queries, external payment APIs) linearly without nested callback pyramids or fragmented .then() chains.',
      codeSnippet: `// Express route with async/await
app.post('/api/checkout', async (req, res, next) => {
  try {
    const { userId, cartItems } = req.body;
    const user = await userService.getById(userId);
    const total = await cartService.calculateTotal(cartItems);
    const payment = await stripeService.charge(user.stripeId, total);
    const order = await orderService.create({ userId, items: cartItems, paymentId: payment.id });

    res.status(201).json({ success: true, orderId: order.id });
  } catch (err) {
    // Standard try/catch catches ALL async and sync rejections cleanly!
    next(err);
  }
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Does the await keyword block the Node.js event loop or thread?',
          spokenAnswer:
            'No, absolutely not. The await keyword only pauses the execution of that specific asynchronous function coroutine. It immediately frees the V8 call stack and main thread to process other incoming HTTP requests, timers, and I/O events. When the awaited promise settles, the function resumes via the Microtask Queue.'
        },
        {
          question: 'What happens if you return a non-promise value from an async function?',
          spokenAnswer:
            'An async function ALWAYS returns a Promise. If you return a primitive value like return 42;, JavaScript automatically wraps it into Promise.resolve(42). If you throw an error inside an async function, it returns a rejected promise (Promise.reject(err)).'
        }
      ],
      trickyFollowUp: {
        question: 'What is the performance difference between returning a Promise vs returning await promise from an async function?',
        answer:
          'In modern V8 (Node 12+), return await p; gives full, clean asynchronous stack traces without performance penalty. Returning return p; directly saves a microtask tick, but can truncate error stack traces if p rejects. As a senior best practice, inside try/catch you MUST write return await p;, otherwise thrown errors bypass your catch block!'
      },
      commonMistakes: [
        'Writing return p; inside a try/catch block: the promise leaves the function before settling, causing errors to bypass the catch block!',
        'Awaiting independent operations sequentially inside loops, turning 1-second parallel tasks into 10-second bottlenecks.',
        'Using await in forEach callbacks: forEach is not promise-aware and does not await async callback completions.'
      ]
    },
    quickRevision: {
      takeaways: [
        'async functions always return a Promise; await pauses the coroutine, not the thread.',
        'Execution resumes on the Microtask Queue when the awaited promise settles.',
        'Inside try/catch, always write return await promise; to ensure errors are caught locally.'
      ],
      oneLineDefinition:
        'async/await is promise-based coroutine syntax allowing asynchronous code to be written and read like synchronous code without blocking the event loop.',
      interviewTip:
        'Emphasize that await pauses the function execution context (coroutine), yielding the call stack back to the event loop.',
      keyDistinction:
        'async/await vs Promises: async/await is built on Promises, offering synchronous-style control flow and universal try/catch error handling.'
    }
  }
];
