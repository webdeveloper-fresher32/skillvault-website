# Redis Cheatsheet

---

## Data Structure Command Reference

```bash
# --- Strings (Phase 2) ---
SET key value                    # Set a value, overwriting whatever was there
GET key                          # Retrieve a value, or nil if missing
SET key value EX 60              # Set value + 60s TTL atomically (SETEX key 60 value is the older, equivalent form)
SET key value NX EX 60           # Set only if key doesn't exist — the basis of a distributed lock
SET key value KEEPTTL            # Overwrite value, preserve existing TTL (plain SET wipes it)
DEL key                          # Delete a key — returns count actually removed
INCR key / DECR key              # Atomically add/subtract 1 — race-condition-safe, unlike GET+SET
INCRBY key n / DECRBY key n      # Atomically add/subtract an arbitrary integer
MSET k1 v1 k2 v2 / MGET k1 k2    # Batch set/get multiple keys in one round trip

# --- Lists (Phase 2) ---
LPUSH key v [v ...]               # Push onto the left/head — returns new length
RPUSH key v [v ...]               # Push onto the right/tail
LRANGE key start stop             # Read a range (0-indexed, -1 = last element)
LPOP key / RPOP key               # Remove and return leftmost/rightmost element
LTRIM key start stop              # Keep only elements in range — pair with LPUSH to cap a feed's size

# --- Hashes (Phase 2) ---
HSET key field value [field value ...]  # Set one or more fields — returns count of NEW fields added
HGET key field                    # Get a single field's value
HGETALL key                       # Get every field/value (redis-py returns a dict)
HDEL key field [field ...]        # Delete one or more fields

# --- Sets (Phase 2) ---
SADD key member [member ...]      # Add member(s) — returns count of NEWLY added (dupes don't count)
SMEMBERS key                      # Return all members, no guaranteed order
SISMEMBER key member              # O(1) membership check — 1/0 (True/False in redis-py)
SINTER / SUNION / SDIFF key ...   # Set intersection / union / difference across multiple sets

# --- Sorted Sets (Phase 2) ---
ZADD key score member [score member ...]  # Add/update — returns count of NEWLY added members
ZRANGE key start stop [WITHSCORES]        # Ascending order by score
ZREVRANGE key start stop [WITHSCORES]     # Descending order by score
ZSCORE key member                         # A single member's score
ZINCRBY key increment member              # Atomically bump a member's score

# --- Bitmaps & HyperLogLog (Phase 4) ---
SETBIT key offset 0|1             # Set a single bit — returns the PREVIOUS value at that offset
GETBIT key offset                 # Read a single bit
BITCOUNT key [start end]          # Count bits set to 1
BITOP AND|OR|XOR|NOT destkey key [key ...]  # Combine Bitmaps bitwise
PFADD key element [element ...]   # Add to a HyperLogLog — ~12KB memory, fixed, regardless of cardinality
PFCOUNT key [key ...]             # Approximate distinct count (~0.81% standard error)
PFMERGE destkey sourcekey [...]   # Merge multiple HLLs into one

# --- Geospatial (Phase 4) ---
GEOADD key long lat member [...]  # Add a location — LONGITUDE BEFORE LATITUDE, always
GEOSEARCH key FROMLONLAT long lat BYRADIUS n km [ASC|DESC]  # Find members within a radius
GEODIST key member1 member2 [unit]  # Distance between two stored members
GEOPOS key member [member ...]    # Look up stored coordinates (small precision loss expected)

# --- Streams (Phase 4 / Phase 9) ---
XADD key '*' field value [...]    # Append an entry — '*' auto-generates <ms-epoch>-<seq> ID
XRANGE key - +                    # Read entries in an ID range (- = smallest, + = largest)
XREAD [COUNT n] STREAMS key id    # Read entries newer than a given ID
XGROUP CREATE key group id [MKSTREAM]     # Create a consumer group ($ = new entries only, 0 = full history)
XREADGROUP GROUP group consumer COUNT n STREAMS key '>'  # Claim entries never delivered to this group
XACK key group id [id ...]        # Mark entry as processed, remove from pending list
XPENDING key group                # Inspect delivered-but-unacknowledged entries
```

