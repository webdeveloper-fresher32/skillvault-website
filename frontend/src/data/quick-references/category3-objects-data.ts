import { QuickReferenceTopic } from './types';

export const category3ObjectsData: QuickReferenceTopic[] = [
  {
    id: 'shallow-copy-vs-deep-copy',
    number: 14,
    title: 'Shallow Copy vs Deep Copy',
    category: 'Objects and Data Handling',
    categorySlug: 'objects-data',
    estimatedMinutes: 5,
    concept30Sec:
      'A Shallow Copy duplicates only the top-level properties of an object or array; nested objects and arrays remain shared references in memory. A Deep Copy duplicates all levels of the object hierarchy recursively, ensuring that mutations to nested structures on the cloned object have zero effect on the original object.',
    internals: {
      overview:
        'In V8, primitives (numbers, booleans) are copied by direct value. When performing a shallow copy (Object.assign, { ...obj }, slice), V8 copies the pointer addresses of nested heap objects, not the objects themselves. A deep copy (structuredClone, cloneDeep) traverses the object graph, allocating fresh heap memory for every nested object, tracking circular references via a map to prevent infinite recursion.',
      flowSteps: [
        'Shallow Copy: Top-level keys duplicated. Nested objects still point to the same memory addresses on the V8 heap.',
        'Mutation Hazard: Mutating clone.nested.key silently modifies original.nested.key.',
        'Deep Copy with JSON: JSON.parse(JSON.stringify(obj)) serializes to string then parses. Breaks on Date (becomes string), RegExp, Map, Set, undefined, functions, and circular references (throws TypeError).',
        'Deep Copy with structuredClone(): Native V8 algorithm supporting circular references, Dates, Sets, Maps, and TypedArrays (fails only on functions and DOM nodes).'
      ],
      diagram: `SHALLOW COPY:
Original: { config: [Memory Address 0x101] }
Cloned:   { config: [Memory Address 0x101] }  <-- Both share the same heap object!

DEEP COPY (structuredClone):
Original: { config: [Memory Address 0x101] }
Cloned:   { config: [Memory Address 0x999] }  <-- Fully independent heap allocation!`
    },
    comparisonTable: {
      headers: ['Method', 'Copy Depth', 'Handles Circular Refs?', 'Preserves Dates / Maps?', 'Copies Functions?'],
      rows: [
        ['Spread ({ ...obj })', 'Shallow', 'N/A (top level only)', 'Preserved as references', 'Yes (as reference)'],
        ['Object.assign()', 'Shallow', 'N/A (top level only)', 'Preserved as references', 'Yes (as reference)'],
        ['JSON.parse(JSON.stringify())', 'Deep', 'No (throws TypeError)', 'No (Date becomes string; Map/Set lost)', 'No (silently stripped)'],
        ['structuredClone()', 'Deep', 'Yes (handled natively)', 'Yes (Dates, Maps, Sets, Blobs cloned)', 'No (throws DataCloneError)']
      ]
    },
    codeExample: {
      code: `const originalConfig = {
  service: 'AuthService',
  db: { host: 'localhost', port: 5432 },
  createdAt: new Date('2026-01-01')
};

// 1. Shallow Copy using Spread
const shallowCopy = { ...originalConfig };
shallowCopy.db.port = 9999; // MUTATES ORIGINAL!
console.log('Original DB Port after shallow edit:', originalConfig.db.port); // 9999

// Reset
originalConfig.db.port = 5432;

// 2. Native Deep Copy using structuredClone()
const deepCopy = structuredClone(originalConfig);
deepCopy.db.port = 8888;
console.log('Original DB Port after deep edit:', originalConfig.db.port); // 5432 (Untouched!)
console.log('Cloned DB Port:', deepCopy.db.port); // 8888
console.log('Date preserved as Date instance?', deepCopy.createdAt instanceof Date); // true`,
      language: 'javascript',
      output: `Original DB Port after shallow edit: 9999
Original DB Port after deep edit: 5432
Cloned DB Port: 8888
Date preserved as Date instance? true`,
      whyOutput:
        'In the shallow copy, originalConfig.db and shallowCopy.db point to the exact same object reference in memory. Modifying shallowCopy.db.port mutates the shared heap object. structuredClone allocates an entirely new object for db and correctly clones the Date object as a genuine Date instance.',
      annotations: [
        'Line 8: Spread operator creates a shallow copy only.',
        'Line 9: Modifying nested properties mutates the original object.',
        'Line 16: structuredClone() performs a native, spec-compliant deep copy.',
        'Line 20: structuredClone preserves Date, Set, Map, and TypedArrays accurately.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Cloning Incoming Request Payloads & Database Transaction Snapshots',
      description:
        'In Node.js Express/Fastify services, mutating "req.body" inside an audit logging middleware or validator will corrupt the payload for downstream controllers if a shallow copy was used. Deep cloning state using structuredClone() ensures transactional isolation when retrying database operations or rollback snapshots.',
      codeSnippet: `// Express audit middleware using deep cloning
app.use((req, res, next) => {
  if (req.body) {
    // structuredClone prevents sanitization from modifying req.body for downstream handlers
    const auditPayload = structuredClone(req.body);
    delete auditPayload.password;
    delete auditPayload.creditCard;
    auditLogger.log('INCOMING_PAYLOAD', auditPayload);
  }
  next();
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What are the main drawbacks of using JSON.parse(JSON.stringify(obj)) for deep copying?',
          spokenAnswer:
            '1) It throws a TypeError on circular references; 2) It silently drops keys with undefined, functions, or Symbol values; 3) It converts Date objects into ISO strings instead of Date instances; 4) It converts NaN and Infinity to null; 5) It drops Maps, Sets, and RegExp objects.'
        },
        {
          question: 'When does structuredClone() throw an error?',
          spokenAnswer:
            'structuredClone() throws a DataCloneError (DOMException) if the object contains functions, methods, DOM nodes, or certain non-cloneable system handles (like open file descriptors or database sockets).'
        }
      ],
      trickyFollowUp: {
        question: 'Does Object.assign({}, obj) or { ...obj } clone property getters and setters?',
        answer:
          'No! Both spread and Object.assign invoke the getter on the source object and copy the resulting static return value as a simple data property. They do not preserve getter/setter accessor descriptors.'
      },
      commonMistakes: [
        'Relying on spread { ...obj } to clone nested configuration objects and causing production bugs.',
        'Using JSON serialization on objects containing Dates or undefined values.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Shallow copy = copies top-level keys; nested objects remain shared references.',
        'Deep copy = duplicates all levels into fresh heap memory allocations.',
        'Use structuredClone() for native deep copying in modern Node.js 17+.',
        'Avoid JSON.parse(JSON.stringify()) due to Date, undefined, and circular reference bugs.'
      ],
      oneLineDefinition:
        'A shallow copy duplicates only first-level properties while sharing nested references, whereas a deep copy recursively allocates new memory for all nested data structures.',
      interviewTip:
        'Mention structuredClone() as the modern Node.js native standard, and list the 3 specific traps of the JSON parse/stringify hack (Dates become strings, undefined is dropped, circular refs crash).'
    }
  },

  {
    id: 'pass-by-value-and-references',
    number: 15,
    title: 'Pass by Value and Object References',
    category: 'Objects and Data Handling',
    categorySlug: 'objects-data',
    estimatedMinutes: 5,
    concept30Sec:
      'JavaScript is strictly "Call by Value" (Pass by Value). For primitive data types (numbers, strings, booleans, null, undefined, symbols, bigints), the actual value is copied. For objects, the value being passed is the memory reference (pointer) to the object on the heap. Reassigning the parameter variable only changes the local pointer; mutating object properties modifies the shared heap data.',
    internals: {
      overview:
        'Primitives in V8 are stored directly on the stack or as encoded 32-bit/64-bit tagged pointers. Objects reside in V8 Heap memory. When an object variable is passed into a function, a copy of the pointer address (e.g. 0x00FF12) is pushed onto the stack frame. Because the parameter holds a copy of the pointer, reassigning the parameter points that copy to a new address. But dereferencing properties (param.x = 10) modifies the memory at 0x00FF12 directly.',
      flowSteps: [
        'Primitives: Passing primitive -> creates independent copy on stack. Changes have zero impact on caller.',
        'Objects: Passing object -> copies the reference pointer to the function parameter.',
        'Property Mutation: param.name = "X" traverses the pointer and mutates shared heap object.',
        'Parameter Reassignment: param = { name: "Y" } rebinds the local parameter to a new heap address. Original object is untouched!'
      ],
      diagram: `CALL-BY-VALUE OF AN OBJECT REFERENCE:
Caller:   userVariable = [Pointer: 0x4A] ------> Heap: { name: 'Alice' }
                                                       ^
Function: paramCopy    = [Pointer: 0x4A] --------------+

Mutation:     paramCopy.name = 'Bob'  --> Mutates Heap Object!
Reassignment: paramCopy = { name: 'Z' } --> paramCopy gets new [Pointer: 0x9B]; userVariable still points to 0x4A!`
    },
    codeExample: {
      code: `// 1. Primitive: Pure Pass-by-Value
let retryCount = 3;
function increment(count) {
  count = count + 1; // Only modifies local stack variable
}
increment(retryCount);
console.log('retryCount after function:', retryCount); // 3 (Unchanged!)

// 2. Object Mutation vs Reassignment
const session = { id: 'sess_1', active: true };

function modifySession(sess) {
  sess.active = false; // Property mutation modifies shared heap object!
  
  sess = { id: 'sess_999', active: true }; // Reassignment rebinds local parameter only!
  sess.active = 'REASSIGNED';
}

modifySession(session);
console.log('session after modifySession:', session);`,
      language: 'javascript',
      output: `retryCount after function: 3
session after modifySession: { id: 'sess_1', active: false }`,
      whyOutput:
        'retryCount is a primitive number; passing it copies its value. Modifying count inside increment has no effect on retryCount. In modifySession, "sess.active = false" dereferences the shared pointer and modifies the original object on the heap. However, "sess = { ... }" reassigns the local parameter to a new memory address, leaving the caller\'s session variable untouched.',
      annotations: [
        'Line 4: Primitives are copied by value; changing the parameter does not affect the caller.',
        'Line 13: Dereferencing a property mutates the shared heap object.',
        'Line 15: Reassigning a parameter breaks the link to the caller\'s original object.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Mutating req/res in Express Middleware vs Singleton Service Contamination',
      description:
        'Express.js relies on passing object references: middleware functions attach metadata (req.user = decodedToken; req.requestId = id) by mutating the shared "req" reference. Conversely, passing a singleton configuration object or database options to multiple services without defensive copying can result in one service mutating options (like changing query limits) and unintentionally corrupting queries across the entire backend.',
      codeSnippet: `// Express Middleware relying on pass-by-reference:
function authenticate(req, res, next) {
  // Attaches user to the shared req object on the heap
  req.user = { id: 'usr_42', role: 'ADMIN' };
  next();
}

// Controller consumes the mutated reference:
function handleGetProfile(req, res) {
  res.json({ userId: req.user.id }); // Works because of shared object reference!
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Is JavaScript pass-by-reference or pass-by-value?',
          spokenAnswer:
            'JavaScript is strictly pass-by-value at all times. For primitives, the actual value is copied. For objects, the value that is passed is the reference (memory address pointer). It is often called "call-by-sharing" or "pass-by-value of a reference".'
        },
        {
          question: 'How do you prove that JavaScript does not pass objects by true reference?',
          spokenAnswer:
            'By reassigning the parameter inside the function. If JavaScript were true pass-by-reference (like C++ reference parameters), reassigning the parameter to a new object would reassign the original variable in the caller. In JavaScript, reassigning the parameter has zero effect on the caller.'
        }
      ],
      trickyFollowUp: {
        question: 'What happens when you pass an array into a function and call arr.length = 0?',
        answer:
          'Because arr.length is a property mutation on the shared heap array object, setting arr.length = 0 truncates and empties the original array in the caller!'
      },
      commonMistakes: [
        'Saying JavaScript is pass-by-reference for objects (it is pass-by-value of the reference pointer).',
        'Assuming parameter reassignment modifies the caller\'s variable.'
      ]
    },
    quickRevision: {
      takeaways: [
        'JavaScript is 100% Pass-by-Value.',
        'Primitives: value is copied directly.',
        'Objects: reference address (pointer) is copied.',
        'Mutating a property modifies the shared heap object; reassigning the parameter only modifies the local variable.'
      ],
      oneLineDefinition:
        'JavaScript is strictly pass-by-value: primitives pass copied values, while objects pass copied memory references (pointers).',
      interviewTip:
        'Use the phrase "Pass-by-value of a reference pointer" (or "Call-by-sharing") to demonstrate senior-level technical precision.'
    }
  },

  {
    id: 'destructuring',
    number: 16,
    title: 'Destructuring',
    category: 'Objects and Data Handling',
    categorySlug: 'objects-data',
    estimatedMinutes: 5,
    concept30Sec:
      'Destructuring is an ES6 syntax that unpacks values from arrays or properties from objects into distinct variables in a single, declarative statement. It supports default fallback values, variable aliasing (renaming), nested extraction, and rest patterns for collecting remaining elements.',
    internals: {
      overview:
        'Object destructuring relies on standard runtime [[Get]] property lookups on the target object. Default values are triggered if and only if the resolved value is strictly equal to "undefined" (null, false, or 0 do NOT trigger defaults). Array destructuring uses JavaScript\'s Iterator Protocol: the engine invokes [Symbol.iterator]() on the iterable and calls .next() sequentially until all destructured variables are satisfied.',
      flowSteps: [
        'Object Destructuring: Evaluates properties using internal [[Get]]. If value === undefined, applies default.',
        'Renaming Syntax: { key: newName } maps property "key" into a new variable named "newName".',
        'Array Destructuring: Invokes [Symbol.iterator](). Pulls values positionally via .next().',
        'Nested Destructuring: Evaluates parent property; if parent is null/undefined, throws TypeError: Cannot destructure property of null/undefined.'
      ],
      diagram: `OBJECT DESTRUCTURING:
Source Object: { port: 8080, db: 'postgres' }
Destructure:   const { port, db: database = 'mysql' } = source;
Result:        port = 8080, database = 'postgres'

DEFAULT TRIGGER RULE:
value === undefined  --> Default applied
value === null       --> Default IGNORED! (null is kept)`
    },
    codeExample: {
      code: `const serviceConfig = {
  host: 'api.production.internal',
  port: undefined, // Will trigger default!
  timeout: null,   // Will NOT trigger default!
  database: {
    connectionString: 'postgres://db:5432/core'
  }
};

// 1. Destructuring with Defaults and Renaming
const {
  host,
  port = 3000,
  timeout = 5000,
  database: { connectionString: dbUrl } // Nested + Renaming
} = serviceConfig;

console.log('host:', host);
console.log('port (default triggered):', port); // 3000 (because port was undefined)
console.log('timeout (null preserved!):', timeout); // null (NOT 5000!)
console.log('dbUrl (nested rename):', dbUrl);

// 2. Swapping variables without temporary variables
let x = 1, y = 2;
[x, y] = [y, x];
console.log('Swapped x, y:', x, y); // 2, 1`,
      language: 'javascript',
      output: `host: api.production.internal
port (default triggered): 3000
timeout (null preserved!): null
dbUrl (nested rename): postgres://db:5432/core
Swapped x, y: 2 1`,
      whyOutput:
        'Default values are only used when the property is strictly undefined. Since port was undefined, it defaulted to 3000. Because timeout was null, the default of 5000 was ignored and null was kept. "connectionString: dbUrl" extracted the nested property and bound it to a new identifier named dbUrl.',
      annotations: [
        'Line 13: Renames database.connectionString to dbUrl in a single step.',
        'Line 18: undefined triggers defaults; null does NOT trigger defaults.',
        'Line 24: Array destructuring allows elegant in-place variable swapping.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Extracting Environment Variables & Parsing Express Request Payloads',
      description:
        'In Node.js services, destructuring is standard practice for extracting configuration from process.env with default fallbacks, and extracting validated parameters from req.body or req.headers. It creates clean, self-documenting signatures for service functions.',
      codeSnippet: `// 1. Environment Config Extraction with Defaults
const {
  NODE_ENV = 'development',
  PORT = 8080,
  DATABASE_URL
} = process.env;

// 2. Express Controller signature unpacking
function handleCreateOrder({ body: { customerId, items = [] }, user }) {
  if (!items.length) throw new BadRequestError('Items required');
  return orderService.placeOrder(customerId, items, user.id);
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'When are default values evaluated in destructuring?',
          spokenAnswer:
            'Default values in destructuring are evaluated lazily, and they are triggered only when the extracted value is strictly equal to "undefined". If the property exists but has the value null, false, 0, or an empty string, the default value is ignored.'
        },
        {
          question: 'What happens if you destructure a property from null or undefined?',
          spokenAnswer:
            'It throws a TypeError: Cannot destructure property of null or undefined. To prevent this, always provide a default fallback for the parent object: const { name } = user || {};'
        }
      ],
      trickyFollowUp: {
        question: 'Does array destructuring work on any object?',
        answer:
          'No. Array destructuring only works on iterable objects that implement the [Symbol.iterator] method (such as Arrays, Strings, Sets, Maps, and TypedArrays). Attempting array destructuring on a plain object throws a TypeError: object is not iterable.'
      },
      commonMistakes: [
        'Confusing destructuring renaming ({ prop: newName }) with TypeScript type annotations.',
        'Assuming null triggers default values (only undefined triggers defaults).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Object destructuring uses property keys; array destructuring uses iteration order.',
        'Default values are triggered ONLY when the value is strictly undefined.',
        'Renaming syntax: { originalKey: newVariableName }.',
        'Always guard nested destructuring against null or undefined parents.'
      ],
      oneLineDefinition:
        'Destructuring is a declarative syntax for extracting data from objects and iterables into variables with support for defaults, renaming, and nesting.',
      interviewTip:
        'Emphasize that defaults trigger ONLY for undefined, never for null, 0, or false.'
    }
  },

  {
    id: 'spread-and-rest-operators',
    number: 17,
    title: 'Spread and Rest Operators',
    category: 'Objects and Data Handling',
    categorySlug: 'objects-data',
    estimatedMinutes: 5,
    concept30Sec:
      'Both Spread and Rest use the three-dot syntax (...), but perform opposite tasks. The Spread Operator unpacks elements of an array or properties of an object into individual components (used in function arguments, array literals, and object copying). The Rest Operator collects multiple elements or remaining parameters into a single array or object.',
    internals: {
      overview:
        'Spread on arrays/iterables invokes the iterator protocol ([Symbol.iterator]) to push elements sequentially into the target structure. Spread on objects uses [[OwnPropertyKeys]] to enumerate own enumerable string and symbol properties. The Rest parameter collects excess function arguments during parameter initialization into a genuine Array instance (unlike the legacy arguments object). In destructuring, rest must always be the last element.',
      flowSteps: [
        'Spread: Expands iterable/object into discrete items: [1, ...[2, 3]] -> [1, 2, 3].',
        'Rest: Condenses discrete items into a single container: (...args) gathers all arguments into an Array.',
        'Syntax Position: Rest appears on the left-hand side of assignments or in parameter lists. Spread appears on the right-hand side or in call arguments.'
      ],
      diagram: `SPREAD vs REST:
SPREAD (Unpacks):
[ ...[A, B], C ]  =======> [ A, B, C ]
{ ...obj1, key: 2 } =====> Merges keys into new object

REST (Gathers):
function log(msg, ...meta) ===> meta is a genuine Array of remaining arguments!
const [head, ...tail]     ===> tail is an Array of remaining elements!`
    },
    comparisonTable: {
      headers: ['Feature', 'Spread Operator (...)', 'Rest Operator (...)'],
      rows: [
        ['Purpose', 'Unpacks / expands elements', 'Gathers / condenses elements'],
        ['Location', 'Right-hand side of assignments, function call arguments, array/object literals', 'Function parameter declarations, left-hand side of destructuring'],
        ['Return Type', 'Individual values / merged structure', 'Always creates a genuine Array or Object'],
        ['Position Rule', 'Can appear anywhere in the literal', 'Must be the LAST parameter in the list']
      ]
    },
    codeExample: {
      code: `// 1. Rest Parameters: Clean variadic logging function
function createLogger(serviceName, ...tags) {
  // tags is a real JavaScript Array (supports .map, .filter)
  console.log('tags is Array?', Array.isArray(tags)); // true
  return \`[\${serviceName}] Tags: \${tags.join(', ')}\`;
}

console.log(createLogger('BillingAPI', 'p0', 'finance', 'critical'));

// 2. Spread: Merging configurations with shallow override
const baseConfig = { timeout: 1000, retries: 3, debug: false };
const envConfig = { debug: true, region: 'us-east-1' };

const finalConfig = { ...baseConfig, ...envConfig, port: 8080 };
console.log('Merged Config:', finalConfig);

// 3. Rest in Destructuring: Extracting and separating sensitive fields
const userRecord = { id: 101, username: 'alice', passwordHash: 'secret_hash', salt: 'xyz' };
const { passwordHash, salt, ...sanitizedUser } = userRecord;
console.log('Sanitized User:', sanitizedUser);`,
      language: 'javascript',
      output: `tags is Array? true
[BillingAPI] Tags: p0, finance, critical
Merged Config: { timeout: 1000, retries: 3, debug: true, region: 'us-east-1', port: 8080 }
Sanitized User: { id: 101, username: 'alice' }`,
      whyOutput:
        'In createLogger, "...tags" collects all arguments after serviceName into a genuine Array. In finalConfig, spread copies baseConfig keys, and envConfig keys overwrite matching keys (debug becomes true). In userRecord destructuring, rest gathers remaining non-destructured properties into sanitizedUser.',
      annotations: [
        'Line 2: Rest parameter gathers variable arguments into a true Array.',
        'Line 13: Spread merges objects; subsequent keys overwrite prior keys.',
        'Line 18: Rest in destructuring is the cleanest pattern for stripping sensitive fields.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Sanitizing Sensitive User Records & Building Variadic Middleware Chains',
      description:
        'In Node.js backends, rest in destructuring (const { password, ...safeUser } = user) is the industry standard for sanitizing database entities before returning them to HTTP clients. Spread is used when merging multi-tenant configuration overrides and combining middleware pipelines.',
      codeSnippet: `// Strip sensitive credentials before HTTP response
function sanitizeUserForResponse(userEntity) {
  const { passwordHash, resetToken, twoFactorSecret, ...publicUser } = userEntity;
  return publicUser;
}

// Variadic middleware wrapper:
function combineMiddlewares(...middlewares) {
  return (req, res, next) => {
    // Pipeline execution over middlewares array
  };
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the difference between the "arguments" object and Rest parameters?',
          spokenAnswer:
            '1) Rest parameters create a genuine Array instance that supports array methods like .map() and .filter(), whereas arguments is an array-like object; 2) Rest parameters can capture a subset of arguments (after named parameters), whereas arguments captures all parameters; 3) Arrow functions do NOT have an arguments object, but they DO support Rest parameters.'
        },
        {
          question: 'Why must a Rest parameter always be the last parameter in a function definition?',
          spokenAnswer:
            'Because the Rest parameter gathers all remaining arguments. If it were placed in the middle, the parser would have no deterministic way to know where the rest arguments end and the next named parameter begins. Placing rest anywhere other than the end throws a SyntaxError: Rest parameter must be last.'
        }
      ],
      trickyFollowUp: {
        question: 'Does the Spread operator perform a deep copy or a shallow copy?',
        answer:
          'Spread performs a shallow copy. It copies top-level properties by value, but nested objects and arrays are copied by reference pointer.'
      },
      commonMistakes: [
        'Placing a rest parameter before other parameters in a function signature or destructuring assignment.',
        'Using arguments inside arrow functions (it will refer to the enclosing regular function\'s arguments).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Spread unpacks iterables/objects; Rest gathers elements into an Array or Object.',
        'Rest must always be the final parameter in a list or destructuring pattern.',
        'Rest parameters create genuine Array instances; replaces legacy arguments object.',
        'Spread performs shallow copies only.'
      ],
      oneLineDefinition:
        'Spread expands elements from collections into individual values, while Rest condenses multiple values into a single collection.',
      interviewTip:
        'Remember: Rest gathers arguments on the left-hand side (definition); Spread expands elements on the right-hand side (usage).'
    }
  }
];
