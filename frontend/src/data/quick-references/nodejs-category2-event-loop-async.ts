import { QuickReferenceTopic } from './types';

export const nodejsCategory2EventLoopAsync: QuickReferenceTopic[] = [
  {
    id: 'node-event-loop-phases',
    number: 6,
    title: 'Event Loop Phases',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Event Loop and Asynchronous Execution',
    categorySlug: 'event-loop-async',
    estimatedMinutes: 5,
    concept30Sec:
      'The libuv Event Loop runs in a continuous circular sequence of 6 distinct phases. Each phase maintains a FIFO queue of callbacks. When the event loop enters a given phase, it executes callbacks specific to that phase until the queue is exhausted or the maximum callback limit is reached, before moving to the next phase.',
    internals: {
      overview:
        'The 6 Event Loop phases in exact order: 1) Timers: executes callbacks scheduled by setTimeout() and setInterval(). 2) Pending Callbacks: executes I/O callbacks deferred to the next loop iteration (e.g. TCP errors). 3) Idle, Prepare: internal libuv housekeeping. 4) Poll: retrieves new I/O events, reads socket/file buffers, and executes I/O-related callbacks. 5) Check: executes callbacks scheduled by setImmediate(). 6) Close Callbacks: executes close events (e.g. socket.on("close")). Between every single callback and between every phase transition, Node drains the Microtask Queues.',
      flowSteps: [
        '1. Timers Phase: Checks min-heap for expired setTimeout / setInterval timers.',
        '2. Pending Callbacks: Runs deferred I/O callbacks (e.g. ECONNREFUSED notifications).',
        '3. Idle / Prepare: Internal libuv synchronization.',
        '4. Poll Phase: Blocks for incoming I/O (epoll_wait), processes incoming requests, or advances if timers/setImmediate pending.',
        '5. Check Phase: Executes all callbacks registered via setImmediate().',
        '6. Close Callbacks: Cleans up handles (e.g., socket.destroy(), server.close()).',
        'Microtask Interruption: After EVERY individual callback in modern Node.js, the microtask queue (nextTick + Promises) is completely drained!'
      ],
      diagram: `LIBUV EVENT LOOP PHASES (Run in clockwise circle):
   +---------------------------------------------+
   |  1. TIMERS (setTimeout, setInterval)        |
   +---------------------------------------------+
                          |
                          v
   +---------------------------------------------+
   |  2. PENDING CALLBACKS (I/O errors)          |
   +---------------------------------------------+
                          |
                          v
   +---------------------------------------------+
   |  3. IDLE, PREPARE (Internal libuv)          |
   +---------------------------------------------+
                          |
                          v
   +---------------------------------------------+
   |  4. POLL (Incoming connections, Data reads) |
   +---------------------------------------------+
                          |
                          v
   +---------------------------------------------+
   |  5. CHECK (setImmediate)                    |
   +---------------------------------------------+
                          |
                          v
   +---------------------------------------------+
   |  6. CLOSE CALLBACKS (socket.on('close'))     |
   +---------------------------------------------+`
    },
    codeExample: {
      code: `import fs from 'node:fs';

// Tracing phase execution inside an I/O callback:
fs.readFile(new URL(import.meta.url), () => {
  // We are currently inside the POLL Phase!
  console.log('1. Inside Poll Phase (fs.readFile callback)');

  setTimeout(() => {
    console.log('3. Timers Phase (setTimeout)');
  }, 0);

  setImmediate(() => {
    // Next phase immediately after Poll is the CHECK Phase!
    console.log('2. Check Phase (setImmediate)');
  });
});`,
      language: 'javascript',
      output: `1. Inside Poll Phase (fs.readFile callback)
2. Check Phase (setImmediate)
3. Timers Phase (setTimeout)`,
      whyOutput:
        'When the fs.readFile callback executes, the event loop is in the Poll Phase. Moving forward in the circle, the very next phase is the Check Phase (setImmediate). The Timers Phase is only reached after the loop finishes Check, Close, and wraps back to Timers. Therefore, inside an I/O callback, setImmediate ALWAYS executes before setTimeout(..., 0).',
      annotations: [
        'Line 5: We are currently executing in the Poll Phase.',
        'Line 12: setImmediate is processed in the immediate next phase (Check Phase).',
        'Line 8: setTimeout must wait for the loop to wrap around to the Timers phase.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Predictable Asynchronous Scheduling in Database & Socket Handlers',
      description:
        'In high-load Express/Fastify services, understanding event loop phases prevents race conditions between incoming socket data (Poll phase) and scheduled response flushes. Using setImmediate() inside I/O handlers ensures work executes before any pending timers expire.',
      codeSnippet: `// Queuing heavy cleanup work immediately after I/O completes
function handleFileUpload(req, res) {
  req.on('end', () => {
    res.end('Upload received');

    // Runs in the Check phase right after I/O finishes, before next timers!
    setImmediate(() => {
      virusScanner.scanTemporaryFile(req.savedFilePath);
    });
  });
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What are the 6 phases of the Node.js Event Loop in exact order?',
          spokenAnswer:
            '1) Timers (setTimeout, setInterval); 2) Pending Callbacks (deferred system/I/O callbacks); 3) Idle, Prepare (internal libuv); 4) Poll (retrieves new I/O events and executes data callbacks); 5) Check (setImmediate callbacks); 6) Close Callbacks (socket close events). Microtasks drain after every callback.'
        },
        {
          question: 'Why does setImmediate() run before setTimeout(fn, 0) inside an I/O callback?',
          spokenAnswer:
            'Because I/O callbacks run in the Poll Phase. After the Poll Phase, the event loop advances directly to the Check Phase (where setImmediate callbacks reside). The Timers Phase (where setTimeout callbacks reside) is at the beginning of the cycle and cannot run until the loop finishes the Check and Close phases and wraps around.'
        }
      ],
      trickyFollowUp: {
        question: 'What happens in the Poll phase if the queue is empty?',
        answer:
          'If the poll queue is empty, the loop checks if any setImmediate() callbacks are pending. If yes, it moves immediately to the Check phase. If no setImmediate is scheduled, it checks for expired timers; if a timer exists, it wraps to Timers. If neither exists, it blocks (via epoll_wait) waiting for new I/O events.'
      },
      commonMistakes: [
        'Assuming setTimeout(fn, 0) runs immediately (it is clamped to 1ms and belongs to the Timers phase).',
        'Believing microtasks run only at the end of an entire tick (in modern Node.js, they run after every single macrotask callback).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Phases: Timers -> Pending -> Idle -> Poll -> Check -> Close.',
        'setImmediate runs in Check phase; setTimeout runs in Timers phase.',
        'Inside I/O: setImmediate ALWAYS beats setTimeout(..., 0).',
        'Poll phase blocks waiting for I/O when queues are idle.'
      ],
      oneLineDefinition:
        'The Event Loop is a 6-phase circular queue mechanism in libuv that orchestrates the execution of timers, I/O polling, and immediate callbacks.',
      interviewTip:
        'Mnemonic: "Timers, Pending, Idle, Poll, Check, Close" (T-P-I-P-C-C).'
    }
  },

  {
    id: 'node-microtasks-macrotasks',
    number: 7,
    title: 'Microtasks and Macrotasks',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Event Loop and Asynchronous Execution',
    categorySlug: 'event-loop-async',
    estimatedMinutes: 5,
    concept30Sec:
      'In Node.js, asynchronous tasks are split into Macrotasks (event loop phase tasks: timers, I/O, setImmediate) and Microtasks (process.nextTick and Promise.then/catch/finally). Microtasks do NOT belong to libuv phases; they are managed directly by Node and V8 and have absolute priority over macrotasks.',
    internals: {
      overview:
        'Node.js maintains two separate microtask queues: 1) the "nextTickQueue" (populated by process.nextTick()); 2) the "promiseMicrotaskQueue" (populated by native Promise resolutions and queueMicrotask). The nextTickQueue ALWAYS drains before the promiseMicrotaskQueue. In Node.js 11+, microtasks are drained immediately after EVERY single individual callback on the call stack, matching standard browser behavior.',
      flowSteps: [
        'Macrotask completes on the V8 Call Stack.',
        'Engine inspects the nextTickQueue: all process.nextTick callbacks are drained completely.',
        'Engine inspects the promiseMicrotaskQueue: all Promise callbacks are drained completely.',
        'If a microtask schedules another microtask, it is executed in the SAME draining pass before returning to the Event Loop.',
        'Once all microtask queues are 100% empty, the event loop resumes its current phase.'
      ],
      diagram: `MICROTASKS PRIORITY PIPELINE:
[ Active Call Stack Frame Completes ]
               |
               v
    +-----------------------+
    | 1. process.nextTick() |  <-- Highest Priority (Drains completely)
    +-----------------------+
               |
               v
    +-----------------------+
    | 2. Promise / async    |  <-- Second Priority (Drains completely)
    +-----------------------+
               |
               v
+-------------------------------+
| Resume Event Loop Macrotask   |  (Timers, Poll, Check)
+-------------------------------+`
    },
    codeExample: {
      code: `console.log('1. Synchronous start');

setTimeout(() => {
  console.log('7. Macrotask: setTimeout');
}, 0);

setImmediate(() => {
  console.log('8. Macrotask: setImmediate');
});

Promise.resolve().then(() => {
  console.log('4. Microtask: Promise.then');
  process.nextTick(() => {
    console.log('6. Nested nextTick inside Promise');
  });
}).then(() => {
  console.log('5. Chained Promise.then');
});

process.nextTick(() => {
  console.log('2. Microtask: process.nextTick (Top Priority)');
});

queueMicrotask(() => {
  console.log('3. Microtask: queueMicrotask');
});

console.log('Synchronous end');`,
      language: 'javascript',
      output: `1. Synchronous start
Synchronous end
2. Microtask: process.nextTick (Top Priority)
4. Microtask: Promise.then
3. Microtask: queueMicrotask
6. Nested nextTick inside Promise
5. Chained Promise.then
7. Macrotask: setTimeout
8. Macrotask: setImmediate`,
      whyOutput:
        'Synchronous code finishes first. Then the nextTickQueue drains (logging #2). Then the promise microtask queue runs (logging #4, #3). Nested nextTicks are prioritized before remaining promise chains. Only after all microtasks are drained do macrotasks (setTimeout and setImmediate) execute.',
      annotations: [
        'Lines 1 & 24: Synchronous code executes immediately on the main call stack.',
        'Line 19: process.nextTick executes before any Promise or queueMicrotask.',
        'Lines 4 & 8: Macrotasks cannot run until all microtasks are exhausted.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Preventing Microtask Starvation in Heavy Async Pipelines',
      description:
        'Because the microtask queue drains continuously until empty, recursively calling process.nextTick() or chaining infinite Promises starves the event loop: I/O events, HTTP connections, and timers never execute. Senior engineers break heavy recursive operations using setImmediate() to let the event loop process I/O.',
      codeSnippet: `// DANGEROUS: Recursively queuing nextTick freezes the server!
function badLoop() {
  process.nextTick(badLoop); // STARVES THE EVENT LOOP!
}

// SAFE: Chunking large array processing across event loop ticks
function processLargeArray(items, index = 0) {
  if (index >= items.length) return;
  // Process chunk of 100 items
  for (let i = 0; i < 100 && index + i < items.length; i++) {
    compute(items[index + i]);
  }
  // Let the Event Loop handle incoming HTTP requests before next chunk!
  setImmediate(() => processLargeArray(items, index + 100));
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the priority difference between process.nextTick() and Promise microtasks?',
          spokenAnswer:
            'process.nextTick() has higher priority. Node.js maintains two separate microtask queues: the nextTickQueue and the promiseMicrotaskQueue. Node always drains all nextTick callbacks completely before executing any Promise or queueMicrotask callbacks.'
        },
        {
          question: 'When does Node.js drain the microtask queue?',
          spokenAnswer:
            'In modern Node.js (v11+), the microtask queue is drained immediately after every single individual callback finishes executing on the call stack, as well as before transitioning between any of the event loop phases.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the difference between queueMicrotask() and process.nextTick()?',
        answer:
          'queueMicrotask() is the standard web API that places callbacks in the V8 Promise microtask queue. process.nextTick() is a Node-specific API that places callbacks in the higher-priority nextTickQueue.'
      },
      commonMistakes: [
        'Believing Promise callbacks are macrotasks (Promises are always microtasks).',
        'Creating recursive process.nextTick() calls and wondering why the server stops responding to network traffic.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Microtasks (nextTick, Promises) run BEFORE any Macrotask (timers, I/O, immediate).',
        'process.nextTick has strict priority over Promise.then and queueMicrotask.',
        'Microtasks drain immediately after every single callback on the call stack.',
        'Recursive microtasks cause Event Loop Starvation.'
      ],
      oneLineDefinition:
        'Microtasks (nextTick, Promises) are high-priority callbacks executed immediately upon call stack clearance, before any event loop macrotask can run.',
      interviewTip:
        'State the execution order clearly: Sync Code -> process.nextTick -> Promise Microtasks -> Event Loop Macrotasks.'
    }
  },

  {
    id: 'node-process-next-tick',
    number: 8,
    title: 'process.nextTick()',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Event Loop and Asynchronous Execution',
    categorySlug: 'event-loop-async',
    estimatedMinutes: 5,
    concept30Sec:
      'process.nextTick() is a Node.js-specific API that schedules a callback to run immediately after the currently executing JavaScript operation completes, before the Event Loop yields or advances to any phase. It operates on an internal nextTickQueue that takes precedence over all other asynchronous queues.',
    internals: {
      overview:
        'process.nextTick() is technically not part of libuv; it is managed by the C++ Node.js process environment. When process.nextTick(cb) is invoked, cb is pushed to the internal nextTickQueue. As soon as the current synchronous execution context finishes, Node\'s internal runNextTicks() loop drains this queue before control returns to libuv.',
      flowSteps: [
        'Call process.nextTick(cb) -> callback pushed to nextTickQueue.',
        'Synchronous code continues executing to completion.',
        'Call stack clears -> Node immediately invokes runNextTicks().',
        'All nextTick callbacks executed in FIFO order.',
        'Only after nextTickQueue is empty does execution proceed to Promise microtasks or libuv phases.'
      ],
      diagram: `EXECUTION TIMELINE:
[ Synchronous JS Code ] ===> [ Call Stack Empties ]
                                       |
                                       v
                             [ process.nextTick() ]  <-- Runs HERE!
                                       |
                                       v
                             [ Promise.then() ]
                                       |
                                       v
                        [ Event Loop Phases (libuv) ]`
    },
    codeExample: {
      code: `import { EventEmitter } from 'node:eventemitter';

// Why process.nextTick is crucial: Emitting events after listeners attach
class StockTicker extends EventEmitter {
  constructor() {
    super();

    // BUGGY without nextTick: Emits synchronously before caller can attach listener!
    // this.emit('ready', 'SYNCHRONOUS_EMIT');

    // CORRECT: Defers emission until the caller has registered .on('ready')
    process.nextTick(() => {
      this.emit('ready', 'TICKER_INITIALIZED');
    });
  }
}

const ticker = new StockTicker();

// Listener is attached AFTER constructor finishes:
ticker.on('ready', (status) => {
  console.log('Received Event:', status); // Works reliably!
});

console.log('Constructor finished.');`,
      language: 'javascript',
      output: `Constructor finished.
Received Event: TICKER_INITIALIZED`,
      whyOutput:
        'If this.emit() were called synchronously in the constructor, the caller would not have attached the .on("ready") listener yet, missing the event. process.nextTick defers the emission until the current call stack (where ticker.on is registered) completes, but before any I/O can intervene.',
      annotations: [
        'Line 11: process.nextTick defers execution just long enough for listeners to be wired up.',
        'Line 20: .on("ready") registers before nextTickQueue is drained.',
        'Line 24: "Constructor finished" logs first, followed immediately by the event callback.'
      ]
    },
    nodeJsApplication: {
      scenario: 'API Error Normalization & Consistent Asynchrony (Zalgo Prevention)',
      description:
        'In Node.js libraries, an API should be 100% synchronous or 100% asynchronous, never mixed (a hazard known as "Unleashing Zalgo"). If a function serves cached data synchronously but uncached data asynchronously, consumers face unpredictable execution order. Using process.nextTick() guarantees cached results are always delivered asynchronously.',
      codeSnippet: `// Preventing Zalgo: Ensuring consistent asynchronous delivery
const memoryCache = new Map([['user:1', { name: 'Alice' }]]);

function getUser(id, callback) {
  if (memoryCache.has(id)) {
    // WRONG: callback(null, memoryCache.get(id)) runs synchronously!
    // RIGHT: Defer with nextTick to ensure caller expectations remain consistent!
    process.nextTick(() => callback(null, memoryCache.get(id)));
    return;
  }
  db.query('SELECT * FROM users WHERE id = ?', [id], callback);
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the primary use case for process.nextTick()?',
          spokenAnswer:
            'Two primary use cases: 1) Allowing constructors or factories to emit events or errors after the caller has had a chance to attach event listeners; 2) Preventing "Zalgo" by ensuring that cached synchronous data returns asynchronously, maintaining consistent async API behavior.'
        },
        {
          question: 'What is "Event Loop Starvation" caused by process.nextTick()?',
          spokenAnswer:
            'Event loop starvation occurs when process.nextTick() is called recursively. Because Node completely drains the nextTickQueue before returning to libuv, an infinite nextTick recursion locks the thread in microtask processing, completely starving the event loop and freezing all network I/O, timers, and file operations.'
        }
      ],
      trickyFollowUp: {
        question: 'What is "Unleashing Zalgo" in Node.js?',
        answer:
          'Unleashing Zalgo refers to writing a function that executes its callback synchronously in some cases (e.g. cache hits) and asynchronously in others (e.g. DB queries). This causes race conditions for the caller. process.nextTick() is used to normalize the function to always be asynchronous.'
      },
      commonMistakes: [
        'Using process.nextTick() for general asynchronous delays (use setImmediate or setTimeout instead).',
        'Calling process.nextTick recursively in loops, causing server freezes.'
      ]
    },
    quickRevision: {
      takeaways: [
        'process.nextTick runs BEFORE any event loop phase and before Promise microtasks.',
        'Key for: Emitting events in constructors after caller attaches listeners.',
        'Key for: Consistent asynchrony (preventing Zalgo).',
        'Recursive nextTick completely starves the Event Loop.'
      ],
      oneLineDefinition:
        'process.nextTick() schedules a callback to execute immediately upon completion of the current call stack frame, before the event loop advances.',
      interviewTip:
        'Remember the classic phrase: "Use process.nextTick() to allow event listeners to attach before firing events in constructors."'
    }
  },

  {
    id: 'node-set-immediate',
    number: 9,
    title: 'setImmediate()',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Event Loop and Asynchronous Execution',
    categorySlug: 'event-loop-async',
    estimatedMinutes: 5,
    concept30Sec:
      'setImmediate() is a Node.js-specific API that schedules a callback to run in the Check Phase of the Event Loop, immediately after I/O events in the Poll Phase have been processed. It is specifically designed to yield control back to the event loop and allow other pending I/O operations to proceed.',
    internals: {
      overview:
        'setImmediate() callbacks are queued in libuv\'s Check Phase queue. Unlike setTimeout(), which requires maintaining a min-heap of timestamps and performing clock calculations, setImmediate() does not involve time tracking. As soon as the Poll Phase completes, the event loop transitions directly into the Check Phase and drains the immediate queue.',
      flowSteps: [
        'setImmediate(cb) registers callback with libuv check handle.',
        'Event loop executes current phase.',
        'In the Poll phase: I/O events are handled.',
        'Event loop checks if setImmediate handles exist: if yes, proceeds directly to Check Phase.',
        'Check Phase: All setImmediate callbacks executed in FIFO order.'
      ],
      diagram: `EVENT LOOP CHECK PHASE TRANSITION:
[ Poll Phase (Processes I/O data) ]
                |
                v (Immediate handles pending?)
        +---------------+
        |  Check Phase  | ===> Executes all setImmediate() callbacks!
        +---------------+
                |
                v
        [ Close Callbacks ]`
    },
    codeExample: {
      code: `import fs from 'node:fs';

// Inside an I/O cycle, setImmediate ALWAYS executes before setTimeout(0)
fs.readFile(new URL(import.meta.url), () => {
  setTimeout(() => {
    console.log('2. setTimeout (Timers Phase)');
  }, 0);

  setImmediate(() => {
    console.log('1. setImmediate (Check Phase)');
  });
});`,
      language: 'javascript',
      output: `1. setImmediate (Check Phase)
2. setTimeout (Timers Phase)`,
      whyOutput:
        'Inside the fs.readFile callback, the event loop is in the Poll phase. The very next phase after Poll is Check (where setImmediate resides). The Timers phase is only reached after the loop completes the current iteration and begins a new turn.',
      annotations: [
        'Line 4: Inside I/O callback, Poll phase is active.',
        'Line 9: setImmediate is evaluated in Check phase (the immediate next step).',
        'Line 5: setTimeout is evaluated in Timers phase (must wait for loop restart).'
      ]
    },
    nodeJsApplication: {
      scenario: 'Chunking Large CPU Computations to Keep Event Loop Responsive',
      description:
        'When an Express server needs to process a massive array (e.g. 500,000 JSON records), executing a synchronous loop freezes incoming HTTP traffic. Chunking the work with setImmediate() yields the thread after each batch, allowing the event loop to service incoming network traffic in the Poll phase before resuming computation.',
      codeSnippet: `// Cooperative Multitasking: Chunking CPU work across Event Loop ticks
function batchProcess(items, batchSize = 1000) {
  let offset = 0;

  function processChunk() {
    const end = Math.min(offset + batchSize, items.length);
    for (let i = offset; i < end; i++) {
      transform(items[i]);
    }
    offset = end;

    if (offset < items.length) {
      // Yields to event loop so HTTP requests can be served, then resumes!
      setImmediate(processChunk);
    }
  }

  processChunk();
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the purpose of setImmediate() and where does it execute?',
          spokenAnswer:
            'setImmediate() is designed to execute code in the Check Phase of the Event Loop, immediately after I/O events in the Poll Phase have been processed. It is used to break up long-running tasks and yield control back to the event loop.'
        },
        {
          question: 'Why is setImmediate() called "immediate" if process.nextTick() runs sooner?',
          spokenAnswer:
            'It is a historical naming quirk in Node.js. process.nextTick() executes immediately upon call stack exit (before any event loop phase), whereas setImmediate() executes in the Check Phase after the Poll Phase. Node creator Ryan Dahl acknowledged that the names should ideally have been reversed.'
        }
      ],
      trickyFollowUp: {
        question: 'When executed in the main global module, is the order between setTimeout(0) and setImmediate() deterministic?',
        answer:
          'No! In the root global scope, the order between setTimeout(..., 0) and setImmediate() is non-deterministic (it depends on process startup time and CPU clock ticks). However, inside any I/O callback, setImmediate() is 100% guaranteed to run first.'
      },
      commonMistakes: [
        'Using setTimeout(fn, 0) instead of setImmediate() for cooperative multitasking (setTimeout has timer heap overhead and a 1ms minimum clamp).',
        'Assuming setImmediate runs before process.nextTick.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Executes in the Check Phase, immediately following the Poll Phase.',
        'Inside I/O: 100% guaranteed to execute before setTimeout(..., 0).',
        'Ideal for cooperative multitasking and chunking heavy loops.',
        'Lighter and faster than setTimeout(..., 0) (no timer min-heap overhead).'
      ],
      oneLineDefinition:
        'setImmediate() schedules a callback to execute in the Check Phase of the event loop immediately after I/O polling completes.',
      interviewTip:
        'Remember: setImmediate = Check Phase; inside any I/O callback, setImmediate ALWAYS runs before setTimeout.'
    }
  },

  {
    id: 'node-set-timeout',
    number: 10,
    title: 'setTimeout()',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Event Loop and Asynchronous Execution',
    categorySlug: 'event-loop-async',
    estimatedMinutes: 5,
    concept30Sec:
      'setTimeout() schedules a callback to execute in the Timers Phase of the Event Loop after a specified threshold of milliseconds has elapsed. In Node.js, timer thresholds are minimum wait times, NOT guaranteed execution times, because executing synchronous code or active I/O can delay callback execution.',
    internals: {
      overview:
        'Node.js implements timers using a Min-Heap (or hash table of linked lists for identical intervals) managed by libuv. Timers are indexed by expiration timestamp (now + delay). Node clamps any delay of 0ms or negative values to a minimum of 1ms (delays > 2147483647ms overflow 32-bit signed ints and become 1ms). In the Timers Phase, the engine compares the current clock against the earliest timer in the min-heap.',
      flowSteps: [
        'setTimeout(cb, delay) computes expiry: now + Math.max(1, delay).',
        'Timer object inserted into libuv\'s timer Min-Heap.',
        'When loop enters Timers Phase, it inspects min-heap root: if now >= expiry, callback executes.',
        'If synchronous code on the call stack blocks the thread for 5 seconds, a 100ms timer will execute after 5,000ms!'
      ],
      diagram: `TIMER MIN-HEAP IN LIBUV:
               [ Root: Earliest Expiring Timer (12ms) ]
                                /        \\
                               v          v
                       [ Timer (45ms) ]  [ Timer (120ms) ]
Each tick in Timers phase:
If (current_time >= root.expiry) -> Pop and execute callback!`
    },
    codeExample: {
      code: `const start = Date.now();

// Requesting a 100ms delay
setTimeout(() => {
  console.log(\`Timer callback executed after: \${Date.now() - start}ms\`);
}, 100);

// Synchronously blocking the Call Stack for 300ms!
console.log('Synchronously blocking the thread...');
while (Date.now() - start < 300) {
  // Freezes the main thread!
}
console.log('Unblocked. Waiting for timer...');`,
      language: 'javascript',
      output: `Synchronously blocking the thread...
Unblocked. Waiting for timer...
Timer callback executed after: 302ms`,
      whyOutput:
        'Even though the timer was set for 100ms, the while loop blocked the main call stack for 300ms. The event loop could not enter the Timers Phase until the synchronous loop finished, proving that setTimeout guarantees a MINIMUM delay, not an exact execution time.',
      annotations: [
        'Line 4: 100ms requested delay.',
        'Line 9: While loop prevents the event loop from turning for 300ms.',
        'Output: Timer executes at 302ms, immediately upon stack clearance.'
      ]
    },
    nodeJsApplication: {
      scenario: 'HTTP Request Timeout Boundaries & Unrefing Background Sockets',
      description:
        'In production Node.js servers, timers enforce socket and upstream API timeout boundaries. Additionally, Node provides "timer.unref()": allowing background timers (like health checks or token refreshes) to run without preventing the Node.js process from exiting when all active requests finish.',
      codeSnippet: `// Using timer.unref() for background telemetry
const telemetryTimer = setInterval(() => {
  sendMetricsHeartbeat();
}, 60000);

// unref() ensures this timer does NOT keep the Node.js process alive if the server closes!
telemetryTimer.unref();`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Does setTimeout(fn, 1000) guarantee execution in exactly 1,000 milliseconds?',
          spokenAnswer:
            'No. The delay parameter specifies the MINIMUM threshold time before the callback is eligible to run. If the main thread is busy executing synchronous JavaScript, or if the event loop is blocked in another phase, the callback will be delayed until the call stack clears and the loop reaches the Timers phase.'
        },
        {
          question: 'What is the purpose of timer.unref() and timer.ref()?',
          spokenAnswer:
            'By default, an active timer keeps the Node.js event loop active and prevents the process from exiting. Calling timer.unref() removes the timer from the event loop\'s active handle count, allowing the process to terminate cleanly if no other work is pending. timer.ref() restores the default behavior.'
        }
      ],
      trickyFollowUp: {
        question: 'Why does setTimeout(fn, 0) behave identically to setTimeout(fn, 1)?',
        answer:
          'Because the HTML and Node.js specifications clamp timeout values. In Node.js, if the delay is 0, negative, or not a number, it is automatically clamped to 1ms: "if (after <= 0) after = 1".'
      },
      commonMistakes: [
        'Relying on setTimeout for precision real-time clocks or financial trading ticks.',
        'Passing delays larger than 2,147,483,647ms (32-bit integer overflow causes them to execute in 1ms).'
      ]
    },
    quickRevision: {
      takeaways: [
        'setTimeout specifies MINIMUM delay, not exact execution time.',
        'Delay of 0ms is clamped to 1ms in Node.js internals.',
        'Managed via a Min-Heap data structure in libuv.',
        'timer.unref() allows Node process to exit without waiting for the timer.'
      ],
      oneLineDefinition:
        'setTimeout() registers a minimum-delay callback into libuv\'s timer min-heap to be executed in the Timers phase of the event loop.',
      interviewTip:
        'Emphasize that timers specify a MINIMUM delay, and mention timer.unref() as a senior-level Node.js optimization.'
    }
  },

  {
    id: 'node-blocking-vs-non-blocking',
    number: 11,
    title: 'Blocking vs Non-blocking Operations',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Event Loop and Asynchronous Execution',
    categorySlug: 'event-loop-async',
    estimatedMinutes: 5,
    concept30Sec:
      'Blocking operations execute synchronously on the main JavaScript thread, halting the Call Stack and preventing the Event Loop from processing any other code or incoming requests. Non-blocking operations execute asynchronously in the background (via OS kernel epoll or libuv worker threads), allowing the main thread to continue servicing concurrent traffic.',
    internals: {
      overview:
        'In Node.js, blocking occurs when JavaScript CPU execution monopolizes the V8 thread. Non-blocking operations use system descriptors: libuv registers socket read/write requests with the kernel and returns control immediately. When the kernel signals readiness, libuv schedules the callback. If an operation is blocking, the event loop stops spinning, causing connection timeouts for all connected clients.',
      flowSteps: [
        'Non-blocking: Call fs.readFile(..., cb) -> libuv offloads to background thread -> main thread proceeds.',
        'Event loop continues handling 10,000 other client requests in the Poll phase.',
        'Blocking: Call fs.readFileSync(...) -> main thread freezes -> entire process cannot handle any requests.',
        'CPU Blocking: Heavy JSON.parse() or regex backtracking blocks the main thread just like synchronous I/O.'
      ],
      diagram: `BLOCKING vs NON-BLOCKING THROUGHPUT:
BLOCKING (Synchronous):
Client A Request ===> [ Main Thread FREEZES for 200ms ] ===> Client A Response
Client B Request ===> [ WAITING in queue for 200ms... ]

NON-BLOCKING (Asynchronous):
Client A Request ===> [ Main Thread registers I/O in 1ms ] ===> Thread Free!
Client B Request ===> [ Main Thread registers I/O in 1ms ] ===> Thread Free!
Both clients served concurrently!`
    },
    codeExample: {
      code: `import fs from 'node:fs';

const start = Date.now();

// 1. Non-blocking Asynchronous Read: Main thread continues instantly!
fs.readFile(new URL(import.meta.url), () => {
  console.log(\`Async read completed after: \${Date.now() - start}ms\`);
});

console.log('Main thread free to process incoming HTTP requests!');

// 2. Blocking Synchronous Read: Stalls everything!
const data = fs.readFileSync(new URL(import.meta.url));
console.log(\`Sync read completed. Blocked thread for: \${Date.now() - start}ms\`);`,
      language: 'javascript',
      output: `Main thread free to process incoming HTTP requests!
Sync read completed. Blocked thread for: 3ms
Async read completed after: 4ms`,
      whyOutput:
        'The non-blocking fs.readFile schedules I/O on a background thread and immediately logs that the main thread is free. fs.readFileSync halts execution synchronously until bytes are read, preventing any other event from executing.',
      annotations: [
        'Line 6: Non-blocking call returns control immediately.',
        'Line 10: Server remains responsive to concurrent requests.',
        'Line 13: Blocking call monopolizes the single main thread.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Preventing Catastrophic Regex Backtracking (ReDoS) in Auth Routes',
      description:
        'In Node.js backends, blocking is not limited to file I/O. Vulnerable regular expressions with nested quantifiers (e.g. /(a+)+$/) executed on untrusted user strings cause exponential CPU backtracking (ReDoS). A single malicious HTTP request can lock the main thread for 30 seconds, taking down the entire API for all users.',
      codeSnippet: `// Catastrophic ReDoS Vulnerability:
const evilRegex = /^([a-zA-Z0-9])+(a+)+$/;

app.post('/login', (req, res) => {
  // If attacker sends "aaaaaaaaaaaaaaaaaaaaaaaaaaaa!", the main thread locks at 100% CPU!
  const isValid = evilRegex.test(req.body.username);
  res.json({ isValid });
});

// Solution: Use fast-validator, validator.js, or re2 (Google's linear-time regex engine)`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the difference between blocking and non-blocking in Node.js?',
          spokenAnswer:
            'Blocking refers to operations that execute synchronously on the single JavaScript thread, freezing the Call Stack and preventing the Event Loop from processing any other tasks. Non-blocking refers to operations that execute asynchronously in the background (via OS kernel or libuv threads), returning control to the main thread immediately so it can continue serving concurrent requests.'
        },
        {
          question: 'Can pure JavaScript code without I/O be blocking in Node.js?',
          spokenAnswer:
            'Yes! Any CPU-intensive JavaScript code—such as parsing a 50MB JSON payload, running nested loops over large arrays, or executing catastrophic regex backtracking—runs synchronously on the main V8 thread, blocking the event loop just as severely as synchronous file I/O.'
        }
      ],
      trickyFollowUp: {
        question: 'Does running synchronous code block the libuv worker thread pool?',
        answer:
          'No. Synchronous JavaScript blocks the main V8 thread, NOT the libuv thread pool. However, blocking the main thread prevents Node from receiving completed I/O callbacks from the thread pool.'
      },
      commonMistakes: [
        'Assuming only file I/O can be blocking (CPU-heavy loops and JSON parsing are equally blocking).',
        'Using fs.readFileSync inside Express route handlers.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Blocking = freezes the main V8 thread and halts the Event Loop.',
        'Non-blocking = returns immediately; delegates to kernel or libuv.',
        'CPU-heavy operations (JSON.parse, regex, crypto) are blocking.',
        'Never use synchronous I/O (*Sync) inside request handlers.'
      ],
      oneLineDefinition:
        'Blocking operations monopolize the single JavaScript thread, whereas non-blocking operations delegate work to background mechanisms and yield control immediately.',
      interviewTip:
        'Always emphasize: CPU-bound synchronous code is just as blocking to the event loop as synchronous I/O.'
    }
  },

  {
    id: 'node-sync-vs-async-apis',
    number: 12,
    title: 'Synchronous vs Asynchronous APIs',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Event Loop and Asynchronous Execution',
    categorySlug: 'event-loop-async',
    estimatedMinutes: 5,
    concept30Sec:
      'Node.js standard modules provide dual API sets: Synchronous APIs (e.g. fs.readFileSync, crypto.pbkdf2Sync) execute blocking C++ routines on the main thread; Asynchronous APIs (e.g. fs.readFile, fs.promises, crypto.pbkdf2) return immediately and notify via callbacks or Promises.',
    internals: {
      overview:
        'Synchronous APIs execute system calls directly on the V8 main thread, causing the thread to block in kernel mode waiting for disk heads or hardware return. Asynchronous APIs construct a work request struct (uv_work_t) and submit it to libuv. The main thread continues running; the background thread executes the operation, and when done, schedules an event on the loop to resolve the Promise.',
      flowSteps: [
        'Synchronous Call: V8 -> C++ Binding -> Direct blocking OS syscall -> Thread blocked -> Returns data.',
        'Asynchronous Call: V8 -> C++ Binding -> Schedules uv_work_t on libuv -> Returns Promise/handle immediately.',
        'Worker thread completes read -> marks uv_async_t handle as ready.',
        'Event loop poll phase picks up result -> resolves Promise callback on main thread.'
      ],
      diagram: `API EXECUTION PATHS:
SYNCHRONOUS (fs.readFileSync):
V8 Main Thread ===> [ Blocks on Disk Syscall ] ===> Returns Data

ASYNCHRONOUS (fs.promises.readFile):
V8 Main Thread ===> Submits work to libuv ===> Continues serving HTTP!
                         |
                         v (Background Thread reads disk)
            Event Loop notifies Promise callback`
    },
    codeExample: {
      code: `import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';

// 1. Synchronous API: Acceptable ONLY during initial server bootstrap
function loadInitialConfig() {
  // Reads local config once at startup before listening for traffic
  const raw = readFileSync('./package.json', 'utf-8');
  return JSON.parse(raw);
}

// 2. Asynchronous API: MANDATORY for runtime request handling
async function handleUserDocument(filePath) {
  // Completely non-blocking: allows concurrent requests while reading disk
  const content = await fs.readFile(filePath, 'utf-8');
  return content.length;
}

const config = loadInitialConfig();
console.log(\`Loaded config at bootstrap for: \${config.name}\`);
handleUserDocument('./package.json').then((len) => console.log(\`Doc length: \${len} bytes\`));`,
      language: 'javascript',
      output: `Loaded config at bootstrap for: frontend
Doc length: 1048 bytes`,
      whyOutput:
        'loadInitialConfig runs synchronously during process initialization before the HTTP server begins listening. handleUserDocument runs asynchronously using Node\'s fs/promises API, ensuring that runtime disk reads never block concurrent requests.',
      annotations: [
        'Line 6: readFileSync blocks the thread—acceptable ONLY during startup bootstrap.',
        'Line 13: fs.promises.readFile non-blocking—mandatory inside route handlers.',
        'Line 19: Async call resolves without stalling the main thread.'
      ]
    },
    nodeJsApplication: {
      scenario: 'The ONLY Valid Place for Synchronous APIs in Production Node.js',
      description:
        'The only acceptable use case for synchronous APIs in production Node.js is during the **Synchronous Bootstrap Phase** before the HTTP/gRPC server binds to its port (e.g. reading TLS certificates, loading initial environment configs, or initializing logger streams). Once server.listen() is called, calling ANY synchronous file or crypto API is an architectural defect.',
      codeSnippet: `import https from 'node:https';
import fs from 'node:fs';

// ACCEPTABLE: Synchronous file read during startup bootstrap
const sslOptions = {
  key: fs.readFileSync('/etc/ssl/certs/server.key'),
  cert: fs.readFileSync('/etc/ssl/certs/server.crt'),
};

const server = https.createServer(sslOptions, (req, res) => {
  // FORBIDDEN: Calling fs.readFileSync here will collapse your server under load!
  res.end('Secure request processed');
});

server.listen(443);`
    },
    interviewPrep: {
      questions: [
        {
          question: 'When is it acceptable to use Synchronous APIs (*Sync) in Node.js?',
          spokenAnswer:
            'Synchronous APIs are acceptable ONLY during the application startup/bootstrap phase before the server begins listening for incoming traffic (e.g., loading configuration files, reading TLS/SSL certificates, or validating essential environment variables). Once the server starts accepting requests, all operations must be asynchronous.'
        },
        {
          question: 'What happens if you use fs.readFileSync inside an Express route handler under load?',
          spokenAnswer:
            'It serializes all concurrent requests. While the file is being read from disk, the single JavaScript main thread is completely frozen. All incoming HTTP requests queue up, response times spike across all endpoints, and under load, the server will drop connections and fail health checks.'
        }
      ],
      trickyFollowUp: {
        question: 'Why does Node.js provide synchronous APIs at all if they are dangerous?',
        answer:
          'For CLI utilities, build scripts, test setups, and application bootstrap routines where sequential, synchronous execution simplifies logic and non-blocking concurrency is not needed.'
      },
      commonMistakes: [
        'Using fs.existsSync or fs.readFileSync inside Express or Fastify request handlers.',
        'Using crypto.pbkdf2Sync for password verification inside login routes.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Sync APIs (*Sync) block the main V8 thread directly.',
        'Async APIs offload work to libuv and return Promises/callbacks.',
        'Sync is acceptable ONLY during server startup bootstrap (loading SSL, config).',
        'Inside runtime request handlers, ALWAYS use asynchronous APIs (fs/promises).'
      ],
      oneLineDefinition:
        'Synchronous APIs halt the main thread until the OS system call completes, while Asynchronous APIs offload work to libuv and resolve via non-blocking callbacks.',
      interviewTip:
        'State the production rule: "Sync at startup for SSL/config is fine; Sync in request handlers is a fatal bug."'
    }
  }
];
