import { QuickReferenceTopic } from './types';

export const expressCategory3ArchitecturePatterns: QuickReferenceTopic[] = [
  {
    id: 'express-controllers-services',
    number: 11,
    title: 'Controllers and Services',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Backend Architecture and Design Patterns',
    categorySlug: 'express-architecture-patterns',
    estimatedMinutes: 5,
    concept30Sec:
      'The Controller-Service pattern enforces strict separation of concerns in backend systems. Controllers belong to the Transport Layer—responsible for parsing HTTP requests, headers, and returning HTTP responses. Services belong to the Business Domain Layer—containing pure business logic, calculations, and external API orchestration, completely independent of Express.',
    internals: {
      overview:
        'When business logic is written inside controllers, it becomes impossible to test without mocking complex HTTP req/res objects, and impossible to reuse when the same logic is needed by a message queue consumer, a scheduled cron task, or a CLI command. In the Controller-Service architecture: 1) The Controller extracts validated parameters (userId, amount) from req; 2) The Controller calls a Service method (e.g. paymentService.charge(userId, amount)); 3) The Service executes domain calculations and calls repositories; 4) The Controller formats the service output into HTTP status codes and JSON headers.',
      flowSteps: [
        '1. Route Trigger: Express router routes HTTP POST /users to UserController.register.',
        '2. Controller Extraction: Controller reads req.body (email, password), headers, and cookies.',
        '3. Delegation to Service: Controller calls await userService.registerUser({ email, password }).',
        '4. Service Business Rules: Service checks if email is registered, hashes password, generates verification tokens, and sends welcome email.',
        '5. Data Persistence: Service delegates DB queries to UserRepository.',
        '6. HTTP Response: Controller receives the created user domain object, maps it to a safe DTO (omitting password hash), and sends res.status(201).json(dto).'
      ],
      diagram: `CONTROLLER VS SERVICE RESPONSIBILITY BOUNDARIES:

HTTP Request (POST /checkout)
       |
       v
+-------------------------------------------------------------+
| Controller Layer (HTTP Transport Only)                      |
|  - Reads req.body, req.params, req.headers                 |
|  - DOES NOT contain business logic or database queries!     |
|  - Calls: await checkoutService.processOrder(userId, items) |
|  - Maps domain result -> res.status(200).json(orderDto)     |
+-------------------------------------------------------------+
       | (Clean JS parameters: userId, items)
       v
+-------------------------------------------------------------+
| Service Layer (Pure Business Logic)                         |
|  - NO req or res objects! Pure domain rules.                |
|  - Validates stock availability, applies discount coupons   |
|  - Calls Payment Gateway (Stripe)                          |
|  - Calls OrderRepository & InventoryRepository             |
|  - Returns: Order domain object                             |
+-------------------------------------------------------------+`
    },
    codeExample: {
      code: `// 1. Service Layer (Pure Domain Logic - Zero Express Dependencies!)
export class UserService {
  constructor(private userRepo: any, private emailClient: any) {}

  async registerUser(data: { email: string; name: string }) {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new Error('UserAlreadyExists: Email is already registered');
    }

    const newUser = await this.userRepo.create({
      email: data.email.toLowerCase(),
      name: data.name,
      createdAt: new Date()
    });

    await this.emailClient.sendWelcome(newUser.email);
    return newUser;
  }
}

// 2. Controller Layer (HTTP Transport Layer)
export class UserController {
  constructor(private userService: UserService) {}

  register = async (req: any, res: any, next: any) => {
    try {
      const { email, name } = req.body;
      const user = await this.userService.registerUser({ email, name });
      // Format HTTP response
      res.status(201).json({ success: true, data: user });
    } catch (err: any) {
      if (err.message.startsWith('UserAlreadyExists')) {
        return res.status(409).json({ error: err.message });
      }
      next(err);
    }
  };
};`,
      language: 'javascript',
      output: `POST /api/users HTTP/1.1
Content-Type: application/json

{ "email": "alex@company.com", "name": "Alex" }

HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{
  "success": true,
  "data": { "id": 101, "email": "alex@company.com", "name": "Alex" }
}`,
      whyOutput:
        'The controller receives the HTTP request, unpacks email and name, and calls the service. The service executes domain logic (deduplication, creation, welcome email) without knowing anything about HTTP, returning the user object. The controller returns 201 Created.'
    },
    nodeJsApplication: {
      scenario: 'Reusing Business Logic across HTTP and Kafka Event Streams',
      description:
        'In enterprise architectures, an order can be placed via a REST API (Express) OR via an asynchronous Kafka message from a partner integration. Isolating logic in OrderService allows both the Express OrderController and the Kafka OrderConsumer to execute the exact same business rules without duplicating code.',
      codeSnippet: `// 1. REST Endpoint:
app.post('/orders', orderController.createOrder);

// 2. Kafka Message Consumer (Same Service Reused!):
kafkaConsumer.on('order.received', async (message) => {
  const payload = JSON.parse(message.value);
  await orderService.processOrder(payload.userId, payload.items);
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Why should business logic never be placed inside Express controllers?',
          spokenAnswer:
            'Placing business logic in controllers creates three major problems: 1) It tightly couples business rules to the HTTP transport layer, making it impossible to reuse the logic in background workers, cron jobs, or message queues; 2) It makes unit testing extremely difficult because tests must mock complex Express req and res objects instead of passing simple parameters; and 3) It violates the Single Responsibility Principle, creating massive "fat controllers" that handle parsing, validation, database access, and formatting all in one file.'
        },
        {
          question: 'What is the exact responsibility of a Controller in clean architecture?',
          spokenAnswer:
            'A controller has strictly three responsibilities: 1) Extract and sanitize data from the incoming HTTP request (req.params, req.query, req.body, req.headers); 2) Call the appropriate domain Service with clean JavaScript primitives or DTOs; and 3) Translate the service result or error into standard HTTP responses (setting status codes, serializing JSON, and managing cookies/headers).'
        }
      ],
      trickyFollowUp: {
        question: 'Should the Controller or the Service handle HTTP status code selection?',
        answer:
          'The Controller must always determine the HTTP status code. Services represent pure business domain logic and should not know what HTTP or REST is. A service throws domain exceptions (e.g. EntityNotFoundException, InsufficientFundsException), and the controller or centralized error handler maps those domain exceptions to HTTP 404 or 422.'
      },
      commonMistakes: [
        'Passing req or res into service methods: services should only accept clean domain arguments.',
        'Executing database queries directly in the controller.',
        'Not converting domain models to clean DTOs, accidentally leaking password hashes or internal DB columns to clients.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Controllers handle HTTP transport (req/res); Services handle business domain rules.',
        'Never pass Express req or res into Services: keep services 100% transport-agnostic.',
        'Services can be reused across REST controllers, Kafka consumers, and cron tasks.'
      ],
      oneLineDefinition:
        'The Controller-Service pattern decouples HTTP transport concerns from business domain rules, enabling testability, code reuse, and modular maintenance.',
      interviewTip:
        'Highlight the ability to reuse the Service inside background Kafka consumers or cron jobs as the primary architectural justification.',
      keyDistinction:
        'Controller vs Service: Controller speaks HTTP (status codes, JSON); Service speaks business domain (orders, discounts, payments).'
    }
  },
  {
    id: 'express-repository-pattern',
    number: 12,
    title: 'Repository Pattern',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Backend Architecture and Design Patterns',
    categorySlug: 'express-architecture-patterns',
    estimatedMinutes: 5,
    concept30Sec:
      'The Repository Pattern isolates domain business logic from the details of the database access layer. It mediates between the domain layer (Services) and the data mapping layers (SQL, Prisma, Mongoose) using a collection-like interface for accessing domain entities.',
    internals: {
      overview:
        'Without a repository, Service methods write raw SQL queries or ORM calls (e.g., prisma.user.findUnique or User.findOne). This tightly couples your entire business logic to a specific database vendor or ORM syntax. If you migrate from MongoDB to PostgreSQL, you must rewrite all your services. With the Repository Pattern, the Service calls interface methods like userRepository.findById(id). The repository encapsulates all SQL queries, connection pooling, and ORM abstractions behind that interface.',
      flowSteps: [
        '1. Interface Contract: Define IUserRepository with methods: findById, findByEmail, create, update, delete.',
        '2. Implementation: PostgresUserRepository implements IUserRepository using Prisma or pg pool.',
        '3. Service Inversion: UserService depends strictly on the interface IUserRepository.',
        '4. Query Encapsulation: Complex SQL joins, aggregations, and index hints remain encapsulated inside the repository.',
        '5. Test Mocking: During unit tests, a MockUserRepository (in-memory Map) is passed to UserService without running any real database.'
      ],
      diagram: `END-TO-END ARCHITECTURE WITH REPOSITORY PATTERN:

Client Request
      |
      v
[ Router ]
      |
      v
[ Controller ]       --> Handles HTTP (req, res)
      |
      v
[ Service ]          --> Executes Business Rules (e.g. check duplicate, hash password)
      |
      v
[ Repository ]       --> Encapsulates SQL / ORM Queries (Collection-like interface)
      |
      v
[ Database (PostgreSQL / MongoDB) ]`
    },
    codeExample: {
      code: `// 1. Repository Interface
export interface UserRepository {
  findById(id: string): Promise<{ id: string; name: string; balance: number } | null>;
  updateBalance(id: string, amount: number): Promise<void>;
}

// 2. Concrete PostgreSQL Repository Implementation
export class PostgresUserRepository implements UserRepository {
  constructor(private dbClient: any) {}

  async findById(id: string) {
    const res = await this.dbClient.query('SELECT id, name, balance FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async updateBalance(id: string, amount: number) {
    await this.dbClient.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amount, id]);
  }
}

// 3. Service depends on Repository Interface, NOT on PostgreSQL!
export class WalletService {
  constructor(private userRepo: UserRepository) {}

  async deposit(userId: string, amount: number) {
    if (amount <= 0) throw new Error('Deposit amount must be positive');
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('User not found');

    await this.userRepo.updateBalance(userId, amount);
    return { userId, newBalance: user.balance + amount };
  }
}`,
      language: 'javascript',
      output: `// Clean separation: WalletService can be unit-tested without any real database!`,
      whyOutput:
        'WalletService has zero knowledge of SQL or database drivers. It simply interacts with the UserRepository interface. In tests, you can pass an in-memory repository object in 2 lines of code without Docker or Postgres instances.'
    },
    nodeJsApplication: {
      scenario: 'Seamless Migration from MongoDB to PostgreSQL',
      description:
        'When an enterprise transitions from MongoDB to PostgreSQL for relational transaction guarantees, an application using the Repository Pattern requires zero changes to its Service or Controller layers. Only new PostgresRepository classes are written to fulfill the existing interface contracts.',
      codeSnippet: `// Swapping database implementation without touching 100+ business services:
// OLD: const userRepo = new MongoUserRepository(mongoDb);
// NEW:
const userRepo = new PostgresUserRepository(pgPool);
const userService = new UserService(userRepo); // Works identically!`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the primary benefit of using the Repository Pattern in Node.js applications?',
          spokenAnswer:
            'The primary benefit is decoupling your business logic from the underlying data persistence mechanism. Services interact with an abstract collection-like interface (e.g. findById, save) rather than database-specific queries or ORM models. This provides three major advantages: 1) Easy unit testing via mock in-memory repositories without running a live database; 2) Centralized database query optimization and caching; and 3) The ability to swap or upgrade database technologies without touching business rules.'
        },
        {
          question: 'Does using an ORM like Prisma or Mongoose make the Repository Pattern redundant?',
          spokenAnswer:
            'No, not in enterprise codebases. While an ORM abstracts raw SQL, calling ORM methods directly across 50 services still tightly couples your business logic to that specific ORM API. If Prisma introduces breaking schema changes or if you need to optimize a query with raw SQL or Redis caching, you would have to modify every service. A repository centralizes those queries in one place.'
        }
      ],
      trickyFollowUp: {
        question: 'How do you handle multi-repository ACID transactions within the Service layer?',
        answer:
          'Use the Unit of Work pattern or pass a Transaction Context object from the service down to the repositories (e.g., userRepo.update(id, data, { txClient })). This allows the service to orchestrate the transaction boundary (BEGIN / COMMIT / ROLLBACK) while repositories execute queries within that shared transaction handle.'
      },
      commonMistakes: [
        'Leaking database-specific objects (like Mongoose documents with .save() or Mongoose ObjectIds) into the service layer.',
        'Over-engineering tiny CRUD microservices with excessive repository boilerplate when an ORM query suffices.',
        'Creating a generic repository that only supports basic CRUD, forcing developers to bypass the repository for complex queries.'
      ]
    },
    quickRevision: {
      takeaways: [
        'The Repository Pattern encapsulates data access behind a collection-like interface.',
        'Services depend on repository contracts, keeping business logic 100% database-agnostic.',
        'Enables fast, reliable unit testing without Docker or database spin-up.'
      ],
      oneLineDefinition:
        'The Repository Pattern mediates between the domain service layer and data persistence, decoupling business logic from database technologies and ORMs.',
      interviewTip:
        'Mention Unit of Work or passing a transaction context handle when asked how to coordinate transactions across multiple repositories.',
      keyDistinction:
        'DAO vs Repository: DAO is an abstraction over a single database table/record; Repository is an abstraction over an entire aggregate collection of domain entities.'
    }
  },
  {
    id: 'express-dependency-injection',
    number: 13,
    title: 'Dependency Injection',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Backend Architecture and Design Patterns',
    categorySlug: 'express-architecture-patterns',
    estimatedMinutes: 5,
    concept30Sec:
      'Dependency Injection (DI) is a software design pattern where a component receives its dependencies from an external source (assembler or composition root) rather than creating or importing them internally. It enables loose coupling, modular composition, and effortless test mocking without heavy frameworks.',
    internals: {
      overview:
        'In naive Node.js code, modules use hardcoded imports: const db = require("./db"). This hardwires dependencies, making it impossible to replace db with a test mock or an alternative implementation without fragile module-monkey-patching (like proxyquire). With Dependency Injection, components receive dependencies via constructor injection (new UserService(userRepo)) or factory function injection (createUserService({ userRepo })). The application entry point (Composition Root) instantiates and wires all dependencies together.',
      flowSteps: [
        '1. Component Definition: UserService declares constructor(userRepo, emailService). Does NOT import database directly!',
        '2. Composition Root: In server.ts or container.ts, instantiate raw dependencies (DB pool, Stripe client).',
        '3. Layer Assembly: Pass DB pool into Repositories -> Pass Repositories into Services -> Pass Services into Controllers.',
        '4. Route Binding: Pass Controllers to Express router methods.',
        '5. Unit Testing: In test files, instantiate new UserService(mockUserRepo, mockEmailService) directly. No live DB or network required!'
      ],
      diagram: `HARDCODED IMPORTS VS DEPENDENCY INJECTION:

Hardcoded Anti-Pattern (Tightly Coupled, Hard to Test):
  UserService.js
     +--> import db from './db'          (Hardcoded Database!)
     +--> import stripe from './stripe'  (Hardcoded Stripe Client!)

Dependency Injection (Decoupled, Easily Mockable):
  Composition Root (server.ts):
     dbPool = createPgPool()
     userRepo = new PostgresUserRepo(dbPool)
     emailService = new SendgridEmailService(apiKey)
               |
               v (Injected into Constructor)
     userService = new UserService(userRepo, emailService)
               |
               v (Injected into Controller)
     userController = new UserController(userService)`
    },
    codeExample: {
      code: `// 1. Business Service accepting dependencies via Constructor Injection
export class OrderService {
  constructor(
    private orderRepo: { save(order: any): Promise<any> },
    private paymentGateway: { charge(amount: number): Promise<{ id: string }> }
  ) {}

  async checkout(userId: string, amount: number) {
    const payment = await this.paymentGateway.charge(amount);
    const order = await this.orderRepo.save({
      userId,
      amount,
      paymentId: payment.id,
      status: 'CONFIRMED'
    });
    return order;
  }
}

// 2. Unit Test demonstrating 100% Mocking without external frameworks:
async function testCheckoutSuccess() {
  const mockRepo = {
    save: async (order: any) => ({ id: 'ORD-123', ...order })
  };
  const mockPayment = {
    charge: async (amt: number) => ({ id: 'PAY-999' })
  };

  // Inject mocks cleanly!
  const service = new OrderService(mockRepo, mockPayment);
  const result = await service.checkout('USER-1', 150);

  console.log('Test Result:', result.id === 'ORD-123' && result.paymentId === 'PAY-999' ? 'PASS' : 'FAIL');
}

testCheckoutSuccess();`,
      language: 'javascript',
      output: `Test Result: PASS`,
      whyOutput:
        'OrderService accepts its dependencies through its constructor. In the unit test, mock objects for orderRepo and paymentGateway are injected directly, verifying the business logic in milliseconds without hitting any real database or payment API.'
    },
    nodeJsApplication: {
      scenario: 'Composition Root in Enterprise Microservices',
      description:
        'Instead of using complex, heavy Java-like reflection frameworks (like InversifyJS or TypeDI), senior Node.js teams often use pure "Poor Man DI" (Pure DI) in a dedicated container.ts file. This provides compile-time TypeScript safety, zero runtime overhead, and crystal-clear startup wiring.',
      codeSnippet: `// src/container.ts (Pure Composition Root)
export function buildContainer() {
  const db = new DatabaseConnection(process.env.DATABASE_URL);
  const redis = new RedisClient(process.env.REDIS_URL);

  const userRepo = new PostgresUserRepository(db);
  const cacheService = new RedisCacheService(redis);
  const userService = new UserService(userRepo, cacheService);
  const userController = new UserController(userService);

  return { userController, db, redis };
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Do you need a heavy dependency injection framework to do DI in Node.js and Express?',
          spokenAnswer:
            'No, absolutely not. In modern JavaScript and TypeScript, "Pure DI" (also known as Manual or Constructor Dependency Injection) using simple constructors or factory functions is often superior to heavy reflection-based IoC containers. It avoids decorators, experimental metadata, and runtime reflection overhead, while offering 100% type safety and making dependencies transparent.'
        },
        {
          question: 'What is a "Composition Root" in Dependency Injection?',
          spokenAnswer:
            'The Composition Root is the unique single location in an application where the dependency graph is composed and wired together—typically inside server.ts or container.ts during application startup. Modules declare their dependencies in constructors, and the composition root instantiates all objects and injects them from the outside.'
        }
      ],
      trickyFollowUp: {
        question: 'How do you bind controller methods to Express routes when using class-based dependency injection?',
        answer:
          'When passing class methods to Express routes (e.g. router.get("/users", userController.getUsers)), JavaScript tears off the method from the instance, losing its "this" context. To prevent "Cannot read property of undefined", you must either bind the method in the constructor (this.getUsers = this.getUsers.bind(this)), use arrow property syntax (getUsers = (req, res) => ...), or wrap it in an inline arrow function (req, res => this.userController.getUsers(req, res)).'
      },
      commonMistakes: [
        'Losing "this" context when passing class controller methods to Express routers without arrow functions or binding.',
        'Hardcoding database connections inside service files, making unit tests dependent on live databases.',
        'Over-engineering small microservices with heavy reflection-based IoC containers when plain constructor injection is cleaner.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Dependency Injection supplies dependencies from the outside via constructors or factories.',
        'Pure DI (manual constructor injection) is lightweight, type-safe, and avoids runtime IoC overhead.',
        'The Composition Root is the centralized startup entry where all layers are wired together.'
      ],
      oneLineDefinition:
        'Dependency Injection is the practice of passing dependencies into components via constructors or factories rather than hardcoding them internally, maximizing testability and loose coupling.',
      interviewTip:
        'Mention the "lost this context" trap when passing class controller methods to Express routers: this proves real-world experience.',
      keyDistinction:
        'IoC Container vs Pure DI: IoC containers use reflection and decorators to resolve dependencies at runtime; Pure DI wires dependencies explicitly at compile time.'
    }
  }
];
