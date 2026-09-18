# Redis Interview Q&A

50 questions covering the full Redis course, organized by topic.

---

## Redis Fundamentals & Architecture (Q1–Q8)

### Q1. What is Redis, in one sentence?

Redis is an in-memory data structure store that can be used as a database, cache, and message broker, offering native support for structures like Strings, Lists, Hashes, Sets, and Sorted Sets rather than just storing opaque blobs. It's not "just a cache" — it's a general-purpose store that's also commonly used as a primary system for session stores, rate limiters, leaderboards, and pub/sub messaging.

### Q2. Why is Redis so much faster than a traditional disk-backed database for hot data?

A single random disk read takes on the order of milliseconds, while a RAM read takes on the order of nanoseconds to low microseconds — roughly 1,000-10,000x faster. Because Redis keeps its working set in memory, read-heavy, latency-sensitive workloads (session lookups, product pages, leaderboards) avoid that disk round-trip almost entirely, at the cost of needing an explicit persistence strategy for durability.

### Q3. Is Redis single-threaded, and isn't that a bottleneck?

Redis's command execution is single-threaded — one command runs to completion before the next begins. This eliminates lock contention entirely (an entire class of concurrency bugs simply can't happen), and because most operations are already sub-microsecond, a single thread still processes hundreds of thousands of operations per second with very predictable latency. The real tradeoff is that one unusually slow command (a huge scan, a giant value) blocks every other client until it finishes, since there's no second thread to pick up the slack.

### Q4. Does Redis lose all its data if the process restarts?

Not necessarily. With no persistence configured, yes — data lives only in memory and disappears on restart. But Redis supports RDB snapshotting and an append-only file (AOF) mechanism that reload the dataset from disk after a restart, so persistence is a configuration choice, not an inherent limitation of being "in-memory."

### Q5. How does Redis compare to a traditional RDBMS like MySQL or PostgreSQL?

A traditional RDBMS is disk-backed by default, enforces a rigid schema, and excels at complex relational queries, joins, and multi-table ACID transactions. Redis is primarily memory-backed for speed, stores data in simple but rich structures rather than relational tables, and is optimized for very fast, simple access patterns rather than complex multi-table queries. Redis does support transactions (`MULTI`/`EXEC`) but has no relational query engine.

### Q6. How is Redis different from just using a plain in-process cache, like a Python dict?

A Python dict is the fastest of the two (no network hop at all), but it only helps one process remember something — it can't be shared across multiple web server instances behind a load balancer, and it vanishes on restart. Redis is a genuinely shared, network-accessible store that many processes and machines can read and write together, trading a small amount of speed for that sharing capability.

### Q7. What are the main misconceptions people have about Redis?

Three common ones: that Redis is "just a cache" (it's a general-purpose data structure store also used as a primary system of record for rate limiters, leaderboards, and queues); that Redis is purely in-memory with no durability story (RDB and AOF persistence exist precisely to close that gap); and that "single-threaded" means "slow" (it's a deliberate design choice to avoid lock contention, not a performance limitation).

### Q8. What roles can Redis play in a system's architecture?

Redis can act as a standalone database (rate limiters, leaderboards, session stores), a cache in front of a slower system of record (the most common use case), and a message broker for real-time communication between services via Pub/Sub or Streams. All three roles are built on the same underlying in-memory data structure engine.

---

## Core Data Structures (Q9–Q16)

### Q9. What is the simplest Redis data type, and what can it store?

The String — a single key mapped to a single value. It can hold text, numbers, or arbitrary binary data up to 512MB, making it useful for anything from a simple counter to a serialized object or cached image.

### Q10. Why is `INCR` considered atomic, and why does that matter?

`INCR` reads the current integer value, adds one, and writes the result back as a single indivisible operation inside Redis's single-threaded execution model — no other command can run in between those steps. Implementing the same logic in application code (`GET`, add one, `SET`) introduces a race window where two concurrent callers can both read the same value and both write back the same result, silently losing an increment.

### Q11. When would you choose a List over a Hash?

A List when the order of items matters and you're modeling a sequence — a queue, a recent-activity feed, a log — where you push and pop from either end. A Hash when you're modeling a single object with multiple named fields, like a user profile, where grouping fields under one key matters more than any ordering among them.

### Q12. Why should a List used as a capped feed always be paired with `LTRIM`?

Without `LTRIM`, every `LPUSH`/`RPUSH` keeps growing the list indefinitely — nothing in Redis automatically caps a List's size. Calling `LTRIM key 0 N-1` after each push keeps only the most recent N elements, discarding the rest, which is the standard way to bound memory usage for a "last N items" feed.

### Q13. What guarantee does a Redis Set provide that a List doesn't?

