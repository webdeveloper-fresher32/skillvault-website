# HLD Interview Q&A

60 questions covering the full HLD course, organized by phase. Use this as a consolidated drilling reference — the per-lesson Q&A in each phase teaches these concepts in context; this file is for rapid-fire review.

---

## Phase 01 — Foundations and Request Lifecycle (Q1–Q4)

**Q1. Explain what happens when you type `www.instagram.com` into your browser and hit Enter.**
Answer: The browser first checks its own DNS cache, then the OS cache; if neither has an entry it asks a DNS resolver, which walks the hierarchy (root → TLD → authoritative server) to resolve the domain to an IP address. The browser opens a TCP connection (with a TLS handshake for HTTPS) to that IP, which lands on a load balancer. The load balancer forwards the request to a healthy backend server, which may check auth, read/write a cache (Redis), and query the database, before the response travels back the same path to the browser.

**Q2. Why does even a single-server production setup usually sit behind a load balancer?**
Answer: A load balancer gives you a stable entry point that can perform health checks and route around a dead instance, provides a place to terminate TLS and apply rate limiting, and — critically — means you can add a second server later with zero client-facing change. Even with one server today, putting the LB in place now avoids a disruptive migration later.

**Q3. What is the difference between latency and throughput, and can you have low latency with low throughput?**
Answer: Latency is the time for a single request to complete end to end; throughput is the number of requests a system can handle per unit time. Yes — a system can have low latency (each request is fast) but low throughput if it can only process one request at a time (no concurrency). Conversely, a system can have moderate per-request latency but high throughput if it processes many requests concurrently (e.g. 200ms latency but 500 req/s throughput because requests overlap).

**Q4. Walk through a back-of-envelope estimation: 10 million daily active users, each posts twice a day, average post size 1KB. What's the write throughput and storage/year?**
Answer: Writes/day = 10,000,000 × 2 = 20,000,000. Writes/sec ≈ 20,000,000 / 86,400 ≈ 231 writes/sec average (note peak traffic is typically 3-5x average, so provision for ~700-1000 writes/sec). Storage/year = 20,000,000 writes/day × 1KB × 365 days ≈ 7.3 TB/year for post content alone (before replication factor or indexes, which typically multiply this by 2-3x).

---

## Phase 02 — Monolith vs Microservices (Q5–Q8)

**Q5. What are the main trade-offs between a monolith and a microservices architecture?**
Answer: A monolith is one codebase and deploy unit — simple to develop, debug, and reason about transactions, but a bug in one module can take down the whole app, and you can't scale or deploy one part independently of the rest. Microservices split the system into independently deployable services, each with its own database, enabling independent scaling, fault isolation, and team autonomy — at the cost of network calls replacing function calls, harder distributed transactions/data consistency, and real operational overhead (service discovery, monitoring, deployment pipelines per service).

**Q6. How would you decide whether to use a monolith or microservices for a new project?**
Answer: Start with team size and deployment cadence — a small team building an MVP should default to a monolith because the coordination overhead of microservices isn't justified yet. Split into services later, and specifically, when a part of the system has clearly different scaling needs than the rest (e.g. Payments needs to scale independently of Product Catalog), when separate teams need to own and deploy independently, or when organizational boundaries (Conway's Law) already mirror a natural service boundary.

**Q7. Give an example of extracting a service out of a monolith, and explain why you'd do it.**
Answer: A growing ecommerce monolith has Login/Orders/Payments/Cart/Products all in one codebase. If Payments starts needing PCI-compliance isolation, a different scaling profile (bursty during sales), and its own on-call team, you extract it into a standalone Payment Service with its own database, exposing an API the monolith calls instead of a local function call. This lets Payments scale and deploy independently without redeploying the entire monolith for every checkout-related change.

**Q8. What is Conway's Law and why does it matter when choosing a service boundary?**
Answer: Conway's Law states that a system's architecture tends to mirror the communication structure of the organization that builds it. It matters because if you draw service boundaries that don't match team boundaries, you get high cross-team coordination cost for every change (multiple teams needing to touch the same service) — so a service boundary is more likely to hold up in practice if it matches how your teams are actually organized.

