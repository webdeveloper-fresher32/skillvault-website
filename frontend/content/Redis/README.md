# Redis Architecture & In-Memory Data Storage

> "Redis is an open-source, in-memory data structure store used as a database, cache, streaming engine, and message broker: delivering sub-millisecond read/write latency through single-threaded event loop execution."

---

## 12-Phase Curriculum Overview

| Phase | Module | Key Topics |
|---|---|---|
| 01 | [Redis Fundamentals](Phase-01-Redis-Fundamentals/01-What-is-Redis.md) | In-memory architecture, single-threaded reactor pattern, RESP protocol |
| 02 | [Core Data Structures](Phase-02-Core-Data-Structures/01-Strings.md) | Strings, Lists, Sets, Hashes, Sorted Sets (ZSet) |
| 03 | [Keys, Expiration & Eviction](Phase-03-Keys-Expiration-and-Eviction/01-Key-Naming-and-TTL.md) | TTLs, expiration strategies, maxmemory eviction policies (LRU, LFU) |
| 04 | [Advanced Data Structures](Phase-04-Advanced-Data-Structures/01-Bitmaps-and-HyperLogLog.md) | Bitmaps, HyperLogLog, Geospatial indexes, Redis Streams |
| 05 | [Persistence](Phase-05-Persistence/01-RDB-Snapshotting.md) | RDB snapshots, AOF append-only log, fsync strategies, hybrid persistence |
| 06 | [Replication & High Availability](Phase-06-Replication-and-High-Availability/01-Master-Replica-Replication.md) | Leader-follower replication, Redis Sentinel failover & quorum |
| 07 | [Redis Cluster](Phase-07-Redis-Cluster/01-Sharding-and-Hash-Slots.md) | 16384 hash slots, cluster sharding, cross-slot keys, redirection |
| 08 | [Transactions & Scripting](Phase-08-Transactions-and-Scripting/01-Transactions-with-MULTI-EXEC.md) | MULTI / EXEC / DISCARD, optimistic locking with WATCH, Lua scripting |
| 09 | [Pub/Sub & Messaging](Phase-09-Pub-Sub-and-Messaging/01-Pub-Sub-Basics.md) | Publish/Subscribe, Consumer Groups, event streaming with Redis Streams |
| 10 | [Caching Patterns & Strategies](Phase-10-Caching-Patterns-and-Strategies/01-Cache-Aside-Write-Through-Write-Behind.md) | Cache-aside, write-through, write-behind, cache stampede mitigation |
| 11 | [Redis with Application Code](Phase-11-Redis-with-Application-Code/01-Connection-Pooling-and-redis-py.md) | Client connection pooling (ioredis, Jedis), pipeline batching |
| 12 | [Production Patterns & Security](Phase-12-Production-Patterns-and-Security/01-Monitoring-and-Common-Failure-Modes.md) | ACLs, TLS encryption, memory fragmentation, slowlog analysis |

---

## Projects & Quick Reference

- **[Projects](Projects/01-Simple-Key-Value-Cache.md)**: Tiered caching & distributed locking projects.
- **[Quick Reference](Quick-Reference/Redis-Cheatsheet.md)**: Commands cheatsheet and Redis interview Q&A.
