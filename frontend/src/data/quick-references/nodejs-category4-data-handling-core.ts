import { QuickReferenceTopic } from './types';

export const nodejsCategory4DataHandlingCore: QuickReferenceTopic[] = [
  {
    id: 'node-streams',
    number: 16,
    title: 'Streams',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Data Handling and Core Modules',
    categorySlug: 'data-handling-core',
    estimatedMinutes: 5,
    concept30Sec:
      'Streams are collections of data that might not be available all at once and don\'t have to fit into memory. Instead of loading an entire 5GB file or payload into RAM, streams process data sequentially piece-by-piece (chunks), delivering optimal memory efficiency and near-instant time-to-first-byte.',
    internals: {
      overview:
        'The four stream types: 1) Readable: source of data (fs.createReadStream, req); 2) Writable: destination for data (fs.createWriteStream, res); 3) Duplex: both readable and writable (net.Socket); 4) Transform: duplex stream that modifies data as it passes through (zlib.createGzip, crypto.createCipheriv). Backpressure occurs when a readable stream pushes data faster than the writable stream can consume it. Node handles backpressure via highWaterMark (default 64KB for files, 16KB for objects); when the internal buffer fills, write() returns false, pausing the readable source until a "drain" event fires.',
      flowSteps: [
        'Readable reads chunks from disk/network into internal buffer (up to highWaterMark, default 64KB).',
        'Data piped to Writable: destination.write(chunk).',
        'Backpressure: If writable destination buffer exceeds highWaterMark, destination.write() returns false.',
        'Readable automatically pauses pushing chunks (.pause()).',
        'Writable drains buffer -> emits "drain" event -> Readable resumes (.resume()).',
        'pipe() and stream.pipeline() manage this backpressure loop automatically.'
      ],
      diagram: `BACKPRESSURE FLOW IN STREAMS:
[ Readable Source ] ===(Pushes Chunks)===> [ Writable Destination ]
        ^                                            |
        | (write() returns false: PAUSE!)            | (Buffer exceeds highWaterMark)
        +--------------------------------------------+
        | (Buffer emptied: "drain" event -> RESUME!)
        +--------------------------------------------+`
    },
    codeExample: {
      code: `import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

// Processing a file chunk-by-chunk with zero memory bloat!
// 1. Transform Stream: Converts incoming chunks to uppercase
const upperCaseTransform = new Transform({
  transform(chunk, encoding, callback) {
    // Transform chunk without buffering entire file in RAM
    callback(null, chunk.toString().toUpperCase());
  }
});

// 2. pipeline(): Safely handles piping, backpressure, and automatic cleanup
async function processLargeFile() {
  const source = createReadStream('./package.json', { highWaterMark: 1024 }); // 1KB chunks
  const destination = createWriteStream('./package-uppercase.tmp');

  console.log('Streaming file with backpressure management...');
  await pipeline(source, upperCaseTransform, destination);
  console.log('Stream completed successfully with minimal memory footprint!');
}

processLargeFile();`,
      language: 'javascript',
      output: `Streaming file with backpressure management...
Stream completed successfully with minimal memory footprint!`,
      whyOutput:
        'Instead of reading the entire file into a giant Buffer with fs.readFile(), pipeline streams chunks through the Transform stream directly to the destination file. Memory consumption remains pegged at the size of highWaterMark (~1KB) regardless of whether the file is 1MB or 50GB.',
      annotations: [
        'Line 7: Transform stream operates on small individual chunks.',
        'Line 16: highWaterMark controls buffer threshold size.',
        'Line 20: pipeline() automatically forwards errors and manages backpressure pauses/drains.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Streaming Multi-Gigabyte CSV Exports & Video Streaming in Express',
      description:
        'Loading a 2GB database export or video file into RAM via fs.readFile() will crash the Node.js process with a "JavaScript heap out of memory" error. Streaming rows from PostgreSQL (using pg-query-stream) directly into res.write() streams gigabytes of data with a constant memory footprint under 30MB.',
      codeSnippet: `// Express Streaming CSV Export directly from Database:
app.get('/api/export/transactions', async (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');

  const dbStream = db.queryStream('SELECT * FROM transactions'); // Readable Stream
  const csvFormatter = new CsvTransformStream(); // Transform Stream

  // Automatically manages backpressure if client network is slow!
  await pipeline(dbStream, csvFormatter, res);
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is Backpressure in Node.js streams and how is it handled?',
          spokenAnswer:
            'Backpressure occurs when the readable stream produces data faster than the writable destination can consume or write it. To prevent RAM from exhausting, the writable stream\'s internal buffer reaches its highWaterMark threshold and write() returns false. The readable stream pauses emitting data until the writable destination finishes writing and emits the "drain" event, resuming the readable stream.'
        },
        {
          question: 'Why should you prefer stream.pipeline() over stream.pipe()?',
          spokenAnswer:
            'stream.pipe() does NOT automatically destroy streams or forward errors if one stream in the chain fails, causing subtle file descriptor and memory leaks in production. stream.pipeline() (from node:stream/promises) properly destroys all streams in the pipeline upon any error, forwards errors cleanly, and supports modern async/await syntax.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the default highWaterMark for ObjectMode streams vs Buffer streams?',
        answer:
          'For standard Buffer/Binary streams, highWaterMark defaults to 64KB (16KB in earlier Node versions). For ObjectMode streams (streams that emit JS objects rather than binary chunks), highWaterMark defaults to 16 objects.'
      },
      commonMistakes: [
        'Using fs.readFile() for large files or user file uploads, causing OOM crashes.',
        'Chaining multiple streams with .pipe() without attaching error listeners to every individual stream.'
      ]
    },
    quickRevision: {
      takeaways: [
        '4 Stream Types: Readable, Writable, Duplex, Transform.',
        'Backpressure: pauses readable when writable buffer reaches highWaterMark.',
        'Always use stream.pipeline() instead of .pipe() for automatic cleanup.',
        'highWaterMark: 64KB for binary; 16 for objectMode.'
      ],
      oneLineDefinition:
        'Streams are asynchronous chunk-by-chunk data pipelines that process arbitrarily large files with constant, minimal memory overhead.',
      interviewTip:
        'State the backpressure rule: "When writable buffer hits highWaterMark, write() returns false -> source pauses -> drain event fires -> source resumes."'
    }
  },

  {
    id: 'node-buffers',
    number: 17,
    title: 'Buffers',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Data Handling and Core Modules',
    categorySlug: 'data-handling-core',
    estimatedMinutes: 5,
    concept30Sec:
      'A Buffer is a global class in Node.js used to represent, store, and manipulate raw binary data directly in memory. Buffers reside outside the V8 JavaScript heap in native C++ memory allocated by libuv, enabling high-performance handling of network TCP streams, images, and file system bytes.',
    internals: {
      overview:
        'In V8, strings are UTF-16 encoded and managed on the garbage-collected V8 heap. Buffers inherit from JavaScript\'s Uint8Array (a TypedArray of 8-bit unsigned integers from 0 to 255). Buffers are allocated directly via libuv C++ malloc() outside the V8 heap. This prevents binary payloads from stressing the V8 garbage collector. Node uses an internal 8KB memory pool (Buffer.poolSize) to avoid frequent OS memory allocations for small buffers.',
      flowSteps: [
        'Buffer.alloc(size): Allocates zero-filled native memory outside V8 heap (safe).',
        'Buffer.allocUnsafe(size): Allocates uninitialized native memory (extremely fast, but contains old memory data!).',
        'Buffer.from(data, encoding): Encodes strings, arrays, or ArrayBuffers into raw binary bytes.',
        'ArrayBuffer vs Buffer: ArrayBuffer is the ECMA standard binary container; Buffer is Node\'s specialized, performance-tuned subclass.'
      ],
      diagram: `MEMORY LAYOUT OF BUFFERS:
+-----------------------------------------------------------+
| V8 ENGINE HEAP (Managed by GC)                            |
| - JavaScript Objects, Arrays, Strings, Variables          |
+-----------------------------------------------------------+
                             |
                             v (References external memory)
+-----------------------------------------------------------+
| NATIVE C++ MEMORY (Outside V8 Heap / Not collected by GC) |
| - Buffer memory (Raw binary bytes: 0x00 to 0xFF)          |
| - Fast zero-copy TCP sockets and Disk bytes               |
+-----------------------------------------------------------+`
    },
    codeExample: {
      code: `// 1. Safe Allocation vs Unsafe Allocation
const safeBuf = Buffer.alloc(8); // Zero-filled: [00, 00, 00, 00, 00, 00, 00, 00]
console.log('Safe Buffer:', safeBuf);

// Buffer.allocUnsafe: Super fast, but contains stale memory bytes!
const unsafeBuf = Buffer.allocUnsafe(8);
console.log('Unsafe Buffer (Stale memory):', unsafeBuf);

// 2. Encoding and String conversions
const textBuf = Buffer.from('Node.js Architecture', 'utf-8');
console.log('Buffer Hex:', textBuf.toString('hex'));
console.log('Buffer Base64:', textBuf.toString('base64'));
console.log('Buffer Byte Length:', textBuf.byteLength); // 21 bytes

// 3. Modifying raw bytes directly
textBuf[0] = 0x6E; // Lowercase 'n'
console.log('Modified String:', textBuf.toString('utf-8'));`,
      language: 'javascript',
      output: `Safe Buffer: <Buffer 00 00 00 00 00 00 00 00>
Unsafe Buffer (Stale memory): <Buffer e0 12 4b 01 00 00 00 00>
Buffer Hex: 4e6f64652e6a7320417263686974656374757265
Buffer Base64: Tm9kZS5qcyBBcmNoaXRlY3R1cmU=
Buffer Byte Length: 21
Modified String: node.js Architecture`,
      whyOutput:
        'Buffer.alloc fills bytes with zeros. Buffer.allocUnsafe skips zero-filling, leaving old RAM bytes (giving maximum speed, but potentially leaking sensitive memory if transmitted without overwriting). Each byte is an integer from 0 to 255 (0x00 to 0xFF).',
      annotations: [
        'Line 2: Buffer.alloc initializes all bytes to 0 (always prefer in web APIs).',
        'Line 6: Buffer.allocUnsafe is fast because it bypasses zero-initialization.',
        'Line 10: Buffers natively encode to utf-8, hex, base64, and binary.'
      ]
    },
    nodeJsApplication: {
      scenario: 'High-Performance Image Headers Inspection & Token Generation',
      description:
        'When validating uploaded files, checking file extensions is insecure because attackers can rename a .php file to .png. Instead, backend services inspect the first few "Magic Bytes" of the Buffer (e.g. PNG files always start with 89 50 4E 47 in hex).',
      codeSnippet: `// Inspecting File Magic Bytes using Buffers
function isPngImage(fileBuffer) {
  // PNG Magic Numbers: 0x89, 0x50, 0x4E, 0x47
  return (
    fileBuffer[0] === 0x89 &&
    fileBuffer[1] === 0x50 &&
    fileBuffer[2] === 0x4E &&
    fileBuffer[3] === 0x47
  );
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the security risk of using Buffer.allocUnsafe()?',
          spokenAnswer:
            'Buffer.allocUnsafe() allocates memory without zero-filling it. The returned buffer may contain old, sensitive data from previously freed memory (such as passwords, credit card numbers, or cryptographic keys). If this buffer is sent over the network or saved without being fully overwritten, it can leak sensitive information.'
        },
        {
          question: 'Where is Buffer memory allocated in Node.js?',
          spokenAnswer:
            'Buffer memory is allocated in native C++ memory outside of the V8 JavaScript heap. This allows Node to store large binary payloads without inflating V8 heap usage or causing Garbage Collection pauses.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the difference between Buffer.byteLength() and string.length?',
        answer:
          'string.length counts the number of UTF-16 code units (characters). Buffer.byteLength() counts the actual number of raw bytes required to store that string in a given encoding. For example, the emoji "🚀" has a string.length of 2, but a Buffer.byteLength of 4 bytes in UTF-8!'
      },
      commonMistakes: [
        'Using string.length to set the HTTP Content-Length header (must use Buffer.byteLength to account for multi-byte characters).',
        'Using the deprecated "new Buffer()" constructor (deprecated due to security vulnerabilities; use Buffer.alloc or Buffer.from).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Buffers store raw binary data in native C++ memory outside the V8 heap.',
        'Subclass of Uint8Array (bytes 0 to 255).',
        'Always use Buffer.alloc() for security; avoid Buffer.allocUnsafe() in APIs.',
        'Content-Length must be calculated with Buffer.byteLength, NOT string.length.'
      ],
      oneLineDefinition:
        'A Buffer is a fixed-size chunk of raw binary memory allocated outside the V8 heap for efficient handling of binary streams and network packets.',
      interviewTip:
        'Never say "new Buffer()". Always state: "Modern Node.js strictly uses Buffer.alloc() and Buffer.from()."'
    }
  },

  {
    id: 'node-event-emitter',
    number: 18,
    title: 'EventEmitter',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Data Handling and Core Modules',
    categorySlug: 'data-handling-core',
    estimatedMinutes: 5,
    concept30Sec:
      'EventEmitter is the core class in node:events that implements the Observer (Publish-Subscribe) design pattern. All native Node.js objects that emit events (including HTTP servers, TCP sockets, and streams) inherit directly from EventEmitter.',
    internals: {
      overview:
        'EventEmitter maintains an internal lookup object (this._events) mapping event names to arrays of callback functions. When emitter.emit("event", data) is called, EventEmitter iterates over the listener array and invokes all registered functions SYNCHRONOUSLY in the order they were registered. If an "error" event is emitted and no listener exists for "error", Node throws an unhandled exception and crashes the process.',
      flowSteps: [
        'emitter.on(event, cb): Pushes cb to internal this._events[event] array.',
        'emitter.emit(event, ...args): Synchronously loops through listener array and invokes callbacks.',
        'MaxListeners Warning: If more than 10 listeners (default) attach to an event, Node logs a memory leak warning.',
        'Error Event Rule: Emitting "error" without an attached listener triggers an uncaughtException and terminates the process.'
      ],
      diagram: `EVENTEMITTER INTERNAL LOOKUP:
EventEmitter Instance
  this._events = {
    'data':    [ fn1, fn2 ],
    'error':   [ errorHandler ],
    'end':     [ closeHandler ]
  }

emitter.emit('data', chunk) ===> Synchronously invokes fn1(chunk), then fn2(chunk)!`
    },
    codeExample: {
      code: `import { EventEmitter } from 'node:events';

class OrderProcessor extends EventEmitter {
  placeOrder(orderId, amount) {
    console.log(\`[OrderProcessor] Processing order \${orderId}...\`);

    // Synchronously notifies all subscribed listeners
    this.emit('orderPlaced', { orderId, amount, timestamp: Date.now() });

    console.log('[OrderProcessor] Finished placeOrder method.');
  }
}

const processor = new OrderProcessor();

// Listener 1: Update Inventory
processor.on('orderPlaced', (order) => {
  console.log(\`[Inventory Service] Reserved stock for order: \${order.orderId}\`);
});

// Listener 2: Send Email Notification
processor.on('orderPlaced', (order) => {
  console.log(\`[Email Service] Dispatched confirmation for order: \${order.orderId}\`);
});

processor.placeOrder('ord_99', 150);`,
      language: 'javascript',
      output: `[OrderProcessor] Processing order ord_99...
[Inventory Service] Reserved stock for order: ord_99
[Email Service] Dispatched confirmation for order: ord_99
[OrderProcessor] Finished placeOrder method.`,
      whyOutput:
        'emit() executes all registered listeners synchronously on the current call stack before returning. "Finished placeOrder method" prints AFTER all listeners finish executing.',
      annotations: [
        'Line 8: emit() calls listeners synchronously in registration order.',
        'Line 20 & 25: Multiple decoupled services subscribe to the same domain event.',
        'Line 29: PlaceOrder completes only after all listeners finish executing.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Decoupling Monolith Domains & Auditing Webhook Events',
      description:
        'In enterprise Node.js architectures, EventEmitter decouples business domains. When a user registers or a payment completes, the controller emits an event. Billing, fraud detection, analytics, and email services listen independently, keeping the primary controller logic clean and decoupled.',
      codeSnippet: `// Domain Event Bus pattern
import { EventEmitter } from 'node:events';
export const domainEventBus = new EventEmitter();

// Prevent false-positive leak warnings in busy event buses
domainEventBus.setMaxListeners(50);

// Global Error Guard: Prevents unhandled error crashes!
domainEventBus.on('error', (err) => {
  logger.error('[DomainEventBus Error]:', err);
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Are EventEmitter listeners executed synchronously or asynchronously by default?',
          spokenAnswer:
            'Synchronously! By default, when emitter.emit() is called, EventEmitter iterates through the array of registered listeners and executes them one after another on the active call stack. If you need a listener to execute asynchronously, you must explicitly wrap its logic inside setImmediate() or process.nextTick().'
        },
        {
          question: 'What happens when an EventEmitter emits an "error" event without any listeners attached?',
          spokenAnswer:
            'If an "error" event is emitted and no listener has been registered for "error", Node.js treats it as an unhandled exception. It will print the stack trace, trigger process.on("uncaughtException"), and terminate the entire Node.js process with an exit code of 1.'
        }
      ],
      trickyFollowUp: {
        question: 'Why does Node.js log a "MaxListenersExceededWarning" when more than 10 listeners attach to an EventEmitter?',
        answer:
          'Because attaching too many listeners is the #1 symptom of memory leaks in Node.js (e.g. repeatedly adding req.on("data") or socket.on("close") listeners without removing them). The warning is a safety check, not a hard limit; it can be adjusted via emitter.setMaxListeners(n).'
      },
      commonMistakes: [
        'Assuming emitter.emit() executes asynchronously in the background (it is completely synchronous).',
        'Failing to attach an .on("error") listener to EventEmitters or streams, causing unexpected process crashes.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Implements the Publish-Subscribe pattern in core Node.js.',
        'Listeners execute SYNCHRONOUSLY in the order they were registered.',
        'Emitting "error" without a listener CRASHES the process.',
        'Default limit is 10 listeners per event to detect memory leaks.'
      ],
      oneLineDefinition:
        'EventEmitter is the core Node.js class that provides synchronous publish-subscribe event dispatching and powers all stream and socket abstractions.',
      interviewTip:
        'Highlight the two critical traps: 1) Listeners run SYNCHRONOUSLY; 2) Emitting "error" without a listener crashes the process.'
    }
  },

  {
    id: 'node-fs-module',
    number: 19,
    title: 'File System (fs) Module',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Data Handling and Core Modules',
    categorySlug: 'data-handling-core',
    estimatedMinutes: 5,
    concept30Sec:
      'The node:fs module provides comprehensive APIs for interacting with the file system. It offers three distinct programming paradigms: 1) Synchronous APIs (blocking); 2) Error-First Callbacks (asynchronous via libuv); 3) Promise-based APIs (node:fs/promises).',
    internals: {
      overview:
        'Because operating systems (especially Linux) do not provide truly non-blocking asynchronous APIs for standard disk files, libuv implements all asynchronous file operations using its background Thread Pool (uv_fs_* functions). Low-level file APIs work with integer File Descriptors (FDs)—pointers maintained by the OS kernel table representing an open file stream.',
      flowSteps: [
        'Call fs.promises.open(path, "r") -> libuv submits uv_fs_open to thread pool.',
        'Worker thread executes open(2) syscall -> returns numeric File Descriptor (e.g. FD 12).',
        'Reads/writes execute via uv_fs_read / uv_fs_write on worker threads.',
        'Always close File Descriptors via fd.close() to prevent EMFILE (Too many open files) OS errors.'
      ],
      diagram: `FILE SYSTEM EXECUTION IN LIBUV:
JS Main Thread (fs.promises.readFile)
         |
         v (Submits uv_fs_read request)
+------------------------------------+
| libuv Worker Thread Pool           | ===(Synchronous OS Syscall)===> Disk Drive
| (Worker thread reads file blocks)  |
+------------------------------------+
         |
         v (Signals I/O complete)
JS Main Thread resolves Promise with Buffer/String`
    },
    codeExample: {
      code: `import fs from 'node:fs/promises';
import path from 'node:path';

// Modern clean file operations using fs/promises & FileHandle
async function manageFileLifecycle() {
  const tempPath = path.resolve('./temp-log.txt');

  // 1. Write file
  await fs.writeFile(tempPath, 'Hello from Node.js Internals!', 'utf-8');
  console.log('1. File written successfully.');

  // 2. Open FileHandle for low-level descriptor control
  const fileHandle = await fs.open(tempPath, 'r');
  const stats = await fileHandle.stat();
  console.log(\`2. File size: \${stats.size} bytes | FD: \${fileHandle.fd}\`);

  // ALWAYS close file handles to prevent EMFILE leaks!
  await fileHandle.close();

  // 3. Clean up
  await fs.unlink(tempPath);
  console.log('3. Temp file deleted.');
}

manageFileLifecycle();`,
      language: 'javascript',
      output: `1. File written successfully.
2. File size: 30 bytes | FD: 22
3. Temp file deleted.`,
      whyOutput:
        'fs/promises provides asynchronous file operations backed by libuv worker threads. Using fileHandle provides direct access to the OS file descriptor, which must always be closed to prevent resource exhaustion.',
      annotations: [
        'Line 8: fs.writeFile writes entire content asynchronously.',
        'Line 13: fs.open returns a FileHandle backed by an OS file descriptor.',
        'Line 17: fileHandle.close() guarantees OS resources are released.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Preventing Directory Traversal Attacks & Handling EMFILE Under Load',
      description:
        'In production APIs serving user-requested files, concatenating paths without validation creates Directory Traversal vulnerabilities (e.g. GET /file?name=../../etc/passwd). Engineers use path.resolve() combined with path.relative() to verify paths remain constrained within the intended root directory.',
      codeSnippet: `// Safe File Serving with Path Traversal Protection:
import path from 'node:path';
import fs from 'node:fs/promises';

async function safeReadFile(publicRoot, userSuppliedPath) {
  const safePath = path.resolve(publicRoot, userSuppliedPath);

  // Security check: Verify resolved path starts with the allowed root directory!
  if (!safePath.startsWith(path.resolve(publicRoot))) {
    throw new Error('Access Denied: Path traversal detected');
  }

  return await fs.readFile(safePath);
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the "EMFILE: too many open files" error in Node.js?',
          spokenAnswer:
            'EMFILE is an operating system error that occurs when the Node.js process attempts to open more file descriptors (files, sockets, or pipes) than allowed by the OS system limit (ulimit -n). It is typically caused by forgetting to close FileHandles/streams or under high traffic spikes. It is resolved by increasing OS ulimits, using graceful-fs, or pooling file handles.'
        },
        {
          question: 'Do asynchronous file operations in Node.js use non-blocking OS kernel calls like network sockets?',
          spokenAnswer:
            'No. Operating systems (like Linux) lack universal asynchronous non-blocking file system APIs for disk files. Node.js implements asynchronous file I/O by delegating synchronous file system calls to libuv\'s background worker thread pool.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the difference between fs.stat() and fs.lstat()?',
        answer:
          'fs.stat() follows symbolic links (symlinks) and returns stats for the target file that the symlink points to. fs.lstat() inspects the symbolic link itself without following it.'
      },
      commonMistakes: [
        'Opening file handles without a try/finally block to guarantee fd.close(), causing file descriptor leaks.',
        'Trusting raw user input in file paths without path traversal validation.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Always prefer node:fs/promises for modern asynchronous code.',
        'File I/O runs on the libuv Thread Pool, not via OS epoll.',
        'Always close FileHandles to prevent "EMFILE: too many open files" errors.',
        'Protect against Directory Traversal attacks using path.resolve validation.'
      ],
      oneLineDefinition:
        'The node:fs module provides synchronous, callback, and promise-based APIs for file operations, powered by libuv\'s background worker thread pool.',
      interviewTip:
        'State clearly: "Async file I/O uses the libuv thread pool; network I/O uses OS epoll/kqueue."'
    }
  },

  {
    id: 'node-process-env-variables',
    number: 20,
    title: 'Process and Environment Variables',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Data Handling and Core Modules',
    categorySlug: 'data-handling-core',
    estimatedMinutes: 5,
    concept30Sec:
      'The global "process" object provides control and inspection over the running Node.js instance. It exposes environment variables (process.env), process metadata (PID, memory, uptime), process lifecycle hooks (exit, uncaughtException), and OS signal listeners (SIGINT, SIGTERM) essential for graceful shutdowns.',
    internals: {
      overview:
        'The process object is an EventEmitter instantiated at startup in C++ code. Reading process.env triggers a C++ getter that reads the OS process environment block; all values in process.env are coerced to strings. Signal handlers (process.on("SIGTERM")) allow a containerized service to intercept termination signals from Docker/Kubernetes and gracefully close database connections before exiting.',
      flowSteps: [
        'process.env stores environment variables (values are ALWAYS strings or undefined).',
        'process.memoryUsage() returns heapUsed, heapTotal, rss (Resident Set Size), and external RAM.',
        'SIGTERM / SIGINT: Intercepted by process signal listeners for graceful shutdown.',
        'process.exit(code): 0 for clean exit, non-zero (e.g. 1) for fatal errors.'
      ],
      diagram: `CONTAINERIZED GRACEFUL SHUTDOWN FLOW:
[ Kubernetes sends SIGTERM ]
             |
             v
[ process.on('SIGTERM') ]
             |
             +---> 1. Stop accepting new HTTP connections (server.close())
             +---> 2. Wait for in-flight requests to complete
             +---> 3. Drain and close database connection pools
             +---> 4. process.exit(0) (Clean termination!)`
    },
    codeExample: {
      code: `import http from 'node:http';

const server = http.createServer((req, res) => {
  res.end('System operational');
});

server.listen(3000, () => {
  console.log(\`Server PID \${process.pid} listening on port 3000\`);
});

// Production Graceful Shutdown Pattern (SIGTERM / SIGINT):
function gracefulShutdown(signal) {
  console.log(\`\\nReceived \${signal}. Initiating graceful shutdown...\`);

  // 1. Stop accepting new client connections
  server.close(() => {
    console.log('HTTP server closed.');

    // 2. Close DB pools, disconnect Redis, flush logs
    console.log('Database connections closed.');

    // 3. Clean exit with code 0
    process.exit(0);
  });

  // Force shutdown if cleanup takes longer than 10 seconds
  setTimeout(() => {
    console.error('Graceful shutdown timed out. Forcefully terminating.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));`,
      language: 'javascript',
      output: `Server PID 51200 listening on port 3000
Received SIGINT. Initiating graceful shutdown...
HTTP server closed.
Database connections closed.`,
      whyOutput:
        'When Ctrl+C (SIGINT) or a container stop (SIGTERM) arrives, the process intercepts the signal. It stops accepting new traffic, finishes in-flight requests, closes database pools, and exits cleanly with code 0.',
      annotations: [
        'Line 13: Intercepts container termination signals.',
        'Line 17: server.close() finishes pending requests before terminating.',
        'Line 26: unref() timer prevents the safety timeout from keeping the process alive.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Kubernetes Zero-Downtime Rolling Deployments',
      description:
        'In Kubernetes, when deploying a new version, K8s sends a SIGTERM to existing pods. If a Node service does not implement a graceful shutdown listener, the process is terminated abruptly, severing active database transactions and returning 502 Bad Gateway errors to end users.',
      codeSnippet: `// Validating environment variables at startup (Fail-Fast pattern)
function validateEnv() {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'PORT'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(\`FATAL: Missing environment variables: \${missing.join(', ')}\`);
    process.exit(1); // Fail immediately at startup!
  }
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What happens if you assign a boolean or number to process.env (e.g. process.env.DEBUG = false)?',
          spokenAnswer:
            'All values in process.env are automatically coerced into strings! Setting process.env.DEBUG = false stores the string "false". Checking "if (process.env.DEBUG)" evaluates to true because non-empty strings are truthy in JavaScript! You must explicitly check "if (process.env.DEBUG === \'true\')".'
        },
        {
          question: 'What is the purpose of listening to SIGTERM and SIGINT in production Node.js?',
          spokenAnswer:
            'To implement a Graceful Shutdown. When Kubernetes or Docker shuts down a container, it sends a SIGTERM signal. Listening to SIGTERM allows the app to stop accepting new requests, complete active in-flight requests, drain database connections, and exit cleanly without dropping client connections.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the difference between process.cwd() and __dirname?',
        answer:
          'process.cwd() returns the current working directory from which the Node process was launched in the terminal. __dirname returns the directory path of the source code file currently being executed.'
      },
      commonMistakes: [
        'Testing boolean flags with if (process.env.FLAG) when process.env.FLAG is "false" (which is truthy!).',
        'Not setting a timeout in graceful shutdown (if a DB query hangs, the process never exits).'
      ]
    },
    quickRevision: {
      takeaways: [
        'process.env values are ALWAYS strings (process.env.FLAG = false becomes "false").',
        'Intercept SIGTERM / SIGINT for zero-downtime graceful shutdowns.',
        'process.cwd() = terminal launch directory; __dirname = source file directory.',
        'Exit code 0 = success; non-zero (1) = fatal error.'
      ],
      oneLineDefinition:
        'The process object provides programmatic control over the Node.js runtime, environment variables, memory diagnostics, and OS signal management.',
      interviewTip:
        'Highlight the process.env string coercion trap: `process.env.IS_PROD = false` is TRUTHY because `"false"` is a non-empty string!'
    }
  }
];
