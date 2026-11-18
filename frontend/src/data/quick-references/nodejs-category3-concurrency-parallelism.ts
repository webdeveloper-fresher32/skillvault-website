import { QuickReferenceTopic } from './types';

export const nodejsCategory3ConcurrencyParallelism: QuickReferenceTopic[] = [
  {
    id: 'node-worker-threads',
    number: 13,
    title: 'Worker Threads',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Concurrency and Parallelism',
    categorySlug: 'concurrency-parallelism',
    estimatedMinutes: 5,
    concept30Sec:
      'The worker_threads module enables running JavaScript in parallel on multiple threads within the SAME operating system process. Each worker thread runs its own V8 Isolate and its own Event Loop, while sharing the same process memory space and supporting true shared memory via SharedArrayBuffer.',
    internals: {
      overview:
        'A Worker Thread is a real OS thread spawned by the main process. Unlike cluster/child_process which spawn separate OS processes with separate PIDs, all worker threads live under a single PID. Each worker thread instantiates an isolated V8 runtime (V8 Isolate), its own libuv event loop, and its own call stack. Data is communicated by cloning messages over MessagePort (using HTML5 structured clone algorithm) or zero-copy sharing via SharedArrayBuffer with Atomics.',
      flowSteps: [
        'Main thread calls "new Worker(\'worker.js\')".',
        'libuv spawns an OS thread and boots an independent V8 Isolate inside the SAME process.',
        'Worker thread gets its own Call Stack and its own Event Loop.',
        'Data passed via parentPort.postMessage(data) (deep cloned via structured clone).',
        'Optional true zero-copy shared memory: SharedArrayBuffer accessed safely with Atomics.'
      ],
      diagram: `WORKER THREADS ARCHITECTURE (Single OS Process PID):
+-----------------------------------------------------------+
| OS Process (PID: 10452)                                   |
|                                                           |
|  +------------------------+      +---------------------+  |
|  | Main Thread            |      | Worker Thread 1     |  |
|  | - V8 Isolate A         | <==> | - V8 Isolate B      |  |
|  | - Event Loop A         | IPC  | - Event Loop B      |  |
|  +------------------------+      +---------------------+  |
|               \\                     /                     |
|                v                   v                      |
|         [ SharedArrayBuffer (Zero-copy RAM) ]             |
+-----------------------------------------------------------+`
    },
    codeExample: {
      code: `import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

if (isMainThread) {
  // MAIN THREAD: Dispatches CPU-heavy math to a background worker
  console.log(\`[Main Thread PID: \${process.pid}] Spawning background worker...\`);

  const worker = new Worker(new URL(import.meta.url), {
    workerData: { iterations: 1e7 }
  });

  worker.on('message', (result) => {
    console.log(\`[Main Thread] Received computation result: \${result}\`);
  });

  console.log('[Main Thread] Free to service other HTTP requests!');
} else {
  // WORKER THREAD: Runs on a separate thread; main thread never freezes!
  let sum = 0;
  for (let i = 0; i < workerData.iterations; i++) {
    sum += i;
  }
  parentPort?.postMessage(sum);
}`,
      language: 'javascript',
      output: `[Main Thread PID: 49120] Spawning background worker...
[Main Thread] Free to service other HTTP requests!
[Main Thread] Received computation result: 49999995000000`,
      whyOutput:
        'The heavy calculation of 10 million iterations is offloaded to the worker thread. The main thread continues running asynchronously and logs immediately that it is free to service requests. Once the worker finishes, parentPort transmits the result back to the main thread.',
      annotations: [
        'Line 3: isMainThread differentiates the controller from the worker logic.',
        'Line 7: new Worker() spawns an OS thread with its own V8 Isolate.',
        'Line 15: Main thread never blocks while the computation runs.',
        'Line 22: Results transferred via parentPort message passing.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Offloading PDF Generation, Image Resizing, and Cryptographic Proofs',
      description:
        'Worker Threads are the premier solution in Node.js for CPU-bound tasks within an Express/NestJS backend (such as generating complex PDF invoices with Puppeteer/PDFKit, image compression via Sharp, or computing password hashes and cryptographic proofs). Workers prevent CPU spikes from freezing the main API thread.',
      codeSnippet: `// Thread Pool pattern using Piscina for enterprise CPU tasks
import Piscina from 'piscina';

const invoiceWorkerPool = new Piscina({
  filename: new URL('./invoiceWorker.js', import.meta.url).href,
  maxThreads: 4 // Limits worker thread allocation to protect host CPU
});

app.post('/api/invoices/generate', async (req, res) => {
  // Dispatched to pooled worker thread: main API thread remains 100% responsive!
  const pdfBuffer = await invoiceWorkerPool.run({ orderId: req.body.orderId });
  res.type('application/pdf').send(pdfBuffer);
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the architectural difference between Worker Threads and the libuv Thread Pool?',
          spokenAnswer:
            'The libuv thread pool is an internal C++ thread pool used exclusively by Node\'s C++ bindings for file I/O, DNS, and native crypto; you cannot execute custom JavaScript code on it. Worker Threads, on the other hand, spawn real OS threads with their own independent V8 Isolate and event loop, allowing you to execute custom JavaScript code in parallel.'
        },
        {
          question: 'Do Worker Threads share memory in Node.js?',
          spokenAnswer:
            'By default, messages sent between worker threads are serialized and cloned using the structured clone algorithm (independent memory). However, Worker Threads CAN share memory directly using SharedArrayBuffer. Concurrent mutations are coordinated using the Atomics API to prevent race conditions.'
        }
      ],
      trickyFollowUp: {
        question: 'Should you use Worker Threads to handle concurrent HTTP requests in Express?',
        answer:
          'No! Spawning a worker thread for each HTTP request is a severe anti-pattern. Worker threads have significant memory overhead (~20MB to boot a V8 isolate). HTTP requests are I/O-bound and should be handled by Node\'s single-threaded event loop or scaled across CPU cores using the Cluster module.'
      },
      commonMistakes: [
        'Using Worker Threads for I/O operations (like database queries or HTTP fetching; the event loop already handles this better).',
        'Spawning a new Worker on every single request without a thread pool (creates memory exhaustion).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Worker Threads = Multi-threading in a SINGLE OS process (shared PID).',
        'Each worker has its own V8 Isolate and its own Event Loop.',
        'Best for: CPU-bound JavaScript (PDFs, hashing, image processing).',
        'Shared memory possible via SharedArrayBuffer + Atomics.'
      ],
      oneLineDefinition:
        'Worker Threads run CPU-intensive JavaScript in parallel on separate threads within the same OS process, each with an independent V8 Isolate and event loop.',
      interviewTip:
        'Remember: Worker Threads are for CPU-bound JavaScript, NOT for scaling I/O-bound HTTP request handling.'
    }
  },

  {
    id: 'node-cluster-module',
    number: 14,
    title: 'Cluster Module',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Concurrency and Parallelism',
    categorySlug: 'concurrency-parallelism',
    estimatedMinutes: 5,
    concept30Sec:
      'The cluster module enables scaling Node.js applications across multiple CPU cores by forking multiple child processes that share the exact same server port. A primary process manages worker child processes, distributing incoming TCP connections using Round-Robin load balancing.',
    internals: {
      overview:
        'The cluster module uses child_process.fork() internally. Each worker is a completely separate operating system process with its own PID, its own V8 instance, and completely isolated memory (~30MB+ RAM each). On Linux/macOS, the primary process binds to the TCP port (e.g. 3000), accepts incoming connections, and passes the socket file descriptors over internal IPC channels to worker processes in Round-Robin fashion.',
      flowSteps: [
        'Primary process starts and inspects cluster.isPrimary (or isMaster in legacy Node).',
        'Primary forks N worker processes using cluster.fork() (typically N = os.cpus().length).',
        'Each worker process is an independent OS process with its own V8 instance and heap.',
        'Primary listens on the target TCP port.',
        'Incoming TCP connections are distributed by the primary to workers via Round-Robin socket handoff.',
        'If a worker crashes, the primary receives an "exit" event and forks a replacement worker immediately (Zero-downtime self-healing).'
      ],
      diagram: `CLUSTER MODULE ARCHITECTURE (Multi-Process Scaling):
                    [ Incoming Traffic on Port 8080 ]
                                   |
                                   v
             [ Primary Process (PID: 1000) - Binds Port ]
                                   |
             +---------------------+---------------------+
             | (Round-Robin IPC socket handoff)          |
             v                                           v
  [ Worker 1 (PID: 1001) ]                   [ Worker 2 (PID: 1002) ]
  - Own V8 Instance                          - Own V8 Instance
  - Own Heap (Isolated)                      - Own Heap (Isolated)
  - Own Event Loop                           - Own Event Loop`
    },
    codeExample: {
      code: `import cluster from 'node:cluster';
import http from 'node:http';
import os from 'node:os';

if (cluster.isPrimary) {
  const numCPUs = Math.min(2, os.cpus().length);
  console.log(\`[Primary PID: \${process.pid}] Forking \${numCPUs} workers...\`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Self-Healing Zero-Downtime Worker Replacement:
  cluster.on('exit', (worker, code, signal) => {
    console.warn(\`[Primary] Worker \${worker.process.pid} died. Forking replacement...\`);
    cluster.fork();
  });
} else {
  // WORKER PROCESS: All workers share port 5000!
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end(\`Handled by Worker PID: \${process.pid}\\n\`);
  }).listen(5000, () => {
    console.log(\`[Worker PID: \${process.pid}] Listening on shared port 5000\`);
  });
}`,
      language: 'javascript',
      output: `[Primary PID: 50124] Forking 2 workers...
[Worker PID: 50125] Listening on shared port 5000
[Worker PID: 50126] Listening on shared port 5000`,
      whyOutput:
        'The primary process forks 2 distinct OS processes. Both workers invoke server.listen(5000), but the OS does not throw an EADDRINUSE error because the primary process holds the actual listening socket and hands off incoming connections via IPC.',
      annotations: [
        'Line 5: cluster.isPrimary guards the manager process.',
        'Line 9: cluster.fork() spawns independent OS child processes.',
        'Line 13: Self-healing auto-restart pattern if a worker crashes.',
        'Line 19: Multiple workers share the same network port without port conflicts.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Zero-Downtime Rolling Restarts & PM2 Production Cluster Mode',
      description:
        'In production cloud deployments without Kubernetes (or inside single VM containers), production process managers like PM2 run Node apps in cluster mode ("pm2 start app.js -i max"). Cluster mode utilizes 100% of multi-core CPU capacity and supports zero-downtime rolling restarts by restarting workers one-by-one.',
      codeSnippet: `// PM2 Ecosystem Config for Cluster Mode:
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'api-service',
    script: './dist/index.js',
    instances: 'max', // Scales to all available CPU cores automatically!
    exec_mode: 'cluster',
    max_memory_restart: '1G' // Automatically restarts worker if memory leaks reach 1GB
  }]
};`
    },
    interviewPrep: {
      questions: [
        {
          question: 'How do multiple cluster workers listen on the same TCP port without EADDRINUSE?',
          spokenAnswer:
            'Workers do NOT independently bind to the port. The primary process binds the port at the OS level. When incoming connections arrive, the primary process distributes the raw socket file descriptors to worker processes over internal UNIX domain sockets / IPC pipes using Round-Robin scheduling. The worker then takes over the socket to read and respond.'
        },
        {
          question: 'Can cluster workers share in-memory session state?',
          spokenAnswer:
            'No! Cluster workers are separate operating system processes with completely isolated V8 heaps and memory spaces. A variable stored in memory on Worker A is completely invisible to Worker B. State must be externalized using an external store like Redis, Memcached, or a database.'
        }
      ],
      trickyFollowUp: {
        question: 'Why do Kubernetes deployments often avoid the Node.js Cluster module?',
        answer:
          'Because Kubernetes scales at the Pod/container level. Instead of running 1 container with 8 cluster workers, K8s best practice runs 8 single-threaded Pods across nodes, allowing Kubernetes to handle health checks, CPU limits, resource isolation, and load balancing natively.'
      },
      commonMistakes: [
        'Storing in-memory user sessions or caches in a clustered app and wondering why users intermittently lose their login session.',
        'Using cluster.fork() for CPU computation (use worker_threads instead to avoid process overhead).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Cluster = Multi-PROCESS scaling across CPU cores (different PIDs).',
        'Completely ISOLATED memory spaces (requires Redis for shared state).',
        'Primary process binds the port and distributes sockets via Round-Robin.',
        'Best for: Scaling HTTP web servers to 100% multi-core CPU capacity.'
      ],
      oneLineDefinition:
        'The cluster module scales HTTP servers by forking independent child processes that share the same network port via primary socket handoffs.',
      interviewTip:
        'Emphasize that cluster memory is 100% isolated: "In-memory variables are NOT shared between workers; sessions must live in Redis."'
    }
  },

  {
    id: 'node-child-processes',
    number: 15,
    title: 'Child Processes',
    section: 'Node.js Internals and Architecture',
    sectionSlug: 'nodejs',
    category: 'Concurrency and Parallelism',
    categorySlug: 'concurrency-parallelism',
    estimatedMinutes: 5,
    concept30Sec:
      'The child_process module allows Node.js to spawn completely independent operating system processes to execute external binaries, CLI commands, or separate Node scripts. It provides four primary methods: spawn(), exec(), execFile(), and fork().',
    internals: {
      overview:
        'Child processes execute at the OS kernel level using the system calls fork() and execve(). They run outside of Node\'s V8 runtime. Communication with child processes occurs via standard OS pipes: stdin (stream 0), stdout (stream 1), and stderr (stream 2). The fork() method is a specialized version of spawn() that opens a dedicated bi-directional IPC channel for passing JSON messages.',
      flowSteps: [
        'spawn(cmd, args): Streams data via stdin/stdout pipes; ideal for large outputs or long-running commands.',
        'exec(cmd, cb): Spawns an OS shell (/bin/sh); buffers entire output into memory (default maxBuffer: 1MB; vulnerable to command injection).',
        'execFile(file, args, cb): Directly invokes executable without spawning a shell (faster & safe from shell injection).',
        'fork(modulePath): Spawns an independent Node.js process with a built-in IPC channel (process.send()).'
      ],
      diagram: `CHILD PROCESS METHODS COMPARISON:
Method       Shell Spawned?   Data Handling       Use Case
----------------------------------------------------------------------
spawn()      No (by default)  Streaming (Pipes)   Large data, long processes (ffmpeg)
exec()       YES (/bin/sh)    Buffered (RAM)      Small CLI commands (git, ls)
execFile()   No               Buffered (RAM)      Binary executables without shell
fork()       No               Streaming + IPC     Separate Node.js scripts with IPC`
    },
    comparisonTable: {
      headers: ['Feature', 'Worker Threads', 'Cluster Module', 'Child Processes (spawn/fork)'],
      rows: [
        ['Process / Thread', 'Multiple threads, 1 OS Process (1 PID)', 'Multiple OS Processes (Multiple PIDs)', 'Completely independent OS Processes'],
        ['V8 Instances', 'Separate V8 Isolates per thread', 'Separate V8 Instances per process', 'Separate V8 (for fork) or non-JS binary'],
        ['Memory Model', 'Shared RAM space; SharedArrayBuffer', 'Completely isolated memory', 'Completely isolated memory'],
        ['Communication', 'MessagePort / SharedArrayBuffer', 'IPC socket handoff / IPC messages', 'Streams (stdin/stdout) or IPC channel (fork)'],
        ['Port Sharing', 'No native port sharing', 'Shares identical TCP port', 'No native port sharing (must proxy or bind different ports)'],
        ['Primary Use Case', 'CPU-intensive JavaScript compute', 'Scaling HTTP servers across CPU cores', 'Executing CLI tools, Python, FFmpeg, Bash']
      ]
    },
    codeExample: {
      code: `import { spawn } from 'node:child_process';

// Streaming output from an external OS command (tar / git / python)
console.log('Spawning child process...');

// Using spawn (Streaming, memory-safe, safe from shell injection):
const child = spawn('git', ['--version']);

child.stdout.on('data', (data) => {
  console.log(\`[Child stdout]: \${data.toString().trim()}\`);
});

child.stderr.on('data', (err) => {
  console.error(\`[Child stderr]: \${err.toString()}\`);
});

child.on('close', (code) => {
  console.log(\`Child process exited with status code: \${code}\`);
});`,
      language: 'javascript',
      output: `Spawning child process...
[Child stdout]: git version 2.44.0
Child process exited with status code: 0`,
      whyOutput:
        'spawn directly invokes the git binary without invoking a shell. Output is streamed in chunks through child.stdout, avoiding buffering limits. When the binary completes, the exit event fires.',
      annotations: [
        'Line 7: spawn passes arguments as an array, eliminating shell injection vulnerabilities.',
        'Line 9: child.stdout streams data chunks as they arrive.',
        'Line 17: on("close") captures the OS process exit code.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Running Video Transcoding with FFmpeg & Python ML Models',
      description:
        'In production backends, Node.js uses child_process.spawn() to pipe video streams directly to FFmpeg for on-the-fly HLS transcoding, or to execute Python machine learning scripts without risking main-thread event loop stalls.',
      codeSnippet: `// Streaming video transcoding using FFmpeg via spawn
import { spawn } from 'node:child_process';
import fs from 'node:fs';

function transcodeVideo(inputPath, outputPath) {
  const ffmpeg = spawn('ffmpeg', [
    '-i', inputPath,
    '-vcodec', 'h264',
    '-acodec', 'aac',
    outputPath
  ]);

  ffmpeg.stderr.on('data', (data) => console.log('FFmpeg Progress:', data.toString()));
  ffmpeg.on('close', (code) => console.log('Transcoding finished with code:', code));
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the difference between exec() and spawn() in child_process?',
          spokenAnswer:
            'exec spawns a system shell (/bin/sh) and buffers the entire output into RAM before invoking the callback, making it vulnerable to shell command injection and RangeError maxBuffer exceptions on large outputs. spawn does not spawn a shell by default and streams output in real time via stdout/stderr streams, making it safe, fast, and memory-efficient for large or long-running commands.'
        },
        {
          question: 'When would you choose Child Processes over Worker Threads?',
          spokenAnswer:
            'Use Child Processes when you need to execute external system binaries or non-JavaScript programs (like Python scripts, Bash commands, FFmpeg, or C++ binaries). Use Worker Threads when you need to execute CPU-intensive JavaScript code that requires lightweight thread creation or shared memory.'
        }
      ],
      trickyFollowUp: {
        question: 'Why is child_process.exec() vulnerable to Command Injection?',
        answer:
          'Because exec() evaluates the command string directly inside a shell. If user input is concatenated (e.g. exec(`ls ${userInput}`)), an attacker can inject malicious shell commands like "; rm -rf /". spawn() and execFile() pass arguments as an array directly to the system call without a shell, neutralizing command injection.'
      },
      commonMistakes: [
        'Concatenating untrusted user input into child_process.exec() strings.',
        'Using exec() for commands that generate massive output (exceeds default 1MB maxBuffer and crashes).'
      ]
    },
    quickRevision: {
      takeaways: [
        'spawn = streaming, memory-safe, ideal for large outputs and external binaries.',
        'exec = shell-based, buffers into memory (vulnerable to command injection).',
        'execFile = invokes executable directly without a shell.',
        'fork = specialized spawn for Node.js modules with built-in IPC channel.'
      ],
      oneLineDefinition:
        'The child_process module spawns independent operating system processes to execute external commands and binaries with full memory isolation.',
      interviewTip:
        'Know the comparison cold: Worker Threads = multiple threads in 1 process; Cluster = multiple Node processes sharing a port; Child Processes = running external commands/binaries.'
    }
  }
];
