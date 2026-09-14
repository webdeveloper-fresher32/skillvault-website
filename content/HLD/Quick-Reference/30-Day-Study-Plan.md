# 30-Day HLD Study Plan

A day-by-day plan for a ~3-years-experience Python full-stack engineer preparing for HLD (High-Level Design / system design) interviews, at roughly 2 hours/day. This maps to the course's "5-6 weeks" estimate — the plan below runs about 5.5 weeks (37 days), with the case-study phases (10-11) given the most time since they're where interviews actually happen. Phase folder names are fixed and used for mapping instead of exact lesson filenames.

---

## Week 1 (Days 1–5): Phase 01 + Phase 02 — Foundations, Monolith vs Microservices

**Day 1**
Goal: Client-server basics and the request lifecycle.
Do: Read `Phase-01-Foundations-and-Request-Lifecycle/01-Client-Server-Basics.md`. From memory, draw the full `Browser → Internet → Load Balancer → Backend → Auth → Database → Response` diagram for a login flow and explain each hop out loud in one sentence.

**Day 2**
Goal: DNS resolution and the "what happens when you type a URL" answer.
Do: Read `02-DNS-and-How-a-Request-Travels.md`. Practice answering "explain what happens when I type google.com into my browser" out loud, unscripted, in under 3 minutes — this is one of the most commonly asked opening questions.

**Day 3**
Goal: Latency, throughput, and back-of-envelope estimation.
Do: Read `03-Latency-Throughput-and-Estimation.md`. Without looking, estimate writes/sec and storage/year for "5 million DAU, each uploads 3 photos/day, average photo 2MB." Check your arithmetic against the lesson's method. Memorize the latency-numbers table.

**Day 4**
Goal: Monolith architecture — structure and trade-offs.
Do: Read `Phase-02-Monolith-vs-Microservices/01-Monolith-Architecture.md`. Sketch a monolith folder structure (`/routes`, `/models`, `/services`) for a simple ecommerce app from scratch. List 2 pros and 2 cons out loud without notes.

**Day 5**
Goal: Microservices architecture, and choosing between the two.
Do: Read `02-Microservices-Architecture.md` and `03-Choosing-Between-Them.md`. Explain out loud how you'd decide monolith vs microservices for a new project, and walk through extracting a Payment Service out of a monolith once it needs independent scaling.

---

## Week 2 (Days 6–11): Phase 03 + Phase 04 — Scalability and Load Balancers

**Day 6**
Goal: Vertical vs horizontal scaling.
Do: Read `Phase-03-Scalability-Fundamentals/01-Vertical-vs-Horizontal-Scaling.md`. Draw both fixes (bigger box vs more boxes + LB) for "1 server handles 100 users, crashes at 1 million." Recite the trade-offs table from memory.

**Day 7**
Goal: Statelessness.
Do: Read `02-Stateless-Services.md`. Explain out loud why a user gets logged out when session state is stored in local server memory and traffic hits a different instance next request. Write both a stateful in-memory-dict snippet and a stateless JWT-decode snippet from scratch.

**Day 8**
Goal: Why load balancing, and health checks.
Do: Read `Phase-04-Load-Balancers/01-Why-Load-Balancing.md`. Explain what happens without health checks (traffic still routed to a dead server) and why that's dangerous.

**Day 9**
Goal: LB algorithms.
Do: Read `02-LB-Algorithms.md`. Compare round robin, weighted round robin, least connections, and consistent hashing out loud. Answer "how would you route requests so the same user always hits the same server, and why" without notes.

**Day 10**
Goal: Nginx/HAProxy/ALB in practice, L4 vs L7.
Do: Read `03-Nginx-HAProxy-ALB-in-Practice.md`. Write a minimal `nginx.conf` upstream block load-balancing across 2-3 backend ports from memory. Explain L4 vs L7 in one sentence each.

**Day 11**
Goal: Consolidate Weeks 1-2.
Do: Review `Quick-Reference/Cheatsheet.md` sections for Phases 01-04 and confirm you can explain every bullet without looking. Do a 10-minute mock: "walk me through what happens when a user clicks Login on a system with 3 backend servers."

---

## Week 3 (Days 12–18): Phase 05 + Phase 06 — Databases and Caching

