import { QuickReferenceTopic } from './types';

export const asyncCategory5Concurrency: QuickReferenceTopic[] = [
  {
    id: 'async-sequential-vs-parallel',
    number: 13,
    title: 'Sequential vs Parallel Execution',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Concurrency and Execution Control',
    categorySlug: 'concurrency-control',
    estimatedMinutes: 5,
    concept30Sec:
      'Sequential execution runs asynchronous operations one after another in series, where each step waits for the previous one to complete. Parallel (concurrent) execution kicks off all asynchronous operations simultaneously and collects their results together, dramatically reducing total latency for independent tasks.',
    internals: {
      overview:
        'In sequential execution (e.g. for...of with await), the V8 coroutine suspends after each iteration. Total runtime equals the sum of all individual task latencies: T = t1 + t2 + ... + tn. In parallel execution (e.g. Promise.all(items.map(...))), all network sockets or libuv handles are initialized on the same tick. The OS manages them concurrently in kernel space. Total runtime equals the maximum latency: T = max(t1, t2, ..., tn).',
      flowSteps: [
        '1. Sequential Loop (for...of): Task 1 dispatched -> awaits response -> resumes -> Task 2 dispatched -> awaits response.',
        '2. Parallel Fan-out (.map + Promise.all): Iterates array synchronously -> creates N pending promises -> dispatches N I/O requests immediately.',
        '3. Kernel Overlap: The operating system handles all TCP sockets or disk reads simultaneously.',
        '4. Memory Tradeoff: Parallel execution uses more memory (N active closures/buffers simultaneously) compared to sequential (1 buffer at a time).',
        '5. Dependency Rule: Use Sequential when task B strictly depends on the result of task A. Use Parallel when tasks are independent.'
      ],
      diagram: `SEQUENTIAL VS PARALLEL EXECUTION TIMELINES:

Sequential (Total Time = 300ms):
Task 1 (100ms) [========]
Task 2 (100ms)          [========]
Task 3 (100ms)                   [========]

Parallel / Concurrent (Total Time = 100ms):
Task 1 (100ms) [========]
Task 2 (100ms) [========]
Task 3 (100ms) [========]`
    },
    codeExample: {
      code: `const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const tasks = [100, 100, 100]; // 3 tasks taking 100ms each

// 1. Sequential Execution: O(N) Total Time = ~300ms
async function runSequential() {
  console.time('Sequential');
  const results = [];
  for (const ms of tasks) {
    await delay(ms);
    results.push(ms);
  }
  console.timeEnd('Sequential');
  return results;
}

// 2. Parallel Execution: O(max) Total Time = ~100ms
async function runParallel() {
  console.time('Parallel');
  const results = await Promise.all(tasks.map(async (ms) => {
    await delay(ms);
    return ms;
  }));
  console.timeEnd('Parallel');
  return results;
}

await runSequential();
await runParallel();`,
      language: 'javascript',
      output: `Sequential: ~302ms
Parallel: ~101ms`,
      whyOutput:
        'runSequential awaits each delay sequentially, taking 100ms + 100ms + 100ms = ~300ms. runParallel maps all items into promises on the same tick, allowing libuv timers to tick down simultaneously, finishing in ~100ms total.'
    },
    nodeJsApplication: {
      scenario: 'Multi-Service Hydration in BFF (Backend-For-Frontend) Architecture',
      description:
        'When building GraphQL resolvers or REST endpoints that hydrate user profiles, cart items, loyalty points, and recommendation feeds, executing independent queries in parallel via Promise.all reduces round-trip customer latency from 800ms down to 200ms.',
      codeSnippet: `// High-Performance BFF Aggregator
async function getHomeScreenData(userId) {
  // Independent data queries fired concurrently
  const [profile, recommendations, cart, notifications] = await Promise.all([
    userService.getProfile(userId),
    recsService.getTopPicks(userId),
    cartService.getActiveCart(userId),
    notifyService.getUnread(userId)
  ]);

  return { profile, recommendations, cart, notifications };
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Why does using await inside an Array.prototype.forEach loop fail to run sequentially or wait for completion?',
          spokenAnswer:
            'forEach is a synchronous higher-order function that does not expect or await the promise returned by an async callback. It invokes all callbacks synchronously without awaiting them, meaning forEach completes immediately while the asynchronous operations continue running in the background. To execute sequentially, use a standard for...of loop or for loop.'
        },
        {
          question: 'When should you intentionally prefer sequential execution over parallel execution?',
          spokenAnswer:
            'Prefer sequential execution in two scenarios: 1) Data dependencies, where the output of task A is required to initiate task B (e.g. creating an order, getting the order ID, then charging the credit card); and 2) Rate-limited or resource-constrained environments where parallel execution would overwhelm a third-party API or exhaust database connection pools.'
        }
      ],
      trickyFollowUp: {
        question: 'What happens if you run 50,000 requests in parallel using Promise.all(urls.map(fetch))?',
        answer:
          'You will crash the Node.js process with an EMFILE (too many open files/sockets) error or cause out-of-memory (heap exhaustion). Furthermore, downstream databases or APIs will rate-limit or drop your traffic. You must use controlled concurrency (such as a concurrency pool or queue) rather than unbounded Promise.all.'
      },
      commonMistakes: [
        'Using await inside forEach and expecting the loop to pause.',
        'Awaiting independent database queries sequentially, inflating response times by 3x-5x.',
        'Unbounded parallelism: firing thousands of promises via Promise.all simultaneously without concurrency limits.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Sequential: for...of with await. Runtime = sum of latencies. Use when tasks depend on previous results.',
        'Parallel: Promise.all with .map. Runtime = maximum latency. Use for independent operations.',
        'forEach does NOT await async callbacks; never use await inside forEach.'
      ],
      oneLineDefinition:
        'Sequential execution processes async tasks in series with additive latency; parallel execution runs independent tasks concurrently with bounded latency.',
      interviewTip:
        'Emphasize the danger of unbounded Promise.all(): explain that production code requires concurrency pooling to protect memory and file descriptors.',
      keyDistinction:
        'for...of await vs Promise.all: for...of awaits each item one by one; Promise.all fires all promises simultaneously.'
    }
  },
  {
    id: 'async-concurrency-limits',
    number: 14,
    title: 'Promise Concurrency Limits',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Concurrency and Execution Control',
    categorySlug: 'concurrency-control',
    estimatedMinutes: 5,
    concept30Sec:
      'Promise concurrency limiting is the practice of constraining the number of simultaneously active asynchronous operations to a fixed threshold (e.g. at most 5 concurrent tasks). It prevents memory exhaustion, file descriptor leaks, database connection pool starvation, and external API rate-limiting.',
    internals: {
      overview:
        'Unbounded parallelism (e.g. Promise.all on 10,000 items) allocates 10,000 TCP sockets and closures simultaneously, triggering EMFILE or ENOTFOUND errors. A concurrency pool maintains an internal worker pool of size K. Exactly K workers pull tasks from a shared iterator/queue. As soon as any worker completes a task, it immediately picks the next task from the queue, maintaining an exact concurrency window of K until all tasks are finished.',
      flowSteps: [
        '1. Task Iterator: Tasks are represented as an iterator or index pointer over a task generator array.',
        '2. Worker Spawning: Exactly K worker functions (e.g., K = 5) are launched concurrently.',
        '3. Work Pulling: Each worker continuously loops: pops the next task from the iterator, awaits its execution, and saves the result.',
        '4. Self-Replenishing Pipeline: When task 1 finishes on worker A, worker A immediately starts task K+1 without waiting for workers B, C, D.',
        '5. Order Preservation: Results are stored in an array indexed by their original task position.',
        '6. Completion: Promise.all([worker1, worker2, ...workerK]) resolves when the shared iterator is exhausted and all workers idle.'
      ],
      diagram: `CONCURRENCY LIMIT POOL (Limit = 3, Tasks = 6):

Queue: [ Task 4, Task 5, Task 6 ]
-----------------------------------------
Worker 1: [ Task 1 (Running) ] =====> Finishes -> Immediately grabs Task 4
Worker 2: [ Task 2 (Running) ]
Worker 3: [ Task 3 (Running) ]
-----------------------------------------
Active concurrency is NEVER greater than 3!
Memory and socket usage remain strictly bounded.`
    },
    codeExample: {
      code: `// Senior Production Pattern: Zero-dependency Promise Concurrency Limiter
async function promisePool(tasks, limit) {
  const results = new Array(tasks.length);
  let currentIndex = 0;

  // Worker coroutine: pulls tasks until queue is empty
  async function worker() {
    while (currentIndex < tasks.length) {
      const index = currentIndex++;
      try {
        results[index] = await tasks[index]();
      } catch (err) {
        results[index] = err;
      }
    }
  }

  // Spawn exactly 'limit' workers in parallel
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// Example: Process 10 tasks with concurrency limit of 3
const tasks = Array.from({ length: 10 }, (_, i) => async () => {
  console.log(\`Start task \${i + 1}\`);
  await new Promise((res) => setTimeout(res, 20));
  console.log(\`Done task \${i + 1}\`);
  return \`Result \${i + 1}\`;
});

console.time('Pool Execution');
const results = await promisePool(tasks, 3);
console.timeEnd('Pool Execution');
console.log('Processed total:', results.length);`,
      language: 'javascript',
      output: `Start task 1
Start task 2
Start task 3
Done task 1
Start task 4
Done task 2
Start task 5
...
Pool Execution: ~80ms
Processed total: 10`,
      whyOutput:
        'Initially, tasks 1, 2, and 3 start simultaneously. When task 1 finishes, that worker immediately pulls task 4. At no point are more than 3 tasks running at the same time. All 10 tasks complete in bounded batches, preserving order in the returned results array.'
    },
    nodeJsApplication: {
      scenario: 'Bulk Image Processing and S3 Upload Pipeline',
      description:
        'Uploading 5,000 resized user avatars to AWS S3. Firing all 5,000 uploads concurrently exhausts socket pools and triggers AWS 503 SlowDown errors. Running sequentially takes hours. A concurrency limit of 50 processes the batch optimally in parallel without exceeding bandwidth or socket quotas.',
      codeSnippet: `import pLimit from 'p-limit'; // Popular enterprise implementation

const limit = pLimit(25); // Cap concurrent S3 uploads at 25

async function uploadCatalogImages(imageFiles) {
  const uploadPromises = imageFiles.map((file) => {
    return limit(async () => {
      const buffer = await fs.promises.readFile(file.path);
      return s3Client.putObject({ Bucket: 'assets', Key: file.name, Body: buffer });
    });
  });

  return Promise.all(uploadPromises);
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Why is unbounded Promise.all() considered a dangerous anti-pattern in production Node.js services?',
          spokenAnswer:
            'Unbounded Promise.all() initializes all promises immediately on the same tick. If passed an array of thousands of items, it attempts to open thousands of file descriptors and TCP sockets at once, exhausting operating system limits (EMFILE errors) and overwhelming downstream databases with connection spikes. Production systems must throttle concurrency using a pool or queue.'
        },
        {
          question: 'How does a promise pool worker loop maintain a steady concurrency limit?',
          spokenAnswer:
            'A promise pool initializes a fixed number (N) of worker coroutines that share a task iterator or index counter. Each worker loops: it pops the next task function, awaits its completion, and records the result. Because workers only fetch the next task after the previous one finishes, exactly N tasks remain active concurrently.'
        }
      ],
      trickyFollowUp: {
        question: 'How do you handle errors inside a promise concurrency pool without aborting the other tasks?',
        answer:
          'Inside the worker loop, wrap the task execution in a try/catch block. Instead of letting the rejection throw, catch it and store the Error object in the results array (or record it in a separate failures list). This mirrors Promise.allSettled behavior while enforcing the concurrency cap.'
      },
      commonMistakes: [
        'Chunking arrays with lodash.chunk and awaiting each chunk sequentially: this creates artificial pauses where workers sit idle waiting for the slowest task in the chunk to finish (the "head-of-line" blocking problem).',
        'Passing already-invoked promises to a limiter: the promises have already started! You must pass task factories (() => Promise).',
        'Not setting timeouts on pooled tasks, causing a single hanging task to permanently occupy a worker slot.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Concurrency limiting prevents socket exhaustion, EMFILE errors, and database connection pool starvation.',
        'Worker-based promise pool dynamically fills worker slots as soon as any task finishes, avoiding chunk idle time.',
        'Always pass task factory functions (() => Promise), not already-instantiated promises.'
      ],
      oneLineDefinition:
        'Promise concurrency limits cap the number of in-flight asynchronous operations to a safe threshold using a worker queue or pool.',
      interviewTip:
        'Contrast worker-based pools with batching/chunking: worker pools eliminate idle time by replenishing slots immediately.',
      keyDistinction:
        'Batching (Chunking) vs Worker Pool: Batching waits for the slowest task in each chunk before starting the next; Worker pools replenish individual slots continuously.'
    }
  }
];
