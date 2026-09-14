# Rate Limiting and Queues — Complete Guide

## Table of Contents
1. [Why Rate Limiting Matters](#1-why-rate-limiting-matters)
2. [In-Memory Rate Limiting](#2-in-memory-rate-limiting)
3. [Redis-Backed Rate Limiting](#3-redis-backed-rate-limiting)
4. [Why Background Job Queues Exist](#4-why-background-job-queues-exist)
5. [Queues with BullMQ](#5-queues-with-bullmq)
6. [When to Queue Work vs Handle It Synchronously](#6-when-to-queue-work-vs-handle-it-synchronously)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Rate Limiting Matters

Without limits, a single client (malicious or just buggy) can send unlimited requests and exhaust your server's CPU, memory, database connections, or a paid third-party API quota. Rate limiting caps how many requests a client can make in a given time window.

```
Without rate limiting:
  Client sends 10,000 requests/sec ──▶ server falls over, affects ALL users

With rate limiting (100 req/min per IP):
  Client sends 10,000 requests/sec ──▶ first 100 succeed, rest get 429 Too Many Requests
  Server stays healthy for everyone else
```

Common use cases: protecting login endpoints from brute-force attempts, protecting public APIs from abuse, and staying under a third-party API's own rate limit when you call it.

## 2. In-Memory Rate Limiting

The simplest approach — track request counts in a plain JavaScript object or Map, keyed by IP (or user ID).

```javascript
// simple in-memory limiter (single process only)
const requestCounts = new Map(); // key -> { count, windowStart }

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;

function rateLimiter(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    requestCounts.set(key, { count: 1, windowStart: now });
    return next();
  }

  if (entry.count >= MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests, try again later' });
  }

  entry.count++;
  next();
}

app.use(rateLimiter);
```

In practice, use the battle-tested `express-rate-limit` package instead of hand-rolling this:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, try again later' },
  standardHeaders: true, // adds RateLimit-* headers
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

**The catch:** in-memory limits are per-process. If you run your app across multiple Node processes or servers (see Phase-10 Lesson 01, Clustering), each process has its own independent counter — a client could get 100 requests per worker, not 100 total.

## 3. Redis-Backed Rate Limiting

To enforce a single shared limit across multiple processes/servers, the counter must live somewhere shared — Redis is the standard choice, since it's already fast enough to check on every request.

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Worker 1 │     │ Worker 2 │     │ Worker 3 │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     └────────────────┼────────────────┘
                       ▼
                 ┌───────────┐
                 │   Redis   │  ← single shared counter per client
                 └───────────┘
```

```javascript
const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('ioredis');

const redisClient = new Redis();

const limiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl',
  points: 100,       // 100 requests
  duration: 60,      // per 60 seconds
});

async function rateLimitMiddleware(req, res, next) {
  try {
    await limiter.consume(req.ip); // throws if limit exceeded
    next();
  } catch {
    res.status(429).json({ error: 'Too many requests, try again later' });
  }
}

app.use(rateLimitMiddleware);
```

A simpler manual approach using Redis's atomic `INCR` + `EXPIRE`:

```javascript
async function redisRateLimit(req, res, next) {
  const key = `ratelimit:${req.ip}`;
  const count = await redisClient.incr(key);

  if (count === 1) {
    await redisClient.expire(key, 60); // set TTL only on the first request in the window
  }

  if (count > 100) {
    return res.status(429).json({ error: 'Too many requests, try again later' });
  }

  next();
}
```

## 4. Why Background Job Queues Exist

Some work is too slow to do inside a request/response cycle: sending a batch of emails, resizing an uploaded image, generating a PDF report, processing a video. Doing this synchronously blocks the event loop (or ties up a request for many seconds) and risks the client timing out.

A **job queue** decouples "accept the work" from "do the work": the API route just pushes a job description onto a queue and immediately responds, while a separate **worker process** consumes jobs from the queue and does the actual work whenever it can.

```
Without a queue:
  POST /reports  ──▶  generate PDF (8 seconds) ──▶  respond
  Client waits 8 seconds, connection may time out

With a queue:
  POST /reports  ──▶  push job to queue ──▶  respond immediately (202 Accepted)
                              │
                              ▼
                     ┌──────────────────┐
                     │  Worker process   │  picks up job whenever free,
                     │  generates PDF    │  generates it, notifies user when done
                     └──────────────────┘
```

## 5. Queues with BullMQ

BullMQ is the standard Node.js job queue library, built on top of Redis.

```bash
npm install bullmq ioredis
```

```javascript
// queue.js — defines the queue, used by whoever adds jobs
const { Queue } = require('bullmq');

const connection = { host: '127.0.0.1', port: 6379 };

const emailQueue = new Queue('emails', { connection });

module.exports = emailQueue;
```

```javascript
// routes/notify.js — API route just enqueues, doesn't do the work itself
const express = require('express');
const router = express.Router();
const emailQueue = require('../queue');

router.post('/notify', async (req, res) => {
  const { userId, message } = req.body;

  await emailQueue.add('send-email', { userId, message }, {
    attempts: 3,                       // retry up to 3 times on failure
    backoff: { type: 'exponential', delay: 1000 },
  });

  res.status(202).json({ status: 'queued' }); // 202 Accepted — work isn't done yet
});

module.exports = router;
```

```javascript
// worker.js — a SEPARATE process, run with `node worker.js`
const { Worker } = require('bullmq');

const connection = { host: '127.0.0.1', port: 6379 };

const worker = new Worker('emails', async (job) => {
  const { userId, message } = job.data;
  console.log(`Sending email to user ${userId}: ${message}`);
  await sendEmail(userId, message); // the actual slow work happens here
}, { connection });

worker.on('completed', (job) => console.log(`Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`Job ${job.id} failed:`, err.message));
```

The API process and the worker process are independent — you can scale them separately (e.g. run 1 API instance and 5 worker instances if you have a backlog of slow jobs).

## 6. When to Queue Work vs Handle It Synchronously

| Handle synchronously (in the request) | Offload to a queue |
|---|---|
| Fast (< ~200ms), the client needs the result immediately | Slow (seconds+), or the client doesn't need to wait for it |
| Simple DB read/write for the current request | Sending emails/SMS notifications |
| Must succeed before responding (e.g. validating and saving an order) | Generating reports/PDFs, resizing images/video |
| Low volume, low risk of overload | High volume bursts that would overwhelm a synchronous handler |
| No need for automatic retries | Work that should retry automatically on transient failure (calling a flaky third-party API) |

Rule of thumb: if the client doesn't need the result of the work before you can tell them "request received," put it in a queue.

---

## 7. Hands-On Exercises

**Exercise 1:** Install `express-rate-limit` and apply it to a simple Express route. Confirm that after exceeding the limit, subsequent requests return a `429` status.

**Exercise 2:** Rewrite the in-memory rate limiter from Section 2 to use Redis's `INCR`/`EXPIRE` (Section 3). Run two separate Node processes on different ports both using the same Redis instance, and confirm the limit is now shared across both.

**Exercise 3:** Install BullMQ and Redis. Create a queue, an API route that adds a job to it, and a separate worker script that processes jobs and logs when each completes.

**Exercise 4:** Make a job in your worker intentionally throw an error on the first two attempts (e.g. using a counter) and succeed on the third. Configure `attempts: 3` with backoff and confirm BullMQ retries automatically before marking it completed.

**Exercise 5:** Add a `/report` endpoint that enqueues a "generate report" job and immediately returns `202 Accepted` with a job ID. Add a `/report/:jobId/status` endpoint that checks the job's status (`getJob` + `job.getState()`) so a client can poll for completion.

---

## 8. Interview Q&A

**Q: Why is in-memory rate limiting insufficient in a clustered/multi-server Node app?**
Answer: In-memory rate limiting stores counters in a single process's memory. If the app runs as multiple worker processes (via the `cluster` module) or across multiple servers behind a load balancer, each process has its own independent counter — a client could effectively get `limit × number of processes` requests instead of the intended shared limit. A Redis-backed limiter centralizes the counter so all processes/servers enforce the same limit.

**Q: How would you implement a Redis-backed rate limiter using basic Redis commands?**
Answer: Use `INCR` on a key derived from the client identifier (e.g. their IP) to atomically increment a counter, and call `EXPIRE` on that key (only when the counter is first created, i.e. when `INCR` returns 1) to set the time window. If the counter exceeds the allowed limit before the key expires, reject the request with a `429` status. `INCR` is atomic in Redis, so concurrent requests from the same client can't race past the limit.

**Q: What problem do background job queues solve?**
Answer: They decouple accepting a unit of work from actually performing it, which matters when the work is too slow to do inside a request/response cycle (sending emails, generating PDFs, processing video). The API can respond immediately (e.g. `202 Accepted`) after enqueuing the job, while a separate worker process consumes and processes jobs from the queue independently — this keeps request latency low and lets you scale the workers independently from the API.

**Q: How does BullMQ handle job failures?**
Answer: BullMQ supports configuring `attempts` (how many times to retry a failed job) and a `backoff` strategy (e.g. exponential backoff, waiting longer between each retry). If a job's handler throws an error, BullMQ automatically re-queues it for another attempt until either it succeeds or the attempt limit is exhausted, at which point it's marked failed and an event is emitted so you can alert or log it.

**Q: When would you choose to handle work synchronously vs push it to a queue?**
Answer: Handle it synchronously when it's fast, the client needs the result immediately to proceed (e.g. validating and confirming an order was saved), and the volume is low enough not to risk overloading the server. Push it to a queue when the work is slow (seconds or more), the client doesn't need to wait for the result, it should retry automatically on transient failure, or sudden traffic bursts could otherwise overwhelm a synchronous handler — offloading it lets the API stay responsive while workers absorb the load at their own pace.
