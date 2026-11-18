import { QuickReferenceTopic } from './types';

export const asyncCategory7CancellationResilience: QuickReferenceTopic[] = [
  {
    id: 'async-abort-controller',
    number: 17,
    title: 'Cancellation with AbortController',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Cancellation and Resilience',
    categorySlug: 'cancellation-resilience',
    estimatedMinutes: 5,
    concept30Sec:
      'AbortController is the standard ECMAScript and Node.js interface for cooperative cancellation of asynchronous operations. It pairs a controller (which triggers abort()) with an AbortSignal object, allowing network requests, file streams, child processes, and custom async workflows to be cancelled cleanly without resource leaks.',
    internals: {
      overview:
        'When an AbortController is instantiated, it owns an AbortSignal instance with internal slots: aborted (boolean) and reason (any error or DOMException). When controller.abort(reason) is called, signal.aborted becomes true, signal.reason is assigned, and the signal dispatches an "abort" event. Downstream subscribers (like fetch or fs.promises) immediately close their underlying OS file descriptors or TCP sockets and reject their active promises with an AbortError.',
      flowSteps: [
        '1. Instantiation: const controller = new AbortController(); pass { signal: controller.signal } to async API.',
        '2. Listener Attachment: The async API attaches an internal listener: signal.addEventListener("abort", onAbort).',
        '3. Signal Fired: Application calls controller.abort(new Error("User cancelled")).',
        '4. Hardware Disconnection: For fetch, Node.js immediately destroys the underlying TCP socket and cancels TLS handshake.',
        '5. Promise Rejection: The pending promise rejects with an AbortError (or the custom reason).',
        '6. Convenience API: Node 18+ provides AbortSignal.timeout(ms) for automatic timeout signals without manual timer management.'
      ],
      diagram: `ABORTCONTROLLER CANCELLATION FLOW:

   App Context                      Node.js / libuv Kernel Socket
   +-------------------+            +----------------------------+
   |  AbortController  |            |  Active TCP Socket         |
   |   .signal --------+----------> |   - Listening for 'abort'  |
   +-------------------+            +----------------------------+
             |                                    |
     controller.abort()                           |
             |                                    v
             +============================> Socket DESTROYED!
                                                  |
                                                  v
                                    Promise rejects with AbortError`
    },
    codeExample: {
      code: `// 1. Modern Timeout Cancellation using AbortSignal.timeout (Node 18+)
async function fetchWithNativeTimeout(url, timeoutMs) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs) // Auto-aborts after timeoutMs!
    });
    return await response.json();
  } catch (err) {
    if (err.name === 'TimeoutError') {
      console.error(\`Request timed out after \${timeoutMs}ms\`);
    } else {
      console.error('Fetch failed:', err.message);
    }
  }
}

// 2. Manual Cooperative Cancellation in Custom Async Loops
async function processLargeBatch(items, signal) {
  for (let i = 0; i < items.length; i++) {
    // Cooperative check: check if caller cancelled before expensive step
    if (signal?.aborted) {
      throw signal.reason || new Error('Operation aborted');
    }
    await new Promise((res) => setTimeout(res, 10)); // simulate work
    console.log(\`Processed item \${i + 1}\`);
  }
}

const controller = new AbortController();
setTimeout(() => controller.abort(new Error('User navigated away')), 25);
processLargeBatch([1, 2, 3, 4, 5], controller.signal).catch((err) => {
  console.log('Batch stopped:', err.message);
});`,
      language: 'javascript',
      output: `Processed item 1
Processed item 2
Batch stopped: User navigated away`,
      whyOutput:
        'The batch loop processed items 1 and 2. After 25ms, controller.abort() fired. On iteration 3, signal.aborted was true, throwing the abort reason immediately and preventing unnecessary processing of items 3, 4, and 5.'
    },
    nodeJsApplication: {
      scenario: 'Cleaning Up Downstream Requests on Client Disconnect',
      description:
        'When an HTTP client (browser or mobile app) cancels a request or closes the connection, the incoming req object in Express/Fastify emits a "close" event. Wiring req.socket to an AbortController cancels all ongoing downstream database queries and microservice calls immediately, saving database compute.',
      codeSnippet: `app.get('/api/heavy-export', async (req, res, next) => {
  const controller = new AbortController();

  // If client disconnects or closes browser tab, abort downstream work!
  req.on('close', () => {
    if (!res.writableEnded) {
      controller.abort(new Error('Client disconnected prematurely'));
    }
  });

  try {
    const report = await analyticsService.generateExport({
      userId: req.user.id,
      signal: controller.signal // Passed to DB & storage APIs
    });
    res.json(report);
  } catch (err) {
    next(err);
  }
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Why is AbortController superior to using Promise.race() for implementing network request timeouts?',
          spokenAnswer:
            'Promise.race() only ignores the slower promise; it does NOT abort the underlying network connection. The HTTP request and TCP socket remain open in the background, consuming socket handles, server bandwidth, and database connections. In contrast, AbortController sends a real abort signal that immediately destroys the underlying OS socket handle and cancels the request at the network transport layer.'
        },
        {
          question: 'What is AbortSignal.any() and when is it useful?',
          spokenAnswer:
            'Added in modern JavaScript and Node.js 20, AbortSignal.any(signals) combines multiple abort signals into one. The returned signal aborts if ANY of the input signals aborts. This allows you to combine an explicit user cancellation signal with an automatic timeout signal (e.g. AbortSignal.any([userController.signal, AbortSignal.timeout(5000)])).'
        }
      ],
      trickyFollowUp: {
        question: 'What is the default error thrown when AbortSignal.timeout() aborts versus controller.abort()?',
        answer:
          'AbortSignal.timeout() aborts with a DOMException named "TimeoutError". A manual controller.abort() without arguments aborts with a DOMException named "AbortError". If you pass an argument controller.abort(customReason), signal.reason is that exact custom value.'
      },
      commonMistakes: [
        'Relying on Promise.race for timeouts and accidentally leaking uncancelled network sockets.',
        'Not checking signal.aborted inside long-running CPU loops or generator pipelines.',
        'Forgetting that Node.js core APIs like fs.promises, child_process, and http.request all support the signal option.'
      ]
    },
    quickRevision: {
      takeaways: [
        'AbortController provides true socket-level cooperative cancellation for fetch, fs, and child processes.',
        'Use AbortSignal.timeout(ms) for clean declarative timeouts without manual setTimeout cleanup.',
        'Use AbortSignal.any([sig1, sig2]) to combine multiple cancellation conditions.'
      ],
      oneLineDefinition:
        'AbortController is the standard interface for safely cancelling in-flight asynchronous operations and releasing underlying OS sockets.',
      interviewTip:
        'Contrast AbortController with Promise.race(): AbortController actively tears down the TCP socket handle in kernel space.',
      keyDistinction:
        'Promise.race() vs AbortController: Promise.race ignores the loser; AbortController actively terminates the underlying socket/stream.'
    }
  },
  {
    id: 'async-retry-mechanisms',
    number: 18,
    title: 'Retry Mechanisms',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Cancellation and Resilience',
    categorySlug: 'cancellation-resilience',
    estimatedMinutes: 5,
    concept30Sec:
      'A retry mechanism automatically re-executes failed asynchronous operations to overcome transient faults. Retries must strictly be applied only to transient errors (network drops, rate limits, 503s), never to permanent errors (400 validation, 404 not found), and must enforce idempotency to prevent duplicate mutations.',
    internals: {
      overview:
        'Distributed systems experience transient network partitions, temporary downstream service restarts, and momentary load spikes. A naive retry loop retries blindly, creating a "Retry Storm" that pushes an already struggling downstream service into total collapse. A resilient retry mechanism requires: 1) Error classification (transient vs permanent); 2) Max retry budget; 3) Idempotency keys; and 4) Exponential backoff with jitter.',
      flowSteps: [
        '1. Attempt Execution: Execute target async operation with an attempt counter.',
        '2. Success: Return result immediately; reset attempt counter.',
        '3. Error Interception: Catch thrown error and classify error type.',
        '4. Classification Check: If error is Permanent (HTTP 400/401/403/404/422), fail immediately; do NOT retry.',
        '5. Transient Check: If error is Transient (HTTP 429, 503, 504, ECONNRESET, ETIMEDOUT), check attempt < maxAttempts.',
        '6. Budget Enforcement: If budget exceeded, throw RetryExhaustedError; otherwise delay with backoff and retry.'
      ],
      diagram: `RETRY DECISION MATRIX:

Caught Error:
       |
       +---> Permanent Error (400, 401, 403, 404, 422)?
       |        |
       |        +===> DO NOT RETRY -> Throw immediately to caller!
       |
       +---> Transient Error (429, 502, 503, 504, ECONNRESET)?
                |
                v
             Attempt < MaxRetries?
                |
                +---> YES: Delay with Backoff + Jitter -> Retry!
                +---> NO:  Throw ExhaustedError (Prevent Retry Storm)`
    },
    codeExample: {
      code: `// Resilient Error Classifier
function isTransientError(err) {
  // Network connection drops or DNS timeouts
  if (['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err.code)) {
    return true;
  }
  // Transient HTTP Status Codes: 429 (Rate Limit), 502, 503, 504
  if (err.status === 429 || (err.status >= 502 && err.status <= 504)) {
    return true;
  }
  return false;
}

// Production Retry Wrapper with Idempotency Key
async function retryOperation(fn, maxAttempts = 3, baseDelayMs = 50) {
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      return await fn();
    } catch (err) {
      if (!isTransientError(err) || attempt >= maxAttempts) {
        throw err; // Permanent error or budget exhausted: fail immediately!
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(\`Attempt \${attempt} failed (\${err.message}). Retrying in \${delay}ms...\`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

// Example usage
let calls = 0;
retryOperation(async () => {
  calls++;
  if (calls < 3) {
    const err = new Error('503 Service Unavailable');
    err.status = 503;
    throw err;
  }
  return 'Order processed successfully';
}).then(console.log);`,
      language: 'javascript',
      output: `Attempt 1 failed (503 Service Unavailable). Retrying in 50ms...
Attempt 2 failed (503 Service Unavailable). Retrying in 100ms...
Order processed successfully`,
      whyOutput:
        'The operation failed twice with transient 503 errors. The classifier identified them as retryable, applying exponential delays (50ms, 100ms). On attempt 3, the operation succeeded and returned the final value.'
    },
    nodeJsApplication: {
      scenario: 'Payment Processing and External API Idempotency Keys',
      description:
        'Retrying non-idempotent operations (like charging a credit card or creating an order) without an idempotency key can cause double billing if the server processed the charge but the network dropped during the response. Sending an Idempotency-Key header guarantees the payment gateway safely deduplicates the request.',
      codeSnippet: `import { randomUUID } from 'node:crypto';

async function chargeCustomerSafely(customerId, amountCents) {
  // Generate a unique idempotency key per checkout attempt
  const idempotencyKey = randomUUID();

  return retryOperation(async () => {
    const res = await fetch('https://api.stripe.com/v1/charges', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${process.env.STRIPE_SECRET}\`,
        'Idempotency-Key': idempotencyKey, // Stripe prevents double charges!
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ customer: customerId, amount: amountCents })
    });

    if (!res.ok) {
      const err = new Error(\`Payment failed with HTTP \${res.status}\`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  });
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is a "Retry Storm" and how do you prevent it in microservice architectures?',
          spokenAnswer:
            'A retry storm occurs when a downstream service becomes degraded or slow, causing hundreds of upstream client instances to all retry failed requests repeatedly at the same time. This multiplied traffic overwhelms and completely crashes the downstream service. You prevent retry storms by: 1) Limiting maximum retry attempts (typically 2-3); 2) Adding randomized jitter to backoff delays; and 3) Implementing Circuit Breakers that short-circuit retries when failure rates cross a threshold.'
        },
        {
          question: 'Why is it critical to enforce Idempotency when retrying HTTP requests?',
          spokenAnswer:
            'Because a network failure does not mean the downstream server did not process the request; it only means the client did not receive the response. If you retry a POST request (such as /charge or /create-order) without an idempotency key, the server may process the mutation a second time, resulting in double billing or duplicated records.'
        }
      ],
      trickyFollowUp: {
        question: 'Should you retry on HTTP 429 Too Many Requests, and if so, how?',
        answer:
          'Yes, HTTP 429 is a transient rate-limit error, but you must NEVER retry it immediately. You must inspect the response "Retry-After" header. If present, delay exactly for the duration specified by the server (in seconds or an HTTP date) before attempting the next request.'
      },
      commonMistakes: [
        'Retrying permanent 400 Bad Request or 404 Not Found errors, creating useless log spam and wasted CPU.',
        'Retrying without exponential backoff and jitter, triggering synchronized retry spikes.',
        'Retrying mutating POST requests without idempotency keys, risking duplicate actions.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Retry ONLY transient errors (429, 503, ECONNRESET); NEVER retry permanent errors (400, 401, 404).',
        'Always attach an Idempotency-Key to mutating POST requests to prevent double-execution.',
        'Enforce a strict retry budget (2-3 attempts) to avoid amplifying outages into retry storms.'
      ],
      oneLineDefinition:
        'A retry mechanism automatically re-executes transiently failed operations within a bounded attempt budget while guaranteeing idempotency.',
      interviewTip:
        'Categorize errors explicitly into transient vs permanent before discussing retry loops: this shows immediate production maturity.',
      keyDistinction:
        'Transient vs Permanent Errors: Transient errors (network drop, 503) resolve over time; Permanent errors (400 validation, 404) will never succeed on retry.'
    }
  },
  {
    id: 'async-exponential-backoff',
    number: 19,
    title: 'Exponential Backoff',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Cancellation and Resilience',
    categorySlug: 'cancellation-resilience',
    estimatedMinutes: 5,
    concept30Sec:
      'Exponential backoff is an algorithm that increases the delay between consecutive retry attempts exponentially ($t = \\text{base} \\times 2^{\\text{attempt}}$). Adding randomness (Jitter) is vital to decorrelate client retry attempts, preventing synchronized waves of traffic known as the Thundering Herd problem.',
    internals: {
      overview:
        'Without jitter, if 1,000 clients fail at time T = 0 and use pure exponential backoff (e.g. 1s, 2s, 4s), all 1,000 clients retry together at T = 1s, fail again, and hit the server together at T = 3s. This is the "Thundering Herd" problem. By adding Full Jitter ($t_{\\text{actual}} = \\text{Math.random()} \\times t_{\\text{exponential}}$), retries are uniformly distributed across the delay interval, smoothing the traffic curve and allowing downstream services to recover.',
      flowSteps: [
        '1. Base Delay & Max Cap: Define baseDelayMs (e.g. 100ms) and maxDelayMs (e.g. 5000ms).',
        '2. Calculate Raw Backoff: rawDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt)).',
        '3. Apply Full Jitter: jitteredDelay = Math.floor(Math.random() * rawDelay).',
        '4. Respect Retry-After: If downstream HTTP response headers contain Retry-After, use that value instead.',
        '5. Sleep: await new Promise(resolve => setTimeout(resolve, jitteredDelay)).',
        '6. Uniform Distribution: Clustered failing clients are dispersed over the entire delay window.'
      ],
      diagram: `THUNDERING HERD (NO JITTER) VS SMOOTHED (FULL JITTER):

Without Jitter (All clients retry at EXACTLY the same millisecond):
Load Spike:  ||||||||||                     ||||||||||
Time:        0ms                           1000ms (Server re-crashes!)

With Full Jitter (Retries spread randomly across time window):
Load Curve:  |  |   | |  |   |  |   |  |   |  |  |  |  |  |
Time:        0ms .......... Uniform spread .......... 1000ms (Server recovers!)`
    },
    codeExample: {
      code: `// Senior Production Pattern: Exponential Backoff with Full Jitter & Retry-After
function calculateBackoffDelay(attempt, baseDelay = 100, maxDelay = 3000, retryAfterSeconds = null) {
  // 1. If server provided a Retry-After header, respect it!
  if (retryAfterSeconds != null) {
    return retryAfterSeconds * 1000;
  }

  // 2. Exponential growth: base * 2^attempt, capped at maxDelay
  const rawExponential = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));

  // 3. Full Jitter: Uniform random between 0 and rawExponential
  const jitteredDelay = Math.floor(Math.random() * rawExponential);
  return jitteredDelay;
}

// Simulating 5 retry delays with Full Jitter:
console.log('Simulated Jittered Delays:');
for (let attempt = 0; attempt < 5; attempt++) {
  const delay = calculateBackoffDelay(attempt, 100, 2000);
  console.log(\`Attempt \${attempt + 1}: Delay = \${delay}ms (Cap: \${Math.min(2000, 100 * 2 ** attempt)}ms)\`);
}`,
      language: 'javascript',
      output: `Simulated Jittered Delays:
Attempt 1: Delay = 42ms (Cap: 100ms)
Attempt 2: Delay = 118ms (Cap: 200ms)
Attempt 3: Delay = 352ms (Cap: 400ms)
Attempt 4: Delay = 671ms (Cap: 800ms)
Attempt 5: Delay = 1243ms (Cap: 1600ms)`,
      whyOutput:
        'Each attempt multiplies the upper bound by 2, capped at 2000ms. Applying Math.random() generates uniformly distributed delays within that bound, breaking synchronization across multiple client instances.'
    },
    nodeJsApplication: {
      scenario: 'Resilient HTTP Client for Downstream Microservice Calls',
      description:
        'Enterprise microservice gateways use resilient HTTP clients (combining fetch, AbortController, exponential backoff, and full jitter) to communicate with external APIs like AWS DynamoDB or OpenAI without cascading failures.',
      codeSnippet: `async function fetchWithResilience(url, options = {}, retries = 3) {
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(options.timeout || 3000)
      });

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = calculateBackoffDelay(attempt, 100, 3000, retryAfter ? Number(retryAfter) : null);
          if (attempt < retries) {
            await new Promise((res) => setTimeout(res, delay));
            attempt++;
            continue;
          }
        }
        throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
      }
      return await response.json();
    } catch (err) {
      if (attempt >= retries) throw err;
      attempt++;
      await new Promise((res) => setTimeout(res, calculateBackoffDelay(attempt)));
    }
  }
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is "Jitter" in the context of exponential backoff, and why is pure exponential backoff insufficient?',
          spokenAnswer:
            'Jitter is random noise added to the exponential delay interval. Pure exponential backoff increases delays exponentially, but all clients that failed at the same moment will calculate the identical delay and retry simultaneously in synchronized bursts. This creates the "Thundering Herd" problem, repeatedly overloading the recovering service. Jitter decorrelates client retries across a random spectrum, smoothing traffic into an even distribution.'
        },
        {
          question: 'What is the mathematical difference between Full Jitter and Equal Jitter?',
          spokenAnswer:
            'In Full Jitter, the delay is chosen uniformly between 0 and the exponential cap: sleep = random(0, min(maxDelay, base * 2^attempt)). In Equal Jitter, half the delay is guaranteed and the other half is randomized: sleep = (halfDelay) + random(0, halfDelay). AWS architecture benchmarks show that Full Jitter produces the lowest total service contention and shortest overall completion time.'
        }
      ],
      trickyFollowUp: {
        question: 'How should your client respond if the server returns an HTTP 429 response with a Retry-After header?',
        answer:
          'If the server returns a Retry-After header, the client MUST respect the server guidance and delay for that exact duration (or timestamp) rather than calculating its own exponential backoff. Retrying earlier than the server-specified Retry-After will result in immediate rejection.'
      },
      commonMistakes: [
        'Implementing exponential backoff without jitter, causing synchronized client retry storms.',
        'Not capping the maximum delay (maxDelayMs), leading to absurdly long retry delays (e.g. 2^15 seconds).',
        'Ignoring HTTP Retry-After response headers provided by rate-limited services.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Formula: base * 2^attempt, capped at maxDelay.',
        'Full Jitter: Math.random() * rawBackoff breaks synchronized retry waves (Thundering Herd).',
        'Always respect the HTTP Retry-After header when provided by downstream servers.'
      ],
      oneLineDefinition:
        'Exponential backoff doubles retry delays on successive failures, and jitter randomizes them to prevent synchronized server overload.',
      interviewTip:
        'Mention the AWS Architecture Blog benchmark on "Full Jitter vs Equal Jitter" to stand out as a top-tier systems engineer.',
      keyDistinction:
        'Pure Backoff vs Jittered Backoff: Pure backoff synchronizes retry bursts; Jittered backoff uniformly diffuses retry traffic across time.'
    }
  }
];
