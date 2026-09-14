# ElastiCache — Complete Guide (Redis and Memcached)

## Table of Contents
1. [What is Caching and Why is it Needed](#what-is-caching-and-why-is-it-needed)
2. [What is ElastiCache](#what-is-elasticache)
3. [Redis vs Memcached Comparison](#redis-vs-memcached-comparison)
4. [Redis Features Deep Dive](#redis-features-deep-dive)
5. [ElastiCache Use Cases](#elasticache-use-cases)
6. [Cache Patterns](#cache-patterns)
7. [Cache Eviction Policies](#cache-eviction-policies)
8. [Redis Cluster Mode](#redis-cluster-mode)
9. [ElastiCache Security](#elasticache-security)
10. [Interview Q&A](#interview-qa)

---

## What is Caching and Why is it Needed

### The Problem Without Caching

```
WITHOUT CACHE:
+--------+     every request     +--------+    query    +----------+
|  User  | --------------------> |  App   | ----------> | Database |
+--------+     (milliseconds)    +--------+             +----------+
                                                        (10-100ms query)

1,000 users/second → 1,000 database queries/second
Database is the bottleneck
Increasing load = increasing database cost + latency
```

### The Solution: Caching

```
WITH CACHE:
+--------+     first request    +--------+  cache MISS  +----------+
|  User  | ------------------> |  App   | -----------> | Database |
+--------+                     +--------+              +----------+
                                    |                        |
                                    |     cache result       |
                                    +----------+             |
                                               v             |
                                         +----------+        |
                                         |  Cache   | <------+
                                         |  (Redis) |
                                         +----------+

+--------+    subsequent requests   +--------+  cache HIT   +----------+
|  User  | -----------------------> |  App   | -----------> |  Cache   |
+--------+     (microseconds!)      +--------+   hit rate   |  (Redis) |
                                                 ~95%        +----------+

Database queries: reduced by 95%
Response time:    microseconds vs milliseconds
Cost:             lower database load = smaller instance needed
```

### Where to Cache

```
CACHING LAYERS (from fastest to slowest):
  
  CPU Register: < 1 ns
  CPU L1 Cache: ~1 ns
  CPU L2 Cache: ~4 ns
  RAM:          ~100 ns
  -------- [ElastiCache is here] ~100 microseconds --------
  Local SSD:    ~100 µs
  Remote SSD:   ~500 µs
  -------- [Database read is here] ~10-100 ms --------
  HDD:          ~1-10 ms
  S3/internet:  ~100 ms - seconds
```

**ElastiCache stores data in RAM** — orders of magnitude faster than reading from a database on disk.

---

## What is ElastiCache

Amazon ElastiCache is a fully managed in-memory caching service supporting two open-source engines:
- **Redis** — Feature-rich, persistence, replication, pub/sub
- **Memcached** — Simple, multi-threaded, pure cache

```
+------------------------------------------+
|          ELASTICACHE FEATURES            |
+------------------------------------------+
| Fully managed:  AWS handles patching,    |
|                 monitoring, failover     |
| Highly available: Multi-AZ with replica  |
| Automatic failover (Redis)               |
| Sub-millisecond latency (microseconds)   |
| VPC: Deployed in your VPC                |
| Integration: Works with RDS, DynamoDB    |
+------------------------------------------+
```

---

## Redis vs Memcached Comparison

```
+-----------------------------+-----------------------------+
|           REDIS             |         MEMCACHED           |
+-----------------------------+-----------------------------+
| ENGINE CHARACTERISTICS                                    |
+-----------------------------+-----------------------------+
| Single-threaded (mostly)    | Multi-threaded              |
| Feature-rich                | Simple, fast                |
| Persistence support         | No persistence (pure cache) |
| Replication support         | No native replication       |
| Pub/Sub support             | No pub/sub                  |
| Sorted sets, lists, etc.    | Only strings                |
+-----------------------------+-----------------------------+
| AVAILABILITY                                              |
+-----------------------------+-----------------------------+
| Multi-AZ with auto failover | No failover                 |
| Read replicas               | No replicas                 |
| AOF + RDB backup            | No backups                  |
+-----------------------------+-----------------------------+
| SCALING                                                   |
+-----------------------------+-----------------------------+
| Cluster mode (sharding)     | Sharding (multi-node)       |
| Scales horizontally/vert.   | Scales horizontally         |
+-----------------------------+-----------------------------+
| DATA TYPES                                                |
+-----------------------------+-----------------------------+
| String, Hash, List, Set,    | String only                 |
| Sorted Set, Bitmap,         |                             |
| HyperLogLog, Streams        |                             |
+-----------------------------+-----------------------------+
| USE WHEN                                                  |
+-----------------------------+-----------------------------+
| Need persistence            | Pure caching only           |
| Need HA + auto failover     | Maximum simplicity          |
| Need pub/sub                | Multi-threaded performance  |
| Session store               | Simple key-value cache      |
| Leaderboards (sorted sets)  | Large object caching        |
| Geospatial data             | Don't need HA               |
| Queues (lists)              |                             |
+-----------------------------+-----------------------------+
| EXAM: Choose Redis unless you specifically need          |
|       multi-threaded simplicity → then Memcached         |
+-----------------------------+-----------------------------+
```

**Quick rule:** When in doubt, choose Redis. It does everything Memcached does plus much more.

---

## Redis Features Deep Dive

### Data Structures

```
STRING:
  SET user:001:name "Ganesh"
  GET user:001:name → "Ganesh"
  INCR user:001:pageviews → 1 (atomic counter)
  
HASH (like a dictionary/object):
  HSET user:001 name "Ganesh" email "g@example.com" age 30
  HGET user:001 name → "Ganesh"
  HGETALL user:001 → {name: Ganesh, email: g@example.com, age: 30}
  Use: User profiles, session data
  
LIST (ordered, allows duplicates):
  RPUSH queue:emails "email1" "email2" "email3"  (append to right)
  LPOP queue:emails → "email1"  (pop from left)
  Use: Message queues, activity feeds
  
SET (unordered, unique elements):
  SADD tags:post:001 "aws" "cloud" "tutorial"
  SMEMBERS tags:post:001 → {aws, cloud, tutorial}
  SISMEMBER tags:post:001 "aws" → 1 (true)
  SUNION tags:post:001 tags:post:002 → union of both sets
  Use: Tags, unique visitors, social connections
  
SORTED SET (unique elements with scores, ordered by score):
  ZADD leaderboard 1500 "player1"
  ZADD leaderboard 2000 "player2"
  ZADD leaderboard 800  "player3"
  ZRANGE leaderboard 0 -1 WITHSCORES → [player3:800, player1:1500, player2:2000]
  ZREVRANK leaderboard "player2" → 0 (rank 1)
  Use: Leaderboards, rate limiting, priority queues
  
STREAM (time-series log, like Kafka):
  XADD events * action "click" user "001"
  XREAD COUNT 10 STREAMS events 0 → latest 10 events
  Use: Event sourcing, activity streams, IoT sensor data
  
BITMAP:
  SETBIT user:001:visited:2024-01 15 1  (user visited on Jan 15)
  GETBIT user:001:visited:2024-01 15 → 1
  BITCOUNT user:001:visited:2024-01 → # of days visited in Jan
  Use: Feature flags, daily active users, attendance tracking
  
HYPERLOGLOG:
  PFADD unique_visitors "user1" "user2" "user3"
  PFCOUNT unique_visitors → 3 (approximate, < 1% error)
  Use: Approximate unique count with very low memory (12 KB max)
```

### Persistence

Redis offers two persistence mechanisms (useful for session store):

```
RDB (Redis Database Backup) — Snapshots:
  Creates point-in-time snapshots of the dataset
  Saves to disk at configurable intervals:
    save 900 1     (after 900 seconds if 1 key changed)
    save 300 10    (after 300 seconds if 10 keys changed)
    save 60 10000  (after 60 seconds if 10000 keys changed)
  
  Pros: Compact file, fast restarts, good for backups
  Cons: May lose data since last snapshot (minutes of data)
  Use: When losing a few minutes of data is acceptable

AOF (Append Only File) — Log:
  Logs every write command
  Replay on restart to rebuild dataset
  
  Sync options:
    appendfsync always   → log every write (slowest, safest)
    appendfsync everysec → log every second (compromise)
    appendfsync no       → let OS decide (fastest, less safe)
  
  Pros: Much less data loss (1 second max with everysec)
  Cons: Larger file, slower restarts
  Use: When data loss must be minimal

BOTH (recommended):
  Enable both RDB and AOF
  Redis uses AOF on restart (more complete)
  RDB for backups
```

### Pub/Sub

Redis supports publish/subscribe messaging:

```
PUBLISHER:
  PUBLISH channel:notifications "User 001 logged in"
  PUBLISH channel:orders "Order #123 placed"

SUBSCRIBER (receives all messages to subscribed channels):
  SUBSCRIBE channel:notifications
  → Message: "User 001 logged in"
  → Message: "User 002 logged in"

PATTERN SUBSCRIBE:
  PSUBSCRIBE channel:*  → receive from all channels

Use cases:
  - Chat applications
  - Real-time notifications
  - Event broadcasting
  - Service-to-service messaging (lightweight alternative to SQS)
```

### TTL (Time to Live)

```
SET session:abc123 "user_data" EX 3600   (expire in 1 hour)
SET cache:product:001 "product_data" EX 300  (expire in 5 minutes)

EXPIRE key 600   (set expiry on existing key)
TTL key          (check remaining time)
PERSIST key      (remove expiry)

Expired keys are automatically deleted (lazy deletion + periodic scan)
```

---

## ElastiCache Use Cases

### 1. Database Query Caching (Cache-Aside)

Most common use case. Cache expensive database queries.

```
+----------+      CACHE HIT (~0.1ms)     +----------+
|          | ------------------------->  |          |
|   App    |                            |  Redis   |
|          | <--------------------------| Cache    |
+----------+                            +----------+

+----------+   CACHE MISS (~0.1ms)      +----------+    DB query   +----------+
|          | -------------------------> |          |  (~50ms)      |          |
|   App    |                            |  Redis   | <------------ |  RDS     |
|          | <--------------------------| Cache    | ----------->  |  MySQL   |
+----------+   return to client         +----------+ cache result  +----------+
```

```python
def get_product(product_id):
    cache_key = f"product:{product_id}"
    
    # Try cache first
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Cache miss — query database
    product = db.query("SELECT * FROM products WHERE id = %s", product_id)
    
    # Store in cache for 5 minutes
    redis.setex(cache_key, 300, json.dumps(product))
    
    return product
```

### 2. Session Store

Store user sessions in Redis instead of database or local memory.

```
WHY REDIS FOR SESSIONS:
  ✓ Sessions need fast read/write
  ✓ Sessions expire (TTL)
  ✓ Sessions shared across multiple app servers
  ✓ Scales better than DB-based sessions
  ✓ If Redis is down, gracefully degrade to re-login

ARCHITECTURE:
+----------+     +----------+     +----------+
| Web      |     | Web      |     | Web      |
| Server 1 |     | Server 2 |     | Server 3 |
| (EC2)    |     | (EC2)    |     | (EC2)    |
+----------+     +----------+     +----------+
      |                |                |
      +----------------+----------------+
                       |
               +---------------+
               |  ElastiCache  |
               |  Redis        |
               |  (Sessions)   |
               +---------------+
               
User can hit ANY server — their session is in Redis
```

### 3. Leaderboards

Redis sorted sets are perfect for real-time leaderboards.

```python
# Update player score
redis.zadd("game:leaderboard", {"player_001": 5000})
redis.zadd("game:leaderboard", {"player_002": 8000})
redis.zadd("game:leaderboard", {"player_003": 3500})

# Get top 10 players (highest to lowest)
top10 = redis.zrevrange("game:leaderboard", 0, 9, withscores=True)
# [("player_002", 8000), ("player_001", 5000), ("player_003", 3500)]

# Get a player's rank
rank = redis.zrevrank("game:leaderboard", "player_001")
# → 1 (0-indexed, so rank 2)

# Get players around rank 50 (nearby players)
nearby = redis.zrevrange("game:leaderboard", 45, 55, withscores=True)
```

### 4. Rate Limiting

```python
def is_rate_limited(user_id):
    key = f"rate_limit:{user_id}:{current_minute()}"
    
    # Increment counter
    count = redis.incr(key)
    
    # Set expiry on first increment (expire after 60 seconds)
    if count == 1:
        redis.expire(key, 60)
    
    # Allow max 100 requests per minute
    if count > 100:
        return True  # Rate limited!
    
    return False
```

---

## Cache Patterns

### Cache-Aside (Lazy Loading)

The most common pattern. Application manages cache explicitly.

```
READ FLOW:
  1. App checks cache
  2a. Cache HIT → return cached data
  2b. Cache MISS → query database → store in cache → return data

WRITE FLOW:
  1. App writes to database
  2. App invalidates (deletes) cache entry
  3. Next read will be a cache miss → fresh data fetched from DB

+--------+  1. Read?  +-------+  3. Miss!  +----------+
|        | ---------> |       | ---------> |          |
|  App   | <--------- | Cache | <--------- | Database |
|        |  2. Return | (miss)| 4. Store   |          |
+--------+            +-------+            +----------+
```

**Pros:**
- Only caches data that's actually requested
- If cache fails, application still works (reads from DB)
- Cache stays lean

**Cons:**
- Cache miss = 3 trips (check cache, query DB, write cache) = slow first request
- Stale data if DB updated without invalidating cache
- Cache stampede (many requests hitting DB on cold start)

### Write-Through

Update cache on every database write.

```
WRITE FLOW:
  1. App writes to DATABASE
  2. App ALSO writes to CACHE (same time)
  
READ FLOW:
  1. App checks cache
  2. Usually a HIT (cache always up to date after writes)

+--------+  1. Write   +----------+
|        | ----------> | Database |
|  App   |             +----------+
|        |  2. Write   
|        | ----------> +----------+
+--------+             |  Cache   |
                       +----------+
```

**Pros:**
- Cache always up to date
- Read performance excellent (nearly always cache hit)
- No stale data

**Cons:**
- Every write hits both DB and cache (higher write latency)
- Cache fills with data that may never be read
- Cache size grows with every write

### Write-Behind (Write-Back)

Write to cache first, asynchronously write to database later.

```
WRITE FLOW:
  1. App writes to CACHE only (instant, returns success)
  2. Background process asynchronously flushes to DATABASE

+--------+  1. Write (fast!)  +----------+
|        | -----------------> |  Cache   |
|  App   |  returns success   +----+-----+
+--------+                         |
                                   | 2. Async flush
                                   ↓
                              +----------+
                              | Database |
                              +----------+
```

**Pros:**
- Lowest write latency (write to RAM only)
- Database write throughput reduced (batch updates)

**Cons:**
- Risk of data loss if cache fails before flush
- More complex implementation
- Eventually consistent (DB may lag behind cache)

### Comparison of Cache Patterns

```
+--------------------+-------------------+-------------------+-------------------+
| Pattern            | Read Performance  | Write Performance | Consistency       |
+--------------------+-------------------+-------------------+-------------------+
| Cache-Aside        | First: slow       | Normal            | Eventually        |
|                    | Subsequent: fast  |                   | (depends on TTL)  |
+--------------------+-------------------+-------------------+-------------------+
| Write-Through      | Fast (always hit) | Slower (+cache)   | Strong            |
+--------------------+-------------------+-------------------+-------------------+
| Write-Behind       | Fast              | Fastest (RAM)     | Eventually        |
|                    |                   |                   | (risky)           |
+--------------------+-------------------+-------------------+-------------------+
```

**Cache-Aside is the most common in practice** — simple, resilient to cache failures, only caches hot data.

---

## Cache Eviction Policies

When cache is full, Redis must decide which keys to remove.

```
+----------------------------------+----------------------------------+
| POLICY                           | BEHAVIOR                         |
+----------------------------------+----------------------------------+
| noeviction                       | Return error when memory full    |
|                                  | (don't evict anything)           |
+----------------------------------+----------------------------------+
| allkeys-lru                      | Evict LEAST RECENTLY USED keys   |
|                                  | from ALL keys                    |
+----------------------------------+----------------------------------+
| volatile-lru                     | Evict LRU keys that have TTL set |
|                                  | (only keys with expiry)          |
+----------------------------------+----------------------------------+
| allkeys-lfu                      | Evict LEAST FREQUENTLY USED keys |
|                                  | from ALL keys                    |
+----------------------------------+----------------------------------+
| volatile-lfu                     | Evict LFU keys that have TTL set |
+----------------------------------+----------------------------------+
| allkeys-random                   | Evict RANDOM key from all keys   |
+----------------------------------+----------------------------------+
| volatile-random                  | Evict RANDOM key with TTL set    |
+----------------------------------+----------------------------------+
| volatile-ttl                     | Evict key with LOWEST TTL first  |
+----------------------------------+----------------------------------+

RECOMMENDATION:
  allkeys-lru: Best for general-purpose caching
               "Remove the key not used recently"
               
  volatile-lru: If some keys must never be evicted
                (only evicts keys with TTL set)
                
  noeviction:  For session stores where losing data is unacceptable
               (returns error instead of evicting)
```

---

## Redis Cluster Mode

### Without Cluster Mode (Disabled)

```
+------------------+
|  Primary Node    |
|  (all data)      |
+------------------+
        |
+------------------+  +------------------+
|  Replica Node 1  |  |  Replica Node 2  |
|  (read replica)  |  |  (read replica)  |
+------------------+  +------------------+

Single shard: all data on primary node
Replicas serve reads
Automatic failover if primary fails
Max: ~400 GB on largest node type (r6g.16xlarge)
```

### With Cluster Mode (Enabled)

```
+----------+    +----------+    +----------+
| Shard 1  |    | Shard 2  |    | Shard 3  |
| Primary  |    | Primary  |    | Primary  |
| Keys 0-  |    | Keys 5461|    | Keys     |
| 5460     |    | -10922   |    | 10923-   |
|          |    |          |    | 16383    |
| Replica  |    | Replica  |    | Replica  |
+----------+    +----------+    +----------+

Data sharded across multiple nodes using hash slots
16,384 hash slots total, divided among shards
Each shard is responsible for a range of slots
key → CRC16(key) % 16384 → slot → shard

BENEFITS:
  ✓ Scales beyond single node memory limit
  ✓ Higher aggregate throughput
  ✓ Still highly available (each shard has replicas)

LIMITATIONS:
  ✗ Multi-key operations limited to same slot
    (MGET, MSET, transactions only within one shard)
  ✗ More complex client configuration
  ✗ No database selection (only db 0)
```

### Choosing Cluster Mode

```
USE Cluster Mode Disabled when:
  - Data fits in single node memory
  - Need multi-key transactions
  - Simplicity preferred
  - Total data < ~400 GB

USE Cluster Mode Enabled when:
  - Data exceeds single node memory
  - Need higher write throughput (distributed writes)
  - Plan to scale to terabytes
  - Willing to manage hash slot constraints
```

---

## ElastiCache Security

### Network Security

```
+-----------------------------------------------+
|                    VPC                        |
|                                               |
|  +------------------+  +------------------+  |
|  | App Servers       |  | ElastiCache      |  |
|  | SG: sg-app        |  | SG: sg-cache     |  |
|  +------------------+  +------------------+  |
|                         Private subnet only   |
|                         NO internet access    |
|                                               |
| sg-cache inbound:                             |
|   TCP 6379 from sg-app (Redis)                |
|   TCP 11211 from sg-app (Memcached)           |
+-----------------------------------------------+

ElastiCache has NO public endpoint
Only accessible within VPC (or VPN/Direct Connect)
```

### AUTH and Encryption

```
REDIS AUTH (password):
  Enable AUTH token when creating Redis cluster
  Clients must provide password: AUTH <token>
  
  aws elasticache create-replication-group \
    --auth-token "YourSecurePassword123!"
    --transit-encryption-enabled

ENCRYPTION IN TRANSIT:
  TLS encryption for data in transit
  --transit-encryption-enabled flag
  Adds SSL overhead but secures network traffic

ENCRYPTION AT REST:
  Encrypts data on disk (for persisted data)
  --at-rest-encryption-enabled flag
  Uses KMS keys
  
IAM AUTHENTICATION (newer Redis versions):
  Use IAM roles instead of passwords
  More secure, integrates with AWS IAM
```

---

## Interview Q&A

### Q1: When would you use Redis over Memcached?

**Answer:** In almost all cases, choose **Redis**. Here's when each makes sense:

**Choose Redis when:**
- You need data persistence (sessions that survive restarts)
- You need automatic failover (Multi-AZ with replica promotion)
- You need data structures beyond simple strings (sorted sets for leaderboards, lists for queues, sets, hashes)
- You need pub/sub messaging
- You need Lua scripting or atomic operations
- High availability is required

**Choose Memcached when:**
- You want maximum simplicity (pure cache, no extra features)
- You need multi-threaded performance for CPU-intensive operations
- You don't need persistence, replication, or HA
- Your team already uses Memcached and simple migration is preferred

**Exam answer:** If the question mentions "leaderboard," "session store," "pub/sub," "persistence," or "failover" → Redis. If question just says "simple caching" with no other requirements → either works, but Redis is safer choice.

---

### Q2: Explain the Cache-Aside (Lazy Loading) pattern.

**Answer:** Cache-Aside is the most common caching pattern where the application manages cache interactions explicitly:

**Read path:**
1. Application checks cache for data
2. If cache hit: return cached data immediately (fast path)
3. If cache miss: query the database, store result in cache, return data

**Write path:**
1. Application writes to the database
2. Application invalidates (deletes) the cache entry
3. Next read will be a cache miss, fetching fresh data from DB

**Advantages:**
- Cache only stores what's actually requested (hot data only)
- Resilient: if cache fails, app reads from DB (degraded but functional)
- Lazy: cache populated on demand, not preloaded

**Disadvantages:**
- First request after cache miss is slow (3 operations)
- Potential stale data if DB updates aren't properly invalidated
- Cache stampede: if cache expires under high load, many requests hit DB simultaneously

---

### Q3: What is the difference between Write-Through and Cache-Aside patterns?

**Answer:**
- **Cache-Aside (Lazy):** Cache is populated on READ (cache miss triggers DB query). Application manages cache manually. Cache may have stale data if writes don't invalidate it.
- **Write-Through (Eager):** Cache is populated on WRITE. Every DB write also writes to cache. Reads almost always hit cache.

**Write-Through pros:** Cache always has up-to-date data, read performance is excellent.
**Write-Through cons:** Every write is slower (writes to both DB and cache), cache fills with data that may never be read.

**In practice:** Combine both — Write-Through for critical frequently-read data (like user profiles), Cache-Aside for less critical data. Many applications use Cache-Aside because it's simpler to implement and resilient to cache failures.

---

### Q4: What is a cache eviction policy and which should you use?

**Answer:** Cache eviction policy determines which keys are removed when the cache is full (reaches `maxmemory` limit).

**Most important policies:**
- **allkeys-lru:** Evict the least recently used key from all keys. Best for general-purpose caching where you want frequently-accessed data to stay in cache.
- **volatile-lru:** LRU but only evicts keys with TTL set. Use when some keys must never be evicted (no TTL) and others are cache candidates (have TTL).
- **allkeys-lfu:** Least Frequently Used — evicts keys accessed least often. Better than LRU for workloads with recurring access patterns.
- **noeviction:** Returns error when memory full. Use for session stores where you'd rather fail than silently lose data.

**Recommendation:** `allkeys-lru` for most caching use cases. `noeviction` for session stores where you scale the cache instead of evicting data.

---

### Q5: How does Redis handle persistence and what are the options?

**Answer:** Redis offers two persistence mechanisms:

**RDB (Snapshots):**
- Creates binary snapshots of the dataset at configurable intervals
- Example: Save every 15 minutes if at least 1 key changed
- Pros: Compact file, fast server restarts, good for backups
- Cons: May lose up to N minutes of data (between snapshots)

**AOF (Append Only File):**
- Logs every write command to a file
- Replays on restart to rebuild dataset
- Sync options: always (safest), everysec (usually max 1s data loss), no (OS decides)
- Pros: Much less data loss (1 second max with everysec)
- Cons: Larger files, slower restart

**Best practice:** Enable both. AOF used for recovery (more complete), RDB for backups and faster restarts.

For pure caching (cache-aside pattern), persistence may not be needed — data can be re-populated from the database on restart.

---

### Q6: What is a Redis Sorted Set and what can you build with it?

**Answer:** A Sorted Set stores unique members, each associated with a floating-point score. Members are always sorted by score.

**Operations:**
- `ZADD leaderboard 5000 "player1"` — add/update member with score
- `ZRANGE leaderboard 0 9 WITHSCORES` — get members sorted by score
- `ZREVRANK leaderboard "player1"` — get rank (0-indexed, highest score first)
- `ZINCRBY leaderboard 100 "player1"` — increment score

**What you can build:**
1. **Real-time leaderboards** — Game scores, content rankings
2. **Rate limiting** — Score = timestamp, check how many requests in last N seconds
3. **Priority queues** — Score = priority level
4. **Time-series data** — Score = Unix timestamp, members = events
5. **Geospatial indexes** — Score = encoded lat/lng (Redis GEOADD uses sorted sets internally)

---

### Q7: When would you put ElastiCache between your application and DynamoDB?

**Answer:** ElastiCache (Redis) and DynamoDB serve different purposes, but you'd add ElastiCache in front of DynamoDB when:

1. **Extremely frequent reads of the same items** — DynamoDB is already fast (single-digit ms), but Redis is faster (sub-ms). For items read thousands of times per second, caching saves DynamoDB costs and reduces latency.

2. **Hot items** — If 1% of your DynamoDB items receive 90% of the reads ("celebrity problem"), those hot items create throttling. Cache them in Redis to reduce DynamoDB load.

3. **Expensive aggregations** — If you compute aggregations (counts, sums) from DynamoDB items, cache the result in Redis instead of recomputing.

**Alternative:** **DynamoDB DAX** is purpose-built for this and is API-compatible with DynamoDB (no code changes needed). Use DAX instead of ElastiCache when the primary goal is caching DynamoDB reads with minimal code changes.

Use ElastiCache for DynamoDB when you need more control over caching logic, caching complex derived data, or when using ElastiCache for other purposes as well.

---

### Q8: How would you use ElastiCache to implement session management for a web application?

**Answer:**

**Architecture:**
1. Create Redis ElastiCache cluster in private subnets of the VPC
2. Configure web application to use Redis as session store (e.g., `express-session` with `connect-redis` for Node.js, or `django-redis` for Django)

**How it works:**
1. User logs in → application creates session, stores in Redis: `SET session:abc123 "user_data" EX 3600` (expires in 1 hour)
2. User makes request → application extracts session cookie → `GET session:abc123` from Redis → validates session
3. Session accessed → optionally extend TTL: `EXPIRE session:abc123 3600`
4. User logs out → delete session: `DEL session:abc123`

**Benefits over server-stored sessions:**
- Multiple app servers can validate any session (no sticky sessions needed)
- Sessions survive instance replacement in Auto Scaling
- TTL handles automatic session expiry
- Much faster than database-stored sessions

**HA consideration:** Use Redis with Multi-AZ and automatic failover. On Redis failure, users must re-authenticate (acceptable tradeoff for most apps — use noeviction policy to prevent silent session loss).

---

### Q9: What is the difference between Redis Cluster Mode Enabled and Disabled?

**Answer:**
- **Cluster Mode Disabled:** Data stored on a single shard (one primary + optional replicas). The primary holds all data. Limited by single node memory (up to ~400 GB on largest instance). Replicas are read replicas only. Supports all Redis commands including multi-key operations.

- **Cluster Mode Enabled:** Data sharded across multiple shards using 16,384 hash slots. Each shard is responsible for a range of slots. Scales horizontally to terabytes. Higher aggregate write throughput.

**Tradeoffs of Cluster Mode Enabled:**
- Multi-key operations (MGET, MSET, transactions) must have all keys in the same hash slot — use `{hashtag}` notation to force keys to same slot
- Only database 0 (no multiple databases)
- More complex client configuration

**Choose cluster mode disabled** unless your data or throughput requirements exceed what a single node can provide.

---

### Q10: An application is experiencing very slow database queries that are called thousands of times per second. What caching strategy would you implement?

**Answer:** Implement **Cache-Aside (Lazy Loading)** pattern with ElastiCache Redis:

**Implementation:**
1. Set up Redis ElastiCache cluster in same VPC as application
2. Before executing the slow query, check Redis cache with the query parameters as key
3. On cache miss: execute query, serialize result, store in Redis with appropriate TTL
4. On cache hit: deserialize and return cached result directly

**Key decisions:**
- **TTL:** Set based on data freshness requirements. 5 minutes for product catalog, 30 seconds for inventory levels, never (persist) for reference data.
- **Cache key:** Include all query parameters to avoid returning wrong cached data (`product:category:electronics:page:1`)
- **Invalidation:** When data changes, delete relevant cache keys immediately

**Expected result:** 95%+ queries served from Redis at sub-millisecond latency vs database at 50-100ms. Database load drops proportionally. This typically resolves the performance issue without scaling the database.
