import { QuickReferenceTopic, ComparisonTable } from './types';

const COOKIES_VS_SESSIONS_TABLE: ComparisonTable = {
  headers: ['Attribute', 'HTTP Cookies', 'Server-Side Sessions (Redis)', 'JWT Tokens (Stateless)'],
  rows: [
    [
      'Storage Location',
      'Client Browser (Storage limited to ~4KB)',
      'Server Memory / Redis Database',
      'Client (LocalStorage or HttpOnly Cookie)'
    ],
    [
      'Data Contained',
      'Raw key-value pairs or signed session IDs',
      'Arbitrary server state mapped to session ID',
      'Self-contained signed JSON payload'
    ],
    [
      'Security Flags',
      'HttpOnly (no JS access), Secure, SameSite',
      'Session ID stored in HttpOnly cookie',
      'Vulnerable to XSS if stored in LocalStorage'
    ],
    [
      'Revocation & Invalidation',
      'Client deletion or Max-Age expiration',
      'Instant: Server deletes Redis key immediately',
      'Difficult: Requires token blacklisting in Redis'
    ],
    [
      'Multi-Instance Scaling',
      'Stateless across server instances',
      'Requires shared Redis cluster (MemoryStore fails)',
      'Stateless across any number of server pods'
    ]
  ]
};

