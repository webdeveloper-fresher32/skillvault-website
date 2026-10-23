# Logging and Monitoring — Complete Guide

## Table of Contents
1. [Why console.log Isn't Enough](#1-why-consolelog-isnt-enough)
2. [Structured Logging](#2-structured-logging)
3. [Log Levels](#3-log-levels)
4. [Correlation IDs for Request Tracing](#4-correlation-ids-for-request-tracing)
5. [Health-Check Endpoints](#5-health-check-endpoints)
6. [APM (Application Performance Monitoring)](#6-apm-application-performance-monitoring)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why console.log Isn't Enough

```javascript
console.log('User logged in', userId);
// Output: User logged in 64f2a1...
```

Problems at production scale:
- No severity — you can't filter "just errors" from a firehose of logs.
- Not machine-parseable — a log aggregator (Datadog, ELK, CloudWatch) has to guess the structure.
- No context — which request? which user? which trace across microservices?
- No timestamps/metadata by default.

**Structured logging** fixes this by emitting logs as JSON objects with consistent fields.

---

## 2. Structured Logging

The two most common structured loggers in the Node ecosystem are **winston** and **pino**. Both emit JSON logs with levels, timestamps, and arbitrary metadata.

### Concept: winston

```javascript
// logger.js (winston)
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'user-api' },
  transports: [
    new winston.transports.Console(),
    // In production you'd typically also ship to a file or log aggregator:
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

module.exports = logger;
```

```javascript
// usage
const logger = require('./logger');

logger.info('User logged in', { userId: '64f2a1', ip: req.ip });
logger.warn('Rate limit approaching', { userId: '64f2a1', requestCount: 95 });
logger.error('Payment failed', { orderId: 'ord_123', error: err.message });
```

Output (JSON, one line per log — easy for log aggregators to parse):

```json
{"level":"info","message":"User logged in","service":"user-api","userId":"64f2a1","ip":"203.0.113.5","timestamp":"2026-07-02T09:15:32.104Z"}
```

### Concept: pino

`pino` is a newer, higher-performance alternative with a similar API and near-identical JSON output shape:

```javascript
// logger.js (pino)
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'user-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
```

```javascript
logger.info({ userId: '64f2a1', ip: req.ip }, 'User logged in');
logger.error({ orderId: 'ord_123', err }, 'Payment failed');
```

Both libraries integrate with Express via middleware (`express-winston`, `pino-http`) to auto-log every incoming request/response with method, path, status code, and duration.

```javascript
// pino-http example
const pinoHttp = require('pino-http');
app.use(pinoHttp({ logger }));
```

### Redacting Secrets

Never log passwords, tokens, or full credit card numbers. Both loggers support redaction:

```javascript
// pino redaction example
const logger = pino({
  redact: ['req.headers.authorization', 'password', '*.creditCard'],
});
```

---

## 3. Log Levels

Standard severity levels, from least to most severe (pino/winston share this convention, borrowed from syslog):

| Level | When to use |
|-------|-------------|
| `trace` | Extremely fine-grained detail, rarely enabled outside deep debugging |
| `debug` | Diagnostic detail useful in development (variable values, flow decisions) |
| `info` | Normal operational events (server started, user logged in, order placed) |
| `warn` | Something unexpected but not yet broken (deprecated API used, retrying a request) |
| `error` | An operation failed (request errored, DB write failed) but the app keeps running |
| `fatal` | The app cannot continue and is about to crash/exit |

```javascript
// Setting level via env var controls verbosity per environment
// LOG_LEVEL=debug in dev, LOG_LEVEL=info in production
const logger = winston.createLogger({ level: process.env.LOG_LEVEL || 'info' });

logger.debug('Cache miss for key', { key: 'user:64f2a1' }); // hidden in prod (level=info)
logger.info('Order created', { orderId: 'ord_456' });       // shown
logger.error('DB connection lost', { err });                 // shown
```

Setting `LOG_LEVEL=info` in production suppresses `debug`/`trace` noise while still capturing everything operationally relevant — reducing both log volume/cost and signal-to-noise ratio when debugging incidents.

---

## 4. Correlation IDs for Request Tracing

In a system with multiple services (or even just many concurrent requests to one service), a **correlation ID** (a.k.a. request ID or trace ID) tags every log line generated while handling a single request — so you can grep all logs for one request across services.

```javascript
// middleware/correlationId.js
const { randomUUID } = require('crypto');

function correlationIdMiddleware(req, res, next) {
  // Reuse an incoming ID if a client/upstream service already set one
  req.correlationId = req.headers['x-correlation-id'] || randomUUID();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
}

module.exports = correlationIdMiddleware;
```

```javascript
// server.js
app.use(correlationIdMiddleware);

app.use((req, res, next) => {
  // Attach a child logger so every log from this request carries the ID automatically
  req.log = logger.child({ correlationId: req.correlationId });
  next();
});

app.get('/orders/:id', (req, res) => {
  req.log.info('Fetching order', { orderId: req.params.id });
  // ... every log call using req.log includes correlationId automatically
});
```

Output — every line from this request shares the same ID:

```json
{"level":"info","message":"Fetching order","correlationId":"a1b2c3","orderId":"789"}
{"level":"info","message":"Order fetched from DB","correlationId":"a1b2c3","durationMs":12}
{"level":"info","message":"Response sent","correlationId":"a1b2c3","status":200}
```

If this request calls a downstream microservice, forward the same header (`x-correlation-id`) so its logs are correlatable too — this is the basis of distributed tracing across a microservices architecture (see `../../NodeJS/Phase-11-Realtime-and-Microservices/` for microservices communication patterns in this course).

---

## 5. Health-Check Endpoints

Orchestrators (Kubernetes) and load balancers need a cheap endpoint to ask "is this instance healthy?"

```javascript
// routes/health.js
const express = require('express');
const router = express.Router();

// Liveness: is the process itself alive? Keep this extremely cheap/fast.
router.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness: can this instance actually serve traffic right now?
// (DB connected, cache reachable, etc.) — used to gate traffic routing.
router.get('/health/ready', async (req, res) => {
  try {
    await db.ping();       // check DB connectivity
    await redisClient.ping(); // check cache connectivity
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'unavailable', error: err.message });
  }
});

module.exports = router;
```

```javascript
// server.js
app.use('/', require('./routes/health'));
```

The **liveness vs readiness** distinction matters in Kubernetes:
- **Liveness probe** failing → Kubernetes restarts the pod (it thinks the process is stuck/dead).
- **Readiness probe** failing → Kubernetes stops routing traffic to the pod but does NOT restart it (e.g., temporarily can't reach the DB — no point restarting, just wait).

See `../../Kubernetes/` for the full probe configuration (`livenessProbe`/`readinessProbe` in a pod spec) — this file only covers the Node-side endpoint implementation.

---

## 6. APM (Application Performance Monitoring)

Logs tell you *what happened*; an **APM tool** tells you *where time is going* — request latency breakdowns, slow DB queries, error rates, throughput, and distributed traces across services — usually visualized in a dashboard with alerting.

Common APM tools for Node: Datadog APM, New Relic, Elastic APM, and OpenTelemetry (a vendor-neutral standard many of the above now support).

Conceptually, an APM agent is initialized before anything else in the app and auto-instruments HTTP, DB drivers, etc.:

```javascript
// server.js — APM agent init MUST be the very first thing that runs
require('apm-agent-vendor-sdk').start({
  serviceName: 'user-api',
  environment: process.env.NODE_ENV,
});

// ...rest of the app (Express setup, routes) follows
const express = require('express');
```

What APM typically gives you beyond structured logs:
- Automatic latency percentiles (p50/p95/p99) per endpoint.
- Flame-graph-style traces showing time spent in DB calls vs application code vs external API calls.
- Error rate dashboards and alerting thresholds ("page on-call if error rate > 5% for 5 min").
- Distributed traces that stitch together correlation IDs across multiple services automatically.

Logging, health checks, and APM are complementary, not redundant: logs answer "what happened," health checks answer "is it up right now," APM answers "why is it slow/where is it failing at scale."

---

## 7. Hands-On Exercises

**Exercise 1:** Add `winston` (or `pino`) to an Express app, replace all `console.log` calls with `logger.info`/`logger.error`, and confirm output is valid JSON per line.

**Exercise 2:** Set `LOG_LEVEL=debug` and add several `logger.debug()` calls. Confirm they appear. Change to `LOG_LEVEL=info` and confirm they're suppressed without touching the code.

**Exercise 3:** Implement the correlation ID middleware above. Make two concurrent requests to the same endpoint and verify (by grepping logs) that each request's log lines share one ID and don't mix with the other request's ID.

**Exercise 4:** Add `/health/live` and `/health/ready` endpoints. Make `/health/ready` actually check a real dependency (e.g., ping your DB connection) and return 503 when you deliberately disconnect it.

**Exercise 5:** Add redaction for at least one sensitive field (e.g., `password` or `authorization` header) to your logger config, then confirm a log call including that field shows `[REDACTED]` (or equivalent) instead of the real value in the output.

---

## 8. Interview Q&A

**Q: Why is structured (JSON) logging preferred over `console.log` in production?**
Answer: Structured logs are machine-parseable, letting log aggregators (ELK, Datadog, CloudWatch) index and query fields like level, timestamp, and custom metadata directly, instead of parsing free-text strings with regex. They also carry consistent severity levels for filtering, and support attaching contextual metadata (user ID, request ID) to every log line uniformly.

**Q: What are log levels and how would you use them in production vs development?**
Answer: Log levels (trace, debug, info, warn, error, fatal) rank severity. In development, `LOG_LEVEL=debug` surfaces verbose diagnostic detail. In production, `LOG_LEVEL=info` (or higher) suppresses debug/trace noise, keeping log volume and cost manageable while still capturing all operationally relevant events and errors — the level can be changed via environment variable without code changes.

**Q: What is a correlation ID and why is it important for debugging?**
Answer: A correlation ID is a unique identifier generated (or forwarded from an upstream caller) at the start of a request and attached to every log line produced while handling that request, including calls to downstream services. It lets you grep/query all logs related to one specific request across a distributed system, which is essential for debugging issues that span multiple services or overlapping concurrent requests.

**Q: What's the difference between a liveness probe and a readiness probe, and why does it matter for a health-check endpoint's design?**
Answer: A liveness check answers "is the process alive/responsive" — failing it causes an orchestrator like Kubernetes to restart the pod. A readiness check answers "can this instance currently serve traffic" (e.g., DB/cache connections are up) — failing it removes the pod from load-balancer rotation without restarting it. Conflating them (e.g., failing liveness because of a temporary DB blip) causes unnecessary restarts instead of the correct behavior of just pausing traffic.

**Q: What does an APM tool provide that structured logging alone doesn't?**
Answer: APM adds automatic latency percentiles (p50/p95/p99) per endpoint, distributed tracing that stitches requests across multiple services, flame-graph-style breakdowns of where time is spent (DB vs application code vs external calls), and dashboards/alerting on error rates and throughput — giving performance and cross-service visibility that individual JSON log lines don't provide on their own.

**Q: How would you prevent sensitive data from leaking into logs?**
Answer: Configure the logger's redaction feature (both winston and pino support it) to mask specific fields — like `password`, `authorization` headers, or credit card numbers — before they're serialized to output. It's also good practice to log identifiers (user ID, order ID) rather than full payloads, and to review logging statements in code review specifically for accidental inclusion of secrets or PII.