Uniqueness — adding a member that's already present via `SADD` is a no-op and doesn't create a duplicate entry, whereas a List (via `LPUSH`/`RPUSH`) has no such guarantee and will happily store the same value multiple times.

### Q14. How would you implement a real-time leaderboard in Redis?

With a Sorted Set: `ZADD leaderboard <score> <member>` to add or update a player's score, `ZINCRBY leaderboard <delta> <member>` to atomically adjust it, and `ZREVRANGE leaderboard 0 N WITHSCORES` to fetch the top N players in descending score order.

### Q15. What's a common misunderstanding about what `ZADD` and `SADD` return?

Both return the number of members **newly added**, not the number of writes that happened. Updating an existing Sorted Set member's score with `ZADD`, or re-adding a member already in a Set with `SADD`, doesn't increment the return value — only genuinely new members count, which surprises people expecting it to reflect "how many operations just occurred."

### Q16. Why might storing a user profile as one Hash be better than storing it as several separate String keys, or as one JSON-serialized String?

A Hash groups all of a logical object's fields under a single key, so the whole object can be fetched (`HGETALL`) or deleted (`DEL`) in one call, and it avoids the per-key memory overhead of many separate String keys. Compared to a JSON-serialized String, a Hash also lets you read or write individual fields (`HGET`/`HSET` on just one field) without pulling, re-parsing, and rewriting the entire blob to change one value.

---

## Keys, Expiration & Eviction (Q17–Q21)

### Q17. Does Redis enforce any structure on key names, like namespaces or tables?

No. Redis has one flat, global keyspace, and every key is just a string internally. Colon-delimited naming like `user:1001:profile` is a widely-adopted convention (supported by `SCAN`-style glob pattern matching), not a feature Redis parses or enforces — the discipline comes entirely from the application and its team.

### Q18. What's the difference between `TTL` returning `-1` and `-2`?

`-1` means the key exists but has no expiration set — it lives forever unless something later sets a TTL. `-2` means the key doesn't exist at all, either because it was never set or it already expired. Confusing these two is a common bug source when checking "is this key still alive."

### Q19. What happens to a key's TTL if you run a plain `SET` on it again?

A plain `SET key value` (without `EX`, `PX`, or `KEEPTTL`) removes any existing expiration outright, making the key permanent even if it previously had a TTL. To update a value while preserving its existing TTL, use `SET key value KEEPTTL`.

### Q20. What is the default `maxmemory-policy`, and why does that surprise people?

The default is `noeviction`. Once memory usage reaches the configured `maxmemory` limit, Redis stops accepting writes that would use additional memory and returns an error, while reads keep working — it does not proactively evict anything. This surprises people who assume Redis-as-cache "just works" out of the box and gracefully makes room; they end up with a wave of write failures that looks like an outage instead.

### Q21. What's the difference between `allkeys-lru` and `volatile-lru`, and when would you pick one over the other?

Both evict the least-recently-used key when memory is full, but `allkeys-lru` is willing to evict any key regardless of whether it has a TTL, while `volatile-lru` only ever considers keys that have an expiration set. `volatile-lru` is the safer choice when an instance mixes permanent, no-TTL keys with cache-like TTL'd keys, since it guarantees the permanent keys are never touched by eviction.

---

## Advanced Data Structures (Q22–Q25)

### Q22. What is a Redis Bitmap, really, and what is it good for?

A Bitmap isn't a separate data type — it's a regular Redis String accessed through bit-level commands like `SETBIT`, `GETBIT`, and `BITCOUNT`. It's ideal for representing a large number of boolean flags compactly, such as one bit per sequential user ID marking daily activity, since a million users' attendance for one day fits in about 125KB.

### Q23. Why would you choose HyperLogLog over a Set for counting unique visitors at scale?

A Set must store every distinct element, so memory grows linearly with cardinality — at billions of unique visitors that can mean gigabytes. HyperLogLog uses a fixed ~12KB per key regardless of cardinality, trading a small (~0.81%) standard error for a dramatic and constant memory saving, at the cost of never being able to retrieve the actual elements back out.

### Q24. What data structure actually backs Redis's geospatial index, and what's the most common mistake using it?

A Sorted Set — Redis encodes each location's longitude and latitude into a single sortable geohash value stored as the member's score, so geospatial commands like `GEOADD`/`GEOSEARCH` are specialized wrappers around Sorted Set operations. The most common mistake is passing latitude before longitude; Redis always expects longitude first, the opposite of how people typically say "lat/long" out loud.

### Q25. What problem do Redis Streams solve that Lists and Pub/Sub don't?

Streams provide a durable, ordered, append-only log that multiple independent consumers can read at their own pace, with the ability to replay history via `XRANGE`. A List has no concept of multiple coordinated readers (a single `LPOP` removes the entry for everyone), and Pub/Sub has zero persistence — an offline subscriber simply misses messages forever.