---

## Phase 03 — Scalability Fundamentals (Q9–Q12)

**Q9. What is the difference between vertical and horizontal scaling?**
Answer: Vertical scaling means adding more resources (CPU/RAM) to a single existing server — simple to do, but bounded by hardware limits and leaves you with a single point of failure. Horizontal scaling means adding more servers and distributing load across them via a load balancer — it scales near-unlimitedly and removes the single point of failure, but requires the service to be stateless and adds the operational complexity of running and coordinating many instances.

**Q10. Why does horizontal scaling require stateless services?**
Answer: If a server stores session state in local memory (e.g. "user 42 is logged in" kept in a dict on Server 1), a load balancer routing that user's next request to Server 2 finds no record of the session and the user appears logged out. Horizontal scaling only works cleanly if any server can handle any request, which requires state to live outside individual server processes.

**Q11. What are the two common fixes for externalizing state so services can scale horizontally?**
Answer: One option is to eliminate server-side session state entirely by using a JWT — the token itself carries the user's identity/claims, so any server can verify it without a session lookup. The other is to keep server-side session state but move it out of local memory into a shared store like Redis, so every server instance reads/writes the same shared session data.

**Q12. Contrast a stateful in-memory session dict with a stateless JWT-based approach in code terms.**
Answer: Stateful: `sessions = {}`; on login, `sessions[session_id] = user_id`; on each request, look up `sessions[session_id]` — this dict lives in one process's memory and is invisible to other instances. Stateless: on login, issue `jwt.encode({"user_id": user_id}, SECRET_KEY, algorithm="HS256")`; on each request, `jwt.decode(token, SECRET_KEY, algorithms=["HS256"])` — any server with the shared secret can verify the token without consulting shared storage.

---

## Phase 04 — Load Balancers (Q13–Q16)

**Q13. Why do you need a load balancer once traffic exceeds what one server can handle?**
Answer: A single server has finite CPU/memory/connection capacity; once request volume (say 1000 req/s) exceeds that, requests queue up or get dropped, causing timeouts. A load balancer sits in front of multiple backend instances (API1, API2, API3) and distributes incoming requests across them, so aggregate capacity scales with the number of instances rather than being capped by one machine.

**Q14. How would you route requests so the same user always hits the same server, and why would you want that?**
Answer: Use consistent hashing (or a simpler sticky-session cookie) keyed on something stable like user ID or session ID, so the same key always maps to the same backend instance. You'd want this when server-local state matters — most commonly, a per-server in-memory cache: if user data is cached on Server 2 and the next request lands on Server 3, you get an avoidable cache miss. Consistent hashing also minimizes remapping when servers are added/removed, compared to a plain hash-mod-N scheme.

**Q15. What happens if a load balancer has no health checks, and how do health checks fix it?**
Answer: Without health checks, the LB keeps forwarding a share of traffic to a server even after it crashes or hangs, so a fraction of requests fail or time out with no self-healing. Health checks have the LB periodically probe each backend (e.g. `GET /health`) and automatically remove instances that fail to respond correctly, routing traffic only to instances known to be healthy, and re-adding them once they recover.

**Q16. What's the difference between L4 and L7 load balancing?**
Answer: L4 (transport layer) load balancing routes based on IP/port and TCP/UDP-level information without inspecting the request content — it's fast and protocol-agnostic. L7 (application layer) load balancing understands HTTP and can route based on URL path, headers, or cookies (e.g. sending `/api/orders` to the Order service and `/api/payments` to the Payment service), enabling smarter routing at a small CPU cost for parsing the request.

---

## Phase 05 — Database Design and Scaling (Q17–Q21)

**Q17. How does an index speed up a database lookup, and what's the cost?**
Answer: Without an index, finding a row by a non-primary-key column requires scanning every row (O(n)). An index builds a separate B-tree-like structure ordered by the indexed column, so lookups become O(log n) — the database can jump directly to the matching row range instead of scanning linearly. The cost is on writes: every insert/update must also update the index structure, so heavily-indexed tables have slower write throughput, and indexes consume extra storage.

