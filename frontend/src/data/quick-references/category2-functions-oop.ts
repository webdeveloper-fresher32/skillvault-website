import { QuickReferenceTopic } from './types';

export const category2FunctionsOop: QuickReferenceTopic[] = [
  {
    id: 'this-keyword',
    number: 9,
    title: 'this Keyword',
    category: 'Functions and Object-Oriented JavaScript',
    categorySlug: 'functions-oop',
    estimatedMinutes: 5,
    concept30Sec:
      'In JavaScript, "this" is a special identifier whose value is dynamically determined by how and where a function is called (the call-site), rather than where it was defined. The four binding rules are: New Binding (constructor), Explicit Binding (call, apply, bind), Implicit Binding (calling method on an object), and Default Binding (global object or undefined in strict mode). Arrow functions ignore these rules and inherit this lexically.',
    internals: {
      overview:
        'When a function is called, V8 sets up its Execution Context and evaluates its call-site to determine the ThisBinding. It follows an exact precedence order: 1) Was it called with "new"? -> this points to the newly allocated instance. 2) Was it called with call, apply, or bind? -> this points to the specified thisArg. 3) Was it called as an object property (obj.fn())? -> this points to the context object. 4) Otherwise (bare invocation fn()) -> this is undefined in strict mode, or globalThis in non-strict.',
      flowSteps: [
        'Step 1: Check if Arrow Function. If yes, resolve "this" lexically via the outer scope chain.',
        'Step 2: Check "new" operator -> binds to newly constructed object instance.',
        'Step 3: Check explicit binding (call / apply / bind) -> binds to explicit thisArg.',
        'Step 4: Check implicit context (e.g. obj.method()) -> binds to obj.',
        'Step 5: Default fallback -> "undefined" in strict mode (Node.js modules are strict by default) or global.'
      ],
      diagram: `CALL-SITE "this" RESOLUTION ORDER:
+--------------------------------------------------------------+
| 1. Is it an Arrow Function?  --> Lexical "this" (outer scope)|
| 2. Called with "new"?        --> Newly instantiated object   |
| 3. Called with call/apply/bind? --> Specified thisArg object |
| 4. Called as obj.method()?   --> Context object before dot   |
| 5. Free invocation fn()?     --> undefined (Strict) / global |
+--------------------------------------------------------------+`
    },
    codeExample: {
      code: `'use strict';

const authService = {
  serviceName: 'OAuth2_Provider',
  getServiceName() {
    return this.serviceName;
  }
};

// 1. Implicit Binding
console.log('Implicit:', authService.getServiceName()); // OAuth2_Provider

// 2. Implicit Binding Loss: Classic trap!
const detachedFn = authService.getServiceName;
try {
  detachedFn(); // TypeError: Cannot read properties of undefined (reading 'serviceName')
} catch (err) {
  console.log('Detached Error:', err.message);
}

// 3. Explicit Binding (call / bind)
console.log('Explicit call:', detachedFn.call({ serviceName: 'LDAP_Provider' }));

const boundFn = detachedFn.bind(authService);
console.log('Bound:', boundFn());`,
      language: 'javascript',
      output: `Implicit: OAuth2_Provider
Detached Error: Cannot read properties of undefined (reading 'serviceName')
Explicit call: LDAP_Provider
Bound: OAuth2_Provider`,
      whyOutput:
        'In authService.getServiceName(), "this" is implicitly bound to authService because it is invoked directly via the object property. When assigned to detachedFn, the call-site becomes a free function invocation: detachedFn(). In strict mode, "this" defaults to undefined, throwing TypeError when reading .serviceName. Using .call() or .bind() explicitly restores the context.',
      annotations: [
        'Line 11: Invoked with object before the dot (Implicit binding).',
        'Line 14: Function reference detached from its parent object.',
        'Line 16: Free invocation in strict mode defaults "this" to undefined.',
        'Line 22: .call() explicitly injects a custom context object.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Class Method References in Express Route Handlers & EventEmitter Listeners',
      description:
        'In Node.js backend controllers written with ES6 classes, passing a class method directly to an Express route handler (e.g., "router.get(\'/users\', userController.getUsers)") causes implicit loss of "this". When Express calls the handler, "this" inside getUsers becomes undefined, crashing when accessing services (e.g. this.userRepo). Developers solve this using arrow class fields or explicit .bind(this) in the constructor.',
      codeSnippet: `class UserController {
  constructor(private userRepo) {
    // Solution A: Explicit binding in constructor
    this.getUsers = this.getUsers.bind(this);
  }

  // Solution B: Class field arrow function (lexical this)
  getUserById = async (req, res) => {
    const user = await this.userRepo.findById(req.params.id);
    res.json(user);
  };
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What are the 4 binding rules of the "this" keyword in JavaScript?',
          spokenAnswer:
            'In order of precedence: 1) New Binding (invoked with "new", binding to the new instance); 2) Explicit Binding (via call, apply, or bind); 3) Implicit Binding (invoked as an object method e.g. obj.method()); 4) Default Binding (free invocation, binding to undefined in strict mode or global/window in non-strict).'
        },
        {
          question: 'What is "this" at the top level of a Node.js CommonJS file?',
          spokenAnswer:
            'At the top level of a CommonJS file, "this" points to "module.exports" (an empty object {}), NOT "global". This is because Node wraps the file inside a function: (function (exports, require, module, __filename, __dirname) { ... }) where "this" is bound to exports.'
        }
      ],
      trickyFollowUp: {
        question: 'Can you override the "this" binding of an arrow function using call(), apply(), or bind()?',
        answer:
          'No. Arrow functions do NOT have their own "this" binding. Their "this" is resolved lexically at author time. Passing a thisArg to call, apply, or bind on an arrow function is silently ignored by the engine.'
      },
      commonMistakes: [
        'Passing class methods directly into Express route callbacks without binding "this".',
        'Thinking "this" refers to the function itself or its lexical scope.'
      ]
    },
    quickRevision: {
      takeaways: [
        '"this" is determined at call-time by the call-site, not at declaration.',
        'Precedence: new > call/apply/bind > obj.method() > undefined/global.',
        'Arrow functions have NO "this" binding; they inherit it lexically.',
        'In strict mode, bare function invocations bind "this" to undefined.'
      ],
      oneLineDefinition:
        '"this" is a contextual identifier dynamically bound at function invocation based on how the function was called.',
      interviewTip:
        'Recite the 4 rules in exact order: new > explicit (bind/call/apply) > implicit (obj.method) > default (undefined/global).'
    }
  },

  {
    id: 'arrow-vs-regular-functions',
    number: 10,
    title: 'Arrow Functions vs Regular Functions',
    category: 'Functions and Object-Oriented JavaScript',
    categorySlug: 'functions-oop',
    estimatedMinutes: 5,
    concept30Sec:
      'Arrow functions (introduced in ES6) provide a concise syntax and lexical "this" binding. Unlike regular functions, arrow functions do NOT have their own "this", "arguments", "super", or "new.target", cannot be used as constructors with "new", and do not possess a "prototype" property.',
    internals: {
      overview:
        'Regular functions have internal methods [[Call]] and [[Construct]], and they establish their own Execution Context with a fresh ThisBinding and ArgumentsObject. Arrow functions lack [[Construct]] and have an internal [[ThisMode]] set to "lexical". When V8 encounters an arrow function, it treats "this" and "arguments" just like standard variables, searching up the outer lexical scope chain.',
      flowSteps: [
        'Regular functions: V8 allocates [[Construct]], prototype property, and creates fresh "this" + "arguments" per call.',
        'Arrow functions: V8 allocates only [[Call]], skips prototype creation (saving memory), and resolves "this" lexically.',
        'Invoking "new ArrowFunction()" fails immediately because [[Construct]] is missing, throwing TypeError.'
      ],
      diagram: `REGULAR FUNCTION:                       ARROW FUNCTION:
+-------------------------------+       +-------------------------------+
| - Own "this" (dynamic)        |       | - Lexical "this" (outer scope)|
| - Own "arguments" object      |       | - NO "arguments" (use ...rest)|
| - Has .prototype property     |       | - NO .prototype property      |
| - Can be constructor (new Fn) |       | - Cannot be called with "new" |
+-------------------------------+       +-------------------------------+`
    },
    comparisonTable: {
      headers: ['Feature', 'Regular Function', 'Arrow Function'],
      rows: [
        ['"this" binding', 'Dynamic (call-site dependent)', 'Lexical (inherited from enclosing scope)'],
        ['Constructible (new)', 'Yes (has [[Construct]])', 'No (throws TypeError)'],
        ['"arguments" object', 'Yes (array-like object)', 'No (ReferenceError; use ...rest)'],
        ['prototype property', 'Yes (Fn.prototype)', 'No (undefined)'],
        ['Method definition', 'Ideal for prototype methods & object methods', 'Ideal for callbacks, promises, and functional pipelines']
      ]
    },
    codeExample: {
      code: `const worker = {
  workerId: 'WORKER_42',
  
  // Regular Function: "this" depends on call-site
  regularMethod: function () {
    return this.workerId;
  },

  // Arrow Function as Object Method: BINDING TRAP!
  arrowMethod: () => {
    return this?.workerId; // "this" is NOT worker! It is enclosing module exports
  },

  // Retaining context in async callbacks: Arrow shines!
  delayedReport: function () {
    setTimeout(() => {
      // Lexically captures "this" from delayedReport
      console.log('Delayed Report for:', this.workerId);
    }, 10);
  }
};

console.log('Regular:', worker.regularMethod()); // WORKER_42
console.log('Arrow Method:', worker.arrowMethod()); // undefined
worker.delayedReport(); // Delayed Report for: WORKER_42

// Constructor test:
try {
  const ArrowConstructor = () => {};
  new ArrowConstructor(); // TypeError: ArrowConstructor is not a constructor
} catch (err) {
  console.log('Constructor Error:', err.message);
}`,
      language: 'javascript',
      output: `Regular: WORKER_42
Arrow Method: undefined
Constructor Error: ArrowConstructor is not a constructor
Delayed Report for: WORKER_42`,
      whyOutput:
        'arrowMethod as an object literal method inherits "this" from the enclosing module scope (where workerId does not exist), returning undefined. Inside delayedReport, the arrow function in setTimeout lexically inherits "this" from delayedReport (which is worker). Attempting "new ArrowConstructor()" throws TypeError because arrow functions lack the [[Construct]] internal method.',
      annotations: [
        'Line 9: Object literals do NOT create a scope! Arrow functions inside them inherit outer scope.',
        'Line 16: Arrow functions inside methods preserve the parent method\'s "this" seamlessly.',
        'Line 27: Arrow functions lack [[Construct]], making them impossible to instantiate.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Handling Asynchronous Callbacks vs Mongoose / Mocha Traps in Node.js',
      description:
        'Arrow functions are standard for asynchronous promises, array methods (.map, .filter), and Express handlers. However, you MUST NOT use arrow functions in Mongoose pre/post middleware hooks (e.g. schema.pre("save", function() { this.password = hash(this.password); })) or Mocha test suites, because Mongoose and Mocha dynamically bind "this" to the document or test context.',
      codeSnippet: `// DANGEROUS MONGOOSE BUG:
userSchema.pre('save', () => {
  // "this" is undefined or global, NOT the document!
  // this.password will throw TypeError!
});

// CORRECT: Use regular function for Mongoose hooks
userSchema.pre('save', function (next) {
  if (this.isModified('password')) {
    this.password = bcrypt.hashSync(this.password, 10);
  }
  next();
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'When should you NOT use arrow functions?',
          spokenAnswer:
            'You should not use arrow functions in: 1) Object methods that need to access object properties via "this"; 2) Prototype methods; 3) Mongoose hooks or EventEmitter callbacks that expect a dynamic "this"; 4) Constructors (since arrow functions cannot be called with "new").'
        },
        {
          question: 'How do you access variable arguments in an arrow function?',
          spokenAnswer:
            'Since arrow functions do not have an "arguments" object, you use ES6 Rest Parameters: const fn = (...args) => console.log(args); Rest parameters create a genuine JavaScript array.'
        }
      ],
      trickyFollowUp: {
        question: 'Can you use "yield" inside an arrow function to create a generator?',
        answer:
          'No. Arrow functions cannot be used as generators. The syntax "function*" cannot be combined with "=>", and "yield" cannot be used inside an arrow function body.'
      },
      commonMistakes: [
        'Using arrow functions as Mongoose schema hooks or EventEmitter listeners that require "this".',
        'Using arrow functions for object methods and expecting "this" to refer to the object.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Arrow functions have lexical "this" inherited from enclosing scope.',
        'No "arguments", no "prototype", no "super", no "new.target".',
        'Cannot be used as constructors with "new".',
        'Avoid in object methods, prototype methods, and Mongoose hooks.'
      ],
      oneLineDefinition:
        'Arrow functions are concise, non-constructible functions with lexical "this" binding that inherit context from their enclosing scope.',
      interviewTip:
        'Always mention the two main architectural differences: lack of [[Construct]] (cannot use "new") and lack of own "this" (lexical resolution).'
    }
  },

  {
    id: 'prototypes-and-prototype-chain',
    number: 11,
    title: 'Prototypes and Prototype Chain',
    category: 'Functions and Object-Oriented JavaScript',
    categorySlug: 'functions-oop',
    estimatedMinutes: 5,
    concept30Sec:
      'Every JavaScript object has an internal link to another object called its prototype ([[Prototype]], exposed via Object.getPrototypeOf() or __proto__). When accessing a property on an object, JavaScript searches the object itself; if not found, it traverses up the prototype chain until it either finds the property or reaches null.',
    internals: {
      overview:
        'In V8, every object maintains a pointer to its prototype. Function objects have a .prototype property, which becomes the [[Prototype]] of instances created using "new Fn()". When evaluating "obj.prop", V8 first inspects the object\'s own HiddenClass / Shape. On a cache miss, V8 follows the [[Prototype]] pointer to the parent object, continuing until Object.prototype.[[Prototype]] === null, where it returns undefined.',
      flowSteps: [
        'Property Access: obj.propertyName evaluated.',
        'Check Own Properties: If present on obj, return immediately.',
        'Follow [[Prototype]] link: Traverse to obj.__proto__.',
        'Repeat recursively up the prototype chain.',
        'Terminal Check: Object.prototype.__proto__ is null. If still not found, return undefined.'
      ],
      diagram: `PROTOTYPE CHAIN TRAVERSAL:
[ instance (user1) ]
  own: { name: 'Alice' }
  [[Prototype]] -------------------> [ User.prototype ]
                                       methods: { getRole() }
                                       [[Prototype]] -----------> [ Object.prototype ]
                                                                    methods: { toString(), hasOwnProperty() }
                                                                    [[Prototype]] ---> null (End)`
    },
    codeExample: {
      code: `function DatabaseClient(connectionString) {
  this.connectionString = connectionString;
}

// Stored once on prototype (shared across all instances!)
DatabaseClient.prototype.connect = function () {
  return \`Connected to \${this.connectionString}\`;
};

const pgClient = new DatabaseClient('postgres://localhost:5432/main');

// 1. Calling prototype method
console.log(pgClient.connect()); // Connected to postgres://localhost:5432/main

// 2. Checking Own vs Prototype properties
console.log('Own connectionString:', pgClient.hasOwnProperty('connectionString')); // true
console.log('Own connect:', pgClient.hasOwnProperty('connect')); // false (lives on prototype!)

// 3. Inspecting the prototype chain
console.log(Object.getPrototypeOf(pgClient) === DatabaseClient.prototype); // true
console.log(Object.getPrototypeOf(DatabaseClient.prototype) === Object.prototype); // true
console.log(Object.getPrototypeOf(Object.prototype)); // null`,
      language: 'javascript',
      output: `Connected to postgres://localhost:5432/main
Own connectionString: true
Own connect: false
true
true
null`,
      whyOutput:
        'connect() is defined on DatabaseClient.prototype, not on pgClient directly. When pgClient.connect() is invoked, V8 does not find it on pgClient, looks up its prototype chain, finds it on DatabaseClient.prototype, and executes it with "this" bound to pgClient.',
      annotations: [
        'Line 6: Methods placed on prototype are shared in memory across 10,000+ instances.',
        'Line 16: hasOwnProperty verifies whether a property is direct or inherited.',
        'Line 21: The prototype chain terminates definitively at null.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Node.js Core Module Architecture & Prototype Pollution Vulnerabilities',
      description:
        'All core Node.js classes (EventEmitter, Stream, IncomingMessage) use prototype chains for high-performance inheritance. However, untrusted JSON parsing that allows keys like "__proto__" or "constructor.prototype" can cause Prototype Pollution, where an attacker injects malicious properties into Object.prototype, altering the behavior of every object in the Node.js process.',
      codeSnippet: `// Prototype Pollution Attack Mitigation
// Vulnerable merge: target[key] = source[key] where key is "__proto__"

// Defense A: Create objects with null prototype for dictionary maps
const safeCache = Object.create(null);
// safeCache has NO prototype chain, completely immune to prototype pollution!

// Defense B: Freeze the prototype in production bootstrap
Object.freeze(Object.prototype);`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the difference between "prototype" and "__proto__"?',
          spokenAnswer:
            '"prototype" is a property that exists only on constructor functions, defining what will become the prototype of objects created with "new". "__proto__" (or Object.getPrototypeOf) is an accessor property that exists on all object instances, pointing to the prototype object from which it inherits.'
        },
        {
          question: 'What is Prototype Pollution in Node.js?',
          spokenAnswer:
            'Prototype Pollution is a security vulnerability where an attacker injects properties into Object.prototype by exploiting recursive object merges with unvalidated user input (like "__proto__"). Since all objects inherit from Object.prototype, this can lead to remote code execution, denial of service, or authentication bypass.'
        }
      ],
      trickyFollowUp: {
        question: 'What happens when you write to a property that exists on the prototype chain (e.g. obj.sharedProp = 100)?',
        answer:
          'Writing to obj.sharedProp does NOT modify the prototype. Instead, JavaScript creates an "own property" directly on "obj" that shadows the prototype property for that specific instance.'
      },
      commonMistakes: [
        'Confusing the "prototype" property on functions with the internal [[Prototype]] link on instances.',
        'Modifying native prototypes like Object.prototype or Array.prototype in production.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Every object has an internal [[Prototype]] link pointing to its parent object.',
        'Prototype chain search stops at Object.prototype.[[Prototype]] === null.',
        'Methods on prototypes are shared in memory across all instances.',
        'Object.create(null) creates an object with no prototype (clean dictionary map).'
      ],
      oneLineDefinition:
        'The Prototype Chain is the series of linked prototype objects that JavaScript traverses to resolve properties and methods not found directly on an object.',
      interviewTip:
        'Always state: "Functions have .prototype; object instances have [[Prototype]] (accessible via Object.getPrototypeOf)." Terminates at null.'
    }
  },

  {
    id: 'prototypal-inheritance',
    number: 12,
    title: 'Prototypal Inheritance',
    category: 'Functions and Object-Oriented JavaScript',
    categorySlug: 'functions-oop',
    estimatedMinutes: 5,
    concept30Sec:
      'Prototypal Inheritance is JavaScript\'s mechanism of code reuse where objects inherit directly from other objects via prototype delegation, rather than through rigid class blueprints. ES6 "class" syntax is syntactic sugar over this prototypal delegation model, using Object.create() and constructor linking behind the scenes.',
    internals: {
      overview:
        'In classical OOP (Java/C++), classes are blueprints that copy structure into instances at compile time. In JavaScript, inheritance is dynamic delegation: instances retain a live pointer to a prototype object. When "class Child extends Parent" is compiled, V8 wires up two prototype chains: Child.prototype.__proto__ = Parent.prototype (for instance methods) and Child.__proto__ = Parent (for static methods).',
      flowSteps: [
        'Instance Creation: const c = new Child() creates an object whose [[Prototype]] is Child.prototype.',
        'Method Delegation: Calling c.parentMethod() checks c -> checks Child.prototype -> checks Parent.prototype.',
        'Static Delegation: Child.staticMethod() checks Child -> checks Parent.',
        'super() Invocation: Executes Parent constructor with the newly allocated "this" context.'
      ],
      diagram: `PROTOTYPAL INHERITANCE MAP (ES6 Class Sugar Under the Hood):
Child (Static chain) --------------> Parent
  ^                                    ^
  | new Child()                        | new Parent()
Child.prototype (Instance chain) --> Parent.prototype --> Object.prototype --> null`
    },
    codeExample: {
      code: `// Base Class
class BaseRepository {
  constructor(entityName) {
    this.entityName = entityName;
  }

  find(id) {
    return \`[\${this.entityName}] Found record id: \${id}\`;
  }
}

// Derived Class
class UserRepository extends BaseRepository {
  constructor() {
    super('USERS'); // Must call super() before accessing 'this'
  }

  findByEmail(email) {
    return \`[\${this.entityName}] Found user by email: \${email}\`;
  }
}

const userRepo = new UserRepository();

console.log(userRepo.find('usr_101')); // Inherited from BaseRepository
console.log(userRepo.findByEmail('dev@company.com')); // Defined on UserRepository
console.log(userRepo instanceof UserRepository); // true
console.log(userRepo instanceof BaseRepository); // true`,
      language: 'javascript',
      output: `[USERS] Found record id: usr_101
[USERS] Found user by email: dev@company.com
true
true`,
      whyOutput:
        'userRepo inherits from UserRepository.prototype, which in turn inherits from BaseRepository.prototype. Calling userRepo.find() delegates up the prototype chain to BaseRepository.prototype.find(), executing with "this" pointing to userRepo.',
      annotations: [
        'Line 13: super() invokes the BaseRepository constructor with the derived instance context.',
        'Line 22: find() is resolved by walking the prototype chain to BaseRepository.prototype.',
        'Line 24: instanceof traverses the prototype chain to verify inheritance.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Custom Production Error Hierarchies & EventEmitter Subclasses',
      description:
        'In production Node.js backends, prototypal inheritance is the standard design pattern for building custom error hierarchies (AppError, ValidationError, DatabaseError) that retain V8 stack traces via Error.captureStackTrace, and for extending core classes like EventEmitter.',
      codeSnippet: `// Production Custom Error Hierarchy
export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(\`\${resource} not found\`, 404);
  }
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Is JavaScript\'s "class" syntax true object-oriented programming?',
          spokenAnswer:
            'No. The "class" syntax in JavaScript is syntactic sugar over prototype-based inheritance. Under the hood, JavaScript continues to use prototype delegation where objects delegate property lookups to other objects via the prototype chain.'
        },
        {
          question: 'Why must you call super() before accessing "this" in a derived class constructor?',
          spokenAnswer:
            'In ES6 class inheritance, the child constructor does not create its own "this" object. Instead, the parent constructor is responsible for allocating the instance, which is done when super() is called. Accessing "this" before super() throws a ReferenceError.'
        }
      ],
      trickyFollowUp: {
        question: 'How do static methods inherit in ES6 classes?',
        answer:
          'Static methods inherit through the function object\'s prototype chain. V8 sets "Child.__proto__ = Parent". Therefore, calling Child.staticMethod() delegates up to Parent.staticMethod().'
      },
      commonMistakes: [
        'Thinking classes create a new OOP paradigm in JavaScript (it is still 100% prototype delegation).',
        'Accessing "this" before calling super() in a derived constructor.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Prototypal inheritance uses delegation, not class cloning.',
        'ES6 class is syntactic sugar over constructor functions and prototype chaining.',
        'super() must be called before accessing "this" in a derived constructor.',
        'instanceof checks if constructor.prototype appears anywhere along the prototype chain.'
      ],
      oneLineDefinition:
        'Prototypal Inheritance is the delegation pattern where an object delegates unresolved property and method lookups to linked prototype objects.',
      interviewTip:
        'Explain that class inheritance sets up two prototype chains: one for instance methods (Child.prototype -> Parent.prototype) and one for static methods (Child -> Parent).'
    }
  },

  {
    id: 'call-apply-bind',
    number: 13,
    title: 'call(), apply(), bind()',
    category: 'Functions and Object-Oriented JavaScript',
    categorySlug: 'functions-oop',
    estimatedMinutes: 5,
    concept30Sec:
      'call(), apply(), and bind() are methods on Function.prototype used to explicitly set the "this" context when invoking a function. call() and apply() invoke the function immediately—call() takes arguments as a comma-separated list, while apply() takes them as an array. bind() does NOT invoke the function; it returns a new bound function with its "this" and initial arguments permanently locked.',
    internals: {
      overview:
        'In V8, call() and apply() pass the thisArg directly to the internal [[Call]] method of the function. bind() creates an "Exotic Bound Function" object with internal slots [[BoundTargetFunction]], [[BoundThis]], and [[BoundArguments]]. Whenever the bound function is invoked, V8 executes the target function with the pre-configured [[BoundThis]], regardless of how or where it is called.',
      flowSteps: [
        'fn.call(thisArg, a, b): Invokes fn immediately with this = thisArg and arguments a, b.',
        'fn.apply(thisArg, [a, b]): Invokes fn immediately with this = thisArg and unpacks the arguments array.',
        'fn.bind(thisArg, a): Returns a new function with "this" permanently locked to thisArg and "a" partially applied.',
        'Hard Binding: A bound function cannot have its "this" overridden by subsequent .call() or .bind() calls (except when invoked with "new").'
      ],
      diagram: `EXPLICIT BINDING COMPARISON:
+--------------------------------------------------------------------------+
| Method  | Invocation | Arguments Format       | Return Value             |
+---------+------------+------------------------+--------------------------+
| call()  | Immediate  | Comma-separated (a, b) | Function execution result|
| apply() | Immediate  | Array ([a, b])         | Function execution result|
| bind()  | Deferred   | Comma-separated (a, b) | New Bound Function       |
+--------------------------------------------------------------------------+`
    },
    codeExample: {
      code: `function executeQuery(table, limit) {
  return \`[\${this.dbName}]: SELECT * FROM \${table} LIMIT \${limit}\`;
}

const pgContext = { dbName: 'PostgreSQL_Prod' };
const mongoContext = { dbName: 'MongoDB_Analytics' };

// 1. call(): Arguments passed individually
console.log(executeQuery.call(pgContext, 'users', 10));

// 2. apply(): Arguments passed as an array
console.log(executeQuery.apply(mongoContext, ['events', 50]));

// 3. bind(): Returns a permanent bound function (Currying / Partial Application)
const queryPgUsers = executeQuery.bind(pgContext, 'users');
console.log(queryPgUsers(100)); // table is pre-filled as 'users', limit is 100

// 4. Trap: Re-binding a bound function has NO effect!
const reBound = queryPgUsers.bind(mongoContext);
console.log(reBound(5)); // Still outputs PostgreSQL_Prod!`,
      language: 'javascript',
      output: `[PostgreSQL_Prod]: SELECT * FROM users LIMIT 10
[MongoDB_Analytics]: SELECT * FROM events LIMIT 50
[PostgreSQL_Prod]: SELECT * FROM users LIMIT 100
[PostgreSQL_Prod]: SELECT * FROM users LIMIT 5`,
      whyOutput:
        'call() executes with pgContext and comma-separated args. apply() executes with mongoContext and an array of args. bind() locks pgContext and the "users" argument into a new exotic bound function. Attempting to re-bind a bound function fails because V8\'s internal [[BoundThis]] cannot be overwritten.',
      annotations: [
        'Line 9: call takes arguments as a comma-separated list.',
        'Line 12: apply takes arguments as a single array.',
        'Line 15: bind locks this and pre-sets the first argument (partial application).',
        'Line 20: Once bound, a function\'s this context CANNOT be overridden by subsequent bind calls.'
      ]
    },
    nodeJsApplication: {
      scenario: 'Method Borrowing & Preserving Context in Event Listeners and Streams',
      description:
        'In Node.js, call() is used for method borrowing—such as safely checking properties with Object.prototype.hasOwnProperty.call(obj, key) to protect against objects created with Object.create(null) or malicious prototype overrides. bind() is widely used to bind class methods to stream "data" and "end" events.',
      codeSnippet: `// 1. Safe Method Borrowing in Request Validation
function hasSafeProperty(payload, propertyName) {
  // Safe even if payload is Object.create(null) or has a fake hasOwnProperty
  return Object.prototype.hasOwnProperty.call(payload, propertyName);
}

// 2. Preserving context on Node.js Stream events
class DataPipeline {
  start(stream) {
    stream.on('data', this.handleChunk.bind(this));
  }
  handleChunk(chunk) {
    this.process(chunk); // "this" preserved!
  }
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the difference between call(), apply(), and bind()?',
          spokenAnswer:
            'call and apply invoke the function immediately with an explicit "this", with call accepting comma-separated arguments and apply accepting an array of arguments. bind does not execute the function; it returns a new bound function with "this" and optional initial arguments permanently locked.'
        },
        {
          question: 'Can you override the "this" of a function that was already bound with bind()?',
          spokenAnswer:
            'No. A bound function\'s "this" cannot be overridden by calling .call(), .apply(), or another .bind(). The only exception is calling it as a constructor with "new", where "new" overrides the bound "this" with the newly created instance.'
        }
      ],
      trickyFollowUp: {
        question: 'Why is Object.prototype.hasOwnProperty.call(obj, prop) preferred over obj.hasOwnProperty(prop)?',
        answer:
          'Because if "obj" was created using Object.create(null), it has no prototype and calling obj.hasOwnProperty() throws a TypeError. Additionally, user-supplied JSON input could contain a malicious key named "hasOwnProperty" that shadows the native method.'
      },
      commonMistakes: [
        'Attempting to re-bind a function created with .bind() and expecting the new context to take effect.',
        'Using .bind() inside hot loops or high-frequency request handlers (allocates a new function object on each iteration).'
      ]
    },
    quickRevision: {
      takeaways: [
        'call(thisArg, arg1, arg2) = immediate call with argument list.',
        'apply(thisArg, [args]) = immediate call with argument array.',
        'bind(thisArg, arg1) = returns a new bound function with locked "this".',
        'Method borrowing: Object.prototype.hasOwnProperty.call(obj, key) is the safest validation pattern.'
      ],
      oneLineDefinition:
        'call, apply, and bind explicitly set the "this" context of a function: call and apply invoke immediately, while bind returns a permanently bound function.',
      interviewTip:
        'Mnemonic: "C" in call = Comma-separated; "A" in apply = Array; "B" in bind = Brand-new bound function.'
    }
  }
];
