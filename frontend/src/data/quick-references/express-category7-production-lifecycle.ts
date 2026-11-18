import { QuickReferenceTopic } from './types';

export const expressCategory7ProductionLifecycle: QuickReferenceTopic[] = [
  {
    id: 'express-graceful-shutdown',
    number: 22,
    title: 'Graceful Shutdown',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Production and Application Lifecycle',
    categorySlug: 'express-production-lifecycle',
    estimatedMinutes: 5,
    concept30Sec:
      'Graceful shutdown is the process of safely terminating a running Node.js server upon receiving termination signals (SIGTERM/SIGINT) from the operating system, Docker, or Kubernetes. It stops accepting new requests, finishes in-flight requests, flushes logs, and safely closes database and cache connections before exiting.',
    internals: {
      overview:
        'When Kubernetes deploys a new version or scales down a pod, it sends SIGTERM. A naive app that immediately calls process.exit(0) aborts active HTTP requests, corrupts database transactions, and drops user checkouts. A graceful shutdown sequence: 1) Intercepts SIGTERM/SIGINT; 2) Sets a readiness flag to false so load balancers stop sending traffic; 3) Calls server.close(), which stops listening on the port but lets active requests finish; 4) Closes idle HTTP keep-alive connections (server.closeIdleConnections()); 5) Drains background queues and closes DB pools; 6) Enforces a hard safety timeout (e.g. 15s) in case a hanging request stalls the shutdown.',
      flowSteps: [
        '1. Signal Interception: process.on("SIGTERM", handleShutdown);',
        '2. Readiness De-registration: Mark app not ready so Kubernetes /readyz returns 503 and removes pod from ingress routing.',
        '3. Close Listener: server.close() prevents any new incoming TCP connections.',
        '4. Close Idle Sockets: server.closeIdleConnections() terminates HTTP keep-alive sockets that are waiting between requests.',
        '5. In-Flight Draining: Allow active HTTP handlers to complete and send their responses.',
        '6. Resource Cleanup: Await redisClient.quit(), pgPool.end(), and rabbitmqChannel.close().',
        '7. Safety Watchdog: If cleanup exceeds 15 seconds, force terminate via process.exit(1).',
        '8. Clean Exit: Once all resources are closed, exit cleanly with process.exit(0).'
      ],
      diagram: `KUBERNETES ROLLING DEPLOYMENT GRACEFUL SHUTDOWN:

K8s Engine sends: [ SIGTERM Signal ]
                    |
                    v
1. [ Set isShuttingDown = true ] --> /readyz now returns 503 (Ingress stops routing traffic)
                    |
                    v
2. [ server.close() ]           --> Stops accepting new TCP connections
                    |
3. [ server.closeIdleConnections() ] --> Closes open HTTP Keep-Alive sockets
                    |
4. [ Wait for In-Flight Requests ]  --> Completes active database transactions
                    |
5. [ Close DB / Redis Pools ]   --> pgPool.end(), redis.quit()
                    |
6. [ process.exit(0) ]          --> Clean, zero-downtime container termination!`
    },
    codeExample: {
      code: `import express from 'express';
import http from 'node:http';

const app = express();
let isShuttingDown = false;

// Readiness Probe: returns 503 during shutdown so Load Balancers stop routing traffic
app.get('/readyz', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ status: 'terminating', ready: false });
  }
  res.status(200).json({ status: 'ready', ready: true });
});

app.get('/slow-checkout', async (req, res) => {
  // Simulating 5-second long transaction
  await new Promise((resolve) => setTimeout(resolve, 5000));
  res.json({ success: true, message: 'Payment settled safely' });
});

const server = http.createServer(app);
server.listen(3000, () => console.log('Server started on port 3000'));

// PRODUCTION GRACEFUL SHUTDOWN HANDLER
function initGracefulShutdown(signal: string) {
  console.log(\`Received \${signal}. Initiating graceful shutdown...\`);
  isShuttingDown = true;

  // 1. Forceful Termination Safety Watchdog (10 seconds)
  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out (10s)! Forcing termination...');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref(); // Prevent timer from keeping event loop alive

  // 2. Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      console.error('Error during server.close():', err);
      process.exit(1);
    }
    console.log('HTTP server closed. Cleaning up databases...');

    try {
      // 3. Drain and disconnect databases / queues
      // await dbPool.end();
      // await redisClient.quit();
      console.log('All connections drained cleanly. Exiting.');
      process.exit(0);
    } catch (cleanupErr) {
      console.error('Error during resource cleanup:', cleanupErr);
      process.exit(1);
    }
  });

  // 3. Close open HTTP Keep-Alive connections (Node 19+)
  if (typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }
}

process.on('SIGTERM', () => initGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => initGracefulShutdown('SIGINT'));`,
      language: 'javascript',
      output: `Server started on port 3000
// When Docker / K8s terminates pod:
Received SIGTERM. Initiating graceful shutdown...
HTTP server closed. Cleaning up databases...
All connections drained cleanly. Exiting.`,
      whyOutput:
        'When SIGTERM arrives, isShuttingDown flips to true, causing /readyz to return 503. server.close() stops accepting new connections while active checkout requests finish. Once in-flight requests end, the callback drains DB connections and exits cleanly with 0.'
    },
    nodeJsApplication: {
      scenario: 'Zero-Downtime Rolling Deployments in Kubernetes',
      description:
        'In Kubernetes or AWS ECS, new pods are spun up while old pods are terminated. Without graceful shutdown, every deployment drops active user payment requests and websockets, triggering 502 Bad Gateway alerts in Datadog. A graceful shutdown ensures 100% zero-downtime deployments.',
      codeSnippet: `// Kubernetes Pod termination sequence:
// 1. K8s removes pod from Endpoints (traffic stops)
// 2. K8s sends SIGTERM
// 3. App waits brief delay (e.g. 2s) to ensure kube-proxy has updated routing tables:
process.on('SIGTERM', async () => {
  await new Promise(r => setTimeout(r, 2000));
  initGracefulShutdown('SIGTERM');
});`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the purpose of graceful shutdown and how do you implement it in Node.js?',
          spokenAnswer:
            'Graceful shutdown ensures an application shuts down cleanly without dropping active user requests or corrupting data when the container or server terminates. You implement it by intercepting operating system signals like SIGTERM (from Kubernetes/Docker) and SIGINT (Ctrl+C). Upon receiving the signal, you mark the readiness probe unhealthy so the load balancer stops routing new requests, call server.close() to stop accepting new TCP connections while letting active requests finish, close idle keep-alive connections, drain database pools and message queues, and set a safety timeout (e.g. 10-15 seconds) to force exit with code 1 if a hanging request fails to complete.'
        },
        {
          question: 'Why can HTTP Keep-Alive connections prevent server.close() from ever completing?',
          spokenAnswer:
            'server.close() only stops listening for new connections and waits for open connections to close. Modern browsers and reverse proxies use HTTP Keep-Alive to maintain persistent TCP sockets open between requests. If an idle client socket remains connected waiting for future requests, server.close() will hang indefinitely waiting for the client to close it. In Node.js 19+, you must call server.closeIdleConnections() to actively terminate idle keep-alive sockets while preserving active transactions.'
        }
      ],
      trickyFollowUp: {
        question: 'Why should you include a brief delay (e.g. 2-5 seconds) before closing the HTTP server upon receiving SIGTERM in Kubernetes?',
        answer:
          'In Kubernetes, the pod termination signal (SIGTERM) and the removal of the pod from the Ingress / kube-proxy routing tables happen asynchronously in parallel. If you close your HTTP server instantly upon SIGTERM, the ingress controller may still forward a few requests to your pod for another 1-2 seconds, resulting in 502 Bad Gateway errors for clients.'
      },
      commonMistakes: [
        'Calling process.exit(0) immediately inside process.on("SIGTERM"), aborting active user transactions.',
        'Not setting a hard shutdown watchdog timer, causing the process to hang forever if a database query deadlocks during shutdown.',
        'Closing the database connection pool before server.close() has finished processing in-flight requests, causing in-flight queries to throw "Connection pool closed" errors.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Intercept SIGTERM/SIGINT: mark /readyz unhealthy -> server.close() -> closeIdleConnections() -> close DBs.',
        'Always set a 10-15 second watchdog timer with unref() to force exit if cleanup hangs.',
        'Never close the database pool before in-flight HTTP requests have finished executing.'
      ],
      oneLineDefinition:
        'Graceful shutdown allows active HTTP transactions and database operations to complete safely before the Node.js process terminates.',
      interviewTip:
        'Mention server.closeIdleConnections() and the Kubernetes ingress propagation delay to stand out as a staff/principal engineer.',
      keyDistinction:
        'server.close() vs process.exit(): server.close() stops accepting new requests while draining active ones; process.exit() terminates the process immediately, dropping in-flight work.'
    }
  },
  {
    id: 'express-production-configuration',
    number: 23,
    title: 'Production Configuration',
    section: 'Express.js – Backend Development',
    sectionSlug: 'express',
    category: 'Production and Application Lifecycle',
    categorySlug: 'express-production-lifecycle',
    estimatedMinutes: 5,
    concept30Sec:
      'Production configuration prepares an Express application for enterprise reliability, high performance, and observability. It encompasses 12-Factor environment variable validation, structured JSON logging with Pino, dual-stage health checks (liveness vs readiness), and setting NODE_ENV=production.',
    internals: {
      overview:
        'Setting NODE_ENV=production triggers major internal optimizations in Express: 1) View template compilation is cached in memory instead of being re-read from disk on every request; 2) CSS/JS helpers generated by middleware are cached; 3) Verbose error stack traces are suppressed from client responses. Furthermore, production logging replaces synchronous console.log (which blocks the V8 event loop under heavy load) with asynchronous structured JSON loggers like Pino, which write ndjson directly to stdout for log aggregators (Datadog, Elastic).',
      flowSteps: [
        '1. Environment Parsing: Zod or Envalid validates all process.env variables at boot; if any variable is missing, crashes immediately with clear error.',
        '2. Optimization Flag: NODE_ENV=production activates internal Express template and ETag caching.',
        '3. Structured Logging: Pino logger decorates each log line with { level, time, pid, reqId, msg } in JSON.',
        '4. Liveness Probe (/livez): Returns 200 if process event loop is responsive; K8s restarts pod if this fails.',
        '5. Readiness Probe (/readyz): Checks live connectivity to PostgreSQL, Redis, and message queues; K8s pauses traffic if this fails.',
        '6. Process Management: Run via PM2 cluster mode on bare metal or single-process containers in Kubernetes.'
      ],
      diagram: `DUAL-STAGE KUBERNETES HEALTH CHECK OBSERVABILITY:

                  +----------------------------------------------+
                  |            Express Application               |
                  +----------------------------------------------+
                               /                   \\
                              /                     \\
                             v                       v
               Liveness Probe (/livez)     Readiness Probe (/readyz)
               "Is the process running?"    "Can it handle traffic?"
                             |                       |
               Checks: Event Loop Alive     Checks: DB Pool, Redis, Kafka
                             |                       |
            +----------------+                       +----------------+
            | Failure: Pod Deadlocked                | Failure: DB Down
            | Action: K8s RESTARTS POD               | Action: K8s PAUSES TRAFFIC
            +----------------+                       +----------------+`
    },
    codeExample: {
      code: `import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { z } from 'zod';

// 1. Strict 12-Factor Environment Variable Schema Validation
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url()
});

// Crash immediately at boot if environment is misconfigured!
const env = EnvSchema.parse(process.env);

// 2. High-Performance Structured JSON Logger (Pino)
const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => ({ level: label })
  }
});

const app = express();

// Fast structured HTTP access logging
app.use(pinoHttp({ logger }));

// 3. Dual-Stage Health Check Probes
// Liveness: Is the process alive? (Lightweight, no external calls!)
app.get('/livez', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// Readiness: Can the app talk to all critical dependencies?
app.get('/readyz', async (req, res) => {
  try {
    // await db.query('SELECT 1');
    // await redis.ping();
    res.status(200).json({ status: 'ready', database: 'connected', redis: 'connected' });
  } catch (err: any) {
    logger.error('Readiness check failed!', { error: err.message });
    res.status(503).json({ status: 'unready', error: err.message });
  }
});`,
      language: 'javascript',
      output: `{"level":"info","time":1763481600000,"pid":4821,"req":{"id":1,"method":"GET","url":"/readyz"},"res":{"statusCode":200},"responseTime":1,"msg":"request completed"}`,
      whyOutput:
        'Pino outputs machine-parseable JSON lines with microsecond timestamps, process ID, request ID, and latency. The dual health check separates liveness from readiness, allowing Kubernetes to manage pod lifecycles with surgical accuracy.'
    },
    nodeJsApplication: {
      scenario: 'High-Concurrency Event Loop Protection from console.log',
      description:
        'In Node.js, console.log() is synchronous when writing to pipes or files. At 10,000 requests per second, console.log blocks the single V8 thread while waiting for OS stdout buffers to flush, causing massive latency spikes. Replacing it with Pino (using sonic-boom asynchronous worker threads) eliminates event loop blocking.',
      codeSnippet: `// Use Pino asynchronous logging for ultra-high throughput:
import pino from 'pino';
const logger = pino(pino.destination({ sync: false })); // Non-blocking async stdout!`
    },
    interviewPrep: {
      questions: [
        {
          question: 'What is the critical architectural difference between a Liveness Probe and a Readiness Probe?',
          spokenAnswer:
            'A Liveness Probe (/livez) checks whether the Node.js process is alive and responsive. If the liveness probe fails (e.g. process is deadlocked or in an infinite loop), the orchestrator (Kubernetes) forcibly kills and restarts the pod. A Readiness Probe (/readyz) checks whether the application is currently able to service user traffic—by verifying active connections to the database, Redis, and message queues. If a readiness probe fails (e.g. the database is undergoing failover), the orchestrator stops routing incoming traffic to that pod without killing it, allowing the service to recover once the database returns.'
        },
        {
          question: 'What does setting NODE_ENV=production actually do in an Express application?',
          spokenAnswer:
            'Setting NODE_ENV=production activates three key behaviors: 1) Express enables in-memory caching of view templates, preventing expensive repeated disk reads; 2) It disables verbose HTML error pages and suppresses error stack traces, preventing security leaks; and 3) It optimizes internal ETag generation. Many third-party packages also use this flag to strip development assertions, significantly reducing CPU and memory overhead.'
        }
      ],
      trickyFollowUp: {
        question: 'Why should you validate environment variables at startup using a schema validator like Zod?',
        answer:
          'Because fail-fast startup is vital in distributed systems. If an environment variable like STRIPE_SECRET or DATABASE_URL is missing or misspelled, a naive app boots successfully and runs until a user reaches the payment endpoint minutes or hours later, crashing at runtime. Validating env vars with Zod at boot causes the process to crash immediately on deployment with a clear configuration error before taking any traffic.'
      },
      commonMistakes: [
        'Using console.log for production logging, which blocks the event loop and produces unstructured text.',
        'Putting database queries inside the liveness probe (/livez), causing Kubernetes to kill and restart healthy Node.js pods during temporary DB connection spikes.',
        'Running with default development NODE_ENV in production, leaking stack traces and disabling view caches.'
      ]
    },
    quickRevision: {
      takeaways: [
        'Validate process.env at boot with Zod to enforce fail-fast configuration.',
        'Use structured JSON logging (Pino) instead of synchronous console.log.',
        'Liveness (/livez) checks if process is alive; Readiness (/readyz) checks if DB is reachable.',
        'Always set NODE_ENV=production to enable internal Express performance caching.'
      ],
      oneLineDefinition:
        'Production configuration ensures an Express service is observable, secure, and resilient through structured logging, fail-fast env validation, and dual-stage health probes.',
      interviewTip:
        'Never put database checks in /livez: explain that liveness failures trigger pod restarts, turning database blips into catastrophic cluster restart cascades.',
      keyDistinction:
        'Liveness vs Readiness: Liveness restarts deadlocked pods; Readiness stops traffic when external dependencies are temporarily down.'
    }
  }
];
