# Master Synthesis Map

Twelve phases teach twelve tools one at a time. No single interview question ever asks about one tool in isolation — it hands you a product and expects you to place every tool from every phase onto one coherent diagram, in the right order, under 45 minutes. This page is the antidote to "I read Phase 06 three weeks ago and can recall Redis exists, but not where it sits relative to the database." Read this page in five minutes, and you should be able to redraw the whole thing from memory.

---

## 1. The One Reference Architecture

Every "design X" question in Phases 10-11 is a specialization of the picture below. Nothing in this diagram is decorative — every box is a phase you already studied, placed in its actual position on a request's path from a client's finger to a byte on disk and back.

```
 CLIENT (browser / mobile app)
   │
   │  1. resolve hostname → IP
   ▼
 ┌────────────────────────────────────────────────────────────┐
 │ DNS                                                          │  Phase 01 L02
 │ browser cache → OS cache → resolver → root → TLD → auth NS   │
 └───────────────────────────┬────────────────────────────────┘
                              │  IP address returned
                              ▼
 ┌────────────────────────────────────────────────────────────┐
 │ CDN (edge cache, nearest PoP)                                 │  Phase 08 L01 (object storage
 │ serves static assets / images / video variants from the edge; │  companion) + Phase 10-11
 │ cache MISS falls through to origin below                       │  (Instagram/YouTube/Netflix)
 └───────────────────────────┬────────────────────────────────┘
                    (cache miss, or dynamic request)
                              ▼
 ┌────────────────────────────────────────────────────────────┐
 │ LOAD BALANCER (L4 or L7 — Nginx / HAProxy / ALB)               │  Phase 04
 │ round robin / weighted RR / least-connections / consistent     │
 │ hashing; health checks route around dead instances              │
 └───────────────────────────┬────────────────────────────────┘
                              ▼
 ┌────────────────────────────────────────────────────────────┐
 │ API GATEWAY                                                    │  Phase 08 L02
 │ single entry point: routing, rate limiting, request/response   │
 │ transformation — clients never talk to services directly        │
 └───────────────────────────┬────────────────────────────────┘
                              ▼
 ┌────────────────────────────────────────────────────────────┐
 │ AUTH (JWT verification)                                        │  Phase 08 L03
 │ signature check, no server-side session lookup — this is what   │
 │ keeps the tier below stateless                                   │
 └───────────────────────────┬────────────────────────────────┘
                              ▼
 ┌────────────────────────────────────────────────────────────┐
 │ SERVICE(S) — stateless application tier                        │  Phase 02 (monolith vs
 │ one service (monolith) or many (microservices: Auth/Order/       │  microservices) + Phase 03
 │ Payment/...), each instance interchangeable, no local session      │  (stateless services)
 └──────┬─────────────────────────────────────┬───────────────┘
        │  read/write hot data                │  fire-and-forget /
        ▼                                     │  slow work
 ┌───────────────────┐                        │
 │ CACHE (Redis)        │  Phase 06             │
 │ cache-aside: check →  │  check-then-fill,      │
 │ miss → read DB → fill │  invalidate-on-write     │
 └────────┬──────────┘                        │
          │ miss                              ▼
          ▼                          ┌────────────────────┐
 ┌────────────────────────────┐      │ MESSAGE QUEUE          │  Phase 07 L01/L03
 │ DATABASE                       │      │ (Kafka / RabbitMQ /    │  task queue (one consumer)
 │  ┌────────┐   ┌──────────┐    │      │  Celery broker)         │  vs pub-sub (many
 │  │ Primary  │──▶│ Replica 1 │   │      └──────────┬─────────┘  subscribers)
 │  │ (writes) │  │ Replica 2 │   │                   ▼
 │  └────────┘   └──────────┘    │      ┌────────────────────┐
 │       (reads split across      │      │ BACKGROUND WORKERS      │  Phase 07 L02
 │        replicas — Phase 05 L02) │      │ (Celery workers: video   │
 │  Shard A │ Shard B │ Shard C     │      │  transcode, email send,   │
 │  (Phase 05 L03 — split by key)    │      │  fan-out, notifications)   │
 │  SQL vs NoSQL choice — Phase 05    │      └──────────┬─────────┘
 │  L04/L05                            │                 │ writes results back
 └────────────────┬───────────────┘                 ▼
                   │                        ┌────────────────────┐
                   │                        │ OBJECT STORAGE          │  Phase 08 L01
                   │                        │ (S3/GCS — binary blobs;   │
                   │                        │  DB stores only the URL)   │
                   │                        └──────────┬─────────┘
                   │                                     │  served back through
                   └─────────────────────────────────────┘  the CDN at the top
                                    ▲
                                    │  watches every box above, all the time
 ┌────────────────────────────────────────────────────────────┐
 │ MONITORING / OBSERVABILITY (Prometheus, Grafana, ELK)          │  Phase 09 L01
 │ metrics + logs + traces; alert on symptoms (latency, error       │
 │ rate) not just causes; CAP/consistency choices (Phase 09 L02-03)  │
 │ govern how the replica/shard tier behaves during a partition;      │
 │ Resilience and Fault Tolerance Patterns (Phase 09) — retries with    │
 │ backoff, circuit breakers, timeouts, bulkheads — sit at every arrow   │
 │ in this diagram, not just one box                                      │
 └────────────────────────────────────────────────────────────┘
```

