import { QuickReferenceTopic } from './types';

export const nodejsCategory1FundamentalsArch: QuickReferenceTopic[] = [
  {
    id: 'node-what-is-nodejs',
    number: 1,
    title: 'What is Node.js?',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Node.js Fundamentals and Architecture',
    categorySlug: 'nodejs-fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'Node.js is an open-source, cross-platform JavaScript runtime environment built on Chrome\'s V8 engine and libuv. It executes JavaScript outside the browser using an event-driven, non-blocking I/O model designed to build scalable, high-throughput network applications with lightweight memory overhead.',
    internals: {
      overview:
        'Node.js is NOT a programming language, framework, or traditional multi-threaded server. It is a C++ wrapper combining Google\'s V8 engine (which compiles JS into native machine code) with libuv (which manages the event loop, thread pool, and operating system asynchronous I/O). The JavaScript thread runs on a single thread, but Node.js offloads I/O operations directly to the OS kernel (via epoll/kqueue) or to libuv worker threads, achieving high concurrency without thread contention.',
      flowSteps: [
        'JavaScript execution runs on a single main thread via the V8 engine.',
        'Asynchronous I/O calls (network, disk) are handed off to the Node.js C++ bindings.',
        'Network operations are registered directly with OS kernel polling mechanisms (epoll on Linux, kqueue on macOS, IOCP on Windows).',
        'File system, DNS lookup, and crypto tasks are dispatched to libuv\'s background thread pool.',
        'When operations complete, callbacks are queued into the Event Loop and pushed back onto the V8 Call Stack.'
      ],
      diagram: `+-----------------------------------------------------------+
|                     NODE.JS RUNTIME                       |
|                                                           |
|  +---------------------------+  +----------------------+  |
|  |     V8 JS ENGINE          |  |       LIBUV          |  |
|  | - JIT Compilation         |  | - Event Loop         |  |
|  | - Call Stack & Heap       |  | - Thread Pool (4-128)|  |
|  | - Garbage Collection      |  | - OS Non-blocking I/O|  |
|  +---------------------------+  +----------------------+  |
|               |                             |             |
|               +------------+  +-------------+             |
|                            v  v                           |
|                  Node.js C++ Core & Bindings              |
+-----------------------------------------------------------+`
    },
    codeExample: {
      code: `import http from 'node:http';

// Node.js processes incoming HTTP connections asynchronously on one thread
const server = http.createServer((req, res) => {
  // Simulating lightweight non-blocking response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'online',
    pid: process.pid,
    uptime: process.uptime(),
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  }));
});

server.listen(3000, () => {
  console.log(\`Node.js runtime server running on PID: \${process.pid}\`);
});`,
      language: 'javascript',
      output: `Node.js runtime server running on PID: 48122
{"status":"online","pid":48122,"uptime":0.12,"memoryUsageMB":14}`,
      whyOutput:
        'The HTTP server binds non-blocking TCP socket listeners using libuv. Thousands of client requests can arrive simultaneously; the single main thread dispatches requests and streams responses without spawning a new OS thread per connection.',
      annotations: [
        'Line 4: createServer registers a socket listener with libuv.',
        'Line 9: process.pid confirms the single master process handle.',
        'Line 10: Low memory footprint: ~14MB baseline heap for serving thousands of connections.'
      ]
    },
    nodeJsApplication: {
      scenario: 'High-Concurrency Microservices vs CPU-Heavy Transcoding',
      description:
        'Node.js is the gold standard for I/O-intensive workloads (API gateways, real-time chat, WebSocket servers, streaming proxies, and CRUD microservices) where thousands of clients await DB or network responses. However, for CPU-intensive tasks (video transcoding, ML training, image rendering), Node.js requires worker threads or external worker queues to avoid blocking the main event loop.',
      codeSnippet: `// API Gateway streaming pattern: Zero buffering in RAM!
import { pipeline } from 'node:stream/promises';
import http from 'node:http';

async function proxyRequest(clientReq, clientRes) {
  const backendReq = http.request('http://internal-service:8080', (backendRes) => {
    clientRes.writeHead(backendRes.statusCode, backendRes.headers);
    pipeline(backendRes, clientRes); // Pipes raw TCP bytes with backpressure
  });
  pipeline(clientReq, backendReq);
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is Node.js and why was it created?',
          spokenAnswer:
            'Node.js is an open-source, cross-platform JavaScript runtime built on Chrome\'s V8 engine and libuv. It was created by Ryan Dahl in 2009 to solve the "C10K problem"—handling 10,000+ concurrent connections efficiently. Traditional servers allocated a dedicated thread per connection (consuming 1-2MB of stack per thread and causing massive context switching), whereas Node.js handles thousands of connections on a single thread using non-blocking, event-driven I/O.'
        },
        {
          question: 'Is Node.js completely single-threaded?',
          spokenAnswer:
            'No. JavaScript execution runs on a single main thread, but Node.js as an entire runtime is multi-threaded. Node offloads I/O tasks to libuv, which maintains a background worker thread pool (default 4 threads, configurable up to 1024) for file system, DNS, and cryptographic tasks, while network sockets use operating system non-blocking kernel mechanisms (epoll/kqueue).'
        }
      ],
      trickyFollowUp: {
        question: 'Why does Node.js struggle with CPU-bound tasks if it has a libuv thread pool?',
        answer:
          'Because the libuv thread pool is reserved exclusively for internal C++ I/O tasks (file I/O, DNS, crypto, compression). Custom user JavaScript code ALWAYS runs on the single main V8 thread. If a user runs a heavy synchronous loop or CPU calculation in JavaScript, the thread pool does NOT help; the main thread freezes, starving the entire event loop.'
      },
      commonMistakes: [
        'Calling Node.js a framework or language (it is a C++ runtime environment).',
        'Believing Node.js executes all operations on a single thread without any background threads.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Node.js = V8 Engine + libuv + Node Core C++ Bindings.',
        'Single JS thread + Non-blocking OS kernel I/O + libuv background thread pool.',
        'Best for I/O-heavy, real-time, streaming applications; poor for raw CPU compute without workers.',
        'Solves the thread-per-request memory scaling bottleneck.'
      ],
      oneLineDefinition:
        'Node.js is a V8-powered, event-driven JavaScript runtime designed for scalable non-blocking network applications.',
      interviewTip:
        'Immediately distinguish between "Single-threaded JavaScript execution" and "Multi-threaded C++ runtime architecture".'
    }
  },

  {
    id: 'node-architecture',
    number: 2,
    title: 'Node.js Architecture',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Node.js Fundamentals and Architecture',
    categorySlug: 'nodejs-fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'Node.js architecture is a layered system: JavaScript application code interacts with the Node.js Standard Library (fs, http, crypto), which calls internal C++ bindings. These bindings interface with Google\'s V8 engine (for JS parsing and execution) and libuv (for the event loop, thread pool, and OS non-blocking I/O).',
    internals: {
      overview:
        'The Node.js platform has two primary engine components: 1) V8 Engine compiles JS into machine instructions, manages the call stack, and handles memory allocation/garbage collection. 2) libuv handles all platform abstraction. Network operations bypass threads entirely by registering file descriptors with kernel mechanisms (Linux epoll, macOS kqueue, Windows IOCP). Blocking file operations and crypto calculations are dispatched to the libuv Thread Pool.',
      flowSteps: [
        'Layer 1: JavaScript Application & npm modules.',
        'Layer 2: Node.js Core API (JavaScript wrappers like node:fs, node:http).',
        'Layer 3: C++ Bindings (Node.js internal C++ bridge using V8 API).',
        'Layer 4: V8 Engine (JS compilation & memory) + libuv (Event loop & async I/O).',
        'Layer 5: OS Kernel (epoll/kqueue for sockets; OS threads for libuv pool).'
      ],
      diagram: `+-----------------------------------------------------------+
|                   NODE.JS ARCHITECTURE                    |
|                                                           |
|  [ User JavaScript Code ] -> [ Node.js Core JS Library ]  |
|                                   |                       |
|                                   v                       |
|                      [ Node.js C++ Bindings ]             |
|                        /                   \\              |
|                       v                     v             |
|             +------------------+   +------------------+   |
|             |    V8 ENGINE     |   |      LIBUV       |   |
|             | - AST & Bytecode |   | - Event Loop     |   |
|             | - Call Stack     |   | - Thread Pool    |   |
|             | - V8 Heap & GC   |   | - epoll / kqueue |   |
|             +------------------+   +------------------+   |
|                                             |             |
|                                             v             |
|                                   [ OS Kernel & Hardware ]|
+-----------------------------------------------------------+`
    },
    codeExample: {
      code: `import crypto from 'node:crypto';

// Demonstrating libuv Thread Pool vs Main Thread Execution:
// pbkdf2 is a CPU-intensive cryptographic hash handled by libuv's C++ thread pool
const start = Date.now();

for (let i = 1; i <= 4; i++) {
  crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', (err, key) => {
    console.log(\`Hash #\${i} completed in: \${Date.now() - start}ms\`);
  });
}

console.log('Synchronous script execution finished immediately!');`,
      language: 'javascript',
      output: `Synchronous script execution finished immediately!
Hash #1 completed in: 82ms
Hash #2 completed in: 85ms
Hash #3 completed in: 87ms
Hash #4 completed in: 89ms`,
      whyOutput:
        'All 4 pbkdf2 operations execute in parallel because libuv\'s default thread pool has 4 worker threads. The synchronous log statement prints first. All 4 hashes finish around the same time (~85ms) because each runs on a separate worker thread simultaneously.',
      annotations: [
        'Line 12: Main JavaScript thread finishes synchronously without waiting for crypto.',
        'Line 7: crypto.pbkdf2 delegates the heavy math to libuv worker threads.',
        'Output: All 4 finish at ~85ms because default UV_THREADPOOL_SIZE is 4.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Tuning UV_THREADPOOL_SIZE for High-Load File & Crypto Services',
      description:
        'Because libuv defaults to 4 worker threads, if an application processes 8 concurrent image resizes, password hashes, or disk writes, threads 5–8 are queued and delayed. In production backends with high disk I/O or crypto, engineers tune UV_THREADPOOL_SIZE up to 64 or 128 at process startup.',
      codeSnippet: `// Must be set BEFORE loading any modules or initiating I/O!
process.env.UV_THREADPOOL_SIZE = '16';

import fs from 'node:fs';
import crypto from 'node:crypto';

// Now up to 16 file or crypto operations can execute concurrently in background threads!`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Which operations run on the main thread, which use the thread pool, and which use OS kernel async I/O?',
          spokenAnswer:
            '1) Main thread: All JavaScript execution, event loop dispatching, and JSON parsing. 2) OS Kernel async I/O (epoll/kqueue): All network I/O (HTTP requests, TCP/UDP sockets, incoming connections). 3) libuv Thread Pool: File system I/O (fs.*), DNS lookups (dns.lookup), cryptographic functions (crypto.pbkdf2, crypto.randomBytes), and compression (zlib).'
        },
        {
          question: 'Why doesn\'t network I/O use the libuv thread pool?',
          spokenAnswer:
            'Because modern operating systems provide native non-blocking network socket APIs (epoll on Linux, kqueue on macOS, IOCP on Windows). libuv simply registers the socket file descriptor with the kernel and subscribes to readiness notifications, requiring zero worker threads to manage thousands of open sockets.'
        }
      ],
      trickyFollowUp: {
        question: 'Does increasing UV_THREADPOOL_SIZE improve network throughput?',
        answer:
          'No! Network sockets do not use the thread pool. Increasing UV_THREADPOOL_SIZE only benefits file system I/O, DNS lookups, compression, and crypto operations.'
      },
      commonMistakes: [
        'Assuming network requests use the libuv thread pool (they use OS kernel event demultiplexing).',
        'Setting process.env.UV_THREADPOOL_SIZE after importing modules (it must be set before any native module loads).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Architecture: JS Code -> Node Core -> C++ Bindings -> V8 & libuv -> OS Kernel.',
        'Network I/O: Handled by OS Kernel (epoll/kqueue) with 0 thread pool usage.',
        'File I/O & Crypto: Handled by libuv Thread Pool (default 4 threads).',
        'Main thread only executes JavaScript and dispatches callbacks.'
      ],
      oneLineDefinition:
        'Node.js combines V8 for JavaScript execution with libuv for OS non-blocking network polling and background thread pool I/O.',
      interviewTip:
        'Highlight the critical distinction: Network I/O = Kernel epoll/kqueue; File/Crypto I/O = libuv Thread Pool.'
    }
  },

  {
    id: 'node-v8-engine',
    number: 3,
    title: 'V8 JavaScript Engine',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Node.js Fundamentals and Architecture',
    categorySlug: 'nodejs-fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'V8 is Google\'s open-source, high-performance C++ WebAssembly and JavaScript engine. In Node.js, V8 parses JavaScript source code, compiles it into bytecode via Ignition, optimizes hot code into native machine code via TurboFan, manages call stack frames, and handles dynamic heap memory allocation and garbage collection.',
    internals: {
      overview:
        'V8 executes code using a Just-In-Time (JIT) compiler pipeline: 1) Parser generates an Abstract Syntax Tree (AST); 2) Ignition (interpreter) produces bytecode from the AST; 3) Profiler monitors "hot functions" executed frequently; 4) TurboFan compiles hot functions directly into optimized native machine code. If type assumptions change at runtime, V8 "de-optimizes" back to interpreted bytecode.',
      flowSteps: [
        'Parser: Scans source code and builds Abstract Syntax Tree (AST) + Scope tree.',
        'Ignition Interpreter: Converts AST into compact V8 bytecode and executes immediately.',
        'Feedback Vector & Profiler: Collects type feedback and execution frequency during execution.',
        'TurboFan Compiler: Optimizes hot code using Inline Caching (IC) and Hidden Classes (Shapes).',
        'De-optimization: If parameter types change dynamically, TurboFan bails out back to bytecode.'
      ],
      diagram: `V8 JIT COMPILATION PIPELINE:
[ JS Source Code ]
       |
       v
   [ Parser ] =====> [ Abstract Syntax Tree (AST) ]
                            |
                            v
            [ Ignition Bytecode Interpreter ] <----------+
                     |                     |             |
                     | (Collects Type      |             | (De-opt Bailout)
                     |  Feedback)          v             |
                     +-------------> [ TurboFan JIT ] ---+
                                           |
                                           v
                             [ Optimized Machine Code ]`
    },
    codeExample: {
      code: `// Demonstrating Monomorphic vs Polymorphic Hidden Classes in V8
// Tip: Consistent object shapes allow V8 to use fast Inline Caches (IC)

function calculateDistance(point) {
  return point.x + point.y;
}

// 1. Monomorphic: Always identical Shape / HiddenClass
const p1 = { x: 10, y: 20 };
const p2 = { x: 5, y: 15 };
calculateDistance(p1);
calculateDistance(p2); // TurboFan optimizes point.x offset lookup into single machine instruction!

// 2. Shape De-optimization Trap: Changing property order or deleting keys
const p3 = { y: 20, x: 10 }; // Different HiddenClass!
delete p1.x; // Breaks HiddenClass transition, forcing dictionary mode!

console.log('V8 Memory Stats:');
console.log(process.memoryUsage());`,
      language: 'javascript',
      output: `V8 Memory Stats:
{
  rss: 38240256,
  heapTotal: 5742592,
  heapUsed: 4210128,
  external: 1421042,
  arrayBuffers: 17520
}`,
      whyOutput:
        'V8 optimizes property access through Hidden Classes (Shapes). Objects initialized with identical property order share a shape. Deleting properties or altering property order forces V8 into slow hash-table dictionary mode, triggering TurboFan de-optimization.',
      annotations: [
        'Line 9: Consistent property layout preserves Monomorphic inline caching.',
        'Line 16: Deleting properties with "delete obj.key" destroys V8 HiddenClass optimization.',
        'Line 20: process.memoryUsage() queries V8\'s internal heap and RSS limits.'
      ]
    },
    nodeJsApplication: {
      scenario: 'High-Throughput JSON Serializers & Preventing V8 De-optimizations',
      description:
        'In performance-critical Node.js services (like fast-json-stringify or Fastify), developers design data models with static schema shapes. Initializing all object properties in constructors in the exact same order prevents V8 de-optimizations, yielding 2x to 5x higher throughput in serialization pipelines.',
      codeSnippet: `// FAST: Fixed hidden class shape
class UserDTO {
  constructor(id, email, role) {
    this.id = id;
    this.email = email;
    this.role = role || null; // Explicitly initialized to null instead of omitting!
  }
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the role of the V8 engine in Node.js?',
          spokenAnswer:
            'V8 is responsible for executing JavaScript code. It parses source code into an AST, interprets bytecode via Ignition, compiles hot execution paths into native machine code via TurboFan, manages the Call Stack and V8 Heap, and executes Garbage Collection (Scavenger and Mark-Sweep-Compact).'
        },
        {
          question: 'What are Hidden Classes and Inline Caching in V8?',
          spokenAnswer:
            'Because JavaScript is dynamically typed, reading properties (obj.x) normally requires an expensive hash-table lookup. V8 generates internal "Hidden Classes" (Shapes) that track fixed property memory offsets. Inline Caching (IC) remembers these offsets at the call site so subsequent reads compile into direct memory dereferences.'
        }
      ],
      trickyFollowUp: {
        question: 'Why is using the "delete" operator considered a performance anti-pattern in high-frequency V8 code?',
        answer:
          'Because "delete obj.prop" alters the object\'s HiddenClass structure, causing V8 to drop optimized inline caching and downgrade the object to slow dictionary/hash-table mode. Instead of delete, set obj.prop = undefined.'
      },
      commonMistakes: [
        'Assuming V8 handles asynchronous I/O and timers (libuv handles I/O and timers; V8 only compiles and executes JS).',
        'Initializing object properties conditionally in different orders, breaking V8 hidden class sharing.'
      ]
    },
    quickRevision: {
      takeaways: [
        'V8 = Ignition (Interpreter) + TurboFan (Optimizing Compiler) + Garbage Collector.',
        'Compiles JS directly to native machine code using JIT.',
        'Uses Hidden Classes (Shapes) and Inline Caching for fast property lookups.',
        'Avoid `delete obj.prop`; use `obj.prop = undefined` to prevent de-optimizations.'
      ],
      oneLineDefinition:
        'V8 is Google\'s open-source C++ engine that compiles JavaScript into machine code using the Ignition interpreter and TurboFan JIT compiler.',
      interviewTip:
        'State clearly: "V8 executes JavaScript and manages heap memory; libuv handles the event loop and asynchronous I/O."'
    }
  },

  {
    id: 'node-libuv',
    number: 4,
    title: 'libuv',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Node.js Fundamentals and Architecture',
    categorySlug: 'nodejs-fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'libuv is a cross-platform, high-performance C library written specifically for Node.js. It abstracts asynchronous I/O across different operating systems. It provides the Event Loop, non-blocking network socket polling (epoll/kqueue), high-resolution timers, child process management, and a background Thread Pool for blocking tasks.',
    internals: {
      overview:
        'libuv acts as Node\'s operating system abstraction layer. Because every OS handles asynchronous I/O differently (Linux uses epoll, macOS uses kqueue, Windows uses IOCP), libuv unifies them behind a standardized C API. For operations that cannot be handled via non-blocking OS APIs (e.g. disk file access and synchronous crypto), libuv maintains a configurable worker thread pool.',
      flowSteps: [
        'Cross-platform abstraction: Wraps epoll (Linux), kqueue (macOS/BSD), and IOCP (Windows).',
        'Maintains the 6-phase Event Loop cycle.',
        'Maintains the Worker Thread Pool (UV_THREADPOOL_SIZE, default 4, max 1024).',
        'Provides High-Resolution Timers (uv_timer_t) and Child Process IPC handles.'
      ],
      diagram: `+-----------------------------------------------------------+
|                          LIBUV                            |
|                                                           |
|  +-----------------------------------------------------+  |
|  |                 THE EVENT LOOP                      |  |
|  |  Timers -> Pending -> Idle/Poll -> Check -> Close   |  |
|  +-----------------------------------------------------+  |
|             |                                   |         |
|             v                                   v         |
|  +-----------------------+             +---------------+  |
|  |   OS NON-BLOCKING     |             |  THREAD POOL  |  |
|  | - Linux: epoll        |             | (Default: 4)  |  |
|  | - macOS: kqueue       |             | - File System |  |
|  | - Windows: IOCP       |             | - DNS Lookup  |  |
|  | (Network Sockets)     |             | - Crypto/Zlib |  |
|  +-----------------------+             +---------------+  |
+-----------------------------------------------------------+`
    },
    codeExample: {
      code: `import dns from 'node:dns';

// dns.lookup uses the libuv THREAD POOL (calls getaddrinfo(3) synchronously under the hood)
console.time('dns.lookup (Thread Pool)');
dns.lookup('google.com', () => {
  console.timeEnd('dns.lookup (Thread Pool)');
});

// dns.resolve4 uses the OS NETWORK STACK directly via c-ares (NO thread pool!)
console.time('dns.resolve4 (c-ares / Network)');
dns.resolve4('google.com', () => {
  console.timeEnd('dns.resolve4 (c-ares / Network)');
});`,
      language: 'javascript',
      output: `dns.resolve4 (c-ares / Network): 14.212ms
dns.lookup (Thread Pool): 22.845ms`,
      whyOutput:
        'dns.lookup delegates to the OS getaddrinfo(3) system call via libuv\'s thread pool, blocking a thread until the OS responds. In contrast, dns.resolve4 uses c-ares, which performs asynchronous DNS network queries directly without touching the thread pool.',
      annotations: [
        'Line 5: dns.lookup uses libuv thread pool (synchronous OS getaddrinfo).',
        'Line 11: dns.resolve4 bypasses thread pool, querying the network directly via c-ares.',
        'In high-throughput services, calling dns.lookup repeatedly can starve the libuv thread pool!'
      ]
    },
    nodeJsApplication: {
      scenario: 'Preventing Thread Pool Starvation in High-Throughput Node.js Microservices',
      description:
        'If a service performs concurrent file reads, bcrypt hashes, and calls dns.lookup on every outgoing HTTP request, libuv\'s 4 default threads become instantly saturated. Outgoing database connections and disk writes queue up, causing latency spikes. Senior engineers use dns.resolve4, offload bcrypt to microservices, or scale UV_THREADPOOL_SIZE.',
      codeSnippet: `// Production HTTP Agent configuration to prevent DNS thread pool exhaustion
import http from 'node:http';

const keepAliveAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100, // Reuses established TCP connections, eliminating repetitive DNS lookups!
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is libuv and what are its two core I/O mechanisms?',
          spokenAnswer:
            'libuv is the multi-platform C library that powers Node.js\'s asynchronous I/O. Its two core mechanisms are: 1) System-level non-blocking event demultiplexing (epoll on Linux, kqueue on macOS, IOCP on Windows) for network sockets; and 2) A background Worker Thread Pool (default 4 threads) for blocking tasks like file I/O, DNS lookups, and crypto calculations.'
        },
        {
          question: 'Why does Node.js need a thread pool if it has non-blocking OS I/O?',
          spokenAnswer:
            'Because operating systems do not provide uniform non-blocking asynchronous APIs for all operations. Major OS kernels (especially Linux) lack a truly asynchronous file system API. Therefore, file system operations must be executed synchronously on background worker threads to prevent blocking the main JavaScript thread.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the difference between dns.lookup and dns.resolve in Node.js?',
        answer:
          'dns.lookup uses the synchronous OS system call getaddrinfo() executed on a libuv background thread, utilizing /etc/hosts and OS caching. dns.resolve connects directly to DNS servers over the network using c-ares asynchronously, completely bypassing the thread pool.'
      },
      commonMistakes: [
        'Thinking libuv is written in JavaScript (it is a standalone C library).',
        'Believing Linux has a native non-blocking file system API like epoll for files (epoll only works on sockets/pipes, not regular disk files).'
      ]
    },
    quickRevision: {
      takeaways: [
        'libuv = Event Loop + OS Kernel Demultiplexing + Thread Pool.',
        'Unifies epoll (Linux), kqueue (macOS), IOCP (Windows).',
        'Thread pool handles: File I/O, dns.lookup, crypto, zlib.',
        'Network I/O does NOT use the thread pool.'
      ],
      oneLineDefinition:
        'libuv is the cross-platform C library that provides Node.js with its event loop, OS non-blocking I/O abstractions, and background worker thread pool.',
      interviewTip:
        'Mention "OS kernel async I/O (epoll/kqueue) for network sockets" vs "Worker Thread Pool for disk files and crypto".'
    }
  },

  {
    id: 'node-single-threaded-event-loop',
    number: 5,
    title: 'Single-threaded Event Loop',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Node.js Fundamentals and Architecture',
    categorySlug: 'nodejs-fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'The single-threaded event loop is Node.js\'s concurrency model. Rather than spawning a separate OS thread for every incoming client connection, Node.js runs all JavaScript on a single thread and delegates all I/O operations to the operating system kernel or background threads. When I/O completes, the event loop schedules the corresponding callback.',
    internals: {
      overview:
        'Node.js implements the Reactor Pattern. An event demultiplexer (libuv) monitors registered socket file descriptors. When a client sends data or connects, the OS triggers a notification without blocking the application. The event loop pulls completed events from the queue and invokes their JS callbacks on the single V8 thread sequentially.',
      flowSteps: [
        'Client initiates connection -> Node.js creates a non-blocking TCP socket handle.',
        'Socket handle registered with OS kernel event demultiplexer (epoll/kqueue).',
        'Main thread continues executing other code immediately without waiting.',
        'Data arrives on socket -> OS notifies libuv event demultiplexer.',
        'libuv pushes callback to Event Loop Poll phase -> V8 Call Stack executes callback.'
      ],
      diagram: `REACTOR PATTERN IN NODE.JS:
[ Client Request ] ===> [ Single Main JS Thread ]
                               |
                               | (Non-blocking Registration)
                               v
               [ OS Event Demultiplexer (epoll) ]
                               |
                               | (Data Ready Notification)
                               v
                      [ Event Queue ]
                               |
                               v
           [ Event Loop dispatches callback to V8 ]`
    },
    codeExample: {
      code: `import http from 'node:http';

// Demonstrating how one thread handles concurrent requests without blocking
let activeConnections = 0;

const server = http.createServer((req, res) => {
  activeConnections++;
  const clientId = activeConnections;
  console.log(\`[#\${clientId}] Incoming request received on main thread\`);

  // Asynchronous non-blocking timer / database simulation
  setTimeout(() => {
    res.writeHead(200);
    res.end(\`Response to client #\${clientId}\\n\`);
    console.log(\`[#\${clientId}] Response completed\`);
  }, 100);

  console.log(\`[#\${clientId}] Main thread free immediately!\`);
});

server.listen(4000);`,
      language: 'javascript',
      output: `[#1] Incoming request received on main thread
[#1] Main thread free immediately!
[#2] Incoming request received on main thread
[#2] Main thread free immediately!
[#1] Response completed
[#2] Response completed`,
      whyOutput:
        'Client #1 arrives, registers a timer with libuv, and the main thread is freed immediately. Client #2 arrives and is processed on the exact same thread without waiting for Client #1\'s timer. When timers expire, their callbacks execute sequentially.',
      annotations: [
        'Line 9: Request arrives on main thread.',
        'Line 18: Main thread exits the request handler immediately without blocking.',
        'Line 14: Responses stream out independently as callbacks resolve.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Handling 50,000 Concurrent Connections with Minimal RAM',
      description:
        'In a traditional Apache/Tomcat multi-threaded server, 50,000 connections require 50,000 threads. At 1MB of stack memory per thread, this consumes 50GB of RAM just for thread stacks, causing severe context switching latency. In Node.js, 50,000 idle connections consume only their socket file descriptors (~150MB total RAM).',
      codeSnippet: `// High-concurrency WebSocket / SSE Notification Server
import http from 'node:http';

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Thousands of clients stay connected with minimal memory overhead!
  const interval = setInterval(() => {
    res.write(\`data: \${JSON.stringify({ time: Date.now() })}\\n\\n\`);
  }, 5000);

  req.on('close', () => clearInterval(interval));
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'How does Node.js handle thousands of concurrent requests if JavaScript is single-threaded?',
          spokenAnswer:
            'Node.js uses the Reactor Pattern and non-blocking I/O. When a request arrives, Node registers the socket with the OS kernel (epoll/kqueue) and returns control immediately. The single main thread never waits for I/O; it continuously processes callbacks queued by the event loop as I/O events complete, allowing one thread to handle thousands of concurrent connections.'
        },
        {
          question: 'What is the Golden Rule of the Node.js Event Loop?',
          spokenAnswer:
            '"Don\'t block the event loop!" Because all JavaScript runs on one thread, any long-running synchronous code (such as large JSON parsing, complex regex, or cryptographic calculations) freezes the main thread, delaying all other concurrent user requests and causing server-wide latency spikes.'
        }
      ],
      trickyFollowUp: {
        question: 'If two requests hit an Express route at the exact same millisecond, do their callbacks execute in parallel?',
        answer:
          'No! JavaScript execution is strictly sequential. Even if two I/O events complete at the exact same hardware millisecond, their callbacks are enqueued and executed one after the other on the single main thread. There is zero parallel JavaScript execution on the main thread.'
      },
      commonMistakes: [
        'Thinking concurrent requests mean parallel JavaScript execution (concurrency is I/O multiplexing, not parallel JS execution).',
        'Running heavy CPU computation in request handlers without worker threads.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Single JS thread handles all JavaScript logic and callback dispatching.',
        'I/O is non-blocking: delegated to OS kernel via the Reactor Pattern.',
        'Thousands of connections handled without thread-per-connection RAM overhead.',
        'Golden Rule: Never block the main thread with heavy synchronous CPU work.'
      ],
      oneLineDefinition:
        'The single-threaded event loop processes non-blocking I/O callbacks sequentially on one thread without spawning OS threads per connection.',
      interviewTip:
        'Contrast Node\'s single-threaded event demultiplexing with thread-per-request architectures (like traditional Apache/Tomcat).'
    }
  }
];
