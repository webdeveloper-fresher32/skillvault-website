# Blind Recall Checklist

This is the final gate, not a study guide. Everything below should be doable **from memory, with no notes open** — no lesson file, no cheatsheet, no `Master-Synthesis-Map.md`. If you have to go check something to tick a box, that's not a pass — go re-read the lesson, close it, wait a day, and try again. Interviewers can tell the difference between "I remember the term" and "I can rebuild the reasoning live," and this checklist is built to expose exactly that gap.

Work through it phase by phase. Don't skip to the case studies until Phases 01-09 are all checked — the case studies are just those building blocks recombined, and gaps upstream will surface as "I don't know why I chose this" downstream.

---

## Phase 01 — Foundations and Request Lifecycle
- [ ] Draw the Browser → DNS → LB → Backend → Cache → DB → Response diagram from Phase 01, unprompted, in under 60 seconds.
- [ ] Recite the DNS resolution order (browser cache → OS cache → resolver → root → TLD → authoritative) without skipping a hop.
- [ ] Given a made-up DAU number, derive requests/sec and annual storage on a blank page in under 3 minutes, showing the arithmetic, not just the final number.

## Phase 02 — Monolith vs Microservices
- [ ] State two concrete costs of microservices (not just "network calls are slower") and two concrete costs of staying monolithic.
- [ ] Explain Conway's Law in one sentence and give an example of a team boundary that would justify splitting a service.
- [ ] Argue, out loud, why "start monolith, split later" is the default advice — and name the one signal that tells you it's time to split.

## Phase 03 — Scalability Fundamentals
- [ ] Explain why vertical scaling always hits a ceiling and why horizontal scaling doesn't (in principle).
- [ ] Define "stateless service" precisely enough that you could spot a stateful design flaw in someone else's diagram.
- [ ] Name both fixes for state (JWT client-side, shared Redis server-side) and say when you'd pick each.

## Phase 04 — Load Balancers
- [ ] Name all four LB algorithms (round robin, weighted round robin, least connections, consistent hashing) and, for each, one scenario where it's the wrong choice.
- [ ] Explain why health checks are mandatory, not optional, using a concrete failure scenario.
- [ ] Explain the difference between L4 and L7 load balancing and give one thing only L7 can do.

## Phase 05 — Database Design and Scaling
- [ ] Explain why an index speeds up reads and slows down writes, in terms of the underlying B-tree, not just "it's faster."
- [ ] Draw a primary + N read-replica topology and explain what replication lag means for a user who just wrote data and immediately re-reads it.
- [ ] Explain range sharding vs hash sharding and name the classic pain point of each (range: hot shards; hash: hard range queries) plus what makes rebalancing hard.
- [ ] Give the one-sentence SQL-vs-NoSQL decision rule, then name at least one of columnar, time-series, graph, or search-index stores from the "Beyond SQL and NoSQL" lesson and the one workload each is built for.

## Phase 06 — Caching
- [ ] Explain cache-aside end to end (check → miss → read DB → populate cache → return) without looking, including what happens on a hit.
- [ ] Name all three eviction policies (LRU, LFU, TTL) and say which one a leaderboard cache vs a rarely-changing config cache should use.
- [ ] Answer, unprompted: "What happens to stale data after a DB update if you forget to invalidate?" — and state the fix (delete-on-write) precisely.

## Phase 07 — Message Queues and Async Processing
- [ ] Explain the difference between a task queue (one consumer per job) and pub-sub (many subscribers per event) with a concrete example of each.
- [ ] Trace what happens to a job if a Celery worker crashes mid-task — where does the job go, and how do you avoid silently losing it?
- [ ] Explain when you'd reach for Kafka over RabbitMQ (replay-ability, throughput) versus the reverse (simpler routing).

## Phase 08 — Storage, Gateway and Auth
- [ ] State the rule for object storage vs database rows for binary data, and explain in your own words *why* a BLOB column doesn't scale.
- [ ] List three responsibilities of an API Gateway (routing, rate limiting, transformation) beyond "it's the entry point."
- [ ] Walk through the full JWT lifecycle (login → token issued → attached to requests → signature verified, no session lookup) and explain why this is what makes auth stateless.

