import { QuickReferenceTopic } from './types';

export const expressCategory2MiddlewareLifecycle: QuickReferenceTopic[] = [
  {
    id: 'express-middleware',
    number: 5,
    title: 'Middleware',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Middleware and Request Lifecycle',
    categorySlug: 'express-middleware-lifecycle',
    estimatedMinutes: 5,
    concept30Sec:
      'Middleware functions are the fundamental building blocks of Express. They are functions that have access to the request object (req), the response object (res), and the next middleware function in the application request-response cycle. A middleware must either send a response to the client or invoke next() to pass control to the subsequent layer.',
    internals: {
      overview:
        'When you register middleware using app.use(fn), Express wraps fn in a Layer object and appends it to the internal router stack. When a request is handled, Express calls an internal recursive function proto.handle. Each call pops or indexes the next Layer. Invoking next() triggers the next Layer in sequence. If next(err) is called with any truthy argument (except "route"), Express skips all remaining standard middleware layers and jumps straight to the next 4-argument error-handling middleware.',
      flowSteps: [
        '1. Middleware Invocation: Express calls fn(req, res, next) for the current layer.',
        '2. Execution: The middleware performs tasks (e.g. logging, parsing body, checking token).',
        '3. Decision Point A (Termination): Middleware calls res.json() or res.end(). Response is sent; cycle ends.',
        '4. Decision Point B (Continuation): Middleware calls next(). Express advances layer index and invokes next middleware.',
        '5. Decision Point C (Error): Middleware calls next(error) or throws in async Express 5. Express jumps to error stack.',
        '6. Hanging Trap: If middleware neither sends a response nor calls next(), the client HTTP request hangs until socket timeout!'
      ],
      diagram: `EXPRESS MIDDLEWARE PIPELINE FLOW:

  HTTP Request
       |
       v
  [ Middleware 1: express.json() ]
       | next()
       v
  [ Middleware 2: Authentication ]
       |
       +---> Token Invalid? -> res.status(401).json(...) -> [ Response Ends ]
       |
       +---> Token Valid?   -> req.user = user -> next()
       |
       v
  [ Route Handler / Controller ]
       |
       v
  res.json({ success: true }) -> Client receives HTTP Response`
    },
    codeExample: {
      code: `import express from 'express';

const app = express();

// Middleware: Timing & Header Decoration
app.use((req, res, next) => {
  const start = Date.now();

  // Listen to response finish event using native Node.js EventEmitter
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(\`[\${req.method}] \${req.originalUrl} -> \${res.statusCode} (\${duration}ms)\`);
  });

  // Always invoke next() to let subsequent layers run!
  next();
});

app.get('/api/data', (req, res) => {
  res.json({ data: 'Sensitive Payload' });
});`,
      language: 'javascript',
      output: `GET /api/data HTTP/1.1 -> 200 OK
[GET] /api/data -> 200 (2ms)`,
      whyOutput:
        'The middleware records the start time and hooks into the native res "finish" event. Calling next() allows the route handler to execute and send the JSON payload. When the HTTP response finishes streaming to the client, the "finish" listener fires and logs the total round-trip duration.'
    },
    nodeJsApplication: {
      scenario: 'Authentication & Tenant Context Injection',
      description:
        'In multi-tenant SaaS backends, an authentication middleware verifies JWT signatures, extracts tenant metadata, queries tenant permissions, and decorates req.user and req.tenant. All downstream controllers access this validated context directly from req.',
      codeSnippet: `export const authenticateJwt = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user context for downstream controllers
    next(); // Pass control forward
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What happens if a middleware function neither calls next() nor sends a response?',
          spokenAnswer:
            'If a middleware neither calls next() nor sends a response (e.g. res.send or res.end), the request-response cycle is permanently suspended. The client request will hang indefinitely until the client times out, a proxy (like Nginx or Cloudflare) returns a 504 Gateway Timeout, or Node.js server socket timeout (server.requestTimeout) triggers.'
        },
        {
          question: 'What is the internal difference between calling next() and calling next(err)?',
          spokenAnswer:
            'Calling next() without arguments signals Express to proceed to the very next middleware or route layer in the normal pipeline. Calling next(err) with any argument (other than the string "route") signals an error: Express immediately skips all subsequent normal middleware and route handlers, jumping directly to the next registered 4-argument error-handling middleware ((err, req, res, next)).'
        }
      ],
      trickyFollowUp: {
        question: 'What happens if you invoke next() multiple times in the same middleware?',
        answer:
          'Invoking next() multiple times causes catastrophic control flow bugs. The downstream middleware pipeline executes multiple times for the same request. When those downstream handlers attempt to send responses, Node.js throws the infamous "Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client".'
      },
      commonMistakes: [
        'Calling res.json() without returning (e.g. res.json(...); next();), causing ERR_HTTP_HEADERS_SENT crashes.',
        'Assuming middleware runs in parallel: Express middleware always executes sequentially in registration order.',
        'Forgetting next() in conditional branches, causing requests to hang under certain edge cases.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Middleware accesses (req, res, next) and runs sequentially in registration order.',
        'Must either send a response (terminating cycle) or call next() (advancing cycle).',
        'Calling next(err) skips standard middleware and jumps directly to error handlers.'
      ],
      oneLineDefinition:
        'Middleware is a sequential pipeline of functions that inspect, mutate, or terminate incoming HTTP requests before or after route handlers.',
      interviewTip:
        'Always warn about ERR_HTTP_HEADERS_SENT caused by calling next() after sending a response without a return statement.',
      keyDistinction:
        'Middleware vs Route Handler: Route handlers are functionally just middleware that terminate the request by sending an HTTP response.'
    }
  },
  {
    id: 'express-custom-middleware',
    number: 6,
    title: 'Custom Middleware',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Middleware and Request Lifecycle',
    categorySlug: 'express-middleware-lifecycle',
    estimatedMinutes: 5,
    concept30Sec:
      'Custom middleware allows developers to encapsulate reusable cross-cutting concerns—such as distributed correlation IDs, response compression, request sanitization, and role-based access control (RBAC). Middleware factories allow creating parameterized, configurable middleware functions.',
    internals: {
      overview:
        'A custom middleware can mutate req or res. Because JavaScript objects are passed by reference, any property assigned to req (e.g., req.requestId or req.user) persists across all subsequent middleware, controllers, and error handlers in that specific request lifecycle. When creating configurable middleware, we use higher-order functions (middleware factories) that accept options and return the standard (req, res, next) signature.',
      flowSteps: [
        '1. Middleware Factory: authorize(["ADMIN", "SUPERUSER"]) returns a closure containing the permitted roles array.',
        '2. Request Arrival: The closure executes with (req, res, next).',
        '3. Scope Inspection: Checks req.user.role against the closed-over roles array.',
        '4. Authorization Check: If role is unauthorized, returns 403 Forbidden immediately.',
        '5. Context Augmentation: If authorized, can attach additional metadata (e.g. req.permissions) and calls next().'
      ],
      diagram: `CONFIGURABLE MIDDLEWARE FACTORY PATTERN:

app.use(rbacMiddleware(['ADMIN', 'MANAGER']))
               |
               v
  Higher-Order Function Factory
  +------------------------------------------------------+
  | function rbacMiddleware(allowedRoles) {             |
  |   return (req, res, next) => {                       |
  |     if (!allowedRoles.includes(req.user.role)) {     |
  |       return res.status(403).json({ error });        |
  |     }                                                |
  |     next();                                          |
  |   };                                                 |
  | }                                                    |
  +------------------------------------------------------+`
    },
    codeExample: {
      code: `import express from 'express';
import { randomUUID } from 'node:crypto';

const app = express();

// 1. Correlation ID Middleware: Injects X-Request-Id for distributed tracing
const correlationIdMiddleware = (req, res, next) => {
  // Use existing header from reverse proxy or generate new UUIDv4
  const correlationId = (req.headers['x-request-id'] as string) || randomUUID();
  req.id = correlationId;
  res.setHeader('X-Request-Id', correlationId);
  next();
};

// 2. Configurable Middleware Factory: Role-Based Access Control (RBAC)
const requireRole = (...allowedRoles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: \`User role '\${req.user?.role}' lacks required permissions: [\${allowedRoles.join(', ')}]\`
      });
    }
    next();
  };
};

app.use(correlationIdMiddleware);

// Applying factory to protected route
app.delete('/api/users/:id', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res) => {
  res.json({ success: true, deletedId: req.params.id, traceId: req.id });
});`,
      language: 'javascript',
      output: `DELETE /api/users/42 HTTP/1.1 (Without ADMIN role)

HTTP/1.1 403 Forbidden
X-Request-Id: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
Content-Type: application/json; charset=utf-8

{
  "error": "Forbidden",
  "message": "User role 'undefined' lacks required permissions: [ADMIN, SUPER_ADMIN]"
}`,
      whyOutput:
        'The correlationIdMiddleware attaches a unique trace ID and sets the response header. The requireRole middleware factory evaluates the caller role. Because req.user is undefined, it terminates the request immediately with a 403 response, preserving the correlation ID header.'
    },
    nodeJsApplication: {
      scenario: 'Distributed Tracing & Structured Audit Logging in Microservices',
      description:
        'In Kubernetes microservice meshes, the X-Request-Id header must be propagated across all downstream HTTP requests, Redis queries, and database transactions to correlate logs in Datadog or OpenTelemetry.',
      codeSnippet: `// Propagating Correlation ID across downstream clients
app.use((req, res, next) => {
  req.log = pinoLogger.child({
    requestId: req.headers['x-request-id'] || crypto.randomUUID(),
    clientIp: req.ip
  });
  next();
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is a middleware factory and when would you use one?',
          spokenAnswer:
            'A middleware factory is a higher-order function that accepts configuration options and returns a standard Express middleware function ((req, res, next)). It is used whenever middleware behavior needs to be dynamic or configurable—such as configuring allowed roles in authorization middleware (authorize("ADMIN")), rate limits, or file upload size limits.'
        },
        {
          question: 'Why is it important to set an X-Request-Id header in custom middleware?',
          spokenAnswer:
            'An X-Request-Id (correlation ID) provides end-to-end distributed traceability. By attaching this ID to req and response headers, all structured application logs, database queries, and downstream microservice calls can log the identical correlation ID. When a customer reports a failure, engineers can query log aggregation systems (e.g. Datadog/Elasticsearch) with that single ID to inspect the entire execution graph.'
        }
      ],
      trickyFollowUp: {
        question: 'Can middleware modify properties on the native Node.js res.write or res.end methods?',
        answer:
          'Yes! This technique is called "response interception" or monkey-patching (used by packages like response-time and compression). Middleware stores a reference to original res.write/res.end and overrides them with custom functions that calculate latency or compress chunks before delegating back to the original method.'
      },
      commonMistakes: [
        'Not using a return statement when rejecting inside custom middleware (e.g. res.status(401).json(...); without return), causing code below to execute.',
        'Attaching sensitive or circular references to req, increasing heap memory footprint on long-lived connections.',
        'Ignoring existing incoming X-Request-Id headers from upstream API gateways, breaking distributed tracing.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Use higher-order functions (middleware factories) to create parameterized, reusable middleware.',
        'Decorating req is safe because req is scoped to the single active HTTP transaction.',
        'Always propagate X-Request-Id for production distributed log correlation.'
      ],
      oneLineDefinition:
        'Custom middleware encapsulates cross-cutting application requirements like authorization, request tracing, and payload normalization into reusable pipeline steps.',
      interviewTip:
        'Showcase higher-order closures when asked how to design an RBAC authorization middleware in Express.',
      keyDistinction:
        'Direct Middleware vs Middleware Factory: Direct has fixed signature (req, res, next); Factory is a function that returns (req, res, next).'
    }
  },
  {
    id: 'express-middleware-execution-order',
    number: 7,
    title: 'Middleware Execution Order',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Middleware and Request Lifecycle',
    categorySlug: 'express-middleware-lifecycle',
    estimatedMinutes: 5,
    concept30Sec:
      'Express executes middleware in the exact sequential order in which they are registered via app.use() and HTTP route declarations. Because execution is sequential and top-down, the placement of middleware—especially body parsers, authentication, route definitions, and error handlers—strictly dictates application behavior.',
    internals: {
      overview:
        'Express maintains a single flat array of Layer objects in app._router.stack. When an incoming request arrives, Express increments an internal layer pointer (idx) from 0 to stack.length - 1. If a middleware is registered AFTER a route that terminates the response, that middleware will NEVER execute for that route. Error-handling middleware MUST be registered last because Express only looks forward in the layer stack for 4-argument handlers when next(err) is invoked.',
      flowSteps: [
        '1. Top-Level / Built-in Middleware: express.json(), helmet() registered first to parse and secure all incoming traffic.',
        '2. Global Utility Middleware: Request loggers, CORS, and correlation ID assigners.',
        '3. Router-Level Middleware: Authentication and rate limiters mounted on specific route prefixes (e.g. /api).',
        '4. Route-Specific Middleware: Validations and RBAC checks mounted inline on specific endpoints.',
        '5. Route Handlers / Controllers: Business logic and response termination (res.json).',
        '6. 404 Catch-All Middleware: Catches any unmatched requests (must be after all valid routes!).',
        '7. Centralized Error Middleware: 4-argument handler (err, req, res, next) (MUST be the absolute last layer!).'
      ],
      diagram: `EXPRESS MIDDLEWARE REGISTRATION HIERARCHY (EXACT TOP-TO-BOTTOM ORDER):

  app.use(helmet());                    <-- 1. Security Headers (App-level)
  app.use(cors());                      <-- 2. CORS (App-level)
  app.use(express.json());              <-- 3. Body Parser (App-level)
  app.use(logger);                      <-- 4. Logging & Tracing (App-level)
        |
        v
  app.use('/api/v1', apiRouter);        <-- 5. Router-level (/api/v1)
        |
        +--> router.use(authMiddleware);      <-- Scoped to /api/v1
        +--> router.post('/checkout',         <-- 6. Route-specific
                 validateBody,                 <-- Validation runs
                 processCheckoutController);   <-- Controller terminates
        |
        v
  app.use(notFoundHandler);             <-- 7. 404 Handler (Runs only if unmatched!)
        |
        v
  app.use(centralizedErrorHandler);     <-- 8. Error Handler (MUST BE LAST!)`
    },
    codeExample: {
      code: `import express from 'express';

const app = express();

// Trace execution sequence:
app.use((req, res, next) => {
  console.log('1: Global Middleware');
  next();
});

app.get('/test',
  (req, res, next) => {
    console.log('2: Route-specific Middleware A');
    next();
  },
  (req, res, next) => {
    console.log('3: Route-specific Middleware B');
    next();
  },
  (req, res) => {
    console.log('4: Controller Handler (Terminates)');
    res.send('Success');
  }
);

// Any middleware below the matching route will NOT run if response already sent!
app.use((req, res, next) => {
  console.log('5: This only runs for UNMATCHED routes!');
  next();
});

// Centralized Error Middleware: MUST have 4 arguments and be registered last!
app.use((err, req, res, next) => {
  console.log('6: Error Handler:', err.message);
  res.status(500).json({ error: err.message });
});`,
      language: 'javascript',
      output: `GET /test HTTP/1.1

1: Global Middleware
2: Route-specific Middleware A
3: Route-specific Middleware B
4: Controller Handler (Terminates)`,
      whyOutput:
        'Layers execute in exact order 1 -> 2 -> 3 -> 4. Because Layer 4 terminates the response with res.send(), Express stops traversing standard layers. Layer 5 never executes because the request was already matched and handled.'
    },
    nodeJsApplication: {
      scenario: 'Preventing Webhook Signature Verification Failures in Stripe/Shopify',
      description:
        'Stripe webhooks require the raw, unparsed request body Buffer to cryptographically verify HMAC signatures. If express.json() is mounted globally before the webhook route, the body is already parsed into a JavaScript object, destroying the raw byte stream and causing signature verification to fail.',
      codeSnippet: `// FIX: Mount raw body parser specifically for webhooks BEFORE express.json()
app.post('/api/stripe/webhook',
  express.raw({ type: 'application/json' }), // Raw Buffer for HMAC check
  stripeWebhookController
);

// Global JSON parser registered AFTER raw webhook endpoint:
app.use(express.json());`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Why must error-handling middleware always be registered as the very last app.use() call?',
          spokenAnswer:
            'Express traverses its internal layer stack sequentially from top to bottom. When next(err) is called anywhere in an application, Express begins searching forward from that current layer for the first middleware whose function arity is 4 (fn.length === 4). If the error-handling middleware is registered above routes or other middleware, Express will never find it when errors occur downstream.'
        },
        {
          question: 'What is the cause of "Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client"?',
          spokenAnswer:
            'This error occurs when application code attempts to set HTTP headers or send a response (via res.send, res.json, or res.redirect) on a response stream that has already finished sending headers or was already closed. The most common cause in Express is forgetting a return statement after sending a response inside a middleware, allowing subsequent code or next() to execute and attempt to send a second response.'
        }
      ],
      trickyFollowUp: {
        question: 'What does calling next("router") do in an Express router?',
        answer:
          'Calling next("router") skips all remaining middleware and routes in the current sub-router instance entirely, passing control back to the parent router stack. This is useful for feature flags or early bail-outs from a modular route group.'
      },
      commonMistakes: [
        'Registering express.json() after routes, causing req.body to be undefined inside route handlers.',
        'Registering the 404 handler before valid routes, causing all requests to return 404 immediately.',
        'Writing res.json(data); next(); instead of return res.json(data);.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Middleware order is strictly top-to-bottom: registration sequence is execution sequence.',
        'Body parsers must be registered before routes; 404 handlers after routes; error handlers last.',
        'Always return when terminating responses inside middleware to prevent ERR_HTTP_HEADERS_SENT.'
      ],
      oneLineDefinition:
        'Middleware execution order is the sequential top-down traversal of Express Layer stacks, determining request transformation, route matching, and error handling.',
      interviewTip:
        'Use the Stripe raw body webhook example to demonstrate why middleware ordering is critical in real production systems.',
      keyDistinction:
        'Application-level vs Router-level: Application-level binds to app.use() globally; Router-level binds to router.use() within a specific namespace.'
    }
  },
  {
    id: 'express-request-response-lifecycle',
    number: 8,
    title: 'Request and Response Lifecycle',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Middleware and Request Lifecycle',
    categorySlug: 'express-middleware-lifecycle',
    estimatedMinutes: 5,
    concept30Sec:
      'The Request and Response Lifecycle encompasses the entire round-trip journey of an HTTP transaction in Express: from the initial TCP socket handshake in Node.js, through the Express middleware and router layer stacks, to the controller, service, database, and final response serialization and socket flushing.',
    internals: {
      overview:
        'When a client issues an HTTP request, the OS network stack accepts the TCP packet and libuv dispatches it to node:http. Node parses the HTTP headers and instantiates http.IncomingMessage (req) and http.ServerResponse (res). Node invokes app(req, res). Express adds its prototype helpers, walks the Router stack, runs middleware, and passes data to the controller. The controller calls res.json(), which stringifies the payload, sets Content-Type: application/json and Content-Length headers, calls res.write(), and calls res.end(). Node flushes buffers over the socket, fires the res "finish" event, and cleans up references.',
      flowSteps: [
        '1. Client Request: TCP handshake -> TLS negotiation -> HTTP stream received by Node.js.',
        '2. Native Instantiation: node:http creates IncomingMessage (ReadableStream) and ServerResponse (WritableStream).',
        '3. Express Entry: app.handle(req, res) delegates to app._router.',
        '4. Middleware Chain: Top-level parsers -> security headers -> authentication -> request validation.',
        '5. Controller Execution: Controller parses req.params/body, calls domain Services, queries Repositories/Database.',
        '6. Response Serialization: res.status(200).json(result) sets HTTP status code, serializes JSON, and writes headers.',
        '7. Socket Flushing: res.end() writes the final chunk, flushes the TCP socket, and triggers the "finish" event.',
        '8. Resource Teardown: Express layer iteration terminates; GC reclaims local variables and closures.'
      ],
      diagram: `COMPLETE END-TO-END HTTP REQUEST-RESPONSE LIFECYCLE:

Client Browser / API Client
          |
  [ HTTP Request: POST /api/v1/orders ]
          v
+----------------------------------------------------------------------------------+
| Node.js Runtime                                                                  |
|   1. TCP Socket / TLS Handshake (libuv)                                          |
|   2. http.createServer parses headers -> IncomingMessage (req), ServerResponse (res)|
+----------------------------------------------------------------------------------+
          |
          v
+----------------------------------------------------------------------------------+
| Express Application Pipeline                                                     |
|   3. Middleware Stack:                                                           |
|        - helmet()             -> Security headers                                |
|        - express.json()       -> Parses buffer into req.body                     |
|        - authMiddleware()     -> Validates JWT -> Attaches req.user              |
|        - validate(OrderSchema)-> Validates payload                               |
|   4. Router Matching:                                                            |
|        - Matches POST /api/v1/orders                                             |
|   5. Controller Layer:                                                           |
|        - OrderController.create(req, res, next)                                  |
|   6. Service Layer:                                                              |
|        - OrderService.checkout(userId, items) (Domain Logic)                     |
|   7. Repository / Database Layer:                                                |
|        - OrderRepository.save(order) -> PostgreSQL INSERT                        |
+----------------------------------------------------------------------------------+
          |
          v
+----------------------------------------------------------------------------------+
| Response Finalization                                                            |
|   8. res.status(201).json(order)                                                 |
|   9. Node.js writes HTTP response headers & body over socket                     |
|  10. res.end() -> Event 'finish' fires -> TCP Socket closes or stays keep-alive  |
+----------------------------------------------------------------------------------+
          |
  [ HTTP Response: 201 Created ]
          v
Client Browser / API Client`
    },
    codeExample: {
      code: `import express from 'express';

const app = express();

// Tracing lifecycle hooks using native HTTP ServerResponse events
app.use((req, res, next) => {
  const start = performance.now();

  // Fired when all response headers and data are flushed to the OS kernel
  res.on('finish', () => {
    const elapsed = (performance.now() - start).toFixed(2);
    console.log(\`[LIFECYCLE FINISH] \${req.method} \${req.url} - Status: \${res.statusCode} in \${elapsed}ms\`);
  });

  // Fired if the underlying TCP connection was terminated prematurely by the client!
  res.on('close', () => {
    if (!res.writableEnded) {
      console.warn('[LIFECYCLE ABORTED] Client closed connection before response completed!');
    }
  });

  next();
});

app.get('/lifecycle-demo', async (req, res) => {
  // Simulating async service/database latency
  await new Promise((resolve) => setTimeout(resolve, 50));
  res.status(200).json({ status: 'completed', stage: 'controller_response' });
});`,
      language: 'javascript',
      output: `GET /lifecycle-demo HTTP/1.1

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "status": "completed",
  "stage": "controller_response"
}

[LIFECYCLE FINISH] GET /lifecycle-demo - Status: 200 in 51.40ms`,
      whyOutput:
        'The lifecycle starts upon incoming connection. The middleware registers event listeners on res. The route handler awaits simulated database latency and invokes res.json(). Once the data is transmitted to the kernel socket, the "finish" event fires and logs the total latency.'
    },
    nodeJsApplication: {
      scenario: 'Client Disconnect Detection for Long-Running Heavy Reports',
      description:
        'If a user closes their browser while generating a 30-second PDF report, continuing to compute wastes server CPU. Listening to res.on("close") detects the aborted lifecycle, allowing the server to cancel ongoing database queries via AbortController.',
      codeSnippet: `app.get('/reports/heavy', async (req, res) => {
  const ac = new AbortController();

  req.on('close', () => {
    if (!res.writableEnded) {
      ac.abort(); // Cancel DB query immediately!
    }
  });

  const report = await db.query('SELECT ...', { signal: ac.signal });
  res.json(report);
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Can you explain the end-to-end lifecycle of an HTTP request in an Express application?',
          spokenAnswer:
            'The lifecycle begins at the OS network layer where libuv delivers incoming TCP packets to node:http. Node parses the HTTP headers and passes the native req and res streams to app.handle(). Express wraps these streams with its prototype helpers and pushes the request through its Router stack. The request passes through global middleware (body parser, security headers), router-level middleware (auth), and route validation, before reaching the controller. The controller executes business logic via services and repositories, and calls res.json(). Express serializes the payload, sets headers, calls res.end() to flush data down the TCP socket, and triggers the "finish" event.'
        },
        {
          question: 'What is the difference between the "finish" event and the "close" event on the Express response object?',
          spokenAnswer:
            '"finish" is emitted when the response has been completely sent to the underlying system and all headers/data are flushed. "close" indicates that the underlying TCP connection was terminated prematurely (for example, if the client closed their browser tab or dropped WiFi before the server finished sending). Checking if (!res.writableEnded) inside a "close" listener lets you detect aborted client requests.'
        }
      ],
      trickyFollowUp: {
        question: 'Does res.send() immediately terminate the execution of the JavaScript function it was called in?',
        answer:
          'No! res.send() is just a normal asynchronous function call. It initiates the writing of HTTP headers and body chunks, but JavaScript continues executing subsequent lines in that function unless you explicitly use a return statement.'
      },
      commonMistakes: [
        'Assuming res.json() stops execution of the remaining lines in a function: you must write return res.json().',
        'Not handling client disconnects on heavy operations, wasting server memory and database capacity.',
        'Confusing req.readable (incoming stream state) with res.writableEnded (outgoing stream completion state).'
      ]
    },
    quickRevision: {
      takeaways: [
        'Lifecycle: TCP Socket -> node:http -> Express Router -> Middleware -> Controller -> Service -> DB -> res.end().',
        'res.send() does NOT exit function execution: always use return res.send().',
        'Listen to res.on("close") to detect aborted client connections and cancel background queries.'
      ],
      oneLineDefinition:
        'The Request-Response Lifecycle is the complete flow of an HTTP transaction from socket arrival through middleware, controllers, and services to socket flush.',
      interviewTip:
        'Emphasize the distinction between res.on("finish") (successful flush) and res.on("close") (premature socket termination).',
      keyDistinction:
        'res.writableEnded vs res.headersSent: headersSent is true once headers are queued; writableEnded is true only after res.end() has been called.'
    }
  },
  {
    id: 'express-error-handling-middleware',
    number: 9,
    title: 'Error-Handling Middleware',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Middleware and Request Lifecycle',
    categorySlug: 'express-middleware-lifecycle',
    estimatedMinutes: 5,
    concept30Sec:
      'Error-handling middleware in Express is defined with exactly four parameters: (err, req, res, next). Express uses function arity (fn.length === 4) to distinguish error handlers from standard 3-parameter middleware. It intercepts all errors forwarded via next(err) or thrown inside route handlers.',
    internals: {
      overview:
        'Express inspects the .length property of every registered function. When a standard middleware has (req, res, next), fn.length is 2 or 3. When an error handler has (err, req, res, next), fn.length is 4. When next(err) is invoked, the router loop checks if layer.handle.length === 4. If true, it executes that layer with (err, req, res, next). If false, it skips that layer entirely. In Express 5, async route handlers that return rejected promises are automatically caught and routed to error middleware without needing manual try/catch or wrapper libraries.',
      flowSteps: [
        '1. Error Origin: An error is thrown in a route or forwarded via next(err).',
        '2. Layer Skip: Express skips all remaining standard middleware (fn.length < 4).',
        '3. Arity Check: Express identifies the next layer where handle.length === 4.',
        '4. Handler Execution: Invokes errorHandler(err, req, res, next).',
        '5. Response or Re-delegation: Error handler sends an error response (e.g. 500 JSON) or calls next(err) to bubble to the default Express HTML error handler.',
        '6. Express 5 Async Difference: In Express 5, rejected promises in async functions automatically invoke next(err); in Express 4, unhandled promise rejections hang the request unless wrapped.'
      ],
      diagram: `HOW EXPRESS DETECTS ERROR HANDLERS VIA FUNCTION ARITY:

Standard Middleware (fn.length === 3):
  (req, res, next) => { ... }    --> Express treats as normal layer.

Error Middleware (fn.length === 4):
  (err, req, res, next) => { ... } --> Express treats as error handler!
                                      (ONLY executed when next(err) is called)

CRITICAL RULE:
  Even if you do NOT use 'next' inside your error handler, you MUST declare it!
  (err, req, res) => { ... } has fn.length === 3! Express WILL IGNORE IT!`
    },
    codeExample: {
      code: `import express from 'express';

const app = express();
app.use(express.json());

// Route triggering an error
app.get('/fail', (req, res, next) => {
  const err = new Error('Database connection failed');
  (err as any).statusCode = 503;
  next(err); // Forwards to 4-parameter error middleware
});

// Centralized Error-Handling Middleware (MUST declare all 4 arguments!)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const statusCode = err.statusCode || 500;
  console.error(\`[ERROR \${statusCode}] \${err.message}\`);

  res.status(statusCode).json({
    success: false,
    error: {
      message: statusCode === 500 && process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
});`,
      language: 'javascript',
      output: `GET /fail HTTP/1.1

HTTP/1.1 503 Service Unavailable
Content-Type: application/json; charset=utf-8

{
  "success": false,
  "error": {
    "message": "Database connection failed",
    "stack": "Error: Database connection failed\\n    at file:///server.js:8:15..."
  }
}`,
      whyOutput:
        'When next(err) is called with an error, Express immediately searches for the next middleware with fn.length === 4. It executes the error handler, reads err.statusCode (503), logs the error, and returns a sanitized JSON response with the error details.'
    },
    nodeJsApplication: {
      scenario: 'Express 4 vs Express 5 Async Error Handling',
      description:
        'In Express 4, throwing an error inside an async function causes an unhandled promise rejection that hangs the connection. In Express 5, Express natively catches Promise rejections and forwards them to the 4-argument error handler automatically.',
      codeSnippet: `// In Express 5: Native Promise rejection support!
app.get('/user/:id', async (req, res) => {
  // If findUser throws or rejects, Express 5 automatically catches it and calls next(err)!
  const user = await db.findUser(req.params.id);
  res.json(user);
});

// In Express 4: Required manual try/catch or express-async-errors wrapper:
app.get('/user-legacy/:id', async (req, res, next) => {
  try {
    const user = await db.findUser(req.params.id);
    res.json(user);
  } catch (err) {
    next(err); // Mandatory in Express 4!
  }
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'How does Express differentiate between regular middleware and error-handling middleware?',
          spokenAnswer:
            'Express differentiates strictly based on function arity—the number of declared parameters via function.length. Regular middleware declares 2 or 3 parameters ((req, res, next)), giving a length of 3. Error-handling middleware MUST declare exactly 4 parameters: ((err, req, res, next)). If you omit the unused next parameter and declare only ((err, req, res)), its length is 3 and Express will treat it as regular middleware, completely breaking your error pipeline.'
        },
        {
          question: 'What is the difference between error handling in Express 4 vs Express 5?',
          spokenAnswer:
            'In Express 4, route handlers were designed for synchronous callbacks. If an async function threw an error or rejected a promise, Express 4 could not catch it; the request hung indefinitely and triggered an unhandledRejection event. In Express 5, route handlers natively handle Promises: if an async function returns a rejected promise, Express 5 automatically calls next(rejectionReason), routing it directly to your error-handling middleware.'
        }
      ],
      trickyFollowUp: {
        question: 'What happens if you throw an error inside an error-handling middleware itself?',
        answer:
          'If an error occurs inside an error-handling middleware, Express passes that new error to the next 4-parameter error handler in the stack. If no other error handler exists, Express falls back to its default built-in finalhandler, which prints the error to stderr and returns a 500 HTML response.'
      },
      commonMistakes: [
        'Omitting the next parameter in (err, req, res) and wondering why the error handler is never invoked.',
        'Registering error middleware before routes, so it never catches route errors.',
        'Exposing full error stack traces to clients in production environments, leaking infrastructure paths and database schemas.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Error middleware MUST have exactly 4 arguments: (err, req, res, next).',
        'Express 5 natively catches rejected promises in async route handlers.',
        'Never leak stack traces in production: sanitize 500 errors.'
      ],
      oneLineDefinition:
        'Error-handling middleware is a specialized 4-parameter Express layer that intercepts forwarded or thrown errors to return standardized HTTP responses.',
      interviewTip:
        'State "function.length === 4": interviewers test whether candidates understand the exact JavaScript mechanism Express uses to detect error handlers.',
      keyDistinction:
        'Express 4 vs Express 5: Express 4 requires express-async-errors or manual try/catch; Express 5 natively catches rejected promises.'
    }
  },
  {
    id: 'express-centralized-exception-handling',
    number: 10,
    title: 'Centralized Exception Handling',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Middleware and Request Lifecycle',
    categorySlug: 'express-middleware-lifecycle',
    estimatedMinutes: 5,
    concept30Sec:
      'Centralized exception handling is the architectural practice of funneling all application errors—both operational errors (e.g., validation failures, 404s, payment declines) and programmer bugs (e.g., syntax errors, null pointers)—through a single, structured pipeline using a custom AppError class.',
    internals: {
      overview:
        'In production backends, scattered try/catch blocks sending ad-hoc res.status(500) responses create inconsistent APIs and leak implementation details. A centralized exception architecture uses an AppError class with isOperational = true flags. Operational errors are expected runtime conditions with known HTTP status codes and safe messages. Programmer errors (isOperational = false or undefined) trigger alerts, log full stack traces to Winston/Pino, and return generic 500 messages.',
      flowSteps: [
        '1. Custom Error Instantiation: throw new AppError("Product not found", 404);',
        '2. Error Bubbling: Express routes rejection to Centralized Error Middleware.',
        '3. Classification: Checks if (err.isOperational === true).',
        '4. Operational Path: Formats consistent JSON with err.statusCode (e.g. 404/400) and user-safe message.',
        '5. Programmer Bug Path: If not operational (e.g. TypeError), logs critical alert to APM (Datadog/Sentry) and masks response with 500 Internal Server Error.',
        '6. 404 Fallback: A catch-all route handler (app.all("*")) instantiates an AppError("Route not found", 404) and calls next(err).'
      ],
      diagram: `CENTRALIZED EXCEPTION HANDLING ARCHITECTURE:

                 Incoming Request
                        |
            Route / Controller / Service
                        |
            +-----------+-----------+
            |                       |
       Throws AppError         Throws TypeError
      (Operational: 400)     (Programmer Bug: 500)
            |                       |
            +-----------> + <-------+
                          |
                          v
         [ Centralized Error Middleware ]
                          |
             Is it Operational Error?
             /                      \\
           YES                       NO
           /                           \\
  Status: err.statusCode      Status: 500 Internal Server Error
  Message: err.message        Message: "Something went wrong!"
  (Client-safe response)      Log stack trace to Pino / Sentry`
    },
    codeExample: {
      code: `// 1. Custom Operational Error Class
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Distinguishes operational from programmer bugs!
    Error.captureStackTrace(this, this.constructor);
  }
}

// 2. Centralized Error Middleware
export const globalErrorHandler = (err: any, req: any, res: any, next: any) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  // Log all non-operational bugs as CRITICAL
  if (!isOperational) {
    console.error('CRITICAL UNHANDLED ERROR:', err.stack);
  }

  res.status(statusCode).json({
    status: statusCode >= 500 ? 'error' : 'fail',
    error: {
      message: isOperational || process.env.NODE_ENV !== 'production'
        ? err.message
        : 'Internal server error occurred',
      statusCode,
      timestamp: new Date().toISOString()
    }
  });
};

// 3. 404 Unmatched Route Catch-All (Place right before error handler)
export const notFoundHandler = (req: any, res: any, next: any) => {
  next(new AppError(\`Cannot find \${req.method} \${req.originalUrl} on this server\`, 404));
};`,
      language: 'javascript',
      output: `GET /api/v1/nonexistent HTTP/1.1

HTTP/1.1 404 Not Found
Content-Type: application/json; charset=utf-8

{
  "status": "fail",
  "error": {
    "message": "Cannot find GET /api/v1/nonexistent on this server",
    "statusCode": 404,
    "timestamp": "2026-11-18T18:32:00.000Z"
  }
}`,
      whyOutput:
        'When an unmatched route arrives, notFoundHandler instantiates an operational AppError with status 404 and calls next(err). The globalErrorHandler catches it, detects isOperational === true, and outputs a formatted client-safe JSON failure response.'
    },
    nodeJsApplication: {
      scenario: 'PCI-DSS Compliant Payment Error Masking',
      description:
        'In financial and healthcare applications, leaking database syntax errors or internal microservice URLs violates security compliance (PCI-DSS, HIPAA). Centralized exception handling guarantees that internal system details are never returned to clients, while operational business validation errors remain clear and actionable.',
      codeSnippet: `// Service Layer throws operational error
if (cart.isExpired) {
  throw new AppError('Checkout session expired. Please refresh your cart.', 400);
}
if (!paymentGateway.isAvailable) {
  // Operational 503 error
  throw new AppError('Payment processing temporarily unavailable', 503);
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the distinction between an Operational Error and a Programmer Error in Node.js?',
          spokenAnswer:
            'Operational errors represent expected, known runtime failure conditions that inevitably occur in production—such as invalid user input (400), expired JWT tokens (401), missing database records (404), or third-party service timeouts (503). Programmer errors represent bugs in the codebase—such as reading properties of undefined, passing wrong types, or syntax errors. Operational errors can be anticipated and handled gracefully with user-friendly messages, while programmer bugs require alerts and immediate developer fixes.'
        },
        {
          question: 'How do you handle 404 Not Found routes in an Express application?',
          spokenAnswer:
            'A 404 route is not technically an error thrown by Express; it simply means no route handler matched the requested URL. To handle 404s, register a catch-all middleware (app.all("*", ...)) AFTER all valid API routes but BEFORE the centralized error handler. Inside this middleware, instantiate an AppError("Route not found", 404) and pass it to next(err) to reuse the centralized error response format.'
        }
      ],
      trickyFollowUp: {
        question: 'Should an Express application crash and restart after a programmer error versus an operational error?',
        answer:
          'Yes! For operational errors (isOperational === true), the process state remains clean and can continue running. For programmer errors (uncaught exceptions or unhandled rejections), the V8 heap and internal references may be corrupted or in an indeterminate state. Best practice is to log the error, gracefully close the HTTP server, and restart the process via a process manager like PM2 or Kubernetes.'
      },
      commonMistakes: [
        'Writing res.status(500) manually inside 50 different controller catch blocks instead of forwarding to a single centralized handler.',
        'Not setting Error.captureStackTrace(this, this.constructor) in custom Error classes, polluting error stacks with the constructor frame.',
        'Catching an error, logging it, and forgetting to send a response or call next(err), leaving the client hanging.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Separate operational errors (known, client-safe) from programmer bugs (unknown, 500 masked).',
        'Use an AppError class with isOperational: true and HTTP statusCode.',
        'Handle 404s via a catch-all middleware right before the centralized error handler.'
      ],
      oneLineDefinition:
        'Centralized exception handling routes all application failures through a unified error handler, categorizing errors into operational versus programmer bugs.',
      interviewTip:
        'Discussing the "Operational vs Programmer Error" distinction is the gold standard for senior backend interview answers.',
      keyDistinction:
        'Operational Error vs Programmer Bug: Operational errors are expected runtime conditions; Programmer bugs are software defects.'
    }
  }
];
