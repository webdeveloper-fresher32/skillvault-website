# Stage 10: Scaling Discussion — Millions of Users

This stage adds no new code. Stages 1-9 built a real, runnable Instagram-clone backend — but it runs on a single Postgres instance, a single Redis instance, and a single MinIO server, all reachable through one Nginx entrypoint. That setup is honest about where it would break under real traffic. This file is the bridge back from "toy project" to "everything taught in the 12 phases" — walking through each earlier decision, the user count at which it starts to strain, and the fix, citing the exact phase lesson that covers it.

## 1. Single Postgres Write Node

**Breaks around:** tens of thousands of writes/sec, or once the working set no longer fits comfortably in the primary's RAM/IOPS budget. A single Postgres instance handling every `POST /posts` and every `POST /signup` for millions of active users becomes the first hard ceiling — reads *and* writes are competing for the same machine.

**The fix, in two stages:**
- First, split reads off the write path: add **read replicas** and route `GET /posts` to a replica, keeping `POST /posts` on the primary. This is exactly **[`Phase-05-Database-Design-and-Scaling/02-Replication.md`](../Phase-05-Database-Design-and-Scaling/02-Replication.md)** — master handles writes, replicas absorb read load, with the caveat that replication lag means a just-created post might not immediately appear on a replica-served feed.
- Once writes themselves outgrow one machine (posts table alone, at Instagram's scale, wouldn't fit one node), **shard** the `Post` table — e.g., by `user_id` hash range across N Postgres nodes. This is **[`Phase-05-Database-Design-and-Scaling/03-Sharding.md`](../Phase-05-Database-Design-and-Scaling/03-Sharding.md)**, and it reintroduces the cross-shard query problem that lesson calls out directly: "show me all posts from users I follow" now has to fan out across shards instead of running one query.

## 2. Single Redis Instance

**Breaks around:** when either the cache's memory footprint exceeds one machine's RAM, or the request rate against it exceeds what one Redis process (single-threaded for command execution) can serve.

**The fix:** Redis Cluster — partition keys across multiple Redis nodes by hash slot, the same conceptual move as Postgres sharding above. **[`Phase-06-Caching/03-Redis-in-Practice.md`](../Phase-06-Caching/03-Redis-in-Practice.md)** covers Redis's data-structure toolbox (this project only used simple key-value cache-aside from Lesson 01; a real feed service at scale would likely also lean on sorted sets for ranked/paginated feeds). The cache-aside *pattern* itself from Stage 4 doesn't change — only the number of Redis nodes serving it does.

## 3. MinIO / Object Storage Serving Every Image Read Directly

**Breaks around:** the moment image traffic is read-heavy and geographically spread out — every image view in Stage 6-9's setup round-trips to wherever the single MinIO container lives, no matter how far the requester is.

**The fix:** put a CDN in front of the object store (CloudFront in front of S3, in production terms) so images are served from an edge location near the reader instead of the origin every time. This ties to the load-balancing/edge-distribution thinking in **[`Phase-04-Load-Balancers/`](../Phase-04-Load-Balancers/)** — a CDN is, conceptually, a globally distributed cache-and-routing layer sitting in front of origin storage, solving the same "don't make every request hit one machine" problem load balancers solve for compute.

## 4. Single-Region Deployment

**Breaks around:** once users are global and either latency (a user in Singapore hitting a US-only deployment) or availability (a full regional outage taking the whole product down) becomes unacceptable.

**The fix:** multi-region architecture — active-active (multiple regions serving live traffic, harder consistency story) or active-passive (one region serves traffic, another stands by for failover). This is a staff-level extension covered in **[`Phase-12-Interview-Process-and-Advanced/03-Staff-Level-Extensions.md`](../Phase-12-Interview-Process-and-Advanced/03-Staff-Level-Extensions.md)**, along with the RPO/RTO framing for how much data loss and downtime a failover is allowed to cost.

## 5. Nginx as a Single Load-Balancer Instance

**Breaks around:** the Nginx container itself becomes a single point of failure and a throughput ceiling once instance count and request volume grow past what one reverse-proxy process can handle.

**The fix:** run multiple load-balancer instances behind a cloud-managed, already-distributed layer (an AWS ALB/NLB, or DNS-based traffic distribution across multiple Nginx nodes) — the LB tier itself needs to scale horizontally the same way the app tier does. **[`Phase-04-Load-Balancers/01-Why-Load-Balancing.md`](../Phase-04-Load-Balancers/01-Why-Load-Balancing.md)** and **[`02-LB-Algorithms.md`](../Phase-04-Load-Balancers/02-LB-Algorithms.md)** cover the algorithm choices (round robin vs least-connections vs consistent hashing) that matter more once there are many backend instances to spread traffic across evenly.

## 6. Celery Worker Pool Sized for One Machine's Traffic

**Breaks around:** thumbnail-generation backlog growing faster than one worker pool can drain it — visible as a growing queue depth in Redis/RabbitMQ rather than a crash.

**The fix:** horizontally scale worker count (`celery -A tasks worker --concurrency=N`, and more worker containers/machines), which is trivial precisely *because* Stage 5 already made image processing async and queue-based rather than inline on the request path — the fix Phase 07 sets up for exactly this reason. See **[`Phase-07-Message-Queues-and-Async/02-Celery-Task-Queues.md`](../Phase-07-Message-Queues-and-Async/02-Celery-Task-Queues.md)**.

## Summary Table

| Component (Stage) | Breaks around | Fix | Phase Lesson |
|---|---|---|---|
| Postgres primary (Stage 3) | tens of thousands of writes/sec | Read replicas, then sharding | Phase 05 L02, L03 |
| Redis (Stage 4) | cache memory/throughput ceiling on one node | Redis Cluster | Phase 06 L03 |
| MinIO origin (Stage 6) | global read-heavy image traffic | CDN in front of object storage | Phase 04 (edge distribution) |
| Single region (Stages 1-9) | global user base, regional outage risk | Multi-region active-active/passive | Phase 12 L03 |
| Nginx (Stage 7) | LB tier throughput/SPOF | Cloud-managed, horizontally scaled LB layer | Phase 04 L01, L02 |
| Celery workers (Stage 5) | queue backlog growth | Scale worker count/concurrency | Phase 07 L02 |

Every fix in this table is a scale-out of a pattern this project already used at small scale — nothing here requires re-architecting the application logic in Stages 1-9, which is exactly the point: build it stateless and horizontally-scalable-by-default from Stage 1, and "scaling it up" becomes a matter of adding more of the same kind of node, not a rewrite.
