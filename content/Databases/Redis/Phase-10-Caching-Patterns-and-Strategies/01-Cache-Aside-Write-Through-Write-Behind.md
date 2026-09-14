# 01 — Cache-Aside, Write-Through, and Write-Behind

> A comprehensive reference covering the three fundamental patterns for wiring Redis in front of a slower database — cache-aside, write-through, and write-behind — and the consistency/performance tradeoffs each one makes.

---

## Table of Contents

1. [The Problem: Wiring a Cache to a Database](#1-the-problem-wiring-a-cache-to-a-database)
2. [The Analogy: Three Students and Their Notes](#2-the-analogy-three-students-and-their-notes)
3. [Cache-Aside (Lazy Loading)](#3-cache-aside-lazy-loading)
4. [Write-Through](#4-write-through)
5. [Write-Behind (Write-Back)](#5-write-behind-write-back)
6. [Comparing the Three Strategies](#6-comparing-the-three-strategies)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Wiring a Cache to a Database

Putting Redis "in front of" a slower database is, by a wide margin, the single most common real-world use of Redis. But saying "put a cache in front of the database" glosses over a genuinely important decision: **who talks to whom, and in what order, on both the read path and the write path?**

Every one of these questions has more than one reasonable answer:

- When a request needs data, does it check Redis first, or does something else populate Redis proactively?
- When data changes, does the write go to the database first? The cache first? Both at once? Neither, immediately?
- If the cache and the database briefly disagree, how long can that be true, and does it matter for this particular piece of data?

Get this wiring wrong and you get real production bugs: users seeing a stale price after checkout, a "read your own write" bug where you update your profile and then immediately see the old version, or a cache that adds latency instead of removing it because every write has to touch two systems synchronously. There is no single "correct" wiring — there are three well-established patterns, each trading consistency, complexity, and performance differently. Picking the right one for a given piece of data is the actual skill.

---

## 2. The Analogy: Three Students and Their Notes

**Real-world analogy:** imagine three students, each keeping their own personal notes as a faster reference than walking up to ask the teacher (the "source of truth") every time.

- **The cache-aside student** only checks their notes when they need an answer. If their notes don't have it, *then* they ask the teacher, get the answer, and write it into their notes for next time. Their notes only ever get updated as a side effect of needing to look something up.
- **The write-through student** takes a different approach to keeping notes current: the instant they learn something new from the teacher, they immediately update their own notes too — writing to both places, right away, every time.
- **The write-behind student** updates their own notes the moment they learn something, but doesn't rush to tell the teacher. They jot it down now and report the batch of changes to the teacher later, in one go.

**The teacher is your database. Each student's personal notes are Redis.** Cache-aside populates the cache reactively, on a miss. Write-through keeps the cache and the database in lockstep on every write. Write-behind prioritizes fast writes to the cache and defers — and batches — the trip back to the database.

---

## 3. Cache-Aside (Lazy Loading)

**Internal flow:** cache-aside (also called lazy loading) is the pattern most people mean by default when they say "we cache database reads." The application, not Redis itself, is responsible for the logic:

1. On a read, check Redis for the key.
2. **Cache hit:** return the cached value directly — no database involved at all.
3. **Cache miss:** read from the database, then write the result into Redis (usually with a TTL) before returning it.
4. On a write, the application writes to the database and — commonly — deletes (or updates) the corresponding cache key so the next read repopulates it fresh.

The defining trait: Redis is only ever populated as a *side effect of a read miss* (or explicitly invalidated on write) — never proactively kept in sync with every database write the way write-through does.

**Code example** — a Python function implementing cache-aside with `redis-py`:

```python
import redis
import json
import time

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

def slow_db_fetch(user_id: str) -> dict:
    """Simulates a slow database read — e.g. a 200ms query."""
    time.sleep(0.2)
    return {"user_id": user_id, "name": "Alice", "plan": "pro"}

def get_user(user_id: str) -> dict:
    cache_key = f"user:{user_id}"

    cached = r.get(cache_key)          # None on a miss, a JSON string on a hit
    if cached is not None:
        return json.loads(cached)      # cache hit — no database call at all

    # cache miss — fall through to the slow source of truth
    user = slow_db_fetch(user_id)
    r.set(cache_key, json.dumps(user), ex=300)   # populate cache, 5-minute TTL
    return user
```

`r.get(cache_key)` returns `None` (Python's null value) when the key doesn't exist in Redis, which is exactly what tells this function to fall through to `slow_db_fetch`. `ex=300` sets a 300-second (5-minute) time-to-live on the key via `SET key value EX 300` under the hood, so a stale value can't live forever even if nothing ever explicitly deletes it.

**Common mistakes:**
- Forgetting to set a TTL at all — a cache-aside entry with no expiration and no explicit invalidation logic can serve a value that's years out of date after the underlying database changes.
- Deleting the cache key on write but doing it *after* a slow database write completes, creating a window where a concurrent read could repopulate the cache with the stale pre-write value.

---

## 4. Write-Through

**Internal flow:** write-through keeps the cache and the database synchronized on every single write, not just reactively on read misses. When the application performs a write, it writes to the cache **and** the database together, synchronously, as part of the same operation — typically writing to the database first (or the cache first, depending on which failure mode you'd rather tolerate) and only considering the write "done" once both have succeeded.

The practical effect: reads almost never miss the cache for data that's been written through this path, because the cache is kept current the moment the data changes — there's no "first reader after a write" penalty like there can be with cache-aside repopulating from scratch.

```
Application write
      │
      ├──▶ write to cache (Redis)
      │
      └──▶ write to database
             (both must succeed before the write is considered complete)
```

The tradeoff is latency and complexity on the write path: every write now waits on two systems instead of one, and the application has to decide how to handle the case where one write succeeds and the other fails.

**Common mistakes:**
- Treating write-through as automatically consistent when one of the two writes can still fail independently — without care (e.g. wrapping both writes in retry logic or accepting a documented failure mode), you can end up with the cache and database disagreeing anyway.
- Using write-through for data that's written far more often than it's read — you pay the synchronous double-write cost on every write, for a cache entry that may never even be read before it's overwritten again.

---

## 5. Write-Behind (Write-Back)

**Internal flow:** write-behind (also called write-back) optimizes for fast writes by only writing to the cache synchronously — the application's write returns as soon as Redis has the new value. The write to the database is deferred and typically batched, flushed asynchronously by a background process moments (or longer) later.

This is the fastest write path of the three, because the caller never waits on the slower database at all. It's also the riskiest: if the cache crashes or restarts before a deferred write is flushed to the database, that write is gone — the database never learns about it. Write-behind is a deliberate bet that batching writes and returning quickly is worth accepting a small window of potential data loss, which only makes sense for workloads where losing the very latest write (e.g. a view counter, a low-stakes analytics event) is tolerable.

**Common mistakes:**
- Using write-behind for financial balances, orders, or anything where losing the last few writes on a crash is unacceptable — the deferred-flush window is a real data-loss risk, not a theoretical one.
- Assuming write-behind is "just write-through but faster" without accounting for the fact that a crash between the cache write and the deferred database flush genuinely loses data — the two patterns have fundamentally different durability guarantees.

---

## 6. Comparing the Three Strategies

| | **Cache-Aside** | **Write-Through** | **Write-Behind** |
|---|---|---|---|
| **Read path** | Check cache, fall back to DB on miss, populate cache | Check cache — almost always a hit for recently-written data | Check cache — almost always a hit |
| **Write path** | Write DB, then invalidate/update cache | Write cache and DB together, synchronously | Write cache immediately, DB write deferred/batched |
| **Consistency risk** | Brief staleness between a DB write and cache invalidation | Low, if both writes are handled carefully | Highest — data loss if cache crashes before flushing to DB |
| **Write latency** | Only pays cache cost on invalidation, not full sync | Higher — waits on both cache and DB | Lowest — only waits on cache |
| **Complexity** | Low — most common, simplest to reason about | Medium — must handle partial-failure of the two writes | Higher — needs a reliable background flush mechanism |
| **Typical use case** | General-purpose read caching (product pages, user profiles) | Data that must stay in sync and is read immediately after writing | High write-volume, loss-tolerant data (counters, activity logs) |

**Interview angle:** "Walk me through cache-aside, write-through, and write-behind" is a near-guaranteed system-design question once caching comes up. The strongest answers don't just define the three patterns — they explain the *consistency-versus-latency tradeoff* each one makes and give a concrete example of data that fits each: cache-aside for a product catalog page, write-through for a user's account settings that must appear correct the instant they're saved, write-behind for a page-view counter where losing the last few increments on a crash is an acceptable cost for much faster writes.

---

## 7. Hands-On Exercises

### Exercise 1 — Implement and break cache-aside

Using the `get_user` function above, add a `update_user_plan(user_id, new_plan)` function that updates `slow_db_fetch`'s underlying data (simulate this with a Python dict standing in for the database) and then deletes the corresponding `user:{user_id}` cache key. Call `get_user`, then `update_user_plan`, then `get_user` again, and confirm the second `get_user` call reflects the change (and is slow again, since the cache was invalidated).

### Exercise 2 — Simulate write-through's partial-failure problem

Write two functions, `write_to_cache(key, value)` and `write_to_db(key, value)`, where `write_to_db` randomly raises an exception about 1 in 5 calls (using Python's `random.random()`, which returns a float between 0 and 1). Call both in sequence for several writes and observe what happens to consistency when `write_to_db` fails after `write_to_cache` already succeeded. Write a short paragraph on how you'd detect and recover from this in a real system.

### Exercise 3 — Decide the right pattern for five data types

For each of these, decide cache-aside, write-through, or write-behind, and justify your answer in 1-2 sentences: (a) a product description page, (b) a bank account balance, (c) a "post view count" on a social media post, (d) a user's saved shipping address, (e) a live sports score.

---

## 8. Interview Q&A

### Q1. What is cache-aside, and why is it the most common caching pattern?

**Answer:** Cache-aside (lazy loading) has the application check the cache first, fall through to the database only on a miss, and populate the cache with the result before returning it. It's the most common pattern because it's simple, works with any existing database without special integration, and only ever caches data that's actually been requested — nothing is cached speculatively.

---

### Q2. What's the key difference between write-through and write-behind?

**Answer:** Write-through writes to the cache and the database synchronously, together, so the write isn't considered complete until both succeed — this keeps them in sync at the cost of write latency. Write-behind writes to the cache immediately and defers the database write to a later, often batched, asynchronous flush — this is faster but risks losing that write entirely if the cache crashes before the flush happens.

---

### Q3. Why is a TTL important even in a cache-aside setup with explicit invalidation on write?

**Answer:** Explicit invalidation only works if every code path that changes the underlying data remembers to invalidate the cache — a TTL is a safety net for the writes you forgot to invalidate for, or that happened through some other process entirely (a batch job, a direct database edit), ensuring stale data can't live in the cache forever.

---

### Q4. When would write-behind's data-loss risk actually be acceptable?

**Answer:** When the data being written is high-volume and individually low-stakes — a page-view counter, an analytics event, a "last seen online" timestamp — where losing the most recent few writes on a rare crash has negligible real-world impact, but the write-latency savings from not waiting on the database matter at scale.

---

### Q5. If a system needs a user to immediately see their own just-saved changes, which pattern fits best and why?

**Answer:** Write-through fits best, because it keeps the cache and database synchronized on every write rather than relying on a subsequent read to repopulate the cache from a slower source — with cache-aside there's a real risk of momentarily serving a stale value if invalidation and re-population aren't handled carefully.

---

> 🧠 **Memory hook:** "Cache-aside asks the teacher only when your notes are blank; write-through tells the teacher the instant you learn something; write-behind tells the teacher later, in a batch — pick based on how much lag you can tolerate."
