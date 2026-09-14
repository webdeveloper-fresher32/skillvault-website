# OS Concepts in System Design — Complete Guide

## Table of Contents
1. [Why This Mapping Matters](#1-why-this-mapping-matters)
2. [The Master Mapping Table](#2-the-master-mapping-table)
3. [Scheduling → Load Balancing](#3-scheduling--load-balancing)
4. [Memory Management → Resource Pooling](#4-memory-management--resource-pooling)
5. [Synchronization → Distributed Locks](#5-synchronization--distributed-locks)
6. [IPC → Message Queues and RPC](#6-ipc--message-queues-and-rpc)
7. [Virtual Memory → Caching and Abstraction Layers](#7-virtual-memory--caching-and-abstraction-layers)
8. [Worked Example: Designing a Rate Limiter](#8-worked-example-designing-a-rate-limiter)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why This Mapping Matters

Every distributed system is, at its core, a bunch of single-machine OS problems copy-pasted across a network. A single machine has processes competing for a CPU; a cluster has services competing for a load balancer. A single machine has threads racing over shared memory; a cluster has services racing over a shared database row. The *math* is the same — contention, fairness, correctness under concurrency — the *scale* is the only thing that changed.

```
Single Machine                          Distributed System
───────────────                         ───────────────────
CPU scheduler picks next process   →    Load balancer picks next server
Mutex protects shared memory       →    Distributed lock protects shared row
Semaphore limits concurrent access →    Connection pool limits concurrent DB conns
Producer-consumer via bounded queue →   Producer-consumer via message queue (Kafka/SQS)
Virtual memory abstracts RAM       →    CDN/cache abstracts origin server
Page fault → fetch from disk       →    Cache miss → fetch from database
Context switch                     →    Request handoff between services
Deadlock (2 threads, 2 locks)      →    Deadlock (2 services, 2 distributed locks)
```

Interviewers who ask system design questions are frequently former (or current) backend engineers who think in OS primitives even when they're drawing boxes and arrows on a whiteboard. If you can say "this is basically a semaphore" when explaining why you're capping concurrent connections to a downstream service, you sound like someone who understands *why* a pattern works, not just that it exists.

---

## 2. The Master Mapping Table

| OS Concept | Distributed/System Design Analog | Why They're the Same Problem |
|---|---|---|
| **CPU scheduling** (which process runs next) | **Load balancing** (which server handles the next request) | Both pick a "worker" for a unit of work under a fairness/throughput policy (round robin, least-loaded ≈ shortest job first) |
| **Time slicing / preemption** | **Request timeouts + circuit breakers** | Both prevent one unit of work from starving others of a shared resource |
| **Process** | **Service / microservice instance** | Independent unit of execution with its own state, isolated from others |
| **Thread** | **Worker / goroutine / request handler within a service** | Lightweight concurrent unit sharing the same address space (service's memory/DB connection) |
| **Mutex (mutual exclusion lock)** | **Distributed lock** (Redis `SETNX`, Zookeeper, etcd) | Both ensure only one actor modifies a shared resource at a time |
| **Semaphore** | **Connection pool / rate limiter / concurrency limiter** | Both cap the number of concurrent holders of a limited resource to N |
| **Monitor / condition variable** | **Pub-sub notification (Kafka consumer, Redis pub/sub)** | Both let a waiter block until a producer signals a state change |
| **Producer-consumer with bounded buffer** | **Message queue** (Kafka, RabbitMQ, SQS) | Both decouple a fast/slow producer from a fast/slow consumer via a buffer |
| **Deadlock** (circular wait on locks) | **Distributed deadlock** (two services each holding a lock the other needs) | Same four Coffman conditions apply, just across network boundaries |
| **Virtual memory** | **Caching layer / CDN** | Both give the illusion of a bigger/faster resource than physically exists, backed by a slower true source |
| **Page fault** | **Cache miss** | Both trigger a slow fetch from the "true" backing store when the fast layer doesn't have the data |
| **Page replacement (LRU, LFU)** | **Cache eviction policy** (LRU, LFU, TTL) | Identical algorithms, applied to cache entries instead of memory pages |
| **Paging / segmentation (address translation)** | **Sharding / partitioning (key → shard mapping)** | Both translate a logical address/key into a physical location |
| **Thrashing** (excessive paging, no real work gets done) | **Cascading failure / retry storm** | Both describe a system spending all its capacity on overhead instead of useful work |
| **File descriptor table** | **API Gateway's connection registry** | Both track open handles to external resources per process/service |
| **Interrupts** | **Webhooks / async event callbacks** | Both let a slower background operation notify the requester it's done, instead of polling |
| **System call (user mode → kernel mode)** | **API call to a privileged/internal service** | Both are a controlled boundary crossing to access protected resources |
| **Copy-on-write (fork)** | **Read replicas with lazy divergence** | Both defer the cost of duplication until an actual write happens |
| **NUMA / cache locality** | **Data locality / co-locating services with their data** | Both minimize cross-boundary access latency by keeping related things physically close |

---

## 3. Scheduling → Load Balancing

A CPU scheduler decides which of several waiting processes gets the CPU next. A load balancer decides which of several servers gets the next request. The policies map almost one-to-one:

| CPU Scheduling Algorithm | Load Balancer Equivalent |
|---|---|
| Round Robin | Round-robin load balancing |
| Shortest Job First | Least-connections / least-response-time routing |
| Priority Scheduling | Weighted load balancing (VIP traffic gets priority) |
| Multilevel Feedback Queue | Adaptive routing that reprioritizes based on observed latency |

Starvation matters in both worlds too: a low-priority process can starve under naive priority scheduling, just like a slow/unlucky backend server can get bypassed forever under naive least-connections routing if it never catches a break. The fix in both cases is the same idea — aging (gradually boosting priority the longer something waits).

---

## 4. Memory Management → Resource Pooling

A semaphore lets N threads hold a resource concurrently and blocks the (N+1)th until one releases. A **database connection pool** is a semaphore wearing a trench coat: it caps concurrent DB connections to N, queues callers past that, and hands out a "permit" (a connection) on release.

```
Semaphore (OS)                          Connection Pool (System Design)
───────────────                         ────────────────────────────────
count = 10                              maxPoolSize = 10
wait() → count--, block if 0            acquire() → borrow connection, block if pool empty
signal() → count++, wake a waiter       release() → return connection, wake a waiter
Protects: a physical resource           Protects: a finite set of DB connections
Purpose: prevent resource exhaustion    Purpose: prevent DB from being overwhelmed
```

This is why "why not just open a new DB connection per request?" has the same answer as "why not spawn unlimited threads?" — unbounded concurrency exhausts a finite resource (file descriptors, memory, DB backend capacity) and the fix is the same primitive: a bounded semaphore.

---

## 5. Synchronization → Distributed Locks

A mutex ensures only one thread enters a critical section at a time, using a shared memory location (the lock) that all threads can see. In a distributed system there's no shared memory, so you need an external, mutually-visible store to hold the "lock" — that's what Redis (`SET key value NX EX 30`), Zookeeper, or etcd are used for.

The classic mutex problems reappear at scale:

| Single-Machine Mutex Problem | Distributed Lock Equivalent |
|---|---|
| Thread crashes while holding the lock → deadlock forever | Service crashes while holding a distributed lock → lock never released → **use a TTL/lease so it auto-expires** |
| Priority inversion | A low-priority job holds a lock a high-priority job needs — same mitigation: keep critical sections/lock hold times short |
| Reentrant vs non-reentrant lock | Redlock/etcd lease renewal — can the same client re-acquire its own lock? |
| Spurious wakeup | Split-brain — a client thinks it holds the lock after a network partition, but the lock actually expired and was granted to someone else |

This last row is the important one to raise in interviews: distributed locks are *harder* than mutexes precisely because network partitions mean you can never be 100% sure the other side is dead versus just slow — a problem that doesn't exist inside a single machine with a real mutex.

---

## 6. IPC → Message Queues and RPC

Interprocess communication (IPC) mechanisms map directly onto how services talk to each other:

| IPC Mechanism (single machine) | Distributed Equivalent |
|---|---|
| Shared memory | Shared cache (Redis) or shared database |
| Pipes (one-way byte stream between processes) | HTTP request/response, gRPC stream |
| Message queues (System V / POSIX mq) | Kafka, RabbitMQ, SQS |
| Signals (async notification, e.g. SIGTERM) | Webhooks, pub/sub events |
| Sockets | Network sockets (literally the same primitive, just crossing a real network instead of localhost) |

The producer-consumer problem — the textbook example of a bounded buffer with a mutex + two condition variables (`not_full`, `not_empty`) — is exactly what a message queue solves at scale. Kafka's partition + consumer group model is a producer-consumer buffer where "the buffer is full" (backpressure) is handled by disk-backed storage instead of a fixed-size in-memory array.

---

## 7. Virtual Memory → Caching and Abstraction Layers

Virtual memory gives every process the illusion of a large, private, contiguous address space, backed by a combination of physical RAM and disk (swap), with the OS silently translating addresses and fetching pages on demand.

A CDN or application cache does the same job for a distributed system: it gives clients the illusion of a fast, always-available data source, backed by a combination of a fast cache tier and a slower true origin (database/object storage), with the cache layer silently translating "cache miss" into "go fetch from origin."

```
Virtual Memory                          Caching Layer
───────────────                         ──────────────
Process accesses virtual address   →    Client requests a resource
Page table lookup                  →    Cache key lookup
Page in RAM → return immediately   →    Cache hit → return immediately
Page not in RAM → page fault       →    Cache miss → fetch from origin
Fetch page from disk into RAM      →    Fetch data from DB into cache
Evict a page if RAM is full (LRU)  →    Evict a cache entry if cache is full (LRU)
Thrashing: too much paging, little →    Cache stampede: too many misses,
useful work gets done                   origin overwhelmed
```

---

## 8. Worked Example: Designing a Rate Limiter

Rate limiting is a favorite system design question, and it's almost pure OS theory in disguise:

- **The core mechanism (token bucket / leaky bucket)** is literally a counting semaphore with a timer: tokens (permits) regenerate over time, requests `wait()` for a token, and are rejected instead of blocked if none are available.
- **Where you store the counter** is a memory management question: local in-process counter = "registers," fast but not shared across instances; Redis-backed counter = "shared memory," visible to every instance but adds network latency (analogous to going from L1 cache to RAM).
- **Handling concurrent decrements of the counter** is a critical-section problem: two requests must not both read count=1, both decide "allowed," and both proceed — you need an atomic decrement (`INCR` in Redis, or a mutex-protected counter locally), exactly like two threads incrementing a non-atomic global counter.
- **What happens when rate-limiter nodes disagree** (one thinks there's quota left, another doesn't) is a cache-coherence problem — the same one multi-core CPUs solve with protocols like MESI.

Framing your answer this way in an interview signals you understand *why* the pattern is correct, not just that "use Redis with a sliding window" is the expected phrase to say.

---

## 9. Interview Q&A

**Q: How does CPU scheduling relate to load balancing?**
Answer: Both solve the same problem — deciding which of several available workers (a process or a server) should handle the next unit of work (a CPU burst or a request) under some fairness/throughput goal. Round robin, least-connections/shortest-job-first, and priority-based policies exist in both domains, and both suffer from starvation if not designed carefully, fixed by the same technique: aging (gradually raising priority for things that have waited too long).

**Q: Why is a database connection pool basically a semaphore?**
Answer: A semaphore caps the number of concurrent holders of a resource to N and blocks (or rejects) the N+1th requester until one is released. A connection pool does exactly this for database connections — it prevents unbounded concurrent connections from exhausting the database's capacity, the same way a semaphore prevents unbounded threads from exhausting a limited resource like file descriptors.

**Q: How is a distributed lock different from a normal mutex, and why is that difference important?**
Answer: A mutex lives in shared memory that all threads on the same machine can see, so if the lock holder crashes, the OS can reliably know the thread is dead and other synchronization primitives can react correctly. A distributed lock lives in an external store (Redis, Zookeeper), and a network partition can make a live client look dead (or vice versa) — you can never be fully certain the lock holder is actually gone. This is why distributed locks need TTLs/leases and fencing tokens, mitigations that a plain mutex never needs.

**Q: What's the relationship between virtual memory and a caching layer like a CDN?**
Answer: Virtual memory gives a process the illusion of a large, fast, private address space backed by RAM and disk, translating addresses and fetching data on demand (page faults). A CDN/cache gives a client the illusion of a fast, always-available data source backed by a cache tier and a slower origin server, fetching data on demand on a cache miss. Eviction policies (LRU/LFU) and the failure mode of "too many misses overwhelming the backing store" (thrashing vs. cache stampede) are conceptually identical in both.

**Q: Why does the producer-consumer problem matter for understanding message queues like Kafka?**
Answer: Producer-consumer is the classic OS problem of coordinating a fast/slow producer and a fast/slow consumer through a bounded buffer, using a mutex plus condition variables to handle the "buffer full" and "buffer empty" cases safely. A message queue is this same pattern at scale: producers publish messages, consumers pull them, and backpressure (the "buffer full" case) is handled by durable, disk-backed storage instead of blocking in memory — letting the queue absorb much larger and longer bursts of imbalance between producer and consumer speed.