**Q18. In SQLAlchemy, how would you index a column, and when should you do it?**
Answer: `class User(Base): __tablename__ = "users"; email = Column(String, index=True)`. Add an index to any column you frequently filter or sort by (e.g. `email` for login lookups) — but avoid indexing every column, since each index adds write overhead and storage cost for benefit only realized on reads of that specific column.

**Q19. Explain database replication and the rule for routing reads vs writes.**
Answer: Replication keeps one master database that accepts writes, and one or more read replicas that continuously receive a copy of the master's changes. The standard rule is: writes go to the master, reads go to replicas — this offloads read traffic (usually the majority of traffic) from the master and lets you scale read capacity by adding more replicas. The trade-off is replication lag: a replica may briefly be behind the master, so a read immediately after a write can return stale data.

**Q20. What is sharding, and what are the two common sharding strategies?**
Answer: Sharding splits one logical dataset across multiple independent database instances by a shard key, so no single database has to hold or serve all the data. Range-based sharding assigns contiguous key ranges to each shard (e.g. usernames A-F to Shard 1, G-M to Shard 2, N-Z to Shard 3) — simple and range-query-friendly, but can create hot shards if data isn't evenly distributed. Hash-based sharding hashes the key to pick a shard — more even distribution, but loses range-query locality and complicates rebalancing when adding a shard (similar problem to plain hashing in load balancing, which is why consistent hashing is often used here too).

**Q21. When would you choose NoSQL over SQL for a system component?**
Answer: Choose SQL when you need strong consistency, relational integrity, and multi-row transactions — e.g. a Payment Gateway where a debit and credit must succeed or fail together. Choose NoSQL when you need flexible/evolving schema, very high write throughput, and horizontal scale is more important than cross-record joins — e.g. chat messages or a social feed, where each record is largely independent and volume is the dominant concern.

---

## Phase 06 — Caching (Q22–Q25)

**Q22. Walk through the cache-aside pattern with code.**
Answer: On a read, check the cache first; if present (cache hit), return it directly. If absent (cache miss), read from the database, then populate the cache before returning, so the next read is a hit:
```python
import redis
r = redis.Redis()
user = r.get("user:10")
if not user:
    user = get_user_from_db()
    r.set("user:10", user)
```
It's called "cache-aside" because the application code sits beside the cache and explicitly manages populating it, rather than the cache being transparently kept in sync by the database layer (as in write-through caching).

**Q23. What are the common cache eviction policies, and how does LRU work on a small example?**
Answer: LRU (least-recently-used) evicts the item that hasn't been accessed for the longest time; LFU (least-frequently-used) evicts the item accessed the fewest times overall; TTL evicts based on a fixed expiry time regardless of access pattern. On a 3-slot LRU cache: inserting A, B, C fills all slots; accessing A moves it to "most recently used"; inserting D now evicts B (the least-recently-used, since C and A were touched more recently than B).

**Q24. How can a cache go stale after a database update, and how do you prevent it?**
Answer: If a cache-aside read populates `user:10` and then the DB is updated directly (e.g. by another service or an admin update) without touching the cache, subsequent reads keep returning the old cached value until it happens to expire — the classic stale-cache bug. Prevention: either set a short TTL so staleness self-heals quickly, or explicitly delete/update the cache key on every write path (delete-on-write invalidation) so the next read is forced to repopulate from the now-current DB value.

**Q25. Beyond simple key-value caching, what else is Redis commonly used for in a production system?**
Answer: Rate limiting (atomic increment-with-TTL counters per user/IP), session storage (shared session store enabling stateless app servers), leaderboards (sorted sets, giving O(log n) ranked inserts and range queries), and pub/sub messaging (publishers broadcast to channels that subscribers listen on, useful for real-time features like chat presence).

---

## Phase 07 — Message Queues and Async Processing (Q26–Q29)

