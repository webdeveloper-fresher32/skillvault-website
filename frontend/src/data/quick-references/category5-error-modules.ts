import { QuickReferenceTopic } from './types';

export const category5ErrorModules: QuickReferenceTopic[] = [
  {
    id: 'error-handling',
    number: 24,
    title: 'Error Handling',
    category: 'Error Handling and Modules',
    categorySlug: 'error-modules',
    estimatedMinutes: 5,
    concept30Sec:
      'JavaScript error handling uses try/catch/finally blocks, Error instances, and Promise rejection chains. In Node.js, errors are categorized into Operational Errors (predictable runtime failures like invalid inputs or network timeouts) and Programmer Errors (bugs, syntax errors, or null pointer dereferences). Robust Node.js backends centralize error handling and fail fast on unrecoverable state.',
    internals: {
      overview:
        'When an error is thrown, V8 captures the current call stack via Error.captureStackTrace and begins stack unwinding, searching up active execution contexts for an enclosing try/catch block. If no catch block is found across the synchronous call stack, the error reaches the host environment (Node.js). In Node.js, uncaught synchronous exceptions emit "uncaughtException", while unhandled promise rejections emit "unhandledRejection" (which crashes the process in Node.js 15+).',
      flowSteps: [
        'Throw: throw new Error() instantiates an Error object and captures the call stack.',
        'Stack Unwinding: V8 searches frames upwards for the nearest catch block.',
        'finally: Always executes regardless of whether an error was thrown or caught.',
        'Asynchronous Rejections: Must be handled via .catch() or async/await try/catch. A traditional synchronous try/catch cannot catch errors thrown inside a delayed callback.',
        'Process-Level Safety: Catch unhandled events on process; log stack trace and perform graceful shutdown.'
      ],
      diagram: `NODE.JS ERROR HANDLING ARCHITECTURE:
[ Request in Route Handler ]
             |
   (Thrown Exception)
             |
             v
   +-------------------+
   | try / catch block |  ---> Operational Error? (e.g. 404, 400)
   +-------------------+        |--> Return structured JSON error response
             |                  |--> Do NOT crash the process
       (If Uncaught)
             v
+-----------------------------+
| process.on('uncaughtEx')    | ---> Programmer Bug / Corrupted Memory!
+-----------------------------+        |--> Log fatal stack trace
                                       |--> Close DB connections / release ports
                                       |--> process.exit(1) & process manager restarts!`
    },
    codeExample: {
      code: `// 1. Custom Operational AppError Class
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 2. Centralized Error Handling in Controller
async function processRefund(orderId, amount) {
  if (!orderId) {
    throw new AppError('Order ID is required', 400); // Operational error
  }
  if (amount <= 0) {
    throw new AppError('Refund amount must be positive', 422); // Operational error
  }

  // Simulated DB / Gateway call
  return { success: true, refunded: amount };
}

async function handleRequest() {
  try {
    await processRefund(null, 50);
  } catch (err) {
    if (err instanceof AppError && err.isOperational) {
      console.log(\`[Operational Error \${err.statusCode}]: \${err.message}\`);
    } else {
      console.error('[Critical Bug]:', err.stack);
      // Trigger alerts, graceful process exit if necessary
    }
  } finally {
    console.log('Cleanup: finally block executed.');
  }
}

handleRequest();`,
      language: 'javascript',
      output: `[Operational Error 400]: Order ID is required
Cleanup: finally block executed.`,
      whyOutput:
        'processRefund validates input and throws a typed AppError with status 400 and isOperational=true. The catch block inspects isOperational, handles it gracefully without crashing, and the finally block executes guaranteed cleanup.',
      annotations: [
        'Line 2: AppError custom class encapsulates HTTP status code and operational flag.',
        'Line 7: Error.captureStackTrace omits the constructor from the stack trace for clean logs.',
        'Line 28: Distinguishing operational errors from fatal programmer bugs.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Centralized Express Error Middleware & Graceful Shutdown on Fatal Errors',
      description:
        'Express 4/5 features a 4-argument error middleware (err, req, res, next). All operational errors are passed to next(err) and translated into consistent JSON responses. If an unhandledException occurs, the Node.js process is considered corrupted: the service must close server listeners, release database pools, and exit with code 1 so Docker/Kubernetes restarts it cleanly.',
      codeSnippet: `// 1. Express 4-argument error middleware
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal Server Error';
  res.status(status).json({ success: false, error: message });
});

// 2. Fatal Process Crash Handler
process.on('uncaughtException', (err) => {
  logger.fatal('UNCAUGHT EXCEPTION! Initiating graceful restart...', err);
  server.close(() => process.exit(1)); // Allow PM2/Kubelet to restart
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the difference between Operational Errors and Programmer Errors in Node.js?',
          spokenAnswer:
            'Operational errors are predictable, known runtime failures that occur in healthy programs (e.g., validation failure, socket timeout, 404 not found, database constraint error); they should be handled gracefully without restarting the process. Programmer errors are actual code bugs (e.g., syntax errors, reading properties of undefined, failed assertions); they leave the process memory in an unpredictable state and require logging and an immediate graceful restart.'
        },
        {
          question: 'Why MUST you restart a Node.js process on an uncaughtException?',
          spokenAnswer:
            'When an uncaughtException occurs, JavaScript code failed in an unhandled state. The application\'s memory and resources (like open database transactions, leaked file handles, and corrupted state) may be unstable. Continuing to run risks serving corrupt data to other users. The official Node.js recommendation is to log the error, release resources, and exit so process supervisors (Docker/PM2) can start a fresh instance.'
        }
      ],
      trickyFollowUp: {
        question: 'What happens if a promise rejection is never caught in Node.js 16+?',
        answer:
          'In Node.js 15+, unhandled promise rejections default to the "throw" mode. If not caught, an unhandledRejection emits an uncaughtException and terminates the Node.js process with a non-zero exit code.'
      },
      commonMistakes: [
        'Swallowing errors with empty catch blocks ("catch (e) {}"), hiding production outages.',
        'Catching uncaughtException and continuing to run the service without restarting.',
        'Assuming try/catch can catch errors thrown inside asynchronous callback timers.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Operational errors = predictable runtime issues; handle gracefully.',
        'Programmer errors = bugs; log and restart the process.',
        'finally block runs 100% of the time, even if return/throw occurs in try/catch.',
        'Centralize error handling with Express (err, req, res, next) middleware.'
      ],
      oneLineDefinition:
        'Error handling is the structured mechanism to capture, categorize, and resolve runtime failures, separating recoverable operational errors from process-terminating bugs.',
      interviewTip:
        'Always frame your answer around the Operational vs Programmer errors distinction—it is the hallmark of a senior Node.js developer.'
    }
  },

  {
    id: 'es-modules-vs-commonjs',
    number: 25,
    title: 'ES Modules vs CommonJS',
    category: 'Error Handling and Modules',
    categorySlug: 'error-modules',
    estimatedMinutes: 5,
    concept30Sec:
      'CommonJS (CJS) and ES Modules (ESM) are the two module systems in JavaScript. CommonJS uses require() and module.exports; it is synchronous and evaluated dynamically at runtime. ES Modules use import and export; it is asynchronous, statically analyzable at compile time, supports tree-shaking, and provides live bindings instead of value copies.',
    internals: {
      overview:
        'CJS loads modules synchronously: require() reads the file from disk, executes it inside a wrapper function, caches the result in require.cache, and returns a copy of module.exports. ESM runs in three distinct spec phases: 1) Construction (parses files into AST, builds the module dependency graph statically); 2) Instantiation (allocates memory slots for all exports as live pointers); 3) Evaluation (executes code to fill those slots). Because ESM is static, tools can eliminate unused code (Tree-Shaking).',
      flowSteps: [
        'CommonJS: Runtime, synchronous, dynamic loading. module.exports exports a shallow copy of values.',
        'ES Modules: 3 Phases: Construction (Parse & Graph) -> Instantiation (Live Binding Pointers) -> Evaluation (Code Execution).',
        'Live Bindings in ESM: Mutating an exported variable in module A automatically updates the imported value in module B in real time (impossible in CJS).',
        'Top-Level Await: Supported natively in ESM; forbidden at the root of CJS modules.'
      ],
      diagram: `COMMONJS vs ES MODULES:
COMMONJS:
require('./math')  ===> Synchronous Disk Read + Execution ===> Returns copied object

ES MODULES:
Phase 1: Construction (Static Dependency Graph built before any code runs)
Phase 2: Instantiation (Memory slots linked via Live Pointers)
Phase 3: Evaluation (Execute code; live bindings update dynamically)`
    },
    comparisonTable: {
      headers: ['Feature', 'CommonJS (CJS)', 'ES Modules (ESM)'],
      rows: [
        ['Syntax', 'require() / module.exports', 'import / export'],
        ['Loading Phase', 'Runtime (dynamic, synchronous)', 'Compile-time / Pre-execution (static, async)'],
        ['Bindings', 'Value copy (shallow snapshot)', 'Live Bindings (read-only reference to original)'],
        ['Tree-Shaking', 'Difficult / Not natively supported', 'Fully supported due to static analysis'],
        ['Top-Level Await', 'No (requires async IIFE wrapper)', 'Yes (native support)'],
        ['Special Identifiers', '__dirname, __filename, require', 'import.meta.url (must derive path manually)'],
        ['Circular Dependencies', 'Returns partially evaluated exports', 'Safely handles live references']
      ]
    },
    codeExample: {
      code: `// --- ES MODULES: Demonstrating Live Bindings ---
// In counter.mjs:
// export let count = 0;
// export function increment() { count++; }

// In main.mjs:
// import { count, increment } from './counter.mjs';
// console.log(count); // 0
// increment();
// console.log(count); // 1 (Live binding updated!)

// --- COMMONJS: Value Copy vs ESM Live Binding Simulation ---
const cjsModule = {
  count: 0,
  increment() {
    this.count++;
  }
};

let importedCount = cjsModule.count; // Copies value (0)
cjsModule.increment();
console.log('CJS copied value:', importedCount); // 0 (Does NOT update!)
console.log('CJS source value:', cjsModule.count); // 1

// --- ESM __dirname replacement in Node.js ---
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('ESM Current File:', __filename.split('/').pop());`,
      language: 'javascript',
      output: `CJS copied value: 0
CJS source value: 1
ESM Current File: quickReferencesData.ts`,
      whyOutput:
        'In CommonJS, requiring a primitive exports a copied value; mutating the source does not update the importer\'s variable. In ESM, imports are live read-only bindings to the exporting module\'s memory slot. In ESM, __dirname does not exist and must be derived using import.meta.url.',
      annotations: [
        'Line 19: CJS exports snapshot values, causing desynchronization if primitives are modified.',
        'Line 20: ESM live bindings eliminate this problem by linking memory slots directly.',
        'Line 27: ESM replaces __dirname with fileURLToPath(import.meta.url).'
      ]
    },
    nodeJsApplication: {
      scenario: 'Dual-Package Hazard, Package.json "type": "module", and Dynamic import()',
      description:
        'Modern Node.js projects are transitioning to ESM ("type": "module" in package.json). However, importing an ESM package from a CJS file requires dynamic import() (const pkg = await import("pkg")). Senior developers must also watch for the Dual-Package Hazard, where an app accidentally loads both CJS and ESM versions of the same library, duplicating singleton instances (e.g. database connections).',
      codeSnippet: `// 1. Loading ESM module inside a CommonJS file:
async function loadEsmTool() {
  const { default: chalk } = await import('chalk');
  console.log(chalk.green('ESM loaded dynamically inside CJS!'));
}

// 2. Package.json configuration for ESM:
// {
//   "name": "api-service",
//   "type": "module",
//   "exports": "./src/index.js"
// }`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What does "Live Bindings" mean in ES Modules?',
          spokenAnswer:
            'Live Bindings means that imported variables in ESM are not static copies, but live pointers to the memory location in the exporting module. If the exporting module updates the exported variable, the importer sees the new value immediately. However, the importer cannot reassign the imported variable (it is read-only for the importer).'
        },
        {
          question: 'Why does Tree-Shaking work in ESM but not in CommonJS?',
          spokenAnswer:
            'Tree-shaking relies on static analysis. Because ESM imports and exports are static and must appear at the top level of the file, bundlers can parse the AST and determine exactly which functions are used or unused before executing any code. In CommonJS, require() is dynamic and can be placed inside "if" conditions or called with dynamic string variables at runtime, making static dependency pruning impossible.'
        }
      ],
      trickyFollowUp: {
        question: 'Can you use require() inside an ES Module in Node.js?',
        answer:
          'Not by default ("require is not defined"). However, you can create a require function using Node\'s native module helper: import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'
      },
      commonMistakes: [
        'Using __dirname or __filename directly in an ES Module (throws ReferenceError: __dirname is not defined).',
        'Attempting to synchronously require an ESM module in CommonJS without dynamic await import().'
      ]
    },
    quickRevision: {
      takeaways: [
        'CommonJS = runtime, synchronous, dynamic, copied values.',
        'ES Modules = compile-time, static, asynchronous, live bindings.',
        'ESM supports Tree-Shaking and Top-Level Await.',
        'ESM replaces __dirname with fileURLToPath(import.meta.url).'
      ],
      oneLineDefinition:
        'CommonJS is Node\'s legacy synchronous runtime module system, whereas ES Modules is the modern ECMAScript standard featuring static analysis, live bindings, and asynchronous loading.',
      interviewTip:
        'Highlight the two killer differences: 1) Static analysis (enables tree-shaking); 2) Live bindings (pointers instead of value copies).'
    }
  }
];