---

## Expiration & Eviction Policies Quick Reference

```bash
EXPIRE key seconds     # Set TTL on existing key — 1 if set, 0 if key doesn't exist
PEXPIRE key ms         # Same, millisecond precision
TTL key                # Seconds remaining — -1 = no TTL (never expires), -2 = key doesn't exist
PTTL key               # Same, in milliseconds
PERSIST key            # Remove TTL, make permanent — 1 if removed, 0 if none existed
CONFIG SET maxmemory 100mb                  # Set the memory ceiling
CONFIG SET maxmemory-policy allkeys-lru     # Set the eviction policy
CONFIG GET maxmemory-policy                 # Verify current policy
```

| Policy | Evicts | Best fit when... |
|---|---|---|
| `noeviction` (default) | Nothing — errors on writes when full | Redis is a primary store; losing data silently is unacceptable |
| `allkeys-lru` | Any key, least-recently-used first | Pure cache workload; "recently touched" ≈ "still useful" (common default for caches) |
| `volatile-lru` | Only keys with a TTL, least-recently-used first | Mixed instance: permanent keys + cache-like TTL'd keys |
| `allkeys-lfu` | Any key, least-frequently-used first | Bursty/cyclical access; "used often overall" beats "used recently" |
| `volatile-lfu` | Only keys with a TTL, least-frequently-used first | Same as above, but permanent keys must never be evicted |
| `volatile-ttl` | Only keys with a TTL, soonest-to-expire first | Prefer evicting what was about to disappear anyway |
| `allkeys-random` / `volatile-random` | Any / TTL'd key, at random | Zero bookkeeping overhead needed, no "smart" eviction required |

**Key naming convention:** `<entity>:<id>:<field>` (e.g. `user:1001:profile`, `session:abc123`) — a convention, not enforced by Redis, but essential for `SCAN`-pattern cleanup and monitoring.

---

## Persistence Comparison

| | **RDB (snapshot)** | **AOF (append-only file)** | **Hybrid (RDB preamble + AOF tail)** |
|---|---|---|---|
| **What it is** | Point-in-time binary snapshot | Log of every write command | RDB snapshot + short AOF tail since |
| **Durability** | Weakest — loses everything since last snapshot | Strong — as little as ~1s lost (`everysec`), near-zero (`always`) | Strong — same as AOF going forward |
| **Restart speed** | Fast — load one binary file | Slower — replay full command log | Fast — load preamble, replay short tail |
| **Disk usage** | Compact | Grows until rewritten | Moderate |
| **Trigger commands** | `SAVE` (blocking) / `BGSAVE` (forked, non-blocking) | `CONFIG SET appendonly yes`, `BGREWRITEAOF` to compact | Default in modern Redis when AOF is enabled |
| **Check status** | `LASTSAVE` → Unix timestamp of last successful save | `CONFIG GET appendfsync` | Same as AOF |

```bash
CONFIG SET save "900 1 300 10 60 10000"   # Snapshot if N keys changed in M seconds (rules OR'd together)
BGSAVE                                    # Fork a child process, snapshot in background
LASTSAVE                                  # Unix timestamp of last successful save
CONFIG SET appendonly yes                 # Enable AOF
CONFIG SET appendfsync always|everysec|no # always = safest/slowest; everysec = common default; no = fastest/riskiest
BGREWRITEAOF                              # Compact the AOF file (forked, non-blocking)
```

---

## Replication & Cluster Basics

```bash
REPLICAOF <master-host> <master-port>     # Make this instance a replica of another
REPLICAOF NO ONE                          # Promote a replica to a standalone master
INFO replication                          # role:master/slave, connected_slaves, master_link_status
CLUSTER KEYSLOT key                       # Which of the 16384 hash slots a key maps to (CRC16(key) mod 16384)
CLUSTER NODES                             # Full slot-ownership map across the cluster
SENTINEL get-master-addr-by-name mymaster # Ask Sentinel for the CURRENT master's address (port 26379)
```