---

## Persistence (Q26–Q29)

### Q26. What is an RDB snapshot, and what's its main weakness?

RDB is a complete, point-in-time binary snapshot of Redis's entire dataset written to a single file (`dump.rdb` by default), used to restore state after a restart or for backups. Its weakness: it only captures data at the moment a snapshot was taken, so anything written after the most recent snapshot and before a crash is permanently lost.

### Q27. What's the difference between `SAVE` and `BGSAVE`?

`SAVE` writes the snapshot synchronously in the main Redis process, blocking every other client's commands until it finishes — unacceptable on a large dataset in production. `BGSAVE` forks a child process to write the snapshot in the background, using copy-on-write so the parent keeps serving reads and writes normally while a consistent point-in-time snapshot is produced.

### Q28. Does enabling AOF guarantee zero data loss?

No. The common default `appendfsync everysec` batches disk flushes once per second for performance, meaning a crash can still lose up to roughly a second of the most recent writes. Only `appendfsync always` gets close to zero data loss, at the cost of a real per-write performance penalty from forcing an `fsync` on every command.

### Q29. What is hybrid persistence, and why is it useful?

Hybrid persistence writes an AOF file as an RDB-formatted binary preamble (a compact snapshot) followed by a short tail of AOF commands logged since. On restart, Redis loads the fast binary preamble and replays only the small recent tail, combining RDB's fast restart times with AOF's fine-grained durability, instead of replaying a full command history from scratch.

---

## Replication & Clustering (Q30–Q35)

### Q30. Is Redis replication synchronous or asynchronous, and why does that matter?

Asynchronous — the master applies a write and acknowledges the client immediately, without waiting for any replica to confirm it received the command. This keeps write latency low, but it means a replica's data can briefly lag behind the master's, which matters for any read pattern that needs to see its own most recent write.

### Q31. Does setting up master-replica replication give you automatic failover if the master crashes?

No. Replication by itself only keeps replicas' data in sync and lets them serve reads; nothing about plain replication detects a master failure or promotes a replica automatically. That orchestration is what Redis Sentinel adds on top.

### Q32. What is the difference between SDOWN and ODOWN in Redis Sentinel?

SDOWN (Subjectively Down) is one Sentinel's individual observation that the master isn't responding — it could be a real outage or just that one Sentinel's own network path. ODOWN (Objectively Down) is reached only once a configured quorum of Sentinels independently agree the master is down, which is the trigger Sentinel actually acts on for failover.

### Q33. Why can't Redis replication alone solve the "dataset too big for one machine" problem?

Replication copies the entire dataset onto every replica — it scales read throughput and availability, not total capacity. Every node in a replicated setup still needs enough RAM to hold the whole dataset, so if the dataset itself doesn't fit on one machine, adding replicas doesn't help; sharding the data itself across multiple masters (Redis Cluster) is the only way to scale total capacity.

### Q34. How does Redis Cluster decide which node owns a given key?

Redis Cluster divides the entire keyspace into 16384 fixed hash slots. A key's slot is computed as `CRC16(key) mod 16384`, and each master node owns a defined subset of those slots. Any node can perform this calculation and knows which node currently owns the resulting slot via the gossiped cluster slot map, so lookups don't require a separate directory service.

### Q35. What's the difference between a `MOVED` and an `ASK` redirect in Redis Cluster?

`MOVED` means a slot has been permanently reassigned to a different node, and the client should update its cached slot map going forward. `ASK` means a specific key has moved to a new node mid-migration but the slot as a whole hasn't finished moving, so the client should retry just that one request against the new node (after sending `ASKING`) without permanently updating its slot map.

---

## Transactions & Scripting (Q36–Q39)

### Q36. Are Redis transactions ACID like a SQL database's transactions?