**Q26. Why move work into a background queue instead of doing it synchronously in the request handler?**
Answer: If an upload endpoint does Upload → Compress → Generate Thumbnail → Send Email all inline, the user's request stays open for however long that whole chain takes (potentially minutes), and a failure anywhere in the chain fails the whole request. Pushing the slow/non-critical steps onto a queue lets the handler respond immediately after enqueuing the job ("Uploading..."), while a background worker processes the chain independently, improving perceived latency and letting slow steps retry without blocking the user.

**Q27. Explain the Celery pattern with the roles of the broker, the task, and the worker.**
Answer: The request handler enqueues work with `.delay()`: `@app.post("/upload") def upload(): process_video.delay(); return {"message": "Uploading"}`. The task itself is defined separately: `@celery.task def process_video(): compress(); thumbnail(); send_email()`. A message broker (Redis or RabbitMQ) sits between them, holding the queue of pending jobs; one or more worker processes continuously pull jobs off the broker and execute the task function, independently of the web server process. Celery also supports automatic retries with backoff if a task raises an exception.

**Q28. What's the difference between a task queue and pub-sub?**
Answer: A task queue (Celery-style) delivers each job to exactly one consumer — once a worker picks up a job, no other worker processes it, which is right for "do this piece of work once." Pub-sub delivers each published message to every subscriber listening on that topic — right for "notify everyone interested that this event happened" (e.g. an order-placed event that both the Inventory service and the Notification service need to react to independently).

**Q29. Kafka vs RabbitMQ — what's the conceptual difference?**
Answer: RabbitMQ is a traditional message broker built around routing messages to queues/consumers, well suited to task-queue-style workloads with flexible routing rules. Kafka is a log-based streaming platform — messages are appended to a durable, ordered log per topic and consumers track their own read position, which allows multiple consumer groups to independently replay or re-read the same stream, making it better suited to high-throughput event streaming and event sourcing than to simple one-shot task dispatch.

---

## Phase 08 — Storage, Gateway and Auth (Q30–Q33)

**Q30. Why shouldn't you store images/video directly in a SQL database?**
Answer: Binary blobs bloat table/row size, slow down backups and replication, and don't benefit from relational features like indexing or joins the way structured data does. The standard approach is to upload the file to object storage (S3/GCS/Azure Blob) and store only the resulting URL as a column on the row it belongs to (`user.profile_image → https://...`), keeping the database small, fast, and focused on structured/queryable data.

**Q31. What does an API Gateway do beyond simple request routing?**
Answer: Beyond routing (`Client → Gateway → Auth/Orders/Payments/Products`), a gateway centralizes cross-cutting concerns: enforcing authentication/authorization before a request reaches any service, rate limiting per client, and request/response transformation (e.g. aggregating multiple backend calls into one client-facing response). It also means clients never need to know internal service addresses or talk to microservices directly, which keeps the internal topology free to change.

**Q32. Walk through the JWT authentication flow and explain why it's called "stateless."**
Answer: A user logs in; on success, the server issues a signed JWT: `jwt.encode({"user_id": 1}, SECRET_KEY, algorithm="HS256")`. The client stores this token and attaches it to every subsequent request (typically as an `Authorization: Bearer <token>` header). The server verifies the token's signature on each request without needing to look up a session in a database or shared store — the token itself carries the claims needed to authenticate the request, which is what makes it stateless and lets any server instance verify it independently (tying back to Phase 03's statelessness requirement).

**Q33. What's the purpose of token expiry and refresh tokens?**
Answer: A JWT access token is given a short expiry (e.g. 15 minutes) so that if it's stolen, the exposure window is limited — an attacker can't use it indefinitely. A longer-lived refresh token is issued alongside it and stored more carefully; when the access token expires, the client uses the refresh token to obtain a new access token without forcing the user to log in again, balancing security against user convenience.

---

## Phase 09 — Observability and Distributed Systems (Q34–Q38)