| | Single Instance | Sentinel-Managed Replication | Redis Cluster |
|---|---|---|---|
| **Solves** | Nothing extra | Automatic failover + read scaling | Horizontal capacity (sharded data) + availability |
| **Every node holds full dataset?** | Yes (only one exists) | Yes — every replica is a full copy | No — each master holds only its slots |
| **Failure detection** | None | Quorum-based (SDOWN → ODOWN) | Gossip-based between nodes |

- Replication is **asynchronous** — master acknowledges the client immediately, replicas apply the write moments later (replication lag).
- Replicas are **read-only by default** — writing to one returns a `READONLY` error.
- Sentinel: **SDOWN** = one Sentinel's opinion; **ODOWN** = quorum of Sentinels agree → triggers failover. Run 3+ Sentinels (odd number) — a single Sentinel can't reach quorum with itself.
- Cluster: use `{hashtag}` syntax (e.g. `{user:1000}:name`) to force related keys onto the same slot for multi-key operations — otherwise you get a `CROSSSLOT` error.
- `MOVED` = permanent redirect, update your slot map. `ASK` = temporary (mid-resharding), retry once via `ASKING`, don't update your map.

---

## Transactions & Scripting Patterns

```bash
MULTI                      # Start queuing commands
DECRBY balance:alice 50    # QUEUED — not executed yet
INCRBY balance:bob 50      # QUEUED
EXEC                       # Runs all queued commands atomically, returns results array
DISCARD                    # Cancel a queued transaction before EXEC

WATCH key                  # Optimistic lock — abort EXEC (returns nil) if key changes before it
# ... GET key, decide, MULTI, queue writes, EXEC ...

EVAL "script" numkeys key1 ... arg1 ...   # Run a Lua script atomically, server-side
SCRIPT LOAD "script"                       # Cache a script, get back its SHA1 hash
EVALSHA sha1 numkeys key1 ... arg1 ...    # Run a cached script by hash (avoids resending source)
```

| | `MULTI`/`EXEC` | Lua Scripting (`EVAL`) | Pipelining |
|---|---|---|---|
| **Atomicity** | Yes — no interleaving | Yes — whole script runs uninterrupted | No — pure network optimization |
| **Conditional/branching logic** | No — commands queued blindly | Yes — full `if`/`else`, reads and branches | No |
| **Rollback on runtime error** | No — other queued commands still run | N/A — script either completes or errors as a whole | N/A |
| **Purpose** | Atomic batch of pre-decided commands | Atomic batch with server-side decision logic | Cut network round-trips for independent commands |

```python
pipe = r.pipeline(transaction=False)   # transaction=False = pure pipelining, no MULTI/EXEC, no atomicity
pipe.set("k", "v"); pipe.incr("n"); results = pipe.execute()
```

- Redis transactions are **not** rollback-safe like SQL: a runtime error in one queued command (e.g. `INCR` on a non-numeric string) doesn't stop the rest of the batch from running.
- `KEYS`/`ARGV` inside Lua avoid string-concatenation injection bugs and let Cluster route scripts correctly.

---

## Pub/Sub vs Streams Comparison

```bash
SUBSCRIBE channel          # Exact-name subscription — blocks, receives PUBLISHed messages live
PSUBSCRIBE pattern*        # Glob-pattern subscription (e.g. news.*)
PUBLISH channel message    # Returns count of subscribers that received it (0 = nobody listening, not an error)

XGROUP CREATE stream group '$' MKSTREAM       # Consumer group — '$' = new entries only, '0' = full history
XREADGROUP GROUP group consumer COUNT n STREAMS stream '>'  # Claim never-delivered entries
XACK stream group id       # Acknowledge processed entry
XPENDING stream group      # See what's claimed but unacknowledged
```

| | **Pub/Sub** | **Streams + Consumer Groups** |
|---|---|---|
| **Persistence** | None | Entries persist until trimmed |
| **Delivery guarantee** | At-most-once, only to currently-connected subscribers | At-least-once — unacked entries stay pending, re-deliverable |
| **Replay history** | None — offline subscribers miss messages forever | Yes — `XRANGE`/`XREAD` replay any historical range |
| **Work distribution** | Broadcast — every subscriber gets every message | Competing consumers — each entry to exactly one consumer per group |
| **Typical use case** | Live notifications, chat relay, dashboards | Task queues, order processing, guaranteed-delivery pipelines |

