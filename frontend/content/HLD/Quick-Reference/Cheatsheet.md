# HLD Cheatsheet (Python)

Dense, scannable, last-minute-before-interview reference. Not a tutorial — read the phase lessons for depth, use this to drill recall.

---

## Phase 01 — Foundations and Request Lifecycle
- Request path: `Browser → DNS → IP → Load Balancer → Backend → Auth → Database → Response`.
- DNS resolution order: browser cache → OS cache → resolver → root → TLD → authoritative server → IP returned.
- Latency = time for one request to complete. Throughput = requests handled per unit time. High concurrency lets throughput stay high even with non-trivial per-request latency.
- Back-of-envelope estimation is expected before any case study: DAU → actions/day → requests/sec; average object size × writes/day × 365 → storage/year.
- Memorize a short latency-numbers table (L1 cache ~1ns, RAM ~100ns, SSD read ~100µs, same-datacenter round trip ~0.5ms, cross-region round trip ~50-150ms).

## Phase 02 — Monolith vs Microservices
- Monolith: one codebase/deploy unit (Login/Orders/Payments/Cart together). Simple to build/debug/transact, but one bug can take the whole app down and you scale everything together.
- Microservices: one service per capability (Auth/Order/Cart/Inventory/Payment), each with its own DB. Independent scaling/deploys/fault isolation, at the cost of network calls, distributed transactions, and operational overhead.
- Default advice: start monolith, extract services later when a specific part (e.g. Payments) needs independent scaling or an independent team.
- Conway's Law: system structure tends to mirror team/org structure — factor this into the split decision.

## Phase 03 — Scalability Fundamentals
- Vertical scaling: bigger box (more CPU/RAM). Simple, but hits a hardware ceiling and stays a single point of failure.
- Horizontal scaling: more boxes behind a load balancer. Near-unlimited scaling, no SPOF, but requires statelessness and adds operational complexity.
- Statelessness: no server keeps session/user state in local memory — otherwise a user's next request landing on a different server breaks their session.
- Fix for state: externalize it — JWT tokens (client carries state) or a shared store like Redis (server-side state, but shared, not local).

## Phase 04 — Load Balancers
- A single server can't absorb high request volume — an LB fans requests out across many backend instances.
- Algorithms: round robin (even rotation), weighted round robin (accounts for server capacity), least connections (send to the least-busy server), consistent hashing (same key/user routes to the same server — needed for sticky sessions or a server-local cache).
- Health checks are mandatory — without them, an LB keeps routing traffic to a dead instance.
- In practice you don't write an LB in Python — Nginx/HAProxy/AWS ALB do this job. L4 (transport layer, fast, TCP/UDP-level) vs L7 (application layer, HTTP-aware, can route by path/header) load balancing.

## Phase 05 — Database Design and Scaling
- Indexing: turns an O(n) linear scan into an O(log n) lookup via a B-tree structure. Cost: slower writes (index must be updated on every insert/update).
- Replication: one master (writes) + N read replicas (reads). Replication lag means replicas can briefly serve stale data.
- Sharding: split data across databases by a shard key — range-based (A-F/G-M/N-Z) or hash-based (harder to range-query, easier to balance). Cross-shard joins and rebalancing are the classic pain points.
- SQL vs NoSQL: SQL for strong consistency/relational data/transactions (payments); NoSQL for flexible schema, horizontal scale, high write throughput (chat messages, feeds).
- Beyond SQL/NoSQL: columnar (Cassandra/BigQuery/Redshift — aggregate over a few columns across billions of rows), time-series (Prometheus/InfluxDB — timestamped metrics, built-in retention/downsampling), graph (Neo4j — multi-hop traversal as pointer hops, not joins), search index (Elasticsearch — inverted index for typo-tolerant/faceted full-text search, not a system of record).

## Phase 06 — Caching
- Cache-aside: check cache → hit: return; miss: read DB, populate cache, return. Most common pattern; write-through writes to cache and DB together instead.
- Eviction policies: LRU (evict least-recently-used), LFU (evict least-frequently-used), TTL (time-based expiry).
- Invalidation: TTL expiry (simple, can serve stale data briefly) vs explicit delete-on-write (fresher, more code paths to get right).
- Redis beyond key-value: rate limiting counters, session storage, leaderboards (sorted sets), pub/sub messaging.

## Phase 07 — Message Queues and Async Processing
- Move slow/non-critical work off the request path: `Upload → Queue → Background Worker` instead of doing everything synchronously before responding.
- Celery pattern: `task.delay()` enqueues work from a request handler; a `@celery.task`-decorated function does the actual work on a separate worker process. A broker (Redis/RabbitMQ) sits in between.
- Pub-sub (many subscribers react to one event) is different from a task queue (one consumer processes one job). Kafka = log-based streaming, high throughput, replay-able; RabbitMQ = traditional message broker, simpler routing.
- Event-driven example: "order placed" event triggers independent reactions in Inventory and Notification services.

