import { QuickReferenceTopic, ComparisonTable } from './types';

const COMBINATORS_COMPARISON_TABLE: ComparisonTable = {
  headers: ['Combinator', 'Settles When', 'Short-Circuits?', 'Failure Behavior', 'Return Value on Success', 'Key Real-World Use Case'],
  rows: [
    [
      'Promise.all()',
      'All fulfill OR first rejects',
      'Yes, on first rejection',
      'Rejects immediately with first error (in-flight tasks still run!)',
      'Array of resolved values in input order',
      'Transactional workflows where all parts must succeed (e.g. order checkout)'
    ],
    [
      'Promise.allSettled()',
      'All promises settle (never short-circuits)',
      'No, waits for every promise',
      'Never rejects; reports rejections inside status objects',
      'Array of objects: { status: "fulfilled"|"rejected", value|reason }',
      'Batch background operations, bulk notifications, independent data collection'
    ],
    [
      'Promise.race()',
      'First promise settles (either fulfilled OR rejected)',
      'Yes, on first settlement',
      'Rejects immediately if first settled promise rejects',
      'Value or reason of the first settled promise',
      'Request timeouts (racing an API fetch against a timer promise)'
    ],
    [
      'Promise.any()',
      'First promise fulfills OR all reject',
      'Yes, on first fulfillment',
      'Ignores rejections until ALL fail, then rejects with AggregateError',
      'Value of the first successfully fulfilled promise',
      'Fastest replica query, CDN fallback, multi-DNS provider queries'
    ]
  ]
};