**Q34. What does it mean for distributed systems to need "consensus," and what does a quorum provide?**
Answer: When multiple nodes must agree on a single value or ordering of operations (e.g. who is the current leader, or which write happened first), a naive approach can leave nodes disagreeing after a failure or network hiccup. Consensus algorithms (Raft, Paxos — named here only as "the algorithms that solve this," not derived in depth) guarantee that as long as a majority of nodes (a quorum) can communicate, they converge on one agreed value even if some nodes are slow, crashed, or partitioned. A quorum (typically more than half the nodes) is the minimum number of nodes that must agree before a write or leader election is considered committed, which is what prevents two disconnected halves of a cluster from both believing they're in charge.

**Q35. What are the three pillars of observability, and what does each answer?**
Answer: Metrics (numeric time series like CPU, RAM, latency, error rate, requests/sec — tracked via tools like Prometheus/Grafana) answer "what is the current health/trend?" Logs (discrete timestamped event records, often aggregated via an ELK stack) answer "what exactly happened, in detail, at a point in time?" Traces (a request's path across multiple services with per-hop timing) answer "where in a distributed call chain did the time go or the failure occur?"

**Q36. Why is it better to alert on symptoms like latency/error rate rather than only on causes?**
Answer: Symptom-based alerts (e.g. "p99 latency > 500ms" or "error rate > 1%") directly reflect user-visible impact regardless of root cause, so they reliably page someone when something is actually wrong. Cause-based alerts (e.g. "CPU > 80% on host X") can fire without any real user impact (transient spike, auto-recovers) or miss real impact caused by something the alert wasn't written for, leading to both noisy false positives and missed incidents.

**Q37. Explain the CAP theorem and why it's really a Consistency-vs-Availability choice in practice.**
Answer: CAP says a distributed system can only guarantee two of Consistency (every read sees the latest write), Availability (every request gets a response), and Partition tolerance (the system keeps working despite network partitions between nodes). In practice, network partitions will happen in any real distributed system, so partition tolerance isn't a choice you get to opt out of — which means the real decision, made specifically during a partition, is whether to stay Consistent (reject/delay requests you can't guarantee are correct — a CP system) or stay Available (serve possibly-stale data rather than fail — an AP system).

**Q38. Give an example of strong consistency vs eventual consistency in a real system.**
Answer: A bank account balance needs strong consistency — every read must reflect the most recent write, because serving a stale balance could let someone overdraw. A social media post's like-count is fine with eventual consistency — if it briefly shows 4,102 instead of 4,103 while the update propagates, no one is harmed, and the system gains availability/performance by not forcing every replica to be perfectly in sync on every read.

---

## Phase 10 — Case Studies: Social and Media (Q39–Q42)

**Q39. In a chat system like WhatsApp, how do you handle message delivery and online presence at scale?**
Answer: Message delivery typically uses persistent WebSocket connections per online user (for real-time push) combined with a per-user queue so messages sent while a user is offline are held and delivered on reconnect. Online presence is tracked via a periodic heartbeat from each client, with the "online" flag stored in a fast shared store like Redis (with a short TTL) — if a heartbeat is missed, the user is marked offline once the TTL expires, without needing every server to track connection state itself.

**Q40. Explain fan-out-on-write vs fan-out-on-read for a feed system like Instagram or Twitter, and the celebrity-account problem.**
Answer: Fan-out-on-write pre-computes and pushes a new post into every follower's feed cache at post time, making feed reads very fast (just read the pre-built list) at the cost of expensive writes for users with huge follower counts. Fan-out-on-read builds a user's feed at read time by pulling recent posts from everyone they follow, making writes cheap but reads more expensive/complex. The celebrity-account problem — a single post from an account with 50 million followers would require fanning out to 50 million feed caches — is usually solved with a hybrid: fan out on write for normal users, but fan out on read (merge celebrity posts in at read time) for accounts above a follower threshold.

