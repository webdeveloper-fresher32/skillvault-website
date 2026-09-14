# Caching with Redis — Complete Guide

## Table of Contents
1. [Why Caching Matters](#1-why-caching-matters)
2. [What is Redis?](#2-what-is-redis)
3. [Connecting to Redis from Node](#3-connecting-to-redis-from-node)
4. [The Cache-Aside Pattern](#4-the-cache-aside-pattern)
5. [TTL — Time To Live](#5-ttl--time-to-live)
6. [Complete Example: Caching a Database Query](#6-complete-example-caching-a-database-query)
7. [Cache Invalidation](#7-cache-invalidation)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Why Caching Matters

Every database query costs time — a network round trip, disk I/O, query planning, joins. If the same data is requested repeatedly (a product page viewed thousands of times, a user profile fetched on every request), recomputing/re-querying it every single time wastes resources on work you've already done.

```
Without caching:
  Request 1 ──▶ query DB (80ms) ──▶ response
  Request 2 ──▶ query DB (80ms) ──▶ response   (same data as Request 1!)
  Request 3 ──▶ query DB (80ms) ──▶ response   (same data again!)
  ...
  1000 requests = 1000 identical DB queries = 80,000ms of DB work

With caching:
  Request 1 ──▶ query DB (80ms) ──▶ store in cache ──▶ response
  Request 2 ──▶ read from cache (1ms) ──▶ response
  Request 3 ──▶ read from cache (1ms) ──▶ response
  ...
  1000 requests = 1 DB query + 999 cache reads ≈ 1,079ms total
```

Caching trades a small amount of staleness risk for a large reduction in load on your database and a large improvement in response time. It's one of the highest-leverage changes you can make to a slow API.

## 2. What is Redis?

Redis is an in-memory key-value data store. Because data lives in RAM (not on disk), reads and writes are extremely fast — sub-millisecond typically. It's commonly used as:

- A **cache** in front of a slower primary database (its most common use).
- A **session store** for web apps.
- A backing store for **rate limiters** and **job queues** (see Lesson 05).
- A **pub/sub** message broker.

```
┌─────────────┐       fast (RAM, ~1ms)      ┌─────────────┐
│  Node App   │ ◀─────────────────────────▶ │    Redis    │
└─────────────┘                             └─────────────┘
       │
       │      slow (disk, ~50-200ms)
       ▼
┌─────────────┐
│  PostgreSQL │
│  / MongoDB  │
└─────────────┘

Strategy: check Redis first. Only hit the slow DB on a cache miss.
```

Redis stores values as strings by default (though it supports richer types — hashes, lists, sets, sorted sets). For caching structured data like a database row, you typically `JSON.stringify` it before storing and `JSON.parse` it after reading.

## 3. Connecting to Redis from Node

The most widely used Redis client for Node is `ioredis` (an alternative is the official `redis` package — both work similarly for basic use).

```bash
npm install ioredis
```

```javascript
// redisClient.js
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  // password: process.env.REDIS_PASSWORD, // if auth is enabled
});

redis.on('connect', () => console.log('Connected to Redis'));
redis.on('error', (err) => console.error('Redis error:', err));

module.exports = redis;
```

Basic operations:

```javascript
const redis = require('./redisClient');

// SET / GET
await redis.set('greeting', 'hello world');
const value = await redis.get('greeting'); // 'hello world'

// SET with expiry (TTL) in seconds
await redis.set('session:abc123', 'user-data', 'EX', 3600); // expires in 1 hour

// DELETE
await redis.del('greeting');

// Check existence
const exists = await redis.exists('greeting'); // 0 or 1

// Storing structured data — must serialize
await redis.set('user:42', JSON.stringify({ id: 42, name: 'Ada' }));
const raw = await redis.get('user:42');
const user = JSON.parse(raw);
```

## 4. The Cache-Aside Pattern

Cache-aside (a.k.a. "lazy loading") is the most common caching strategy: the application code is responsible for checking the cache first, and populating it on a miss. Redis itself doesn't know anything about your database — your code is the glue.

```
                    ┌─────────────────────────────────┐
                    │        Incoming request          │
                    └────────────────┬─────────────────┘
                                     ▼
                        ┌────────────────────────┐
                        │  1. Check Redis cache   │
                        └───────────┬────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     ▼ HIT                          ▼ MISS
          ┌─────────────────────┐      ┌─────────────────────────┐
          │ Return cached value  │      │ 2. Query the database    │
          │ (fast — no DB hit)   │      │ 3. Store result in cache │
          └─────────────────────┘      │    (with a TTL)          │
                                        │ 4. Return the result     │
                                        └─────────────────────────┘
```

```javascript
async function getCacheAside(key, ttlSeconds, fetchFromSource) {
  const cached = await redis.get(key);
  if (cached !== null) {
    return JSON.parse(cached); // cache hit
  }

  const fresh = await fetchFromSource(); // cache miss — go to the source of truth
  await redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
  return fresh;
}
```

## 5. TTL — Time To Live

A TTL is how long a cached value stays valid before Redis automatically deletes it. Without a TTL, cached data lives forever and can drift arbitrarily far from the real, current data in your database (**stale cache**).

```javascript
// Set with a TTL of 300 seconds (5 minutes)
await redis.set('product:101', JSON.stringify(product), 'EX', 300);

// Check remaining TTL
const secondsLeft = await redis.ttl('product:101'); // e.g. 287, or -2 if expired/missing
```

Choosing a TTL is a tradeoff:

| Short TTL (e.g. 30s) | Long TTL (e.g. 1 hour) |
|---|---|
| Data is fresher | Data can be more stale |
| More cache misses → more DB load | Fewer cache misses → less DB load |
| Good for frequently-changing data | Good for rarely-changing data (product catalog, config) |

There's no universal correct value — it depends on how often the underlying data changes and how tolerant your users are of slightly stale reads.

## 6. Complete Example: Caching a Database Query

A realistic Express + PostgreSQL-style example (the same pattern works with any database client — MongoDB, MySQL, etc.):

```javascript
// productService.js
const redis = require('./redisClient');
const db = require('./db'); // your DB client, e.g. pg Pool

const CACHE_TTL_SECONDS = 300; // 5 minutes

async function getProductById(id) {
  const cacheKey = `product:${id}`;

  // 1. Try the cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log(`Cache HIT for ${cacheKey}`);
    return JSON.parse(cached);
  }

  console.log(`Cache MISS for ${cacheKey} — querying database`);

  // 2. Cache miss — query the real database
  const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);
  const product = result.rows[0];

  if (!product) return null; // don't cache "not found" the same way as a real value

  // 3. Populate the cache for next time, with a TTL
  await redis.set(cacheKey, JSON.stringify(product), 'EX', CACHE_TTL_SECONDS);

  return product;
}

module.exports = { getProductById };
```

```javascript
// routes/products.js
const express = require('express');
const router = express.Router();
const { getProductById } = require('../productService');

router.get('/products/:id', async (req, res, next) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

```
First request for GET /products/101:
  Cache MISS for product:101 — querying database    (~80ms)
  → response sent, cache now populated

Second request for GET /products/101 (within 5 minutes):
  Cache HIT for product:101                          (~1ms)
  → response sent straight from Redis, DB untouched
```

## 7. Cache Invalidation

"There are only two hard things in computer science: cache invalidation and naming things." When the underlying data changes (e.g. a product is updated), a stale cache entry will keep serving the old value until its TTL expires — unless you explicitly invalidate it.

```javascript
async function updateProduct(id, updates) {
  // 1. Update the source of truth
  await db.query('UPDATE products SET name = $1, price = $2 WHERE id = $3',
    [updates.name, updates.price, id]);

  // 2. Invalidate (delete) the stale cache entry — next read will re-populate it
  await redis.del(`product:${id}`);
}
```

Two common invalidation strategies:

| Strategy | How it works | Tradeoff |
|---|---|---|
| **Delete on write** (shown above) | On update/delete, remove the cache key immediately | Next read is a cache miss (slower once), but always correct after a write |
| **TTL-only (no explicit invalidation)** | Just let the short TTL expire naturally | Simpler code, but data can be stale for up to the TTL duration after a write |

For most applications, combining both — a reasonable TTL as a safety net, plus explicit deletion on writes — gives the best balance of freshness and simplicity.

## 8. Common Pitfalls

```
Pitfall 1: Caching without a TTL
  → cached data never expires, drifts from reality forever
  → always set an expiry unless you have an explicit invalidation strategy

Pitfall 2: Caching errors or "not found" results the same as real data
  → a transient DB error gets cached and served to every user for the TTL duration
  → only cache successful, meaningful results

Pitfall 3: Cache stampede
  → a popular key expires, and 1000 concurrent requests all miss at once,
    all hammering the database simultaneously to repopulate it
  → mitigate with request coalescing or slightly randomized TTLs ("jitter")

Pitfall 4: Forgetting to serialize/deserialize
  → Redis stores strings; storing an object directly without JSON.stringify
    will store "[object Object]" — always stringify on write, parse on read
```

---

## 9. Hands-On Exercises

**Exercise 1:** Install Redis locally (or run `docker run -d -p 6379:6379 redis`) and connect to it from Node using `ioredis`. Confirm you can `SET` and `GET` a value.

**Exercise 2:** Build the `getProductById` cache-aside function from Section 6 against a real or mocked database function. Log timestamps around the DB call and confirm the second call for the same ID skips the database entirely.

**Exercise 3:** Set a TTL of 5 seconds on a cached key. Wait 6 seconds, then read it again — confirm it's a cache miss (the key has expired) and gets repopulated.

**Exercise 4:** Implement `updateProduct` with cache invalidation (Section 7). Fetch a product (populating the cache), update it, then fetch it again immediately — confirm you get the *updated* value, not a stale cached one.

**Exercise 5:** Simulate a cache stampede: remove a key, then fire 20 concurrent requests for it at once (`Promise.all`). Log how many times the "database" function actually runs. Then modify the code to coalesce concurrent misses for the same key into a single in-flight database request (hint: track in-flight promises per key in a `Map`).

---

## 10. Interview Q&A

**Q: What problem does caching solve, and why use Redis specifically?**
Answer: Caching avoids repeating expensive work — most commonly, database queries — by storing the result of a computation and serving it directly on subsequent requests for the same data. Redis is a popular choice because it's an in-memory store (sub-millisecond reads/writes), supports TTLs natively so cached data can expire automatically, and is battle-tested at scale as a caching layer independent of your primary database's own caching.

**Q: Explain the cache-aside pattern.**
Answer: In cache-aside, the application checks the cache first on a read. On a cache hit, it returns the cached value directly. On a cache miss, it queries the actual data source (the database), stores the result in the cache with a TTL, and returns it. The cache is "lazy" — it's only populated as data is actually requested, not pre-warmed. This is the most common caching pattern because it's simple and only caches data that's actually being used.

**Q: Why does a cached value need a TTL?**
Answer: Without a TTL, a cached value lives forever until explicitly deleted, meaning it can silently drift out of sync with the real data in the database if something updates it and the cache isn't explicitly invalidated. A TTL bounds how stale data can get — even if you forget to invalidate on a write, the cache will self-correct once the TTL expires. Choosing the TTL length is a tradeoff between freshness (shorter TTL) and reduced database load (longer TTL).

**Q: How do you keep a cache from serving stale data after an update?**
Answer: The main approach is explicit invalidation — when you update or delete the underlying data, immediately delete (or update) the corresponding cache key so the next read is forced to go back to the database and repopulate the cache with fresh data. This is usually combined with a reasonable TTL as a safety net in case an invalidation is ever missed.

**Q: What is a cache stampede and how would you prevent one?**
Answer: A cache stampede happens when a popular cache key expires and many concurrent requests all miss at the same instant, causing all of them to hit the database simultaneously to repopulate the same key — briefly spiking database load as if the cache weren't there at all. Common mitigations include request coalescing (tracking in-flight database calls per key so concurrent misses share one database request instead of firing many), adding random jitter to TTLs so many keys don't expire at the exact same moment, or using a "stale-while-revalidate" approach that serves the slightly-stale value while one request refreshes it in the background.

**Q: What's the difference between caching "not found" results and caching real data?**
Answer: If a lookup for a nonexistent ID returns null/not-found and you cache that result identically to a real value, you risk caching transient failures (e.g. a temporary database blip) or masking the fact that the record simply doesn't exist yet but might later. Generally you either skip caching "not found" results entirely so every request re-checks the source, or cache them explicitly with a very short TTL and a distinct marker — never treat an absence-of-data response the same as a successful cache-worthy result without deliberate thought.