**Day 12**
Goal: Indexing.
Do: Read `Phase-05-Database-Design-and-Scaling/01-Indexing.md`. Write the SQLAlchemy `index=True` example from scratch. Explain the B-tree/log(n) intuition and the write-cost trade-off out loud.

**Day 13**
Goal: Replication.
Do: Read `02-Replication.md`. Draw the Master → Read Replica ×3 diagram. Explain replication lag and why it matters for consistency.

**Day 14**
Goal: Sharding.
Do: Read `03-Sharding.md`. Draw the A-F/G-M/N-Z range-sharding diagram, then explain hash-based sharding as an alternative and its rebalancing problem.

**Day 15**
Goal: SQL vs NoSQL.
Do: Read `04-SQL-vs-NoSQL.md`. List 3 systems from this course that should be SQL and 3 that should be NoSQL, with a one-sentence reason each.

**Day 16**
Goal: Beyond SQL and NoSQL — specialized data stores.
Do: Read `05-Beyond-SQL-and-NoSQL.md`. Explain out loud when you'd reach for a columnar store, a time-series database, a graph database, or a search index instead of a generic SQL/NoSQL choice, and why each gave up general-purpose flexibility for one access pattern.

**Day 17**
Goal: Cache-aside pattern.
Do: Read `Phase-06-Caching/01-Cache-Aside-Pattern.md`. Write the Redis cache-aside snippet from memory. Explain the contrast with write-through.

**Day 18**
Goal: Eviction/invalidation + Redis in practice.
Do: Read `02-Eviction-and-Invalidation.md` and `03-Redis-in-Practice.md`. Walk through an LRU eviction example on a 3-slot cache by hand. Explain the stale-cache-after-DB-update bug and how to prevent it. List 3 non-caching Redis use cases.

---

## Week 4 (Days 19–24): Phase 07, 08, 09 — Async, Storage/Auth, Distributed Systems

**Day 19**
Goal: Why async processing.
Do: Read `Phase-07-Message-Queues-and-Async/01-Why-Async-Processing.md`. Draw both the synchronous slow-chain diagram and the queue + worker diagram for a video upload.

**Day 20**
Goal: Celery task queues.
Do: Read `02-Celery-Task-Queues.md`. Write the `.delay()` route handler and `@celery.task` worker function from memory. Explain the broker's role and retry/failure handling.

**Day 21**
Goal: Pub-sub and event-driven design; storage and gateway.
Do: Read `03-Pub-Sub-and-Event-Driven.md` and `Phase-08-Storage-Gateway-and-Auth/01-Object-Storage.md` + `02-API-Gateway.md`. Explain task queue vs pub-sub, Kafka vs RabbitMQ at a conceptual level, and why images shouldn't live in SQL.

**Day 22**
Goal: JWT authentication; monitoring/observability.
Do: Read `03-JWT-Authentication.md` and `Phase-09-Observability-and-Distributed-Systems/01-Monitoring-and-Observability.md`. Write the `jwt.encode(...)` snippet from memory. List the 3 pillars of observability and what companies commonly monitor.

**Day 23**
Goal: CAP theorem and consistency/consensus basics.
Do: Read `02-CAP-Theorem.md` and `03-Consistency-and-Consensus-Basics.md`. Explain CAP as really a C-vs-A choice during a partition, with a CP and an AP example. Explain strong vs eventual consistency with the bank-balance vs like-count example, and what a quorum is.

**Day 24**
Goal: Resilience and fault-tolerance patterns.
Do: Read `04-Resilience-and-Fault-Tolerance-Patterns.md`. Explain out loud, end to end, what happens when a downstream dependency starts timing out: timeouts bound the hang, retries with backoff+jitter handle the transient case, a circuit breaker stops hammering a dependency that's genuinely down, a bulkhead keeps that failure from starving calls to other dependencies, and graceful degradation (or a deliberate fail-loud) decides what the caller shows the user. Write the circuit breaker's three-state transition from memory.

---

## Week 5 (Days 25–34): Phase 10 + Phase 11 — Case Studies (the interview core)