export const asyncCategory3Combinators: QuickReferenceTopic[] = [
  {
    id: 'async-promise-all',
    number: 8,
    title: 'Promise.all()',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Promise Combinators',
    categorySlug: 'promise-combinators',
    estimatedMinutes: 5,
    concept30Sec:
      'Promise.all() accepts an iterable of promises and returns a single Promise that fulfills with an array of results in the original input order once ALL input promises have fulfilled. It operates on an "all-or-nothing" principle: if ANY input promise rejects, the returned promise immediately rejects with that first rejection reason.',
    internals: {
      overview:
        'Promise.all tracks an internal counter (remainingElementsCount) initialized to the iterable length, and an array of results. When each promise fulfills, its value is saved at its exact input index, and the counter is decremented. When the counter hits 0, the master promise fulfills. However, if ANY promise rejects, Promise.all triggers its onReject handler immediately. CRITICAL: Rejecting does NOT cancel or abort the other ongoing operations—they continue executing in the background!',
      flowSteps: [
        '1. Input Processing: Iterates over the iterable; non-promise values are converted via Promise.resolve().',
        '2. Counter Initialization: Sets remainingElementsCount = promises.length.',
        '3. Concurrent Subscriptions: Subscribes .then(onFulfill, onReject) to each promise simultaneously.',
        '4. Success Path: Each fulfillment stores value at its respective index and decrements remainingElementsCount by 1.',
        '5. Complete Resolution: When remainingElementsCount reaches 0, the returned promise fulfills with the results array.',
        '6. Short-Circuit Rejection: If any promise rejects, the returned promise immediately rejects with that error. (In-flight promises still execute!).'
      ],
      diagram: `PROMISE.ALL() EXECUTION FLOW:

   P1 (100ms) -------------> [ Value 1 ] ---------\\
   P2 (50ms)  -----> [ Value 2 ] -----------------> [ Array: [Val1, Val2, Val3] ]
   P3 (150ms) -----------------------> [ Value 3 ] / (Fulfills when ALL finish)

   FAILURE SHORT-CIRCUIT:
   P1 (100ms) -------------> (Still running in background...)
   P2 (30ms)  ---> [ ERROR! ] ===> Promise.all REJECTS IMMEDIATELY with Error!
   P3 (150ms) -----------------------> (Still running in background...)`
    },
    codeExample: {
      code: `async function fetchDashboardData(userId) {
  const p1 = Promise.resolve('User Profile');
  const p2 = new Promise((resolve) => setTimeout(() => resolve(['Order #1', 'Order #2']), 20));
  const p3 = new Promise((resolve) => setTimeout(() => resolve({ unread: 3 }), 10));

  console.time('fetchDashboardData');
  // Runs all 3 queries concurrently
  const [profile, orders, notifications] = await Promise.all([p1, p2, p3]);
  console.timeEnd('fetchDashboardData');

  console.log('Results in exact order:');
  console.log({ profile, orders, notifications });
}

fetchDashboardData('usr_100');`,
      language: 'javascript',
      output: `fetchDashboardData: ~21ms
Results in exact order:
{
  profile: 'User Profile',
  orders: [ 'Order #1', 'Order #2' ],
  notifications: { unread: 3 }
}`,
      whyOutput:
        'All three promises run in parallel. p1 finishes instantly, p3 finishes in 10ms, and p2 finishes in 20ms. Total execution time is ~20ms (max of the three, rather than sequential sum of 30ms). The output array strictly preserves the input array positions regardless of completion order.'
    },
    nodeJsApplication: {
      scenario: 'Aggregating Microservice Data for API Gateways',
      description:
        'In an API Gateway, an endpoint requires data from auth, billing, and inventory services simultaneously. Promise.all fetches all three concurrently, cutting API latency from additive (sum of 3 latencies) to bounded (maximum of the 3).',
      codeSnippet: `app.get('/api/orders/:id/summary', async (req, res, next) => {
  try {
    const { id } = req.params;
    // Parallel fan-out
    const [order, customer, tracking] = await Promise.all([
      orderServiceClient.getOrder(id),
      customerServiceClient.getCustomer(req.user.id),
      shippingServiceClient.getTracking(id)
    ]);

    res.json({ order, customer, tracking });
  } catch (err) {
    // If any service fails, fail the aggregated request
    next(err);
  }
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What happens to other pending promises when one promise rejects in Promise.all()?',
          spokenAnswer:
            'When one promise rejects, Promise.all immediately short-circuits and rejects with that first error. However, JavaScript does NOT cancel or abort the other running promises. They continue executing in the background, consuming CPU, network, or database resources. If you need cancellation, you must combine Promise.all with AbortController.'
        },
        {
          question: 'Is the order of elements in the resolved array guaranteed to match the input order in Promise.all()?',
          spokenAnswer:
            'Yes, absolutely. The resolved array order is strictly guaranteed to match the order of the input iterable, regardless of the completion order or execution time of the individual promises.'
        }
      ],
      trickyFollowUp: {
        question: 'What happens if you pass an empty array to Promise.all([])?',
        answer:
          'Promise.all([]) returns an already-fulfilled Promise with an empty array []. Furthermore, unlike passing non-empty arrays, resolving an empty array occurs synchronously according to the specification.'
      },
      commonMistakes: [
        'Believing that Promise.all cancels remaining operations when one fails: pending HTTP requests or DB writes continue running.',
        'Passing promises inside an async function inside map without awaiting Promise.all, leading to unhandled background promises.',
        'Using Promise.all for independent background tasks where partial success is acceptable: use Promise.allSettled() instead.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Promise.all() fulfills when ALL input promises fulfill, returning results in original input order.',
        'Short-circuits immediately on the FIRST rejection.',
        'Does NOT cancel in-flight operations upon rejection; use AbortController for active cancellation.'
      ],
      oneLineDefinition:
        'Promise.all is an all-or-nothing combinator that fulfills with an ordered array when all promises succeed, or rejects immediately on the first failure.',
      interviewTip:
        'Always volunteer that short-circuiting does not abort background work—interviews love testing this nuance.',
      keyDistinction:
        'Promise.all vs Promise.allSettled: Promise.all fails fast on first error; Promise.allSettled waits for all promises regardless of success or failure.'
    },
    comparisonTable: COMBINATORS_COMPARISON_TABLE
  },
  {
    id: 'async-promise-allsettled',
    number: 9,
    title: 'Promise.allSettled()',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Promise Combinators',
    categorySlug: 'promise-combinators',
    estimatedMinutes: 5,
    concept30Sec:
      'Promise.allSettled() accepts an iterable of promises and returns a Promise that fulfills once ALL input promises have settled (either fulfilled or rejected). Unlike Promise.all(), it NEVER rejects. It returns an array of outcome objects describing whether each promise fulfilled or rejected, along with its value or reason.',
    internals: {
      overview:
        'Promise.allSettled maintains a settlement counter equal to the input length. It attaches handlers to both onFulfill and onReject of each input promise. When a promise resolves, it writes { status: "fulfilled", value } into the output array. When a promise rejects, it writes { status: "rejected", reason } into the output array. The returned master promise only fulfills when every single input promise has completed.',
      flowSteps: [
        '1. Initialization: Creates results array and remainingCount = promises.length.',
        '2. Dual Handlers: Subscribes to both fulfillment and rejection for each promise.',
        '3. Fulfillment Capture: Writes { status: "fulfilled", value: val } at corresponding index.',
        '4. Rejection Capture: Writes { status: "rejected", reason: err } at corresponding index.',
        '5. Decrement & Check: Decrements counter on each settlement.',
        '6. Master Settlement: When counter reaches 0, fulfills master promise with the structured outcomes array. Never rejects.'
      ],
      diagram: `PROMISE.ALLSETTLED() OUTCOME STRUCTURE:

   P1 (Success) -------> { status: 'fulfilled', value: userObj }
   P2 (Fails) ---------> { status: 'rejected',  reason: Error('Timeout') }
   P3 (Success) -------> { status: 'fulfilled', value: statsObj }
                            |
                            v
   Master Promise Fulfills (Never Rejects!):
   [
     { status: 'fulfilled', value: userObj },
     { status: 'rejected',  reason: [Error: Timeout] },
     { status: 'fulfilled', value: statsObj }
   ]`
    },
    codeExample: {
      code: `async function sendBulkNotifications(userIds, message) {
  const promises = userIds.map((id) => {
    if (id === 'bad_user') {
      return Promise.reject(new Error(\`User \${id} unsubscribed\`));
    }
    return Promise.resolve(\`Notification delivered to \${id}\`);
  });

  const results = await Promise.allSettled(promises);

  const successful = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  const failed = results
    .filter((r) => r.status === 'rejected')
    .map((r) => r.reason.message);

  console.log('Delivered count:', successful.length);
  console.log('Failed errors:', failed);
}

sendBulkNotifications(['user_1', 'bad_user', 'user_3'], 'Maintenance update');`,
      language: 'javascript',
      output: `Delivered count: 2
Failed errors: [ 'User bad_user unsubscribed' ]`,
      whyOutput:
        'Even though sending to bad_user rejected, Promise.allSettled did not abort the other notifications. It waited for all 3 to finish, returning an array with 2 fulfilled items and 1 rejected item. The caller partitions them cleanly into successes and failures.'
    },
    nodeJsApplication: {
      scenario: 'Bulk Operations, Email Dispatches, and Independent Health Checks',
      description:
        'When sending thousands of push notifications or running cluster health checks across 20 downstream services, you never want 1 failed service to cancel or obscure the health reports of the remaining 19. Promise.allSettled enables robust partial-success handling.',
      codeSnippet: `app.get('/health/detailed', async (req, res) => {
  const services = [checkDatabase(), checkRedis(), checkKafka(), checkPaymentGateway()];
  const checks = await Promise.allSettled(services);

  const healthReport = checks.map((c, i) => ({
    service: ['Database', 'Redis', 'Kafka', 'Payments'][i],
    status: c.status === 'fulfilled' ? 'UP' : 'DOWN',
    details: c.status === 'fulfilled' ? c.value : c.reason.message
  }));

  const isDegraded = checks.some((c) => c.status === 'rejected');
  res.status(isDegraded ? 207 : 200).json({ degraded: isDegraded, services: healthReport });
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'When should you choose Promise.allSettled() over Promise.all()?',
          spokenAnswer:
            'Use Promise.allSettled() when your asynchronous operations are independent and you want to know the outcome of every operation, even if some fail. Examples include sending bulk marketing emails, running independent microservice health checks, or cleaning up multiple resources. Use Promise.all() when the operations are interdependent and a single failure invalidates the entire transaction.'
        },
        {
          question: 'Can Promise.allSettled() ever reject?',
          spokenAnswer:
            'No, Promise.allSettled() never rejects, provided that an iterable is passed. Even if every single input promise rejects, the returned master promise fulfills with an array of { status: "rejected", reason } objects. It only throws synchronously if you pass an invalid non-iterable argument.'
        }
      ],
      trickyFollowUp: {
        question: 'How do you extract TypeScript types cleanly when dealing with Promise.allSettled results?',
        answer:
          'TypeScript models the result as PromiseSettledResult<T>[], which is a discriminated union of PromiseFulfilledResult<T> and PromiseRejectedResult. By checking if (result.status === "fulfilled"), TypeScript automatically type-narrows the object so result.value is accessible without type errors.'
      },
      commonMistakes: [
        'Attempting to access result.value directly without checking result.status === "fulfilled", which causes runtime undefined errors on rejected promises.',
        'Wrapping Promise.allSettled in an unnecessary try/catch expecting it to throw when promises fail.',
        'Using Promise.allSettled for atomic database transactions where any failure requires a complete abort.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Promise.allSettled() waits for ALL promises to settle; it NEVER rejects.',
        'Returns an array of { status: "fulfilled", value } or { status: "rejected", reason } in input order.',
        'Ideal for bulk operations, independent health checks, and partial-success scenarios.'
      ],
      oneLineDefinition:
        'Promise.allSettled is a combinator that waits for all promises to finish and returns their individual settlement statuses, never rejecting.',
      interviewTip:
        'Mention "graceful degradation": Promise.allSettled is the cornerstone of robust fault-tolerant microservice architectures.',
      keyDistinction:
        'Promise.all vs Promise.allSettled: Promise.all requires total success; Promise.allSettled accommodates partial failures.'
    },
    comparisonTable: COMBINATORS_COMPARISON_TABLE
  },
  {
    id: 'async-promise-race',
    number: 10,
    title: 'Promise.race()',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Promise Combinators',
    categorySlug: 'promise-combinators',
    estimatedMinutes: 5,
    concept30Sec:
      'Promise.race() accepts an iterable of promises and settles (fulfills or rejects) as soon as the FIRST promise settles, with the value or reason from that promise. Whichever promise finishes first—whether it succeeds or fails—determines the outcome.',
    internals: {
      overview:
        'Promise.race attaches its resolve and reject handlers directly to every promise in the iterable. The first promise to settle immediately invokes the master resolution or rejection procedure, permanently locking the master state. Just like Promise.all(), the losing promises are NOT aborted or stopped—they continue running in the background until completion.',
      flowSteps: [
        '1. Iteration: Loops through input promises and coerces values via Promise.resolve().',
        '2. Parallel Handlers: Hooks master resolve and reject directly to each promise.',
        '3. First Settlement: The fastest promise settles (e.g., at 15ms).',
        '4. Master Settlement: Master promise immediately fulfills with the winner value OR rejects with the winner error.',
        '5. Loser Continuations: Slower promises still execute their underlying I/O or timers to completion.'
      ],
      diagram: `PROMISE.RACE() EXECUTION:

   Operation 1 (Fast: 20ms) ------> [ Resolves "Winner" ] ====> Master Promise Fulfills with "Winner"
   Operation 2 (Slow: 100ms) ---------------------------> (Still runs in background!)
   Operation 3 (Slow: 500ms) -------------------------------------------------> (Still runs!)

   REJECTION WINNER:
   Operation A (20ms) -----------> [ Rejects Error("Fail") ] ==> Master Promise REJECTS with "Fail"
   Operation B (100ms) ----------------------------------------> (Loses race, still runs in background)`
    },
    codeExample: {
      code: `// Implementing an asynchronous timeout wrapper using Promise.race
function withTimeout(promise, timeoutMs) {
  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(\`Operation timed out after \${timeoutMs}ms\`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise])
    .finally(() => {
      // Clear timeout to prevent Node.js timer from keeping event loop alive!
      clearTimeout(timerId);
    });
}

// Fast operation: finishes before timeout
const fastOp = new Promise((res) => setTimeout(() => res('Data loaded'), 50));
withTimeout(fastOp, 200).then((res) => console.log('Fast result:', res));

// Slow operation: triggers timeout rejection
const slowOp = new Promise((res) => setTimeout(() => res('Slow data'), 500));
withTimeout(slowOp, 100).catch((err) => console.error('Slow result:', err.message));`,
      language: 'javascript',
      output: `Fast result: Data loaded
Slow result: Operation timed out after 100ms`,
      whyOutput:
        'In the first race, fastOp finishes in 50ms, beating the 200ms timer. The race resolves and clears the timer. In the second race, the 100ms timer rejects before slowOp completes at 500ms, causing withTimeout to reject immediately.'
    },
    nodeJsApplication: {
      scenario: 'Enforcing Strict SLA Timeouts on External Webhooks',
      description:
        'When calling third-party payment gateways or webhooks, upstream services enforce strict 2-second SLAs. Racing the outgoing HTTP request against a timer promise prevents unresponsive third parties from exhausting the Node.js connection pool.',
      codeSnippet: `async function queryPaymentGatewayWithSLA(paymentPayload) {
  const controller = new AbortController();
  const timeoutMs = 2500;

  const timeoutPromise = new Promise((_, reject) => {
    const id = setTimeout(() => {
      controller.abort(); // Cancel the actual network socket!
      reject(new Error('Gateway SLA breach: 2500ms exceeded'));
    }, timeoutMs);
  });

  return Promise.race([
    fetch('https://api.stripe.com/v1/charges', {
      method: 'POST',
      body: JSON.stringify(paymentPayload),
      signal: controller.signal
    }),
    timeoutPromise
  ]);
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the primary difference between Promise.race() and Promise.any()?',
          spokenAnswer:
            'Promise.race() settles on the FIRST settled promise, whether it is fulfilled OR rejected. If the fastest promise rejects, Promise.race() rejects immediately. In contrast, Promise.any() settles on the first FULFILLED promise, completely ignoring rejections until ALL promises have failed.'
        },
        {
          question: 'What is a critical operational trap when using Promise.race() for network timeouts?',
          spokenAnswer:
            'The critical trap is that Promise.race() only ignores the losing promises; it does NOT stop or abort them. If an HTTP request loses the race to a timeout, the underlying TCP socket remains open and continues downloading data in the background unless you explicitly combine it with an AbortController signal to terminate the network connection.'
        }
      ],
      trickyFollowUp: {
        question: 'What happens if you pass an empty array to Promise.race([])?',
        answer:
          'Promise.race([]) returns a Promise that remains PENDING FOREVER! Because there are no promises to settle first, neither resolve nor reject is ever called, potentially causing memory leaks if retained.'
      },
      commonMistakes: [
        'Passing an empty array Promise.race([]) and creating a promise that hangs forever.',
        'Assuming Promise.race() cancels the slower promises: they keep executing in the background.',
        'Using Promise.race() when you want the fastest successful response (use Promise.any() instead).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Promise.race() settles as soon as the FIRST promise settles (fulfilled OR rejected).',
        'Promise.race([]) hangs forever in pending state.',
        'Does not cancel losing operations: always pair with AbortController for network requests.'
      ],
      oneLineDefinition:
        'Promise.race settles with the outcome (value or error) of the very first promise that settles, regardless of success or failure.',
      interviewTip:
        'Highlight the forever-pending trap of passing an empty array Promise.race([]), as interviewers use this to test spec knowledge.',
      keyDistinction:
        'Promise.race vs Promise.any: Promise.race resolves or rejects on first settlement; Promise.any resolves on first fulfillment.'
    },
    comparisonTable: COMBINATORS_COMPARISON_TABLE
  },
  {
    id: 'async-promise-any',
    number: 11,
    title: 'Promise.any()',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Promise Combinators',
    categorySlug: 'promise-combinators',
    estimatedMinutes: 5,
    concept30Sec:
      'Promise.any() accepts an iterable of promises and fulfills as soon as ANY of the input promises fulfills, with the value of that first successful promise. If all input promises reject, it rejects with an AggregateError containing all the individual rejection reasons.',
    internals: {
      overview:
        'Promise.any tracks an internal array of errors and a rejection counter initialized to the input length. If any promise fulfills, the master promise fulfills immediately, ignoring all other pending or rejected promises. If a promise rejects, its error is stored at its corresponding index and the rejection counter decrements. If the counter reaches 0 (all promises failed), the master promise rejects with a new AggregateError.',
      flowSteps: [
        '1. Subscription: Registers handlers on all input promises concurrently.',
        '2. First Fulfillment: The first promise to fulfill immediately resolves the master promise with that value.',
        '3. Rejection Absorption: Individual rejections are collected into an errors array without failing the master promise.',
        '4. Error Counting: Increments failed counter upon each rejection.',
        '5. Complete Failure Check: If all promises reject, throws AggregateError(errors, "All promises were rejected").',
        '6. Empty Array Behavior: Promise.any([]) immediately rejects with an empty AggregateError.'
      ],
      diagram: `PROMISE.ANY() EXECUTION (FIRST SUCCESS WINS):

   P1 (Fails: 10ms)  ----> [ Error 1 ] (Ignored! Waiting for success...)
   P2 (Fulfills: 30ms) --> [ SUCCESS: "Mirror B" ] ====> Master Promise Fulfills with "Mirror B"!
   P3 (Fails: 40ms)  ----> (Ignored)

   ALL PROMISES REJECT:
   P1 (Fails) ---> [ Err 1 ]
   P2 (Fails) ---> [ Err 2 ] ====> Rejects with AggregateError([Err 1, Err 2, Err 3])
   P3 (Fails) ---> [ Err 3 ]`
    },
    codeExample: {
      code: `async function fetchFromFastestMirror() {
  const mirrorA = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Mirror A: 503 Overloaded')), 20)
  );
  const mirrorB = new Promise((resolve) =>
    setTimeout(() => resolve('Mirror B: Package binary v2.4.0'), 50)
  );
  const mirrorC = new Promise((resolve) =>
    setTimeout(() => resolve('Mirror C: Package binary v2.4.0'), 100)
  );

  try {
    // Fulfills with Mirror B because it is the fastest SUCCESSFUL promise!
    const data = await Promise.any([mirrorA, mirrorB, mirrorC]);
    console.log('Successfully downloaded from:', data);
  } catch (err) {
    if (err instanceof AggregateError) {
      console.error('All mirrors failed:', err.errors);
    }
  }
}

fetchFromFastestMirror();`,
      language: 'javascript',
      output: `Successfully downloaded from: Mirror B: Package binary v2.4.0`,
      whyOutput:
        'Mirror A rejected in 20ms, but Promise.any ignored the failure and kept waiting. Mirror B fulfilled in 50ms, so Promise.any immediately fulfilled with Mirror B result, winning over Mirror C (100ms).'
    },
    nodeJsApplication: {
      scenario: 'High-Availability Multi-Region Endpoints and CDN Redundancy',
      description:
        'In critical financial microservices or package registries, queries are sent simultaneously to multiple replicas (US-East, US-West, EU-Central). Promise.any returns the result from the fastest responsive healthy region while absorbing transient regional network outages.',
      codeSnippet: `async function queryMultiRegionFastest(query) {
  const regions = [
    'https://us-east.api.domain.internal/data',
    'https://us-west.api.domain.internal/data',
    'https://eu-central.api.domain.internal/data'
  ];

  try {
    const fastestResponse = await Promise.any(
      regions.map(url => fetch(url + query).then(res => {
        if (!res.ok) throw new Error(\`Region \${url} failed with \${res.status}\`);
        return res.json();
      }))
    );
    return fastestResponse;
  } catch (err) {
    logger.critical('All cloud regions failed!', { errors: (err as AggregateError).errors });
    throw new ServiceUnavailableException('All regional replicas unreachable');
  }
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What happens when all promises passed to Promise.any() reject?',
          spokenAnswer:
            'When all promises reject, Promise.any() rejects with an AggregateError. An AggregateError is a standard JavaScript Error subclass whose .errors property contains an array of all individual rejection reasons in the original input order.'
        },
        {
          question: 'What is the difference between Promise.any([]) and Promise.all([]) with empty arrays?',
          spokenAnswer:
            'Promise.all([]) fulfills immediately with an empty array []. In contrast, Promise.any([]) immediately rejects with an AggregateError because zero promises were fulfilled.'
        }
      ],
      trickyFollowUp: {
        question: 'Is Promise.any() the exact inverse of Promise.all()?',
        answer:
          'Yes, conceptually: Promise.all fulfills when all fulfill and short-circuits on the first rejection. Promise.any fulfills on the first fulfillment and rejects only when all reject.'
      },
      commonMistakes: [
        'Expecting Promise.any to reject when the fastest promise fails: it ignores failures until ALL have failed.',
        'Forgetting that Promise.any([]) rejects with an AggregateError rather than resolving.',
        'Not checking err instanceof AggregateError when catching errors, leading to missing individual failure reasons.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Promise.any() fulfills as soon as ANY promise fulfills (first success wins).',
        'Ignores rejections until ALL promises reject, then throws AggregateError.',
        'Promise.any([]) rejects immediately with AggregateError.'
      ],
      oneLineDefinition:
        'Promise.any fulfills with the first successfully resolved promise, or rejects with an AggregateError if every promise fails.',
      interviewTip:
        'Highlight AggregateError and its .errors array property to demonstrate full modern ES2021 compliance.',
      keyDistinction:
        'Promise.any vs Promise.race: Promise.any waits for the first SUCCESS; Promise.race settles on the first SETTLEMENT regardless of success or failure.'
    },
    comparisonTable: COMBINATORS_COMPARISON_TABLE
  }
];
