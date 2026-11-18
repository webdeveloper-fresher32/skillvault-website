import { QuickReferenceTopic } from './types';

export const category1Fundamentals: QuickReferenceTopic[] = [
  {
    id: 'var-let-const',
    number: 1,
    title: 'var, let, const',
    category: 'JavaScript Fundamentals and Execution',
    categorySlug: 'fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'JavaScript provides three declaration keywords. "var" is function-scoped, hoisted, and initialized to undefined, allowing redeclaration. "let" and "const" are block-scoped and hoisted into the Temporal Dead Zone (TDZ) without initialization. "const" creates an immutable binding (the identifier cannot be reassigned), though properties of objects declared with const remain mutable.',
    internals: {
      overview:
        'During the compilation/creation phase, the V8 engine parses declarations into the Environment Record. "var" variables are bound to the VariableEnvironment and immediately initialized to undefined. "let" and "const" are registered in the LexicalEnvironment in an uninitialized state. Accessing an uninitialized binding triggers an internal engine trap throwing ReferenceError. const also sets an internal [[IsConstantDeclaration]] flag that causes any subsequent assignment expression to throw TypeError.',
      flowSteps: [
        'Creation Phase: var bindings allocated in VariableEnvironment and initialized to undefined.',
        'Creation Phase: let/const bindings allocated in LexicalEnvironment with UNINITIALIZED state (TDZ active).',
        'Execution Phase: Code runs line-by-line. When declaration line is evaluated, let/const becomes initialized with its value.',
        'Reassignment check: Any assignment to an identifier marked [[IsConstantDeclaration]] immediately throws TypeError.'
      ],
      diagram: `+-----------------------------------------------------------+
|                  V8 EXECUTION CONTEXT                     |
|                                                           |
|  VariableEnvironment (var):                               |
|    x -> initialized to "undefined" immediately            |
|                                                           |
|  LexicalEnvironment (let, const):                         |
|    y (let)   -> [UNINITIALIZED] (TDZ: access throws error)|
|    z (const) -> [UNINITIALIZED] (TDZ + Locked binding)    |
+-----------------------------------------------------------+`
    },
    comparisonTable: {
      headers: ['Feature', 'var', 'let', 'const'],
      rows: [
        ['Scope', 'Function scope', 'Block scope { ... }', 'Block scope { ... }'],
        ['Hoisting', 'Hoisted + initialized as undefined', 'Hoisted into TDZ (uninitialized)', 'Hoisted into TDZ (uninitialized)'],
        ['Re-declaration', 'Allowed in same scope', 'SyntaxError: already declared', 'SyntaxError: already declared'],
        ['Re-assignment', 'Allowed', 'Allowed', 'TypeError: Assignment to const'],
        ['Global Property', 'Attaches to global/window', 'Does NOT attach to global', 'Does NOT attach to global']
      ]
    },
    codeExample: {
      code: `function testVarLetConst() {
  console.log('var before decl:', a); // undefined (hoisted + initialized)
  // console.log(b); // ReferenceError: Cannot access 'b' before initialization

  var a = 10;
  let b = 20;
  const config = { port: 3000 };

  config.port = 8080; // Valid: mutating an object property
  console.log('config.port:', config.port);

  if (true) {
    var a = 99; // Re-declares function-scoped 'a'
    let b = 50; // Shadows outer 'b' inside this block only
  }

  console.log('var a after block:', a); // 99 (modified!)
  console.log('let b after block:', b); // 20 (unaffected!)
}

testVarLetConst();`,
      language: 'javascript',
      output: `var before decl: undefined
config.port: 8080
var a after block: 99
let b after block: 20`,
      whyOutput:
        '"var a" is function-scoped, so re-declaring it inside the "if" block mutates the exact same variable. "let b" is block-scoped, so the "if" block creates a separate lexical binding that vanishes when the block exits. "config" cannot be reassigned, but its internal properties can be mutated because const protects the memory reference, not object contents.',
      annotations: [
        'Line 2: var is initialized to undefined during creation phase.',
        'Line 9: Modifying an internal property of a const object is completely valid.',
        'Line 13: var ignores block boundaries ({ }), overwriting outer a.',
        'Line 14: let respects block boundaries, shadowing outer b safely.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Preventing Race Conditions & Global Leakage in Asynchronous Node.js Loops',
      description:
        'In asynchronous Node.js operations (such as processing an array of database queries or Kafka messages with timers/promises), using "var" creates a single shared variable binding across all iterations, leading to the classic bug where all callbacks receive the final loop value. "let" creates a new lexical binding per iteration, ensuring each asynchronous closure captures its own distinct value.',
      codeSnippet: `// BUGGY: Using var in async batch processing
for (var i = 0; i < 3; i++) {
  setImmediate(() => console.log('var iteration:', i)); // Prints: 3, 3, 3
}

// SAFE: Using let creates a fresh binding per iteration
for (let i = 0; i < 3; i++) {
  setImmediate(() => console.log('let iteration:', i)); // Prints: 0, 1, 2
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the fundamental difference between var, let, and const?',
          spokenAnswer:
            '"var" is function-scoped and hoisted with an initial value of undefined. "let" and "const" are block-scoped and hoisted into the Temporal Dead Zone in an uninitialized state. "const" additionally enforces an immutable binding, preventing reassignment of the variable identifier.'
        },
        {
          question: 'Does "const" make objects completely immutable in JavaScript?',
          spokenAnswer:
            'No. "const" prevents reassignment of the variable identifier to a new memory address. The internal contents of the object remain mutable. To make an object shallowly immutable, use Object.freeze(obj); for deep immutability, apply a recursive freeze.'
        }
      ],
      trickyFollowUp: {
        question: 'Why does "typeof undeclaredVar" return "undefined", but "typeof letVar" before its declaration throws ReferenceError?',
        answer:
          'Because "letVar" is trapped in the Temporal Dead Zone (TDZ). The engine knows "letVar" exists in the current scope but is in an UNINITIALIZED state. TC39 explicitly designed TDZ access to throw a ReferenceError to prevent accidental use before declaration, breaking the legacy "typeof" safety net.'
      },
      commonMistakes: [
        'Assuming const creates an immutable data structure (it only freezes the reference pointer).',
        'Believing let and const are not hoisted (they ARE hoisted, but reside in TDZ).',
        'Using var in asynchronous loops and wondering why all callbacks receive the loop’s final increment.'
      ]
    },
    quickRevision: {
      takeaways: [
        'var = Function scope, hoisted as undefined, re-declarable.',
        'let = Block scope, hoisted into TDZ, re-assignable.',
        'const = Block scope, hoisted into TDZ, constant reference pointer.',
        'Always default to const; use let only when reassignment is explicitly required; never use var in modern Node.js.'
      ],
      oneLineDefinition:
        'var is function-scoped and initialized as undefined; let and const are block-scoped and protected by the Temporal Dead Zone, with const enforcing an immutable identifier binding.',
      interviewTip:
        'When asked about const immutability, immediately distinguish between "reassigning the variable identifier" (blocked) and "mutating the underlying object properties" (allowed unless Object.freeze is applied).'
    }
  },

  {
    id: 'scope-global-function-block',
    number: 2,
    title: 'Scope: Global, Function, and Block Scope',
    category: 'JavaScript Fundamentals and Execution',
    categorySlug: 'fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'Scope defines the accessibility and lifetime of variables and functions during runtime. JavaScript uses lexical (static) scoping, meaning variable accessibility is resolved at parse time based on code nesting. The three primary scope types are Global Scope (accessible everywhere), Function Scope (confined to function execution), and Block Scope (confined to pairs of curly braces with let/const).',
    internals: {
      overview:
        'When V8 executes code, every Execution Context contains an Environment Record and an outer reference pointer ([[OuterEnv]]). When an identifier is queried, V8 checks the current Environment Record. If not found, it traverses up the scope chain via [[OuterEnv]] until it reaches the Global Environment Record. If not found in strict mode, it throws ReferenceError.',
      flowSteps: [
        'Lexical Scope is determined at author/parse time based on physical code placement.',
        'Every Execution Context maintains an Environment Record + pointer to its outer environment.',
        'Identifier lookup traverses linearly up the scope chain: Local -> Outer Function -> Module/Global.',
        'If an identifier cannot be resolved at the global level, JavaScript throws ReferenceError (in strict mode).'
      ],
      diagram: `+------------------------------------------------------+
| GLOBAL SCOPE (global / window)                       |
|   outer: null                                        |
|   ^                                                  |
|   | [[OuterEnv]] pointer                             |
| +--------------------------------------------------+ |
| | FUNCTION SCOPE (outerFunction)                   | |
| |   outer: Global                                  | |
| |   ^                                              | |
| |   | [[OuterEnv]] pointer                         | |
| | +----------------------------------------------+ | |
| | | BLOCK SCOPE { let x = 10; }                  | | |
| | |   outer: outerFunction                       | | |
| | +----------------------------------------------+ | |
| +--------------------------------------------------+ |
+------------------------------------------------------+`
    },
    codeExample: {
      code: `const globalVal = 'GLOBAL';

function processOrder() {
  const functionVal = 'FUNCTION';

  if (true) {
    const blockVal = 'BLOCK';
    var functionScopedVar = 'HOISTED_TO_FUNCTION';
    console.log(globalVal, functionVal, blockVal); // All accessible here
  }

  console.log(functionScopedVar); // Accessible (var ignored if-block!)
  // console.log(blockVal); // ReferenceError: blockVal is not defined
}

processOrder();
// console.log(functionVal); // ReferenceError: functionVal is not defined`,
      language: 'javascript',
      output: `GLOBAL FUNCTION BLOCK
HOISTED_TO_FUNCTION`,
      whyOutput:
        'The if-block creates a block scope for "const blockVal", making it unreachable outside the braces. However, "var functionScopedVar" attaches to the enclosing function scope (processOrder), making it accessible anywhere inside that function. Global variables are accessible anywhere down the chain.',
      annotations: [
        'Line 8: All outer scopes are visible inside the nested block via the scope chain.',
        'Line 11: var ignores the if-block and attaches to the enclosing function scope.',
        'Line 12: blockVal ceases to exist outside the if-block.'
      ]
    },
    nodeJsApplication: {
      scenario: 'CommonJS Module Scope vs True Global Scope & Accidental Memory Leaks',
      description:
        'In Node.js, files are NOT executed in the global scope. Node wraps every module in a wrapper function: (function (exports, require, module, __filename, __dirname) { ... }). Declaring a variable at the top of a file puts it in Module Scope, not Global Scope. However, omitting declaration keywords (e.g., "leak = { data }") in non-strict mode assigns it to the process-wide "global" object, causing massive memory leaks in high-throughput services.',
      codeSnippet: `// Node.js module wrapper under the hood:
// (function (exports, require, module, __filename, __dirname) {
  const dbPool = createPool(); // Module-scoped: private to this file!

  function badHandler(req, res) {
    accidentalGlobal = req.body; // DANGER: Attached to globalThis in non-strict mode!
  }
// });`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the difference between Scope Chain and Prototype Chain?',
          spokenAnswer:
            'Scope Chain is used for identifier resolution (variables and functions) across lexically nested code blocks. Prototype Chain is used for property lookup on object instances via their internal [[Prototype]] link.'
        },
        {
          question: 'What is Variable Shadowing?',
          spokenAnswer:
            'Variable Shadowing occurs when a variable declared in an inner scope has the same identifier name as a variable in an outer scope. The inner declaration temporarily hides (shadows) the outer variable within that block.'
        }
      ],
      trickyFollowUp: {
        question: 'Are variables declared with "const" or "let" at the root level of a Node.js file attached to globalThis?',
        answer:
          'No. In Node.js, every file is wrapped in an IIFE module wrapper function. Root-level let, const, and var declarations exist in the module\'s local function scope, never on global or globalThis.'
      },
      commonMistakes: [
        'Assuming root variables in a Node.js file are accessible in another file without module.exports/export.',
        'Confusing lexical scope (where defined) with dynamic scope / this binding (how invoked).'
      ]
    },
    quickRevision: {
      takeaways: [
        'JavaScript uses Lexical Scoping: resolved at parse time by code layout.',
        'var is scoped to the nearest function; let and const are scoped to the nearest curly brace block {}.',
        'Scope chain traverses inwards-out: inner scopes see outer variables, but outer scopes never see inner variables.',
        'Node.js wraps every file in an IIFE, giving every file its own private module scope.'
      ],
      oneLineDefinition:
        'Scope defines the visibility and boundary of identifiers, evaluated lexically via a chain of nested Environment Records from local to global.',
      interviewTip:
        'Emphasize that JavaScript scope is 100% lexical (determined by where functions are written in the file, NOT where they are executed).'
    }
  },

  {
    id: 'hoisting',
    number: 3,
    title: 'Hoisting',
    category: 'JavaScript Fundamentals and Execution',
    categorySlug: 'fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'Hoisting is JavaScript\'s compilation behavior where variable and function declarations are registered in memory during the Creation Phase of the Execution Context before any code is executed. Function declarations are hoisted with their complete implementation, var is hoisted and initialized to undefined, while let and const are hoisted into an uninitialized state (TDZ).',
    internals: {
      overview:
        'The V8 engine runs in two distinct phases: Creation Phase and Execution Phase. In the Creation Phase, the compiler scans the AST for declarations. Function declarations are stored in the heap and bound directly to their identifiers in the Environment Record. Variables declared with var are allocated in memory and bound to undefined. Variables declared with let and const are allocated as uninitialized slots.',
      flowSteps: [
        'Creation Phase Pass: V8 allocates memory for all declarations.',
        'Function Declarations: Hoisted with full body into heap; ready for immediate invocation.',
        'var Declarations: Hoisted and initialized with "undefined".',
        'let / const Declarations: Hoisted but marked uninitialized (entering TDZ).',
        'Execution Phase Pass: Code executes line-by-line; assignments happen in-place.'
      ],
      diagram: `AUTHOR-TIME CODE:             COMPILATION (CREATION PHASE):
console.log(greet());         Memory Map:
console.log(x);                greet -> function() { return "Hi!"; }
var x = 10;                    x     -> undefined
function greet() {             y     -> [UNINITIALIZED]
  return "Hi!";               
}                              EXECUTION PHASE:
let y = 20;                    Line 1: calls greet() -> "Hi!"
                               Line 2: logs x        -> undefined
                               Line 3: assigns x = 10`
    },
    comparisonTable: {
      headers: ['Declaration Type', 'Hoisted?', 'Initial Value', 'Access Before Declaration'],
      rows: [
        ['Function Declaration', 'Yes', 'Full function object', 'Executes normally'],
        ['Function Expression (var)', 'Yes', 'undefined', 'TypeError: ... is not a function'],
        ['Function Expression (let/const)', 'Yes', 'Uninitialized (TDZ)', 'ReferenceError: Cannot access before init'],
        ['var variable', 'Yes', 'undefined', 'Returns undefined'],
        ['let / const variable', 'Yes', 'Uninitialized (TDZ)', 'ReferenceError: Cannot access before init']
      ]
    },
    codeExample: {
      code: `// 1. Function Declaration Hoisting: Works!
console.log(calculateTax(100)); // Output: 15

function calculateTax(amount) {
  return amount * 0.15;
}

// 2. var Hoisting: Returns undefined
console.log('var status:', orderStatus); // Output: undefined
var orderStatus = 'CONFIRMED';

// 3. Function Expression with var: Trap!
try {
  initServer(); // TypeError: initServer is not a function
} catch (err) {
  console.log('Expression error:', err.message);
}

var initServer = function () {
  console.log('Server started');
};`,
      language: 'javascript',
      output: `15
var status: undefined
Expression error: initServer is not a function`,
      whyOutput:
        'calculateTax is a function declaration, so its complete definition is hoisted. orderStatus is a var, so its identifier is initialized to undefined. initServer is declared with var, so the identifier initServer is undefined when called as a function, throwing TypeError: initServer is not a function.',
      annotations: [
        'Line 2: Function declarations can be called before their written location.',
        'Line 9: var orderStatus is initialized to undefined.',
        'Line 13: Attempting to invoke undefined as a function throws TypeError, NOT ReferenceError.'
      ]
    },
    nodeJsApplication: {
      scenario: 'File Structure Readability in Express Controllers & Circular Dependencies',
      description:
        'In production Express.js route handlers, senior developers use function declarations to keep public exported controller methods at the top of the file for immediate readability, while hoisting private helper functions defined at the bottom. Additionally, CommonJS circular module loading relies on hoisting behaviors when evaluating partially loaded module caches.',
      codeSnippet: `// Clean Express Controller layout:
export function handleGetUsers(req, res) {
  const users = fetchUsersFromDb();
  const sanitized = sanitizeUserData(users); // Works due to function hoisting!
  return res.json(sanitized);
}

// Private helper placed at the bottom of the file
function sanitizeUserData(rawUsers) {
  return rawUsers.map(u => ({ id: u.id, email: u.email }));
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Are let and const hoisted in JavaScript?',
          spokenAnswer:
            'Yes, let and const ARE hoisted. They are registered in the Lexical Environment during the creation phase. However, unlike var which is initialized to undefined, let and const remain in an uninitialized state called the Temporal Dead Zone until execution reaches their declaration.'
        },
        {
          question: 'Why does calling a var function expression before declaration throw TypeError instead of ReferenceError?',
          spokenAnswer:
            'Because the variable itself IS declared and hoisted with the value undefined. The engine successfully finds the variable (so no ReferenceError occurs), but attempting to invoke undefined with parentheses () triggers a TypeError because undefined is not callable.'
        }
      ],
      trickyFollowUp: {
        question: 'What gets hoisted first: a function declaration or a var with the same name?',
        answer:
          'Function declarations are hoisted before variable declarations. If a var declaration shares the same name as a function declaration without an initial assignment, the function takes precedence. If the var has an assignment, the assignment overwrites the function during the execution phase.'
      },
      commonMistakes: [
        'Believing JavaScript physically moves lines of code to the top of the file (it is purely a memory allocation phase in V8).',
        'Confusing TypeError (invoking undefined) with ReferenceError (accessing undeclared/TDZ variables).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Hoisting happens during the Creation Phase of the Execution Context.',
        'Function declarations hoist with full implementation; callable anywhere in scope.',
        'var hoists as undefined; let/const hoist into uninitialized TDZ.',
        'Function expressions assigned to var hoist as undefined, triggering TypeError if invoked early.'
      ],
      oneLineDefinition:
        'Hoisting is the compiler phase where memory is allocated for declarations before line-by-line bytecode execution begins.',
      interviewTip:
        'Always clarify that hoisting does NOT physically rearrange code; it is an artifact of V8\'s two-pass Compilation and Execution model.'
    }
  },

  {
    id: 'temporal-dead-zone',
    number: 4,
    title: 'Temporal Dead Zone (TDZ)',
    category: 'JavaScript Fundamentals and Execution',
    categorySlug: 'fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'The Temporal Dead Zone (TDZ) is the runtime period between entering a scope and the line where a "let" or "const" variable is declared and initialized. During this time window, the variable exists in memory but is marked uninitialized. Any attempt to read or write to it immediately throws a ReferenceError.',
    internals: {
      overview:
        'When entering a block, V8 instantiates a DeclarativeEnvironmentRecord and registers all block-scoped identifiers with a special internal sentinel value: TheHole (uninitialized). When the bytecode compiler encounters an identifier access, it issues an instruction (e.g. LdaLookupSlot). If the target slot holds TheHole, V8 triggers a bail-out exception and throws "ReferenceError: Cannot access X before initialization".',
      flowSteps: [
        'Enter Block Scope { ... }: Environment record created; let/const bindings registered as [TheHole].',
        'TDZ Active: Any read/write opcode touching [TheHole] throws ReferenceError.',
        'Declaration Line Evaluated: Identifier assigned its evaluated value (or undefined if bare let).',
        'TDZ Exited: Variable can now be read and mutated freely.'
      ],
      diagram: `+-----------------------------------------------------------+
| Block Scope Entered {                                     |
|                                                           |
|   // === TEMPORAL DEAD ZONE (TDZ) STARTS ===              |
|   console.log(typeof x); // Throws ReferenceError!        |
|   console.log(x);        // Throws ReferenceError!        |
|   // === TEMPORAL DEAD ZONE (TDZ) ENDS ===                |
|                                                           |
|   let x = 42;            // Declaration + Initialization  |
|                                                           |
|   console.log(x);        // 42 (Safe!)                    |
+-----------------------------------------------------------+`
    },
    codeExample: {
      code: `function demonstrateTDZ() {
  // 1. Accessing inside TDZ throws ReferenceError
  try {
    console.log(token);
  } catch (err) {
    console.log('TDZ Error:', err.message);
  }

  let token = 'JWT_SECRET_KEY';

  // 2. TDZ in Default Function Parameters: Trap!
  try {
    function compute(a = b, b = 2) {
      return a + b;
    }
    compute();
  } catch (err) {
    console.log('Parameter TDZ Error:', err.message);
  }
}

demonstrateTDZ();`,
      language: 'javascript',
      output: `TDZ Error: Cannot access 'token' before initialization
Parameter TDZ Error: Cannot access 'b' before initialization`,
      whyOutput:
        '"token" is in the TDZ from the start of demonstrateTDZ until "let token" executes. In default parameters, parameters are evaluated left-to-right in their own parameter scope; evaluating "a = b" attempts to read "b" before "b" is initialized, throwing ReferenceError.',
      annotations: [
        'Line 4: Even typeof token inside the TDZ throws ReferenceError.',
        'Line 8: TDZ ends once execution completes the let token declaration line.',
        'Line 12: Default parameters evaluate sequentially; referencing b before its declaration triggers parameter TDZ.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Catching Initialization Bugs in Database Connectors & Environment Configs',
      description:
        'In production Node.js services, TDZ catches critical asynchronous initialization race conditions. For example, if a service attempts to access a database connection or decrypted secret before the asynchronous bootstrap sequence completes, TDZ guarantees an immediate, fail-fast ReferenceError rather than silently operating with "undefined" credentials and corrupting downstream state.',
      codeSnippet: `// Config loader pattern
function initializeApp() {
  // If we had used "var pool", calling pool.query() here would fail with
  // cryptic "TypeError: Cannot read properties of undefined".
  // With "const pool", TDZ fails loudly and immediately!
  
  const pool = new DatabasePool(process.env.DATABASE_URL);
  return pool;
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Why was the Temporal Dead Zone introduced in ES6?',
          spokenAnswer:
            'TC39 introduced TDZ for two main reasons: 1) Catching runtime bugs where variables are accessed before declaration rather than silently propagating undefined; 2) Enforcing the semantics of "const", because if const were initialized to undefined before its declaration line, it would change values at runtime, violating the definition of a constant.'
        },
        {
          question: 'Does the Temporal Dead Zone apply to class declarations?',
          spokenAnswer:
            'Yes. ES6 classes behave like let and const. Class declarations are hoisted into the TDZ and cannot be instantiated via new before their declaration line.'
        }
      ],
      trickyFollowUp: {
        question: 'Why is it called TEMPORAL dead zone instead of SPATIAL dead zone?',
        answer:
          'Because the dead zone is time-based (temporal), not location-based (spatial). A function declared after a let variable can safely reference that variable as long as the function is EXECUTED after the declaration line has been evaluated.'
      },
      commonMistakes: [
        'Believing TDZ is spatial (assuming physical placement in file matters rather than the order of time execution).',
        'Forgetting that function default arguments evaluate left-to-right and have their own TDZ.'
      ]
    },
    quickRevision: {
      takeaways: [
        'TDZ spans from scope entry until declaration evaluation.',
        'Reading or writing an uninitialized let/const in TDZ throws ReferenceError.',
        'typeof is NOT safe inside TDZ (it also throws ReferenceError).',
        'Exists to guarantee fail-fast errors and protect const immutability.'
      ],
      oneLineDefinition:
        'The Temporal Dead Zone is the time period between entering a block scope and evaluating a let/const declaration, during which the binding exists but is uninitialized.',
      interviewTip:
        'Highlight that TDZ is TEMPORAL (execution order in time): a function physically placed above a let declaration can safely run, provided it is invoked after the declaration executes.'
    }
  },

  {
    id: 'closures',
    number: 5,
    title: 'Closures',
    category: 'JavaScript Fundamentals and Execution',
    categorySlug: 'fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'A closure is a function bundled together with references to its surrounding lexical environment. In JavaScript, a closure gives an inner function access to an outer function\'s variables even after the outer function has finished executing and returned.',
    internals: {
      overview:
        'Normally, local variables reside on the execution stack and are destroyed when the stack frame pops. When V8 detects that an inner function references variables from an outer function, the compiler promotes those variables from the stack to a heap-allocated Context object. The inner function retains an internal [[Scopes]] property pointing to this heap Context, keeping the variables alive as long as the inner function is referenced.',
      flowSteps: [
        'AST Analysis: V8 scans for "free variables" (variables used in an inner function but declared outside).',
        'Heap Promotion: Outer function variables captured by the inner function are allocated on the V8 Heap (in a Context object), not the stack.',
        'Stack Unwinding: Outer function completes and its stack frame is popped off.',
        'Closure Retention: The inner function retains a pointer to the heap Context via its [[Scopes]] internal property.'
      ],
      diagram: `V8 CALL STACK:                    V8 MANAGED HEAP:
+------------------------+        +-------------------------------+
| [Popped off Stack]     |        | Heap Context:                 |
| outerFunction() returns| -----> |   count: 1                    |
+------------------------+        |   (Preserved in memory!)      |
                                  +-------------------------------+
                                                  ^
                                                  | [[Scopes]] pointer
+------------------------+        +---------------+---------------+
| innerFunction() runs   | -----> | innerFunction reference       |
+------------------------+        +-------------------------------+`
    },
    codeExample: {
      code: `function createRateLimiter(maxRequests) {
  let requestCount = 0; // Encapsulated private state on the heap

  return function (userId) {
    requestCount++;
    if (requestCount > maxRequests) {
      return { allowed: false, error: 'Rate limit exceeded for user: ' + userId };
    }
    return { allowed: true, current: requestCount, remaining: maxRequests - requestCount };
  };
}

const limiter = createRateLimiter(2);

console.log(limiter('user_1')); // { allowed: true, current: 1, remaining: 1 }
console.log(limiter('user_1')); // { allowed: true, current: 2, remaining: 0 }
console.log(limiter('user_1')); // { allowed: false, error: 'Rate limit exceeded...' }`,
      language: 'javascript',
      output: `{ allowed: true, current: 1, remaining: 1 }
{ allowed: true, current: 2, remaining: 0 }
{ allowed: false, error: 'Rate limit exceeded for user: user_1' }`,
      whyOutput:
        'createRateLimiter finished executing, but its inner function retained a closure over "requestCount". Each invocation of limiter increments the private variable stored in the heap context, without exposing requestCount to external tampering.',
      annotations: [
        'Line 2: requestCount is allocated on the heap because the inner function references it.',
        'Line 4: Returned function forms a closure over maxRequests and requestCount.',
        'Line 15: The state persists across successive calls without any global variables.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Express.js Middleware Factories & Database Transaction Scopes',
      description:
        'Closures power Node.js middleware factories (e.g. express.json({ limit: "10mb" }), cors(options)). The outer factory accepts configuration options once at startup, returning a middleware handler function that closes over those options for every incoming HTTP request.',
      codeSnippet: `// Production Middleware Factory using Closures
function authorizeRoles(...allowedRoles) {
  // allowedRoles is preserved in closure heap memory
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
}

app.delete('/api/users/:id', authorizeRoles('ADMIN', 'SUPERUSER'), deleteUserHandler);`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is a closure and what problem does it solve?',
          spokenAnswer:
            'A closure is a function bundled with references to its lexical environment. It allows an inner function to retain access to outer variables even after the outer function has returned. It solves state encapsulation, data privacy without classes, and powers factory functions and middleware.'
        },
        {
          question: 'Can closures cause memory leaks in Node.js?',
          spokenAnswer:
            'Yes. Because variables referenced in closures are preserved on the heap, if a long-lived object (like a global event listener, cache, or timer) holds a reference to a closure that captures large buffers or request objects, those captured variables cannot be garbage collected, creating a memory leak.'
        }
      ],
      trickyFollowUp: {
        question: 'Do all functions in JavaScript have closures?',
        answer:
          'Technically yes, in terms of language specification, all JavaScript functions remember their outer Lexical Environment via [[Scopes]]. However, V8 optimizes closures: if a function does not access any outer variables, V8 does not allocate a heap Context object for it.'
      },
      commonMistakes: [
        'Capturing large request/response objects in asynchronous closures stored in long-lived caches.',
        'Assuming closures recreate variables on each invocation (they share the same captured heap context).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Closure = Function + Lexical Scope pointer.',
        'Variables captured by closures are stored in Heap Contexts, not on the Call Stack.',
        'Powers data privacy, currying, factory functions, and Express middleware.',
        'Be mindful of memory leaks when closures are referenced by long-lived listeners.'
      ],
      oneLineDefinition:
        'A closure is a function that retains access to variables from its outer lexical scope even after the outer function has exited.',
      interviewTip:
        'Mention the V8 engine mechanics: closed-over variables are promoted from stack frames to heap-allocated Context objects.'
    }
  },

  {
    id: 'lexical-environment',
    number: 6,
    title: 'Lexical Environment',
    category: 'JavaScript Fundamentals and Execution',
    categorySlug: 'fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'A Lexical Environment is an internal ECMAScript engine specification type used to define identifier resolution. It consists of an Environment Record (which stores local variable and function bindings) and a reference to an Outer Lexical Environment. "Lexical" means resolution is determined statically by where code is physically written in the file.',
    internals: {
      overview:
        'Every time a function, block, or script is entered, the engine creates a new Lexical Environment. It has two components: 1) EnvironmentRecord (Declarative for let/const/functions, Object-based for the global object), and 2) [[OuterEnv]] reference pointing to the Lexical Environment of the enclosing scope. Identifier resolution is static: V8 traverses [[OuterEnv]] links at compile time to assign fixed context-slot offsets.',
      flowSteps: [
        'Code Parsing: V8 builds scope trees based strictly on physical source positioning.',
        'Instantiation: LexicalEnvironment = { EnvironmentRecord, outer: [[OuterEnv]] }.',
        'Lookup: Identifier queried -> check local EnvironmentRecord -> follow outer pointer -> repeat until null.'
      ],
      diagram: `+-----------------------------------------------------------+
| Lexical Environment (Inner Function)                      |
|   EnvironmentRecord: { y: 20 }                            |
|   outer: ------------------------------------+            |
+----------------------------------------------|------------+
                                               |
+----------------------------------------------v------------+
| Lexical Environment (Outer Function)                      |
|   EnvironmentRecord: { x: 10 }                            |
|   outer: ------------------------------------+            |
+----------------------------------------------|------------+
                                               |
+----------------------------------------------v------------+
| Lexical Environment (Global)                              |
|   EnvironmentRecord: { globalVar: 'Node' }                |
|   outer: null                                             |
+-----------------------------------------------------------+`
    },
    codeExample: {
      code: `const serviceName = 'AUTH_SERVICE';

function createLogger() {
  const serviceName = 'LOGGER_OVERRIDE';

  return function logMessage(msg) {
    // Looks up serviceName lexically:
    // 1. Checks logMessage local record -> not found
    // 2. Checks createLogger local record -> found 'LOGGER_OVERRIDE'
    console.log(\`[\${serviceName}] \${msg}\`);
  };
}

function runAudit() {
  const serviceName = 'AUDIT_RUNNER';
  const logger = createLogger();
  logger('System check passed'); // Notice what serviceName prints!
}

runAudit();`,
      language: 'javascript',
      output: `[LOGGER_OVERRIDE] System check passed`,
      whyOutput:
        'Lexical scope depends on where functions are DEFINED, not where they are CALLED. logMessage was defined inside createLogger, so its outer lexical environment points to createLogger\'s environment, completely ignoring the "AUDIT_RUNNER" variable in runAudit.',
      annotations: [
        'Line 3: Global serviceName is shadowed by createLogger\'s local environment.',
        'Line 6: logMessage captures the lexical environment where it was declared.',
        'Line 16: Calling logger() from runAudit does NOT use runAudit\'s scope.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Static Scope Binding in Node.js Event Emitters and Async Callbacks',
      description:
        'In asynchronous Node.js microservices, events and timers fire minutes or hours after their registering function has completed. Because JavaScript resolves variables via static lexical environments rather than dynamic call-stack states, asynchronous callbacks always retain the exact config, tracing context, and tenant ID that existed when they were created.',
      codeSnippet: `function registerJob(jobId, tenantId) {
  // tenantId is bound lexically in this environment
  queue.process(jobId, async (job) => {
    // Even if executed 10 minutes later in an entirely different stack,
    // tenantId resolves accurately via the outer lexical environment.
    await db.query('SELECT * FROM orders WHERE tenant_id = ?', [tenantId]);
  });
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the difference between Lexical Environment and Variable Environment?',
          spokenAnswer:
            'Both are environment records. In ES6+, the Lexical Environment manages block-scoped bindings (let, const, class), while the Variable Environment specifically handles function-scoped bindings (var).'
        },
        {
          question: 'Does the Lexical Environment change based on how a function is called?',
          spokenAnswer:
            'No. The Lexical Environment is strictly static (lexical). It is determined by the physical placement of the code in the file. Only the "this" keyword changes dynamically based on call-site.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the outer reference of a function created using the "new Function()" constructor?',
        answer:
          'Functions created with "new Function(\'return x\')" do NOT capture their local lexical environment. Their outer environment always points directly to the Global Lexical Environment.'
      },
      commonMistakes: [
        'Confusing Lexical Scope (static, author-time) with "this" context (dynamic, call-time).',
        'Believing the scope chain follows the function call sequence.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Lexical Environment = EnvironmentRecord + [[OuterEnv]] link.',
        'Static resolution: depends on where code is written, not where called.',
        'let/const bind to LexicalEnvironment; var binds to VariableEnvironment.',
        'Scope lookup terminates at the Global Environment whose outer is null.'
      ],
      oneLineDefinition:
        'A Lexical Environment is an engine structure containing local identifier bindings and a pointer to its enclosing lexical scope.',
      interviewTip:
        'Contrast "Lexical Environment" (which governs variable lookup statically) with "this context" (which is determined dynamically at the call-site).'
    }
  },

  {
    id: 'execution-context',
    number: 7,
    title: 'Execution Context',
    category: 'JavaScript Fundamentals and Execution',
    categorySlug: 'fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'An Execution Context is an internal conceptual environment created by JavaScript to evaluate and execute code. It contains everything required for code to run: variable/function records, the scope chain, and the "this" value. The three types are Global Execution Context (GEC), Function Execution Context (FEC), and Eval Execution Context.',
    internals: {
      overview:
        'Every Execution Context has two distinct lifecycles: 1) Creation Phase (Memory Allocation Phase): V8 allocates the Window/Global object, initializes the VariableEnvironment (var hoisted as undefined), sets up the LexicalEnvironment (let/const in TDZ), determines the outer scope chain, and binds "this". 2) Execution Phase: Bytecode is executed line-by-line, assigning values and invoking functions.',
      flowSteps: [
        'Creation Phase: Allocates global/local object, creates LexicalEnvironment and VariableEnvironment, sets "this".',
        'Hoisting occurs during the Creation Phase.',
        'Execution Phase: Runs bytecode, evaluates expressions, executes function calls.',
        'Destruction: Pops off stack when function returns (unless preserved by a closure).'
      ],
      diagram: `+-----------------------------------------------------------+
|                   EXECUTION CONTEXT                       |
|                                                           |
| 1. LexicalEnvironment:                                    |
|    - EnvironmentRecord: let, const, class, functions      |
|    - outer: Reference to enclosing Lexical Environment    |
|                                                           |
| 2. VariableEnvironment:                                   |
|    - EnvironmentRecord: var declarations                  |
|                                                           |
| 3. ThisBinding:                                           |
|    - Determined by call-site rule (or lexical in arrows)  |
+-----------------------------------------------------------+`
    },
    codeExample: {
      code: `var appVersion = '1.0.0';
let activeEnvironment = 'production';

function bootstrap(service) {
  var timestamp = Date.now();
  let status = 'INITIALIZING';

  function complete() {
    return \`\${service} on \${activeEnvironment} [v\${appVersion}] ready\`;
  }

  return complete();
}

console.log(bootstrap('PaymentGateway'));`,
      language: 'javascript',
      output: `PaymentGateway on production [v1.0.0] ready`,
      whyOutput:
        'First, the Global Execution Context (GEC) is created for global variables. Calling bootstrap() pushes a new Function Execution Context (FEC) onto the stack. Inside it, complete() creates another nested FEC, resolving activeEnvironment and appVersion via the scope chain.',
      annotations: [
        'Lines 1-2: Evaluated in the Global Execution Context (GEC).',
        'Line 4: bootstrap() creates a Function Execution Context (FEC).',
        'Line 8: complete() creates a nested FEC and accesses outer bindings.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Node.js AsyncLocalStorage: Tracing Execution Context Across Async Hops',
      description:
        'In Node.js, asynchronous I/O causes execution contexts to pop off the call stack before callbacks fire. To preserve request-scoped context (such as requestId, tenantId, and auth tokens) across asynchronous database calls and HTTP hops, Node.js provides AsyncLocalStorage, which mimics thread-local storage by propagating context across asynchronous execution chains.',
      codeSnippet: `import { AsyncLocalStorage } from 'node:async_hooks';

const asyncLocalStorage = new AsyncLocalStorage();

// Express middleware tracking execution context
app.use((req, res, next) => {
  const traceId = req.headers['x-request-id'] || crypto.randomUUID();
  asyncLocalStorage.run({ traceId }, () => next());
});

// Deep inside a repository layer:
function queryDatabase() {
  const store = asyncLocalStorage.getStore();
  logger.info(\`[\${store?.traceId}] Executing SQL query\`);
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What are the two phases of an Execution Context?',
          spokenAnswer:
            'The Creation Phase and the Execution Phase. In the Creation Phase, memory is allocated for variables and functions (hoisting occurs), the scope chain is established, and "this" is bound. In the Execution Phase, the code is evaluated and executed line-by-line.'
        },
        {
          question: 'How many Global Execution Contexts exist in a Node.js process?',
          spokenAnswer:
            'Exactly one Global Execution Context per V8 Isolate/thread. However, each required file gets its own Module Execution Context when executed.'
        }
      ],
      trickyFollowUp: {
        question: 'Does a block { ... } create a new Execution Context?',
        answer:
          'No! In ECMAScript, blocks do NOT create a new Execution Context. They only create a new Lexical Environment within the existing Execution Context, which is swapped into place when entering the block.'
      },
      commonMistakes: [
        'Believing curly brace blocks create their own Execution Context (they only create a Lexical Environment).',
        'Assuming variables are initialized with their values during the creation phase.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Execution Context = Environment where JS code is evaluated and executed.',
        'Consists of LexicalEnvironment, VariableEnvironment, and ThisBinding.',
        'Runs in two passes: Creation Phase (memory allocation) and Execution Phase (code evaluation).',
        'Managed by the Call Stack in LIFO order.'
      ],
      oneLineDefinition:
        'An Execution Context is the runtime container managed by the JavaScript engine that encapsulates the scope chain, variable storage, and "this" binding for executing code.',
      interviewTip:
        'Clarify the key distinction: functions create new Execution Contexts; blocks ({}) only create new Lexical Environments within the current Execution Context.'
    }
  },

  {
    id: 'call-stack',
    number: 8,
    title: 'Call Stack',
    category: 'JavaScript Fundamentals and Execution',
    categorySlug: 'fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'The Call Stack is a LIFO (Last-In, First-Out) data structure used by the V8 JavaScript engine to keep track of active function invocations and their execution contexts. When a function is called, its frame is pushed onto the stack; when it returns, its frame is popped off.',
    internals: {
      overview:
        'JavaScript is single-threaded, meaning it has only one Call Stack. Each entry is a Stack Frame containing the function\'s parameters, local primitive variables, return address, and execution context. If functions recurse without a base case, the stack frames exceed the engine\'s memory limit (typically ~10,000 frames in V8), resulting in a "RangeError: Maximum call stack size exceeded" (Stack Overflow).',
      flowSteps: [
        'Function called -> stack frame created and pushed to top of Call Stack.',
        'Engine executes the top frame on the stack.',
        'Nested call -> new frame pushed on top; previous function pauses.',
        'Function returns value -> frame popped off stack; caller resumes.',
        'Interplay with Node.js Event Loop: Asynchronous callbacks wait in Task Queues until the Call Stack is completely empty.'
      ],
      diagram: `V8 CALL STACK (LIFO):
|                          |
|  [ third() Stack Frame ] |  <- Currently executing (Top of stack)
|  [ second() Stack Frame] |  <- Paused, awaiting third() return
|  [ first() Stack Frame ] |  <- Paused, awaiting second() return
|  [ Global Context Frame] |  <- Bottom of stack
+--------------------------+`
    },
    codeExample: {
      code: `function first() {
  console.log('1. Inside first');
  second();
  console.log('4. Exiting first');
}

function second() {
  console.log('2. Inside second');
  third();
  console.log('3. Exiting second');
}

function third() {
  console.log('   Inside third (Top of Stack)');
}

first();`,
      language: 'javascript',
      output: `1. Inside first
2. Inside second
   Inside third (Top of Stack)
3. Exiting second
4. Exiting first`,
      whyOutput:
        'Frames are pushed in order: first -> second -> third. Third completes and pops first. Then second completes and pops. Finally, first completes and pops. The Call Stack operates strictly Last-In, First-Out.',
      annotations: [
        'Line 3: Calling second() pauses first() and pushes a new frame.',
        'Line 9: Calling third() pushes another frame to the top.',
        'Line 14: Execution starts with the global context pushing first().'
      ]
    },
    nodeJsApplication: {
      scenario: 'Blocking the Single Thread & Event Loop Starvation in Node.js',
      description:
        'Because Node.js runs JavaScript on a single Call Stack, heavy synchronous operations (such as large JSON parsing, crypto calculations, or regex backtracking) block the Call Stack. While the Call Stack is busy, the Event Loop cannot process any incoming network requests, database responses, or timers, freezing the server.',
      codeSnippet: `// DANGEROUS: Synchronously blocks the Call Stack for 5 seconds
app.get('/heavy', (req, res) => {
  const start = Date.now();
  while (Date.now() - start < 5000) {
    // Call stack blocked! Server drops all concurrent incoming traffic!
  }
  res.send('Done');
});

// SAFE: Offload CPU-heavy computation to Worker Threads or chunk via setImmediate`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is a Stack Overflow and how do you prevent it in recursive algorithms?',
          spokenAnswer:
            'A Stack Overflow occurs when the Call Stack exceeds its maximum allocated frame limit due to excessive or unbounded recursion. It is prevented by: 1) Ensuring correct base cases; 2) Converting recursion to an iterative loop; 3) Trampolining; or 4) Chunking recursive calls with setImmediate() to let the stack unwind.'
        },
        {
          question: 'How does the Call Stack interact with the Node.js Event Loop?',
          spokenAnswer:
            'The Call Stack only executes synchronous JavaScript. The Event Loop continuously checks if the Call Stack is empty. Only when the Call Stack has completely cleared will the Event Loop pick tasks from the microtask queue (Promises) or macrotask queue (timers, I/O) and push them onto the Call Stack.'
        }
      ],
      trickyFollowUp: {
        question: 'Does "await" block the Call Stack in Node.js?',
        answer:
          'No! "await" does NOT block the Call Stack. When an "await" expression is encountered, the async function yields execution, saving its state in the microtask queue, and immediately pops off the Call Stack, allowing the Event Loop to handle other requests.'
      },
      commonMistakes: [
        'Thinking async/await creates multi-threading (it is cooperative multitasking on the single call stack).',
        'Running CPU-heavy synchronous loops directly in Express route handlers.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Call Stack is single-threaded and LIFO (Last-In, First-Out).',
        'Stack frames hold execution contexts, parameters, and return addresses.',
        'Unbounded recursion causes RangeError: Maximum call stack size exceeded.',
        'The Event Loop only pushes asynchronous callbacks when the Call Stack is 100% empty.'
      ],
      oneLineDefinition:
        'The Call Stack is the single-threaded LIFO data structure in V8 that tracks the execution point and active stack frames of running functions.',
      interviewTip:
        'Emphasize that the Call Stack must be empty before the Event Loop can process any microtasks or macrotasks.'
    }
  }
];
