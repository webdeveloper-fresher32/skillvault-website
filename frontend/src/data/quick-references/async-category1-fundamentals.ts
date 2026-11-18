import { QuickReferenceTopic } from './types';

export const asyncCategory1Fundamentals: QuickReferenceTopic[] = [
  {
    id: 'async-sync-vs-async-execution',
    number: 1,
    title: 'Synchronous vs Asynchronous Execution',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Asynchronous Programming Fundamentals',
    categorySlug: 'async-fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'Synchronous code executes sequentially line-by-line on the call stack, halting further execution until the current instruction finishes. Asynchronous code offloads long-running tasks (network I/O, file access, timers) to the operating system or libuv thread pool, freeing the call stack to process other requests while waiting for completion.',
    internals: {
      overview:
        'In synchronous execution, each stack frame occupies V8 single thread execution context. In asynchronous execution, Node.js initiates an operation via libuv (e.g., non-blocking socket read via epoll/kqueue). V8 pops the initiating function off the call stack immediately. When the OS finishes the I/O, libuv notifies the event loop, which queues the corresponding callback into the microtask or macrotask queue for execution when the call stack clears.',
      flowSteps: [
        '1. Synchronous Call: Pushed onto V8 Call Stack -> Executes -> Evaluates -> Stack frame popped. Next line runs.',
        '2. Asynchronous Call: Invoked on Call Stack -> Delegates handle/request to libuv/OS kernel -> Returns immediately.',
        '3. Non-blocking Wait: The main V8 thread continues executing subsequent application code or handling new HTTP requests.',
        '4. Completion Notification: OS kernel signals libuv (via epoll/kqueue/IOCP) that data is ready.',
        '5. Event Loop Dispatch: libuv places the registered callback/promise reaction into the appropriate queue.',
        '6. Stack Re-entry: When V8 call stack is completely empty, the Event Loop pushes the callback onto the stack.'
      ],
      diagram: `SYNCHRONOUS VS ASYNCHRONOUS EXECUTION:

Synchronous (Blocking Call Stack):
   Line 1 ----> [ Line 1: compute() ] =====> Finishes
   Line 2 ----> [ Line 2: readFileSync() ] (Thread BLOCKED 50ms) ====> Finishes
   Line 3 ----> [ Line 3: response() ] ====> Cannot run until Line 2 completes!

Asynchronous (Non-Blocking Offloading):
   Call Stack:      [ fs.readFile() ] -> Registers with libuv -> Stack Cleared!
   libuv / OS:                          [ OS disk read executes in background ]
   Call Stack:      [ Process Request B ] -> [ Process Request C ] (High Concurrency)
   Event Loop:                          OS finishes -> Callback queued -> Stack executes`
    },
    codeExample: {
      code: `import fs from 'node:fs';

console.log('1: Mainline Start');

// Synchronous I/O: blocks V8 main thread completely
const syncData = fs.readFileSync(new URL(import.meta.url), 'utf-8');
console.log('2: Sync read complete, length:', syncData.length);

// Asynchronous I/O: non-blocking, handled by libuv thread pool
fs.readFile(new URL(import.meta.url), 'utf-8', (err, asyncData) => {
  if (err) throw err;
  console.log('4: Async read callback executed, length:', asyncData.length);
});

console.log('3: Mainline End - Next requests can be processed immediately');`,
      language: 'javascript',
      output: `1: Mainline Start
2: Sync read complete, length: 734
3: Mainline End - Next requests can be processed immediately
4: Async read callback executed, length: 734`,
      whyOutput:
        'Line 1 logs synchronously. Line 2 blocks until the entire file is loaded into memory. Line 3 initiates the asynchronous file read via libuv and immediately logs before the file I/O finishes. Line 4 only logs when the event loop reaches the Poll phase and dequeues the I/O callback.'
    },
    nodeJsApplication: {
      scenario: 'High-Concurrency HTTP Web Servers',
      description:
        'In a Node.js API server handling 5,000 req/sec, synchronous file or database operations (e.g., readFileSync, heavy cryptographic loops) freeze the single V8 thread. All 4,999 other concurrent users experience catastrophic latency spikes or connection timeouts. Asynchronous non-blocking operations ensure the server remains responsive to incoming TCP handshakes.',
      codeSnippet: `// BAD: Server freezes during file read
app.get('/config-bad', (req, res) => {
  const data = fs.readFileSync('./large-config.json', 'utf8'); // BLOCKS entire event loop
  res.send(data);
});

// GOOD: Event loop remains unblocked, handling hundreds of concurrent requests
app.get('/config-good', async (req, res, next) => {
  try {
    const data = await fs.promises.readFile('./large-config.json', 'utf8');
    res.send(data);
  } catch (err) {
    next(err);
  }
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the fundamental difference between synchronous and asynchronous execution in Node.js?',
          spokenAnswer:
            'Synchronous execution runs code sequentially on V8 single call stack, halting the main thread until the current operation completes. Asynchronous execution delegates slow I/O or timer operations to libuv or the OS kernel, allowing the call stack to stay free to handle concurrent requests. The result is returned later via a callback or promise queued in the event loop.'
        },
        {
          question: 'Why does Node.js use asynchronous non-blocking I/O by default?',
          spokenAnswer:
            'Because Node.js runs JavaScript on a single thread. If I/O operations like database queries or network requests blocked that thread, the entire server would stall and fail to handle any other concurrent requests. Asynchronous I/O allows a single process to scale to tens of thousands of concurrent connections with minimal memory overhead.'
        }
      ],
      trickyFollowUp: {
        question: 'Does asynchronous code always run in a separate background thread in Node.js?',
        answer:
          'No! This is a common misconception. Network I/O (HTTP, TCP, UDP, DNS resolve) uses native non-blocking OS system calls (epoll on Linux, kqueue on macOS, IOCP on Windows) without consuming any OS threads. Only file system operations, crypto, zlib, and getaddrinfo use libuv background thread pool (default 4 threads).'
      },
      commonMistakes: [
        'Believing asynchronous code runs in parallel on multiple CPU cores by default (JavaScript logic itself still executes on the single main thread).',
        'Using synchronous methods like fs.readFileSync, crypto.pbkdf2Sync, or JSON.parse on 100MB payloads inside Express route handlers.',
        'Assuming setTimeout(fn, 0) runs immediately on the next line rather than after current call stack and microtasks clear.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Synchronous operations block the single V8 call stack; asynchronous operations offload work and notify via event loop queues.',
        'Network I/O is handled by OS kernel notification mechanisms (epoll/kqueue) without thread pool overhead.',
        'Never invoke *Sync functions in request/response lifecycles of production Node.js services.'
      ],
      oneLineDefinition:
        'Synchronous execution halts the call stack until done; asynchronous execution offloads tasks so the single thread can service other operations in parallel.',
      interviewTip:
        'Emphasize latency hiding: Node.js does not make I/O faster; it simply avoids wasting CPU cycles waiting for I/O to finish.',
      keyDistinction:
        'Sync vs Async: Sync holds CPU cycles idle while waiting for external resources; Async frees the CPU to execute other tasks concurrently.'
    }
  },
  {
    id: 'async-callbacks',
    number: 2,
    title: 'Callbacks',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Asynchronous Programming Fundamentals',
    categorySlug: 'async-fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'A callback is a function passed as an argument to another function, intended to be executed later when an operation finishes. In Node.js, asynchronous callbacks universally follow the "error-first" convention: the first parameter is reserved for an error object (or null), followed by the result data.',
    internals: {
      overview:
        'Callbacks represent continuation-passing style (CPS). When an asynchronous API is called, Node.js registers the callback reference in memory along with the underlying libuv request handle. When the async operation completes, libuv pushes the callback reference into the event loop queue. When the V8 call stack becomes empty, the event loop dequeues the callback, creates a new execution context, and invokes it.',
      flowSteps: [
        '1. Function Registration: fs.readFile(path, cb) passes reference of cb to Node C++ binding.',
        '2. Request Allocation: libuv allocates an fs_req struct holding the callback pointer.',
        '3. Work Queued: libuv assigns the file read to its worker thread pool.',
        '4. Event Loop Turn: Main thread continues executing code below the readFile call.',
        '5. Thread Completion: Worker thread finishes disk read, packages buffer or error, and posts to libuv event queue.',
        '6. Callback Invocation: Poll phase checks completed requests, invokes cb(err, data) on the main thread.'
      ],
      diagram: `ERROR-FIRST CALLBACK PATTERN:

fs.readFile('/data.txt', (err, data) => {
   |
   +--> if (err) {
   |       // 1. Handle failure: network error, ENOENT, permission denied
   |       return logger.error(err);
   |    }
   |
   +--> // 2. Handle success: data buffer/string available
        console.log(data.toString());
});`
    },
    codeExample: {
      code: `import fs from 'node:fs';

// Node.js Error-First Callback Convention
function fetchConfig(filePath, callback) {
  fs.readFile(filePath, 'utf8', (err, rawData) => {
    // Rule 1: Always check err first
    if (err) {
      return callback(new Error(\`Failed to read config: \${err.message}\`));
    }

    try {
      // Rule 2: Synchronous JSON parse can throw, must catch
      const parsed = JSON.parse(rawData);
      return callback(null, parsed);
    } catch (parseErr) {
      return callback(new Error(\`Invalid JSON format: \${parseErr.message}\`));
    }
  });
}

// Usage
fetchConfig('./package.json', (err, config) => {
  if (err) {
    console.error('Error branch:', err.message);
    return;
  }
  console.log('Success branch: Package name is', config.name);
});`,
      language: 'javascript',
      output: `Success branch: Package name is SkillVault-website`,
      whyOutput:
        'fs.readFile completes asynchronously. Because no error occurred, err is null and rawData contains the file contents. JSON.parse parses it successfully and invokes callback(null, parsed). The consumer checks if (err) first and logs the success message.'
    },
    nodeJsApplication: {
      scenario: 'Legacy Core Modules and Performance-Critical Event Handlers',
      description:
        'Although Promises and async/await are preferred in modern application code, core low-level Node.js primitives (like Streams, EventEmitters, and TLS sockets) use callback conventions because allocating Promise objects creates microtask queue overhead and heap allocations in ultra-high-throughput streaming pipelines.',
      codeSnippet: `import { createReadStream } from 'node:fs';

const stream = createReadStream('/var/log/access.log');
// Low-overhead callback listeners:
stream.on('data', (chunk) => {
  // Callback invoked on each byte chunk directly from kernel buffer
  processChunk(chunk);
});
stream.on('error', (err) => {
  console.error('Stream failure:', err);
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the Node.js error-first callback convention and why was it designed this way?',
          spokenAnswer:
            'The error-first callback convention requires the first argument of the callback to be reserved for an Error object (or null if successful), and subsequent arguments for the resulting data. It was designed because asynchronous callbacks execute on a separate call stack tick, meaning traditional try/catch blocks cannot catch errors thrown inside them. Reserving the first argument enforces consistent, explicit error handling.'
        },
        {
          question: 'Can you use try/catch to handle errors thrown inside an asynchronous callback?',
          spokenAnswer:
            'No. When the asynchronous callback executes, the original try/catch block that initiated the async call has already finished and been popped off the call stack. Uncaught exceptions inside async callbacks become unhandled exceptions that crash the Node.js process unless caught by process.on("uncaughtException").'
        }
      ],
      trickyFollowUp: {
        question: 'What happens if a callback is executed synchronously in some conditions and asynchronously in others (the "Zalgo" problem)?',
        answer:
          'Inconsistent callback timing (sometimes sync, sometimes async) leads to severe race conditions because caller state mutations occur unpredictably. Node.js strictly advises never releasing Zalgo. If an API is asynchronous, every execution path must be asynchronous, using process.nextTick() or queueMicrotask() to defer cached synchronous results.'
      },
      commonMistakes: [
        'Forgetting the return keyword in if (err) return callback(err);, causing the function to continue executing and calling the callback twice.',
        'Wrapping asynchronous API calls in try/catch and expecting it to catch callback errors.',
        'Calling a callback multiple times in one operation, corrupting application state downstream.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Error-first callback convention: callback(err, result) with err === null on success.',
        'try/catch cannot catch errors originating inside asynchronous callbacks because the caller stack frame is already gone.',
        'Never release Zalgo: if a function accepts a callback, ensure it is ALWAYS called asynchronously.'
      ],
      oneLineDefinition:
        'A callback is a function passed as an argument to be invoked upon completion of an asynchronous task, standardizing on callback(err, data).',
      interviewTip:
        'Always point out why try/catch fails with callbacks: the call stack unwinds before the callback is dequeued from the event loop.',
      keyDistinction:
        'Sync Callback (Array.prototype.map) vs Async Callback (fs.readFile): Sync callbacks block immediately; async callbacks execute on a future event loop tick.'
    }
  },
  {
    id: 'async-callback-hell',
    number: 3,
    title: 'Callback Hell',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Asynchronous Programming Fundamentals',
    categorySlug: 'async-fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'Callback Hell (also called the "Pyramid of Doom") is an anti-pattern that occurs when multiple sequential asynchronous operations are nested inside each other. It leads to deeply indented, unreadable code, difficult error handling, inversion of control, and unmanageable control flow.',
    internals: {
      overview:
        'Callback Hell is not merely an aesthetic indentation problem; it creates deep architectural flaws: 1) Inversion of Control: you trust third-party callbacks to execute once, not zero or two times. 2) Error Propagation: every single nested callback must independently check if (err) and manually bubble the error upwards. 3) Memory Closure Leaks: deeply nested functions retain outer lexical scope variables in memory longer than necessary.',
      flowSteps: [
        '1. Step 1 Invoked: Async operation 1 initiates. Indentation level 1.',
        '2. Nested Step 2: In callback 1, initiate Async operation 2. Indentation level 2.',
        '3. Nested Step 3: In callback 2, initiate Async operation 3. Indentation level 3.',
        '4. Scattered Error Handling: Each step has its own error check. If step 3 fails, steps 1 & 2 must be manually cleaned up or rolled back.',
        '5. Complex Refactoring: Extracting steps, running tasks in parallel, or adding timeouts requires fragile state flags.'
      ],
      diagram: `CALLBACK HELL (PYRAMID OF DOOM):

getUser(userId, (err, user) => {
  if (err) return handleError(err);
  getOrders(user.id, (err, orders) => {
    if (err) return handleError(err);
    getOrderDetails(orders[0].id, (err, details) => {
      if (err) return handleError(err);
      processPayment(details, (err, receipt) => {
        if (err) return handleError(err);
        sendEmail(user.email, receipt, (err) => {
          // >>> Deeply nested, error-prone, fragile control flow!
        });
      });
    });
  });
});`
    },
    codeExample: {
      code: `// BAD: The Pyramid of Doom (Nested Callbacks)
function badWorkflow(userId, callback) {
  fetchUser(userId, (err, user) => {
    if (err) return callback(err);
    fetchPermissions(user.role, (err, perms) => {
      if (err) return callback(err);
      fetchAuditLog(user.id, (err, logs) => {
        if (err) return callback(err);
        callback(null, { user, perms, logs });
      });
    });
  });
}

// MODERN REFACTOR: Using Promises & async/await
async function modernWorkflow(userId) {
  // Linear, readable, centralized try/catch error propagation
  const user = await fetchUserPromise(userId);
  // Independent queries can run concurrently via Promise.all!
  const [perms, logs] = await Promise.all([
    fetchPermissionsPromise(user.role),
    fetchAuditLogPromise(user.id)
  ]);
  return { user, perms, logs };
}`,
      language: 'javascript',
      output: `// Returns structured resolved data cleanly without indentation nesting`,
      whyOutput:
        'The refactored version flattens asynchronous flow into readable linear code using async/await. It also allows running independent steps (permissions and audit logs) in parallel rather than blocking them sequentially.'
    },
    nodeJsApplication: {
      scenario: 'Legacy Codebase Migration with util.promisify',
      description:
        'When maintaining enterprise Node.js applications containing older callback-based libraries, senior engineers use Node.js built-in util.promisify to convert error-first callbacks into standard native Promises, eliminating callback nesting cleanly.',
      codeSnippet: `import { promisify } from 'node:util';
import fs from 'node:fs';

// Convert callback API to Promise API instantly
const readFileAsync = promisify(fs.readFile);

async function loadServiceConfig() {
  try {
    const raw = await readFileAsync('./service.json', 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(\`Config initialization failed: \${err.message}\`);
  }
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is Callback Hell and what problems does it cause besides poor readability?',
          spokenAnswer:
            'Callback Hell is the anti-pattern of deeply nesting asynchronous callbacks. Beyond visual indentation ("pyramid of doom"), it causes three critical architectural problems: 1) Difficult and repetitive error handling, where every level must manually check and forward errors; 2) Inversion of control, where you surrender execution authority to another function with no guarantee it will run exactly once; and 3) Complex composition, making parallel execution, timeouts, and cancellations extremely hard to manage.'
        },
        {
          question: 'How do you migrate legacy callback-based code to modern asynchronous JavaScript?',
          spokenAnswer:
            'You wrap callback-based functions in Promises using the Promise constructor or Node.js built-in util.promisify for error-first signatures. Once promisified, you consume them with async/await, flatten the control flow, and use Promise combinators like Promise.all() for concurrent operations.'
        }
      ],
      trickyFollowUp: {
        question: 'Does breaking nested callbacks into named functions solve the core issues of Callback Hell?',
        answer:
          'No! Breaking nested callbacks into separate named functions reduces horizontal indentation, but it does NOT solve inversion of control, does NOT provide centralized error bubbling, and scatters related asynchronous logic across multiple disconnected functions.'
      },
      commonMistakes: [
        'Believing Callback Hell is just about indentation: the real danger is broken error propagation and inversion of control.',
        'Mixing callbacks and Promises in the same function, leading to unhandled rejections and duplicate executions.',
        'Not realizing that independent operations inside callback pyramids were accidentally executed sequentially instead of concurrently.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Callback Hell causes poor readability, scattered error handling, and loss of control flow.',
        'Use util.promisify or fs.promises to convert legacy callback APIs into modern Promises.',
        'async/await transforms nested asynchronous operations into flat, readable, linear code with standard try/catch blocks.'
      ],
      oneLineDefinition:
        'Callback Hell is the anti-pattern of deeply nested asynchronous callbacks that destroys code readability, error handling, and maintainability.',
      interviewTip:
        'Highlight "Inversion of Control" and "Scattered Error Bubbling" to stand out as a senior engineer rather than just mentioning messy indentation.',
      keyDistinction:
        'Named Callbacks vs Promises: Named callbacks only fix code indentation; Promises fundamentally fix control flow, value return, and error propagation.'
    }
  }
];