## Phase 09 — Observability and Distributed Systems
- [ ] Name the three pillars of observability (metrics, logs, traces) and explain why you alert on symptoms (latency, error rate) rather than only on causes.
- [ ] Explain the CAP theorem correctly — including *why* partition tolerance isn't really optional, making it a C-vs-A choice — and give one real CP example and one real AP example.
- [ ] Explain strong vs eventual consistency with one example each (bank balance vs like-count) and define quorum in one sentence.
- [ ] From the Resilience and Fault Tolerance Patterns lesson: explain what a circuit breaker does differently from a plain retry-with-backoff, and describe a scenario where retrying blindly makes an outage worse.

## Phase 10 — Case Studies: Social and Media
- [ ] **WhatsApp** — explain how the system knows which gateway instance holds a user's live socket, and how a message gets delivered to someone who's offline when it was sent.
- [ ] **Instagram** — explain fan-out-on-write vs fan-out-on-read for feed generation, and state the celebrity-account problem with fan-out-on-write in one sentence.
- [ ] **Twitter/X** — explain why Twitter's fan-out problem is *worse* than Instagram's (retweets + heavier follower skew), and describe the trending-topics pipeline as a separate stream from the timeline path.
- [ ] **YouTube** — explain the asymmetry that drives the whole design ("upload can be slow, playback must not be") and name the two pipeline stages between upload and watchable video.
- [ ] **Netflix** — explain why Netflix can pre-position content in CDN edge caches *before* demand hits, while YouTube fundamentally cannot.
- [ ] **Notification Service** — explain why push/email/SMS get separate queues instead of one shared queue, and state the at-least-once-with-dedup trade-off in your own words.

## Phase 11 — Case Studies: Marketplace and Utility
- [ ] **Uber/Lyft** — explain why driver location pings never write straight to a relational database, and name the data structure (geospatial index / geohash / quadtree) used for nearest-driver queries.
- [ ] **Swiggy/Zomato** — name the three sides of the marketplace and describe the order-state machine from placed to delivered without skipping a state.
- [ ] **Hotel Booking** — explain why search and booking are split into a cacheable read path and a strongly-consistent write path, and why "the cache is stale" is a fine excuse for search but not for booking.
- [ ] **Flight Booking** — explain why flight seat contention is a more extreme version of the hotel problem, and name the concurrency-control technique (optimistic locking with retry) it leans on and why.
- [ ] **URL Shortener** — explain both short-code generation strategies (base62 counter vs hash + collision handling) and state which one real systems prefer and why.
- [ ] **Google Drive** — explain how large-file upload is made resumable, and how content-hash-based deduplication avoids storing the same file twice.
- [ ] **Google Docs** — name both families of real-time-merge algorithms (OT and CRDT), state the one-sentence problem each solves, and say which is more server-centric.
- [ ] **Payment Gateway** — explain the idempotency-key mechanism precisely enough to say what the server does differently on a retried request, and name the outbox pattern's purpose in one sentence.
- [ ] **Rate Limiter** — derive the token bucket algorithm's math from scratch (bucket capacity, refill rate, how a request is admitted or rejected) — not just the name "token bucket."
- [ ] **Web Crawler** — explain the politeness constraint (don't hammer one domain) and how the crawler avoids re-crawling or infinitely looping on already-seen URLs.
- [ ] **Distributed Key-Value Store** — explain consistent hashing's purpose in this system (minimizing data movement on node add/remove) and describe what a quorum read/write means for this store's consistency guarantee.
- [ ] For at least 3 of the 14 case-study systems above, state their single hardest sub-problem and its fix without looking it up.

## Phase 12 — Interview Process and Advanced
- [ ] Recite the 5-6 step interview framework (clarify requirements/scale → estimate → propose architecture → deep-dive → trade-offs at 10x → monitoring/failure handling) without missing a step.
- [ ] Name the most common failure mode (jumping to a solution before clarifying requirements) and describe what a strong opening 3 minutes of an interview sounds like instead.
- [ ] Explain the difference between active-active and active-passive multi-region setups, and define RPO and RTO precisely enough to use them correctly in a sentence each.

---

## The Real Final Gate

- [ ] Pick one case study at random from Phases 10-11 (all 14 — cover the sheet, roll a die, whatever), give yourself 45 minutes, and produce all 5 parts (requirements → estimation → architecture → deep dive → trade-offs at 10x) on a blank page with zero notes.
- [ ] Redraw the full reference architecture from `Master-Synthesis-Map.md` Section 1 from memory, labeling every box with its phase, in under 2 minutes.
- [ ] Explain to someone else (or out loud to yourself) why each phase exists in the order it does — i.e., why caching (06) comes before queues (07), and why case studies (10-11) come after observability (09) and not before.

Only once every box above is checked — genuinely, without peeking — should you consider this course "interview-ready."
