import { QuickReferenceTopic } from './types';

export const expressCategory1Fundamentals: QuickReferenceTopic[] = [
  {
    id: 'express-architecture',
    number: 1,
    title: 'Express Architecture',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Express Fundamentals and Architecture',
    categorySlug: 'express-fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'Express is a minimalist, unopinionated web framework for Node.js built directly on top of the native node:http module. Internally, an Express application is essentially a callable request handler backed by a layered pipeline of middleware functions and routers that sequentially inspect and transform incoming HTTP requests.',
    internals: {
      overview:
        'When you create an Express application via const app = express(), you instantiate a function that inherits from proto (application.js). Under the hood, app(req, res, next) is passed directly to http.createServer(app). Express initializes an internal Router instance. Every call to app.use() or app.get() pushes a new Layer object into the router stack. Each Layer contains a path regexp, route, and dispatch handler.',
      flowSteps: [
        '1. Instantiation: express() creates an app function wrapping internal Router and EventEmitter prototypes.',
        '2. Server Binding: http.createServer(app) connects Node.js socket events to the Express entry point.',
        '3. Request Arrival: Node http module parses HTTP headers and dispatches (req, res) to app.handle(req, res).',
        '4. Prototype Delegation: Express enhances native req and res by linking prototypes (request.js and response.js), adding helpers like res.json() and req.get().',
        '5. Router Traversal: app._router.handle(req, res, done) iterates sequentially through its array of Layer objects.',
        '6. Response Finalization: A route handler or middleware invokes res.send() / res.json(), which formats data, sets headers, calls res.end(), and terminates the pipeline.'
      ],
      diagram: `EXPRESS ARCHITECTURAL PIPELINE:

  Client HTTP Request
          |
          v
  +-------------------------------------------------------+
  | Node.js Native HTTP Server: http.createServer(app)    |
  | (Parses TCP stream, instantiates IncomingMessage/res) |
  +-------------------------------------------------------+
          |
          v
  +-------------------------------------------------------+
  | Express App Dispatcher: app.handle(req, res)         |
  | (Prototype decorators applied: req.params, res.json)  |
  +-------------------------------------------------------+
          |
          v
  +-------------------------------------------------------+
  | Router Stack (Array of Layers)                        |
  |  [ Layer 1: express.json() body parser ]              |
  |         | next()                                      |
  |  [ Layer 2: Custom Request Logger ]                   |
  |         | next()                                      |
  |  [ Layer 3: Router ('/api/v1') ]                      |
  |         | matches path -> enters Route Layer Stack    |
  |  [ Layer 4: Controller Handler (res.json) ]           |
  +-------------------------------------------------------+
          |
          v
  Client HTTP Response (res.end)`
    },
    codeExample: {
      code: `import express from 'express';
import http from 'node:http';

const app = express();

// Middleware Layer 1: Body parsing
app.use(express.json());

// Middleware Layer 2: Custom request decorator
app.use((req, res, next) => {
  req.receivedAt = Date.now();
  next();
});

// Route Layer: Controller
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    latencyMs: Date.now() - req.receivedAt
  });
});

// Express app is just a request handler passed to native http!
const server = http.createServer(app);
server.listen(3000, () => {
  console.log('Server running on port 3000');
});`,
      language: 'javascript',
      output: `GET /health HTTP/1.1
Host: localhost:3000

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "status": "healthy",
  "uptimeSeconds": 42,
  "latencyMs": 1
}`,
      whyOutput:
        'When a request hits port 3000, the native HTTP server delegates (req, res) to app.handle. Layer 1 parses JSON (empty here). Layer 2 stamps receivedAt. Layer 3 matches GET /health and sends the JSON response via res.json(), which serializes the object, sets Content-Type, and closes the response stream.'
    },
    nodeJsApplication: {
      scenario: 'High-Throughput Enterprise Microservice Base',
      description:
        'Because Express is a thin layer over node:http, understanding its router stack allows engineers to tune middleware order, eliminate redundant layers, and mount decoupled modular micro-routers across multi-tenant API platforms.',
      codeSnippet: `// Mounting modular sub-applications
import express from 'express';
const app = express();

const v1TenantRouter = express.Router({ mergeParams: true });
v1TenantRouter.get('/billing', (req, res) => {
  res.json({ tenantId: req.params.tenantId, tier: 'enterprise' });
});

app.use('/api/:tenantId/v1', v1TenantRouter);`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is Express under the hood and how does it relate to the native Node.js http module?',
          spokenAnswer:
            'Express is fundamentally a middleware-centric routing engine built on top of Node.js native node:http module. When you call express(), it returns a function that takes req and res and can be passed directly to http.createServer(app). Express decorates the native IncomingMessage and ServerResponse prototypes with helper methods like res.json() and req.get(), and manages an internal array of Layer objects representing middleware and routes.'
        },
        {
          question: 'What is an Express Layer object internally?',
          spokenAnswer:
            'In Express internal Router, every middleware, sub-router, and route handler is stored as a Layer object. A Layer encapsulates a compiled regular expression for path matching (via path-to-regexp), the path string, and the dispatch handle function. When a request arrives, the router iterates sequentially through these layers, executing matching handles.'
        }
      ],
      trickyFollowUp: {
        question: 'Does app.listen() create something different from http.createServer(app).listen()?',
        answer:
          'No! app.listen() is strictly a convenience wrapper. Source code in application.js literally does: const server = http.createServer(this); return server.listen(...arguments). However, creating the server manually is preferred in production because you need the server reference to attach WebSockets (Socket.io) or HTTPS certificates.'
      },
      commonMistakes: [
        'Believing Express is an asynchronous framework by default: route handlers were callback-driven prior to Express 5; unhandled async errors in Express 4 silently hang the connection.',
        'Thinking Express has built-in ORM, dependency injection, or validation: Express is strictly a minimalist HTTP routing layer.',
        'Modifying the global prototype of req or res improperly, causing memory leaks across concurrent requests.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Express is a thin routing wrapper around node:http, delegating requests through a sequential array of Layer objects.',
        'app is a callable function: http.createServer(app) is identical to app.listen().',
        'Express enhances native req and res without replacing their underlying stream mechanics.'
      ],
      oneLineDefinition:
        'Express is a minimalist Node.js routing and middleware framework that processes HTTP requests through a pipeline of sequential Layer objects.',
      interviewTip:
        'Highlight that app is simply a request listener passed to http.createServer(app) to demonstrate foundational Node.js mastery.',
      keyDistinction:
        'Express vs Native node:http: node:http handles raw TCP parsing and low-level streams; Express adds routing, middleware pipelines, and declarative response helpers.'
    }
  },
  {
    id: 'express-project-structure',
    number: 2,
    title: 'Project Structure',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Express Fundamentals and Architecture',
    categorySlug: 'express-fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'A production Express application requires a modular, layered directory structure separating routing, transport, business logic, data access, and configuration. Structuring projects by feature or technical layer avoids tightly coupled "god files" and allows codebases to scale cleanly across teams.',
    internals: {
      overview:
        'In small demos, routes, DB queries, and validation are stuffed into server.js. In production, this causes spaghetti code and untestable logic. The industry-standard 3-tier architecture divides concerns: 1) Transport Layer (Routes & Controllers) handles HTTP parsing and response formatting; 2) Business Layer (Services) executes domain logic independent of HTTP; 3) Data Layer (Repositories/DAOs) communicates with databases. Separate directories house middlewares, validators, configs, and utilities.',
      flowSteps: [
        '1. Entry Point (server.ts): Connects DB, binds port, handles graceful shutdown.',
        '2. App Factory (app.ts): Assembles Express instance, registers global middlewares, and mounts top-level routes.',
        '3. Routes (/routes): Defines URLs and binds middleware pipelines to controllers.',
        '4. Controllers (/controllers): Extracts req.body/params, invokes services, and sends HTTP status/data.',
        '5. Services (/services): Pure business logic (e.g., hash passwords, calculate totals, call Stripe). No req/res references!',
        '6. Repositories (/repositories): SQL queries or ORM queries isolating database schemas from business rules.'
      ],
      diagram: `ENTERPRISE EXPRESS 3-TIER DIRECTORY STRUCTURE:

src/
├── app.ts                  # Express app initialization & middleware assembly
├── server.ts               # HTTP server start, DB connect & process signals
├── config/                 # Environment variables & constants
├── constants/              # Error codes, HTTP statuses
├── middlewares/            # Auth, rate-limit, validation, centralized error
├── routes/                 # Express Router instances (/api/v1/users, /orders)
├── controllers/            # Request parsing & HTTP response formatting
├── services/               # Pure business domain logic (No req/res!)
├── repositories/           # Database queries (Prisma, TypeORM, Mongoose)
├── models/                 # Database entity types & interfaces
├── validations/            # Zod / Joi validation schemas
└── utils/                  # Logger (Pino), AppError, helpers`
    },
    codeExample: {
      code: `// src/app.ts - Clean Application Assembly
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
// import { apiRouter } from './routes';
// import { errorHandler } from './middlewares/errorHandler';

export function createApp() {
  const app = express();

  // 1. Core Security & Parsing Middleware
  app.use(helmet());
  app.use(cors({ origin: process.env.ALLOWED_ORIGIN }));
  app.use(express.json({ limit: '10kb' }));

  // 2. Health check route (unauthenticated)
  app.get('/healthz', (req, res) => res.status(200).send('OK'));

  // 3. Mount versioned API routes
  // app.use('/api/v1', apiRouter);

  // 4. Centralized Error Handling (MUST be last)
  // app.use(errorHandler);

  return app;
}

// src/server.ts - Server Entry Point
// const app = createApp();
// app.listen(process.env.PORT || 8080);`,
      language: 'javascript',
      output: `// Decoupled structure allows unit testing createApp() with Supertest without binding network ports!`,
      whyOutput:
        'Separating app.ts (the Express configuration) from server.ts (the network listening code) allows integration test suites to import createApp() directly and run requests using Supertest in-memory without conflicting on open TCP ports.'
    },
    nodeJsApplication: {
      scenario: 'High-Velocity Monolith or Modular Microservice',
      description:
        'When onboarding 20 developers to an enterprise SaaS backend, a strict 3-tier structure guarantees that front-end API changes only touch Controllers, database schema changes only touch Repositories, and business rules remain isolated in Services.',
      codeSnippet: `// Controller remains completely clean:
export class OrderController {
  constructor(private orderService: OrderService) {}

  createOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await this.orderService.checkout(req.user.id, req.body.items);
      res.status(201).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  };
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Why should you separate app.js from server.js / index.js in an Express project?',
          spokenAnswer:
            'Separating app.js from server.js isolates the Express application configuration from network port binding. app.js configures middleware and routes, while server.js handles database connection pools and calls server.listen(). This separation is crucial for automated testing: test frameworks like Supertest can import app.js and execute HTTP requests in-memory without binding actual TCP sockets or causing EADDRINUSE port collisions.'
        },
        {
          question: 'Why is it considered an anti-pattern to pass "req" or "res" into Service layer methods?',
          spokenAnswer:
            'Passing req or res into services tightly couples your core business logic to the HTTP transport layer. Services should accept clean JavaScript parameters (e.g. userId, amount) and return domain objects. This ensures business rules can be reused in non-HTTP contexts—such as Kafka message consumers, CLI cron jobs, or WebSocket handlers—and makes unit testing trivial without needing to mock complex Express objects.'
        }
      ],
      trickyFollowUp: {
        question: 'When should you organize by layer (controllers, services, repositories) versus by feature (users, orders, payments)?',
        answer:
          'For small-to-medium codebases, organization by layer is clear and intuitive. However, for large enterprise applications, organization by feature (Vertical Slice Architecture) is superior. Grouping users.controller, users.service, users.repo, and users.routes in a single /modules/users folder improves cohesion and prevents developers from navigating across 10 folders for a single feature.'
      },
      commonMistakes: [
        'Writing SQL queries directly inside Express route callbacks.',
        'Putting business logic inside controllers instead of keeping controllers strictly responsible for HTTP parsing.',
        'Binding the HTTP server inside app.js, preventing headless testing.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Always decouple app.js (configuration/routes) from server.js (network listener & DB bootstrap).',
        '3-Tier Architecture: Controllers (HTTP) -> Services (Domain Logic) -> Repositories (Data Access).',
        'Never pass Express req or res into the service or repository layers.'
      ],
      oneLineDefinition:
        'Enterprise Express project structure cleanly isolates HTTP transport, domain business logic, and database access into modular testable layers.',
      interviewTip:
        'Mention "Headless testing with Supertest without EADDRINUSE collisions" when asked why app and server are split.',
      keyDistinction:
        'Layered Architecture vs Feature/Slice Architecture: Layered groups by technical function; Feature groups by domain boundary (e.g., auth, billing).'
    }
  },
  {
    id: 'express-routing',
    number: 3,
    title: 'Routing',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Express Fundamentals and Architecture',
    categorySlug: 'express-fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'Routing refers to how an Express application defines endpoints (URIs) and responds to client requests via HTTP methods (GET, POST, PUT, DELETE, PATCH). Express provides express.Router() to create modular, mountable, and isolated mini-applications with their own dedicated middleware pipelines.',
    internals: {
      overview:
        'When you call express.Router(), Express instantiates an isolated router function that possesses its own internal stack of Layer objects. When mounted via app.use("/api/v1/users", userRouter), Express pushes a parent Layer matching the prefix /api/v1/users. When a request matches this prefix, Express strips the mount path, adjusts req.baseUrl and req.url, and delegates internal traversal to the child router.',
      flowSteps: [
        '1. Route Registration: router.get("/:id", handler) compiles "/:id" into a regular expression using path-to-regexp.',
        '2. Layer Construction: Creates a Route object containing the method-specific handlers, wrapped inside a router Layer.',
        '3. Mounting: app.use("/users", router) registers the sub-router in the parent application stack.',
        '4. URL Matching: When GET /users/42 arrives, the parent router matches "/users", strips it, and passes control to the sub-router.',
        '5. Parameter Parsing: The sub-router matches "/:id", extracts keys from the regex captures, and attaches req.params.id = "42".',
        '6. Handler Execution: Dispatches the array of middleware and route handlers assigned to that route.'
      ],
      diagram: `ROUTER MOUNTING & PATH STRIPPING:

Incoming URL:  GET /api/v1/orders/ORD-99
                      |
                      v
Parent Stack:    [ Layer: Prefix '/api/v1' ]  --> Matches! req.baseUrl = '/api/v1'
                      |
                      v
Sub-Router:      [ Layer: Prefix '/orders' ]  --> Matches! req.baseUrl = '/api/v1/orders'
                      |
                      v
Route Stack:     [ Route: '/:orderId' ]       --> Matches! req.params = { orderId: 'ORD-99' }
                      |
                      +--> [ authMiddleware ] -> next()
                      +--> [ getOrderController ] -> res.json(order)`
    },
    codeExample: {
      code: `import express from 'express';

const app = express();

// 1. Create a modular sub-router
const productRouter = express.Router();

// Middleware scoped exclusively to product routes:
productRouter.use((req, res, next) => {
  console.log(\`Product Route Accessed: \${req.method} \${req.originalUrl}\`);
  next();
});

// Chained Route Definition: DRY syntax for identical paths
productRouter.route('/')
  .get((req, res) => res.json({ products: ['Laptop', 'Keyboard'] }))
  .post((req, res) => res.status(201).json({ message: 'Product created' }));

productRouter.get('/:sku', (req, res) => {
  res.json({ sku: req.params.sku, inStock: true });
});

// 2. Mount the sub-router under a namespace
app.use('/api/v1/products', productRouter);`,
      language: 'javascript',
      output: `GET /api/v1/products/SKU-4821 HTTP/1.1

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "sku": "SKU-4821",
  "inStock": true
}`,
      whyOutput:
        'The request matches parent prefix /api/v1/products and delegates to productRouter. The router-level middleware logs the request, then /:sku matches the path, assigning req.params.sku = "SKU-4821" and returning the JSON payload.'
    },
    nodeJsApplication: {
      scenario: 'Multi-Tenant Nested Routing with mergeParams',
      description:
        'In multi-tenant SaaS applications, routes are often nested such as /organizations/:orgId/projects/:projectId/tasks. By default, child routers cannot see parent route parameters. Setting express.Router({ mergeParams: true }) allows nested sub-routers to access parent params seamlessly.',
      codeSnippet: `// Parent Router
const projectRouter = express.Router({ mergeParams: true });

// Child Router (nested under projects)
const taskRouter = express.Router({ mergeParams: true }); // MUST specify mergeParams: true!

taskRouter.get('/:taskId', (req, res) => {
  // Both parent :projectId and child :taskId are accessible!
  const { projectId, taskId } = req.params;
  res.json({ projectId, taskId });
});

projectRouter.use('/:projectId/tasks', taskRouter);
app.use('/api/projects', projectRouter);`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the purpose of "mergeParams: true" in express.Router()?',
          spokenAnswer:
            'By default, child routers do not have access to route parameters defined on parent routers. When you nest routers (e.g. app.use("/users/:userId/posts", postRouter)), setting express.Router({ mergeParams: true }) on the child router ensures that req.params from the parent router (userId) are merged into the child router request object, making parent parameters accessible inside child route handlers.'
        },
        {
          question: 'What is the difference between app.route() and router.route()?',
          spokenAnswer:
            'Both provide a chained route handler pattern to avoid duplicate route name declarations. For instance, router.route("/users").get(getUsers).post(createUser) groups different HTTP verbs for the exact same URI path into a clean, DRY definition.'
        }
      ],
      trickyFollowUp: {
        question: 'What breaking change occurred in route matching between Express 4 and Express 5?',
        answer:
          'Express 5 upgraded its underlying path-to-regexp parser from v0.1.x to v8.x. In Express 5, regular expression wildcards (like *) must be explicitly named (e.g. /*splat or /(.*)), and parameter regex syntax changed. Unescaped special characters like parentheses or colons in URLs will throw compile-time errors in Express 5.'
      },
      commonMistakes: [
        'Forgetting mergeParams: true in nested routers and wondering why req.params.parentId is undefined.',
        'Registering dynamic routes like /:id before static routes like /summary, causing the dynamic route to swallow the static path.',
        'Not handling HTTP 405 Method Not Allowed when defining REST endpoints.'
      ]
    },
    quickRevision: {
      takeaways: [
        'express.Router() creates isolated mini-apps with their own middleware stacks and route layers.',
        'Always set { mergeParams: true } when building nested sub-routers that need parent URL parameters.',
        'Use router.route(path).get().post() to keep multi-verb endpoints clean and DRY.'
      ],
      oneLineDefinition:
        'Express Routing maps HTTP verbs and URI patterns to modular middleware and handler pipelines using compiled path-to-regexp Layer stacks.',
      interviewTip:
        'Mention "mergeParams: true" and Express 5 path-to-regexp v8 changes to demonstrate deep senior-level routing knowledge.',
      keyDistinction:
        'app.use() vs app.get(): app.use matches path prefixes regardless of HTTP method; app.get strictly matches exact paths on HTTP GET.'
    }
  },
  {
    id: 'express-route-query-params',
    number: 4,
    title: 'Route Parameters and Query Parameters',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Express Fundamentals and Architecture',
    categorySlug: 'express-fundamentals',
    estimatedMinutes: 5,
    concept30Sec:
      'Route parameters (req.params) are named URL segments used to identify specific resources in RESTful path hierarchies (e.g., /users/:id). Query parameters (req.query) are optional key-value pairs appended after the question mark in URLs (e.g., ?page=2&sort=desc) used for filtering, pagination, and sorting.',
    internals: {
      overview:
        'Express extracts route parameters by compiling path strings with path-to-regexp into a RegExp with named capture groups. When a URL matches, the regex captures are mapped to keys on req.params. Query parameters are parsed by an internal query parser: Express uses the node:querystring module or the qs library (configured via app.set("query parser", "extended")). All parameter values default to strings.',
      flowSteps: [
        '1. URL Arrival: GET /products/849?inStock=true&limit=20 arrives at socket.',
        '2. Path Extraction: Path is /products/849; Query string is inStock=true&limit=20.',
        '3. Route Matching: /products/:id pattern matches /products/849.',
        '4. Route Params Population: Express sets req.params = { id: "849" } (Note: "849" is a STRING, not a number!).',
        '5. Query String Parsing: Express runs the configured query parser, populating req.query = { inStock: "true", limit: "20" }.',
        '6. Param Middleware: If registered, app.param("id", fn) executes automatically before the route handler runs.'
      ],
      diagram: `ROUTE PARAMS VS QUERY PARAMS:

URL:  https://api.store.com/v1/categories/electronics/products?brand=apple&sort=price_asc
                                |                        |     |
                                v                        |     v
                       Route Parameter                   |  Query Parameters
                       req.params = {                    |  req.query = {
                         category: "electronics"         |    brand: "apple",
                       }                                 |    sort: "price_asc"
                                                         }  }`
    },
    codeExample: {
      code: `import express from 'express';

const app = express();

// Automatic parameter validation & pre-loading via app.param()
app.param('userId', (req, res, next, id) => {
  const parsedId = Number(id);
  if (isNaN(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'Invalid User ID format: must be positive integer' });
  }
  req.validatedUserId = parsedId;
  next();
});

// Route handling both Route Params and Query Params
app.get('/users/:userId/orders', (req, res) => {
  const userId = req.validatedUserId;

  // IMPORTANT: All query parameters are strings by default!
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 100);
  const status = req.query.status || 'ALL';

  res.json({
    userId,
    pagination: { page, limit },
    filter: { status }
  });
});`,
      language: 'javascript',
      output: `GET /users/105/orders?page=2&limit=25&status=SHIPPED HTTP/1.1

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "userId": 105,
  "pagination": { "page": 2, "limit": 25 },
  "filter": { "status": "SHIPPED" }
}`,
      whyOutput:
        'app.param("userId") intercepts the route param "105", validates it as an integer, and attaches it as req.validatedUserId. The route handler then parses optional query parameters (page, limit, status), coercing strings to safe integers with bounds checking.'
    },
    nodeJsApplication: {
      scenario: 'Preventing Prototype Pollution & Type Injection in Queries',
      description:
        'With extended query parsing ("extended" uses the qs library), queries like ?filter[__proto__]=polluted or nested arrays like ?id[]=1&id[]=2 can cause type confusion or security vulnerabilities. Senior engineers explicitly parse and validate query parameters with Zod before using them in database queries.',
      codeSnippet: `import { z } from 'zod';

const OrderQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc')
});

app.get('/orders', (req, res, next) => {
  const result = OrderQuerySchema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() });
  }
  const { page, limit, sort } = result.data; // Fully typed & sanitized!
  // Safe to pass to database query
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the fundamental REST distinction between Route Parameters and Query Parameters?',
          spokenAnswer:
            'Route parameters identify a specific resource or entity hierarchy in the URI path—such as /users/:id or /teams/:teamId/members/:memberId. If the parameter is missing, the route does not match (returns 404). Query parameters represent optional modifiers—such as filtering (?status=active), sorting (?sort=created_at), and pagination (?page=1&limit=20). Removing query parameters still targets the valid collection resource.'
        },
        {
          question: 'Why must you never trust the type of values inside req.query directly?',
          spokenAnswer:
            'In Express, all values in req.query default to strings. However, if a client passes duplicate keys like ?id=1&id=2, req.query.id becomes an Array (["1", "2"]). If extended query parsing is enabled, clients can even send objects like ?user[name]=admin. If your code expects a string and does id.trim(), passing an array will cause an unhandled runtime TypeError crash.'
        }
      ],
      trickyFollowUp: {
        question: 'How does app.param() work and why is it useful?',
        answer:
          'app.param("name", fn) is parameter middleware that automatically triggers whenever a matching route param :name appears in the matched route. It executes exactly once per request-response cycle, even if the parameter appears across multiple handlers. It is ideal for pre-fetching entities or validating IDs before controllers execute.'
      },
      commonMistakes: [
        'Assuming req.query values are numbers or booleans: "false" is a truthy string in JavaScript (Boolean("false") === true)!',
        'Not guarding against array query injection: assuming req.query.id is a string when a client passes ?id=1&id=2.',
        'Using route parameters for optional search filters instead of query strings.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Route params (req.params) identify resources; Query params (req.query) modify/filter collections.',
        'EVERYTHING in req.params and req.query is a STRING by default: always parse and validate.',
        'Use app.param() for centralized parameter validation and entity pre-loading.'
      ],
      oneLineDefinition:
        'Route parameters define mandatory hierarchical resource identifiers, while query parameters provide optional filtering, sorting, and pagination modifiers.',
      interviewTip:
        'Warn about Boolean("false") === true in query params: interviewers love catching candidates on query type coercion.',
      keyDistinction:
        'req.params vs req.query: Route params are required path segments; Query params are optional key-value query string pairs.'
    }
  }
];
