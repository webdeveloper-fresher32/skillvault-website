import { QuickReferenceTopic } from './types';

export const asyncCategory4ErrorHandling: QuickReferenceTopic[] = [
  {
    id: 'async-error-handling',
    number: 12,
    title: 'Error Handling with try/catch',
    section: 'Asynchronous Programming',
    sectionSlug: 'async',
    category: 'Asynchronous Error Handling',
    categorySlug: 'async-error-handling-cat',
    estimatedMinutes: 5,
    concept30Sec:
      'Asynchronous error handling bridges the gap between synchronous exceptions and asynchronous rejections. While synchronous try/catch cannot catch errors across callback boundaries, async/await restores standard try/catch semantics by suspending execution and catching rejected promises directly in the local scope.',
    internals: {
      overview:
        'When an error is thrown inside an async function or a promise rejects, V8 converts the exception into a rejected Promise. If awaited, the engine unwinds the async coroutine to the nearest enclosing try/catch block. If no try/catch catches the rejection, the error bubbles up. If left unhandled by any Promise consumer, Node.js triggers the process "unhandledRejection" event, which in modern Node.js terminates the process by default with exit code 1.',
      flowSteps: [
        '1. Synchronous vs Async Catch: Synchronous try/catch fails for callbacks because the call stack unwinds before the callback fires.',
        '2. Await Catch Mechanism: await p checks [[PromiseState]]; if "rejected", V8 throws the [[PromiseResult]] into the active execution context.',
        '3. Try/Catch Interception: The catch (err) block receives the rejected error as an ordinary JavaScript Error instance.',
        '4. Async Throw Conversion: Any throw inside an async function is automatically converted into Promise.reject(err).',
        '5. Unhandled Detection: If a rejected promise has no rejection handler attached within a microtask turn, Node.js marks it as unhandled.',
        '6. Process Termination: Modern Node.js (Node 15+) terminates the process upon unhandledRejection to prevent corrupted server state.'
      ],
      diagram: `ASYNC ERROR PROPAGATION & UNHANDLED REJECTIONS:

   async function fetchOrder()
   +-------------------------------------------------------------+
   | try {                                                       |
   |   const res = await apiCall(); // Rejects with Error('500') |
   | } catch (err) {                                             |
   |   // CAUGHT: try/catch works seamlessly with await!         |
   | }                                                           |
   +-------------------------------------------------------------+

   WITHOUT AWAIT OR CATCH (THE CRASH PATH):
   apiCall(); // Promise rejects unhandled!
       |
       v
   V8 detects no rejection handler in microtask turn
       |
       v
   Node.js triggers: process.emit('unhandledRejection', reason, p)
       |
       v
   Default Node.js 15+ Behavior: Process crashes with EXIT CODE 1!`
    },
    codeExample: {
      code: `import express from 'express';

// 1. Throwing inside async function automatically returns Promise.reject()
async function validateUser(user) {
  if (!user.email) {
    throw new Error('ValidationFailed: Email is required');
  }
  return true;
}

// 2. Safe async route handler wrapper (prevents unhandled rejections)
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const app = express();

app.post('/users', asyncHandler(async (req, res) => {
  await validateUser(req.body);
  res.status(201).json({ success: true });
}));

// 3. Centralized Express Error Handling Middleware (4 parameters!)
app.use((err, req, res, next) => {
  console.error('Centralized Logger:', err.stack);
  res.status(err.message.startsWith('Validation') ? 400 : 500).json({
    error: {
      message: err.message,
      timestamp: new Date().toISOString()
    }
  });
});`,
      language: 'javascript',
      output: `// If req.body is empty:
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "message": "ValidationFailed: Email is required",
    "timestamp": "2026-11-18T18:25:00.000Z"
  }
}`,
      whyOutput:
        'validateUser throws an error. Because it is an async function, the throw converts to a rejected Promise. The asyncHandler catches the rejection and forwards it to next(err). Express routes the error directly to the 4-argument centralized error middleware, returning a clean 400 JSON response.'
    },
    nodeJsApplication: {
      scenario: 'Production Process Resilience and Crash Prevention',
      description:
        'Senior engineers install global process handlers for unhandledRejection and uncaughtException to log stack traces to telemetry systems (Datadog/Sentry) and gracefully shut down HTTP listeners before restarting via Docker or Kubernetes.',
      codeSnippet: `// Global Process Safety Net
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('Unhandled Promise Rejection detected!', { reason, promise });
  // Graceful shutdown: stop taking traffic, drain pool, exit
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  logger.fatal('Uncaught Exception! Process state corrupted.', { err });
  process.exit(1); // Never attempt to keep running after uncaughtException!
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Why does traditional try/catch fail to catch errors in asynchronous callbacks?',
          spokenAnswer:
            'Traditional try/catch only catches errors that occur synchronously on the active call stack. When an asynchronous callback executes, the event loop has already popped the original calling function and its try/catch block off the stack. Therefore, errors thrown inside the callback are orphaned and become unhandled exceptions.'
        },
        {
          question: 'What is the modern Node.js default behavior for unhandled promise rejections?',
          spokenAnswer:
            'Starting with Node.js 15, the default unhandled-rejections mode is "throw". When an unhandled rejection occurs, Node.js emits an unhandledRejection event, prints a fatal exception stack trace, and exits the process with a non-zero code (exit code 1). This was changed to prevent processes from running in corrupted, indeterminate states.'
        }
      ],
      trickyFollowUp: {
        question: 'Why should you never write "return promise" without "await" inside a try/catch block?',
        answer:
          'If you write return promise; without await inside a try/catch block, the promise is returned immediately to the caller in its pending state. If that promise later rejects, the rejection occurs OUTSIDE the local try/catch block, completely bypassing your error handling logic! You must write return await promise; to ensure local catch blocks execute.'
      },
      commonMistakes: [
        'Writing return promise; instead of return await promise; inside a try/catch block, bypassing the catch statement.',
        'Not passing errors to next(err) in Express route handlers, causing hanging requests on errors in Express 4.',
        'Swallowing errors silently with empty catch (err) {} blocks without logging or metrics.',
        'Attempting to resume server operations after an uncaughtException: Node memory is now indeterminate.'
      ]
    },
    quickRevision: {
      takeaways: [
        'async/await allows standard try/catch to capture asynchronous promise rejections.',
        'Inside try/catch, always write return await promise;, never return promise;.',
        'Node.js 15+ crashes the process on unhandled promise rejections by default.',
        'Centralized Express error middleware requires exactly 4 arguments: (err, req, res, next).'
      ],
      oneLineDefinition:
        'Asynchronous error handling uses try/catch with await or .catch() to intercept rejections before they trigger fatal unhandledRejection process crashes.',
      interviewTip:
        'Highlight why "return await p" inside try/catch is essential for error scoping—it is an instant signal of senior Node.js mastery.',
      keyDistinction:
        'uncaughtException vs unhandledRejection: uncaughtException originates from synchronous throws outside try/catch; unhandledRejection originates from unsettled promises without .catch().'
    }
  }
];
