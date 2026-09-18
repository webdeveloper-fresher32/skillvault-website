# 01 — What is Redis?

> A comprehensive reference covering the performance problem Redis solves, the in-memory model, the single-threaded event loop, and how Redis compares to a traditional database or a plain in-process cache.

---

## Table of Contents

1. [The Problem: When Disk I/O Is Too Slow](#1-the-problem-when-disk-io-is-too-slow)
2. [The Analogy: The Librarian's Desk vs the Stacks](#2-the-analogy-the-librarians-desk-vs-the-stacks)
3. [What Redis Actually Is](#3-what-redis-actually-is)
4. [The Single-Threaded Event Loop](#4-the-single-threaded-event-loop)
5. [Redis vs RDBMS vs a Plain Python Dict](#5-redis-vs-rdbms-vs-a-plain-python-dict)
6. [Common Misconceptions](#6-common-misconceptions)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: When Disk I/O Is Too Slow

Every traditional database — MySQL, PostgreSQL, MongoDB — stores its data on disk. Even with clever caching layers, indexes, and SSDs, every query eventually has to touch a storage medium that is orders of magnitude slower than RAM. A single random disk read can take on the order of milliseconds; a single read from RAM takes on the order of *nanoseconds to low microseconds* — roughly 1,000-10,000x faster.

For most applications, that difference doesn't matter — nobody notices an extra millisecond. But for a specific, very common class of workload, it matters enormously:

- **Read-heavy, latency-sensitive paths** — a product page that gets hit thousands of times a second, a session lookup on every single authenticated request, a leaderboard that refreshes every time someone scores.
- **Repeated, expensive computation** — a report or aggregation query that takes 2 seconds to compute in the database, requested by hundreds of users a minute, where 199 of those 200 requests are asking for an answer that hasn't changed since the last one was computed.

If every one of those requests round-trips to disk and re-runs the same expensive query, you're paying the full cost of "slow" over and over for data that barely changes. The core problem: **how do you serve extremely frequent reads of hot data without hitting disk on every single request?**

---

## 2. The Analogy: The Librarian's Desk vs the Stacks

**Real-world analogy:** picture a librarian working in a huge library with millions of books stored in the stacks — rows of shelves several floors deep. Every time a patron asks for a book, walking to the stacks, finding the right shelf, and walking back takes a few minutes. Fine for an occasional request.

But the librarian notices that 20 books get asked for constantly — a bestseller, a popular reference book, this month's book-club pick. So the librarian keeps those 20 books **on their own desk**, within arm's reach. When a patron asks for one of those, the librarian hands it over instantly — no walk to the stacks required. The stacks still hold the full, authoritative collection (nothing is lost or duplicated incorrectly), but the desk serves the overwhelming majority of requests in a fraction of the time.

**The stacks are your disk-backed database. The desk is Redis.** Redis keeps a working set of data in memory — fast to reach, instantly readable — while your primary database (or Redis's own optional persistence, covered in Phase 5) remains the durable, authoritative store for everything else.

---

## 3. What Redis Actually Is

**Redis** (originally short for **RE**mote **DI**ctionary **S**erver) is an **in-memory data structure store**. That phrase packs in three ideas worth unpacking:

- **In-memory** — data primarily lives in RAM, not on disk, which is why reads and writes are extremely fast.
- **Data structure** — unlike a plain cache that only stores opaque blobs, Redis natively understands Strings, Lists, Hashes, Sets, Sorted Sets, and more (Phase 2 covers these in depth). You can `INCR` a counter or `LPUSH` onto a list directly inside Redis, instead of pulling a blob out, modifying it in your application, and writing the whole thing back.
- **Store** — Redis can be used in more than one role: as a standalone **database**, as a **cache** in front of a slower database, and as a **message broker** for real-time communication between services (Pub/Sub and Streams, covered in Phase 9).

That last point matters: Redis is not "just a cache." A cache is one common *use case* for Redis, not a description of what Redis fundamentally is. People reach for Redis as a primary data store for things like real-time leaderboards, rate limiters, and session stores precisely because its native data structures fit those problems so well.

---

## 4. The Single-Threaded Event Loop

Here's a detail that surprises a lot of newcomers: the core of Redis that executes your commands is **single-threaded**. One thread, processing one command at a time, from start to finish, before moving to the next.

At first glance that sounds like a bottleneck — modern CPUs have many cores, so why would a fast database deliberately use only one? The answer is that single-threaded command execution buys Redis something that's easy to underrate: **no lock contention**. Because only one command runs at a time, Redis never needs complex locking logic to keep two commands from corrupting the same piece of data simultaneously — an entire category of concurrency bugs simply cannot happen. Combined with the fact that most Redis operations are already extremely fast (an `INCR` or `HGET` on in-memory data completes in microseconds), a single thread can still process hundreds of thousands of operations per second, with highly predictable, consistent latency — no "some requests are fast, some randomly stall waiting on a lock" behavior.

```
Client A ──▶ [ SET  ]──▶
Client B ──▶ [ GET  ]     ▶  single event loop thread  ▶  processes one command at a time, in order
Client C ──▶ [ INCR ]──▶
                              (network I/O for many clients is handled concurrently;
                               the actual command execution is strictly serial)
```

Redis does use additional background threads/processes for specific heavy work — for example, `BGSAVE` forks a child process for persistence snapshots (Phase 5), and newer Redis versions offload some I/O to background threads — but the command-execution path that actually reads and writes your data stays single-threaded. That single detail explains a recurring theme you'll see across this course: **a single slow command (a huge `KEYS *` scan, a giant value) blocks every other client until it finishes**, because there's no second thread to pick up the slack. Phase 12 revisits this as a real production failure mode.

---

## 5. Redis vs RDBMS vs a Plain Python Dict

| | **Redis** | **Traditional RDBMS (MySQL/Postgres)** | **Plain Python dict (in-process cache)** |
|---|---|---|---|
| **Primary storage** | RAM (with optional disk persistence) | Disk, with a memory buffer/cache layer | RAM only |
| **Network access** | Yes — separate server process, accessed over TCP | Yes — separate server process | No — lives inside one process's memory |
| **Shared across processes/machines** | Yes | Yes | No — dies with the process, not shared |
| **Data structures** | Rich: Strings, Lists, Hashes, Sets, Sorted Sets, Streams, etc. | Rows/tables, relational joins, SQL queries | Whatever native Python types you put in it |
| **Durability** | Optional (RDB/AOF, Phase 5) — off by default in pure-cache mode | Durable by default (transaction logs, disk-backed) | None — gone on process restart/crash |
| **Typical use case** | Cache, session store, rate limiter, leaderboard, pub/sub, queue | System of record, complex relational queries, joins, ACID transactions | Memoizing a value within a single running script/process |

The practical takeaway: a Python dict is the fastest of all three (no network hop at all), but it only helps *one process* remember something — it can't be shared between your five web server instances, and it vanishes on restart. Redis gets you nearly all of that speed while being a genuinely shared, network-accessible store that many processes and machines can read and write together.

**Common mistakes:**
- Treating Redis as a drop-in replacement for a relational database for data that genuinely needs complex joins, multi-table transactions, and strict schema enforcement — Redis can do transactions (Phase 8) but has no relational query engine.
- Assuming Redis data disappears the instant the process stops, full stop — persistence (Phase 5) means this isn't automatically true, though it does depend on configuration.
- Reaching for a plain in-process cache (like a global Python dict) in a multi-instance deployment and being confused when different servers show different cached values — they were never sharing the same memory in the first place.

**Interview angle:** "What is Redis, and why not just use a dict/cache in my application process?" is a common warm-up question. Interviewers want to hear you distinguish *shared, network-accessible, structured* storage (Redis) from *local, single-process, unstructured* storage (an in-process dict) — and to hear that you know Redis is single-threaded by design, not by accident, and why that's actually a strength rather than a limitation.

---

## 6. Common Misconceptions

**Misconception 1: "Redis is just a cache."**

Caching is Redis's most famous use case, but Redis is a general-purpose in-memory data structure store. It's used as a primary database for rate limiters, real-time leaderboards, session stores, and message queues — none of which are "caching" in the sense of "a faster copy of data that lives somewhere else."

**Misconception 2: "Redis is purely in-memory and loses everything on restart."**

By default, a freshly-started Redis instance with no configuration will indeed lose its data if the process stops without persistence enabled. But Redis supports two persistence mechanisms — RDB snapshots and an append-only file (AOF) — covered in full in Phase 5, that let Redis reload its dataset from disk after a restart. "In-memory" describes where Redis operates for speed, not a guarantee that data can never survive a restart.

**Misconception 3: "Single-threaded means slow."**

As covered above, single-threaded command execution is a deliberate design choice that avoids lock contention, not a performance limitation. A single Redis instance routinely handles well over 100,000 operations per second.

---

## 7. Hands-On Exercises

You don't need Redis installed yet for these — Phase 01-02 covers installation. These exercises build conceptual intuition first.

### Exercise 1 — Identify the "desk" data in a system you know

Pick any application you've used or built (a to-do app, an e-commerce site, a chat app). Write down 3 pieces of data that are read *far* more often than they change (candidates for "the librarian's desk") versus 3 pieces of data that genuinely need a durable, relational system of record. Explain your reasoning for each.

### Exercise 2 — Sketch the single-threaded event loop

Draw (on paper or in a text file) what happens when three clients send `SET`, `GET`, and `INCR` to a single-threaded Redis instance at nearly the same instant. Order them arbitrarily, then explain why the *order* in which Redis executes them, while not guaranteed to match arrival order exactly, still guarantees no two commands ever partially interleave and corrupt shared state.

### Exercise 3 — Compare three storage options for one scenario

For a web app that shows "current number of users online," write one paragraph each on how you'd implement this using (a) a plain Python dict inside one server process, (b) a table in a relational database, (c) Redis. Note which one breaks first when you scale to 10 identical web server instances behind a load balancer.

---

## 8. Interview Q&A

### Q1. What is Redis, in one sentence?

**Answer:** Redis is an in-memory data structure store that can be used as a database, cache, and message broker, offering native support for structures like Strings, Lists, Hashes, Sets, and Sorted Sets rather than just storing opaque blobs.

---

### Q2. Is Redis "just a cache"?

**Answer:** No — caching is Redis's most common use case, but it's a general-purpose data store used as a primary system for session stores, rate limiters, real-time leaderboards, and pub/sub messaging. Calling it "just a cache" undersells its native data structures and the workloads it's used for as a system of record.

---

### Q3. Why is Redis single-threaded for command execution, and isn't that a bottleneck?

**Answer:** Single-threaded execution means only one command runs at a time, which eliminates the need for locking between concurrent commands — an entire class of concurrency bugs simply can't occur. Because most Redis operations are already sub-microsecond to low-microsecond in-memory operations, a single thread can still process hundreds of thousands of operations per second with very predictable latency, so in practice it's rarely the bottleneck; the tradeoff is that one unusually slow command (a huge scan, a giant value) blocks everything else until it finishes.

---

### Q4. Does Redis lose all data on restart?

**Answer:** Not necessarily. By default with no persistence configured, yes — data is only in memory and is lost on restart. But Redis supports RDB snapshotting and an append-only file (AOF) mechanism (covered in Phase 5) that let it reload its dataset from disk after restarting, so persistence is a configuration choice, not an inherent limitation of being "in-memory."

---

### Q5. How is Redis different from a traditional relational database?

**Answer:** A traditional RDBMS is disk-backed by default, enforces a rigid schema, and excels at complex relational queries, joins, and ACID transactions across many tables. Redis is primarily memory-backed for speed, stores data in simple but rich structures (Strings, Lists, Hashes, Sets, Sorted Sets) rather than relational tables, and is optimized for very fast, simple access patterns rather than complex multi-table queries.

---

> 🧠 **Memory hook:** "The stacks are your disk; Redis is the librarian's desk — same library, same books, just the popular ones kept within arm's reach."