**Day 25**
Goal: WhatsApp/Chat case study.
Do: Read `Phase-10-Case-Studies-Social-and-Media/01-WhatsApp-Chat.md`. Do the full 5-part walkthrough (Requirements → Estimation → Architecture → Deep dive → Trade-offs) out loud from memory, then check against the lesson. Focus extra attention on message delivery and online presence.

**Day 26**
Goal: Instagram and Twitter/X case studies.
Do: Read `02-Instagram.md` and `03-Twitter-X.md`. Compare fan-out-on-write vs fan-out-on-read and the celebrity-account hybrid problem for both systems out loud.

**Day 27**
Goal: YouTube, Netflix, and Notification Service case studies.
Do: Read `04-YouTube.md`, `05-Netflix.md`, `06-Notification-Service.md`. Focus on the transcoding pipeline, CDN delivery, and fan-out-to-multiple-channels-with-dedup pattern.

**Day 28**
Goal: Uber/Lyft and Swiggy/Zomato case studies.
Do: Read `Phase-11-Case-Studies-Marketplace-and-Utility/01-Uber-Lyft.md` and `02-Swiggy-Zomato.md`. Explain geospatial matching and contrast the 2-sided vs 3-sided marketplace out loud.

**Day 29**
Goal: Hotel Booking and Flight Booking case studies.
Do: Read `03-Hotel-Booking.md` and `04-Flight-Booking.md`. Explain pessimistic vs optimistic locking for double-booking prevention, and why flight seat contention differs from hotel rooms.

**Day 30**
Goal: URL Shortener and Google Drive case studies.
Do: Read `05-URL-Shortener.md` and `06-Google-Drive.md`. Explain short-code generation strategies and content-hash deduplication.

**Day 31**
Goal: Google Docs and Payment Gateway case studies.
Do: Read `07-Google-Docs.md` and `08-Payment-Gateway.md`. Explain idempotency keys and the outbox pattern for payments.

**Day 32**
Goal: Rate Limiter case study.
Do: Read `09-Rate-Limiter.md`. Explain the four standard algorithms (fixed window, sliding window log, sliding window counter, token bucket/leaky bucket) and their trade-offs out loud. Walk through the naive `GET`-then-`SET` race condition and why Redis `INCR` (or a Lua script) fixes it.

**Day 33**
Goal: Web Crawler case study.
Do: Read `10-Web-Crawler.md`. Explain the two-level URL frontier (priority front queues + per-domain back queues), why crawler workers are partitioned by a consistent hash of the domain, and how a Bloom filter keeps duplicate-URL detection cheap at billions of entries.

**Day 34**
Goal: Distributed Key-Value Store case study; consolidate Phase 11.
Do: Read `11-Distributed-Key-Value-Store.md`. Explain consistent hashing with virtual nodes for partitioning/replica placement, and derive `W + R > N` out loud with a concrete `N=3` example at a couple of different `(W, R)` settings. Then pick any 2 case studies from Phase 11 at random (including one of the 3 new ones) and do the full 5-part walkthrough from memory, timed to 15 minutes each.

---

## Week 6 (Days 35–37): Phase 12 + Mock Interviews + Projects/ End-to-End

**Day 35**
Goal: The design interview framework and mock interview walkthrough.
Do: Read `Phase-12-Interview-Process-and-Advanced/01-The-Design-Interview-Framework.md` and `02-Mock-Interview-Walkthrough.md`. Run the framework's 6 steps out loud against a case study you haven't reviewed recently. Note where you rushed past requirements-clarification — the most common failure mode.

**Day 36**
Goal: Staff-level extensions; two full mock interviews.
Do: Read `03-Staff-Level-Extensions.md` (multi-region, RPO/RTO, capacity planning at 10x). Do two full 25-minute mock interviews (pick two "design X" prompts not yet drilled), applying the framework end to end and pushing yourself to the staff-level follow-up ("what if this needs 10x the users?").

**Day 37**
Goal: Run the `Projects/` Instagram-backend track end-to-end and final review.
Do: Work through `HLD/Projects/` stages 01-10 in order, actually running each stage locally (`uvicorn`, `curl`, `celery -A worker worker`, `docker compose up`) rather than just reading — this is where the phases' concepts turn into working code. Finish with a final pass over `Quick-Reference/Cheatsheet.md` and `Interview-QA.md`, confirming you can answer all 60 questions without notes.