**Q41. How would you design view-count tracking for a system like YouTube at scale?**
Answer: You don't increment a single row in a relational database on every view — that row becomes an extreme write hotspot. Instead, buffer view events (e.g. into a queue or in-memory counters per app instance), batch-aggregate them periodically (e.g. every few seconds), and flush the aggregated delta to storage, or use a counter-optimized store (like Redis) that can absorb high-frequency increments before periodically syncing to the durable database.

**Q42. What's the deep-dive challenge in a Notification Service, and how do you avoid duplicate notifications?**
Answer: The core challenge is fanning a single event out across multiple channels (push, email, SMS), each with different delivery guarantees, rate limits, and failure modes — typically solved with one queue per channel so a slow/failing email provider doesn't block push delivery. Deduplication is handled by attaching an idempotency/dedup key to each notification job (e.g. based on event ID + channel) so that if a retry occurs after a transient failure, the consumer can detect and skip a notification it already successfully sent.

---

## Phase 11 — Case Studies: Marketplace and Utility (Q43–Q46)

**Q43. How does real-time driver-matching work conceptually in a system like Uber?**
Answer: Driver and rider locations are indexed using a geospatial structure — geohashing (encoding lat/long into a string prefix so nearby locations share prefixes) or a quadtree (recursively subdividing space) — so a "find nearby drivers" query doesn't require scanning every driver's location. Location updates arrive frequently and are processed asynchronously (ties to Phase 07) to avoid overloading the matching service, and matches are made by querying the geospatial index for drivers within a radius of the rider, then applying business rules (ETA, driver rating, surge context) to pick the best match.

**Q44. How does an order-state machine help design a system like Swiggy/Zomato, and why is it a 3-sided marketplace?**
Answer: An explicit state machine (e.g. `Placed → Confirmed → Preparing → PickedUp → Delivered/Cancelled`) makes valid transitions explicit and prevents invalid states (e.g. marking "Delivered" before "PickedUp"), and gives each of the three parties — restaurant, customer, delivery partner — a clear, queryable view of order status. It's a 3-sided marketplace (vs Uber's 2-sided rider/driver) because a restaurant is a distinct actor with its own constraints (prep time, order acceptance) sitting between the customer and the delivery partner.

**Q45. How do you prevent double-booking in a hotel or flight booking system under concurrent requests?**
Answer: Two approaches: pessimistic locking acquires a row/resource lock on the specific room or seat before confirming a booking, blocking other concurrent attempts until the transaction completes — simple but can hurt throughput under high contention. Optimistic locking instead lets both attempts proceed and checks a version number or condition at commit time, retrying the losing transaction — better throughput when conflicts are rare, but requires retry logic. Flight seat inventory tends to be smaller and more contended than hotel rooms (fewer, more sought-after seats on a popular route), making this trade-off more visible.

**Q46. What's the core design decision behind a Payment Gateway that differs from most other systems in this course, and why?**
Answer: A Payment Gateway generally picks SQL/strong consistency over the NoSQL/eventual-consistency choices common elsewhere (e.g. feeds, chat) because financial correctness (never double-charging, never losing a transaction) matters far more than raw write throughput. Idempotency keys attached to each payment request ensure a retried request (e.g. due to a client timeout) is recognized and not reprocessed, and the outbox pattern (writing "payment succeeded" as part of the same DB transaction, then reliably publishing it as an event afterward) avoids the classic bug of updating the DB but failing to notify downstream systems (or vice versa).

---

## Phase 12 — Interview Process and Advanced (Q47–Q50)

**Q47. What is the repeatable framework for answering any "design X" interview question?**
Answer: (1) Clarify functional and non-functional requirements and ask about expected scale — don't assume. (2) Do a back-of-envelope estimation of traffic/storage. (3) Propose a high-level architecture, stating your assumptions out loud as you go. (4) Pick one or two components to deep-dive based on what the interviewer seems most interested in. (5) Discuss trade-offs and what would break at 10x scale. (6) If time remains, mention monitoring and failure handling. Each step maps to an earlier phase — estimation to Phase 01, architecture components to Phases 02-09, deep dives and 10x discussion to Phases 10-11.