---

## Caching Strategy Comparison

| | **Cache-Aside (Lazy Loading)** | **Write-Through** | **Write-Behind (Write-Back)** |
|---|---|---|---|
| **Read path** | Check cache → miss falls to DB → populate cache | Check cache — almost always a hit | Check cache — almost always a hit |
| **Write path** | Write DB, then invalidate/update cache | Write cache + DB together, synchronously | Write cache immediately, DB write deferred/batched |
| **Consistency risk** | Brief staleness between DB write and invalidation | Low, if both writes handled carefully | Highest — data loss if cache crashes before flush |
| **Write latency** | Only pays cost on invalidation | Higher — waits on both systems | Lowest — only waits on cache |
| **Typical use case** | Product pages, user profiles (most common default) | Settings that must be correct the instant they're saved | High-volume, loss-tolerant data (view counters, analytics) |

```python
# Cache-aside
cached = r.get(key)
if cached is None:
    value = slow_db_fetch()
    r.set(key, json.dumps(value), ex=300)     # populate with TTL

# Stampede prevention: SET ... NX EX as a short-lived repopulation lock
got_lock = r.set(f"lock:{key}", "1", nx=True, ex=10)
```

**Invalidation strategies:** TTL-based expiration (baseline safety net) · explicit `DEL` on write (immediate freshness) · versioned/hashed keys (`product:123:v7`, old versions just stop being referenced).

**Cache stampede prevention:** jittered TTLs (`3600 + random.randint(0, 300)`) so a batch doesn't expire simultaneously · a short-lived `SET key value NX EX ttl` lock so only one client repopulates a hot key · probabilistic early expiration before actual expiry.

---

## Production Checklist

**Monitoring**
```bash
redis-cli INFO memory     # used_memory_human, maxmemory_human, mem_fragmentation_ratio
redis-cli INFO stats      # keyspace_hits, keyspace_misses, expired_keys, evicted_keys
redis-cli SLOWLOG GET 10  # 10 most recent commands over the slow-log threshold
```
- Hit ratio = `keyspace_hits / (keyspace_hits + keyspace_misses)` — watch it trend, not just its current value.
- Watch memory vs `maxmemory`, `connected_clients` (a slow climb suggests a connection leak upstream), and the slow log for one expensive command hiding behind overall latency.
- A single oversized key/value blocks *every* client while it's read/written/deleted — Redis is single-threaded for command execution.

**Security**
```bash
CONFIG SET requirepass "strongpassword"                       # Baseline password protection
ACL SETUSER appuser on >pw ~cached:* -@all +get +mget          # Least-privilege per-application user
ACL LIST / ACL WHOAMI                                           # Inspect users / confirm current identity
```
- A fresh Redis install has **no password by default** — never expose it beyond `localhost` unprotected.
- Layer `requirepass`/ACLs (who can do what) + TLS (encrypt in transit) + network binding (who can even reach it) together — they're complementary, not alternatives.
- In an `ACL SETUSER` rule, order matters: `-@all` before `+get +mget` means "only GET/MGET"; reversed, it would strip those grants back out.

**Connection handling**
```python
pool = redis.ConnectionPool(host="localhost", port=6379, max_connections=20, decode_responses=True)
r = redis.Redis(connection_pool=pool)   # share ONE pool across the whole app, not one client per request
```
- Never create a new `redis.Redis()` client per request — share one `ConnectionPool`.
- Catch `redis.exceptions.ConnectionError`/`TimeoutError` around calls; use exponential backoff on retry.
- Use `json.dumps`/`json.loads` for cached objects by default; avoid `pickle` on any data you don't fully trust (arbitrary code execution risk on unpickling).

**Capacity planning**
- Confirm a well-sized single instance (or Sentinel-managed replication) can't handle the load before reaching for Cluster — clustering solves "data too big for one node's RAM" but multiplies operational complexity.
- Weigh self-managed vs a managed offering based on in-house operational expertise vs the cost of being on call for patching, failover, and resharding.