## Phase 08 — Storage, Gateway and Auth
- Object storage: binary blobs (images/video) never belong in a SQL column — store the file in S3/GCS/Azure Blob and store only the resulting URL in the DB row (`user.profile_image → https://...`).
- API Gateway: single entry point for clients; does routing, auth enforcement, rate limiting, and request/response transformation so clients never talk to microservices directly.
- JWT auth: `Login → JWT issued → client attaches token to future requests → server verifies signature, no server-side session lookup needed`. Enables stateless auth (ties to Phase 03).

## Phase 09 — Observability and Distributed Systems
- What to monitor: CPU, RAM, latency, error rate, requests/sec. Tools: Prometheus (metrics), Grafana (dashboards), ELK stack (logs).
- Three pillars of observability: metrics, logs, traces. Alert on symptoms (latency/errors) rather than only on causes.
- CAP theorem: Consistency, Availability, Partition tolerance — during a network partition you can only keep two of the three, and partition tolerance isn't optional in real distributed systems, so it's really a Consistency-vs-Availability choice under partition.
- Strong consistency (bank balance, must always be correct) vs eventual consistency (social media like-count, can lag briefly). Consensus algorithms (Raft, Paxos, named only) solve leader election; quorum = majority agreement needed to commit a write.
- Resilience patterns: timeouts on every network call (bound a hang to a fast failure), retries with exponential backoff + jitter (avoid a thundering herd), circuit breaker (closed/open/half-open — stop calling a dependency that's already down), bulkhead (isolate resource pools per dependency), graceful degradation (stale cache fallback beats a 500, except where correctness is non-negotiable), backpressure (bounded queue/429 tells the producer to slow down).

## Phase 10 — Case Studies: Social and Media
- Every case study follows: Requirements → Estimation → Architecture → Deep dive → Trade-offs at 10x.
- WhatsApp: message delivery (queues/WebSockets) + online presence (heartbeat + Redis).
- Instagram/Twitter: feed/timeline generation — fan-out-on-write vs fan-out-on-read, and the celebrity-account hybrid problem.
- YouTube/Netflix: video transcoding pipeline (async), CDN delivery, adaptive bitrate streaming.
- Notification Service: fan-out to push/email/SMS, one queue per channel, dedup + retry/backoff.

## Phase 11 — Case Studies: Marketplace and Utility
- Uber/Lyft: geospatial driver matching (geohashing/quadtree), real-time location updates.
- Swiggy/Zomato: same matching problem plus a 3-sided marketplace (restaurant, customer, delivery partner) and an order-state machine.
- Hotel/Flight Booking: inventory consistency under concurrent bookings — pessimistic locking vs optimistic locking with retry; flight seat inventory is smaller/more contended.
- URL Shortener: short-code generation (base62 counter vs hash + collision handling), read-heavy so cache aggressively.
- Google Drive: chunked upload/download, dedup via content hashing, metadata DB separate from blob storage.
- Google Docs: real-time collaborative editing (OT/CRDT named only), WebSocket-based sync.
- Payment Gateway: idempotency keys (never double-charge on retry), outbox pattern for reliable event publishing, strong consistency/SQL by design.
- Rate Limiter: enforce at the API Gateway with Redis-backed counters; atomic `INCR` (or a Lua script) fixes the check-and-increment race condition; sliding window counter is the general-purpose default, token bucket for deliberate bursts; fail open on Redis outage.
- Web Crawler: two-level URL frontier (priority front queues + one back queue per domain for local politeness), workers partitioned by consistent hash of domain, Bloom filter for cheap "already seen?" dedup checks at billions of URLs.
- Distributed Key-Value Store: consistent hashing (with virtual nodes) places both keys and replicas on the ring; `W + R > N` is the tunable knob between consistency and availability; read repair (reactive) + Merkle-tree anti-entropy (proactive) converge stale replicas.

## Phase 12 — Interview Process and Advanced
- Repeatable framework: (1) clarify requirements + scale, (2) back-of-envelope estimate, (3) propose architecture + state assumptions, (4) deep-dive 1-2 components based on interviewer signal, (5) discuss trade-offs/bottlenecks at 10x, (6) mention monitoring/failure handling if time remains.
- Common failure mode: jumping to a solution before clarifying requirements.
- Staff-level extensions: multi-region (active-active vs active-passive), disaster recovery (RPO = data loss tolerance, RTO = downtime tolerance), capacity planning at 10x the "normal" scale.

---

## Concept → Python Tool

| Concept | Python Tool |
|---|---|
| REST APIs | FastAPI |
| Database ORM | SQLAlchemy |
| Cache | Redis |
| Background Jobs | Celery |
| Authentication | JWT |
| Async Programming | asyncio |
| Web Server | Uvicorn |
| Reverse Proxy | Nginx |
| Containerization | Docker |
| Orchestration | Kubernetes |
| Cloud | AWS / Azure |
