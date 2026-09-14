# Redis Course — Design Spec

## Purpose

Add a new "Redis" course to SkillVault, matching the existing course structure (Docker, Kubernetes, MongoDB, MySQL, HLD, AWS, RAG) with one deliberate deviation: **no `README.md` files anywhere** (not top-level, not per-phase, not in `Projects/`), per explicit user request. Audience: a learner who knows Python/basic programming but has no prior Redis experience — beginner-to-advanced learning pace, ending at practitioner-level, production-ready understanding. Every lesson follows the user's established explanation style: problem → analogy → internal flow → code example → comparison table → common mistakes → interview angle → hands-on exercises → interview Q&A → memory hook (same style used in the RAG and MongoDB/MySQL rewrites).

## Structure

```
Redis/
├── Phase-01-Redis-Fundamentals/
├── Phase-02-Core-Data-Structures/
├── Phase-03-Keys-Expiration-and-Eviction/
├── Phase-04-Advanced-Data-Structures/
├── Phase-05-Persistence/
├── Phase-06-Replication-and-High-Availability/
├── Phase-07-Redis-Cluster/
├── Phase-08-Transactions-and-Scripting/
├── Phase-09-Pub-Sub-and-Messaging/
├── Phase-10-Caching-Patterns-and-Strategies/
├── Phase-11-Redis-with-Application-Code/
├── Phase-12-Production-Patterns-and-Security/
├── Projects/
└── Quick-Reference/
```

12 phases, matching the standard SkillVault course length (Docker/Kubernetes/MongoDB/MySQL/HLD). **No `README.md` file exists anywhere in this course** — each phase folder contains only numbered lesson files (`01-Topic.md`, `02-Topic.md`, ...), `Projects/` contains only numbered project files, and there is no top-level course overview file.

## Phase Contents

1. **Redis Fundamentals** — what Redis is (in-memory data store), why it's fast, Redis vs a traditional disk-backed database, single-threaded event loop model at a conceptual level, installation, `redis-cli` basics, connecting from Python (`redis-py`).
2. **Core Data Structures** — Strings (`SET`/`GET`/`INCR`), Lists (`LPUSH`/`RPUSH`/`LRANGE`), Hashes (`HSET`/`HGET`/`HGETALL`), Sets (`SADD`/`SMEMBERS`/set operations), Sorted Sets (`ZADD`/`ZRANGE`/`ZSCORE`) — the five foundational types every other phase builds on.
3. **Keys, Expiration & Eviction** — key naming conventions, `EXPIRE`/`TTL`/`PERSIST`, eviction policies (`noeviction`, `allkeys-lru`, `volatile-ttl`, etc.), `maxmemory` configuration, why eviction policy choice matters for cache vs primary-store use cases.
4. **Advanced Data Structures** — Bitmaps (`SETBIT`/`BITCOUNT`), HyperLogLog (`PFADD`/`PFCOUNT` for approximate cardinality), Geospatial (`GEOADD`/`GEOSEARCH`), Streams (`XADD`/`XREAD`/consumer groups) as an append-only log structure.
5. **Persistence** — RDB snapshotting (point-in-time dumps, `SAVE`/`BGSAVE`), AOF (Append-Only File, write-ahead logging of commands), hybrid persistence, trade-offs between durability and performance, recovery behavior on restart.
6. **Replication & High Availability** — Master-Replica replication (async replication model), read scaling with replicas, Redis Sentinel for automatic failover, split-brain considerations.
7. **Redis Cluster** — sharding via hash slots (16384 slots), cluster topology, resharding, client-side redirection (`MOVED`/`ASK`), when clustering is (and isn't) the right call vs a single well-resourced instance.
8. **Transactions & Scripting** — `MULTI`/`EXEC`/`DISCARD`/`WATCH` (optimistic locking), Lua scripting via `EVAL`/`EVALSHA` for atomic multi-step operations, pipelining for reducing round-trip latency.
9. **Pub/Sub & Messaging** — `PUBLISH`/`SUBSCRIBE`/`PSUBSCRIBE`, at-most-once delivery semantics and their limits, Redis Streams as a durable message queue alternative (consumer groups, acknowledgment), keyspace notifications for reacting to key events.
10. **Caching Patterns & Strategies** — cache-aside (lazy loading), write-through, write-behind, TTL-based invalidation strategies, cache stampede/thundering herd prevention (locking, jittered TTLs, probabilistic early expiration), choosing a caching strategy for a given read/write workload.
11. **Redis with Application Code** — using `redis-py` in a real Python application, connection pooling, serialization considerations (JSON vs pickle vs msgpack for complex values), error handling and retry/backoff for transient connection failures, integrating Redis as a session store or rate limiter in a simple web app context.
12. **Production Patterns & Security** — monitoring key metrics (memory usage, hit/miss ratio, connected clients, slow log), Redis ACLs and `AUTH`, TLS considerations, common production pitfalls (unbounded key growth, missing eviction policy, big keys blocking the single-threaded event loop), a brief overview of Redis Enterprise/Cloud for when self-managed Redis isn't the right operational fit.

Each phase folder contains numbered lesson files (`01-Topic.md`, `02-Topic.md`, ...) — no `README.md`. Code examples default to Python (`redis-py`), since that matches the RAG course's established audience assumption (Python fluency, no assumed prior caching/database experience). Every non-trivial Python idiom is explained inline on first use, consistent with the RAG course's established pattern. `redis-cli` command examples are shown directly where relevant (Redis's command-line interaction is core to learning the database itself, not an implementation detail to abstract away).

## Projects/ (6, beginner → advanced)

1. Simple Key-Value Cache (Phase 1-3: basic Strings, TTL, a toy cache in front of a slow function)
2. Session Store (Phase 2-3: Hashes for session data, expiration for session timeout)
3. Rate Limiter Using Sorted Sets (Phase 2, 4: sliding-window rate limiting with `ZADD`/`ZRANGEBYSCORE`)
4. Pub/Sub Chat Backend (Phase 9: `PUBLISH`/`SUBSCRIBE` powering a simple chat message relay)
5. Cache-Aside Layer in Front of a Database (Phase 10, 11: full cache-aside pattern wrapping a real data-fetch function, with invalidation)
6. Production Redis Capstone (Phase 5-12: persistence + replication + monitoring + security combined into one end-to-end setup)

No `README.md` index file in `Projects/` — just the 6 numbered project files.

## Quick-Reference/

- `Redis-Cheatsheet.md` — quick lookup across all phases (data structure command reference, expiration/eviction policies, persistence comparison, replication/cluster basics, transaction/scripting patterns, caching strategy comparison).
- `Interview-QA.md` — 50 interview questions covering Redis fundamentals, data structures, persistence, replication/clustering, transactions/scripting, pub/sub, caching patterns, and production/security.

These are named files, not `README.md`, so they remain per the "no README" constraint.

## Out of Scope

- RedisJSON, RediSearch, and other Redis Stack modules — mentioned only in passing if relevant (e.g. Phase 12's Enterprise/Cloud overview), not given dedicated phases, to keep the course focused on core Redis.
- Deep dives into other language clients (Node.js, Java, Go) — Python (`redis-py`) is the sole application-integration language, consistent with the RAG course's Python-first approach.
- Redis internals/source-code-level implementation details (e.g. exact hash table resizing algorithms) — covered conceptually where it aids understanding (e.g. why Redis is fast), not at a systems-engineering depth.