**Reading the diagram like an interviewer will probe it:**
- The **top half** (DNS → CDN → LB → Gateway → Auth → Service) is the synchronous request path — every box adds latency, so every box you add needs to justify its cost.
- The **cache-then-database** branch is the read path's fast lane; the **queue-then-worker** branch is anything too slow or non-critical to make the client wait for.
- **Object storage** and **the database** are deliberately separate boxes — binary blobs never belong in a relational row (Phase 08 L01), and this split shows up in nearly every Phase 10-11 case study (Instagram's photo, YouTube's video, Drive's file).
- **Monitoring** is drawn wrapping the whole thing because it's the only phase that isn't a stage in the request path — it's the thing watching every other stage simultaneously, plus the resilience patterns (circuit breakers, retries, timeouts) that decide what happens when any one box above is slow or down.

---

## 2. Where Every Phase's Tool Slots In

When you get *any* design question, the move is not "invent an architecture from scratch" — it's "walk this exact diagram left to right and top to bottom, deciding for each box whether this specific system needs it, and if so, which flavor." Client can't find the server → Phase 01 (DNS). Too much traffic for one box → Phase 03 (scale out) + Phase 04 (load balancer) to spread it. One server can't hold everyone's session → Phase 03 (statelessness) forces you to Phase 08 (JWT) or a shared Redis. Reads are dominating writes → Phase 06 (cache) first, then Phase 05 L02 (read replicas) if cache alone isn't enough. Writes or total data no longer fit one machine → Phase 05 L03 (sharding), and immediately ask "SQL or NoSQL" (Phase 05 L04-05) before committing to a shard key. Some work is slow and shouldn't block the response → Phase 07 (queue + worker). Users upload big binary files → Phase 08 L01 (object storage), never a database column. Multiple services now exist and need one door → Phase 08 L02 (API Gateway) and Phase 02 (did you actually need to split services yet?). You have more than one node holding the same data → Phase 09 (CAP: pick consistency or availability under partition, and know which of your case-study's writes demands which). And through all of it: how do you know any of this is healthy right now, and what happens automatically when one box misbehaves → Phase 09 (observability + resilience patterns: retries, circuit breakers, timeouts). Phases 10-11's fourteen case studies are nothing but this same walk, fourteen times, with the emphasis shifted onto whichever 1-2 boxes are that specific system's hardest problem — feed fan-out for Instagram/Twitter, transcoding for YouTube, geospatial matching for Uber/Swiggy, contention control for Hotel/Flight booking, idempotency for Payment Gateway, OT/CRDT merge for Google Docs, dedup/chunking for Drive, short-code generation for the URL Shortener, token-bucket math for a Rate Limiter, politeness/dedup crawling for a Web Crawler, and consistent hashing/quorum writes for a Distributed Key-Value Store.

---

## 3. Phase → Mental Model → The Question That Tests Real Understanding

| Phase | One-line mental model | The single question that tests if you really get it |
|---|---|---|
| 01 — Foundations & Request Lifecycle | A request is a chain of hops (DNS → LB → backend → DB) and every hop costs latency you must be able to estimate. | "Walk me through every hop from typing a URL to seeing a page, and give me a rough latency number for each." |
| 02 — Monolith vs Microservices | Start as one deployable unit; split a piece out only when it needs independent scaling, deploys, or a team boundary. | "Why would you split Payments out of the monolith, and why *not* split everything on day one?" |
| 03 — Scalability Fundamentals | Scale out (many stateless boxes), not up (one bigger box) — but "stateless" only works if session state is externalized. | "A user's session breaks when their next request lands on a different server — what did you forget?" |
| 04 — Load Balancers | An LB fans traffic across a fleet and routes around dead instances — the algorithm choice depends on what "fair" means for your traffic. | "Why would you pick consistent hashing over round robin, and what breaks if you don't have health checks?" |
| 05 — Database Design & Scaling | Index for read speed, replicate for read scale, shard for write/data scale, and pick SQL vs NoSQL by consistency need, not by hype. | "Your shard key is user_id and you need to join across two users' data — what do you do?" |
| 06 — Caching | Cache-aside: check-then-fill on read, invalidate-on-write to stay correct. | "What happens to stale data after a DB update if you forget to invalidate?" |
| 07 — Message Queues & Async | Move slow/non-critical work off the request path; a queue absorbs bursts a synchronous call can't. | "Your worker crashes mid-job after reading off the queue but before finishing — did you lose the job, and how do you know?" |
| 08 — Storage, Gateway & Auth | Blobs go in object storage (DB holds only the URL); one gateway is the single door; JWT makes auth stateless. | "Why can't you just store the uploaded image as a BLOB column in Postgres at scale?" |
| 09 — Observability & Distributed Systems | You can only pick two of Consistency/Availability/Partition-tolerance when a partition happens — and partition tolerance isn't optional, so it's really C vs A. Resilience patterns (retries, circuit breakers, timeouts) decide what a caller does when a dependency is slow or down. | "Your payments DB and your feed DB both replicate — why is one CP and the other AP, and what would a circuit breaker do differently for each when the DB is unreachable?" |
| 10 — Case Studies: Social & Media | Read-heavy social products live or die on fan-out strategy (write vs read) and CDN-fronted blob delivery. | "Why does a celebrity account break naive fan-out-on-write, and what's the hybrid fix?" |
| 11 — Case Studies: Marketplace & Utility | Marketplaces need real-time geospatial matching; booking/payment systems need strong consistency under contention, not eventual consistency at scale. | "Two users book the last hotel room in the same second — walk me through exactly what stops both bookings from succeeding." |
| 12 — Interview Process & Advanced | A repeatable 5-6 step framework beats improvising, and staff-level answers add multi-region/DR/10x capacity planning on top. | "You've drawn the single-region design — what specifically changes to survive an entire region going down?" |

---

## 4. One Last Gut-Check

If you can look at the big diagram in Section 1, cover it with your hand, and redraw every box plus its phase label from memory in under two minutes — you're ready to move on to `Blind-Recall-Checklist.md` for the harder, per-topic self-test.