**Q48. What's the most common failure mode candidates fall into during a system design interview, and how do you avoid it?**
Answer: Jumping straight into a solution (drawing boxes, naming technologies) before clarifying requirements and scale. This risks solving the wrong problem or over/under-engineering for a scale the interviewer never asked for. Avoid it by explicitly spending the first few minutes asking clarifying questions and stating assumptions out loud before proposing any architecture.

**Q49. What's the difference between active-active and active-passive multi-region architecture, and how do RPO/RTO relate to disaster recovery?**
Answer: Active-active runs live traffic-serving deployments in multiple regions simultaneously, giving lower latency for geographically distributed users and faster failover (no cold region to warm up) at the cost of harder cross-region data consistency. Active-passive keeps a standby region ready but not serving live traffic, which is simpler to keep consistent but has slower failover and doesn't help regional latency day-to-day. RPO (Recovery Point Objective) is how much data loss is tolerable (e.g. "at most 5 minutes of writes lost"), and RTO (Recovery Time Objective) is how much downtime is tolerable (e.g. "system back up within 15 minutes") — both drive how aggressively you replicate and how automated failover needs to be.

**Q50. If an interviewer pushes your design further by asking "what if this needs to support 10x the users," what's a strong way to extend your answer?**
Answer: Revisit each major component from your architecture and identify which one breaks first under 10x load — usually the single-write-node database or a single cache instance — and name the specific fix from earlier phases (sharding for the database, read replicas for read-heavy load, a CDN for static/media content, multi-region for global latency and disaster recovery). This shows you can reason about a system's evolution rather than having designed a single fixed answer, which is exactly the signal a staff-level follow-up is probing for.

---

## Phase 05 — Beyond SQL and NoSQL (Q51–Q52)

**Q51. A dashboard needs to compute daily revenue trends by aggregating a few columns across billions of billing rows. Why reach for a columnar store instead of the production Postgres instance?**
Answer: A row-oriented database stores a full row contiguously, so computing `AVG(plan_price)` across 500 million rows still means reading every column of every row just to touch one of them, and running that against production risks locking rows and starving real transactional traffic. A columnar store (Cassandra, BigQuery, Redshift) stores each column contiguously and often compressed, so the same aggregate touches only the relevant column — exactly the access pattern an analytics dashboard needs, kept separate from the transactional system of record.

**Q52. Why is a time-series database a better fit than a general-purpose SQL or NoSQL store for tracking CPU/latency metrics every 15 seconds across 10,000 machines, and what would a graph or search-index store each add for a different problem?**
Answer: A time-series database (Prometheus, InfluxDB) indexes by time first, storing data in time-ordered chunks so range queries ("last 5 minutes") are sequential scans, and it applies retention/downsampling automatically so raw per-second data doesn't grow unbounded — neither of which a general SQL/NoSQL store handles natively. A graph database (Neo4j) instead solves a completely different shape of problem — multi-hop relationship traversal like friends-of-friends, where each hop is a pointer dereference instead of another self-join — and a search-index store (Elasticsearch) solves full-text, typo-tolerant, faceted search via an inverted index, while remaining a read-optimized copy rather than the system of record.

---

## Phase 09 — Resilience and Fault Tolerance Patterns (Q53–Q55)

**Q53. Why does a slow downstream dependency with no timeout on the caller's side turn into an outage for the caller too?**
Answer: A network call with no timeout is a promise to wait forever, so every worker thread that calls the slow dependency parks waiting on a response. As more requests arrive, more threads get stuck, and once the thread pool is exhausted the caller can't serve any request — including ones that don't even touch the slow dependency. An explicit timeout bounds this: it turns an unpredictable hang into a fast, predictable failure that can then be retried, circuit-broken, or degraded gracefully.

**Q54. Explain the three states of a circuit breaker, and why naive immediate retries can make an outage worse.**
Answer: Closed is normal operation with failures tracked; once failures cross a threshold the breaker trips to open, failing every call instantly without touching the network for a cooldown period, giving the struggling dependency a window with zero added load; half-open then lets one trial request through, closing the breaker on success or reopening on failure. Naive immediate retries make things worse because if every caller retries the instant a call fails, those retries land on top of the load that caused the failure in the first place — a thundering herd — which is why retries need exponential backoff (spacing attempts out) plus jitter (preventing every caller from retrying in lockstep).