Partially. `MULTI`/`EXEC` provides atomicity (the whole batch executes with no other client's commands interleaved) and, when combined with `WATCH`, a form of isolation. But it does not provide rollback on runtime failure — if one queued command errors when it actually runs, the rest of the queued commands still execute; nothing is undone.

### Q37. What is `WATCH` used for, and what happens if a watched key changes?

`WATCH` is called before `MULTI` to mark one or more keys for optimistic locking. If any watched key is modified by another client between the `WATCH` call and the eventual `EXEC`, the whole transaction is aborted — `EXEC` returns `nil` and none of the queued commands run. The application detects this and retries the read-decide-write flow with fresh data.

### Q38. Why would you use a Lua script instead of `MULTI`/`EXEC`?

`MULTI`/`EXEC` queues commands blindly with no ability to read a value and branch on it mid-batch. A Lua script runs full conditional logic (`if`/`else`, reading a value with `redis.call` and deciding what to do next) entirely atomically on the server, which is exactly what's needed for operations like "only decrement this balance if there are sufficient funds."

### Q39. What's the difference between pipelining and a transaction?

Pipelining is purely a network optimization — batching multiple commands into one round-trip with zero atomicity, meaning other clients' commands can interleave with them exactly as if they'd been sent individually. A transaction (`MULTI`/`EXEC`) guarantees no interleaving. They can be combined: `redis-py`'s `pipeline()` defaults to wrapping the batch in `MULTI`/`EXEC`, while `transaction=False` gives pure pipelining with no atomicity.

---

## Pub/Sub & Streams (Q40–Q42)

### Q40. What delivery guarantee does Redis Pub/Sub provide?

At-most-once delivery, and only to clients that are actively subscribed at the exact moment a message is published. There is no persistence, no message history, and no way for a client to catch up on messages published while it was disconnected.

### Q41. What does a Redis Stream consumer group provide that Pub/Sub doesn't?

Persistence of entries, at-least-once delivery guarantees (an unacknowledged entry stays pending in the group's pending list and can be re-delivered), and competing-consumer semantics where each entry is delivered to exactly one consumer within the group rather than broadcast to everyone.

### Q42. How would you build a reliable task queue with Redis, and why not just use Pub/Sub?

Use Streams with consumer groups: `XADD` durably appends work, `XREADGROUP` with `>` ensures each entry goes to only one consumer in the group, and `XACK`/`XPENDING` handle acknowledgment and detecting a consumer that died mid-task. Pub/Sub lacks all three of these guarantees — persistence, at-least-once delivery, and competing-consumer semantics — since it's built purely for low-latency broadcast, not guaranteed processing.

---

## Caching Patterns (Q43–Q46)

### Q43. What is cache-aside, and why is it the most common caching pattern?

Cache-aside (lazy loading) has the application check the cache first, fall through to the database only on a miss, and populate the cache with the result (usually with a TTL) before returning it. It's the most common pattern because it's simple, works with any existing database without special integration, and only ever caches data that's actually been requested.

### Q44. What's the key difference between write-through and write-behind?

Write-through writes to the cache and the database synchronously, together, so the write isn't considered complete until both succeed — keeping them in sync at the cost of write latency. Write-behind writes to the cache immediately and defers the database write to a later, often batched, asynchronous flush — faster, but it risks losing that write entirely if the cache crashes before the flush happens.

### Q45. What is a cache stampede, and name two techniques to prevent one?

A cache stampede happens when a popular cache key expires and a large number of concurrent requests all experience a miss for that same key at once, each independently querying the database to regenerate the same value, spiking load on the system the cache was meant to protect. Two prevention techniques: a short-lived distributed lock (`SET key value NX EX ttl`) so only one client repopulates the key while others wait or serve a stale value, and jittered TTLs so a batch of related keys doesn't all expire at the exact same instant.

### Q46. Why is a TTL important even in a cache-aside setup with explicit invalidation on write?

Explicit invalidation only works if every code path that changes the underlying data remembers to invalidate the cache. A TTL is a safety net for the writes you forgot to invalidate for, or that happened through some other process entirely (a batch job, a direct database edit), ensuring stale data can't live in the cache forever.

---

## Production & Security (Q47–Q50)

### Q47. What are the most important Redis metrics to monitor in production?

Memory usage relative to `maxmemory`, the cache hit ratio computed from `keyspace_hits`/`keyspace_misses`, `connected_clients` (a slow climb can indicate a connection leak), and the slow log via `SLOWLOG GET`. Together these catch memory pressure, a degrading cache, connection leaks, and individually expensive commands — failure modes that simple uptime/CPU monitoring misses entirely.

### Q48. Why is one enormous key dangerous in Redis, specifically?

Because Redis command execution is single-threaded, reading, writing, or deleting one very large value takes a proportionally long time — and during that time, no other client's commands can be processed at all. A single oversized key can stall every other client on the instance, not just the client that touched it.

### Q49. Does a fresh Redis installation have a password by default, and what's the layered fix?

No — a fresh install has no password at all, meaning anyone who can reach it on the network can run any command, a well-known and commonly-exploited misconfiguration. The layered fix: `requirepass`/`AUTH` as a baseline password, Redis ACLs (`ACL SETUSER`) for per-application least-privilege permissions on specific commands and key patterns, TLS to encrypt traffic in transit, and binding Redis only to trusted network interfaces.

### Q50. When would you choose a managed Redis offering over running it yourself?

Managed Redis makes the most sense when the operational burden of patching, monitoring, failover (Sentinel), or resharding (Cluster) outweighs the cost premium of paying a vendor to handle it — typically for smaller teams, or when Redis isn't the core differentiator of the product. Self-managed makes more sense with in-house operational expertise, a need for configuration control a managed service doesn't expose, or a scale where the managed markup becomes cost-prohibitive.
