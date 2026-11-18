import { QuickReferenceTopic } from './types';

export const nodejsCategory5MemoryPerformance: QuickReferenceTopic[] = [
  {
    id: 'node-memory-management',
    number: 21,
    title: 'Memory Management',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Memory Management and Performance',
    categorySlug: 'memory-performance',
    estimatedMinutes: 5,
    concept30Sec:
      'Node.js memory is divided into Stack Memory (fast, fixed-size LIFO allocation for function call frames and primitive values) and Heap Memory (dynamic, managed memory for objects, arrays, and closures). The V8 Heap is divided into distinct generations to optimize garbage collection performance.',
    internals: {
      overview:
        'V8 organizes heap memory into specialized spaces: 1) New Space (Young Generation): Small space (1-64MB) where fresh objects are allocated, split into semi-spaces ("From" and "To"); 2) Old Pointer Space: Holds surviving objects containing pointers to other objects; 3) Old Data Space: Holds surviving raw data objects (strings, raw arrays); 4) Large Object Space: Objects exceeding size limits allocated directly here to avoid moving them during GC; 5) Code Space: Holds JIT-compiled machine code from TurboFan; 6) Map Space: Holds Shapes/HiddenClasses.',
      flowSteps: [
        'Stack Memory: Stores function call frames, local primitive variables, and pointer references.',
        'Allocation: New objects allocated in the Nursery of the New Space (Young Generation).',
        'Promotion: Objects that survive two Minor GC cycles are promoted to the Old Generation.',
        'RSS (Resident Set Size): Total process memory in RAM = V8 Heap + Native C++ Buffers + Code + Stack.'
      ],
      diagram: `V8 HEAP STRUCTURE SPACES:
+-----------------------------------------------------------+
|                     TOTAL V8 HEAP                         |
|                                                           |
|  +---------------------------+  +----------------------+  |
|  |     NEW (YOUNG) SPACE     |  |      OLD SPACE       |  |
|  |  +------------+--------+  |  |  - Old Pointer Space |  |
|  |  | From-Space |To-Space|  |  |  - Old Data Space    |  |
|  |  +------------+--------+  |  |  (Surviving Objects) |  |
|  +---------------------------+  +----------------------+  |
|               |                             |             |
|  +---------------------------+  +----------------------+  |
|  |    LARGE OBJECT SPACE     |  |      CODE SPACE      |  |
|  | (Bypasses GC relocation)  |  | (JIT Compiled Code)  |  |
|  +---------------------------+  +----------------------+  |
+-----------------------------------------------------------+`
    },
    codeExample: {
      code: `import v8 from 'node:v8';

// Inspecting V8 Engine Memory and Heap Spaces
console.log('--- Process Memory Usage (Bytes) ---');
const mem = process.memoryUsage();
console.log({
  rssMB: Math.round(mem.rss / 1024 / 1024),          // Total RAM allocated to process
  heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),// Total V8 heap size
  heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),  // Memory actually occupied by JS data
  externalMB: Math.round(mem.external / 1024 / 1024)   // Native C++ memory (Buffers)
});

console.log('\\n--- V8 Heap Space Statistics ---');
const spaces = v8.getHeapSpaceStatistics();
spaces.forEach((s) => {
  console.log(\`Space: \${s.space_name.padEnd(20)} | Used: \${Math.round(s.space_used_size / 1024)} KB\`);
});`,
      language: 'javascript',
      output: `--- Process Memory Usage (Bytes) ---
{ rssMB: 38, heapTotalMB: 6, heapUsedMB: 4, externalMB: 1 }

--- V8 Heap Space Statistics ---
Space: read_only_space      | Used: 0 KB
Space: new_space            | Used: 1024 KB
Space: old_space            | Used: 2840 KB
Space: code_space           | Used: 412 KB
Space: shared_space         | Used: 0 KB
Space: new_large_object_space | Used: 0 KB
Space: large_object_space   | Used: 0 KB
Space: code_large_object_space | Used: 0 KB`,
      whyOutput:
        'process.memoryUsage() returns high-level memory segments. v8.getHeapSpaceStatistics() inspects V8\'s internal memory partition spaces, showing exact utilization in new_space, old_space, and code_space.',
      annotations: [
        'Line 6: rss is the Resident Set Size (total RAM allocated to the process by the OS).',
        'Line 8: heapUsed is the actual memory consumed by active JS objects.',
        'Line 13: v8.getHeapSpaceStatistics() exposes V8 internal space allocations.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Configuring --max-old-space-size in High-Memory Docker Containers',
      description:
        'By default on 64-bit systems, V8 limits heap size to ~1.4GB to prevent long Garbage Collection pause times. If your Docker container has 16GB of RAM, Node will still crash with an Out of Memory (OOM) error at ~1.4GB unless you explicitly configure the --max-old-space-size flag.',
      codeSnippet: `// Dockerfile / npm start command for high-memory microservices:
// node --max-old-space-size=8192 dist/index.js
// Allows the V8 Old Generation heap to grow up to 8GB!`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the difference between Stack and Heap memory in Node.js?',
          spokenAnswer:
            'Stack memory stores function execution frames, local primitive variables, and reference pointer addresses; it is managed in a strict LIFO order, extremely fast, and freed immediately when functions return. Heap memory stores dynamic, unstructured objects, arrays, and closures; it requires garbage collection to identify unreachable objects and reclaim memory.'
        },
        {
          question: 'What is the default memory limit of a Node.js process on 64-bit architectures and how do you increase it?',
          spokenAnswer:
            'On 64-bit systems, the default V8 heap limit is approximately 1.4GB to 2GB (configured to balance throughput against garbage collection pause times). It can be increased using the V8 command-line flag "--max-old-space-size=<megabytes>", for example: "node --max-old-space-size=4096 app.js".'
        }
      ],
      trickyFollowUp: {
        question: 'Does process.memoryUsage().rss include the memory allocated for Buffer objects?',
        answer:
          'Yes! RSS (Resident Set Size) includes all memory allocated to the process: the V8 heap, stack, compiled code, AND native C++ memory where Buffers reside (tracked in memoryUsage().external).'
      },
      commonMistakes: [
        'Assuming a Node.js process will automatically use all RAM available on a 32GB server without setting --max-old-space-size.',
        'Confusing heapTotal (total allocated heap chunks) with heapUsed (actual bytes occupied by active objects).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Stack = primitives & call frames (fast, LIFO); Heap = dynamic objects (GC managed).',
        'Heap spaces: New Space (Young Gen), Old Space, Large Object Space, Code Space.',
        'Default 64-bit heap limit: ~1.4GB to 2GB.',
        'Configure memory with: node --max-old-space-size=4096 app.js.'
      ],
      oneLineDefinition:
        'Node.js memory separates fast LIFO Stack frames from a multi-generational V8 Heap partitioned into New, Old, and Large Object spaces.',
      interviewTip:
        'Mention the Generational Hypothesis: "Most objects die young in the New Space; surviving objects get promoted to the Old Space."'
    }
  },

  {
    id: 'node-garbage-collection',
    number: 22,
    title: 'Garbage Collection',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Memory Management and Performance',
    categorySlug: 'memory-performance',
    estimatedMinutes: 5,
    concept30Sec:
      'Garbage Collection (GC) is V8\'s automatic memory management process that identifies unreachable objects on the heap and reclaims their memory. V8 uses a Generational Garbage Collector based on the "Weak Generational Hypothesis": most objects die young.',
    internals: {
      overview:
        'V8 implements two primary garbage collectors: 1) Minor GC (Scavenger): Runs frequently and ultra-fast (1-5ms) on the New Space. It copies live objects between two semi-spaces ("From" and "To") using Cheney\'s copying algorithm; surviving objects are promoted to the Old Space. 2) Major GC (Mark-Sweep-Compact): Runs on the Old Space when full. It traces reachable objects from Root pointers, sweeps unreachable memory into free lists, and compacts fragmented pages to defragment heap memory.',
      flowSteps: [
        'Weak Generational Hypothesis: Most allocated objects become unreachable shortly after creation.',
        'Minor GC (Scavenger): Traverses New Space. Copies live objects to To-space; swaps From/To; promotes 2x survivors to Old Space.',
        'Major GC Phase 1 (Marking): Traces references from roots (globals, stack frames, DOM/handles) to identify live objects.',
        'Major GC Phase 2 (Sweeping): Reclaims dead object memory slots and adds them to free-list allocators.',
        'Major GC Phase 3 (Compacting): Relocates live objects together to eliminate heap fragmentation.',
        'Orinoco GC: Modern V8 performs marking and sweeping concurrently and in parallel with JS execution to eliminate "Stop-the-World" latency pauses.'
      ],
      diagram: `V8 DUAL GARBAGE COLLECTOR PIPELINE:
[ New Object Allocated ]
           |
           v
+--------------------------+
| NEW SPACE (Minor GC)     | ===(Survives 2 cycles)===> [ PROMOTED TO OLD SPACE ]
| - Scavenge Algorithm     |                                      |
| - Fast (1-3ms pause)     |                                      v
+--------------------------+                         +--------------------------+
                                                     | OLD SPACE (Major GC)     |
                                                     | - Mark-Sweep-Compact     |
                                                     | - Concurrent & Parallel  |
                                                     +--------------------------+`
    },
    codeExample: {
      code: `// To run with GC exposure: node --expose-gc script.js
console.log('Initial memory:');
const before = process.memoryUsage().heapUsed;

// 1. Allocate 100,000 temporary objects in New Space
function generateTemporaryWork() {
  const list = [];
  for (let i = 0; i < 100000; i++) {
    list.push({ id: i, data: 'temporary_string_' + i });
  }
  return list.length;
}

generateTemporaryWork();
const afterAllocation = process.memoryUsage().heapUsed;
console.log(\`Memory grew by: \${Math.round((afterAllocation - before) / 1024)} KB\`);

// 2. Trigger manual GC (if --expose-gc enabled)
if (global.gc) {
  global.gc();
  const afterGC = process.memoryUsage().heapUsed;
  console.log(\`Memory after GC: \${Math.round((afterGC - before) / 1024)} KB (Reclaimed!)\`);
} else {
  console.log('Run with node --expose-gc to test manual Garbage Collection!');
}`,
      language: 'javascript',
      output: `Initial memory:
Memory grew by: 8140 KB
Run with node --expose-gc to test manual Garbage Collection!`,
      whyOutput:
        'The temporary list object created in generateTemporaryWork becomes unreachable as soon as the function exits. V8\'s Scavenger collector will automatically reclaim this New Space memory during the next minor GC cycle.',
      annotations: [
        'Line 7: Local objects created inside function scope die young.',
        'Line 19: global.gc() exposes V8\'s internal garbage collection trigger for benchmarks.',
        'New Space allocations are reclaimed within milliseconds with near-zero latency.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Diagnosing GC Pauses and Latency Spikes with --trace-gc',
      description:
        'In latency-sensitive microservices (like payment processors or real-time gaming), mysterious 50ms latency spikes are often caused by V8 Major GC pauses. Senior developers launch services with the flags "node --trace-gc" or "--trace-gc-verbose" to log every Scavenge and Mark-Sweep event to stdout.',
      codeSnippet: `// Launch command to profile GC pauses in production:
// node --trace-gc app.js
// Sample Output:
// [24102:0x104000] 120ms: Scavenge 2.1 -> 1.4 MB, 1.2 ms
// [24102:0x104000] 450ms: Mark-sweep 24.5 -> 12.1 MB, 14.8 ms (Major GC)`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the difference between Minor GC (Scavenge) and Major GC (Mark-Sweep-Compact)?',
          spokenAnswer:
            'Minor GC operates on the New Space (Young Generation) using the Scavenger algorithm. It is frequent, ultra-fast (sub-2ms), and moves live objects between semi-spaces. Major GC operates on the Old Space when it fills up; it traces references across the entire heap, marks live objects, sweeps dead memory, and compacts pages. Major GC is more expensive and historically caused noticeable latency pauses.'
        },
        {
          question: 'What is Orinoco in the V8 engine?',
          spokenAnswer:
            'Orinoco is V8\'s modern garbage collection project that replaced traditional "Stop-the-World" pauses. It introduces Parallel, Incremental, and Concurrent garbage collection: background helper threads mark and sweep memory concurrently while the main thread continues executing JavaScript.'
        }
      ],
      trickyFollowUp: {
        question: 'What triggers an object to be promoted from the New Space to the Old Space?',
        answer:
          'An object is promoted to the Old Space if: 1) It has survived two consecutive Minor GC (Scavenge) cycles; or 2) The To-Space becomes more than 25% full during a scavenge cycle (to avoid overflowing New Space).'
      },
      commonMistakes: [
        'Calling global.gc() in production code (forces expensive synchronous Major GC, freezing performance).',
        'Assuming GC frees memory back to the host operating system immediately (V8 retains allocated pages in its heap pool).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Weak Generational Hypothesis: Most objects die young.',
        'Minor GC (Scavenge): Fast (1-2ms), operates on New Space semi-spaces.',
        'Major GC (Mark-Sweep-Compact): Operates on Old Space; defragments memory.',
        'Orinoco: V8\'s concurrent, parallel, incremental GC reducing pause times.'
      ],
      oneLineDefinition:
        'Garbage Collection automatically frees unreachable heap memory using fast Scavenge cycles on the New Space and Mark-Sweep-Compact on the Old Space.',
      interviewTip:
        'Recite the 3 phases of Major GC: "Mark reachable roots -> Sweep dead memory -> Compact fragmented heap pages."'
    }
  },

  {
    id: 'node-memory-leaks-heap-snapshots',
    number: 23,
    title: 'Memory Leaks and Heap Snapshots',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Memory Management and Performance',
    categorySlug: 'memory-performance',
    estimatedMinutes: 5,
    concept30Sec:
      'A Memory Leak in Node.js occurs when objects that are no longer needed by the application remain reachable through the Root reference chain, preventing V8\'s Garbage Collector from reclaiming their memory. Over time, memory consumption grows until the process crashes with "JavaScript heap out of memory".',
    internals: {
      overview:
        'The 4 classic memory leak causes in Node.js: 1) Accidental global variables (hanging on globalThis); 2) Forgotten timers / intervals (setInterval holding closures indefinitely); 3) Unremoved event listeners (EventEmitter listeners holding large request contexts); 4) Unbounded in-memory caches (Maps/Objects growing without LRU eviction limits). Heap Snapshots serialize the entire V8 heap graph into a .heapsnapshot file to inspect Retained Size vs Shallow Size in Chrome DevTools.',
      flowSteps: [
        'Root Retainer: An object is reachable if a chain of references connects it to a Root (global object or active stack frame).',
        'Shallow Size: Memory held by the object structure itself.',
        'Retained Size: Memory that would be freed if this object were deleted (includes its entire dependent child graph).',
        'Heap Snapshot Analysis: Capture 2 snapshots (before load and after load); filter by objects allocated between Snapshot 1 and 2.'
      ],
      diagram: `MEMORY LEAK ROOT RETENTION GRAPH:
[ Root (global object / long-lived cache) ]
                   |
                   v (Strong reference pointer)
         [ Unbounded Map Cache ]
                   |
                   v (Retained reference)
    [ Leaked Request Context Object ]  <-- Cannot be Garbage Collected!
                   |
                   v
    [ Massive 20MB Raw Buffer / Data ] <-- Leaks until Process Crashes with OOM!`
    },
    codeExample: {
      code: `import v8 from 'node:v8';
import fs from 'node:fs';

// 1. Classic Memory Leak: Unbounded in-memory cache without eviction
const leakedCache = new Map();

function handleUserRequest(userId, payload) {
  // BUG: Storing payload on every request indefinitely without an LRU limit!
  leakedCache.set(userId + '_' + Date.now(), {
    payload,
    timestamp: Date.now()
  });
}

// Simulating 5,000 leaking requests
for (let i = 0; i < 5000; i++) {
  handleUserRequest('user_' + i, Buffer.alloc(1024, 'X'));
}
console.log(\`Leaked cache entries: \${leakedCache.size}\`);

// 2. Generating Programmatic Heap Snapshot for Diagnostic Inspection:
function captureHeapSnapshot() {
  const snapshotStream = v8.getHeapSnapshot();
  const fileName = \`./heap-\${Date.now()}.heapsnapshot\`;
  const fileStream = fs.createWriteStream(fileName);
  snapshotStream.pipe(fileStream);
  console.log(\`Generated Heap Snapshot: \${fileName} (Load into Chrome DevTools Memory Tab!)\`);
}

captureHeapSnapshot();`,
      language: 'javascript',
      output: `Leaked cache entries: 5000
Generated Heap Snapshot: ./heap-1731932400000.heapsnapshot (Load into Chrome DevTools Memory Tab!)`,
      whyOutput:
        'leakedCache retains strong references to all payloads. Because leakedCache is bound in global module scope, none of the 5,000 objects can ever be collected by V8. v8.getHeapSnapshot() writes the complete object graph to disk for inspection.',
      annotations: [
        'Line 5: In-memory Maps without size limits or TTL are the #1 cause of memory leaks.',
        'Line 20: v8.getHeapSnapshot() captures live production memory without third-party native addons.',
        'The resulting .heapsnapshot file can be loaded directly into Chrome DevTools.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Investigating Production Memory Leaks with Chrome DevTools & Clinic.js',
      description:
        'When an alert fires in Datadog/Prometheus showing monotonic memory growth in an ECS/Kubernetes container, senior engineers launch the process with "--inspect", connect Chrome DevTools (chrome://inspect), trigger requests, take two Heap Snapshots, and sort by "Objects allocated between Snapshot 1 and 2" to pinpoint the exact variable leaking memory.',
      codeSnippet: `// Prevention: Always use an LRU Cache with maximum entry constraints!
import { LRUCache } from 'lru-cache';

const safeProductionCache = new LRUCache({
  max: 5000,              // Hard ceiling on total items
  maxSize: 50 * 1024 * 1024, // Maximum 50MB RAM limit
  sizeCalculation: (val) => Buffer.byteLength(JSON.stringify(val)),
  ttl: 1000 * 60 * 15     // Evicts automatically after 15 minutes!
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What are the 4 most common causes of memory leaks in Node.js?',
          spokenAnswer:
            '1) Unbounded in-memory caches (Maps or objects without LRU limits or TTL); 2) Forgotten timers or intervals (setInterval holding closures); 3) Unremoved EventEmitter listeners (e.g., repeatedly attaching socket.on without cleanup); 4) Accidental global variables or closures retaining large request scopes.'
        },
        {
          question: 'What is the difference between Shallow Size and Retained Size in a Heap Snapshot?',
          spokenAnswer:
            'Shallow Size is the memory held by the object itself (its own properties and immediate primitive fields). Retained Size is the total memory freed once that object is garbage collected—it includes the object itself plus all child objects that are reachable exclusively through it.'
        }
      ],
      trickyFollowUp: {
        question: 'Why does a WeakMap prevent memory leaks compared to a standard Map?',
        answer:
          'In a standard Map, keys and values are held by strong references, preventing garbage collection. In a WeakMap, keys must be objects and are held by WEAK references. If no other part of the application holds a reference to the key object, V8 automatically garbage-collects both the key and value from the WeakMap.'
      },
      commonMistakes: [
        'Using global object literals as caches in high-traffic APIs without eviction mechanisms.',
        'Inspecting memory leaks using process.memoryUsage().rss alone without analyzing V8 heap snapshots.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Memory leaks = unreachable code remaining reachable from Root references.',
        'Top 4 culprits: Unbounded caches, forgotten intervals, dangling listeners, global variables.',
        'Retained Size = memory reclaimed if the object is garbage-collected.',
        'Use v8.getHeapSnapshot() + Chrome DevTools Memory tab for diagnostics.',
        'Use LRU caches (lru-cache) or WeakMap to prevent memory leaks.'
      ],
      oneLineDefinition:
        'A memory leak occurs when unused objects remain linked to root references, preventing V8 garbage collection and causing progressive process memory exhaustion.',
      interviewTip:
        'Distinguish Shallow Size (own memory) vs Retained Size (entire dependent tree memory).'
    }
  },

  {
    id: 'node-cpu-vs-io-workloads',
    number: 24,
    title: 'CPU-intensive vs I/O-intensive Workloads',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Memory Management and Performance',
    categorySlug: 'memory-performance',
    estimatedMinutes: 5,
    concept30Sec:
      'I/O-intensive workloads spend most of their time waiting for external operations (network, database, file system), where Node.js excels via non-blocking asynchronous event multiplexing. CPU-intensive workloads require continuous processor math (crypto, compression, image parsing), which blocks Node\'s single JavaScript thread unless offloaded.',
    internals: {
      overview:
        'In I/O workloads, the CPU spends milliseconds initiating requests and yields control back to the event loop while the hardware/network responds. In CPU workloads, the processor executes millions of bytecode instructions sequentially without yielding, causing Event Loop Starvation. Strategies to handle CPU workloads in Node: 1) Worker Threads (shared process); 2) Child Processes (isolated process); 3) Asynchronous Background Task Queues (BullMQ with Redis workers); 4) Delegating to specialized Go/Rust/Python microservices.',
      flowSteps: [
        'I/O Workload: 95% waiting, 5% CPU -> Node.js event loop handles 50,000+ connections easily.',
        'CPU Workload: 95% CPU, 5% waiting -> A single 3-second math loop freezes all 50,000 connections.',
        'Solution A (In-process): Offload calculation to Worker Threads using Piscina.',
        'Solution B (Distributed): Push task to Redis Queue (BullMQ) -> External dedicated worker workers consume it.'
      ],
      diagram: `WORKLOAD SCALING ARCHITECTURE:
I/O-INTENSIVE WORKLOAD (CRUD API):
[ 10,000 Clients ] ===> [ Single Node.js Event Loop ] ===> [ Postgres / Redis DB ]
(Handled with minimal RAM and near-zero CPU!)

CPU-INTENSIVE WORKLOAD (Video Transcoding / ML / Image Resize):
[ Client Request ] ===> [ Node.js API Gateway ]
                               |
                               v (Enqueues Job)
                       [ Redis BullMQ Queue ]
                               |
            +------------------+------------------+
            v                                     v
[ Dedicated CPU Worker A ]            [ Dedicated CPU Worker B ]
(Node Worker / Go / Rust)             (Scales independently on CPU nodes!)`
    },
    codeExample: {
      code: `// Demonstrating the impact of CPU-intensive work on Event Loop Latency:
import http from 'node:http';

// Simulate heavy CPU calculation: Computing primes
function computePrimes(count) {
  const primes = [];
  let n = 2;
  while (primes.length < count) {
    let isPrime = true;
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) { isPrime = false; break; }
    }
    if (isPrime) primes.push(n);
    n++;
  }
  return primes.length;
}

const server = http.createServer((req, res) => {
  if (req.url === '/fast') {
    // Normal I/O endpoint: Returns in 1ms!
    res.end('Fast endpoint response');
  } else if (req.url === '/heavy-cpu') {
    // DANGER: Synchronous CPU computation blocks entire server for 2 seconds!
    const total = computePrimes(50000);
    res.end(\`Computed \${total} primes\\n\`);
  }
});

server.listen(6000, () => {
  console.log('Server running. While /heavy-cpu runs, /fast will FREEZE and TIMEOUT!');
});`,
      language: 'javascript',
      output: `Server running. While /heavy-cpu runs, /fast will FREEZE and TIMEOUT!`,
      whyOutput:
        'Because JavaScript is single-threaded, when a client hits /heavy-cpu, computePrimes monopolizes the V8 call stack. Any other client attempting to access /fast during those 2 seconds is completely frozen, demonstrating why CPU work must never run on the main thread.',
      annotations: [
        'Line 20: /fast endpoint is lightweight I/O.',
        'Line 23: /heavy-cpu locks the single thread with raw math calculations.',
        'Rule: Heavy CPU tasks must be offloaded to Worker Threads or async queues.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Enterprise Architecture: Decoupling CPU Work with BullMQ & Redis',
      description:
        'In production e-commerce or SaaS systems, CPU-intensive tasks (generating PDF reports, video transcoding, CSV imports) are decoupled from the API gateway using a message queue like BullMQ backed by Redis. The Express API acknowledges the user request in 5ms with a jobId, while standalone worker containers process the compute.',
      codeSnippet: `// Express Controller: Fast 5ms Response + Background Queue
import { Queue } from 'bullmq';

const reportQueue = new Queue('report-generation', { connection: redisConfig });

app.post('/api/reports/generate', async (req, res) => {
  // 1. Enqueue job into Redis (takes ~3ms)
  const job = await reportQueue.add('generate-pdf', {
    userId: req.user.id,
    dateRange: req.body.range
  });

  // 2. Return immediately to the client! Main thread never freezes!
  res.status(202).json({
    status: 'QUEUED',
    jobId: job.id,
    message: 'Report generation started. You will receive an email upon completion.'
  });
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Why does Node.js excel at I/O-intensive workloads but struggle with CPU-intensive workloads?',
          spokenAnswer:
            'Node.js excels at I/O-intensive workloads because its single-threaded event loop and non-blocking I/O multiplex thousands of concurrent connections with minimal memory overhead, spending most of its time waiting for kernel network/disk responses. It struggles with CPU-intensive workloads because all JavaScript executes on a single thread; any prolonged mathematical calculation monopolizes the CPU, starving the event loop and delaying all concurrent requests.'
        },
        {
          question: 'What are the 3 best architecture strategies to handle CPU-intensive tasks in a Node.js ecosystem?',
          spokenAnswer:
            '1) In-process: Offload compute to Worker Threads (using a pool like Piscina) to run JS across multi-core CPUs without blocking the main event loop; 2) Dedicated Job Queues: Enqueue tasks to BullMQ/RabbitMQ for background worker containers to process; 3) Microservice Delegation: Offload heavy compute to specialized languages like Go, Rust, or Python via gRPC.'
        }
      ],
      trickyFollowUp: {
        question: 'Does running a CPU-intensive calculation inside an "async" function or Promise prevent it from blocking the event loop?',
        answer:
          'NO! Wrapping synchronous CPU-intensive code inside "new Promise((resolve) => { /* heavy math */ })" or an async function does NOT make it run in the background. The promise executor executes SYNCHRONOUSLY on the main thread, blocking the event loop just as severely!'
      },
      commonMistakes: [
        'Wrapping heavy synchronous loops in "new Promise()" and believing it runs in the background.',
        'Performing heavy cryptographic calculations or compression synchronously on the API main thread.'
      ]
    },
    quickRevision: {
      takeaways: [
        'I/O-intensive: 95% waiting, 5% CPU -> Node.js is optimal.',
        'CPU-intensive: 95% CPU -> Monopolizes single thread and freezes event loop.',
        'Wrapping CPU math in a Promise does NOT make it asynchronous.',
        'Solutions: Worker Threads (Piscina), Background Job Queues (BullMQ), or Rust/Go microservices.'
      ],
      oneLineDefinition:
        'I/O workloads wait on external systems and thrive on Node\'s event loop, whereas CPU workloads monopolize the main thread and must be offloaded to worker threads or external task queues.',
      interviewTip:
        'Call out the Promise trap: "Wrapping synchronous CPU-heavy code in a Promise or async function does NOT prevent it from blocking the event loop."'
    }
  }
];