export const expressCategory5SecurityState: QuickReferenceTopic[] = [
  {
    id: 'express-cookies-sessions',
    number: 17,
    title: 'Cookies and Sessions',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'HTTP State and Security-Related Middleware',
    categorySlug: 'express-security-state',
    estimatedMinutes: 5,
    concept30Sec:
      'HTTP is fundamentally stateless. Cookies and Sessions re-introduce state into web applications. A cookie is a small key-value pair stored by the client browser. A session stores application state on the server (typically in Redis), storing only an opaque, cryptographically signed Session ID in an HttpOnly cookie on the client.',
    internals: {
      overview:
        'When a user authenticates, express-session creates a session record in a shared store (like Redis) with a unique session ID. Express sends Set-Cookie: connect.sid=s%3A...; HttpOnly; Secure; SameSite=Lax. On subsequent requests, the browser automatically sends Cookie: connect.sid=... in headers. The middleware extracts the session ID, verifies the cryptographic signature (using cookie-signature), fetches the session data from Redis, and populates req.session. Default MemoryStore leaks memory and cannot be used in multi-pod production.',
      flowSteps: [
        '1. Authentication: User submits valid credentials to POST /login.',
        '2. Session Creation: express-session creates req.session.userId = user.id and generates a random session ID.',
        '3. Store Persistence: Writes session record into Redis: SETEX sess:id 86400 "{ userId: 101 }".',
        '4. Cookie Header: Sends Set-Cookie: connect.sid=s%3A...; Path=/; HttpOnly; Secure; SameSite=Lax.',
        '5. Subsequent Request: Browser sends Cookie: connect.sid=... on every HTTP call to that domain.',
        '6. Deserialization: Middleware unpacks connect.sid, queries Redis, and reconstructs req.session.'
      ],
      diagram: `SESSION & COOKIE SECURITY FLOW:

Client Browser                                       Express App (with Redis Store)
      |                                                             |
      | --- 1. POST /login (Credentials) -------------------------> |
      |                                                             | Authenticates user
      |                                                             | Generates Session ID: "sid_789"
      |                                                             | Writes to Redis: sess:sid_789 -> { user }
      | <--- 2. Set-Cookie: sid=sid_789; HttpOnly; Secure; SameSite |
      |                                                             |
(Subsequent Requests)                                               |
      |                                                             |
      | --- 3. GET /profile (Cookie: sid=sid_789) ----------------> |
      |                                                             | Reads Redis: sess:sid_789
      |                                                             | Attaches req.session.user
      | <--- 4. HTTP 200 OK (Profile Data) ------------------------ |`
    },
    codeExample: {
      code: `import express from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';

const app = express();
app.use(express.json());

// 1. Initialize Redis Client for production session store
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
// await redisClient.connect();

const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'sess:'
});

// 2. Production Session Configuration
app.use(session({
  store: redisStore,
  secret: process.env.SESSION_SECRET || 'super-secure-signing-key',
  resave: false,               // Prevents resaving session if unmodified
  saveUninitialized: false,    // Do not create empty sessions for unauthenticated visitors
  name: '__Host-session',      // Secure cookie prefix preventing subdomain overwriting
  cookie: {
    httpOnly: true,            // BLOCKS JavaScript document.cookie access (Mitigates XSS)
    secure: process.env.NODE_ENV === 'production', // Requires HTTPS
    sameSite: 'lax',           // Mitigates Cross-Site Request Forgery (CSRF)
    maxAge: 1000 * 60 * 60 * 24 // 24 hours in milliseconds
  }
}));

app.post('/login', (req, res) => {
  // Login verification logic...
  (req.session as any).userId = 'user_101';
  res.json({ message: 'Logged in successfully' });
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    res.clearCookie('__Host-session');
    res.json({ message: 'Logged out successfully' });
  });
});`,
      language: 'javascript',
      output: `POST /login HTTP/1.1

HTTP/1.1 200 OK
Set-Cookie: __Host-session=s%3AX...; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax
Content-Type: application/json; charset=utf-8

{ "message": "Logged in successfully" }`,
      whyOutput:
        'Upon login, express-session generates a signed session ID and stores user state in Redis. The browser receives the Set-Cookie header with HttpOnly (blocking XSS), Secure (enforcing HTTPS), and SameSite=Lax (blocking CSRF).'
    },
    nodeJsApplication: {
      scenario: 'Instant Session Revocation for Compromised Accounts',
      description:
        'Unlike stateless JWTs (which cannot be revoked until expiration without Redis blacklisting), server-side sessions stored in Redis can be revoked instantly. If a user clicks "Log out of all devices" or if an admin disables a compromised account, deleting the Redis session keys terminates access in milliseconds.',
      codeSnippet: `// Revoke all sessions for a compromised user across all devices:
async function revokeAllUserSessions(userId) {
  const sessionKeys = await redisClient.keys(\`sess:*\`);
  for (const key of sessionKeys) {
    const raw = await redisClient.get(key);
    const data = JSON.parse(raw);
    if (data.userId === userId) {
      await redisClient.del(key); // Instantly terminates active session!
    }
  }
}`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What do the HttpOnly, Secure, and SameSite cookie attributes do, and why are they vital for security?',
          spokenAnswer:
            'HttpOnly prevents client-side JavaScript (e.g. document.cookie) from accessing the cookie, completely neutralizing cookie-stealing XSS attacks. Secure ensures the browser only transmits the cookie over encrypted HTTPS connections, preventing man-in-the-middle packet sniffing on public networks. SameSite (Strict or Lax) instructs browsers not to send the cookie on cross-site requests, providing robust protection against Cross-Site Request Forgery (CSRF) attacks.'
        },
        {
          question: 'Why is the default MemoryStore in express-session dangerous in production?',
          spokenAnswer:
            'MemoryStore stores all session data directly inside the single Node.js process V8 heap memory. In production, this causes three fatal flaws: 1) Memory Leaks: session objects accumulate in RAM until the process crashes with Out Of Memory; 2) No Multi-Instance Scaling: if you run 4 cluster workers or multiple container pods behind a load balancer, requests from the same user hit different pods that cannot see each other sessions; and 3) Data Loss: restarting the process wipes all active user logins. Production requires a shared external store like Redis.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the difference between signed cookies (cookieParser) and encrypted cookies?',
        answer:
          'Signed cookies are NOT encrypted! Anyone can read the cookie value in plain text in their browser dev tools. Signing merely appends an HMAC signature (using a secret key) to verify that the client has not tampered with or modified the value. If you need confidentiality, you must encrypt the payload.'
      },
      commonMistakes: [
        'Using express-session with default MemoryStore in production.',
        'Storing sensitive personal data (passwords, credit cards) directly in client cookies instead of on the server.',
        'Not setting Secure: true and SameSite: "lax" on session cookies in production.'
      ]
    },
    quickRevision: {
      takeaways: [
        'HttpOnly protects against XSS; Secure protects against MitM sniffing; SameSite protects against CSRF.',
        'Never use default MemoryStore in production: always use Redis (connect-redis).',
        'Signed cookies prevent tampering, but they are NOT encrypted (still readable in plaintext).'
      ],
      oneLineDefinition:
        'Cookies store state on client browsers, while Sessions store state in an external database (Redis) keyed by a signed HttpOnly session ID cookie.',
      interviewTip:
        'Highlight the exact security threats mitigated by each cookie flag: HttpOnly (XSS), Secure (MitM), SameSite (CSRF).',
      keyDistinction:
        'Cookies vs Sessions: Cookies store data on the client (4KB limit); Sessions store data on the server with only an ID on the client.'
    },
    comparisonTable: COOKIES_VS_SESSIONS_TABLE
  },
  {
    id: 'express-cors',
    number: 18,
    title: 'CORS',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'HTTP State and Security-Related Middleware',
    categorySlug: 'express-security-state',
    estimatedMinutes: 5,
    concept30Sec:
      'Cross-Origin Resource Sharing (CORS) is an HTTP-header-based browser security mechanism that allows a server to explicitly whitelist which origins (protocol, domain, port) are permitted to read its responses. It relaxes the browser default Same-Origin Policy (SOP).',
    internals: {
      overview:
        'CRITICAL SENIOR DISTINCTION: CORS is purely a BROWSER enforcement mechanism. CORS does NOT protect your API from unauthorized access by curl, Postman, mobile apps, or backend servers—those clients ignore CORS headers completely! When a browser makes a "non-simple" cross-origin request (e.g. methods like PUT/DELETE, or headers like Content-Type: application/json or Authorization), the browser first sends an automatic HTTP OPTIONS "preflight" request. The server must respond with matching Access-Control-Allow-* headers before the browser will dispatch the actual request.',
      flowSteps: [
        '1. Origin Check: Browser identifies request origin (e.g. https://frontend.com) differs from target (https://api.backend.com).',
        '2. Preflight Trigger: If method is not simple (e.g. POST with JSON or PUT/DELETE), browser dispatches HTTP OPTIONS.',
        '3. Preflight Headers: Browser sends Origin, Access-Control-Request-Method, and Access-Control-Request-Headers.',
        '4. Server Validation: cors() middleware evaluates origin against whitelist.',
        '5. Preflight Response: Server returns 204 No Content with Access-Control-Allow-Origin, Allow-Methods, Allow-Headers.',
        '6. Actual Request: Browser sends the real HTTP request (e.g. POST /checkout); server processes and responds.',
        '7. Credentials Constraint: If credentials: true is set, Access-Control-Allow-Origin CANNOT be "*" (wildcard)! It must be an explicit origin.'
      ],
      diagram: `CORS PREFLIGHT (OPTIONS) HANDSHAKE:

Browser (https://frontend.com)                      Server (https://api.backend.com)
      |                                                           |
      | --- 1. OPTIONS /api/data (Preflight) -------------------> |
      |        Origin: https://frontend.com                       | Checks origin whitelist
      |        Access-Control-Request-Method: DELETE              | Matches!
      |                                                           |
      | <--- 2. HTTP 204 No Content ----------------------------- |
      |        Access-Control-Allow-Origin: https://frontend.com  |
      |        Access-Control-Allow-Methods: GET,POST,DELETE      |
      |        Access-Control-Max-Age: 86400 (Caches preflight!)  |
      |                                                           |
(Browser receives permission to send actual request)              |
      |                                                           |
      | --- 3. DELETE /api/data (Actual Request) ---------------> |
      |        Authorization: Bearer <token>                      | Processes deletion...
      |                                                           |
      | <--- 4. HTTP 200 OK ------------------------------------- |`
    },
    codeExample: {
      code: `import express from 'express';
import cors from 'cors';

const app = express();

const allowedOrigins = [
  'https://mycompany.com',
  'https://admin.mycompany.com',
  'http://localhost:3000' // Local development
];

// Production-Grade Dynamic CORS Configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (like server-to-server or curl where origin is undefined)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(\`CORS Blocked: Origin '\${origin}' is not authorized\`));
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  maxAge: 86400 // Cache preflight OPTIONS response for 24 hours to reduce latency!
};

app.use(cors(corsOptions));
// Handle preflight explicitly for all routes:
app.options('*', cors(corsOptions));`,
      language: 'javascript',
      output: `OPTIONS /api/v1/orders HTTP/1.1
Origin: https://mycompany.com
Access-Control-Request-Method: POST

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://mycompany.com
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400`,
      whyOutput:
        'The preflight OPTIONS request matches the dynamic origin whitelist. The cors middleware responds with HTTP 204 and permits credentials. Setting maxAge: 86400 instructs the browser to cache this preflight result for 24 hours, eliminating preflight round trips on subsequent calls.'
    },
    nodeJsApplication: {
      scenario: 'Multi-Tenant Subdomain Whitelisting with Regex',
      description:
        'In B2B SaaS platforms where enterprise customers have custom subdomains (e.g. acme.app.com, stripe.app.com), hardcoded origin arrays fail. Senior engineers use regex origin matchers in CORS options to dynamically validate trusted tenant subdomains.',
      codeSnippet: `const tenantCors = cors({
  origin: (origin, cb) => {
    // Allow any trusted customer subdomain: https://*.skillvault.io
    const isTenantDomain = /^https:\\/\\/[a-z0-9-]+\\.skillvault\\.io$/.test(origin || '');
    if (!origin || isTenantDomain) {
      cb(null, true);
    } else {
      cb(new Error('Cross-origin tenant access denied'));
    }
  },
  credentials: true
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Does CORS protect your backend API from unauthorized attackers or data breaches?',
          spokenAnswer:
            'No, absolutely not! This is one of the most common misconceptions in web development. CORS is strictly a BROWSER-enforced security mechanism designed to protect users from malicious websites reading their private data across origins via the browser. Attackers, hackers, automated scripts, curl, Postman, and server-to-server HTTP clients do not enforce the Same-Origin Policy and completely ignore CORS headers. Backend security must rely on robust authentication (JWTs, session tokens), input validation, and rate limiting—never on CORS.'
        },
        {
          question: 'Why can you not use Access-Control-Allow-Origin: "*" when Access-Control-Allow-Credentials is true?',
          spokenAnswer:
            'The W3C CORS specification explicitly forbids using the wildcard "*" when credentials (cookies, HTTP authentication, client certificates) are allowed. If browsers allowed wildcard origins with credentials, any malicious website on the internet could make authenticated requests with your session cookies and read your private banking or personal data. If credentials: true is set, the server MUST return the exact, specific requesting origin.'
        }
      ],
      trickyFollowUp: {
        question: 'What is the purpose of the Access-Control-Max-Age header in CORS responses?',
        answer:
          'Access-Control-Max-Age indicates how many seconds the browser is allowed to cache the result of an OPTIONS preflight request. Setting maxAge (e.g. 86400 for 24 hours) eliminates the overhead of sending an extra OPTIONS network request before every single API call, cutting client API latency in half.'
      },
      commonMistakes: [
        'Believing CORS is an authentication or API protection mechanism.',
        'Using app.use(cors()) with default wildcard settings on private authenticated APIs.',
        'Not handling HTTP OPTIONS preflight explicitly, causing 404 or 405 errors on preflights in complex router configurations.'
      ]
    },
    quickRevision: {
      takeaways: [
        'CORS is a browser-only security feature; non-browser tools (curl/Postman) bypass it entirely.',
        'Preflight OPTIONS requests are sent automatically for non-simple methods/headers.',
        'Cannot combine Access-Control-Allow-Origin: * with credentials: true.',
        'Use Access-Control-Max-Age to cache preflight responses and reduce network latency.'
      ],
      oneLineDefinition:
        'CORS is an HTTP-header mechanism allowing servers to tell browsers which origins are permitted to access their resources across origin boundaries.',
      interviewTip:
        'Firmly emphasize that "CORS is for browsers, not API security": this immediately distinguishes senior engineers from juniors.',
      keyDistinction:
        'CORS vs Authentication: CORS dictates what the browser can read; Authentication dictates who the user is.'
    }
  },
  {
    id: 'express-rate-limiting',
    number: 19,
    title: 'Rate Limiting',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'HTTP State and Security-Related Middleware',
    categorySlug: 'express-security-state',
    estimatedMinutes: 5,
    concept30Sec:
      'Rate limiting is a defensive mechanism that caps the number of requests a client can make to an API within a given time window. It protects backend servers from Denial-of-Service (DoS) attacks, brute-force credential stuffing, API scraping, and cascading resource exhaustion.',
    internals: {
      overview:
        'When a request arrives, rate-limiting middleware extracts a client key (client IP or authenticated user ID). It queries an atomic counter in memory or Redis for that key. If the counter is within the limit, it increments the count and sets standard HTTP rate limit headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset). If the count exceeds the threshold, it halts the request immediately with HTTP 429 Too Many Requests and a Retry-After header. In multi-instance deployments, Redis is required for shared distributed state.',
      flowSteps: [
        '1. Key Identification: Extracts key (e.g. req.ip or req.user.id).',
        '2. Proxy Resolution: Evaluates app.get("trust proxy") to extract the real client IP from X-Forwarded-For.',
        '3. Atomic Counter Check: In Redis, increments the key with expiration: INCR key; EXPIRE key windowSec (or sliding window Lua script).',
        '4. Threshold Comparison: If count <= max, sets rate-limit headers and calls next().',
        '5. Limit Breach: If count > max, aborts request with HTTP 429 Too Many Requests.',
        '6. Retry-After Header: Computes remaining seconds in the window and attaches Retry-After: <seconds>.'
      ],
      diagram: `DISTRIBUTED RATE LIMITING WITH REDIS & TRUST PROXY:

Client Request (IP: 203.0.113.195)
         |
         v
[ AWS ALB / Cloudflare Proxy ]
         | (Adds: X-Forwarded-For: 203.0.113.195)
         v
[ Express App Instance 1 ]       [ Express App Instance 2 ]
(app.set('trust proxy', 1))     (app.set('trust proxy', 1))
         |                                |
         +----------------+---------------+
                          |
                          v
         [ Shared Redis Rate Limit Store ]
         Key: "rl:203.0.113.195" -> Count: 101/100
                          |
                          v (Threshold Exceeded!)
         HTTP 429 Too Many Requests
         Retry-After: 45`
    },
    codeExample: {
      code: `import express from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';

const app = express();

// CRITICAL for applications behind Load Balancers (AWS ALB, Nginx, Cloudflare):
app.set('trust proxy', 1); // Trusts first hop reverse proxy to correctly populate req.ip!

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
// await redisClient.connect();

// 1. Strict Limiter for Sensitive Endpoints (Brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // Limit each IP to 5 failed login attempts per window
  standardHeaders: 'draft-7', // Return standard RateLimit-* headers
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many login attempts. Please try again after 15 minutes.'
  },
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args)
  })
});