**Q55. What's the difference between a bulkhead and graceful degradation, and when is graceful degradation the wrong tool?**
Answer: A bulkhead isolates resources (thread/connection pools) per dependency so a hung call to one dependency can't exhaust the capacity needed to call a different, healthy dependency — it contains a failure rather than fixing it. Graceful degradation goes further and tries to serve something useful despite a failure, like falling back to a stale cached list when a recommendation service is down. It's the wrong tool wherever a stale or approximate answer is worse than no answer at all — a payment authorization can't "approximately" succeed, so that path should fail loud and fast rather than degrade.

---

## Phase 11 — Rate Limiter, Web Crawler, Distributed Key-Value Store (Q56–Q60)

**Q56. Why does a naive Redis-backed rate limiter have a race condition, and how is it fixed?**
Answer: A naive implementation does a separate `GET` (read the current count) followed by a separate `SET` (write the incremented count), and two concurrent requests can both read the same pre-increment value before either writes back — both get allowed even though together they exceed the limit. The fix is making check-and-increment one atomic operation: Redis's `INCR` is atomic by itself for a simple counter, and a Lua script run via `EVAL` is the equivalent fix for multi-step logic like token bucket's check-then-decrement.

**Q57. Compare the sliding window counter and token bucket rate-limiting algorithms — when would you pick each?**
Answer: The sliding window counter keeps fixed-window counters but weights the previous window's count by how far into the current window you are, giving a good approximation of true sliding-window accuracy at O(1) memory per client — the general-purpose default for most production APIs. Token bucket deliberately allows bursts up to the bucket's capacity, refilling at a steady rate, which matches real traffic patterns like a page load firing several calls then going quiet — pick it when legitimate bursty traffic should be allowed rather than smoothed away.

**Q58. How does a web crawler avoid hammering any single domain while still crawling with many parallel workers?**
Answer: The URL frontier uses a two-level design — priority-bucketed front queues feeding into one back queue per domain — so a per-domain rate limit ("next allowed fetch time") is a purely local property of that domain's queue. Crawler workers are partitioned by a consistent hash of the domain (not assigned URLs randomly), guaranteeing every URL for a given domain always routes to the same worker, so that worker can enforce the domain's politeness limit locally without needing any cross-worker coordination.

**Q59. Why does a web crawler use a Bloom filter instead of a hash set or database to detect already-seen URLs, and what's the trade-off?**
Answer: At billions of URLs, storing every full URL string (tens of bytes each) in a hash set or database costs hundreds of gigabytes and adds a round-trip per check. A Bloom filter answers "have we seen this?" using only a few bits per entry via a fixed bit array and several hash functions, small enough to fit in memory even at multi-billion-URL scale. The trade-off is a tunable false-positive rate — it can never wrongly say a truly new URL is a duplicate (no false negatives), but it can occasionally flag an already-seen URL as "probably seen," which is resolved by confirming against a smaller exact-match store before actually skipping it.

**Q60. In a distributed key-value store, what does `W + R > N` guarantee, and what happens at the extremes `W=N,R=1` versus `W=1,R=1`?**
Answer: With replication factor `N`, write quorum `W`, and read quorum `R`, `W + R > N` guarantees by the pigeonhole principle that any write quorum and any read quorum share at least one common replica, so a read is guaranteed to see the most recent write on at least one replica it consults. At `W=N, R=1` every write must reach all replicas (slow, unavailable if any replica is down) but any single-replica read is guaranteed fresh — strongly consistency-leaning. At `W=1, R=1`, `W+R=2` is not greater than `N` (for `N=3`), so there's no overlap guarantee and a read can legitimately return stale data — a deliberate choice favoring availability and speed, appropriate for workloads like a view counter or shopping cart where brief staleness is a non-issue.
