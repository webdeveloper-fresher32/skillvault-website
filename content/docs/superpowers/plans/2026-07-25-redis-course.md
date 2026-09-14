# Redis Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete "Redis" course under `/Users/ganeshpirikirala/Desktop/SkillVault/Redis/`, matching SkillVault's course conventions (12 phases, `Projects/`, `Quick-Reference/`) with one explicit deviation: **no `README.md` file anywhere in this course** — no top-level README, no per-phase README, no Projects README — per `docs/superpowers/specs/2026-07-25-redis-course-design.md`.

**Architecture:** This is a Markdown-only content repository — no code to test, no build system (see CLAUDE.md). "Tests" in this plan are verification steps: confirm each file exists at the right path, follows the repo's naming/numbering conventions, contains the required structural sections (Table of Contents, numbered sections, Interview Q&A), and — critically — that no `README.md` file exists anywhere under `Redis/`. Each phase is one task that creates only numbered lesson files. Content must follow the established explanation style (see Style Guide below), mirroring the structural pattern already proven in the RAG course (`RAG/Phase-01-RAG-Fundamentals/01-What-is-RAG.md`).

**Tech Stack:** Markdown only. Code snippets inside lessons are Python (`redis-py`) for application-integration examples, plus direct `redis-cli` command examples shown inline (Redis's CLI is core to learning the database itself).

---

## Style Guide (apply to every lesson file in every task below)

Every lesson file (`NN-Topic.md`) must follow this structure, modeled on `RAG/Phase-01-RAG-Fundamentals/01-What-is-RAG.md` (a previously-reviewed and approved reference in this same repo):

1. **Title** — `# NN — Topic Name`
2. **One-line description blockquote** — `> A comprehensive reference covering ...`
3. **Table of Contents** — numbered links to every `##` section in the file, with entry TEXT matching each heading's text VERBATIM, including a final "Hands-On Exercises" and "Interview Q&A" section. Do NOT include any fenced-code-block sample heading in the ToC.
4. **Body sections**, each following: **problem** (why this matters, framed as a concrete pain point) → **analogy** (plain-language comparison) → **internal flow** (how it actually works, step by step) → **code example** (Python `redis-py` and/or `redis-cli` commands, runnable/illustrative) → **comparison table** (where relevant) → **common mistakes** (a bulleted "pitfalls" list) → **interview angle** (an inline bolded paragraph, e.g. `**Interview angle:** ...` — NOT its own heading — placed right after Common Mistakes, consistently in every lesson file).
5. **Hands-On Exercises** section — 2-3 small practical exercises the learner can do with just Python + `redis-cli` + the concepts covered so far.
6. **Interview Q&A** section — 3-5 short Q&A pairs specific to that lesson's topic.
7. **Memory hook** — a final one-line callout (e.g. `> 🧠 **Memory hook:** ...`).

Assume the reader knows Python and basic programming, but has never used Redis or any caching database before. Explain any non-trivial Python construct (list comprehensions, lambda-as-sort-key, tuple unpacking, dict/set idioms, context managers, etc.) briefly inline the first time it's used — a prior course (RAG) had several review rounds catch missed idiom explanations, so double-check this carefully in every lesson.

**CRITICAL — command/API accuracy.** The RAG course's review process repeatedly caught fabricated-sounding claims about what code actually does/outputs, and one lesson queried an empty vector store before populating it. Apply the same rigor here:
- Every `redis-cli` command and `redis-py` snippet must reflect real Redis behavior — verify command names, argument order, and return value shapes against actual Redis semantics (e.g. `SET`/`GET` return values, `EXPIRE` returns 1/0, `ZADD` return count of new elements added, `HGETALL` returns a dict-like structure in `redis-py`).
- Any code example that reads from a key must ensure that key was set/populated earlier in the same snippet (or explicitly noted as reusing a previously-populated example) — never show a `GET`/`HGETALL`/etc. against a key that was never created in the lesson's own narrative.
- If uncertain of an exact detail, describe conceptually rather than fabricating a precise-but-wrong example.

**Cross-reference accuracy:** this is a 12-phase course. When referencing other phases by number, use EXACTLY this mapping: 1=Redis Fundamentals, 2=Core Data Structures, 3=Keys-Expiration-and-Eviction, 4=Advanced Data Structures, 5=Persistence, 6=Replication-and-High-Availability, 7=Redis Cluster, 8=Transactions-and-Scripting, 9=Pub-Sub-and-Messaging, 10=Caching-Patterns-and-Strategies, 11=Redis-with-Application-Code, 12=Production-Patterns-and-Security.

---

## Task 1: Scaffold Course Skeleton

**Files:**
- Create: `Redis/Phase-01-Redis-Fundamentals/` through `Redis/Phase-12-Production-Patterns-and-Security/` (empty directories)
- Create: `Redis/Projects/` (empty directory)
- Create: `Redis/Quick-Reference/` (empty directory)

- [ ] **Step 1: Create the directory structure**

Run:
```bash
cd /Users/ganeshpirikirala/Desktop/SkillVault
mkdir -p Redis/Phase-01-Redis-Fundamentals \
         Redis/Phase-02-Core-Data-Structures \
         Redis/Phase-03-Keys-Expiration-and-Eviction \
         Redis/Phase-04-Advanced-Data-Structures \
         Redis/Phase-05-Persistence \
         Redis/Phase-06-Replication-and-High-Availability \
         Redis/Phase-07-Redis-Cluster \
         Redis/Phase-08-Transactions-and-Scripting \
         Redis/Phase-09-Pub-Sub-and-Messaging \
         Redis/Phase-10-Caching-Patterns-and-Strategies \
         Redis/Phase-11-Redis-with-Application-Code \
         Redis/Phase-12-Production-Patterns-and-Security \
         Redis/Projects \
         Redis/Quick-Reference
```

- [ ] **Step 2: Verify structure**

Run: `find Redis -maxdepth 1 -type d | sort`
Expected: 15 lines — `Redis`, 12 `Phase-NN-*` dirs, `Projects`, `Quick-Reference`.

- [ ] **Step 3: Commit** (only if directories contain files by this point — empty dirs aren't tracked by git; this step is a no-op until Task 2 adds files, skip committing here)

---

## Task 2: Phase 01 — Redis Fundamentals

**Files:**
- Create: `Redis/Phase-01-Redis-Fundamentals/01-What-is-Redis.md`
- Create: `Redis/Phase-01-Redis-Fundamentals/02-Installation-and-Redis-CLI.md`
- Create: `Redis/Phase-01-Redis-Fundamentals/03-Connecting-from-Python.md`

**No `README.md` in this phase folder — only these 3 numbered lesson files.**

- [ ] **Step 1: Write `01-What-is-Redis.md`**

Cover: the problem (traditional disk-backed databases are too slow for read-heavy, latency-sensitive workloads — every query round-trips through disk I/O); analogy (a librarian who keeps the 20 most-requested books on their desk instead of walking to the stacks every time — an in-memory store as a "desk" vs disk as "the stacks"); what Redis is (an in-memory data structure store, used as a database, cache, and message broker); the single-threaded event-loop model at a conceptual level (why single-threaded doesn't mean slow — no lock contention, predictable latency) with a simple diagram in a code fence; Redis vs traditional RDBMS vs a simple in-process cache (e.g. a Python dict) comparison table (persistence, network access, data structures, use cases); common misconceptions (Redis isn't just a cache, Redis isn't "in-memory only" — persistence exists, covered in Phase 5); interview angle; hands-on exercises; interview Q&A; memory hook. Follow the full Style Guide above.

- [ ] **Step 2: Write `02-Installation-and-Redis-CLI.md`**

Cover: the problem (before writing any code, you need a running Redis instance and a way to poke at it interactively); analogy (a REPL/terminal for a database, the same way `python` gives you an interactive shell for Python); internal flow (installing Redis locally — via Docker as the recommended zero-friction path, or a native install — and starting `redis-server`); code example: `docker run -d -p 6379:6379 redis`, then connecting via `redis-cli`, running `PING`, `SET foo bar`, `GET foo`, `DEL foo` and showing real expected output for each; a table of essential `redis-cli` flags/commands (`redis-cli -h`, `redis-cli MONITOR`, `redis-cli --scan`); common mistakes (forgetting Redis has no default password in a fresh install — a security point deferred in depth to Phase 12, but flagged here as "don't expose this to the internet as-is"); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `03-Connecting-from-Python.md`**

Cover: the problem (interactive `redis-cli` is great for exploration, but real applications need to talk to Redis from code); analogy (the CLI is like a phone call, a client library is like an API you build actual features on top of); internal flow (installing `redis-py`, creating a `Redis` client instance, `decode_responses=True` and why it matters for getting `str` back instead of `bytes`); code example: `import redis`, `r = redis.Redis(host="localhost", port=6379, decode_responses=True)`, then `r.set("foo", "bar")`, `r.get("foo")` printing the real return value, `r.ping()`; a note on connection pooling deferred to Phase 11's deeper application-integration coverage; common mistakes (forgetting `decode_responses=True` and being confused by `b'bar'` output, not handling `redis.exceptions.ConnectionError` when Redis isn't running); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Verify structure**

Run: `for f in Redis/Phase-01-Redis-Fundamentals/*.md; do echo "== $f =="; grep -c "^## " "$f"; grep -l "Interview Q&A" "$f"; grep -l "Memory hook" "$f"; done`
Expected: each of the 3 files reports at least 5 `##` sections and matches on both `Interview Q&A` and `Memory hook`.

Run: `ls Redis/Phase-01-Redis-Fundamentals/README.md 2>&1`
Expected: `No such file or directory` (confirms no README was created).

- [ ] **Step 5: Commit**

```bash
git add Redis/Phase-01-Redis-Fundamentals
git commit -m "Add Redis Phase 01: Redis Fundamentals"
```

---

## Task 3: Phase 02 — Core Data Structures

**Files:**
- Create: `Redis/Phase-02-Core-Data-Structures/01-Strings.md`
- Create: `Redis/Phase-02-Core-Data-Structures/02-Lists-and-Hashes.md`
- Create: `Redis/Phase-02-Core-Data-Structures/03-Sets-and-Sorted-Sets.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Strings.md`**

Cover: the problem (the simplest possible Redis use case — storing and retrieving a single value by key — and why even this simple case matters, e.g. atomic counters); analogy (a labeled locker: one key, one value, nothing nested); internal flow (`SET`/`GET`, `SETEX` for value+TTL in one call, `INCR`/`DECR`/`INCRBY` for atomic counters, `MSET`/`MGET` for batching); code example: `redis-cli` and `redis-py` side by side — `SET page:views 0`, `INCR page:views` three times, `GET page:views` showing `"3"`; a note on why `INCR` is atomic and race-condition-safe compared to `GET` then `SET` in application code; common mistakes (using `GET`+`SET` in app code to implement a counter instead of `INCR`, forgetting Redis Strings can hold binary data up to 512MB, not just short text); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Lists-and-Hashes.md`**

Cover: the problem (sometimes you need an ordered sequence of values, or a single object with multiple named fields — a raw String can't model either cleanly); analogy (a List as a stack of trays in a cafeteria line — push/pop from either end; a Hash as a single filing folder with labeled tabs inside); internal flow (Lists: `LPUSH`/`RPUSH`/`LRANGE`/`LPOP`/`RPOP`, common use as a queue or recent-activity feed; Hashes: `HSET`/`HGET`/`HGETALL`/`HDEL`, common use as a compact way to store an object's fields under one key instead of many separate String keys); code example: building a simple "recent searches" list with `LPUSH`+`LTRIM` to cap its size, and a user-profile Hash with `HSET user:1001 name "Alice" email "alice@example.com"` then `HGETALL user:1001`; comparison table (List vs Hash vs multiple String keys: when each is the right fit); common mistakes (using a List for a large queue without ever trimming it — unbounded memory growth; using many separate String keys for one logical object instead of one Hash, which wastes memory on per-key overhead); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `03-Sets-and-Sorted-Sets.md`**

Cover: the problem (sometimes you need uniqueness — no duplicates — or you need uniqueness AND an ordering/score, like a leaderboard); analogy (a Set as a guest list where nobody's name appears twice; a Sorted Set as that same guest list but now sorted by how many points each guest has); internal flow (Sets: `SADD`/`SMEMBERS`/`SISMEMBER`/set operations `SINTER`/`SUNION`/`SDIFF`; Sorted Sets: `ZADD`/`ZRANGE`/`ZRANGEBYSCORE`/`ZSCORE`/`ZINCRBY`); code example: a tag system using `SADD post:123:tags "redis" "database" "caching"` then `SISMEMBER`, and a leaderboard using `ZADD leaderboard 100 "alice"` `ZADD leaderboard 250 "bob"` then `ZREVRANGE leaderboard 0 -1 WITHSCORES` showing bob ranked first; comparison table (Set vs Sorted Set vs List: uniqueness, ordering, typical use cases); common mistakes (using a List where uniqueness is actually required — allows silent duplicates; forgetting Sorted Set scores are floats, not just integers, useful for tie-breaking with timestamps); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Verify structure**

Run: `for f in Redis/Phase-02-Core-Data-Structures/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Redis/Phase-02-Core-Data-Structures/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 5: Commit**

```bash
git add Redis/Phase-02-Core-Data-Structures
git commit -m "Add Redis Phase 02: Core Data Structures"
```

---

## Task 4: Phase 03 — Keys, Expiration & Eviction

**Files:**
- Create: `Redis/Phase-03-Keys-Expiration-and-Eviction/01-Key-Naming-and-TTL.md`
- Create: `Redis/Phase-03-Keys-Expiration-and-Eviction/02-Eviction-Policies-and-Maxmemory.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Key-Naming-and-TTL.md`**

Cover: the problem (with everything living under flat string keys, a large app can turn into an unmanageable mess of unrelated keys colliding or becoming impossible to reason about); analogy (a filing system with consistent folder-naming conventions vs a junk drawer); internal flow (colon-delimited key naming convention, e.g. `user:1001:profile`, `session:abc123`; `EXPIRE`/`PEXPIRE`/`TTL`/`PTTL`/`PERSIST`; setting TTL at creation time with `SET key value EX 3600` or `SETEX`); code example: setting a session key with a 30-minute TTL, checking `TTL session:abc123` immediately after (showing ~1800), and demonstrating `PERSIST` removing the expiration; common mistakes (inconsistent key naming making later debugging/monitoring painful, forgetting that `SET` without `KEEPTTL` on an existing key wipes its expiration); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Eviction-Policies-and-Maxmemory.md`**

Cover: the problem (memory is finite — what happens when Redis is used as a cache and runs out of configured memory?); analogy (a fridge that's full — do you refuse new groceries, or throw out the oldest/least-used item to make room?); internal flow (`maxmemory` configuration, eviction policies: `noeviction` (errors on writes when full), `allkeys-lru`/`volatile-lru` (evict least-recently-used), `allkeys-lfu`/`volatile-lfu` (evict least-frequently-used), `volatile-ttl` (evict soonest-to-expire first), `allkeys-random`/`volatile-random`); code example: `CONFIG SET maxmemory 100mb` and `CONFIG SET maxmemory-policy allkeys-lru`, then `CONFIG GET maxmemory-policy` to confirm; a comparison table of all 6 eviction policies (what it evicts, when it's appropriate); common mistakes (leaving the default `noeviction` policy on a Redis instance used purely as a cache — writes start failing under memory pressure instead of gracefully evicting; choosing `allkeys-*` when some keys have no TTL and should never be evicted, meaning `volatile-*` was the safer choice); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Redis/Phase-03-Keys-Expiration-and-Eviction/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Redis/Phase-03-Keys-Expiration-and-Eviction/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Redis/Phase-03-Keys-Expiration-and-Eviction
git commit -m "Add Redis Phase 03: Keys, Expiration and Eviction"
```

---

## Task 5: Phase 04 — Advanced Data Structures

**Files:**
- Create: `Redis/Phase-04-Advanced-Data-Structures/01-Bitmaps-and-HyperLogLog.md`
- Create: `Redis/Phase-04-Advanced-Data-Structures/02-Geospatial-Indexes.md`
- Create: `Redis/Phase-04-Advanced-Data-Structures/03-Streams.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Bitmaps-and-HyperLogLog.md`**

Cover the problem (some questions — "was user X active on day Y" across millions of users, or "how many unique visitors" across billions of events — would be wildly memory-expensive with normal data structures); analogy (a Bitmap as a punch card with one hole per day marking attendance; HyperLogLog as a bouncer's rough head-count of a huge crowd — approximate, but shockingly accurate for the memory it uses); internal flow (Bitmaps: `SETBIT`/`GETBIT`/`BITCOUNT` for compact boolean flags per position, e.g. daily-active-user tracking; HyperLogLog: `PFADD`/`PFCOUNT` for approximate distinct-count with ~0.81% standard error using a small fixed amount of memory regardless of cardinality); code example: tracking daily active users with `SETBIT dau:2026-07-25 1001 1` then `BITCOUNT dau:2026-07-25`, and approximate unique-visitor counting with `PFADD visitors:2026-07-25 "user1" "user2" "user1"` then `PFCOUNT visitors:2026-07-25` showing `2`; common mistakes (using HyperLogLog when you need exact counts — it's explicitly approximate; using a Bitmap for sparse, huge key-spaces where a Set would actually use less memory); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Geospatial-Indexes.md`**

Cover the problem ("find all coffee shops within 2km of me" requires geographic distance calculations that plain Sorted Sets don't do out of the box); analogy (a Sorted Set is secretly what's under the hood — Redis encodes latitude/longitude into a single sortable score using a geohash, so this phase is really "Sorted Sets with a geography superpower"); internal flow (`GEOADD` to store a location, `GEOSEARCH`/`GEODIST`/`GEOPOS` to query); code example: `GEOADD shops -122.4194 37.7749 "shop:sf-downtown"`, then `GEOSEARCH shops FROMLONLAT -122.42 37.78 BYRADIUS 5 km ASC` showing the shop returned within range; common mistakes (mixing up longitude/latitude argument order — Redis expects longitude first, the opposite of how many people say "lat/long" out loud); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `03-Streams.md`**

Cover the problem (an ever-growing, ordered, append-only log of events — like sensor readings or an activity feed — that multiple independent consumers need to read at their own pace, with the ability to replay history); analogy (a shared logbook where every entry gets a timestamp-based ID, and multiple readers can each bookmark their own place without erasing what others haven't read yet); internal flow (`XADD` to append an entry with an auto-generated ID, `XRANGE`/`XREAD` to read entries, consumer groups via `XGROUP CREATE`/`XREADGROUP` for coordinated multi-consumer processing, `XACK` to acknowledge processing); code example: `XADD sensor:temp * reading 22.5`, `XADD sensor:temp * reading 23.1`, then `XRANGE sensor:temp - +` showing both entries with their auto-generated IDs; a brief forward-reference noting Streams as a durable Pub/Sub alternative, covered in depth in Phase 9; common mistakes (using a List instead of a Stream for a multi-consumer workload — Lists have no concept of consumer groups or acknowledgment, so consumers would race and steal each other's items); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Verify structure**

Run: `for f in Redis/Phase-04-Advanced-Data-Structures/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Redis/Phase-04-Advanced-Data-Structures/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 5: Commit**

```bash
git add Redis/Phase-04-Advanced-Data-Structures
git commit -m "Add Redis Phase 04: Advanced Data Structures"
```

---

## Task 6: Phase 05 — Persistence

**Files:**
- Create: `Redis/Phase-05-Persistence/01-RDB-Snapshotting.md`
- Create: `Redis/Phase-05-Persistence/02-AOF-and-Hybrid-Persistence.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-RDB-Snapshotting.md`**

Cover the problem (Redis is in-memory — if the process restarts or crashes, everything is gone unless something is written to disk); analogy (a photograph of the room at a specific moment — fast to take, but anything that happened after the photo is lost if the room changes before the next one); internal flow (RDB: point-in-time binary snapshot of the whole dataset, triggered by `SAVE` (blocking) or `BGSAVE` (non-blocking, forks a child process), configurable `save` rules in `redis.conf` like "save if 100 keys changed in 60 seconds"); code example: `redis-cli BGSAVE`, then checking `LASTSAVE` (returns a Unix timestamp) to confirm it completed; a note on the "fork" mechanism at a conceptual level (copy-on-write means the child process can safely write a consistent snapshot while the parent keeps serving writes); common mistakes (relying solely on infrequent RDB snapshots for a workload that can't tolerate losing the last few minutes of writes on a crash — this is exactly the gap AOF closes, covered next); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-AOF-and-Hybrid-Persistence.md`**

Cover the problem (RDB snapshots only capture data at fixed intervals — a crash between snapshots loses everything written since); analogy (RDB is a photograph; AOF is a security camera's continuous recording — a log of every write command as it happens, replayable from the start to reconstruct exact state); internal flow (AOF: `appendonly yes`, every write command appended to a log file, `appendfsync` policies `always`/`everysec`/`no` trading durability for performance, AOF rewrite/compaction to keep the log from growing forever, hybrid persistence combining an RDB preamble with an AOF suffix for faster restarts); code example: `CONFIG SET appendonly yes`, showing the growing `appendonly.aof` file conceptually, and `BGREWRITEAOF` to compact it; a comparison table (RDB vs AOF vs hybrid: durability, restart speed, disk usage, performance overhead); common mistakes (setting `appendfsync always` without understanding its real performance cost, assuming AOF alone means zero data loss when `everysec` — the common default — can still lose up to 1 second of writes); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Redis/Phase-05-Persistence/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Redis/Phase-05-Persistence/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Redis/Phase-05-Persistence
git commit -m "Add Redis Phase 05: Persistence"
```

---

## Task 7: Phase 06 — Replication & High Availability

**Files:**
- Create: `Redis/Phase-06-Replication-and-High-Availability/01-Master-Replica-Replication.md`
- Create: `Redis/Phase-06-Replication-and-High-Availability/02-Redis-Sentinel.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Master-Replica-Replication.md`**

Cover the problem (a single Redis instance is a single point of failure, and all reads/writes hit one process — no way to scale reads or survive that one machine going down); analogy (a manager (master) who makes all the decisions, and assistants (replicas) who each keep an up-to-date copy of those decisions so they can answer questions themselves without bothering the manager); internal flow (asynchronous replication: a replica connects to a master with `REPLICAOF <host> <port>`, receives an initial RDB-based sync, then a continuous stream of write commands; reads can be served from replicas to scale read throughput, writes still go to the master only); code example: `redis-cli -p 6380 REPLICAOF 127.0.0.1 6379` to make one instance a replica of another, then `INFO replication` on both to confirm `role:master`/`role:slave` and sync status; common mistakes (writing to a replica directly — replicas are read-only by default and this will error; not accounting for replication lag, meaning a read right after a write to the master might briefly not appear on a replica yet); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Redis-Sentinel.md`**

Cover the problem (replication gives you copies of the data, but if the master dies, something still has to notice and promote a replica — manually doing this at 3am during an incident is exactly the kind of thing that should be automated); analogy (Sentinel as an on-call team that watches the manager's health and, if the manager becomes unreachable, runs an election among the assistants and promotes one to be the new manager — informing everyone else of the change); internal flow (Sentinel processes monitor masters and replicas, detect failure via quorum agreement (multiple Sentinels must agree the master is actually down, not just unreachable to one of them), automatically perform failover by promoting a replica and reconfiguring the rest); code example: a minimal `sentinel.conf` snippet (`sentinel monitor mymaster 127.0.0.1 6379 2` — quorum of 2), and `redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster` to query the current master; a note on why quorum matters (avoiding a "split-brain" false failover from one Sentinel's network hiccup); common mistakes (running a single Sentinel — it can't reach quorum with itself, defeating the purpose; forgetting client applications need Sentinel-aware connection logic to find the current master after a failover, not a hardcoded address); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Redis/Phase-06-Replication-and-High-Availability/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Redis/Phase-06-Replication-and-High-Availability/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Redis/Phase-06-Replication-and-High-Availability
git commit -m "Add Redis Phase 06: Replication and High Availability"
```

---

## Task 8: Phase 07 — Redis Cluster

**Files:**
- Create: `Redis/Phase-07-Redis-Cluster/01-Sharding-and-Hash-Slots.md`
- Create: `Redis/Phase-07-Redis-Cluster/02-Cluster-Setup-and-Client-Redirection.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Sharding-and-Hash-Slots.md`**

Cover the problem (replication solves read scaling and availability, but every master still holds the entire dataset in memory — what happens when your data is simply too big for one machine's RAM?); analogy (splitting one giant library into several branch libraries, each responsible for a specific range of subjects, with a master directory telling you which branch has what you're looking for); internal flow (Redis Cluster divides the keyspace into 16384 fixed hash slots, each master node owns a subset of slots, a key's slot is computed via `CRC16(key) mod 16384`, `{hashtag}` syntax to force related keys into the same slot for multi-key operations); code example: `CLUSTER KEYSLOT mykey` showing which slot a key hashes to, and `CLUSTER NODES` showing which node owns which slot range; a comparison table (single instance vs Sentinel-HA vs Cluster: what problem each solves — availability alone vs availability + horizontal scaling); common mistakes (running a multi-key operation across keys in different slots without hash tags — Redis Cluster will reject it since it can't guarantee atomicity across nodes); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Cluster-Setup-and-Client-Redirection.md`**

Cover the problem (once slots are spread across multiple nodes, how does a client know which node to talk to for a given key, and what happens when slots get reshuffled?); analogy (calling a large company's main switchboard and getting redirected to the right department — except the switchboard also tells you the department's number so next time you call them directly); internal flow (a cluster-aware client caches the slot-to-node mapping; if it guesses wrong, the node responds with a `MOVED` redirect (permanent — update your mapping) or `ASK` redirect (temporary, mid-resharding — try again with an `ASKING` flag first); resharding moves slots (and their keys) between nodes live, which is why the temporary `ASK` case exists); code example: a conceptual `redis-cli -c` (cluster mode) session showing a `-> Redirected to slot ...` message when the CLI itself gets redirected; common mistakes (using a non-cluster-aware client library against a cluster and having every request silently fail or behave unpredictably; assuming Redis Cluster gives you more capacity for free — it also multiplies operational complexity, which is why Phase 12 revisits "do you actually need clustering?"); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Redis/Phase-07-Redis-Cluster/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Redis/Phase-07-Redis-Cluster/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Redis/Phase-07-Redis-Cluster
git commit -m "Add Redis Phase 07: Redis Cluster"
```

---

## Task 9: Phase 08 — Transactions & Scripting

**Files:**
- Create: `Redis/Phase-08-Transactions-and-Scripting/01-Transactions-with-MULTI-EXEC.md`
- Create: `Redis/Phase-08-Transactions-and-Scripting/02-Lua-Scripting-and-Pipelining.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Transactions-with-MULTI-EXEC.md`**

Cover the problem (some operations need multiple commands to happen together, with no other client's commands interleaved in between — e.g. moving points from one user's balance to another's); analogy (queuing up a full order at a counter and having it all rung up in one atomic transaction, rather than each item being processed separately with other customers' orders potentially cutting in between); internal flow (`MULTI` starts queuing commands, `EXEC` runs them all atomically as a single unit, `DISCARD` cancels a queued transaction, `WATCH` for optimistic locking — abort the transaction if a watched key changed before `EXEC`); code example: `MULTI`, `DECRBY balance:alice 50`, `INCRBY balance:bob 50`, `EXEC` — showing both commands succeed together, then a `WATCH`-based example where a concurrent modification causes `EXEC` to return `nil` (aborted); common mistakes (assuming `MULTI`/`EXEC` gives you rollback-on-error like a SQL transaction — it doesn't; if one queued command fails at runtime, the others in the same `EXEC` still execute); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Lua-Scripting-and-Pipelining.md`**

Cover the problem (some atomic multi-step logic is too complex or conditional for `MULTI`/`EXEC`'s "queue blindly, no branching" model — e.g. "only decrement if balance is sufficient"); analogy (`MULTI`/`EXEC` is like handing someone a pre-written shopping list to execute exactly as written; Lua scripting is like giving them actual decision-making authority — "if we're out of milk, get oat milk instead" — all still happening as one atomic, uninterruptible unit on the server); internal flow (`EVAL` runs a Lua script server-side atomically, `KEYS`/`ARGV` pass parameters in cleanly instead of string-concatenating them into the script, `EVALSHA` runs a previously-cached script by its SHA1 hash to avoid re-sending the script body every call; pipelining as a separate, distinct optimization — batching multiple independent commands into one network round-trip without atomicity guarantees, purely for reducing latency); code example: an `EVAL` script implementing "decrement balance only if sufficient funds" atomically, and a `redis-py` pipelining example (`pipe = r.pipeline()`, several queued commands, `pipe.execute()`) showing it returns a list of results in order; a comparison table (Transactions vs Lua scripting vs Pipelining: atomicity, conditional logic support, purpose); common mistakes (writing a Lua script with unbounded loops or expensive operations — since it runs atomically and single-threaded, a slow script blocks every other client; confusing pipelining's latency benefit with the atomicity that only `MULTI`/`EXEC` or Lua actually provide); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Redis/Phase-08-Transactions-and-Scripting/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Redis/Phase-08-Transactions-and-Scripting/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Redis/Phase-08-Transactions-and-Scripting
git commit -m "Add Redis Phase 08: Transactions and Scripting"
```

---

## Task 10: Phase 09 — Pub/Sub & Messaging

**Files:**
- Create: `Redis/Phase-09-Pub-Sub-and-Messaging/01-Pub-Sub-Basics.md`
- Create: `Redis/Phase-09-Pub-Sub-and-Messaging/02-Streams-as-a-Message-Queue.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Pub-Sub-Basics.md`**

Cover the problem (sometimes many parts of a system need to react instantly to an event as it happens — a chat message, a live notification — without polling a database repeatedly); analogy (a radio broadcast: the station (publisher) transmits, anyone with a radio tuned to that frequency (subscriber) hears it live — but if your radio was off, you missed it, there's no replay); internal flow (`PUBLISH channel message`, `SUBSCRIBE channel`, `PSUBSCRIBE pattern*` for pattern-based subscriptions, at-most-once delivery — no persistence, no history, no acknowledgment; a subscribed client blocks in subscribe mode and can't run other commands on that same connection); code example: two `redis-cli` sessions side by side — one running `SUBSCRIBE notifications`, the other running `PUBLISH notifications "new message"` — showing the subscriber receives it instantly, and a `redis-py` example using `pubsub()` and `listen()`; common mistakes (assuming a subscriber that was offline when a message was published will somehow receive it later — Pub/Sub has zero persistence, this is exactly the gap Streams close, covered next); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Streams-as-a-Message-Queue.md`**

Cover the problem (Pub/Sub's fire-and-forget model is fine for live notifications nobody needs to guarantee, but a real message queue — order processing, task queues — needs delivery guarantees: don't lose messages if a consumer was briefly down, and don't let two consumers grab the same task); analogy (Pub/Sub is a live radio broadcast; a Stream with consumer groups is a shared work ticket queue at a help desk — tickets wait until someone picks them up, and once picked up, a ticket isn't handed to two people at once); internal flow (revisiting `XADD` from Phase 4, now with `XGROUP CREATE stream group $ MKSTREAM` to create a consumer group, `XREADGROUP GROUP group consumer COUNT n STREAMS stream >` to have a named consumer claim new entries, `XACK` to mark an entry as successfully processed, `XPENDING` to see unacknowledged entries — e.g. from a consumer that crashed mid-processing); code example: creating a consumer group on a `tasks` stream, two different named consumers each calling `XREADGROUP` and getting different entries (not duplicates), and one entry being `XACK`'d; a comparison table (Pub/Sub vs Streams-with-consumer-groups: persistence, delivery guarantees, replay capability, typical use case); common mistakes (choosing Pub/Sub for a workload that actually needs guaranteed delivery — an offline consumer simply loses those messages forever; forgetting to `XACK` processed entries, causing them to sit forever in the pending entries list); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Redis/Phase-09-Pub-Sub-and-Messaging/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Redis/Phase-09-Pub-Sub-and-Messaging/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Redis/Phase-09-Pub-Sub-and-Messaging
git commit -m "Add Redis Phase 09: Pub/Sub and Messaging"
```

---

## Task 11: Phase 10 — Caching Patterns & Strategies

**Files:**
- Create: `Redis/Phase-10-Caching-Patterns-and-Strategies/01-Cache-Aside-Write-Through-Write-Behind.md`
- Create: `Redis/Phase-10-Caching-Patterns-and-Strategies/02-Invalidation-and-Cache-Stampede-Prevention.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Cache-Aside-Write-Through-Write-Behind.md`**

Cover the problem (Redis in front of a slower database is the single most common real-world use case, but there are several genuinely different ways to wire the cache and the database together, each with different consistency/performance tradeoffs); analogy (cache-aside is a student who checks their own notes first and only asks the teacher if the notes don't have the answer, writing the new answer into their notes afterward; write-through is a student who always tells the teacher immediately whenever they update their notes so the teacher's records stay current; write-behind is a student who updates their own notes now and promises to tell the teacher later, in a batch); internal flow (cache-aside/lazy-loading: application checks cache, on miss reads from DB and populates cache; write-through: writes go to cache and DB together, synchronously; write-behind/write-back: writes go to cache immediately and are asynchronously flushed to the DB later); code example: a Python function implementing cache-aside — check `r.get(key)`, on `None` fall through to a (simulated) slow DB fetch function, then `r.set(key, value, ex=300)` before returning; a comparison table (cache-aside vs write-through vs write-behind: read path, write path, consistency risk, complexity); common mistakes (using write-behind without understanding its data-loss risk if the cache crashes before flushing to the DB; using cache-aside but forgetting to set a TTL at all, so a stale cached value can live forever even after the DB changes); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Invalidation-and-Cache-Stampede-Prevention.md`**

Cover the problem ("there are only two hard things in computer science: cache invalidation and naming things" — a cached value going stale, or a huge number of clients all missing the cache at the exact same moment and hammering the DB simultaneously, are both real production incidents); analogy (cache stampede is a crowd all rushing the same single open checkout lane the instant the "closed" sign comes down, instead of trickling in gradually); internal flow (invalidation strategies: TTL-based expiration, explicit `DEL` on write, versioned/keyed-by-hash cache keys that naturally "invalidate" by no longer being looked up; cache stampede prevention: jittered TTLs (randomizing expiration slightly so many keys don't expire at the exact same instant), a distributed lock via `SET key value NX EX ttl` so only one client repopulates a hot key while others wait or serve slightly-stale data, probabilistic early expiration (recompute slightly before actual expiry, weighted by how expensive the recompute is)); code example: a `redis-py` snippet using `SET lock:key 1 NX EX 10` to acquire a short-lived lock before repopulating an expensive cache entry, with other callers falling back to a stale value or a short wait instead of all hitting the DB at once; common mistakes (setting every cache entry's TTL to the exact same round number like `3600`, guaranteeing a stampede at the top of every hour; forgetting to release/expire a stampede-prevention lock, permanently blocking future repopulation attempts); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Redis/Phase-10-Caching-Patterns-and-Strategies/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Redis/Phase-10-Caching-Patterns-and-Strategies/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Redis/Phase-10-Caching-Patterns-and-Strategies
git commit -m "Add Redis Phase 10: Caching Patterns and Strategies"
```

---

## Task 12: Phase 11 — Redis with Application Code

**Files:**
- Create: `Redis/Phase-11-Redis-with-Application-Code/01-Connection-Pooling-and-redis-py.md`
- Create: `Redis/Phase-11-Redis-with-Application-Code/02-Serialization-and-Error-Handling.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Connection-Pooling-and-redis-py.md`**

Cover the problem (Phase 1 showed a single `redis.Redis(...)` client — fine for a script, but a real web application handling many concurrent requests can't afford to open a brand-new TCP connection to Redis on every single request); analogy (a taxi rank with a fixed number of waiting cars, shared by everyone who needs a ride, instead of every passenger buying and parking their own personal car just to make one trip); internal flow (`redis.ConnectionPool`, creating one pool at application startup and having every `redis.Redis(connection_pool=pool)` client borrow connections from it, `max_connections` sizing); code example: `pool = redis.ConnectionPool(host="localhost", port=6379, max_connections=20, decode_responses=True)`, then `r = redis.Redis(connection_pool=pool)` used from multiple simulated "requests" (simple sequential calls in the example, with a note that this is exactly what happens under the hood in a real multi-threaded/async web server); common mistakes (creating a brand-new `redis.Redis(...)` instance per request/function call instead of sharing one pool — this defeats the purpose and can exhaust available connections under load); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Serialization-and-Error-Handling.md`**

Cover the problem (Redis Strings/Hashes store text and bytes — but application code constantly needs to store real Python objects like dicts and lists, and network calls to any external service can fail); analogy (mailing a package: you can't just throw a couch through a mail slot, you have to disassemble/package it (serialize) first, and ship it (send over the network) knowing the delivery truck might break down (network error) along the way); internal flow (serialization options: `json.dumps`/`json.loads` for portable, human-readable, cross-language-safe values; `pickle` for arbitrary Python objects but Python-only and a security risk if deserializing untrusted data; when a Hash's flat field structure is actually preferable to serializing a whole object into one String field; catching `redis.exceptions.ConnectionError`/`TimeoutError` and implementing a simple retry with backoff); code example: storing a Python dict as a cache value via `r.set(key, json.dumps(value))` and reading it back via `json.loads(r.get(key))`, plus a small retry-with-backoff wrapper function catching `redis.exceptions.ConnectionError`; common mistakes (using `pickle` to deserialize data from a source you don't fully control — a real security vulnerability, arbitrary code execution; not handling the case where `r.get(key)` returns `None` before passing it to `json.loads`, which raises on `None`); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Redis/Phase-11-Redis-with-Application-Code/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Redis/Phase-11-Redis-with-Application-Code/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Redis/Phase-11-Redis-with-Application-Code
git commit -m "Add Redis Phase 11: Redis with Application Code"
```

---

## Task 13: Phase 12 — Production Patterns & Security

**Files:**
- Create: `Redis/Phase-12-Production-Patterns-and-Security/01-Monitoring-and-Common-Failure-Modes.md`
- Create: `Redis/Phase-12-Production-Patterns-and-Security/02-Security-ACLs-and-When-to-Use-Managed-Redis.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Monitoring-and-Common-Failure-Modes.md`**

Cover the problem (a Redis instance that "seems fine" can be one big key or one runaway memory leak away from an outage, and by the time it's visibly broken, it's already an incident); analogy (a car's dashboard warning lights — you want to notice the oil-pressure light well before the engine actually seizes, not after); internal flow (key metrics to monitor: memory usage vs `maxmemory`, `keyspace_hits`/`keyspace_misses` for hit ratio, `connected_clients`, the slow log for identifying expensive commands via `SLOWLOG GET`); code example: `redis-cli INFO memory` and `redis-cli INFO stats` showing real fields (`used_memory_human`, `keyspace_hits`, `keyspace_misses`), then computing a hit ratio from those two numbers, and `SLOWLOG GET 10` to see the 10 most recent slow commands; a table of common production failure modes (a single enormous key/value blocking the single-threaded event loop while Redis processes it, unbounded key growth from a missing eviction policy revisited from Phase 3, a hot key overwhelming one node in a cluster from Phase 7); common mistakes (only monitoring uptime/CPU and never watching the hit ratio or slow log, so a cache that's quietly become ineffective looks "healthy" the whole time); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Security-ACLs-and-When-to-Use-Managed-Redis.md`**

Cover the problem (a fresh Redis install, by default, has no password and will happily accept commands from anyone who can reach it on the network — a real, commonly-exploited misconfiguration); analogy (a house with no lock on the front door — fine while it's just you in a private room, a real liability the moment it's reachable from anywhere else); internal flow (`requirepass`/`AUTH` for basic password protection, Redis ACLs (`ACL SETUSER`) for fine-grained per-user command and key-pattern permissions beyond a single shared password, TLS for encrypting traffic in transit, binding Redis to trusted network interfaces only); code example: `ACL SETUSER readonly-app on >somepassword ~cached:* +get +mget -@all` creating a restricted user who can only run `GET`/`MGET` on keys prefixed `cached:`, then `ACL WHOAMI`/`ACL LIST` to inspect it; a closing decision-guidance section (self-managed Redis vs a managed offering like Redis Cloud/Enterprise: operational burden of patching/monitoring/failover yourself vs paying for someone else to run it, described qualitatively since exact pricing/tiers change over time) tying back to Phase 6/7's replication/clustering operational complexity; common mistakes (leaving `requirepass` unset on any instance reachable outside `localhost`, granting a service account far broader ACL permissions than it actually needs "just in case"); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Redis/Phase-12-Production-Patterns-and-Security/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Redis/Phase-12-Production-Patterns-and-Security/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Redis/Phase-12-Production-Patterns-and-Security
git commit -m "Add Redis Phase 12: Production Patterns and Security"
```

---

## Task 14: Projects

**Files:**
- Create: `Redis/Projects/01-Simple-Key-Value-Cache.md`
- Create: `Redis/Projects/02-Session-Store.md`
- Create: `Redis/Projects/03-Rate-Limiter-Using-Sorted-Sets.md`
- Create: `Redis/Projects/04-Pub-Sub-Chat-Backend.md`
- Create: `Redis/Projects/05-Cache-Aside-Layer-in-Front-of-a-Database.md`
- Create: `Redis/Projects/06-Production-Redis-Capstone.md`

**No `README.md` in `Redis/Projects/` — just these 6 numbered project files.**

- [ ] **Step 1: Write each of the 6 project files** using this per-file structure: **Goal** (1-2 sentences), **What You'll Build** (short description), **Phases Required** (list), **Requirements** (bulleted functional requirements), **Suggested Approach** (numbered high-level steps, NOT full solution code — this is a project brief, not a lesson), **Stretch Goals** (2-3 optional extensions), **Evaluation Checklist** (how the learner knows they succeeded). Content per project:

  1. **Simple Key-Value Cache** (`01-Simple-Key-Value-Cache.md`) — wrap a deliberately slow Python function (e.g. `time.sleep(1)` then return a computed value) with a cache-aside-style check-then-set using `SET`/`GET`/`EX`. Phases 1-3.
  2. **Session Store** (`02-Session-Store.md`) — store user session data in a Hash keyed by session ID, with a TTL that resets on activity, and a way to invalidate a session on logout. Phases 2-3.
  3. **Rate Limiter Using Sorted Sets** (`03-Rate-Limiter-Using-Sorted-Sets.md`) — implement a sliding-window rate limiter (e.g. "max 10 requests per 60 seconds per user") using `ZADD` with timestamps as scores and `ZREMRANGEBYSCORE` to drop entries outside the window. Phases 2, 4.
  4. **Pub/Sub Chat Backend** (`04-Pub-Sub-Chat-Backend.md`) — a simple multi-room chat message relay where clients `PUBLISH` to a room-named channel and other clients `SUBSCRIBE` to receive messages live. Phase 9.
  5. **Cache-Aside Layer in Front of a Database** (`05-Cache-Aside-Layer-in-Front-of-a-Database.md`) — wrap a real (or simulated) database read/write layer with a full cache-aside implementation including invalidation on writes and stampede-prevention locking for a hot key. Phases 10, 11.
  6. **Production Redis Capstone** (`06-Production-Redis-Capstone.md`) — combine persistence configuration, a replica for read scaling, basic monitoring via `INFO`/`SLOWLOG`, and an ACL-restricted application user into one coherent setup. Phases 5, 6, 11, 12.

- [ ] **Step 2: Verify structure**

Run: `ls Redis/Projects/*.md | wc -l` — expected `6`.
Run: `grep -L "Evaluation Checklist" Redis/Projects/0*.md` — expected empty output (every project file has this section).
Run: `ls Redis/Projects/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 3: Commit**

```bash
git add Redis/Projects
git commit -m "Add Redis course Projects"
```

---

## Task 15: Quick-Reference

**Files:**
- Create: `Redis/Quick-Reference/Redis-Cheatsheet.md`
- Create: `Redis/Quick-Reference/Interview-QA.md`

**Note:** these are named files, not `README.md`, so they are exempt from the "no README" rule and should be created as normal.

- [ ] **Step 1: Write `Redis-Cheatsheet.md`**

Following the `Docker/Quick-Reference/Docker-Cheatsheet.md` pattern: a dense, scannable quick-lookup document organized by topic, each as a `##` section with tables/bullet lists (no long prose). Sections required: Data Structure Command Reference (Strings/Lists/Hashes/Sets/Sorted Sets one-liners), Expiration & Eviction Policies Quick Reference, Persistence Comparison (RDB vs AOF vs hybrid), Replication & Cluster Basics, Transactions & Scripting Patterns, Pub/Sub vs Streams Comparison, Caching Strategy Comparison (cache-aside/write-through/write-behind), Production Checklist (monitoring/security one-liners).

- [ ] **Step 2: Write `Interview-QA.md`**

Following the `Docker/Quick-Reference/Interview-QA.md` numbering pattern (`### Q1`, `### Q2`, ... `### Q50`), write exactly 50 interview Q&A pairs covering: Redis fundamentals & architecture (Q1-8), core data structures (Q9-16), keys/expiration/eviction (Q17-21), advanced data structures (Q22-25), persistence (Q26-29), replication & clustering (Q30-35), transactions & scripting (Q36-39), pub/sub & streams (Q40-42), caching patterns (Q43-46), production/security (Q47-50). Each Q&A is a `### QN. Question text?` heading followed by a 2-5 sentence answer.

- [ ] **Step 3: Verify structure**

Run: `grep -c "^### Q" Redis/Quick-Reference/Interview-QA.md` — expected `50`.
Run: `grep -c "^## " Redis/Quick-Reference/Redis-Cheatsheet.md` — expected ≥8.

- [ ] **Step 4: Commit**

```bash
git add Redis/Quick-Reference
git commit -m "Add Redis course Quick-Reference (Cheatsheet + Interview Q&A)"
```

---

## Task 16: Final Cross-Check

- [ ] **Step 1: Verify NO README.md exists anywhere in the course**

Run: `find Redis -iname "README.md"`
Expected: empty output (zero matches). This is the single most important check for this course, given the explicit "no README" requirement.

- [ ] **Step 2: Verify full course structure matches the spec**

Run: `find Redis -name "*.md" | wc -l` — expected around `12 phases × ~2.4 files average (26 lesson files total: 3+3+2+3+2+2+2+2+2+2+2+2) + 6 projects + 2 quick-reference = 34`. Confirm actual count is in that neighborhood (a few files more/less due to natural content splits is fine).

- [ ] **Step 3: Spot-check style compliance**

Run: `grep -L "Memory hook" Redis/Phase-*/0*.md` — expected empty output (every lesson file has a memory hook).
Run: `grep -L "Interview Q&A" Redis/Phase-*/0*.md` — expected empty output.

- [ ] **Step 4: Final commit (if any cleanup was needed)**

```bash
git status
```
(Only commit if Step 1-3 required fixes — otherwise nothing to commit, this task is verification-only.)