// 2. Dynamic Limiter: Tier-based Rate Limiting by Authenticated User
const dynamicTierLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req: any) => {
    if (req.user?.tier === 'ENTERPRISE') return 1000;
    if (req.user?.tier === 'PRO') return 200;
    return 60; // Free tier
  },
  keyGenerator: (req: any) => req.user?.id || req.ip // Rate limit by User ID if logged in!
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  res.json({ token: 'jwt-token' });
});`,
      language: 'javascript',
      output: `POST /api/auth/login (6th attempt within 15 mins) HTTP/1.1

HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: 840
Retry-After: 840
Content-Type: application/json; charset=utf-8

{
  "status": 429,
  "error": "Too many login attempts. Please try again after 15 minutes."
}`,
      whyOutput:
        'On the 6th login attempt within the 15-minute window, the Redis-backed rate limiter detects that the limit of 5 is exceeded. It rejects the connection with HTTP 429, standard RateLimit headers, and a Retry-After timestamp.'
    },
    nodeJsApplication: {
      scenario: 'Preventing False-Positive Rate Limits with trust proxy',
      description:
        'When deploying to AWS ECS, Kubernetes Ingress, or Heroku, incoming requests pass through a reverse proxy. Without app.set("trust proxy", 1), Express reads req.ip as the internal private IP of the load balancer (e.g. 10.0.0.1) for EVERY user. One user exceeding the rate limit will accidentally block all 100,000 customers globally!',
      codeSnippet: `// NEVER forget trust proxy when behind reverse proxies:
app.set('trust proxy', 1); // Reads client IP from X-Forwarded-For header securely`
    },
    interviewPrep: {
      questions: [
        {
          question: 'Why is app.set("trust proxy", 1) essential when rate limiting an Express app behind a load balancer?',
          spokenAnswer:
            'When an Express app sits behind a reverse proxy (like AWS ALB, Cloudflare, or Nginx), the immediate TCP connection to Node.js originates from the load balancer, not the end user. Without app.set("trust proxy", 1), Express sets req.ip to the IP address of the load balancer. As a result, all incoming users share the exact same IP in the eyes of the rate limiter. When one user exceeds the threshold, the rate limiter locks out every single customer on the entire platform. Setting trust proxy instructs Express to read the real client IP from the X-Forwarded-For header.'
        },
        {
          question: 'What is the difference between Fixed Window and Sliding Window Log rate limiting?',
          spokenAnswer:
            'Fixed Window divides time into static buckets (e.g. 12:00 to 12:01). It has a major vulnerability: a client can send 100 requests at 12:00:59 and another 100 requests at 12:01:01, resulting in 200 requests within 2 seconds (the boundary burst flaw). Sliding Window (often implemented via Redis Sorted Sets) continuously measures the request rate over a rolling time window relative to the current millisecond, completely eliminating boundary burst spikes.'
        }
      ],
      trickyFollowUp: {
        question: 'Should you rate limit public APIs strictly by IP address?',
        answer:
          'No! Large organizations, universities, and corporate offices route thousands of employees through a single public NAT gateway IP. If you rate limit strictly by IP, one employee can block the entire office. For authenticated APIs, always rate limit by API Key or User ID (keyGenerator: req => req.user.id).'
      },
      commonMistakes: [
        'Forgetting trust proxy behind reverse proxies, causing all users to share the load balancer IP.',
        'Using in-memory rate limiting across multi-pod Kubernetes clusters, allowing clients to bypass limits by rotating pods.',
        'Not returning the Retry-After header with HTTP 429 responses.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Always set app.set("trust proxy", 1) when deployed behind load balancers or Cloudflare.',
        'In multi-instance deployments, use Redis (rate-limit-redis) for shared atomic rate limiting.',
        'Rate limit by User ID / API Key for authenticated users; rate limit by IP for public auth endpoints.'
      ],
      oneLineDefinition:
        'Rate limiting restricts the frequency of client requests to prevent DoS attacks, brute-force cracking, and service degradation.',
      interviewTip:
        'Mention the "NAT Gateway shared IP trap" and the "Reverse Proxy ALB IP trap" to show real production infrastructure wisdom.',
      keyDistinction:
        'Fixed Window vs Sliding Window: Fixed window resets at static clock intervals (vulnerable to edge bursts); Sliding window calculates rate over a rolling time window.'
    }
  }
];
